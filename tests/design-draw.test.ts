// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CompiledFrameV1, DesignBoxRowV1 } from '@lolly-tools/core';
import { DESIGN_DRAW_VERSION, compileDesignDraw, compileDesignRow, designDrawFindings, type DrawShapeOp, type DrawTextOp } from '../engine/src/design-draw.ts';
import { designDrawSvg } from '../engine/src/design-draw-svg.ts';
import { framePreviewSvg } from '../engine/src/frame-preview-svg.ts';
import { encodeAuthoredPaths } from '../engine/src/geom/authored-url.ts';

const triangle = encodeAuthoredPaths([{ kind: 'cubic', closed: true, nodes: [{ x: 0, y: 1 }, { x: 0.5, y: 0 }, { x: 1, y: 1 }] }] as never) ?? '';

/** One static page: a frame and a row of each kind version 0 draws, plus features it reports. */
function page(): DesignBoxRowV1[] {
  return [
    { id: 'f', kind: 'frame', x: 100, y: 50, w: 800, h: 600, bg: '#fafafa' },
    { id: 'rect', kind: 'box', x: 110, y: 60, w: 100, h: 40, bg: '#ff0000', stroke: '#000000', strokeW: 2, strokeDash: 'dashed' },
    { id: 'pill', kind: 'box', x: 110, y: 120, w: 100, h: 40, shape: 'pill', bg: '#00ff00' },
    { id: 'circle', kind: 'box', x: 300, y: 60, w: 80, h: 80, shape: 'circle', grad: 'lin.srgb_90_ff0000-0_0000ff-100', bg: '#ffffff' },
    { id: 'tri', kind: 'path', x: 400, y: 60, w: 100, h: 100, path: triangle, bg: '#222222', stroke: '#0000ff', strokeW: 3, rot: 30, flipH: true },
    { id: 'pic', kind: 'image', x: 520, y: 60, w: 160, h: 90, image: 'lolly/logo/primary', fit: 'cover', imgpos: '20% 30%' },
    { id: 'words', kind: 'text', x: 110, y: 200, w: 400, h: 120, text: 'Hello <world> & **bold**', fontSize: 24, font: 'display', fg: '#333333', opacity: 50, lineHeight: '1.4' },
    { id: 'gone', kind: 'box', x: 0, y: 0, w: 10, h: 10, bg: '#000000', hidden: true },
    { id: 'fx', kind: 'box', x: 600, y: 300, w: 50, h: 50, bg: '#123456', clip: 'pill', blend: 'multiply', shadow: 'soft', blur: 4, rx: 10, headEnd: 'arrow' },
  ];
}
const href = (ref: string) => `/assets/${ref}`;
const emit = { assetHref: href, family: (font: string) => font || 'system-ui', mono: 'monospace', title: 'Page' };

test('a static page compiles to versioned operations in page coordinates, in paint order, without its frame or hidden rows', () => {
  const rows = page(), before = structuredClone(rows);
  const draw = compileDesignDraw(rows, { width: 800, height: 600 });
  assert.equal(draw.version, DESIGN_DRAW_VERSION);
  assert.equal(draw.background, '#fafafa');
  assert.deepEqual(draw.ops.map(op => `${op.op}:${op.id}`), ['shape:rect', 'shape:pill', 'shape:circle', 'shape:tri', 'image:pic', 'text:words', 'shape:fx']);
  assert.deepEqual(draw.ops[0]!.box, { x: 10, y: 10, w: 100, h: 40 });
  assert.deepEqual(rows, before, 'compiling never mutates the authored rows');
  assert.deepEqual(compileDesignDraw(rows, { width: 800, height: 600 }), draw, 'the same rows compile to the same operations');
});

test('shapes, paints, strokes and poses carry Design semantics', () => {
  const draw = compileDesignDraw(page(), { width: 800, height: 600 });
  const [rect, pill, circle, tri] = draw.ops as DrawShapeOp[];
  assert.deepEqual(rect!.stroke, { color: '#000000', width: 2, dash: [6, 4], align: 'inside' }, 'Design draws a box outline as a border inside the box');
  assert.deepEqual(pill!.shape, { kind: 'rect', radius: 20 });
  assert.deepEqual(circle!.shape, { kind: 'ellipse' });
  assert.deepEqual(circle!.fills.map(fill => fill.kind), ['color', 'linear'], 'Design paints bg under the gradient');
  assert.equal(tri!.shape.kind, 'path');
  assert.ok(tri!.shape.kind === 'path' && tri!.shape.contours.length === 1 && tri!.shape.contours[0]!.closed);
  assert.deepEqual(tri!.stroke, { color: '#0000ff', width: 3, cap: 'round', join: 'round' });
  assert.deepEqual(tri!.pose, { rot: 30, flipH: true, flipV: false });
  const words = draw.ops[5] as DrawTextOp;
  assert.equal(words.opacity, 50);
  assert.equal(words.text!.valign, 'middle', 'Design centres a row that states no vertical alignment');
  assert.equal(words.text!.font, 'display');
});

test('every feature version 0 does not draw is reported against its row, never dropped silently', () => {
  const draw = compileDesignDraw(page(), { width: 800, height: 600 });
  const by = (id: string) => draw.findings.filter(f => f.id === id).map(f => f.feature);
  assert.deepEqual(by('fx'), ['clip', 'blend', 'shadow', 'blur', 'tilt', 'arrowheads']);
  assert.deepEqual(by('words'), ['text-layout-estimate', 'line-height']);
  assert.deepEqual(by('pic'), ['image-position']);
  assert.deepEqual(by('rect'), ['border-style'], 'a dashed CSS border spaces its marks to fit; the SVG dash does not');
  assert.deepEqual(by('gone'), [], 'a hidden row draws nothing and reports nothing');
  assert.deepEqual(designDrawFindings({ id: 'c', kind: 'box', grad: 'con_0_ff0000-0_0000ff-100' }), ['conic-gradient']);
  assert.deepEqual(designDrawFindings({ id: 'v', kind: 'web' }), ['non-static-kind']);
});

test('the page emitter escapes document text and draws the same markup the preview draws from the same rows', () => {
  const rows = page().filter(row => row.id !== 'fx');
  const svg = designDrawSvg(compileDesignDraw(rows, { width: 800, height: 600 }, { semantics: 'preview' }), emit);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="800" height="600"/);
  assert.ok(svg.includes('Hello &lt;world&gt; &amp; '), 'row text is escaped');
  assert.ok(!svg.includes('<world>'));
  assert.ok(svg.includes('href="/assets/lolly/logo/primary" preserveAspectRatio="xMidYMid slice"'));
  const frame = { id: 'f', name: 'Page', width: 800, height: 600, layers: rows, placeholderLayerIds: [] } as unknown as CompiledFrameV1;
  assert.equal(svg, framePreviewSvg(frame, { assetHref: href, fonts: { brand: 'system-ui', mono: 'monospace', sans: 'system-ui', display: 'display' } }));
});

test('a thumbnail compile leaves out contours under a pixel both ways', () => {
  const row = { id: 'tiny', kind: 'path', x: 0, y: 0, w: 4, h: 4, path: triangle, bg: '#000000' };
  const full = compileDesignRow(row, { x: 0, y: 0 }) as DrawShapeOp;
  const thumb = compileDesignRow(row, { x: 0, y: 0 }, { thumbScale: 0.1 }) as DrawShapeOp;
  assert.ok(full.shape.kind === 'path' && full.shape.contours.length === 1);
  assert.ok(thumb.shape.kind === 'path' && thumb.shape.contours.length === 0);
});

test('Design semantics: whole-pixel boxes, radius only where Design rounds, and outlines inside the box', () => {
  const row = (extra: Record<string, unknown>) => compileDesignRow({ id: 'r', kind: 'box', x: 10.4, y: 20.6, w: 100.5, h: 0.2, bg: '#000000', ...extra }, { x: 0, y: 0 }) as DrawShapeOp;
  assert.deepEqual(row({}).box, { x: 10, y: 21, w: 101, h: 1 });
  assert.deepEqual(row({ radius: 12, h: 60 }).shape, { kind: 'rect', radius: 0 }, 'a plain rectangle ignores its radius');
  assert.deepEqual(row({ shape: 'rounded', radius: 400, h: 60 }).shape, { kind: 'rect', radius: 30 }, 'CSS shrinks a radius that does not fit');
  assert.equal(row({ opacity: '40%' }).opacity, 40, 'opacity reads as CSS parseFloat');
  assert.equal(row({ flipH: 'yes', h: 60 }).pose?.flipH, true);
  const preview = compileDesignRow({ id: 'r', kind: 'box', x: 10.4, y: 0, w: 50, h: 50, radius: 8, stroke: '#000', strokeW: 2 }, { x: 0, y: 0 }, { semantics: 'preview' }) as DrawShapeOp;
  assert.deepEqual([preview.box.x, preview.shape, preview.stroke?.align], [10.4, { kind: 'rect', radius: 8 }, undefined], 'the preview keeps its own approximations');
});

test('effects compile to clip polygons, blends, shadows and blur, and leave the findings', () => {
  const rows = [
    { id: 'f', kind: 'frame', x: 0, y: 0, w: 400, h: 300 },
    { id: 'mask', kind: 'box', x: 10, y: 10, w: 100, h: 100, shape: 'circle', bg: '#cccccc' },
    { id: 'a', kind: 'box', x: 0, y: 0, w: 200, h: 100, bg: '#ff0000', clip: 'mask', blend: 'multiply', shadow: 'box', shadowX: 4, shadowY: 6, blur: 3 },
    { id: 'b', kind: 'box', x: 0, y: 150, w: 50, h: 50, bg: '#00ff00', shadow: 'depth', z: 40, blend: 'nonsense' },
  ];
  const draw = compileDesignDraw(rows as never, { width: 400, height: 300 }, { effects: true, colors: 'resolved' });
  const [, a, b] = draw.ops;
  assert.equal(a!.clip?.points.length, 48, 'an ellipse mask is the renderer\'s 48-point polygon');
  assert.equal(a!.blend, 'multiply');
  assert.deepEqual(a!.shadow, { target: 'box', dx: 4, dy: 6, blur: 10, color: '#000000', opacity: 0x55 / 255 });
  assert.equal(a!.blur, 3);
  assert.deepEqual(b!.shadow, { target: 'content', dx: 0, dy: 6, blur: 18, color: '#000000', opacity: 0x55 / 255 }, 'a depth shadow derives from z');
  assert.equal(b!.blend, undefined, 'an unknown blend keyword is ignored, as the renderer ignores it');
  assert.deepEqual(draw.findings, []);
  const svg = designDrawSvg(draw, emit);
  assert.ok(svg.includes('mix-blend-mode:multiply') && svg.includes('<clipPath') && svg.includes('<feDropShadow') && svg.includes('<feGaussianBlur'));
});
