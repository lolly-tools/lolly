// SPDX-License-Identifier: MPL-2.0
/**
 * DOM-free helpers for the vector PDF/SVG export walkers, extracted verbatim
 * from bridge/export.ts (stage 1 of the export.ts split - same precedent as
 * export-css.ts): SVG-path → PDF operator emission (drawSvgPathToPdf /
 * svgArcToBeziers), graphics-state wrappers (clip / alpha / rotation - 
 * the `pdf` handle is a plain object, no DOM), SVG colour parsing, and the
 * brand-palette CMYK / spot-colour machinery behind the CMYK PDF
 * content-stream rewrite. The DOM walkers themselves (drawHtmlVectors /
 * drawSvgVectorsInRegion) stay in export.ts and import these.
 */
import { splitCssArgs, parseGradientStop, parseGradientAngle, parseRadialGradient, rgbToCmyk, roundedRectPath, parseColorToSrgb8 } from '@lolly/engine';
import { objectPositionFractions } from './export-css.ts';
import { FINISH_MASK_CMYK, buildCmykPaletteMap, cmykKey } from '@lolly/engine';
import type { BrandPaletteEntry, PaletteHit, PaletteSpotHit } from '@lolly/engine';
import type { ClipShape } from '../../../../engine/src/css-paint.ts';
import type { CornerRadii, CornerPair } from '../../../../engine/src/css-box.ts';

type Rgb = [number, number, number];

// The shell's brand palette entries fed via opts.palette (hex + CMYK 0–100).
// spot: a named spot/Pantone lock, independent of cmyk - a swatch may carry
// either, both, or neither. cmyk (when set) is always the process-colour
// fallback used for preview / non-PDF export / the PDF Separation
// tint-transform's alternate space, whether or not a spot is also set; when a
// spot is locked with no explicit cmyk, buildCmykPaletteMap derives one from
// the swatch's own hex instead (see its own comment).
//
// The spot type is the CANONICAL host-v1 `SpotColor`, not a local restatement,
// so a field added to the contract (v1.91's `finish`) can never again be
// silently dropped at this boundary - which is exactly how a declared foil used
// to separate as an ordinary colour plate. See FINISH_MASK_CMYK.
export type { BrandPaletteEntry };

/**
 * The CMYK build every DECLARED FINISH gets, in every CMYK sink.
 *
 * Defined in `engine/src/cmyk-palette.ts` (with the full rationale) and
 * re-exported here so every existing importer under shells/web is unchanged. It
 * moved with `buildCmykPaletteMap`, because the CLI's eps-cmyk sink needs the
 * same constant and could not reach a shell-local one.
 */
export { FINISH_MASK_CMYK };

// The HTML→vector walkers position every element by its axis-aligned
// getBoundingClientRect, which drops any CSS rotate() - a free-canvas box would
// export unrotated at its enlarged bounding box. To render rotation faithfully we
// detect a PURE rotation (orthonormal matrix, det +1 - NOT a scaleX(-1) flip or a
// scale, which the walkers handle separately), then temporarily neutralise it on
// the live element, walk the now-axis-aligned subtree, and wrap the result in a
// rotation about the element's transform-origin. Returns 0 for anything that isn't
// a clean rotation, so every non-rotated element stays byte-identical.
export function pureRotationDeg(transform: string | null | undefined): number {
  if (!transform || transform === 'none') return 0;
  const m = /matrix\(([^)]+)\)/.exec(transform);
  if (!m) return 0;
  const p = m[1]!.split(',').map(parseFloat);
  if (p.length < 4) return 0;
  const [a, b, c, d] = p as [number, number, number, number];
  if (Math.abs(a - d) > 1e-3 || Math.abs(b + c) > 1e-3) return 0;   // scale/flip → not a rotation
  if (Math.abs(a * d - b * c - 1) > 1e-2) return 0;                 // determinant ≠ 1
  const deg = Math.atan2(b, a) * 180 / Math.PI;
  return Math.abs(deg) < 1e-3 ? 0 : deg;
}

// Returns an averaged [r,g,b] sample of a linear-gradient's first and last
// stops. Used by drawHtmlVectors as an approximation for PDF output.
export function sampleGradientMidpoint(bgImage: string): Rgb | null {
  const m = bgImage.match(/^linear-gradient\((.+)\)$/s);
  if (!m) return null;
  const parts = splitCssArgs(m[1]!);
  let start = 0;
  if (parts[0] && /^to\s|deg$|turn$|rad$|grad$/.test(parts[0].trim())) start = 1;
  const stops = parts.slice(start).filter(Boolean);
  if (!stops.length) return null;
  const c1 = gradStopToRgb(stops[0]!.trim(), 0, stops.length);
  const c2 = gradStopToRgb(stops[stops.length - 1]!.trim(), stops.length - 1, stops.length);
  if (!c1 && !c2) return null;
  if (!c1) return c2;
  if (!c2) return c1;
  return [
    Math.round((c1[0] + c2[0]) / 2),
    Math.round((c1[1] + c2[1]) / 2),
    Math.round((c1[2] + c2[2]) / 2),
  ];
}

// A CSS linear/radial gradient resolved into a PDF shading-pattern spec - true VECTOR
// output for the PDF walker (preferred over rasterising). Coords are in the box's own pt
// space (top-left, matching the walker); `matrix` carries a radial ellipse's y-scale, else
// null. `hasAlpha` flags any transparent stop: PDF axial/radial shading has NO per-stop
// alpha, so an alpha gradient must fall back to the faithful raster path instead.
export interface PdfGradientSpec {
  type: 'axial' | 'radial';
  coords: number[];
  stops: { offset: number; color: Rgb }[];
  matrix: [number, number, number, number, number, number] | null;
  hasAlpha: boolean;
}

// Parse a computed background-image (a single linear-/radial-gradient) into a shading spec
// for the box (x,y,w,h) in pt. Geometry mirrors buildLinearGradientEl / parseRadialGradient
// so the PDF vector gradient lands identically to the SVG one. Returns null when the value
// isn't a parseable single linear/radial gradient (caller falls back to raster / midpoint).
export function pdfGradientSpec(bgImage: string, x: number, y: number, w: number, h: number, cssToPt = 0): PdfGradientSpec | null {
  // SINGLE layer only: a PDF shading pattern paints one gradient, and the greedy `.+`
  // below would otherwise match a two-layer list as one and concatenate the stop lists.
  // A layered background falls back to the caller's raster path, which stacks properly.
  if (splitCssArgs(bgImage).length > 1) return null;
  const lin = bgImage.match(/^linear-gradient\((.+)\)$/s);
  if (lin) {
    const parts = splitCssArgs(lin[1]!);
    if (parts.length < 2) return null;
    let angleRad = Math.PI, start = 0;                       // default: to bottom
    const first = parts[0]!.trim();
    if (/^to\s|deg$|turn$|rad$|grad$/.test(first)) { angleRad = parseGradientAngle(first); start = 1; }
    const raw = parts.slice(start);
    if (raw.length < 2) return null;
    const sinA = Math.sin(angleRad), cosA = Math.cos(angleRad);
    const cx = x + w / 2, cy = y + h / 2;
    const len = (Math.abs(w * sinA) + Math.abs(h * cosA)) / 2;
    const coords = [cx - sinA * len, cy + cosA * len, cx + sinA * len, cy - cosA * len];
    // `len` is in POINTS (x/y/w/h are pt) while stop offsets are CSS px, so convert
    // the line length back to px before dividing - otherwise the fraction is off by
    // the pt/px scale. Falls back to 0 (no conversion) when the caller omits it.
    const { stops, hasAlpha } = gradientStopList(raw, cssToPt > 0 ? 2 * len / cssToPt : 0);
    return stops.length >= 2 ? { type: 'axial', coords, stops, matrix: null, hasAlpha } : null;
  }
  const g = parseRadialGradient(bgImage, w, h);
  if (!g) return null;
  const CX = x + g.cx, CY = y + g.cy, rx = g.rx, ry = g.ry;
  const stops: { offset: number; color: Rgb }[] = [];
  let hasAlpha = false;
  for (const st of g.stops) {
    // Alpha is recorded BEFORE the stop can be discarded. A fully transparent stop has
    // no RGB triple to keep (parseSvgColor reports "nothing to paint"), but its very
    // existence is what makes the gradient need the alpha-correct raster path - drop it
    // first and `hasAlpha` stays false, so the PDF paints an opaque shading and the
    // transparent waist silently vanishes while SVG and PNG still show it.
    if (st.opacity < 1) hasAlpha = true;
    const rgb = parseSvgColor(st.colorStr ?? '');
    if (!rgb) { hasAlpha = true; continue; }
    const off = st.offset.endsWith('px') ? parseFloat(st.offset) / (rx || 1)
      : st.offset.endsWith('%') ? parseFloat(st.offset) / 100 : parseFloat(st.offset);
    if (!Number.isFinite(off)) continue;
    stops.push({ offset: Math.max(0, Math.min(1, off)), color: rgb });
  }
  if (stops.length < 2 || !(rx > 0)) return null;
  const coords = [CX, CY, 0, CX, CY, rx];
  const matrix: PdfGradientSpec['matrix'] = Math.abs(rx - ry) > 0.01 ? [1, 0, 0, ry / rx, 0, CY * (1 - ry / rx)] : null;
  return { type: 'radial', coords, stops, matrix, hasAlpha };
}

// Shared linear-gradient stop parse: CSS stop strings → sorted {offset 0-1, [r,g,b]} plus
// an alpha flag. Missing offsets are spread evenly (index/(n-1)), matching CSS defaults.
function gradientStopList(
  raw: string[],
  /** Gradient-line length in CSS px, so an absolute stop position can be turned into
   *  a fraction of it. 0 for radial - that caller pre-divides by rx. */
  lineCssPx = 0,
): { stops: { offset: number; color: Rgb }[]; hasAlpha: boolean } {
  const out: { offset: number; color: Rgb }[] = [];
  let hasAlpha = false;
  const n = raw.length;
  raw.forEach((r, i) => {
    const { colorStr, opacity, offset } = parseGradientStop(r.trim(), i, n);
    if (!colorStr) return;
    // Record alpha BEFORE discarding the stop - see the radial loop above for why a
    // fully transparent stop must still set the flag it can no longer carry a colour for.
    if (opacity < 1) hasAlpha = true;
    const rgb = parseSvgColor(colorStr);
    if (!rgb) { hasAlpha = true; return; }
    // A px stop is a distance along the gradient LINE, so it must become a fraction
    // of that line. Unconverted it fell through as a raw number and the clamp below
    // pinned every absolute stop to 1 - the far end.
    let off = offset.endsWith('%') ? parseFloat(offset) / 100
      : offset.endsWith('px') && lineCssPx > 0 ? parseFloat(offset) / lineCssPx
      : parseFloat(offset);
    if (!Number.isFinite(off)) off = n > 1 ? i / (n - 1) : 0;
    out.push({ offset: Math.max(0, Math.min(1, off)), color: rgb });
  });
  out.sort((a, b) => a.offset - b.offset);
  return { stops: out, hasAlpha };
}

let gradKeySeq = 0;

// Fill the current box with a true-vector PDF shading pattern (axial/radial). `pathOps`
// adds the box outline (rounded/sharp) as a path - no paint - inside the advancedAPI
// block; the pattern then fills it. The block is kept because the shading API used to be
// gated behind it, and coordinates are top-left inside it either way. Returns false
// (caller rasterises) when the shading API is unavailable or throws - so a fill is never
// silently dropped.
export function fillPdfShading(pdf: any, spec: PdfGradientSpec, pathOps: (doc: any) => void): boolean {
  if (typeof pdf.advancedAPI !== 'function' || typeof pdf.ShadingPattern !== 'function' || typeof pdf.Matrix !== 'function') return false;
  const colors = spec.stops.map((s) => ({ offset: s.offset, color: [s.color[0], s.color[1], s.color[2]] }));
  const key = `lgrad${gradKeySeq++}`;
  let ok = false;
  try {
    pdf.advancedAPI((doc: any) => {
      const sp = new doc.ShadingPattern(spec.type, spec.coords, colors);
      doc.addShadingPattern(key, sp);
      doc.saveGraphicsState();
      try {
        pathOps(doc);
        const matrix = spec.matrix ? new doc.Matrix(...spec.matrix) : new doc.Matrix(1, 0, 0, 1, 0, 0);
        doc.fill({ key, matrix });
      } finally { doc.restoreGraphicsState(); }
      ok = true;
    });
  } catch (err) { console.warn('[export] PDF vector gradient failed, falling back to raster:', err); return false; }
  return ok;
}

export function gradStopToRgb(raw: string, index: number, total: number): Rgb | null {
  const { colorStr } = parseGradientStop(raw, index, total);
  return parseSvgColor(colorStr);
}

// Normalise the shell's brand palette (hex + CMYK 0–100, and/or an independent
// spot lock) into the engine's colour-bar form: { rgb, cmyk } both 0–1, plus a
// label and - for a spot-locked swatch - its ink name, so the shell's bar
// renderer can annotate the pair with the name instead of raw CMYK numbers.
// Only entries with a declared CMYK anchor or a spot lock qualify (the others
// fall back to generic RGB→CMYK at render time and so have nothing to verify);
// a spot lock with no explicit cmyk still qualifies, deriving one from the
// swatch's own hex (same fallback buildCmykPaletteMap uses) so its Separation
// substitution has something to verify against. Deduped by hex+ink, since the
// palette repeats Black/White as ramp endpoints; order is preserved so the
// primary brand hues lead and survive the flat cell cap.
export function brandSwatchPalette(palette: BrandPaletteEntry[] | undefined): { rgb: Rgb; cmyk: [number, number, number, number]; label?: string; spotName?: string }[] {
  const out: { rgb: Rgb; cmyk: [number, number, number, number]; label?: string; spotName?: string }[] = [], seen = new Set<string>();
  for (const { hex, cmyk, label, spot } of palette ?? []) {
    if (!hex || (!cmyk && !spot)) continue;
    const h = hex.replace('#', '').toLowerCase();
    if (h.length !== 6) continue;                         // skips 'transparent' etc.
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    const frac = cmyk && cmyk.length === 4 ? (cmyk.map(v => v / 100) as [number, number, number, number]) : rgbToCmyk(r, g, b);
    const key = `${h}:${frac.join(',')}:${spot?.name ?? ''}:${spot?.finish ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // The bar is a VERIFICATION strip: an RGB reference cell beside its CMYK
    // substitution so the operator can check the conversion. A finish has no
    // conversion to verify, so printing its swatch build would make the margin
    // the second place in the file asserting a process build that does not
    // exist. Its cell is the mask, and its name carries the finish.
    out.push({
      rgb: [r, g, b],
      cmyk: spot?.finish ? FINISH_MASK_CMYK : frac,
      label,
      spotName: spot ? (spot.finish ? `${spot.name} (${spot.finish})` : spot.name) : undefined,
    });
  }
  return out;
}

// Approximate SVG opacity by blending with white, used where there is no per-element opacity.
export function blendSvgWithWhite(rgb: Rgb, opacity: number): Rgb {
  return [
    Math.round(rgb[0] * opacity + 255 * (1 - opacity)),
    Math.round(rgb[1] * opacity + 255 * (1 - opacity)),
    Math.round(rgb[2] * opacity + 255 * (1 - opacity)),
  ];
}

// Parse numeric args from an SVG path data segment string.
export function parseSvgPathArgs(str: string): number[] {
  const m = str.match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g);
  return m ? m.map(Number) : [];
}

// Fill ('F') or stroke ('S') a rounded rect into the PDF using the fast
// roundedRect when corners are uniform (or sharp), else a four-corner path
// (so e.g. top-only rounding keeps square bottom corners). Coords are already in
// pt; the caller sets fill/draw colour, line width and any GState first.
export function pdfRoundedRect(pdf: any, x: number, y: number, w: number, h: number, radii: CornerRadii, uniform: CornerPair | null, op: string): void {
  if (uniform) {
    if (uniform[0] > 0 || uniform[1] > 0) pdf.roundedRect(x, y, w, h, uniform[0], uniform[1], op);
    else pdf.rect(x, y, w, h, op);
  } else {
    drawSvgPathToPdf(pdf, roundedRectPath(x, y, w, h, radii), v => v, v => v);
    op === 'S' ? pdf.stroke() : pdf.fill();
  }
}

// Run `draw` with a uniform fill+stroke alpha applied via a PDF graphics state, then
// reset to opaque (GState is sticky and would otherwise leak onto every later
// element). No-op when alpha is 1 or GState is unavailable.
export function withPdfAlpha(pdf: any, a: number, draw: () => void): void {
  const on = a < 1 && typeof pdf.GState === 'function' && typeof pdf.setGState === 'function';
  if (on) pdf.setGState(new pdf.GState({ opacity: a, 'stroke-opacity': a }));
  try { draw(); }
  finally { if (on) pdf.setGState(new pdf.GState({ opacity: 1, 'stroke-opacity': 1 })); }
}

// Run `draw` with drawing clipped to the rect (x, y, w, h) in pt, then restore.
// `rect(...,null)` adds the path with no paint op; clip()+discardPath() set it as
// the clip region (W n). Used for object-fit: cover, where the fitted image/SVG
// overflows the box and the spill must be cropped. `draw` may be async.
export async function withPdfClipRect(pdf: any, x: number, y: number, w: number, h: number, draw: () => unknown): Promise<void> {
  pdf.saveGraphicsState();
  pdf.rect(x, y, w, h, null);
  pdf.clip();
  pdf.discardPath();
  try { await draw(); }
  finally { pdf.restoreGraphicsState(); }
}

// Run `draw` with drawing clipped to a rounded rect (pt). Mirrors the SVG walker's
// overflow:hidden + border-radius content clip: uniform corners use the fast
// roundedRect path, differing corners a four-corner path (both added with a null style
// = path-only, then clip). Used to crop a rounded box's children/text to the corner
// curve. `draw` may be async.
export async function withPdfRoundedClip(pdf: any, x: number, y: number, w: number, h: number, radii: CornerRadii, uniform: CornerPair | null, draw: () => unknown): Promise<void> {
  pdf.saveGraphicsState();
  if (uniform && uniform[0] <= 0 && uniform[1] <= 0) pdf.rect(x, y, w, h, null);
  else if (uniform) pdf.roundedRect(x, y, w, h, uniform[0], uniform[1], null);
  else drawSvgPathToPdf(pdf, roundedRectPath(x, y, w, h, radii), v => v, v => v);
  pdf.clip();
  pdf.discardPath();
  try { await draw(); }
  finally { pdf.restoreGraphicsState(); }
}

// Set the current PDF clip region to a CSS basic-shape / polygon clip-path. `shape`
// geometry is box-local CSS px; (ox,oy) is the box's top-left in pt and (sx,sy) the
// px→pt scale (per axis - a CSS circle under a non-uniform scale becomes an ellipse).
// Must be called inside a saveGraphicsState()/restoreGraphicsState() pair. Mirrors the
// SVG walker's vector <clipPath> so both formats clip identically.
export function pdfApplyClip(pdf: any, shape: ClipShape, ox: number, oy: number, sx: number, sy: number): void {
  const X = (v: number) => ox + v * sx;
  const Y = (v: number) => oy + v * sy;
  if (shape.kind === 'circle' || shape.kind === 'ellipse') {
    const rx = (shape.kind === 'circle' ? shape.r : shape.rx) * sx;
    const ry = (shape.kind === 'circle' ? shape.r : shape.ry) * sy;
    if (Math.abs(rx - ry) < 0.01) pdf.circle(X(shape.cx), Y(shape.cy), rx, null);
    else pdf.ellipse(X(shape.cx), Y(shape.cy), rx, ry, null);
  } else if (shape.kind === 'inset') {
    const rx = shape.r * sx, ry = shape.r * sy;
    if (rx > 0 || ry > 0) pdf.roundedRect(X(shape.x), Y(shape.y), shape.w * sx, shape.h * sy, rx, ry, null);
    else pdf.rect(X(shape.x), Y(shape.y), shape.w * sx, shape.h * sy, null);
  } else if (shape.kind === 'empty') {
    // Zero-area clip: callers return before drawing, so this is unreachable. Clip
    // to nothing rather than fall through and read `.points` off the wrong variant.
    pdf.rect(X(0), Y(0), 0, 0, null);
  } else {
    const pts = shape.points;
    pdf.moveTo(X(pts[0]![0]), Y(pts[0]![1]));
    for (let i = 1; i < pts.length; i++) pdf.lineTo(X(pts[i]![0]), Y(pts[i]![1]));
    pdf.close();
  }
  pdf.clip();
  pdf.discardPath();
}

// Run `draw` with a CSS-clockwise rotation of `deg` about the point (cx, cy) in the
// PDF drawing space (pt, top-left origin). Used so free-canvas boxes with a CSS
// rotate() export rotated (not flattened to their bounding box). Applied via the
// transformation matrix; if that API is missing or throws we degrade gracefully to
// an unrotated draw inside the saved/restored graphics state (never a broken PDF).
export async function withPdfRotation(pdf: any, deg: number, cx: number, cy: number, draw: () => unknown): Promise<void> {
  const canMatrix = deg && typeof pdf.setCurrentTransformationMatrix === 'function' && typeof pdf.Matrix === 'function';
  if (!canMatrix) { await draw(); return; }
  const r = deg * Math.PI / 180, cos = Math.cos(r), sin = Math.sin(r);
  // Rotate about (cx,cy): M = T(cx,cy)·R·T(-cx,-cy). The Matrix is (a,b,c,d,e,f).
  const a = cos, b = sin, c = -sin, d = cos;
  const e = cx - (a * cx + c * cy);
  const f = cy - (b * cx + d * cy);
  pdf.saveGraphicsState();
  try { pdf.setCurrentTransformationMatrix(new pdf.Matrix(a, b, c, d, e, f)); }
  catch (err) { console.warn('[export] PDF rotation unavailable, flattening this element:', err); }
  try { await draw(); }
  finally { pdf.restoreGraphicsState(); }
}

// Run `draw` with an arbitrary 2-D affine (rotate+scale / skew / matrix) applied about
// the pivot (cx, cy) in pt - the general form of withPdfRotation for the vector walker's
// matrix branch. `m` is the CSS transform matrix: a,b,c,d are unitless; e,f are the
// translation ALREADY scaled to pt by the caller (rotate about (cx,cy):
// M' = T(cx,cy)·m·T(-cx,-cy)). Degrades to an untransformed draw inside the saved state
// if the CTM API is missing/throws (never a broken PDF).
export async function withPdfMatrix(
  pdf: any, m: { a: number; b: number; c: number; d: number; e: number; f: number },
  cx: number, cy: number, draw: () => unknown,
): Promise<void> {
  const canMatrix = typeof pdf.setCurrentTransformationMatrix === 'function' && typeof pdf.Matrix === 'function';
  if (!canMatrix) { await draw(); return; }
  const { a, b, c, d, e, f } = m;
  const e2 = e + cx - (a * cx + c * cy);
  const f2 = f + cy - (b * cx + d * cy);
  pdf.saveGraphicsState();
  try { pdf.setCurrentTransformationMatrix(new pdf.Matrix(a, b, c, d, e2, f2)); }
  catch (err) { console.warn('[export] PDF matrix transform unavailable, flattening this element:', err); }
  try { await draw(); }
  finally { pdf.restoreGraphicsState(); }
}

// Emits PDF path operations (moveTo/lineTo/curveTo/close) for an SVG `d` string.
// tx/ty are coordinate-transform functions: SVG user units → pt (top-left origin).
// Caller must call fill()/stroke()/fillStroke() after this returns.
export function drawSvgPathToPdf(pdf: any, d: string, tx: (v: number) => number, ty: (v: number) => number): void {
  const cmdRe = /([MLHVCSQTAZmlhvcsqtaz])([^MLHVCSQTAZmlhvcsqtaz]*)/g;
  let cx = 0, cy = 0;
  let sx = 0, sy = 0;   // current subpath start - Z returns the current point here (SVG spec)
  let lastCmd = '';
  let lastCpx = 0, lastCpy = 0;
  let m: RegExpExecArray | null;

  while ((m = cmdRe.exec(d)) !== null) {
    const cmd  = m[1]!;
    const nums = parseSvgPathArgs(m[2]!);
    const abs  = cmd === cmd.toUpperCase();
    const C    = cmd.toUpperCase();
    const ax   = (i: number) => abs ? nums[i]! : cx + nums[i]!;
    const ay   = (i: number) => abs ? nums[i]! : cy + nums[i]!;

    switch (C) {
      case 'M':
        for (let i = 0; i + 1 < nums.length; i += 2) {
          const x = ax(i), y = ay(i + 1);
          if (i === 0) { pdf.moveTo(tx(x), ty(y)); sx = x; sy = y; } // remember subpath start
          else pdf.lineTo(tx(x), ty(y));
          cx = x; cy = y;
        }
        break;
      case 'L':
        for (let i = 0; i + 1 < nums.length; i += 2) {
          const x = ax(i), y = ay(i + 1);
          pdf.lineTo(tx(x), ty(y)); cx = x; cy = y;
        }
        break;
      case 'H':
        for (let i = 0; i < nums.length; i++) {
          cx = abs ? nums[i]! : cx + nums[i]!;
          pdf.lineTo(tx(cx), ty(cy));
        }
        break;
      case 'V':
        for (let i = 0; i < nums.length; i++) {
          cy = abs ? nums[i]! : cy + nums[i]!;
          pdf.lineTo(tx(cx), ty(cy));
        }
        break;
      case 'C':
        for (let i = 0; i + 5 < nums.length; i += 6) {
          const x1 = ax(i),     y1 = ay(i + 1);
          const x2 = ax(i + 2), y2 = ay(i + 3);
          const x  = ax(i + 4), y  = ay(i + 5);
          pdf.curveTo(tx(x1), ty(y1), tx(x2), ty(y2), tx(x), ty(y));
          lastCpx = x2; lastCpy = y2; cx = x; cy = y;
        }
        break;
      case 'S':
        for (let i = 0; i + 3 < nums.length; i += 4) {
          const r1x = (lastCmd === 'C' || lastCmd === 'S') ? 2 * cx - lastCpx : cx;
          const r1y = (lastCmd === 'C' || lastCmd === 'S') ? 2 * cy - lastCpy : cy;
          const x2  = ax(i),     y2 = ay(i + 1);
          const x   = ax(i + 2), y  = ay(i + 3);
          pdf.curveTo(tx(r1x), ty(r1y), tx(x2), ty(y2), tx(x), ty(y));
          lastCpx = x2; lastCpy = y2; cx = x; cy = y;
        }
        break;
      case 'Q':
        for (let i = 0; i + 3 < nums.length; i += 4) {
          const qx1 = ax(i), qy1 = ay(i + 1);
          const x   = ax(i + 2), y = ay(i + 3);
          const x1  = cx + 2 / 3 * (qx1 - cx), y1 = cy + 2 / 3 * (qy1 - cy);
          const x2  = x  + 2 / 3 * (qx1 - x),  y2 = y  + 2 / 3 * (qy1 - y);
          pdf.curveTo(tx(x1), ty(y1), tx(x2), ty(y2), tx(x), ty(y));
          lastCpx = qx1; lastCpy = qy1; cx = x; cy = y;
        }
        break;
      case 'T':
        for (let i = 0; i + 1 < nums.length; i += 2) {
          const qx1 = (lastCmd === 'Q' || lastCmd === 'T') ? 2 * cx - lastCpx : cx;
          const qy1 = (lastCmd === 'Q' || lastCmd === 'T') ? 2 * cy - lastCpy : cy;
          const x   = ax(i), y = ay(i + 1);
          const x1  = cx + 2 / 3 * (qx1 - cx), y1 = cy + 2 / 3 * (qy1 - cy);
          const x2  = x  + 2 / 3 * (qx1 - x),  y2 = y  + 2 / 3 * (qy1 - y);
          pdf.curveTo(tx(x1), ty(y1), tx(x2), ty(y2), tx(x), ty(y));
          lastCpx = qx1; lastCpy = qy1; cx = x; cy = y;
        }
        break;
      case 'A':
        for (let i = 0; i + 6 < nums.length; i += 7) {
          const rx = Math.abs(nums[i]!);
          const ry = Math.abs(nums[i + 1]!);
          const xRot = nums[i + 2]! * Math.PI / 180;
          const la   = nums[i + 3]! ? 1 : 0;
          const sw   = nums[i + 4]! ? 1 : 0;
          const x    = ax(i + 5), y = ay(i + 6);
          if (rx < 1e-6 || ry < 1e-6) {
            pdf.lineTo(tx(x), ty(y));
          } else {
            for (const [bx1, by1, bx2, by2, bx, by] of svgArcToBeziers(cx, cy, rx, ry, xRot, la, sw, x, y)) {
              pdf.curveTo(tx(bx1), ty(by1), tx(bx2), ty(by2), tx(bx), ty(by));
            }
          }
          cx = x; cy = y;
          lastCpx = cx; lastCpy = cy;
        }
        break;
      case 'Z':
        pdf.close();
        // SVG: after closepath the current point returns to the subpath's start, so a
        // following relative command (`z m…`) is offset from there - not the last drawn
        // point. Without this the mono-white SUSE wordmark mangled (hourglass 'S').
        cx = sx; cy = sy;
        break;
    }

    lastCmd = C;
    // Preserve the stored control point after curve commands so the next smooth
    // command can reflect it: C/S keep the cubic control point, Q/T the quadratic
    // one. Everything else has no control point, so it collapses to the current
    // point. (Resetting after Q/T here was the bug that mangled smooth-quad glyphs.)
    if (C !== 'C' && C !== 'S' && C !== 'Q' && C !== 'T') { lastCpx = cx; lastCpy = cy; }
  }
}

// Converts an SVG arc command to cubic bezier curve segments.
// Returns array of [cp1x, cp1y, cp2x, cp2y, endX, endY] per segment.
// Algorithm from SVG spec appendix F.6.
export function svgArcToBeziers(x1: number, y1: number, rx: number, ry: number, phi: number, fa: number, fs: number, x2: number, y2: number): [number, number, number, number, number, number][] {
  if (x1 === x2 && y1 === y2) return [];

  const cosP = Math.cos(phi);
  const sinP = Math.sin(phi);

  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p =  cosP * dx + sinP * dy;
  const y1p = -sinP * dx + cosP * dy;

  let rx2 = rx * rx, ry2 = ry * ry;
  const x1p2 = x1p * x1p, y1p2 = y1p * y1p;
  const lam = x1p2 / rx2 + y1p2 / ry2;
  if (lam > 1) {
    const sl = Math.sqrt(lam);
    rx *= sl; ry *= sl; rx2 = rx * rx; ry2 = ry * ry;
  }

  const num  = Math.max(0, rx2 * ry2 - rx2 * y1p2 - ry2 * x1p2);
  const den  = rx2 * y1p2 + ry2 * x1p2;
  const coef = (fa === fs ? -1 : 1) * Math.sqrt(num / den);
  const cxp  =  coef * rx * y1p / ry;
  const cyp  = -coef * ry * x1p / rx;

  const cx = cosP * cxp - sinP * cyp + (x1 + x2) / 2;
  const cy = sinP * cxp + cosP * cyp + (y1 + y2) / 2;

  const angV = (ux: number, uy: number, vx: number, vy: number) => {
    const sign = (ux * vy - uy * vx) < 0 ? -1 : 1;
    const dot  = ux * vx + uy * vy;
    const len  = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
    return sign * Math.acos(Math.max(-1, Math.min(1, dot / len)));
  };

  const theta1 = angV(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dtheta   = angV((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!fs && dtheta > 0) dtheta -= 2 * Math.PI;
  if (fs  && dtheta < 0) dtheta += 2 * Math.PI;

  const n  = Math.max(1, Math.ceil(Math.abs(dtheta) / (Math.PI / 2)));
  const dt = dtheta / n;
  const results: [number, number, number, number, number, number][] = [];

  for (let i = 0; i < n; i++) {
    const t1 = theta1 + i * dt;
    const t2 = theta1 + (i + 1) * dt;
    const alpha = (4 / 3) * Math.tan(dt / 4);

    const cos1 = Math.cos(t1), sin1 = Math.sin(t1);
    const cos2 = Math.cos(t2), sin2 = Math.sin(t2);

    const ep1x = cosP * (rx * cos1) - sinP * (ry * sin1) + cx;
    const ep1y = sinP * (rx * cos1) + cosP * (ry * sin1) + cy;
    const dp1x = cosP * (-rx * sin1) - sinP * (ry * cos1);
    const dp1y = sinP * (-rx * sin1) + cosP * (ry * cos1);
    const ep2x = cosP * (rx * cos2) - sinP * (ry * sin2) + cx;
    const ep2y = sinP * (rx * cos2) + cosP * (ry * sin2) + cy;
    const dp2x = cosP * (-rx * sin2) - sinP * (ry * cos2);
    const dp2y = sinP * (-rx * sin2) + cosP * (ry * cos2);

    results.push([
      ep1x + alpha * dp1x, ep1y + alpha * dp1y,
      ep2x - alpha * dp2x, ep2y - alpha * dp2y,
      ep2x, ep2y,
    ]);
  }

  return results;
}

// Dash pattern for a dashed/dotted border stroke of width `w` (in the target unit - 
// SVG px or PDF pt). Approximates the browser's implementation-defined pattern: dotted →
// round dots on a 1:1 gap (dash=[w,w] + round caps); dashed → [3w,2w] butt caps. Returns
// null for solid/none/other styles (the caller strokes solid). Shared by both walkers so
// SVG stroke-dasharray and PDF setLineDashPattern stay in step.
export function borderDashArray(borderStyle: string | undefined | null, w: number): { dash: [number, number]; round: boolean } | null {
  if (!(w > 0)) return null;
  if (borderStyle === 'dotted') return { dash: [w, w], round: true };
  if (borderStyle === 'dashed') return { dash: [w * 3, w * 2], round: false };
  return null;
}

export { applyTextTransform } from './text-svg.ts';

// A resolved brand-palette hit: the CMYK 4-tuple (0–1) to substitute - a plain
// process-locked (or auto-derived-and-measured) swatch's own cmyk, or, for a
// swatch with no explicit cmyk lock, one derived from its screen hex - plus,
// when the swatch is ALSO spot-locked, the spot's name for a true /Separation
// colourspace substitution in the PDF path (the other CMYK paths - TIFF, EPS - 
// only ever use .cmyk; see their own scope notes). cmyk and spot are
// independent locks (see BrandPaletteEntry's doc comment): an explicit cmyk
// lock is never overridden by a spot lock's derived equivalent, so a
// separately-tuned process build survives even when a spot is also set.
//
// The types, the finish mask, the key quantiser and the builder all LIVE IN THE
// ENGINE now (engine/src/cmyk-palette.ts) and are re-exported here so every
// existing importer under shells/web is unchanged. They moved because the CLI's
// eps-cmyk sink is a fourth CMYK sink in a different shell, and while the builder
// was shell-local it could not reach it - so the finish fix was web-only and a
// declared foil still separated as gold from `lolly … --export=eps-cmyk`. One
// implementation, reachable from every shell.
export type { PaletteSpotHit, PaletteHit };
export { buildCmykPaletteMap, cmykKey };

// Deterministic /CSn resource names for every spot-locked entry in a palette map,
// assigned up front so substitutePdfRgb can write the final name into the content
// stream before the matching PDF colourspace object exists - renderCmykPdf only
// actually creates that object, lazily, for a spot a content stream really used.
export function assignSpotResourceNames(paletteMap: Map<string, PaletteHit>): Map<string, string> {
  const names = new Map<string, string>();
  for (const hit of paletteMap.values()) {
    if (hit.spot && !names.has(hit.spot.name)) names.set(hit.spot.name, `CS${names.size + 1}`);
  }
  return names;
}

// (cmykKey lives in engine/src/cmyk-palette.ts and is re-exported above, beside
// buildCmykPaletteMap - the quantisation and the map it keys must move together.)

// The quantised key a palette entry is matched on (mirrors buildCmykPaletteMap),
// so usedKeys recorded during substitution can be filtered back to entries.
export function paletteHitKey(p: BrandPaletteEntry): string | null {
  const h = (p?.hex ?? '').replace('#', '').toLowerCase();
  if (h.length !== 6) return null;
  return cmykKey(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255);
}

// Resolves PDF-space RGB (0–1) against the brand palette map, recording a hit
// (numeric or spot) into `used` so the verification colour bar can show only the
// inks that actually substituted. Returns null on a miss (caller falls back to the
// engine's generic device-CMYK conversion).
export function pdfColorHit(r: number, g: number, b: number, paletteMap: Map<string, PaletteHit>, used?: Set<string>): PaletteHit | null {
  const key = cmykKey(r, g, b);
  const hit = paletteMap.get(key);
  if (hit) used?.add(key);
  return hit ?? null;
}

// Formats a CMYK component (0–1) as a compact decimal string for PDF output.
export function cmykN(v: number): string {
  return v.toFixed(4).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') || '0';
}

// A fill/stroke is treated as solid black (and so OVERPRINTS) when it is pure K at
// or above this. rgbToCmyk maps every neutral to exactly C=M=Y=0, so the equality
// test on the CMY channels is exact; only K needs a threshold for near-solid text.
export const OVERPRINT_K_MIN = 0.99;

// The four overprint graphics states substitutePdfRgb selects (materialised as
// /ExtGState dicts in renderCmykPdf). OPM 1 (nonzero overprint mode) is MANDATORY:
// only under it does a DeviceCMYK component of 0 leave that plate untouched, which
// is what makes black-overprint and spot/finish plates not knock out.
//   GSfo = fill overprint, GSso = stroke overprint, GSfk = fill knockout, GSsk = stroke knockout
export const OVERPRINT_GS_DEFS: Record<string, Record<string, boolean | number>> = {
  GSfo: { op: true, OPM: 1 },
  GSso: { OP: true, OPM: 1 },
  GSfk: { op: false },
  GSsk: { OP: false },
};

// Replaces `r g b rg` / `r g b RG` operators with their CMYK equivalents - a plain
// DeviceCMYK "k"/"K" operator for a process-locked (or auto-derived, or naive
// fallback) match, or, for a spot-locked match, a switch to that spot's
// /Separation colourspace at full tint ("/CSn cs 1 scn" / "/CSn CS 1 SCN" - the
// resource name comes from spotNames, assigned by assignSpotResourceNames). `used`
// collects the brand palette keys that matched (for the colour bar); `usedSpots`
// collects the spot names actually referenced, so renderCmykPdf only materialises
// a /Separation object for spots a content stream really uses.
export function substitutePdfRgb(
  text: string,
  paletteMap: Map<string, PaletteHit>,
  spotNames: Map<string, string>,
  used?: Set<string>,
  usedSpots?: Set<string>,
  usedGs?: Set<string>,
): string {
  const N = '([+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?)';
  const W = '[\\s]+';
  // Each colour set is prefixed with a `/GSxx gs` selecting overprint or knockout,
  // per press convention: a FINISH plate (foil/spot-UV/emboss) and 100%-K text/rules
  // OVERPRINT the artwork beneath; an ordinary spot and any rich build (carries CMY)
  // KNOCK OUT; white/paper (all-zero) knocks out so it never vanishes. `gs` is
  // graphics state and persists to the following paint op, so it self-resets at the
  // next colour set. Fill and stroke get independent states so one can't stomp the
  // other. usedGs collects the names actually emitted, so renderCmykPdf only
  // materialises the /ExtGState dicts that are referenced.
  return text
    .replace(new RegExp(`${N}${W}${N}${W}${N}${W}\\brg\\b`, 'g'), (_, r, g, b) => {
      const hit = pdfColorHit(+r, +g, +b, paletteMap, used);
      if (hit?.spot) {
        usedSpots?.add(hit.spot.name);
        const gs = hit.spot.finish ? 'GSfo' : 'GSfk';   // finish overprints; ordinary spot knocks out
        usedGs?.add(gs);
        return `/${gs} gs /${spotNames.get(hit.spot.name)} cs 1 scn`;
      }
      const [c, m, y, k] = hit ? hit.cmyk : rgbToCmyk(+r, +g, +b);
      const gs = (c === 0 && m === 0 && y === 0 && k >= OVERPRINT_K_MIN) ? 'GSfo' : 'GSfk';
      usedGs?.add(gs);
      return `/${gs} gs ${cmykN(c)} ${cmykN(m)} ${cmykN(y)} ${cmykN(k)} k`;
    })
    .replace(new RegExp(`${N}${W}${N}${W}${N}${W}\\bRG\\b`, 'g'), (_, r, g, b) => {
      const hit = pdfColorHit(+r, +g, +b, paletteMap, used);
      if (hit?.spot) {
        usedSpots?.add(hit.spot.name);
        const gs = hit.spot.finish ? 'GSso' : 'GSsk';
        usedGs?.add(gs);
        return `/${gs} gs /${spotNames.get(hit.spot.name)} CS 1 SCN`;
      }
      const [c, m, y, k] = hit ? hit.cmyk : rgbToCmyk(+r, +g, +b);
      const gs = (c === 0 && m === 0 && y === 0 && k >= OVERPRINT_K_MIN) ? 'GSso' : 'GSsk';
      usedGs?.add(gs);
      return `/${gs} gs ${cmykN(c)} ${cmykN(m)} ${cmykN(y)} ${cmykN(k)} K`;
    });
}

export function svgLen(val: string | number | null | undefined, total: number): number {
  if (!val) return 0;
  const s = String(val);
  if (s.endsWith('%')) return (parseFloat(s) / 100) * total;
  return parseFloat(s) || 0;
}

// Map a CSS object-position to the equivalent SVG preserveAspectRatio alignment keyword
// (xMin/xMid/xMax + YMin/YMid/YMax), so an <image> / nested <svg> in an SVG export
// anchors to the same edge/corner as on screen and in the PDF path. Reuses the same
// fraction parse: a fraction ≤¼ → Min, ≥¾ → Max, else Mid - exact for the nine anchors
// the editor offers (0 / 0.5 / 1).
export function preserveAspectRatioAlign(objectPosition: string | null | undefined): string {
  const [px, py] = objectPositionFractions(objectPosition);
  const xa = px <= 0.25 ? 'xMin' : px >= 0.75 ? 'xMax' : 'xMid';
  const ya = py <= 0.25 ? 'YMin' : py >= 0.75 ? 'YMax' : 'YMid';
  return xa + ya;
}

// Parse an SVG/CSS colour to sRGB bytes, or null for none/transparent/unparseable.
// Delegates to the engine's CSS Color 4 parser (the single source of truth), which
// also owns THE named-colour table - this file used to carry its own 148-entry copy,
// and its own legacy-rgb regex that dropped every oklch()/oklab()/color() paint.
export function parseSvgColor(color: string | null): Rgb | null {
  const c = parseColorToSrgb8(color);
  return c ? [c[0], c[1], c[2]] : null;
}
