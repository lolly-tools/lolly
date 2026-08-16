// SPDX-License-Identifier: MPL-2.0
/**
 * zip.ts - the shared PLAIN (unencrypted) zip primitive.
 *
 * The engine already had the pieces of a zip, but not the part that joins them:
 * `deflate.ts` emits raw DEFLATE, `gzip.ts` inflates it back (`inflateRaw`),
 * `zip-crypto.ts` owns CRC-32 and frames an *encrypted* archive, and both
 * `xlsx-import.ts` (read) and `epub.ts` (write) reach for `fflate` or roll their
 * own OOXML/OCF framing ad hoc. This module fills that gap: a dependency-free
 * `readZip` + `storeZip` over the engine's own primitives, so the archive-import,
 * epub-read, odt and docx/xlsx-write paths share ONE zip implementation instead
 * of each re-deriving the container.
 *
 * ── READ (readZip) ───────────────────────────────────────────────────────────
 * The authoritative index of a zip is its Central Directory, located from the
 * End-Of-Central-Directory record (EOCD, sig 0x06054b50) at the tail. The EOCD
 * may be followed by an arbitrary trailing comment, so we scan BACKWARD from the
 * end for the signature (bounded by the 65535-byte max comment). Each central
 * directory record (sig 0x02014b50) carries the reliable crc/sizes and a pointer
 * to the entry's local file header (sig 0x04034b50); we read the local header
 * only to skip its name+extra (whose lengths may differ from the central copy)
 * and reach the data. Method 8 → `inflateRaw` to the declared uncompressed size;
 * method 0 → a straight copy. The recovered bytes' CRC-32 is verified against the
 * directory (`crc32` from zip-crypto), so a corrupt or truncated member fails
 * loudly. Directory entries (names ending '/') are skipped.
 *
 * We deliberately trust the CENTRAL directory's crc/sizes, never the local
 * header's - a streamed zip writes zeros there and appends a data descriptor
 * (GPBF bit 3). Reading sizes from the directory sidesteps data-descriptor
 * parsing entirely and matches what every real unzip does.
 *
 * ── WRITE (storeZip) ─────────────────────────────────────────────────────────
 * Local headers + data + central directory + EOCD, deterministic (fixed DOS
 * date, no data descriptors, real crc/sizes in every header). Each entry is
 * DEFLATEd unless STORED is at least as small - so incompressible bytes never
 * expand - with one exception: `opts.mimetypeFirst` forces the first entry named
 * exactly `mimetype` to be STORED and written first, the OCF magic every EPUB/ODT
 * reader sniffs before it trusts the container.
 *
 * ── SCOPE ────────────────────────────────────────────────────────────────────
 * 32-bit sizes/offsets only - a ZIP64 archive (>4 GiB, or the 0xffffffff sentinel
 * fields) is refused with a clear Error rather than silently misread. Methods
 * other than STORED/DEFLATE are refused. Pure math + typed arrays; DOM-free,
 * dependency-free beyond the named engine primitives.
 */

import { concatBytes } from './bytes.ts';
import { deflateRaw, type DeflateOptions } from './deflate.ts';
import { inflateRaw } from './gzip.ts';
import { crc32 } from './zip-crypto.ts';

// ── Signatures (little-endian uint32) ────────────────────────────────────────
const SIG_LOCAL = 0x04034b50; // "PK\x03\x04" local file header
const SIG_CENTRAL = 0x02014b50; // "PK\x01\x02" central directory file header
const SIG_EOCD = 0x06054b50; // "PK\x05\x06" end of central directory

const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;

/** ZIP64 sentinel - a field this value means "read the real value from a ZIP64 record". */
const U32_MAX = 0xffffffff;
const U16_MAX = 0xffff;

/** DOS date for 1980-01-01 (the epoch of the zip DOS date format); time 0. Fixed → deterministic. */
const DOS_DATE_1980 = 0x0021;

/** General-purpose bit 11: filename/comment are UTF-8 (APPNOTE section 4.4.4). */
const GPBF_UTF8 = 0x0800;

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8');

/** One recovered archive member. */
export interface ZipEntry {
  /** UTF-8 path within the archive (directory entries are omitted). */
  name: string;
  /** The member's decompressed bytes. */
  bytes: Uint8Array;
}

/** One entry to write; `bytes` is the ORIGINAL (uncompressed) content. */
export interface ZipStoreEntry {
  name: string;
  bytes: Uint8Array;
}

/** Options for {@link storeZip}. */
export interface StoreZipOptions extends DeflateOptions {
  /**
   * OCF mode (EPUB/ODT): the first entry named exactly `mimetype` is written
   * FIRST and STORED uncompressed, with no extra fields - the container magic a
   * reader sniffs before trusting the archive.
   */
  mimetypeFirst?: boolean;
}

// ── little-endian reads (bounds-checked at the call sites that matter) ────────
function u16(b: Uint8Array, o: number): number {
  return (b[o]! | (b[o + 1]! << 8)) >>> 0;
}
function u32(b: Uint8Array, o: number): number {
  return (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24)) >>> 0;
}

/**
 * Read every file member of a plain zip.
 *
 * @param bytes the whole archive.
 * @returns one `{ name, bytes }` per file entry, in central-directory order;
 *          directory entries (names ending `/`) are skipped.
 * @throws on a missing/invalid EOCD, a ZIP64 archive, an unsupported compression
 *         method, a truncated member, or a CRC-32 mismatch.
 */
export function readZip(bytes: Uint8Array): ZipEntry[] {
  if (!(bytes instanceof Uint8Array)) throw new Error('readZip: expected a Uint8Array');
  if (bytes.length < 22) throw new Error('readZip: too short to be a zip archive');

  const eocd = findEocd(bytes);

  const diskCdCount = u16(bytes, eocd + 8);
  const totalCdCount = u16(bytes, eocd + 10);
  const cdSize = u32(bytes, eocd + 12);
  const cdOffset = u32(bytes, eocd + 16);

  // ZIP64: any sentinel field means the real value lives in a ZIP64 record we
  // do not parse. Refuse rather than misread a truncated 32-bit view.
  if (
    totalCdCount === U16_MAX ||
    diskCdCount === U16_MAX ||
    cdSize === U32_MAX ||
    cdOffset === U32_MAX
  ) {
    throw new Error('readZip: ZIP64 archives are not supported');
  }
  if (cdOffset + cdSize > bytes.length) throw new Error('readZip: central directory runs past end of file');

  const entries: ZipEntry[] = [];
  let p = cdOffset;
  for (let i = 0; i < totalCdCount; i++) {
    if (p + 46 > bytes.length) throw new Error('readZip: truncated central directory');
    if (u32(bytes, p) !== SIG_CENTRAL) throw new Error('readZip: bad central directory signature');

    const method = u16(bytes, p + 10);
    const crc = u32(bytes, p + 16);
    const compSize = u32(bytes, p + 20);
    const uncompSize = u32(bytes, p + 24);
    const nameLen = u16(bytes, p + 28);
    const extraLen = u16(bytes, p + 30);
    const commentLen = u16(bytes, p + 32);
    const localOffset = u32(bytes, p + 42);

    if (compSize === U32_MAX || uncompSize === U32_MAX || localOffset === U32_MAX) {
      throw new Error('readZip: ZIP64 entry is not supported');
    }

    const nameStart = p + 46;
    if (nameStart + nameLen > bytes.length) throw new Error('readZip: truncated central directory name');
    const name = decoder.decode(bytes.subarray(nameStart, nameStart + nameLen));

    p = nameStart + nameLen + extraLen + commentLen;

    // Skip directory entries - nothing to extract.
    if (name.endsWith('/')) continue;

    // Walk the LOCAL header to find where the data actually begins; its name/extra
    // lengths can differ from the central copy, so we must read them here.
    if (localOffset + 30 > bytes.length) throw new Error(`readZip: local header out of range for "${name}"`);
    if (u32(bytes, localOffset) !== SIG_LOCAL) throw new Error(`readZip: bad local header signature for "${name}"`);
    const localNameLen = u16(bytes, localOffset + 26);
    const localExtraLen = u16(bytes, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    if (dataStart + compSize > bytes.length) throw new Error(`readZip: truncated data for "${name}"`);

    const stored = bytes.subarray(dataStart, dataStart + compSize);
    let out: Uint8Array;
    if (method === METHOD_STORED) {
      out = stored.slice(); // detach from the parent buffer
    } else if (method === METHOD_DEFLATE) {
      out = inflateRaw(stored, uncompSize);
    } else {
      throw new Error(`readZip: unsupported compression method ${method} for "${name}"`);
    }

    if (out.length !== uncompSize) {
      throw new Error(`readZip: size mismatch for "${name}" (header ${uncompSize}, got ${out.length})`);
    }
    if (crc32(out) !== crc) throw new Error(`readZip: CRC-32 mismatch for "${name}" (corrupt archive)`);

    entries.push({ name, bytes: out });
  }

  return entries;
}

/** Scan backward from the tail for the EOCD signature, tolerating a trailing comment. */
function findEocd(bytes: Uint8Array): number {
  // The comment length field is 16-bit, so the EOCD begins at most 65535+22 bytes
  // from the end. Start at the last position a 22-byte EOCD could occupy.
  const minStart = Math.max(0, bytes.length - 22 - 0xffff);
  for (let i = bytes.length - 22; i >= minStart; i--) {
    if (u32(bytes, i) === SIG_EOCD) {
      // Validate the comment length reaches exactly the end (guards a false match
      // on payload bytes that happen to spell the signature).
      const commentLen = u16(bytes, i + 20);
      if (i + 22 + commentLen === bytes.length) return i;
    }
  }
  throw new Error('readZip: end-of-central-directory record not found (not a zip archive)');
}

interface Framed {
  name: Uint8Array;
  method: number;
  crc: number;
  compSize: number;
  uncompSize: number;
  data: Uint8Array;
}

/**
 * Write a plain (unencrypted) zip.
 *
 * Each entry is DEFLATEd unless STORED is at least as small. When
 * `opts.mimetypeFirst`, the first entry named exactly `mimetype` is moved to the
 * front and STORED uncompressed (OCF requirement for EPUB/ODT).
 *
 * @throws if two entries share a name, or a name is empty.
 */
export function storeZip(entries: ZipStoreEntry[], opts: StoreZipOptions = {}): Uint8Array {
  const ordered = orderEntries(entries, opts.mimetypeFirst === true);

  const seen = new Set<string>();
  const framed: Framed[] = [];
  for (const e of ordered) {
    if (!e.entry.name) throw new Error('storeZip: entry name must not be empty');
    if (seen.has(e.entry.name)) throw new Error(`storeZip: duplicate entry name "${e.entry.name}"`);
    seen.add(e.entry.name);

    const src = e.entry.bytes;
    const crc = crc32(src);
    let method = METHOD_STORED;
    let data = src;
    if (!e.forceStored) {
      const deflated = deflateRaw(src, opts);
      // STORED wins ties: no expansion, and one fewer thing for a reader to do.
      if (deflated.length < src.length) {
        method = METHOD_DEFLATE;
        data = deflated;
      }
    }
    framed.push({
      name: encoder.encode(e.entry.name),
      method,
      crc,
      compSize: data.length,
      uncompSize: src.length,
      data,
    });
  }

  // Local records; track each entry's local-header offset for the central dir.
  const locals: Uint8Array[] = [];
  const offsets: number[] = [];
  let offset = 0;
  for (const f of framed) {
    const lfh = new Uint8Array(30 + f.name.length);
    const dv = new DataView(lfh.buffer);
    dv.setUint32(0, SIG_LOCAL, true);
    dv.setUint16(4, 20, true); // version needed
    dv.setUint16(6, GPBF_UTF8, true); // general-purpose flags (UTF-8 names)
    dv.setUint16(8, f.method, true);
    dv.setUint16(10, 0, true); // mod time
    dv.setUint16(12, DOS_DATE_1980, true); // mod date
    dv.setUint32(14, f.crc, true);
    dv.setUint32(18, f.compSize, true);
    dv.setUint32(22, f.uncompSize, true);
    dv.setUint16(26, f.name.length, true);
    dv.setUint16(28, 0, true); // extra length
    lfh.set(f.name, 30);
    offsets.push(offset);
    locals.push(lfh, f.data);
    offset += lfh.length + f.data.length;
  }
  const localBlob = concatBytes(locals);

  // Central directory.
  const centrals: Uint8Array[] = [];
  for (let i = 0; i < framed.length; i++) {
    const f = framed[i]!;
    const cdr = new Uint8Array(46 + f.name.length);
    const dv = new DataView(cdr.buffer);
    dv.setUint32(0, SIG_CENTRAL, true);
    dv.setUint16(4, 20, true); // version made by
    dv.setUint16(6, 20, true); // version needed
    dv.setUint16(8, GPBF_UTF8, true); // general-purpose flags
    dv.setUint16(10, f.method, true);
    dv.setUint16(12, 0, true); // mod time
    dv.setUint16(14, DOS_DATE_1980, true); // mod date
    dv.setUint32(16, f.crc, true);
    dv.setUint32(20, f.compSize, true);
    dv.setUint32(24, f.uncompSize, true);
    dv.setUint16(28, f.name.length, true);
    dv.setUint16(30, 0, true); // extra length
    dv.setUint16(32, 0, true); // comment length
    dv.setUint16(34, 0, true); // disk number start
    dv.setUint16(36, 0, true); // internal attrs
    dv.setUint32(38, 0, true); // external attrs
    dv.setUint32(42, offsets[i]!, true);
    cdr.set(f.name, 46);
    centrals.push(cdr);
  }
  const centralBlob = concatBytes(centrals);

  // End of central directory.
  const eocd = new Uint8Array(22);
  const edv = new DataView(eocd.buffer);
  edv.setUint32(0, SIG_EOCD, true);
  edv.setUint16(8, framed.length, true); // records on this disk
  edv.setUint16(10, framed.length, true); // total records
  edv.setUint32(12, centralBlob.length, true);
  edv.setUint32(16, localBlob.length, true); // central dir offset = size of local section

  return concatBytes([localBlob, centralBlob, eocd]);
}

/**
 * Produce the write order. Without `mimetypeFirst` the input order is preserved.
 * With it, the first `mimetype` entry is hoisted to the front and flagged
 * `forceStored`; all other entries keep their relative order.
 */
function orderEntries(
  entries: ZipStoreEntry[],
  mimetypeFirst: boolean,
): { entry: ZipStoreEntry; forceStored: boolean }[] {
  if (!mimetypeFirst) return entries.map((entry) => ({ entry, forceStored: false }));
  const idx = entries.findIndex((e) => e.name === 'mimetype');
  if (idx < 0) return entries.map((entry) => ({ entry, forceStored: false }));
  const rest = entries.filter((_, i) => i !== idx);
  return [
    { entry: entries[idx]!, forceStored: true },
    ...rest.map((entry) => ({ entry, forceStored: false })),
  ];
}
