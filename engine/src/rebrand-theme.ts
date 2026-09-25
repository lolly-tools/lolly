// SPDX-License-Identifier: MPL-2.0
/**
 * Deck themes and a slide's own ground (plan 275 section 6), as ordinary plan edits.
 *
 * A theme comes from the design system and never from a colour of its own:
 *
 *   | Theme        | Ground                                   | Ink                          |
 *   |--------------|------------------------------------------|------------------------------|
 *   | Light        | the pack's light mode, as shipped        | the same mode's text         |
 *   | Dark         | the pack's own dark mode                 | the dark mode's text         |
 *   | Brand colour | `color.semantic.primary`, or a hue named | the first pack colour that   |
 *   |              | from the palette; the first brand hue    | holds 4.5:1 on that ground   |
 *   |              | apart from Dark when primary is Dark's   |                              |
 *   | A look       | the look's colours laid over the pack    | the look's text              |
 *
 * `buildDeckTheme` turns one of those into a `DeckThemeV1`: the mode, and a remap
 * from each token path the master draws with to the path of the same role in the
 * theme's colour set. The role of a path the master names by brand word
 * (`color.brand.white`) is read from its colour: the semantic slot it equals in the
 * light set. A ramp step that equals no slot is mirrored inside its own ramp for
 * Dark, so a pale card on a light slide becomes a deep card on a dark one. Every
 * target is a path of the pack, so no theme can introduce a hex the pack does not
 * state. A pack with no dark mode gets a Dark built from the darkest step of the
 * primary colour's ramp, and the build says so (`theme.no-dark-mode`); a stored Dark
 * resolved where the dark mode is missing gets the same one, never the light set.
 * `deckThemeChoices` offers no two tiles on one ground, and no look on a locked
 * design system.
 *
 * `setDeckTheme` and `setSlideGround` are plan edits with the result shape the rest
 * of `rebrand-edit.ts` returns. With a solve context they run the colour solve once
 * per ground group (`assignColorsByGround`), so a use that sits on a light slide and
 * a dark one keeps contrast on both or says why not. Every themed or moved slide is
 * measured, including the many whose source states no ground of its own, which the
 * census never pairs a text with (`measuredGrounds`). `setDeckTheme` refuses a look
 * on a locked design system; `setSlideGround` leaves a slide whose layout has no dark
 * version where it is and says so. A Brand ground is read from the stored theme, so
 * the solve and the compile cannot draw two different ones. Undo is capture and restore:
 * `captureThemeRows` takes `capturePlanRows` and adds the deck theme, which that
 * function does not read yet, and `restoreThemeRows` puts all of it back.
 *
 * `themePreview` states what the solver would find before a theme is applied: how
 * many texts would have no colour that holds 4.5:1 on their ground, and which.
 *
 * Pure: no DOM, no clock, no filesystem, no network.
 */

import type {
  ArchetypeRefV1,
  ArchetypeV1,
  ColorMappingV1,
  ColorUseV1,
  ContrastPairV1,
  DeckCensusV1,
  DeckThemeIdV1,
  DeckThemeV1,
  RenovationPlanV1,
  SlideGroundV1,
  SlideMasterV1,
  SlidePlanV1,
  SourceDeckV1,
} from '@lolly-tools/core';

import { contrastRatio, hexToOklch } from './brand-derive.ts';
import { ACCENT_CHROMA_FLOOR, LARGE_TEXT_PT } from './deck-census.ts';
import { bgIsDark } from './logo-variant.ts';
import {
  assignColors,
  assignColorsByGround,
  type AssignColorsInputV1,
  type ColorGroundIssueV1,
  type GroundGroupV1,
  type LockedColorV1,
} from './rebrand-colors.ts';
import {
  darkFallbackRemap,
  isPlainTheme,
  masterTokenPaths,
  mirroredRampStep,
  swatchesFromColors,
  themeRemapRows,
  themeSlotOf,
  themeSlotsFromColors,
  themedColors,
  type DeckLookV1,
  type ThemeNoteV1,
  type ThemeSourceV1,
  type ThemedColorsV1,
} from './rebrand-design-system.ts';
import {
  capturePlanRows,
  restorePlanRows,
  type PlanEditResultV1,
  type PlanRowsSnapshotV1,
  type PlanRowsTouchedV1,
} from './rebrand-edit.ts';
import { compareCodeUnits as compareText } from './rebrand-order.ts';

/** Identity of these rules, for a reader that records how a theme was built. */
export const THEME_RULES = { name: 'rebrand-theme', version: 'theme-2026-09-24.2' } as const;

/** The id `touched` carries when an edit changed the deck theme itself. */
export const THEME_ROW_ID = 'designSystem.theme';

/** The minimum a text needs on its ground, the ordinary text minimum. */
export const THEME_TEXT_CONTRAST = 4.5;

/** The token path the Brand colour ground takes when no hue is named. */
export const BRAND_GROUND_PATH = 'color.semantic.primary';

// ─── small helpers ───────────────────────────────────────────────────────────

const semanticPath = (slot: string): string => `color.semantic.${slot}`;

function normHex(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const raw = value.trim().toLowerCase().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/.test(raw)) return `#${[...raw].map((c) => c + c).join('')}`;
  if (/^[0-9a-f]{6}([0-9a-f]{2})?$/.test(raw)) return `#${raw.slice(0, 6)}`;
  return undefined;
}

function contrast(a: string | undefined, b: string | undefined): number {
  const x = normHex(a);
  const y = normHex(b);
  if (!x || !y) return 0;
  const ratio = contrastRatio(x, y);
  return Number.isFinite(ratio) ? ratio : 0;
}

/** JSON with sorted keys and undefined fields left out, so two equal rows compare equal. */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    const keys = Object.keys(rec).filter((key) => rec[key] !== undefined).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableJson(rec[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** Every token path the master draws with, and what it draws. */
export { masterTokenPaths };

/** The first path, in the order given, whose colour holds `minimum` on `groundHex`; else the path with the most contrast. */
function inkPathFor(groundHex: string, colors: Record<string, string>, prefer: string[], minimum = THEME_TEXT_CONTRAST): string | undefined {
  for (const tokenPath of prefer) if (colors[tokenPath] !== undefined && contrast(colors[tokenPath], groundHex) >= minimum) return tokenPath;
  let best: string | undefined;
  let bestRatio = 0;
  for (const tokenPath of Object.keys(colors).sort(compareText)) {
    const ratio = contrast(colors[tokenPath], groundHex);
    if (ratio > bestRatio) {
      best = tokenPath;
      bestRatio = ratio;
    }
  }
  return best;
}

// ─── building a theme ────────────────────────────────────────────────────────

/** The three colours a theme tile shows. */
export interface ThemeSwatchesV1 {
  ground: string;
  ink: string;
  accent: string;
}

/** One theme the person can pick, built from the design system. */
export interface DeckThemeChoiceV1 {
  id: DeckThemeIdV1;
  theme: DeckThemeV1;
  /** The look's own name, for a look theme: the report and the credits name the result by it. */
  name?: string;
  swatches: ThemeSwatchesV1;
  notes: ThemeNoteV1[];
}

export interface BuildDeckThemeOptsV1 {
  /** The token path of the hue a Brand colour theme grounds on. Defaults to `color.semantic.primary`. */
  hue?: string;
  /** The look a `look` theme lays over the design system. */
  look?: DeckLookV1;
}

const remapRows = themeRemapRows;

/**
 * The content ground and ink the deck's body slides show under a theme: the
 * `content` archetype's own, else the first light archetype's, else the semantic
 * surface and text.
 */
function contentPair(master: SlideMasterV1, colors: Record<string, string>): { ground?: string; ink?: string } {
  const content = master.archetypes.find((one) => one.id === 'content')
    ?? master.archetypes.find((one) => one.background?.dark !== true);
  const groundPath = content?.background?.tokenPath;
  const ground = (groundPath ? colors[groundPath] : undefined) ?? content?.background?.hex ?? colors[semanticPath('surface')];
  const inkPath = content?.placeholders.find((one) => one.style?.fgTokenPath)?.style?.fgTokenPath;
  const ink = (inkPath ? colors[inkPath] : undefined) ?? colors[semanticPath('text')];
  return { ...(ground ? { ground } : {}), ...(ink ? { ink } : {}) };
}

/** The ground, the ink and one accent a theme tile shows, all resolved under the theme. */
export function themeSwatches(themed: Pick<ThemedColorsV1, 'colors' | 'master'>): ThemeSwatchesV1 {
  const { colors, master } = themed;
  const pair = contentPair(master, colors);
  const ground = normHex(pair.ground) ?? '#ffffff';
  const ink = normHex(pair.ink) ?? (contrast('#000000', ground) >= contrast('#ffffff', ground) ? '#000000' : '#ffffff');
  const differs = (hex: string | undefined): hex is string => {
    const norm = normHex(hex);
    return norm !== undefined && norm !== ground && norm !== ink;
  };
  const candidates = [semanticPath('primary'), semanticPath('secondary'), semanticPath('accent')].map((one) => colors[one]);
  let accent = candidates.find(differs);
  if (!accent) {
    const chromatic = Object.keys(colors).sort(compareText)
      .map((one) => colors[one])
      .filter(differs)
      .sort((a, b) => (hexToOklch(normHex(b) ?? '')?.c ?? 0) - (hexToOklch(normHex(a) ?? '')?.c ?? 0));
    accent = chromatic[0];
  }
  return { ground, ink, accent: normHex(accent) ?? ink };
}

/**
 * Build one theme from the design system. Null for a look theme with no look, and
 * for a Brand colour theme when the design system names no hue to ground on.
 */
export function buildDeckTheme(id: DeckThemeIdV1, source: ThemeSourceV1, opts: BuildDeckThemeOptsV1 = {}): DeckThemeChoiceV1 | null {
  const light = source.colors;
  const paths = masterTokenPaths(source.master);
  const notes: ThemeNoteV1[] = [];
  let theme: DeckThemeV1;
  let name: string | undefined;

  if (id === 'light') {
    theme = { id: 'light', remap: [] };
  } else if (id === 'dark') {
    const dark = source.darkColors && Object.keys(source.darkColors).length > 0 ? source.darkColors : undefined;
    const rows = new Map<string, string>();
    if (dark) {
      for (const [tokenPath, uses] of paths) {
        const slot = themeSlotOf(tokenPath, light);
        if (slot) {
          if (dark[semanticPath(slot)] !== undefined) rows.set(tokenPath, semanticPath(slot));
          continue;
        }
        if (!uses.has('ground') && !uses.has('fill') && !uses.has('ink')) continue;
        const mirrored = mirroredRampStep(tokenPath, light, dark);
        if (mirrored) rows.set(tokenPath, mirrored);
      }
      theme = { id: 'dark', mode: 'dark', remap: remapRows(rows), flipDark: true };
    } else {
      // No dark mode: the darkest step of the primary colour's ramp is the ground,
      // the light surface is the ink, and the build says so (`darkFallbackRemap`).
      const fallback = darkFallbackRemap(light, source.master);
      if (!fallback) return null;
      theme = { id: 'dark', remap: fallback.remap, flipDark: true };
      notes.push({ code: 'theme.no-dark-mode', params: { ground: fallback.groundPath } });
    }
  } else if (id === 'brand') {
    const groundPath = opts.hue && light[opts.hue] !== undefined ? opts.hue : light[BRAND_GROUND_PATH] !== undefined ? BRAND_GROUND_PATH : undefined;
    const groundHex = groundPath ? light[groundPath] : undefined;
    if (!groundPath || !groundHex) return null;
    const slot = themeSlotOf(groundPath, light);
    const onSlot = slot ? semanticPath(`on-${slot}`) : undefined;
    const inkPath = inkPathFor(groundHex, light, [semanticPath('text'), ...(onSlot ? [onSlot] : [])]);
    const mutedPath = inkPathFor(groundHex, light, [semanticPath('muted'), ...(inkPath ? [inkPath] : [])]);
    const targets: Record<string, string> = { surface: groundPath };
    if (inkPath && inkPath !== semanticPath('text')) targets.text = inkPath;
    if (mutedPath && mutedPath !== semanticPath('muted')) targets.muted = mutedPath;
    const all = new Map(paths);
    for (const one of Object.keys(targets)) if (light[semanticPath(one)] !== undefined && !all.has(semanticPath(one))) all.set(semanticPath(one), new Set());
    const rows = new Map<string, string>();
    const inkHex = inkPath ? light[inkPath] : undefined;
    for (const [tokenPath, uses] of all) {
      const own = themeSlotOf(tokenPath, light);
      if (own) {
        const target = targets[own];
        if (target) rows.set(tokenPath, target);
        continue;
      }
      // A ground or a panel the slot table does not name (a pale card, a tinted
      // hero) takes the Brand ground when the solved ink would not hold on it, and
      // an ink it does not name takes the solved ink when it would not hold on the
      // ground: ground remapped, ink solved.
      const hex = light[tokenPath];
      if ((uses.has('ground') || uses.has('fill')) && inkHex && contrast(inkHex, hex) < THEME_TEXT_CONTRAST) rows.set(tokenPath, groundPath);
      else if (uses.has('ink') && inkPath && contrast(hex, groundHex) < THEME_TEXT_CONTRAST) rows.set(tokenPath, inkPath);
    }
    theme = { id: 'brand', remap: remapRows(rows) };
  } else {
    const look = opts.look;
    if (!look) return null;
    const rows = new Map<string, string>();
    for (const tokenPath of paths.keys()) {
      const slot = themeSlotOf(tokenPath, light);
      if (slot && look.colors[semanticPath(slot)] !== undefined) rows.set(tokenPath, semanticPath(slot));
    }
    theme = { id: 'look', remap: remapRows(rows), lookId: look.id };
    name = look.name;
  }

  const themed = themedColors(source, theme, opts.look ? { look: opts.look } : {});
  const choice: DeckThemeChoiceV1 = {
    id,
    theme,
    swatches: themeSwatches(themed),
    notes: [...notes, ...themed.notes],
  };
  if (name !== undefined) choice.name = name;
  return choice;
}

/** Two grounds closer than this read as one at a glance, so two tiles on them are one choice. */
export const THEME_DISTINCT_GROUND = 1.5;

/** The hues a Brand colour theme may ground on when the primary colour is the Dark ground: the secondary and accent, then the pack's named colours, most chromatic first. */
function brandHues(colors: Record<string, string>): string[] {
  const chroma = (tokenPath: string): number => hexToOklch(normHex(colors[tokenPath]) ?? '')?.c ?? 0;
  const named = Object.keys(colors).filter((one) => /^color\.brand\.[^.]+$/.test(one)).sort(compareText);
  const ordered = [semanticPath('secondary'), semanticPath('accent'), ...named.sort((a, b) => (chroma(b) - chroma(a)) || compareText(a, b))];
  return [...new Set(ordered)].filter((one) => colors[one] !== undefined && chroma(one) >= ACCENT_CHROMA_FLOOR);
}

/**
 * The themes the person picks from, in the order the control shows them: Light,
 * Dark, Brand colour, then one per look. Looks are left out on a locked design
 * system, because a look there is a route to an off-brand deck under the design
 * system's name (plan 275 decision 17).
 *
 * Every tile is a different choice. Where the primary colour is also the Dark
 * ground (SUSE's pine is both), Brand colour grounds on the first brand hue that
 * stands apart from the Light and Dark grounds and carries a pack ink at 4.5:1
 * (SUSE's jungle, with pine ink), and a pack with no such hue (an achromatic one)
 * offers no Brand colour tile. A hue the caller names is kept as it is.
 */
export function deckThemeChoices(source: ThemeSourceV1, opts: { locked?: boolean; looks?: DeckLookV1[]; hue?: string } = {}): DeckThemeChoiceV1[] {
  const out: DeckThemeChoiceV1[] = [];
  const light = buildDeckTheme('light', source);
  const dark = buildDeckTheme('dark', source);
  let brand = buildDeckTheme('brand', source, opts.hue ? { hue: opts.hue } : {});
  const stands = (choice: DeckThemeChoiceV1): boolean => [light, dark].every((other) => !other || contrast(choice.swatches.ground, other.swatches.ground) >= THEME_DISTINCT_GROUND);
  if (brand && !opts.hue && !stands(brand)) {
    brand = null;
    for (const hue of brandHues(source.colors)) {
      const choice = buildDeckTheme('brand', source, { hue });
      if (choice && stands(choice) && contrast(choice.swatches.ink, choice.swatches.ground) >= THEME_TEXT_CONTRAST) {
        brand = choice;
        break;
      }
    }
  }
  for (const choice of [light, dark, brand]) if (choice) out.push(choice);
  if (opts.locked !== true) {
    for (const look of opts.looks ?? []) {
      const choice = buildDeckTheme('look', source, { look });
      if (choice) out.push(choice);
    }
  }
  return out;
}

// ─── grounds ─────────────────────────────────────────────────────────────────

/** What `deckGround` reads for a look theme, whose ground is the look's own. */
export interface DeckGroundOptsV1 {
  /** The themed surface colour. Dark when it measures dark. */
  surface?: string;
  /** The master under the theme: the `content` archetype's measured `dark` flag, else the first archetype's. */
  master?: SlideMasterV1;
}

/**
 * The ground a deck theme puts its slides on, which a slide with no ground of its
 * own takes. A look theme's ground is read from its colours (`opts`): a look whose
 * surface measures dark puts the deck on dark. Without them a look counts as light.
 */
export function deckGround(theme: DeckThemeV1 | null | undefined, opts: DeckGroundOptsV1 = {}): SlideGroundV1 {
  if (theme?.id === 'dark') return 'dark';
  if (theme?.id === 'brand') return 'brand';
  if (theme?.id === 'look') {
    const surface = normHex(opts.surface);
    if (surface) return bgIsDark(surface) ? 'dark' : 'light';
    const content = opts.master?.archetypes.find((one) => one.id === 'content') ?? opts.master?.archetypes[0];
    if (content?.background?.dark === true) return 'dark';
  }
  return 'light';
}

/** The token path a Brand ground takes: the stored Brand theme's own hue, else the primary colour. */
export function brandGroundPath(theme: DeckThemeV1 | null | undefined): string {
  if (theme?.id === 'brand') {
    const surface = theme.remap.find((row) => row.from === semanticPath('surface'))?.to;
    if (surface) return surface;
  }
  return BRAND_GROUND_PATH;
}

/** Where one slide is drawn under a theme: the archetype, the ground, and the token path a Brand ground swaps in. */
export interface SlideGroundPlanV1 {
  archetype: ArchetypeRefV1;
  ground: SlideGroundV1;
  /** True when the slide's own ground differs from the deck's. */
  moved: boolean;
  /** The token path the frame's ground takes in place of the archetype's, for a slide set to Brand. */
  groundPath?: string;
  /**
   * The slide asks for a ground its layout has no version for (no `variants.dark`),
   * so it stays on the deck's ground. The compile's `archetypeIdFor` draws the same.
   */
  noVariant?: true;
}

/**
 * The archetype and ground a slide is drawn on (plan 275 section 6.2). A slide on
 * the deck's own ground keeps its layout. A slide moved to another ground takes its
 * layout's declared dark variant (`variants.dark`), which is the dark archetype on a
 * light deck and, drawn under the Dark theme's remap, the light one on a dark deck.
 * A slide set to Brand keeps the variant a Dark slide would take on a light deck, or
 * its own layout on a dark deck, with the ground swapped for the Brand ground: the
 * stored Brand theme's hue, else the primary colour (`brandGroundPath`).
 *
 * A layout with no variant cannot move, except to Brand on a dark deck: it stays on
 * the deck's ground, not moved, and says so (`noVariant`), which is what the compile
 * draws, so the solve and the compile agree.
 *
 * `opts.hue` is read no more: a hue that is not stored on the plan would let the
 * solve and the compile draw two different Brand grounds.
 */
export function slideGroundPlan(
  slidePlan: Pick<SlidePlanV1, 'layout' | 'ground'>,
  master: SlideMasterV1,
  theme: DeckThemeV1 | null | undefined,
  _opts: { hue?: string } = {},
): SlideGroundPlanV1 {
  const deck = deckGround(theme, { master });
  const ground = slidePlan.ground ?? deck;
  if (ground === deck) return { archetype: slidePlan.layout, ground, moved: false };
  if (ground === 'brand' && deck === 'dark') {
    return { archetype: slidePlan.layout, ground, moved: true, groundPath: brandGroundPath(theme) };
  }
  const base = master.archetypes.find((one) => one.id === slidePlan.layout);
  const variant = base?.variants?.dark;
  if (!variant || !master.archetypes.some((one) => one.id === variant)) {
    return { archetype: slidePlan.layout, ground: deck, moved: false, noVariant: true };
  }
  if (ground === 'brand') return { archetype: variant, ground, moved: true, groundPath: brandGroundPath(theme) };
  return { archetype: variant, ground, moved: true };
}

function groundHexOf(archetype: ArchetypeV1 | undefined, colors: Record<string, string>): { hex: string; path?: string } | undefined {
  const ground = archetype?.background;
  if (!ground) return undefined;
  const fromPath = ground.tokenPath ? colors[ground.tokenPath] : undefined;
  const hex = normHex(fromPath ?? ground.hex);
  if (!hex) return undefined;
  return fromPath && ground.tokenPath ? { hex, path: ground.tokenPath } : { hex };
}

/** One slide's ground under a theme, as the compile draws it. `opts.hue` is read no more (see `slideGroundPlan`). */
export function slideGroundHex(
  slidePlan: Pick<SlidePlanV1, 'layout' | 'ground'>,
  themed: Pick<ThemedColorsV1, 'colors' | 'master' | 'theme'>,
  _opts: { hue?: string } = {},
): { hex: string; path?: string } | undefined {
  const placed = slideGroundPlan(slidePlan, themed.master, themed.theme);
  if (placed.groundPath) {
    const hex = normHex(themed.colors[placed.groundPath]);
    if (hex) return { hex, path: placed.groundPath };
  }
  return groundHexOf(themed.master.archetypes.find((one) => one.id === placed.archetype), themed.colors);
}

// ─── the colour solve under a theme ──────────────────────────────────────────

/** What a theme's colour solve reads besides the plan. */
export interface ThemeSolveContextV1 {
  census: Pick<DeckCensusV1, 'colors' | 'objects'>;
  /** The design system's colours in each mode and its master. */
  system: ThemeSourceV1;
  /** The look a look theme names. */
  look?: DeckLookV1;
  /** Object ids carrying raster bytes, so an assignment never names one. */
  rasterObjectIds?: string[];
  /** The source deck, read for the raster object ids when `rasterObjectIds` is not given, and for each text's size. */
  source?: Pick<SourceDeckV1, 'slides'>;
  /** OKLab separation inside a distinction set, when a preset stated one. */
  minSeparation?: number;
  /**
   * Read no more: a Brand ground's hue comes from the stored theme
   * (`brandGroundPath`), so the solve and the compile cannot draw two different
   * Brand grounds.
   */
  hue?: string;
  /** The design system is brand-locked: a look theme is solved as no theme, the way `systemForPlan` compiles it. */
  locked?: boolean;
}

export interface ThemeSolveV1 {
  colors: ColorMappingV1[];
  issues: ColorGroundIssueV1[];
  themed: ThemedColorsV1;
  groups: GroundGroupV1[];
}

/**
 * Objects carrying raster bytes, the rule the first pass applies: a picture, or an
 * object kept as its picture. An assignment never names one.
 */
export function rasterObjectIdsOf(source: Pick<SourceDeckV1, 'slides'>): string[] {
  const out: string[] = [];
  for (const slide of source.slides) {
    for (const object of slide.objects) {
      if (object.kind === 'pic' || object.fidelity.state === 'raster-preserved') out.push(object.id);
    }
  }
  return out.sort();
}

/** The slide a slide ground use belongs to (`slide:<id>:fill`, with the census's collision suffix). */
function groundUseSlide(useId: string): string | undefined {
  return /^slide:(.+):fill(?::[0-9a-f]{6}(?::\d+)?)?$/.exec(useId)?.[1];
}

/** The theme a solve applies: a look theme on a locked design system is no theme. */
function effectiveTheme(theme: DeckThemeV1 | null | undefined, locked: boolean | undefined): DeckThemeV1 | null | undefined {
  return locked === true && theme?.id === 'look' ? null : theme;
}

/**
 * The grounds and pairs the census leaves out. The census pairs a text with its
 * slide's ground only when the slide states one, so on most slides a text sits on a
 * ground nobody measured. Once a theme or a Background chip changes that ground, it
 * is measured: each such slide gets a ground use pinned to its themed ground, and
 * each text on it with no pair of its own gets one against that ground, at the
 * census rule's minimum (4.5:1, or 3:1 when its smallest run is 18 pt or more).
 */
function measuredGrounds(
  ctx: ThemeSolveContextV1,
  groups: GroundGroupV1[],
  measured: ReadonlySet<string>,
  objectSlides: Record<string, string>,
  rasters: ReadonlySet<string>,
): { uses: ColorUseV1[]; pairs: ContrastPairV1[] } {
  const stated = new Set<string>();
  for (const use of ctx.census.colors.uses) {
    const slide = groundUseSlide(use.useId);
    if (slide !== undefined && use.objectIds.length === 0) stated.add(slide);
  }
  const uses: ColorUseV1[] = [];
  const synthetic = new Set<string>();
  for (const group of groups) {
    for (const slideId of group.slideIds) {
      const ground = group.groundBySlide?.[slideId];
      if (!ground || stated.has(slideId) || !measured.has(slideId)) continue;
      uses.push({ useId: `slide:${slideId}:fill`, hex: ground.hex, role: 'bg', weight: 0, objectIds: [] });
      synthetic.add(slideId);
    }
  }
  if (synthetic.size === 0) return { uses, pairs: [] };
  const paired = new Set(ctx.census.colors.contrastPairs.map((pair) => `${pair.foreground}\u0000${pair.objectId}`));
  const sizes = new Map<string, number>();
  for (const slide of ctx.source?.slides ?? []) {
    for (const object of slide.objects) {
      let smallest: number | undefined;
      for (const para of object.text?.paras ?? []) {
        for (const run of para.runs) {
          if (run.sizePt !== undefined) smallest = smallest === undefined ? run.sizePt : Math.min(smallest, run.sizePt);
        }
      }
      if (smallest !== undefined) sizes.set(object.id, smallest);
    }
  }
  const pairs: ContrastPairV1[] = [];
  for (const use of ctx.census.colors.uses) {
    if (use.role !== 'ink') continue;
    for (const objectId of use.objectIds) {
      const slideId = objectSlides[objectId];
      if (slideId === undefined || !synthetic.has(slideId) || rasters.has(objectId)) continue;
      if (paired.has(`${use.useId}\u0000${objectId}`)) continue;
      const smallest = sizes.get(objectId) ?? 12;
      pairs.push({ foreground: use.useId, background: `slide:${slideId}:fill`, minimum: smallest < LARGE_TEXT_PT ? 4.5 : 3, objectId });
    }
  }
  return { uses, pairs };
}

/**
 * Solve the plan's colours under a theme, once per ground group. A plan with no
 * theme and no slide on a ground of its own is solved with the single solve the
 * first pass runs, so its targets are the ones the first pass gave.
 *
 * Every slide a theme or a Background chip draws on a ground of its own is measured,
 * including the slides whose source states no ground (`measuredGrounds`), so no text
 * falls under its minimum on its themed ground without a reason on its row or in
 * `issues`. The measuring rows never leave this function.
 */
export function solveThemeColors(plan: RenovationPlanV1, theme: DeckThemeV1 | null | undefined, ctx: ThemeSolveContextV1): ThemeSolveV1 {
  const applied = effectiveTheme(theme, ctx.locked);
  const themed = themedColors(ctx.system, applied, {
    ...(ctx.look ? { look: ctx.look } : {}),
    ...(ctx.locked === undefined ? {} : { locked: ctx.locked }),
  });
  if (applied !== theme && theme) themed.notes.push({ code: 'theme.look-locked', params: { lookId: theme.lookId ?? '' } });
  const locked: LockedColorV1[] = plan.colors
    .filter((row) => row.locked && row.to)
    .map((row) => ({ useId: row.useId, to: row.to ?? '', ...(row.toPath ? { toPath: row.toPath } : {}) }));
  const rasters = ctx.rasterObjectIds ?? (ctx.source ? rasterObjectIdsOf(ctx.source) : []);
  const input: AssignColorsInputV1 = {
    uses: ctx.census.colors.uses,
    contrastPairs: ctx.census.colors.contrastPairs,
    swatches: swatchesFromColors(themed.colors),
    slots: themeSlotsFromColors(themed.colors),
    ...(locked.length > 0 ? { locked } : {}),
    ...(rasters.length > 0 ? { rasterObjectIds: rasters } : {}),
    ...(ctx.minSeparation === undefined ? {} : { minSeparation: ctx.minSeparation }),
    ...(plan.shuffleSeed === undefined ? {} : { seed: plan.shuffleSeed }),
  };
  const plain = isPlainTheme(applied);
  if (plain && plan.slides.every((slide) => slide.ground === undefined)) {
    return { colors: assignColors(input), issues: [], themed, groups: [] };
  }

  const byKey = new Map<GroundGroupV1['ground'], GroundGroupV1>();
  const measured = new Set<string>();
  for (const slide of plan.slides) {
    const placed = slideGroundPlan(slide, themed.master, applied);
    // byGround holds dark and brand; a slide set to Light on a dark deck is solved
    // with the deck, so its targets hold on both grounds or the row says why not.
    const key: GroundGroupV1['ground'] = placed.moved && placed.ground !== 'light' ? placed.ground : 'deck';
    const group = byKey.get(key) ?? { ground: key, slideIds: [], groundBySlide: {} };
    group.slideIds.push(slide.id);
    const ground = slideGroundHex(slide, themed);
    if (ground && group.groundBySlide) group.groundBySlide[slide.id] = ground;
    byKey.set(key, group);
    if (!plain || placed.moved) measured.add(slide.id);
  }
  if (!byKey.has('deck')) byKey.set('deck', { ground: 'deck', slideIds: [], groundBySlide: {} });
  const groups = [...byKey.values()];
  const objectSlides: Record<string, string> = {};
  for (const row of ctx.census.objects) objectSlides[row.id] = row.slideId;
  const extra = measuredGrounds(ctx, groups, measured, objectSlides, new Set(rasters));
  const solved = assignColorsByGround({
    ...input,
    uses: [...input.uses, ...extra.uses],
    contrastPairs: [...input.contrastPairs, ...extra.pairs],
    grounds: { groups, objectSlides },
  });
  const own = new Set(extra.uses.map((use) => use.useId));
  return {
    colors: solved.colors.filter((row) => !own.has(row.useId)),
    issues: solved.issues.filter((issue) => !own.has(issue.useId)),
    themed,
    groups,
  };
}

/** The plan's rows with the solved rows put in their places; a row the solve did not return is kept. */
function mergeColors(current: ColorMappingV1[], solved: ColorMappingV1[]): { colors: ColorMappingV1[]; changed: string[] } {
  const byUse = new Map(solved.map((row) => [row.useId, row]));
  const changed: string[] = [];
  const colors = current.map((row) => {
    const next = byUse.get(row.useId);
    if (!next) return row;
    if (stableJson(next) === stableJson(row)) return row;
    changed.push(row.useId);
    return next;
  });
  return { colors, changed };
}

// ─── the preview ─────────────────────────────────────────────────────────────

/** What applying a theme would do, stated before it is applied. */
export interface ThemePreviewV1 {
  theme: DeckThemeV1 | null;
  notes: ThemeNoteV1[];
  swatches: ThemeSwatchesV1;
  /** Texts that would have no colour holding their minimum (4.5:1, or 3:1 for large text) on their ground. */
  textsUnder: number;
  /** Their use ids, in the order the plan lists them. */
  textUseIds: string[];
  /** Every use that would have no target on one of its grounds, with the slides. */
  issues: ColorGroundIssueV1[];
  /** Colour rows whose target would change. */
  changed: number;
  /** The rows the solve gave, for a caller that wants to show them. */
  colors: ColorMappingV1[];
  /** The master under the theme, each archetype's `dark` flag set for its ground, for drawing thumbnails. */
  master: SlideMasterV1;
  /** Every token path resolved under the theme. */
  resolved: Record<string, string>;
}

/**
 * What the colour solve would find under a theme, without changing the plan. The
 * count is of text uses, the Colours rows a reader would see listed, so the view
 * can say "2 texts would fall under 4.5:1 on this ground".
 */
export function themePreview(plan: RenovationPlanV1, theme: DeckThemeV1 | null | undefined, ctx: ThemeSolveContextV1): ThemePreviewV1 {
  const solved = solveThemeColors(plan, theme, ctx);
  const roleOf = new Map(ctx.census.colors.uses.map((use) => [use.useId, use.role]));
  const failing = new Set(solved.issues
    .filter((issue) => roleOf.get(issue.useId) === 'ink' && issue.reason === 'contrast-unreachable')
    .map((issue) => issue.useId));
  const textUseIds = solved.colors.map((row) => row.useId).filter((id) => failing.has(id));
  const { changed } = mergeColors(plan.colors, solved.colors);
  return {
    theme: isPlainTheme(theme) ? null : theme ?? null,
    notes: solved.themed.notes,
    swatches: themeSwatches(solved.themed),
    textsUnder: textUseIds.length,
    textUseIds,
    issues: solved.issues,
    changed: changed.length,
    colors: solved.colors,
    master: solved.themed.master,
    resolved: solved.themed.colors,
  };
}

// ─── the edits ───────────────────────────────────────────────────────────────

/** A theme edit's result: the plan edit's own, the rows to capture for undo, and what the solve could not answer. */
export interface ThemeEditResultV1 extends PlanEditResultV1 {
  /** Hand these to `captureThemeRows` over the plan the edit started from. */
  rows: PlanRowsTouchedV1;
  issues: ColorGroundIssueV1[];
  /**
   * Slides `setSlideGround` left on the deck's ground because their layout has no
   * version for the ground asked for (`no-variant`). Not in `skipped`, whose reasons
   * the plan edits share.
   */
  groundSkipped?: Array<{ id: string; reason: 'no-variant' }>;
}

export interface ThemeEditOptsV1 {
  /** Run the colour solve per ground group under the new theme. Without it only the theme or the grounds are written. */
  solve?: ThemeSolveContextV1;
  /**
   * The design system is brand-locked. `setDeckTheme` then refuses a look theme,
   * with `skipped: [{ id: THEME_ROW_ID, reason: 'locked' }]` (plan 275 decision 17).
   */
  locked?: boolean;
  /** The master the slides are drawn on, for `setSlideGround` to tell a layout with no dark version. Defaults to the solve context's. */
  master?: SlideMasterV1;
}

/**
 * Set the deck theme, or clear it with null (the master as shipped). A Light theme
 * that changes nothing is stored as no theme. With a solve context the colours are
 * solved again once per ground group and every row whose target moved is touched.
 * Slides keep their own grounds; `rows` names every slide, so undo restores each
 * ground as it was whatever a later edit did to it. A look theme on a locked design
 * system is refused and the plan is returned as it was.
 */
export function setDeckTheme(plan: RenovationPlanV1, theme: DeckThemeV1 | null, opts: ThemeEditOptsV1 = {}): ThemeEditResultV1 {
  if ((opts.locked === true || opts.solve?.locked === true) && theme?.id === 'look') {
    return { plan, touched: [], skipped: [{ id: THEME_ROW_ID, reason: 'locked' }], rows: { theme: false, slideIds: [], useIds: [] }, issues: [] };
  }
  const next = theme && !isPlainTheme(theme) ? structuredClone(theme) : undefined;
  const designSystem = { ...plan.designSystem };
  if (next) designSystem.theme = next;
  else delete designSystem.theme;
  const themeChanged = stableJson(plan.designSystem.theme ?? null) !== stableJson(next ?? null);
  let colors = plan.colors;
  let changed: string[] = [];
  let issues: ColorGroundIssueV1[] = [];
  if (opts.solve) {
    const solved = solveThemeColors({ ...plan, designSystem }, next, opts.solve);
    ({ colors, changed } = mergeColors(plan.colors, solved.colors));
    issues = solved.issues;
  }
  return {
    plan: { ...plan, designSystem, colors },
    touched: [...(themeChanged ? [THEME_ROW_ID] : []), ...changed],
    skipped: [],
    rows: { theme: true, slideIds: plan.slides.map((slide) => slide.id), useIds: changed },
    issues,
  };
}

/** The deck's ground under the plan's theme, a look's read from its colours when the solve context has them. */
function planDeckGround(plan: RenovationPlanV1, opts: ThemeEditOptsV1): SlideGroundV1 {
  const theme = effectiveTheme(plan.designSystem.theme, opts.locked ?? opts.solve?.locked);
  if (theme?.id !== 'look' || !opts.solve) return deckGround(theme);
  const themed = themedColors(opts.solve.system, theme, opts.solve.look ? { look: opts.solve.look } : {});
  return deckGround(theme, { surface: themed.colors[semanticPath('surface')], master: themed.master });
}

/**
 * Give slides their own ground, or null to follow the deck theme again. A ground
 * equal to the deck theme's own is stored as no ground, since absent means the
 * deck's. Unknown slide ids are skipped with `unknown`. A slide whose layout has no
 * version for that ground (no `variants.dark`) is left as it is and listed in
 * `groundSkipped`, because the compile would draw it on the deck's ground anyway;
 * this needs the master, from `opts.master` or the solve context.
 */
export function setSlideGround(plan: RenovationPlanV1, slideIds: string[], ground: SlideGroundV1 | null, opts: ThemeEditOptsV1 = {}): ThemeEditResultV1 {
  const wanted = new Set(slideIds);
  const known = new Set(plan.slides.map((slide) => slide.id));
  const deck = planDeckGround(plan, opts);
  const value = ground === null || ground === deck ? undefined : ground;
  const master = opts.master ?? opts.solve?.system.master;
  const theme = effectiveTheme(plan.designSystem.theme, opts.locked ?? opts.solve?.locked);
  const moved: string[] = [];
  const groundSkipped: Array<{ id: string; reason: 'no-variant' }> = [];
  const slides = plan.slides.map((slide): SlidePlanV1 => {
    if (!wanted.has(slide.id) || slide.ground === value) return slide;
    if (value && master && slideGroundPlan({ layout: slide.layout, ground: value }, master, theme).noVariant) {
      groundSkipped.push({ id: slide.id, reason: 'no-variant' });
      return slide;
    }
    moved.push(slide.id);
    const next: SlidePlanV1 = { ...slide };
    if (value) next.ground = value;
    else delete next.ground;
    return next;
  });
  let colors = plan.colors;
  let changed: string[] = [];
  let issues: ColorGroundIssueV1[] = [];
  const edited = { ...plan, slides };
  if (opts.solve && moved.length > 0) {
    const solved = solveThemeColors(edited, plan.designSystem.theme, opts.solve);
    ({ colors, changed } = mergeColors(plan.colors, solved.colors));
    issues = solved.issues;
  }
  const unknown = [...new Set(slideIds)].filter((id) => !known.has(id));
  return {
    plan: { ...edited, colors },
    touched: [...moved, ...changed],
    skipped: unknown.map((id) => ({ id, reason: 'unknown' as const })),
    rows: { theme: false, slideIds: moved, useIds: changed },
    issues,
    groundSkipped,
  };
}

// ─── undo ────────────────────────────────────────────────────────────────────

/** `capturePlanRows` plus the deck theme, when the edit said it changes it. */
export interface ThemeRowsSnapshotV1 extends PlanRowsSnapshotV1 {
  /** Present when the capture holds the theme; `value` absent means the plan had none. */
  theme?: { value?: DeckThemeV1 };
}

/**
 * Copy the rows a theme edit will touch, from the plan it started from: the slides
 * and colour rows `capturePlanRows` copies, and `designSystem.theme` when
 * `touched.theme` is set.
 */
export function captureThemeRows(plan: RenovationPlanV1, touched: PlanRowsTouchedV1): ThemeRowsSnapshotV1 {
  const snapshot: ThemeRowsSnapshotV1 = capturePlanRows(plan, touched);
  if (touched.theme) {
    const value = plan.designSystem.theme;
    snapshot.theme = value ? { value: structuredClone(value) } : {};
  }
  return snapshot;
}

/** Put captured rows back, the deck theme with them. */
export function restoreThemeRows(plan: RenovationPlanV1, snapshot: ThemeRowsSnapshotV1): RenovationPlanV1 {
  const restored = restorePlanRows(plan, snapshot);
  if (!snapshot.theme) return restored;
  const designSystem = { ...restored.designSystem };
  if (snapshot.theme.value) designSystem.theme = structuredClone(snapshot.theme.value);
  else delete designSystem.theme;
  return { ...restored, designSystem };
}
