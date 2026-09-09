// SPDX-License-Identifier: MPL-2.0
/**
 * timeline-panel: pointer gestures - snapping, lane drops, trims, marquee, drag.
 *
 * Every function takes the shared `tp: TpCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `tp.<module>.<fn>`. Extracted verbatim
 * from initTimelinePanel() by scripts/split-closure.ts.
 */
import { t, tRaw } from '../../i18n.ts';
import { announce } from '../../a11y.ts';
import { boxTiming, dropIndexAt, edgeZonePx, fmtDelta, fmtDur, fmtTime, groupDropIndex, indexOfId, kfDiamondTimes, kfLocalSec, kfSlideMs, kfTimelineSec, kfTrackDuplicate, kfTrackRetime, moveOverlay, moveOverlays, moveSeqClip, moveSeqClips, restackOverlay, seqBoxes, snapTime, trimClip, trimClips } from '../timeline-math.ts';
import type { Box, LaneDrop } from '../timeline-math.ts';
import { prefersReducedMotion } from '../../lib/a11y-prefs.ts';
import { RESERVE_PAD, SNAP_PX_COARSE, SNAP_PX_FINE, finite } from '../timeline-config.ts';
import { clampPanelH, edgeBase, isCoarsePointer, pxToTime, snapCandidates, timeToPx } from './shared.ts';
import type { Gesture } from './shared.ts';
import { bindOp, type TpCtx } from './context.ts';

export function showSnapline(tp: TpCtx, tSec: number | null): void {
  const { snapline } = tp;
  if (tSec === null) {
    snapline.hidden = true;
    return;
  }
  snapline.hidden = false;
  snapline.style.left = `${timeToPx(tSec, tp.pxPerSec)}px`;
}
/**
 * Snap a raw time unless Alt is held (the universal bypass).
 *
 * `coarse` is EXPLICIT rather than read off `gesture` at every call site, because the
 * one call that decides what gets written - onPointerUp's - runs AFTER endGesture has
 * already cleared `gesture`. Defaulting it off the live gesture and letting pointerup
 * pass the value it captured is what keeps the committed number identical to the
 * preview the user was looking at; reading it lazily meant a finger's drag previewed
 * at the 12px tolerance and then committed at 8, i.e. snapped on screen and arrived off
 * the cut.
 */
/**
 * The keyframes of the SELECTED boxes, as timeline seconds - the latch's own
 * candidates (plans/104 section 8).
 *
 * Selected only, and that is the whole design: a timeline with six animated clips
 * has dozens of diamonds, and snapping to all of them would make the playhead
 * unplaceable. Selecting a clip is how you say "this is the one I am posing", and
 * the latch follows that declaration rather than guessing from proximity.
 */
export function latchCandidates(tp: TpCtx, boxes: Box[]): number[] {
  const { cfg, selection } = tp;
  if (!cfg.kfField) return [];
  const out: number[] = [];
  for (const id of selection.get()) {
    const i = indexOfId(boxes, cfg, id);
    if (i >= 0) out.push(...kfDiamondTimes(boxes[i]!, cfg));
  }
  return out;
}
export function maybeSnap(tp: TpCtx, 
  raw: number,
  alt: boolean,
  excludeId?: string,
  coarse: boolean = isCoarsePointer(tp.gesture?.pointerType),
  latch = false
): number {
  const { cfg, clock, getBoxes } = tp;
  if (!tp.snapOn || alt) {
    showSnapline(tp, null);
    tp.snappedAt = null;
    return raw;
  }
  const boxes = getBoxes();
  const cands = snapCandidates(boxes, cfg, clock.t() / 1000, raw, excludeId);
  // The playhead latches onto diamonds; a CLIP being dragged does not. A clip's
  // edges snap to structure (cuts, the ruler's seconds, the playhead) - adding
  // another clip's keyframes to that set would make a move jump to a mark that has
  // nothing to do with where the clip belongs.
  if (latch) cands.push(...latchCandidates(tp, boxes));
  // A finger cannot land on an 8px window. The tolerance follows the pointer that
  // started the gesture (timeline-math's own SNAP_PX default stays 6 for every other
  // caller - this panel is the only one that knows what started the drag).
  const px = coarse ? SNAP_PX_COARSE : SNAP_PX_FINE;
  const r = snapTime(raw, cands, tp.pxPerSec, px);
  showSnapline(tp, r.snapped);
  // Newly engaged, on a pointer with no cursor to watch: an 8ms tick is the only
  // feedback a thumb over the bar can actually receive. Gated on the LIVE gesture, not
  // on `coarse`: the haptic belongs to the drag, and firing it again from pointerup
  // (where endGesture has just reset snappedAt, so every snap reads as new) would tick
  // twice for one snap. Reduced motion turns it off - the pref is about involuntary
  // sensation, not only about pixels moving.
  if (
    r.snapped !== null &&
    r.snapped !== tp.snappedAt &&
    isCoarsePointer(tp.gesture?.pointerType) &&
    !prefersReducedMotion() &&
    typeof navigator !== 'undefined' &&
    typeof navigator.vibrate === 'function'
  ) {
    try {
      navigator.vibrate(8);
    } catch {
      /* a denied/absent vibrator is not an error */
    }
  }
  tp.snappedAt = r.snapped;
  return r.t;
}
/** The `.tl-edge` element of one bar, by side. */
export function edgeEl(_tp: TpCtx, 
  barEl: HTMLElement | null,
  edge: 'in' | 'out' | null | undefined
): HTMLElement | null {
  if (!barEl || !edge) return null;
  return barEl.querySelector<HTMLElement>(`.tl-edge[data-edge="${edge}"]`);
}
/** The clips a trim gesture acts on: the whole selection when it was a multi-selection
 *  at pointerdown, else just the pressed clip. Same set for the preview and the commit. */
export function trimIdsOf(_tp: TpCtx, g: Gesture): string[] {
  return g.groupIds && g.groupIds.length > 1 && g.groupIds.includes(g.id) ? g.groupIds : [g.id];
}
/**
 * The ONE trim writer the preview and the commit both run - a throwaway array per
 * rAF frame, the real thing on pointerup - so the bar under the pointer, the other
 * selected bars and the rippled row can never disagree with what is written. `ids` is the
 * batch (trimClips: same edge, same delta, per-clip clamps) or the single clip
 * (trimClip), each clamped against its own media length.
 */
export function trimRows(tp: TpCtx, boxes: Box[], ids: readonly string[], edge: 'in' | 'out', d: number): Box[] {
  const { cfg } = tp;
  if (ids.length > 1)
    return trimClips(boxes, cfg, ids, edge, d, (id) => tp.helpers.mediaOf(id).dur, tp.helpers.mediaDur);
  const id = ids[0] ?? '';
  return trimClip(boxes, cfg, id, edge, d, tp.helpers.mediaOf(id).dur, tp.helpers.mediaDur);
}
/** Vertical offset of `el` inside `inner`, walking the offsetParent chain. */
export function offsetIn(tp: TpCtx, el: HTMLElement): number {
  const { inner } = tp;
  let y = 0;
  let n: HTMLElement | null = el;
  while (n && n !== inner) {
    y += n.offsetTop || 0;
    n = n.offsetParent as HTMLElement | null;
  }
  return y;
}
export function beginGesture(tp: TpCtx, 
  e: PointerEvent,
  g: Omit<Gesture, 'x' | 'y' | 'moved' | 'alt' | 'pointerId' | 'pointerType'>
): void {
  const { root } = tp;
  tp.gesture = {
    ...g,
    x: e.clientX,
    y: e.clientY,
    moved: false,
    alt: e.altKey,
    pointerId: e.pointerId,
    pointerType: e.pointerType || '',
  };
  tp.thumbs.abortThumbs();
  try {
    (g.el ?? root).setPointerCapture(e.pointerId);
  } catch {
    /* jsdom / no capture */
  }
  root.classList.add('is-dragging');
  if (g.kind === 'trim') beginTrimChrome(tp, tp.gesture);
}
export function clearLaneDropPaint(tp: TpCtx): void {
  const { laneWrap } = tp;
  for (const el of laneWrap.querySelectorAll('.is-drop-target'))
    el.classList.remove('is-drop-target');
}
/**
 * The vertical half of an overlay bar drag (plans/165 Slice C-tracks): resolve
 * which lane row (or gap between rows) the pointer is over, remember it on the
 * gesture for pointerup, and paint the drop row. Rows render top = frontmost, so
 * a gap maps to "directly behind the row above it" and the top gap to "in front
 * of everything" - the LaneDrop vocabulary restackOverlay speaks. Row
 * geometry is cached at the first vertical breach: rows do not move during a
 * drag (the dragged bar previews via transform, which never reflows).
 */
export function resolveLaneDrop(tp: TpCtx, g: Gesture): void {
  const { LANE_DRAG_PX, LANE_EDGE_PX, laneWrap } = tp;
  const originRow = g.el?.closest<HTMLElement>('.tl-lane');
  if (originRow?.dataset.lane !== 'overlay') return; // seq bars have their own reorder
  if (!g.laneRects) {
    if (Math.abs(g.y - g.y0) < LANE_DRAG_PX) return;
    g.laneRects = Array.from(
      laneWrap.querySelectorAll<HTMLElement>('.tl-lane[data-lane="overlay"]')
    ).map((el) => {
      const r = el.getBoundingClientRect();
      return {
        el,
        anchor: el.dataset.anchor || '',
        members: Array.from(el.querySelectorAll<HTMLElement>('.tl-clip')).map(
          (b) => b.dataset.id || ''
        ),
        top: r.top,
        bottom: r.bottom,
      };
    });
  }
  const rows = g.laneRects;
  let drop: LaneDrop | null = null;
  let hover: HTMLElement | null = null;
  const y = g.y;
  // A gap drop references a ROW - but never the dragged bar itself (leaving a
  // shared row would otherwise resolve to a self-target, which restackOverlay
  // reads as identity and the drag silently does nothing). Substitute the row's
  // next member; a row the drag is the sole member of has no reference to give.
  const refFor = (r: { anchor: string; members: string[] }): string | null =>
    r.anchor !== g.id ? r.anchor : (r.members.find((m) => m && m !== g.id) ?? null);
  const over = rows.find((r) => y >= r.top + LANE_EDGE_PX && y <= r.bottom - LANE_EDGE_PX);
  if (over && over.el !== originRow && over.anchor && over.anchor !== g.id) {
    drop = { onto: over.anchor };
    hover = over.el;
  } else if (!over && rows.length) {
    const belowIdx = rows.findIndex((r) => y < r.top + LANE_EDGE_PX);
    if (belowIdx === 0)
      drop = { before: null }; // above the top row
    else if (belowIdx > 0) {
      const ref = refFor(rows[belowIdx - 1]!); // between two rows
      drop = ref ? { before: ref } : null;
    } else if (
      y > rows[rows.length - 1]!.bottom - LANE_EDGE_PX &&
      y < rows[rows.length - 1]!.bottom + 24
    ) {
      const ref = refFor(rows[rows.length - 1]!); // just under the bottom row
      drop = ref ? { before: ref } : null;
    }
  }
  g.laneDrop = drop;
  clearLaneDropPaint(tp);
  if (hover) hover.classList.add('is-drop-target');
}
export function beginTrimChrome(tp: TpCtx, g: Gesture): void {
  const { trimBadge } = tp;
  if (!g.el) return;
  g.el.classList.add('is-trimming');
  edgeEl(tp, g.el, g.edge)?.classList.add('is-active');
  // The badge's VERTICAL place is fixed for the gesture - a trim never moves a bar
  // between lanes - so it is measured once here rather than per frame. Reading
  // offsetTop/offsetHeight inside the rAF that has just written every bar's geometry
  // is a forced synchronous layout, sixty times a second, for a number that cannot
  // have changed.
  const top = offsetIn(tp, g.el);
  // The first lane has nothing above it but the scroller's edge, so the badge hangs
  // below the bar there instead of being clipped.
  const below = top < 24;
  const lift = isCoarsePointer(g.pointerType) ? 44 : 0; // clear of a thumb
  trimBadge.classList.toggle('is-below', below);
  trimBadge.style.top = `${below ? top + (g.el.offsetHeight || 0) + lift : top - lift}px`;
  trimBadge.hidden = false;
  trimBadge.textContent = '';
  showExtent(tp, g);
}
/**
 * The reachable span of the clip being trimmed, in timeline seconds, drawn as a ghost
 * behind/around the bar: `[start - clipIn/speed, start + (media - clipIn)/speed]`.
 * Only when the media length is known - a card, a Lottie or a procedural bed has no
 * "end of the source" to draw.
 */
export function showExtent(tp: TpCtx, g: Gesture): void {
  const { cfg, extent, getBoxes } = tp;
  extent.hidden = true;
  if (!g.el) return;
  const media = tp.helpers.mediaOf(g.id).dur;
  if (media == null || !(media > 0)) return;
  const rows = getBoxes();
  const i = indexOfId(rows, cfg, g.id);
  if (i < 0) return;
  const timing = boxTiming(rows[i]!, cfg);
  const speed = timing.speed || 1;
  const from = Math.max(0, g.start0 - timing.clipIn / speed);
  const to = g.start0 + (media - timing.clipIn) / speed;
  if (!(to > from)) return;
  extent.style.left = `${timeToPx(from, tp.pxPerSec)}px`;
  extent.style.width = `${Math.max(2, timeToPx(to - from, tp.pxPerSec))}px`;
  extent.style.top = `${offsetIn(tp, g.el)}px`;
  extent.style.height = `${g.el.offsetHeight || 0}px`;
  extent.hidden = false;
}
export function onPointerDown(tp: TpCtx, e: PointerEvent): void {
  const { cfg, getBoxes, handle, marquee, ruler, selection, tracks } = tp;
  if (e.button !== 0) return;
  const target = e.target as HTMLElement | null;
  if (!target) return;
  if (target.closest('.tl-btn, .tl-dropslot, .tl-chip-group, .tl-inspector, .tl-seam')) return;

  if (target.closest('.tl-handle')) {
    e.preventDefault();
    beginGesture(tp, e, {
      kind: 'resize',
      id: '',
      el: handle,
      x0: e.clientX,
      y0: e.clientY,
      start0: 0,
      dur0: 0,
      index0: 0,
      index: 0,
      h0: tp.panelH,
    });
    return;
  }
  if (target.closest('.tl-ruler')) {
    e.preventDefault();
    const at = maybeSnap(tp, tp.syncing.timeAt(e.clientX), e.altKey, undefined, undefined, true);
    tp.rows.seekAuthored(at * 1000, { scrubbing: true });
    beginGesture(tp, e, {
      kind: 'seek',
      id: '',
      el: ruler,
      x0: e.clientX,
      y0: e.clientY,
      start0: 0,
      dur0: 0,
      index0: 0,
      index: 0,
      h0: tp.panelH,
    });
    return;
  }

  const barEl = target.closest<HTMLElement>('.tl-clip');
  if (!barEl) {
    // Empty lane space inside the tracks scroller → rubber-band select. The ruler,
    // handle and chrome were all handled above, so this is genuinely empty timeline.
    if (target.closest('.tl-tracks')) {
      e.preventDefault();
      const additive = e.shiftKey || e.metaKey || e.ctrlKey;
      if (!additive) tp.rows.selectAndReveal([], { reveal: false });
      marquee.hidden = false;
      drawMarquee(tp, e.clientX, e.clientY, e.clientX, e.clientY);
      beginGesture(tp, e, {
        kind: 'marquee',
        id: '',
        el: tracks,
        x0: e.clientX,
        y0: e.clientY,
        start0: 0,
        dur0: 0,
        index0: 0,
        index: 0,
        h0: tp.panelH,
        additive,
      });
    }
    return;
  }
  const id = barEl.dataset.id || '';
  if (!id) return;
  e.preventDefault();

  // Selection follows the press (Shift toggles), so the canvas chrome tracks the bar.
  const cur = selection.get();
  // A plain press on a clip that is ALREADY part of a multi-selection keeps the whole
  // set, so the press can drag the group; a click that never moves collapses to this
  // one clip on release (collapseOnClick), the standard NLE behaviour.
  const inMulti = cur.length > 1 && cur.includes(id);
  // Shift-extend never reveals: with two clips selected there is no single one to
  // put the picture on, and moving it out from under the first is a worse answer.
  if (e.shiftKey)
    tp.rows.selectAndReveal(cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id], {
      reveal: false,
    });
  else if (inMulti) {
    /* keep the multi-selection; group-drag or collapse-on-click below */
  } else {
    // A/V-linked pair: pressing either half selects both, so a move or a delete keeps
    // picture and sound together. Alt selects just the one - the shell's established
    // "solo this box" idiom, and the reason there is no global "linked selection"
    // toggle to find and remember.
    const partner = e.altKey ? '' : tp.clips.partnerOf(id);
    tp.rows.selectAndReveal(partner ? [id, partner] : [id]);
  }
  const groupIds = selection.get();
  tp.focusedId = id;
  tp.rows.updateRovingTabindex();
  barEl.focus?.();

  const boxes = getBoxes();
  const i = indexOfId(boxes, cfg, id);
  if (i < 0) return;
  const total = tp.rows.durationSec();
  const { start, dur } = tp.rows.span(boxes[i]!, total);
  const lane = boxTiming(boxes[i]!, cfg).lane;

  const rect = barEl.getBoundingClientRect();
  // The zone is decided per EVENT (finger vs cursor) and then capped by the bar's own
  // width, so two zones can never meet and a narrow bar offers none at all. All of
  // that arithmetic lives in timeline-math's edgeZonePx; this reads its answer.
  const zone = edgeZonePx(rect.width, edgeBase(e.pointerType));
  const edge: 'in' | 'out' | null =
    zone <= 0
      ? null
      : e.clientX - rect.left <= zone
        ? 'in'
        : rect.right - e.clientX <= zone
          ? 'out'
          : null;

  const base = {
    id,
    el: barEl,
    x0: e.clientX,
    y0: e.clientY,
    start0: start,
    dur0: dur,
    h0: tp.panelH,
  };
  if (edge) {
    // The selection rides along: with several clips selected, dragging one edge trims
    // that edge on ALL of them (Andy, 2026-09-02 - "drag from the edges to shrink or
    // grow the whole group's duration"). A press on an unselected clip has already
    // collapsed the selection to it (plus its A/V partner, which trims with it the way
    // a linked pair does in every NLE), so a lone clip is still a lone trim.
    beginGesture(tp, e, { ...base, kind: 'trim', edge, index0: 0, index: 0, groupIds });
    return;
  }

  // A DIAMOND under the pointer - checked after the trim zone and before move, in
  // that order and deliberately. A keyframe at local t = 0 sits exactly on the
  // in-edge, and a clip you cannot trim because its first pose is parked there
  // would be a worse trade than a first pose you retime from the inspector's list
  // (which is where every diamond is reachable anyway, and the same trade the
  // `is-tight` rule already makes for the whole strip).
  const dot = target.closest<HTMLElement>('.tl-kf-dot');
  const dotT = dot ? finite(dot.dataset.t, NaN) : NaN;
  if (dot && cfg.kfField && Number.isFinite(dotT)) {
    beginGesture(tp, e, { ...base, kind: 'kf', index0: 0, index: 0, kfT0: dotT, kfDot: dot });
    return;
  }
  if (lane === 'seq') {
    const order = seqBoxes(boxes, cfg).map((b) => String(b[cfg.idField] ?? ''));
    const idx = order.indexOf(id);
    beginGesture(tp, e, {
      ...base,
      kind: 'reorder',
      index0: idx,
      index: idx,
      groupIds,
      collapseOnClick: inMulti,
    });
    return;
  }
  beginGesture(tp, e, {
    ...base,
    kind: 'move',
    index0: 0,
    index: 0,
    groupIds,
    collapseOnClick: inMulti,
  });
}
export function onPointerMove(tp: TpCtx, e: PointerEvent): void {
  const g = tp.gesture;
  if (!g) return;
  // Synchronous state capture, rAF-coalesced painting: pointerup must never depend on
  // whether the last frame ran.
  g.x = e.clientX;
  g.y = e.clientY;
  g.alt = e.altKey;
  if (Math.abs(g.x - g.x0) > 2 || Math.abs(g.y - g.y0) > 2) g.moved = true;
  if (tp.moveScheduled) return;
  tp.moveScheduled = true;
  requestAnimationFrame(() => {
    tp.moveScheduled = false;
    if (!tp.gesture || tp.disposed) return;
    paintGesture(tp, tp.gesture);
  });
}
/**
 * The panel's non-track chrome - grip + bar + ruler - MEASURED rather than derived
 * from a constant, because `.tl-bar` wraps to two or three rows below 720px depending
 * on how many tool buttons the host declared and whether a clip is selected (the
 * inspector row only exists with a selection). This is what clampPanelH's floor is
 * built from, so the grip can never drag `.tl-tracks` down to nothing.
 */
export function chromeH(tp: TpCtx): number {
  const { bar, handle, ruler } = tp;
  return Math.round(
    handle.getBoundingClientRect().height +
      bar.getBoundingClientRect().height +
      ruler.getBoundingClientRect().height
  );
}
/**
 * The trim readout, anchored at the edge under the pointer. Its row was decided in
 * beginTrimChrome; per frame this writes only the horizontal place and the words.
 */
export function paintTrimBadge(tp: TpCtx, g: Gesture, edgeTime: number, dur: number): void {
  const { trimBadge } = tp;
  trimBadge.hidden = false;
  trimBadge.textContent = `${fmtDur(dur)}  ${fmtDelta(dur - g.dur0)}`;
  trimBadge.style.left = `${timeToPx(edgeTime, tp.pxPerSec)}px`;
}
/** Position the rubber band in timeline-content pixels (it lives inside `inner`, so
 *  it scrolls with the bars). Client coords in, content coords out. */
export function drawMarquee(tp: TpCtx, x0: number, y0: number, x1: number, y1: number): void {
  const { marquee, tracks } = tp;
  const rect = tracks.getBoundingClientRect();
  marquee.style.left = `${Math.min(x0, x1) - rect.left + tracks.scrollLeft}px`;
  marquee.style.top = `${Math.min(y0, y1) - rect.top + tracks.scrollTop}px`;
  marquee.style.width = `${Math.abs(x1 - x0)}px`;
  marquee.style.height = `${Math.abs(y1 - y0)}px`;
}
/** Select every clip bar whose box intersects the marquee (client-rect test - the
 *  same viewport coords the drag captured). Additive drags union with the selection. */
export function commitMarquee(tp: TpCtx, g: Gesture): void {
  const { bars, selection } = tp;
  const rx0 = Math.min(g.x0, g.x),
    rx1 = Math.max(g.x0, g.x);
  const ry0 = Math.min(g.y0, g.y),
    ry1 = Math.max(g.y0, g.y);
  const hits: string[] = [];
  for (const [id, node] of bars) {
    const r = node.getBoundingClientRect();
    if (r.right >= rx0 && r.left <= rx1 && r.bottom >= ry0 && r.top <= ry1) hits.push(id);
  }
  const base = g.additive ? selection.get() : [];
  tp.rows.selectAndReveal(Array.from(new Set([...base, ...hits])), { reveal: false });
  if (hits.length) announce(t('{count} clips selected', { count: hits.length }));
}
/** Live preview - PANEL DOM ONLY. The model is untouched until pointerup. */
export function paintGesture(tp: TpCtx, g: Gesture): void {
  const { bars, cfg, getBoxes, reserve, root, stageEl } = tp;
  if (g.kind === 'marquee') {
    drawMarquee(tp, g.x0, g.y0, g.x, g.y);
    return;
  }
  if (g.kind === 'resize') {
    const stageH = stageEl.getBoundingClientRect().height || 0;
    tp.panelH = clampPanelH(g.h0 + (g.y0 - g.y), stageH, chromeH(tp));
    root.style.height = `${tp.panelH}px`;
    reserve(tp.panelH + RESERVE_PAD);
    return;
  }
  if (g.kind === 'seek') {
    const at = maybeSnap(tp, tp.syncing.timeAt(g.x), g.alt, undefined, undefined, true);
    tp.rows.seekAuthored(at * 1000, { scrubbing: true });
    return;
  }
  const el = g.el;
  if (!el) return;
  const deltaSec = pxToTime(g.x - g.x0, tp.pxPerSec);
  // Preview by running the REAL writer on a throwaway array and drawing its answer.
  // Duplicating the clamps here is what made the bar preview a 5 s trim on a 2 s
  // source and then snap back to 2 s on release: the inline version knew about
  // MIN_DUR but not about the media length. The writers are pure, so this costs one
  // array map per rAF frame and can never drift from the commit.
  //
  // EVERY bar, not just the dragged one: trimming a seq clip ripples the whole row,
  // and Premiere 26's answer (the downstream bars move WITH the drag rather than
  // jumping on release) is free here - the throwaway array already holds their new
  // starts. The seam chips ride the same numbers, exactly as restyle positions them.
  const previewRows = (rows: Box[]): void => {
  const { laneWrap } = tp;
    const total = tp.rows.durationSec();
    for (const [id, node] of bars) {
      const i = indexOfId(rows, cfg, id);
      if (i < 0) continue;
      const { start, dur } = tp.rows.span(rows[i]!, total);
      tp.rows.applyBarGeometry(node, start, dur);
    }
    for (const chip of Array.from(laneWrap.querySelectorAll<HTMLElement>('.tl-seam'))) {
      const i = indexOfId(rows, cfg, chip.dataset.b || '');
      if (i < 0) continue;
      chip.style.left = `${timeToPx(boxTiming(rows[i]!, cfg).start ?? 0, tp.pxPerSec)}px`;
    }
  };
  if (g.kind === 'kf') {
    // PANEL DOM ONLY, like every other preview here: the dot moves, the model does
    // not. Alt is the DUPLICATE modifier on this gesture (it is the drag's own
    // meaning, not a snap bypass - a keyframe snaps to nothing), so the class says
    // so while the pointer is down and the copy is made once, on release.
    const dot = g.kfDot;
    if (!dot) return;
    const to = kfSlideMs(g.kfT0 ?? 0, deltaSec, g.dur0);
    dot.style.left = `${timeToPx(kfLocalSec(to), tp.pxPerSec)}px`;
    dot.classList.toggle('is-duplicating', g.alt);
    return;
  }
  if (g.kind === 'move') {
    if (g.groupIds && g.groupIds.length > 1) {
      previewRows(moveOverlays(getBoxes(), cfg, g.groupIds, deltaSec));
      return;
    }
    previewRows(moveOverlay(getBoxes(), cfg, g.id, maybeSnap(tp, g.start0 + deltaSec, g.alt, g.id)));
    resolveLaneDrop(tp, g);
    return;
  }
  if (g.kind === 'trim') {
    const raw = g.edge === 'in' ? g.start0 + deltaSec : g.start0 + g.dur0 + deltaSec;
    const snapped = maybeSnap(tp, raw, g.alt, g.id);
    const d = g.edge === 'in' ? snapped - g.start0 : snapped - (g.start0 + g.dur0);
    const rows = trimRows(tp, getBoxes(), trimIdsOf(tp, g), g.edge ?? 'out', d);
    previewRows(rows);
    const i = indexOfId(rows, cfg, g.id);
    if (i < 0) return;
    const achieved = tp.rows.span(rows[i]!, tp.rows.durationSec());
    // THE LIMIT SIGNAL. Requested vs achieved, using the writer's OWN answer - no
    // clamp is duplicated here, which is the whole point: `fitToMedia` stays the only
    // authority on where a clip runs out of source, and this just notices that it
    // said no. Without it a drag past the end of the media looks like a dead pointer.
    //
    // Compared on the DURATION, never on the edge's absolute time: the seq row is
    // magnetic, so a successful trim-in repacks the clip back to the same `start` it
    // had, and an absolute comparison would report a limit on every single one. Both
    // edges change the length by exactly the delta they achieved, on both lanes.
    const achievedD = g.edge === 'in' ? g.dur0 - achieved.dur : achieved.dur - g.dur0;
    const limit = Math.abs(achievedD - d) > 0.001;
    edgeEl(tp, el, g.edge)?.classList.toggle('is-limit', limit);
    if (limit && !g.limitSaid) {
      g.limitSaid = true;
      // Direction, not edge: held back from moving the edge EARLIER is the head of the
      // source, from moving it LATER is the tail. (A clip stopped by the MIN_DUR floor
      // rather than by the file reports through the same pair - the visual signal is
      // exactly right either way, and these are the nearest true words we have.)
      announce(achievedD > d ? t('Start of the source') : t('End of the source'));
    }
    const at = g.edge === 'in' ? achieved.start : achieved.start + achieved.dur;
    paintTrimBadge(tp, g, at, achieved.dur);
    return;
  }
  if (g.kind === 'reorder') {
    if (g.groupIds && g.groupIds.length > 1) {
      // A group of seq clips: preview the whole block repacking into place (the same
      // "downstream bars move with the drag" style as move/trim), rather than lifting
      // one bar. The index is measured against the row WITHOUT any moving clip.
      g.index = groupDropIndex(getBoxes(), cfg, tp.syncing.timeAt(g.x), g.groupIds);
      previewRows(moveSeqClips(getBoxes(), cfg, g.groupIds, g.index, tp.helpers.mediaDur));
      return;
    }
    // Lift the bar and let the row show where it would land. The drop index comes from
    // the pointer's time position against the CURRENT starts.
    el.classList.add('is-dragging');
    el.style.transform = `translateX(${g.x - g.x0}px)`;
    const order = seqBoxes(getBoxes(), cfg);
    g.index = dropIndexAt(getBoxes(), cfg, tp.syncing.timeAt(g.x), g.id);
    // Highlight the clip the drop would displace: the one currently sitting at the
    // target index. Nothing is highlighted while the index is unchanged, so the row
    // stays quiet until the drag would actually reorder something.
    const targetId = g.index === g.index0 ? '' : String(order[g.index]?.[cfg.idField] ?? '');
    for (const [id, node] of bars)
      node.classList.toggle('is-drop-target', !!targetId && id !== g.id && id === targetId);
    el.dataset.dropIndex = String(g.index);
  }
}
/**
 * THE one teardown for a gesture, whatever ended it - pointerup, pointercancel, a
 * lost capture, or the panel closing under a drag. Every transient the gesture
 * painted is cleared HERE, so no exit path can leak one:
 *   • `is-drop-target` lives on OTHER bars, and a reorder does not change tracksKey,
 *     so a rebuild will never clean it up - a stale ring would sit on a clip for the
 *     rest of the session;
 *   • the dragged bar's lift transform and dropIndex;
 *   • the three trim states (`is-trimming` on the bar, `is-active`/`is-limit` on the
 *     edge), the readout badge and the ghost extent - added in beginTrimChrome and
 *     removed ONLY here, so no exit path can strand a red edge on a clip;
 *   • the pointer capture.
 * It also replays a model change that arrived mid-gesture and was dropped.
 */
export function endGesture(tp: TpCtx, g: Gesture | null): void {
  const { bars, extent, laneWrap, marquee, root, trimBadge } = tp;
  tp.gesture = null;
  tp.snappedAt = null;
  root.classList.remove('is-dragging');
  showSnapline(tp, null);
  if (g) {
    try {
      (g.el ?? root).releasePointerCapture?.(g.pointerId);
    } catch {
      /* never captured */
    }
    if (g.el) {
      g.el.classList.remove('is-dragging');
      g.el.style.transform = '';
      delete g.el.dataset.dropIndex;
    }
    // The dragged diamond's alt cue. Cleared HERE with everything else, so an
    // Escape mid-drag cannot strand a dot painted as "about to be copied".
    g.kfDot?.classList.remove('is-duplicating');
  }
  for (const node of bars.values()) node.classList.remove('is-drop-target', 'is-trimming');
  for (const e of Array.from(laneWrap.querySelectorAll<HTMLElement>('.tl-edge'))) {
    e.classList.remove('is-active', 'is-limit');
  }
  trimBadge.hidden = true;
  extent.hidden = true;
  marquee.hidden = true;
  // The KEYBOARD trim focus is a persistent state, not a gesture transient; the sweep
  // above cannot tell the two apart, so re-assert it rather than leaving the user's
  // chosen edge unmarked after an unrelated drag.
  tp.edit.paintFocusedEdge();
  // A model change that arrived mid-gesture was deferred, not dropped. Replay it.
  if (tp.syncMissed) tp.syncing.scheduleSync();
}
export function onPointerUp(tp: TpCtx, e: PointerEvent): void {
  const { cfg, getBoxes, marquee, reserve } = tp;
  const g = tp.gesture;
  if (!g) return;
  endGesture(tp, g);

  // Rubber-band select: hit-test the bars against the final rect. A drag that never
  // moved (a click on empty space) already cleared the selection at pointerdown.
  if (g.kind === 'marquee') {
    marquee.hidden = true;
    if (g.moved) commitMarquee(tp, g);
    tp.syncing.sync();
    tp.thumbs.scheduleThumbs();
    return;
  }

  // These two branches write nothing to the model, so they must run the sync a
  // mid-gesture model change (a sidebar edit made while scrubbing) never got.
  if (g.kind === 'resize') {
    reserve(tp.panelH + RESERVE_PAD);
    tp.syncing.sync();
    tp.thumbs.scheduleThumbs();
    return;
  }
  // `gesture` is already null (endGesture, above), so every maybeSnap below has to be
  // told what kind of pointer this was - see maybeSnap's own note.
  const coarse = isCoarsePointer(g.pointerType);
  if (g.kind === 'seek') {
    const at = maybeSnap(tp, tp.syncing.timeAt(g.x), g.alt, undefined, coarse, true);
    tp.rows.seekAuthored(at * 1000);
    tp.syncing.sync();
    tp.thumbs.scheduleThumbs();
    return;
  }
  // A diamond PRESSED and released without moving is a click, and a click on a
  // keyframe opens the Keyframes popup ON it (section 8's M2.7 (a): "selection + popup in
  // one gesture"). Before the `!g.moved` return below, because that one is the
  // "nothing happened" path and this is the one gesture where nothing MOVING is
  // itself the intent.
  if (g.kind === 'kf' && !g.moved) {
    tp.keyframes.openKeyframeAt(g.id, g.kfT0 ?? 0);
    tp.syncing.sync();
    tp.thumbs.scheduleThumbs();
    return;
  }
  // A plain click (no move) on a clip that was part of a multi-selection collapses to
  // just that clip - the standard "click one of a selection" behaviour.
  if (!g.moved) {
    if (g.collapseOnClick) tp.rows.selectAndReveal([g.id]);
    tp.syncing.sync();
    tp.thumbs.scheduleThumbs();
    return;
  }

  // ── the ONE model write of the gesture ────────────────────────────────────
  const boxes = getBoxes();
  const deltaSec = pxToTime(g.x - g.x0, tp.pxPerSec);
  const alt = e.altKey || g.alt;
  if (g.kind === 'kf') {
    // ONE commit on release, whichever it was: a retime REPLACES anything already
    // parked at the destination (the wire cannot hold two poses at one instant),
    // an alt-drag leaves the original where it was and copies it.
    const from = g.kfT0 ?? 0;
    const to = kfSlideMs(from, deltaSec, g.dur0);
    if (to !== from) {
      const j = indexOfId(boxes, cfg, g.id);
      const at = j >= 0 ? fmtTime(kfTimelineSec(boxes[j]!, cfg, to)) : '';
      tp.keyframes.writeTrack(g.id, (track) =>
        alt ? kfTrackDuplicate(track, from, to) : kfTrackRetime(track, from, to)
      );
      announce(
        alt ? t('Keyframe copied to {t}', { t: at }) : t('Keyframe moved to {t}', { t: at })
      );
    } else {
      // Nothing arrived, so nothing was written - but the dot has been dragged and
      // must go back to where the model still says it is.
      tp.syncing.scheduleSync();
    }
    tp.thumbs.scheduleThumbs();
    return;
  }
  if (g.kind === 'move') {
    if (g.groupIds && g.groupIds.length > 1) {
      // Batch overlay move: one write, one undo step. moveOverlays shifts every
      // selected overlay by the same clamped delta and ignores seq/unselected members.
      tp.helpers.write(moveOverlays(boxes, cfg, g.groupIds, deltaSec));
      announce(t('{count} clips moved', { count: g.groupIds.length }));
      clearLaneDropPaint(tp);
      showSnapline(tp, null);
      tp.thumbs.scheduleThumbs();
      return;
    }
    // moveOverlay owns the clamp AND the ms rounding, so a drag and the inspector's
    // Start field land on exactly the same value for the same time.
    let next = moveOverlay(boxes, cfg, g.id, maybeSnap(tp, g.start0 + deltaSec, alt, g.id, coarse));
    // The drag's vertical half: restack against the row under the drop (or between).
    // ONE write for both halves, so the whole drop is one undo step; identity from
    // restackOverlay means a wobble that went nowhere costs nothing extra.
    if (g.laneDrop) {
      const dropped = restackOverlay(next, cfg, g.id, g.laneDrop);
      if (dropped !== next) {
        next = dropped;
        announce(
          'onto' in g.laneDrop
            ? tRaw('Now sharing a layer with {name}', { name: tp.helpers.labelFor(g.laneDrop.onto) })
            : t('Layer order changed')
        );
      }
    }
    clearLaneDropPaint(tp);
    tp.helpers.write(next);
  } else if (g.kind === 'trim') {
    const raw = g.edge === 'in' ? g.start0 + deltaSec : g.start0 + g.dur0 + deltaSec;
    const snapped = maybeSnap(tp, raw, alt, g.id, coarse);
    const d = g.edge === 'in' ? snapped - g.start0 : snapped - (g.start0 + g.dur0);
    const ids = trimIdsOf(tp, g);
    const next = trimRows(tp, boxes, ids, g.edge ?? 'out', d);
    tp.helpers.write(next);
    // The badge was aria-hidden throughout (sixty updates a second is not speech);
    // this is its ONE spoken form, and it reports what actually arrived, not what was
    // asked for - so a drag the media refused says so by simply reading back short.
    const j = indexOfId(next, cfg, g.id);
    if (j >= 0) {
      const now = tp.rows.span(next[j]!, tp.rows.durationSec()).dur;
      // A batch reads back the pressed clip's own delta with the count: every
      // selected edge asked for the same move, and the pressed bar is the one the
      // badge was following, so its number is the one the user was watching.
      announce(
        ids.length > 1
          ? tRaw('{count} clips trimmed {delta}', {
              count: ids.length,
              delta: fmtDelta(now - g.dur0),
            })
          : tRaw('{name}: {dur}, trimmed {delta}', {
              name: tp.helpers.labelFor(g.id),
              dur: fmtDur(now),
              delta: fmtDelta(now - g.dur0),
            })
      );
    }
  } else if (g.kind === 'reorder') {
    // Re-derive from the FINAL pointer position rather than trusting g.index: that one
    // is written by paintGesture, which is rAF-coalesced, so the last pointermove of a
    // fast drag may never have painted. Same discipline as move/trim above - pointerup
    // never depends on whether a frame ran.
    if (g.groupIds && g.groupIds.length > 1) {
      const index = groupDropIndex(boxes, cfg, tp.syncing.timeAt(g.x), g.groupIds);
      tp.helpers.write(moveSeqClips(boxes, cfg, g.groupIds, index, tp.helpers.mediaDur));
      announce(t('{count} clips moved', { count: g.groupIds.length }));
    } else {
      const index = dropIndexAt(boxes, cfg, tp.syncing.timeAt(g.x), g.id);
      if (index !== g.index0) tp.helpers.write(moveSeqClip(boxes, cfg, g.id, index, tp.helpers.mediaDur));
      else tp.syncing.sync();
    }
  }
  showSnapline(tp, null);
  tp.thumbs.scheduleThumbs();
}
export function onPointerCancel(tp: TpCtx): void {
  const { reserve } = tp;
  if (!tp.gesture) return;
  const g = tp.gesture;
  clearLaneDropPaint(tp);
  endGesture(tp, g);
  // A cancelled resize still left the panel at its dragged height; re-assert the
  // reserve so the artboard and the panel agree.
  if (g.kind === 'resize') reserve(tp.open ? tp.panelH + RESERVE_PAD : 0);
  tp.syncing.sync();
}
export function gesturesOps(tp: TpCtx) {
  return {
    showSnapline: bindOp(tp, showSnapline),
    latchCandidates: bindOp(tp, latchCandidates),
    maybeSnap: bindOp(tp, maybeSnap),
    edgeEl: bindOp(tp, edgeEl),
    trimIdsOf: bindOp(tp, trimIdsOf),
    trimRows: bindOp(tp, trimRows),
    offsetIn: bindOp(tp, offsetIn),
    beginGesture: bindOp(tp, beginGesture),
    clearLaneDropPaint: bindOp(tp, clearLaneDropPaint),
    resolveLaneDrop: bindOp(tp, resolveLaneDrop),
    beginTrimChrome: bindOp(tp, beginTrimChrome),
    showExtent: bindOp(tp, showExtent),
    onPointerDown: bindOp(tp, onPointerDown),
    onPointerMove: bindOp(tp, onPointerMove),
    chromeH: bindOp(tp, chromeH),
    paintTrimBadge: bindOp(tp, paintTrimBadge),
    drawMarquee: bindOp(tp, drawMarquee),
    commitMarquee: bindOp(tp, commitMarquee),
    paintGesture: bindOp(tp, paintGesture),
    endGesture: bindOp(tp, endGesture),
    onPointerUp: bindOp(tp, onPointerUp),
    onPointerCancel: bindOp(tp, onPointerCancel),
  };
}
