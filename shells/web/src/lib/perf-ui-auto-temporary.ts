// SPDX-License-Identifier: MPL-2.0
/**
 * The temporary Performance UI switch, for a device whose resources are constrained
 * rather than weak: a powerful machine that is throttling for heat, sharing its
 * processor with a heavy app or running low on battery draws the chrome as badly as a
 * weak one, but only for a while. lib/perf-ui-auto-signals.ts feeds it from the page;
 * this module is pure (no DOM, no clock, no storage), and every time is on the page's
 * performance.now() timeline, so the tests drive it with synthetic timelines.
 *
 * The signals, read where the browser offers them and never stored:
 *
 *   - CPU pressure (Compute Pressure API): 'serious' or 'critical' is a constraint.
 *     'fair' is not: the specification describes it as slightly elevated, with the
 *     device still running flawlessly.
 *   - Battery (Battery Status API): discharging at LOW_BATTERY_LEVEL or below.
 *   - Save-Data (navigator.connection.saveData): never a constraint by itself. With it
 *     on, a constraint has to last half as long before the switch, because the person
 *     has asked the browser for lighter pages.
 *
 * The switch has two states, the full look and the simpler one, and strong hysteresis
 * between them: on after a minute of unbroken constraint, back after five minutes of
 * unbroken calm, at least ten minutes in either state, and never under a gesture.
 *
 * Where time counts is part of the rule. Constrained time counts only on the browse
 * routes, with nothing busy, after the first seconds and a route change (the same
 * exclusions as the slowness rule), because Lolly's own work raises CPU pressure too.
 * Calm counts on any screen: nothing Lolly does can make a hot device read calm. A
 * hidden or unfocused tab counts neither, since the browser stops reporting pressure.
 */
import { ROUTE_SETTLE_MS, WARMUP_MS } from './perf-ui-auto-detect.ts';
import type { PerfUiConstraintReason } from './perf-ui-auto-state.ts';

export type PressureState = 'nominal' | 'fair' | 'serious' | 'critical';

/** Why the temporary look is on. Stored as the reason code, nothing else. */
export type ConstraintReason = PerfUiConstraintReason;

/** Battery at or below this share, and discharging, is a constraint. 20% is where
 *  Windows' battery saver and Chrome's Energy Saver turn on by default, and where iOS
 *  first offers Low Power Mode. */
export const LOW_BATTERY_LEVEL = 0.2;

export interface ConstraintTimings {
  /** A constraint must last this long, unbroken, while it counts. */
  onMs: number;
  /** The same with Save-Data on. */
  saveDataOnMs: number;
  /** Calm must last this long, unbroken, before the look switches back. */
  calmMs: number;
  /** After any automatic change the look stays as it is for at least this long. */
  dwellMs: number;
  /** A stretch this long with no constrained time counting makes the time before it stale. */
  staleMs: number;
  /** A change waits until input has paused this long. */
  quietMs: number;
  /** Nothing counts towards a constraint this soon after the page started. */
  warmupMs: number;
  /** Nor this soon after a route change. */
  settleMs: number;
}

export const CONSTRAINT_TIMINGS: Readonly<ConstraintTimings> = {
  // The browser smooths pressure and reports only changes. The spikes of ordinary use
  // (a page loading, an app opening, a build step) last seconds; heat throttling and an
  // app that hogs the processor last minutes. A minute of unbroken 'serious' is the
  // second kind, and is still early enough to help.
  onMs: 60_000,
  saveDataOnMs: 30_000,
  // Five times the on side. A device cooling down after throttling takes minutes, and a
  // build or an export in another app comes back in waves; a device that is busy on and
  // off stays on the simpler look instead of flipping between the two.
  calmMs: 5 * 60_000,
  // At most one automatic change in ten minutes, whatever the readings do, so the look
  // can never flicker. The calm side already needs five minutes; this also stops a
  // quick return to the simpler look right after switching back.
  dwellMs: 10 * 60_000,
  // As long as the on side itself: evidence older than a whole run says nothing about now.
  staleMs: 60_000,
  // Two seconds without input: a person scrolling or dragging never sees the look change
  // under the pointer, and a constrained device still switches within moments of a pause.
  quietMs: 2000,
  warmupMs: WARMUP_MS,
  settleMs: ROUTE_SETTLE_MS,
};

/** Every timing divided by `scale`, for a browser test that cannot wait ten minutes. */
export function scaledTimings(scale: number): ConstraintTimings {
  const s = Number.isFinite(scale) && scale >= 1 ? scale : 1;
  const out = { ...CONSTRAINT_TIMINGS };
  for (const key of Object.keys(out) as Array<keyof ConstraintTimings>) out[key] = out[key] / s;
  return out;
}

export function isPressureState(value: unknown): value is PressureState {
  return value === 'nominal' || value === 'fair' || value === 'serious' || value === 'critical';
}

/** Is a battery at `level` (0 to 1) that is or is not `charging` a constraint? The wiring
 *  keeps only this answer; the level itself is read and dropped. */
export function batteryConstrained(charging: boolean, level: number): boolean {
  return !charging && Number.isFinite(level) && level >= 0 && level <= LOW_BATTERY_LEVEL;
}

/** Where the time from now on may count, as the wiring sees the page. */
export interface Counting {
  /** Constrained time counts: a visible, focused tab on a browse route that has settled,
   *  nothing busy, the first seconds over. */
  constraint: boolean;
  /** Calm counts: a visible, focused tab, on any route. */
  calm: boolean;
}

export type ConstraintDecision =
  | { kind: 'on'; reason: ConstraintReason }
  | { kind: 'off' }
  /** Still on, for another reason now (the battery is charging, the processor still busy). */
  | { kind: 'reason'; reason: ConstraintReason };

export interface ConstraintSources { pressure: boolean; battery: boolean }

export interface ConstraintSwitchStart {
  now: number;
  /** The temporary look is already on (switched in an earlier session). */
  on?: boolean;
  /** When the look last changed automatically, on the same timeline. */
  changedAt?: number;
  /** Why the look is on, when `on`. */
  reason?: ConstraintReason;
  /** Which signals this browser offers. */
  sources: ConstraintSources;
  timings?: ConstraintTimings;
}

/**
 * The temporary switch's state and clock. The wiring reports every change of signal,
 * of where time counts, and every input, then calls step(), which returns at most one
 * change for the wiring to make. Between two reports nothing changes, so each stretch
 * of time is judged by the readings that held during that stretch.
 */
export class ConstraintSwitch {
  private readonly timing: ConstraintTimings;
  private readonly sources: ConstraintSources;
  private at: number;
  private on: boolean;
  private changedAt: number;
  private reason: ConstraintReason | null = null;
  private pressureNow: PressureState | null = null;
  private batteryNow: boolean | null = null;
  private saveDataOn = false;
  private count: Counting = { constraint: false, calm: false };
  private lastInput = Number.NEGATIVE_INFINITY;
  /** Unbroken constrained time that counted. */
  private constrainedMs = 0;
  /** Unbroken calm time that counted. */
  private calmMs = 0;
  /** Time since constrained time last counted, for staleness. */
  private idleMs = 0;

  constructor(start: ConstraintSwitchStart) {
    this.timing = start.timings ?? CONSTRAINT_TIMINGS;
    this.sources = { ...start.sources };
    this.at = start.now;
    this.on = start.on === true;
    this.changedAt = start.changedAt ?? Number.NEGATIVE_INFINITY;
    if (this.on) this.reason = start.reason ?? null;
  }

  /** Whether the temporary look is on, as far as this switch knows. */
  get isOn(): boolean { return this.on; }

  /** The constraint now, pressure first since it is about drawing; null when there is none. */
  reasonNow(): ConstraintReason | null {
    if (this.pressureNow === 'serious' || this.pressureNow === 'critical') return 'pressure';
    if (this.batteryNow === true) return 'battery';
    return null;
  }

  /** Calm: no constraint, and every signal this browser offers has said so. */
  private calmNow(): boolean {
    if (this.reasonNow() !== null) return false;
    if (this.sources.pressure && this.pressureNow === null) return false;
    if (this.sources.battery && this.batteryNow === null) return false;
    return this.sources.pressure || this.sources.battery;
  }

  pressure(t: number, state: PressureState): void { this.advance(t); this.pressureNow = state; }
  battery(t: number, constrained: boolean): void { this.advance(t); this.batteryNow = constrained; }
  saveData(t: number, on: boolean): void { this.advance(t); this.saveDataOn = on; }
  counting(t: number, count: Counting): void { this.advance(t); this.count = { ...count }; }
  input(t: number): void { this.advance(t); this.lastInput = Math.max(this.lastInput, t); }

  /** A signal stopped being available (the browser refused the observer). */
  unavailable(t: number, source: keyof ConstraintSources): void {
    this.advance(t);
    this.sources[source] = false;
    if (source === 'pressure') this.pressureNow = null;
    else this.batteryNow = null;
  }

  /** Bring the clock to `t` and decide: the change to make now, or null. */
  step(t: number): ConstraintDecision | null {
    this.advance(t);
    const quiet = t - this.lastInput >= this.timing.quietMs;
    const settled = t - this.changedAt >= this.timing.dwellMs;
    if (!this.on) {
      const reason = this.reasonNow();
      if (!reason || this.constrainedMs < this.needOn() || !settled || !quiet) return null;
      this.change(t, true);
      this.reason = reason;
      return { kind: 'on', reason };
    }
    if (this.calmMs >= this.timing.calmMs && settled && quiet) {
      this.change(t, false);
      this.reason = null;
      return { kind: 'off' };
    }
    // Still on: the reason follows the constraint that holds now, while it counts, so
    // Settings never says "when this device is charging" about one that already is.
    const now = this.reasonNow();
    if (now && this.count.calm && now !== this.reason) {
      this.reason = now;
      return { kind: 'reason', reason: now };
    }
    return null;
  }

  /** When to call step() again if nothing changes, or null when nothing is heading
   *  towards a change (so the wiring can stop its timer). */
  nextStep(t: number): number | null {
    this.advance(t);
    let due: number;
    if (!this.on) {
      if (this.reasonNow() === null || !this.count.constraint) return null;
      due = t + Math.max(0, this.needOn() - this.constrainedMs);
    } else {
      if (!this.calmNow() || !this.count.calm) return null;
      due = t + Math.max(0, this.timing.calmMs - this.calmMs);
    }
    return Math.max(due, this.changedAt + this.timing.dwellMs, this.lastInput + this.timing.quietMs);
  }

  /** The state in numbers, for the probe log and the tests. Never stored. */
  summary(): { on: boolean; now: 'constrained' | 'calm' | 'unknown'; constrainedMs: number; calmMs: number } {
    const now = this.reasonNow() ? 'constrained' : this.calmNow() ? 'calm' : 'unknown';
    return { on: this.on, now, constrainedMs: Math.round(this.constrainedMs), calmMs: Math.round(this.calmMs) };
  }

  private needOn(): number {
    return this.saveDataOn ? this.timing.saveDataOnMs : this.timing.onMs;
  }

  private change(t: number, on: boolean): void {
    this.on = on;
    this.changedAt = t;
    this.constrainedMs = 0;
    this.calmMs = 0;
    this.idleMs = 0;
  }

  /** Judge the stretch from the last report to `t` by the readings that held throughout. */
  private advance(t: number): void {
    if (!(t > this.at)) return;
    const dt = t - this.at;
    this.at = t;
    const constrained = this.reasonNow() !== null;
    if (constrained && this.count.constraint) {
      this.constrainedMs += dt;
      this.calmMs = 0;
      this.idleMs = 0;
      return;
    }
    if (!constrained && this.calmNow() && this.count.calm) {
      // Calm anywhere breaks a constrained run: it was a spike, not a constraint.
      this.calmMs += dt;
      this.constrainedMs = 0;
    } else if (constrained && this.count.calm) {
      // Constrained where it cannot count towards the switch (another screen, busy work)
      // still breaks calm: unbroken means unbroken.
      this.calmMs = 0;
    }
    this.idleMs += dt;
    if (this.idleMs > this.timing.staleMs) this.constrainedMs = 0;
  }
}
