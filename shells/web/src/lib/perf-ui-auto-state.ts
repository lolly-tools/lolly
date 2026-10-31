// SPDX-License-Identifier: MPL-2.0
/**
 * The stored decision behind the automatic Performance UI switch (lib/perf-ui-auto.ts).
 *
 * One chrome preference in this device's localStorage, never tool state and never in
 * PREF_KEYS, so it stays on this device: it travels in no backup and no sync. The
 * person's own choice lives on the profile (`featureFlags['perf-ui']`) as before, and
 * always wins over this record.
 *
 *   { v: 1, state: 'on', reason, at, seen? }   switched on automatically
 *   { v: 1, state: 'undone', at }              the person pressed Undo: never again here
 *
 * A leaf on purpose: feature-flags.ts reads it during first paint, so it imports
 * nothing (an import of feature-flags.ts would also close a cycle).
 */

export const PERF_UI_AUTO_KEY = 'lolly:perfUiAuto';

/** Why the switch happened. `software` comes from the start-up graphics check; `slow`
 *  from measured, sustained slowness while the person used the app. */
export type PerfUiAutoReason = 'software' | 'slow';

export type PerfUiAutoRecord =
  | { v: 1; state: 'on'; reason: PerfUiAutoReason; at: number; seen?: boolean }
  | { v: 1; state: 'undone'; at: number };

/** The record, or null when there is none or it cannot be read. A malformed value
 *  reads as null, so a damaged key can never switch the look on. */
export function readPerfUiAuto(): PerfUiAutoRecord | null {
  let raw: unknown;
  try { raw = JSON.parse(localStorage.getItem(PERF_UI_AUTO_KEY) ?? 'null'); } catch { return null; }
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  if (rec.v !== 1 || typeof rec.at !== 'number' || !Number.isFinite(rec.at)) return null;
  if (rec.state === 'undone') return { v: 1, state: 'undone', at: rec.at };
  if (rec.state === 'on' && (rec.reason === 'software' || rec.reason === 'slow')) {
    return { v: 1, state: 'on', reason: rec.reason, at: rec.at, ...(rec.seen === true ? { seen: true } : {}) };
  }
  return null;
}

/** Best-effort write: blocked storage leaves the decision for this tab only. */
export function writePerfUiAuto(record: PerfUiAutoRecord): void {
  try { localStorage.setItem(PERF_UI_AUTO_KEY, JSON.stringify(record)); } catch { /* storage blocked */ }
}

/** Is the look on because of an automatic decision? The caller still checks for a hand
 *  choice on the profile, which outranks this. */
export function perfUiAutoOn(): boolean {
  return readPerfUiAuto()?.state === 'on';
}

/** Does this start need the automatic switch at all? Only when nobody chose by hand and
 *  either nothing is decided yet or the notice for an earlier decision was never seen.
 *  Cheap and synchronous, so boot can skip loading the detector for everyone else. */
export function perfUiAutoPending(handChoice: boolean): boolean {
  if (handChoice) return false;
  const rec = readPerfUiAuto();
  return rec === null || (rec.state === 'on' && rec.seen !== true);
}
