// SPDX-License-Identifier: MPL-2.0

import type { AssetRef } from './asset-ref.ts';

// ─── Capture ────────────────────────────────────────────────────────────────

export interface CaptureAPI {
  /**
   * Navigate to `url` in a real browser engine and rasterise the result to an
   * image. Returns a raster AssetRef (`source: 'remote'`) that flows back through
   * the normal render/export path - so units, format conversion, provenance and
   * the experimental watermark all apply downstream exactly as for a template
   * render. Capture is the *source*; export remains the single output path.
   *
   * The returned ref's `width`/`height` are the ACTUAL captured CSS-px box -
   * after any `crop` insets and `rangeTo` extension - so callers size their
   * composite from the result, never from the request. Hosts SHOULD also report
   * the resolved page geometry in `meta` (`pageWidth`/`pageHeight` in CSS px and
   * `scrollYPx`, the resolved scroll offset) where the engine can measure it;
   * callers must treat those as optional (older shells omit them).
   *
   * Slow and side-effectful (a real navigation + settle), unlike instant
   * template renders - call it from an explicit action, not on every keystroke.
   */
  page(spec: CaptureSpec): Promise<AssetRef>;

  /**
   * Vector capture - print `url` to a TRUE vector document and return it as an
   * SVG AssetRef (`type: 'vector'`, `format: 'svg'`, `url` a data: URL holding a
   * self-contained SVG: text as <text>, boxes/paths as vectors, page images
   * inlined as data: URIs). Where page() reads pixels, this reads *geometry* -
   * the same fidelity ladder as the PDF import path (pdf-map.ts), so the result
   * is crisp at any zoom and re-editable, at the cost of pixel-perfection
   * (webfonts resolve by family name, exotic paint degrades per the ladder).
   *
   * The shell applies the SAME windowing as page(): `scrollDepth` + `height`
   * frame the region, `crop` trims insets - all as viewBox geometry, so a vector
   * shot and a raster shot of one spec frame identical content. Omit `height`
   * to get the full page.
   *
   * Optional/additive (v1.45) - only shells whose browser engine can print to a
   * vector format provide it; callers feature-detect `host.capture.vector` and
   * fall back to page() (a raster in an <svg> wrapper) where absent.
   */
  vector?(spec: CaptureSpec): Promise<AssetRef>;
}

export interface CaptureSpec {
  /** The URL to load and capture. */
  url: string;
  /** Viewport width in px. The engine resolves physical units before calling. */
  width: number;
  /** Viewport height in px. Omit to capture the full scrollable page height. */
  height?: number;
  /**
   * Scroll before capturing: a 0..1 fraction of the scrollable height, or a px
   * offset when > 1. Lets the shot frame below-the-fold content.
   */
  scrollDepth?: number;
  /**
   * Extend the capture DOWN the page from `scrollDepth` to this scroll position
   * (same 0..1-fraction / px-offset semantics; values ≤ the resolved
   * `scrollDepth` mean no extension). The captured image becomes a tall strip:
   * the viewport at `scrollDepth` plus everything down to the viewport at
   * `rangeTo` - the strip a scroll animation pans over. Callers derive the pan
   * distance from the RESULT (`ref.height` − the framed viewport height), so a
   * host that ignores or clamps this field (older shells; texture limits)
   * degrades to a shorter - or static - pan, never an error. (v1.45)
   */
  rangeTo?: number;
  /** Settle time after load - and after scrolling - before the shot, in ms. */
  waitMs?: number;
  /** Device pixel ratio for a crisp raster; maps onto the export `dpi` concept. */
  dpr?: number;
  /**
   * Custom CSS injected into the page before the shot (userstyles-style, additive
   * - appended so it layers over the page's own rules by source order). Use it to
   * hide cookie banners, restyle elements, etc.
   */
  css?: string;
  /**
   * Trim insets, each a 0..0.9 fraction of the framed viewport box (the TUI's
   * url-capture semantics, now on the bridge). Applied by the host at capture
   * time - clip geometry for a raster, viewBox geometry for a vector - so the
   * returned ref's width/height already reflect the trim. Hosts that predate the
   * field ignore it (the caller reads the result dims either way). (v1.45)
   */
  crop?: { top?: number; right?: number; bottom?: number; left?: number };
}

// ─── Lift (optional) ────────────────────────────────────────────────────────────

/** One lifted layer: a standalone SVG document plus its ink extent (v1.123). */
export interface LiftLayer {
  /**
   * The layer as a complete, standalone `<svg>…</svg>` document. It keeps the source's
   * ROOT coordinate system, so every layer overlays the others exactly - ready to
   * rasterise to a texture or store as an asset with no fix-up. (The engine's
   * `SvgLayer.markup`.)
   */
  svg: string;
  /**
   * The layer's analytic ink bounding box in the SOURCE viewBox's user units, or null
   * when nothing in it could be measured without a renderer. Advisory - for clustering
   * and placement hints, never a pixel-exact crop.
   */
  bbox: { x: number; y: number; w: number; h: number } | null;
  /** How many of the source's top-level nodes this layer gathered - a hint for telling a
   *  real layer from a cluster of stray leaves. */
  nodes: number;
}

/**
 * The result of lifting an SVG: its layers in PAINT ORDER (background first, so a caller
 * placing planes back-to-front can walk the array), plus the source document's own
 * viewBox (the denominator for every layer's bbox).
 */
export interface LiftResult {
  layers: LiftLayer[];
  viewBox: { x: number; y: number; w: number; h: number } | null;
  /** Anything the enumerator refused, repaired or capped, in plain words. Never thrown. */
  warnings: string[];
}
