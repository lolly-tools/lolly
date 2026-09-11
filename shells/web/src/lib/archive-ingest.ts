// SPDX-License-Identifier: MPL-2.0
/**
 * Explode a dropped plain archive (.zip / .tar / .tar.gz) into its member files so
 * each can be re-imported as its own asset. The counterpart to the engine's archive
 * WRITERS (storeZip / packTar); this is the read side that makes ZIP and tar
 * round-trip in the shell.
 *
 * The essential guard: a zip is only exploded once `classifyZipBytes` confirms it
 * is a PLAIN archive. An OOXML/OCF package (.xlsx/.docx/.pptx/.epub/.odt) shares the
 * PK magic, so shredding one into raw XML parts would be a data-loss bug - those get
 * a clear "route it to its own reader" error instead. Members are bounded by a count
 * and an aggregate-byte cap (zip-bomb defence), mirroring xlsx-import's budget.
 */

import { readZip, readTar, readTarGz, sniffContainer } from '@lolly/engine';
import { classifyZipEntries } from './zip-classify.ts';

/** Most members a single archive may explode into. */
export const MAX_ARCHIVE_MEMBERS = 200;
/** Aggregate uncompressed bytes an archive may expand to before we refuse it. */
export const MAX_ARCHIVE_TOTAL_BYTES = 256 * 1024 * 1024;
/** Bound directory/empty/bookkeeping records too, while allowing more than 200 useful files. */
export const MAX_ARCHIVE_ZIP_ENTRIES = MAX_ARCHIVE_MEMBERS * 4;
/** Payload plus bounded ZIP directory/header overhead. */
export const MAX_ZIP_ARCHIVE_BYTES = MAX_ARCHIVE_TOTAL_BYTES + 64 * 1024 * 1024;
/** Payload cap plus the maximum tar header/padding overhead for 200 members. */
const MAX_TAR_ARCHIVE_BYTES = MAX_ARCHIVE_TOTAL_BYTES + (MAX_ARCHIVE_MEMBERS + 2) * 512;

export interface ArchiveMember {
  /** The member's path within the archive (directories stripped by the readers). */
  name: string;
  bytes: Uint8Array;
}

/** Thrown with a user-facing message when the bytes are not a plain archive, or bust a cap. */
export class ArchiveIngestError extends Error {}

/** Nested packages spend the same budget as their enclosing import. */
export interface ArchiveBudget { bytes: number; entries: number }
const inheritedBudgets = new WeakMap<File, ArchiveBudget>();
export function archiveBudgetFor(file: File): ArchiveBudget {
  // Root files start a fresh operation; only extracted children inherit a budget.
  // Retrying a normal upload must not reuse the previous operation's spent budget.
  return inheritedBudgets.get(file) ?? { bytes: MAX_ARCHIVE_TOTAL_BYTES, entries: MAX_ARCHIVE_ZIP_ENTRIES };
}
export function archiveMemberFile(bytes: Uint8Array, name: string, budget: ArchiveBudget): File {
  const file = new File([bytes as BlobPart], name.split('/').pop() || name);
  inheritedBudgets.set(file, budget);
  return file;
}
export function readUploadZip(bytes: Uint8Array, budget: ArchiveBudget): ArchiveMember[] {
  if (budget.bytes < 1 || budget.entries < 1) throw new ArchiveIngestError('That import has exhausted its archive expansion limit.');
  const entries = readZip(bytes, {
    maxInputBytes: MAX_ZIP_ARCHIVE_BYTES, maxEntries: budget.entries,
    maxEntryBytes: budget.bytes, maxTotalBytes: budget.bytes,
  });
  budget.entries -= entries.length;
  budget.bytes -= entries.reduce((sum, entry) => sum + entry.bytes.length, 0);
  return entries;
}
export async function readUploadArchiveBytes(file: File): Promise<Uint8Array> {
  if (file.size > MAX_ZIP_ARCHIVE_BYTES) throw new ArchiveIngestError('That archive exceeds the 320 MB input limit - unpack it on your device first.');
  return new Uint8Array(await file.arrayBuffer());
}

const isTarGzName = (name: string): boolean => /\.(tar\.gz|tgz)$/i.test(name);

/**
 * OS bookkeeping junk that rides along in an archive (or a dragged folder) but is not a
 * user asset. A macOS-made zip carries a `__MACOSX/` tree of `._name` AppleDouble
 * resource-fork stubs beside every real file, plus `.DS_Store`; Windows adds `Thumbs.db`
 * / `desktop.ini`. Left unfiltered, each became its own unreadable "VECTOR .bin" upload
 * (an `._foo.svg` matches the .svg extension test yet holds AppleDouble binary, so it
 * sanitises to nothing and renders blank). Skip them everywhere files are ingested.
 */
export function isIgnoredUploadName(name: string): boolean {
  const base = name.split('/').pop() || name;
  return /(^|\/)__MACOSX(\/|$)/.test(name)
    || base.startsWith('._')
    || base === '.DS_Store'
    || base === 'Thumbs.db'
    || base === 'desktop.ini';
}

/**
 * Read the member files of a plain archive. `filename` disambiguates a `.tar.gz`
 * (gunzip then untar) from a bare gzip. Throws `ArchiveIngestError` when the input
 * is an OOXML/OCF package (route it to its own reader), an unsupported/corrupt
 * archive, or busts the member/byte caps.
 */
export function readArchiveMembers(bytes: Uint8Array, filename: string, budget: ArchiveBudget = { bytes: MAX_ARCHIVE_TOTAL_BYTES, entries: MAX_ARCHIVE_ZIP_ENTRIES }): ArchiveMember[] {
  const kind = sniffContainer(bytes);
  let raw: { name: string; bytes: Uint8Array }[];

  if (kind === 'zip') {
    try {
      raw = readUploadZip(bytes, budget);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/entries; maximum|expands to|input is .* maximum/.test(message)) {
        throw new ArchiveIngestError(
          `That archive exceeds the ${MAX_ARCHIVE_MEMBERS}-file or 256 MB import limit - unpack it on your device first.`,
        );
      }
      throw new ArchiveIngestError('That ZIP could not be read (it may be encrypted or use an unsupported format).');
    }

    // Never shred an office/OCF package that merely shares the PK magic. Reuse
    // the bounded extraction above so classification cannot double peak memory.
    const zipKind = classifyZipEntries(raw);
    if (zipKind !== 'archive') {
      throw new ArchiveIngestError(
        zipKind
          ? `That looks like a ${zipKind.toUpperCase()} file, not a plain archive - open it with its own importer.`
          : 'That ZIP could not be read (it may be encrypted or use an unsupported format).',
      );
    }
  } else if (kind === 'tar') {
    // TarFile carries `.data`; normalise to the shared { name, bytes } shape.
    raw = readTar(bytes, {
      maxMembers: Math.min(MAX_ARCHIVE_MEMBERS, budget.entries),
      maxPayloadBytes: Math.min(MAX_ARCHIVE_TOTAL_BYTES, budget.bytes),
      maxArchiveBytes: MAX_TAR_ARCHIVE_BYTES,
    }).map((f) => ({ name: f.name, bytes: f.data }));
  } else if (kind === 'gzip' && isTarGzName(filename)) {
    raw = readTarGz(bytes, {
      maxMembers: Math.min(MAX_ARCHIVE_MEMBERS, budget.entries),
      maxPayloadBytes: Math.min(MAX_ARCHIVE_TOTAL_BYTES, budget.bytes),
      maxArchiveBytes: MAX_TAR_ARCHIVE_BYTES,
    }).map((f) => ({ name: f.name, bytes: f.data }));
  } else {
    throw new ArchiveIngestError('That file is not a ZIP or tar archive.');
  }

  if (kind !== 'zip') {
    budget.bytes -= raw.reduce((sum, entry) => sum + entry.bytes.length, 0);
    budget.entries -= raw.length;
    if (budget.bytes < 0 || budget.entries < 0) throw new ArchiveIngestError('That import has exhausted its archive expansion limit.');
  }

  const members: ArchiveMember[] = [];
  let total = 0;
  for (const e of raw) {
    if (!e.name || e.name.endsWith('/') || e.bytes.length === 0) continue; // dirs / empties
    if (isIgnoredUploadName(e.name)) continue;                             // macOS/Windows junk
    members.push(e);
    total += e.bytes.length;
    if (members.length > MAX_ARCHIVE_MEMBERS) {
      throw new ArchiveIngestError(`That archive has more than ${MAX_ARCHIVE_MEMBERS} files - unpack it on your device first.`);
    }
    if (total > MAX_ARCHIVE_TOTAL_BYTES) {
      throw new ArchiveIngestError('That archive expands to more than 256 MB - unpack it on your device first.');
    }
  }
  if (members.length === 0) throw new ArchiveIngestError('That archive has no files to import.');
  return members;
}

/**
 * True when this file is a plain archive we can explode, decided by NAME only - the
 * cheap rung for the drop chooser (the authoritative byte check happens in
 * `readArchiveMembers` when the user commits). `.penpot`/`.fig`/`.idml`/`.indd` are
 * design bundles routed elsewhere, so they are excluded even though they are zips.
 */
export function looksLikePlainArchiveName(name: string): boolean {
  if (/\.(penpot|fig|idml|indd)$/i.test(name)) return false;
  return /\.(zip|tar|tar\.gz|tgz)$/i.test(name);
}

/**
 * Expand any plain-archive files (by name) in `files` into their member files,
 * leaving every other file untouched - the shared pre-pass for the auto-ingest
 * paths (the catalogue/#start dropzone, the picker file-input) that have no chooser.
 * A file that looks like an archive by name but is not a plain archive (a renamed
 * office package, a corrupt or encrypted zip) is kept as-is so the normal ingest
 * path handles or reports it. Only archive-named files are read; others pass through
 * without a byte read.
 */
export async function expandArchiveFiles(files: File[]): Promise<File[]> {
  const out: File[] = [];
  for (const file of files) {
    if (!looksLikePlainArchiveName(file.name)) {
      out.push(file);
      continue;
    }
    try {
      const bytes = await readUploadArchiveBytes(file);
      const budget = archiveBudgetFor(file);
      for (const m of readArchiveMembers(bytes, file.name, budget)) {
        out.push(archiveMemberFile(m.bytes, m.name, budget));
      }
    } catch {
      out.push(file); // not a plain archive after all - let the caller's path deal with it
    }
  }
  return out;
}
