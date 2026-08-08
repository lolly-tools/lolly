// SPDX-License-Identifier: MPL-2.0
/**
 * color-curve.ts — tonal-curve model contract tests.
 *
 * The load-bearing guarantee: the DEFAULT curve for a brand primary reproduces
 * today's ramp output BYTE-FOR-BYTE. The reference below rebuilds the primary
 * ramp exactly as brand-derive.ts does (rampLightnesses + chromaBell + the
 * mid-range peak clamp) and asserts bakeCurve matches, across the full
 * RAMP_STEPS range and for primaries both inside and outside the anchor-pull
 * band. Also covers curveFromRamp round-trip stability and JSON identity.
 *
 * Run with: node --test tests/color-curve.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  type Oklch,
  oklchToHex,
  rampLightnesses,
  chromaBell,
  RAMP_STEPS_MIN,
  RAMP_STEPS_MAX,
} from '../engine/src/brand-derive.ts';
import {
  defaultColorCurve,
  evalChannel,
  sampleCurve,
  bakeCurve,
  curveFromRamp,
  serializeCurve,
  deserializeCurve,
  type ColorCurve,
} from '../engine/src/color-curve.ts';

// The exact primary-ramp hex stops brand-derive would emit for `primary` at
// length `n` — the byte-identity reference (mkRamp with chromaScale = 1).
function referenceRampHex(primary: Oklch, n: number): string[] {
  const peak = Math.min(0.75, Math.max(0.45, primary.l));
  const Ls = rampLightnesses(primary.l, n);
  return Ls.map((L) =>
    oklchToHex({ l: L, c: primary.c * chromaBell(L, peak), h: primary.h }),
  );
}

// A primary INSIDE the anchor-pull band (0.45–0.75) and one OUTSIDE it, so both
// rampLightnesses branches are exercised.
const PRIMARIES: Array<[string, Oklch]> = [
  ['mid-range (anchor pull)', { l: 0.62, c: 0.14, h: 250 }],
  ['dark (no pull)', { l: 0.3, c: 0.11, h: 145 }],
  ['light (no pull)', { l: 0.82, c: 0.09, h: 75 }],
];

// ─── Byte-identity: default curve reproduces today's ramp ─────────────────────

test('defaultColorCurve baked to n equals the current ramp hex byte-for-byte', () => {
  for (const [label, primary] of PRIMARIES) {
    for (let n = RAMP_STEPS_MIN; n <= RAMP_STEPS_MAX; n++) {
      const expected = referenceRampHex(primary, n);
      const curve = defaultColorCurve(primary, n);
      const actual = bakeCurve(curve, n);
      assert.deepEqual(actual, expected, `${label}, n=${n}: baked ramp must match reference`);
    }
  }
  console.log('  default curve reproduces the primary ramp for every step count');
});

test('sampleCurve returns the exact OKLCH stops the default was built from', () => {
  const primary: Oklch = { l: 0.62, c: 0.14, h: 250 };
  const n = 9;
  const peak = Math.min(0.75, Math.max(0.45, primary.l));
  const Ls = rampLightnesses(primary.l, n);
  const curve = defaultColorCurve(primary, n);
  const stops = sampleCurve(curve, n);
  assert.equal(stops.length, n);
  for (let i = 0; i < n; i++) {
    assert.equal(stops[i]!.l, Ls[i]!, `stop ${i} L exact`);
    assert.equal(stops[i]!.c, primary.c * chromaBell(Ls[i]!, peak), `stop ${i} C exact`);
    assert.equal(stops[i]!.h, primary.h, `stop ${i} H exact`);
  }
});

test('sampleCurve default length is the control-point count', () => {
  const curve = defaultColorCurve({ l: 0.55, c: 0.12, h: 300 }, 7);
  assert.equal(sampleCurve(curve).length, 7);
  assert.equal(bakeCurve(curve).length, 7);
});

// ─── Interpolation branch: off-node t and resampling ─────────────────────────

test('evalChannel interpolates linearly between control points at off-node t', () => {
  const twoPt = { points: [{ t: 0, v: 0 }, { t: 1, v: 10 }] };
  assert.equal(evalChannel(twoPt, 0.25), 2.5);
  assert.equal(evalChannel(twoPt, 0.5), 5);
  assert.equal(evalChannel(twoPt, 0.75), 7.5);

  // A tent: rises then falls, so both segments' interpolation is exercised.
  const tent = { points: [{ t: 0, v: 0 }, { t: 0.5, v: 10 }, { t: 1, v: 0 }] };
  assert.equal(evalChannel(tent, 0.25), 5);
  assert.equal(evalChannel(tent, 0.5), 10); // exact node
  assert.equal(evalChannel(tent, 0.75), 5);

  // Outside [first,last] clamps to the endpoint value.
  assert.equal(evalChannel(tent, -1), 0);
  assert.equal(evalChannel(tent, 2), 0);
});

test('sampleCurve resampled to a different n hits interior (interpolated) values', () => {
  // 3 L control points, sampled at n=5 (t = 0, .25, .5, .75, 1) so two of the
  // five samples land BETWEEN control points and must interpolate.
  const curve: ColorCurve = {
    L: { points: [{ t: 0, v: 0.2 }, { t: 0.5, v: 0.6 }, { t: 1, v: 0.9 }] },
    C: { points: [{ t: 0, v: 0.05 }, { t: 1, v: 0.05 }] },
    H: { points: [{ t: 0, v: 250 }, { t: 1, v: 250 }] },
  };
  const stops = sampleCurve(curve, 5);
  assert.equal(stops.length, 5);
  assert.ok(Math.abs(stops[1]!.l - 0.4) < 1e-9, 't=.25 → midpoint of first segment (0.2..0.6)');
  assert.ok(Math.abs(stops[2]!.l - 0.6) < 1e-9, 't=.5 → the middle node');
  assert.ok(Math.abs(stops[3]!.l - 0.75) < 1e-9, 't=.75 → midpoint of second segment (0.6..0.9)');
});

test('sampleCurve is correct on UNSORTED control points (the editable path)', () => {
  const sorted: ColorCurve = {
    L: { points: [{ t: 0, v: 0.2 }, { t: 0.5, v: 0.6 }, { t: 1, v: 0.9 }] },
    C: { points: [{ t: 0, v: 0.05 }, { t: 0.5, v: 0.08 }, { t: 1, v: 0.05 }] },
    H: { points: [{ t: 0, v: 250 }, { t: 0.5, v: 250 }, { t: 1, v: 250 }] },
  };
  // Same points, order scrambled per channel (as a UI reorder would produce).
  const scrambled: ColorCurve = {
    L: { points: [sorted.L.points[2]!, sorted.L.points[0]!, sorted.L.points[1]!] },
    C: { points: [sorted.C.points[1]!, sorted.C.points[2]!, sorted.C.points[0]!] },
    H: { points: [...sorted.H.points] },
  };
  assert.deepEqual(sampleCurve(scrambled, 5), sampleCurve(sorted, 5), 'unsorted samples == sorted samples');
  assert.deepEqual(bakeCurve(scrambled, 5), bakeCurve(sorted, 5), 'unsorted bake == sorted bake');
  // evalChannel is itself order-independent at an off-node t.
  assert.equal(evalChannel(scrambled.L, 0.25), evalChannel(sorted.L, 0.25));
});

// ─── curveFromRamp round-trip stability ───────────────────────────────────────

test('curveFromRamp(bakeCurve(curve)) re-bakes to the identical ramp (stable)', () => {
  for (const [label, primary] of PRIMARIES) {
    for (const n of [RAMP_STEPS_MIN, 9, RAMP_STEPS_MAX]) {
      const curve = defaultColorCurve(primary, n);
      const baked = bakeCurve(curve, n);
      const refitted = curveFromRamp(baked);
      const rebaked = bakeCurve(refitted, n);
      assert.deepEqual(rebaked, baked, `${label}, n=${n}: fit→bake is stable`);
      // And idempotent under a second pass.
      const again = bakeCurve(curveFromRamp(rebaked), n);
      assert.deepEqual(again, rebaked, `${label}, n=${n}: second fit is a fixed point`);
    }
  }
  console.log('  curveFromRamp is a stable fixed point through hex');
});

test('curveFromRamp skips unparseable stops', () => {
  const curve = curveFromRamp(['#ff0000', 'not-a-color', '#0000ff']);
  assert.equal(curve.L.points.length, 2);
  assert.equal(curve.C.points.length, 2);
  assert.equal(curve.H.points.length, 2);
});

// ─── JSON serialize / deserialize identity ────────────────────────────────────

test('serializeCurve → deserializeCurve is an identity round-trip', () => {
  const curve = defaultColorCurve({ l: 0.62, c: 0.14, h: 250 }, 12);
  const json = serializeCurve(curve);
  const back = deserializeCurve(json);
  assert.deepEqual(back, curve, 'deserialized curve deep-equals the original');
  // Re-serializing yields byte-identical JSON.
  assert.equal(serializeCurve(back), json, 'JSON string is stable across a round-trip');
  // And the baked output is unchanged.
  assert.deepEqual(bakeCurve(back, 12), bakeCurve(curve, 12), 'baked ramp unchanged after round-trip');
});

test('deserializeCurve re-sorts control points by t', () => {
  const scrambled: ColorCurve = {
    L: { points: [{ t: 1, v: 0.9 }, { t: 0, v: 0.2 }, { t: 0.5, v: 0.5 }] },
    C: { points: [{ t: 0, v: 0.1 }, { t: 1, v: 0.05 }] },
    H: { points: [{ t: 0, v: 250 }, { t: 1, v: 250 }] },
  };
  const back = deserializeCurve(serializeCurve(scrambled));
  assert.deepEqual(back.L.points.map((p) => p.t), [0, 0.5, 1]);
  assert.equal(back.L.points[0]!.v, 0.2);
});
