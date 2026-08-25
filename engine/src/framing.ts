// SPDX-License-Identifier: MPL-2.0
/**
 * Image framing - the ONE way an image is placed, cropped and rotated inside a
 * frame (plans/148).
 *
 * Before this module every tool answered "which part of the photo do I keep"
 * its own way: a canonical `imageFraming` vector in three tools, ungrouped
 * numbers with translate semantics in a fourth, a five-point compass keyword in
 * a fifth, and five hand-written copies of the same `drawCover` in the hooks.
 * The values agreed by accident and drifted in the ranges. This is the shared
 * maths both realisations now go through:
 *
 *   • DOM tools emit the CSS string from `framingStyle()` (via the {{framing}}
 *     template helper), so the web walker, the PDF vector path, the raster path
 *     and PPTX all see an ordinary object-fit/object-position/transform image
 *     and export it through the paths they already have.
 *   • Canvas-drawing hooks call `frameRect()` and get the same placement as
 *     source + destination rectangles for one `drawImage`.
 *
 * The two are algebraically identical, not merely similar - see the note on
 * `frameRect` - and `tests/framing.test.ts` pins them together against a
 * fixture table. `community/_shared/framing.js` is the sync'd hook-side copy
 * (tools never import from the engine).
 *
 * DOM-free by construction: numbers in, numbers and a string out.
 */

/** The framing compound. Every field is optional; each falls back to its neutral. */
export interface Framing {
  /** Percent. 100 = exactly fit the frame per `fit`. */
  zoom?: number;
  /** Percent, 0-100. Which horizontal slice survives (object-position X). */
  x?: number;
  /** Percent, 0-100. Which vertical slice survives (object-position Y). */
  y?: number;
  /** ROLL. Degrees, -180..180. Clockwise in the plane, about the (x, y) point. */
  rotate?: number;
  /** PITCH. Degrees. Tips the top of the image away (positive) or toward the
   *  viewer - CSS rotateX. For straightening a photo shot looking up or down. */
  pitch?: number;
  /** YAW. Degrees. Swings the left edge away (positive) or toward the viewer -
   *  CSS rotateY. For straightening a photo shot off-axis. */
  yaw?: number;
}

export type FramingFit = 'cover' | 'contain';

/** Placement of an image inside a frame, in frame pixels. */
export interface FrameRect {
  /** Source rectangle in image pixels - the whole image today (crop is expressed by zoom + pan). */
  sx: number; sy: number; sw: number; sh: number;
  /** Destination rectangle in frame pixels, BEFORE rotation. */
  dx: number; dy: number; dw: number; dh: number;
  /** Degrees clockwise, applied about (originX, originY). 0 for no rotation. */
  rotate: number;
  /** The rotation/scale origin in frame pixels - the same point CSS transform-origin names. */
  originX: number; originY: number;
}

const num = (v: unknown, dflt: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
};

/**
 * The viewing distance, in frame pixels, that `perspective()` uses for pitch/yaw.
 *
 * A perspective correction needs a camera distance, and CSS's `perspective()`
 * takes an absolute length - there is no percentage form. Fixing it here (rather
 * than per tool) is what keeps the CSS, the canvas warp and every export path on
 * the same projection: change it in one place or not at all. 1200px is the
 * conventional gentle default; a tool that wants a stronger or flatter feel
 * passes its own through the helper's `persp=` option.
 */
export const FRAMING_PERSPECTIVE = 1200;

/** Read a framing compound tolerantly (a hook's raw model value, a URL string pair, undefined). */
export function normalizeFraming(f: Framing | Record<string, unknown> | null | undefined): Required<Framing> {
  const o = (f ?? {}) as Record<string, unknown>;
  return {
    zoom: Math.max(1, num(o.zoom, 100)),
    x: num(o.x, 50),
    y: num(o.y, 50),
    rotate: num(o.rotate, 0),
    pitch: num(o.pitch, 0),
    yaw: num(o.yaw, 0),
  };
}

/** True when this framing tilts the image out of its plane (pitch or yaw). */
export function isTilted(framing?: Framing | Record<string, unknown> | null): boolean {
  const f = normalizeFraming(framing);
  return f.pitch !== 0 || f.yaw !== 0;
}

/**
 * The placement of an `iw`x`ih` image in a `W`x`H` frame.
 *
 * The maths is CSS's, deliberately: `s` is the object-fit scale, the pan
 * fraction spans the whole overflow, and rotation happens about the pan point.
 * That last equivalence is the one worth stating, because it is what lets the
 * DOM path and the canvas path share a fixture table:
 *
 *   object-fit:cover + object-position:P + transform:scale(z) with
 *   transform-origin:P  ==  drawImage at -p*(dw-W), for the same p and z.
 *
 * (Expand the CSS side: the cover-fitted left edge sits at -p*(dw0-W); scaling
 * about p*W maps it to p*W - p*dw0*z = -p*(dw-W). Identical, for cover and for
 * contain, where the overflow is simply negative.)
 *
 * `fit: 'contain'` swaps the max for a min; everything else is unchanged.
 */
export function frameRect(
  iw: number, ih: number, W: number, H: number,
  framing?: Framing | Record<string, unknown> | null,
  fit: FramingFit = 'cover',
): FrameRect {
  const f = normalizeFraming(framing);
  // A dimensionless source can't be fitted; fall back to filling the frame so a
  // caller still draws something rather than NaN.
  if (!(iw > 0) || !(ih > 0) || !(W > 0) || !(H > 0)) {
    return { sx: 0, sy: 0, sw: Math.max(1, iw), sh: Math.max(1, ih), dx: 0, dy: 0, dw: W, dh: H, rotate: f.rotate, originX: W / 2, originY: H / 2 };
  }
  const base = fit === 'contain' ? Math.min(W / iw, H / ih) : Math.max(W / iw, H / ih);
  const s = base * (f.zoom / 100);
  const dw = iw * s, dh = ih * s;
  const px = f.x / 100, py = f.y / 100;
  return {
    sx: 0, sy: 0, sw: iw, sh: ih,
    dx: (W - dw) * px, dy: (H - dh) * py,
    dw, dh,
    rotate: f.rotate,
    originX: W * px, originY: H * py,
  };
}

/** Trim trailing zeros from a fixed-precision number so the CSS stays short and stable. */
const css = (n: number): string => {
  const s = n.toFixed(3).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
};

/**
 * The CSS declarations that realise a framing on an `<img>` / `<video>`.
 *
 * Emitted without a trailing semicolon so a template can append its own
 * declarations. Every part of the string round-trips through the export paths
 * (object-fit/object-position → preserveAspectRatio or explicit geometry in the
 * SVG walker, a crop rect in PPTX, the transform matrix in the PDF path), which
 * is why the recipe is fixed here rather than left to each tool.
 */
export function framingStyle(
  framing?: Framing | Record<string, unknown> | null,
  fit: FramingFit = 'cover',
  perspective: number = FRAMING_PERSPECTIVE,
): string {
  const f = normalizeFraming(framing);
  const pos = `${css(f.x)}% ${css(f.y)}%`;
  const parts = [`object-fit:${fit === 'contain' ? 'contain' : 'cover'}`, `object-position:${pos}`];
  // Only emit a transform when there IS one: an untouched framing must leave the
  // element byte-identical to a plain <img>, so nothing existing re-renders.
  // The order below is the projection order in projectFramingPoint(), read
  // right-to-left as CSS composes it: scale, then roll, then yaw, then pitch,
  // then the perspective divide.
  const t: string[] = [];
  if (f.pitch || f.yaw) t.push(`perspective(${css(perspective)}px)`);
  if (f.pitch) t.push(`rotateX(${css(f.pitch)}deg)`);
  if (f.yaw) t.push(`rotateY(${css(f.yaw)}deg)`);
  if (f.rotate) t.push(`rotate(${css(f.rotate)}deg)`);
  if (f.zoom !== 100) t.push(`scale(${css(f.zoom / 100)})`);
  if (t.length) {
    parts.push(`transform:${t.join(' ')}`);
    parts.push(`transform-origin:${pos}`);
    // A tilted plane needs a 3-D context to project in; without this the browser
    // flattens rotateX/rotateY to their 2-D shadow and the keystone disappears.
    if (f.pitch || f.yaw) parts.push('transform-style:preserve-3d');
  }
  return parts.join(';');
}

/** True when the framing does nothing - the image sits exactly as `fit` alone would place it. */
export function isNeutralFraming(framing?: Framing | Record<string, unknown> | null): boolean {
  const f = normalizeFraming(framing);
  return f.zoom === 100 && f.x === 50 && f.y === 50 && f.rotate === 0 && f.pitch === 0 && f.yaw === 0;
}

// ── The envelope: pitch / yaw / roll as one projection ───────────────────────
// Pitch and yaw make the framing a genuine PERSPECTIVE correction (the Geometry
// panel in Lightroom, "Adjust" in Instagram): the image plane tips out of the
// screen and its edges keystone. That is a 3x3 projective homography, so unlike
// pan/zoom/roll it cannot be written as a source+destination rectangle - hence
// this second entry point beside frameRect(), and hence the canvas twin drawing
// a tile mesh rather than one drawImage.
//
// The projection here IS the CSS one, expanded by hand so the canvas path and
// the DOM path cannot disagree: apply scale, roll (Z), yaw (Y), pitch (X) about
// the transform-origin, then divide by the perspective depth.

/** Project one point (frame pixels) through a framing's 3-D envelope. */
export function projectFramingPoint(
  px: number, py: number,
  originX: number, originY: number,
  f: Required<Framing>,
  perspective: number = FRAMING_PERSPECTIVE,
): { x: number; y: number } {
  // Local coordinates, relative to the origin. The scale is already baked into
  // the rectangle the caller passes in (frameRect applies it), so it is NOT
  // re-applied here - only the rotations and the divide.
  let X = px - originX, Y = py - originY, Z = 0;
  const rad = (d: number): number => (d * Math.PI) / 180;
  if (f.rotate) {                                   // roll, about Z
    const c = Math.cos(rad(f.rotate)), s = Math.sin(rad(f.rotate));
    const nx = X * c - Y * s, ny = X * s + Y * c;
    X = nx; Y = ny;
  }
  if (f.yaw) {                                      // about Y
    const c = Math.cos(rad(f.yaw)), s = Math.sin(rad(f.yaw));
    const nx = X * c + Z * s, nz = -X * s + Z * c;
    X = nx; Z = nz;
  }
  if (f.pitch) {                                    // about X
    const c = Math.cos(rad(f.pitch)), s = Math.sin(rad(f.pitch));
    const ny = Y * c - Z * s, nz = Y * s + Z * c;
    Y = ny; Z = nz;
  }
  // CSS's perspective divide. A point at or beyond the eye (w <= 0) has no
  // projection; clamp to a sliver instead of emitting Infinity, so a wild angle
  // degrades to a smear rather than to NaN geometry.
  const w = perspective > 0 ? 1 - Z / perspective : 1;
  const k = 1 / (w > 1e-3 ? w : 1e-3);
  return { x: originX + X * k, y: originY + Y * k };
}

/** The four corners of a framed image after the envelope, clockwise from top-left. */
export function framingQuad(
  iw: number, ih: number, W: number, H: number,
  framing?: Framing | Record<string, unknown> | null,
  fit: FramingFit = 'cover',
  perspective: number = FRAMING_PERSPECTIVE,
): Array<{ x: number; y: number }> {
  const f = normalizeFraming(framing);
  const r = frameRect(iw, ih, W, H, framing, fit);
  const pt = (x: number, y: number): { x: number; y: number } =>
    projectFramingPoint(x, y, r.originX, r.originY, f, perspective);
  return [
    pt(r.dx, r.dy), pt(r.dx + r.dw, r.dy),
    pt(r.dx + r.dw, r.dy + r.dh), pt(r.dx, r.dy + r.dh),
  ];
}

/** Is (x, y) inside the convex quad? (Corner order is consistent, so one sign test does it.) */
function insideQuad(q: Array<{ x: number; y: number }>, x: number, y: number): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i]!, b = q[(i + 1) % 4]!;
    const cross = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
    if (Math.abs(cross) < 1e-9) continue;
    const s = cross > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/**
 * The smallest zoom (percent) at which the tilted image still covers the frame.
 *
 * Lightroom calls this Constrain Crop, and it is the difference between a
 * perspective control that is usable and one that leaves transparent wedges in
 * the corners of every correction. Returns the CURRENT zoom when it already
 * covers (so it can be applied unconditionally), and never exceeds `max`.
 *
 * Solved by bisection on the zoom rather than in closed form: the projected quad
 * is not linear in the zoom once the perspective divide is involved, and 24
 * halvings of a bounded range are far cheaper than being clever here.
 */
export function minZoomForCover(
  iw: number, ih: number, W: number, H: number,
  framing?: Framing | Record<string, unknown> | null,
  fit: FramingFit = 'cover',
  perspective: number = FRAMING_PERSPECTIVE,
  max = 400,
): number {
  const f = normalizeFraming(framing);
  if (fit !== 'cover' || !(iw > 0) || !(ih > 0) || !(W > 0) || !(H > 0)) return f.zoom;
  const covers = (zoom: number): boolean => {
    const q = framingQuad(iw, ih, W, H, { ...f, zoom }, fit, perspective);
    return insideQuad(q, 0, 0) && insideQuad(q, W, 0) && insideQuad(q, W, H) && insideQuad(q, 0, H);
  };
  if (covers(f.zoom)) return f.zoom;
  if (!covers(max)) return max;                    // even fully zoomed it cannot cover
  let lo = f.zoom, hi = max;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (covers(mid)) hi = mid; else lo = mid;
  }
  return Math.ceil(hi * 10) / 10;                  // round OUT, never back under coverage
}
