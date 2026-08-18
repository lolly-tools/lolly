// SPDX-License-Identifier: MPL-2.0
/**
 * engine/src/chroma-key.ts - the perceptual (OKLab) colour-range key behind the
 * video-matte "Colour key" method (plans/124 WP-G).
 *
 * Run: node --import ./tests/css-stub.mjs --test engine/src/chroma-key.test.ts
 *
 * Pure math, no DOM - the css-stub import is harmless and keeps the run command
 * uniform with the shell suites.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromaKeyAlpha } from './chroma-key.ts';
import { srgbToLinear, linearSrgbToOklab } from './brand-derive.ts';

/** OKLab ΔEOK between two sRGB-byte colours - the metric the key runs on. */
function oklabDist(a: [number, number, number], b: [number, number, number]): number {
  const la = linearSrgbToOklab(srgbToLinear(a[0] / 255), srgbToLinear(a[1] / 255), srgbToLinear(a[2] / 255));
  const lb = linearSrgbToOklab(srgbToLinear(b[0] / 255), srgbToLinear(b[1] / 255), srgbToLinear(b[2] / 255));
  return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
}
const rgbDist = (a: [number, number, number], b: [number, number, number]): number =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** One RGBA pixel, fully opaque. */
const px = (r: number, g: number, b: number): Uint8ClampedArray => new Uint8ClampedArray([r, g, b, 255]);

const KEY: [number, number, number] = [0, 177, 64]; // #00b140 chroma green

test('a key-coloured pixel is cut to alpha 0; a far colour stays fully opaque', () => {
  // The exact key green and a white pixel, side by side (2×1).
  const data = new Uint8ClampedArray([...KEY, 255, 255, 255, 255, 255]);
  const out = chromaKeyAlpha(data, 2, 1, { keyColor: KEY, tolerance: 0.1, softness: 0.1 });
  assert.equal(out[3], 0, 'the key pixel keys out');
  assert.equal(out[7], 255, 'white is far in OKLab and stays opaque');
  // A colour key invents nothing: kept RGB is verbatim.
  assert.deepEqual([out[4], out[5], out[6]], [255, 255, 255]);
});

test('the tolerance→softness band gives a feathered edge (partial alpha)', () => {
  const near: [number, number, number] = [20, 180, 80];
  const d = oklabDist(near, KEY);
  // Bracket the pixel's distance so it lands strictly inside the ramp.
  const tolerance = Math.max(0, d - 0.03);
  const out = chromaKeyAlpha(px(...near), 1, 1, { keyColor: KEY, tolerance, softness: 0.06 });
  assert.ok(out[3]! > 0 && out[3]! < 255, `edge pixel is partially transparent (got ${out[3]})`);
});

test('deterministic: same pixels + key + tolerance + softness ⇒ byte-identical output', () => {
  const opts = { keyColor: KEY, tolerance: 0.14, softness: 0.1, spill: 0.5 };
  const a = chromaKeyAlpha(px(30, 160, 90), 1, 1, opts);
  const b = chromaKeyAlpha(px(30, 160, 90), 1, 1, opts);
  assert.deepEqual([...a], [...b]);
});

test('returns a fresh buffer and never mutates the caller frame', () => {
  const src = px(...KEY);
  const out = chromaKeyAlpha(src, 1, 1, { keyColor: KEY, tolerance: 0.1, softness: 0.1 });
  assert.notEqual(out, src, 'a new buffer is returned');
  assert.equal(src[3], 255, 'the source alpha is untouched');
});

test('OKLab distance is PERCEPTUAL, not raw RGB: of two equal-RGB-distance colours, the perceptually nearer one keys', () => {
  // Two colours the SAME sRGB Euclidean distance from the key: one shifts the
  // high-luminance green channel, the other the low-luminance blue channel. Equal in
  // RGB, but OKLab (perceptual) rates them differently - which is the whole point.
  const greenShift: [number, number, number] = [0, 165, 64]; // -12 on green
  const blueShift: [number, number, number] = [0, 177, 76];  // +12 on blue
  assert.ok(Math.abs(rgbDist(greenShift, KEY) - rgbDist(blueShift, KEY)) < 1e-9, 'equal RGB distance');

  const dG = oklabDist(greenShift, KEY);
  const dB = oklabDist(blueShift, KEY);
  assert.notEqual(dG, dB, 'perceptual distances differ despite equal RGB distance');

  const [nearRgb, farRgb] = dG < dB ? [greenShift, blueShift] : [blueShift, greenShift];
  // A tolerance between the two, with a hard edge, keys only the perceptually nearer one.
  const tolerance = (Math.min(dG, dB) + Math.max(dG, dB)) / 2;
  const near = chromaKeyAlpha(px(...nearRgb), 1, 1, { keyColor: KEY, tolerance, softness: 1e-4 });
  const far = chromaKeyAlpha(px(...farRgb), 1, 1, { keyColor: KEY, tolerance, softness: 1e-4 });
  assert.equal(near[3], 0, 'the perceptually nearer colour keys out');
  assert.equal(far[3], 255, 'the perceptually farther colour is kept, though its RGB distance is identical');
});

test('spill suppression desaturates a soft-edge pixel toward its luma; spill 0 leaves RGB verbatim', () => {
  const edge: [number, number, number] = [20, 180, 80];
  const d = oklabDist(edge, KEY);
  const shared = { keyColor: KEY, tolerance: Math.max(0, d - 0.03), softness: 0.06 };

  const noSpill = chromaKeyAlpha(px(...edge), 1, 1, { ...shared, spill: 0 });
  assert.deepEqual([noSpill[0], noSpill[1], noSpill[2]], edge, 'spill 0 invents nothing');

  const withSpill = chromaKeyAlpha(px(...edge), 1, 1, { ...shared, spill: 1 });
  const y = 0.299 * edge[0] + 0.587 * edge[1] + 0.114 * edge[2]; // ≈ 120.8
  assert.ok(withSpill[1]! < edge[1]!, 'the green cast is pulled down toward luma');
  assert.ok(withSpill[0]! > edge[0]!, 'and the dark red channel rises toward luma');
  assert.ok(withSpill[1]! >= y, 'but not past luma (a partial-strength move)');
});
