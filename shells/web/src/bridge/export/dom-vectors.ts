// SPDX-License-Identifier: MPL-2.0
/**
 * Shared helper mesh for the HTML→vector export walkers (SVG and PDF).
 *
 * The two walkers (export/svg.ts renderSvgFromHtml and export/pdf.ts
 * drawHtmlVectors) mirror each other in structure; the geometry, colour,
 * gradient, text-line and pseudo-element helpers they share live here so a fix
 * lands in both sinks at once.
 */

import { parseCssLength, cornerRadii, uniformRadius, roundedRectPath } from '@lolly/engine';
import type { CornerRadii, CornerPair } from '@lolly/engine';
import { blobToDataUrl, inlineBlobUrlsInEl } from './dom.ts';

export const SVG_NS = 'http://www.w3.org/2000/svg';

/** [r, g, b] channels 0–255. */
export type Rgb = [number, number, number];
/** [r, g, b, a] — channels 0–255, alpha 0–1. */
export type Rgba = [number, number, number, number];

/** The reference top-left the walkers measure element rects against. */
export interface RootRect {
  left: number;
  top: number;
}

// A tool canvas counts as SVG-rooted when the node IS an <svg>, or its only
// meaningful child is (style/script siblings ignored).
export function isSvgRooted(node: Element): boolean {
  if (node.tagName.toLowerCase() === 'svg') return true;
  for (const child of node.children) {
    const t = child.tagName.toLowerCase();
    if (t === 'style' || t === 'script') continue;
    return t === 'svg';
  }
  return false;
}

// The HTML→vector walkers position every element by its axis-aligned
// getBoundingClientRect, which drops any CSS rotate() — a free-canvas box would
// export unrotated at its enlarged bounding box. To render rotation faithfully we
// detect a PURE rotation (orthonormal matrix, det +1 — NOT a scaleX(-1) flip or a
// scale, which the walkers handle separately), then temporarily neutralise it on
// the live element, walk the now-axis-aligned subtree, and wrap the result in a
// rotation about the element's transform-origin. Returns 0 for anything that isn't
// a clean rotation, so every non-rotated element stays byte-identical.
export function pureRotationDeg(transform: string | null): number {
  if (!transform || transform === 'none') return 0;
  const m = /matrix\(([^)]+)\)/.exec(transform);
  if (!m || m[1] === undefined) return 0;
  const p = m[1].split(',').map(parseFloat);
  if (p.length < 4) return 0;
  const [a = 0, b = 0, c = 0, d = 0] = p;
  if (Math.abs(a - d) > 1e-3 || Math.abs(b + c) > 1e-3) return 0;   // scale/flip → not a rotation
  if (Math.abs(a * d - b * c - 1) > 1e-2) return 0;                 // determinant ≠ 1
  const deg = Math.atan2(b, a) * 180 / Math.PI;
  return Math.abs(deg) < 1e-3 ? 0 : deg;
}

// The rotation pivot (transform-origin) of `el` in the walker's root-relative
// coordinate space, measured from the element's UNROTATED border box. Call while
// the element's rotation is neutralised so `unrotRect` is the axis-aligned box.
export function rotationPivot(style: CSSStyleDeclaration, unrotRect: DOMRect, rootRect: RootRect): { x: number; y: number } {
  const o = (style.transformOrigin || '50% 50%').split(' ').map(parseFloat);
  return {
    x: (unrotRect.left - rootRect.left) + (o[0] || 0),
    y: (unrotRect.top - rootRect.top) + (o[1] || 0),
  };
}

// ── CSS colour parsing ────────────────────────────────────────────────────────

// Parse a computed CSS color (always rgb/rgba from getComputedStyle).
// Returns null for transparent or fully-transparent rgba.
export function parseCssColor(cssColor: string | null | undefined): Rgb | null {
  if (!cssColor || cssColor === 'transparent') return null;
  const m = cssColor.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (!m || m[1] === undefined || m[2] === undefined || m[3] === undefined) return null;
  if (m[4] !== undefined && parseFloat(m[4]) === 0) return null;
  return [+m[1], +m[2], +m[3]];
}

// Like parseCssColor but preserves the alpha channel as a 4th element [r,g,b,a].
// Returns null for fully transparent colours.
export function parseCssColorFull(cssColor: string | null | undefined): Rgba | null {
  if (!cssColor || cssColor === 'transparent') return null;
  const m = cssColor.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (!m || m[1] === undefined || m[2] === undefined || m[3] === undefined) return null;
  const a = m[4] !== undefined ? parseFloat(m[4]) : 1;
  if (a === 0) return null;
  return [+m[1], +m[2], +m[3], a];
}

// Parse a CSS length value (px or %). refPx is used for percentage resolution.
// Delegates to the engine's DOM-free parser (single source of truth).
export function parseCssLen(val: string | null | undefined, refPx: number): number {
  return parseCssLength(val, refPx);
}

export interface ResolvedRadii {
  radii: CornerRadii;
  uniform: CornerPair | null;
}

// Resolve a computed style's four border-radius corners for a w×h box into the
// CSS §5.5 corner-overlap-clamped geometry, via the engine (the single source of
// truth shared by the SVG and PDF walkers — see engine/src/css-box.ts).
//
// Returns { radii, uniform }: `radii` is the four clamped [h,v] corners; `uniform`
// is a single [rx,ry] pair when all four corners are equal (the common pill /
// ellipse / circle / rounded-rect case — emit a fast <rect rx ry> / jsPDF
// roundedRect) or null when they differ (emit a four-corner path so e.g. a
// top-only-rounded card keeps its square bottom corners instead of rounding all
// four). The uniform path is byte-identical to before, preserving the pill fix.
export function resolveRadii(style: CSSStyleDeclaration, w: number, h: number): ResolvedRadii {
  const radii = cornerRadii({
    topLeft:     style.borderTopLeftRadius,
    topRight:    style.borderTopRightRadius,
    bottomRight: style.borderBottomRightRadius,
    bottomLeft:  style.borderBottomLeftRadius,
  }, w, h);
  return { radii, uniform: uniformRadius(radii) };
}

// ── SVG element factories ─────────────────────────────────────────────────────

export function makeSvgRect(x: number, y: number, w: number, h: number, rx: number, fill: string, ry: number = rx): SVGRectElement {
  const r = document.createElementNS(SVG_NS, 'rect');
  r.setAttribute('x',      String(x));
  r.setAttribute('y',      String(y));
  r.setAttribute('width',  String(w));
  r.setAttribute('height', String(h));
  // rx/ry are already CSS-clamped by resolveRadii/css-box (rx≤w/2, ry≤h/2), so the SVG
  // renderer won't re-clamp them per-axis into an ellipse. Emit both axes.
  if (rx > 0 || ry > 0) { r.setAttribute('rx', String(rx)); r.setAttribute('ry', String(ry)); }
  r.setAttribute('fill', fill);
  return r;
}

// SVG fill element for a (possibly four-corner) rounded rect: a fast <rect rx ry>
// when corners are uniform, else a <path>. `fillOpacity` < 1 emits fill-opacity
// (which svg-ir flattens over the background for EMF/EPS).
export function makeRoundedFill(
  x: number, y: number, w: number, h: number,
  radii: CornerRadii, uniform: CornerPair | null, fill: string, fillOpacity: number = 1,
): SVGElement {
  let el: SVGElement;
  if (uniform) {
    el = makeSvgRect(x, y, w, h, uniform[0], fill, uniform[1]);
  } else {
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', roundedRectPath(x, y, w, h, radii));
    p.setAttribute('fill', fill);
    el = p;
  }
  if (fillOpacity < 1) el.setAttribute('fill-opacity', String(fillOpacity));
  return el;
}

// ── CSS gradient parsing ──────────────────────────────────────────────────────

// Builds a <linearGradient> SVG element from a CSS linear-gradient() value.
// Uses gradientUnits="userSpaceOnUse" so coordinates match the canvas space.
// Returns null if the value is not a parseable linear gradient.
export function buildLinearGradientEl(bgImage: string, elX: number, elY: number, elW: number, elH: number, uid: number): SVGLinearGradientElement | null {
  const m = bgImage.match(/^linear-gradient\((.+)\)$/s);
  if (!m || m[1] === undefined) return null;
  const parts = splitCssArgs(m[1]);
  if (parts.length < 2) return null;

  let angleRad = Math.PI; // default: to bottom
  let stopsStart = 0;
  const first = (parts[0] ?? '').trim();
  if (/^to\s|deg$|turn$|rad$|grad$/.test(first)) {
    angleRad  = parseGradientAngle(first);
    stopsStart = 1;
  }

  const stops = parts.slice(stopsStart);
  if (stops.length < 2) return null;

  // Gradient line through the element centre; length guarantees full coverage
  // at any angle via: |w·sin(A)| + |h·cos(A)| / 2.
  const sinA = Math.sin(angleRad);
  const cosA = Math.cos(angleRad);
  const cx   = elX + elW / 2;
  const cy   = elY + elH / 2;
  const len  = (Math.abs(elW * sinA) + Math.abs(elH * cosA)) / 2;

  const grad = document.createElementNS(SVG_NS, 'linearGradient');
  grad.setAttribute('id',            `svggrad-${uid}`);
  grad.setAttribute('gradientUnits', 'userSpaceOnUse');
  grad.setAttribute('x1', String(cx - sinA * len));
  grad.setAttribute('y1', String(cy + cosA * len));
  grad.setAttribute('x2', String(cx + sinA * len));
  grad.setAttribute('y2', String(cy - cosA * len));

  const n = stops.length;
  stops.forEach((raw, i) => {
    const { colorStr, opacity, offset } = parseGradientStop(raw.trim(), i, n);
    if (!colorStr) return;
    const s = document.createElementNS(SVG_NS, 'stop');
    s.setAttribute('offset',     offset);
    s.setAttribute('stop-color', colorStr);
    if (opacity < 1) s.setAttribute('stop-opacity', String(opacity));
    grad.appendChild(s);
  });

  return grad.childNodes.length >= 2 ? grad : null;
}

// Splits a CSS argument string on top-level commas, respecting nested parens.
export function splitCssArgs(str: string): string[] {
  const parts: string[] = [];
  let depth = 0, start = 0;
  for (let i = 0; i < str.length; i++) {
    if      (str[i] === '(') depth++;
    else if (str[i] === ')') depth--;
    else if (str[i] === ',' && depth === 0) {
      parts.push(str.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(str.slice(start).trim());
  return parts;
}

// Converts a CSS gradient angle token to radians (SVG y-down convention).
export function parseGradientAngle(token: string): number {
  const t = token.trim().toLowerCase();
  if (t === 'to top')          return 0;
  if (t === 'to top right')    return Math.PI * 0.25;
  if (t === 'to right')        return Math.PI * 0.5;
  if (t === 'to bottom right') return Math.PI * 0.75;
  if (t === 'to bottom')       return Math.PI;
  if (t === 'to bottom left')  return Math.PI * 1.25;
  if (t === 'to left')         return Math.PI * 1.5;
  if (t === 'to top left')     return Math.PI * 1.75;
  if (t.endsWith('deg'))  return parseFloat(t) * Math.PI / 180;
  if (t.endsWith('turn')) return parseFloat(t) * 2 * Math.PI;
  if (t.endsWith('rad'))  return parseFloat(t);
  if (t.endsWith('grad')) return parseFloat(t) * Math.PI / 200;
  return Math.PI;
}

// Splits a CSS value on top-level whitespace, respecting nested parens — so the
// commas/spaces *inside* rgb(48, 186, 120) stay together while the SPACE between a
// colour and its position separates them. (splitCssArgs only splits commas, which
// can't separate the space-delimited "<color> <position>" of a computed gradient
// stop — getComputedStyle serialises stops as e.g. "rgb(48, 186, 120) 0%".)
function splitTopLevelWs(str: string): string[] {
  const out: string[] = []; let depth = 0, cur = '';
  for (const ch of str) {
    if (ch === '(') { depth++; cur += ch; }
    else if (ch === ')') { depth--; cur += ch; }
    else if (depth === 0 && /\s/.test(ch)) { if (cur) { out.push(cur); cur = ''; } }
    else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

export interface GradientStop {
  colorStr: string | null;
  opacity: number;
  offset: string;
}

// Parses one gradient colour-stop into { colorStr, opacity, offset }.
// Supports hex, rgb/rgba, and "transparent". Named colours return colorStr: null.
// A computed stop is "<color> <position?>" with the position SPACE-separated from
// the colour (e.g. "rgb(48, 186, 120) 0%"); the colour itself may contain commas
// and spaces inside its parens, so tokens are split on top-level whitespace and
// any trailing length/percent tokens are peeled off as the position.
export function parseGradientStop(raw: string, index: number, total: number): GradientStop {
  const tokens = splitTopLevelWs(raw.trim());
  const positions: string[] = [];
  for (;;) {
    const last = tokens[tokens.length - 1];
    if (last === undefined || !/^-?[\d.]+(px|%)$/.test(last)) break;
    tokens.pop();
    positions.unshift(last);
  }
  const colorRaw = tokens.join(' ').trim().toLowerCase();
  const pos = positions[0];
  const offset = pos
    ? (pos.endsWith('%') ? pos : parseFloat(pos) + 'px')
    : `${((index / Math.max(total - 1, 1)) * 100).toFixed(2)}%`;

  if (!colorRaw)                  return { colorStr: null, opacity: 1, offset }; // bare position = colour hint
  if (colorRaw === 'transparent') return { colorStr: 'rgba(0,0,0,0)', opacity: 0, offset };
  if (colorRaw.startsWith('#'))   return { colorStr: colorRaw, opacity: 1, offset };
  if (colorRaw.startsWith('rgb')) {
    const am = colorRaw.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/);
    return { colorStr: colorRaw, opacity: am?.[1] !== undefined ? parseFloat(am[1]) : 1, offset };
  }
  return { colorStr: null, opacity: 1, offset };
}

// Returns an averaged [r,g,b] sample of a linear-gradient's first and last
// stops. Used by drawHtmlVectors as an approximation for PDF output.
export function sampleGradientMidpoint(bgImage: string): Rgb | null {
  const m = bgImage.match(/^linear-gradient\((.+)\)$/s);
  if (!m || m[1] === undefined) return null;
  const parts = splitCssArgs(m[1]);
  let start = 0;
  if (parts[0] && /^to\s|deg$|turn$|rad$|grad$/.test(parts[0].trim())) start = 1;
  const stops = parts.slice(start).filter(Boolean);
  const firstStop = stops[0];
  const lastStop = stops[stops.length - 1];
  if (firstStop === undefined || lastStop === undefined) return null;
  const c1 = gradStopToRgb(firstStop.trim(), 0, stops.length);
  const c2 = gradStopToRgb(lastStop.trim(), stops.length - 1, stops.length);
  if (!c1 && !c2) return null;
  if (!c1) return c2;
  if (!c2) return c1;
  return [
    Math.round((c1[0] + c2[0]) / 2),
    Math.round((c1[1] + c2[1]) / 2),
    Math.round((c1[2] + c2[2]) / 2),
  ];
}

function gradStopToRgb(raw: string, index: number, total: number): Rgb | null {
  const { colorStr } = parseGradientStop(raw, index, total);
  if (!colorStr) return null;
  const s = colorStr.trim().toLowerCase();
  if (s.startsWith('#')) {
    const h = s.slice(1);
    if (h.length === 3) return [parseInt(h[0]! + h[0]!, 16), parseInt(h[1]! + h[1]!, 16), parseInt(h[2]! + h[2]!, 16)];
    if (h.length === 6) return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const mm = s.match(/rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)/);
  if (mm && mm[1] !== undefined && mm[2] !== undefined && mm[3] !== undefined) return [+mm[1], +mm[2], +mm[3]];
  return null;
}

// ── Text lines & metrics ──────────────────────────────────────────────────────

// Round to 2dp — keeps emitted path transforms compact (toPath already rounds d).
export function n2(v: number): number { return Math.round(v * 100) / 100; }

export interface VisualLine {
  text: string;
  rect: DOMRect;
}

// Split a text node's [start,end) offset range into visual lines, so CSS soft
// wrapping (which inserts no '\n') is honoured. We walk characters and start a
// new line whenever a glyph's top jumps; each line's edge whitespace is trimmed
// so its rect.left aligns with the first rendered glyph (collapsed leading spaces
// would otherwise shift the shaped run). Returns [{ text, rect }] per line.
export function visualLines(node: Text, start: number, end: number): VisualLine[] {
  const probe = document.createRange();
  const breaks = [start];
  let prevTop: number | null = null;
  for (let i = start; i < end; i++) {
    probe.setStart(node, i);
    probe.setEnd(node, i + 1);
    const rects = probe.getClientRects();
    const last = rects[rects.length - 1];
    if (!last) continue; // collapsed whitespace contributes no box
    const top = last.top;
    if (prevTop === null) prevTop = top;
    else if (Math.abs(top - prevTop) > 0.5) { breaks.push(i); prevTop = top; }
  }
  breaks.push(end);

  const full = node.textContent ?? '';
  const out: VisualLine[] = [];
  for (let k = 0; k + 1 < breaks.length; k++) {
    let s = breaks[k] ?? 0, e = breaks[k + 1] ?? 0;
    const slice = full.slice(s, e);
    s += slice.length - slice.replace(/^\s+/, '').length; // drop leading ws
    e -= slice.length - slice.replace(/\s+$/, '').length; // drop trailing ws
    if (e <= s) continue;
    probe.setStart(node, s);
    probe.setEnd(node, e);
    out.push({ text: full.slice(s, e), rect: probe.getBoundingClientRect() });
  }
  return out;
}

// Font ascent/descent in px for a computed style, via a reused canvas 2D context.
// fontBoundingBox* are font-level (sample text doesn't matter); the actualBounding
// and ratio fallbacks cover the rare engine without the fontBoundingBox metrics.
let _measureCtx: CanvasRenderingContext2D | null = null;
export function fontMetricsPx(style: CSSStyleDeclaration, fontSizePx: number): { ascent: number; descent: number } {
  if (!_measureCtx) _measureCtx = document.createElement('canvas').getContext('2d');
  if (!_measureCtx) return { ascent: fontSizePx * 0.8, descent: fontSizePx * 0.2 };
  _measureCtx.font =
    `${style.fontStyle || 'normal'} ${style.fontWeight || 400} ${fontSizePx}px ${style.fontFamily || 'sans-serif'}`;
  const m = _measureCtx.measureText('Mg');
  const ascent  = m.fontBoundingBoxAscent  ?? m.actualBoundingBoxAscent  ?? fontSizePx * 0.8;
  const descent = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent ?? fontSizePx * 0.2;
  return { ascent, descent };
}

// Apply CSS text-transform to a display string. CSS transforms text only at paint
// time (textContent is unchanged), so the vector walkers — which read textContent
// — must apply it themselves or vector exports show the original case. upper/lower
// are 1:1 so they don't disturb per-line substring offsets; capitalize upcases the
// first letter of each whitespace-separated word (locale-default).
export function applyTextTransform(str: string, transform: string): string {
  switch (transform) {
    case 'uppercase': return str.toUpperCase();
    case 'lowercase': return str.toLowerCase();
    case 'capitalize': return str.replace(/(^|[\s ])([^\s ])/gu, (_, p: string, c: string) => p + c.toUpperCase());
    default: return str;
  }
}

// ── Pseudo-element (::before/::after) descriptors ────────────────────────────

export interface PseudoDescriptor {
  text: string;
  bg: Rgba | null;
  radii: CornerRadii;
  uniform: CornerPair | null;
  w: number;
  h: number;
  ps: CSSStyleDeclaration;
  x: number;
  y: number;
}

// Resolve a CSS generated-content pseudo-element (::before/::after) into a drawable
// descriptor, or null if it has nothing visible. The DOM walkers only see real
// nodes, so list markers / arrows authored as ::before content (e.g. dynamic-layout's
// bullet dots and → arrows) are otherwise dropped from SVG/PDF. Scoped to the
// absolutely-positioned marker idiom — a pseudo has no getBoundingClientRect, so its
// box is computed from its containing block (nearest positioned ancestor) padding box
// + the pseudo's own left/top/size. Inline/static generated content isn't modelled.
export function pseudoDescriptor(el: Element, name: '::before' | '::after'): PseudoDescriptor | null {
  const ps = window.getComputedStyle(el, name);
  const content = ps.content;
  if (!content || content === 'none' || content === 'normal') return null;
  if (ps.position !== 'absolute') return null;
  const w = parseFloat(ps.width)  || 0;
  const h = parseFloat(ps.height) || 0;
  const bg = parseCssColorFull(ps.backgroundColor);
  // getComputedStyle returns the resolved string with real chars (e.g. '"→"'),
  // already quoted; unwrap it. counter()/attr() values won't match and are skipped.
  const m = content.match(/^["'](.*)["']$/s);
  const text = applyTextTransform(m?.[1] ?? '', ps.textTransform);
  if (!text.trim() && !(bg && w > 0.5 && h > 0.5)) return null;

  let cb: Element | null = el;
  while (cb && window.getComputedStyle(cb).position === 'static') cb = cb.parentElement;
  cb = cb || el;
  const cbRect = cb.getBoundingClientRect();
  const cbStyle = window.getComputedStyle(cb);
  const ox = cbRect.left + (parseFloat(cbStyle.paddingLeft) || 0);
  const oy = cbRect.top  + (parseFloat(cbStyle.paddingTop)  || 0);
  const left = parseFloat(ps.left);
  const top  = parseFloat(ps.top);
  const { radii, uniform } = resolveRadii(ps, w, h);
  return {
    text, bg, radii, uniform, w, h, ps,
    x: ox + (isFinite(left) ? left : 0),
    y: oy + (isFinite(top)  ? top  : 0),
  };
}

// ── Image helpers ────────────────────────────────────────────────────────────

// Decode an image source into an HTMLImageElement.
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

// Bake a CSS filter() into a raster image via the browser's OWN canvas filter, so
// vector exports (which embed photos as bitmaps anyway) match the on-screen / PNG
// result instead of dropping the treatment. Used for tools that expose an image
// filter (e.g. dynamic-layout's mono/punch/warm/cool/fade). Returns a filtered PNG
// data URL, or the original on any failure (filter:none, headless/no-canvas,
// tainted cross-origin canvas) — so it can never make output worse.
export async function bakeImageFilter(imgEl: HTMLImageElement | null, dataUrl: string, filterStr: string): Promise<string> {
  if (!filterStr || filterStr === 'none') return dataUrl;
  try {
    const img = (imgEl && imgEl.naturalWidth > 0) ? imgEl : await loadImage(dataUrl);
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

// Clips an image to a circle via an offscreen canvas. Used for headshots that
// carry border-radius: 50%. Returns a PNG data URL.
export async function circularClipImage(imgEl: HTMLImageElement | null, dataUrl: string): Promise<string> {
  const img = (imgEl && imgEl.naturalWidth > 0) ? imgEl : await loadImage(dataUrl);
  const size = Math.min(img.naturalWidth, img.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width  = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('circular clip needs a 2D canvas context');
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, 0, 0, size, size);
  return canvas.toDataURL('image/png');
}

// Fetch + parse an image source into a live <svg> element IFF it is SVG, so it
// can be drawn as true PDF vectors (jsPDF.addImage rejects SVG). Detection is by
// CONTENT, not URL — asset URLs are blob: with no extension or MIME hint, so we
// fetch the bytes and sniff for "<svg". Known raster MIME types are skipped fast.
// Handles blob:, http(s) and data: sources; returns null for non-SVG/unfetchable.
export async function inlineSvgFromImg(src: string): Promise<SVGSVGElement | null> {
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
  return svg instanceof SVGSVGElement ? svg : null;
}

// Rasterise a live <svg> subtree (inner <style> + gradients intact) to a PNG
// data URL, alpha preserved. The PDF walker uses this for gradient / filter
// illustrations the vector path can't reproduce faithfully (no shading; CSS-class
// fills). `flipX` mirrors horizontally to honour a scaleX(-1) CSS transform.
export async function rasterizeSvgElement(svgEl: SVGElement, pxW: number, pxH: number, flipX: boolean = false): Promise<string> {
  const clone = svgEl.cloneNode(true) as SVGElement;
  clone.setAttribute('xmlns', SVG_NS);
  clone.setAttribute('width',  String(pxW));
  clone.setAttribute('height', String(pxH));
  await inlineBlobUrlsInEl(clone);
  const xml = new XMLSerializer().serializeToString(clone);
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
  const img = new Image();
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error('svg rasterise failed'));
    img.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width  = pxW;
  canvas.height = pxH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('svg rasterise needs a 2D canvas context');
  if (flipX) { ctx.translate(pxW, 0); ctx.scale(-1, 1); }
  ctx.drawImage(img, 0, 0, pxW, pxH);
  return canvas.toDataURL('image/png');
}

// ── SVG attribute/paint resolution (live-DOM SVG walker) ─────────────────────

export function svgLen(val: string | null, total: number): number {
  if (!val) return 0;
  const s = String(val);
  if (s.endsWith('%')) return (parseFloat(s) / 100) * total;
  return parseFloat(s) || 0;
}

// Reads a CSS property from an element's style attribute (not computed style).
// Used to extract fill/stroke when they are set via style="" rather than as attributes.
export function resolveStyleProp(el: Element, prop: string): string | null {
  const styleAttr = el.getAttribute('style') ?? '';
  const m = styleAttr.match(new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([^;]+)'));
  return m?.[1] !== undefined ? m[1].trim() : null;
}

// The computed fill/stroke of a live-DOM SVG element — resolves SVG inheritance
// (an ancestor group's paint) and currentColor. Empty for a detached element, so
// callers keep their own literal fallback.
export function computedPaint(el: Element, prop: 'fill' | 'stroke'): string {
  try {
    return (typeof window !== 'undefined' && el.isConnected) ? (window.getComputedStyle(el)[prop] || '') : '';
  } catch { return ''; }
}

export function parseSvgColor(color: string | null | undefined): Rgb | null {
  if (!color) return null;
  const lc = color.toLowerCase().trim();
  if (lc === 'none' || lc === 'transparent') return null;
  if (lc === 'white') return [255, 255, 255];
  if (lc === 'black') return [0, 0, 0];
  if (lc.startsWith('#')) {
    const h = lc.slice(1);
    if (h.length === 3) return [
      parseInt(h[0]! + h[0]!, 16), parseInt(h[1]! + h[1]!, 16), parseInt(h[2]! + h[2]!, 16),
    ];
    if (h.length === 6) return [
      parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16),
    ];
  }
  const m = lc.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m && m[1] !== undefined && m[2] !== undefined && m[3] !== undefined) return [+m[1], +m[2], +m[3]];
  return null;
}

// fill resolution order for an SVG element: own attribute → inline style → computed.
export function resolveColor(el: Element): Rgb | null {
  const attr = el.getAttribute('fill');
  if (attr && attr !== 'currentColor') return parseSvgColor(attr);
  const styleAttr = el.getAttribute('style') ?? '';
  const styleMatch = styleAttr.match(/(?:^|;)\s*fill\s*:\s*([^;]+)/);
  if (styleMatch?.[1] !== undefined) return parseSvgColor(styleMatch[1].trim());
  const computed = typeof window !== 'undefined' ? window.getComputedStyle(el).fill : null;
  return computed ? parseSvgColor(computed) : null;
}

// Approximate SVG opacity by blending with white, used since jsPDF lacks per-element opacity.
export function blendSvgWithWhite(rgb: Rgb, opacity: number): Rgb {
  return [
    Math.round(rgb[0] * opacity + 255 * (1 - opacity)),
    Math.round(rgb[1] * opacity + 255 * (1 - opacity)),
    Math.round(rgb[2] * opacity + 255 * (1 - opacity)),
  ];
}

// Parse a CSS object-position into [x, y] fractions (0..1), so a meet-fitted image
// hugs the same edge in PDF as on screen (e.g. wayfinding rows use "left center" /
// "right center"). Handles keywords + percentages; falls back to centred.
export function objectPositionFractions(val: string | null | undefined): [number, number] {
  const toks = String(val || '50% 50%').trim().toLowerCase().split(/\s+/).slice(0, 2);
  let px = 0.5, py = 0.5;
  const pct: number[] = [];
  for (const t of toks) {
    if (t === 'left') px = 0; else if (t === 'right') px = 1;
    else if (t === 'top') py = 0; else if (t === 'bottom') py = 1;
    else if (t === 'center') { /* leave default */ }
    else if (t.endsWith('%')) { const p = parseFloat(t); if (isFinite(p)) pct.push(p / 100); }
  }
  if (pct.length === 1) px = pct[0] ?? px;
  else if (pct.length === 2) { px = pct[0] ?? px; py = pct[1] ?? py; }
  return [px, py];
}

// ── SVG path parsing (shared by the PDF path emitter) ────────────────────────

// Parse numeric args from an SVG path data segment string.
export function parseSvgPathArgs(str: string): number[] {
  const m = str.match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g);
  return m ? m.map(Number) : [];
}

/** One cubic segment: [cp1x, cp1y, cp2x, cp2y, endX, endY]. */
export type BezierSegment = [number, number, number, number, number, number];

// Converts an SVG arc command to cubic bezier curve segments.
// Returns array of [cp1x, cp1y, cp2x, cp2y, endX, endY] per segment.
// Algorithm from SVG spec appendix F.6.
export function svgArcToBeziers(
  x1: number, y1: number, rx: number, ry: number,
  phi: number, fa: number, fs: number, x2: number, y2: number,
): BezierSegment[] {
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

  const angV = (ux: number, uy: number, vx: number, vy: number): number => {
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
  const results: BezierSegment[] = [];

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

export { blobToDataUrl };
