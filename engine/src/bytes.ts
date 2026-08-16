// SPDX-License-Identifier: MPL-2.0
/**
 * Shared byte-level primitives for the engine's binary/crypto format modules
 * (c2pa, c2pa-verify, seal, x509, zip-crypto, pdf-crypto-r6, …). One canonical
 * copy of the helpers those modules used to each carry privately.
 *
 * INTERNAL. Not exported from index.ts on purpose; consumers import this
 * module directly, so the public engine surface is unchanged.
 *
 * Platform-agnostic like every consumer: globalThis.crypto only (browsers,
 * Node 18+, the Tauri webview), no DOM, no node: imports. No crypto access at
 * module load time, only inside sha256(), so byte-only modules (video-meta,
 * webp-anim, strip-metadata) can import this in any environment.
 */

/** Concatenate byte arrays into one freshly-allocated buffer. */
export function concatBytes(parts: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// TS 5.7+ widens Uint8Array to Uint8Array<ArrayBufferLike>; WebCrypto wants an
// ArrayBuffer-backed BufferSource. Every engine buffer is ArrayBuffer-backed,
// so this is a type-only widening, erased at runtime.
export const asBufferSource = (b: Uint8Array): BufferSource => b as unknown as BufferSource;

/** Plain SHA-256 digest (WebCrypto). */
export async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', asBufferSource(bytes)));
}

/** Bytes → lowercase hex, two digits per byte. */
export const bytesToHex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

/**
 * Lowercase sha256 hex of the given bytes: `bytesToHex(await sha256(bytes))`,
 * the one spelling of that pair in the engine.
 *
 * This function lives here, not in `catalog-integrity.ts` (its original home,
 * which still re-exports it so the barrel surface is unchanged), for a
 * boot-path reason: `design-version.ts` re-exports it too, and
 * `design-version.ts` is on the web shell's first-paint graph via
 * `bridge/assets.ts`. Sourcing a two-line helper from `catalog-integrity.ts`
 * would drag that module, and through it `x509.ts` and `der-read.ts`, onto
 * the boot chunk set for a feature (catalog signature verification) that is
 * inert unless a build pins a public key. This keeps the same leaf-import
 * discipline that the `engine-util` / `engine-version` chunk groups exist to
 * protect.
 */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  return bytesToHex(await sha256(bytes));
}

/** Strict standard base64 → bytes (atob semantics: throws on invalid input).
 *  Callers must do any massaging first: PEM armor / whitespace stripping,
 *  padding fixes, base64url alphabet translation. */
export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Byte-transparent binary string (each char == one byte). TextDecoder('latin1')
// is really windows-1252 (remaps 0x80–0x9f), so this is built by hand. Used so
// offsets found in the string map 1:1 onto file byte offsets, and as btoa input.
export function bytesToBin(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000) as unknown as number[]);
  }
  return s;
}
