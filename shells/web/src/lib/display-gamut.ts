// SPDX-License-Identifier: MPL-2.0
/**
 * display-gamut.ts - what the DISPLAY can show, and how a canvas is acquired so
 * the pixels we write land in that space instead of being flattened to sRGB.
 *
 * Two questions, kept apart on purpose because they have different answers:
 *
 *   - `displayGamutClaim()` - what the display SAYS it covers, from
 *     `(color-gamut: …)`. A diagnostics fact, and the seed for the Lab's initial
 *     comparison target. Can be 'rec2020'.
 *   - `displayAnchor()` - what we can actually PUT ON SCREEN: 'srgb' or
 *     'display-p3', because those are the only two values a 2D canvas context (and
 *     therefore the engine's `EncodeSpace`) accepts. A rec2020 claim clamps to
 *     'display-p3' here: anchoring anything to rec2020 would promise pixels no
 *     path in this app can produce.
 *
 * Why the claim is not trusted as a gamut measurement: the keyword is a coverage
 * threshold the browser derives from the display's declared EDID/ICC profile, and
 * those are routinely over-declared. It is used for a DEFAULT and for a readout,
 * never to decide what a colour is.
 *
 * Deliberately CSS-free and free of any per-mount state, so it is node-testable
 * with a stubbed `matchMedia` and can be shared by the Colour Lab, the brand
 * editor's charts and device-info without any of them owning the detection.
 */
import type { EncodeSpace } from '@lolly/engine';

/** What the display claims to cover. 'unknown' when there is no `matchMedia` at
 *  all (jsdom, the CLI's jsdom render path, any non-browser host). */
export type GamutClaim = 'srgb' | 'p3' | 'rec2020' | 'unknown';

/** Widest first: the first query that matches is the claim. */
const CLAIM_ORDER: readonly Exclude<GamutClaim, 'unknown'>[] = ['rec2020', 'p3', 'srgb'];

/**
 * What the display's DYNAMIC RANGE claims. 'unknown' when there is no `matchMedia`.
 *
 * Detected via `(dynamic-range: high)` ONLY. The `(video-dynamic-range: …)` variant
 * is NOT used: it is unreliable on Safari - it returned `false` on a panel where
 * `(dynamic-range: high)` returned `true` (verified on an iPad Pro tandem OLED,
 * 2026-08-25). Like the gamut claim this is a DEFAULT and a readout, never a
 * decision about a colour - and note that a high-range display also matches
 * `standard` (high is a superset), so 'high' is tested first.
 */
export type DynamicRangeClaim = 'standard' | 'high' | 'unknown';
const DR_ORDER: readonly Exclude<DynamicRangeClaim, 'unknown'>[] = ['high', 'standard'];

/**
 * The retained MediaQueryLists.
 *
 * Retained for two reasons: a live `MediaQueryList` is what fires 'change' when a
 * window is dragged to another monitor, and creating them per mount would leak one
 * set per visit to the Lab. Built lazily on the first query so importing this
 * module costs nothing and a host without `matchMedia` never touches it.
 */
let lists: MediaQueryList[] | null = null;
let claimCache: GamutClaim | null = null;
/** The retained `(dynamic-range: …)` MediaQueryLists + their cached claim, built
 *  lazily the same way `lists`/`claimCache` are, and torn down together. */
let drLists: MediaQueryList[] | null = null;
let drCache: DynamicRangeClaim | null = null;
/** One-way latch: a surface refused the wide-gamut option, so stop asking for it.
 *  Cleared only by a real display change - see {@link onDisplayGamutChange}. */
let downgraded = false;
const subscribers = new Set<() => void>();

function announceChange(): void {
  for (const fn of [...subscribers]) fn();
}

const onMediaChange = (): void => {
  claimCache = null;
  drCache = null;
  // A different display is a different surface: the previous refusal says nothing
  // about this one. This is the ONLY thing that unlatches.
  downgraded = false;
  announceChange();
};

function ensureLists(): MediaQueryList[] {
  if (lists) return lists;
  if (typeof matchMedia !== 'function') { lists = []; return lists; }
  lists = CLAIM_ORDER.map(g => matchMedia(`(color-gamut: ${g})`));
  for (const l of lists) l.addEventListener?.('change', onMediaChange);
  return lists;
}

/** What the display claims. Cached until a `(color-gamut: …)` query changes. */
export function displayGamutClaim(): GamutClaim {
  if (claimCache) return claimCache;
  const mqls = ensureLists();
  let claim: GamutClaim = 'unknown';
  for (let i = 0; i < mqls.length; i++) {
    if (mqls[i]?.matches) { claim = CLAIM_ORDER[i] as GamutClaim; break; }
  }
  claimCache = claim;
  return claim;
}

/** Build the `(dynamic-range: …)` MediaQueryLists lazily, mirroring {@link ensureLists}. */
function ensureDrLists(): MediaQueryList[] {
  if (drLists) return drLists;
  if (typeof matchMedia !== 'function') { drLists = []; return drLists; }
  drLists = DR_ORDER.map((r) => matchMedia(`(dynamic-range: ${r})`));
  for (const l of drLists) l.addEventListener?.('change', onMediaChange);
  return drLists;
}

/** What the display's dynamic range claims. Cached until a `(dynamic-range: …)`
 *  query changes (a monitor swap). 'high' means the panel reports HDR headroom. */
export function displayDynamicRange(): DynamicRangeClaim {
  if (drCache) return drCache;
  const mqls = ensureDrLists();
  let claim: DynamicRangeClaim = 'unknown';
  for (let i = 0; i < mqls.length; i++) {
    if (mqls[i]?.matches) { claim = DR_ORDER[i] as DynamicRangeClaim; break; }
  }
  drCache = claim;
  return claim;
}

/** True when the display reports HDR headroom - the go/no-go for showing colours
 *  above SDR white. `(dynamic-range: high)`; see {@link DynamicRangeClaim}. */
export function displaySupportsHdr(): boolean {
  return displayDynamicRange() === 'high';
}

/**
 * The space to encode pixels in for THIS display: 'display-p3' on a display that
 * claims p3 or wider, else 'srgb'. Falls back to 'srgb' once a surface has been
 * seen to refuse the option, so the charts and the "your display" contour can
 * never end up disagreeing about which space is on screen.
 */
export function displayAnchor(): EncodeSpace {
  if (downgraded) return 'srgb';
  const claim = displayGamutClaim();
  return claim === 'p3' || claim === 'rec2020' ? 'display-p3' : 'srgb';
}

/** The gamut name that {@link displayAnchor}'s space corresponds to - what the
 *  charts stroke as the display's own boundary. */
export function displayAnchorGamut(): 'srgb' | 'p3' {
  return displayAnchor() === 'display-p3' ? 'p3' : 'srgb';
}

/**
 * Record that a surface gave us a NARROWER space than we asked for - an engine
 * that accepts the options bag and ignores `colorSpace`, or one that predates it.
 * Latches (never back to 'display-p3' without a display change) and notifies once,
 * so every consumer repaints in agreement rather than in different frames.
 */
export function noteEncodeDowngrade(actual: EncodeSpace): void {
  if (actual !== 'srgb' || downgraded) return;
  downgraded = true;
  announceChange();
}

/** Subscribe to "the display, or what we can encode for it, changed". Returns a
 *  real teardown - mounts must push it onto their cleanups. */
export function onDisplayGamutChange(fn: () => void): () => void {
  ensureLists();
  ensureDrLists(); // so a dynamic-range change (monitor swap) also notifies
  subscribers.add(fn);
  return () => { subscribers.delete(fn); };
}

/**
 * The space each canvas's existing context was granted.
 *
 * Needed because a 2D context KEEPS the `colorSpace` it was created with and a
 * second `getContext` ignores the options bag entirely - so "ask again and read
 * `getContextAttributes()`" cannot tell "the platform refused the wide option" apart
 * from "this canvas already has a context from when the display was different".
 * Weak, so a canvas that leaves the document is not held alive by this.
 */
const GRANTED = new WeakMap<HTMLCanvasElement, EncodeSpace>();

/**
 * Acquire a 2D context in the display's space and report the space it ACTUALLY
 * granted, plus the canvas the context belongs to.
 *
 * The three settings that must agree - the context's `colorSpace`, the
 * ImageData's, and the engine's `encode` - are kept in lockstep by deriving the
 * other two from what this returns. `getContextAttributes()` reflects the real
 * space per spec; a browser with no such accessor almost certainly has no
 * `colorSpace` support either, so 'srgb' is the safe assumption.
 *
 * A window dragged between monitors changes the space we want on a canvas that
 * already has a context. Since the space is fixed for that context's lifetime, the
 * only way to honour the change is a NEW drawing surface, so the canvas is replaced
 * with a shallow clone (every class and data attribute the caller looks it up by
 * survives; nothing in this codebase listens on a chart canvas - the pointer handlers
 * live on the plot). Callers must therefore use the RETURNED canvas, not the one they
 * passed. Without this the fill kept the old space while the "your display" contour
 * moved, which is exactly the disagreement this module exists to prevent - and in the
 * sRGB→P3 direction it also latched a downgrade that was never real.
 */
export function acquire2d(
  canvas: HTMLCanvasElement,
): { ctx: CanvasRenderingContext2D; encode: EncodeSpace; canvas: HTMLCanvasElement } | null {
  const want = displayAnchor();
  const prior = GRANTED.get(canvas);
  let target = canvas;
  if (prior !== undefined && prior !== want && canvas.parentNode) {
    const fresh = canvas.cloneNode(false) as HTMLCanvasElement;
    canvas.replaceWith(fresh);
    target = fresh;
  }
  const ctx = target.getContext('2d', { colorSpace: want });
  if (!ctx) return null;
  const got = (ctx.getContextAttributes?.().colorSpace ?? 'srgb') as EncodeSpace;
  GRANTED.set(target, got);
  // Only a FRESHLY negotiated context can say anything about the platform. A
  // retained one (a detached canvas, where there is no parent to swap under) is
  // reporting its own history, and latching on it would blame the browser for a
  // monitor change.
  const negotiated = prior === undefined || target !== canvas;
  if (negotiated && got !== want) noteEncodeDowngrade(got);
  return { ctx, encode: got, canvas: target };
}


/**
 * Drop all detection state - the cached claim, the latch, the retained
 * MediaQueryLists and their listeners.
 *
 * For tests, which swap the `matchMedia` global between cases. Nothing in the app
 * calls it: the lists are meant to live for the session.
 */
export function resetDisplayGamut(): void {
  if (lists) for (const l of lists) l.removeEventListener?.('change', onMediaChange);
  if (drLists) for (const l of drLists) l.removeEventListener?.('change', onMediaChange);
  lists = null;
  drLists = null;
  claimCache = null;
  drCache = null;
  downgraded = false;
  subscribers.clear();
}
