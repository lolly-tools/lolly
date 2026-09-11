// SPDX-License-Identifier: MPL-2.0
/**
 * Unified "data source" input affordance (plan 87, Phase 1).
 *
 * ONE component that lets a field pull its content from a picked file OR a catalog
 * text/boilerplate asset, replacing the scattered per-tool "paste your CSV here"
 * instructions and one-off paste buttons. Phase 1 covers the text/longtext target
 * (the value is a plain string) and the file + catalog-text sources; the xlsx
 * sheet-picker (Phase 2) and the blocks/table targets + verbatim-data assets
 * (Phase 3) build on the same seam. See plans/87-unified-data-source-input.md.
 *
 * The pure core (`rowsToCsv`, `fileBytesToFieldText`) is unit-tested; `openDataSource`
 * is the thin DOM/host glue.
 */

import { readXlsx, listXlsxSheets, rowsToCsv } from '@lolly/engine';
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { choiceDialog } from '../components/confirm-dialog.ts';

// ── pure core ────────────────────────────────────────────────────────────────

// The RFC-4180 grid→CSV serialiser is the engine's `rowsToCsv` (shared with the CLI so
// both convert a spreadsheet identically); re-exported here for callers/tests.
export { rowsToCsv };

/** The office packages that decode to Markdown rather than to their raw bytes. */
const OFFICE_DOC_RE = /\.(pptx|docx)$/i;

/**
 * Decode a picked data file to the text a text/longtext field receives. An `.xlsx` is
 * unzipped and serialised to CSV - reading `sheet` (a 0-based index or exact name;
 * default the first sheet); a `.pptx`/`.docx` is extracted to Markdown (its images
 * are dropped - a text field holds text); every other file is decoded as UTF-8 text.
 * Throws the engine's message on an unreadable file so the caller can surface it.
 */
export async function fileBytesToFieldText(
  bytes: Uint8Array,
  filename: string,
  sheet?: number | string,
): Promise<string> {
  if (/\.xlsx$/i.test(filename)) {
    const { rows } = readXlsx(bytes, sheet !== undefined ? { sheet } : {});
    return rowsToCsv(rows);
  }
  if (OFFICE_DOC_RE.test(filename)) {
    // Lazy: the extractor pulls fflate plus the engine deck/document readers, and a
    // csv/txt pick must not pay for them.
    const { officeToMarkdown } = await import('./office-text.ts');
    return (await officeToMarkdown(bytes, filename)).markdown;
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Resolve picked bytes to field text, asking which worksheet when an `.xlsx` has more
 * than one (the sheet-picker). Returns null when the user cancels the sheet chooser.
 * Non-xlsx files decode straight through.
 */
export async function bytesToFieldTextInteractive(
  bytes: Uint8Array,
  filename: string,
  announce: (m: string, o?: { assertive?: boolean }) => void = () => {},
): Promise<string | null> {
  // A deck/document reaches the field as Markdown. Its images cannot ride into a
  // text input, so a document that had some says what was left behind.
  if (OFFICE_DOC_RE.test(filename)) {
    const { officeToMarkdown } = await import('./office-text.ts');
    const { markdown, media } = await officeToMarkdown(bytes, filename);
    if (media.length) announce('Only the text came across - the images were left out.');
    return markdown;
  }
  if (/\.xlsx$/i.test(filename)) {
    let sheet: number | undefined;
    try {
      const sheets = listXlsxSheets(bytes);
      if (sheets.length > 1) {
        const pick = await choiceDialog({
          title: 'Which sheet?',
          message: `“${filename}” has ${sheets.length} sheets - pick one.`,
          choices: sheets.map((s) => ({ id: String(s.index), label: s.name })),
        });
        if (pick == null) return null; // cancelled
        sheet = Number(pick);
      }
    } catch {
      /* not enumerable - fall through to the first-sheet read */
    }
    return fileBytesToFieldText(bytes, filename, sheet);
  }
  return fileBytesToFieldText(bytes, filename);
}

/** The default accept string for a text-target data source. */
export const DATA_SOURCE_ACCEPT =
  '.csv,.json,.txt,.md,.markdown,.xlsx,.pptx,.docx,text/plain,text/markdown,text/csv,application/json,'
  + 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,'
  + 'application/vnd.openxmlformats-officedocument.presentationml.presentation,'
  + 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// ── the component ────────────────────────────────────────────────────────────

/** The minimal host surface the picker needs. */
export interface DataSourceHost {
  assets: { query(filter: { type?: string; tags?: string[] }): Promise<AssetRef[]> };
}

export interface DataSourceOpts {
  /** File-input accept string (defaults to DATA_SOURCE_ACCEPT). */
  accept?: string;
  /** Catalog text-asset tags to offer from the library (AND-matched). Default ['boilerplate']. */
  tags?: string[];
  /** Applied with the resolved text. */
  onText: (text: string) => void;
  /** User-facing error channel. */
  announce?: (msg: string, opts?: { assertive?: boolean }) => void;
}

const assetLabel = (a: AssetRef): string =>
  (typeof a.meta?.name === 'string' && a.meta.name) || a.id.split('/').pop() || a.id;

/**
 * Offer the applicable sources - a device file always, plus stored library assets when
 * present: text/boilerplate assets (by `tags`) and every `type:'data'` spreadsheet/CSV
 * asset. Resolve the choice to text (an xlsx via the sheet-picker) and hand it to
 * `onText`. With only the file source, opens the file picker directly (no chooser).
 */
export async function openDataSource(host: DataSourceHost, opts: DataSourceOpts): Promise<void> {
  const announce = opts.announce ?? (() => {});
  const tags = opts.tags ?? ['boilerplate'];

  const library: AssetRef[] = [];
  try { library.push(...await host.assets.query({ type: 'text', tags })); } catch { /* none */ }
  try { library.push(...await host.assets.query({ type: 'data' })); } catch { /* none */ }

  const choices: { id: string; label: string; primary?: boolean }[] = [{ id: 'file', label: 'Choose a file', primary: true }];
  if (library.length) choices.push({ id: 'library', label: 'From your library' });

  const pick = choices.length === 1
    ? 'file'
    : await choiceDialog({ title: 'Add data', message: 'Where should the data come from?', choices });
  if (!pick) return;

  if (pick === 'file') {
    const text = await pickFileText(opts.accept ?? DATA_SOURCE_ACCEPT, announce);
    if (text != null) opts.onText(text);
    return;
  }

  const chosen = await choiceDialog({
    title: 'From your library',
    message: 'Pick a saved data or text asset.',
    choices: library.map((a) => ({ id: a.id, label: assetLabel(a) })),
  });
  if (!chosen) return;
  const asset = library.find((a) => a.id === chosen);
  if (!asset?.url) return;
  try {
    if (asset.type === 'data') {
      // A spreadsheet/CSV asset - read its bytes, xlsx through the sheet-picker.
      const bytes = new Uint8Array(await (await fetch(asset.url)).arrayBuffer());
      const text = await bytesToFieldTextInteractive(bytes, `data.${asset.format || 'csv'}`, announce);
      if (text != null) opts.onText(text);
      return;
    }
    opts.onText(await (await fetch(asset.url)).text());
  } catch {
    announce('Could not read that library item.', { assertive: true });
  }
}

/** Open a hidden file input, read the chosen file, return its field-text (or null on
 *  cancel/error). A cancelled OS dialog fires no event, so the promise simply never
 *  resolves - harmless, since callers do not block on it (the established
 *  hidden-input pattern in this codebase). */
function pickFileText(
  accept: string,
  announce: (m: string, o?: { assertive?: boolean }) => void,
): Promise<string | null> {
  return new Promise((resolve) => {
    const native = document.createElement('input');
    native.type = 'file';
    native.accept = accept;
    native.style.display = 'none';
    document.body.appendChild(native);
    native.addEventListener('change', async () => {
      const file = native.files?.[0];
      native.remove();
      if (!file) return resolve(null);
      try {
        resolve(await bytesToFieldTextInteractive(new Uint8Array(await file.arrayBuffer()), file.name, announce));
      } catch (e) {
        announce((e as { message?: string })?.message || 'Could not read that file.', { assertive: true });
        resolve(null);
      }
    }, { once: true });
    native.click();
  });
}
