// SPDX-License-Identifier: MPL-2.0
/**
 * timeline-panel: model sync and time/track geometry.
 *
 * Every function takes the shared `tp: TpCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `tp.<module>.<fn>`. Extracted verbatim
 * from initTimelinePanel() by scripts/split-closure.ts.
 */
import { clientToTime, fitPxPerSec, tracksKey } from './shared.ts';
import { bindOp, type TpCtx } from './context.ts';

export function scheduleSync(tp: TpCtx): void {
  if (tp.syncScheduled || tp.disposed) return;
  tp.syncScheduled = true;
  requestAnimationFrame(() => {
    tp.syncScheduled = false;
    if (tp.disposed) return;
    // Mid-gesture the panel owns the DOM, so the sync is DEFERRED, never dropped:
    // dropping it lost a sidebar edit made while scrubbing until the next unrelated
    // change. `sync()` at the end of the gesture picks it up.
    if (tp.gesture) {
      tp.syncMissed = true;
      return;
    }
    sync(tp);
  });
}
export function sync(tp: TpCtx): void {
  const { cfg, clock, getBoxes, tracks } = tp;
  if (!tp.open || tp.disposed) return;
  tp.syncMissed = false;
  const boxes = getBoxes();
  const key = tracksKey(boxes, cfg);
  // What a bar's PICTURE depends on, which is a different question from what its
  // ROW depends on. `tracksKey` is id/lane/timed only, so editing a card's text or
  // its colour took the restyle branch and the bar kept photographing the old words
  // indefinitely - a thumbnail that actively lies is worse than the flat fill it
  // replaced. Timing is excluded (see appearanceSig), so a drag does not re-key.
  const akey = tp.thumbs.appearanceKey(boxes);
  const looksDifferent = akey !== tp.lastAppearance;
  tp.lastAppearance = akey;
  if (key !== tp.lastKey) {
    tp.lastKey = key;
    tp.rows.rebuild(boxes);
    tp.thumbs.scheduleThumbs();
  } else {
    tp.rows.restyle(boxes);
    if (looksDifferent) tp.thumbs.scheduleThumbs();
  }
  if (tp.fitPending && tracks.clientWidth > 0) {
    tp.fitPending = false;
    tp.pxPerSec = fitPxPerSec(tp.rows.durationSec(), tracks.clientWidth);
    tp.rows.restyle(boxes);
    tp.thumbs.scheduleThumbs();
  }
  tp.rows.updatePlayhead(clock.t());
  // A MODEL change can move the ghosts without moving the clock (a split, a trim, a
  // reorder), and a paused timeline emits no ticks at all. Gated by the same signature
  // as the tick path, so a sync that changed nothing visible still fires nothing.
  tp.panel.emitTime(clock.t());
  // Re-gate the freshly-rebuilt canvas at the current playhead. A commit rebuilds the
  // tool DOM (new nodes → the sequence gate's `.seq-off` is gone), and while playback's
  // rAF loop reapplies every frame, a PAUSED timeline emits no ticks - so without this a
  // scenery→timed edit (promote, or frames-as-scenes "Place in order", whose frame pages
  // get no thumbnail shot to ride the shot-settle reapply) would leave every element on
  // screen until the next scrub. `reapply()` is one class/style pass and is exactly the
  // "canvas was rebuilt" entry point (sequence-clock.ts).
  clock.reapply();
}
// ── gestures ────────────────────────────────────────────────────────────────

export function tracksRectLeft(tp: TpCtx): number {
  const { tracks } = tp;
  return tracks.getBoundingClientRect().left;
}
export function timeAt(tp: TpCtx, clientX: number): number {
  const { tracks } = tp;
  return clientToTime(clientX, tracksRectLeft(tp), tracks.scrollLeft, tp.pxPerSec);
}
export function syncingOps(tp: TpCtx) {
  return {
    scheduleSync: bindOp(tp, scheduleSync),
    sync: bindOp(tp, sync),
    tracksRectLeft: bindOp(tp, tracksRectLeft),
    timeAt: bindOp(tp, timeAt),
  };
}
