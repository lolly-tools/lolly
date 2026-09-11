// SPDX-License-Identifier: MPL-2.0
/**
 * collab-focus - remote focus decorations: the sidebar ring and the canvas outline
 * (plan 100 section 4.1, section 4.6, section 4.8, section 11.14).
 *
 * Focus, not x/y, is the presence primitive that ships on EVERY tool (section 4.1): the
 * canvas is a rendered preview rather than a freeform surface, so "Priya is editing
 * the Headline" is both truer and cheaper than a floating arrow. One roster stream
 * therefore drives TWO decorations, and the interesting part of this module is that
 * the two are allowed to touch the DOM in completely different ways.
 *
 * THE ASYMMETRY, STATED ONCE, BECAUSE IT IS THE WHOLE DESIGN:
 *
 *  - **The SIDEBAR is chrome.** It is re-rendered by the shell, it never appears in
 *    an export, and its rows already carry shell-owned state classes (`.is-target`,
 *    `.is-collapsed`). So a remote focus there is exactly what the plan asks for: a
 *    row-level `.is-remote-focus` class plus a chip stack appended to the row. Both
 *    are re-applied idempotently, because `renderInputs` rebuilds the whole panel's
 *    innerHTML on every keystroke and would otherwise wash them away.
 *  - **The CANVAS is the user's artwork.** Nothing here writes a class, an attribute
 *    or a node into it - not once, not "just a data attribute". Two independent
 *    reasons, and either alone would be enough: an export must stay byte-identical
 *    (section 4.6), and the tool's own paint replaces `#tool-canvas`'s innerHTML wholesale,
 *    so anything written in would be clobbered within a keystroke anyway. Outlines
 *    are therefore drawn on a SIBLING overlay layer, positioned from the annotated
 *    elements' `getBoundingClientRect`, and re-anchored on paint / scroll / resize.
 *
 * HOW A FOCUS STRING FINDS A NODE. The contract carries `focus` as an input id, or
 * `"<blocksId>:<rowId>"` for a blocks row (canvas-op v1.1, `Presence.focus`) - a
 * STABLE row id, because an array index is not an identity when two peers insert
 * concurrently (lib/row-id.ts). The DOM, however, addresses blocks by INDEX:
 * `.block-item[data-block-index]` in the sidebar, and `data-canvas-input="<id>:<n>"`
 * on the canvas (the `annotateTemplate` markers `resolveCanvasAnnotations` converts).
 * So this module owns the one mapping between them: id → index, resolved through the
 * runtime's input model, which is the same array both renderers numbered. The
 * mapping is deliberately re-derived on every apply rather than cached - a remote
 * insert renumbers every row below it, and a cache would point the ring at the wrong
 * card exactly when a collaborator is adding rows.
 *
 * REMOTE FOCUS IDS ARE UNTRUSTED INPUT (section 11.21). They are matched by SCANNING
 * `dataset` values, never by interpolating into a `querySelector` string: a peer
 * controls that string, and a crafted or merely malformed one is a thrown
 * `SyntaxError` at best and a selector that matches somewhere else at worst. The
 * scan costs a walk of a handful of nodes and removes the class of bug entirely.
 *
 * A11Y (section 4.8). Colour is never the only differentiator - the sidebar wash is paired
 * with a name CHIP, the canvas outline with a name LABEL and a theme-ground hairline
 * that reads as a shape rather than a hue, and every focus handoff is spoken through
 * `announce()`. The chips are `aria-hidden` ON PURPOSE and that is not an oversight:
 * an `.input-row` is usually a `<label>`, so visible text appended inside it would be
 * absorbed into the wrapped control's accessible name and a screen-reader user would
 * hear "Headline Priya" as the field's label. The live region carries the same
 * information without corrupting the form. Reduced motion removes the outline's
 * transition (rings do not move on their own, so they need nothing else - section 4.8).
 * Every glyph and offset in the sheet below is `calc(<px> * var(--a11y-fs))`.
 *
 * IT CARRIES ITS OWN STYLESHEET, injected into `<head>` on first mount, exactly like
 * `collab-overlay.ts` and `collab-pill.ts` - the lazy-chrome pattern that keeps a
 * single-player build byte-identical. `styles/parts/collab.css` owns ONLY the
 * `.collab-tile-*` family and says so in its own header; an unlayered injected sheet
 * beats every `@layer`, so a shared `parts/*.css` rule using one of these bare class
 * names would be silently inert here and a confusing duplicate everywhere else. So
 * `.is-remote-focus` (named verbatim in the plan), `.collab-focus-chip`,
 * `.collab-focus-box` and `.collab-focus-box-label` are defined below and nowhere
 * else; `.collab-canvas-layer` and the cursor classes belong to `collab-overlay.ts`,
 * whose sheet is ensured by the same mount. What stays INLINE is geometry no sheet
 * can know: the outline's measured rect and the per-collaborator `--collab-color`.
 */

import { announce as defaultAnnounce } from '../a11y.ts';
import { currentLang, loadNamespace, tRaw } from '../i18n.ts';
import { prefersReducedMotion } from '../lib/a11y-prefs.ts';
import { rowIdField } from '../lib/row-id.ts';
import type { RowIdInput } from '../lib/row-id.ts';
import {
  CANVAS_LAYER_CLASS,
  ensureOverlayStyles,
  mountOverlayLayer,
  observeAnchorTransforms,
} from './collab-overlay.ts';
import type { OverlayLayer, RectLike } from './collab-overlay.ts';

// ── Copy ──────────────────────────────────────────────────────────────────────
//
// One string, but it goes in a map like every other collab surface's - for one reason
// that matters more than tidiness: an inline `tRaw('…')` literal is INVISIBLE to the
// translation pipeline (its scanner only matches a quote immediately after `t(`), so
// this announcement was translated in appearance and English in fact. The value IS its
// catalog key, and the translation rides the lazy `collab` namespace.
export const STRINGS = {
  /** Live-region announcement when a collaborator moves to another field. */
  editingField: '{name} is editing {field}',
};

// ── Stylesheet (see the header: this module owns these classes outright) ───────

const STYLE_ID = 'lolly-collab-focus-css';

const CSS = `
/* ── Sidebar: a remote collaborator is IN this control ────────────────────── */
/* A tinted wash in the collaborator's colour plus a soft glow - deliberately NOT
   a coloured outline on a rounded row. A resting accent border on a rounded card
   is a house no (it reads as templated), and a wash also survives the row's own
   background (.block-item.is-typed paints one). Colour is never the only signal:
   the chip stack names whoever is here. Both selectors are two classes deep so
   they out-specify .block-item.is-typed's own ground. */
.input-row.is-remote-focus,
.block-item.is-remote-focus {
  /* The chip stack's containing block. .input-row is already relative (tool.css);
     .block-item is NOT, and without this a per-ROW chip escapes to the top of the
     whole blocks input and two peers on two rows stack at the same point. */
  position: relative;
  border-radius: var(--radius);
  background: color-mix(in oklab, var(--collab-color, hsl(var(--primary))) 12%, transparent);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--collab-color, hsl(var(--primary))) 20%, transparent);
  transition: background 0.15s ease-out, box-shadow 0.15s ease-out;
}
@media (prefers-reduced-motion: reduce) {
  .input-row.is-remote-focus,
  .block-item.is-remote-focus { transition: none; }
}
html[data-a11y-motion="reduce"] .input-row.is-remote-focus,
html[data-a11y-motion="reduce"] .block-item.is-remote-focus { transition: none; }

/* The chip stack: everyone on this row, most-recent first (section 4.6). It takes over
   the absolute placement so the chips can flow inside it; decorateRow no longer
   states any of this inline, which is what lets the offset scale with a11y-fs. */
[data-collab-chips] {
  position: absolute;
  inset-block-start: calc(-9px * var(--a11y-fs));
  inset-inline-end: 6px;
  z-index: 3;
  display: flex;
  gap: 3px;
  pointer-events: none;
}
[data-collab-chips] .collab-focus-chip { position: static; }

/* Fixed ink on the collaborator's ground, for the reason collab-pill.ts's
   .collab-av states: COLLAB_BAND projects every hue into one OKLCH
   lightness/chroma calibrated for APCA contrast against that ink, in both
   themes - so one ink is legible on all six. */
.collab-focus-chip {
  position: absolute;
  inset-block-start: calc(-9px * var(--a11y-fs));
  inset-inline-end: 6px;
  max-width: 14ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: calc(1px * var(--a11y-fs)) calc(6px * var(--a11y-fs));
  border-radius: 999px;
  background: var(--collab-color, hsl(var(--primary)));
  color: hsl(222 47% 8%);
  font-size: calc(9.5px * var(--a11y-fs));
  font-weight: 700;
  line-height: 1.6;
  pointer-events: none;
  box-shadow: 0 0 0 1px hsl(var(--card));
}

/* ── Canvas: the outline on the shared overlay layer ──────────────────────── */
/* This one IS a coloured ring, and the card rule does not reach it: it is a
   selection marquee over artwork - the tldraw/Figma idiom - not a rounded card in
   the chrome. The 2px radius keeps it reading as a marquee. The theme-ground
   hairline on both sides of the stroke is the SHAPE signal that keeps it visible
   over artwork sharing the collaborator's own hue. */
.collab-focus-box {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  box-sizing: border-box;
  border: calc(2px * var(--a11y-fs)) solid var(--collab-color, hsl(var(--primary)));
  border-radius: calc(2px * var(--a11y-fs));
  pointer-events: none;
  box-shadow: 0 0 0 1px hsl(var(--card) / 0.9), inset 0 0 0 1px hsl(var(--card) / 0.9);
  transition: transform 0.12s ease-out, width 0.12s ease-out, height 0.12s ease-out;
}
.collab-focus-box[hidden] { display: none; }
@media (prefers-reduced-motion: reduce) { .collab-focus-box { transition: none; } }
html[data-a11y-motion="reduce"] .collab-focus-box { transition: none; }

.collab-focus-box-label {
  position: absolute;
  inset-block-end: 100%;
  inset-inline-start: calc(-2px * var(--a11y-fs));
  margin-block-end: calc(3px * var(--a11y-fs));
  max-width: 16ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: calc(1px * var(--a11y-fs)) calc(6px * var(--a11y-fs));
  border-radius: 999px;
  background: var(--collab-color, hsl(var(--primary)));
  color: hsl(222 47% 8%);
  font-size: calc(10px * var(--a11y-fs));
  font-weight: 700;
  line-height: 1.5;
  box-shadow: 0 0 0 1px hsl(var(--card));
}
/* A peer with no name yet gets no empty pill floating over the artwork. */
.collab-focus-box-label:empty { display: none; }`;

/** Inject the sheet once per document. Idempotent by element id. */
function ensureFocusStyles(doc: Document | null | undefined): void {
  const d = doc ?? (typeof document !== 'undefined' ? document : null);
  if (!d || d.getElementById(STYLE_ID)) return;
  const style = d.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  d.head.appendChild(style);
}

// ── Focus addressing ──────────────────────────────────────────────────────────

/** A parsed `Presence.focus`: an input, optionally one row inside it. */
export interface FocusTarget {
  readonly inputId: string;
  /** The row's STABLE id, or null when the focus is the whole input. */
  readonly rowId: string | null;
}

/**
 * Split a `Presence.focus` string.
 *
 * The LAST colon separates, matching the greedy `^(.+):(\d+)$` the canvas
 * click-mapping in views/tool.ts already uses - one splitting convention for the two
 * directions, so an input id that itself contains a colon resolves the same way on
 * both. A trailing or leading colon is not a row reference; it is a malformed id,
 * and the whole string is treated as the input.
 */
export function parseFocus(focus: string | null | undefined): FocusTarget | null {
  if (typeof focus !== 'string') return null;
  const s = focus.trim();
  if (!s) return null;
  const i = s.lastIndexOf(':');
  if (i <= 0 || i === s.length - 1) return { inputId: s, rowId: null };
  return { inputId: s.slice(0, i), rowId: s.slice(i + 1) };
}

/**
 * The array index of the row `rowId` names, or -1.
 *
 * The documented index mapping (see the header): a stable id crosses the wire, both
 * renderers number the same array, so the model's value order IS the translation.
 * `rowIdField` is the shared definition of WHICH sub-field holds the id - a canvas
 * collection uses the tool's own declared id field, everything else the hidden
 * `__rid` - so a row minted by the sidebar and one minted on the canvas resolve
 * identically.
 *
 * The numeric fallback is for a peer that sends an INDEX rather than an id: a build
 * from before row ids existed, or a legacy session whose lazy migration has not run
 * (`migrateBlockRowIds`). Wrong under a concurrent insert, which is precisely why it
 * is a fallback - but a ring on the neighbouring row beats no ring at all, and this
 * is cosmetic chrome, not convergence.
 */
export function blockRowIndex(item: RowIdInput | null | undefined, rowId: string): number {
  const rows = item && Array.isArray(item.value) ? (item.value as unknown[]) : null;
  if (!rows) return -1;
  const field = rowIdField(item as Pick<RowIdInput, 'fields' | 'canvas'>);
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row && typeof row === 'object' && (row as Record<string, unknown>)[field] === rowId) return i;
  }
  const n = Number(rowId);
  return Number.isInteger(n) && n >= 0 && n < rows.length ? n : -1;
}

// ── Public shape ──────────────────────────────────────────────────────────────

/** One collaborator, as far as focus decoration is concerned. */
export interface FocusPeer {
  /** The peer's collab client id - the decoration key. */
  readonly id: string;
  readonly name: string;
  /** The assigned collaborator colour (lib/collab-colors.ts). */
  readonly color: string;
  /** `Presence.focus`: an input id, or `"<blocksId>:<rowId>"`. */
  readonly focus?: string | null;
  /** A hidden tab (section 11.4). An away peer keeps its roster entry but drops its ring - 
   *  a stale ring on a field nobody is looking at is worse than none. */
  readonly away?: boolean;
}

export interface CollabFocusOptions {
  /** The sidebar panel (`#tool-inputs`). Chrome: decorated in place. */
  sidebar?: HTMLElement | null;
  /** The tool render surface (`#tool-canvas` / `#tool-content`). READ ONLY - this
   *  module never writes into it. */
  canvas?: HTMLElement | null;
  /** An ALREADY-MOUNTED `.collab-canvas-layer` to paint into, shared with the cursor
   *  layer (collab-overlay.ts) - which is the arrangement the two sheets' internal
   *  z-order assumes. Omit and this module mounts its own; `dispose()` only ever
   *  unmounts a layer it created. */
  layer?: HTMLElement | null;
  /** Where to mount, when no `layer` was supplied. Defaults to the enclosing
   *  `.tool-stage`, else the canvas's parent; anything inside the canvas is walked
   *  out of it (mountOverlayLayer). */
  host?: HTMLElement | null;
  /** The runtime's input model - how a stable row id becomes an array index. */
  getModel?: () => readonly RowIdInput[];
  reducedMotion?: () => boolean;
  /** Live-region sink. Defaults to the shared `announce()` (polite). */
  announce?: (message: string) => void;
  /** Rect seams. Default to the real `getBoundingClientRect`; jsdom returns zeros,
   *  so a test that means to assert geometry has to supply its own. */
  measureElement?: (el: HTMLElement) => RectLike;
  measureLayer?: () => RectLike;
  /** Listen for scroll/resize and re-anchor. Default true. */
  observe?: boolean;
  raf?: (fn: () => void) => number;
  cancelRaf?: (handle: number) => void;
  doc?: Document;
}

export interface CollabFocus {
  /** The outline layer, or null when no valid host was found. */
  readonly el: HTMLElement | null;
  /** Replace the decorated set from a roster frame. */
  setPeers(peers: readonly FocusPeer[]): void;
  /** Re-apply the sidebar decorations and re-measure the canvas outlines. THE hook
   *  the runtime's paint calls (the sidebar's innerHTML rebuild washes the classes
   *  away; the canvas repaint moves every rect), and what scroll/resize drive. */
  reanchor(): void;
  /** For tests and diagnostics. */
  stats(): { rings: number; pooled: number; rows: number };
  /** Remove every decoration, drop the listeners, unmount the layer. Idempotent. */
  dispose(): void;
}

/** The row-level state class, per plan section 4.6 ("Sidebar: `.input-row.is-remote-focus`")
 * - styled by this module's own injected sheet, which names it verbatim. */
export const REMOTE_FOCUS_CLASS = 'is-remote-focus';
/** Marker on the chip stack this module appends, so a re-apply finds its own node. */
export const CHIP_STACK_ATTR = 'data-collab-chips';

// ── Internals ─────────────────────────────────────────────────────────────────

/** A peer resolved to a target, with the ordering that decides the ring colour. */
interface Entry {
  peer: FocusPeer;
  target: FocusTarget;
  /** Monotonic tick of the peer's LAST focus change - "most-recent wins" (section 4.6). */
  seq: number;
}

/** A pooled canvas outline node (`.collab-focus-box` + its label). */
interface RingNode {
  root: HTMLElement;
  tag: HTMLElement;
}

/** The outline's breathing room around the annotated element, in CSS px. */
const RING_PAD = 3;

const rectOf = (el: HTMLElement): RectLike => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
};

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

/**
 * Find the descendant whose `data-*` value equals `value`, by SCANNING rather than
 * by building a selector - see the header's note on untrusted focus ids.
 */
function scanByData(
  root: HTMLElement,
  selector: string,
  read: (el: HTMLElement) => string | undefined,
  value: string,
): HTMLElement | null {
  for (const el of root.querySelectorAll<HTMLElement>(selector)) {
    if (read(el) === value) return el;
  }
  return null;
}

// ── The decorator ─────────────────────────────────────────────────────────────

/**
 * Wire one roster stream to the two focus decorations.
 *
 * Returns a live object whether or not a canvas/sidebar was supplied: presence is
 * cosmetic chrome, and a caller that has to null-check every call site is a caller
 * that will forget one.
 */
export function createCollabFocus(opts: CollabFocusOptions = {}): CollabFocus {
  const doc = opts.doc
    ?? opts.sidebar?.ownerDocument
    ?? opts.canvas?.ownerDocument
    ?? (typeof document !== 'undefined' ? document : undefined);
  const sidebar = opts.sidebar ?? null;
  const canvas = opts.canvas ?? null;
  const reducedMotion = opts.reducedMotion ?? prefersReducedMotion;
  const say = opts.announce ?? ((m: string): void => defaultAnnounce(m));
  const measureElement = opts.measureElement ?? rectOf;
  const raf = opts.raf ?? defaultRaf;
  const cancelRaf = opts.cancelRaf ?? defaultCancelRaf;

  // The announcement's copy is in the lazy `collab` namespace (i18n.ts). Nothing is
  // said at mount - the first announcement follows a peer moving their focus, which is
  // a network round trip away - so kicking the load here and never awaiting it is
  // enough, and an unloaded namespace announces in English rather than failing.
  if (currentLang() !== 'en') void loadNamespace('collab');

  ensureFocusStyles(doc);
  // The outline paints into the shared overlay layer, whose own classes belong to
  // collab-overlay.ts - ensured here too, because a BORROWED layer never went
  // through that module's mount path.
  ensureOverlayStyles(doc);

  // A layer handed IN is borrowed - shared with the cursor layer and never unmounted
  // here, because the lender owns its lifetime.
  const borrowed = opts.layer ?? null;
  let layer: OverlayLayer | null = borrowed
    ? { el: borrowed, host: borrowed.parentElement ?? borrowed, unmount: (): void => {} }
    : (canvas && doc ? mountOverlayLayer(canvas, opts.host, CANVAS_LAYER_CLASS, doc) : null);
  const measureLayer = opts.measureLayer
    ?? ((): RectLike => (layer ? rectOf(layer.el) : { left: 0, top: 0, width: 0, height: 0 }));

  /** Entries in roster order, rebuilt on every `setPeers`. */
  let entries: Entry[] = [];
  /** peerId → the focus string last seen, so a change can bump `seq`. */
  const lastFocus = new Map<string, string | null>();
  /** peerId → the tick its CURRENT focus was adopted at. Held across heartbeats so
   *  "most recent wins" means most recently MOVED, not most recently heard from. */
  const lastSeq = new Map<string, number>();
  /** peerId → its ring; plus a free list, so churn allocates nothing (section 11.14). */
  const rings = new Map<string, RingNode>();
  const pool: RingNode[] = [];
  let seq = 0;
  let pending: number | null = null;
  let disposed = false;

  const model = (): readonly RowIdInput[] => {
    try {
      return opts.getModel?.() ?? [];
    } catch {
      // A model read is a courtesy from the host; a throwing one must not take the
      // presence chrome (or the frame it is painted in) down with it.
      return [];
    }
  };

  const inputItem = (id: string): RowIdInput | null => model().find(i => i.id === id) ?? null;

  // ── target resolution ───────────────────────────────────────────────────────

  /** The sidebar node a focus target rings: the row, or the block card inside it. */
  function sidebarTarget(target: FocusTarget): HTMLElement | null {
    if (!sidebar) return null;
    const control = scanByData(sidebar, '[data-input-id]', el => el.dataset.inputId, target.inputId);
    if (!control) return null;
    if (target.rowId === null) return control.closest<HTMLElement>('.input-row') ?? control;
    const idx = blockRowIndex(inputItem(target.inputId), target.rowId);
    if (idx >= 0) {
      const wrap = control.classList.contains('blocks-input')
        ? control
        : control.closest<HTMLElement>('.blocks-input');
      const item = wrap
        ? scanByData(wrap, '.block-item', el => el.dataset.blockIndex, String(idx))
        : null;
      if (item) return item;
    }
    // The row could not be located (a peer on a different build, a row this device
    // has not received yet, a session mid-migration). Ringing the whole blocks input
    // still says "somebody is working in here", which is the useful half.
    return control.closest<HTMLElement>('.input-row') ?? control;
  }

  /**
   * The annotated CANVAS element a focus target points at, if the template rendered
   * one. `resolveCanvasAnnotations` stamps `data-canvas-input="<inputId>"` and
   * `"<blocksId>:<index>"` - the same index mapping the sidebar uses, from the same
   * model, which is what keeps the two decorations pointing at the same thing.
   */
  function canvasTarget(target: FocusTarget): HTMLElement | null {
    if (!canvas) return null;
    const read = (el: HTMLElement): string | undefined => el.dataset.canvasInput;
    if (target.rowId !== null) {
      const idx = blockRowIndex(inputItem(target.inputId), target.rowId);
      if (idx >= 0) {
        const hit = scanByData(canvas, '[data-canvas-input]', read, `${target.inputId}:${idx}`);
        if (hit) return hit;
      }
    }
    return scanByData(canvas, '[data-canvas-input]', read, target.inputId);
  }

  // ── sidebar decoration ──────────────────────────────────────────────────────

  /**
   * This row's OWN chip stack - a direct child, never a descendant.
   *
   * `querySelector` would be wrong here and the bug is not hypothetical: a
   * `.block-item` lives INSIDE the `.input-row` of its blocks input, and both can be
   * decorated at once (one peer on the whole input, another on one row of it). A
   * descendant search from the outer row would then find the inner card's stack and
   * either rebuild it with the wrong names or delete it outright.
   */
  const chipStackOf = (el: HTMLElement): HTMLElement | null => {
    for (const child of el.children) {
      if (child.hasAttribute(CHIP_STACK_ATTR)) return child as HTMLElement;
    }
    return null;
  };

  function undecorateRow(el: HTMLElement): void {
    el.classList.remove(REMOTE_FOCUS_CLASS);
    chipStackOf(el)?.remove();
    el.style.removeProperty('--collab-color');
    // `removeProperty` leaves an empty style="" behind; a sidebar row that was once
    // decorated should be indistinguishable from one that never was.
    if (el.getAttribute('style') === '') el.removeAttribute('style');
  }

  /**
   * Ring the row in the most-recent collaborator's colour and stack everyone's chip
   * on it (section 4.6: "most-recent-wins when two people sit on one input (both show in
   * the roster)" - the stack is the roster, in place).
   *
   * NOTHING ABOUT THE PLACEMENT IS INLINE. The sheet's `.collab-focus-chip` rule
   * positions a SINGLE chip absolutely at the row's top-inline-end; the plan wants
   * everyone, so `[data-collab-chips]` takes that placement over and the chips flow
   * inside it as `position: static`. Both rules live in this module's own sheet, so
   * the offsets scale with `--a11y-fs` the way an inline `-9px` never could - and
   * the only thing this function writes is the per-collaborator colour, which no
   * stylesheet can know.
   */
  function decorateRow(el: HTMLElement, rowEntries: Entry[]): void {
    // Most-recent first: [0] owns the ring colour, all of them show in the stack.
    const ordered = [...rowEntries].sort((a, b) => b.seq - a.seq);
    const top = ordered[0]!;
    el.classList.add(REMOTE_FOCUS_CLASS);
    el.style.setProperty('--collab-color', top.peer.color);

    let stack = chipStackOf(el);
    if (!stack) {
      stack = el.ownerDocument.createElement('span');
      stack.setAttribute(CHIP_STACK_ATTR, '');
      // See the header: the row is usually a <label>, so this must never reach the
      // wrapped control's accessible name.
      stack.setAttribute('aria-hidden', 'true');
      el.appendChild(stack);
    }
    // At most six collaborators fit the colour circle (COLLAB_COLOR_COUNT), so a
    // wholesale rebuild here is a handful of nodes and needs no diffing.
    stack.textContent = '';
    for (const entry of ordered) {
      const chip = el.ownerDocument.createElement('span');
      chip.className = 'collab-focus-chip';
      chip.style.setProperty('--collab-color', entry.peer.color);
      // textContent, never innerHTML: display names arrive over the wire (section 11.21).
      chip.textContent = entry.peer.name;
      stack.appendChild(chip);
    }
  }

  function applySidebar(): void {
    if (!sidebar) return;
    const wanted = new Map<HTMLElement, Entry[]>();
    for (const entry of entries) {
      const el = sidebarTarget(entry.target);
      if (!el) continue;
      const bucket = wanted.get(el);
      if (bucket) bucket.push(entry);
      else wanted.set(el, [entry]);
    }
    // Swept by QUERY rather than from a remembered node set: `renderInputs` replaces
    // the panel's innerHTML on every keystroke, so the nodes decorated a moment ago
    // may already be detached - and the ones that replaced them are freshly clean.
    for (const el of sidebar.querySelectorAll<HTMLElement>(`.${REMOTE_FOCUS_CLASS}`)) {
      if (!wanted.has(el)) undecorateRow(el);
    }
    for (const [el, rowEntries] of wanted) decorateRow(el, rowEntries);
  }

  // ── canvas outlines ─────────────────────────────────────────────────────────

  /** Only ever reached with a mounted layer, so the layer's own document is the
   *  right (and always-present) factory. */
  function makeRing(host: HTMLElement): RingNode {
    const d = host.ownerDocument;
    const root = d.createElement('div');
    root.className = 'collab-focus-box';
    const tag = d.createElement('span');
    tag.className = 'collab-focus-box-label';
    root.appendChild(tag);
    return { root, tag };
  }

  function acquireRing(id: string, host: HTMLElement): RingNode {
    let node = rings.get(id);
    if (node) return node;
    node = pool.pop() ?? makeRing(host);
    node.root.hidden = false;
    host.appendChild(node.root);
    rings.set(id, node);
    return node;
  }

  function releaseRing(id: string): void {
    const node = rings.get(id);
    if (!node) return;
    rings.delete(id);
    node.root.hidden = true;
    node.root.remove();
    pool.push(node);
  }

  function applyCanvas(): void {
    const lay = layer;
    if (!lay || !canvas) return;
    const layerRect = measureLayer();
    // The sheet already kills `.collab-focus-box`'s transition under BOTH reduced-
    // motion gates. This mirrors it from the INJECTED preference seam, so a caller
    // with a policy of its own (a capture harness, a test) gets a still ring from
    // that seam alone - the sheet can only see the OS query and the app attribute.
    const still = reducedMotion();
    const live = new Set<string>();
    for (const entry of entries) {
      const anchor = canvasTarget(entry.target);
      if (!anchor) continue;
      live.add(entry.peer.id);
      const node = acquireRing(entry.peer.id, lay.el);
      const r = measureElement(anchor);
      node.root.style.setProperty('--collab-color', entry.peer.color);
      node.root.style.transition = still ? 'none' : '';
      node.root.style.width = `${r.width + RING_PAD * 2}px`;
      node.root.style.height = `${r.height + RING_PAD * 2}px`;
      // transform, not top/left: the sheet's own note (section 11.14) - position moves must
      // not cost the overlay a layout pass on every re-anchor.
      node.root.style.transform =
        `translate3d(${r.left - layerRect.left - RING_PAD}px, ${r.top - layerRect.top - RING_PAD}px, 0)`;
      if (node.tag.textContent !== entry.peer.name) node.tag.textContent = entry.peer.name;
    }
    for (const id of [...rings.keys()]) {
      if (!live.has(id)) releaseRing(id);
    }
  }

  // ── announcements ───────────────────────────────────────────────────────────

  /** What a focus target is CALLED, for the live region: the row's visible label if
   *  the sidebar rendered one, else the raw input id. */
  function labelFor(target: FocusTarget): string {
    const row = sidebarTarget(target);
    const text = row?.querySelector<HTMLElement>('.input-label-text')?.textContent?.trim();
    return text || target.inputId;
  }

  function announceChanges(changed: readonly Entry[]): void {
    for (const entry of changed) {
      say(tRaw(STRINGS.editingField, { name: entry.peer.name, field: labelFor(entry.target) }));
    }
  }

  // ── lifecycle ───────────────────────────────────────────────────────────────

  function apply(): void {
    if (disposed) return;
    applySidebar();
    applyCanvas();
  }

  /** Coalesce a burst of scroll/resize notifications into one re-anchor per frame. */
  function scheduleApply(): void {
    if (disposed || pending !== null) return;
    pending = raf(() => {
      pending = null;
      apply();
    });
  }

  const onViewportChange = (): void => scheduleApply();

  if (opts.observe !== false && doc) {
    // Capture phase: a scroll inside the sidebar or the stage does not bubble to the
    // document, and both move the rects this layer is anchored from.
    doc.addEventListener('scroll', onViewportChange, { capture: true, passive: true });
    doc.defaultView?.addEventListener('resize', onViewportChange, { passive: true });
  }

  let ro: ResizeObserver | null = null;
  if (opts.observe !== false && typeof ResizeObserver !== 'undefined' && canvas) {
    ro = new ResizeObserver(() => scheduleApply());
    ro.observe(canvas);
    if (layer && layer.host !== canvas) ro.observe(layer.host);
  }

  // The fourth trigger, and the one none of the other three can stand in for: a
  // canvas ZOOM or PAN. `views/tool-stage-nav.ts` applies both as a CSS transform on
  // `.tool-canvas-outer` and dispatches no event - no scroll offset changes, no
  // window resizes, and no observed BORDER BOX changes, so the ResizeObserver above
  // stays silent while every ring sits at its pre-zoom position. See
  // {@link observeAnchorTransforms} for why watching the ancestors' style/class is
  // the precise answer rather than polling or a frame loop.
  const unobserveAnchor = opts.observe !== false
    ? observeAnchorTransforms(canvas, layer?.host ?? null, scheduleApply)
    : (): void => {};

  return {
    get el(): HTMLElement | null {
      return layer?.el ?? null;
    },

    setPeers(peers: readonly FocusPeer[]): void {
      if (disposed) return;
      const next: Entry[] = [];
      const changed: Entry[] = [];
      const seenIds = new Set<string>();
      for (const peer of peers) {
        seenIds.add(peer.id);
        const focus = peer.away ? null : (peer.focus ?? null);
        const before = lastFocus.get(peer.id) ?? null;
        const moved = before !== focus;
        if (moved) lastFocus.set(peer.id, focus);
        const target = parseFocus(focus);
        if (!target) continue;
        // `seq` only advances on a real focus CHANGE, so "most recent" survives every
        // heartbeat re-statement of the same presence (section 4.7's 15 s refresh).
        const entry: Entry = { peer, target, seq: moved ? ++seq : (lastSeq.get(peer.id) ?? ++seq) };
        lastSeq.set(peer.id, entry.seq);
        next.push(entry);
        if (moved) changed.push(entry);
      }
      for (const id of [...lastFocus.keys()]) {
        if (!seenIds.has(id)) { lastFocus.delete(id); lastSeq.delete(id); }
      }
      entries = next;
      apply();
      // After the apply, so `labelFor` reads the row this frame actually decorated.
      announceChanges(changed);
    },

    reanchor(): void {
      apply();
    },

    stats(): { rings: number; pooled: number; rows: number } {
      return {
        rings: rings.size,
        pooled: pool.length,
        rows: sidebar ? sidebar.querySelectorAll(`.${REMOTE_FOCUS_CLASS}`).length : 0,
      };
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      if (pending !== null) { cancelRaf(pending); pending = null; }
      if (doc) {
        doc.removeEventListener('scroll', onViewportChange, { capture: true } as EventListenerOptions);
        doc.defaultView?.removeEventListener('resize', onViewportChange);
      }
      ro?.disconnect();
      ro = null;
      unobserveAnchor();
      entries = [];
      if (sidebar) {
        for (const el of sidebar.querySelectorAll<HTMLElement>(`.${REMOTE_FOCUS_CLASS}`)) undecorateRow(el);
      }
      for (const node of rings.values()) node.root.remove();
      rings.clear();
      pool.length = 0;
      lastFocus.clear();
      lastSeq.clear();
      layer?.unmount();
      layer = null;
    },
  };
}
