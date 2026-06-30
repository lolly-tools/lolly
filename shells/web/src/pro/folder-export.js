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
import { planBatch } from './batch.js';
import { runBatchWithProgress } from './run-overlay.js';
import { rowsForFolder, slug } from './folder-rows.js';

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
