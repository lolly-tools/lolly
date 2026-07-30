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
  safeColor, nodeToBox, finalizeBoxes, parsePenpotContent, penpotShapeToNode,
  figmaNodesToNodes, figmaNodesToScenes, readingOrder, colorRunsToText, decodeFigVectorPath, penpotGradientToSpec,
  penpotPathContentToD, penpotGradientSvgDef, penpotGroupToSvg,
} from '../engine/src/design-map.ts';

const close = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;

// The SUSE profile's vocabulary, as its web shell threads it in (from the SUSE
// layout-studio manifest's font select + addKinds seeds) — the engine itself no
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
  assert.deepEqual(n._vectorStroke, { color: '#f23ae5', width: 4, opacity: 1 });
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
