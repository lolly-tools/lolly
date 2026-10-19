// SPDX-License-Identifier: MPL-2.0
/**
 * photoLookPixelPlan (engine/src/photo-look.ts): the tables a pixel executor other
 * than applyPhotoLook reads (the WebGPU recipes, plan 295 phase 1). Each table must be
 * the one the reference bake uses, or a GPU recipe that follows the plan faithfully
 * would still drift from the reference.
 *
 * Run with: node --test tests/photo-look-plan.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { applyPhotoLook, photoLookPixelPlan, photoLookStops, photoLookToneTable, resolvePhotoLook, type PhotoLookPixelPlan } from '../engine/src/photo-look.ts';
import type { PhotoTreatment } from '../engine/src/photo-treatment.ts';

const GRADIENT: PhotoTreatment = {
  id: 'grade', kind: 'gradient-map', stops: ['#1b2a33', '#7a9a8c', '#f4f1ea'], amount: 90, contrast: 12, lightness: 6,
  themes: { dark: { stops: ['#050608', '#1b2a33', '#b8d4c8'], amount: 95, contrast: 20, lightness: -15 } },
};

/** Every 8-bit grey once, then a deterministic colour spread, with varied alpha. */
function pixels(): Uint8ClampedArray {
  const data = new Uint8ClampedArray(1024 * 4);
  let state = 295;
  for (let i = 0; i < data.length; i++) { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; data[i] = state >>> 24; }
  for (let v = 0; v < 256; v++) data.set([v, v, v, 255 - v], v * 4);
  return data;
}

/** The reference's luma formula over a plan's tables, in float64. */
function lumaFromPlan(source: Uint8ClampedArray, plan: PhotoLookPixelPlan): Uint8ClampedArray {
  const out = source.slice();
  const n = plan.ramp ? plan.ramp.length - 1 : 0;
  for (let i = 0; i < out.length; i += 4) {
    const r01 = plan.unit[out[i]!]!, g01 = plan.unit[out[i + 1]!]!, b01 = plan.unit[out[i + 2]!]!;
    let t: [number, number, number];
    if (!plan.ramp) {
      const y = Math.min(1, Math.max(0, 0.213 * r01 + 0.715 * g01 + 0.072 * b01));
      t = [y, y, y];
    } else {
      const y = Math.min(1, Math.max(0, 0.2126 * r01 + 0.7152 * g01 + 0.0722 * b01));
      const pos = y * n, k = pos >= n ? n - 1 : pos | 0, u = pos - k;
      const lo = plan.ramp[k]!, hi = plan.ramp[k + 1]!;
      t = [lo[0] + (hi[0] - lo[0]) * u, lo[1] + (hi[1] - lo[1]) * u, lo[2] + (hi[2] - lo[2]) * u];
    }
    const blend = (base: number, look: number) => (plan.amount === 1 ? look : base + (look - base) * plan.amount) * 255;
    out[i] = blend(r01, t[0]); out[i + 1] = blend(g01, t[1]); out[i + 2] = blend(b01, t[2]);
  }
  return out;
}

const decode = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

test('the greyscale and duotone plans reproduce the reference bake exactly', () => {
  const looks: PhotoTreatment[] = [
    { id: 'mono', kind: 'greyscale' },
    { id: 'mono-graded', kind: 'greyscale', amount: 55, contrast: 30, lightness: 12 },
    { id: 'duo', kind: 'duotone', shadow: '#47190d', highlight: '#ffd3bd' },
    { id: 'trio', kind: 'duotone', shadow: '#000033', mid: '#ff6600', highlight: '#ffffcc', amount: 62.5, contrast: -20, lightness: -8 },
    { id: 'defaults', kind: 'duotone' },
  ];
  for (const look of looks) {
    const expected = pixels();
    applyPhotoLook(expected, expected.length / 4, 1, look);
    assert.deepEqual(lumaFromPlan(pixels(), photoLookPixelPlan(look)), expected, look.id);
  }
});

test('a gradient-map plan carries the reference tone table, grade and decode', () => {
  for (const theme of [undefined, 'dark']) {
    const plan = photoLookPixelPlan(GRADIENT, theme ? { theme } : {});
    const def = resolvePhotoLook(GRADIENT, theme);
    assert.equal(plan.kind, 'gradient-map');
    assert.equal(plan.amount, (def.amount as number) / 100);
    assert.deepEqual(plan.tone, photoLookToneTable(photoLookStops(def)));
    assert.equal(plan.ramp, null);
    // The grade table at amount 0 is exactly what the reference writes for an untouched look.
    const ramp = new Uint8ClampedArray(256 * 4);
    for (let v = 0; v < 256; v++) ramp.set([v, v, v, 255], v * 4);
    const graded = ramp.slice();
    applyPhotoLook(graded, 256, 1, { ...def, kind: 'greyscale', amount: 0, themes: undefined });
    for (let v = 0; v < 256; v++) {
      const byte = new Uint8ClampedArray([plan.unit[v]! * 255])[0];
      assert.equal(byte, graded[v * 4], `grade of ${v}`);
      assert.ok(Math.abs(plan.linear[v]! - decode(plan.unit[v]!)) < 1e-12, `decode of ${v}`);
    }
  }
});

test('an ungraded plan is the plain 8-bit scale and its decode', () => {
  const plan = photoLookPixelPlan({ id: 'mono', kind: 'greyscale', amount: 250 });
  assert.equal(plan.amount, 1, 'amount clamps as the bake does');
  for (let v = 0; v < 256; v++) {
    assert.equal(plan.unit[v], v / 255);
    assert.ok(Math.abs(plan.linear[v]! - decode(v / 255)) < 1e-12);
  }
  assert.equal(plan.linear[0], 0); assert.equal(plan.linear[255], 1);
  assert.equal(photoLookPixelPlan({ id: 'none', kind: 'greyscale', amount: -5 }).amount, 0);
  assert.equal(photoLookPixelPlan({ id: 'nan', kind: 'greyscale', amount: Number.NaN }).amount, 1);
});

test('plans are copies, so a caller cannot change the reference', () => {
  const look: PhotoTreatment = { id: 'g', kind: 'gradient-map', stops: ['#000', '#fff'] };
  const expected = pixels(); applyPhotoLook(expected, expected.length / 4, 1, look);
  const first = photoLookPixelPlan(look);
  first.linear.fill(0); first.unit.fill(0); first.tone!.fill(0);
  const second = photoLookPixelPlan(look);
  assert.equal(second.linear[255], 1); assert.equal(second.unit[255], 1);
  const again = pixels(); applyPhotoLook(again, again.length / 4, 1, look);
  assert.deepEqual(again, expected, 'the shared decode table the bake reads is unchanged');
});

test('a plan refuses what the bake refuses', () => {
  assert.throws(() => photoLookPixelPlan({ id: 'film', kind: 'lut', lut: 'x' }), /no pixel plan for kind lut/);
  assert.throws(() => photoLookPixelPlan({ id: 'one', kind: 'gradient-map', stops: ['#000'] }), /needs two stops/);
  assert.throws(() => photoLookPixelPlan({ id: 'odd', kind: 'neon' } as unknown as PhotoTreatment), /no pixel plan for kind neon/);
});
