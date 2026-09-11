// SPDX-License-Identifier: MPL-2.0
/**
 * Dev-only onFrame fps meter (plans/86-worker-isolation-hooks.md M0/M3).
 *
 * Measures how many live-camera frames a tool actually processes per second, so
 * the onFrame → OffscreenCanvas-in-a-Worker migration's "pixel work leaves the
 * main thread is a net win" claim is measured, not asserted - the SAME meter
 * reads the in-realm and the worker path (it counts render emissions, which the
 * runtime fires once per applied onFrame patch), so the two are directly
 * comparable.
 *
 * OFF by default (localStorage `lolly.frameFps` !== '1'), and when off both
 * `fpsTick` and `startFrameFps` are ~free - no timer, no allocation - so it never
 * touches the shipping live path. Turn on: `localStorage.lolly.frameFps = '1'`,
 * then Go live; each second logs `[fps] <toolId> <n>/s` and updates
 * `globalThis.__lollyFrameFps` for a test/automation read.
 */

/** Pure: frames-per-second over a window, rounded to 1 dp. 0 for a non-positive
 *  window (a guard against a zero/negative dt producing Infinity/NaN). */
export function computeFps(frames: number, dtMs: number): number {
  if (!(dtMs > 0)) return 0;
  return Math.round((frames / (dtMs / 1000)) * 10) / 10;
}

interface Meter {
  toolId: string;
  count: number;
  last: number;
  timer: ReturnType<typeof setInterval>;
}

let meter: Meter | null = null;

function enabled(): boolean {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem('lolly.frameFps') === '1'; }
  catch { return false; }
}

/** Count one processed frame. Called from the render subscription; a no-op (one
 *  null check) when the meter is inactive, so it's free on the shipping path. */
export function fpsTick(): void {
  if (meter) meter.count++;
}

/** Begin metering for `toolId` (no-op unless the dev flag is on). Idempotent - 
 *  restarts cleanly. `clock` is injectable for tests; defaults to performance.now. */
export function startFrameFps(toolId: string, clock: () => number = () => performance.now()): void {
  if (!enabled()) return;
  stopFrameFps();
  const m: Meter = {
    toolId, count: 0, last: clock(),
    timer: setInterval(() => {
      const now = clock();
      const fps = computeFps(m.count, now - m.last);
      // eslint-disable-next-line no-console -- dev instrument, gated behind a flag
      console.info(`[fps] ${toolId} ${fps}/s (${m.count} frames)`);
      (globalThis as { __lollyFrameFps?: unknown }).__lollyFrameFps = { toolId, fps, frames: m.count };
      m.count = 0;
      m.last = now;
    }, 1000),
  };
  meter = m;
}

/** Stop metering + release the timer (idempotent). */
export function stopFrameFps(): void {
  if (meter) { clearInterval(meter.timer); meter = null; }
}
