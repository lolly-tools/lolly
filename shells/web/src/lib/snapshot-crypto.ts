// SPDX-License-Identifier: MPL-2.0
/**
 * snapshot-crypto (plans/138 B1) - optional passphrase encryption of a sync
 * snapshot BEFORE it leaves the device for a third-party cloud. The
 * sovereignty-consistent default: a person's Drive/Dropbox/S3/WebDAV holds only
 * ciphertext they alone can open, so "the user's own cloud" never means the
 * provider (or Lolly) can read the contents. iCloud's private DB is already
 * end-to-owner, so that path can skip this.
 *
 * Same proven primitive as engine/src/url-pack.ts's encrypted `zx` links -
 * PBKDF2-SHA256 → AES-GCM-256 - but operating on RAW BYTES with no deflate (the
 * snapshot is an already-compressed zip) and no URL-length cap (a snapshot is
 * tens of MB). WebCrypto does the actual crypto; this only frames it.
 *
 * On-disk layout of an encrypted snapshot:
 *   magic(4 = "LSE1") ‖ iterations(u32 BE) ‖ salt(16) ‖ iv(12) ‖ ciphertext(+16B GCM tag)
 * The passphrase only DERIVES the key; it is never stored. iterations are stored
 * so the floor can rise later without breaking old snapshots.
 */

const MAGIC = new Uint8Array([0x4c, 0x53, 0x45, 0x31]); // "LSE1"
const PBKDF2_ITERATIONS = 210_000; // OWASP-2023 PBKDF2-SHA256 floor; stored per-blob so it can rise
const SALT_BYTES = 16;
const IV_BYTES = 12;                // AES-GCM standard nonce
const HEADER = MAGIC.length + 4 + SALT_BYTES + IV_BYTES;

export function isEncryptAvailable(): boolean {
  return typeof globalThis.crypto?.subtle !== 'undefined';
}

/** True if these bytes are an LSE1 encrypted snapshot (cheap magic check). */
export function isEncryptedSnapshot(bytes: Uint8Array): boolean {
  return bytes.length >= HEADER && bytes[0] === MAGIC[0] && bytes[1] === MAGIC[1]
    && bytes[2] === MAGIC[2] && bytes[3] === MAGIC[3];
}

// WebCrypto's TS lib types want a plain ArrayBuffer/ArrayBufferView; a Uint8Array
// view over a larger buffer is fine but its `.buffer` may be an ArrayBufferLike -
// normalise to an exact-length ArrayBuffer for the calls that are strict on it.
function bufOf(u8: Uint8Array): ArrayBuffer {
  return u8.byteOffset === 0 && u8.byteLength === u8.buffer.byteLength
    ? (u8.buffer as ArrayBuffer)
    : (u8.slice().buffer as ArrayBuffer);
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await globalThis.crypto.subtle.importKey(
    'raw', bufOf(new TextEncoder().encode(passphrase)), 'PBKDF2', false, ['deriveKey'],
  );
  return globalThis.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: bufOf(salt), iterations, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

/** Encrypt snapshot bytes under a passphrase. Throws only if WebCrypto is absent
 *  or the passphrase is empty - both caller errors, not runtime conditions. */
export async function encryptSnapshot(bytes: Uint8Array, passphrase: string): Promise<Uint8Array> {
  if (!isEncryptAvailable()) throw new Error('Encryption is unavailable in this environment.');
  if (!passphrase) throw new Error('A passphrase is required to encrypt a snapshot.');
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);
  const ct = new Uint8Array(await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: bufOf(iv) }, key, bufOf(bytes),
  ));
  const out = new Uint8Array(HEADER + ct.length);
  out.set(MAGIC, 0);
  new DataView(out.buffer).setUint32(MAGIC.length, PBKDF2_ITERATIONS, false); // big-endian
  out.set(salt, MAGIC.length + 4);
  out.set(iv, MAGIC.length + 4 + SALT_BYTES);
  out.set(ct, HEADER);
  return out;
}

/** Decrypt an LSE1 snapshot. Returns null on a WRONG PASSPHRASE (GCM auth fails),
 *  tamper, or a non-LSE1 blob - never fabricated plaintext. */
export async function decryptSnapshot(bytes: Uint8Array, passphrase: string): Promise<Uint8Array | null> {
  if (!isEncryptAvailable() || !passphrase || !isEncryptedSnapshot(bytes)) return null;
  try {
    const iterations = new DataView(bytes.buffer, bytes.byteOffset + MAGIC.length, 4).getUint32(0, false);
    if (iterations < 1 || iterations > 10_000_000) return null; // sanity-bound the work factor
    const salt = bytes.subarray(MAGIC.length + 4, MAGIC.length + 4 + SALT_BYTES);
    const iv = bytes.subarray(MAGIC.length + 4 + SALT_BYTES, HEADER);
    const ct = bytes.subarray(HEADER);
    const key = await deriveKey(passphrase, salt, iterations);
    const pt = await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv: bufOf(iv) }, key, bufOf(ct));
    return new Uint8Array(pt);
  } catch {
    return null; // wrong passphrase / tampered / corrupt
  }
}
