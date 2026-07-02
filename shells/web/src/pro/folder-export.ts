// SPDX-License-Identifier: MPL-2.0
/**
 * Pro / Batch mode — render a whole folder (group) as one batch.
 *
 * A folder collects saved sessions. Each session contributes rows to one combined
 * batch run that delivers a single zip with a nested folder tree:
 *   - a batch session (a subgroup) contributes ALL its rows, under
 *     `<group>/<subgroup>/…`
 *   - a single-tool session contributes one row, under `<group>/…`
 *
 * Row assembly is the pure logic in ./folder-rows.js (also used by pro/index.js to
 * flatten a folder into the grid). This module adds the planning + run shell, so it
 * is the part lazy-loaded by the shared overlay at export time, behind the
 * pro-batch flag.
 */
import { escape } from '../utils.ts';
import { planBatch, runBatch, type BatchFile } from './batch.ts';
import { runBatchWithProgress, type RunBatchProgressResult } from './run-overlay.ts';
import { rowsForFolder, rowFromToolSession, rowFromBatchRow, slug, type Folder, type StoredSession } from './folder-rows.ts';
import { isBatchSlot } from '../batch-slots.ts';
import type { RuntimeHost, Unit } from '@lolly/engine';

/**
 * What folder export actually needs from the host: everything a runtime mount
 * needs (RuntimeHost — runBatch mounts real runtimes), plus reading saved
 * sessions and delivering the zip. Deliberately NOT HostV1: the folder overlay
 * forwards a narrow host slice, and this type states the true requirement.
 */
export type FolderExportHost = RuntimeHost & {
  state: { load(slot: string): Promise<Record<string, unknown> | null> };
  export: NonNullable<RuntimeHost['export']> & { download(blob: Blob, filename: string): void };
};
import type { ZipAuthor } from './zip.ts';

export { rowsForFolder, rowFromToolSession, rowFromBatchRow } from './folder-rows.ts';

/** Narrow an untrusted stored value to a string. */
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

/** Options for exporting a whole folder. */
interface ExportFolderOpts {
  mount: HTMLElement;
  author?: ZipAuthor | null;
  format?: string;
  unit?: Unit;
  dpi?: number;
  /** Full folder list — lets rowsForFolder recurse into sub-folders. */
  folders?: Folder[] | null;
  onBatchRendered?: (files: BatchFile[]) => void;
  announce?: (msg: string) => void;
}

/**
 * Render a folder as one batch and deliver a single nested zip.
 */
export async function exportFolderAsBatch(
  host: FolderExportHost,
  folder: Folder,
  {
    mount, author = null, format = 'png', unit = 'px', dpi = 300, folders = null, onBatchRendered, announce,
  }: ExportFolderOpts,
): Promise<RunBatchProgressResult> {
  // `folders` (the full list) lets rowsForFolder recurse into sub-folders so a nested
  // tree exports under nested zip paths; omit it and only this folder's own sessions go.
  const rows = await rowsForFolder(host, folder, folders);
  if (rows.length === 0) throw new Error('Nothing to export — this folder has no renderable sessions.');

  const { renderable, skipped } = await planBatch(rows);
  if (renderable.length === 0) throw new Error('Nothing to export — none of these sessions can be rendered.');

  return runBatchWithProgress(host, renderable, {
    mount,
    format, unit, dpi,
    pathAware: true,
    zipBaseName: slug(folder.name) || 'lolly-folder',
    author,
    skipped,
    onBatchRendered,
    announce,
  });
}

/** Options for rendering a single saved session to a file. */
interface RenderSessionOpts {
  mount: HTMLElement;
  author?: ZipAuthor | null;
  onBatchRendered?: (files: BatchFile[]) => void;
}

/**
 * Render ONE saved single-tool session and download it as a BARE file — its native
 * format + filename, matching the tool's own Export button, NOT a one-item zip.
 * `runBatch` prepends a `NN-` sequence prefix even for a lone row, so we strip it and
 * deliver the single blob via host.export.download. A BATCH session (many rows) can't
 * be one file, so it falls back to the folder/zip path.
 */
export async function renderSessionToFile(
  host: FolderExportHost,
  slot: string,
  { mount, author = null, onBatchRendered }: RenderSessionOpts,
): Promise<RunBatchProgressResult | { files: BatchFile[]; name: string }> {
  const data: StoredSession | null = await host.state.load(slot);
  if (!data) throw new Error('This saved session could not be loaded.');
  // A batch session expands to many rows → no single bare file; render its rows directly
  // under ONE label level (going via a same-named synthetic folder would double-nest the
  // label in the zip). Delivered as a zip by runBatchWithProgress.
  if (data.__batch || isBatchSlot(slot)) {
    const label = str(data.__label) || 'Batch session';
    const snapshotRows = Array.isArray(data.rows) ? data.rows : [];
    const batchRows = snapshotRows.filter(r => r.toolId).map(r => rowFromBatchRow(r, [label]));
    if (batchRows.length === 0) throw new Error('This batch session has no renderable rows.');
    const plan = await planBatch(batchRows);
    if (plan.renderable.length === 0) throw new Error(plan.skipped[0]?.reason || 'This batch session can’t be rendered.');
    return runBatchWithProgress(host, plan.renderable, {
      mount, pathAware: true, zipBaseName: slug(label) || 'lolly-batch',
      author, skipped: plan.skipped, onBatchRendered,
    });
  }
  const row = rowFromToolSession(data);
  const { renderable, skipped } = await planBatch([row]);
  if (renderable.length === 0) throw new Error(skipped[0]?.reason || 'This session can’t be rendered to a file.');
  if (mount) mount.innerHTML = `<p class="pro-progress-msg"><strong>Rendering…</strong></p>`;
  const { files } = await runBatch(renderable, host, { isCancelled: () => false, onProgress: () => {} });
  if (files.length === 0) throw new Error('No file was produced.');
  onBatchRendered?.(files);
  const file = files[0];
  if (!file) throw new Error('No file was produced.');
  const name = file.name.replace(/^\d+-/, '');   // strip runBatch's sequence prefix → bare name
  host.export.download(file.blob, name);
  if (mount) mount.innerHTML = `<p class="pro-progress-msg"><strong>Downloaded ${escape(name)}.</strong></p>`;
  return { files, name };
}

/** Options for exporting an arbitrary selection of sessions + folders. */
interface ExportSelectionOpts {
  label?: string;
  sessionRefs?: string[];
  folderIds?: string[];
  allFolders?: Folder[];
  mount: HTMLElement;
  author?: ZipAuthor | null;
  onBatchRendered?: (files: BatchFile[]) => void;
  announce?: (msg: string) => void;
}

/**
 * Render an arbitrary SELECTION — any mix of loose sessions and whole folders — as one
 * nested zip. The synthetic-parent + `allFolders` recursion trick does NOT compose
 * (rowsForFolder recurses on real `parentId===folder.id`, which a synthetic parent
 * lacks), so we CONCATENATE `rowsForFolder` calls: one synthetic bucket for the loose
 * sessions, then each selected folder's subtree nested under `[label]`.
 */
export async function exportSelectionAsBatch(
  host: FolderExportHost,
  {
    label = 'Selection', sessionRefs = [], folderIds = [], allFolders = [],
    mount, author = null, onBatchRendered, announce,
  }: ExportSelectionOpts,
): Promise<RunBatchProgressResult> {
  const rows = [];
  if (sessionRefs.length) {
    rows.push(...await rowsForFolder(host, { name: label, items: sessionRefs.map(ref => ({ type: 'session', ref })) }, null));
  }
  for (const fid of folderIds) {
    const folder = allFolders.find(f => f.id === fid);
    if (folder) rows.push(...await rowsForFolder(host, folder, allFolders, [label]));
  }
  if (rows.length === 0) throw new Error('Nothing in the selection can be rendered.');

  const { renderable, skipped } = await planBatch(rows);
  if (renderable.length === 0) throw new Error('None of the selected items can be rendered.');

  return runBatchWithProgress(host, renderable, {
    mount, pathAware: true,
    zipBaseName: slug(label) || 'lolly-selection',
    author, skipped, onBatchRendered, announce,
  });
}
