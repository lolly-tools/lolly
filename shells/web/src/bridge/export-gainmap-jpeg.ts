// SPDX-License-Identifier: MPL-2.0
/**
 * HDR JPEG as an ISO 21496-1 gain-map file - Phase B2 of
 * plans/61-deeprichpixels.md (section 4.2, section 6 B, section 10 item 2), and the sibling of
 * `export-hdr-png.ts`.
 *
 * Before this module, `?hdr=1&format=jpeg` ran the canvas through the engine's
 * legacy byte path (`hdrBoostToPQ`: 8-bit in, 8-bit PQ code values out) and
 * tagged the result with a Rec.2100-PQ ICC profile. Two defects in one file:
 * PQ quantised to 8 bits bands in the shadows (plan section 1's sharpest recorded
 * defect), and a PQ-tagged JPEG shown by any decoder that ignores the profile - 
 * which is most of them - is a washed-out, wrongly-lit picture, because PQ code
 * values interpreted as sRGB are simply the wrong numbers. The SDR "fallback"
 * of the old path was not a fallback at all.
 *
 * A gain-map JPEG inverts that. The file IS an ordinary SDR JPEG; the HDR lives
 * in a second, appended image saying how much brighter each pixel gets, plus
 * metadata saying how to apply it. Chromium, Safari/macOS/iOS and Android 15
 * render it as real HDR; everything else renders the SDR base byte for byte.
 * It is the only HDR still-image output with that property today.
 *
 *   canvas RGBA8 -> (imprint / durable marks, in the DELIVERED SDR space)
 *                -> encodeJpeg            == the base image, and the fallback
 *                -> fromU8Srgb            (linear f32)
 *                -> hdrViewTransform      (brand boost, Rec.2020 linear, unbounded)
 *                -> computeGainMap        (log2(HDR/SDR), one luminance channel)
 *                -> encodeJpeg (grey)     == the gain-map image
 *                -> assembleGainMapJpeg   (MPF + dual XMP/ISO metadata)
 *
 * ─── One rasterisation, and why the two images are pixel-aligned ─────────────
 * `hdrViewTransform` derives the HDR rendition FROM the SDR frame, so the pair
 * is aligned by construction - there is no second render, no re-layout, and no
 * chance of a half-pixel drift between base and map. This is also what plan section 10
 * means by depth-follows-provenance on this path: the map's values come from
 * the float view transform, never from an upsampled 8-bit intermediate.
 *
 * ─── depth= interaction ──────────────────────────────────────────────────────
 * `depth=8` OPTS OUT to the legacy PQ path (the gate lives in `renderRaster`),
 * because unlike the PNG case there is a coherent 8-bit answer here and a caller
 * asking for one may have a reason. Everything else - 16/float/auto/absent - 
 * takes this path; `float` is noted and satisfied by the map, since JPEG has no
 * deep sample format of its own.
 *
 * ─── What the marks apply to ─────────────────────────────────────────────────
 * `imprint` and `durable` are applied to the SDR pixels BEFORE the base is
 * encoded, so the mark lives in the delivered base image - the one every viewer
 * and every detector actually sees. The gain map is then computed from the
 * MARKED pixels, so the HDR rendition a gain-map-aware viewer reconstructs is
 * the marked image boosted, not a different picture. (The legacy path marked
 * after the PQ transform for the same reason: marks belong in the delivered
 * space.)
 *
 * DOM-free on purpose, exactly like `export-hdr-png.ts`: pixels in, bytes out,
 * with the one genuinely DOM-bound step - JPEG encoding - injected as
 * `encodeJpeg`. That is what lets the whole seam be driven under node:test with
 * real JPEG fixtures and no canvas (export-gainmap-jpeg.test.ts).
 */
import type { ExportMeta } from '@lolly-tools/core/host-v1';
import { fromU8Srgb } from '../../../../engine/src/pixels.ts';
import { hdrViewTransform } from '../../../../engine/src/hdr.ts';
import type { HdrBoostOptions } from '../../../../engine/src/hdr.ts';
import { computeGainMap } from '../../../../engine/src/gainmap.ts';
import type { GainMapOptions, GainMapStats } from '../../../../engine/src/gainmap.ts';
import { assembleGainMapJpeg } from '../../../../engine/src/gainmap-jpeg.ts';
import { scanJpegSegments } from '../../../../engine/src/jpeg-segments.ts';
import { embedWatermark } from '../../../../engine/src/pixel-watermark.ts';
import { patchJpegDpi, insertJpegExif, insertJpegIcc } from './export-image-meta.ts';

/**
 * The smallest fitted log2 gain worth shipping a whole second image for. Below
 * this the map carries no light and its capacity range would be degenerate, so
 * the export falls back to a plain SDR JPEG. ~0.004 log2 is well under a 1/255
 * code step at any realistic span, i.e. invisible by construction.
 */
const NO_BOOST_EPS = 1 / 256;

export interface GainMapJpegOpts {
  width: number;
  height: number;
  /** Brand targets + the author's tuned dials, exactly as the legacy path passes them. */
  hdr: HdrBoostOptions;
  /**
   * Encode straight (un-premultiplied) RGBA to JPEG bytes. The shell hands over
   * a canvas-backed encoder; the test hands over pre-encoded fixtures. Called
   * twice - once for the SDR base, once for the greyscale gain map.
   */
  encodeJpeg: (rgba: Uint8ClampedArray, width: number, height: number, kind: 'base' | 'map') => Promise<Uint8Array>;
  /** Physical resolution -> the base image's JFIF density. Omitted/<=0 leaves it alone. */
  dpi?: number;
  /** Provenance fields -> EXIF on the base image, via the shared splicer. */
  meta?: ExportMeta | null;
  /**
   * ICC profile for the BASE image. This is an SDR JPEG now, so the honest tag
   * is the render's own space (sRGB) - not the Rec.2100-PQ profile the legacy
   * HDR path stamped. Null writes none.
   */
  icc?: Uint8Array | null;
  /** Apply the default-on pixel imprint (JPEG keeps the quantisation-calibrated default strength). */
  imprint?: boolean;
  /** Imprint strength override; undefined = engine default. */
  imprintStrength?: number;
  /** Durable (TrustMark) embed, injected so this module stays DOM/model-free. */
  durable?: (rgba: Uint8ClampedArray, width: number, height: number) => Promise<Uint8Array | Uint8ClampedArray | null>;
  /** Gain-map fitting knobs (gamma/offsets/forced range). Engine defaults are the right ones. */
  gainMap?: GainMapOptions;
  /** The `depth` URL param as requested. See the header - 8 never reaches here. */
  depth?: 8 | 16 | 'float' | 'auto';
  log?: (level: 'info' | 'warn', msg: string) => void;
}

export interface GainMapJpegResult {
  bytes: Uint8Array;
  /** Byte length of the SDR base image AS DELIVERED (metadata included) - the perfect fallback every other decoder sees. */
  baseLength: number;
  /** Byte length of the appended gain-map image. */
  mapLength: number;
  stats: GainMapStats;
}

/**
 * Encode canvas pixels as a gain-map HDR JPEG. Returns the complete file bytes
 * plus the diagnostics the caller may want to log.
 *
 * Throws on genuinely unusable input (bad dimensions, an encoder that does not
 * return a JPEG, a container that will not assemble) - `renderRaster` catches
 * and falls back to the legacy PQ path, so an HDR export is never lost.
 */
export async function encodeGainMapJpeg(rgba: Uint8ClampedArray, o: GainMapJpegOpts): Promise<GainMapJpegResult> {
  const { width, height } = o;
  const log = o.log ?? (() => {});
  if (!(width > 0) || !(height > 0) || rgba.length !== width * height * 4) {
    throw new Error(`encodeGainMapJpeg: ${rgba.length} samples for ${width}x${height} (expected ${width * height * 4}).`);
  }
  if (o.depth === 'float') {
    log('info', 'jpeg: depth=float satisfied by a gain map - JPEG has no float sample format, so the extra range rides in the appended gain-map image (use EXR or a float TIFF for float samples).');
  }

  // ── the delivered SDR pixels: marks first, so base and map agree ───────────
  let sdrPixels: Uint8ClampedArray = rgba;
  if (o.imprint) {
    const marked = embedWatermark(sdrPixels, {
      width, height,
      ...(o.imprintStrength !== undefined ? { strength: o.imprintStrength } : {}),
    });
    if (marked.length === sdrPixels.length) sdrPixels = Uint8ClampedArray.from(marked);
  }
  if (o.durable) {
    try {
      const marked = await o.durable(sdrPixels, width, height);
      if (marked && marked.length === sdrPixels.length) sdrPixels = Uint8ClampedArray.from(marked);
    } catch { /* best-effort, exactly like durableEmbedCanvas */ }
  }

  // ── the base image: an ordinary SDR JPEG, stamped exactly like a plain one ──
  let base = await o.encodeJpeg(sdrPixels, width, height, 'base');
  if (!isJpeg(base)) throw new Error('encodeGainMapJpeg: base encoder did not return JPEG bytes');
  if (o.dpi && o.dpi > 0) base = patchJpegDpi(base, o.dpi);
  base = insertJpegExif(base, o.meta);
  if (o.icc) base = insertJpegIcc(base, o.icc);

  // ── the gain map: log2(HDR / SDR), computed in the engine's float pipeline ──
  const sdrFrame = fromU8Srgb(sdrPixels, width, height);
  const hdrFrame = hdrViewTransform(sdrFrame, o.hdr);
  const gm = computeGainMap(sdrFrame, hdrFrame, o.gainMap ?? {});
  // NO USABLE BOOST -> NO GAIN MAP. When the view transform lifts nothing (a dark
  // frame, no brand target matched, dials at zero) the fitted max is ~0, which
  // would serialise hdrCapacityMin == hdrCapacityMax - a range the Adobe spec
  // forbids and that makes the standard decoder weight formula 0/0. Attaching a
  // map that carries no light is also exactly the padding-as-quality this plan
  // refuses (section 10, depth follows provenance), so ship the plain SDR JPEG instead.
  if (gm.meta.gainMapMax <= NO_BOOST_EPS) {
    log('info', 'jpeg: the HDR view transform found nothing to boost - writing a plain SDR JPEG rather than a gain map that carries no extra light.');
    return { bytes: base, baseLength: base.length, mapLength: 0, stats: gm.stats };
  }
  if (gm.stats.degenerate) {
    // A CONSTANT map that still asks for real gain (a uniform frame lifted as a
    // whole) - valid and worth keeping, unlike the no-boost case above.
    log('info', `jpeg: gain map is constant at ${gm.meta.gainMapMax.toFixed(3)} log2 (a uniform frame lifted as a whole).`);
  }
  const mapRgba = greyToRgba(gm.map, width, height);
  const mapJpeg = await o.encodeJpeg(mapRgba, width, height, 'map');
  if (!isJpeg(mapJpeg)) throw new Error('encodeGainMapJpeg: gain-map encoder did not return JPEG bytes');

  // ── the container: MPF + Ultra HDR XMP + ISO 21496-1, all in the engine ────
  const bytes = assembleGainMapJpeg(base, mapJpeg, gm.meta);
  // Measured off the FINISHED file, not the pre-assembly buffers: assembly adds
  // the XMP/MPF segments to the base, so `base.length` would understate what a
  // gain-map-blind decoder actually reads.
  const baseLength = scanJpegSegments(bytes)?.trailerStart ?? bytes.length;
  return { bytes, baseLength, mapLength: bytes.length - baseLength, stats: gm.stats };
}

/** SOI check - the encoder is injected, so its output is not taken on trust. */
function isJpeg(b: Uint8Array | null | undefined): b is Uint8Array {
  return !!b && b.length > 3 && b[0] === 0xff && b[1] === 0xd8;
}

/**
 * Splay the single-channel map across RGB (alpha opaque) so it can go through a
 * canvas JPEG encoder, which has no greyscale mode. R=G=B means the file decodes
 * identically whether a reader takes the luma plane, the red channel, or the
 * whole pixel - and `meta.channels === 1` tells it which to expect.
 */
function greyToRgba(map: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const n = width * height;
  const out = new Uint8ClampedArray(n * 4);
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    const v = map[p]!;
    out[i] = v; out[i + 1] = v; out[i + 2] = v; out[i + 3] = 255;
  }
  return out;
}
