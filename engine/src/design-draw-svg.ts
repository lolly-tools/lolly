// SPDX-License-Identifier: MPL-2.0
/**
 * Drawing operations written as SVG (plan 295, phase 3, P3a).
 *
 * The first consumer of `design-draw.ts`. It writes exactly the markup
 * `framePreviewSvg` wrote from the rows before, so the preview's own tests prove the
 * operations carry everything the preview drew. Everything is XML-escaped, because
 * row text is document-controlled, and the drawing points at no external resource of its
 * own: the one href in it is the one the caller returns from `assetHref`.
 *
 * Pure: no DOM, no clock, no network, no filesystem, no randomness.
 */
import { AVERAGE_GLYPH_EM } from './deck-compile.ts';
import type { DesignTextRunV1 } from './design-text.ts';
import type { DesignDrawPage, DrawBox, DrawImageOp, DrawOp, DrawPaint, DrawPose, DrawShapeOp, DrawStroke, DrawTextOp } from './design-draw.ts';
import { toSvgPathData } from './geom/path.ts';

export interface DesignDrawSvgOpts {
  /** Turns an image reference into something an `image` element can draw. */
  assetHref: (ref: string) => string | undefined;
  /** The family a text block draws in, from its authored font (a slot, a family or empty). */
  family: (font: string) => string;
  /** The family a `mono` run draws in. */
  mono: string;
  /** Drawn for an image whose reference cannot be resolved; empty draws nothing. */
  missingImage?: (op: DrawImageOp) => string;
  /** Decimal places for path coordinates. Two when absent. */
  pathDecimals?: number;
}

export function svgEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function round2(n: number): number {
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

/** The `preserveAspectRatio` one Design `fit` asks for. */
function aspect(fit: string): string {
  if (fit === 'cover') return 'xMidYMid slice';
  if (fit === 'fill') return 'none';
  return 'xMidYMid meet';
}

/** SVG text anchor and the x it is placed at, for one alignment inside a box. */
function anchorOf(align: string, x: number, w: number): { anchor: string; x: number } {
  if (align === 'center') return { anchor: 'middle', x: round2(x + w / 2) };
  if (align === 'right') return { anchor: 'end', x: round2(x + w) };
  return { anchor: 'start', x: round2(x) };
}

/**
 * The y of the first baseline inside a box, for one vertical alignment. Each line is
 * `lineHeight` of the size tall with its glyphs centred in it, as a CSS line box sets
 * them; a block taller than the box starts above it under `middle` and `bottom`, as
 * Design's flex box places the block.
 */
export function firstBaseline(valign: string, y: number, h: number, fontSize: number, lines: number, lineHeight: number): number {
  const line = fontSize * lineHeight;
  const block = lines * line;
  const ascent = (line - fontSize) / 2 + fontSize * 0.8;
  if (valign === 'middle') return round2(y + (h - block) / 2 + ascent);
  if (valign === 'bottom') return round2(y + h - block + ascent);
  return round2(y + ascent);
}

/** A 32-bit FNV-1a hash in base 36, for an id derived from the content it labels. */
function contentId(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/**
 * The turn and the mirror about the box centre. Design composes them `rotate() scale()`
 * with the origin at the centre, so the artwork turns over in place; SVG needs the two
 * translations that move the origin there and back.
 */
export function poseTransform(box: DrawBox, rot: number, flipH: boolean, flipV: boolean): string {
  const cx = round2(box.x + box.w / 2);
  const cy = round2(box.y + box.h / 2);
  const parts = [`translate(${cx} ${cy})`];
  if (rot !== 0) parts.push(`rotate(${round2(rot)})`);
  if (flipH || flipV) parts.push(`scale(${flipH ? -1 : 1} ${flipV ? -1 : 1})`);
  parts.push(`translate(${round2(-cx)} ${round2(-cy)})`);
  return parts.join(' ');
}

/** The opacity and pose of one operation as a group around it; empty when it has neither. */
export function wrapOp(op: { box: DrawBox; opacity: number; pose?: DrawPose }, inner: string): string {
  const attrs = (op.opacity !== 100 ? ` opacity="${round2(Math.max(0, Math.min(100, op.opacity)) / 100)}"` : '')
    + (op.pose ? ` transform="${poseTransform(op.box, op.pose.rot, op.pose.flipH, op.pose.flipV)}"` : '');
  return attrs ? `<g${attrs}>${inner}</g>` : inner;
}

/** A gradient as its definition and the `url(#id)` paint; the id hashes the definition. */
function gradient(paint: Exclude<DrawPaint, { kind: 'color' }>): { defs: string; paint: string } {
  const stops = paint.stops.map((s) => `<stop offset="${round2(s.offset)}" stop-color="${s.color}"`
    + (s.opacity < 1 ? ` stop-opacity="${round2(s.opacity)}"` : '') + '/>').join('');
  const tag = paint.kind === 'linear' ? 'linearGradient' : 'radialGradient';
  const head = paint.kind === 'linear'
    ? `<linearGradient gradientUnits="userSpaceOnUse" x1="${round2(paint.x1)}" y1="${round2(paint.y1)}" x2="${round2(paint.x2)}" y2="${round2(paint.y2)}"`
    : '<radialGradient cx="0.5" cy="0.5" r="0.71"';
  const body = `${head}>${stops}</${tag}>`;
  const id = `lg${contentId(body)}`;
  return { defs: `<defs>${body.replace(`<${tag} `, `<${tag} id="${id}" `)}</defs>`, paint: `url(#${id})` };
}

function strokeAttrs(stroke: DrawStroke | undefined): string {
  if (!stroke) return '';
  let out = ` stroke="${svgEscape(stroke.color)}" stroke-width="${round2(stroke.width)}"`;
  if (stroke.cap !== undefined) out += ` stroke-linecap="${svgEscape(stroke.cap)}"`;
  if (stroke.join !== undefined) out += ` stroke-linejoin="${svgEscape(stroke.join)}"`;
  if (stroke.dash) out += ` stroke-dasharray="${round2(stroke.dash[0])} ${round2(stroke.dash[1])}"`;
  return out;
}

function rectOrEllipse(op: DrawShapeOp, fill: string, stroke: DrawStroke | undefined): string {
  const box = op.box;
  const paint = `fill="${fill}"${strokeAttrs(stroke)}`;
  if (op.shape.kind === 'ellipse') {
    return `<ellipse cx="${round2(box.x + box.w / 2)}" cy="${round2(box.y + box.h / 2)}"`
      + ` rx="${round2(box.w / 2)}" ry="${round2(box.h / 2)}" ${paint}/>`;
  }
  const rx = op.shape.kind === 'rect' ? op.shape.radius : 0;
  return `<rect x="${round2(box.x)}" y="${round2(box.y)}" width="${round2(box.w)}" height="${round2(box.h)}"`
    + (rx > 0 ? ` rx="${round2(rx)}"` : '') + ` ${paint}/>`;
}

function shapeSvg(op: DrawShapeOp, opts: DesignDrawSvgOpts): string {
  if (op.shape.kind === 'path') {
    if (!op.shape.contours.length) return '';
    const fill = op.fills[0]?.kind === 'color' ? svgEscape(op.fills[0].color) : 'none';
    const rule = op.shape.evenOdd ? ' fill-rule="evenodd"' : '';
    return `<path d="${svgEscape(toSvgPathData(op.shape.contours, opts.pathDecimals ?? 2))}" fill="${fill}"${rule}${strokeAttrs(op.stroke)}/>`;
  }
  const last = op.fills[op.fills.length - 1];
  if (last && last.kind !== 'color') {
    const g = gradient(last);
    const under = op.fills.length > 1 && op.fills[0]!.kind === 'color' ? rectOrEllipse(op, svgEscape(op.fills[0]!.color), undefined) : '';
    return `${g.defs}${under}${rectOrEllipse(op, g.paint, op.stroke)}`;
  }
  return rectOrEllipse(op, last ? svgEscape(last.color) : 'none', op.stroke);
}

function imageSvg(op: DrawImageOp, opts: DesignDrawSvgOpts): string {
  const href = op.ref ? opts.assetHref(op.ref) : undefined;
  if (!href) return opts.missingImage?.(op) ?? '';
  const box = op.box;
  return `<image x="${round2(box.x)}" y="${round2(box.y)}" width="${round2(box.w)}" height="${round2(box.h)}"`
    + ` href="${svgEscape(href)}" preserveAspectRatio="${aspect(op.fit)}"/>`;
}

/**
 * One run of a styled line. A run with no style of its own is bare text in its line's
 * `tspan`, so a plain row draws its words exactly as before.
 */
function runSpan(run: DesignTextRunV1, mono: string): string {
  const attrs: string[] = [];
  const weight = run.weight ?? (run.bold ? 700 : undefined);
  if (weight !== undefined) attrs.push(`font-weight="${round2(weight)}"`);
  if (run.italic) attrs.push('font-style="italic"');
  const deco = [run.underline ? 'underline' : '', run.strike ? 'line-through' : ''].filter(Boolean).join(' ');
  if (deco) attrs.push(`text-decoration="${deco}"`);
  if (run.color && /^#[0-9a-fA-F]{3,8}$/.test(run.color)) attrs.push(`fill="${svgEscape(run.color)}"`);
  if (run.font === 'mono') attrs.push(`font-family="${svgEscape(mono)}"`);
  return attrs.length > 0 ? `<tspan ${attrs.join(' ')}>${svgEscape(run.text)}</tspan>` : svgEscape(run.text);
}

function textSvg(op: DrawTextOp, opts: DesignDrawSvgOpts): string {
  const box = op.box;
  const rect = (paint: string): string => `<rect x="${round2(box.x)}" y="${round2(box.y)}" width="${round2(box.w)}" height="${round2(box.h)}" fill="${paint}"/>`;
  const lead = op.fills.map((fill) => {
    if (fill.kind === 'color') return rect(svgEscape(fill.color));
    const g = gradient(fill);
    return `${g.defs}${rect(g.paint)}`;
  }).join('');
  const t = op.text;
  if (!t) return lead;
  // SVG folds leading spaces, so a styled line's indent is an offset on its first line.
  const { anchor, x } = anchorOf(t.align, t.inner.x, t.inner.w);
  const baseline = firstBaseline(t.valign, t.inner.y, t.inner.h, t.size, t.lines.length, t.lineHeight);
  let out = `<text x="${x}" y="${baseline}" font-family="${svgEscape(opts.family(t.font))}" font-size="${round2(t.size)}"`
    + ` fill="${svgEscape(t.ink)}" text-anchor="${anchor}"`
    + (t.weight > 0 ? ` font-weight="${round2(t.weight)}"` : '') + '>';
  t.lines.forEach((runs, i) => {
    const dx = (t.indents[i] ?? 0) * t.size * AVERAGE_GLYPH_EM;
    out += `<tspan x="${x}"${dx > 0 ? ` dx="${round2(dx)}"` : ''}${i > 0 ? ` dy="${round2(t.size * t.lineHeight)}"` : ''}>`;
    for (const run of runs) out += runSpan(run, opts.mono);
    out += '</tspan>';
  });
  out += '</text>';
  // The box clips its words where Design's does. A nested viewport clips without an id,
  // so a drawing mounted many times in one document clips every copy.
  const clip = `<svg x="${round2(box.x)}" y="${round2(box.y)}" width="${round2(box.w)}" height="${round2(box.h)}"`
    + ` viewBox="${round2(box.x)} ${round2(box.y)} ${round2(box.w)} ${round2(box.h)}" overflow="hidden">${out}</svg>`;
  return `${lead}${clip}`;
}

/** The markup of one operation, without its opacity and pose group. */
export function designDrawOpBody(op: DrawOp, opts: DesignDrawSvgOpts): string {
  if (op.op === 'image') return imageSvg(op, opts);
  if (op.op === 'text') return textSvg(op, opts);
  return shapeSvg(op, opts);
}

/** The markup of one operation, inside its opacity and pose group when it has either. */
export function designDrawOpSvg(op: DrawOp, opts: DesignDrawSvgOpts): string {
  return wrapOp(op, designDrawOpBody(op, opts));
}

/**
 * A compiled page as a standalone SVG at the page's own size, on the frame's fill or
 * white. `title` labels the drawing for assistive technology.
 */
export function designDrawSvg(page: DesignDrawPage, opts: DesignDrawSvgOpts & { title?: string }): string {
  const body = [`<rect x="0" y="0" width="${round2(page.width)}" height="${round2(page.height)}"`
    + ` fill="${page.background ? svgEscape(page.background) : '#ffffff'}"/>`];
  for (const op of page.ops) body.push(designDrawOpSvg(op, opts));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${round2(page.width)}" height="${round2(page.height)}"`
    + ` viewBox="0 0 ${round2(page.width)} ${round2(page.height)}" role="img"`
    + ` aria-label="${svgEscape(opts.title ?? '')}">${body.join('')}</svg>`;
}
