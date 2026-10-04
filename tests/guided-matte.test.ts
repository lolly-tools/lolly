// SPDX-License-Identifier: MPL-2.0
/**
 * engine/src/guided-matte.ts: the guided filter that pulls a matte's edges onto
 * the photo (plans/289 M4, adapted from Compositor's GuidedMatte.swift).
 *
 * Run with: node --test tests/guided-matte.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boxMean, guidedFilter, refineMatte, resizeMask } from '../engine/src/guided-matte.ts';

const plane = (w: number, h: number, f: (x: number, y: number) => number) => {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = f(x, y);
  return out;
};

test('boxMean is the mean of the (2r+1) square, with edge pixels repeated', () => {
  const w = 17, h = 11, r = 3;
  const src = plane(w, h, (x, y) => ((x * 7 + y * 13) % 10) / 10);
  const got = boxMean(src, w, h, r);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) s += src[Math.min(h - 1, Math.max(0, y + j)) * w + Math.min(w - 1, Math.max(0, x + i))]!;
      assert.ok(Math.abs(got[y * w + x]! - s / ((2 * r + 1) ** 2)) < 1e-5, `(${x}, ${y})`);
    }
  }
});

/** A dark subject on the left with thin dark strands running out past it; the model's mask stops short and soft. */
function hairScene(w: number, h: number) {
  const edge = w >> 1;
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const strand = x >= edge && x < edge + 20 && x % 4 === 0;
      const v = x < edge || strand ? 40 : 235;
      rgba.set([v, v, v, 255], (y * w + x) * 4);
    }
  }
  const coarse = plane(w, h, (x) => (x < edge ? 255 : 0));
  const alpha = Uint8Array.from(boxMean(coarse, w, h, 3), (v) => Math.round(v));
  return { rgba, alpha, edge };
}

test('a refined matte follows strands the model missed, and leaves the gaps between them out', () => {
  const w = 96, h = 48;
  const { rgba, alpha, edge } = hairScene(w, h);
  const out = refineMatte(alpha, rgba, w, h, { radius: 12 });
  const at = (x: number) => out[24 * w + x]!;
  const onStrand = edge + 8, between = edge + 10;
  assert.ok(alpha[24 * w + onStrand]! < 10, 'the model mask had nothing out there');
  assert.ok(at(onStrand) > at(between) + 40, `strand ${at(onStrand)} against gap ${at(between)}`);
  assert.ok(at(4) > 240 && at(w - 4) < 15, 'deep inside stays in, far outside stays out');
});

test('when the image fits the limit, the fast form is the plain filter', () => {
  const w = 64, h = 40;
  const { rgba, alpha } = hairScene(w, h);
  const guide = plane(w, h, (x, y) => (0.299 * rgba[(y * w + x) * 4]! + 0.587 * rgba[(y * w + x) * 4 + 1]! + 0.114 * rgba[(y * w + x) * 4 + 2]!) / 255);
  const mask = plane(w, h, (x, y) => alpha[y * w + x]! / 255);
  const plain = guidedFilter(mask, guide, w, h, 6, 1e-4);
  const fast = refineMatte(alpha, rgba, w, h, { radius: 6, limit: 1024, textureFloor: 0 });
  for (let i = 0; i < w * h; i++) assert.ok(Math.abs(fast[i]! - Math.round(plain[i]! * 255)) <= 1, `pixel ${i}`);
});

test('radius 0 leaves the matte; shift moves the edge; contrast hardens it', () => {
  const w = 40, h = 4;
  const alpha = Uint8Array.from({ length: w * h }, (_, i) => Math.round(((i % w) / (w - 1)) * 255));
  const rgba = new Uint8ClampedArray(w * h * 4).fill(128);
  assert.deepEqual(refineMatte(alpha, rgba, w, h, { radius: 0 }), alpha);
  const out = refineMatte(alpha, rgba, w, h, { radius: 0, shift: 0.4 });
  assert.ok(out[20]! > alpha[20]! + 40, 'a positive shift grows the matte');
  const hard = refineMatte(alpha, rgba, w, h, { radius: 0, contrast: 6 });
  assert.equal(hard[2], 0);
  assert.equal(hard[w - 3], 255);
  assert.ok(Math.abs(hard[w >> 1]! - alpha[w >> 1]!) <= 20, 'the middle of the edge stays put');
});

test('resizeMask: same size is a copy; a 2 x 2 mask scales up smoothly within its range', () => {
  const m = Uint8Array.from([0, 255, 255, 0]);
  assert.deepEqual(resizeMask(m, 2, 2, 2, 2), m);
  const up = resizeMask(m, 2, 2, 8, 8);
  assert.equal(up.length, 64);
  assert.equal(up[0], 0);
  assert.equal(up[7], 255);
  assert.ok(up.every((v) => v >= 0 && v <= 255));
  assert.ok(up[3 * 8 + 3]! > 0 && up[3 * 8 + 3]! < 255, 'the middle blends');
});

test('a 3000 x 2000 photo refines within a time budget', () => {
  const w = 3000, h = 2000;
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = (i * 31) & 255;
  const alpha = Uint8Array.from({ length: w * h }, (_, i) => ((i % w) < w / 2 ? 255 : 0));
  const t0 = performance.now();
  refineMatte(alpha, rgba, w, h);
  const ms = performance.now() - t0;
  assert.ok(ms < 3000, `took ${Math.round(ms)} ms`);
});

test('both mattes end in one tail: as drawn is a plain scale-up, refined follows the photo', async () => {
  const { finishMatteAlpha, planLetterbox } = await import('../packages/node-shell/src/ml/matte-math.ts');
  const w = 96, h = 48, edge = 64;
  const { rgba } = hairScene(w, h);
  const plan = planLetterbox(w, h, edge);
  // A model mask in the letterboxed square: the left half of the content is in.
  const maskEdge = new Float32Array(edge * edge);
  for (let y = 0; y < plan.contentH; y++) for (let x = 0; x < plan.contentW; x++) maskEdge[(plan.offsetY + y) * edge + plan.offsetX + x] = x < plan.contentW / 2 ? 1 : 0;
  const asDrawn = finishMatteAlpha(maskEdge, plan, rgba, w, h, false);
  const unpadded = new Uint8Array(plan.contentW * plan.contentH);
  for (let y = 0; y < plan.contentH; y++) for (let x = 0; x < plan.contentW; x++) unpadded[y * plan.contentW + x] = x < plan.contentW / 2 ? 255 : 0;
  assert.deepEqual(asDrawn, resizeMask(unpadded, plan.contentW, plan.contentH, w, h));
  const refined = finishMatteAlpha(maskEdge, plan, rgba, w, h, undefined);
  assert.notDeepEqual(refined, asDrawn, 'refinement is on by default');
});

test('lolly matte edge flags: as-drawn turns refinement off; numbers are checked', async () => {
  const { matteRefineFlags } = await import('../shells/cli/src/ml-cli.ts');
  assert.equal(matteRefineFlags({}), undefined);
  assert.equal(matteRefineFlags({ edges: 'as-drawn' }), false);
  assert.deepEqual(matteRefineFlags({ 'edge-radius': '20', 'edge-shift': '-0.2' }), { radius: 20, shift: -0.2 });
  assert.throws(() => matteRefineFlags({ edges: 'soft' }), /--edges takes refined or as-drawn/);
  assert.throws(() => matteRefineFlags({ 'edge-contrast': '20' }), /--edge-contrast takes a number from 1 to 10/);
});
