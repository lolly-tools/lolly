// SPDX-License-Identifier: MPL-2.0
/**
 * Pro / Batch mode - the batch-run progress shell, made mount-agnostic.
 *
 * This is the rotating-quip + progress-head + Cancel + live-log UI plus the
 * runBatch call and the zip/sequential delivery, extracted from runBatchFlow so
 * it can render into either:
 *   - the docked `#pro-progress` panel (the in-grid batch run), or
 *   - nothing at all: with no `mount` the shell is built detached and the global
 *     job toast (lib/job-toast.ts) is the run's only visible surface. That is the
 *     shape every non-/pro caller uses now - a folder, a selection, one session,
 *     a multi-edit download-all, "Export everything" - because a run must outlive
 *     the view that started it, and a view-owned toast cannot.
 *
 * Every run reports into a WP-F job (lib/batch-job.ts): progress, cancellation and
 * failure all travel through the handle, so leaving the view costs the cards and
 * the log but never the run, its progress or its download.
 *
 * It owns its own cancel flag and quip rotator. It deliberately does NOT touch
 * any /pro grid state (state.running / renderGrid) - the docked caller passes an
 * `onRendered` hook to flip those once the renders finish, before delivery.
 */
import './run-overlay.css';
import { runBatch } from './batch.ts';
import { playSfx } from '../lib/sfx.ts';
import { t } from '../i18n.ts';
import { releaseDeliveryFor } from '../lib/download-recovery.ts';
import { deliverBatchFile, releaseBackgroundDelivery } from '../lib/background-delivery.ts';
import { isBatchRunActive, startBatchJob, releaseBatchJob } from '../lib/batch-job.ts';
import type { JobHandle } from '../lib/jobs.ts';
import { buildZip, saveSequential } from './zip.ts';
import { QUIPS, quipLines } from './quips.ts';
import { buildPreflightReport, collectUnmade, rowLabel, type SkippedLike } from './manifest.ts';
import type { BatchRow, BatchFile, BatchResult, BatchNotes, RowNotes } from './batch.ts';
import { ENGINE_VERSION, type ZipTier } from '@lolly/engine';
import type { HostV1 } from '@lolly-tools/core/host-v1';

/** Profile fields the zip credit block uses. */
interface BatchAuthor {
  firstname?: string;
  lastname?: string;
  email?: string;
  phone?: string;
}

/** Options for a batch run + delivery (see the JSDoc on runBatchWithProgress). */
interface RunBatchProgressOpts<F = unknown> {
  /**
   * Where to render the progress shell. OPTIONAL: with no mount the shell is built
   * into a detached node and the global job toast (lib/job-toast.ts) is the run's
   * only visible channel - the shape every caller but /pro's docked panel uses now.
   * One code path either way, so cards/log/retry never need a second implementation.
   */
  mount?: HTMLElement;
  /**
   * The job this run reports into (lib/batch-job.ts). Supplied by a caller whose job
   * already covers row assembly and preflight; the caller owns its terminal state.
   * Omitted (the Retry button, a direct call) → the run starts and owns one itself.
   */
  job?: JobHandle;
  /** Title for the job this run starts for itself. Ignored when `job` is supplied. */
  jobTitle?: string;
  format?: string;
  unit?: string;
  dpi?: number;
  pathAware?: boolean;
  zipBaseName: string;
  author?: BatchAuthor | null;
  csv?: string;
  /**
   * Rows dropped before the run (planBatch's `skipped`). Widened additively to carry
   * the row + its source position/identity, because a skipped row has NO queue
   * position - it is shown by its SOURCE row number (`srcIndex`, the number the grid
   * shows) plus `manifest.ts`'s label, and by nothing else. `uid` is carried for the
   * machine sidecar; it never reaches the UI.
   */
  skipped?: Array<{ reason: string; row?: BatchRow; srcIndex?: number; uid?: string }>;
  /**
   * `srcIndex[k]` is the 0-based SOURCE position of `rows[k]` - `planBatch`'s own
   * output, threaded through so a row number shown to a person survives compaction.
   * Absent → runner space is assumed to BE source space (a run of unplanned rows).
   */
  srcIndex?: number[];
  /**
   * Per-row diagnostics, PARALLEL to `rows` (see `BatchNotes` in ./batch.ts). Opaque:
   * this module never inspects an element, it only shows them against the right row.
   */
  notes?: BatchNotes<F>;
  /**
   * SEAM (Phase 1): flatten one opaque note to a display line. The default reads
   * `.message` off an object (or takes a string as-is), which is exactly the shape
   * `Finding` will have - so Phase 1 can land with no wiring here at all, and a
   * caller with a different payload overrides it.
   */
  noteText?: (note: F) => string;
  /**
   * SEAM (Phase 1): the chip's tone. Default reads `.severity`, mapping `warn`/`error`
   * to `'warn'` and everything else - including `info`, the common state - to `'info'`.
   * `info` must never render as a warning.
   */
  noteTone?: (note: F) => 'info' | 'warn';
  /**
   * Findings for the rows `planBatch` DROPPED, keyed by identity - they have no queue
   * position, so `notes` (which is parallel to `rows`) structurally cannot carry them.
   * `preflight-rows.ts` `skippedFindings(plan)` builds this.
   */
  skippedFindings?: ReadonlyArray<{ uid?: string; srcIndex: number; items: F[] }>;
  /**
   * Findings about the RUN rather than any row - the platform refusals and the brand
   * palette. Shown once, in the report envelope and above the zip's per-file notes,
   * never as a chip on 500 cards.
   */
  runFindings?: readonly F[];
  /**
   * Set on the retry run only: the original package name, so the two zips are readable
   * as one job. Callers never set this - the Retry button does.
   */
  retryOf?: string;
  /**
   * RUN-LEVEL print settings (press profile / bleed / marks), forwarded verbatim
   * to runBatch, where a row carrying its own value overrides them - see
   * `resolvePrintSettings` in ./batch.ts for the one statement of that rule.
   * Ignored by every non-print format, so callers may pass them unconditionally.
   */
  profile?: string;
  bleed?: string;
  marks?: string;
  onRendered?: () => void;
  onBatchRendered?: (files: BatchFile[]) => void;
  announce?: (msg: string) => void;
  /** AES-256 lock applied to any pdf/pdf-cmyk outputs in the batch. */
  strongPassword?: string;
  /** Whole-zip encryption tier (uses `strongPassword` as the zip password too). */
  zipLock?: ZipTier;
  /** Deliver ONE merged PDF (each row's pages in batch order) instead of a zip
   *  (plans/140 S5). Requires every row to render to pdf/pdf-cmyk - a mixed run
   *  falls back to the zip, logged. With `strongPassword`, the MERGED document
   *  is R6-locked (rows render unlocked so their pages can be copied). */
  combinePdf?: boolean;
}

/** Outcome of a run: produced files, per-row results, and whether it was cancelled. */
interface RunBatchProgressResult<F = unknown> {
  files: BatchFile[];
  results: BatchResult<F>[];
  cancelled: boolean;
  /** The zip that was actually saved, when one was - what the completion names. */
  zipName?: string;
}

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, c => (
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]!
));

// Per-format glyphs for the preview cards - Lucide line icons (matching the app's iconography),
// grouped by kind: a vector PEN for svg/eps/…, a document for pdf, film for video, and the
// IMAGE frame for every raster (png/jpg/webp/gif/…). `fmtIcon()` picks one from the render format.
const ICON_ATTRS = 'viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const ICON_PEN = `<svg ${ICON_ATTRS}><path d="M15.707 21.293a1 1 0 0 1-1.414 0l-1.586-1.586a1 1 0 0 1 0-1.414l5.586-5.586a1 1 0 0 1 1.414 0l1.586 1.586a1 1 0 0 1 0 1.414z"/><path d="m18 13-1.375-6.874a1 1 0 0 0-.746-.776L3.235 2.028a1 1 0 0 0-1.207 1.207L5.35 15.643a1 1 0 0 0 .776.746L13 18"/><path d="m2.3 2.3 7.286 7.286"/><circle cx="11" cy="11" r="2"/></svg>`;
const ICON_IMAGE = `<svg ${ICON_ATTRS}><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`;
const ICON_DOC = `<svg ${ICON_ATTRS}><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>`;
const ICON_FILM = `<svg ${ICON_ATTRS}><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 3v18"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/></svg>`;
const fmtIcon = (fmt: string): string => {
  const f = (fmt || '').toLowerCase();
  if (/^(svg|eps|emf|ai|pdf-vector)/.test(f)) return ICON_PEN;   // vector art
  if (f.startsWith('pdf')) return ICON_DOC;                       // pdf / pdf-cmyk
  if (/^(mp4|webm|mov|m4v)/.test(f)) return ICON_FILM;            // video container
  return ICON_IMAGE;                                              // png/jpg/jpeg/webp/gif/avif/ico/bmp/…
};

/**
 * SEAM (Phase 1) - the two readers of the opaque per-row payload, and the ONLY code
 * in this module that touches a note's insides. They are written against the shape
 * `Finding` is specified to have (`packages/core/src/preflight.ts`, section 3 of
 * plans/65-preflight-and-cost.md: `{ severity, message, … }`) so Phase 1 lands as an
 * `import type` plus `runBatchWithProgress<Finding>(…)` and nothing here changes. A
 * caller carrying a different payload overrides them per run.
 *
 * `severity: 'info'` is a real, common state - a count with no rate - so anything that
 * is not explicitly warn/error tones as info and MUST NOT render as a warning.
 */
/**
 * One batch run at a time, process-wide.
 *
 * `runBatch` documents concurrency 1 as an invariant of the RUN (each row mounts a
 * full-size offscreen tool canvas and tools touch window globals), but nothing enforced
 * it BETWEEN runs: the Retry button starts a second run after the first has already
 * cleared /pro's `state.running`, so a user could have a retry and a fresh grid run
 * writing to the same mount - the second run rebuilding the shell detaches the first's
 * head, log, card wall and Cancel button - and two zips saved with no explanation.
 *
 * The lock is no longer a boolean this module clears in its own `finally`: it is the
 * JOB registry (lib/batch-job.ts). A run that outlives its view still frees the slot
 * when it finishes, fails or is cancelled from the toast - which the boolean could not
 * do, because only this function's `finally` ever cleared it.
 */
export { isBatchRunActive } from '../lib/batch-job.ts';

const defaultNoteText = (note: unknown): string =>
  typeof note === 'string' ? note : String((note as { message?: unknown })?.message ?? '');
const defaultNoteTone = (note: unknown): 'info' | 'warn' => {
  const sev = (note as { severity?: unknown })?.severity;
  return sev === 'warn' || sev === 'error' ? 'warn' : 'info';
};

/**
 * Render a batch with the full progress UI and deliver the result as one zip
 * (falling back to spaced sequential downloads if zipping fails).
 *
 * @param {HostV1} host
 * @param {Array} rows                         renderable rows (already planned)
 * @param {object} opts
 * @param {HTMLElement} [opts.mount]           where to render the progress shell (omit → detached; the job toast is the surface)
 * @param {object} [opts.job]                  the caller's job handle to report into
 * @param {string} [opts.jobTitle]             title for the job this run starts for itself
 * @param {string} [opts.format]
 * @param {string} [opts.unit]
 * @param {number} [opts.dpi]
 * @param {boolean} [opts.pathAware]           keep `/` in names → nested zip dirs
 * @param {string}  opts.zipBaseName           zip filename stem (no extension)
 * @param {object|null} [opts.author]          profile for the zip credit block
 * @param {string} [opts.csv]                  re-importable batch CSV manifest
 * @param {Array<{reason:string, row?:object, srcIndex?:number, uid?:string}>} [opts.skipped]
 *        rows dropped before the run (planBatch's `skipped` - listed by name, never by
 *        a queue position they do not have)
 * @param {string} [opts.profile]              run-level CMYK press condition
 * @param {string} [opts.bleed]                run-level bleed, e.g. "3mm"
 * @param {string} [opts.marks]                run-level print-marks CSV
 * @param {() => void} [opts.onRendered]       fired after renders, before delivery
 * @param {(files:Array)=>void} [opts.onBatchRendered]  usage-metric hook
 * @param {(msg:string)=>void} [opts.announce] screen-reader announcer
 * @returns {Promise<{files:Array, results:Array, cancelled:boolean}>}
 */
export async function runBatchWithProgress<F = unknown>(host: HostV1, rows: BatchRow[], opts: RunBatchProgressOpts<F> = {} as RunBatchProgressOpts<F>): Promise<RunBatchProgressResult<F>> {
  const {
    format, unit, dpi, pathAware = false,
    zipBaseName, author = null, csv, skipped = [],
    profile, bleed, marks, srcIndex, notes, retryOf, skippedFindings, runFindings,
    noteText = defaultNoteText as (note: F) => string,
    noteTone = defaultNoteTone as (note: F) => 'info' | 'warn',
    onRendered, onBatchRendered, announce, strongPassword, zipLock, combinePdf = false,
  } = opts;
  // The batch slot. A caller whose job already covers row assembly and preflight hands
  // its handle in and keeps ownership of the terminal state; a bare call (the Retry
  // button, a test) claims a job of its own here - and only that path refuses, because
  // an inherited job IS the run currently holding the slot.
  const inheritedJob = opts.job;
  if (!inheritedJob && isBatchRunActive()) throw new Error('A batch run is already in progress - wait for it to finish.');
  const job = inheritedJob ?? startBatchJob(opts.jobTitle || t('Rendering batch'));
  // No mount → the shell is built detached and the global job toast is the visible
  // channel (see RunBatchProgressOpts.mount).
  const mount = opts.mount ?? document.createElement('div');
  releaseBackgroundDelivery();
  const total = rows.length;
  let cancelRequested = false;
  // Two ways to stop: this overlay's own Cancel button and the toast's ✕ (which flips
  // job.cancelled). Both stop further renders; whatever already rendered is still
  // delivered, which is what the overlay's Cancel has always done.
  const isCancelled = (): boolean => cancelRequested || job.cancelled;

  // A row is named to a human by something it CARRIES - its filename or its tool. The
  // labeller is `manifest.ts`'s, imported rather than restated, so the overlay and
  // lolly.txt / preflight.json can never call the same row two different things. The
  // grid's internal `uid` is deliberately NOT in the chain: it is a per-page-load
  // counter (`r7`), meaningless to a user and different every time a batch is reopened.

  // …and the row NUMBER, when one is wanted alongside the name, comes through here and
  // nowhere else. `planBatch` compacts, so `index + 1` is a queue position, not the row
  // the user counted to; `srcIndex` is the only mapping back. Absent → the caller did
  // not plan, and runner space IS source space.
  const srcRow = (i: number): number => (srcIndex?.[i] ?? i) + 1;

  // The opaque payload, flattened for display. Nothing else in this module reads a note.
  const linesOf = (n: RowNotes<F> | undefined): string[] =>
    (n ?? []).map(noteText).map(x => String(x ?? '').trim()).filter(Boolean);
  const noteLinesAt = (k: number): string[] => linesOf(notes?.[k]);
  const toneOf = (n: RowNotes<F> | undefined): 'info' | 'warn' =>
    (n ?? []).some(x => noteTone(x) === 'warn') ? 'warn' : 'info';
  // Files that rendered AND carry notes, for the zip manifest's [ Notes ] block.
  const noted: Array<{ name: string; lines: readonly string[] }> = [];
  // …and the findings that are about the run rather than any file, flattened by the
  // same reader. They lead the [ Notes ] block; they are never counted into
  // "N with notes", which is a count of ROWS.
  const runNotes = linesOf(runFindings);

  // Each skipped row listed by name when it can be named; the old one-line summary is
  // kept as the <summary>, so a run with nothing skipped is byte-identical (empty).
  // A skipped row has no queue position, but planBatch captured its SOURCE position at
  // drop time - that is the number the grid shows and the number lolly.txt prints, so
  // it leads here too. Absent → the name alone, never a fabricated number.
  const skipItems = skipped.map(s => {
    const n = s.srcIndex == null ? '' : `row ${s.srcIndex + 1} - `;
    return `<li>${esc(n)}${esc(rowLabel(s.row))} - ${esc(s.reason)}</li>`;
  }).join('');
  const skipNote = skipped.length
    ? `<li class="pro-log-skip"><details><summary>${skipped.length} row${skipped.length === 1 ? '' : 's'} skipped (${esc(skipped[0]!.reason)}${skipped.length > 1 ? ', …' : ''})</summary><ul class="pro-log-skiplist">${skipItems}</ul></details></li>`
    : '';

  // Persistent progress shell: a rotating quip on top, then a head line + a
  // single Cancel button, then the live log. Built ONCE; draw() rewrites only the
  // head text and each finished row appends one <li>.
  mount.hidden = false;
  // A new run in this overlay replaces the file the last one retained (plans/236).
  releaseDeliveryFor(mount);
  mount.innerHTML = `
    <div class="pro-quip" aria-hidden="true"></div>
    <div class="pro-progress-body">
      <div class="pro-progress-head">
        <span class="pro-progress-headtext"></span>
        <button type="button" class="pro-btn" id="pro-cancel">Cancel</button>
      </div>
      <div class="pro-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="0"><span class="pro-progress-fill"></span></div>
      <div class="pro-cardwall" aria-hidden="true"></div>
      <div class="pro-timechart-mount"></div>
      <ol class="pro-log"></ol>
    </div>`;
  const quipEl = mount.querySelector<HTMLElement>('.pro-quip')!;
  const headEl = mount.querySelector<HTMLElement>('.pro-progress-headtext')!;
  const barTrack = mount.querySelector<HTMLElement>('.pro-progress-track')!;
  const barFill = mount.querySelector<HTMLElement>('.pro-progress-fill')!;
  const wallEl = mount.querySelector<HTMLElement>('.pro-cardwall')!;
  const chartMount = mount.querySelector<HTMLElement>('.pro-timechart-mount')!;
  const logEl = mount.querySelector<HTMLElement>('.pro-log')!;
  const cancelBtn = mount.querySelector<HTMLButtonElement>('#pro-cancel')!;
  if (skipNote) logEl.insertAdjacentHTML('beforeend', skipNote);
  const draw = (head: string) => { headEl.innerHTML = head; };
  const appendLog = (li: string) => logEl.insertAdjacentHTML('beforeend', li);
  // The delivery line (plans/236): the final file, retained, and the way back to it.
  // Separate from the headline, which reports what was GENERATED - a browser can
  // confirm the one but only ever request the other.
  const deliveryLine = (): HTMLElement => {
    let line = mount.querySelector<HTMLElement>('.pro-delivery');
    if (!line) {
      line = document.createElement('p');
      line.className = 'pro-delivery pro-progress-msg';
      line.setAttribute('role', 'status');
      logEl.insertAdjacentElement('beforebegin', line);
    }
    return line;
  };

  // A live wall of preview cards - each finished export pops in as a thumbnail so the
  // job reads as a visual build-up, not a wall of text. Newest first; capped so the DOM
  // (and the live object URLs) stay bounded on a big batch (the evicted card's URL is
  // revoked). Image-like formats show the render; pdf/video show a format badge.
  const CARD_CAP = 60;
  const RASTERIZABLE = /^(svg|png|jpe?g|webp|gif|avif|ico|bmp)$/i;
  // A render time worth bragging about: sub-second in ms, otherwise seconds (one decimal
  // until it's long enough not to need it).
  const fmtDuration = (ms: number): string =>
    ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)} s`;
  const addCard = (name: string, blob: Blob, fmt: string, ms: number, lines: readonly string[] = [], tone: 'info' | 'warn' = 'info'): void => {
    const card = document.createElement('figure');
    card.className = 'pro-card';
    // A per-format glyph in the corner - a vector pen for svg, the image frame for png, etc.
    const fi = document.createElement('span');
    fi.className = 'pro-card-fmticon';
    fi.title = (fmt || 'file').toUpperCase();
    fi.innerHTML = fmtIcon(fmt);
    card.appendChild(fi);
    if (RASTERIZABLE.test(fmt) || blob.type.startsWith('image/')) {
      const url = URL.createObjectURL(blob);
      card.dataset.url = url;   // revoked when the card is evicted
      const img = document.createElement('img');
      img.className = 'pro-card-img'; img.loading = 'lazy'; img.alt = ''; img.src = url;
      card.appendChild(img);
    } else {
      card.classList.add('pro-card--badge');
      const badge = document.createElement('span');
      badge.className = 'pro-card-fmt'; badge.textContent = (fmt || 'file').toUpperCase();
      card.appendChild(badge);
    }
    // Render-time brag - a small ⚡ pill under the preview showing how fast it rendered.
    const time = document.createElement('span');
    time.className = 'pro-card-time';
    time.textContent = `⚡ ${fmtDuration(ms)}`;
    card.appendChild(time);
    const cap = document.createElement('figcaption');
    cap.className = 'pro-card-name'; cap.textContent = name.split('/').pop() || name;
    card.appendChild(cap);
    // A row that rendered fine but carries findings gets a CHIP on its card - never a
    // line in .pro-log, which is where ✕ and "Cancelled" live and therefore reads as a
    // run that went wrong. Tone is --primary (the same accent the ⚡ render-time pill
    // uses for "an extra fact about a successful render"); --destructive is the log's
    // alone and must not appear on a card.
    if (lines.length) {
      const chip = document.createElement('span');
      chip.className = `pro-card-note${tone === 'warn' ? ' pro-card-note--warn' : ''}`;
      chip.textContent = tone === 'warn' ? '\u26a0' : '\u2139';
      const joined = lines.join('\n');
      chip.title = joined;
      chip.setAttribute('aria-label', joined);
      // Appended AFTER the figcaption (it is positioned absolutely), so the spoken
      // order is name-then-note rather than note-then-image.
      card.appendChild(chip);
    }
    wallEl.insertAdjacentElement('afterbegin', card);
    while (wallEl.children.length > CARD_CAP) {
      const old = wallEl.lastElementChild as HTMLElement | null;
      if (!old) break;
      if (old.dataset.url) URL.revokeObjectURL(old.dataset.url);
      old.remove();
    }
  };

  // Per-asset render timings - kept for EVERY item (not capped like the card wall), so the
  // completion chart can plot the whole batch. Rendered when the queue finishes.
  const timings: Array<{ name: string; ms: number }> = [];
  // A horizontal bar chart of render time per asset, shortest → longest, so the slow ones
  // stand out at a glance. Bars scale to the slowest; the list scrolls if the batch is huge.
  const renderTimeChart = (items: Array<{ name: string; ms: number }>): string => {
    if (!items.length) return '';
    const sorted = [...items].sort((a, b) => a.ms - b.ms); // shortest first
    const max = Math.max(...sorted.map((t) => t.ms), 1);
    const totalMs = sorted.reduce((s, t) => s + t.ms, 0);
    const rows = sorted.map((t) => {
      const pct = Math.max(3, (t.ms / max) * 100); // a visible minimum so sub-ms items still show
      const name = t.name.split('/').pop() || t.name;
      return `<li class="pro-tc-row">
        <span class="pro-tc-name" title="${esc(t.name)}">${esc(name)}</span>
        <span class="pro-tc-bar"><span class="pro-tc-fill" style="width:${pct.toFixed(1)}%"></span></span>
        <span class="pro-tc-val">${esc(fmtDuration(t.ms))}</span>
      </li>`;
    }).join('');
    return `<div class="pro-timechart">
      <div class="pro-tc-head">Render times<span class="pro-tc-sub">${sorted.length} asset${sorted.length === 1 ? '' : 's'} · ${esc(fmtDuration(totalMs))} total</span></div>
      <ol class="pro-tc-list">${rows}</ol>
    </div>`;
  };
  // One Cancel listener, bound once to the stable button, so even a long batch
  // stays cancellable.
  cancelBtn.addEventListener('click', () => { cancelRequested = true; cancelBtn.disabled = true; });

  // Shuffle the quips and rotate one every few seconds (re-triggering the CSS
  // fade on each swap). Just for fun while a big batch grinds away.
  const order = QUIPS.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j]!, order[i]!]; }
  let qi = 0;
  // `done` counts completed renders - hoisted so the quip painter can show how many are
  // still to go ([Remaining]) alongside the total ([Count]).
  let done = 0;
  const paintQuip = () => {
    quipEl.innerHTML = quipLines(QUIPS[order[qi]!]!, total, Math.max(0, total - done)).map(l => `<span>${esc(l)}</span>`).join('');
    quipEl.style.animation = 'none'; void quipEl.offsetWidth; quipEl.style.animation = '';
  };
  paintQuip();
  const quipTimer = setInterval(() => { qi = (qi + 1) % order.length; paintQuip(); }, 4200);

  // An OWNED job is this run's to finish; an inherited one belongs to the wrapper that
  // started it (lib/batch-job.ts), which finishes it after its own delivery step.
  const settle = (r: RunBatchProgressResult<F>): RunBatchProgressResult<F> => {
    if (!inheritedJob) job.finish(r);
    return r;
  };
  try {
    draw(`<strong>Rendering 0 / ${total}…</strong>`);
    announce?.(`Rendering ${total} item${total === 1 ? '' : 's'}…`);
    // Wait our turn in the process-wide serial queue (lib/jobs.ts). Resolves at once when
    // nothing heavy is running; a wrapper has already waited, so this is a no-op there.
    await job.started;
    // Cancelled before a single row rendered. `onRendered` still fires: it is the hook a
    // caller uses to re-enable its UI, and skipping it here left /pro's grid disabled
    // with nothing running.
    if (isCancelled()) { onRendered?.(); return settle({ files: [], results: [], cancelled: true }); }

    const { files, results } = await runBatch<F>(rows, host, {
      // Combine-as-one renders rows UNLOCKED: an R6-locked member can't be
      // page-copied. The merged document (or a fallback's members) is locked below.
      format, unit, dpi, pathAware, strongPassword: combinePdf ? undefined : strongPassword,
      profile, bleed, marks, notes,
      isCancelled,
      onProgress: (p) => {
        if (p.status === 'rendering') { draw(`<strong>Rendering ${done + 1} / ${total}…</strong>`); return; }
        // A cancel renders NOTHING - counting it as done over-reported "Rendered n / total"
        // by one and over-filled the bar on every cancelled run.
        if (p.status === 'cancelled') { appendLog(`<li class="pro-log-skip">Cancelled</li>`); draw(`<strong>Rendered ${done} / ${total}</strong>`); return; }
        if (p.status === 'done') {
          const lines = linesOf(p.notes);
          addCard(p.name, p.blob, p.fmt, p.ms, lines, toneOf(p.notes));
          if (lines.length) noted.push({ name: p.name, lines });
          timings.push({ name: p.name, ms: p.ms }); // preview card + per-asset timing for the chart
        }
        // The SOURCE row number LEADS - it is the number the grid shows and the number
        // lolly.txt / preflight.json print for this same row, and it is the only one the
        // user can act on. The queue position is context and is labelled as such: it is
        // a position in the compacted array, not a row the user counted to. A row that
        // produced no file gets ONE line - its first note rides on it, the rest go to
        // the zip manifest.
        else if (p.status === 'error') {
          const first = linesOf(p.notes)[0];
          appendLog(`<li class="pro-log-err">✕ row ${srcRow(p.index)} ${esc(rowLabel(p.row))}: ${esc(p.error)}${first ? ` - ${esc(first)}` : ''} <span class="pro-log-queue">[queued ${p.index + 1}/${p.total}]</span></li>`);
        }
        done++;
        draw(`<strong>Rendered ${done} / ${total}</strong>`);
        // Advance the progress bar (a real fill, not just the head text count).
        const pct = total ? Math.round((done / total) * 100) : 0;
        barFill.style.width = `${pct}%`;
        barTrack.setAttribute('aria-valuenow', String(done));
        // …and the same count into the job, which is what the global toast draws - the
        // one progress surface that survives leaving this view. The note is the file
        // just finished, by its bare name (no zip path).
        job.progress(done, total, p.status === 'done' ? (p.name.split('/').pop() || p.name) : undefined);
      },
    });

    // Hand control back to the caller (clear running state / re-render grid)
    // before the potentially-slow zip build.
    onRendered?.();
    clearInterval(quipTimer);
    quipEl.remove();   // the job's done talking
    cancelBtn.remove(); // …and there's nothing left to cancel

    // The queue is done rendering - plot every asset's render time, shortest → longest,
    // so the whole batch's timing reads at a glance (independent of the zip step below).
    chartMount.innerHTML = renderTimeChart(timings);

    // Rows that errored mid-run still produce no file - surface the count so a
    // "Done - 480 files" can't quietly hide 20 failures.
    const failedResults = results.filter(r => !r.ok);
    const failed = failedResults.length;
    const failNote = failed ? `, ${failed} failed` : '';
    // Rows that DID render but carry findings, counted grammatically apart from the
    // failures so the two can never be read as one number. The word is "notes", never
    // "warnings": most findings are counts, and info must not render as damage.
    const notedCount = noted.length;
    const noteNote = notedCount ? `, ${notedCount} with note${notedCount === 1 ? '' : 's'}` : '';
    const tail = `${failNote}${noteNote}`;

    // Every row of the job that produced no file - skipped, failed, or never attempted
    // because the run was cancelled. This is the record that leaves the building: the
    // counts above are UI chrome and evaporate the moment the zip is mailed on.
    const report = {
      rows, srcIndex, results,
      skipped: skipped as readonly SkippedLike[],
      noteLines: noteLinesAt,
    };
    const unmade = collectUnmade(report);
    const preflight = buildPreflightReport({
      ...report,
      zipName: `${zipBaseName}.zip`,
      engine: ENGINE_VERSION,
      cancelled: isCancelled(),
      retryOf,
      // SEAM (Phase 1): the sidecar carries the payload verbatim. `notes` is opaque
      // here and stays opaque all the way into the JSON.
      findings: (k: number) => [...(notes?.[k] ?? [])] as unknown[],
      // The two channels that are NOT queue-space: the dropped rows (no queue
      // position at all) and the run-level findings (no row).
      skippedFindings: skippedFindings as ReadonlyArray<{ uid?: string; srcIndex: number; items: unknown[] }> | undefined,
      runFindings: runFindings as readonly unknown[] | undefined,
    });

    // A retry needs the rows themselves, which only exist on the failure arm of
    // BatchResult and are garbage-collected at the end of every run today.
    const offerRetry = () => {
      if (!failedResults.length) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pro-btn';
      btn.dataset.action = 'pro-retry';
      btn.textContent = `Retry ${failedResults.length} failed row${failedResults.length === 1 ? '' : 's'}`;
      // cancelBtn.remove() vacated this slot in .pro-progress-head - no new layout.
      headEl.parentElement?.appendChild(btn);
      btn.addEventListener('click', () => {
        // A retry is a second run: it must not start while another one holds the stage
        // (this run has released it by now, but /pro's Render button may have started a
        // fresh one), and its failures must surface here rather than as an unhandled
        // rejection with the overlay frozen on "Rendered n / n".
        if (isBatchRunActive()) {
          appendLog(`<li class="pro-log-skip">Another export is still running - try again when it finishes.</li>`);
          return;
        }
        btn.disabled = true;
        const retryRows = failedResults.map(r => r.row);
        runBatchWithProgress<F>(host, retryRows, {
          ...opts,
          // A retry is its OWN job: this run's handle (inherited or not) is settled by
          // the time the button can be clicked, and reporting into a finished job is a
          // silent no-op - the retry would render with no progress anywhere.
          job: undefined,
          jobTitle: t('Retrying failed rows'),
          // Its OWN zip: the first was saveBlob'd before this button could exist, so
          // merging is impossible and pretending otherwise is the trap.
          zipBaseName: `${zipBaseName}-retry`,
          retryOf: `${zipBaseName}.zip`,
          // SOURCE row numbers are preserved, so a retried row is still "row 7", not
          // "row 1" - the concrete reason index identity had to land before retry.
          srcIndex: failedResults.map(r => srcIndex?.[r.index] ?? r.index),
          notes: failedResults.map(r => r.notes),
          // The skipped rows were reported by the first run; re-listing them would
          // double-count them across two manifests. The CSV likewise describes the
          // original run and is not re-derived here.
          skipped: [],
          // …and with them, their findings: a retry renders only the rows that
          // FAILED, so a skipped row's diagnostics belong to the first package alone.
          skippedFindings: [],
          csv: undefined,
          // strongPassword / zipLock ride along in ...opts UNCHANGED: a retry that
          // silently shipped in cleartext is the same class of bug the zip branch
          // already refuses.
          onRendered: undefined,
        }).catch(err => {
          btn.disabled = false;
          // The retry rebuilds `mount`, so this run's captured `logEl` may already be
          // detached - write into whatever log is live, and fall back to the mount.
          const li = `<li class="pro-log-err">Retry failed: ${esc(String((err as { message?: unknown })?.message ?? err))}</li>`;
          const live = mount.querySelector('.pro-log');
          if (live) live.insertAdjacentHTML('beforeend', li);
          else mount.insertAdjacentHTML('beforeend', `<ol class="pro-log">${li}</ol>`);
        });
      });
    };

    if (files.length === 0) {
      draw(`<strong>No files produced.</strong>`);
      announce?.('Batch finished - no files produced.');
      offerRetry();
      return settle({ files, results, cancelled: isCancelled() });
    }

    onBatchRendered?.(files); // host-injected usage metric (see main.js)

    // Deliver: one zip when possible; spaced sequential downloads as a fallback.
    // Delivery goes through the host either way (lib/deliver-file.ts), so it lands
    // whether or not the view that started the run is still on screen.
    let delivered = false;
    let zipName: string | undefined;
    job.progress(done, total, t('Packaging the download…'));

    // Single-PDF delivery (plans/140 S5): merge the finished PDFs into one
    // document, pages in batch order. Any failure or a non-PDF member falls back
    // to the zip below - after restoring the per-file R6 lock the combine path
    // deliberately skipped at render time.
    if (combinePdf) {
      const relockPdfs = async (): Promise<void> => {
        if (!strongPassword) return;
        const { encryptPdfStrong } = await import('../bridge/export.ts');
        for (const f of files) {
          if (f.fmt === 'pdf' || f.fmt === 'pdf-cmyk') f.blob = await encryptPdfStrong(f.blob, strongPassword);
        }
      };
      if (!files.every(f => f.fmt === 'pdf' || f.fmt === 'pdf-cmyk')) {
        appendLog(`<li class="pro-log-skip">Not every row rendered to PDF - delivering the zip instead of one document.</li>`);
        await relockPdfs();
      } else {
        try {
          const { combinePdfs } = await import('./zip.ts');
          let pdf = await combinePdfs(files);
          if (strongPassword) {
            const { encryptPdfStrong } = await import('../bridge/export.ts');
            pdf = await encryptPdfStrong(pdf, strongPassword);
          }
          const pdfName = `${zipBaseName}.pdf`;
          await deliverBatchFile(mount, deliveryLine(), { blob: pdf, filename: pdfName, label: pdfName }, host);
          delivered = true;
          zipName = pdfName;
          appendLog(`<li class="pro-log-skip">Combined document: per-file Content Credentials ride the zip delivery, not a merged PDF.</li>`);
          draw(`<strong>Done - ${files.length} row${files.length === 1 ? '' : 's'} in one PDF${tail}.</strong>`);
          announce?.(`Batch complete - ${files.length} row${files.length === 1 ? '' : 's'} in one PDF${tail}.`);
          if (!isCancelled()) playSfx(total > 1 ? 'fanfare' : 'victory');
        } catch (mergeErr) {
          appendLog(`<li class="pro-log-skip">Couldn't combine into one PDF (${esc(String((mergeErr as { message?: unknown }).message ?? mergeErr))}) - delivering the zip instead.</li>`);
          await relockPdfs();
        }
      }
    }

    if (!delivered) try {
      const zip = await buildZip(files, { zipName: `${zipBaseName}.zip`, author, csv, zipLock, password: strongPassword, unmade, noted, runNotes, retryOf, preflight });
      const archiveName = `${zipBaseName}.zip`;
      // The retained archive is the one just built - locked, if a lock was asked for -
      // so a retry re-hands it without collecting the password again or rebuilding.
      await deliverBatchFile(mount, deliveryLine(), { blob: zip, filename: archiveName, label: archiveName }, host);
      delivered = true;
      zipName = archiveName;
      draw(`<strong>Done - ${files.length} file${files.length === 1 ? '' : 's'} in one zip${tail}.</strong>`);
      announce?.(`Batch complete - ${files.length} file${files.length === 1 ? '' : 's'} in one zip${tail}.`);
      // The whole queue finished - celebrate: the big trumpet for a real batch, the subtle
      // "ta-da" for a lone render (matching the single-session download path).
      if (!isCancelled()) playSfx(total > 1 ? 'fanfare' : 'victory');
    } catch (zipErr) {
      const msg = esc(String((zipErr as { message?: unknown }).message ?? zipErr));
      if (zipLock && strongPassword) {
        // A lock was requested - NEVER fall back to unencrypted sequential downloads,
        // which would silently ship the non-PDF members (and the lolly.txt manifest
        // with author details) in cleartext. Fail loudly and save nothing.
        appendLog(`<li class="pro-log-err">Couldn't build the password-protected zip (${msg}) - nothing was delivered. Try again, or export fewer files at once.</li>`);
        draw(`<strong>Couldn't build the password-protected zip - nothing was saved.</strong>`);
        announce?.('Encrypted download failed; nothing was saved.');
      } else {
        appendLog(`<li class="pro-log-skip">Zip failed (${msg}); downloading files individually…</li>`);
        draw(`<strong>Downloading ${files.length} files individually…</strong>`);
        await saveSequential(files, {
          delayMs: 600,
          onSaved: (n, tot) => draw(`<strong>Saving ${n} / ${tot}…</strong>`),
        });
        delivered = true;
        // Individual anchor downloads: each was REQUESTED, and there is no single
        // archive to retain, so say exactly that - never "downloaded".
        draw(`<strong>Done - ${files.length} files; ${files.length} downloads requested${tail}.</strong>`);
        announce?.(`Batch complete - ${files.length} file${files.length === 1 ? '' : 's'}, downloads requested${tail}.`);
        if (!isCancelled()) playSfx(total > 1 ? 'fanfare' : 'victory'); // finished (fallback path) - big trumpet for a batch, subtle "ta-da" for one
      }
    }
    // Auto-save each delivered member's credentialed bytes into the personal
    // library ('renders' tag). Only when the files actually reached the user (a
    // failed encrypted-zip build delivers nothing). Best-effort + non-blocking;
    // the helper dedupes and honours the profile toggle. `results` push a
    // successful row's outcome in the same order `files` are appended, so the
    // ok-rows line up with the members positionally.
    if (delivered) {
      const okRows = results.filter((r): r is Extract<typeof r, { ok: true }> => r.ok).map(r => r.row);
      const members = files.map((f, i) => ({ blob: f.blob, name: f.name, format: f.fmt, toolId: okRows[i]?.toolId ?? 'render' }));
      void (async () => {
        try {
          const { saveBatchRendersToLibrary } = await import('../lib/save-render.ts');
          await saveBatchRendersToLibrary(host as unknown as Parameters<typeof saveBatchRendersToLibrary>[0], members);
        } catch { /* library save is best-effort */ }
      })();
    }
    offerRetry();
    return settle({ files, results, cancelled: isCancelled(), ...(zipName ? { zipName } : {}) });
  } catch (err) {
    // An owned job must show the failure itself; an inherited one is failed by its
    // wrapper, which is why the error is rethrown either way.
    if (!inheritedJob) job.fail(err);
    throw err;
  } finally {
    clearInterval(quipTimer); // never leave the rotator running
    if (!inheritedJob) releaseBatchJob(job);
  }
}
