// SPDX-License-Identifier: MPL-2.0
/**
 * SVG DOM → EMF intermediate representation (IR).
 *
 * Walks a rendered SVG element into the flat, device-pixel, sRGB, alpha-composited
 * IR that engine/src/emf.js serializes. Mirrors drawSvgVectorsInRegion in
 * export.js (viewBox mapping, <g> translate+scale incl. d3.zoom, non-scaling
 * stroke) but emits IR prims instead of jsPDF calls - and, critically, ALWAYS
 * outlines <text> to vector paths via host.text.toPath (the "always text-as-paths"
 * rule). A <text> run that can't be vectorized throws, so EMF never ships a
 * partially-textless file. See plans/63-emf-support.md.
 *
 * Every shape (rect/circle/ellipse/line/polygon/polyline) is expressed as an SVG
 * `d` string and run through the shared engine tokenizer (parseSvgPath), so there
 * is one geometry path for the whole walk.
 *
 * Catalog font resolution lives in the shell (text-svg.ts), never the engine.
 * This module is DOM-light: it only reads attributes + (optionally) computed
 * style, so it runs under jsdom for native-SVG tools in the CLI - except the
 * text outlining, which needs host.text (absent in the lean CLI).
 *
 * MOVED here from `shells/web/src/bridge/svg-ir.ts` (plans/202 WP1.1). `shells/cli`
 * has always driven EMF/EPS/DXF/WMF through this walk, so it was importing it
 * across the submodule boundary. One thing had to change to make the move
 * honest: the walk used to reach the web shell's font registry directly, and the
 * registry reads IndexedDB and `document.fonts`. It is now INJECTED as
 * `ctx.resolveFont`, so the web shim hands over `resolveVectorFont` and the CLI -
 * which outlines its text upstream in svg-outline.ts, through host.text's own
 * headless registry - passes nothing and gets the same behaviour it had (the web
 * registry resolved nothing under jsdom anyway). No resolver means no outlining,
 * which is what `canVectoriseText` already reported.
 */

import { parseSvgPath, parseColorToSrgb8 } from '@lolly/engine';
import type { HostV1, TextPathResult } from '@lolly-tools/core/host-v1';
import type { PathSegment } from '../../../engine/src/svg-path.ts';
import type { VectorPathPrim, VectorImagePrim, VectorTextPrim, VectorPrim, Rgb } from '../../../engine/src/emf.ts';
import { gaussianShadowRings } from '../../../engine/src/css-box.ts';
import { canVectoriseText, featureSettingsToHb, letterSpacingPx } from './text-svg.ts';
import type { FontStyleSlice } from './text-svg.ts';

const SKIP = new Set(['defs', 'clippath', 'lineargradient', 'radialgradient',
  'symbol', 'style', 'script', 'title', 'desc', 'metadata', 'filter', 'mask']);

// ─── colour ───────────────────────────────────────────────────────────────────

type RgbTuple = [number, number, number];

// Parse an SVG/CSS colour to [r,g,b], or null for none/transparent/unparseable.
// The engine's CSS Color 4 parser is the single source of truth (this file used to
// carry a 12-name table and a legacy-rgb regex, so oklch()/oklab()/color() paints
// vanished from EMF). `currentColor` is the one case it can't answer - its value
// depends on inherited state - and EMF's walk resolves it to black as before.
export function parseColor(input: string | null | undefined): RgbTuple | null {
  if (!input) return null;
  if (String(input).trim().toLowerCase() === 'currentcolor') return [0, 0, 0];
  const c = parseColorToSrgb8(input);
  return c ? [c[0], c[1], c[2]] : null;
}

// Composite a colour over an opaque background by its alpha (source-over flatten).
// EMF has no per-path alpha, so opacity collapses to a solid here.
function flatten(rgb: RgbTuple, alpha: number, bg: RgbTuple): RgbTuple {
  if (alpha >= 0.999) return rgb;
  return [
    Math.round(rgb[0] * alpha + bg[0] * (1 - alpha)),
    Math.round(rgb[1] * alpha + bg[1] * (1 - alpha)),
    Math.round(rgb[2] * alpha + bg[2] * (1 - alpha)),
  ];
}

const rgbObj = ([r, g, b]: RgbTuple): Rgb => ({ r, g, b });

// ─── style resolution ─────────────────────────────────────────────────────────

type StyleMap = Record<string, string | undefined>;

function parseStyleAttr(el: Element): StyleMap {
  const s = el.getAttribute?.('style');
  if (!s) return {};
  const out: StyleMap = {};
  for (const decl of s.split(';')) {
    const i = decl.indexOf(':');
    if (i > 0) out[decl.slice(0, i).trim().toLowerCase()] = decl.slice(i + 1).trim();
  }
  return out;
}

// Property precedence: inline style > presentation attribute > inherited.
function prop(el: Element, style: StyleMap, name: string, inherited?: StyleMap | null): string | undefined {
  return style[name] ?? el.getAttribute?.(name) ?? inherited?.[name];
}

// length, resolving a % against `total`.
function len(v: string | undefined, total = 0): number {
  if (v == null) return 0;
  const s = String(v).trim();
  if (s.endsWith('%')) return (parseFloat(s) / 100) * total;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

// ─── shape → SVG `d` builders (reused through parseSvgPath) ─────────────────────

function rectPath(x: number, y: number, w: number, h: number, rx: number, ry: number): string {
  if (w <= 0 || h <= 0) return '';
  if (rx > 0 || ry > 0) {
    rx = Math.min(rx || ry, w / 2); ry = Math.min(ry || rx, h / 2);
    return `M${x + rx},${y} H${x + w - rx} A${rx},${ry} 0 0 1 ${x + w},${y + ry}` +
           ` V${y + h - ry} A${rx},${ry} 0 0 1 ${x + w - rx},${y + h}` +
           ` H${x + rx} A${rx},${ry} 0 0 1 ${x},${y + h - ry}` +
           ` V${y + ry} A${rx},${ry} 0 0 1 ${x + rx},${y} Z`;
  }
  return `M${x},${y} H${x + w} V${y + h} H${x} Z`;
}

const circlePath = (cx: number, cy: number, r: number): string =>
  r <= 0 ? '' : `M${cx - r},${cy} A${r},${r} 0 1 0 ${cx + r},${cy} A${r},${r} 0 1 0 ${cx - r},${cy} Z`;

const ellipsePath = (cx: number, cy: number, rx: number, ry: number): string =>
  (rx <= 0 || ry <= 0) ? '' : `M${cx - rx},${cy} A${rx},${ry} 0 1 0 ${cx + rx},${cy} A${rx},${ry} 0 1 0 ${cx - rx},${cy} Z`;

function pointsPath(str: string | null, close: boolean): string {
  const nums = (str || '').match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g);
  if (!nums || nums.length < 4) return '';
  let d = `M${nums[0]},${nums[1]}`;
  for (let i = 2; i + 1 < nums.length; i += 2) d += ` L${nums[i]},${nums[i + 1]}`;
  return d + (close ? ' Z' : '');
}

// ─── main walk ──────────────────────────────────────────────────────────────

/** A 2-D affine matrix [[a c e][b d f]] mapping user coords → group space:
 *  x' = a·x + c·y + e,  y' = b·x + d·y + f. Carried down the walk as the CTM.
 *  A full matrix (not a translate+scale accumulator) so rotation/skew survive. */
export interface Mat {
  a: number; b: number; c: number; d: number; e: number; f: number;
}
const IDENTITY: Mat = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/** m ∘ n - apply n first, then m (SVG transform-list composition order). */
function matMul(m: Mat, n: Mat): Mat {
  return {
    a: m.a * n.a + m.c * n.b,
    b: m.b * n.a + m.d * n.b,
    c: m.a * n.c + m.c * n.d,
    d: m.b * n.c + m.d * n.d,
    e: m.a * n.e + m.c * n.f + m.e,
    f: m.b * n.e + m.d * n.f + m.f,
  };
}

// Parse an SVG transform LIST into one matrix, composing each function in order.
// translate/scale reproduce the old accumulator exactly (verified); rotate - incl.
// the rotate(θ cx cy) pivot form - matrix, and skew are now honoured too, so
// rotated text (angled axis labels, word-cloud verticals) and tilted groups
// survive to EMF/WMF/EPS/DXF instead of flattening. Unknown functions are skipped.
export function parseTransformList(str: string): Mat {
  let m = IDENTITY;
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/gi;
  let hit: RegExpExecArray | null;
  while ((hit = re.exec(str))) {
    const fn = (hit[1] ?? '').toLowerCase();
    const a = (hit[2] ?? '').split(/[\s,]+/).map(parseFloat).filter((n) => !Number.isNaN(n));
    const g = (i: number, d: number): number => { const v = a[i]; return typeof v === 'number' && Number.isFinite(v) ? v : d; };
    let local: Mat | null = null;
    if (fn === 'translate') local = { ...IDENTITY, e: g(0, 0), f: g(1, 0) };
    else if (fn === 'scale') { const sx = g(0, 1); local = { ...IDENTITY, a: sx, d: a.length > 1 ? g(1, sx) : sx }; }
    else if (fn === 'rotate') {
      const rad = g(0, 0) * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
      const rot: Mat = { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
      // rotate(θ cx cy) == translate(cx,cy) · rotate(θ) · translate(-cx,-cy)
      if (a.length >= 3) { const cx = g(1, 0), cy = g(2, 0); local = matMul(matMul({ ...IDENTITY, e: cx, f: cy }, rot), { ...IDENTITY, e: -cx, f: -cy }); }
      else local = rot;
    }
    else if (fn === 'matrix' && a.length >= 6) local = { a: g(0, 1), b: g(1, 0), c: g(2, 0), d: g(3, 1), e: g(4, 0), f: g(5, 0) };
    else if (fn === 'skewx') local = { ...IDENTITY, c: Math.tan(g(0, 0) * Math.PI / 180) };
    else if (fn === 'skewy') local = { ...IDENTITY, b: Math.tan(g(0, 0) * Math.PI / 180) };
    if (local) m = matMul(m, local);
  }
  return m;
}

/**
 * Split an affine matrix into translate, rotation (degrees) and scale: the only form
 * a sink that can just translate/scale/rotate (the PDF nested-SVG walker in export.ts)
 * consumes. Exact for any non-skewing affine, as M = T(e,f) * R(theta) * S(sx,sy), with
 * the rotation pivot at the local origin AFTER the translate. A mirror (negative x scale
 * with no rotation) stays a negative scale instead of turning into a 180-degree rotation,
 * so the sink's reflection-handedness rule keeps working.
 * ponytail: skew is dropped (a translate/scale/rotate sink cannot draw it); give the
 * PDF sink a full-matrix CTM if a skewed nested SVG is ever added to the audit fixtures.
 */
export function decomposeAffine(m: Mat): { tx: number; ty: number; sx: number; sy: number; rotDeg: number } {
  let sx = Math.hypot(m.a, m.b);
  if (sx === 0) return { tx: m.e, ty: m.f, sx: 0, sy: 0, rotDeg: 0 };
  let rad = Math.atan2(m.b, m.a);
  if (m.b === 0 && m.a < 0) { sx = -sx; rad = 0; }
  const sy = (m.a * m.d - m.b * m.c) / sx;
  return { tx: m.e, ty: m.f, sx, sy, rotDeg: rad * 180 / Math.PI };
}

// Compose an element's own `transform` onto the inherited CTM. Applies to
// containers AND leaf drawables - a <path transform="translate() scale()">
// (brand-lockup's per-leaf layout) must scale/position like a <g> would.
function applyElementTransform(el: Element, t: Mat): Mat {
  const transform = el.getAttribute?.('transform') || '';
  return transform ? matMul(t, parseTransformList(transform)) : t;
}

/** Geometry closures + per-leaf opacity handed to emitText. */
interface LeafTextGeometry {
  mapPt: (x: number, y: number) => { x: number; y: number };
  gAvg: number;
  rAvg: number;
  elemOpacity: number;
  /** The leaf's composed CTM - the live-text branch reads rotation/skew off it. */
  et: Mat;
}

/**
 * The sfnt one text run outlines with, as this walk needs it. Structurally the
 * web shell's `VectorFont` (font-registry.ts) minus the identity field nothing
 * here reads, so that resolver passes straight in.
 */
export interface SvgIrFont {
  /** The font file host.text.toPath shapes with. */
  url: string;
  /** HarfBuzz variation strings for a variable face, e.g. `['wght=700']`. */
  variations?: string[];
  /** Sibling subsets of the same family, for characters `url` doesn't cover. */
  fallbacks?: Array<{ fontUrl: string; variations?: string[] }>;
}

/** Context the caller provides to resolve host services + environment. */
export interface SvgIrContext {
  host?: HostV1 | null;
  getComputedStyle?: (el: Element) => CSSStyleDeclaration;
  background?: string;
  /** Which font file backs an outlined run. The web shell passes its font
   *  registry; a shell with no registry passes nothing, and every <text> then
   *  takes the same route as an unresolvable family (see canVectoriseText). */
  resolveFont?: (style: FontStyleSlice, text: string) => Promise<SvgIrFont | null>;
  /** User-facing label for log/error text. Defaults to 'EMF'. */
  label?: string;
  /** 'outline' (default) shapes every <text> to paths via host.text - the
   *  original text-as-paths guarantee, still what WMF/EPS/DXF ask for. 'live'
   *  (the EMF default since 1.128) keeps a plain run as a `text` prim so the
   *  emitter writes a real font + string record and the run stays editable;
   *  anything GDI text can't express faithfully (tracking, OpenType features,
   *  a stroke, skew or non-uniform scale, a centred dominant-baseline) falls
   *  back to the outline path per run, so fidelity never regresses. */
  textMode?: 'outline' | 'live';
}

/** Normalized vector IR consumed by engine/src/emf.js and engine/src/eps.js. */
export interface VectorIrResult {
  width: number;
  height: number;
  prims: VectorPrim[];
}

// Decode an <image> href (a data:/blob: URL - e.g. the vector escape-hatch's PNG) to
// opaque RGB, compositing any alpha over `bg` (EMF/EPS have no alpha channel).
// Browser-only (canvas); returns null under jsdom (CLI) or on any failure, so the
// caller warns + skips rather than throwing.
async function decodeImageToRgb(href: string, bg: RgbTuple): Promise<{ w: number; h: number; rgb: Uint8Array } | null> {
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') return null;
  try {
    const blob = await (await fetch(href)).blob();
    const bmp = await createImageBitmap(blob);
    const w = bmp.width, h = bmp.height;
    if (!(w > 0 && h > 0)) { bmp.close?.(); return null; }
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const cx = canvas.getContext('2d', { willReadFrequently: true });
    if (!cx) { bmp.close?.(); return null; }
    cx.drawImage(bmp, 0, 0);
    bmp.close?.();
    const data = cx.getImageData(0, 0, w, h).data;   // RGBA
    const rgb = new Uint8Array(w * h * 3);
    const [br, bgn, bb] = bg;
    for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
      const a = data[i + 3]! / 255, ia = 1 - a;
      rgb[j]     = Math.round(data[i]!     * a + br  * ia);
      rgb[j + 1] = Math.round(data[i + 1]! * a + bgn * ia);
      rgb[j + 2] = Math.round(data[i + 2]! * a + bb  * ia);
    }
    return { w, h, rgb };
  } catch { return null; }
}

/**
 * @param {Element} svgEl  the root <svg>
 * @param {object} ctx     { host, getComputedStyle, background }
 * @returns {Promise<{width,height,prims}>}
 */
/** A drop shadow recovered from an SVG `<filter>`. Lengths are USER units. */
export interface SvgDropShadow { dx: number; dy: number; stdDeviation: number; rgb: RgbTuple; alpha: number }

/**
 * Recognise a drop-shadow `<filter>`.
 *
 * EMF, EPS and DXF have no filter primitive, so `<filter>` is in SKIP and every
 * shadow used to vanish from those exports - including from the Penpot plugin, whose
 * entire input is Penpot's SVG and whose shadows arrive exactly this way.
 *
 * Two spellings are accepted: the `feDropShadow` shorthand, and the classic chain
 * (`feGaussianBlur` + `feOffset` + `feFlood` + composite) that most tools, Penpot
 * included, still emit. The parse is deliberately tolerant - it reads the first blur,
 * the first offset and the flood colour, and ignores the plumbing between them - 
 * because the goal is "is this a drop shadow, and roughly what one", not a filter
 * interpreter. Anything with primitives we do not expect returns null and is left
 * alone rather than approximated into something wrong.
 */
export function parseSvgDropShadow(filt: Element): SvgDropShadow | null {
  const kids = Array.from(filt.children).map((c) => c.tagName.toLowerCase().replace(/^svg:/, ''));
  // Primitives that change the picture in ways a shadow ramp cannot stand in for.
  const UNEXPECTED = ['fetile', 'feturbulence', 'fedisplacementmap', 'feimage', 'femorphology',
                      'feconvolvematrix', 'fediffuselighting', 'fespecularlighting', 'fecomponenttransfer'];
  if (kids.some((k) => UNEXPECTED.includes(k))) return null;

  const num = (el: Element | undefined, attr: string, dflt: number) => {
    const v = Number.parseFloat(el?.getAttribute(attr) ?? '');
    return Number.isFinite(v) ? v : dflt;
  };
  const find = (name: string) => Array.from(filt.children)
    .find((c) => c.tagName.toLowerCase().replace(/^svg:/, '') === name);

  const ds = find('fedropshadow');
  if (ds) {
    const rgb = parseColor(ds.getAttribute('flood-color') ?? '#000');
    if (!rgb) return null;
    // stdDeviation may be "x y"; the ramp is isotropic, so take the larger.
    const sd = (ds.getAttribute('stdDeviation') ?? '2').trim().split(/[\s,]+/).map(Number.parseFloat);
    return {
      dx: num(ds, 'dx', 2), dy: num(ds, 'dy', 2),
      stdDeviation: Math.max(...sd.filter(Number.isFinite), 0),
      rgb, alpha: num(ds, 'flood-opacity', 1),
    };
  }

  const blur = find('fegaussianblur');
  if (!blur) return null;
  const sd = (blur.getAttribute('stdDeviation') ?? '0').trim().split(/[\s,]+/).map(Number.parseFloat);
  const stdDeviation = Math.max(...sd.filter(Number.isFinite), 0);
  const off = find('feoffset');
  const flood = find('feflood');
  // Colour: an feFlood states it outright. Without one the chain is tinting
  // SourceAlpha, which is black unless an feColorMatrix says otherwise; black is the
  // overwhelmingly common case and a wrong-coloured shadow is worse than none, so a
  // chain with a colour matrix but no flood is declined.
  let rgb: RgbTuple | null = flood ? parseColor(flood.getAttribute('flood-color') ?? '#000') : null;
  let alpha = flood ? num(flood, 'flood-opacity', 1) : 1;
  if (!flood) {
    if (kids.includes('fecolormatrix')) return null;
    rgb = [0, 0, 0];
  }
  if (!rgb) return null;
  if (!(stdDeviation > 0) && !off) return null;   // neither blurred nor offset: not a shadow
  return { dx: num(off, 'dx', 0), dy: num(off, 'dy', 0), stdDeviation, rgb, alpha };
}

export async function svgDomToIr(svgEl: Element, ctx: SvgIrContext = {}): Promise<VectorIrResult> {
  const { host, getComputedStyle } = ctx;
  // User-facing label for log/error text. Defaults to 'EMF' so existing callers
  // (which pass no label) read exactly as before; the EPS sink passes 'EPS'.
  const LABEL = ctx.label || 'EMF';
  const bg: RgbTuple = ctx.background ? (parseColor(ctx.background) ?? [255, 255, 255]) : [255, 255, 255];

  // viewBox: prefer the live SVGRect (browser), fall back to parsing the
  // attribute string - jsdom often leaves viewBox.baseVal unimplemented, so the
  // CLI path must read the attribute (qr-code relies on it).
  const base = (svgEl as Element & { viewBox?: SVGAnimatedRect }).viewBox?.baseVal;
  let vbX = 0, vbY = 0, vbW = 0, vbH = 0, hasVb = false;
  if (base && base.width > 0 && base.height > 0) {
    ({ x: vbX, y: vbY, width: vbW, height: vbH } = base); hasVb = true;
  } else {
    const a = (svgEl.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    if (a.length === 4 && a.every(Number.isFinite) && a[2]! > 0 && a[3]! > 0) {
      [vbX, vbY, vbW, vbH] = a as [number, number, number, number]; hasVb = true;
    }
  }
  // A px width/height attribute (no '%') gives the canvas size; otherwise fall
  // back to the viewBox (qr-code uses width="100%" + viewBox, so parseFloat alone
  // would wrongly yield 100).
  const pxAttr = (name: string): number => {
    const a = svgEl.getAttribute(name);
    if (!a || /%/.test(a)) return NaN;
    const n = parseFloat(a);
    return Number.isFinite(n) && n > 0 ? n : NaN;
  };
  if (!hasVb) { vbW = pxAttr('width') || 0; vbH = pxAttr('height') || 0; }
  const canvasW = pxAttr('width') || vbW;
  const canvasH = pxAttr('height') || vbH;
  if (!(vbW > 0 && vbH > 0)) {
    throw new Error(`${LABEL} export: SVG has no usable size (need a viewBox or width/height)`);
  }
  const regX = canvasW / vbW;
  const regY = canvasH / vbH;

  const prims: VectorPrim[] = [];
  const textApi = host?.text || null;
  const liveText = ctx.textMode === 'live';
  // <filter> defs, indexed by id. SKIP keeps the walk out of <defs>, so the only way
  // to see them is to look them up by the id a shape references.
  const filterCache = new Map<string, SvgDropShadow | null>();
  const resolveDropShadow = (el: Element): SvgDropShadow | null => {
    const raw = el.getAttribute('filter')
      || (getComputedStyle ? safeComputed(getComputedStyle, el)?.filter : '')
      || '';
    const m = /url\(\s*['"]?#([^)'"\s]+)/.exec(raw);
    if (!m) return null;
    const id = m[1]!;
    if (filterCache.has(id)) return filterCache.get(id)!;
    const def = el.ownerDocument?.getElementById(id) ?? svgEl.querySelector(`#${CSS.escape(id)}`);
    const parsed = def && def.tagName.toLowerCase().replace(/^svg:/, '') === 'filter'
      ? parseSvgDropShadow(def) : null;
    if (!parsed) warn(`filter #${id} is not a drop shadow - left out of this format`);
    filterCache.set(id, parsed);
    return parsed;
  };
  const warn = (m: string) => host?.log?.('warn', `${LABEL.toLowerCase()}: ${m}`);

  // et is the CTM (a full affine, so rotation/skew survive); the closure maps a
  // user coord through it, then viewBox offset + region scale, to device px.
  async function visit(el: Element, t: Mat, inherited: StyleMap | null): Promise<void> {
    if (!el.tagName) return;
    const tag = el.tagName.toLowerCase().replace(/^svg:/, '');
    if (SKIP.has(tag)) return;

    // Compose this element's own transform onto the inherited CTM. Containers pass
    // it to their children; leaf drawables map their own geometry through it (so a
    // per-leaf `transform` is honoured, not silently dropped).
    const et = applyElementTransform(el, t);
    const mapPt = (x: number, y: number) => ({
      x: (et.a * x + et.c * y + et.e - vbX) * regX,
      y: (et.b * x + et.d * y + et.f - vbY) * regY,
    });
    // Per-axis scale magnitudes (rotation-invariant) for stroke width, radii, images.
    const sxLen = Math.hypot(et.a, et.b);
    const syLen = Math.hypot(et.c, et.d);
    const gAvg = (sxLen + syLen) / 2;
    const rAvg = (regX + regY) / 2;

    if (tag === 'g' || tag === 'a' || tag === 'svg') {
      const style = parseStyleAttr(el);
      const inh: StyleMap = {
        fill: prop(el, style, 'fill', inherited),
        stroke: prop(el, style, 'stroke', inherited),
        'fill-opacity': prop(el, style, 'fill-opacity', inherited),
        'stroke-opacity': prop(el, style, 'stroke-opacity', inherited),
        'fill-rule': prop(el, style, 'fill-rule', inherited),
        'stroke-width': prop(el, style, 'stroke-width', inherited),
        opacity: undefined, // group opacity does not inherit as a property; applied per-leaf
      };
      for (const child of el.children) await visit(child, et, inh);
      return;
    }

    // ── leaf shapes: build a `d`, resolve paint, emit a path prim ──
    const style = parseStyleAttr(el);
    const elemOpacity = parseFloat(prop(el, style, 'opacity', null) ?? '1');
    if (elemOpacity < 0.01) return;

    let d = '';
    let forceStrokeOnly = false;
    if (tag === 'path')        d = el.getAttribute('d') || '';
    else if (tag === 'rect')   d = rectPath(len(prop(el, style, 'x'), vbW), len(prop(el, style, 'y'), vbH),
                                            len(prop(el, style, 'width'), vbW), len(prop(el, style, 'height'), vbH),
                                            len(prop(el, style, 'rx')), len(prop(el, style, 'ry') ?? prop(el, style, 'rx')));
    else if (tag === 'circle') d = circlePath(len(prop(el, style, 'cx'), vbW), len(prop(el, style, 'cy'), vbH), len(prop(el, style, 'r'), vbW));
    else if (tag === 'ellipse') d = ellipsePath(len(prop(el, style, 'cx'), vbW), len(prop(el, style, 'cy'), vbH), len(prop(el, style, 'rx'), vbW), len(prop(el, style, 'ry'), vbH));
    else if (tag === 'polygon') d = pointsPath(el.getAttribute('points'), true);
    else if (tag === 'polyline') d = pointsPath(el.getAttribute('points'), false);
    else if (tag === 'line') { d = `M${len(prop(el, style, 'x1'), vbW)},${len(prop(el, style, 'y1'), vbH)} L${len(prop(el, style, 'x2'), vbW)},${len(prop(el, style, 'y2'), vbH)}`; forceStrokeOnly = true; }
    else if (tag === 'text') { await emitText(el, style, { mapPt, gAvg, rAvg, elemOpacity, et }); return; }
    else if (tag === 'image') {
      // The vector rasterise escape-hatch (visitSvgNode) emits <image href="data:…">
      // for a node whose CSS the walker can't express. Decode it to an opaque RGB
      // prim so it survives to EMF/EPS bytes instead of being dropped. Everything
      // vectorisable stays a path - this is the last resort.
      const href = el.getAttribute('href') || el.getAttribute('xlink:href')
        || el.getAttributeNS?.('http://www.w3.org/1999/xlink', 'href') || '';
      if (!href) { warn('image with no href (skipped)'); return; }
      const dec = await decodeImageToRgb(href, bg);
      if (!dec) { warn('image could not be rasterised for this format (skipped)'); return; }
      const { x: bx, y: by } = mapPt(len(prop(el, style, 'x'), vbW), len(prop(el, style, 'y'), vbH));
      const bw = len(prop(el, style, 'width'), vbW) * sxLen * regX;
      const bh = len(prop(el, style, 'height'), vbH) * syLen * regY;
      if (bw < 0.5 || bh < 0.5) return;
      // Honour preserveAspectRatio. The escape-hatch always emits 'none' with a box
      // matched to the node (so none == meet there). Tool-authored <image>s (tool-logo,
      // asset-export, filter-*) use the SVG default 'meet' → fit the source aspect
      // inside the box and align (default xMidYMid = centred) so a non-square asset
      // letterboxes instead of squishing. 'slice' is approximated as meet (EMF/EPS
      // can't cheaply source-crop) - aspect preserved, no distortion.
      const par = (prop(el, style, 'preserveAspectRatio') || 'xMidYMid meet').trim();
      let x = bx, y = by, w = bw, h = bh;
      if (!/^none/i.test(par) && dec.w > 0 && dec.h > 0) {
        const scale = Math.min(bw / dec.w, bh / dec.h);
        w = dec.w * scale; h = dec.h * scale;
        const ax = /xMin/i.test(par) ? 0 : /xMax/i.test(par) ? 1 : 0.5;
        const ay = /YMin/i.test(par) ? 0 : /YMax/i.test(par) ? 1 : 0.5;
        x = bx + (bw - w) * ax;
        y = by + (bh - h) * ay;
      }
      prims.push({ type: 'image', x, y, w, h, pxW: dec.w, pxH: dec.h, rgb: dec.rgb });
      return;
    }
    else if (tag === 'use') { warn('use elements are not supported (skipped)'); return; }
    else { for (const child of el.children || []) await visit(child, t, inherited); return; }

    if (!d || !d.trim()) return;

    // paint
    const fillStr = forceStrokeOnly ? 'none' : (prop(el, style, 'fill', inherited) ?? 'black');
    const strokeStr = prop(el, style, 'stroke', inherited) ?? 'none';
    const fillOp = elemOpacity * parseFloat(prop(el, style, 'fill-opacity', inherited) ?? '1');
    const strkOp = elemOpacity * parseFloat(prop(el, style, 'stroke-opacity', inherited) ?? '1');
    let fillRgb = fillOp >= 0.01 ? parseColor(fillStr) : null;
    let strokeRgb = strkOp >= 0.01 ? parseColor(strokeStr) : null;
    if (!fillRgb && !strokeRgb) return;
    if (fillRgb) fillRgb = flatten(fillRgb, fillOp, bg);
    if (strokeRgb) strokeRgb = flatten(strokeRgb, strkOp, bg);

    // non-scaling-stroke (street-map roads) keeps user-unit width through the
    // group transform → region scale only; otherwise group×region scale.
    const nonScaling = (prop(el, style, 'vector-effect', inherited)) === 'non-scaling-stroke';
    const strokeMul = (nonScaling ? 1 : gAvg) * rAvg;
    const strokeWidth = parseFloat(prop(el, style, 'stroke-width', inherited) ?? '1') * strokeMul;

    const subpaths = parseSvgPath(d).map(sub => ({
      closed: sub.closed,
      segments: sub.segments.map(seg => mapSeg(seg, mapPt)),
    }));
    if (!subpaths.length) return;

    // ── drop-shadow filter → a vector ramp ─────────────────────────────────────
    // These formats have no blur, but a blur is reproducible as concentric bands of
    // decreasing coverage (engine gaussianShadowRings). The bands are drawn as
    // STROKES of the shape's own outline rather than as offset copies of it: a stroke
    // of width 2t covers exactly the t-wide margin on either side, which gives the
    // outset for free and - unlike offsetting - works on an arbitrary path. Offsetting
    // a general path needs a boolean geometry library we do not have.
    //
    // Widest and lightest first, then narrower and darker, then the shadow's solid
    // core, then the shape itself on top. That ordering is what makes it correct here:
    // every prim is flattened to opaque against the page, so later ones simply cover
    // earlier ones and the ramp comes out right without any alpha compositing.
    const shadow = resolveDropShadow(el);
    if (shadow) {
      const rings = gaussianShadowRings(shadow.stdDeviation * 2, shadow.alpha);
      // The offset is a vector → transform by the linear part (a,b,c,d) only, no translation.
      const sdx = (et.a * shadow.dx + et.c * shadow.dy) * regX, sdy = (et.b * shadow.dx + et.d * shadow.dy) * regY;
      const shifted = subpaths.map((sub) => ({
        closed: sub.closed,
        segments: sub.segments.map((seg) => shiftSeg(seg, sdx, sdy)),
      }));
      const scale = gAvg * rAvg;
      for (const ring of rings) {
        const col = flatten(shadow.rgb, ring.alpha, bg);
        if (ring.inner === null) {
          // The core: solid, and filled rather than stroked.
          prims.push({ type: 'path', subpaths: shifted, fill: rgbObj(col), stroke: null, fillRule: 'nonzero' });
          continue;
        }
        const width = 2 * ring.outer * scale;
        if (width < 0.5) continue;
        prims.push({ type: 'path', subpaths: shifted, fill: null,
                     stroke: { ...rgbObj(col), width }, fillRule: 'nonzero' });
      }
      if (!rings.length) {
        // Offset with no blur: one solid copy, exact.
        prims.push({ type: 'path', subpaths: shifted,
                     fill: rgbObj(flatten(shadow.rgb, shadow.alpha, bg)), stroke: null, fillRule: 'nonzero' });
      }
    }

    prims.push({
      type: 'path',
      subpaths,
      fill: fillRgb ? rgbObj(fillRgb) : null,
      stroke: strokeRgb ? { ...rgbObj(strokeRgb), width: Math.max(1, strokeWidth) } : null,
      fillRule: (prop(el, style, 'fill-rule', inherited) === 'evenodd') ? 'evenodd' : 'nonzero',
    });
  }

  // Try to express one <text> run as a LIVE text prim (textMode 'live'). Returns
  // null whenever any aspect needs the outline fallback - deliberately
  // conservative, because the null paths are exactly the runs whose look
  // depends on shaping the outline path would otherwise bake in.
  function liveTextPrim(el: Element, style: StyleMap, m: LeafTextGeometry, r: {
    raw: string; rgb: RgbTuple; family: string; weight: string; italic: boolean;
    fontSize: number; letterSpacingCss: string | null | undefined; cs: CSSStyleDeclaration | null;
  }): VectorTextPrim | null {
    // GDI text has no stroke, no tracking, no OpenType feature toggles.
    const strokeStr = prop(el, style, 'stroke', null);
    if (strokeStr && parseColor(strokeStr)) return null;
    if (letterSpacingPx(r.letterSpacingCss)) return null;
    const feats = prop(el, style, 'font-feature-settings', null) ?? r.cs?.fontFeatureSettings;
    if (feats && feats !== 'normal') return null;
    // Vertical alignment: GDI has TA_BASELINE and TA_TOP; a centred baseline
    // (d3 tick labels' dominant-baseline:central) has no counterpart.
    const domBase = (prop(el, style, 'dominant-baseline', null) ?? r.cs?.dominantBaseline ?? '').trim();
    let baseline: 'alphabetic' | 'top';
    if (domBase === 'text-before-edge' || domBase === 'hanging') baseline = 'top';
    else if (!domBase || domBase === 'auto' || domBase === 'alphabetic') baseline = 'alphabetic';
    else return null;
    // The CTM must be a similarity transform: escapement carries rotation, but
    // GDI text has no skew and no anisotropic scale.
    const { et } = m;
    const sx = Math.hypot(et.a, et.b), sy = Math.hypot(et.c, et.d);
    if (!(sx > 0 && sy > 0)) return null;
    if (Math.abs(et.a * et.c + et.b * et.d) / (sx * sy) > 0.001) return null;  // skew
    if (Math.abs(sx - sy) / Math.max(sx, sy) > 0.01) return null;              // anisotropic transform
    if (Math.abs(regX - regY) / Math.max(regX, regY) > 0.01) return null;      // anisotropic region scale
    const rotation = Math.atan2(et.b, et.a) * 180 / Math.PI;

    // An empty/unresolvable family stays live with an EMPTY face name - legal
    // GDI for "the renderer's default font". Substitution is the live contract;
    // the outline path would just throw here (no font to shape with), costing
    // the CLI a Chromium escalation for a run that reads fine either way.
    const face = gdiFaceName(r.family) ?? '';
    if (!face) warn(`live text run "${r.raw.slice(0, 24)}" has no resolvable font-family - the reader's default font will render it`);

    const wRaw = r.weight.trim().toLowerCase();
    const weightNum = wRaw === 'bold' ? 700 : Number.isFinite(parseFloat(wRaw)) ? Math.round(parseFloat(wRaw)) : 400;

    const { x, y } = m.mapPt(len(prop(el, style, 'x'), vbW), len(prop(el, style, 'y'), vbH));
    const anchor = prop(el, style, 'text-anchor', null) ?? r.cs?.textAnchor ?? 'start';
    return {
      type: 'text', x, y, text: r.raw,
      fontFamily: face,
      fontSize: r.fontSize * sx * regX,
      weight: weightNum, italic: r.italic,
      fill: rgbObj(r.rgb),
      align: anchor === 'middle' ? 'center' : anchor === 'end' ? 'right' : 'left',
      baseline,
      ...(Math.abs(rotation) > 0.01 ? { rotation } : {}),
    };
  }

  // Outline a <text> run to a filled path prim via host.text.toPath.
  async function emitText(el: Element, style: StyleMap, m: LeafTextGeometry): Promise<void> {
    const raw = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!raw) return;

    const fillStr = prop(el, style, 'fill', null) ?? '#000000';
    const opacity = m.elemOpacity * parseFloat(prop(el, style, 'fill-opacity', null) ?? prop(el, style, 'opacity', null) ?? '1');
    let rgb = opacity >= 0.01 ? parseColor(fillStr) : null;
    if (!rgb) return;
    rgb = flatten(rgb, opacity, bg);

    // Resolve font: attributes first, then computed style (chart-creator sets
    // font-family via a <style> block, not an attribute).
    const cs = getComputedStyle ? safeComputed(getComputedStyle, el) : null;
    const family = prop(el, style, 'font-family', null) ?? cs?.fontFamily ?? '';
    const weight = String(prop(el, style, 'font-weight', null) ?? cs?.fontWeight ?? '400');
    const italic = (prop(el, style, 'font-style', null) ?? cs?.fontStyle) === 'italic';
    const fontSize = parseFloat(prop(el, style, 'font-size', null) ?? cs?.fontSize ?? '16');
    const letterSpacingCss = prop(el, style, 'letter-spacing', null) ?? cs?.letterSpacing;

    // ── LIVE branch (EMF's default since 1.128): keep the run as a text prim so
    // the emitter writes a real GDI font + string record and it stays editable
    // in Office / Google Drawings. Needs NO host.text - the renderer's own
    // metrics lay the run out. Anything GDI text can't express faithfully falls
    // through to the outline path below, per run, so fidelity never regresses.
    if (liveText) {
      const live = liveTextPrim(el, style, m, { raw, rgb, family, weight, italic, fontSize, letterSpacingCss, cs });
      if (live) { prims.push(live); return; }
    }

    const fontStyleObj = { fontFamily: family, fontWeight: weight, fontStyle: italic ? 'italic' : 'normal',
      letterSpacing: letterSpacingCss };
    // The brand statics, the user's own Google fonts, or the platform face - this
    // format has no <text> fallback, so an unresolvable family is fatal.
    const vf = (textApi && ctx.resolveFont) ? await ctx.resolveFont(fontStyleObj, raw) : null;
    const fontUrl = vf?.url ?? null;

    if (!canVectoriseText(fontStyleObj, fontUrl, Boolean(textApi))) {
      throw new Error(
        `${LABEL} export requires outlined text, but the run "${raw.slice(0, 24)}" could not be ` +
        `vectorized (font-family "${family || 'inherited'}"${textApi ? '' : '; no text-shaping in this shell'}). ` +
        `Add the font under Profile → Your brand, or export SVG/PDF.`);
    }

    // Tracking + OpenType feature toggles bake into the shaped path (kept outlined).
    const letterSpacing = letterSpacingPx(letterSpacingCss);
    const features = featureSettingsToHb(prop(el, style, 'font-feature-settings', null) ?? cs?.fontFeatureSettings);

    let result: TextPathResult;
    try {
      result = await textApi!.toPath({ text: raw, fontUrl: fontUrl!, fontSize, features: features as string[], letterSpacing, variations: vf!.variations, fallbackFonts: vf!.fallbacks });
    } catch (e) {
      throw new Error(`EMF export: text shaping failed for "${raw.slice(0, 24)}" - ${(e as Error).message}`);
    }
    if (!result?.d) return;            // whitespace-only / no glyphs

    const x = len(prop(el, style, 'x'), vbW);
    const y = len(prop(el, style, 'y'), vbH);
    const anchor = prop(el, style, 'text-anchor', null) ?? cs?.textAnchor ?? 'start';
    const adv = result.advanceWidth || 0;
    const xAdj = anchor === 'middle' ? x - adv / 2 : anchor === 'end' ? x - adv : x;

    // toPath `d` has baseline at y=0; place each glyph point at (xAdj+gx, y+gy)
    // in user space, then map through the group/region transform.
    const place = (gx: number, gy: number) => m.mapPt(xAdj + gx, y + gy);
    const subpaths = parseSvgPath(result.d).map(sub => ({
      closed: true,                    // glyph contours are always closed fills
      segments: sub.segments.map(seg => mapSeg(seg, place)),
    }));
    if (!subpaths.length) return;

    // Capture text stroke (outline) just like regular paths do.
    const strokeStr = prop(el, style, 'stroke', null);
    const strokeRgb = strokeStr ? parseColor(strokeStr) : null;
    const strokeOpacity = m.elemOpacity * parseFloat(prop(el, style, 'stroke-opacity', null) ?? prop(el, style, 'opacity', null) ?? '1');
    let stroke: { r: number; g: number; b: number; width: number } | null = null;
    if (strokeRgb && strokeOpacity >= 0.01) {
      const flatStroke = flatten(strokeRgb, strokeOpacity, bg);
      const nonScaling = (prop(el, style, 'vector-effect', null)) === 'non-scaling-stroke';
      const strokeMul = (nonScaling ? 1 : m.gAvg) * m.rAvg;
      const strokeWidth = parseFloat(prop(el, style, 'stroke-width', null) ?? cs?.strokeWidth ?? '1') * strokeMul;
      stroke = flatStroke ? { ...rgbObj(flatStroke), width: Math.max(1, strokeWidth) } : null;
    }

    prims.push({ type: 'path', subpaths, fill: rgbObj(rgb), stroke, fillRule: 'nonzero' });
  }

  await visit(svgEl, IDENTITY, null);

  return { width: Math.round(canvasW), height: Math.round(canvasH), prims };
}

function mapSeg(seg: PathSegment, mapPt: (x: number, y: number) => { x: number; y: number }): PathSegment {
  if (seg.op === 'C') {
    const a = mapPt(seg.x1, seg.y1), b = mapPt(seg.x2, seg.y2), c = mapPt(seg.x, seg.y);
    return { op: 'C', x1: a.x, y1: a.y, x2: b.x, y2: b.y, x: c.x, y: c.y };
  }
  const p = mapPt(seg.x, seg.y);
  return { op: seg.op, x: p.x, y: p.y } as PathSegment;
}

/** Translate an already-device-mapped segment. Used for the shadow offset, which is
 *  applied after mapping so it does not have to be threaded through the CTM. */
function shiftSeg(seg: PathSegment, dx: number, dy: number): PathSegment {
  if (seg.op === 'C') {
    return { op: 'C', x1: seg.x1 + dx, y1: seg.y1 + dy, x2: seg.x2 + dx, y2: seg.y2 + dy, x: seg.x + dx, y: seg.y + dy };
  }
  return { op: seg.op, x: seg.x + dx, y: seg.y + dy } as PathSegment;
}

function safeComputed(fn: (el: Element) => CSSStyleDeclaration, el: Element): CSSStyleDeclaration | null {
  try { return fn(el); } catch { return null; }
}

// First concrete face of a CSS font-family stack, unquoted, as a GDI face name.
// CSS generics map to the face Windows-era renderers actually carry - a live
// record naming a literal "sans-serif" would substitute unpredictably. A Map,
// not an object literal, so a family named "constructor" can't walk the prototype.
const GENERIC_FACES = new Map<string, string>([
  ['sans-serif', 'Arial'], ['serif', 'Times New Roman'], ['monospace', 'Courier New'],
  ['cursive', 'Comic Sans MS'], ['fantasy', 'Impact'], ['system-ui', 'Segoe UI'],
  ['ui-sans-serif', 'Segoe UI'], ['ui-serif', 'Times New Roman'], ['ui-monospace', 'Consolas'],
]);
function gdiFaceName(stack: string): string | null {
  const first = (stack || '').split(',')[0]?.trim().replace(/^['"]+|['"]+$/g, '').trim();
  if (!first) return null;
  return GENERIC_FACES.get(first.toLowerCase()) ?? first;
}
