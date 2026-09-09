// SPDX-License-Identifier: MPL-2.0
/**
 * free-canvas: chrome clearing, the context bar's show/hide, stage reserves and the tool rail's docking.
 *
 * Every function takes the shared `fc: FcCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `fc.<module>.<fn>`. Extracted verbatim
 * from initFreeCanvas() by scripts/split-closure.ts.
 */
import { prefersReducedMotion } from '../../lib/a11y-prefs.ts';
import { clampRailPos, railSession, setRailSession } from './shared.ts';
import { bindOp, type FcCtx } from './context.ts';

export function clearPenChrome(fc: FcCtx): void {
  const { penChrome } = fc;
  penChrome.innerHTML = '';
  fc.penChromeKey = null;
  fc.penChromeNodes = null;
}
export function showCtxBar(fc: FcCtx): void {
  const { CTX_ENTER, ctxbar } = fc;
  if (fc.ctxShown && !ctxbar.hidden) return;
  fc.ctxShown = true;
  ctxbar.hidden = false;
  // Reduced motion (OS query OR the app pref): appear instantly. No movement, and no
  // transform written at all, so the popover containing-block trap stays untouched.
  if (prefersReducedMotion()) return;
  ctxbar.classList.remove(CTX_ENTER);
  void ctxbar.offsetWidth; // restart the animation on a re-selection
  ctxbar.classList.add(CTX_ENTER);
}
export function hideCtxBar(fc: FcCtx): void {
  const { CTX_ENTER, ctxbar } = fc;
  fc.ctxShown = false;
  ctxbar.hidden = true;
  ctxbar.classList.remove(CTX_ENTER);
}
export function clearChrome(fc: FcCtx): void {
  const { chrome } = fc;
  chrome.innerHTML = '';
  fc.chromeKey = null;
  fc.chromeNodes = null;
}
export function syncStageReserves(fc: FcCtx): void {
  const { canvasEl, stageEl } = fc;
  // The rail gets a band of its own ONLY while the timeline made it a column. With the
  // navigator open the buttons sit inside that column, so the navigator's width is the
  // whole left band and a rail allowance on top of it would double-count the same px.
  const railBand = fc.railMode === 'timeline' ? fc.railDockW + 12 : 0;
  const left = Math.max(0, Math.round(fc.navReserveLeft + railBand));
  // Equality-guarded, like reserveBottom: the stage has a ResizeObserver, and an
  // unconditional write plus an unconditional `canvas-resize` is a loop.
  let changed = false;
  const put = (el: HTMLElement, prop: string, px: number): void => {
    const next = px > 0 ? `${px}px` : '';
    if (el.style.getPropertyValue(prop) === next) return;
    if (next) el.style.setProperty(prop, next);
    else el.style.removeProperty(prop);
    changed = true;
  };
  put(stageEl, '--stage-reserve-left', left);
  // The RIGHT band is always zero now: the inspector and every other right-hand panel
  // ride the app-wide edge dock, which insets `#view` through `--dock-w` instead of
  // reserving stage width. Written as a removal rather than skipped, so a stage left
  // with a right reserve by an earlier layout is cleared.
  put(stageEl, '--stage-reserve-right', 0);
  put(stageEl, '--ldock-rail-w', railBand);
  // <html>, not the stage: the fixed back pill insets past the dock with the app-wide
  // `--dock-w` pattern, and it is not a child of the stage.
  put(document.documentElement, '--ldock-w', railBand);
  if (changed) {
    try {
      canvasEl.dispatchEvent(new Event('canvas-resize'));
    } catch {
      /* stage detached */
    }
  }
}
/**
 * The navigator's own slot for the tool rail, present only while that column is open
 * (design-navigator.ts hides it with the rest of the body when the column collapses to
 * its dot rail). Read off the DOM rather than handed over: the navigator is mounted by
 * the tool view as a stage sibling, and neither module imports the other, so the data
 * attribute is the whole contract - the same shape as this file's `.tl-panel` reads.
 */
export function navRailSlot(fc: FcCtx): HTMLElement | null {
  const { stageEl } = fc;
  const slot = stageEl.querySelector<HTMLElement>('[data-nav-rail-slot]');
  return slot && !slot.hidden ? slot : null;
}
/**
 * The columns' single door onto the reserves (design-ports' `setColumnWidths`), and
 * with it the moment the rail changes hands: a column reports its width on mount, on
 * every open/close and on every frame of a resize drag, which is exactly when its rail
 * slot appears and disappears.
 */
export function setColumnWidths(fc: FcCtx, left: number, right: number): void {
  const l = Number.isFinite(left) ? Math.max(0, left) : 0;
  const r = Number.isFinite(right) ? Math.max(0, right) : 0;
  const wantNav = !!navRailSlot(fc);
  if (l === fc.navReserveLeft && r === fc.inspectorReserveRight && wantNav === fc.navWantsRail) return;
  fc.navReserveLeft = l;
  fc.inspectorReserveRight = r;
  fc.navWantsRail = wantNav;
  applyRailMode(fc);
  syncStageReserves(fc);
  // A rail the user had already dragged carries an inline position that predates the
  // column: re-clamp it so opening the navigator pushes it clear rather than leaving
  // it sitting over the rows (the CSS default position follows the band on its own).
  reclampRail(fc);
}
/**
 * The stage band the rail must never be dragged into. Three things can live in the
 * foot of the stage, and a rail parked under any of them is invisible (the rail is
 * `opacity: 0` at rest) AND unclickable:
 *   - the docked TIMELINE panel - `z-index: 22` and `pointer-events: auto`, well above
 *     the dock's 16, so it both paints over the rail and swallows its pointer;
 *   - the export pill, wherever a host still shows one;
 *   - the recorder tools' "Warm the mic / Record" control at the stage foot.
 * Measured live rather than read off `--stage-reserve-bottom`: that custom property is
 * only an input to fitCanvas and does not shrink the stage box, so the stage rect still
 * spans the panel band.
 */
export function railReserveBottom(fc: FcCtx, sr: DOMRect): number {
  const { viewEl } = fc;
  let reserve = 0;
  for (const sel of ['.tl-panel', '.render-pill', '.canvas-record-btn', '.canvas-record-timer']) {
    for (const el of Array.from(viewEl.querySelectorAll<HTMLElement>(sel))) {
      // getClientRects(), not offsetParent: a `position: fixed` element (the mobile
      // export pill is exactly that) reports a null offsetParent while being perfectly
      // visible, so the old guard could never see it.
      if (el.hidden || !el.getClientRects().length) continue;
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.bottom > sr.bottom - 4)
        reserve = Math.max(reserve, sr.bottom - r.top);
    }
  }
  return Math.max(0, Math.round(reserve));
}
export function placeRail(fc: FcCtx, want: { left: number; top: number }): void {
  const { stageEl, toolbar, toolbarDock } = fc;
  const rr = toolbar.getBoundingClientRect();
  const sr = stageEl.getBoundingClientRect();
  const pos = clampRailPos(
    want,
    { w: rr.width, h: rr.height },
    { w: sr.width, h: sr.height },
    // The navigator's band, never the rail's own share of the reserve (while the
    // timeline has docked the rail it IS that column and is not draggable anyway).
    { reserveBottom: railReserveBottom(fc, sr), reserveLeft: fc.navReserveLeft }
  );
  setRailSession(pos);
  toolbarDock.classList.add('is-detached');
  toolbarDock.style.left = pos.left + 'px';
  toolbarDock.style.top = pos.top + 'px';
}
/** Keep a detached rail inside the stage when the stage itself changes size. */
export function reclampRail(fc: FcCtx): void {
  const { toolbarDock } = fc;
  // While a panel holds the rail, a stage resize must not re-detach it - the
  // remembered position comes back when that panel lets go.
  if (fc.railMode !== 'float' && !toolbarDock.classList.contains('is-detached')) return;
  if (railSession) placeRail(fc, railSession);
}
/**
 * REMEMBER, BEFORE A PANEL TAKES IT. Both docks strip the dock's `is-detached` and its
 * inline left/top, which is also the evidence of where the rail was, so the snapshot
 * has to happen while the rail is still floating.
 */
export function snapshotRailHome(fc: FcCtx): void {
  const { toolbarDock } = fc;
  fc.railWasDetached = toolbarDock.classList.contains('is-detached');
  fc.railPreDock = railSession ? { ...railSession } : null;
}
/**
 * GIVE IT BACK, explicitly (plans/179 T2). `railSession` first, because it is the
 * user's own last word on where the rail lives and it survives a dock - so a drag that
 * happened before it (or in another editor this page session) still wins. Then the
 * pre-dock snapshot. And if neither says "detached", the rail was parked on the CSS
 * edge: clear the column's leftovers rather than leaving the dock in whatever
 * half-state the panel styles put it in, which is how it ended up mostly off-screen.
 */
export function restoreFloatingRail(fc: FcCtx): void {
  const { toolbarDock } = fc;
  const back = railSession ?? fc.railPreDock;
  if (back && (fc.railWasDetached || railSession)) {
    placeRail(fc, back);
  } else {
    toolbarDock.classList.remove('is-detached');
    toolbarDock.style.removeProperty('left');
    toolbarDock.style.removeProperty('top');
  }
  fc.railPreDock = null;
  fc.railWasDetached = false;
}
/** Put the buttons in the navigator's slot (idempotent - a rebuilt slot re-homes). */
export function homeRailInNav(fc: FcCtx): void {
  const { toolbar } = fc;
  const slot = navRailSlot(fc);
  if (!slot || toolbar.parentElement === slot) return;
  slot.appendChild(toolbar);
}
/**
 * Navigator open: the rail is not a second left column beside it, it is the grid of
 * icons at the top OF it (Andy, 2026-09-02: "if the left dock is on we should dock the
 * fc-toolbar too, perhaps wrap the icons in a grid up the top of the toolbar"). Every
 * button keeps its element, so its handler, tooltip and accessible name travel with it;
 * only the drag grip and the separators go, and those are CSS (`.fc-toolbar--grid`).
 */
export function enterNavDock(fc: FcCtx): void {
  const { toolbar, toolbarDock } = fc;
  toolbarDock.classList.remove('is-detached');
  toolbarDock.style.removeProperty('left');
  toolbarDock.style.removeProperty('top');
  toolbar.classList.add('fc-toolbar--grid');
  homeRailInNav(fc);
}
export function leaveNavDock(fc: FcCtx): void {
  const { toolbar, toolbarDock } = fc;
  toolbar.classList.remove('fc-toolbar--grid');
  if (toolbar.parentElement !== toolbarDock) toolbarDock.appendChild(toolbar);
}
/**
 * Timeline open with no navigator: the rail stops floating and becomes a fixed-width
 * left PANEL - the mirror of the right edge-dock column (export settings / player).
 * Content is NUDGED right, never overlapped: the measured panel width is handed to
 * `syncStageReserves`, the one writer of `--stage-reserve-left`, `--ldock-rail-w` and
 * `--ldock-w`. Dragging is off while docked - a set-width panel has nowhere to drag to.
 * The panel look itself is CSS (`.has-tl-reserve` in editor.css).
 */
export function enterTimelineDock(fc: FcCtx): void {
  const { stageEl, toolbar, toolbarDock } = fc;
  toolbarDock.classList.remove('is-detached');
  toolbarDock.style.removeProperty('left');
  toolbarDock.style.removeProperty('top');
  // Measure the floating rail BEFORE the panel styles land, +gutters. A rail that
  // cannot be measured (display:none mid-navigation) falls back to its design width.
  fc.railDockW = Math.ceil(toolbar.getBoundingClientRect().width) || 46;
  stageEl.classList.add('has-tl-reserve');
}
export function leaveTimelineDock(fc: FcCtx): void {
  const { stageEl } = fc;
  fc.railDockW = 0;
  stageEl.classList.remove('has-tl-reserve');
}
/**
 * The one applier. The navigator wins over the timeline: with the column open the rail
 * is inside it, and when the column closes the timeline's own left dock takes over
 * again, so today's behaviour stands wherever there is no navigator.
 */
export function applyRailMode(fc: FcCtx): void {
  const want = fc.navWantsRail ? 'navigator' : fc.tlWantsRail ? 'timeline' : 'float';
  if (want === fc.railMode) {
    // Same mode, but a navigator re-render replaces the slot node under us.
    if (want === 'navigator') homeRailInNav(fc);
    return;
  }
  if (fc.railMode === 'float') snapshotRailHome(fc);
  else if (fc.railMode === 'timeline') leaveTimelineDock(fc);
  else leaveNavDock(fc);
  fc.railMode = want;
  if (want === 'timeline') enterTimelineDock(fc);
  else if (want === 'navigator') enterNavDock(fc);
  else restoreFloatingRail(fc);
}
/** The timeline's half of that request (the panel calls this as it opens/closes). */
export function dockRailForTimeline(fc: FcCtx, on: boolean): void {
  // Desktop only, like the right edge-dock: a fixed left column is dead space on a
  // phone OR a short touch landscape, where CSS turns this same rail into the
  // horizontal palette above the timeline. Reserving that palette's full 828px
  // width as a left column reduced the artboard to the 40px safety floor.
  // Feature-detect matchMedia (absent under jsdom/CLI, where docking is harmless).
  if (
    on &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(
      '(pointer: coarse) and (max-width: 640px), (pointer: coarse) and (max-height: 430px)'
    ).matches
  )
    return;
  if (on === fc.tlWantsRail) return;
  fc.tlWantsRail = on;
  applyRailMode(fc);
  syncStageReserves(fc);
}
export const onRailDown = (fc: FcCtx, e: PointerEvent): void => {
  const { toolbar, toolbarDock, wobble } = fc;
  if (e.button !== 0 || fc.railDrag) return;
  if (fc.railMode !== 'float') return; // a docked rail has a set width and place - no drag
  // Buttons/fields already stop pointerdown before it reaches here; this is the
  // belt to that pair of braces, and it keeps the colour trigger draggable-proof.
  if ((e.target as HTMLElement).closest?.('button, input, select, .fc-color-btn')) return;
  const rr = toolbar.getBoundingClientRect();
  fc.railDrag = {
    pointerId: e.pointerId,
    dx: e.clientX - rr.left,
    dy: e.clientY - rr.top,
    lx: e.clientX,
    ly: e.clientY,
  };
  fc.toolbox.closePopover();
  fc.document.closeMorePanel();
  toolbarDock.classList.add('is-dragging');
  try {
    toolbar.setPointerCapture(e.pointerId);
  } catch {
    /* no pointer capture (jsdom) */
  }
  wobble.grab(e.clientX, e.clientY);
  e.preventDefault();
  e.stopPropagation();
};
export const onRailMove = (fc: FcCtx, e: PointerEvent): void => {
  const { stageEl, wobble } = fc;
  if (!fc.railDrag || e.pointerId !== fc.railDrag.pointerId) return;
  // No button held any more → the pointerup was lost (a capture stolen by the export
  // shutter's `pointer-events: none`, a devtools break). Finish the drag instead of
  // letting a bare hover keep sliding the rail around the stage.
  if (e.type === 'pointermove' && e.buttons === 0) {
    onRailUp(fc, e);
    return;
  }
  // Per-move deltas for the wobble (not throttled) - the dock's left/top is unchanged.
  wobble.drag(e.clientX - fc.railDrag.lx, e.clientY - fc.railDrag.ly);
  fc.railDrag.lx = e.clientX;
  fc.railDrag.ly = e.clientY;
  const sr = stageEl.getBoundingClientRect();
  fc.railWant = { left: e.clientX - sr.left - fc.railDrag.dx, top: e.clientY - sr.top - fc.railDrag.dy };
  // One style write per frame (the timeline resize grip's shape). Live-mutating
  // only - a rail position is never committed to the model.
  if (fc.railRaf) return;
  fc.railRaf = requestAnimationFrame(() => {
    fc.railRaf = 0;
    if (fc.railWant) placeRail(fc, fc.railWant);
  });
};
export const onRailUp = (fc: FcCtx, e: PointerEvent): void => {
  const { toolbar, toolbarDock, wobble } = fc;
  if (!fc.railDrag || e.pointerId !== fc.railDrag.pointerId) return;
  if (fc.railRaf) {
    cancelAnimationFrame(fc.railRaf);
    fc.railRaf = 0;
  }
  if (fc.railWant) placeRail(fc, fc.railWant);
  fc.railWant = null;
  try {
    toolbar.releasePointerCapture(fc.railDrag.pointerId);
  } catch {
    /* never captured */
  }
  fc.railDrag = null;
  toolbarDock.classList.remove('is-dragging');
  wobble.release();
};
export function railOps(fc: FcCtx) {
  return {
    clearPenChrome: bindOp(fc, clearPenChrome),
    showCtxBar: bindOp(fc, showCtxBar),
    hideCtxBar: bindOp(fc, hideCtxBar),
    clearChrome: bindOp(fc, clearChrome),
    syncStageReserves: bindOp(fc, syncStageReserves),
    navRailSlot: bindOp(fc, navRailSlot),
    setColumnWidths: bindOp(fc, setColumnWidths),
    railReserveBottom: bindOp(fc, railReserveBottom),
    placeRail: bindOp(fc, placeRail),
    reclampRail: bindOp(fc, reclampRail),
    snapshotRailHome: bindOp(fc, snapshotRailHome),
    restoreFloatingRail: bindOp(fc, restoreFloatingRail),
    homeRailInNav: bindOp(fc, homeRailInNav),
    enterNavDock: bindOp(fc, enterNavDock),
    leaveNavDock: bindOp(fc, leaveNavDock),
    enterTimelineDock: bindOp(fc, enterTimelineDock),
    leaveTimelineDock: bindOp(fc, leaveTimelineDock),
    applyRailMode: bindOp(fc, applyRailMode),
    dockRailForTimeline: bindOp(fc, dockRailForTimeline),
    onRailDown: bindOp(fc, onRailDown),
    onRailMove: bindOp(fc, onRailMove),
    onRailUp: bindOp(fc, onRailUp),
  };
}
