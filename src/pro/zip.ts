// SPDX-License-Identifier: MPL-2.0
/**
 * Pro / Batch mode - packaging of rendered blobs for delivery.
 *
 * Primary path: bundle everything into a single .zip (fflate, all in-browser,
 * no network). Fallback path: if zipping fails (or the caller chooses), trigger
 * the downloads one at a time with a delay so the browser reliably accepts a
 * burst of saves - some browsers drop rapid-fire programmatic downloads.
 */
import { deflateSync, strToU8, type Zippable } from 'fflate';
import { buildEncryptedZip, crc32, type ZipTier, type ZipEntryInput } from '@lolly/engine';
import { zipAsync } from '../lib/zip.ts';
import { getHostRef } from '../lib/host-ref.ts';
import { preflightJson, type PreflightReport, type UnmadeRow } from './manifest.ts';

/** A rendered output described in the manifest (`lolly.txt`). */
interface ManifestFile {
  name: string;
  ms?: number | null;
  fmt?: string;
  url?: string;
}

/** A manifest file plus its bytes, ready to be zipped or saved. */
interface ZipFile extends ManifestFile {
  blob: Blob;
}

/** Author profile fields surfaced in the manifest credit block. */
interface ZipAuthor {
  firstname?: string;
  lastname?: string;
  email?: string;
  phone?: string;
}

/** Packaging metadata: zip name, author profile, and the reproducing CSV. */
export interface ZipMeta {
  zipName?: string;
  author?: ZipAuthor | null;
  csv?: string;
  /** When set with a password, the whole zip is encrypted at this tier. */
  zipLock?: ZipTier;
  password?: string;
  /**
   * Rows that produced no file: skipped before the run, failed during it, or never
   * attempted because the run was cancelled. Recorded because a zip that lists only
   * its successes is not an honest record of the job - the overlay's ", 3 failed"
   * is UI chrome that evaporates the second the zip is mailed on, and a recipient
   * cannot otherwise tell 480-of-480 from 480-of-500.
   */
  unmade?: readonly UnmadeRow[];
  /**
   * Per-FILE diagnostics, already flattened to display lines by the caller (this
   * module never sees a note object). Rendered as the `[ Notes ]` block.
   */
  noted?: ReadonlyArray<{ name: string; lines: readonly string[] }>;
  /**
   * Findings about the RUN, not about a file: the platform's own refusals ("Lolly
   * cannot predict the output file size") and the brand palette. They lead the
   * `[ Notes ]` block, once, instead of being repeated under every filename - which
   * is what made a clean 500-row batch ship a thousand-line note block.
   */
  runNotes?: readonly string[];
  /** Names the original package when this zip is a retry of an earlier run. */
  retryOf?: string;
  /**
   * The machine-readable sidecar, written as `preflight.json`. `lolly.txt` is the
   * human copy; it may not be the only carrier, so the same facts ship structurally.
   */
  preflight?: PreflightReport;
}

// Already-compressed payloads gain nothing from deflate and cost CPU, so store
// them (level 0). Text-ish formats compress well, so deflate them (level 6).
const STORE_EXT = new Set(['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'pdf', 'webm', 'mp4']);

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

// A glyph per output kind, picked by file extension. Unknown kinds get ⚠️.
const ICONS: Record<string, string> = {
  zip: '📦',
  pdf: '📕',
  txt: '📄',
  md: '📃',
  jpg: '🖼️', jpeg: '🖼️', avif: '🖼️', png: '🖼️',
  webp: '🌄',
  webm: '🎬',
  gif: '🎨',
  svg: '📐',
};
// Some formats share an extension (pdf-cmyk ships as .pdf, eps-cmyk as .eps), so
// the render format wins when it's known and distinctive.
const FORMAT_ICONS: Record<string, string> = { 'pdf-cmyk': '🖨️', 'eps-cmyk': '🖨️' };
const iconFor = (f: ManifestFile): string =>
  (f.fmt ? FORMAT_ICONS[f.fmt] : undefined) ?? ICONS[extOf(f.name)] ?? '⚠️';

// Friendly format names for the manifest (mirrors the subset the UI shows).
const FMT_LABEL: Record<string, string> = {
  'pdf-cmyk': 'Print PDF', 'cmyk-tiff': 'Print TIFF', 'eps-cmyk': 'EPS (CMYK)',
  'svg-anim': 'Animated SVG', 'webp-anim': 'Animated WebP', dxf: 'DXF', pptx: 'PowerPoint',
  jpeg: 'JPG', jpg: 'JPG', md: 'Markdown', txt: 'Text', ico: 'Icon', vcf: 'vCard', ics: 'Calendar',
};
const fmtLabel = (f?: string): string => (f ? (FMT_LABEL[f] ?? String(f).toUpperCase()) : '');

const HEADER = '📐 Lolly  •  ❤️ Give Fitzy an Ovation  •  🌏 https://lolly.tools';

const UNMADE_STATE_LABEL: Record<UnmadeRow['state'], string> = {
  failed: 'Failed',
  skipped: 'Skipped',
  cancelled: 'Cancelled',
};

/**
 * The rows that produced no file, one line each, in the file's existing voice and
 * reusing `fileLines`' own `   |  ` / `  ·  ` separators. The row number is a padded
 * FIELD, never baked into a sentence - a number that can be wrong inside a string is
 * the defect this whole channel exists to remove.
 */
function unmadeLines(unmade: readonly UnmadeRow[]): string[] {
  const rowW = Math.max(...unmade.map(u => String(u.row ?? '?').length), 1);
  const labelW = Math.min(24, Math.max(...unmade.map(u => u.label.length), 1));
  const stateW = Math.max(...unmade.map(u => UNMADE_STATE_LABEL[u.state].length));
  return unmade.flatMap(u => {
    const num = String(u.row ?? '?').padStart(rowW);
    const head = `⚠️ row ${num}  ${u.label.padEnd(labelW)}   |  ${UNMADE_STATE_LABEL[u.state].padEnd(stateW)}  ·  ${u.reason}`;
    // A note on an unmade row rides underneath it, indented - one row is still one
    // entry, and the count in the heading stays the count of rows.
    return [head, ...(u.notes ?? []).map(n => `${' '.repeat(3)}ℹ ${n}`)];
  });
}

// The little manifest dropped into every batch zip. Top block = package name +
// author (if set) + timestamp; then a clean one-line-per-file list; then all the
// "reopen in Lolly" links gathered into a list at the END (each as a "## filename"
// header with the URL on the next line, blocks blank-line separated) so they don't
// clutter the file list. `files` is [{ name, ms, fmt, url }]; opts carries the zip
// name + author.
//
// Two later blocks ride the same voice: the rows that produced no file, and the
// per-file notes. Both are siblings of the list they qualify, never UI chrome.
export function creditText(files: ManifestFile[] = [], { zipName, author, unmade = [], noted = [], runNotes = [], retryOf }: ZipMeta = {}): string {
  const now = new Date();
  const date = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const time = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });

  const n = files.length;
  const pkg = (zipName || 'lolly-batch.zip').trim();

  // Author line - name / email / phone from the profile, when present.
  const name = [author?.firstname, author?.lastname].filter(Boolean).join(' ');
  const authorLine = [name, author?.email, author?.phone].filter(Boolean).join(' | ');

  // One scannable line per file: "icon name | FORMAT · render time". No link here - 
  // the reopen links live in their own list at the end (see below).
  const fileLines = files.map(f => {
    const secs = f.ms != null ? `${(f.ms / 1000).toFixed(2)}s to render` : '';
    const meta = [fmtLabel(f.fmt), secs].filter(Boolean).join('  ·  ');
    return `${iconFor(f)} ${f.name}${meta ? `   |  ${meta}` : ''}`;
  });

  // Reopen links, listed at the very end as a "## filename" header with the URL on the
  // next line, one block per file we could build a link for (blocks blank-line separated
  // where they're joined below). Each reopens the tool in Lolly with the exact inputs used.
  const linkBlocks = files.filter(f => f.url).map(f => `## ${f.name}\n${f.url}`);

  const lines = [
    HEADER,
    '-'.repeat(56),
    '',
    '',
    `[[ 📦 ${pkg} ]]`,
  ];

  // A retry is a second package for one job - say so here, at the top, so the two
  // zips are readable as one job rather than as two unrelated runs.
  if (retryOf) {
    lines.push('', '[ This is a retry ]', '', `These are the rows that failed in ${retryOf} and were rendered again.`);
  }

  // Author sits right under the package name.
  if (authorLine) {
    lines.push('', '[ Author Information ]', '', authorLine);
  }

  lines.push(
    '',
    `Created on ${date} at ${time} (local)`,
  );

  // One fact line under the timestamp, so a skimmer cannot miss it.
  if (unmade.length) {
    lines.push(`${unmade.length} of ${n + unmade.length} rows produced no file - listed below.`);
  }

  lines.push(
    '',
    '',
    `[ ${n} file${n === 1 ? '' : 's'} included ]`,
    '',
    ...fileLines,
  );

  // The rows that are part of this job and not in this zip. Count-first heading,
  // mirroring the file block. The caveat is a sibling of the list, not UI chrome - 
  // the overlay's summary line is not in the zip.
  if (unmade.length) {
    lines.push(
      '',
      '',
      `[ ${unmade.length} row${unmade.length === 1 ? '' : 's'} produced no file ]`,
      '',
      'These rows were part of this job and are not in this zip.',
      '',
      ...unmadeLines(unmade),
    );
  }

  // Reopen links, gathered at the end. Blocks are joined by a blank line so each
  // "## filename" / URL pair stands apart.
  if (linkBlocks.length) {
    lines.push(
      '',
      '',
      '[ Links ]',
      '',
      'Each link reopens the tool in Lolly with the exact inputs used -',
      'follow it to recreate or tweak the file at lolly.tools.',
      '',
      linkBlocks.join('\n\n'),
    );
  }

  // Findings against files that DID render, shaped exactly like the link blocks.
  // "Notes", never "warnings": most findings are counts, and an info state must
  // never render as damage.
  const noteBlocks = noted.filter(x => x.lines.length).map(x => `## ${x.name}\n${x.lines.map(l => `ℹ ${l}`).join('\n')}`);
  // Run-level findings lead, under their own header, so a reader can tell "this is
  // true of the whole job" from "this is true of that file" without counting.
  const runBlock = runNotes.length
    ? [`## This run\n${runNotes.map(l => `ℹ ${l}`).join('\n')}`]
    : [];
  if (noteBlocks.length || runBlock.length) {
    lines.push(
      '',
      '',
      '[ Notes ]',
      '',
      'Findings from the preflight pass. They do not mean the file is wrong.',
      '',
      [...runBlock, ...noteBlocks].join('\n\n'),
    );
  }

  return lines.join('\n') + '\n';
}

/**
 * Build a single zip Blob from [{ name, blob, ms }] entries.
 * @param {Array<{name:string, blob:Blob, ms?:number}>} files
 * @param {{ zipName?:string, author?:object, csv?:string }} [meta]  package name +
 *        author profile (for the `lolly.txt` manifest) and, optionally,
 *        the batch settings as CSV (bundled so the run is reproducible).
 * @returns {Promise<Blob>}
 */
export async function buildZip(files: ZipFile[], meta: ZipMeta = {}): Promise<Blob> {
  // Whole-zip encryption: compress each member with fflate, then hand the bytes to the
  // engine's encrypting framer (fflate can't encrypt). Every member is locked - incl.
  // the lolly.txt manifest + the reproduce CSV. PDF members are already STORE (they're
  // incompressible; and when a batch password is set they're ALSO R6-locked inside - 
  // defense in depth). Non-PDF members are protected only by this container layer.
  if (meta.zipLock && meta.password) {
    const encEntries: ZipEntryInput[] = [];
    const add = (name: string, bytes: Uint8Array): void => {
      const store = STORE_EXT.has(extOf(name));
      encEntries.push({
        name,
        compressed: store ? bytes : deflateSync(bytes),
        method: store ? 0 : 8,
        crc32: crc32(bytes),
        uncompressedSize: bytes.length,
      });
    };
    for (const f of files) add(f.name, new Uint8Array(await f.blob.arrayBuffer()));
    add('lolly.txt', strToU8(creditText(files, meta)));
    if (meta.csv) add('lolly-batch.csv', strToU8(meta.csv));
    // The machine copy of the same facts, inside the encryption envelope where a row
    // naming a session path belongs. `preflight.json` breaks the `lolly-` prefix the
    // other two members share - deliberately: the name is fixed before consumers
    // parse it, and renaming it afterwards is exactly what cannot be done later.
    if (meta.preflight) add('preflight.json', strToU8(preflightJson(meta.preflight)));
    const zipped = await buildEncryptedZip(encEntries, { tier: meta.zipLock, password: meta.password });
    return new Blob([zipped], { type: 'application/zip' });
  }

  const entries: Zippable = {};
  for (const f of files) {
    const bytes = new Uint8Array(await f.blob.arrayBuffer());
    const level = STORE_EXT.has(extOf(f.name)) ? 0 : 6;
    entries[f.name] = [bytes, { level }];
  }
  entries['lolly.txt'] = [strToU8(creditText(files, meta)), { level: 6 }];
  // The settings that produced this batch - re-importable via Sessions ▸ Upload CSV.
  if (meta.csv) entries['lolly-batch.csv'] = [strToU8(meta.csv), { level: 6 }];
  if (meta.preflight) entries['preflight.json'] = [strToU8(preflightJson(meta.preflight)), { level: 6 }];
  const zipped = await zipAsync(entries);
  return new Blob([zipped], { type: 'application/zip' });
}

/**
 * Merge finished PDF files into ONE document, each file's pages in batch order
 * (plans/140 S5 - the "print shop" delivery). Pages keep their own sizes;
 * pdf-lib copies them verbatim. The per-file C2PA manifests do NOT survive a
 * page copy - the caller says so in the UI, and the zip stays the
 * credential-preserving delivery.
 */
export async function combinePdfs(files: { blob: Blob }[]): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib');
  const out = await PDFDocument.create();
  for (const f of files) {
    const src = await PDFDocument.load(new Uint8Array(await f.blob.arrayBuffer()), { updateMetadata: false });
    const pages = await out.copyPages(src, src.getPageIndices());
    for (const p of pages) out.addPage(p);
  }
  return new Blob([await out.save() as BlobPart], { type: 'application/pdf' });
}

/**
 * Deliver a single Blob to the device.
 *
 * Routes through `host.export.download`, which is the delivery verb the Tauri
 * shells OVERRIDE with a native filesystem save (bridge-overrides/export.ts). A
 * raw `<a download>` here would be dropped outright by wry's WebView (no download
 * handler), so every batch ZIP, CSV and brand export that funnels through here
 * silently vanished on iOS/Android - the defect plan 216 item 1 fixes. The whole
 * `/pro` batch surface, multi-edit "Download all", Projects "Render selection" and
 * the catalogue image ZIP all reach delivery through this one function, so this
 * single change carries all of them onto the overridable path at once.
 *
 * `getHostRef()` is null only before the bridge is built (unit tests, a very early
 * boot); there we fall back to the bridge's own anchor helper - kept in bridge/ so
 * the guard test's "no raw anchor outside bridge/" rule holds. Async because the
 * native save is; callers that don't await still get the file, they just don't
 * observe completion.
 */
export async function saveBlob(blob: Blob, filename: string): Promise<void> {
  const host = getHostRef();
  if (host?.export?.download) { await host.export.download(blob, filename); return; }
  (await import('../bridge/export.ts')).anchorSave(blob, filename);
}

/**
 * Fallback delivery: save each file individually, spaced out so the browser
 * doesn't drop downloads in a burst. Resolves when all are dispatched.
 */
export async function saveSequential(
  files: Array<{ name: string; blob: Blob }>,
  { delayMs = 600, onSaved }: { delayMs?: number; onSaved?: (done: number, total: number) => void } = {},
): Promise<void> {
  for (let i = 0; i < files.length; i++) {
    await saveBlob(files[i]!.blob, files[i]!.name);
    onSaved?.(i + 1, files.length);
    if (i < files.length - 1) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}
