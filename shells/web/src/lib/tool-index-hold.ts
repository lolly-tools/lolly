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
 * brings nothing (the gallery then needs the full index to paint), and when the asset
 * index answers while the slim index is still pending (the slim request was started
 * first and is a quarter of the size, so a slim request that has not answered by then is
 * treated as one that will not).
 */
export interface ToolIndexHold {
  /** Settles when the full tool index may load. */
  after: Promise<void>;
  release(): void;
}

export function holdToolIndex(slim: Promise<unknown>, assetsAnswered?: Promise<unknown>): ToolIndexHold {
  let release!: () => void;
  const after = new Promise<void>(resolve => { release = resolve; });
  let slimSettled = false;
  void slim.then(index => { slimSettled = true; if (!index) release(); }, () => { slimSettled = true; release(); });
  void assetsAnswered?.then(() => { if (!slimSettled) release(); }, () => { if (!slimSettled) release(); });
  return { after, release };
}
