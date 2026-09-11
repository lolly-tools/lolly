// SPDX-License-Identifier: MPL-2.0
/**
 * Authored-deck-model lowering tests (the pure tool→native-pptx half).
 * Run under node:test. Covers colour parsing, px→EMU, defensive coercion of untrusted
 * tool JSON, and a full lowering → buildPptxParts integration so real OOXML is asserted.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { deckAnim, deckAudioExt, deckColor, deckFill, deckNarrationMark, deckNotes, deckPara, deckPh, deckPlaceholder, deckSyncShape, deckTheme, parseDeckModel, resolveDeckColorValue, emuOf, asStr } from './pptx-deck.ts';
import type { DeckColorResolver } from './pptx-deck.ts';
import { buildPptxParts, EMU_PER_PX } from '../../../../engine/src/pptx.ts';
import type { PptxTable, PptxText, PptxRect, PptxSlide } from '../../../../engine/src/pptx.ts';

test('deckColor parses hex (3/4/6/8), rgb, rgba; rejects junk', () => {
  assert.deepEqual(deckColor('#30BA78'), { hex: '30BA78', alpha: undefined });
  assert.deepEqual(deckColor('30ba78'), { hex: '30BA78', alpha: undefined });
  assert.deepEqual(deckColor('#3bf'), { hex: '33BBFF', alpha: undefined });          // shorthand expands
  assert.equal(deckColor('#3bf8')!.hex, '33BBFF');                                    // 4-digit → rgb + alpha
  assert.ok(Math.abs(deckColor('#3bf8')!.alpha! - 0x88 / 255) < 1e-6);
  assert.deepEqual(deckColor('rgb(48,186,120)'), { hex: '30BA78', alpha: undefined });
  assert.ok(Math.abs(deckColor('rgba(0,0,0,0.5)')!.alpha! - 0.5) < 1e-6);
  assert.equal(deckColor('transparent'), null);
  assert.equal(deckColor('rgba(0,0,0,0)'), null);
  assert.equal(deckColor('not-a-color'), null);
  assert.equal(deckColor(42), null);
});

test('emuOf converts px→EMU and is NaN-safe', () => {
  assert.equal(emuOf(96), Math.round(96 * EMU_PER_PX));
  assert.equal(emuOf(NaN, 10), Math.round(10 * EMU_PER_PX));
  assert.equal(emuOf('x' as unknown, 0), 0);
});

test('deckFill handles a solid colour and a gradient; needs ≥2 stops', () => {
  assert.deepEqual(deckFill('#000000'), { solid: '000000', alpha: undefined });
  const g = deckFill({ grad: { stops: [{ pos: 0, color: '#fff' }, { pos: 1, color: '#000' }], angle: 90 } });
  assert.ok(g && 'grad' in g && g.grad.length === 2 && g.angle === 90);
  assert.equal(deckFill({ grad: { stops: [{ pos: 0, color: '#fff' }] } }), undefined); // 1 stop → none
  assert.equal(deckFill('bogus'), undefined);
});

test('deckPara lowers bullets/levels/spacing and drops unknown bullet shapes', () => {
  const p = deckPara({ align: 'ctr', level: 2, bullet: 'number', lineSpacingPct: 150, spaceBeforePt: 6, runs: [{ text: 'x', sizePt: 14, underline: true }] });
  assert.equal(p.align, 'ctr'); assert.equal(p.level, 2); assert.equal(p.bullet, 'number');
  assert.equal(p.lineSpacingPct, 150); assert.equal(p.spaceBeforePt, 6);
  assert.equal(p.runs[0]!.underline, true);
  assert.deepEqual(deckPara({ bullet: { char: '★' }, runs: [] }).bullet, { char: '★' });
  assert.equal(deckPara({ bullet: 'weird', runs: [] }).bullet, undefined);            // junk bullet dropped
  assert.equal(deckPara({ align: 'diagonal', runs: [] }).align, undefined);           // junk align dropped
});

test('deckSyncShape builds rect/text/table; image and unknown → null', () => {
  const rect = deckSyncShape({ t: 'rect', x: 10, y: 20, w: 100, h: 50, fill: '#123456', radius: 8 }) as PptxRect;
  assert.equal(rect.kind, 'rect'); assert.equal(rect.x, emuOf(10)); assert.equal(rect.cx, emuOf(100));
  assert.deepEqual(rect.fill, { solid: '123456', alpha: undefined });

  const text = deckSyncShape({ t: 'text', x: 0, y: 0, w: 200, h: 40, anchor: 'ctr', paras: [{ runs: [{ text: 'hi', sizePt: 18 }] }] }) as PptxText;
  assert.equal(text.kind, 'text'); assert.equal(text.anchor, 'ctr'); assert.equal(text.paras[0]!.runs[0]!.text, 'hi');

  const table = deckSyncShape({ t: 'table', x: 0, y: 0, w: 300, h: 100, firstRow: true, cols: [150, 150],
    rows: [{ cells: [{ text: 'A', bold: true, fill: '#eee' }, { text: 'B', colSpan: 1 }] }] }) as PptxTable;
  assert.equal(table.kind, 'table'); assert.equal(table.cols.length, 2); assert.equal(table.firstRow, true);
  assert.equal(table.rows[0]!.cells[0]!.text, 'A'); assert.equal(table.rows[0]!.cells[0]!.fill, 'EEEEEE');

  assert.equal(deckSyncShape({ t: 'image', src: 'x' }), null);   // async → caller
  assert.equal(deckSyncShape({ t: 'bogus' }), null);
  assert.equal(deckSyncShape({} as Record<string, unknown>), null);
});

test('deckTheme maps css colours→hex + fonts; empty → undefined', () => {
  const t = deckTheme({ name: 'SUSE', colors: { accent1: '#30BA78', dk2: 'rgb(12,50,44)' }, fonts: { major: 'SUSE' } });
  assert.equal(t!.name, 'SUSE'); assert.equal(t!.colors!.accent1, '30BA78'); assert.equal(t!.colors!.dk2, '0C322C');
  assert.equal(t!.fonts!.major, 'SUSE');
  assert.equal(deckTheme({}), undefined);
  assert.equal(deckTheme(null), undefined);
});

test('parseDeckModel accepts a valid deck, rejects blanks/malformed/empty-slides', () => {
  assert.ok(parseDeckModel('{"slides":[{"elements":[]}]}'));
  assert.equal(parseDeckModel('{"slides":[]}'), null);   // empty slides → DOM-walk fallback
  assert.equal(parseDeckModel('not json'), null);
  assert.equal(parseDeckModel(''), null);
  assert.equal(parseDeckModel(null), null);
  assert.equal(parseDeckModel('{"nope":1}'), null);
});

test('asStr guards non-strings', () => {
  assert.equal(asStr('a'), 'a');
  assert.equal(asStr(1), undefined);
  assert.equal(asStr(undefined), undefined);
});

// ── integration: a lowered deck produces valid OOXML via the engine ──────────
test('a lowered deck flows through buildPptxParts to real DrawingML', () => {
  const model = parseDeckModel(JSON.stringify({
    size: { w: 1280, h: 720 },
    theme: { colors: { accent1: '#30BA78' }, fonts: { major: 'SUSE' } },
    slides: [{
      bg: '#0C322C',
      notes: 'hi',
      elements: [
        { t: 'text', x: 80, y: 80, w: 1120, h: 120, paras: [{ runs: [{ text: 'Title', sizePt: 40, bold: true, color: '#FFFFFF' }] }] },
        { t: 'table', x: 80, y: 240, w: 1120, h: 200, firstRow: true, cols: [560, 560],
          rows: [{ cells: [{ text: 'H', fill: '#30BA78', colSpan: 2 }] }, { cells: [{ text: 'a' }, { text: 'b' }] }] },
      ],
    }],
  }))!;
  // Lower exactly as renderPptxFromDeck does (minus async images).
  const shapes = [] as PptxSlide['shapes'];
  const bg = deckFill((model.slides as Record<string, unknown>[])[0]!.bg);
  if (bg) shapes.push({ kind: 'rect', x: 0, y: 0, cx: emuOf(1280), cy: emuOf(720), fill: bg });
  for (const el of (model.slides as Record<string, unknown>[])[0]!.elements as Record<string, unknown>[]) {
    const s = deckSyncShape(el); if (s) shapes.push(s);
  }
  const slide: PptxSlide = { shapes, media: [], notes: asStr((model.slides as Record<string, unknown>[])[0]!.notes) };
  const parts = buildPptxParts([slide], { emuW: emuOf(1280), emuH: emuOf(720), theme: deckTheme(model.theme) });
  const xml = parts['ppt/slides/slide1.xml'] as string;
  assert.match(xml, /<a:t>Title<\/a:t>/);
  assert.match(xml, /<a:tbl>/);
  assert.match(xml, /<a:tc gridSpan="2">/);
  assert.match(xml, /<a:srgbClr val="0C322C"\/>/);       // bg rect
  assert.match(parts['ppt/theme/theme1.xml'] as string, /<a:accent1><a:srgbClr val="30BA78"\/>/);
  assert.match(parts['ppt/theme/theme1.xml'] as string, /typeface="SUSE"/);
  assert.ok('ppt/notesSlides/notesSlide1.xml' in parts);
});

// ── adversarial-verify Phase-2 findings (B1, M4, M5) ─────────────────────────
test('B1: a malformed rgb() never emits a NaN hex channel', () => {
  // The old hand-rolled regex accepted '.' as a channel and leaned on hex2's clamp to
  // turn the NaN into '00' - i.e. it painted an authoring mistake solid black. Through
  // the engine's CSS Color 4 parser a malformed colour is REFUSED, which is the better
  // answer for the same defect: nothing is emitted, so nothing can carry a NaN channel.
  for (const bad of ['rgb(.,.,.)', 'rgb(1.2.3,4,5)', 'rgba(.,0,0,1)']) {
    const c = deckColor(bad);
    assert.equal(c, null, `${bad} is not a colour`);
  }
  // …and a well-formed one still is, in every notation a brand token can arrive in.
  for (const [css, hex] of [
    ['rgb(48,186,120)', '30BA78'],      // legacy comma form
    ['rgb(48 186 120)', '30BA78'],      // modern space form - the wheel and getComputedStyle
    ['hsl(150 59% 46%)', null],         // any hsl at all (value asserted below)
  ] as Array<[string, string | null]>) {
    const c = deckColor(css);
    assert.ok(c, `${css} parses`);
    assert.match(c!.hex, /^[0-9A-F]{6}$/, `${css} → valid 6-hex, got ${c!.hex}`);
    if (hex) assert.equal(c!.hex, hex);
  }
});

test('A12: a brand token that resolves to oklch()/hsl() still paints the slide', () => {
  // brand-editor's colour wheel stores `oklch()` and applyBrandVars passes the authored
  // string onto the canvas verbatim, so this is what the resolver really hands back.
  const oklch: DeckColorResolver = () => 'oklch(0.98 0.01 250)';
  const c = deckColor('var(--brand-surface, #ffffff)', oklch);
  assert.ok(c, 'the token resolved and the literal parsed');
  assert.match(c!.hex, /^[0-9A-F]{6}$/);
  assert.notEqual(c!.hex, 'FFFFFF', 'and it is the TOKEN colour, not the var()’s fallback');
  // The same through deckFill, which is where a missing answer became "no background rect".
  assert.ok(deckFill('var(--brand-surface, #ffffff)', oklch), 'the slide gets its fill');
  assert.ok(deckFill('var(--brand-surface, #ffffff)', () => 'hsl(150 40% 20%)'));
  assert.ok(deckFill('var(--brand-surface, #ffffff)', () => 'rgb(48 186 120)'));
  // An unreadable token value still degrades to the var()'s own fallback? No - the
  // fallback is consumed by the resolve step, so an unparseable answer is honestly null.
  assert.equal(deckColor('var(--brand-surface, #ffffff)', () => 'not-a-colour'), null);
});

test('M5: emuOf clamps an absurd coordinate to the ST_Coordinate bound', () => {
  const ST_MAX = 27273042316900;
  assert.ok(emuOf(1e12) <= ST_MAX && emuOf(1e12) > 0);
  assert.ok(emuOf(-1e12) >= -ST_MAX && emuOf(-1e12) < 0);
  assert.equal(emuOf(96), Math.round(96 * (914400 / 96))); // normal value untouched
});

test('M4: table rows/cols are capped at the engine limits', () => {
  const cols = Array.from({ length: 1000 }, () => 100);
  const rows = Array.from({ length: 5000 }, () => ({ cells: [{ text: 'x' }] }));
  const t = deckSyncShape({ t: 'table', x: 0, y: 0, w: 500, h: 500, cols, rows }) as PptxTable;
  assert.ok(t.cols.length <= 128, `cols capped, got ${t.cols.length}`);
  assert.ok(t.rows.length <= 512, `rows capped, got ${t.rows.length}`);
});

// ─── layout gallery lowering (engine 1.135) ──────────────────────────────────
test('deckPh whitelists placeholder types and coerces idx', () => {
  assert.deepEqual(deckPh({ type: 'title' }), { type: 'title' });
  assert.deepEqual(deckPh({ type: 'body', idx: 1.4 }), { type: 'body', idx: 1 });
  assert.equal(deckPh({ type: 'evil"><x' }), undefined);
  assert.equal(deckPh({ type: 'body', idx: -3 })!.idx, undefined);   // negative idx dropped, type kept
  assert.equal(deckPh(null), undefined);
  assert.equal(deckPh('title'), undefined);
});

test('deckPlaceholder lowers box, style, prompt; rejects unbindable input', () => {
  const p = deckPlaceholder({
    type: 'body', idx: 1, x: 32, y: 96, w: 896, h: 380, anchor: 't',
    style: { font: 'SUSE', sizePt: 18, color: '#01564A', align: 'l', bullet: true },
    prompt: 'Add your points',
  })!;
  assert.equal(p.type, 'body'); assert.equal(p.idx, 1);
  assert.equal(p.x, Math.round(32 * EMU_PER_PX));
  assert.equal(p.cx, Math.round(896 * EMU_PER_PX));
  assert.deepEqual(p.style, { font: 'SUSE', sizePt: 18, color: '01564A', align: 'l', bullet: true });
  assert.equal(p.prompt, 'Add your points');
  assert.equal(deckPlaceholder({ x: 0, y: 0, w: 10, h: 10 }), null);          // no binding → null
  assert.equal(deckPlaceholder({ type: 'nope', x: 0, y: 0, w: 10, h: 10 }), null);
  assert.equal(deckPlaceholder('x'), null);
});

test('a text element with ph lowers to a bound PptxText and round-trips into <p:ph>', () => {
  const t = deckSyncShape({ t: 'text', x: 0, y: 0, w: 300, h: 80, paras: [{ runs: [{ text: 'Hi', sizePt: 28 }] }], ph: { type: 'title' } }) as PptxText;
  assert.deepEqual(t.ph, { type: 'title' });
  const slide: PptxSlide = { shapes: [t], media: [] };
  const xml = buildPptxParts([slide], {})['ppt/slides/slide1.xml'] as string;
  assert.match(xml, /<p:nvPr><p:ph type="title"\/><\/p:nvPr>/);
  // Hostile ph on the element is dropped at the boundary, not carried.
  const loose = deckSyncShape({ t: 'text', x: 0, y: 0, w: 10, h: 10, paras: [], ph: { type: '<script>' } }) as PptxText;
  assert.equal(loose.ph, undefined);
});

// ── native animation mapping (plans/175 WP-E) ────────────────────────────────

test('deckAnim maps the Lolly kinds onto the PPTX subset, noting each degrade once', () => {
  const notes: string[] = [];
  assert.equal(deckAnim({ enter: 'fade', enterMs: 500 }, notes)!.enter!.preset, 'fade');
  assert.deepEqual(
    (({ preset, dir }) => ({ preset, dir }))(deckAnim({ enter: 'slide-left', enterMs: 400 })!.enter!),
    { preset: 'fly', dir: 'r' }, 'slide-left enters from the right');
  assert.deepEqual(
    (({ preset, dir }) => ({ preset, dir }))(deckAnim({ enter: 'rise', enterMs: 400 }, notes)!.enter!),
    { preset: 'fly', dir: 'b' });
  assert.equal(deckAnim({ enter: 'zoom-out', enterMs: 400 })!.enter!.preset, 'zoomOut');
  assert.equal(deckAnim({ enter: 'drift', enterMs: 400 }, notes)!.enter!.preset, 'fade');
  assert.ok(notes.includes('rise → Fly In from bottom'), `degrades are named: ${notes}`);
  assert.ok(notes.includes('drift → Fade'));
  // The same note never stacks twice.
  deckAnim({ enter: 'rise', enterMs: 400 }, notes);
  assert.equal(notes.filter((n) => n.startsWith('rise')).length, 1);
});

test('deckAnim: the typewriter - a bare cut with split becomes appear + iterate', () => {
  const a = deckAnim({ enter: 'none', enterMs: 400, split: 'letter', stagger: 80 })!;
  assert.equal(a.enter!.preset, 'appear');
  assert.deepEqual(a.enter!.iterate, { by: 'letter', staggerMs: 80 });
  // …while a bare cut with NOTHING to trigger is no animation at all.
  assert.equal(deckAnim({ enter: 'none', enterMs: 400 }), undefined);
  // reverse order rides backwards; line degrades to word with a note.
  const notes: string[] = [];
  const rev = deckAnim({ enter: 'fade', enterMs: 400, split: 'line', stagger: 100, order: 'reverse' }, notes)!;
  assert.deepEqual(rev.enter!.iterate, { by: 'word', staggerMs: 100, backwards: true });
  assert.ok(notes.some((n) => n.includes('split by line')));
  const notes2: string[] = [];
  deckAnim({ enter: 'fade', enterMs: 400, split: 'word', stagger: 100, order: 'random' }, notes2);
  assert.ok(notes2.some((n) => n.includes('random')), 'unmappable order is named');
});

test('deckAnim: exits need a derived moment; clicks and junk are clamped or dropped', () => {
  const notes: string[] = [];
  // An exit WITHOUT exitDelayMs is skipped, and says so.
  assert.equal(deckAnim({ exit: 'fade', exitMs: 400 }, notes), undefined);
  assert.ok(notes.some((n) => n.includes('exit without timing')));
  // With one, it maps - delayed to its own moment.
  const a = deckAnim({ exit: 'fade', exitMs: 400, exitDelayMs: 2600 })!;
  assert.equal(a.exit!.preset, 'fade');
  assert.equal(a.exit!.delayMs, 2600);
  // A click fragment with no kind still Appears on its click.
  const frag = deckAnim({ enter: 'none', enterMs: 400, click: 2 })!;
  assert.equal(frag.enter!.preset, 'appear');
  assert.equal(frag.click, 2);
  // Junk kinds and junk shapes are not effects.
  assert.equal(deckAnim({ enter: 'constructor', enterMs: 400 }), undefined);
  assert.equal(deckAnim('nonsense'), undefined);
  assert.equal(deckAnim(null), undefined);
});

test('deckAnim: named easing approximates through accel/decel; a bezier takes the born curve', () => {
  const eased = deckAnim({ enter: 'fade', enterMs: 400, enterEase: 'ease-in' })!.enter!;
  assert.equal(eased.accel, 80000);
  assert.equal(eased.decel, undefined);
  const born = deckAnim({ enter: 'fade', enterMs: 400, enterEase: 'cubic-bezier(0.2,1.4,0.6,1)' })!.enter!;
  assert.equal(born.decel, 80000, 'unknown curve falls back to the kind\'s own ease-out');
  const linear = deckAnim({ enter: 'fade', enterMs: 400, enterEase: 'linear' })!.enter!;
  assert.equal(linear.accel, undefined);
  assert.equal(linear.decel, undefined);
});

test('deckSyncShape attaches the mapped anim to rect and text alike', () => {
  const notes: string[] = [];
  const text = deckSyncShape({
    t: 'text', x: 0, y: 0, w: 100, h: 50,
    paras: [{ runs: [{ text: 'Hi', sizePt: 24 }] }],
    anim: { enter: 'fade', enterMs: 500, delayMs: 1200, split: 'word', stagger: 60 },
  }, notes) as PptxText;
  assert.equal(text.anim!.enter!.preset, 'fade');
  assert.equal(text.anim!.enter!.delayMs, 1200);
  assert.deepEqual(text.anim!.enter!.iterate, { by: 'word', staggerMs: 60 });
  const rect = deckSyncShape({ t: 'rect', x: 0, y: 0, w: 100, h: 50, anim: { enter: 'pop', enterMs: 300 } }, notes) as PptxRect;
  assert.equal(rect.anim!.enter!.preset, 'zoom');
  // …and a shape with no anim carries none (byte-identity of the lowered model).
  const still = deckSyncShape({ t: 'rect', x: 0, y: 0, w: 100, h: 50 }) as PptxRect;
  assert.ok(!('anim' in still));
});

// ── brand tokens in a deck colour (plan 179 A12) ──────────────────────────────
//
// The bug: a Design artboard's fill is `var(--brand-surface, #ffffff)` on any branded
// document, deckColor understood hex/rgb only, so the fill became null and the exported
// slide had NO background rect. The fix is an injected resolver, never a baked-in table.

/** A stand-in for getComputedStyle over the live canvas: a plain token map. */
const fakeResolver = (map: Record<string, string>): DeckColorResolver => (name) => map[name];

test('A12: deckColor resolves var(--token) through the resolver', () => {
  const resolve = fakeResolver({ '--brand-surface': '#0C322C' });
  assert.deepEqual(deckColor('var(--brand-surface, #ffffff)', resolve), { hex: '0C322C', alpha: undefined });
  assert.deepEqual(deckColor('var(--brand-surface)', resolve), { hex: '0C322C', alpha: undefined });
  // The resolver may answer with any colour form the literal parser takes.
  assert.deepEqual(deckColor('var(--x)', fakeResolver({ '--x': 'rgb(48,186,120)' })), { hex: '30BA78', alpha: undefined });
});

test('A12: an undefined token falls back to the literal inside the var(), then to null', () => {
  const none = fakeResolver({});
  assert.deepEqual(deckColor('var(--nope, #30BA78)', none), { hex: '30BA78', alpha: undefined });
  assert.deepEqual(deckColor('var(--nope, #30BA78)'), { hex: '30BA78', alpha: undefined }, 'no resolver at all → the fallback');
  assert.equal(deckColor('var(--nope)', none), null, 'nothing to fall back to');
  assert.equal(deckColor('var(--nope, transparent)', none), null);
  // A resolver that answers with blank is the same as not defining the token.
  assert.deepEqual(deckColor('var(--x, #111111)', fakeResolver({ '--x': '   ' })), { hex: '111111', alpha: undefined });
});

test('A12: var() nests, self-reference and junk names degrade to null (never a loop)', () => {
  assert.deepEqual(deckColor('var(--a, var(--b, #ABCDEF))', fakeResolver({})), { hex: 'ABCDEF', alpha: undefined });
  assert.deepEqual(deckColor('var(--a)', fakeResolver({ '--a': 'var(--b, #123456)' })), { hex: '123456', alpha: undefined });
  assert.equal(deckColor('var(--a)', fakeResolver({ '--a': 'var(--a)' })), null, 'a self-reference stops at the hop cap');
  assert.equal(deckColor('var(--a)', fakeResolver({ '--a': 'var(--b)', '--b': 'var(--c)', '--c': 'var(--d)', '--d': 'var(--e)', '--e': '#fff' })), null, 'deeper than the hop cap');
  assert.equal(deckColor('var(nope, #fff)', fakeResolver({})), null, 'not a custom-property name');
  assert.equal(deckColor('var(--a, #fff) var(--b, #000)', fakeResolver({})), null, 'not one var() call');
  assert.equal(deckColor('var(--a', fakeResolver({})), null, 'unbalanced');
});

test('A12: a fallback may itself carry commas and parens', () => {
  assert.deepEqual(resolveDeckColorValue('var(--x, rgb(48, 186, 120))', fakeResolver({})), 'rgb(48, 186, 120)');
  assert.deepEqual(deckColor('var(--x, rgba(0,0,0,0.5))', fakeResolver({}))!.hex, '000000');
});

test('A12: a literal colour is untouched, so every already-literal deck is byte-identical', () => {
  const resolve = fakeResolver({ '--x': '#30BA78' });
  assert.equal(resolveDeckColorValue('  #30BA78  ', resolve), '#30BA78');
  assert.deepEqual(deckColor('#0C322C', resolve), deckColor('#0C322C'));
  assert.equal(resolveDeckColorValue(42, resolve), '');
});

test('A12: the resolver reaches fills, lines, runs, bullets, cells, placeholders and the theme', () => {
  const resolve = fakeResolver({ '--brand-surface': '#0C322C', '--brand-fg': '#FFFFFF', '--brand-accent': '#30BA78' });

  // A slide/frame background - the defect that started A12.
  assert.deepEqual(deckFill('var(--brand-surface, #ffffff)', resolve), { solid: '0C322C', alpha: undefined });
  const grad = deckFill({ grad: { stops: [{ pos: 0, color: 'var(--brand-accent)' }, { pos: 1, color: 'var(--brand-surface)' }] } }, resolve);
  assert.deepEqual((grad as { grad: Array<{ color: string }> }).grad.map((s) => s.color), ['30BA78', '0C322C']);

  // Element fill + stroke.
  const rect = deckSyncShape({ t: 'rect', x: 0, y: 0, w: 10, h: 10, fill: 'var(--brand-accent)', line: { color: 'var(--brand-fg)', w: 2 } }, undefined, resolve) as PptxRect;
  assert.deepEqual(rect.fill, { solid: '30BA78', alpha: undefined });
  assert.equal(rect.line!.color, 'FFFFFF');

  // Text colour, on a run and on a bullet.
  const para = deckPara({ bulletColor: 'var(--brand-accent)', runs: [{ text: 'x', sizePt: 12, color: 'var(--brand-fg)' }] }, resolve);
  assert.equal(para.runs[0]!.color, 'FFFFFF');
  assert.equal(para.bulletColor, '30BA78');
  const text = deckSyncShape({ t: 'text', x: 0, y: 0, w: 10, h: 10, paras: [{ runs: [{ text: 'x', sizePt: 12, color: 'var(--brand-fg)' }] }] }, undefined, resolve) as PptxText;
  assert.equal(text.paras[0]!.runs[0]!.color, 'FFFFFF');

  // Table cells (fill, colour, borders) reach it through deckSyncShape too.
  const table = deckSyncShape({
    t: 'table', x: 0, y: 0, w: 100, h: 40, cols: [100],
    rows: [{ cells: [{ text: 'H', fill: 'var(--brand-accent)', color: 'var(--brand-fg)', borders: { t: { color: 'var(--brand-surface)', w: 1 } } }] }],
  }, undefined, resolve) as PptxTable;
  const cell = table.rows[0]!.cells[0]!;
  assert.equal(cell.fill, '30BA78');
  assert.equal(cell.color, 'FFFFFF');
  assert.equal(cell.borders!.t!.color, '0C322C');

  // Layout placeholder style + the deck theme.
  const ph = deckPlaceholder({ type: 'title', x: 0, y: 0, w: 10, h: 10, style: { color: 'var(--brand-fg)' } }, resolve);
  assert.equal(ph!.style!.color, 'FFFFFF');
  assert.equal(deckTheme({ colors: { accent1: 'var(--brand-accent)' } }, resolve)!.colors!.accent1, '30BA78');
});

test('A12: without a resolver the same deck still exports its literal fallbacks', () => {
  // The node/CLI path (and any detached document) passes no resolver: a token-valued
  // fill must still paint, using the literal the tool wrote inside the var().
  const rect = deckSyncShape({ t: 'rect', x: 0, y: 0, w: 10, h: 10, fill: 'var(--brand-surface, #ffffff)' }) as PptxRect;
  assert.deepEqual(rect.fill, { solid: 'FFFFFF', alpha: undefined });
});

// ── speaker notes on a slide (plan 179 P1) ────────────────────────────────────

test('deckNotes trims, keeps markup verbatim, and blanks stay undefined', () => {
  assert.equal(deckNotes('  Open with the customer story.  '), 'Open with the customer story.');
  assert.equal(deckNotes('5 < 6 & <b>not bold</b>'), '5 < 6 & <b>not bold</b>', 'a notes body is text, not markup');
  assert.equal(deckNotes('   '), undefined);
  assert.equal(deckNotes(''), undefined);
  assert.equal(deckNotes(undefined), undefined);
  assert.equal(deckNotes(42), undefined);
});

// ── per-slide narration (plans/180 M-C) ───────────────────────────────────────

test('deckAudioExt sniffs the container from the bytes, and falls back to the name', () => {
  const riff = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]);
  const ftyp = new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20]);
  const id3 = new Uint8Array([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 0, 0, 0]);
  const sync = new Uint8Array([0xff, 0xfb, 0x90, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  // A narration clip is a blob: URL with no extension, so the BYTES have to answer.
  assert.equal(deckAudioExt(riff, 'blob:https://lolly.tools/9f2'), 'wav');
  assert.equal(deckAudioExt(ftyp, 'blob:https://lolly.tools/9f2'), 'm4a');
  assert.equal(deckAudioExt(id3, ''), 'mp3');
  assert.equal(deckAudioExt(sync, ''), 'mp3');
  // The name is the fallback, not the authority.
  assert.equal(deckAudioExt(null, 'narration.wav'), 'wav');
  assert.equal(deckAudioExt(new Uint8Array(0), 'https://x/clip.m4a?v=2'), 'm4a');
  assert.equal(deckAudioExt(riff, 'clip.mp3'), 'wav', 'the bytes win over the extension');
  // Anything the writer cannot declare answers null - the slide goes out silent rather
  // than sending PowerPoint to the repair dialog.
  assert.equal(deckAudioExt(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), 'clip.ogg'), null);
  assert.equal(deckAudioExt(null, ''), null);
});

test('deckNarrationMark takes the data-narration flag the hook actually writes', () => {
  const mark = (attrs: Record<string, string>) => ({ getAttribute: (n: string) => attrs[n] ?? null });
  const wrapped = (attrs: Record<string, string>, box: Record<string, string>) => ({
    getAttribute: (n: string) => attrs[n] ?? null,
    closest: () => ({ getAttribute: (n: string) => box[n] ?? null }),
  });

  // The failure this exists for. A sound effect renders FIRST (the narration clip is
  // appended last), so DOM order used to hand PowerPoint the effect as slide narration
  // and drop the voice from the file entirely.
  assert.deepEqual(
    deckNarrationMark([
      mark({ 'data-audio-src': 'blob:sfx', 'data-present-audio': '1', 'data-audio-dur': '900' }),
      mark({ 'data-audio-src': 'blob:voice', 'data-narration': '1', 'data-present-audio': '1', 'data-audio-dur': '9100' }),
    ]),
    { src: 'blob:voice', durationMs: 9100 },
  );
  // The flag is read off the `.lolly-box` wrapper too, as present-mode.ts reads it.
  assert.deepEqual(
    deckNarrationMark([wrapped({ 'data-audio-src': 'blob:voice' }, { 'data-narration': '1' })]),
    { src: 'blob:voice', durationMs: 0 },
  );
  // A group attribute, should markers ever start declaring one, still wins.
  assert.deepEqual(
    deckNarrationMark([
      mark({ 'data-audio-src': 'blob:bed', 'data-audio-group': 'bed' }),
      mark({ 'data-audio-src': 'blob:voice', 'data-audio-group': 'narration:f3', 'data-audio-dur': '9100' }),
    ]),
    { src: 'blob:voice', durationMs: 9100 },
  );
  // A grouped non-narration marker is never the fallback.
  assert.equal(deckNarrationMark([mark({ 'data-audio-src': 'blob:bed', 'data-audio-group': 'bed' })]), null);
  // The fallback survives for a hand-authored deck with ONE sound that opted into present
  // audio. No duration attribute (a procedural bed omits it) is 0, not NaN.
  assert.deepEqual(
    deckNarrationMark([mark({ 'data-audio-src': 'blob:a', 'data-present-audio': '1' })]),
    { src: 'blob:a', durationMs: 0 },
  );
  // A bed that opted into nothing is not embedded and not labelled narration…
  assert.equal(deckNarrationMark([mark({ 'data-audio-src': 'blob:bed' })]), null);
  // …and two unflagged sounds are not guessed between: the slide goes out silent.
  assert.equal(deckNarrationMark([
    mark({ 'data-audio-src': 'blob:a', 'data-present-audio': '1' }),
    mark({ 'data-audio-src': 'blob:b', 'data-present-audio': '1' }),
  ]), null);
  assert.equal(deckNarrationMark([mark({ 'data-audio-src': '  ' })]), null);
  assert.equal(deckNarrationMark([]), null);
});
