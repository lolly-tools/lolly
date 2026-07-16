/**
 * Flat-SVG → native PPTX custom-geometry contract tests.
 * Run with: node --test tests/svg-custgeom.test.ts
 *
 * Two halves:
 *   1. svgToCustGeomPaths (svg-custgeom.ts) — a flat stroke/fill SVG lowers to
 *      PptxPath[]; a gradient/filter/opacity/currentColor/rotate SVG returns null so
 *      the shell keeps its raster path (never regress non-flat art).
 *   2. buildPptxParts (pptx.ts) — a PptxPath serializes to a:custGeom / a:pathLst with
 *      moveTo/lnTo/cubicBezTo/close and a solid fill + stroke.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { svgToCustGeomPaths } from '../engine/src/svg-custgeom.ts';
import { buildPptxParts } from '../engine/src/pptx.ts';
import type { PptxSlide, PptxPath } from '../engine/src/pptx.ts';

const EMU = 914400; // one inch — a convenient square target box

// ─── svgToCustGeomPaths ───────────────────────────────────────────────────────

test('a flat 2-path SVG becomes two custGeom shapes with the right paint', () => {
  const svg =
    '<svg viewBox="0 0 100 100">' +
    '<path d="M10 10 L90 10 L90 90 Z" fill="#ff0000"/>' +
    '<path d="M0 0 L50 50" fill="none" stroke="blue" stroke-width="4"/>' +
    '</svg>';
  const shapes = svgToCustGeomPaths(svg, EMU, EMU);
  assert.ok(shapes, 'flat SVG must lower (not null)');
  assert.equal(shapes!.length, 2);

  const [filled, stroked] = shapes!;
  assert.equal(filled!.kind, 'path');
  assert.deepEqual(filled!.fill, { solid: '#FF0000' });
  assert.equal(filled!.line, undefined);

  // The stroke-only line: no fill, a blue stroke (named colour resolved to hex).
  assert.equal(stroked!.fill, undefined);
  assert.equal(stroked!.line?.color, '#0000FF');
  assert.ok((stroked!.line?.w ?? 0) > 0, 'stroke width scaled into EMU');
});

test('viewBox coords are scaled into the target EMU box', () => {
  const svg = '<svg viewBox="0 0 100 100"><path d="M10 20 L90 20 Z" fill="#010203"/></svg>';
  const shapes = svgToCustGeomPaths(svg, EMU, EMU)!;
  assert.equal(shapes.length, 1);
  const d = shapes[0]!.paths[0]!.d;
  // sx = 914400/100 = 9144; x=10 → 91440, y=20 → 182880.
  assert.match(d, /^M91440 182880/);
  assert.equal(shapes[0]!.cx, EMU);
  assert.equal(shapes[0]!.cy, EMU);
});

test('a group translate/scale transform is composed into the coordinates', () => {
  const plain = svgToCustGeomPaths('<svg viewBox="0 0 100 100"><path d="M10 10 L20 10" fill="#000"/></svg>', EMU, EMU)!;
  const moved = svgToCustGeomPaths('<svg viewBox="0 0 100 100"><g transform="translate(10 0)"><path d="M10 10 L20 10" fill="#000"/></g></svg>', EMU, EMU)!;
  // translate(10) shifts x by 10 user units = 10·9144 = 91440 EMU.
  const px = (d: string): number => Number(/^M(-?\d+)/.exec(d)![1]);
  assert.equal(px(moved[0]!.paths[0]!.d) - px(plain[0]!.paths[0]!.d), 91440);
});

test('primitives (rect, circle) are converted to path geometry', () => {
  const rect = svgToCustGeomPaths('<svg viewBox="0 0 100 100"><rect x="0" y="0" width="100" height="100" fill="#123456"/></svg>', EMU, EMU)!;
  assert.equal(rect.length, 1);
  assert.deepEqual(rect[0]!.fill, { solid: '#123456' });
  assert.ok(rect[0]!.paths[0]!.d.includes('Z'), 'rect closes');

  const circle = svgToCustGeomPaths('<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#654321"/></svg>', EMU, EMU)!;
  assert.equal(circle.length, 1);
  // Two arcs → two cubic runs after re-tokenizing; the `d` carries 'C' segments.
  assert.match(circle[0]!.paths[0]!.d, /C/);
});

test('an inherited default fill is black; fill:none yields no fill', () => {
  const s = svgToCustGeomPaths('<svg viewBox="0 0 10 10"><path d="M0 0 L10 10 Z"/></svg>', EMU, EMU)!;
  assert.deepEqual(s[0]!.fill, { solid: '#000000' });
});

// ─── the raster-fallback bail conditions (return null) ────────────────────────

test('a gradient SVG returns null (keep raster)', () => {
  const svg =
    '<svg viewBox="0 0 100 100"><defs>' +
    '<linearGradient id="g"><stop offset="0" stop-color="red"/><stop offset="1" stop-color="blue"/></linearGradient>' +
    '</defs><rect width="100" height="100" fill="url(#g)"/></svg>';
  assert.equal(svgToCustGeomPaths(svg, EMU, EMU), null);
});

test('url() paint alone (no gradient element) also bails', () => {
  assert.equal(svgToCustGeomPaths('<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="url(#p)"/></svg>', EMU, EMU), null);
});

test('a filter / partial opacity / blend / currentColor SVG returns null', () => {
  const vb = '<svg viewBox="0 0 10 10">';
  assert.equal(svgToCustGeomPaths(`${vb}<path d="M0 0 L9 9" filter="url(#f)" fill="#000"/></svg>`, EMU, EMU), null, 'filter');
  assert.equal(svgToCustGeomPaths(`${vb}<path d="M0 0 L9 9" opacity="0.5" fill="#000"/></svg>`, EMU, EMU), null, 'opacity');
  assert.equal(svgToCustGeomPaths(`${vb}<path d="M0 0 L9 9" style="mix-blend-mode:multiply" fill="#000"/></svg>`, EMU, EMU), null, 'blend');
  assert.equal(svgToCustGeomPaths(`${vb}<path d="M0 0 L9 9" fill="currentColor"/></svg>`, EMU, EMU), null, 'currentColor');
});

test('a rotate/skew transform and an unknown named colour bail', () => {
  assert.equal(svgToCustGeomPaths('<svg viewBox="0 0 10 10"><g transform="rotate(45)"><path d="M0 0 L9 9" fill="#000"/></g></svg>', EMU, EMU), null, 'rotate');
  assert.equal(svgToCustGeomPaths('<svg viewBox="0 0 10 10"><path d="M0 0 L9 9" fill="notacolour"/></svg>', EMU, EMU), null, 'bad name');
});

test('an unreadable viewBox (and empty/oversized input) returns null', () => {
  assert.equal(svgToCustGeomPaths('<svg><path d="M0 0 L1 1" fill="#000"/></svg>', EMU, EMU), null, 'no viewBox/size');
  assert.equal(svgToCustGeomPaths('', EMU, EMU), null, 'empty');
  assert.equal(svgToCustGeomPaths('<svg viewBox="0 0 10 10"><path d="M0 0" fill="#000"/></svg>', 0, EMU), null, 'zero target');
});

test('a purely non-drawable SVG (nothing paints) returns null', () => {
  assert.equal(svgToCustGeomPaths('<svg viewBox="0 0 10 10"><path d="M0 0 L9 9" fill="none"/></svg>', EMU, EMU), null);
});

// ─── buildPptxParts emits a:custGeom for a PptxPath ───────────────────────────

const pathSlide = (shape: PptxPath): PptxSlide => ({ shapes: [shape], media: [] });

test('a PptxPath serializes to a:custGeom with moveTo/lnTo/close and a solid fill', () => {
  const shape: PptxPath = {
    kind: 'path', x: 0, y: 0, cx: 914400, cy: 914400,
    fill: { solid: '#112233' }, paths: [{ d: 'M0 0 L100 0 L100 100 Z' }],
  };
  const parts = buildPptxParts([pathSlide(shape)], {});
  const xml = parts['ppt/slides/slide1.xml'] as string;
  assert.match(xml, /<a:custGeom>/);
  assert.match(xml, /<a:pathLst><a:path w="914400" h="914400">/);
  assert.match(xml, /<a:moveTo><a:pt x="0" y="0"\/><\/a:moveTo>/);
  assert.match(xml, /<a:lnTo><a:pt x="100" y="0"\/><\/a:lnTo>/);
  assert.match(xml, /<a:close\/>/);
  assert.match(xml, /<a:solidFill><a:srgbClr val="112233"\/><\/a:solidFill>/);
});

test('a PptxPath cubic segment emits a:cubicBezTo with three points', () => {
  const shape: PptxPath = {
    kind: 'path', x: 0, y: 0, cx: 1000, cy: 1000,
    line: { color: '#00ff00', w: 12700 }, paths: [{ d: 'M0 0 C10 10 20 20 30 30' }],
  };
  const parts = buildPptxParts([pathSlide(shape)], {});
  const xml = parts['ppt/slides/slide1.xml'] as string;
  assert.match(xml, /<a:cubicBezTo><a:pt x="10" y="10"\/><a:pt x="20" y="20"\/><a:pt x="30" y="30"\/><\/a:cubicBezTo>/);
  // stroke → a:ln with the width; no fill declared → noFill.
  assert.match(xml, /<a:ln w="12700"><a:solidFill><a:srgbClr val="00FF00"\/><\/a:solidFill><\/a:ln>/);
  assert.match(xml, /<a:noFill\/>/);
});

test('multiple subpaths of one path collapse into ONE a:path (holes survive)', () => {
  const shape: PptxPath = {
    kind: 'path', x: 0, y: 0, cx: 1000, cy: 1000,
    fill: { solid: '#000000' }, paths: [{ d: 'M0 0 L100 0 L100 100 Z M20 20 L80 20 L80 80 Z' }],
  };
  const parts = buildPptxParts([pathSlide(shape)], {});
  const xml = parts['ppt/slides/slide1.xml'] as string;
  assert.equal([...xml.matchAll(/<a:path /g)].length, 1, 'one a:path element');
  assert.equal([...xml.matchAll(/<a:moveTo>/g)].length, 2, 'two subpaths → two moveTo');
});

test('end-to-end: a flat SVG lowers and then serializes to native custGeom', () => {
  const shapes = svgToCustGeomPaths('<svg viewBox="0 0 100 100"><path d="M10 10 L90 10 L90 90 Z" fill="#abcdef"/></svg>', 914400, 914400)!;
  const parts = buildPptxParts([{ shapes, media: [] }], {});
  const xml = parts['ppt/slides/slide1.xml'] as string;
  assert.match(xml, /<a:custGeom>/);
  assert.match(xml, /<a:srgbClr val="ABCDEF"\/>/);
  // No rasterised picture anywhere in the slide.
  assert.doesNotMatch(xml, /<p:pic>/);
});
