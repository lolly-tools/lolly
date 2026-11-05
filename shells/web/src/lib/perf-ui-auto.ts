// SPDX-License-Identifier: MPL-2.0
/**
 * Automatic Performance UI: turn the `perf-ui` flag on for a device that struggles to
 * draw the chrome, and tell the person with Undo and Keep. Two kinds of switch:
 *
 *   - For a weak device, once and for good: a software renderer at start-up, or
 *     sustained slowness while the person uses the chrome.
 *   - For a constrained device, for a while: sustained CPU pressure (heat, another app)
 *     or a low battery that is not charging. It switches back once the device has been
 *     calm for long enough (lib/perf-ui-auto-temporary.ts has the rules).
 *
 * Loaded lazily by boot (main.ts) only when nobody has set the flag by hand and there is
 * something to do: a kind of switching still allowed here, a temporary look to switch
 * back, or a notice never seen. It never touches the tool canvas or an export: the
 * Performance UI stylesheet is chrome-only (styles/parts/perf-ui.css).
 *
 * The weak-device signals and their thresholds live in lib/perf-ui-auto-detect.ts, which
 * is pure. This module feeds it from the page:
 *
 *   - Software rendering, from the facts the WebGPU startup check already holds
 *     (lib/webgpu/device.ts startupAdapterFacts). Read in memory and dropped; only the
 *     reason code is stored.
 *   - Slowness while the person uses the chrome: passive input listeners open
 *     interaction windows, and a requestAnimationFrame loop that runs only during
 *     interaction supplies the frames. In Chromium, passive Long Animation Frames and
 *     long task observers add where the main thread's time went, and each frame
 *     carries the main-thread time inside it (how late its callback started, plus the
 *     previous frame's work up to the first task after it), so a late frame on an idle
 *     main thread can be told from one the main thread made late.
 *
 * The constraint signals are read by lib/perf-ui-auto-signals.ts.
 *
 * Nothing counts in a hidden tab, on a route that is not a browse route (main.ts
 * passes `browseRoute`), right after a route change, or while work is under way: a job
 * (lib/jobs.ts), an original-file preview, fullscreen, or anything marked busy,
 * rendering, recording or playing. An automated browser, a documentation capture and a
 * framed tool never run it; a test opts an automated browser back in with
 * PERF_UI_AUTO_PROBE_KEY. Every listener and observer is removed once its kind of
 * switching ends, once the person changes the flag, or when stop() is called.
 *
 * Every tab of one origin shares the record, and each runs its own watches. So an
 * automatic change reads the record again just before it writes, and asks the profile
 * whether the person has chosen by hand since this tab started: an Undo, a Keep or a
 * hand choice made in another tab always stands. The storage event carries those
 * choices from the other tabs, and each one ends the matching watch here, as it would
 * in the tab where it was made.
 */
import { FLAG_MIRROR_KEY, PERFORMANCE_UI_FLAG, applyPerfUi, setFlagMirror, subscribePerfUi } from '../feature-flags.ts';
import { t } from '../i18n.ts';
import { captureNeutralPinned } from './capture-neutral.ts';
import { firstRunPromptDue, firstRunPromptShowing, whenFirstRunPrompts } from './first-run-prompts.ts';
import { isIframeMode } from './iframe-mode.ts';
import { activeJobs } from './jobs.ts';
import { previewIsActive } from './preview-activity.ts';
import { showUndoToast } from './undo-toast.ts';
import { startupAdapterFacts, webGpuChecked } from './webgpu/device.ts';
import { PerfEvidence, ROUTE_SETTLE_MS, isSoftwareRenderer, type LongFrame, type MeasurePath } from './perf-ui-auto-detect.ts';
import { watchConstraints } from './perf-ui-auto-signals.ts';
import { CONSTRAINT_TIMINGS, scaledTimings } from './perf-ui-auto-temporary.ts';
import {
  PERF_UI_AUTO_KEY, isConstraintReason, readPerfUiAuto, writePerfUiAuto,
  type PerfUiAutoReason, type PerfUiConstraintReason, type PerfUiWeakReason,
} from './perf-ui-auto-state.ts';

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
  /** Resolves true once the profile holds a hand choice for the flag. Asked again before
   *  every automatic change, since the person may have chosen in another tab. Without
   *  it, only a hand choice made in this tab counts. */
  handChoice?(): Promise<boolean>;
}

/** With the probe on, a browser test may also divide the temporary switch's timings by
 *  this key's number, since it cannot wait ten minutes. Ignored without the probe. */
export const PERF_UI_AUTO_TIMESCALE_KEY = 'lolly:perfUiAuto:timescale';

function probeOptIn(): boolean {
  try { return localStorage.getItem(PERF_UI_AUTO_PROBE_KEY) === '1'; } catch { return false; }
}

function constraintTimings(): typeof CONSTRAINT_TIMINGS {
  if (!probeOptIn()) return CONSTRAINT_TIMINGS;
  try { return scaledTimings(Number(localStorage.getItem(PERF_UI_AUTO_TIMESCALE_KEY) ?? 1)); } catch { return CONSTRAINT_TIMINGS; }
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
/** Ends the constraint watch in this tab: Undo or Keep on the temporary notice, or a
 *  switch for good, ends temporary switching. */
let stopConstraintWatch: () => void = () => {};
/** Takes down a notice that is showing or waiting, when the look it describes is gone. */
let cancelNotice: () => void = () => {};

/** Set the look and its mirror, as Lolly's own change, which the watches ignore. */
function setLook(on: boolean): void {
  setFlagMirror(PERFORMANCE_UI_FLAG.id, on);
  ownChange = true;
  try { applyPerfUi(on); } finally { ownChange = false; }
}

/** Turn the look on for good, for a weak device, store the decision and show the notice.
 *  Nothing happens when the record, read again now, holds an Undo of this kind or a look
 *  that is already on: either may come from another tab since this one started. */
export function switchPerfUiOn(reason: PerfUiWeakReason, at = Date.now()): void {
  const rec = readPerfUiAuto();
  if (rec.undone?.weak !== undefined || rec.on) {
    // On for good already (switched or kept elsewhere): no temporary switch either.
    if (rec.on?.kind === 'lasting') stopConstraintWatch();
    return;
  }
  stopConstraintWatch();
  writePerfUiAuto({ ...rec, on: { kind: 'lasting', reason, at } });
  setLook(true);
  showPerfUiNotice(reason);
}

/** Turn the look on for a while, for a constrained device, and show the notice. Nothing
 *  happens when the record, read again now, holds an Undo of temporary switching or a
 *  look that is on for good, whichever tab wrote the record. */
export function switchPerfUiTemporarily(reason: PerfUiConstraintReason, at = Date.now()): void {
  const rec = readPerfUiAuto();
  if (rec.undone?.constrained !== undefined || rec.on?.kind === 'lasting') { stopConstraintWatch(); return; }
  writePerfUiAuto({ ...rec, on: { kind: 'temporary', reason, at } });
  setLook(true);
  showPerfUiNotice(reason);
}

/** The device has calmed down: the temporary look goes back, without a word, and the
 *  time is kept so the next switch waits its turn. */
export function switchPerfUiBack(at = Date.now()): void {
  const rec = readPerfUiAuto();
  if (rec.on?.kind !== 'temporary') return;
  cancelNotice();
  delete rec.on;
  writePerfUiAuto({ ...rec, backAt: at });
  setLook(false);
}

/** Still on for a while, for another reason now: the record follows, so Settings says why. */
function followConstraint(reason: PerfUiConstraintReason): void {
  const rec = readPerfUiAuto();
  if (rec.on?.kind !== 'temporary' || rec.on.reason === reason) return;
  writePerfUiAuto({ ...rec, on: { ...rec.on, reason } });
  setLook(true); // tells an open Settings view; the look itself is unchanged
}

/** Undo: the look goes back, and this device never switches automatically again for
 *  that kind of reason: a weak device, or a constrained one. The notice passes the
 *  reason it described, which decides the kind even when another tab has changed the
 *  record since (a Keep there turns a temporary switch into a lasting one). */
export function undoPerfUiAuto(at = Date.now(), reason?: PerfUiAutoReason): void {
  const rec = readPerfUiAuto();
  const constrained = reason === undefined ? rec.on?.kind === 'temporary' : isConstraintReason(reason);
  const kind = constrained ? 'constrained' : 'weak';
  if (kind === 'constrained') stopConstraintWatch();
  delete rec.on;
  writePerfUiAuto({ ...rec, undone: { ...rec.undone, [kind]: at } });
  setLook(false);
}

/** Keep: the look stays for good. A temporary switch becomes a lasting one, so the
 *  constraint watch ends; a lasting one only marks its notice seen. */
export function keepPerfUiAuto(): void {
  const rec = readPerfUiAuto();
  if (!rec.on) return;
  if (rec.on.kind === 'temporary') {
    stopConstraintWatch();
    writePerfUiAuto({ ...rec, on: { kind: 'lasting', reason: rec.on.reason, at: rec.on.at, seen: true } });
    setLook(true); // tells an open Settings view; the look itself is unchanged
    return;
  }
  writePerfUiAuto({ ...rec, on: { ...rec.on, seen: true } });
}

/** The notice timed out: nothing changes but that it is not shown again. A temporary
 *  switch stays temporary. */
function noticeSeen(): void {
  const rec = readPerfUiAuto();
  if (rec.on) writePerfUiAuto({ ...rec, on: { ...rec.on, seen: true } });
}

function noticeText(reason: PerfUiAutoReason): string {
  switch (reason) {
    case 'software': return t('Lolly switched to the simpler, faster look because this device draws without graphics acceleration.');
    case 'slow': return t('Lolly switched to the simpler, faster look because this device was struggling.');
    case 'pressure': return t('Lolly switched to the simpler, faster look while this device is busy. It switches back when things calm down.');
    case 'battery': return t('Lolly switched to the simpler, faster look while the battery is low. It switches back when this device is charging.');
  }
}

/**
 * The notice: a toast with Undo and Keep. It waits for a visible tab, so it never
 * appears unseen in the background, and for any first-run prompt to be answered or
 * dismissed (lib/first-run-prompts.ts), so a person is never asked two things at once. A
 * prompt that opens while the notice is up comes first: the notice steps aside,
 * recording nothing, and returns with its full time once the prompt has gone.
 *
 * For a temporary switch, Keep makes it lasting, while letting the notice time out
 * leaves it temporary.
 */
export function showPerfUiNotice(reason: PerfUiAutoReason): void {
  cancelNotice();
  let stopWatching = (): void => {};
  let withdraw = (): void => {};
  const clear = (): boolean => document.visibilityState === 'visible' && !firstRunPromptDue();
  const done = (): void => { stopWatching(); cancelNotice = () => {}; };
  const show = (): void => {
    const toast = showUndoToast({
      message: noticeText(reason),
      undo: () => { done(); undoPerfUiAuto(Date.now(), reason); },
      acceptLabel: t('Keep'),
      ...(isConstraintReason(reason) ? { onAccept: () => { done(); keepPerfUiAuto(); } } : {}),
      commit: () => { done(); if (isConstraintReason(reason)) noticeSeen(); else keepPerfUiAuto(); },
      duration: NOTICE_MS,
      wrap: true,
    });
    withdraw = () => { toast.withdraw(); };
    stopWatching = whenFirstRunPrompts(firstRunPromptShowing, () => { toast.withdraw(); withdraw = () => {}; wait(); });
  };
  // Checked here first, so `stopWatching` always holds the watcher that is live.
  function wait(): void {
    if (clear()) show();
    else stopWatching = whenFirstRunPrompts(clear, show);
  }
  cancelNotice = () => { stopWatching(); withdraw(); cancelNotice = () => {}; };
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
    scripts: Array.isArray(e.scripts) ? e.scripts.map(s => ({ startTime: num(s?.startTime), duration: num(s?.duration) })) : [],
  };
}

function observable(type: string): boolean {
  return typeof PerformanceObserver !== 'undefined'
    && (PerformanceObserver.supportedEntryTypes ?? []).includes(type);
}

/**
 * Watch for sustained render-bound slowness. Returns a stop function. Calls `decide`
 * at most once, after which everything is already removed.
 */
export function watchPerfUi(opts: PerfUiAutoOptions, decide: (reason: PerfUiWeakReason) => void): () => void {
  const path: MeasurePath = observable('long-animation-frame') ? 'loaf' : 'raf';
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
  // When the first task after the previous frame ran: the end of that frame's own
  // main-thread work, rendering included. 0 until it has run.
  let lastFrameDone = 0;
  let stopped = false;
  const channel = path === 'loaf' ? new MessageChannel() : null;
  if (channel) channel.port1.onmessage = () => { lastFrameDone = now(); };

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
    if (probe) console.info('[perf-ui-auto]', path, JSON.stringify({ ...evidence.summary(), lateFrames: evidence.lateCounted }));
    if (!decided) return;
    stop();
    decide('slow');
  };

  const frame = (at: number): void => {
    rafId = 0;
    if (stopped || document.visibilityState !== 'visible') { lastFrame = 0; return; }
    if (lastFrame) {
      const interval = at - lastFrame;
      if (path === 'raf') evidence.frameInterval(at, interval);
      else {
        // The previous frame's work counts in full when its first task after has not
        // run yet: the main thread never came free, so nothing here is the compositor's.
        const previous = lastFrameDone > lastFrame ? lastFrameDone - lastFrame : interval;
        evidence.compositorFrame(at, interval, previous + Math.max(0, now() - at));
      }
    }
    lastFrame = at;
    lastFrameDone = 0;
    channel?.port2.postMessage(0);
    if (at < evidence.openUntil()) rafId = requestAnimationFrame(frame);
    else lastFrame = 0;
    settle(at);
  };

  const onInput = (event: Event): void => {
    const at = event.timeStamp > 0 ? event.timeStamp : now();
    const discrete = event.type === 'pointerdown' || event.type === 'keydown';
    if (discrete || at - checkedAt >= RECHECK_MS) { eligible = eligibleAt(at); checkedAt = at; }
    evidence.interaction(at, eligible);
    if (eligible && !rafId) rafId = requestAnimationFrame(frame);
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
  let tasks: PerformanceObserver | null = null;
  if (path === 'loaf') {
    observer = new PerformanceObserver(list => {
      const at = now();
      const entries = list.getEntries();
      // The work inside every long frame can rule out a late frame, whether or not the
      // long frame counts itself.
      const frames = entries.map(toLongFrame);
      for (const f of frames) evidence.frameWork(f);
      // Delivered just after the frames: work that started since then means they
      // belong to it, so they are dropped and the window closes.
      if (!eligibleAt(at)) { evidence.cut(at); eligible = false; return; }
      for (const f of frames) evidence.longFrame(f);
      settle(at);
    });
    try { observer.observe({ type: 'long-animation-frame', buffered: false }); } catch { observer = null; }
    if (observable('longtask')) {
      tasks = new PerformanceObserver(list => { for (const entry of list.getEntries()) evidence.longTask(entry.startTime, entry.duration); });
      try { tasks.observe({ type: 'longtask', buffered: false }); } catch { tasks = null; }
    }
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
    tasks?.disconnect();
    tasks = null;
    channel?.port1.close();
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    unsubscribe();
  }
  return stop;
}

/** The flag's value in a copy of the mirror (feature-flags.ts), as a storage event
 *  carries it; undefined when it holds none or cannot be read. */
function mirroredPerfUi(raw: string | null): boolean | undefined {
  try {
    const value = (JSON.parse(raw ?? '{}') as Record<string, unknown>)[PERFORMANCE_UI_FLAG.id];
    return typeof value === 'boolean' ? value : undefined;
  } catch { return undefined; }
}

/**
 * Boot's entry point, called after window load and the first-run welcome. Shows a
 * notice that was never seen, decides at once on a software renderer, and otherwise
 * watches: for slowness, for a constrained device, or, while the temporary look is on,
 * for calm. Returns a stop function (a no-op when there is nothing to watch).
 */
export async function startPerfUiAuto(opts: PerfUiAutoOptions): Promise<() => void> {
  if (!perfUiAutoAllowedHere()) return () => {};
  const first = readPerfUiAuto();
  if (first.on && first.on.seen !== true) showPerfUiNotice(first.on.reason);
  if (first.on?.kind === 'lasting') return () => {};
  // The app cannot run without the startup check, so a failed one means nothing to watch.
  try { await webGpuChecked(); } catch { return () => {}; }
  const handChoice = (): Promise<boolean> => (opts.handChoice ? opts.handChoice().catch(() => false) : Promise.resolve(false));
  const rec = readPerfUiAuto();
  const weakAllowed = rec.undone?.weak === undefined && !rec.on;
  if (weakAllowed && isSoftwareRenderer(startupAdapterFacts())) {
    const chosen = await handChoice();
    if (!chosen) switchPerfUiOn('software');
    return () => {};
  }
  let stopped = false;
  /** Make an automatic change once the profile has answered. A hand choice, made in this
   *  tab or another, ends every watch here instead and changes nothing. */
  const unlessHandChoice = (change?: () => void): void => {
    void handChoice().then(chosen => {
      if (stopped) return;
      if (chosen) stopAll();
      else change?.();
    });
  };
  let stopWeak = (): void => {};
  if (weakAllowed) stopWeak = watchPerfUi(opts, reason => { unlessHandChoice(() => { switchPerfUiOn(reason); }); });
  if (rec.undone?.constrained === undefined && rec.on?.kind !== 'lasting') {
    const temporary = rec.on?.kind === 'temporary' ? { at: rec.on.at, reason: rec.on.reason } : undefined;
    stopConstraintWatch = watchConstraints({
      browseRoute: opts.browseRoute,
      busy: busyNow,
      on: temporary,
      backAt: rec.backAt,
      timings: constraintTimings(),
      probe: probeOptIn(),
    }, decision => {
      unlessHandChoice(() => {
        if (decision.kind === 'off') { switchPerfUiBack(); return; }
        if (decision.kind === 'reason') { followConstraint(decision.reason); return; }
        // The look is on now, so slowness measured from here would be the simpler look's.
        // The slowness watch runs again from the next start.
        stopWeak();
        switchPerfUiTemporarily(decision.reason);
      });
    });
  }
  // Another tab's choices arrive here. An Undo, or a look already on there, ends the
  // watch of that kind, as the same choice made in this tab would. A change to the
  // flag's mirror may be a hand choice, which only the profile can confirm.
  const onStorage = (event: StorageEvent): void => {
    if (event.key === FLAG_MIRROR_KEY) {
      if (mirroredPerfUi(event.oldValue) !== mirroredPerfUi(event.newValue)) unlessHandChoice();
      return;
    }
    if (event.key !== null && event.key !== PERF_UI_AUTO_KEY) return;
    const now = readPerfUiAuto();
    if (now.undone?.weak !== undefined || now.on) stopWeak();
    if (now.undone?.constrained !== undefined || now.on?.kind === 'lasting') stopConstraintWatch();
  };
  window.addEventListener('storage', onStorage);
  // The person changing the flag by hand ends every watch: their choice outranks these.
  const unsubscribe = subscribePerfUi(() => { if (!ownChange) stopAll(); });
  function stopAll(): void {
    stopped = true;
    window.removeEventListener('storage', onStorage);
    unsubscribe();
    stopWeak();
    stopConstraintWatch();
  }
  return stopAll;
}
