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

// ── robustness: malformed / empty input never throws ──────────────────────────
test('empty and garbage content produce no nodes without throwing', () => {
  assert.deepEqual(page(''), []);
  assert.deepEqual(page('   \n  '), []);
  assert.doesNotThrow(() => page('q q q 1 2 cm ( unterminated'));
  assert.doesNotThrow(() => page('BT /F1 10 Tf'));   // BT with no ET
});
