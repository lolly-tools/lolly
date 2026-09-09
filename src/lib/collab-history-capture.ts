// SPDX-License-Identifier: MPL-2.0
/**
 * Feeds a client-owned memory history (`collab/rtc-history.ts`) from this client's
 * converged snapshots, at the SAME cadence solo history uses (`views/automatic-
 * history.ts`): a checkpoint after a short idle, and at least one per minute of
 * continuous work. No durable writes happen here - the history it feeds is memory-
 * only, and each snapshot is the shared canvas as it stands (peer edits already
 * applied), taken at one of this client's own edit boundaries.
 *
 * It never records a keystroke per revision: `changed()` only arms a timer, and a
 * burst of edits collapses into one capture. Cross-peer sharing of these revisions is
 * the deferred `history-v1` wire protocol (plan 221 section 9); this only fills the local
 * client's own session view.
 */

import type { CapturableCollabHistory } from './collab-history.ts';
import type { SavedStateData } from '../bridge/state.ts';

export interface CollabHistoryCapture {
  /** One converged edit boundary. Arms (or re-arms) the cadence timer. */
  changed(): void;
  /** Capture now if anything is pending - the editor-exit / page-hide boundary. */
  flush(): void;
  /** Stop capturing. Idempotent; leaves the memory history's own dispose to the transport. */
  dispose(): void;
}

const IDLE_MS = 2000;
const MIN_INTERVAL_MS = 60_000;

export function createCollabHistoryCapture(opts: {
  history: CapturableCollabHistory;
  snapshot(): SavedStateData;
  documentId: string;
  toolId: string;
  actorId: string;
  actorLabel?: string;
  /** Optional per-capture label; falls back to the history's own numbering. */
  label?(): string | undefined;
  failure?(message: string): void;
  now?(): number;
  setTimer?(fn: () => void, ms: number): unknown;
  clearTimer?(handle: unknown): void;
}): CollabHistoryCapture {
  const now = opts.now ?? ((): number => Date.now());
  const setTimer = opts.setTimer ?? ((fn, ms): unknown => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer ?? ((handle): void => { clearTimeout(handle as ReturnType<typeof setTimeout>); });

  let stopped = false;
  let timer: unknown;
  let dirtySince: number | undefined;
  // The first checkpoint is never throttled: "no capture yet" reads as long ago, so
  // the min-interval floor collapses to the short idle regardless of the clock's base.
  let lastCapture = Number.NEGATIVE_INFINITY;

  const commit = (): void => {
    timer = undefined;
    if (stopped || dirtySince === undefined) return;
    const at = now();
    try { opts.history.capture({
      documentId: opts.documentId,
      toolId: opts.toolId,
      actorId: opts.actorId,
      actorLabel: opts.actorLabel,
      label: opts.label?.(),
      at: new Date(at).toISOString(),
      data: opts.snapshot(),
    });
      dirtySince = undefined;
      lastCapture = at;
    } catch (error) {
      // Leave the draft dirty for the next edit/explicit flush, without a tight
      // retry loop or an unhandled error from the timer callback.
      dirtySince = at; lastCapture = at;
      opts.failure?.(error instanceof Error ? error.message : 'Could not keep this session checkpoint.');
    }
  };

  return {
    changed(): void {
      if (stopped) return;
      const t = now();
      dirtySince ??= t;
      clearTimer(timer);
      // Identical to the solo scheduler's boundary (automatic-history.ts): a short idle,
      // but never sooner than a minute after the last capture, and never later than a
      // minute of continuous dirtiness.
      const delay = Math.min(Math.max(IDLE_MS, lastCapture + MIN_INTERVAL_MS - t), Math.max(0, dirtySince + MIN_INTERVAL_MS - t));
      timer = setTimer(commit, delay);
    },
    flush(): void {
      if (stopped) return;
      clearTimer(timer);
      commit();
    },
    dispose(): void {
      stopped = true;
      clearTimer(timer);
      timer = undefined;
    },
  };
}
