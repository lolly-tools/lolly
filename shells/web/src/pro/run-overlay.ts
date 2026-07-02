// SPDX-License-Identifier: MPL-2.0
/**
 * Pro / Batch mode — the batch-run progress shell, made mount-agnostic.
 *
 * This is the rotating-quip + progress-head + Cancel + live-log UI plus the
 * runBatch call and the zip/sequential delivery, extracted from runBatchFlow so
 * it can render into either:
 *   - the docked `#pro-progress` panel (the in-grid batch run), or
 *   - a floating toast appended to <body> (a folder/group export launched from
 *     the shared overlay, with no /pro grid mounted).
 *
 * It owns its own cancel flag and quip rotator. It deliberately does NOT touch
 * any /pro grid state (state.running / renderGrid) — the docked caller passes an
 * `onRendered` hook to flip those once the renders finish, before delivery.
 */
import './run-overlay.css';
import { runBatch, type BatchRunRow, type BatchFile, type BatchResult } from './batch.ts';
import { buildZip, saveBlob, saveSequential, type ZipAuthor } from './zip.ts';
import { QUIPS, quipLines } from './quips.ts';
import { escape as esc } from '../utils.ts';
import type { RuntimeHost, Unit } from '@lolly/engine';

/** Options for a batch run + delivery. */
export interface RunBatchProgressOpts {
  /** Where to render the progress shell. */
  mount: HTMLElement;
  format?: string;
  unit?: Unit;
  dpi?: number;
  /** Keep `/` in names → nested zip dirs. */
  pathAware?: boolean;
  /** Zip filename stem (no extension). */
  zipBaseName: string;
  /** Profile for the zip credit block. */
  author?: ZipAuthor | null;
  /** Re-importable batch CSV manifest. */
  csv?: string;
  /** Rows dropped before the run. */
  skipped?: Array<{ reason: string }>;
  /** Fired after renders, before delivery. */
  onRendered?: () => void;
  /** Usage-metric hook. */
  onBatchRendered?: (files: BatchFile[]) => void;
  /** Screen-reader announcer. */
  announce?: (msg: string) => void;
}

/** Outcome of a run: produced files, per-row results, and whether it was cancelled. */
export interface RunBatchProgressResult {
  files: BatchFile[];
  results: BatchResult[];
  cancelled: boolean;
}

/**
 * Render a batch with the full progress UI and deliver the result as one zip
 * (falling back to spaced sequential downloads if zipping fails).
 */
export async function runBatchWithProgress(
  host: RuntimeHost,
  rows: BatchRunRow[],
  {
    mount, format, unit, dpi, pathAware = false,
    zipBaseName, author = null, csv, skipped = [],
    onRendered, onBatchRendered, announce,
  }: RunBatchProgressOpts,
): Promise<RunBatchProgressResult> {
  const total = rows.length;
  let cancelRequested = false;

  const skipNote = skipped.length
    ? `<li class="pro-log-skip">${skipped.length} row${skipped.length === 1 ? '' : 's'} skipped (${esc(skipped[0]?.reason)}${skipped.length > 1 ? ', …' : ''})</li>`
    : '';

  // Persistent progress shell: a rotating quip on top, then a head line + a
  // single Cancel button, then the live log. Built ONCE; draw() rewrites only the
  // head text and each finished row appends one <li>.
  mount.hidden = false;
  mount.innerHTML = `
    <div class="pro-quip" aria-hidden="true"></div>
    <div class="pro-progress-body">
      <div class="pro-progress-head">
        <span class="pro-progress-headtext"></span>
        <button type="button" class="pro-btn" id="pro-cancel">Cancel</button>
      </div>
      <ol class="pro-log"></ol>
    </div>`;
  const quipEl = mount.querySelector<HTMLElement>('.pro-quip');
  const headEl = mount.querySelector<HTMLElement>('.pro-progress-headtext');
  const logEl = mount.querySelector<HTMLElement>('.pro-log');
  const cancelBtn = mount.querySelector<HTMLButtonElement>('#pro-cancel');
  if (!quipEl || !headEl || !logEl || !cancelBtn) throw new Error('pro progress shell failed to render');
  if (skipNote) logEl.insertAdjacentHTML('beforeend', skipNote);
  const draw = (head: string) => { headEl.innerHTML = head; };
  const appendLog = (li: string) => logEl.insertAdjacentHTML('beforeend', li);
  // One Cancel listener, bound once to the stable button, so even a long batch
  // stays cancellable.
  cancelBtn.addEventListener('click', () => { cancelRequested = true; cancelBtn.disabled = true; });

  // Shuffle the quips and rotate one every few seconds (re-triggering the CSS
  // fade on each swap). Just for fun while a big batch grinds away.
  const order = QUIPS.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = order[i]; const b = order[j];
    if (a !== undefined && b !== undefined) { order[i] = b; order[j] = a; }
  }
  let qi = 0;
  const paintQuip = () => {
    const quip = QUIPS[order[qi] ?? 0] ?? '';
    quipEl.innerHTML = quipLines(quip, total).map(l => `<span>${esc(l)}</span>`).join('');
    quipEl.style.animation = 'none'; void quipEl.offsetWidth; quipEl.style.animation = '';
  };
  paintQuip();
  const quipTimer = setInterval(() => { qi = (qi + 1) % order.length; paintQuip(); }, 4200);

  try {
    draw(`<strong>Rendering 0 / ${total}…</strong>`);
    announce?.(`Rendering ${total} item${total === 1 ? '' : 's'}…`);

    let done = 0;
    const { files, results } = await runBatch(rows, host, {
      format, unit, dpi, pathAware,
      isCancelled: () => cancelRequested,
      onProgress: (p) => {
        if (p.status === 'rendering') { draw(`<strong>Rendering ${done + 1} / ${total}…</strong>`); return; }
        if (p.status === 'done') appendLog(`<li class="pro-log-ok">✓ ${esc(p.name)}</li>`);
        else if (p.status === 'error') appendLog(`<li class="pro-log-err">✕ row ${p.index + 1}: ${esc(p.error)}</li>`);
        else if (p.status === 'cancelled') appendLog(`<li class="pro-log-skip">Cancelled</li>`);
        done++;
        draw(`<strong>Rendered ${done} / ${total}</strong>`);
      },
    });

    // Hand control back to the caller (clear running state / re-render grid)
    // before the potentially-slow zip build.
    onRendered?.();
    clearInterval(quipTimer);
    quipEl.remove();   // the job's done talking
    cancelBtn.remove(); // …and there's nothing left to cancel

    // Rows that errored mid-run still produce no file — surface the count so a
    // "Done — 480 files" can't quietly hide 20 failures.
    const failed = results.filter(r => !r.ok).length;
    const failNote = failed ? `, ${failed} failed` : '';

    if (files.length === 0) {
      draw(`<strong>No files produced.</strong>`);
      announce?.('Batch finished — no files produced.');
      return { files, results, cancelled: cancelRequested };
    }

    onBatchRendered?.(files); // host-injected usage metric (see main.js)

    // Deliver: one zip when possible; spaced sequential downloads as a fallback.
    try {
      const zip = await buildZip(files, { zipName: `${zipBaseName}.zip`, author, csv });
      saveBlob(zip, `${zipBaseName}.zip`);
      draw(`<strong>Done — ${files.length} file${files.length === 1 ? '' : 's'} in one zip${failNote}.</strong>`);
      announce?.(`Batch complete — ${files.length} file${files.length === 1 ? '' : 's'} in one zip${failNote}.`);
    } catch (zipErr) {
      const detail = zipErr && typeof zipErr === 'object' && 'message' in zipErr ? zipErr.message : undefined;
      appendLog(`<li class="pro-log-skip">Zip failed (${esc(String(detail ?? zipErr))}); downloading files individually…</li>`);
      draw(`<strong>Downloading ${files.length} files individually…</strong>`);
      await saveSequential(files, {
        delayMs: 600,
        onSaved: (n, tot) => draw(`<strong>Saving ${n} / ${tot}…</strong>`),
      });
      draw(`<strong>Done — ${files.length} files downloaded${failNote}.</strong>`);
      announce?.(`Batch complete — ${files.length} file${files.length === 1 ? '' : 's'} downloaded${failNote}.`);
    }
    return { files, results, cancelled: cancelRequested };
  } finally {
    clearInterval(quipTimer); // never leave the rotator running
  }
}
