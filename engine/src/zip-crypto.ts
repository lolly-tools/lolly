// SPDX-License-Identifier: MPL-2.0
/**
 * Two-tier zip encryption — the crypto behind the "lock this download" option.
 *
 *   Standard  = traditional PKWARE ZipCrypto. Weak (known-plaintext attacks), but
 *               opens in ANY unzip tool including Windows Explorer's built-in extract.
 *   Strong    = WinZip AES, AE-2, AES-256. Strong, but does NOT open in Windows
 *               Explorer's built-in zip — needs 7-Zip / WinZip / Keka / macOS.
 *
 * Pure and DOM-free (globalThis.crypto only, same rule as pdf-crypto-r6.ts). The
 * SHELL compresses each entry with fflate and hands us the compressed bytes + CRC;
 * this module does the crypto and frames the whole encrypted zip (local headers,
 * central directory, EOCD). All randomness (ZipCrypto's 11 header bytes, AE-2's
 * 16-byte salt) is injected via `opts.rng` so it round-trips a fixed vector.
 *
 * Two byte-level traps, both handled below:
 *   1. ZipCrypto's key1 update multiplies by 0x08088405 — must use Math.imul or the
 *      JS double overflows and silently corrupts the keystream.
 *   2. WinZip's AES-CTR counter is a 128-bit LITTLE-endian integer from 1; WebCrypto
 *      AES-CTR increments big-endian, so we drive the counter ourselves over a small
 *      bundled AES block cipher (subtle exposes no ECB / raw block).
 *
 * Verified references: scratchpad/zipcrypto-ref.mjs (vs `unzip -P`), scratchpad/
 * ae2-ref.mjs + verify.py (vs pyzipper). See engine changelog 1.15.0.
 */

const subtle = globalThis.crypto.subtle;
const asBufferSource = (b: Uint8Array): BufferSource => b as unknown as BufferSource;

export type ZipTier = 'standard' | 'strong';

export interface ZipEntryInput {
  /** UTF-8 path within the zip. */
  name: string;
  /** fflate deflateSync output (method 8) OR the raw bytes (method 0). */
  compressed: Uint8Array;
  /** 8 = deflate, 0 = stored. */
  method: 0 | 8;
  /** CRC-32 of the ORIGINAL (uncompressed) plaintext, unsigned. */
  crc32: number;
  /** Length of the original plaintext. */
  uncompressedSize: number;
}

// ── CRC-32 (reflected, poly 0xEDB88320) — shared by the whole-buffer CRC and the
//    ZipCrypto per-byte key update. Exported so the shell computes per-entry CRC. ──
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const crc32Byte = (crc: number, b: number): number => (CRC_TABLE[(crc ^ b) & 0xff]! ^ (crc >>> 8)) >>> 0;

// ── Little helpers ──────────────────────────────────────────────────────────
function concatBytes(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// ── Standard PKWARE ZipCrypto ───────────────────────────────────────────────
// One fresh key state per file; keys always advance from the PLAINTEXT byte.
class ZipCryptoKeys {
  private k0 = 0x12345678;
  private k1 = 0x23456789;
  private k2 = 0x34567890;
  constructor(pw: Uint8Array) {
    for (let i = 0; i < pw.length; i++) this.update(pw[i]!);
  }
  private update(c: number): void {
    this.k0 = crc32Byte(this.k0, c);
    this.k1 = (this.k1 + (this.k0 & 0xff)) >>> 0;
    this.k1 = (Math.imul(this.k1, 0x08088405) + 1) >>> 0; // Math.imul is mandatory here
    this.k2 = crc32Byte(this.k2, (this.k1 >>> 24) & 0xff);
  }
  private streamByte(): number {
    const temp = (this.k2 | 2) & 0xffff;
    return ((temp * (temp ^ 1)) >>> 8) & 0xff;
  }
  encrypt(plain: Uint8Array): Uint8Array {
    const out = new Uint8Array(plain.length);
    for (let i = 0; i < plain.length; i++) {
      const p = plain[i]!;
      out[i] = (p ^ this.streamByte()) & 0xff;
      this.update(p);
    }
    return out;
  }
}

/**
 * Encrypt one file's (already compressed) bytes with ZipCrypto: a 12-byte header
 * (11 injected-random bytes + a CHECK byte = the CRC's high byte) then the data,
 * on one continuous keystream. Returns `12 + compressed.length` bytes.
 */
export function zipCryptoEncrypt(pw: Uint8Array, compressed: Uint8Array, crc: number, random11: Uint8Array): Uint8Array {
  const header = new Uint8Array(12);
  header.set(random11.subarray(0, 11), 0);
  header[11] = (crc >>> 24) & 0xff; // GPBF bit 3 = 0 → CHECK byte is the CRC high byte
  const keys = new ZipCryptoKeys(pw);
  return concatBytes([keys.encrypt(header), keys.encrypt(compressed)]);
}

// ── AES-256 block cipher (encrypt only) — pure, for the WinZip LE-CTR keystream.
//    subtle exposes no ECB/raw block, and per-block subtle calls are far too slow
//    for image-sized members, so we bundle a compact table-free core. ───────────
const AES_SBOX = (() => {
  const sbox = new Uint8Array(256);
  const p = new Uint8Array(256);
  // Multiplicative inverse in GF(2^8) via log/antilog over generator 3.
  const log = new Uint8Array(256), exp = new Uint8Array(256);
  let x = 1;
  for (let i = 0; i < 255; i++) { exp[i] = x; log[x] = i; x ^= xtime(x); }
  const inv = (a: number): number => (a === 0 ? 0 : exp[(255 - log[a]!) % 255]!);
  for (let i = 0; i < 256; i++) {
    let s = inv(i);
    let xf = s;
    for (let k = 0; k < 4; k++) { xf = ((xf << 1) | (xf >>> 7)) & 0xff; s ^= xf; }
    sbox[i] = (s ^ 0x63) & 0xff;
  }
  void p;
  return sbox;
})();
function xtime(a: number): number { return ((a << 1) ^ (a & 0x80 ? 0x11b : 0)) & 0xff; }
function mul(a: number, b: number): number {
  let r = 0;
  for (let i = 0; i < 8; i++) { if (b & 1) r ^= a; const hi = a & 0x80; a = (a << 1) & 0xff; if (hi) a ^= 0x1b; b >>= 1; }
  return r & 0xff;
}

class Aes256 {
  private rk: Uint8Array; // 240-byte expanded key (60 words)
  constructor(key: Uint8Array) {
    const Nk = 8, Nr = 14, total = 4 * (Nr + 1); // 60 words
    const w = new Uint8Array(total * 4);
    w.set(key.subarray(0, 32), 0);
    const rcon = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40];
    for (let i = Nk; i < total; i++) {
      const o = i * 4;
      let t0 = w[o - 4]!, t1 = w[o - 3]!, t2 = w[o - 2]!, t3 = w[o - 1]!;
      if (i % Nk === 0) {
        [t0, t1, t2, t3] = [AES_SBOX[t1]! ^ rcon[i / Nk - 1]!, AES_SBOX[t2]!, AES_SBOX[t3]!, AES_SBOX[t0]!];
      } else if (i % Nk === 4) {
        [t0, t1, t2, t3] = [AES_SBOX[t0]!, AES_SBOX[t1]!, AES_SBOX[t2]!, AES_SBOX[t3]!];
      }
      w[o] = w[o - 32]! ^ t0; w[o + 1] = w[o - 31]! ^ t1; w[o + 2] = w[o - 30]! ^ t2; w[o + 3] = w[o - 29]! ^ t3;
    }
    this.rk = w;
  }
  encryptBlock(inBlk: Uint8Array): Uint8Array {
    const s = inBlk.slice(0, 16);
    const Nr = 14;
    this.addRoundKey(s, 0);
    for (let round = 1; round < Nr; round++) {
      this.subBytes(s); this.shiftRows(s); this.mixColumns(s); this.addRoundKey(s, round);
    }
    this.subBytes(s); this.shiftRows(s); this.addRoundKey(s, Nr);
    return s;
  }
  private addRoundKey(s: Uint8Array, round: number): void {
    const o = round * 16;
    for (let i = 0; i < 16; i++) s[i] = s[i]! ^ this.rk[o + i]!;
  }
  private subBytes(s: Uint8Array): void { for (let i = 0; i < 16; i++) s[i] = AES_SBOX[s[i]!]!; }
  private shiftRows(s: Uint8Array): void {
    const t = s.slice(0);
    // column-major state: s[r + 4c]
    for (let r = 1; r < 4; r++) for (let c = 0; c < 4; c++) s[r + 4 * c] = t[r + 4 * ((c + r) % 4)]!;
  }
  private mixColumns(s: Uint8Array): void {
    for (let c = 0; c < 4; c++) {
      const o = 4 * c;
      const a0 = s[o]!, a1 = s[o + 1]!, a2 = s[o + 2]!, a3 = s[o + 3]!;
      s[o] = mul(a0, 2) ^ mul(a1, 3) ^ a2 ^ a3;
      s[o + 1] = a0 ^ mul(a1, 2) ^ mul(a2, 3) ^ a3;
      s[o + 2] = a0 ^ a1 ^ mul(a2, 2) ^ mul(a3, 3);
      s[o + 3] = mul(a0, 3) ^ a1 ^ a2 ^ mul(a3, 2);
    }
  }
}

// WinZip AES-CTR keystream: block i (from 1) = AES(encKey, LE128(i)); XOR into data.
function aesCtrLe(encKey: Uint8Array, data: Uint8Array): Uint8Array {
  const aes = new Aes256(encKey);
  const out = new Uint8Array(data.length);
  const counter = new Uint8Array(16);
  let value = 1n; // 128-bit little-endian counter, starts at 1
  for (let off = 0; off < data.length; off += 16) {
    let v = value;
    for (let b = 0; b < 16; b++) { counter[b] = Number(v & 0xffn); v >>= 8n; }
    const ks = aes.encryptBlock(counter);
    const n = Math.min(16, data.length - off);
    for (let i = 0; i < n; i++) out[off + i] = data[off + i]! ^ ks[i]!;
    value += 1n;
  }
  return out;
}

export interface AesZipKeys { encKey: Uint8Array; authKey: Uint8Array; pwVerify: Uint8Array; }

/** WinZip AE PBKDF2: HMAC-SHA1, 1000 iters → 32-byte enc key ‖ 32-byte auth key ‖ 2-byte verify. */
export async function deriveAesZipKey(pw: Uint8Array, salt16: Uint8Array): Promise<AesZipKeys> {
  const base = await subtle.importKey('raw', asBufferSource(pw), 'PBKDF2', false, ['deriveBits']);
  const dk = new Uint8Array(await subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-1', salt: asBufferSource(salt16), iterations: 1000 }, base, 66 * 8,
  ));
  return { encKey: dk.subarray(0, 32), authKey: dk.subarray(32, 64), pwVerify: dk.subarray(64, 66) };
}

/**
 * Encrypt one file's (already compressed) bytes as a WinZip AE-2 entry:
 * salt(16) ‖ pwVerify(2) ‖ AES-256-LE-CTR(ciphertext) ‖ HMAC-SHA1(ct)[0..10].
 */
export async function aesZipEncryptEntry(pw: Uint8Array, compressed: Uint8Array, salt16: Uint8Array): Promise<Uint8Array> {
  const { encKey, authKey, pwVerify } = await deriveAesZipKey(pw, salt16);
  const ct = aesCtrLe(encKey, compressed);
  const hmacKey = await subtle.importKey('raw', asBufferSource(authKey), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const mac = new Uint8Array(await subtle.sign('HMAC', hmacKey, asBufferSource(ct))).subarray(0, 10);
  return concatBytes([salt16, pwVerify, ct, mac]);
}

// ── Zip container framing ───────────────────────────────────────────────────
const DOS_DATE = 0x0021; // 1980-01-01 (fixed → deterministic; time 0)
const AES_EXTRA_LEN = 11;

function encodeName(name: string): Uint8Array { return new TextEncoder().encode(name); }

// AES extra field 0x9901 (11 bytes): id, size, version(2=AE-2), "AE", strength(3=256), real method.
function aesExtraField(method: 0 | 8): Uint8Array {
  return new Uint8Array([0x01, 0x99, 0x07, 0x00, 0x02, 0x00, 0x41, 0x45, 0x03, method & 0xff, 0x00]);
}

interface FramedEntry {
  name: Uint8Array;
  method: number;      // container method (real for ZipCrypto, 99 for AE-2)
  crc: number;         // container CRC (real for ZipCrypto, 0 for AE-2)
  compSize: number;    // payload length written
  uncompSize: number;
  payload: Uint8Array;
  extra: Uint8Array;   // '' for ZipCrypto, 0x9901 for AE-2
}

/**
 * Build a whole encrypted zip from pre-compressed entries. `opts.rng(n)` supplies
 * the per-entry random bytes (default CSPRNG) — deterministic when injected, so the
 * output round-trips a fixed vector in tests.
 */
export async function buildEncryptedZip(
  entries: ZipEntryInput[],
  opts: { tier: ZipTier; password: string; rng?: (n: number) => Uint8Array },
): Promise<Uint8Array<ArrayBuffer>> {
  const rng = opts.rng ?? ((n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n)));
  const pw = new TextEncoder().encode(opts.password);

  const framed: FramedEntry[] = [];
  for (const e of entries) {
    if (opts.tier === 'standard') {
      const payload = zipCryptoEncrypt(pw, e.compressed, e.crc32, rng(11));
      framed.push({
        name: encodeName(e.name), method: e.method, crc: e.crc32,
        compSize: payload.length, uncompSize: e.uncompressedSize, payload, extra: new Uint8Array(0),
      });
    } else {
      const payload = await aesZipEncryptEntry(pw, e.compressed, rng(16));
      framed.push({
        name: encodeName(e.name), method: 99, crc: 0,
        compSize: payload.length, uncompSize: e.uncompressedSize, payload, extra: aesExtraField(e.method),
      });
    }
  }

  // Local records (track each file's local-header offset for the central dir).
  const locals: Uint8Array[] = [];
  const offsets: number[] = [];
  let offset = 0;
  for (const f of framed) {
    const lfh = new Uint8Array(30 + f.name.length + f.extra.length);
    const dv = new DataView(lfh.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true);          // version needed
    dv.setUint16(6, 0x0001, true);      // GPBF bit 0 = encrypted
    dv.setUint16(8, f.method, true);
    dv.setUint16(10, 0, true);          // mod time
    dv.setUint16(12, DOS_DATE, true);   // mod date
    dv.setUint32(14, f.crc, true);
    dv.setUint32(18, f.compSize, true);
    dv.setUint32(22, f.uncompSize, true);
    dv.setUint16(26, f.name.length, true);
    dv.setUint16(28, f.extra.length, true);
    lfh.set(f.name, 30);
    lfh.set(f.extra, 30 + f.name.length);
    offsets.push(offset);
    locals.push(lfh, f.payload);
    offset += lfh.length + f.payload.length;
  }
  const localBlob = concatBytes(locals);

  // Central directory.
  const centrals: Uint8Array[] = [];
  for (let i = 0; i < framed.length; i++) {
    const f = framed[i]!;
    const cdr = new Uint8Array(46 + f.name.length + f.extra.length);
    const dv = new DataView(cdr.buffer);
    dv.setUint32(0, 0x02014b50, true);
    dv.setUint16(4, 20, true);          // version made by
    dv.setUint16(6, 20, true);          // version needed
    dv.setUint16(8, 0x0001, true);      // GPBF
    dv.setUint16(10, f.method, true);
    dv.setUint16(12, 0, true);          // mod time
    dv.setUint16(14, DOS_DATE, true);   // mod date
    dv.setUint32(16, f.crc, true);
    dv.setUint32(20, f.compSize, true);
    dv.setUint32(24, f.uncompSize, true);
    dv.setUint16(28, f.name.length, true);
    dv.setUint16(30, f.extra.length, true);
    dv.setUint16(32, 0, true);          // comment length
    dv.setUint16(34, 0, true);          // disk number start
    dv.setUint16(36, 0, true);          // internal attrs
    dv.setUint32(38, 0, true);          // external attrs
    dv.setUint32(42, offsets[i]!, true);
    cdr.set(f.name, 46);
    cdr.set(f.extra, 46 + f.name.length);
    centrals.push(cdr);
  }
  const centralBlob = concatBytes(centrals);

  // End of central directory.
  const eocd = new Uint8Array(22);
  const edv = new DataView(eocd.buffer);
  edv.setUint32(0, 0x06054b50, true);
  edv.setUint16(8, framed.length, true);
  edv.setUint16(10, framed.length, true);
  edv.setUint32(12, centralBlob.length, true);
  edv.setUint32(16, localBlob.length, true);

  return concatBytes([localBlob, centralBlob, eocd]);
}
