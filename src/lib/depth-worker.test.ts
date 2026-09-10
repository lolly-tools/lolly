// SPDX-License-Identifier: MPL-2.0
/**
 * Depth runner (lib/depth-worker.ts) - the pure pipeline, driven end to end on a
 * synthetic fixture, plus the privacy pin.
 *
 * The whole run EXCEPT `session.run()` is pure typed-array maths (no canvas, no
 * ORT), which is what lets a fixture image go in and a normalised map come out
 * through the REAL module here rather than a re-implementation. `runDepth` itself
 * is verified with the real graph in the Node ML suite and in browser QA;
 * this suite isolates geometry, normalization and failure handling.
 *
 * Run: node --test shells/web/src/lib/depth-worker.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ModelNotInstalledError, normaliseDepth, packNchwNormalized, postprocessDepth,
  preprocessDepth, resampleFloat, resampleRgba,
} from './depth-worker.ts';
import { DEPTH_MODEL_SPEC, type DepthFrame } from './depth-models.ts';

const SPEC = DEPTH_MODEL_SPEC['depth-anything-v2-small'];
const EDGE = SPEC.inputSize[0];

/** A fixture photo: a left→right luminance ramp, so every stage has a signal that
 *  a broken resample would visibly destroy. */
function rampImage(w: number, h: number): DepthFrame {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = Math.round((x / Math.max(1, w - 1)) * 255);
      const o = (y * w + x) * 4;
      data[o] = data[o + 1] = data[o + 2] = v;
      data[o + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}

// ── the fixture goes all the way through ──────────────────────────────────────

test('a fixture image preprocesses without square distortion with ImageNet normalisation', () => {
  const pre = preprocessDepth(rampImage(64, 32), SPEC);
  assert.equal(pre.edge, EDGE);
  assert.equal(pre.workW, 64, 'a small photo is not upscaled to the work cap');
  assert.equal(pre.workH, 32);
  assert.equal(pre.input.length, 3 * pre.inputW * pre.inputH, 'rectangular NCHW input');
  assert.ok(pre.input.every(Number.isFinite), 'no NaN reaches the tensor');

  // The footgun this pins: normalisation must be (px/255 − mean)/std per channel,
  // NOT a bare /255. White (255) on the R plane is (1 − 0.485)/0.229.
  const white = (1 - SPEC.mean[0]) / SPEC.std[0];
  assert.ok(Math.abs(pre.input[pre.inputW - 1]! - white) < 1e-4, `right edge of row 0 is white → ${white}`);
  const black = (0 - SPEC.mean[0]) / SPEC.std[0];
  assert.ok(Math.abs(pre.input[0]! - black) < 1e-4, 'left edge of row 0 is black');
});

test('a fixture image produces a plausible normalised depth map', () => {
  const pre = preprocessDepth(rampImage(64, 32), SPEC);
  // Stand in for the model: a raw INVERSE-depth field on an arbitrary, offset
  // scale (Depth Anything's head has no absolute reference), rising down the frame.
  const raw = new Float32Array(pre.inputW * pre.inputH);
  for (let y = 0; y < pre.inputH; y++) for (let x = 0; x < pre.inputW; x++) raw[y * pre.inputW + x] = -50 + y * 0.3;

  const map = postprocessDepth(raw, pre);
  assert.equal(map.width, 64);
  assert.equal(map.height, 32);
  assert.equal(map.data.length, 64 * 32);
  for (const v of map.data) assert.ok(v >= 0 && v <= 1, `every sample is inside 0..1 (saw ${v})`);
  assert.ok(Math.min(...map.data) < 0.02, 'the far end reaches 0');
  assert.ok(Math.max(...map.data) > 0.98, 'the near end reaches 1');
  // 1 is NEAREST, and the synthetic field rises downwards - so must the map.
  assert.ok(map.data[0]! < map.data[31 * 64]!, 'the map keeps the field\'s direction');
});

test('a flat field yields zeros, not NaN - and one bad sample cannot poison the map', () => {
  const pre = preprocessDepth(rampImage(8, 8), SPEC);
  const flat = new Float32Array(EDGE * EDGE).fill(7);
  assert.ok(postprocessDepth(flat, pre).data.every((v) => v === 0), 'no divide-by-zero NaN');

  const withNan = new Float32Array(EDGE * EDGE);
  for (let i = 0; i < withNan.length; i++) withNan[i] = i;
  withNan[10] = Number.NaN;
  withNan[11] = Number.POSITIVE_INFINITY;
  const out = normaliseDepth(withNan, withNan.length);
  assert.ok(out.every(Number.isFinite), 'non-finite samples are skipped, not propagated');
  assert.ok(out.every((v) => v <= 1), 'and Infinity never becomes the max that flattens everything else');
});

// ── the working-size cap actually caps ────────────────────────────────────────

test('the working image is capped before inference (iOS memory)', () => {
  const pre = preprocessDepth(rampImage(800, 600), SPEC, { maxEdge: 200 });
  assert.equal(pre.workW, 200);
  assert.equal(pre.workH, 150);
  const map = postprocessDepth(new Float32Array(pre.inputW * pre.inputH).map((_, i) => i), pre);
  assert.equal(map.width, 200, 'and the map comes back at the WORK size, not the source size');
  assert.equal(map.height, 150);
});

// ── the resamplers ────────────────────────────────────────────────────────────

test('resampleRgba box-averages on the way down (a real filter, not a decimation)', () => {
  // 2×1 black|white → 1×1 must be mid-grey. Nearest-neighbour would give 0 or 255,
  // which is the aliasing a 4000px photo would show all over the depth input.
  const src = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]);
  const out = resampleRgba(src, 2, 1, 1, 1);
  assert.equal(out[0], 128, 'averaged, within Uint8ClampedArray rounding');
  assert.equal(out[3], 255, 'alpha survives');
});

test('resampleFloat interpolates on the way up (no visible blocks in the displacement)', () => {
  const out = resampleFloat(new Float32Array([0, 1]), 2, 1, 3, 1);
  assert.deepEqual(Array.from(out), [0, 0.5, 1], 'the midpoint is interpolated, not repeated');
});

test('packNchwNormalized lays out planes, not pixels', () => {
  const rgba = [255, 0, 0, 255]; // one pure-red pixel
  const t = packNchwNormalized(rgba, 1, 1, SPEC);
  assert.equal(t.length, 3, 'alpha is dropped');
  // Planar: index 0 is R, 1 is G, 2 is B - each through its OWN mean/std, so the
  // two zero channels do NOT come out equal. An interleaved pack would put the
  // pixel's G and B where the G and B PLANES belong and nothing would crash.
  assert.ok(Math.abs(t[0]! - (1 - SPEC.mean[0]) / SPEC.std[0]) < 1e-5, 'R plane');
  assert.ok(Math.abs(t[1]! - (0 - SPEC.mean[1]) / SPEC.std[1]) < 1e-5, 'G plane');
  assert.ok(Math.abs(t[2]! - (0 - SPEC.mean[2]) / SPEC.std[2]) < 1e-5, 'B plane');
  assert.notEqual(t[1], t[2], 'each channel through its own std');
});

// ── failure is clean, not a hang ──────────────────────────────────────────────

test('a missing model is a typed, classifiable error (the state of the world today)', () => {
  const e = new ModelNotInstalledError('depth-anything-v2-small');
  assert.equal(e.name, 'ModelNotInstalledError');
  assert.match(e.message, /isn.t downloaded/);
});

// ── PRIVACY: weights load from MODELS_BASE and nowhere else ───────────────────
//
// The ai-detect-privacy.test.ts idiom: a source scan, because the fetch itself
// cannot be driven headlessly. What it guards is that nobody ever adds a second
// download path beside the shared fetcher.

const LIB_DIR = new URL('.', import.meta.url).pathname;

test('the worker fetches weights ONLY through the shared MODELS_BASE fetcher', () => {
  const src = readFileSync(join(LIB_DIR, 'depth-worker.ts'), 'utf8');
  assert.match(src, /createModelFetcher\(\{/, 'the shared fetcher is what loads the bytes');
  assert.match(src, /dir:\s*DEPTH_MODEL_DIR/, 'and it is pointed at /models/depth/');
  assert.ok(!/\bfetch\s*\(/.test(src), 'no second fetch() anywhere in the worker');
  assert.ok(!src.includes('huggingface.co'), 'no model host is named in the source');
  const codeOnly = src.replace(/^\s*\*.*$/gm, '').replace(/\/\/.*$/gm, '');
  assert.ok(!/https?:\/\//.test(codeOnly), 'no absolute http(s) URL outside comments');
});

test('the shared fetcher builds its URL from MODELS_BASE', () => {
  const ort = readFileSync(join(LIB_DIR, 'ort.ts'), 'utf8');
  assert.match(ort, /import\s*\{\s*MODELS_BASE\s*\}\s*from\s*'\.\/models-base\.ts'/);
  assert.match(ort, /const url = `\$\{MODELS_BASE\}\/models\/\$\{dir\}\/\$\{fileName\}`/,
    'every model byte comes from ${MODELS_BASE}/models/<dir>/<file>');
});


test('portrait, landscape and panorama inputs preserve aspect within patch rounding and stay bounded', () => {
  for (const [w, h] of [[1600, 1067], [1067, 1600], [2048, 100], [100, 2048]]) {
    const pre = preprocessDepth(rampImage(w!, h!), SPEC);
    assert.equal(pre.inputW % 14, 0);
    assert.equal(pre.inputH % 14, 0);
    assert.ok(Math.max(pre.inputW, pre.inputH) <= 2 * EDGE);
    assert.ok(Math.abs(pre.inputW / pre.inputH - w! / h!) / (w! / h!) < 0.12);
  }
});


test('a wrong output shape fails instead of producing a plausible empty map', () => {
  const pre = preprocessDepth(rampImage(64, 32), SPEC);
  assert.throws(() => postprocessDepth(new Float32Array(4), pre), /dimensions/);
});
