// SPDX-License-Identifier: MPL-2.0
/**
 * sync-keys (plans/138 B2, plan 203 rank 9) - the key design for per-record sync.
 *
 * Per-record sync (sync-engine.ts `syncRecords`) stores one object per record and
 * one per file body, named by content, plus one index. Encryption stays optional
 * and off by default (plans/138 D8, R9): without a passphrase an object is stored
 * as plain bytes and named by the SHA-256 of its content.
 *
 * With a passphrase:
 *   - One random 16-byte salt per store. The device that writes the first
 *     encrypted index picks it; every object carries it in clear in its header,
 *     with the PBKDF2 work factor, so every object says which keys open the object.
 *   - master = PBKDF2-SHA256(passphrase, salt, 210,000 rounds), 256 bits. This runs
 *     once per sync: the last derivation is cached in memory for the same
 *     passphrase, salt and work factor.
 *   - Two keys come from the master through HKDF-SHA256 with different info
 *     strings: an AES-GCM-256 key that seals every object and the index, and an
 *     HMAC-SHA256 key that names objects. Neither is ever stored.
 *   - An object's name is HMAC(name key, content hash), in hex. The same content
 *     in one store gets one name, which is the deduplication, but a reader of the
 *     store cannot test whether the person holds a known file, because computing
 *     a name needs the key.
 *   - Every sealed object: magic "LSE2" ‖ rounds (u32, big-endian) ‖ salt (16) ‖
 *     iv (12) ‖ AES-GCM ciphertext and tag. A fresh random IV per write. The
 *     additional authenticated data is the role ('index' or 'object'), so an
 *     object cannot be passed off as the index.
 *   - The engine checks every opened object's SHA-256 against the index entry, so
 *     a swapped or damaged object is refused, sealed or not.
 *
 * Recovery: there is none for a lost passphrase, and the UI says so (R9). Each
 * device keeps its own data. Replacing the synced copy with one device under a new
 * passphrase, or none, starts a new store generation: a new salt, and every object
 * written again under new names. Objects of the old generation stay in the store
 * until they are removed by hand, because nothing can read the old index.
 *
 * What a reader of the store learns:
 *   - With encryption: how many objects there are and the size of each (the
 *     plaintext plus 36 bytes; sizes are not padded), when objects are written and
 *     which are written together, the size of the index and how often it changes,
 *     and that two records hold identical content (they share one object). Not
 *     learned: record ids (project slots, asset ids, design-system names), any
 *     content, any content hash, or the passphrase. PBKDF2 slows guessing, but a
 *     weak passphrase can still be guessed offline against any object.
 *   - The store could serve an older index it has seen. The index carries a
 *     counter inside the sealed bytes and each device remembers the highest one it
 *     synced, so an older index is refused rather than applied.
 *   - Without encryption, whoever can read the store reads everything, and the
 *     object names are plain SHA-256 digests of the content.
 *
 * History never goes through this module: revision history, discarded edits and
 * file history stay on the device that made them (plan 277 P4, plan 203 rank 9).
 */

const MAGIC = new Uint8Array([0x4c, 0x53, 0x45, 0x32]); // "LSE2"
export const SYNC_KEY_ROUNDS = 210_000;    // the PBKDF2-SHA256 floor snapshot-crypto.ts uses
const SALT_BYTES = 16;
const IV_BYTES = 12;
const HEADER = MAGIC.length + 4 + SALT_BYTES + IV_BYTES;
/** Bytes a sealed object adds to its plaintext: the header and the GCM tag. */
export const SEAL_OVERHEAD = HEADER + 16;

/** What a sealed object is for. Bound into the ciphertext as additional data. */
export type SealRole = 'index' | 'object';

/** The keys of one store generation. */
export interface StoreKeys {
  readonly salt: Uint8Array;
  readonly rounds: number;
  readonly seal: CryptoKey;
  readonly name: CryptoKey;
}

// WebCrypto's types want an exact ArrayBuffer; a view over a larger buffer is copied.
function bufOf(u8: Uint8Array): ArrayBuffer {
  return u8.byteOffset === 0 && u8.byteLength === u8.buffer.byteLength
    ? (u8.buffer as ArrayBuffer)
    : (u8.slice().buffer as ArrayBuffer);
}

const subtle = (): SubtleCrypto => {
  if (typeof globalThis.crypto?.subtle === 'undefined') throw new Error('Encryption is unavailable in this environment.');
  return globalThis.crypto.subtle;
};

const hex = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/** SHA-256 of `bytes`, in lowercase hex. The content hash every record and file body is known by. */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  return hex(new Uint8Array(await subtle().digest('SHA-256', bufOf(bytes))));
}

let cached: { passphrase: string; salt: string; rounds: number; keys: StoreKeys } | null = null;

/**
 * The keys for `passphrase` in the store generation `salt` names. Without a salt,
 * a new generation: a fresh random salt. The last derivation is cached, so a sync
 * that opens many objects derives once.
 */
export async function deriveStoreKeys(passphrase: string, salt?: Uint8Array, rounds = SYNC_KEY_ROUNDS): Promise<StoreKeys> {
  if (!passphrase) throw new Error('A passphrase is required to encrypt synced data.');
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 10_000_000) throw new Error('Unreadable key settings in the synced data.');
  const useSalt = salt ?? globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const saltHex = hex(useSalt);
  if (cached && cached.passphrase === passphrase && cached.salt === saltHex && cached.rounds === rounds) return cached.keys;
  const c = subtle();
  const base = await c.importKey('raw', bufOf(new TextEncoder().encode(passphrase)), 'PBKDF2', false, ['deriveBits']);
  const master = await c.deriveBits({ name: 'PBKDF2', salt: bufOf(useSalt), iterations: rounds, hash: 'SHA-256' }, base, 256);
  const hkdf = await c.importKey('raw', master, 'HKDF', false, ['deriveKey']);
  const info = (label: string): ArrayBuffer => bufOf(new TextEncoder().encode(`lolly-sync v2 ${label}`));
  const empty = new ArrayBuffer(0);
  const seal = await c.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: empty, info: info('seal') }, hkdf,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const name = await c.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: empty, info: info('name') }, hkdf,
    { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign']);
  const keys: StoreKeys = { salt: useSalt.slice(), rounds, seal, name };
  cached = { passphrase, salt: saltHex, rounds, keys };
  return keys;
}

/** Test seam: forget the cached derivation. */
export function resetStoreKeyCacheForTests(): void {
  cached = null;
}

/** True when `bytes` is a sealed per-record object (cheap magic check). */
export function isSealedObject(bytes: Uint8Array): boolean {
  return bytes.length >= HEADER + 16 && MAGIC.every((b, i) => bytes[i] === b);
}

/** The salt and rounds a sealed object was made with, or null when it is not sealed. */
export function sealedKeySettings(bytes: Uint8Array): { salt: Uint8Array; rounds: number } | null {
  if (!isSealedObject(bytes)) return null;
  const rounds = new DataView(bytes.buffer, bytes.byteOffset + MAGIC.length, 4).getUint32(0, false);
  return { salt: bytes.slice(MAGIC.length + 4, MAGIC.length + 4 + SALT_BYTES), rounds };
}

/** Seal `plain` under the store keys, for the given role. */
export async function sealObject(keys: StoreKeys, plain: Uint8Array, role: SealRole): Promise<Uint8Array> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = new Uint8Array(await subtle().encrypt(
    { name: 'AES-GCM', iv: bufOf(iv), additionalData: bufOf(new TextEncoder().encode(role)) }, keys.seal, bufOf(plain),
  ));
  const out = new Uint8Array(HEADER + ct.length);
  out.set(MAGIC, 0);
  new DataView(out.buffer).setUint32(MAGIC.length, keys.rounds, false);
  out.set(keys.salt, MAGIC.length + 4);
  out.set(iv, MAGIC.length + 4 + SALT_BYTES);
  out.set(ct, HEADER);
  return out;
}

/**
 * Open a sealed object. Null when the keys are not this object's (another
 * generation, a wrong passphrase), the role does not match, or the bytes were
 * changed: AES-GCM cannot tell these apart, and it never yields made-up plaintext.
 */
export async function openObject(keys: StoreKeys, bytes: Uint8Array, role: SealRole): Promise<Uint8Array | null> {
  const settings = sealedKeySettings(bytes);
  if (!settings || settings.rounds !== keys.rounds || hex(settings.salt) !== hex(keys.salt)) return null;
  try {
    const iv = bytes.subarray(MAGIC.length + 4 + SALT_BYTES, HEADER);
    const plain = await subtle().decrypt(
      { name: 'AES-GCM', iv: bufOf(iv), additionalData: bufOf(new TextEncoder().encode(role)) }, keys.seal, bufOf(bytes.subarray(HEADER)),
    );
    return new Uint8Array(plain);
  } catch {
    return null;
  }
}

/**
 * The store name of the content with this hash: the hash itself without keys, an
 * HMAC of it under the name key with them.
 */
export async function objectNameFor(keys: StoreKeys | null, contentHash: string): Promise<string> {
  if (!keys) return contentHash;
  const mac = await subtle().sign('HMAC', keys.name, bufOf(new TextEncoder().encode(contentHash)));
  return hex(new Uint8Array(mac));
}
