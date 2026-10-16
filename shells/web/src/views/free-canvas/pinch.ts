// SPDX-License-Identifier: MPL-2.0
/**
 * free-canvas: two fingers on the selection (plan 311). A pinch scales the selection, a
 * twist turns it and the midpoint carries it, in one undo step; two fingers anywhere
 * else still pan and zoom the view, which tool-stage-nav.ts owns on the same stage.
 *
 * The arbitration runs in the stage's capture-phase touch listener, ahead of the canvas
 * and the stage's own pinch, and it is decided against the selection as it stood when
 * the FIRST finger of the sequence came down, before that finger's press could change
 * the selection. Two fingers take the selection only when the first finger pressed a
 * selected object on the canvas or its chrome (not a panel floating over the object),
 * the second followed within 300 ms on the selection or within a finger's grab zone
 * reach of the selection, both are fingers, no artboard is in the set, no row in the set
 * is parked on a keyframe at the playhead, the selection sits inside the
 * stage covering under 60% of the stage, nothing is locked and no text, pen, node or
 * gradient edit was live as either finger came down. A claimed pair is stopped there
 * (`stopImmediatePropagation`, which also covers a press on the bare stage). A declined
 * pair of fingers belongs to the stage: the first finger's gesture is cancelled, and
 * every finger down is handed to the stage's pinch (`fc-touch-handoff`), which never
 * sees a finger whose press an object, a surface keeping its own presses or an earlier
 * pinch held back. A pinch that ends with two fingers still down hands both to the
 * stage the same way, whether a lift committed the pinch or a cancel put the selection
 * back.
 *
 * The keyframe rule keeps two fingers from disagreeing with one: the pinch commits the
 * base rows, as a group scale does, where a one-finger move on a diamond poses the
 * keyframe instead.
 *
 * Nothing previews while the pair can still be a two-finger tap (every finger within the
 * tap's 14 px, inside its 500 ms), so a tap with a finger that rolls as it touches down
 * still opens the context menu and changes nothing. What the fingers do meanwhile still
 * counts: scale follows the spread once it has changed by 2% and by the tap's 14 px (so
 * no resting pair's jitter scales it, however close the fingers), turning follows the
 * twist past 10 degrees, counted from where it engaged, and the midpoint carries the
 * selection once it has travelled a finger's drag threshold or either of the others has
 * engaged (pinchTransform). Whatever had engaged when the preview begins eases in over
 * the tap's next 14 px of finger travel (pinchCatchUp). A scale or a travel that engages
 * later follows the fingers from the frame it engages on, and makes up what they did
 * before that frame over the next 14 px (shownPinch), so a scale and the travel it starts
 * keep the content under a finger that stays still. Nothing jumps and nothing stays
 * behind the fingers. The lift commits exactly what the preview shows, even while it is
 * still easing in. A resting pair commits nothing.
 * Scale mode scales the content too; otherwise the pinch is a uniform resize. A single
 * box turns about its own centre and a set about the centre of its bounds, with the
 * rotate handles' soft magnet (pinchMembers).
 *
 * Every function takes the shared `fc: FcCtx` first (see context.ts). Sibling calls in
 * this file are direct; anything in another module goes through `fc.<module>.<fn>`.
 */
import { boxRect, withRect } from '../free-canvas-math.ts';
import type { Box } from '../free-canvas-math.ts';
import {
  PINCH_SECOND_MS, PINCH_SPREAD_PX, PINCH_TRAVEL_PX, easePinch, nativeToScreen, pinchCatchUp, pinchFits, pinchMembers, pinchReaches,
  pinchTransform, rectsChanged, visibleRect, type PinchResult,
} from '../free-canvas-transform.ts';
import type { PinchGesture, Point, TouchPt } from './shared.ts';
import { bindOp, type FcCtx } from './context.ts';

/** The first finger of a touch sequence, and the selection as it stood when the finger came down. */
interface Sequence {
  pointerId: number;
  /** When the finger came down, in the event clock the second finger is measured against. */
  at: number;
  touch: boolean;
  /** The selection before this finger's press could change anything. */
  selection: ReadonlySet<string>;
  /** The finger pressed an object in that selection (or in its group, when the group is selected). */
  under: boolean;
  /** No edit was live as the finger came down, before its press could end one. */
  free: boolean;
}
const sequences = new WeakMap<FcCtx, Sequence>();

const stamp = (e: Pick<PointerEvent, 'timeStamp'>): number => e.timeStamp || Date.now();

/**
 * A finger or a pen on the stage, after the two-finger tap's bookkeeping. The first of a
 * sequence is noted; the second decides the pair; past two, a live pinch keeps the
 * stage, so a stray third finger neither cancels the pinch nor starts anything.
 */
export function pressPinch(fc: FcCtx, e: PointerEvent): void {
  const n = fc.touchPts.size;
  if (n === 1) land(fc, e);
  else if (n === 2) pair(fc, e);
  else if (fc.gesture?.type === 'pinch') e.stopImmediatePropagation();
}

/** The first finger came down: keep the selection as it is now, and whether the finger is
 *  on a selected object. A panel or popover floating over the selection keeps its presses. */
function land(fc: FcCtx, e: PointerEvent): void {
  const selection = new Set(fc.selection);
  const target = e.target as Node | null;
  let under = false;
  if (selection.size && target && (fc.canvasEl.contains(target) || fc.chrome.contains(target))) {
    const boxes = fc.select.getBoxes();
    const at = fc.stage.clientToNative(e.clientX, e.clientY);
    const hit = fc.select.selectHit(boxes, at.x, at.y);
    under = hit >= 0 && fc.select.selectionForHit(boxes, hit, false).some((id) => selection.has(id));
  }
  sequences.set(fc, { pointerId: e.pointerId, at: stamp(e), touch: e.pointerType === 'touch', selection, under, free: pinchMode(fc) });
}

/** The second finger came down: take the pair for the selection, or give every finger down to the stage. */
function pair(fc: FcCtx, e: PointerEvent): void {
  const seq = sequences.get(fc);
  const first = seq && fc.touchPts.has(seq.pointerId) && seq.pointerId !== e.pointerId ? seq : null;
  if (first && claim(fc, e, first)) {
    e.stopImmediatePropagation();
    return;
  }
  // The stage's pair, when both are fingers: whatever the first finger began is
  // cancelled, and every finger down goes to the stage's pinch. An object press kept the
  // first finger's press from the stage, a surface that keeps its own presses (the
  // object bar) would keep the second's, and a finger left down from a pinch that ended
  // never reached the stage at all. A pen in the pair is never handed to the stage, and
  // its stroke is not ended here: a finger on the canvas or a handle still ends one there.
  if (![...fc.touchPts.values()].every((p) => p.touch)) return;
  fc.gestures.secondFinger(e);
  fingersToStage(fc);
}

/** The modes a pinch on the selection belongs to: the pointer, for someone who may edit,
 *  with no text, pen, node, gradient or text path edit live. */
function pinchMode(fc: FcCtx): boolean {
  return fc.mode === 'select' && !fc.armedKind && !fc.editing && !fc.penDraft && !fc.penEdit && !fc.nodeToolActive &&
    !fc.textPathDrawing && fc.gradEdit == null && !fc.spacePan && fc.opts?.canEdit?.() !== false;
}

/**
 * The pair's rows, when two fingers may take the selection as it stood at the first
 * finger's press (see the file comment), or null. `sel` is what the pinch scales and
 * carries (Scale mode widens the set, as a Scale drag does) and `turns` marks, by
 * position, the rows the twist turns: the plain selection without artboards. The caller
 * has put that selection in place. `second` is the second finger, in client px, which
 * must touch down on the posed selection or within a finger's zone reach of the selection.
 */
function pinchRows(fc: FcCtx, boxes: Box[], second: Point): { sel: number[]; turns: boolean[] } | null {
  if (!fc.select.selectionLive(boxes)) return null;
  const set = fc.chromeSync.chromeSet(boxes);
  if (!set.handles || !set.idx.length) return null;
  const plain = fc.hierarchy?.transformIndices(boxes) || fc.select.selIndices(boxes);
  const sel = fc.selectionTransform.transformSet(boxes);
  if (!sel.length || [...plain, ...sel, ...set.idx].some((i) => fc.gestures.isFrameRow(boxes[i]))) return null;
  // A row on a keyframe at the playhead (see the file comment).
  if (fc.timelinePanel?.kfPoseIds(sel.map((i) => fc.select.idOf(boxes[i], i))).length) return null;
  // The selection as the chrome poses it, on screen, against the visible stage.
  const m = fc.stage.metrics();
  const rects = set.idx.map((i) => fc.chromeSync.chromeRect(boxes, i, null));
  const a = fc.chromeSync.aabbOfRects(rects);
  const onScreen = nativeToScreen({ x: a.minX, y: a.minY, w: a.maxX - a.minX, h: a.maxY - a.minY }, m);
  const view = visibleRect(m.sr, fc.viewEl.getBoundingClientRect());
  if (!pinchFits(onScreen, view)) return null;
  // One box is turned with the box, as its chrome is; a set is the bounds of its chrome.
  const one = rects.length === 1 ? rects[0]! : null;
  const posed = one ? nativeToScreen(one, m) : onScreen;
  if (!pinchReaches(second, posed, view)) return null;
  const turning = new Set(plain);
  return { sel, turns: sel.map((i) => turning.has(i)) };
}

/**
 * Take the pair for the selection when the sequence allows a pinch. A move, a resize or
 * a held zone press the first finger began hands over without committing: it is
 * cancelled, the boxes return to the model, and the pinch starts from there. A
 * selection the first press changed (an additive tap) is put back first. Returns
 * whether the pair was taken.
 */
function claim(fc: FcCtx, e: PointerEvent, first: Sequence): boolean {
  if (e.pointerType !== 'touch' || !first.touch || !first.under || !first.selection.size || !first.free) return false;
  if (stamp(e) - first.at > PINCH_SECOND_MS || !pinchMode(fc)) return false;
  if (fc.layout && !fc.layout.gestureReady('pinch')) return false;
  const a = fc.touchPts.get(first.pointerId);
  if (!a) return false;
  const was = fc.selection;
  const changed = was.size !== first.selection.size || [...first.selection].some((id) => !was.has(id));
  if (changed) fc.selection = new Set(first.selection);
  const boxes = fc.select.getBoxes();
  const rows = pinchRows(fc, boxes, { x: e.clientX, y: e.clientY });
  if (!rows) {
    fc.selection = was;
    return false;
  }
  if (fc.gesture) fc.gestures.cancelGesture();
  else if (changed) fc.chromeSync.renderChrome();
  const curA = { x: a.cx, y: a.cy }, curB = { x: e.clientX, y: e.clientY };
  fc.gestures.beginGesture(e, {
    type: 'pinch',
    pointerA: first.pointerId,
    ...rows,
    startBoxes: boxes,
    startA: fc.stage.clientToNative(curA.x, curA.y),
    startB: fc.stage.clientToNative(curB.x, curB.y),
    curA,
    curB,
    ...(fc.scaleContent && { content: true }),
  });
  if (fc.gesture?.type !== 'pinch') return false;
  try { fc.canvasEl.setPointerCapture(first.pointerId); } catch { /* the finger can already be gone */ }
  return true;
}

/** Give a finger to the stage's own pinch and pan, at the point it has reached. The stage
 *  ignores a finger it already has, and a finger's own press arriving after this only
 *  measures the pair again. */
function handOff(fc: FcCtx, pointerId: number, p: TouchPt): void {
  // From the stage's own realm, as chrome-sync's `fc-artboard` is built.
  const Ev = (fc.stageEl.ownerDocument?.defaultView?.CustomEvent ?? CustomEvent) as typeof CustomEvent;
  fc.stageEl.dispatchEvent(new Ev('fc-touch-handoff', { detail: { pointerId, x: p.cx, y: p.cy } }));
}

/** Every finger down goes to the stage's pinch and pan; a pen never does. */
function fingersToStage(fc: FcCtx): void {
  for (const [id, p] of fc.touchPts) if (p.touch) handOff(fc, id, p);
}

/** Either finger moved: keep its point, follow the pair's engage state with it, and keep
 *  the move from the stage. */
export function trackPinch(fc: FcCtx, e: PointerEvent): void {
  const g = fc.gesture;
  if (g?.type !== 'pinch') return;
  if (e.pointerId === g.pointerA) g.curA = { x: e.clientX, y: e.clientY };
  else if (e.pointerId === g.pointerId) g.curB = { x: e.clientX, y: e.clientY };
  else return;
  e.stopPropagation();
  follow(fc, g);
}

/** Can the pair still be a two-finger tap (every finger inside the tap's 14 px, inside
 *  its 500 ms)? Then nothing previews, and a lift opens the menu. */
const heldBack = (fc: FcCtx): boolean => !!fc.twoTapStart && !fc.twoTapDone;

/**
 * The pair's engage state at both fingers' latest points, kept on every finger move, so
 * the tap's hold-back delays what the preview shows and never where the twist engaged.
 * The first move past the hold-back notes where the preview begins and what had engaged
 * by then; a scale or a travel that engages later notes where it began to show and what
 * it owes (shownPinch).
 */
function follow(fc: FcCtx, g: PinchGesture): PinchResult {
  const nowA = fc.stage.clientToNative(g.curA.x, g.curA.y), nowB = fc.stage.clientToNative(g.curB.x, g.curB.y);
  const scale = fc.stage.metrics().scale;
  const res = pinchTransform(g.startA, g.startB, nowA, nowB, {
    scaleEngaged: g.scaleEngaged, engagedAt: g.engagedAt, travelEngaged: g.travelEngaged,
    travelDeadZone: PINCH_TRAVEL_PX / scale, scaleFloor: PINCH_SPREAD_PX / scale,
  });
  g.scaleEngaged = res.scaleEngaged;
  g.engagedAt = res.engagedAt;
  g.travelEngaged = res.travelEngaged;
  if (heldBack(fc)) return res;
  const now: [Point, Point] = [{ ...g.curA }, { ...g.curB }];
  if (!g.shownFrom || !g.early) {
    g.shownFrom = now;
    g.early = { scale: res.scaleEngaged, turn: res.rotateEngaged, travel: res.travelEngaged };
  }
  const early = g.early;
  const lateScale = res.scaleEngaged && !early.scale && !g.scaleFrom;
  const lateTravel = res.travelEngaged && !early.travel && !g.travelFrom;
  if (lateScale || lateTravel) {
    // Everything the fingers had done by the last frame, as though it had all engaged.
    const last = g.lastFrame?.map((p) => fc.stage.clientToNative(p.x, p.y));
    const before = pinchTransform(g.startA, g.startB, last?.[0] ?? g.startA, last?.[1] ?? g.startB, {
      scaleEngaged: true, travelEngaged: true,
    });
    if (lateScale) {
      g.scaleFrom = now;
      g.scaleOwed = before.k - 1;
    }
    if (lateTravel) {
      g.travelFrom = now;
      g.travelOwed = { x: before.dx, y: before.dy };
    }
  }
  return res;
}

/**
 * What the preview shows of a frame. What had engaged when the preview began eases in
 * by `from`. A scale or a travel that engaged later shows its change at the fingers less
 * what it owes (its change at the last frame before it engaged) times what is left of
 * its own ease: it moves with the fingers from the frame it engages on, and has made up
 * the rest once they have travelled the tap's 14 px further, so it neither jumps by what
 * the fingers did before nor stays behind them. A scale and the travel it starts owe
 * from the same frame and ease alike, which keeps the content under a still finger. A
 * turn counts from where it engaged, so one that engages later owes nothing.
 */
function shownPinch(
  g: PinchGesture,
  res: PinchResult,
  ease: NonNullable<PinchGesture['ease']>,
  early: NonNullable<PinchGesture['early']>,
): PinchResult {
  const eased = easePinch(res, {
    scale: early.scale ? ease.from : 1,
    turn: early.turn ? ease.from : 1,
    travel: early.travel ? ease.from : 1,
  });
  const owedScale = (g.scaleOwed ?? 0) * (1 - ease.scale);
  const owedTravel = 1 - ease.travel;
  return {
    ...eased,
    k: eased.k - owedScale,
    dx: eased.dx - (g.travelOwed?.x ?? 0) * owedTravel,
    dy: eased.dy - (g.travelOwed?.y ?? 0) * owedTravel,
  };
}

/**
 * One frame, from both fingers' latest points (applyGestureMove calls it once the
 * collaboration lease allows a frame): the rows as the frame leaves them, previewed live,
 * the content at `k` in Scale mode. A pair that can still be a tap previews nothing; the
 * rest eases in (see the file comment).
 */
export function pinchFrame(fc: FcCtx): void {
  const g = fc.gesture;
  if (g?.type !== 'pinch') return;
  const res = follow(fc, g);
  const now: [Point, Point] = [{ ...g.curA }, { ...g.curB }];
  const early = g.early;
  if (heldBack(fc) || !g.shownFrom || !early) {
    g.lastFrame = now;
    return;
  }
  const { cfg, minSize, TWO_TAP_SLOP } = fc;
  const prev = g.ease ?? { from: 0, scale: 0, travel: 0 };
  const caught = (from: [Point, Point] | undefined, was: number): number =>
    from ? Math.max(was, pinchCatchUp(from, now, TWO_TAP_SLOP)) : 0;
  g.ease = {
    from: caught(g.shownFrom, prev.from),
    scale: caught(g.scaleFrom, prev.scale),
    travel: caught(g.travelFrom, prev.travel),
  };
  g.lastFrame = now;
  const shown = shownPinch(g, res, g.ease, early);
  const f = pinchMembers(g.sel.map((i) => boxRect(g.startBoxes[i], cfg)), shown, { minSize, turns: g.turns });
  const at = new Map(g.sel.map((i, j) => [i, f.rects[j]!]));
  const next = g.startBoxes.map((b, i) => {
    const r = at.get(i);
    return r ? withRect(b, r, cfg) : b;
  });
  if (g.content) fc.selectionTransform.previewScale(g, next, f.k);
  else for (const i of g.sel) fc.gestures.applyLiveRect(i, boxRect(next[i], cfg));
  g.k = f.k;
  g.deg = f.deg;
  g.liveBoxes = next;
}

/** Did the pinch change anything? The move and resize commits' 0.5 px, and the turn's 0.01 degree. */
function pinchChanged(fc: FcCtx, g: PinchGesture): boolean {
  const next = g.liveBoxes;
  if (!next) return false;
  return rectsChanged(g.sel.map((i) => [boxRect(g.startBoxes[i], fc.cfg), boxRect(next[i], fc.cfg)] as const), true);
}

/**
 * A finger lifted (onGestureEnd has applied the last frame): commit the pinch as one undo
 * step, or put the preview back when it changed nothing. Two fingers still down, the
 * one left of the pair and one the pinch held back, are the stage's pair from here.
 */
export function endPinch(fc: FcCtx): void {
  const g = fc.gesture;
  if (g?.type !== 'pinch') return;
  for (const id of [g.pointerA, g.pointerId]) {
    try { fc.canvasEl.releasePointerCapture(id); } catch { /* released with the lift */ }
  }
  // The lift commits the frame on screen, the lift's own point included: a preview still
  // easing in does not catch up first, so the commit never differs from what was shown.
  const next = pinchChanged(fc, g) ? g.liveBoxes : undefined;
  fc.gestures.endGesture(!!next);
  if (next) commitPinch(fc, g, next);
  else fc.chromeSync.renderChrome();
  releasePinch(fc);
}

/**
 * The pinch is over, committed or not: two or more fingers still down are the stage's
 * pair from here. endPinch calls this after a lift; onGestureEnd calls this after a
 * pinch it cancelled (a pointercancel on one finger, or a lift the edit could not
 * take), once the cancel has put the selection back. A single finger left down waits
 * for the next finger, and pair() hands both fingers over then. Escape cancels the
 * pinch elsewhere and leaves the fingers where they are.
 */
export function releasePinch(fc: FcCtx): void {
  if ([...fc.touchPts.values()].filter((p) => p.touch).length > 1) fingersToStage(fc);
}

/**
 * The pinch's one commit. It merges only this gesture's geometry, by stable id, onto the
 * current rows, as the group transforms do, and writes the base rows, as a group scale
 * does. A Scale's content and composed text come from the same helper as a Scale drag
 * and name the step "Scale"; any other pinch takes the name the history reads from the
 * change.
 */
function commitPinch(fc: FcCtx, g: PinchGesture, next: Box[]): void {
  const { cfg } = fc;
  const boxes = fc.select.getBoxes();
  const byId = new Map(g.sel.map((i) => [fc.select.idOf(next[i], i), boxRect(next[i], cfg)]));
  const merged = boxes.map((box, i) => {
    const r = byId.get(fc.select.idOf(box, i));
    return r ? withRect(box, r, cfg) : box;
  });
  const selected = boxes.flatMap((box, i) => (byId.has(fc.select.idOf(box, i)) ? [i] : []));
  const rows = fc.select.assignFrames(fc.select.cascadeFrameChildren(boxes, merged, selected), new Set(selected));
  const source = { type: 'gscale' as const, sel: g.sel, startBoxes: g.startBoxes, content: g.content, k: g.k };
  const scaled = fc.selectionTransform.withScale(source, rows);
  fc.select.commit(scaled.boxes, scaled.patch, scaled.label, scaled.frames);
}

/** Safari's own gesture events. */
const SAFARI_GESTURES = ['gesturestart', 'gesturechange', 'gestureend'] as const;

/**
 * Safari and the macOS app's WebKit view send a pinch as gesturestart, gesturechange and
 * gestureend too. While a pinch holds the selection their default zoom is suppressed, and
 * the start and the change are kept from the stage's pinch, so the view does not zoom
 * under the fingers. The end still reaches the stage, which resets its own state there.
 * Returns the unbind.
 */
export function wirePinch(fc: FcCtx): () => void {
  const { stageEl } = fc;
  const hold = (e: Event): void => {
    if (fc.gesture?.type !== 'pinch') return;
    e.preventDefault();
    if (e.type !== 'gestureend') e.stopImmediatePropagation();
  };
  for (const type of SAFARI_GESTURES) stageEl.addEventListener(type, hold, true);
  return () => {
    for (const type of SAFARI_GESTURES) stageEl.removeEventListener(type, hold, true);
    sequences.delete(fc);
  };
}

export function pinchOps(fc: FcCtx) {
  return {
    press: bindOp(fc, pressPinch),
    track: bindOp(fc, trackPinch),
    frame: bindOp(fc, pinchFrame),
    end: bindOp(fc, endPinch),
    release: bindOp(fc, releasePinch),
    wire: bindOp(fc, wirePinch),
  };
}
