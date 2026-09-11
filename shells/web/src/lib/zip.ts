// SPDX-License-Identifier: MPL-2.0
/**
 * The web shell's ONE fflate wrapper - zip + zip-bomb-guarded unzip.
 *
 * Every zip/unzip in the shell goes through here so there is a single
 * worker/sync split and a single bomb policy, instead of the five drifting
 * copies that used to live in pro/zip.ts, brand-transfer.ts, data-transfer.ts,
 * views/design-import.ts and bridge/export-pptx.ts. (bridge/pptx.ts's
 * `inflatePptx` remains its own export - it additionally caps the COMPRESSED
 * input and lazy-loads fflate for the read path.)
 *
 * Async offloads to fflate's Worker so packaging/restoring tens of MB doesn't
 * freeze the tab; the sync fallback covers no-Worker contexts (headless tests,
 * some embedded WebViews) with byte-identical output.
 *
 * The unzip filter runs BEFORE each entry inflates: an entry declaring an
 * absurd uncompressed size - or a set of entries summing past the total cap - 
 * rejects the whole archive instead of inflating a zip bomb into memory.
 * The DEFAULT caps are the strictest policy previously shipping (brand packs:
 * a tokens doc + a few woff2s); a call site whose legitimate payloads are
 * larger (full-workspace backups, design archives) passes explicit caps.
 */
import { zip, zipSync, unzip, unzipSync, type Unzipped, type UnzipFileInfo, type Zippable } from 'fflate';

const HAS_WORKER = typeof Worker !== 'undefined';

/**
 * Zip off the main thread: fflate's async zip spins up a Worker, so packaging a
 * large batch (hundreds of PNGs/PDFs) doesn't freeze the tab the way zipSync
 * did. The bytes are identical to the synchronous zipper. Falls back to zipSync
 * where Workers aren't available (e.g. some embedded WebViews), so behaviour is
 * preserved everywhere.
 */
export function zipAsync(entries: Zippable): Promise<Uint8Array<ArrayBuffer>> {
  if (!HAS_WORKER) return Promise.resolve(zipSync(entries));
  return new Promise((resolve, reject) => {
    zip(entries, (err, data) => (err ? reject(err) : resolve(data)));
  });
}

/** Zip-bomb guard knobs for {@link unzipAsync}. */
export interface UnzipGuardOpts {
  /** Cap on any single entry's DECLARED uncompressed size (bytes). */
  maxEntryBytes?: number;
  /** Cap on the sum of declared uncompressed sizes across the archive (bytes). */
  maxTotalBytes?: number;
  /** Builds the user-facing Error message for an over-cap archive; receives the
   *  first offending entry's name. */
  tooLarge?: (entryName: string) => string;
  /**
   * Optional entry selector, applied AFTER the bomb accounting so the whole
   * archive is still measured against the caps. Entries it rejects are never
   * inflated - a peek at a handful of tiny JSONs inside a 30 MB design archive
   * costs the header scan, not the decompression (see design-import's
   * `countPenpotComponents`). Absent = every entry is returned, as before.
   */
  pick?: (entryName: string) => boolean;
}

/** Default per-entry cap - the strictest policy previously shipping (brand packs). */
export const DEFAULT_MAX_ENTRY_BYTES = 64 * 1024 * 1024;
/** Default whole-archive cap - the strictest policy previously shipping (brand packs). */
export const DEFAULT_MAX_TOTAL_BYTES = 256 * 1024 * 1024;

/**
 * Unzip with the bomb guard described above. Never call this without intending
 * the guard: pass higher explicit caps rather than bypassing it.
 */
export function unzipAsync(bytes: Uint8Array, opts: UnzipGuardOpts = {}): Promise<Unzipped> {
  const maxEntry = opts.maxEntryBytes ?? DEFAULT_MAX_ENTRY_BYTES;
  const maxTotal = opts.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES;
  const tooLarge = opts.tooLarge ?? ((name: string) => `This archive expands too large to open (${name}).`);
  let total = 0;
  let bomb: string | null = null;
  const filter = (f: UnzipFileInfo): boolean => {
    total += f.originalSize || 0;
    if ((f.originalSize || 0) > maxEntry || total > maxTotal) {
      bomb = f.name;
      return false;
    }
    return opts.pick ? opts.pick(f.name) : true;
  };
  const guard = (data: Unzipped): Unzipped => {
    if (bomb) throw new Error(tooLarge(bomb));
    return data;
  };
  if (!HAS_WORKER) return Promise.resolve().then(() => guard(unzipSync(bytes, { filter })));
  return new Promise((resolve, reject) => {
    unzip(bytes, { filter }, (err, data) => {
      if (err) return reject(err);
      try { resolve(guard(data)); } catch (e) { reject(e); }
    });
  });
}
