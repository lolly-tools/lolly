// SPDX-License-Identifier: MPL-2.0
/**
 * Appearance keyframes (plans/328): what the ten appearance channels of the `kf` wire
 * mean as paint. DOM-free, so the preview applier, the video re-raster, the dotLottie
 * compiler and the tests all read the same numbers.
 *
 * The channels (keyframes.ts carries the grammar and the clamps):
 *
 * - `cl ca cb` fill colour and `ll la lb` stroke colour, as OKLab L, a, b;
 * - `lw` stroke width and `cr` corner radius, px;
 * - `ts te` trim start and end, as a fraction of the stroke's length.
 *
 * A keyed value REPLACES the box's own field for its segment. The renderer never
 * rewrites a box's authored declarations to show one: a box whose track keys a look
 * channel is rendered with its paint behind a CSS custom property whose fallback is the
 * authored value (`background:var(--lolly-kf-fill, <fill>)`), and a pose is written
 * as that custom property alone. Removing the property restores the box exactly, and a
 * computed-style reader (the export walkers, the raster path) sees the resolved paint.
 * `KF_LOOK_VARS` lists them; the tool hook spells the same names (pinned by a test).
 */
import { evaluateKf, kfChannelsUsed, KF_QUANTA, type KfChannel, type KfPose, type KfTrack } from './keyframes.ts';
import { linearSrgbToOklab, linearToSrgb, oklabToLinearSrgb, srgbToLinear } from './brand-derive.ts';
import { parseColorToSrgb8 } from './css-color.ts';

/** The fill colour channels, OKLab L, a, b. */
export const KF_FILL_CHANNELS = Object.freeze(['cl', 'ca', 'cb'] as const);
/** The stroke colour channels, OKLab L, a, b. */
export const KF_STROKE_CHANNELS = Object.freeze(['ll', 'la', 'lb'] as const);
/** Every appearance channel, in wire order. */
export const KF_LOOK_CHANNELS: readonly KfChannel[] = Object.freeze(
  ['cl', 'ca', 'cb', 'll', 'la', 'lb', 'lw', 'cr', 'ts', 'te'] as const,
);

const LOOK_SET: ReadonlySet<string> = new Set(KF_LOOK_CHANNELS);

/** True for an appearance channel. */
export function isKfLookChannel(ch: unknown): boolean {
  return typeof ch === 'string' && LOOK_SET.has(ch);
}

/**
 * The custom properties a posed box carries. The hook writes each paint as
 * `var(<name>, <authored>)` only when the track keys the matching channel, so a box
 * with no appearance keys renders byte-identically to a box from before this existed.
 */
export const KF_LOOK_VARS = Object.freeze({
  /** Fill colour, a CSS colour. */
  fill: '--lolly-kf-fill',
  /** Stroke colour, a CSS colour. */
  stroke: '--lolly-kf-stroke',
  /** Stroke width, `<n>px`. */
  width: '--lolly-kf-sw',
  /** Corner radius, `<n>px`. */
  radius: '--lolly-kf-r',
  /** The trim as a `stroke-dasharray` over a stroke of `pathLength="1"`, or `none`. */
  trim: '--lolly-kf-trim',
  /** The trim's `stroke-dashoffset`. */
  trimOffset: '--lolly-kf-trim-off',
  /** 1, or 0 when the trim draws nothing (a zero-length dash would still paint a round cap). */
  trimOn: '--lolly-kf-trim-on',
} as const);

/** The channels of `track` that are appearance channels, in wire order. */
export function kfLookUsed(track: KfTrack | null | undefined): KfChannel[] {
  return kfChannelsUsed(track).filter((ch) => LOOK_SET.has(ch));
}

/** The appearance half of a track's pose at local time `tMs` (empty when none is keyed). */
export function kfLookPose(track: KfTrack | null | undefined, tMs: number): KfPose {
  return evaluateKf(track, tMs, KF_LOOK_CHANNELS);
}

function quant(v: number, q: number): number {
  const inv = Math.round(1 / q);
  const n = Math.round(v * inv) / inv;
  return Object.is(n, -0) ? 0 : n;
}

/** OKLab, the form a colour key is stored in. */
export interface KfOklab {
  l: number;
  a: number;
  b: number;
}

/** sRGB bytes 0..255 → OKLab at the wire's quantum. */
export function kfOklabFromSrgb8(r: number, g: number, b: number): KfOklab {
  const [L, A, B] = linearSrgbToOklab(srgbToLinear(r / 255), srgbToLinear(g / 255), srgbToLinear(b / 255));
  return { l: quant(L, KF_QUANTA.cl), a: quant(A, KF_QUANTA.ca), b: quant(B, KF_QUANTA.cb) };
}

/**
 * OKLab → sRGB bytes. Each channel is clipped to the cube: an overshoot curve can carry
 * a colour past the gamut for a moment, and clipping is the deterministic answer.
 */
export function kfOklabToSrgb8(l: number, a: number, b: number): [number, number, number] {
  const lin = oklabToLinearSrgb(Number.isFinite(l) ? l : 0, Number.isFinite(a) ? a : 0, Number.isFinite(b) ? b : 0);
  const byte = (v: number): number => {
    const e = linearToSrgb(Math.min(1, Math.max(0, v)));
    return Math.round(Math.min(1, Math.max(0, e)) * 255);
  };
  return [byte(lin[0]), byte(lin[1]), byte(lin[2])];
}

/**
 * A CSS colour (hex, rgb(), oklch(), a named colour) as a key: OKLab plus the colour's
 * own alpha, which the key does not carry. Null for anything that is not a solid,
 * visible colour (`transparent`, a gradient, an unresolved `var()`).
 */
export function kfOklabOf(css: unknown): { lab: KfOklab; alpha: number } | null {
  if (typeof css !== 'string' || !css.trim()) return null;
  const rgba = parseColorToSrgb8(css);
  if (!rgba) return null;
  return { lab: kfOklabFromSrgb8(rgba[0], rgba[1], rgba[2]), alpha: rgba[3] };
}

/** The key a colour writes, on the fill or the stroke channels. Null when it is not a solid colour. */
export function kfColourKey(css: unknown, which: 'fill' | 'stroke'): KfPose | null {
  const c = kfOklabOf(css);
  if (!c) return null;
  const [cl, ca, cb] = which === 'fill' ? KF_FILL_CHANNELS : KF_STROKE_CHANNELS;
  return { [cl]: c.lab.l, [ca]: c.lab.a, [cb]: c.lab.b };
}

const hex2 = (n: number): string => n.toString(16).padStart(2, '0');

/**
 * The colour a pose holds on the fill or stroke channels, as CSS: `#rrggbb`, or
 * `rgb(r g b / a)` when the base colour was translucent. Null when the pose does not
 * key that colour. `L` is required; a hand-edited key missing `a` or `b` reads 0 there.
 */
export function kfColourCss(pose: KfPose, which: 'fill' | 'stroke', alpha = 1): string | null {
  const [cl, ca, cb] = which === 'fill' ? KF_FILL_CHANNELS : KF_STROKE_CHANNELS;
  const l = pose[cl];
  if (typeof l !== 'number') return null;
  const [r, g, b] = kfOklabToSrgb8(l, pose[ca] ?? 0, pose[cb] ?? 0);
  const a = Number.isFinite(alpha) ? Math.min(1, Math.max(0, alpha)) : 1;
  if (a >= 1) return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
  return `rgb(${r} ${g} ${b} / ${Math.round(a * 1000) / 1000})`;
}

/** The drawn part of a stroke: `[from, to]` as fractions of its length, ordered. */
export interface KfTrimSpan {
  from: number;
  to: number;
}

/**
 * The trim a pose holds, or null when it keys neither end. An unkeyed end is the
 * stroke's own end (start 0, end 1). The two ends are ordered, so a start past the end
 * draws the same span, which is how lottie-web reads a trim too.
 */
export function kfTrimSpan(pose: KfPose): KfTrimSpan | null {
  const s = pose.ts, e = pose.te;
  if (typeof s !== 'number' && typeof e !== 'number') return null;
  const a = Math.min(1, Math.max(0, typeof s === 'number' ? s : 0));
  const b = Math.min(1, Math.max(0, typeof e === 'number' ? e : 1));
  return { from: Math.min(a, b), to: Math.max(a, b) };
}

/** Options for {@link kfLookVars}: the alpha of the base colours, which a key does not carry. */
export interface KfLookVarOpts {
  fillAlpha?: number;
  strokeAlpha?: number;
}

const n4 = (v: number): string => String(Math.round(v * 10000) / 10000);

/**
 * The custom properties a pose is written as, by `KF_LOOK_VARS` name. Only the keyed
 * paints appear, so the map is empty for a pose with no appearance channel.
 *
 * Trim: the stroke carries `pathLength="1"`, so a span is a dash of its own length and
 * a gap of 2 (longer than the whole stroke), shifted back by its start. A span that
 * covers the whole stroke is `none`, so a closed outline keeps its join where the dash
 * would otherwise leave two caps; an empty one switches the stroke off.
 */
export function kfLookVars(pose: KfPose, opts: KfLookVarOpts = {}): Record<string, string> {
  const out: Record<string, string> = {};
  const fill = kfColourCss(pose, 'fill', opts.fillAlpha ?? 1);
  if (fill) out[KF_LOOK_VARS.fill] = fill;
  const stroke = kfColourCss(pose, 'stroke', opts.strokeAlpha ?? 1);
  if (stroke) out[KF_LOOK_VARS.stroke] = stroke;
  if (typeof pose.lw === 'number') out[KF_LOOK_VARS.width] = `${n4(Math.max(0, pose.lw))}px`;
  if (typeof pose.cr === 'number') out[KF_LOOK_VARS.radius] = `${n4(Math.max(0, pose.cr))}px`;
  const span = kfTrimSpan(pose);
  if (span) {
    const len = span.to - span.from;
    if (span.from <= 0 && len >= 1) {
      out[KF_LOOK_VARS.trim] = 'none';
      out[KF_LOOK_VARS.trimOffset] = '0';
      out[KF_LOOK_VARS.trimOn] = '1';
    } else {
      out[KF_LOOK_VARS.trim] = `${n4(len)} 2`;
      out[KF_LOOK_VARS.trimOffset] = n4(-span.from);
      out[KF_LOOK_VARS.trimOn] = len > 1e-6 ? '1' : '0';
    }
  }
  return out;
}

/** The box shapes a trimmed outline is drawn for. */
export type KfOutlineShape = 'rect' | 'rounded' | 'pill' | 'ellipse' | 'circle';

const f3 = (v: number): string => String(Math.round(v * 1000) / 1000);

/**
 * The outline a trimmed box shape is stroked along: the frame `w` x `h` inset by
 * `inset` on every side (half the stroke width, so the stroke stays inside the box,
 * as a box border does), with the corner radius the border's own centre line has.
 *
 * It starts where SVG starts a rounded rectangle, at the end of the top-left corner,
 * and runs clockwise; an ellipse starts at its rightmost point and runs clockwise, as
 * an SVG `<ellipse>` does. So a trim of 0 to 0.25 draws the same quarter whichever of
 * the two a reader thinks of it as. The tool hook carries a copy of this function; a
 * test pins the two to each other.
 */
export function kfOutlinePath(shape: string, w: number, h: number, radius: number, inset: number): string {
  const i = Math.max(0, Number.isFinite(inset) ? inset : 0);
  const W = Math.max(0, w - 2 * i), H = Math.max(0, h - 2 * i);
  if (shape === 'ellipse' || shape === 'circle') {
    const rx = W / 2, ry = H / 2, cx = i + rx, cy = i + ry;
    return `M${f3(cx + rx)} ${f3(cy)}A${f3(rx)} ${f3(ry)} 0 0 1 ${f3(cx)} ${f3(cy + ry)}`
      + `A${f3(rx)} ${f3(ry)} 0 0 1 ${f3(cx - rx)} ${f3(cy)}`
      + `A${f3(rx)} ${f3(ry)} 0 0 1 ${f3(cx)} ${f3(cy - ry)}`
      + `A${f3(rx)} ${f3(ry)} 0 0 1 ${f3(cx + rx)} ${f3(cy)}Z`;
  }
  const outer = shape === 'pill' ? Math.min(w, h) / 2 : shape === 'rounded' || shape === 'rect' ? Math.max(0, radius) : 0;
  const r = Math.min(Math.max(0, outer - i), W / 2, H / 2);
  const x0 = i, y0 = i, x1 = i + W, y1 = i + H;
  if (!(r > 0)) {
    return `M${f3(x0)} ${f3(y0)}H${f3(x1)}V${f3(y1)}H${f3(x0)}Z`;
  }
  const arc = (x: number, y: number): string => `A${f3(r)} ${f3(r)} 0 0 1 ${f3(x)} ${f3(y)}`;
  return `M${f3(x0 + r)} ${f3(y0)}H${f3(x1 - r)}${arc(x1, y0 + r)}V${f3(y1 - r)}${arc(x1 - r, y1)}`
    + `H${f3(x0 + r)}${arc(x0, y1 - r)}V${f3(y0 + r)}${arc(x0 + r, y0)}Z`;
}
