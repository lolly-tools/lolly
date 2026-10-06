// SPDX-License-Identifier: MPL-2.0
export type CanvasFeedbackLane = 'pointer-preview' | 'pointer-commit' | 'remote-outline' | 'remote-detail';
export interface CanvasFeedbackSample {
  lane: CanvasFeedbackLane;
  started: number;
  appliedMs: number;
  opportunityMs: number;
}
declare global {
  interface Window {
    __lollyCanvasFeedback?: { enabled: boolean; samples: CanvasFeedbackSample[] };
  }
}
const pending = new WeakMap<object, Map<CanvasFeedbackLane, number>>();

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
