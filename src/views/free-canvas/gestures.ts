// SPDX-License-Identifier: MPL-2.0
/**
 * free-canvas: pointer and touch gestures - press, drag, resize, rubber band, snapping guides.
 *
 * Every function takes the shared `fc: FcCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `fc.<module>.<fn>`. Extracted verbatim
 * from initFreeCanvas() by scripts/split-closure.ts.
 */
import { boxAABB, boxRect, filterMarqueeFrames, moveBoxes, normAngle, normDragRect, num, rectCentre, resizeRect, rotateGroup, scaleGroup, seedBox, selectionAABB, snapAngle, snapMove, snapPoint, withRect } from '../free-canvas-math.ts';
import type { AABB as MathAABB, Box, Rect as MathRect } from '../free-canvas-math.ts';
import { pickMarquee, pickTopmost } from '../canvas-scene.ts';
import { boxOutlineKind } from '../vector-ops.ts';
import { closesOnClick, convertKind, dragHandle, frameToLocal, kindReadsHandles, lowerAuthored, moveNodes, nearestOnPath, nodeAt, pullHandles } from '../free-canvas-pen.ts';
import { announce } from '../../a11y.ts';
import { isTypingTarget } from '../../lib/typing-target.ts';
import { t } from '../../i18n.ts';
import { SNAP_PX, boolOf } from './shared.ts';
import type { AABB, Gesture, GestureInit, HandleName, Point, Rect } from './shared.ts';
import { bindOp, type FcCtx } from './context.ts';

// ── pointer gestures on the canvas ───────────────────────────────────────────
export function beginGesture(fc: FcCtx, e: PointerEvent, g: GestureInit): void {
  const { canvasEl } = fc;
  try {
    canvasEl.setPointerCapture(e.pointerId);
  } catch {
    /* older browsers */
  }
  fc.gesture = {
    ...g,
    pointerId: e.pointerId,
    startClient: { x: e.clientX, y: e.clientY },
  } as Gesture;
  fc.edges.setHoverEdge(null); // drop any hover highlight/cursor when a drag begins
  document.body.classList.add('fc-manipulating');
  fc.textEdit.setFramesClipped(false);
  fc.frameOffCache = new Map(); // frame offsets are stable during a drag - cache to avoid per-move reflow
}
export function endGesture(fc: FcCtx): void {
  const { rubber, stageEl } = fc;
  document.body.classList.remove('fc-manipulating');
  fc.gesture = null;
  rubber.hidden = true;
  // The camera HUD and its mode cursor die WITH the gesture, whichever way it ended -
  // committed, cancelled, or a click that never moved. This one teardown covers every
  // exit path, so no branch has to remember to clear them.
  fc.stage.hideCamHud();
  stageEl.style.cursor = '';
  clearGuides(fc);
  fc.textEdit.setFramesClipped(true);
  fc.frameOffCache = null; // release the gesture-scoped frame-offset cache
  // The ctx bar's live state dies WITH the gesture: the frozen placement, the cached
  // chrome rects, and - the visible one - the drag readout. Its values come from
  // `liveRects`, so without a repaint of its own the bar keeps showing the coordinates
  // the pointer left behind until the tool's own re-render arrives, which is a second or
  // more away and outlives things as unrelated as a playhead scrub. `commit()` writes
  // the model synchronously, so the frame after this one reads the settled numbers.
  fc.ctxFrozen = null;
  fc.ctxBlockers = null;
  if (!fc.disposed)
    requestAnimationFrame(() => {
      if (!fc.disposed && !fc.gesture) fc.chromeSync.renderChrome();
    });
}
export function onDblClick(fc: FcCtx, e: MouseEvent): void {
  const { cfg, vectorCfg } = fc;
  // A double-click ends an open pen path - the polyline-ending gesture every tool with a
  // multi-click primitive uses - and it never falls through to a text edit, because there
  // is no box under the cursor yet to edit.
  if (fc.penDraft) {
    e.preventDefault();
    fc.penTool.penFinishDraw();
    return;
  }
  // On a committed path box it ENTERS node editing, the same way a double-click enters a
  // text edit on a text box (see startTextEdit); one mode per kind of content.
  if (vectorCfg && !fc.penEdit) {
    const pnat = fc.stage.clientToNative(e.clientX, e.clientY);
    const pboxes = fc.select.getBoxes();
    const phit = pickTopmost(pboxes, pnat.x, pnat.y, cfg, fc.select.seqHiddenSkip(pboxes));
    if (phit >= 0 && boxOutlineKind(pboxes[phit], vectorCfg) === 'path') {
      e.preventDefault();
      fc.penTool.startPenEdit(fc.select.idOf(pboxes[phit], phit));
      return;
    }
  }
  if (fc.penEdit) return; // node-edit mode owns its own double-clicks
  if (!cfg.textField) return;
  // Already editing this box's text → let the browser's native double-click
  // word-selection stand. This listener is on the canvas, so a dblclick inside
  // the editable bubbles up to here; re-entering startTextEdit would commit +
  // restart the edit and collapse the caret to the end - the reported "word
  // flashes selected then vanishes" bug. (Triple-click escaped it only because
  // its third click fires no second dblclick event.) Just refresh the bar.
  if (fc.editing?.el.contains(e.target as Node)) {
    fc.textEdit.refreshFmtStates();
    return;
  }
  const nat = fc.stage.clientToNative(e.clientX, e.clientY);
  const boxes = fc.select.getBoxes();
  const hit = fc.select.selectHit(boxes, nat.x, nat.y); // artboard-aware (a frame has no editable text → startTextEdit no-ops)
  if (hit < 0) return;
  e.preventDefault();
  fc.selection = new Set([fc.select.idOf(boxes[hit], hit)]);
  fc.chromeSync.renderChrome();
  fc.textEdit.startTextEdit(fc.select.idOf(boxes[hit], hit));
} // menu already opened for this touch sequence

// Capture phase on the STAGE, so this runs before onCanvasPointerDown (bound to the
// canvas, a descendant) and that handler can see the second finger has arrived.
export function onStageTouchDown(fc: FcCtx, e: PointerEvent): void {
  const { touchPts } = fc;
  if (e.pointerType === 'mouse') return;
  touchPts.set(e.pointerId, { x: e.clientX, y: e.clientY, moved: 0 });
  if (touchPts.size === 2) {
    fc.twoTapStart = e.timeStamp || Date.now();
    fc.twoTapDone = false;
  } else if (touchPts.size > 2) fc.twoTapStart = 0; // three fingers is not a tap
}
export function onStageTouchMove(fc: FcCtx, e: PointerEvent): void {
  const { TWO_TAP_SLOP, touchPts } = fc;
  const p = touchPts.get(e.pointerId);
  if (!p) return;
  p.moved = Math.max(p.moved, Math.hypot(e.clientX - p.x, e.clientY - p.y));
  if (p.moved > TWO_TAP_SLOP) fc.twoTapStart = 0; // a pan or a pinch, not a tap
}
export function onStageTouchUp(fc: FcCtx, e: PointerEvent): void {
  const { TWO_TAP_MS, TWO_TAP_SLOP, touchPts } = fc;
  if (e.pointerType === 'mouse') return;
  const pts = [...touchPts.values()];
  const when = e.timeStamp || Date.now();
  if (
    fc.twoTapStart &&
    !fc.twoTapDone &&
    pts.length === 2 &&
    when - fc.twoTapStart <= TWO_TAP_MS &&
    pts.every((p) => p.moved <= TWO_TAP_SLOP)
  ) {
    fc.twoTapDone = true; // the OTHER finger's up must not re-open it
    fc.twoTapStart = 0;
    if (fc.gesture) endGesture(fc); // neither finger commits a (zero-delta) drag
    fc.menus.contextMenuAt((pts[0]!.x + pts[1]!.x) / 2, (pts[0]!.y + pts[1]!.y) / 2, false);
  }
  touchPts.delete(e.pointerId);
  if (!touchPts.size) {
    fc.twoTapStart = 0;
    fc.twoTapDone = false;
  }
}
// Pen-DRAW placement and armed-CREATE, factored out so BOTH the in-frame handler
// (onCanvasPointerDown, bound to canvasEl) and the off-frame handler
// (onBackdropPointerDown, bound to the stage) share one implementation. The frame is
// canvasEl's own hit box, so without this a click on the empty stage OUTSIDE the frame
// never reaches the pen/create logic - you couldn't start a node or add an object off
// the artboard even though clientToNative maps such points fine and the gesture, once
// begun, already captures the pointer anywhere. Each returns true when it handled the
// event (the caller then stops propagation).
export function tryPenDrawAt(fc: FcCtx, e: PointerEvent, nat: Point): boolean {
  if (fc.mode !== 'pen') return false;
  const tol = fc.penTool.penTol();
  if (fc.penDraft && closesOnClick(fc.penDraft.nodes, nat.x, nat.y, tol)) {
    fc.penDraft = { ...fc.penDraft, closed: true };
    fc.penTool.penFinishDraw();
    return true;
  }
  let px = nat.x,
    py = nat.y;
  if (fc.gridOn && !e.altKey) {
    px = fc.stage.gridRound(px);
    py = fc.stage.gridRound(py);
  }
  const snap = snapPoint(
    px,
    py,
    otherAABBs(fc, fc.select.getBoxes(), new Set<number>()) as MathAABB[],
    fc.helpers.canvasWH(),
    snapThreshNative(fc),
    fc.authoringGuides?.snapTargets()
  );
  drawGuides(fc, snap.guides);
  fc.penTool.penPlaceNode(e, { x: snap.x, y: snap.y }, e.altKey);
  return true;
}
export function tryArmedCreateAt(fc: FcCtx, e: PointerEvent, nat: Point): boolean {
  const { rubber } = fc;
  if (!fc.armedKind) return false;
  // The sentence has been acted on - take it down at the START of the gesture, not at
  // its commit, or it sits over the rubber band describing something already happening.
  fc.stage.hideArmHint();
  beginGesture(fc, e, {
    type: 'create',
    origin: nat,
    seed: fc.armedKind.seed || {},
    others: otherAABBs(fc, fc.select.getBoxes(), new Set<number>()),
  });
  rubber.hidden = false;
  return true;
}
// Line tool press: start a line at the pressed point. The drag previews the rubber;
// release commits a two-node path box (see onGestureEnd). Snapped and grid-rounded the
// same way a pen node and a created box are, so a line ends up on the guides the rest of
// the editor draws. Alt opts out of both, exactly as it does for the pen.
export function tryLineDrawAt(fc: FcCtx, e: PointerEvent, nat: Point): boolean {
  const { cfg } = fc;
  if (fc.mode !== 'line' || !cfg.pathField) return false;
  const at = lineSnap(fc, nat, e.altKey);
  beginGesture(fc, e, { type: 'line', origin: at });
  fc.connectors.drawLineRubber(at, at);
  return true;
}
/** A line endpoint's landing spot: grid first (when the grid is on), then the smart
 *  guides, whose guide lines are drawn as a side effect - the same order tryPenDrawAt
 *  uses, so the two gestures agree about where "here" is. */
export function lineSnap(fc: FcCtx, nat: Point, alt: boolean): Point {
  let px = nat.x,
    py = nat.y;
  if (fc.gridOn && !alt) {
    px = fc.stage.gridRound(px);
    py = fc.stage.gridRound(py);
  }
  if (alt) {
    clearGuides(fc);
    return { x: px, y: py };
  }
  const snap = snapPoint(
    px,
    py,
    otherAABBs(fc, fc.select.getBoxes(), new Set<number>()) as MathAABB[],
    fc.helpers.canvasWH(),
    snapThreshNative(fc),
    fc.authoringGuides?.snapTargets()
  );
  drawGuides(fc, snap.guides);
  return { x: snap.x, y: snap.y };
}
export function onCanvasPointerDown(fc: FcCtx, e: PointerEvent): void {
  const { PEN_CURVE_PX, cfg, connectCfg, rubber, touchPts, vectorCfg } = fc;
  if (e.button > 0) return; // primary button / touch only
  fc.lastPointerKind = e.pointerType || '';
  // A second finger belongs to a stage gesture (pan / pinch / two-finger tap), never to
  // a box drag - and the first finger's gesture is abandoned so no drag commits.
  if (e.pointerType !== 'mouse' && touchPts.size > 1) {
    // A node the FIRST finger placed is retracted, not just abandoned: the create gesture
    // above commits nothing until release, but a pen node is already in the draft, and a
    // two-finger pan must not litter the shape being drawn with the point it started on.
    if (fc.gesture?.type === 'pendraw') {
      endGesture(fc);
      fc.penTool.penUndoNode();
      return;
    }
    if (fc.gesture) endGesture(fc);
    return;
  }
  if (fc.editing) {
    if (fc.editing.el.contains(e.target as Node)) return; // let the caret move within the text
    fc.textEdit.commitTextEdit(); // clicked elsewhere → commit, then select
  }
  fc.toolbox.closePopover();
  const nat = fc.stage.clientToNative(e.clientX, e.clientY);
  const boxes = fc.select.getBoxes();

  // Line tool: press starts a line (drag → release attaches to a card or floats free).
  if (tryLineDrawAt(fc, e, nat)) {
    e.stopPropagation();
    e.preventDefault();
    return;
  }

  // Pen - DRAWING. Click places a node; the drag that follows pulls its handles out
  // symmetrically; a click on the first node closes the path. Nothing about the box
  // selection model runs here, which is why Alt is free to mean "corner". Shared with
  // the off-frame handler so a path can be started/extended outside the artboard.
  if (tryPenDrawAt(fc, e, nat)) {
    e.stopPropagation();
    e.preventDefault();
    return;
  }

  // Pen - NODE EDITING. Handles first (smaller, and outside the curve), then nodes, then
  // the curve itself (a click on it inserts), and only then a marquee over the nodes.
  if (fc.penEdit) {
    const fr = fc.penEdit.frame;
    const loc = frameToLocal(fr, nat.x, nat.y);
    const tol = fc.penTool.penTol();
    const hh = fc.penTool.penHandleAt(loc.x, loc.y, tol);
    if (hh) {
      const key = `${hh.index}:${hh.which}`;
      // Shift/⌘-click a control point TOGGLES it into the point selection (for align /
      // distribute) rather than dragging it - the handle equivalent of shift-clicking a
      // node. A plain click drags it (a direct edit), and clears any point selection.
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        fc.penHandleSel.has(key) ? fc.penHandleSel.delete(key) : fc.penHandleSel.add(key);
        fc.ctxSelKey = null;
        fc.chromeSync.renderChrome();
        e.stopPropagation();
        e.preventDefault();
        return;
      }
      fc.penHandleSel = new Set<string>();
      fc.penTool.setPathSvgHidden(true);
      beginGesture(fc, e, { type: 'penhandle', origin: nat, index: hh.index, which: hh.which });
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    const ni = nodeAt(fc.penEdit.path, loc.x, loc.y, tol);
    if (ni >= 0) {
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        fc.penSel.has(ni) ? fc.penSel.delete(ni) : fc.penSel.add(ni);
      } else if (!fc.penSel.has(ni)) {
        fc.penSel = new Set([ni]);
        fc.penHandleSel = new Set<string>();
      }
      fc.penTool.setPathSvgHidden(true);
      const indices = fc.penSel.size ? [...fc.penSel] : [ni];
      beginGesture(fc, e, {
        type: 'pennode',
        origin: nat,
        indices,
        start: fc.penEdit.path.nodes.map((n) => ({ ...n })),
        // plan 96 P3: dragging exactly ONE of the path's two ends is the bind gesture.
        // Two nodes at once is a reshape, and an interior node has no end to attach.
        bindEnd: fc.penTool.bindEndFor(indices),
      });
      fc.ctxSelKey = null; // the continuity control reflects the new pick
      fc.chromeSync.renderChrome();
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    // Is the click on ANY contour's curve? Lower each on its own (lowering the combined run
    // as one path would draw - and hit - a phantom segment joining one glyph to the next),
    // and take the nearest across all. penInsertAt then reshapes whichever contour that was.
    const contours = fc.penTool.penContours();
    let hitD = Infinity;
    for (const p of contours) {
      const low = lowerAuthored(p, contours.length === 1 ? fc.penWarm : null);
      const h = low.cubics.length ? nearestOnPath(low.cubics, loc.x, loc.y) : null;
      if (h && h.distance < hitD) hitD = h.distance;
    }
    if (hitD <= PEN_CURVE_PX / fc.penTool.penScale()) {
      fc.penTool.penInsertAt(loc.x, loc.y);
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    beginGesture(fc, e, { type: 'penmarquee', origin: nat, additive: e.shiftKey || e.metaKey });
    rubber.hidden = false;
    e.stopPropagation();
    e.preventDefault();
    return;
  }

  if (tryArmedCreateAt(fc, e, nat)) {
    e.stopPropagation();
    e.preventDefault();
    return;
  }

  // Node tool: a click on a PATH box jumps straight into editing its nodes (the click
  // that would otherwise just select it). Non-path boxes fall through to normal select,
  // so the tool doesn't trap you on a shape it can't edit. Runs only when no node-edit
  // session is live (that case is handled by the penEdit block above).
  if (fc.nodeToolActive && vectorCfg && !fc.penEdit) {
    const nh = pickTopmost(boxes, nat.x, nat.y, cfg, fc.select.seqHiddenSkip(boxes));
    if (nh >= 0 && boxOutlineKind(boxes[nh], vectorCfg) === 'path') {
      fc.penTool.startPenEdit(fc.select.idOf(boxes[nh], nh));
      e.stopPropagation();
      e.preventDefault();
      return;
    }
  }

  const hit = fc.select.selectHit(boxes, nat.x, nat.y); // artboard-aware: a child over a frame wins; the frame takes an empty-area/edge click
  if (hit >= 0) {
    fc.edges.deselectEdge(); // picking a card drops any connector selection
    const id = fc.select.idOf(boxes[hit], hit);
    const additive = e.shiftKey || e.metaKey || e.ctrlKey || fc.multiTapMode;
    const hitSel = fc.select.selectionForHit(boxes, hit, e.altKey); // whole group, or Alt = just this box
    // A plain click on a box that is ALREADY in a multi-selection means "just this one"
    // (plan 179 C4) - but the same press is also the start of a drag of everything
    // selected, and narrowing here would make every group move impossible. So the
    // intention is recorded and settled at pointerup, once we know whether the pointer
    // moved. Nothing is narrowed when the click ends up on the only thing selected.
    let narrow: string[] | undefined;
    if (additive) {
      const anyIn = hitSel.some((x) => fc.selection.has(x));
      for (const x of hitSel) anyIn ? fc.selection.delete(x) : fc.selection.add(x);
    } else if (!fc.selection.has(id)) {
      fc.selection = new Set(hitSel);
    } else if (fc.selection.size > hitSel.length) {
      narrow = hitSel;
    }
    fc.chromeSync.renderChrome();
    // Start a move for the whole current selection.
    const start = new Map<number, Rect>();
    const sel = fc.select.selIndices(boxes);
    for (const i of sel) start.set(i, boxRect(boxes[i], cfg));
    beginGesture(fc, e, {
      type: 'move',
      start,
      sel,
      narrow,
      selAABB: selectionAABB(boxes, sel, cfg),
      others: otherAABBs(fc, boxes, new Set(sel)),
    });
    e.stopPropagation();
    return;
  }

  // No card under the pointer - try a connector line (they render behind the cards).
  if (connectCfg) {
    const eid = fc.edges.edgeAt(nat.x, nat.y);
    if (eid) {
      fc.edges.selectEdge(eid, e.shiftKey || e.metaKey || e.ctrlKey);
      e.stopPropagation();
      return;
    }
  }
  fc.edges.deselectEdge(); // clicked empty → drop any connector selection

  // Empty canvas - or the CAMERA's, when one is selected and running (plans/104 section 8).
  // The camera takes the drag the marquee would have had: there is nothing on the
  // empty stage for a marquee to catch that a camera user is reaching for, and
  // clicking any box hands the gesture straight back by ordinary selection.
  // SHIFT IS THE TILT (P2 - section 8 reserved the chord at M2.5 and this milestone spends
  // it). The additive marquee keeps shift everywhere else, including on this very
  // canvas the moment no camera is armed: `camModeId()` is a selection state the user
  // can see, so the chord is never quietly reassigned under them.
  if (e.pointerType === 'mouse' && fc.contextBar.camModeId()) {
    beginGesture(fc, e, {
      type: e.shiftKey ? 'camtilt' : 'campan',
      client: { x: e.clientX, y: e.clientY },
      dx: 0,
      dy: 0,
    });
    fc.stage.startCamHud(e.shiftKey);
    e.stopPropagation();
    return;
  }
  if (e.pointerType === 'mouse') {
    beginGesture(fc, e, { type: 'marquee', origin: nat, additive: e.shiftKey || e.metaKey });
    rubber.hidden = false;
    e.stopPropagation();
  } else {
    // Let stageNav own touch pan/pinch on empty canvas; arm a tap-to-deselect.
    fc.gesture = {
      type: 'tap',
      pointerId: e.pointerId,
      startClient: { x: e.clientX, y: e.clientY },
    };
  }
}
// Clicking the stage/view backdrop OUTSIDE the artboard deselects, just like clicking the
// empty canvas inside it (onCanvasPointerDown is bound to canvasEl, so those clicks never
// reached it). Guarded to a DIRECT hit on the backdrop element (target === currentTarget)
// so a bubbled event from a box, toolbar, popover or the canvas never triggers it. Doesn't
// stopPropagation, so stageNav's pan on a backdrop drag is unaffected.
export function onBackdropPointerDown(fc: FcCtx, e: PointerEvent): void {
  const { rubber } = fc;
  if (e.button > 0 || e.target !== e.currentTarget) return;
  if (fc.editing) fc.textEdit.commitTextEdit();
  // Off-frame click while DRAWING places/extends a node (not "finish"), and off-frame
  // click while an Add is armed starts the create - the same as inside the artboard, so
  // the whole stage is usable, not just the export frame. These come FIRST, before the
  // "clicking off the artboard means I'm done" fallbacks below.
  const natBd = fc.stage.clientToNative(e.clientX, e.clientY);
  if (tryPenDrawAt(fc, e, natBd)) {
    e.stopPropagation();
    e.preventDefault();
    return;
  }
  if (tryArmedCreateAt(fc, e, natBd)) {
    e.stopPropagation();
    e.preventDefault();
    return;
  }
  if (tryLineDrawAt(fc, e, natBd)) {
    e.stopPropagation();
    e.preventDefault();
    return;
  }
  // Clicking right off the artboard is the natural "I'm done" for a node-edit session,
  // and it matches what the same click already does to a selection. (A pen DRAFT is no
  // longer finished here - an off-frame click extends it, handled above.)
  if (fc.penEdit) {
    fc.penTool.endPenEdit();
    return;
  }
  fc.toolbox.closePopover();
  fc.edges.deselectEdge();
  // A SHIFT/⌘ drag is additive, so it must not wipe what is already selected - same
  // rule the in-artboard marquee follows.
  const additive = e.shiftKey || e.metaKey;
  if (fc.selection.size && !additive) fc.selection = new Set<string>();
  fc.chromeSync.renderChrome();
  // …and a plain left-drag out here MARQUEES, exactly as it does over the artboard.
  // Nothing claimed that gesture before: stageNav pans on middle-drag or Space+drag
  // and lets plain left-clicks through, while the marquee lived on canvasEl - so a
  // left-drag on the backdrop fell between the two and did nothing at all, which is
  // what made the whole area outside the artboard feel inert.
  // Touch is left alone: stageNav owns one-finger pan there, as it does inside.
  if (e.pointerType !== 'mouse' || fc.spacePan) return;
  // …and the CAMERA takes it first when one is armed (plans/104 section 8), exactly as it
  // does over the artboard: the backdrop is empty stage too, and a camera pan that
  // stopped at the artboard's edge would be a gesture with an invisible boundary.
  if (fc.contextBar.camModeId()) {
    beginGesture(fc, e, {
      type: e.shiftKey ? 'camtilt' : 'campan',
      client: { x: e.clientX, y: e.clientY },
      dx: 0,
      dy: 0,
    });
    fc.stage.startCamHud(e.shiftKey);
    return;
  }
  beginGesture(fc, e, { type: 'marquee', origin: fc.stage.clientToNative(e.clientX, e.clientY), additive });
  rubber.hidden = false;
  // The gesture captures the pointer on canvasEl, so the move/up handlers bound there
  // keep receiving it even though the drag started outside.
}
/** Right-click on the backdrop opens the SAME menu as right-click on empty artboard -
 *  guarded to a direct hit so a bubbled event from a box or the toolbar can't reach it. */
export function onBackdropContextMenu(fc: FcCtx, e: MouseEvent): void {
  if (e.target !== e.currentTarget) return;
  fc.menus.onContextMenu(e);
}
export function onSpaceKey(fc: FcCtx, e: KeyboardEvent): void {
  if (e.code === 'Space' && !isTypingTarget()) fc.spacePan = e.type === 'keydown';
}
export function onGestureMove(fc: FcCtx, e: PointerEvent): void {
  if (!fc.gesture || e.pointerId !== fc.gesture.pointerId) return;
  if (fc.gesture.type === 'tap') return; // stageNav owns it; only checked on up
  e.preventDefault(); // must be synchronous to suppress scroll/text-select
  fc.pendingMove = e;
  if (!fc.moveRaf) fc.moveRaf = requestAnimationFrame(fc.gestures.flushGestureMove);
}
export function flushGestureMove(fc: FcCtx): void {
  fc.moveRaf = 0;
  const e = fc.pendingMove;
  fc.pendingMove = null;
  if (e) applyGestureMove(fc, e);
}
export function applyGestureMove(fc: FcCtx, e: PointerEvent): void {
  const { CAM_TILT_DEG_PER_PX, PEN_PULL_MIN, cfg, minSize } = fc;
  if (!fc.gesture || e.pointerId !== fc.gesture.pointerId) return;
  const nat = fc.stage.clientToNative(e.clientX, e.clientY);
  const dxN =
    nat.x - (fc.gesture.origin?.x ?? fc.stage.clientToNative(fc.gesture.startClient.x, fc.gesture.startClient.y).x);
  const dyN =
    nat.y - (fc.gesture.origin?.y ?? fc.stage.clientToNative(fc.gesture.startClient.x, fc.gesture.startClient.y).y);

  if (fc.gesture.type === 'marquee' || fc.gesture.type === 'penmarquee') {
    drawRubber(fc, fc.gesture.origin, nat);
    return;
  }
  // CAMERA PAN (plans/104 section 8). Accumulate in NATIVE px and write nothing: the
  // projection is applied by the sequence DOM applier off the model, so the one
  // honest preview is the commit itself - which is why section 8's gesture law for the
  // camera is "drags commit on release", not "on move".
  //
  // Native, not client, because the model is native: `camX` is stage px, and the
  // picture it displaces is on screen at the canvas zoom. Accumulating client px and
  // writing them as model px made a 200 px drag move the shot 100 screen px at 50 %
  // zoom and 400 at 200 % - the picture sliding out from under the cursor, which is
  // the opposite of the direct manipulation the release handler promises and every
  // other drag here performs (`marquee`, `move`, `resize`, `pen` all convert first).
  if (fc.gesture.type === 'campan') {
    const prev = fc.stage.clientToNative(fc.gesture.client.x, fc.gesture.client.y);
    fc.gesture.dx += nat.x - prev.x;
    fc.gesture.dy += nat.y - prev.y;
    fc.gesture.client = { x: e.clientX, y: e.clientY };
    fc.stage.showCamPanHud(fc.gesture.dx, fc.gesture.dy);
    return;
  }
  // …and its shifted twin, in CLIENT px (see CamTiltGesture: an angle has no length
  // in stage space, so a zoom-relative gearing would be gearing by accident).
  if (fc.gesture.type === 'camtilt') {
    fc.gesture.dx += e.clientX - fc.gesture.client.x;
    fc.gesture.dy += e.clientY - fc.gesture.client.y;
    fc.gesture.client = { x: e.clientX, y: e.clientY };
    // The HUD shows the ABSOLUTE landing tilt, so it maps the drag to the same deltas
    // the release will (`rx = -dy·K`, `ry = dx·K`) and asks the panel to compose+clamp.
    fc.stage.showCamTiltHud(-fc.gesture.dy * CAM_TILT_DEG_PER_PX, fc.gesture.dx * CAM_TILT_DEG_PER_PX);
    return;
  }
  // Pen: pull the just-placed node's handles out, the universal click-and-drag idiom.
  // Symmetrically by default; Alt BREAKS the pair and steers only the outgoing arm, which
  // is the gesture tracing lives on - it is how a curve turns a corner into a new curve
  // without giving up the one already drawn. Alt with no drag still places a hard corner,
  // because the break only takes effect past `PEN_PULL_MIN`.
  if (fc.gesture.type === 'pendraw') {
    if (!fc.penDraft) return;
    const i = fc.gesture.index;
    const n = fc.penDraft.nodes[i];
    if (!n) return;
    const pulled =
      Math.hypot(nat.x - fc.gesture.origin.x, nat.y - fc.gesture.origin.y) > PEN_PULL_MIN / fc.penTool.penScale();
    // A click-DRAG is the Bézier idiom: it names a direction AND a length. `hyperbezier`
    // can only honour the direction, and only within a right angle of its chord - past
    // that `hbArm`'s signed shape function puts the control arm on the far side of the
    // node, so the curve leaves in the OPPOSITE direction to the drag, and approaching
    // 90° the arm collapses to zero so the drag stops mattering at all. That is
    // deliberate in the solver (see `hbArm`'s comment: clamping costs convergence), so
    // the fix belongs here: the first real pull promotes the draft to `cubic`, whose
    // lowering honours the handle exactly. The bake is lossless (see `convertKind`), so
    // the shape drawn so far does not move, and the kind pill flips to say what happened.
    if (fc.penDraft.kind === 'hyperbezier' && pulled) {
      fc.penDraft = convertKind(fc.penDraft, 'cubic', fc.penWarm).path;
      fc.penWarm = null;
      announce(t('Switched to Bezier handles - this curve kind honours the handle you drag.'));
      fc.chromeSync.renderChrome();
    }
    const nodes = fc.penDraft.nodes.slice();
    const cur = nodes[i] ?? n; // re-read: the promotion above rebuilds the node array
    const dx = nat.x - fc.gesture.origin.x,
      dy = nat.y - fc.gesture.origin.y;
    const at = { ...cur, x: fc.gesture.origin.x, y: fc.gesture.origin.y };
    // Whichever branch runs owns the node's continuity outright: `pullHandles` refuses a
    // `corner` node, and `defaultContinuity` is `'corner'` for every kind except
    // `hyperbezier` - so without this a click-drag in a `cubic` draft silently did nothing.
    // Breaking keeps `hIn` exactly where it is: on the first broken frame that is the arm
    // the bake left holding the segment already drawn, so "keep what is behind me, aim what
    // is ahead" needs no recomputation.
    if (e.altKey) fc.penPullBroken = true;
    nodes[i] = !pulled
      ? at
      : fc.penPullBroken
        ? { ...at, continuity: 'corner', hOutX: dx, hOutY: dy }
        : pullHandles({ ...at, continuity: 'smooth' }, dx, dy);
    fc.penDraft = { ...fc.penDraft, nodes };
    fc.penTool.paintPen();
    fc.penTool.positionPenChrome();
    return;
  }
  if (fc.gesture.type === 'pennode') {
    if (!fc.penEdit) return;
    // The pointer snaps against sibling boxes and the artboard exactly as a create/resize
    // drag does - same helper, same `.fc-guides` layer, Alt suppresses it - so a node can
    // be dropped on a neighbour's edge without a second snapping system existing.
    let sx = nat.x,
      sy = nat.y;
    if (!e.altKey) {
      if (fc.gridOn) {
        sx = fc.stage.gridRound(sx);
        sy = fc.stage.gridRound(sy);
      }
      const snap = snapPoint(
        sx,
        sy,
        otherAABBs(fc, fc.select.getBoxes(), new Set([fc.select.indexOfId(fc.select.getBoxes(), fc.penEdit.id)])) as MathAABB[],
        fc.helpers.canvasWH(),
        snapThreshNative(fc),
        fc.authoringGuides?.snapTargets()
      );
      sx = snap.x;
      sy = snap.y;
      drawGuides(fc, snap.guides);
    } else clearGuides(fc);
    const fr = fc.penEdit.frame;
    const a = frameToLocal(fr, fc.gesture.origin.x, fc.gesture.origin.y);
    const b = frameToLocal(fr, sx, sy);
    fc.gesture.moved = Math.hypot(sx - fc.gesture.origin.x, sy - fc.gesture.origin.y) > 0.01;
    fc.penEdit = {
      ...fc.penEdit,
      path: moveNodes(fc.penEdit.path, fc.gesture.indices, b.x - a.x, b.y - a.y, fc.gesture.start),
    };
    // plan 96 P3 - the bind affordance. The ring follows the pointer, not the node: the
    // node is under the finger and the box is what the drop acts on.
    if (fc.gesture.bindEnd) fc.penTool.setBindHover(fc.penTool.bindableAt(sx, sy, fc.penEdit.id));
    fc.penTool.paintPen();
    fc.penTool.positionPenChrome();
    return;
  }
  if (fc.gesture.type === 'penhandle') {
    if (!fc.penEdit) return;
    // No snapping: a handle is not an object edge, so an alignment guide would be a lie.
    // `dragHandle` re-applies the node's continuity on EVERY move, which is what
    // `enforceContinuity` exists for.
    const loc = frameToLocal(fc.penEdit.frame, nat.x, nat.y);
    fc.gesture.moved = true;
    fc.penEdit = {
      ...fc.penEdit,
      path: dragHandle(fc.penEdit.path, fc.gesture.index, fc.gesture.which, loc.x, loc.y),
    };
    fc.penTool.paintPen();
    fc.penTool.positionPenChrome();
    return;
  }
  if (fc.gesture.type === 'create') {
    let px = nat.x,
      py = nat.y;
    if (fc.gridOn && !e.altKey) {
      px = fc.stage.gridRound(px);
      py = fc.stage.gridRound(py);
    } // land on grid
    const snap = snapPoint(
      px,
      py,
      fc.gesture.others as MathAABB[],
      fc.helpers.canvasWH(),
      snapThreshNative(fc),
      fc.authoringGuides?.snapTargets()
    );
    const corner = { x: snap.x, y: snap.y };
    drawGuides(fc, snap.guides);
    fc.gesture.corner = corner;
    drawRubber(fc, fc.gesture.origin, corner);
    return;
  }
  if (fc.gesture.type === 'line') {
    const to = lineSnap(fc, nat, e.altKey);
    fc.gesture.to = to;
    fc.connectors.drawLineRubber(fc.gesture.origin, to);
    return;
  }
  if (fc.gesture.type === 'move') {
    let mdx = dxN,
      mdy = dyN;
    if (fc.gesture.selAABB && !e.altKey) {
      // Smart guides win: snap the RAW drag to any sibling/artboard edge or centre
      // first, so dragging a card onto another's vertical/horizontal line locks it
      // into alignment (even off-grid). The grid then only rounds whichever axis
      // did NOT catch a guide, so cards stay tidy without fighting alignment.
      const cand = {
        minX: fc.gesture.selAABB.minX + dxN,
        minY: fc.gesture.selAABB.minY + dyN,
        maxX: fc.gesture.selAABB.maxX + dxN,
        maxY: fc.gesture.selAABB.maxY + dyN,
      };
      const snap = snapMove(
        cand as MathAABB,
        fc.gesture.others as MathAABB[],
        fc.helpers.canvasWH(),
        snapThreshNative(fc),
        fc.authoringGuides?.snapTargets()
      );
      mdx = dxN + snap.dx;
      mdy = dyN + snap.dy;
      if (fc.gridOn) {
        // An angled guide constrains both coordinates; grid rounding either
        // coordinate afterwards would pull the object back off the line.
        const diagonal = snap.guides.some((g) => g.x1 !== g.x2 && g.y1 !== g.y2);
        const xAligned = diagonal || snap.guides.some((g) => g.x1 === g.x2);
        const yAligned = diagonal || snap.guides.some((g) => g.y1 === g.y2);
        if (!xAligned) mdx = fc.stage.gridRound(fc.gesture.selAABB.minX + dxN) - fc.gesture.selAABB.minX;
        if (!yAligned) mdy = fc.stage.gridRound(fc.gesture.selAABB.minY + dyN) - fc.gesture.selAABB.minY;
      }
      drawGuides(fc, snap.guides);
    } else clearGuides(fc);
    fc.gesture.moveDelta = { dx: mdx, dy: mdy };
    for (const [i, r] of fc.gesture.start) applyLiveRect(fc, i, { ...r, x: r.x + mdx, y: r.y + mdy });
    fc.chromeSync.renderChromeLive();
    fc.connectors.liveConnUpdate();
    return;
  }
  if (fc.gesture.type === 'resize') {
    let sdx = dxN,
      sdy = dyN;
    if ((fc.gesture.startRect.rot || 0) === 0 && !e.altKey) {
      let px = nat.x,
        py = nat.y;
      if (fc.gridOn) {
        px = fc.stage.gridRound(px);
        py = fc.stage.gridRound(py);
      }
      const snap = snapPoint(
        px,
        py,
        fc.gesture.others as MathAABB[],
        fc.helpers.canvasWH(),
        snapThreshNative(fc),
        fc.authoringGuides?.snapTargets()
      );
      sdx += snap.x - nat.x;
      sdy += snap.y - nat.y;
      drawGuides(fc, snap.guides);
    } else clearGuides(fc);
    // A circle stays a circle: lock its aspect (1:1) through the resize, as if Shift
    // were held. Its startRect is already square, so any handle keeps w === h.
    const nr = resizeRect(fc.gesture.startRect, fc.gesture.handle, sdx, sdy, {
      minSize,
      keepAspect: e.shiftKey || fc.fieldPanels.isCircle(fc.select.getBoxes()[fc.gesture.index]),
      fromCentre: e.altKey,
    });
    applyLiveRect(fc, fc.gesture.index, { ...nr, rot: fc.gesture.startRect.rot });
    fc.gesture.liveRect = { ...nr, rot: fc.gesture.startRect.rot };
    fc.chromeSync.renderChromeLive();
    fc.connectors.liveConnUpdate();
    return;
  }
  if (fc.gesture.type === 'rotate') {
    const c = fc.gesture.centerClient;
    let deg =
      (Math.atan2(e.clientY - c.y, e.clientX - c.x) * 180) / Math.PI -
      fc.gesture.pointerStartDeg +
      fc.gesture.startRect.rot!;
    deg = normAngle(deg); // keep stored rotation in [-180, 180)
    if (!e.altKey) deg = snapAngle(deg, 15, 4);
    const live = { ...fc.gesture.startRect, rot: deg };
    applyLiveRect(fc, fc.gesture.index, live);
    fc.gesture.liveRect = live;
    fc.chromeSync.renderChromeLive();
    return;
  }
  if (fc.gesture.type === 'gscale') {
    const k = Math.hypot(nat.x - fc.gesture.anchor.x, nat.y - fc.gesture.anchor.y) / fc.gesture.origDist;
    const next = scaleGroup(fc.gesture.startBoxes, fc.gesture.sel, fc.gesture.anchor, k, cfg, { minSize });
    for (const i of fc.gesture.sel) applyLiveRect(fc, i, boxRect(next[i], cfg));
    fc.gesture.liveBoxes = next;
    fc.chromeSync.renderChromeLive();
    fc.connectors.liveConnUpdate();
    return;
  }
  if (fc.gesture.type === 'grotate') {
    const c = fc.gesture.centerClient;
    let deg =
      (Math.atan2(e.clientY - c.y, e.clientX - c.x) * 180) / Math.PI - fc.gesture.pointerStartDeg;
    if (!e.altKey) deg = snapAngle(deg, 15, 4);
    const next = rotateGroup(fc.gesture.startBoxes, fc.gesture.sel, fc.gesture.centre, deg, cfg);
    for (const i of fc.gesture.sel) applyLiveRect(fc, i, boxRect(next[i], cfg));
    fc.gesture.liveBoxes = next;
    fc.chromeSync.renderChromeLive();
    fc.connectors.liveConnUpdate();
    return;
  }
}
export function onGestureEnd(fc: FcCtx, e: PointerEvent): void {
  const { CAM_TILT_DEG_PER_PX, canvasEl, cfg, frameCfg, minSize, timeCfg } = fc;
  if (!fc.gesture || e.pointerId !== fc.gesture.pointerId) return;
  const g = fc.gesture;
  // Apply any pending (coalesced) move first so the drop commits the final pointer
  // position, then drop the scheduled frame.
  if (fc.moveRaf) {
    cancelAnimationFrame(fc.moveRaf);
    fc.moveRaf = 0;
  }
  if (fc.pendingMove) {
    const pe = fc.pendingMove;
    fc.pendingMove = null;
    applyGestureMove(fc, pe);
  }
  try {
    canvasEl.releasePointerCapture(e.pointerId);
  } catch {
    /* ignore */
  }
  fc.connectors.endLiveConnectors(); // restore the tool's committed connector layer after a drag

  if (g.type === 'tap') {
    const moved = Math.hypot(e.clientX - g.startClient.x, e.clientY - g.startClient.y);
    if (moved < 6) {
      fc.selection = new Set<string>();
      fc.modes.toPointer();
      fc.chromeSync.renderChrome();
    }
    fc.gesture = null;
    return;
  }

  const nat = fc.stage.clientToNative(e.clientX, e.clientY);
  if (g.type === 'line') {
    const moved = Math.hypot(e.clientX - g.startClient.x, e.clientY - g.startClient.y);
    const to = g.to ?? lineSnap(fc, nat, e.altKey);
    endGesture(fc);
    fc.connectors.hideConnectLayer();
    clearGuides(fc);
    // A tap is a mis-click, and a zero-length line is not a shape: neither commits - the
    // same floor `penFinishDraw` puts under a one-node draft.
    if (moved < 6 || (Math.abs(to.x - g.origin.x) < 0.5 && Math.abs(to.y - g.origin.y) < 0.5)) {
      fc.modes.toPointer();
      return;
    }
    fc.penTool.commitPathBox(
      {
        kind: 'line',
        closed: false,
        nodes: [
          { x: g.origin.x, y: g.origin.y, continuity: 'corner' },
          { x: to.x, y: to.y, continuity: 'corner' },
        ],
      },
      fc.modes.lineBoxSeed()
    );
    fc.modes.toPointer();
    return;
  }
  const boxes = fc.select.getBoxes();

  // Pen: placing a node commits NOTHING - the draft is a draft until the path ends, which
  // is what makes the whole drawing one undo step (see `penFinishDraw`).
  if (g.type === 'pendraw') {
    endGesture(fc);
    fc.penCursor = nat;
    fc.penTool.paintPen();
    fc.penTool.syncPenChrome();
    fc.penTool.penCtxBar();
    return;
  }
  if (g.type === 'pennode' || g.type === 'penhandle') {
    const moved = g.moved === true;
    const next = fc.penEdit ? fc.penEdit.path : null;
    // plan 96 P3 - landing an end node ON a box attaches it; landing it anywhere else
    // detaches it. Read BEFORE endGesture(), which clears the hover.
    const bindTo =
      g.type === 'pennode' && g.bindEnd && moved
        ? { which: g.bindEnd, id: fc.bindHover ?? '' }
        : null;
    const editId = fc.penEdit?.id ?? '';
    fc.penTool.setPathSvgHidden(false);
    fc.penTool.setBindHover(null);
    endGesture(fc);
    if (moved && next) fc.penTool.penEditWrite(next);
    else fc.chromeSync.renderChrome();
    if (bindTo && editId) fc.penTool.applyBinding(editId, bindTo.which, bindTo.id);
    return;
  }
  if (g.type === 'penmarquee') {
    const moved = Math.hypot(e.clientX - g.startClient.x, e.clientY - g.startClient.y);
    if (fc.penEdit) {
      if (moved < 6) {
        if (!g.additive) {
          fc.penSel = new Set<number>();
          fc.penHandleSel = new Set<string>();
        }
      } else {
        const r = normDragRect(g.origin.x, g.origin.y, nat.x, nat.y, 0);
        const inR = (p: Point): boolean =>
          p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
        const pts = fc.penTool.penNodePoints();
        const nodeHits = pts.reduce<number[]>(
          (acc, pt, i) => (inR(pt.at) ? (acc.push(i), acc) : acc),
          []
        );
        // In "nodes + control points" mode, a marquee also grabs any handle whose point
        // falls in the box - the direct-selection behaviour Illustrator/Inkscape users
        // expect. Nodes-only mode (the default) leaves handles alone.
        const handleHits: string[] = [];
        if (fc.penSelectHandles && fc.penEdit && kindReadsHandles(fc.penEdit.path.kind)) {
          pts.forEach((pt, i) => {
            if (pt.hIn && inR(pt.hIn)) handleHits.push(`${i}:in`);
            if (pt.hOut && inR(pt.hOut)) handleHits.push(`${i}:out`);
          });
        }
        if (g.additive) {
          for (const i of nodeHits) fc.penSel.add(i);
          for (const k of handleHits) fc.penHandleSel.add(k);
        } else {
          fc.penSel = new Set(nodeHits);
          fc.penHandleSel = new Set(handleHits);
        }
      }
    }
    endGesture(fc);
    fc.ctxSelKey = null;
    fc.chromeSync.renderChrome();
    return;
  }

  if (g.type === 'create') {
    const moved = Math.hypot(e.clientX - g.startClient.x, e.clientY - g.startClient.y);
    // A circle seed must be born square (seedBox takes its geometry from the drawn
    // rect, not the seed's w/h), so a tap uses one default diameter and a drag squares
    // to its smaller side (anchored at the drag's top-left).
    const circleSeed = cfg.shapeField && String(g.seed?.[cfg.shapeField]) === 'circle';
    // A tap with the Artboard tool means "a page here" - size it to the export/page
    // dimensions, not the tiny generic default. Dragging still sizes it freely.
    const frameSeed = !!frameCfg && String(g.seed?.[cfg.kindField]) === frameCfg.frameKind;
    let rect: Rect;
    if (moved < 6) {
      // A tap (no drag) drops a default-sized box centred on the point.
      const cd = fc.helpers.canvasWH();
      const w = frameSeed ? cd.w : circleSeed ? 400 : 320;
      const h = frameSeed ? cd.h : circleSeed ? 400 : 200;
      rect = { x: g.origin.x - w / 2, y: g.origin.y - h / 2, w, h };
    } else {
      const c = g.corner || nat;
      rect = normDragRect(g.origin.x, g.origin.y, c.x, c.y, minSize);
      if (circleSeed) {
        const s = Math.max(minSize, Math.min(rect.w, rect.h));
        rect = { x: rect.x, y: rect.y, w: s, h: s };
      }
    }
    const id = fc.select.freshId(boxes);
    let box = seedBox(cfg, {}, g.seed, rect as MathRect, id);
    box = fc.document.clampToWorkArea(box);
    if (fc.gridOn && !e.altKey)
      box = {
        ...box,
        [cfg.xField]: fc.stage.gridRound(num(box[cfg.xField], 0)),
        [cfg.yField]: fc.stage.gridRound(num(box[cfg.yField], 0)),
      };
    fc.selection = new Set([id]);
    // The Animation and Video add-kinds both seed kind:'image' (they render through
    // the image field), so they also match wasImage - check them FIRST and open the
    // type-constrained picker instead of the general image one.
    const wasLottie = fc.armedKind?.id === 'lottie';
    const wasVideo = fc.armedKind?.id === 'video';
    // Sequence Studio's kinds. `clip` seeds kind:'image' too, so - like Animation and
    // Video - it must be recognised BEFORE wasImage or it would open the general image
    // picker. `tool` also seeds kind:'image', and it still opens the UNTYPED picker -
    // that is where the Lolly-link / saved-session path lives, and the picker is
    // already handed `editTool` so a chosen tool opens its inputs first - but it asks
    // for the Tools pane, so the tool grid is what the user ends up on. Same idea as the
    // typed kinds above: the pane matches the kind that was added.
    // `card` seeds kind:'box' and takes no asset at all - it is authored like text.
    // An add-kind id this switch doesn't know keeps its seed-derived behaviour.
    const wasClip = fc.armedKind?.id === 'clip';
    const wasAudio = fc.armedKind?.id === 'audio' || g.seed?.[cfg.kindField] === 'audio';
    const wasCard = fc.armedKind?.id === 'card';
    const wasTool = fc.armedKind?.id === 'tool';
    const wasCamera = fc.armedKind?.id === 'camera' || g.seed?.[cfg.kindField] === 'camera';
    const wasImage =
      !wasLottie &&
      !wasVideo &&
      !wasClip &&
      !wasAudio &&
      !wasTool &&
      (g.seed?.[cfg.kindField] === 'image' || fc.armedKind?.id === 'image');
    const wasText = g.seed?.[cfg.kindField] === 'text' || fc.armedKind?.id === 'text' || wasCard;
    // Read BEFORE toPointer(): exitCreate clears the pending time with the armed kind.
    const addAtMs = fc.pendingAddAtMs;
    fc.modes.toPointer(); // the gesture consumed the armed kind - back to the pointer
    endGesture(fc);
    // A card is authored like text, so it takes the same legibility pass.
    if (wasText) box = fc.select.withLegibleInk(box, boxes);
    // Containment-on-create: the new box ends up in whatever frame its centre falls in
    // (dead unless frameCfg). It is the last element of the array, so index boxes.length.
    // A DRAWN artboard also takes the next explicit page order (plans/179 A9), which is
    // why the commit reads the pair back rather than `boxes`: seeding a legacy doc's
    // order rewrites frame rows, and both halves belong in this one commit.
    const made = fc.document.withNewFrameOrder(boxes, box);
    fc.select.commit(fc.select.assignFrames([...made.boxes, made.box], new Set([made.boxes.length])));
    // Added from the timeline, so it arrives TIMED at the playhead instead of as scenery
    // (the rail's plus keeps that default). The panel's promote() owns the write - one
    // commit through moveOverlay + setDuration - so no timing arithmetic lives here.
    // `dur: null` is deliberate and load-shifting: this box was created a moment ago
    // and its asset picker has not even opened, so nothing on the canvas knows how long
    // its media is. Authoring a length HERE would pin a 45s audio track to 3s and would
    // overwrite the `card` kind's own seeded 2.5s. Unauthored, the seq pack derives it
    // from the media and an overlay runs to the sequence end - same as a canvas add.
    // (One exception, owned by promoteRows: at/after the sequence end - where the
    // playhead parks after a play-through, and where an untimed doc always is - an
    // open window would be EMPTY, so promote authors a real length there instead.)
    if (addAtMs != null) fc.timelinePanel?.promote(id, { start: addAtMs / 1000, dur: null });
    // A new timed box is only useful next to a timeline, so creating one opens it - and
    // a CAMERA needs the timeline up too, because camera mode (and with it the shift-drag
    // tilt / drag-pan gestures, plans/104 section 8) only arms while `cameraModeId()` sees an
    // OPEN timeline. Without this, adding a camera left the timeline shut and a shift-drag
    // fell through to the marquee - "tilt doesn't work" until you happened to open it.
    if (timeCfg && (wasClip || wasCard || wasAudio || wasCamera)) fc.timeline.openTimeline();
    if (wasLottie) setTimeout(() => fc.objects.pickImage({ pickType: 'lottie', initialTab: 'library' }), 0);
    else if (wasVideo || wasClip)
      setTimeout(() => fc.objects.pickImage({ pickType: 'video', initialTab: 'library' }), 0);
    else if (wasAudio)
      setTimeout(() => fc.objects.pickImage({ pickType: 'audio', initialTab: 'library' }), 0);
    else if (wasTool) setTimeout(() => fc.objects.pickImage({ initialTab: 'tools' }), 0);
    else if (wasImage) setTimeout(() => fc.objects.pickImage({ initialTab: 'library' }), 0);
    else if (wasText && cfg.textField) fc.textEdit.editAfterPaint(id, { selectAll: true });
    return;
  }
  if (g.type === 'campan') {
    const { dx, dy } = g;
    endGesture(fc);
    // ONE commit on release, and only when the shot actually moved. `cameraWrite`
    // resolves WHICH keyframe it ends up on (the latch, section 8) and returns the array
    // unchanged when there is nowhere honest to put it.
    //
    // NEGATED, because the content follows the hand: the projection subtracts camX
    // (`cx' = W/2 + (cx − camX − W/2)·eff`), so a camera moving right slides the
    // scene left. Dragging right has to move the picture right, which is the direct
    // manipulation every other drag in this canvas performs - and `dx`/`dy` arrive in
    // NATIVE px for the same reason (see CamPanGesture), so the shot keeps up with the
    // hand at every canvas zoom instead of only at 100 %.
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
      const next = fc.timelinePanel?.cameraWrite(boxes, { x: -dx, y: -dy });
      if (next && next !== boxes) fc.select.commit(next);
    }
    return;
  }
  if (g.type === 'camtilt') {
    const { dx, dy } = g;
    endGesture(fc);
    // DIRECT MANIPULATION, like every other drag here: you are turning the ARTWORK,
    // not aiming the lens. Drag DOWN and the near edge comes toward you at the bottom
    // of frame - which is `rx` NEGATIVE in the engine's convention (see
    // `surfaceMatrix`: negative Tilt X pitches the camera nose-down over the surface,
    // far edge receding to a horizon at the top). Drag RIGHT and the right-hand edge
    // comes nearer, which is `ry` positive. Aiming the lens instead would invert both
    // and put the horizon where the hand did not ask for it.
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
      const next = fc.timelinePanel?.cameraWrite(boxes, {
        rx: -dy * CAM_TILT_DEG_PER_PX,
        ry: dx * CAM_TILT_DEG_PER_PX,
      });
      if (next && next !== boxes) fc.select.commit(next);
    }
    return;
  }
  if (g.type === 'marquee') {
    const moved = Math.hypot(e.clientX - g.startClient.x, e.clientY - g.startClient.y);
    if (moved < 6) {
      fc.selection = new Set<string>();
      fc.edges.deselectEdge();
    } else {
      // A marquee grabs cards AND any connector lines it crosses - a mixed selection
      // (card handles + the connector panel editing every selected line at once).
      const rect = normDragRect(g.origin.x, g.origin.y, nat.x, nat.y, 0);
      // plans/179 A13: an ARTBOARD joins the selection only when the band encloses it
      // whole (Figma's rule). Rubber-banding over two cards used to grab the page they
      // sit on as well, so the next Fill recoloured the slide and Delete removed it.
      // Children keep the ordinary "touched by the band" rule.
      const raw = pickMarquee(boxes, rect, cfg, fc.select.seqHiddenSkip(boxes));
      const kept = frameCfg
        ? filterMarqueeFrames(boxes, raw, rect, { ...cfg, frameKind: frameCfg.frameKind })
        : raw;
      const hits = kept.map((i: number) => fc.select.idOf(boxes[i], i));
      const edgeHits = fc.edges.edgesInRect(rect);
      if (g.additive) {
        for (const id of hits) fc.selection.add(id);
        for (const id of edgeHits) fc.selectedEdges.add(id);
      } else {
        fc.selection = new Set(hits);
        fc.selectedEdges = new Set(edgeHits);
      }
      if (fc.selectedEdges.size) fc.edges.setHoverEdge(null);
    }
    endGesture(fc);
    fc.chromeSync.renderChrome(); // card chrome + edge highlights (via renderChrome)
    if (fc.selectedEdges.size) fc.edges.openEdgePanel();
    else fc.edges.closeEdgePanel();
    return;
  }
  if (g.type === 'move') {
    const d = g.moveDelta || { dx: 0, dy: 0 };
    const sel = g.sel;
    const narrow = g.narrow;
    endGesture(fc);
    if (Math.abs(d.dx) > 0.5 || Math.abs(d.dy) > 0.5) {
      // PLAYHEAD-CONTEXTUAL WRITES (plans/104 section 8). The gesture is untouched - the
      // preview path never knew about this and still does not - and the redirection
      // happens HERE, at the one commit, which is what keeps a keyframed drag one
      // undo step exactly like an ordinary one.
      //
      // A MIXED selection is split rather than refused: the boxes parked on a
      // keyframe are posed, the rest are moved, and both halves compose into ONE
      // array committed once. Refusing the whole gesture because one box in five is
      // not animated would make the feature feel like a mode, which is the thing
      // this model exists to avoid.
      const kfIds = new Set(
        fc.timelinePanel?.kfPoseIds([...sel].map((i) => fc.select.idOf(boxes[i], i))) ?? []
      );
      const moveIdx = [...sel].filter((i) => !kfIds.has(fc.select.idOf(boxes[i], i)));
      let next = moveIdx.length ? moveBoxes(boxes, moveIdx, d.dx, d.dy, cfg) : boxes;
      if (kfIds.size && fc.timelinePanel)
        next = fc.timelinePanel.kfPoseWrite(next, [...kfIds], { x: d.dx, y: d.dy });
      // Containment-on-drop: the moved boxes re-bucket into the frame their centre
      // now ends up in. moveBoxes preserves index order, so g.sel indices stay valid -
      // and only the boxes that actually MOVED are re-bucketed: a posed box's own
      // geometry never changed, so it cannot have crossed a frame edge.
      fc.select.commit(fc.select.assignFrames(fc.select.cascadeFrameChildren(boxes, next, moveIdx), new Set(moveIdx)));
    } else {
      // The press never became a drag, so honour the click's own meaning: narrow the
      // multi-selection to the box that was clicked (plan 179 C4). `ctxSelKey` is reset
      // because the object bar's controls are gated by what is selected, and the bar
      // must not survive a selection it no longer describes.
      if (narrow?.length) {
        fc.selection = new Set(narrow);
        fc.ctxSelKey = null;
      }
      fc.chromeSync.renderChrome();
    }
    return;
  }
  if (g.type === 'resize' || g.type === 'rotate') {
    const live = g.liveRect || g.startRect;
    const idx = g.index;
    const rotId = fc.select.idOf(boxes[idx], idx);
    // BOTH gestures are pose channels now. Rotate always was (`r`); RESIZE became one
    // at P1 (plans/104 section 5.2, REVERSED - Andy, 2026-08-12 hands-on: "I can't change
    // width and height of elements and have them tween"), so a resize ON a diamond
    // writes `w`/`h` and a resize anywhere else still writes the box itself.
    //
    // The two channels compose differently and the difference is not cosmetic: `w`/`h`
    // are ABSOLUTE px that replace the box's own size for their segment, so they are
    // written with 'set' - a dragged handle produces the new WIDTH, not a change to it
    // - while the origin shift an nw/n/w handle also produces is a `x`/`y` DELTA and
    // is written with 'add', because those channels are offsets from the authored
    // position. Two folds over one array, one commit, one undo step.
    //
    // ZERO DELTA IS NOT A POSE. `liveRect` is only ever assigned in pointermove, so a
    // press-and-release on a handle leaves `live === g.startRect` and every delta
    // exactly 0 - and a redirected write of `{ r: 0 }` is not a no-op: `kfActiveChannels`
    // ADDS `r` to the box's channel set, so on a track that does not already animate
    // rotation (a URL-authored `t0_x0*t1000_x40`, or one built from the inspector's
    // z/s/o/b fields) a click on the handle rewrites the wire and spends an undo step on
    // a gesture that moved nothing. The move branch above is guarded for the same reason
    // (0.5px there); below the tolerance this falls through to the base write, which is
    // the identical no-op an unkeyframed box already gets - the two stay in step.
    const dr = g.type === 'rotate' ? num(live.rot, 0) - num(g.startRect.rot, 0) : 0;
    const dw = num(live.w, 0) - num(g.startRect.w, 0);
    const dh = num(live.h, 0) - num(g.startRect.h, 0);
    const onDiamond = (fc.timelinePanel?.kfPoseIds([rotId]).length ?? 0) > 0;
    const rotKf = g.type === 'rotate' && Math.abs(dr) > 0.01 && onDiamond;
    const sizeKf = g.type === 'resize' && (Math.abs(dw) > 0.5 || Math.abs(dh) > 0.5) && onDiamond;
    endGesture(fc);
    if (rotKf && fc.timelinePanel) {
      fc.select.commit(fc.timelinePanel.kfPoseWrite(boxes, [rotId], { r: dr }));
      return;
    }
    if (sizeKf && fc.timelinePanel) {
      let next = fc.timelinePanel.kfPoseWrite(boxes, [rotId], { w: live.w, h: live.h }, 'set');
      // An nw/n/w handle moves the ORIGIN as well as the size. Without this the box
      // would grow from its top-left in the preview (which is what the fold does with
      // `w`/`h` alone) while the handle the user is holding says it grew from the
      // opposite corner.
      const dx = num(live.x, 0) - num(g.startRect.x, 0);
      const dy = num(live.y, 0) - num(g.startRect.y, 0);
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        next = fc.timelinePanel.kfPoseWrite(next, [rotId], { x: dx, y: dy });
      }
      fc.select.commit(next);
      return;
    }
    // Containment-on-resize: a resize/rotate can move the box's centre across a frame
    // edge, so re-bucket the single edited box. An nw/n/w handle on a FRAME moves its
    // origin too - cascade members with it (Figma semantics: children keep their
    // frame-local position), exactly like the move and group-transform commits.
    const resized = boxes.map((b, i) => (i === idx ? withRect(b, live, cfg) : b));
    fc.select.commit(fc.select.assignFrames(fc.select.cascadeFrameChildren(boxes, resized, [idx]), new Set([idx])));
    return;
  }
  if (g.type === 'gscale' || g.type === 'grotate') {
    const next = g.liveBoxes;
    const sel = g.sel;
    endGesture(fc);
    // Containment-on-group-transform: every scaled/rotated box re-buckets. g.liveBoxes
    // is a full index-aligned array, so g.sel indices stay valid.
    if (next) fc.select.commit(fc.select.assignFrames(fc.select.cascadeFrameChildren(boxes, next, sel), new Set(sel)));
    else fc.chromeSync.renderChrome();
    return;
  }
  endGesture(fc);
}
// Apply a rect to a live box DOM element during a gesture (no model write).
export function applyLiveRect(fc: FcCtx, index: number, r: Rect): void {
  const { frameCfg, pages } = fc;
  const boxes = fc.select.getBoxes();
  const id = fc.select.idOf(boxes[index], index);
  const el = fc.stage.liveBoxEl(id);
  if (!el) return;
  // r is in GLOBAL native coords; the element positions relative to its page frame.
  const fo = fc.stage.frameOffsetOfEl(el);
  el.style.left = Math.round(r.x - fo.x) + 'px';
  el.style.top = Math.round(r.y - fo.y) + 'px';
  el.style.width = Math.max(1, Math.round(r.w)) + 'px';
  el.style.height = Math.max(1, Math.round(r.h)) + 'px';
  el.style.transform = r.rot ? `rotate(${Math.round(r.rot * 10) / 10}deg)` : '';
  // Multi-page: a box dragged toward a higher-index page spills (unclipped) into that
  // page's rectangle, but the later frame's opaque background paints OVER it (same
  // stacking context, tree order). A positive z-index hoists the live box above every
  // later frame for the duration of the drag; endGesture clears it (and the next paint
  // rebuilds the element clean). No-op for single-page editors (Design).
  if (pages || frameCfg) el.style.zIndex = '9999';
}
export function drawRubber(fc: FcCtx, origin: Point, nat: Point): void {
  const { rubber } = fc;
  const a = fc.stage.nativeToStage(Math.min(origin.x, nat.x), Math.min(origin.y, nat.y));
  const { scale } = fc.stage.metrics();
  rubber.style.left = a.x + 'px';
  rubber.style.top = a.y + 'px';
  rubber.style.width = Math.abs(nat.x - origin.x) * scale + 'px';
  rubber.style.height = Math.abs(nat.y - origin.y) * scale + 'px';
}
// ── handle interactions ──────────────────────────────────────────────────────
export function onHandlePointerDown(fc: FcCtx, e: PointerEvent, handle: HandleName | 'rotate'): void {
  const { cfg } = fc;
  e.stopPropagation();
  if (e.button > 0) return;
  const boxes = fc.select.getBoxes();
  const idx = fc.select.selIndices(boxes);
  if (idx.length !== 1) return;
  const index = idx[0]!;
  const startRect = boxRect(boxes[index], cfg);
  if (handle === 'rotate') {
    const m = fc.stage.metrics();
    const c = rectCentre(startRect);
    const cs = fc.stage.nativeToStage(c.x, c.y, m);
    const centerClient = { x: cs.x + m.sr.left, y: cs.y + m.sr.top };
    const pointerStartDeg =
      (Math.atan2(e.clientY - centerClient.y, e.clientX - centerClient.x) * 180) / Math.PI;
    beginGesture(fc, e, { type: 'rotate', index, startRect, centerClient, pointerStartDeg });
  } else {
    beginGesture(fc, e, {
      type: 'resize',
      index,
      handle,
      startRect,
      others: otherAABBs(fc, boxes, new Set([index])),
    });
  }
}
// AABBs of every box NOT in `exclude` (snap targets), + the snap threshold in
// native px (a fixed SCREEN distance regardless of zoom).
export function otherAABBs(fc: FcCtx, boxes: Box[], exclude: Set<number>): AABB[] {
  const { cfg, frameCfg } = fc;
  const out: AABB[] = [];
  // A HIDDEN layer (plans/179 M4) is not drawn, so it must not pull a guide either: a
  // drag snapping to an edge nobody can see reads as the canvas fighting back. A LOCKED
  // one still snaps - it is on screen, and "can't be moved" is not "isn't there".
  const hideF = frameCfg?.hiddenField;
  for (let i = 0; i < boxes.length; i++) {
    if (exclude.has(i)) continue;
    if (hideF && boolOf(boxes[i]?.[hideF], false)) continue;
    out.push(boxAABB(boxes[i], cfg));
  }
  return out;
}
export const snapThreshNative = (fc: FcCtx): number => SNAP_PX / (fc.stage.metrics().scale || 1);
export function drawGuides(fc: FcCtx, list: any[] | null | undefined): void {
  const { guidesEl } = fc;
  guidesEl.innerHTML = '';
  if (!list?.length) return;
  const m = fc.stage.metrics();
  for (const g of list) {
    const a = fc.stage.nativeToStage(g.x1, g.y1, m),
      b = fc.stage.nativeToStage(g.x2, g.y2, m);
    const el = document.createElement('div');
    el.className = 'fc-guide';
    el.style.left = a.x + 'px';
    el.style.top = a.y + 'px';
    el.style.width = Math.hypot(b.x - a.x, b.y - a.y) + 'px';
    el.style.transform = `rotate(${(Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI}deg)`;
    guidesEl.appendChild(el);
  }
}
export const clearGuides = (fc: FcCtx): void => {
  const { guidesEl } = fc;
  guidesEl.innerHTML = '';
};
export function gesturesOps(fc: FcCtx) {
  return {
    beginGesture: bindOp(fc, beginGesture),
    endGesture: bindOp(fc, endGesture),
    onDblClick: bindOp(fc, onDblClick),
    onStageTouchDown: bindOp(fc, onStageTouchDown),
    onStageTouchMove: bindOp(fc, onStageTouchMove),
    onStageTouchUp: bindOp(fc, onStageTouchUp),
    tryPenDrawAt: bindOp(fc, tryPenDrawAt),
    tryArmedCreateAt: bindOp(fc, tryArmedCreateAt),
    tryLineDrawAt: bindOp(fc, tryLineDrawAt),
    lineSnap: bindOp(fc, lineSnap),
    onCanvasPointerDown: bindOp(fc, onCanvasPointerDown),
    onBackdropPointerDown: bindOp(fc, onBackdropPointerDown),
    onBackdropContextMenu: bindOp(fc, onBackdropContextMenu),
    onSpaceKey: bindOp(fc, onSpaceKey),
    onGestureMove: bindOp(fc, onGestureMove),
    flushGestureMove: bindOp(fc, flushGestureMove),
    applyGestureMove: bindOp(fc, applyGestureMove),
    onGestureEnd: bindOp(fc, onGestureEnd),
    applyLiveRect: bindOp(fc, applyLiveRect),
    drawRubber: bindOp(fc, drawRubber),
    onHandlePointerDown: bindOp(fc, onHandlePointerDown),
    otherAABBs: bindOp(fc, otherAABBs),
    snapThreshNative: bindOp(fc, snapThreshNative),
    drawGuides: bindOp(fc, drawGuides),
    clearGuides: bindOp(fc, clearGuides),
  };
}
