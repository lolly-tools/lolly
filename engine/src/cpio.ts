// SPDX-License-Identifier: MPL-2.0
/**
 * cpio "newc" (SVR4 / `070701`) writer. This is the payload archive format an
 * RPM carries: `rpm.ts` gzips the output of this module and stores it as the
 * package payload. It is the close cousin of `tar.ts` - a header per member,
 * the data inline, a sentinel to close - but with newc's own header layout
 * instead of USTAR's.
 *
 * --- The newc member layout ---
 * Each member is a fixed 110-byte ASCII header of thirteen 8-hex-digit fields
 * (magic "070701", then ino, mode, uid, gid, nlink, mtime, filesize, dev
 * major/minor, rdev major/minor, namesize, check), immediately followed by the
 * NUL-terminated name and then the file data. Two paddings, each with NUL to the
 * next 4-byte boundary: once after (header + name), once after the data. The
 * archive ends with a member named "TRAILER!!!" of zero size. Unlike GNU cpio
 * we do NOT pad the whole stream to a 512-byte block - RPM payloads are an
 * unblocked newc stream, and libarchive/rpm read it unchanged.
 *
 * --- RPM's path convention ---
 * RPM stores each entry with a leading "." so an absolute install path becomes a
 * relative member ("./usr/share/fonts/acme/Acme.ttf"). That "." prefix is what
 * the `rpmlib(PayloadFilesHavePrefix)` feature declares; `rpm.ts` sets that
 * dependency and passes names already in this "./..." form. This module does not
 * impose it - it writes whatever name it is given - so it stays a general newc
 * writer, but callers building RPMs must supply the prefix.
 *
 * --- Determinism ---
 * Output is byte-identical for a given member list: inode numbers are assigned
 * sequentially from 1, mtime defaults to 0, uid/gid are 0, and there is no wall
 * clock or host identity. The caller supplies the full st_mode (type bits + perms)
 * per member, so a directory (S_IFDIR | 0755) and a regular file (S_IFREG | 0644)
 * are both expressible.
 *
 * --- Bounds / hostile-input posture ---
 * A WRITER: the untrusted axis is the member list. Each field is 8 hex digits, so
 * filesize and the other numeric fields must fit in 32 bits; a file at/over 4 GiB
 * is rejected loudly rather than silently wrapped. The total length is computed up
 * front for a single allocation. DOM-free, no network/filesystem.
 */

const MAGIC = '070701';
const HEADER = 110; // 6 (magic) + 13 * 8 (fields) = 110 bytes
const TRAILER_NAME = 'TRAILER!!!';
const U32_MAX = 0xffffffff;
const S_IFREG = 0o100000;

/** One cpio member: a stored path and its bytes, plus optional mode/mtime. */
export interface CpioFile {
  /** Stored member path. For an RPM payload, an install path with a leading ".",
   *  e.g. "./usr/share/fonts/acme/Acme.ttf". */
  name: string;
  /** File contents. Empty for a directory member. */
  data: Uint8Array;
  /** Full st_mode: type bits OR permission bits. Defaults to a regular file 0644
   *  (S_IFREG | 0o644). Pass S_IFDIR | 0o755 for a directory member. */
  mode?: number;
  /** Modification time (seconds). Defaults to 0 for reproducible output. */
  mtime?: number;
}

/** Round `n` up to the next multiple of 4 (newc pads header+name and data to 4). */
function pad4(n: number): number {
  return (n + 3) & ~3;
}

/** Write `value` as 8 uppercase hex digits, zero-padded, at `off`. */
function writeHex8(out: Uint8Array, off: number, value: number): void {
  const s = (value >>> 0).toString(16).toUpperCase().padStart(8, '0');
  for (let i = 0; i < 8; i++) out[off + i] = s.charCodeAt(i);
}

/**
 * Write one 110-byte newc header at `off`, then the NUL-terminated `nameBytes`,
 * then NUL padding up to a 4-byte boundary. Returns the offset where the file
 * data (or, for the trailer, the next member) begins.
 */
function writeHeader(
  out: Uint8Array,
  off: number,
  nameBytes: Uint8Array,
  ino: number,
  mode: number,
  mtime: number,
  filesize: number,
  nlink: number,
): number {
  const enc = new TextEncoder();
  out.set(enc.encode(MAGIC), off);
  const namesize = nameBytes.length + 1; // includes the trailing NUL
  writeHex8(out, off + 6, ino);
  writeHex8(out, off + 14, mode);
  writeHex8(out, off + 22, 0); // uid
  writeHex8(out, off + 30, 0); // gid
  writeHex8(out, off + 38, nlink);
  writeHex8(out, off + 46, mtime);
  writeHex8(out, off + 54, filesize);
  writeHex8(out, off + 62, 0); // devmajor
  writeHex8(out, off + 70, 0); // devminor
  writeHex8(out, off + 78, 0); // rdevmajor
  writeHex8(out, off + 86, 0); // rdevminor
  writeHex8(out, off + 94, namesize);
  writeHex8(out, off + 102, 0); // check (0 for newc "070701")
  out.set(nameBytes, off + HEADER); // name, then the NUL is already zero-filled
  return pad4(off + HEADER + namesize);
}

/**
 * Pack `files` into a newc cpio archive: a header + name + data per member (each
 * of header+name and data padded to 4 bytes), then a "TRAILER!!!" member. Inodes
 * are numbered 1..n; mode defaults to a 0644 regular file. Throws on an empty name
 * or a file at/over the 4 GiB newc field limit; never truncates.
 */
export function packCpio(files: CpioFile[]): Uint8Array {
  const encoder = new TextEncoder();
  const nameBytesList: Uint8Array[] = [];
  let total = 0;
  for (const f of files) {
    const nameBytes = encoder.encode(f.name);
    if (nameBytes.length === 0) throw new Error('packCpio: empty member name');
    if (f.data.length > U32_MAX) {
      throw new Error(`packCpio: file exceeds newc 4 GiB field limit: ${f.name}`);
    }
    nameBytesList.push(nameBytes);
    total += pad4(HEADER + nameBytes.length + 1) + pad4(f.data.length);
  }
  // Trailer member: name "TRAILER!!!", zero data.
  const trailerName = encoder.encode(TRAILER_NAME);
  total += pad4(HEADER + trailerName.length + 1);

  const out = new Uint8Array(total);
  let off = 0;
  for (let i = 0; i < files.length; i++) {
    const f = files[i]!;
    const mode = f.mode ?? (S_IFREG | 0o644);
    off = writeHeader(out, off, nameBytesList[i]!, i + 1, mode, f.mtime ?? 0, f.data.length, 1);
    out.set(f.data, off);
    off = pad4(off + f.data.length);
  }
  // Trailer: ino 0, mode 0, nlink 1, filesize 0 (GNU cpio's trailer shape).
  writeHeader(out, off, trailerName, 0, 0, 0, 0, 1);
  return out;
}
