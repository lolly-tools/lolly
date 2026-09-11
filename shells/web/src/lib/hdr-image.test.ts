// SPDX-License-Identifier: MPL-2.0
/*
 * hdr-image.ts - the SDR→cICP-PNG path proven on an iPad Pro (plan 154 WP-5).
 * Run: node --test shells/web/src/lib/hdr-image.test.ts
 *
 * No decoder needed: the container (signature, 16-bit IHDR, cICP tag) is checked
 * by walking chunks, and the exposure is pinned by its two contract properties -
 * lights are lifted by the peak, darks are not.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { hdrPngBytes, hdrExposedLinearRgba } from './hdr-image.ts';

/** The data of the first chunk of `type`, or null. */
function chunk(png: Uint8Array, type: string): Uint8Array | null {
  let o = 8; // past the signature
  while (o + 8 <= png.length) {
    const len = (png[o]! << 24) | (png[o + 1]! << 16) | (png[o + 2]! << 8) | png[o + 3]!;
    const t = String.fromCharCode(png[o + 4]!, png[o + 5]!, png[o + 6]!, png[o + 7]!);
    if (t === type) return png.slice(o + 8, o + 8 + len);
    o += 12 + len;
  }
  return null;
}

/** Opaque RGBA from a list of [r,g,b] bytes. */
function rgba(px: [number, number, number][]): Uint8ClampedArray {
  const a = new Uint8ClampedArray(px.length * 4);
  px.forEach(([r, g, b], i) => { a[i * 4] = r; a[i * 4 + 1] = g; a[i * 4 + 2] = b; a[i * 4 + 3] = 255; });
  return a;
}

test('writes a valid 16-bit Rec.2100-PQ cICP PNG', () => {
  const png = hdrPngBytes(rgba([[255, 255, 255], [128, 128, 128]]), 2, 1, 'display-p3-linear');
  assert.deepEqual([...png.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], 'PNG signature');
  const ihdr = chunk(png, 'IHDR');
  assert.ok(ihdr, 'IHDR present');
  assert.equal(ihdr![8], 16, '16 bits per sample');
  assert.equal(ihdr![9], 6, 'colour type 6 (RGBA)');
  const cicp = chunk(png, 'cICP');
  assert.ok(cicp, 'cICP present');
  assert.deepEqual([...cicp!], [9, 16, 0, 1], 'Rec.2100 PQ, full range');
});

test('the 8-bit live-preview path is a valid cICP PNG at depth 8', () => {
  const png = hdrPngBytes(rgba([[255, 255, 255], [0, 0, 0]]), 2, 1, 'display-p3-linear', {}, 8);
  const ihdr = chunk(png, 'IHDR');
  assert.equal(ihdr![8], 8, '8 bits per sample');
  assert.deepEqual([...chunk(png, 'cICP')!], [9, 16, 0, 1], 'still tagged Rec.2100 PQ');
  // 8-bit is materially smaller than 16-bit for the same image - the point of it.
  const png16 = hdrPngBytes(rgba([[255, 255, 255], [0, 0, 0]]), 2, 1, 'display-p3-linear', {}, 16);
  assert.ok(png.length < png16.length, `8-bit (${png.length}) should be smaller than 16-bit (${png16.length})`);
});

test('hdrExposedLinearRgba (Tier A source) lifts white past 1.0 and holds darks', () => {
  const out = hdrExposedLinearRgba(rgba([[255, 255, 255], [20, 20, 20]]), 2, 1, 'display-p3-linear');
  // White rode into headroom: linear well above SDR white (1.0).
  assert.ok(out[0]! > 2, `white should exceed 1.0 in linear, got ${out[0]}`);
  // A dark pixel sits below the kneeLo gate, so it is left at its SDR linear value.
  assert.ok(out[4]! < 0.02, `dark should stay near SDR linear, got ${out[4]}`);
  // Alpha is preserved (and clamped to [0,1]).
  assert.equal(out[3], 1);
});

test('the exposure lifts lights but holds darks', () => {
  // White is boosted at 1000 nits and not at 203 (maxGain 1), so the bytes differ.
  const white = rgba([[255, 255, 255]]);
  assert.notDeepEqual(
    [...hdrPngBytes(white, 1, 1, 'srgb-linear', { peakNits: 1000 })],
    [...hdrPngBytes(white, 1, 1, 'srgb-linear', { peakNits: 203 })],
    'white rides into headroom at 1000 nits',
  );
  // A dark pixel sits well below the kneeLo gate, so the peak cannot move it.
  const dark = rgba([[20, 20, 20]]);
  assert.deepEqual(
    [...hdrPngBytes(dark, 1, 1, 'srgb-linear', { peakNits: 1000 })],
    [...hdrPngBytes(dark, 1, 1, 'srgb-linear', { peakNits: 203 })],
    'darks hold at SDR luminance regardless of the peak',
  );
});

test('peakNits is a continuous headroom axis: white rises monotonically with it', () => {
  // The Lab's nits slider spans this axis (plan 154 WP-5). Every step of the peak has
  // to lift white further, or the control would be inert between its endpoints - so
  // the floor (SDR white, no boost) < a mid peak < the default 1000.
  const white = rgba([[255, 255, 255]]);
  const whiteLin = (peakNits: number): number =>
    hdrExposedLinearRgba(white, 1, 1, 'srgb-linear', { peakNits })[0]!;
  const floor = whiteLin(203);   // maxGain 1 → no lift
  const mid = whiteLin(600);
  const top = whiteLin(1000);
  assert.ok(Math.abs(floor - 1) < 1e-6, `at SDR white the gain is 1, got ${floor}`);
  assert.ok(mid > floor, `a mid peak lifts white above the floor (${mid} > ${floor})`);
  assert.ok(top > mid, `the default peak lifts it further still (${top} > ${mid})`);
});
