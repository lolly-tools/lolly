// SPDX-License-Identifier: MPL-2.0
/**
 * Flat-SVG → native PPTX custom-geometry contract tests.
 * Run with: node --test tests/svg-custgeom.test.ts
 *
 * Two halves:
 *   1. svgToCustGeomPaths (svg-custgeom.ts) - a flat stroke/fill SVG lowers to
 *      PptxPath[]; a gradient/filter/opacity/currentColor/rotate SVG returns null so
 *      the shell keeps its raster path (never regress non-flat art).
 *   2. buildPptxParts (pptx.ts) - a PptxPath serializes to a:custGeom / a:pathLst with
 *      moveTo/lnTo/cubicBezTo/close and a solid fill + stroke.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { svgToCustGeomPaths } from '../engine/src/svg-custgeom.ts';
import { buildPptxParts } from '../engine/src/pptx.ts';
import type { PptxSlide, PptxPath } from '../engine/src/pptx.ts';

const EMU = 914400; // one inch - a convenient square target box

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

test('a filter / blend / currentColor SVG returns null', () => {
  const vb = '<svg viewBox="0 0 10 10">';
  assert.equal(svgToCustGeomPaths(`${vb}<path d="M0 0 L9 9" filter="url(#f)" fill="#000"/></svg>`, EMU, EMU), null, 'filter');
  assert.equal(svgToCustGeomPaths(`${vb}<path d="M0 0 L9 9" style="mix-blend-mode:multiply" fill="#000"/></svg>`, EMU, EMU), null, 'blend');
  assert.equal(svgToCustGeomPaths(`${vb}<path d="M0 0 L9 9" fill="currentColor"/></svg>`, EMU, EMU), null, 'currentColor');
});

test('partial opacity LOWERS with a DrawingML alpha instead of bailing (1.128)', () => {
  // Element opacity × fill-opacity multiply; group opacity multiplies down; a
  // translucent #rrggbbaa carries its own alpha; near-invisible drops the aspect.
  const svg =
    '<svg viewBox="0 0 100 100">' +
    '<g opacity="0.5">' +
    '<rect x="0" y="0" width="50" height="50" fill="#ff0000" fill-opacity="0.5"/>' +
    '</g>' +
    '<path d="M0 90 L100 90" fill="none" stroke="#00ff00" stroke-opacity="0.4" stroke-width="2"/>' +
    '<rect x="0" y="60" width="20" height="20" fill="#0000ff80"/>' +
    '<rect x="50" y="60" width="20" height="20" fill="#123456" opacity="0.001"/>' +
    '</svg>';
  const shapes = svgToCustGeomPaths(svg, EMU, EMU);
  assert.ok(shapes, 'translucent flat art must lower');
  assert.equal(shapes!.length, 3, 'the invisible rect drops; the rest lower');
  const [gRect, line, hexA] = shapes!;
  assert.ok(Math.abs((gRect!.fill as { alpha?: number }).alpha! - 0.25) < 0.01, 'group 0.5 × fill-opacity 0.5');
  assert.ok(Math.abs(line!.line!.alpha! - 0.4) < 0.01, 'stroke alpha rides the line');
  assert.equal(line!.fill, undefined);
  assert.ok(Math.abs((hexA!.fill as { alpha?: number }).alpha! - 0x80 / 255) < 0.01, '#rrggbbaa alpha carried');
});

test('a tinted text run carries its alpha on the run colour', () => {
  const svg =
    '<svg viewBox="0 0 100 100">' +
    '<text x="10" y="50" font-size="10" fill="#112233" opacity="0.65">Transport</text>' +
    '</svg>';
  const r = svgToNativePptx(svg, EMU, EMU);
  assert.ok(r);
  const run = r!.texts[0]!.paras[0]!.runs[0]!;
  assert.ok(Math.abs(run.alpha! - 0.65) < 0.01);
  const parts = buildPptxParts([{ shapes: [...r!.texts], media: [] }], {});
  assert.match(parts['ppt/slides/slide1.xml'] as string, /<a:srgbClr val="112233"><a:alpha val="65000"\/><\/a:srgbClr>/);
});

test('a fully opaque run/shape carries NO alpha field (byte-stable for opaque art)', () => {
  const shapes = svgToCustGeomPaths('<svg viewBox="0 0 10 10"><path d="M0 0 L9 9 L0 9 Z" fill="#ff0000"/></svg>', EMU, EMU)!;
  assert.equal((shapes[0]!.fill as { alpha?: number }).alpha, undefined);
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

// ─── svgToNativePptx: text lowering (engine 1.128) ───────────────────────────
// Plain <text> runs come along as native PptxText boxes; anything the text-box
// model can't reproduce faithfully bails the WHOLE lowering to raster.
import { svgToNativePptx } from '../engine/src/svg-custgeom.ts';

test('a plain <text> run lowers to a native text box with font, size, colour, bold', () => {
  const svg =
    '<svg viewBox="0 0 100 100">' +
    '<rect x="0" y="0" width="100" height="100" fill="#ffffff"/>' +
    '<text x="50" y="40" text-anchor="middle" font-family="SUSE, sans-serif" font-size="10" font-weight="bold" fill="#112233">Housing</text>' +
    '</svg>';
  const r = svgToNativePptx(svg, EMU, EMU);
  assert.ok(r, 'text SVG must lower in native mode');
  assert.equal(r!.paths.length, 1, 'the rect still lowers to geometry');
  assert.equal(r!.texts.length, 1);
  const t = r!.texts[0]!;
  const run = t.paras[0]!.runs[0]!;
  assert.equal(run.text, 'Housing');
  assert.equal(run.font, 'SUSE', 'first face of the stack, unquoted');
  assert.equal(run.bold, true);
  assert.equal(run.color, '#112233');
  // 10 user units over a 100-unit viewBox into a 1-inch box = 1/10 inch = 7.2pt.
  assert.ok(Math.abs(run.sizePt - 7.2) < 0.05, `sizePt ≈ 7.2, got ${run.sizePt}`);
  assert.equal(t.paras[0]!.align, 'ctr', 'text-anchor middle → centred paragraph');
  // The box is centred on the anchor x (50% of the target box).
  const centre = t.x + t.cx / 2;
  assert.ok(Math.abs(centre - EMU / 2) < EMU / 100, 'box centred on the anchor');
  // Baseline placement: box top sits an ascent above y=40%.
  assert.ok(t.y < EMU * 0.4 && t.y > EMU * 0.3, 'top an ascent above the baseline');
});

test('svgToCustGeomPaths keeps its original contract: any <text> still bails', () => {
  const svg = '<svg viewBox="0 0 10 10"><text x="1" y="5">hi</text></svg>';
  assert.equal(svgToCustGeomPaths(svg, EMU, EMU), null);
});

test('dy in em shifts the baseline (d3 tick labels) and entities decode', () => {
  const svg =
    '<svg viewBox="0 0 100 100">' +
    '<text x="10" y="50" dy="0.5em" font-size="10" fill="#000000">A &amp; B</text>' +
    '</svg>';
  const r = svgToNativePptx(svg, EMU, EMU);
  assert.ok(r);
  const t = r!.texts[0]!;
  assert.equal(t.paras[0]!.runs[0]!.text, 'A & B');
  // Baseline = 50 + 5 (dy) = 55%; top = 55% - 0.82em (8.2%).
  const expectedTop = EMU * (0.55 - 0.082);
  assert.ok(Math.abs(t.y - expectedTop) < EMU / 100, `dy applied (got ${t.y}, want ≈${Math.round(expectedTop)})`);
});

test('inherited group font state reaches the run; generic-only family is omitted', () => {
  const svg =
    '<svg viewBox="0 0 100 100">' +
    '<g font-family="sans-serif" font-size="20" fill="#ff0000">' +
    '<text x="10" y="30">inherit me</text>' +
    '</g></svg>';
  const r = svgToNativePptx(svg, EMU, EMU);
  assert.ok(r);
  const run = r!.texts[0]!.paras[0]!.runs[0]!;
  assert.equal(run.font, undefined, 'a CSS generic never becomes a face name');
  assert.equal(run.color, '#FF0000');
  assert.ok(Math.abs(run.sizePt - 14.4) < 0.05, '20 units → 14.4pt in the 1-inch box');
});

test('text the box model cannot carry faithfully bails the whole lowering', () => {
  const base = (inner: string): string => `<svg viewBox="0 0 100 100">${inner}</svg>`;
  // Tracking, per-glyph rotation, path-following, positioned tspans, stroke.
  for (const inner of [
    '<text x="1" y="5" letter-spacing="2">t</text>',
    '<text x="1" y="5" rotate="10 20">t</text>',
    '<text x="1" y="5" textLength="90">t</text>',
    '<text x="1" y="5"><tspan x="1" dy="1.2em">t</tspan></text>',
    '<text x="1" y="5"><tspan font-weight="bold">t</tspan></text>',
    '<text x="1" y="5" stroke="#000000">t</text>',
    '<text x="1" y="5"><textPath href="#p">t</textPath></text>',
    '<text x="1" y="5" dominant-baseline="text-after-edge">t</text>',
  ]) {
    assert.equal(svgToNativePptx(base(inner), EMU, EMU), null, `must bail: ${inner}`);
  }
});

test('a bare styling-free tspan is flattened into the run', () => {
  const svg = '<svg viewBox="0 0 100 100"><text x="10" y="50" font-size="10">one <tspan>two</tspan> three</text></svg>';
  const r = svgToNativePptx(svg, EMU, EMU);
  assert.ok(r);
  assert.equal(r!.texts[0]!.paras[0]!.runs[0]!.text, 'one two three');
});

test('dominant-baseline central centres the box on the anchor with a ctr anchor', () => {
  const svg = '<svg viewBox="0 0 100 100"><text x="10" y="50" font-size="10" dominant-baseline="central">mid</text></svg>';
  const r = svgToNativePptx(svg, EMU, EMU);
  assert.ok(r);
  const t = r!.texts[0]!;
  assert.equal(t.anchor, 'ctr');
  assert.ok(Math.abs((t.y + t.cy / 2) - EMU / 2) < EMU / 200, 'box vertically centred on y');
});

test('display:none and empty text emit nothing but do not bail', () => {
  const svg =
    '<svg viewBox="0 0 100 100">' +
    '<text x="1" y="5" display="none" font-size="10">hidden</text>' +
    '<text x="1" y="9" font-size="10">   </text>' +
    '<path d="M10 10 L90 10 L90 90 Z" fill="#ff0000"/>' +
    '</svg>';
  const r = svgToNativePptx(svg, EMU, EMU);
  assert.ok(r);
  assert.equal(r!.texts.length, 0);
  assert.equal(r!.paths.length, 1);
});

test('end-to-end: text SVG lowers and serializes to a native a:t run, no picture', () => {
  const svg =
    '<svg viewBox="0 0 200 80">' +
    '<rect width="200" height="80" fill="#0c8408"/>' +
    '<text x="100" y="48" text-anchor="middle" font-family="SUSE" font-size="32" fill="#ffffff">Live text</text>' +
    '</svg>';
  const r = svgToNativePptx(svg, 2.5 * EMU, EMU)!;   // 200:80 viewBox = 2.5:1 - text needs a uniform map
  const parts = buildPptxParts([{ shapes: [...r.paths, ...r.texts], media: [] }], {});
  const xml = parts['ppt/slides/slide1.xml'] as string;
  assert.match(xml, /<a:t>Live text<\/a:t>/);
  assert.match(xml, /typeface="SUSE"/);
  assert.match(xml, /<a:custGeom>/);
  assert.doesNotMatch(xml, /<p:pic>/);
});
