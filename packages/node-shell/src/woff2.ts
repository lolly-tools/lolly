// SPDX-License-Identifier: MPL-2.0
/**
 * The one place Lolly turns a WOFF2 file into sfnt bytes, for the web app and Node alike.
 *
 * The decoder is still `woff2-encoder/decompress`: Google's woff2 C++ library with
 * Brotli 1.0.3, compiled to WebAssembly. Brotli 1.0.3 to 1.2.0 carry CVE-2026-111497,
 * an out-of-bounds write in the decoder's block-switch handling, and a WOFF2 file is
 * a Brotli stream the sender wrote. Until a memory-safe decoder replaces the module,
 * every caller goes through `decodeWoff2`, which:
 *
 * - reads the WOFF2 header and table directory first (`preflightWoff2`) with the same
 *   rules the C++ reader applies, and refuses before the decoder runs when the file
 *   is malformed or would need more memory than the decoder's own 30 MiB output
 *   ceiling. The decoder allocates its whole Brotli target up front, from the
 *   directory, at up to 100 times the file size; one crafted 11 MB file used to grow
 *   the shared module by about 1 GB for the rest of the session, and repeated
 *   larger ones stopped every later WOFF2 decode in that process;
 * - checks what comes back (`checkSfntOutput`): an sfnt or collection header whose
 *   table records lie inside the returned bytes, at most the caller's limit;
 * - keeps the decoder behind one import, so replacing the module touches this file.
 *
 * What it cannot do: the Brotli stream itself is only read by the decoder, so this
 * does not stop the CVE's out-of-bounds write. That write stays inside the module's
 * linear memory; what it can change is the output of that decode, and the module's
 * heap for later decodes in the same page or process. Callers treat the output as
 * untrusted input to their own font readers, as they would a TTF a person uploaded.
 */

/** The decoder's own ceilings (google/woff2 `kDefaultMaxSize` and its plausible ratio). */
export const WOFF2_LIMITS = Object.freeze({
  /** The largest WOFF2 file read: the font upload limit. */
  maxInputBytes: 32 * 1024 * 1024,
  /** The largest sfnt the decoder writes, and the largest Brotli target it is asked for. */
  maxOutputBytes: 30 * 1024 * 1024,
  /** Decompressed table bytes per byte of file, as google/woff2 refuses above. */
  maxRatio: 100,
});

export type Woff2Limits = typeof WOFF2_LIMITS;

export type Woff2ErrorCode = 'not-woff2' | 'too-large' | 'malformed' | 'decode-failed' | 'bad-output';

export class Woff2Error extends Error {
  readonly code: Woff2ErrorCode;
  constructor(code: Woff2ErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'Woff2Error';
    this.code = code;
  }
}

/** What the header and table directory declare, read without decompressing anything. */
export interface Woff2Facts {
  flavor: number;
  collection: boolean;
  numTables: number;
  /** The header's totalSfntSize. Advisory: the decoder does not rely on it either. */
  totalSfntSize: number;
  /** The Brotli target size: the sum of every table's stored length. */
  uncompressedSize: number;
  compressedOffset: number;
  compressedLength: number;
  /** The sfnt header and table records the decoder writes before any table data. */
  headerBytes: number;
  /** Fonts in a collection; 1 for a single font. */
  fonts: number;
}

const WOFF2_SIGNATURE = 0x774f4632; // 'wOF2'
const TTC_FLAVOR = 0x74746366; // 'ttcf'
const SFNT_FLAVORS = new Set([0x00010000, 0x4f54544f /* OTTO */, 0x74727565 /* true */]);
const GLYF_INDEX = 10;
const LOCA_INDEX = 11;
const GLYF_TAG = 0x676c7966;
const LOCA_TAG = 0x6c6f6361;
const HEADER_BYTES = 48;

const round4 = (n: number): number => (n + 3) - ((n + 3) % 4);
const sizeText = (n: number): string => (n >= 1048576 ? `${Math.floor(n / 1048576)} MB` : `${n} bytes`);

function malformed(what: string): Woff2Error {
  return new Woff2Error('malformed', `This WOFF2 font is damaged: ${what}.`);
}

/** A bounded reader over the WOFF2 header area. Every read checks the remaining length. */
class Reader {
  offset = 0;
  private readonly view: DataView;
  constructor(view: DataView) { this.view = view; }
  private need(n: number, what: string): void {
    if (this.offset + n > this.view.byteLength) throw malformed(`${what} runs past the end of the file`);
  }
  u8(what: string): number { this.need(1, what); return this.view.getUint8(this.offset++); }
  u16(what: string): number { this.need(2, what); const v = this.view.getUint16(this.offset); this.offset += 2; return v; }
  u32(what: string): number { this.need(4, what); const v = this.view.getUint32(this.offset); this.offset += 4; return v; }
  /** UIntBase128 as google/woff2 reads it: no leading zero byte, at most five bytes, no overflow. */
  base128(what: string): number {
    let result = 0;
    for (let i = 0; i < 5; i++) {
      const code = this.u8(what);
      if (i === 0 && code === 0x80) throw malformed(`${what} has a leading zero`);
      if (result >= 0x2000000) throw malformed(`${what} overflows 32 bits`);
      result = result * 128 + (code & 0x7f);
      if ((code & 0x80) === 0) return result;
    }
    throw malformed(`${what} is longer than five bytes`);
  }
  /** A 255UInt16 (MicroType Express) value, with google/woff2's rules. */
  u255(what: string): number {
    const code = this.u8(what);
    if (code === 253) return this.u16(what);
    if (code === 255) return this.u8(what) + 253;
    if (code === 254) return this.u8(what) + 506;
    return code;
  }
}

/**
 * Read a WOFF2 file's header, table directory and collection directory, applying the
 * checks google/woff2's ReadWOFF2Header applies plus the memory limits above. Throws a
 * `Woff2Error` for anything the decoder would refuse or could not hold.
 */
export function preflightWoff2(bytes: Uint8Array, limits: Woff2Limits = WOFF2_LIMITS): Woff2Facts {
  const length = bytes.byteLength;
  if (length < 4 || bytes[0] !== 0x77 || bytes[1] !== 0x4f || bytes[2] !== 0x46 || bytes[3] !== 0x32) {
    throw new Woff2Error('not-woff2', 'This file is not a WOFF2 font.');
  }
  if (length > limits.maxInputBytes) {
    throw new Woff2Error('too-large', `This WOFF2 font is larger than ${sizeText(limits.maxInputBytes)}.`);
  }
  if (length < HEADER_BYTES) throw malformed('the header is incomplete');
  const view = new DataView(bytes.buffer, bytes.byteOffset, length);
  const r = new Reader(view);
  if (r.u32('the signature') !== WOFF2_SIGNATURE) throw new Woff2Error('not-woff2', 'This file is not a WOFF2 font.');
  const flavor = r.u32('the flavor');
  if (r.u32('the length field') !== length) throw malformed('the length field does not match the file');
  const numTables = r.u16('the table count');
  if (!numTables) throw malformed('it declares no tables');
  r.u16('the reserved field');
  const totalSfntSize = r.u32('totalSfntSize');
  const compressedLength = r.u32('the compressed length');
  r.u16('the major version');
  r.u16('the minor version');
  const metaOffset = r.u32('the metadata offset');
  const metaLength = r.u32('the metadata length');
  r.u32('the metadata original length');
  const privOffset = r.u32('the private data offset');
  const privLength = r.u32('the private data length');
  if (metaOffset && (metaOffset >= length || length - metaOffset < metaLength)) throw malformed('the metadata block lies outside the file');
  if (privOffset && (privOffset >= length || length - privOffset < privLength)) throw malformed('the private data block lies outside the file');

  // The table directory. Stored (transformed) lengths add up to the Brotli target.
  const kinds: Array<'glyf' | 'loca' | 'other'> = [];
  let uncompressedSize = 0;
  for (let i = 0; i < numTables; i++) {
    const flags = r.u8('a table entry');
    const known = flags & 0x3f;
    const tag = known === 0x3f ? r.u32('a table tag') : -1;
    const kind = (known === 0x3f ? tag === GLYF_TAG : known === GLYF_INDEX) ? 'glyf'
      : (known === 0x3f ? tag === LOCA_TAG : known === LOCA_INDEX) ? 'loca' : 'other';
    const version = (flags >> 6) & 3;
    const transformed = kind === 'other' ? version !== 0 : version === 0;
    let stored = r.base128('a table length');
    if (transformed) {
      stored = r.base128('a transformed table length');
      if (kind === 'loca' && stored) throw malformed('the transformed loca table has a length');
    }
    uncompressedSize += stored;
    if (uncompressedSize > 0xffffffff) throw malformed('the table lengths overflow');
    kinds.push(kind);
  }
  if (uncompressedSize < 1) throw malformed('the tables hold no data');

  let fonts = 1;
  let headerBytes = 12 + 16 * numTables;
  const collection = flavor === TTC_FLAVOR;
  if (collection) {
    const version = r.u32('the collection version');
    if (version !== 0x00010000 && version !== 0x00020000) throw malformed('the collection version is unknown');
    fonts = r.u255('the collection font count');
    if (!fonts) throw malformed('the collection holds no fonts');
    headerBytes = (version === 0x00020000 ? 12 : 0) + 12 + 4 * fonts + 12 * fonts;
    for (let f = 0; f < fonts; f++) {
      const count = r.u255('a collection table count');
      if (!count) throw malformed('a collection font holds no tables');
      r.u32('a collection font flavor');
      headerBytes += 16 * count;
      if (headerBytes > limits.maxOutputBytes) throw new Woff2Error('too-large', 'This WOFF2 collection declares more table records than the decoder can hold.');
      let glyf = 0;
      let loca = 0;
      for (let t = 0; t < count; t++) {
        const index = r.u255('a collection table index');
        if (index >= numTables) throw malformed('a collection font points at a missing table');
        if (kinds[index] === 'loca') loca = index;
        if (kinds[index] === 'glyf') glyf = index;
      }
      // google/woff2 requires loca right after glyf in each font (index 0 reads as none).
      if ((glyf > 0 || loca > 0) && (glyf > loca || loca - glyf !== 1)) throw malformed('a collection font has glyf and loca apart');
    }
  }

  // Memory: the decoder allocates the Brotli target and the header area before it
  // reads a byte of Brotli. Refuse what it could not hold rather than let it try.
  if (uncompressedSize > length * limits.maxRatio) throw new Woff2Error('too-large', 'This WOFF2 font declares more data than its size allows.');
  if (uncompressedSize > limits.maxOutputBytes || headerBytes > limits.maxOutputBytes) {
    throw new Woff2Error('too-large', `This WOFF2 font expands past ${sizeText(limits.maxOutputBytes)}.`);
  }

  // Layout: compressed data, then optional metadata, then optional private data, each
  // starting on a four-byte boundary, and nothing after.
  const compressedOffset = r.offset;
  let end = round4(compressedOffset + compressedLength);
  if (end > length) throw malformed('the compressed data runs past the end of the file');
  if (metaOffset) {
    if (end !== metaOffset) throw malformed('the metadata block is out of place');
    end = round4(metaOffset + metaLength);
  }
  if (privOffset) {
    if (end !== privOffset) throw malformed('the private data block is out of place');
    end = round4(privOffset + privLength);
  }
  if (end !== round4(length)) throw malformed('the file has bytes after its last block');

  return { flavor, collection, numTables, totalSfntSize, uncompressedSize, compressedOffset, compressedLength, headerBytes, fonts };
}

/** One sfnt offset table and its table records, all inside `bytes`. */
function checkOffsetTable(view: DataView, at: number, what: string): void {
  if (at + 12 > view.byteLength) throw new Woff2Error('bad-output', `The decoded ${what} has no complete header.`);
  if (!SFNT_FLAVORS.has(view.getUint32(at))) throw new Woff2Error('bad-output', `The decoded ${what} is not TrueType or OpenType.`);
  const count = view.getUint16(at + 4);
  if (at + 12 + 16 * count > view.byteLength) throw new Woff2Error('bad-output', `The decoded ${what} has an incomplete table directory.`);
  for (let i = 0; i < count; i++) {
    const record = at + 12 + 16 * i;
    const offset = view.getUint32(record + 8);
    const size = view.getUint32(record + 12);
    if (offset + size > view.byteLength) throw new Woff2Error('bad-output', `A table in the decoded ${what} lies outside the file.`);
  }
}

/**
 * Check decoder output before anyone parses it: no larger than `maxBytes`, and an sfnt
 * (or a collection of them) whose table records point inside the returned bytes.
 */
export function checkSfntOutput(bytes: Uint8Array, facts: Pick<Woff2Facts, 'collection'>, maxBytes: number = WOFF2_LIMITS.maxOutputBytes): void {
  if (bytes.byteLength > maxBytes) throw new Woff2Error('too-large', `The decoded font is larger than ${sizeText(maxBytes)}.`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (!facts.collection) { checkOffsetTable(view, 0, 'font'); return; }
  if (bytes.byteLength < 12 || view.getUint32(0) !== TTC_FLAVOR) throw new Woff2Error('bad-output', 'The decoded collection has no collection header.');
  const fonts = view.getUint32(8);
  if (12 + 4 * fonts > bytes.byteLength) throw new Woff2Error('bad-output', 'The decoded collection has an incomplete font list.');
  for (let i = 0; i < fonts; i++) checkOffsetTable(view, view.getUint32(12 + 4 * i), `collection font ${i + 1}`);
}

export interface DecodeWoff2Options {
  /** The caller's own limit on the decoded size, when tighter than 30 MiB. */
  maxOutputBytes?: number;
}

type Decompress = (bytes: Uint8Array) => Promise<Uint8Array | ArrayBuffer>;
let decoder: Promise<Decompress> | undefined;

/** WOFF2 bytes to sfnt bytes (or a TTC), checked before and after the decoder runs. */
export async function decodeWoff2(bytes: Uint8Array, options: DecodeWoff2Options = {}): Promise<Uint8Array> {
  const maxOutputBytes = Math.min(options.maxOutputBytes ?? WOFF2_LIMITS.maxOutputBytes, WOFF2_LIMITS.maxOutputBytes);
  const facts = preflightWoff2(bytes, { ...WOFF2_LIMITS, maxOutputBytes });
  // A failed chunk load is asked for again next time rather than remembered.
  decoder ??= import('woff2-encoder/decompress').then(
    (module) => module.default as Decompress,
    (error: unknown) => { decoder = undefined; throw error; },
  );
  let decoded: Uint8Array | ArrayBuffer;
  try {
    decoded = await (await decoder)(bytes);
  } catch (error) {
    throw new Woff2Error('decode-failed', 'This WOFF2 font could not be decoded.', { cause: error });
  }
  const out = decoded instanceof Uint8Array ? decoded : new Uint8Array(decoded);
  checkSfntOutput(out, facts, maxOutputBytes);
  return out;
}
