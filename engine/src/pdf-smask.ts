// SPDX-License-Identifier: MPL-2.0
/**
 * Pure helpers for PDF soft masks (ExtGState /SMask — PDF 32000-1 §11.6.5.2).
 *
 * The evaluation itself has to live inside pdf-map.ts's interpreter (it re-enters
 * `run()` to execute the mask group's content stream), but everything AROUND it is
 * ordinary geometry and colour arithmetic — so it lives here, DOM-free and unit
 * testable in isolation.
 *
 * Why a soft mask matters at all: Chromium's printToPDF encodes a CSS `box-shadow`
 * by filling the element's whole rectangle with a flat translucent ink and letting a
 * /Luminosity mask carve out the blur, the offset and the rounded corners. Probing
 * 136 masks across six real app pages, 94% of them are a single blurred greyscale
 * JPEG placed on the mask group's /BBox — i.e. ALL of the shape information lives in
 * the mask and the masked paint carries only colour. Ignore the mask and every
 * rounded control on the page gains an opaque grey plate; drop the paint and the
 * control's box disappears. Reading the mask is the only answer that is neither.
 */

import type { ClipPath, PdfNode } from './pdf-map.ts';

/** A 2-D affine, structurally identical to pdf-map's internal `Mat` (PDF/SVG
 *  convention: (x,y) → (a·x + c·y + e, b·x + d·y + f)). Declared here rather than
 *  imported so this module carries no value-level dependency on the interpreter. */
export interface SMat { a: number; b: number; c: number; d: number; e: number; f: number; }

/** The box-space footprint of a mask group's /BBox. */
export interface MaskRegion {
  /** Axis-aligned bounding box — the `<mask>` element's userSpaceOnUse region. */
  x: number; y: number; w: number; h: number;
  /** The TRUE (possibly rotated/skewed) transformed quad, as a clip. The AABB can
   *  be larger than the real bbox under a rotation, so the group's content is
   *  clipped to this and the AABB only sizes the mask region. */
  clip: ClipPath;
}

const fin = (v: unknown): v is number => typeof v === 'number' && isFinite(v);
const r2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * Transform a mask group's /BBox [x0 y0 x1 y1] through `m` (the group's base
 * transform = the CTM at the `gs` composed with the group's /Matrix) into box space.
 *
 * Returns null for anything degenerate — a non-finite matrix or bbox, a missing
 * bbox, or a zero-area result. Every rejection makes the caller fall back a rung;
 * this never throws, because the bbox arrives from an untrusted file.
 */
export function maskRegion(bbox: number[] | undefined, m: SMat): MaskRegion | null {
  if (!Array.isArray(bbox) || bbox.length < 4) return null;
  if (!bbox.slice(0, 4).every(fin)) return null;
  if (![m.a, m.b, m.c, m.d, m.e, m.f].every(fin)) return null;
  const [x0, y0, x1, y1] = bbox as [number, number, number, number];
  const corners: Array<[number, number]> = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const pts = corners.map(([px, py]) => ({ x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f }));
  if (!pts.every((p) => fin(p.x) && fin(p.y))) return null;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const w = Math.max(...xs) - minX, h = Math.max(...ys) - minY;
  // Sub-pixel masks carry no information and would produce a degenerate <mask>
  // region (which some renderers treat as "hide everything").
  if (!(w > 0.01) || !(h > 0.01)) return null;
  const d = 'M' + pts.map((p) => `${r2(p.x)} ${r2(p.y)}`).join('L') + 'Z';
  return { x: minX, y: minY, w, h, clip: { d, evenOdd: false } };
}

/** #rgb / #rrggbb → [r,g,b] 0..255, else null. Only the forms the interpreter
 *  itself emits (safeColor output) are accepted. */
function hexRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(String(hex || '').trim());
  if (!m) return null;
  const h = m[1]!;
  const p = h.length === 3
    ? [h[0]! + h[0]!, h[1]! + h[1]!, h[2]! + h[2]!]
    : [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)];
  return [parseInt(p[0]!, 16), parseInt(p[1]!, 16), parseInt(p[2]!, 16)];
}

/**
 * A colour's mask luminance, 0..1.
 *
 * Rec.709 coefficients over sRGB values WITHOUT linearisation — deliberately the
 * CSS Masking Level 1 convention (what browsers actually implement, and what
 * pdf-svg pins with `color-interpolation:sRGB` on every <mask>), not the SVG 1.1
 * linearRGB one. Folding a constant mask has to agree with what an un-folded
 * <mask> of the same colour would have produced, or rung 2 and rung 1 would
 * disagree about the same page.
 *
 * For the DeviceGray groups Chromium emits this is EXACT: 0.2126g + 0.7152g +
 * 0.0722g = g, which is precisely the /Luminosity value of §11.6.5.2. A DeviceRGB
 * group (the 3% CSS `mask-image: linear-gradient()` rung) differs slightly from
 * PDF's own 0.3/0.59/0.11 weights — a documented, sub-perceptual limitation whose
 * stops are near-grey in every observed case.
 */
export function relativeLuminance(hex: string): number {
  const c = hexRgb(hex);
  if (!c) return 0;
  return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
}

/** Is this fill a neutral ink (r≈g≈b)? A missing/empty fill counts as achromatic:
 *  an unresolved paint under a mask is not content we can vouch for either.
 *  Used by the last-resort shadow test — see `isShadowPlate` and pdf-map's
 *  paintPath rung 3. */
export function isAchromatic(fill: string): boolean {
  const c = hexRgb(fill);
  if (!c) return true;
  return Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]) <= 12;
}

/** The flat colour a painted node carries, if any ('none' is not a colour). */
function nodeFill(n: PdfNode): string {
  const v = n.fill || (n._vectorFill && n._vectorFill !== 'none' ? n._vectorFill : '') || '';
  return hexRgb(v) ? v : '';
}

/**
 * Rung 2 of the ladder: a mask group that is ONE flat rectangle covering its own
 * bbox is not a shape at all, it is a constant — Chromium emits this for a CSS
 * `mask-image` with no gradient, and for `opacity` routed through a group. Fold it
 * into the painted node's alpha and emit no <mask> at all: fewer defs, no raster,
 * and exactly the same pixels.
 *
 * Deliberately strict. One node, a rect, a real flat fill, no gradient/raster/path,
 * and ≥95% of the region's area — anything else is a shape and must stay a <mask>.
 * Returns null when it does not apply.
 */
export function constantMask(nodes: PdfNode[], region: { w: number; h: number }, subtype: 'Luminosity' | 'Alpha' = 'Luminosity'): number | null {
  if (!Array.isArray(nodes) || nodes.length !== 1) return null;
  const n = nodes[0]!;
  if (!n || n.kind !== 'box' || n.shape !== 'rect') return null;
  if (n._gradient || n._imageXObject || n._vectorPath) return null;
  const area = Math.max(0, region.w) * Math.max(0, region.h);
  if (!(area > 0)) return null;
  const cover = Math.max(0, n.w) * Math.max(0, n.h) / area;
  if (!(cover >= 0.95)) return null;
  const alpha = typeof n.opacity === 'number' ? Math.max(0, Math.min(100, n.opacity)) / 100 : 1;
  // §11.6.5.2 / Table 144: with `/S /Alpha` the mask value is the group's ALPHA and
  // its colour is irrelevant. Folding an Alpha group with luminosity math makes an
  // opaque BLACK rect read as mask 0 and delete the artwork it was meant to reveal —
  // and Illustrator is exactly the producer that puts /S /Alpha groups over dark art,
  // so the failure is both silent and likely. Only Luminosity reads the colour.
  if (subtype === 'Alpha') return alpha;
  const col = nodeFill(n);
  if (!col) return null;
  return relativeLuminance(col) * alpha;
}

/**
 * Is this node a print engine's box-shadow plate — a translucent achromatic fill
 * whose only shape came from a soft mask?
 *
 * Used by the SHELL's Layout Studio boxes path, which has no way to express a mask:
 * a shadow there is not editable content, so it is dropped rather than imported as
 * a grey rectangle. (The page-SVG path keeps it and renders the real mask.) This is
 * exactly the behaviour the engine's paint-time placeholder heuristic used to give
 * every surface, relocated to the one surface that still needs it.
 */
export function isShadowPlate(n: PdfNode): boolean {
  if (!n || !n._softMask) return false;
  // A shadow plate is a PAINTED SHAPE. Text is content and must never be dropped as
  // one — and it would be, silently: a text node keeps its colour in `fg`, which
  // `nodeFill` cannot see, so an empty fill made `isAchromatic` say true for every
  // masked label. (Text only started carrying `_softMask`/alpha once flushText began
  // consulting the mask; before that this guard was unreachable, which is exactly why
  // it has to be explicit now.)
  if (n.kind === 'text') return false;
  const alpha = typeof n.opacity === 'number' ? n.opacity : 100;
  return alpha < 90 && isAchromatic(nodeFill(n));
}
