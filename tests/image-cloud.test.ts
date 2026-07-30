// SPDX-License-Identifier: MPL-2.0
/**
 * An image's colours as a point cloud (engine/src/image-cloud.ts).
 *
 * The invariant this file exists to protect is the honesty one: `space` changes
 * the ANSWER, not just a label. The same bytes read as Display-P3 carry more
 * chroma than read as sRGB, and every gamut statistic moves with them. A
 * regression that quietly ignored `space` would leave a plot that still looked
 * plausible and a coverage figure that was simply wrong, so the two readings are
 * compared against each other rather than each against a constant.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { imageColorCloud, UNIQUE_CAP } from '../engine/src/image-cloud.ts';
import { linearSrgbToLinearP3, linearP3ToLinearSrgb } from '../engine/src/gamut-source.ts';
import { hexToOklch } from '../engine/src/brand-derive.ts';

/** An RGBA buffer from a list of [r,g,b,a?] repeated to `n` pixels each. */
function img(pixels: [number, number, number, number?][]): Uint8ClampedArray {
  const d = new Uint8ClampedArray(pixels.length * 4);
  pixels.forEach(([r, g, b, a], i) => {
    d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = a ?? 255;
  });
  return d;
}

test('the P3→sRGB matrix is the exact inverse of its forward twin', () => {
  // The pair is written out by hand in gamut-source.ts rather than inverted at
  // runtime, which is readable but drifts silently. Round-tripping catches that,
  // and it must be checked OUTSIDE the unit cube too — the whole reason the
  // decode exists is colours that land outside sRGB.
  for (const [r, g, b] of [
    [0, 0, 0], [1, 1, 1], [0.5, 0.2, 0.9], [1, 0, 0], [0, 1, 0], [0, 0, 1],
    [1.3, -0.2, 0.4], [-0.05, 1.1, 0.02],
  ] as [number, number, number][]) {
    const back = linearP3ToLinearSrgb(...linearSrgbToLinearP3(r, g, b));
    for (let i = 0; i < 3; i++) {
      assert.ok(Math.abs(back[i]! - [r, g, b][i]!) < 1e-6,
        `round trip ${[r, g, b]} → ${back}`);
    }
  }
  // And the identity direction: pure white maps to itself, since both spaces
  // share D65. A wrong matrix usually shows here first.
  const white = linearP3ToLinearSrgb(1, 1, 1);
  for (const v of white) assert.ok(Math.abs(v - 1) < 1e-6, `white stays white: ${white}`);
});

test('space changes the answer, not just the label', () => {
  // Saturated green: in sRGB it is inside sRGB by definition; the SAME bytes read
  // as Display-P3 are a more chromatic colour that sRGB cannot hold.
  const data = img([[0, 255, 0]]);
  const s = imageColorCloud(data, 1, 1, { space: 'srgb' });
  const p = imageColorCloud(data, 1, 1, { space: 'display-p3' });

  assert.equal(s.space, 'srgb');
  assert.equal(p.space, 'display-p3');
  assert.ok(p.points[0]!.c > s.points[0]!.c + 0.01,
    `P3 reading is more chromatic (${p.points[0]!.c} vs ${s.points[0]!.c})`);
  assert.equal(s.coverage.srgb, 1, 'sRGB bytes are all inside sRGB');
  assert.ok(p.coverage.p3 > 0, 'the P3 reading needs a wider gamut');
  assert.equal(p.coverage.srgb, 0, 'and is NOT inside sRGB');
});

test('transparent pixels are skipped, not counted as black', () => {
  const data = img([[255, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  const cloud = imageColorCloud(data, 3, 1, { space: 'srgb', stride: 1 });
  assert.equal(cloud.sampled, 1);
  assert.equal(cloud.transparent, 2);
  assert.equal(cloud.points.length, 1, 'only the red bucket exists');
  // Counting them as black would drag the mean lightness and invent a colour the
  // image does not contain — a PNG's padding is not its colour.
  assert.ok(cloud.points[0]!.l > 0.4, `the one point is the red, not black (L ${cloud.points[0]!.l})`);
});

test('unique counts colours, points count buckets', () => {
  // Sixteen colours one quantisation step apart collapse into far fewer buckets,
  // but they are still sixteen distinct colours. Conflating the two would make a
  // gradient look like a posterised image.
  const pixels: [number, number, number][] = [];
  for (let i = 0; i < 16; i++) pixels.push([100 + i, 50, 50]);
  const cloud = imageColorCloud(img(pixels), 16, 1, { space: 'srgb', stride: 1 });
  assert.equal(cloud.unique, 16, 'every distinct 8-bit value counted');
  assert.ok(cloud.points.length < 16, `buckets collapse them (${cloud.points.length})`);
  assert.equal(cloud.uniqueCapped, false);
  assert.ok(UNIQUE_CAP > 16);
});

test('points come back heaviest first and are capped', () => {
  const pixels: [number, number, number][] = [];
  for (let i = 0; i < 40; i++) pixels.push([i * 6, 20, 200]);   // 40 spread-out colours
  for (let i = 0; i < 60; i++) pixels.push([250, 250, 250]);    // one heavy bucket
  const cloud = imageColorCloud(img(pixels), pixels.length, 1, { space: 'srgb', stride: 1, maxPoints: 5 });
  assert.equal(cloud.points.length, 5, 'capped');
  assert.equal(cloud.points[0]!.n, 60, 'the heaviest bucket leads');
  for (let i = 1; i < cloud.points.length; i++) {
    assert.ok(cloud.points[i - 1]!.n >= cloud.points[i]!.n, 'descending by weight');
  }
});

test('a bucket lands on its CENTRE, so a dark image is not dragged darker', () => {
  // Every pixel is mid-grey. Taking the bucket's low corner would place the point
  // half a bucket (4/255) darker than anything in the image.
  const cloud = imageColorCloud(img([[128, 128, 128]]), 1, 1, { space: 'srgb', stride: 1 });
  const point = cloud.points[0]!;
  const exact = hexToOklch('#808080')!;
  assert.ok(Math.abs(point.l - exact.l) < 0.02, `L ${point.l} vs ${exact.l}`);
  assert.ok(point.l >= exact.l - 0.01, 'never biased downward');
});

test('clipped reports channels already at an extreme', () => {
  const cloud = imageColorCloud(
    img([[255, 10, 10], [0, 10, 10], [128, 128, 128], [130, 130, 130]]),
    4, 1, { space: 'srgb', stride: 1 },
  );
  assert.equal(cloud.clipped, 0.5, 'two of four pixels sit on a rail');
});

test('the dominant hue is a sector, and greys do not vote', () => {
  // Mostly neutral with a few strong blues: the blues decide, because a grey has
  // no hue to contribute and averaging it in would pull the answer nowhere in
  // particular.
  const pixels: [number, number, number][] = [];
  for (let i = 0; i < 50; i++) pixels.push([128, 128, 128]);
  for (let i = 0; i < 10; i++) pixels.push([20, 40, 220]);
  const cloud = imageColorCloud(img(pixels), pixels.length, 1, { space: 'srgb', stride: 1 });
  assert.ok(cloud.dominantHue, 'a hue was found');
  const blue = hexToOklch('#1428dc')!.h;
  const d = Math.abs(cloud.dominantHue!.h - blue) % 360;
  assert.ok(Math.min(d, 360 - d) < 30, `dominant ${cloud.dominantHue!.h} near blue ${blue}`);

  const flat = imageColorCloud(img([[128, 128, 128], [60, 60, 60]]), 2, 1, { space: 'srgb', stride: 1 });
  assert.equal(flat.dominantHue, null, 'a greyscale image reports no dominant hue');
});

test('degenerate input does not throw', () => {
  for (const [data, w, h] of [
    [new Uint8ClampedArray(0), 0, 0],
    [new Uint8ClampedArray(4), 1, 1],
    [new Uint8ClampedArray(8), -3, 2],
  ] as [Uint8ClampedArray, number, number][]) {
    const cloud = imageColorCloud(data, w, h, { space: 'srgb' });
    assert.ok(Number.isFinite(cloud.meanChroma));
    assert.ok(Array.isArray(cloud.points));
  }
  // An empty image has no dominant anything, and every share is 0 rather than NaN.
  const empty = imageColorCloud(new Uint8ClampedArray(0), 0, 0, { space: 'srgb' });
  assert.equal(empty.clipped, 0);
  assert.equal(empty.coverage.srgb, 0);
  assert.equal(empty.dominantHue, null);
});

/**
 * The false-positive that shipped in the first draft of this feature.
 *
 * An ordinary sRGB image read through a Display-P3 canvas comes back with every
 * pixel re-encoded at 8 bits into P3's primaries, and that round trip does not
 * land where it started. Classified naively, ~5% of the sRGB cube reads as
 * "beyond sRGB" — and the Lab printed "7.4% of this image is beyond sRGB" about a
 * test file with nothing beyond sRGB in it.
 *
 * This is the guard. Reverting GAMUT_SLOP to 0 must fail it.
 */
test('an sRGB image read through a P3 encoding is not reported as wide-gamut', async () => {
  const { linearSrgbToLinearP3 } = await import('../engine/src/gamut-source.ts');
  const { srgbToLinear, linearToSrgb } = await import('../engine/src/brand-derive.ts');

  // A saturated sweep — the worst case, since these sit ON the sRGB boundary
  // where half the quantisation errors round outward.
  const src: [number, number, number][] = [];
  for (let i = 0; i < 256; i += 4) {
    src.push([255, i, 0], [i, 255, 0], [0, 255, i], [0, i, 255], [255, 0, i], [i, 0, 255]);
  }
  // Encode each into 8-bit Display-P3, exactly as a canvas would.
  const encoded = src.map(([r, g, b]) => {
    const p3 = linearSrgbToLinearP3(srgbToLinear(r / 255), srgbToLinear(g / 255), srgbToLinear(b / 255));
    return p3.map(v => Math.round(Math.min(1, Math.max(0, linearToSrgb(v))) * 255)) as [number, number, number];
  });

  const cloud = imageColorCloud(img(encoded), encoded.length, 1, { space: 'display-p3', stride: 1 });
  assert.ok(cloud.coverage.srgb > 0.98,
    `sRGB colours stay sRGB (${(cloud.coverage.srgb * 100).toFixed(1)}% classified sRGB)`);
  assert.ok(cloud.coverage.p3 < 0.02,
    `and are not reported as needing P3 (${(cloud.coverage.p3 * 100).toFixed(1)}%)`);
});

test('a genuinely wide colour is still reported as wide', () => {
  // Anti-vacuity for the guard above: the slop must not be big enough to swallow
  // a real out-of-sRGB colour. P3's own green primary is as far outside as an
  // image can get on that surface.
  const cloud = imageColorCloud(img([[0, 255, 0]]), 1, 1, { space: 'display-p3', stride: 1 });
  assert.equal(cloud.coverage.p3, 1, 'P3 primary green needs P3');
  assert.equal(cloud.coverage.srgb, 0);
});
