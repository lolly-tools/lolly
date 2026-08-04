// SPDX-License-Identifier: MPL-2.0
/**
 * engine/src/radiance.ts — the Phase B3 Radiance RGBE (.hdr) writer + reader
 * (plans/61-deeprichpixels.md §4.2 / §6).
 *
 * The claims this suite is responsible for, and how each is checked:
 *
 *  1. THE ERROR BOUND IS DERIVED, NOT PICKED. RGBE stores `floor(v / f)` with
 *     `f = 2^(e-8)` and decodes `(byte + 0.5) * f`, so the worst case is half a
 *     bucket, and since `2^(e-1) <= max(r,g,b)`, half a bucket is at most
 *     `max/256`. Every assertion below uses `max/256` — computed per pixel from
 *     the format's own arithmetic, never a number tuned until the test went
 *     green. The suite also re-measures the statistics the module header quotes
 *     and fails if the doc drifts.
 *  2. NEGATIVE CONTROLS. The half-bucket offset is shown to matter (removing it
 *     doubles the worst case AND biases every sample low); a bound tightened one
 *     notch is shown to FAIL, so the bound is tight rather than generous; a
 *     one-sample edit changes the bytes.
 *  3. AN EXTERNAL ORACLE — ImageMagick (Q16 HDRI), which has an independent
 *     Radiance codec, in BOTH directions. Ours-in: `magick t.hdr out.pfm` must
 *     reproduce our samples EXACTLY under IM's decode convention. Theirs-in: a
 *     file ImageMagick wrote (new-style RLE, its own header) must decode within
 *     the cross-implementation bound. Skipped with a reason when `magick` is
 *     absent, so a plain clone is not punished.
 *
 *     Convention divergence, recorded rather than papered over: ImageMagick (and
 *     Ward's later `rgbe.c`) decode `byte * 2^(exp-136)` with NO half-bucket
 *     offset, which is why the "exactly" above is against the offset-free
 *     decode. Radiance's own `color.c colr_color` — what this module follows —
 *     adds 0.5, which is the unbiased choice. Cross-implementation error is
 *     therefore a full bucket (`max/128`), not half.
 *  4. RLE. Flat and RLE scanlines must produce IDENTICAL pixels; a constant
 *     scanline must actually compress (proving the encoder engages); noise must
 *     not expand beyond the format's own literal-block overhead; and the
 *     width < 8 case must fall back to flat because the format forbids RLE there.
 *  5. HOSTILE INPUT. `readRadiance` follows `unfilterPng`'s engine convention —
 *     null on anything malformed, never a throw. Fourteen malformed inputs plus
 *     a byte-level fuzz sweep.
 *
 * Run: node --test tests/radiance.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  packRadiance,
  readRadiance,
  parseRadianceHeader,
  floatToRgbe,
  rgbeToFloat,
  RADIANCE_FORMAT,
} from '../engine/src/radiance.ts';
import type { DeepFrame, PixelSpace } from '../engine/src/pixels.ts';

// ── helpers ──────────────────────────────────────────────────────────────────

/** Deterministic LCG (glibc constants) — every "random" input here is reproducible. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return s / 4294967296;
  };
}

function makeFrame(
  width: number,
  height: number,
  fn: (x: number, y: number) => [number, number, number],
  space: PixelSpace = 'srgb-linear',
): DeepFrame {
  const data = new Float32Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const [r, g, b] = fn(x, y);
      data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 1;
    }
  }
  return { width, height, data, space };
}

/** The header bytes of a file, as text (for grepping header lines). */
function headerText(bytes: Uint8Array): string {
  const head = parseRadianceHeader(bytes);
  assert.ok(head, 'header should parse');
  return Buffer.from(bytes.subarray(0, head.dataOffset)).toString('latin1');
}

/** Body (scanline) bytes only. */
function body(bytes: Uint8Array): Uint8Array {
  const head = parseRadianceHeader(bytes)!;
  return bytes.subarray(head.dataOffset);
}

/**
 * THE BOUND, derived from the format and used by every accuracy assertion.
 *
 * Encode: byte = floor(v / f), f = 2^(e-8) with 2^(e-1) <= max < 2^e.
 * Decode: v' = (byte + 0.5) * f. So |v' - v| <= f/2 = 2^(e-9) <= max/256.
 * `+ 1e-7 * max` absorbs float32 storage of the inputs themselves.
 */
function bound(maxChannel: number): number {
  return maxChannel / 256 + maxChannel * 1e-7;
}

// ── 1. the writer's arithmetic is the reference implementation's ─────────────

test('floatToRgbe/rgbeToFloat: the reference formulation, sample by sample', () => {
  const out = new Uint8Array(4);
  const back = new Float32Array(3);

  // 1.0 -> frexp(1) = 0.5 * 2^1, so e = 1, d = 2^7 = 128 -> byte 128, exp 129.
  floatToRgbe(1, 1, 1, out, 0);
  assert.deepEqual([...out], [128, 128, 128, 129], '1.0 encodes as (128,128,128,129)');
  rgbeToFloat(out, 0, back, 0);
  // (128 + 0.5) * 2^(129-136) = 128.5/128
  assert.equal(back[0], 128.5 / 128);

  // 0.5 -> e = 0 -> byte 128, exp 128.
  floatToRgbe(0.5, 0.5, 0.5, out, 0);
  assert.deepEqual([...out], [128, 128, 128, 128]);

  // The max channel can never round up to 256: mantissa < 1 strictly.
  for (const v of [1, 2 - 1e-12, 255.999, 1e30, 2 ** 20 - 1]) {
    floatToRgbe(v, v / 3, 0, out, 0);
    assert.ok(out[0]! <= 255 && out[0]! >= 128, `max channel byte in [128,255] for ${v}, got ${out[0]}`);
  }

  // Shared exponent: the exponent comes from the LARGEST channel.
  floatToRgbe(1, 0.001, 0, out, 0);
  assert.equal(out[3], 129, 'exponent set by the max channel');
  assert.equal(out[1], Math.floor(0.001 * 128), 'dark channel quantised on the bright channel grid');
});

// ── 2. round-trip accuracy against the derived bound ────────────────────────

test('round-trip: every sample within max(r,g,b)/256, the derived half-bucket bound', () => {
  const rnd = lcg(12345);
  // 200k pixels, each channel independently log-uniform over 1e-6..1e4 — i.e.
  // deliberately mixed magnitudes WITHIN a pixel, the case the shared exponent
  // is worst at.
  const w = 500, h = 400;
  const frame = makeFrame(w, h, () => [10 ** (rnd() * 10 - 6), 10 ** (rnd() * 10 - 6), 10 ** (rnd() * 10 - 6)]);
  const decoded: DeepFrame | null = readRadiance(packRadiance(frame));
  assert.ok(decoded, 'round-trip decodes');
  assert.equal(decoded.width, w);
  assert.equal(decoded.height, h);

  let maxRelMax = 0, sumRelMax = 0, n = 0, signedSum = 0, maxRelChannel = 0;
  for (let i = 0; i < frame.data.length; i += 4) {
    const mx = Math.max(frame.data[i]!, frame.data[i + 1]!, frame.data[i + 2]!);
    const lim = bound(mx);
    for (let c = 0; c < 3; c++) {
      const a = frame.data[i + c]!;
      const got: number = decoded.data[i + c]!;
      const delta: number = got - a;
      assert.ok(Math.abs(delta) <= lim, `|${got} - ${a}| = ${Math.abs(delta)} > ${lim} (max ${mx})`);
      maxRelMax = Math.max(maxRelMax, Math.abs(delta) / mx);
      sumRelMax += Math.abs(delta) / mx;
      signedSum += delta / mx;
      maxRelChannel = Math.max(maxRelChannel, Math.abs(delta) / a);
      n++;
    }
    assert.equal(decoded.data[i + 3], 1, 'alpha is 1 (RGBE has none)');
  }

  // The numbers quoted in the module header — re-measured here so the doc
  // cannot drift away from the code. Deterministic: the PRNG is seeded.
  assert.ok(Math.abs(maxRelMax - 0.0039062) < 5e-6, `max err/max-channel ${maxRelMax}`);
  assert.ok(Math.abs(sumRelMax / n - 0.0018849) < 5e-6, `mean err/max-channel ${sumRelMax / n}`);
  // The signed mean is POSITIVE here (+0.00105), and that is not a bug to hide:
  // with independent per-channel magnitudes, most channels are far below their
  // pixel's max, quantise to byte 0, and come back as half a bucket. Bias is
  // only ~0 where a channel is near the max — asserted in the next test, which
  // is the regime the +0.5 was designed for.
  assert.ok(signedSum / n > 5e-4, `dark-channel lift shows as a positive bias, got ${signedSum / n}`);
  // The honesty claim in the module header: relative to the CHANNEL's own value
  // the error is enormous when magnitudes are mixed. Asserted as a floor, so it
  // can only be understated if the encoder ever changes.
  assert.ok(maxRelChannel > 1e6, `per-channel relative error should be gross, got ${maxRelChannel}`);
  console.log(`[radiance] max/maxch ${maxRelMax.toFixed(7)} mean ${(sumRelMax / n).toFixed(7)} maxch-rel ${maxRelChannel.toExponential(2)}`);
});

test('round-trip: uniform-magnitude pixels stay within 1/128 per CHANNEL', () => {
  // When all three channels are within one octave, ch >= max/2, so the same
  // max/256 bound is at most ch/128 relative to the channel itself.
  const rnd = lcg(777);
  const frame = makeFrame(200, 100, () => {
    const m = 10 ** (rnd() * 10 - 6);
    return [m * (0.5 + rnd() * 0.5), m * (0.5 + rnd() * 0.5), m * (0.5 + rnd() * 0.5)];
  });
  const decoded = readRadiance(packRadiance(frame))!;
  let maxRel = 0, sum = 0, n = 0, signed = 0;
  for (let i = 0; i < frame.data.length; i += 4) {
    const mx = Math.max(frame.data[i]!, frame.data[i + 1]!, frame.data[i + 2]!);
    for (let c = 0; c < 3; c++) {
      const a = frame.data[i + c]!;
      const rel = Math.abs(decoded.data[i + c]! - a) / a;
      assert.ok(rel <= 1 / 128 + 1e-7, `per-channel relative error ${rel} exceeds 1/128`);
      maxRel = Math.max(maxRel, rel); sum += rel; n++;
      signed += (decoded.data[i + c]! - a) / mx;
    }
  }
  assert.ok(Math.abs(maxRel - 0.0069948) < 5e-6, `quoted max ${maxRel}`);
  assert.ok(Math.abs(sum / n - 0.0016962) < 5e-6, `quoted mean ${sum / n}`);
  // THIS is where the truncate/+0.5 pair pays: with every channel near its
  // pixel's max, the signed error averages to ~0 instead of half a bucket.
  assert.ok(Math.abs(signed / n) < 2e-4, `signed mean should be ~0, got ${signed / n}`);
});

test('honesty control: a dark channel beside a bright one is NOT preserved', () => {
  // The module header claims this; assert it rather than asserting a comfortable
  // number. (1, 0.001, 0) quantises green onto a 1/128 grid -> byte 0 -> the
  // decoder returns half a bucket, ~4x the true value.
  const frame = makeFrame(1, 1, () => [1, 0.001, 0]);
  const g = readRadiance(packRadiance(frame))!.data[1]!;
  assert.ok(g / 0.001 > 3, `dark channel error should be gross, got ratio ${g / 0.001}`);
  // ...while still respecting the bound relative to the pixel maximum.
  assert.ok(Math.abs(g - 0.001) <= bound(1));
});

// ── 3. negative controls ────────────────────────────────────────────────────

test('negative control: dropping the +0.5 doubles the worst case AND biases low', () => {
  const rnd = lcg(4242);
  const frame = makeFrame(100, 100, () => [10 ** (rnd() * 8 - 4), 10 ** (rnd() * 8 - 4), 10 ** (rnd() * 8 - 4)]);
  const bytes = packRadiance(frame, { rle: false });
  const rgbe = body(bytes);

  let worstOffset = 0, worstNaive = 0, signedNaive = 0, n = 0;
  const out = new Float32Array(3);
  for (let i = 0; i < frame.width * frame.height; i++) {
    const o = i * 4;
    const mx = Math.max(frame.data[o]!, frame.data[o + 1]!, frame.data[o + 2]!);
    rgbeToFloat(rgbe, o, out, 0);
    const exp = rgbe[o + 3]!;
    const f = exp === 0 ? 0 : 2 ** (exp - 136);
    for (let c = 0; c < 3; c++) {
      const a = frame.data[o + c]!;
      worstOffset = Math.max(worstOffset, Math.abs(out[c]! - a) / mx);
      const naive = rgbe[o + c]! * f; // ImageMagick / rgbe.c convention
      worstNaive = Math.max(worstNaive, Math.abs(naive - a) / mx);
      signedNaive += (naive - a) / mx;
      n++;
    }
  }
  assert.ok(worstOffset <= 1 / 256 + 1e-7, `with +0.5: ${worstOffset}`);
  assert.ok(worstNaive > 1 / 256, `without +0.5 the max/256 bound must FAIL, got ${worstNaive}`);
  assert.ok(worstNaive <= 1 / 128 + 1e-7, `without +0.5 the bound is a full bucket, got ${worstNaive}`);
  assert.ok(signedNaive / n < -1e-3, `offset-free decode must be biased LOW, mean ${signedNaive / n}`);
});

test('negative control: the derived bound is tight (halving it fails)', () => {
  const rnd = lcg(31337);
  const frame = makeFrame(64, 64, () => [10 ** (rnd() * 6 - 3), 10 ** (rnd() * 6 - 3), 10 ** (rnd() * 6 - 3)]);
  const decoded = readRadiance(packRadiance(frame))!;
  let violations = 0;
  for (let i = 0; i < frame.data.length; i += 4) {
    const mx = Math.max(frame.data[i]!, frame.data[i + 1]!, frame.data[i + 2]!);
    for (let c = 0; c < 3; c++) {
      if (Math.abs(decoded.data[i + c]! - frame.data[i + c]!) > mx / 512) violations++;
    }
  }
  assert.ok(violations > 0, 'max/512 must be violated — max/256 is the real bound, not slack');
});

test('negative control: one changed sample changes the bytes', () => {
  const frame = makeFrame(32, 8, (x, y) => [x / 32, y / 8, 0.25]);
  const a = packRadiance(frame);
  const tweaked = makeFrame(32, 8, (x, y) => [x / 32, y / 8, 0.25]);
  const idx = (5 * 32 + 7) * 4 + 1;
  tweaked.data[idx] = tweaked.data[idx]! + 0.02;
  const b = packRadiance(tweaked);
  assert.notDeepEqual([...a], [...b], 'a changed pixel must change the file');
  assert.deepEqual([...packRadiance(frame)], [...a], 'the unchanged frame still packs identically');
});

// ── 4. RLE ──────────────────────────────────────────────────────────────────

test('RLE and flat encodings decode to IDENTICAL pixels', () => {
  const rnd = lcg(2026);
  for (const [w, h] of [[8, 3], [37, 5], [127, 2], [128, 2], [129, 2], [255, 1], [512, 4]] as const) {
    const frame = makeFrame(w, h, (x) =>
      // A mix of flat runs (compressible) and noise (not) in every row.
      x % 17 < 9 ? [0.5, 0.25, 4] : [rnd() * 8, rnd() * 8, rnd() * 8],
    );
    const rle = readRadiance(packRadiance(frame, { rle: true }));
    const flat = readRadiance(packRadiance(frame, { rle: false }));
    assert.ok(rle && flat, `${w}x${h} both decode`);
    assert.deepEqual([...rle.data], [...flat.data], `${w}x${h}: RLE and flat pixels must be identical`);
  }
});

test('RLE actually engages: a constant image collapses, noise does not expand', () => {
  const w = 512, h = 64;
  const flatBody = 4 * w * h;

  const solid = makeFrame(w, h, () => [0.5, 0.25, 1]);
  const solidRle = body(packRadiance(solid, { rle: true })).length;
  assert.equal(body(packRadiance(solid, { rle: false })).length, flatBody);
  assert.ok(solidRle < flatBody * 0.05, `constant image should collapse: ${solidRle} vs ${flatBody}`);
  // Per scanline: 4 marker bytes + 4 components x ceil(512/127) two-byte runs.
  assert.equal(solidRle, h * (4 + 4 * 2 * Math.ceil(w / 127)), 'exactly the run-encoded minimum');

  // Byte noise: every sample different, so nothing is compressible. The format's
  // own overhead is one literal-block header per 128 bytes (0.78%), plus the
  // 4-byte scanline marker.
  const rnd = lcg(9001);
  const noise = makeFrame(w, h, () => [rnd() * 100, rnd() * 100, rnd() * 100]);
  const noiseRle = body(packRadiance(noise, { rle: true })).length;
  const ceiling = flatBody + h * 4 + h * 4 * Math.ceil(w / 128);
  assert.ok(noiseRle <= ceiling, `noise must not expand beyond format overhead: ${noiseRle} > ${ceiling}`);
  assert.ok(noiseRle > solidRle * 10, 'noise must not compress like a constant image');
});

test('RLE is skipped where the format forbids it (width < 8) and the reader copes', () => {
  for (const w of [1, 4, 7]) {
    const frame = makeFrame(w, 3, () => [1, 1, 1]);
    const bytes = packRadiance(frame, { rle: true });
    assert.equal(body(bytes).length, 4 * w * 3, `width ${w} must be written flat`);
    const back = readRadiance(bytes);
    assert.ok(back, `width ${w} decodes`);
    assert.equal(back.width, w);
  }
  // width 8 is the smallest RLE-legal width, and the marker must be there.
  const eight = packRadiance(makeFrame(8, 2, () => [1, 1, 1]), { rle: true });
  assert.deepEqual([...body(eight).subarray(0, 4)], [2, 2, 0, 8], 'width 8 carries the new-RLE marker');
});

test('old-style RLE (1,1,1,n) is read, including the >255 shift chain', () => {
  // Hand-built from the format description / color.c oldreadcolrs: a repeat
  // pixel copies its PREDECESSOR n << 8k times. Width 4 so the new-RLE
  // signature can never be mistaken for it.
  const head = Buffer.from('#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 1 +X 4\n', 'latin1');
  const px = Uint8Array.from([
    100, 50, 25, 130, // a real pixel
    1, 1, 1, 3, // repeat it 3 times -> pixels 1..3
  ]);
  const file = new Uint8Array(head.length + px.length);
  file.set(head, 0); file.set(px, head.length);
  const frame = readRadiance(file);
  assert.ok(frame, 'old-style RLE decodes');
  for (let x = 1; x < 4; x++) {
    assert.equal(frame.data[x * 4], frame.data[0], `pixel ${x} repeats pixel 0 (R)`);
    assert.equal(frame.data[x * 4 + 1], frame.data[1], `pixel ${x} repeats pixel 0 (G)`);
  }

  // Shift chain: two consecutive markers mean n0 + (n1 << 8) copies.
  const head2 = Buffer.from('#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 1 +X 6\n', 'latin1');
  const px2 = Uint8Array.from([9, 9, 9, 140, 1, 1, 1, 2, 1, 1, 1, 0, 1, 1, 1, 0, 200, 1, 1, 140, 200, 1, 1, 140, 200, 1, 1, 140]);
  const file2 = new Uint8Array(head2.length + px2.length);
  file2.set(head2, 0); file2.set(px2, head2.length);
  const f2 = readRadiance(file2);
  assert.ok(f2, 'shifted old-style run decodes');
  assert.equal(f2.data[1 * 4], f2.data[0], 'run copied pixel 0');
  assert.equal(f2.data[2 * 4], f2.data[0], 'run copied pixel 0 twice');
});

// ── 5. extreme values ───────────────────────────────────────────────────────

test('extreme values follow the documented policy', () => {
  const cases: [string, [number, number, number], (v: Float32Array) => void][] = [
    ['zero', [0, 0, 0], (v) => assert.deepEqual([v[0], v[1], v[2]], [0, 0, 0])],
    ['negative', [-1, -2, -3], (v) => assert.deepEqual([v[0], v[1], v[2]], [0, 0, 0])],
    ['mixed sign', [4, -1, 0], (v) => {
      assert.ok(Math.abs(v[0]! - 4) <= bound(4), 'positive channel survives');
      // The negative channel encodes to byte 0 (asserted on the bytes below);
      // it decodes to half a bucket, not to exact zero, because the decoder's
      // +0.5 is unconditional. Half a bucket is inside the format's own bound.
      assert.ok(v[1]! >= 0 && v[1]! <= bound(4), `negative channel clamps into [0, max/256], got ${v[1]}`);
    }],
    ['denormal-small', [1e-40, 5e-45, 0], (v) => assert.deepEqual([v[0], v[1], v[2]], [0, 0, 0])],
    ['just below MIN_LEVEL', [9e-33, 9e-33, 9e-33], (v) => assert.deepEqual([v[0], v[1], v[2]], [0, 0, 0])],
    ['just above MIN_LEVEL', [1e-31, 1e-31, 1e-31], (v) => {
      assert.ok(v[0]! > 0, 'survives as a nonzero value');
      assert.ok(Math.abs(v[0]! - 1e-31) <= bound(1e-31));
    }],
    ['very large', [1e30, 1e28, 1], (v) => {
      assert.ok(Math.abs(v[0]! - 1e30) <= bound(1e30), `1e30 round-trips, got ${v[0]}`);
      // The 1.0 channel is 30 decades below the exponent the pixel shares, so it
      // encodes to byte 0 and decodes to half a (gigantic) bucket. It is not
      // preserved in any sense — recorded, not smoothed over.
      assert.ok(v[2]! > 1e26, `a channel 30 decades down is destroyed, got ${v[2]}`);
      assert.ok(v[2]! <= bound(1e30));
    }],
    ['NaN', [Number.NaN, 1, 1], (v) => {
      // NaN encodes to byte 0 (asserted on the bytes below); like every byte-0
      // channel it decodes to half a bucket, never to a NaN.
      assert.ok(Number.isFinite(v[0]) && v[0]! >= 0 && v[0]! <= bound(1), `NaN must not survive, got ${v[0]}`);
      assert.ok(Math.abs(v[1]! - 1) <= bound(1), 'its neighbours are unaffected');
    }],
    ['+Infinity', [Number.POSITIVE_INFINITY, 1, 0], (v) => {
      assert.ok(Number.isFinite(v[0]) && v[0]! > 1e38, `clamped to the top of the range, got ${v[0]}`);
    }],
    ['-Infinity', [Number.NEGATIVE_INFINITY, 0, 0], (v) => assert.equal(v[0], 0)],
  ];
  // The policies are stated in BYTES, so assert them there too — decoding always
  // adds half a bucket, which would otherwise blur "clamped to 0" into "small".
  const enc = new Uint8Array(4);
  floatToRgbe(Number.NaN, 1, 1, enc, 0);
  assert.equal(enc[0], 0, 'NaN -> byte 0');
  floatToRgbe(4, -1, 0, enc, 0);
  assert.deepEqual([enc[1], enc[2]], [0, 0], 'negative and zero -> byte 0');
  floatToRgbe(-1, -2, -3, enc, 0);
  assert.deepEqual([...enc], [0, 0, 0, 0], 'an all-negative pixel is the all-zero RGBE');
  floatToRgbe(1e-40, 5e-45, 0, enc, 0);
  assert.deepEqual([...enc], [0, 0, 0, 0], 'denormals are below MIN_LEVEL -> exact black');
  floatToRgbe(Number.POSITIVE_INFINITY, 1, 0, enc, 0);
  assert.deepEqual([enc[0], enc[3]], [255, 255], 'Infinity clamps to the top of the range, no wrap');
  for (const [label, rgb, check] of cases) {
    const frame = makeFrame(1, 1, () => rgb);
    const back = readRadiance(packRadiance(frame));
    assert.ok(back, `${label}: decodes`);
    try {
      check(back.data);
    } catch (e) {
      throw new Error(`${label}: ${(e as Error).message}`);
    }
  }
});

test('the exponent byte never wraps, at any magnitude', () => {
  const out = new Uint8Array(4);
  for (let e = -140; e <= 140; e++) {
    const v = 2 ** e;
    if (!Number.isFinite(v)) continue;
    floatToRgbe(v, v, v, out, 0);
    assert.ok(out[3]! >= 0 && out[3]! <= 255, `exponent byte in range for 2^${e}`);
    if (e >= -100 && e <= 126) {
      const back = new Float32Array(3);
      rgbeToFloat(out, 0, back, 0);
      assert.ok(Math.abs(back[0]! - v) <= bound(v), `2^${e} round-trips`);
    }
  }
});

// ── 6. the header ───────────────────────────────────────────────────────────

test('the header parses back, field for field', () => {
  const frame = makeFrame(9, 3, () => [1, 1, 1], 'rec2020-linear');
  const bytes = packRadiance(frame, {
    gamma: 2.2,
    software: 'Lolly',
    comments: ['made with lolly', 'second line'],
  });
  const text = headerText(bytes);
  assert.ok(text.startsWith('#?RADIANCE\n'), 'magic first');
  assert.ok(text.includes(`FORMAT=${RADIANCE_FORMAT}\n`), 'FORMAT present');
  assert.ok(text.includes('\n\n-Y 3 +X 9\n'), 'blank line then the resolution line');

  const head = parseRadianceHeader(bytes)!;
  assert.equal(head.format, RADIANCE_FORMAT);
  assert.equal(head.width, 9);
  assert.equal(head.height, 3);
  assert.equal(head.exposure, 1);
  assert.equal(head.gamma, 2.2);
  assert.equal(head.software, 'Lolly');
  assert.deepEqual(head.comments, ['made with lolly', 'second line']);
  assert.equal(head.topDown, true);
  // Rec.2020 primaries (BT.2020-2 Table 1) round-trip, and the reader maps them
  // back to the pixel space they came from.
  assert.deepEqual(head.primaries, [0.708, 0.292, 0.17, 0.797, 0.131, 0.046, 0.3127, 0.329]);
  assert.equal(readRadiance(bytes)!.space, 'rec2020-linear', 'space recovered from PRIMARIES');

  // display-p3 too, and the no-primaries case documents its assumption.
  assert.equal(readRadiance(packRadiance(makeFrame(9, 1, () => [1, 1, 1], 'display-p3-linear')))!.space, 'display-p3-linear');
  assert.equal(readRadiance(packRadiance(frame, { primaries: null }))!.space, 'srgb-linear', 'no PRIMARIES defaults to srgb-linear');
  assert.equal(headerText(packRadiance(frame, { primaries: null })).includes('PRIMARIES'), false);
});

test('header text is sanitised — a newline cannot be injected into a comment', () => {
  const frame = makeFrame(8, 1, () => [1, 1, 1]);
  const bytes = packRadiance(frame, {
    software: 'evil\nFORMAT=32-bit_rle_xyze\nEXPOSURE=1e9',
    comments: ['a\rb\tc'],
  });
  const head = parseRadianceHeader(bytes);
  assert.ok(head, 'the forged file still parses');
  assert.equal(head.format, RADIANCE_FORMAT, 'the injected FORMAT line did not take');
  assert.equal(head.exposure, 1, 'the injected EXPOSURE did not take');
  const lines = headerText(bytes).split('\n');
  assert.equal(lines.filter((l) => l.startsWith('FORMAT=')).length, 1, 'exactly one FORMAT line');
  assert.equal(lines.filter((l) => l.startsWith('EXPOSURE=')).length, 1, 'exactly one EXPOSURE line');
  // The injected text survives as inert payload ON the SOFTWARE line — the
  // newlines that would have made it a header line are what got neutralised.
  assert.ok(lines.some((l) => l.startsWith('SOFTWARE=') && l.includes('xyze')), 'injection is inert, on one line');
  assert.ok(head.software!.includes('evil'), 'the harmless part survives');
});

test('EXPOSURE scales the stored samples and the reader takes it back off', () => {
  const frame = makeFrame(16, 2, (x) => [(x + 1) / 4, 0.5, 2]);
  const plain = packRadiance(frame);
  const exposed = packRadiance(frame, { exposure: 64 });
  assert.notDeepEqual([...body(plain)], [...body(exposed)], 'exposure must actually scale the samples');
  assert.ok(headerText(exposed).includes('EXPOSURE=64\n'));

  const back = readRadiance(exposed)!;
  for (let i = 0; i < frame.data.length; i += 4) {
    const mx = Math.max(frame.data[i]!, frame.data[i + 1]!, frame.data[i + 2]!);
    for (let c = 0; c < 3; c++) {
      assert.ok(Math.abs(back.data[i + c]! - frame.data[i + c]!) <= bound(mx), 'values recovered after EXPOSURE');
    }
  }

  // Cumulative EXPOSURE lines multiply (per the file-format doc).
  const twoLines = Buffer.from('#?RADIANCE\nFORMAT=32-bit_rle_rgbe\nEXPOSURE=2\nEXPOSURE=4\n\n-Y 1 +X 1\n', 'latin1');
  const px = Uint8Array.from([128, 128, 128, 129]); // = 8.0 stored
  const file = new Uint8Array(twoLines.length + 4);
  file.set(twoLines, 0); file.set(px, twoLines.length);
  assert.equal(parseRadianceHeader(file)!.exposure, 8);
  assert.ok(Math.abs(readRadiance(file)!.data[0]! - 128.5 / 128 / 8) < 1e-9, 'samples divided by the product');
});

// ── 7. determinism + idempotence ────────────────────────────────────────────

test('byte determinism, and re-packing a decoded frame is a fixed point', () => {
  const rnd = lcg(55);
  const frame = makeFrame(64, 16, (x) => (x % 5 === 0 ? [1, 1, 1] : [rnd() * 3, rnd() * 3, rnd() * 3]));
  const a = packRadiance(frame, { software: 'Lolly', comments: ['x'] });
  const b = packRadiance(frame, { software: 'Lolly', comments: ['x'] });
  assert.deepEqual([...a], [...b], 'two encodes of the same frame are byte-identical');

  // Decode -> re-encode must reproduce the file exactly: the RGBE grid is a
  // fixed point of encode(decode(.)), which is what makes .hdr safe to re-save.
  const decoded = readRadiance(a)!;
  const again = packRadiance(decoded, { software: 'Lolly', comments: ['x'] });
  assert.deepEqual([...again], [...a], 're-encoding a decoded frame is byte-identical');
});

// ── 8. writer refusals (programmer error, not input error) ──────────────────

test('packRadiance refuses what it must not silently reinterpret', () => {
  const lab = makeFrame(4, 4, () => [50, 10, -20], 'lab');
  assert.throws(() => packRadiance(lab), /converted to an RGB space/, 'Lab is refused, not reinterpreted');
  const xyz = makeFrame(4, 4, () => [0.5, 0.5, 0.5], 'xyz-d50');
  assert.throws(() => packRadiance(xyz), /converted to an RGB space/);

  assert.throws(() => packRadiance({ width: 0, height: 4, data: new Float32Array(0), space: 'srgb-linear' }), /dimensions/);
  assert.throws(() => packRadiance({ width: 4, height: 4, data: new Float32Array(16), space: 'srgb-linear' }), /buffer length/);
  assert.throws(() => packRadiance(makeFrame(8, 1, () => [1, 1, 1]), { exposure: 0 }), /exposure/);
  assert.throws(() => packRadiance(makeFrame(8, 1, () => [1, 1, 1]), { exposure: Number.NaN }), /exposure/);
});

// ── 9. hostile input: null, never a throw (unfilterPng's convention) ────────

test('readRadiance returns null on malformed input and never throws', () => {
  const good = packRadiance(makeFrame(16, 4, (x, y) => [x, y, 1]));
  const headEnd = parseRadianceHeader(good)!.dataOffset;

  const withHeader = (h: string, tail: number[] = []): Uint8Array => {
    const b = Buffer.from(h, 'latin1');
    const out = new Uint8Array(b.length + tail.length);
    out.set(b, 0); out.set(Uint8Array.from(tail), b.length);
    return out;
  };

  const cases: [string, Uint8Array][] = [
    ['empty', new Uint8Array(0)],
    ['too short', new Uint8Array(5)],
    ['wrong magic', withHeader('#?NOTHDR\nFORMAT=32-bit_rle_rgbe\n\n-Y 1 +X 1\n', [0, 0, 0, 0])],
    ['unterminated header', Buffer.from('#?RADIANCE\nFORMAT=32-bit_rle_rgbe', 'latin1') as unknown as Uint8Array],
    ['no resolution line', withHeader('#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n')],
    ['garbage resolution line', withHeader('#?RADIANCE\n\n+Z 4 +Q 4\n', [0, 0, 0, 0])],
    ['X-major resolution line', withHeader('#?RADIANCE\n\n-X 4 +Y 4\n', new Array(64).fill(0))],
    ['mirrored -X', withHeader('#?RADIANCE\n\n-Y 4 -X 4\n', new Array(64).fill(0))],
    ['zero dimension', withHeader('#?RADIANCE\n\n-Y 0 +X 4\n', [0, 0, 0, 0])],
    ['absurd dimensions', withHeader('#?RADIANCE\n\n-Y 60000 +X 60000\n', new Array(4096).fill(0))],
    ['unsupported FORMAT', withHeader('#?RADIANCE\nFORMAT=32-bit_rle_xyze\n\n-Y 1 +X 1\n', [0, 0, 0, 0])],
    ['truncated body', good.subarray(0, headEnd + 6)],
    ['header only', good.subarray(0, headEnd)],
    ['zero-length RLE block', withHeader('#?RADIANCE\n\n-Y 1 +X 8\n', [2, 2, 0, 8, 0, 0, 0, 0, 0, 0, 0, 0])],
    ['RLE run overruns the scanline', withHeader('#?RADIANCE\n\n-Y 1 +X 8\n', [2, 2, 0, 8, 128 + 100, 7, 0, 0, 0, 0])],
    ['RLE literal block overruns', withHeader('#?RADIANCE\n\n-Y 1 +X 8\n', [2, 2, 0, 8, 100, 1, 2, 3])],
    ['old-style repeat with no predecessor', withHeader('#?RADIANCE\n\n-Y 1 +X 4\n', [1, 1, 1, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])],
    ['old-style repeat past the row', withHeader('#?RADIANCE\n\n-Y 1 +X 4\n', [5, 5, 5, 130, 1, 1, 1, 99, 0, 0, 0, 0, 0, 0, 0, 0])],
    ['header longer than the guard', withHeader(`#?RADIANCE\n${'#pad\n'.repeat(20000)}\n-Y 1 +X 1\n`, [0, 0, 0, 0])],
    ['one enormous header line', withHeader(`#?RADIANCE\n#${'x'.repeat(200000)}\n\n-Y 1 +X 1\n`, [0, 0, 0, 0])],
  ];

  for (const [label, bytes] of cases) {
    let got: DeepFrame | null | 'threw' = 'threw';
    try {
      got = readRadiance(bytes);
    } catch (e) {
      assert.fail(`${label}: readRadiance threw (${(e as Error).message}) — the convention is null`);
    }
    assert.equal(got, null, `${label}: expected null`);
  }

  // ...and the good file is still good, so the cases above are not vacuous.
  assert.ok(readRadiance(good), 'the control file decodes');
});

test('fuzz: truncations and byte flips of a real file never throw', () => {
  const good = packRadiance(makeFrame(24, 6, (x, y) => [x / 3, y / 2, 0.5]));
  for (let cut = 0; cut < good.length; cut++) {
    assert.doesNotThrow(() => readRadiance(good.subarray(0, cut)), `truncation at ${cut}`);
  }
  const rnd = lcg(606);
  for (let i = 0; i < 4000; i++) {
    const copy = good.slice();
    const flips = 1 + Math.floor(rnd() * 4);
    for (let k = 0; k < flips; k++) copy[Math.floor(rnd() * copy.length)] = Math.floor(rnd() * 256);
    let out: DeepFrame | null = null;
    assert.doesNotThrow(() => { out = readRadiance(copy); }, `flip iteration ${i}`);
    if (out) {
      const f = out as DeepFrame;
      assert.equal(f.data.length, f.width * f.height * 4, 'a decoded frame is always self-consistent');
      assert.ok(f.data.every((v) => Number.isFinite(v)), 'decoded samples are always finite');
    }
  }
});

// ── 10. external oracle: ImageMagick, both directions ───────────────────────

let magickVersion: string | null = null;
try {
  magickVersion = execFileSync('magick', ['-version'], { encoding: 'utf8' }).split('\n')[0] ?? null;
} catch {
  magickVersion = null;
}
const SKIP_MAGICK = magickVersion ? false : 'ImageMagick (`magick`) is not installed (optional external-codec oracle)';

/** Read a binary PFM (ImageMagick's float interchange). Rows are bottom-to-top. */
function readPfm(file: string): { width: number; height: number; get: (x: number, y: number, c: number) => number } {
  const b = readFileSync(file);
  let p = 0;
  const tok = (): string => {
    for (;;) {
      while (p < b.length && /\s/.test(String.fromCharCode(b[p]!))) p++;
      if (b[p] === 0x23) { while (p < b.length && b[p] !== 10) p++; continue; } // comment
      break;
    }
    const a = p;
    while (p < b.length && !/\s/.test(String.fromCharCode(b[p]!))) p++;
    return b.subarray(a, p).toString('latin1');
  };
  assert.equal(tok(), 'PF', 'colour PFM');
  const width = Number(tok());
  const height = Number(tok());
  const scale = Number(tok());
  p++; // the single whitespace after the scale
  const dv = new DataView(b.buffer, b.byteOffset + p);
  const le = scale < 0;
  return { width, height, get: (x, y, c) => dv.getFloat32((((height - 1 - y) * width + x) * 3 + c) * 4, le) };
}

test('external oracle: ImageMagick decodes our file to EXACTLY our samples', { skip: SKIP_MAGICK }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-radiance-'));
  try {
    const rnd = lcg(7);
    const w = 64, h = 8;
    // Rows 0-3 noise (exercises literal blocks), rows 4-7 flat (exercises runs).
    const frame = makeFrame(w, h, (_x, y) =>
      y < 4 ? [10 ** (rnd() * 6 - 3), 10 ** (rnd() * 6 - 3), 10 ** (rnd() * 6 - 3)] : [12.5, 0.125, 300]);
    const bytes = packRadiance(frame);
    const hdr = join(dir, 't.hdr');
    const pfm = join(dir, 't.pfm');
    writeFileSync(hdr, bytes);
    execFileSync('magick', [hdr, pfm]);

    const im = readPfm(pfm);
    assert.equal(im.width, w);
    assert.equal(im.height, h);

    // ImageMagick decodes byte * 2^(exp-136) with NO half-bucket offset (see the
    // file header). So reconstruct the RGBE bytes we wrote and compare against
    // THAT convention — the comparison is then exact, which is a far stronger
    // statement about our bytes than any tolerance would be.
    const rgbe = new Uint8Array(4);
    let checked = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        floatToRgbe(frame.data[o]!, frame.data[o + 1]!, frame.data[o + 2]!, rgbe, 0);
        const f = rgbe[3] === 0 ? 0 : 2 ** (rgbe[3]! - 136);
        for (let c = 0; c < 3; c++) {
          assert.equal(im.get(x, y, c), Math.fround(rgbe[c]! * f), `ImageMagick sample (${x},${y},${c})`);
          checked++;
        }
      }
    }
    assert.equal(checked, w * h * 3);

    // ...and our own reader sits exactly half a bucket above IM's, by design.
    const ours = readRadiance(bytes)!;
    for (let x = 0; x < w; x++) {
      const o = x * 4;
      floatToRgbe(frame.data[o]!, frame.data[o + 1]!, frame.data[o + 2]!, rgbe, 0);
      const f = rgbe[3] === 0 ? 0 : 2 ** (rgbe[3]! - 136);
      assert.ok(Math.abs(ours.data[o]! - (im.get(x, 0, 0) + 0.5 * f)) < 1e-9 * Math.max(1, ours.data[o]!),
        'our decode == IM decode + half a bucket');
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('external oracle: we read a file ImageMagick wrote (its RLE, its header)', { skip: SKIP_MAGICK }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-radiance-'));
  try {
    const w = 40, h = 6;
    const rnd = lcg(99);
    const want = new Float32Array(w * h * 3);
    const buf = Buffer.alloc(w * h * 3 * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        for (let c = 0; c < 3; c++) {
          const v = x < 20 ? 0.5 : 10 ** (rnd() * 4 - 2); // left half constant: RLE bait
          want[(y * w + x) * 3 + c] = v;
          buf.writeFloatBE(v, (((h - 1 - y) * w + x) * 3 + c) * 4); // PFM is bottom-up
        }
      }
    }
    const pfm = join(dir, 'in.pfm');
    const hdr = join(dir, 'im.hdr');
    writeFileSync(pfm, Buffer.concat([Buffer.from(`PF\n${w} ${h}\n1.0\n`, 'latin1'), buf]));
    // `-set colorspace RGB` declares the input already linear; without it IM
    // applies an sRGB decode on the way in and the comparison is meaningless
    // (verified — it produced srgbToLinear(0.5) = 0.2144 for our 0.5s).
    execFileSync('magick', [pfm, '-set', 'colorspace', 'RGB', hdr]);

    const bytes = new Uint8Array(readFileSync(hdr));
    const head = parseRadianceHeader(bytes);
    assert.ok(head, "we parse ImageMagick's header");
    assert.equal(head.width, w);
    assert.equal(head.height, h);
    assert.equal(head.format, RADIANCE_FORMAT);
    assert.deepEqual([...bytes.subarray(head.dataOffset, head.dataOffset + 4)], [2, 2, w >> 8, w & 0xff],
      'IM writes new-style RLE, so this exercises the RLE reader against a foreign encoder');
    assert.ok(bytes.length < head.dataOffset + 4 * w * h, 'and it really is compressed');

    const frame = readRadiance(bytes);
    assert.ok(frame, "we decode ImageMagick's file");
    assert.equal(frame.width, w);
    assert.equal(frame.height, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const mx = Math.max(want[(y * w + x) * 3]!, want[(y * w + x) * 3 + 1]!, want[(y * w + x) * 3 + 2]!);
        for (let c = 0; c < 3; c++) {
          const err = Math.abs(frame.data[(y * w + x) * 4 + c]! - want[(y * w + x) * 3 + c]!);
          // Cross-implementation: a full bucket, because IM's encoder rounds
          // where Radiance's truncates. Same derivation, one bit looser.
          assert.ok(err <= bound(mx) * 2, `(${x},${y},${c}) err ${err} > ${bound(mx) * 2}`);
        }
      }
    }
    // IM's own PRIMARIES line is all zeros (it writes a placeholder), which must
    // not be mistaken for a real gamut — we fall back to the documented default.
    assert.equal(frame.space, 'srgb-linear');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('external oracle: ImageMagick reads our flat (non-RLE) file too', { skip: SKIP_MAGICK }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-radiance-'));
  try {
    const frame = makeFrame(16, 4, (x, y) => [(x + 1) / 4, (y + 1) / 2, 3]);
    const hdr = join(dir, 'flat.hdr');
    const pfm = join(dir, 'flat.pfm');
    writeFileSync(hdr, packRadiance(frame, { rle: false }));
    execFileSync('magick', [hdr, pfm]);
    const im = readPfm(pfm);
    const rgbe = new Uint8Array(4);
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 16; x++) {
        const o = (y * 16 + x) * 4;
        floatToRgbe(frame.data[o]!, frame.data[o + 1]!, frame.data[o + 2]!, rgbe, 0);
        const f = 2 ** (rgbe[3]! - 136);
        assert.equal(im.get(x, y, 0), Math.fround(rgbe[0]! * f), `flat sample (${x},${y})`);
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
