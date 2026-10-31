// SPDX-License-Identifier: MPL-2.0
/**
 * Automatic Performance UI: turn the `perf-ui` flag on, once, for a device that
 * struggles to draw the chrome, and tell the person with Undo and Keep.
 *
 * Loaded lazily by boot (main.ts) only when nobody has set the flag by hand and this
 * device has not decided yet, or decided without the notice being seen. It never
 * turns the flag off by itself, and it never touches the tool canvas or an export:
 * the Performance UI stylesheet is chrome-only (styles/parts/perf-ui.css).
 *
 * The two signals and every threshold live in lib/perf-ui-auto-detect.ts, which is
 * pure. This module feeds it from the page:
 *
 *   - Software rendering, from the facts the WebGPU startup check already holds
 *     (lib/webgpu/device.ts startupAdapterFacts). Read in memory and dropped; only the
 *     reason code is stored.
 *   - Slowness while the person uses the chrome: passive input listeners open
 *     interaction windows, and either a passive Long Animation Frames observer
 *     (Chromium) or a requestAnimationFrame loop that runs only during interaction
 *     (elsewhere) supplies the frames.
 *
 * Nothing counts in a hidden tab, on a route that is not a browse route (main.ts
 * passes `browseRoute`), right after a route change, or while work is under way: a job
 * (lib/jobs.ts), an original-file preview, fullscreen, or anything marked busy,
 * rendering, recording or playing. An automated browser, a documentation capture and a
 * framed tool never run it; a test opts an automated browser back in with
 * PERF_UI_AUTO_PROBE_KEY. Every listener and observer is removed once it decides, once
 * the person changes the flag, or when stop() is called.
 */
import { PERFORMANCE_UI_FLAG, applyPerfUi, setFlagMirror, subscribePerfUi } from '../feature-flags.ts';
import { t } from '../i18n.ts';
import { captureNeutralPinned } from './capture-neutral.ts';
import { firstRunPromptDue, firstRunPromptShowing, whenFirstRunPrompts } from './first-run-prompts.ts';
import { isIframeMode } from './iframe-mode.ts';
import { activeJobs } from './jobs.ts';
import { previewIsActive } from './preview-activity.ts';
import { showUndoToast } from './undo-toast.ts';
import { startupAdapterFacts, webGpuChecked } from './webgpu/device.ts';
import { PerfEvidence, ROUTE_SETTLE_MS, isSoftwareRenderer, type LongFrame, type MeasurePath } from './perf-ui-auto-detect.ts';
import { readPerfUiAuto, writePerfUiAuto, type PerfUiAutoReason } from './perf-ui-auto-state.ts';

/** localStorage key a browser test sets to '1' so an automated browser runs the detector.
 *  It also turns on one console line per judged second, for the test to read. */
export const PERF_UI_AUTO_PROBE_KEY = 'lolly:perfUiAuto:probe';

/** How long the notice stays before it settles as Keep. Nothing is lost when it goes:
 *  the switch and the reason stay in Settings. */
export const NOTICE_MS = 20_000;

/** Elements in these states are doing intentional work the Performance UI cannot speed up. */
const BUSY_SELECTOR = '[aria-busy="true"], .is-busy, .is-rendering, .is-recording, .is-playing, [data-route-mounting]';

/** Continuous inputs re-check eligibility at most this often; discrete ones every time. */
const RECHECK_MS = 250;
/** The evidence is settled at most once a second. */
const SETTLE_EVERY_MS = 1000;

export interface PerfUiAutoOptions {
  /** The current route's name when it is a browse route (the search bar is its footer),
   *  otherwise null. Only browse routes count. */
  browseRoute(): string | null;
}

function probeOptIn(): boolean {
  try { return localStorage.getItem(PERF_UI_AUTO_PROBE_KEY) === '1'; } catch { return false; }
}

/** Never in a capture, a framed tool or an automated browser (unless a test opts in). */
export function perfUiAutoAllowedHere(): boolean {
  if (typeof document === 'undefined' || isIframeMode() || captureNeutralPinned()) return false;
  const nav = globalThis.navigator;
  const automated = nav?.webdriver === true || /HeadlessChrome/.test(nav?.userAgent ?? '');
  return !automated || probeOptIn();
}

/** True while intentional work is under way. Read at most a few times a second. */
function busyNow(): boolean {
  if (activeJobs().length > 0 || previewIsActive()) return true;
  if (document.fullscreenElement) return true;
  return document.querySelector(BUSY_SELECTOR) !== null;
}

let ownChange = false;

/** Turn the look on for `reason`, store the decision and show the notice. */
export function switchPerfUiOn(reason: PerfUiAutoReason, at = Date.now()): void {
  writePerfUiAuto({ v: 1, state: 'on', reason, at });
  setFlagMirror(PERFORMANCE_UI_FLAG.id, true);
  ownChange = true;
  try { applyPerfUi(true); } finally { ownChange = false; }
  showPerfUiNotice(reason);
}

/** Undo: the look goes back, and this device never switches automatically again. */
export function undoPerfUiAuto(at = Date.now()): void {
  writePerfUiAuto({ v: 1, state: 'undone', at });
  setFlagMirror(PERFORMANCE_UI_FLAG.id, false);
  ownChange = true;
  try { applyPerfUi(false); } finally { ownChange = false; }
}

/** Keep, or the notice timed out: the look stays and the notice is not shown again. */
export function keepPerfUiAuto(): void {
  const rec = readPerfUiAuto();
  if (rec?.state === 'on') writePerfUiAuto({ ...rec, seen: true });
}

/**
 * The notice: a toast with Undo and Keep. It waits for a visible tab, so it never
 * appears unseen in the background, and for any first-run prompt to be answered or
 * dismissed (lib/first-run-prompts.ts), so a person is never asked two things at once. A
 * prompt that opens while the notice is up comes first: the notice steps aside,
 * recording nothing, and returns with its full time once the prompt has gone.
 */
export function showPerfUiNotice(reason: PerfUiAutoReason): void {
  let stopWatching = (): void => {};
  const clear = (): boolean => document.visibilityState === 'visible' && !firstRunPromptDue();
  const show = (): void => {
    const toast = showUndoToast({
      message: reason === 'software'
        ? t('Lolly switched to the simpler, faster look because this device draws without graphics acceleration.')
        : t('Lolly switched to the simpler, faster look because this device was struggling.'),
      undo: () => { stopWatching(); undoPerfUiAuto(); },
      acceptLabel: t('Keep'),
      commit: () => { stopWatching(); keepPerfUiAuto(); },
      duration: NOTICE_MS,
      wrap: true,
    });
    stopWatching = whenFirstRunPrompts(firstRunPromptShowing, () => { toast.withdraw(); wait(); });
  };
  // Checked here first, so `stopWatching` always holds the watcher that is live.
  function wait(): void {
    if (clear()) show();
    else stopWatching = whenFirstRunPrompts(clear, show);
  }
  wait();
}

/** The fields of a Long Animation Frame entry, read without trusting the shape. */
function toLongFrame(entry: PerformanceEntry): LongFrame {
  const e = entry as PerformanceEntry & Partial<Omit<LongFrame, 'startTime' | 'duration'>>;
  const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    startTime: entry.startTime,
    duration: entry.duration,
    renderStart: num(e.renderStart),
    styleAndLayoutStart: num(e.styleAndLayoutStart),
    scripts: Array.isArray(e.scripts) ? e.scripts.map(s => ({ duration: num(s?.duration) })) : [],
  };
}

function loafSupported(): boolean {
  return typeof PerformanceObserver !== 'undefined'
    && (PerformanceObserver.supportedEntryTypes ?? []).includes('long-animation-frame');
}

/**
 * Watch for sustained render-bound slowness. Returns a stop function. Calls `decide`
 * at most once, after which everything is already removed.
 */
export function watchPerfUi(opts: PerfUiAutoOptions, decide: (reason: PerfUiAutoReason) => void): () => void {
  const path: MeasurePath = loafSupported() ? 'loaf' : 'raf';
  const evidence = new PerfEvidence(path);
  const probe = probeOptIn();
  const now = (): number => performance.now();
  let lastRoute = opts.browseRoute();
  let settleUntil = 0;
  let checkedAt = Number.NEGATIVE_INFINITY;
  let eligible = false;
  let lastSettle = 0;
  let rafId = 0;
  let lastFrame = 0;
  let stopped = false;

  const eligibleAt = (at: number): boolean => {
    if (document.visibilityState !== 'visible') return false;
    const route = opts.browseRoute();
    if (route !== lastRoute) { lastRoute = route; settleUntil = at + ROUTE_SETTLE_MS; }
    if (route === null || at < settleUntil) return false;
    return !busyNow();
  };

  const settle = (at: number): void => {
    if (at - lastSettle < SETTLE_EVERY_MS) return;
    lastSettle = at;
    const decided = evidence.settle(at);
    if (probe) console.info('[perf-ui-auto]', path, JSON.stringify(evidence.summary()));
    if (!decided) return;
    stop();
    decide('slow');
  };

  const frame = (at: number): void => {
    rafId = 0;
    if (stopped || document.visibilityState !== 'visible') { lastFrame = 0; return; }
    if (lastFrame) evidence.frameInterval(at, at - lastFrame);
    lastFrame = at;
    if (at < evidence.openUntil()) rafId = requestAnimationFrame(frame);
    else lastFrame = 0;
    settle(at);
  };

  const onInput = (event: Event): void => {
    const at = event.timeStamp > 0 ? event.timeStamp : now();
    const discrete = event.type === 'pointerdown' || event.type === 'keydown';
    if (discrete || at - checkedAt >= RECHECK_MS) { eligible = eligibleAt(at); checkedAt = at; }
    evidence.interaction(at, eligible);
    if (eligible && path === 'raf' && !rafId) rafId = requestAnimationFrame(frame);
    settle(at);
  };

  const onVisibility = (): void => {
    if (document.visibilityState === 'visible') return;
    evidence.cut(now());
    eligible = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    lastFrame = 0;
  };

  let observer: PerformanceObserver | null = null;
  if (path === 'loaf') {
    observer = new PerformanceObserver(list => {
      const at = now();
      // Delivered just after the frames: work that started since then means they
      // belong to it, so they are dropped and the window closes.
      if (!eligibleAt(at)) { evidence.cut(at); eligible = false; return; }
      for (const entry of list.getEntries()) evidence.longFrame(toLongFrame(entry));
      settle(at);
    });
    try { observer.observe({ type: 'long-animation-frame', buffered: false }); } catch { observer = null; }
  }

  const INPUTS = ['pointerdown', 'pointermove', 'wheel', 'keydown', 'scroll'] as const;
  const listen = { capture: true, passive: true } as const;
  for (const type of INPUTS) document.addEventListener(type, onInput, listen);
  document.addEventListener('visibilitychange', onVisibility);
  // The person changing the flag by hand ends the watch: their choice outranks this one.
  const unsubscribe = subscribePerfUi(() => { if (!ownChange) stop(); });

  function stop(): void {
    if (stopped) return;
    stopped = true;
    for (const type of INPUTS) document.removeEventListener(type, onInput, listen);
    document.removeEventListener('visibilitychange', onVisibility);
    observer?.disconnect();
    observer = null;
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    unsubscribe();
  }
  return stop;
}

/**
 * Boot's entry point, called after window load and the first-run welcome. Shows a
 * notice that was never seen, decides at once on a software renderer, and otherwise
 * watches. Returns a stop function (a no-op when there is nothing to watch).
 */
export async function startPerfUiAuto(opts: PerfUiAutoOptions): Promise<() => void> {
  if (!perfUiAutoAllowedHere()) return () => {};
  const rec = readPerfUiAuto();
  if (rec?.state === 'on') {
    if (rec.seen !== true) showPerfUiNotice(rec.reason);
    return () => {};
  }
  if (rec) return () => {};
  // The app cannot run without the startup check, so a failed one means nothing to watch.
  try { await webGpuChecked(); } catch { return () => {}; }
  if (isSoftwareRenderer(startupAdapterFacts())) {
    switchPerfUiOn('software');
    return () => {};
  }
  return watchPerfUi(opts, reason => { switchPerfUiOn(reason); });
}
