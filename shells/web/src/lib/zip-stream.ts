// SPDX-License-Identifier: MPL-2.0
/**
 * A ZIP written a part at a time into a Blob (plan 203 R4).
 *
 * `zipAsync` (lib/zip.ts) needs every part in memory and then builds the whole
 * archive in a second buffer, which the caller copies a third time into a Blob. A
 * backup of a large library therefore needed about three times its size in memory
 * at the end. `ZipStream` keeps the parts where they already are instead:
 *
 * - A stored part that is a Blob (an upload, a saved result) is read once, in
 *   bounded chunks, for its CRC-32 and SHA-256, and the archive Blob refers to
 *   that Blob rather than copying the bytes. They are never re-encoded, so a file carrying
 *   Content Credentials keeps the exact bytes its signature covers.
 * - A part written in chunks (a large JSON file) is checksummed and deflated as the
 *   chunks arrive.
 * - Headers and small parts are gathered and turned into Blobs every few
 *   mebibytes, which lets the browser move them out of script memory.
 *
 * The container is exactly what fflate's `zipSync` and `zipAsync` write for the
 * same parts, levels and modification time: the same headers, flags and
 * order, real sizes and checksums in every local header, no data descriptors. Parts
 * deflated in one call (everything given as bytes, and a part written in chunks
 * that stays under ONE_SHOT_DEFLATE_MAX) are compressed with the same fflate call
 * too. Only a larger chunked part is compressed in pieces, which lays out its
 * compressed stream differently; the part's own bytes, its checksum and its
 * integrity digest are unchanged. tests/backup-streaming.test.ts holds both claims
 * against the in-memory writer.
 *
 * Kept apart from lib/zip.ts, which many modules import for unzip, so the
 * writer and its hashing load only when something is exported.
 */
import { Deflate, deflate, deflateSync, strToU8 } from 'fflate';
import { Crc32, Sha256, hashBlob, sha256Of } from './stream-hash.ts';
import { bytesToBase64 } from './util/bytes.ts';
import type { BundleArchive, BundleStats, PartWriter } from './bundle.ts';

const HAS_WORKER = typeof Worker !== 'undefined';

/** A chunked part up to this size is deflated in one call, exactly as zipAsync would. */
export const ONE_SHOT_DEFLATE_MAX = 16 * 1024 * 1024;
/** Gathered bytes become a Blob once there are this many. */
const FLUSH_BYTES = 4 * 1024 * 1024;
/** Below this size fflate's zipAsync deflates on the calling thread, and above, in its worker. */
const WORKER_DEFLATE_MIN = 160_000;
const U32_MAX = 0xffffffff;
const MAX_MEMBERS = 0xffff;

interface Member { name: Uint8Array; utf8: boolean; method: 0 | 8; crc: number; compressed: number; size: number; offset: number }

/** The DOS date and time fflate writes for a modification time (local time, two-second steps). */
function dosTime(mtime: number | Date): number {
  const d = new Date(mtime);
  const year = d.getFullYear() - 1980;
  if (year < 0 || year > 119) throw new Error('A ZIP file can only record dates from 1980 to 2099.');
  return ((year << 25) | ((d.getMonth() + 1) << 21) | (d.getDate() << 16) | (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) >>> 0;
}

/** fflate's local header: version 20, and the UTF-8 flag only for a name that needs the flag. */
function localHeader(m: Member, time: number): Uint8Array {
  const h = new Uint8Array(30 + m.name.length), v = new DataView(h.buffer);
  v.setUint32(0, 0x04034b50, true);
  h[4] = 20;
  h[7] = m.utf8 ? 8 : 0;
  h[8] = m.method;
  v.setUint32(10, time, true);
  v.setUint32(14, m.crc, true);
  v.setUint32(18, m.compressed, true);
  v.setUint32(22, m.size, true);
  v.setUint16(26, m.name.length, true);
  h.set(m.name, 30);
  return h;
}

function centralHeader(m: Member, time: number): Uint8Array {
  const h = new Uint8Array(46 + m.name.length), v = new DataView(h.buffer);
  v.setUint32(0, 0x02014b50, true);
  h[4] = 20;
  h[6] = 20;
  h[9] = m.utf8 ? 8 : 0;
  h[10] = m.method;
  v.setUint32(12, time, true);
  v.setUint32(16, m.crc, true);
  v.setUint32(20, m.compressed, true);
  v.setUint32(24, m.size, true);
  v.setUint16(28, m.name.length, true);
  v.setUint32(42, m.offset, true);
  h.set(m.name, 46);
  return h;
}

/** Deflate in one call: fflate's worker for a large part where there is one, as zipAsync does. */
function deflateWhole(bytes: Uint8Array): Promise<Uint8Array> {
  if (!HAS_WORKER || bytes.length < WORKER_DEFLATE_MIN) return Promise.resolve(deflateSync(bytes));
  return new Promise((resolve, reject) => { deflate(bytes, {}, (err, data) => (err ? reject(err) : resolve(data))); });
}

function concat(chunks: readonly Uint8Array[], size: number): Uint8Array {
  if (chunks.length === 1) return chunks[0]!;
  const out = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) { out.set(chunk, at); at += chunk.length; }
  return out;
}

/** Bytes gathered in order and turned into Blobs every FLUSH_BYTES. */
class Spill {
  readonly parts: Blob[] = [];
  #held: Uint8Array[] = [];
  #heldBytes = 0;
  bytes = 0;
  add(chunk: Uint8Array | Blob): void {
    if (chunk instanceof Blob) {
      this.#flush();
      this.parts.push(chunk);
      this.bytes += chunk.size;
      return;
    }
    if (!chunk.length) return;
    this.#held.push(chunk); this.#heldBytes += chunk.length; this.bytes += chunk.length;
    if (this.#heldBytes >= FLUSH_BYTES) this.#flush();
  }
  /** Everything added, in order. */
  drain(): Blob[] { this.#flush(); return this.parts; }
  #flush(): void {
    if (!this.#held.length) return;
    this.parts.push(new Blob(this.#held as BlobPart[]));
    this.#held = []; this.#heldBytes = 0;
  }
}

export interface ZipStreamOptions {
  /** The modification time every entry records; now, by default. */
  mtime?: number | Date;
  /** Keep an SRI-style SHA-256 of every part (see `integrity()`). */
  integrity?: boolean;
}

/**
 * The streamed writer. Parts go in one at a time, in the order they should appear;
 * `finish()` returns the archive as a Blob. A failed part throws and the archive
 * should be dropped.
 */
export class ZipStream {
  readonly #time: number;
  readonly #hash: boolean;
  readonly #out = new Spill();
  readonly #members: Member[] = [];
  readonly #names = new Set<string>();
  readonly #digests: Record<string, string> = {};
  #busy = false;
  #finished = false;
  readonly stats: BundleStats = { total: 0, largest: { name: '', bytes: 0 } };

  constructor(options: ZipStreamOptions = {}) {
    this.#time = dosTime(options.mtime ?? Date.now());
    this.#hash = options.integrity === true;
  }

  /** A part already in memory: deflated in one call, or kept as it is when `stored`. */
  async bytes(name: string, data: Uint8Array, stored = false): Promise<void> {
    const encoded = this.#begin(name);
    try {
      const crc = new Crc32().update(data).value();
      const digest = this.#hash ? await sha256Of(data) : null;
      const body = stored ? data : await deflateWhole(data);
      this.#commit(name, encoded, stored ? 0 : 8, crc, data.length, [body], body.length, digest);
    } finally { this.#busy = false; }
  }

  /** A stored part whose bytes stay in a Blob: read once in chunks, then referenced. */
  async blob(name: string, blob: Blob): Promise<void> {
    const encoded = this.#begin(name);
    try {
      const { crc, sha256 } = await hashBlob(blob, this.#hash);
      this.#commit(name, encoded, 0, crc, blob.size, [blob], blob.size, sha256);
    } finally { this.#busy = false; }
  }

  /** A deflated part written in chunks. Close or abort it before adding the next part. */
  open(name: string): PartWriter {
    const encoded = this.#begin(name);
    const crc = new Crc32();
    const sha = this.#hash ? new Sha256() : null;
    const compressed = new Spill();
    let held: Uint8Array[] | null = [];
    let deflater: Deflate | null = null;
    let size = 0;
    let yielded = 0;
    let state: 'open' | 'closed' | 'aborted' = 'open';
    const assertOpen = (): void => { if (state !== 'open') throw new Error(`The archive part ${name} is already ${state}.`); };
    const stream = (): Deflate => new Deflate({}, chunk => compressed.add(chunk));
    return {
      get bytes() { return size; },
      write: async chunk => {
        assertOpen();
        crc.update(chunk); sha?.update(chunk); size += chunk.length;
        if (held) {
          held.push(chunk);
          if (size <= ONE_SHOT_DEFLATE_MAX) return;
          // Past the one-call size: from here on the part is deflated as it arrives.
          deflater = stream();
          for (const piece of held) deflater.push(piece);
          held = null;
        } else deflater!.push(chunk);
        // Give the page a turn every few mebibytes of a long part.
        if (size - yielded < FLUSH_BYTES) return;
        yielded = size;
        await new Promise<void>(resolve => setTimeout(resolve, 0));
      },
      close: async () => {
        assertOpen();
        state = 'closed';
        try {
          if (held) compressed.add(await deflateWhole(concat(held, size)));
          else deflater!.push(new Uint8Array(0), true);
          held = null;
          const parts = compressed.drain();
          this.#commit(name, encoded, 8, crc.value(), size, parts, compressed.bytes, sha ? sha.digest() : null);
        } finally { this.#busy = false; }
      },
      abort: () => {
        if (state !== 'open') return;
        state = 'aborted'; held = null; deflater = null;
        this.#names.delete(name);
        this.#busy = false;
      },
    };
  }

  /** SRI digests (`sha256-<base64>`) of the parts so far, in the order they went in. */
  integrity(): Record<string, string> {
    if (!this.#hash) throw new Error('This archive was not asked to keep digests.');
    return { ...this.#digests };
  }

  finish(type = 'application/zip'): Blob {
    if (this.#busy) throw new Error('An archive part is still open.');
    if (this.#finished) throw new Error('This archive is already finished.');
    this.#finished = true;
    const centrals = this.#members.map(m => centralHeader(m, this.#time));
    const centralBytes = centrals.reduce((n, c) => n + c.length, 0);
    const offset = this.#out.bytes;
    if (offset + centralBytes + 22 > U32_MAX) throw new Error('This archive is larger than a ZIP file without ZIP64 can hold (4 GiB).');
    const end = new Uint8Array(22), v = new DataView(end.buffer);
    v.setUint32(0, 0x06054b50, true);
    v.setUint16(8, this.#members.length, true);
    v.setUint16(10, this.#members.length, true);
    v.setUint32(12, centralBytes, true);
    v.setUint32(16, offset, true);
    return new Blob([...this.#out.drain(), ...centrals, end] as BlobPart[], { type });
  }

  #begin(name: string): Uint8Array {
    if (this.#finished) throw new Error('This archive is already finished.');
    if (this.#busy) throw new Error('Add archive parts one at a time.');
    if (this.#names.has(name)) throw new Error(`The archive already has a part named ${name}.`);
    if (this.#members.length >= MAX_MEMBERS - 1) throw new Error('This archive has too many parts.');
    const encoded = strToU8(name);
    if (!name || encoded.length > 0xffff) throw new Error('An archive part name must be 1 to 65535 bytes.');
    this.#busy = true;
    this.#names.add(name);
    return encoded;
  }

  #commit(name: string, encoded: Uint8Array, method: 0 | 8, crc: number, size: number, body: Array<Uint8Array | Blob>, compressed: number, digest: Uint8Array | null): void {
    const offset = this.#out.bytes;
    const member: Member = { name: encoded, utf8: encoded.length !== name.length, method, crc, compressed, size, offset };
    const header = localHeader(member, this.#time);
    if (offset + header.length + compressed > U32_MAX) throw new Error('This archive is larger than a ZIP file without ZIP64 can hold (4 GiB).');
    this.#out.add(header);
    for (const part of body) this.#out.add(part);
    this.#members.push(member);
    if (digest) this.#digests[name] = `sha256-${bytesToBase64(digest)}`;
    this.stats.total += size;
    if (size > this.stats.largest.bytes) this.stats.largest = { name, bytes: size };
  }
}

/**
 * The archive exportBackup writes by default: a ZipStream that keeps digests. Its
 * integrity map is withheld where Web Crypto is missing, as buildIntegrity's is,
 * so a backup carries the same manifest whichever writer made the backup.
 */
export function streamedArchive(options: { mtime?: number | Date } = {}): BundleArchive {
  const zip = new ZipStream({ ...options, integrity: true });
  return {
    stats: zip.stats,
    bytes: (name, data, stored) => zip.bytes(name, data, stored),
    blob: (name, blob) => zip.blob(name, blob),
    open: name => zip.open(name),
    integrity: async () => (globalThis.crypto?.subtle ? zip.integrity() : null),
    finish: async () => zip.finish(),
  };
}
