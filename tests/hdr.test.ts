// SPDX-License-Identifier: MPL-2.0
/**
 * HDR raster export — engine/src/hdr.ts (PQ pixel transform + brand-colour boost)
 * and engine/src/color.ts#pqBt2020IccProfile (the Rec.2100-PQ ICC profile whose
 * cicp tag is the HDR signal). Pure math, so this suite verifies it end to end;
 * whether the result actually *glows* is a display-dependent property that needs
 * on-device verification on an HDR screen (documented, not asserted here).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hdrBoostToPQ, pqEncode, HDR_PQ_CICP } from '../engine/src/hdr.ts';
import { pqBt2020IccProfile, srgbIccProfile } from '../engine/src/color.ts';
import { packTiff } from '../engine/src/tiff.ts';

// ─── helpers ──────────────────────────────────────────────────────────────────

// SMPTE ST 2084 EOTF: PQ code [0,1] → absolute nits. Inverse of pqEncode; used to
// read the transform's output back into luminance so assertions are in nits.
function pqDecode(code: number): number {
  const m1 = 2610 / 16384, m2 = (2523 / 4096) * 128;
  const c1 = 3424 / 4096, c2 = (2413 / 4096) * 32, c3 = (2392 / 4096) * 32;
  const p = code ** (1 / m2);
  const num = Math.max(p - c1, 0);
  const den = c2 - c3 * p;
  return (num / den) ** (1 / m1) * 10000;
}

// Rec.2020 luma (BT.2020 Y' coefficients) of an RGB-in-nits triple. Accepts the
// `number | undefined` of typed-array indexing (strict tests tsconfig) → treats
// a missing channel as 0.
const luma2020 = (r = 0, g = 0, b = 0) => 0.2627 * r + 0.678 * g + 0.0593 * b;

// Peak nits a channel byte decodes to.
const nits = (byte = 0) => pqDecode(byte / 255);

// A single RGBA pixel buffer.
const px = (r: number, g: number, b: number, a = 255) => new Uint8ClampedArray([r, g, b, a]);

// Read an ICC tag's raw bytes by 4-char signature (128-byte header, then table).
function iccTag(icc: Uint8Array, sig: string): Uint8Array | null {
  const dv = new DataView(icc.buffer, icc.byteOffset, icc.byteLength);
  const n = dv.getUint32(128);
  for (let i = 0; i < n; i++) {
    const o = 132 + i * 12;
    const s = String.fromCharCode(icc[o]!, icc[o + 1]!, icc[o + 2]!, icc[o + 3]!);
    if (s === sig) {
      const off = dv.getUint32(o + 4), len = dv.getUint32(o + 8);
      return icc.subarray(off, off + len);
    }
  }
  return null;
}

// ─── pqEncode ───────────────────────────────────────────────────────────────

test('pqEncode: anchors and monotonicity', () => {
  assert.equal(pqEncode(0), 0);
  assert.ok(Math.abs(pqEncode(10000) - 1) < 1e-9, 'peak PQ = 1.0');
  // SDR reference white (~203 nits) ≈ code 0.58; 1000 nits ≈ 0.75 (the known PQ anchors).
  assert.ok(Math.abs(pqEncode(203) - 0.58) < 0.02, `203 nits ~0.58, got ${pqEncode(203)}`);
  assert.ok(Math.abs(pqEncode(1000) - 0.75) < 0.02, `1000 nits ~0.75, got ${pqEncode(1000)}`);
  for (let n = 0; n < 10000; n += 250) assert.ok(pqEncode(n + 250) > pqEncode(n), 'monotonic');
  // Clamps out of range.
  assert.equal(pqEncode(-5), 0);
  assert.equal(pqEncode(1e9), pqEncode(10000));
});

test('pqEncode ∘ pqDecode round-trips', () => {
  for (const n of [50, 203, 600, 1000, 4000, 10000]) {
    assert.ok(Math.abs(pqDecode(pqEncode(n)) - n) < n * 0.01 + 1, `round-trip ${n}`);
  }
});

// ─── HDR_PQ_CICP ──────────────────────────────────────────────────────────────

test('HDR_PQ_CICP is Rec.2100 PQ (BT.2020 / ST 2084 / RGB / full-range)', () => {
  assert.deepEqual({ ...HDR_PQ_CICP }, { primaries: 9, transfer: 16, matrix: 0, fullRange: 1 });
});

// ─── the transform ────────────────────────────────────────────────────────────

test('white boosts to peak (~1000 nits at default peakNits)', () => {
  const p = px(255, 255, 255);
  hdrBoostToPQ(p, { targets: [] }); // includeWhite defaults true
  const y = luma2020(nits(p[0]), nits(p[1]), nits(p[2]));
  assert.ok(y > 900 && y < 1100, `white → ~1000 nits, got ${y.toFixed(0)}`);
});

test('peakNits controls white ceiling', () => {
  const lo = px(255, 255, 255), hi = px(255, 255, 255);
  hdrBoostToPQ(lo, { targets: [], peakNits: 600 });
  hdrBoostToPQ(hi, { targets: [], peakNits: 1600 });
  assert.ok(luma2020(nits(lo[0]), nits(lo[1]), nits(lo[2])) < 700);
  assert.ok(luma2020(nits(hi[0]), nits(hi[1]), nits(hi[2])) > 1400);
});

test('boost is targeted, not global: a bright non-target colour stays SDR', () => {
  const withT = px(255, 0, 0), withoutT = px(255, 0, 0); // pure red, not a target
  hdrBoostToPQ(withT, { targets: ['#30ba78'], includeWhite: false });
  hdrBoostToPQ(withoutT, { targets: [], includeWhite: false });
  assert.deepEqual([...withT], [...withoutT], 'red identical with/without a green target');
  // …and it landed at SDR luminance, not boosted.
  assert.ok(luma2020(nits(withT[0]), nits(withT[1]), nits(withT[2])) < 203);
});

test('a saturated mid-bright brand colour (jungle) punches when targeted', () => {
  const boosted = px(48, 186, 120), plain = px(48, 186, 120); // #30ba78, OKLab L≈0.70
  hdrBoostToPQ(boosted, { targets: ['#30ba78'], includeWhite: false });
  hdrBoostToPQ(plain, { targets: [], includeWhite: false });
  const yB = luma2020(nits(boosted[0]), nits(boosted[1]), nits(boosted[2]));
  const yP = luma2020(nits(plain[0]), nits(plain[1]), nits(plain[2]));
  assert.ok(yB > yP * 3, `jungle boosted hard (${yB.toFixed(0)} vs SDR ${yP.toFixed(0)})`);
});

test('richness re-saturates the boost (green stays rich, not minty)', () => {
  const rich = px(48, 186, 120), flat = px(48, 186, 120); // #30ba78
  hdrBoostToPQ(rich, { targets: ['#30ba78'], includeWhite: false, richness: 0.6 });
  hdrBoostToPQ(flat, { targets: ['#30ba78'], includeWhite: false, richness: 0 });
  // Green channel dominance (green vs the mean of the other two) grows with richness.
  const dom = (p: Uint8ClampedArray) => p[1]! - (p[0]! + p[2]!) / 2;
  assert.ok(dom(rich) > dom(flat), `richer green more dominant (${dom(rich)} vs ${dom(flat)})`);
});

test('richness leaves white untouched (no chroma to boost)', () => {
  const rich = px(255, 255, 255), flat = px(255, 255, 255);
  hdrBoostToPQ(rich, { targets: [], richness: 0.8 });
  hdrBoostToPQ(flat, { targets: [], richness: 0 });
  assert.deepEqual([...rich], [...flat], 'white identical regardless of richness');
});

test('dark brand primaries are calmed, not blown out', () => {
  // Pine #0c322c (L≈0.29) and Midnight #192072 (L≈0.30) are below the knee: even
  // when they are targets, their boost is at the floor (0) → they stay at SDR.
  const darks: Array<[number, number, number]> = [[12, 50, 44], [25, 32, 114]];
  for (const [r, g, b] of darks) {
    const targeted = px(r, g, b), sdr = px(r, g, b);
    const hex = '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
    hdrBoostToPQ(targeted, { targets: [hex], includeWhite: false });
    hdrBoostToPQ(sdr, { targets: [], includeWhite: false });
    assert.deepEqual([...targeted], [...sdr], `${hex} calmed to SDR (not blown out)`);
    assert.ok(luma2020(nits(targeted[0]), nits(targeted[1]), nits(targeted[2])) < 203);
  }
});

test('waterhole (just above mid) still gets near-full boost', () => {
  const p = px(0x24, 0x53, 0xff); // #2453ff, OKLab L≈0.54
  const plain = px(0x24, 0x53, 0xff);
  hdrBoostToPQ(p, { targets: ['#2453ff'], includeWhite: false });
  hdrBoostToPQ(plain, { targets: [], includeWhite: false });
  const yB = luma2020(nits(p[0]), nits(p[1]), nits(p[2]));
  const yP = luma2020(nits(plain[0]), nits(plain[1]), nits(plain[2]));
  assert.ok(yB > yP * 2.5, `waterhole boosted (${yB.toFixed(0)} vs ${yP.toFixed(0)})`);
});

test('alpha is preserved; buffer mutated in place and returned', () => {
  const p = px(255, 255, 255, 123);
  const ret = hdrBoostToPQ(p, { targets: [] });
  assert.equal(ret, p, 'returns the same buffer');
  assert.equal(p[3], 123, 'alpha untouched');
});

test('unparseable targets are skipped, not thrown', () => {
  const p = px(255, 255, 255);
  assert.doesNotThrow(() => hdrBoostToPQ(p, { targets: ['not-a-colour', ''], includeWhite: false }));
});

// ─── the ICC profile ──────────────────────────────────────────────────────────

test('pqBt2020IccProfile: valid v4 display profile with the PQ cicp tag', () => {
  const icc = pqBt2020IccProfile();
  const dv = new DataView(icc.buffer, icc.byteOffset, icc.byteLength);
  assert.equal(dv.getUint32(0), icc.byteLength, 'header size = byte length');
  assert.equal(dv.getUint32(8) >>> 0, 0x04400000, 'ICC v4.4');
  assert.equal(String.fromCharCode(...icc.subarray(12, 16)), 'mntr', 'display class');
  assert.equal(String.fromCharCode(...icc.subarray(16, 20)), 'RGB ', 'RGB space');
  assert.equal(String.fromCharCode(...icc.subarray(36, 40)), 'acsp', 'profile signature');

  const cicp = iccTag(icc, 'cicp');
  assert.ok(cicp, 'has a cicp tag');
  assert.equal(String.fromCharCode(...cicp.subarray(0, 4)), 'cicp', 'cicp type sig');
  // primaries=9 (BT.2020), transfer=16 (PQ), matrix=0 (RGB), full-range=1.
  assert.deepEqual([cicp[8], cicp[9], cicp[10], cicp[11]], [9, 16, 0, 1]);

  // Shaper tags present (legacy fallback for non-cicp CMMs).
  for (const t of ['desc', 'wtpt', 'chad', 'rXYZ', 'gXYZ', 'bXYZ', 'rTRC']) {
    assert.ok(iccTag(icc, t), `has ${t}`);
  }
  // desc is mluc in v4.
  assert.equal(String.fromCharCode(...iccTag(icc, 'desc')!.subarray(0, 4)), 'mluc');
});

test('pqBt2020IccProfile is memoised (stable identity)', () => {
  assert.equal(pqBt2020IccProfile(), pqBt2020IccProfile());
});

test('packTiff embeds the PQ ICC as the InterColorProfile tag (34675) → HDR TIFF', () => {
  const W = 2, H = 2;
  const icc = pqBt2020IccProfile();
  const tiff = packTiff(new Uint8Array(W * H * 3), { width: W, height: H, samplesPerPixel: 3, icc });
  // Little-endian TIFF. Walk the IFD for tag 34675 and read its out-of-line value.
  assert.equal(String.fromCharCode(tiff[0]!, tiff[1]!), 'II');
  const dv = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  const ifd = dv.getUint32(4, true);
  const n = dv.getUint16(ifd, true);
  let found: Uint8Array | null = null;
  for (let e = 0; e < n; e++) {
    const o = ifd + 2 + e * 12;
    if (dv.getUint16(o, true) === 34675) {
      const count = dv.getUint32(o + 4, true);
      const off = dv.getUint32(o + 8, true); // >4 bytes ⇒ out-of-line offset
      found = tiff.subarray(off, off + count);
    }
  }
  assert.ok(found, 'has the ICC tag');
  assert.deepEqual([...found!], [...icc], 'tag payload is the exact PQ profile (carries the HDR cicp)');
});

test('srgbIccProfile still valid after the buildIcc refactor', () => {
  const icc = srgbIccProfile();
  const dv = new DataView(icc.buffer, icc.byteOffset, icc.byteLength);
  assert.equal(dv.getUint32(0), icc.byteLength);
  assert.equal(dv.getUint32(8) >>> 0, 0x02100000, 'still ICC v2.1');
  assert.equal(String.fromCharCode(...icc.subarray(36, 40)), 'acsp');
  assert.ok(iccTag(icc, 'rXYZ') && iccTag(icc, 'rTRC') && iccTag(icc, 'desc'));
  assert.equal(iccTag(icc, 'cicp'), null, 'sRGB carries no cicp');
});
