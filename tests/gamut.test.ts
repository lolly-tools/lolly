/**
 * Display-gamut classification (engine/src/gamut.ts) — the sRGB / Display-P3 /
 * Rec.2020 boundaries the brand studio's OKLCH slice charts draw.
 *
 * The invariants that matter:
 *   (1) every sRGB colour classifies as 'srgb' (the whole 8-bit cube, sampled)
 *   (2) the gamuts nest — srgb ⊂ p3 ⊂ rec2020 — at every lightness and hue
 *   (3) maxChroma agrees with oklchGamut on both sides of the boundary it finds
 *   (4) the boundary is hue-dependent in the way real displays are (P3's big
 *       win is in the reds/greens, barely anything in the blues)
 *   (5) degenerate input (NaN, negative chroma, l outside [0,1]) returns 'none'
 *       rather than throwing or silently clamping
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { oklchGamut, gamutWithin, maxChroma, GAMUTS } from '../engine/src/gamut.ts';
import { hexToOklch, oklchToHex } from '../engine/src/brand-derive.ts';

test('every sRGB colour classifies as srgb', () => {
  // The corners and edge midpoints of the cube, plus a deterministic sweep.
  const corners = ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff',
    '#ffff00', '#00ffff', '#ff00ff', '#808080', '#7f00ff', '#00ff7f'];
  for (const hex of corners) {
    const o = hexToOklch(hex);
    assert.ok(o, `${hex} parses`);
    assert.equal(oklchGamut(o.l, o.c, o.h), 'srgb', `${hex} is in sRGB`);
  }
  for (let r = 0; r <= 255; r += 51) {
    for (let g = 0; g <= 255; g += 51) {
      for (let b = 0; b <= 255; b += 51) {
        const hex = `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
        const o = hexToOklch(hex)!;
        assert.equal(oklchGamut(o.l, o.c, o.h), 'srgb', `${hex} is in sRGB`);
      }
    }
  }
});

test('the gamuts nest: anything in a narrower one is in every wider one', () => {
  for (let l = 0.05; l < 1; l += 0.05) {
    for (let h = 0; h < 360; h += 15) {
      for (let c = 0; c <= 0.45; c += 0.03) {
        const g = oklchGamut(l, c, h);
        if (g === 'none') continue;
        for (const wider of GAMUTS.slice(GAMUTS.indexOf(g))) {
          assert.ok(gamutWithin(g, wider), `${g} should be within ${wider}`);
        }
      }
    }
  }
});

test('a colour is in exactly one narrowest gamut, and it only widens with chroma', () => {
  // Walking chroma outward at a fixed L/H must never move to a NARROWER gamut.
  for (const h of [0, 60, 120, 180, 240, 300]) {
    let seen = 0;
    for (let c = 0; c <= 0.5; c += 0.005) {
      const g = oklchGamut(0.6, c, h);
      const rank = g === 'none' ? GAMUTS.length : GAMUTS.indexOf(g);
      assert.ok(rank >= seen, `hue ${h}: chroma ${c.toFixed(3)} narrowed from rank ${seen} to ${rank}`);
      seen = rank;
    }
    assert.equal(seen, GAMUTS.length, `hue ${h} eventually leaves Rec.2020`);
  }
});

test('maxChroma brackets the boundary it reports', () => {
  const slack = 2e-3; // the bisection tolerance, with room for float noise
  for (const limit of GAMUTS) {
    for (let step = 1; step <= 9; step++) {
      const l = step / 10;
      for (let h = 0; h < 360; h += 30) {
        const max = maxChroma(l, h, limit);
        assert.ok(max > 0, `${limit} @ L${l.toFixed(1)} H${h} has some chroma`);
        assert.ok(gamutWithin(oklchGamut(l, max, h), limit),
          `${limit} @ L${l.toFixed(1)} H${h}: ${max} should be inside`);
        assert.ok(!gamutWithin(oklchGamut(l, max + slack, h), limit),
          `${limit} @ L${l.toFixed(1)} H${h}: ${max + slack} should be outside`);
      }
    }
  }
});

test('maxChroma is monotonic across the gamuts and matches oklchToHex on sRGB', () => {
  for (let h = 0; h < 360; h += 20) {
    const s = maxChroma(0.65, h, 'srgb');
    const p = maxChroma(0.65, h, 'p3');
    const r = maxChroma(0.65, h, 'rec2020');
    assert.ok(s <= p && p <= r, `hue ${h}: ${s} <= ${p} <= ${r}`);
    // The sRGB ceiling is the point brand-derive's mapper stops reducing chroma:
    // just inside round-trips, just outside comes back with less.
    const inside = hexToOklch(oklchToHex({ l: 0.65, c: s - 0.005, h }))!;
    assert.ok(inside.c > s - 0.02, `hue ${h}: in-gamut chroma survives the round trip`);
    const outside = hexToOklch(oklchToHex({ l: 0.65, c: r, h }))!;
    assert.ok(outside.c < r, `hue ${h}: out-of-sRGB chroma is reduced`);
  }
});

test('P3 widens the reds and greens far more than the blues', () => {
  // The reason the chart is worth drawing: the P3 gain is not uniform, so
  // "use P3" is a per-hue decision. Yellow-green ~145° and red ~30° gain
  // heavily; blue ~264° barely moves because P3 shares sRGB's blue primary
  // more closely than its red/green ones.
  const gain = (h: number): number => maxChroma(0.7, h, 'p3') / maxChroma(0.7, h, 'srgb');
  assert.ok(gain(30) > 1.2, `red gains: ${gain(30)}`);
  assert.ok(gain(145) > 1.2, `green gains: ${gain(145)}`);
  assert.ok(gain(264) < 1.12, `blue barely gains: ${gain(264)}`);
});

test('degenerate input returns none instead of throwing', () => {
  for (const [l, c, h] of [
    [NaN, 0.1, 100], [0.5, NaN, 100], [0.5, 0.1, NaN],
    [-0.1, 0.1, 100], [1.2, 0.1, 100], [0.5, -0.1, 100],
    [Infinity, 0.1, 100], [0.5, Infinity, 100],
  ] as const) {
    assert.equal(oklchGamut(l, c, h), 'none', `oklchGamut(${l}, ${c}, ${h})`);
  }
  assert.equal(gamutWithin('none', 'rec2020'), false);
  // No chroma exists at or past the lightness extremes.
  assert.equal(maxChroma(0, 100), 0);
  assert.equal(maxChroma(1, 100), 0);
  assert.equal(maxChroma(0.5, NaN), 0);
});
