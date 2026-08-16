// SPDX-License-Identifier: MPL-2.0
/**
 * engine/src/gainmap.ts - ISO 21496-1 / Adobe gain-map math (deeprichpixels B2, task F1).
 *
 * The claim under test is exactly one sentence: **this map means
 * `hdr = sdr * 2^lerp(min, max, t)`**, computed in one stated colour space, over
 * float input that is allowed to be negative or damaged. Every test below is
 * either a proof of that sentence or a negative control against a way of getting
 * it wrong:
 *
 *   - ROUND TRIP: a real `hdrViewTransform` HDR rendition is reconstructed from
 *     the SDR frame + the 8-bit map, to a tolerance derived from the quantiser
 *     (not hand-picked).
 *   - SPACE ALIGNMENT: an unboosted saturated red must yield a NEUTRAL gain. The
 *     counterfactual (the same reduction without the space conversion) is
 *     computed inline and asserted to be materially wrong, so the test fails if
 *     the conversion is ever dropped.
 *   - NEGATIVE / NaN: the float view transform does not clamp, so log2 of a
 *     negative would be NaN. The policy is asserted directly.
 *   - DEGENERATE: a flat image produces a valid constant map with no division by
 *     zero, and still round-trips.
 *   - META: the spec ranges hold.
 *   - NEGATIVE CONTROL: a different HDR target changes the map bytes.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/gainmap.test.ts
 * NOTE: console output stays ASCII-first (see color-ramp.test.ts header).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeGainMap, applyGainMap, gainMapWeight, GAIN_MAP_SPACE,
  type GainMapMeta,
} from '../engine/src/gainmap.ts';
import { convertSpace, fromU8Srgb, createDeepFrame, type DeepFrame } from '../engine/src/pixels.ts';
import { hdrViewTransform, type HdrBoostOptions } from '../engine/src/hdr.ts';

// ─── fixtures ─────────────────────────────────────────────────────────────────

// deterministic PRNG (no Math.random anywhere in the suite)
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A frame from a list of RGBA quads (1 row), in the given space. */
const frameOf = (px: number[][], space: DeepFrame['space'] = 'srgb-linear'): DeepFrame => ({
  width: px.length, height: 1, data: Float32Array.from(px.flat()), space,
});

/** 24x8 sRGB noise + a swatch row: white, brand-ish colours, black, saturated primaries. */
function sdrNoiseFrame(): DeepFrame {
  const rnd = mulberry32(0xbeef);
  const w = 24, h = 8;
  const px = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < px.length; i += 4) {
    px[i] = Math.floor(rnd() * 256);
    px[i + 1] = Math.floor(rnd() * 256);
    px[i + 2] = Math.floor(rnd() * 256);
    px[i + 3] = 255;
  }
  // first row: deliberate swatches incl. the boost targets and pure black
  const swatch = [
    [255, 255, 255], [48, 186, 120], [0, 0, 0], [255, 0, 0], [0, 255, 0],
    [0, 0, 255], [128, 128, 128], [12, 12, 12],
  ];
  for (let x = 0; x < swatch.length; x++) {
    px[x * 4] = swatch[x]![0]!;
    px[x * 4 + 1] = swatch[x]![1]!;
    px[x * 4 + 2] = swatch[x]![2]!;
    px[x * 4 + 3] = 255;
  }
  return fromU8Srgb(px, w, h);
}

const BOOST: HdrBoostOptions = {
  targets: ['#30ba78', '#ffffff'],
  // richness 0 makes the view transform a per-pixel SCALAR, which is exactly
  // what a single-channel (luminance) gain map can represent. The richness > 0
  // case is measured in its own test below.
  richness: 0,
};

const BT2020_LUMA = [0.2627, 0.678, 0.0593] as const;
const lum2020 = (r: number, g: number, b: number): number =>
  r * BT2020_LUMA[0] + g * BT2020_LUMA[1] + b * BT2020_LUMA[2];

// ─── round trip ───────────────────────────────────────────────────────────────

test('round trip: SDR + gain map reconstructs the hdrViewTransform rendition', () => {
  const sdr = sdrNoiseFrame();
  const hdr = hdrViewTransform(sdr, BOOST);
  const { map, meta, stats, width, height } = computeGainMap(sdr, hdr);

  assert.equal(map.length, width * height, 'single channel: one byte per pixel');
  assert.ok(map.every((v) => Number.isInteger(v) && v >= 0 && v <= 255), 'map is 0..255 integers');
  assert.equal(meta.channels, 1);

  // The decode must be run in the space the map was computed in for the offset
  // terms to line up; with the default zero offsets it is space-agnostic (see
  // the commutation test below).
  const base = convertSpace(sdr, GAIN_MAP_SPACE);
  const got = applyGainMap(base, map, meta);
  assert.equal(got.space, GAIN_MAP_SPACE);

  // TOLERANCE, derived not chosen: the only lossy step is quantising the log2
  // gain to 256 levels over [min, max], so the worst-case log2 error is half a
  // step = span/510, i.e. a relative error of 2^(span/510) - 1. A small absolute
  // floor covers near-black pixels (where relative error is meaningless) and the
  // float32 storage of both frames.
  const span = meta.gainMapMax - meta.gainMapMin;
  const relTol = 2 ** (span / 510) - 1 + 1e-5;
  const absTol = 1e-5;
  let worstRel = 0;
  for (let i = 0; i < hdr.data.length; i++) {
    if (i % 4 === 3) { assert.equal(got.data[i], hdr.data[i], 'alpha untouched'); continue; }
    const want = hdr.data[i]!;
    const err = Math.abs(got.data[i]! - want);
    if (err > absTol) worstRel = Math.max(worstRel, err / Math.abs(want));
    assert.ok(err <= absTol + relTol * Math.abs(want),
      `pixel ${i}: got ${got.data[i]}, want ${want} (err ${err}, tol ${absTol + relTol * Math.abs(want)})`);
  }
  console.log(`[gainmap] round-trip span=${span.toFixed(4)} log2, worst rel err=${(worstRel * 100).toFixed(4)}% (bound ${(relTol * 100).toFixed(4)}%)`);
  assert.ok(stats.undefinedPixels >= 1, 'the pure-black swatch has no defined ratio');
});

test('round trip holds at a non-default gamma (encode pow(t,g) / decode pow(v,1/g))', () => {
  const sdr = sdrNoiseFrame();
  const hdr = hdrViewTransform(sdr, BOOST);
  for (const gamma of [0.5, 1.6]) {
    const { map, meta } = computeGainMap(sdr, hdr, { gamma });
    assert.equal(meta.gamma, gamma);
    const got = applyGainMap(convertSpace(sdr, GAIN_MAP_SPACE), map, meta);
    const span = meta.gainMapMax - meta.gainMapMin;
    // Non-unit gamma redistributes the 256 levels, so the step is no longer
    // uniform in log2 - it stretches at whichever end the gamma curve flattens.
    // The bound is therefore the WIDEST step (not half of it): the encoder
    // rounds by half a level in the gamma-warped domain, which un-warps to
    // nearly a whole step where the curve is steepest. Evaluate the actual
    // quantiser rather than guessing. (This widening is the price of a non-unit
    // gamma and is exactly why the default is 1.)
    let maxStep = 0;
    for (let v = 0; v < 255; v++) {
      const a = (v / 255) ** (1 / gamma), b = ((v + 1) / 255) ** (1 / gamma);
      maxStep = Math.max(maxStep, (b - a) * span);
    }
    const relTol = 2 ** maxStep - 1 + 1e-5;
    for (let i = 0; i < hdr.data.length; i++) {
      if (i % 4 === 3) continue;
      const want = hdr.data[i]!;
      assert.ok(Math.abs(got.data[i]! - want) <= 1e-5 + relTol * Math.abs(want),
        `gamma ${gamma} pixel ${i}: got ${got.data[i]}, want ${want}`);
    }
  }
});

test('richness > 0 is the documented single-channel limitation, not a silent one', () => {
  // The view transform's re-saturation is a per-CHANNEL chroma change; one
  // luminance number cannot carry it. Luminance still round-trips; chroma does
  // not. This test records the size of that, so a future RGB map has a baseline.
  const sdr = sdrNoiseFrame();
  const hdr = hdrViewTransform(sdr, { ...BOOST, richness: 0.4 });
  const { map, meta } = computeGainMap(sdr, hdr);
  const got = applyGainMap(convertSpace(sdr, GAIN_MAP_SPACE), map, meta);
  let worstLum = 0, worstChan = 0;
  for (let i = 0; i < hdr.data.length; i += 4) {
    const yWant = lum2020(hdr.data[i]!, hdr.data[i + 1]!, hdr.data[i + 2]!);
    const yGot = lum2020(got.data[i]!, got.data[i + 1]!, got.data[i + 2]!);
    if (Math.abs(yWant) > 1e-3) worstLum = Math.max(worstLum, Math.abs(yGot - yWant) / Math.abs(yWant));
    // Measured only on channels carrying real light: a channel near (or below)
    // zero has no meaningful relative error, and re-saturation pushes some of
    // them across zero, which would report as a nonsense multiple.
    for (let c = 0; c < 3; c++) {
      const w = hdr.data[i + c]!;
      if (w > 0.05) worstChan = Math.max(worstChan, Math.abs(got.data[i + c]! - w) / w);
    }
  }
  console.log(`[gainmap] richness=0.4: worst luminance err ${(worstLum * 100).toFixed(3)}%, worst channel err ${(worstChan * 100).toFixed(3)}%`);
  assert.ok(worstLum < 0.01, `luminance is still carried exactly (got ${worstLum})`);
  assert.ok(worstChan > worstLum, 'chroma error is the part a single-channel map drops');
});

// ─── space alignment ──────────────────────────────────────────────────────────

test('space alignment: an unboosted saturated red gets a NEUTRAL gain, not a coloured one', () => {
  // sRGB red, in gamut for both sRGB and Rec.2020. With no boost targets the HDR
  // rendition is the SAME light, just expressed in Rec.2020 primaries - so the
  // gain must be 1 (log2 0) everywhere.
  const sdr = frameOf([[1, 0, 0, 1], [0, 1, 0, 1], [0, 0, 1, 1], [1, 1, 1, 1]]);
  const flat: HdrBoostOptions = { targets: [], includeWhite: false, richness: 0 };
  const hdr = hdrViewTransform(sdr, flat);
  assert.equal(hdr.space, GAIN_MAP_SPACE, 'the view transform is the rec2020-linear side');

  const { meta, stats } = computeGainMap(sdr, hdr);
  assert.ok(Math.abs(meta.gainMapMin) < 1e-4 && Math.abs(meta.gainMapMax) < 1e-4,
    `neutral gain expected, got [${meta.gainMapMin}, ${meta.gainMapMax}]`);
  assert.equal(stats.undefinedPixels, 0);

  // COUNTERFACTUAL: the same luminance reduction WITHOUT converting the SDR side
  // (i.e. BT.2020 coefficients applied to sRGB-linear channels) is what the bug
  // looks like. It must be materially wrong, or this test proves nothing.
  const s = sdr.data, h = hdr.data;
  let worstWrong = 0;
  for (let i = 0; i < s.length; i += 4) {
    const ysWrong = lum2020(s[i]!, s[i + 1]!, s[i + 2]!);
    const yh = lum2020(h[i]!, h[i + 1]!, h[i + 2]!);
    if (ysWrong > 0 && yh > 0) worstWrong = Math.max(worstWrong, Math.abs(Math.log2(yh / ysWrong)));
  }
  console.log(`[gainmap] unconverted-SDR counterfactual would encode up to ${worstWrong.toFixed(3)} log2 of bogus gain`);
  assert.ok(worstWrong > 0.25, `the counterfactual must be clearly wrong (got ${worstWrong})`);

  // and the round trip of the neutral map is the identity
  const got = applyGainMap(convertSpace(sdr, GAIN_MAP_SPACE), computeGainMap(sdr, hdr).map, meta);
  for (let i = 0; i < h.length; i++) {
    assert.ok(Math.abs(got.data[i]! - h[i]!) <= 1e-6, `neutral identity at ${i}`);
  }
});

// ─── negative / non-finite policy ─────────────────────────────────────────────

test('negative and non-finite input: no NaN escapes, and the fit is not poisoned', () => {
  // hdrViewTransform deliberately does not clamp (plan 9b), so both sides can go
  // negative; a damaged upstream can produce NaN/Infinity.
  const sdr = frameOf([
    [-0.4, -0.2, -0.1, 1],           // fully negative (out-of-gamut excursion)
    [1, -0.05, 0.2, 1],              // in-gamut luminance, one negative channel
    [Number.NaN, 0.5, 0.5, 1],       // damage
    [0.5, 0.5, 0.5, 1],              // a normal pixel to anchor the fit
  ], GAIN_MAP_SPACE);
  const hdr = frameOf([
    [-0.8, -0.4, -0.2, 1],
    [2, -0.1, 0.4, 1],
    [Number.POSITIVE_INFINITY, 1, 1, 1],
    [1, 1, 1, 1],
  ], GAIN_MAP_SPACE);

  const { map, meta, stats } = computeGainMap(sdr, hdr);
  assert.ok(map.every((v) => Number.isFinite(v)), 'no NaN in the map');
  for (const [k, v] of Object.entries(meta)) {
    if (typeof v === 'number') assert.ok(Number.isFinite(v), `meta.${k} is finite (got ${v})`);
  }
  assert.equal(stats.nonFinitePixels, 1, 'the damaged pixel is counted, not hidden');
  // Pixel 0's luminance is negative on both sides -> clamped to 0 -> undefined
  // (zero offsets) -> neutral, excluded from the fit.
  assert.ok(stats.undefinedPixels >= 1);
  // Pixel 3 is a clean 2x, and the fitted max must reflect it rather than some
  // NaN-derived garbage: log2(1 / 0.5) = 1.
  assert.ok(Math.abs(meta.gainMapMax - 1) < 1e-6, `fit survived the damage, got ${meta.gainMapMax}`);
  assert.ok(meta.gainMapMin <= meta.gainMapMax);

  // decode produces no NaN either
  const got = applyGainMap(sdr, map, meta);
  assert.ok(got.data.every((v) => Number.isFinite(v)), 'no NaN out of the decoder');
});

test('a gain map cannot create light where the base has none', () => {
  // The decode is multiplicative, so a black base pixel stays black whatever the
  // map says. That is a property, not a bug - it is asserted so nobody later
  // "fixes" the undefined-pixel policy by inventing a gain.
  const sdr = frameOf([[0, 0, 0, 1], [0.5, 0.5, 0.5, 1]], GAIN_MAP_SPACE);
  const hdr = frameOf([[3, 3, 3, 1], [1, 1, 1, 1]], GAIN_MAP_SPACE);
  const { map, meta, stats } = computeGainMap(sdr, hdr);
  assert.equal(stats.undefinedPixels, 1);
  const got = applyGainMap(sdr, map, meta);
  assert.equal(got.data[0], 0, 'black base decodes to black');
  assert.ok(Math.abs(got.data[4]! - 1) < 1e-3, 'the defined pixel still reaches its target');
});

// ─── degenerate / flat ────────────────────────────────────────────────────────

test('flat image: degenerate-but-valid map (min == max), no division by zero', () => {
  const sdr = createDeepFrame(4, 2, GAIN_MAP_SPACE);
  sdr.data.fill(0.25);
  for (let i = 3; i < sdr.data.length; i += 4) sdr.data[i] = 1;
  const hdr = { ...sdr, data: Float32Array.from(sdr.data) };
  for (let i = 0; i < hdr.data.length; i++) if (i % 4 !== 3) hdr.data[i]! *= 2;

  const { map, meta, stats } = computeGainMap(sdr, hdr);
  assert.equal(stats.degenerate, true);
  assert.ok(Math.abs(meta.gainMapMin - 1) < 1e-6 && Math.abs(meta.gainMapMax - 1) < 1e-6, 'log2(2) = 1 on both ends');
  assert.ok(map.every((v) => v === 255), 'constant map');
  const got = applyGainMap(sdr, map, meta);
  for (let i = 0; i < got.data.length; i++) {
    assert.ok(Math.abs(got.data[i]! - hdr.data[i]!) < 1e-6, `flat round trip at ${i}`);
  }
});

test('all-black image: no samples to fit, neutral map, nothing throws', () => {
  const sdr = createDeepFrame(3, 3, GAIN_MAP_SPACE);
  const hdr = createDeepFrame(3, 3, GAIN_MAP_SPACE);
  const { map, meta, stats } = computeGainMap(sdr, hdr);
  assert.equal(stats.undefinedPixels, 9);
  assert.equal(stats.degenerate, true);
  assert.equal(meta.gainMapMin, 0);
  assert.equal(meta.gainMapMax, 0);
  assert.equal(meta.hdrCapacityMax, 0);
  const got = applyGainMap(sdr, map, meta);
  assert.ok(got.data.every((v) => v === 0));
});

// ─── metadata ─────────────────────────────────────────────────────────────────

test('meta fields sit in spec ranges', () => {
  const sdr = sdrNoiseFrame();
  const hdr = hdrViewTransform(sdr, BOOST);
  const { meta } = computeGainMap(sdr, hdr);
  assert.equal(meta.channels, 1, 'single-channel/luminance map (documented choice)');
  assert.equal(meta.baseRendition, 'sdr');
  assert.equal(meta.useBaseColorSpace, true);
  assert.ok(meta.gainMapMin <= meta.gainMapMax, 'min <= max');
  assert.ok(meta.gamma > 0, 'gamma > 0');
  assert.ok(meta.offsetSdr >= 0 && meta.offsetHdr >= 0, 'offsets >= 0');
  assert.equal(meta.offsetSdr, 0, 'default offsets are 0 (see the module header)');
  assert.ok(meta.hdrCapacityMin >= 0, 'HDRCapacityMin >= 0');
  assert.ok(meta.hdrCapacityMax >= meta.hdrCapacityMin, 'capacity range is ordered');
  // The white/brand boost tops out at peakNits/sdrWhiteNits = 1000/203 -> log2 ~ 2.30.
  const ceiling = Math.log2(1000 / 203);
  assert.ok(meta.gainMapMax <= ceiling + 1e-3, `max gain within the transform's ceiling (${meta.gainMapMax} vs ${ceiling})`);
  assert.ok(meta.gainMapMax > 1, 'and the brand boost really is in there');
  assert.ok(Math.abs(meta.hdrCapacityMax - Math.max(meta.gainMapMax, 0)) < 1e-12);
});

// REGRESSION (adversarial review, 2026-07-31): the degenerate branch used to
// return 1 for `hr >= hi`, so a meta with hdrCapacityMin == hdrCapacityMax == 0
// applied the FULL gain on a display with no headroom -- breaking the format's
// one promise, that it degrades to the plain SDR image.
test('weight: a degenerate capacity range still gives an SDR display the base back', () => {
  const meta = {
    channels: 1 as const, gainMapMin: 0, gainMapMax: 0, gamma: 1,
    offsetSdr: 0, offsetHdr: 0, hdrCapacityMin: 0, hdrCapacityMax: 0,
    baseRendition: 'sdr' as const, useBaseColorSpace: true,
  };
  assert.equal(gainMapWeight(meta, 0), 0, 'SDR display (hr == lo == hi) must get NO gain');
  assert.equal(gainMapWeight(meta, -1), 0, 'below the threshold is still no gain');
  assert.equal(gainMapWeight(meta, 2.3), 1, 'a display past the threshold takes the gain');
});

test('weight: SDR display gets the base image back, HDR display gets the full boost', () => {
  const sdr = sdrNoiseFrame();
  const hdr = hdrViewTransform(sdr, BOOST);
  const { map, meta } = computeGainMap(sdr, hdr);
  const base = convertSpace(sdr, GAIN_MAP_SPACE);

  assert.equal(gainMapWeight(meta, 0), 0, 'no headroom -> no gain');
  assert.equal(gainMapWeight(meta, meta.hdrCapacityMax), 1, 'full headroom -> full gain');
  assert.ok(Math.abs(gainMapWeight(meta, meta.hdrCapacityMax / 2) - 0.5) < 1e-12, 'linear in log2 headroom');
  assert.equal(gainMapWeight(meta, Number.NaN), 0, 'damaged headroom is not full application');

  const sdrView = applyGainMap(base, map, meta, { weight: 0 });
  for (let i = 0; i < base.data.length; i++) {
    assert.ok(Math.abs(sdrView.data[i]! - base.data[i]!) < 1e-6, `weight 0 is the identity at ${i}`);
  }
  // half weight lands between the two renditions, monotonically
  const half = applyGainMap(base, map, meta, { weight: 0.5 });
  const full = applyGainMap(base, map, meta, { weight: 1 });
  let boosted = 0;
  for (let i = 0; i < base.data.length; i += 4) {
    const lo = base.data[i]!, mid = half.data[i]!, hi = full.data[i]!;
    if (hi > lo + 1e-4) {
      boosted++;
      assert.ok(mid > lo - 1e-6 && mid < hi + 1e-6, `half weight is between at ${i}: ${lo} / ${mid} / ${hi}`);
    }
  }
  assert.ok(boosted > 0, 'some pixels really were boosted');
});

// ─── commutation, offsets ─────────────────────────────────────────────────────

test('at offset 0 the gain is a scalar, so it commutes with a space conversion', () => {
  const sdr = sdrNoiseFrame();
  const hdr = hdrViewTransform(sdr, BOOST);
  const { map, meta } = computeGainMap(sdr, hdr);
  const a = convertSpace(applyGainMap(sdr, map, meta), GAIN_MAP_SPACE); // apply in srgb-linear, then convert
  const b = applyGainMap(convertSpace(sdr, GAIN_MAP_SPACE), map, meta);  // convert, then apply
  for (let i = 0; i < a.data.length; i++) {
    assert.ok(Math.abs(a.data[i]! - b.data[i]!) <= 1e-6 + 1e-5 * Math.abs(b.data[i]!), `commutes at ${i}`);
  }
});

test('the conventional 1/64 offsets are supported, and cost hue accuracy (why 0 is the default)', () => {
  // One saturated Rec.2020 red at a clean 2x. With zero offsets the decode is
  // exact; with the spec's 1/64 offsets the luminance-carried gain under-applies
  // to a channel that is far from the pixel's own luminance.
  const sdr = frameOf([[1, 0, 0, 1]], GAIN_MAP_SPACE);
  const hdr = frameOf([[2, 0, 0, 1]], GAIN_MAP_SPACE);

  const zero = computeGainMap(sdr, hdr);
  assert.ok(Math.abs(zero.meta.gainMapMax - 1) < 1e-9, 'zero offset: exactly log2(2)');
  const gotZero = applyGainMap(sdr, zero.map, zero.meta);
  assert.ok(Math.abs(gotZero.data[0]! - 2) < 1e-6, `zero offset decodes exactly, got ${gotZero.data[0]}`);

  const off = computeGainMap(sdr, hdr, { offsetSdr: 1 / 64, offsetHdr: 1 / 64 });
  assert.equal(off.meta.offsetSdr, 1 / 64);
  const gotOff = applyGainMap(sdr, off.map, off.meta);
  const err = Math.abs(gotOff.data[0]! - 2) / 2;
  console.log(`[gainmap] 1/64 offsets on a saturated 2x red: ${(err * 100).toFixed(2)}% short`);
  assert.ok(err > 0.01, 'the offset penalty is real (this is why the default is 0)');
  assert.ok(err < 0.1, 'and bounded');
});

// ─── negative controls ────────────────────────────────────────────────────────

test('negative control: a different HDR target changes the map bytes', () => {
  const sdr = sdrNoiseFrame();
  const a = computeGainMap(sdr, hdrViewTransform(sdr, BOOST));
  const b = computeGainMap(sdr, hdrViewTransform(sdr, { ...BOOST, peakNits: 400 }));
  assert.notDeepEqual(Array.from(a.map), Array.from(b.map), 'map bytes must move with the HDR rendition');
  assert.ok(b.meta.gainMapMax < a.meta.gainMapMax - 0.5, 'a lower peak asks for less headroom');

  // ...and a different brand target changes it too (the boost mask moved).
  const c = computeGainMap(sdr, hdrViewTransform(sdr, { ...BOOST, targets: ['#0000ff'] }));
  assert.notDeepEqual(Array.from(a.map), Array.from(c.map), 'map bytes must move with the boost targets');

  // determinism: the same inputs twice give byte-identical maps
  const again = computeGainMap(sdr, hdrViewTransform(sdr, BOOST));
  assert.deepEqual(Array.from(again.map), Array.from(a.map), 'deterministic');
});

test('inputs are not mutated', () => {
  const sdr = sdrNoiseFrame();
  const hdr = hdrViewTransform(sdr, BOOST);
  const sdrCopy = Float32Array.from(sdr.data);
  const hdrCopy = Float32Array.from(hdr.data);
  const { map, meta } = computeGainMap(sdr, hdr);
  applyGainMap(sdr, map, meta);
  assert.deepEqual(Array.from(sdr.data), Array.from(sdrCopy), 'sdr untouched');
  assert.deepEqual(Array.from(hdr.data), Array.from(hdrCopy), 'hdr untouched');
});

test('caller mistakes throw; pixel damage does not', () => {
  const a = createDeepFrame(2, 2, GAIN_MAP_SPACE);
  const b = createDeepFrame(3, 2, GAIN_MAP_SPACE);
  assert.throws(() => computeGainMap(a, b), /size mismatch/);
  assert.throws(() => computeGainMap(a, a, { gamma: 0 }), /gamma/);
  assert.throws(() => computeGainMap(a, a, { gamma: -1 }), /gamma/);
  assert.throws(() => computeGainMap(a, a, { offsetSdr: -0.1 }), /offsets/);
  const meta: GainMapMeta = computeGainMap(a, a).meta;
  assert.throws(() => applyGainMap(a, new Uint8ClampedArray(3), meta), /map length/);
});

test('explicit range override clamps and is reported', () => {
  const sdr = sdrNoiseFrame();
  const hdr = hdrViewTransform(sdr, BOOST);
  const { meta, stats } = computeGainMap(sdr, hdr, { minLog2: 0, maxLog2: 1 });
  assert.equal(meta.gainMapMin, 0);
  assert.equal(meta.gainMapMax, 1);
  assert.ok(stats.clampedPixels > 0, 'pixels outside the forced range are counted');
  // reversed bounds are normalised rather than producing a negative span
  const rev = computeGainMap(sdr, hdr, { minLog2: 1, maxLog2: 0 });
  assert.equal(rev.meta.gainMapMin, 0);
  assert.equal(rev.meta.gainMapMax, 1);
});
