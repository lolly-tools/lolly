// SPDX-License-Identifier: MPL-2.0
/**
 * Is a freshly rendered preview the same PICTURE as the committed one?
 *
 * The preview render path is not byte-stable: Playwright rasterises with
 * sub-pixel jitter, the Lolly Imprint perturbs pixels, and the C2PA stamp
 * carries a timestamp and a fresh signature. So an ungated `loldev previews`
 * rewrote every file with new bytes; the OG input-hash gate (build-tool-og.ts)
 * hashes the preview bytes and therefore re-rendered every share card too, and
 * one ship added roughly 20 MB of PNG/WebP history that git can never delta.
 * Measured 2026-08-30: 318 MB of the parent repo's 393 MB pack was this churn.
 *
 * The docs-shots pipeline solved the same problem by comparing pictures, not
 * bytes, and keeping the committed baseline verbatim when they match
 * (scripts/lib/shot-compare.ts). This module is that rule for previews.
 *
 * Vector: string equality after the C2PA block is stripped from both sides -
 * the DOM to SVG walker is deterministic. Raster: decode both and apply the
 * shots thresholds - same dimensions and at most `pixelDiffFrac` of pixels
 * differing by more than `pixelTol` on any channel. Anything that fails to
 * decode answers "changed", so the caller writes: a wrongly kept stale preview
 * is worse than one more rewrite.
 */
import { pixelDiffFraction, stripSvgC2pa, DEFAULT_THRESHOLDS, type RawImage, type ShotThresholds } from './shot-compare.ts';

export type RasterDecoder = (bytes: Uint8Array) => Promise<RawImage>;

/** A sharp-backed decoder, or null when sharp is not installed (rasters then always write). */
export async function sharpDecoder(): Promise<RasterDecoder | null> {
  try {
    const sharp = (await import('sharp')).default;
    return async (bytes) => {
      const { data, info } = await sharp(Buffer.from(bytes)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      return { width: info.width, height: info.height, data };
    };
  } catch {
    return null;
  }
}

const text = (b: Uint8Array | string): string => (typeof b === 'string' ? b : new TextDecoder().decode(b));

/** Same SVG document once each side's C2PA block is removed (a fresh unstamped render compares too). */
export function svgPreviewUnchanged(existing: Uint8Array | string, fresh: Uint8Array | string): boolean {
  return stripSvgC2pa(text(existing)) === stripSvgC2pa(text(fresh));
}

/** Same picture within the shots thresholds; false on any decode failure or size change. */
export async function rasterPreviewUnchanged(
  existing: Uint8Array, fresh: Uint8Array, decode: RasterDecoder, t: ShotThresholds = DEFAULT_THRESHOLDS,
): Promise<boolean> {
  try {
    const [a, b] = await Promise.all([decode(existing), decode(fresh)]);
    const frac = pixelDiffFraction(a, b, t.pixelTol);
    return frac !== null && frac <= t.pixelDiffFrac;
  } catch {
    return false;
  }
}

/** One door for both forms. `ext` is the on-disk extension the writer is about to use. */
export async function previewUnchanged(
  ext: string, existing: Uint8Array, fresh: Uint8Array, decode: RasterDecoder | null,
): Promise<boolean> {
  if (ext === 'svg') return svgPreviewUnchanged(existing, fresh);
  if (!decode) return false;
  return rasterPreviewUnchanged(existing, fresh, decode);
}
