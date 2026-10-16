// SPDX-License-Identifier: MPL-2.0
/**
 * App chrome from a design pack: the model behind brand-vars.ts's pack chrome.
 *
 * A pack may set the colour that marks unsaved work and the app's own
 * surfaces, edges and inks with a `color.chrome.*` group inside each theme
 * set, beside its `color.semantic.*` slots. This module reads that group per
 * theme, derives the surfaces a pack leaves out from its page and checks that
 * the room it would paint still reads. It is pure: no DOM, no storage and no
 * import of brand-vars.ts, which turns the answer into CSS. The token-value
 * conversion and the APCA measure arrive as parameters, so no import cycle
 * forms.
 *
 * Each theme is all or nothing. A theme whose pairs do not read keeps Lolly's
 * room (the static tokens.css blocks) and its first failing pair is reported.
 * Light and dark chrome step aside under High contrast (brand-vars.ts's
 * selectors exclude the attribute), so Lolly's measured High contrast room is
 * what every pack shows there. Brand chrome is read only from a document whose
 * `$themes` declares a theme called `brand`: asking for a theme the document
 * does not declare answers with its default sets (engine/src/token-selection.ts),
 * which would hand the brand theme the light values. Brand chrome does not reach
 * two High contrast measurements, the accent repair and the error-text red, which
 * brand-vars.ts still takes against the brand room it builds from the primaries
 * (docs/design-tokens.md lists the limit).
 */
import { contrastRatio, hexToOklch, oklchToHex } from '../../../../engine/src/brand-derive.ts';

/** A shell theme a pack can dress. */
export type ChromeThemeName = 'light' | 'dark' | 'brand';

/** The themes in emission order. */
export const CHROME_THEMES: readonly ChromeThemeName[] = ['light', 'dark', 'brand'];

/** A leaf of the `color.chrome` group. */
export type ChromeSlot = 'page' | 'raised' | 'overlay' | 'muted' | 'hover' | 'edge' | 'ink' | 'muted-ink' | 'unsaved';

/** One theme's resolved chrome, as #rrggbb. A null ink means the pack declares
 *  none, so Lolly's own ink for the theme stays in force. */
export interface ChromeTheme {
  page: string;
  raised: string;
  overlay: string;
  muted: string;
  hover: string;
  edge: string;
  ink: string | null;
  mutedInk: string | null;
}

/** A pack's chrome group, resolved: the themes whose checks all pass, the
 *  unsaved colour each theme declares and one line for each theme that keeps
 *  Lolly's room. */
export interface PackChrome {
  light?: ChromeTheme;
  dark?: ChromeTheme;
  brand?: ChromeTheme;
  unsaved: Partial<Record<ChromeThemeName, string>>;
  issues: string[];
}

/** How a slot is filled when a pack leaves it out. */
export type ChromeFill = 'required' | 'derived' | 'raised' | 'lolly' | 'warm';

/**
 * The `color.chrome.*` slots, the static custom properties each one sets and
 * what stands in when a pack leaves the slot out: `required` (without a page a
 * theme has no surface chrome), `derived` (from the page, see deriveChrome),
 * `raised` (the raised surface), `lolly` (Lolly's own ink stays) or `warm`
 * (brand-vars.ts's nearestWarmHex pick, else the CSS fallback). Never set from
 * here: `--foreground-canvas`, `--primary`, `--ring`, the destructive fills,
 * `--store-*`, `--radius` and `--space`. The semantic primaries own the accent,
 * and the error-text red is recomputed per pack in brand-vars.ts.
 */
export const CHROME_SLOTS: ReadonlyArray<{ slot: ChromeSlot; key: keyof ChromeTheme | null; names: readonly string[]; fill: ChromeFill }> = [
  { slot: 'page', key: 'page', names: ['--background'], fill: 'required' },
  { slot: 'raised', key: 'raised', names: ['--card'], fill: 'derived' },
  { slot: 'overlay', key: 'overlay', names: ['--popover'], fill: 'raised' },
  { slot: 'muted', key: 'muted', names: ['--muted', '--secondary'], fill: 'derived' },
  { slot: 'hover', key: 'hover', names: ['--accent'], fill: 'derived' },
  { slot: 'edge', key: 'edge', names: ['--border', '--input'], fill: 'derived' },
  { slot: 'ink', key: 'ink', names: ['--foreground', '--card-foreground', '--popover-foreground', '--secondary-foreground', '--accent-foreground'], fill: 'lolly' },
  { slot: 'muted-ink', key: 'mutedInk', names: ['--muted-foreground'], fill: 'lolly' },
  { slot: 'unsaved', key: null, names: ['--brand-warn', '--brand-warn-ink'], fill: 'warm' },
];

/** OKLCH lightness steps from the page to each surface derived from it: the
 *  steps between tokens.css's own light and dark surfaces. Brand takes dark's. */
export const DERIVE_STEPS = {
  light: { raised: -0.009, muted: -0.032, hover: -0.048, edge: -0.131 },
  dark: { raised: 0.037, muted: 0.117, hover: 0.155, edge: 0.155 },
} as const;

/** A derived edge's chroma: half as much again as the page's, at least 0.01 and
 *  at most 0.04, so a hairline carries the page's tint. A neutral page measures
 *  OKLCH hue 0, so its edge is a faint rose grey, like brandThemeCss's neutral room. */
const edgeChroma = (c: number): number => Math.min(Math.max(c * 1.5, 0.01), 0.04);

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/**
 * One theme's chrome from the slots a pack declares (#rrggbb each, absent when
 * not declared), the undeclared surfaces derived from the page at its own hue
 * and chroma. Null without a page, because the other surfaces need one.
 */
export function deriveChrome(theme: ChromeThemeName, raw: Partial<Record<ChromeSlot, string>>): ChromeTheme | null {
  const page = raw.page ? hexToOklch(raw.page) : null;
  if (!raw.page || !page) return null;
  const steps = DERIVE_STEPS[theme === 'light' ? 'light' : 'dark'];
  const at = (dl: number, c = page.c): string => oklchToHex({ l: clamp01(page.l + dl), c, h: page.h });
  const raised = raw.raised ?? at(steps.raised);
  return {
    page: raw.page,
    raised,
    overlay: raw.overlay ?? raised,
    muted: raw.muted ?? at(steps.muted),
    hover: raw.hover ?? at(steps.hover),
    edge: raw.edge ?? at(steps.edge, edgeChroma(page.c)),
    ink: raw.ink ?? null,
    mutedInk: raw['muted-ink'] ?? null,
  };
}

/** The OKLCH lightness each theme's surfaces must keep: a light ground stays
 *  light, a dark one dark and the brand theme mid-dark, because the High
 *  contrast brand block's white inks assume a brand ground is never light
 *  (styles/tokens.css). */
export const CHROME_BANDS: Readonly<Record<ChromeThemeName, readonly [number, number]>> = {
  light: [0.85, 1],
  dark: [0, 0.4],
  brand: [0.2, 0.42],
};

/** Lolly's own ink and muted ink per theme (styles/tokens.css, as hex), which a
 *  pack's surfaces are measured against when the pack declares no ink. The brand
 *  pair is the static block's; brandThemeCss builds its inks at about the same
 *  OKLCH lightness in the pack's hue. */
export const STATIC_INKS: Readonly<Record<ChromeThemeName, { ink: string; mutedInk: string }>> = {
  light: { ink: '#030711', mutedInk: '#4e5e74' },
  dark: { ink: '#e1e7ef', mutedInk: '#b6c0ce' },
  brand: { ink: '#e4f1ed', mutedInk: '#d5e2dd' },
};

/** The High contrast brand block's inks and edge (styles/tokens.css). Brand
 *  chrome stays in force under High contrast and these win over the pack's own,
 *  so they have to read on the pack's brand surfaces too. */
export const HC_BRAND_INKS = { ink: '#ffffff', mutedInk: '#e0e0e0', edge: '#b8b8b8' } as const;

/** WCAG 2 ratio body text needs. */
const TEXT_RATIO = 4.5;
/** WCAG 2 ratio a hairline or a control's edge needs. */
const EDGE_RATIO = 3;
/** tokens.css's High contrast bars in APCA Lc: body text and the main ink on the page. */
const HC_TEXT_LC = 75;
const HC_PAGE_LC = 90;

type Surface = 'page' | 'raised' | 'overlay' | 'muted' | 'hover';
const SURFACES: readonly Surface[] = ['page', 'raised', 'overlay', 'muted', 'hover'];
const RESTING: readonly Surface[] = ['page', 'raised', 'overlay', 'muted'];

/** |APCA Lc| of text on a ground (brand-vars.ts's apcaLcAbs). */
export type LcMeasure = (text: string, ground: string) => number;

/**
 * Every check one theme's chrome fails, in order, each line giving the theme,
 * the pair and the measurement; empty means apply. The surfaces keep the
 * theme's lightness band. The ink (the pack's, else Lolly's) reads 4.5:1 on
 * every surface and the muted ink on the resting ones. Under the brand theme
 * the High contrast block's inks clear its Lc bars and its edge reads 3:1.
 */
export function chromeIssues(theme: ChromeThemeName, chrome: ChromeTheme, lc: LcMeasure, inks = STATIC_INKS[theme]): string[] {
  const out: string[] = [];
  const [lo, hi] = CHROME_BANDS[theme];
  for (const s of SURFACES) {
    const l = hexToOklch(chrome[s])?.l;
    if (l === undefined || l < lo || l > hi) {
      out.push(`${theme}: ${s} ${chrome[s]} has OKLCH lightness ${l === undefined ? 'unknown' : l.toFixed(3)}, outside ${lo} to ${hi}`);
    }
  }
  const ratio = (v: number): string => `${v.toFixed(2)}:1`;
  const apca = (v: number): string => `Lc ${v.toFixed(1)}`;
  const check = (what: string, ink: string, on: readonly Surface[], measure: (ground: string) => number, bar: number, fmt: (v: number) => string): void => {
    for (const s of on) {
      const v = measure(chrome[s]);
      if (!(v >= bar)) out.push(`${theme}: ${what} ${ink} on ${s} ${chrome[s]} reads ${fmt(v)}, under ${fmt(bar)}`);
    }
  };
  const ink = chrome.ink ?? inks.ink;
  const mutedInk = chrome.mutedInk ?? inks.mutedInk;
  check('ink', ink, SURFACES, (g) => contrastRatio(ink, g), TEXT_RATIO, ratio);
  check('muted ink', mutedInk, RESTING, (g) => contrastRatio(mutedInk, g), TEXT_RATIO, ratio);
  if (theme === 'brand') {
    const hc = HC_BRAND_INKS;
    check('High contrast ink', hc.ink, ['page'], (g) => lc(hc.ink, g), HC_PAGE_LC, apca);
    check('High contrast ink', hc.ink, SURFACES, (g) => lc(hc.ink, g), HC_TEXT_LC, apca);
    check('High contrast muted ink', hc.mutedInk, RESTING, (g) => lc(hc.mutedInk, g), HC_TEXT_LC, apca);
    check('High contrast edge', hc.edge, ['page', 'raised', 'overlay'], (g) => contrastRatio(hc.edge, g), EDGE_RATIO, ratio);
  }
  return out;
}

/** The tokens surface read here: brand-vars.ts's BrandTokens, which the web bridge answers. */
export interface ChromeTokens {
  resolve(ref: string, opts?: { theme?: string }): Promise<unknown>;
  themes?(): Promise<Array<{ name: string }>>;
}

/** What resolvePackChrome borrows from brand-vars.ts. */
export interface ChromeMeasures {
  /** A resolved token value to #rrggbb, or null when it is not a colour (tokenValueToHex). */
  toHex(value: unknown): string | null;
  /** |APCA Lc| (apcaLcAbs), for the High contrast brand check. */
  lc: LcMeasure;
}

/** One theme set's `color.chrome.*` slots, as lower-case #rrggbb. */
async function readSlots(tokens: ChromeTokens, theme: ChromeThemeName, toHex: ChromeMeasures['toHex']): Promise<Partial<Record<ChromeSlot, string>>> {
  const raw: Partial<Record<ChromeSlot, string>> = {};
  await Promise.all(CHROME_SLOTS.map(async ({ slot }) => {
    try {
      const hex = toHex(await tokens.resolve(`{color.chrome.${slot}}`, { theme }));
      if (hex) raw[slot] = hex.toLowerCase();
    } catch { /* a slot that does not resolve is absent */ }
  }));
  return raw;
}

/**
 * Resolve a pack's chrome: the nine slots in the light and dark theme sets, and
 * in the brand set only when the document declares a theme called `brand`.
 * Never throws: a slot that does not resolve, or is not a colour, is absent.
 */
export async function resolvePackChrome(tokens: ChromeTokens | undefined, measures: ChromeMeasures): Promise<PackChrome> {
  const out: PackChrome = { unsaved: {}, issues: [] };
  if (!tokens) return out;
  const themes: ChromeThemeName[] = ['light', 'dark'];
  try {
    if ((await tokens.themes?.())?.some((t) => t.name === 'brand')) themes.push('brand');
  } catch { /* a document whose themes cannot be listed has no brand chrome */ }
  const read = await Promise.all(themes.map((theme) => readSlots(tokens, theme, measures.toHex)));
  themes.forEach((theme, i) => {
    const raw = read[i] ?? {};
    if (raw.unsaved) out.unsaved[theme] = raw.unsaved;
    const chrome = deriveChrome(theme, raw);
    if (!chrome) return;
    const issues = chromeIssues(theme, chrome, measures.lc);
    if (issues[0]) out.issues.push(issues[0]);
    else out[theme] = chrome;
  });
  return out;
}

/** Does the pack declare an unsaved colour for any theme? Then the colour moves
 *  from brand-vars.ts's inline warm pick into the per-theme sheet. */
export function declaresUnsaved(chrome: PackChrome | null | undefined): boolean {
  return !!chrome && CHROME_THEMES.some((t) => !!chrome.unsaved[t]);
}
