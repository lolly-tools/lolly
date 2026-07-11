// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the PDF page → standalone SVG serializer (engine/src/pdf-svg.ts).
 *
 * pdfNodesToSvg takes the interpreter's PdfNodes (pre-finalizeBoxes, placeholders
 * intact) and emits one self-contained SVG document — the asset-upload sibling of
 * the Layout Studio boxes path. These tests feed hand-built nodes AND real
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

// ── windowPdfSvg — vector clip via viewBox ──────────────────────────────────────
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
