// SPDX-License-Identifier: MPL-2.0
/**
 * timeline-panel: play, zoom, touch pinch, fit and split.
 *
 * Every function takes the shared `tp: TpCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `tp.<module>.<fn>`. Extracted verbatim
 * from initTimelinePanel() by scripts/split-closure.ts.
 */
import { t } from '../../i18n.ts';
import { icon } from '../../lib/icons.ts';
import { announce } from '../../a11y.ts';
import { MIN_DUR, indexOfId, isTimed, seqBoxes, snapTime, splitAll } from '../timeline-math.ts';
import type { Box } from '../timeline-math.ts';
import { SNAP_PX_FINE } from '../timeline-config.ts';
import { fitPxPerSec, snapCandidates, zoomAbout } from './shared.ts';
import { bindOp, type TpCtx } from './context.ts';

export function syncPlayBtn(tp: TpCtx): void {
  const { clock, playBtn } = tp;
  const on = clock.playing();
  if (on === tp.playBtnPlaying) return;
  tp.playBtnPlaying = on;
  playBtn.innerHTML = on ? icon('pause') : icon('play');
  const label = on ? t('Pause') : t('Play');
  playBtn.setAttribute('aria-label', label);
  playBtn.setAttribute('data-tip', label);
}
export function togglePlay(tp: TpCtx): void {
  const { clock } = tp;
  if (clock.playing()) clock.pause();
  else clock.play();
  syncPlayBtn(tp);
}
export function zoom(tp: TpCtx, factor: number, cursorPx?: number): void {
  const { clock, getBoxes, tracks } = tp;
  const cx = cursorPx ?? tracks.clientWidth / 2;
  const z = zoomAbout(tp.pxPerSec, factor, cx, tracks.scrollLeft);
  tp.pxPerSec = z.pxPerSec;
  tp.thumbs.abortThumbs();
  tp.rows.restyle(getBoxes());
  tracks.scrollLeft = z.scrollLeft;
  tp.rows.updatePlayhead(clock.t());
  tp.thumbs.scheduleThumbs();
}
export const touchGap = (_tp: TpCtx, t: TouchList): number =>
  Math.hypot(t[0]!.clientX - t[1]!.clientX, t[0]!.clientY - t[1]!.clientY);
export function onTouchStart(tp: TpCtx, e: TouchEvent): void {
  if (e.touches.length !== 2) {
    tp.pinchDist = 0;
    return;
  }
  tp.pinchDist = touchGap(tp, e.touches);
  // A pinch is never also a clip drag. Whatever single-finger gesture the first touch
  // started, drop it here rather than letting the second finger scale the timeline
  // while the first keeps dragging a bar under it.
  if (tp.gesture) tp.gestures.endGesture(tp.gesture);
}
export function onTouchMove(tp: TpCtx, e: TouchEvent): void {
  const { tracks } = tp;
  if (e.touches.length !== 2 || tp.pinchDist <= 0) return;
  const gap = touchGap(tp, e.touches);
  if (gap <= 0) return;
  e.preventDefault();
  const midX = (e.touches[0]!.clientX + e.touches[1]!.clientX) / 2;
  zoom(tp, gap / tp.pinchDist, midX - tracks.getBoundingClientRect().left);
  tp.pinchDist = gap;
}
export function onTouchEnd(tp: TpCtx, e: TouchEvent): void {
  if (e.touches.length < 2) tp.pinchDist = 0;
}
export function fit(tp: TpCtx): void {
  const { clock, getBoxes, tracks } = tp;
  tp.pxPerSec = fitPxPerSec(tp.rows.durationSec(), tracks.clientWidth);
  tp.thumbs.abortThumbs();
  tp.rows.restyle(getBoxes());
  tracks.scrollLeft = 0;
  tp.rows.updatePlayhead(clock.t());
  tp.thumbs.scheduleThumbs();
}
/**
 * Is `at` a place this box could actually be CUT? Deliberately the same predicate
 * splitBox uses (timeline-math), not a plain "inside the span" test:
 *
 *   - an open-ended clip resolves its end against the SEQUENCE's (splitBox is handed
 *     `durationSec()` for exactly this) - the same start..total window span() gives it;
 *   - splitBox refuses within MIN_DUR of either edge rather than mint a sliver,
 *     and at any zoom past ~80 px/s the snap tolerance is smaller than MIN_DUR, so the
 *     playhead can rest inside that band without being pulled onto the cut.
 *
 * A mismatch here used to read as "Split clip", enabled - and then announce a refusal
 * on the press. The label cannot promise what the press refuses, so it asks the same
 * question.
 */
export function spanContains(tp: TpCtx, b: Box, at: number, total = tp.rows.durationSec()): boolean {
  const { cfg } = tp;
  if (!b || !isTimed(b, cfg)) return false;
  // An open-ended clip splits against the SEQUENCE's end now (splitBox takes the
  // total for exactly this), so it is in scope whenever its effective span - which
  // span() already resolves to start..total - contains the cut.
  const { start, dur } = tp.rows.span(b, total);
  return at > start + MIN_DUR && at < start + dur - MIN_DUR;
}
/**
 * SPLIT - one operation, four doors (the toolbar blade, `s`, the context menu, and
 * the blade's own LABEL, which has to answer the same question a press would) and one
 * scope rule shared by all of them. Resolved here, once, so the label can never
 * promise something the press then refuses.
 *
 * Scope, in the order Premiere and Descript both resolve it:
 *   1. every SELECTED clip the playhead is inside - so a deliberate multi-selection
 *      cuts through all of it in one press, and one undo takes the whole thing back;
 *   2. failing that, the seq clip under the playhead - the "I just want to cut here"
 *      case, which must not require selecting anything first;
 *   3. failing that, say so and write nothing.
 *
 * `everything: true` is the Shift+S variant: every timed clip the playhead is inside,
 * on every lane, IGNORING the selection.
 *
 * The cut is SNAPPED first, so a press within a few pixels of an existing edit arrives
 * exactly on it and then fails the "already at a cut" test as an equality rather than
 * a float comparison (Premiere's razor snaps for the same reason).
 */
export function splitScope(tp: TpCtx, 
  everything = false,
  boxes: Box[] = tp.getBoxes()
): { at: number; ids: string[] } {
  const { cfg, clock, selection } = tp;
  const total = tp.rows.durationSec();
  // Snap BEFORE deciding scope: the snapped instant is the one the cut is tested
  // against, so "inside this clip" and "where the cut arrives" can never disagree.
  //
  // NOT through maybeSnap - the playhead is one of its own candidates, so snapping
  // the playhead would always find itself at distance 0 and change nothing. Passing a
  // negative playhead drops that candidate (snapCandidates guards on `ph >= 0`) and
  // leaves the clip edges and whole seconds, which is exactly what a razor should
  // land on. It also draws no snapline: there is no drag here to give feedback about.
  const raw = clock.t() / 1000;
  const at = tp.snapOn
    ? snapTime(raw, snapCandidates(boxes, cfg, -1, raw), tp.pxPerSec, SNAP_PX_FINE).t
    : raw;
  let ids: string[];
  if (everything) {
    ids = boxes
      .filter((b) => spanContains(tp, b, at, total))
      .map((b) => String(b[cfg.idField] ?? ''));
  } else {
    ids = selection.get().filter((id) => {
      const i = indexOfId(boxes, cfg, id);
      return i >= 0 && spanContains(tp, boxes[i]!, at, total);
    });
    if (!ids.length) {
      const under = seqBoxes(boxes, cfg).find((b) => spanContains(tp, b, at, total));
      if (under) ids = [String(under[cfg.idField] ?? '')];
    }
  }
  return { at, ids: ids.filter(Boolean) };
}
export function syncSplitBtn(tp: TpCtx): void {
  const { getBoxes, splitBtn } = tp;
  const boxes = getBoxes();
  const n = splitScope(tp, false, boxes).ids.length;
  // Disabled is decided by the UNION of both scopes; the label is the plain scope's.
  const off = n === 0 && splitScope(tp, true, boxes).ids.length === 0;
  // The memo is on the ACHIEVED state, not on the playhead: this runs once per tick
  // (see emitTime - the splittable set changes one frame AFTER the active set does,
  // when the playhead steps off a clip's exact start, so it cannot ride tl-time's own
  // gate), and the DOM must not be written sixty times a second for a label that
  // changes twice a sequence.
  const key = `${n}|${off ? 1 : 0}`;
  if (key === tp.splitBtnKey) return;
  tp.splitBtnKey = key;
  const label =
    n === 0
      ? t('Split at playhead')
      : n === 1
        ? t('Split clip')
        : t('Split {n} clips', { n: String(n) });
  splitBtn.setAttribute('aria-label', label);
  splitBtn.setAttribute('data-tip', label);
  splitBtn.setAttribute('aria-disabled', off ? 'true' : 'false');
}
/**
 * Cut, once, at the resolved instant. `splitAll` returns the input array by IDENTITY
 * when nothing arrived, so a no-op costs no commit and no undo entry at all; a
 * multi-clip cut composes on one intermediate array and writes once, so it is one
 * undo step however many clips it touched.
 */
export function splitAtPlayhead(tp: TpCtx, opts?: { everything?: boolean }): void {
  const { cfg, getBoxes } = tp;
  const boxes = getBoxes();
  const { at, ids } = splitScope(tp, !!opts?.everything, boxes);
  if (!ids.length) {
    announce(t('Move the playhead inside a clip to split it'));
    return;
  }
  const { next, split } = splitAll(boxes, cfg, ids, at, tp.edit.mintId, tp.rows.durationSec());
  // Identity, not deep equality: nothing was cut, so nothing is written and the undo
  // stack is untouched. The commonest way here is a second press at the same instant.
  if (next === boxes) {
    announce(t('The playhead is already at a cut'));
    return;
  }
  tp.helpers.write(next);
  // Select the right-hand halves - what you carry on editing after a cut is the part
  // ahead of the playhead, and the panel's one selection writer keeps it on screen.
  // Focus moves WITH the selection: trimTargetId prefers focusedId, and leaving it
  // on the left half sent the next keyboard edit (Shift+D, [/]/e) at a clip other
  // than the one painted selected.
  if (split.length) {
    tp.focusedId = split[0]!;
    tp.rows.selectAndReveal(split);
  }
  announce(
    split.length > 1 ? t('Split {n} clips', { n: String(split.length) }) : t('Clip split')
  );
}
export function playbackOps(tp: TpCtx) {
  return {
    syncPlayBtn: bindOp(tp, syncPlayBtn),
    togglePlay: bindOp(tp, togglePlay),
    zoom: bindOp(tp, zoom),
    touchGap: bindOp(tp, touchGap),
    onTouchStart: bindOp(tp, onTouchStart),
    onTouchMove: bindOp(tp, onTouchMove),
    onTouchEnd: bindOp(tp, onTouchEnd),
    fit: bindOp(tp, fit),
    spanContains: bindOp(tp, spanContains),
    splitScope: bindOp(tp, splitScope),
    syncSplitBtn: bindOp(tp, syncSplitBtn),
    splitAtPlayhead: bindOp(tp, splitAtPlayhead),
  };
}
