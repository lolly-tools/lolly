// SPDX-License-Identifier: MPL-2.0
/**
 * Multi-scale "photo-like" RGBA content — smooth low-frequency blobs +
 * mid-frequency ripples + mild grain, so real codecs (JPEG/crop/resize) behave
 * as they would on a photograph (unlike flat or purely periodic synthetic
 * fills), and there are plenty of non-flat 8x8 blocks for the imprint embed
 * floor (MIN_IMPRINT_BLOCKS; 384^2 = 2304 blocks).
 *
 * CALIBRATION CONTRACT: the pixel-watermark suites' measured envelopes — the
 * strength/threshold/floor constants asserted in
 * pixel-watermark-robustness.test.ts and watermark-search.test.ts — were
 * calibrated against exactly this generator. The three per-file copies this
 * replaced were bit-identical; do NOT change the math here without re-running
 * that calibration.
 *
 * Not collected by the test glob (only *.test.ts is); tests/tsconfig.json's
 * `./**\/*` include still typechecks it.
 */
export function photoLike(w: number, h: number, seed = 1): Uint8Array {
  const px = new Uint8Array(w * h * 4);
  let a = seed >>> 0;
  const rnd = (): number => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  const ph = [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28, rnd() * 6.28];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = (y * w + x) * 4;
    const lo = 90 + 60 * Math.sin((x / w) * 3 + ph[0]!) + 50 * Math.cos((y / h) * 2.3 + ph[1]!);
    const mid = 25 * Math.sin((x + y) / 18 + ph[2]!) + 20 * Math.cos((x - y) / 13 + ph[3]!);
    const v = Math.max(0, Math.min(255, lo + mid + (rnd() - 0.5) * 14));
    px[p] = v; px[p + 1] = Math.max(0, Math.min(255, v * 0.85 + 18));
    px[p + 2] = Math.max(0, Math.min(255, 235 - v * 0.7)); px[p + 3] = 255;
  }
  return px;
}
