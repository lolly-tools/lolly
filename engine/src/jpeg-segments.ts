// SPDX-License-Identifier: MPL-2.0
/**
 * JPEG marker-segment walker and writer - one shared primitive, DOM-free.
 *
 * plans/61-deeprichpixels.md section 4.2 / section 6 Phase B2. A gain-map JPEG is an ordinary
 * SDR JPEG carrying an MPF index (APP2), an XMP packet (APP1, possibly split
 * across an extended-XMP GUID chain), an ISO 21496-1 box and - still - EXIF and
 * an ICC profile. That is four or five metadata segments in ONE file, and their
 * relative order is no longer a matter of taste: an MPF index declares byte
 * offsets to the images that follow it, so anything inserted *before* MPF after
 * the fact shifts what MPF points at. Before this module the tree had three
 * independent ad-hoc inserters, each re-deriving "where do I splice" with a
 * different, subtly wrong rule:
 *
 *   - `shells/web/src/bridge/export-image-meta.ts` `insertJpegExif` skips
 *     exactly ONE APP0, then inserts. A `sharp`/libjpeg-turbo JPEG has no APP0
 *     at all (verified in the test file), so this is "insert at offset 2" for a
 *     large class of real files - ahead of an existing APP1/APP2.
 *   - the same file's `insertJpegIcc` loops over leading APP0/APP1 segments and
 *     stops at the first non-APP0/1 - so an APP2 MPF already present would end
 *     up AFTER the ICC chunks it must precede.
 *   - `engine/src/c2pa-containers.ts` `placeJpeg` inserts after the LAST APP0,
 *     scanning the whole pre-SOS region to find it.
 *
 * A fourth hand-rolled inserter for the gain-map work would have added more bugs,
 * so the rule lives here once, as `jpegSegmentRank`.
 *
 * ─── Reader contract (docs/parser-inventory.md) ─────────────────────────────
 * This is a bounded, best-effort READER as well as a writer, and its input is a
 * file a stranger sent (an upload, a share-target drop, a `host.net` fetch), so
 * it follows the house reader contract that `icc.ts` / `png-unfilter.ts` /
 * `media-sniff.ts` state: it NEVER throws, nothing the file declares is trusted,
 * every read is bounds-checked before it happens, and malformed input yields
 * `null` (not a JPEG) or a short scan flagged `truncated` - never an exception
 * and never a byte read past the buffer. `insertJpegSegments` matches the
 * convention of the splicers it is meant to replace instead: any problem returns
 * the input bytes untouched, all or nothing, so a metadata hiccup can never
 * corrupt an export.
 *
 * ─── What a "segment" is here ───────────────────────────────────────────────
 * One marker segment: the `0xFF` byte, its marker code, and (for markers that
 * have one) its 2-byte big-endian length plus payload. Entropy-coded scan data
 * after an SOS is NOT a segment - it is walked over, with byte stuffing
 * (`FF 00`) and restart markers (`FF D0`–`FF D7`) skipped, so that a file's
 * later segments and its EOI are found even in a progressive JPEG with several
 * scans. Bytes AFTER the EOI are reported as `trailerStart` rather than
 * ignored: an MPF multi-picture file keeps its second image there, so "the
 * trailer is real data" is the whole point of Phase B2.
 */

import { concatBytes } from './bytes.ts';

/** Hard cap on marker segments walked, so a hostile file cannot make us allocate a huge list. Real JPEGs are well under 100; `shells/web/src/lib/image-sample.ts` uses 512 for the same reason. */
const MAX_SEGMENTS = 4096;
/** Longest APPn identifier string read. The longest real one is extended XMP's 34-byte namespace URI. */
const MAX_APP_ID = 64;

/** Canonical APPn identifier strings, as they appear (NUL-terminated) at the head of a segment payload. */
export const JPEG_APP_IDS = Object.freeze({
  JFIF: 'JFIF',
  EXIF: 'Exif',
  XMP: 'http://ns.adobe.com/xap/1.0/',
  XMP_EXT: 'http://ns.adobe.com/xmp/extension/',
  ICC: 'ICC_PROFILE',
  MPF: 'MPF',
  /** APP11 JUMBF (C2PA). Note this one is NOT NUL-terminated in the file - see `readAppId`. */
  JUMBF: 'JP',
});

export interface JpegSegment {
  /** Marker code - the byte AFTER the `0xFF` (e.g. 0xE1 for APP1, 0xDA for SOS). */
  readonly marker: number;
  /** For APPn markers, the leading printable-ASCII identifier (`'Exif'`, `'ICC_PROFILE'`, `'MPF'`, the XMP namespace URI, …). `null` for non-APP markers and for APPn payloads that do not start with one. */
  readonly appId: string | null;
  /** Offset of the segment's `0xFF` byte. */
  readonly start: number;
  /** Exclusive end of the marker segment itself (never past the buffer). Entropy data following an SOS is not included. */
  readonly end: number;
}

export interface JpegScan {
  readonly segments: readonly JpegSegment[];
  /** Offset of the first SOS marker, or `null` if the file has none. */
  readonly sos: number | null;
  /** Offset of the EOI marker, or `null` if the walk never reached one. */
  readonly eoi: number | null;
  /** Offset of the first byte after EOI when the file continues past it (the MPF second-image case), else `null`. */
  readonly trailerStart: number | null;
  /** True when the walk stopped before reaching EOI - misaligned bytes, a nonsense length, or the cap. The segments reported before that point are still valid. */
  readonly truncated: boolean;
}

/**
 * Read an APPn payload's leading identifier: printable ASCII up to the NUL
 * terminator, the first non-printable byte, or `MAX_APP_ID`.
 *
 * Stopping at the first non-printable byte (rather than requiring a NUL) is what
 * makes APP11 JUMBF report `'JP'` - its two-character CI is followed immediately
 * by the binary En field, with no terminator. It also means an APPn full of
 * binary reports `null` instead of mojibake. This is identification, not
 * validation: a caller that cares whether a segment REALLY is EXIF must still
 * check the bytes after the id.
 */
function readAppId(bytes: Uint8Array, from: number, to: number): string | null {
  const limit = Math.min(to, from + MAX_APP_ID, bytes.length);
  let s = '';
  for (let i = from; i < limit; i++) {
    const b = bytes[i]!;
    if (b < 0x20 || b > 0x7e) break; // NUL terminator, or binary - either ends the id
    s += String.fromCharCode(b);
  }
  return s.length ? s : null;
}

/**
 * Walk entropy-coded scan data from `from`, returning the offset of the next
 * real marker (or `bytes.length` if the data runs to EOF without one).
 * `FF 00` is a stuffed byte, `FF D0`–`FF D7` are restart markers, and a run of
 * `FF` is fill - none of those end the scan.
 */
function skipEntropy(bytes: Uint8Array, from: number): number {
  let i = from;
  while (i + 1 < bytes.length) {
    if (bytes[i] !== 0xff) { i++; continue; }
    const next = bytes[i + 1]!;
    if (next === 0xff) { i++; continue; }                  // fill byte
    if (next === 0x00) { i += 2; continue; }               // stuffed FF
    if (next >= 0xd0 && next <= 0xd7) { i += 2; continue; } // restart marker
    return i;
  }
  return bytes.length;
}

/**
 * Walk a JPEG's marker segments. Returns `null` when the bytes do not start
 * with SOI (not a JPEG); otherwise always returns a scan, with `truncated`
 * telling you whether the walk reached EOI. Never throws, never reads past the
 * end of `bytes`, and every reported `end` is `<= bytes.length`.
 */
export function scanJpegSegments(bytes: Uint8Array | null | undefined): JpegScan | null {
  if (!bytes || bytes.length < 2 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const segments: JpegSegment[] = [];
  let sos: number | null = null;
  let eoi: number | null = null;
  let p = 2;
  while (p + 1 < bytes.length) {
    if (segments.length >= MAX_SEGMENTS) break;
    if (bytes[p] !== 0xff) break; // misaligned - stop, report what we have
    // Any number of 0xFF fill bytes may precede the marker code.
    let q = p + 1;
    while (q < bytes.length && bytes[q] === 0xff) q++;
    if (q >= bytes.length) break;
    const marker = bytes[q]!;
    if (marker === 0x00) break; // a stuffed byte outside entropy data is corruption
    const start = q - 1; // the 0xFF immediately preceding the marker code
    if (marker === 0xd9) { // EOI
      segments.push({ marker, appId: null, start, end: start + 2 });
      eoi = start;
      break;
    }
    if ((marker >= 0xd0 && marker <= 0xd8) || marker === 0x01) { // standalone: RSTn, SOI, TEM
      segments.push({ marker, appId: null, start, end: start + 2 });
      p = start + 2;
      continue;
    }
    if (start + 4 > bytes.length) break;
    const len = (bytes[start + 2]! << 8) | bytes[start + 3]!;
    // The length field counts itself, so anything under 2 is nonsense, and a
    // length reaching past EOF is a lie we must not act on.
    if (len < 2 || start + 2 + len > bytes.length) break;
    const end = start + 2 + len;
    const isApp = marker >= 0xe0 && marker <= 0xef;
    segments.push({ marker, appId: isApp ? readAppId(bytes, start + 4, end) : null, start, end });
    if (marker === 0xda) { // SOS - entropy data follows the header
      if (sos === null) sos = start;
      p = skipEntropy(bytes, end);
      continue;
    }
    p = end;
  }
  const trailerStart = eoi !== null && eoi + 2 < bytes.length ? eoi + 2 : null;
  return { segments, sos, eoi, trailerStart, truncated: eoi === null };
}

/** All segments matching `marker` (and, when given, `appId`), in file order. Empty when the bytes are not a JPEG. */
export function findJpegSegments(
  bytes: Uint8Array | null | undefined,
  marker: number,
  appId?: string | null,
): readonly JpegSegment[] {
  const scan = scanJpegSegments(bytes);
  if (!scan) return [];
  return scan.segments.filter(s => s.marker === marker && (appId === undefined || s.appId === appId));
}

/** The first segment matching `marker` (and, when given, `appId`), or `null`. */
export function findJpegSegment(
  bytes: Uint8Array | null | undefined,
  marker: number,
  appId?: string | null,
): JpegSegment | null {
  return findJpegSegments(bytes, marker, appId)[0] ?? null;
}

/**
 * The segment's payload: everything after the marker and its length field, so
 * for an APPn this still INCLUDES the identifier and its terminator (callers
 * slice that off themselves, since the terminator length varies - `Exif\0\0` is
 * two bytes, `MPF\0` is one, APP11's `JP` is none). Empty for standalone
 * markers, which have no payload.
 */
export function jpegSegmentBody(bytes: Uint8Array, seg: JpegSegment): Uint8Array {
  if (seg.end - seg.start < 4) return new Uint8Array(0);
  return bytes.subarray(seg.start + 4, Math.min(seg.end, bytes.length));
}

/**
 * Build one marker segment: `FF <marker>`, a 2-byte big-endian length that
 * counts itself, then `body` (which must already contain any identifier and
 * terminator). Returns `null` when the body will not fit a JPEG segment - 
 * callers that can chunk (ICC, XMP, the manifest store) must do so themselves,
 * exactly as they do today.
 */
export function buildJpegSegment(marker: number, body: Uint8Array): Uint8Array | null {
  if (!Number.isInteger(marker) || marker < 0x01 || marker > 0xfe) return null;
  const segLen = body.length + 2;
  if (segLen > 0xffff) return null;
  const out = new Uint8Array(2 + segLen);
  out[0] = 0xff;
  out[1] = marker;
  out[2] = (segLen >> 8) & 0xff;
  out[3] = segLen & 0xff;
  out.set(body, 4);
  return out;
}

/**
 * Canonical placement order. Lower sorts earlier. The rungs that MATTER (and
 * why), reading down:
 *
 *   APP0 JFIF        first if present, because decoders and the JFIF spec expect it there
 *   APP1 EXIF        conventional, and what every EXIF reader scans for first
 *   APP1 XMP         must follow EXIF; the extended-XMP chain follows the standard packet
 *   APP2 MPF         BEFORE ICC - the MP index stores absolute byte offsets to the images
 *                    that follow, so any segment inserted ahead of it later invalidates them
 *   APP2 ICC         the profile chunks, kept contiguous and in sequence
 *   APP11 JUMBF      the C2PA store, last of the metadata (it hashes byte ranges of
 *                    everything else, so it is written last by construction)
 *   other APPn / COM after the identified ones
 *   everything else  100 - SOF/DQT/DHT/SOS never move, and no APPn may land after them
 *
 * Unknown APPn markers get `60 + n` so they stay in APPn order among themselves.
 */
export function jpegSegmentRank(marker: number, appId: string | null): number {
  if (marker === 0xe0) return 0;
  if (marker === 0xe1) {
    if (appId === JPEG_APP_IDS.EXIF) return 10;
    if (appId === JPEG_APP_IDS.XMP) return 20;
    if (appId === JPEG_APP_IDS.XMP_EXT) return 21;
    return 25;
  }
  if (marker === 0xe2) {
    if (appId === JPEG_APP_IDS.MPF) return 30;
    if (appId === JPEG_APP_IDS.ICC) return 40;
    return 45;
  }
  if (marker === 0xeb) return 50; // APP11 JUMBF / C2PA
  if (marker >= 0xe0 && marker <= 0xef) return 60 + (marker - 0xe0);
  if (marker === 0xfe) return 90; // COM
  return 100;
}

export interface InsertJpegOptions {
  /** Drop any existing segment with the same marker AND appId first, so re-stamping replaces rather than duplicates. Default false (append alongside). */
  replace?: boolean;
}

interface PreparedSegment { bytes: Uint8Array; marker: number; appId: string | null; rank: number }

/** Validate a caller-supplied segment: SOI-style framing, a self-consistent length. */
function prepare(seg: Uint8Array | null | undefined): PreparedSegment | null {
  if (!seg || seg.length < 4) return null;
  if (seg[0] !== 0xff) return null;
  const marker = seg[1]!;
  if (marker === 0x00 || marker === 0xff) return null;
  const declared = (seg[2]! << 8) | seg[3]!;
  if (declared !== seg.length - 2) return null; // must describe itself exactly
  const isApp = marker >= 0xe0 && marker <= 0xef;
  const appId = isApp ? readAppId(seg, 4, seg.length) : null;
  return { bytes: seg, marker, appId, rank: jpegSegmentRank(marker, appId) };
}

/**
 * Splice new APPn/COM segments into a JPEG at their canonical positions
 * (`jpegSegmentRank`), returning fresh bytes. Everything else - the entropy
 * data, the EOI, and any post-EOI trailer - is preserved byte for byte.
 *
 * All or nothing: if the input is not a JPEG, or ANY supplied segment is
 * malformed, the input bytes are returned untouched. Never throws.
 */
export function insertJpegSegments(
  bytes: Uint8Array,
  newSegments: readonly Uint8Array[],
  opts: InsertJpegOptions = {},
): Uint8Array {
  try {
    if (!bytes || !newSegments.length) return bytes;
    const scan = scanJpegSegments(bytes);
    if (!scan) return bytes;
    const prepared: PreparedSegment[] = [];
    for (const s of newSegments) {
      const p = prepare(s);
      if (!p) return bytes; // one bad segment poisons the batch, deliberately
      prepared.push(p);
    }

    // Only the region before the first SOS is eligible: past it lies entropy
    // data, where an offset is not a segment boundary at all.
    const head: JpegSegment[] = [];
    for (const s of scan.segments) {
      if (s.marker === 0xda) break;
      head.push(s);
    }

    // `replace`: remove existing segments of the same identity as an incoming one.
    const wanted = new Set(prepared.map(p => `${p.marker} ${p.appId ?? ''}`));
    const removals = opts.replace
      ? head.filter(s => wanted.has(`${s.marker} ${s.appId ?? ''}`))
      : [];
    const removed = new Set(removals);
    const kept = head.filter(s => !removed.has(s));

    // Position in ORIGINAL coordinates: after the last surviving segment that
    // ranks at or before us. Non-APP segments rank 100 and so never advance the
    // offset, which is what keeps an APPn ahead of SOF/DQT/DHT.
    const offsetFor = (rank: number): number => {
      let at = 2; // just after SOI
      for (const s of kept) {
        if (jpegSegmentRank(s.marker, s.appId) <= rank) at = s.end;
      }
      return at;
    };

    // Stable sort by rank keeps a caller's own order within one rank (ICC chunk
    // sequence, the extended-XMP chain), and ascending rank makes the insertion
    // offsets non-decreasing, so equal ranks land contiguously.
    const order = prepared
      .map((p, i) => ({ p, i }))
      .sort((a, b) => (a.p.rank - b.p.rank) || (a.i - b.i));

    type Action = { pos: number; ins?: Uint8Array; delEnd?: number };
    const actions: Action[] = order.map(({ p }) => ({ pos: offsetFor(p.rank), ins: p.bytes }));
    for (const r of removals) actions.push({ pos: r.start, delEnd: r.end });
    // Insertions before deletions at the same offset: insert at the boundary,
    // then skip the bytes being dropped.
    actions.sort((a, b) => (a.pos - b.pos) || ((a.ins ? 0 : 1) - (b.ins ? 0 : 1)));

    const parts: Uint8Array[] = [];
    let cursor = 0;
    for (const a of actions) {
      const at = Math.max(a.pos, cursor);
      if (at > cursor) parts.push(bytes.subarray(cursor, at));
      cursor = at;
      if (a.ins) parts.push(a.ins);
      else if (a.delEnd !== undefined && a.delEnd > cursor) cursor = a.delEnd;
    }
    if (cursor < bytes.length) parts.push(bytes.subarray(cursor));
    return concatBytes(parts);
  } catch {
    return bytes;
  }
}
