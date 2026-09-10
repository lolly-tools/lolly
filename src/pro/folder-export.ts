// SPDX-License-Identifier: MPL-2.0
/**
 * Pro / Batch mode - render a whole folder (group) as one batch.
 *
 * A folder collects saved sessions. Each session contributes rows to one combined
 * batch run that delivers a single zip with a nested folder tree:
 *   - a batch session (a subgroup) contributes ALL its rows, under
 *     `<group>/<subgroup>/…`
 *   - a single-tool session contributes one row, under `<group>/…`
 *
 * Row assembly is the pure logic in ./folder-rows.js (also used by pro/index.js to
 * flatten a folder into the grid). This module adds the planning + run shell, so it
 * is the part lazy-loaded by the shared overlay at export time (Batch export, now
 * available to everyone - the pro-batch flag was retired).
 */
import { planBatch, runBatch, notesFromFindings } from './batch.ts';
import { runBatchWithProgress } from './run-overlay.ts';
import { playSfx } from '../lib/sfx.ts';
import { deliverFile } from '../lib/deliver-file.ts';
import { attachDeliveryResult, releaseDeliveryFor } from '../lib/download-recovery.ts';
import type { ZipTier } from '@lolly/engine';
import { createBatchRowCheck, skippedFindings } from './preflight-rows.ts';
import { rowsForFolder, rowFromToolSession, rowFromBatchRow, slug, isMotionRow } from './folder-rows.ts';
import type { Finding } from '@lolly/engine';
import { isBatchSlot } from '../folder-tiles.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { JobHandle } from '../lib/jobs.ts';
import type { BatchRow, BatchFile } from './batch.ts';
import type { ExportRow } from './folder-rows.ts';

export { rowsForFolder, rowFromToolSession, rowFromBatchRow } from './folder-rows.ts';

/**
 * The host slice this module needs: a full runtime host (HostV1 - runBatch mounts
 * real runtimes), with `state.load` loosened to `any` so untrusted stored-session
 * objects read freely, exactly as the original untyped JS did. Erased at runtime.
 */
type FolderExportHost = Omit<HostV1, 'state'> & {
  state: Omit<HostV1['state'], 'load'> & { load(slot: string): Promise<any> };
};

/**
 * Structural mirror of run-overlay's (non-exported) BatchAuthor - the zip credit
 * block shape. Used only to cast the loosely-typed `author` option at the call
 * boundary; erased at runtime.
 */
interface BatchAuthor {
  firstname?: string;
  lastname?: string;
  email?: string;
  phone?: string;
}

/** A saved folder (group) of sessions/assets. */
interface FolderItem {
  type: string;
  ref: string;
}
interface Folder {
  id?: string;
  name: string;
  parentId?: string | null;
  items?: FolderItem[];
}

/** Options for {@link exportFolderAsBatch}. */
interface ExportFolderOpts {
  mount?: HTMLElement;
  /** The caller's WP-F job (lib/batch-job.ts), threaded into the run. */
  job?: JobHandle;
  /** Passed straight through to the run overlay / zip packer. */
  author?: unknown;
  format?: string;
  unit?: string;
  dpi?: number;
  folders?: Folder[] | null;
  onBatchRendered?: (files: BatchFile[]) => void;
  announce?: (msg: string) => void;
  /** AES-256 lock for any pdf/pdf-cmyk members (defense-in-depth inside a locked zip). */
  strongPassword?: string;
  /** Whole-zip encryption tier (uses the same password). */
  zipLock?: ZipTier;
}

/** Options for {@link renderSessionToFile}. */
interface RenderSessionOpts {
  mount?: HTMLElement;
  /** The caller's WP-F job (lib/batch-job.ts), threaded into the run. */
  job?: JobHandle;
  author?: unknown;
  onBatchRendered?: (files: BatchFile[]) => void;
}

/** Options for {@link exportSelectionAsBatch}. */
interface ExportSelectionOpts {
  label?: string;
  sessionRefs?: string[];
  folderIds?: string[];
  allFolders?: Folder[];
  mount?: HTMLElement;
  /** The caller's WP-F job (lib/batch-job.ts), threaded into the run. */
  job?: JobHandle;
  author?: unknown;
  onBatchRendered?: (files: BatchFile[]) => void;
  announce?: (msg: string) => void;
  /** AES-256 lock for any pdf/pdf-cmyk members (defense-in-depth inside a locked zip). */
  strongPassword?: string;
  /** Whole-zip encryption tier (uses the same password). */
  zipLock?: ZipTier;
  /**
   * Called ONCE, after the rows are assembled but before any render, IFF the selection
   * contains motion/video rows (webm/mp4/gif/apng - real-time captures that need the tab
   * kept active). Returns how to proceed: `'include'` renders them (the caller has
   * committed to keeping the tab active), `'skip'` drops them and renders the rest,
   * `'cancel'` aborts. Omit → render everything (unchanged behaviour, no prompt).
   */
  onMotionFound?: (count: number) => Promise<'include' | 'skip' | 'cancel'>;
}

/**
 * Render a folder as one batch and deliver a single nested zip.
 *
 * @param {HostV1} host
 * @param {Folder} folder
 * @param {object} opts  { mount, author, format, unit, dpi, onBatchRendered, announce }
 * @returns {Promise<{files, results, cancelled}>}
 */
export async function exportFolderAsBatch(host: FolderExportHost, folder: Folder, {
  mount, job, author = null, format = 'png', unit = 'px', dpi = 300, folders = null, onBatchRendered, announce, strongPassword, zipLock,
}: ExportFolderOpts = {}) {
  // `folders` (the full list) lets rowsForFolder recurse into sub-folders so a nested
  // tree exports under nested zip paths; omit it and only this folder's own sessions go.
  const rows = await rowsForFolder(host, folder, folders);
  if (rows.length === 0) throw new Error('Nothing to export - this folder has no renderable sessions.');

  // `srcIndex` rides along from here on: planBatch COMPACTS, so an index taken after it
  // no longer names the row the user assembled. Source space here is rowsForFolder's
  // output - rows the user sees as session names and folder paths, not as numbers, so
  // the overlay leads with the row's label and keeps the number as context.
  // The static pre-pass, with the SAME run-level settings the run below is given.
  // A folder row carries its own print settings (rowFromToolSession / rowFromBatchRow
  // map all three), and `printSettingsFor` resolves row-beats-run identically here
  // and at the render boundary.
  const { check, runFindings } = await createBatchRowCheck(rows as BatchRow[], host, { format, unit, dpi });
  const plan = await planBatch<Finding>(rows as BatchRow[], { check });
  const { renderable, skipped, srcIndex, findings } = plan;
  if (renderable.length === 0) throw new Error('Nothing to export - none of these sessions can be rendered.');

  return runBatchWithProgress(host, renderable, {
    mount, job,
    format, unit, dpi,
    srcIndex,
    // Per-row preflight findings, keyed by queue position. A skipped row has no queue
    // position, so its findings travel by identity; the run-invariant ones are emitted
    // once rather than against every row.
    notes: notesFromFindings(findings, renderable.length),
    skippedFindings: skippedFindings(plan),
    runFindings,
    pathAware: true,
    zipBaseName: slug(folder.name) || 'lolly-folder',
    author: author as BatchAuthor | null,
    skipped,
    onBatchRendered,
    announce,
    strongPassword, zipLock,
  });
}

/**
 * Render ONE saved single-tool session and download it as a BARE file - its native
 * format + filename, matching the tool's own Export button, NOT a one-item zip.
 * `runBatch` prepends a `NN-` sequence prefix even for a lone row, so we strip it and
 * deliver the single blob via host.export.download. A BATCH session (many rows) can't
 * be one file, so it falls back to the folder/zip path.
 *
 * @param {HostV1} host
 * @param {string} slot   host.state slot of the saved session
 * @param {object} opts   { mount, author, onBatchRendered }
 */
export async function renderSessionToFile(host: FolderExportHost, slot: string, { mount, job, author = null, onBatchRendered }: RenderSessionOpts = {}) {
  const data = await host.state.load(slot);
  if (!data) throw new Error('This saved session could not be loaded.');
  // A batch session expands to many rows → no single bare file; render its rows directly
  // under ONE label level (going via a same-named synthetic folder would double-nest the
  // label in the zip). Delivered as a zip by runBatchWithProgress.
  if (data.__batch || isBatchSlot(slot)) {
    const label = data.__label || 'Batch session';
    // EVERY snapshot row goes to planBatch - including the ones with no template. They
    // used to be filtered out here, which silently renumbered every row after them and
    // deleted them from the run report: the same session rendered from the /pro grid
    // said "2 rows skipped, qr-code is row 3", and rendered from Projects said nothing
    // was skipped and called the same row "row 1". planBatch already drops a template-less
    // row with the reason 'No template selected', keeping its source position and uid.
    const batchRows = (data.rows ?? []).map((r: any) => rowFromBatchRow(r, [label]));
    if (batchRows.length === 0) throw new Error('This batch session has no renderable rows.');
    // No run-level format/unit/dpi on this path: a batch snapshot's rows carry their
    // own, and `runBatchWithProgress` is called without them below - so the collector
    // is handed the same empty run block the renderer works from.
    const snapshotCheck = await createBatchRowCheck(batchRows as BatchRow[], host, {});
    const plan = await planBatch<Finding>(batchRows as BatchRow[], { check: snapshotCheck.check });
    if (plan.renderable.length === 0) throw new Error(plan.skipped[0]?.reason || 'This batch session can’t be rendered.');
    return runBatchWithProgress(host, plan.renderable, {
      mount, job, pathAware: true, zipBaseName: slug(label) || 'lolly-batch',
      author: author as BatchAuthor | null, skipped: plan.skipped, srcIndex: plan.srcIndex,
      notes: notesFromFindings(plan.findings, plan.renderable.length), onBatchRendered,
      skippedFindings: skippedFindings(plan), runFindings: snapshotCheck.runFindings,
    });
  }
  const row = rowFromToolSession(data);
  const { renderable, skipped } = await planBatch([row] as BatchRow[]);
  if (renderable.length === 0) throw new Error(skipped[0]?.reason || 'This session can’t be rendered to a file.');
  if (mount) { releaseDeliveryFor(mount); mount.innerHTML = `<p class="pro-progress-msg"><strong>Rendering…</strong></p>`; }
  // The one path with NO overlay and no zip: a single session rendered to a bare file.
  // Its diagnostics reach the caller through the return value or nowhere, and Phase 2
  // accepts "nowhere" - a single-session render is not a batch report.
  const { files } = await runBatch(renderable, host, { isCancelled: () => job?.cancelled === true, onProgress: () => {} });
  if (files.length === 0) throw new Error('No file was produced.');
  onBatchRendered?.(files);
  const file = files[0]!;
  const name = file.name.replace(/^\d+-/, '');   // strip runBatch's sequence prefix → bare name
  // plans/236: hand the file over, then retain it on the mount with what the browser
  // could vouch for - an anchor click is a request; only a closed dialog write is a save.
  const outcome = await deliverFile(host, file.blob, name);
  // Auto-save the same credentialed bytes into the personal library ('renders'
  // tag). Best-effort + non-blocking, deduped + toggle-gated inside the helper.
  void (async () => {
    try {
      const { saveRenderToLibrary } = await import('../lib/save-render.ts');
      await saveRenderToLibrary(host as unknown as Parameters<typeof saveRenderToLibrary>[0], {
        blob: file.blob,
        format: file.fmt || (name.split('.').pop() ?? 'bin'),
        toolId: row.toolId || 'render',
        name: name.replace(/\.[a-z0-9]{1,5}$/i, ''),
      });
    } catch { /* library save is best-effort */ }
  })();
  if (mount) {
    mount.innerHTML = `<p class="pro-progress-msg" data-delivery></p>`;
    attachDeliveryResult(mount, mount.querySelector<HTMLElement>('[data-delivery]')!, { blob: file.blob, filename: name, label: name }, host, outcome);
  }
  playSfx('victory'); // a single render finished - the subtle "ta-da" (the ding fired inside runBatch)
  return { files, name };
}

/**
 * Render an arbitrary SELECTION - any mix of loose sessions and whole folders - as one
 * nested zip. The synthetic-parent + `allFolders` recursion trick does NOT compose
 * (rowsForFolder recurses on real `parentId===folder.id`, which a synthetic parent
 * lacks), so we CONCATENATE `rowsForFolder` calls: one synthetic bucket for the loose
 * sessions, then each selected folder's subtree nested under `[label]`.
 *
 * @param {HostV1} host
 * @param {object} opts { label, sessionRefs[], folderIds[], allFolders[], mount, author, onBatchRendered, announce }
 */
export async function exportSelectionAsBatch(host: FolderExportHost, {
  label = 'Selection', sessionRefs = [], folderIds = [], allFolders = [],
  mount, job, author = null, onBatchRendered, announce, strongPassword, zipLock, onMotionFound,
}: ExportSelectionOpts = {}) {
  let rows: ExportRow[] = [];
  if (sessionRefs.length) {
    rows.push(...await rowsForFolder(host, { name: label, items: sessionRefs.map(ref => ({ type: 'session', ref })) }, null));
  }
  for (const fid of folderIds) {
    const folder = allFolders.find(f => f.id === fid);
    if (folder) rows.push(...await rowsForFolder(host, folder, allFolders, [label]));
  }
  if (rows.length === 0) throw new Error('Nothing in the selection can be rendered.');

  // Motion (video/animated) rows encode in real time and need the tab kept active. Let the
  // caller opt in (committing to that) or skip them before the batch starts.
  if (onMotionFound) {
    const motionCount = rows.filter(isMotionRow).length;
    if (motionCount) {
      const decision = await onMotionFound(motionCount);
      if (decision === 'cancel') return undefined;
      if (decision === 'skip') rows = rows.filter(r => !isMotionRow(r));
      if (rows.length === 0) throw new Error('Nothing left to render once videos are skipped.');
    }
  }

  // INVARIANT: nothing may filter, sort or splice `rows` between here and runBatch. The
  // motion filter above satisfies that only by sitting ABOVE this line - it compacts the
  // array a second time, so an index captured before it is already wrong by the time
  // planBatch runs. Any new filter goes above, never below.
  const selectionCheck = await createBatchRowCheck(rows as BatchRow[], host, {});
  const plan = await planBatch<Finding>(rows as BatchRow[], { check: selectionCheck.check });
  const { renderable, skipped, srcIndex, findings } = plan;
  if (renderable.length === 0) throw new Error('None of the selected items can be rendered.');

  return runBatchWithProgress(host, renderable, {
    mount, job, pathAware: true,
    zipBaseName: slug(label) || 'lolly-selection',
    author: author as BatchAuthor | null, skipped, srcIndex,
    notes: notesFromFindings(findings, renderable.length),
    skippedFindings: skippedFindings(plan),
    runFindings: selectionCheck.runFindings,
    onBatchRendered, announce, strongPassword, zipLock,
  });
}
