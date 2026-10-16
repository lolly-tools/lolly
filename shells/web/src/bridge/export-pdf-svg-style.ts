// SPDX-License-Identifier: MPL-2.0
/**
 * Paint and style for the PDF SVG painter (export-pdf-svg.ts).
 *
 * Styles are read the way the browser resolved them, through getComputedStyle, so a
 * presentation attribute, an inline style, a stylesheet class and inheritance all
 * count. The one place the browser's answer is wrong for drawing is a `<use>`
 * instance: the referenced element lives in `<defs>` and inherits from there, while
 * its drawn copy inherits from the `<use>`. StyleScope corrects that, so a `<use
 * fill="#78a3ad">` of a path that sets no fill of its own draws in that colour.
 *
 * Gradients become what the PDF writer can paint: a shading in gradient space, the
 * matrix to user space and the stop opacities as a grey ramp for a soft mask when
 * they vary.
 */
import { parseColorToSrgb8 } from '@lolly/engine';
import { len, diag, mul, parseTransform, IDENT, type Box, type Mat, type Viewport } from './export-pdf-svg-geom.ts';

/** Properties a child takes from its parent, and so from a `<use>` into its instance. */
const INHERITED = new Set([
  'fill', 'stroke', 'fill-opacity', 'stroke-opacity', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
  'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'fill-rule', 'clip-rule', 'color', 'paint-order',
  'visibility', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor',
  'marker-start', 'marker-mid', 'marker-end',
]);

/** Reads an element's style property from its style attribute only. */
export function resolveStyleProp(el: Element, prop: string): string | null {
  const styleAttr = el.getAttribute('style') ?? '';
  const m = styleAttr.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`));
  return m ? m[1]!.trim() : null;
}

/** A `<use>` whose instance is being drawn, and the element its href points at. */
export interface UseFrame { use: Element; root: Element }

/** Computed styles for one paint, with `<use>` instances inheriting from their `<use>`. */
export class StyleScope {
  private cache = new Map<Element, CSSStyleDeclaration>();
  readonly uses: UseFrame[] = [];

  private styleOf(el: Element): CSSStyleDeclaration {
    let s = this.cache.get(el);
    if (!s) { s = window.getComputedStyle(el); this.cache.set(el, s); }
    return s;
  }

  /** The computed value as the browser has it, for an element in the live tree. */
  raw(el: Element, prop: string): string {
    return this.styleOf(el).getPropertyValue(prop).trim();
  }

  /** Whether the element sets the property itself rather than taking its parent's value. */
  private declares(el: Element, prop: string): boolean {
    if (el.hasAttribute(prop) || resolveStyleProp(el, prop) != null) return true;
    const parent = el.parentElement;
    return !parent || this.raw(el, prop) !== this.raw(parent, prop);
  }

  /** A property's value for drawing `el`, inside however many `<use>` instances it is. */
  get(el: Element, prop: string, depth = this.uses.length): string {
    const own = this.raw(el, prop);
    if (!depth || !INHERITED.has(prop)) return own;
    const frame = this.uses[depth - 1]!;
    // Marker content drawn for a shape inside an instance is not part of that instance.
    if (!frame.root.contains(el)) return own;
    for (let node: Element | null = el; node; node = node.parentElement) {
      if (this.declares(node, prop)) return own;
      if (node === frame.root) break;
    }
    return this.get(frame.use, prop, depth - 1);
  }

  num(el: Element, prop: string, fallback: number): number {
    const v = parseFloat(this.get(el, prop));
    return Number.isFinite(v) ? v : fallback;
  }
}

export type Paint =
  | { kind: 'none' }
  | { kind: 'color'; rgb: [number, number, number]; alpha: number }
  | { kind: 'url'; id: string; fallback: Paint };

const NONE: Paint = { kind: 'none' };

/** A computed fill or stroke: none, a colour with its alpha or a reference with its fallback. */
export function parsePaint(value: string): Paint {
  const v = value.trim();
  if (!v || v === 'none') return NONE;
  const ref = /^url\(\s*(["']?)([^"')]*)\1\s*\)\s*(.*)$/i.exec(v);
  if (ref) {
    const hash = ref[2]!.lastIndexOf('#');
    return { kind: 'url', id: hash >= 0 ? ref[2]!.slice(hash + 1) : ref[2]!, fallback: parsePaint(ref[3] ?? '') };
  }
  const c = parseColorToSrgb8(v);
  return c ? { kind: 'color', rgb: [c[0], c[1], c[2]], alpha: c[3] } : NONE;
}

/** An element by id, in this picture first, then anywhere in the document. */
export function findById(root: Element, id: string): Element | null {
  if (!id) return null;
  try {
    return root.querySelector(`#${CSS.escape(id)}`) ?? root.ownerDocument?.getElementById(id) ?? null;
  } catch { return null; }
}

/** A gradient in the form the PDF writer paints. Colours are 0 to 255; alphas are 0 to 1. */
export interface ShadingSpec {
  type: 'axial' | 'radial';
  /** Gradient space: x1 y1 x2 y2, or fx fy fr cx cy r. */
  coords: number[];
  /** Gradient space to the user space of the element painted. */
  matrix: Mat;
  colors: { offset: number; color: number[] }[];
  /** The stop opacities when they differ, for a soft mask. */
  alphas: { offset: number; color: number[] }[] | null;
  /** The opacity every stop shares, multiplied into the fill alpha. */
  alpha: number;
}

export type GradientPaint =
  | { kind: 'shading'; spec: ShadingSpec }
  | { kind: 'color'; rgb: [number, number, number]; alpha: number }
  | { kind: 'none' }
  /** A reference the painter does not draw as a gradient, with the reason. */
  | { kind: 'unsupported'; reason: string };

/**
 * Resolve a gradient reference for an element whose object bounding box is `bbox`, in
 * a viewport `vp`. An href chain supplies attributes and stops the gradient leaves out,
 * as SVG says. A degenerate gradient paints its last stop, and one with no stops
 * paints nothing.
 */
export function resolveGradient(root: Element, id: string, bbox: Box | null, vp: Viewport, scope: StyleScope): GradientPaint {
  const first = findById(root, id);
  if (!first || !/^(linear|radial)Gradient$/.test(first.localName)) return { kind: 'unsupported', reason: first ? `<${first.localName}> paint` : 'missing paint server' };
  const chain: Element[] = [];
  for (let g: Element | null = first; g && chain.length < 8 && !chain.includes(g); ) {
    chain.push(g);
    const href: string = g.getAttribute('href') ?? g.getAttribute('xlink:href') ?? '';
    const next: Element | null = href.startsWith('#') ? findById(root, href.slice(1)) : null;
    g = next && /^(linear|radial)Gradient$/.test(next.localName) ? next : null;
  }
  const attr = (name: string): string | null => {
    for (const g of chain) { const v = g.getAttribute(name); if (v != null) return v; }
    return null;
  };
  if ((attr('spreadMethod') ?? 'pad') !== 'pad') return { kind: 'unsupported', reason: `spreadMethod ${attr('spreadMethod')}` };
  const stopsFrom = chain.find(g => g.querySelector(':scope > stop')) ?? first;
  let last = 0;
  const stops = [...stopsFrom.querySelectorAll(':scope > stop')].map((stop) => {
    const raw = stop.getAttribute('offset') ?? '0';
    let offset = raw.trim().endsWith('%') ? parseFloat(raw) / 100 : parseFloat(raw);
    offset = Math.max(last, Math.min(1, Number.isFinite(offset) ? offset : 0));
    last = offset;
    const c = parseColorToSrgb8(scope.raw(stop, 'stop-color'));
    const opacity = Math.max(0, Math.min(1, parseFloat(scope.raw(stop, 'stop-opacity')) || 0));
    return { offset, rgb: c ? [c[0], c[1], c[2]] as [number, number, number] : [0, 0, 0] as [number, number, number], alpha: c ? c[3] * opacity : 0 };
  });
  if (!stops.length) return { kind: 'none' };
  const lastStop = stops[stops.length - 1]!;
  const solid = (s: { rgb: [number, number, number]; alpha: number }): GradientPaint => (s.alpha > 0 ? { kind: 'color', rgb: s.rgb, alpha: s.alpha } : { kind: 'none' });
  if (stops.length === 1 || stops.every(s => s.rgb.join() === lastStop.rgb.join() && s.alpha === lastStop.alpha)) return solid(lastStop);

  const bboxUnits = (attr('gradientUnits') ?? 'objectBoundingBox') !== 'userSpaceOnUse';
  // Fractions of the bounding box, or user units with percentages of the viewport.
  const unitVp: Viewport = bboxUnits ? { w: 1, h: 1 } : vp;
  const L = (name: string, ref: number, fallback: string): number => {
    const raw = attr(name) ?? fallback;
    if (bboxUnits && !raw.trim().endsWith('%')) return parseFloat(raw) || 0;
    return len(raw, ref);
  };
  let matrix = IDENT;
  if (bboxUnits) {
    if (!bbox || !(bbox.w > 0) || !(bbox.h > 0)) return { kind: 'none' };
    matrix = { a: bbox.w, b: 0, c: 0, d: bbox.h, e: bbox.x, f: bbox.y };
  }
  const gt = parseTransform(attr('gradientTransform'));
  if (gt) matrix = mul(matrix, gt);

  let type: 'axial' | 'radial', coords: number[];
  if (first.localName === 'linearGradient') {
    type = 'axial';
    coords = [L('x1', unitVp.w, '0%'), L('y1', unitVp.h, '0%'), L('x2', unitVp.w, '100%'), L('y2', unitVp.h, '0%')];
    if (coords[0] === coords[2] && coords[1] === coords[3]) return solid(lastStop);
  } else {
    type = 'radial';
    const cx = L('cx', unitVp.w, '50%'), cy = L('cy', unitVp.h, '50%'), r = L('r', diag(unitVp), '50%');
    if (!(r > 0)) return solid(lastStop);
    let fx = attr('fx') != null ? L('fx', unitVp.w, '50%') : cx, fy = attr('fy') != null ? L('fy', unitVp.h, '50%') : cy;
    const fr = attr('fr') != null ? Math.max(0, L('fr', diag(unitVp), '0%')) : 0;
    // SVG 1.1 draws a focal point outside the end circle at its edge; PDF would draw a cone.
    const dx = fx - cx, dy = fy - cy, dist = Math.sqrt(dx * dx + dy * dy), limit = r * 0.999;
    if (dist > limit) { fx = cx + (dx * limit) / dist; fy = cy + (dy * limit) / dist; }
    coords = [fx, fy, Math.min(fr, r), cx, cy, r];
  }
  const alphas = stops.map(s => s.alpha);
  const varying = alphas.some(a => Math.abs(a - alphas[0]!) > 1e-4);
  return {
    kind: 'shading',
    spec: {
      type, coords, matrix,
      colors: stops.map(s => ({ offset: s.offset, color: s.rgb })),
      alphas: varying ? stops.map(s => ({ offset: s.offset, color: [Math.round(s.alpha * 255)] })) : null,
      alpha: varying ? 1 : alphas[0]!,
    },
  };
}
