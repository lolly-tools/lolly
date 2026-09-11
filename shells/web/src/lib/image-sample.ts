// SPDX-License-Identifier: MPL-2.0
/**
 * Decode an image file into RGBA the engine's `imageColorCloud` can read, in the
 * widest space this browser will hand back.
 *
 * The whole reason this is not three lines: a 2D canvas is sRGB by default, and
 * drawing a Display-P3 photo into one CLIPS it before anything downstream sees a
 * byte. The plot would then show a wide-gamut image sitting neatly inside sRGB
 * and claim that as a finding. So the destination space is negotiated first and
 * the answer is returned alongside the pixels, never assumed.
 *
 * What this still cannot do, and says so rather than pretending: an image's own
 * embedded ICC profile is honoured by the BROWSER's decode into the destination
 * space, so a tagged file is handled correctly, but an UNTAGGED file is sRGB by
 * convention only. `assumed` reports which of those happened so the caller can
 * put it on screen.
 */

import { decodeImageBitmap } from '../bridge/image-resize.ts';
import type { CloudSpace } from '@lolly/engine';

export interface SampledImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  /** The space the bytes are in - pass this straight to `imageColorCloud`. */
  space: CloudSpace;
  /** True when the file carried no colour profile, so `space` is a convention. */
  assumed: boolean;
  /** The source's own pixel dimensions, before the sampling downscale. */
  sourceWidth: number;
  sourceHeight: number;
  /**
   * The source FILE's declared bits per channel (`depthHint`), or null when the
   * container doesn't say cheaply. `data` is always 8-bit - a deeper source has
   * been flattened by the canvas read, and this field is how a caller says so.
   */
  sourceBits: number | null;
}

/**
 * Longest side the image is scaled to before sampling.
 *
 * 1400 is ~2M pixels, which is far more than the cloud needs (it samples ~200k)
 * but keeps the downscale itself cheap and leaves headroom for a caller wanting
 * a finer stride. Going smaller would start to lose the rare colours - a few
 * hundred pixels of one vivid object is exactly the thing worth finding.
 */
const MAX_SIDE = 1400;

export async function sampleImageFile(file: Blob): Promise<SampledImage> {
  const bitmap = await decodeImageBitmap(file);
  const sourceWidth = bitmap.width, sourceHeight = bitmap.height;
  const scale = Math.min(1, MAX_SIDE / Math.max(1, sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  // Which destination space to ask for is a real decision, not "the widest wins".
  //
  // Reading a file that is ALREADY sRGB through a Display-P3 canvas re-encodes
  // every pixel into P3's primaries at 8 bits, and that round trip does not land
  // where it started: measured across the sRGB cube, 5.2% of colours come back
  // reading as outside sRGB. On an ordinary photograph that produced a confident
  // "7.4% of this image is beyond sRGB" - about a file with nothing beyond sRGB
  // in it. So a source known or presumed to be sRGB is read in sRGB, where the
  // question does not arise, and only a file carrying a profile that might be
  // wider is worth the wider surface.
  const [hint, depth] = await Promise.all([profileHint(file), depthHint(file)]);
  const want: CloudSpace = hint === 'other' ? 'display-p3' : 'srgb';
  let ctx = canvas.getContext('2d', { colorSpace: want });
  let space = (ctx?.getContextAttributes?.().colorSpace ?? 'srgb') as CloudSpace;
  if (!ctx) {
    ctx = canvas.getContext('2d');
    space = 'srgb';
  }
  if (!ctx) throw new Error('no 2D context');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  // Second, independent check. A browser that accepted the context option but not
  // this one either throws or hands back sRGB; either way the space collapses
  // here, BEFORE any pixel is interpreted, so the failure mode is "an sRGB
  // reading, correctly labelled" rather than "every colour shifted".
  let img: ImageData;
  try {
    img = ctx.getImageData(0, 0, width, height, { colorSpace: space });
  } catch {
    img = ctx.getImageData(0, 0, width, height);
    space = 'srgb';
  }
  if (img.colorSpace && img.colorSpace !== space) space = img.colorSpace as CloudSpace;

  return {
    data: img.data,
    width,
    height,
    space,
    assumed: hint === 'none',
    sourceWidth,
    sourceHeight,
    sourceBits: depth.bitsPerChannel,
  };
}

/** What the file says about its own colour space, without decoding it. */
export type ProfileHint =
  /** Nothing at all. sRGB by convention, which is a convention, not a fact. */
  | 'none'
  /** It says sRGB - a PNG `sRGB` chunk or a JFIF/Exif file with no ICC. */
  | 'srgb'
  /** It carries a real profile, which may be wider than sRGB. */
  | 'other';

/**
 * A byte sniff, not a parse: the only question is which destination space to
 * decode into, and that needs "might this be wide?", not the profile itself.
 * Covers the container shapes that turn up - JPEG's `ICC_PROFILE` APP2 marker,
 * PNG's `iCCP` / `cICP` / `sRGB` chunks, and WebP's `ICCP` chunk.
 *
 * Order matters: an embedded ICC wins over an `sRGB` chunk, because a file can
 * carry both and the ICC is the more specific claim. Anything unrecognised
 * answers 'none', which errs toward reading in sRGB and saying so - the safe
 * direction, since the failure is a caveat we did not need rather than a wide
 * colour silently invented.
 */
export async function profileHint(file: Blob): Promise<ProfileHint> {
  try {
    // 64 KB reaches past a JPEG's APP segments and a PNG's header chunks without
    // reading a 40 MB file to answer a three-way question.
    const head = new Uint8Array(await file.slice(0, 65536).arrayBuffer());
    const text = new TextDecoder('latin1').decode(head);
    if (/ICC_PROFILE|iCCP|cICP|ICCP/.test(text)) return 'other';
    if (/sRGB/.test(text)) return 'srgb';
    return 'none';
  } catch {
    return 'none';
  }
}

/** What a file says about its own bits per channel, without decoding a pixel. */
export interface DepthHint {
  /**
   * Declared bits per channel - 8 for almost everything, 16 for a deep PNG/TIFF,
   * 12 for a rare extended JPEG. null when the container doesn't state it in a
   * form a header sniff can reach (HEIC/AVIF bury it in codec config boxes), or
   * when the file is malformed/unrecognised.
   */
  bitsPerChannel: number | null;
  /** Which container answered, or null when none was recognised. */
  source: 'png' | 'tiff' | 'heic' | 'jpeg' | 'webp' | 'avif' | null;
}

// ── depthHint hardening caps (parser discipline - see docs/parser-inventory.md) ──
// Every read is an explicit bounded slice; a truncated, hostile, or lying header
// yields nulls, never a throw and never an unbounded allocation.

/** Largest single read a sniff may make - one IFD entry table tops out well below this. */
const MAX_SNIFF_READ = 65536;
/** IFD entries walked before giving up - real TIFFs carry dozens, not thousands. */
const MAX_IFD_ENTRIES = 512;
/** JPEG marker segments walked looking for a frame header before giving up. */
const MAX_JPEG_SEGMENTS = 512;

// ISOBMFF 'ftyp' brands: HEIF-family stills (mirrors bridge/heic-decode.ts, which
// deliberately doesn't export its set - this sniff must stay import-light) vs AVIF.
const HEIC_BRANDS = new Set(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevm', 'hevs', 'mif1', 'msf1']);
const AVIF_BRANDS = new Set(['avif', 'avis']);

// JPEG SOFn frame-header markers: 0xC0–0xCF minus DHT (0xC4), JPG (0xC8), DAC (0xCC).
// ITU-T T.81 section B.2.2: the frame header is SOFn, Lf (2 bytes), then P - the sample
// precision in bits (8 for baseline; 12 for the rare extended/progressive case).
const JPEG_SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

/**
 * The bit-depth sibling of `profileHint`: a header sniff, never a decode. The
 * question it answers is the ingest path's honesty clause - Lolly currently
 * edits every pixel at 8 bits per channel, so a deeper source (16-bit PNG/TIFF)
 * is flattened the moment it is drawn, and the caller should SAY that rather
 * than crush it silently (plans/61-deeprichpixels.md Phase A).
 *
 * Sources and where each number comes from:
 * - PNG: the IHDR bit-depth byte. Per the PNG spec (W3C PNG 3rd ed section 11.2.1),
 *   after the 8-byte signature the first chunk is IHDR (4-byte length, 4-byte
 *   type, then width/height as 4 bytes each), so bit depth - legal values
 *   1/2/4/8/16 - is byte 24 of the datastream.
 * - TIFF: tag 258 BitsPerSample (type SHORT) in the first IFD, walked with the
 *   entry layout from the TIFF 6.0 spec ("Image File Directory", pp. 14–16:
 *   u16 count, then 12-byte entries of tag/type/count/value-or-offset; a value
 *   that fits in 4 bytes is stored inline). Per-channel depths are near-always
 *   equal, so the first SHORT answers.
 * - JPEG: the SOFn precision byte (ITU-T T.81 section B.2.2) - 8, or 12 in the rare
 *   extended case; 8 when the scan doesn't reach a frame header.
 * - WebP: always 8 - both VP8 (RFC 6386) and VP8L lossless are defined 8-bit.
 * - HEIC/AVIF: recognised by 'ftyp' brand, but the real depth lives in codec
 *   config boxes a cheap sniff shouldn't chase - bitsPerChannel is null.
 */
export async function depthHint(file: Blob | Uint8Array): Promise<DepthHint> {
  const none: DepthHint = { bitsPerChannel: null, source: null };
  try {
    const size = file instanceof Uint8Array ? file.length : file.size;
    // Bounded random-access read: null on any out-of-range or oversized request,
    // so a lying offset can neither throw nor allocate beyond the cap.
    const read = async (off: number, len: number): Promise<Uint8Array | null> => {
      if (!Number.isSafeInteger(off) || off < 0 || len <= 0 || len > MAX_SNIFF_READ || off + len > size) return null;
      if (file instanceof Uint8Array) return file.subarray(off, off + len);
      return new Uint8Array(await file.slice(off, off + len).arrayBuffer());
    };
    const head = await read(0, Math.min(size, MAX_SNIFF_READ));
    // 8 bytes is the shortest recognisable header (a bare TIFF header); the
    // longer signatures below index past that safely - an out-of-range
    // Uint8Array read is `undefined`, which fails every byte comparison.
    if (!head || head.length < 8) return none;

    // PNG - signature, then IHDR's bit-depth byte at datastream offset 24.
    if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47
      && head[4] === 0x0d && head[5] === 0x0a && head[6] === 0x1a && head[7] === 0x0a) {
      // The first chunk MUST be IHDR (section 11.2.1); anything else is malformed.
      const ihdr = head.length >= 25
        && head[12] === 0x49 && head[13] === 0x48 && head[14] === 0x44 && head[15] === 0x52;
      const depth = ihdr ? head[24]! : 0;
      return { bitsPerChannel: [1, 2, 4, 8, 16].includes(depth) ? depth : null, source: 'png' };
    }

    // TIFF - 'II' (little-endian) or 'MM' (big-endian) + magic 42, then IFD0.
    const tiffLe = head[0] === 0x49 && head[1] === 0x49 && head[2] === 0x2a && head[3] === 0x00;
    const tiffBe = head[0] === 0x4d && head[1] === 0x4d && head[2] === 0x00 && head[3] === 0x2a;
    if (tiffLe || tiffBe) {
      const le = tiffLe;
      const u16 = (b: Uint8Array, o: number): number => le ? b[o]! | (b[o + 1]! << 8) : (b[o]! << 8) | b[o + 1]!;
      const u32 = (b: Uint8Array, o: number): number =>
        le ? (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16)) + b[o + 3]! * 0x1000000
           : (b[o + 3]! | (b[o + 2]! << 8) | (b[o + 1]! << 16)) + b[o]! * 0x1000000;
      const noTiff: DepthHint = { bitsPerChannel: null, source: 'tiff' };
      const ifdOff = u32(head, 4);
      const cntBytes = await read(ifdOff, 2);
      if (!cntBytes) return noTiff;
      const count = Math.min(u16(cntBytes, 0), MAX_IFD_ENTRIES);
      const entries = await read(ifdOff + 2, Math.max(1, count * 12));
      if (!entries || entries.length < count * 12) return noTiff;
      for (let i = 0; i < count; i++) {
        const at = i * 12;
        if (u16(entries, at) !== 258) continue; // BitsPerSample
        if (u16(entries, at + 2) !== 3) return noTiff; // must be SHORT
        const n = u32(entries, at + 4);
        if (n < 1) return noTiff;
        let v: number;
        if (n <= 2) {
          v = u16(entries, at + 8); // ≤4 bytes → stored inline in the value field
        } else {
          const valBytes = await read(u32(entries, at + 8), 2);
          if (!valBytes) return noTiff;
          v = u16(valBytes, 0);
        }
        return { bitsPerChannel: v >= 1 && v <= 64 ? v : null, source: 'tiff' };
      }
      return noTiff; // no BitsPerSample tag - spec default is 1 (bilevel); stay agnostic
    }

    // JPEG - walk marker segments inside the head for a SOFn precision byte.
    if (head[0] === 0xff && head[1] === 0xd8) {
      let off = 2;
      for (let i = 0; i < MAX_JPEG_SEGMENTS && off + 3 < head.length; i++) {
        if (head[off] !== 0xff) break;
        let m = head[off + 1]!;
        while (m === 0xff && off + 2 < head.length) { off++; m = head[off + 1]!; } // fill bytes
        if (m === 0x01 || (m >= 0xd0 && m <= 0xd8)) { off += 2; continue; } // standalone, no length
        if (m === 0xd9 || m === 0xda) break; // EOI / SOS - no frame header seen
        const len = (head[off + 2]! << 8) | head[off + 3]!;
        if (len < 2) break;
        if (JPEG_SOF.has(m)) {
          const p = off + 4 < head.length ? head[off + 4]! : 8;
          return { bitsPerChannel: p === 8 || p === 12 || p === 16 ? p : 8, source: 'jpeg' };
        }
        off += 2 + len;
      }
      return { bitsPerChannel: 8, source: 'jpeg' }; // baseline default
    }

    // WebP - RIFF….WEBP; VP8/VP8L payloads are 8-bit by definition.
    if (head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46
      && head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50) {
      return { bitsPerChannel: 8, source: 'webp' };
    }

    // ISOBMFF - 'ftyp' at offset 4; classify by major + compatible brands within
    // the ftyp box (majors like 'mif1' are shared, so the compatibles decide).
    if (head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70) {
      const boxLen = (head[0]! << 24 >>> 0) + (head[1]! << 16) + (head[2]! << 8) + head[3]!;
      const brandEnd = Math.min(head.length, Math.max(12, Math.min(boxLen, 64)));
      const dec = new TextDecoder('latin1');
      let isAvif = false, isHeic = false;
      for (let o = 8; o + 4 <= brandEnd; o += 4) {
        if (o === 12) continue; // minor_version field, not a brand
        const brand = dec.decode(head.subarray(o, o + 4));
        if (AVIF_BRANDS.has(brand)) isAvif = true;
        else if (HEIC_BRANDS.has(brand)) isHeic = true;
      }
      if (isAvif) return { bitsPerChannel: null, source: 'avif' };
      if (isHeic) return { bitsPerChannel: null, source: 'heic' };
      return none;
    }

    return none;
  } catch {
    return none;
  }
}
