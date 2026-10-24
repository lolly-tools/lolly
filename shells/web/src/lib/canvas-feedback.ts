// SPDX-License-Identifier: MPL-2.0
export type CanvasFeedbackLane = 'pointer-preview' | 'pointer-commit' | 'remote-outline' | 'remote-detail';
export interface CanvasFeedbackSample {
  lane: CanvasFeedbackLane;
  started: number;
  appliedMs: number;
  opportunityMs: number;
}
/**
 * Synchronous main-thread work a lab run times on its own: the per-frame stage view
 * fan-out, the editor chrome sync, the address-bar write, the tool's input hook and the
 * undo record. Each sample is one call, start to return.
 */
export type CanvasCostLane = 'stage-view' | 'chrome-sync' | 'url-sync' | 'hook' | 'history';
export interface CanvasCostSample {
  lane: CanvasCostLane;
  started: number;
  durationMs: number;
  /** Which path of the lane ran, where it has more than one (chrome-sync: full, view, live). */
  detail?: string;
}
declare global {
  interface Window {
    /** Present only in a lab run. `costs` opts that run into the cost lanes. */
    __lollyCanvasFeedback?: { enabled: boolean; samples: CanvasFeedbackSample[]; costs?: CanvasCostSample[] };
  }
}
const pending = new WeakMap<object, Map<CanvasFeedbackLane, number>>();
/** A run drains its samples per phase; this only bounds a run that forgets to. */
const COST_LIMIT = 20_000;

/** Opt-in lab timings remain outside document, history and collaboration state. */
export function beginCanvasFeedback(runtime: object, lane: CanvasFeedbackLane, timestamp?: number): void {
  if (typeof window === 'undefined' || !window.__lollyCanvasFeedback?.enabled) return;
  const now = performance.now();
  const start = timestamp !== undefined && timestamp > 0 && timestamp <= now ? timestamp : now;
  let lanes = pending.get(runtime);
  if (!lanes) { lanes = new Map(); pending.set(runtime, lanes); }
  lanes.set(lane, start);
}

export function finishCanvasFeedback(runtime: object, lane: CanvasFeedbackLane): void {
  if (typeof window === 'undefined') return;
  const metrics = window.__lollyCanvasFeedback, lanes = pending.get(runtime), started = lanes?.get(lane);
  if (!metrics?.enabled || started === undefined) return;
  lanes!.delete(lane);
  const appliedMs = performance.now() - started;
  // Two callbacks bracket a presentation opportunity, not physical display latency.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (window.__lollyCanvasFeedback !== metrics || !metrics.enabled) return;
    metrics.samples.push({ lane, started, appliedMs, opportunityMs: performance.now() - started });
    if (metrics.samples.length > 128) metrics.samples.splice(0, metrics.samples.length - 128);
  }));
}

export function cancelCanvasFeedback(runtime: object, lane: CanvasFeedbackLane): void { pending.get(runtime)?.delete(lane); }

/** True only while a lab run collects cost lanes. */
export function canvasCostsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const metrics = window.__lollyCanvasFeedback;
  return !!metrics?.enabled && Array.isArray(metrics.costs);
}

/**
 * The start of one cost span, or -1 when no lab run is listening. Nothing is held
 * between the two calls, so a span that throws before its end simply goes unrecorded.
 */
export function startCanvasCost(): number {
  return canvasCostsEnabled() ? performance.now() : -1;
}

export function endCanvasCost(lane: CanvasCostLane, started: number, detail?: string): void {
  if (started < 0 || !canvasCostsEnabled()) return;
  const costs = window.__lollyCanvasFeedback!.costs!;
  costs.push({ lane, started, durationMs: performance.now() - started, ...(detail ? { detail } : {}) });
  if (costs.length > COST_LIMIT) costs.splice(0, costs.length - COST_LIMIT);
}

type HookSlots = { onInit?: unknown; onInput?: unknown };
/**
 * The same hooks, with `onInit` and `onInput` timed in the `hook` lane. Only the
 * synchronous part of a call is timed: that is the time the hook holds the main thread.
 * Every argument, `this` and return value passes through unchanged.
 */
export function timeHookCalls<T extends HookSlots>(hooks: T): T {
  const timed: T = { ...hooks };
  for (const name of ['onInit', 'onInput'] as const) {
    const run = hooks[name];
    if (typeof run !== 'function') continue;
    timed[name] = function timedHook(this: unknown, ...args: unknown[]): unknown {
      const started = startCanvasCost();
      try { return run.apply(this, args); } finally { endCanvasCost('hook', started); }
    } as T[typeof name];
  }
  return timed;
}
