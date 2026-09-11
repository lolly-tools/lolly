// SPDX-License-Identifier: MPL-2.0
// ── Static-chrome fast path: the decision helpers ────────────────────────────
//
// Motion export (renderVideo/renderGif/renderApng/renderWebpAnim) rasterises the
// WHOLE tool node with dom-to-image once per frame: clone the subtree, inline
// every computed style, rasterise through an SVG foreignObject, and - the
// expensive part - turn every <canvas> child into a PNG data URL
// (dom-to-image-more's clone step is literally
// `isHTMLCanvasElement(e) ? makeImage(e.toDataURL()) : e.cloneNode(false)`).
// Measured on a 1080² audiogram-shaped node in Chromium: 57.2 ms/frame total,
// 30.8 ms of it canvas.toDataURL, ~31.9 ms of it chrome that never changes.
//
// When the only thing that changes between frames is canvas PIXELS, that chrome
// can be rasterised ONCE and the live canvases blitted over it per frame. These
// are the pure predicates that decide whether that substitution is safe; the DOM
// measurement and the compositing live in export.ts. They are pure so the
// decision can be tested without a browser - the whole point is that a wrong
// "yes" silently ships a frozen or over-painted frame that no assertion in the
// encoder would ever catch.

export interface Box { x: number; y: number; width: number; height: number }

/** Border-box intersection with a sub-pixel slack, so boxes that merely abut
 *  (a caption stacked directly under the canvas) do not read as overlapping. */
export function boxesOverlap(a: Box, b: Box, slack = 0.5): boolean {
  if (a.width <= 0 || a.height <= 0 || b.width <= 0 || b.height <= 0) return false;
  return a.x + a.width  - slack > b.x
      && b.x + b.width  - slack > a.x
      && a.y + a.height - slack > b.y
      && b.y + b.height - slack > a.y;
}

export interface ChromeEl {
  box: Box;
  /** false for display:none / visibility:hidden / opacity:0 - contributes no pixels. */
  paints: boolean;
  /** the live canvas itself, or an ancestor of one. */
  relatedToLive: boolean;
}

// The composite is chrome-first, canvas-over, and the cached chrome layer is
// opaque wherever the tool's background is - so anything meant to paint ON TOP
// of a canvas would be erased by the blit. The audiogram's `layout=overlay` is
// exactly this: `.ag-wavebox` goes `position:absolute; inset:0` full-bleed and
// `.ag-meta`/`.ag-credit` paint over it. That must fall back to the slow path,
// not render wrong, so ANY overlap is a hard reject - including elements EARLIER
// in document order, which a positive z-index can still lift above the canvas.
// Ancestors are exempt: an ancestor's background always paints below its own
// descendants' content, so containment is not an over-paint.
export function chromePaintsOverLive(live: Box[], chrome: ChromeEl[]): boolean {
  for (const el of chrome) {
    if (!el.paints || el.relatedToLive) continue;
    for (const box of live) if (boxesOverlap(box, el.box)) return true;
  }
  return false;
}

// ── Staying honest after the probe says yes ──────────────────────────────────
// The probe is a SAMPLE, and for a clockless tool a thin one: booth-studio has no
// `__lollyFrameRender`, so the observer has only watched the settle wait plus one
// real capture. A `setInterval` retouching the DOM every ~500 ms - a countdown, a
// "recording" dot, a status line - raises no Web Animation and would land between
// samples, then be frozen into the cached layer for the whole clip with nothing
// downstream to catch it. So the evidence keeps being checked: the observer stays
// live for the entire export and every frame drains it before compositing.

export interface MutationLike {
  type: string;
  attributeName?: string | null;
  target: unknown;
}

/**
 * The chrome shot hides the live canvases (`visibility:hidden !important` on the
 * element's own style attribute) and puts them back, which the observer reports as
 * two attribute mutations on the canvases themselves. Counting those as tool
 * mutations would make the fast path invalidate itself on the very frame it was
 * accepted, forever. Narrow on purpose - only the `style` attribute, only on the
 * canvases we touched - so a tool that really does rewrite its canvas's class,
 * width, or subtree still registers.
 */
export function isOwnVisibilitySwap(r: MutationLike, ourTargets: ReadonlySet<unknown>): boolean {
  return r.type === 'attributes' && r.attributeName === 'style' && ourTargets.has(r.target);
}

export function countToolMutations(records: readonly MutationLike[], ourTargets: ReadonlySet<unknown>): number {
  let n = 0;
  for (const r of records) if (!isOwnVisibilitySwap(r, ourTargets)) n++;
  return n;
}

// Three, because a refresh costs almost exactly what a slow-path frame costs (it
// IS a full dom-to-image pass over the node) - so a handful of them lose nothing,
// while a tool mutating on every frame would otherwise pay the slow path PLUS a
// hide/unhide style recalc and a composite forever.
export const STATIC_CHROME_INVALIDATION_CEILING = 3;

/** reuse - cached chrome is still valid. refresh - re-rasterise it for THIS frame.
 *  stand-down - the fast path is over for the rest of the export. */
export type FastFrameAction = 'reuse' | 'refresh' | 'stand-down';

export interface StaticChromeGuard {
  invalidations: number;
  stoodDown: boolean;
  ceiling: number;
}

export function createStaticChromeGuard(ceiling = STATIC_CHROME_INVALIDATION_CEILING): StaticChromeGuard {
  return { invalidations: 0, stoodDown: false, ceiling };
}

/**
 * Refresh rather than fall back on the first late mutation: re-rasterising is the
 * CORRECT answer (the frame is composited over chrome captured after the mutation,
 * so nothing freezes) and it keeps every later frame on the fast path, which is
 * where the 10x lives. Falling back permanently on a single mutation would hand
 * the whole clip back to the slow path because of one stray attribute write.
 * Mutating: the guard is per-export state, and the caller needs the count for its
 * one log line.
 */
export function staticChromeFrameAction(guard: StaticChromeGuard, toolMutations: number): FastFrameAction {
  if (guard.stoodDown) return 'stand-down';
  if (toolMutations <= 0) return 'reuse';
  guard.invalidations++;
  if (guard.invalidations >= guard.ceiling) { guard.stoodDown = true; return 'stand-down'; }
  return 'refresh';
}

export interface StaticChromeProbe {
  /** window.__lollyCaptureScreenshot is installed (Node/Playwright Tier-B). */
  externalScreenshot: boolean;
  /** visible, non-degenerate <canvas> elements found under the node. */
  liveCanvases: number;
  /** tool-attributable MutationObserver records seen up to the probe. */
  mutationRecords: number;
  /** node.getAnimations({ subtree: true }).length */
  animations: number;
  /** chromePaintsOverLive() verdict. */
  chromeOverlaps: boolean;
}

/**
 * All five must hold. Canvas pixel writes raise no mutation records, so "the
 * clock was driven to two different phases and NOTHING mutated" is positive
 * proof that the only per-frame change is canvas pixels - no per-tool opt-in
 * needed, which is the point: the win has to reach tools nobody edits.
 *
 * For a CLOCKLESS tool this is a sample, not a proof, which is why saying yes here
 * is not the end of the checking - see staticChromeFrameAction.
 */
export function staticChromeVerdict(p: StaticChromeProbe): { ok: boolean; reason: string } {
  // The Tier-B screenshot path never goes near dom-to-image - Chromium paints the
  // LIVE node in one genuine shot, so there is no per-frame serialisation cost to
  // remove, and it deliberately does not force the node to the target size, so the
  // node-space→target-space maths the blit needs does not hold there.
  if (p.externalScreenshot) return { ok: false, reason: 'external screenshot capture in play' };
  if (p.liveCanvases < 1)   return { ok: false, reason: 'no visible canvas to blit' };
  // Zero-length is not proof of a static template (rAF motion produces no
  // Animation object) - the mutation probe is what proves that. This rejects the
  // motion getAnimations DOES see, which is why scrubAnimations exists: slides
  // and deck-builder pin `getAnimations()` from an inert 0×0 clock canvas, and
  // every visible pixel of those decks moves via CSS keyframes.
  if (p.animations > 0)     return { ok: false, reason: `${p.animations} CSS animation(s) under the node` };
  if (p.mutationRecords > 0) return { ok: false, reason: `${p.mutationRecords} DOM mutation(s) per frame` };
  if (p.chromeOverlaps)     return { ok: false, reason: 'chrome paints over the canvas' };
  return { ok: true, reason: 'static chrome' };
}
