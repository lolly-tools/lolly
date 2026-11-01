// SPDX-License-Identifier: MPL-2.0
/**
 * free-canvas: the Pencil tool - drag to draw a freehand path that stays editable.
 *
 * The pointer is recorded for the whole drag, every coalesced sample included, and drawn
 * live as a plain polyline on the pen layer. On release the trace is fitted into a handful
 * of Bezier nodes (../free-canvas-pencil.ts: simplify, find corners, fit within a
 * tolerance) and committed through the pen's own `commitPathBox`, so a pencil stroke is an
 * ordinary path box: one undo step, the same paint seeding, and node editing afterwards.
 *
 * The tolerances are in SCREEN px and converted at the zoom the stroke was drawn at, so a
 * stroke drawn zoomed in keeps its finer detail and one drawn zoomed out is not fitted
 * with hundreds of nodes. Nothing snaps: a freehand line goes where the hand went.
 *
 * The Pencil has no rail button of its own: it shares the pen's slot, as Scale shares the
 * pointer's (scale-mode.ts), and this module owns that slot.
 */
import { freehandPath, MAX_SAMPLES } from '../free-canvas-pencil.ts';
import { announce } from '../../a11y.ts';
import { t } from '../../i18n.ts';
import { SVG, icon } from '../free-canvas-icons.ts';
import { showSlotTool, type Point } from './shared.ts';
import { bindOp, type FcCtx } from './context.ts';

/** The fit's error bound, in screen px. */
const PENCIL_TOL_PX = 2.5;
/** A stroke that ends this close to its start, in screen px, closes. */
const PENCIL_CLOSE_PX = 10;
/** Samples closer than this, in screen px, add nothing but work. */
const PENCIL_STEP_PX = 0.75;

export function enterPencil(fc: FcCtx): void {
  fc.edges.deselectEdge();
  fc.selection = new Set<string>();
  fc.stageEl.classList.add('fc-penciling');
  announce(t('Pencil on - drag to draw a freehand path you can edit afterwards. Esc to finish.'));
  fc.chromeSync.renderChrome();
}

export function exitPencil(fc: FcCtx): void {
  fc.pencilStroke = null;
  fc.stageEl.classList.remove('fc-penciling');
  fc.penTool.paintPen();
}

/** A press with the pencil armed starts a stroke. True when it took the press. */
export function tryPencilAt(fc: FcCtx, e: PointerEvent, nat: Point): boolean {
  if (fc.opts?.canEdit?.() === false) return false;
  if (fc.mode !== 'pencil' || !fc.cfg.pathField) return false;
  fc.pencilStroke = [nat];
  fc.gestures.beginGesture(e, { type: 'pencil', origin: nat });
  fc.penTool.paintPen();
  return true;
}

/** Add one native point to the live stroke, skipping one too close to the last. */
function push(fc: FcCtx, p: Point): void {
  const s = fc.pencilStroke;
  if (!s) return;
  const last = s[s.length - 1];
  const step = PENCIL_STEP_PX / fc.penTool.penScale();
  if (last && Math.hypot(p.x - last.x, p.y - last.y) < step) return;
  // Past the cap the fit would thin the trace anyway; keeping the latest sample means the
  // preview still follows the hand.
  if (s.length >= MAX_SAMPLES * 4) s[s.length - 1] = p;
  else s.push(p);
}

/** A pointermove during a stroke: every coalesced sample, then one repaint per frame. */
export function sample(fc: FcCtx, e: PointerEvent): void {
  if (!fc.pencilStroke) return;
  const list = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
  for (const ev of list.length ? list : [e]) push(fc, fc.stage.clientToNative(ev.clientX, ev.clientY));
  if (!fc.pencilRaf) {
    fc.pencilRaf = requestAnimationFrame(() => {
      fc.pencilRaf = 0;
      if (!fc.disposed) fc.penTool.paintPen();
    });
  }
}

/** Release: fit the trace and commit it as a path box, or nothing for a click or a dab. */
export function finish(fc: FcCtx, nat: Point): void {
  push(fc, nat);
  const stroke = fc.pencilStroke;
  fc.pencilStroke = null;
  fc.penTool.paintPen();
  if (!stroke) return;
  const scale = fc.penTool.penScale();
  const path = freehandPath(stroke, { tolerance: PENCIL_TOL_PX / scale, closeDist: PENCIL_CLOSE_PX / scale });
  if (path && fc.penTool.commitPathBox(path)) {
    announce(t('Freehand path added. Double-click it to edit its points.'));
    return;
  }
  fc.chromeSync.renderChrome();
}

/** Abandon the stroke: a second finger, a tool switch mid-drag, a lost pointer. */
export function cancel(fc: FcCtx): void {
  if (!fc.pencilStroke) return;
  fc.pencilStroke = null;
  fc.penTool.paintPen();
}

// ── the pen slot ─────────────────────────────────────────────────────────────

/** The pen slot's labels: the tool a click on the slot picks, named with its key. The
 *  pen's says that a hold offers the Pencil and the spline types, as the pointer's says
 *  that a hold offers Scale. */
const SLOT_PEN_LABEL = (): string =>
  t('Pen (P) - click to place points, drag to curve, Alt for a corner. Hold for the Pencil (Shift C) and the spline type');
const PEN_LABEL = (): string => t('Pen (P) - click to place points, drag to curve, Alt for a corner');
const PENCIL_LABEL = (): string => t('Pencil (Shift C) - drag to draw a freehand path you can edit afterwards');

/**
 * The rail's pen slot, written in place (the rail is built once). It holds the Pen and
 * the Pencil and shows the one in use, or the one used last once the pointer is back,
 * with `data-variant="pen"` or `"pencil"` (the slot holds both glyphs and editor.css
 * draws the variant's), and it stays pressed while either is out. Called on every tool
 * switch (modes.ts setMode), so P, Shift+C and the slot's own menu all move the slot.
 */
export function syncPenSlot(fc: FcCtx): void {
  if (fc.mode === 'pen' || fc.mode === 'pencil') fc.penSlotTool = fc.mode;
  const slot = fc.modeBtns.pen;
  if (!slot || slot.dataset.variant === fc.penSlotTool) return;
  showSlotTool(slot, fc.penSlotTool, fc.penSlotTool === 'pencil' ? PENCIL_LABEL() : SLOT_PEN_LABEL());
}
/** The pen slot's click: the tool the slot shows, or the pointer when that tool is already
 *  out, as a click on the Pen's own button always put the Pen down. */
export function pickPenSlot(fc: FcCtx): void {
  const tool = fc.penSlotTool;
  if (fc.mode === tool) fc.modes.toPointer();
  else fc.modes.setMode(tool);
}
/**
 * The pen slot's menu, on a hold or a right-click of the slot as the pointer slot offers
 * Scale: the Pen (P) and the Pencil (Shift C), the one the slot holds checked, then the
 * Pen's spline types, so the type can still be chosen before anything is drawn.
 */
export function openPenSlotMenu(fc: FcCtx, anchor: HTMLElement): void {
  const pencil = fc.penSlotTool === 'pencil';
  fc.menus.spawnPopover(anchor, [
    { label: PEN_LABEL(), icon: icon(SVG.pen), key: 'pen', on: !pencil, run: () => fc.modes.setMode('pen') },
    { label: PENCIL_LABEL(), icon: icon(SVG.freehand), key: 'pencil', on: pencil, run: () => fc.modes.setMode('pencil') },
    { sep: true },
    ...fc.penTool.penKindItems(),
  ]);
}

export function pencilOps(fc: FcCtx) {
  return {
    syncSlot: bindOp(fc, syncPenSlot),
    pickSlot: bindOp(fc, pickPenSlot),
    openSlotMenu: bindOp(fc, openPenSlotMenu),
    enterPencil: bindOp(fc, enterPencil),
    exitPencil: bindOp(fc, exitPencil),
    tryPencilAt: bindOp(fc, tryPencilAt),
    sample: bindOp(fc, sample),
    finish: bindOp(fc, finish),
    cancel: bindOp(fc, cancel),
  };
}
