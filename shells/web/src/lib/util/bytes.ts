// SPDX-License-Identifier: MPL-2.0
/**
 * Byte conversions the web shell reaches for in seven or eight places each.
 *
 * The base64 pair is the engine's: `bytesToBin` chunks the binary string at
 * 0x8000 so a multi-megabyte buffer cannot overflow the argument list, and
 * `base64ToBytes` is `atob` semantics (it throws on invalid input). Callers
 * that want a `null` instead of a throw, or that have to strip whitespace
 * first, wrap this rather than re-deriving it.
 *
 * `audioSourceBytes` is here because `host.audio` and `host.speech` fetch an
 * `AudioSource` identically before handing it to a decoder.
 */
import type { AudioSource } from '@lolly-tools/core/host-v1';
import { base64ToBytes, bytesToBin } from '../../../../../engine/src/bytes.ts';

export { base64ToBytes };

/** Bytes → standard base64. */
export function bytesToBase64(bytes: Uint8Array): string {
  return btoa(bytesToBin(bytes));
}

/**
 * An `AudioSource` (raw buffer, byte view, asset ref or URL) as an
 * `ArrayBuffer` ready for `decodeAudioData`.
 *
 * A `Uint8Array` is COPIED: `decodeAudioData` detaches whatever buffer it is
 * given, and the caller may still need those bytes (a `file` input's bytes get
 * read again for the export).
 */
export async function audioSourceBytes(src: AudioSource): Promise<ArrayBuffer> {
  if (src instanceof ArrayBuffer) return src;
  if (src instanceof Uint8Array) return src.slice().buffer as ArrayBuffer;
  const url = typeof src === 'string' ? src : src.url;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`audio fetch failed: ${res.status}`);
  return res.arrayBuffer();
}
