// SPDX-License-Identifier: MPL-2.0
/**
 * Logo variant classification (plan 97 section 7.3) - pure heuristics that propose a
 * slot in the orientation × treatment matrix so a dropped logo file lands
 * somewhere sensible instead of asking the user to pick from eight boxes.
 *
 * Three independent judgments, each with its own confidence and its own short
 * reason fragment (the reasons become confirm chips in the Logos room, so they
 * are written as UI-ready English):
 *
 *   ORIENTATION - content-bounds aspect ratio. Wide reads horizontal, near
 *                 square or taller reads vertical/stacked, and the band between
 *                 the two thresholds is judged horizontal at low confidence.
 *   INK - the distinct non-neutral hues painted. One hue (or nothing but
 *                 neutrals) is a one-colour mark; two or more is full colour.
 *   POLARITY - how light the ink is. Predominantly light ink only works on a
 *                 dark background, which is what "reverse" means.
 *
 * DOM-free and dependency-light on purpose: the same call runs in the shell, in
 * a worker, and in the test suite. It deliberately does NOT import brand-logos.ts
 * (which pulls in the bridge and i18n); the four treatment strings are matched
 * against LOGO_TREATMENTS there by hand and must stay in step with it.
 *
 * The heuristics WILL misfile - the plan's accepted ceiling is one drag to
 * reslot, so confidence is reported honestly rather than rounded up, and an
 * ambiguous file is expected to come back below the room's confirm threshold.
 */

import { extractSvgColors, hexToOklch, parseColor, colorToHexString } from '@lolly/engine';
import { svgContentBounds } from './trim-bounds.ts';

export interface LogoClassification {
  orientation: 'horizontal' | 'vertical';
  treatment: 'primary' | 'primary-reverse' | 'mono' | 'mono-reverse';
  confidence: number;
  reasons: string[];
}

/** OKLCH chroma at or below this is neutral - a grey, a white or a black, which
 *  carries no hue and so never counts towards "full colour". */
const NEUTRAL_CHROMA_MAX = 0.03;
/** OKLCH lightness at or above this is light ink, i.e. ink for a dark ground. */
const LIGHT_L_MIN = 0.85;
/** Two hues closer than this are one ink family (a tint pair, not two colours). */
const HUE_CLUSTER_DEG = 20;
/** width/height at or above this is unambiguously horizontal. */
const RATIO_HORIZONTAL = 1.6;
/** width/height at or below this is unambiguously vertical/stacked. */
const RATIO_VERTICAL = 1.25;

interface Ink { l: number; c: number; h: number; weight: number }
interface Judgment<T> { value: T; confidence: number; reason: string }

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Circular hue distance in degrees. */
function hueGap(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360 + 360) % 360);
  return d > 180 ? 360 - d : d;
}

function toInk(color: string, weight: number): Ink | null {
  if (typeof color !== 'string' || color.length === 0) return null;
  if (!(weight > 0)) return null;
  // extractSvgColors passes a valid CSS NAMED colour through verbatim, so a hex
  // is not guaranteed; parseColor covers both and every other CSS notation.
  const hex = color.startsWith('#') ? color : (() => {
    const parsed = parseColor(color);
    return parsed && parsed.alpha > 0 ? colorToHexString(parsed) : null;
  })();
  if (hex == null) return null;
  const lch = hexToOklch(hex);
  if (!lch) return null;
  if (lch.alpha != null && lch.alpha <= 0) return null;
  return { l: lch.l, c: lch.c, h: lch.h, weight };
}

function judgeOrientation(width: number, height: number): Judgment<'horizontal' | 'vertical'> {
  if (!(width > 0) || !(height > 0)) {
    return { value: 'horizontal', confidence: 0.1, reason: 'no content bounds found' };
  }
  const ratio = width / height;
  const shape = `${ratio.toFixed(1)} to 1`;
  if (ratio >= RATIO_HORIZONTAL) {
    return {
      value: 'horizontal',
      confidence: ratio >= 2 ? 0.95 : 0.8,
      reason: `wide content bounds, ${shape}`,
    };
  }
  if (ratio <= RATIO_VERTICAL) {
    return {
      value: 'vertical',
      confidence: ratio <= 1 ? 0.9 : 0.65,
      reason: ratio <= 1 ? `tall content bounds, ${shape}` : `near square content bounds, ${shape}`,
    };
  }
  return { value: 'horizontal', confidence: 0.35, reason: `between wide and square, ${shape}` };
}

function judgeInk(inks: Ink[]): Judgment<'mono' | 'primary'> {
  if (inks.length === 0) {
    return { value: 'mono', confidence: 0.2, reason: 'no inks found' };
  }
  const hued = inks.filter(i => i.c > NEUTRAL_CHROMA_MAX);
  if (hued.length === 0) {
    return { value: 'mono', confidence: 0.8, reason: 'neutral inks only' };
  }
  const clusters: number[] = [];
  for (const ink of hued) {
    if (!clusters.some(h => hueGap(h, ink.h) <= HUE_CLUSTER_DEG)) clusters.push(ink.h);
  }
  if (clusters.length === 1) {
    return {
      value: 'mono',
      confidence: hued.length === inks.length ? 0.85 : 0.75,
      reason: '1 ink hue',
    };
  }
  return { value: 'primary', confidence: 0.9, reason: `${clusters.length} ink hues` };
}

/** `lightShare` is the weighted share of ink at or above LIGHT_L_MIN, in [0,1]. */
function judgePolarity(lightShare: number | null): Judgment<'reverse' | 'normal'> {
  if (lightShare == null) {
    return { value: 'normal', confidence: 0.2, reason: 'ink lightness unknown' };
  }
  if (lightShare >= 0.8) return { value: 'reverse', confidence: 0.9, reason: 'light ink, reads on dark' };
  if (lightShare <= 0.2) return { value: 'normal', confidence: 0.9, reason: 'dark ink, reads on light' };
  if (lightShare > 0.5) return { value: 'reverse', confidence: 0.5, reason: 'mostly light ink' };
  return { value: 'normal', confidence: 0.5, reason: 'mixed ink lightness' };
}

function lightShareOf(inks: Ink[]): number | null {
  const total = inks.reduce((s, i) => s + i.weight, 0);
  if (!(total > 0)) return null;
  return inks.reduce((s, i) => s + (i.l >= LIGHT_L_MIN ? i.weight : 0), 0) / total;
}

function combine(
  orientation: Judgment<'horizontal' | 'vertical'>,
  ink: Judgment<'mono' | 'primary'>,
  polarity: Judgment<'reverse' | 'normal'>,
  extraReasons: string[] = [],
  confidenceScale = 1,
): LogoClassification {
  const mean = (orientation.confidence + ink.confidence + polarity.confidence) / 3;
  return {
    orientation: orientation.value,
    treatment: polarity.value === 'reverse'
      ? (ink.value === 'primary' ? 'primary-reverse' : 'mono-reverse')
      : ink.value,
    confidence: round2(Math.min(1, Math.max(0, mean * confidenceScale))),
    reasons: [orientation.reason, ink.reason, polarity.reason, ...extraReasons],
  };
}

/** Root-tag bounds, used only when svgContentBounds cannot measure the artwork:
 *  the viewBox is the authored artboard (padding included), which is a worse
 *  orientation signal than real content bounds but far better than nothing. */
function rootBox(svgText: string): { width: number; height: number } | null {
  const tag = /<svg\b[^>]*>/i.exec(svgText)?.[0];
  if (!tag) return null;
  const viewBox = /\bviewBox\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
  if (viewBox) {
    const n = viewBox.trim().split(/[\s,]+/).map(Number);
    const [, , vw = NaN, vh = NaN] = n;
    if (n.length >= 4 && Number.isFinite(vw) && Number.isFinite(vh) && vw > 0 && vh > 0) {
      return { width: vw, height: vh };
    }
  }
  const num = (attr: string): number => {
    const raw = new RegExp(`\\b${attr}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag)?.[1];
    // Strip any CSS unit; classification only needs the ratio, and width/height
    // on one element always share a unit.
    const v = raw == null ? NaN : Number.parseFloat(raw);
    return Number.isFinite(v) ? v : NaN;
  };
  const w = num('width');
  const h = num('height');
  return w > 0 && h > 0 ? { width: w, height: h } : null;
}

/**
 * Classify an SVG logo from its source text. Returns null when the text is not
 * readable as an SVG at all (empty, non-string, or carrying no `<svg>` root) - 
 * every other input produces a classification, with the confidence reporting
 * how much of it was guesswork.
 */
export function classifyLogoSvg(svgText: string): LogoClassification | null {
  if (typeof svgText !== 'string' || svgText.length === 0) return null;
  if (!/<svg[\s/>]/i.test(svgText)) return null;

  const extra: string[] = [];
  let box = svgContentBounds(svgText);
  if (!box || !(box.width > 0) || !(box.height > 0)) {
    const root = rootBox(svgText);
    box = root ? { x: 0, y: 0, width: root.width, height: root.height } : null;
    if (box) extra.push('bounds from artboard, not content');
  }

  // extractSvgColors deduplicates and reports no coverage, so every distinct
  // paint weighs the same here. Area weighting needs a renderer; the raster
  // path is where real weights come from.
  const inks = extractSvgColors(svgText)
    .map(c => toInk(c, 1))
    .filter((i): i is Ink => i != null);

  return combine(
    judgeOrientation(box?.width ?? 0, box?.height ?? 0),
    judgeInk(inks),
    judgePolarity(lightShareOf(inks)),
    extra,
  );
}

/**
 * Classify a raster logo from stats a caller already computed (a quantized
 * colour census plus two coverage shares over the opaque pixels). Always
 * returns a classification - a raster always has dimensions, so there is no
 * unreadable case to report.
 *
 * `transparentShare` is the share of the image that is transparent; a mark with
 * almost none has its background baked in, so the polarity read is measuring
 * that background as much as the ink and the confidence is scaled down to say so.
 */
export function classifyLogoRasterStats(stats: {
  width: number;
  height: number;
  colors: { hex: string; weight: number }[];
  transparentShare: number;
  lightShare: number;
}): LogoClassification {
  const inks = (Array.isArray(stats.colors) ? stats.colors : [])
    .map(c => toInk(c?.hex, c?.weight))
    .filter((i): i is Ink => i != null);

  const share = Number.isFinite(stats.lightShare)
    ? Math.min(1, Math.max(0, stats.lightShare))
    : lightShareOf(inks);

  const opaque = Number.isFinite(stats.transparentShare)
    ? 1 - Math.min(1, Math.max(0, stats.transparentShare))
    : 1;
  const baked = opaque > 0.9;

  return combine(
    judgeOrientation(stats.width, stats.height),
    judgeInk(inks),
    judgePolarity(share),
    baked ? ['no transparency, background baked in'] : [],
    baked ? 0.8 : 1,
  );
}
