// SPDX-License-Identifier: MPL-2.0
/**
 * Stroke position (inside, centre, outside) and per-side stroke widths in Design.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/design-stroke-sides.test.ts
 *
 * One model, read in four places that have to agree: the Design renderer (the canvas and
 * every DOM export), the engine's drawing operations (the browser-free SVG and PDF), the
 * Penpot round trip and the PowerPoint lowering. The first test is the one that matters
 * most: a document that sets neither field renders exactly as it always did.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { JSDOM } from 'jsdom';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { makeGeomApi } from '../engine/src/geom-api.ts';
import { compileDesignDraw, compileDesignRow, type DrawShapeOp } from '../engine/src/design-draw.ts';
import { designDrawSvg } from '../engine/src/design-draw-svg.ts';
import { designDrawPdf } from '../engine/src/design-draw-pdf.ts';
import { prepareDesignRaster } from '../engine/src/design-draw-raster.ts';
import { designStrokeAlign, designStrokeOutset, designStrokeSides, strokeCentreArea, strokeRing } from '../engine/src/design-stroke.ts';
import { boxesToPenpotDoc, buildPenpotEntries, seededPenpotUuid } from '../engine/src/penpot-file.ts';
import { figmaNodesToNodes, nodeToBox, penpotShapeToNode } from '../engine/src/design-map.ts';
import { admitDesignLottieRow } from '../engine/src/design-draw-lottie.ts';
import { deckStrokeBand, deckStrokePlan } from '../packages/node-shell/src/design-pptx-stroke.ts';
import { EMU_PER_PX } from '../engine/src/pptx.ts';
import { baseHost } from './helpers/host.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const geom = makeGeomApi();
const tool: any = await loadTool('design', (path: string) => readFile(join(ROOT, 'community', path), 'utf8'));

/** The hydrated render, less the raw rows the Penpot writer reads (which echo every field). */
async function mount(boxes: unknown[]): Promise<string> {
  const rt = await createRuntime(tool, baseHost({ geom }), { boxes: boxes as never });
  assert.deepEqual(rt.hookErrors ?? [], [], 'no hook errors');
  return (rt.getHydrated() as string).replace(/<script type="application\/json" data-penpot-doc>[\s\S]*?<\/script>/, '');
}
/** The style attribute of the box with this id. */
function styleOf(html: string, id: string): string {
  const el = new JSDOM(html).window.document.querySelector(`[data-box-id="${id}"]`);
  assert.ok(el, `box ${id} renders`);
  return el!.getAttribute('style') ?? '';
}
const deckOf = (html: string): any => JSON.parse(new JSDOM(html).window.document.querySelector('[data-pptx-deck]')?.textContent ?? 'null');

const BOX = { id: 'b', kind: 'box', x: 100, y: 50, w: 200, h: 120, shape: 'rect', bg: '#eeeeee', stroke: '#ff0000', strokeW: 4 };
const SIDES = { strokeTop: '', strokeRight: '', strokeBottom: '', strokeLeft: '', strokeAlign: '' };

test('a box that sets neither field renders exactly as before, and so does one whose fields came back empty from a link', async () => {
  const plain = await mount([BOX]);
  assert.match(styleOf(plain, 'b'), /left:100px;top:50px;width:200px;height:120px;/);
  assert.match(styleOf(plain, 'b'), /border:4px solid #ff0000;/);
  assert.doesNotMatch(styleOf(plain, 'b'), /background-clip|transform-origin|border-width/);
  // The compact blocks URL pads a missing field to '', which must read as absent.
  assert.equal(await mount([{ ...BOX, ...SIDES }]), plain);
  assert.equal(await mount([{ ...BOX, strokeAlign: 'inside' }]), plain, 'inside is the box default, spelled out');
});

test('per-side widths are the border\'s own four widths; 0 hides a side and an empty side uses the width', async () => {
  const style = styleOf(await mount([{ ...BOX, strokeTop: 0, strokeBottom: 8 }]), 'b');
  assert.match(style, /border-style:solid;border-color:#ff0000;border-width:0px 4px 8px 4px;/);
  assert.match(style, /left:100px;top:50px;width:200px;height:120px;/, 'an inside stroke never moves the box');
  // A side alone strokes even when the width is 0: a bottom rule with nothing else.
  assert.match(styleOf(await mount([{ ...BOX, strokeW: 0, strokeBottom: 2 }]), 'b'), /border-width:0px 0px 2px 0px;/);
  // An ellipse draws one width all round.
  assert.match(styleOf(await mount([{ ...BOX, shape: 'ellipse', strokeTop: 0 }]), 'b'), /border:4px solid #ff0000;/);
});

test('an outside or centred stroke grows the box element past its frame and keeps the fill inside the stroke', async () => {
  const out = styleOf(await mount([{ ...BOX, shape: 'rounded', radius: 10, strokeAlign: 'outside' }]), 'b');
  assert.match(out, /left:96px;top:46px;width:208px;height:128px;/);
  assert.match(out, /border-radius:14px;/, 'a rounded corner grows by the stroke');
  assert.match(out, /background-clip:padding-box;/);
  assert.doesNotMatch(out, /transform-origin/, 'an even stroke keeps the centre');
  const centre = styleOf(await mount([{ ...BOX, strokeAlign: 'center' }]), 'b');
  assert.match(centre, /left:98px;top:48px;width:204px;height:124px;/);
  assert.match(centre, /border-radius:0;/, 'a sharp corner stays sharp');
  // Uneven sides move the centre of the grown element, so the turn pivots on the frame's own centre.
  const uneven = styleOf(await mount([{ ...BOX, rot: 30, strokeAlign: 'outside', strokeTop: 10, strokeLeft: 0 }]), 'b');
  assert.match(uneven, /left:100px;top:40px;width:204px;height:134px;/);
  assert.match(uneven, /transform-origin:100px 70px;/);
});

test('a board strokes per side inside its page, and its members stay on their model coordinates', async () => {
  const html = await mount([
    { id: 'f', kind: 'frame', x: 0, y: 0, w: 400, h: 300, order: 0, bg: '#ffffff', stroke: '#000000', strokeW: 2, strokeLeft: 10, strokeTop: 6, strokeAlign: 'outside' },
    { id: 'c', kind: 'box', x: 50, y: 40, w: 100, h: 80, bg: '#30ba78', frame: 'f' },
    { id: 'o', kind: 'box', x: 200, y: 40, w: 100, h: 80, bg: '#30ba78', stroke: '#000000', strokeW: 4, strokeAlign: 'outside', frame: 'f' },
  ]);
  const page = new JSDOM(html).window.document.querySelector('.lolly-frame-page')!.getAttribute('style')!;
  assert.match(page, /border-width:6px 2px 2px 10px;/);
  assert.match(page, /width:400px;height:300px;/, 'a board ignores the position: its page edge is the export edge');
  // Each member is pulled back by the left and top border widths it is pushed in by.
  assert.match(styleOf(html, 'c'), /left:40px;top:34px;$/);
  // A member with its own outside stroke starts that much further up and left again.
  assert.match(styleOf(html, 'o'), /left:186px;top:30px;$/);
});

test('a closed pen path strokes inside or outside by a doubled, clipped stroke; an open path stays centred', async () => {
  const closed = geom.encodeAuthored({ kind: 'line', nodes: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], closed: true });
  const open = geom.encodeAuthored({ kind: 'line', nodes: [{ x: 0, y: 0 }, { x: 1, y: 1 }], closed: false });
  assert.ok(closed.ok && open.ok);
  const path = { id: 'p', kind: 'path', x: 10, y: 10, w: 100, h: 100, bg: '#30ba78', stroke: '#000000', strokeW: 6 };
  const inside = await mount([{ ...path, path: closed.value, strokeAlign: 'inside' }]);
  assert.match(inside, /<clipPath id="lly-sp-[0-9a-z]+"><path d="[^"]+" clip-rule="nonzero"><\/path><\/clipPath>/);
  assert.match(inside, /stroke-width="12"[^>]* clip-path="url\(#lly-sp-/);
  assert.doesNotMatch(inside, /style="inset:auto/, 'an inside stroke never reaches past the curve, so it needs no pad');
  const outside = await mount([{ ...path, path: closed.value, strokeAlign: 'outside' }]);
  assert.match(outside, /clip-rule="evenodd"/);
  assert.match(outside, /style="inset:auto;left:-6px;top:-6px;/, 'an outside stroke reaches a whole width out');
  const centred = await mount([{ ...path, path: open.value, strokeAlign: 'outside' }]);
  assert.doesNotMatch(centred, /clipPath/);
  assert.equal(centred, await mount([{ ...path, path: open.value }]));
});

test('the deck model draws an outside line on a grown shape and per-side widths as a ring of their own', async () => {
  const deck = deckOf(await mount([
    { id: 'f', kind: 'frame', x: 0, y: 0, w: 1080, h: 1080, order: 0, bg: '#ffffff' },
    { id: 'o', kind: 'box', x: 100, y: 100, w: 200, h: 100, bg: '#30ba78', stroke: '#000000', strokeW: 4, strokeAlign: 'outside', frame: 'f' },
    { id: 's', kind: 'box', x: 400, y: 100, w: 200, h: 100, bg: '#30ba78', stroke: '#000000', strokeW: 0, strokeBottom: 6, frame: 'f' },
    { id: 'u', kind: 'box', x: 700, y: 100, w: 200, h: 100, bg: '#30ba78', stroke: '#000000', strokeW: 4, frame: 'f' },
  ]));
  const [grown, plain, band, legacy] = deck.slides[0].elements;
  assert.deepEqual([grown.x, grown.y, grown.w, grown.h, grown.line.w], [98, 98, 204, 104, 4]);
  assert.equal(plain.t, 'rect');
  assert.equal(plain.line, undefined, 'the shape under the ring has no line');
  assert.equal(band.t, 'path');
  assert.equal(band.fill, '#000000');
  assert.equal(band.d, 'M0 0 L200 0 L200 100 L0 100 L0 0 Z M0 0 L0 94 L200 94 L200 0 L0 0 Z', 'outer edge, then the inner edge wound back');
  assert.deepEqual([legacy.x, legacy.w, legacy.line.w], [700, 200, 4], 'an inside stroke keeps the line older exports wrote');
});

test('the engine helpers read the fields as the renderer does', () => {
  assert.equal(designStrokeAlign({ kind: 'box' }), 'inside');
  assert.equal(designStrokeAlign({ kind: 'path' }), 'center');
  assert.equal(designStrokeAlign({ kind: 'frame', strokeAlign: 'outside' }), 'inside');
  assert.equal(designStrokeAlign({ kind: 'box', strokeAlign: 'constructor' }), 'inside');
  assert.deepEqual(designStrokeSides({ strokeW: 3, strokeTop: '', strokeRight: '0', strokeBottom: 900 }), [3, 0, 400, 3]);
  assert.deepEqual(designStrokeSides({ kind: 'box', shape: 'circle', strokeW: 3, strokeTop: 9 }), [3, 3, 3, 3]);
  assert.deepEqual(designStrokeOutset({ kind: 'box', stroke: '#000', strokeW: 4, strokeAlign: 'center', strokeTop: 8 }), [4, 2, 2, 2]);
  assert.deepEqual(designStrokeOutset({ kind: 'box', strokeW: 4, strokeAlign: 'center' }), [0, 0, 0, 0], 'no colour, no stroke');
  // CSS corner shaping: inner corners are the outer ones less the widths beside them.
  const ring = strokeRing({ x: 0, y: 0, w: 100, h: 60 }, { kind: 'rect', radius: 12 }, 'inside', [10, 2, 2, 4]);
  assert.deepEqual(ring.outer, { box: { x: 0, y: 0, w: 100, h: 60 }, shape: { kind: 'rect', radius: 12 } });
  assert.deepEqual(ring.inner, { box: { x: 4, y: 10, w: 94, h: 48 }, shape: { kind: 'rect', radius: 2, corners: [8, 2, 10, 2, 10, 10, 8, 10] } });
  assert.deepEqual(strokeCentreArea({ x: 0, y: 0, w: 100, h: 60 }, { kind: 'rect', radius: 0 }, 'outside', 4), { box: { x: -2, y: -2, w: 104, h: 64 }, shape: { kind: 'rect', radius: 0 } });
});

test('the drawing operations carry the position and the sides, and the SVG and PDF writers draw them', () => {
  const page = (row: Record<string, unknown>) => compileDesignDraw([
    { id: 'f', kind: 'frame', x: 0, y: 0, w: 400, h: 300 },
    { ...row, frame: 'f' },
  ], { width: 400, height: 300 });
  const svg = (p: ReturnType<typeof page>) => designDrawSvg(p, { assetHref: () => undefined, family: () => 'sans-serif', mono: 'monospace' });
  // Unchanged when the fields are unset or empty.
  assert.equal(svg(page({ ...BOX, ...SIDES })), svg(page(BOX)));
  const centred = page({ ...BOX, strokeAlign: 'center' });
  assert.equal((centred.ops[0] as DrawShapeOp).stroke!.align, 'center');
  const centredSvg = svg(centred);
  assert.match(centredSvg, /<rect x="102" y="52" width="196" height="116" fill="#eeeeee"\/>/, 'the fill sits inside the stroke');
  assert.match(centredSvg, /<rect x="100" y="50" width="200" height="120" fill="none" stroke="#ff0000" stroke-width="4"\/>/, 'the stroke runs along the outline');
  const sided = page({ ...BOX, strokeTop: 0, strokeBottom: 10 });
  assert.deepEqual((sided.ops[0] as DrawShapeOp).stroke!.sides, [0, 4, 10, 4]);
  assert.equal((sided.ops[0] as DrawShapeOp).stroke!.width, 10);
  // An inside border paints over the fill, which covers the whole box.
  assert.match(svg(sided), /<rect x="100" y="50" width="200" height="120" fill="#eeeeee"\/><path d="M100 50[^"]*ZM[^"]*Z" fill-rule="evenodd" fill="#ff0000"\/>/);
  const pdf = new TextDecoder('latin1').decode(designDrawPdf([{ page: sided, pictures: new Map(), size: { w: 300, h: 225 } }], {}));
  assert.ok(pdf.startsWith('%PDF-'), 'the PDF writer draws the ring');
  // A closed path stroked outside: twice the width, clipped to everything but the shape.
  const closed = geom.encodeAuthored({ kind: 'line', nodes: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], closed: true });
  assert.ok(closed.ok);
  const op = compileDesignRow({ id: 'p', kind: 'path', x: 0, y: 0, w: 50, h: 50, stroke: '#000000', strokeW: 3, strokeAlign: 'outside', path: closed.value }, { x: 0, y: 0 }) as DrawShapeOp;
  assert.equal(op.stroke!.align, 'outside');
  const pathSvg = svg({ ...page(BOX), ops: [op] });
  assert.match(pathSvg, /clip-rule="evenodd"/);
  assert.match(pathSvg, /stroke-width="6"[^>]* clip-path="url\(#sk/);
});

test('the raster evaluation refuses the new cases by name rather than drawing them elsewhere', () => {
  const result = prepareDesignRaster(compileDesignDraw([
    { id: 'f', kind: 'frame', x: 0, y: 0, w: 400, h: 300 },
    { ...BOX, strokeAlign: 'outside', frame: 'f' },
  ], { width: 400, height: 300 }));
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.findings.some((f) => f.feature === 'raster-stroke-position'));
});

test('Penpot: position maps to stroke alignment and per-side widths to the 2.19 fields, only when they differ', () => {
  const records = (boxes: Record<string, unknown>[]) => {
    const build = buildPenpotEntries(boxesToPenpotDoc(boxes, { name: 'Strokes', canvas: { w: 1000, h: 600 } }), { uuid: seededPenpotUuid(7), now: () => '2026-10-30T00:00:00.000Z' });
    return Object.entries(build.entries).filter(([p]) => /\/pages\/[^/]+\/[^/]+\.json$/.test(p)).map(([, v]) => JSON.parse(String(v)));
  };
  const byName = (recs: any[], name: string) => recs.find((r) => r.name === name);
  const recs = records([
    { ...BOX, id: 'legacy', name: 'legacy' },
    { ...BOX, id: 'out', name: 'out', strokeAlign: 'outside' },
    { ...BOX, id: 'in', name: 'in', strokeAlign: 'inside' },
    { ...BOX, id: 'sides', name: 'sides', strokeW: 0, strokeBottom: 6 },
  ]);
  const legacy = byName(recs, 'legacy').strokes[0];
  assert.equal(legacy.strokeAlignment, 'center', 'a row with no position keeps the record this writer always wrote');
  assert.equal(legacy.strokeWidthTop, undefined, 'a uniform stroke writes no side fields');
  assert.equal(byName(recs, 'out').strokes[0].strokeAlignment, 'outer');
  assert.equal(byName(recs, 'in').strokes[0].strokeAlignment, 'inner');
  const sides = byName(recs, 'sides').strokes[0];
  assert.deepEqual([sides.strokeWidth, sides.strokeWidthTop, sides.strokeWidthRight, sides.strokeWidthBottom, sides.strokeWidthLeft], [0, 0, 0, 6, 0],
    'the width is the top width, as Penpot keeps it');
});

test('Penpot and Figma imports keep the alignment and the widths per side', () => {
  const base = { id: 'r', type: 'rect', selrect: { x: 10, y: 10, width: 100, height: 50 }, fills: [{ fillColor: '#ffffff' }] };
  const divider = penpotShapeToNode({ ...base, strokes: [{ strokeColor: '#000000', strokeWidth: 0, strokeWidthBottom: 2, strokeAlignment: 'inner' }] }) as any;
  assert.deepEqual([divider.strokeW, divider.strokeTop, divider.strokeRight, divider.strokeBottom, divider.strokeLeft, divider.strokeAlign], [2, 0, 0, 2, 0, 'inside']);
  const box = nodeToBox(divider, { id: 'b0' }) as any;
  assert.deepEqual([box.strokeAlign, box.strokeBottom, box.strokeTop], ['inside', 2, 0]);
  const uniform = nodeToBox(penpotShapeToNode({ ...base, strokes: [{ strokeColor: '#000000', strokeWidth: 3, strokeAlignment: 'inner' }] })!, { id: 'b1' }) as any;
  assert.equal(uniform.strokeTop, undefined, 'one width all round writes no side fields');

  const doc = [
    { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT' },
    { guid: { sessionID: 0, localID: 1 }, type: 'CANVAS', parentIndex: { guid: { sessionID: 0, localID: 0 } } },
    { guid: { sessionID: 1, localID: 1 }, type: 'RECTANGLE', parentIndex: { guid: { sessionID: 0, localID: 1 } },
      size: { x: 100, y: 50 }, transform: { m00: 1, m01: 0, m02: 10, m10: 0, m11: 1, m12: 20 },
      fillPaints: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }],
      strokePaints: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 0.5 }], strokeWeight: 1, strokeAlign: 'OUTSIDE',
      individualStrokeWeights: { top: 4, right: 1, bottom: 1, left: 1 } },
  ];
  const fig = figmaNodesToNodes(doc as never) as any[];
  const rect = fig.find((n) => n.kind === 'box');
  assert.deepEqual([rect.stroke, rect.strokeW, rect.strokeAlign, rect.strokeTop, rect.strokeRight], ['#00000080', 4, 'outside', 4, 1]);
});

test('PowerPoint: an outside stroke grows the shape, per-side widths become a ring, and other rows are left alone', () => {
  assert.equal(deckStrokePlan(BOX), null);
  assert.equal(deckStrokePlan({ ...BOX, ...SIDES }), null);
  assert.equal(deckStrokePlan({ ...BOX, strokeAlign: 'center' }), null, 'a centred stroke is already PowerPoint\'s line');
  const out = deckStrokePlan({ ...BOX, strokeAlign: 'outside' })!;
  assert.deepEqual([out.row.x, out.row.y, out.row.w, out.row.h, out.band], [98, 48, 204, 124, undefined]);
  const sided = deckStrokePlan({ ...BOX, strokeTop: 0, strokeBottom: 8 })!;
  assert.equal(sided.row.strokeW, 0, 'the shape under the ring has no line');
  const band = deckStrokeBand({ ...BOX, strokeTop: 0, strokeBottom: 8 }, sided.band!, { x: 0, y: 0 }, '#ff0000');
  assert.equal(band.kind, 'path');
  assert.deepEqual([band.cx, band.cy], [200 * EMU_PER_PX, 120 * EMU_PER_PX]);
  // An accessor row is never read through its getter: the lowering keeps its read log.
  const accessor = { ...BOX };
  Object.defineProperty(accessor, 'strokeAlign', { enumerable: true, get() { throw new Error('read'); } });
  assert.equal(deckStrokePlan(accessor), null);
});

test('dotLottie refuses what a centred, one-width Lottie stroke would draw elsewhere', () => {
  assert.doesNotThrow(() => admitDesignLottieRow({ ...BOX, strokeAlign: 'center' }));
  assert.throws(() => admitDesignLottieRow({ ...BOX, strokeAlign: 'outside' }), /stroke position/);
  assert.throws(() => admitDesignLottieRow({ ...BOX, strokeBottom: 9 }), /each side/);
  assert.throws(() => admitDesignLottieRow({ ...BOX, kind: 'path', strokeAlign: 'inside' }), /stroke position/);
});
