// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the pure design-file → boxes mapper (engine/src/design-map.js).
 *
 * The web shell walks a sanitized Figma/Penpot/SVG DOM into normalized DesignNodes;
 * this module (DOM-free) turns those into Layout Studio box rows. These cover the
 * matrix maths, the font/weight/align remaps (neutral defaults + shell-supplied
 * brand vocabulary via DesignMapOptions), box defaulting, id/degenerate handling
 * and the Penpot content flattener end to end.
 *
 * Run with: node --test tests/design-map.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  decomposeMatrix, boxGeomFromBBox, mapWeight, mapFontFamily, mapAlign,
  safeColor, nodeToBox, finalizeBoxes, parsePenpotContent, collectPenpotFontUsage, penpotShapeToNode,
  figmaNodesToNodes, figmaNodesToScenes, readingOrder, colorRunsToText, decodeFigVectorPath, penpotGradientToSpec,
  penpotPathContentToD, penpotGradientSvgDef, penpotGroupToSvg,
  penpotFlowOrder, penpotAnimationToTransition,
} from '../engine/src/design-map.ts';

const close = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;

// The SUSE profile's vocabulary, as its web shell threads it in (from the SUSE
// design manifest's font select + addKinds seeds) — the engine itself no
// longer knows these names.
const SUSE_FONTS = { defaultFamily: 'SUSE', monoFamily: 'SUSE Mono', monoMaxWeight: 800 };
const SUSE_SEEDS = { boxBg: '#30BA78', textFg: '#0c322c', imageBg: '#eef1f0' };

// ── decomposeMatrix ──────────────────────────────────────────────────────────
test('decomposeMatrix: identity', () => {
  const d = decomposeMatrix({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
  assert.ok(close(d.rot, 0));
  assert.ok(close(d.sx, 1));
  assert.ok(close(d.sy, 1));
  assert.equal(d.tx, 0);
  assert.equal(d.ty, 0);
});

test('decomposeMatrix: rotate 90°', () => {
  // SVG rotate(90) = matrix(cos90, sin90, -sin90, cos90, 0, 0) = (0,1,-1,0,0,0)
  const d = decomposeMatrix({ a: 0, b: 1, c: -1, d: 0, e: 0, f: 0 });
  assert.ok(close(d.rot, 90));
  assert.ok(close(d.sx, 1));
  assert.ok(close(d.sy, 1));
});

test('decomposeMatrix: scale 2× (with translation)', () => {
  const d = decomposeMatrix({ a: 2, b: 0, c: 0, d: 2, e: 12, f: -8 });
  assert.ok(close(d.rot, 0));
  assert.ok(close(d.sx, 2));
  assert.ok(close(d.sy, 2));
  assert.equal(d.tx, 12);
  assert.equal(d.ty, -8);
});

test('decomposeMatrix: sx===0 guard falls back to hypot(c,d)', () => {
  const d = decomposeMatrix({ a: 0, b: 0, c: 0, d: 3, e: 0, f: 0 });
  assert.ok(close(d.sx, 0));
  assert.ok(close(d.sy, 3));
});

// ── boxGeomFromBBox ──────────────────────────────────────────────────────────
test('boxGeomFromBBox: plain rect under identity is unchanged', () => {
  const g = boxGeomFromBBox({ x: 10, y: 20, width: 100, height: 40 },
    { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
  assert.ok(close(g.x, 10));
  assert.ok(close(g.y, 20));
  assert.ok(close(g.w, 100));
  assert.ok(close(g.h, 40));
  assert.ok(close(g.rot, 0));
});

test('boxGeomFromBBox: rect scaled 2× about identity keeps top-left origin', () => {
  const g = boxGeomFromBBox({ x: 0, y: 0, width: 50, height: 30 },
    { a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 });
  assert.ok(close(g.w, 100));
  assert.ok(close(g.h, 60));
  // centre local (25,15) → world (50,30); top-left = centre - size/2
  assert.ok(close(g.x, 0));
  assert.ok(close(g.y, 0));
});

test('boxGeomFromBBox: 90°-rotated rect gives an unrotated w×h + rot about centre', () => {
  const g = boxGeomFromBBox({ x: 0, y: 0, width: 100, height: 40 },
    { a: 0, b: 1, c: -1, d: 0, e: 0, f: 0 });
  assert.ok(close(g.w, 100));
  assert.ok(close(g.h, 40));
  assert.ok(close(g.rot, 90));
  // local centre (50,20) → world (-20,50); top-left = centre - (w/2,h/2)
  assert.ok(close(g.x + g.w / 2, -20));
  assert.ok(close(g.y + g.h / 2, 50));
});

// ── mapWeight ────────────────────────────────────────────────────────────────
test('mapWeight: rounds to nearest 100 and clamps 100..900', () => {
  assert.equal(mapWeight(450, 'sans'), '500'); // .5 rounds up
  assert.equal(mapWeight(430, 'sans'), '400');
  assert.equal(mapWeight(20, 'sans'), '100');  // clamps up to 100
  assert.equal(mapWeight(1000, 'sans'), '900'); // clamps down to 900
  assert.equal(mapWeight('700', 'sans'), '700'); // numeric string
  assert.equal(mapWeight(undefined, 'sans'), '700'); // default weight
});

test('mapWeight: the mono family caps at monoMaxWeight (default 800)', () => {
  assert.equal(mapWeight(900, 'mono'), '800');
  assert.equal(mapWeight(850, 'mono'), '800'); // 850 → 900 → capped 800
  assert.equal(mapWeight(800, 'mono'), '800');
  assert.equal(mapWeight(400, 'mono'), '400'); // below cap untouched
  assert.equal(mapWeight(900, 'sans'), '900'); // sans keeps Black
});

test('mapWeight: honours a shell-supplied vocabulary (SUSE + custom cap)', () => {
  assert.equal(mapWeight(900, 'SUSE Mono', SUSE_FONTS), '800');
  assert.equal(mapWeight(900, 'SUSE', SUSE_FONTS), '900'); // sans keeps Black
  assert.equal(mapWeight(900, 'mono', SUSE_FONTS), '900'); // only the DECLARED mono family caps
  // custom monoMaxWeight applies to the custom mono family only
  const custom = { defaultFamily: 'Inter', monoFamily: 'JetBrains Mono', monoMaxWeight: 700 };
  assert.equal(mapWeight(900, 'JetBrains Mono', custom), '700');
  assert.equal(mapWeight(900, 'Inter', custom), '900');
});

// ── mapFontFamily ────────────────────────────────────────────────────────────
test('mapFontFamily: monospace names → mono, else sans (neutral defaults)', () => {
  assert.equal(mapFontFamily('Courier New'), 'mono');
  assert.equal(mapFontFamily('Menlo'), 'mono');
  assert.equal(mapFontFamily('Fira Code'), 'mono');
  assert.equal(mapFontFamily('Roboto Mono'), 'mono');
  assert.equal(mapFontFamily('SF Mono, Consolas'), 'mono');
  assert.equal(mapFontFamily('Helvetica Neue'), 'sans');
  assert.equal(mapFontFamily('Inter'), 'sans');
  assert.equal(mapFontFamily(''), 'sans');
  assert.equal(mapFontFamily(undefined), 'sans');
});

test('mapFontFamily: honours a shell-supplied vocabulary', () => {
  assert.equal(mapFontFamily('Courier New', SUSE_FONTS), 'SUSE Mono');
  assert.equal(mapFontFamily('Helvetica Neue', SUSE_FONTS), 'SUSE');
  const custom = { defaultFamily: 'Inter', monoFamily: 'JetBrains Mono' };
  assert.equal(mapFontFamily('Menlo', custom), 'JetBrains Mono');
  assert.equal(mapFontFamily('Georgia', custom), 'Inter');
});

test('mapFontFamily: a knownFamilies hit passes through with canonical casing', () => {
  const fonts = { knownFamilies: ['Work Sans'] };
  assert.equal(mapFontFamily('Work Sans', fonts), 'Work Sans');
  assert.equal(mapFontFamily('work sans', fonts), 'Work Sans');   // case-insensitive match
  assert.equal(mapFontFamily('WORK SANS', fonts), 'Work Sans');   // canonical casing wins
  assert.equal(mapFontFamily('  Work Sans  ', fonts), 'Work Sans'); // trimmed before matching
});

test('mapFontFamily: a knownFamilies hit beats the mono regex', () => {
  const fonts = { knownFamilies: ['Spline Sans Mono'] };
  assert.equal(mapFontFamily('Spline Sans Mono', fonts), 'Spline Sans Mono');
  assert.equal(mapFontFamily('spline sans mono', fonts), 'Spline Sans Mono');
  // a mono name NOT in the list still buckets normally
  assert.equal(mapFontFamily('Menlo', fonts), 'mono');
});

test('mapFontFamily: no knownFamilies hit falls to the existing buckets (both vocabularies)', () => {
  const neutral = { knownFamilies: ['Work Sans'] };
  assert.equal(mapFontFamily('sourcesanspro', neutral), 'sans');
  assert.equal(mapFontFamily('Roboto Mono', neutral), 'mono');
  const suse = { ...SUSE_FONTS, knownFamilies: ['Work Sans'] };
  assert.equal(mapFontFamily('work sans', suse), 'Work Sans');
  assert.equal(mapFontFamily('Georgia', suse), 'SUSE');
  assert.equal(mapFontFamily('Menlo', suse), 'SUSE Mono');
});

// ── mapAlign ─────────────────────────────────────────────────────────────────
test('mapAlign: normalizes onto left|center|right', () => {
  assert.equal(mapAlign('center'), 'center');
  assert.equal(mapAlign('centre'), 'center');
  assert.equal(mapAlign('middle'), 'center');
  assert.equal(mapAlign('right'), 'right');
  assert.equal(mapAlign('end'), 'right');
  assert.equal(mapAlign('left'), 'left');
  assert.equal(mapAlign('start'), 'left');
  assert.equal(mapAlign('justify'), 'left');
  assert.equal(mapAlign(undefined), 'left');
});

// ── safeColor ────────────────────────────────────────────────────────────────
test('safeColor: passes valid colours, falls back on junk', () => {
  assert.equal(safeColor('#30BA78', 'x'), '#30BA78');
  assert.equal(safeColor('rgb(1,2,3)', 'x'), 'rgb(1,2,3)');
  assert.equal(safeColor('rgba(1,2,3,0.5)', 'x'), 'rgba(1,2,3,0.5)');
  assert.equal(safeColor('tomato', 'x'), 'tomato');
  assert.equal(safeColor('', 'fb'), 'fb');
  assert.equal(safeColor('red; width:9999px', 'fb'), 'fb'); // injection blocked
  assert.equal(safeColor(null, 'fb'), 'fb');
});

// ── nodeToBox ────────────────────────────────────────────────────────────────
test('nodeToBox: box kind defaults (seed fill, plain rect, full field set)', () => {
  const b = nodeToBox({ kind: 'box', x: 10.4, y: 20.6, w: 100, h: 40 }, { id: 'n0' });
  assert.equal(b.id, 'n0');
  assert.equal(b.kind, 'box');
  assert.equal(b.x, 10);
  assert.equal(b.y, 21);
  assert.equal(b.w, 100);
  assert.equal(b.h, 40);
  assert.equal(b.rot, 0);
  assert.equal(b.shape, 'rect');   // no radius → plain rect (fidelity, not seed 'rounded')
  assert.equal(b.radius, 0);
  assert.equal(b.bg, '#4f84ba');   // neutral seed default when fill absent
  assert.equal(b.opacity, 100);
  assert.equal(b.image, null);
  assert.equal(b.blend, 'normal');
  assert.equal(b.valign, 'middle');
  assert.equal(b.weight, '700');
  assert.equal(b.font, 'sans');
  assert.equal(b.clip, '');
  assert.equal(b.shadow, 'none');
  assert.equal(b.shadowColor, '#00000055');
  assert.equal(b.shadowBlur, 10);
});

test('nodeToBox: box honours an explicit fill, incl. "" = none, and clamps', () => {
  assert.equal(nodeToBox({ kind: 'box', fill: '#ff0000', w: 5, h: 5 }, { id: 'a' }).bg, '#ff0000');
  assert.equal(nodeToBox({ kind: 'box', fill: '', w: 5, h: 5 }, { id: 'a' }).bg, '');
  assert.equal(nodeToBox({ kind: 'box', fill: 'evil; x:1', w: 5, h: 5 }, { id: 'a' }).bg, '');
  const c = nodeToBox({ kind: 'box', w: 0, h: -3, opacity: 240 }, { id: 'a' });
  assert.equal(c.w, 1);        // clamped >= 1
  assert.equal(c.h, 1);
  assert.equal(c.opacity, 100); // clamped 0..100
});

test('nodeToBox: rounded shape derived from radius > 0', () => {
  const b = nodeToBox({ kind: 'box', radius: 12, w: 40, h: 40 }, { id: 'a' });
  assert.equal(b.shape, 'rounded');
  assert.equal(b.radius, 12);
  const e = nodeToBox({ kind: 'box', shape: 'ellipse', w: 40, h: 40 }, { id: 'a' });
  assert.equal(e.shape, 'ellipse');
});

test('nodeToBox: text kind maps font/weight/align/colour and text defaults', () => {
  const b = nodeToBox({
    kind: 'text', x: 0, y: 0, w: 300, h: 80,
    text: 'Hello\nworld', fg: '#123456', fontSize: 33.7,
    fontWeight: 850, fontFamily: 'Courier New', textAlign: 'centre', lineHeight: 1.4,
  }, { id: 't1' });
  assert.equal(b.kind, 'text');
  assert.equal(b.text, 'Hello\nworld');
  assert.equal(b.fg, '#123456');
  assert.equal(b.fontSize, 34);         // rounded
  assert.equal(b.font, 'mono');         // monospace remap (neutral vocabulary)
  assert.equal(b.weight, '800');        // 850→900 capped to 800 for mono
  assert.equal(b.align, 'center');      // 'centre' normalized
  assert.equal(b.valign, 'top');        // text seed valign
  assert.equal(b.lineHeight, 1.4);
  assert.equal(b.bg, ''); // text seed bg is transparent when no fill supplied
});

test('nodeToBox: text kind defaults when only kind given', () => {
  const b = nodeToBox({ kind: 'text', w: 200, h: 50 }, { id: 't0' });
  assert.equal(b.text, '');
  assert.equal(b.fg, '#0e1217');   // neutral seed text colour fallback
  assert.equal(b.fontSize, 64);    // text seed size
  assert.equal(b.font, 'sans');
  assert.equal(b.weight, '700');
  assert.equal(b.align, 'left');
  assert.equal(b.valign, 'top');
  assert.equal(b.lineHeight, 1.12);
});

test('nodeToBox: a shell-supplied vocabulary round-trips the SUSE mapping', () => {
  const opts = { id: 't1', fonts: SUSE_FONTS, seedColors: SUSE_SEEDS };
  const mono = nodeToBox({ kind: 'text', w: 300, h: 80, fontFamily: 'Courier New', fontWeight: 850 }, opts);
  assert.equal(mono.font, 'SUSE Mono'); // monospace remap onto the SUSE pair
  assert.equal(mono.weight, '800');     // 850→900 capped to 800 for SUSE Mono
  assert.equal(mono.fg, '#0c322c');     // SUSE seed ink fallback
  const sans = nodeToBox({ kind: 'text', w: 300, h: 80, fontFamily: 'Inter', fontWeight: 900 }, opts);
  assert.equal(sans.font, 'SUSE');
  assert.equal(sans.weight, '900');     // sans keeps Black
  const box = nodeToBox({ kind: 'box', w: 10, h: 10 }, opts);
  assert.equal(box.bg, '#30BA78');      // SUSE seed fill
  const img = nodeToBox({ kind: 'image', w: 10, h: 10, image: {} }, opts);
  assert.equal(img.bg, '#eef1f0');      // SUSE image seed backing
});

test('nodeToBox: custom families + seed colours are honoured', () => {
  const opts = {
    id: 'x0',
    fonts: { defaultFamily: 'Inter', monoFamily: 'JetBrains Mono', monoMaxWeight: 700 },
    seedColors: { boxBg: '#123123', textFg: '#454545', imageBg: '' },
  };
  const t = nodeToBox({ kind: 'text', w: 100, h: 20, fontFamily: 'Menlo', fontWeight: 900 }, opts);
  assert.equal(t.font, 'JetBrains Mono');
  assert.equal(t.weight, '700');        // custom mono cap
  assert.equal(t.fg, '#454545');
  assert.equal(nodeToBox({ kind: 'box', w: 5, h: 5 }, opts).bg, '#123123');
  assert.equal(nodeToBox({ kind: 'image', w: 5, h: 5 }, opts).bg, ''); // '' = transparent honoured
});

test('nodeToBox: image kind resolves an asset ref and fit', () => {
  const b = nodeToBox({ kind: 'image', w: 100, h: 100, image: { id: 'user/asset/1' }, fit: 'cover' }, { id: 'i0' });
  assert.equal(b.kind, 'image');
  assert.deepEqual(b.image, { id: 'user/asset/1' });
  assert.equal(b.fit, 'cover');
  assert.equal(b.bg, '#e1e5ea'); // neutral image seed bg when no fill
  // no/invalid image ref → null, fit falls back to seed 'contain'
  const c = nodeToBox({ kind: 'image', w: 100, h: 100, image: {} }, { id: 'i1' });
  assert.equal(c.image, null);
  assert.equal(c.fit, 'contain');
});

// ── finalizeBoxes ────────────────────────────────────────────────────────────
test('finalizeBoxes: assigns unique sequential ids and preserves order', () => {
  const boxes = finalizeBoxes([
    { kind: 'box', w: 10, h: 10, fill: '#111' },
    { kind: 'text', w: 10, h: 10, text: 'a' },
    { kind: 'image', w: 10, h: 10, image: { id: 'x' } },
  ]);
  assert.deepEqual(boxes.map((b) => b.id), ['n0', 'n1', 'n2']);
  assert.deepEqual(boxes.map((b) => b.kind), ['box', 'text', 'image']);
});

test('finalizeBoxes: skips nulls + zero-area points, keeps thin rules and tiny text', () => {
  const boxes = finalizeBoxes([
    null,
    { kind: 'box', w: 0.3, h: 0.3 }, // true point → skipped
    { kind: 'box', w: 0, h: 50 },    // vertical hairline (one dim ≥1) → kept, clamped 1×50
    { kind: 'text', w: 0, h: 0 },    // tiny text → kept
    { kind: 'box', w: 50, h: 50 },   // kept
  ]);
  assert.equal(boxes.length, 3);
  assert.deepEqual(boxes.map((b) => b.id), ['n0', 'n1', 'n2']); // ids stay contiguous
  assert.deepEqual(boxes.map((b) => b.kind), ['box', 'text', 'box']);
  assert.equal(boxes[0]!.w, 1); // hairline clamped
  assert.equal(boxes[0]!.h, 50);
});

test('finalizeBoxes: honours a custom id prefix', () => {
  const boxes = finalizeBoxes([{ kind: 'box', w: 5, h: 5 }], { prefix: 'imp' });
  assert.equal(boxes[0]!.id, 'imp0');
});

test('finalizeBoxes: threads fonts + seedColors into every row', () => {
  const boxes = finalizeBoxes([
    { kind: 'text', w: 10, h: 10, fontFamily: 'Consolas', fontWeight: 900 },
    { kind: 'box', w: 10, h: 10 },
  ], { prefix: 's', fonts: SUSE_FONTS, seedColors: SUSE_SEEDS });
  assert.equal(boxes[0]!.font, 'SUSE Mono');
  assert.equal(boxes[0]!.weight, '800');
  assert.equal(boxes[0]!.fg, '#0c322c');
  assert.equal(boxes[1]!.bg, '#30BA78');
});

// ── parsePenpotContent ───────────────────────────────────────────────────────
test('parsePenpotContent: keyworded (":") keys, multi-paragraph', () => {
  const tree = {
    type: 'root',
    children: [{
      type: 'paragraph-set',
      children: [
        {
          type: 'paragraph', ':text-align': 'center',
          children: [
            { ':text': 'Hello ', ':font-size': '24', ':font-weight': '700', ':fill-color': '#ff0000', ':line-height': '1.3' },
            { ':text': 'world', ':font-size': '24' },
          ],
        },
        { type: 'paragraph', children: [{ ':text': 'second line' }] },
      ],
    }],
  };
  const r = parsePenpotContent(tree);
  assert.equal(r.text, 'Hello world\nsecond line');
  assert.equal(r.fontSize, 24);
  assert.equal(r.fontWeight, 700);
  assert.equal(r.fg, '#ff0000');
  assert.equal(r.textAlign, 'center');
  assert.equal(r.lineHeight, 1.3);
});

test('parsePenpotContent: plain keys + :fills[0].fill-color + JSON string input', () => {
  const tree = {
    type: 'root',
    children: [{
      type: 'paragraph-set',
      children: [{
        type: 'paragraph', 'text-align': 'right',
        children: [
          { text: '', 'font-size': '10' },                 // empty leaf: not the style source
          { text: 'Styled', 'font-size': '18', 'font-weight': '600', fills: [{ 'fill-color': '#00aa00' }], 'line-height': '1.1' },
        ],
      }],
    }],
  };
  const r = parsePenpotContent(JSON.stringify(tree));
  assert.equal(r.text, 'Styled');
  assert.equal(r.fontSize, 18);      // first NON-EMPTY leaf's style
  assert.equal(r.fontWeight, 600);
  assert.equal(r.fg, '#00aa00');     // from fills[0].fill-color
  assert.equal(r.textAlign, 'right');
  assert.equal(r.lineHeight, 1.1);
});

test('parsePenpotContent: bad input returns a safe empty result', () => {
  const empty = { text: '', fontSize: null, fontWeight: null, fontFamily: '', fg: '', textAlign: 'left', lineHeight: null };
  assert.deepEqual(parsePenpotContent('not json'), empty);
  assert.deepEqual(parsePenpotContent(null), empty);
});

// ── parsePenpotContent: binfile-v3 camelCase ─────────────────────────────────
test('parsePenpotContent: camelCase keys (binfile-v3) incl. fontFamily', () => {
  const tree = {
    type: 'root',
    verticalAlign: 'top',
    children: [{
      type: 'paragraph-set',
      children: [{
        type: 'paragraph', textAlign: 'center', fontSize: '48', fontFamily: 'SUSE',
        children: [{
          text: 'SUSE FONT works great!', fontSize: '48', fontWeight: '400',
          fontFamily: 'SUSE', fills: [{ fillColor: '#000000', fillOpacity: 1 }], lineHeight: '1.2',
        }],
      }],
    }],
  };
  const r = parsePenpotContent(tree);
  assert.equal(r.text, 'SUSE FONT works great!');
  assert.equal(r.fontSize, 48);
  assert.equal(r.fontWeight, 400);
  assert.equal(r.fontFamily, 'SUSE');
  assert.equal(r.fg, '#000000');           // from fills[0].fillColor (camelCase)
  assert.equal(r.textAlign, 'center');
  assert.equal(r.lineHeight, 1.2);
});

// ── collectPenpotFontUsage ───────────────────────────────────────────────────
// Penpot writes the full font set on paragraphs AND leaves alike — the walker
// visits every style-carrying node but dedupes by fontId|fontVariantId|fontStyle.

const fontLeaf = (text: string, over: Record<string, unknown> = {}) => ({
  text, fontId: 'gfont-work-sans', fontFamily: 'Work Sans', fontVariantId: '700',
  fontWeight: '700', fontStyle: 'normal', fontSize: '18',
  fills: [{ fillColor: '#111111', fillOpacity: 1 }], ...over,
});
const fontTree = (paragraphs: unknown[]) => ({
  type: 'root', children: [{ type: 'paragraph-set', children: paragraphs }],
});

test('collectPenpotFontUsage: paragraph + leaf carrying the same font dedupe to one entry', () => {
  const tree = fontTree([{
    type: 'paragraph', fontId: 'gfont-work-sans', fontFamily: 'Work Sans',
    fontVariantId: '700', fontWeight: '700', fontStyle: 'normal',
    children: [fontLeaf('Hello')],
  }]);
  const usage = collectPenpotFontUsage(tree);
  assert.equal(usage.length, 1, 'one entry per distinct font');
  assert.equal(usage[0]!.fontId, 'gfont-work-sans');
  assert.equal(usage[0]!.fontFamily, 'Work Sans');
  assert.equal(usage[0]!.fontVariantId, '700');
  assert.equal(usage[0]!.fontStyle, 'normal');
  assert.equal(usage[0]!.runs, 2, 'both style-carrying nodes counted');
});

test('collectPenpotFontUsage: string weights parse to numbers', () => {
  const tree = fontTree([{
    type: 'paragraph',
    children: [fontLeaf('a'), fontLeaf('b', { fontVariantId: 'regular', fontWeight: '400' })],
  }]);
  const usage = collectPenpotFontUsage(tree);
  assert.equal(usage.length, 2, 'distinct variants stay distinct');
  for (const u of usage) assert.equal(typeof u.fontWeight, 'number');
  assert.deepEqual(usage.map((u) => u.fontWeight).sort((a, b) => a - b), [400, 700]);
  assert.equal(usage.find((u) => u.fontVariantId === 'regular')!.runs, 1);
});

test('collectPenpotFontUsage: fractional fontSize strings and gradient fills don\'t break the tally', () => {
  const tree = fontTree([{
    type: 'paragraph',
    children: [fontLeaf('grad', {
      fontSize: '17.5',
      fills: [{ fillColorGradient: { type: 'linear', stops: [{ color: '#ff0000', offset: 0 }, { color: '#0000ff', offset: 1 }] } }],
    })],
  }]);
  const usage = collectPenpotFontUsage(tree);
  assert.equal(usage.length, 1, 'a gradient-filled run still tallies');
  assert.equal(usage[0]!.fontWeight, 700);
  assert.equal(usage[0]!.runs, 1);
});

test('collectPenpotFontUsage: typographyRefId null is ignored, JSON-string input parses', () => {
  const tree = fontTree([{
    type: 'paragraph',
    children: [fontLeaf('x', { typographyRefId: null, typographyRefFile: null })],
  }]);
  const usage = collectPenpotFontUsage(JSON.stringify(tree));
  assert.equal(usage.length, 1);
  assert.equal(usage[0]!.runs, 1);
});

test('collectPenpotFontUsage: bad input returns an empty list', () => {
  assert.deepEqual(collectPenpotFontUsage('not json'), []);
  assert.deepEqual(collectPenpotFontUsage(null), []);
  assert.deepEqual(collectPenpotFontUsage(42), []);
  assert.deepEqual(collectPenpotFontUsage({ type: 'root', children: [] }), []);
});

// ── penpotShapeToNode (binfile-v3 shape JSON) ────────────────────────────────
test('penpotShapeToNode: rect with solid fill → box from selrect', () => {
  const shape = {
    id: 'a', type: 'rect', name: 'Rectangle', rotation: 0, r1: 0,
    x: 447, y: 269, width: 231, height: 191,
    selrect: { x: 447, y: 269, width: 231, height: 191 },
    fills: [{ fillColor: '#2d6000', fillOpacity: 1 }],
  };
  const n = penpotShapeToNode(shape) as any;
  assert.equal(n.kind, 'box');
  assert.deepEqual([n.x, n.y, n.w, n.h], [447, 269, 231, 191]);
  assert.equal(n.fill, '#2d6000');
  assert.equal(n.opacity, 100);
  assert.equal(n.shape, undefined); // plain rect (no radius)
});

test('penpotShapeToNode: rotation + r1 → rot + rounded radius', () => {
  const n = penpotShapeToNode({
    id: 'b', type: 'rect', rotation: 8, r1: 14,
    selrect: { x: 20, y: 20, width: 120, height: 80 },
    fills: [{ fillColor: '#2453FF', fillOpacity: 1 }],
  }) as any;
  assert.equal(n.rot, 8);
  assert.equal(n.shape, 'rounded');
  assert.equal(n.radius, 14);
});

test('penpotShapeToNode: circle → ellipse; opacity folds shape×fill', () => {
  const n = penpotShapeToNode({
    id: 'c', type: 'circle', opacity: 0.5,
    selrect: { x: 0, y: 0, width: 90, height: 90 },
    fills: [{ fillColor: '#FE7C3F', fillOpacity: 0.5 }],
  }) as any;
  assert.equal(n.shape, 'ellipse');
  assert.equal(n.opacity, 25); // 0.5 * 0.5
});

test('penpotShapeToNode: image fill → image node with _fillImageId + fit', () => {
  const n = penpotShapeToNode({
    id: 'd', type: 'rect',
    selrect: { x: 134, y: 5, width: 666, height: 666 },
    fills: [{ fillOpacity: 1, fillImage: { id: 'media-1', width: 666, height: 666, mtype: 'image/gif', keepAspectRatio: true } }],
  }) as any;
  assert.equal(n.kind, 'image');
  assert.equal(n._fillImageId, 'media-1');
  assert.equal(n.fit, 'cover'); // keepAspectRatio true
});

test('penpotShapeToNode: text shape → text node via content tree', () => {
  const n = penpotShapeToNode({
    id: 'e', type: 'text',
    selrect: { x: 237, y: 62, width: 511, height: 58 },
    fills: [],
    content: {
      type: 'root', children: [{ type: 'paragraph-set', children: [{
        type: 'paragraph', textAlign: 'left',
        children: [{ text: 'Monospace is cool', fontSize: '32', fontWeight: '400', fontFamily: 'SUSE Mono', fills: [{ fillColor: '#123' }] }],
      }] }],
    },
  }) as any;
  assert.equal(n.kind, 'text');
  assert.equal(n.text, 'Monospace is cool');
  assert.equal(n.fontFamily, 'SUSE Mono');
  // round-trips through nodeToBox to the mono font (the SUSE vocabulary passed
  // explicitly, as the SUSE-profile shell does)
  const box = nodeToBox(n, { id: 't0', fonts: SUSE_FONTS });
  assert.equal(box.font, 'SUSE Mono');
  assert.equal(box.text, 'Monospace is cool');
});

test('penpotShapeToNode: root frame + junk → null', () => {
  assert.equal(penpotShapeToNode({ id: '00000000-0000-0000-0000-000000000000', type: 'frame' }), null);
  assert.equal(penpotShapeToNode(null), null);
  assert.equal(penpotShapeToNode('nope'), null);
});

// ── penpotGradientToSpec (gradient fills → Lolly grad spec) ──────────────────
test('penpotGradientToSpec: the keynote background — linear, aspect-aware angle, sRGB', () => {
  // Real values from a 31-slide Penpot keynote: 895×503 board, #151035→#312470.
  const g = {
    type: 'linear', startX: 0.227, startY: 0.335, endX: 0.944, endY: 0.987,
    stops: [{ color: '#151035', opacity: 1, offset: 0 }, { color: '#312470', opacity: 1, offset: 1 }],
  };
  assert.equal(penpotGradientToSpec(g, 895, 503, 1), 'lin.srgb_117_151035-0_312470-100');
});

test('penpotGradientToSpec: stop alpha folds stop.opacity × fillOpacity into hex8', () => {
  const g = {
    type: 'linear', startX: 0, startY: 0, endX: 1, endY: 0,
    stops: [{ color: '#25CBD9', opacity: 1, offset: 0 }, { color: '#00D1B8', opacity: 0.9, offset: 1 }],
  };
  // 0.9 × 255 = 229.5 → e6; first stop stays 6-digit. Horizontal vector → 90°.
  assert.equal(penpotGradientToSpec(g, 321, 71, 1), 'lin.srgb_90_25cbd9-0_00d1b8e6-100');
  // fillOpacity folds in multiplicatively.
  assert.equal(penpotGradientToSpec(g, 321, 71, 0.5), 'lin.srgb_90_25cbd980-0_00d1b873-100');
});

test('penpotGradientToSpec: radial → rad_0; junk → ""', () => {
  const stops = [{ color: '#000000', offset: 0 }, { color: '#ffffff', offset: 1 }];
  assert.equal(penpotGradientToSpec({ type: 'radial', stops }, 100, 100, 1), 'rad.srgb_0_000000-0_ffffff-100');
  assert.equal(penpotGradientToSpec(null, 100, 100, 1), '');
  assert.equal(penpotGradientToSpec({ type: 'linear', stops: [stops[0]] }, 100, 100, 1), '');
  assert.equal(penpotGradientToSpec({ type: 'linear', stops: [{ color: 'garbage(', offset: 0 }, stops[1]] }, 100, 100, 1), '');
});

test('penpotShapeToNode: gradient fill → grad spec + first-stop flat degrade', () => {
  const shape = {
    id: 'g1', type: 'rect',
    selrect: { x: 0, y: 0, width: 895, height: 503 },
    fills: [{ fillOpacity: 1, fillColorGradient: {
      type: 'linear', startX: 0.227, startY: 0.335, endX: 0.944, endY: 0.987,
      stops: [{ color: '#151035', opacity: 1, offset: 0 }, { color: '#312470', opacity: 1, offset: 1 }],
    } }],
  };
  const n = penpotShapeToNode(shape) as any;
  assert.equal(n.grad, 'lin.srgb_117_151035-0_312470-100');
  assert.equal(n.fill, '#151035'); // old engines / non-grad kinds paint the first stop
  const box = nodeToBox(n, { id: 'b0' });
  assert.equal((box as any).grad, 'lin.srgb_117_151035-0_312470-100');
  // A solid-fill shape emits an empty grad, byte-identical to the pre-gradient rows.
  const solid = penpotShapeToNode({ id: 's1', type: 'rect', selrect: { x: 0, y: 0, width: 10, height: 10 }, fills: [{ fillColor: '#ff0000' }] }) as any;
  assert.equal(solid.grad, undefined);
  assert.equal((nodeToBox(solid, { id: 'b1' }) as any).grad, '');
});

// ── Penpot shadows ───────────────────────────────────────────────────────────
test('penpotShapeToNode: drop shadow maps to kind-appropriate shadow fields', () => {
  const shadow = [{ color: { opacity: 0.2, color: '#000000' }, spread: 0, offsetY: 4, style: 'drop-shadow', blur: 4, hidden: false, offsetX: 4 }];
  const rect = penpotShapeToNode({ id: 'r', type: 'rect', selrect: { x: 0, y: 0, width: 10, height: 10 }, fills: [{ fillColor: '#fff' }], shadow }) as any;
  assert.equal(rect.shadow, 'box');
  assert.equal(rect.shadowColor, '#00000033'); // 0.2 × 255 = 51 = 0x33
  assert.deepEqual([rect.shadowX, rect.shadowY, rect.shadowBlur], [4, 4, 4]);
  const box = nodeToBox(rect, { id: 'b0' }) as any;
  assert.equal(box.shadow, 'box');
  assert.equal(box.shadowColor, '#00000033');
  const text = penpotShapeToNode({ id: 't', type: 'text', selrect: { x: 0, y: 0, width: 10, height: 10 },
    content: { children: [{ children: [{ children: [{ text: 'x' }] }] }] }, shadow }) as any;
  assert.equal(text.shadow, 'text');
  // Hidden and degenerate entries stay 'none'.
  const hid = penpotShapeToNode({ id: 'h', type: 'rect', selrect: { x: 0, y: 0, width: 10, height: 10 },
    shadow: [{ ...shadow[0], hidden: true }] }) as any;
  assert.equal(hid.shadow, undefined);
  const zero = penpotShapeToNode({ id: 'z', type: 'rect', selrect: { x: 0, y: 0, width: 10, height: 10 },
    shadow: [{ style: 'drop-shadow', offsetX: 0, offsetY: 0, blur: 0 }] }) as any;
  assert.equal(zero.shadow, undefined);
});

// ── Penpot strokes (non-path shapes → CSS-border fields) ─────────────────────
test('penpotShapeToNode: stroke maps colour/width/dash; center alignment inflates', () => {
  const base = { id: 'r', type: 'rect', selrect: { x: 10, y: 10, width: 100, height: 50 }, fills: [{ fillColor: '#ffffff' }] };
  const n = penpotShapeToNode({ ...base, strokes: [{ strokeColor: '#f23ae5', strokeWidth: 4, strokeAlignment: 'center', strokeStyle: 'solid' }] }) as any;
  assert.equal(n.stroke, '#f23ae5');
  assert.equal(n.strokeW, 4);
  assert.equal(n.strokeDash, '');
  // center → inflate by sw/2 per side so the inside border lands on the authored edge
  assert.deepEqual([n.x, n.y, n.w, n.h], [8, 8, 104, 54]);
  const inner = penpotShapeToNode({ ...base, strokes: [{ strokeColor: '#000', strokeWidth: 2, strokeAlignment: 'inner' }] }) as any;
  assert.deepEqual([inner.x, inner.y, inner.w, inner.h], [10, 10, 100, 50]); // no inflation
  const dotted = penpotShapeToNode({ ...base, strokes: [{ strokeColor: '#000', strokeWidth: 1, strokeAlignment: 'inner', strokeStyle: 'dotted', strokeOpacity: 0.5 }] }) as any;
  assert.equal(dotted.strokeDash, 'dotted');
  assert.equal(dotted.stroke, '#00000080'); // #rgb shorthand expands before the alpha suffix
});

test('penpotShapeToNode: stroke opacity folds to hex8; rows default inert', () => {
  const base = { id: 'r', type: 'rect', selrect: { x: 0, y: 0, width: 10, height: 10 }, fills: [{ fillColor: '#fff' }] };
  const half = penpotShapeToNode({ ...base, strokes: [{ strokeColor: '#14ceca', strokeWidth: 1, strokeAlignment: 'inner', strokeOpacity: 0.5 }] }) as any;
  assert.equal(half.stroke, '#14ceca80');
  const box = nodeToBox(half, { id: 'b0' }) as any;
  assert.equal(box.stroke, '#14ceca80');
  assert.equal(box.strokeW, 1);
  // A strokeless shape emits the inert defaults, byte-identical to older rows.
  const plain = nodeToBox(penpotShapeToNode(base)!, { id: 'b1' }) as any;
  assert.deepEqual([plain.stroke, plain.strokeW, plain.strokeDash], ['', 0, '']);
});

// ── figmaNodesToNodes (.fig document tree) ───────────────────────────────────
test('figmaNodesToNodes: accumulates parent transforms, maps fills + text weight', () => {
  const nc = [
    { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT' },
    { guid: { sessionID: 0, localID: 1 }, type: 'CANVAS', name: 'Page 1', parentIndex: { guid: { sessionID: 0, localID: 0 } } },
    { guid: { sessionID: 0, localID: 9 }, type: 'CANVAS', name: 'Internal Only Canvas', internalOnly: true, parentIndex: { guid: { sessionID: 0, localID: 0 } } },
    { guid: { sessionID: 1, localID: 2 }, type: 'FRAME', parentIndex: { guid: { sessionID: 0, localID: 1 } },
      size: { x: 200, y: 100 }, transform: { m00: 1, m01: 0, m02: 50, m10: 0, m11: 1, m12: 20 },
      fillPaints: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, visible: true }] },
    { guid: { sessionID: 1, localID: 3 }, type: 'TEXT', parentIndex: { guid: { sessionID: 1, localID: 2 } },
      size: { x: 80, y: 24 }, transform: { m00: 1, m01: 0, m02: 10, m10: 0, m11: 1, m12: 8 },
      fontSize: 32, fontName: { family: 'SUSE', style: 'Bold' }, textData: { characters: 'Hi' },
      fillPaints: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, visible: true }] },
  ];
  const nodes = figmaNodesToNodes(nc) as any[];
  assert.equal(nodes.length, 2); // internal canvas + containers excluded
  const [frame, text] = nodes;
  assert.equal(frame.kind, 'box');
  assert.deepEqual([Math.round(frame.x), Math.round(frame.y), Math.round(frame.w), Math.round(frame.h)], [50, 20, 200, 100]);
  assert.equal(frame.fill, '#ffffff');
  assert.equal(text.kind, 'text');
  assert.deepEqual([Math.round(text.x), Math.round(text.y)], [60, 28]); // 50+10, 20+8
  assert.equal(text.text, 'Hi');
  assert.equal(text.fontWeight, 700); // "Bold"
  const box = nodeToBox(text, { id: 'f0', fonts: SUSE_FONTS });
  assert.equal(box.weight, '700');
  assert.equal(box.font, 'SUSE');
});

test('figmaNodesToNodes: ellipse/rounded shapes; skips invisible', () => {
  const I = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 };
  const nc = [
    { guid: { sessionID: 0, localID: 1 }, type: 'CANVAS', name: 'Page 1' },
    { guid: { sessionID: 1, localID: 2 }, type: 'ELLIPSE', parentIndex: { guid: { sessionID: 0, localID: 1 } }, size: { x: 50, y: 50 }, transform: I, fillPaints: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }] },
    { guid: { sessionID: 1, localID: 3 }, type: 'ROUNDED_RECTANGLE', parentIndex: { guid: { sessionID: 0, localID: 1 } }, size: { x: 40, y: 40 }, cornerRadius: 8, transform: I, fillPaints: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1 } }] },
    { guid: { sessionID: 1, localID: 4 }, type: 'RECTANGLE', visible: false, parentIndex: { guid: { sessionID: 0, localID: 1 } }, size: { x: 10, y: 10 }, transform: I },
  ];
  const nodes = figmaNodesToNodes(nc) as any[];
  assert.equal(nodes.length, 2); // invisible rectangle skipped
  assert.equal(nodes[0].shape, 'ellipse');
  assert.equal(nodes[0].fill, '#ff0000');
  assert.equal(nodes[1].shape, 'rounded');
  assert.equal(nodes[1].radius, 8);
});

test('figmaNodesToScenes: one scene per top-level frame, shifted to frame origin', () => {
  const I = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 };
  const at = (x: number, y: number) => ({ m00: 1, m01: 0, m02: x, m10: 0, m11: 1, m12: y });
  const nc = [
    { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT' },
    { guid: { sessionID: 0, localID: 1 }, type: 'CANVAS', name: 'Page 1', parentIndex: { guid: { sessionID: 0, localID: 0 } } },
    // Frame A at (100, 50), 200×100, with a child rect at local (10, 8).
    { guid: { sessionID: 1, localID: 2 }, type: 'FRAME', name: 'Intro', parentIndex: { guid: { sessionID: 0, localID: 1 } },
      size: { x: 200, y: 100 }, transform: at(100, 50),
      fillPaints: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, visible: true }] },
    { guid: { sessionID: 1, localID: 3 }, type: 'RECTANGLE', parentIndex: { guid: { sessionID: 1, localID: 2 } },
      size: { x: 40, y: 20 }, transform: at(10, 8), fillPaints: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }] },
    // Frame B at (500, 0), 300×150.
    { guid: { sessionID: 1, localID: 4 }, type: 'FRAME', name: 'Outro', parentIndex: { guid: { sessionID: 0, localID: 1 } },
      size: { x: 300, y: 150 }, transform: at(500, 0),
      fillPaints: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }] },
    // A loose top-level rectangle → its own per-page scene.
    { guid: { sessionID: 1, localID: 5 }, type: 'RECTANGLE', parentIndex: { guid: { sessionID: 0, localID: 1 } },
      size: { x: 60, y: 60 }, transform: at(900, 900), fillPaints: [{ type: 'SOLID', color: { r: 0, g: 1, b: 0 } }] },
    // Invisible frame is skipped entirely.
    { guid: { sessionID: 1, localID: 6 }, type: 'FRAME', visible: false, parentIndex: { guid: { sessionID: 0, localID: 1 } },
      size: { x: 10, y: 10 }, transform: I },
  ];
  const scenes = figmaNodesToScenes(nc) as any[];
  // The loose rectangle makes NO scene: the page has frames, so loose content is scratch.
  assert.equal(scenes.length, 2);
  const [a, b] = scenes;
  assert.equal(a.name, 'Intro');
  assert.deepEqual([a.width, a.height], [200, 100]);
  // Frame bg box sits at the scene origin; the child keeps its local offset.
  assert.deepEqual([Math.round(a.nodes[0].x), Math.round(a.nodes[0].y)], [0, 0]);
  assert.deepEqual([Math.round(a.nodes[1].x), Math.round(a.nodes[1].y)], [10, 8]);
  assert.equal(b.name, 'Outro');
  assert.deepEqual([b.width, b.height], [300, 150]);
});

test('figmaNodesToScenes: loose shapes make a scene only on a frame-less page', () => {
  const at = (x: number, y: number) => ({ m00: 1, m01: 0, m02: x, m10: 0, m11: 1, m12: y });
  const nc = [
    { guid: { sessionID: 0, localID: 1 }, type: 'CANVAS', name: 'Loose' },
    { guid: { sessionID: 1, localID: 2 }, type: 'RECTANGLE', parentIndex: { guid: { sessionID: 0, localID: 1 } },
      size: { x: 60, y: 60 }, transform: at(900, 900), fillPaints: [{ type: 'SOLID', color: { r: 0, g: 1, b: 0 } }] },
  ];
  const scenes = figmaNodesToScenes(nc) as any[];
  assert.equal(scenes.length, 1);
  assert.equal(scenes[0].name, 'Loose');
  assert.deepEqual([scenes[0].width, scenes[0].height], [60, 60]);
  assert.deepEqual([Math.round(scenes[0].nodes[0].x), Math.round(scenes[0].nodes[0].y)], [0, 0]);
});

test('figmaNodesToScenes: frames play in reading order, not Z/creation order', () => {
  const at = (x: number, y: number) => ({ m00: 1, m01: 0, m02: x, m10: 0, m11: 1, m12: y });
  const frame = (id: number, name: string, x: number, y: number) => ({
    guid: { sessionID: 1, localID: id }, type: 'FRAME', name, parentIndex: { guid: { sessionID: 0, localID: 1 } },
    size: { x: 400, y: 300 }, transform: at(x, y), fillPaints: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
  });
  // Declared LAST-slide-first (Z order); laid out as 2 rows of 2 with jitter.
  const nc = [
    { guid: { sessionID: 0, localID: 1 }, type: 'CANVAS', name: 'Deck' },
    frame(2, 'S4', 500, 410),
    frame(3, 'S3', 0, 400),
    frame(4, 'S2', 500, 8),
    frame(5, 'S1', 0, 0),
  ];
  const scenes = figmaNodesToScenes(nc) as any[];
  assert.deepEqual(scenes.map((s: any) => s.name), ['S1', 'S2', 'S3', 'S4']);
});

test('readingOrder: rows cluster on centre-y tolerance, sort left-to-right', () => {
  const items = [
    { id: 'c', x: 0, y: 100, w: 50, h: 50 },
    { id: 'b', x: 60, y: 3, w: 50, h: 50 },   // slight jitter, same row as a
    { id: 'a', x: 0, y: 0, w: 50, h: 50 },
    { id: 'd', x: 60, y: 104, w: 50, h: 50 },
  ];
  assert.deepEqual(readingOrder(items, (t) => t).map((t) => t.id), ['a', 'b', 'c', 'd']);
  assert.deepEqual(readingOrder([], (t: any) => t), []);
});

test('figmaNodesToScenes: frames across multiple pages, in page order', () => {
  const at = (x: number, y: number) => ({ m00: 1, m01: 0, m02: x, m10: 0, m11: 1, m12: y });
  const nc = [
    { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT' },
    { guid: { sessionID: 0, localID: 1 }, type: 'CANVAS', name: 'One', parentIndex: { guid: { sessionID: 0, localID: 0 } } },
    { guid: { sessionID: 0, localID: 2 }, type: 'CANVAS', name: 'Two', parentIndex: { guid: { sessionID: 0, localID: 0 } } },
    { guid: { sessionID: 1, localID: 3 }, type: 'FRAME', name: 'S1', parentIndex: { guid: { sessionID: 0, localID: 1 } },
      size: { x: 100, y: 100 }, transform: at(0, 0), fillPaints: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }] },
    { guid: { sessionID: 1, localID: 4 }, type: 'FRAME', name: 'S2', parentIndex: { guid: { sessionID: 0, localID: 2 } },
      size: { x: 100, y: 100 }, transform: at(0, 0), fillPaints: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }] },
  ];
  const scenes = figmaNodesToScenes(nc) as any[];
  assert.deepEqual(scenes.map((s: any) => s.name), ['S1', 'S2']);
});

test('figmaNodesToScenes: a COMPONENT container (no visual node of its own) still crops correctly', () => {
  const at = (x: number, y: number) => ({ m00: 1, m01: 0, m02: x, m10: 0, m11: 1, m12: y });
  const nc = [
    { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT' },
    { guid: { sessionID: 0, localID: 1 }, type: 'CANVAS', name: 'P', parentIndex: { guid: { sessionID: 0, localID: 0 } } },
    // COMPONENT is not a VISUAL_FIG type — it emits no box, but is a frame-like scene root.
    { guid: { sessionID: 1, localID: 2 }, type: 'COMPONENT', name: 'Slide', parentIndex: { guid: { sessionID: 0, localID: 1 } },
      size: { x: 400, y: 300 }, transform: at(50, 70) },
    { guid: { sessionID: 1, localID: 3 }, type: 'RECTANGLE', parentIndex: { guid: { sessionID: 1, localID: 2 } },
      size: { x: 100, y: 40 }, transform: at(20, 10), fillPaints: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1 } }] },
  ];
  const scenes = figmaNodesToScenes(nc) as any[];
  assert.equal(scenes.length, 1);
  const [s] = scenes;
  assert.equal(s.name, 'Slide');
  assert.deepEqual([s.width, s.height], [400, 300]);
  assert.equal(s.nodes.length, 1); // just the rect — the component itself draws nothing
  assert.deepEqual([Math.round(s.nodes[0].x), Math.round(s.nodes[0].y)], [20, 10]);
});

test('figmaNodesToScenes: empty / no page → []', () => {
  assert.deepEqual(figmaNodesToScenes([]), []);
  assert.deepEqual(figmaNodesToScenes(null), []);
});

test('figmaNodesToNodes: empty / no page → []', () => {
  assert.deepEqual(figmaNodesToNodes([]), []);
  assert.deepEqual(figmaNodesToNodes(null), []);
  assert.deepEqual(figmaNodesToNodes([{ guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT' }]), []);
});

// ── per-run text colour ──────────────────────────────────────────────────────
test('colorRunsToText: wraps runs differing from the default fg, keeps newlines outside', () => {
  const runs = [
    { text: 'FRAME#02', color: '#ffffff' },
    { text: '\n', color: '' },
    { text: 'GREEN', color: '#000000' },
  ];
  assert.equal(colorRunsToText(runs, '#ffffff'), 'FRAME#02\n{#000000|GREEN}');
  // default-coloured run stays plain; case-insensitive match
  assert.equal(colorRunsToText([{ text: 'hi', color: '#FFFFFF' }], '#ffffff'), 'hi');
  // escapes literal * so imported text can't italicise
  assert.equal(colorRunsToText([{ text: '5 * 3', color: '#f00' }], '#000000'), '{#f00|5 \\* 3}');
});

test('figmaNodesToNodes: per-character colour → {#hex|…} run (base fg = node fill)', () => {
  const nc = [
    { guid: { sessionID: 0, localID: 1 }, type: 'CANVAS', name: 'Page 1' },
    { guid: { sessionID: 1, localID: 2 }, type: 'TEXT', parentIndex: { guid: { sessionID: 0, localID: 1 } },
      size: { x: 100, y: 40 }, transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
      fontName: { family: 'SUSE', style: 'Regular' },
      fillPaints: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],  // base = white
      textData: {
        characters: 'AB\nCD',
        characterStyleIDs: [0, 0, 0, 10, 10],
        styleOverrideTable: [{ styleID: 10, fillPaints: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }] }],
      } },
  ];
  const [text] = figmaNodesToNodes(nc) as any[];
  assert.equal(text.fg, '#ffffff');
  assert.equal(text.text, 'AB\n{#000000|CD}'); // CD overridden to black, newline uncoloured
});

test('decodeFigVectorPath: command tags → SVG path (M/L/C/Z)', () => {
  const bytes: number[] = [];
  const push = (tag: number, ...fs: number[]) => {
    bytes.push(tag);
    for (const v of fs) { const b = new Uint8Array(new Float32Array([v]).buffer); bytes.push(b[0]!, b[1]!, b[2]!, b[3]!); }
  };
  push(1, 1, 2);            // M 1 2
  push(4, 3, 4, 5, 6, 7, 8); // C 3 4 5 6 7 8
  push(2, 9, 10);           // L 9 10
  push(0);                  // Z
  assert.equal(decodeFigVectorPath(Uint8Array.from(bytes)), 'M1 2 C3 4 5 6 7 8 L9 10 Z');
  assert.equal(decodeFigVectorPath(null), '');
  assert.equal(decodeFigVectorPath(Uint8Array.from([])), ''); // empty → ''
});

test('figmaNodesToNodes: VECTOR with blobs → image node carrying the reconstructed path', () => {
  // one cubic path blob: M0 0 C… (tags 1 then 4)
  const bytes: number[] = [];
  const push = (tag: number, ...fs: number[]) => { bytes.push(tag); for (const v of fs) { const b = new Uint8Array(new Float32Array([v]).buffer); bytes.push(b[0]!, b[1]!, b[2]!, b[3]!); } };
  push(1, 0, 0); push(2, 10, 10); push(0);
  const nc = [
    { guid: { sessionID: 0, localID: 1 }, type: 'CANVAS', name: 'Page 1' },
    { guid: { sessionID: 1, localID: 2 }, type: 'VECTOR', parentIndex: { guid: { sessionID: 0, localID: 1 } },
      size: { x: 20, y: 20 }, transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
      fillPaints: [{ type: 'SOLID', color: { r: 0, g: 1, b: 0 } }],
      fillGeometry: [{ commandsBlob: 0, windingRule: 'NONZERO' }] },
  ];
  const [v] = figmaNodesToNodes(nc, [{ bytes: Uint8Array.from(bytes) }]) as any[];
  assert.equal(v.kind, 'image');
  assert.equal(v._vectorPath, 'M0 0 L10 10 Z');
  assert.equal(v._vectorFill, '#00ff00');
  assert.deepEqual(v._vectorSize, { w: 20, h: 20 });
  // no blobs → falls back to a plain box
  const [b] = figmaNodesToNodes(nc) as any[];
  assert.equal(b.kind, 'box');
  assert.equal(b.fill, '#00ff00');
});

test('parsePenpotContent: per-leaf colour → coloured run relative to first-leaf fg', () => {
  const tree = { type: 'root', children: [{ type: 'paragraph-set', children: [{
    type: 'paragraph', textAlign: 'left', children: [
      { text: 'white ', fills: [{ fillColor: '#ffffff' }] },
      { text: 'black', fills: [{ fillColor: '#000000' }] },
    ],
  }] }] };
  const r = parsePenpotContent(tree);
  assert.equal(r.fg, '#ffffff');                 // first leaf = base
  assert.equal(r.text, 'white {#000000|black}'); // second leaf differs → wrapped
});

// ── Penpot path shapes + vector-group flattening ─────────────────────────────
test('penpotPathContentToD: binfile-v3 d string passes through; junk is refused', () => {
  // real command sample from the keynote: an icon dot (absolute M/C/Z, page-space coords)
  const d = 'M10.83203125,933.625C10.83203125,930.49267578125,8.40673828125,927.953125,5.41552734375,927.953125Z';
  assert.equal(penpotPathContentToD(d), d);
  assert.equal(penpotPathContentToD('  M0,0L1,1  '), 'M0,0L1,1');
  assert.equal(penpotPathContentToD('translate(1,2)'), ''); // not path data
  assert.equal(penpotPathContentToD(''), '');
  assert.equal(penpotPathContentToD(null), '');
  assert.equal(penpotPathContentToD({ some: 'tree' }), '');
});

test('penpotPathContentToD: segment-object array form converts (incl. keyword commands)', () => {
  const segs = [
    { command: 'move-to', params: { x: 1, y: 2 } },
    { command: 'curve-to', params: { c1x: 3, c1y: 4, c2x: 5, c2y: 6, x: 7, y: 8 } },
    { command: 'line-to', params: { x: 9, y: 10 } },
    { command: ':close-path' },
  ];
  assert.equal(penpotPathContentToD(segs), 'M1,2C3,4,5,6,7,8L9,10Z');
  // one unknown command poisons the whole path (partial art is worse than the selrect box)
  assert.equal(penpotPathContentToD([{ command: 'move-to', params: { x: 0, y: 0 } }, { command: 'arc-to' }]), '');
  assert.equal(penpotPathContentToD([{ command: 'line-to', params: { x: 1, y: 1 } }]), ''); // must start with M
});

test('penpotShapeToNode: path with content → image node carrying page-space _vector markers', () => {
  const n = penpotShapeToNode({
    id: 'p1', type: 'path',
    selrect: { x: -447.62, y: 3775, width: 4, height: 51 },
    content: 'M-447.62,3775.0L-447.62,3826.0',
    fills: [{ fillColor: '#eeeeee', fillOpacity: 1 }],
  }) as any;
  assert.equal(n.kind, 'image');
  assert.equal(n.fit, 'fill');
  assert.equal(n.fill, ''); // no seed backing behind the transparent baked SVG
  assert.equal(n._vectorPath, 'M-447.62,3775.0L-447.62,3826.0');
  assert.equal(n._vectorFill, '#eeeeee');
  assert.equal(n._vectorGradient, null);
  assert.equal(n._vectorStroke, null);
  // page-space origin rides _vectorSize — the Penpot/Figma delta (Figma vectors are local)
  assert.deepEqual(n._vectorSize, { w: 4, h: 51, x: -447.62, y: 3775 });
});

test('penpotShapeToNode: stroke-only path (fills=[]) → fill none + stroke marker, not invisible', () => {
  const n = penpotShapeToNode({
    id: 'p2', type: 'path',
    selrect: { x: 0, y: 0, width: 10, height: 51 },
    content: 'M0,0L0,51',
    fills: [],
    strokes: [{ strokeStyle: 'solid', strokeColor: '#f23ae5', strokeOpacity: 1, strokeAlignment: 'inner', strokeWidth: 4 }],
  }) as any;
  assert.equal(n.kind, 'image');
  assert.equal(n._vectorFill, 'none');
  // `style` joins the marker so the vector bake can carry Penpot's dash pattern
  // (design-import's storeFigVector reads it); 'solid' emits no extra attributes.
  assert.deepEqual(n._vectorStroke, { color: '#f23ae5', width: 4, opacity: 1, style: 'solid' });
});

test('penpotShapeToNode: gradient path → raw _vectorGradient + first-stop fallback fill', () => {
  const grad = {
    type: 'linear', startX: 0.5, startY: 0, endX: 0.5, endY: 1,
    stops: [{ color: '#151035', offset: 0, opacity: 1 }, { color: '#312470', offset: 1, opacity: 0 }],
  };
  const n = penpotShapeToNode({
    id: 'p3', type: 'path', selrect: { x: 0, y: 0, width: 100, height: 100 },
    content: 'M0,0L100,100Z', fills: [{ fillColorGradient: grad }],
  }) as any;
  assert.equal(n.kind, 'image');
  assert.equal(n._vectorGradient, grad);
  assert.equal(n._vectorFill, '#151035'); // degrade target if the def can't be emitted
});

test('penpotShapeToNode: bool routes through the vector branch; empty-content path stays a selrect box', () => {
  const b = penpotShapeToNode({
    id: 'b1', type: 'bool', selrect: { x: 0, y: 0, width: 10, height: 10 },
    content: 'M0,0L10,10Z', fills: [{ fillColor: '#112233' }],
  }) as any;
  assert.equal(b.kind, 'image');
  assert.equal(b._vectorPath, 'M0,0L10,10Z');
  const p = penpotShapeToNode({
    id: 'p4', type: 'path', selrect: { x: 0, y: 0, width: 10, height: 10 },
    content: '', fills: [{ fillColor: '#112233' }],
  }) as any;
  assert.equal(p.kind, 'box');
  assert.equal(p.fill, '#112233');
});

test('penpotGradientSvgDef: linear def keeps exact endpoints; alpha folds stop×fill opacity', () => {
  const def = penpotGradientSvgDef({
    type: 'linear', startX: 0.906, startY: 0.544, endX: -0.234, endY: 0.534,
    stops: [{ color: '#151035', offset: 0, opacity: 1 }, { color: '#312470', offset: 1, opacity: 0.5 }],
  }, 'g1', 0.5);
  assert.ok(def.startsWith('<linearGradient id="g1" gradientUnits="objectBoundingBox" x1="0.906" y1="0.544" x2="-0.234" y2="0.534">'));
  assert.ok(def.includes('<stop offset="0" stop-color="#151035" stop-opacity="0.5"/>'));
  assert.ok(def.includes('<stop offset="1" stop-color="#312470" stop-opacity="0.25"/>'));
  // radial approximates r as the start→end distance
  const rad = penpotGradientSvgDef({
    type: 'radial', startX: 0.5, startY: 0.5, endX: 0.5, endY: 1,
    stops: [{ color: '#ffffff', offset: 0 }, { color: '#000000', offset: 1 }],
  }, 'g2', 1);
  assert.ok(rad.startsWith('<radialGradient id="g2" gradientUnits="objectBoundingBox" cx="0.5" cy="0.5" r="0.5">'));
  // unusable: missing stops / bad colour
  assert.equal(penpotGradientSvgDef({ stops: [{ color: '#fff', offset: 0 }] }, 'g', 1), '');
  assert.equal(penpotGradientSvgDef({ stops: [{ color: 'url(#x)', offset: 0 }, { color: '#fff', offset: 1 }] }, 'g', 1), '');
});

test('penpotGroupToSvg: all-vector group → one SVG, selrect viewBox, z-order preserved', () => {
  const shapes: Record<string, any> = {
    g: { id: 'g', type: 'group', selrect: { x: 100, y: 200, width: 50, height: 40 }, opacity: 0.2, shapes: ['r', 'p1', 'p2'] },
    r: { id: 'r', type: 'rect', selrect: { x: 100, y: 200, width: 50, height: 40 }, fills: [{ fillColor: '#ffffff' }] },
    p1: { id: 'p1', type: 'path', selrect: { x: 110, y: 210, width: 10, height: 10 }, content: 'M110,210L120,220Z', fills: [{ fillColor: '#f23ae5' }] },
    p2: { id: 'p2', type: 'path', selrect: { x: 130, y: 210, width: 10, height: 10 }, content: 'M130,210L140,220Z', fills: [] ,
      strokes: [{ strokeColor: '#14ceca', strokeWidth: 2, strokeOpacity: 0.5 }] },
  };
  const svg = penpotGroupToSvg(shapes.g, (id) => shapes[id]);
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="100 200 50 40"'));
  // z-order: rect first (back), then the two paths
  const order = [svg.indexOf('<rect'), svg.indexOf('M110,210'), svg.indexOf('M130,210')];
  assert.ok(order[0]! > -1 && order[0]! < order[1]! && order[1]! < order[2]!);
  // stroke-only path: fill none + stroke attrs with opacity
  assert.ok(svg.includes('fill="none" stroke="#14ceca" stroke-width="2" stroke-opacity="0.5"'));
  // ROOT group opacity is NOT baked — the caller carries it on the image box
  assert.ok(!svg.includes('opacity="0.2"'));
});

test('penpotGroupToSvg: nested group opacity bakes; text/image/shadow children refuse the flatten', () => {
  const base: Record<string, any> = {
    g: { id: 'g', type: 'group', selrect: { x: 0, y: 0, width: 10, height: 10 }, shapes: ['sub'] },
    sub: { id: 'sub', type: 'group', selrect: { x: 0, y: 0, width: 10, height: 10 }, opacity: 0.5, shapes: ['p'] },
    p: { id: 'p', type: 'path', selrect: { x: 0, y: 0, width: 10, height: 10 }, content: 'M0,0L10,10Z', fills: [{ fillColor: '#000000' }] },
  };
  assert.ok(penpotGroupToSvg(base.g, (id) => base[id]).includes('<g opacity="0.5">'));
  // a text leaf anywhere in the subtree → '' (falls through to per-shape import)
  const withText: Record<string, any> = { ...base, sub: { ...base.sub, shapes: ['p', 't'] }, t: { id: 't', type: 'text', content: {} } };
  assert.equal(penpotGroupToSvg(withText.g, (id) => withText[id]), '');
  // an image fill → ''
  const withImg: Record<string, any> = { ...base, p: { ...base.p, fills: [{ fillImage: { id: 'm1' } }] } };
  assert.equal(penpotGroupToSvg(withImg.g, (id) => withImg[id]), '');
  // a visible drop-shadow → '' (the baked SVG has no filter; per-shape keeps the shadow)
  const withShadow: Record<string, any> = { ...base, p: { ...base.p, shadow: [{ style: 'drop-shadow', color: { color: '#000000', opacity: 0.2 }, offsetX: 4, offsetY: 4, blur: 4 }] } };
  assert.equal(penpotGroupToSvg(withShadow.g, (id) => withShadow[id]), '');
  // a hidden child is skipped, not fatal
  const withHidden: Record<string, any> = { ...base, sub: { ...base.sub, shapes: ['p', 'hid'] }, hid: { id: 'hid', type: 'text', hidden: true } };
  assert.ok(penpotGroupToSvg(withHidden.g, (id) => withHidden[id]).includes('<path'));
});

test('penpotGroupToSvg: maskedGroup → clipPath from the first child; mask silhouette never paints', () => {
  const shapes: Record<string, any> = {
    g: { id: 'g', type: 'group', maskedGroup: true, selrect: { x: 0, y: 0, width: 100, height: 100 }, shapes: ['mask', 'art'] },
    mask: { id: 'mask', type: 'path', selrect: { x: 0, y: 0, width: 100, height: 100 }, content: 'M0,0L100,0L100,100Z', fills: [{ fillColor: '#b1b2b5' }] },
    art: { id: 'art', type: 'circle', selrect: { x: 10, y: 10, width: 80, height: 80 }, fills: [{ fillColor: '#14ceca' }] },
  };
  const svg = penpotGroupToSvg(shapes.g, (id) => shapes[id]);
  assert.ok(/<clipPath id="pc\d+"><path d="M0,0L100,0L100,100Z"/.test(svg));
  assert.ok(/<g clip-path="url\(#pc\d+\)">/.test(svg));
  // the grey mask silhouette paints ONLY inside the clipPath def, never as body art
  assert.equal(svg.split('M0,0L100,0L100,100Z').length, 2);
  assert.ok(svg.includes('<ellipse cx="50" cy="50" rx="40" ry="40" fill="#14ceca"/>'));
  // a group in the mask slot can't clip (clipPath ignores <g>) → refuse the flatten
  const badMask = { ...shapes, g: { ...shapes.g, shapes: ['sub', 'art'] }, sub: { id: 'sub', type: 'group', selrect: { x: 0, y: 0, width: 9, height: 9 }, shapes: [] } };
  assert.equal(penpotGroupToSvg(badMask.g, (id) => (badMask as any)[id]), '');
});

test('penpotGroupToSvg: non-groups, empty and degenerate groups refuse', () => {
  assert.equal(penpotGroupToSvg(null, () => undefined), '');
  assert.equal(penpotGroupToSvg({ type: 'path', content: 'M0,0Z' }, () => undefined), '');
  assert.equal(penpotGroupToSvg({ type: 'group', selrect: { x: 0, y: 0, width: 0, height: 0 }, shapes: [] }, () => undefined), '');
  // a dangling child ref bails rather than emitting partial art
  assert.equal(penpotGroupToSvg({ type: 'group', selrect: { x: 0, y: 0, width: 9, height: 9 }, shapes: ['ghost'] }, () => undefined), '');
});

// ── collectPenpotExportMarks ─────────────────────────────────────────────────
// (Spec: exports-marked asset ingest. Synthetic pages; the real-file census
// lives in tests/penpot-keynote-replay.test.ts.)

import { collectPenpotExportMarks } from '../engine/src/design-map.ts';

const ROOT_ID = '00000000-0000-0000-0000-000000000000';
const pageWith = (shapes: Record<string, any>): Record<string, any> => ({
  [ROOT_ID]: { id: ROOT_ID, type: 'frame', shapes: Object.keys(shapes).filter((k) => !shapes[k].__nested) },
  ...Object.fromEntries(Object.entries(shapes).map(([k, v]) => { const { __nested, ...s } = v; return [k, s]; })),
});

test('collectPenpotExportMarks: (a) marked shapes collect in paint order with the entry triple', () => {
  const page = pageWith({
    a: { id: 'a', type: 'frame', exports: [{ type: 'png', suffix: '', scale: 2 }] },
    b: { id: 'b', type: 'rect' },
    c: { id: 'c', type: 'group', exports: [{ type: 'svg', suffix: '', scale: 1 }, { type: 'jpeg', suffix: '', scale: 4 }] },
  });
  const marks = collectPenpotExportMarks(page);
  assert.equal(marks.length, 2);
  assert.equal(marks[0]!.shape.id, 'a');
  assert.deepEqual(marks[0]!.entries, [{ type: 'png', scale: 2, suffix: '' }]);
  assert.deepEqual(marks[1]!.entries, [
    { type: 'svg', scale: 1, suffix: '' },
    { type: 'jpeg', scale: 4, suffix: '' },
  ]);
});

test('collectPenpotExportMarks: (b) identical duplicate entries dedupe; distinct configs survive', () => {
  const page = pageWith({
    a: { id: 'a', type: 'rect', exports: [
      { type: 'png', suffix: '', scale: 1 },
      { type: 'png', suffix: '', scale: 1 },   // the keynote's "captura" duplicate
      { type: 'png', suffix: '', scale: 2 },
      { type: 'png', suffix: '@x', scale: 2 }, // different suffix = different entry
    ] },
  });
  const marks = collectPenpotExportMarks(page);
  assert.equal(marks.length, 1);
  assert.deepEqual(marks[0]!.entries, [
    { type: 'png', scale: 1, suffix: '' },
    { type: 'png', scale: 2, suffix: '' },
    { type: 'png', scale: 2, suffix: '@x' },
  ]);
});

test('collectPenpotExportMarks: (c) a component master subtree is a definition — 0 marks from master OR descendant', () => {
  // Descendant-marked: the master board itself is unmarked, a child inside it is.
  const descendantMarked: Record<string, any> = {
    [ROOT_ID]: { id: ROOT_ID, type: 'frame', shapes: ['master'] },
    master: { id: 'master', type: 'frame', componentRoot: true, mainInstance: true, shapes: ['inner'] },
    inner: { id: 'inner', type: 'rect', exports: [{ type: 'png', suffix: '', scale: 1 }] },
  };
  assert.deepEqual(collectPenpotExportMarks(descendantMarked), []);
  // Directly-marked master: also nothing.
  const directMarked: Record<string, any> = {
    [ROOT_ID]: { id: ROOT_ID, type: 'frame', shapes: ['master'] },
    master: { id: 'master', type: 'frame', componentRoot: true, mainInstance: true,
      exports: [{ type: 'svg', suffix: '', scale: 1 }], shapes: [] },
  };
  assert.deepEqual(collectPenpotExportMarks(directMarked), []);
  // An ordinary instance (componentRoot without mainInstance) still collects.
  const instance: Record<string, any> = {
    [ROOT_ID]: { id: ROOT_ID, type: 'frame', shapes: ['inst'] },
    inst: { id: 'inst', type: 'frame', componentRoot: true,
      exports: [{ type: 'png', suffix: '', scale: 1 }], shapes: [] },
  };
  assert.equal(collectPenpotExportMarks(instance).length, 1);
});

test('collectPenpotExportMarks: (d) hidden shapes and hidden ancestors prune the mark', () => {
  const page: Record<string, any> = {
    [ROOT_ID]: { id: ROOT_ID, type: 'frame', shapes: ['hid', 'holder', 'kept'] },
    hid: { id: 'hid', type: 'rect', hidden: true, exports: [{ type: 'png', suffix: '', scale: 1 }] },
    holder: { id: 'holder', type: 'group', hidden: true, shapes: ['inside'] },
    inside: { id: 'inside', type: 'rect', exports: [{ type: 'png', suffix: '', scale: 1 }] },
    kept: { id: 'kept', type: 'rect', exports: [{ type: 'png', suffix: '', scale: 1 }] },
  };
  const marks = collectPenpotExportMarks(page);
  assert.equal(marks.length, 1);
  assert.equal(marks[0]!.shape.id, 'kept');
});

test('collectPenpotExportMarks: (e) scale 0 clamps to 0.1 (not default 1); null suffix becomes empty', () => {
  const page = pageWith({
    a: { id: 'a', type: 'rect', exports: [{ type: 'svg', scale: 0, suffix: null }] },
  });
  const marks = collectPenpotExportMarks(page);
  assert.equal(marks.length, 1);
  assert.deepEqual(marks[0]!.entries, [{ type: 'svg', scale: 0.1, suffix: '' }]);
});

test('collectPenpotExportMarks: (f) unknown export types drop silently; a shape with none usable yields no mark', () => {
  const page = pageWith({
    a: { id: 'a', type: 'rect', exports: [{ type: 'webp', suffix: '', scale: 2 }] },
    b: { id: 'b', type: 'rect', exports: [{ type: 'pdf', suffix: '', scale: 1 }, { type: 'png', suffix: '', scale: 1 }] },
    c: { id: 'c', type: 'rect', exports: [] },
    d: { id: 'd', type: 'rect', exports: 'nonsense' },
  });
  const marks = collectPenpotExportMarks(page);
  assert.equal(marks.length, 1);
  assert.equal(marks[0]!.shape.id, 'b');
  assert.deepEqual(marks[0]!.entries, [{ type: 'png', scale: 1, suffix: '' }]);
});

// ── Spec 3: per-corner radii + flipX/flipY fidelity ──────────────────────────
// (Appended block — imports are hoisted, kept here so the block stays append-only.)
import {
  penpotTransformBaked, pathDBounds, mirrorPenpotGradient, penpotRoundedRectD,
} from '../engine/src/design-map.ts';
import { cornerRadii, roundedRectPath } from '../engine/src/css-box.ts';

// The keynote's "square" rect: R(188.83°)·FlipY baked into `transform` (det −1).
const SQUARE_RF = { a: -0.9881129902634416, b: -0.15372936763233724, c: -0.15319146723702826, d: 0.9881965261858454, e: 1.59e-12, f: 8.82e-11 };
// The keynote slide-background gradient (895×503 board, #151035→#312470, angle 117).
const KEYNOTE_G = {
  type: 'linear',
  startX: 0.22696941509810883, startY: 0.3352543335727551,
  endX: 0.9443598198336676, endY: 0.9871518587811399,
  stops: [{ color: '#151035', opacity: 1, offset: 0 }, { color: '#312470', opacity: 1, offset: 1 }],
};

test('penpotTransformBaked: identity (with e/f float noise) is not baked; R·F is', () => {
  assert.equal(penpotTransformBaked({ a: 1, b: 0, c: 0, d: 1, e: 2.7e-9, f: 1.5e-9 }), false);
  assert.equal(penpotTransformBaked(SQUARE_RF), true);
  assert.equal(penpotTransformBaked({ a: 0, b: 1, c: -1, d: 0 }), true); // pure rot 90
  // junk / absent fields default to identity
  assert.equal(penpotTransformBaked(null), false);
  assert.equal(penpotTransformBaked(undefined), false);
  assert.equal(penpotTransformBaked('matrix(1,0,0,1,0,0)'), false);
  assert.equal(penpotTransformBaked({}), false);
});

test('pathDBounds: loose control-point bbox of absolute M/L/C/Z; anything else null', () => {
  // Control points COUNT (deliberately loose — cheap placement rect, not exact bounds).
  assert.deepEqual(pathDBounds('M10,20L30,5C40,50,60,-4,35,80Z'), { x: 10, y: -4, w: 50, h: 84 });
  // Exponents parse as numbers, never as command letters.
  assert.deepEqual(pathDBounds('M1e2,2e1L3e2,4e1Z'), { x: 100, y: 20, w: 200, h: 20 });
  // Arc / relative / quadratic commands need real interpretation → null.
  assert.equal(pathDBounds('M0,0A5,5 0 0 1 10,10Z'), null);
  assert.equal(pathDBounds('M0,0l10,10Z'), null);
  assert.equal(pathDBounds('M0,0Q5,5,10,10'), null);
  // No commands / no finite pair → null.
  assert.equal(pathDBounds(''), null);
  assert.equal(pathDBounds('Z'), null);
});

test('penpotShapeToNode: a baked-transform path places on its content bbox with rot 0', () => {
  const base = {
    id: 'p1', type: 'path', rotation: 90,
    selrect: { x: 500, y: 900, width: 60, height: 50 },
    fills: [{ fillColor: '#14ceca', fillOpacity: 1 }],
    content: 'M100,200L150,200L150,260Z',
  };
  // Non-identity transform: content is page-space-final → bbox route, rot 0.
  const baked = penpotShapeToNode({ ...base, transform: { a: 0, b: 1, c: -1, d: 0 } }) as any;
  assert.deepEqual([baked.x, baked.y, baked.w, baked.h, baked.rot], [100, 200, 50, 60, 0]);
  assert.deepEqual(baked._vectorSize, { w: 50, h: 60, x: 100, y: 200 });
  // Identity transform (float noise only): byte-identical selrect + rot route.
  const ident = penpotShapeToNode({ ...base, transform: { a: 1, b: 0, c: 0, d: 1, e: 1e-9, f: -1e-9 } }) as any;
  assert.deepEqual([ident.x, ident.y, ident.w, ident.h, ident.rot], [500, 900, 60, 50, 90]);
  assert.deepEqual(ident._vectorSize, { w: 60, h: 50, x: 500, y: 900 });
  // Degenerate bbox dims clamp to 1 (a zero-height line is still placeable).
  const flat = penpotShapeToNode({ ...base, transform: { a: 0, b: 1, c: -1, d: 0 }, content: 'M5,7L9,7Z' }) as any;
  assert.deepEqual([flat.x, flat.y, flat.w, flat.h, flat.rot], [5, 7, 4, 1, 0]);
});

test('mirrorPenpotGradient: identity return without flip; endpoint mirror per axis', () => {
  // No flip → the SAME object back (no copy, byte-identical downstream).
  assert.equal(mirrorPenpotGradient(KEYNOTE_G, false, false), KEYNOTE_G);
  const mx = mirrorPenpotGradient(KEYNOTE_G, true, false) as any;
  assert.ok(close(mx.startX, 1 - KEYNOTE_G.startX));
  assert.ok(close(mx.endX, 1 - KEYNOTE_G.endX));
  assert.equal(mx.startY, KEYNOTE_G.startY);
  assert.equal(mx.endY, KEYNOTE_G.endY);
  assert.equal(mx.stops, KEYNOTE_G.stops); // stops untouched (shallow copy)
  const my = mirrorPenpotGradient(KEYNOTE_G, false, true) as any;
  assert.equal(my.startX, KEYNOTE_G.startX);
  assert.ok(close(my.endY, 1 - KEYNOTE_G.endY));
  // The keynote background: 117° unflipped, 243° mirrored through the real spec fn.
  assert.equal(penpotGradientToSpec(KEYNOTE_G, 895, 503, 1), 'lin.srgb_117_151035-0_312470-100');
  assert.equal(penpotGradientToSpec(mirrorPenpotGradient(KEYNOTE_G, true, false), 895, 503, 1),
    'lin.srgb_243_151035-0_312470-100');
  // Junk passes through.
  assert.equal(mirrorPenpotGradient(null, true, true), null);
});

test('penpotShapeToNode: a flipX frame mirrors its gradient spec (the keynote slide bg)', () => {
  const frame = (flipX: boolean) => ({
    id: 'f1', type: 'frame', flipX,
    selrect: { x: 0, y: 0, width: 895, height: 503 },
    fills: [{ fillOpacity: 1, fillColorGradient: KEYNOTE_G }],
  });
  assert.equal((penpotShapeToNode(frame(false)) as any).grad, 'lin.srgb_117_151035-0_312470-100');
  assert.equal((penpotShapeToNode(frame(true)) as any).grad, 'lin.srgb_243_151035-0_312470-100');
  // The flat first-stop degrade is flip-independent.
  assert.equal((penpotShapeToNode(frame(true)) as any).fill, '#151035');
});

test('penpotRoundedRectD: a thin adapter over cornerRadii + roundedRectPath', () => {
  const expected = (x: number, y: number, w: number, h: number, r: [number, number, number, number]) =>
    roundedRectPath(x, y, w, h, cornerRadii(
      { topLeft: `${r[0]}px`, topRight: `${r[1]}px`, bottomRight: `${r[2]}px`, bottomLeft: `${r[3]}px` }, w, h));
  assert.equal(penpotRoundedRectD(5, 7, 100, 80, [10, 20, 30, 40]), expected(5, 7, 100, 80, [10, 20, 30, 40]));
  // The CSS §5.5 overlap clamp comes from the one shared implementation.
  assert.equal(penpotRoundedRectD(0, 0, 100, 50, [80, 80, 0, 0]), expected(0, 0, 100, 50, [80, 80, 0, 0]));
  assert.ok(penpotRoundedRectD(0, 0, 100, 50, [80, 80, 0, 0]).includes('A50,'), 'top corners clamp to 50 each');
  // Negative radii sanitize to 0.
  assert.equal(penpotRoundedRectD(0, 0, 10, 10, [-5, 0, 0, 0]), expected(0, 0, 10, 10, [0, 0, 0, 0]));
});

test('penpotShapeToNode + penpotGroupToSvg: unequal corner radii route via the rounded-rect path, flip-permuted', () => {
  const base = {
    id: 'r1', type: 'rect', rotation: 5,
    selrect: { x: 10, y: 20, width: 100, height: 80 },
    fills: [{ fillColor: '#ff0000', fillOpacity: 1 }],
    strokes: [{ strokeColor: '#151035', strokeWidth: 2, strokeAlignment: 'center' }],
    r1: 4, r2: 8, r3: 12, r4: 16,
  };
  const n = penpotShapeToNode(base) as any;
  assert.equal(n.kind, 'image');
  assert.equal(n.rot, 5); // selrect space keeps rot
  assert.equal(n._vectorPath, penpotRoundedRectD(10, 20, 100, 80, [4, 8, 12, 16]));
  assert.equal(n._vectorFill, '#ff0000');
  assert.deepEqual(n._vectorSize, { w: 100, h: 80, x: 10, y: 20 });
  // Stroke rides the bake — NO CSS-border inflation of the rect.
  assert.deepEqual(n._vectorStroke, { color: '#151035', width: 2, opacity: 1, style: 'solid' });
  assert.deepEqual([n.x, n.y, n.w, n.h], [10, 20, 100, 80]);
  assert.equal(n.radius, undefined);
  // Flip permutes the corners: flipX swaps left↔right, flipY swaps top↔bottom.
  assert.equal((penpotShapeToNode({ ...base, flipX: true }) as any)._vectorPath,
    penpotRoundedRectD(10, 20, 100, 80, [8, 4, 16, 12]));
  assert.equal((penpotShapeToNode({ ...base, flipY: true }) as any)._vectorPath,
    penpotRoundedRectD(10, 20, 100, 80, [16, 12, 8, 4]));
  assert.equal((penpotShapeToNode({ ...base, flipX: true, flipY: true }) as any)._vectorPath,
    penpotRoundedRectD(10, 20, 100, 80, [12, 16, 4, 8]));
  // Equal corners (r2–r4 defaulting to r1) keep the byte-identical rounded box.
  const eq = penpotShapeToNode({ ...base, r1: 10, r2: 10, r3: 10, r4: 10 }) as any;
  assert.equal(eq.kind, 'box');
  assert.equal(eq.shape, 'rounded');
  assert.equal(eq.radius, 11); // 10 + center-stroke inflation of 1, as before
  const eqDefault = penpotShapeToNode({ ...base, r2: undefined, r3: undefined, r4: undefined, r1: 10 }) as any;
  assert.equal(eqDefault.shape, 'rounded');
  // Group bake: unequal → <path d>, equal → the unchanged <rect rx>.
  const shapes: Record<string, any> = {
    g: { id: 'g', type: 'group', selrect: { x: 0, y: 0, width: 200, height: 200 }, shapes: ['u', 'e'] },
    u: { ...base, id: 'u', rotation: 0, strokes: [] },
    e: { ...base, id: 'e', rotation: 0, strokes: [], r1: 6, r2: 6, r3: 6, r4: 6 },
  };
  const svg = penpotGroupToSvg(shapes.g, (id) => shapes[id]);
  assert.ok(svg.includes(`<path d="${penpotRoundedRectD(10, 20, 100, 80, [4, 8, 12, 16])}" fill="#ff0000"/>`));
  assert.ok(svg.includes('<rect x="10" y="20" width="100" height="80" rx="6" fill="#ff0000"/>'));
});

// ── Penpot dash/gap strokes (2.17, PR #9765) ─────────────────────────────────
// Two optional numbers on each `strokes[]` entry, meaningful only when the style is
// `dashed`, absolute px and NOT proportional to the width. Absence is not zero: the
// renderer falls back to width + 10 for each. `strokeStyle: "none"` paints nothing.

test('penpotShapeToNode: strokeStyle "none" paints nothing and reveals the stroke under it', () => {
  const base = { id: 'r', type: 'rect', selrect: { x: 10, y: 10, width: 100, height: 50 }, fills: [{ fillColor: '#ffffff' }] };
  // A sole "none" entry: no stroke at all, and NO geometry inflation either.
  const sole = penpotShapeToNode({ ...base,
    strokes: [{ strokeColor: '#f23ae5', strokeWidth: 4, strokeStyle: 'none', strokeAlignment: 'center' }] }) as any;
  const soleBox = nodeToBox(sole, { id: 'b0' }) as any;
  assert.deepEqual([soleBox.stroke, soleBox.strokeW, soleBox.strokeDash], ['', 0, '']);
  assert.deepEqual([sole.x, sole.y, sole.w, sole.h], [10, 10, 100, 50]);
  // Topmost "none" over a real stroke: the search continues DOWNWARDS past it.
  const under = penpotShapeToNode({ ...base, strokes: [
    { strokeColor: '#123456', strokeWidth: 2, strokeStyle: 'solid', strokeAlignment: 'inner' },
    { strokeColor: '#f23ae5', strokeWidth: 4, strokeStyle: 'none', strokeAlignment: 'inner' },
  ] }) as any;
  assert.equal(under.stroke, '#123456');
  assert.equal(under.strokeW, 2);
});

test('penpotShapeToNode: "mixed" maps to dashed; dash/gap read authored or default to w+10', () => {
  const base = { id: 'r', type: 'rect', selrect: { x: 0, y: 0, width: 100, height: 50 },
    fills: [{ fillColor: '#ffffff' }] };
  const mk = (st: Record<string, unknown>) => penpotShapeToNode({ ...base,
    strokes: [{ strokeColor: '#000000', strokeWidth: 2, strokeAlignment: 'inner', ...st }] }) as any;

  // `mixed` used to fall through to solid silently; dashed is the nearest CSS keyword.
  assert.equal(mk({ strokeStyle: 'mixed' }).strokeDash, 'dashed');
  // ...but the authored-length fields stay unset, so a mixed stroke keeps the editor's
  // width-proportional synthesis rather than pretending it was a two-part dash.
  assert.equal(mk({ strokeStyle: 'mixed' }).strokeDashLen, undefined);

  const authored = mk({ strokeStyle: 'dashed', strokeDash: 8, strokeGap: 3 });
  assert.equal(authored.strokeDash, 'dashed');
  assert.equal(authored.strokeDashLen, 8);
  assert.equal(authored.strokeGapLen, 3);

  // Neither key written (the user picked "dashed" and never touched the inputs) →
  // Penpot's own renderer fallback, width + 10 for BOTH.
  const dflt = mk({ strokeStyle: 'dashed' });
  assert.equal(dflt.strokeDashLen, 12);
  assert.equal(dflt.strokeGapLen, 12);
  // Half-authored never reaches the hook half-filled.
  const half = mk({ strokeStyle: 'dashed', strokeDash: 5 });
  assert.deepEqual([half.strokeDashLen, half.strokeGapLen], [5, 12]);
  // Authored 0 takes the width+10 fallback (SVG treats an all-zero dasharray as no
  // dashing). The kitchen-sink fixture settled the serialization half of this: Penpot
  // really does WRITE `strokeDash: 0` for an authored 0, so this is a deliberate
  // rendering divergence, not a mis-read — see tests/penpot-kitchen-sink.test.ts,
  // "authored dash/gap land in DesignNode strokeDashLen/strokeGapLen".
  const zero = mk({ strokeStyle: 'dashed', strokeDash: 0, strokeGap: 0 });
  assert.deepEqual([zero.strokeDashLen, zero.strokeGapLen], [12, 12]);
  // Fractional values survive (safe-numbers, rounded to 2dp like strokeW).
  assert.equal(mk({ strokeStyle: 'dashed', strokeDash: 1.239, strokeGap: 4 }).strokeDashLen, 1.24);

  // Key-spelling tolerance: kebab and ":kebab" alongside binfile-v3's camelCase.
  for (const st of [
    { 'stroke-style': 'dashed', 'stroke-dash': 8, 'stroke-gap': 3 },
    { ':stroke-style': 'dashed', ':stroke-dash': 8, ':stroke-gap': 3 },
  ]) {
    const n = mk(st);
    assert.equal(n.strokeDash, 'dashed', `spelling ${Object.keys(st)[0]}`);
    assert.deepEqual([n.strokeDashLen, n.strokeGapLen], [8, 3]);
  }
  // A solid stroke is byte-identical to before these fields existed.
  const solid = nodeToBox(mk({ strokeStyle: 'solid' }), { id: 'b0' }) as any;
  assert.deepEqual([solid.strokeDash, solid.strokeDashLen, solid.strokeGapLen], ['', 0, 0]);
});

test('nodeToBox: authored dash/gap ride the row as numbers, clamped and rounded', () => {
  const b = nodeToBox({ kind: 'box', x: 0, y: 0, w: 10, h: 10,
    strokeDashLen: 8.126, strokeGapLen: -4 } as any, { id: 'b0' }) as any;
  assert.equal(b.strokeDashLen, 8.13);
  assert.equal(b.strokeGapLen, 0);
  // Numbers, never strings: the compact blocks URL cannot carry a comma or a tilde.
  assert.equal(typeof b.strokeDashLen, 'number');
  const junk = nodeToBox({ kind: 'box', x: 0, y: 0, w: 10, h: 10,
    strokeDashLen: 'nope', strokeGapLen: Number.NaN } as any, { id: 'b1' }) as any;
  assert.deepEqual([junk.strokeDashLen, junk.strokeGapLen], [0, 0]);
});

test('penpotGroupToSvg: dash decoration bakes into the flattened SVG (was always solid)', () => {
  const mk = (strokes: unknown[]) => {
    const shapes: Record<string, any> = {
      g: { id: 'g', type: 'group', selrect: { x: 0, y: 0, width: 50, height: 40 }, shapes: ['p'] },
      p: { id: 'p', type: 'path', selrect: { x: 0, y: 0, width: 10, height: 10 },
        content: 'M0,0L10,10Z', fills: [], strokes },
    };
    return penpotGroupToSvg(shapes.g, (id) => shapes[id]);
  };
  // Authored dash/gap ride the attribute verbatim.
  assert.ok(mk([{ strokeColor: '#14ceca', strokeWidth: 2, strokeStyle: 'dashed', strokeDash: 8, strokeGap: 3 }])
    .includes('stroke-dasharray="8,3"'));
  // Untouched dashed → width + 10 for both, Penpot's renderer fallback.
  assert.ok(mk([{ strokeColor: '#14ceca', strokeWidth: 2, strokeStyle: 'dashed' }])
    .includes('stroke-dasharray="12,12"'));
  // Dotted is a ZERO-length dash, so it needs a cap or it paints nothing at all.
  const dotted = mk([{ strokeColor: '#14ceca', strokeWidth: 2, strokeStyle: 'dotted' }]);
  assert.ok(dotted.includes('stroke-dasharray="0,7"'), dotted);
  assert.ok(dotted.includes('stroke-linecap="round"'), dotted);
  // An authored cap wins over the dotted default.
  assert.ok(mk([{ strokeColor: '#14ceca', strokeWidth: 2, strokeStyle: 'dotted', strokeCapStart: 'square' }])
    .includes('stroke-linecap="square"'));
  // mixed = Penpot's four-part pattern.
  assert.ok(mk([{ strokeColor: '#14ceca', strokeWidth: 2, strokeStyle: 'mixed' }])
    .includes('stroke-dasharray="7,7,3,7"'));
  // "none" emits no stroke attributes whatsoever.
  const none = mk([{ strokeColor: '#14ceca', strokeWidth: 2, strokeStyle: 'none' }]);
  assert.ok(!none.includes('stroke='), none);
  assert.ok(!none.includes('stroke-dasharray'), none);
  // Solid keeps the pre-change emission byte-identical: no dasharray, no linecap.
  const solid = mk([{ strokeColor: '#14ceca', strokeWidth: 2, strokeOpacity: 0.5 }]);
  assert.ok(solid.includes('fill="none" stroke="#14ceca" stroke-width="2" stroke-opacity="0.5"'), solid);
  assert.ok(!solid.includes('stroke-dasharray'), solid);
  assert.ok(!solid.includes('stroke-linecap'), solid);
});

// ── Kitchen-sink fixture will add (named now, unwritable until a real 2.17 export
//    with an EDITED dashed stroke exists — the keynote has 0 dashed strokes and 0
//    strokeDash/strokeGap keys, so the camelCase spelling is inferred from the
//    encoder plus the fixture's uniform stroke-key convention):
//    * "fixture: an edited dashed stroke serializes strokeDash/strokeGap as camelCase
//      numbers on the stroke entry"
//    * "fixture: an untouched dashed stroke carries neither key"
//    * "fixture: a user-entered 0 dash exports as 0, and Penpot renders it as X"
//      (then revisit the clamp-to-unset above)
//    * "fixture: dotted strokes carry round caps, or the renderer forces one"
//    * "fixture: per-side stroke keys (strokePerSide, strokeWidthTop...) absent or
//      present in 2.17 exports"

// ── prototype-flow scene ordering (penpot-design-system.md §4) ───────────────
//
// Synthetic pages here — the shape of the real thing is pinned against the
// committed 2.17.1-RC4 export in tests/penpot-kitchen-sink.test.ts. These cover
// the walk's policy decisions, which one authored fixture can't enumerate.

/** Minimal page: boards `a,b,c...` each optionally carrying interactions. */
function flowPage(spec: Record<string, unknown[]>, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [id, interactions] of Object.entries(spec)) {
    out[id] = { id, type: 'frame', shapes: [], ...(interactions.length ? { interactions } : {}) };
  }
  return { ...out, ...extra };
}
const nav = (destination: string, animation?: unknown): Record<string, unknown> =>
  ({ eventType: 'click', actionType: 'navigate', destination, ...(animation ? { animation } : {}) });

test('penpotFlowOrder: no interactions → hasFlow false and the reading order copied through', () => {
  const shapes = flowPage({ a: [], b: [], c: [] });
  const r = penpotFlowOrder(['c', 'a', 'b'], shapes);
  assert.equal(r.hasFlow, false);
  assert.deepEqual(r.ordered, ['c', 'a', 'b']);
  assert.deepEqual(r.transitions, {});
  // A single board (or none) can carry no flow at all.
  assert.equal(penpotFlowOrder(['a'], shapes).hasFlow, false);
  assert.deepEqual(penpotFlowOrder([], shapes).ordered, []);
});

test('penpotFlowOrder: a click chain reorders the boards and the start is the in-degree-0 board', () => {
  // Reading order c,b,a; the flow says a → b → c.
  const shapes = flowPage({ a: [nav('b')], b: [nav('c')], c: [] });
  const r = penpotFlowOrder(['c', 'b', 'a'], shapes);
  assert.equal(r.hasFlow, true);
  assert.deepEqual(r.ordered, ['a', 'b', 'c']);
});

test('penpotFlowOrder: the page flow record beats the in-degree heuristic', () => {
  // b has an in-edge AND an out-edge, so the heuristic would start at a; the file
  // names b as the starting frame, and the file wins.
  const shapes = flowPage({ a: [nav('b')], b: [nav('c')], c: [] });
  const r = penpotFlowOrder(['a', 'b', 'c'], shapes, { flows: { f1: { name: 'Flow 1', startingFrame: 'b' } } });
  assert.deepEqual(r.ordered, ['b', 'c', 'a']);
  // An array-shaped flows collection reads the same, and an unknown startingFrame
  // falls back to the heuristic rather than dropping the flow.
  assert.deepEqual(penpotFlowOrder(['a', 'b', 'c'], shapes, { flows: [{ startingFrame: 'b' }] }).ordered, ['b', 'c', 'a']);
  assert.deepEqual(penpotFlowOrder(['a', 'b', 'c'], shapes, { flows: { f: { startingFrame: 'zz' } } }).ordered, ['a', 'b', 'c']);
});

test('penpotFlowOrder: a trigger anywhere INSIDE a board is an edge from that board, and nested destinations resolve up', () => {
  const shapes: Record<string, unknown> = {
    a: { id: 'a', type: 'frame', shapes: ['a-btn'] },
    'a-btn': { id: 'a-btn', type: 'rect', interactions: [nav('b-inner')] },
    b: { id: 'b', type: 'frame', shapes: ['b-inner'] },
    'b-inner': { id: 'b-inner', type: 'frame', shapes: [] },
  };
  const r = penpotFlowOrder(['b', 'a'], shapes);
  assert.equal(r.hasFlow, true);
  assert.deepEqual(r.ordered, ['a', 'b'], 'the button edge belongs to its board, and b-inner resolves to b');
});

test('penpotFlowOrder: cycles terminate, branches take the first authored edge and the rest follow in reading order', () => {
  // a → b → a is a cycle; a also branches to c (authored second).
  const shapes = flowPage({ a: [nav('b'), nav('c')], b: [nav('a')], c: [], d: [] });
  const r = penpotFlowOrder(['a', 'b', 'c', 'd'], shapes);
  assert.deepEqual(r.ordered, ['a', 'b', 'c', 'd']);
  assert.equal(r.ordered.length, new Set(r.ordered).size, 'every board placed exactly once');
});

test('penpotFlowOrder: unreachable boards are appended in reading order and keep walking their own chain', () => {
  // Flow a → b. Orphans: d (which navigates to c) and c, reading order c before d.
  const shapes = flowPage({ a: [nav('b')], b: [], c: [], d: [nav('c')] });
  const r = penpotFlowOrder(['a', 'b', 'c', 'd'], shapes);
  assert.deepEqual(r.ordered, ['a', 'b', 'c', 'd']);
  // With d ahead of c in reading order, d's own edge pulls c after it.
  assert.deepEqual(penpotFlowOrder(['a', 'b', 'd', 'c'], shapes).ordered, ['a', 'b', 'd', 'c']);
});

test('penpotFlowOrder: self-edges, unknown destinations and non-navigate actions are not flow', () => {
  const shapes = flowPage({
    a: [nav('a'), { eventType: 'click', actionType: 'open-url', destination: 'b' }, nav('nope')],
    b: [],
  });
  const r = penpotFlowOrder(['a', 'b'], shapes);
  assert.equal(r.hasFlow, false, 'none of those three is a usable edge');
  assert.deepEqual(r.ordered, ['a', 'b']);
  // The hyphenated spelling a future Penpot might write is accepted too.
  const hy = flowPage({ a: [{ eventType: 'click', actionType: 'navigate-to', destination: 'b' }], b: [] });
  assert.equal(penpotFlowOrder(['b', 'a'], hy).hasFlow, true);
  assert.deepEqual(penpotFlowOrder(['b', 'a'], hy).ordered, ['a', 'b']);
});

test('penpotAnimationToTransition: the full mapping table, and unknowns are a hard cut', () => {
  assert.deepEqual(penpotAnimationToTransition({ animationType: 'dissolve', duration: 300, easing: 'linear' }),
    { enter: 'fade', enterMs: 300 });
  // Both vocabularies name the direction the content TRAVELS, so direction passes
  // through: lolly's 'slide-right' is labelled "Slide from left".
  for (const type of ['slide', 'push']) {
    for (const dir of ['left', 'right', 'up', 'down']) {
      assert.deepEqual(penpotAnimationToTransition({ animationType: type, direction: dir, duration: 500, way: 'in' }),
        { enter: 'slide-' + dir, enterMs: 500 });
    }
  }
  // `way: 'out'` is ignored in v1 (exit transitions are not modelled).
  assert.deepEqual(penpotAnimationToTransition({ animationType: 'push', direction: 'up', duration: 200, way: 'out' }),
    { enter: 'slide-up', enterMs: 200 });
  // No animation, an unknown type, and a slide with no usable direction are cuts —
  // and a cut carries no enterMs at all.
  for (const a of [undefined, null, {}, { animationType: 'wobble', duration: 300 }, { animationType: 'slide', duration: 300 }, { animationType: 'slide', direction: 'sideways' }]) {
    assert.deepEqual(penpotAnimationToTransition(a), { enter: 'none' });
  }
  // Duration clamps into the timeline's 100..3000 window and rounds.
  assert.equal(penpotAnimationToTransition({ animationType: 'dissolve', duration: 10 }).enterMs, 100);
  assert.equal(penpotAnimationToTransition({ animationType: 'dissolve', duration: 99999 }).enterMs, 3000);
  assert.equal(penpotAnimationToTransition({ animationType: 'dissolve', duration: 249.6 }).enterMs, 250);
  assert.equal(penpotAnimationToTransition({ animationType: 'dissolve' }).enterMs, undefined, 'no duration → no enterMs');
});

test('penpotFlowOrder: the transition on the edge INTO a board becomes that board entrance, cuts excluded', () => {
  const shapes = flowPage({
    a: [nav('b', { animationType: 'dissolve', duration: 300 })],
    b: [nav('c', { animationType: 'push', direction: 'left', duration: 450 })],
    c: [nav('d', { animationType: 'wobble' })],
    d: [],
  });
  const r = penpotFlowOrder(['a', 'b', 'c', 'd'], shapes);
  assert.deepEqual(r.ordered, ['a', 'b', 'c', 'd']);
  assert.deepEqual(r.transitions, {
    b: { enter: 'fade', enterMs: 300 },
    c: { enter: 'slide-left', enterMs: 450 },
  }, 'the start board and a cut-entered board carry no entry at all');
});
