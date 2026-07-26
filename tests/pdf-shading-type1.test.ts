// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the ShadingType 1 (function-based) classifier
 * (shells/web/src/lib/pdf-shading.ts), fed synthetic 2-in evaluators directly — no
 * PDF, no pdf-lib, no DOM.
 *
 * This is the test that protects against the classifier's two silent failure modes:
 * flattening a real gradient (too-loose thresholds) and tiling a colour field that
 * was actually linear (too-tight ones). Both produce a page that renders, so
 * neither shows up as an error anywhere else.
 *
 * Run with: node --test tests/pdf-shading-type1.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyFunctionShading, collapseStops, componentsToHex, componentsToRgb,
  rampSamples, renderTilePixels, sampleStops,
} from '../shells/web/src/lib/pdf-shading.ts';

const UNIT: [number, number, number, number] = [0, 1, 0, 1];
const hexOf = (r: number, g: number, b: number): string =>
  '#' + [r, g, b].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');

// ── colour conversion ────────────────────────────────────────────────────────
test('components map to RGB by component count', () => {
  assert.equal(componentsToHex([1, 0, 0], 3), '#ff0000');
  assert.equal(componentsToHex([0.5], 1), '#808080');
  assert.equal(componentsToHex([0, 1, 1, 0], 4), '#ff0000', 'naive CMYK');
  assert.equal(componentsToHex([2, -1, 0.5], 3), '#ff0080', 'out-of-range clamps');
  assert.equal(componentsToHex([NaN, 0, 0], 3), '', 'a faulted component yields no colour');
  assert.equal(componentsToRgb([], 3), null);
});

// ── rung 1: a constant field ─────────────────────────────────────────────────
test('a constant function classifies flat with the exact colour', () => {
  const c = classifyFunctionShading(() => [0.2, 0.4, 0.6], 3, UNIT);
  assert.equal(c.rung, 'flat');
  assert.equal(c.flat, hexOf(0.2, 0.4, 0.6));
  assert.equal(c.coords, undefined);
  assert.equal(c.stops, undefined);
});

test('a field that varies below 8-bit resolution still reads as flat', () => {
  // ±0.2/255 of a channel — smaller than anything the emitter could express.
  const c = classifyFunctionShading((u) => [0.5 + (u! * 0.2) / 255, 0.5, 0.5], 3, UNIT);
  assert.equal(c.rung, 'flat');
});

test('a real gradient is NOT flattened', () => {
  // A 20-level ramp across the domain: well above the flat threshold.
  const c = classifyFunctionShading((u) => [u!, 0, 0], 3, UNIT);
  assert.notEqual(c.rung, 'flat');
});

// ── rung 2: near-linear fields become an axial shading ───────────────────────
test('f(u,v)=u recovers a horizontal axis with monotone stops', () => {
  const c = classifyFunctionShading((u) => [u!, u!, u!], 3, UNIT);
  assert.equal(c.rung, 'axial');
  const [x0, y0, x1, y1] = c.coords!;
  assert.ok(Math.abs(y1 - y0) < 1e-6, `axis should be horizontal, got ${JSON.stringify(c.coords)}`);
  assert.ok(x1 > x0, 'axis points along +u');
  assert.ok(Math.abs(x0 - 0) < 1e-6 && Math.abs(x1 - 1) < 1e-6, JSON.stringify(c.coords));
  const stops = c.stops!;
  assert.ok(stops.length >= 2);
  assert.equal(stops[0]!.color, '#000000');
  assert.equal(stops[stops.length - 1]!.color, '#ffffff');
  assert.equal(stops[0]!.offset, 0);
  assert.equal(stops[stops.length - 1]!.offset, 1);
  // Monotone in luminance.
  const lum = stops.map((s) => parseInt(s.color.slice(1, 3), 16));
  for (let i = 1; i < lum.length; i++) assert.ok(lum[i]! >= lum[i - 1]!, JSON.stringify(stops));
});

test('f(u,v)=v recovers a vertical axis', () => {
  const c = classifyFunctionShading((_u, v) => [v!, v!, v!], 3, UNIT);
  assert.equal(c.rung, 'axial');
  const [x0, y0, x1, y1] = c.coords!;
  assert.ok(Math.abs(x1 - x0) < 1e-6, `axis should be vertical, got ${JSON.stringify(c.coords)}`);
  assert.ok(y1 > y0);
});

test('a rotated ramp 0.6u+0.8v recovers the correct direction', () => {
  // Normalised by 1.4 so the field stays inside [0,1]: a channel that saturates is
  // genuinely non-linear, and the classifier is right to refuse it (asserted below).
  const c = classifyFunctionShading((u, v) => { const t = (0.6 * u! + 0.8 * v!) / 1.4; return [t, t, t]; }, 3, UNIT);
  assert.equal(c.rung, 'axial');
  const [x0, y0, x1, y1] = c.coords!;
  const dx = x1 - x0, dy = y1 - y0, m = Math.hypot(dx, dy);
  assert.ok(Math.abs(dx / m - 0.6) < 0.02 && Math.abs(dy / m - 0.8) < 0.02,
    `direction ${(dx / m).toFixed(3)},${(dy / m).toFixed(3)} should be 0.6,0.8`);
});

test('a field that saturates its channels is refused as non-linear', () => {
  // 0.6u+0.8v reaches 1.4 and clips to white over a whole corner region — a
  // plateau, not a ramp. Accepting it would paint that corner as a gradient.
  const c = classifyFunctionShading((u, v) => { const t = 0.6 * u! + 0.8 * v!; return [t, t, t]; }, 3, UNIT);
  assert.equal(c.rung, 'tiled');
});

test('channels moving in OPPOSITE directions still yield one coherent axis', () => {
  // R rises with u, B falls with u. Summing raw gradients would cancel; the
  // classifier sign-aligns to the strongest channel instead.
  const c = classifyFunctionShading((u) => [u!, 0.5, 1 - u!], 3, UNIT);
  assert.equal(c.rung, 'axial');
  const [x0, y0, x1, y1] = c.coords!;
  assert.ok(Math.abs(y1 - y0) < 1e-6 && Math.abs(x1 - x0) > 0.5, JSON.stringify(c.coords));
  assert.equal(c.stops![0]!.color, '#0080ff');
  assert.equal(c.stops![c.stops!.length - 1]!.color, '#ff8000');
});

test('the axial rung honours a non-unit domain', () => {
  const dom: [number, number, number, number] = [10, 30, -5, 5];
  const c = classifyFunctionShading((u) => { const t = (u! - 10) / 20; return [t, t, t]; }, 3, dom);
  assert.equal(c.rung, 'axial');
  const [x0, , x1] = c.coords!;
  assert.ok(Math.abs(x0 - 10) < 1e-6 && Math.abs(x1 - 30) < 1e-6, JSON.stringify(c.coords));
});

// ── rung 3: irreducibly 2-D ──────────────────────────────────────────────────
test('an atan2-driven hue sweep is irreducibly 2-D → tiled', () => {
  // The OKLCH wheel shape: hue from the angle, chroma from the radius.
  const wheel = (u: number, v: number): number[] => {
    const x = u - 0.5, y = v - 0.5;
    const h = (Math.atan2(y, x) / Math.PI + 1) / 2;       // 0..1
    const r = Math.min(1, Math.hypot(x, y) * 2);
    const k = (n: number): number => {
      const p = Math.abs(((h * 6 + n) % 6) - 3) - 1;
      return 1 - r + r * Math.max(0, Math.min(1, p));
    };
    return [k(5), k(3), k(1)];
  };
  const c = classifyFunctionShading((u, v) => wheel(u!, v!), 3, UNIT);
  assert.equal(c.rung, 'tiled');
  assert.match(c.flat, /^#[0-9a-f]{6}$/, 'a mean colour is ALWAYS available as the back-stop');
});

test('a saddle (u*v) is 2-D and does not pass the axial fit', () => {
  const c = classifyFunctionShading((u, v) => { const t = u! * v!; return [t, t, t]; }, 3, UNIT);
  assert.equal(c.rung, 'tiled');
});

// ── faults ───────────────────────────────────────────────────────────────────
test('an unevaluable function fails rather than guessing', () => {
  assert.equal(classifyFunctionShading(() => null, 3, UNIT).rung, 'failed');
  assert.equal(classifyFunctionShading(() => { throw new Error('boom'); }, 3, UNIT).rung, 'failed');
  assert.equal(classifyFunctionShading(() => [0.5, 0.5, 0.5], 3, [0, NaN, 0, 1]).rung, 'failed');
});

test('a mostly-evaluable function still classifies (sparse faults are tolerated)', () => {
  let n = 0;
  const c = classifyFunctionShading(() => (++n % 50 === 0 ? null : [0.3, 0.3, 0.3]), 3, UNIT);
  assert.equal(c.rung, 'flat');
});

// ── stop sampling helpers ────────────────────────────────────────────────────
test('sampleStops collapses flat runs but keeps both endpoints', () => {
  const stops = sampleStops((t) => [t as number, 0, 0], [0, 1], 3);
  assert.ok(stops.length >= 2);
  assert.equal(stops[0]!.offset, 0);
  assert.equal(stops[stops.length - 1]!.offset, 1);
  const flat = sampleStops(() => [0.5, 0.5, 0.5], [0, 1], 3);
  assert.deepEqual(flat.map((s) => s.offset), [0, 1], 'a constant ramp collapses to its endpoints');
});

test('a faulting ramp yields no stops (so the caller drops the shading)', () => {
  assert.deepEqual(sampleStops(() => null, [0, 1], 3), []);
  assert.equal(rampSamples(() => null, 3, 0, 1), null);
});

test('collapseStops keeps interior transitions', () => {
  const ramp: Array<[number, number, number]> = [[0, 0, 0], [0, 0, 0], [255, 0, 0], [255, 0, 0]];
  const stops = collapseStops(ramp);
  assert.deepEqual(stops.map((s) => s.color), ['#000000', '#000000', '#ff0000', '#ff0000']);
});

// ── tile rasterisation is pure and correctly oriented ────────────────────────
test('renderTilePixels walks row 0 at the domain MINIMUM v (no flip)', () => {
  // Encode v into the red channel so row order is directly observable. The SVG
  // patternTransform carries the y-flip; flipping here too would cancel it.
  const px = renderTilePixels({ evaluate: (_u, v) => [v!, 0, 0], comps: 3, domain: [0, 1, 0, 1] }, 4);
  const rowRed = (j: number): number => px[(j * 4 + 0) * 4]!;
  assert.ok(rowRed(0) < rowRed(3), `row0=${rowRed(0)} row3=${rowRed(3)}`);
  assert.equal(px.length, 4 * 4 * 4);
  assert.equal(px[3], 255, 'opaque where the function evaluated');
});

test('a pixel whose function faults stays transparent so the flat back-stop shows', () => {
  const px = renderTilePixels({ evaluate: () => null, comps: 3, domain: [0, 1, 0, 1] }, 2);
  for (let i = 3; i < px.length; i += 4) assert.equal(px[i], 0);
});
