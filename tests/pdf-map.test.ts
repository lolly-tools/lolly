// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the pure PDF/.ai content-stream interpreter (engine/src/pdf-map.ts).
 *
 * The shell decodes a page's content stream with pdf-lib and hands the string here;
 * these tests feed hand-written content streams directly (no PDF library) and assert
 * the reconstructed DesignNodes — proving rectangles, ellipses, text, arbitrary paths,
 * optional-content groups, image XObjects and form-XObject recursion all map to editable
 * boxes with correct box-space coordinates (PDF's bottom-left y-up flipped to top-left).
 *
 * Run with: node --test tests/pdf-map.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { interpretPdfPage, parseToUnicode, toUnicodeDecoder } from '../engine/src/pdf-map.ts';
import type { PdfPageInput } from '../engine/src/pdf-map.ts';
import { finalizeBoxes } from '../engine/src/design-map.ts';

const near = (a: number, b: number, eps = 0.6): boolean => Math.abs(a - b) <= eps;
const page = (content: string, extra: Partial<PdfPageInput> = {}): any[] =>
  interpretPdfPage({ content, width: 400, height: 300, ...extra });
/** Same, but capturing the interpreter's (code, detail) warnings. */
const pageW = (content: string, extra: Partial<PdfPageInput> = {}): { nodes: any[]; warns: string[] } => {
  const warns: string[] = [];
  const nodes = interpretPdfPage({
    content, width: 400, height: 300,
    onWarn: (code, detail) => warns.push(detail ? `${code}|${detail}` : code),
    ...extra,
  });
  return { nodes: nodes as any[], warns };
};

// ── rectangle → editable box, y-flipped ───────────────────────────────────────
test('filled rectangle → box with flipped coords', () => {
  const nodes = page('0.2 0.7 0.5 rg 40 200 120 60 re f');
  assert.equal(nodes.length, 1);
  const n = nodes[0];
  assert.equal(n.kind, 'box');
  assert.equal(n.shape, 'rect');
  assert.equal(n.fill, '#33b380');
  assert.ok(near(n.x, 40) && near(n.y, 40), `xy ${n.x},${n.y}`);   // PDF y 200..260 → box y 40
  assert.ok(near(n.w, 120) && near(n.h, 60), `wh ${n.w},${n.h}`);
  assert.ok(near(n.rot, 0));
});

test('rectangle built from explicit lines + h close is still a box', () => {
  const nodes = page('0 0 0 rg 10 10 m 10 60 l 110 60 l 110 10 l h f');
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].kind, 'box');
  assert.equal(nodes[0].shape, 'rect');
});

// ── rotated rectangle keeps its rotation ──────────────────────────────────────
test('obliquely rotated rectangle → box with rotation', () => {
  // rotate 30° (cos30 sin30 -sin30 cos30) then draw a 100x40 rect
  const nodes = page('0 0 0 rg 0.866 0.5 -0.5 0.866 0 0 cm 0 0 100 40 re f');
  assert.equal(nodes.length, 1);
  const n = nodes[0];
  assert.equal(n.kind, 'box');
  assert.ok(Math.abs(n.rot) > 10 && Math.abs(n.rot) < 80, `expected rotation, got ${n.rot}`);
  const dims = [n.w, n.h].sort((a: number, b: number) => a - b);
  assert.ok(near(dims[0], 40) && near(dims[1], 100), `dims ${n.w},${n.h}`);
});

test('a 90°-traced axis-aligned rectangle is not needlessly rotated', () => {
  // pdf-lib's drawRectangle traces the vertical edge first — must still be rot 0
  const nodes = page('0 0 0 rg 1 0 0 1 40 200 cm 0 0 m 0 60 l 120 60 l 120 0 l h f');
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].rot, 0);
  assert.ok(near(nodes[0].w, 120) && near(nodes[0].h, 60), `wh ${nodes[0].w},${nodes[0].h}`);
});

// ── ellipse (4 curves) → ellipse box ──────────────────────────────────────────
test('four-curve circle → ellipse box', () => {
  const c = [
    '0.2 0.3 0.9 rg',
    '260 90 m',
    '260 67.91 277.91 50 300 50 c',
    '322.09 50 340 67.91 340 90 c',
    '340 112.09 322.09 130 300 130 c',
    '277.91 130 260 112.09 260 90 c',
    'f',
  ].join('\n');
  const nodes = page(c);
  assert.equal(nodes.length, 1);
  const n = nodes[0];
  assert.equal(n.kind, 'box');
  assert.equal(n.shape, 'ellipse');
  assert.equal(n.fill, '#334de6');
  assert.ok(near(n.x, 260) && near(n.y, 170), `xy ${n.x},${n.y}`);
  assert.ok(near(n.w, 80) && near(n.h, 80), `wh ${n.w},${n.h}`);
});

// ── text → editable text node with position/size/colour ───────────────────────
test('text show → editable text node', () => {
  const nodes = page('BT 0.05 0.2 0.17 rg /F1 28 Tf 1 0 0 1 50 120 Tm (Hello AI) Tj ET');
  assert.equal(nodes.length, 1);
  const n = nodes[0];
  assert.equal(n.kind, 'text');
  assert.equal(n.text, 'Hello AI');
  assert.ok(near(n.fontSize, 28), `size ${n.fontSize}`);
  assert.equal(n.fg, '#0d332b');
  assert.ok(near(n.x, 50), `x ${n.x}`);
  assert.ok(near(n.y, 157.6, 1), `y ${n.y}`);       // baseline 180 minus ~0.8·28
  assert.ok(near(n.rot, 0));
});

test('multi-line text (Td line breaks) joins into one text node', () => {
  const c = 'BT /F1 20 Tf 24 TL 1 0 0 1 40 200 Tm (Line one) Tj 0 -30 Td (Line two) Tj ET';
  const nodes = page(c);
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].kind, 'text');
  assert.equal(nodes[0].text, 'Line one\nLine two');
});

test('hex-string and TJ array both decode', () => {
  // <48656C6C6F> = "Hello"; TJ with kerning numbers ignored
  const nodes = page('BT /F1 18 Tf 1 0 0 1 10 250 Tm [<48656C6C6F> -250 (X)] TJ ET');
  assert.equal(nodes[0].text, 'Hello X');
});

// ── arbitrary path → vector image box (not a flat colour) ─────────────────────
test('triangle path → vector image box with baked path', () => {
  const nodes = page('0 0 1 rg 10 10 m 100 10 l 55 90 l h f');
  assert.equal(nodes.length, 1);
  const n = nodes[0];
  assert.equal(n.kind, 'image');
  assert.equal(n._vectorFill, '#0000ff');
  assert.ok(typeof n._vectorPath === 'string' && n._vectorPath.includes('M10 290'), n._vectorPath);
  assert.ok(n._vectorViewBox && near(n._vectorViewBox.w, 90), JSON.stringify(n._vectorViewBox));
});

test('stroked-only path carries its stroke', () => {
  const nodes = page('1 0 0 RG 2 w 10 10 m 100 10 l 55 90 l h S');
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].kind, 'image');
  assert.equal(nodes[0]._vectorFill, 'none');
  assert.ok(nodes[0]._vectorStroke && nodes[0]._vectorStroke.color === '#ff0000');
});

// ── groups (Illustrator layers / forms / q…Q blocks), gated on ≥2 members ──────
test('OCG layer with ≥2 items → children share the layer group label', () => {
  const nodes = page('/OC /MC0 BDC 1 0 0 rg 0 0 50 50 re f 0 0 1 rg 60 0 50 50 re f EMC', { ocgs: { MC0: 'Layer 1' } });
  assert.equal(nodes.length, 2);
  assert.equal(nodes[0].group, 'Layer 1');
  assert.equal(nodes[1].group, 'Layer 1');
});

test('single-item group is dropped (a lone item is not a group)', () => {
  const nodes = page('/OC /MC0 BDC 1 0 0 rg 0 0 50 50 re f EMC', { ocgs: { MC0: 'Layer 1' } });
  assert.equal(nodes.length, 1);
  assert.ok(!nodes[0].group, `expected ungrouped, got ${nodes[0].group}`);
});

test('form XObject with ≥2 items → its children share a group', () => {
  const nodes = page('/Fm0 Do', {
    xobjects: { Fm0: { kind: 'form', content: '1 0 0 rg 0 0 40 40 re f 0 0 1 rg 50 0 40 40 re f', matrix: [1, 0, 0, 1, 10, 10] } },
  });
  assert.equal(nodes.length, 2);
  assert.ok(nodes[0].group && nodes[0].group === nodes[1].group, `groups ${nodes[0].group},${nodes[1].group}`);
});

test('q…Q block wrapping ≥2 items → one group; per-item q singletons stay merged to it', () => {
  const nodes = page('q 1 0 0 rg q 0 0 30 30 re f Q 0 0 1 rg q 40 0 30 30 re f Q Q');
  assert.equal(nodes.length, 2);
  assert.ok(nodes[0].group && nodes[0].group === nodes[1].group, `groups ${nodes[0].group},${nodes[1].group}`);
});

test('nested groups flatten to the innermost real (≥2) group', () => {
  // outer layer holds an inner form-group of 2 + one loose rect → the 2 share the inner group
  const nodes = page('/OC /MC0 BDC 1 0 0 rg 0 0 20 20 re f /Fm0 Do EMC', {
    ocgs: { MC0: 'Outer' },
    xobjects: { Fm0: { kind: 'form', content: '0 1 0 rg 0 0 20 20 re f 0 0 1 rg 30 0 20 20 re f' } },
  });
  assert.equal(nodes.length, 3);
  // the two inside the form share one group, distinct from the loose rect's grouping
  assert.ok(nodes[1].group && nodes[1].group === nodes[2].group, `form pair ${nodes[1].group},${nodes[2].group}`);
});

// ── image XObject → image node placeholder, unit square × CTM ──────────────────
test('image XObject Do → image node sized by CTM', () => {
  const nodes = page('q 100 0 0 50 20 30 cm /Im0 Do Q', { xobjects: { Im0: { kind: 'image' } } });
  assert.equal(nodes.length, 1);
  const n = nodes[0];
  assert.equal(n.kind, 'image');
  assert.equal(n._imageXObject, 'Im0');
  assert.ok(near(n.x, 20) && near(n.y, 220), `xy ${n.x},${n.y}`);
  assert.ok(near(n.w, 100) && near(n.h, 50), `wh ${n.w},${n.h}`);
});

// ── form XObject recursion (Illustrator symbols) ──────────────────────────────
test('form XObject Do recurses with its matrix', () => {
  const nodes = page('/Fm0 Do', {
    xobjects: { Fm0: { kind: 'form', content: '0 1 0 rg 0 0 40 40 re f', matrix: [1, 0, 0, 1, 10, 10] } },
  });
  assert.equal(nodes.length, 1);
  const n = nodes[0];
  assert.equal(n.kind, 'box');
  assert.equal(n.fill, '#00ff00');
  assert.ok(near(n.x, 10) && near(n.y, 250), `xy ${n.x},${n.y}`);
  assert.ok(near(n.w, 40) && near(n.h, 40), `wh ${n.w},${n.h}`);
});

// ── CMYK colour conversion ────────────────────────────────────────────────────
test('CMYK fill (k) converts to rgb hex', () => {
  const nodes = page('0 1 1 0 k 0 0 10 10 re f');   // C0 M1 Y1 K0 → red
  assert.equal(nodes[0].fill, '#ff0000');
});

// ── a font decoder from the shell is honoured ─────────────────────────────────
test('font decode callback maps custom byte codes', () => {
  const decode = (codes: number[]) => codes.map((c) => String.fromCharCode(c + 1)).join('');
  const nodes = page('BT /F1 12 Tf 1 0 0 1 5 250 Tm (Gdkkn) Tj ET', {
    fonts: { F1: { decode, family: 'Courier', weight: 700 } },
  });
  assert.equal(nodes[0].text, 'Hello');
  // monospace family → the box maps to the neutral mono family via finalizeBoxes
  // (a branded shell passes its own vocabulary — see design-map DesignMapOptions)
  const box = finalizeBoxes(nodes, { prefix: 'p' })[0] as any;
  assert.equal(box.font, 'mono');
  assert.equal(box.weight, '700');
});

// ── integration: nodes flow through finalizeBoxes into valid box rows ──────────
test('nodes finalize into valid box rows', () => {
  const nodes = page('0.2 0.7 0.5 rg 40 200 120 60 re f BT /F1 28 Tf 1 0 0 1 50 120 Tm (Hi) Tj ET');
  const boxes = finalizeBoxes(nodes, { prefix: 'p' }) as any[];
  assert.equal(boxes.length, 2);
  assert.equal(boxes[0].id, 'p0');
  assert.equal(boxes[0].kind, 'box');
  assert.equal(boxes[0].bg, '#33b380');
  assert.equal(boxes[1].kind, 'text');
  assert.equal(boxes[1].text, 'Hi');
});

// ── ToUnicode CMap parsing (embedded / subset fonts) ──────────────────────────
test('parseToUnicode: bfchar single mappings', () => {
  const cmap = `
/CIDInit /ProcSet findresource begin
1 begincodespacerange <00> <FF> endcodespacerange
3 beginbfchar
<01> <0048>
<02> <0069>
<03> <0021>
endbfchar
endcmap`;
  const map = parseToUnicode(cmap);
  const decode = toUnicodeDecoder(map, false);
  assert.equal(decode([1, 2, 3]), 'Hi!');
});

test('parseToUnicode: bfrange base and array', () => {
  const cmap = `
2 beginbfrange
<10> <12> <0041>
<20> <21> [<0058> <0059>]
endbfrange`;
  const map = parseToUnicode(cmap);
  const decode = toUnicodeDecoder(map, false);
  assert.equal(decode([0x10, 0x11, 0x12]), 'ABC');   // range base 0x41 = A
  assert.equal(decode([0x20, 0x21]), 'XY');           // explicit array
});

test('toUnicodeDecoder: two-byte (Type0) codes', () => {
  const map = new Map<number, string>([[0x0041, 'A'], [0x0042, 'B']]);
  const decode = toUnicodeDecoder(map, true);
  assert.equal(decode([0x00, 0x41, 0x00, 0x42]), 'AB');
});

test('interpretPdfPage uses a ToUnicode-built decoder for subset text', () => {
  const cmap = '1 beginbfchar <41> <0053> endbfchar';   // code 0x41 → "S"
  const decode = toUnicodeDecoder(parseToUnicode(cmap), false);
  const nodes: any[] = interpretPdfPage({
    content: 'BT /F1 12 Tf 1 0 0 1 5 250 Tm <41> Tj ET', width: 400, height: 300,
    fonts: { F1: { decode } },
  });
  assert.equal(nodes[0].text, 'S');
});

// ── gradients: shading patterns + the `sh` operator ───────────────────────────
const AXIAL = {
  type: 2 as const,
  coords: [0, 0, 100, 0],
  stops: [{ offset: 0, color: '#00ff00' }, { offset: 1, color: '#0000ff' }],
  extend: [true, true] as [boolean, boolean],
};

test('shading-pattern fill → box carries a box-space _gradient', () => {
  const nodes = page('/P1 scn 40 200 120 60 re f', { patterns: { P1: { shading: AXIAL, matrix: [1, 0, 0, 1, 0, 0] } } });
  assert.equal(nodes.length, 1);
  const g = nodes[0]._gradient;
  assert.ok(g, 'expected _gradient');
  assert.equal(g.type, 2);
  assert.deepEqual(g.coords, [0, 0, 100, 0]);
  assert.deepEqual(g.stops, AXIAL.stops);
  // pattern matrix (identity) ∘ page flip → [1,0,0,-1,0,300] on a 300-tall page.
  assert.deepEqual(g.matrix, [1, 0, 0, -1, 0, 300]);
  assert.equal(nodes[0].fill, '');       // flat fill cleared — the gradient wins
});

test('a shading pattern on a non-rectangular path → a path node with _gradient', () => {
  const nodes = page('/P1 scn 10 10 m 100 10 l 55 90 l h f', { patterns: { P1: { shading: AXIAL } } });
  assert.equal(nodes.length, 1);
  assert.ok(nodes[0]._vectorPath, 'expected a vector path node');
  assert.equal(nodes[0]._vectorFill, 'none');
  assert.ok(nodes[0]._gradient, 'expected _gradient on the path node');
});

test('a solid fill colour after a gradient clears the pending gradient', () => {
  const nodes = page('/P1 scn 40 200 120 60 re f 1 0 0 rg 10 10 50 50 re f', { patterns: { P1: { shading: AXIAL } } });
  assert.equal(nodes.length, 2);
  assert.ok(nodes[0]._gradient);
  assert.equal(nodes[1]._gradient, undefined);
  assert.equal(nodes[1].fill, '#ff0000');
});

test('the `sh` operator paints a clipped gradient rect', () => {
  const nodes = page('q 40 200 120 60 re W n /S1 sh Q', { shadings: { S1: AXIAL } });
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].shape, 'rect');
  assert.ok(nodes[0]._gradient, 'expected _gradient');
  assert.ok(nodes[0]._clips?.length, 'sh gradient must carry the active clip');
  assert.equal(nodes[0].w, 400);          // full page, cropped by the clip on export
  assert.equal(nodes[0].h, 300);
});

test('an unclipped `sh` is skipped rather than flooding the page', () => {
  const { nodes, warns } = pageW('/S1 sh', { shadings: { S1: AXIAL } });
  assert.deepEqual(nodes, []);
  assert.deepEqual(warns, ['shading.sh.unclipped|S1']);
});

// ── patterns: the fidelity ladder (flat → gradient → tiling collapse → drop) ───
//
// Chromium prints an out-of-sRGB CSS colour as a PatternType 1 whose whole body is
// `/Pn scn <bbox> re f*` over a function-based shading. Every rung below exists
// because dropping one of them turned 76 filled elements into a white ghost page.

test('a pattern the shell resolved to a flat colour paints that colour', () => {
  const nodes = page('/P1 scn 40 200 120 60 re f', { patterns: { P1: { flat: '#ff8800' } } });
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].fill, '#ff8800');
  assert.equal(nodes[0]._gradient, undefined, 'no gradient def for a plain colour');
});

test('a function-based (type 1) shading pattern carries its tile key and composed matrix', () => {
  const TYPE1 = {
    type: 1 as const, coords: [], stops: [], extend: [false, false] as [boolean, boolean],
    domain: [0, 1, 0, 1] as [number, number, number, number],
    shadingMatrix: [2, 0, 0, 2, 10, 20],
    tileKey: 'shd0', flat: '#123456',
  };
  const nodes = page('/P1 scn 40 200 120 60 re f', { patterns: { P1: { shading: TYPE1, matrix: [1, 0, 0, 1, 0, 0], flat: '#123456' } } });
  const g = nodes[0]._gradient;
  assert.ok(g, 'expected _gradient');
  assert.equal(g.type, 1);
  assert.equal(g.tileKey, 'shd0');
  assert.deepEqual(g.domain, [0, 1, 0, 1]);
  // page flip ∘ pattern /Matrix (identity) ∘ shading /Matrix [2 0 0 2 10 20]
  assert.deepEqual(g.matrix, [2, 0, 0, -2, 10, 280]);
  assert.equal(g.shadingMatrix, undefined, 'the shading /Matrix is composed in, not re-emitted');
  assert.equal(nodes[0].fill, '#123456', 'the flat back-stop is always populated');
});

test('a gradient pattern still populates the node fill as the serializer’s back-stop', () => {
  const nodes = page('/P1 scn 40 200 120 60 re f', { patterns: { P1: { shading: AXIAL, flat: '#00ff00' } } });
  assert.ok(nodes[0]._gradient, 'gradient wins');
  assert.equal(nodes[0].fill, '#00ff00');
});

const tiling = (content: string, extra: Record<string, unknown> = {}) => ({
  content, resources: {}, bbox: [0, 0, 100, 100] as [number, number, number, number],
  xStep: 100, yStep: 100, paintType: 1 as const, ...extra,
});

test('a tiling pattern that only re-fills its bbox collapses to the inner paint', () => {
  // The EXACT shape Chromium emits: `/P5 scn 0 0 100 100 re f*` and nothing else.
  const { nodes, warns } = pageW('/P1 scn 40 200 120 60 re f', {
    patterns: {
      P1: {
        matrix: [1, 0, 0, 1, 0, 0],
        tiling: tiling('/P5 scn 0 0 100 100 re f*', { resources: { patterns: { P5: { flat: '#ff8800' } } } }),
      },
    },
  });
  assert.equal(nodes.length, 1, 'the tile body does not leak nodes onto the page');
  assert.equal(nodes[0].fill, '#ff8800');
  assert.deepEqual(warns, ['pattern.tiling.collapsed|P1']);
});

test('a tiling pattern wrapping a gradient collapses to that gradient', () => {
  const nodes = page('/P1 scn 40 200 120 60 re f', {
    patterns: {
      P1: { tiling: tiling('/P5 scn 0 0 100 100 re f', { resources: { patterns: { P5: { shading: AXIAL, flat: '#00ff00' } } } }) },
    },
  });
  assert.ok(nodes[0]._gradient, 'the inner gradient is adopted');
  assert.equal(nodes[0]._gradient.type, 2);
  assert.deepEqual(nodes[0]._gradient.matrix, [1, 0, 0, -1, 0, 300], 'already box space — the collapse ran under the composed CTM');
  assert.equal(nodes[0].fill, '#00ff00');
});

test('a real repeating tile becomes its area-weighted mean colour, and says so', () => {
  const { nodes, warns } = pageW('/P1 scn 40 200 120 60 re f', {
    patterns: { P1: { tiling: tiling('1 0 0 rg 0 0 50 100 re f 0 0 1 rg 50 0 50 100 re f') } },
  });
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].fill, '#800080', 'half red, half blue');
  assert.deepEqual(warns, ['pattern.tiling.averaged|P1']);
});

test('an uncoloured (PaintType 2) tile takes its tint from the scn operands', () => {
  const nodes = page('0.2 0.4 0.6 /P1 scn 40 200 120 60 re f', {
    patterns: { P1: { tiling: tiling('0 0 100 100 re f', { paintType: 2 }) } },
  });
  assert.equal(nodes[0].fill, '#336699');
});

test('a tile that paints nothing keeps the anti-stale-black safety valve', () => {
  // The ORIGINAL fix: never let a pattern-filled shape inherit the previous fill.
  const { nodes, warns } = pageW('1 0 0 rg 0 0 10 10 re f /P1 scn 40 200 120 60 re f', {
    patterns: { P1: { tiling: tiling('') } },
  });
  assert.deepEqual(warns, ['pattern.unsupported|P1']);
  // The pattern-filled rect must NOT inherit the previous red. It survives as an
  // unpainted node (fill '' / _vectorFill 'none'), which the serializer skips.
  const painted = nodes.filter((n) => n.fill || (n._vectorFill && n._vectorFill !== 'none'));
  assert.equal(painted.length, 1, JSON.stringify(nodes.map((n) => [n.fill, n._vectorFill])));
  assert.equal(painted[0].fill, '#ff0000');
});

test('an unknown pattern name still clears the paint and reports exactly once', () => {
  const { nodes, warns } = pageW('1 0 0 rg 0 0 10 10 re f /PX scn 40 200 120 60 re f');
  assert.deepEqual(warns, ['pattern.unsupported|PX']);
  const painted = nodes.filter((n) => n.fill || (n._vectorFill && n._vectorFill !== 'none'));
  assert.equal(painted.length, 1, 'the unknown-pattern shape carries no colour');
  assert.equal(painted[0].fill, '#ff0000');
});

test('a self-referential tiling pattern terminates instead of recursing forever', () => {
  const { nodes, warns } = pageW('/P1 scn 40 200 120 60 re f', {
    patterns: { P1: { flat: '#404040', tiling: tiling('/P1 scn 0 0 100 100 re f') } },
  });
  assert.equal(nodes.length, 1);
  assert.ok(warns.length >= 1 && warns.every((w) => w.startsWith('pattern.')), JSON.stringify(warns));
});

test('one pattern named on many shapes collapses once and paints all of them', () => {
  const body = Array.from({ length: 8 }, (_, i) => `/P1 scn ${i * 20} 200 15 60 re f`).join(' ');
  const { nodes, warns } = pageW(body, {
    patterns: { P1: { tiling: tiling('/P5 scn 0 0 100 100 re f', { resources: { patterns: { P5: { flat: '#ff8800' } } } }) } },
  });
  assert.equal(nodes.length, 8);
  assert.ok(nodes.every((n) => n.fill === '#ff8800'), JSON.stringify(nodes.map((n) => n.fill)));
  assert.equal(warns.length, 8, 'reported per use, memoised per pattern');
});

test('a tile body containing a form XObject does not leak nodes onto the page', () => {
  // The collapse pre-pass runs into its OWN sink; a nested run that fell back to
  // the page sink would paint the tile's contents at pattern-space coordinates.
  const form = { kind: 'form' as const, content: '0 1 0 rg 0 0 20 20 re f 0 0 1 rg 30 0 20 20 re f' };
  const { nodes } = pageW('/P1 scn 40 200 120 60 re f', {
    patterns: { P1: { tiling: tiling('/Fm0 Do', { resources: { xobjects: { Fm0: form } } }) } },
  });
  assert.equal(nodes.length, 1, `expected only the painted rect, got ${JSON.stringify(nodes.map((n) => [n.x, n.y, n.fill]))}`);
  assert.equal(nodes[0].fill, '#008080', 'the tile averaged to its two children');
});

test('a stroke pattern falls back to the pattern’s flat colour', () => {
  const nodes = page('/P1 SCN 2 w 10 10 m 100 10 l S', { patterns: { P1: { flat: '#ff8800' } } });
  assert.equal(nodes[0]._vectorStroke?.color, '#ff8800');
});

// ── `sh` with a function-based shading ────────────────────────────────────────
test('`sh` composes the shading’s own /Matrix and keeps its flat back-stop', () => {
  const S1 = {
    type: 1 as const, coords: [], stops: [], extend: [false, false] as [boolean, boolean],
    domain: [0, 1, 0, 1] as [number, number, number, number],
    shadingMatrix: [2, 0, 0, 2, 10, 20], tileKey: 'shd0', flat: '#abcdef',
  };
  const nodes = page('q 40 200 120 60 re W n /S1 sh Q', { shadings: { S1 } });
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].fill, '#abcdef');
  assert.equal(nodes[0]._gradient.tileKey, 'shd0');
  assert.deepEqual(nodes[0]._gradient.matrix, [2, 0, 0, -2, 10, 280]);
});

test('`sh` naming a shading we could not decode is reported, not silently dropped', () => {
  const { nodes, warns } = pageW('q 40 200 120 60 re W n /SX sh Q');
  assert.deepEqual(nodes, []);
  assert.deepEqual(warns, ['shading.unsupported|SX']);
});

// ── robustness: malformed / empty input never throws ──────────────────────────
test('empty and garbage content produce no nodes without throwing', () => {
  assert.deepEqual(page(''), []);
  assert.deepEqual(page('   \n  '), []);
  assert.doesNotThrow(() => page('q q q 1 2 cm ( unterminated'));
  assert.doesNotThrow(() => page('BT /F1 10 Tf'));   // BT with no ET
});

// ── ExtGState: alpha unchanged, and the four-state /SMask field ────────────────

test('ExtGState ca/CA still set fill/stroke alpha with the widened smask field', () => {
  const nodes = page('0 0 1 rg 1 0 0 RG /GA gs 10 10 50 50 re B', {
    extgstates: { GA: { ca: 0.5, CA: 0.25 } },
  });
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].opacity, 50);   // `B` fills, so the FILL alpha wins
});

test('/SMask /None clears the mask; an ExtGState with no /SMask key leaves it alone', () => {
  // §8.4.5: an ExtGState changes only the parameters it lists. Getting this wrong is
  // what made the first soft-mask attempt a silent no-op.
  const sm = { id: 'sm0', subtype: 'Luminosity' as const, content: '0.5 g 0 0 100 100 re f', resources: {}, bbox: [0, 0, 100, 100] };
  // GN = /SMask /None (false); GX lists only /ca, so the mask must survive it.
  const { nodes } = pageW('0 0 0 rg /G7 gs /GX gs 10 10 50 50 re f  0 0 0 rg /GN gs 80 10 50 50 re f', {
    extgstates: { G7: { smask: sm }, GX: { ca: 1 }, GN: { smask: false } },
  });
  assert.equal(nodes.length, 2);
  // First fill: still masked (folded to a constant — 0.5 grey → 50%).
  assert.equal(nodes[0].opacity, 50);
  // Second fill: /SMask /None cleared it, so full strength and no mask.
  assert.equal(nodes[1].opacity, 100);
  assert.equal(nodes[1]._softMask, undefined);
});
