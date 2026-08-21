// SPDX-License-Identifier: MPL-2.0
/**
 * Gain-map JPEG assembly. This is the container half of plans/61-deeprichpixels.md section 6 B2.
 *
 * {@link ../gainmap.ts} computes the map and its metadata. This module glues an
 * SDR base JPEG and a gain-map JPEG into ONE file. A gain-map-aware decoder
 * (Chromium, Safari/macOS/iOS, Android 15) renders it as real HDR. Every other
 * decoder renders it as the ordinary SDR JPEG it starts with. Nothing here
 * touches pixels: bytes in, bytes out, DOM-free like the rest of the engine.
 *
 * --- The file, end to end ----------------------------------------------------
 *
 *   [ SOI … APP1 XMP (GContainer) … APP2 MPF … SDR image … EOI ]   <- primary
 *   [ SOI … APP1 XMP (hdrgm) … APP2 ISO 21496-1 … map image … EOI ] <- appended
 *
 * The second JPEG lives in the primary's post-EOI trailer. This is legal (a
 * JPEG ends at EOI; readers ignore what follows), and it is what makes the
 * fallback perfect: a decoder that knows nothing about gain maps stops at the
 * first EOI and shows the SDR image, byte for byte. The MPF index in the primary
 * tells an aware decoder that the trailer is a second image and where it
 * starts.
 *
 * --- DUAL metadata, deliberately (plan section 4.2) ---------------------------------
 * Two vocabularies describe the same single gain-map image, because the
 * ecosystem is mid-transition and each half reads a different one:
 *
 *   - **Ultra HDR v1.1 / Adobe `hdrgm` XMP** - what Android <=14 and Adobe's
 *     tools read. GContainer directory in the PRIMARY (this file has a GainMap
 *     item, and it is N bytes long); `hdrgm:*` attributes in the GAIN MAP image.
 *   - **ISO 21496-1** - the 2025 standard, read by Chromium/Skia and Apple, as a
 *     binary metadata blob in an APP2 segment of the GAIN MAP image, identified
 *     by `urn:iso:std:iso:ts:21496:-1`.
 *
 * Android 15 writes both around one shared map image; so do we. Neither is a
 * superset of the other in practice, and the map image is written once either
 * way, so the cost of both is about 1 KB of metadata for whole-ecosystem coverage.
 *
 * --- Sources (cited again at each use site) -----------------------------------
 *   - CIPA DC-007-2021 "Multi-Picture Format" - the MPF APP2 index, its TIFF
 *     structure, the 16-byte MP Entry record, and the rule that every offset is
 *     measured from the MP Endian field (DC-007 section 5.2.3.3).
 *   - Google "Ultra HDR Image Format v1.1" - the GContainer + `hdrgm` XMP forms.
 *     https://developer.android.com/media/platform/hdr-image-format
 *   - Adobe Gain Map Specification v1.0 - the `hdrgm` vocabulary itself.
 *   - ISO/CIE 21496-1:2025 - the binary gain-map metadata structure.
 *   - libultrahdr (Apache-2.0) `multipictureformat.cpp` / `gainmapmetadata.cpp`
 *     and Skia `SkGainmapInfo.cpp` / `SkJpegMultiPicture.cpp` - the two reference
 *     implementations this writer is shaped to interoperate with. Where DC-007
 *     leaves a field to taste, we match libultrahdr's choice, because matching
 *     the reference encoder is what actually gets a file rendered.
 *
 * --- Ordering matters here ----------------------------------------------------
 * The MP index stores ABSOLUTE byte offsets to the images that follow it, so
 * anything inserted into the primary AFTER assembly shifts what MPF points at.
 * Every insertion here goes through `jpeg-segments.ts`, whose `jpegSegmentRank`
 * puts MPF ahead of ICC for exactly this reason, and the offsets are patched in
 * as the LAST step, once every other segment is in place. For the one insertion
 * that still legitimately happens later, a C2PA APP11 store, see
 * {@link repairMpfOffsets}.
 */

import { concatBytes } from './bytes.ts';
import type { GainMapMeta } from './gainmap.ts';
import {
  buildJpegSegment,
  findJpegSegment,
  JPEG_APP_IDS,
  insertJpegSegments,
  scanJpegSegments,
} from './jpeg-segments.ts';

// ─── constants ────────────────────────────────────────────────────────────────

/** APP1. */
const M_APP1 = 0xe1;
/** APP2 - MPF and the ISO 21496-1 metadata both live here. */
const M_APP2 = 0xe2;

/** Largest XMP packet that fits one APP1 segment: 65535 - 2 (length) - 29 (`ns\0`). */
export const XMP_APP1_MAX = 0xffff - 2 - (JPEG_APP_IDS.XMP.length + 1);

/** The ISO 21496-1 APP2 identifier, as Skia's `kISOGainmapSig` spells it. */
export const ISO_GAINMAP_URN = 'urn:iso:std:iso:ts:21496:-1';

/** MP Type Code for "Baseline MP Primary Image" (DC-007 Table 3). */
const MP_TYPE_PRIMARY = 0x030000;

const enc = new TextEncoder();

// ─── small helpers ────────────────────────────────────────────────────────────

/** NUL-terminated ASCII identifier at the head of an APPn payload. */
function idBytes(id: string): Uint8Array {
  const b = enc.encode(id);
  const out = new Uint8Array(b.length + 1);
  out.set(b, 0);
  return out; // trailing 0 already
}

/**
 * Deterministic decimal for an XMP attribute. Six fractional digits, trailing
 * zeros trimmed, never exponential in the ranges gain-map metadata uses.
 * A non-finite value collapses to 0 rather than emitting `NaN` into a packet.
 */
function fmt(v: number): string {
  const n = Number.isFinite(v) ? v : 0;
  const s = Number(n.toFixed(6));
  return Object.is(s, -0) ? '0' : String(s);
}

/** XML attribute-value escaping (the packets are built as strings, so this is the guard). */
function xmlEsc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * A finite value as an exact-ish rational for the ISO box. Integers come back
 * over denominator 1 (so gamma 1 is literally 1/1 and offset 0 is 0/1). Anything
 * else uses 1e6, which is finer than the metadata is ever authored to and keeps
 * the encoding deterministic and reversible to 6 decimals.
 */
function rational(v: number, signed: boolean): { n: number; d: number } {
  const x = Number.isFinite(v) ? v : 0;
  if (Number.isInteger(x) && Math.abs(x) < 0x7fffffff) return { n: signed ? x : Math.max(0, x), d: 1 };
  const d = 1000000;
  let n = Math.round(x * d);
  if (!signed && n < 0) n = 0;
  // Clamp into int32/uint32 range rather than wrapping silently.
  if (n > 0x7fffffff) n = 0x7fffffff;
  if (n < -0x80000000) n = -0x80000000;
  return { n, d };
}

// ─── XMP packets ──────────────────────────────────────────────────────────────

/**
 * Wrap an XMP packet string in an APP1 segment.
 *
 * REFUSES loudly past {@link XMP_APP1_MAX}. The standard escape hatch is the
 * extended-XMP GUID chain (a `http://ns.adobe.com/xmp/extension/` APP1 series
 * keyed by the MD5 of the extended packet). It is deliberately NOT
 * implemented: every packet this module produces is a few hundred bytes, the
 * chain would be untested code on a path that never runs, and the failure mode
 * of a silently-truncated XMP packet is a file that looks fine and renders
 * wrong. If a caller ever needs a packet this large, implement the chain then.
 * Throwing here makes that a visible decision instead of a silent
 * corruption.
 */
export function buildXmpApp1(packet: string): Uint8Array {
  const body = concatBytes([idBytes(JPEG_APP_IDS.XMP), enc.encode(packet)]);
  const seg = buildJpegSegment(M_APP1, body);
  if (!seg) {
    throw new Error(
      `gainmap-jpeg: XMP packet is ${body.length} bytes, past the ${XMP_APP1_MAX}-byte single-segment limit; ` +
      'the extended-XMP GUID chain is not implemented (see buildXmpApp1) - refusing rather than truncating.',
    );
  }
  return seg;
}

const XPACKET_HEAD = '<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>';
const XPACKET_TAIL = '<?xpacket end="w"?>';

/**
 * The PRIMARY image's XMP. It is an Ultra HDR v1.1 GContainer directory saying
 * "this file holds a Primary item and then a GainMap item of `mapLength` bytes",
 * plus `hdrgm:Version` so a reader knows which vocabulary the second image speaks.
 * `Item:Length` is 0 for the primary by spec (its length is implied), and the
 * real byte count for the gain map.
 */
export function buildPrimaryXmp(mapLength: number): string {
  return `${XPACKET_HEAD}
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:Container="http://ns.google.com/photos/1.0/container/"
    xmlns:Item="http://ns.google.com/photos/1.0/container/item/"
    xmlns:hdrgm="http://ns.adobe.com/hdr-gain-map/1.0/"
    hdrgm:Version="1.0">
   <Container:Directory>
    <rdf:Seq>
     <rdf:li rdf:parseType="Resource">
      <Container:Item Item:Semantic="Primary" Item:Length="0" Item:Mime="image/jpeg"/>
     </rdf:li>
     <rdf:li rdf:parseType="Resource">
      <Container:Item Item:Semantic="GainMap" Item:Mime="image/jpeg" Item:Length="${Math.max(0, Math.round(mapLength))}"/>
     </rdf:li>
    </rdf:Seq>
   </Container:Directory>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
${XPACKET_TAIL}`;
}

/**
 * The GAIN MAP image's XMP. It carries the Adobe/Ultra HDR `hdrgm` attributes,
 * one for one with {@link GainMapMeta}'s log2 fields. `BaseRenditionIsHDR="False"`
 * is the `baseRendition: 'sdr'` contract. Every numeric field is written explicitly
 * rather than relying on the spec defaults, so nothing depends on a reader
 * agreeing with us about what "absent" means.
 */
export function buildGainMapXmp(meta: GainMapMeta): string {
  const a = (k: string, v: string) => `\n    hdrgm:${k}="${xmlEsc(v)}"`;
  return `${XPACKET_HEAD}
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:hdrgm="http://ns.adobe.com/hdr-gain-map/1.0/"${a('Version', '1.0')}${
      a('BaseRenditionIsHDR', meta.baseRendition === 'sdr' ? 'False' : 'True')}${
      a('GainMapMin', fmt(meta.gainMapMin))}${
      a('GainMapMax', fmt(meta.gainMapMax))}${
      a('Gamma', fmt(meta.gamma))}${
      a('OffsetSDR', fmt(meta.offsetSdr))}${
      a('OffsetHDR', fmt(meta.offsetHdr))}${
      a('HDRCapacityMin', fmt(meta.hdrCapacityMin))}${
      a('HDRCapacityMax', fmt(meta.hdrCapacityMax))}/>
 </rdf:RDF>
</x:xmpmeta>
${XPACKET_TAIL}`;
}

// --- ISO 21496-1 metadata -------------------------------------------------------

/** `is_multichannel` - ISO 21496-1 flags bit 7 (libultrahdr `kIsMultiChannelMask`). */
const ISO_FLAG_MULTICHANNEL = 1 << 7;
/** `use_base_colour_space` - flags bit 6 (libultrahdr `kUseBaseColourSpaceMask`). */
const ISO_FLAG_USE_BASE_CG = 1 << 6;

/**
 * The ISO 21496-1 `GainMapMetadata` payload (no box header - in JPEG the
 * structure is carried raw after the URN, which is how Skia's reader parses it):
 *
 * ```
 *   u16 minimum_version (0)          u16 writer_version (0)
 *   u8  flags  bit7 is_multichannel, bit6 use_base_colour_space
 *   u32 base_hdr_headroom      numerator / denominator      <- our hdrCapacityMin
 *   u32 alternate_hdr_headroom numerator / denominator      <- our hdrCapacityMax
 *   per channel (1 here, 3 if multichannel):
 *     s32/u32 gain_map_min,  s32/u32 gain_map_max,
 *     u32/u32 gamma,         s32/u32 base_offset, s32/u32 alternate_offset
 * ```
 *
 * All of the log2 quantities are the SAME numbers the `hdrgm` XMP carries as
 * decimals. The two metadata forms are two spellings of one fit, never two
 * different fits. 61 bytes for a single-channel map.
 */
export function buildIsoGainMapMetadata(meta: GainMapMeta): Uint8Array {
  const channels = meta.channels === 1 ? 1 : 3;
  const out = new Uint8Array(2 + 2 + 1 + 16 + channels * 40);
  const dv = new DataView(out.buffer);
  let o = 0;
  dv.setUint16(o, 0); o += 2; // minimum_version
  dv.setUint16(o, 0); o += 2; // writer_version
  let flags = 0;
  if (channels === 3) flags |= ISO_FLAG_MULTICHANNEL;
  if (meta.useBaseColorSpace) flags |= ISO_FLAG_USE_BASE_CG;
  out[o] = flags; o += 1;

  const putU = (r: { n: number; d: number }) => { dv.setUint32(o, r.n >>> 0); dv.setUint32(o + 4, r.d >>> 0); o += 8; };
  const putS = (r: { n: number; d: number }) => { dv.setInt32(o, r.n); dv.setUint32(o + 4, r.d >>> 0); o += 8; };

  // Headroom pair. The base rendition is SDR, so its headroom is the capacity at
  // which the map starts being applied; the alternate is the capacity at which it
  // is applied in full.
  putU(rational(meta.hdrCapacityMin, false));
  putU(rational(meta.hdrCapacityMax, false));
  for (let c = 0; c < channels; c++) {
    putS(rational(meta.gainMapMin, true));
    putS(rational(meta.gainMapMax, true));
    putU(rational(meta.gamma, false));
    putS(rational(meta.offsetSdr, true));
    putS(rational(meta.offsetHdr, true));
  }
  return out;
}

/** The ISO 21496-1 metadata wrapped in its APP2 segment. */
export function buildIsoGainMapApp2(meta: GainMapMeta): Uint8Array {
  const body = concatBytes([idBytes(ISO_GAINMAP_URN), buildIsoGainMapMetadata(meta)]);
  const seg = buildJpegSegment(M_APP2, body);
  if (!seg) throw new Error('gainmap-jpeg: ISO 21496-1 metadata does not fit an APP2 segment');
  return seg;
}

// --- MPF (CIPA DC-007) -----------------------------------------------------------

/**
 * Byte length of an MPF APP2 segment for `images` pictures, with or without the
 * optional UID list. Fixed and known BEFORE the offsets are, which is what lets
 * the segment be inserted first and patched last.
 */
function mpfSegmentLength(images: number, withUids: boolean): number {
  const entries = withUids ? 4 : 3;
  // marker+len(4) + "MPF\0"(4) + TIFF header(8) + IFD count(2) + entries + next(4) + values
  return 4 + 4 + 8 + 2 + entries * 12 + 4 + images * 16 + (withUids ? images * 33 : 0);
}

/**
 * Build the MP Index IFD as an APP2 segment, with the per-image size/offset
 * fields left at zero for {@link patchMpfEntries} to fill in.
 *
 * Structure (DC-007 section 5.2.3): the payload is `MPF\0` followed by a complete TIFF
 * stream (big-endian `MM`, 0x002A, first-IFD offset 8), and every offset in it,
 * including the image offsets in the MP Entries, is measured from the FIRST BYTE
 * OF THE MP ENDIAN FIELD, not from the file start and not from the segment
 * start. That single fact is the whole reason this module patches offsets
 * as its last act.
 *
 * Tags written: MPFVersion (0xB000, `"0100"`), NumberOfImages (0xB001),
 * MPEntry (0xB002, 16 bytes per image), and MPImageUIDList (0xB003) only when
 * the caller supplies real UIDs - see {@link AssembleGainMapJpegOptions.imageUids}.
 */
function buildMpfSegment(images: number, uids: readonly Uint8Array[] | null): Uint8Array {
  const withUids = !!uids;
  const total = mpfSegmentLength(images, withUids);
  const seg = new Uint8Array(total);
  const dv = new DataView(seg.buffer);
  seg[0] = 0xff; seg[1] = M_APP2;
  dv.setUint16(2, total - 2); // segment length counts itself but not the marker
  seg.set(idBytes(JPEG_APP_IDS.MPF), 4); // "MPF\0"

  const H = 8; // offset of the MP Endian field within the segment
  dv.setUint16(H, 0x4d4d);     // "MM" - big-endian, as libultrahdr writes
  dv.setUint16(H + 2, 0x002a); // TIFF magic
  dv.setUint32(H + 4, 8);      // first IFD, relative to H

  const entryCount = withUids ? 3 + 1 : 3;
  const ifd = H + 8;
  dv.setUint16(ifd, entryCount);
  let e = ifd + 2;
  const putEntry = (tag: number, type: number, count: number, value: number) => {
    dv.setUint16(e, tag); dv.setUint16(e + 2, type); dv.setUint32(e + 4, count); dv.setUint32(e + 8, value);
    e += 12;
  };
  const valuesAt = 8 + 2 + entryCount * 12 + 4; // relative to H - where MPEntry data starts
  putEntry(0xb000, 7, 4, 0x30313030);           // MPFVersion, UNDEFINED "0100" inline
  putEntry(0xb001, 4, 1, images);               // NumberOfImages, LONG
  putEntry(0xb002, 7, images * 16, valuesAt);   // MPEntry, UNDEFINED, offset from H
  if (withUids) putEntry(0xb003, 7, images * 33, valuesAt + images * 16);
  dv.setUint32(e, 0); // next IFD: none

  // MP Entries: 16 bytes each: attribute, size, offset, then two 2-byte
  // dependent-image entry numbers (unused, zero). The first image's offset is 0
  // by definition (DC-007: it is the image the MP Index belongs to).
  let v = H + valuesAt;
  for (let i = 0; i < images; i++) {
    // Image Data Format 0 = JPEG in bits 26-24; MP Type Code in bits 23-0.
    // libultrahdr marks image 0 "Baseline MP Primary Image" and leaves the gain
    // map's type undefined; we match it byte for byte.
    dv.setUint32(v, i === 0 ? MP_TYPE_PRIMARY : 0);
    dv.setUint32(v + 4, 0); // size - patched
    dv.setUint32(v + 8, 0); // offset - patched
    dv.setUint16(v + 12, 0);
    dv.setUint16(v + 14, 0);
    v += 16;
  }
  if (uids) {
    for (let i = 0; i < images; i++) {
      const u = uids[i];
      if (u) seg.set(u.subarray(0, 33), v);
      v += 33;
    }
  }
  return seg;
}

/** Where the MP Endian field sits inside a file, given its MPF segment start. */
const mpHeaderAt = (segStart: number): number => segStart + 4 /* marker+len */ + 4 /* "MPF\0" */;

/**
 * Write the real size/offset pair of every MP Entry into an assembled file.
 * `images[i]` is the absolute byte range of image i; the MPF index itself lives
 * inside image 0. Returns false when the file carries no usable MPF index.
 */
function patchMpfEntries(bytes: Uint8Array, images: readonly { start: number; length: number }[]): boolean {
  const seg = findJpegSegment(bytes, M_APP2, JPEG_APP_IDS.MPF);
  if (!seg) return false;
  const h = mpHeaderAt(seg.start);
  if (h + 16 > seg.end) return false;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // Byte order comes from the MP Endian field. We only ever WRITE 'MM', but this
  // also repairs foreign files (a user upload being C2PA-stamped), and libjpeg
  // writers do emit 'II' - refusing those silently left them corrupted.
  const order = dv.getUint16(h);
  if (order !== 0x4d4d && order !== 0x4949) return false;
  const le = order === 0x4949;
  // EVERY offset below is attacker-controlled (this runs over user uploads).
  // Bound each one to the MPF SEGMENT, not merely to the file: a write outside
  // the segment would corrupt arbitrary image bytes that are then C2PA-signed.
  const inSeg = (from: number, len: number) => from >= h && from + len <= seg.end;
  const ifd = h + dv.getUint32(h + 4, le);
  if (!inSeg(ifd, 2)) return false;
  const count = dv.getUint16(ifd, le);
  if (!inSeg(ifd, 2 + count * 12)) return false;
  let entriesAt = -1;
  let n = 0;
  for (let i = 0; i < count; i++) {
    const e = ifd + 2 + i * 12;
    const tag = dv.getUint16(e, le);
    if (tag === 0xb001) n = dv.getUint32(e + 8, le);
    if (tag === 0xb002) entriesAt = h + dv.getUint32(e + 8, le);
  }
  if (entriesAt < 0 || n !== images.length) return false;
  if (!inSeg(entriesAt, n * 16)) return false;
  for (let i = 0; i < n; i++) {
    const at = entriesAt + i * 16;
    dv.setUint32(at + 4, images[i]!.length, le);
    // DC-007: offsets are measured from the MP Endian field, and the first
    // image's offset field is zero.
    dv.setUint32(at + 8, i === 0 ? 0 : images[i]!.start - h, le);
  }
  return true;
}

/**
 * Re-derive an assembled gain-map JPEG's MPF offsets from the file as it now
 * stands. Needed because the MP index records absolute offsets, so ANY segment
 * added to the primary after assembly (the realistic case: a C2PA APP11 JUMBF
 * store spliced in by `c2pa-containers.ts#placeJpeg`) shifts the second image
 * without shifting what MPF claims. After that an aware decoder stops finding
 * the gain map and quietly renders the SDR base.
 *
 * Bounded and total, like the rest of `jpeg-segments.ts`: it finds the primary's
 * EOI and treats the trailer as image 2, and returns the input untouched if
 * anything about the file is not what it expects. Idempotent: running it on an
 * already-correct file rewrites the same values.
 */
export function repairMpfOffsets(bytes: Uint8Array): Uint8Array {
  try {
    const scan = scanJpegSegments(bytes);
    if (!scan || scan.trailerStart === null) return bytes;
    const trailer = scan.trailerStart;
    // The trailer must itself be a JPEG (SOI) for this to be a two-image MPF file.
    if (bytes[trailer] !== 0xff || bytes[trailer + 1] !== 0xd8) return bytes;
    const out = new Uint8Array(bytes); // patch a copy: callers hold the original
    const ok = patchMpfEntries(out, [
      { start: 0, length: trailer },
      { start: trailer, length: bytes.length - trailer },
    ]);
    return ok ? out : bytes;
  } catch {
    return bytes;
  }
}

// --- assembly ---------------------------------------------------------------

export interface AssembleGainMapJpegOptions {
  /**
   * Optional CIPA DC-007 MPImageUIDList (0xB003): one 33-byte unique ID per
   * image. OMITTED by default, and that is the considered choice: libultrahdr
   * and Android do not write the tag, no reader in the target ecosystem consults
   * it, and a fabricated or all-zero "unique" ID is worse than an absent
   * optional field. Supply real IDs (33 bytes each, longer is truncated) if a
   * downstream workflow needs them.
   */
  imageUids?: readonly (Uint8Array | string)[];
}

/**
 * Glue an SDR base JPEG and a gain-map JPEG into one gain-map JPEG file.
 *
 * The base image is returned unchanged apart from two added metadata segments,
 * which is the property the whole format rests on: strip the trailer and you
 * have the original SDR JPEG. Both inputs must be complete JPEGs (SOI…EOI).
 *
 * Throws loudly, never silently degrades, when an input is not a JPEG, when
 * a metadata packet will not fit its segment, or when the MPF index cannot be
 * placed. The shell seam catches and falls back to the legacy path, so an HDR
 * export is never lost to a container problem.
 */
export function assembleGainMapJpeg(
  baseJpeg: Uint8Array,
  mapJpeg: Uint8Array,
  meta: GainMapMeta,
  opts: AssembleGainMapJpegOptions = {},
): Uint8Array {
  const baseScan = scanJpegSegments(baseJpeg);
  if (!baseScan) throw new Error('assembleGainMapJpeg: base image is not a JPEG');
  if (baseScan.truncated) throw new Error('assembleGainMapJpeg: base image has no EOI (truncated JPEG)');
  const mapScan = scanJpegSegments(mapJpeg);
  if (!mapScan) throw new Error('assembleGainMapJpeg: gain-map image is not a JPEG');
  if (mapScan.truncated) throw new Error('assembleGainMapJpeg: gain-map image has no EOI (truncated JPEG)');
  if (baseScan.trailerStart !== null) {
    throw new Error('assembleGainMapJpeg: base image already has a post-EOI trailer (already a multi-picture file?)');
  }

  // 1. The gain-map image gets BOTH metadata forms (plan section 4.2): the hdrgm XMP
  //    that Adobe/Android<=14 read, and the ISO 21496-1 blob that Skia/Apple do.
  const mapFinal = insertJpegSegments(
    mapJpeg,
    [buildXmpApp1(buildGainMapXmp(meta)), buildIsoGainMapApp2(meta)],
    { replace: true },
  );
  if (mapFinal === mapJpeg) throw new Error('assembleGainMapJpeg: could not add metadata to the gain-map image');

  // 2. The primary's XMP declares the container directory, and needs the gain
  //    map's FINAL length - which is why step 1 comes first.
  const uids = opts.imageUids?.length
    ? opts.imageUids.map(u => {
      const b = typeof u === 'string' ? enc.encode(u) : u;
      const out = new Uint8Array(33);
      out.set(b.subarray(0, 33), 0);
      return out;
    })
    : null;
  if (uids && uids.length !== 2) throw new Error('assembleGainMapJpeg: imageUids must have exactly 2 entries');

  const withXmp = insertJpegSegments(baseJpeg, [buildXmpApp1(buildPrimaryXmp(mapFinal.length))], { replace: true });
  if (withXmp === baseJpeg) throw new Error('assembleGainMapJpeg: could not add the container XMP to the base image');

  // 3. MPF is last of the primary's segments, so no later insertion of ours can
  //    shift the offsets it is about to record.
  const primary = insertJpegSegments(withXmp, [buildMpfSegment(2, uids)], { replace: true });
  if (primary === withXmp) throw new Error('assembleGainMapJpeg: could not add the MPF index to the base image');

  // 4. Concatenate, then fill in sizes and offsets against the finished bytes.
  const out = new Uint8Array(primary.length + mapFinal.length);
  out.set(primary, 0);
  out.set(mapFinal, primary.length);
  const ok = patchMpfEntries(out, [
    { start: 0, length: primary.length },
    { start: primary.length, length: mapFinal.length },
  ]);
  if (!ok) throw new Error('assembleGainMapJpeg: MPF index could not be located for offset patching');
  return out;
}
