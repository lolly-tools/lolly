// SPDX-License-Identifier: MPL-2.0
/**
 * The GPU photo look recipes (plan 295 phase 1): their recipe ids, the table layout
 * the shader reads, and the refusals that happen before any GPU work. The numerical
 * comparison against the TypeScript reference needs a real adapter and lives in
 * tests/webgpu-photo-look.browser.test.ts.
 *
 * Run: node --test shells/web/src/lib/webgpu/photo-look.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { photoLookPixelPlan, type PhotoLookPixelPlan } from '../../../../../engine/src/photo-look.ts';
import {
  DUOTONE_GPU_RECIPE, GRADIENT_MAP_GPU_RECIPE, GREYSCALE_GPU_RECIPE, LUT_GPU_RECIPE, photoLookGpuRecipe,
} from '../../../../../packages/node-shell/src/pixel-kernel-recipe.ts';
import { applyPhotoLookWebGpu, packPhotoLookPlan, PHOTO_LOOK_GPU_CHUNK_PIXELS } from './photo-look.ts';
import {
  PHOTO_LOOK_SHADER, PHOTO_LOOK_TABLE_FLOATS, PHOTO_LOOK_TABLE_LINEAR, PHOTO_LOOK_TABLE_RAMP, PHOTO_LOOK_TABLE_TONE,
} from './photo-look-shader.ts';

const GRADIENT = photoLookPixelPlan({ id: 'tone', kind: 'gradient-map', stops: ['#1b2a33', '#7a9a8c', '#f4f1ea'], amount: 90, contrast: 12 });
const GREY = photoLookPixelPlan({ id: 'mono', kind: 'greyscale', amount: 40 });
const DUO = photoLookPixelPlan({ id: 'duo', kind: 'duotone', shadow: '#47190d', mid: '#808080', highlight: '#ffd3bd' });

test('every look kind has its own versioned recipe, distinct from the TypeScript bake', () => {
  assert.equal(photoLookGpuRecipe('lut'), LUT_GPU_RECIPE);
  assert.equal(photoLookGpuRecipe('gradient-map'), GRADIENT_MAP_GPU_RECIPE);
  assert.equal(photoLookGpuRecipe('greyscale'), GREYSCALE_GPU_RECIPE);
  assert.equal(photoLookGpuRecipe('duotone'), DUOTONE_GPU_RECIPE);
  const ids = [LUT_GPU_RECIPE, GRADIENT_MAP_GPU_RECIPE, GREYSCALE_GPU_RECIPE, DUOTONE_GPU_RECIPE];
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[a-z-]+-webgpu-v\d+$/);
  assert.equal(photoLookGpuRecipe('neon'), null);
  assert.equal(photoLookGpuRecipe('toString'), null, 'an inherited property is not a recipe');
  assert.equal(photoLookGpuRecipe(undefined), null);
});

test('a plan packs into the layout the shader reads', () => {
  assert.match(PHOTO_LOOK_SHADER, new RegExp(`const LINEAR = ${PHOTO_LOOK_TABLE_LINEAR}u;`));
  assert.match(PHOTO_LOOK_SHADER, new RegExp(`const TONE = ${PHOTO_LOOK_TABLE_TONE}u;`));
  assert.match(PHOTO_LOOK_SHADER, new RegExp(`const RAMP = ${PHOTO_LOOK_TABLE_RAMP}u;`));

  const gradient = packPhotoLookPlan(GRADIENT);
  assert.deepEqual([gradient.recipe, gradient.kind, gradient.steps, gradient.amount], [GRADIENT_MAP_GPU_RECIPE, 0, 0, 0.9]);
  assert.equal(gradient.tables.length, PHOTO_LOOK_TABLE_FLOATS);
  assert.deepEqual(gradient.tables.subarray(0, 256), Float32Array.from(GRADIENT.unit));
  assert.deepEqual(gradient.tables.subarray(PHOTO_LOOK_TABLE_LINEAR, PHOTO_LOOK_TABLE_LINEAR + 256), Float32Array.from(GRADIENT.linear));
  assert.deepEqual(gradient.tables.subarray(PHOTO_LOOK_TABLE_TONE, PHOTO_LOOK_TABLE_TONE + 768), GRADIENT.tone);

  const grey = packPhotoLookPlan(GREY);
  assert.deepEqual([grey.recipe, grey.kind, grey.steps], [GREYSCALE_GPU_RECIPE, 1, 0]);
  assert.equal(Math.fround(grey.amount), Math.fround(0.4));

  const duo = packPhotoLookPlan(DUO);
  assert.deepEqual([duo.recipe, duo.kind, duo.steps], [DUOTONE_GPU_RECIPE, 2, 2]);
  assert.deepEqual(Array.from(duo.tables.subarray(PHOTO_LOOK_TABLE_RAMP, PHOTO_LOOK_TABLE_RAMP + 9)),
    Array.from(Float32Array.from([0x47, 0x19, 0x0d, 0x80, 0x80, 0x80, 0xff, 0xd3, 0xbd].map(v => v / 255))));
  const twoColour = packPhotoLookPlan(photoLookPixelPlan({ id: 'duo2', kind: 'duotone', shadow: '#000000', highlight: '#ffffff' }));
  assert.equal(twoColour.steps, 1);
});

test('a malformed plan is refused before any GPU work', () => {
  const broken = (patch: Partial<PhotoLookPixelPlan> | Record<string, unknown>): PhotoLookPixelPlan => ({ ...GRADIENT, ...patch } as PhotoLookPixelPlan);
  assert.throws(() => packPhotoLookPlan(broken({ kind: 'lut' })), /no GPU recipe/);
  assert.throws(() => packPhotoLookPlan(broken({ kind: 'toString' })), /no GPU recipe/);
  assert.throws(() => packPhotoLookPlan(broken({ amount: Number.NaN })), /amount/);
  assert.throws(() => packPhotoLookPlan(broken({ amount: 1.5 })), /amount/);
  assert.throws(() => packPhotoLookPlan(broken({ unit: new Float64Array(255) })), /grade table must hold 256/);
  const nan = GRADIENT.linear.slice(); nan[7] = Number.NaN;
  assert.throws(() => packPhotoLookPlan(broken({ linear: nan })), /outside 0 to 1/);
  const bright = GRADIENT.tone!.slice(); bright[3] = 2;
  assert.throws(() => packPhotoLookPlan(broken({ tone: bright })), /outside 0 to 1/);
  assert.throws(() => packPhotoLookPlan(broken({ tone: null })), /tone table/);
  assert.throws(() => packPhotoLookPlan({ ...DUO, ramp: [[0, 0, 0]] }), /two or three colours/);
  assert.throws(() => packPhotoLookPlan({ ...DUO, ramp: [[0, 0, 0], [1, 1, 1], [1, 1, 1], [1, 1, 1]] }), /two or three colours/);
  assert.throws(() => packPhotoLookPlan({ ...DUO, ramp: [[0, 0], [1, 1, 1]] as never }), /duotone table/);
});

test('frames and chunk sizes are bounded before a device is requested, and an absent device fails visibly', async () => {
  await assert.rejects(applyPhotoLookWebGpu(new Uint8ClampedArray(6), GREY), /bounded RGBA8 frame/);
  await assert.rejects(applyPhotoLookWebGpu(new Uint8Array(8) as unknown as Uint8ClampedArray, GREY), /bounded RGBA8 frame/);
  await assert.rejects(applyPhotoLookWebGpu(new Uint8ClampedArray(8), GREY, { chunkPixels: 0 }), /chunk size/);
  await assert.rejects(applyPhotoLookWebGpu(new Uint8ClampedArray(8), GREY, { chunkPixels: PHOTO_LOOK_GPU_CHUNK_PIXELS + 1 }), /chunk size/);
  await assert.rejects(applyPhotoLookWebGpu(new Uint8ClampedArray(8), { ...GREY, kind: 'lut' } as never), /no GPU recipe/);
  const pixels = new Uint8ClampedArray([10, 20, 30, 40]);
  await assert.rejects(applyPhotoLookWebGpu(pixels, GRADIENT), { code: 'WEBGPU_REQUIRED' });
  assert.deepEqual(Array.from(pixels), [10, 20, 30, 40], 'the source is untouched');
  const cancelled = new AbortController(); cancelled.abort(new DOMException('Cancelled', 'AbortError'));
  await assert.rejects(applyPhotoLookWebGpu(pixels, GRADIENT, { signal: cancelled.signal }), { name: 'AbortError' });
});
