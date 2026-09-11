// SPDX-License-Identifier: MPL-2.0
/**
 * free-canvas: editor state deep links, field setters, frame selection and arrange.
 *
 * Every function takes the shared `fc: FcCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `fc.<module>.<fn>`. Extracted verbatim
 * from initFreeCanvas() by scripts/split-closure.ts.
 */
import { boxRect, framesInPageOrder, num, renumberFrameOrder, seedBox, seedFrameOrders } from '../free-canvas-math.ts';
import type { Box, Rect as MathRect } from '../free-canvas-math.ts';
import type { DeepLinkState } from './shared.ts';
import { bindOp, type FcCtx } from './context.ts';

// The link's one-shot editor state (`_ui` + the `_sel`/`_t`/`_panel` shorthands,
// lib/editor-state.ts) - and, the SAME routine, the runtime `applyUi` the handle
// exposes (plans/176 v1). On a board with a timeline (already timed, or a playhead
// asks for one) everything waits for the lazy panel chunk: the panel's mount owns
// the selection adapter and the clock, so a selection made before it is up is not
// the one it shows, and a seek before it is up seeks nothing. Selection first,
// because the panel opens over it. All of it is dropped if the editor is torn down
// meanwhile.
export const applyEditorState = (fc: FcCtx, dl: DeepLinkState | undefined): void => {
  const { canvasEl, cfg, timeCfg } = fc;
  if (!dl || fc.disposed) return;
  const wantSeek = typeof dl.playhead === 'number' && Number.isFinite(dl.playhead) && !!timeCfg;
  const run = (): void => {
    if (fc.disposed) return;
    if (dl.select?.length) {
      const rows = fc.select.getBoxes();
      const known = new Set(rows.map((b, i) => fc.select.idOf(b, i)));
      const ids = dl.select.filter((id) => known.has(id));
      if (ids.length) {
        fc.selection = new Set(ids);
        fc.chromeSync.renderChrome();
        // And through the panel when it is up: its selection adapter is the one it
        // shows, and a camera id - no canvas footprint - only reaches the Camera
        // inspector group via the panel's own selection path.
        fc.timelinePanel?.selectAndReveal(ids);
      }
    }
    if (wantSeek) fc.timelinePanel?.seek(Math.max(0, dl.playhead as number));
    if (dl.panel === 'choreograph' && fc.selection.size) {
      // Anchor the picker just right of the selection, as a click on the More panel's
      // row would - the panel clamps itself into the stage from there.
      const rows = fc.select.getBoxes();
      const cr = canvasEl.getBoundingClientRect();
      const k = cr.width / Math.max(1, fc.helpers.canvasWH().w);
      let right = 0,
        top = Number.POSITIVE_INFINITY;
      for (const i of fc.select.selIndices(rows)) {
        const r = boxRect(rows[i], cfg);
        right = Math.max(right, r.x + r.w);
        top = Math.min(top, r.y);
      }
      fc.lastMenuAt = {
        x: cr.left + right * k + 16,
        y: cr.top + (Number.isFinite(top) ? top : 0) * k,
      };
      fc.dialogs.askChoreograph();
    }
  };
  if (wantSeek || fc.timelineAutoOpened) {
    fc.timelineAutoOpened = true;
    void fc.timeline.ensureTimeline(true).then(run);
  } else {
    run();
  }
};
// ══ the Design side-column ports (plans/179 M1-C / M2 / M3) ═══════════════════
//
// Everything below is a THIN adapter onto code this file already has. None of it
// is a second implementation: the columns get the overlay's own selection Set, its own
// `commit`, its own artboard resolution and its own arrange runners, so a verb pressed
// in a column and the same verb pressed on the canvas are literally the same code.
// Nothing here is Design-specific either - a canvas with no frame primitive answers ''
// and null rather than being handed a port that is absent.

/**
 * Write one field across the GIVEN ids in one commit. The bar's `setField` writes the
 * SELECTION; a column's row can act on a box it did not select (a layer's lock, a
 * navigator rename), and making that go through the selection would move the user's
 * selection as a side effect of typing in a text field.
 */
export function setFieldOn(fc: FcCtx, ids: readonly string[], field: string, value: unknown): void {
  if (!field || !ids.length) return;
  const want = new Set(ids.map((s) => String(s)));
  const boxes = fc.select.getBoxes();
  let touched = false;
  const next: Box[] = boxes.map((b, i) => {
    if (!want.has(fc.select.idOf(b, i))) return b;
    touched = true;
    return { ...b, [field]: value } as Box;
  });
  if (touched) fc.select.commit(next);
}
/** Act on ONE artboard by id through a selection-driven runner, then hand the selection
 *  back. Duplicate and delete both re-point it themselves (at the copy / at nothing),
 *  which is the behaviour a row menu wants, so only the pre-state is staged here. */
export function withFrameSelected(fc: FcCtx, id: string, run: () => void): void {
  if (!id) return;
  const boxes = fc.select.getBoxes();
  if (fc.select.indexOfId(boxes, id) < 0) return;
  fc.selection = new Set([id]);
  run();
}
/**
 * A new artboard immediately AFTER `id`: placed to its right, at its size, and slotted
 * into the page sequence at its order + 1 with every later page renumbered - so
 * "add after slide 2" makes a slide 3 rather than a slide 9 that x happens to sort
 * third. One commit. Unknown id falls back to `addArtboard`'s append-at-the-end.
 */
export function addArtboardAfter(fc: FcCtx, id: string): void {
  const { addKinds, cfg, frameCfg } = fc;
  if (!frameCfg?.orderField) {
    fc.document.addArtboard();
    return;
  }
  const fk = frameCfg.frameKind;
  const frameAddKind = addKinds.find(
    (k) => k.id === 'frame' || (k.seed != null && String(k.seed[cfg.kindField]) === fk)
  );
  if (!frameAddKind) return;
  const boxes0 = fc.select.getBoxes();
  const at = fc.select.indexOfId(boxes0, id);
  if (at < 0 || String(boxes0[at]?.[cfg.kindField]) !== fk) {
    fc.document.addArtboard();
    return;
  }
  const ff = fc.select.frameFields();
  const seeded = seedFrameOrders(boxes0, ff); // A9: a legacy doc gets its order first
  const src = seeded[at]!;
  const d = fc.helpers.canvasWH();
  const w = Math.max(1, num(src[cfg.wField]) || d.w);
  const h = Math.max(1, num(src[cfg.hField]) || d.h);
  const newId = fc.select.freshId(seeded);
  const box = seedBox(
    cfg,
    {},
    frameAddKind.seed || {},
    {
      x: num(src[cfg.xField]) + w + Math.round(w * 0.08),
      y: num(src[cfg.yField]),
      w,
      h,
    } as MathRect,
    newId
  );
  const seq = framesInPageOrder(seeded, ff).map((b) => String(b[cfg.idField] ?? ''));
  const where = seq.indexOf(String(id));
  seq.splice(where < 0 ? seq.length : where + 1, 0, newId);
  fc.selection = new Set([newId]);
  fc.select.commit(renumberFrameOrder([...seeded, box], seq, ff));
  fc.chromeSync.renderChrome();
  focusArtboardWhenPainted(fc, newId);
}
/** Frame a board once the render has actually put its page in the DOM (the commit only
 *  schedules one), so the focus is not a no-op on a page that does not exist yet. */
export function focusArtboardWhenPainted(fc: FcCtx, id: string): void {
  requestAnimationFrame(() => {
    if (!fc.disposed) fc.document.focusArtboard(id);
  });
}
/**
 * Reorder ONE artboard's children. Array order IS z here (`reorderZ`'s model), so the
 * rewrite keeps every other row where it was and only refills the slots the children
 * already occupy: a layer drag must not move a box between artboards, and it must not
 * disturb the order of anything outside this frame.
 */
export function reorderFrameChildren(fc: FcCtx, frameId: string, orderedIds: readonly string[]): void {
  const { cfg, frameCfg } = fc;
  if (!frameCfg || !frameId) return;
  const ff = frameCfg.frameField,
    fk = frameCfg.frameKind;
  const boxes = fc.select.getBoxes();
  const slots: number[] = [];
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (!b || String(b[cfg.kindField]) === fk) continue;
    if (String(b[ff] ?? '') !== frameId) continue;
    slots.push(i);
  }
  if (slots.length < 2) return;
  const byId = new Map<string, number>();
  for (const i of slots) byId.set(fc.select.idOf(boxes[i], i), i);
  const seen = new Set<number>();
  const seq: number[] = [];
  for (const id of orderedIds) {
    const i = byId.get(String(id));
    if (i == null || seen.has(i)) continue;
    seen.add(i);
    seq.push(i);
  }
  // A child the caller did not name keeps its own relative order, behind the named
  // ones - a partial list re-stacks what it mentions and loses nothing.
  for (const i of slots) if (!seen.has(i)) seq.push(i);
  if (seq.every((src, k) => src === slots[k])) return; // already in that order
  const next = boxes.slice();
  slots.forEach((dst, k) => {
    next[dst] = boxes[seq[k]!]!;
  });
  fc.select.commit(next);
}
/** The arrange menu's runners, by name (design-inspector's `ARRANGE_OPS`). A switch,
 *  not a translation table: the column speaks this overlay's own op vocabulary. */
export function runArrange(fc: FcCtx, op: string): void {
  switch (op) {
    case 'left':
    case 'hcentre':
    case 'right':
    case 'top':
    case 'vcentre':
    case 'bottom':
      fc.objects.applyAlign(op);
      break;
    case 'h':
    case 'v':
      fc.objects.applyDistribute(op);
      break;
    case 'front':
    case 'forward':
    case 'backward':
    case 'back':
      if (fc.selection.size) fc.objects.applyZ(op);
      break;
    case 'group':
      if (fc.selection.size >= 2) fc.objects.groupSelection();
      break;
    case 'ungroup':
      fc.objects.ungroupSelection();
      break;
    // Not in ARRANGE_OPS today, but the same menu's other two runners - named so a
    // later column row is a string, not a second door into the model.
    case 'clip':
      if (fc.selection.size >= 2) fc.objects.clipSelection();
      break;
    case 'unclip':
      fc.objects.releaseClip();
      break;
    default:
      break;
  }
}
/**
 * The inspector's Motion section is a DOOR, not a second editor: it opens the timeline
 * on the box. The panel exposes no public "open this inspector group" method, so the
 * `group` argument is honoured as far as it can be - the timeline opens and reveals the
 * clip, and the group's own disclosure stays the panel's business.
 */
export function openTimelineOn(fc: FcCtx, _group: string, id: string): void {
  void _group;
  fc.timeline.openTimeline();
  if (!id) return;
  // The panel may still be a chunk in flight; `selectAndReveal` is only meaningful once
  // it is mounted, so ask on the next frame as well as now.
  const reveal = (): void => {
    try {
      fc.timelinePanel?.selectAndReveal([id]);
    } catch (e) {
      console.error(e);
    }
  };
  reveal();
  requestAnimationFrame(() => {
    if (!fc.disposed) reveal();
  });
}
export function editorStateOps(fc: FcCtx) {
  return {
    applyEditorState: bindOp(fc, applyEditorState),
    setFieldOn: bindOp(fc, setFieldOn),
    withFrameSelected: bindOp(fc, withFrameSelected),
    addArtboardAfter: bindOp(fc, addArtboardAfter),
    focusArtboardWhenPainted: bindOp(fc, focusArtboardWhenPainted),
    reorderFrameChildren: bindOp(fc, reorderFrameChildren),
    runArrange: bindOp(fc, runArrange),
    openTimelineOn: bindOp(fc, openTimelineOn),
  };
}
