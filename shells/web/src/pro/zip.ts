// SPDX-License-Identifier: MPL-2.0
/**
 * Pro / Batch mode — packaging rendered blobs for delivery.
 *
 * Primary path: bundle everything into a single .zip (fflate, all in-browser,
 * no network). Fallback path: if zipping fails (or the caller chooses), trigger
 * downloads one at a time with a delay so the browser reliably accepts the
 * burst of saves — some browsers drop rapid-fire programmatic downloads.
 */
import { zip, zipSync, strToU8, type Zippable } from 'fflate';

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
export interface ZipAuthor {
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
  zip: '📦', pdf: '📕', txt: '📄', md: '📃',
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
  jpeg: 'JPG', jpg: 'JPG', md: 'Markdown', txt: 'Text', ico: 'Icon', vcf: 'vCard', ics: 'Calendar',
};
const fmtLabel = (f?: string): string => (f ? (FMT_LABEL[f] ?? String(f).toUpperCase()) : '');

const HEADER = '📐 Lolly  •  ❤️ Give Fitzy an Ovation  •  🌏 https://lolly.tools';

// The one-line-per-file manifest baked into `lolly.txt`. The END carries the
// zip name + author.
function creditText(files: ManifestFile[] = [], { zipName, author }: ZipMeta = {}): string {
  const now = new Date();
  const date = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const time = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  const n = files.length;
  const pkg = (zipName || 'lolly-batch.zip').trim();

  // Author line — name / email / phone from the profile, when present.
  const name = [author?.firstname, author?.lastname].filter(Boolean).join(' ');
  const authorLine = [name, author?.email, author?.phone].filter(Boolean).join(' | ');

  // One scannable line per file: "icon name | FORMAT · render time". No link here —
  // the reopen links live in their own list at the end (see below).
  const fileLines = files.map(f => {
    const secs = f.ms != null ? `${(f.ms / 1000).toFixed(2)}s to render` : '';
    const meta = [fmtLabel(f.fmt), secs].filter(Boolean).join('  ·  ');
    return `${iconFor(f)} ${f.name}${meta ? `   |  ${meta}` : ''}`;
  });

  // Reopen links, listed at the very end as "filename - url", one per file we could
  // build a link for. Each reopens the tool in Lolly with the exact inputs used.
  const linkLines = files.filter(f => f.url).map(f => `${f.name} - ${f.url}`);

  const lines = [
    HEADER,
    '-'.repeat(56),
    '',
    '',
    `[[ 📦 ${pkg} ]]`,
  ];

  // Author sits right under the package name.
  if (authorLine) {
    lines.push('', '[ Author Information ]', '', authorLine);
  }

  lines.push(
    '',
    `Created on ${date} at ${time} (local)`,
    '',
    '',
    `[ ${n} file${n === 1 ? '' : 's'} included ]`,
    '',
    ...fileLines,
  );

  // Reopen links, gathered at the end.
  if (linkLines.length) {
    lines.push(
      '',
      '',
      '[ Links ]',
      '',
      'Each link reopens the tool in Lolly with the exact inputs used —',
      'follow it to recreate or tweak the file at lolly.tools.',
      '',
      ...linkLines,
    );
  }

  return lines.join('\n') + '\n';
}

/**
 * Build a single zip Blob from [{ name, blob, ms }] entries.
 * @param files
 * @param meta package name + author profile (for the `lolly.txt` manifest) and,
 *        optionally, the batch settings as CSV (bundled so the run is reproducible).
 */
export async function buildZip(files: ZipFile[], meta: ZipMeta = {}): Promise<Blob> {
  const entries: Zippable = {};
  for (const f of files) {
    const bytes = new Uint8Array(await f.blob.arrayBuffer());
    const level = STORE_EXT.has(extOf(f.name)) ? 0 : 6;
    entries[f.name] = [bytes, { level }];
  }
  entries['lolly.txt'] = [strToU8(creditText(files, meta)), { level: 6 }];
  // The settings that produced this batch — re-importable via Sessions ▸ Upload CSV.
  if (meta.csv) entries['lolly-batch.csv'] = [strToU8(meta.csv), { level: 6 }];
  const zipped = await zipAsync(entries);
  return new Blob([zipped], { type: 'application/zip' });
}

// Zip off the main thread: fflate's async zip spins up a Worker, so packaging a
// large batch (hundreds of PNGs/PDFs) no longer freezes the tab the way zipSync
// did. The bytes are identical to the synchronous zipper. Falls back to zipSync
// where Workers aren't available (e.g. some embedded WebViews), so behaviour is
// preserved everywhere.
function zipAsync(entries: Zippable): Promise<Uint8Array<ArrayBuffer>> {
  if (typeof Worker === 'undefined') return Promise.resolve(zipSync(entries));
  return new Promise((resolve, reject) => {
    zip(entries, (err, data) => (err ? reject(err) : resolve(data)));
  });
}

/** Save a single Blob via a transient object-URL anchor. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
    const f = files[i];
    if (!f) continue;
    saveBlob(f.blob, f.name);
    onSaved?.(i + 1, files.length);
    if (i < files.length - 1) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}
