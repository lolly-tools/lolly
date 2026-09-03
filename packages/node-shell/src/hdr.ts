// SPDX-License-Identifier: MPL-2.0
/**
 * HDR STILLS for the Node shells: a 16-bit Rec.2100-PQ PNG, and an ISO 21496-1
 * gain-map JPEG. The Node halves of `shells/web/src/bridge/export-hdr-png.ts`
 * and `shells/web/src/bridge/export-gainmap-jpeg.ts`
 * (plans/61-deeprichpixels.md Phase B1/B2, ported by plans/183 WS5).
 *
 * WHY IT EXISTS. Until this module, `lolly … --hdr=1 --export=png` produced an
 * ordinary 8-bit sRGB PNG: the Tier-A resvg path never saw `hdr=`, and the
 * Tier-B URL builder never forwarded it. Exit 0, no warning, no cICP chunk, and
 * a file identical to a run without the flag. Same for `--export=jpg`. A flag
 * that is accepted and then ignored is the failure mode this repo refuses
 * everywhere else (see `printPrepRefusal`, `deepSourceRefusal` in raster.ts), so
 * this one does not refuse: the whole encode is DOM-free engine code,
 * so the terminal can simply do it.
 *
 * THE PIXELS ARE THE SAME PIXELS. Both encoders are thin orchestration over the
 * engine's own float pipeline, called in the same order the web modules call it:
 *
 *   PNG   rgba8 -> fromU8Srgb -> hdrViewTransform -> pqEncodeFrame -> pqToU16
 *               -> packPng(depth 16, cICP 9/16/0/1, pHYs) -> iTXt -> iCCP
 *   JPEG  rgba8 -> (marks, in the delivered SDR space) -> encodeJpeg  == base
 *               -> fromU8Srgb -> hdrViewTransform -> computeGainMap
 *               -> encodeJpeg(grey)                                  == map
 *               -> assembleGainMapJpeg (MPF + XMP + ISO 21496-1)
 *
 * PORTED, NOT RE-DERIVED. Nothing here computes a number. Every value comes out
 * of `engine/src/{pixels,hdr,gainmap,gainmap-jpeg,png,pixel-watermark,image-meta}.ts`,
 * which the web modules call too, so a CLI HDR PNG of a frame is byte-identical
 * to a web HDR PNG of the SAME frame. What is duplicated is the ORDER of those
 * calls, for the same reason `hdrTune` in raster.ts is duplicated: this package
 * cannot import a web-shell-private module (`export-image-meta.ts` pulls a type
 * out of the web shell's 10k-line `export.ts`, whose DOM types this tsconfig has
 * no business checking). If one side's ordering moves, the other must move with
 * it - `packages/node-shell/test/hdr.test.ts` mirrors the web suite's assertions
 * so a divergence shows up as a failing test rather than as two HDR files.
 *
 * THE ONE THING THAT IS NOT BYTE-IDENTICAL, and why. The web gain-map path
 * injects the BROWSER's JPEG encoder (a canvas `toBlob`); Node has no canvas, so
 * this module injects sharp (libjpeg-turbo) instead. Two different JPEG encoders
 * cannot produce the same compressed bytes, so the CLI's gain-map JPEG differs
 * from the browser's at the entropy-coded layer. Everything above that layer is
 * identical: the SDR base pixels, the gain-map PLANE (`computeGainMap`'s bytes),
 * the fitted metadata, the MPF index and both metadata forms. The 16-bit HDR PNG
 * has no such seam - `packPng` writes it end to end - so that one IS byte-identical.
 *
 * DOM-free, like the modules it ports: RGBA8 in, file bytes out.
 */
import type { ExportMeta } from '@lolly-tools/core/host-v1';
import {
  fromU8Srgb, hdrViewTransform, pqEncodeFrame, pqToU16, HDR_PQ_CICP,
  embedWatermark, packPng,
  insertPngMeta, insertPngIcc, patchJpegDpi, insertJpegExif, insertJpegIcc,
} from '@lolly/engine';
import type { HdrBoostOptions } from '@lolly/engine';
// DEEP RELATIVE IMPORTS, not the `@lolly/engine` barrel: gainmap.ts,
// gainmap-jpeg.ts and jpeg-segments.ts are deliberately engine-internal (their
// own headers say so), and the web modules reach them the same way. Same
// precedent as exr.ts / radiance.ts in this package's raster.ts. Nothing was
// added to the barrel for this feature.
import { computeGainMap } from '../../../engine/src/gainmap.ts';
import type { GainMapOptions, GainMapStats } from '../../../engine/src/gainmap.ts';
import { assembleGainMapJpeg } from '../../../engine/src/gainmap-jpeg.ts';
import { scanJpegSegments } from '../../../engine/src/jpeg-segments.ts';
import { isImagesAvailable } from './images.ts';
import { hdrTune } from './raster.ts';
import type { DeepHdrRequest } from './raster.ts';

/** Straight (un-premultiplied) 8-bit RGBA, the shape `rasterizeSvgToRgba` returns
 *  and the shape a decoded PNG comes back as. */
export interface Rgba8Frame {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
}

/** A pixel mark applied to the delivered 8-bit frame, injected so this module
 *  stays model-free (the neural durable encoder is not a Node capability today). */
export type PixelMark = (
  rgba: Uint8ClampedArray, width: number, height: number,
) => Promise<Uint8Array | Uint8ClampedArray | null>;

export type DepthRequest = 8 | 16 | 'float' | 'auto';

export type HdrLog = (level: 'info' | 'warn', message: string) => void;

/**
 * The `hdr=` request (the 0 to 100 author dials plus the brand colours to boost) as
 * the engine's HdrBoostOptions. The dial mapping is `hdrTune` in raster.ts, the one
 * the CLI's EXR path already uses, so a `.hdr` file, an EXR and an HDR PNG of the
 * same link all agree on what "reach 45" means.
 */
export function hdrBoostOptions(req: DeepHdrRequest): HdrBoostOptions {
  return { targets: [...(req.targets ?? [])], ...hdrTune(req) };
}

/**
 * Filtered-byte ceiling for a deep HDR PNG, matching `HDR_PNG_DEFLATE_CAP` in the
 * web module and `packPng`'s own default: 1 GiB of scanlines (about 134 MP).
 * deflate.ts streams, so this is a sanity bound on the single returned buffer, not
 * a memory limit.
 */
export const HDR_PNG_DEFLATE_CAP = 1024 * 1024 * 1024;

export interface HdrPngOpts {
  /** Brand targets plus the author's tuned dials, exactly as the web path passes them. */
  hdr: HdrBoostOptions;
  /** Physical resolution to a pHYs chunk. Omitted or <= 0 writes none. */
  dpi?: number;
  /** Provenance fields to iTXt, via the engine's shared splicer. */
  meta?: ExportMeta | null;
  /** Rec.2100-PQ ICC profile bytes to iCCP (the caller passes pqBt2020IccProfile()). */
  icc?: Uint8Array | null;
  /** iCCP profile name. Defaults to the web path's 'Rec2100 PQ'. */
  iccName?: string;
  /** Apply the Lolly pixel Imprint. */
  imprint?: boolean;
  /** Imprint strength (PNG is lossless, so callers pass LOSSLESS_STRENGTH). */
  imprintStrength?: number;
  /** Durable (TrustMark) embed. No Node shell supplies one yet; the seam is here
   *  so the port is complete and a future encoder needs no change to this file. */
  durable?: PixelMark;
  /** The `depth` request. 8 is answered and explained, never obeyed - see below. */
  depth?: DepthRequest;
  /** Filtered-byte ceiling override (tests). */
  maxDeflateBytes?: number;
  log?: HdrLog;
}

/** 8-bit quantisation of a PQ signal, byte-identical to hdrBoostToPQ's own. */
const pq8 = (v: number): number => {
  const q = Math.round((Number.isFinite(v) ? v : 0) * 255);
  return q < 0 ? 0 : q > 255 ? 255 : q;
};

const clampU16 = (v: number): number => (v < 0 ? 0 : v > 65535 ? 65535 : v);

/**
 * Encode an 8-bit RGBA frame as a 16-bit Rec.2100-PQ PNG. Returns the complete
 * file bytes.
 *
 * `depth=8` is IGNORED with a logged note, exactly as the web path ignores it:
 * PQ is a 10/12-bit transfer by design, so quantising it to 8 bits bands the
 * shadows, which is the defect this path replaced. `depth=float` is noted and
 * satisfied at 16 (PNG has no float sample format; that is EXR's job).
 *
 * Throws only on genuinely unencodable input (bad dimensions, past the size
 * ceiling), so a caller can fall back rather than lose the export.
 */
export async function encodeHdrPng(frame: Rgba8Frame, o: HdrPngOpts): Promise<Uint8Array> {
  const { width, height } = frame;
  const rgba = asClamped(frame.data);
  const log = o.log ?? ((): void => {});
  if (!(width > 0) || !(height > 0) || rgba.length !== width * height * 4) {
    throw new Error(`encodeHdrPng: ${rgba.length} samples for ${width}x${height} (expected ${width * height * 4}).`);
  }
  if (o.depth === 8) {
    log('info', 'png: depth=8 ignored for an HDR export - PQ code values quantised to 8 bits band in the shadows, so HDR PNG is always written at 16 bits per channel.');
  } else if (o.depth === 'float') {
    log('info', 'png: depth=float satisfied at 16 bits - PNG has no float sample format (use EXR or a float TIFF for that).');
  }

  // The float path: this is where the extra bits are generated, by the boost
  // gain, the sRGB to Rec.2020 matrix and the PQ curve - three continuous
  // functions, so the low byte carries signal rather than a v*257 replication.
  const linear = hdrViewTransform(fromU8Srgb(rgba, width, height), o.hdr);
  const pq = pqEncodeFrame(linear, o.hdr.sdrWhiteNits);
  const deep = pqToU16(pq);

  // Pixel marks, computed in the delivered (PQ) space and applied at 16 bits, so
  // the top 8 bits carry exactly the pattern a detector expects while the low
  // byte keeps the PQ precision.
  if (o.imprint || o.durable) {
    const flat = new Uint8ClampedArray(rgba.length);
    for (let i = 0; i < flat.length; i += 4) {
      flat[i] = pq8(pq.data[i]!);
      flat[i + 1] = pq8(pq.data[i + 1]!);
      flat[i + 2] = pq8(pq.data[i + 2]!);
      flat[i + 3] = rgba[i + 3]!;
    }
    if (o.imprint) {
      const marked = embedWatermark(flat, {
        width, height,
        ...(o.imprintStrength !== undefined ? { strength: o.imprintStrength } : {}),
      });
      applyMarkDelta(deep, flat, marked);
      flat.set(marked); // chain, as the web path does: durable sees the imprinted pixels
    }
    if (o.durable) {
      try {
        const marked = await o.durable(flat, width, height);
        if (marked) applyMarkDelta(deep, flat, marked);
      } catch { /* best-effort, exactly like the web path's durable pass */ }
    }
  }

  const cap = o.maxDeflateBytes ?? HDR_PNG_DEFLATE_CAP;
  const filtered = (width * 8 + 1) * height; // 16-bit RGBA rows plus filter tags
  if (filtered > cap) {
    throw new Error(`png: ${width}x${height} at 16 bits is ${(filtered / (1024 * 1024)).toFixed(1)} MiB of scanlines, past the deep-PNG size ceiling`);
  }
  let bytes = packPng(deep, {
    width, height, channels: 4, depth: 16,
    cicp: { ...HDR_PQ_CICP },
    ...(o.dpi && o.dpi > 0 ? { dpi: o.dpi } : {}),
    maxDeflateBytes: cap,
  });
  // The engine's own splicers, the ones the 8-bit path uses, so the metadata
  // cannot drift between the two depths or between the two shells.
  bytes = insertPngMeta(bytes, o.meta);
  if (o.icc) bytes = await insertPngIcc(bytes, o.icc, o.iccName ?? 'Rec2100 PQ');
  return bytes;
}

/**
 * Add an 8-bit mark's per-sample delta to a 16-bit buffer at 16-bit scale (one
 * 8-bit step is 257 sixteenth-bit steps), leaving alpha alone.
 */
function applyMarkDelta(deep: Uint16Array, before: Uint8ClampedArray, after: Uint8Array | Uint8ClampedArray): void {
  // A short or mismatched mark buffer would read undefined, giving NaN deltas and
  // black pixels; the mark is best-effort, so no-op instead.
  if (after.length !== deep.length || before.length !== deep.length) return;
  for (let i = 0; i < deep.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const d = after[i + c]! - before[i + c]!;
      if (d !== 0) deep[i + c] = clampU16(deep[i + c]! + d * 257);
    }
  }
}

// ─── gain-map JPEG ───────────────────────────────────────────────────────────

/**
 * The smallest fitted log2 gain worth shipping a whole second image for, matching
 * the web module's NO_BOOST_EPS. Below this the map carries no light and its
 * capacity range would be degenerate, so the export writes a plain SDR JPEG.
 */
const NO_BOOST_EPS = 1 / 256;

/** JPEG quality for the SDR base, matching the web shell's JPEG_QUALITY (0.97).
 *  The gain map is a data plane, not a picture, and is always encoded at 1. */
export const JPEG_QUALITY = 0.97;

/** Encode straight RGBA to JPEG bytes. Called twice: the SDR base, then the map. */
export type JpegEncoder = (
  rgba: Uint8ClampedArray, width: number, height: number, kind: 'base' | 'map',
) => Promise<Uint8Array>;

export interface GainMapJpegOpts {
  /** Brand targets plus the author's tuned dials. */
  hdr: HdrBoostOptions;
  /**
   * The JPEG encoder. Defaults to sharp (libjpeg-turbo) - the ONE place this
   * module needs something the engine does not provide, because the web path
   * used the browser's canvas encoder here. Injectable so the seam can be driven
   * with fixtures under node:test, exactly as the web module's is.
   */
  encodeJpeg?: JpegEncoder;
  /** Base-image quality, 0..1. Defaults to JPEG_QUALITY. */
  quality?: number;
  /** Physical resolution to the base image's JFIF density. Omitted or <= 0 leaves it. */
  dpi?: number;
  /** Provenance fields to EXIF on the base image. */
  meta?: ExportMeta | null;
  /** ICC profile for the BASE image. This is an ordinary SDR JPEG, so the honest
   *  tag is the render's own space (sRGB), not a Rec.2100-PQ profile. */
  icc?: Uint8Array | null;
  /** Apply the Lolly pixel Imprint to the delivered SDR pixels. */
  imprint?: boolean;
  /** Imprint strength override; undefined keeps the engine default. */
  imprintStrength?: number;
  /** Durable (TrustMark) embed. See HdrPngOpts.durable. */
  durable?: PixelMark;
  /** Gain-map fitting knobs. The engine defaults are the right ones. */
  gainMap?: GainMapOptions;
  /** The `depth` request. Only 'float' says anything; 8 never reaches here. */
  depth?: DepthRequest;
  log?: HdrLog;
}

export interface GainMapJpegResult {
  bytes: Uint8Array;
  /** Byte length of the SDR base image AS DELIVERED (metadata included) - what a
   *  decoder that has never heard of gain maps reads. */
  baseLength: number;
  /** Byte length of the appended gain-map image. Zero when no map was attached. */
  mapLength: number;
  stats: GainMapStats;
}

/**
 * Encode an 8-bit RGBA frame as an ISO 21496-1 / Ultra HDR gain-map JPEG.
 *
 * The file IS an ordinary SDR JPEG; the HDR rides in a second, appended image
 * saying how much brighter each pixel gets. Chromium, Safari and Android 15
 * render it as real HDR; everything else renders the SDR base byte for byte.
 *
 * `imprint` and `durable` apply to the SDR pixels BEFORE the base is encoded, so
 * the mark is in the image every viewer and every detector sees, and the map is
 * computed from the MARKED pixels so base and map describe one picture.
 *
 * Throws on unusable input (bad dimensions, an encoder that does not return a
 * JPEG, a container that will not assemble).
 */
export async function encodeGainMapJpeg(frame: Rgba8Frame, o: GainMapJpegOpts): Promise<GainMapJpegResult> {
  const { width, height } = frame;
  const rgba = asClamped(frame.data);
  const log = o.log ?? ((): void => {});
  if (!(width > 0) || !(height > 0) || rgba.length !== width * height * 4) {
    throw new Error(`encodeGainMapJpeg: ${rgba.length} samples for ${width}x${height} (expected ${width * height * 4}).`);
  }
  if (o.depth === 'float') {
    log('info', 'jpeg: depth=float satisfied by a gain map - JPEG has no float sample format, so the extra range rides in the appended gain-map image (use EXR or a float TIFF for float samples).');
  }
  const encodeJpeg = o.encodeJpeg ?? sharpJpegEncoder(o.quality ?? JPEG_QUALITY);

  // The delivered SDR pixels: marks first, so base and map agree.
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
    } catch { /* best-effort, exactly like the web path's durable pass */ }
  }

  // The base image: an ordinary SDR JPEG, stamped exactly like a plain one.
  let base = await encodeJpeg(sdrPixels, width, height, 'base');
  if (!isJpeg(base)) throw new Error('encodeGainMapJpeg: base encoder did not return JPEG bytes');
  if (o.dpi && o.dpi > 0) base = patchJpegDpi(base, o.dpi);
  base = insertJpegExif(base, o.meta);
  if (o.icc) base = insertJpegIcc(base, o.icc);

  // The gain map: log2(HDR / SDR), computed in the engine's float pipeline.
  const sdrFrame = fromU8Srgb(sdrPixels, width, height);
  const hdrFrame = hdrViewTransform(sdrFrame, o.hdr);
  const gm = computeGainMap(sdrFrame, hdrFrame, o.gainMap ?? {});
  // NO USABLE BOOST means NO GAIN MAP. A fitted max of about zero would serialise
  // hdrCapacityMin == hdrCapacityMax, a range the Adobe spec forbids and that
  // makes the standard decoder weight formula 0/0. Attaching a map that carries no
  // light is also the padding-as-quality plans/61 refuses, so ship the plain SDR
  // JPEG instead.
  if (gm.meta.gainMapMax <= NO_BOOST_EPS) {
    log('info', 'jpeg: the HDR view transform found nothing to boost - writing a plain SDR JPEG rather than a gain map that carries no extra light.');
    return { bytes: base, baseLength: base.length, mapLength: 0, stats: gm.stats };
  }
  if (gm.stats.degenerate) {
    // A CONSTANT map that still asks for real gain (a uniform frame lifted as a
    // whole) is valid and worth keeping, unlike the no-boost case above.
    log('info', `jpeg: gain map is constant at ${gm.meta.gainMapMax.toFixed(3)} log2 (a uniform frame lifted as a whole).`);
  }
  const mapRgba = greyToRgba(gm.map, width, height);
  const mapJpeg = await encodeJpeg(mapRgba, width, height, 'map');
  if (!isJpeg(mapJpeg)) throw new Error('encodeGainMapJpeg: gain-map encoder did not return JPEG bytes');

  // The container: MPF plus Ultra HDR XMP plus ISO 21496-1, all in the engine.
  const bytes = assembleGainMapJpeg(base, mapJpeg, gm.meta);
  // Measured off the FINISHED file, not the pre-assembly buffers: assembly adds
  // the XMP/MPF segments to the base, so `base.length` would understate what a
  // gain-map-blind decoder actually reads.
  const baseLength = scanJpegSegments(bytes)?.trailerStart ?? bytes.length;
  return { bytes, baseLength, mapLength: bytes.length - baseLength, stats: gm.stats };
}

/**
 * The refusal for a gain-map JPEG with no JPEG encoder available. sharp is an
 * optional dependency of this package (a lean install may omit it), and a
 * gain-map file needs a real codec twice. Named so the caller can act on it.
 */
export function gainMapEncoderRefusal(): string {
  return (
    'An HDR JPEG (ISO 21496-1 gain map) needs a JPEG encoder, and sharp is not installed here. ' +
    'Install it (npm install sharp) and run again, or export "png" for a 16-bit Rec.2100-PQ file, ' +
    'which needs no codec beyond the engine\'s own PNG writer.'
  );
}

/** True when a gain-map JPEG can be produced in this installation. */
export function isGainMapJpegAvailable(): boolean {
  return isImagesAvailable();
}

/** The sharp slice this module uses. Typed locally because sharp is optional, so
 *  its types must never become a build requirement (same rule as images.ts). */
interface SharpLike {
  jpeg(o: { quality: number; chromaSubsampling?: string }): SharpLike;
  ensureAlpha(): SharpLike;
  raw(): SharpLike;
  toBuffer(): Promise<Buffer>;
  toBuffer(o: { resolveWithObject: true }): Promise<{ data: Buffer; info: { width: number; height: number } }>;
}
type SharpFactory = (
  input: Buffer, opts?: { raw: { width: number; height: number; channels: number } },
) => SharpLike;

let sharpModule: Promise<SharpFactory> | null = null;
function loadSharp(): Promise<SharpFactory> {
  sharpModule ??= import('sharp').then(m => (m.default ?? m) as unknown as SharpFactory);
  return sharpModule;
}

/**
 * The default JPEG encoder: sharp over libjpeg-turbo.
 *
 * The base image takes the caller's quality (0.97 by default, the web shell's).
 * The MAP is encoded at 100 with 4:4:4 chroma, because it is a data plane and not
 * a picture: subsampling averages neighbouring gain values, which smears the
 * boost across every edge in the image. The web path asks its canvas encoder for
 * quality 1 for the same reason; sharp lets the chroma decision be explicit, so
 * it is made explicitly.
 */
export function sharpJpegEncoder(quality = JPEG_QUALITY): JpegEncoder {
  return async (rgba, width, height, kind) => {
    if (!isImagesAvailable()) throw new Error(gainMapEncoderRefusal());
    const sharp = await loadSharp();
    const buf = Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength);
    const q = kind === 'map' ? 100 : Math.max(1, Math.min(100, Math.round(quality * 100)));
    const out = await sharp(buf, { raw: { width, height, channels: 4 } })
      .jpeg(kind === 'map' ? { quality: q, chromaSubsampling: '4:4:4' } : { quality: q })
      .toBuffer();
    return new Uint8Array(out);
  };
}

/**
 * Decode PNG (or any sharp-readable still) bytes to straight 8-bit RGBA. This is
 * how the Tier-B browser render becomes an HDR source: the web shell downloads an
 * ordinary SDR PNG, and the HDR encode happens here so the delivered bytes are the
 * same whichever tier produced the pixels.
 */
export async function decodeRgba(bytes: Uint8Array): Promise<Rgba8Frame> {
  if (!isImagesAvailable()) throw new Error(gainMapEncoderRefusal());
  const sharp = await loadSharp();
  const src = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return {
    data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
    width: info.width,
    height: info.height,
  };
}

/** SOI check - the encoder is injected, so its output is not taken on trust. */
function isJpeg(b: Uint8Array | null | undefined): b is Uint8Array {
  return !!b && b.length > 3 && b[0] === 0xff && b[1] === 0xd8;
}

/**
 * Splay the single-channel map across RGB (alpha opaque) so it can go through a
 * JPEG encoder with no greyscale mode. R=G=B means the file decodes identically
 * whether a reader takes the luma plane, the red channel, or the whole pixel, and
 * `meta.channels === 1` tells it which to expect.
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

/** The engine's pixel entry points take either view; the mark helpers want a
 *  clamped one. A copy only when the caller handed over a plain Uint8Array. */
function asClamped(data: Uint8Array | Uint8ClampedArray): Uint8ClampedArray {
  return data instanceof Uint8ClampedArray
    ? data
    : new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
}
