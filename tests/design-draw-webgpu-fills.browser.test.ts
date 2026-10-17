// SPDX-License-Identifier: MPL-2.0
/**
 * P3f fills (pen shapes, strokes and their dashes, gradients, frames, rows clipped by other
 * rows and outlined words) against the real Design renderer.
 *
 * Primitives keep their zero-slack comparison in design-draw-webgpu.browser.test.ts.
 * Fills are judged within a declared band (plan 295, decision of 2026-10-14): Chromium
 * draws a path with its own edge coverage and draws text with its font rasteriser, not
 * as outlines, so neither matches a filled outline pixel for pixel. A stroke is drawn as
 * the fill of the region it paints and is judged as a shape. Shapes compare with
 * no positional slack and a coverage allowance per pixel; words compare run by run by
 * their ink and its centroid. Each word is also judged against its own outline, which is
 * exact on any platform and is the GPU's own contract. A rounded or elliptical frame leaves
 * the page transparent outside its outline, so both images are judged over the same
 * checkerboard. Each limit is proven by a negative control that must fail.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { test } from 'node:test';
import { chromium } from 'playwright';
import type { DesignBoxRowV1 } from '@lolly-tools/core';
import { compileDesignDraw, layoutDesignDrawText, outlineDesignDrawText, type DesignDrawPage, type DrawOp, type DrawShapeOp } from '../engine/src/design-draw.ts';
import { prepareDesignRaster } from '../engine/src/design-draw-raster.ts';
import { TEXT_MEASURE_DEFAULTS } from '../engine/src/design-text-measure.ts';
import { encodeAuthoredPaths } from '../engine/src/geom/authored-url.ts';
import { createNodeTextAPI } from '../packages/node-shell/src/text.ts';
import { createNodeTextShaper } from '../packages/node-shell/src/text-measure.ts';
import { repoRoot } from '../packages/node-shell/src/repo-root.ts';
import type { DesignRasterResult } from '../shells/web/src/lib/webgpu/design-page.ts';
import { compareInBrowser, type FidelityStats, type RegionStats } from './helpers/design-fidelity.ts';
import { createDesignGpuFixture, type DesignGpuCase } from './helpers/design-webgpu-fixture.ts';

interface WorkerResult extends DesignRasterResult { ok: true; png: Uint8Array }
interface FillProbe {
  render(page: DesignDrawPage, output?: { width: number; height: number; dpi?: number }): Promise<WorkerResult | { ok: false; error?: string; findings?: unknown }>;
  close(): void;
}
type ProbeWindow = Window & { designRasterProbe: FillProbe };

/**
 * Shapes: no positional slack, and an edge pixel's coverage may differ by up to 72 of
 * 255 levels, because Chromium quantises edge coverage and the fill computes exact area.
 * Measured on Mac Chrome (Metal): the worst shape region had 0.09% of its pixels above
 * 72 (a curved blob at 1x; 0.38% at 48, 0.84% at 24); the triangle moved 2 px differs in
 * 4.24%, far over the 0.5% share. A 1 px neighbourhood at 40 also caught the move (3.87%)
 * but left the blob at 0.38%, nearer the limit. Strokes on the Mac: every border and pen
 * stroke at 0.00% but the square-capped wave (0.13% at 1x, 0.31% at 2x, the 0.12 px Design
 * snaps it by; 0.01% against Chromium's SVG); a border 1 px wider differs in 3.72%, a pen
 * stroke 1 px wider in 2.82%. Frames on the Mac: every region of a rounded, bordered board
 * and an elliptical one at 0.01% or less, rows clipped included; without the frame's clip
 * the rows crossing its edge differ in up to 24% and the corners in up to 76%. Dashes on the
 * Mac: every dashed region at 0.05% or less, curves and dots included; with the dashes placed
 * by exact arc length rather than the browser's measure the dotted blob rose to 0.43%. The
 * dashed zig drawn solid differs in 2.19%, the mitred zig with each dash 2 px longer in 1.51%.
 * Row clips on the Mac: every clipped row at 0.04% or less, inside the board's clip as well;
 * drawn without their clips the clipped rows differ in 4.71% to 28.26%.
 */
const REPORT_ONLY = process.env.LOLLY_DESIGN_GPU_FILL_CALIBRATE === '1';
const FILL_SLACK = REPORT_ONLY && process.env.LOLLY_FILL_SLACK ? Number(process.env.LOLLY_FILL_SLACK) : 0;
const FILL_THRESHOLD = REPORT_ONLY && process.env.LOLLY_FILL_THRESHOLD ? Number(process.env.LOLLY_FILL_THRESHOLD) : 72;
const REGION_SHARE = 0.005;
/**
 * Words against Design: a run's ink must match the browser's text within this share, and
 * its centroid within this many px times the output scale. Measured: outlines carry up to
 * 17.1% less ink than the browser's text on Mac Chrome (its font rasteriser draws heavier)
 * and up to 6.9% on Linux CI. Centroids sat within 0.59 px on the Mac; on Linux CI the
 * italic run of the rich fixture sat 1.20 px away at 1x and 2.53 px at 2x, and Chromium's
 * SVG of the same operations sat 1.08 px and 2.62 px from Chromium's text, so that distance
 * is Chromium's own text layout on Linux, not the GPU. The GPU's position is judged against
 * its outlines below. A missing word and a word moved by 3 px each fail this band.
 */
const INK_SHARE = 0.25, INK_SHIFT = 1.5;
/**
 * Words against their own outlines: a run's ink in the GPU image must equal its exact area
 * (times its paint's contrast) within this share, and its ink centroid must sit on the
 * outline's area centroid within this many output px. This is the GPU's own contract and
 * holds on any platform; the Design band above also carries the drawing compiler's layout.
 * Measured on Mac Chrome (Metal): ink within 0.04% and centroids within 0.013 px; the same
 * word moved by 0.25 px sits 0.257 px away. Chromium's SVG of the same outlines is not this
 * reference: on Metal it rasterises them with quarter-step coverage and sat up to 0.36 px off.
 */
/**
 * Gradients: inside each unturned gradient box, past its outline, no pixel may differ from
 * the Design renderer by more than this many levels. Measured on Mac Chrome: every interior
 * pixel within one level at 1x and 2x (about half differ by exactly one). The same gradient
 * line moved 2 px, and an OKLab ramp drawn from its two end colours, both fail.
 */
const GRADIENT_THRESHOLD = REPORT_ONLY && process.env.LOLLY_GRADIENT_THRESHOLD ? Number(process.env.LOLLY_GRADIENT_THRESHOLD) : 2;
const EXACT_INK_SHARE = REPORT_ONLY && process.env.LOLLY_EXACT_INK_SHARE ? Number(process.env.LOLLY_EXACT_INK_SHARE) : 0.01;
const EXACT_SHIFT = REPORT_ONLY && process.env.LOLLY_EXACT_SHIFT ? Number(process.env.LOLLY_EXACT_SHIFT) : 0.05;

const path = (closed: boolean, nodes: Array<Record<string, number>>) => encodeAuthoredPaths([{ kind: 'cubic', closed, nodes }] as never) ?? '';
const triangle = path(true, [{ x: 0, y: 1 }, { x: 0.5, y: 0 }, { x: 1, y: 1 }]);
const blob = path(true, [
  { x: 0.5, y: 0, hInX: -0.3, hInY: 0, hOutX: 0.3, hOutY: 0 },
  { x: 1, y: 0.55, hInX: 0, hInY: -0.3, hOutX: 0, hOutY: 0.3 },
  { x: 0.45, y: 1, hInX: 0.35, hInY: 0, hOutX: -0.35, hOutY: 0 },
  { x: 0, y: 0.45, hInX: 0, hInY: 0.3, hOutX: 0, hOutY: -0.3 },
]);
const ring = encodeAuthoredPaths([
  { kind: 'cubic', closed: true, nodes: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] },
  { kind: 'cubic', closed: true, nodes: [{ x: 0.25, y: 0.25 }, { x: 0.75, y: 0.25 }, { x: 0.75, y: 0.75 }, { x: 0.25, y: 0.75 }] },
] as never) ?? '';

const zig = path(false, [{ x: 0, y: 1 }, { x: 0.3, y: 0 }, { x: 0.6, y: 1 }, { x: 1, y: 0.2 }]);
const wave = path(false, [{ x: 0, y: 0.5, hOutX: 0.2, hOutY: -0.6 }, { x: 0.5, y: 0.5, hInX: -0.2, hInY: 0.6, hOutX: 0.2, hOutY: 0.6 }, { x: 1, y: 0.5, hInX: -0.2, hInY: -0.6 }]);
const diagonal = path(false, [{ x: 0, y: 0 }, { x: 1, y: 1 }]);

const on = (row: DesignBoxRowV1): DesignBoxRowV1 => ({ frame: 'page', ...row });
const pathRows: DesignBoxRowV1[] = [
  { id: 'page', kind: 'frame', x: 0, y: 0, w: 320, h: 240, bg: '#ffffff' },
  on({ id: 'triangle', kind: 'path', x: 20, y: 20, w: 90, h: 80, path: triangle, bg: '#f03e3e' }),
  on({ id: 'ring', kind: 'path', x: 130, y: 20, w: 80, h: 80, path: ring, bg: '#7048e8', fillRule: 'evenodd' }),
  on({ id: 'blob', kind: 'path', x: 230, y: 20, w: 70, h: 80, path: blob, bg: '#12b886' }),
  on({ id: 'turned', kind: 'path', x: 30, y: 130, w: 90, h: 80, path: triangle, bg: '#1c7ed6', rot: 23, flipH: true }),
  on({ id: 'under', kind: 'box', x: 170, y: 140, w: 120, h: 70, bg: '#212529' }),
  on({ id: 'faded', kind: 'path', x: 150, y: 120, w: 100, h: 90, path: blob, bg: '#fab005', opacity: 60 }),
];
/**
 * Pen strokes with each cap and join, and CSS borders on each box outline. Design offsets a
 * pen shape's svg by its stroke pad and Chromium snaps a fractional pad to whole pixels,
 * which moves a round-capped odd width 0.5 px off its geometry (pad 0.5 or 1.5) and a
 * square cap 0.12 px (pad w/sqrt 2); the operations and the GPU keep the geometry. The
 * hairline therefore takes a mitre join, whose pad (twice the width) is whole.
 */
const strokeRows: DesignBoxRowV1[] = [
  { id: 'page', kind: 'frame', x: 0, y: 0, w: 320, h: 240, bg: '#ffffff' },
  on({ id: 'zig', kind: 'path', x: 15, y: 15, w: 90, h: 60, path: zig, stroke: '#e03131', strokeW: 6 }),
  on({ id: 'mitre', kind: 'path', x: 125, y: 20, w: 75, h: 50, path: zig, stroke: '#1971c2', strokeW: 5, strokeJoin: 'miter', strokeCap: 'butt' }),
  on({ id: 'wave', kind: 'path', x: 220, y: 15, w: 85, h: 60, path: wave, stroke: '#2f9e44', strokeW: 3, strokeCap: 'square', strokeJoin: 'bevel' }),
  on({ id: 'outlined', kind: 'path', x: 15, y: 95, w: 80, h: 70, path: blob, bg: '#ffd43b', stroke: '#5f3dc4cc', strokeW: 4 }),
  on({ id: 'bordered', kind: 'box', x: 110, y: 95, w: 90, h: 60, bg: '#a5d8ff', stroke: '#1864ab', strokeW: 6 }),
  on({ id: 'rounded', kind: 'box', x: 215, y: 95, w: 90, h: 60, shape: 'rounded', radius: 16, stroke: '#c2255c', strokeW: 4 }),
  on({ id: 'ellipse', kind: 'box', x: 15, y: 180, w: 90, h: 50, shape: 'ellipse', bg: '#b2f2bb', stroke: '#2b8a3e', strokeW: 5 }),
  on({ id: 'pill', kind: 'box', x: 120, y: 172, w: 90, h: 30, shape: 'pill', stroke: '#e8590c99', strokeW: 3 }),
  on({ id: 'turned', kind: 'box', x: 230, y: 175, w: 70, h: 45, shape: 'rounded', radius: 10, rot: 21, bg: '#ffe066', stroke: '#495057', strokeW: 3 }),
  on({ id: 'hair', kind: 'path', x: 120, y: 212, w: 90, h: 18, path: diagonal, stroke: '#212529', strokeW: 1, strokeJoin: 'miter', strokeCap: 'butt' }),
];
/** Linear and radial gradients over colours, outlines, a border and a pose, as Design paints CSS backgrounds. */
const gradientRows: DesignBoxRowV1[] = [
  { id: 'page', kind: 'frame', x: 0, y: 0, w: 320, h: 240, bg: '#ffffff' },
  on({ id: 'linear', kind: 'box', x: 15, y: 15, w: 90, h: 60, grad: 'lin.srgb_90_ff6b6b-0_4dabf7-100' }),
  on({ id: 'angled', kind: 'box', x: 120, y: 15, w: 90, h: 60, bg: '#212529', grad: 'lin.srgb_30_ffd43b-0_1c7ed600-100' }),
  on({ id: 'oklab', kind: 'box', x: 225, y: 15, w: 80, h: 60, grad: 'lin.oklab_135_1c7ed6-0_f03e3e-100' }),
  on({ id: 'radial', kind: 'box', x: 15, y: 90, w: 90, h: 60, shape: 'rounded', radius: 12, bg: '#212529', grad: 'rad.srgb_0_ffffff-0_ffffff00-100' }),
  on({ id: 'hard', kind: 'box', x: 120, y: 90, w: 90, h: 60, grad: 'lin.srgb_0_e8590c-0_e8590c-50_5c940d-50_5c940d-100' }),
  on({ id: 'bordered', kind: 'box', x: 225, y: 90, w: 80, h: 60, grad: 'lin.srgb_90_862e9c-0_ffffff-100', stroke: '#00000066', strokeW: 8 }),
  on({ id: 'turned', kind: 'box', x: 20, y: 165, w: 90, h: 55, shape: 'ellipse', grad: 'rad.srgb_0_fab005-0_1864ab-100', rot: 20, flipH: true }),
  on({ id: 'faded', kind: 'box', x: 125, y: 165, w: 80, h: 60, grad: 'lin.srgb_180_12b886-0_7048e8-100', opacity: 60 }),
  on({ id: 'pill', kind: 'box', x: 225, y: 175, w: 80, h: 40, shape: 'pill', grad: 'lin.srgb_45_000000-0_ffffff-100' }),
];
/** Frames that clip their rows: rounded with a border, and elliptical, each crossed by rows at its edge. */
const boardRows: DesignBoxRowV1[] = [
  { id: 'page', kind: 'frame', x: 0, y: 0, w: 320, h: 240, bg: '#f8f9fa', shape: 'rounded', radius: 28, stroke: '#495057', strokeW: 6 },
  on({ id: 'corner', kind: 'box', x: -20, y: -20, w: 100, h: 80, bg: '#e03131' }),
  on({ id: 'edge', kind: 'path', x: 250, y: 40, w: 100, h: 90, path: blob, bg: '#1c7ed6' }),
  on({ id: 'line', kind: 'path', x: -30, y: 150, w: 120, h: 60, path: zig, stroke: '#2f9e44', strokeW: 6 }),
  on({ id: 'ramp', kind: 'box', x: 150, y: 190, w: 140, h: 80, shape: 'rounded', radius: 14, grad: 'lin.srgb_90_7048e8-0_fab005-100' }),
];
const ovalRows: DesignBoxRowV1[] = [
  { id: 'page', kind: 'frame', x: 0, y: 0, w: 320, h: 240, bg: '#fff3bf', shape: 'ellipse' },
  on({ id: 'left', kind: 'box', x: -10, y: 60, w: 90, h: 120, bg: '#5f3dc4' }),
  on({ id: 'top', kind: 'path', x: 110, y: -30, w: 100, h: 90, path: triangle, bg: '#e8590c' }),
  on({ id: 'lower', kind: 'box', x: 200, y: 160, w: 120, h: 90, shape: 'ellipse', bg: '#0b7285', rot: 15 }),
];
/**
 * Dashed pen strokes as Design's path hook writes them: the keyword patterns and authored
 * lengths, on straight runs and curves, open and closed, with each cap and join. The closed
 * triangle's pattern ends inside a dash, so its last dash runs on into its first across the
 * starting corner. Every pad is a whole pixel.
 */
const dashRows: DesignBoxRowV1[] = [
  { id: 'page', kind: 'frame', x: 0, y: 0, w: 320, h: 240, bg: '#ffffff' },
  on({ id: 'zig', kind: 'path', x: 15, y: 15, w: 90, h: 60, path: zig, stroke: '#e03131', strokeW: 4, strokeDash: 'dashed' }),
  on({ id: 'mitre', kind: 'path', x: 125, y: 20, w: 75, h: 50, path: zig, stroke: '#1971c2', strokeW: 5, strokeJoin: 'miter', strokeCap: 'butt', strokeDash: 'dashed', strokeDashLen: 10, strokeGapLen: 6 }),
  on({ id: 'wave', kind: 'path', x: 220, y: 15, w: 85, h: 60, path: wave, stroke: '#2f9e44', strokeW: 3, strokeDash: 'dashed', strokeDashLen: 9, strokeGapLen: 6 }),
  on({ id: 'dots', kind: 'path', x: 15, y: 95, w: 80, h: 70, path: blob, stroke: '#5f3dc4', strokeW: 4, strokeDash: 'dotted' }),
  on({ id: 'squares', kind: 'path', x: 120, y: 100, w: 80, h: 50, path: diagonal, stroke: '#c2255c', strokeW: 4, strokeDash: 'dotted', strokeCap: 'square' }),
  on({ id: 'blocks', kind: 'path', x: 215, y: 95, w: 90, h: 60, path: zig, stroke: '#e8590c', strokeW: 4, strokeDash: 'dotted', strokeCap: 'butt', strokeJoin: 'miter' }),
  on({ id: 'closed', kind: 'path', x: 15, y: 175, w: 90, h: 55, path: triangle, stroke: '#0b7285', strokeW: 4, strokeJoin: 'miter', strokeCap: 'butt', strokeDash: 'dashed', strokeDashLen: 18, strokeGapLen: 6 }),
  on({ id: 'filled', kind: 'path', x: 125, y: 170, w: 80, h: 60, path: blob, bg: '#ffd43b', stroke: '#495057', strokeW: 3, strokeDash: 'dashed', strokeDashLen: 8, strokeGapLen: 5 }),
  on({ id: 'turned', kind: 'path', x: 225, y: 178, w: 80, h: 45, path: zig, stroke: '#212529', strokeW: 3, strokeDash: 'dashed', strokeDashLen: 7, strokeGapLen: 5, rot: 20 }),
];
/**
 * Rows clipped by another row's silhouette (Design's `clip-path: polygon()`): a bordered box
 * with a gradient inside a circle, a stroked pen shape turned inside a turned rectangle, a
 * rounded box with a radial gradient inside an ellipse and a dashed stroke inside a diamond.
 */
const clipRows: DesignBoxRowV1[] = [
  { id: 'page', kind: 'frame', x: 0, y: 0, w: 320, h: 240, bg: '#ffffff' },
  on({ id: 'disc', kind: 'box', x: 20, y: 20, w: 90, h: 90, shape: 'circle', bg: '#e9ecef' }),
  on({ id: 'cut', kind: 'box', x: 10, y: 40, w: 130, h: 50, bg: '#e03131', grad: 'lin.srgb_90_ffffff00-0_1c7ed6-100', stroke: '#212529', strokeW: 4, clip: 'disc' }),
  on({ id: 'tilt', kind: 'box', x: 185, y: 30, w: 80, h: 55, rot: 25, bg: '#f1f3f5' }),
  on({ id: 'blade', kind: 'path', x: 165, y: 12, w: 120, h: 90, path: blob, bg: '#12b886', stroke: '#087f5b', strokeW: 4, clip: 'tilt', rot: -10 }),
  on({ id: 'oval', kind: 'box', x: 40, y: 130, w: 120, h: 80, shape: 'ellipse', bg: '#fff3bf' }),
  on({ id: 'ramp', kind: 'box', x: 20, y: 150, w: 160, h: 50, shape: 'rounded', radius: 12, grad: 'rad.srgb_0_fab005-0_7048e8-100', clip: 'oval' }),
  on({ id: 'diamond', kind: 'box', x: 210, y: 135, w: 70, h: 70, rot: 45, bg: '#f8f0fc' }),
  on({ id: 'line', kind: 'path', x: 190, y: 120, w: 110, h: 100, path: zig, stroke: '#c2255c', strokeW: 5, strokeDash: 'dashed', clip: 'diamond' }),
];
/** A rounded, bordered board that clips its rows, whose rows are clipped by other rows as well. */
const clippedBoardRows: DesignBoxRowV1[] = [
  { id: 'page', kind: 'frame', x: 0, y: 0, w: 320, h: 240, bg: '#f8f9fa', shape: 'rounded', radius: 28, stroke: '#495057', strokeW: 6 },
  on({ id: 'hole', kind: 'box', x: -30, y: -30, w: 120, h: 120, shape: 'circle', bg: '#dee2e6' }),
  on({ id: 'cross', kind: 'box', x: -20, y: 15, w: 140, h: 60, bg: '#e03131', grad: 'lin.srgb_0_ffffff00-0_fab005-100', clip: 'hole' }),
  on({ id: 'band', kind: 'box', x: 220, y: 120, w: 120, h: 70, rot: 15 }),
  on({ id: 'wing', kind: 'path', x: 230, y: 100, w: 120, h: 110, path: blob, bg: '#1c7ed6', stroke: '#1864ab', strokeW: 4, clip: 'band' }),
];
const textRows: DesignBoxRowV1[] = [
  { id: 'page', kind: 'frame', x: 0, y: 0, w: 320, h: 240, bg: '#ffffff' },
  on({ id: 'title', kind: 'text', x: 10, y: 10, w: 300, h: 60, text: 'Design', fontSize: 40 }),
  on({ id: 'para', kind: 'text', x: 10, y: 80, w: 150, h: 70, text: 'Left and top, wrapping onto lines', fontSize: 16, weight: 400, align: 'left', valign: 'top' }),
  on({ id: 'rich', kind: 'text', x: 170, y: 80, w: 140, h: 70, text: 'Plain **bold** *italic* {#d6336c|pink}', fontSize: 16, weight: 400, align: 'left' }),
  on({ id: 'boxed', kind: 'box', x: 10, y: 165, w: 140, h: 60, text: 'On a box', fontSize: 18, bg: '#2b8a3e', fg: '#ffffff' }),
  on({ id: 'right', kind: 'text', x: 170, y: 165, w: 140, h: 60, text: 'Right, bottom', fontSize: 18, align: 'right', valign: 'bottom', fg: '#1864ab' }),
];

/** One ink region per outlined run, in output pixels: its advance, a size above and below the baseline. */
function runRegions(drawing: DesignDrawPage, sx: number, sy: number) {
  return drawing.ops.flatMap((op: DrawOp) => {
    const layout = op.words?.layout, size = op.words?.spec.size ?? TEXT_MEASURE_DEFAULTS.size;
    if (!layout) return [];
    return layout.lines.flatMap((line, l) => line.runs.flatMap((run, r) => {
      if (!run.text.trim()) return [];
      const x0 = op.box.x + line.x + run.x - 1, y0 = op.box.y + line.baseline - size;
      return [{ id: `${op.id}:${l}.${r}`, x: x0 * sx, y: y0 * sy, w: (run.width + 2) * sx, h: 1.3 * size * sy, ink: true as const }];
    }));
  });
}

/**
 * Shape regions: each operation without words, over its turned bounds, padded four pixels
 * and, for a pen stroke, by twice its width, as far as a join at SVG's mitre limit reaches.
 */
function shapeRegions(drawing: DesignDrawPage, sx: number, sy: number) {
  return drawing.ops.filter(op => !op.words).map(op => {
    const a = (op.pose?.rot ?? 0) * Math.PI / 180;
    const w = Math.abs(Math.cos(a)) * op.box.w + Math.abs(Math.sin(a)) * op.box.h, h = Math.abs(Math.sin(a)) * op.box.w + Math.abs(Math.cos(a)) * op.box.h;
    const pad = 4 + (op.op === 'shape' && op.shape.kind === 'path' && op.stroke ? 2 * op.stroke.width : 0);
    return { id: op.id, x: (op.box.x + (op.box.w - w) / 2 - pad) * sx, y: (op.box.y + (op.box.h - h) / 2 - pad) * sy, w: (w + 2 * pad) * sx, h: (h + 2 * pad) * sy };
  });
}

/** A frame that is not a plain rectangle: each corner of the page, where its outline, border and clip meet the rows. */
function frameRegions(drawing: DesignDrawPage, sx: number, sy: number) {
  const frame = drawing.frame;
  if (!frame || (frame.shape.kind === 'rect' && !frame.shape.radius && !frame.stroke)) return [];
  const size = 56, w = drawing.width, h = drawing.height;
  return [[0, 0], [w - size, 0], [0, h - size], [w - size, h - size]].map(([x, y], i) => ({ id: `frame:${['top-left', 'top-right', 'bottom-left', 'bottom-right'][i]}`, x: x! * sx, y: y! * sy, w: size * sx, h: size * sy }));
}

/**
 * The inside of each unturned box with a gradient, in output pixels, inset past its outline
 * (and an ellipse's curve) so edge coverage stays out and only the gradient's colour is judged.
 * A box clipped by another row has the clip's edge running through its inside, so it is
 * judged by its region alone.
 */
function gradientInteriors(drawing: DesignDrawPage, sx: number, sy: number) {
  return drawing.ops.filter(op => op.op === 'shape' && op.shape.kind !== 'path' && !op.pose?.rot && !op.clip && op.fills.some(f => f.kind !== 'color')).map(op => {
    const border = op.op === 'shape' && op.stroke ? op.stroke.width : 0;
    const ix = 0.3 * op.box.w / 2 + border + 2, iy = 0.3 * op.box.h / 2 + border + 2;
    return { id: `${op.id}:inside`, x: (op.box.x + ix) * sx, y: (op.box.y + iy) * sy, w: (op.box.w - 2 * ix) * sx, h: (op.box.h - 2 * iy) * sy };
  });
}

/** Each word fill's exact area and area centroid in output px (pixel indices), from the admitted edges. */
function outlineTruth(drawing: DesignDrawPage, sx: number, sy: number) {
  // Admitted at the rendered size, so the edges are flattened exactly as the GPU received them.
  const admitted = prepareDesignRaster(drawing, { width: 320 * sx, height: 240 * sy, dpi: 96 * sx });
  assert.ok(admitted.ok, 'the fixture page is admitted');
  return admitted.evaluation.fills.filter(f => /:\d+\.\d+$/.test(f.id)).map(f => {
    let area = 0, cx = 0, cy = 0;
    for (let i = 0; i < f.edges.length; i += 4) {
      const x0 = f.edges[i]! * sx, y0 = f.edges[i + 1]! * sy, x1 = f.edges[i + 2]! * sx, y1 = f.edges[i + 3]! * sy, k = x0 * y1 - x1 * y0;
      area += k; cx += (x0 + x1) * k; cy += (y0 + y1) * k;
    }
    area /= 2;
    return { id: f.id, area: Math.abs(area), x: cx / (6 * area) - 0.5, y: cy / (6 * area) - 0.5, color: [...f.color],
      box: [Math.floor(f.bounds[0] * sx) - 1, Math.floor(f.bounds[1] * sy) - 1, Math.ceil(f.bounds[2] * sx) + 1, Math.ceil(f.bounds[3] * sy) + 1] };
  });
}

/** Runs in the browser: per box, the ink a shot adds over the ground and its centroid, and the ink its paint would add per unit of area. */
async function inkInBrowser(shot: string, ground: string, width: number, height: number, boxes: Array<{ box: number[]; color: number[] }>) {
  const pixels = async (src: string) => {
    const img = new Image(); img.src = src; await img.decode();
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, width, height).data;
  };
  const [ps, pg] = await Promise.all([pixels(shot), pixels(ground)]);
  const lum = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return boxes.map(({ box: [x0, y0, x1, y1], color }) => {
    let ink = 0, x = 0, y = 0;
    for (let yy = Math.max(0, y0!); yy < Math.min(height, y1!); yy++) for (let xx = Math.max(0, x0!); xx < Math.min(width, x1!); xx++) {
      const i = (yy * width + xx) * 4, w = Math.abs(lum(ps[i]!, ps[i + 1]!, ps[i + 2]!) - lum(pg[i]!, pg[i + 1]!, pg[i + 2]!));
      ink += w; x += w * xx; y += w * yy;
    }
    const mid = (Math.floor((y0! + y1!) / 2) * width + Math.floor((x0! + x1!) / 2)) * 4;
    const perArea = color[3]! * Math.abs(lum(color[0]! * 255, color[1]! * 255, color[2]! * 255) - lum(pg[mid]!, pg[mid + 1]!, pg[mid + 2]!));
    return { ink, x: ink ? x / ink : 0, y: ink ? y / ink : 0, perArea };
  });
}

function fault(r: RegionStats, scale: number): string | undefined {
  if (r.ink) {
    const share = r.ink.a ? Math.abs(r.ink.a - r.ink.b) / r.ink.a : 0, shift = Math.hypot(r.ink.ax - r.ink.bx, r.ink.ay - r.ink.by);
    return share > INK_SHARE || shift > INK_SHIFT * scale ? `ink differs by ${(100 * share).toFixed(1)}% and sits ${shift.toFixed(2)} px away` : undefined;
  }
  return r.pixels && r.differing / r.pixels > REGION_SHARE ? `${(100 * r.differing / r.pixels).toFixed(2)}% of ${r.pixels} px` : undefined;
}

test('opt-in Design GPU fills draw pen shapes, strokes and outlined words within the declared band', { timeout: 300_000 }, async t => {
  const root = repoRoot();
  const shaper = createNodeTextShaper({ repoRoot: root }), text = createNodeTextAPI({ repoRoot: root });
  const drawn = async (rows: DesignBoxRowV1[]) => {
    const d = compileDesignDraw(rows, { width: 320, height: 240 }, { effects: true, colors: 'resolved' });
    await layoutDesignDrawText(d, shaper);
    await outlineDesignDrawText(d, o => text.toPath(o));
    assert.deepEqual(d.findings, [], 'the fixture compiles without findings');
    return d;
  };
  const cases: DesignGpuCase[] = [];
  for (const [name, rows] of [['paths', pathRows], ['strokes', strokeRows], ['gradients', gradientRows], ['board', boardRows], ['oval', ovalRows], ['text', textRows],
    ['dashes', dashRows], ['clips', clipRows], ['clipped-board', clippedBoardRows]] as const) {
    const drawing = await drawn(rows);
    for (const scale of [1, 2]) cases.push({ key: `${name}-${scale}`, rows, drawing, scaleX: scale, scaleY: scale, original: true });
  }
  const face = async (file: string) => (await readFile(new URL(`../shells/web/public/fonts/${file}`, import.meta.url))).toString('base64');
  const head = `<style>@font-face{font-family:'SUSE';src:url(data:font/ttf;base64,${await face('SUSE[wght].ttf')}) format('truetype');font-weight:100 900;font-style:normal}`
    + `@font-face{font-family:'SUSE';src:url(data:font/ttf;base64,${await face('SUSE-Italic[wght].ttf')}) format('truetype');font-weight:100 900;font-style:italic}`
    + `#tool-canvas{--font-brand:'SUSE';--font-display:'SUSE';--font-italic:'SUSE'}</style>`;
  const fixture = await createDesignGpuFixture({ cases, head });
  t.after(() => fixture.close());
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'darwin' ? { channel: 'chrome' } : {}) });
  t.after(() => browser.close());
  const context = await browser.newContext({ deviceScaleFactor: 1 });
  const probe = await context.newPage(); await probe.goto(fixture.origin); await probe.waitForFunction(() => !!(window as ProbeWindow).designRasterProbe);
  t.after(async () => { if (!probe.isClosed()) await probe.evaluate(() => (window as ProbeWindow).designRasterProbe.close()); });
  // Both sides are judged as seen over a one-pixel black and white checkerboard: a
  // transparent pixel's own colour carries little information, and anything drawn where the
  // page is transparent differs by at least half the range on half its pixels, whatever its colour.
  const flatten = (src: string, width: number, height: number) => probe.evaluate(async ({ src, width, height }) => {
    const img = new Image(); img.src = src; await img.decode();
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d')!, board = ctx.createImageData(width, height);
    for (let i = 0; i < width * height; i++) board.data.fill((i % width + Math.floor(i / width)) % 2 ? 255 : 0, i * 4, i * 4 + 3).fill(255, i * 4 + 3, i * 4 + 4);
    ctx.putImageData(board, 0, 0); ctx.drawImage(img, 0, 0);
    return canvas.toDataURL('image/png');
  }, { src, width, height });
  const render = async (page: DesignDrawPage, width: number, height: number) => {
    const value = await probe.evaluate(async ({ page, output }) => {
      const v = await (window as ProbeWindow).designRasterProbe.render(page, output);
      return v.ok ? { ok: true as const, png: Array.from(v.png), allocation: v.allocation } : v;
    }, { page, output: { width, height, dpi: 96 * width / 320 } });
    assert.ok(value.ok, `the GPU renders the page: ${JSON.stringify(value)}`);
    assert.equal(value.allocation.liveBytes, 0);
    return flatten(`data:image/png;base64,${Buffer.from(value.png).toString('base64')}`, width, height);
  };
  const report: Array<{ page: string; failing: string[]; regions: RegionStats[]; inside: RegionStats[]; outline: Array<{ id: string; share: number; shift: number }>; svg: RegionStats[]; layout: RegionStats[]; faces: string[] }> = [];
  const failures: string[] = [];
  // Under load, headless Chrome can return a torn frame (upper rows repeated below), so a
  // reference is the first screenshot that matches the one taken just before.
  const faces = new Map<string, string[]>();
  const reference = async (url: string, width: number, height: number) => {
    const page = await context.newPage(); await page.setViewportSize({ width, height });
    await page.goto(url); await page.evaluate(() => document.fonts.ready);
    faces.set(url, await page.evaluate(() => [...document.fonts].map(f => `${f.family} ${f.style} ${f.weight} ${f.status}`)));
    // Transparent where the page paints nothing (outside a rounded or elliptical frame), as the GPU leaves those pixels.
    const capture = () => page.screenshot({ clip: { x: 0, y: 0, width, height }, omitBackground: true });
    let shot = await capture(), previous: Buffer | undefined;
    for (let tries = 0; !previous?.equals(shot); tries++) {
      assert.ok(tries < 8, `${url} settles into a stable screenshot`);
      previous = shot; shot = await capture();
    }
    await page.close();
    return flatten(`data:image/png;base64,${shot.toString('base64')}`, width, height);
  };
  const detail = (r: RegionStats) => r.ink ? `ink ${(100 * Math.abs(r.ink.a - r.ink.b) / (r.ink.a || 1)).toFixed(1)}% shift ${Math.hypot(r.ink.ax - r.ink.bx, r.ink.ay - r.ink.by).toFixed(2)}` : `${(100 * r.differing / (r.pixels || 1)).toFixed(2)}%`;
  for (const c of cases) {
    const width = 320 * c.scaleX, height = 240 * c.scaleY;
    const design = await reference(`${fixture.origin}/design/${c.key}`, width, height);
    const svg = await reference(`${fixture.origin}/svg/${c.key}`, width, height);
    const gpu = await render(c.drawing, width, height);
    const words = c.drawing.ops.some(op => op.words);
    const ground = words ? await render({ ...c.drawing, ops: c.drawing.ops.map(({ words: _w, ...op }) => op as DrawOp) }, width, height) : undefined;
    const regions = [...shapeRegions(c.drawing, c.scaleX, c.scaleY), ...frameRegions(c.drawing, c.scaleX, c.scaleY), ...runRegions(c.drawing, c.scaleX, c.scaleY)];
    const compareWith = (before: string, shot: string, within: typeof regions, threshold = FILL_THRESHOLD) => probe.evaluate<FidelityStats>(
      `(${compareInBrowser.toString()})(${JSON.stringify(before)},${JSON.stringify(shot)},${width},${height},${JSON.stringify(within)},${threshold},${ground ? JSON.stringify(ground) : 'undefined'},${FILL_SLACK})`);
    const compare = (shot: string, within: typeof regions) => compareWith(design, shot, within);
    // Against Design: shapes by pixels, words by ink and centroid.
    const stats = await compare(gpu, regions);
    // Against the exact outlines: each word's ink and centroid in the GPU image.
    const truth = words ? outlineTruth(c.drawing, c.scaleX, c.scaleY) : [];
    const outlineFault = async (shot: string, run: (typeof truth)[number]) => {
      const [m] = await probe.evaluate(`(${inkInBrowser.toString()})(${JSON.stringify(shot)},${JSON.stringify(ground)},${width},${height},${JSON.stringify([run])})`) as Array<{ ink: number; x: number; y: number; perArea: number }>;
      const share = Math.abs(m!.ink / (m!.perArea * run.area) - 1), shift = Math.hypot(m!.x - run.x, m!.y - run.y);
      return { share, shift, fault: share > EXACT_INK_SHARE || shift > EXACT_SHIFT ? `ink differs from the outline's area by ${(100 * share).toFixed(2)}% and sits ${shift.toFixed(3)} px from its centroid` : undefined };
    };
    const outline = await Promise.all(truth.map(async run => ({ id: run.id, ...(await outlineFault(gpu, run)) })));
    // Against Design inside each gradient, by colour alone.
    const interiors = gradientInteriors(c.drawing, c.scaleX, c.scaleY);
    const insideFault = async (shot: string, within: typeof interiors) => interiors.length
      ? (await compareWith(design, shot, within, GRADIENT_THRESHOLD)).regions.filter(r => r.differing > 0) : [];
    const inside = await insideFault(gpu, interiors);
    const failing = [
      ...stats.regions.flatMap(r => { const f = fault(r, c.scaleX); return f ? [`${r.id}: ${f}`] : []; }),
      ...outline.flatMap(r => r.fault ? [`${r.id} against its outline: ${r.fault}`] : []),
      ...inside.map(r => `${r.id}: ${r.differing} of ${r.pixels} px differ by more than ${GRADIENT_THRESHOLD} levels`),
    ];
    // Diagnostics only: Chromium's own SVG of the same operations, and how far Chromium's text
    // sits from the operations' layout (the drawing compiler's harness owns that limit).
    const svgStats = await compareWith(svg, gpu, regions);
    const layout = words ? (await compareWith(design, svg, regions.filter(r => 'ink' in r))).regions : [];
    report.push({ page: c.key, failing, regions: stats.regions, inside, outline: outline.map(({ id, share, shift }) => ({ id, share, shift })), svg: svgStats.regions, layout, faces: faces.get(`${fixture.origin}/design/${c.key}`) ?? [] });
    failures.push(...failing.map(f => `${c.key}/${f}`));
    for (const r of stats.regions) t.diagnostic(`${c.key} ${r.id}: ${detail(r)}`);
    if (interiors.length && REPORT_ONLY) for (const level of [0, 1, 2, 3, 4, 6]) {
      const inside = await compareWith(design, gpu, interiors, level);
      t.diagnostic(`${c.key} gradient interiors over ${level}: ${inside.regions.map(r => `${r.id.split(':')[0]} ${r.differing}/${r.pixels}`).join(', ')}`);
    }
    for (const r of outline) t.diagnostic(`${c.key} ${r.id} against its outline: ink ${(100 * r.share).toFixed(2)}% shift ${r.shift.toFixed(3)}`);
    for (const r of svgStats.regions) t.diagnostic(`${c.key} ${r.id} against the SVG: ${detail(r)}`);
    for (const r of layout) t.diagnostic(`${c.key} ${r.id} Design text against the SVG: ${detail(r)}`);
    if (c.key === 'paths-1') {
      // Negative control: the same page with the triangle moved 2 px must fail its region.
      // A path's geometry is its contours (page coordinates), so the move shifts them with the box.
      const moved = structuredClone(c.drawing), target = moved.ops.find(op => op.id === 'triangle')!;
      target.box.x += 2;
      if (target.op === 'shape' && target.shape.kind === 'path') for (const contour of target.shape.contours) for (const q of contour.curves) for (const i of [0, 2, 4, 6]) q[i] = q[i]! + 2;
      const [region] = (await compare(await render(moved, width, height), regions.filter(r => r.id === 'triangle'))).regions;
      if (REPORT_ONLY) t.diagnostic(`control moved triangle: ${region ? `${(100 * region.differing / (region.pixels || 1)).toFixed(2)}%` : 'no region'}`);
      else assert.ok(region && fault(region, 1), 'the band catches a shape moved by 2 px');
    }
    if (c.key === 'strokes-1') {
      // Negative controls: a border and a pen stroke each 1 px wider must fail their regions.
      for (const id of ['bordered', 'zig']) {
        const wider = structuredClone(c.drawing), target = wider.ops.find(op => op.id === id)!;
        if (target.op === 'shape' && target.stroke) target.stroke.width += 1;
        const [region] = (await compare(await render(wider, width, height), regions.filter(r => r.id === id))).regions;
        if (REPORT_ONLY) t.diagnostic(`control ${id} stroke 1 px wider: ${region ? `${(100 * region.differing / (region.pixels || 1)).toFixed(2)}%` : 'no region'}`);
        else assert.ok(region && fault(region, 1), `the band catches a stroke 1 px wider (${id})`);
      }
    }
    if (c.key === 'gradients-1') {
      // Negative controls: the linear gradient's line moved 2 px along itself, and the OKLab
      // ramp drawn from its two end colours, must each fail the interior check.
      const moved = structuredClone(c.drawing), line = (moved.ops.find(op => op.id === 'linear') as DrawShapeOp).fills.find(f => f.kind === 'linear');
      if (line?.kind === 'linear') { line.x1 += 2; line.x2 += 2; }
      const flat = structuredClone(c.drawing), ramp = (flat.ops.find(op => op.id === 'oklab') as DrawShapeOp).fills.find(f => f.kind === 'linear');
      if (ramp?.kind === 'linear') ramp.stops = [ramp.stops[0]!, ramp.stops.at(-1)!];
      for (const [id, page] of [['linear', moved], ['oklab', flat]] as const) {
        const [region] = await insideFault(await render(page, width, height), interiors.filter(r => r.id === `${id}:inside`));
        if (REPORT_ONLY) t.diagnostic(`control ${id} gradient: ${region ? `${region.differing} of ${region.pixels} px` : 'no difference'}`);
        else assert.ok(region, `the interior check catches a changed gradient (${id})`);
      }
    }
    if (c.key === 'board-1' || c.key === 'oval-1') {
      // Negative control: the same page without the frame's clip must fail where rows cross its edge.
      const open = structuredClone(c.drawing); delete open.clip;
      const crossing = regions.filter(r => !('ink' in r));
      const opened = (await compare(await render(open, width, height), crossing)).regions;
      const failed = opened.filter(r => fault(r, 1)).map(r => r.id);
      if (REPORT_ONLY) t.diagnostic(`control ${c.key} without its clip: ${opened.map(r => `${r.id} ${detail(r)}`).join(', ')}`);
      else assert.ok(failed.length, `the band catches a frame that does not clip its rows (${c.key})`);
    }
    if (c.key === 'dashes-1') {
      // Negative controls: the dashed zig drawn solid, and the mitred zig with each dash 2 px
      // longer over the same period, must each fail their regions.
      const solid = structuredClone(c.drawing), plain = solid.ops.find(op => op.id === 'zig')!;
      if (plain.op === 'shape' && plain.stroke) delete plain.stroke.dash;
      const longer = structuredClone(c.drawing), mitre = longer.ops.find(op => op.id === 'mitre')!;
      if (mitre.op === 'shape' && mitre.stroke?.dash) mitre.stroke.dash = [mitre.stroke.dash[0] + 2, mitre.stroke.dash[1] - 2];
      for (const [id, page] of [['zig', solid], ['mitre', longer]] as const) {
        const [region] = (await compare(await render(page, width, height), regions.filter(r => r.id === id))).regions;
        if (REPORT_ONLY) t.diagnostic(`control ${id} with changed dashes: ${region ? detail(region) : 'no region'}`);
        else assert.ok(region && fault(region, 1), `the band catches changed dashes (${id})`);
      }
    }
    if (c.key === 'clips-1' || c.key === 'clipped-board-1') {
      // Negative control: the same page with no row clipped by another must fail in every clipped row.
      const open = structuredClone(c.drawing);
      for (const op of open.ops) delete op.clip;
      const clipped = regions.filter(r => c.drawing.ops.some(op => op.id === r.id && op.clip));
      const opened = (await compare(await render(open, width, height), clipped)).regions;
      const failed = opened.filter(r => fault(r, 1)).map(r => r.id);
      if (REPORT_ONLY) t.diagnostic(`control ${c.key} without row clips: ${opened.map(r => `${r.id} ${detail(r)}`).join(', ')}`);
      else assert.deepEqual(failed, clipped.map(r => r.id), `the band catches each row drawn without its clip (${c.key})`);
    }
    if (c.key === 'text-1') {
      // Negative control: the narrowest word left out must fail its ink check.
      const target = regions.filter(r => 'ink' in r).sort((a, b) => a.w - b.w)[0]!;
      const [opId, at] = target.id.split(':') as [string, string];
      const [l, r] = at.split('.').map(Number) as [number, number];
      const missing = structuredClone(c.drawing); missing.ops.find(op => op.id === opId)!.words!.outlines![l]![r] = '';
      const [region] = (await compare(await render(missing, width, height), [target])).regions;
      if (REPORT_ONLY) t.diagnostic(`control missing word ${target.id}: ${region?.ink ? `ink ${(100 * Math.abs(region.ink.a - region.ink.b) / (region.ink.a || 1)).toFixed(1)}%` : 'no ink'}`);
      else assert.ok(region && fault(region, 1), `the ink check catches a missing word (${target.id})`);
      // Negative control: the same word moved by 3 px must fail the Design band.
      const shifted = structuredClone(c.drawing); shifted.ops.find(op => op.id === opId)!.words!.layout!.lines[l]!.runs[r]!.x += 3;
      const [away] = (await compare(await render(shifted, width, height), [target])).regions;
      if (REPORT_ONLY) t.diagnostic(`control word moved 3 px ${target.id}: ${away ? detail(away) : 'no region'}`);
      else assert.ok(away && fault(away, 1), `the Design band catches a word moved by 3 px (${target.id})`);
      // Negative control: the same word moved a quarter pixel must fail the outline check.
      const nudged = structuredClone(c.drawing); nudged.ops.find(op => op.id === opId)!.words!.layout!.lines[l]!.runs[r]!.x += 0.25;
      const nudge = await outlineFault(await render(nudged, width, height), truth.find(run => run.id === target.id)!);
      if (REPORT_ONLY) t.diagnostic(`control word moved 0.25 px ${target.id}: shift ${nudge.shift.toFixed(3)}`);
      else assert.ok(nudge.fault, `the outline check catches a word moved by 0.25 px (${target.id})`);
    }
  }
  if (process.env.LOLLY_DESIGN_GPU_FILL_REPORT) {
    await mkdir(dirname(process.env.LOLLY_DESIGN_GPU_FILL_REPORT), { recursive: true });
    await writeFile(process.env.LOLLY_DESIGN_GPU_FILL_REPORT, `${JSON.stringify(report, null, 2)}\n`);
  }
  if (!REPORT_ONLY) assert.deepEqual(failures, [], 'every shape region and word stays within the declared band');
});
