// SPDX-License-Identifier: MPL-2.0
/**
 * HDR float view transform (deeprichpixels Phase A / plan 5.2) — engine/src/hdr.ts.
 *
 * Two jobs:
 *   1. BYTE-IDENTITY SNAPSHOT of the legacy 8-bit `hdrBoostToPQ` entry. The
 *      sha256 hashes below were captured from the pre-refactor implementation
 *      (2026-07-31) over two deterministic synthetic images x six option sets
 *      covering the whole HdrBoostOptions surface. AVIF HDR exports and their
 *      C2PA hashes depend on this output not moving by a single byte — if this
 *      test fails, the refactor changed the legacy path and must be reverted.
 *   2. The new float path: hdrViewTransform (DeepFrame -> rec2020-linear DeepFrame)
 *      + pqEncodeFrame/pqToU16, with reference-value anchors (BT.2408 203-nit
 *      diffuse white -> PQ signal ~0.5806), monotonicity, full-range u16, and
 *      the whole point of the float seam: >1.0 input is NOT clipped before the
 *      tonescale.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  hdrBoostToPQ, hdrViewTransform, pqEncodeFrame, pqToU16, pqEncode,
  type HdrBoostOptions, type PqImage,
} from '../engine/src/hdr.ts';
import { createDeepFrame, fromU8Srgb, type DeepFrame } from '../engine/src/pixels.ts';

// ─── deterministic synthetic images ──────────────────────────────────────────

// mulberry32 PRNG — deterministic byte noise, no Math.random.
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

// 32x8 RGBA noise (every byte value exercised statistically).
function noiseImage(): Uint8ClampedArray {
  const rnd = mulberry32(0x1234);
  const px = new Uint8ClampedArray(32 * 8 * 4);
  for (let i = 0; i < px.length; i++) px[i] = Math.floor(rnd() * 256);
  return px;
}

// 8 colours x 8px: white, jungle, pine (dark, below the knee), waterhole,
// non-target red, black, semi-transparent grey, low-alpha jungle.
function paletteImage(): Uint8ClampedArray {
  const colors: Array<[number, number, number, number]> = [
    [255, 255, 255, 255], [48, 186, 120, 255], [12, 50, 44, 255], [36, 83, 255, 255],
    [255, 0, 0, 255], [0, 0, 0, 255], [128, 128, 128, 200], [48, 186, 120, 64],
  ];
  const px = new Uint8ClampedArray(colors.length * 8 * 4);
  let i = 0;
  for (const [r, g, b, a] of colors) for (let k = 0; k < 8; k++) { px[i++] = r; px[i++] = g; px[i++] = b; px[i++] = a; }
  return px;
}

// ─── 1. legacy byte-identity snapshot ─────────────────────────────────────────

// Full option-surface coverage: defaults, multi-target no-white, richness +
// custom nits, knee/floor/radii overrides, unparseable targets, maxGain==1.
const SNAPSHOT_CONFIGS: Array<{ opts: HdrBoostOptions; sha256: string }> = [
  { opts: { targets: [] },
    sha256: '80966ecb4f215bb614910e7b70eae3a9e769607cc52637a67cec38db707e5d4d' },
  { opts: { targets: ['#30ba78', '#0c322c', '#2453ff'], includeWhite: false },
    sha256: 'f4dca0ede7685c265db7645f82cc5c7fb37ce7d247aeaf4afd98b473f0ffef8f' },
  { opts: { targets: ['#30ba78'], richness: 0.7, peakNits: 1600, sdrWhiteNits: 100 },
    sha256: '4068822a19355cad74c3738807196b376bad93f22b8e26e024f50fe8b6424025' },
  { opts: { targets: ['#2453ff', '#ffffff'], kneeLo: 0.2, kneeHi: 0.7, boostFloor: 0.25, innerRadius: 0.1, outerRadius: 0.3 },
    sha256: '9160f2cf42781de717d70354cfa9d8e4cf064a70fbdbe1e0bf3098869267c742' },
  { opts: { targets: ['bad', ''], includeWhite: true, richness: 0 },
    sha256: 'dc82d9f00440b9e27bb2d568fe5a6c83c4bb1dc15c3fa7644fb8954b9efd0136' },
  { opts: { targets: ['#30ba78'], peakNits: 203, sdrWhiteNits: 203 },
    sha256: '2b2e9595a1634ce2a3b8839a936d96ff2c109b792651771ff0b66b88ae1e0dbe' },
];

test('hdrBoostToPQ legacy byte path is BYTE-IDENTICAL to the pre-refactor snapshot', () => {
  for (const [ci, { opts, sha256 }] of SNAPSHOT_CONFIGS.entries()) {
    const h = createHash('sha256');
    for (const make of [noiseImage, paletteImage]) {
      const img = make();
      hdrBoostToPQ(img, opts);
      h.update(img);
    }
    assert.equal(h.digest('hex'), sha256, `config ${ci} output drifted — legacy byte path must not change`);
  }
});

// ─── 2. the float view transform ─────────────────────────────────────────────

// One-pixel srgb-linear frame (values are LINEAR light, 1.0 = SDR ref white).
function px1(r: number, g: number, b: number, a = 1): DeepFrame {
  const f = createDeepFrame(1, 1, 'srgb-linear');
  f.data[0] = r; f.data[1] = g; f.data[2] = b; f.data[3] = a;
  return f;
}

test('hdrViewTransform: returns a NEW rec2020-linear frame, alpha passthrough, input untouched', () => {
  const src = px1(0.5, 0.25, 0.125, 0.42);
  const before = [...src.data];
  const out = hdrViewTransform(src, { targets: [], includeWhite: false });
  assert.equal(out.space, 'rec2020-linear');
  assert.notEqual(out.data, src.data, 'fresh buffer');
  assert.deepEqual([...src.data], before, 'input frame not mutated');
  assert.ok(Math.abs(out.data[3]! - 0.42) < 1e-7, 'alpha passthrough');
});

test('hdrViewTransform: sRGB white with no boost stays at 1.0 (SDR reference white) in Rec.2020', () => {
  // Negative control for the matrix: rows of M_709_TO_2020 sum to 1, so
  // R=G=B=1 must land at R=G=B=1 — sRGB white and Rec.2020 white are both D65.
  const out = hdrViewTransform(px1(1, 1, 1), { targets: [], includeWhite: false });
  for (let c = 0; c < 3; c++) assert.ok(Math.abs(out.data[c]! - 1) < 1e-6, `channel ${c} ~1`);
});

test('hdrViewTransform: boosted white exceeds 1.0 — headroom is real linear values, not PQ', () => {
  const out = hdrViewTransform(px1(1, 1, 1), { targets: [] }); // includeWhite default true
  // maxGain = 1000/203 ~ 4.93; white is a full match at full lightness.
  const g = out.data[1]!;
  assert.ok(g > 4.5 && g < 5.2, `boosted white ~4.93x SDR white, got ${g}`);
});

test('hdrViewTransform: >1.0 input passes through un-clipped (the point of the float seam)', () => {
  // Linear 3.0 is already HDR headroom on the way in. Legacy 8-bit could never
  // represent this; the float path must not clamp it before the tonescale.
  const out = hdrViewTransform(px1(3, 3, 3), { targets: [], includeWhite: false });
  for (let c = 0; c < 3; c++) assert.ok(Math.abs(out.data[c]! - 3) < 1e-5, `channel ${c} stays ~3.0, got ${out.data[c]}`);
});
test('hdrViewTransform: monotonic on a neutral ramp through and past 1.0 (DEFAULT opts, boost ON)', () => {
  // Regression: the brand-match mask used to run OKLab on the RAW linear value,
  // so a neutral's distance to the white target moved as it brightened and the
  // transform was NON-monotonic — linear 1.2 came out at 5.9075 while 1.6 came
  // out at 3.0769 (brighter in, darker out). The mask is now computed on a
  // tone-normalised copy, so the verdict is scale-invariant.
  const N = 251;
  const f = createDeepFrame(N, 1, 'srgb-linear');
  const level = (i: number) => 0.5 + (i / (N - 1)) * 2.5; // 0.5 .. 3.0
  for (let i = 0; i < N; i++) {
    const v = level(i);
    f.data[i * 4] = v; f.data[i * 4 + 1] = v; f.data[i * 4 + 2] = v; f.data[i * 4 + 3] = 1;
  }
  const out = hdrViewTransform(f, { targets: [] }); // includeWhite default true
  for (let i = 1; i < N; i++) {
    const prev = out.data[(i - 1) * 4]!;
    const cur = out.data[i * 4]!;
    assert.ok(cur > prev, `brighter in must be brighter out: in ${level(i - 1)}->${prev}, in ${level(i)}->${cur}`);
  }
  // And above SDR white the verdict is settled: constant gain, so the output is
  // a straight line through the headroom.
  const g = (v: number) => hdrViewTransform(px1(v, v, v), { targets: [] }).data[0]! / v;
  assert.ok(Math.abs(g(1.2) - g(2.5)) < 1e-5, `gain is scale-invariant above 1.0: ${g(1.2)} vs ${g(2.5)}`);
});

test('hdrViewTransform: out-of-gamut negatives SURVIVE the richness re-saturation (nothing clips)', () => {
  // P3 red expressed in sRGB-linear: red > 1, green/blue NEGATIVE. The richness
  // step used to Math.max(0, ...) each channel, destroying the excursion in the
  // one function whose contract says nothing here clips. Only pqEncodeFrame may
  // clamp. Boost must be ON for richness to run at all, so red is the target.
  const out = hdrViewTransform(px1(1.22494, -0.042057, -0.019638), {
    targets: ['#ff0000'], includeWhite: false,
  });
  assert.ok(out.data[0]! > 1, `red rides above SDR white, got ${out.data[0]}`);
  assert.ok(out.data[1]! < 0, `green stays negative through the boost, got ${out.data[1]}`);
  assert.ok(out.data[2]! < 0, `blue stays negative through the boost, got ${out.data[2]}`);
  // The encode boundary is where clipping is allowed to happen.
  const pq = pqEncodeFrame(out, 203);
  assert.equal(pq.data[1], 0, 'negative green clamps to 0 at the PQ encode boundary, not before');
});

test('hdr: non-finite samples are sanitised to 0 at the encode boundary (icc-pixels san idiom)', () => {
  assert.equal(pqEncode(Number.NaN), 0, 'NaN nits -> 0 code, not NaN');
  assert.equal(pqEncode(Number.POSITIVE_INFINITY), 0);
  assert.equal(pqEncode(Number.NEGATIVE_INFINITY), 0);
  const u16 = pqToU16({
    width: 2, height: 1, encoding: 'pq',
    data: new Float32Array([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1, 0.5, 0, 0, 1]),
  });
  assert.equal(u16[0], 0, 'NaN signal -> 0');
  assert.equal(u16[1], 0, '+Infinity signal -> 0 (damage, not peak white)');
  assert.equal(u16[2], 0, '-Infinity signal -> 0');
  assert.equal(u16[4], 32768, 'finite neighbours unaffected');
  // A NaN pixel walked end-to-end: the linear stage is free to carry it (it is
  // scene-referred float), the encode boundary is where it is disarmed.
  const enc = pqEncodeFrame(hdrViewTransform(px1(Number.NaN, Number.NaN, Number.NaN), { targets: [] }), 203);
  for (let c = 0; c < 3; c++) assert.equal(enc.data[c], 0, `channel ${c} sanitised`);
  assert.equal(pqToU16(enc)[0], 0);
});

test('hdrViewTransform: matches legacy semantics — jungle boosted, pine calmed, red untouched', () => {
  const jungle = fromU8Srgb(new Uint8ClampedArray([48, 186, 120, 255]), 1, 1);
  const pine = fromU8Srgb(new Uint8ClampedArray([12, 50, 44, 255]), 1, 1);
  const red = fromU8Srgb(new Uint8ClampedArray([255, 0, 0, 255]), 1, 1);
  const opts: HdrBoostOptions = { targets: ['#30ba78', '#0c322c'], includeWhite: false };
  const jB = hdrViewTransform(jungle, opts);
  const jP = hdrViewTransform(jungle, { targets: [], includeWhite: false });
  assert.ok(jB.data[1]! > jP.data[1]! * 3, 'jungle green channel boosted hard');
  const pB = hdrViewTransform(pine, opts);
  const pP = hdrViewTransform(pine, { targets: [], includeWhite: false });
  for (let c = 0; c < 3; c++) assert.ok(Math.abs(pB.data[c]! - pP.data[c]!) < 1e-7, 'pine (below knee) stays SDR');
  const rB = hdrViewTransform(red, opts);
  const rP = hdrViewTransform(red, { targets: [], includeWhite: false });
  for (let c = 0; c < 3; c++) assert.ok(Math.abs(rB.data[c]! - rP.data[c]!) < 1e-7, 'non-target red untouched');
});

// ─── pqEncodeFrame / pqToU16 ─────────────────────────────────────────────────

test('pqEncodeFrame: 203-nit anchor — linear 1.0 at sdrWhiteNits 203 -> PQ signal ~0.5806 (BT.2408)', () => {
  // ITU-R BT.2408: HDR reference/graphics white is 203 cd/m2, which sits at
  // ~58% PQ signal. Independent reference value, not a round-trip.
  const f = createDeepFrame(1, 1, 'rec2020-linear');
  f.data[0] = 1; f.data[1] = 1; f.data[2] = 1; f.data[3] = 1;
  const pq = pqEncodeFrame(f, 203);
  assert.equal(pq.encoding, 'pq');
  for (let c = 0; c < 3; c++) {
    assert.ok(Math.abs(pq.data[c]! - 0.5806) < 1e-3, `channel ${c}: 203 nits -> ~0.5806 PQ, got ${pq.data[c]}`);
  }
  assert.equal(pq.data[3], 1, 'alpha stays linear 0..1');
});

test('pqEncodeFrame: monotonic — more nits in, more PQ signal out; headroom keeps climbing past 1.0', () => {
  const f = createDeepFrame(4, 1, 'rec2020-linear');
  const levels = [0.25, 1, 2, 6]; // 6x SDR white = 1218 nits, still well inside PQ range
  for (const [i, v] of levels.entries()) { f.data[i * 4] = v; f.data[i * 4 + 1] = v; f.data[i * 4 + 2] = v; f.data[i * 4 + 3] = 1; }
  const pq = pqEncodeFrame(f, 203);
  for (let i = 1; i < levels.length; i++) {
    assert.ok(pq.data[i * 4]! > pq.data[(i - 1) * 4]!, `PQ(${levels[i]}) > PQ(${levels[i - 1]})`);
  }
  // The >1.0 pixels are genuinely brighter than SDR white in the signal — the
  // 8-bit path could only ever have fed clipped 1.0s here.
  assert.ok(pq.data[8]! > pqEncode(203) + 0.05, '2x SDR white is visibly above the 203-nit code');
});

test('pqEncodeFrame: srgb-linear input is converted to Rec.2020 before encoding', () => {
  // A saturated sRGB red is NOT the same triple in Rec.2020 (it desaturates
  // toward the wider gamut's interior) — so the red channel PQ must differ
  // from naively encoding the sRGB value, and green must be non-zero.
  const f = px1(1, 0, 0);
  const pq = pqEncodeFrame(f, 203);
  assert.ok(pq.data[1]! > 0, 'Rec.2020 green component of sRGB red is > 0');
  assert.ok(pq.data[0]! < pqEncode(203), 'red channel below full 203-nit code (0.627 of it in 2020)');
});

test('pqToU16: full 16-bit range, round-to-nearest', () => {
  const pq: PqImage = {
    width: 2, height: 1, encoding: 'pq',
    data: new Float32Array([0, 0.5, 1, 1, 0.5806, 0.25, 2, -1]), // out-of-range clamps
  };
  const u16 = pqToU16(pq);
  assert.equal(u16[0], 0);
  assert.equal(u16[1], 32768, '0.5 -> 32768 (rounds from 32767.5)');
  assert.equal(u16[2], 65535, 'signal 1.0 uses the FULL range');
  assert.equal(u16[3], 65535);
  assert.equal(u16[4], Math.round(0.5806 * 65535));
  assert.equal(u16[6], 65535, '>1 clamps to top');
  assert.equal(u16[7], 0, '<0 clamps to bottom');
});

test('pqEncodeFrame + pqToU16: a 16-bit PQ ramp is dense, not 8-bit-quantised', () => {
  // The defect this phase fixes: 8-bit PQ has 256 codes; the float path must
  // produce far more distinct u16 codes over a shallow shadow ramp.
  const N = 512;
  const f = createDeepFrame(N, 1, 'rec2020-linear');
  for (let i = 0; i < N; i++) {
    const v = (i / (N - 1)) * 0.1; // dark shadows, where 8-bit PQ banded
    f.data[i * 4] = v; f.data[i * 4 + 1] = v; f.data[i * 4 + 2] = v; f.data[i * 4 + 3] = 1;
  }
  const u16 = pqToU16(pqEncodeFrame(f, 203));
  const codes = new Set<number>();
  for (let i = 0; i < N; i++) codes.add(u16[i * 4]!);
  assert.ok(codes.size > 400, `shadow ramp has ${codes.size} distinct u16 codes (8-bit would give ~90)`);
});

test('pqEncodeFrame refuses nothing but lab (via convertSpace) and preserves dimensions', () => {
  const f = createDeepFrame(3, 2, 'display-p3-linear');
  const pq = pqEncodeFrame(f);
  assert.equal(pq.width, 3);
  assert.equal(pq.height, 2);
  assert.equal(pq.data.length, 24);
});

// ─── end-to-end: bytes -> float -> PQ u16 tracks the legacy 8-bit path ───────

test('float path agrees with legacy hdrBoostToPQ within 8-bit quantisation error', () => {
  // Not byte-identity (the float path is a different, higher-precision route);
  // but on the same 8-bit input the two must describe the same image: each
  // legacy PQ byte b and float PQ signal s satisfy |s*255 - b| <= 1.
  // `richness: 0` because the re-saturation step is the ONE deliberate
  // divergence between the paths — see the next test.
  const opts: HdrBoostOptions = { targets: ['#30ba78'], includeWhite: true, richness: 0 };
  const bytes = paletteImage();
  const frame = fromU8Srgb(bytes, 8, 8);
  const pq = pqEncodeFrame(hdrViewTransform(frame, opts), opts.sdrWhiteNits ?? 203);
  const legacy = paletteImage();
  hdrBoostToPQ(legacy, opts);
  for (let i = 0; i < legacy.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const diff = Math.abs(pq.data[i + c]! * 255 - legacy[i + c]!);
      assert.ok(diff <= 1.0, `pixel ${i / 4} ch ${c}: float ${pq.data[i + c]! * 255} vs legacy ${legacy[i + c]} (diff ${diff})`);
    }
  }
});

test('richness is the ONE deliberate divergence: legacy clamps the excursion, the float path keeps it', () => {
  // The legacy loop quantises to unsigned bytes, so its re-saturation clamps
  // each channel at 0; hdrViewTransform must not, or the "nothing here clips"
  // contract is a lie. On a hard-boosted saturated green the difference is
  // visible: the float path's red goes negative in sRGB-linear and comes out
  // of the Rec.2020 matrix genuinely lower than the clamped legacy byte.
  const opts: HdrBoostOptions = { targets: ['#30ba78'], includeWhite: true, richness: 0.4 };
  const jungle = fromU8Srgb(new Uint8ClampedArray([48, 186, 120, 255]), 1, 1);
  const lin = hdrViewTransform(jungle, opts);
  const pq = pqEncodeFrame(lin, 203);
  const legacy = new Uint8ClampedArray([48, 186, 120, 255]);
  hdrBoostToPQ(legacy, opts);
  const floatRed = pq.data[0]! * 255;
  assert.ok(legacy[0]! - floatRed > 5, `legacy red ${legacy[0]} is clamp-inflated vs float ${floatRed}`);
  // Same pixel with the re-saturation off: the paths agree again, which pins
  // the divergence to the clamp and nothing else.
  const flat: HdrBoostOptions = { ...opts, richness: 0 };
  const pq0 = pqEncodeFrame(hdrViewTransform(fromU8Srgb(new Uint8ClampedArray([48, 186, 120, 255]), 1, 1), flat), 203);
  const legacy0 = new Uint8ClampedArray([48, 186, 120, 255]);
  hdrBoostToPQ(legacy0, flat);
  assert.ok(Math.abs(pq0.data[0]! * 255 - legacy0[0]!) <= 1, 'agree without richness');
});
