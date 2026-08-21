// SPDX-License-Identifier: MPL-2.0
/**
 * engine/src/pixels.ts - DeepFrame buffer + conversion contract tests.
 *
 * Reference anchors (no converter is tested only against itself):
 *   - sRGB EOTF: 0.5 -> 0.21404114 (IEC 61966-2.1)
 *   - D65 sRGB white -> XYZ(D50) = the CSS Color 4 D50 white (0.9643, 1, 0.8251)
 *     after Bradford adaptation
 *   - CIE L*: Y = 0.18 (18% grey) -> L* = 116 * 0.18^(1/3) - 16 = 49.4961...
 *   - IEEE 754 binary16 bit patterns incl. subnormals, Inf, NaN, -0, and a
 *     bit-exact exhaustive cross-check against the platform Float16Array
 *   - sRGB->P3 agreement with gamut-source.ts's exported matrix functions
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/pixels.test.ts
 * NOTE: console output stays ASCII-first (see color-ramp.test.ts header).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PIXEL_SPACES, createDeepFrame, srgbToLinear, linearToSrgb,
  fromU8Srgb, toU8Srgb, fromU16, toU16,
  floatToHalf, halfToFloat, packF16, unpackF16,
  premultiply, unpremultiply, mapScanlines, convertSpace,
  type DeepFrame, type PixelSpace,
} from '../engine/src/pixels.ts';
import { linearSrgbToLinearP3, linearP3ToLinearSrgb } from '../engine/src/gamut-source.ts';

const frameOf = (px: number[][], space: PixelSpace = 'srgb-linear'): DeepFrame => ({
  width: px.length, height: 1, data: Float32Array.from(px.flat()), space,
});
const approx = (got: number, want: number, eps: number, msg?: string) =>
  assert.ok(Math.abs(got - want) <= eps, `${msg ?? 'approx'}: got ${got}, want ${want} +/- ${eps}`);

// deterministic PRNG for reproducible random buffers
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── transfer curve anchors ───────────────────────────────────────────────────

test('sRGB EOTF anchor: 0.5 -> 0.21404114 (IEC 61966-2.1)', () => {
  approx(srgbToLinear(0.5), 0.21404114, 1e-8, 'srgbToLinear(0.5)');
  // negative controls: endpoints exact, inverse agrees
  assert.equal(srgbToLinear(0), 0);
  approx(srgbToLinear(1), 1, 1e-15, 'white (1 ulp of fp in the power term, same as hdr.ts)');
  assert.equal(linearToSrgb(0), 0);
  approx(linearToSrgb(1), 1, 1e-15, 'white inverse');
  approx(linearToSrgb(0.21404114), 0.5, 1e-7, 'inverse');
  // the linear segment boundary is consistent both ways (0.04045 <-> 0.0031308)
  approx(srgbToLinear(0.04045), 0.04045 / 12.92, 1e-12, 'toe');
  // and it is NOT the naive pure-2.2 gamma (negative control against the wrong curve)
  assert.ok(Math.abs(srgbToLinear(0.5) - 0.5 ** 2.2) > 1e-3, 'piecewise, not gamma 2.2');
});

// ─── u8 <-> f32 ───────────────────────────────────────────────────────────────

test('fromU8Srgb: white/black/alpha decode', () => {
  const f = fromU8Srgb(Uint8ClampedArray.from([255, 255, 255, 255, 0, 0, 0, 0, 128, 128, 128, 51]), 3, 1);
  assert.equal(f.space, 'srgb-linear');
  assert.deepEqual([...f.data.slice(0, 4)], [1, 1, 1, 1]);
  assert.deepEqual([...f.data.slice(4, 8)], [0, 0, 0, 0]);
  approx(f.data[8]!, srgbToLinear(128 / 255), 1e-7, 'mid grey linear');
  approx(f.data[11]!, 51 / 255, 1e-7, 'alpha is linear rescale');
});

test('u8 -> f32 -> u8 identity, exhaustive over all 256 values per channel', () => {
  const src = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) {
    src[i * 4] = i; src[i * 4 + 1] = 255 - i; src[i * 4 + 2] = (i * 7) % 256; src[i * 4 + 3] = i;
  }
  const back = toU8Srgb(fromU8Srgb(src, 256, 1));
  assert.deepEqual([...back], [...src], 'all 256 byte values round-trip per channel + alpha');
});

test('toU8Srgb clamps unbounded values (display-referred encode boundary)', () => {
  const f = frameOf([[2.5, -0.3, 0.5, 1.7]]);
  const b = toU8Srgb(f);
  assert.equal(b[0], 255, 'HDR headroom clamps to white');
  assert.equal(b[1], 0, 'negative excursion clamps to 0');
  assert.equal(b[2], Math.round(linearToSrgb(0.5) * 255));
  assert.equal(b[3], 255, 'alpha clamps to 1');
});

test('negative control: fromU8Srgb rejects mismatched dimensions', () => {
  assert.throws(() => fromU8Srgb(new Uint8ClampedArray(12), 2, 2), /length/);
  assert.throws(() => fromU8Srgb(new Uint8ClampedArray(16), 0, 4), /dimensions/);
  assert.throws(() => fromU8Srgb(new Uint8ClampedArray(16), 2.5, 2), /dimensions/);
});

// ─── u16 interchange ─────────────────────────────────────────────────────────

test('u16 round-trip, exhaustive over all 65536 values', () => {
  const src = new Uint16Array(65536);
  for (let i = 0; i < 65536; i++) src[i] = i;
  const back = toU16(fromU16(src, 16384, 1));
  assert.equal(back.length, src.length);
  for (let i = 0; i < 65536; i++) {
    if (back[i] !== src[i]) assert.fail(`u16 value ${i} round-tripped to ${back[i]}`);
  }
});

test('u16 is LINEAR interchange: 32768 -> ~0.5 linear, not gamma-decoded', () => {
  const f = fromU16(Uint16Array.from([32768, 0, 65535, 65535]), 1, 1);
  approx(f.data[0]!, 32768 / 65535, 1e-7, 'no transfer curve applied');
  assert.ok(Math.abs(f.data[0]! - srgbToLinear(32768 / 65535)) > 0.2, 'NOT the sRGB EOTF');
});

test('toU16 clamps unbounded values; negative controls: lab refused, bad dims throw', () => {
  const u = toU16(frameOf([[1.5, -0.25, 0.25, 1]]));
  assert.deepEqual([...u], [65535, 0, Math.round(0.25 * 65535), 65535]);
  assert.throws(() => toU16(frameOf([[50, 0, 0, 1]], 'lab')), /lab/);
  assert.throws(() => fromU16(new Uint16Array(8), 1, 1), /length/);
  assert.throws(() => fromU16(new Uint16Array(4), 1, 1, 'lab'), /lab/);
});

// ─── f16 pack/unpack ─────────────────────────────────────────────────────────

test('f16 known bit patterns (IEEE 754-2008 binary16)', () => {
  const cases: Array<[number, number, string]> = [
    [1, 0x3c00, 'one'],
    [-2, 0xc000, 'minus two'],
    [0.5, 0x3800, 'half'],
    [65504, 0x7bff, 'max finite'],
    [2 ** -14, 0x0400, 'smallest normal'],
    [2 ** -24, 0x0001, 'smallest subnormal'],
    [1023 * 2 ** -24, 0x03ff, 'largest subnormal'],
    [0, 0x0000, 'zero'],
    [Number.POSITIVE_INFINITY, 0x7c00, 'inf'],
    [Number.NEGATIVE_INFINITY, 0xfc00, '-inf'],
    [0.333251953125, 0x3555, 'one third neighbour'],
  ];
  for (const [v, bits, name] of cases) {
    assert.equal(floatToHalf(v), bits, `pack ${name}`);
    assert.equal(halfToFloat(bits), v, `unpack ${name}`);
  }
  // -0 keeps its sign bit
  assert.equal(floatToHalf(-0), 0x8000);
  assert.ok(Object.is(halfToFloat(0x8000), -0), 'unpack -0');
  // NaN: any pattern with max exponent + nonzero mantissa
  const nanBits = floatToHalf(Number.NaN);
  assert.equal(nanBits & 0x7c00, 0x7c00);
  assert.notEqual(nanBits & 0x03ff, 0, 'NaN mantissa nonzero');
  assert.ok(Number.isNaN(halfToFloat(0x7e00)), 'unpack quiet NaN');
  assert.ok(Number.isNaN(halfToFloat(0xfe01)), 'unpack negative NaN payload');
});

test('f16 rounding: round-to-nearest-even at overflow, underflow, and ties', () => {
  assert.equal(floatToHalf(65520), 0x7c00, '65520 overflows to Inf (RNE)');
  assert.equal(floatToHalf(65519.9), 0x7bff, 'just below the overflow tie stays max finite');
  assert.equal(floatToHalf(2 ** -25), 0x0000, 'tie at half the smallest subnormal rounds to even (zero)');
  assert.equal(floatToHalf(1.5 * 2 ** -25), 0x0001, 'above the tie rounds up to the smallest subnormal');
  assert.equal(floatToHalf(3 * 2 ** -25), 0x0002, 'tie between subnormals 1 and 2 rounds to even (2)');
  assert.equal(floatToHalf(2 ** -26), 0x0000, 'below the tie underflows to zero');
  assert.equal(floatToHalf(-(2 ** -26)), 0x8000, 'signed underflow keeps the sign');
  // mantissa tie in normals: 1 + 2^-11 is exactly between 0x3c00 and 0x3c01 -> even (0x3c00)
  assert.equal(floatToHalf(1 + 2 ** -11), 0x3c00, 'normal-range tie rounds to even');
  assert.equal(floatToHalf(1 + 3 * 2 ** -11), 0x3c02, 'next tie rounds to even (up)');
});

test('f16 exhaustive: pack(unpack(bits)) is identity for every non-NaN pattern', () => {
  for (let bits = 0; bits < 65536; bits++) {
    const v = halfToFloat(bits);
    if (Number.isNaN(v)) {
      const re = floatToHalf(v);
      assert.equal(re & 0x7c00, 0x7c00, 'NaN repacks to a NaN pattern');
      assert.notEqual(re & 0x03ff, 0);
      continue;
    }
    const re = floatToHalf(v);
    if (re !== bits) assert.fail(`bits 0x${bits.toString(16)} -> ${v} -> 0x${re.toString(16)}`);
  }
});

test('f16 cross-check against the platform Float16Array (when present)', (t) => {
  const F16 = (globalThis as Record<string, unknown>).Float16Array as
    | (new (n: number) => Float32Array) // close enough structurally for the test
    | undefined;
  if (!F16) return t.skip('no Float16Array in this runtime');
  const h = new F16(1);
  // decode: every bit pattern reads identically
  const bitsView = new Uint16Array((h as unknown as { buffer: ArrayBuffer }).buffer);
  for (let bits = 0; bits < 65536; bits++) {
    bitsView[0] = bits;
    const platform = h[0]!;
    const ours = halfToFloat(bits);
    if (!Object.is(platform, ours) && !(Number.isNaN(platform) && Number.isNaN(ours))) {
      assert.fail(`decode mismatch at 0x${bits.toString(16)}: platform ${platform}, ours ${ours}`);
    }
  }
  // encode: edge values + a deterministic random sweep round the same way
  const rnd = mulberry32(0xf16f16);
  const values = [0, -0, 1, -1, 65504, 65519.9, 65520, 2 ** -24, 2 ** -25, 1.5 * 2 ** -25,
    2 ** -14, 1 + 2 ** -11, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NaN];
  for (let i = 0; i < 20000; i++) values.push((rnd() - 0.5) * 2 ** (Math.floor(rnd() * 40) - 20));
  for (const v of values) {
    h[0] = v; // platform f32->f16 rounding
    const platformBits = bitsView[0]!;
    const ourBits = floatToHalf(v);
    const bothNaN = (platformBits & 0x7c00) === 0x7c00 && (platformBits & 0x3ff) !== 0
      && (ourBits & 0x7c00) === 0x7c00 && (ourBits & 0x3ff) !== 0;
    if (platformBits !== ourBits && !bothNaN) {
      assert.fail(`encode mismatch for ${v}: platform 0x${platformBits.toString(16)}, ours 0x${ourBits.toString(16)}`);
    }
  }
});

test('packF16/unpackF16 arrays agree with the scalar path and handle subarrays', () => {
  const rnd = mulberry32(0xdeadbeef);
  const src = new Float32Array(4096);
  for (let i = 0; i < src.length; i++) src[i] = (rnd() - 0.4) * 4;
  src[0] = Number.POSITIVE_INFINITY; src[1] = -0; src[2] = 2 ** -24;
  const packed = packF16(src);
  assert.equal(packed.length, src.length);
  for (let i = 0; i < src.length; i++) {
    assert.equal(packed[i], floatToHalf(src[i]!), `packF16[${i}] matches scalar floatToHalf`);
  }
  const un = unpackF16(packed);
  for (let i = 0; i < src.length; i++) {
    assert.ok(Object.is(un[i], halfToFloat(packed[i]!)), `unpackF16[${i}] matches scalar halfToFloat`);
  }
  // an offset subarray must not be misread through its underlying buffer
  const holder = new Uint16Array(8);
  holder.set([0, 0, 0x3c00, 0x4000], 0);
  const sub = holder.subarray(2, 4);
  assert.deepEqual([...unpackF16(sub)], [1, 2], 'offset subarray unpacks by element, not buffer origin');
});

// ─── alpha helpers ───────────────────────────────────────────────────────────

test('premultiply/unpremultiply round-trip; a=0 leaves channels untouched', () => {
  const f = frameOf([[0.8, 0.4, 0.2, 0.5], [0.7, 0.3, 0.1, 0], [1, 1, 1, 1]]);
  const orig = Float32Array.from(f.data);
  premultiply(f);
  approx(f.data[0]!, 0.4, 1e-7, 'premultiplied r');
  assert.equal(f.data[4], 0, 'a=0 premultiplies to 0');
  assert.equal(f.data[8], 1, 'a=1 untouched');
  unpremultiply(f);
  for (let i = 0; i < 4; i++) approx(f.data[i]!, orig[i]!, 1e-6, `round-trip ch ${i}`);
  // a=0 pixel: colour is unrecoverable; unpremultiply must not divide into NaN/Inf
  assert.equal(f.data[4], 0);
  assert.ok(Number.isFinite(f.data[4]!) && Number.isFinite(f.data[5]!), 'no Inf/NaN at a=0');
});

// ─── scanline map ────────────────────────────────────────────────────────────

test('mapScanlines: zero-copy rows in order, mutations write through', () => {
  const f = createDeepFrame(3, 4);
  const seen: number[] = [];
  mapScanlines(f, (row, y) => {
    seen.push(y);
    assert.equal(row.length, 3 * 4, 'row is width*4 channels');
    assert.equal(row.buffer, f.data.buffer, 'row is a view, not a copy');
    row[0] = y + 1; // write through
  });
  assert.deepEqual(seen, [0, 1, 2, 3], 'each scanline once, in order');
  for (let y = 0; y < 4; y++) assert.equal(f.data[y * 12], y + 1, 'mutation landed in the frame');
});

// ─── convertSpace ────────────────────────────────────────────────────────────

test('convertSpace: white anchor - sRGB white -> XYZ(D50) is the CSS D50 white', () => {
  // D65 sRGB white -> XYZ(D65) is (0.9505, 1.0000, 1.0890); Bradford-adapting to
  // D50 must land exactly on the D50 reference white (CSS Color 4).
  const f = convertSpace(frameOf([[1, 1, 1, 1]]), 'xyz-d50');
  approx(f.data[0]!, 0.9642956764295677, 1e-4, 'X D50');
  approx(f.data[1]!, 1, 1e-4, 'Y D50');
  approx(f.data[2]!, 0.8251046025104602, 1e-4, 'Z D50');
  assert.equal(f.data[3], 1, 'alpha untouched');
  // negative control: black stays black in every space
  const b = convertSpace(frameOf([[0, 0, 0, 0.5]]), 'rec2020-linear');
  assert.deepEqual([...b.data], [0, 0, 0, 0.5]);
});

test('convertSpace: Y row anchor - luminance of sRGB white/green matches the matrix row', () => {
  // The Y row of sRGB->XYZ is the Rec.709 luma vector; green's Y is 0.7152.
  const g = convertSpace(frameOf([[0, 1, 0, 1]]), 'xyz-d50');
  // Bradford barely moves Y for a D65 stimulus; check against the D65 value loosely
  approx(g.data[1]!, 0.7152, 5e-3, 'green Y');
});

test('convertSpace: srgb -> rec2020 -> srgb round-trip within 1e-6', () => {
  const rnd = mulberry32(0x2020);
  const px: number[][] = [];
  for (let i = 0; i < 256; i++) px.push([rnd() * 1.5 - 0.2, rnd() * 1.5 - 0.2, rnd() * 1.5 - 0.2, rnd()]);
  const f = frameOf(px);
  const back = convertSpace(convertSpace(f, 'rec2020-linear'), 'srgb-linear');
  for (let i = 0; i < f.data.length; i++) {
    approx(back.data[i]!, f.data[i]!, 1e-6, `channel ${i}`);
  }
});

test('convertSpace: out-of-gamut P3 red survives a rec2020 round-trip (unbounded)', () => {
  const p3red = frameOf([[1, 0, 0, 1]], 'display-p3-linear');
  const inSrgb = convertSpace(p3red, 'srgb-linear');
  // P3 red is outside sRGB: the sRGB expression must go outside [0,1] and be kept
  assert.ok(inSrgb.data[0]! > 1, 'sRGB r channel exceeds 1');
  assert.ok(inSrgb.data[1]! < 0, 'sRGB g channel goes negative');
  const back = convertSpace(convertSpace(inSrgb, 'rec2020-linear'), 'display-p3-linear');
  approx(back.data[0]!, 1, 1e-6, 'r recovered');
  approx(back.data[1]!, 0, 1e-6, 'g recovered');
  approx(back.data[2]!, 0, 1e-6, 'b recovered');
});

test('convertSpace: srgb <-> p3 agrees with gamut-source.ts (shared primaries, no drift)', () => {
  const rnd = mulberry32(0x0503);
  for (let i = 0; i < 200; i++) {
    const r = rnd() * 1.4 - 0.2;
    const g = rnd() * 1.4 - 0.2;
    const b = rnd() * 1.4 - 0.2;
    const viaFrame = convertSpace(frameOf([[r, g, b, 1]]), 'display-p3-linear').data;
    const viaGamut = linearSrgbToLinearP3(r, g, b);
    for (let c = 0; c < 3; c++) approx(viaFrame[c]!, viaGamut[c]!, 1e-6, `fwd ch ${c}`);
    const backFrame = convertSpace(frameOf([[r, g, b, 1]], 'display-p3-linear'), 'srgb-linear').data;
    const backGamut = linearP3ToLinearSrgb(r, g, b);
    for (let c = 0; c < 3; c++) approx(backFrame[c]!, backGamut[c]!, 1e-6, `rev ch ${c}`);
  }
});

test('convertSpace: Lab anchors - white is L*=100 and 18% grey is L*=49.496 (CIE 15)', () => {
  const white = convertSpace(frameOf([[1, 1, 1, 1]]), 'lab');
  approx(white.data[0]!, 100, 1e-2, 'white L*');
  approx(white.data[1]!, 0, 1e-2, 'white a*');
  approx(white.data[2]!, 0, 1e-2, 'white b*');
  // xyz-d50 (0.18 * D50 white) -> L* = 116 * 0.18^(1/3) - 16 = 49.49610...
  const grey = convertSpace(
    frameOf([[0.18 * 0.9642956764295677, 0.18, 0.18 * 0.8251046025104602, 1]], 'xyz-d50'), 'lab');
  approx(grey.data[0]!, 116 * Math.cbrt(0.18) - 16, 1e-3, '18% grey L*');
  approx(grey.data[1]!, 0, 1e-3, 'neutral a*');
  approx(grey.data[2]!, 0, 1e-3, 'neutral b*');
  // negative control: sRGB green is NOT neutral - a* strongly negative
  const green = convertSpace(frameOf([[0, 1, 0, 1]]), 'lab');
  assert.ok(green.data[1]! < -40, `green a* is strongly negative, got ${green.data[1]}`);
  assert.ok(green.data[2]! > 40, `green b* is strongly positive, got ${green.data[2]}`);
});

test('convertSpace: lab round-trips through every space', () => {
  const rnd = mulberry32(0xab);
  const px: number[][] = [];
  for (let i = 0; i < 64; i++) px.push([rnd(), rnd(), rnd(), rnd()]);
  const f = frameOf(px);
  for (const via of PIXEL_SPACES.filter((s) => s !== 'srgb-linear')) {
    const back = convertSpace(convertSpace(f, via), 'srgb-linear');
    for (let i = 0; i < f.data.length; i++) {
      approx(back.data[i]!, f.data[i]!, 1e-5, `via ${via} ch ${i}`);
    }
  }
  // lab -> rec2020 (nonlinear + matrix legs composed): white maps to white
  const w = convertSpace(frameOf([[100, 0, 0, 1]], 'lab'), 'rec2020-linear');
  for (let c = 0; c < 3; c++) approx(w.data[c]!, 1, 1e-4, `lab white -> rec2020 ch ${c}`);
});

test('convertSpace: same-space returns the same frame object; alpha always passes through', () => {
  const f = frameOf([[0.1, 0.2, 0.3, 0.37]]);
  assert.equal(convertSpace(f, 'srgb-linear'), f, 'no-op returns the identical frame');
  const g = convertSpace(f, 'lab');
  assert.notEqual(g, f);
  approx(g.data[3]!, 0.37, 1e-7, 'alpha survives lab');
});

test('negative controls: unknown spaces are refused', () => {
  const f = frameOf([[0, 0, 0, 1]]);
  assert.throws(() => convertSpace(f, 'adobe-rgb' as PixelSpace), /unknown pixel space/);
  assert.throws(() => convertSpace({ ...f, space: 'srgb' as PixelSpace }, 'lab'), /unknown pixel space/);
  assert.throws(() => createDeepFrame(2, 2, 'srgb' as PixelSpace), /unknown pixel space/);
});

test('createDeepFrame: zero-filled transparent black, correct dims', () => {
  const f = createDeepFrame(5, 3, 'rec2020-linear');
  assert.equal(f.data.length, 60);
  assert.equal(f.space, 'rec2020-linear');
  assert.ok(f.data.every((v) => v === 0));
  assert.throws(() => createDeepFrame(0, 3), /dimensions/);
  assert.throws(() => createDeepFrame(2, -1), /dimensions/);
});
