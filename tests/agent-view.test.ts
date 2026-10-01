// SPDX-License-Identifier: MPL-2.0
/**
 * engine/src/agent-view.ts and engine/src/edge-trace.ts: the helpers that let an
 * agent look at a render in the render's own coordinates (plans/289 section 6).
 *
 * Run with: node --test tests/agent-view.test.ts
 *
 * The SVG work is checked as text and, where the claim is about pixels (a
 * framed region, a grid line, a sampled colour), by rasterising with resvg, the
 * rasteriser the MCP server and the CLI use.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Resvg } from '@resvg/resvg-js';

import {
  clampRegion,
  gridOverlaySvg,
  nearestSwatch,
  niceGridSpacing,
  rasterAsSvg,
  reframeSvg,
  sampleDisc,
  svgDocumentFrame,
  viewSize,
  type PixelImage,
} from '../engine/src/agent-view.ts';
import { polylineToDesignLayer, simplifyPolyline, traceEdges } from '../engine/src/edge-trace.ts';
import { decodeAuthoredPath } from '../engine/src/geom/authored-url.ts';

function raster(svg: string): PixelImage {
  const img = new Resvg(svg, { font: { loadSystemFonts: false } }).render();
  return { data: img.pixels, width: img.width, height: img.height, premultiplied: true };
}
const at = (img: PixelImage, x: number, y: number) => {
  const i = (y * img.width + x) * 4;
  return [img.data[i]!, img.data[i + 1]!, img.data[i + 2]!, img.data[i + 3]!];
};

// A 200 x 100 document: left half red, right half blue, a green square at 150,40.
const DOC = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" width="200" height="100" style="width:100%;height:auto;display:block">'
  + '<rect width="100" height="100" fill="#ff0000"/><rect x="100" width="100" height="100" fill="#0000ff"/>'
  + '<rect x="150" y="40" width="20" height="20" fill="#00ff00"/></svg>';

test('frame: the viewBox, else width and height, else nothing', () => {
  assert.deepEqual(svgDocumentFrame(DOC), { x: 0, y: 0, w: 200, h: 100 });
  assert.deepEqual(svgDocumentFrame('<svg viewBox="10 20 30 40"></svg>'), { x: 10, y: 20, w: 30, h: 40 });
  assert.deepEqual(svgDocumentFrame('<svg width="64px" height="32"></svg>'), { x: 0, y: 0, w: 64, h: 32 });
  assert.equal(svgDocumentFrame('<svg width="100%"></svg>'), null);
  assert.equal(svgDocumentFrame('<div></div>'), null);
});

test('region: clamped inside the document; a miss or junk is the whole document', () => {
  const f = { x: 0, y: 0, w: 200, h: 100 };
  assert.deepEqual(clampRegion(f, { x: 150, y: 50, w: 100, h: 100 }), { x: 150, y: 50, w: 50, h: 50 });
  assert.deepEqual(clampRegion(f, { x: 500, y: 500, w: 10, h: 10 }), f);
  assert.deepEqual(clampRegion(f, { x: 0, y: 0, w: -5, h: 10 }), f);
  assert.deepEqual(clampRegion(f, null), f);
});

test('size: the whole document is never enlarged; a region fills maxSide up to the zoom cap', () => {
  const f = { x: 0, y: 0, w: 200, h: 100 };
  assert.deepEqual(viewSize(f, f, 1024), { width: 200, height: 100, pxPerUnit: 1 });
  assert.deepEqual(viewSize({ x: 0, y: 0, w: 4000, h: 2000 }, { x: 0, y: 0, w: 4000, h: 2000 }, 1000), { width: 1000, height: 500, pxPerUnit: 0.25 });
  assert.deepEqual(viewSize(f, { x: 150, y: 40, w: 20, h: 20 }, 100), { width: 100, height: 100, pxPerUnit: 5 });
  assert.equal(viewSize(f, { x: 150, y: 40, w: 20, h: 20 }, 1024).pxPerUnit, 8, 'capped at 8x');
});

test('reframe: only the root size changes, and the region is what is drawn', () => {
  const out = reframeSvg(DOC, { x: 140, y: 30, w: 40, h: 40 }, 80, 80);
  assert.match(out, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" style="display:block" viewBox="140 30 40 40" width="80" height="80" preserveAspectRatio="none">/);
  assert.equal(out.split('<rect').length, DOC.split('<rect').length, 'the drawing is untouched');
  const img = raster(out);
  assert.deepEqual([img.width, img.height], [80, 80]);
  assert.deepEqual(at(img, 40, 40), [0, 255, 0, 255], 'the green square sits in the middle of the region');
  assert.deepEqual(at(img, 2, 2), [0, 0, 255, 255], 'blue around it');
});

test('reframe: the overlay is drawn last, in document units, and a self-closing root works', () => {
  const out = reframeSvg(DOC, { x: 0, y: 0, w: 200, h: 100 }, 200, 100, '<rect x="0" y="0" width="10" height="10" fill="#ffffff"/>');
  assert.ok(out.endsWith('<rect x="0" y="0" width="10" height="10" fill="#ffffff"/></svg>'));
  assert.deepEqual(at(raster(out), 5, 5), [255, 255, 255, 255]);
  assert.match(reframeSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"/>', { x: 0, y: 0, w: 4, h: 4 }, 4, 4, '<g/>'), /<g\/><\/svg>$/);
  assert.throws(() => reframeSvg('<div/>', { x: 0, y: 0, w: 1, h: 1 }, 1, 1));
});

test('raster as SVG: an image becomes a document whose units are its pixels', () => {
  const png = new Resvg(DOC).render().asPng();
  const svg = rasterAsSvg('image/png', Buffer.from(png).toString('base64'), 200, 100);
  assert.deepEqual(svgDocumentFrame(svg), { x: 0, y: 0, w: 200, h: 100 });
  const img = raster(reframeSvg(svg, { x: 150, y: 40, w: 20, h: 20 }, 20, 20));
  assert.deepEqual(at(img, 10, 10).slice(0, 3), [0, 255, 0]);
  assert.throws(() => rasterAsSvg('text/html', 'AAAA', 1, 1));
  assert.throws(() => rasterAsSvg('image/png', '"><script>', 1, 1));
});

test('grid spacing: a round step giving about ten divisions', () => {
  assert.equal(niceGridSpacing(1920), 200);
  assert.equal(niceGridSpacing(1080), 100);
  assert.equal(niceGridSpacing(100), 10);
  assert.equal(niceGridSpacing(37), 5);
  assert.equal(niceGridSpacing(0), 1);
});

test('grid: lines at every multiple of the spacing, readable over dark and light', () => {
  const grid = gridOverlaySvg({ x: 0, y: 0, w: 200, h: 100 }, 50, 1);
  assert.match(grid, /data-lolly-view-grid/);
  for (const x of [0, 50, 100, 150, 200]) assert.ok(grid.includes(`M${x} 0V100`), `vertical line at ${x}`);
  for (const y of [0, 50, 100]) assert.ok(grid.includes(`M0 ${y}H200`), `horizontal line at ${y}`);
  assert.equal(gridOverlaySvg({ x: 0, y: 0, w: 200, h: 100 }, 0, 1), '');
  // On the red half the line at x=50 lightens; on a white page it darkens.
  const onRed = raster(reframeSvg(DOC, { x: 0, y: 0, w: 200, h: 100 }, 200, 100, grid));
  assert.notDeepEqual(at(onRed, 50, 70), [255, 0, 0, 255]);
  const white = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><rect width="200" height="100" fill="#fff"/></svg>';
  const onWhite = raster(reframeSvg(white, { x: 0, y: 0, w: 200, h: 100 }, 200, 100, grid));
  assert.ok(at(onWhite, 50, 70)[0]! < 250, 'a line shows on white');
  assert.deepEqual(at(onWhite, 75, 70), [255, 255, 255, 255], 'between lines the page is untouched');
});

test('grid: labels name the document coordinates, drawn without any font', () => {
  const grid = gridOverlaySvg({ x: 1000, y: 0, w: 400, h: 300 }, 100, 1);
  assert.doesNotMatch(grid, /<text/);
  // The label paths are drawn twice (halo, then ink); the ink pass has strokes.
  const labelPaths = [...grid.matchAll(/<path d="([^"]+)" stroke="#000" stroke-width/g)];
  assert.equal(labelPaths.length, 1);
  const img = raster(reframeSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="1000 0 400 300"><rect x="1000" width="400" height="300" fill="#fff"/></svg>', { x: 1000, y: 0, w: 400, h: 300 }, 400, 300, grid));
  let ink = 0;
  for (let y = 2; y < 14; y++) for (let x = 2; x < 40; x++) if (at(img, x, y)[0]! < 128) ink++;
  assert.ok(ink > 20, `the "1000" label is drawn at the top left (${ink} dark pixels)`);
});

test('sampling: a disc average, premultiplied or straight, and transparent reads as no colour', () => {
  const img = raster(DOC);
  assert.equal(sampleDisc(img, 50, 50, 2).hex, '#ff0000');
  assert.equal(sampleDisc(img, 160, 50, 0).hex, '#00ff00');
  const edge = sampleDisc(img, 100, 50, 0.6);
  assert.ok(edge.rgb![0] > 0 && edge.rgb![2] > 0, 'a disc across the seam mixes red and blue');
  const straight: PixelImage = { data: [255, 0, 0, 128, 0, 0, 255, 255], width: 2, height: 1 };
  assert.equal(sampleDisc(straight, 0.5, 0.5, 0).hex, '#ff0000', 'straight alpha keeps the colour of a half-transparent pixel');
  const premul: PixelImage = { data: [128, 0, 0, 128], width: 1, height: 1, premultiplied: true };
  assert.equal(sampleDisc(premul, 0.5, 0.5, 0).hex, '#ff0000');
  const clear: PixelImage = { data: [0, 0, 0, 0], width: 1, height: 1 };
  assert.deepEqual(sampleDisc(clear, 0.5, 0.5, 3), { hex: null, rgb: null, alpha: 0, oklab: null });
  const ok = sampleDisc(img, 50, 50, 1).oklab!;
  assert.ok(Math.abs(ok[0] - 0.628) < 0.01, `OKLab L of pure red is about 0.628 (${ok[0]})`);
});

test('nearest swatch: exact is a match, a near miss is close, a stranger is different', () => {
  const sw = [{ value: '#30ba78', name: 'Jungle', path: 'color.brand.jungle' }, { value: '#0c322c', name: 'Pine' }, { value: 'not a colour' }];
  const exact = nearestSwatch('#30ba78', sw)!;
  assert.equal(exact.swatch.name, 'Jungle');
  assert.equal(exact.deltaE, 0);
  assert.equal(exact.verdict, 'match');
  assert.equal(nearestSwatch('#2fb878', sw)!.verdict, 'match');
  assert.equal(nearestSwatch('#40c088', sw)!.verdict, 'close');
  const far = nearestSwatch('#ff00ff', sw)!;
  assert.equal(far.verdict, 'different');
  assert.equal(nearestSwatch('#ffffff', []), null);
  assert.equal(nearestSwatch('nope', sw), null);
});

// ── edge tracing ─────────────────────────────────────────────────────────────

function canvas(w: number, h: number, paint: (x: number, y: number) => [number, number, number, number]): PixelImage {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(paint(x, y), (y * w + x) * 4);
  return { data, width: w, height: h };
}

test('edges: a square is one closed outline around the square', () => {
  const img = canvas(80, 80, (x, y) => (x >= 20 && x < 60 && y >= 20 && y < 60 ? [255, 255, 255, 255] : [0, 0, 0, 255]));
  const edges = traceEdges(img, { detail: 50, minLength: 20, simplify: 2 });
  assert.equal(edges.length, 1);
  const [e] = edges;
  assert.ok(e!.closed, 'an outline is closed');
  assert.ok(e!.length > 130 && e!.length < 175, `perimeter about 160 (${e!.length})`);
  for (const [x, y] of e!.points) {
    const nearSide = Math.min(Math.abs(x - 20), Math.abs(x - 60), Math.abs(y - 20), Math.abs(y - 60));
    assert.ok(nearSide < 3, `point ${x},${y} lies on the square's edge`);
  }
  assert.ok(e!.points.length <= 12, 'simplified to its corners and a few more');
});

test('edges: a step is one open line across the picture', () => {
  const img = canvas(100, 60, (_x, y) => (y < 30 ? [20, 20, 20, 255] : [230, 230, 230, 255]));
  const [e] = traceEdges(img);
  assert.ok(e && !e.closed);
  const xs = e!.points.map(p => p[0]);
  assert.ok(Math.min(...xs) < 5 && Math.max(...xs) > 95, 'runs edge to edge');
  for (const [, y] of e!.points) assert.ok(Math.abs(y - 30) < 2);
});

test('edges: detail decides how faint an edge may be', () => {
  const faint = canvas(60, 60, (x) => (x < 30 ? [100, 100, 100, 255] : [112, 112, 112, 255]));
  assert.equal(traceEdges(faint, { detail: 0 }).length, 0);
  assert.equal(traceEdges(faint, { detail: 100 }).length, 1);
});

test('edges: a cut-out on transparency has its outline traced', () => {
  const img = canvas(60, 60, (x, y) => (Math.hypot(x - 30, y - 30) < 15 ? [0, 0, 0, 255] : [0, 0, 0, 0]));
  const [e] = traceEdges(img);
  assert.ok(e?.closed, 'the disc outline is closed');
  assert.ok(e!.length > 80 && e!.length < 110, `circumference about 94 (${e!.length})`);
});

test('edges: deterministic, longest first, and capped', () => {
  const img = canvas(90, 90, (x, y) => ((x >= 10 && x < 30 && y >= 10 && y < 30) || (x >= 40 && x < 85 && y >= 40 && y < 85) ? [255, 255, 255, 255] : [0, 0, 0, 255]));
  const a = traceEdges(img), b = traceEdges(img);
  assert.deepEqual(a, b);
  assert.equal(a.length, 2);
  assert.ok(a[0]!.length > a[1]!.length);
  assert.equal(traceEdges(img, { maxLines: 1 }).length, 1);
  assert.equal(traceEdges(img, { minLength: 1000 }).length, 0);
});

test('simplify: Douglas-Peucker keeps the corners of a staircase-free L', () => {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 10; i++) pts.push([i, 0]);
  for (let j = 1; j <= 10; j++) pts.push([10, j]);
  assert.deepEqual(simplifyPolyline(pts, 0.5), [[0, 0], [10, 0], [10, 10]]);
  assert.equal(simplifyPolyline(pts, 0).length, pts.length);
});

test('a traced line becomes a Design path layer with nodes as fractions of its box', () => {
  const layer = polylineToDesignLayer([[100, 50], [300, 50], [300, 150]], false, { stroke: '#123456', strokeW: 3 });
  assert.deepEqual({ ...layer, path: undefined }, { kind: 'path', x: 100, y: 50, w: 200, h: 100, path: undefined, stroke: '#123456', strokeW: 3, bg: '' });
  const path = decodeAuthoredPath(layer.path)!;
  assert.equal(path.kind, 'line');
  assert.equal(path.closed, false);
  assert.deepEqual(path.nodes.map(n => [n.x, n.y]), [[0, 0], [1, 0], [1, 1]]);
  const flat = polylineToDesignLayer([[0, 10], [50, 10]], false);
  assert.equal(flat.h, 1);
  assert.deepEqual(decodeAuthoredPath(flat.path)!.nodes.map(n => n.y), [0.5, 0.5]);
  assert.equal(decodeAuthoredPath(polylineToDesignLayer([[0, 0], [10, 0], [10, 10]], true).path)!.closed, true);
  assert.throws(() => polylineToDesignLayer([[0, 0]], false));
});
