// SPDX-License-Identifier: MPL-2.0
/**
 * A CSS border whose sides differ in width, drawn as the one shape CSS paints for that border.
 *
 * A border of one colour and one solid style is the band between the border box and the
 * padding box. The padding box sits in by each side's own width, and each of its corners
 * is the border-box corner less the adjacent widths on that axis, never below zero (CSS
 * Backgrounds 3, "Corner Shaping"). Drawn as one even-odd path, a translucent border
 * paints each pixel once, where four overlapping edge rectangles painted the corners twice
 * and ignored the radius. Design's per-side strokes reach the walkers this way.
 *
 * Pure: no DOM.
 */
import { roundedRectPath } from '@lolly/engine';
import type { CornerRadii } from '../../../../engine/src/css-box.ts';
import { borderDashArray } from './export-pdf-vector.ts';
import type { Rgba } from './export-shared.ts';

/** The four border widths, top, right, bottom and left, in px. */
export type BorderWidths = readonly [number, number, number, number];

/**
 * The band's path data: the border box with its own corners, then the padding box with
 * its inner corners, for an even-odd fill. Empty when no side has a width.
 */
export function borderBandPath(x: number, y: number, w: number, h: number, radii: CornerRadii, widths: BorderWidths): string {
  const [t, r, b, l] = widths.map((v) => Math.max(0, v)) as [number, number, number, number];
  if (!(t > 0 || r > 0 || b > 0 || l > 0)) return '';
  const outer = roundedRectPath(x, y, w, h, radii);
  // A border wider than the box leaves no padding box: the whole border box is painted.
  const inner = paddingBoxPath(x, y, w, h, radii, [t, r, b, l]);
  return inner ? `${outer} ${inner}` : outer;
}

/**
 * The padding box's path: the box in by each border width, its corners the border-box
 * corners less the adjacent widths. Where `background-clip: padding-box` keeps a fill.
 * Null when the borders leave no room inside.
 */
export function paddingBoxPath(x: number, y: number, w: number, h: number, radii: CornerRadii, widths: BorderWidths): string | null {
  const [t, r, b, l] = widths.map((v) => Math.max(0, v)) as [number, number, number, number];
  const iw = w - l - r, ih = h - t - b;
  if (!(iw > 0 && ih > 0)) return null;
  const less = (p: readonly [number, number], across: number, down: number): [number, number] => [Math.max(0, p[0] - across), Math.max(0, p[1] - down)];
  return roundedRectPath(x + l, y + t, iw, ih, {
    topLeft: less(radii.topLeft, l, t), topRight: less(radii.topRight, r, t),
    bottomRight: less(radii.bottomRight, r, b), bottomLeft: less(radii.bottomLeft, l, b),
  });
}

/**
 * The colour a border paints with when its drawn sides agree on one colour and are all
 * solid, which is when the band is exactly what CSS draws; null otherwise. A side of no
 * width draws nothing and so does not vote.
 */
export function oneSolidBorderColour<C>(sides: ReadonlyArray<{ width: number; style: string; colour: C | null }>, same: (a: C, b: C) => boolean): C | null {
  let colour: C | null = null;
  for (const side of sides) {
    if (!(side.width > 0)) continue;
    if (side.style !== 'solid' || !side.colour) return null;
    if (colour === null) colour = side.colour;
    else if (!same(colour, side.colour)) return null;
  }
  return colour;
}

/** One side of a dashed or dotted border, as a line along the middle of its band. */
export interface BorderSideLine { x1: number; y1: number; x2: number; y2: number; width: number }

/**
 * A dashed or dotted border whose sides differ in width, as one line per drawn side along
 * the middle of that side's band, from corner to corner. CSS spaces each side's marks to fit that
 * side; the caller gives each line its own dash pattern from its width.
 */
export function borderSideLines(x: number, y: number, w: number, h: number, widths: BorderWidths): BorderSideLine[] {
  const [t, r, b, l] = widths.map((v) => Math.max(0, v)) as [number, number, number, number];
  const out: BorderSideLine[] = [];
  if (t > 0) out.push({ x1: x, y1: y + t / 2, x2: x + w, y2: y + t / 2, width: t });
  if (r > 0) out.push({ x1: x + w - r / 2, y1: y, x2: x + w - r / 2, y2: y + h, width: r });
  if (b > 0) out.push({ x1: x + w, y1: y + h - b / 2, x2: x, y2: y + h - b / 2, width: b });
  if (l > 0) out.push({ x1: x + l / 2, y1: y + h, x2: x + l / 2, y2: y, width: l });
  return out;
}

/**
 * The one colour and the one style (dashed or dotted) a mixed-width border paints its
 * drawn sides in; null when they differ, or when the style is anything else.
 */
export function oneDashedBorder<C>(sides: ReadonlyArray<{ width: number; style: string; colour: C | null }>, same: (a: C, b: C) => boolean): { colour: C; style: 'dashed' | 'dotted' } | null {
  let colour: C | null = null, style = '';
  for (const side of sides) {
    if (!(side.width > 0)) continue;
    if ((side.style !== 'dashed' && side.style !== 'dotted') || !side.colour) return null;
    if (colour === null) { colour = side.colour; style = side.style; }
    else if (!same(colour, side.colour) || style !== side.style) return null;
  }
  return colour === null ? null : { colour, style: style as 'dashed' | 'dotted' };
}

type Box = { x: number; y: number; w: number; h: number };
type Side = { bw: number; rgb: Rgba | null };
const sameRgba = (a: Rgba, b: Rgba): boolean => a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
const rgbStr = (c: Rgba): string => `rgb(${c[0]},${c[1]},${c[2]})`;
const BORDER_STYLES = ['borderTopStyle', 'borderRightStyle', 'borderBottomStyle', 'borderLeftStyle'] as const;

/**
 * A mixed-width border drawn the way CSS paints it, appended to `g`. One solid colour on a
 * rounded box, or a translucent one, is the band, corners and all: edge rectangles ignore
 * the radius and paint a translucent corner twice. One dashed or dotted colour is a line
 * per side with that side's own dash. False, drawing nothing, where the caller's edge
 * rectangles are already exact, so a plain divider exports as it always has.
 */
export function drawMixedBorder(NS: string, g: Element, style: CSSStyleDeclaration, b: Box, radii: CornerRadii, rounded: boolean, sides: readonly Side[]): boolean {
  const voters = sides.map((side, i) => ({ width: side.bw, style: String(style[BORDER_STYLES[i]!] ?? ''), colour: side.rgb }));
  const widths: BorderWidths = [sides[0]?.bw ?? 0, sides[1]?.bw ?? 0, sides[2]?.bw ?? 0, sides[3]?.bw ?? 0];
  const solid = oneSolidBorderColour(voters, sameRgba);
  if (solid && (rounded || (solid[3] < 1 && sides.filter((side) => side.bw > 0).length >= 2))) {
    const band = document.createElementNS(NS, 'path');
    band.setAttribute('d', borderBandPath(b.x, b.y, b.w, b.h, radii, widths));
    band.setAttribute('fill-rule', 'evenodd');
    band.setAttribute('fill', rgbStr(solid));
    if (solid[3] < 1) band.setAttribute('fill-opacity', String(solid[3]));
    g.appendChild(band);
    return true;
  }
  const dashed = oneDashedBorder(voters, sameRgba);
  if (!dashed) return false;
  for (const side of borderSideLines(b.x, b.y, b.w, b.h, widths)) {
    const line = document.createElementNS(NS, 'line');
    for (const [k, v] of [['x1', side.x1], ['y1', side.y1], ['x2', side.x2], ['y2', side.y2]] as const) line.setAttribute(k, String(v));
    line.setAttribute('stroke', rgbStr(dashed.colour));
    line.setAttribute('stroke-width', String(side.width));
    if (dashed.colour[3] < 1) line.setAttribute('stroke-opacity', String(dashed.colour[3]));
    const dash = borderDashArray(dashed.style, side.width);
    if (dash) { line.setAttribute('stroke-dasharray', dash.dash.join(' ')); if (dash.round) line.setAttribute('stroke-linecap', 'round'); }
    g.appendChild(line);
  }
  return true;
}

/**
 * The background colour of a box whose last background layer is clipped to the padding
 * box (`background-clip: padding-box`, as a Design box with a centred or outside stroke
 * draws), appended to `g`, so a translucent border does not show the colour through.
 * False, drawing nothing, for any other clip; true with nothing drawn when the borders
 * leave no room inside.
 */
export function drawPaddingBoxFill(NS: string, g: Element, style: CSSStyleDeclaration, b: Box, radii: CornerRadii, colour: string): boolean {
  if ((style.backgroundClip || '').split(',').pop()!.trim() !== 'padding-box') return false;
  const px = (side: string): number => parseFloat(style.getPropertyValue(`border-${side}-width`)) || 0;
  const widths: BorderWidths = [px('top'), px('right'), px('bottom'), px('left')];
  const d = paddingBoxPath(b.x, b.y, b.w, b.h, radii, widths);
  if (d) {
    const fill = document.createElementNS(NS, 'path');
    fill.setAttribute('d', d);
    fill.setAttribute('fill', colour);
    g.appendChild(fill);
  }
  return true;
}
