// SPDX-License-Identifier: MPL-2.0
/**
 * solveLightnessForApca (engine/src/color-tools.ts) - APCA inverse-solver contract.
 *
 * The solver inverts the FORWARD-only apcaContrast: given a hue/chroma, a target
 * Lc magnitude and a background, it returns the OKLCH lightness whose forward
 * APCA contrast is closest to the target - fixing polarity from the background
 * first, then bisecting on the single monotonic branch (never across APCA's
 * near-black dip, which flips polarity and is non-monotonic).
 *
 * Coverage:
 *   (1) reachable targets, light bg + dark bg, several hues - forward Lc lands
 *       within tolerance of the requested magnitude, with the correct polarity;
 *   (2) polarity: a dark bg yields a LIGHT text colour (high L) and a light bg a
 *       DARK one (low L) - the naive-bisection failure mode;
 *   (3) an unreachable target beyond the near-black floor - flagged, and the
 *       returned colour is the closest achievable (the contrast maximum);
 *   (4) chroma clamped into gamut; unparseable background handled.
 *
 * NOTE: the first bytes of every console.log line must be ASCII (see the header
 * in color-ramp.test.ts).
 *
 * Run with: node --test tests/apca-solve.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveLightnessForApca, apcaContrast } from '../engine/src/color-tools.ts';

const WHITE = '#ffffff';
const BLACK = '#000000';

// Tolerance on the achieved |Lc| vs the requested magnitude. APCA outputs are on
// a 0..~108 scale; the reachable path is exact by bisection, so a couple of Lc
// points is generous.
const LC_TOL = 1.0;

test('reachable targets on a light background land within tolerance (dark text)', () => {
  const bg = WHITE;
  for (const hue of [30, 145, 265]) {
    for (const chroma of [0.05, 0.15]) {
      for (const target of [45, 60, 75, 90]) {
        const r = solveLightnessForApca(hue, chroma, target, bg);
        assert.equal(r.reachable, true, `target ${target} @ hue ${hue} c ${chroma} should be reachable`);
        // Forward contrast of the SOLVED colour must match the request.
        const fwd = apcaContrast(r.hex, bg);
        assert.ok(Math.abs(Math.abs(fwd) - target) <= LC_TOL,
          `forward |Lc| ${fwd.toFixed(2)} != target ${target} (hue ${hue} c ${chroma})`);
        // Dark-on-light polarity is positive.
        assert.ok(fwd > 0, `expected positive Lc on a light bg, got ${fwd}`);
        // Reported lc agrees with a fresh forward evaluation.
        assert.ok(Math.abs(r.lc - fwd) < 1e-6, 'reported lc must equal forward apcaContrast');
      }
    }
  }
});

test('reachable targets on a dark background land within tolerance (light text)', () => {
  const bg = '#101014';
  for (const hue of [30, 200, 320]) {
    for (const target of [45, 60, 75]) {
      const r = solveLightnessForApca(hue, 0.1, target, bg);
      assert.equal(r.reachable, true, `target ${target} @ hue ${hue} should be reachable on dark bg`);
      const fwd = apcaContrast(r.hex, bg);
      assert.ok(Math.abs(Math.abs(fwd) - target) <= LC_TOL,
        `forward |Lc| ${fwd.toFixed(2)} != target ${target} (hue ${hue})`);
      // Light-on-dark polarity is negative.
      assert.ok(fwd < 0, `expected negative Lc on a dark bg, got ${fwd}`);
    }
  }
});

test('polarity is fixed from the background, not from a whole-range bisection', () => {
  // Dark bg -> the solver must reach for a LIGHT colour (high L), and the signed
  // target it commits to must be negative.
  const dark = solveLightnessForApca(210, 0.08, 70, '#0b0b10');
  assert.ok(dark.l > 0.6, `dark bg should yield a light text L, got ${dark.l}`);
  assert.ok(dark.target < 0, 'signed target on a dark bg must be negative');

  // Light bg -> a DARKER colour than the dark-bg case, and a positive target.
  const light = solveLightnessForApca(210, 0.08, 70, WHITE);
  assert.ok(light.target > 0, 'signed target on a light bg must be positive');
  assert.ok(light.l < dark.l,
    `light bg text (L=${light.l}) must be darker than dark bg text (L=${dark.l})`);
  assert.ok(light.l < 0.7, `light bg should still yield reasonably dark text, got ${light.l}`);

  // Passing a NEGATIVE targetLc is the same request as its magnitude - the
  // background, not the sign of the argument, decides polarity.
  const asNeg = solveLightnessForApca(210, 0.08, -70, WHITE);
  assert.ok(Math.abs(asNeg.l - light.l) < 1e-9, 'sign of targetLc must not change the solution');
});

test('an unreachable target past the near-black floor is flagged and returns the closest achievable', () => {
  const bg = WHITE;
  // Black text on white is the ceiling for this background; APCA caps around ~106
  // and the soft black clamp actually bends contrast back down for near-black, so
  // a target above the ceiling cannot be met at any lightness.
  const ceiling = Math.abs(apcaContrast(BLACK, bg));
  const target = ceiling + 12; // safely past the floor/ceiling
  const r = solveLightnessForApca(0, 0.0, target, bg);
  assert.equal(r.reachable, false, 'a target past the ceiling must be flagged unreachable');
  const achieved = Math.abs(apcaContrast(r.hex, bg));
  // Closest achievable: no lightness does meaningfully better than what we return.
  for (let L = 0; L <= 1.0001; L += 0.02) {
    // Reconstruct a same-hue grey and check none beats the returned colour by more
    // than the scan resolution's worth of Lc.
    const probe = Math.abs(apcaContrast(greyHex(L), bg));
    assert.ok(probe <= achieved + 0.5,
      `found L=${L.toFixed(2)} with |Lc| ${probe.toFixed(2)} > returned ${achieved.toFixed(2)}`);
  }
  // And the returned max must be below the requested (that is WHY it is unreachable).
  assert.ok(achieved < target, 'achieved contrast must fall short of an unreachable target');
});

test('a mid target near the near-black region still picks the correct branch', () => {
  // A moderate target on white: the near-black side of the peak ALSO passes
  // through this contrast, but the solver must return the gentle (higher-L) side.
  const bg = WHITE;
  const r = solveLightnessForApca(0, 0.0, 60, bg);
  assert.equal(r.reachable, true);
  const fwd = apcaContrast(r.hex, bg);
  assert.ok(Math.abs(fwd - 60) <= LC_TOL, `forward Lc ${fwd} != 60`);
  // Gentle side: not jammed against black.
  assert.ok(r.l > 0.2, `expected the higher-L branch, got L=${r.l}`);
});

test('chroma is clamped into gamut and an unparseable background is handled', () => {
  // Ask for an absurd chroma; the returned chroma must be finite and <= request.
  const r = solveLightnessForApca(30, 5, 60, WHITE);
  assert.ok(Number.isFinite(r.chroma) && r.chroma >= 0 && r.chroma <= 5,
    `chroma must be gamut-clamped, got ${r.chroma}`);
  assert.ok(HEX6.test(r.hex), `expected a hex colour, got ${r.hex}`);

  const bad = solveLightnessForApca(30, 0.1, 60, 'not-a-color');
  assert.equal(bad.reachable, false, 'unparseable bg -> unreachable');
  assert.ok(Number.isNaN(bad.lc), 'unparseable bg -> NaN lc');
});

// A neutral grey at a given OKLab lightness (chroma 0), for the unreachable probe.
function greyHex(L: number): string {
  const v = Math.round(Math.min(1, Math.max(0, srgbFromOklabL(L))) * 255);
  const hx = v.toString(16).padStart(2, '0');
  return `#${hx}${hx}${hx}`;
}

// OKLab lightness L (0..1) of a grey -> its sRGB channel value (0..1). For a
// neutral, OKLab L is the cube-rooted relative luminance; invert to linear then
// apply the sRGB transfer curve. Only used to sweep greys in the probe above.
function srgbFromOklabL(L: number): number {
  const lin = L * L * L; // grey: l == m == s == L, linear light = L^3
  return lin <= 0.0031308 ? 12.92 * lin : 1.055 * Math.pow(lin, 1 / 2.4) - 0.055;
}

const HEX6 = /^#[0-9a-f]{6}$/i;
