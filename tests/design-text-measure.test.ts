// SPDX-License-Identifier: MPL-2.0
/**
 * Text measurement for plain Design text layers (plan 291 W5).
 *
 * The engine half (`measureDesignText`) is driven with a fake shaper, so the breaker,
 * the renderer's defaults and clamps, the face per run and Chromium's line box and
 * `scrollHeight` arithmetic are pinned without fonts. The Node half
 * (`@lolly-tools/node-shell/text-measure`) is held to goldens from real HarfBuzz over
 * the OFL faces in shells/web/public/fonts. The synthetic headline and list goldens
 * equal the plan 291 prototype's output for the same input, and the trap headline's
 * breaks and `scrollHeight` are what the Design canvas reported in Chromium.
 *
 * Run with: node --test tests/design-text-measure.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromiumBreakOffsets, measureDesignText, TextMeasureError, TEXT_MEASURE_DEFAULT_FONTS } from '../engine/src/design-text-measure.ts';
import type { TextShapeRunV1, TextShaperV1 } from '../engine/src/design-text-measure.ts';
import {
  countMeasurableTextLayers,
  measureDesignRows,
  measureDesignRowsReport,
  measureFontsFromBrief,
  measureFontsFromTokens,
  measureTextNode,
  sfntVerticalMetrics,
  textMeasureSpecOfRow,
} from '../packages/node-shell/src/text-measure.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TRAP = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/check/trap.boxes.json'), 'utf8')) as Array<Record<string, unknown>>;

/** A shaper with fixed advances: half the size per character, a quarter for a space. Records every run. */
function fakeShaper(calls: TextShapeRunV1[] = [], metrics = { upem: 1000, ascent: 980, descent: 280 }): TextShaperV1 {
  return async (run) => {
    calls.push(run);
    const advances = [...run.text].map((ch) => (ch === ' ' ? run.size / 4 : run.size / 2) + run.tracking);
    return { advances, total: advances.reduce((a, b) => a + b, 0), font: { file: `/fonts/${run.family}.ttf`, variations: { wght: run.weight }, metrics } };
  };
}

// ─── engine: the layout model ────────────────────────────────────────────────

test('absent fields take the renderer defaults: size 48, weight 700, line height 1.12, padding 8, valign middle', async () => {
  const m = await measureDesignText({ text: 'Hi', width: 400, height: 100 }, fakeShaper());
  assert.equal(m.format, 'lolly-text-measure');
  assert.equal(m.version, 1);
  assert.equal(m.method, 'harfbuzz-css-greedy');
  assert.deepEqual([m.size, m.weight, m.lineHeight, m.pad, m.tracking], [48, 700, 1.12, 8, 0]);
  assert.equal(m.font.family, TEXT_MEASURE_DEFAULT_FONTS.brand);
  assert.equal(m.availableWidth, 400 - 16);
  assert.equal(m.lineHeightPx, Math.floor(1.12 * 48 * 64) / 64);
});

test('the line box is a layout unit and the last line\'s descent reaches into scrollHeight', async () => {
  // 112 px at 1.05: L = 117.59375; ascent 110, descent 31; the floored top half-leading
  // leaves 11.4 px of glyph below the line box, so scrollHeight is 129, not 118.
  const one = await measureDesignText({ text: 'Tall', size: 112, lineHeight: 1.05, pad: 0, width: 1600 }, fakeShaper());
  assert.equal(one.lineHeightPx, 117.59375);
  assert.equal(one.height, 117.59375);
  assert.equal(one.scrollHeight, 129);
  // At a generous line height the padding is the larger term.
  const roomy = await measureDesignText({ text: 'Roomy\nlines', size: 48, lineHeight: 1.3, pad: 8, width: 600 }, fakeShaper());
  assert.equal(roomy.height, 16 + 2 * (Math.floor(1.3 * 48 * 64) / 64));
  assert.equal(roomy.scrollHeight, Math.round(roomy.height));
});

test('values are rounded and clamped as the renderer does', async () => {
  const m = await measureDesignText({ text: 'x', size: 47.6, weight: 449, lineHeight: 9, pad: 1000, tracking: 900, width: 2000.4 }, fakeShaper());
  assert.deepEqual([m.size, m.weight, m.lineHeight, m.pad, m.tracking, m.width], [48, 400, 4, 400, 400, 2000]);
  const mono = await measureDesignText({ text: 'x', font: 'mono', weight: '900', width: 100 }, fakeShaper());
  assert.equal(mono.weight, 800, 'mono is capped at 800');
  assert.equal(mono.font.family, 'SUSE Mono');
});

test('no text draws no line, a newline that ends the text draws none of its own, and an empty line keeps its box', async () => {
  const empty = await measureDesignText({ text: '', width: 300, pad: 8 }, fakeShaper());
  assert.equal(empty.lineCount, 0);
  assert.equal(empty.height, 16);
  assert.equal(empty.scrollHeight, 16);
  assert.equal((await measureDesignText({ text: 'a\n', width: 300 }, fakeShaper())).lineCount, 1);
  assert.equal((await measureDesignText({ text: 'a\n\n', width: 300 }, fakeShaper())).lineCount, 2);
  assert.equal((await measureDesignText({ text: '\n', width: 300 }, fakeShaper())).lineCount, 1);
  const forced = await measureDesignText({ text: 'a\nb', width: 300 }, fakeShaper());
  assert.deepEqual(forced.lines.map((l) => [l.text, l.paragraph, l.break]), [['a', 0, 'forced'], ['b', 1, 'end']]);
});

test('breaks fall at spaces with the space hanging, and a word wider than the line is cut between characters', async () => {
  // 20 px per letter, 10 per space at size 40, pad 0.
  const m = await measureDesignText({ text: 'aaaa bbbb', size: 40, pad: 0, width: 85 }, fakeShaper());
  assert.deepEqual(m.lines.map((l) => [l.text, l.width, l.break]), [['aaaa ', 80, 'space'], ['bbbb', 80, 'end']]);
  const cut = await measureDesignText({ text: 'abcdefgh', size: 40, pad: 0, width: 70 }, fakeShaper());
  assert.deepEqual(cut.lines.map((l) => [l.text, l.break]), [['abc', 'anywhere'], ['def', 'anywhere'], ['gh', 'end']]);
  const hyphen = await measureDesignText({ text: 'lock-in', size: 40, pad: 0, width: 110 }, fakeShaper());
  assert.deepEqual(hyphen.lines.map((l) => [l.text, l.break]), [['lock-', 'opportunity'], ['in', 'end']]);
});

test('a line within the margin of the edge, or a next word that only just missed, is nearEdge', async () => {
  const tight = await measureDesignText({ text: 'aaaa bbbb', size: 40, pad: 0, width: 82 }, fakeShaper());
  assert.equal(tight.tolerance.nearEdgePx, 3);
  assert.equal(tight.lines[0]!.slack, 2);
  assert.equal(tight.lines[0]!.nearEdge, true);
  assert.equal(tight.nearEdge, true);
  // 'aaaa bbbb' is 170 wide; at 168 the second word misses by 2 px.
  const missed = await measureDesignText({ text: 'aaaa bbbb', size: 40, pad: 0, width: 168 }, fakeShaper());
  assert.equal(missed.lineCount, 2);
  assert.equal(missed.lines[0]!.nearEdge, true);
  const roomy = await measureDesignText({ text: 'aaaa bbbb', size: 40, pad: 0, width: 400 }, fakeShaper());
  assert.equal(roomy.nearEdge, false);
});

test('each run is shaped in its own face: bold is CSS bolder, {wNNN|} wins, italic uses the italic face, {mono|} the mono face', async () => {
  const calls: TextShapeRunV1[] = [];
  const fonts = { brand: 'Brand Sans', mono: 'Brand Mono', italic: 'Brand Italic' };
  await measureDesignText({ text: 'a **b** {w300|c} *d* {mono|e}', weight: 500, fonts, width: 900 }, fakeShaper(calls));
  const face = (t: string) => calls.find((c) => c.text === t)!;
  assert.deepEqual([face('b').family, face('b').weight], ['Brand Sans', 700]);
  assert.equal(face('c').weight, 300);
  assert.deepEqual([face('d').family, face('d').italic], ['Brand Italic', true]);
  assert.equal(face('e').family, 'Brand Mono');
  const bolder = async (weight: number): Promise<number> => {
    const seen: TextShapeRunV1[] = [];
    await measureDesignText({ text: '**x**', weight, width: 100 }, fakeShaper(seen));
    return seen.find((c) => c.text === 'x')!.weight;
  };
  assert.deepEqual([await bolder(300), await bolder(500), await bolder(600), await bolder(900)], [400, 700, 900, 900]);
  // With no italic slot, italic runs fall back to the brand face.
  const plain: TextShapeRunV1[] = [];
  await measureDesignText({ text: '*x*', fonts: { brand: 'Brand Sans' }, width: 100 }, fakeShaper(plain));
  assert.equal(plain.find((c) => c.text === 'x')!.family, 'Brand Sans');
});

test('list lines draw their indent and marker', async () => {
  const m = await measureDesignText({ text: '- one\n  - two\n3. three', width: 900 }, fakeShaper());
  assert.deepEqual(m.lines.map((l) => l.text), ['•  one', '  •  two', '3.  three']);
});

test('tracking or ligatures off turn liga and clig off; alternates turn salt on', async () => {
  const features = async (spec: Record<string, unknown>): Promise<string[]> => {
    const calls: TextShapeRunV1[] = [];
    await measureDesignText({ text: 'fi', width: 300, ...spec }, fakeShaper(calls));
    return calls[0]!.features;
  };
  assert.deepEqual(await features({}), []);
  assert.deepEqual(await features({ tracking: 2 }), ['liga=0', 'clig=0']);
  assert.deepEqual(await features({ ligatures: false }), ['liga=0', 'clig=0']);
  assert.deepEqual(await features({ alternates: true }), ['salt=1']);
});

test('a border inside the box narrows and shortens the text area, at whole px', async () => {
  const m = await measureDesignText({ text: 'x', width: 200, height: 100, pad: 8, strokeW: 2.6 }, fakeShaper());
  assert.equal(m.availableWidth, 200 - 2 * 2 - 16);
  assert.equal(m.box!.clientHeight, 96);
  const hairline = await measureDesignText({ text: 'x', width: 200, height: 100, pad: 0, strokeW: 0.4 }, fakeShaper());
  assert.equal(hairline.box!.clientHeight, 98);
});

test('a clipped box hides lines by valign; a box that fits hides none', async () => {
  const text = 'one\ntwo\nthree\nfour';
  const spec = { text, size: 20, lineHeight: 1.5, pad: 0, width: 300, height: 65 };
  const top = await measureDesignText({ ...spec, valign: 'top' }, fakeShaper());
  assert.equal(top.overflow!.clipped, true);
  assert.deepEqual(top.overflow!.hiddenLines, [2, 3]);
  const bottom = await measureDesignText({ ...spec, valign: 'bottom' }, fakeShaper());
  assert.deepEqual(bottom.overflow!.hiddenLines, [0, 1]);
  const middle = await measureDesignText({ ...spec, valign: 'middle' }, fakeShaper());
  assert.deepEqual(middle.overflow!.hiddenLines, [0, 3]);
  const fits = await measureDesignText({ ...spec, height: 200 }, fakeShaper());
  assert.equal(fits.overflow!.clipped, false);
  assert.deepEqual(fits.overflow!.hiddenLines, []);
  assert.ok(fits.overflow!.y < 0, 'room to spare is negative overflow');
  assert.equal((await measureDesignText({ text: 'x', width: 100 }, fakeShaper())).overflow, undefined, 'no height, no verdict');
});

test('the audit\'s rule: clipped when scrollHeight passes clientHeight by more than half a pixel', async () => {
  const exact = await measureDesignText({ text: 'Tall', size: 112, lineHeight: 1.05, pad: 0, width: 1600, height: 129 }, fakeShaper());
  assert.equal(exact.overflow!.clipped, false);
  const short = await measureDesignText({ text: 'Tall', size: 112, lineHeight: 1.05, pad: 0, width: 1600, height: 128 }, fakeShaper());
  assert.equal(short.overflow!.clipped, true, 'a box sized to the line box alone clips the descenders');
});

test('a spec it cannot read is input.invalid; a shaper\'s font.unavailable passes through', async () => {
  const refused = async (spec: unknown, re: RegExp): Promise<void> => {
    await assert.rejects(measureDesignText(spec as never, fakeShaper()), (err: unknown) => err instanceof TextMeasureError && err.code === 'input.invalid' && re.test(err.message));
  };
  await refused({ text: 'x' }, /width/);
  await refused({ text: 'x', width: -1 }, /width/);
  await refused({ text: 1, width: 10 }, /text/);
  await refused({ text: 'x', width: 10, height: 0 }, /height/);
  await refused({ text: 'x', width: 10, valign: 'centre' }, /valign/);
  await refused({ text: 'x'.repeat(70_000), width: 10 }, /65536/);
  const missing: TextShaperV1 = async (run) => { throw new TextMeasureError('font.unavailable', `No font file for "${run.family}"`); };
  await assert.rejects(measureDesignText({ text: 'x', width: 10, fonts: { brand: 'Nowhere Sans' } }, missing), (err: unknown) => err instanceof TextMeasureError && err.code === 'font.unavailable');
});

test('a shaper with no metrics is noted, never silently trusted', async () => {
  const bare: TextShaperV1 = async (run) => ({ advances: [...run.text].map(() => 10), total: run.text.length * 10, font: { file: 'x.ttf' } });
  const m = await measureDesignText({ text: 'x', width: 100 }, bare);
  assert.ok(m.notes.some((n) => /no vertical metrics/.test(n)));
});

// ─── Node: real HarfBuzz over the canvas faces ───────────────────────────────

test('a synthetic three-line headline matches the prototype: breaks, widths, height and scrollHeight', async () => {
  const m = await measureTextNode({ text: 'Every quarter we measure what our customers keep using, and why they stay', font: 'sans', weight: 500, size: 72, width: 900, lineHeight: 1.12, pad: 0 });
  assert.deepEqual(m.lines.map((l) => l.text), ['Every quarter we measure ', 'what our customers keep ', 'using, and why they stay']);
  const widths = [813.01, 790.91, 763.56];
  m.lines.forEach((l, i) => {
    assert.ok(Math.abs(l.width - widths[i]!) <= 0.05, `line ${i} width ${l.width}`);
  });
  assert.equal(m.height, 241.875);
  assert.equal(m.scrollHeight, 246);
  assert.equal(m.nearEdge, false);
  assert.deepEqual(m.font, { token: 'sans', family: 'SUSE', weight: 500, italic: false, file: '/fonts/SUSE[wght].ttf', variations: { wght: 500 } });
});

test('the trap headline breaks mid-word where the canvas does, and is clipped', async () => {
  const row = TRAP.find((r) => r.id === 'overflow')!;
  const m = await measureTextNode(textMeasureSpecOfRow(row));
  assert.deepEqual(m.lines.map((l) => l.text), ['An ', 'unexpec', 'tedly ', 'long ', 'headline']);
  assert.equal(m.lines[1]!.break, 'anywhere');
  assert.equal(m.scrollHeight, 363);
  assert.equal(m.overflow!.clipped, true);
  assert.equal(m.box!.clientHeight, 70);
});

test('lists, bold, mono and italic runs measure in their own faces', async () => {
  const m = await measureTextNode({ text: '- First point\n- **Second** point with {mono|code}\n1. A *numbered* line', size: 32, weight: 400, width: 700, lineHeight: 1.3, pad: 8 });
  assert.deepEqual(m.lines.map((l) => [l.text, l.break]), [['•  First point', 'forced'], ['•  Second point with code', 'forced'], ['1.  A numbered line', 'end']]);
  const widths = [169.36, 366.69, 263.31];
  m.lines.forEach((l, i) => {
    assert.ok(Math.abs(l.width - widths[i]!) <= 0.05, `line ${i} width ${l.width}`);
  });
  assert.equal(m.height, 140.78125);
  assert.equal(m.scrollHeight, 141);
  assert.deepEqual(m.faces.map((f) => [f.token, f.family, f.weight, f.italic, f.file]), [
    ['sans', 'SUSE', 400, false, '/fonts/SUSE[wght].ttf'],
    ['sans', 'SUSE', 700, false, '/fonts/SUSE[wght].ttf'],
    ['mono', 'SUSE Mono', 400, false, '/fonts/SUSEMono[wght].ttf'],
    ['italic', 'SUSE', 400, true, '/fonts/SUSE-Italic[wght].ttf'],
  ]);
});

test('vertical metrics come from the font file', () => {
  const metrics = sfntVerticalMetrics(new Uint8Array(readFileSync(join(ROOT, 'shells/web/public/fonts/SUSE[wght].ttf'))));
  assert.deepEqual(metrics, { upem: 1000, ascent: 980, descent: 280 });
  assert.equal(sfntVerticalMetrics(new Uint8Array(readFileSync(join(ROOT, 'shells/web/public/fonts/SUSE[wght].woff2')))), null, 'woff2 is not an sfnt');
  assert.equal(sfntVerticalMetrics(new Uint8Array(4)), null);
});

test('a family by name resolves to its face; an italic run with no italic face is measured upright and noted', async () => {
  const m = await measureTextNode({ text: 'Plain and *slanted*', font: 'Outfit', fonts: { brand: 'Outfit' }, weight: 400, size: 40, width: 1200 });
  assert.equal(m.font.file, '/fonts/Outfit[wght].ttf');
  assert.ok(m.notes.some((n) => /Outfit has no italic face/.test(n)), m.notes.join(' '));
  await assert.rejects(measureTextNode({ text: 'x', width: 100, fonts: { brand: 'Nowhere Sans' } }), (err: unknown) => err instanceof TextMeasureError && err.code === 'font.unavailable' && /Nowhere Sans/.test(err.message));
});

test('the brand faces come from a brief or a token document, over the platform faces', () => {
  assert.deepEqual(measureFontsFromBrief(null), { brand: 'SUSE', mono: 'SUSE Mono' });
  assert.deepEqual(
    measureFontsFromBrief({ type: { families: [{ path: 'font.brand', value: "'Outfit', sans-serif" }, { path: 'font.display', value: 'Outfit' }] } }),
    { brand: 'Outfit', mono: 'SUSE Mono', display: 'Outfit' },
  );
  const tokens = { font: { $type: 'fontFamily', brand: { $value: 'Outfit' }, mono: { $value: 'Fixture Mono, monospace' } } };
  assert.deepEqual(measureFontsFromTokens(tokens), { brand: 'Outfit', mono: 'Fixture Mono' });
  assert.deepEqual(measureFontsFromTokens(null), { brand: 'SUSE', mono: 'SUSE Mono' });
});

test('a row becomes a spec with the renderer\'s reading of its fields', () => {
  const spec = textMeasureSpecOfRow({ id: 't', kind: 'text', text: 'x', w: '300', h: 40, fontSize: '24', weight: '600', lineHeight: 1.2, pad: 0, tracking: 1, ligatures: 'false', alternates: 'on', stroke: '#000', strokeW: 2, valign: 'nowhere' });
  assert.deepEqual(spec, { text: 'x', width: 300, height: 40, weight: '600', size: 24, lineHeight: 1.2, pad: 0, tracking: 1, ligatures: false, alternates: true, strokeW: 2, valign: 'middle' });
  assert.equal(textMeasureSpecOfRow({ text: 'x', w: 10, stroke: 'not a colour!', strokeW: 3 }).strokeW, undefined, 'a stroke the renderer would not paint draws no border');
});

test('a document\'s plain text layers are measured; stories, hidden layers and missing faces are skipped with a reason', async () => {
  const rows = [
    ...TRAP,
    { id: 'story', kind: 'text', textStory: 'story-1', text: 'composed', w: 100, h: 100 },
    { id: 'gone', kind: 'text', hidden: true, text: 'hidden', w: 100, h: 100 },
    { id: 'odd', kind: 'text', font: 'Nowhere Sans', text: 'x', w: 100, h: 100 },
    { id: 'fit', kind: 'text', fitText: true, text: 'shrinks', w: 100, h: 100 },
  ];
  const report = await measureDesignRowsReport(rows);
  const measuredIds = report.measured.map((m) => m.layerId);
  assert.ok(measuredIds.includes('overflow') && measuredIds.includes('fit'));
  assert.ok(!measuredIds.includes('photo'), 'an image layer is not text');
  assert.deepEqual(report.skipped.map((s) => s.layerId), ['story', 'gone', 'odd']);
  assert.match(report.skipped[0]!.reason, /text story/);
  assert.match(report.skipped[2]!.reason, /Nowhere Sans/);
  assert.ok(report.measured.find((m) => m.layerId === 'fit')!.measure.notes.some((n) => /fitText/.test(n)));
  assert.equal(report.measured.find((m) => m.layerId === 'overflow')!.index, TRAP.findIndex((r) => r.id === 'overflow'));

  const only = await measureDesignRows(rows, { layerIds: ['heading'] });
  assert.deepEqual(only.map((m) => m.layerId), ['heading']);
  await assert.rejects(measureDesignRows(rows, { layerIds: ['story'] }), /text story/);
  await assert.rejects(measureDesignRows(rows, { layerIds: ['photo'] }), /not text/);
  await assert.rejects(measureDesignRows(rows, { layerIds: ['nope'] }), /No layer "nope"/);
  await assert.rejects(measureDesignRows(rows, { layerIds: ['odd'] }), /Nowhere Sans/);
});

// ─── Chromium parity regressions ─────────────────────────────────────────────

test('break opportunities follow Chromium: none after / or inside C++, a hyphen breaks before a digit after a word, a space run always breaks', () => {
  const at = (text: string): string => {
    let out = '';
    let prev = 0;
    for (const o of chromiumBreakOffsets(text)) {
      out += `${text.slice(prev, o)}|`;
      prev = o;
    }
    return out;
  };
  assert.equal(at('and/or'), 'and/or|');
  assert.equal(at('docs/guides/setup'), 'docs/guides/setup|');
  assert.equal(at('C++ code'), 'C++ |code|');
  assert.equal(at('2026-10-03'), '2026-|10-|03|');
  assert.equal(at('UTF-8'), 'UTF-|8|');
  assert.equal(at('a -5'), 'a |-5|', 'a minus sign stays with its number');
  assert.equal(at('x--y'), 'x-|-|y|');
  assert.equal(at('a /b'), 'a |/b|', 'a break after spaces even before a slash');
  assert.equal(at('foo?bar'), 'foo?|bar|');
  assert.equal(at('a/é'), 'a/|é|', 'a pair with a character that is not ASCII is UAX #14');
});

test('everyday slashes and ISO dates break where Chromium breaks them, so the clipped verdict holds both ways', async () => {
  // Chromium, with the Design renderer's own text CSS: 5 lines and scrollHeight 184 (clipped
  // in 160), and 3 lines and scrollHeight 117 (fits in 130).
  const slash = await measureTextNode({ text: 'Choose this and/or that, 24/7 support, read docs/guides/setup today', width: 300, height: 160, size: 28, weight: 400, lineHeight: 1.2, valign: 'top' });
  assert.deepEqual(slash.lines.map((l) => l.text), ['Choose this and/or ', 'that, 24/7 support, ', 'read ', 'docs/guides/setup ', 'today']);
  assert.equal(slash.scrollHeight, 184);
  assert.equal(slash.overflow!.clipped, true);
  const dates = await measureTextNode({ text: 'Mixed text with numbers 3.14159 and 2026-10-03 dates 10:30am', width: 320, height: 130, size: 28, weight: 400, lineHeight: 1.2, valign: 'top' });
  assert.deepEqual(dates.lines.map((l) => l.text), ['Mixed text with numbers ', '3.14159 and 2026-10-', '03 dates 10:30am']);
  assert.equal(dates.scrollHeight, 117);
  assert.equal(dates.overflow!.clipped, false);
});

test('characters the face has no glyph for flag their lines, are listed and noted', async () => {
  const shaper: TextShaperV1 = async (run) => {
    const result = await fakeShaper()(run);
    const missing = [...run.text].flatMap((ch, i) => (ch.charCodeAt(0) > 0x2fff ? [i] : []));
    return missing.length ? { ...result, missing } : result;
  };
  const m = await measureDesignText({ text: 'plain words here\n日本 text', size: 20, pad: 0, width: 1000 }, shaper);
  assert.deepEqual(m.lines.map((l) => l.nearEdge), [false, true]);
  assert.deepEqual(m.uncovered, ['日', '本']);
  assert.ok(m.notes.some((n) => /no glyph for 2 characters/.test(n) && /U\+65E5/.test(n)));
  // The real faces: SUSE has no CJK glyphs, so the browser's fallback font sets those lines.
  const cjk = await measureTextNode({ text: '日本語のテキストは長い行で折り返されます。', width: 300, height: 160, size: 32 });
  assert.ok(cjk.uncovered && cjk.uncovered.length > 0);
  assert.equal(cjk.nearEdge, true);
  assert.ok(cjk.lines.every((l) => l.nearEdge));
  const latin = await measureTextNode({ text: 'Plain Latin text', width: 900, size: 32 });
  assert.equal(latin.uncovered, undefined, 'a covered text lists nothing');
});

test('dictionary scripts (Thai) are flagged near the edge with a note, since the browser breaks them by dictionary', async () => {
  const m = await measureDesignText({ text: 'ภาษาไทยเป็นภาษาที่ไม่มีช่องว่าง', size: 20, pad: 0, width: 100 }, fakeShaper());
  assert.ok(m.lines.length > 1);
  assert.ok(m.lines.every((l) => l.nearEdge));
  assert.ok(m.notes.some((n) => /by dictionary/.test(n)));
});

test('a plainText row is measured verbatim: no list markers, emphasis or attribute runs', async () => {
  const row = { id: 'p', kind: 'text', text: '- a **literal** _marker_ {mono|x} line\n* and another', plainText: true, w: 340, h: 100, fontSize: 30, pad: 8, lineHeight: 1.2 };
  assert.equal(textMeasureSpecOfRow(row).plain, true);
  assert.equal(textMeasureSpecOfRow({ ...row, plainText: 'off' }).plain, undefined);
  const calls: TextShapeRunV1[] = [];
  const fake = await measureDesignText({ ...textMeasureSpecOfRow(row), width: 2000 }, fakeShaper(calls));
  assert.deepEqual(fake.lines.map((l) => l.text), ['- a **literal** _marker_ {mono|x} line', '* and another']);
  assert.ok(calls.every((c) => !c.italic && c.family === 'SUSE'));
  // Chromium draws the literal text: 3 lines, scrollHeight 124, clipped in a 100 px box.
  const [real] = await measureDesignRows([row]);
  assert.deepEqual(real!.measure.lines.map((l) => l.text), ['- a **literal** _marker_ ', '{mono|x} line', '* and another']);
  assert.equal(real!.measure.scrollHeight, 124);
  assert.equal(real!.measure.overflow!.clipped, true);
});

test('number fields with units read as the renderer reads them (parseFloat)', async () => {
  const spec = textMeasureSpecOfRow({ kind: 'text', text: 'x', w: '300px', h: '400px', fontSize: '60px', pad: '0px', lineHeight: '1.3em', tracking: 'wide' });
  assert.deepEqual([spec.width, spec.height, spec.size, spec.pad, spec.lineHeight, spec.tracking], [300, 400, 60, 0, 1.3, undefined]);
  const m = await measureDesignText({ text: 'x', width: 100, size: '60px' as unknown as number, pad: '0px' as unknown as number }, fakeShaper());
  assert.deepEqual([m.size, m.pad], [60, 0]);
});

test('italic and a font run: the inner element names the family, as the em rule and the span style do', async () => {
  const calls: TextShapeRunV1[] = [];
  const fonts = { brand: 'Brand Sans', mono: 'Brand Mono', italic: 'Brand Italic' };
  await measureDesignText({ text: 'a *{mono|outer}* b {mono|*inner*}', fonts, width: 2000 }, fakeShaper(calls));
  const face = (t: string) => calls.find((c) => c.text === t)!;
  assert.deepEqual([face('outer').family, face('outer').italic], ['Brand Mono', true], 'italic outside mono: mono italic');
  assert.deepEqual([face('inner').family, face('inner').italic], ['Brand Italic', true], 'mono outside italic: the italic face');
});

test('spec.italic sets every run in emphasis as an italic style does: the italic face, the layer face upright', async () => {
  const fonts = { brand: 'Brand Sans', mono: 'Brand Mono', italic: 'Brand Italic' };
  const viaFlag: TextShapeRunV1[] = [];
  const flag = await measureDesignText({ text: '- Mono box {mono|code} set in italic', font: 'mono', italic: true, fonts, width: 2000 }, fakeShaper(viaFlag));
  const viaMarkup: TextShapeRunV1[] = [];
  const markup = await measureDesignText({ text: '- *Mono box {mono|code} set in italic*', font: 'mono', fonts, width: 2000 }, fakeShaper(viaMarkup));
  const strip = (calls: TextShapeRunV1[]) => calls.map((c) => [c.text, c.family, c.italic]);
  assert.deepEqual(strip(viaFlag), strip(viaMarkup));
  assert.equal(viaFlag.find((c) => c.text === 'Mono box ')!.family, 'Brand Italic');
  assert.equal(viaFlag.find((c) => c.text === 'code')!.family, 'Brand Mono', 'a font run inside the emphasis keeps its family');
  assert.equal(viaFlag.find((c) => c.text.startsWith('•'))!.italic, false, 'the list marker stays upright');
  assert.deepEqual([flag.font.family, flag.font.italic], ['Brand Mono', false]);
  assert.deepEqual(flag.lines.map((l) => l.text), markup.lines.map((l) => l.text));
});

test('a report indexes rows by their place in the array given, non-objects included, and keeps to a units budget', async () => {
  const rows: unknown[] = [{ id: 'f1', kind: 'frame', w: 100, h: 100 }, 'junk', null, { id: 't1', kind: 'text', text: 'one', w: 200, h: 80 }, { id: 't2', kind: 'text', text: 'two words', w: 200, h: 80 }];
  const report = await measureDesignRowsReport(rows);
  assert.deepEqual(report.measured.map((m) => [m.layerId, m.index]), [['t1', 3], ['t2', 4]]);
  assert.deepEqual(countMeasurableTextLayers(rows), { layers: 2, units: 12 });
  assert.deepEqual(countMeasurableTextLayers(rows, ['t2']), { layers: 1, units: 9 });
  const capped = await measureDesignRowsReport(rows, { maxUnits: 5 });
  assert.deepEqual(capped.measured.map((m) => m.layerId), ['t1']);
  assert.deepEqual(capped.skipped.map((s) => [s.layerId, s.index]), [['t2', 4]]);
  assert.match(capped.skipped[0]!.reason, /measuring budget of 5 characters/);
});

test('a word as long as a measure takes is cut line by line without quadratic scans', async () => {
  const started = performance.now();
  const m = await measureDesignText({ text: 'a'.repeat(65536), size: 48, width: 60 }, fakeShaper());
  assert.equal(m.lineCount, 65536);
  assert.ok(performance.now() - started < 20000, `took ${Math.round(performance.now() - started)} ms`);
});
