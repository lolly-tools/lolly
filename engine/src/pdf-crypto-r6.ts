// SPDX-License-Identifier: MPL-2.0
/**
 * PDF Standard Security Handler — revision 6 (R6), AES-256 (ISO 32000-2 §7.6.4,
 * originally Adobe's "ExtensionLevel 3"). The pure crypto behind the "Strong lock"
 * PDF export tier.
 *
 * This module ONLY computes the /Encrypt dictionary values (/U /O /UE /OE /Perms)
 * and encrypts individual object strings/streams. The SHELL owns the document walk
 * (pdf-lib) AND supplies every random input — the 32-byte file key, the four 8-byte
 * salts, the 4-byte Perms tail, and one 16-byte IV per object — as parameters. So
 * this module is DOM-free, deterministic given its inputs, and unit-tests against a
 * fixed byte vector (see tests/pdf-crypto-r6.test.ts).
 *
 * Primitives use the Web Crypto API (globalThis.crypto.subtle) — identical in the
 * browser, Node, and the Tauri webview, same convention as c2pa.ts/x509.ts; no
 * node:crypto, no DOM. subtle has no ECB and no unpadded CBC, so:
 *   - the two no-pad CBC steps (the Algorithm 2.B hash loop and the file-key wrap)
 *     run CBC-with-PKCS#7 and drop the trailing pad block, and
 *   - the single-block ECB (/Perms) is CBC with a zero IV.
 * Every no-pad input here is an exact multiple of the 16-byte block, so dropping one
 * 16-byte pad block is always correct.
 *
 * Four things R6 implementations get wrong, all guarded below: (1) owner hashes/keys
 * take udata = the full 48-byte /U (user ones take empty); (2) the file key encrypts
 * EVERY object with NO per-object derivation (unlike R4/AESV2); (3) /Perms is ECB
 * while everything else is CBC; (4) P is little-endian inside /Perms. See engine
 * changelog 1.14.0.
 */

const subtle = globalThis.crypto.subtle;

// The lib's BufferSource wants an ArrayBuffer-backed view; our Uint8Arrays are
// generic (ArrayBufferLike). Same widening cast c2pa.ts/x509.ts use at subtle calls.
const asBufferSource = (b: Uint8Array): BufferSource => b as unknown as BufferSource;

const ZERO_IV = new Uint8Array(16);

function concat(...parts: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

async function digest(algo: 'SHA-256' | 'SHA-384' | 'SHA-512', data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await subtle.digest(algo, asBufferSource(data)));
}

// AES-CBC with PKCS#7 padding. Key length selects AES-128 (16) or AES-256 (32).
async function aesCbcPkcs7(key: Uint8Array, iv: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await subtle.importKey('raw', asBufferSource(key), { name: 'AES-CBC' }, false, ['encrypt']);
  return new Uint8Array(await subtle.encrypt({ name: 'AES-CBC', iv: asBufferSource(iv) }, k, asBufferSource(data)));
}

// AES-CBC with NO padding. `data.length` MUST be a multiple of 16 — subtle always
// appends exactly one PKCS#7 block for block-aligned input, so the no-pad result is
// the ciphertext minus that trailing 16-byte block.
async function aesCbcNoPad(key: Uint8Array, iv: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const full = await aesCbcPkcs7(key, iv, data);
  return full.subarray(0, full.length - 16);
}

// AES single-block ECB (no padding) == CBC of that one block under a zero IV.
async function aesEcbBlock(key: Uint8Array, block16: Uint8Array): Promise<Uint8Array> {
  return aesCbcNoPad(key, ZERO_IV, block16);
}

/**
 * Algorithm 2.B — the R6 "hardened hash". `udata` is the full 48-byte /U when
 * hashing an OWNER password/key, and empty (default) for a USER password/key.
 * Returns 32 bytes.
 */
export async function hashR6(
  password: Uint8Array,
  salt: Uint8Array,
  udata: Uint8Array = new Uint8Array(0),
): Promise<Uint8Array> {
  let K = await digest('SHA-256', concat(password, salt, udata));
  let round = 0;
  for (;;) {
    round++;
    // (a) K1 = (password ‖ K ‖ udata) repeated 64 times — always a multiple of 16.
    const block = concat(password, K, udata);
    const K1 = new Uint8Array(block.length * 64);
    for (let i = 0; i < 64; i++) K1.set(block, i * block.length);
    // (b) E = AES-128-CBC, no padding, key = K[0..15], IV = K[16..31].
    const E = await aesCbcNoPad(K.subarray(0, 16), K.subarray(16, 32), K1);
    // (c) hash choice = (sum of E[0..15]) mod 3 — equals big-endian(E[0..15]) mod 3
    //     because 256 ≡ 1 (mod 3), so every byte contributes with weight 1.
    let sum = 0;
    for (let i = 0; i < 16; i++) sum += E[i]!;
    const algo = sum % 3 === 0 ? 'SHA-256' : sum % 3 === 1 ? 'SHA-384' : 'SHA-512';
    // (d) K becomes 32/48/64 bytes.
    K = await digest(algo, E);
    // Terminate after ≥64 rounds once the LAST byte of E (not K) is ≤ round − 32.
    if (round >= 64 && E[E.length - 1]! <= round - 32) break;
  }
  return K.subarray(0, 32);
}

/** §1 — UTF-8 encode the password and truncate to 127 bytes (byte truncation). */
export function preparePassword(pw: string): Uint8Array {
  const bytes = new TextEncoder().encode(pw);
  return bytes.length > 127 ? bytes.subarray(0, 127) : bytes;
}

export interface EncryptDictInput {
  /** UTF-8 password bytes (see preparePassword) that opens the file. */
  userPw: Uint8Array;
  /** UTF-8 owner password bytes (Lolly uses the same value as userPw). */
  ownerPw: Uint8Array;
  /** The 32 random bytes that encrypt every object — caller-supplied for testability. */
  fileKey: Uint8Array;
  /** Four independent 8-byte random salts. */
  salts: { uvs: Uint8Array; uks: Uint8Array; ovs: Uint8Array; oks: Uint8Array };
  /** 4 random bytes stored in the /Perms tail. */
  permsRandom: Uint8Array;
  /** Signed 32-bit permission flags (ISO 32000-2 Table 22). */
  P: number;
  /** Whether the document Metadata stream is encrypted (Lolly: true). */
  encryptMetadata: boolean;
}

export interface EncryptDictValues {
  /** 48 bytes: 32-byte hash ‖ 8-byte UVS ‖ 8-byte UKS. */
  U: Uint8Array;
  /** 48 bytes: 32-byte hash ‖ 8-byte OVS ‖ 8-byte OKS. */
  O: Uint8Array;
  /** 32 bytes: the file key wrapped under the user key. */
  UE: Uint8Array;
  /** 32 bytes: the file key wrapped under the owner key. */
  OE: Uint8Array;
  /** 16 bytes: the AES-256-ECB-encrypted permissions block. */
  Perms: Uint8Array;
}

/**
 * Compute all five /Encrypt dictionary byte-strings. Order matters: /U and /UE
 * (user hashes take empty udata) are computed FIRST, because /O and /OE hash over
 * the full 48-byte /U.
 */
export async function buildEncryptDictValues(input: EncryptDictInput): Promise<EncryptDictValues> {
  const { userPw, ownerPw, fileKey, salts, permsRandom, P, encryptMetadata } = input;

  // /U + /UE — user hashes take empty udata.
  const userHash = await hashR6(userPw, salts.uvs);
  const U = concat(userHash, salts.uvs, salts.uks);
  const ikeU = await hashR6(userPw, salts.uks);
  const UE = await aesCbcNoPad(ikeU, ZERO_IV, fileKey);

  // /O + /OE — owner hashes take udata = the full 48-byte /U (hence after /U).
  const ownerHash = await hashR6(ownerPw, salts.ovs, U);
  const O = concat(ownerHash, salts.ovs, salts.oks);
  const ikeO = await hashR6(ownerPw, salts.oks, U);
  const OE = await aesCbcNoPad(ikeO, ZERO_IV, fileKey);

  // /Perms — 16-byte block, then AES-256-ECB under the file key.
  const perms16 = new Uint8Array(16);
  const dv = new DataView(perms16.buffer);
  dv.setInt32(0, P, true);           // P, little-endian
  dv.setUint32(4, 0xffffffff, true); // high 32 bits: all ones
  perms16[8] = encryptMetadata ? 0x54 : 0x46; // 'T' | 'F'
  perms16[9] = 0x61; // 'a'
  perms16[10] = 0x64; // 'd'
  perms16[11] = 0x62; // 'b'
  perms16.set(permsRandom.subarray(0, 4), 12);
  const Perms = await aesEcbBlock(fileKey, perms16);

  return { U, O, UE, OE, Perms };
}

/**
 * §8 — encrypt one object's bytes (a string's or a stream's content): a fresh
 * 16-byte IV prepended to AES-256-CBC-PKCS#7 ciphertext, all under the single file
 * key (R6 has no per-object key). The caller supplies the IV so tests are
 * deterministic; in production it must be fresh CSPRNG bytes per object.
 */
export async function encryptObjectBytes(
  fileKey: Uint8Array,
  iv16: Uint8Array,
  plaintext: Uint8Array,
): Promise<Uint8Array> {
  const ct = await aesCbcPkcs7(fileKey, iv16, plaintext);
  return concat(iv16, ct);
}
