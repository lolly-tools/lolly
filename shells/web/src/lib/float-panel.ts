// SPDX-License-Identifier: MPL-2.0
/**
 * Pop an in-flow element out into a floating panel you can move, resize from any
 * edge or corner, and take fullscreen - then put it back exactly where it was.
 *
 * The visualizer's panel (components/viz-overlay.ts) does something similar with
 * the native CSS `resize` corner, which is one corner and gives no events. This
 * gives eight grips and reports every change, because the things it carries are
 * canvases that must repaint at their new size.
 *
 * ## The layout rule this is built around
 *
 * The elements that pop out here are LAYOUT-BEARING: they are figures in the
 * middle of a scrolling report, and lifting one out of the flow would collapse
 * the page under the reader's cursor and move everything they were looking at.
 * So popping out leaves a PLACEHOLDER pinned to the exact measured box the
 * element occupied, carrying the button that puts it back. Nothing reflows on
 * the way out and nothing reflows on the way back - the panel is the only thing
 * that moved.
 *
 * That is also why the placeholder's size is captured in pixels rather than left
 * to the CSS: the element's own rules (an `aspect-ratio`, a grid track) no longer
 * apply to a box with nothing in it, so re-deriving the size would give a
 * different answer than the one on screen.
 */

import './float-panel.css';
import { panelGripsHtml, wirePanelGrips } from './panel-grips.ts';
import { attachWobble } from './wobble.ts';

const MIN_W = 240;
const MIN_H = 160;
/** How much of the panel must stay on screen, so it can always be grabbed back. */
const KEEP_VISIBLE = 64;

export interface FloatPanelOpts {
  /** Panel title, shown in the drag bar. */
  title: string;
  /** Preferred editor size; omitted for aspect-preserving figures. */
  initialSize?: { width: number; height: number };
  /** Called after any move, resize or fullscreen change - repaint here. */
  onResize?: () => void;
  /** Called when the panel closes and the element is back in place. */
  onClose?: () => void;
  /** Restore-button label for the placeholder. Defaults to "Put back". */
  restoreLabel?: string;
  /**
   * Where the panel element is appended. Defaults to `<body>`.
   *
   * Worth passing, and the reason is a bug this cost: a view that queries its own
   * DOM through a scoped root (`view.querySelector`, which is the pattern in this
   * codebase) STOPS FINDING the popped-out element the moment it lands on the
   * body - so its repaints, its labels and its controls all silently address
   * nothing, while the panel sits there looking fine. Mounting inside the view
   * keeps one root. `position: fixed` still lifts it out of the flow wherever it
   * lives, PROVIDED no ancestor creates a containing block for fixed (a
   * transform, filter, backdrop-filter, contain or container-type) - check that
   * before choosing a container, because the failure is a panel that scrolls with
   * the page instead of floating over it.
   */
  mount?: HTMLElement;
}

export interface FloatPanel {
  /** Put the element back and remove the panel. Safe to call twice. */
  close(): void;
  readonly root: HTMLElement;
}

/**
 * Lift `el` into a floating panel. Returns null if it is already floating - the
 * caller can treat that as "already open" rather than having to track state.
 */
export function popOut(el: HTMLElement, opts: FloatPanelOpts): FloatPanel | null {
  if (el.dataset.floating) return null;
  const doc = el.ownerDocument;
  const box = el.getBoundingClientRect();

  // The placeholder goes in FIRST, at the measured size, so the document's height
  // never changes - insert-then-move, not move-then-insert. The other order drops
  // the page by the figure's height for one frame, and on a phone that is a
  // visible jump of most of a screen.
  const slot = doc.createElement('div');
  slot.className = 'floatp-slot';
  slot.style.width = `${box.width}px`;
  slot.style.height = `${box.height}px`;
  slot.innerHTML = `<button type="button" class="floatp-restore" data-floatp-restore>${
    escapeText(opts.restoreLabel ?? 'Put back')}</button>`;
  el.after(slot);

  const root = doc.createElement('div');
  root.className = 'floatp';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', opts.title);
  root.innerHTML = `
    <div class="floatp-bar" data-floatp-drag>
      <span class="floatp-title">${escapeText(opts.title)}</span>
      <span class="floatp-acts">
        <button type="button" class="floatp-btn" data-floatp-full aria-label="Fullscreen">⤢</button>
        <button type="button" class="floatp-btn" data-floatp-close aria-label="Put back">✕</button>
      </span>
    </div>
    <div class="floatp-body" data-floatp-body></div>
    ${panelGripsHtml()}`;
  root.querySelector('[data-floatp-body]')!.appendChild(el);
  el.dataset.floating = '1';
  (opts.mount ?? doc.body).appendChild(root);

  // Opens BIGGER than it was, and centred.
  //
  // Opening at the measured box was the obvious thing and it is wrong: you pop a
  // figure out because it is too small, so a panel that reproduces its size at the
  // same place does nothing you can see. On a phone this is the whole feature - 
  // the target is the viewport less a margin, which is effectively fullscreen, and
  // that is the point rather than an accident of the clamp.
  //
  // The element's own aspect is preserved to fit, so a chart drawn 8:5 does not
  // arrive letterboxed inside a panel of some other shape.
  const vw = doc.documentElement.clientWidth;
  const vh = doc.documentElement.clientHeight;
  const margin = vw < 640 ? 16 : 48;
  const wantW = Math.min(vw - margin * 2, opts.initialSize?.width ?? Math.max(box.width * 1.6, 560));
  const ratio = box.width > 0 && box.height > 0 ? box.height / box.width : 0.625;
  const wantH = Math.min(vh - margin * 2, Math.max(opts.initialSize?.height ?? wantW * ratio, MIN_H));
  apply(root, fit({
    x: (vw - wantW) / 2,
    y: Math.max(margin, (vh - wantH) / 2),
    w: wantW,
    h: wantH,
  }, doc));

  const notify = (): void => opts.onResize?.();
  let closed = false;

  const cleanups: Array<() => void> = [];
  const on = <K extends keyof HTMLElementEventMap>(
    t: EventTarget, ev: K | string, fn: (e: never) => void, o?: AddEventListenerOptions,
  ): void => {
    t.addEventListener(ev, fn as EventListener, o);
    cleanups.push(() => t.removeEventListener(ev, fn as EventListener, o));
  };

  function close(): void {
    if (closed) return;
    closed = true;
    for (const c of cleanups) c();
    if (doc.fullscreenElement === root) void doc.exitFullscreen?.().catch(() => { /* already gone */ });
    delete el.dataset.floating;
    // Back before the placeholder, then remove it - again so the height is never
    // momentarily wrong.
    slot.before(el);
    slot.remove();
    root.remove();
    opts.onClose?.();
    notify();
  }

  on(root, 'click', (e: MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-floatp-close]')) { close(); return; }
    if (t.closest('[data-floatp-full]')) {
      if (doc.fullscreenElement === root) void doc.exitFullscreen?.().catch(() => { /* denied */ });
      else void root.requestFullscreen?.().catch(() => { /* denied - stays windowed */ });
    }
  });
  on(slot, 'click', (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-floatp-restore]')) close();
  });
  // Escape closes, the same as every other overlay in this app. Captured on the
  // document rather than the panel: focus is usually inside the figure, and after
  // a drag it can be on the body.
  on(doc, 'keydown', (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || closed) return;
    if (doc.fullscreenElement === root) return;   // let fullscreen take it first
    e.stopPropagation();
    close();
  }, { capture: true });
  on(doc, 'fullscreenchange', () => notify());

  cleanups.push(wireDrag(root, doc, notify, on));
  cleanups.push(wirePanelGrips(root, {
    read: () => read(root),
    apply: b => apply(root, b),
    clamp: b => fit(b, doc),
    min: { w: MIN_W, h: MIN_H },
    locked: () => doc.fullscreenElement === root,
    onMove: notify,
    onEnd: notify,
  }));

  // A window resize can leave the panel off screen (a rotated phone, a shrunk
  // window). Re-fit rather than leaving it unreachable.
  on(window, 'resize', () => {
    if (doc.fullscreenElement === root) return;
    const box = fit(read(root), doc);
    // Rotation/window resizing should bring the whole editor back into view.
    // Dragging still permits a partially offscreen panel via fit().
    box.x = Math.max(0, Math.min(box.x, doc.documentElement.clientWidth - box.w));
    box.y = Math.max(0, Math.min(box.y, doc.documentElement.clientHeight - box.h));
    apply(root, box);
    notify();
  });

  notify();
  return { close, root };
}

interface Box { x: number; y: number; w: number; h: number }

const read = (root: HTMLElement): Box => ({
  x: root.offsetLeft, y: root.offsetTop, w: root.offsetWidth, h: root.offsetHeight,
});

function apply(root: HTMLElement, b: Box): void {
  root.style.left = `${Math.round(b.x)}px`;
  root.style.top = `${Math.round(b.y)}px`;
  root.style.width = `${Math.round(b.w)}px`;
  root.style.height = `${Math.round(b.h)}px`;
}

/**
 * Keep the panel usable: never smaller than the minimum, never bigger than the
 * viewport, and never dragged so far that there is nothing left to grab.
 */
function fit(b: Box, doc: Document): Box {
  const vw = doc.documentElement.clientWidth;
  const vh = doc.documentElement.clientHeight;
  const w = Math.min(Math.max(b.w, MIN_W), vw);
  const h = Math.min(Math.max(b.h, MIN_H), vh);
  return {
    w,
    h,
    x: Math.min(Math.max(b.x, KEEP_VISIBLE - w), vw - KEEP_VISIBLE),
    y: Math.min(Math.max(b.y, 0), vh - KEEP_VISIBLE),   // never above the top: the bar must stay reachable
  };
}

type On = <K extends keyof HTMLElementEventMap>(
  t: EventTarget, ev: K | string, fn: (e: never) => void, o?: AddEventListenerOptions,
) => void;

function wireDrag(root: HTMLElement, doc: Document, notify: () => void, on: On): () => void {
  const bar = root.querySelector<HTMLElement>('[data-floatp-drag]');
  // Wobbly-windows: the bar-drag deforms root, the fit() clamp snaps it into geometry.
  // Self-gating (no-op unless the flag is on and motion is allowed); wobble owns
  // `transform` only while live and clears it on settle - never root's left/top.
  const wobble = attachWobble(root);
  if (!bar) return () => wobble.dispose();
  // px/py anchor the box move; lx/ly are the PREVIOUS pointer position, so the wobble
  // gets per-move deltas without changing how the box is placed.
  let from: { px: number; py: number; lx: number; ly: number; b: Box } | null = null;
  on(bar, 'pointerdown', (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;   // the bar's own controls
    if (doc.fullscreenElement === root) return;                // nowhere to move
    from = { px: e.clientX, py: e.clientY, lx: e.clientX, ly: e.clientY, b: read(root) };
    bar.setPointerCapture(e.pointerId);
    root.classList.add('is-dragging');
    wobble.grab(e.clientX, e.clientY);
    e.preventDefault();
  });
  on(bar, 'pointermove', (e: PointerEvent) => {
    if (!from) return;
    apply(root, fit({ ...from.b, x: from.b.x + (e.clientX - from.px), y: from.b.y + (e.clientY - from.py) }, doc));
    wobble.drag(e.clientX - from.lx, e.clientY - from.ly);
    from.lx = e.clientX; from.ly = e.clientY;
  });
  const end = (e: PointerEvent): void => {
    if (!from) return;
    from = null;
    root.classList.remove('is-dragging');
    if (bar.hasPointerCapture(e.pointerId)) bar.releasePointerCapture(e.pointerId);
    wobble.release();
    notify();
  };
  on(bar, 'pointerup', end);
  on(bar, 'pointercancel', end);
  return () => wobble.dispose();
}

/** Text into markup. Local rather than imported so this primitive has no deps. */
function escapeText(s: string): string {
  return s.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}
