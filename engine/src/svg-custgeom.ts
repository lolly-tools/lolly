// SPDX-License-Identifier: MPL-2.0
/**
 * Flat-SVG to native PowerPoint shapes. Pure, DOM-free, platform-agnostic.
 *
 * A flat stroke/fill SVG (the user's own line-art: `<path>`/`<rect>`/`<circle>`/etc.
 * with solid colours) is lowered to an array of {@link PptxPath} shapes so it rides
 * into a .pptx as real, editable vector geometry instead of a rasterised picture.
 * That removes the need for the EMF to Google Drawings to Slides to PPTX round-trip
 * users do today to keep such art vector.
 *
 * Since engine 1.128 the lowering ALSO carries plain `<text>` runs as native
 * {@link PptxText} boxes (svgToNativePptx) - so a chart's labels arrive in
 * PowerPoint AND Google Slides as live, editable, correctly-named text instead
 * of a picture that font-substitutes to serif. Slides matches an imported run's
 * font name against the Google Fonts catalogue, so a brand face that lives
 * there (SUSE does) comes back as the real font. Text support is deliberately
 * narrow: an untransformed (translate/scale only) single-run `<text>` with
 * plain styling. Anything else - letter-spacing, textLength, per-glyph rotate,
 * positioned/styled `<tspan>`s, `<textPath>`, an unusual dominant-baseline -
 * returns `null` so the caller keeps its raster path and nothing regresses.
 *
 * This does its own tiny SVG scan; it uses no DOM, since the engine never touches
 * one. It walks the tag stream, tracks the group `transform` stack and inherited
 * `fill`/`stroke`/`stroke-width` (plus font state for the text mode), converts
 * every drawable element to an SVG `d` string, and maps its coordinates through
 * the group transforms composed with the viewBox-to-target-EMU-box map, so every
 * emitted shape shares one 0..targetW by 0..targetH space with relative
 * positions preserved.
 *
 * It is deliberately conservative: the whole point is to never regress a non-flat
 * SVG. Anything it can't reproduce as solid vector geometry or a plain text run
 * (gradients, filters, masks, clip-paths, blend modes, `<image>`/`<use>`, a
 * `<style>` block, `currentColor`, an unknown named colour, a rotate/skew
 * transform, an unreadable viewBox) makes it return `null` so the caller keeps
 * its raster path. Partial opacity is NOT a bail since 1.128: DrawingML solids
 * carry an `<a:alpha>` child, so tinted gridlines, secondary labels and
 * translucent track bars - the constructs real charts are made of - lower with
 * their alpha instead of dragging the whole document to raster (group `opacity`
 * is multiplied down per leaf, the same flatten the shells' svg-ir walker uses).
 * `svgToCustGeomPaths` keeps the original geometry-only contract: any `<text>`
 * at all bails, exactly as before.
 *
 * Uses parseSvgPath (svg-path.ts) as the single path tokenizer; returns PptxPath[]
 * / PptxText[] (pptx.ts). No Handlebars, no ajv, no deps. Fully node:test-able.
 */

import { parseSvgPath } from './svg-path.ts';
import { colorToHex } from './tokens.ts';
import type { PptxPath, PptxText } from './pptx.ts';

// Input / allocation guards (untrusted SVG text). Beyond these → null (raster).
const MAX_SVG_LEN = 4_000_000;
const MAX_TAGS = 40_000;
const MAX_SHAPES = 4_000;

// Tags that mean "not flat solid vector art". Their presence forces a raster
// fallback. `text`/`tspan` are conditionally allowed by the text-aware entry
// point (svgToNativePptx); `textpath` never is (path-following text has no
// text-box equivalent).
const BAIL_TAGS = new Set([
  'lineargradient', 'radialgradient', 'meshgradient', 'pattern', 'filter', 'mask',
  'clippath', 'image', 'use', 'text', 'tspan', 'textpath', 'foreignobject', 'symbol',
  'marker', 'switch', 'style', 'feimage', 'animate', 'animatetransform', 'set',
]);
const DRAW_TAGS = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polygon', 'polyline']);

const EMU_PER_PT = 12700;
// First-baseline distance from the box top, and the box height, as em factors.
// The box has zero insets and a top anchor (pptx.ts textXml), so these place a
// run whose SVG anchor is its alphabetic baseline. 0.82 is a good middle of the
// common Latin ascents; the trade for native, editable text is that placement
// is metric-approximate the same way EMF's live text is renderer-metric.
const TEXT_ASCENT_EM = 0.82;
const TEXT_BOX_H_EM = 1.3;

// ─── affine matrix [a,b,c,d,e,f]: x' = a·x + c·y + e ; y' = b·x + d·y + f ────────
type Mat = [number, number, number, number, number, number];
const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];

// m1 composed with m2: apply m2 first, then m1 (SVG's "translate(..) scale(..)" order).
function matMul(m1: Mat, m2: Mat): Mat {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;
  return [
    a1 * a2 + c1 * b2, b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2, b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1, b1 * e2 + d1 * f2 + f1,
  ];
}
const applyMat = (m: Mat, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
// Uniform linear scale of a matrix: how much a stroke width grows under it.
const matScale = (m: Mat): number => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;

// Parse an SVG `transform` attribute to a matrix, or null if it uses a function we
// don't reproduce (rotate/skew/anything non-affine-simple) → caller bails to raster.
function parseTransform(v: string | undefined): Mat | null {
  if (!v) return IDENTITY;
  const trimmed = v.trim();
  if (trimmed === '' || trimmed.toLowerCase() === 'none') return IDENTITY;
  let acc: Mat = IDENTITY;
  const re = /([a-zA-Z]+)\s*\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  let saw = false;
  while ((m = re.exec(v)) !== null) {
    saw = true;
    const name = m[1]!.toLowerCase();
    const n = (m[2] ?? '').trim().split(/[\s,]+/).filter(s => s !== '').map(Number);
    if (n.some(x => !Number.isFinite(x))) return null; // NaN arg → can't reproduce
    let t: Mat;
    if (name === 'translate') t = [1, 0, 0, 1, n[0] ?? 0, n[1] ?? 0];
    else if (name === 'scale') t = [n[0] ?? 1, 0, 0, n[1] ?? n[0] ?? 1, 0, 0];
    else if (name === 'matrix' && n.length >= 6) t = [n[0]!, n[1]!, n[2]!, n[3]!, n[4]!, n[5]!];
    else return null; // rotate / skewX / skewY / malformed matrix → not reproduced
    acc = matMul(acc, t);
  }
  return saw ? acc : null; // a non-empty transform that matched no known function → raster
}

// ─── attributes / style ───────────────────────────────────────────────────────
function attrOf(attrs: string, name: string): string | undefined {
  const re = new RegExp(`(?:^|[\\s])${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i');
  const m = re.exec(attrs);
  return m ? (m[2] ?? m[3]) : undefined;
}
function parseStyle(s: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!s) return out;
  for (const decl of s.split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    out[decl.slice(0, i).trim().toLowerCase()] = decl.slice(i + 1).trim();
  }
  return out;
}

// ─── paint ───────────────────────────────────────────────────────────────────
// 'none' (sentinel) | a solid colour with its own alpha | null (unresolvable →
// the caller bails to raster). DrawingML solids carry an <a:alpha> child, so a
// translucent paint LOWERS instead of forcing the raster path (charts tint
// their gridlines and secondary labels; an alpha bail rasterised every one).
type Paint = 'none' | { hex: string; a: number } | null;
function resolvePaint(v: string | undefined): Paint | undefined {
  if (v == null) return undefined;              // not set here → inherit
  const s = v.trim().toLowerCase();
  if (s === '') return undefined;
  if (s === 'none' || s === 'transparent') return 'none';
  if (s === 'currentcolor' || s.includes('url(')) return null; // context colour / gradient/pattern → raster
  const hex = colorToHex(s);
  if (typeof hex !== 'string') return null;
  if (hex.startsWith('#')) {
    if (hex.length === 9) {                     // #rrggbbaa - alpha rides along
      return { hex: hex.slice(0, 7).toUpperCase(), a: parseInt(hex.slice(7, 9), 16) / 255 };
    }
    return { hex: hex.toUpperCase(), a: 1 };
  }
  const named = NAMED_COLOR_HEX[hex.toLowerCase()];
  return named ? { hex: named, a: 1 } : null;   // unknown named colour → raster
}

// An opacity-ish value clamped to 0..1, or undefined for absent/junk (inherit).
function num01(raw: string | undefined): number | undefined {
  if (raw == null) return undefined;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : undefined;
}

// ─── primitive → `d` (in the element's own user units) ───────────────────────
const numAttr = (attrs: string, name: string, def: number): number => {
  const v = attrOf(attrs, name);
  const n = v != null ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : def;
};
function primitiveToD(tag: string, attrs: string): string | null {
  if (tag === 'rect') {
    const x = numAttr(attrs, 'x', 0), y = numAttr(attrs, 'y', 0);
    const w = numAttr(attrs, 'width', 0), h = numAttr(attrs, 'height', 0);
    if (!(w > 0 && h > 0)) return null;
    let rx = numAttr(attrs, 'rx', NaN), ry = numAttr(attrs, 'ry', NaN);
    if (!Number.isFinite(rx) && !Number.isFinite(ry)) rx = ry = 0;
    else { if (!Number.isFinite(rx)) rx = ry; if (!Number.isFinite(ry)) ry = rx; }
    rx = Math.min(Math.max(0, rx), w / 2); ry = Math.min(Math.max(0, ry), h / 2);
    if (rx <= 0 || ry <= 0) return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
    return `M${x + rx} ${y}H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}` +
      `V${y + h - ry}A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}` +
      `H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}` +
      `V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`;
  }
  if (tag === 'circle') {
    const cx = numAttr(attrs, 'cx', 0), cy = numAttr(attrs, 'cy', 0), r = numAttr(attrs, 'r', 0);
    if (!(r > 0)) return null;
    return `M${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}Z`;
  }
  if (tag === 'ellipse') {
    const cx = numAttr(attrs, 'cx', 0), cy = numAttr(attrs, 'cy', 0);
    const rx = numAttr(attrs, 'rx', 0), ry = numAttr(attrs, 'ry', 0);
    if (!(rx > 0 && ry > 0)) return null;
    return `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;
  }
  if (tag === 'line') {
    const x1 = numAttr(attrs, 'x1', 0), y1 = numAttr(attrs, 'y1', 0);
    const x2 = numAttr(attrs, 'x2', 0), y2 = numAttr(attrs, 'y2', 0);
    return `M${x1} ${y1}L${x2} ${y2}`;
  }
  if (tag === 'polygon' || tag === 'polyline') {
    const pts = (attrOf(attrs, 'points') ?? '').trim().split(/[\s,]+/).map(Number).filter(x => Number.isFinite(x));
    if (pts.length < 4) return null;
    let d = `M${pts[0]} ${pts[1]}`;
    for (let i = 2; i + 1 < pts.length; i += 2) d += `L${pts[i]} ${pts[i + 1]}`;
    return tag === 'polygon' ? d + 'Z' : d;
  }
  return null;
}

// ─── viewBox → EMU mapping ────────────────────────────────────────────────────
function rootMap(rootAttrs: string, targetW: number, targetH: number): Mat | null {
  const vb = attrOf(rootAttrs, 'viewBox');
  let vx = 0, vy = 0, vw = 0, vh = 0;
  if (vb) {
    const p = vb.trim().split(/[\s,]+/).map(Number);
    if (p.length < 4 || p.some(x => !Number.isFinite(x))) return null;
    [vx, vy, vw, vh] = p as [number, number, number, number];
  } else {
    vw = parseFloat(attrOf(rootAttrs, 'width') ?? '');
    vh = parseFloat(attrOf(rootAttrs, 'height') ?? '');
  }
  if (!(vw > 0 && vh > 0)) return null;
  const sx = targetW / vw, sy = targetH / vh;
  return [sx, 0, 0, sy, -sx * vx, -sy * vy];
}

// ─── text helpers ─────────────────────────────────────────────────────────────

// A length that may be em/%/px/unitless, resolved against a font size in the
// same units. null = a form we don't reproduce (pt, %, junk) → raster.
function emLen(raw: string | undefined, fontSize: number): number | null {
  if (raw == null || raw.trim() === '') return 0;
  const s = raw.trim();
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return null;
  if (/em$/i.test(s)) return n * fontSize;
  if (/px$/i.test(s) || /^[-+.\d]+$/.test(s)) return n;
  return null;
}

// A zero letter-spacing in any spelling; anything else is tracking we can't carry.
function isPlainSpacing(raw: string | undefined): boolean {
  if (raw == null) return true;
  const s = raw.trim().toLowerCase();
  return s === '' || s === 'normal' || parseFloat(s) === 0;
}

const GENERIC_FAMILIES = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy',
  'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'ui-rounded', 'math', 'emoji']);

// First concrete face of a CSS stack, unquoted; undefined = leave the theme default.
function firstFace(stack: string | undefined): string | undefined {
  const first = (stack || '').split(',')[0]?.trim().replace(/^['"]+|['"]+$/g, '').trim();
  if (!first || GENERIC_FAMILIES.has(first.toLowerCase())) return undefined;
  return first;
}

// Decode the five XML entities plus numeric refs - the only ones SVG text carries.
function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (whole, body: string) => {
    if (body[0] === '#') {
      const code = body[1]?.toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10FFFF ? String.fromCodePoint(code) : whole;
    }
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[body] ?? whole;
  });
}

interface Frame {
  g: Mat; fill: Paint; stroke: Paint; strokeWidth: number; defs: boolean;
  // Opacity: `opacity` composites per GROUP in SVG, but for the non-overlapping
  // art this lowering targets, multiplying it down per leaf is the standard
  // flatten (the shells' svg-ir walker does the same). fill/stroke-opacity are
  // inherited properties and ride separately.
  groupAlpha: number; fillOpacity: number; strokeOpacity: number;
  // Inherited text state (only consulted by the text mode).
  fontSize: number; fontFamily?: string; fontBold: boolean; fontItalic: boolean;
  textAnchor: 'start' | 'middle' | 'end'; letterSpacing?: string;
  underline: boolean; strike: boolean;
}

/** The text-aware lowering's result: custGeom shapes plus native text boxes,
 *  both positioned in the same 0..targetW by 0..targetH EMU box. */
export interface SvgNativePptx { paths: PptxPath[]; texts: PptxText[]; }

/**
 * Lower a flat SVG to native PowerPoint custom-geometry shapes, or `null` when it
 * isn't flat solid vector art (the caller then rasterises). Original contract:
 * any `<text>` bails, exactly as it always did.
 *
 * @param svgText  the SVG document text
 * @param targetW  destination box width in EMU (becomes each shape's cx)
 * @param targetH  destination box height in EMU (becomes each shape's cy)
 * @returns PptxPath[] positioned at x=0,y=0 (the caller offsets to the element box), or null
 */
export function svgToCustGeomPaths(svgText: string, targetW: number, targetH: number): PptxPath[] | null {
  const r = lower(svgText, targetW, targetH, false);
  return r && r.paths.length ? r.paths : null;
}

/**
 * The text-aware lowering: custGeom shapes PLUS plain `<text>` runs as native
 * text boxes (see the module header for the exact text subset). `null` on
 * anything outside the reproducible set - the caller keeps its raster path.
 */
export function svgToNativePptx(svgText: string, targetW: number, targetH: number): SvgNativePptx | null {
  const r = lower(svgText, targetW, targetH, true);
  return r && (r.paths.length || r.texts.length) ? r : null;
}

function lower(svgText: string, targetW: number, targetH: number, withText: boolean): SvgNativePptx | null {
  if (typeof svgText !== 'string' || svgText.length === 0 || svgText.length > MAX_SVG_LEN) return null;
  if (!(Number.isFinite(targetW) && Number.isFinite(targetH) && targetW > 0 && targetH > 0)) return null;

  const cx = Math.round(targetW), cy = Math.round(targetH);
  const shapes: PptxPath[] = [];
  const texts: PptxText[] = [];
  const base: Frame = {
    g: IDENTITY, fill: { hex: '#000000', a: 1 }, stroke: 'none', strokeWidth: 1, defs: false,
    groupAlpha: 1, fillOpacity: 1, strokeOpacity: 1,
    fontSize: 16, fontBold: false, fontItalic: false, textAnchor: 'start', underline: false, strike: false,
  };
  const stack: Frame[] = [base];
  let mVb: Mat | null = null;
  let sawSvg = false;
  // One in-flight <text> capture: slice bounds + the frame/attrs to style it with.
  let capture: { start: number; frame: Frame; attrs: string; style: Record<string, string>; depth: number } | null = null;

  const round = (n: number): number => Math.round(n);
  const emit = (d: string, f: Frame, forceNoFill: boolean): void => {
    if (!mVb) return;
    // Effective per-aspect alpha; ≤0.005 is invisible and drops the aspect.
    const fillA = typeof f.fill === 'object' && f.fill ? f.groupAlpha * f.fillOpacity * f.fill.a : 0;
    const strokeA = typeof f.stroke === 'object' && f.stroke ? f.groupAlpha * f.strokeOpacity * f.stroke.a : 0;
    const fill: Paint = forceNoFill || fillA <= 0.005 ? 'none' : f.fill;
    const stroke: Paint = strokeA <= 0.005 ? 'none' : f.stroke;
    if ((fill === 'none' || fill == null) && (stroke === 'none' || stroke == null)) return;
    const final = matMul(mVb, f.g);
    const subs = parseSvgPath(d);
    if (!subs.length) return;
    let out = '';
    for (const sub of subs) {
      for (const seg of sub.segments) {
        if (seg.op === 'M') { const [x, y] = applyMat(final, seg.x, seg.y); out += `M${round(x)} ${round(y)}`; }
        else if (seg.op === 'L') { const [x, y] = applyMat(final, seg.x, seg.y); out += `L${round(x)} ${round(y)}`; }
        else {
          const [x1, y1] = applyMat(final, seg.x1, seg.y1);
          const [x2, y2] = applyMat(final, seg.x2, seg.y2);
          const [x, y] = applyMat(final, seg.x, seg.y);
          out += `C${round(x1)} ${round(y1)} ${round(x2)} ${round(y2)} ${round(x)} ${round(y)}`;
        }
      }
      if (sub.closed) out += 'Z';
    }
    if (!out) return;
    const shape: PptxPath = { kind: 'path', x: 0, y: 0, cx, cy, paths: [{ d: out }] };
    if (fill !== 'none' && fill != null) shape.fill = { solid: fill.hex, ...(fillA < 0.995 ? { alpha: fillA } : {}) };
    if (stroke !== 'none' && stroke != null) {
      shape.line = {
        color: stroke.hex, w: Math.max(1, Math.round(f.strokeWidth * matScale(final))),
        ...(strokeA < 0.995 ? { alpha: strokeA } : {}),
      };
    }
    shapes.push(shape);
  };

  // Turn the finished capture into one PptxText box. Returns false → whole-doc
  // bail (a run we must not approximate).
  const emitText = (endIndex: number): boolean => {
    const c = capture!;
    capture = null;
    if (!mVb) return true;
    const f = c.frame;
    if (f.defs) return true;
    const content = decodeEntities(svgText.slice(c.start, endIndex).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (!content) return true;
    const runAlpha = typeof f.fill === 'object' && f.fill ? f.groupAlpha * f.fillOpacity * f.fill.a : 0;
    if (f.fill === 'none' || runAlpha <= 0.005) return true;   // invisible run - nothing to carry
    if (f.stroke !== 'none' && f.stroke != null) return false; // stroked text has no run equivalent
    if (!isPlainSpacing(f.letterSpacing)) return false;
    const final = matMul(mVb, f.g);
    // The composed map is axis-aligned by construction (rotate/skew already
    // bailed); text additionally needs it UNIFORM or glyphs would stretch.
    const sx = Math.abs(final[0]), sy = Math.abs(final[3]);
    if (!(sx > 0 && sy > 0) || Math.abs(sx - sy) / Math.max(sx, sy) > 0.02) return false;

    const dx = emLen(attrOf(c.attrs, 'dx'), f.fontSize);
    const dy = emLen(attrOf(c.attrs, 'dy'), f.fontSize);
    if (dx === null || dy === null) return false;
    const [ex, ey] = applyMat(final, numAttr(c.attrs, 'x', 0) + dx, numAttr(c.attrs, 'y', 0) + dy);

    const sizeEmu = f.fontSize * sy;
    const sizePt = Math.round((sizeEmu / EMU_PER_PT) * 100) / 100;
    if (!(sizePt >= 1 && sizePt <= 400)) return false;

    const domBase = (c.style['dominant-baseline'] ?? attrOf(c.attrs, 'dominant-baseline') ?? '').trim().toLowerCase();
    let vAnchor: 't' | 'ctr' = 't';
    let by: number;
    const boxH = TEXT_BOX_H_EM * sizeEmu;
    if (domBase === '' || domBase === 'auto' || domBase === 'alphabetic' || domBase === 'ideographic') {
      by = ey - TEXT_ASCENT_EM * sizeEmu;
    } else if (domBase === 'text-before-edge' || domBase === 'hanging') {
      by = ey;
    } else if (domBase === 'central' || domBase === 'middle' || domBase === 'mathematical') {
      by = ey - boxH / 2; vAnchor = 'ctr';
    } else return false;

    // Width is an estimate, so the box is anchored the same way the text is
    // aligned - the visual anchor holds even when the estimate is off.
    const wide = /[ᄀ-ᇿ⺀-꓏가-힣豈-﫿＀-￦]/.test(content);
    const bw = sizeEmu * ((wide ? 1.05 : 0.72) * content.length + 2);
    const bx = f.textAnchor === 'middle' ? ex - bw / 2 : f.textAnchor === 'end' ? ex - bw : ex;
    const align = f.textAnchor === 'middle' ? 'ctr' as const : f.textAnchor === 'end' ? 'r' as const : 'l' as const;

    texts.push({
      kind: 'text', x: round(bx), y: round(by), cx: Math.max(1, round(bw)), cy: Math.max(1, round(boxH)),
      anchor: vAnchor,
      paras: [{
        align,
        runs: [{
          text: content, sizePt,
          color: typeof f.fill === 'object' && f.fill ? f.fill.hex : '#000000',
          ...(runAlpha < 0.995 ? { alpha: runAlpha } : {}),
          ...(f.fontBold ? { bold: true } : {}),
          ...(f.fontItalic ? { italic: true } : {}),
          ...(f.underline ? { underline: true } : {}),
          ...(f.strike ? { strike: true } : {}),
          ...(firstFace(f.fontFamily) ? { font: firstFace(f.fontFamily) } : {}),
        }],
      }],
    });
    return true;
  };

  // Tag scanner: matches open / close / self-closing tags; attribute run tolerates a
  // '>' inside a quoted value. Comments (<!-- -->), <?xml?>, <!DOCTYPE> don't start with
  // a name char, so they never match.
  const tagRe = /<(\/?)\s*([a-zA-Z][\w:.-]*)((?:"[^"]*"|'[^']*'|[^"'>])*)>/g;
  let m: RegExpExecArray | null;
  let tagCount = 0;
  while ((m = tagRe.exec(svgText)) !== null) {
    if (++tagCount > MAX_TAGS) return null;
    const closing = m[1] === '/';
    const tag = m[2]!.toLowerCase();
    const attrsRaw = m[3] ?? '';

    if (closing) {
      if (capture) {
        if (tag === 'text' && capture.depth === 0) { if (!emitText(m.index)) return null; }
        else capture.depth--;
      }
      if (stack.length > 1) stack.pop();
      continue;
    }

    const selfClose = /\/\s*$/.test(attrsRaw);
    const textTagAllowed = withText && (tag === 'text' || tag === 'tspan');
    if (BAIL_TAGS.has(tag) && !textTagAllowed) return null;

    const parent = stack[stack.length - 1]!;
    const style = parseStyle(attrOf(attrsRaw, 'style'));

    // Effects we can't reproduce as solid geometry → raster fallback. (Opacity
    // is NOT one of them since 1.128: it rides as DrawingML alpha - see Frame.)
    for (const k of ['filter', 'mask', 'clip-path', 'mix-blend-mode']) {
      const raw = style[k] ?? attrOf(attrsRaw, k);
      if (raw != null && raw.trim() !== '' && raw.trim().toLowerCase() !== 'none') return null;
    }

    const tm = parseTransform(style['transform'] ?? attrOf(attrsRaw, 'transform'));
    if (tm === null) return null;

    const fillR = resolvePaint(style['fill'] ?? attrOf(attrsRaw, 'fill'));
    const strokeR = resolvePaint(style['stroke'] ?? attrOf(attrsRaw, 'stroke'));
    if (fillR === null || strokeR === null) return null;

    const swRaw = style['stroke-width'] ?? attrOf(attrsRaw, 'stroke-width');
    const sw = swRaw != null && Number.isFinite(parseFloat(swRaw)) ? parseFloat(swRaw) : undefined;

    // Inherited font state (text mode only reads it; tracking it is cheap).
    const fsRaw = style['font-size'] ?? attrOf(attrsRaw, 'font-size');
    let fontSize = parent.fontSize;
    if (fsRaw != null) {
      const s = fsRaw.trim();
      const n = parseFloat(s);
      if (Number.isFinite(n) && n > 0) {
        fontSize = /em$/i.test(s) ? n * parent.fontSize : /%$/.test(s) ? (n / 100) * parent.fontSize : n;
      }
    }
    const fwRaw = (style['font-weight'] ?? attrOf(attrsRaw, 'font-weight'))?.trim().toLowerCase();
    const fontBold = fwRaw != null
      ? (fwRaw === 'bold' || fwRaw === 'bolder' || (Number.isFinite(parseFloat(fwRaw)) && parseFloat(fwRaw) >= 600))
      : parent.fontBold;
    const fstRaw = (style['font-style'] ?? attrOf(attrsRaw, 'font-style'))?.trim().toLowerCase();
    const fontItalic = fstRaw != null ? (fstRaw === 'italic' || fstRaw === 'oblique') : parent.fontItalic;
    const taRaw = (style['text-anchor'] ?? attrOf(attrsRaw, 'text-anchor'))?.trim().toLowerCase();
    const textAnchor = taRaw === 'start' || taRaw === 'middle' || taRaw === 'end' ? taRaw : parent.textAnchor;
    const decoRaw = ((style['text-decoration'] ?? style['text-decoration-line'] ?? attrOf(attrsRaw, 'text-decoration')) ?? '').toLowerCase();

    const frame: Frame = {
      g: matMul(parent.g, tm),
      fill: fillR ?? parent.fill,
      stroke: strokeR ?? parent.stroke,
      strokeWidth: sw ?? parent.strokeWidth,
      defs: parent.defs || tag === 'defs',
      groupAlpha: parent.groupAlpha * (num01(style['opacity'] ?? attrOf(attrsRaw, 'opacity')) ?? 1),
      fillOpacity: num01(style['fill-opacity'] ?? attrOf(attrsRaw, 'fill-opacity')) ?? parent.fillOpacity,
      strokeOpacity: num01(style['stroke-opacity'] ?? attrOf(attrsRaw, 'stroke-opacity')) ?? parent.strokeOpacity,
      fontSize,
      fontFamily: (style['font-family'] ?? attrOf(attrsRaw, 'font-family')) ?? parent.fontFamily,
      fontBold, fontItalic, textAnchor,
      letterSpacing: (style['letter-spacing'] ?? attrOf(attrsRaw, 'letter-spacing')) ?? parent.letterSpacing,
      underline: decoRaw ? decoRaw.includes('underline') : parent.underline,
      strike: decoRaw ? decoRaw.includes('line-through') : parent.strike,
    };

    if (tag === 'svg' && !sawSvg) { sawSvg = true; mVb = rootMap(attrsRaw, targetW, targetH); if (!mVb) return null; }

    const hidden = (style['display'] ?? attrOf(attrsRaw, 'display'))?.trim().toLowerCase() === 'none';

    if (capture) {
      // Inside a <text>: only bare or styling-only <tspan> keeps the run a single
      // line we can reproduce. A positioned tspan (x/y/dx/dy/rotate) is real
      // multi-line/hand-kerned layout → the raster keeps it faithful.
      if (tag !== 'tspan') return null;
      for (const a of ['x', 'y', 'dx', 'dy', 'rotate', 'textlength']) {
        if (attrOf(attrsRaw, a) != null) return null;
      }
      // Mixed styling inside one run (a bold word mid-sentence) can't be one
      // PptxRun; bail rather than flatten it wrongly.
      if (attrOf(attrsRaw, 'style') != null || attrOf(attrsRaw, 'fill') != null
        || attrOf(attrsRaw, 'font-weight') != null || attrOf(attrsRaw, 'font-style') != null
        || attrOf(attrsRaw, 'font-size') != null || attrOf(attrsRaw, 'font-family') != null) return null;
      // Push the frame like any other open tag so the generic close-pop balances.
      if (!selfClose) { capture.depth++; stack.push(frame); }
      continue;
    }

    if (tag === 'text') {
      // (withText is implied: without it the BAIL_TAGS check above returned.)
      if (attrOf(attrsRaw, 'rotate') != null || attrOf(attrsRaw, 'textlength') != null) return null;
      if (!selfClose && !hidden) capture = { start: tagRe.lastIndex, frame, attrs: attrsRaw, style, depth: 0 };
      if (!selfClose) stack.push(frame);
      if (texts.length + shapes.length > MAX_SHAPES) return null;
      continue;
    }

    if (DRAW_TAGS.has(tag) && !frame.defs && !hidden) {
      const d = tag === 'path' ? attrOf(attrsRaw, 'd') : primitiveToD(tag, attrsRaw);
      if (d) emit(d, frame, tag === 'line'); // <line> has no fillable area
      if (shapes.length + texts.length > MAX_SHAPES) return null;
    }

    if (!selfClose) stack.push(frame);
  }

  return { paths: shapes, texts };
}

// The 148 CSS named colours (147 X11 + rebeccapurple) → #rrggbb. colorToHex passes a
// bare colour ident through verbatim; this resolves it to a hex a solidFill can use.
const NAMED_COLOR_HEX: Record<string, string> = {
  aliceblue: '#F0F8FF', antiquewhite: '#FAEBD7', aqua: '#00FFFF', aquamarine: '#7FFFD4', azure: '#F0FFFF',
  beige: '#F5F5DC', bisque: '#FFE4C4', black: '#000000', blanchedalmond: '#FFEBCD', blue: '#0000FF',
  blueviolet: '#8A2BE2', brown: '#A52A2A', burlywood: '#DEB887', cadetblue: '#5F9EA0', chartreuse: '#7FFF00',
  chocolate: '#D2691E', coral: '#FF7F50', cornflowerblue: '#6495ED', cornsilk: '#FFF8DC', crimson: '#DC143C',
  cyan: '#00FFFF', darkblue: '#00008B', darkcyan: '#008B8B', darkgoldenrod: '#B8860B', darkgray: '#A9A9A9',
  darkgreen: '#006400', darkgrey: '#A9A9A9', darkkhaki: '#BDB76B', darkmagenta: '#8B008B', darkolivegreen: '#556B2F',
  darkorange: '#FF8C00', darkorchid: '#9932CC', darkred: '#8B0000', darksalmon: '#E9967A', darkseagreen: '#8FBC8F',
  darkslateblue: '#483D8B', darkslategray: '#2F4F4F', darkslategrey: '#2F4F4F', darkturquoise: '#00CED1', darkviolet: '#9400D3',
  deeppink: '#FF1493', deepskyblue: '#00BFFF', dimgray: '#696969', dimgrey: '#696969', dodgerblue: '#1E90FF',
  firebrick: '#B22222', floralwhite: '#FFFAF0', forestgreen: '#228B22', fuchsia: '#FF00FF', gainsboro: '#DCDCDC',
  ghostwhite: '#F8F8FF', gold: '#FFD700', goldenrod: '#DAA520', gray: '#808080', green: '#008000',
  greenyellow: '#ADFF2F', grey: '#808080', honeydew: '#F0FFF0', hotpink: '#FF69B4', indianred: '#CD5C5C',
  indigo: '#4B0082', ivory: '#FFFFF0', khaki: '#F0E68C', lavender: '#E6E6FA', lavenderblush: '#FFF0F5',
  lawngreen: '#7CFC00', lemonchiffon: '#FFFACD', lightblue: '#ADD8E6', lightcoral: '#F08080', lightcyan: '#E0FFFF',
  lightgoldenrodyellow: '#FAFAD2', lightgray: '#D3D3D3', lightgreen: '#90EE90', lightgrey: '#D3D3D3', lightpink: '#FFB6C1',
  lightsalmon: '#FFA07A', lightseagreen: '#20B2AA', lightskyblue: '#87CEFA', lightslategray: '#778899', lightslategrey: '#778899',
  lightsteelblue: '#B0C4DE', lightyellow: '#FFFFE0', lime: '#00FF00', limegreen: '#32CD32', linen: '#FAF0E6',
  magenta: '#FF00FF', maroon: '#800000', mediumaquamarine: '#66CDAA', mediumblue: '#0000CD', mediumorchid: '#BA55D3',
  mediumpurple: '#9370DB', mediumseagreen: '#3CB371', mediumslateblue: '#7B68EE', mediumspringgreen: '#00FA9A', mediumturquoise: '#48D1CC',
  mediumvioletred: '#C71585', midnightblue: '#191970', mintcream: '#F5FFFA', mistyrose: '#FFE4E1', moccasin: '#FFE4B5',
  navajowhite: '#FFDEAD', navy: '#000080', oldlace: '#FDF5E6', olive: '#808000', olivedrab: '#6B8E23',
  orange: '#FFA500', orangered: '#FF4500', orchid: '#DA70D6', palegoldenrod: '#EEE8AA', palegreen: '#98FB98',
  paleturquoise: '#AFEEEE', palevioletred: '#DB7093', papayawhip: '#FFEFD5', peachpuff: '#FFDAB9', peru: '#CD853F',
  pink: '#FFC0CB', plum: '#DDA0DD', powderblue: '#B0E0E6', purple: '#800080', rebeccapurple: '#663399',
  red: '#FF0000', rosybrown: '#BC8F8F', royalblue: '#4169E1', saddlebrown: '#8B4513', salmon: '#FA8072',
  sandybrown: '#F4A460', seagreen: '#2E8B57', seashell: '#FFF5EE', sienna: '#A0522D', silver: '#C0C0C0',
  skyblue: '#87CEEB', slateblue: '#6A5ACD', slategray: '#708090', slategrey: '#708090', snow: '#FFFAFA',
  springgreen: '#00FF7F', steelblue: '#4682B4', tan: '#D2B48C', teal: '#008080', thistle: '#D8BFD8',
  tomato: '#FF6347', turquoise: '#40E0D0', violet: '#EE82EE', wheat: '#F5DEB3', white: '#FFFFFF',
  whitesmoke: '#F5F5F5', yellow: '#FFFF00', yellowgreen: '#9ACD32',
};
