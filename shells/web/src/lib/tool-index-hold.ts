// SPDX-License-Identifier: MPL-2.0
/**
 * Hold the full tool index back on a cold gallery visit that paints from the slim index.
 *
 * The full index is the largest catalog file (208 KB compressed), and on a cold visit it
 * downloaded beside the gallery's own code; holding it until the first mount brought the
 * gallery 169 ms sooner on the plan 371 phone profile, with the full catalog arriving
 * later. main.ts passes {@link ToolIndexHold.after} to the catalog sync and calls
 * `release()` after the first navigate and before anything waits on the whole sync.
 *
 * The hold also lets go by itself, so it can never hold boot up: when the slim index
 * brings nothing (the gallery then needs the full index to paint), and when the slim
 * index has not settled within {@link SLIM_HOLD_LIMIT_MS}. The slim request has no time
 * limit of its own, and boot's first paint races it against the whole sync, so a slim
 * request that never answers would otherwise wait on a sync that waits for that request.
 *
 * Not a signal from the asset index: index.html starts both requests at HTML parse, and
 * the asset response's headers arrive before the slim body has been read, so "the asset
 * index answered first" let the hold go on every cold boot (measured 2026-11-21).
 */
export interface ToolIndexHold {
  /** Settles when the full tool index may load. */
  after: Promise<void>;
  release(): void;
}

/** The slim index settles about 1.2 s into a cold boot on the phone profile; past this,
 *  a slim request that has not settled is treated as one that will not. */
export const SLIM_HOLD_LIMIT_MS = 3000;

export function holdToolIndex(slim: Promise<unknown>, limitMs = SLIM_HOLD_LIMIT_MS): ToolIndexHold {
  let release!: () => void;
  const after = new Promise<void>(resolve => { release = resolve; });
  let slimSettled = false;
  void slim.then(index => { slimSettled = true; if (!index) release(); }, () => { slimSettled = true; release(); });
  setTimeout(() => { if (!slimSettled) release(); }, limitMs);
  return { after, release };
}
