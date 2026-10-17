// SPDX-License-Identifier: MPL-2.0
/**
 * Hashes that take their input a chunk at a time, for archive parts too large to
 * hold whole (plan 203 R4).
 *
 * Web Crypto only digests a whole buffer, so a 300 MB video would have to be read
 * into memory just to be hashed. `Sha256` here gives the same digest from chunks,
 * and `Crc32` gives the ZIP checksum the same way, so one bounded read of a Blob
 * yields both. Small inputs still go to Web Crypto, which is faster; the digest is
 * the same either way.
 */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** SHA-256 over input given in pieces (FIPS 180-4). */
export class Sha256 {
  #h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  #w = new Uint32Array(64);
  #block = new Uint8Array(64);
  #held = 0;
  #length = 0;
  #done = false;

  update(data: Uint8Array): this {
    if (this.#done) throw new Error('This hash is already finished.');
    const n = data.length;
    let i = 0;
    this.#length += n;
    if (this.#held) {
      i = Math.min(64 - this.#held, n);
      this.#block.set(data.subarray(0, i), this.#held);
      this.#held += i;
      if (this.#held < 64) return this;
      this.#compress(this.#block, 0);
      this.#held = 0;
    }
    for (; i + 64 <= n; i += 64) this.#compress(data, i);
    if (i < n) { this.#block.set(data.subarray(i), 0); this.#held = n - i; }
    return this;
  }

  digest(): Uint8Array {
    if (this.#done) throw new Error('This hash is already finished.');
    // One 0x80 byte, zeros to 56 mod 64, then the length in bits as 64 bits.
    const tail = new Uint8Array(this.#held < 56 ? 64 : 128);
    tail.set(this.#block.subarray(0, this.#held));
    tail[this.#held] = 0x80;
    const view = new DataView(tail.buffer);
    view.setUint32(tail.length - 8, Math.floor(this.#length / 0x20000000));
    view.setUint32(tail.length - 4, (this.#length << 3) >>> 0);
    for (let o = 0; o < tail.length; o += 64) this.#compress(tail, o);
    this.#done = true;
    const out = new Uint8Array(32);
    const outView = new DataView(out.buffer);
    for (let j = 0; j < 8; j++) outView.setUint32(j * 4, this.#h[j]!);
    return out;
  }

  #compress(src: Uint8Array, o: number): void {
    const w = this.#w, h = this.#h;
    for (let j = 0; j < 16; j++, o += 4) w[j] = (src[o]! << 24) | (src[o + 1]! << 16) | (src[o + 2]! << 8) | src[o + 3]!;
    for (let j = 16; j < 64; j++) {
      const a = w[j - 15]!, b = w[j - 2]!;
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
      w[j] = (w[j - 16]! + s0 + w[j - 7]! + s1) | 0;
    }
    let a = h[0]!, b = h[1]!, c = h[2]!, d = h[3]!, e = h[4]!, f = h[5]!, g = h[6]!, k = h[7]!;
    for (let j = 0; j < 64; j++) {
      const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const t1 = (k + s1 + ((e & f) ^ (~e & g)) + K[j]! + w[j]!) | 0;
      const s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const t2 = (s0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      k = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h[0] = (h[0]! + a) | 0; h[1] = (h[1]! + b) | 0; h[2] = (h[2]! + c) | 0; h[3] = (h[3]! + d) | 0;
    h[4] = (h[4]! + e) | 0; h[5] = (h[5]! + f) | 0; h[6] = (h[6]! + g) | 0; h[7] = (h[7]! + k) | 0;
  }
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  return table;
})();

/** The ZIP checksum (CRC-32, as fflate and the engine compute it) over pieces. */
export class Crc32 {
  #c = -1;
  update(data: Uint8Array): this {
    let c = this.#c;
    for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]!) & 255]! ^ (c >>> 8);
    this.#c = c;
    return this;
  }
  /** The checksum as an unsigned 32-bit number. */
  value(): number { return ~this.#c >>> 0; }
}

/** How much of a Blob one read takes: the most a streamed hash or copy holds at once. */
export const READ_CHUNK_BYTES = 4 * 1024 * 1024;

/** Read a Blob in order, `chunkBytes` at a time. */
export async function readBlobChunks(blob: Blob, onChunk: (chunk: Uint8Array) => void | Promise<void>, chunkBytes = READ_CHUNK_BYTES): Promise<void> {
  for (let offset = 0; offset < blob.size; offset += chunkBytes) {
    const end = Math.min(blob.size, offset + chunkBytes);
    const chunk = new Uint8Array(await blob.slice(offset, end).arrayBuffer());
    // A file that changed under its handle must fail, never yield other bytes.
    if (chunk.length !== end - offset) throw new Error('A file changed while it was being read. Nothing was written.');
    await onChunk(chunk);
  }
}

const SUBTLE = globalThis.crypto?.subtle ?? null;

/** SHA-256 of bytes already in memory: Web Crypto when present, the streamed hash otherwise. */
export async function sha256Of(bytes: Uint8Array): Promise<Uint8Array> {
  if (SUBTLE) return new Uint8Array(await SUBTLE.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>));
  return new Sha256().update(bytes).digest();
}

/** CRC-32 and, when asked, SHA-256 of a Blob, from one bounded read. */
export async function hashBlob(blob: Blob, withSha256: boolean, chunkBytes = READ_CHUNK_BYTES): Promise<{ crc: number; sha256: Uint8Array | null }> {
  const crc = new Crc32();
  if (blob.size <= chunkBytes) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (bytes.length !== blob.size) throw new Error('A file changed while it was being read. Nothing was written.');
    return { crc: crc.update(bytes).value(), sha256: withSha256 ? await sha256Of(bytes) : null };
  }
  const sha = withSha256 ? new Sha256() : null;
  await readBlobChunks(blob, chunk => { crc.update(chunk); sha?.update(chunk); }, chunkBytes);
  return { crc: crc.value(), sha256: sha ? sha.digest() : null };
}
