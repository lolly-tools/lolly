// SPDX-License-Identifier: MPL-2.0
/**
 * The Rondocode editor's colour table, taken from the app around the editor.
 *
 * Upstream rondocode is dark only: its palette (ui/palette.ts) is a green-cast
 * black with phosphor-coloured text, and every colour in the app comes from that
 * one table. Inside Lolly the editor follows the app instead: light when the app
 * is light, dark when it is dark, and in the active design system's colours.
 * The parent page sends the app's own semantic colours (the --ui-color-* tokens
 * of shells/web/src/styles/tokens.css: surfaces, text, borders, the action and
 * danger colours) and the design system's brand hues, resolved to hex. The
 * surfaces and text come straight from those tokens, so the editor looks like
 * the rest of Lolly; the syntax hues come from the brand hues, each one searched
 * in lightness until it keeps its contrast against the editor background, in
 * either direction, so light and dark each get a set that passes.
 *
 * Pure and deterministic. The maths is the engine's own (OKLCH conversion,
 * sRGB gamut mapping and the WCAG contrast ratio in engine/src/brand-derive.ts),
 * so a colour here agrees with the colour the rest of Lolly computes for the
 * same token.
 */
import { contrastRatio, hexToOklch, oklchToHex, type Oklch } from '../../../engine/src/brand-derive.ts';

/** The app's semantic colours, as the parent page resolves them, every value '#rrggbb'. */
export interface UiColours {
  /** --ui-color-surface-canvas: the page. The editor background. */
  canvas?: string;
  /** --ui-color-surface-raised: cards and bars. */
  raised?: string;
  /** --ui-color-surface-muted: hover and quiet fills. */
  muted?: string;
  /** --ui-color-surface-overlay: popovers. */
  overlay?: string;
  /** --ui-color-border-default. */
  border?: string;
  /** --ui-color-text-default. */
  text?: string;
  /** --ui-color-text-muted. */
  textMuted?: string;
  /** --ui-color-action-primary. */
  accent?: string;
  /** --ui-color-status-danger. */
  danger?: string;
}

/** What the parent page reads from the app and its design system, every colour '#rrggbb'. */
export interface ThemeInput {
  /** The brand's main colour (`--brand-primary`). */
  primary?: string;
  /** A second brand colour, if the design system has one (`--brand-secondary`). */
  secondary?: string;
  /** The design system's warm accent (`--brand-warn`). */
  warn?: string;
  /** The design system's danger colour (`--destructive`). */
  danger?: string;
  /** Light or dark, as the app is now. Absent: read from the canvas colour, else dark. */
  mode?: 'light' | 'dark';
  /** The app's semantic colours. Absent: surfaces are generated from the brand hue. */
  ui?: UiColours;
  /** The app's high-contrast preference (data-a11y-contrast="high"): text keeps 7:1. */
  highContrast?: boolean;
}

/**
 * The entries of upstream's palette, plus the few colours upstream wrote as
 * literals that also need to follow the brand: the syntax hues that are not
 * shared constants, and the text drawn on the run button and on an accent fill.
 */
export interface RondoPalette {
  bg: string;
  bar: string;
  surface: string;
  raised: string;
  border: string;
  text: string;
  dim: string;
  faint: string;
  accent: string;
  accentAlt: string;
  green: string;
  greenDeep: string;
  warn: string;
  rest: string;
  error: string;
  errorBg: string;
  errorBorder: string;
  grid: string;
  keyword: string;
  property: string;
  magenta: string;
  onGreen: string;
  onAccent: string;
}

/** The contrast each text-like entry keeps against the editor background. */
export const TEXT_CONTRAST = 4.5;
/** Secondary marks (line numbers, comments, hairlines that carry meaning). */
export const FAINT_CONTRAST = 3;
/** Text under the app's high-contrast preference (WCAG AAA). */
export const HIGH_CONTRAST = 7;

/** Upstream's own hues, used when the design system does not give one. */
const DEFAULTS = {
  primary: '#6ee7b7',
  warn: '#f2b155',
  danger: '#ff6b6b',
} as const;

const normHue = (h: number): number => ((h % 360) + 360) % 360;

function oklchOf(hex: string | undefined): Oklch | null {
  if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex.trim())) return null;
  return hexToOklch(hex.trim());
}

const hex = (l: number, c: number, h: number): string => oklchToHex({ l, c: Math.max(0, c), h: normHue(h) });

/**
 * The lightest-first search for a colour of hue `h` and chroma `c` that reaches
 * `target` contrast against `against`. Lightness climbs from `start` in small
 * steps, so the result stays as close to the brand's own lightness as the
 * contrast rule allows. Returns the brightest step tried if none reaches the
 * target, which only happens for a target above what any colour can reach.
 */
export function solveLight(h: number, c: number, start: number, against: string, target: number): string {
  let best = hex(start, c, h);
  for (let l = Math.max(0, Math.min(start, 0.99)); l <= 0.99; l += 0.01) {
    best = hex(l, c, h);
    if (contrastRatio(best, against) >= target) return best;
  }
  return best;
}

/** The darker-first search: for text on a light background or a light fill. */
export function solveDark(h: number, c: number, start: number, against: string, target: number): string {
  let best = hex(start, c, h);
  for (let l = Math.min(1, Math.max(start, 0.01)); l >= 0; l -= 0.01) {
    best = hex(l, c, h);
    if (contrastRatio(best, against) >= target) return best;
  }
  return best;
}

/** Text for a fill: the brand-tinted near-white or near-black, whichever reads better. */
function inkOn(fill: string, h: number): string {
  const light = solveLight(h, 0.02, 0.96, fill, TEXT_CONTRAST);
  const dark = solveDark(h, 0.03, 0.2, fill, TEXT_CONTRAST);
  return contrastRatio(light, fill) >= contrastRatio(dark, fill) ? light : dark;
}

/** Hue distance in degrees, 0 to 180. */
const hueGap = (a: number, b: number): number => {
  const d = Math.abs(normHue(a) - normHue(b));
  return Math.min(d, 360 - d);
};

/** OKLCH of a colour this module made or checked (always parseable). */
const ok = (value: string): Oklch => hexToOklch(value) ?? { l: 0.5, c: 0, h: 0 };

/** A colour between two, by OKLCH lightness and chroma (the hue of `a`). */
function between(a: string, b: string, t: number): string {
  const x = ok(a);
  const y = ok(b);
  return hex(x.l + (y.l - x.l) * t, x.c + (y.c - x.c) * t, x.h);
}

/**
 * Derive the table. Every input is optional; with none, the table is dark, the
 * hues are upstream's own and only the lightness rules apply.
 */
export function derivePalette(input: ThemeInput = {}): RondoPalette {
  const hero = oklchOf(input.primary) ?? oklchOf(input.ui?.accent) ?? oklchOf(DEFAULTS.primary)!;
  // A near-grey brand colour carries no usable hue, so the neutrals stay grey
  // and the accents fall back to upstream's mint hue.
  const chromatic = hero.c >= 0.03;
  const h = chromatic ? hero.h : (oklchOf(DEFAULTS.primary)!.h);
  const accentC = chromatic ? Math.min(Math.max(hero.c, 0.1), 0.2) : 0.12;
  // Tinted neutrals: a little of the brand hue in every generated surface, as
  // upstream tints its surfaces green.
  const tint = chromatic ? Math.min(0.025, hero.c * 0.2) : 0.004;

  const ui = input.ui ?? {};
  const canvas = oklchOf(ui.canvas);
  const dark = input.mode ? input.mode === 'dark' : canvas ? canvas.l < 0.6 : true;
  const textTarget = input.highContrast ? HIGH_CONTRAST : TEXT_CONTRAST;
  const faintTarget = input.highContrast ? TEXT_CONTRAST : FAINT_CONTRAST;
  /** A hue at a contrast: lighter on a dark background, darker on a light one. */
  const solve = (hue: number, c: number, startDark: number, startLight: number, target: number, against: string): string =>
    dark ? solveLight(hue, c, startDark, against, target) : solveDark(hue, c, startLight, against, target);
  /** The app's own colour when it keeps the contrast; else a search from its hue. */
  const keep = (given: string | undefined, target: number, against: string, fallback: () => string): string => {
    const g = oklchOf(given);
    if (g && given && contrastRatio(given, against) >= target) return given.toLowerCase();
    if (g) return solve(g.h, g.c, Math.max(g.l, 0.6), Math.min(g.l, 0.5), target, against);
    return fallback();
  };

  // Surfaces: the app's own, else generated in the brand hue.
  const bg = canvas && ui.canvas ? ui.canvas.toLowerCase() : dark ? hex(0.17, tint, h) : hex(0.985, tint * 0.4, h);
  const raised = oklchOf(ui.raised) && ui.raised ? ui.raised.toLowerCase() : dark ? hex(0.26, tint * 1.1, h) : hex(0.955, tint * 0.6, h);
  const bar = oklchOf(ui.raised) && ui.raised ? ui.raised.toLowerCase() : dark ? hex(0.2, tint, h) : hex(0.97, tint * 0.5, h);
  const surface = oklchOf(ui.muted) && ui.muted ? ui.muted.toLowerCase() : dark ? hex(0.22, tint, h) : hex(0.94, tint * 0.7, h);
  const borderIn = oklchOf(ui.border) && ui.border ? ui.border.toLowerCase() : dark ? hex(0.35, tint * 1.4, h) : hex(0.86, tint, h);
  const border = input.highContrast ? solve(ok(borderIn).h, ok(borderIn).c, 0.5, 0.5, FAINT_CONTRAST, bg) : borderIn;
  const grid = between(bg, borderIn, 0.45);

  const text = keep(ui.text, input.highContrast ? HIGH_CONTRAST : 7, bg, () => solve(h, Math.min(0.03, tint + 0.01), 0.92, 0.22, 10, bg));
  const dim = keep(ui.textMuted, textTarget, bg, () => solve(h, tint * 1.5, 0.7, 0.45, textTarget, bg));
  const faint = solve(h, tint * 1.2, dark ? 0.55 : 0.6, dark ? 0.55 : 0.62, faintTarget, bg);

  const accent = keep(ui.accent, textTarget, bg, () => solve(h, accentC, Math.max(hero.l, 0.72), Math.min(hero.l, 0.5), textTarget, bg));
  const accentHue = ok(accent).h;

  // The second trace colour: the brand's secondary when it is a real colour of
  // its own, otherwise the brand hue turned 40 degrees.
  const second = oklchOf(input.secondary);
  const altH = second && second.c >= 0.04 && hueGap(second.h, h) >= 20 ? second.h : h - 40;
  const altC = second && second.c >= 0.04 ? Math.min(Math.max(second.c, 0.09), 0.18) : accentC * 0.85;
  const accentAlt = solve(altH, altC, 0.76, 0.48, textTarget, bg);

  // The run button and selection fill: a deep tint on dark, a pale one on light.
  const green = dark ? hex(0.42, Math.min(accentC, 0.11), h) : hex(0.8, Math.min(accentC, 0.1), h);
  const greenDeep = dark ? hex(0.29, Math.min(accentC * 0.7, 0.08), h) : hex(0.9, Math.min(accentC * 0.5, 0.06), h);

  const warnIn = oklchOf(input.warn) ?? oklchOf(DEFAULTS.warn)!;
  const warn = solve(warnIn.h, Math.min(Math.max(warnIn.c, 0.1), 0.17), 0.78, 0.5, textTarget, bg);

  // Rests get their own channel, as upstream gives them violet: the hue across
  // the wheel from the brand, so a gap never reads as one of the other marks.
  const restH = h + 150;
  const rest = solve(restH, 0.12, 0.76, 0.48, textTarget, bg);
  const magenta = solve(restH + 25, 0.14, 0.8, 0.5, textTarget, bg);

  const dangerIn = oklchOf(ui.danger) ?? oklchOf(input.danger) ?? oklchOf(DEFAULTS.danger)!;
  const errH = dangerIn.c >= 0.05 ? dangerIn.h : 25;
  const error = solve(errH, 0.17, 0.66, 0.5, textTarget, bg);
  const errorBg = dark ? hex(0.19, 0.035, errH) : hex(0.96, 0.025, errH);
  const errorBorder = dark ? hex(0.32, 0.06, errH) : hex(0.86, 0.05, errH);

  const keyword = solve(accentHue, accentC * 0.55, 0.88, 0.38, textTarget, bg);
  const property = solve(h + 15, accentC * 0.75, 0.76, 0.45, textTarget, bg);

  return {
    bg, bar, surface, raised, border, text, dim, faint,
    accent, accentAlt, green, greenDeep, warn, rest,
    error, errorBg, errorBorder, grid,
    keyword, property, magenta,
    onGreen: inkOn(greenDeep, h),
    onAccent: inkOn(accent, h),
  };
}

/** The entries that are read as text on the editor background, with the contrast each must keep. */
export const TEXT_ENTRIES: ReadonlyArray<[keyof RondoPalette, number]> = [
  ['text', TEXT_CONTRAST], ['dim', TEXT_CONTRAST], ['faint', FAINT_CONTRAST],
  ['accent', TEXT_CONTRAST], ['accentAlt', TEXT_CONTRAST], ['warn', TEXT_CONTRAST],
  ['rest', TEXT_CONTRAST], ['error', TEXT_CONTRAST], ['keyword', TEXT_CONTRAST],
  ['property', TEXT_CONTRAST], ['magenta', TEXT_CONTRAST],
];

/** Every contrast check that fails for this table, as readable lines. Empty when all pass. */
export function paletteProblems(p: RondoPalette): string[] {
  const out: string[] = [];
  for (const [key, min] of TEXT_ENTRIES) {
    const r = contrastRatio(p[key], p.bg);
    if (!(r >= min)) out.push(`${key} ${p[key]} on ${p.bg} is ${r.toFixed(2)}:1, under ${min}:1`);
  }
  const pairs: Array<[keyof RondoPalette, keyof RondoPalette]> = [['onGreen', 'greenDeep'], ['onAccent', 'accent']];
  for (const [ink, fill] of pairs) {
    const r = contrastRatio(p[ink], p[fill]);
    if (!(r >= TEXT_CONTRAST)) out.push(`${ink} ${p[ink]} on ${fill} ${p[fill]} is ${r.toFixed(2)}:1, under ${TEXT_CONTRAST}:1`);
  }
  return out;
}

/** The CSS custom properties the app reads, with upstream's own property names. */
export function paletteCssVars(p: RondoPalette): Record<string, string> {
  return {
    '--c-bg': p.bg, '--c-bar': p.bar, '--c-surface': p.surface, '--c-raised': p.raised,
    '--c-border': p.border, '--c-text': p.text, '--c-dim': p.dim, '--c-faint': p.faint,
    '--c-accent': p.accent, '--c-accent-alt': p.accentAlt, '--c-green': p.green,
    '--c-green-deep': p.greenDeep, '--c-warn': p.warn, '--c-rest': p.rest, '--c-error': p.error,
    '--c-error-bg': p.errorBg, '--c-error-border': p.errorBorder, '--c-grid': p.grid,
    '--c-keyword': p.keyword, '--c-property': p.property, '--c-magenta': p.magenta,
    '--c-on-green': p.onGreen, '--c-on-accent': p.onAccent,
  };
}
