// SPDX-License-Identifier: MPL-2.0
/**
 * The two panes of the split layout and the divider between them.
 *
 * lib/layout-posture.ts decides WHETHER the shell is in split; this module decides
 * WHERE the panes meet. A view that has a two-pane arrangement mounts itself here
 * (`mountSplitView`) and gets, while split is active:
 *
 *   - custom properties on <html> its stylesheet places the panes with:
 *       --split-control  the control pane's width (book and flat) in CSS px;
 *       --split-gutter   the gap between the panes, which is the hinge on a fold;
 *       --split-top      the canvas pane's height on a tabletop fold;
 *     the properties exist only while a split view is mounted, so every other
 *     layout is byte-identical;
 *   - one divider element, a `role="separator"` drawn in the gutter. On a
 *     continuous screen it drags, and lets go onto the nearest of the snap points
 *     at a third, a half and two thirds of the width (a point that would leave a
 *     pane narrower than it can work in is skipped). Arrow keys step between the
 *     same points, Home and End go to the ends, Enter or a double tap centres the divider.
 *     On a reported fold it is locked to the hinge and has nothing to grab, so
 *     no control and no artwork ever straddles the crease;
 *   - a remembered ratio per view, on this device (`lolly-split`).
 *
 * The control pane sits away from the dominant hand (lib/hand-pref.ts): on the
 * left for a right-handed person, mirrored for a left-handed one, and mirrored
 * again in a right-to-left language because the panes follow the inline direction.
 * On a tabletop fold the canvas always takes the top half and the controls become
 * a touch deck below the canvas, whichever the hand.
 *
 * Continuity: nothing here re-mounts or re-parents a view. A fold, an unfold or a
 * rotation changes custom properties and attributes, the browser re-lays the same
 * nodes, and a focused field keeps its caret.
 */
import { t } from '../i18n.ts';
import { icon } from './icons.ts';
import { currentLayout, onLayoutChange } from './layout-posture.ts';
import type { LayoutState } from './layout-posture.ts';
import { currentHand, onHandChange, setHand } from './hand-pref.ts';
import type { HandHost } from './hand-pref.ts';

/** The snap points, as the control pane's share of the width the panes divide. */
export const SPLIT_SNAPS = [1 / 3, 1 / 2, 2 / 3] as const;
/** The narrowest control pane that still holds a row of controls at full size. */
export const MIN_CONTROL_PX = 256;
/** The narrowest canvas pane worth drawing into. */
export const MIN_CANVAS_PX = 240;
/** The gap between the panes on a continuous screen, and the least gap a gapless
 *  fold gets, so a pane's edge is never laid on the crease itself. */
export const GUTTER_PX = 16;
/** localStorage key: `{ [viewId]: ratio }`. */
export const SPLIT_STORE_KEY = 'lolly-split';
/** Sent on `window` after the panes moved, for chrome laid out in JS. */
export const SPLIT_CHANGE_EVENT = 'lolly:split-change';

const PROPS = ['--split-control', '--split-gutter', '--split-top'] as const;

export type SplitMode = 'columns' | 'stack';

/** Where the panes meet, in viewport CSS px. */
export interface SplitGeometry {
  mode: SplitMode;
  /** Locked to a fold: the divider does not move. */
  locked: boolean;
  /** The control pane's width (columns) or the deck's height (stack). */
  control: number;
  gutter: number;
  /** Columns: the canvas pane's width. Stack: the canvas pane's height. */
  canvas: number;
  /** The control pane is on the physical left (columns only). */
  controlLeft: boolean;
  /** The control share of the divisible width, for the separator's value. */
  ratio: number;
}

export interface GeometryInput {
  width: number;
  height: number;
  state: LayoutState;
  hand: 'left' | 'right';
  rtl: boolean;
  /** The remembered ratio for this view, if any. */
  ratio?: number | null;
}

/** The snap points that leave both panes room to work at this width. */
export function validSnaps(width: number, gutter = GUTTER_PX): number[] {
  const avail = width - gutter;
  return SPLIT_SNAPS.filter((r) => r * avail >= MIN_CONTROL_PX && (1 - r) * avail >= MIN_CANVAS_PX);
}

/** The snap point nearest a ratio, among the valid ones (the centre when none is). */
export function nearestSnap(ratio: number, width: number): number {
  const snaps = validSnaps(width);
  if (!snaps.length) return 1 / 2;
  return snaps.reduce((best, r) => (Math.abs(r - ratio) < Math.abs(best - ratio) ? r : best), snaps[0]!);
}

function clampControl(px: number, width: number, gutter: number): number {
  const max = Math.max(MIN_CONTROL_PX, width - gutter - MIN_CANVAS_PX);
  return Math.round(Math.min(max, Math.max(MIN_CONTROL_PX, px)));
}

/**
 * The geometry as a pure function: from the window, the layout state, the hand,
 * the direction and the remembered ratio.
 */
export function splitGeometry(i: GeometryInput): SplitGeometry {
  const { width, height, state } = i;
  const controlLeft = (i.hand === 'right') !== i.rtl;
  const fold = state.fold;
  if (state.posture === 'tabletop' && fold && state.orientation === 'horizontal') {
    const gutter = Math.max(fold.height, GUTTER_PX);
    const centre = fold.y + fold.height / 2;
    const top = Math.round(centre - gutter / 2);
    const deck = Math.round(height - centre - gutter / 2);
    return { mode: 'stack', locked: true, control: deck, gutter: Math.round(gutter), canvas: top, controlLeft, ratio: deck / Math.max(1, height - gutter) };
  }
  if (fold && state.orientation === 'vertical') {
    const gutter = Math.max(fold.width, GUTTER_PX);
    const centre = fold.x + fold.width / 2;
    const left = Math.round(centre - gutter / 2);
    const right = Math.round(width - centre - gutter / 2);
    const control = controlLeft ? left : right;
    return { mode: 'columns', locked: true, control, gutter: Math.round(gutter), canvas: controlLeft ? right : left, controlLeft, ratio: control / Math.max(1, width - gutter) };
  }
  const gutter = GUTTER_PX;
  const ratio = i.ratio && Number.isFinite(i.ratio) ? nearestSnap(i.ratio, width) : 1 / 2;
  const control = clampControl(ratio * (width - gutter), width, gutter);
  return { mode: 'columns', locked: false, control, gutter, canvas: width - gutter - control, controlLeft, ratio };
}

// ── The remembered ratio ─────────────────────────────────────────────────────

function loadRatios(): Record<string, number> {
  try {
    const v = JSON.parse(localStorage.getItem(SPLIT_STORE_KEY) || '{}') as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [k, r] of Object.entries(v ?? {})) if (typeof r === 'number' && r > 0 && r < 1) out[k] = r;
    return out;
  } catch { return {}; }
}

export function rememberedRatio(view: string): number | null {
  return loadRatios()[view] ?? null;
}

function rememberRatio(view: string, ratio: number): void {
  try {
    const all = loadRatios();
    all[view] = Math.round(ratio * 10000) / 10000;
    localStorage.setItem(SPLIT_STORE_KEY, JSON.stringify(all));
  } catch { /* private mode: the ratio lasts this session */ }
}

// ── The live view ────────────────────────────────────────────────────────────

export interface SplitViewOptions {
  /** The ratio memory key: one per view (`tool`, `design`, `assets`, `studio`). */
  id: string;
  /** Persists Swap sides through the profile. */
  host?: HandHost;
  /** The control pane is the edge dock (lib/edge-dock.ts), which Design's
   *  inspector, layers and export already live in as tabs. */
  dock?: boolean;
}

export interface SplitViewHandle {
  /** The geometry in force, or null outside split. */
  geometry(): SplitGeometry | null;
  /** A Swap sides button for the view's control pane header. `className` adds the
   *  view's own icon-button class, to match the buttons beside it in that header. */
  swapButton(className?: string): HTMLButtonElement;
  destroy(): void;
}

let active: { id: string; refresh: () => void; dock: boolean } | null = null;
let lastGeometry: SplitGeometry | null = null;

/** Does the split view on screen use the edge dock (lib/edge-dock.ts) as its
 *  control pane? Design does; a tool with its own sidebar does not. */
export function splitUsesDock(): boolean {
  return !!active?.dock;
}

/** The geometry of the split view on screen, or null. For chrome laid out in JS
 *  (the edge dock takes the control pane's width from here). */
export function activeSplitGeometry(): SplitGeometry | null {
  return active ? lastGeometry : null;
}

function isRtl(): boolean {
  return document.documentElement.dir === 'rtl';
}

function clearProps(): void {
  const root = document.documentElement;
  for (const p of PROPS) root.style.removeProperty(p);
  if (root.getAttribute('style') === '') root.removeAttribute('style');
}

/**
 * Mount a view's two panes. Safe to call outside split: it waits, and lays the
 * panes out the moment the layout becomes split. Returns the handle; destroy() on
 * the view's teardown.
 */
export function mountSplitView(opts: SplitViewOptions): SplitViewHandle {
  const { id } = opts;
  const root = document.documentElement;
  let destroyed = false;
  let geom: SplitGeometry | null = null;
  let dragRatio: number | null = null;
  const swaps = new Set<HTMLButtonElement>();

  const divider = document.createElement('div');
  divider.className = 'split-divider';
  divider.setAttribute('role', 'separator');
  divider.setAttribute('aria-label', t('Resize panes'));
  divider.setAttribute('aria-valuemin', '0');
  divider.setAttribute('aria-valuemax', '100');
  divider.dataset.canvasKeys = 'off';
  const grip = document.createElement('span');
  grip.className = 'split-divider-grip';
  grip.setAttribute('aria-hidden', 'true');
  divider.append(grip);

  const write = (g: SplitGeometry): void => {
    root.style.setProperty('--split-control', `${g.control}px`);
    root.style.setProperty('--split-gutter', `${g.gutter}px`);
    if (g.mode === 'stack') root.style.setProperty('--split-top', `${g.canvas}px`);
    else root.style.removeProperty('--split-top');
    divider.dataset.mode = g.mode;
    divider.toggleAttribute('data-locked', g.locked);
    divider.setAttribute('aria-orientation', g.mode === 'stack' ? 'horizontal' : 'vertical');
    // A locked divider is the hinge: it is drawn as a gap and is not a control.
    if (g.locked) {
      divider.removeAttribute('tabindex');
      divider.setAttribute('aria-hidden', 'true');
    } else {
      divider.tabIndex = 0;
      divider.removeAttribute('aria-hidden');
      const pct = Math.round(g.ratio * 100);
      divider.setAttribute('aria-valuenow', String(pct));
      divider.setAttribute('aria-valuetext', `${pct}%`);
    }
    // The divider is placed in physical px, so it meets the hinge exactly in either direction.
    const x = g.controlLeft ? g.control : g.canvas;
    divider.style.setProperty('--split-divider-x', `${x}px`);
    divider.style.setProperty('--split-divider-y', `${g.canvas}px`);
  };

  // From the document's own window (a jsdom test host keeps Node's global Event).
  const notify = (): void => {
    const view = document.defaultView;
    view?.dispatchEvent(new view.Event(SPLIT_CHANGE_EVENT));
  };
  // Swap sides is offered only where there are sides: two columns, not a tabletop deck.
  const paintSwaps = (): void => { for (const b of swaps) b.hidden = !geom || geom.mode === 'stack'; };

  const refresh = (): void => {
    if (destroyed) return;
    const state = currentLayout();
    if (state.layout !== 'split') {
      if (geom) {
        geom = null;
        lastGeometry = null;
        divider.remove();
        clearProps();
        paintSwaps();
        notify();
      }
      return;
    }
    const next = splitGeometry({
      width: window.innerWidth, height: window.innerHeight, state,
      hand: currentHand(), rtl: isRtl(),
      ratio: dragRatio ?? rememberedRatio(id),
    });
    geom = next;
    lastGeometry = next;
    write(next);
    if (!divider.isConnected) document.body.append(divider);
    paintSwaps();
    notify();
  };

  // ── Drag ────────────────────────────────────────────────────────────────
  let dragging = false;
  let frame = 0;
  let pendingX = 0;
  const applyDrag = (): void => {
    frame = 0;
    if (!geom || geom.locked) return;
    const width = window.innerWidth;
    const control = geom.controlLeft ? pendingX - geom.gutter / 2 : width - pendingX - geom.gutter / 2;
    const px = clampControl(control, width, geom.gutter);
    const ratio = px / (width - geom.gutter);
    // While the finger is down the pane follows it exactly; the snap waits for the release.
    const live: SplitGeometry = { ...geom, control: px, canvas: width - geom.gutter - px, ratio };
    geom = live;
    lastGeometry = live;
    write(live);
    notify();
  };
  divider.addEventListener('pointerdown', (e) => {
    if (!geom || geom.locked || e.button !== 0) return;
    dragging = true;
    divider.classList.add('is-dragging');
    root.classList.add('is-split-dragging');
    try { divider.setPointerCapture(e.pointerId); } catch { /* a stray pointer id */ }
    e.preventDefault();
  });
  divider.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    pendingX = e.clientX;
    if (!frame) frame = requestAnimationFrame(applyDrag);
  });
  const settle = (ratio: number): void => {
    const snap = nearestSnap(ratio, window.innerWidth);
    dragRatio = null;
    rememberRatio(id, snap);
    refresh();
  };
  const endDrag = (e: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    if (frame) { cancelAnimationFrame(frame); frame = 0; applyDrag(); }
    divider.classList.remove('is-dragging');
    root.classList.remove('is-split-dragging');
    try { if (divider.hasPointerCapture(e.pointerId)) divider.releasePointerCapture(e.pointerId); } catch { /* released */ }
    if (geom && !geom.locked) settle(geom.ratio);
  };
  divider.addEventListener('pointerup', endDrag);
  divider.addEventListener('pointercancel', endDrag);
  divider.addEventListener('dblclick', () => { if (geom && !geom.locked) settle(1 / 2); });

  // ── Keys: step between the snap points ──────────────────────────────────
  divider.addEventListener('keydown', (e) => {
    if (!geom || geom.locked || e.metaKey || e.ctrlKey || e.altKey) return;
    const snaps = validSnaps(window.innerWidth);
    if (!snaps.length) return;
    const here = nearestSnap(geom.ratio, window.innerWidth);
    const i = snaps.indexOf(here);
    // The arrow is the way the divider moves on screen. Moving the divider towards the
    // control pane narrows the controls.
    const towardsControls = geom.controlLeft ? 'ArrowLeft' : 'ArrowRight';
    const awayFromControls = geom.controlLeft ? 'ArrowRight' : 'ArrowLeft';
    let next: number | undefined;
    if (e.key === towardsControls) next = snaps[Math.max(0, i - 1)];
    else if (e.key === awayFromControls) next = snaps[Math.min(snaps.length - 1, i + 1)];
    else if (e.key === 'Home') next = snaps[0];
    else if (e.key === 'End') next = snaps[snaps.length - 1];
    else if (e.key === 'Enter' || e.key === ' ') next = 1 / 2;
    else return;
    e.preventDefault();
    settle(next ?? here);
  });

  // ── Follow the layout, the hand, the direction and the window ───────────
  const offLayout = onLayoutChange(refresh);
  const offHand = onHandChange(refresh);
  const onResize = (): void => { refresh(); };
  window.addEventListener('resize', onResize);
  const dirWatch = typeof MutationObserver === 'function' ? new MutationObserver(refresh) : null;
  dirWatch?.observe(root, { attributes: true, attributeFilter: ['dir'] });

  active = { id, refresh, dock: !!opts.dock };
  refresh();

  return {
    geometry: () => geom,
    swapButton(className = ''): HTMLButtonElement {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `split-swap${className ? ` ${className}` : ''}`;
      const label = t('Swap sides');
      b.setAttribute('aria-label', label);
      b.dataset.tip = label;
      // The one raw-markup sink here: a fixed registry glyph, nothing interpolated.
      b.innerHTML = icon('arrowsH');
      b.hidden = !geom || geom.mode === 'stack';
      b.addEventListener('click', () => {
        const next = currentHand() === 'left' ? 'right' : 'left';
        if (opts.host) void setHand(opts.host, next);
        else import('./hand-pref.ts').then((m) => m.applyHand(next)).catch(() => {});
      });
      swaps.add(b);
      return b;
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      offLayout();
      offHand();
      window.removeEventListener('resize', onResize);
      dirWatch?.disconnect();
      if (frame) cancelAnimationFrame(frame);
      root.classList.remove('is-split-dragging');
      divider.remove();
      for (const b of swaps) b.remove();
      swaps.clear();
      if (active?.id === id) { active = null; lastGeometry = null; clearProps(); notify(); }
    },
  };
}
