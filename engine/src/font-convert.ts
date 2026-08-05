// SPDX-License-Identifier: MPL-2.0
/**
 * Font container interconversion — TTF/OTF ⇄ WOFF1, DOM-free and synchronous.
 *
 * A font file is a *container* around a set of tables. The OpenType `sfnt`
 * container (TTF and OTF both) stores those tables uncompressed behind a sorted
 * directory; WOFF1 (W3C "WOFF File Format 1.0") is the same table set with a
 * different 44-byte header, a wider per-table directory, and each table
 * optionally zlib-compressed. So the conversions here are container surgery, not
 * glyph work: unwrap/rewrap the directory, (de)compress each table, fix offsets
 * and checksums. TTF↔OTF is a pure passthrough — the container is identical, the
 * `flavor` (sfnt version) is the only thing that says whether the outlines live
 * in `glyf` (TrueType, 0x00010000) or `CFF `/`CFF2` (OTTO).
 *
 * WOFF2 is deliberately OUT OF SCOPE: it re-encodes the tables with a MTX glyph
 * transform and Brotli, and the engine has no Brotli *encoder*. `sfntKind`
 * recognises the 'wOF2' magic so a caller can route it elsewhere, but there is
 * no wOF2 (de)coder here — {@link woffToSfnt} rejects it.
 *
 * ─── What this depends on ────────────────────────────────────────────────────
 * COMPRESSION uses the engine's own `zlibCompress` (deflate.ts) — WOFF1 stores
 * each compressed table as a zlib stream (RFC 1950), which is exactly what that
 * emits. DECOMPRESSION needs a real inflater, which the engine does not have
 * (deflate.ts is encode-only), so this imports fflate's `unzlibSync` — the same
 * dependency scripts/ingest-brand.ts and brand-import.ts already lean on for the
 * unzip half they can't do in-tree. No DOM, no fs, no network; identical bytes
 * in browser, CLI and MCP.
 *
 * ─── Hostile-input posture (the "GIF lesson") ────────────────────────────────
 * Every multi-byte read is bounds-checked against the buffer before the deref,
 * `numTables`-driven directory walks are size-checked up front (no trusting a
 * count field into an out-of-range loop), attacker-controlled length fields
 * (`origLength`, `totalSfntSize`) are capped at {@link MAX_FONT_BYTES} before any
 * allocation, and every inflate is handed a pre-sized `out` buffer so a crafted
 * short zlib stream cannot expand into a memory bomb. Malformed input throws a
 * plain `Error`; it never loops unboundedly or allocates on an unchecked count.
 */

import { zlibCompress } from './deflate.ts';
import { unzlibSync } from 'fflate';

/** A parsed container kind, or `null` when the magic matches no known font. */
export type SfntKind = 'ttf' | 'otf' | 'woff' | 'woff2';

/**
 * Largest font this module will read or produce. Guards every allocation driven
 * by an attacker-controlled length field. Generous versus the shells' 5 MB
 * upload cap (font-utils.validateFontFile) but finite — a 4 GB `origLength`
 * must never reach `new Uint8Array`.
 */
const MAX_FONT_BYTES = 64 * 1024 * 1024;

// ── sfnt / WOFF magic numbers (uint32 big-endian) ───────────────────────────
const SFNT_TRUETYPE = 0x00010000; // TrueType outlines (glyf)
const SFNT_TRUE = 0x74727565;     // 'true' — legacy Apple TrueType
const SFNT_OTTO = 0x4f54544f;     // 'OTTO' — CFF/CFF2 outlines
const WOFF_SIG = 0x774f4646;      // 'wOFF'
const WOFF2_SIG = 0x774f4632;     // 'wOF2'

const WOFF_HEADER_SIZE = 44;
const WOFF_DIR_ENTRY_SIZE = 20;
const SFNT_HEADER_SIZE = 12;
const SFNT_DIR_ENTRY_SIZE = 16;

/** Round `n` up to the next 4-byte boundary (sfnt/WOFF table alignment). */
const align4 = (n: number): number => (n + 3) & ~3;

/**
 * Detect a font container from its first four bytes. Returns the kind or `null`
 * (too short, or a magic this module does not recognise — TrueType Collections
 * 'ttcf', Type1 'typ1', etc. are intentionally not claimed).
 */
export function sfntKind(bytes: Uint8Array): SfntKind | null {
  if (bytes.length < 4) return null;
  const magic = ((bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!) >>> 0;
  if (magic === SFNT_TRUETYPE || magic === SFNT_TRUE) return 'ttf';
  if (magic === SFNT_OTTO) return 'otf';
  if (magic === WOFF_SIG) return 'woff';
  if (magic === WOFF2_SIG) return 'woff2';
  return null;
}

/** One reconstructed table: its 4-char tag as a uint32, checksum, and bytes. */
interface Table {
  tag: number;
  checksum: number;
  data: Uint8Array;
}

/** Sum a table's bytes as big-endian uint32 words (sfnt checksum, spec §"Table
 *  Directory"). Trailing bytes past the last full word are treated as a word
 *  zero-padded on the RIGHT — identical to how a 4-aligned table is laid out. */
function tableChecksum(data: Uint8Array): number {
  let sum = 0;
  const n = data.length;
  const full = n & ~3;
  let i = 0;
  for (; i < full; i += 4) {
    const w = ((data[i]! << 24) | (data[i + 1]! << 16) | (data[i + 2]! << 8) | data[i + 3]!) >>> 0;
    sum = (sum + w) >>> 0;
  }
  if (i < n) {
    // Tail: pad the final partial word on the right with zeros.
    let w = 0;
    for (let b = 0; b < 4; b++) w = ((w << 8) | (i + b < n ? data[i + b]! : 0)) >>> 0;
    sum = (sum + w) >>> 0;
  }
  return sum >>> 0;
}

/**
 * Assemble a plain sfnt from a table list. Rebuilds the offset table (with the
 * OpenType `searchRange`/`entrySelector`/`rangeShift` binary-search hints),
 * emits the directory sorted by tag (an sfnt hard requirement), lays each table
 * 4-byte aligned, and recomputes the `head` table's `checkSumAdjustment` so the
 * result is a fully valid font, not merely a byte-preserving one.
 */
function buildSfnt(flavor: number, tables: Table[]): Uint8Array {
  const numTables = tables.length;
  // Directory must be sorted ascending by tag (OpenType §"Organization of an
  // OpenType Font"). Sort a copy so the caller's order is untouched.
  const sorted = [...tables].sort((a, b) => a.tag - b.tag);

  const dirSize = numTables * SFNT_DIR_ENTRY_SIZE;
  let total = SFNT_HEADER_SIZE + dirSize;
  const offsets: number[] = [];
  for (const t of sorted) {
    offsets.push(total);
    total = align4(total + t.data.length);
  }
  if (total > MAX_FONT_BYTES) throw new Error('font-convert: reconstructed sfnt exceeds size cap');

  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);

  // Offset table: sfnt version + numTables + binary-search hints.
  const maxPow2 = numTables > 0 ? 1 << (31 - Math.clz32(numTables)) : 0; // largest 2^k <= numTables
  const searchRange = maxPow2 * 16;
  const entrySelector = numTables > 0 ? 31 - Math.clz32(maxPow2) : 0;    // log2(maxPow2)
  const rangeShift = numTables * 16 - searchRange;
  view.setUint32(0, flavor >>> 0, false);
  view.setUint16(4, numTables, false);
  view.setUint16(6, searchRange, false);
  view.setUint16(8, entrySelector, false);
  view.setUint16(10, rangeShift, false);

  let headOffset = -1;
  const HEAD_TAG = 0x68656164; // 'head'
  for (let i = 0; i < numTables; i++) {
    const t = sorted[i]!;
    const dirOff = SFNT_HEADER_SIZE + i * SFNT_DIR_ENTRY_SIZE;
    view.setUint32(dirOff, t.tag >>> 0, false);
    view.setUint32(dirOff + 4, t.checksum >>> 0, false);
    view.setUint32(dirOff + 8, offsets[i]!, false);
    view.setUint32(dirOff + 12, t.data.length, false); // unpadded length
    out.set(t.data, offsets[i]!);
    if (t.tag === HEAD_TAG) headOffset = offsets[i]!;
  }

  // checkSumAdjustment (head +8): 0xB1B0AFBA minus the checksum of the WHOLE
  // font computed with that field zeroed (OpenType §head). Padding/ordering may
  // differ from the original sfnt, so this is recomputed rather than copied.
  if (headOffset >= 0 && headOffset + 12 <= out.length) {
    view.setUint32(headOffset + 8, 0, false);
    const whole = tableChecksum(out);
    view.setUint32(headOffset + 8, (0xb1b0afba - whole) >>> 0, false);
  }
  return out;
}

/**
 * Unwrap a WOFF1 font into a plain sfnt (TTF or OTF, per the WOFF `flavor`).
 * Each table is inflated when `compLength < origLength` (zlib stream) or copied
 * verbatim when stored (`compLength === origLength`); the sfnt header, directory
 * offsets and `head.checkSumAdjustment` are rebuilt. Throws on WOFF2 or any
 * malformed field.
 */
export function woffToSfnt(bytes: Uint8Array): Uint8Array {
  const kind = sfntKind(bytes);
  if (kind === 'ttf' || kind === 'otf') return bytes; // already an sfnt
  if (kind === 'woff2') throw new Error('font-convert: WOFF2 is not supported (no Brotli decoder)');
  if (kind !== 'woff') throw new Error('font-convert: not a WOFF file');
  if (bytes.length < WOFF_HEADER_SIZE) throw new Error('font-convert: truncated WOFF header');

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const flavor = view.getUint32(4, false);
  const length = view.getUint32(8, false);
  const numTables = view.getUint16(12, false);
  const totalSfntSize = view.getUint32(16, false);

  if (length > bytes.length) throw new Error('font-convert: WOFF length field exceeds buffer');
  if (totalSfntSize > MAX_FONT_BYTES) throw new Error('font-convert: WOFF totalSfntSize exceeds size cap');
  // Bounds-check the whole directory before iterating on the count field.
  const dirEnd = WOFF_HEADER_SIZE + numTables * WOFF_DIR_ENTRY_SIZE;
  if (numTables === 0 || dirEnd > bytes.length) throw new Error('font-convert: WOFF directory out of range');

  const tables: Table[] = [];
  for (let i = 0; i < numTables; i++) {
    const e = WOFF_HEADER_SIZE + i * WOFF_DIR_ENTRY_SIZE;
    const tag = view.getUint32(e, false);
    const offset = view.getUint32(e + 4, false);
    const compLength = view.getUint32(e + 8, false);
    const origLength = view.getUint32(e + 12, false);
    const origChecksum = view.getUint32(e + 16, false);

    if (origLength > MAX_FONT_BYTES) throw new Error('font-convert: WOFF table origLength exceeds size cap');
    if (compLength > origLength) throw new Error('font-convert: WOFF table compLength > origLength');
    // offset + compLength must land inside the file (checked in a form that
    // cannot overflow: both are uint32, so compare against the remaining span).
    if (offset > bytes.length || compLength > bytes.length - offset) {
      throw new Error('font-convert: WOFF table data out of range');
    }

    const comp = bytes.subarray(offset, offset + compLength);
    let data: Uint8Array;
    if (compLength < origLength) {
      // Compressed: a zlib stream. Bound the inflate with a pre-sized out buffer
      // so a crafted stream cannot expand past origLength.
      const out = new Uint8Array(origLength);
      let inflated: Uint8Array;
      try {
        inflated = unzlibSync(comp, { out });
      } catch {
        throw new Error('font-convert: WOFF table inflate failed');
      }
      if (inflated.length !== origLength) throw new Error('font-convert: WOFF table inflated to wrong length');
      data = inflated;
    } else {
      // Stored (compLength === origLength): copy so the result owns its bytes.
      data = comp.slice();
    }
    tables.push({ tag, checksum: origChecksum, data });
  }

  return buildSfnt(flavor, tables);
}

/**
 * Wrap a TTF/OTF as a WOFF1 font. Each table is zlib-compressed with the
 * engine's `zlibCompress`; the compressed form is kept only when it is actually
 * smaller, otherwise the table is stored (`compLength === origLength`) so a WOFF
 * never expands a table. The WOFF header, table directory, and 4-byte table
 * padding are written; the optional metadata/private blocks are omitted. Throws
 * on a WOFF input or a malformed sfnt.
 */
export function sfntToWoff(bytes: Uint8Array): Uint8Array {
  const kind = sfntKind(bytes);
  if (kind === 'woff' || kind === 'woff2') throw new Error('font-convert: input is already a WOFF');
  if (kind !== 'ttf' && kind !== 'otf') throw new Error('font-convert: not a TTF/OTF (sfnt) file');
  if (bytes.length < SFNT_HEADER_SIZE) throw new Error('font-convert: truncated sfnt header');

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const flavor = view.getUint32(0, false);
  const numTables = view.getUint16(4, false);
  const dirEnd = SFNT_HEADER_SIZE + numTables * SFNT_DIR_ENTRY_SIZE;
  if (numTables === 0 || dirEnd > bytes.length) throw new Error('font-convert: sfnt directory out of range');

  // Read the sfnt directory, then build each WOFF table entry (compress-or-store).
  interface WoffTable { tag: number; comp: Uint8Array; compLength: number; origLength: number; checksum: number; }
  const wtables: WoffTable[] = [];
  for (let i = 0; i < numTables; i++) {
    const e = SFNT_HEADER_SIZE + i * SFNT_DIR_ENTRY_SIZE;
    const tag = view.getUint32(e, false);
    const checksum = view.getUint32(e + 4, false);
    const offset = view.getUint32(e + 8, false);
    const origLength = view.getUint32(e + 12, false);
    if (offset > bytes.length || origLength > bytes.length - offset) {
      throw new Error('font-convert: sfnt table data out of range');
    }
    const data = bytes.subarray(offset, offset + origLength);
    const zlib = zlibCompress(data);
    // Keep compression only if it wins; otherwise store the raw table.
    const useComp = zlib.length < origLength;
    wtables.push({
      tag,
      comp: useComp ? zlib : data,
      compLength: useComp ? zlib.length : origLength,
      origLength,
      checksum,
    });
  }
  // WOFF directory must also be sorted ascending by tag.
  wtables.sort((a, b) => a.tag - b.tag);

  // Lay out: header + directory, then each (padded) table block.
  const dirSize = numTables * WOFF_DIR_ENTRY_SIZE;
  let cursor = WOFF_HEADER_SIZE + dirSize;
  const dataOffsets: number[] = [];
  for (const t of wtables) {
    dataOffsets.push(cursor);
    cursor = align4(cursor + t.compLength);
  }
  const totalLength = cursor;
  // totalSfntSize is the size the *decompressed* sfnt would occupy.
  let totalSfntSize = SFNT_HEADER_SIZE + numTables * SFNT_DIR_ENTRY_SIZE;
  for (const t of wtables) totalSfntSize = align4(totalSfntSize + t.origLength);
  if (totalLength > MAX_FONT_BYTES) throw new Error('font-convert: WOFF output exceeds size cap');

  const out = new Uint8Array(totalLength);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, WOFF_SIG, false);
  dv.setUint32(4, flavor >>> 0, false);
  dv.setUint32(8, totalLength, false);
  dv.setUint16(12, numTables, false);
  dv.setUint16(14, 0, false);              // reserved, must be 0
  dv.setUint32(16, totalSfntSize >>> 0, false);
  dv.setUint16(20, 1, false);              // majorVersion (arbitrary; 1.0)
  dv.setUint16(22, 0, false);              // minorVersion
  dv.setUint32(24, 0, false);              // metaOffset  (none)
  dv.setUint32(28, 0, false);              // metaLength
  dv.setUint32(32, 0, false);              // metaOrigLength
  dv.setUint32(36, 0, false);              // privOffset  (none)
  dv.setUint32(40, 0, false);              // privLength

  for (let i = 0; i < numTables; i++) {
    const t = wtables[i]!;
    const e = WOFF_HEADER_SIZE + i * WOFF_DIR_ENTRY_SIZE;
    dv.setUint32(e, t.tag >>> 0, false);
    dv.setUint32(e + 4, dataOffsets[i]!, false);
    dv.setUint32(e + 8, t.compLength, false);
    dv.setUint32(e + 12, t.origLength, false);
    dv.setUint32(e + 16, t.checksum >>> 0, false);
    out.set(t.comp.subarray(0, t.compLength), dataOffsets[i]!);
    // Padding bytes between tables are already zero (fresh Uint8Array).
  }
  return out;
}
