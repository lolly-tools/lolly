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
import { unzipAsync, zipAsync } from './zip.ts';
import { bytesToBase64 } from './util/bytes.ts';

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

// ── Where parts are written (plan 203 R4) ──────────────────────────────────────
// A backup's parts used to be gathered into one entry map and zipped at the end.
// They are now written through a PartSink: the streamed archive in
// lib/zip-stream.ts, which never holds the whole backup, or entrySink below, which
// fills an entry map exactly as before for the callers and tests that want one.

/** A part being written in chunks. Nothing of it is in the archive until `close()`. */
export interface PartWriter {
  /** Bytes written so far. */
  readonly bytes: number;
  write(chunk: Uint8Array): Promise<void>;
  close(): Promise<void>;
  /** Drop the part. The archive is left as it was before it was opened. */
  abort(): void;
}

/** Where a bundle's parts go, in the order they should appear. One part at a time. */
export interface PartSink {
  /** A part in memory, deflated unless `stored` (already-compressed bytes stay as they are). */
  bytes(name: string, data: Uint8Array, stored?: boolean): Promise<void>;
  /** A stored part whose bytes are in a Blob: read in chunks, never re-encoded. */
  blob(name: string, blob: Blob): Promise<void>;
  /** A deflated part written in chunks. */
  open(name: string): PartWriter;
}

/** The uncompressed size of every part, and the largest one. */
export interface BundleStats { total: number; largest: { name: string; bytes: number } }

/** A PartSink that ends as one ZIP Blob. */
export interface BundleArchive extends PartSink {
  readonly stats: BundleStats;
  /** The `manifest.integrity` map for the parts so far; null without Web Crypto. */
  integrity(): Promise<Record<string, string> | null>;
  finish(): Promise<Blob>;
}

/** Write parts into an entry map, the in-memory shape zipAsync takes. */
export function entrySink(entries: Record<string, BundleEntry>): PartSink {
  return {
    async bytes(name, data, stored = false) { entries[name] = stored ? [data, { level: 0 }] : data; },
    async blob(name, blob) { entries[name] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }]; },
    open(name) {
      const chunks: Uint8Array[] = [];
      let size = 0;
      return {
        get bytes() { return size; },
        async write(chunk) { chunks.push(chunk); size += chunk.length; },
        async close() {
          const whole = new Uint8Array(size);
          let at = 0;
          for (const chunk of chunks) { whole.set(chunk, at); at += chunk.length; }
          entries[name] = whole;
        },
        abort() { chunks.length = 0; size = 0; },
      };
    },
  };
}

/**
 * The in-memory archive: every part held in an entry map, integrity hashed over the
 * map and the whole ZIP built by zipAsync, the way exportBackup wrote a backup
 * before it streamed. Kept as the reference the streamed archive is measured and
 * tested against (tests/backup-streaming.test.ts, scripts/bench-backup-finalise.ts).
 */
export function memoryArchive(): BundleArchive {
  const entries: Record<string, BundleEntry> = {};
  const sink = entrySink(entries);
  return {
    ...sink,
    get stats(): BundleStats {
      const stats: BundleStats = { total: 0, largest: { name: '', bytes: 0 } };
      for (const [name, entry] of Object.entries(entries)) {
        const bytes = entryBytes(entry).byteLength;
        stats.total += bytes;
        if (bytes > stats.largest.bytes) stats.largest = { name, bytes };
      }
      return stats;
    },
    integrity: () => buildIntegrity(entries),
    finish: async () => new Blob([(await zipAsync(entries)) as BlobPart], { type: 'application/zip' }),
  };
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
 * inflates. An oversized part is refused with the `tooLarge` message; any other
 * failure becomes one plain `invalid` message. `maxEntryBytes`
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
  // A refused oversized part keeps its own message; any other failure reads as `invalid`.
  let refused: string | null = null;
  try {
    return await unzipAsync(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), {
      tooLarge: (name) => (refused = tooLarge(name)),
      ...(maxEntryBytes != null ? { maxEntryBytes } : {}),
      ...(maxTotalBytes != null ? { maxTotalBytes } : {}),
    });
  } catch {
    throw new Error(refused ?? invalid);
  }
}
