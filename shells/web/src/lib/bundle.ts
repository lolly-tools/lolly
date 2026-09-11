// SPDX-License-Identifier: MPL-2.0
/**
 * The signed-zip bundle envelope - the format brand packs (brand-transfer.ts) and
 * data backups (data-transfer.ts) BOTH speak.
 *
 * Those two modules carry very different payloads (a brand: tokens + fonts + logos;
 * a backup: profile + sessions + uploads) but they wrap them identically, and the
 * shape is deliberate (full spec: docs/data-transfer.md):
 *
 *   - fflate entries, with already-compressed bytes passed as the `[u8, {level:0}]`
 *     tuple so images/woff2 aren't pointlessly re-deflated.
 *   - `manifest.json` carrying `format` / `formatVersion` / `minReader` - readers
 *     gate on `minReader`, never the writer's `formatVersion`, so a bundle that
 *     merely ADDS an optional part still imports on an older build.
 *   - `manifest.integrity`: SHA-256 (SRI-style) per part, so a transfer mangled in
 *     transit (USB, email, AirDrop) fails loudly instead of half-restoring.
 *     Best-effort on BOTH sides - no Web Crypto ⇒ we don't write the map, and we
 *     don't fail to verify one we can't.
 *   - `lolly.txt`: a human-readable summary, written AFTER the integrity loop (a
 *     README, regenerated each export, not payload) and ignored on import.
 *
 * Everything here is pure + DOM-free, so both callers' round-trip tests exercise it
 * headlessly against an in-memory bridge.
 */

import { strFromU8 } from 'fflate';
import type { Unzipped } from 'fflate';
import { unzipAsync } from './zip.ts';

/** An fflate entry: raw bytes, or the `[bytes, opts]` tuple used to skip
 *  re-deflating already-compressed payloads (images, woff2). */
export type BundleEntry = Uint8Array | [Uint8Array, { level: 0 }];

/** The human-readable summary dropped into every bundle zip. A known-but-ignored
 *  part: never counted as `skipped`, never read on import, never integrity-mapped. */
export const README_NAME = 'lolly.txt';

/** Branding banner atop both READMEs - mirrors batch-export manifests (pro/zip.js
 *  `HEADER`). Kept as a literal here so these core modules stay free of any /pro
 *  import (the batch folder is designed to be removable) - keep the two in sync. */
export const BUNDLE_HEADER = '📐 Lolly  •  ❤️ Give Fitzy an Ovation  •  🌏 https://lolly.tools';

/** Web Crypto - present in any secure browser context and in modern Node (so the
 *  headless round-trip tests exercise integrity too). Absent ⇒ integrity is a
 *  no-op on both sides. */
const SUBTLE = globalThis.crypto?.subtle ?? null;

// Chunked so a multi-MB image blob doesn't blow the call stack via spread/apply.
function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as unknown as number[]);
  }
  return btoa(bin);
}

/** SRI-style `sha256-<base64>` digest of one part's bytes. Exported so anything that
 *  records a digest ALONGSIDE a bundle (the `.lolly` font receipt, whose faces travel as
 *  identity rather than bytes) spells one the same way `manifest.integrity` does. */
export async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await SUBTLE!.digest('SHA-256', bytes as unknown as BufferSource);
  return 'sha256-' + bytesToBase64(new Uint8Array(digest));
}

/** Normalise an entry to its bytes (drops the `{level:0}` tuple wrapper). */
function entryBytes(v: BundleEntry): Uint8Array {
  return v instanceof Uint8Array ? v : v[0];
}

/** Parse one JSON part out of an unzipped bundle; null when absent or malformed. */
// biome-ignore lint/suspicious/noExplicitAny: parts are free-form JSON by design.
export function readJson(files: Unzipped, name: string): any {
  const u8 = files[name];
  if (!u8) return null;
  try { return JSON.parse(strFromU8(u8)); } catch { return null; }
}

/**
 * The `manifest.integrity` map for everything written so far, or null when Web
 * Crypto is unavailable (callers then simply omit the field). Call this BEFORE
 * adding the manifest itself and the README - neither is integrity-protected.
 */
export async function buildIntegrity(
  entries: Record<string, BundleEntry>,
): Promise<Record<string, string> | null> {
  if (!SUBTLE) return null;
  const integrity: Record<string, string> = {};
  for (const [path, value] of Object.entries(entries)) integrity[path] = await sha256(entryBytes(value));
  return integrity;
}

/**
 * Verify every part the manifest vouches for, BEFORE anything is written to the
 * device. Throws on the first missing or mismatched part; resolves silently when
 * the bundle carries no map or Web Crypto is unavailable (can't-verify is not the
 * same as corrupt, and an older bundle without a map imports unchanged).
 *
 * `subject` is the user-facing noun for this kind of bundle - "This brand file",
 * "This backup" - so the error reads as one sentence.
 */
export async function verifyIntegrity(
  files: Unzipped, integrity: unknown, subject: string,
): Promise<void> {
  if (!integrity || !SUBTLE) return;
  for (const [path, expected] of Object.entries(integrity as Record<string, string>)) {
    const part = files[path];
    if (!part) throw new Error(`${subject} is incomplete - "${path}" is missing.`);
    if ((await sha256(part)) !== expected) {
      throw new Error(`${subject} appears corrupted - "${path}" failed its integrity check.`);
    }
  }
}

/**
 * Unzip bundle bytes with declared-size bomb caps checked BEFORE each entry
 * inflates, turning any failure into one plain `invalid` message. `maxEntryBytes`
 * / `maxTotalBytes` default to lib/zip.ts's (brand-pack-sized) caps; a backup of
 * uploaded images needs far larger ones and passes them explicitly.
 */
export async function unzipBundle(
  bytes: ArrayBuffer | Uint8Array,
  opts: {
    /** Message for the "this archive is a zip bomb" refusal, given the entry name. */
    tooLarge: (name: string) => string;
    /** Message thrown when the bytes aren't a readable zip at all. */
    invalid: string;
    maxEntryBytes?: number;
    maxTotalBytes?: number;
  },
): Promise<Unzipped> {
  const { tooLarge, invalid, maxEntryBytes, maxTotalBytes } = opts;
  try {
    return await unzipAsync(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), {
      tooLarge,
      ...(maxEntryBytes != null ? { maxEntryBytes } : {}),
      ...(maxTotalBytes != null ? { maxTotalBytes } : {}),
    });
  } catch {
    throw new Error(invalid);
  }
}
