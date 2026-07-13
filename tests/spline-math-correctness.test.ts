/**
 * Comprehensive test suite for gradient spline math correctness.
 *
 * Tests the Bézier interpolation implementation in rampOklab:
 * (1) 4-stop gradient correctness (red, orange, green, blue) with 100 colors
 * (2) Monotonicity and smoothness properties
 * (3) Edge cases (2-stop linear, single-color constant)
 * (4) Performance benchmarks (1000-color ramp < 10ms)
 * (5) Numerical stability checks
 *
 * Run with: node --test tests/spline-math-correctness.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rampOklab, hexToOklch, deltaEOk } from '../engine/src/index.ts';

const HEX6 = /^#[0-9a-f]{6}$/;

// Helper to measure execution time in milliseconds. Best-of-N: the suite runs
// under `node --test` with many child processes competing for cores, and
// scheduler preemption / GC only ever ADD wall time — so the minimum over a
// few runs is the noise-robust estimate of true cost (the first runs double
// as JIT warm-up). A single sample here made the scaling-ratio assertion
// flake under full-suite load.
function benchmark(label: string, fn: () => void, runs = 5): number {
  let best = Infinity;
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    fn();
    const elapsed = performance.now() - start;
    if (elapsed < best) best = elapsed;
  }
  console.log(`  [${label}] ${best.toFixed(3)}ms (best of ${runs})`);
  return best;
}

// Helper for approximate equality
const approx = (actual: number, expected: number, tol: number, msg?: string) =>
  assert.ok(Math.abs(actual - expected) <= tol,
    `${msg ?? 'value'}: ${actual} not within ${tol} of ${expected}`);

// ─── Test 1: 4-Stop Gradient Correctness ──────────────────────────────────────

test('4-stop gradient (red→orange→green→blue) generates 100 smooth colors', () => {
  const stops = [
    '#ff0000', // red
    '#ff8800', // orange
    '#00ff00', // green
    '#0000ff', // blue
  ];

  const ramp = rampOklab(stops, 100);

  // Verify output format
  assert.equal(ramp.length, 100, 'should generate exactly 100 colors');
  for (const hex of ramp) {
    assert.match(hex, HEX6, `${hex} should be a valid hex color`);
  }

  // Verify exact endpoints
  assert.ok(deltaEOk(ramp[0]!, stops[0]!) < 1e-3, 'first color should be red');
  assert.ok(deltaEOk(ramp[99]!, stops[3]!) < 1e-3, 'last color should be blue');

  // Extract lightness and hue values
  const colors = ramp.map(hex => hexToOklch(hex)!);
  const lightness = colors.map(c => c.l);
  const hue = colors.map(c => c.h);
  const chroma = colors.map(c => c.c);

  console.log(`  4-stop ramp statistics:`);
  console.log(`    Lightness range: [${lightness[0]!.toFixed(4)}, ${Math.max(...lightness).toFixed(4)}]`);
  console.log(`    Hue range: [${Math.min(...hue).toFixed(1)}°, ${Math.max(...hue).toFixed(1)}°]`);
  console.log(`    Chroma range: [${Math.min(...chroma).toFixed(4)}, ${Math.max(...chroma).toFixed(4)}]`);

  // Verify color count consistency
  assert.equal(ramp.length, 100);
  assert.equal(colors.length, 100);
});

// ─── Test 2: Lightness Monotonicity ──────────────────────────────────────────

test('4-stop gradient lightness exhibits expected behavior', () => {
  const stops = ['#ff0000', '#ff8800', '#00ff00', '#0000ff'];
  const ramp = rampOklab(stops, 100);
  const colors = ramp.map(hex => hexToOklch(hex)!);
  const lightness = colors.map(c => c.l);

  // Check that lightness doesn't have wild oscillations
  let oscillations = 0;
  for (let i = 1; i < lightness.length - 1; i++) {
    const prev = lightness[i - 1]!;
    const curr = lightness[i]!;
    const next = lightness[i + 1]!;
    // Count direction changes (local extrema)
    const isPeak = curr > prev && curr > next;
    const isValley = curr < prev && curr < next;
    if (isPeak || isValley) oscillations++;
  }

  console.log(`  Lightness oscillations: ${oscillations} local extrema in 100-color ramp`);
  // Bézier interpolation through 4 control points should be smooth but may have
  // some structure — we just verify it's not chaotic
  assert.ok(oscillations < 10, 'should not have excessive lightness oscillations');

  // Verify no NaN values
  for (let i = 0; i < lightness.length; i++) {
    assert.ok(Number.isFinite(lightness[i]!), `color ${i} lightness should be finite`);
  }
});

// ─── Test 3: Hue Smoothness ───────────────────────────────────────────────────

test('4-stop gradient hue transitions smoothly without discontinuities', () => {
  const stops = ['#ff0000', '#ff8800', '#00ff00', '#0000ff'];
  const ramp = rampOklab(stops, 100);
  const colors = ramp.map(hex => hexToOklch(hex)!);
  const hue = colors.map(c => c.h);

  // Normalize hue differences to the smallest arc (hue wraps at 360)
  const hueDiffs: number[] = [];
  for (let i = 1; i < hue.length; i++) {
    let diff = hue[i]! - hue[i - 1]!;
    // Normalize to [-180, 180]
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    hueDiffs.push(Math.abs(diff));
  }

  const maxHueDiff = Math.max(...hueDiffs);
  const avgHueDiff = hueDiffs.reduce((a, b) => a + b, 0) / hueDiffs.length;

  console.log(`  Hue smoothness:`);
  console.log(`    Max adjacent hue difference: ${maxHueDiff.toFixed(3)}°`);
  console.log(`    Average adjacent hue difference: ${avgHueDiff.toFixed(3)}°`);
  console.log(`    Hue range: [${Math.min(...hue).toFixed(1)}°, ${Math.max(...hue).toFixed(1)}°]`);

  // In a Bézier ramp, hue differences should be smooth (relatively consistent).
  // Over a 235° hue span in 100 samples, steps average ~2.35°; maxima of ~5° are normal.
  // What we're guarding against is >180° jumps (hue wrap) or chaotic oscillation.
  assert.ok(maxHueDiff < 10, 'adjacent colors should have reasonable hue step sizes');

  // Verify no NaN hues
  for (let i = 0; i < hue.length; i++) {
    assert.ok(Number.isFinite(hue[i]!), `color ${i} hue should be finite`);
  }
});

// ─── Test 4: Edge Case — 2-Stop Gradient (Linear) ─────────────────────────────

test('2-stop gradient behaves like linear interpolation', () => {
  const stops = ['#000000', '#ffffff'];
  const ramp = rampOklab(stops, 11);

  assert.equal(ramp.length, 11);

  const colors = ramp.map(hex => hexToOklch(hex)!);
  const lightness = colors.map(c => c.l);

  // Verify linear progression
  for (let i = 0; i < lightness.length; i++) {
    const expected = (i / (lightness.length - 1));
    approx(lightness[i]!, expected, 0.02, `2-stop linear lightness at ${i}`);
  }

  console.log(`  2-stop linear interpolation verified`);
});

// ─── Test 5: Edge Case — Single Color Gradient (Constant) ────────────────────

test('single-color gradient returns constant color', () => {
  const stops = ['#4f83cc'];
  const ramp = rampOklab(stops, 25);

  assert.equal(ramp.length, 25);

  // All colors should be identical (within gamut mapping tolerance)
  for (const hex of ramp) {
    assert.ok(deltaEOk(hex, stops[0]!) < 1e-3, 'all colors should match the single stop');
  }

  console.log(`  Single-color gradient verified — all 25 colors identical`);
});

// ─── Test 6: Edge Case — Empty Output ───────────────────────────────────────

test('edge cases: n=0 returns [], n=1 returns [first stop]', () => {
  const stops = ['#ff0000', '#00ff00'];

  assert.deepEqual(rampOklab(stops, 0), []);
  assert.deepEqual(rampOklab(stops, 1), ['#ff0000']);

  // Negative n should also return []
  assert.deepEqual(rampOklab(stops, -5), []);

  console.log(`  Empty/single output edge cases verified`);
});

// ─── Test 7: Numerical Stability ──────────────────────────────────────────────

test('numerical stability: no NaN/Infinity in large ramps', () => {
  const stops = ['#123456', '#abcdef', '#654321', '#fedcba'];
  const ramp = rampOklab(stops, 1000);

  let nanCount = 0;
  let infCount = 0;

  for (const hex of ramp) {
    const c = hexToOklch(hex);
    if (!c) {
      nanCount++;
      continue;
    }
    if (!Number.isFinite(c.l) || !Number.isFinite(c.c) || !Number.isFinite(c.h)) {
      infCount++;
    }
  }

  assert.equal(nanCount, 0, 'no unparseable colors in 1000-sample ramp');
  assert.equal(infCount, 0, 'no NaN/Infinity values in color components');

  console.log(`  Numerical stability: 1000 colors generated with no NaN/Infinity`);
});

// ─── Test 8: Correctness with correctLightness Option ──────────────────────

test('correctLightness option produces perceptually even steps', () => {
  // Create a ramp where uncorrected bezier would sag
  const stops = ['#111111', '#223377', '#ffffff'];
  const n = 51;

  const corrected = rampOklab(stops, n, { correctLightness: true });
  const uncorrected = rampOklab(stops, n, { correctLightness: false });

  const corrL = corrected.map(h => hexToOklch(h)!.l);
  const uncorrL = uncorrected.map(h => hexToOklch(h)!.l);

  // Calculate step size variance
  const calcVariance = (arr: number[]) => {
    const diffs = [];
    for (let i = 1; i < arr.length; i++) {
      diffs.push(arr[i]! - arr[i - 1]!);
    }
    const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const variance = diffs.reduce((a, b) => a + (b - mean) ** 2, 0) / diffs.length;
    return variance;
  };

  const corrVariance = calcVariance(corrL);
  const uncorrVariance = calcVariance(uncorrL);

  console.log(`  Lightness step variance:`);
  console.log(`    Corrected: ${corrVariance.toFixed(8)}`);
  console.log(`    Uncorrected: ${uncorrVariance.toFixed(8)}`);
  console.log(`    Ratio: ${(corrVariance / uncorrVariance).toFixed(3)}`);

  // Corrected should have lower variance (more even steps)
  assert.ok(corrVariance < uncorrVariance, 'correctLightness should reduce step variance');
});

// ─── Test 9: Performance Benchmark ────────────────────────────────────────────

test('performance: 1000-color ramp generation < 10ms', () => {
  const stops = ['#ff0000', '#ff8800', '#00ff00', '#0000ff'];

  let time1000 = 0;
  let time100 = 0;
  let time10000 = 0;

  time100 = benchmark('100-color ramp', () => {
    rampOklab(stops, 100);
  });

  time1000 = benchmark('1000-color ramp', () => {
    rampOklab(stops, 1000);
  });

  time10000 = benchmark('10000-color ramp', () => {
    rampOklab(stops, 10000);
  });

  assert.ok(time1000 < 10, `1000-color ramp should be < 10ms (was ${time1000.toFixed(2)}ms)`);

  // Verify rough linearity: 10x more colors ≈ 10x more time
  const ratio = time10000 / time1000;
  console.log(`  Scaling ratio (10K:1K): ${ratio.toFixed(2)}x`);
  assert.ok(ratio > 5 && ratio < 20, 'generation time should scale roughly linearly');
});

// ─── Test 10: Correctness with correctLightness + benchmark ────────────────

test('performance: correctLightness adds minimal overhead', () => {
  const stops = ['#111111', '#223377', '#ffffff'];

  let timePlain = 0;
  let timeCorrected = 0;

  timePlain = benchmark('1000-color ramp (no correction)', () => {
    rampOklab(stops, 1000, { correctLightness: false });
  });

  timeCorrected = benchmark('1000-color ramp (correctLightness)', () => {
    rampOklab(stops, 1000, { correctLightness: true });
  });

  const overhead = ((timeCorrected - timePlain) / timePlain) * 100;
  console.log(`  correctLightness overhead: ${overhead.toFixed(1)}%`);

  // Bisection adds overhead, but should be reasonable
  assert.ok(timeCorrected < 30, 'even with correction, should be fast');
});

// ─── Test 11: Hue Wrap-Around Correctness ────────────────────────────────────

test('hue wrap-around is handled correctly in interpolation', () => {
  // Create a gradient that crosses the 0°/360° hue boundary
  const stops = ['#ff0000', '#ff00ff']; // red (0°) to magenta (300°)
  const ramp = rampOklab(stops, 21);

  const colors = ramp.map(hex => hexToOklch(hex)!);
  const hues = colors.map(c => c.h);

  // Verify hues don't wildly jump around the boundary
  let wraps = 0;
  for (let i = 1; i < hues.length; i++) {
    const diff = hues[i]! - hues[i - 1]!;
    if (Math.abs(diff) > 180) wraps++;
  }

  console.log(`  Hue boundary wrap-arounds: ${wraps}`);
  // Bezier in OKLCH should handle this smoothly
  assert.ok(wraps <= 1, 'should have minimal wrap-around jumps');
});

// ─── Test 12: Gamut Mapping Verification ──────────────────────────────────────

test('all output colors are valid sRGB hex values', () => {
  const stops = ['#ff0000', '#ff8800', '#00ff00', '#0000ff'];
  const ramp = rampOklab(stops, 100);

  const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

  for (let i = 0; i < ramp.length; i++) {
    const hex = ramp[i]!;
    assert.ok(HEX_PATTERN.test(hex), `color ${i}: "${hex}" should be valid hex`);

    // Verify it can be parsed back
    const c = hexToOklch(hex);
    assert.ok(c, `color ${i}: "${hex}" should be parseable`);
    assert.ok(Number.isFinite(c.l) && Number.isFinite(c.c) && Number.isFinite(c.h),
      `color ${i}: all components should be finite`);
  }

  console.log(`  All 100 colors verified as valid, parseable sRGB hex`);
});

// ─── Test 13: Consistency with hooks ──────────────────────────────────────────

test('rampOklab is deterministic (same input → same output)', () => {
  const stops = ['#ff0000', '#ff8800', '#00ff00', '#0000ff'];

  const ramp1 = rampOklab(stops, 100);
  const ramp2 = rampOklab(stops, 100);
  const ramp3 = rampOklab(stops, 100, { correctLightness: false });

  assert.deepEqual(ramp1, ramp2, 'multiple calls should produce identical results');
  assert.deepEqual(ramp1, ramp3, 'non-corrected default should be deterministic');

  console.log(`  Determinism verified across repeated calls`);
});
