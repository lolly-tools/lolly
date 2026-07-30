// SPDX-License-Identifier: MPL-2.0
// Pure, DOM-free CSS box-model + border-radius geometry.
//
// Single source of truth for the export walkers (the SVG walker and the PDF
// walker in shells/web/src/bridge/export.js) so the two vector renderers — and
// any future shell — compute identical geometry and can never drift. The shell
// reads getComputedStyle and passes the raw CSS strings/numbers in; NOTHING here
// touches the DOM (engine stays platform-agnostic, like units.js / color.js).
//
// The reason this exists: browsers render border-radius with the CSS Backgrounds
// & Borders §5.5 "corner overlap" rule — a single scale factor shrinks every
// corner together so a huge `border-radius: 999px` becomes a stadium/pill. SVG
// <rect> and jsPDF roundedRect instead clamp each axis independently (→ ellipse),
// so the geometry must be resolved here before it reaches those primitives.

import { findColorToken } from './css-color.ts';

/** One resolved corner: [horizontal, vertical] radius in px. */
export type CornerPair = [number, number];

/** A 2-D affine matrix (CSS/SVG convention `[a c e / b d f]`: a point (x,y) maps
 *  to (a·x + c·y + e, b·x + d·y + f)). */
export interface Mat2D { a: number; b: number; c: number; d: number; e: number; f: number; }

const IDENTITY_2D: Mat2D = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/**
 * Parse a computed CSS `transform` matrix into a 2-D affine, DOM-free. Handles the
 * two forms getComputedStyle ever returns — `matrix(a,b,c,d,e,f)` and
 * `matrix3d(...)` (16 column-major values) — flattening the 3-D form to its 2-D
 * affine part. Returns **null** for `none`, an unparseable value, or a 3-D matrix
 * that carries real perspective / z-depth (those can't be expressed as a 2-D affine,
 * so the caller must fall back to a raster/AABB path rather than silently distort).
 */
export function parseCssMatrix(transform: string | null | undefined): Mat2D | null {
  if (!transform || transform === 'none') return null;
  const m2 = /matrix\(([^)]+)\)/.exec(transform);
  if (m2) {
    const p = m2[1]!.split(',').map((s) => parseFloat(s));
    if (p.length < 6 || p.some((v) => !Number.isFinite(v))) return null;
    return { a: p[0]!, b: p[1]!, c: p[2]!, d: p[3]!, e: p[4]!, f: p[5]! };
  }
  const m3 = /matrix3d\(([^)]+)\)/.exec(transform);
  if (m3) {
    const p = m3[1]!.split(',').map((s) => parseFloat(s));
    if (p.length < 16 || p.some((v) => !Number.isFinite(v))) return null;
    // Column-major m11..m44. The 2-D affine is m11,m12,m21,m22,m41,m42. Reject
    // anything with a z/perspective component (m13/m14/m23/m24/m31..m34/m43, or a
    // non-identity m33/m44) — it isn't a plane-preserving 2-D transform.
    const z = [p[2]!, p[3]!, p[6]!, p[7]!, p[8]!, p[9]!, p[11]!, p[14]!];
    if (z.some((v) => Math.abs(v) > 1e-6) || Math.abs(p[10]! - 1) > 1e-6 || Math.abs(p[15]! - 1) > 1e-6) return null;
    return { a: p[0]!, b: p[1]!, c: p[4]!, d: p[5]!, e: p[12]!, f: p[13]! };
  }
  return null;
}

/** Compose two 2-D affines: `multiplyMat(P, C)` applies C first, then P
 *  (transform(P∘C, pt) === transform(P, transform(C, pt))). */
export function multiplyMat(P: Mat2D, C: Mat2D): Mat2D {
  return {
    a: P.a * C.a + P.c * C.b,
    b: P.b * C.a + P.d * C.b,
    c: P.a * C.c + P.c * C.d,
    d: P.b * C.c + P.d * C.d,
    e: P.a * C.e + P.c * C.f + P.e,
    f: P.b * C.e + P.d * C.f + P.f,
  };
}

/** Re-anchor a matrix about a pivot: `T(px,py)·M·T(-px,-py)` — the transform `m`
 *  applied around (px,py) instead of the origin (CSS `transform-origin`). */
export function matAboutPivot(m: Mat2D, px: number, py: number): Mat2D {
  return {
    a: m.a, b: m.b, c: m.c, d: m.d,
    e: m.e + px - (m.a * px + m.c * py),
    f: m.f + py - (m.b * px + m.d * py),
  };
}

/** True when the AABB-based walkers fully capture this matrix on their own — i.e. a
 *  pure POSITIVE-scale + translate (no rotation, no skew, no flip). A negative scale
 *  (`scaleX(-1)` mirror) has zero off-diagonals but is NOT AABB-capturable (the box is
 *  unchanged, the mirror is lost), so it returns false and takes the vector matrix
 *  branch. When true the vector branch skips it and stays byte-identical. */
export function isAxisAlignedMat(m: Mat2D): boolean {
  return Math.abs(m.b) < 1e-6 && Math.abs(m.c) < 1e-6 && m.a > 0 && m.d > 0;
}

/** Serialize to an SVG `matrix(a,b,c,d,e,f)` transform string (compact rounding). */
export function matToSvg(m: Mat2D): string {
  const n = (v: number): number => { const r = Math.round(v * 1e5) / 1e5; return Object.is(r, -0) ? 0 : r; };
  return `matrix(${n(m.a)},${n(m.b)},${n(m.c)},${n(m.d)},${n(m.e)},${n(m.f)})`;
}

export { IDENTITY_2D };

/** The four border-radius corner longhands as raw computed-CSS strings. */
export interface CornerInputs {
  topLeft: string;
  topRight: string;
  bottomRight: string;
  bottomLeft: string;
}

/** The four corners resolved to px pairs (post corner-overlap clamping). */
export interface CornerRadii {
  topLeft: CornerPair;
  topRight: CornerPair;
  bottomRight: CornerPair;
  bottomLeft: CornerPair;
}

/** One outer shadow parsed from a computed `box-shadow` value. */
export interface BoxShadow {
  x: number;
  y: number;
  blur: number;
  spread: number;
  /** Raw CSS colour token for the shell to resolve — any CSS Color 4 form, not
   *  just rgb/rgba: a shadow authored in `oklch()` reaches us verbatim. */
  color: string;
  /** `inset` — drawn INSIDE the border box, as the region between the box and an
   *  offset/shrunken copy of it, rather than behind it. Callers that only draw outer
   *  shadows must filter on this; it used to be dropped at parse time, which meant
   *  an inset shadow silently vanished from every vector export. */
  inset: boolean;
}

/** One shadow parsed from a computed `text-shadow`. Same shape as a box shadow
 *  without spread or inset — CSS gives text-shadow neither. */
export interface TextShadow {
  x: number;
  y: number;
  blur: number;
  color: string;
}

// Parse a CSS length to px. `refPx` resolves percentages. CSS math functions
// (calc/min/max/clamp) carry internal structure we can't resolve here, so they
// deterministically resolve to 0 rather than producing wrong geometry. Anything
// non-finite → 0.
export function parseCssLength(
  value: string | number | null | undefined,
  refPx: number = 0,
): number {
  if (value == null || value === '' || value === '0' || value === '0px') return 0;
  const s = String(value).trim();
  if (s.includes('(')) return 0;
  if (s.endsWith('%')) {
    const n = parseFloat(s);
    return Number.isFinite(n) ? (n / 100) * refPx : 0;
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

// Resolve one border-radius corner longhand into a [horizontal, vertical] px
// pair. The computed value is "10px" or "10px 20px" (horizontal vertical); a
// percentage resolves its horizontal part against width, vertical against height.
function cornerPair(value: string, w: number, h: number): CornerPair {
  const s = String(value || '').trim();
  const t = s.includes('(') ? [s] : s.split(/\s+/);
  return [parseCssLength(t[0], w), parseCssLength(t[1] ?? t[0], h)];
}

// Resolve the four border-radius corners for a w×h box, applying the CSS §5.5
// corner-overlap rule: a SINGLE scale factor f (the min over all four edges of
// edge_length / sum-of-the-two-corner-radii-on-that-edge) shrinks every radius
// together so adjacent corners never overlap. This is what makes a huge radius a
// pill and keeps a genuine 50% an ellipse, while preserving distinct corners.
//
// `corners` = { topLeft, topRight, bottomRight, bottomLeft } raw CSS strings.
// Returns { topLeft:[h,v], topRight, bottomRight, bottomLeft } in px (clamped).
export function cornerRadii(corners: CornerInputs, w: number, h: number): CornerRadii {
  const tl = cornerPair(corners.topLeft,     w, h);
  const tr = cornerPair(corners.topRight,    w, h);
  const br = cornerPair(corners.bottomRight, w, h);
  const bl = cornerPair(corners.bottomLeft,  w, h);
  const ratio = (len: number, a: number, b: number): number => {
    const s = a + b;
    return s > 0 ? len / s : Infinity;
  };
  const f = Math.min(
    1,
    ratio(w, tl[0], tr[0]),   // top edge    — horizontal radii
    ratio(w, bl[0], br[0]),   // bottom edge  — horizontal radii
    ratio(h, tl[1], bl[1]),   // left edge    — vertical radii
    ratio(h, tr[1], br[1]),   // right edge   — vertical radii
  );
  const scale = (p: CornerPair): CornerPair => [p[0] * f, p[1] * f];
  return { topLeft: scale(tl), topRight: scale(tr), bottomRight: scale(br), bottomLeft: scale(bl) };
}

// If all four (already-clamped) corners are equal, return the single [rx, ry]
// pair — the fast path callers use to emit <rect rx ry> / jsPDF.roundedRect.
// Returns [0, 0] when there is no rounding, and null when corners differ (the
// caller must emit a four-corner path via roundedRectPath instead).
export function uniformRadius(radii: CornerRadii): CornerPair | null {
  const c = [radii.topLeft, radii.topRight, radii.bottomRight, radii.bottomLeft];
  const [rx, ry] = radii.topLeft;
  const equal = c.every((p) => Math.abs(p[0] - rx) < 1e-3 && Math.abs(p[1] - ry) < 1e-3);
  if (!equal) return null;
  if (rx <= 0 && ry <= 0) return [0, 0];
  return [rx, ry];
}

// Shrink every corner by `inset` px (clamped ≥ 0). Used to derive the radius of a
// border's centre-line / inner edge from the outer (border-box) radius.
export function insetCorners(radii: CornerRadii, inset: number): CornerRadii {
  const r = (p: CornerPair): CornerPair => [Math.max(0, p[0] - inset), Math.max(0, p[1] - inset)];
  return {
    topLeft:     r(radii.topLeft),
    topRight:    r(radii.topRight),
    bottomRight: r(radii.bottomRight),
    bottomLeft:  r(radii.bottomLeft),
  };
}

// Split a comma-separated CSS list at top level (commas inside parens — e.g.
// rgba(0,0,0,.5) — are not separators).
function splitTopLevel(str: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = '';
  for (const ch of String(str)) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

// Parse a computed CSS `box-shadow` into a list of shadows, outer and inset alike,
// each flagged. The color is returned as the raw CSS token (always rgb/rgba in a
// computed value) for the shell to resolve; lengths are px. Order matches CSS paint
// order (first listed is topmost). Returns [] for 'none' / empty.
//   getComputedStyle form per shadow: "<color> <offX> <offY> [blur] [spread] [inset]"
// Inset shadows used to be dropped here on the grounds that they were not vector-
// expressible. They are: the region between the border box and an offset, shrunken
// copy of it, blurred and clipped to the box.
export function parseBoxShadow(value: string | null | undefined): BoxShadow[] {
  if (!value || value === 'none') return [];
  const shadows: BoxShadow[] = [];
  for (const raw of splitTopLevel(value)) {
    const part = raw.trim();
    if (!part) continue;
    const inset = /\binset\b/.test(part);
    // Strip the keyword before looking for a colour, or the bare-word branch of the
    // colour pattern matches "inset" itself and the real colour is lost.
    const body = part.replace(/\binset\b/g, ' ');
    const colorMatch = findColorToken(body, true);
    const color = colorMatch ?? 'rgb(0,0,0)';
    const rest = colorMatch ? body.replace(colorMatch, ' ') : body;
    const nums = (rest.match(/-?\d*\.?\d+(?:px)?/g) || [])
      .map((s) => parseFloat(s)).filter(Number.isFinite);
    if (nums.length < 2) continue;
    const [x, y, blur = 0, spread = 0] = nums;
    if (x === undefined || y === undefined) continue;
    shadows.push({ x, y, blur: Math.max(0, blur), spread, color, inset });
  }
  return shadows;
}

/**
 * Parse a computed CSS `text-shadow`.
 *
 * Same grammar as box-shadow minus spread and inset. Chromium's computed form puts
 * the colour first ("rgb(0, 0, 0) 0px 2px 4px"), but the authored order is
 * offset-first, so both are accepted — a value read off a stylesheet rather than a
 * computed style is otherwise silently dropped.
 *
 * Order matches CSS paint order: first listed is topmost.
 */
export function parseTextShadow(value: string | null | undefined): TextShadow[] {
  if (!value || value === 'none') return [];
  const out: TextShadow[] = [];
  for (const raw of splitTopLevel(value)) {
    const part = raw.trim();
    if (!part) continue;
    const colorMatch = findColorToken(part);
    const color = colorMatch ?? 'rgb(0,0,0)';
    const rest = colorMatch ? part.replace(colorMatch, ' ') : part;
    const nums = (rest.match(/-?\d*\.?\d+(?:px)?/g) || [])
      .map((v) => parseFloat(v)).filter(Number.isFinite);
    if (nums.length < 2) continue;
    const [x, y, blur = 0] = nums;
    if (x === undefined || y === undefined) continue;
    out.push({ x, y, blur: Math.max(0, blur), color });
  }
  return out;
}

/** One concentric band of a vector-approximated Gaussian shadow. */
export interface ShadowBand {
  /** How far the band's shape sits OUTSIDE the casting shape's edge, in px.
   *  Negative means inside. Add it to the box on every side, and add it to each
   *  corner radius — which is also why a square corner comes out correctly rounded:
   *  a blur rounds corners, and outsetting a 0 radius by `outset` gives exactly that. */
  outset: number;
  /** Alpha to paint THIS band with, assuming the bands are painted outermost-first
   *  and composited normally over each other. Not the coverage — the increment that
   *  makes the accumulated coverage land on the Gaussian. */
  alpha: number;
}

/** Φ(x): the standard normal CDF, via Abramowitz & Stegun 7.1.26 (|error| < 1.5e-7).
 *  Good to well under a 1/255 colour step, which is all a shadow can express. */
function normalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp(-x * x / 2);
  const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}

/**
 * A Gaussian blur as concentric bands, for renderers with no blur operator.
 *
 * PDF (and EMF/EPS) cannot blur, so a soft shadow there has always been baked to a
 * bitmap. It does not have to be: blurring a shape is, along any edge, a
 * one-dimensional convolution, and the resulting coverage at signed distance `t`
 * outside the edge is exactly `Φ(-t/σ)`. So painting the shape at a series of outsets,
 * each at the alpha increment that makes the ACCUMULATED coverage match that curve,
 * reproduces the blur in pure vector — editable, resolution-independent, and with no
 * embedded bitmap.
 *
 * Where it is approximate: corners. The 1-D profile is exact along a straight edge and
 * near-exact wherever the corner radius is large next to σ; a tight corner blurs
 * slightly differently than an outset one. In exchange the output stays vector, which
 * is the trade this codebase makes everywhere else.
 *
 * `blur` is the CSS blur radius (σ = blur/2, the box-shadow/text-shadow convention —
 * NOT drop-shadow's, where the value is σ itself). `alpha` is the shadow colour's own
 * alpha. Returns outermost-first; paint in order.
 */
export function gaussianShadowBands(blur: number, alpha: number, bands?: number): ShadowBand[] {
  const sigma = blur / 2;
  if (!(sigma > 0) || !(alpha > 0)) return [];
  // Band count, measured rather than reasoned: 4σ (bands ~1.5px wide) is the optimum,
  // and MORE bands are worse, not better. Every band is a separate antialiased fill,
  // so each seam conflates a little extra coverage; doubling the count to 12σ tripled
  // the error against the browser (0.13% → 0.31% mean). Sizing by alpha step is the
  // other tempting mistake — a 2px blur needs a 24/255 step to cover its range in 8
  // bands, which sounds terrible and is invisible, because those bands are a third of
  // a pixel wide and the rasteriser smooths them itself.
  const n = Math.max(8, Math.min(bands ?? 160, Math.round(4 * sigma)));
  const reach = 3 * sigma;                 // beyond this the Gaussian is < 0.15%
  const step = (2 * reach) / n;
  const out: ShadowBand[] = [];
  let acc = 0;                             // accumulated alpha so far
  for (let i = 0; i < n; i++) {
    const outer = reach - i * step;
    const target = alpha * (1 - normalCdf((outer - step / 2) / sigma));
    if (target <= acc) continue;
    // Normal compositing: acc' = acc + a(1-acc)  ⇒  a = (target - acc) / (1 - acc).
    const a = (target - acc) / (1 - acc);
    if (a > 0.0005) { out.push({ outset: outer, alpha: Math.min(1, a) }); acc = target; }
  }
  return out;
}

/** One annulus of a vector-approximated Gaussian shadow. Unlike ShadowBand these do
 *  NOT overlap, and `alpha` is the absolute coverage rather than an increment. */
export interface ShadowRing {
  /** Outer edge, as an outset from the casting shape (px). */
  outer: number;
  /** Inner edge, or null for the innermost ring, which is solid to the centre. */
  inner: number | null;
  alpha: number;
}

/**
 * The same Gaussian, as non-overlapping rings at absolute alpha.
 *
 * Needed because not every consumer composites. EMF and EPS have no alpha at all, so
 * `svg-ir` flattens each shape against the page background INDEPENDENTLY — under
 * which overlapping increments (gaussianShadowBands) come out far too light, since
 * the accumulation never happens. Rings each cover their annulus exactly once, so
 * flattening them one at a time is correct, and they composite correctly too.
 *
 * The trade the other way: adjacent rings share an edge, so a renderer that
 * antialiases can leave a hairline seam between them, which is why the compositing
 * formats use the overlapping form instead.
 */
export function gaussianShadowRings(blur: number, alpha: number, bands?: number): ShadowRing[] {
  const inc = gaussianShadowBands(blur, alpha, bands);
  if (!inc.length) return [];
  const out: ShadowRing[] = [];
  let acc = 0;
  for (let i = 0; i < inc.length; i++) {
    acc = acc + inc[i]!.alpha * (1 - acc);
    out.push({ outer: inc[i]!.outset, inner: i + 1 < inc.length ? inc[i + 1]!.outset : null, alpha: acc });
  }
  return out;
}

const n3 = (v: number): number => {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
};

// An SVG/PDF path `d` string for a rounded rectangle with four independent
// corners (clockwise from the top-left, y-down). `radii` is the cornerRadii
// shape. Each corner is an elliptical arc (sweep-flag 1), matching svg-ir's
// rectPath convention so EMF/EPS consume it identically.
export function roundedRectPath(
  x: number, y: number, w: number, h: number, radii: CornerRadii,
): string {
  const cl = (p: CornerPair): CornerPair => [
    Math.max(0, Math.min(p[0], w)),
    Math.max(0, Math.min(p[1], h)),
  ];
  const [tlh, tlv] = cl(radii.topLeft);
  const [trh, trv] = cl(radii.topRight);
  const [brh, brv] = cl(radii.bottomRight);
  const [blh, blv] = cl(radii.bottomLeft);
  return [
    `M${n3(x + tlh)},${n3(y)}`,
    `H${n3(x + w - trh)}`,
    (trh || trv) ? `A${n3(trh)},${n3(trv)} 0 0 1 ${n3(x + w)},${n3(y + trv)}` : '',
    `V${n3(y + h - brv)}`,
    (brh || brv) ? `A${n3(brh)},${n3(brv)} 0 0 1 ${n3(x + w - brh)},${n3(y + h)}` : '',
    `H${n3(x + blh)}`,
    (blh || blv) ? `A${n3(blh)},${n3(blv)} 0 0 1 ${n3(x)},${n3(y + h - blv)}` : '',
    `V${n3(y + tlv)}`,
    (tlh || tlv) ? `A${n3(tlh)},${n3(tlv)} 0 0 1 ${n3(x + tlh)},${n3(y)}` : '',
    'Z',
  ].filter(Boolean).join(' ');
}
