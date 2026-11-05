// SPDX-License-Identifier: MPL-2.0
/**
 * The stored decisions behind the automatic Performance UI switch (lib/perf-ui-auto.ts).
 *
 * One chrome preference in this device's localStorage, never tool state and never in
 * PREF_KEYS, so it stays on this device: it travels in no backup and no sync. The
 * person's own choice lives on the profile (`featureFlags['perf-ui']`) as before, and
 * always wins over this record. It holds decisions, their reason codes and when they
 * were made; never a pressure reading, a battery level or a renderer's name.
 *
 *   {
 *     v: 2,
 *     on?: { kind: 'lasting', reason, at, seen? }     on for a weak device, or kept
 *        | { kind: 'temporary', reason, at, seen? },  on while this device is constrained
 *     undone?: { weak?: at, constrained?: at },       Undo on each kind of switch: none of
 *                                                     that kind again here, until "Allow
 *                                                     again" in Settings clears it
 *     backAt?: at,                                    the temporary look last switched back
 *   }
 *
 * A version 1 record ({ v: 1, state: 'on' | 'undone', ... }) reads as its version 2
 * equivalent, and is rewritten as version 2 the next time anything changes.
 *
 * A leaf on purpose: feature-flags.ts reads it during first paint, so it imports
 * nothing (an import of feature-flags.ts would also close a cycle).
 */

export const PERF_UI_AUTO_KEY = 'lolly:perfUiAuto';

/** A weak device: `software` comes from the start-up graphics check, `slow` from measured,
 *  sustained slowness while the person used the app. These switch for good. */
export type PerfUiWeakReason = 'software' | 'slow';
/** A constrained device: `pressure` is the processor under sustained pressure (heat, or
 *  another app), `battery` a low battery that is not charging. These switch for a while. */
export type PerfUiConstraintReason = 'pressure' | 'battery';
/** Why the switch happened. */
export type PerfUiAutoReason = PerfUiWeakReason | PerfUiConstraintReason;

/** The look is on because Lolly switched the look on. `lasting` stays until the person
 *  changes the switch: a weak device, or a temporary switch the person chose to keep.
 *  `temporary` switches back by itself once the device has calmed down. */
export type PerfUiAutoOn =
  | { kind: 'lasting'; reason: PerfUiAutoReason; at: number; seen?: true }
  | { kind: 'temporary'; reason: PerfUiConstraintReason; at: number; seen?: true };

export interface PerfUiAutoRecord {
  v: 2;
  on?: PerfUiAutoOn;
  undone?: { weak?: number; constrained?: number };
  backAt?: number;
}

export function isWeakReason(value: unknown): value is PerfUiWeakReason {
  return value === 'software' || value === 'slow';
}

export function isConstraintReason(value: unknown): value is PerfUiConstraintReason {
  return value === 'pressure' || value === 'battery';
}

const time = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

/** The version 2 equivalent of whatever is stored. */
function normalise(raw: unknown): PerfUiAutoRecord {
  const out: PerfUiAutoRecord = { v: 2 };
  if (!raw || typeof raw !== 'object') return out;
  const rec = raw as Record<string, unknown>;
  if (rec.v === 1) {
    const at = time(rec.at);
    if (at === undefined) return out;
    if (rec.state === 'undone') out.undone = { weak: at };
    else if (rec.state === 'on' && isWeakReason(rec.reason)) out.on = { kind: 'lasting', reason: rec.reason, at, ...(rec.seen === true ? { seen: true } : {}) };
    return out;
  }
  if (rec.v !== 2) return out;
  const on = rec.on && typeof rec.on === 'object' ? rec.on as Record<string, unknown> : null;
  const onAt = time(on?.at);
  const seen = on?.seen === true ? { seen: true as const } : {};
  if (on && onAt !== undefined) {
    if (on.kind === 'temporary' && isConstraintReason(on.reason)) out.on = { kind: 'temporary', reason: on.reason, at: onAt, ...seen };
    else if (on.kind === 'lasting' && (isWeakReason(on.reason) || isConstraintReason(on.reason))) out.on = { kind: 'lasting', reason: on.reason, at: onAt, ...seen };
  }
  const undone = rec.undone && typeof rec.undone === 'object' ? rec.undone as Record<string, unknown> : null;
  const weak = time(undone?.weak);
  const constrained = time(undone?.constrained);
  if (weak !== undefined || constrained !== undefined) {
    out.undone = { ...(weak !== undefined ? { weak } : {}), ...(constrained !== undefined ? { constrained } : {}) };
  }
  const backAt = time(rec.backAt);
  if (backAt !== undefined) out.backAt = backAt;
  return out;
}

/** The record; `{ v: 2 }` when there is none or it cannot be read. Anything malformed
 *  reads as absent, so a damaged key can never switch the look on. */
export function readPerfUiAuto(): PerfUiAutoRecord {
  try { return normalise(JSON.parse(localStorage.getItem(PERF_UI_AUTO_KEY) ?? 'null')); } catch { return { v: 2 }; }
}

/** Best-effort write: blocked storage leaves the decision for this tab only. A record
 *  with nothing in it removes the key. */
export function writePerfUiAuto(record: PerfUiAutoRecord): void {
  const empty = !record.on && !record.undone && record.backAt === undefined;
  try {
    if (empty) localStorage.removeItem(PERF_UI_AUTO_KEY);
    else localStorage.setItem(PERF_UI_AUTO_KEY, JSON.stringify(record));
  } catch { /* storage blocked */ }
}

/** "Allow again" in Settings: forget every Undo, so automatic switching of both kinds may
 *  run again from the next start. It never turns the look on, and never clears a look
 *  that is on, since that would turn it off behind the person's back. */
export function allowPerfUiAutoAgain(): void {
  const rec = readPerfUiAuto();
  if (!rec.undone) return;
  delete rec.undone;
  writePerfUiAuto(rec);
}

/** Is the look on because of an automatic decision, lasting or temporary? The caller
 *  still checks for a hand choice on the profile, which outranks this. */
export function perfUiAutoOn(): boolean {
  return readPerfUiAuto().on !== undefined;
}

/** Does this browser offer a signal the temporary switch reads (CPU pressure, or the
 *  battery)? Safari and Firefox offer neither. */
export function perfUiConstraintSignalsHere(): boolean {
  if (typeof globalThis.navigator === 'undefined') return false;
  const nav: Navigator & { getBattery?: unknown } = globalThis.navigator;
  return typeof (globalThis as { PressureObserver?: unknown }).PressureObserver === 'function'
    || typeof nav.getBattery === 'function';
}

/** Does this start need the automatic switch at all? Never after a hand choice. Otherwise
 *  when a notice was never seen, when the temporary look is on (it watches for calm), or
 *  when nothing is on and a kind of switching is still allowed here. Cheap and
 *  synchronous, so boot can skip loading the detector for everyone else. */
export function perfUiAutoPending(handChoice: boolean): boolean {
  if (handChoice) return false;
  const rec = readPerfUiAuto();
  if (rec.on) return rec.on.kind === 'temporary' || rec.on.seen !== true;
  return rec.undone?.weak === undefined
    || (rec.undone?.constrained === undefined && perfUiConstraintSignalsHere());
}
