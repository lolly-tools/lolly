/**
 * Chi-square LSB steganalysis tests (engine/src/steganalysis.ts).
 * Run with: node --test tests/steganalysis.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { analyzeLsb } from '../engine/src/steganalysis.ts';

const W = 128, H = 128;

// Deterministic PRNG — tests must not depend on Math.random.
function lcg(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 48271) % 0x7fffffff) / 0x7fffffff;
}

// Grey RGBA image from a per-pixel value function.
function image(fill: () => number): Uint8Array {
  const d = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const v = fill() & 0xff;
    d[i * 4] = v; d[i * 4 + 1] = v; d[i * 4 + 2] = v; d[i * 4 + 3] = 255;
  }
  return d;
}

test('analyzeLsb: rough-histogram (natural-like) image is not suspicious', () => {
  // Even values only — value pairs (2k, 2k+1) maximally UNequal, the signature
  // of an untouched carrier under this test.
  const rnd = lcg(7);
  const r = analyzeLsb(image(() => 2 * Math.floor(rnd() * 128)), { width: W, height: H });
  assert.equal(r.suspicious, false);
  assert.ok(r.score < 0.5, `natural image should read low embedding probability, got ${r.score}`);
});

test('analyzeLsb: LSB-randomized image is flagged', () => {
  // Same carrier with every LSB replaced by message bits (full embedding):
  // pairs equalise and the chi-square statistic collapses.
  const rnd = lcg(7);
  const r = analyzeLsb(image(() => 2 * Math.floor(rnd() * 128) + (rnd() < 0.5 ? 1 : 0)), { width: W, height: H });
  assert.equal(r.suspicious, true);
  assert.ok(r.score >= 0.95, `embedded image should read high probability, got ${r.score}`);
});

test('analyzeLsb: too-small images never flag', () => {
  const d = new Uint8Array(16 * 16 * 4).fill(128);
  const r = analyzeLsb(d, { width: 16, height: 16 });
  assert.equal(r.suspicious, false);
  assert.equal(r.pixels, 256);
});
