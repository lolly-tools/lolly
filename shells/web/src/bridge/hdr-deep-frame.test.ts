// SPDX-License-Identifier: MPL-2.0
/**
 * hdr-deep-frame.test.ts - plan 154 WP-3.
 *
 * The claim this file exists to prove, asserted WITHOUT an HDR display: the deep float encode path
 * (hdrDeepI420P10) preserves >8-bit precision that today's 8-bit path (hdrBoostToPQ)
 * bands away. Both run the SAME brand boost on the SAME pixels; the only difference is
 * that the 8-bit path quantises the boosted PQ to 256 codes and the deep path carries it
 * to 10-bit - so a boosted highlight ramp that collapses adjacent levels at 8-bit
 * survives distinct at 10-bit. Plus the plumbing (valid 10-bit buffer) and that the
 * flag/capability gates degrade safely with neither localStorage nor VideoFrame present.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hdrBoostToPQ } from '@lolly/engine';
import {
  hdrDeepI420P10,
  deepHdrCompositorEnabled,
  supportsI420P10Frame,
} from './hdr-deep-frame.ts';

// A 256x1 grey ramp as canvas RGBA: column i is grey (i,i,i,255). For a grey the deep
// path's luma code Y' equals the (equal) channels' PQ code, so its Y plane is directly
// comparable to the 8-bit path's R channel - both are the same boosted PQ value, one
// quantised to 8-bit full-range, one to 10-bit narrow-range.
function greyRampRgba(): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) {
    rgba[i * 4] = i; rgba[i * 4 + 1] = i; rgba[i * 4 + 2] = i; rgba[i * 4 + 3] = 255;
  }
  return rgba;
}

const HDR = { targets: ['#ffffff'] }; // white boost - the glow band where 8-bit PQ crushes

test('deep 10-bit PQ keeps highlight levels the 8-bit path bands away', () => {
  // 8-bit path (today): boost in place, read the R code per column.
  const eight = greyRampRgba();
  hdrBoostToPQ(eight, HDR);
  const r8 = Array.from({ length: 256 }, (_, i) => eight[i * 4]!);

  // Deep path (WP-3): float boost -> 10-bit I420P10; Y plane is the first 256 samples.
  const y10 = hdrDeepI420P10(greyRampRgba(), 256, 1, HDR);
  const yPlane = Array.from({ length: 256 }, (_, i) => y10[i]!);

  const distinct8 = new Set(r8).size;
  const distinct10 = new Set(yPlane).size;

  // The boost compresses the ramp into a PQ sub-range, so the 8-bit output cannot carry
  // all 256 source levels - it MUST collapse some. The 10-bit output keeps strictly more.
  assert.ok(distinct8 < 256, `8-bit PQ should band (collapse levels); got ${distinct8} distinct`);
  assert.ok(distinct10 > distinct8, `deep path must keep more levels: 10-bit ${distinct10} vs 8-bit ${distinct8}`);

  // And concretely: at least one adjacent source pair the 8-bit code merges, the 10-bit
  // code keeps apart - the banding, made numeric.
  let survivingPair = -1;
  for (let i = 1; i < 256; i++) {
    if (r8[i] === r8[i - 1] && yPlane[i] !== yPlane[i - 1]) { survivingPair = i; break; }
  }
  assert.ok(survivingPair > 0, 'expected a level pair that 8-bit merges but 10-bit keeps distinct');
});

test('hdrDeepI420P10 emits a valid tight-packed 10-bit I420P10 buffer', () => {
  const w = 6, h = 4;                     // even dims; chroma 3x2
  const buf = hdrDeepI420P10(new Uint8ClampedArray(w * h * 4).fill(200), w, h, HDR);
  const cw = (w + 1) >> 1, ch = (h + 1) >> 1;
  assert.equal(buf.length, w * h + 2 * cw * ch, 'Y ++ U ++ V tight-packed');
  for (const v of buf) assert.ok(v >= 0 && v <= 1023, `10-bit sample out of range: ${v}`);
});

test('flag + capability gates degrade safely with no localStorage / no VideoFrame', () => {
  // In node neither global exists; the gates must return false, never throw - that is the
  // "flag off / float target unavailable -> stay on the 8-bit path" degrade.
  assert.equal(deepHdrCompositorEnabled(), false);
  assert.equal(supportsI420P10Frame(), false);
});
