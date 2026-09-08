// SPDX-License-Identifier: MPL-2.0
/**
 * Free-floating behaviour for the DESKTOP export panel.
 *
 * By default the panel stays docked bottom-left under the sidebar (the CSS in
 * styles/parts/tool.css owns that). This layers four capabilities on top, without
 * touching the panel's open/close/modality wiring in views/tool.ts:
 *
 *   • drag the header to move it - the first drag lifts it off the dock into a
 *     free-floating `position:fixed` box (this is the "not docked to the sidebar"
 *     case: canvas / chromeless layouts start floated so the panel can be moved
 *     out of the way of the stage);
 *   • eight grips to resize it - the SAME primitive the neurospicy player uses
 *     (lib/panel-grips.ts), so every shapeable panel in the app behaves alike;
 *   • a maximise toggle that grows it to the full height of the screen ("expand to
 *     the top"), keeping its left edge + width;
 *   • a dock button that snaps it back home - the berth under the sidebar where there
 *     is a sidebar, and the app's ONE right-hand column (lib/edge-dock.ts) where there
 *     is not, because a free layout has no berth to snap to.
 *
 * The box + mode persist per device (localStorage), like the visualizer panel, and so
 * does whether the user keeps the sheet in that right-hand column.
 *
 * Mobile is deliberately untouched: there the panel is a modal bottom sheet with a
 * flick-to-dismiss gesture, and floating would fight it. Every gesture no-ops under
 * 641px and the floating CSS is media-scoped ≥641px, so the class is inert there;
 * on a shrink to mobile we also clear the inline box so the sheet renders normally.
 */
import { t } from '../i18n.ts';
import { panelGripsHtml, wirePanelGrips } from './panel-grips.ts';
import { icon } from './icons.ts';
import { attachWobble } from './wobble.ts';
import { requestDock, releaseDock, isDocked, edgeDockHitTest, edgeDockPreview, edgeDockWidth, onDockChange } from './edge-dock.ts';

interface Box { x: number; y: number; w: number; h: number }
// 'edge' = docked into the full-height inline-end column (lib/edge-dock.ts). Distinct
// from 'docked', which is the panel's home berth under the sidebar.
type Mode = 'docked' | 'floating' | 'maximized' | 'edge';

const KEY = 'lolly:exportPanelFloat';
const MIN = { w: 300, h: 240 };
const MARGIN = 8;          // keep this far from the viewport edges
const KEEP_VISIBLE = 96;   // never let the panel be dragged fully off-screen

export interface ExportFloatOpts {
  overlay: HTMLElement;      // #export-overlay (the fixed, pointer-events:none wrapper)
  popup: HTMLElement;        // .export-popup
  head: HTMLElement;         // .export-popup-head (drag handle)
  isMobile: () => boolean;   // never float on the mobile bottom sheet
  freeLayout: boolean;       // canvas/chromeless - no sidebar to dock under; start floated
  /** The Design editor. No sidebar berth AND a right-hand column that is already the
   *  app's one right sidebar, so the sheet belongs in it from the first open. */
  editorLayout?: boolean;
  /** An ordinary canvas tool (Timezone, Darkroom, …). It HAS a sidebar berth, but the
   *  right side is being consolidated into the one edge-dock column like the Design editor
   *  (Andy, 2026-09-07), so the sheet defaults into that column on its first open too. A
   *  remembered placement still wins. */
  preferEdge?: boolean;
  /** The host's "the sheet just opened" signal; returns the unsubscribe. The remembered
   *  side is honoured HERE rather than at mount: this wiring runs while the sheet is
   *  still closed, and docking then would put a panel on screen nobody asked for. */
  onOpen?(cb: () => void): () => void;
}

export function wireExportPanelFloat(opts: ExportFloatOpts): () => void {
  const { popup, head, isMobile, freeLayout } = opts;
  const editorLayout = !!opts.editorLayout;
  const preferEdge = !!opts.preferEdge;
  let mode: Mode = 'docked';
  let box: Box | null = null;        // current floating box (viewport px)
  let restoreBox: Box | null = null; // box to return to when un-maximising
  /**
   * "The user keeps this sheet in the right sidebar." Remembered SEPARATELY from `mode`,
   * because closing the sheet undocks it (the popup has to be back in its overlay for
   * the host's `export-open` class to hide it), so `mode` forgets the chosen side after
   * a single close. Only a deliberate undock - a head drag out of the column, the dock
   * button, maximise - clears this; the host's close and the mobile-breakpoint guard
   * leave it standing.
   */
  let edgePref = false;
  /** Set for the length of one releaseDock call to mark that release as the user's own. */
  let userUndock = false;

  // ── persistence ──────────────────────────────────────────────────────────
  const save = (): void => {
    try { localStorage.setItem(KEY, JSON.stringify({ mode, box, edge: edgePref })); } catch { /* private mode */ }
  };
  const loadSaved = (): { mode: Mode; box: Box | null; edge?: boolean } | null => {
    try {
      const r = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (r && (r.mode === 'docked' || r.mode === 'floating' || r.mode === 'maximized' || r.mode === 'edge')) return r;
    } catch { /* corrupt */ }
    return null;
  };

  // ── geometry ─────────────────────────────────────────────────────────────
  const vw = (): number => window.innerWidth;
  const vh = (): number => window.innerHeight;
  /**
   * The horizontal span a FLOATING sheet may use, as [start, end] in viewport px.
   *
   * The one right sidebar (lib/edge-dock.ts) is chrome, not content: a sheet left to
   * rest under it is invisible and unreachable, which is exactly what a remembered box
   * did once the Design inspector took that column. The column always holds the
   * inline-end edge, which is the LEFT one in RTL. A sheet already docked in it takes
   * no band off itself.
   */
  const freeSpan = (): { x0: number; x1: number } => {
    const band = isDocked('export') ? 0 : edgeDockWidth();
    if (!(band > 0)) return { x0: 0, x1: vw() };
    // Never squeeze the sheet below its own minimum: on a narrow window the column keeps
    // the edge and the sheet overlaps what is left rather than collapsing to a sliver.
    const span = Math.max(MIN.w + MARGIN * 2, vw() - band);
    return document.documentElement.dir === 'rtl' ? { x0: vw() - span, x1: vw() } : { x0: 0, x1: span };
  };
  const clamp = (b: Box): Box => {
    const { x0, x1 } = freeSpan();
    const w = Math.min(Math.max(MIN.w, b.w), (x1 - x0) - MARGIN * 2);
    const h = Math.min(Math.max(MIN.h, b.h), vh() - MARGIN * 2);
    // Keep at least KEEP_VISIBLE px of the panel on screen in each axis.
    const x = Math.min(Math.max(x0 + KEEP_VISIBLE - w, b.x), x1 - KEEP_VISIBLE);
    const y = Math.min(Math.max(MARGIN, b.y), vh() - KEEP_VISIBLE);
    return { x, y, w, h };
  };
  // Pull the box FULLY inside the viewport. Used when the viewport itself changes
  // (resize) or on (re)open - a panel left hanging off an edge there reads as broken,
  // and the user can't always drag it back. Distinct from clamp(), which is lenient
  // by design so a user CAN tuck the panel to a KEEP_VISIBLE sliver while dragging.
  const clampFully = (b: Box): Box => {
    const { x0, x1 } = freeSpan();
    const w = Math.min(Math.max(MIN.w, b.w), (x1 - x0) - MARGIN * 2);
    const h = Math.min(Math.max(MIN.h, b.h), vh() - MARGIN * 2);
    const x = Math.min(Math.max(x0 + MARGIN, b.x), x1 - MARGIN - w);
    const y = Math.min(Math.max(MARGIN, b.y), vh() - MARGIN - h);
    return { x, y, w, h };
  };
  const currentRect = (): Box => {
    const r = popup.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  };
  const applyBox = (b: Box): void => {
    popup.style.left = `${Math.round(b.x)}px`;
    popup.style.top = `${Math.round(b.y)}px`;
    popup.style.width = `${Math.round(b.w)}px`;
    popup.style.height = `${Math.round(b.h)}px`;
  };
  const clearInline = (): void => {
    popup.style.left = popup.style.top = popup.style.width = popup.style.height = '';
  };

  // Wobbly-windows: the head-drag deforms this box, snaps kick it into new geometry.
  // Self-gating (no-op unless the flag is on and motion is allowed); wobble owns
  // `transform` only while live and clears it on settle - never the box's left/top.
  const wobble = attachWobble(popup);

  // ── mode transitions ─────────────────────────────────────────────────────
  const render = (): void => {
    popup.classList.toggle('is-floating', mode !== 'docked');
    popup.classList.toggle('is-maximized', mode === 'maximized');
    // "Dock to the side" means the sidebar berth where there is a sidebar, and the one
    // right-hand column where there is not - so in a free layout the button is offered
    // whenever the sheet is OUT of that column, and retired once it is in it.
    dockBtn.hidden = freeLayout ? mode === 'edge' : mode === 'docked';
    maxBtn.setAttribute('aria-pressed', mode === 'maximized' ? 'true' : 'false');
    maxBtn.setAttribute('aria-label', mode === 'maximized' ? 'Restore panel size' : 'Expand to full height');
    if (mode === 'docked' || isMobile()) { clearInline(); return; }
    if (mode === 'edge') return;   // the dock column owns the slot layout, not the box
    if (box) applyBox(box);
  };

  // ── edge dock (lib/edge-dock.ts) - drag to the inline-end edge to dock full-height ─
  // The column is SHARED, and it is the app's only right sidebar: the sheet takes a slot
  // beside whatever is already there (the Design inspector, the player, the transcript) -
  // stacked with two panels, tabbed past that. Taking a slot never evicts another panel,
  // which is why nothing here releases an id other than its own 'export'.
  // A small horizontal kick toward the docked edge (away from it on undock). RTL-aware.
  const towardEdge = (): number => (document.documentElement.dir === 'rtl' ? -1 : 1) * 16;
  const enterEdge = (): void => {
    if (mode === 'edge') return;
    const returnBox = clampFully(box ?? currentRect());
    // The label is VISIBLE text, not a tooltip: past two docked panels the column names
    // each one in its tab strip, so it goes through t() like every other word on screen.
    if (!requestDock('export', popup, { onRelease: exitEdgeToFloat, icon: icon('download'), label: t('Export') })) return;  // not desktop
    box = returnBox;   // remembered so undock re-floats where it was
    mode = 'edge';
    edgePref = true;
    render(); save();
    wobble.impulse(towardEdge(), 0);
  };
  // Called by releaseDock (drag-out, the mode buttons, teardown, or the mobile guard).
  const exitEdgeToFloat = (): void => {
    mode = 'floating';
    if (userUndock) edgePref = false;   // the user left; a host close or a breakpoint bounce did not
    userUndock = false;
    render(); save();
    wobble.impulse(-towardEdge(), 0);
  };
  /**
   * Out of the column before a mode that needs the sheet's own box. Without it the
   * popup stayed physically inside the column while its mode said otherwise, so
   * maximise and the dock button both left it stranded there.
   */
  const leaveEdge = (deliberate: boolean): void => {
    if (mode !== 'edge') return;
    userUndock = deliberate;
    releaseDock('export');   // fires exitEdgeToFloat
  };
  /** The host opened the sheet: put it back on the side the user keeps it on. */
  const restoreEdge = (): void => {
    if (isMobile() || mode === 'edge' || !edgePref) return;
    enterEdge();
  };
  const enterFloating = (from?: Box): void => {
    if (mode !== 'docked') return;
    mode = 'floating';
    box = clamp(from ?? currentRect());
    render(); save();
  };
  const dock = (): void => {
    // A free layout (the Design editor, canvas and chromeless tools) has NO berth under a
    // sidebar, because it has no sidebar. "The side" there is the app's one right-hand
    // column; sending the sheet to the berth's bottom-left anchor instead painted a
    // second left panel over the navigator, and persisted it (Andy, 2026-09-02).
    if (freeLayout) { enterEdge(); return; }
    leaveEdge(true);
    mode = 'docked'; box = null; restoreBox = null;
    render(); save();
    wobble.impulse(-16, 16);   // snap toward the bottom-left dock anchor
  };
  const toggleMax = (): void => {
    if (isMobile()) return;
    leaveEdge(true);           // a full-height column panel has no box to grow
    let kickY: number;
    if (mode === 'maximized') {
      box = restoreBox ? clamp(restoreBox) : clamp({ ...currentRect() });
      mode = 'floating'; restoreBox = null;
      kickY = -14;   // restore: a small kick up into the smaller box
    } else {
      const base = box ?? currentRect();
      restoreBox = { ...base };
      mode = 'maximized';
      // "Expand to the top of the screen": keep the left edge + width, take the full
      // height between the margins.
      box = clamp({ x: base.x, y: MARGIN, w: base.w, h: vh() - MARGIN * 2 });
      kickY = 18;    // maximize: a downward kick into the full-height box
    }
    render(); save();
    wobble.impulse(0, kickY);
  };

  // ── header: tool buttons + drag ──────────────────────────────────────────
  const mkBtn = (cls: string, glyph: string, label: string): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `export-popup-tool ${cls}`;
    b.innerHTML = glyph;   // glyph is a constant icon() string - no interpolation (R10)
    b.setAttribute('aria-label', label);
    b.title = label;
    return b;
  };
  const maxBtn = mkBtn('export-popup-max', icon('arrowsV'), 'Expand to full height');
  const dockBtn = mkBtn('export-popup-dock', icon('dock'), 'Dock to the side');
  dockBtn.hidden = true;
  // Group the tool buttons with the existing close button on the right of the head.
  const closeBtn = head.querySelector<HTMLElement>('.export-popup-close');
  const tools = document.createElement('span');
  tools.className = 'export-popup-tools';
  tools.append(maxBtn, dockBtn);
  if (closeBtn) head.insertBefore(tools, closeBtn), tools.append(closeBtn);
  else head.append(tools);
  maxBtn.addEventListener('click', toggleMax);
  dockBtn.addEventListener('click', dock);

  // Drag the header to move; the first drag off the dock floats the panel.
  // px/py anchor the box move (offset from grab start); lx/ly are the PREVIOUS pointer
  // position, so the wobble gets per-move deltas without changing how the box is placed.
  let drag: { px: number; py: number; lx: number; ly: number; b: Box; id: number } | null = null;
  const onHeadDown = (e: PointerEvent): void => {
    if (isMobile() || e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button')) return;   // let the head's buttons click
    leaveEdge(true);                                           // drag out of the column to undock, then move freely
    if (mode === 'docked') enterFloating();
    if (mode === 'maximized') toggleMax();                     // dragging a maximised panel restores it first
    drag = { px: e.clientX, py: e.clientY, lx: e.clientX, ly: e.clientY, b: { ...(box ?? currentRect()) }, id: e.pointerId };
    try { head.setPointerCapture(e.pointerId); } catch { /* stray pointer id */ }
    popup.classList.add('is-dragging');
    wobble.grab(e.clientX, e.clientY);
    e.preventDefault();
  };
  const onHeadMove = (e: PointerEvent): void => {
    if (!drag) return;
    box = clamp({ ...drag.b, x: drag.b.x + (e.clientX - drag.px), y: drag.b.y + (e.clientY - drag.py) });
    applyBox(box);
    wobble.drag(e.clientX - drag.lx, e.clientY - drag.ly);
    drag.lx = e.clientX; drag.ly = e.clientY;
    edgeDockPreview(edgeDockHitTest(e.clientX));   // light up the drop zone when near the edge
  };
  const onHeadUp = (e: PointerEvent): void => {
    if (!drag) return;
    try { if (head.hasPointerCapture(drag.id)) head.releasePointerCapture(drag.id); } catch { /* already released */ }
    const dropX = e.clientX;
    drag = null;
    popup.classList.remove('is-dragging');
    wobble.release();
    edgeDockPreview(false);
    if (edgeDockHitTest(dropX)) enterEdge();   // dropped in the zone: dock full-height
    else save();
  };
  head.addEventListener('pointerdown', onHeadDown);
  head.addEventListener('pointermove', onHeadMove);
  head.addEventListener('pointerup', onHeadUp);
  head.addEventListener('pointercancel', onHeadUp);

  // ── resize grips (only meaningful once floating) ─────────────────────────
  popup.insertAdjacentHTML('beforeend', panelGripsHtml());
  const gripsOff = wirePanelGrips(popup, {
    read: () => { if (mode === 'docked') enterFloating(); return box ?? currentRect(); },
    apply: (b) => { box = b; applyBox(b); },
    clamp,
    min: MIN,
    locked: () => isMobile() || mode === 'edge',   // the column's own grip sizes an edge-docked panel
    onEnd: () => { if (mode === 'maximized') mode = 'floating'; save(); },
  });

  // ── window resize + breakpoint changes ───────────────────────────────────
  const onResize = (): void => {
    if (mode === 'edge') return;   // edge-dock.ts owns the docked layout + the breakpoint undock
    if (mode === 'docked' || isMobile()) { clearInline(); return; }
    // A viewport change must never strand the panel off-screen: pull it FULLY back in
    // (clampFully), not merely to the lenient drag sliver.
    if (mode === 'maximized') box = clampFully({ x: (box ?? currentRect()).x, y: MARGIN, w: (box ?? currentRect()).w, h: vh() - MARGIN * 2 });
    else if (box) box = clampFully(box);
    render();
  };
  window.addEventListener('resize', onResize);

  // The right column opening is a viewport change as far as a floating sheet is
  // concerned: the band it may use just got narrower, and a fixed-position box does not
  // move on its own. Without this, opening the Design inspector left the sheet sitting
  // behind it. Guarded so the notification our OWN dock fires cannot re-enter.
  const offDockChange = onDockChange(() => {
    if (mode === 'edge' || isDocked('export') || drag || !box || isMobile()) return;
    box = clampFully(box);
    render();
  });

  // ── init: restore saved state, or start floated in a free layout ─────────
  const saved = loadSaved();
  // The remembered side survives the record that predates `edge` being persisted on its
  // own: back then a stored mode of 'edge' was the only trace of the user's choice.
  if (saved) edgePref = !!saved.edge || saved.mode === 'edge';
  if (saved && saved.mode !== 'docked' && saved.box) {
    // Reopen fully on-screen - the saved box may be from a larger window/monitor. A
    // panel that was edge-docked last session reopens FLOATING, not re-docked: the
    // float wiring runs at view mount while the panel may be closed, and forcing the
    // dock column open then would surface a panel the user never opened. `restoreEdge`
    // puts it back in the column on the first OPEN instead, which is the moment they
    // did ask for it. (S2 open decision in plans/151 - cross-view re-dock.)
    mode = saved.mode === 'edge' ? 'floating' : saved.mode;
    box = clampFully(saved.box); render();
  } else if (freeLayout && !saved) {
    // No sidebar to dock under → open floated, bottom-left over the stage…
    const w = Math.min(380, vw() - MARGIN * 2);
    const h = Math.min(Math.round(vh() * 0.66), vh() - MARGIN * 2);
    mode = 'floating'; box = clamp({ x: MARGIN, y: vh() - h - MARGIN, w, h }); render();
    // …except in the Design editor, which already has the one right sidebar on screen:
    // a second full-height sheet floating over the canvas beside it is the two-column
    // shape this whole wave removed, so the sheet joins that column on its first open.
    // The box above stands as where it goes if the user ever pulls it back out.
    if (editorLayout) edgePref = true;
  }
  // An ordinary canvas tool WITH a sidebar (Timezone, Darkroom, …) neither restores a saved
  // box nor starts floated, so it fell through to the sidebar berth. Consolidating the right
  // side (Andy, 2026-09-07): default it into the one right column on first open too, unless a
  // remembered placement (handled by `if (saved)` above) already spoke for the user.
  if (preferEdge && !saved) edgePref = true;
  const offOpen = opts.onOpen?.(restoreEdge) ?? null;

  return () => {
    offOpen?.();
    offDockChange();   // before the release below, so it cannot answer our own undock
    // If still edge-docked, put the popup back in its overlay BEFORE the view clears,
    // or it would be orphaned in the body-level dock column after unmount.
    if (isDocked('export')) releaseDock('export');
    gripsOff();
    head.removeEventListener('pointerdown', onHeadDown);
    head.removeEventListener('pointermove', onHeadMove);
    head.removeEventListener('pointerup', onHeadUp);
    head.removeEventListener('pointercancel', onHeadUp);
    window.removeEventListener('resize', onResize);
    wobble.dispose();
  };
}
