// SPDX-License-Identifier: MPL-2.0
/**
 * The Print TIFF pixel pass: straight sRGB RGBA in, packed CMYK bytes out.
 * Split out of export.ts so the hot loop and its yielding can be read and tested
 * on their own; renderCmykTiff owns the capture, the marks and the TIFF writer.
 */
import { cmykKey } from '@lolly/engine';
import type { PaletteHit } from './export-pdf-vector.ts';

// RGBA (0–255, sRGB) → packed CMYK bytes (0=no ink … 255=full ink), one tight
// numeric pass over the typed array. Transparency is flattened onto white (CMYK
// has no alpha channel and print stock is white). ~tens of ms for 1080², but a
// large print-DPI sheet runs long on the main thread, so the pass yields to the
// event loop every YIELD_ROWS scanlines (keeping the tab responsive) and reports
// row progress through opts.onProgress. paletteMap (built once by the caller from
// opts.palette, same as the CMYK PDF path) is consulted per pixel for an exact
// brand-swatch match before falling back to `ink`, the separation's raster
// evaluator (separationLattice: four table reads per pixel for a press profile).
// An empty map (the common case, no locks configured) skips the lookup entirely.
const YIELD_ROWS = 256;
export async function rgbaToCmyk(
  rgba: Uint8ClampedArray, W: number, H: number,
  paletteMap: Map<string, PaletteHit>,
  ink: (r8: number, g8: number, b8: number, out: Uint8Array, at: number) => void,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const out = new Uint8Array(W * H * 4);
  const hasPalette = paletteMap.size > 0;
  for (let row = 0; row < H; row++) {
    const base = row * W * 4;
    for (let i = base, end = base + W * 4; i < end; i += 4) {
      const a = rgba[i + 3]!;
      let r = rgba[i]!, g = rgba[i + 1]!, b = rgba[i + 2]!;
      if (a < 255) {                                 // composite over white
        const t = a / 255, u = 255 * (1 - t);
        r = r * t + u; g = g * t + u; b = b * t + u;
      }
      const hit = hasPalette ? paletteMap.get(cmykKey(r / 255, g / 255, b / 255)) : undefined;
      if (!hit) { ink((r + 0.5) | 0, (g + 0.5) | 0, (b + 0.5) | 0, out, i); continue; }
      const [c, m, y, k] = hit.cmyk;
      out[i]     = (c * 255 + 0.5) | 0;
      out[i + 1] = (m * 255 + 0.5) | 0;
      out[i + 2] = (y * 255 + 0.5) | 0;
      out[i + 3] = (k * 255 + 0.5) | 0;
    }
    if ((row + 1) % YIELD_ROWS === 0 && row + 1 < H) {
      onProgress?.(row + 1, H);
      signal?.throwIfAborted();      // the yield point is also the cancel point
      await new Promise<void>((r) => setTimeout(r));         // unblock the UI thread
    }
  }
  onProgress?.(H, H);
  return out;
}

