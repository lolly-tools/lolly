// SPDX-License-Identifier: MPL-2.0
/**
 * Global job progress toast (plans/124 section 9, WP-F).
 *
 * Mounts ONCE on document.body, OUTSIDE main#view, so a router view teardown
 * (viewEl._cleanup, which only replaces #view's contents) never kills it - the
 * user keeps seeing a video/retouch job's progress after they leave the catalog.
 * It is the sole subscriber the async-job foundation (lib/jobs.ts) needs to have
 * a visible UI; every consumer just calls startJob() and this renders.
 *
 * Shape: a collapsed PILL (active job title + candy-stripe bar + cancel ✕) that
 * expands to per-job rows. Hidden entirely when the registry is empty. Above
 * topbar dropdowns and content (z-index in parts/job-toast.css) - and above
 * OPEN MODALS too: z-index can never beat the native <dialog> top layer, and
 * everything outside a showModal() dialog is inert (a popover overlay would
 * paint but not click), so the toast lives in the shared FLOATING CLUSTER
 * (lib/float-cluster.ts) that mountModal (components/modal.ts) adopts into
 * each dialog it opens. position:fixed keeps the viewport spot; being a dialog
 * descendant makes it paint over the modal and stay interactive - a catalog
 * grade/process job stays visible and cancellable while the asset details
 * modal is up.
 *
 * DRAGGABLE: a pointer-drag on the pill or the panel header repositions it
 * (threshold'd so the buttons still click), clamped fully on-screen, same
 * idiom as the perf HUD below. Position is in-memory only - resets on reload.
 *
 * DESKTOP NOTIFICATION (an EXTRA, never the channel - the in-toast completed
 * state always shows too):
 *   - Permission is requested ONLY on the first long (heavy) job start, and only
 *     from inside that user gesture. startJob() emits synchronously, so this
 *     module's listener runs on the same call stack as the Run-button click -
 *     still a user gesture - which is the one place a permission prompt is
 *     allowed. Never at boot.
 *   - A notification fires only when document.hidden, on a job reaching `done`.
 *     Clicking it focuses the tab.
 *   - The channel is probed, not assumed: a shell that installs its own
 *     `window.__lollyNotify` (the desktop app's notification plugin) gets that;
 *     everything else uses the web Notification API. See shellNotify().
 */
import { subscribe, jobsSnapshot, cancelJob, type Job, type JobStatus } from './jobs.ts';
import { getFloatCluster } from './float-cluster.ts';
import { t, tRaw } from '../i18n.ts';
import { isFlagOnSync, perfHudOn, WOBBLY_FLAG } from '../feature-flags.ts';
import type { WobbleHandle } from './wobble.ts';

let root: HTMLElement | null = null;
/** Wobbly-windows deform for the drag; self-gating, owns `transform` only. Null until
 *  the lazy attach below resolves (and forever with the flag off) - every use site is
 *  `wobble?.`, which is the same code path the flag-off case has always taken. */
let wobble: WobbleHandle | null = null;
let expanded = false;
/** Last rendered structural signature - a pure progress tick patches in place. */
let lastSig = '';
/** Requested the Notification permission this session (once, even if denied). */
let permissionRequested = false;
/** Per-job last-seen status, for detecting the transition into `done`. */
const lastStatus = new Map<string, JobStatus>();

const ESC = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, c => (
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]!
));

/**
 * Mount the toast once. Idempotent - safe to call from main.ts boot more than
 * once (a re-entrant boot, HMR) without stacking duplicates or extra listeners.
 */
export function mountJobToast(): void {
  if (root && typeof document !== 'undefined' && document.body.contains(root)) return;
  if (typeof document === 'undefined' || !document.body) return;
  root = document.createElement('div');
  root.className = 'job-toast';
  root.hidden = true;
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');
  root.setAttribute('aria-label', tRaw('Background jobs'));
  root.addEventListener('click', onClick);
  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('pointermove', onPointerMove);
  root.addEventListener('pointerup', onPointerEnd);
  root.addEventListener('pointercancel', onPointerEnd);
  wobble?.dispose();
  wobble = null;
  // Wobble + perf HUD are both opt-in and default OFF, but main.ts mounts this toast at
  // boot - so a static import of either put them on the entry's modulepreload set for
  // every visitor (wobble + wobble-mesh 4.4 KB gz, perf-hud 1.2, measured 2026-08-25).
  // The flag read moves OUT here so the bytes are fetched only by the user who turned
  // the thing on; each module still re-reads its own flag as the real gate, so this
  // outer check is a loader hint, not a second source of truth. A drag landing before
  // the import resolves simply gets no deform (`wobble?.`), exactly as with the flag off.
  const el = root;
  if (isFlagOnSync(WOBBLY_FLAG)) {
    void import('./wobble.ts').then(({ attachWobble }) => {
      if (root !== el) return;            // remounted meanwhile - this handle is stale
      wobble?.dispose();
      wobble = attachWobble(el);
    });
  }
  getFloatCluster().appendChild(root);
  // Esc collapses the expanded panel (no browser-default hijack - only acts when
  // the panel is open and no modal is up, which owns Esc via its own <dialog>).
  document.addEventListener('keydown', onKeydown);
  subscribe(render);
  render(jobsSnapshot());
  // Same body-level floating cluster: the opt-in Performance HUD (lib/perf-hud.ts)
  // mounts here for a returning power user. It reads its own flag and no-ops when
  // off; the perfHudOn() check here is the boot-weight gate described above, so the
  // HUD's bytes never load for the overwhelming majority who never enabled it.
  if (perfHudOn()) void import('./perf-hud.ts').then(({ mountPerfHud }) => mountPerfHud());
}

// ── Drag ─────────────────────────────────────────────────────────────────────
// Delegated on root (the pill/panel innerHTML is replaced on re-render, root
// never is). A drag starts on the pill or the panel header but only becomes a
// drag past a small threshold, so the buttons living there still click; once
// dragging, pointer capture retargets the stream (and the trailing click) to
// root, and the `dragged` flag swallows any click that still lands on a button.
const DRAG_THRESHOLD_PX = 4;
let dragPointer = -1;
let dragging = false;
let dragged = false;
let dragDx = 0; let dragDy = 0; let dragSx = 0; let dragSy = 0;
// Previous pointer pos, so the wobble gets per-move DELTAS (not absolute positions).
let dragLx = 0; let dragLy = 0;

/** Keep the toast fully inside the viewport, given a proposed top-left. */
function clampPos(left: number, top: number): { left: number; top: number } {
  const r = root!.getBoundingClientRect();
  return {
    left: Math.min(Math.max(0, left), Math.max(0, window.innerWidth - r.width)),
    top: Math.min(Math.max(0, top), Math.max(0, window.innerHeight - r.height)),
  };
}

function onPointerDown(e: PointerEvent): void {
  dragged = false;
  if (!root || e.button !== 0) return;
  if (!(e.target as HTMLElement | null)?.closest('.job-pill, .job-panel-head')) return;
  dragPointer = e.pointerId;
  dragSx = e.clientX; dragSy = e.clientY;
  const r = root.getBoundingClientRect();
  dragDx = e.clientX - r.left; dragDy = e.clientY - r.top;
}

function onPointerMove(e: PointerEvent): void {
  if (!root || e.pointerId !== dragPointer) return;
  if (!dragging) {
    if (Math.hypot(e.clientX - dragSx, e.clientY - dragSy) < DRAG_THRESHOLD_PX) return;
    dragging = true;
    root.classList.add('is-dragging');
    try { root.setPointerCapture(e.pointerId); } catch { /* capture is best-effort */ }
    wobble?.grab(e.clientX, e.clientY);
    dragLx = e.clientX; dragLy = e.clientY;
  }
  // Pin to explicit top/left (releasing the CSS bottom/right corner) so the
  // clamp math has one coordinate space - the perf HUD idiom.
  const { left, top } = clampPos(e.clientX - dragDx, e.clientY - dragDy);
  root.style.left = `${left}px`;
  root.style.top = `${top}px`;
  root.style.right = 'auto';
  root.style.bottom = 'auto';
  wobble?.drag(e.clientX - dragLx, e.clientY - dragLy);
  dragLx = e.clientX; dragLy = e.clientY;
  e.preventDefault();
}

function onPointerEnd(e: PointerEvent): void {
  if (e.pointerId !== dragPointer) return;
  dragPointer = -1;
  if (!dragging) return;
  dragging = false;
  dragged = true;
  root?.classList.remove('is-dragging');
  wobble?.release();
  try { root?.releasePointerCapture(e.pointerId); } catch { /* already released */ }
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape' || !expanded) return;
  if (typeof document !== 'undefined' && document.querySelector('dialog[open]')) return; // a modal owns Esc
  expanded = false;
  render(jobsSnapshot());
}

function onClick(e: MouseEvent): void {
  if (dragged) { dragged = false; return; } // the click that ends a drag is not a press
  const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (act === 'expand') { expanded = true; render(jobsSnapshot()); }
  else if (act === 'collapse') { expanded = false; render(jobsSnapshot()); }
  else if (act === 'cancel') { const id = el.dataset.id; if (id) cancelJob(id); }
}

// ── Render ───────────────────────────────────────────────────────────────────

const isActive = (j: Job): boolean => j.status === 'queued' || j.status === 'running';
/** Indeterminate when there is no progress yet, or no known total. */
const isIndef = (j: Job): boolean => !j.progress || j.progress.total <= 0;

/** A signature of everything that changes DOM STRUCTURE (not the progress numbers,
 *  which patch in place) - so a per-frame progress tick keeps its width transition. */
function structureSig(jobs: readonly Job[]): string {
  return `${expanded ? 'E' : 'C'}|${jobs.map(j => `${j.id}:${j.status}:${isIndef(j) ? 'i' : 'd'}:${j.cancellable ? 'x' : ''}`).join(',')}`;
}

function render(jobs: readonly Job[]): void {
  if (!root) return;
  maybeRequestPermission(jobs);
  fireCompletionNotices(jobs);

  if (jobs.length === 0) {
    root.hidden = true;
    root.innerHTML = '';
    expanded = false;
    lastSig = '';
    return;
  }
  root.hidden = false;

  const sig = structureSig(jobs);
  if (sig === lastSig && root.firstChild) { patchProgress(jobs); return; }
  lastSig = sig;

  const active = jobs.filter(isActive);
  if (expanded) root.innerHTML = renderPanel(jobs);
  else root.innerHTML = renderPill(active[0] ?? jobs[jobs.length - 1]!, jobs, active);
  patchProgress(jobs);
  // A dragged toast sits at explicit top/left; pill↔panel swaps change its size,
  // so re-clamp to keep the new box fully on-screen.
  if (root.style.left) {
    const p = clampPos(parseFloat(root.style.left) || 0, parseFloat(root.style.top) || 0);
    root.style.left = `${p.left}px`;
    root.style.top = `${p.top}px`;
  }
}

/** Update only the live numbers/widths in place - keeps the bar's width transition. */
function patchProgress(jobs: readonly Job[]): void {
  if (!root) return;
  for (const j of jobs) {
    const pct = isIndef(j) ? '100%' : `${Math.max(0, Math.min(100, ((j.progress!.done / j.progress!.total) * 100)))}%`;
    root.querySelectorAll<HTMLElement>(`[data-fill="${cssId(j.id)}"]`).forEach(el => { el.style.width = pct; });
    const count = root.querySelector<HTMLElement>(`[data-count="${cssId(j.id)}"]`);
    if (count) count.textContent = countText(j);
    const note = root.querySelector<HTMLElement>(`[data-note="${cssId(j.id)}"]`);
    if (note) note.textContent = j.progress?.note ?? '';
  }
}

/** `job-<n>` is attribute-safe already, but keep the selector escape honest. */
const cssId = (id: string): string => id.replace(/["\\]/g, '\\$&');

function countText(j: Job): string {
  if (!j.progress || j.progress.total <= 0) return '';
  return tRaw('{done} of {total}', { done: j.progress.done, total: j.progress.total });
}

/** One reusable candy-stripe bar. */
function barHtml(j: Job): string {
  return `<span class="job-bar${isIndef(j) ? ' job-bar--indef' : ''}"><span class="job-bar-fill" data-fill="${ESC(j.id)}"></span></span>`;
}

function cancelBtnHtml(j: Job): string {
  if (!isActive(j) || !j.cancellable) return '';
  return `<button type="button" class="job-x" data-act="cancel" data-id="${ESC(j.id)}" aria-label="${ESC(tRaw('Cancel job'))}" title="${ESC(tRaw('Cancel job'))}">\u2715</button>`;
}

const STATUS_WORD: Record<Exclude<JobStatus, 'running'>, string> = {
  queued: 'Queued', done: 'Done', failed: 'Failed', cancelled: 'Cancelled',
};

function renderPill(head: Job, jobs: readonly Job[], active: readonly Job[]): string {
  const count = jobs.length > 1
    ? `<span class="job-pill-count" title="${ESC(tRaw('{n} jobs', { n: jobs.length }))}">${ESC(String(jobs.length))}</span>`
    : '';
  // Active head → title + bar; a lingering finished head → title + a status word.
  const body = isActive(head)
    ? `${barHtml(head)}`
    : `<span class="job-row-status job-row-status--${head.status}">${ESC(t(STATUS_WORD[head.status as Exclude<JobStatus, 'running'>] ?? 'Done'))}</span>`;
  return `<div class="job-pill">
    <button type="button" class="job-pill-main" data-act="expand" aria-label="${ESC(tRaw('Show job details'))}" aria-expanded="false">
      <span class="job-pill-title">${ESC(head.title)}</span>
      ${body}
    </button>
    ${count}
    ${active[0] ? cancelBtnHtml(active[0]) : ''}
  </div>`;
}

function rowHtml(j: Job): string {
  if (isActive(j)) {
    return `<li class="job-row">
      <span class="job-row-title">${ESC(j.title)}</span>
      ${cancelBtnHtml(j)}
      <span class="job-row-bar-wrap">${barHtml(j)}</span>
      <span class="job-row-meta"><span class="job-row-note" data-note="${ESC(j.id)}">${ESC(j.progress?.note ?? '')}</span><span class="job-row-count" data-count="${ESC(j.id)}">${ESC(countText(j))}</span></span>
    </li>`;
  }
  const word = STATUS_WORD[j.status as Exclude<JobStatus, 'running'>] ?? 'Done';
  const detail = j.status === 'failed' && j.error ? `<span class="job-row-note">${ESC(j.error)}</span>`
    : j.status === 'done' ? resultLinkHtml(j)
    : '';
  return `<li class="job-row">
    <span class="job-row-title">${ESC(j.title)}</span>
    <span class="job-row-meta"><span class="job-row-status job-row-status--${j.status}">${ESC(t(word))}</span>${detail}</span>
  </li>`;
}

/** A finished job whose result is a send outcome ({ url?, label }) - e.g. the
 *  export-home auto-send (plans/138) - renders its label, linked when a viewable
 *  URL came back. Any other result shape (a derived asset from a matte/upscale
 *  job) has no label and renders nothing extra. */
function resultLinkHtml(j: Job): string {
  const r = j.result as { url?: unknown; label?: unknown } | null | undefined;
  const label = r && typeof r === 'object' && typeof r.label === 'string' ? r.label : '';
  if (!label) return '';
  const url = r && typeof (r as { url?: unknown }).url === 'string' ? (r as { url: string }).url : '';
  return url
    ? `<a class="job-row-note" href="${ESC(url)}" target="_blank" rel="noopener">${ESC(label)}</a>`
    : `<span class="job-row-note">${ESC(label)}</span>`;
}

function renderPanel(jobs: readonly Job[]): string {
  const rows = jobs.map(rowHtml).join('');
  return `<div class="job-panel">
    <div class="job-panel-head">
      <span class="job-panel-title">${ESC(t('Background jobs'))}</span>
      <button type="button" class="job-x" data-act="collapse" aria-label="${ESC(tRaw('Hide job details'))}" title="${ESC(tRaw('Hide job details'))}">\u2304</button>
    </div>
    <ol class="job-list">${rows}</ol>
    <p class="job-panel-note">${ESC(t('Jobs stop if you reload or close this tab.'))}</p>
  </div>`;
}

// ── Desktop notification ──────────────────────────────────────────────────────

/**
 * Request Notification permission on the FIRST heavy (long) job start, once per
 * session. Runs synchronously inside startJob()'s emit → inside the Run-button
 * click, so it is inside the user gesture a permission prompt requires. If
 * denied or unsupported we simply never notify and rely on the toast.
 */
function maybeRequestPermission(jobs: readonly Job[]): void {
  if (permissionRequested) return;
  if (!jobs.some(j => j.heavy && isActive(j))) return;
  permissionRequested = true;
  requestNotifyPermission();
}

/**
 * The host shell's own notification channel, when it has one (plans/202 WP4.1).
 *
 * The Tauri desktop shell installs `window.__lollyNotify` from
 * shells/tauri-desktop/bridge-overrides/notify.ts, which posts through
 * tauri-plugin-notification - the real platform service, so the notice survives
 * the window closing and carries the app's name and icon. That package cannot be
 * imported here: the Tauri shells are not npm workspaces, so a static import
 * breaks tsc and the web Vite build. A probe for the global costs nothing and
 * upgrades the desktop app with no change at any call site.
 *
 * Absent everywhere else - a browser, the mobile shell, a desktop build where
 * the plugin failed to load - and then the web Notification API below is the
 * channel. That path works inside the Tauri webview too, so a missing global is
 * a smaller notification, never no notification.
 */
interface ShellNotify {
  request(): void;
  send(title: string, body: string): void;
}
function shellNotify(): ShellNotify | null {
  const n = (globalThis as { __lollyNotify?: Partial<ShellNotify> }).__lollyNotify;
  return n && typeof n.request === 'function' && typeof n.send === 'function'
    ? (n as ShellNotify)
    : null;
}

function requestNotifyPermission(): void {
  const shell = shellNotify();
  if (shell) { shell.request(); return; }
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  } catch { /* some engines throw on the deprecated sync form - ignore, toast still shows */ }
}

/** Detect jobs that just reached `done` and (when the tab is hidden) notify. */
function fireCompletionNotices(jobs: readonly Job[]): void {
  const seen = new Set<string>();
  for (const j of jobs) {
    seen.add(j.id);
    const prev = lastStatus.get(j.id);
    if (j.status === 'done' && (prev === 'running' || prev === 'queued')) notifyDone(j);
    lastStatus.set(j.id, j.status);
  }
  for (const id of [...lastStatus.keys()]) if (!seen.has(id)) lastStatus.delete(id);
}

function notifyDone(job: Job): void {
  // In-tab: the toast's completed state is the whole story; no OS notification.
  if (typeof document !== 'undefined' && !document.hidden) return;
  const shell = shellNotify();
  if (shell) {
    shell.send(job.title || tRaw('Job finished'), tRaw('Ready in Lolly.'));
    return;
  }
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const n = new Notification(job.title || tRaw('Job finished'), { body: tRaw('Ready in Lolly.'), tag: job.id });
    n.onclick = () => {
      try { window.focus(); } catch { /* focus can throw in some embeds */ }
      try { n.close(); } catch { /* ignore */ }
    };
  } catch { /* Notification construction can throw; the toast still shows done */ }
}
