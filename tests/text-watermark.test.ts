// SPDX-License-Identifier: MPL-2.0
// The green-list text watermark (engine/src/text-watermark.ts): the embed/detect
// round trip, the false-positive guards, and the pinned hash vectors the native
// Rust sampler (shells/tauri-desktop reword.rs) must reproduce bit for bit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mix32, isGreenToken, addGreenBias, greenListZ, binomialTailP, scoreTokenWatermark,
  REWORD_WATERMARK, type WatermarkScheme,
} from '../engine/src/text-watermark.ts';

const VOCAB = 4096;

/** Deterministic 32-bit PRNG (mulberry32) - engine tests never touch Math.random. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

/** Sample one token from softmax(logits) - the toy sampler for the round trip. */
function sampleSoftmax(logits: Float32Array, r: () => number): number {
  let max = -Infinity;
  for (const l of logits) if (l > max) max = l;
  let sum = 0;
  const exps = new Float64Array(logits.length);
  for (let i = 0; i < logits.length; i++) { exps[i] = Math.exp(logits[i]! - max); sum += exps[i]!; }
  let u = r() * sum;
  for (let i = 0; i < logits.length; i++) { u -= exps[i]!; if (u <= 0) return i; }
  return logits.length - 1;
}

/** Generate `n` tokens over a flat toy distribution, optionally watermarked. */
function generate(n: number, scheme: WatermarkScheme | null, seed: number): number[] {
  const r = rng(seed);
  const ids: number[] = [Math.floor(r() * VOCAB)];
  for (let i = 1; i < n; i++) {
    const logits = new Float32Array(VOCAB); // flat = maximum entropy
    if (scheme) addGreenBias(logits, ids[i - 1]!, scheme);
    ids.push(sampleSoftmax(logits, r));
  }
  return ids;
}

// ── Pinned vectors: the cross-language contract with reword.rs ───────────────
// If these move, the Rust mirror silently drifts and desktop rewords stop
// verifying. Change them only with the Rust test in the same change.
test('mix32 and isGreenToken match the pinned vectors', () => {
  assert.equal(mix32(0), 0);
  assert.equal(mix32(1), 0x86d2fa73);
  assert.equal(mix32(0xdeadbeef), 0x2a2acaf2);
  assert.equal(isGreenToken(REWORD_WATERMARK, 1234, 4), true);
  assert.equal(isGreenToken(REWORD_WATERMARK, 1234, 5678), false);
  assert.equal(isGreenToken(REWORD_WATERMARK, 49151, 42), false);
});
test('scheme constants are the published contract', () => {
  assert.equal(REWORD_WATERMARK.key, 0x4c4f4c4c);
  assert.equal(REWORD_WATERMARK.gamma, 0.25);
  assert.equal(REWORD_WATERMARK.delta, 6);
});

// ── The partition ────────────────────────────────────────────────────────────
test('the green fraction of a vocabulary is gamma', () => {
  let green = 0;
  for (let id = 0; id < VOCAB; id++) if (isGreenToken(REWORD_WATERMARK, 1234, id)) green++;
  const frac = green / VOCAB;
  assert.ok(Math.abs(frac - REWORD_WATERMARK.gamma) < 0.03, `green fraction ${frac}`);
});

test('addGreenBias moves exactly the green logits and reports the count', () => {
  const logits = new Float32Array(VOCAB);
  const green = addGreenBias(logits, 77, REWORD_WATERMARK);
  let moved = 0;
  for (let i = 0; i < VOCAB; i++) {
    const isGreen = isGreenToken(REWORD_WATERMARK, 77, i);
    assert.equal(logits[i], isGreen ? REWORD_WATERMARK.delta : 0);
    if (isGreen) moved++;
  }
  assert.equal(green, moved);
});

// ── The statistic ────────────────────────────────────────────────────────────
test('greenListZ matches the paper formula', () => {
  // 30 green of 40 at gamma 0.25: (30-10)/sqrt(40*0.25*0.75) = 20/sqrt(7.5)
  assert.ok(Math.abs(greenListZ(30, 40, 0.25) - 20 / Math.sqrt(7.5)) < 1e-12);
  assert.equal(greenListZ(0, 0, 0.25), 0);
});

test('binomialTailP is the exact tail where a false accusation would land', () => {
  // P(Bin(4, 0.5) >= 2) = 11/16, hand-computable.
  assert.ok(Math.abs(binomialTailP(2, 4, 0.5) - 11 / 16) < 1e-12);
  // Certainty edges.
  assert.equal(binomialTailP(0, 10, 0.25), 1);
  assert.equal(binomialTailP(11, 10, 0.25), 0);
  // All green of 10 at gamma 0.25 = 0.25^10.
  assert.ok(Math.abs(binomialTailP(10, 10, 0.25) - 0.25 ** 10) < 1e-16);
  // The short-length honesty the z line misses: 9 green of 12 sits near z=4
  // but its true tail is ~4e-4 - above the 1e-4 claim threshold.
  assert.ok(greenListZ(9, 12, 0.25) >= 3.9);
  assert.ok(binomialTailP(9, 12, 0.25) > REWORD_WATERMARK.pThreshold);
  // The long-total normal branch stays close to the exact value.
  const approx = binomialTailP(80, 240, 0.25);
  assert.ok(approx > 1e-4 && approx < 1e-2, `approx ${approx}`);
});

// ── Round trip and false positives ───────────────────────────────────────────
test('watermarked generation detects; unmarked does not', () => {
  for (const seed of [1, 2, 3]) {
    const marked = scoreTokenWatermark(generate(60, REWORD_WATERMARK, seed), REWORD_WATERMARK);
    assert.ok(marked.detected, `seed ${seed}: z=${marked.z} over ${marked.tokens}`);
    const plain = scoreTokenWatermark(generate(400, null, seed), REWORD_WATERMARK);
    assert.ok(!plain.detected, `seed ${seed}: unmarked z=${plain.z}`);
  }
});

test('a short watermarked rewrite (a lone sentence) still detects', () => {
  const score = scoreTokenWatermark(generate(24, REWORD_WATERMARK, 9), REWORD_WATERMARK);
  assert.ok(score.detected, `z=${score.z} over ${score.tokens}`);
});

test('a watermarked span inside a long unmarked document detects via the window', () => {
  const doc = [...generate(600, null, 4), ...generate(40, REWORD_WATERMARK, 5), ...generate(600, null, 6)];
  const score = scoreTokenWatermark(doc, REWORD_WATERMARK);
  assert.ok(score.window, 'expected a windowed pass');
  assert.ok(score.detected, `window z=${score.window?.z}`);
});

test('degenerate repetition cannot convict: unique bigrams are scored once', () => {
  // One bigram repeated 500 times is ONE coin flip, not 500 wins.
  const ids: number[] = [];
  for (let i = 0; i < 500; i++) ids.push(7, 8);
  const score = scoreTokenWatermark(ids, REWORD_WATERMARK);
  assert.ok(score.tokens <= 3, `scored ${score.tokens} bigrams`);
  assert.ok(!score.detected);
});

test('below minTokens no whole-text claim is made even at a perfect green run', () => {
  // Hand-pick a chain of green successors, shorter than minTokens.
  const ids = [0];
  for (let i = 0; i < REWORD_WATERMARK.minTokens - 2; i++) {
    const prev = ids[ids.length - 1]!;
    for (let id = 0; id < VOCAB; id++) {
      if (isGreenToken(REWORD_WATERMARK, prev, id) && id !== prev) { ids.push(id); break; }
    }
  }
  const score = scoreTokenWatermark(ids, REWORD_WATERMARK);
  assert.ok(score.tokens < REWORD_WATERMARK.minTokens);
  assert.ok(!score.detected);
});
