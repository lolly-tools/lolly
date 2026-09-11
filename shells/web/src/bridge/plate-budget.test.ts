// SPDX-License-Identifier: MPL-2.0
/**
 * The plate budget (plan 104 section 5.5).
 *
 * P0 cannot produce an eff above 1 - there is no camera yet - so every case here feeds
 * SYNTHETIC eff values. That is the point: the machinery has to be real and provably
 * correct before the thing that drives it exists, or the first fly-past ships an
 * untested degradation path. section 4.5 pins eff_max at 10, which means the cap engages on
 * every fly-past by design; a designed path gets tests, not a shrug.
 *
 * The two rules that keep it safe to ship at P0 are asserted first and hardest:
 * today's quality is the FLOOR, and nothing is clamped or logged when nothing asked
 * for extra.
 *
 * Run directly:  node --test shells/web/src/bridge/plate-budget.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  EFF_BUCKETS,
  PLATE_BUDGET_CAP_GB,
  PLATE_BUDGET_DEFAULT_GB,
  PLATE_BUDGET_FULL_BYTES,
  PLATE_BYTES_PER_PIXEL,
  PLATE_LONG_SIDE_LARGE,
  PLATE_LONG_SIDE_SMALL,
  PLATE_WORKER_FACTOR,
  bucketEffDown,
  bucketEffUp,
  planPlateBudget,
  plateBudgetBytes,
  plateLongSideCap,
  platesPerLayer,
  FX_CACHE_BUDGET_SHARE,
  fxCacheBudgetBytes,
  type PlateLayerNeed,
} from './plate-budget.ts';

const MB = 1024 * 1024;

function layer(over: Partial<PlateLayerNeed> = {}): PlateLayerNeed {
  return { idx: 0, kind: 'static', w: 1920, h: 1080, pad: 0, maxEff: 1, ...over };
}

// ── the budget itself ───────────────────────────────────────────────────────

test('plateBudgetBytes scales with deviceMemory and stops at the cap', () => {
  assert.equal(plateBudgetBytes(8), PLATE_BUDGET_FULL_BYTES);
  assert.equal(plateBudgetBytes(64), PLATE_BUDGET_FULL_BYTES, 'a 64GB machine gets the same half-gig');
  assert.equal(plateBudgetBytes(4), PLATE_BUDGET_FULL_BYTES / 2);
  assert.equal(plateBudgetBytes(2), PLATE_BUDGET_FULL_BYTES / 4);
  // Unknown memory is treated as the default, not as unlimited.
  assert.equal(plateBudgetBytes(null), plateBudgetBytes(PLATE_BUDGET_DEFAULT_GB));
  assert.equal(plateBudgetBytes(0), plateBudgetBytes(PLATE_BUDGET_DEFAULT_GB));
});

test('fxCacheBudgetBytes is a share of the same allowance, and scales with it', () => {
  for (const gb of [2, 4, 8, 64, null]) {
    assert.equal(fxCacheBudgetBytes(gb), Math.round(plateBudgetBytes(gb) * FX_CACHE_BUDGET_SHARE), `${gb}GB`);
  }
  // It is a CEILING on what a render may retain, never a reservation taken off the
  // plate budget - nothing here may make a plate lower-resolution (plans/104 P3.1).
  const before = planPlateBudget({ layers: [layer({ maxEff: 3 })], scale: 2, worker: false });
  const after = planPlateBudget({ layers: [layer({ maxEff: 3 })], scale: 2, worker: false, budgetBytes: plateBudgetBytes(8) });
  assert.equal(after.effOf.get(0), before.effOf.get(0));
});

test('plateLongSideCap steps at the deviceMemory cap', () => {
  assert.equal(plateLongSideCap(4), PLATE_LONG_SIDE_SMALL);
  assert.equal(plateLongSideCap(PLATE_BUDGET_CAP_GB), PLATE_LONG_SIDE_LARGE);
  assert.equal(plateLongSideCap(16), PLATE_LONG_SIDE_LARGE);
  assert.equal(plateLongSideCap(null), PLATE_LONG_SIDE_SMALL, 'unknown is the cautious one');
});

test('bucketing: up for demand, down for a clamp, and 1 is the floor of both', () => {
  assert.deepEqual([...EFF_BUCKETS], [1, 1.5, 2, 2.5, 3]);
  assert.equal(bucketEffUp(1.01), 1.5);
  assert.equal(bucketEffUp(2.5), 2.5);
  assert.equal(bucketEffUp(9), 3, 'the ladder tops out');
  assert.equal(bucketEffDown(2.49), 2);
  assert.equal(bucketEffDown(0.4), 1);
  for (const bad of [Number.NaN, -3, 0]) {
    assert.equal(bucketEffUp(bad), 1, `up(${bad})`);
    assert.equal(bucketEffDown(bad), 1, `down(${bad})`);
  }
});

test('platesPerLayer: two for video, two for a LIVE lottie, none for a citizen with no picture', () => {
  assert.equal(platesPerLayer('static'), 1);
  assert.equal(platesPerLayer('video'), 2);
  assert.equal(platesPerLayer('lottie'), 1);
  assert.equal(platesPerLayer('lottie', true), 2);
  assert.equal(platesPerLayer('audio'), 0);
  assert.equal(platesPerLayer('camera'), 0, 'a camera is a pose, not a picture (section 5.4)');
});

// ── rule 1: today's quality is the floor ────────────────────────────────────

test('a flat scene is never clamped, never warned about, and never scaled', () => {
  // Deliberately absurd: eight 4K layers at 4x export is far over any budget, and at
  // eff 1 not one pixel of it may be taken away - that is what the export already did
  // before this feature existed.
  const layers = Array.from({ length: 8 }, (_, i) => layer({ idx: i, w: 3840, h: 2160 }));
  const plan = planPlateBudget({ layers, scale: 4, worker: true, budgetBytes: 16 * MB });
  assert.equal(plan.clamped, false);
  assert.equal(plan.warning, '');
  assert.equal(plan.lambda, 1);
  for (let i = 0; i < 8; i++) assert.equal(plan.effOf.get(i), 1, `layer ${i}`);
  assert.ok(plan.bytes > plan.budgetBytes, 'and it is knowingly over budget');
});

test('the long-side cap never shrinks a plate below eff 1 either', () => {
  // 4000px box at 4x is a 16000px plate at eff 1 - four times the cap. It stays.
  const plan = planPlateBudget({
    layers: [layer({ w: 4000, h: 4000 })],
    scale: 4, worker: false, longSideCap: PLATE_LONG_SIDE_SMALL,
  });
  assert.equal(plan.effOf.get(0), 1);
  assert.equal(plan.clamped, false);
});

// ── rule 2: the degradation path, with synthetic eff ────────────────────────

test('an affordable fly-past gets exactly the resolution it asked for, bucketed up', () => {
  const plan = planPlateBudget({
    layers: [layer({ idx: 0, maxEff: 1.7 }), layer({ idx: 1, maxEff: 1, w: 320, h: 240 })],
    scale: 1, worker: false, budgetBytes: 512 * MB,
  });
  assert.equal(plan.effOf.get(0), 2, '1.7 buckets up to 2');
  assert.equal(plan.effOf.get(1), 1, 'and a layer that asked for nothing gets nothing');
  assert.equal(plan.clamped, false);
  assert.equal(plan.warning, '');
});

test('over budget: ONE lambda, applied to every layer, floored at 1, with ONE warn line', () => {
  const layers = Array.from({ length: 6 }, (_, i) => layer({ idx: i, maxEff: 3 }));
  const budgetBytes = 64 * MB;
  // A cap far out of the way, so the ONLY thing acting here is lambda.
  const plan = planPlateBudget({ layers, scale: 1, worker: false, budgetBytes, longSideCap: 1e9 });
  assert.equal(plan.clamped, true);
  assert.ok(plan.lambda < 1 && plan.lambda > 0, `lambda ${plan.lambda}`);
  // sqrt, because plate cost is quadratic in the length scale: scaling every eff by
  // lambda scales the total bytes by lambda².
  assert.ok(Math.abs(plan.lambda - Math.sqrt(budgetBytes / plan.wantedBytes)) < 1e-9);
  const effs = [...plan.effOf.values()];
  assert.ok(effs.every((e) => e >= 1), 'never below today');
  assert.ok(effs.every((e) => (EFF_BUCKETS as number[]).includes(e)), 'and still on the ladder');
  assert.equal(new Set(effs).size, 1, 'one lambda means one answer for identical layers');
  assert.ok(plan.warning.includes('plate budget'), plan.warning);
  assert.equal(plan.warning.split('\n').length, 1, 'ONE line');
});

test('a budget so small that lambda floors out still stops at eff 1, and says so once', () => {
  const plan = planPlateBudget({
    layers: [layer({ maxEff: 3 })], scale: 1, worker: false, budgetBytes: 1,
  });
  assert.equal(plan.effOf.get(0), 1, 'the floor holds');
  assert.equal(plan.clamped, true);
  assert.ok(plan.warning.length > 0);
});

test('the worker path is priced at double, and that can be what tips the budget', () => {
  const layers = [layer({ maxEff: 2 })];
  const budgetBytes = Math.round(1920 * 1080 * 4 * PLATE_BYTES_PER_PIXEL * 1.2);
  const solo = planPlateBudget({ layers, scale: 1, worker: false, budgetBytes });
  const wk = planPlateBudget({ layers, scale: 1, worker: true, budgetBytes });
  assert.equal(wk.wantedBytes, solo.wantedBytes * PLATE_WORKER_FACTOR);
  assert.equal(solo.clamped, false);
  assert.equal(wk.clamped, true, 'the transferred copy is the difference');
});

test('the long-side cap bites the EXTRA resolution, and reports it on its own', () => {
  // 2000px box at 2x is already 4000px; eff 2 would be 8000px, past a 4096 cap.
  const plan = planPlateBudget({
    layers: [layer({ w: 2000, h: 2000, maxEff: 2 })],
    scale: 2, worker: false, longSideCap: PLATE_LONG_SIDE_SMALL, budgetBytes: 4096 * MB,
  });
  assert.equal(plan.effOf.get(0), 1, 'capped back to today');
  assert.equal(plan.clamped, true);
  assert.ok(plan.warning.includes(String(PLATE_LONG_SIDE_SMALL)), plan.warning);
});

test('the pad is priced: a padded plate is a bigger plate', () => {
  const bare = planPlateBudget({ layers: [layer({ maxEff: 2 })], scale: 1, worker: false, budgetBytes: 4096 * MB });
  const padded = planPlateBudget({ layers: [layer({ maxEff: 2, pad: 60 })], scale: 1, worker: false, budgetBytes: 4096 * MB });
  assert.ok(padded.wantedBytes > bare.wantedBytes,
    `${padded.wantedBytes} vs ${bare.wantedBytes} - the spill margin costs memory`);
});

test('the PAD is capped on its own account, because eff floors at 1 and lambda only scales eff', () => {
  // THE HOLE. Every clamp used to be gated on "some layer asked for extra RESOLUTION",
  // and `pad` is the other multiplier on plate size. A 640×360 clip with a 300px
  // authored blur asks for a (640+1834)×(360+1834) plate - 5.4 Mpx at S=1, 87 MB at
  // S=2, ~90× the plate it needs, on a document that authored no depth at all. Nothing
  // could take it back: `effUnderSideCap` floors at 1, and λ never touches the pad. A
  // canvas that big is one Safari refuses, and `rasterBox`'s bare catch nulls a refused
  // plate SILENTLY - the layer vanishes from the video.
  const pad = 1834;
  const plan = planPlateBudget({
    layers: [layer({ w: 640, h: 360, pad })],
    scale: 2, worker: false, longSideCap: PLATE_LONG_SIDE_SMALL, budgetBytes: 4096 * MB,
  });
  const granted = plan.padOf.get(0) as number;
  assert.ok(granted < pad, `the pad was trimmed (${granted} of ${pad})`);
  assert.equal(plan.effOf.get(0), 1, 'and the plate is still shot at today\'s resolution');
  assert.ok((640 + granted * 2) * 2 <= PLATE_LONG_SIDE_SMALL, 'the capped plate fits the limit');
  assert.equal(plan.clamped, true);
  assert.ok(plan.warning.includes(String(PLATE_LONG_SIDE_SMALL)), plan.warning);
  assert.ok(plan.bytes <= plan.budgetBytes, 'and it is priced with the pad it will actually use');
});

test('an ordinary pad is granted whole, and asks for no warning', () => {
  const plan = planPlateBudget({
    layers: [layer({ w: 640, h: 360, pad: 60 })],
    scale: 2, worker: false, longSideCap: PLATE_LONG_SIDE_SMALL, budgetBytes: 4096 * MB,
  });
  assert.equal(plan.padOf.get(0), 60);
  assert.equal(plan.clamped, false);
  assert.equal(plan.warning, '');
});

test('FLOOR: a layer that asked for no pad is handed none, and nothing is clamped', () => {
  const plan = planPlateBudget({ layers: [layer({ w: 3840, h: 2160 })], scale: 4, worker: true });
  assert.equal(plan.padOf.get(0), 0);
  assert.equal(plan.clamped, false);
  assert.equal(plan.warning, '');
});

test('a camera and an audio bed cost nothing at all', () => {
  const plan = planPlateBudget({
    layers: [layer({ idx: 0, kind: 'camera', maxEff: 3 }), layer({ idx: 1, kind: 'audio', maxEff: 3 })],
    scale: 1, worker: true, budgetBytes: 1,
  });
  assert.equal(plan.bytes, 0);
  assert.equal(plan.clamped, false, 'nothing that costs nothing can blow a budget');
  assert.equal(plan.warning, '');
});

test('the plan is arithmetic: same input, same answer', () => {
  const layers = [layer({ idx: 0, maxEff: 2.2 }), layer({ idx: 1, kind: 'video', maxEff: 1.4 })];
  const a = planPlateBudget({ layers, scale: 2, worker: true, budgetBytes: 200 * MB });
  const b = planPlateBudget({ layers, scale: 2, worker: true, budgetBytes: 200 * MB });
  assert.deepEqual([...a.effOf], [...b.effOf]);
  assert.equal(a.bytes, b.bytes);
  assert.equal(a.warning, b.warning);
});
