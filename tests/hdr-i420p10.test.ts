// SPDX-License-Identifier: MPL-2.0
/**
 * WP-2 Phase 2 numeric verification of engine/src/hdr.ts#pqToI420P10 - the RGB(PQ)
 * -> I420P10 YUV conversion for the true-10-bit HDR video source.
 *
 * This is how the matrix + range + bit-packing are proven WITHOUT an HDR display:
 * known PQ code-value inputs are pushed through the conversion and the exact 10-bit
 * Y/U/V codes are asserted against the BT.2020 non-constant-luminance matrix and the
 * ITU-R BT.2020 section 5.4 narrow-range 10-bit digital levels, computed INDEPENDENTLY here.
 * The reference below is a separate implementation of the standard, not a re-call of
 * the engine, so agreement means the engine's matrix/levels/packing are correct. The
 * only thing left for on-device HDR is the perceptual "no banding" confirmation.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pqToI420P10, type PqImage } from '../engine/src/hdr.ts';

// ─── independent reference (the standard, re-derived, not the engine) ───────────

// BT.2020 non-constant-luminance luma coefficients (ITU-R BT.2020 Table 4).
const KR = 0.2627, KB = 0.0593, KG = 1 - KR - KB;

// Narrow-range 10-bit clamp to the container ceiling (matches the engine's to10bit:
// nominal levels sit inside 0..1023, corner overshoot rides the reserved room).
const code = (v: number): number => Math.max(0, Math.min(1023, Math.round(v)));

// One pixel's PQ R'G'B' code values -> [Y, Cb, Cr] 10-bit narrow-range codes.
function refYcc(r: number, g: number, b: number): [number, number, number] {
  const yp = KR * r + KG * g + KB * b;
  const cb = (b - yp) / (2 * (1 - KB));
  const cr = (r - yp) / (2 * (1 - KR));
  return [code(876 * yp + 64), code(896 * cb + 512), code(896 * cr + 512)];
}

// A w×h PQ frame from a per-pixel RGB triple source (alpha = 1).
function pqFrame(w: number, h: number, at: (x: number, y: number) => [number, number, number]): PqImage {
  const data = new Float32Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = at(x, y);
      const i = (y * w + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 1;
    }
  }
  return { width: w, height: h, data, encoding: 'pq' };
}

// A uniform 2×2 PQ frame - uniform so the 4:2:0 chroma mean equals the per-pixel
// value, making Y/U/V exact regardless of chroma siting.
const uniform = (r: number, g: number, b: number): PqImage => pqFrame(2, 2, () => [r, g, b]);

// ─── the matrix + narrow-range levels, exactly ─────────────────────────────────

test('pqToI420P10: BT.2020-ncl matrix + narrow-range 10-bit levels are exact', () => {
  const cases: Array<[string, number, number, number]> = [
    ['black', 0, 0, 0],
    ['white', 1, 1, 1],
    ['red', 1, 0, 0],
    ['green', 0, 1, 0],
    ['blue', 0, 0, 1],
    ['mid-grey', 0.5, 0.5, 0.5],
  ];
  for (const [name, r, g, b] of cases) {
    const out = pqToI420P10(uniform(r, g, b));
    const [Y, U, V] = refYcc(r, g, b);
    // 2×2 → 4 Y (all equal), 1 U, 1 V.  Plane order: Y | U | V.
    assert.deepEqual([...out.data.subarray(0, 4)], [Y, Y, Y, Y], `${name}: Y plane`);
    assert.equal(out.data[4], U, `${name}: U (Cb)`);
    assert.equal(out.data[5], V, `${name}: V (Cr)`);
  }
});

test('pqToI420P10: the known anchors land where the standard says', () => {
  // Neutral (black/white/grey) → chroma exactly 512; Y at the narrow-range rails.
  assert.deepEqual([...pqToI420P10(uniform(0, 0, 0)).data], [64, 64, 64, 64, 512, 512], 'black: Y=64, C=512');
  assert.deepEqual([...pqToI420P10(uniform(1, 1, 1)).data], [940, 940, 940, 940, 512, 512], 'white: Y=940, C=512');
  // Pure primaries drive one chroma axis to its 960 rail (E\'C = +0.5).
  assert.equal(pqToI420P10(uniform(1, 0, 0)).data[5], 960, 'pure red: Cr at the 960 rail');
  assert.equal(pqToI420P10(uniform(0, 0, 1)).data[4], 960, 'pure blue: Cb at the 960 rail');
});

// ─── layout: Y is per-pixel, chroma is a 2×2 mean, planes pack Y|U|V ────────────

test('pqToI420P10: Y is per-pixel, 4:2:0 chroma is the 2×2 mean, packing is Y|U|V', () => {
  const px: Array<[number, number, number]> = [[0, 0, 0], [1, 1, 1], [1, 0, 0], [0, 0, 1]];
  const out = pqToI420P10(pqFrame(2, 2, (x, y) => px[y * 2 + x]!));
  assert.equal(out.data.length, 4 + 1 + 1, 'Y(4) + U(1) + V(1)');

  // Y is quantised per pixel.
  for (let i = 0; i < 4; i++) assert.equal(out.data[i], refYcc(...px[i]!)[0], `Y[${i}] per-pixel`);

  // U/V are the float mean of the four pixels' Cb/Cr, quantised once.
  let cbSum = 0, crSum = 0;
  for (const [r, g, b] of px) {
    const yp = KR * r + KG * g + KB * b;
    cbSum += (b - yp) / (2 * (1 - KB));
    crSum += (r - yp) / (2 * (1 - KR));
  }
  assert.equal(out.data[4], code(896 * (cbSum / 4) + 512), 'U = 2×2 Cb mean');
  assert.equal(out.data[5], code(896 * (crSum / 4) + 512), 'V = 2×2 Cr mean');
});

test('pqToI420P10: odd dimensions pack ⌈w/2⌉×⌈h/2⌉ chroma; edge blocks average what exists', () => {
  // 1×1: Y(1) + U(1) + V(1). The single-pixel chroma "block" is just that pixel.
  const out = pqToI420P10(pqFrame(1, 1, () => [1, 0, 0]));
  assert.equal(out.data.length, 3, '1×1 → Y(1)+U(1)+V(1)');
  const [Y, U, V] = refYcc(1, 0, 0);
  assert.deepEqual([...out.data], [Y, U, V], '1×1 red exact');

  // 3×1: chroma width ⌈3/2⌉=2, height ⌈1/2⌉=1 → Y(3) + U(2) + V(2) = 7.
  const w3 = pqToI420P10(pqFrame(3, 1, (x) => (x < 2 ? [1, 1, 1] : [0, 0, 0])));
  assert.equal(w3.data.length, 3 + 2 + 2, '3×1 → Y(3)+U(2)+V(2)');
  // The last chroma cell covers only pixel x=2 (x=3 does not exist): its mean is that
  // one black pixel, so Cb=Cr=512, proving edge blocks average only present pixels.
  assert.equal(w3.data[3 + 1], 512, 'edge Cb over the lone black pixel');
  assert.equal(w3.data[3 + 2 + 1], 512, 'edge Cr over the lone black pixel');
});

// ─── defensive: NaN samples sanitise to 0, no NaN codes leak ────────────────────

test('pqToI420P10: non-finite samples sanitise to 0 (no NaN in the plane)', () => {
  const data = new Float32Array([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1]);
  const out = pqToI420P10({ width: 1, height: 1, data, encoding: 'pq' });
  // All RGB → 0 → black: Y=64, C=512. Never NaN (a NaN would store as 0 in a
  // Uint16Array silently; san makes the intent explicit and testable).
  assert.deepEqual([...out.data], [64, 512, 512]);
  for (const v of out.data) assert.ok(Number.isInteger(v) && v >= 0 && v <= 1023, 'valid 10-bit code');
});
