// SPDX-License-Identifier: MPL-2.0
/**
 * Saves of a whole document, one at a time, where the newest wins.
 *
 * Each save writes the entire document, so a save that a newer one is already waiting
 * behind has nothing to add. Written anyway, it puts an older state back on disk for as
 * long as the newer save takes: Brand Studio's palette, dragged and dragged back, stored
 * the order the person had already left for up to a second under load. Skipping it also
 * starts the newest save sooner. A save that is already writing still finishes, so the
 * caller's own "Saved" state, set when the newest save finishes, stays the signal that
 * the latest edit is on disk.
 *
 * `push` runs saves in the order they were queued. A save superseded before it starts
 * never runs; one already running is told through `superseded()`, so it can skip its
 * write and its follow-up work and leave both to the newer save. The newest save always
 * runs. A failed save never stops the saves queued behind the failed one.
 */
export interface LatestSaveQueue {
  /** Queue a save. Resolves once this save has run or been skipped. */
  push(run: (superseded: () => boolean) => Promise<void>): Promise<void>;
}

export function createLatestSaveQueue(): LatestSaveQueue {
  let tail: Promise<void> = Promise.resolve();
  let newest = 0;
  return {
    push(run) {
      const mine = ++newest;
      const superseded = (): boolean => mine !== newest;
      tail = tail.then(() => (superseded() ? undefined : run(superseded))).catch(() => { /* the save reports its own failure */ });
      return tail;
    },
  };
}
