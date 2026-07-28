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
import {
  oklchGamut, gamutWithin, maxChroma, oklchSlice, sliceGamutEdge, GAMUTS,
} from '../engine/src/gamut.ts';
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

// ─── Slice planes ─────────────────────────────────────────────────────────────

/** RGBA at (x, y) of a slice, top-row-first. */
const px = (s: ReturnType<typeof oklchSlice>, x: number, y: number): [number, number, number, number] => {
  const o = (y * s.width + x) * 4;
  return [s.data[o] as number, s.data[o + 1] as number, s.data[o + 2] as number, s.data[o + 3] as number];
};

test('a slice is a correctly sized RGBA buffer with the axes the doc claims', () => {
  const s = oklchSlice({ plane: 'lc', fixed: 145, width: 64, height: 40 });
  assert.equal(s.width, 64);
  assert.equal(s.height, 40);
  assert.equal(s.data.length, 64 * 40 * 4);

  // 'lc': y is lightness with 1 at the TOP, x is chroma from 0 at the LEFT.
  // So the left column is the grey axis, bright at the top and dark at the bottom.
  const top = px(s, 0, 0);
  const bottom = px(s, 0, s.height - 1);
  assert.equal(top[3], 255, 'the grey axis is always in gamut');
  assert.equal(bottom[3], 255);
  assert.ok(top[0] > bottom[0], `top ${top} should be lighter than bottom ${bottom}`);
  assert.ok(Math.abs(top[0] - top[1]) < 3 && Math.abs(top[1] - top[2]) < 3, `chroma 0 is grey: ${top}`);
  // Chroma grows rightward: at mid lightness the far side is more saturated.
  // Measured at the last OPAQUE column — the true right edge is past Rec.2020
  // at this hue and correctly transparent.
  const mid = Math.floor(s.height / 2);
  const spread = (p: readonly number[]): number =>
    Math.max(p[0] as number, p[1] as number, p[2] as number)
    - Math.min(p[0] as number, p[1] as number, p[2] as number);
  let last = 1;
  for (let x = s.width - 1; x > 0; x--) if (px(s, x, mid)[3] === 255) { last = x; break; }
  assert.ok(last > s.width / 4, `the painted region reaches out (last opaque column ${last})`);
  assert.ok(spread(px(s, last, mid)) > spread(px(s, 1, mid)), 'chroma grows to the right');
});

test('slice pixels are transparent exactly where the plane leaves the limit', () => {
  const W = 80, H = 50, cMax = 0.4;
  for (const limit of GAMUTS) {
    const s = oklchSlice({ plane: 'lc', fixed: 30, width: W, height: H, cMax, limit });
    for (let y = 0; y < H; y++) {
      const l = 1 - (y + 0.5) / H;
      for (let x = 0; x < W; x++) {
        const c = ((x + 0.5) / W) * cMax;
        const want = gamutWithin(oklchGamut(l, c, 30), limit);
        assert.equal(s.data[(y * W + x) * 4 + 3] === 255, want,
          `${limit} @ L${l.toFixed(3)} C${c.toFixed(3)}: alpha should be ${want ? 255 : 0}`);
      }
    }
  }
});

test('a wider limit paints a superset of a narrower one', () => {
  const box = { plane: 'ch' as const, fixed: 0.6, width: 90, height: 40 };
  const srgb = oklchSlice({ ...box, limit: 'srgb' });
  const wide = oklchSlice({ ...box, limit: 'rec2020' });
  let extra = 0;
  for (let i = 3; i < srgb.data.length; i += 4) {
    if (srgb.data[i] === 255) assert.equal(wide.data[i], 255, 'sRGB pixel missing from Rec.2020');
    else if (wide.data[i] === 255) extra++;
  }
  assert.ok(extra > 0, 'Rec.2020 should reach colours sRGB cannot');
});

test('in-gamut slice pixels match the engine gamut mapper', () => {
  // The fill is only an approximation OUTSIDE sRGB (a sampled ceiling); inside
  // it must be the real colour, or the chart lies about the colours you can use.
  const s = oklchSlice({ plane: 'lc', fixed: 264, width: 48, height: 32, limit: 'srgb' });
  let checked = 0;
  for (let y = 0; y < s.height; y += 3) {
    const l = 1 - (y + 0.5) / s.height;
    for (let x = 0; x < s.width; x += 3) {
      const c = ((x + 0.5) / s.width) * 0.4;
      if (s.data[(y * s.width + x) * 4 + 3] !== 255) continue;
      const want = oklchToHex({ l, c, h: 264 });
      const got = `#${px(s, x, y).slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join('')}`;
      const wantBytes = [1, 3, 5].map(i => parseInt(want.slice(i, i + 2), 16));
      const gotBytes = px(s, x, y).slice(0, 3);
      for (let k = 0; k < 3; k++) {
        assert.ok(Math.abs((wantBytes[k] as number) - (gotBytes[k] as number)) <= 1,
          `L${l.toFixed(2)} C${c.toFixed(3)}: ${got} should be ${want}`);
      }
      checked++;
    }
  }
  assert.ok(checked > 40, `sampled enough in-gamut pixels (${checked})`);
});

test('every plane is painted, and degenerate sizes do not throw', () => {
  for (const plane of ['lc', 'ch', 'lh'] as const) {
    const fixed = plane === 'lc' ? 200 : plane === 'ch' ? 0.7 : 0.12;
    const s = oklchSlice({ plane, fixed, width: 40, height: 25 });
    const opaque = [...s.data].filter((_, i) => i % 4 === 3 && s.data[i] === 255).length;
    assert.ok(opaque > 100, `${plane} paints something (${opaque} px)`);
  }
  for (const [w, h] of [[0, 0], [-5, 10], [1, 1], [3.7, 2.2]] as [number, number][]) {
    const s = oklchSlice({ plane: 'lc', fixed: 0, width: w, height: h });
    assert.ok(s.width >= 1 && s.height >= 1, `${w}x${h} clamps to at least 1x1`);
    assert.equal(s.data.length, s.width * s.height * 4);
  }
});

test('sliceGamutEdge traces the boundary the slice is transparent past', () => {
  const cMax = 0.4;
  for (const plane of ['lc', 'ch'] as const) {
    const fixed = plane === 'lc' ? 145 : 0.65;
    const pts = sliceGamutEdge(plane, fixed, 'srgb', 40, cMax);
    assert.equal(pts.length, 41, 'steps + 1 points');
    for (const p of pts) {
      assert.ok(p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1, `${JSON.stringify(p)} is in the unit square`);
    }
    // Each point sits ON the boundary: just inside is in sRGB, just outside isn't.
    for (const p of pts.slice(1, -1)) {
      const [l, c, h] = plane === 'lc'
        ? [1 - p.y, p.x * cMax, fixed]
        : [fixed, (1 - p.y) * cMax, p.x * 360];
      if (c < 1e-3) continue; // the achromatic ends have no boundary to straddle
      assert.equal(oklchGamut(l, c * 0.97, h), 'srgb', `inside at ${JSON.stringify(p)}`);
      assert.notEqual(oklchGamut(l, c * 1.03 + 1e-3, h), 'srgb', `outside at ${JSON.stringify(p)}`);
    }
  }
  // 'lh' has no single-valued boundary curve — chroma is constant across it.
  assert.deepEqual(sliceGamutEdge('lh', 0.15), []);
});

test('the sampled fill ceiling lands on the real sRGB boundary', () => {
  // The grid is the one approximation in the painter, and it may only ever
  // affect pixels ALREADY outside sRGB. Read it back the way it is visible: an
  // out-of-sRGB pixel should be painted the boundary colour at its own
  // lightness and hue, i.e. its chroma should equal the exact maxChroma there.
  //
  // Note this is NOT the same colour oklchToHex would give. That mapper applies
  // CSS Color 4's local-MINDE clip, which deliberately overshoots the boundary
  // to keep punch (oklch(0.95 0.25 120) → #dbff00, not #e0ff6f). The chart wants
  // the smooth ridge instead, so the two legitimately differ out of gamut —
  // which is exactly why the boundary is drawn as a line rather than inferred
  // from where the fill stops changing.
  for (const hue of [30, 145, 264, 330]) {
    const s = oklchSlice({ plane: 'lc', fixed: hue, width: 64, height: 64 });
    let checked = 0, worst = 0;
    for (let y = 2; y < 62; y += 2) {
      const l = 1 - (y + 0.5) / 64;
      const ceiling = maxChroma(l, hue, 'srgb');
      for (let x = 0; x < 64; x += 2) {
        const c = ((x + 0.5) / 64) * 0.4;
        if (c <= ceiling + 0.02) continue;        // in gamut (or straddling) — covered above
        if (s.data[(y * 64 + x) * 4 + 3] !== 255) continue; // past Rec.2020, not painted
        const p = px(s, x, y);
        const got = hexToOklch(`#${p.slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join('')}`)!;
        worst = Math.max(worst, Math.abs(got.c - ceiling));
        checked++;
      }
    }
    // Blue (264°) has the narrowest sRGB→Rec.2020 band of the four, so the
    // stride catches fewest pixels there — 15 is still a real sample of it.
    assert.ok(checked > 15, `hue ${hue}: sampled enough out-of-gamut pixels (${checked})`);
    // A JND in OKLab is ~0.02, and this error is pure chroma, so 0.015 is still
    // under the threshold of visibility — and it is the bilinear interpolation
    // error on a 0.016-lightness grid, exactly the size the grid predicts.
    assert.ok(worst < 0.015, `hue ${hue}: worst ceiling error ${worst.toFixed(4)}`);
  }
});
