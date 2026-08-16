// SPDX-License-Identifier: MPL-2.0
/**
 * tar (USTAR / POSIX 1003.1-1988) writer. This is the container half of `.tar` and,
 * gzipped, `.tar.gz`. A tar is the simplest possible multi-file archive: a
 * 512-byte header block per member, its data padded up to a 512-byte boundary,
 * and two all-zero blocks to mark the end. It has no compression, no central directory,
 * and no seek table. Everything a consumer needs is inline. That is why it
 * is the right pair for gzip (gzip.ts) to make a streamable `.tar.gz`.
 *
 * We emit the USTAR variant (magic "ustar\0", version "00") so `tar`, libarchive,
 * bsdtar, GNU tar and every language stdlib read it unchanged. Output is deterministic:
 * mode 0644, uid/gid 0, mtime 0, no owner names. A given file list always
 * produces byte-identical output (no wall clock, no host identity leaked).
 *
 * --- The header checksum (POSIX: the one subtle field) ---
 * The 8-byte checksum field is computed as the unsigned sum of ALL 512 header
 * bytes WITH the checksum field itself taken as eight ASCII spaces (0x20). It is
 * then written as six octal digits, a NUL, and a space. This is the historically most
 * compatible of the several encodings tar implementations have used. Getting the
 * "spaces during computation" rule wrong is the classic tar bug, so it is done
 * explicitly below.
 *
 * --- Bounds / hostile-input posture ---
 * This is a WRITER, so the untrusted axis is the file list, not a parse. Names
 * are validated to fit USTAR's 100-byte `name` field (no PAX/GNU long-name
 * extension: a name that doesn't fit is rejected loudly rather than silently
 * truncated). Sizes are checked to fit the 11-octal-digit field (< 8 GiB, the
 * USTAR limit), and the total output length is computed up front so there is a
 * single allocation and no reallocating loop. DOM-free, no network/filesystem.
 */

/** One archive member: a POSIX path and its bytes. */
export interface TarFile {
  /** Member path, e.g. "logo.svg" or "brand/tokens.json". ASCII, <= 100 bytes. */
  name: string;
  /** File contents. */
  data: Uint8Array;
}

const BLOCK = 512;
const NAME_MAX = 100;          // USTAR `name` field width
const SIZE_MAX = 0o77777777777; // 11 octal 7s = 8 GiB - 1, the USTAR size limit

/** Round `n` up to the next multiple of 512 (the tar block size). */
function padTo512(n: number): number {
  return (n + BLOCK - 1) & ~(BLOCK - 1);
}

/**
 * Pack `files` into a USTAR archive. Deterministic and self-describing: header +
 * padded data per file, then two zero blocks. Throws on a name too long for the
 * 100-byte field or a file at/over the 8 GiB USTAR size limit. It never truncates.
 */
export function packTar(files: TarFile[]): Uint8Array {
  // Validate + size the whole archive before allocating (single allocation).
  const encoder = new TextEncoder();
  const nameBytesList: Uint8Array[] = [];
  let total = 0;
  for (const f of files) {
    const nameBytes = encoder.encode(f.name);
    if (nameBytes.length === 0) throw new Error('packTar: empty file name');
    if (nameBytes.length > NAME_MAX) {
      throw new Error(`packTar: name too long for USTAR (${nameBytes.length} > ${NAME_MAX} bytes): ${f.name}`);
    }
    if (f.data.length > SIZE_MAX) {
      throw new Error(`packTar: file exceeds USTAR 8 GiB size limit: ${f.name}`);
    }
    nameBytesList.push(nameBytes);
    total += BLOCK + padTo512(f.data.length);
  }
  total += 2 * BLOCK; // two trailing zero blocks

  const out = new Uint8Array(total);
  let off = 0;
  for (let i = 0; i < files.length; i++) {
    off = writeHeader(out, off, nameBytesList[i]!, files[i]!.data.length);
    out.set(files[i]!.data, off);
    off += padTo512(files[i]!.data.length);
  }
  // Final two blocks are already zero (out is zero-filled).
  return out;
}

/**
 * Write one 512-byte USTAR header at `off` and return the offset of the file
 * data that follows. `out` is zero-filled, so any field left blank is already
 * NUL-padded correctly.
 */
function writeHeader(out: Uint8Array, off: number, nameBytes: Uint8Array, size: number): number {
  const base = off;
  // name (0, 100): validated to fit by the caller.
  out.set(nameBytes, base);
  // mode (100, 8): "000644 \0". Octal 0644, ASCII, trailing space + NUL.
  writeOctal(out, base + 100, 8, 0o644);
  // uid (108, 8), gid (116, 8): 0.
  writeOctal(out, base + 108, 8, 0);
  writeOctal(out, base + 116, 8, 0);
  // size (124, 12): 11 octal digits + a space.
  writeOctal(out, base + 124, 12, size);
  // mtime (136, 12): 0 (deterministic).
  writeOctal(out, base + 136, 12, 0);
  // chksum (148, 8): filled with spaces now, real value written after summing.
  for (let i = 0; i < 8; i++) out[base + 148 + i] = 0x20;
  // typeflag (156, 1): '0' = regular file.
  out[base + 156] = 0x30;
  // linkname (157, 100): empty. magic (257, 6): "ustar\0". version (263, 2): "00".
  out[base + 257] = 0x75; // u
  out[base + 258] = 0x73; // s
  out[base + 259] = 0x74; // t
  out[base + 260] = 0x61; // a
  out[base + 261] = 0x72; // r
  out[base + 262] = 0x00; // NUL
  out[base + 263] = 0x30; // '0'
  out[base + 264] = 0x30; // '0'
  // uname/gname (265, 32)+(297, 32): empty. devmajor/minor (329,8)+(337,8): empty.

  // Checksum: unsigned sum of all 512 header bytes, chksum field counted as spaces.
  let sum = 0;
  for (let i = 0; i < BLOCK; i++) sum += out[base + i]!;
  // Historically portable encoding: 6 octal digits, NUL, space.
  writeChecksum(out, base + 148, sum);

  return base + BLOCK;
}

/**
 * Write `value` as a right-space-padded, zero-filled octal string into a
 * `width`-byte field: (width - 1) octal digits then a trailing space. Matches
 * GNU/BSD tar's numeric-field convention (e.g. mode "0000644 ").
 */
function writeOctal(out: Uint8Array, off: number, width: number, value: number): void {
  const digits = width - 1;
  // Division, not bit-shift: `size` can exceed 2^32 (JS bitwise is 32-bit),
  // and the 11-octal-digit size field spans the full USTAR 8 GiB range.
  let v = Math.floor(value);
  for (let i = digits - 1; i >= 0; i--) {
    out[off + i] = 0x30 + (v % 8);
    v = Math.floor(v / 8);
  }
  out[off + digits] = 0x20; // trailing space
}

/**
 * Write the checksum field: 6 octal digits, a NUL, then a space (the widely
 * accepted form). `off` points at the 8-byte chksum field.
 */
function writeChecksum(out: Uint8Array, off: number, sum: number): void {
  let v = sum >>> 0;
  for (let i = 5; i >= 0; i--) {
    out[off + i] = 0x30 + (v & 7);
    v >>>= 3;
  }
  out[off + 6] = 0x00; // NUL
  out[off + 7] = 0x20; // space
}
