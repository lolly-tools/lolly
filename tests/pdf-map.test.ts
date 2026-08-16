// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the pure PDF/.ai content-stream interpreter (engine/src/pdf-map.ts).
 *
 * The shell decodes a page's content stream with pdf-lib and hands the string here;
 * these tests feed hand-written content streams directly (no PDF library) and assert
 * the reconstructed DesignNodes - proving rectangles, ellipses, text, arbitrary paths,
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
  // pdf-lib's drawRectangle traces the vertical edge first - must still be rot 0
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

test('multi-line text records the document\'s real leading as lineHeight', () => {
  // 20pt font, 30pt line advance → lineHeight 1.5, and the box height uses it.
  const c = 'BT /F1 20 Tf 24 TL 1 0 0 1 40 200 Tm (Line one) Tj 0 -30 Td (Line two) Tj ET';
  const nodes = page(c);
  assert.equal(nodes.length, 1);
  assert.ok(near(nodes[0].lineHeight, 1.5, 0.01), `lineHeight ${nodes[0].lineHeight}`);
  assert.ok(near(nodes[0].h, 20 * 1.5 * 2), `h ${nodes[0].h}`);
});

test('one BT block with column-sized pen moves splits into separate nodes at true origins', () => {
  // The Penpot/TeX construct: one BT…ET writing a left column, then jumping UP
  // and RIGHT to a second column, with a leading (40pt at 12pt type) no fixed
  // line grid can reproduce. Merging this into one node collapsed whole pages.
  const c = 'BT /F1 12 Tf'
    + ' 1 0 0 1 40 260 Tm (Left one) Tj'
    + ' 1 0 0 1 40 220 Tm (Left two) Tj'
    + ' 1 0 0 1 220 260 Tm (Right one) Tj'
    + ' 1 0 0 1 220 220 Tm (Right two) Tj ET';
  const nodes = page(c);
  assert.equal(nodes.length, 4, `expected 4 runs, got ${nodes.length}: ${nodes.map((n: any) => JSON.stringify(n.text)).join(', ')}`);
  const at = (text: string) => nodes.find((n: any) => n.text === text);
  for (const [text, x, baseline] of [['Left one', 40, 40], ['Left two', 40, 80], ['Right one', 220, 40], ['Right two', 220, 80]] as const) {
    const n = at(text);
    assert.ok(n, `missing run ${text}`);
    assert.ok(near(n.x, x), `${text} x ${n.x}`);
    assert.ok(near(n.y, baseline - 12 * 0.8, 1), `${text} y ${n.y}`);
  }
});

test('a same-baseline tab jump starts a new node at the jump target', () => {
  // A TOC-style row: label, then a pen move several ems right on the SAME
  // baseline. Concatenating it re-typeset the right cell under the label.
  const c = 'BT /F1 12 Tf 1 0 0 1 20 260 Tm (Label) Tj 1 0 0 1 200 260 Tm (Value) Tj ET';
  const nodes = page(c);
  assert.equal(nodes.length, 2);
  assert.equal(nodes[0].text, 'Label');
  assert.equal(nodes[1].text, 'Value');
  assert.ok(near(nodes[1].x, 200), `value x ${nodes[1].x}`);
});

test('positioning before the first show re-latches the origin (Chromium word idiom)', () => {
  // Chromium prints every word as its own BT block: `1 0 0 -1 0 0 Tm` (a flip
  // set-up at the LINE BOX's top-left) then `x -leading Td` to the true glyph
  // origin, then per-glyph `dx 0 Td (g) Tj`. The origin must latch where glyphs
  // are SHOWN: latching at the first positioning op gave every line-start word
  // the stale Tm origin - one leading too high, at the block's x=0 - and the
  // next word (|dx| ≤ 2em) collided at the same point.
  const c = '1 0 0 -1 0 300 cm'
    + ' BT /F1 16 Tf 1 0 0 -1 0 0 Tm 10 -18 Td (F) Tj 8 0 Td (irst) Tj ET'
    + ' BT /F1 16 Tf 1 0 0 -1 0 0 Tm 38 -18 Td (word) Tj ET';
  const nodes = page(c);
  assert.equal(nodes.length, 2, nodes.map((n: any) => JSON.stringify(n.text)).join(', '));
  assert.equal(nodes[0].text, 'First');
  assert.equal(nodes[1].text, 'word');
  // Baseline 18 from the page top (outer cm makes box space = stream space).
  assert.ok(near(nodes[0].x, 10), `First x ${nodes[0].x}`);
  assert.ok(near(nodes[0].y, 18 - 16 * 0.8, 1), `First y ${nodes[0].y}`);
  assert.ok(near(nodes[1].x, 38), `word x ${nodes[1].x}`);
  assert.ok(near(nodes[1].y, 18 - 16 * 0.8, 1), `word y ${nodes[1].y}`);
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

// ── BDC property dictionaries (marked content) ───────────────────────────────
// The tokenizer used to report an inline `<<…>>` operand as `{t:'op'}`. That fell
// through the operator switch to `default`, which calls reset() and wiped the
// pending `/OC /Name` - so a BDC carrying ANY property dict silently lost its
// layer name. These pin the fix and the MCID capture built on top of it.

/** Two rects inside one BDC, so the >=2-member rule makes a real group. */
const BDC_BODY = ' 0 0 1 rg 10 10 50 20 re f 10 40 50 20 re f EMC';
const withOcg = (content: string): any[] =>
  interpretPdfPage({ content, width: 400, height: 300, ocgs: { MC0: 'LayerOne' } }) as any[];

test('an OCG layer name survives a BDC that also carries a property dictionary', () => {
  // Regression: `/OC /MC0 BDC` worked, `/OC /MC0 <</MCID 0>> BDC` returned undefined.
  const plain = withOcg('/OC /MC0 BDC' + BDC_BODY);
  const dicted = withOcg('/OC /MC0 <</MCID 0>> BDC' + BDC_BODY);
  assert.deepEqual(plain.map((n) => n.group), ['LayerOne', 'LayerOne']);
  assert.deepEqual(dicted.map((n) => n.group), ['LayerOne', 'LayerOne']);
});

test('a >> inside an /ActualText string does not close the dictionary early', () => {
  // The depth counter was not string-aware, so the literal's ">>" ended the dict
  // and the remainder was mis-tokenized as operators. Tagged PDFs write exactly
  // this key, so it is the common case, not a contrived one.
  const nodes = withOcg('/OC /MC0 <</ActualText (a >> b)>> BDC' + BDC_BODY);
  assert.deepEqual(nodes.map((n) => n.group), ['LayerOne', 'LayerOne']);
});

test('a nested dictionary and a hex string inside a property list are consumed whole', () => {
  const nodes = withOcg('/OC /MC0 <</A <</B (x)>> /C <DEADBE>>> BDC' + BDC_BODY);
  assert.deepEqual(nodes.map((n) => n.group), ['LayerOne', 'LayerOne']);
});

test('a text run inside /P <</MCID n>> BDC carries that mcid', () => {
  const nodes = page('/P <</MCID 3>> BDC BT /F1 12 Tf 1 0 0 1 5 250 Tm (hi) Tj ET EMC');
  assert.equal(nodes[0].text, 'hi');
  assert.equal(nodes[0].mcid, 3);
});

test('untagged text carries no mcid at all', () => {
  const nodes = page('BT /F1 12 Tf 1 0 0 1 5 250 Tm (plain) Tj ET');
  assert.equal(nodes[0].mcid, undefined);
});

test('nested marked content latches the INNERMOST mcid, and EMC unwinds it', () => {
  const nodes = page(
    '/Sect <</MCID 1>> BDC BT /F1 12 Tf 1 0 0 1 5 250 Tm (outer) Tj ET '
    + '/P <</MCID 2>> BDC BT /F1 12 Tf 1 0 0 1 5 200 Tm (inner) Tj ET EMC '
    + 'BT /F1 12 Tf 1 0 0 1 5 150 Tm (after) Tj ET EMC');
  assert.deepEqual(nodes.map((n: any) => [n.text, n.mcid]), [['outer', 1], ['inner', 2], ['after', 1]]);
});

test('a BMC with no dictionary leaves the mcid unset without unbalancing the stack', () => {
  const nodes = page(
    '/Tx BMC BT /F1 12 Tf 1 0 0 1 5 250 Tm (a) Tj ET EMC '
    + '/P <</MCID 9>> BDC BT /F1 12 Tf 1 0 0 1 5 200 Tm (b) Tj ET EMC');
  assert.deepEqual(nodes.map((n: any) => [n.text, n.mcid]), [['a', undefined], ['b', 9]]);
});

// ── WinAnsi (CP1252) fallback decoding ────────────────────────────────────────
// A simple font with no /ToUnicode falls back to byte→code-point, which is
// Latin-1. That is right everywhere EXCEPT 0x80-0x9F, where CP1252 keeps the
// punctuation English publishing actually uses and Latin-1 keeps C1 controls.
test('WinAnsi high bytes decode to punctuation, not C1 control characters', () => {
  // 0x95 bullet, 0x92 right single quote, 0x96 en dash, 0x97 em dash, 0x85 ellipsis.
  const nodes = page('BT /F1 12 Tf 1 0 0 1 5 250 Tm (\x95 it\x92s \x96 a \x97 test\x85) Tj ET', {
    fonts: { F1: { family: 'Helvetica', weight: 400 } },
  });
  assert.equal(nodes[0].text, '\u2022 it\u2019s \u2013 a \u2014 test\u2026');
});

test('bytes outside the CP1252 divergence keep their Latin-1 meaning', () => {
  // 0xE9 is e-acute in BOTH encodings - the table must not touch it, and the
  // unassigned CP1252 slots (0x81, 0x8D, 0x8F, 0x90, 0x9D) must pass through
  // rather than inventing a character.
  const nodes = page('BT /F1 12 Tf 1 0 0 1 5 250 Tm (caf\xe9) Tj ET', {
    fonts: { F1: { family: 'Helvetica', weight: 400 } },
  });
  assert.equal(nodes[0].text, 'caf\u00e9');

  const unassigned = page('BT /F1 12 Tf 1 0 0 1 5 250 Tm (a\x81b) Tj ET', {
    fonts: { F1: { family: 'Helvetica', weight: 400 } },
  });
  assert.equal(unassigned[0].text, 'a\u0081b');
});

test('an explicit font decoder still wins over the WinAnsi fallback', () => {
  // ToUnicode is authoritative; the table is only a fallback for fonts without one.
  const nodes = page('BT /F1 12 Tf 1 0 0 1 5 250 Tm (\x95) Tj ET', {
    fonts: { F1: { decode: () => 'X', family: 'Helvetica', weight: 400 } },
  });
  assert.equal(nodes[0].text, 'X');
});

// ── a font decoder from the shell is honoured ─────────────────────────────────
test('font decode callback maps custom byte codes', () => {
  const decode = (codes: number[]) => codes.map((c) => String.fromCharCode(c + 1)).join('');
  const nodes = page('BT /F1 12 Tf 1 0 0 1 5 250 Tm (Gdkkn) Tj ET', {
    fonts: { F1: { decode, family: 'Courier', weight: 700 } },
  });
  assert.equal(nodes[0].text, 'Hello');
  // monospace family → the box maps to the neutral mono family via finalizeBoxes
  // (a branded shell passes its own vocabulary - see design-map DesignMapOptions)
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
  assert.equal(nodes[0].fill, '');       // flat fill cleared - the gradient wins
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
  // section 8.4.5: an ExtGState changes only the parameters it lists. Getting this wrong is
  // what made the first soft-mask attempt a silent no-op.
  const sm = { id: 'sm0', subtype: 'Luminosity' as const, content: '0.5 g 0 0 100 100 re f', resources: {}, bbox: [0, 0, 100, 100] };
  // GN = /SMask /None (false); GX lists only /ca, so the mask must survive it.
  const { nodes } = pageW('0 0 0 rg /G7 gs /GX gs 10 10 50 50 re f  0 0 0 rg /GN gs 80 10 50 50 re f', {
    extgstates: { G7: { smask: sm }, GX: { ca: 1 }, GN: { smask: false } },
  });
  assert.equal(nodes.length, 2);
  // First fill: still masked (folded to a constant - 0.5 grey → 50%).
  assert.equal(nodes[0].opacity, 50);
  // Second fill: /SMask /None cleared it, so full strength and no mask.
  assert.equal(nodes[1].opacity, 100);
  assert.equal(nodes[1]._softMask, undefined);
});

// ── Path closure is EXPLICIT, never assumed ──────────────────────────────────
// serializePath used to append 'Z' to every path it emitted. On a FILL that is
// invisible (SVG closes subpaths implicitly when filling), but on a STROKE it
// draws an edge the source never had: an open 3-point chevron `M7 8 L3 12 L7 16`
// - the arrowhead in every outline icon - came out as a filled-looking triangle.
// Reported from a screenshot of the export panel's ↔ / ↕ dimension icons.
//
// PDF says which paths close: `h`, `re`, and the close-then-paint operators
// `s`/`b`/`b*` (section 8.5.2.1, section 8.5.3.1). `S`/`B`/`B*` leave the path open.
const dOf = (nodes: any[]): string => nodes.map((n) => n._vectorPath || '').join(' ');

test('an open stroked path stays open (S does not close)', () => {
  const d = dOf(page('1 0 0 RG 2 w 7 8 m 3 12 l 7 16 l S'));
  assert.ok(d.includes('M'), `no path emitted: ${d}`);
  assert.ok(!d.includes('Z'), `S must not close the subpath — got ${d}`);
});

test('s closes the path it strokes', () => {
  const d = dOf(page('1 0 0 RG 2 w 7 8 m 3 12 l 7 16 l s'));
  assert.ok(d.includes('Z'), `s is close-and-stroke — got ${d}`);
});

test('an explicit h closes, and only the subpath it ends', () => {
  const one = dOf(page('1 0 0 RG 2 w 10 10 m 40 10 l 40 40 l h S'));
  assert.equal((one.match(/Z/g) ?? []).length, 1, `one closed subpath expected — got ${one}`);
  // first subpath closed, second left open
  const two = dOf(page('1 0 0 RG 2 w 10 10 m 40 10 l 40 40 l h 60 60 m 90 60 l 90 90 l S'));
  assert.equal((two.match(/Z/g) ?? []).length, 1, `only the h-terminated subpath closes — got ${two}`);
  assert.ok(two.indexOf('Z') < two.lastIndexOf('M'), `the Z must land on the FIRST subpath — got ${two}`);
});

test('b and b* close as well as painting both', () => {
  for (const op of ['b', 'b*']) {
    const d = dOf(page(`1 0 0 RG 0 0 1 rg 2 w 7 8 m 3 12 l 7 16 l ${op}`));
    assert.ok(d.includes('Z'), `${op} is a close-then-paint operator — got ${d}`);
  }
});

test('a rectangle is a closed subpath, and still takes the rect fast path', () => {
  // `re` is closed by definition. It should also still be recognised as a box
  // node rather than demoted to a vector path by the close marker.
  const nodes = page('0 0 1 rg 10 10 100 50 re f');
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].shape, 'rect', `re must still be detected as a rect: ${JSON.stringify(nodes[0])}`);
});

test('a filled open path is unaffected (fill closes implicitly)', () => {
  const nodes = page('0 0 1 rg 7 8 m 3 12 l 7 16 l f');
  assert.equal(nodes.length, 1, 'the fill still paints');
});

// ── Line cap and join (section 8.4.3.3-4) ───────────────────────────────────────────
// PDF defaults are butt + miter, which match SVG's defaults - so this stayed
// invisible until a producer set them. Chromium never does: its print output has
// zero `J`/`j`/`w` operators and leans entirely on the defaults. Illustrator and
// Acrobat DO, and a round-capped stroke rendered with butt caps reads thinner and
// ends square, while a mitered corner on artwork drawn with round joins grows a spike.
test('line cap and join are carried onto the stroke', () => {
  const round = page('1 0 0 RG 2 w 1 J 1 j 10 10 m 40 10 l 40 40 l S');
  assert.equal(round[0]?._vectorStroke?.cap, 'round');
  assert.equal(round[0]?._vectorStroke?.join, 'round');
  const sq = page('1 0 0 RG 2 w 2 J 2 j 10 10 m 40 10 l 40 40 l S');
  assert.equal(sq[0]?._vectorStroke?.cap, 'square');
  assert.equal(sq[0]?._vectorStroke?.join, 'bevel');
});

test('the PDF defaults (butt/miter) are left off the node, matching SVG', () => {
  // Emitting stroke-linecap="butt" on every stroke would be noise - it is already
  // SVG's default. Absent means default, in both formats.
  const dflt = page('1 0 0 RG 2 w 10 10 m 40 10 l 40 40 l S');
  assert.equal(dflt[0]?._vectorStroke?.cap, undefined);
  assert.equal(dflt[0]?._vectorStroke?.join, undefined);
  const explicit = page('1 0 0 RG 2 w 0 J 0 j 10 10 m 40 10 l 40 40 l S');
  assert.equal(explicit[0]?._vectorStroke?.cap, undefined);
});

test('cap and join survive q/Q like the rest of the graphics state', () => {
  const n = page('1 0 0 RG 2 w 1 J q 2 J 5 5 m 20 5 l S Q 10 10 m 40 10 l S');
  assert.equal(n[0]?._vectorStroke?.cap, 'square', 'inside q');
  assert.equal(n[1]?._vectorStroke?.cap, 'round', 'restored after Q');
});
