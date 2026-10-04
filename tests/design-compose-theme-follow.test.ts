// SPDX-License-Identifier: MPL-2.0
/**
 * Plan 291 M4, section 6: a deck composed for more than one theme follows the theme
 * where it should and holds still where it should, with every theme's tokens in hand.
 *
 *   - An ink the master takes from a colour that never changes, on a ground that follows
 *     the theme, is linked to the theme's own ink of the same colour (a dark title
 *     on a surface that turns dark).
 *   - A slide that is dark by design (title, full-page picture, closing) keeps the
 *     master's colours in every theme, in the document and in the PowerPoint layout.
 *   - A light ground taken from a constant (main-point's ramp tint) is linked to the
 *     theme's alternate surface; with none, its ink is held where it would stop reading.
 *   - A slot's own colour reference and `{@path …|}` runs are lowered at compose time,
 *     replacing the master's link, and accent emphasis is a run linked to a role token.
 *   - A one-theme `{@path …|}` run is compared with the source by its words, and an edit
 *     declared for an icon-font glyph name is never reported unmatched.
 *
 * Public: the neutral master and invented tokens. The SUSE case is gated.
 * Run with: node --import ./tests/css-stub.mjs --test tests/design-compose-theme-follow.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { ContentInventoryV1, DesignComposeSpecV1, SlideMasterV1 } from '@lolly-tools/core';
import { composeDesignSlides, withoutRunRefs, type DesignComposeContext } from '../engine/src/design-compose.ts';
import { checkFidelity } from '../engine/src/check-fidelity.ts';
import { neutralSlideMaster } from '../engine/src/rebrand-design-system.ts';
import { createTokenSet } from '../engine/src/tokens.ts';
import { contrastRatio } from '../engine/src/logo-variant.ts';
import { readBlockRunBindings, readBlockTokenBindings, resolveBlockTokenBindings } from '../engine/src/token-block-bindings.ts';
import type { BlockFieldSpec, InputValue } from '../engine/src/inputs.ts';
import { designFramesToPptx } from '../packages/node-shell/src/design-pptx.ts';

type Row = Record<string, unknown>;

const THEMES = [
  { name: 'light', selectedTokenSets: { base: 'enabled', light: 'enabled' } },
  { name: 'dark', selectedTokenSets: { base: 'enabled', dark: 'enabled' } },
];
const BASE = {
  color: {
    $type: 'color',
    brand: { deep: { $value: '#102a43' }, kelp: { $value: '#1f7a5c' }, foam: { $value: '#9be3c9' }, white: { $value: '#ffffff' }, night: { $value: '#0b1b2b' } },
    ramp: { neutral: { '1': { $value: '#102a43' }, '8': { $value: '#eef1f4' } } },
  },
};
/** Invented tokens with role colours: an alternate surface and an accent ink per theme. */
const DOC = {
  $themes: THEMES,
  base: BASE,
  light: { color: { $type: 'color', semantic: { text: { $value: '{color.brand.deep}' }, surface: { $value: '{color.brand.white}' }, secondary: { $value: '{color.brand.kelp}' } }, role: { 'accent-ink': { $value: '{color.brand.kelp}' }, 'alt-surface': { $value: '{color.ramp.neutral.8}' } } } },
  dark: { color: { $type: 'color', semantic: { text: { $value: '{color.brand.white}' }, surface: { $value: '{color.brand.deep}' }, secondary: { $value: '{color.brand.foam}' } }, role: { 'accent-ink': { $value: '{color.brand.foam}' }, 'alt-surface': { $value: '{color.brand.night}' } } } },
};
/** The same tokens with no role colours, as an imported brand without them would be. */
const BARE = { $themes: THEMES, base: BASE, light: { color: { $type: 'color', semantic: DOC.light.color.semantic } }, dark: { color: { $type: 'color', semantic: DOC.dark.color.semantic } } };

const sets = (doc: unknown) => ({ light: createTokenSet(doc, { theme: 'light' }), dark: createTokenSet(doc, { theme: 'dark' }) });
const COLOUR_FIELDS: BlockFieldSpec[] = ['bg', 'fg', 'stroke', 'shadowColor'].map((id) => ({ id, type: 'color' as const }));
const inTheme = (rows: Row[], set: ReturnType<typeof createTokenSet>): Row[] => resolveBlockTokenBindings(rows as InputValue[], 'tokenLinks', COLOUR_FIELDS, set) as Row[];
const byId = (rows: Row[], id: string): Row => {
  const row = rows.find((r) => r.id === id);
  assert.ok(row, `row ${id} is composed`);
  return row;
};
const linkOf = (row: Row, field: string): string | undefined => readBlockTokenBindings(row.tokenLinks)[field]?.ref;

function inventory(): ContentInventoryV1 {
  const box = { x: 0.1, y: 0.1, width: 0.8, height: 0.2 };
  return {
    version: 'lolly/content-inventory-v1',
    source: { name: 'invented.pptx', sha256: 'e'.repeat(64), bytes: 1000, kind: 'pptx', slides: 1, width: 960, height: 540 },
    slides: [{
      number: 1, id: 'slide1',
      text: [
        { objectId: 'h1', role: 'title', class: 'title', box, paragraphs: [{ runs: [{ text: 'Are we ' }, { text: 'drifting', bold: true }, { text: ' past the harbour?' }] }], plain: 'Are we drifting past the harbour?' },
        { objectId: 'b1', role: 'body', class: 'body', box, paragraphs: [{ runs: [{ text: 'Low water at six.' }] }], plain: 'Low water at six.' },
        // An icon-font glyph name: text set only in an icon font, which draws an arrow.
        { objectId: 'i1', role: 'other', class: 'body', box, paragraphs: [{ runs: [{ text: 'east' }] }], plain: 'east' },
      ],
      notes: null, pictures: [], tables: [], charts: [], objects: [],
    }],
    media: [],
    warnings: [],
  } as unknown as ContentInventoryV1;
}

function ctxFor(doc: unknown, master: SlideMasterV1 = neutralSlideMaster(), withThemes = true): DesignComposeContext {
  const s = sets(doc);
  const resolve = (path: string): string | undefined => {
    const v = s.light.get(path)?.value;
    return typeof v === 'string' ? v : undefined;
  };
  return {
    master, masterOrigin: 'neutral', resolveToken: resolve, inventory: inventory(), tokens: s.light,
    ...(withThemes ? { themeTokens: s } : {}),
  };
}
const compose = (spec: unknown, ctx: DesignComposeContext) => composeDesignSlides(spec as DesignComposeSpecV1, ctx);
const TWO = ['light', 'dark'];

test('a slide dark by design keeps the master\'s colours in every theme (title, full-image, closing-thanks)', () => {
  const { document, report } = compose({ themes: TWO, slides: [{ archetype: 'title', slots: { title: 'Harbour lights' } }, { archetype: 'closing-thanks', slots: { title: 'Thank you' } }] }, ctxFor(DOC));
  const rows = document.boxes as Row[];
  for (const id of ['s01', 's02']) {
    const frame = byId(rows, id);
    assert.equal(frame.bg, '#102a43');
    assert.notEqual(linkOf(frame, 'bg'), '{color.semantic.text}', 'the ground is not linked to a token that turns light');
  }
  const dark = inTheme(rows, sets(DOC).dark);
  assert.equal(byId(dark, 's01').bg, '#102a43', 'the title stays dark in the dark theme');
  assert.equal(byId(dark, 's01.title').fg, '#ffffff', 'and its ink stays light');
  assert.equal(byId(dark, 's02').bg, '#102a43');
  assert.ok(report.notes.some((n) => n.code === 'compose.theme.held'), 'the hold is reported');
});

test('a brand-constant ink on a ground that follows the theme is linked to the theme\'s own ink', () => {
  // The neutral master with its content ink taken from a brand constant.
  const master = neutralSlideMaster();
  const content = master.archetypes.find((a) => a.id === 'content')!;
  for (const ph of content.placeholders) if (ph.style?.fgTokenPath) ph.style.fgTokenPath = 'color.brand.deep';
  const { document } = compose({ themes: TWO, slides: [{ archetype: 'content', slots: { title: 'Tides', body: 'Low at six.' } }] }, ctxFor(DOC, master));
  const rows = document.boxes as Row[];
  assert.equal(linkOf(byId(rows, 's01.title'), 'fg'), '{color.semantic.text}');
  assert.ok(!rows.some((r) => r.kind === 'text' && /color\.brand\./.test(linkOf(r, 'fg') ?? '')), 'no ink stays linked to a brand constant');
  const dark = inTheme(rows, sets(DOC).dark);
  const ratio = contrastRatio(String(byId(dark, 's01.title').fg), String(byId(dark, 's01').bg));
  assert.ok(ratio >= 4.5, `the title reads in dark (${ratio.toFixed(2)}:1)`);
  // Without every theme's tokens nothing changes: the ink keeps its constant link.
  const before = compose({ themes: TWO, slides: [{ archetype: 'content', slots: { title: 'Tides', body: 'Low at six.' } }] }, ctxFor(DOC, master, false)).document.boxes as Row[];
  assert.equal(linkOf(byId(before, 's01.title'), 'fg'), '{color.brand.deep}');
});

test('main-point\'s ramp ground follows the theme through the alternate surface, or holds its ink', () => {
  const { document } = compose({ themes: TWO, slides: [{ archetype: 'main-point', slots: { title: 'One idea' } }] }, ctxFor(DOC));
  const rows = document.boxes as Row[];
  assert.equal(linkOf(byId(rows, 's01'), 'bg'), '{color.role.alt-surface}');
  const dark = inTheme(rows, sets(DOC).dark);
  assert.equal(byId(dark, 's01').bg, '#0b1b2b', 'main-point is dark in the dark theme');
  assert.ok(contrastRatio(String(byId(dark, 's01.title').fg), '#0b1b2b') >= 4.5);
  // A brand with no alternate surface: the ground stays light, so the ink is held dark.
  const bare = compose({ themes: TWO, slides: [{ archetype: 'main-point', slots: { title: 'One idea' } }] }, ctxFor(BARE));
  const bareDark = inTheme(bare.document.boxes as Row[], sets(BARE).dark);
  assert.equal(byId(bareDark, 's01').bg, '#eef1f4');
  assert.ok(contrastRatio(String(byId(bareDark, 's01.title').fg), '#eef1f4') >= 4.5, 'white on the light tint is not drawn');
  assert.ok(bare.report.notes.some((n) => n.code === 'compose.theme.ink-held'));
});

test('a slot\'s colour reference and @ runs are lowered at compose time, replacing the master\'s link', () => {
  const { document } = compose({
    themes: TWO,
    slides: [{ archetype: 'content', slots: { title: { text: 'Tides', fg: '{color.role.accent-ink}' }, body: 'Low at {@color.role.accent-ink w500|six}.' } }],
  }, ctxFor(DOC));
  const rows = document.boxes as Row[];
  const title = byId(rows, 's01.title');
  assert.equal(title.fg, '#1f7a5c', 'the literal is stored');
  assert.equal(linkOf(title, 'fg'), '{color.role.accent-ink}', 'the slot\'s link replaced the master\'s');
  const body = byId(rows, 's01.body');
  assert.equal(body.text, 'Low at {#1f7a5c w500|six}.');
  assert.equal(readBlockRunBindings(body.tokenLinks)['1f7a5c']?.ref, '{color.role.accent-ink}');
  const dark = inTheme(rows, sets(DOC).dark);
  assert.equal(byId(dark, 's01.title').fg, '#9be3c9');
  assert.equal(byId(dark, 's01.body').text, 'Low at {#9be3c9 w500|six}.');
  // A reference that does not resolve is refused at the slot.
  assert.throws(() => compose({ themes: TWO, slides: [{ archetype: 'content', slots: { title: { text: 'x', fg: '{color.role.nope}' } } }] }, ctxFor(DOC)), /\/slides\/0\/slots\/title\/fg: /);
});

test('accent emphasis in a document for every theme is a run linked to the role accent ink', () => {
  const { document, report } = compose({
    themes: TWO, emphasis: 'accent',
    slides: [{ archetype: 'content', source: 1, notes: null, slots: { title: { from: 'h1' }, body: null } }],
  }, ctxFor(DOC));
  const rows = document.boxes as Row[];
  const title = byId(rows, 's01.title');
  assert.match(String(title.text), /\{#1f7a5c[^|]*\|drifting\}/);
  assert.equal(readBlockRunBindings(title.tokenLinks)['1f7a5c']?.ref, '{color.role.accent-ink}');
  assert.match(String(byId(inTheme(rows, sets(DOC).dark), 's01.title').text), /\{#9be3c9[^|]*\|drifting\}/, 'the accent follows the theme');
  assert.ok(report.notes.some((n) => n.code === 'compose.emphasis.accent' && n.message.includes('{color.role.accent-ink}')));
});

test('a one-theme @ run is compared with the source by its words, and measured that way', () => {
  assert.equal(withoutRunRefs('Are we {@color.role.accent-ink w500|drifting} past {@color.x|it}?'), 'Are we {w500|drifting} past it?');
  assert.equal(withoutRunRefs('plain {#ff0000|red}'), 'plain {#ff0000|red}');
  const { edits } = compose({
    slides: [{ archetype: 'content', source: 1, notes: null, slots: { title: 'Are we {@color.role.accent-ink w500|drifting} past the harbour?', body: { from: 'b1' } } }],
  }, ctxFor(DOC, neutralSlideMaster(), false));
  assert.ok(!edits.some((e) => /[{@|]/.test(String(e.result ?? ''))), `no edit result carries run markup (${JSON.stringify(edits)})`);
  assert.ok(!edits.some((e) => e.source === 'Are we drifting past the harbour?'), 'the title is the source line');
});

test('an edit declared for an icon-font glyph name is allowed and never unmatched', () => {
  const boxes = [
    { id: 's01', kind: 'frame', x: 0, y: 0, w: 1920, h: 1080, order: 0 },
    { id: 't', kind: 'text', frame: 's01', x: 0, y: 0, w: 900, h: 100, text: 'Are we drifting past the harbour?\nLow water at six.' },
  ];
  const out = checkFidelity(inventory(), boxes, { edits: [{ source: 'east', reason: 'The icon-font arrow is drawn as a shape.' }] });
  assert.ok(!out.findings.some((f) => f.code === 'fidelity.edit.unmatched'), JSON.stringify(out.findings.map((f) => f.code)));
  // An edit for a word that is in no source text is still reported.
  const stray = checkFidelity(inventory(), boxes, { edits: [{ source: 'west', reason: 'No such text.' }] });
  assert.ok(stray.findings.some((f) => f.code === 'fidelity.edit.unmatched'));
});

test('the PowerPoint layout of a slide dark by design stays dark in the dark theme', async () => {
  const { document } = compose({ themes: TWO, slides: [{ archetype: 'title', slots: { title: 'Harbour lights', subtitle: 'Maren Holt' } }] }, ctxFor(DOC));
  const dark = sets(DOC).dark;
  const rows = inTheme(document.boxes as Row[], dark);
  const frames = rows.filter((r) => r.kind === 'frame').map((row) => ({ row, layers: rows.filter((l) => l.frame === row.id) }));
  const tokens = (path: string): string | undefined => {
    const v = dark.get(path)?.value;
    return typeof v === 'string' ? v : undefined;
  };
  const out = await designFramesToPptx({ frames: frames as never, master: neutralSlideMaster(), tokens });
  const layout = out.layouts.find((l) => l.name === 'Title');
  assert.ok(layout, 'the title layout is written');
  assert.equal((layout.bg as { solid?: string } | undefined)?.solid, '102A43', 'the layout ground is the slide\'s own dark ground');
  const title = layout.placeholders?.find((p) => p.style?.color);
  assert.equal(title?.style?.color, 'FFFFFF', 'with the slide\'s light ink');
});

const SUSE_TOKENS = fileURLToPath(new URL('../brands/suse/catalog/assets/suse/tokens/brand.json', import.meta.url));
test('SUSE (gated): no ink stays a brand constant on a ground that follows the theme, and every slot reads in both themes', { skip: !existsSync(SUSE_TOKENS) && 'brands/suse is not checked out' }, async () => {
  const { resolveProfileDesignSystem } = await import('../packages/node-shell/src/rebrand/design-system.ts');
  const resolved = await resolveProfileDesignSystem({ profile: 'suse' });
  assert.ok(resolved);
  const { master, colors } = resolved.input as unknown as { master: SlideMasterV1; colors: Record<string, string> };
  const doc = JSON.parse(readFileSync(SUSE_TOKENS, 'utf8'));
  const s = sets(doc);
  const ctx: DesignComposeContext = { master, masterOrigin: 'catalog', resolveToken: (p) => colors[p], tokens: s.light, themeTokens: s };
  const ids = ['title', 'content', 'columns-3', 'main-point', 'big-number', 'title-subtitle-body', 'closing-thanks'];
  const { document } = compose({ themes: TWO, slides: ids.map((archetype) => ({ archetype, slots: {} })) }, ctx);
  const rows = document.boxes as Row[];
  const frames = new Map(rows.filter((r) => r.kind === 'frame').map((r) => [r.id, r]));
  for (const [theme, set] of Object.entries(s)) {
    const shown = inTheme(rows, set);
    for (const row of shown) {
      if (row.kind !== 'text') continue;
      const frame = shown.find((r) => r.id === row.frame)!;
      const ground = shown.filter((l) => l.frame === row.frame && l.kind === 'box' && l.furniture && typeof l.bg === 'string' && /^#/.test(l.bg as string))
        .filter((l) => { const cx = Number(row.x) + Number(row.w) / 2; const cy = Number(row.y) + Number(row.h) / 2; return cx >= Number(l.x) && cx <= Number(l.x) + Number(l.w) && cy >= Number(l.y) && cy <= Number(l.y) + Number(l.h); })
        .pop()?.bg ?? frame.bg;
      const ratio = contrastRatio(String(row.fg), String(ground));
      assert.ok(ratio >= 3, `${theme}: ${String(row.id)} ${String(row.fg)} on ${String(ground)} (${ratio.toFixed(2)}:1)`);
    }
  }
  for (const row of rows) {
    const frame = frames.get(row.frame as string);
    if (row.kind !== 'text' || !frame) continue;
    const groundFollows = /color\.(semantic|role)\./.test(linkOf(frame, 'bg') ?? '');
    if (groundFollows) assert.doesNotMatch(linkOf(row, 'fg') ?? '', /color\.brand\./, `${String(row.id)} is not linked to a brand constant`);
  }
});

test('the recreation eval holds a .pptx slide to its layout\'s archetype, as it holds a .lolly frame', async () => {
  const { pptxSlideLayoutNames, pptxThemeGroundsOf, themeGroundsOf } = await import('../scripts/recreate-eval.ts');
  const { buildPptxParts } = await import('../engine/src/pptx.ts');
  const { strToU8, zipSync } = await import('fflate');
  const master = neutralSlideMaster();
  const masterFor = (id: string) => (id === master.id ? master : null);
  // A light statement slide with no dark twin, left light in a dark file: exempt in both formats.
  const lolly = themeGroundsOf([{ id: 's01', kind: 'frame', x: 0, y: 0, w: 1920, h: 1080, master: master.id, archetype: 'main-point', bg: '#eef1f4' }], 'dark', masterFor);
  assert.deepEqual(lolly.exempt, [{ frame: 's01', why: 'archetype' }]);
  const slide = (layout: number) => ({ layout, shapes: [{ kind: 'rect' as const, x: 0, y: 0, cx: 1000, cy: 1000, fill: { solid: 'EEF1F4' } }], media: [] });
  const parts = buildPptxParts([slide(0), slide(1)] as never, {
    layouts: [{ name: 'Main point', shapes: [], media: [], placeholders: [] }, { name: 'Content', shapes: [], media: [], placeholders: [] }] as never,
    now: '2026-01-01T00:00:00Z',
  });
  const files: Record<string, Uint8Array> = {};
  for (const [name, content] of Object.entries(parts)) files[name] = typeof content === 'string' ? strToU8(content) : content as Uint8Array;
  const names = pptxSlideLayoutNames(zipSync(files));
  assert.deepEqual(names, ['Main point', 'Content']);
  const frameOf = (n: number) => {
    const hit = master.archetypes.find((a) => a.name === names![n - 1]);
    return hit ? { master: master.id, archetype: hit.id } : null;
  };
  const grounds = [{ slide: 1, hex: '#eef1f4' }, { slide: 2, hex: '#eef1f4' }];
  const pptx = pptxThemeGroundsOf(grounds, 'dark', { $themes: [] }, { frameOf, masterFor });
  assert.deepEqual(pptx.exempt, [{ frame: 'slide-1', why: 'archetype' }], 'main-point is exempt in the .pptx as in the .lolly');
  assert.deepEqual(pptx.mismatched, ['slide-2'], 'a light content slide in a dark file is still a mismatch');
});
