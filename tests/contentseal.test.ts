/**
 * Content Seal message-free consensus tests (engine/src/contentseal.ts).
 * Run with: node --test tests/contentseal.test.ts
 *
 * These test the PURE 4-views unanimity rule — the bit math only — against
 * inputs whose unanimity count is known BY CONSTRUCTION, not against the
 * module's own ONNX output (there is no ONNX runtime, model, image, or browser
 * in this environment; the neural half is UNVERIFIED — see
 * shells/web/src/lib/contentseal.ts's header). The independent expectation is
 * the number of unanimous positions I build into each input by hand, so this is
 * not mock-theater: identical messages must read PRESENT, disagreeing noise must
 * read ABSENT, and the tau boundary must be exactly inclusive.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  contentSealConsensus,
  CONTENTSEAL_MESSAGE_BITS,
  CONTENTSEAL_DEFAULT_TAU,
} from '../engine/src/contentseal.ts';

// Deterministic PRNG — tests must not depend on Math.random (project convention;
// see tests/trustmark.test.ts / tests/steganalysis.test.ts).
function lcg(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 48271) % 0x7fffffff) / 0x7fffffff;
}

const N = CONTENTSEAL_MESSAGE_BITS; // 256

function randomBits(rnd: () => number, len = N): number[] {
  return Array.from({ length: len }, () => (rnd() < 0.5 ? 0 : 1));
}

// Build four views with EXACTLY `k` unanimous positions: the first k positions
// are all-1 across every view (unanimous); the rest set view3=0 while views 0-2
// are 1, so those positions are 3-vs-1 splits — never unanimous. U === k exactly.
function viewsWithUnanimity(k: number, V = 4, len = N): number[][] {
  const views: number[][] = Array.from({ length: V }, () => new Array<number>(len).fill(1));
  for (let i = k; i < len; i++) views[V - 1]![i] = 0;
  return views;
}

test('CONTENTSEAL_MESSAGE_BITS is 256 (nbits from the Pixel Seal / Video Seal model cards)', () => {
  assert.equal(CONTENTSEAL_MESSAGE_BITS, 256);
});

test('identical messages across all views ⇒ PRESENT, fully unanimous, message round-trips', () => {
  const rnd = lcg(12345);
  const msg = randomBits(rnd);
  const r = contentSealConsensus([msg, msg.slice(), msg.slice(), msg.slice()]);
  assert.equal(r.present, true, 'a message that survives every view unchanged is present');
  assert.equal(r.unanimous, N, 'every one of the 256 positions is unanimous');
  assert.equal(r.bits, N);
  assert.equal(r.views, 4);
  assert.equal(r.minPairAgreement, N, 'every pair agrees on every bit');
  // Consensus message equals the shared input message (packed MSB-first to hex).
  let expectedHex = '';
  for (let i = 0; i < N; i += 4) {
    expectedHex += ((msg[i]! << 3) | (msg[i + 1]! << 2) | (msg[i + 2]! << 1) | msg[i + 3]!).toString(16);
  }
  assert.equal(r.messageHex, expectedHex);
});

test('four independent random messages ⇒ ABSENT, unanimity well below tau', () => {
  // Four mutually-independent noise vectors are the idealized null: per-position
  // unanimity chance 1/8, so U ~ Binomial(256, 1/8) (mean 32, sd ≈ 5.29) — far
  // under tau=72. Checked across several seeds so it isn't a lucky single draw.
  for (const seed of [1, 7, 42, 99, 2024, 31337]) {
    const rnd = lcg(seed);
    const r = contentSealConsensus([randomBits(rnd), randomBits(rnd), randomBits(rnd), randomBits(rnd)]);
    assert.equal(r.present, false, `seed ${seed}: independent noise must not read as present`);
    assert.ok(r.unanimous < CONTENTSEAL_DEFAULT_TAU, `seed ${seed}: U=${r.unanimous} should be well below tau=${CONTENTSEAL_DEFAULT_TAU}`);
    // Sanity: the statistic behaves like the binomial mean of ~32, not pinned.
    assert.ok(r.unanimous > 5 && r.unanimous < 64, `seed ${seed}: U=${r.unanimous} should sit near the Binomial(256,1/8) body`);
  }
});

test('tau boundary is exactly inclusive: U === tau ⇒ present, U === tau-1 ⇒ absent', () => {
  const tau = CONTENTSEAL_DEFAULT_TAU;

  const atTau = contentSealConsensus(viewsWithUnanimity(tau));
  assert.equal(atTau.unanimous, tau, 'constructed exactly tau unanimous positions');
  assert.equal(atTau.present, true, 'U === tau must be present (>= is inclusive)');

  const belowTau = contentSealConsensus(viewsWithUnanimity(tau - 1));
  assert.equal(belowTau.unanimous, tau - 1);
  assert.equal(belowTau.present, false, 'U === tau-1 must be absent');

  const fully = contentSealConsensus(viewsWithUnanimity(N));
  assert.equal(fully.unanimous, N);
  assert.equal(fully.present, true);
});

test('a custom tau is honoured (calibration knob)', () => {
  const views = viewsWithUnanimity(40); // U = 40
  assert.equal(contentSealConsensus(views, { tau: 40 }).present, true, 'U=40 >= tau=40');
  assert.equal(contentSealConsensus(views, { tau: 41 }).present, false, 'U=40 < tau=41');
  // The default tau (72) would reject U=40 — confirms the override actually moved it.
  assert.equal(contentSealConsensus(views).present, false);
});

test('minPairAgreement flags a single rogue view even when overall unanimity is high', () => {
  // Three views identical, the fourth fully inverted: NO position is unanimous
  // (the 4th always disagrees), and every pair involving the 4th agrees on 0 bits.
  const rnd = lcg(555);
  const msg = randomBits(rnd);
  const inverted = msg.map((b) => (b ? 0 : 1));
  const r = contentSealConsensus([msg, msg.slice(), msg.slice(), inverted]);
  assert.equal(r.unanimous, 0, 'the inverted view breaks unanimity everywhere');
  assert.equal(r.present, false);
  assert.equal(r.minPairAgreement, 0, 'the weakest pair (any real view vs the inverted one) agrees on nothing');
});

test('malformed input is a safe non-answer, never a throw or a false positive', () => {
  // Fewer than 2 views → cannot measure agreement.
  assert.equal(contentSealConsensus([]).present, false);
  assert.equal(contentSealConsensus([[1, 0, 1]]).present, false);
  // Ragged lengths → cannot compare position-by-position.
  const ragged = contentSealConsensus([[1, 1, 1, 1], [1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1]]);
  assert.equal(ragged.present, false);
  assert.equal(ragged.unanimous, 0);
  // Empty views.
  assert.equal(contentSealConsensus([[], [], [], []]).present, false);
});

test('accepts booleans as well as 0/1 numbers', () => {
  const asNums = viewsWithUnanimity(N);
  const asBools = asNums.map((v) => v.map((b) => !!b));
  const r = contentSealConsensus(asBools);
  assert.equal(r.present, true);
  assert.equal(r.unanimous, N);
});
