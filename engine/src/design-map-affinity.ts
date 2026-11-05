// SPDX-License-Identifier: MPL-2.0
/**
 * An Affinity document model mapped to Design rows (K3, stage 2).
 *
 * The shell reads a native Affinity file with the bundled reader and hands the model, as the
 * reader's JSON, to this module together with a function that turns one of the model's pictures
 * into an asset reference. This module is pure: no reader, no DOM, no storage. Each artboard
 * becomes a frame (or, in a file with none, each spread); groups, shapes, curves, text, tables
 * and pictures become editable rows. What Design cannot carry is listed in the report, never
 * dropped silently.
 */
import { boxGeomFromBBox, nodeToBox, type DesignMapOptions, type DesignNode } from './design-map.ts';
import { convertColor } from './css-color.ts';
import { escapeMarkup, hugMarkers } from './design-text.ts';
import { encodeAuthoredPaths } from './geom/authored-url.ts';
import { formatGradientSpec, gradientSpecToCss, type GradientSpec } from './gradient-spec.ts';

// ── the reader's JSON ───────────────────────────────────────────────────────

export type Matrix6 = [number, number, number, number, number, number];
export type AffinityColor =
  | { model: 'rgb'; r: number; g: number; b: number; a: number }
  | { model: 'cmyk'; c: number; m: number; y: number; k: number; a: number }
  | { model: 'gray'; v: number; a: number }
  | { model: 'lab'; l: number; a: number; b: number; alpha: number };
export type AffinityPaint =
  | { t: 'none' }
  | { t: 'solid'; c: AffinityColor }
  | { t: 'gradient'; k: 'linear' | 'radial' | 'conical'; stops: { o: number; c: AffinityColor; bias: number }[]; tf: Matrix6 };
export interface AffinityStroke {
  paint: AffinityPaint; width: number; cap: 'butt' | 'round' | 'square'; join: 'miter' | 'round' | 'bevel';
  miter: number; align: 'center' | 'inside' | 'outside'; dash: [number[], number] | null; behind: boolean;
}
export interface AffinitySubPath { s: [number, number]; c: Matrix6[]; z: boolean }
export interface AffinityImage { w: number; h: number; tf: Matrix6; enc: 'png' | 'jpeg' | 'other'; cmyk: boolean; data: { o: number; l: number } | null }
export interface AffinityPara { align: string; left: number; right: number; first: number; before: number; after: number; leading: number | null; autoLeading: number }
export interface AffinityRun {
  text: string; postscript: string; family: string; weight: number; italic: boolean; features: string[];
  allCaps: boolean; underline: boolean; strike: boolean; size: number; tracking: number; hScale: number; leading: number | null;
  fill: AffinityPaint; stroke: AffinityStroke | null; para: AffinityPara;
}
export type Rect4 = [number, number, number, number];
export type AffinityKind =
  | { t: 'layer' } | { t: 'group' } | { t: 'unsupported' }
  | { t: 'artboard'; rect: Rect4; path: AffinitySubPath[]; evenOdd: boolean; background: AffinityPaint[]; strokes: AffinityStroke[] }
  | { t: 'shape'; path: AffinitySubPath[]; fills: AffinityPaint[]; strokes: AffinityStroke[]; evenOdd: boolean }
  | { t: 'text'; runs: AffinityRun[]; align: string; anchor: [number, number]; frame: Rect4 | null; tf: Matrix6; textTf: Matrix6 }
  | { t: 'table'; columns: number[]; rows: number[]; cells: { runs: AffinityRun[]; inset: Rect4; valign: string; mergedLeft: boolean }[]; vertical: (AffinityStroke | null)[]; horizontal: (AffinityStroke | null)[]; tf: Matrix6; textTf: Matrix6 }
  | ({ t: 'image' } & AffinityImage)
  | { t: 'master'; master: number; page: number; masterPage: number; count: number };
export type AffinityEffect =
  | { t: 'shadow'; inner: boolean; c: AffinityColor; opacity: number; radius: number; distance: number; angle: number }
  | { t: 'glow'; c: AffinityColor; opacity: number; radius: number }
  | { t: 'outline'; c: AffinityColor; opacity: number; width: number; align: number }
  | { t: 'bevel'; size: number }
  | { t: 'overlay'; paint: AffinityPaint; opacity: number; blend: string };
export interface AffinityNode {
  class: string; name: string; visible: boolean; locked: boolean; opacity: number; blend: string; kind: AffinityKind;
  mask: AffinitySubPath[] | null; pixelMask: AffinityImage | null; effects: AffinityEffect[]; children: AffinityNode[];
}
export interface AffinitySpread { bounds: Rect4; pages: Rect4[]; transparent: boolean; nodes: AffinityNode[] }
export interface AffinityModel {
  dpi: number; savedBy: string | null; warnings: string[]; cmykProfile: boolean; spreads: AffinitySpread[]; masters: AffinitySpread[];
}

// ── the result ──────────────────────────────────────────────────────────────

export interface AffinityFrame {
  name: string; width: number; height: number; background: string; boxes: Record<string, unknown>[];
  /** The frame's top-left corner in its spread's document pixels, and the spread it came from. */
  x: number; y: number; spread: number;
}
export type AffinityNoteKind = 'effect' | 'adjustment' | 'approximated' | 'dropped' | 'reader';
export interface AffinityNote { kind: AffinityNoteKind; text: string }
export interface AffinityMapResult { frames: AffinityFrame[]; report: AffinityNote[] }
export interface AffinityMapOptions {
  /** A stored asset for one of the model's pictures, or null when it cannot be placed. */
  image: (image: AffinityImage) => Promise<unknown | null> | unknown | null;
  map?: DesignMapOptions;
  /** Frames beyond this are left out, and said so. */
  maxFrames?: number;
}

const MAX_BOXES_PER_FRAME = 10_000;
const MAX_CANVAS_PIXELS = 32_000_000;

// ── small helpers ───────────────────────────────────────────────────────────

const r2 = (v: number): number => Math.round(v * 100) / 100;
const finite = (v: number): boolean => Number.isFinite(v);
const hex2 = (v: number): string => Math.max(0, Math.min(255, Math.round(v * 255))).toString(16).padStart(2, '0');
const scrub = (s: string): string => s.replace(/[,~]/g, ' ').replace(/\s+/g, ' ').trim();
const apply = (m: Matrix6, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const scaleOf = (m: Matrix6): number => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));

function rgbOf(c: AffinityColor): [number, number, number, number] {
  switch (c.model) {
    case 'rgb': return [c.r, c.g, c.b, c.a];
    case 'gray': return [c.v, c.v, c.v, c.a];
    case 'cmyk': {
      // Plain ink mixing: the document's colour profile is not applied.
      const k = 1 - c.k;
      return [(1 - c.c) * k, (1 - c.m) * k, (1 - c.y) * k, c.a];
    }
    case 'lab': {
      const out = convertColor({ space: 'lab', components: [c.l, c.a, c.b], alpha: 1, missing: 0 }, 'srgb').components;
      return [out[0]!, out[1]!, out[2]!, c.alpha];
    }
  }
}
function cssColor(c: AffinityColor, extraAlpha = 1): string {
  const [r, g, b, a0] = rgbOf(c);
  const a = Math.max(0, Math.min(1, a0 * extraAlpha));
  if (![r, g, b, a].every(finite)) return '#000000';
  return a >= 0.999 ? `#${hex2(r)}${hex2(g)}${hex2(b)}` : `#${hex2(r)}${hex2(g)}${hex2(b)}${hex2(a)}`;
}

const BLEND: Record<string, string> = {
  Normal: 'normal', PassThrough: 'normal', Darken: 'darken', Multiply: 'multiply', ColorBurn: 'color-burn', Lighten: 'lighten',
  Screen: 'screen', ColorDodge: 'color-dodge', Overlay: 'overlay', SoftLight: 'soft-light', HardLight: 'hard-light',
  Difference: 'difference', Exclusion: 'exclusion', Hue: 'hue', Saturation: 'saturation', Color: 'color', Luminosity: 'luminosity',
};

// ── the mapper ──────────────────────────────────────────────────────────────

interface Ctx {
  opts: AffinityMapOptions;
  notes: Map<string, AffinityNote & { n: number }>;
  nodes: DesignNode[];
  extras: Array<Record<string, unknown> | null>;
  origin: { x: number; y: number };
  dropped: number;
}
function note(ctx: { notes: Ctx['notes'] }, kind: AffinityNoteKind, text: string): void {
  const key = `${kind}:${text}`;
  const e = ctx.notes.get(key);
  if (e) e.n++; else ctx.notes.set(key, { kind, text, n: 1 });
}

/** The first usable paint of a list: Affinity keeps one active fill. */
function pickPaint(paints: AffinityPaint[]): AffinityPaint {
  return paints.find(p => p.t !== 'none') ?? { t: 'none' };
}

interface Fill { fill: string; grad: string }
function fillOf(ctx: Ctx, paint: AffinityPaint, extraAlpha = 1): Fill {
  if (paint.t === 'solid') return { fill: cssColor(paint.c, extraAlpha), grad: '' };
  if (paint.t !== 'gradient' || paint.stops.length === 0) return { fill: '', grad: '' };
  const [x0, y0] = apply(paint.tf, 0, 0), [x1, y1] = apply(paint.tf, 1, 0);
  const angle = (Math.atan2(x1 - x0, -(y1 - y0)) * 180) / Math.PI;
  const stops = paint.stops.map(s => ({ color: cssColor(s.c, extraAlpha), pos: Math.max(0, Math.min(100, s.o * 100)) }));
  if (stops.length === 1) return { fill: stops[0]!.color, grad: '' };
  if (paint.k === 'conical') note(ctx, 'approximated', 'Conical gradients imported as radial gradients');
  if (paint.stops.some(s => Math.abs(s.bias - 0.5) > 0.02)) note(ctx, 'approximated', 'Gradient midpoints moved to the centre of each step');
  const spec: GradientSpec = { kind: paint.k === 'linear' ? 'linear' : 'radial', angle: paint.k === 'linear' ? angle : 0, stops, space: 'srgb' };
  const spec2 = formatGradientSpec(spec);
  if (!gradientSpecToCss(spec2)) return { fill: stops[0]!.color, grad: '' };
  return { fill: stops[0]!.color, grad: spec2 };
}

function strokeFields(ctx: Ctx, s: AffinityStroke | undefined, opacity: number): Record<string, unknown> {
  if (!s || s.paint.t === 'none' || !(s.width > 0)) return {};
  let color = '';
  if (s.paint.t === 'solid') color = cssColor(s.paint.c, opacity);
  else if (s.paint.stops[0]) { color = cssColor(s.paint.stops[0].c, opacity); note(ctx, 'approximated', 'Gradient strokes imported as the first gradient colour'); }
  if (!color) return {};
  if (s.behind) note(ctx, 'approximated', 'Strokes set behind the fill are drawn over it');
  const out: Record<string, unknown> = { stroke: color, strokeW: r2(s.width), strokeCap: s.cap, strokeJoin: s.join };
  if (s.dash?.[0].length) {
    out.strokeDash = s.dash[0][0] === 0 ? 'dotted' : 'dashed';
    out.strokeDashArray = s.dash[0].map(r2).join(' ');
  }
  return out;
}

interface Built { wire: string; box: { x: number; y: number; w: number; h: number } }
function buildPath(ctx: Ctx, subs: AffinitySubPath[]): Built | null {
  const ox = ctx.origin.x, oy = ctx.origin.y;
  const pts: number[][] = [];
  const parsed = subs.filter(s => s.c.length > 0).map(s => {
    const start = [s.s[0] - ox, s.s[1] - oy];
    const segs = s.c.map(g => [g[0] - ox, g[1] - oy, g[2] - ox, g[3] - oy, g[4] - ox, g[5] - oy]);
    const last = segs[segs.length - 1]!;
    const dup = s.z && Math.hypot(last[4]! - start[0]!, last[5]! - start[1]!) < 1e-4;
    const n = dup ? segs.length : segs.length + 1;
    const nodes = [] as { p: number[]; hin: number[]; hout: number[] }[];
    for (let i = 0; i < n; i++) {
      const p = i === 0 ? start : [segs[i - 1]![4]!, segs[i - 1]![5]!];
      const hout = i < segs.length ? [segs[i]![0]!, segs[i]![1]!] : p;
      const prev = i > 0 ? segs[i - 1]! : dup ? last : null;
      const hin = prev ? [prev[2]!, prev[3]!] : p;
      nodes.push({ p, hin, hout });
      pts.push(p, hin, hout);
    }
    return { closed: s.z, nodes };
  });
  if (!parsed.length || !pts.length) return null;
  const xs = pts.map(p => p[0]!), ys = pts.map(p => p[1]!);
  if (![...xs, ...ys].every(finite)) return null;
  const x = Math.floor(Math.min(...xs)), y = Math.floor(Math.min(...ys));
  const w = Math.max(1, Math.ceil(Math.max(...xs)) - x), h = Math.max(1, Math.ceil(Math.max(...ys)) - y);
  const fx = (v: number): number => (v - x) / w, fy = (v: number): number => (v - y) / h;
  try {
    const wire = encodeAuthoredPaths(parsed.map(sp => ({
      kind: 'cubic' as const, closed: sp.closed,
      nodes: sp.nodes.map(n => ({
        x: fx(n.p[0]!), y: fy(n.p[1]!),
        hInX: fx(n.hin[0]!) - fx(n.p[0]!), hInY: fy(n.hin[1]!) - fy(n.p[1]!),
        hOutX: fx(n.hout[0]!) - fx(n.p[0]!), hOutY: fy(n.hout[1]!) - fy(n.p[1]!),
        continuity: 'corner' as const,
      })),
    })));
    return { wire, box: { x, y, w, h } };
  } catch { return null; }
}

/** A closed four-corner outline with straight sides along the axes: a rectangle. */
function axisRect(subs: AffinitySubPath[]): { x: number; y: number; w: number; h: number } | null {
  if (subs.length !== 1) return null;
  const s = subs[0]!;
  if (!s.z || s.c.length < 4 || s.c.length > 5) return null;
  const pts: [number, number][] = [s.s];
  for (const g of s.c) {
    const prev = pts[pts.length - 1]!;
    const straight = Math.hypot(g[0] - prev[0], g[1] - prev[1]) < 1e-3 && Math.hypot(g[2] - g[4], g[3] - g[5]) < 1e-3;
    if (!straight) return null;
    pts.push([g[4], g[5]]);
  }
  if (s.c.length === 5 && Math.hypot(pts[5]![0] - pts[0]![0], pts[5]![1] - pts[0]![1]) > 1e-3) return null;
  const four = pts.slice(0, 4);
  const xs = four.map(p => p[0]), ys = four.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const onEdge = four.every(p => (Math.abs(p[0] - x0) < 1e-3 || Math.abs(p[0] - x1) < 1e-3) && (Math.abs(p[1] - y0) < 1e-3 || Math.abs(p[1] - y1) < 1e-3));
  const distinct = new Set(four.map(p => `${Math.round(p[0] * 100)},${Math.round(p[1] * 100)}`)).size === 4;
  return onEdge && distinct ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

function push(ctx: Ctx, node: DesignNode, extra: Record<string, unknown> | null): void {
  if (ctx.nodes.length >= MAX_BOXES_PER_FRAME) { ctx.dropped++; return; }
  ctx.nodes.push(node);
  ctx.extras.push(extra);
}

function effectsOf(ctx: Ctx, effects: AffinityEffect[], target: 'box' | 'text' | 'content', into: DesignNode): void {
  let shadowed = false;
  for (const e of effects) {
    if (e.t === 'shadow' && !e.inner && !shadowed) {
      shadowed = true;
      into.shadow = target;
      into.shadowColor = cssColor(e.c, e.opacity);
      into.shadowX = Math.round(Math.cos(e.angle) * e.distance);
      into.shadowY = Math.round(Math.sin(e.angle) * e.distance);
      into.shadowBlur = Math.round(e.radius);
    } else if (e.t === 'shadow') note(ctx, 'effect', e.inner ? 'Inner shadows' : 'Extra drop shadows');
    else if (e.t === 'glow') note(ctx, 'effect', 'Outer glows');
    else if (e.t === 'outline') note(ctx, 'effect', 'Outline effects');
    else if (e.t === 'bevel') note(ctx, 'effect', 'Bevel and emboss');
    else note(ctx, 'effect', 'Colour and gradient overlays');
  }
}

function runMarkup(runs: AffinityRun[], baseWeight: number, baseColor: string, upper: boolean): string {
  let out = '';
  for (const run of runs) {
    let text = escapeMarkup(upper ? run.text.toUpperCase() : run.text, 'design');
    const attrs: string[] = [];
    const color = run.fill.t === 'solid' ? cssColor(run.fill.c).slice(0, 7) : '';
    if (color && color !== baseColor.slice(0, 7)) attrs.push(color);
    if (run.weight !== baseWeight) attrs.push(`w${Math.max(1, Math.min(9, Math.round(run.weight / 100)))}00`);
    if (run.underline) attrs.push('u');
    if (run.strike) attrs.push('s');
    if (attrs.length) text = hugMarkers(text, `{${attrs.join(' ')}|`, '}');
    if (run.italic) text = hugMarkers(text, '*', '*');
    out += text;
  }
  return out;
}

interface TextShape { runs: AffinityRun[]; box: { x: number; y: number; w: number; h: number; rot: number }; align: string; scale: number; pad?: number }
function textNode(ctx: Ctx, t: TextShape, opacity: number, common: Partial<DesignNode>): DesignNode | null {
  const runs = t.runs.filter(r => r.text.length > 0);
  const first = runs[0];
  if (!first) return null;
  const upper = runs.some(r => r.allCaps);
  if (upper) note(ctx, 'approximated', 'All-caps text set as capital letters');
  if (runs.some(r => r.features.length)) note(ctx, 'dropped', 'OpenType feature settings on text');
  if (runs.some(r => r.hScale !== 1)) note(ctx, 'dropped', 'Horizontal glyph scaling on text');
  if (runs.some(r => r.stroke)) note(ctx, 'dropped', 'Outlined characters (drawn as filled text)');
  if (runs.some(r => r.fill.t === 'gradient')) note(ctx, 'approximated', 'Gradient text colours imported as the first stop');
  const p = first.para;
  if (p.left || p.right || p.first || p.before || p.after) note(ctx, 'approximated', 'Paragraph indents and spacing');
  if (new Set(runs.map(r => r.size)).size > 1) note(ctx, 'approximated', 'Mixed type sizes in one text object use the first size');
  const size = Math.max(1, first.size * t.scale);
  const colorPaint = first.fill.t === 'solid' ? first.fill : first.fill.t === 'gradient' && first.fill.stops[0] ? { t: 'solid' as const, c: first.fill.stops[0].c } : null;
  const base = colorPaint ? cssColor(colorPaint.c, opacity >= 1 ? 1 : 1) : '#000000';
  const lead = first.leading ?? p.leading;
  const lineHeight = lead != null && first.size > 0 ? Math.max(0.5, Math.min(4, lead / first.size)) : Math.max(0.8, Math.min(2, 1.2 * (p.autoLeading || 1)));
  return {
    kind: 'text', ...common,
    x: t.box.x, y: t.box.y, w: t.box.w, h: t.box.h, rot: t.box.rot,
    text: runMarkup(runs, first.weight, base, upper),
    fg: base, fontSize: size, fontFamily: first.family || first.postscript, fontWeight: first.weight,
    textAlign: t.align === 'justify' ? 'left' : t.align, lineHeight, tracking: r2(first.tracking * size), pad: t.pad ?? 0, fill: '',
  };
}

function plainLen(runs: AffinityRun[]): { lines: number; chars: number } {
  const lines = runs.map(r => r.text).join('').split(/\r?\n/);
  return { lines: lines.length, chars: Math.max(...lines.map(l => [...l].length), 0) };
}

async function walk(ctx: Ctx, nodes: AffinityNode[], state: { group: string; opacity: number }, depth: number): Promise<void> {
  if (depth > 128) return;
  const { origin } = ctx;
  for (const n of nodes) {
    if (!n.visible) { note(ctx, 'dropped', 'Hidden layers'); continue; }
    const opacity = Math.max(0, Math.min(1, state.opacity * (Number.isFinite(n.opacity) ? n.opacity : 1)));
    const blend = BLEND[n.blend];
    const isContainer = n.kind.t === 'layer' || n.kind.t === 'group' || n.kind.t === 'unsupported' || n.kind.t === 'artboard';
    if (blend === undefined) note(ctx, 'approximated', `Blend mode ${n.blend} imported as Normal`);
    else if (!isContainer && blend !== 'normal') { /* carried on the row below */ }
    else if (isContainer && n.blend !== 'Normal' && n.blend !== 'PassThrough') note(ctx, 'approximated', 'Blend modes on groups are not applied');
    if (n.mask) note(ctx, 'dropped', 'Vector masks');
    if (n.pixelMask) note(ctx, 'dropped', 'Pixel masks');
    const name = scrub(n.name).slice(0, 80);
    const common = { opacity: Math.round(opacity * 100), blend: blend && blend !== 'normal' ? blend : undefined, group: state.group || undefined };
    const k = n.kind;
    const named = (extra: Record<string, unknown> | null): Record<string, unknown> => ({ ...(name ? { name } : {}), ...extra });
    switch (k.t) {
      case 'layer': case 'group': case 'unsupported': case 'artboard': {
        if (k.t === 'unsupported') note(ctx, 'dropped', `Objects of an unsupported kind (${scrub(n.class) || 'unknown'}); their contents were still read`);
        if (n.effects.length && k.t !== 'artboard') for (const e of n.effects) note(ctx, 'effect', e.t === 'shadow' ? 'Shadows on groups' : e.t === 'glow' ? 'Outer glows on groups' : e.t === 'outline' ? 'Outlines on groups' : e.t === 'bevel' ? 'Bevel and emboss on groups' : 'Overlays on groups');
        const label = scrub(n.name);
        const group = k.t === 'group' && label ? (state.group ? `${state.group} / ${label}` : label).slice(0, 120) : state.group;
        await walk(ctx, n.children, { group, opacity }, depth + 1);
        break;
      }
      case 'shape': {
        const fill = pickPaint(k.fills), stroke = k.strokes.find(s => s.paint.t !== 'none' && s.width > 0);
        const f = fillOf(ctx, fill, 1);
        const sf = strokeFields(ctx, stroke, 1);
        const rect = axisRect(k.path);
        if (k.path.length && (f.fill || f.grad || stroke)) {
          const grow = !stroke ? 0 : stroke.align === 'outside' ? stroke.width : stroke.align === 'center' ? stroke.width / 2 : 0;
          if (rect) {
            const node: DesignNode = {
              kind: 'box', ...common, shape: 'rect', fill: f.fill, grad: f.grad || undefined,
              x: rect.x - origin.x - grow, y: rect.y - origin.y - grow, w: rect.w + 2 * grow, h: rect.h + 2 * grow, ...sf,
            } as DesignNode;
            effectsOf(ctx, n.effects, 'box', node);
            push(ctx, node, named(sf.strokeCap ? { strokeCap: sf.strokeCap, strokeJoin: sf.strokeJoin, ...(sf.strokeDashArray ? { strokeDashArray: sf.strokeDashArray } : {}) } : null));
          } else {
            const built = buildPath(ctx, k.path);
            if (built) {
              if (stroke && stroke.align !== 'center') note(ctx, 'approximated', 'Strokes drawn inside or outside a curve are centred on it');
              const node: DesignNode = { kind: 'box', ...common, ...built.box, grad: f.grad || undefined, fill: f.fill, ...sf } as DesignNode;
              effectsOf(ctx, n.effects, 'box', node);
              push(ctx, node, named({ kind: 'path', shape: 'rect', path: built.wire, fillRule: k.evenOdd ? 'evenodd' : 'nonzero', ...(sf.strokeCap ? { strokeCap: sf.strokeCap, strokeJoin: sf.strokeJoin } : {}), ...(sf.strokeDashArray ? { strokeDashArray: sf.strokeDashArray } : {}) }));
              } else note(ctx, 'dropped', 'Curves too complex to edit');
          }
        } else if (n.effects.length) for (const e of n.effects) note(ctx, 'effect', e.t === 'shadow' ? 'Shadows' : 'Effects on empty shapes');
        if (k.fills.length > 1 || k.strokes.length > 1) note(ctx, 'approximated', 'Several fills or strokes on one object use the active one');
        if (n.children.length) {
          note(ctx, 'approximated', 'Objects clipped inside a shape are placed unclipped');
          await walk(ctx, n.children, { group: state.group, opacity }, depth + 1);
        }
        break;
      }
      case 'text': {
        const scale = scaleOf(k.textTf);
        const rot = (Math.atan2(k.tf[1], k.tf[0]) * 180) / Math.PI;
        let box: { x: number; y: number; w: number; h: number; rot: number };
        if (k.frame) {
          const g = boxGeomFromBBox({ x: k.frame[0], y: k.frame[1], width: k.frame[2] - k.frame[0], height: k.frame[3] - k.frame[1] }, { a: k.tf[0], b: k.tf[1], c: k.tf[2], d: k.tf[3], e: k.tf[4], f: k.tf[5] });
          box = { ...g, x: g.x - origin.x, y: g.y - origin.y };
        } else {
          const first = k.runs[0];
          const size = (first?.size ?? 16) * scale;
          const { lines, chars } = plainLen(k.runs);
          const w = Math.max(size, chars * size * 0.56), h = Math.max(size * 1.2, lines * size * 1.2);
          const [ax, ay] = apply(k.tf, k.anchor[0], k.anchor[1]);
          const left = k.align === 'center' ? ax - w / 2 : k.align === 'right' ? ax - w : ax;
          box = { x: left - origin.x, y: ay - size * 0.95 - origin.y, w, h, rot };
        }
        const node = textNode(ctx, { runs: k.runs, box, align: k.align, scale }, opacity, common);
        if (node) {
          effectsOf(ctx, n.effects, 'text', node);
          push(ctx, node, named(null));
        }
        if (n.children.length) await walk(ctx, n.children, { group: state.group, opacity }, depth + 1);
        break;
      }
      case 'table': {
        await table(ctx, k, opacity, common, name);
        break;
      }
      case 'image': {
        const [a, b, c, d] = k.tf;
        if (Math.abs(a * c + b * d) > 1e-3 * Math.max(1, Math.abs(a * d - b * c))) note(ctx, 'approximated', 'Skewed pictures are shown without the skew');
        if (a * d - b * c < 0) note(ctx, 'approximated', 'Mirrored pictures are shown unmirrored');
        if (k.enc === 'other' || !k.data) { note(ctx, 'dropped', 'Pictures in a format Design cannot read'); break; }
        const ref = await ctx.opts.image(k);
        if (!ref) { note(ctx, 'dropped', 'Pictures that could not be stored'); break; }
        if (k.cmyk) note(ctx, 'approximated', 'CMYK pictures shown without their colour profile');
        const g = boxGeomFromBBox({ x: 0, y: 0, width: k.w, height: k.h }, { a: k.tf[0], b: k.tf[1], c: k.tf[2], d: k.tf[3], e: k.tf[4], f: k.tf[5] });
        const node: DesignNode = { kind: 'image', ...common, x: g.x - origin.x, y: g.y - origin.y, w: g.w, h: g.h, rot: g.rot, image: ref, fit: 'fill', fill: '' };
        effectsOf(ctx, n.effects, 'content', node);
        push(ctx, node, named(null));
        break;
      }
      case 'master': note(ctx, 'dropped', 'Master pages shown on pages'); break;
    }
  }
}

async function table(ctx: Ctx, t: Extract<AffinityKind, { t: 'table' }>, opacity: number, common: Partial<DesignNode>, name: string): Promise<void> {
  const nc = Math.max(0, t.columns.length - 1), nr = Math.max(0, t.rows.length - 1);
  if (!nc || !nr || t.cells.length < nc * nr) { note(ctx, 'dropped', 'Tables that did not match their grid'); return; }
  const scale = scaleOf(t.textTf);
  const m = { a: t.tf[0], b: t.tf[1], c: t.tf[2], d: t.tf[3], e: t.tf[4], f: t.tf[5] };
  const rotNote = Math.abs(t.tf[1]) > 1e-6 || Math.abs(t.tf[2]) > 1e-6;
  if (rotNote) note(ctx, 'approximated', 'Rotated tables keep their cell boxes upright');
  const place = (x0: number, y0: number, x1: number, y1: number) => {
    const g = boxGeomFromBBox({ x: x0, y: y0, width: x1 - x0, height: y1 - y0 }, rotNote ? { ...m, a: scaleOf(t.tf), b: 0, c: 0, d: scaleOf(t.tf) } : m);
    return { x: g.x - ctx.origin.x, y: g.y - ctx.origin.y, w: g.w, h: g.h, rot: rotNote ? 0 : g.rot };
  };
  for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) {
    const cell = t.cells[r * nc + c]!;
    if (cell.mergedLeft) continue;
    let end = c + 1;
    while (end < nc && t.cells[r * nc + end]!.mergedLeft) end++;
    const [il, it, ir, ib] = cell.inset;
    const box = place(t.columns[c]! + il, t.rows[r]! + it, t.columns[end]! - ir, t.rows[r + 1]! - ib);
    const node = textNode(ctx, { runs: cell.runs, box, align: cell.runs[0]?.para.align ?? 'left', scale }, opacity, common);
    if (node) push(ctx, node, name ? { name: `${name} cell` } : null);
  }
  const line = (s: AffinityStroke | null | undefined, x0: number, y0: number, x1: number, y1: number) => {
    if (!s || s.paint.t === 'none' || !(s.width > 0)) return;
    const w = s.width, vertical = x0 === x1;
    const box = place(vertical ? x0 - w / 2 : x0, vertical ? y0 : y0 - w / 2, vertical ? x0 + w / 2 : x1, vertical ? y1 : y0 + w / 2);
    const color = s.paint.t === 'solid' ? cssColor(s.paint.c) : s.paint.stops[0] ? cssColor(s.paint.stops[0].c) : '#000000';
    push(ctx, { kind: 'box', ...common, shape: 'rect', fill: color, ...box }, null);
  };
  if (t.vertical.length >= nr * (nc + 1)) for (let r = 0; r < nr; r++) for (let c = 0; c <= nc; c++) line(t.vertical[r * (nc + 1) + c], t.columns[c]!, t.rows[r]!, t.columns[c]!, t.rows[r + 1]!);
  if (t.horizontal.length >= (nr + 1) * nc) for (let b = 0; b <= nr; b++) for (let c = 0; c < nc; c++) line(t.horizontal[b * nc + c], t.columns[c]!, t.rows[b]!, t.columns[c + 1]!, t.rows[b]!);
  note(ctx, 'dropped', 'Table cell fills');
}

function findArtboards(nodes: AffinityNode[], out: AffinityNode[], depth = 0): void {
  for (const n of nodes) {
    if (n.kind.t === 'artboard') { out.push(n); continue; }
    if (depth < 64) findArtboards(n.children, out, depth + 1);
  }
}

function classify(text: string): AffinityNoteKind {
  const t = text.toLowerCase();
  if (/adjust|live filter|curves|levels|\bhsl\b/.test(t)) return 'adjustment';
  if (/effect|shadow|glow|blur|bevel|overlay|outline/.test(t)) return 'effect';
  if (/approximat|imported as|as normal|centred|plain stroke/.test(t)) return 'approximated';
  return 'reader';
}

/** Map a model to frames of editable rows plus the import report. Throws when no frame can be built. */
export async function mapAffinityDocument(model: AffinityModel, opts: AffinityMapOptions): Promise<AffinityMapResult> {
  const notes = new Map<string, AffinityNote & { n: number }>();
  const frames: AffinityFrame[] = [];
  const maxFrames = opts.maxFrames ?? 256;
  let skippedFrames = 0, idPrefix = 0;
  const build = async (spreadIndex: number, nodes: AffinityNode[], bounds: Rect4, name: string, background: string, bgPaint: AffinityPaint | null): Promise<void> => {
    if (frames.length >= maxFrames) { skippedFrames++; return; }
    const width = Math.max(1, Math.round(bounds[2] - bounds[0])), height = Math.max(1, Math.round(bounds[3] - bounds[1]));
    if (!finite(width * height) || width * height > MAX_CANVAS_PIXELS) throw new Error('This Affinity page is too large to open as layers.');
    const ctx: Ctx = { opts, notes, nodes: [], extras: [], origin: { x: bounds[0], y: bounds[1] }, dropped: 0 };
    if (bgPaint && bgPaint.t === 'gradient') {
      const f = fillOf(ctx, bgPaint);
      push(ctx, { kind: 'box', shape: 'rect', x: 0, y: 0, w: width, h: height, fill: f.fill, grad: f.grad || undefined }, { name: 'Background' });
    }
    await walk(ctx, nodes, { group: '', opacity: 1 }, 0);
    if (ctx.dropped) note(ctx, 'dropped', `Objects past the ${MAX_BOXES_PER_FRAME} per page limit`);
    const prefix = `af${idPrefix++}-`;
    const boxes: Record<string, unknown>[] = [];
    ctx.nodes.forEach((node, i) => {
      const kind = node.kind === 'text' ? 'text' : node.kind === 'image' ? 'image' : 'box';
      if (kind !== 'text' && Number(node.w) < 1 && Number(node.h) < 1) return;
      const box: Record<string, unknown> = { ...nodeToBox(node, { id: prefix + boxes.length, ...opts.map }) };
      const extra = ctx.extras[i];
      if (extra) Object.assign(box, extra);
      boxes.push(box);
    });
    frames.push({ name, width, height, background, boxes, x: bounds[0], y: bounds[1], spread: spreadIndex });
  };

  for (const [si, spread] of model.spreads.entries()) {
    const boards: AffinityNode[] = [];
    findArtboards(spread.nodes, boards);
    if (boards.length) {
      for (const [bi, b] of boards.entries()) {
        const k = b.kind as Extract<AffinityKind, { t: 'artboard' }>;
        const paint = pickPaint(k.background);
        const bg = paint.t === 'solid' ? cssColor(paint.c) : paint.t === 'gradient' ? '#ffffff' : '';
        if (k.strokes.some(s => s.paint.t !== 'none')) { note({ notes }, 'dropped', 'Artboard borders'); }
        await build(si, b.children, k.rect, scrub(b.name) || `Artboard ${si + 1}.${bi + 1}`, bg, paint);
      }
      const outside = spread.nodes.filter(n => n.kind.t !== 'artboard' && n.visible && n.kind.t !== 'master').length;
      if (outside) note({ notes }, 'dropped', `Objects outside every artboard (${outside} on the pasteboard)`);
    } else {
      const label = model.spreads.length > 1 ? `Spread ${si + 1}` : 'Page 1';
      await build(si, spread.nodes, spread.bounds, label, spread.transparent ? '' : '#ffffff', null);
    }
  }
  if (!frames.length) throw new Error('No pages could be read from this Affinity file.');
  if (skippedFrames) note({ notes }, 'dropped', `Pages past the ${maxFrames} page limit`);
  if (model.masters.length) note({ notes }, 'dropped', 'Master pages');
  const report: AffinityNote[] = [...notes.values()].map(e => ({ kind: e.kind, text: e.n > 1 ? `${e.text} (${e.n}×)` : e.text }));
  for (const w of model.warnings) report.push({ kind: classify(w), text: w });
  const order: AffinityNoteKind[] = ['effect', 'adjustment', 'approximated', 'dropped', 'reader'];
  report.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  return { frames, report };
}
