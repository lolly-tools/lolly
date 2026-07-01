// SPDX-License-Identifier: MPL-2.0
/**
 * Pro / Batch mode — packaging of rendered blobs for delivery.
 *
 * Primary path: bundle everything into a single .zip (fflate, all in-browser,
 * no network). Fallback path: if zipping fails (or the caller chooses), trigger
 * the downloads one at a time with a delay so the browser reliably accepts a
 * burst of saves — some browsers drop rapid-fire programmatic downloads.
 */
import { zip, zipSync, strToU8 } from 'fflate';

// Already-compressed payloads gain nothing from deflate and cost CPU, so store
// them (level 0). Text-ish formats compress well, so deflate them (level 6).
const STORE_EXT = new Set(['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'pdf', 'webm', 'mp4']);

function extOf(name) {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

// A glyph per output kind, picked by file extension. Unknown kinds get ⚠️.
const ICONS = {
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
const FORMAT_ICONS = { 'pdf-cmyk': '🖨️', 'eps-cmyk': '🖨️' };
const iconFor = (f) => FORMAT_ICONS[f.fmt] ?? ICONS[extOf(f.name)] ?? '⚠️';

// Friendly format names for the manifest (mirrors the subset the UI shows).
const FMT_LABEL = {
  'pdf-cmyk': 'Print PDF', 'cmyk-tiff': 'Print TIFF', 'eps-cmyk': 'EPS (CMYK)',
  jpeg: 'JPG', jpg: 'JPG', md: 'Markdown', txt: 'Text', ico: 'Icon', vcf: 'vCard', ics: 'Calendar',
};
const fmtLabel = (f) => (f ? (FMT_LABEL[f] ?? String(f).toUpperCase()) : '');

const HEADER = '📐 Lolly  •  ❤️ Give Fitzy an Ovation  •  🌏 https://lolly.tools';

// The little manifest dropped into every batch zip. Lists each file with its
// render time, the package name, a local timestamp, and (if set) the author's
// profile. `files` is [{ name, ms }]; opts carries the zip name + author.
function creditText(files = [], { zipName, author } = {}) {
  const now = new Date();
  const date = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const time = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });

  const n = files.length;
  const pkg = (zipName || 'lolly-batch.zip').trim();

  // Each file is a two-line block: "name | FORMAT · render time", then a "reopen in
  // Lolly" link carrying the exact inputs used, so a recipient can return to
  // lolly.tools and recreate (or tweak) the file. Blocks are blank-line separated so
  // the links stay readable. The link is omitted for any file we couldn't build one
  // for (falls back to the plain header line).
  const fileBlocks = files.map(f => {
    const secs = f.ms != null ? `${(f.ms / 1000).toFixed(2)}s to render` : '';
    const meta = [fmtLabel(f.fmt), secs].filter(Boolean).join('  ·  ');
    const head = `${iconFor(f)} ${f.name}${meta ? `   |  ${meta}` : ''}`;
    return f.url ? `${head}\n   ↳ ${f.url}` : head;
  });
  const anyUrl = files.some(f => f.url);

  const lines = [
    HEADER,
    '-'.repeat(56),
    '',
    '',
    `[[ 📦 ${pkg} ]]`,
    '',
    `Created on ${date} at ${time} (local)`,
    '',
    '',
    `[ ${n} file${n === 1 ? '' : 's'} included ]`,
    '',
    // Explain the ↳ links once, up front — the whole point of them.
    ...(anyUrl ? [
      'Each ↳ link reopens the tool in Lolly with the exact inputs used —',
      'follow it to recreate or tweak the file at lolly.tools.',
      '',
    ] : []),
    fileBlocks.join('\n\n'),
  ];

  // Author block — only when the profile has something to show.
  const name = [author?.firstname, author?.lastname].filter(Boolean).join(' ');
  const authorLine = [name, author?.email, author?.phone].filter(Boolean).join(' | ');
  if (authorLine) {
    lines.push('', '', '', '[ Author Information ]', '', authorLine);
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
export async function buildZip(files, meta = {}) {
  const entries = {};
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
function zipAsync(entries) {
  if (typeof Worker === 'undefined') return Promise.resolve(zipSync(entries));
  return new Promise((resolve, reject) => {
    zip(entries, (err, data) => (err ? reject(err) : resolve(data)));
  });
}

/** Save a single Blob via a transient object-URL anchor. */
export function saveBlob(blob, filename) {
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
export async function saveSequential(files, { delayMs = 600, onSaved } = {}) {
  for (let i = 0; i < files.length; i++) {
    saveBlob(files[i].blob, files[i].name);
    onSaved?.(i + 1, files.length);
    if (i < files.length - 1) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}
