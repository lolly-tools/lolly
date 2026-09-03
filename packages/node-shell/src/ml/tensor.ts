// SPDX-License-Identifier: MPL-2.0
/**
 * RGBA to NCHW float packing - the one arithmetic every ONNX vision model on
 * these rosters starts with.
 *
 * Every net here takes [1,3,H,W] float32 planes in RGB order with the alpha
 * dropped; they differ only in the mean and std applied after the 1/255 scale.
 * So there is one loop with the mean/std passed in, and a named [0,1] shorthand
 * for the nets that want the raw scale (Real-ESRGAN, GFPGAN's detector).
 *
 * KNOWN DUPLICATE, deliberately left: shells/web/src/lib/ort.ts carries its own
 * `packNchw01` for the trustmark and contentseal detectors, which have nothing
 * else to do with this package. Folding those in means editing a module three
 * unrelated web features import, for ten lines of arithmetic. If ort.ts is ever
 * split for another reason, point it here.
 */

/** RGBA (0..255) at w x h to CHW float32, per channel (v/255 - mean)/std. */
export function packNchw(
  rgba: ArrayLike<number>, w: number, h: number, mean: [number, number, number], std: [number, number, number],
): Float32Array {
  const out = new Float32Array(3 * w * h);
  const plane = w * h;
  const len = w * h * 4;
  for (let i = 0, px = 0; i < len; i += 4, px++) {
    out[px] = ((rgba[i] ?? 0) / 255 - mean[0]) / std[0];
    out[plane + px] = ((rgba[i + 1] ?? 0) / 255 - mean[1]) / std[1];
    out[2 * plane + px] = ((rgba[i + 2] ?? 0) / 255 - mean[2]) / std[2];
  }
  return out;
}

const ZERO: [number, number, number] = [0, 0, 0];
const ONE: [number, number, number] = [1, 1, 1];

/** RGBA (0..255) at w x h to CHW float32 in [0,1] - no mean, no std. */
export function packNchw01(rgba: ArrayLike<number>, w: number, h: number): Float32Array {
  return packNchw(rgba, w, h, ZERO, ONE);
}
