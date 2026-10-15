// SPDX-License-Identifier: MPL-2.0
import { retainCanvasRecovery } from '../../lib/canvas-recovery.ts';
import { charsFromDom, markdownFromChars } from '../rich-text.ts';
import { canvasInteractions, type CanvasInteractionLease } from '../../lib/canvas-interaction.ts';
import { boxRect, selectionAABB, withRect } from '../free-canvas-math.ts';
import type { Box } from '../free-canvas-math.ts';
import type { FcCtx } from './context.ts';
import type { Gesture, GesturePointer, Rect } from './shared.ts';

interface GestureLease {
  gesture: Gesture;
  lease?: CanvasInteractionLease;
  move?: GesturePointer;
  ids: string[];
  claimed: Set<string>;
  selected: string[];
  baseline: Map<string, Rect>;
  rects: Map<string, Rect>;
  prepared?: Box[];
  dirty: boolean;
}
const gestures = new WeakMap<FcCtx, GestureLease>();
const texts = new WeakMap<FcCtx, { id: string; lease?: CanvasInteractionLease }>();
function indices(g: Gesture): number[] {
  return g.type === 'move' ? [...g.sel] : g.type === 'resize' || g.type === 'rotate' ? [g.index]
    : g.type === 'gscale' || g.type === 'grotate' ? g.sel : [];
}
export function beginCanvasGesture(fc: FcCtx): void {
  const port = canvasInteractions(fc.runtime), g = fc.gesture;
  if (!port || !g || !indices(g).length) return;
  const boxes = fc.select.getBoxes(), selected = indices(g);
  const ids = selected.map(i => fc.select.idOf(boxes[i], i));
  // Moving a frame also moves its children in the final transaction.
  if (fc.frameCfg) {
    const frames = new Set(selected.filter(i => boxes[i]?.[fc.cfg.kindField] === fc.frameCfg!.frameKind).map(i => ids[selected.indexOf(i)]));
    boxes.forEach((box, i) => { if (frames.has(String(box[fc.frameCfg!.frameField] ?? ''))) ids.push(fc.select.idOf(box, i)); });
  }
  const claimed = new Set(ids);
  const state: GestureLease = { gesture: g, ids: [...claimed], claimed, selected: selected.map(i => fc.select.idOf(boxes[i], i)),
    baseline: new Map(), rects: new Map(), dirty: false };
  gestures.set(fc, state);
  void port.acquire({ kind: 'transform', collection: fc.blockId, ids: state.ids }, () => {
    if (gestures.get(fc) === state) {
      let message = 'Editing stopped: the work connection or claim changed.';
      try { if (state.rects.size) {
        const boxes = fc.select.getBoxes(), selected = indices(state.gesture);
        const next = boxes.map((box, i) => {
          const rect = state.rects.get(fc.select.idOf(box, i)); return rect ? withRect(box, rect, fc.cfg) : box;
        });
        retainCanvasRecovery(fc.runtime, { [fc.blockId]: fc.select.cascadeFrameChildren(boxes, next, selected) }, 'Interrupted gesture');
      } } catch { message = 'Editing stopped. The recovery copy could not be saved.'; }
      finally { fc.gestures.cancelGesture(); fc.stage.flash(message); }
    }
  }).then(lease => {
    if (gestures.get(fc) !== state || fc.gesture !== g || fc.disposed) { lease.finish(false); return; }
    state.lease = lease;
    // Refresh origins after the server has drained earlier writes, rather than
    // transforming an older snapshot captured during the round trip.
    const current = fc.select.getBoxes();
    current.forEach((box, i) => { state.baseline.set(fc.select.idOf(box, i), boxRect(box, fc.cfg)); });
    if (state.move) fc.gestures.applyGestureMove(state.move);
  }).catch(error => {
    if (gestures.get(fc) !== state) return;
    fc.gestures.cancelGesture(); fc.stage.flash((error as Error).message);
  });
}
export function canvasGestureReady(fc: FcCtx, move?: GesturePointer): boolean {
  const state = gestures.get(fc);
  if (state && !state.lease) { if (move) state.move = move; return false; }
  if (state) {
    const boxes = fc.select.getBoxes();
    // Row arrays are replaced on model writes. Rebase once per projection, while
    // keeping claim-grant origins and stable ids across remote edits and reorders.
    if (state.prepared === boxes) return true;
    const byId = new Map(boxes.map((box, i) => [fc.select.idOf(box, i), i]));
    const selected = state.selected.map(id => byId.get(id) ?? -1);
    if (selected.some(i => i < 0)) { fc.gestures.cancelGesture(); return false; }
    const g = state.gesture;
    if (g.type === 'move') {
      g.sel = selected;
      g.start = new Map(selected.map(i => [i, state.baseline.get(fc.select.idOf(boxes[i], i))!]));
    } else if (g.type === 'resize' || g.type === 'rotate') {
      g.index = selected[0]!; g.startRect = state.baseline.get(state.selected[0]!)!;
      // A Scale's start row follows the rebase as gscale's start rows do: the current row
      // at the baseline geometry, which the layout half of its commit reads.
      if (g.type === 'resize' && g.startBox) g.startBox = withRect(boxes[g.index]!, g.startRect, fc.cfg);
    } else if (g.type === 'gscale' || g.type === 'grotate') {
      g.sel = selected;
      g.startBoxes = boxes.map((box, i) => {
        const baseline = state.baseline.get(fc.select.idOf(box, i)); return baseline ? withRect(box, baseline, fc.cfg) : box;
      });
      // The pivot and the bounds (and with them the anchor every gscale frame derives)
      // follow the rebased start, and the press keeps its place, so the first frame after
      // a grant reads no change at the press point rather than a jump about the bounds the
      // press was measured against. Every gscale frame reads its travel from the press,
      // for a corner and an edge alike. A peer may have turned a member onto or off a
      // quarter turn before the grant, so the uniform fallback of a Resize is decided again.
      const startBoxes = g.startBoxes;
      const pivotSel = g.type === 'grotate' ? g.sel.filter(i => !fc.gestures.isFrameRow(startBoxes[i])) : g.sel;
      const a = selectionAABB(startBoxes, pivotSel, fc.cfg);
      if (a && g.type === 'gscale') {
        g.aabb = a;
        if (!g.content) g.proportional = fc.selectionTransform.proportional(startBoxes, g.sel);
      } else if (a && g.type === 'grotate') {
        g.centre = { x: (a.minX + a.maxX) / 2, y: (a.minY + a.maxY) / 2 };
        g.pointerStartDeg = (Math.atan2(g.origin.y - g.centre.y, g.origin.x - g.centre.x) * 180) / Math.PI;
      }
    }
    state.prepared = boxes;
  }
  return true;
}
export function previewCanvasRect(fc: FcCtx, index: number, rect: Rect): void {
  const state = gestures.get(fc);
  if (!state?.lease) return;
  const boxes = fc.select.getBoxes(), id = fc.select.idOf(boxes[index], index);
  state.rects.set(id, rect);
  state.dirty = true;
}
/** Publish a complete gesture frame after every selected object's live DOM write. */
export function flushCanvasPreview(fc: FcCtx): void {
  const state = gestures.get(fc);
  if (!state?.lease || !state.dirty) return;
  const boxes = fc.select.getBoxes();
  const next = boxes.map((box, i) => state.rects.has(fc.select.idOf(box, i)) ? withRect(box, state.rects.get(fc.select.idOf(box, i))!, fc.cfg) : box);
  const cascaded = fc.select.cascadeFrameChildren(boxes, next, indices(state.gesture));
  const g = state.gesture;
  state.dirty = false;
  state.lease.preview({ kind: g.type === 'move' ? 'move' : g.type === 'resize' || g.type === 'gscale' ? 'resize' : 'rotate', phase: 'active',
    objects: cascaded.flatMap((box, i) => {
      const id = fc.select.idOf(box, i); if (!state.claimed.has(id)) return [];
      const r = boxRect(box, fc.cfg); return [{ id, x: r.x, y: r.y, w: r.w, h: r.h, rot: r.rot ?? 0 }];
    }) });
}
export function finishCanvasGesture(fc: FcCtx, committed: boolean): void {
  if (committed) flushCanvasPreview(fc);
  const state = gestures.get(fc); gestures.delete(fc);
  state?.lease?.finish(committed);
  if (!committed && fc.gesture) {
    const boxes = fc.select.getBoxes();
    for (const i of indices(fc.gesture)) if (boxes[i]) fc.gestures.applyLiveRect(i, boxRect(boxes[i], fc.cfg));
  }
}
export function claimCanvasText(fc: FcCtx, id: string, resume: () => void): boolean {
  const port = canvasInteractions(fc.runtime);
  if (!port) return true;
  const existing = texts.get(fc);
  if (existing?.id === id) return !!existing.lease;
  existing?.lease?.finish(false);
  const state = { id } as { id: string; lease?: CanvasInteractionLease }; texts.set(fc, state);
  const story = fc.select.getBoxes().find(box => box[fc.cfg.idField] === id)?.[fc.cv.textStoryField ?? ''];
  void port.acquire({ kind: 'text', collection: fc.blockId, ids: [id], field: fc.cfg.textField,
    ...(story && fc.cv.textDocumentInput ? { param: fc.cv.textDocumentInput } : {}) }, () => {
    if (texts.get(fc) === state) {
      let message = 'Editing stopped: the work connection or claim changed.';
      try {
      const editing = fc.editing;
      if (editing?.composed) editing.composed.editor.recoverDraft();
      else if (editing) {
        const text = markdownFromChars(charsFromDom(editing.el));
        const boxes = fc.select.getBoxes().map(box => box[fc.cfg.idField] === editing.id
          ? { ...box, ...editing.pending, [fc.cfg.textField]: text } : box);
        if (text !== editing.prevRichText || Object.keys(editing.pending).length)
          retainCanvasRecovery(fc.runtime, { [fc.blockId]: boxes }, 'Interrupted text');
      }
      } catch { message = 'Editing stopped. The recovery copy could not be saved.'; }
      finally { fc.textEdit.cancelTextEdit(); finishCanvasText(fc, false); fc.stage.flash(message); }
    }
  }).then(lease => {
    if (texts.get(fc) !== state || fc.disposed) { lease.finish(false); return; }
    state.lease = lease; resume();
  }).catch(error => { if (texts.get(fc) === state) { texts.delete(fc); fc.stage.flash((error as Error).message); } });
  return false;
}
export function finishCanvasText(fc: FcCtx, committed: boolean): void {
  const state = texts.get(fc); texts.delete(fc); state?.lease?.finish(committed);
}
export function disposeCanvasInteractions(fc: FcCtx): void { finishCanvasGesture(fc, false); finishCanvasText(fc, false); }
