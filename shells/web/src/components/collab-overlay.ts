// SPDX-License-Identifier: MPL-2.0
/**
 * collab-overlay - the remote x/y cursor layer (plan 100 section 4.3, section 4.6, section 4.8, section 11.14).
 *
 * A cursor is the ONE presence primitive that moves, and it is the only one that
 * costs a frame loop. Everything about this module is shaped by that: it runs a
 * single rAF ticker, only while at least one remote cursor is live, and it paints
 * into a layer that is a SIBLING of the canvas stage - never a child. The tool's
 * render is untouched, byte for byte, which is the section 4.6 rule ("presence chrome
 * never goes inside `.tool-canvas`/`#tool-content` or any export stage"): a
 * collaborator's cursor must not be able to change what a PNG comes out looking
 * like, and an overlay that lives outside the stage cannot.
 *
 * COORDINATES ARE NORMALIZED, NOT PIXELS (section 4.3). A peer broadcasts `cursor` as
 * 0..1 of the design's unit space, so a phone at 0.4× and a desktop at 2× paint the
 * same point on the same artwork. The mapping is one multiply through the STAGE's
 * live rect, re-read each tick, then rebased into the layer's own coordinate space
 * - so a zoom, a scroll or a sidebar resize needs no invalidation protocol at all.
 *
 * THE RENDER-LOOP DISCIPLINE IS BORROWED, THE DEPENDENCY IS NOT (section 11.14, Andy
 * 2026-08-09 - "worth learning from the pixijs.com folks"). Four rules, all of them
 * cheap and all of them essential:
 *
 *   1. ONE TICKER for every peer, not one per cursor. A frame measures the two
 *      rects ONCE and then writes N transforms.
 *   2. POOLED NODES. A peer that leaves returns its node to a free list; the next
 *      peer to arrive takes that same node back. A roster that churns - the normal
 *      pattern of a session where people come and go - allocates nothing after the
 *      first few joins, and never leaves detached nodes for the GC to sweep mid-drag.
 *   3. INTERPOLATE, NEVER EXTRAPOLATE (section 4.3, stated in the plan as a rule). The
 *      ticker renders the segment BETWEEN the last two samples, one sample-interval
 *      behind live. Extrapolation is what produces the rubber-band overshoot that
 *      makes a cursor look drunk when a frame is dropped, and the presence lane
 *      drops frames by construction (`maxRetransmits: 0`).
 *   4. TRANSFORM ONLY. Position is `translate3d`, so a moving cursor is a compositor
 *      job that never invalidates layout, never reflows the sidebar, and never
 *      touches the tool render beneath.
 *
 * WHEN IT STOPS. The ticker is not a heartbeat - it exists only while something is
 * moving, and "moving" is measured, not assumed: a frame re-arms only while some
 * peer still has a segment left to walk between its last two samples. A peer who
 * parks their pointer is painted at rest and the loop stands down, so a live roster
 * costs nothing once nobody is moving. It also stands down when the roster empties,
 * when every peer's cursor goes away, and (for free) when the tab is hidden, because
 * rAF simply stops being called. That last one matters: a backgrounded helper's tab
 * must cost nothing, and a timer-driven loop would keep burning.
 *
 * REDUCED MOTION (section 4.8). `prefersReducedMotion()` does not slow the cursor down, it
 * removes the moving thing entirely: no ticker is started at all, and each peer is
 * drawn as a STATIC dot at its newest sample, repainted only when a frame actually
 * arrives. A user who asked for less motion should not be handed six drifting
 * arrows; they still get to see where everyone is.
 *
 * NAMES ARE UNTRUSTED (section 11.21/section 11.23). A display name arrives over the wire from a
 * peer, so it is written with `textContent` and never interpolated into markup.
 *
 * IT CARRIES ITS OWN STYLESHEET, injected into `<head>` on first mount - the
 * `music-player.ts`/`neuro-dock.ts`/`collab-pill.ts` pattern for lazy chrome that
 * must cost a single-player build nothing. `styles/parts/collab.css` deliberately
 * owns only the `.collab-tile-*` family and says so in its own header: a shared
 * `parts/*.css` rule using one of these bare class names would be silently inert
 * wherever this component is mounted (an unlayered injected sheet beats every
 * `@layer`), and confusingly duplicate it everywhere else. So `.collab-canvas-layer`,
 * `.collab-cursor`, `.collab-cursor-arrow` and `.collab-cursor-label` are defined
 * below and nowhere else. The per-collaborator hue rides the `--collab-color` custom
 * property; every glyph size is `calc(<px> * var(--a11y-fs))`; RTL rides logical
 * properties. What stays INLINE is position rather than paint: the layer's
 * `position/inset/pointer-events` (a layer whose sheet somehow did not land must not
 * become a full-page click shield), the ticker's `transform`, and the still-mode
 * silhouette below.
 */

import { prefersReducedMotion } from '../lib/a11y-prefs.ts';

// ── Stylesheet (see the header: this module owns these classes outright) ───────

const STYLE_ID = 'lolly-collab-overlay-css';

const CSS = `
/* The shared presence layer - a SIBLING of the render surface, never a child
   (section 4.6). z-index 15 puts it over the canvas and under the stage HUD (z 20). */
.collab-canvas-layer {
  position: absolute;
  inset: 0;
  z-index: 15;
  pointer-events: none;
  /* Never clip: a cursor or a focus label at the artboard's edge is framed by the
     stage the user can see, not by this layer's box. */
  overflow: visible;
}

/* ── Remote cursor ────────────────────────────────────────────────────────── */
.collab-cursor {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
  display: flex;
  align-items: flex-start;
  gap: calc(2px * var(--a11y-fs));
  pointer-events: none;
  /* Position is written as translate3d by the ticker (rule 4) - promoted so a
     moving cursor is a compositor job and never a reflow. NO transition: the
     interpolator IS the smoothing, and tweening on top of it would lag the
     cursor a second time. */
  will-change: transform;
}
/* An author \`display\` beats the UA sheet's \`[hidden] { display: none }\`, and a
   released node is hidden before it is pooled. */
.collab-cursor[hidden] { display: none; }

/* The arrow silhouette: one painted box in the collaborator's colour, clipped to
   a pointer. The halo is a doubled drop-shadow in the theme's card ground rather
   than a border, so it follows the clip path instead of the box (section 4.4 - a cursor
   must stay legible over artwork that happens to share its hue). */
.collab-cursor-arrow {
  flex: none;
  width: calc(13px * var(--a11y-fs));
  height: calc(19px * var(--a11y-fs));
  background: var(--collab-color, hsl(var(--primary)));
  clip-path: polygon(0 0, 0 78%, 24% 60%, 42% 100%, 60% 92%, 42% 55%, 74% 52%);
  filter: drop-shadow(0 0 1px hsl(var(--card))) drop-shadow(0 0 1px hsl(var(--card)));
}
/* Reduced motion (section 4.8): the same painted box, squared off into a dot. The two
   inline properties setStill() writes drop the clip path and round the corners;
   this rule is only the SIZE, which an inline style cannot express in a11y-fs. */
.collab-cursor--still .collab-cursor-arrow {
  width: calc(11px * var(--a11y-fs));
  height: calc(11px * var(--a11y-fs));
  margin-block-start: calc(4px * var(--a11y-fs));
}

/* The name, so a cursor is never colour alone (section 4.8). Fixed ink on the
   collaborator's ground for the same reason collab-pill.ts's .collab-av uses one:
   COLLAB_BAND projects every hue into one OKLCH lightness/chroma calibrated for
   APCA contrast against that ink, in both themes. */
.collab-cursor-label {
  flex: none;
  max-width: 14ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-block-start: calc(12px * var(--a11y-fs));
  padding: calc(2px * var(--a11y-fs)) calc(6px * var(--a11y-fs));
  border-radius: 999px;
  background: var(--collab-color, hsl(var(--primary)));
  color: hsl(222 47% 8%);
  font-size: calc(10.5px * var(--a11y-fs));
  font-weight: 700;
  line-height: 1.45;
  box-shadow: 0 0 0 1px hsl(var(--card));
}
/* A peer who chose no name yet gets no empty pill trailing their cursor. */
.collab-cursor-label:empty { display: none; }`;

/**
 * Inject the sheet once per document. Idempotent by element id, so N mounted
 * layers (and the focus module borrowing this one) share a single `<style>`.
 */
export function ensureOverlayStyles(doc: Document | null | undefined): void {
  const d = doc ?? (typeof document !== 'undefined' ? document : null);
  if (!d || d.getElementById(STYLE_ID)) return;
  const style = d.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  d.head.appendChild(style);
}

// ── Geometry ──────────────────────────────────────────────────────────────────

/** The slice of a DOMRect this module reads. Structural so a test can hand over a
 *  plain object - jsdom's `getBoundingClientRect` is all zeros, which would make
 *  every mapping assertion vacuously true. */
export interface RectLike {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * A normalized unit-space point mapped into the overlay layer's coordinate space.
 *
 * Two rects, because the layer is a sibling of the stage rather than a wrapper:
 * `stage` is what unit space scales through, `layer` is what the resulting pixel
 * offset is measured FROM. When the layer happens to cover the stage exactly the
 * rebasing term is zero and this is a bare multiply.
 */
export function mapUnitPoint(x: number, y: number, stage: RectLike, layer: RectLike): { x: number; y: number } {
  return {
    x: (stage.left - layer.left) + x * stage.width,
    y: (stage.top - layer.top) + y * stage.height,
  };
}

/** One presence sample: a unit-space point and the engine-clock ms it landed. */
export interface CursorSample {
  readonly x: number;
  readonly y: number;
  readonly t: number;
}

/**
 * A gap this long between two samples means the peer went quiet (a tab switch, a
 * `disconnected` ICE blip, a laptop lid) rather than moved slowly. Gliding across it
 * would draw a long confident sweep the user never made, so the cursor SNAPS.
 *
 * 500 ms is ten send-throttle windows (section 4.7's 50 ms), so it can never fire on
 * ordinary jitter; anything shorter is smoothed, anything longer was a real absence.
 */
export const CURSOR_SNAP_GAP_MS = 500;

/**
 * Where to draw a peer's cursor right now - the segment between the last two
 * samples, rendered ONE sample-interval behind live.
 *
 * The lag is the whole trick and it is deliberate. If `u` were `(t - prev.t)/dur`
 * the interpolator would already be AT `next` the instant `next` arrived, and the
 * only way to keep moving after that is to extrapolate - which is exactly the rule
 * section 4.3 forbids. Anchoring the window at `next.t` instead means a freshly arrived
 * sample starts the glide at `prev` and reaches `next` one interval later, so the
 * cursor is always drawing a segment it has both ends of. The cost is ~50 ms of
 * apparent latency, which is far below what a viewer reads as lag and far above what
 * a stutter costs.
 *
 * Pure and exported: the monotonicity property is worth asserting without a DOM.
 */
export function cursorPosition(
  prev: CursorSample | null,
  next: CursorSample,
  t: number,
  snapMs: number = CURSOR_SNAP_GAP_MS,
): { x: number; y: number } {
  if (!prev) return { x: next.x, y: next.y };
  const dur = next.t - prev.t;
  // A non-positive interval (two samples in one clock tick, or a clock that stepped
  // back) has no segment to walk, and a long one was an absence, not a movement.
  if (!(dur > 0) || dur > snapMs) return { x: next.x, y: next.y };
  const u = Math.min(1, Math.max(0, (t - next.t) / dur));
  return { x: prev.x + (next.x - prev.x) * u, y: prev.y + (next.y - prev.y) * u };
}

// ── The layer ─────────────────────────────────────────────────────────────────

/** What a mounted overlay layer hands back - the element, and the exact undo. */
export interface OverlayLayer {
  readonly el: HTMLElement;
  readonly host: HTMLElement;
  unmount(): void;
}

/** The overlay layer class this module's sheet defines (z-index 15, under the
 *  stage HUD, over the canvas). Both presence layers use it. */
export const CANVAS_LAYER_CLASS = 'collab-canvas-layer';

/**
 * Mount an absolutely-positioned overlay layer as a SIBLING of `stage`.
 *
 * The containment check is not defensive programming for its own sake - it is the
 * section 4.6 invariant made unbypassable. A caller that passes the canvas itself as the
 * host (an easy mistake: `#tool-canvas` is the element everything else in the tool
 * view is measured from) would put presence chrome inside the export stage, and the
 * damage would show up as a diff in an exported PNG rather than as an error. So the
 * host is walked OUT of the stage instead of trusted, and a stage with no parent at
 * all gets no overlay rather than an overlay in the wrong place.
 *
 * With no host given the preference is `.tool-stage` over the canvas's immediate
 * parent, matching what the sheet below assumes ("a dedicated sibling layer over
 * `.tool-stage`") - and it is the better anchor on its own merits: the intervening
 * `.tool-canvas-outer` is `overflow: hidden`, so a cursor near the artboard's edge
 * would be clipped by the wrapper rather than by the stage the user can see.
 */
export function mountOverlayLayer(
  stage: HTMLElement,
  host: HTMLElement | null | undefined,
  className: string = CANVAS_LAYER_CLASS,
  doc: Document = stage.ownerDocument,
): OverlayLayer | null {
  let target: HTMLElement | null = host ?? stage.closest<HTMLElement>('.tool-stage') ?? stage.parentElement;
  // Climb until we are genuinely outside the render surface.
  while (target && (target === stage || stage.contains(target))) target = target.parentElement;
  if (!target) return null;

  ensureOverlayStyles(doc);

  const el = doc.createElement('div');
  el.className = className;
  // The only inline PAINT-adjacent properties in this module, and they are placement,
  // not style: the sheet states all three on `.collab-canvas-layer`, but a layer
  // whose sheet failed to load (or that a caller gave a different class) must not
  // become a full-page click shield sitting in the document flow.
  el.style.position = 'absolute';
  el.style.inset = '0';
  el.style.pointerEvents = 'none';
  el.setAttribute('aria-hidden', 'true');

  // A `static` host would make `inset: 0` resolve against some ancestor and put the
  // layer somewhere else entirely. Remember what was there so unmount is exact.
  const prevPosition = target.style.position;
  const computed = typeof getComputedStyle === 'function' ? getComputedStyle(target).position : '';
  if (!computed || computed === 'static') target.style.position = 'relative';

  target.appendChild(el);
  const mountedHost = target;
  return {
    el,
    host: mountedHost,
    unmount(): void {
      el.remove();
      if (computed === 'static' || !computed) mountedHost.style.position = prevPosition;
    },
  };
}

/**
 * Watch the ancestors an overlay is anchored THROUGH, and call back when one of
 * them is re-positioned.
 *
 * WHY THIS EXISTS, because it is not obvious and it was a real bug. Both presence
 * overlays measure `getBoundingClientRect()` and rebase into the layer's own space,
 * and both re-anchor on scroll, on resize and on a ResizeObserver. A canvas ZOOM or
 * PAN fires none of the three: `views/tool-stage-nav.ts` applies both as a CSS
 * `transform` on `.tool-canvas-outer` and dispatches no event. A transform changes
 * no scroll offset, no window size, and - crucially - no observed BORDER BOX, so
 * ResizeObserver reports nothing. Every ring therefore stayed at its pre-zoom
 * position until an unrelated model change happened to repaint it. Cursors hid it,
 * because their rAF ticker re-measures every frame; under `prefersReducedMotion()`
 * there is no ticker and they were stranded too.
 *
 * A MutationObserver on the `style`/`class` attributes of the chain between the
 * measured element and the layer's host is the precise answer: it is exactly the
 * set of boxes a transform can move the overlay relative to, it costs nothing while
 * nothing moves, and it needs no cooperation from (or import of) the stage-nav
 * controller. `stopAt` is EXCLUDED - a transform on the host moves the layer and the
 * canvas together, so there is nothing to re-anchor.
 *
 * Returns a disposer; a document with no MutationObserver (or no chain) yields a
 * no-op, because presence chrome must never be the thing that fails a mount.
 */
export function observeAnchorTransforms(
  from: HTMLElement | null | undefined,
  stopAt: HTMLElement | null | undefined,
  onChange: () => void,
): () => void {
  const noop = (): void => {};
  if (!from) return noop;
  const view = from.ownerDocument?.defaultView as { MutationObserver?: typeof MutationObserver } | null;
  const Ctor = view?.MutationObserver ?? (typeof MutationObserver !== 'undefined' ? MutationObserver : null);
  if (!Ctor) return noop;

  const chain: HTMLElement[] = [];
  let node: HTMLElement | null = from;
  // Bounded by construction: stop at the host, at the documentElement, or at the
  // root - a detached subtree must not walk forever.
  while (node && node !== stopAt && node !== node.ownerDocument?.documentElement) {
    chain.push(node);
    node = node.parentElement;
  }
  if (!chain.length) return noop;

  const mo = new Ctor(() => { onChange(); });
  for (const el of chain) mo.observe(el, { attributes: true, attributeFilter: ['style', 'class'] });
  return (): void => { mo.disconnect(); };
}

// ── The cursor layer ──────────────────────────────────────────────────────────

/** One collaborator, as far as the cursor layer is concerned. */
export interface CursorPeer {
  /** The peer's collab client id - the pool key. */
  readonly id: string;
  readonly name: string;
  /** The assigned collaborator colour (lib/collab-colors.ts). */
  readonly color: string;
  /** Normalized 0..1 unit-space position, or null/absent when this peer has no
   *  cursor to show (a sidebar-only tool, or a peer that never moved). */
  readonly cursor?: { readonly x: number; readonly y: number } | null;
  /** A hidden tab (section 11.4). Away peers keep their roster entry but drop their
   *  cursor - a pointer that has not moved for minutes is noise, not presence. */
  readonly away?: boolean;
}

export interface CollabCursorOptions {
  /** The canvas stage. Its live rect is what unit space maps through. */
  stage: HTMLElement;
  /** An ALREADY-MOUNTED `.collab-canvas-layer` to paint into - how the focus rings
   *  and the cursors share one layer, which is the arrangement the two sheets' internal
   *  z-order assumes (`.collab-focus-box` 1, `.collab-cursor` 2). Omit and this
   *  module mounts its own; `dispose()` only ever unmounts a layer it created. */
  layer?: HTMLElement | null;
  /** Where to mount, when no `layer` was supplied. Defaults to the enclosing
   *  `.tool-stage`, else the stage's parent; anything inside the stage is walked out
   *  of it (see {@link mountOverlayLayer}). */
  host?: HTMLElement | null;
  /** Monotonic ms. Injected so the interpolator can be driven on fake time. */
  now?: () => number;
  /** Frame scheduler. Injected so a test can hold the ticker still and so a future
   *  Worker-driven variant stays possible. */
  raf?: (fn: () => void) => number;
  cancelRaf?: (handle: number) => void;
  /** Motion preference read (defaults to the shared `prefersReducedMotion`). */
  reducedMotion?: () => boolean;
  /** Rect seams - default to the real elements' `getBoundingClientRect`. */
  measureStage?: () => RectLike;
  measureLayer?: () => RectLike;
  /** Re-anchor when an ancestor between the stage and the layer's host is
   *  re-positioned - a canvas zoom/pan, which fires no event of its own (see
   *  {@link observeAnchorTransforms}). Default true. */
  observe?: boolean;
  doc?: Document;
}

export interface CollabCursors {
  /** The overlay element, or null when no valid host could be found. */
  readonly el: HTMLElement | null;
  /** Replace the live cursor set. Peers with no cursor (or away) are released. */
  setPeers(peers: readonly CursorPeer[]): void;
  /** Re-measure and repaint without waiting for a frame - the hook the runtime's
   *  paint, a scroll and a resize all call. Cheap: two rects and N transforms. */
  reanchor(): void;
  /** Live counters, for tests and for a diagnostics readout. */
  stats(): { active: number; pooled: number; ticking: boolean };
  /** Stop the ticker, release every node, unmount the layer. Idempotent, and
   *  leaves NO scheduled frame behind. */
  dispose(): void;
}

/** A pooled cursor node: its root plus the two children the ticker writes. */
interface CursorNode {
  root: HTMLElement;
  arrow: HTMLElement;
  label: HTMLElement;
}

/** One tracked peer - its node and the two samples the interpolator walks. */
interface LiveCursor {
  node: CursorNode;
  prev: CursorSample | null;
  next: CursorSample;
  color: string;
  name: string;
}

/** Modifier for the reduced-motion presentation (section 4.8). The sheet above sizes it;
 *  see {@link setStill} for the two inline properties that carry the silhouette. */
export const CURSOR_STILL_CLASS = 'collab-cursor--still';

/**
 * Swap a cursor between the arrow and the still DOT (section 4.8: "hidden entirely under
 * `prefersReducedMotion()`, showing static position dots instead").
 *
 * The sheet draws `.collab-cursor-arrow` as a clip-path silhouette in the
 * collaborator's colour with a four-way white halo. A dot is that same painted box
 * with the silhouette dropped and the corners rounded - so the colour, the size, the
 * halo and the `--a11y-fs` scaling all still come from the sheet, and exactly two
 * properties are stated here - the sheet's own `.collab-cursor--still` rule carries
 * the SIZE, which an inline style could not express in `--a11y-fs` terms.
 *
 * The transition goes too. The sheet already kills it under both reduced-motion
 * gates, but this module's preference read is an INJECTED seam - a caller with its
 * own policy (a capture harness, a test) must get a still cursor from that seam
 * alone, not only from the two the stylesheet can see.
 */
function setStill(node: CursorNode, still: boolean): void {
  node.root.classList.toggle(CURSOR_STILL_CLASS, still);
  node.arrow.style.clipPath = still ? 'none' : '';
  node.arrow.style.borderRadius = still ? '50%' : '';
  node.root.style.transition = still ? 'none' : '';
}

function defaultRaf(fn: () => void): number {
  const g = globalThis as { requestAnimationFrame?: (cb: FrameRequestCallback) => number };
  if (typeof g.requestAnimationFrame === 'function') return g.requestAnimationFrame(() => fn());
  return setTimeout(fn, 16) as unknown as number;
}

function defaultCancelRaf(handle: number): void {
  const g = globalThis as { cancelAnimationFrame?: (h: number) => void };
  if (typeof g.cancelAnimationFrame === 'function') g.cancelAnimationFrame(handle);
  else clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
}

function defaultNow(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

const rectOf = (el: HTMLElement): RectLike => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
};

/**
 * Build the remote-cursor layer for one mounted tool.
 *
 * Returns a live object even when no host could be found (`el === null`): a caller
 * that has to null-check every presence call site is a caller that will forget one,
 * and a layer that quietly does nothing is the right failure for cosmetic chrome.
 */
export function createCollabCursors(opts: CollabCursorOptions): CollabCursors {
  const doc = opts.doc ?? opts.stage.ownerDocument;
  const now = opts.now ?? defaultNow;
  const raf = opts.raf ?? defaultRaf;
  const cancelRaf = opts.cancelRaf ?? defaultCancelRaf;
  const reducedMotion = opts.reducedMotion ?? prefersReducedMotion;

  // A borrowed layer never goes through mountOverlayLayer, so the sheet is ensured
  // here too - the styles must land whoever mounted the node.
  ensureOverlayStyles(doc);

  // `let`, so `dispose()` can drop it: an `el` that still hands back a DETACHED node
  // is the kind of bug where a caller keeps decorating a layer nobody can see.
  // A layer handed IN is borrowed - never unmounted here (the lender owns it).
  const borrowed = opts.layer ?? null;
  let layer: OverlayLayer | null = borrowed
    ? { el: borrowed, host: borrowed.parentElement ?? borrowed, unmount: () => {} }
    : mountOverlayLayer(opts.stage, opts.host, CANVAS_LAYER_CLASS, doc);

  const measureStage = opts.measureStage ?? ((): RectLike => rectOf(opts.stage));
  const measureLayer = opts.measureLayer
    ?? ((): RectLike => (layer ? rectOf(layer.el) : { left: 0, top: 0, width: 0, height: 0 }));

  const live = new Map<string, LiveCursor>();
  /** Free list - pooled nodes keep their identity across roster churn (rule 2). */
  const pool: CursorNode[] = [];
  let frame: number | null = null;
  let disposed = false;

  function makeNode(): CursorNode {
    const root = doc.createElement('div');
    root.className = 'collab-cursor';
    const arrow = doc.createElement('div');
    arrow.className = 'collab-cursor-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    const label = doc.createElement('span');
    label.className = 'collab-cursor-label';
    root.append(arrow, label);
    return { root, arrow, label };
  }

  function acquire(): CursorNode {
    const node = pool.pop() ?? makeNode();
    node.root.hidden = false;
    layer?.el.appendChild(node.root);
    return node;
  }

  function release(node: CursorNode): void {
    node.root.hidden = true;
    node.root.remove();
    pool.push(node);
  }

  /** Write one peer's position. `stage`/`layer` are measured once per frame by the
   *  caller - a per-peer `getBoundingClientRect` is the classic way to turn a smooth
   *  overlay into a layout-thrash machine. */
  function place(entry: LiveCursor, stage: RectLike, layerRect: RectLike, t: number, still: boolean): void {
    const unit = still
      ? { x: entry.next.x, y: entry.next.y }
      : cursorPosition(entry.prev, entry.next, t);
    const p = mapUnitPoint(unit.x, unit.y, stage, layerRect);
    // translate3d, never left/top: a compositor move that cannot reflow the page and
    // cannot invalidate the tool render underneath it (rule 4).
    entry.node.root.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
  }

  function paint(t: number): void {
    if (!layer || live.size === 0) return;
    const stage = measureStage();
    const layerRect = measureLayer();
    const still = reducedMotion();
    for (const entry of live.values()) place(entry, stage, layerRect, t, still);
  }

  /**
   * Is this peer still WALKING the segment between its two samples?
   *
   * The same three cases {@link cursorPosition} refuses to interpolate - no previous
   * sample, a non-positive interval, a gap past the snap window - plus the one that
   * matters for the loop: a segment already walked to its end. Once `t` reaches
   * `next.t + dur` the interpolator returns `next` forever, so every further frame
   * would paint the identical transform.
   */
  function moving(entry: LiveCursor, t: number): boolean {
    const prev = entry.prev;
    if (!prev) return false;
    const dur = entry.next.t - prev.t;
    if (!(dur > 0) || dur > CURSOR_SNAP_GAP_MS) return false;
    return t < entry.next.t + dur;
  }

  /** Does ANY peer still have a segment left to walk? The ticker's whole reason to
   *  exist - see {@link tick}. */
  function anyMoving(t: number): boolean {
    for (const entry of live.values()) {
      if (moving(entry, t)) return true;
    }
    return false;
  }

  function tick(): void {
    frame = null;
    if (disposed) return;
    const t = now();
    paint(t);
    // Re-checked after the paint, for two separate reasons. `dispose()` can run
    // inside it (a subscriber that tears the tool down), and re-arming there would
    // leave a frame pending forever. And a roster that is merely PRESENT is not a
    // reason to keep a frame loop alive: a peer who parks their pointer would
    // otherwise hold a 60 fps loop - two forced layouts a frame, forever - painting
    // the same transform, which is the opposite of this module's stated cost model.
    // The resting position is always painted before the loop stands down, because
    // the check happens after this frame's paint, not instead of it.
    if (!disposed && live.size > 0 && !reducedMotion() && anyMoving(t)) schedule();
  }

  function schedule(): void {
    if (frame !== null || disposed) return;
    frame = raf(tick);
  }

  function stopTicker(): void {
    if (frame === null) return;
    cancelRaf(frame);
    frame = null;
  }

  // A canvas zoom/pan is a transform on an ancestor and fires nothing. Repainting
  // SYNCHRONOUSLY here rather than scheduling a frame is deliberate: it is two rect
  // reads and N transform writes, MutationObserver already batches to one callback
  // per microtask, and standing a frame up would put the loop back on exactly the
  // "runs while nothing is moving" footing tick() just gave up.
  const unobserve = opts.observe === false
    ? (): void => {}
    : observeAnchorTransforms(opts.stage, layer?.host ?? null, () => {
        if (!disposed && layer) paint(now());
      });

  return {
    get el(): HTMLElement | null {
      return layer?.el ?? null;
    },

    setPeers(peers: readonly CursorPeer[]): void {
      if (disposed || !layer) return;
      const t = now();
      const seen = new Set<string>();
      let arrived = false;

      for (const peer of peers) {
        const c = peer.cursor;
        // No cursor and no presence to fake: a peer that is away, or on a tool with
        // no x/y lane at all (section 4.3 - the cursor is opt-in per tool).
        if (!c || peer.away || !Number.isFinite(c.x) || !Number.isFinite(c.y)) continue;
        seen.add(peer.id);
        let entry = live.get(peer.id);
        if (!entry) {
          entry = { node: acquire(), prev: null, next: { x: c.x, y: c.y, t }, color: '', name: '' };
          live.set(peer.id, entry);
          arrived = true;
        } else if (c.x !== entry.next.x || c.y !== entry.next.y) {
          // Only a MOVE advances the timeline. A 15 s heartbeat re-stating the same
          // position (section 4.7) would otherwise restart the interpolation window every
          // time and hold the cursor visually frozen one interval behind itself.
          entry.prev = entry.next;
          entry.next = { x: c.x, y: c.y, t };
        }
        if (entry.color !== peer.color) {
          entry.color = peer.color;
          // The one collab-specific colour, carried the way the sheet expects it.
          entry.node.root.style.setProperty('--collab-color', peer.color);
        }
        if (entry.name !== peer.name) {
          entry.name = peer.name;
          // textContent, never innerHTML: a display name is peer-supplied (section 11.21).
          entry.node.label.textContent = peer.name;
        }
      }

      for (const [id, entry] of live) {
        if (seen.has(id)) continue;
        release(entry.node);
        live.delete(id);
      }

      const still = reducedMotion();
      for (const entry of live.values()) setStill(entry.node, still);

      if (live.size === 0) {
        // Empty roster: the ticker has nothing to say. Stopping here rather than
        // letting the next tick notice keeps "zero cost when alone" exact.
        stopTicker();
        return;
      }
      if (still) {
        // No ticker under reduced motion (section 4.8) - repaint on arrival instead, so the
        // dots are current without anything animating between frames.
        stopTicker();
        paint(t);
        return;
      }
      // A node fresh out of the pool carries the previous tenant's transform (or
      // none at all), so it would sit at the layer origin for one frame before the
      // ticker moved it - a visible flick in the corner every time someone joins.
      // Placing on arrival costs two rect reads at presence rate, not frame rate.
      if (arrived) paint(t);
      // Only a peer with a segment left to walk is worth a frame loop. An arrival
      // (no previous sample) and a heartbeat restating the same point are both
      // already painted above and both rest exactly where they are.
      if (anyMoving(t)) schedule();
    },

    reanchor(): void {
      if (disposed || !layer) return;
      paint(now());
    },

    stats(): { active: number; pooled: number; ticking: boolean } {
      return { active: live.size, pooled: pool.length, ticking: frame !== null };
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      unobserve();
      stopTicker();
      for (const entry of live.values()) entry.node.root.remove();
      live.clear();
      pool.length = 0;
      layer?.unmount();
      layer = null;
    },
  };
}
