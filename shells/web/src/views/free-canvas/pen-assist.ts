// SPDX-License-Identifier: MPL-2.0
/**
 * free-canvas: the pen's assists - Shift's 15 degree steps, snapping a node to the other
 * nodes of its own path, carrying on from an open end of an existing path, and retracting
 * selected handles.
 *
 * Each assist is a decision about a point that the gesture code asks for and then uses as
 * it always did, so the press, drag and release paths in gestures.ts keep one shape. The
 * arithmetic lives in ../free-canvas-pen-ops.ts, which is pure and tested on its own.
 *
 * Shift already meant two things in node editing and both are kept: Shift-click on a node
 * or a handle adds it to the point selection, and Shift on a marquee adds to what is
 * selected. The angle step therefore reads Shift DURING a drag, which a press that toggles
 * a handle never starts, and modifier changes mid-drag are replayed at once (see
 * `REAPPLY_TYPES` in gestures.ts).
 */
import { snapPoint } from '../free-canvas-math.ts';
import type { AABB as MathAABB, Box } from '../free-canvas-math.ts';
import { boxOutlineKind } from '../vector-ops.ts';
import type { AuthoredPath } from '@lolly/engine';
import { decodePathContours, denormNodes, encodePathField, localToFrame, penCommitFromNative, penFrame } from '../free-canvas-pen.ts';
import { angleNeighbour, constrainAngle, pathToNative, resumableEnd, retractHandles, reversePath, withNodeLines } from '../free-canvas-pen-ops.ts';
import { announce } from '../../a11y.ts';
import { t } from '../../i18n.ts';
import { boolOf } from './shared.ts';
import type { PenNodeGesture, Point } from './shared.ts';
import { bindOp, type FcCtx } from './context.ts';

type Mods = { shiftKey: boolean; altKey: boolean };

/** Grid, then the smart guides plus `nodes` as extra lines, drawing the guides that caught.
 *  The same order every other placement uses, so a node and a box agree on where "here" is. */
function snapWithNodes(fc: FcCtx, at: Point, alt: boolean, nodes: readonly Point[], exclude: Set<number>): Point {
  let px = at.x, py = at.y;
  if (fc.gridOn && !alt) {
    px = fc.stage.gridRound(px);
    py = fc.stage.gridRound(py);
  }
  const snap = snapPoint(
    px,
    py,
    fc.gestures.otherAABBs(fc.select.getBoxes(), exclude) as MathAABB[],
    fc.helpers.canvasWH(),
    fc.gestures.snapThreshNative(),
    withNodeLines(fc.authoringGuides?.snapTargets(), nodes)
  );
  fc.gestures.drawGuides(snap.guides);
  return { x: snap.x, y: snap.y };
}

/** Where a pen press puts its node while drawing. Shift holds the new segment to 15 degree
 *  steps from the node before it, and wins over snapping, since a guide would pull the node
 *  off the angle that was asked for. Otherwise the node snaps to the canvas and to every
 *  node already in the draft. */
export function drawPoint(fc: FcCtx, e: Mods, nat: Point): Point {
  const nodes = fc.penDraft?.nodes ?? [];
  const last = nodes[nodes.length - 1];
  if (e.shiftKey && last) {
    fc.gestures.clearGuides();
    return constrainAngle(last, nat);
  }
  return snapWithNodes(fc, nat, e.altKey, nodes, new Set<number>());
}

/** The live end of the segment under the cursor while drawing: stepped under Shift, so the
 *  preview shows the segment the next click will place. */
export function cursorPoint(fc: FcCtx, nat: Point, shift: boolean): Point {
  const nodes = fc.penDraft?.nodes ?? [];
  const last = nodes[nodes.length - 1];
  return shift && last ? constrainAngle(last, nat) : nat;
}

/** A handle pulled out while drawing, as an offset from its node, stepped under Shift. */
export function pullOffset(_fc: FcCtx, dx: number, dy: number, shift: boolean): Point {
  return shift ? constrainAngle({ x: 0, y: 0 }, { x: dx, y: dy }) : { x: dx, y: dy };
}

/**
 * Where a node drag puts the pointer, in native px, for the drag code to turn into a delta.
 *
 * The pressed node is what snaps and what steps, not the pointer: a press can be as far as
 * the hit tolerance from the node, and snapping the pointer would leave the node that far
 * off the guide it appears to sit on. Shift steps the angle from the nearest still
 * neighbour on the same contour (`angleNeighbour`), or the drag direction itself when every
 * neighbour is moving too. Alt turns snapping off, as it does for a box.
 */
export function nodeDragPoint(fc: FcCtx, g: PenNodeGesture, nat: Point, e: Mods): Point {
  const edit = fc.penEdit;
  const anchor = g.anchor ?? g.indices[0] ?? -1;
  const startNode = g.start[anchor];
  if (!edit || !startNode) return nat;
  const fr = edit.frame;
  const from = localToFrame(fr, startNode.x, startNode.y);
  const want = { x: from.x + nat.x - g.origin.x, y: from.y + nat.y - g.origin.y };
  let got: Point;
  if (e.shiftKey) {
    fc.gestures.clearGuides();
    const nb = angleNeighbour(edit.parts, anchor, new Set(g.indices));
    const ref = nb >= 0 && g.start[nb] ? localToFrame(fr, g.start[nb]!.x, g.start[nb]!.y) : from;
    got = constrainAngle(ref, want);
  } else if (e.altKey) {
    fc.gestures.clearGuides();
    got = want;
  } else {
    const moving = new Set(g.indices);
    const still = g.start.filter((_, k) => !moving.has(k)).map((n) => localToFrame(fr, n.x, n.y));
    const self = new Set([fc.select.indexOfId(fc.select.getBoxes(), edit.id)]);
    got = snapWithNodes(fc, want, false, still, self);
  }
  return { x: g.origin.x + got.x - from.x, y: g.origin.y + got.y - from.y };
}

/** Where a handle drag puts the handle, in native px: stepped from its own node under
 *  Shift, and otherwise exactly under the pointer (a handle does not snap). */
export function handleDragPoint(fc: FcCtx, index: number, nat: Point, shift: boolean): Point {
  const node = fc.penEdit?.path.nodes[index];
  if (!shift || !fc.penEdit || !node) return nat;
  return constrainAngle(localToFrame(fc.penEdit.frame, node.x, node.y), nat);
}

// ── carry on from an open end ─────────────────────────────────────────────────

/** Hide or show one path box's own rendered `<svg>` while its path is redrawn on the pen
 *  layer, as `setPathSvgHidden` does for node editing. */
function setBoxPathHidden(fc: FcCtx, id: string, hidden: boolean): void {
  const el = fc.canvasEl.querySelector<HTMLElement>(
    `.lolly-box[data-box-id="${fc.keys.cssEscape(id)}"] .lolly-box-path`
  );
  if (el) el.style.visibility = hidden ? 'hidden' : '';
}

/**
 * The open path whose END is under a pen press, topmost first, placed in native px. Only
 * a plain single-contour path qualifies: a connector is routed by the engine from its
 * bindings, a painted vector or a text guide stores its shape elsewhere, and a flipped box
 * is drawn mirrored from what its nodes say, so carrying any of them on from the stored
 * nodes would draw somewhere other than where the user pressed.
 */
function resumeTarget(fc: FcCtx, nat: Point): { id: string; from: 'start' | 'end'; native: AuthoredPath } | null {
  const { cfg, vectorCfg } = fc;
  if (!vectorCfg) return null;
  const boxes = fc.select.getBoxes();
  const skip = fc.select.seqHiddenSkip(boxes);
  const tol = fc.penTool.penTol();
  const flipped = (b: Box): boolean => fc.canFlip && (boolOf(b[fc.FLIP_H_FIELD], false) || boolOf(b[fc.FLIP_V_FIELD], false));
  for (let i = boxes.length - 1; i >= 0; i--) {
    const b = boxes[i];
    if (!b || skip?.(i) || boxOutlineKind(b, vectorCfg) !== 'path' || b.pathPaint || flipped(b) || fc.connectors.isBoundPath(b)) continue;
    const id = fc.select.idOf(b, i);
    if (fc.storyText.available() && fc.storyPath.frame(id)?.path) continue;
    const contours = decodePathContours(b[cfg.pathField]);
    if (contours.length !== 1) continue;
    const frame = penFrame(b, cfg);
    const native = pathToNative(denormNodes(contours[0]!, frame.w, frame.h), frame);
    const from = resumableEnd(native, nat.x, nat.y, tol);
    if (from) return { id, from, native };
  }
  return null;
}

/**
 * A pen press on an open end of an existing path, with nothing being drawn yet, carries
 * that path on: it becomes the draft, oriented so the pressed end is the LAST node (a path
 * resumed from its start is reversed now and reversed back at the commit, which puts the
 * new nodes in front of the old first node). From there it is ordinary drawing: each click
 * adds a node, Backspace drops the last one, a click on the far end closes the shape, and
 * the press itself starts the usual pull, so a drag aims the end's outgoing handle without
 * moving the curve already there.
 */
export function tryResume(fc: FcCtx, e: PointerEvent, nat: Point): boolean {
  if (fc.penDraft || fc.textPathDrawing || !fc.cfg.pathField) return false;
  const hit = resumeTarget(fc, nat);
  if (!hit) return false;
  const draft = hit.from === 'start' ? reversePath(hit.native) : hit.native;
  fc.penDraft = draft;
  fc.penContinuing = { id: hit.id, from: hit.from, start: draft };
  fc.penCursor = null;
  fc.penWarm = null;
  fc.penPullBroken = true; // a pull here aims only the new segment, never the old one
  setBoxPathHidden(fc, hit.id, true);
  const end = draft.nodes[draft.nodes.length - 1]!;
  fc.gestures.beginGesture(e, { type: 'pendraw', origin: { x: end.x, y: end.y }, index: draft.nodes.length - 1 });
  fc.penTool.paintPen();
  fc.penTool.syncPenChrome();
  announce(t('Carrying on this path. Click to add points, Enter to finish, Esc to leave it as it was.'));
  return true;
}

/** How many nodes the continued path started with, or 0 when nothing is being continued.
 *  Backspace never drops below this: those nodes belong to a box already in the model. */
export function resumeBase(fc: FcCtx): number {
  return fc.penContinuing ? fc.penContinuing.start.nodes.length : 0;
}

/** Forget a continuation without writing anything; the box was never touched. */
export function cancelResume(fc: FcCtx): void {
  const cont = fc.penContinuing;
  if (!cont) return;
  fc.penContinuing = null;
  setBoxPathHidden(fc, cont.id, false);
}

/**
 * Commit a continued draft back onto ITS box: one write, so one undo puts the path back as
 * it was. The box keeps its id, paint, heads and every other field; only the path and the
 * frame change, and the frame comes out unrotated because the draft was drawn in native px.
 * A draft that changed nothing writes nothing. If the box has gone meanwhile (an undo
 * mid-draw), the drawing is kept as a new path rather than thrown away.
 *
 * Returns false when no continuation was live, for the caller to commit as usual.
 */
export function finishResume(fc: FcCtx, draft: AuthoredPath): boolean {
  const cont = fc.penContinuing;
  if (!cont) return false;
  cancelResume(fc);
  if (JSON.stringify(draft) === JSON.stringify(cont.start)) {
    fc.chromeSync.renderChrome();
    return true;
  }
  const path = cont.from === 'start' ? reversePath(draft) : draft;
  const { cfg } = fc;
  const boxes = fc.select.getBoxes();
  const i = fc.select.indexOfId(boxes, cont.id);
  if (i < 0) {
    if (!fc.penTool.commitPathBox(path)) fc.chromeSync.renderChrome();
    return true;
  }
  const made = penCommitFromNative(path);
  const value = made ? encodePathField(made.path) : '';
  if (!made || !value) {
    fc.stage.flash(t('That edit could not be saved, so nothing was changed.'));
    fc.chromeSync.renderChrome();
    return true;
  }
  const next: Box = {
    ...boxes[i],
    [cfg.pathField]: value,
    [cfg.xField]: made.x,
    [cfg.yField]: made.y,
    [cfg.wField]: made.w,
    [cfg.hField]: made.h,
  };
  if (cfg.rotationField) next[cfg.rotationField] = 0;
  fc.selection = new Set([cont.id]);
  fc.select.commit(boxes.map((b, k) => (k === i ? next : b)));
  return true;
}

// ── retract handles ───────────────────────────────────────────────────────────

/**
 * Backspace or Delete with control points selected and no nodes: pull those handles back
 * onto their nodes, which makes that side of each node a corner. One write, one undo step.
 * With nodes selected the key deletes nodes as before, so this only runs when the
 * selection is handles alone. Returns false when there was nothing to retract.
 */
export function retractSelectedHandles(fc: FcCtx): boolean {
  if (!fc.penEdit || fc.penSel.size || !fc.penHandleSel.size) return false;
  const { path, changed } = retractHandles(fc.penEdit.path, fc.penHandleSel);
  if (!changed) return false;
  fc.penWarm = null;
  fc.penHandleSel = new Set<string>();
  fc.penTool.penEditWrite(path);
  announce(changed === 1
    ? t('Handle removed. That side of the point is a corner now.')
    : t('{n} handles removed. Those points are corners now.', { n: changed }));
  return true;
}

export function penAssistOps(fc: FcCtx) {
  return {
    drawPoint: bindOp(fc, drawPoint),
    cursorPoint: bindOp(fc, cursorPoint),
    pullOffset: bindOp(fc, pullOffset),
    nodeDragPoint: bindOp(fc, nodeDragPoint),
    handleDragPoint: bindOp(fc, handleDragPoint),
    tryResume: bindOp(fc, tryResume),
    resumeBase: bindOp(fc, resumeBase),
    cancelResume: bindOp(fc, cancelResume),
    finishResume: bindOp(fc, finishResume),
    retractSelectedHandles: bindOp(fc, retractSelectedHandles),
  };
}
