// SPDX-License-Identifier: MPL-2.0
/**
 * Video provenance — embeds the export authorship record (metadata.js) into the
 * two MediaRecorder containers, which are produced bare (no metadata slot exists
 * during recording, so the shell post-processes the finished bytes):
 *
 *   MP4  — an iTunes-style `udta ▸ meta ▸ ilst` box appended into `moov`
 *          (©nam/©ART/©day/©cmt/©too + a freeform PUBLISHER item — the keys
 *          ffprobe/players surface as title/artist/date/comment/encoder).
 *   WebM — a Matroska `Tags` element (one SimpleTag per field, TargetType 50 =
 *          whole movie) appended to the Segment, with the Segment size VINT
 *          patched in place and a Tags entry grown into the SeekHead's reserved
 *          Void — demuxers only parse linearly up to the first Cluster, so an
 *          unindexed trailing element would never be read (see embedWebmMeta).
 *
 * Pure bytes-in/bytes-out (no DOM, no async) like apng.js/tiff.js. Both embed
 * functions are conservative: any structure they don't recognise (64-bit moov,
 * existing udta, non-EBML input) returns the ORIGINAL bytes untouched — a
 * playable file without provenance always beats a corrupted one with it.
 */

import type { ExportMeta } from './bridge/host-v1.ts';
import { concatBytes } from './bytes.ts';

/** Per-container tag values normalised from an ExportMeta record. */
export interface VideoProvenanceTags {
  title: string;
  artist: string;
  date: string;
  comment: string;
  encoder: string;
  encodedBy: string;
  publisher: string;
}

interface BoxInfo {
  off: number;
  size: number;
  type: string;
}

interface Vint {
  width: number;
  value: number;
  unknown: boolean;
}

interface ElementId {
  width: number;
  value: number;
}

interface SegmentElement {
  off: number;
  id: number;
  idWidth: number;
  sizeWidth: number;
  size: number;
  unknown: boolean;
}

interface SegmentScan {
  elements: SegmentElement[];
  firstCluster: SegmentElement | null;
}

interface SeekSplice {
  start: number;
  end: number;
  bytes: Uint8Array;
}

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

// Local variadic form of the shared concatBytes (bytes.ts).
const concat = (...parts: Uint8Array[]): Uint8Array => concatBytes(parts);

/**
 * Normalise an ExportMeta record into the per-container tag values. `date` is
 * injected by the caller (the moment of export) so the byte-writers stay pure.
 * Empty fields (e.g. author without profile opt-in) are omitted downstream.
 */
export function videoProvenanceTags(meta?: Partial<ExportMeta> | null, date: Date = new Date()): VideoProvenanceTags {
  const clean = (s: unknown): string => (s == null ? '' : String(s).trim());
  const software = clean(meta?.software) || 'Lolly';
  const source   = clean(meta?.source);
  return {
    title:     clean(meta?.tool),
    artist:    clean(meta?.author),
    date:      date.toISOString(),
    // Same credit line the GIF comment carries (see withGifComment call sites).
    comment:   [clean(meta?.description), clean(meta?.contact), source].filter(Boolean).join(' · '),
    encoder:   source ? `${software} (${source})` : software,
    encodedBy: source,
    publisher: source,
  };
}

// ── MP4 (ISO BMFF) ────────────────────────────────────────────────────────────

// The BMFF/EBML primitives below are shared with the C2PA modules (c2pa.js
// places manifests into these same containers; c2pa-verify.js reads them back)
// — this file stays the single owner of the two containers' byte grammar.
export const be32 = (n: number): Uint8Array => new Uint8Array([n >>> 24 & 0xff, n >>> 16 & 0xff, n >>> 8 & 0xff, n & 0xff]);
// Latin-1 byte per char — iTunes keys use the single byte 0xA9 ('©'), which
// TextEncoder would mis-encode as two UTF-8 bytes.
export const fourcc = (s: string): Uint8Array => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);
export const box = (type: string, ...parts: Uint8Array[]): Uint8Array => {
  const payload = concat(...parts);
  return concat(be32(8 + payload.length), fourcc(type), payload);
};

// In-bounds by each caller's guard; `?? 0` only satisfies noUncheckedIndexedAccess
// (an out-of-bounds byte would coerce to 0 in the original bitwise math too).
const readU32 = (bytes: Uint8Array, off: number): number => ((bytes[off] ?? 0) << 24 | (bytes[off + 1] ?? 0) << 16 | (bytes[off + 2] ?? 0) << 8 | (bytes[off + 3] ?? 0)) >>> 0;
const boxType = (bytes: Uint8Array, off: number): string => String.fromCharCode(bytes[off + 4] ?? 0, bytes[off + 5] ?? 0, bytes[off + 6] ?? 0, bytes[off + 7] ?? 0);

// Walk sibling boxes in [start, end); returns [{ off, size, type }] or null on
// any structure we can't safely rewrite (64-bit sizes, truncation).
export function walkBoxes(bytes: Uint8Array, start: number, end: number): BoxInfo[] | null {
  const out: BoxInfo[] = [];
  let off = start;
  while (off < end) {
    if (off + 8 > end) return null;
    let size = readU32(bytes, off);
    if (size === 0) size = end - off;        // "to end of file" (last box only)
    if (size === 1 || size < 8 || off + size > end) return null; // 64-bit / malformed
    out.push({ off, size, type: boxType(bytes, off) });
    off += size;
  }
  return out;
}

// iTunes value slot: type 1 = UTF-8 text, locale 0.
const dataAtom = (value: string): Uint8Array => box('data', be32(1), be32(0), utf8(value));
const ilstItem = (key: string, value: string): Uint8Array => box(key, dataAtom(value));
// Freeform "----" item — surfaces in ffprobe/players under its NAME.
const freeform = (name: string, value: string): Uint8Array =>
  box('----', box('mean', be32(0), fourcc('com.apple.iTunes')), box('name', be32(0), fourcc(name)), dataAtom(value));

// Big-endian u32 write in place.
const writeU32 = (buf: Uint8Array, off: number, v: number): void => {
  buf[off] = (v >>> 24) & 0xff; buf[off + 1] = (v >>> 16) & 0xff;
  buf[off + 2] = (v >>> 8) & 0xff; buf[off + 3] = v & 0xff;
};

// After inserting `delta` bytes at file position `insertAt` (the end of moov,
// which is the start of mdat in a fast-start file), every chunk-offset entry in
// moov's stco/co64 tables that points at/after `insertAt` is now stale by
// `delta`. Walk moov ▸ trak ▸ mdia ▸ minf ▸ stbl ▸ stco|co64 and fix them in
// place. Without this a fast-start MP4 (moov before mdat — the shell's own
// WebCodecs/MediaRecorder output) is corrupted: players can't locate samples.
function patchChunkOffsets(buf: Uint8Array, moovOff: number, moovSize: number, insertAt: number, delta: number): void {
  const kids = (start: number, end: number, type: string): BoxInfo | undefined =>
    (walkBoxes(buf, start, end) ?? []).find((b) => b.type === type);
  for (const trak of (walkBoxes(buf, moovOff + 8, moovOff + moovSize) ?? []).filter((b) => b.type === 'trak')) {
    const mdia = kids(trak.off + 8, trak.off + trak.size, 'mdia'); if (!mdia) continue;
    const minf = kids(mdia.off + 8, mdia.off + mdia.size, 'minf'); if (!minf) continue;
    const stbl = kids(minf.off + 8, minf.off + minf.size, 'stbl'); if (!stbl) continue;
    for (const b of walkBoxes(buf, stbl.off + 8, stbl.off + stbl.size) ?? []) {
      if (b.type !== 'stco' && b.type !== 'co64') continue;
      const wide = b.type === 'co64';
      // Never trust the declared entry count: clamp it to what the box can
      // physically hold, or a forged count (up to 2^32-1) drives a
      // billions-iteration loop over out-of-range offsets.
      const fits = Math.max(0, Math.floor((b.size - 16) / (wide ? 8 : 4)));
      const count = Math.min(readU32(buf, b.off + 12), fits);
      for (let i = 0; i < count; i++) {
        const p = b.off + 16 + i * (wide ? 8 : 4);
        if (wide) {
          const val = readU32(buf, p) * 4294967296 + readU32(buf, p + 4);
          if (val >= insertAt) { const nv = val + delta; writeU32(buf, p, Math.floor(nv / 4294967296)); writeU32(buf, p + 4, nv >>> 0); }
        } else {
          const val = readU32(buf, p);
          if (val >= insertAt) writeU32(buf, p, val + delta);
        }
      }
    }
  }
}

/**
 * Append provenance tags into the MP4's `moov` as `udta ▸ meta ▸ ilst`.
 * Returns new bytes, or the input untouched when the structure is unexpected
 * (no 32-bit moov, or a udta already present).
 */
export function embedMp4Meta(bytes: Uint8Array, tags: VideoProvenanceTags): Uint8Array {
  const top = walkBoxes(bytes, 0, bytes.length);
  const moov = top?.find((b) => b.type === 'moov');
  if (!moov) return bytes;
  const children = walkBoxes(bytes, moov.off + 8, moov.off + moov.size);
  if (!children || children.some((b) => b.type === 'udta')) return bytes;

  const items: Uint8Array[] = [];
  if (tags.title)     items.push(ilstItem('©nam', tags.title));
  if (tags.artist)    items.push(ilstItem('©ART', tags.artist));
  if (tags.date)      items.push(ilstItem('©day', tags.date));
  if (tags.comment)   items.push(ilstItem('©cmt', tags.comment));
  if (tags.encoder)   items.push(ilstItem('©too', tags.encoder));
  if (tags.publisher) items.push(freeform('PUBLISHER', tags.publisher));
  if (!items.length) return bytes;

  // meta is a FullBox (4 bytes version/flags) whose hdlr declares the iTunes
  // metadata handler ('mdir'/'appl') — required for parsers to read the ilst.
  const hdlr = box('hdlr', be32(0), be32(0), fourcc('mdir'), fourcc('appl'), be32(0), be32(0), new Uint8Array(1));
  const udta = box('udta', box('meta', be32(0), hdlr, box('ilst', ...items)));

  const out = concat(
    bytes.subarray(0, moov.off),
    be32(moov.size + udta.length), fourcc('moov'),
    bytes.subarray(moov.off + 8, moov.off + moov.size),
    udta,
    bytes.subarray(moov.off + moov.size),
  );
  // Fast-start files (moov before mdat — the shell's own output) just had mdat
  // pushed forward by udta.length; fix the now-stale chunk offsets or the video
  // is unplayable. (moov after mdat: nothing shifted, offsets stay valid.)
  const mdat = top!.find((b) => b.type === 'mdat');
  if (mdat && mdat.off > moov.off) {
    patchChunkOffsets(out, moov.off, moov.size + udta.length, moov.off + moov.size, udta.length);
  }
  return out;
}

// ── WebM (Matroska / EBML) ────────────────────────────────────────────────────

export const EBML_ID: number[]    = [0x1a, 0x45, 0xdf, 0xa3];
export const SEGMENT_ID: number[] = [0x18, 0x53, 0x80, 0x67];
const ID_TAGS       = new Uint8Array([0x12, 0x54, 0xc3, 0x67]);
const ID_TAG        = new Uint8Array([0x73, 0x73]);
const ID_TARGETS    = new Uint8Array([0x63, 0xc0]);
const ID_TARGETTYPE = new Uint8Array([0x68, 0xca]);
const ID_SIMPLETAG  = new Uint8Array([0x67, 0xc8]);
const ID_TAGNAME    = new Uint8Array([0x45, 0xa3]);
const ID_TAGSTRING  = new Uint8Array([0x44, 0x87]);
const ID_SEEK       = new Uint8Array([0x4d, 0xbb]);
const ID_SEEKID     = new Uint8Array([0x53, 0xab]);
const ID_SEEKPOS    = new Uint8Array([0x53, 0xac]);
// Element ids (raw, marker bits kept) seen while walking Segment children.
export const SEEKHEAD = 0x114d9b74;
export const CLUSTER  = 0x1f43b675;
export const CUES     = 0x1c53bb6b;
const VOID     = 0xec;
const CRC32    = 0xbf;

// Parse a size VINT at `off`: width from leading zeros of the first byte; the
// value is the remaining bits. All-ones data bits mean "unknown size".
export function readVint(bytes: Uint8Array, off: number): Vint | null {
  const first = bytes[off];
  if (first === undefined || first === 0) return null;
  let width = 1;
  while (!(first & (0x80 >> (width - 1)))) width++;
  if (off + width > bytes.length) return null;
  let value = first & (0xff >> width);
  let allOnes = value === (0xff >> width);
  for (let i = 1; i < width; i++) {
    value = value * 256 + (bytes[off + i] ?? 0);
    allOnes = allOnes && bytes[off + i] === 0xff;
  }
  return { width, value, unknown: allOnes };
}

// Encode `value` as a size VINT. Minimal width unless `width` is forced (used
// to patch a size in place without shifting the rest of the file).
export function writeVint(value: number, width?: number): Uint8Array | null {
  let w = width ?? 1;
  if (width == null) while (w < 8 && value > 2 ** (7 * w) - 2) w++;
  if (value > 2 ** (7 * w) - 2) return null; // doesn't fit (would read as unknown)
  const out = new Uint8Array(w);
  let v = value;
  for (let i = w - 1; i >= 0; i--) { out[i] = v & 0xff; v = Math.floor(v / 256); }
  out[0] = (out[0] ?? 0) | (0x80 >> (w - 1));
  return out;
}

export const ebml = (id: Uint8Array, payload: Uint8Array): Uint8Array => concat(id, writeVint(payload.length)!, payload);
const simpleTag = (name: string, value: string): Uint8Array => ebml(ID_SIMPLETAG, concat(ebml(ID_TAGNAME, utf8(name)), ebml(ID_TAGSTRING, utf8(value))));

function buildTagsElement(tags: VideoProvenanceTags): Uint8Array | null {
  const entries: Uint8Array[] = [];
  if (tags.title)     entries.push(simpleTag('TITLE', tags.title));
  if (tags.artist)    entries.push(simpleTag('ARTIST', tags.artist));
  if (tags.date)      entries.push(simpleTag('DATE_RELEASED', tags.date));
  if (tags.comment)   entries.push(simpleTag('COMMENT', tags.comment));
  if (tags.encoder)   entries.push(simpleTag('ENCODER', tags.encoder));
  if (tags.encodedBy) entries.push(simpleTag('ENCODED_BY', tags.encodedBy));
  if (tags.publisher) entries.push(simpleTag('PUBLISHER', tags.publisher));
  if (!entries.length) return null;
  // TargetTypeValue 50 = the whole movie — where players/ffmpeg read global tags.
  const targets = ebml(ID_TARGETS, ebml(ID_TARGETTYPE, new Uint8Array([50])));
  return ebml(ID_TAGS, ebml(ID_TAG, concat(targets, ...entries)));
}

export const idAt = (bytes: Uint8Array, off: number, id: number[]): boolean => id.every((b, i) => bytes[off + i] === b);

// Read a raw EBML element id (marker bits kept — ids are compared verbatim).
export function readId(bytes: Uint8Array, off: number): ElementId | null {
  const first = bytes[off];
  if (first === undefined || first === 0) return null;
  let width = 1;
  while (width <= 4 && !(first & (0x80 >> (width - 1)))) width++;
  if (width > 4 || off + width > bytes.length) return null;
  let value = 0;
  for (let i = 0; i < width; i++) value = value * 256 + (bytes[off + i] ?? 0);
  return { width, value };
}

// Walk Segment children up to the first Cluster (Tags placement never needs to
// look past it). Returns { elements, firstCluster } or null on malformed input.
// Stops cleanly at a child with unknown size (streaming Clusters) — that child
// is recorded, but nothing beyond it.
export function scanSegmentChildren(bytes: Uint8Array, start: number, end: number): SegmentScan | null {
  const elements: SegmentElement[] = [];
  let off = start;
  while (off < end) {
    const id = readId(bytes, off);
    if (!id) return null;
    const size = readVint(bytes, off + id.width);
    if (!size) return null;
    const el: SegmentElement = { off, id: id.value, idWidth: id.width, sizeWidth: size.width, size: size.value, unknown: size.unknown };
    elements.push(el);
    if (id.value === CLUSTER) return { elements, firstCluster: el };
    if (size.unknown) return { elements, firstCluster: null };
    off += id.width + size.width + size.value;
  }
  return { elements, firstCluster: null };
}

export const beUint = (n: number): Uint8Array => {
  const out: number[] = [];
  do { out.unshift(n & 0xff); n = Math.floor(n / 256); } while (n > 0);
  return new Uint8Array(out);
};

// A Void element spanning exactly `span` bytes (id + size VINT + zero payload).
function voidElement(span: number): Uint8Array | null {
  for (let w = 1; w <= 8; w++) {
    const payload = span - 1 - w;
    if (payload < 0) continue;
    const size = writeVint(payload, w);
    if (size) return concat(new Uint8Array([VOID]), size, new Uint8Array(payload));
  }
  return null;
}

// Index an appended Segment-level element in the SeekHead so demuxers actually
// find it: ffmpeg & friends parse a Matroska file linearly only up to the first
// Cluster, then locate trailing elements (Cues, Tags, Attachments) through the
// SeekHead. Muxers (Chrome included) reserve a Void right after the SeekHead
// for exactly this kind of amendment — the SeekHead grows into it, so no byte
// in the file moves and every existing SeekPosition stays valid. Returns a
// { start, end, bytes } splice for the caller, or null when the shape doesn't
// allow a safe update (no adjacent Void, CRC-protected SeekHead, entry doesn't
// fit). `seekId` is the raw EBML id of the indexed element (e.g. ID_TAGS).
export function seekHeadEntrySplice(bytes: Uint8Array, scan: SegmentScan, seekId: Uint8Array, pos: number): SeekSplice | null {
  const i = scan.elements.findIndex((e) => e.id === SEEKHEAD && !e.unknown);
  if (i < 0) return null;
  const sh = scan.elements[i]!;
  const voidEl = scan.elements[i + 1];
  if (!voidEl || voidEl.id !== VOID || voidEl.unknown) return null;
  const shPayload = sh.off + sh.idWidth + sh.sizeWidth;
  if (readId(bytes, shPayload)?.value === CRC32) return null; // would invalidate the CRC

  const entry = ebml(ID_SEEK, concat(ebml(ID_SEEKID, seekId), ebml(ID_SEEKPOS, beUint(pos))));
  const newShSize = writeVint(sh.size + entry.length, sh.sizeWidth);
  const voidSpan = voidEl.idWidth + voidEl.sizeWidth + voidEl.size;
  const newVoid = voidSpan - entry.length >= 2 ? voidElement(voidSpan - entry.length) : null;
  if (!newShSize || !newVoid) return null;

  const voidEnd = voidEl.off + voidSpan;
  return {
    start: sh.off,
    end: voidEnd,
    bytes: concat(
      bytes.subarray(sh.off, sh.off + sh.idWidth), newShSize,
      bytes.subarray(shPayload, shPayload + sh.size), entry,
      newVoid,
    ),
  };
}

/**
 * Add a Matroska Tags element to the WebM's Segment.
 *
 * Finalised (known-size) Segments — what MediaRecorder blobs actually are —
 * get Tags appended at the Segment's end, the Segment size VINT patched in the
 * same width, and a Tags entry added to the SeekHead (grown into the muxer's
 * reserved Void) so demuxers that only scan up to the first Cluster still find
 * it. Streaming unknown-size Segments get Tags inserted before the first
 * Cluster when nothing indexes byte positions (no SeekHead/Cues), else
 * appended at EOF. Returns the input untouched when the bytes aren't a
 * recognisable EBML file.
 */
export function embedWebmMeta(bytes: Uint8Array, tags: VideoProvenanceTags): Uint8Array {
  const tagsEl = buildTagsElement(tags);
  if (!tagsEl) return bytes;
  if (!idAt(bytes, 0, EBML_ID)) return bytes;
  const headSize = readVint(bytes, EBML_ID.length);
  if (!headSize || headSize.unknown) return bytes;

  const segOff = EBML_ID.length + headSize.width + headSize.value;
  if (!idAt(bytes, segOff, SEGMENT_ID)) return bytes;
  const segSize = readVint(bytes, segOff + SEGMENT_ID.length);
  if (!segSize) return bytes;

  if (segSize.unknown) {
    const payloadStart = segOff + SEGMENT_ID.length + segSize.width;
    const scan = scanSegmentChildren(bytes, payloadStart, bytes.length);
    const indexed = scan?.elements.some((e) => e.id === SEEKHEAD || e.id === CUES);
    if (scan?.firstCluster && !indexed) {
      const at = scan.firstCluster.off;
      return concat(bytes.subarray(0, at), tagsEl, bytes.subarray(at));
    }
    return concat(bytes, tagsEl);
  }

  const payloadStart = segOff + SEGMENT_ID.length + segSize.width;
  const segEnd = payloadStart + segSize.value;
  if (segEnd > bytes.length) return bytes;
  const patched = writeVint(segSize.value + tagsEl.length, segSize.width);
  if (!patched) return bytes; // new size doesn't fit the existing VINT width

  // Tags lands at the payload's end, so its SeekPosition (relative to the
  // payload start) is the original payload length.
  const scan = scanSegmentChildren(bytes, payloadStart, segEnd);
  const splice = scan ? seekHeadEntrySplice(bytes, scan, ID_TAGS, segSize.value) : null;
  const payload = splice
    ? concat(bytes.subarray(payloadStart, splice.start), splice.bytes, bytes.subarray(splice.end, segEnd))
    : bytes.subarray(payloadStart, segEnd);
  return concat(
    bytes.subarray(0, segOff + SEGMENT_ID.length),
    patched,
    payload,
    tagsEl,
    bytes.subarray(segEnd),
  );
}
