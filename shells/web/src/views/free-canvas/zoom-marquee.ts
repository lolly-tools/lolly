// SPDX-License-Identifier: MPL-2.0
/**
 * free-canvas: hold Z to zoom.
 *
 * While Z is held, a drag on the stage draws the selection band (`fc.rubber`) and zooms
 * to the dragged area on release; a click zooms in about the point, and the same with
 * Alt zooms out. Every zoom goes through the stage's `fc-focus-rect` route in client
 * coordinates, the way the navigator frames an artboard, so the overlay never touches
 * the pan and zoom transform itself. The press is taken in the document's capture phase
 * so it reaches no selection, drag or tool gesture. Presses on the editor's own panels
 * and fields are left alone, and releasing Z ends nothing already being dragged.
 */
import { bindOp, type FcCtx } from './context.ts';

/** Below this many px on either side a press is a click, not an area. */
const ZOOM_DRAG_MIN_PX = 6;
/** Panels and fields that keep their own presses while Z is held. */
const KEEPS_PRESSES = '.fc-toolbar-dock, .fc-ctxbar, .fc-panel, .fc-fmtbar, .stage-nav, .fc-nav, .tl-panel, input, textarea, select, [contenteditable]';

function arm(fc: FcCtx, on: boolean): void {
  if (fc.zoomArmed === on) return;
  fc.zoomArmed = on;
  fc.stageEl.classList.toggle('fc-zoom-armed', on);
}
/** A bare Z (no modifier) arms the zoom while it is held. Called from onKey, after its
 *  typing and dialog checks. */
export function zoomKeyDown(fc: FcCtx, e: KeyboardEvent): boolean {
  if ((e.key !== 'z' && e.key !== 'Z') || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return false;
  e.preventDefault();
  arm(fc, true);
  return true;
}
export function zoomKeyUp(fc: FcCtx, e: KeyboardEvent): void {
  if (e.key === 'z' || e.key === 'Z') arm(fc, false);
}
/** The window lost focus mid-hold: its keyup will never come. */
export function zoomBlur(fc: FcCtx): void {
  arm(fc, false);
}
export function zoomPointerDown(fc: FcCtx, e: PointerEvent): void {
  if (!fc.zoomArmed || fc.zoomDrag || e.button !== 0 || fc.disposed) return;
  const target = e.target as Element | null;
  if (!target || !fc.stageEl.contains(target) || target.closest(KEEPS_PRESSES)) return;
  e.preventDefault();
  e.stopPropagation();
  const sr = fc.stageEl.getBoundingClientRect();
  fc.zoomDrag = { id: e.pointerId, x: e.clientX, y: e.clientY, alt: e.altKey, left: sr.left, top: sr.top, w: sr.width, h: sr.height };
  try { fc.stageEl.setPointerCapture(e.pointerId); } catch { /* a synthetic or ended pointer */ }
}
export function zoomPointerMove(fc: FcCtx, e: PointerEvent): void {
  const d = fc.zoomDrag;
  if (!d || e.pointerId !== d.id) return;
  const { rubber } = fc;
  rubber.hidden = false;
  rubber.style.left = `${Math.min(d.x, e.clientX) - d.left}px`;
  rubber.style.top = `${Math.min(d.y, e.clientY) - d.top}px`;
  rubber.style.width = `${Math.abs(e.clientX - d.x)}px`;
  rubber.style.height = `${Math.abs(e.clientY - d.y)}px`;
}
export function zoomPointerUp(fc: FcCtx, e: PointerEvent): void {
  const d = fc.zoomDrag;
  if (!d || e.pointerId !== d.id) return;
  fc.zoomDrag = null;
  fc.rubber.hidden = true;
  if (e.type === 'pointercancel') return;
  const w = Math.abs(e.clientX - d.x), h = Math.abs(e.clientY - d.y);
  // A click asks for half the stage about the point (zoom in) or twice it (Alt: zoom out).
  const k = d.alt ? 2 : 0.5;
  const rect = w >= ZOOM_DRAG_MIN_PX && h >= ZOOM_DRAG_MIN_PX
    ? { x: Math.min(d.x, e.clientX), y: Math.min(d.y, e.clientY), w, h }
    : { x: d.x - (d.w * k) / 2, y: d.y - (d.h * k) / 2, w: d.w * k, h: d.h * k };
  const Ev = (fc.stageEl.ownerDocument?.defaultView?.CustomEvent ?? CustomEvent) as typeof CustomEvent;
  fc.stageEl.dispatchEvent(new Ev('fc-focus-rect', { bubbles: true, detail: rect }));
}

export function zoomMarqueeOps(fc: FcCtx) {
  return {
    zoomKeyDown: bindOp(fc, zoomKeyDown),
    zoomKeyUp: bindOp(fc, zoomKeyUp),
    zoomBlur: bindOp(fc, zoomBlur),
    zoomPointerDown: bindOp(fc, zoomPointerDown),
    zoomPointerMove: bindOp(fc, zoomPointerMove),
    zoomPointerUp: bindOp(fc, zoomPointerUp),
  };
}
