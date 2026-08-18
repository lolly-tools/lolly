// SPDX-License-Identifier: MPL-2.0
/**
 * Chroma / colour-range keying: remove a flat background colour by PERCEPTUAL
 * distance, so clean footage shot against an evenly-lit wall or screen keys out
 * without the neural matte model at all (plans/124 WP-G). Deterministic,
 * per-pixel, model-free - the dual of lib/matter.ts's learned alpha.
 *
 * ── Why OKLab, not raw RGB ────────────────────────────────────────────────────
 * The distance that drives the key is Euclidean distance in OKLab (the same
 * ΔEOK metric color-tools.ts uses for gamut mapping and palette spacing), not a
 * raw sRGB channel distance. OKLab is perceptually uniform, so a fixed tolerance
 * radius is an even "how different does this look" band in every hue - a
 * near-key colour keys and an equally-far-in-RGB but perceptually-distinct
 * colour does not, which is exactly what a spill/edge-tolerant key wants. The
 * conversion reuses brand-derive.ts's exported sRGB→linear→OKLab core, so a
 * colour keys the same here as it would anywhere else in the engine.
 *
 * Pure and DOM-free (the color-tools.ts contract): no Date, no Math.random, no
 * IO. Same pixels + same key + same tolerance/softness ⇒ byte-identical output,
 * so web and CLI read identical numbers.
 */

import { srgbToLinear, linearSrgbToOklab } from './brand-derive.ts';

/** Options for {@link chromaKeyAlpha}. Distances are in OKLab (ΔEOK) units: 0 is
 *  the key itself, black↔white ≈ 1, a just-noticeable difference ≈ 0.02. */
export interface ChromaKeyOptions {
  /** The background colour to remove, one sRGB byte per channel (0..255). */
  keyColor: [number, number, number];
  /** OKLab distance at/below which a pixel is fully cut (alpha → 0). Clamped ≥ 0. */
  tolerance: number;
  /** Ramp width above `tolerance` over which alpha climbs back to fully opaque -
   *  the soft, feathered edge. Clamped to a tiny positive floor (no hard 1-bit edge). */
  softness: number;
  /** 0..1 spill suppression on the SOFT-edge pixels only: desaturate them toward
   *  their own luma so a residual key-colour rim (green/blue cast) does not survive.
   *  Toward luma = toward neutral grey, which removes the colour cast without
   *  inventing a hue. 0 (default) leaves RGB untouched. */
  spill?: number;
}

/** A pixel's OKLab coordinates from sRGB bytes (0..255). */
function rgbToOklab(r: number, g: number, b: number): [number, number, number] {
  return linearSrgbToOklab(srgbToLinear(r / 255), srgbToLinear(g / 255), srgbToLinear(b / 255));
}

/**
 * Remove a flat background colour by OKLab distance, returning a FRESH RGBA
 * buffer (the source is never mutated).
 *
 * For each pixel, `d` is its OKLab distance to `keyColor`:
 *   - `d ≤ tolerance`                → fully cut (alpha 0),
 *   - `d ≥ tolerance + softness`     → fully kept (alpha unchanged),
 *   - in between                     → alpha scaled linearly by `(d - tolerance) / softness`,
 *     the soft edge.
 * RGB is untouched except that soft-edge pixels are optionally de-spilled toward
 * their own luma (see `spill`). A colour key invents no colour: opaque interior
 * pixels keep their exact RGB.
 *
 * `width`/`height` bound the pixel walk (`min(width·height, ⌊rgba.length/4⌋)`);
 * a short buffer is simply keyed as far as it reaches.
 */
export function chromaKeyAlpha(
  rgba: Uint8ClampedArray, width: number, height: number, opts: ChromaKeyOptions,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba); // copy: never mutate the caller's frame
  const [kr, kg, kb] = opts.keyColor;
  const [kL, ka, kbb] = rgbToOklab(kr, kg, kb);
  const tol = Math.max(0, opts.tolerance);
  const soft = Math.max(1e-4, opts.softness);
  const sp = Math.max(0, Math.min(1, opts.spill ?? 0));

  const n = Math.min(Math.max(0, Math.floor(width * height)), Math.floor(out.length / 4));
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    const r = out[i]!, g = out[i + 1]!, b = out[i + 2]!;
    const [L, a, bb] = rgbToOklab(r, g, b);
    const d = Math.hypot(L - kL, a - ka, bb - kbb);

    let keep: number;
    if (d <= tol) keep = 0;
    else if (d >= tol + soft) keep = 1;
    else keep = (d - tol) / soft;

    // De-spill the soft edge only: desaturate toward the pixel's own luma,
    // strongest where it is most transparent, scaled by the spill amount.
    if (sp > 0 && keep > 0 && keep < 1) {
      const y = 0.299 * r + 0.587 * g + 0.114 * b;
      const f = (1 - keep) * sp;
      out[i] = r + (y - r) * f;
      out[i + 1] = g + (y - g) * f;
      out[i + 2] = b + (y - b) * f;
    }
    out[i + 3] = Math.round(out[i + 3]! * keep);
  }
  return out;
}
