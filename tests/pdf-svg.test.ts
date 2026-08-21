// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the PDF page → standalone SVG serializer (engine/src/pdf-svg.ts).
 *
 * pdfNodesToSvg takes the interpreter's PdfNodes (pre-finalizeBoxes, placeholders
 * intact) and emits one self-contained SVG document - the asset-upload sibling of
 * the Design boxes path. These tests feed hand-built nodes AND real
 * interpreter output (via interpretPdfPage on hand-written content streams), so the
 * two modules are proven to compose.
 *
 * Run with: node --test tests/pdf-svg.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { pdfNodesToSvg, windowPdfSvg } from '../engine/src/pdf-svg.ts';
import { interpretPdfPage } from '../engine/src/pdf-map.ts';
import type { PdfNode } from '../engine/src/pdf-map.ts';

const OPTS = { width: 400, height: 300 };

// ── document shell ─────────────────────────────────────────────────────────────
test('emits a standalone SVG with viewBox and intrinsic size', () => {
  const svg = pdfNodesToSvg([], OPTS);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 400 300" width="400" height="300">/);
  assert.ok(svg.endsWith('</svg>'));
});

test('background is transparent by default, opt-in via opts.background', () => {
  assert.ok(!pdfNodesToSvg([], OPTS).includes('<rect'));
  const svg = pdfNodesToSvg([], { ...OPTS, background: '#ffffff' });
  assert.ok(svg.includes('<rect x="0" y="0" width="400" height="300" fill="#ffffff"/>'));
});

// ── shapes ─────────────────────────────────────────────────────────────────────
test('rect box → <rect> with fill, opacity and centre rotation', () => {
  const n: PdfNode = { kind: 'box', shape: 'rect', x: 10, y: 20, w: 100, h: 50, rot: 30, fill: '#ff0000', opacity: 50 };
  const svg = pdfNodesToSvg([n], OPTS);
  assert.ok(svg.includes('<rect x="10" y="20" width="100" height="50" fill="#ff0000"'), svg);
  assert.ok(svg.includes('opacity="0.5"'));
  assert.ok(svg.includes('rotate(30 60 45)'), 'rotates about the box centre');
});

test('ellipse box → <ellipse> from the bbox', () => {
  const n: PdfNode = { kind: 'box', shape: 'ellipse', x: 0, y: 0, w: 100, h: 60, rot: 0, fill: '#00ff00' };
  const svg = pdfNodesToSvg([n], OPTS);
  assert.ok(svg.includes('<ellipse cx="50" cy="30" rx="50" ry="30" fill="#00ff00"/>'), svg);
});

test('vector path placeholder → <path> in page space with stroke attrs', () => {
  const n: PdfNode = {
    kind: 'image', x: 5, y: 5, w: 60, h: 40, rot: 0,
    _vectorPath: 'M5 5L65 45Z', _vectorFill: '#123456', _vectorStroke: { color: '#654321', width: 2 },
  };
  const svg = pdfNodesToSvg([n], OPTS);
  assert.ok(svg.includes('<path d="M5 5L65 45Z" fill="#123456" stroke="#654321" stroke-width="2" fill-rule="nonzero"/>'), svg);
});

test('image placeholder inlines a provided data: URI and skips unresolved ones', () => {
  const uri = 'data:image/png;base64,iVBORw0KGgo=';
  const withHref: PdfNode = { kind: 'image', x: 0, y: 0, w: 80, h: 60, rot: 0, _imageXObject: 'img0' };
  const without: PdfNode = { kind: 'image', x: 100, y: 0, w: 80, h: 60, rot: 0, _imageXObject: 'img1' };
  const svg = pdfNodesToSvg([withHref, without], { ...OPTS, images: { img0: uri } });
  assert.ok(svg.includes(`href="${uri}"`));
  assert.ok(svg.includes('preserveAspectRatio="none"'));
  assert.ok(!svg.includes('img1'), 'unresolved image is skipped');
});

test('non-data hrefs are refused so the document stays self-contained', () => {
  const n: PdfNode = { kind: 'image', x: 0, y: 0, w: 80, h: 60, rot: 0, _imageXObject: 'img0' };
  const svg = pdfNodesToSvg([n], { ...OPTS, images: { img0: 'https://evil.example/x.png' } });
  assert.ok(!svg.includes('<image'), svg);
});

// ── text ───────────────────────────────────────────────────────────────────────
test('text → <text> with per-line tspans on the interpreter baseline model', () => {
  const n: PdfNode = {
    kind: 'text', x: 10, y: 100, w: 100, h: 28, rot: 0,
    text: 'Hello\nWorld', fg: '#112233', fontSize: 10, fontWeight: 700, fontFamily: 'Poppins',
  };
  const svg = pdfNodesToSvg([n], OPTS);
  assert.ok(svg.includes('fill="#112233"'));
  assert.ok(svg.includes('font-family="Poppins, sans-serif"'));
  assert.ok(svg.includes('font-weight="700"'));
  // baseline = y + 0.8·size; next line advances 1.4·size (matches the box model).
  assert.ok(svg.includes('<tspan x="10" y="108">Hello</tspan>'), svg);
  assert.ok(svg.includes('<tspan x="10" y="122">World</tspan>'), svg);
});

test('a node carrying its measured lineHeight places lines at the REAL leading', () => {
  // 10pt type at 2x leading (interpreter-measured) - tspans and outlined lines
  // must both step 20pt per line, not the 1.4 fallback grid.
  const n: PdfNode = {
    kind: 'text', x: 10, y: 100, w: 100, h: 40, rot: 0, lineHeight: 2,
    text: 'Hello\nWorld', fg: '#112233', fontSize: 10, fontFamily: 'Poppins',
  };
  const svg = pdfNodesToSvg([n], OPTS);
  assert.ok(svg.includes('<tspan x="10" y="108">Hello</tspan>'), svg);
  assert.ok(svg.includes('<tspan x="10" y="128">World</tspan>'), svg);
  const outlined = pdfNodesToSvg([{ ...n, _outlinePath: ['M0 0h5', 'M0 0h6'] }], OPTS);
  assert.ok(outlined.includes('translate(10 108)'), outlined);
  assert.ok(outlined.includes('translate(10 128)'), outlined);
});

test('text and attribute values are XML-escaped', () => {
  const n: PdfNode = {
    kind: 'text', x: 0, y: 0, w: 100, h: 14, rot: 0,
    text: 'a<b>&"c"', fg: '#000000', fontSize: 10, fontFamily: 'Ev"il<Font>',
  };
  const svg = pdfNodesToSvg([n], OPTS);
  assert.ok(svg.includes('a&lt;b&gt;&amp;&quot;c&quot;'), svg);
  assert.ok(!/font-family="[^"]*</.test(svg));
});

test('a hostile colour value falls back instead of injecting markup', () => {
  const n: PdfNode = { kind: 'box', shape: 'rect', x: 0, y: 0, w: 10, h: 10, rot: 0, fill: '"><script>x</script>' as string };
  const svg = pdfNodesToSvg([n], OPTS);
  assert.ok(!svg.includes('script'), svg);
});

// ── ordering, groups, degenerate nodes ─────────────────────────────────────────
test('nodes render in paint order; zero-size and empty nodes are skipped', () => {
  const a: PdfNode = { kind: 'box', shape: 'rect', x: 0, y: 0, w: 10, h: 10, rot: 0, fill: '#111111' };
  const b: PdfNode = { kind: 'box', shape: 'rect', x: 0, y: 0, w: 10, h: 10, rot: 0, fill: '#222222' };
  const zero: PdfNode = { kind: 'box', shape: 'rect', x: 0, y: 0, w: 0, h: 10, rot: 0, fill: '#333333' };
  const svg = pdfNodesToSvg([a, zero, b], OPTS);
  assert.ok(svg.indexOf('#111111') < svg.indexOf('#222222'));
  assert.ok(!svg.includes('#333333'));
});

test('contiguous same-group nodes wrap in <g data-group>', () => {
  const mk = (fill: string, group?: string): PdfNode =>
    ({ kind: 'box', shape: 'rect', x: 0, y: 0, w: 10, h: 10, rot: 0, fill, ...(group ? { group } : {}) });
  const svg = pdfNodesToSvg([mk('#111111'), mk('#222222', 'g1'), mk('#333333', 'g1'), mk('#444444')], OPTS);
  const open = svg.indexOf('<g data-group="g1">');
  const close = svg.indexOf('</g>');
  assert.ok(open > -1 && close > open);
  assert.ok(open < svg.indexOf('#222222') && svg.indexOf('#333333') < close);
  assert.ok(svg.indexOf('#444444') > close, 'group closes before the next ungrouped node');
});

// ── gradients (PDF ShadingType 2/3) ────────────────────────────────────────────
const grad = (over: Partial<NonNullable<PdfNode['_gradient']>> = {}): NonNullable<PdfNode['_gradient']> => ({
  type: 2, coords: [0, 0, 100, 0],
  stops: [{ offset: 0, color: '#00ff00' }, { offset: 1, color: '#0000ff' }],
  extend: [true, true], matrix: [1, 0, 0, -1, 0, 300], ...over,
});

test('a box _gradient emits a <linearGradient> def and a url(#…) fill', () => {
  const n: PdfNode = { kind: 'box', shape: 'rect', x: 40, y: 40, w: 120, h: 60, rot: 0, fill: '', _gradient: grad() };
  const svg = pdfNodesToSvg([n], OPTS);
  assert.ok(svg.includes('<defs>'), 'has a defs block');
  assert.ok(svg.includes('<linearGradient id="pgrad0" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="0" gradientTransform="matrix(1 0 0 -1 0 300)">'), svg);
  assert.ok(svg.includes('<stop offset="0" stop-color="#00ff00"/>'));
  assert.ok(svg.includes('<stop offset="1" stop-color="#0000ff"/>'));
  assert.ok(svg.includes('fill="url(#pgrad0)"'), 'rect paints with the gradient');
});

test('a radial _gradient emits a <radialGradient> with focal circle', () => {
  const n: PdfNode = { kind: 'box', shape: 'rect', x: 0, y: 0, w: 200, h: 200, rot: 0, fill: '',
    _gradient: grad({ type: 3, coords: [50, 50, 0, 60, 60, 80] }) };
  const svg = pdfNodesToSvg([n], OPTS);
  assert.ok(svg.includes('<radialGradient id="pgrad0" gradientUnits="userSpaceOnUse" cx="60" cy="60" r="80" fx="50" fy="50"'), svg);
  assert.ok(svg.includes('fill="url(#pgrad0)"'));
});

test('identical gradients on two nodes share one def', () => {
  const mk = (): PdfNode => ({ kind: 'box', shape: 'rect', x: 0, y: 0, w: 100, h: 100, rot: 0, fill: '', _gradient: grad() });
  const svg = pdfNodesToSvg([mk(), mk()], OPTS);
  assert.equal(svg.match(/<linearGradient/g)?.length, 1, 'one def only');
  assert.equal(svg.match(/url\(#pgrad0\)/g)?.length, 2, 'both nodes reference it');
});

test('a degenerate gradient (one stop) falls back to the flat fill', () => {
  const n: PdfNode = { kind: 'box', shape: 'rect', x: 0, y: 0, w: 100, h: 100, rot: 0, fill: '#abcdef',
    _gradient: grad({ stops: [{ offset: 0, color: '#123456' }] }) };
  const svg = pdfNodesToSvg([n], OPTS);
  assert.ok(!svg.includes('<linearGradient'), 'no gradient def');
  assert.ok(svg.includes('fill="#abcdef"'), 'keeps the node fill');
});

test('a vector path _gradient overrides fill:none and still emits', () => {
  const n: PdfNode = { kind: 'image', x: 0, y: 0, w: 100, h: 80, rot: 0, fit: 'fill',
    _vectorPath: 'M0 0L100 0L50 80Z', _vectorFill: 'none', _gradient: grad() };
  const svg = pdfNodesToSvg([n], OPTS);
  assert.ok(svg.includes('<path d="M0 0L100 0L50 80Z" fill="url(#pgrad0)"'), svg);
});

// ── function-based (ShadingType 1) shadings → a raster <pattern> ──────────────
const TILE = 'data:image/png;base64,iVBORw0KGgo=';
const tileGrad = (over: Partial<NonNullable<PdfNode['_gradient']>> = {}): NonNullable<PdfNode['_gradient']> => ({
  type: 1, coords: [], stops: [], extend: [false, false],
  domain: [0, 2, 0, 4], tileKey: 'shd0', matrix: [1, 0, 0, -1, 0, 300], ...over,
});

test('a type-1 _gradient with a registered tile emits a <pattern> with an <image>', () => {
  const n: PdfNode = { kind: 'box', shape: 'rect', x: 0, y: 0, w: 100, h: 100, rot: 0, fill: '#abcdef', _gradient: tileGrad() };
  const svg = pdfNodesToSvg([n], { ...OPTS, images: { shd0: TILE } });
  assert.ok(svg.includes('<pattern id="pgrad0" patternUnits="userSpaceOnUse" x="0" y="0" width="2" height="4"'), svg);
  assert.ok(svg.includes(`<image x="0" y="0" width="2" height="4" preserveAspectRatio="none" href="${TILE}"/>`), svg);
  assert.ok(svg.includes('fill="url(#pgrad0)"'), 'the node paints with the tile');
});

test('the domain offset is folded into patternTransform, not into x/y', () => {
  // x=y=0 on the <pattern> is the one reading every renderer agrees on; the tile's
  // domain origin rides on the transform instead.
  const n: PdfNode = { kind: 'box', shape: 'rect', x: 0, y: 0, w: 100, h: 100, rot: 0, fill: '#abcdef',
    _gradient: tileGrad({ domain: [10, 12, 20, 24], matrix: [2, 0, 0, -2, 5, 300] }) };
  const svg = pdfNodesToSvg([n], { ...OPTS, images: { shd0: TILE } });
  // matrix ∘ translate(10, 20) → e = 2·10 + 5 = 25, f = -2·20 + 300 = 260
  assert.ok(svg.includes('patternTransform="matrix(2 0 0 -2 25 260)"'), svg);
  assert.ok(svg.includes('width="2" height="4"'), svg);
});

test('a type-1 _gradient with no registered tile falls back to the flat fill', () => {
  const n: PdfNode = { kind: 'box', shape: 'rect', x: 0, y: 0, w: 100, h: 100, rot: 0, fill: '#abcdef', _gradient: tileGrad() };
  const svg = pdfNodesToSvg([n], OPTS);
  assert.ok(!svg.includes('<pattern'), 'no def emitted');
  assert.ok(svg.includes('fill="#abcdef"'), 'the node still paints a colour, not nothing');
});

test('a type-1 tile href pointing off-origin is refused like any other image', () => {
  const n: PdfNode = { kind: 'box', shape: 'rect', x: 0, y: 0, w: 100, h: 100, rot: 0, fill: '#abcdef', _gradient: tileGrad() };
  const svg = pdfNodesToSvg([n], { ...OPTS, images: { shd0: 'https://evil.example/x.png' } });
  assert.ok(!svg.includes('<pattern') && !svg.includes('evil.example'), svg);
  assert.ok(svg.includes('fill="#abcdef"'));
});

test('two nodes sharing one tile shading emit a single <pattern>', () => {
  const mk = (x: number): PdfNode => ({ kind: 'box', shape: 'rect', x, y: 0, w: 50, h: 50, rot: 0, fill: '#abcdef', _gradient: tileGrad() });
  const svg = pdfNodesToSvg([mk(0), mk(60)], { ...OPTS, images: { shd0: TILE } });
  assert.equal(svg.match(/<pattern/g)?.length, 1);
  assert.equal(svg.match(/url\(#pgrad0\)/g)?.length, 2);
});

test('two DIFFERENT tile shadings do not collide in the dedupe key', () => {
  const a: PdfNode = { kind: 'box', shape: 'rect', x: 0, y: 0, w: 50, h: 50, rot: 0, fill: '#111111', _gradient: tileGrad() };
  const b: PdfNode = { kind: 'box', shape: 'rect', x: 60, y: 0, w: 50, h: 50, rot: 0, fill: '#222222', _gradient: tileGrad({ tileKey: 'shd1' }) };
  const svg = pdfNodesToSvg([a, b], { ...OPTS, images: { shd0: TILE, shd1: TILE } });
  assert.equal(svg.match(/<pattern/g)?.length, 2, svg);
});

test('a degenerate type-1 domain emits nothing and keeps the flat fill', () => {
  for (const domain of [[0, 0, 0, 4], [0, 2, 4, 0], [0, NaN, 0, 4]] as Array<[number, number, number, number]>) {
    const n: PdfNode = { kind: 'box', shape: 'rect', x: 0, y: 0, w: 100, h: 100, rot: 0, fill: '#abcdef', _gradient: tileGrad({ domain }) };
    const svg = pdfNodesToSvg([n], { ...OPTS, images: { shd0: TILE } });
    assert.ok(!svg.includes('<pattern'), JSON.stringify(domain));
    assert.ok(svg.includes('fill="#abcdef"'));
  }
});

// ── composition with the real interpreter ──────────────────────────────────────
test('interpretPdfPage output round-trips: rect + path + text land in one page SVG', () => {
  const nodes = interpretPdfPage({
    content:
      '0.2 0.7 0.5 rg 40 200 120 60 re f ' +               // rect (y-flipped by the interpreter)
      '0 0 0 rg 10 10 m 50 80 l 90 10 l f ' +              // triangle → baked vector path
      'BT /F1 24 Tf 1 0 0 1 100 100 Tm (Hi) Tj ET',        // text
    width: 400, height: 300,
    fonts: { F1: { family: 'TestSans', weight: 400 } },
  });
  const svg = pdfNodesToSvg(nodes, OPTS);
  assert.ok(svg.includes('<rect') && svg.includes('fill="#33b380"'), 'rect survives');
  assert.ok(svg.includes('<path d="M'), 'vector path survives');
  assert.ok(svg.includes('>Hi</tspan>'), 'text survives');
  assert.ok(svg.includes('font-family="TestSans, sans-serif"'));
});

// ── windowPdfSvg - vector clip via viewBox ──────────────────────────────────────
test('windowPdfSvg re-frames the root viewBox and stamps the out size', () => {
  const doc = pdfNodesToSvg([{ kind: 'box', x: 0, y: 0, w: 400, h: 300, rot: 0, fill: '#123456' } as PdfNode], OPTS);
  const win = windowPdfSvg(doc, { x: 30, y: 75.333, width: 240, height: 135, outWidth: 320, outHeight: 180 });
  assert.match(win, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="30 75\.33 240 135" width="320" height="180">/);
  assert.ok(win.includes('fill="#123456"'), 'body is untouched');
  assert.ok(win.endsWith('</svg>'));
});

test('windowPdfSvg defaults the out size to the window and floors degenerate rects', () => {
  const doc = pdfNodesToSvg([], OPTS);
  const win = windowPdfSvg(doc, { x: 0, y: 10, width: 0.2, height: 0 });
  assert.match(win, /viewBox="0 10 1 1" width="1" height="1"/);
});

test('windowPdfSvg leaves a foreign SVG root unchanged', () => {
  const foreign = '<svg width="10" height="10"><rect/></svg>';
  assert.equal(windowPdfSvg(foreign, { x: 0, y: 0, width: 5, height: 5 }), foreign);
});

// ── soft masks: the mask <defs> are reference-driven and never leak ────────────

test('a node with no soft mask serializes byte-identically to before the feature', () => {
  // Guards the renderNode extraction: pulling the per-node dispatch out of the emit
  // loop (so a <mask>'s children can reuse it) must not change ordinary output.
  const svg = pdfNodesToSvg([
    { kind: 'box', x: 0, y: 0, w: 100, h: 50, rot: 0, fill: '#abcdef', shape: 'rect' } as PdfNode,
  ], OPTS);
  assert.equal(
    svg,
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">'
    + '<rect x="0" y="0" width="100" height="50" fill="#abcdef"/></svg>',
  );
  assert.ok(!svg.includes('<defs>'), 'no empty defs');
});

test('a soft mask whose children all render to nothing suppresses the masked node', () => {
  // An unknowable mask is a BLACK mask. Emitting the paint unmasked is how a print
  // engine's box-shadow ink becomes an opaque grey plate the size of the control - 
  // strictly the worse of the two errors, so nothing is emitted at all.
  const mask = {
    key: 'k1', x: 0, y: 0, w: 100, h: 50, subtype: 'Luminosity' as const,
    // an image XObject with no entry in `images` → renders to ''
    nodes: [{ kind: 'image', x: 0, y: 0, w: 100, h: 50, rot: 0, _imageXObject: 'missing' } as PdfNode],
  };
  const svg = pdfNodesToSvg([
    { kind: 'box', x: 0, y: 0, w: 100, h: 50, rot: 0, fill: '#000000', opacity: 20, shape: 'rect', _softMask: mask } as PdfNode,
  ], OPTS);
  assert.ok(!svg.includes('<rect'), svg);
  assert.ok(!svg.includes('<mask'), svg);
});

test('a degenerate mask region is ignored rather than hiding the node', () => {
  const mask = {
    key: 'k2', x: 0, y: 0, w: 0, h: 0, subtype: 'Luminosity' as const,
    nodes: [{ kind: 'box', x: 0, y: 0, w: 10, h: 10, rot: 0, fill: '#ffffff', shape: 'rect' } as PdfNode],
  };
  const svg = pdfNodesToSvg([
    { kind: 'box', x: 0, y: 0, w: 100, h: 50, rot: 0, fill: '#abcdef', shape: 'rect', _softMask: mask } as PdfNode,
  ], OPTS);
  assert.ok(svg.includes('<rect x="0" y="0" width="100" height="50" fill="#abcdef"/>'), svg);
  assert.ok(!svg.includes('<mask'), svg);
});

// ── An image that rounds away is not emitted ─────────────────────────────────
// The node-level guard is `n.w > 0`, which a 0.004-unit box passes - and then the
// emitter's 2-decimal rounding writes width="0". The element cannot draw, but it
// still carries its base64 raster payload, so it is pure weight: nine of them were
// riding in one fixture. Test what will be WRITTEN, not what was computed.
test('an image whose rounded size is zero is skipped entirely', () => {
  const px = 'data:image/png;base64,iVBORw0KGgo=';
  const svg = pdfNodesToSvg(
    [{ kind: 'image', x: 10, y: 10, w: 0.004, h: 43, rot: 0, fit: 'fill', _imageXObject: 'k' } as never],
    { width: 100, height: 100, images: { k: px } } as never,
  );
  assert.ok(!svg.includes('<image'), `a zero-width image was emitted: ${svg.slice(0, 200)}`);
  assert.ok(!svg.includes(px), 'the raster payload rode along with it');
});

test('an image with real extent is still emitted', () => {
  const px = 'data:image/png;base64,iVBORw0KGgo=';
  const svg = pdfNodesToSvg(
    [{ kind: 'image', x: 10, y: 10, w: 20, h: 43, rot: 0, fit: 'fill', _imageXObject: 'k' } as never],
    { width: 100, height: 100, images: { k: px } } as never,
  );
  assert.ok(svg.includes('<image'), 'a normal image must still emit');
});

// ── dedupePaths - hoist repeated path DATA, never collapse the draws ───────────
//
// A print engine draws a dashed border as FOUR paints, each carrying the whole
// dash ring and each clipped to one mitred border-side wedge. The ring can run
// 50 KB, so one bordered control costs 200 KB - 37% of a docs brand-studio
// capture. The copies look identical and are NOT redundant: drop three and three
// sides of the border disappear. So the hoist collapses the DATA only, and every
// reference keeps its own clip wrapper.

/** Four identical rings, each under a different border-side clip. */
function ringNodes(d = 'M0 0h100v50h-100z'): PdfNode[] {
  return ['top', 'bottom', 'right', 'left'].map((side, i) => ({
    kind: 'image', x: 0, y: 0, w: 100, h: 50, rot: 0,
    _vectorPath: d, _vectorFill: '#cbd5e2',
    _clips: [{ d: `M${i} ${i}h10v10h-10z` }],
  } as PdfNode));
}

test('dedupePaths: off by default - every copy stays inline', () => {
  const svg = pdfNodesToSvg(ringNodes(), OPTS);
  assert.equal(svg.split('<path d="M0 0h100v50h-100z"').length - 1, 4);
  assert.ok(!svg.includes('<use'), 'no <use> without the opt-in');
});

test('dedupePaths: hoists the shared data but keeps all four clipped draws', () => {
  const svg = pdfNodesToSvg(ringNodes(), { ...OPTS, dedupePaths: true });

  // The ink is stored once...
  assert.equal(svg.split('d="M0 0h100v50h-100z"').length - 1, 1, 'path data must appear once');
  // ...and drawn four times.
  assert.equal(svg.split('<use href="#puse0"/>').length - 1, 4, 'all four draws must survive');
  // Each <use> is still inside its OWN clip - that is what keeps the four
  // border sides distinct. Four distinct clipPaths, four wrapped uses.
  for (let i = 0; i < 4; i++) {
    assert.match(svg, new RegExp(`<g clip-path="url\\(#pclip${i}\\)"><use href="#puse0"/></g>`), `copy ${i}`);
  }
  assert.ok(svg.includes(`<defs>`) && svg.indexOf('<path id="puse0"') > svg.indexOf('<defs>'), 'the def lives in <defs>');
});

test('dedupePaths: a path used once is never hoisted', () => {
  // A <use> for a single occurrence is pure loss - 24 bytes and an indirection.
  const one: PdfNode = { kind: 'image', x: 0, y: 0, w: 10, h: 10, rot: 0, _vectorPath: 'M0 0h9v9z', _vectorFill: '#000' };
  const svg = pdfNodesToSvg([one], { ...OPTS, dedupePaths: true });
  assert.ok(svg.includes('<path d="M0 0h9v9z"'), svg);
  assert.ok(!svg.includes('<use'), 'single-use paths stay inline');
});

test('dedupePaths: different ink never collapses', () => {
  // Same geometry, different fill - two separate defs-free paths.
  const a: PdfNode = { kind: 'image', x: 0, y: 0, w: 10, h: 10, rot: 0, _vectorPath: 'M0 0h9v9z', _vectorFill: '#111' };
  const b: PdfNode = { ...a, _vectorFill: '#222' } as PdfNode;
  const svg = pdfNodesToSvg([a, b], { ...OPTS, dedupePaths: true });
  assert.ok(!svg.includes('<use'), 'a different fill is different ink');
  assert.ok(svg.includes('fill="#111"') && svg.includes('fill="#222"'), svg);
});

test('dedupePaths: ids carry the caller idPrefix', () => {
  // A stored SVG is inlined as a nested <svg> on export and ids are NOT scoped - 
  // same discipline as pclip/pgrad/pmask, or two documents cross-reference.
  const svg = pdfNodesToSvg(ringNodes(), { ...OPTS, dedupePaths: true, idPrefix: 'v7' });
  assert.ok(svg.includes('<path id="v7use0"'), svg);
  assert.ok(svg.includes('<use href="#v7use0"/>'), svg);
  assert.ok(!svg.includes('puse0'), 'must not mint an unprefixed id');
});

test('dedupePaths: translucent ink is never hoisted', () => {
  // Two identical semi-transparent paths at one place composite DARKER than one,
  // so a repeat is meaningful ink, not redundancy. (The guard matches
  // `fill-opacity=` too, which is the form the serializer actually emits.)
  const a: PdfNode = {
    kind: 'image', x: 0, y: 0, w: 10, h: 10, rot: 0,
    _vectorPath: 'M0 0h9v9z', _vectorFill: '#000', _vectorFillOpacity: 0.3,
  } as PdfNode;
  const svg = pdfNodesToSvg([a, { ...a } as PdfNode], { ...OPTS, dedupePaths: true });
  if (svg.includes('opacity=')) {
    assert.ok(!svg.includes('<use'), 'translucent duplicates must both stay inline');
  }
});
