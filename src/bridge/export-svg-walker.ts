// SPDX-License-Identifier: MPL-2.0
/**
 * The DOM -> SVG walker: renderSvgFromHtml() and the helpers only it uses. This is
 * the vector export path every /info screenshot and every text-outline SVG/PDF goes
 * through; it lived inside export.ts until 2026-09-08 and was extracted verbatim so
 * it can be read, tested and grown on its own. export.ts imports from here; this
 * file never imports export.ts.
 */
import { canCarryWatermark, parseDropShadowFilter, splitCssArgs, parseConicGradient, toCssPx, toCssLength, parseClipShape, parseCssMatrix, isAxisAlignedMat, matToSvg, matAboutPivot, isNonAffineTransform, CSS_DPI, parseBoxShadow, roundedRectPath, insetCorners, gaussianShadowRings, uniformRadius, extractC2paStore, prepareC2paIngredientFromStore } from '@lolly/engine';
import type { Mat2D } from '@lolly/engine';
import { textStrokeAttrs, canVectoriseText, textBaselineY, applyTextTransform } from './text-svg.ts';
import { createInlineTextContext, emitInlineTextSvg, isReplaced } from './export-text.ts';
import type { InlineTextContext } from './export-text.ts';
export { decoFlags, mergeDeco, isReplaced, visualLines } from './export-text.ts';
export type { Deco } from './export-text.ts';
import { resolveVectorFont } from './font-registry.ts';
import { namespaceInlinedSvgIds } from './svg-inline-ids.ts';
import { newNeutraliseGuard, neutraliseTransform } from './transform-neutralise.ts';
import { placeBackground } from './bg-layout.ts';
import { parseCssFilter, isDropShadowOnly } from './css-filter.ts';
import type { FilterPrimitive } from './css-filter.ts';
import { describeControl, isWidgetControl, controlText, rangeFraction } from './form-controls.ts';
import type { ControlDesc } from './form-controls.ts';
import { stackingRole, isFlexOrGridContainer, orderModifiedChildren, sortUnits } from './stacking-order.ts';
import type { StackingRole } from './stacking-order.ts';
import { unscopeStyleEls } from '../lib/scope-css.ts';
import { parseSvgRoot, namespaceSvgRefs } from '../lib/vector-paint.ts';
import type { VectorTwinCanvas } from '../lib/vector-paint.ts';
import type { ClipShape } from '../../../../engine/src/css-paint.ts';
import type { CornerRadii, CornerPair } from '../../../../engine/src/css-box.ts';
import { n2, objectPositionFractions, parseCssColorFull, resolveRadii, rgbaCss, parseCssLen } from './export-css.ts';
import { injectSvgMeta } from './export-image-meta.ts';
import { pureRotationDeg, borderDashArray, preserveAspectRatioAlign } from './export-pdf-vector.ts';
import { imprintCanvas, blobToDataUrl, _host, exportDims, makeRoundedFill, MAX_RASTER_PX, makeSvgRect, fontMetricsPx, getDomToImage, swapBlobUrls } from './export-shared.ts';
import type { ImprintState, ExportOpts, Rgba } from './export-shared.ts';
import { buildLinearGradientEl, buildRadialGradientEl, conicFanEl } from './export-gradients.ts';

// Imprint a LOLLY-RENDERED raster that's about to be baked into a container (a
// PDF page, a PPTX slide, an SVG <image>). Two extra gates over the standalone
// raster encoders: (1) `imprint.want` - the caller only threads a want-set sink
// for opts.imprint AND a Lolly-own render, never a passed-through user image
// (those call sites omit the sink → undefined); and (2) canCarryWatermark - an
// embed chokepoint sees many small decorative rasters (gradient chips, icons), so
// anything below the ~240px detection floor is skipped as wasted work. NEVER call
// this on a user's own embedded photo/logo bytes.
//
// SINGLE writer of ImprintState.applied: the flag flips true here, and only here,
// the moment a mark is genuinely embedded - so stampC2pa can never claim an
// imprint a render didn't actually apply (a pure-vector page keeps applied=false).
export function imprintEmbedCanvas(canvas: HTMLCanvasElement, imprint: ImprintState | undefined): void {
  if (imprint?.want && canCarryWatermark(canvas.width, canvas.height)) {
    imprintCanvas(canvas);
    imprint.applied = true;
  }
}


// Remove comment nodes from a subtree. A tool's template.html comments serialise
// verbatim into its SVG export as pure dead weight - e.g. filter-duotone's ~674 KB
// commented-out declarative fallback <image>. Comments never render, so strip them
// from every clone we serialise to SVG. Works on detached nodes (the export clones).
export function stripCommentNodes(root: Node): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  const comments: Node[] = [];
  while (walker.nextNode()) comments.push(walker.currentNode);
  for (const c of comments) c.parentNode?.removeChild(c);
}


// Returns a short reason string when `el` uses CSS the vector walkers can't faithfully
// reproduce (they'd SILENTLY DROP it), so the caller rasterises the node's subtree and
// embeds it as an image instead. Returns null for everything the walkers DO handle - 
// that null-by-default is what keeps normal vector output byte-identical to before.
// `vectorCaps` lets a caller declare features IT can emit natively: the SVG walker
// carries mix-blend-mode as a style and emits circle/ellipse/inset clips as <clipPath>
// shapes, so it keeps those vector rather than rasterising (PDF/EMF/EPS still raster).
/** `backdrop-filter: blur(6px)` → 6. Null for anything that is not a single blur():
 *  a chain like `blur(4px) saturate(1.3)` genuinely has no SVG equivalent, because
 *  the extra functions operate on the backdrop we can only approximate. */
export function parseBackdropBlurPx(bf: string): number | null {
  const m = /^\s*blur\(\s*([\d.]+)px\s*\)\s*$/i.exec(bf || '');
  const v = m ? parseFloat(m[1]!) : NaN;
  return Number.isFinite(v) && v >= 0 ? v : null;
}

export function detectUnsupportedCss(el: Element, s: CSSStyleDeclaration, vectorCaps?: { blend?: boolean; clipBasicShapes?: boolean; dropShadow?: boolean; cssFilter?: boolean; backdropBlur?: boolean; conic?: boolean }): string | null {
  const tag = el.tagName.toLowerCase();
  // <img> filters are already baked (bakeImageFilter); <svg> subtrees have their own
  // faithful/raster paths. Never rasterise those here.
  if (tag === 'img' || tag === 'svg') return null;

  // filter: TWO vector routes, and BOTH are caller-declared, because only one walker
  // can drive them. drop-shadow(s) become real geometry (vectorCaps.dropShadow →
  // <feDropShadow>), and every other CSS filter function is spec-defined AS an SVG
  // filter, so the chain can be emitted verbatim (vectorCaps.cssFilter). A chain
  // containing something with no SVG equivalent - a url() reference, an unknown
  // function - rasterises for everyone.
  //
  // `cssFilter` is a cap and not a bare `parseCssFilter(...)` test because "this value
  // is expressible as an SVG filter" is NOT the same claim as "the caller will emit
  // one". It was written as the bare test, so `filter: blur(6px)` was declared
  // supported for EVERY caller while only the SVG walker fulfilled it: the PDF walker
  // has no filter branch at all, so DOF blur and the design `shadow: content` /
  // `shadow: depth` silhouettes were dropped from PDF in silence - no raster, no
  // warning, no shadow. (Coloured drop-shadows escaped by accident: their computed
  // value nests an rgba(), which parseCssFilter's flat tokeniser refuses, so they fell
  // through to the hatch. A parser limitation is not a policy.) Declaring it makes the
  // PDF walker take the per-element raster escape hatch instead - plan 104 section 2, P1d.
  if (s.filter && s.filter !== 'none'
      && !(vectorCaps?.dropShadow && parseDropShadowFilter(s.filter))
      && !(vectorCaps?.cssFilter && parseCssFilter(s.filter))) return `filter:${s.filter}`;
  const bf = s.backdropFilter || (s as { webkitBackdropFilter?: string }).webkitBackdropFilter;
  // A blur-only backdrop-filter IS expressible: duplicate the content already painted
  // behind the element, clip that duplicate to the element's own shape, and blur it.
  // The caller declares support via vectorCaps.backdropBlur - anything richer than a
  // single blur() (saturate, brightness, a filter chain) still has no vector form.
  if (bf && bf !== 'none' && !(vectorCaps?.backdropBlur && parseBackdropBlurPx(bf) !== null)) return `backdrop-filter:${bf}`;
  // mix-blend-mode: SVG can carry it natively; only raster where the walker can't.
  if (s.mixBlendMode && s.mixBlendMode !== 'normal' && !vectorCaps?.blend) return `mix-blend-mode:${s.mixBlendMode}`;

  const mask = s.maskImage || (s as { webkitMaskImage?: string }).webkitMaskImage
    || (s.mask && s.mask !== 'none' && s.mask !== 'match-source' ? s.mask : '');
  if (mask && mask !== 'none') return `mask:${mask}`;

  // clip-path: polygon() is always kept vector; circle()/ellipse()/inset() are kept only
  // where the caller emits them as a <clipPath> (vectorCaps.clipBasicShapes); url()/path()
  // are never vectorisable → rasterise. (border-radius circles on <img> handled elsewhere.)
  const cp = s.clipPath || (s as { webkitClipPath?: string }).webkitClipPath;
  if (cp && cp !== 'none') {
    const isPolygon = cp.indexOf('polygon(') === 0;
    const isBasicShape = isPolygon || /^(circle|ellipse|inset)\(/i.test(cp);
    if (!isPolygon && !(isBasicShape && vectorCaps?.clipBasicShapes)) return `clip-path:${cp}`;
  }

  // background-image: linear/radial gradients emit true SVG/PDF gradients; a SINGLE
  // non-tiling url() emits a real <image> (vector-first - keeps the box's text vector).
  // Only cases with no single-<image> equivalent rasterise: conic-gradient, a TILING
  // background (repeat at intrinsic/auto size), or MULTIPLE layered url() images.
  const bi = s.backgroundImage;
  if (bi && bi !== 'none') {
    // PER LAYER, because `background-image` is a list and every parser below takes ONE
    // gradient. The transparency checker is the case that proves it: authored as
    // `background: <repeating-conic-gradient> 50% / 14px 14px, <colour>`, it computes to
    // `repeating-conic-gradient(…), none` - the colour layer contributes a `none` - and
    // handing that whole string to parseConicGradient fails, so the checker was declared
    // unvectorisable and the entire node was rasterised. That is how a 1080×676 PNG of a
    // faint checkerboard ended up inside docs/shots/use-chart-output.svg.
    const layers = splitCssArgs(bi).map((l) => l.trim()).filter((l) => l && l !== 'none');
    // A conic gradient is drawn as a wedge fan when we can parse it - but ONLY by the
    // SVG walker. The PDF walker has no conic branch (its gradient path handles linear
    // and radial), and sampleGradientMidpoint returns null for a conic, so exempting it
    // there dropped the sweep entirely: a box with a transparent flat fill lost its
    // paint. So the exemption is scoped to the caller that can honour it.
    for (const layer of layers) {
      if (layer.includes('conic-gradient')
        && !(vectorCaps?.conic && parseConicGradient(layer, 100, 100))) return 'conic-gradient';
    }
    if (bi.includes('url(')) {
      const multiple = (bi.match(/url\(/g) || []).length > 1;
      const rep = (s.backgroundRepeat || 'repeat').toLowerCase();
      const size = (s.backgroundSize || 'auto').toLowerCase();
      void size; void rep;
      // A tiling background is emitted as an SVG <pattern> now, so only MULTIPLE
      // layered url() images still have no single-element equivalent.
      if (multiple) return 'background-image:url()';
    }
  }

  // NB: skew / 3-D transforms are deliberately NOT rasterised here. dom-to-image
  // captures the node with a plain scale (its own transform is overwritten), so the
  // skew/3-D wouldn't be reproduced anyway - rasterising would only turn crisp vector
  // text into a bitmap for no gain. Leave those to the (axis-aligned) vector walk;
  // pure rotation is already reproduced upstream (SVG rotate / withPdfRotation).
  return null;
}

// CSS basic-shape / gradient / drop-shadow value parsing lives DOM-free in the engine
// (parseClipShape / parseRadialGradient / parseDropShadowFilter - engine/src/css-paint.ts),
// so the SVG and PDF walkers share one parser. This file keeps only the DOM assembly:
// turning that geometry into SVG elements (svgClipShapeEl / build*El) or jsPDF ops.

// Build the SVG shape element for a ClipShape, offset into root coords by (ox, oy).
function svgClipShapeEl(NS: string, shape: ClipShape, ox: number, oy: number): Element {
  if (shape.kind === 'circle') {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', String(n2(ox + shape.cx))); c.setAttribute('cy', String(n2(oy + shape.cy)));
    c.setAttribute('r', String(n2(shape.r)));
    return c;
  }
  if (shape.kind === 'ellipse') {
    const e = document.createElementNS(NS, 'ellipse');
    e.setAttribute('cx', String(n2(ox + shape.cx))); e.setAttribute('cy', String(n2(oy + shape.cy)));
    e.setAttribute('rx', String(n2(shape.rx))); e.setAttribute('ry', String(n2(shape.ry)));
    return e;
  }
  if (shape.kind === 'inset') {
    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', String(n2(ox + shape.x))); rect.setAttribute('y', String(n2(oy + shape.y)));
    rect.setAttribute('width', String(n2(shape.w))); rect.setAttribute('height', String(n2(shape.h)));
    if (shape.r > 0) { rect.setAttribute('rx', String(n2(shape.r))); rect.setAttribute('ry', String(n2(shape.r))); }
    return rect;
  }
  // `empty` never reaches here - callers return before drawing (a zero-area clip
  // paints nothing). Emitting a degenerate rect would be a silent 1px artefact,
  // so be explicit rather than letting it fall through to the polygon branch.
  if (shape.kind === 'empty') {
    const none = document.createElementNS(NS, 'rect');
    none.setAttribute('width', '0'); none.setAttribute('height', '0');
    return none;
  }
  const poly = document.createElementNS(NS, 'polygon');
  poly.setAttribute('points', shape.points.map((p: [number, number]) => `${n2(ox + p[0])},${n2(oy + p[1])}`).join(' '));
  return poly;
}

// The rotation pivot (transform-origin) of `el` in the walker's root-relative
// coordinate space, measured from the element's UNROTATED border box. Call while
// the element's rotation is neutralised so `unrotRect` is the axis-aligned box.
export function rotationPivot(
  style: CSSStyleDeclaration,
  unrotRect: { left: number; top: number },
  rootRect: { left: number; top: number },
): { x: number; y: number } {
  const o = (style.transformOrigin || '50% 50%').split(' ').map(parseFloat);
  return {
    x: (unrotRect.left - rootRect.left) + (o[0] || 0),
    y: (unrotRect.top - rootRect.top) + (o[1] || 0),
  };
}

// The first url(...) in a CSS value (e.g. background-image), unquoted; null if none.
export function firstCssUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  // The quote character is the TERMINATOR, so a quote of the other kind inside the
  // URL survives. The old pattern was `(["']?)([^)"']+)\1`, whose character class
  // banned BOTH quote marks from the body - which silently dropped every inline
  // SVG data-URI, since those are full of `xmlns='…'`. That is how the select
  // chevron (--field-chevron, styles/parts/fields.css:42 - one declaration, on
  // every <select> in the app) vanished from SVG and PDF exports: firstCssUrl
  // returned null, so the background branch never ran and nothing was emitted.
  // Three alternatives, in CSS's own order: "double", 'single', or bare.
  const m = String(value).match(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]([^)]*[^)\s])?))\s*\)/);
  if (!m) return null;
  return (m[1] ?? m[2] ?? m[3] ?? '').trim() || null;
}

// A CSS url() → a self-contained href: a data: URI stays as-is; blob:/http/relative are
// fetched and inlined as a data: URI (so the SVG renders in secure static mode). Null on fail.
export async function cssUrlToHref(url: string): Promise<string | null> {
  try { return url.startsWith('data:') ? url : await blobToDataUrl(url); }
  catch { return null; }
}

// preserveAspectRatio for a background-image sized via `background-size` + positioned via
// `background-position`: cover→slice, contain→meet, two explicit lengths (e.g. 100% 100%)→
// none (stretch), else cover-like (the common decorative default). Alignment from position.
/** One parsed CSS filter function as its SVG element. The maths is all in
 *  css-filter.ts; this is assembly only. */
function filterPrimitiveEl(NS: string, p: FilterPrimitive): Element {
  if (p.kind === 'blur') {
    const e = document.createElementNS(NS, 'feGaussianBlur');
    e.setAttribute('stdDeviation', String(Math.round(p.stdDeviation * 1000) / 1000));
    return e;
  }
  if (p.kind === 'colorMatrix') {
    const e = document.createElementNS(NS, 'feColorMatrix');
    e.setAttribute('type', 'matrix');
    e.setAttribute('values', p.values.map((n) => Math.round(n * 10000) / 10000).join(' '));
    return e;
  }
  if (p.kind === 'hueRotate') {
    const e = document.createElementNS(NS, 'feColorMatrix');
    e.setAttribute('type', 'hueRotate');
    e.setAttribute('values', String(Math.round(p.deg * 1000) / 1000));
    return e;
  }
  const e = document.createElementNS(NS, 'feComponentTransfer');
  const chan = (name: string) => {
    const f = document.createElementNS(NS, name);
    if (p.mode === 'linear') {
      f.setAttribute('type', 'linear');
      f.setAttribute('slope', String(Math.round((p.slope ?? 1) * 10000) / 10000));
      f.setAttribute('intercept', String(Math.round((p.intercept ?? 0) * 10000) / 10000));
    } else if (p.mode === 'invert') {
      // invert(a) is the spec's table [a, 1-a] per channel.
      f.setAttribute('type', 'table');
      f.setAttribute('tableValues', `${p.amount ?? 1} ${1 - (p.amount ?? 1)}`);
    } else {
      f.setAttribute('type', 'linear');
      f.setAttribute('slope', String(p.amount ?? 1));
      f.setAttribute('intercept', '0');
    }
    return f;
  };
  if (p.mode === 'alpha') { e.appendChild(chan('feFuncA')); return e; }
  for (const c of ['feFuncR', 'feFuncG', 'feFuncB']) e.appendChild(chan(c));
  return e;
}

/** One top-level CSS filter function, allowing ONE level of nesting in its argument - 
 *  a colour function (`rgba(…)`) is the only thing that ever appears inside one. */
const FILTER_FN_RE = /[a-z-]+\((?:[^()]|\([^()]*\))*\)/gi;

/**
 * How far past its own box an element's `filter` paints, in CSS px.
 *
 * Only the filter: box-shadow is drawn separately by both walkers, and a transform is
 * neutralised before capture. A blur reaches ~3σ, and drop-shadow's σ IS its blur
 * value (unlike box-shadow's, which is half it - see buildDropShadowFilterEl).
 *
 * Measured PER TOP-LEVEL FUNCTION, not by handing the whole value to one parser, because
 * a MIXED chain defeats both of them: parseDropShadowFilter refuses any chain containing
 * a non-drop-shadow function, and parseCssFilter's flat tokeniser cannot see past the
 * nested rgba() of a coloured drop-shadow. `filter: blur(10px) drop-shadow(rgba(0,0,0,
 * 0.33) 0px 15px 30px)` - exactly what design emits for a blurred box carrying a
 * depth shadow - therefore measured ZERO spill, so the raster hatch cropped the effect
 * off at the box edge for the one case that spills furthest. Each function is still
 * measured by the engine parsers; only the splitting is done here.
 */
export function effectSpillCss(style: CSSStyleDeclaration): number {
  const f = style.filter;
  if (!f || f === 'none') return 0;
  let reach = 0;
  for (const [fn] of f.matchAll(FILTER_FN_RE)) {
    for (const sh of parseDropShadowFilter(fn) ?? []) {
      reach = Math.max(reach, sh.blur * 3 + Math.max(Math.abs(sh.dx), Math.abs(sh.dy)));
    }
    for (const p of parseCssFilter(fn) ?? []) {
      if (p.kind === 'blur') reach = Math.max(reach, p.stdDeviation * 3);
    }
  }
  return Math.min(200, reach);   // bounded: a pathological blur must not explode the capture
}

/** A computed length off a style, as a number. Missing/`auto` reads as 0. */
function num2(style: CSSStyleDeclaration, key: string): number {
  return Number.parseFloat((style as unknown as Record<string, string>)[key] || '') || 0;
}

/**
 * Place an object-fit image EXACTLY, where `preserveAspectRatio` cannot.
 *
 * SVG's preserveAspectRatio names only nine alignments - min/mid/max per axis -
 * so it can express object-position 0%, 50% and 100% and nothing in between. That
 * was invisible while every tool centred its photos; it became a real defect the
 * moment framing gave users a continuous pan (plans/148), because an image panned
 * to 32% exported at 50% and the preview and the file disagreed.
 *
 * Returns the fitted rectangle to write as explicit x/y/width/height (with
 * preserveAspectRatio="none" - the aspect is already baked into the numbers), or
 * null when the alignment IS exactly expressible, in which case the caller keeps
 * the preserveAspectRatio form and its output is byte-identical to before.
 * The PDF walker has always placed images this way (see its object-fit branch);
 * this brings the SVG walker onto the same footing.
 */
function exactFittedRect(
  style: CSSStyleDeclaration,
  natW: number, natH: number,
  x: number, y: number, w: number, h: number,
): { x: number; y: number; w: number; h: number } | null {
  const fit = style.objectFit;
  if (fit !== 'cover' && fit !== 'contain') return null;
  if (!(natW > 0) || !(natH > 0)) return null;
  const [px, py] = objectPositionFractions(style.objectPosition);
  const expressible = (f: number): boolean => f === 0 || f === 0.5 || f === 1;
  if (expressible(px) && expressible(py)) return null;
  const s = fit === 'cover' ? Math.max(w / natW, h / natH) : Math.min(w / natW, h / natH);
  const fw = natW * s, fh = natH * s;
  return { x: x + (w - fw) * px, y: y + (h - fh) * py, w: fw, h: fh };
}

/**
 * An image's natural size, for resolving `background-size: auto`.
 *
 * Memoised by href because the same chevron data-URI is the background of every
 * select on the page, and each miss is a decode. A failure resolves to null rather
 * than rejecting: CSS then treats the image as area-sized, which is exactly the
 * behaviour this replaced, so an undiscoverable image degrades to the old output
 * instead of vanishing.
 */
const intrinsicCache = new Map<string, Promise<{ w: number; h: number } | null>>();
function intrinsicSize(href: string): Promise<{ w: number; h: number } | null> {
  let p = intrinsicCache.get(href);
  if (!p) {
    p = new Promise<{ w: number; h: number } | null>((resolve) => {
      const im = new Image();
      const done = (v: { w: number; h: number } | null) => resolve(v);
      im.onload = () => done(im.naturalWidth > 0 ? { w: im.naturalWidth, h: im.naturalHeight } : null);
      im.onerror = () => done(null);
      im.src = href;
      // A never-settling decode must not hang an export.
      setTimeout(() => done(null), 3000);
    });
    intrinsicCache.set(href, p);
  }
  return p;
}

// ── Vector twins for <canvas> ────────────────────────────────────────────────
// A canvas is pixels by construction, so the walker rasterises it. But some of
// those canvases are painting something that HAS a vector form - the sequence
// editor's clip bars are rectangles, waveform bars and tiled thumbnails, drawn
// to a canvas only because that is the cheap way to repaint a timeline at 60fps.
// A painter that knows its own vector form advertises it by hanging a
// `__lollyVectorTwin` producer off the canvas element (see lib/vector-paint.ts).
//
// The contract is presence-keyed and deliberately invisible: no ExportOpts field,
// no attribute, no flag. A canvas WITHOUT the property must serialise
// byte-identically to how it always has - that is the safety guarantee for every
// tool export in every profile, and it is pinned by a golden in
// export-paint-order.test.ts.
//
// Re-entrancy: a producer may build its markup by calling the walker itself (the
// timeline's node-thumbnail twin does). Only the OUTERMOST walk may use twins - 
// otherwise a producer that renders a subtree containing its own canvas recurses.
// `twinDepth` is module-scope rather than per-call because the re-entrant call is
// a *separate* renderSvgFromHtml invocation, so a per-call local could not see it.
let twinDepth = 0;
const TWIN_TIMEOUT_MS = 2000;

/**
 * Resolve a canvas's vector twin into an element ready for insertion, or null.
 *
 * Null is the designed fall-through: every rejection (no property, nested walk,
 * timeout, throw, unparseable markup) leaves the caller to run the unmodified
 * toDataURL block, so the worst case is exactly today's output.
 */
async function vectorTwinEl(el: HTMLCanvasElement, mintPrefix: () => string): Promise<Element | null> {
  const produce = (el as VectorTwinCanvas).__lollyVectorTwin;
  if (typeof produce !== 'function' || twinDepth !== 0) return null;
  twinDepth++;
  try {
    // A producer that never settles must not hang an export; the race abandons the
    // wait (the producer itself keeps running, as with the runtime's hook budget).
    //
    // The guard is released when the PRODUCER settles, not when the race resolves.
    // Decrementing on the timeout branch would drop `twinDepth` back to 0 while an
    // abandoned producer is still running, so its own nested renderSvgFromHtml would
    // then see an unguarded walker and recurse - and the timeline producer's
    // `withBorrowedVisibility` lease strips `.seq-off` from LIVE stage boxes, so an
    // unguarded abandoned producer is a visible artefact on screen, not just wasted work.
    let settled = false;
    const running = Promise.resolve(produce()).finally(() => {
      settled = true;
      twinDepth--;
    });
    const markup = await Promise.race([
      running.catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TWIN_TIMEOUT_MS)),
    ]);
    if (!settled) return null;                       // timed out; the producer owns the decrement
    if (typeof markup !== 'string') return null;
    const parsed = parseSvgRoot(markup);
    if (!parsed) return null;
    const root = document.importNode(parsed, true) as Element;
    // Same normalisation the inline-<svg> passthrough applies (see the `tag === 'svg'`
    // branch): comments out, scoped-style attribute selectors undone, blob: URLs
    // inlined so the emitted file stands alone.
    stripCommentNodes(root);
    unscopeStyleEls(root);
    await inlineBlobUrlsInEl(root);
    // Ids are only unique within the twin that minted them - see namespaceSvgRefs.
    // The prefix is minted HERE, not at the call site: `uid` is the document's id
    // counter, and burning one on a twin that turns out to be null would shift every
    // later id in the file relative to the same document exported without twins.
    namespaceSvgRefs(root, mintPrefix());
    return root;
  } catch (e) {
    _host?.log?.('warn', `svg: <canvas> vector twin failed, falling back to raster - ${(e as Error).message}`);
    return null;
  }
}

// Exported for bridge/export-paint-order.test.ts, which drives the REAL walker in
// a REAL Chromium: jsdom cannot be the oracle for paint order, because the whole
// thing hinges on getComputedStyle resolving z-index, isolation and display
// blockification. Not part of the bridge's public surface otherwise.
export async function renderSvgFromHtml(node: Element, opts: ExportOpts): Promise<Blob> {
  // Capture once before shaping yields; other bridge instances may replace _host.
  const host = _host;
  const textContext = createInlineTextContext({
    text: opts.convertPaths !== false ? host?.text ?? null : null,
    log: host?.log?.bind(host), resolveFont: resolveVectorFont, fontMetrics: fontMetricsPx,
  });
  return renderHtmlSvg(node, opts, textContext);
}

async function renderHtmlSvg(node: Element, opts: ExportOpts, textContext: InlineTextContext): Promise<Blob> {
  const NS = 'http://www.w3.org/2000/svg';
  // Text → vector <path> by default (self-contained, font-independent SVG). The
  // 'Convert paths' export toggle (opts.convertPaths) turns this off, falling back
  // to <text> elements everywhere for selectable, editable output.
  const vectorText = opts.convertPaths !== false;
  const { width: nodeW, height: nodeH } = node.getBoundingClientRect();
  const d = exportDims(node, opts);
  // viewBox lives in CSS px (physical units at 96dpi); the width/height carry
  // the real unit so the SVG renders at the correct physical size.
  const vbW = toCssPx(d.w);
  const vbH = toCssPx(d.h);
  const scaleX  = vbW / nodeW;
  const scaleY  = vbH / nodeH;

  const svgEl = document.createElementNS(NS, 'svg');
  svgEl.setAttribute('xmlns',   NS);
  svgEl.setAttribute('width',   toCssLength(d.w));
  svgEl.setAttribute('height',  toCssLength(d.h));
  svgEl.setAttribute('viewBox', `0 0 ${vbW} ${vbH}`);

  const defs     = document.createElementNS(NS, 'defs');
  svgEl.appendChild(defs);

  const rootRect = node.getBoundingClientRect();
  let uid = 0;
  // Per-walk state for the transform neutralise branches below (see
  // bridge/transform-neutralise.ts): which elements are mid-neutralise, and the one
  // warning line a walk may spend saying a transform could not be stilled.
  const neutralise = newNeutraliseGuard();
  const warnTransform = (m: string): void => { _host?.log?.('warn', `svg: ${m}`); };
  // How many elements went out as a posed raster instead of vector (plans/104 section 12 Q2).
  // Counted rather than logged per element: a lifted stack under a tilted camera is
  // every layer, and one line naming the total is the honest report. It is also what
  // the amber notice in the export panel is telling the user in advance.
  let tiltedRasters = 0;

  // Cooperative yielding: the SVG-IR walk + host.text.toPath (HarfBuzz) shaping
  // runs fully synchronously and janks the UI for the whole export on a complex
  // document. Mirror the CMYK pixel pass - every YIELD_NODES elements, report
  // progress and hand the event loop a turn. Purely additive: emitted geometry
  // and node order are untouched, so the serialised SVG bytes are identical.
  const totalNodes = ((node as any).querySelectorAll?.('*').length ?? 0) + 1;
  let nodesWalked = 0;
  const YIELD_NODES = 200;

  const rootG = document.createElementNS(NS, 'g');
  if (Math.abs(scaleX - 1) > 1e-4 || Math.abs(scaleY - 1) > 1e-4) {
    rootG.setAttribute('transform', `scale(${scaleX.toFixed(6)},${scaleY.toFixed(6)})`);
  }
  svgEl.appendChild(rootG);

  // Emit a vector <clipPath> for a circle()/ellipse()/inset()/polygon() clip-path onto
  // `g` (shape parsed box-local, then offset to root coords). Returns true if emitted;
  // false for url()/path()/unparseable → the caller rasterises. Geometry parsing is the
  // shared parseClipShape so the SVG and PDF walkers agree on the shape.
  const emitClip = (cp: string, x: number, y: number, w: number, h: number, g: Element): 'ok' | 'empty' | 'unsupported' => {
    const shape = parseClipShape(cp, w, h);
    if (!shape) return 'unsupported';
    // A zero-area clip is fully understood and renders nothing. Report it so the
    // caller can SKIP the element instead of handing it to the raster hatch.
    if (shape.kind === 'empty') return 'empty';
    const cid = `fcclip-${++uid}`;
    const clip = document.createElementNS(NS, 'clipPath');
    clip.setAttribute('id', cid);
    clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
    clip.appendChild(svgClipShapeEl(NS, shape, x, y));
    defs.appendChild(clip);
    g.setAttribute('clip-path', `url(#${cid})`);
    return 'ok';
  };

  // ── Stacking-context paint order (opts.stackingOrder) ────────────────────────
  //
  // The walk stays a single DOM-order pass; correctness comes from DEFERRED
  // APPEND. A child whose Appendix E section E.2 layer is 2, 6 or 7 is built exactly as
  // before but left DETACHED, parked in its stacking context's frame, and
  // appended when that context finishes. Layers 3 and 4 append immediately, as
  // they always have.
  //
  // Two facts about this walker are what make that free, and both were verified
  // against the code before the design was chosen:
  //
  //  1. EVERYTHING IS EMITTED IN ROOT COORDINATES (`x = rect.left - rootRect.left`
  //     throughout, `clipPathUnits="userSpaceOnUse"` on every clip). A <g> can be
  //     re-parented anywhere with NO geometry fix-up. There is no need to rebuild
  //     the tree into per-layer bucket groups.
  //  2. EVERY APPEARANCE-CHANGING WRAPPER THE WALKER EMITS IS ITSELF A STACKING-
  //     CONTEXT CREATOR - opacity, clip-path, mix-blend-mode, filter, rotate,
  //     matrix. So a hoist terminates at each of them by construction, and the
  //     ONLY wrapper a deferred unit can be lifted out of is the overflow-clip
  //     group, which is a single re-appliable `clip-path` attribute (ctx.clips).
  //
  // `appendChild` on an already-parented node MOVES it, so no bucket groups are
  // created and the emitted node count is unchanged apart from hoist clip
  // wrappers. Cost: one pointer per deferred element (~300 on the gallery
  // fixture, against a 2.2 MB output) and no second pass or second tree, so the
  // 200-node cooperative yield is untouched.
  //
  // Given away deliberately: the emitted tree is no longer monotonic during the
  // walk, so streaming serialisation is impossible and a mid-walk throw leaves
  // orphaned detached subtrees. Neither matters today (one serialise at the end;
  // the walk already throws on failure), but both are now foreclosed.

  /** One deferred paint unit: the <g> (possibly wrapped in re-applied clips) and
   *  the used z-index it sorts by. */
  interface PaintUnit { z: number; g: Element }
  /** One stacking context, alive while its element's subtree is being walked. */
  interface ScFrame {
    /** Where deferred units land - the context element's contentG. */
    content: Element;
    /** Last own-paint node when contentG === g, else null. See the finalisation
     *  block for why layer 2 cannot just insert at firstChild. */
    anchor: ChildNode | null;
    neg: PaintUnit[];   // section E.2 step 3 - negative z, most negative first
    z0: PaintUnit[];    // section E.2 step 8 - positioned, z-index auto|0, TREE order
    pos: PaintUnit[];   // section E.2 step 9 - positive z, least positive first
  }
  /** What a child inherits. `frame === null` ⇒ the flag is off ⇒ every append is
   *  the append this walker has always done. */
  interface PaintCtx {
    frame: ScFrame | null;
    /** Ids of overflow clipPaths emitted between `frame`'s element and here - a
     *  hoisted unit must carry them or it escapes a clip it has today. */
    clips: string[];
    /** Intersection of every ancestor overflow box, in root coordinates. A node
     *  that misses it entirely paints nothing on screen, so it is not emitted - 
     *  the cheapest form of clip reduction, since it removes the node AND the
     *  clip work that would have hidden it. Null means unbounded. */
    clipBox?: Rect | null;
    /** Union of the boxes actually painted beneath the nearest clip candidate.
     *  Filled during the walk so the decision "is this clip doing any work?" can
     *  be made from measurements rather than guessed up front. */
    bounds?: Bounds | null;
  }

  /** A box in root coordinates. */
  interface Rect { x: number; y: number; w: number; h: number }
  /** A mutable union accumulator. Empty until something expands it. */
  interface Bounds { minX: number; minY: number; maxX: number; maxY: number; any: boolean }
  const newBounds = (): Bounds => ({ minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity, any: false });
  const expand = (b: Bounds | null | undefined, x: number, y: number, w: number, h: number): void => {
    if (!b) return;
    b.minX = Math.min(b.minX, x); b.minY = Math.min(b.minY, y);
    b.maxX = Math.max(b.maxX, x + w); b.maxY = Math.max(b.maxY, y + h);
    b.any = true;
  };
  const intersectRect = (a: Rect | null | undefined, b: Rect): Rect => {
    if (!a) return b;
    const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
    return { x, y, w: Math.min(a.x + a.w, b.x + b.w) - x, h: Math.min(a.y + a.h, b.y + b.h) - y };
  };

  const stackingOrder = opts.stackingOrder === true;
  /** What every element classifies as when the flag is off: in-flow, no context.
   *  Shared constant so the OFF path allocates nothing per node. */
  const DOM_ORDER_ROLE: StackingRole = { createsContext: false, reason: '', layer: 3, z: 0, order: 0 };
  /** Top layer (`<dialog open>` shown modally, an open popover). Guarded because
   *  `:popover-open` throws in engines that don't know the selector.
   *
   *  KNOWN LIMITATION: this only makes a top-layer box a stacking CONTEXT so its
   *  internals order correctly. It does NOT lift it above the rest of the
   *  document (HTML section top layer) and `::backdrop` is not modelled at all
   *  (pseudoDescriptor sees only ::before/::after). On the measured fixtures
   *  that is the single largest remaining paint-order defect - ~36 points of
   *  local-gallery's loss, against ~2 points for everything this flag fixes - 
   *  and it is a separate milestone. */
  const topLayer = (el: Element): boolean => {
    try { return typeof el.matches === 'function' && el.matches(':modal, :popover-open'); }
    catch { return false; }
  };

  /** Append `unit` where CSS says it paints. Returns a handle so a caller that
   *  later abandons the element (the zero-area clip-path early return) can undo
   *  the deferral; null when the unit went straight into `parentG`. */
  const place = (
    unit: Element, role: StackingRole, ctx: PaintCtx, parentG: Element, direct?: boolean,
  ): { list: PaintUnit[]; entry: PaintUnit } | null => {
    // `direct` is the transform re-entry (see its call sites); `!ctx.frame` is
    // the flag being off; layers 3/4 are in-flow content, which paints exactly
    // where DOM order puts it. All three are byte-for-byte the old behaviour.
    if (direct || !ctx.frame || role.layer === 3 || role.layer === 4) { parentG.appendChild(unit); return null; }
    // Re-apply every overflow clip crossed by the hoist, outermost first. The
    // <clipPath> already lives in <defs> with a stable id in ROOT coordinates,
    // so this costs one attribute and no geometry.
    //
    // KNOWN LIMITATION (CSS 2.1 section 11.1.1): an absolutely-positioned box is NOT
    // clipped by a non-positioned ancestor's `overflow`, and `fixed` escapes
    // almost all clips. We re-apply every crossed clip anyway. Deliberate: that
    // is exactly what the walker does today, and getting the containing-block
    // chain wrong UNCLIPS content, which is a far worse failure than
    // mis-ordering. Revisit only with a fixture that demonstrates the escape.
    let top: Element = unit;
    for (let i = ctx.clips.length - 1; i >= 0; i--) {
      const wrap = document.createElementNS(NS, 'g');
      wrap.setAttribute('clip-path', `url(#${ctx.clips[i]})`);
      wrap.appendChild(top);
      top = wrap;
    }
    const list = role.layer === 2 ? ctx.frame.neg : role.layer === 6 ? ctx.frame.z0 : ctx.frame.pos;
    const entry: PaintUnit = { z: role.z, g: top };
    list.push(entry);
    return { list, entry };
  };

  /**
   * Paint a form control's contents: the text it displays, or the geometry of a
   * widget the UA draws.
   *
   * Text is NOT laid out here. A throwaway mirror is positioned over the control's
   * content box, given its font and alignment, and walked with the same
   * emitInlineTextSvg every other block goes through - so wrapping, direction,
   * vertical centring and line boxes come from the browser. Reimplementing them
   * would be a second, worse CSS. The mirror lives for one await and is removed in a
   * finally, including when the text pass throws.
   */
  async function emitControlPaint(el: Element, _tag: string, style: CSSStyleDeclaration, contentG: Element): Promise<void> {
    const d = describeControl(el);
    if (!d) return;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;

    const num = (k: string) => Number.parseFloat((style as unknown as Record<string, string>)[k] || '') || 0;
    const insetL = num('borderLeftWidth') + num('paddingLeft');
    const insetT = num('borderTopWidth') + num('paddingTop');
    const insetR = num('borderRightWidth') + num('paddingRight');
    const insetB = num('borderBottomWidth') + num('paddingBottom');
    const cw = Math.max(0, r.width - insetL - insetR);
    const ch = Math.max(0, r.height - insetT - insetB);
    if (cw <= 0 || ch <= 0) return;
    const cx = r.left + insetL, cy = r.top + insetT;

    if (isWidgetControl(d)) { emitWidgetControl(el, d, style, contentG, r); return; }

    const ct = controlText(d);
    if (!ct) return;

    // Clip to the content box. This is the section 7 "only when necessary" case: an
    // over-long option label or an unscrolled textarea genuinely does not paint
    // past the field on screen, and there is no geometry trick that crops text.
    const clipId = `fcctl-${++uid}`;
    const clip = document.createElementNS(NS, 'clipPath');
    clip.setAttribute('id', clipId);
    clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
    const cr = document.createElementNS(NS, 'rect');
    cr.setAttribute('x', String(n2(cx - rootRect.left))); cr.setAttribute('y', String(n2(cy - rootRect.top)));
    cr.setAttribute('width', String(n2(cw))); cr.setAttribute('height', String(n2(ch)));
    clip.appendChild(cr);
    defs.appendChild(clip);
    const cg = document.createElementNS(NS, 'g');
    cg.setAttribute('clip-path', `url(#${clipId})`);
    contentG.appendChild(cg);

    const mirror = document.createElement('div');
    const ms = mirror.style;
    ms.position = 'fixed';
    ms.left = `${cx}px`; ms.top = `${cy}px`;
    ms.width = `${cw}px`; ms.height = `${ch}px`;
    ms.margin = '0'; ms.padding = '0'; ms.border = '0';
    ms.pointerEvents = 'none';
    // Behind everything and non-interactive: the mirror exists for one layout pass,
    // but an export can be triggered from a visible page and must not flash.
    ms.zIndex = '-2147483648'; ms.opacity = '0';
    for (const k of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariant',
                     'fontFeatureSettings', 'letterSpacing', 'wordSpacing', 'textTransform',
                     'textAlign', 'direction', 'lineHeight', 'fontStretch'] as const) {
      (ms as unknown as Record<string, string>)[k] = (style as unknown as Record<string, string>)[k] || '';
    }
    // The ::placeholder colour is a real computed style in Chromium; falling back to
    // the control's own colour is wrong-but-visible rather than invisible.
    const phColor = ct.placeholder ? (window.getComputedStyle(el, '::placeholder').color || '') : '';
    ms.color = phColor || style.color;
    ms.overflow = 'hidden';
    const inner = document.createElement('span');
    inner.style.display = 'block';
    if (ct.multiline) {
      inner.style.whiteSpace = 'pre-wrap';
      inner.style.wordBreak = (style as unknown as Record<string, string>).wordBreak || 'normal';
      // Reproduce the scrolled position: a textarea scrolled halfway shows its
      // middle, and drawing from the top would show text that isn't on screen.
      inner.style.marginTop = `${-(el as HTMLElement).scrollTop}px`;
    } else {
      // Single-line inputs and selects centre their text in the content box.
      ms.display = 'flex'; ms.alignItems = 'center';
      inner.style.whiteSpace = 'pre';
      inner.style.marginLeft = `${-(el as HTMLElement).scrollLeft}px`;
      inner.style.flex = '1 1 auto';
    }
    inner.textContent = ct.text;
    mirror.appendChild(inner);
    document.body.appendChild(mirror);
    try {
      await emitInlineTextSvg(textContext, NS, inner, window.getComputedStyle(inner), rootRect, cg);
    } finally { mirror.remove(); }
    if (!cg.childNodes.length) cg.remove();
  }

  /**
   * Checkbox, radio and range.
   *
   * Only for UA-drawn widgets (`appearance` still native). When a stylesheet has set
   * `appearance: none` - which every control in this app does - the tick, dot and
   * track are ordinary CSS the walker already paints, and drawing a second widget on
   * top would be the wrong answer twice.
   */
  function emitWidgetControl(_el: Element, d: ControlDesc, style: CSSStyleDeclaration, contentG: Element, r: DOMRect): void {
    const appearance = (style as unknown as Record<string, string>).appearance
      || (style as unknown as Record<string, string>).webkitAppearance || 'auto';
    if (appearance === 'none') return;
    const type = (d.type || '').toLowerCase();
    const x = r.left - rootRect.left, y = r.top - rootRect.top, w = r.width, h = r.height;
    const accent = parseCssColorFull(style.accentColor === 'auto' ? '' : style.accentColor) ?? [26, 115, 232, 1] as Rgba;
    const acc = `rgb(${accent[0]},${accent[1]},${accent[2]})`;
    const add = (e: Element) => contentG.appendChild(e);
    const rect = (rx: number, ry: number, rw: number, rh: number, fill: string, rad: number, stroke?: string) => {
      const q = document.createElementNS(NS, 'rect');
      q.setAttribute('x', String(n2(rx))); q.setAttribute('y', String(n2(ry)));
      q.setAttribute('width', String(n2(rw))); q.setAttribute('height', String(n2(rh)));
      if (rad) { q.setAttribute('rx', String(n2(rad))); q.setAttribute('ry', String(n2(rad))); }
      q.setAttribute('fill', fill);
      if (stroke) { q.setAttribute('stroke', stroke); q.setAttribute('stroke-width', '1'); }
      return q;
    };

    if (type === 'checkbox' || type === 'radio') {
      // An approximation of the platform widget, not a copy of it: the real one is
      // drawn by the compositor with no CSS to read. Blank was the alternative, and a
      // recognisable checkbox is closer to what the reader saw than an empty square.
      const round = type === 'radio' ? Math.min(w, h) / 2 : Math.min(2, Math.min(w, h) / 4);
      add(rect(x, y, w, h, d.checked ? acc : '#fff', round, d.checked ? undefined : '#767676'));
      if (d.checked && type === 'checkbox') {
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('d', `M${n2(x + w * 0.22)} ${n2(y + h * 0.52)}L${n2(x + w * 0.42)} ${n2(y + h * 0.72)}L${n2(x + w * 0.78)} ${n2(y + h * 0.3)}`);
        p.setAttribute('fill', 'none'); p.setAttribute('stroke', '#fff');
        p.setAttribute('stroke-width', String(n2(Math.max(1.5, Math.min(w, h) * 0.14))));
        p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round');
        add(p);
      } else if (d.checked) {
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', String(n2(x + w / 2))); c.setAttribute('cy', String(n2(y + h / 2)));
        c.setAttribute('r', String(n2(Math.min(w, h) * 0.22)));
        c.setAttribute('fill', '#fff');
        add(c);
      }
      return;
    }

    if (type === 'range') {
      const frac = rangeFraction(d);
      const th = Math.max(3, Math.min(4, h * 0.25));
      const ty = y + (h - th) / 2;
      add(rect(x, ty, w, th, '#c4c4c4', th / 2));
      if (frac > 0) add(rect(x, ty, w * frac, th, acc, th / 2));
      const rr = Math.min(h, 14) / 2;
      const c = document.createElementNS(NS, 'circle');
      // The thumb's centre travels between its own radii, not the full track.
      c.setAttribute('cx', String(n2(x + rr + (w - 2 * rr) * frac)));
      c.setAttribute('cy', String(n2(y + h / 2)));
      c.setAttribute('r', String(n2(rr)));
      c.setAttribute('fill', acc);
      add(c);
    }
  }

  async function visitSvgNode(
    el: any, parentG: Element, ctx: PaintCtx,
    o?: { forceContext?: boolean; placeDirect?: boolean },
  ): Promise<void> {
    if (el.nodeType !== 1) return;
    if (++nodesWalked % YIELD_NODES === 0) {
      opts.onProgress?.(Math.min(nodesWalked, totalNodes), totalNodes);
      opts.signal?.throwIfAborted();      // the yield is what lets a cancel be seen at all
      await new Promise<void>((r) => setTimeout(r));         // unblock the UI thread
    }
    const tag = el.tagName.toLowerCase();
    if (tag === 'style' || tag === 'script') return;

    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return;
    // A closed <details> still LAYS OUT its content - Chrome skips it at paint time
    // via ::details-content, which computed style does not expose (display, visibility
    // and content-visibility all read "visible" on the hidden subtree, and it reports a
    // real getBoundingClientRect). So the walker drew it: the export preflight card on
    // /info/authoring-tools rendered its collapsed Format/Size rows straight through
    // the buttons below it. `content-visibility: hidden` set by an author is the same
    // class of skip, and is caught here too.
    if (isPaintSkipped(el, style)) return;
    const opacity = parseFloat(style.opacity ?? '1');
    if (opacity === 0) return;

    // `display: contents` generates NO box of its own (CSS Display 3 section 3.1: the element
    // is replaced by its contents for layout). getBoundingClientRect() is therefore
    // 0x0, and the `rect.width < 0.5` guard below would drop the element AND its whole
    // subtree - content the reader plainly sees.
    //
    // The gallery is exactly this shape: `.gallery-topbar` is a display:contents
    // wrapper whose children are the fixed nav clusters, so every vector shot of the
    // gallery came back with NO top navigation. `hasOwnBox()` already returns true for
    // contents on the strength of "visitSvgNode recurses, so it is included rather than
    // dropped" - this is the line that made that comment untrue.
    //
    // Paint nothing for the box that does not exist, and let the children paint into
    // this element's parent group with its context, which is where CSS puts them.
    // Own-box children only: a contents wrapper's inline TEXT already belongs to the
    // parent's inline walk, which descends through wrappers and stops at own-box
    // elements - so nothing is lost and nothing double-paints.
    if (style.display === 'contents') {
      for (const child of renderedChildren(el)) {
        if (hasOwnBox(child)) await visitSvgNode(child, parentG, ctx);
      }
      return;
    }

    // Where does CSS say this element's paint unit goes? One pure table lookup
    // off the style we already fetched (bridge/stacking-order.ts). The parent's
    // display is only needed for the flex/grid-item rule, so it is fetched ONLY
    // when a non-auto z-index makes that rule reachable - 70 of 992 elements on
    // the gallery fixture, rather than a second getComputedStyle per node.
    const role: StackingRole = stackingOrder
      ? stackingRole(
          style as unknown as Parameters<typeof stackingRole>[0],
          (style.zIndex && style.zIndex !== 'auto' && el.parentElement)
            ? window.getComputedStyle(el.parentElement).display : '',
          topLayer(el),
        )
      : DOM_ORDER_ROLE;
    // The root of the walk is always a stacking context (Appendix E: the root
    // element establishes one), and so is a transform re-entry - see below.
    const createsCtx = stackingOrder && (role.createsContext || el === node || o?.forceContext === true);

    // CSS rotate(): neutralise it, walk the axis-aligned subtree, then wrap the
    // whole thing in an SVG rotation about the transform-origin (faithful in SVG,
    // unlike the AABB fallback). Additive - no-op for every unrotated element.
    const rotDeg = pureRotationDeg(style.transform);
    if (rotDeg) {
      // Neutralise through the guarded helper, never by hand: a RUNNING transform
      // animation/transition outranks any inline declaration, and the un-neutralised
      // re-entry that follows is what turned one gallery tile into 2 136 nested
      // groups (plans/104 section 9 P3.1 - see bridge/transform-neutralise.ts). `null` means
      // the transform survived and nothing was touched, so this element falls through
      // to the AABB path below, whose rect already carries the rotation.
      const restore = neutraliseTransform(el, neutralise, warnTransform);
      if (restore) {
        try {
          const unrot = el.getBoundingClientRect();   // reading forces the reflow
          const pivot = rotationPivot(style, unrot, rootRect);
          const gRot = document.createElementNS(NS, 'g');
          gRot.setAttribute('transform', `rotate(${rotDeg.toFixed(4)} ${pivot.x.toFixed(3)} ${pivot.y.toFixed(3)})`);
          // gRot is the paint unit for this element (the rotation wraps everything
          // it emits), so IT is what gets deferred.
          place(gRot, role, ctx, parentG);
          // forceContext + placeDirect exist ONLY for this re-entry, and they are
          // both about the same piece of hidden state: `el.style.transform` has just
          // been set to 'none', so the recursive call's getComputedStyle reports
          // `transform: none`.
          //   • forceContext - without it the element stops looking like a stacking
          //     context (CSS Transforms 1 section 3) on the way in, and its descendants
          //     would hoist straight out of a rotation that is about to be applied.
          //   • placeDirect - without it `g` would be deferred a SECOND time into
          //     the same frame, leaving gRot empty and painting the element twice
          //     over at the wrong depth.
          // Delete either one and the failure is silent. They are essential.
          await visitSvgNode(el, gRot, { frame: ctx.frame, clips: ctx.clips }, { forceContext: true, placeDirect: true });
        } finally { restore(); }
        return;
      }
    }

    // General 2-D transform (rotate+scale, skew, arbitrary matrix) that isn't a pure
    // rotation: neutralise it, walk the untransformed subtree, then wrap in an SVG
    // matrix() about the transform-origin. 3-D/perspective returns null from
    // parseCssMatrix and falls through to the AABB path below.
    //
    // A pure SCALE takes this branch too, even though it is axis-aligned and
    // getBoundingClientRect already carries it. That was the reasoning before, and it
    // is only half true: a client rect is scaled, but a COMPUTED LENGTH is not. Walk a
    // scaled subtree on the AABB path and every box is placed correctly while every length
    // read from getComputedStyle - font-size first, but equally border-radius, border
    // width, shadow offset and blur - is left 1/s too big. Measured on the Design
    // docs shot: a 1080px artboard displayed at 868 (`matrix(0.8037…)`) exported its
    // headline 1/0.8037 = 24.4% oversize, overflowing the card it fits on screen.
    // Neutralising instead makes the subtree self-consistent - every length and every
    // rect in the same unscaled space - and the scale goes on once, at the top.
    // Pure TRANSLATE stays on the AABB path: it moves boxes without distorting lengths.
    const mtx = pureRotationDeg(style.transform) === 0 ? parseCssMatrix(style.transform) : null;
    const scaled = Boolean(mtx && isAxisAlignedMat(mtx)
      && (Math.abs(mtx.a - 1) > 1e-4 || Math.abs(mtx.d - 1) > 1e-4));
    if (mtx && (!isAxisAlignedMat(mtx) || scaled)) {
      // Same guarded neutralise as the rotation branch - read its comment.
      const restore = neutraliseTransform(el, neutralise, warnTransform);
      if (restore) {
        try {
          const unrot = el.getBoundingClientRect();
          const pivot = rotationPivot(style, unrot, rootRect);
          const gM = document.createElementNS(NS, 'g');
          gM.setAttribute('transform', matToSvg(matAboutPivot(mtx, pivot.x, pivot.y)));
          place(gM, role, ctx, parentG);
          // Same forceContext/placeDirect contract as the rotation branch above - 
          // see the comment there before touching either flag.
          await visitSvgNode(el, gM, { frame: ctx.frame, clips: ctx.clips }, { forceContext: true, placeDirect: true });
        } finally { restore(); }
        return;
      }
    }

    // ── A real 3-D pose: per-element raster, never the AABB (plans/104 section 12 Q2) ──
    //
    // SVG has no perspective transform, so `parseCssMatrix` refuses a `matrix3d` that
    // carries a perspective row and BOTH branches above decline. Falling through from
    // there to the AABB path is not a lossy approximation, it is a different picture:
    // `neutraliseTransform` writes `transform: none` and the subtree comes out
    // axis-aligned, stretched to fill the projected bounding box - a tilted card
    // exported as a `<rect>`, with no notice (measured: two cards under `rx −45`,
    // 495 B of SVG, zero `matrix3d`, zero `<image>`, two upright rects).
    //
    // section 12 Q2 is the decision, and spike S2 cleared it unreserved: keep every untilted
    // layer vector and embed a per-box captured raster for the tilted ones, with the
    // amber notice (`tool-actions.ts`'s fidelity row). On Chromium the capture is
    // indistinguishable from the preview - flat-region diff 0.012–0.045/255, ink IoU
    // 0.985–0.993 across 20 poses to 85°, and text comes out marginally SHARPER than
    // the live compositor's filtered layer. `rasterizePosedNodeToDataUrl` is the
    // wrapper-shaped capture S2 said this needs; `effectSpillCss` is the padding it
    // said is not optional (up to 42 px for a drop-shadow on a tilted box).
    //
    // Children are NOT walked afterwards: the image IS the subtree's picture, and
    // emitting the descendants again would paint them a second time, untilted.
    if (opts.rasterFallback !== false && isNonAffineTransform(style.transform)) {
      const pxScale = scaleX * Math.max(1, d.dpi / CSS_DPI);
      const posedShot = await rasterizePosedNodeToDataUrl(
        el as HTMLElement, pxScale, opts._imprintSink, effectSpillCss(style),
      );
      if (posedShot) {
        tiltedRasters++;
        const gT = document.createElementNS(NS, 'g');
        place(gT, role, ctx, parentG);
        const img = document.createElementNS(NS, 'image');
        img.setAttribute('href', posedShot.dataUrl);
        img.setAttribute('x', String(n2(posedShot.x - rootRect.left)));
        img.setAttribute('y', String(n2(posedShot.y - rootRect.top)));
        img.setAttribute('width', String(n2(posedShot.w)));
        img.setAttribute('height', String(n2(posedShot.h)));
        img.setAttribute('preserveAspectRatio', 'none');
        gT.appendChild(img);
        return;
      }
      // Capture refused (a corner behind the eye, dom-to-image failed). Say so, then
      // fall through - an AABB rectangle is wrong, but it is what this walker did
      // before section 12 Q2 and it is better than a hole.
      _host?.log?.('warn', `svg: tilted <${tag}> could not be captured; falling back to its bounding box`);
    }

    const rect = el.getBoundingClientRect();
    if (rect.width < 0.5 || rect.height < 0.5) return;

    const x = rect.left - rootRect.left;
    const y = rect.top  - rootRect.top;
    const w = rect.width;
    const h = rect.height;

    // Entirely outside every ancestor's overflow box: it paints nothing on screen, so
    // it is not emitted. Cheapest possible clip reduction - it removes the node and
    // its whole subtree rather than emitting them and then hiding them. The rows
    // scrolled out of a long list are the case that pays.
    // ...except when its containing block escapes that box. CSS 2.1 section 11.1.1: an
    // absolutely-positioned element is NOT clipped by a non-positioned ancestor's
    // overflow, and `fixed` escapes almost every clip - such a node is genuinely
    // visible outside the box, and dropping it would delete content the reader saw.
    // Erring toward keeping is the same call the hoist path makes a few lines up:
    // an over-clipped node is a bug, an un-clipped node is a smaller one.
    const escapesClip = style.position === 'absolute' || style.position === 'fixed';
    const cb = escapesClip ? null : ctx.clipBox;
    if (cb && (cb.w <= 0 || cb.h <= 0 || x + w <= cb.x || y + h <= cb.y || x >= cb.x + cb.w || y >= cb.y + cb.h)) return;
    // Report the box up so the nearest clip candidate can tell whether its clip does
    // any work. Done before any early return below, so a node that ends up rastered
    // or skipped still counts toward its ancestor's decision.
    expand(ctx.bounds, x, y, w, h);

    const g = document.createElementNS(NS, 'g');
    // ── Layer identity passthrough (opts.layerIds - plans/104 section 7) ────────────
    //
    // The walker emits one <g> per element in ROOT coordinates and has always
    // stamped ZERO identity on it, so a Lolly screenshot imported back in was one
    // undifferentiated scene. This is the one point that changes: where the walked
    // element already carries `data-box-id` (design's own boxes,
    // template.html), the group carries it out, and `enumerateSvgLayers` reports it
    // as `layer.boxId` - so a lift falls on real UI boundaries instead of on
    // whatever the markup happened to group.
    //
    // What travels is an ID, never a NAME: `data-box-id` is a generated index the
    // canvas mints (freshId), so the ingest-time PII strip that removes
    // `data-name`/`inkscape:label` is not undone by an export.
    //
    // OPT-IN, and the default path must stay byte-identical: with the flag absent
    // this block cannot run, so no attribute is added, no serialisation order
    // moves, and every shipping tool export is the same bytes it was. Pinned by
    // `export-layer-ids.test.ts`, which renders the same DOM both ways.
    if (opts.layerIds) {
      const boxId = el.getAttribute('data-box-id');
      if (boxId) g.setAttribute('data-box-id', boxId);
    }
    if (opacity < 0.999) g.setAttribute('opacity', opacity.toFixed(4));
    const placement = place(g, role, ctx, parentG, o?.placeDirect);

    // clip-path → vector <clipPath> so the node stays vector instead of rasterising.
    // circle()/ellipse()/inset()/polygon() all route through the shared parseClipShape
    // (element-local px → offset to root coords). clipHandled is false only for a shape
    // we couldn't vectorise (url()/path(), or a failed basic shape) - the escape-hatch
    // below then rasterises it. A polygon with <3 points still counts as handled (never
    // rasters - matches prior behaviour). The PDF walker mirrors this exactly.
    let clipHandled = true;
    const cp = style.clipPath || (style as any).webkitClipPath;
    if (cp && cp !== 'none') {
      const clipRes = emitClip(cp, x, y, w, h, g);
      // Zero area: the browser paints nothing here, so neither do we. Drop the
      // group we just appended and stop - no clip, no children, no raster.
      // UNPLACE: in stacking mode `g` was never attached to the DOM, it was
      // parked in a frame array, so `.remove()` alone would leave an empty (or
      // clip-wrapped) group to be appended at finalisation. Splice by IDENTITY
      // rather than popping the tail - no child has been walked yet so it IS the
      // last entry, but relying on that would rot the moment anything is added
      // between the two points. The arrays are tiny.
      if (clipRes === 'empty') {
        if (placement) {
          const i = placement.list.indexOf(placement.entry);
          if (i >= 0) placement.list.splice(i, 1);
        } else { g.remove(); }
        return;
      }
      clipHandled = clipRes === 'ok' || cp.trim().indexOf('polygon(') === 0;
    }

    // mix-blend-mode: SVG carries it natively, so blend the vector content on `g`
    // rather than rasterising it (SVG output only; PDF/EMF/EPS still raster it).
    if (style.mixBlendMode && style.mixBlendMode !== 'normal') {
      g.setAttribute('style', `mix-blend-mode:${style.mixBlendMode}`);
    }

    // filter: drop-shadow(…) → keep vector via a chain of <feDropShadow> on `g`
    // (SVG only; other filter functions can't be reproduced and fall to the raster
    // escape-hatch below, which is why the dropShadow cap is gated on this parse).
    // <img>/<svg> filters are baked into the bitmap / handled by their own paths.
    const dropShadows = (tag !== 'img' && tag !== 'svg') ? parseDropShadowFilter(style.filter) : null;
    if (dropShadows) {
      const fId = `fcds-${++uid}`;
      defs.appendChild(buildDropShadowFilterEl(NS, dropShadows, fId, { x, y, w, h }));
      g.setAttribute('filter', `url(#${fId})`);
    }

    // ── Border radius (CSS corner-overlap clamped → pill, not ellipse) ───────
    const { radii, uniform } = resolveRadii(style, w, h);
    const hasRadius = uniform ? (uniform[0] > 0 || uniform[1] > 0) : true;

    // ── Box shadow ────────────────────────────────────────────────────────────
    // Each outer shadow is the box's own shape, offset + grown by spread, filled
    // with the shadow colour and Gaussian-blurred, painted BEHIND the background.
    // EMF/EPS/DXF (opts.noBoxShadow) have no blur primitive, and used to get no shadow
    // at all rather than an ugly hard-edged offset shape. They can have one: a blur is
    // reproducible as concentric bands (section 13), and for a format with no alpha the bands
    // have to be non-overlapping RINGS at absolute coverage - svg-ir flattens every
    // shape against the page background independently, so overlapping increments never
    // accumulate and come out far too light.
    if (opts.noBoxShadow && tag !== 'img' && tag !== 'svg') {
      for (const sh of parseBoxShadow(style.boxShadow).reverse()) {
        if (sh.inset) continue;
        const col = parseCssColorFull(sh.color);
        if (!col) continue;
        const fillCol = `rgb(${col[0]},${col[1]},${col[2]})`;
        const shapeAt = (t: number) => {
          const sw = Math.max(0, w + 2 * (sh.spread + t)), shh = Math.max(0, h + 2 * (sh.spread + t));
          if (sw <= 0 || shh <= 0) return '';
          return roundedRectPath(x + sh.x - sh.spread - t, y + sh.y - sh.spread - t, sw, shh,
            insetCorners(radii, -(sh.spread + t)));
        };
        const rings = gaussianShadowRings(sh.blur, col[3]);
        if (!rings.length) {
          // Hard shadow: one shape, exact, no approximation involved.
          const d = shapeAt(0);
          if (!d) continue;
          const p = document.createElementNS(NS, 'path');
          p.setAttribute('d', d);
          p.setAttribute('fill', fillCol);
          if (col[3] < 1) p.setAttribute('fill-opacity', String(col[3]));
          g.appendChild(p);
          continue;
        }
        // NOT clipped out of the border box, unlike the compositing path. A clipPath
        // is no use here (svg-ir skips those, so EMF/EPS would ignore it), and cutting
        // the box out of the innermost ring by hand measured WORSE - the shadow is
        // offset, so an un-offset hole leaves a gap along its own top edge. It costs
        // nothing in the target formats: svg-ir flattens the element's background to
        // an opaque shape painted after these, which covers the area completely. Only
        // a fully transparent background would reveal it, and then there is no box to
        // cast the shadow in the first place.
        for (const ring of rings) {
          const outer = shapeAt(ring.outer);
          if (!outer) continue;
          const inner = ring.inner === null ? '' : shapeAt(ring.inner);
          const p = document.createElementNS(NS, 'path');
          p.setAttribute('d', outer + inner);
          if (inner) p.setAttribute('fill-rule', 'evenodd');
          p.setAttribute('fill', fillCol);
          p.setAttribute('fill-opacity', String(Math.round(ring.alpha * 1000) / 1000));
          g.appendChild(p);
        }
      }
    }

    // Painted back-to-front so the first-listed shadow ends up on top, matching CSS.
    if (!opts.noBoxShadow && tag !== 'img' && tag !== 'svg') {
      for (const sh of parseBoxShadow(style.boxShadow).reverse()) {
        if (sh.inset) continue;   // drawn after the background, below - CSS paints it inside
        const col = parseCssColorFull(sh.color);
        if (!col) continue;
        const sw = Math.max(0, w + 2 * sh.spread);
        const sh2 = Math.max(0, h + 2 * sh.spread);
        if (sw <= 0 || sh2 <= 0) continue;
        const sRadii = insetCorners(radii, -sh.spread);   // negative inset = outset
        const fill = col[3] < 1
          ? `rgba(${col[0]},${col[1]},${col[2]},${col[3]})`
          : `rgb(${col[0]},${col[1]},${col[2]})`;
        // CSS paints an outer shadow "as if the border box were opaque" and clips it
        // away INSIDE that box (Backgrounds section 7.1.1). Painting the whole shape and
        // covering it with the background only works when the background is opaque - 
        // over a translucent panel the shadow shows straight through, which measured
        // 6.2% mean / 36% worst-pixel error against the bitmap on this app's frosted
        // surfaces.
        //
        // With no blur the hole is pure geometry: one evenodd path, shadow shape minus
        // border box, and no clip at all (so it survives EMF/EPS too). With a blur the
        // order matters - CSS blurs and THEN clips - and no amount of geometry
        // reproduces that, so this is the section 7 case where a clip is genuinely the
        // mechanism rather than a shortcut.
        // The hole is a HAIR smaller than the border box. Two antialiased edges meeting
        // exactly leaves a seam of background showing between the shadow and the box - 
        // it measured up to 13% on a single pixel line, on the very fixtures that were
        // previously exact. Half a pixel of overlap tucks the shadow under the box's
        // own edge and costs nothing anywhere else.
        //
        // …but only when it MATTERS. An opaque background hides the shadow beneath it
        // by simply painting over it, exactly as before, and that path measured exact.
        // Cutting a hole there instead leaves two independently antialiased edges
        // meeting along the border - a seam worth up to 13% on a single pixel line.
        // So the hole is cut only when the background cannot do the hiding.
        const bgAlpha = parseCssColorFull(style.backgroundColor)?.[3] ?? 0;
        const needsHole = bgAlpha < 0.999;
        let shape: Element;
        if (!needsHole) {
          shape = makeRoundedFill(NS, x + sh.x - sh.spread, y + sh.y - sh.spread,
            sw, sh2, sRadii, uniformRadius(sRadii), fill);
        } else if (sh.blur <= 0) {
          const ring = document.createElementNS(NS, 'path');
          ring.setAttribute('d',
            roundedRectPath(x + sh.x - sh.spread, y + sh.y - sh.spread, sw, sh2, sRadii) +
            roundedRectPath(x, y, w, h, radii));
          ring.setAttribute('fill-rule', 'evenodd');
          ring.setAttribute('fill', fill);
          shape = ring;
        } else {
          shape = makeRoundedFill(NS, x + sh.x - sh.spread, y + sh.y - sh.spread,
            sw, sh2, sRadii, uniformRadius(sRadii), fill);
          const holeId = `fcshclip-${++uid}`;
          const hole = document.createElementNS(NS, 'clipPath');
          hole.setAttribute('id', holeId);
          hole.setAttribute('clipPathUnits', 'userSpaceOnUse');
          const cut = document.createElementNS(NS, 'path');
          const cpad = sh.blur * 3 + Math.abs(sh.x) + Math.abs(sh.y) + Math.abs(sh.spread) + 8;
          cut.setAttribute('d',
            `M${n2(x - cpad)} ${n2(y - cpad)}H${n2(x + w + cpad)}V${n2(y + h + cpad)}H${n2(x - cpad)}Z` +
            roundedRectPath(x, y, w, h, radii));
          cut.setAttribute('clip-rule', 'evenodd');
          hole.appendChild(cut);
          defs.appendChild(hole);
          shape.setAttribute('clip-path', `url(#${holeId})`);
        }
        if (sh.blur > 0) {
          const fId = `shadow-${++uid}`;
          const filt = document.createElementNS(NS, 'filter');
          filt.setAttribute('id', fId);
          // userSpaceOnUse region padded for the blur so it isn't clipped.
          const pad = sh.blur * 1.5 + Math.abs(sh.spread) + 8;
          filt.setAttribute('filterUnits', 'userSpaceOnUse');
          filt.setAttribute('x',      String(x + sh.x - sh.spread - pad));
          filt.setAttribute('y',      String(y + sh.y - sh.spread - pad));
          filt.setAttribute('width',  String(sw + 2 * pad));
          filt.setAttribute('height', String(sh2 + 2 * pad));
          const fe = document.createElementNS(NS, 'feGaussianBlur');
          fe.setAttribute('in', 'SourceGraphic');
          fe.setAttribute('stdDeviation', String(sh.blur / 2));
          filt.appendChild(fe);
          defs.appendChild(filt);
          shape.setAttribute('filter', `url(#${fId})`);
        }
        g.appendChild(shape);
      }
    }

    // ── Rasterise escape-hatch: node uses CSS the walker can't express ──────────
    // Embed the node as an <image> instead of silently dropping the effect. Placed
    // AFTER the box-shadow block so an outset shadow still paints behind the raster,
    // and BEFORE background/children so the raster replaces them (dom-to-image already
    // captured the whole subtree). Returns on success. The element's own opacity is
    // neutralised for the capture (like the rotation branch neutralises transform) so
    // it isn't applied twice - once baked into the PNG and again via g's opacity.
    // Falls through to the vector walk if raster fails.
    // Set when the escape hatch below captured this element's own paint as an
    // <image>; the vector background/border emission then stands down so the two
    // don't double-paint.
    let ownPaintRastered = false;
    // ── CSS filter ───────────────────────────────────────────────────────────
    // Every CSS shorthand filter is spec-defined as an equivalent SVG filter, so the
    // chain is emitted rather than dropped (49 filtered elements on the gallery
    // fixture used to lose theirs silently). drop-shadow is excluded - the walker
    // draws those as geometry, which survives EMF/EPS where a filter would not.
    if (!opts.noBoxShadow) {
      const fv = style.filter || '';
      if (fv && fv !== 'none' && !isDropShadowOnly(fv)) {
        const prims = parseCssFilter(fv);
        if (prims?.length) {
          const fId = `fcflt-${++uid}`;
          const filt = document.createElementNS(NS, 'filter');
          filt.setAttribute('id', fId);
          // Room for a blur to spread past the box, and sRGB to match CSS, which
          // applies these in sRGB rather than SVG's linearRGB default.
          const spread = prims.reduce((n, p) => p.kind === 'blur' ? Math.max(n, p.stdDeviation) : n, 0);
          const pad = spread * 3 + 8;
          filt.setAttribute('filterUnits', 'userSpaceOnUse');
          filt.setAttribute('x', String(n2(x - pad))); filt.setAttribute('y', String(n2(y - pad)));
          filt.setAttribute('width', String(n2(w + 2 * pad))); filt.setAttribute('height', String(n2(h + 2 * pad)));
          filt.setAttribute('color-interpolation-filters', 'sRGB');
          for (const pr of prims) filt.appendChild(filterPrimitiveEl(NS, pr));
          defs.appendChild(filt);
          g.setAttribute('filter', `url(#${fId})`);
        }
      }
    }

    // ── backdrop-filter: blur() ─────────────────────────────────────────────
    // SVG has no primitive that reads what is painted behind an element, so the
    // backdrop has to be reconstructed: take the content already emitted (at this
    // point in the walk, `rootG` IS everything behind this element), clip that copy
    // to this element's own shape, and blur it. The copy goes in first, so the
    // element's background, border and children then paint over it exactly as they
    // do on screen.
    //
    // Snapshot mode only. It duplicates geometry, which is the wrong trade for a
    // tool export, and `rasterizeNodeToDataUrl` cannot do it at all - dom-to-image
    // serialises the node into a <foreignObject>, and the backdrop is by definition
    // outside that subtree, which is why the raster hatch always got this wrong.
    const bfRaw = opts.backdropBlur === true
      ? (style.backdropFilter || (style as { webkitBackdropFilter?: string }).webkitBackdropFilter || '')
      : '';
    const bfPx = bfRaw ? parseBackdropBlurPx(bfRaw) : null;
    // The clone is expressed in root user space, so it can only be dropped into `g`
    // when nothing between `g` and the root carries a transform - otherwise the
    // rotation wrapper above would apply that transform a second time. Rotated
    // frosted panels fall through to the raster hatch, as before.
    let bfTransformed = false;
    for (let a: Element | null = g; a && a !== rootG; a = a.parentElement) {
      if (a.hasAttribute('transform')) { bfTransformed = true; break; }
    }
    // Did the reconstruction ACTUALLY run? The raster-fallback caps below must report
    // the OUTCOME, not the request: a rotated or over-cap panel skips the clone, and
    // declaring "backdrop blur is supported" there dropped the frost silently instead
    // of sending the panel to the raster hatch the comments promised it would reach.
    let bfHandled = false;
    if (bfPx !== null && bfPx > 0 && !bfTransformed && rootG.firstChild) {
      // Bound the duplication: a page-sized backdrop under many blurred pills would
      // copy the whole document once per pill. Past the cap, fall through and let the
      // raster hatch have it rather than emit tens of megabytes.
      //
      // Count DESCENDANTS, not children. The root walk runs with `frame: null`, so
      // place() appends straight to rootG and it holds exactly one child - the body
      // <g> - for the entire walk. Measuring childNodes therefore always read 1, the
      // cap never fired, and each blurred element deep-cloned the whole accumulated
      // tree it was supposed to protect against.
      const backdropNodes = rootG.getElementsByTagName('*').length;
      if (backdropNodes <= BACKDROP_MAX_NODES) {
        const bId = `fcbd-${++uid}`;
        const filt = document.createElementNS(NS, 'filter');
        filt.setAttribute('id', bId);
        // Room for the blur to spread, and clamp to sRGB so the result matches CSS,
        // which composites backdrop filters in sRGB rather than linearRGB.
        // userSpaceOnUse over the element box padded by the blur radius. The default
        // objectBoundingBox region would be relative to the whole duplicated
        // backdrop's bbox - near page-sized - making the filter far more expensive
        // than the area that actually shows through the clip.
        const bpad = bfPx * 2 + 4;
        filt.setAttribute('filterUnits', 'userSpaceOnUse');
        filt.setAttribute('x',      String(n2(x - bpad)));
        filt.setAttribute('y',      String(n2(y - bpad)));
        filt.setAttribute('width',  String(n2(w + 2 * bpad)));
        filt.setAttribute('height', String(n2(h + 2 * bpad)));
        filt.setAttribute('color-interpolation-filters', 'sRGB');
        const fe = document.createElementNS(NS, 'feGaussianBlur');
        // CSS blur(Npx) is a Gaussian with stdDeviation N/2 (Filter Effects section .
        fe.setAttribute('stdDeviation', String(n2(bfPx / 2)));
        filt.appendChild(fe);
        defs.appendChild(filt);

        const cId = `fcbdclip-${++uid}`;
        const cp = document.createElementNS(NS, 'clipPath');
        cp.setAttribute('id', cId);
        cp.setAttribute('clipPathUnits', 'userSpaceOnUse');
        cp.appendChild(makeRoundedFill(NS, x, y, w, h, radii, uniform, '#fff'));
        defs.appendChild(cp);

        const bd = document.createElementNS(NS, 'g');
        bd.setAttribute('clip-path', `url(#${cId})`);
        bd.setAttribute('filter', `url(#${bId})`);
        // Deep clones, not <use>: svg-ir (EMF/EPS/DXF) skips <use> outright, so a
        // referenced backdrop would silently vanish from those formats.
        for (const child of Array.from(rootG.childNodes)) bd.appendChild(child.cloneNode(true));
        g.appendChild(bd);
        bfHandled = true;
      } else {
        _host?.log?.('warn', `svg: backdrop-filter blur skipped on <${tag}> - ${backdropNodes} nodes behind it; the panel rasterises instead`);
      }
    } else if (bfRaw && bfRaw !== 'none') {
      // Rotated panel, an empty root, or a filter chain we refuse to fake. Say so at
      // warn level: this is a fidelity loss the user can act on, not a debug note.
      _host?.log?.('warn', `svg: backdrop-filter not reconstructed on <${tag}> (${bfTransformed ? 'rotated' : bfPx === null ? 'not a plain blur()' : 'nothing behind it'}); the panel rasterises instead`);
    }

    // `cssFilter: true` - this walker emitted the whole chain as a <filter> a few
    // blocks up, so a parseable filter stays vector here. It is stated rather than
    // inferred so the PDF walker, which has no filter branch, can decline it and
    // rasterise instead (see detectUnsupportedCss). KNOWN GAP, unchanged by that
    // split: under `opts.noBoxShadow` (EMF/EPS/DXF) the chain is NOT emitted, so
    // those three still lose a non-drop-shadow filter silently. Turning the cap off
    // for them would rasterise instead - an improvement for EMF/EPS, but DXF is
    // line-art only and drops raster regions outright, so it is a separate decision
    // with its own measurements, not a rider on this one.
    const rasterReason = opts.rasterFallback !== false ? detectUnsupportedCss(el, style, { blend: true, clipBasicShapes: clipHandled, dropShadow: Boolean(dropShadows), cssFilter: true, backdropBlur: bfHandled, conic: true }) : null;
    if (rasterReason) {
      const pxScale = scaleX * Math.max(1, d.dpi / CSS_DPI);
      const pxW = Math.max(2, Math.min(MAX_RASTER_PX, Math.round(w * pxScale)));
      const pxH = Math.max(2, Math.min(MAX_RASTER_PX, Math.round(h * pxScale)));
      const prevOpacity = el.style.opacity;
      el.style.opacity = '1';   // g already carries the element opacity; don't bake it in twice
      let dataUrl: string | null = null;
      // Lolly-composited subtree baked into an SVG <image> - same chokepoint as the
      // PDF escape hatch, so it honours opts.imprint too (inert until SVG is imprint-
      // enabled upstream, since the mark is size-floored and opt-in either way).
      // Element-scoped mode (page snapshots): capture only this element's own paint
      // and carry on walking its children as vector. Subtree mode (the default, and
      // what every tool export has always done) bakes the whole subtree into the PNG.
      //
      // Why it matters: the hatch fires on the ELEMENT, so one `conic-gradient` or
      // `backdrop-filter` on a top-level container used to convert an entire page to
      // a screenshot - measured 100% raster coverage on two fixtures. Scoping it turns
      // that cliff into local degradation: the offending box's paint becomes an
      // <image>, everything inside it stays text and geometry.
      //
      // Left OFF for tool exports on purpose. Splitting an element's paint from its
      // children changes compositing where the two interact (a child with
      // `mix-blend-mode` blending against its parent's background is the case), and
      // renderSvgFromHtml is the shipping SVG/PDF/EMF/EPS path for every tool in
      // every profile. Snapshot-specific behaviour stays behind the flag.
      const scoped = opts.elementScopedRaster === true;
      try { dataUrl = await rasterizeNodeToDataUrl(el as HTMLElement, pxW, pxH, undefined, opts._imprintSink, scoped); }
      finally { el.style.opacity = prevOpacity; }
      if (dataUrl) {
        _host?.log?.('info', `svg: rasterised <${tag}> ${scoped ? 'own paint' : 'subtree'} (unsupported ${rasterReason})`);
        const img = document.createElementNS(NS, 'image');
        img.setAttribute('href', dataUrl);
        img.setAttribute('x', String(n2(x)));  img.setAttribute('y', String(n2(y)));
        img.setAttribute('width', String(n2(w))); img.setAttribute('height', String(n2(h)));
        img.setAttribute('preserveAspectRatio', 'none');   // sized exactly to the box
        g.appendChild(img);
        if (!scoped) return;
        // Scoped: the raster IS this element's background/border/effect layer, so skip
        // re-emitting those in vector below (they would double-paint over the image)
        // and fall through to the children walk.
        ownPaintRastered = true;
      }
      // dataUrl == null → fall through to the normal (lossy) vector emission.
    }

    // ── Background ──────────────────────────────────────────────────────────
    // CSS paint order (bottom→top): background-color, then the background-image layer.
    // A gradient emits a true SVG gradient (alpha stops preserved); a url() image emits a
    // real <image> (vector-first - the box's text/children stay crisp, instead of
    // rasterising the whole node), sized/positioned per background-size/position and clipped
    // to the rounded box. Only when we CAN'T vectorise (conic, repeat, unresolvable) does the
    // escape-hatch above rasterise.
    const bgImgAll = ownPaintRastered ? 'none' : style.backgroundImage;
    const bgRgb = ownPaintRastered ? null : parseCssColorFull(style.backgroundColor);
    if (bgRgb) g.appendChild(makeRoundedFill(NS, x, y, w, h, radii, uniform, rgbaCss(bgRgb)));
    // `background-image` is a LIST: CSS lists layers top-first and paints them
    // bottom-first, and each layer carries its own size/position/repeat (those lists
    // cycle when shorter than the image list). Until 2026-07-31 the whole list was
    // handed to the gradient parsers as ONE value, and `^linear-gradient\((.+)\)$` is
    // greedy - so two stacked gradients matched as one and their stop lists were
    // concatenated. Offsets restart mid-list, SVG clamps stops monotonically, and a
    // flat swatch chip painted as a dark-to-white fade (docs/shots/brand-colours.svg).
    // One gradient/image element per layer, emitted bottom-first.
    const bgLayers = (bgImgAll && bgImgAll !== 'none' ? splitCssArgs(bgImgAll) : [])
      .map((value, idx) => ({ value: value.trim(), idx }))
      .filter((l) => l.value && l.value !== 'none');
    const layerProp = (list: string | null | undefined, i: number, fallback: string) => {
      const parts = splitCssArgs(list || '').filter((p) => p !== '');
      return parts.length ? parts[i % parts.length]! : fallback;
    };
    for (const { value: bgImg, idx: layerIdx } of bgLayers.slice().reverse()) {
      const bgSize     = layerProp(style.backgroundSize,     layerIdx, 'auto');
      const bgPosition = layerProp(style.backgroundPosition, layerIdx, '0% 0%');
      const bgRepeat   = layerProp(style.backgroundRepeat,   layerIdx, 'repeat');
      const gid = ++uid;
      // The positioning area (the padding box) and its origin. Hoisted out of the
      // url() branch below because the CONIC branch needs it too - see the tile
      // handling there.
      const area = {
        w: Math.max(0, w - num2(style, 'borderLeftWidth') - num2(style, 'borderRightWidth')),
        h: Math.max(0, h - num2(style, 'borderTopWidth') - num2(style, 'borderBottomWidth')),
      };
      const ax = x + num2(style, 'borderLeftWidth'), ay = y + num2(style, 'borderTopWidth');

      // TILED gradient layers. A gradient is sized by `background-size` like any other
      // background image, and the editor stage's transparency checkerboard is exactly
      // that: two 45deg linear-gradient layers at `24px 24px`, offset `0 0, 12px 12px`.
      // Drawing a tiled gradient across the whole element box is silently wrong pixels,
      // so before this the only honest answer left was the raster escape hatch - which
      // is how a 1080x676 PNG of a faint checkerboard ended up inside a docs shot.
      // The tile becomes a real <pattern>, exactly as the conic and url() branches do.
      const gradPl = placeBackground(bgSize, bgPosition, bgRepeat, area, null);
      const gradTiles = Boolean(gradPl && gradPl.w > 0.5 && gradPl.h > 0.5
        && (gradPl.repeatX || gradPl.repeatY)
        && (gradPl.w < area.w - 0.5 || gradPl.h < area.h - 0.5));
      // Built in the TILE's own coordinate space when tiling - a pattern's content
      // coordinates are the tile, not the element.
      const gradEl = gradTiles
        ? (buildLinearGradientEl(NS, bgImg, 0, 0, gradPl.w, gradPl.h, gid)
          || buildRadialGradientEl(NS, bgImg, 0, 0, gradPl.w, gradPl.h, gid))
        : (buildLinearGradientEl(NS, bgImg, x, y, w, h, gid)
          || buildRadialGradientEl(NS, bgImg, x, y, w, h, gid));
      // A conic gradient is sized by `background-size` like any other background
      // image, so resolve the placement BEFORE parsing: a tiled conic (the
      // transparency checkerboard is `repeating-conic-gradient(...) 50% / 2em 2em`)
      // must be parsed at ONE TILE, not at the element box. Parsing at the box and
      // fanning across it - which is what this did until 2026-07-30 - turns a 32px
      // checkerboard into a single element-sized four-quadrant sweep: not a raster,
      // but silently wrong pixels, which is worse.
      // `intrinsic` is null: a gradient has no intrinsic size, so `auto` resolves to
      // the area and the untiled case behaves exactly as before.
      const conicPl = gradEl ? null
        : placeBackground(bgSize, bgPosition, bgRepeat, area, null);
      const conicTiles = Boolean(conicPl && conicPl.w > 0 && conicPl.h > 0
        && (conicPl.repeatX || conicPl.repeatY)
        && (conicPl.w < area.w - 0.5 || conicPl.h < area.h - 0.5));
      const conic = gradEl ? null
        : parseConicGradient(bgImg, conicTiles ? conicPl!.w : w, conicTiles ? conicPl!.h : h);
      if (gradEl && gradTiles) {
        // One tile of the gradient inside a <pattern>, phased by background-position
        // (modulo the tile on each repeating axis, so the phase matches what the
        // browser paints - `12px 12px` on a 24px tile is not 0).
        const pid = `fcgradpat-${++uid}`;
        const pat = document.createElementNS(NS, 'pattern');
        pat.setAttribute('id', pid);
        pat.setAttribute('patternUnits', 'userSpaceOnUse');
        pat.setAttribute('x', String(n2(ax + (gradPl.repeatX ? gradPl.x % gradPl.w : gradPl.x))));
        pat.setAttribute('y', String(n2(ay + (gradPl.repeatY ? gradPl.y % gradPl.h : gradPl.y))));
        pat.setAttribute('width', String(n2(gradPl.repeatX ? gradPl.w : Math.max(gradPl.w, area.w))));
        pat.setAttribute('height', String(n2(gradPl.repeatY ? gradPl.h : Math.max(gradPl.h, area.h))));
        const cell = document.createElementNS(NS, 'rect');
        cell.setAttribute('x', '0'); cell.setAttribute('y', '0');
        cell.setAttribute('width', String(n2(gradPl.w))); cell.setAttribute('height', String(n2(gradPl.h)));
        cell.setAttribute('fill', `url(#svggrad-${gid})`);
        defs.appendChild(gradEl);
        pat.appendChild(cell);
        defs.appendChild(pat);
        g.appendChild(makeRoundedFill(NS, x, y, w, h, radii, uniform, `url(#${pid})`));
      } else if (gradEl) {
        defs.appendChild(gradEl);
        g.appendChild(makeRoundedFill(NS, x, y, w, h, radii, uniform, `url(#svggrad-${gid})`));
      } else if (conic && conicTiles && conicPl) {
        // A TILED conic: emit one tile's fan inside a real <pattern>, mirroring the
        // url() tiling branch below. Chromium cannot keep this vector through
        // printToPDF at all (PDF has no conic/angular shading type - measured), so
        // the walker is the only path that renders a checkerboard crisply.
        const tile = conicFanEl(NS, conic, 0, 0, conicPl.w, conicPl.h, gid);
        if (tile) {
          const pid = `fcconicpat-${++uid}`;
          const pat = document.createElementNS(NS, 'pattern');
          pat.setAttribute('id', pid);
          pat.setAttribute('patternUnits', 'userSpaceOnUse');
          // Modulo the offset onto the repeating axes so the phase matches what the
          // browser painted (background-position: 50% on a 2em tile is not 0).
          pat.setAttribute('x', String(n2(ax + (conicPl.repeatX ? conicPl.x % conicPl.w : conicPl.x))));
          pat.setAttribute('y', String(n2(ay + (conicPl.repeatY ? conicPl.y % conicPl.h : conicPl.y))));
          pat.setAttribute('width', String(n2(conicPl.repeatX ? conicPl.w : Math.max(conicPl.w, area.w))));
          pat.setAttribute('height', String(n2(conicPl.repeatY ? conicPl.h : Math.max(conicPl.h, area.h))));
          pat.appendChild(tile);
          defs.appendChild(pat);
          g.appendChild(makeRoundedFill(NS, x, y, w, h, radii, uniform, `url(#${pid})`));
        }
      } else if (conic) {
        // SVG has no conic primitive, so the sweep is drawn as a fan of wedges. It is
        // the last thing on these pages that forced a raster: on the qr fixture a
        // single conic page background became a 1168×900 PNG that swamped every
        // vector node behind it.
        const fan = conicFanEl(NS, conic, x, y, w, h, gid);
        if (fan) {
          const cid = `fcconic-${++uid}`;
          const clip = document.createElementNS(NS, 'clipPath');
          clip.setAttribute('id', cid);
          clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
          clip.appendChild(makeRoundedFill(NS, x, y, w, h, radii, uniform, '#fff'));
          defs.appendChild(clip);
          fan.setAttribute('clip-path', `url(#${cid})`);
          g.appendChild(fan);
        }
      } else {
        const bgUrl = firstCssUrl(bgImg);
        const href = bgUrl ? await cssUrlToHref(bgUrl) : null;
        if (href) {
          // Place the image per background-size/position/repeat instead of stretching
          // it across the border box. The old behaviour was right only for a `cover`
          // hero: a 14px right-centred select chevron came out smeared across the
          // whole field, and this app's field primitive puts one on every select and
          // every checkbox.
          const pl = placeBackground(bgSize, bgPosition, bgRepeat, area, await intrinsicSize(href));

          const cid = `fcbgclip-${++uid}`;
          const clip = document.createElementNS(NS, 'clipPath');
          clip.setAttribute('id', cid);
          clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
          clip.appendChild(makeRoundedFill(NS, x, y, w, h, radii, uniform, '#fff'));
          defs.appendChild(clip);

          if (pl.w > 0 && pl.h > 0 && (pl.repeatX || pl.repeatY)) {
            // A tiling background becomes a real <pattern> rather than a screenshot.
            // The tile step is the painted size on the repeating axis and the whole
            // area on the axis that doesn't repeat, so repeat-x doesn't become a grid.
            const pid = `fcbgpat-${++uid}`;
            const pat = document.createElementNS(NS, 'pattern');
            pat.setAttribute('id', pid);
            pat.setAttribute('patternUnits', 'userSpaceOnUse');
            pat.setAttribute('x', String(n2(ax + (pl.repeatX ? pl.x % pl.w : pl.x))));
            pat.setAttribute('y', String(n2(ay + (pl.repeatY ? pl.y % pl.h : pl.y))));
            pat.setAttribute('width', String(n2(pl.repeatX ? pl.w : Math.max(pl.w, area.w))));
            pat.setAttribute('height', String(n2(pl.repeatY ? pl.h : Math.max(pl.h, area.h))));
            const pim = document.createElementNS(NS, 'image');
            pim.setAttribute('href', href);
            pim.setAttribute('x', '0'); pim.setAttribute('y', '0');
            pim.setAttribute('width', String(n2(pl.w))); pim.setAttribute('height', String(n2(pl.h)));
            pim.setAttribute('preserveAspectRatio', 'none');
            pat.appendChild(pim);
            defs.appendChild(pat);
            const fillRect = makeRoundedFill(NS, x, y, w, h, radii, uniform, `url(#${pid})`);
            g.appendChild(fillRect);
          } else if (pl.w > 0 && pl.h > 0) {
            const im = document.createElementNS(NS, 'image');
            im.setAttribute('href', href);
            im.setAttribute('x', String(n2(ax + pl.x))); im.setAttribute('y', String(n2(ay + pl.y)));
            im.setAttribute('width', String(n2(pl.w))); im.setAttribute('height', String(n2(pl.h)));
            // The size is already resolved, so the image must fill it exactly - 
            // letting preserveAspectRatio re-fit it would undo the arithmetic.
            im.setAttribute('preserveAspectRatio', 'none');
            im.setAttribute('clip-path', `url(#${cid})`);
            g.appendChild(im);
          }
        }
      }
    }

    // ── Inset box-shadow ──────────────────────────────────────────────────────
    // CSS paints an inset shadow over the background and under the border/content,
    // so it goes here rather than with the outer shadows. The geometry is exactly the
    // region between the border box and an offset, spread-shrunken copy of it: one
    // path with two subpaths and `fill-rule: evenodd`, blurred, and clipped to the
    // box so the blur cannot bleed outside. No stroke-width guessing, and the same
    // element count a stroked approximation would need.
    // Blur-less formats: the same ring treatment, mirrored. An inset shadow is the
    // blur of the region OUTSIDE the offset, shrunken inner shape, so each ring is the
    // annulus between two shrunken copies of it, and the innermost reaches the box.
    if (opts.noBoxShadow && !ownPaintRastered && tag !== 'img' && tag !== 'svg') {
      for (const sh of parseBoxShadow(style.boxShadow).reverse()) {
        if (!sh.inset) continue;
        const col = parseCssColorFull(sh.color);
        if (!col) continue;
        const shrunk = (t: number) => {
          const iw = w - 2 * (sh.spread + t), ih = h - 2 * (sh.spread + t);
          if (iw <= 0 || ih <= 0) return '';
          return roundedRectPath(x + sh.x + sh.spread + t, y + sh.y + sh.spread + t, iw, ih,
            insetCorners(radii, sh.spread + t));
        };
        const boxPath = roundedRectPath(x, y, w, h, radii);
        const rings = gaussianShadowRings(sh.blur, col[3]);
        const steps: { outerD: string; innerD: string; alpha: number }[] = rings.length
          ? rings.map((r) => ({
              outerD: r.inner === null ? boxPath : shrunk(r.inner),
              innerD: shrunk(r.outer),
              alpha: r.alpha,
            }))
          : [{ outerD: boxPath, innerD: shrunk(0), alpha: col[3] }];
        // Clip to the box: the offset copies reach past it, and an inset shadow that
        // escapes its own element is the one failure worse than not drawing it.
        const cid = `fcinsetring-${++uid}`;
        const clip = document.createElementNS(NS, 'clipPath');
        clip.setAttribute('id', cid);
        clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
        clip.appendChild(makeRoundedFill(NS, x, y, w, h, radii, uniform, '#fff'));
        defs.appendChild(clip);
        const ringG = document.createElementNS(NS, 'g');
        ringG.setAttribute('clip-path', `url(#${cid})`);
        for (const st of steps) {
          if (!st.outerD) continue;
          const p = document.createElementNS(NS, 'path');
          p.setAttribute('d', st.outerD + st.innerD);
          if (st.innerD) p.setAttribute('fill-rule', 'evenodd');
          p.setAttribute('fill', `rgb(${col[0]},${col[1]},${col[2]})`);
          p.setAttribute('fill-opacity', String(Math.round(st.alpha * 1000) / 1000));
          ringG.appendChild(p);
        }
        if (ringG.childNodes.length) g.appendChild(ringG);
      }
    }

    if (!opts.noBoxShadow && !ownPaintRastered && tag !== 'img' && tag !== 'svg') {
      for (const sh of parseBoxShadow(style.boxShadow).reverse()) {
        if (!sh.inset) continue;
        const col = parseCssColorFull(sh.color);
        if (!col) continue;
        const iw = Math.max(0, w - 2 * sh.spread), ih = Math.max(0, h - 2 * sh.spread);
        const iRadii = insetCorners(radii, sh.spread);
        // The outer subpath has to reach past the blur on every side, or the ring's
        // own outer edge blurs into view inside the box.
        const pad = sh.blur * 3 + Math.abs(sh.x) + Math.abs(sh.y) + Math.abs(sh.spread) + 8;
        const ring = document.createElementNS(NS, 'path');
        ring.setAttribute('d',
          `M${n2(x - pad)} ${n2(y - pad)}H${n2(x + w + pad)}V${n2(y + h + pad)}H${n2(x - pad)}Z` +
          roundedRectPath(x + sh.x + sh.spread, y + sh.y + sh.spread, iw, ih, iRadii));
        ring.setAttribute('fill-rule', 'evenodd');
        ring.setAttribute('fill', `rgb(${col[0]},${col[1]},${col[2]})`);
        if (col[3] < 1) ring.setAttribute('fill-opacity', String(col[3]));
        if (sh.blur > 0) {
          const fId = `fcinset-${++uid}`;
          const filt = document.createElementNS(NS, 'filter');
          filt.setAttribute('id', fId);
          filt.setAttribute('filterUnits', 'userSpaceOnUse');
          filt.setAttribute('x', String(n2(x - pad))); filt.setAttribute('y', String(n2(y - pad)));
          filt.setAttribute('width', String(n2(w + 2 * pad))); filt.setAttribute('height', String(n2(h + 2 * pad)));
          filt.setAttribute('color-interpolation-filters', 'sRGB');
          const fe = document.createElementNS(NS, 'feGaussianBlur');
          fe.setAttribute('stdDeviation', String(n2(sh.blur / 2)));   // CSS blur radius → σ
          filt.appendChild(fe);
          defs.appendChild(filt);
          ring.setAttribute('filter', `url(#${fId})`);
        }
        const cid = `fcinsetclip-${++uid}`;
        const clip = document.createElementNS(NS, 'clipPath');
        clip.setAttribute('id', cid);
        clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
        clip.appendChild(makeRoundedFill(NS, x, y, w, h, radii, uniform, '#fff'));
        defs.appendChild(clip);
        ring.setAttribute('clip-path', `url(#${cid})`);
        g.appendChild(ring);
      }
    }

    // ── Borders ─────────────────────────────────────────────────────────────
    // Mirror the PDF walker: a uniform border becomes one stroked rect/path (radius
    // honoured); a divider (border-top only) or mixed border fills per edge.
    // Colours keep their alpha (stroke-opacity / fill-opacity) - svg-ir flattens
    // it over the background for EMF/EPS - so hairline rgba() borders don't go opaque.
    const bSide = (wKey: string, cKey: string): { bw: number; rgb: Rgba | null } => {
      if (ownPaintRastered) return { bw: 0, rgb: null };   // already in the raster
      const bw = parseFloat((style as any)[wKey]) || 0;
      return { bw, rgb: bw > 0 ? parseCssColorFull((style as any)[cKey]) : null };
    };
    const bT = bSide('borderTopWidth',    'borderTopColor');
    const bR = bSide('borderRightWidth',  'borderRightColor');
    const bB = bSide('borderBottomWidth', 'borderBottomColor');
    const bL = bSide('borderLeftWidth',   'borderLeftColor');
    const eqRgb = (a: Rgba | null, b: Rgba | null) => a && b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
    const rgbStr = (c: Rgba) => `rgb(${c[0]},${c[1]},${c[2]})`;
    const uniformBorder = bT.rgb && bT.bw === bR.bw && bT.bw === bB.bw && bT.bw === bL.bw
      && eqRgb(bT.rgb, bR.rgb) && eqRgb(bT.rgb, bB.rgb) && eqRgb(bT.rgb, bL.rgb);
    if (uniformBorder) {
      const lw = bT.bw;
      // Centred stroke: inset the box by lw/2 and the radius by lw/2 (border-box
      // radius minus half the border). Uniform corners → <rect>; else a <path>.
      const r = uniform
        ? makeSvgRect(NS, x + lw / 2, y + lw / 2, Math.max(0, w - lw), Math.max(0, h - lw),
            Math.max(0, uniform[0] - lw / 2), 'none', Math.max(0, uniform[1] - lw / 2))
        : (() => {
            const p = document.createElementNS(NS, 'path');
            p.setAttribute('d', roundedRectPath(x + lw / 2, y + lw / 2,
              Math.max(0, w - lw), Math.max(0, h - lw), insetCorners(radii, lw / 2)));
            p.setAttribute('fill', 'none');
            return p;
          })();
      r.setAttribute('stroke', rgbStr(bT.rgb!));
      r.setAttribute('stroke-width', String(lw));
      if (bT.rgb![3] < 1) r.setAttribute('stroke-opacity', String(bT.rgb![3]));
      const dash = borderDashArray(style.borderTopStyle, lw);
      if (dash) {
        r.setAttribute('stroke-dasharray', dash.dash.join(' '));
        if (dash.round) r.setAttribute('stroke-linecap', 'round');
      }
      g.appendChild(r);
    } else {
      const edge = (rect: { rgb: Rgba; el: Element }) => { if (rect.rgb[3] < 1) rect.el.setAttribute('fill-opacity', String(rect.rgb[3])); g.appendChild(rect.el); };
      if (bT.rgb) edge({ rgb: bT.rgb, el: makeSvgRect(NS, x, y, w, bT.bw, 0, rgbStr(bT.rgb)) });
      if (bB.rgb) edge({ rgb: bB.rgb, el: makeSvgRect(NS, x, y + h - bB.bw, w, bB.bw, 0, rgbStr(bB.rgb)) });
      if (bL.rgb) edge({ rgb: bL.rgb, el: makeSvgRect(NS, x, y, bL.bw, h, 0, rgbStr(bL.rgb)) });
      if (bR.rgb) edge({ rgb: bR.rgb, el: makeSvgRect(NS, x + w - bR.bw, y, bR.bw, h, 0, rgbStr(bR.rgb)) });
    }

    // ── Inline SVG passthrough ──────────────────────────────────────────────
    if (tag === 'svg') {
      const clone = el.cloneNode(true) as Element;
      stripCommentNodes(clone);
      unscopeStyleEls(clone);
      // plans/101 (found via lolly-work's shot corpus): a nested <svg>'s
      // presentation is mostly CASCADE-driven on screen - class rules, var()s,
      // inherited text style - and the verbatim clone keeps only attributes
      // plus its inner <style>. Standalone, classes match stylesheets that
      // aren't there and var()s are undefined, so class-driven fills/strokes
      // vanish (a green ✓ ring flattens to a black dot) and var() strokes
      // don't paint at all. Bake each SVG descendant's COMPUTED presentation
      // onto the clone as INLINE style - inline beats the surviving un-scoped
      // <style> rules whose vars are undefined standalone; a presentation
      // attribute would not (the same ruling outlineSvgTextRuns records).
      // Guards: values equal to the SVG initial are skipped (an element whose
      // paint arrives via attributes keeps them - the clone carries those);
      // url(#…) paints are written verbatim, their defs travel inside the
      // clone; only SVG-namespace elements are touched (foreignObject HTML
      // has its own walk); <stop> takes its stop-* pair instead. Trades
      // accepted and pinned in export-nested-svg.test.ts: inheritance is
      // flattened to per-node literals (visually identical, the markup
      // denormalised), and inline style outranks SMIL/CSS animation on the
      // same property - a shot is a static capture anyway. The deep clone is
      // a same-order copy, so the two element lists pair 1:1 (the invariant
      // outlineSvgTextRuns leans on); topology mismatch skips the bake rather
      // than mispairing. The PDF walker needs no mirror - it already resolves
      // paints per node from the live DOM (computedPaint); this converges the
      // two walkers.
      {
        const SVGNS = 'http://www.w3.org/2000/svg';
        const PAINT = [
          ['fill', 'rgb(0, 0, 0)'], ['fill-opacity', '1'], ['fill-rule', 'nonzero'],
          ['stroke', 'none'], ['stroke-opacity', '1'], ['stroke-width', '1px'],
          ['stroke-linecap', 'butt'], ['stroke-linejoin', 'miter'],
          ['stroke-dasharray', 'none'], ['stroke-dashoffset', '0px'],
          ['stroke-miterlimit', '4'], ['opacity', '1'],
          ['paint-order', 'normal'], ['vector-effect', 'none'],
        ] as const;
        const TEXT = [
          ['font-family', ''], ['font-size', ''], ['font-weight', '400'],
          ['font-style', 'normal'], ['letter-spacing', 'normal'],
          ['text-anchor', 'start'], ['dominant-baseline', 'auto'],
        ] as const;
        const STOP = [['stop-color', 'rgb(0, 0, 0)'], ['stop-opacity', '1']] as const;
        const TEXT_TAGS = new Set(['text', 'tspan', 'textPath']);
        const srcEls = el.querySelectorAll('*');
        const cloneEls = clone.querySelectorAll('*');
        if (srcEls.length === cloneEls.length) {
          for (let i = 0; i < srcEls.length; i++) {
            const s = srcEls[i]!;
            const c = cloneEls[i]!;
            if (s.namespaceURI !== SVGNS || !(c instanceof SVGElement)) continue;
            const cs = getComputedStyle(s);
            const bake = (props: readonly (readonly [string, string])[]): void => {
              for (const [p, initial] of props) {
                const v = cs.getPropertyValue(p);
                if (v && v !== initial) c.style.setProperty(p, v);
              }
            };
            if (s.localName === 'stop') { bake(STOP); continue; }
            bake(PAINT);
            if (TEXT_TAGS.has(s.localName)) bake(TEXT);
          }
        }
      }
      // `currentColor` inside the svg resolves against the inherited CSS `color`
      // on screen, but the emitted file is a STANDALONE svg with no HTML
      // ancestors, so there it falls back to the initial value - black. The
      // gallery's ghost icons (`stroke="currentColor"` under a blue-`color`
      // span) are exactly that: blue on screen, black ink in the walked shot.
      // Stamp the live computed color onto the clone root as a presentation
      // attribute - it is (0,0,0) specificity, so an inner node's own
      // color rule still wins wherever its CSS survives the clone; the PDF
      // walker needs no mirror because it resolves paints per node from the
      // live DOM via computedPaint (see the note above the `path` branch).
      if (style.color) clone.setAttribute('color', style.color);
      clone.setAttribute('x',      String(x));
      clone.setAttribute('y',      String(y));
      clone.setAttribute('width',  String(w));
      clone.setAttribute('height', String(h));
      await inlineBlobUrlsInEl(clone);
      g.appendChild(clone);
      return;
    }

    // ── Image (SVG source → inline vector; bitmap → raster <image>) ───────────
    if (tag === 'img') {
      const src = el.src || el.getAttribute('src') || '';
      if (src && w > 0 && h > 0) {
        // SVG sources stay VECTOR - inline them as a nested <svg>, fitted "meet"
        // (object-fit: contain), instead of a raster <image>. SVG-ness is sniffed
        // from the bytes (asset URLs are blob: with no extension/MIME hint). Mirrors
        // the PDF walker; real bitmaps fall through to the <image> path below.
        let inlineSvg: any = null;
        try { inlineSvg = await inlineSvgFromImg(src); } catch { inlineSvg = null; }
        if (inlineSvg) {
          await inlineBlobUrlsInEl(inlineSvg);
          // Nested-<svg> scaling needs a viewBox; synthesise one from width/height
          // if the source omitted it, so the mark still fits its box.
          if (!inlineSvg.getAttribute('viewBox')) {
            const iw = parseFloat(inlineSvg.getAttribute('width'));
            const ih = parseFloat(inlineSvg.getAttribute('height'));
            if (iw > 0 && ih > 0) inlineSvg.setAttribute('viewBox', `0 0 ${iw} ${ih}`);
          }
          inlineSvg.setAttribute('x',      String(x));
          inlineSvg.setAttribute('y',      String(y));
          inlineSvg.setAttribute('width',  String(w));
          inlineSvg.setAttribute('height', String(h));
          if (!inlineSvg.getAttribute('preserveAspectRatio')) {
            // object-fit → meet (contain) / slice (cover); object-position → alignment.
            // Default (contain, centred) resolves to the prior 'xMidYMid meet'.
            // A framing pan falls between the nine alignments preserveAspectRatio can
            // name, so those get explicit geometry off the viewBox aspect instead.
            const vb = (inlineSvg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
            const exact = vb.length === 4 && vb[2]! > 0 && vb[3]! > 0
              ? exactFittedRect(style, vb[2]!, vb[3]!, x, y, w, h) : null;
            if (exact) {
              inlineSvg.setAttribute('x',      String(exact.x));
              inlineSvg.setAttribute('y',      String(exact.y));
              inlineSvg.setAttribute('width',  String(exact.w));
              inlineSvg.setAttribute('height', String(exact.h));
              inlineSvg.setAttribute('preserveAspectRatio', 'none');
              if (style.objectFit === 'cover') {
                const clipId = `svgfit-${++uid}`;
                const cp = document.createElementNS(NS, 'clipPath');
                cp.setAttribute('id', clipId);
                const r = document.createElementNS(NS, 'rect');
                r.setAttribute('x', String(x)); r.setAttribute('y', String(y));
                r.setAttribute('width', String(w)); r.setAttribute('height', String(h));
                cp.appendChild(r);
                defs.appendChild(cp);
                inlineSvg.setAttribute('clip-path', `url(#${clipId})`);
              }
            } else {
              const meetSlice = style.objectFit === 'cover' ? 'slice' : 'meet';
              inlineSvg.setAttribute('preserveAspectRatio', `${preserveAspectRatioAlign(style.objectPosition)} ${meetSlice}`);
            }
          }
          g.appendChild(inlineSvg);
          return;
        }
        try {
          // Inline EVERY scheme, not just data:/blob:. An http/relative src was
          // previously written straight into `<image href="/catalog/…">`, and an SVG
          // consumed as `<img src="shot.svg">` - which is how /info serves every docs
          // screenshot, and how any exported SVG is normally viewed - runs in secure
          // static mode with NO network access, so that image renders BLANK and the
          // file is not self-contained. The sibling CSS-url branch already fetches
          // and inlines http (cssUrlToHref, :1651), so this was the `<img>` branch
          // being inconsistent with it rather than a deliberate exemption.
          // Falls back to the raw src on failure (cross-origin without CORS, 404),
          // which is exactly the old behaviour - never worse than before.
          const dataUrl0 = src.startsWith('data:') ? src
            : await blobToDataUrl(src).catch(() => src);
          // Preserve an embedded bitmap's provenance BEFORE downscaleRasterForBox's
          // canvas re-encode strips it (canvas.toDataURL emits a metadata-free PNG):
          // read the source's Content Credentials and carry them forward as a
          // componentOf ingredient on the EXPORT's own manifest, so a genAI origin (or
          // any credential) stays on the record even though the embedded pixels can no
          // longer hold it. Verify walks ingredient manifests, so the flag surfaces.
          // Only credentialed bitmaps add one; gated on _ingredientSink (c2pa only).
          if (opts._ingredientSink && dataUrl0.startsWith('data:')) {
            try {
              const b = Uint8Array.from(atob(dataUrl0.slice(dataUrl0.indexOf(',') + 1)), (c) => c.charCodeAt(0));
              const store = extractC2paStore(b);
              const ing = store && prepareC2paIngredientFromStore(store.store, store.format);
              if (ing && !opts._ingredientSink.some((p) => p.activeLabel === ing.activeLabel)) {
                opts._ingredientSink.push({ ...ing, relationship: 'componentOf' });
              }
            } catch { /* not a decodable/credentialed bitmap */ }
          }
          // CSS filter() (e.g. grayscale/contrast presets) is baked into the bitmap
          // via the browser so the vector image matches screen/PNG instead of
          // exporting full-colour. No-op + graceful fallback when filter is none.
          const dataUrlF = await bakeImageFilter(el, dataUrl0, style.filter);
          // Cap the inlined resolution to what this box (w x h CSS px) can show. Normally
          // dpi-aware off the export dpi (>=2x the box, so a print export keeps resolution);
          // when `opts.rasterDpi` is set the asset instead embeds at that DPI with a 1x
          // floor, so a walker SVG can shed a heavy photo's unseen pixels (ExportOpts.rasterDpi).
          const rOptIn = (opts.rasterDpi as number) > 0;
          const rDpi = rOptIn ? (opts.rasterDpi as number) : d.dpi;
          const dataUrl = await downscaleRasterForBox(el, dataUrlF, Math.max(w, h), rDpi, rOptIn ? 1 : 2, rOptIn ? 'auto' : 'png');
          const rMin = Math.min(
            parseCssLen(style.borderTopLeftRadius,     w),
            parseCssLen(style.borderTopRightRadius,    w),
            parseCssLen(style.borderBottomLeftRadius,  w),
            parseCssLen(style.borderBottomRightRadius, w),
          );
          const isCircle = rMin >= Math.min(w, h) * 0.45;
          const img = document.createElementNS(NS, 'image');
          img.setAttribute('href',   dataUrl);
          img.setAttribute('x',      String(x));
          img.setAttribute('y',      String(y));
          img.setAttribute('width',  String(w));
          img.setAttribute('height', String(h));
          if (isCircle) {
            const clipId = `imgclip-${++uid}`;
            const cp = document.createElementNS(NS, 'clipPath');
            cp.setAttribute('id', clipId);
            const circle = document.createElementNS(NS, 'circle');
            circle.setAttribute('cx', String(x + w / 2));
            circle.setAttribute('cy', String(y + h / 2));
            circle.setAttribute('r',  String(Math.min(w, h) / 2));
            cp.appendChild(circle);
            defs.appendChild(cp);
            img.setAttribute('clip-path',           `url(#${clipId})`);
            img.setAttribute('preserveAspectRatio', 'xMidYMid slice');
          } else if (style.objectFit === 'cover' || style.objectFit === 'contain') {
            // A framing pan (plans/148) produces an object-position percentage that
            // preserveAspectRatio cannot name; place those explicitly instead.
            const exact = exactFittedRect(style, el.naturalWidth || 0, el.naturalHeight || 0, x, y, w, h);
            if (exact) {
              img.setAttribute('x',      String(exact.x));
              img.setAttribute('y',      String(exact.y));
              img.setAttribute('width',  String(exact.w));
              img.setAttribute('height', String(exact.h));
              img.setAttribute('preserveAspectRatio', 'none');   // aspect is in the numbers
              if (style.objectFit === 'cover') {
                // `slice` used to do the cropping; explicit geometry overflows the box,
                // so the crop has to be a real clip.
                const clipId = `imgfit-${++uid}`;
                const cp = document.createElementNS(NS, 'clipPath');
                cp.setAttribute('id', clipId);
                const r = document.createElementNS(NS, 'rect');
                r.setAttribute('x', String(x)); r.setAttribute('y', String(y));
                r.setAttribute('width', String(w)); r.setAttribute('height', String(h));
                cp.appendChild(r);
                defs.appendChild(cp);
                img.setAttribute('clip-path', `url(#${clipId})`);
              }
            } else if (style.objectFit === 'cover') {
              // Fill the box, cropping the overflow - `slice` clips to the image's own
              // x/y/width/height viewport, so no extra clipPath is needed (matches the
              // on-screen hero/masthead). object-position picks WHICH edge is cropped.
              img.setAttribute('preserveAspectRatio', `${preserveAspectRatioAlign(style.objectPosition)} slice`);
            } else {
              // meet-fit the whole image; object-position places it within the box.
              // Centre resolves to 'xMidYMid meet' = the SVG default (unchanged).
              img.setAttribute('preserveAspectRatio', `${preserveAspectRatioAlign(style.objectPosition)} meet`);
            }
          }
          g.appendChild(img);
        } catch { /* skip unloadable images */ }
      }
      return;
    }

    // ── overflow:hidden → clip the CONTENT to the box (rounded or square) ──────
    // CSS crops an overflow:hidden box's descendants to the box (its corner curve when
    // rounded); the walker draws each box's own bg but doesn't clip descendants, so a
    // child that spills - a differently-filled titlebar past a rounded edge, or an
    // over-sized image/child past a square edge - would show outside the box. Route
    // children/text/pseudo through a <clipPath> sub-group (rounded fill, or a plain rect
    // when there's no radius); the box-shadow/background/border stay in `g` (unclipped) so
    // an outset shadow still extends past the box. A ROUNDED overflow box always clips (its
    // children must follow the corner curve); a SQUARE one clips only when a descendant
    // ACTUALLY spills (scroll > client) - most overflow:hidden boxes (flex/grid layout) clip
    // nothing visible, and a clip group on every one would bloat the SVG for no change.
    const clipsOverflow = (style.overflowX && style.overflowX !== 'visible') || (style.overflowY && style.overflowY !== 'visible');
    const spillsBox = (el.scrollWidth || 0) > (el.clientWidth || 0) + 1 || (el.scrollHeight || 0) > (el.clientHeight || 0) + 1;
    // ── Overflow clip (decided AFTER the walk - see finaliseOverflowClip) ─────
    // A clip is friction for whoever opens the file next: a designer has to release
    // it before they can edit anything inside. So the group is created optimistically
    // and the clip attribute is only attached at the end, once the descendants have
    // been measured and we know it is doing work. Across the five local fixtures the
    // walker emitted 325 clip defs and 4373 references to them, every one a single
    // shape - most of them around content that never came near the edge.
    let contentG: Element = g;
    let ovClipId: string | null = null;
    let ovBounds: Bounds | null = null;
    const clipCandidate = Boolean(clipsOverflow) && (hasRadius || spillsBox);
    if (clipCandidate) {
      ovClipId = `fcovclip-${++uid}`;
      contentG = document.createElementNS(NS, 'g');
      g.appendChild(contentG);
      ovBounds = newBounds();
    }

    /**
     * Attach the overflow clip, or prove it unnecessary and leave it off.
     *
     * Kept when content genuinely leaves the box (`spillsBox` - the browser's own
     * scrollWidth/scrollHeight verdict, which also catches a text line running past
     * the edge), or when the box is rounded and something painted inside comes close
     * enough to an edge to touch a corner arc.
     *
     * Dropped otherwise, which also means dropping the `clip-path` references that
     * hoisted descendants took with them - a dangling url(#…) would clip them to
     * nothing.
     */
    const finaliseOverflowClip = (): void => {
      if (!ovClipId) return;
      const maxR = hasRadius
        ? Math.max(radii.topLeft[0], radii.topLeft[1], radii.topRight[0], radii.topRight[1],
                   radii.bottomRight[0], radii.bottomRight[1], radii.bottomLeft[0], radii.bottomLeft[1])
        : 0;
      const b = ovBounds;
      const touchesEdge = !b?.any ? false
        : b.minX < x + maxR || b.minY < y + maxR || b.maxX > x + w - maxR || b.maxY > y + h - maxR;
      if (spillsBox || (hasRadius && touchesEdge)) {
        const clip = document.createElementNS(NS, 'clipPath');
        clip.setAttribute('id', ovClipId);
        clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
        clip.appendChild(makeRoundedFill(NS, x, y, w, h, radii, uniform, '#fff'));   // 0 radii → a plain rect
        defs.appendChild(clip);
        contentG.setAttribute('clip-path', `url(#${ovClipId})`);
        return;
      }
      // Not needed. Strip the references a hoisted descendant carried, then fold the
      // wrapper away so the output has neither the clip nor an extra empty group.
      for (const ref of Array.from(rootG.querySelectorAll(`[clip-path="url(#${ovClipId})"]`))) {
        ref.removeAttribute('clip-path');
      }
      if (contentG !== g && contentG.parentNode === g) {
        while (contentG.firstChild) g.insertBefore(contentG.firstChild, contentG);
        contentG.remove();
      }
    };

    // ── The stacking context this element's descendants live in ───────────────
    // `parentG` is the in-flow pointer and `ctx.frame` is the stacking pointer.
    // Splitting them is what makes Appendix E section E.2 step 8's parenthetical fall
    // out for free: an element that is POSITIONED but does NOT create a context
    // (`position: relative; z-index: auto`) is deferred into layer 6, its
    // in-flow children append into its own contentG and travel with it, and a
    // `z-index: 5` grandchild defers past it to the ANCESTOR frame's layer 7 - 
    // which is exactly what CSS paints, and exactly what a naive
    // "positioned ⇒ treat as a context" implementation gets wrong.
    let ownFrame: ScFrame | null = null;
    // The box descendants are confined to. Rounded corners are ignored here on
    // purpose: this is only ever used to REJECT a node that misses the box entirely,
    // and the outer rectangle is the conservative bound for that.
    const childClipBox = clipCandidate ? intersectRect(cb, { x, y, w, h }) : cb;
    let childCtx: PaintCtx = { frame: ctx.frame, clips: ctx.clips, clipBox: childClipBox, bounds: ovBounds ?? ctx.bounds };
    if (stackingOrder) {
      if (createsCtx) {
        ownFrame = {
          content: contentG,
          // When there is no overflow clip, contentG IS g - so a layer-2 unit
          // inserted at firstChild would land BEHIND this element's own
          // box-shadow/background/border, which section E.2 step 3 puts first. Anchor
          // on the last own-paint node instead. With a clip group, contentG is
          // empty and firstChild is already the right place (anchor null).
          anchor: contentG === g ? g.lastChild : null,
          neg: [], z0: [], pos: [],
        };
        childCtx = { frame: ownFrame, clips: [], clipBox: childClipBox, bounds: ovBounds ?? ctx.bounds };
      } else {
        // Not a context: descendants belong to the SAME frame, but a hoist out
        // of here now crosses this element's overflow clip and must carry it.
        childCtx = { frame: ctx.frame, clips: ovClipId ? ctx.clips.concat(ovClipId) : ctx.clips,
                     clipBox: childClipBox, bounds: ovBounds ?? ctx.bounds };
      }
    }

    // ── Recurse block-level children ────────────────────────────────────────
    // Inline children are left to emitInlineTextSvg below, which walks the inline
    // flow and emits TEXT. That is right for a <span>, and silently wrong for an
    // inline <svg>: the inline walk has no passthrough branch, so the SVG is
    // dropped entirely and nothing warns. An <svg> is replaced content, not text - 
    // it has a box of its own at any display value - so route it here regardless.
    // (App icons survived only because the CSS sets them display:block. A bare
    // <svg> defaults to display:inline, which is exactly what a TOOL's own canvas
    // is: the QR code was missing from every page snapshot for this reason. Tool
    // EXPORTS were unaffected - an SVG-rooted canvas takes the renderSvg fast path
    // and never enters this walker.)
    //
    // A flex/grid container paints its items in ORDER-MODIFIED document order
    // (CSS Flexbox section 5.4, CSS Grid section 6), not raw document order. Pure reorder: the
    // visit PREDICATE is untouched, and it doesn't need to change, because
    // `position: absolute|fixed` blockifies computed display (CSS Display 3
    // section 2.7) - so every layer-2/6/7 child already fails the inlineFlow test and
    // is already visited today.
    // The own-paint boundary: everything in contentG up to here is this element's
    // own background/border/shadow. A negative-z pseudo has to land just past it -
    // under the children and text appended below - so svgPseudoContent's negInsert
    // (DOM-order mode) inserts there, advancing the cursor to keep encounter order.
    let negCursor: ChildNode | null = contentG.lastChild;
    const kids: Element[] = stackingOrder && isFlexOrGridContainer(style.display)
      ? orderModifiedChildren(renderedChildren(el),
          (c) => Number.parseInt(window.getComputedStyle(c).order || '0', 10) || 0)
      : renderedChildren(el);
    // A child WITHOUT a box of its own is a plain-inline wrapper (<span>, an
    // unstyled <a>): its text belongs to emitInlineTextSvg below - but an own-box
    // DESCENDANT inside it (an <img>, an inline <svg>, an <input>) belonged to
    // NOBODY: this loop skipped the wrapper, and the inline text walk returns at
    // own-box children on the assumption this loop visited them. A preview <img>
    // inside an unstyled inline <a> therefore vanished from the shot, silently - 
    // the nested form of the bare-<svg> bug above. Descend through inline
    // wrappers and visit their own-box descendants; drawing them can only add,
    // because the previous behaviour was nothing. (Their TEXT is untouched: the
    // inline walk descends the same wrappers for text nodes, and still returns
    // at every own-box element, so nothing double-paints.)
    const visitThroughInline = async (wrapper: Element): Promise<void> => {
      for (const c of renderedChildren(wrapper)) {
        if (hasOwnBox(c)) await visitSvgNode(c, contentG, childCtx);
        else await visitThroughInline(c);
      }
    };
    for (const child of kids) {
      if (hasOwnBox(child)) await visitSvgNode(child, contentG, childCtx);
      else await visitThroughInline(child);
    }
    // Shadow text: a host's own text pass below reads el.childNodes, which for a
    // shadow host is the LIGHT tree - the part that only renders where a <slot> puts
    // it. Text authored inside the shadow root has to be walked from the root itself.
    const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
    if (sr) await emitInlineTextSvg(textContext, NS, sr, style, rootRect, contentG);

    // ── Inline text ─────────────────────────────────────────────────────────
    await emitInlineTextSvg(textContext, NS, el, style, rootRect, contentG);

    // ── <canvas> ─────────────────────────────────────────────────────────────
    // The pixels are the content; there is no vector form to recover. Snapshot the
    // backing store the same way snapshotMotion does, so chart/filter/D3 tools and
    // any real page draw something instead of an empty box. A cross-origin-tainted
    // canvas throws on toDataURL - that is unrecoverable, so it degrades to blank
    // with a warning rather than failing the export.
    if (tag === 'canvas') {
      // …unless the painter published a vector twin. The property is read
      // SYNCHRONOUSLY here so a canvas without one never awaits anything - that is
      // what keeps the untwinned path byte-identical AND allocation-free.
      const twin = typeof (el as VectorTwinCanvas).__lollyVectorTwin === 'function'
        ? await vectorTwinEl(el as HTMLCanvasElement, () => `tw${++uid}-`)
        : null;
      if (twin) {
        // Placed on the element box with the raster branch's exact geometry and
        // stretch semantics, so swapping raster for vector cannot move a pixel.
        twin.setAttribute('x', String(n2(x))); twin.setAttribute('y', String(n2(y)));
        twin.setAttribute('width', String(n2(w))); twin.setAttribute('height', String(n2(h)));
        twin.setAttribute('preserveAspectRatio', 'none');
        // `currentColor` in a standalone svg falls back to black - mirror the live
        // computed colour as the inline-<svg> passthrough above does.
        if (style.color) twin.setAttribute('color', style.color);
        contentG.appendChild(twin);
      } else try {
        const url = (el as HTMLCanvasElement).toDataURL('image/png');
        if (url && url.length > 'data:image/png;base64,'.length + 8) {
          const im = document.createElementNS(NS, 'image');
          im.setAttribute('href', url);
          im.setAttribute('x', String(n2(x))); im.setAttribute('y', String(n2(y)));
          im.setAttribute('width', String(n2(w))); im.setAttribute('height', String(n2(h)));
          im.setAttribute('preserveAspectRatio', 'none');
          contentG.appendChild(im);
        }
      } catch (e) {
        _host?.log?.('warn', `svg: <canvas> could not be read (tainted?) - ${(e as Error).message}`);
      }
    }

    // ── Form controls ────────────────────────────────────────────────────────
    // A control's value is not a text node, so the pass above sees nothing and the
    // box comes out empty - the blank URL field and blank Error-correction select on
    // every tool-page snapshot. What it shows is decided in form-controls.ts; the
    // LAYOUT is deliberately not reimplemented here. Instead the text is mirrored
    // into a throwaway element positioned over the control's content box and walked
    // with the same emitInlineTextSvg, so alignment, wrapping, direction, ellipsis
    // and vertical centring come from the browser rather than from a second, worse
    // implementation of CSS. The mirror is removed in a finally.
    await emitControlPaint(el, tag, style, contentG);

    // ── CSS generated content (::before/::after markers) ──────────────────────
    // pseudoDescriptor only models the ABSOLUTELY POSITIONED marker idiom, so
    // every pseudo it emits is by construction a positioned descendant - i.e.
    // section E.2 layer 6/7 (or 2 for a negative-z scrim), never in-flow content. In
    // stacking mode each one therefore gets its own <g> and is placed like any
    // other positioned child, which stops a marker from hiding under a later
    // sibling's background.
    await svgPseudoContent(NS, contentG, rootRect, el, vectorText,
      stackingOrder && childCtx.frame
        ? (z: number) => {
            const pg = document.createElementNS(NS, 'g');
            place(pg, { createsContext: false, reason: '', layer: z < 0 ? 2 : z > 0 ? 7 : 6, z, order: 0 },
              childCtx, contentG);
            return pg;
          }
        : undefined,
      (pg) => {
        contentG.insertBefore(pg, negCursor ? negCursor.nextSibling : contentG.firstChild);
        negCursor = pg;
      });

    // ── Finalise this stacking context (CSS 2.1 Appendix E section E.2) ──────────────
    // Everything deferred by descendants is appended here, in spec order. This
    // runs AFTER emitInlineTextSvg and svgPseudoContent, so layers 6 and 7 land
    // after layer-5 inline content automatically - a positioned child declared
    // before its parent's text still paints on top of it, which is what CSS does
    // and what DOM order got backwards.
    if (ownFrame) {
      const f = ownFrame;
      // Step 3: negative-z contexts paint AFTER this element's own
      // background/border and BEFORE all in-flow content. `first` is re-read
      // here (not captured earlier) so it reflects the children/text/pseudo that
      // have since been appended. insertBefore against a FIXED anchor preserves
      // insertion sequence - [a], [a,b], [a,b,c] - so the sorted array goes in
      // ascending, most-negative first, with no reverse.
      const first = f.anchor ? f.anchor.nextSibling : f.content.firstChild;
      for (const u of sortUnits(f.neg)) f.content.insertBefore(u.g, first);
      for (const u of f.z0)             f.content.appendChild(u.g);   // step 8 - tree order, NOT z-sorted
      for (const u of sortUnits(f.pos)) f.content.appendChild(u.g);   // step 9
    }

    // Last, because it needs both the measured descendant bounds and the hoisted
    // units to be in place before it can decide - and, if it decides against, strip
    // the references those hoists carried.
    finaliseOverflowClip();
  }

  // KNOWN LIMITATION: the PDF walker (`drawHtmlVectors`) has the identical
  // DOM-order defect and is deliberately untouched, so SVG/EMF/EPS/DXF get
  // stacking order under the flag and PDF does not. That is a new divergence in
  // two walkers whose own comments ask that they stay mirrored; it is recorded
  // at both sites rather than silently accepted.
  // The root call passes NO frame on purpose: `node` itself is the root stacking
  // context (`el === node` forces it), and its own <g> must land in rootG
  // directly. Handing it a frame nobody finalises would silently drop the whole
  // page if the export root ever happened to be positioned.
  await visitSvgNode(node, rootG, { frame: null, clips: [] });
  // ONE line for the whole walk (plans/104 section 12 Q2): what did not stay vector, and why.
  // The user was told in advance by the export panel's amber row; this is the record in
  // the log, and it is what a CLI or a headless caller has instead of that row.
  if (tiltedRasters) {
    _host?.log?.('info',
      `svg: ${tiltedRasters} tilted element${tiltedRasters === 1 ? '' : 's'} embedded as images `
      + '(SVG has no perspective transform; every untilted layer stayed vector)');
  }
  const xml = injectSvgMeta(new XMLSerializer().serializeToString(svgEl), opts.meta);

  // Parse-check before returning. This walker can emit XML that does not parse,
  // and it does it SILENTLY: the inline-<svg> passthrough clones live DOM and
  // re-serialises it, so one malformed attribute in authored markup (a `<path d="…`
  // that never closes - lib/icons.ts shipped exactly that) becomes an attribute
  // whose value contains `</svg><span class=`, and XMLSerializer faithfully writes
  // it out. The result was a 1.1 MB file, no thrown error, no warning, and it would
  // have been committed as a screenshot baseline.
  //
  // Print-derived output cannot fail this way - it consumes painted output, never
  // authored markup - so this gate is what buys the direct walker the same "fails
  // loudly or not at all" property. DOMParser puts <parsererror> in the result
  // rather than throwing, hence the explicit check.
  try {
    const probe = new DOMParser().parseFromString(xml, 'image/svg+xml');
    const err = probe.getElementsByTagName('parsererror')[0];
    if (err) {
      const detail = (err.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 300);
      throw new Error(`renderSvgFromHtml produced XML that does not parse: ${detail}`);
    }
  } catch (e) {
    // Rethrow as a plain, actionable error. Never return the bad bytes: a caller
    // that writes them to disk (the docs screenshot pipeline) has no other way to
    // notice, and a half-valid SVG renders as a blank box in every viewer.
    throw e instanceof Error ? e : new Error(String(e));
  }

  return new Blob(['<?xml version="1.0" standalone="no"?>\n' + xml], { type: 'image/svg+xml' });
}

/**
 * Does this child have a box the block walk must paint?
 *
 * Everything except a non-replaced `display: inline`, whose background and text are
 * the inline walk's job. This predicate is the whole reason an inline-block's
 * background used to vanish: the loop tested for "inline flow" and skipped
 * inline-block and inline-flex along with inline, leaving them to a text pass that
 * paints no boxes at all - and leaving a replaced control, which has no text nodes,
 * emitting nothing whatsoever.
 *
 * `display: contents` has no box of its own but its CHILDREN do, and visitSvgNode
 * recurses, so it is included rather than dropped.
 */
/**
 * The children this element actually RENDERS - the flat tree, not the DOM tree.
 *
 * A shadow host renders its shadow root's children, not its own; its light children
 * appear only where a <slot> places them. Walking `el.children` therefore missed the
 * entire shadow tree (39–51 rendered elements per page in this app, which is
 * jelly-ui) while walking both would paint slotted content twice.
 */
export function renderedChildren(el: Element): Element[] {
  const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
  if (sr) return Array.from(sr.children) as Element[];
  if (el.tagName.toLowerCase() === 'slot') {
    // flatten:true resolves a slot forwarded into another slot.
    return (el as HTMLSlotElement).assignedElements?.({ flatten: true }) ?? [];
  }
  return Array.from(el.children) as Element[];
}

export function hasOwnBox(child: Element): boolean {
  const cd = window.getComputedStyle(child).display;
  return cd !== 'inline' || isReplaced(child);
}


interface PseudoDescriptor {
  text: string; bg: Rgba | null; radii: CornerRadii; uniform: CornerPair | null;
  w: number; h: number; ps: CSSStyleDeclaration; x: number; y: number;
  /** The pseudo's own transform, LINEAR part only (rotate/scale/skew), about its
   *  transform-origin in root space. Null for none / pure translate / 3-D - the
   *  translate component is already folded into x/y, so a caller that ignores this
   *  still gets the common `translate(-50%,-50%)` centring idiom correctly. */
  mat: Mat2D | null;
}

/**
 * Does this element establish the containing block for an ABSOLUTELY positioned
 * descendant? `position !== static` is only the first clause of CSS Position 3 section 3.
 *
 * Missing the rest is not academic. `.profile-link` (the top-right profile pill) is
 * `position: static` with `backdrop-filter: blur(4px)` from the shared `.btn--glass`
 * alias - which makes it a containing block - so the browser anchors its `::before`
 * avatar dot to the PILL, while a position-only walk anchored it to the whole
 * `.gallery-topright` cluster 103px to the left. The dot came out sitting on top of
 * the settings button in every SVG and PDF export (docs/shots/use-utilities.svg).
 * Glass/blur chrome is used throughout this app, so the position-only rule is wrong
 * wherever a pseudo marker sits inside it.
 */
function establishesAbsContainingBlock(cs: CSSStyleDeclaration): boolean {
  if (cs.position !== 'static') return true;
  const s = cs as unknown as Record<string, string | undefined>;
  if (cs.transform && cs.transform !== 'none') return true;
  // The individual transform properties are equally sufficient (Transforms 2 section 3).
  for (const k of ['translate', 'rotate', 'scale']) {
    const v = s[k];
    if (v && v !== 'none') return true;
  }
  if (cs.perspective && cs.perspective !== 'none') return true;
  if (cs.filter && cs.filter !== 'none') return true;
  const backdrop = s.backdropFilter ?? s.webkitBackdropFilter;
  if (backdrop && backdrop !== 'none') return true;
  // `will-change` on any of the above is sufficient on its own - the point of the
  // property is that the browser promotes the element BEFORE the value changes.
  if (/\b(transform|perspective|filter|backdrop-filter|contain|translate|rotate|scale)\b/.test(cs.willChange || '')) return true;
  if (/\b(paint|layout|strict|content)\b/.test(cs.contain || '')) return true;
  const cv = s.contentVisibility;
  if (cv === 'auto' || cv === 'hidden') return true;
  return false;
}

/**
 * Does the browser skip painting this element even though its computed style says it
 * is visible? Two cases, both of which lay out normally and both of which the walker
 * would otherwise draw:
 *
 *   - a subtree inside a CLOSED <details> (excluding its own <summary>, which paints)
 *   - `content-visibility: hidden`, whose subtree is laid out but never painted
 *
 * checkVisibility() knows about both, but its `checkOpacity`/`checkVisibilityCSS`
 * options overlap gates the walk already applies more precisely (an opacity-0 element
 * is dropped a line above, and the walker's own opacity handling is richer), so the
 * DOM answer is used only as a cross-check on the two cases above.
 */
export function isPaintSkipped(el: Element, style: CSSStyleDeclaration): boolean {
  if (style.contentVisibility === 'hidden') return true;
  const details = el.closest('details:not([open])');
  // closest() matches the element itself: the <details> box is painted (it is the
  // card), only its non-summary CONTENTS are skipped.
  if (!details || details === el) return false;
  // The summary is the part a closed <details> DOES paint - as is anything inside it.
  const summary = details.querySelector(':scope > summary');
  return !(summary?.contains(el));
}

// Resolve a CSS generated-content pseudo-element (::before/::after) into a drawable
// descriptor, or null if it has nothing visible. The DOM walkers only see real
// nodes, so list markers / arrows authored as ::before content (e.g. dynamic-layout's
// bullet dots and → arrows) are otherwise dropped from SVG/PDF. Scoped to the
// absolutely-positioned marker idiom - a pseudo has no getBoundingClientRect, so its
// box is computed from its containing block (nearest positioned ancestor) padding box
// + the pseudo's own left/top/size. The padding box's origin is the padding EDGE - 
// just inside the border, NOT inside the padding (CSS 2.1 section 10.1) - so the offset adds
// border widths only. Inline/static generated content isn't modelled.
export function pseudoDescriptor(el: Element, name: string): PseudoDescriptor | null {
  const ps = window.getComputedStyle(el, name);
  const content = ps.content;
  if (!content || content === 'none' || content === 'normal') return null;
  if (ps.position !== 'absolute') return null;
  // The same visibility gate the element walk applies (see visit(), ~L2135). A pseudo
  // the browser does not paint must not be emitted. Two shipping idioms hide a pseudo
  // with opacity alone and were being drawn anyway: `.plat-swatch-chip::after` (the
  // word "Copied" over a 55%-black scrim, revealed for 900ms by a click handler) and
  // `[data-tip]::after` (the tooltip bubble). Without this, every colour chip in a
  // capture came back darkened and captioned, and every tooltip host grew a ghost
  // pill - in SVG *and* PDF, since both call this one descriptor.
  if (ps.display === 'none' || ps.visibility === 'hidden') return null;
  if (!(parseFloat(ps.opacity || '1') > 0)) return null;
  const w = parseFloat(ps.width)  || 0;
  const h = parseFloat(ps.height) || 0;
  const bg = parseCssColorFull(ps.backgroundColor);
  // getComputedStyle returns the resolved string with real chars (e.g. '"→"'),
  // already quoted; unwrap it. counter()/attr() values won't match and are skipped.
  const m = content.match(/^["'](.*)["']$/s);
  const text = applyTextTransform(m ? m[1]! : '', ps.textTransform);
  if (!text.trim() && !(bg && w > 0.5 && h > 0.5)) return null;

  let cb: Element | null = el;
  while (cb && !establishesAbsContainingBlock(window.getComputedStyle(cb))) cb = cb.parentElement;
  cb = cb || el;
  const cbRect = cb.getBoundingClientRect();
  const cbStyle = window.getComputedStyle(cb);
  const ox = cbRect.left + (parseFloat(cbStyle.borderLeftWidth) || 0);
  const oy = cbRect.top  + (parseFloat(cbStyle.borderTopWidth)  || 0);
  const left = parseFloat(ps.left);
  const top  = parseFloat(ps.top);
  const { radii, uniform } = resolveRadii(ps, w, h);
  // The pseudo's OWN transform. `translate(-50%, -50%)` on an absolutely positioned
  // marker is the standard centring idiom (and is what `.profile-link::before` uses),
  // so ignoring it drops the marker half its own size down and right of where the
  // browser paints it - the mispositioned ghost tooltips noted above were this.
  // The translate goes into x/y for every caller; only a rotate/scale/skew needs the
  // matrix branch, which the SVG emitter wraps in a <g>.
  const mat = parseCssMatrix(ps.transform);
  const x = ox + (Number.isFinite(left) ? left : 0) + (mat ? mat.e : 0);
  const y = oy + (Number.isFinite(top)  ? top  : 0) + (mat ? mat.f : 0);
  const linear = mat && !(Math.abs(mat.a - 1) < 1e-6 && Math.abs(mat.b) < 1e-6
    && Math.abs(mat.c) < 1e-6 && Math.abs(mat.d - 1) < 1e-6)
    ? { a: mat.a, b: mat.b, c: mat.c, d: mat.d, e: 0, f: 0 }
    : null;
  return { text, bg, radii, uniform, w, h, ps, x, y, mat: linear };
}

// Emit any ::before/::after markers of `el` into the SVG group `parentG`.
//
// `defer` (page-snapshot stacking-order mode only) supplies a <g> for one pseudo
// given its used z-index, having already placed that <g> in the right Appendix E
// layer of the enclosing stacking context. Absent ⇒ everything appends to
// parentG exactly as before, which is what every tool export does - EXCEPT a
// pseudo with a NEGATIVE z-index, which CSS paints under the element's in-flow
// content: `negInsert` places its <g> at the element's own-paint boundary, so a
// full-bleed `::before { z-index: -1 }` wash is painted under the text it is
// behind on screen instead of over it (jump's cinema scenes shipped with every
// label buried under its scene wash this way).
async function svgPseudoContent(
  NS: string, parentG: Element, rootRect: { left: number; top: number }, el: Element, vectorText: boolean,
  defer?: (z: number) => Element, negInsert?: (pg: Element) => void,
): Promise<void> {
  for (const name of ['::before', '::after']) {
    const ds = pseudoDescriptor(el, name);
    if (!ds) continue;
    const x = ds.x - rootRect.left;
    const y = ds.y - rootRect.top;
    // pseudoDescriptor already guarantees `position: absolute`, so the pseudo is
    // a positioned descendant; only its z-index decides which layer.
    const zRaw = (ds.ps.zIndex || 'auto').trim();
    const z = zRaw === 'auto' ? 0 : (Number.parseInt(zRaw, 10) || 0);
    let parentG_: Element;
    if (defer) {
      parentG_ = defer(z);
    } else if (z < 0 && negInsert) {
      parentG_ = document.createElementNS(NS, 'g');
      negInsert(parentG_);
    } else {
      parentG_ = parentG;
    }
    // A rotate/scale/skew on the pseudo itself: one <g> about its transform-origin,
    // holding the fill and the text. (The translate component is already in x/y.)
    if (ds.mat) {
      // A COMPUTED transform-origin is always resolved to px, so parseFloat is the
      // whole parse - same read rotationPivot() does for real elements.
      const o = String(ds.ps.transformOrigin || '').split(' ').map(parseFloat);
      const pivotX = x + (Number.isFinite(o[0]!) ? o[0]! : ds.w / 2);
      const pivotY = y + (Number.isFinite(o[1]!) ? o[1]! : ds.h / 2);
      const tg = document.createElementNS(NS, 'g');
      tg.setAttribute('transform', matToSvg(matAboutPivot(ds.mat, pivotX, pivotY)));
      parentG_.appendChild(tg);
      parentG_ = tg;
    }
    if (ds.bg && ds.w > 0.5 && ds.h > 0.5) {
      const f = ds.bg[3] < 1
        ? `rgba(${ds.bg[0]},${ds.bg[1]},${ds.bg[2]},${ds.bg[3]})`
        : `rgb(${ds.bg[0]},${ds.bg[1]},${ds.bg[2]})`;
      parentG_.appendChild(makeRoundedFill(NS, x, y, ds.w, ds.h, ds.radii, ds.uniform, f));
    }
    if (!ds.text.trim()) continue;
    const fontSizePx = parseFloat(ds.ps.fontSize) || 16;
    const vf = vectorText && _host?.text ? await resolveVectorFont(ds.ps, ds.text) : null;
    const fontUrl = vf?.url ?? null;
    const col = parseCssColorFull(ds.ps.color);
    const fillAttr  = col ? `rgb(${col[0]},${col[1]},${col[2]})` : null;
    const alphaAttr = col && col[3] < 1 ? String(col[3]) : null;
    const lineH = parseFloat(ds.ps.lineHeight) || fontSizePx * 1.2;
    const strokeAttrs = textStrokeAttrs(ds.ps, parseCssColorFull);
    let placed = false;
    if (vectorText && canVectoriseText(ds.ps, fontUrl, Boolean(_host?.text))) {
      try {
        const { d, notdef } = await _host!.text!.toPath({ text: ds.text, fontUrl: fontUrl!, fontSize: fontSizePx, variations: vf!.variations, fallbackFonts: vf!.fallbacks });
        if (d && !notdef) {
          const { ascent, descent } = fontMetricsPx(ds.ps, fontSizePx);
          const by = textBaselineY(y, lineH, ascent, descent);
          const p = document.createElementNS(NS, 'path');
          p.setAttribute('d', d);
          p.setAttribute('transform', `translate(${n2(x)},${n2(by)})`);
          if (fillAttr)  p.setAttribute('fill', fillAttr);
          if (alphaAttr) p.setAttribute('fill-opacity', alphaAttr);
          for (const [k, v] of strokeAttrs) p.setAttribute(k, v);
          parentG_.appendChild(p);
          placed = true;
        }
      } catch (e) { _host?.log?.('warn', `svg: pseudo text-to-path failed - ${(e as Error).message}`); }
    }
    if (!placed) {
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x',                 String(n2(x)));
      t.setAttribute('y',                 String(n2(y)));
      t.setAttribute('dominant-baseline', 'text-before-edge');
      t.setAttribute('font-size',         ds.ps.fontSize);
      t.setAttribute('font-weight',       ds.ps.fontWeight);
      t.setAttribute('font-style',        ds.ps.fontStyle);
      t.setAttribute('font-family',       ds.ps.fontFamily);
      if (fillAttr)  t.setAttribute('fill',         fillAttr);
      if (alphaAttr) t.setAttribute('fill-opacity', alphaAttr);
      for (const [k, v] of strokeAttrs) t.setAttribute(k, v);
      t.textContent = ds.text;
      parentG_.appendChild(t);
    }
  }
}




// Build an SVG <filter> of chained <feDropShadow> primitives for the given shadows
// (parsed DOM-free by the engine's parseDropShadowFilter). A generous filter region
// (-50%…200%) keeps large offsets/blurs from being clipped.
/**
 * `filter: drop-shadow(…)` as an SVG filter.
 *
 * The blur value is used as the standard deviation DIRECTLY, which is the one thing
 * here that looks like a bug and is not. `box-shadow: … 12px` and
 * `drop-shadow(… 12px)` do NOT produce the same blur: box-shadow's value is a radius
 * of 2σ, drop-shadow's IS σ. Measured against Chromium at blur 4, 6, 12, 24 and 40,
 * σ = blur is exact (0.000% pixel error) and σ = blur/2 - which this used to emit,
 * on the reasonable-sounding grounds that it "matches box-shadow" - is off by up to
 * 2.3% mean and 12.5% on a single pixel.
 */
function buildDropShadowFilterEl(NS: string, shadows: { dx: number; dy: number; blur: number; color: string }[], id: string,
                                 box?: { x: number; y: number; w: number; h: number }): Element {
  const filt = document.createElementNS(NS, 'filter');
  filt.setAttribute('id', id);
  // A region sized from the actual blur and offsets. The old -50%/200% bounding-box
  // form is a fraction of the ELEMENT, so a big blur on a small element was clipped
  // by its own filter region.
  const reach = shadows.reduce((n, sh) => Math.max(n, sh.blur * 3 + Math.abs(sh.dx) + Math.abs(sh.dy)), 0) + 8;
  if (box) {
    filt.setAttribute('filterUnits', 'userSpaceOnUse');
    filt.setAttribute('x', String(n2(box.x - reach))); filt.setAttribute('y', String(n2(box.y - reach)));
    filt.setAttribute('width', String(n2(box.w + 2 * reach))); filt.setAttribute('height', String(n2(box.h + 2 * reach)));
  } else {
    filt.setAttribute('x', '-50%'); filt.setAttribute('y', '-50%');
    filt.setAttribute('width', '200%'); filt.setAttribute('height', '200%');
  }
  // CSS composites filters in sRGB; SVG's default is linearRGB.
  filt.setAttribute('color-interpolation-filters', 'sRGB');
  for (const sh of shadows) {
    const fe = document.createElementNS(NS, 'feDropShadow');
    fe.setAttribute('dx', String(n2(sh.dx)));
    fe.setAttribute('dy', String(n2(sh.dy)));
    fe.setAttribute('stdDeviation', String(n2(sh.blur)));   // NOT blur/2 - see above
    const col = parseCssColorFull(sh.color);
    if (col) { fe.setAttribute('flood-color', `rgb(${col[0]},${col[1]},${col[2]})`); fe.setAttribute('flood-opacity', String(col[3])); }
    else fe.setAttribute('flood-color', sh.color);
    filt.appendChild(fe);
  }
  return filt;
}   // per-side cap for the vector escape-hatch (matches the inline-SVG raster)
// How much already-painted content a single `backdrop-filter: blur()` may duplicate.
// The backdrop is reconstructed by copying what sits behind the element, so a blurred
// bar late in a busy page copies most of that page. Past this, the element falls back
// to the raster hatch - a wrong-but-bounded answer beats an unbounded correct one.
const BACKDROP_MAX_NODES = 400;       // resolution for the PDF escape-hatch (points × RASTER_DPI/72)

// Rasterise ONE live element's subtree to a PNG data URL at pxW×pxH device px - the
// vector escape-hatch: dom-to-image serialises the node's computed style into a
// detached <foreignObject> and the browser paints it, so filters / masks / blend /
// conic-gradient / clip-path render FAITHFULLY instead of being dropped by the walker.
// The node is captured into its own box at (0,0) (left/top/margin neutralised, scaled
// to fill). Returns null on failure so the caller falls through to the (lossy) vector
// walk - never worse than before. Nothing mounts on-screen, so the position:fixed
// containing-block gotcha (the offscreen-stage flash) does not apply here.
export async function rasterizeNodeToDataUrl(el: HTMLElement, pxW: number, pxH: number, bg?: string, imprint?: ImprintState, ownPaintOnly?: boolean, padPx = 0): Promise<string | null> {
  const r = el.getBoundingClientRect();
  const cssW = r.width, cssH = r.height;
  if (cssW < 0.5 || cssH < 0.5 || pxW < 2 || pxH < 2) return null;
  // `padPx`: extra output pixels on every side, with the content shifted into the
  // middle. A CSS effect can paint OUTSIDE the element's box - a drop-shadow is the
  // common one - and a capture sized to the box crops it, which is how a drop-shadow
  // came out sheared off in PDF export. The caller places the padded image at the
  // correspondingly enlarged rect.
  const pad = Math.max(0, Math.round(padPx));
  const lib = await getDomToImage();
  const restore = await swapBlobUrls(el);
  try {
    const canvas = await lib.toCanvas(el, {
      width: pxW + 2 * pad, height: pxH + 2 * pad,
      // `ownPaintOnly`: capture the element's OWN paint layer - background, border,
      // effect - and none of its descendants, so the caller can keep walking those
      // as vector. dom-to-image-more applies `filter` to every node it clones EXCEPT
      // the root, so excluding everything yields exactly the root's own paint. The
      // explicit width/height in `style` below keeps the box from collapsing when the
      // element sized to its (now absent) content.
      ...(ownPaintOnly ? { filter: (n: Node) => n === el } : {}),
      style: {
        // translate first (unscaled output px), then scale - so the element ends up
        // `pad` pixels in from the top-left of the larger canvas.
        transform: `translate(${pad}px, ${pad}px) scale(${pxW / cssW}, ${pxH / cssH})`,
        transformOrigin: 'top left',
        width: `${cssW}px`, height: `${cssH}px`,
        left: '0', top: '0', margin: '0',
        ...(bg ? { background: bg } : {}),
      },
    });
    // Lolly-composited DOM subtree → carry the imprint into the PDF/PPTX/SVG raster
    // it becomes. (A user <img> descendant baked into this composite is perturbed
    // too - Lolly-composed content, PSNR-bounded; the one caveat, see task notes.)
    imprintEmbedCanvas(canvas, imprint);
    return canvas.toDataURL('image/png');
  } catch (e) {
    _host?.log?.('warn', `vector export: node rasterise fallback failed - ${(e as Error).message}`);
    return null;
  } finally {
    restore();
  }
}

/**
 * plans/104 section 12 Q2 - capture ONE element that carries a real 3-D pose, with the pose
 * intact, for a vector export to embed as a per-box `<image>`.
 *
 * Separate from {@link rasterizeNodeToDataUrl} because that function CANNOT do this,
 * and spike S2 measured how badly: it overwrites the clone root's `transform` with its
 * own fit translate/scale and resizes the root to `getBoundingClientRect()` - which on
 * a tilted element IS the projected AABB - so a 45°-pitched card comes back untilted
 * and stretched to fill that box (mean 35/255, IoU 0.88, "trapezoid → rectangle"). S2's
 * rule was "capture a WRAPPER whose posed box is the child, never the tilted element as
 * the capture root".
 *
 * This is that rule without touching the live DOM. There is no wrapper to insert (and
 * inserting one would move a node on a live artboard mid-export, restarting animations
 * and resetting media): instead the clone root keeps its OWN layout size - so nothing
 * re-lays-out - and the fit transform is composed IN FRONT of the element's own pose,
 * pre-anchored about its `transform-origin`:
 *
 *   translate(pad − s·aabb.x, pad − s·aabb.y) · scale(s) · [T(o)·M·T(−o)]
 *
 * with `transform-origin: 0 0` on the clone so the composition is read left to right in
 * the box's own space. `T(o)·M·T(−o)` is computed here with `DOMMatrix` (which performs
 * the perspective divide the same way the compositor does) and emitted as one
 * `matrix3d`, which S2 measured to be byte-identical to the equivalent transform list.
 *
 * ⚑ THE FIT TRANSFORM COMES AFTER THE DIVIDE, which is the one thing about this that
 * looks wrong and is not. CSS composes the whole list into ONE 4×4 and divides once at
 * the end, so the instinct is that `translate(tx)` gets divided by `w` too. It does not:
 * the translate's first row is `(1, 0, 0, tx)`, so it contributes `tx·w`, and `(s·x_M +
 * tx·w_M) / w_M = s·(x_M/w_M) + tx` exactly. A uniform scale is likewise exact (it never
 * touches `w`). Both hold only while the fit sits LEFT of the pose in the list, which is
 * why the order here is not cosmetic. Measured on a `rx −45` still: per-row ink-centre
 * drift 0.00 px across both embeds, where a divided translate would shear each row by
 * `tx·(1/w−1)`.
 *
 * The returned `rect` is where the caller must place the image - the posed AABB grown
 * by the effect spill, in the element's own client coordinates. `getBoundingClientRect`
 * is exact against an analytic projection in both engines (S2 section 3a), so the placement
 * needs no second implementation of the projection.
 *
 * Null on any failure, so the caller can fall through to what it did before.
 */
export async function rasterizePosedNodeToDataUrl(
  el: HTMLElement, scale: number, imprint?: ImprintState, padCss = 0,
): Promise<{ dataUrl: string; x: number; y: number; w: number; h: number } | null> {
  const aabb = el.getBoundingClientRect();
  // The element's own LAYOUT box, which a transform never changes - so the clone can
  // keep it and skip the re-layout that is the whole defect in the escape hatch.
  const cssW = el.offsetWidth || aabb.width;
  const cssH = el.offsetHeight || aabb.height;
  if (!(cssW > 0.5 && cssH > 0.5) || !(aabb.width > 0.5 && aabb.height > 0.5)) return null;
  const style = window.getComputedStyle(el);
  const posed = posedLocalMatrix(style, cssW, cssH);
  if (!posed) return null;
  const pad = Math.max(0, Math.round(padCss * scale));
  const s = Math.max(0.05, scale);
  // Output size from the POSED extent, not the layout box: a tilted card's picture is
  // its trapezoid's bounding box, and at 85° that is a sliver three times as wide as
  // the card is tall.
  const outW = Math.min(MAX_RASTER_PX, Math.max(2, Math.round(posed.w * s)));
  const outH = Math.min(MAX_RASTER_PX, Math.max(2, Math.round(posed.h * s)));
  const lib = await getDomToImage();
  const restore = await swapBlobUrls(el);
  try {
    const canvas = await lib.toCanvas(el, {
      width: outW + 2 * pad, height: outH + 2 * pad,
      style: {
        transform: `translate(${(pad - posed.x * s).toFixed(3)}px, ${(pad - posed.y * s).toFixed(3)}px) `
          + `scale(${(outW / posed.w).toFixed(6)}, ${(outH / posed.h).toFixed(6)}) ${posed.css}`,
        transformOrigin: 'top left',
        width: `${cssW}px`, height: `${cssH}px`,
        left: '0', top: '0', margin: '0',
      },
    });
    imprintEmbedCanvas(canvas, imprint);
    return {
      dataUrl: canvas.toDataURL('image/png'),
      // The placement rect in the element's own client space: the posed AABB, grown by
      // the same padding the capture carries, so the image is placed where the browser
      // painted the pose. `aabb` and `posed` are the same rectangle in two coordinate
      // systems (client vs the box's own), which is why only the pad is added here.
      x: aabb.left - padCss, y: aabb.top - padCss,
      w: aabb.width + 2 * padCss, h: aabb.height + 2 * padCss,
    };
  } catch (e) {
    _host?.log?.('warn', `vector export: posed node rasterise failed - ${(e as Error).message}`);
    return null;
  } finally {
    restore();
  }
}

/**
 * An element's own transform re-anchored about its `transform-origin`, plus the AABB
 * that pose gives its layout box - the two numbers {@link rasterizePosedNodeToDataUrl}
 * needs, and nothing about the DOM beyond the computed style it is handed.
 *
 * `DOMMatrix` is the projector on purpose: it is the same 4×4 the compositor builds
 * from the same string, including the `w` divide, so the AABB agrees with
 * `getBoundingClientRect()` rather than approximating it.
 */
function posedLocalMatrix(
  style: CSSStyleDeclaration, cssW: number, cssH: number,
): { css: string; x: number; y: number; w: number; h: number } | null {
  const raw = (style.transform || '').trim();
  if (!raw || raw === 'none') return null;
  try {
    const [ox, oy] = transformOriginPx(style, cssW, cssH);
    const M = new DOMMatrix(raw);
    const local = new DOMMatrix().translate(ox, oy).multiply(M).translate(-ox, -oy);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [px, py] of [[0, 0], [cssW, 0], [0, cssH], [cssW, cssH]] as const) {
      const p = local.transformPoint(new DOMPoint(px, py, 0, 1));
      // A corner behind the eye divides by a non-positive w. There is no picture to
      // capture through that pose, so refuse rather than emit a mirrored ghost - the
      // engine's own alphaGuard has already faded such a layer to nothing anyway.
      if (!(p.w > 1e-6)) return null;
      const x = p.x / p.w, y = p.y / p.w;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    const w = maxX - minX, h = maxY - minY;
    if (!(w > 0.5 && h > 0.5) || !Number.isFinite(w) || !Number.isFinite(h)) return null;
    return { css: local.toString(), x: minX, y: minY, w, h };
  } catch {
    return null;
  }
}

/** `transform-origin` in px against a `cssW × cssH` box. Percentages resolved. */
function transformOriginPx(style: CSSStyleDeclaration, cssW: number, cssH: number): [number, number] {
  const parts = (style.transformOrigin || '50% 50%').trim().split(/\s+/);
  const one = (v: string | undefined, extent: number, fallback: number): number => {
    if (!v) return fallback;
    const n = parseFloat(v);
    if (!Number.isFinite(n)) return fallback;
    return v.endsWith('%') ? (n / 100) * extent : n;
  };
  return [one(parts[0], cssW, cssW / 2), one(parts[1], cssH, cssH / 2)];
}

// Bake a CSS filter() into a raster image via the browser's OWN canvas filter, so
// vector exports (which embed photos as bitmaps anyway) match the on-screen / PNG
// result instead of dropping the treatment. Used for tools that expose an image
// filter (e.g. dynamic-layout's mono/punch/warm/cool/fade). Returns a filtered PNG
// data URL, or the original on any failure (filter:none, headless/no-canvas,
// tainted cross-origin canvas) - so it can never make output worse.
export async function bakeImageFilter(imgEl: any, dataUrl: string, filterStr: string | null | undefined): Promise<string> {
  if (!filterStr || filterStr === 'none') return dataUrl;
  try {
    let img: any = (imgEl && imgEl.naturalWidth > 0) ? imgEl : null;
    if (!img) {
      img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.onload = () => res(i); i.onerror = rej; i.src = dataUrl;
      });
    }
    const w = img.naturalWidth, h = img.naturalHeight;
    if (!(w > 0 && h > 0)) return dataUrl;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx || !('filter' in ctx)) return dataUrl;   // jsdom / old browsers
    ctx.filter = filterStr;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/png');
  } catch { return dataUrl; }
}


// Downscale an over-provisioned raster to a resolution its DISPLAY BOX can actually
// show, so an inlined <image> carries no pixels the reader will never see.
//
// The case that forced this: a gallery preview committed as a 3200x1800 PNG appears in
// a 341px tile, so the walker was inlining 5.76M pixels for a box that resolves at ~700.
// One such tile was 4.6 MB of a 6.6 MB shot; the gradient and street-map example
// previews are all 1800-3200px. Faithfully inlining the source is correct but wildly
// wasteful for a thumbnail.
//
// The cap is DPI-AWARE, which is the whole reason it is safe on the tool-export path and
// not only for docs: `boxLongCss` is the box in CSS px, and `dpi/CSS_DPI` is how many
// device pixels each CSS px is worth at the export resolution. A screen/SVG export
// (dpi 96-192) caps at ~2x the box; a 300-dpi print export keeps ~3x, so a photo placed
// small on a print page is not softened. Never UPSCALES, and returns the input unchanged
// (byte-identical to before this existed) whenever the source is already within 15% of
// the cap, so the common case pays one Image decode and nothing else.
// `floor` is the minimum device-px-per-CSS-px the cap allows (default 2: never soften a
// tool export below 2x its box). The docs walker opts down to 1 via `rasterDpi`, so a
// continuous-tone asset can be embedded at exactly its rendered box - see ExportOpts.rasterDpi.
// `embed` picks the re-encode format for the downscaled bytes:
//   'png'  (default) - lossless. Tool exports and UI previews, where a lossy pass on a
//          flat gradient/logo would show, and the source may carry alpha.
//   'auto' - opt-in (rasterDpi walker path): a FULLY-OPAQUE asset (a photo) re-encodes as
//          lossy WebP, ~5-10x smaller than PNG with no visible loss at box resolution;
//          anything with even one transparent pixel (icons, logos, cutouts) stays PNG so
//          its edges and transparency are preserved. WebP falls back to PNG where the
//          encoder is absent. Provenance is untouched either way: a vector export declares
//          its embedded assets through the C2PA ingredient chain (opts.ingredients), never
//          through the pixel bytes, so re-encoding a genAI photo here does not drop its
//          AI/credential detection from the exported file.
async function downscaleRasterForBox(imgEl: any, dataUrl: string, boxLongCss: number, dpi: number, floor = 2, embed: 'png' | 'auto' = 'png'): Promise<string> {
  if (!(boxLongCss > 0) || dataUrl.startsWith('data:image/svg')) return dataUrl;
  try {
    let img: any = (imgEl && imgEl.naturalWidth > 0) ? imgEl : null;
    if (!img) {
      img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.onload = () => res(i); i.onerror = rej; i.src = dataUrl;
      });
    }
    const nw = img.naturalWidth, nh = img.naturalHeight;
    if (!(nw > 0 && nh > 0)) return dataUrl;
    const factor = Math.max(floor, (dpi > 0 ? dpi : CSS_DPI) / CSS_DPI);
    const capLong = Math.max(256, Math.ceil(boxLongCss * factor));
    const srcLong = Math.max(nw, nh);
    if (srcLong <= capLong * 1.15) return dataUrl;         // already sane - leave it be
    const scale = capLong / srcLong;
    const dw = Math.max(1, Math.round(nw * scale)), dh = Math.max(1, Math.round(nh * scale));
    const canvas = document.createElement('canvas');
    canvas.width = dw; canvas.height = dh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;                              // jsdom - keep the source
    ctx.imageSmoothingEnabled = true;
    (ctx as { imageSmoothingQuality?: string }).imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, dw, dh);
    if (embed === 'auto' && isCanvasOpaque(ctx, dw, dh)) {
      const webp = canvas.toDataURL('image/webp', 0.85);
      if (webp.startsWith('data:image/webp')) return webp; // else the encoder no-op'd → PNG
    }
    return canvas.toDataURL('image/png');
  } catch { return dataUrl; }
}

// True when every pixel is fully opaque - the signal to prefer lossy WebP over PNG for an
// inlined asset. A tainted canvas throws on read; treat that as "not provably opaque" so it
// falls back to PNG rather than risking a wrong lossy encode. Scans alpha only (every 4th
// byte); the boxes this runs on are small (a downscaled photo, tens of thousands of pixels).
function isCanvasOpaque(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  try {
    const d = ctx.getImageData(0, 0, w, h).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] !== 255) return false;
    return true;
  } catch { return false; }
}

// Fetch + parse an image source into a live <svg> element IFF it is SVG, so it
// can be drawn as true PDF vectors (jsPDF.addImage rejects SVG). Detection is by
// CONTENT, not URL - asset URLs are blob: with no extension or MIME hint, so we
// fetch the bytes and sniff for "<svg". Known raster MIME types are skipped fast.
// Handles blob:, http(s) and data: sources; returns null for non-SVG/unfetchable.
// Exported for the sequence editor's still vector twin (views/timeline-panel.ts),
// which resolves a data: SVG source through exactly this path so the twin and the
// walker agree on what counts as vector - reached by dynamic import, so the panel
// keeps its no-static-edge-to-export.ts property.
export async function inlineSvgFromImg(src: string): Promise<Element | null> {
  if (!src) return null;
  let text: string | null = null;
  if (/^data:/i.test(src)) {
    if (!/^data:(image\/svg|text\/|application\/(xml|svg))/i.test(src)) return null;
    const comma  = src.indexOf(',');
    const header = src.slice(0, comma);
    const body   = src.slice(comma + 1);
    text = /;base64/i.test(header) ? atob(body) : decodeURIComponent(body);
  } else {
    let blob: Blob;
    try {
      const resp = await fetch(src);
      if (!resp.ok) return null;
      blob = await resp.blob();
    } catch { return null; }
    // Skip obvious rasters without reading them; sniff svg/xml/unknown types.
    if (/^image\/(png|jpe?g|webp|gif|avif|bmp|x-icon|vnd)/i.test(blob.type || '')) return null;
    try { text = await blob.text(); } catch { return null; }
  }
  if (!text || !/<svg[\s>]/i.test(text)) return null;
  const svg = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
  if (!(svg?.tagName && svg.tagName.toLowerCase() === 'svg')) return null;
  // Inlined files carry their own generated ids - namespace them or same-named
  // ids across several inlined files bind every reference to the FIRST one
  // (four covers all clipped by cover 1's `fcovclip-1`; see svg-inline-ids.ts).
  namespaceInlinedSvgIds(svg, src);
  return svg;
}

// Replaces blob: URLs in-place on a detached clone. Used by renderSvg which
// owns its clone and just needs self-contained data URLs in the saved file.
export async function inlineBlobUrlsInEl(el: Element): Promise<void> {
  const candidates = el.querySelectorAll('image, img');
  await Promise.all([...candidates].map(async img => {
    for (const attr of ['href', 'src']) {
      const url = img.getAttribute(attr);
      if (url?.startsWith('blob:')) {
        try {
          img.setAttribute(attr, await blobToDataUrl(url));
        } catch { /* leave as-is; export will degrade gracefully */ }
      }
    }
  }));
}