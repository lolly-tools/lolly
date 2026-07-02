// SPDX-License-Identifier: MPL-2.0
/**
 * Pro / Batch mode — batch run wiring.
 *
 * Bridges the grid model to the render pipeline: plan the batch (batch.ts), then
 * drive the full progress UI + zip delivery (run-overlay.ts). Owns the transient
 * run flags and the screen-reader announcer; index.ts keeps the grid closure and
 * hands the render/progress hooks in through a small typed context.
 */
import { planBatch, type BatchFile } from './batch.ts';
import { runBatchWithProgress } from './run-overlay.ts';
import { batchToCsv } from './io.ts';
import { escape as esc } from '../utils.ts';
import type { GridRow } from './grid.ts';
import type { RuntimeHost, Unit } from '@lolly/engine';

/** The slice of batch state a run reads and toggles. */
export interface BatchRunState {
  rows: GridRow[];
  format: string;
  unit: Unit;
  dpi: number;
  running: boolean;
  cancelRequested: boolean;
  zipName: string;
}

/** What index.ts hands the run seam: state + host + render/progress hooks. */
export interface BatchRunContext {
  state: BatchRunState;
  host: RuntimeHost;
  /** The mounted view (host for the live-region announcer). */
  viewEl: HTMLElement;
  /** Where run-overlay renders its progress shell (the #pro-progress element). */
  progressMount: HTMLElement;
  /** Re-render the grid (index re-assigns its `columns` closure). */
  render(): void;
  /** Show a message in the progress region. */
  showProgress(html: string): void;
  /** Dismiss the bulk-fill popover before a run takes over the screen. */
  closeBulkPopover(): void;
  /** Usage-metric hook injected by the shell. */
  onBatchRendered?: (files: BatchFile[]) => void;
}

/** Batch-run operations bound to one mounted /pro view. */
export interface BatchRun {
  runBatchFlow(): Promise<void>;
  reportFatal(err: unknown): void;
}

export function createBatchRun(ctx: BatchRunContext): BatchRun {
  const { state, host } = ctx;

  // Screen-reader announcer for batch milestones (start / done / cancelled).
  // Per-row progress is intentionally NOT announced — it would be far too chatty.
  // A local live region (not the shared a11y helper) keeps /pro's import isolation.
  let srEl: HTMLElement | null = null;
  function srAnnounce(msg: string): void {
    if (!srEl) {
      srEl = document.createElement('div');
      srEl.className = 'visually-hidden';
      srEl.setAttribute('aria-live', 'polite');
      srEl.setAttribute('aria-atomic', 'true');
      ctx.viewEl.appendChild(srEl);
    }
    const el = srEl;
    el.textContent = '';
    requestAnimationFrame(() => { el.textContent = msg; });
  }

  // ── Batch run + delivery ────────────────────────────────────────────────────
  async function runBatchFlow(): Promise<void> {
    if (state.running) return;
    ctx.closeBulkPopover();

    const { renderable, skipped } = await planBatch(state.rows);
    if (renderable.length === 0) {
      ctx.showProgress(`<p class="pro-progress-msg">Nothing to render — pick at least one exportable template.</p>`);
      return;
    }

    state.running = true;
    state.cancelRequested = false;
    ctx.render();

    // Author details ride into the zip manifest only when the user has opted in
    // (Profile → "Use my details"); otherwise the [ Author Information ] block is
    // dropped. The CSV is the exact settings that produced these files —
    // re-importable to reproduce or tweak the run (Sessions ▸ Upload CSV).
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const zipBase = state.zipName.trim().replace(/\.zip$/i, '') || `lolly-batch-${stamp}`;
    const profile = await host.profile?.get?.().catch(() => null);
    const author = profile?.useDetails ? profile : null;
    const csv = batchToCsv(renderable, { unit: state.unit, dpi: state.dpi });

    await runBatchWithProgress(host, renderable, {
      mount: ctx.progressMount,
      format: state.format,
      // Toolbar defaults; each row may override via its own unit/dpi (batch.js).
      unit: state.unit,
      dpi: state.dpi,
      zipBaseName: zipBase,
      author,
      csv,
      skipped,
      // Re-enable the grid as soon as the renders finish, before the zip builds.
      onRendered: () => { state.running = false; ctx.render(); },
      onBatchRendered: ctx.onBatchRendered,
      announce: srAnnounce,
    });
  }

  function reportFatal(err: unknown): void {
    state.running = false;
    ctx.render();
    const message = err instanceof Error ? err.message : String(err);
    ctx.showProgress(`<p class="pro-progress-msg pro-log-err">Batch failed: ${esc(message)}</p>`);
  }

  return { runBatchFlow, reportFatal };
}
