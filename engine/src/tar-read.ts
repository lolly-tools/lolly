// SPDX-License-Identifier: MPL-2.0
/**
 * tar (USTAR / POSIX 1003.1-1988) reader. This is the import half of tar.ts's
 * writer, so `.tar` (and, gunzipped, `.tar.gz`) becomes round-trip. A tar is a
 * flat run of 512-byte header blocks, each followed by its data padded up to a
 * 512-byte boundary, terminated by two all-zero blocks. There is no central
 * directory and no seek table; everything is inline, so the read is a single
 * forward scan.
 *
 * This reader accepts the USTAR variant tar.ts emits (magic "ustar\0", version
 * "00") and, being lenient on the read side, also pre-POSIX/v7 archives that
 * omit the magic. Only regular-file members are returned; directory, symlink/
 * hardlink, and the PAX/GNU metadata entries are recognised and skipped (their
 * data blocks are still consumed so the scan stays aligned), never surfaced as
 * files.
 *
 * The header checksum (POSIX: the one subtle field).
 * A block is validated by re-deriving its checksum: the unsigned sum of all 512
 * header bytes with the 8-byte chksum field itself taken as ASCII spaces (0x20),
 * compared to the octal value stored in that field. Historic tars wrote the sum
 * as signed (treating bytes as int8), so this reader accepts either the unsigned
 * or the signed total. A header whose checksum matches neither is rejected loudly;
 * the scan does not silently resync past corruption.
 *
 * Bounds and hostile-input posture.
 * This is a parser of untrusted bytes, so every field read is bounds-checked
 * before deref and every advance is validated against the buffer length: a header
 * that would run off the end, a declared size that overruns the remaining bytes,
 * or a size past the USTAR 8 GiB limit all throw rather than over-read or
 * over-allocate. The end is reached at the first all-zero block (the POSIX
 * two-zero-block trailer, or simply running out of input). DOM-free, no
 * network/filesystem.
 */

import type { TarFile } from './tar.ts';
import { gunzip } from './gzip.ts';

const BLOCK = 512;
const SIZE_MAX = 0o77777777777; // 11 octal 7s = 8 GiB - 1, the USTAR size limit

// USTAR header field offsets (bytes from the start of a 512-byte header block).
const OFF_NAME = 0;
const NAME_LEN = 100;
const OFF_SIZE = 124;
const SIZE_LEN = 12;
const OFF_CHKSUM = 148;
const CHKSUM_LEN = 8;
const OFF_TYPEFLAG = 156;
const OFF_MAGIC = 257;
const OFF_PREFIX = 345;
const PREFIX_LEN = 155;

/**
 * Parse a USTAR archive into its regular-file members, in archive order. Names
 * are reconstructed from the `prefix` + `name` fields; directory, link and
 * PAX/GNU metadata entries are skipped. Throws on a truncated header, a size that
 * overruns the buffer or exceeds the USTAR 8 GiB limit, or a header whose
 * checksum matches neither the unsigned nor the signed sum.
 */
export function readTar(bytes: Uint8Array): TarFile[] {
  const files: TarFile[] = [];
  const total = bytes.length;
  let off = 0;

  while (off + BLOCK <= total) {
    // Two all-zero blocks mark the end; in practice the first all-zero header
    // (name and checksum blank) is enough to stop. Trailing bytes are padding.
    if (isZeroBlock(bytes, off)) break;

    if (!checksumOk(bytes, off)) {
      throw new Error(`readTar: header checksum mismatch at offset ${off}`);
    }

    const size = parseOctal(bytes, off + OFF_SIZE, SIZE_LEN);
    if (size > SIZE_MAX) {
      throw new Error(`readTar: member size ${size} exceeds USTAR 8 GiB limit at offset ${off}`);
    }
    const dataOff = off + BLOCK;
    const dataEnd = dataOff + size;
    if (dataEnd > total) {
      throw new Error(`readTar: member data (size ${size}) overruns the archive at offset ${off}`);
    }

    const typeflag = bytes[off + OFF_TYPEFLAG]!;
    // '0' (0x30) or NUL (0x00) = regular file. Everything else (directory ('5'),
    // links ('1'/'2'), char/block/fifo, PAX ('x'/'g'), GNU long name ('L'/'K'),
    // etc.) is skipped, but its data blocks are still consumed below.
    if (typeflag === 0x30 || typeflag === 0x00) {
      const name = readName(bytes, off);
      // A name-less regular entry is not a usable member; skip defensively.
      if (name.length > 0) {
        files.push({ name, data: bytes.slice(dataOff, dataEnd) });
      }
    }

    off = dataOff + padTo512(size);
  }

  return files;
}

/**
 * Convenience for `.tar.gz`: {@link gunzip} the outer gzip member, then
 * {@link readTar} the recovered tar. The caller can equally gunzip themselves and
 * call `readTar`; this is the one-call path for the common case.
 */
export function readTarGz(bytes: Uint8Array): TarFile[] {
  return readTar(gunzip(bytes));
}

/** Round `n` up to the next multiple of 512 (the tar block size). */
function padTo512(n: number): number {
  return (n + BLOCK - 1) & ~(BLOCK - 1);
}

/** True if the 512-byte block at `off` is entirely zero (the end-of-archive marker). */
function isZeroBlock(bytes: Uint8Array, off: number): boolean {
  for (let i = 0; i < BLOCK; i++) {
    if (bytes[off + i] !== 0) return false;
  }
  return true;
}

/**
 * Reconstruct a member path from the `prefix` (155) and `name` (100) fields:
 * USTAR splits a long path as `prefix + '/' + name`. Each field is NUL-terminated
 * within its width; an empty prefix yields just the name.
 */
function readName(bytes: Uint8Array, off: number): string {
  const name = readCString(bytes, off + OFF_NAME, NAME_LEN);
  const prefix = readCString(bytes, off + OFF_PREFIX, PREFIX_LEN);
  return prefix.length > 0 ? `${prefix}/${name}` : name;
}

/** Decode a NUL-terminated (or field-filling) ASCII/UTF-8 string of at most `len` bytes. */
function readCString(bytes: Uint8Array, off: number, len: number): string {
  let end = off;
  const limit = off + len;
  while (end < limit && bytes[end] !== 0) end++;
  return new TextDecoder().decode(bytes.subarray(off, end));
}

/**
 * Parse a tar numeric field: leading spaces/NULs, octal digits, then a trailing
 * space or NUL. Ignores GNU base-256 by design: the writer half never emits it,
 * and an out-of-range size is refused by the caller's limit check anyway. A blank
 * field reads as 0.
 */
function parseOctal(bytes: Uint8Array, off: number, len: number): number {
  let i = off;
  const limit = off + len;
  // Skip leading whitespace / NUL padding.
  while (i < limit && (bytes[i] === 0x20 || bytes[i] === 0x00)) i++;
  let value = 0;
  for (; i < limit; i++) {
    const c = bytes[i]!;
    if (c === 0x20 || c === 0x00) break; // trailing space/NUL ends the number
    if (c < 0x30 || c > 0x37) {
      throw new Error(`readTar: non-octal digit ${c} in numeric field at offset ${off}`);
    }
    value = value * 8 + (c - 0x30);
  }
  return value;
}

/**
 * Verify the header at `off`: sum all 512 bytes with the chksum field counted as
 * spaces, and compare to the stored octal value. Accepts the historically
 * signed-byte sum as well, so pre-POSIX archives read too. A field that isn't a
 * valid octal number (e.g. mid-corruption) counts as a mismatch, not a throw.
 */
function checksumOk(bytes: Uint8Array, off: number): boolean {
  let stored: number;
  try {
    stored = parseOctal(bytes, off + OFF_CHKSUM, CHKSUM_LEN);
  } catch {
    return false;
  }
  let unsigned = 0;
  let signed = 0;
  for (let i = 0; i < BLOCK; i++) {
    // The chksum field itself is treated as eight spaces during the sum.
    const inChksum = i >= OFF_CHKSUM && i < OFF_CHKSUM + CHKSUM_LEN;
    const b = inChksum ? 0x20 : bytes[off + i]!;
    unsigned += b;
    signed += b < 128 ? b : b - 256; // int8 interpretation
  }
  return stored === unsigned || stored === signed;
}
