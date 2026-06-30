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
import { runBatch } from './batch.js';
import { buildZip, saveBlob, saveSequential } from './zip.js';
import { QUIPS, quipLines } from './quips.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

/**
 * Render a batch with the full progress UI and deliver the result as one zip
 * (falling back to spaced sequential downloads if zipping fails).
 *
 * @param {HostV1} host
 * @param {Array} rows                         renderable rows (already planned)
 * @param {object} opts
 * @param {HTMLElement} opts.mount             where to render the progress shell
 * @param {string} [opts.format]
 * @param {string} [opts.unit]
 * @param {number} [opts.dpi]
 * @param {boolean} [opts.pathAware]           keep `/` in names → nested zip dirs
 * @param {string}  opts.zipBaseName           zip filename stem (no extension)
 * @param {object|null} [opts.author]          profile for the zip credit block
 * @param {string} [opts.csv]                  re-importable batch CSV manifest
 * @param {Array<{reason:string}>} [opts.skipped]  rows dropped before the run
 * @param {() => void} [opts.onRendered]       fired after renders, before delivery
 * @param {(files:Array)=>void} [opts.onBatchRendered]  usage-metric hook
 * @param {(msg:string)=>void} [opts.announce] screen-reader announcer
 * @returns {Promise<{files:Array, results:Array, cancelled:boolean}>}
 */
export async function runBatchWithProgress(host, rows, {
  mount, format, unit, dpi, pathAware = false,
  zipBaseName, author = null, csv, skipped = [],
  onRendered, onBatchRendered, announce,
} = {}) {
  const total = rows.length;
  let cancelRequested = false;

  const skipNote = skipped.length
    ? `<li class="pro-log-skip">${skipped.length} row${skipped.length === 1 ? '' : 's'} skipped (${esc(skipped[0].reason)}${skipped.length > 1 ? ', …' : ''})</li>`
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
  const quipEl = mount.querySelector('.pro-quip');
  const headEl = mount.querySelector('.pro-progress-headtext');
  const logEl = mount.querySelector('.pro-log');
  const cancelBtn = mount.querySelector('#pro-cancel');
  if (skipNote) logEl.insertAdjacentHTML('beforeend', skipNote);
  const draw = (head) => { headEl.innerHTML = head; };
  const appendLog = (li) => logEl.insertAdjacentHTML('beforeend', li);
  // One Cancel listener, bound once to the stable button, so even a long batch
  // stays cancellable.
  cancelBtn.addEventListener('click', () => { cancelRequested = true; cancelBtn.disabled = true; });

  // Shuffle the quips and rotate one every few seconds (re-triggering the CSS
  // fade on each swap). Just for fun while a big batch grinds away.
  const order = QUIPS.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  let qi = 0;
  const paintQuip = () => {
    quipEl.innerHTML = quipLines(QUIPS[order[qi]], total).map(l => `<span>${esc(l)}</span>`).join('');
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
      appendLog(`<li class="pro-log-skip">Zip failed (${esc(String(zipErr.message ?? zipErr))}); downloading files individually…</li>`);
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
