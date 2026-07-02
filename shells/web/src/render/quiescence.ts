// SPDX-License-Identifier: MPL-2.0
/**
 * The settling policy behind waitForQuiescence, as a pure state machine —
 * no DOM, no globals, timers injected. A render is "settled" when it has been
 * mutation-quiet for `silenceMs` AND (if the tool opted into an async ready
 * signal) `ready()` has been called — or unconditionally at `timeoutMs`.
 *
 * The DOM wiring (MutationObserver, tool:ready listener, document.fonts.ready)
 * lives in lifecycle.ts; the semantics here mirror the original
 * views/tool.js implementation exactly.
 */

export interface QuiescenceHooks {
  /** Fired exactly once, when the gate settles. */
  onSettled(): void;
}

export interface QuiescenceGate {
  /** Report a mutation inside the render root: resets the silence window. */
  activity(): void;
  /** Report the tool's async ready signal. */
  ready(): void;
  readonly settled: boolean;
}

export interface QuiescenceOpts {
  /** Whether the tool opted into an async ready signal for this render. */
  needsReadySignal: boolean;
  /** How long the DOM must stay mutation-quiet. */
  silenceMs: number;
  /** Hard cap: settle regardless after this long. */
  timeoutMs: number;
  /** Injected timer; returns a cancel function. */
  setTimer(fn: () => void, ms: number): () => void;
}

export function createQuiescenceGate(opts: QuiescenceOpts, hooks: QuiescenceHooks): QuiescenceGate {
  let settled = false;
  let isReady = !opts.needsReadySignal;
  let isSilent = false;
  let cancelSilence: (() => void) | null = null;

  const finish = (): void => {
    if (settled) return;
    settled = true;
    cancelSilence?.();
    cancelCap();
    hooks.onSettled();
  };
  const tryFinish = (): void => {
    if (isReady && isSilent) finish();
  };
  const resetSilence = (): void => {
    if (settled) return;
    isSilent = false;
    cancelSilence?.();
    cancelSilence = opts.setTimer(() => { isSilent = true; tryFinish(); }, opts.silenceMs);
  };

  const cancelCap = opts.setTimer(finish, opts.timeoutMs);
  resetSilence();

  return {
    activity: resetSilence,
    ready(): void {
      if (settled) return;
      isReady = true;
      tryFinish();
    },
    get settled(): boolean { return settled; },
  };
}
