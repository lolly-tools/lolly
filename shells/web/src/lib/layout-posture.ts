// SPDX-License-Identifier: MPL-2.0
/**
 * Layout class and posture: which arrangement the web shell's chrome takes on the
 * window it has right now.
 *
 * Three classes. `phone` is the layout below 641px, `desktop` is the layout above it,
 * and `split` is two panes side by side (or one above the other on a half-open
 * horizontal fold). Split is chosen from the WINDOW and from fold signals, never from
 * a device name, so a Lolly window in one half of an OS split view gets the phone layout.
 *
 * The signals, strongest first:
 *   1. a native fold report from a Tauri shell. The shell re-dispatches every change
 *      as a `lolly:fold` CustomEvent on `window` (detail: NativeFoldV1 or null) and
 *      keeps the current value on `window.__lollyFold`. Undefined there means no
 *      native source at all; null means no fold (folded shut, or a cover screen).
 *      Nothing here imports Tauri: the event and the global are the whole contract;
 *   2. the Viewport Segments API (`window.viewport.segments`) and Device Posture
 *      (`navigator.devicePosture`), which Chromium on Android exposes;
 *   3. the window's size and shape, which is all an iPhone Duo's WebKit offers.
 *
 * Strictly additive, on the model of lib/a11y-prefs.ts: the live switch is
 * `<html data-layout="split">`, plus `data-posture` and the `--fold-*` custom
 * properties when a fold is known, and every one of them is ABSENT unless split is
 * active. Phone and desktop are therefore byte-identical to the shell without this
 * module. The gated CSS lives in styles/parts/split.css and never reaches inside the
 * tool canvas or the export stages.
 *
 * Continuity: a change of class only flips attributes and custom properties. No view
 * is re-mounted, so the document, the selection, the zoom, a scrolled panel and a
 * focused field with its caret all survive a fold, an unfold or a rotation.
 *
 * index.html's pre-paint script carries a copy of the size rule (and the segment and
 * native checks) so the first frame is already split; layout-posture-contract.test.ts
 * keeps the two in step.
 */

export type LayoutClass = 'phone' | 'split' | 'desktop';
export type Posture = 'book' | 'tabletop' | 'flat';
export type FoldOrientation = 'vertical' | 'horizontal';

/** A rectangle in CSS px, relative to the top left of the viewport. */
export interface FoldRect { x: number; y: number; width: number; height: number }

/** The native fold report a Tauri shell sends (plan section 2). */
export interface NativeFoldV1 {
  state: 'flat' | 'half-opened';
  orientation: FoldOrientation;
  bounds: FoldRect;
  isSeparating: boolean;
  occlusion: 'none' | 'full';
}

/** Everything the decision reads. Pure data, so the rules are testable anywhere. */
export interface LayoutSignals {
  width: number;
  height: number;
  /** The primary pointer is coarse (a finger). Gates the size-only rule. */
  coarse: boolean;
  /** undefined: no native source. null: no fold. */
  native?: NativeFoldV1 | null;
  /** `window.viewport.segments`, on a browser with the Viewport Segments API. */
  segments?: readonly FoldRect[] | null;
  /** `navigator.devicePosture.type`, on a browser with Device Posture. */
  devicePosture?: string | null;
}

export interface LayoutState {
  layout: LayoutClass;
  /** Set only in split, and only when a signal says so. */
  posture: Posture | null;
  /** The separating fold that the divider locks to, in viewport CSS px. */
  fold: FoldRect | null;
  orientation: FoldOrientation | null;
  /** Which signal decided split. Null outside split. */
  source: 'native' | 'segments' | 'posture' | 'size' | null;
}

/** The shell's phone breakpoint: `max-width: 640px`, as in every phone rule. */
export const PHONE_MAX_WIDTH = 640;
/**
 * The size-only split rule (plan F1). An iPhone Duo inner screen is about 626 x 890
 * upright and 890 x 626 sideways, a book-style Android foldable's inner screen is
 * roughly 700 to 900 px and near square, and both land inside. The outer screens
 * (about 466 x 678 and 412 x 900) fail the short side; a tablet such as an 8.3 inch
 * iPad mini (744 x 1133) fails the long side and keeps the desktop layout.
 */
export const SPLIT_MIN_SHORT = 560;
export const SPLIT_MAX_LONG = 1100;
export const SPLIT_MIN_ASPECT = 0.62;
export const SPLIT_MAX_ASPECT = 1.6;
/** The media query the size rule is gated on. A mouse-driven desktop window of
 *  1024 x 768 is today's well-tested desktop layout and stays that way. */
export const SPLIT_POINTER_QUERY = '(pointer: coarse)';
/** The `window` event a native shell sends, and the global holding its last value. */
export const NATIVE_FOLD_EVENT = 'lolly:fold';
export const NATIVE_FOLD_GLOBAL = '__lollyFold';
/** The posture media query, read when `navigator.devicePosture` is missing. */
export const FOLDED_QUERY = '(device-posture: folded)';
/** How long a burst of resize events is gathered before the class is decided again. */
export const LAYOUT_SETTLE_MS = 80;

const NONE: LayoutState = { layout: 'desktop', posture: null, fold: null, orientation: null, source: null };

function finite(n: unknown): n is number { return typeof n === 'number' && Number.isFinite(n); }

function validRect(r: unknown): r is FoldRect {
  const v = r as FoldRect | null;
  return !!v && finite(v.x) && finite(v.y) && finite(v.width) && finite(v.height) && v.width >= 0 && v.height >= 0;
}

/** A native report as received, or undefined when it is not one we can read. */
export function readNativeFold(v: unknown): NativeFoldV1 | null | undefined {
  if (v === null) return null;
  const f = v as NativeFoldV1 | undefined;
  if (!f || typeof f !== 'object') return undefined;
  if (f.orientation !== 'vertical' && f.orientation !== 'horizontal') return undefined;
  if (!validRect(f.bounds)) return undefined;
  return f;
}

/** Does the window's own size and shape call for two panes? */
export function sizeCallsForSplit(width: number, height: number): boolean {
  if (!(width > 0 && height > 0)) return false;
  const short = Math.min(width, height);
  const long = Math.max(width, height);
  const aspect = width / height;
  return short >= SPLIT_MIN_SHORT && long <= SPLIT_MAX_LONG && aspect >= SPLIT_MIN_ASPECT && aspect <= SPLIT_MAX_ASPECT;
}

function base(width: number): LayoutState {
  return { ...NONE, layout: width <= PHONE_MAX_WIDTH ? 'phone' : 'desktop' };
}

/** A fold only counts when it crosses the inside of this window. */
function foldInWindow(fold: FoldRect, orientation: FoldOrientation, width: number, height: number): boolean {
  return orientation === 'vertical'
    ? fold.x > 0 && fold.x + fold.width < width
    : fold.y > 0 && fold.y + fold.height < height;
}

function split(fold: FoldRect | null, orientation: FoldOrientation | null, posture: Posture | null, source: LayoutState['source']): LayoutState {
  return { layout: 'split', posture, fold, orientation, source };
}

/** Two viewport segments, read as the fold between them. */
function foldFromSegments(segments: readonly FoldRect[], width: number, height: number): { fold: FoldRect; orientation: FoldOrientation } | null {
  const [a, b] = [...segments].filter(validRect).sort((p, q) => (p.y - q.y) || (p.x - q.x));
  if (!a || !b) return null;
  const aRight = a.x + a.width;
  const aBottom = a.y + a.height;
  if (Math.abs(a.y - b.y) < 1 && b.x >= aRight - 1) {
    return { orientation: 'vertical', fold: { x: aRight, y: 0, width: Math.max(0, b.x - aRight), height } };
  }
  if (b.y >= aBottom - 1) {
    return { orientation: 'horizontal', fold: { x: 0, y: aBottom, width, height: Math.max(0, b.y - aBottom) } };
  }
  return null;
}

/**
 * The decision, as a pure function. Order: a native report, then two viewport
 * segments, then a folded device posture, then the window's size and shape.
 */
export function computeLayout(s: LayoutSignals): LayoutState {
  const { width, height } = s;
  const native = s.native;
  if (native) {
    const separating = native.isSeparating || native.state === 'half-opened' || native.occlusion === 'full';
    if (separating && foldInWindow(native.bounds, native.orientation, width, height)) {
      return split({ ...native.bounds }, native.orientation, native.orientation === 'vertical' ? 'book' : 'tabletop', 'native');
    }
    // A flat fold that hides nothing is a continuous screen. A native report only
    // comes from a touch device, so the size rule applies without the pointer gate.
    if (!separating && sizeCallsForSplit(width, height)) return split(null, null, 'flat', 'native');
    return base(width);
  }
  if (s.segments && s.segments.length >= 2) {
    const seg = foldFromSegments(s.segments, width, height);
    if (seg && foldInWindow(seg.fold, seg.orientation, width, height)) {
      return split(seg.fold, seg.orientation, seg.orientation === 'vertical' ? 'book' : 'tabletop', 'segments');
    }
  }
  if (s.devicePosture === 'folded') {
    // Half open with no geometry. A book-style foldable's fold runs across its short
    // side, wide or tall, so it sits at the middle of the long one: a landscape
    // window is a book, a portrait one is on its table.
    const vertical = width >= height;
    const fold = vertical ? { x: Math.round(width / 2), y: 0, width: 0, height } : { x: 0, y: Math.round(height / 2), width, height: 0 };
    return split(fold, vertical ? 'vertical' : 'horizontal', vertical ? 'book' : 'tabletop', 'posture');
  }
  if (s.coarse && sizeCallsForSplit(width, height)) return split(null, null, null, 'size');
  return base(width);
}

// ── Applying it ──────────────────────────────────────────────────────────────

const FOLD_PROPS = ['--fold-x', '--fold-y', '--fold-w', '--fold-h'] as const;

/** Put a state on <html>: attributes and custom properties only while split is active. */
export function applyLayoutState(state: LayoutState, doc: Document = document): void {
  const root = doc.documentElement;
  const d = root.dataset;
  if (state.layout === 'split') d.layout = 'split';
  else delete d.layout;
  if (state.layout === 'split' && state.posture) d.posture = state.posture;
  else delete d.posture;
  const fold = state.layout === 'split' ? state.fold : null;
  if (fold) {
    const values = [fold.x, fold.y, fold.width, fold.height];
    FOLD_PROPS.forEach((prop, i) => { root.style.setProperty(prop, `${Math.round(values[i]!)}px`); });
  } else {
    for (const prop of FOLD_PROPS) root.style.removeProperty(prop);
  }
  // A style attribute emptied by the removals above goes too, so a page with no
  // inline custom properties keeps no stray `style=""`.
  if (!fold && root.getAttribute('style') === '') root.removeAttribute('style');
}

function sameState(a: LayoutState, b: LayoutState): boolean {
  const fa = a.fold, fb = b.fold;
  const sameFold = fa === fb || (!!fa && !!fb && fa.x === fb.x && fa.y === fb.y && fa.width === fb.width && fa.height === fb.height);
  return a.layout === b.layout && a.posture === b.posture && a.orientation === b.orientation && a.source === b.source && sameFold;
}

// ── The live module ──────────────────────────────────────────────────────────

type Listener = (state: LayoutState, previous: LayoutState) => void;

interface ViewportSegments { segments?: ReadonlyArray<{ x: number; y: number; width: number; height: number }> | null }
interface PostureNavigator { devicePosture?: EventTarget & { type?: string } }

let current: LayoutState | null = null;
let running: (() => void) | null = null;
const listeners = new Set<Listener>();

/** Read every signal the window offers right now. */
export function readSignals(win: Window = window): LayoutSignals {
  const w = win as Window & { viewport?: ViewportSegments; [NATIVE_FOLD_GLOBAL]?: unknown };
  const nav = win.navigator as Navigator & PostureNavigator;
  let segments: FoldRect[] | null = null;
  try {
    const list = w.viewport?.segments;
    if (list && list.length >= 2) segments = Array.from(list, (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }));
  } catch { /* a browser without the API */ }
  return {
    width: win.innerWidth,
    height: win.innerHeight,
    coarse: typeof win.matchMedia === 'function' && win.matchMedia(SPLIT_POINTER_QUERY).matches,
    native: NATIVE_FOLD_GLOBAL in w ? readNativeFold(w[NATIVE_FOLD_GLOBAL]) : undefined,
    segments,
    // The JavaScript API where there is one, else the media query, which some
    // builds expose without the API.
    devicePosture: nav?.devicePosture?.type
      ?? (typeof win.matchMedia === 'function' && win.matchMedia(FOLDED_QUERY).matches ? 'folded' : null),
  };
}

/** The state in force. Before the module starts it is computed on demand. */
export function currentLayout(): LayoutState {
  if (current) return current;
  if (typeof window === 'undefined') return NONE;
  return computeLayout(readSignals(window));
}

/** Is the shell in its two-pane layout right now? */
export function isSplitLayout(): boolean { return currentLayout().layout === 'split'; }

/**
 * The phone layout, which the many `(max-width: 640px)` checks in the shell's JS
 * meant all along. A 626px-wide window in split matches that media query and is
 * not a phone; this answers false there.
 */
export function isPhoneLayout(): boolean { return currentLayout().layout === 'phone'; }

/** Hear every change of state. Returns the unsubscribe. */
export function onLayoutChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** The MediaQueryList shape a phone check needs: `matches` and change events. */
export interface LayoutQuery {
  readonly matches: boolean;
  readonly media: string;
  addEventListener(type: 'change', fn: () => void): void;
  removeEventListener(type: 'change', fn: () => void): void;
  addListener(fn: () => void): void;
  removeListener(fn: () => void): void;
}

/**
 * A stand-in for `matchMedia('(max-width: 640px)')` that also hears the layout
 * class: it matches the phone layout only, and fires `change` when either the
 * width crosses 640 or split comes and goes. Code that sized a bottom sheet off
 * the media query takes this instead, and leaves split to the pane layout.
 */
export function phoneLayoutQuery(win: Window = window): LayoutQuery {
  const mq = win.matchMedia(`(max-width: ${PHONE_MAX_WIDTH}px)`);
  const fns = new Map<() => void, () => void>();
  const q: LayoutQuery = {
    get matches() { return mq.matches && !isSplitLayout(); },
    media: mq.media,
    addEventListener(_type, fn) {
      if (fns.has(fn)) return;
      // Each listener keeps its own last answer and hears only a real change, so a
      // width change inside split (the media query flips, the answer does not) is quiet.
      let own = q.matches;
      const wrapped = (): void => { const now = q.matches; if (now !== own) { own = now; fn(); } };
      const off = onLayoutChange(wrapped);
      mq.addEventListener('change', wrapped);
      fns.set(fn, () => { off(); mq.removeEventListener('change', wrapped); });
    },
    removeEventListener(_type, fn) { fns.get(fn)?.(); fns.delete(fn); },
    addListener(fn) { q.addEventListener('change', fn); },
    removeListener(fn) { q.removeEventListener('change', fn); },
  };
  return q;
}

/**
 * After a change of class the panes have new sizes, and the browser keeps each
 * scroller's offset only as far as the new size allows, so the field someone is
 * typing in can end up out of view. On the next frame, once the panes are laid
 * out, a focused text field is brought back to the nearest edge of its scroller.
 */
function keepFocusInView(win: Window): void {
  const raf = win.requestAnimationFrame?.bind(win) ?? ((fn: () => void) => setTimeout(fn, 0));
  raf(() => {
    const el = win.document.activeElement as HTMLElement | null;
    if (!el || el === win.document.body || !el.isConnected) return;
    if (!el.matches('input, textarea, select, [contenteditable="true"]')) return;
    el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  });
}

/**
 * Start following the window: decide once now, apply it, then decide again after
 * every resize burst, segment change, posture change and native fold report. Returns
 * the stop. Idempotent: a second start returns the running stop.
 */
export function startLayoutPosture(win: Window = window): () => void {
  if (running) return running;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const decide = (): void => {
    timer = null;
    const next = computeLayout(readSignals(win));
    const prev = current ?? NONE;
    if (current && sameState(prev, next)) return;
    current = next;
    applyLayoutState(next, win.document);
    for (const fn of [...listeners]) {
      try { fn(next, prev); } catch { /* one listener must not stop the rest */ }
    }
    keepFocusInView(win);
  };
  const settle = (): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(decide, LAYOUT_SETTLE_MS);
  };
  // A native report or a posture change is one event, not a burst: decide at once,
  // so the hinge and the divider meet on the same frame as the fold.
  const now = (): void => { if (timer) { clearTimeout(timer); timer = null; } decide(); };
  const onNative = (e: Event): void => {
    const detail = (e as CustomEvent).detail;
    // The event carries the value; keep the global in step for a reader that
    // arrives later, as the native shell does itself.
    (win as Window & Record<string, unknown>)[NATIVE_FOLD_GLOBAL] = detail === undefined ? null : detail;
    now();
  };
  const pointer = typeof win.matchMedia === 'function' ? win.matchMedia(SPLIT_POINTER_QUERY) : null;
  const folded = typeof win.matchMedia === 'function' ? win.matchMedia(FOLDED_QUERY) : null;
  const posture = (win.navigator as Navigator & PostureNavigator).devicePosture;
  win.addEventListener('resize', settle);
  win.addEventListener(NATIVE_FOLD_EVENT, onNative);
  pointer?.addEventListener?.('change', settle);
  folded?.addEventListener?.('change', now);
  posture?.addEventListener?.('change', now);
  decide();
  running = () => {
    if (timer) clearTimeout(timer);
    win.removeEventListener('resize', settle);
    win.removeEventListener(NATIVE_FOLD_EVENT, onNative);
    pointer?.removeEventListener?.('change', settle);
    folded?.removeEventListener?.('change', now);
    posture?.removeEventListener?.('change', now);
    running = null;
    current = null;
    applyLayoutState(base(PHONE_MAX_WIDTH + 1), win.document);
  };
  return running;
}
