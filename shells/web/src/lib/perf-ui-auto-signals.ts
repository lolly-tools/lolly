// SPDX-License-Identifier: MPL-2.0
/**
 * The page side of the temporary Performance UI switch (lib/perf-ui-auto-temporary.ts):
 * it reads CPU pressure, the battery and Save-Data where the browser offers them, tells
 * the switch where time counts, and calls back with each change to make.
 * lib/perf-ui-auto.ts makes the change and shows the notice.
 *
 * What each browser offers (checked in Playwright's Chromium 153 and WebKit 26.6):
 *
 *   - Chromium 125 and later (Chrome, Edge, Opera): PressureObserver with the 'cpu'
 *     source, navigator.getBattery() and navigator.connection.saveData.
 *   - Safari (WebKit) and Firefox: none of the three. No browser tells a page about
 *     macOS or iOS Low Power Mode, Windows battery saver or Chrome's Energy Saver.
 *
 * So this runs in Chromium-based browsers only; elsewhere the measured slowness rules
 * are all there is. Pressure arrives only while the tab is visible and focused, and only
 * when it changes.
 *
 * Readings stay in memory and are reduced at once to what the switch needs: the pressure
 * state, "battery low and discharging" as one yes or no, and Save-Data on or off.
 * Nothing here is stored or sent anywhere.
 *
 * Cost: one PressureObserver, two battery listeners and one Save-Data listener, which
 * all report changes only; five passive input listeners; focus and visibility
 * listeners. A timer runs only while a change is on its way (a constraint or a calm
 * period is being timed), at most every five seconds, so busy work that starts between
 * two inputs is still seen.
 */
import {
  ConstraintSwitch, batteryConstrained, isPressureState,
  type ConstraintDecision, type ConstraintReason, type ConstraintTimings, type Counting,
} from './perf-ui-auto-temporary.ts';

interface PressureObserverLike { observe(source: 'cpu'): Promise<void>; disconnect(): void }
type PressureObserverCtor = new (callback: (records: ReadonlyArray<{ state?: unknown }>) => void) => PressureObserverLike;
interface BatteryLike extends EventTarget { readonly charging: boolean; readonly level: number }
interface ConnectionLike extends EventTarget { readonly saveData?: boolean }

export interface ConstraintWatchOptions {
  /** The current route's name when it is a browse route, otherwise null. */
  browseRoute(): string | null;
  /** True while intentional work is under way (a job, playback, a recording). */
  busy(): boolean;
  /** The temporary look is on now: switched at `at` (epoch ms) for `reason`. */
  on?: { at: number; reason: ConstraintReason };
  /** When the temporary look last switched back (epoch ms), so the minimum time in each
   *  state holds across a reload. */
  backAt?: number;
  timings: ConstraintTimings;
  /** One console line per check, for a browser test: the switch's own summary. */
  probe: boolean;
}

/** While a change is on its way, where time counts is read again at least this often. */
const CHECK_EVERY_MS = 5000;
/** Continuous input re-reads where time counts at most this often. */
const RECHECK_MS = 250;
const INPUTS = ['pointerdown', 'pointermove', 'wheel', 'keydown', 'scroll'] as const;

/**
 * Watch for a constrained device, and for calm once the temporary look is on. Returns a
 * stop function; `decide` receives each change, and the watch keeps running after one,
 * since the temporary look can switch back and on again. Does nothing in a browser
 * without CPU pressure or battery signals.
 */
export function watchConstraints(opts: ConstraintWatchOptions, decide: (decision: ConstraintDecision) => void): () => void {
  const Pressure = (globalThis as { PressureObserver?: PressureObserverCtor }).PressureObserver;
  const nav: Navigator & { getBattery?(): Promise<BatteryLike>; connection?: ConnectionLike } = navigator;
  const sources = { pressure: typeof Pressure === 'function', battery: typeof nav.getBattery === 'function' };
  if (!sources.pressure && !sources.battery) return () => {};
  const now = (): number => performance.now();
  // Stored times are wall-clock; the switch runs on the page's own timeline.
  const toPage = (epoch: number): number => now() - (Date.now() - epoch);
  const sw = new ConstraintSwitch({
    now: now(),
    on: opts.on !== undefined,
    reason: opts.on?.reason,
    changedAt: opts.on ? toPage(opts.on.at) : opts.backAt !== undefined ? toPage(opts.backAt) : undefined,
    sources,
    timings: opts.timings,
  });
  let lastRoute = opts.browseRoute();
  let settleUntil = 0;
  let checkedAt = Number.NEGATIVE_INFINITY;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const counting = (at: number): Counting => {
    checkedAt = at;
    if (document.visibilityState !== 'visible' || !document.hasFocus()) return { constraint: false, calm: false };
    const route = opts.browseRoute();
    if (route !== lastRoute) { lastRoute = route; settleUntil = at + opts.timings.settleMs; }
    const constraint = route !== null && at >= opts.timings.warmupMs && at >= settleUntil && !opts.busy();
    return { constraint, calm: true };
  };

  const check = (): void => {
    if (stopped) return;
    const at = now();
    sw.counting(at, counting(at));
    const decision = sw.step(at);
    if (opts.probe) console.info('[perf-ui-auto:temporary]', JSON.stringify(sw.summary()));
    if (decision) decide(decision);
    if (stopped) return;
    clearTimeout(timer);
    const due = sw.nextStep(at);
    timer = due === null ? undefined : setTimeout(check, Math.min(CHECK_EVERY_MS, Math.max(RECHECK_MS, due - at)));
  };

  const onInput = (event: Event): void => {
    const at = now();
    sw.input(at);
    // With no constraint, where time counts matters to nothing but calm, which only the
    // tab's visibility and focus decide: those have listeners of their own. A calm device
    // pays one comparison per input.
    if (sw.reasonNow() === null) return;
    if (event.type === 'pointerdown' || event.type === 'keydown' || at - checkedAt >= RECHECK_MS) check();
  };

  let observer: PressureObserverLike | null = null;
  if (Pressure) {
    const lost = (): void => { if (stopped) return; sw.unavailable(now(), 'pressure'); check(); };
    try {
      observer = new Pressure(records => {
        const state = records.at(-1)?.state;
        if (stopped || !isPressureState(state)) return;
        sw.pressure(now(), state);
        check();
      });
      observer.observe('cpu').catch(lost);
    } catch { observer = null; lost(); }
  }

  let battery: BatteryLike | null = null;
  const readBattery = (): void => {
    if (stopped || !battery) return;
    sw.battery(now(), batteryConstrained(battery.charging, battery.level));
    check();
  };
  if (sources.battery) {
    Promise.resolve().then(() => nav.getBattery?.()).then(b => {
      if (stopped || !b) return;
      battery = b;
      b.addEventListener('chargingchange', readBattery);
      b.addEventListener('levelchange', readBattery);
      readBattery();
    }, () => { if (stopped) return; sw.unavailable(now(), 'battery'); check(); });
  }

  const conn = nav.connection;
  const readSaveData = (): void => { if (stopped) return; sw.saveData(now(), conn?.saveData === true); check(); };
  sw.saveData(now(), conn?.saveData === true);
  conn?.addEventListener('change', readSaveData);

  const listen = { capture: true, passive: true } as const;
  for (const type of INPUTS) document.addEventListener(type, onInput, listen);
  document.addEventListener('visibilitychange', check);
  window.addEventListener('focus', check);
  window.addEventListener('blur', check);

  function stop(): void {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    for (const type of INPUTS) document.removeEventListener(type, onInput, listen);
    document.removeEventListener('visibilitychange', check);
    window.removeEventListener('focus', check);
    window.removeEventListener('blur', check);
    observer?.disconnect();
    observer = null;
    battery?.removeEventListener('chargingchange', readBattery);
    battery?.removeEventListener('levelchange', readBattery);
    battery = null;
    conn?.removeEventListener('change', readSaveData);
  }
  check();
  return stop;
}
