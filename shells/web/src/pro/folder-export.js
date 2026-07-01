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
import { escape } from '../utils.js';
import { planBatch, runBatch } from './batch.js';
import { runBatchWithProgress } from './run-overlay.js';
import { rowsForFolder, rowFromToolSession, rowFromBatchRow, slug } from './folder-rows.js';
import { isBatchSlot } from '../folder-tiles.js';

export { rowsForFolder, rowFromToolSession, rowFromBatchRow } from './folder-rows.js';

/**
 * Render a folder as one batch and deliver a single nested zip.
 *
 * @param {HostV1} host
 * @param {Folder} folder
 * @param {object} opts  { mount, author, format, unit, dpi, onBatchRendered, announce }
 * @returns {Promise<{files, results, cancelled}>}
 */
export async function exportFolderAsBatch(host, folder, {
  mount, author = null, format = 'png', unit = 'px', dpi = 300, folders = null, onBatchRendered, announce,
} = {}) {
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

/**
 * Render ONE saved single-tool session and download it as a BARE file — its native
 * format + filename, matching the tool's own Export button, NOT a one-item zip.
 * `runBatch` prepends a `NN-` sequence prefix even for a lone row, so we strip it and
 * deliver the single blob via host.export.download. A BATCH session (many rows) can't
 * be one file, so it falls back to the folder/zip path.
 *
 * @param {HostV1} host
 * @param {string} slot   host.state slot of the saved session
 * @param {object} opts   { mount, author, onBatchRendered }
 */
export async function renderSessionToFile(host, slot, { mount, author = null, onBatchRendered } = {}) {
  const data = await host.state.load(slot);
  if (!data) throw new Error('This saved session could not be loaded.');
  // A batch session expands to many rows → no single bare file; render its rows directly
  // under ONE label level (going via a same-named synthetic folder would double-nest the
  // label in the zip). Delivered as a zip by runBatchWithProgress.
  if (data.__batch || isBatchSlot(slot)) {
    const label = data.__label || 'Batch session';
    const batchRows = (data.rows ?? []).filter(r => r.toolId).map(r => rowFromBatchRow(r, [label]));
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
  const name = file.name.replace(/^\d+-/, '');   // strip runBatch's sequence prefix → bare name
  host.export.download(file.blob, name);
  if (mount) mount.innerHTML = `<p class="pro-progress-msg"><strong>Downloaded ${escape(name)}.</strong></p>`;
  return { files, name };
}

/**
 * Render an arbitrary SELECTION — any mix of loose sessions and whole folders — as one
 * nested zip. The synthetic-parent + `allFolders` recursion trick does NOT compose
 * (rowsForFolder recurses on real `parentId===folder.id`, which a synthetic parent
 * lacks), so we CONCATENATE `rowsForFolder` calls: one synthetic bucket for the loose
 * sessions, then each selected folder's subtree nested under `[label]`.
 *
 * @param {HostV1} host
 * @param {object} opts { label, sessionRefs[], folderIds[], allFolders[], mount, author, onBatchRendered, announce }
 */
export async function exportSelectionAsBatch(host, {
  label = 'Selection', sessionRefs = [], folderIds = [], allFolders = [],
  mount, author = null, onBatchRendered, announce,
} = {}) {
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
