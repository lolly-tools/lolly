// SPDX-License-Identifier: MPL-2.0
/**
 * One design system, resolved once for the whole renovation journey (plan 274
 * sections 3.3 and 3.5).
 *
 * The first pass and the compile each take a design system in their own shape:
 * `FirstPassDesignSystemV1` (swatches with roles, faces, the master, theme slots)
 * and `RenovateDesignSystemV1` (a token resolver, logos, faces). Both carry the
 * same `DesignSystemSnapshotV1`, which is what lets a project reproduce yesterday's
 * output after a pack update. This module builds all three from one plain input,
 * so the web view, the CLI, the TUI and the MCP tool cannot each derive a
 * slightly different swatch list or snapshot.
 *
 * The input is plain JSON, so a shell can post it to a worker and resolve it
 * there. The result holds the token resolver closure, so it stays on the side
 * that resolved it.
 *
 * Swatch roles are read from two facts. The token path's words say what the
 * colour is for (`surface`, `background`, `paper` or `canvas` is ground;
 * `text`, `ink` or `foreground` is ink), and where the path says nothing the
 * colour itself decides: a chroma at or above the census accent floor is an
 * accent, the rest is neutral. A leading `on` (`on-primary`, `onSurface`) is
 * ink for that one surface, not generic ink, so it takes the colour's own role
 * and names the surface in `inkFor`. Equal hexes under two paths stay two
 * swatches, because the token file states two paths; the solver folds equal
 * hexes on its own.
 *
 * The theme slot table (`THEME_SLOT_TOKENS`) lives here and nowhere else. The
 * Design PPTX lowering in `packages/node-shell/src/design-pptx.ts` reads it to
 * write the theme part, and the resolved `slots` answer the same table for the
 * plan side, so the two directions agree by construction.
 *
 * `neutralSlideMaster` is the neutral fallback master as engine data: masters[0]
 * of `brands/lolly-start/catalog/assets/lolly/slides/masters.json`, written by
 * `scripts/build-slide-masters.ts` and pinned equal by
 * `tests/rebrand-design-system.test.ts`, for a design system that ships no
 * master of its own.
 *
 * Pure: no DOM, no clock, no filesystem, no network. The token hash is a SHA-256
 * over a canonical serialisation of the sorted colour entries, so the same input
 * in a different key order gives the same snapshot.
 */

import type { DeckThemeV1, DesignSystemSnapshotV1, SlideMasterV1 } from '@lolly-tools/core';

import { contrastRatio, hexToOklch } from './brand-derive.ts';
import { sha256Hex } from './bytes.ts';
import { ACCENT_CHROMA_FLOOR } from './deck-census.ts';
import type { RenovateDesignSystemV1 } from './deck-compile.ts';
import { bgIsDark, parseBackgroundRgb, type LogoSetV1 } from './logo-variant.ts';
import type { BrandSwatchV1 } from './rebrand-colors.ts';
import type { FirstPassDesignSystemV1 } from './rebrand-plan.ts';
import { compareCodeUnits as compareText } from './rebrand-order.ts';

// ─── the input and the result ────────────────────────────────────────────────

/** A design system as plain data: what a shell reads from a brand pack and posts to a worker. */
export interface RebrandDesignSystemInputV1 {
  /** The design system's own id, recorded on the snapshot. */
  id: string;
  name?: string;
  master: SlideMasterV1;
  /** Resolved token path to hex, aliases already followed. */
  colors: Record<string, string>;
  logos?: LogoSetV1<string>;
  fonts?: { brand?: string; mono?: string; serif?: string; available?: string[] };
  fontHashes?: Record<string, string>;
  assetHashes?: Record<string, string>;
  preset?: { id: string; version?: string };
  /** True when the master is the neutral fallback because the design system ships none. */
  neutralMaster?: boolean;
  /**
   * The design system's own dark mode, resolved the way `colors` is: token path to
   * hex, aliases followed, the pack's `dark` theme composed over its base. The Dark
   * deck theme draws from here and nowhere else (plan 275 section 6.1). Absent when
   * the pack states no dark mode. Not part of the token hash, which identifies the
   * pack's own colours before a theme.
   */
  darkColors?: Record<string, string>;
}

/** The input, its snapshot, and the two shapes the first pass and the compile take. */
export interface RebrandDesignSystemV1 {
  input: RebrandDesignSystemInputV1;
  snapshot: DesignSystemSnapshotV1;
  /**
   * The design system's colour per theme slot, the same table `firstPass.slots`
   * carries, kept here too for a caller that reads the slots on their own.
   */
  slots: Record<string, { hex: string; path?: string }>;
  firstPass: FirstPassDesignSystemV1;
  compile: RenovateDesignSystemV1;
}

/**
 * The face a design system that names none is planned against. A generic family
 * rather than an invented brand face, so a plan never claims a typeface the
 * design system does not state.
 */
export const FALLBACK_BRAND_FACE = 'sans-serif';

// ─── theme slots ─────────────────────────────────────────────────────────────

/** The ten DrawingML colour slots a theme part states, in the order the PPTX lowering writes them. */
export const THEME_SLOTS = [
  'dk1', 'lt1', 'dk2', 'lt2',
  'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6',
] as const;
export type ThemeSlotV1 = (typeof THEME_SLOTS)[number];

/** The four placeholder names a slide uses through the master's default colour map. */
export type ThemeSlotAliasV1 = 'bg1' | 'tx1' | 'bg2' | 'tx2';

/**
 * The token path each DrawingML theme slot reads. Six of the ten slots have one;
 * `lt2` and `accent4` to `accent6` take the engine's own theme defaults on the
 * PPTX side and map by colour distance on the plan side. This is the one table
 * both directions use, frozen so no consumer can change it for the other.
 */
export const THEME_SLOT_TOKENS: Readonly<Partial<Record<ThemeSlotV1, string>>> = Object.freeze({
  dk1: 'color.semantic.text',
  lt1: 'color.semantic.surface',
  dk2: 'color.semantic.muted',
  accent1: 'color.semantic.primary',
  accent2: 'color.semantic.secondary',
  accent3: 'color.semantic.accent',
});

/**
 * The placeholder slot names a slide uses through the master's default colour
 * map. A source colour names `tx1` or `bg1` far more often than `dk1` or `lt1`,
 * and the reader keeps the name it found, so the slot table answers both.
 */
export const THEME_SLOT_ALIASES: Readonly<Record<ThemeSlotAliasV1, ThemeSlotV1>> = Object.freeze({
  bg1: 'lt1',
  tx1: 'dk1',
  bg2: 'lt2',
  tx2: 'dk2',
});

const THEME_SLOT_ALIAS_NAMES: readonly ThemeSlotAliasV1[] = ['bg1', 'bg2', 'tx1', 'tx2'];

/**
 * The design system's colour per theme slot, for a slot-to-slot mapping. A slot
 * whose token path the design system does not state is left out. The four
 * placeholder aliases (`tx1`, `bg1`, `tx2`, `bg2`) are answered too, with the
 * entry of the slot they stand for.
 */
export function themeSlotsFromColors(colors: Record<string, string>): Record<string, { hex: string; path?: string }> {
  const out: Record<string, { hex: string; path?: string }> = {};
  for (const slot of [...THEME_SLOTS].sort(compareText)) {
    const tokenPath = THEME_SLOT_TOKENS[slot];
    if (tokenPath === undefined) continue;
    const hex = colors[tokenPath];
    if (typeof hex !== 'string' || hex.length === 0) continue;
    out[slot] = { hex, path: tokenPath };
  }
  for (const alias of THEME_SLOT_ALIAS_NAMES) {
    const entry = out[THEME_SLOT_ALIASES[alias]];
    if (entry) out[alias] = { ...entry };
  }
  return out;
}

// ─── swatches ────────────────────────────────────────────────────────────────

/** Words that name the ground a slide is drawn on. */
const GROUND_WORDS: ReadonlySet<string> = new Set(['surface', 'background', 'bg', 'paper', 'canvas', 'ground']);
/** Words that name the colour ordinary text is set in, on the ordinary ground. */
const INK_WORDS: ReadonlySet<string> = new Set(['text', 'ink', 'foreground', 'fg']);

/** The lower-case words of one path segment, split on `-`, `_` and camelCase boundaries. */
function segmentWords(segment: string): string[] {
  return segment
    .split(/[-_]+|(?<=[a-z0-9])(?=[A-Z])/)
    .map((word) => word.toLowerCase())
    .filter((word) => word.length > 0);
}

/**
 * What one path segment says about its colour.
 *
 * The rule table, read top down, first match wins:
 *
 *   | segment                                   | reading                          |
 *   |-------------------------------------------|----------------------------------|
 *   | `on-<x>`, `on_<x>`, `on<X>`               | ink for the `<x>` surface only   |
 *   | a word of `text ink foreground fg`        | generic ink                      |
 *   | a word of `surface background bg paper    | ground                           |
 *   |   canvas ground`                          |                                  |
 *   | anything else                             | nothing; the next segment speaks |
 *
 * `on-primary` is the colour set ON the primary fill (white on a dark green), so
 * it is ink for that one surface and never generic ink: filing it as ink sends
 * a deck's black body text to white on a white slide. Its role then comes from
 * its chroma as an unnamed colour does, and `inkFor` records the surface.
 *
 * Words are read from the last back, so `canvas-text` is ink and `canvas-dark`
 * is ground.
 */
type SegmentReadingV1 = { role: 'bg' | 'ink' } | { inkFor: string } | undefined;

function readSegment(segment: string): SegmentReadingV1 {
  const words = segmentWords(segment);
  if (words.length > 1 && words[0] === 'on') return { inkFor: words.slice(1).join('-') };
  for (let i = words.length - 1; i >= 0; i -= 1) {
    const word = words[i] ?? '';
    if (INK_WORDS.has(word)) return { role: 'ink' };
    if (GROUND_WORDS.has(word)) return { role: 'bg' };
  }
  return undefined;
}

/**
 * What a path's own words say, reading from the last segment back so
 * `color.surface.text` is ink (text set on a surface) and `color.text.surface`
 * is ground. A path that names neither gives nothing.
 */
function readPath(tokenPath: string): SegmentReadingV1 {
  const segments = tokenPath.split('.').filter((segment) => segment.length > 0);
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const reading = readSegment(segments[i] ?? '');
    if (reading) return reading;
  }
  return undefined;
}

/** The role a colour takes when its path names none: accent at or over the chroma floor, else neutral. */
function roleFromChroma(hex: string): 'accent' | 'neutral' {
  const chroma = hexToOklch(hex)?.c ?? 0;
  return chroma >= ACCENT_CHROMA_FLOOR ? 'accent' : 'neutral';
}

/**
 * One swatch per colour token path, ordered by path. The role comes from the
 * path where the path names one (see `readSegment` for the table), and from the
 * measured chroma otherwise. An `on-<x>` token keeps its chroma role and states
 * the surface it is ink for in `inkFor`.
 */
export function swatchesFromColors(colors: Record<string, string>): BrandSwatchV1[] {
  return Object.keys(colors)
    .sort(compareText)
    .flatMap((tokenPath): BrandSwatchV1[] => {
      const hex = colors[tokenPath];
      if (typeof hex !== 'string' || hex.length === 0) return [];
      const reading = readPath(tokenPath);
      if (reading && 'role' in reading) return [{ path: tokenPath, hex, role: reading.role }];
      const swatch: BrandSwatchV1 = { path: tokenPath, hex, role: roleFromChroma(hex) };
      if (reading && 'inkFor' in reading) swatch.inkFor = reading.inkFor;
      return [swatch];
    });
}

// ─── the snapshot ────────────────────────────────────────────────────────────

/** A copy of a string record with its keys in code-unit order. */
function sortedRecord(record: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!record) return out;
  for (const key of Object.keys(record).sort(compareText)) {
    const value = record[key];
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}

/**
 * One spelling per colour: `#` added, lower case, `#rgb` and `#rgba` expanded,
 * and an opaque `ff` alpha dropped, so `#FFF`, `#ffffff` and `#ffffffff` hash
 * the same. A value that is not a hex is only trimmed and lower-cased.
 */
function canonicalHex(value: string): string {
  const raw = value.trim().toLowerCase();
  const digits = raw.startsWith('#') ? raw.slice(1) : raw;
  if (!/^[0-9a-f]+$/.test(digits) || ![3, 4, 6, 8].includes(digits.length)) return raw;
  const full = digits.length <= 4 ? [...digits].map((digit) => digit + digit).join('') : digits;
  return `#${full.length === 8 && full.endsWith('ff') ? full.slice(0, 6) : full}`;
}

/**
 * `sha256:<hex>` over the colour entries sorted by path, each colour in one
 * canonical spelling, serialised as one JSON array of pairs. Key order in the
 * input and the spelling of an equal colour never move it.
 */
export async function colorTokenHash(colors: Record<string, string>): Promise<string> {
  const pairs = Object.keys(colors)
    .sort(compareText)
    .flatMap((tokenPath): Array<[string, string]> => {
      const hex = colors[tokenPath];
      return typeof hex === 'string' ? [[tokenPath, canonicalHex(hex)]] : [];
    });
  const bytes = new TextEncoder().encode(JSON.stringify(pairs));
  return `sha256:${await sha256Hex(bytes)}`;
}

// ─── resolving ───────────────────────────────────────────────────────────────

/**
 * Resolve a design system into its snapshot, the first pass's shape and the
 * compile's shape. The input is copied first and every shape is built from the
 * copy, so a caller that edits its own object afterwards does not move a
 * resolved system.
 */
export async function resolveRebrandDesignSystem(raw: RebrandDesignSystemInputV1): Promise<RebrandDesignSystemV1> {
  const input: RebrandDesignSystemInputV1 = structuredClone(raw);
  const colors = sortedRecord(input.colors);
  const tokenHash = await colorTokenHash(colors);

  const snapshot: DesignSystemSnapshotV1 = {
    id: input.id,
    masterId: input.master.id,
    masterVersion: input.master.version,
    tokenHash,
    fontHashes: sortedRecord(input.fontHashes),
    assetHashes: sortedRecord(input.assetHashes),
  };
  if (input.preset) {
    snapshot.presetId = input.preset.id;
    if (input.preset.version !== undefined) snapshot.presetVersion = input.preset.version;
  }

  const brand = input.fonts?.brand ?? FALLBACK_BRAND_FACE;
  const faces: FirstPassDesignSystemV1['fonts'] = { brand };
  if (input.fonts?.mono !== undefined) faces.mono = input.fonts.mono;
  if (input.fonts?.serif !== undefined) faces.serif = input.fonts.serif;
  if (input.fonts?.available !== undefined) faces.availableFamilies = [...input.fonts.available];

  // The slot table goes to the first pass, where a source colour named by a
  // slot takes the design system's colour for that slot as its first candidate.
  // The solve may still move it for contrast or distinction (see `assignColors`),
  // so a slot colour that cannot hold on the source ground is not an unresolved
  // colour the way a pinned one was.
  const slots = themeSlotsFromColors(colors);
  // The shape also carries its colours, dark mode included, as plain data
  // (`ThemeCarryV1`), so a structured clone posted to a worker is themed the way
  // this realm themes it rather than from its swatches alone.
  const firstPass: FirstPassDesignSystemV1 & ThemeCarryV1 = {
    snapshot,
    swatches: swatchesFromColors(colors),
    fonts: faces,
    master: input.master,
    slots: structuredClone(slots),
    themeSource: { colors: { ...colors }, ...(input.darkColors ? { darkColors: sortedRecord(input.darkColors) } : {}) },
  };

  const tokens = new Map(Object.entries(colors));
  const compile: RenovateDesignSystemV1 = {
    snapshot,
    tokens: (tokenPath: string): string | undefined => tokens.get(tokenPath),
  };
  if (input.logos) compile.logos = { ...input.logos };
  if (input.fonts?.brand !== undefined) compile.fonts = { major: input.fonts.brand, minor: input.fonts.brand };

  const result: RebrandDesignSystemV1 = { input: structuredClone(input), snapshot, slots, firstPass, compile };
  // Each shape remembers the colours it was resolved from, so `systemForPlan` can
  // lay a deck theme over the compile shape, whose token resolver is a closure.
  const source: ThemeSourceV1 = {
    colors,
    master: input.master,
    ...(input.darkColors ? { darkColors: sortedRecord(input.darkColors) } : {}),
  };
  for (const shape of [result, firstPass, compile]) THEME_SOURCES.set(shape, { source });
  return result;
}

// ─── the deck theme ──────────────────────────────────────────────────────────
//
// A deck theme (plan 275 section 6) is a small token remap over the resolved
// design system for one project: `mode` picks which of the pack's own colour sets
// the tokens resolve in (the pack's dark mode for Dark), `remap` sends a token
// path to another path of that set, and `flipDark` flips an archetype's `dark`
// flag where its themed ground cannot be measured. A `look` theme lays a saved
// look's colours over the set first.
//
// Three rules hold for every theme:
//
//   - Every themed hex is a value of the resolved token set of the theme's mode
//     (with the look laid over it for a look theme). A remap whose target that set
//     does not state is skipped and reported, never filled with a colour of its own.
//   - The master's token paths are not rewritten. The remap is applied where a
//     path is resolved, so a colour mapping with a token path resolves the same way
//     the master's grounds do, and the plan's rows keep the names they were given.
//   - Each archetype's `dark` flag is measured on its themed ground, the same test
//     `pickLogoVariant` applies, so the logo variant and the ink follow the ground.
//     Only a ground that cannot be measured falls back to `flipDark`.

/** What a deck theme is laid over: the pack's colours in each of its modes, and its master. */
export interface ThemeSourceV1 {
  colors: Record<string, string>;
  /** The pack's dark mode, when it states one. */
  darkColors?: Record<string, string>;
  master: SlideMasterV1;
}

/** A saved look's colours, token path to hex, which a `look` theme lays over the design system for one project. */
export interface DeckLookV1 {
  id: string;
  name: string;
  colors: Record<string, string>;
}

/**
 * What applying a theme had to say. `theme.no-dark-mode`: the theme asked for the
 * dark mode and the pack states none, so the Dark built from the darkest step of the
 * primary colour's ramp was used. `theme.look-missing`: a look theme whose look was
 * not handed over, so the design system's own colours were used.
 * `theme.remap-skipped`: a remap target the mode's set does not state.
 * `theme.look-locked`: a look theme on a locked design system, which is not applied
 * (plan 275 decision 17), so the design system's own colours were used.
 */
export const THEME_NOTE_CODES = ['theme.no-dark-mode', 'theme.look-missing', 'theme.remap-skipped', 'theme.look-locked'] as const;
export type ThemeNoteCodeV1 = (typeof THEME_NOTE_CODES)[number];

export interface ThemeNoteV1 {
  code: ThemeNoteCodeV1;
  params?: Record<string, string>;
}

/** A theme resolved against its source. */
export interface ThemedColorsV1 {
  /** The theme applied, or null for the master as shipped. */
  theme: DeckThemeV1 | null;
  /** The mode whose colour set was used. */
  mode: 'light' | 'dark';
  /** The resolved token set of that mode, the look laid over it for a look theme: every themed hex is one of its values. */
  modeColors: Record<string, string>;
  /** Every token path resolved under the theme: the value, in `modeColors`, of the path the remap sends it to. */
  colors: Record<string, string>;
  /** The source master with each archetype's `dark` flag set for its themed ground. */
  master: SlideMasterV1;
  notes: ThemeNoteV1[];
}

/** The options `systemForPlan` and `masterForPlan` take. */
export interface SystemForPlanOptsV1 {
  /** The look a `look` theme names, when the caller has it. Without it a look theme resolves to the design system's own colours and says so. */
  look?: DeckLookV1;
  /** The colours to theme, for a shape that was not made by `resolveRebrandDesignSystem` in this realm (a structured clone). */
  source?: ThemeSourceV1;
  /**
   * The design system is brand-locked. A look theme is then not applied: a look on
   * a locked pack is a route to an off-brand deck under the design system's name
   * (plan 275 decision 17), whatever route the theme reached the plan by.
   */
  locked?: boolean;
}

interface ThemeMemoV1 {
  source: ThemeSourceV1;
  /** The theme key a shape was already themed with, so applying it again returns the shape. */
  applied?: string;
}

/**
 * The colours each resolved shape came from. Keyed by the shape object, so nothing
 * is added to a shape's own fields and a structured clone simply forgets it.
 */
const THEME_SOURCES = new WeakMap<object, ThemeMemoV1>();

/** The colours and master a resolved design-system shape was built from, when this realm resolved it. */
export function themeSourceOf(system: unknown): ThemeSourceV1 | undefined {
  return system !== null && typeof system === 'object' ? THEME_SOURCES.get(system)?.source : undefined;
}

/** True for no theme, and for a Light theme that changes nothing: the master as shipped. */
export function isPlainTheme(theme: DeckThemeV1 | null | undefined): boolean {
  if (!theme) return true;
  return theme.id === 'light' && theme.mode !== 'dark' && theme.remap.length === 0 && theme.flipDark !== true && theme.lookId === undefined;
}

/** True when a theme is a look that a locked design system does not apply. */
function lookOnLocked(theme: DeckThemeV1, locked: boolean | undefined): boolean {
  return locked === true && theme.id === 'look';
}

function themeKey(theme: DeckThemeV1, look: DeckLookV1 | undefined): string {
  const lookColors = look && theme.id === 'look' && look.id === theme.lookId ? sortedRecord(look.colors) : null;
  return JSON.stringify([theme.id, theme.mode ?? null, theme.remap.map((row) => [row.from, row.to]), theme.lookId ?? null, theme.flipDark === true, lookColors]);
}

/** The colour values of a record that are hexes, keys in code-unit order. */
function hexRecord(record: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(record).sort(compareText)) {
    const value = record[key];
    if (typeof value === 'string' && /^#?[0-9a-fA-F]{3,8}$/.test(value.trim())) out[key] = value;
  }
  return out;
}

// ─── the paths a master draws with, and a Dark for a pack with no dark mode ──

/** The semantic slots, in the order a colour is matched to one when its path names none. */
const THEME_SLOT_ORDER = ['surface', 'text', 'primary', 'secondary', 'muted', 'edge', 'on-primary', 'accent'] as const;

/** The token path the Brand colour ground takes when no hue is named. */
const PRIMARY_PATH = 'color.semantic.primary';

const semanticPath = (slot: string): string => `color.semantic.${slot}`;

/** One spelling of a six-digit hex, or undefined for a value that is not one. */
function themeHex(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const raw = value.trim().toLowerCase().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/.test(raw)) return `#${[...raw].map((c) => c + c).join('')}`;
  if (/^[0-9a-f]{6}([0-9a-f]{2})?$/.test(raw)) return `#${raw.slice(0, 6)}`;
  return undefined;
}

function lightnessOf(hex: string | undefined): number {
  const norm = themeHex(hex);
  return norm ? hexToOklch(norm)?.l ?? 0.5 : 0.5;
}

/** What a master draws with one token path: a slide ground, a panel, text, or a bar. */
export type MasterPathUseV1 = 'ground' | 'fill' | 'ink' | 'bar';

/** Every token path the master draws with, and what it draws, in code-unit order. */
export function masterTokenPaths(master: SlideMasterV1): Map<string, Set<MasterPathUseV1>> {
  const out = new Map<string, Set<MasterPathUseV1>>();
  const add = (tokenPath: string | undefined, use: MasterPathUseV1): void => {
    if (!tokenPath) return;
    const uses = out.get(tokenPath) ?? new Set<MasterPathUseV1>();
    uses.add(use);
    out.set(tokenPath, uses);
  };
  for (const archetype of master.archetypes) {
    add(archetype.background?.tokenPath, 'ground');
    for (const placeholder of archetype.placeholders) add(placeholder.style?.fgTokenPath, 'ink');
  }
  for (const piece of master.furniture) {
    add(piece.tokenPath, piece.kind === 'rect' ? 'fill' : 'bar');
    add(piece.style?.fgTokenPath, 'ink');
  }
  return new Map([...out.entries()].sort((a, b) => compareText(a[0], b[0])));
}

/** The semantic slot a path stands for: its own name under `color.semantic`, else the slot whose light colour it equals. */
export function themeSlotOf(tokenPath: string, colors: Record<string, string>): string | undefined {
  const named = /^color\.semantic\.([A-Za-z-]+)$/.exec(tokenPath)?.[1];
  const known = THEME_SLOT_ORDER.find((slot) => slot === named);
  if (known) return known;
  if (named !== undefined) return undefined;
  const hex = themeHex(colors[tokenPath]);
  if (!hex) return undefined;
  return THEME_SLOT_ORDER.find((slot) => themeHex(colors[semanticPath(slot)]) === hex);
}

/** The ramps of a colour set: hue name to its step paths, darkest first. */
function rampsOf(colors: Record<string, string>): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const tokenPath of Object.keys(colors).sort(compareText)) {
    const match = /^color\.ramp\.([^.]+)\.[^.]+$/.exec(tokenPath);
    if (!match || !themeHex(colors[tokenPath])) continue;
    const hue = match[1] ?? '';
    const steps = out.get(hue) ?? [];
    steps.push(tokenPath);
    out.set(hue, steps);
  }
  for (const steps of out.values()) {
    steps.sort((a, b) => (lightnessOf(colors[a]) - lightnessOf(colors[b])) || compareText(a, b));
  }
  return out;
}

/** The ramp step a path is, or the step whose light colour it equals. */
function rampStepOf(tokenPath: string, light: Record<string, string>): string | undefined {
  if (/^color\.ramp\.[^.]+\.[^.]+$/.test(tokenPath)) return tokenPath;
  const hex = themeHex(light[tokenPath]);
  if (!hex) return undefined;
  for (const steps of rampsOf(light).values()) {
    const found = steps.find((one) => themeHex(light[one]) === hex);
    if (found) return found;
  }
  return undefined;
}

/**
 * The step at the other end of a path's own ramp: the lightest for the darkest and
 * so on. A path outside a ramp takes the ramp step whose light colour it equals.
 */
export function mirroredRampStep(tokenPath: string, light: Record<string, string>, mode: Record<string, string>): string | undefined {
  const stepPath = rampStepOf(tokenPath, light);
  if (!stepPath) return undefined;
  const hue = /^color\.ramp\.([^.]+)\./.exec(stepPath)?.[1] ?? '';
  const lightSteps = rampsOf(light).get(hue);
  const modeSteps = rampsOf(mode).get(hue);
  if (!lightSteps || !modeSteps || lightSteps.length < 2) return undefined;
  const at = lightSteps.indexOf(stepPath);
  if (at < 0) return undefined;
  const target = lightSteps[lightSteps.length - 1 - at];
  return target !== undefined && mode[target] !== undefined ? target : undefined;
}

/** The ramp the primary colour belongs to: the one holding its hex, else the first by name. */
function primaryRamp(colors: Record<string, string>): string[] | undefined {
  const ramps = rampsOf(colors);
  if (ramps.size === 0) return undefined;
  const primary = themeHex(colors[PRIMARY_PATH]);
  if (primary) {
    for (const steps of ramps.values()) if (steps.some((one) => themeHex(colors[one]) === primary)) return steps;
  }
  return [...ramps.values()][0];
}

/** A remap table as the contract states it: rows that move a path, in code-unit order. */
export function themeRemapRows(rows: Map<string, string>): Array<{ from: string; to: string }> {
  return [...rows.entries()]
    .filter(([from, to]) => from !== to)
    .sort((a, b) => compareText(a[0], b[0]))
    .map(([from, to]) => ({ from, to }));
}

/** The Dark a pack with no dark mode gets: its remap in the light set, and the ramp step it grounds on. */
export interface DarkFallbackV1 {
  remap: Array<{ from: string; to: string }>;
  groundPath: string;
}

/**
 * The Dark a pack with no dark mode gets (plan 275 section 6.1): the darkest step of
 * the primary colour's ramp is the ground, the light surface is the ink, and every
 * ramp step the master draws a ground, panel or text with is mirrored inside its own
 * ramp. Every target is a path of the light set, so no colour of its own is made.
 * Null for a colour set with nothing to ground on.
 */
export function darkFallbackRemap(light: Record<string, string>, master: SlideMasterV1): DarkFallbackV1 | null {
  const steps = primaryRamp(light);
  const byLightness = Object.keys(light).filter((one) => themeHex(light[one])).sort((a, b) => (lightnessOf(light[a]) - lightnessOf(light[b])) || compareText(a, b));
  const groundPath = steps?.[0] ?? byLightness[0];
  const inkPath = light[semanticPath('surface')] !== undefined ? semanticPath('surface') : byLightness[byLightness.length - 1];
  if (!groundPath || !inkPath) return null;
  const targets: Record<string, string> = { surface: groundPath, text: inkPath, muted: inkPath };
  const all = new Map(masterTokenPaths(master));
  for (const slot of Object.keys(targets)) if (light[semanticPath(slot)] !== undefined && !all.has(semanticPath(slot))) all.set(semanticPath(slot), new Set());
  const rows = new Map<string, string>();
  for (const [tokenPath, uses] of all) {
    const slot = themeSlotOf(tokenPath, light);
    const target = slot ? targets[slot] : undefined;
    if (target) {
      rows.set(tokenPath, target);
      continue;
    }
    if (slot || (!uses.has('ground') && !uses.has('fill') && !uses.has('ink'))) continue;
    const mirrored = mirroredRampStep(tokenPath, light, light);
    if (mirrored) rows.set(tokenPath, mirrored);
  }
  return { remap: themeRemapRows(rows), groundPath };
}

// ─── the master under a theme ────────────────────────────────────────────────

/** Roles set large enough that 3:1 is their text minimum. */
const LARGE_ROLES: ReadonlySet<string> = new Set(['title', 'subtitle', 'number', 'quote']);

/** Text furniture at or above this size, in px at the master size (18 pt at 96 dpi), is large text. */
const LARGE_FURNITURE_PX = 24;

/** Non-text furniture (a rule, a bar) needs this much contrast with what it sits on, or as much as the Light master gave it. */
const NON_TEXT_CONTRAST = 3;

/** A piece of furniture whose Light contrast is at or below this was meant to merge with its ground, and is left to. */
const MERGED_CONTRAST = 1.05;

/** A fill that hides what is under it: a hex with no alpha, or an alpha of at least one half. */
function opaque(value: string): boolean {
  const digits = value.trim().replace(/^#/, '');
  if (digits.length === 8) return Number.parseInt(digits.slice(6, 8), 16) >= 128;
  return /^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(digits);
}

function inkContrast(ink: string | undefined, ground: string | undefined): number {
  if (ink === undefined || ground === undefined) return 0;
  const ratio = contrastRatio(ink.trim().slice(0, 7), ground.trim().slice(0, 7));
  return Number.isFinite(ratio) ? ratio : 0;
}

/**
 * The pack path whose themed colour holds `minimum` on `ground`, preferring the
 * semantic text, then the semantic surface (an inverted slide's ink), then
 * `on-primary`, then every other path in order; the one with the most contrast
 * when none holds. Undefined only for an empty colour set.
 */
function holdingInk(colors: Record<string, string>, ground: string, minimum: number, current: string): string | undefined {
  const preferred = ['color.semantic.text', 'color.semantic.surface', 'color.semantic.on-primary'];
  const rest = Object.keys(colors).filter((one) => !preferred.includes(one) && one !== current).sort(compareText);
  let best: string | undefined;
  let bestRatio = inkContrast(colors[current], ground);
  for (const tokenPath of [...preferred, ...rest]) {
    const ratio = inkContrast(colors[tokenPath], ground);
    if (ratio >= minimum && preferred.includes(tokenPath)) return tokenPath;
    if (ratio > bestRatio) {
      best = tokenPath;
      bestRatio = ratio;
    }
  }
  return best;
}

/**
 * The pack path a bar or panel takes when the theme left it under `minimum` on
 * what it sits on. The paths are asked in tiers, the piece's own ramp first, then
 * the semantic paths, then every other path, and inside the first tier that has an
 * answer the path with the least contrast that still holds wins, so a pale card stays
 * a quiet card rather than turning into an accent. The path with the most contrast
 * when nothing holds.
 */
function holdingFill(colors: Record<string, string>, backdrop: string, minimum: number, current: string, light: Record<string, string> | undefined): string | undefined {
  const own: string[] = [];
  const step = light ? rampStepOf(current, light) : undefined;
  const hue = step ? /^color\.ramp\.([^.]+)\./.exec(step)?.[1] : undefined;
  if (hue !== undefined) for (const one of Object.keys(colors).sort(compareText)) if (one.startsWith(`color.ramp.${hue}.`)) own.push(one);
  const semantic = ['muted', 'edge', 'secondary', 'primary', 'accent', 'text', 'on-primary', 'surface'].map(semanticPath).filter((one) => colors[one] !== undefined);
  const rest = Object.keys(colors).sort(compareText).filter((one) => !own.includes(one) && !semantic.includes(one));
  const ground = themeHex(backdrop);
  for (const tier of [own, semantic, rest]) {
    let pick: string | undefined;
    let pickRatio = Number.POSITIVE_INFINITY;
    for (const tokenPath of tier) {
      if (tokenPath === current || themeHex(colors[tokenPath]) === ground) continue;
      const ratio = inkContrast(colors[tokenPath], backdrop);
      if (ratio >= minimum && ratio < pickRatio) {
        pick = tokenPath;
        pickRatio = ratio;
      }
    }
    if (pick) return pick;
  }
  let best: string | undefined;
  let bestRatio = inkContrast(colors[current], backdrop);
  for (const tokenPath of Object.keys(colors).sort(compareText)) {
    const ratio = inkContrast(colors[tokenPath], backdrop);
    if (ratio > bestRatio) {
      best = tokenPath;
      bestRatio = ratio;
    }
  }
  return best;
}

type MasterArchetypeV1 = SlideMasterV1['archetypes'][number];
type MasterFurnitureV1 = SlideMasterV1['furniture'][number];

const furnitureCentre = (box: { x: number; y: number; w: number; h: number }): { cx: number; cy: number } => ({ cx: box.x + box.w / 2, cy: box.y + box.h / 2 });

/**
 * What a point on an archetype sits on: the last opaque panel of its furniture under
 * the point, painted before `before` when that is given, else the ground.
 */
function backdropAt(
  archetype: MasterArchetypeV1,
  pieces: ReadonlyMap<string, MasterFurnitureV1>,
  colors: Record<string, string>,
  ground: string,
  point: { cx: number; cy: number },
  before?: number,
): string {
  let backdrop = ground;
  const ids = archetype.furniture ?? [];
  const end = before === undefined ? ids.length : before;
  for (let at = 0; at < end; at += 1) {
    const piece = pieces.get(ids[at] ?? '');
    if (piece?.kind !== 'rect') continue;
    const { x, y, w, h } = piece.box;
    if (point.cx < x || point.cx > x + w || point.cy < y || point.cy > y + h) continue;
    const fill = piece.tokenPath !== undefined ? colors[piece.tokenPath] : piece.hex;
    if (fill !== undefined && opaque(fill)) backdrop = fill;
  }
  return backdrop;
}

/** The furniture id a repaired copy of `id` takes: `<id>-t<n>`, inside the id pattern, and new in the master. */
function copyId(id: string, taken: ReadonlySet<string>): string {
  for (let n = 1; ; n += 1) {
    const suffix = `-t${n}`;
    const candidate = `${id.slice(0, 64 - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * Repair one field of every piece of furniture on every archetype that shows it.
 * A piece is shared between archetypes, and one colour may not hold on all their
 * grounds, so the archetypes are grouped by the path the piece needs there: the
 * group that keeps the piece's own path keeps its id, and each other path gets a
 * copy of the piece with a new id, which those archetypes name instead. When no
 * archetype keeps the own path, the first group takes it over in place.
 */
function repairFurniture(
  out: SlideMasterV1,
  grounds: ReadonlyMap<string, string>,
  colors: Record<string, string>,
  field: 'fill' | 'ink',
  need: (piece: MasterFurnitureV1, archetype: MasterArchetypeV1, backdrop: string, current: string) => string | undefined,
): void {
  const originals = [...out.furniture];
  for (const piece of originals) {
    const current = field === 'fill' ? piece.tokenPath : piece.style?.fgTokenPath;
    if (current === undefined || colors[current] === undefined) continue;
    if (field === 'fill' && piece.kind !== 'rect' && piece.kind !== 'bar') continue;
    if (field === 'ink' && piece.kind !== 'footer' && piece.kind !== 'page-number') continue;
    const byTarget = new Map<string, MasterArchetypeV1[]>();
    for (const archetype of out.archetypes) {
      const at = (archetype.furniture ?? []).indexOf(piece.id);
      const ground = grounds.get(archetype.id);
      if (at < 0 || ground === undefined) continue;
      const pieces = new Map(out.furniture.map((one) => [one.id, one]));
      const backdrop = backdropAt(archetype, pieces, colors, ground, furnitureCentre(piece.box), at);
      const target = need(piece, archetype, backdrop, current) ?? current;
      const list = byTarget.get(target) ?? [];
      list.push(archetype);
      byTarget.set(target, list);
    }
    if (byTarget.size === 0 || (byTarget.size === 1 && byTarget.has(current))) continue;
    const set = (one: MasterFurnitureV1, target: string): void => {
      if (field === 'fill') one.tokenPath = target;
      else one.style = { ...one.style, fgTokenPath: target };
    };
    const targets = [...byTarget.keys()];
    const inPlace = byTarget.has(current) ? current : targets[0];
    const taken = new Set(out.furniture.map((one) => one.id));
    for (const target of targets) {
      if (target === inPlace) continue;
      const copy: MasterFurnitureV1 = structuredClone(piece);
      copy.id = copyId(piece.id, taken);
      taken.add(copy.id);
      set(copy, target);
      out.furniture.push(copy);
      for (const archetype of byTarget.get(target) ?? []) {
        archetype.furniture = (archetype.furniture ?? []).map((id) => (id === piece.id ? copy.id : id));
      }
    }
    if (inPlace !== undefined && inPlace !== current) set(piece, inPlace);
  }
}

/** The options `themeMaster` takes. */
export interface ThemeMasterOptsV1 {
  /**
   * The colours the master is drawn with as shipped (the pack's light set). A bar or
   * a panel is held to the contrast it had there, up to 3:1, so a card the Light
   * master draws a shade off its ground stays a card and a rule stays a rule.
   * Without it bars and panels are left as the theme drew them.
   */
  base?: Record<string, string>;
}

/**
 * The master with each archetype's `dark` flag set for its ground under `colors`:
 * measured where the ground resolves to a colour, flipped where it cannot be read
 * and `flip` is set, left as the master states it otherwise. A fresh copy.
 *
 * Then everything drawn over a ground is measured on what it sits on under the
 * theme, and a colour that no longer holds takes a pack path that does:
 *
 *   | what                         | on                           | minimum                 |
 *   |------------------------------|------------------------------|-------------------------|
 *   | a bar or a panel             | the panel under it, or ground| its Light contrast, <= 3|
 *   | a page number or a footer    | the panel under it, or ground| 4.5, 3 at 24 px or more |
 *   | a placeholder's text         | the panel under it, or ground| 4.5, 3 for large roles  |
 *
 * A piece of furniture is shared by the archetypes that list it, so where one colour
 * cannot hold on all of their grounds the piece is copied under a new id for the
 * archetypes that need the other colour (`repairFurniture`).
 */
export function themeMaster(master: SlideMasterV1, colors: Record<string, string>, flip = false, opts: ThemeMasterOptsV1 = {}): SlideMasterV1 {
  const out = structuredClone(master);
  const grounds = new Map<string, string>();
  const baseGrounds = new Map<string, string>();
  for (const archetype of out.archetypes) {
    const ground = archetype.background;
    if (!ground) continue;
    const hex = ground.tokenPath !== undefined ? colors[ground.tokenPath] ?? ground.hex : ground.hex;
    if (hex !== undefined && parseBackgroundRgb(hex)) ground.dark = bgIsDark(hex);
    else if (flip) ground.dark = ground.dark !== true;
    if (hex !== undefined) grounds.set(archetype.id, hex);
    const baseHex = ground.tokenPath !== undefined ? opts.base?.[ground.tokenPath] ?? ground.hex : ground.hex;
    if (baseHex !== undefined) baseGrounds.set(archetype.id, baseHex);
  }

  // Bars and panels first, since text is measured on the panel under it. Each is
  // held to the least contrast the shipped master gives it across its layouts, up to
  // 3:1: a colour strip the pack itself draws faintly on white may stay faint, but
  // a rule or a card never merges into a ground the theme moved under it.
  const basePieces = new Map(master.furniture.map((one) => [one.id, one]));
  const shippedMin = new Map<string, number>();
  const shippedOf = (piece: MasterFurnitureV1, current: string): number => {
    const known = shippedMin.get(piece.id);
    if (known !== undefined) return known;
    let least = Number.POSITIVE_INFINITY;
    const base = opts.base;
    if (base) {
      for (const archetype of master.archetypes) {
        const at = (archetype.furniture ?? []).indexOf(piece.id);
        const ground = baseGrounds.get(archetype.id);
        if (at < 0 || ground === undefined || base[current] === undefined) continue;
        least = Math.min(least, inkContrast(base[current], backdropAt(archetype, basePieces, base, ground, furnitureCentre(piece.box), at)));
      }
    }
    shippedMin.set(piece.id, least);
    return least;
  };
  repairFurniture(out, grounds, colors, 'fill', (piece, _archetype, backdrop, current) => {
    // Without the shipped colours there is no telling a quiet card from a lost one,
    // so bars and panels are left as the theme drew them.
    const shipped = shippedOf(piece, current);
    if (!Number.isFinite(shipped) || shipped <= MERGED_CONTRAST) return undefined;
    const minimum = Math.min(NON_TEXT_CONTRAST, shipped);
    if (inkContrast(colors[current], backdrop) + 1e-9 >= minimum) return undefined;
    return holdingFill(colors, backdrop, minimum, current, opts.base);
  });

  // Page numbers and footers.
  repairFurniture(out, grounds, colors, 'ink', (piece, _archetype, backdrop, current) => {
    const minimum = (piece.style?.fontSize ?? 0) >= LARGE_FURNITURE_PX ? 3 : 4.5;
    if (inkContrast(colors[current], backdrop) >= minimum) return undefined;
    return holdingInk(colors, backdrop, minimum, current);
  });

  // A placeholder's ink is measured on what it sits on: the last opaque panel of
  // the layout's furniture under its centre, else the ground. An ink that no
  // longer holds there takes a pack path that does, so a jungle title on a hero
  // the theme turned white becomes the pack's dark ink rather than unreadable.
  const pieces = new Map(out.furniture.map((piece) => [piece.id, piece]));
  for (const archetype of out.archetypes) {
    const hex = grounds.get(archetype.id);
    if (hex === undefined) continue;
    for (const placeholder of archetype.placeholders) {
      const style = placeholder.style;
      const inkPath = style?.fgTokenPath;
      if (!style || !inkPath || colors[inkPath] === undefined) continue;
      const backdrop = backdropAt(archetype, pieces, colors, hex, furnitureCentre(placeholder.box));
      const minimum = LARGE_ROLES.has(placeholder.role) ? 3 : 4.5;
      if (inkContrast(colors[inkPath], backdrop) >= minimum) continue;
      const better = holdingInk(colors, backdrop, minimum, inkPath);
      if (better) style.fgTokenPath = better;
    }
  }
  return out;
}

/** The options `themedColors` takes. */
export interface ThemedColorsOptsV1 {
  look?: DeckLookV1;
  /** The design system is brand-locked, so a look theme is not applied (`theme.look-locked`). */
  locked?: boolean;
}

/**
 * Resolve a deck theme against its source (plan 275 section 6.2). Pure: the same
 * source, theme and look give the same answer, and the source is not changed.
 *
 * A theme that asks for the dark mode of a pack that states none (a pack edited
 * since, or a shell that did not read the dark mode) resolves to the Dark built from
 * the primary colour's ramp (`darkFallbackRemap`) and says so, so a stored Dark is
 * never drawn in the light colours.
 */
export function themedColors(source: ThemeSourceV1, theme: DeckThemeV1 | null | undefined, opts: ThemedColorsOptsV1 = {}): ThemedColorsV1 {
  const notes: ThemeNoteV1[] = [];
  const plain = (): ThemedColorsV1 => {
    const colors = sortedRecord(source.colors);
    return { theme: theme ?? null, mode: 'light', modeColors: colors, colors: { ...colors }, master: source.master, notes };
  };
  if (!theme || isPlainTheme(theme)) return plain();
  if (lookOnLocked(theme, opts.locked)) {
    notes.push({ code: 'theme.look-locked', params: { lookId: theme.lookId ?? '' } });
    return plain();
  }
  let mode: 'light' | 'dark' = 'light';
  let base = source.colors;
  let remapRows = theme.remap;
  let flip = theme.flipDark === true;
  if (theme.mode === 'dark') {
    if (source.darkColors && Object.keys(source.darkColors).length > 0) {
      mode = 'dark';
      base = source.darkColors;
    } else {
      const fallback = darkFallbackRemap(source.colors, source.master);
      notes.push(fallback ? { code: 'theme.no-dark-mode', params: { ground: fallback.groundPath } } : { code: 'theme.no-dark-mode' });
      if (fallback) {
        remapRows = fallback.remap;
        flip = true;
      }
    }
  }
  let modeColors = sortedRecord(base);
  if (theme.id === 'look') {
    const look = opts.look && opts.look.id === theme.lookId ? opts.look : undefined;
    if (look) modeColors = sortedRecord({ ...modeColors, ...hexRecord(look.colors) });
    else notes.push({ code: 'theme.look-missing', params: { lookId: theme.lookId ?? '' } });
  }
  const remap = new Map<string, string>();
  for (const row of remapRows) {
    if (modeColors[row.to] === undefined) {
      notes.push({ code: 'theme.remap-skipped', params: { from: row.from, to: row.to } });
      continue;
    }
    if (!remap.has(row.from)) remap.set(row.from, row.to);
  }
  const colors: Record<string, string> = {};
  for (const tokenPath of [...new Set([...Object.keys(modeColors), ...remap.keys()])].sort(compareText)) {
    const hex = modeColors[remap.get(tokenPath) ?? tokenPath];
    if (hex !== undefined) colors[tokenPath] = hex;
  }
  return { theme, mode, modeColors, colors, master: themeMaster(source.master, colors, flip, { base: source.colors }), notes };
}

function isRebrandShape(value: object): value is RebrandDesignSystemV1 {
  return 'firstPass' in value && 'compile' in value && 'input' in value && 'snapshot' in value;
}

function isFirstPassShape(value: object): value is FirstPassDesignSystemV1 {
  return 'swatches' in value && Array.isArray(value.swatches) && 'master' in value && 'snapshot' in value;
}

function isCompileShape(value: object): value is RenovateDesignSystemV1 {
  return 'tokens' in value && typeof value.tokens === 'function' && 'snapshot' in value;
}

/**
 * The colours a first-pass shape carries for theming, as plain data, so a structured
 * clone (a worker, another realm) themes it exactly the way this realm does. Not a
 * field of the `FirstPassDesignSystemV1` contract: a first pass that does not know it
 * never reads it, and a shape without it falls back to its swatches.
 */
export interface ThemeCarryV1 {
  themeSource?: { colors: Record<string, string>; darkColors?: Record<string, string> };
}

function carryOf(source: ThemeSourceV1): NonNullable<ThemeCarryV1['themeSource']> {
  return { colors: sortedRecord(source.colors), ...(source.darkColors ? { darkColors: sortedRecord(source.darkColors) } : {}) };
}

function readCarry(system: object): ThemeCarryV1['themeSource'] | undefined {
  if (!('themeSource' in system)) return undefined;
  const carried = system.themeSource;
  if (carried === null || typeof carried !== 'object' || !('colors' in carried)) return undefined;
  const colors = carried.colors;
  if (colors === null || typeof colors !== 'object') return undefined;
  const dark = 'darkColors' in carried ? carried.darkColors : undefined;
  const asRecord = (value: object): Record<string, string> => Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  return { colors: asRecord(colors), ...(dark !== null && typeof dark === 'object' ? { darkColors: asRecord(dark) } : {}) };
}

/**
 * The colours a first-pass shape this realm did not resolve is themed from: the
 * colours it carries (`ThemeCarryV1`), dark mode included, else its swatches.
 */
function sourceOfFirstPass(system: FirstPassDesignSystemV1): ThemeSourceV1 {
  const carried = readCarry(system);
  if (carried) return { ...carried, master: system.master };
  const colors: Record<string, string> = {};
  for (const swatch of system.swatches) colors[swatch.path] = swatch.hex;
  return { colors, master: system.master };
}

/** Whether an archetype whose ground cannot be measured flips: the theme says so, or a Dark stands in for a missing dark mode. */
function flipsDark(theme: DeckThemeV1, source: ThemeSourceV1): boolean {
  const noDark = !source.darkColors || Object.keys(source.darkColors).length === 0;
  return theme.flipDark === true || (theme.mode === 'dark' && noDark);
}

/** A shape's own master under the theme: its grounds measured, its furniture and inks repaired. */
function shapeMaster(master: SlideMasterV1, themed: ThemedColorsV1, theme: DeckThemeV1, source: ThemeSourceV1): SlideMasterV1 {
  return themeMaster(master, themed.colors, flipsDark(theme, source), { base: source.colors });
}

function themeFirstPass(system: FirstPassDesignSystemV1, themed: ThemedColorsV1, theme: DeckThemeV1, source: ThemeSourceV1): FirstPassDesignSystemV1 & ThemeCarryV1 {
  const out: FirstPassDesignSystemV1 & ThemeCarryV1 = {
    ...system,
    snapshot: { ...system.snapshot, theme: structuredClone(theme) },
    swatches: swatchesFromColors(themed.colors),
    master: shapeMaster(system.master, themed, theme, source),
    themeSource: carryOf(source),
  };
  if (system.slots) out.slots = themeSlotsFromColors(themed.colors);
  return out;
}

function themeCompile(system: RenovateDesignSystemV1, themed: ThemedColorsV1, theme: DeckThemeV1): RenovateDesignSystemV1 {
  const tokens = new Map(Object.entries(themed.colors));
  return {
    ...system,
    snapshot: { ...system.snapshot, theme: structuredClone(theme) },
    tokens: (tokenPath: string): string | undefined => tokens.get(tokenPath),
  };
}

/**
 * The design system a plan is planned and compiled against once its deck theme is
 * applied (plan 275 section 6.2). The first pass and the compile call this one
 * function at their top, so the web view, the stage worker, the CLI and the MCP
 * tool all get one behaviour with no edit of their own.
 *
 * It reads the theme from `plan.designSystem.theme` and takes each shape the
 * engine resolves: the whole `RebrandDesignSystemV1`, the first pass's shape (its
 * swatches, slot table and master) and the compile's shape (its token resolver).
 * No theme, or a Light theme that changes nothing, returns the system itself, so
 * an unthemed plan is planned and compiled exactly as before. A look theme on a
 * locked design system (`opts.locked`) is not applied either. A shape it cannot
 * read the colours of (a compile shape from another realm, with no `source`) is
 * returned unchanged too.
 *
 * A first-pass shape made here carries its colours, dark mode included, as plain
 * data (`ThemeCarryV1`), so a structured clone of it is themed the way this realm
 * themes it.
 *
 * The snapshot gains the theme; the token hash is never touched, because it
 * identifies the pack's tokens and a themed plan must not be refused for being
 * themed. Applying the same theme to a shape it already themed returns that shape.
 */
export function systemForPlan(system: RebrandDesignSystemV1, plan?: ThemedPlanLikeV1 | null, opts?: SystemForPlanOptsV1): RebrandDesignSystemV1;
export function systemForPlan(system: FirstPassDesignSystemV1, plan?: ThemedPlanLikeV1 | null, opts?: SystemForPlanOptsV1): FirstPassDesignSystemV1;
export function systemForPlan(system: RenovateDesignSystemV1, plan?: ThemedPlanLikeV1 | null, opts?: SystemForPlanOptsV1): RenovateDesignSystemV1;
export function systemForPlan<T>(system: T, plan?: ThemedPlanLikeV1 | null, opts?: SystemForPlanOptsV1): T;
export function systemForPlan(system: unknown, plan?: ThemedPlanLikeV1 | null, opts: SystemForPlanOptsV1 = {}): unknown {
  const theme = plan?.designSystem?.theme;
  if (!theme || isPlainTheme(theme) || lookOnLocked(theme, opts.locked) || system === null || typeof system !== 'object') return system;
  const memo = THEME_SOURCES.get(system);
  const key = themeKey(theme, opts.look);
  if (memo?.applied === key) return system;
  const source = opts.source ?? memo?.source ?? (isFirstPassShape(system) ? sourceOfFirstPass(system) : undefined);
  if (!source) return system;
  const themed = themedColors(source, theme, opts.look ? { look: opts.look } : {});
  const remember = <S extends object>(shape: S): S => {
    THEME_SOURCES.set(shape, { source, applied: key });
    return shape;
  };
  if (isRebrandShape(system)) {
    return remember({
      ...system,
      input: { ...system.input, master: shapeMaster(system.input.master, themed, theme, source) },
      snapshot: { ...system.snapshot, theme: structuredClone(theme) },
      slots: themeSlotsFromColors(themed.colors),
      firstPass: remember(themeFirstPass(system.firstPass, themed, theme, source)),
      compile: remember(themeCompile(system.compile, themed, theme)),
    });
  }
  if (isFirstPassShape(system)) return remember(themeFirstPass(system, themed, theme, source));
  if (isCompileShape(system)) return remember(themeCompile(system, themed, theme));
  return system;
}

/** The part of a plan `systemForPlan` reads: its snapshot's theme. */
export interface ThemedPlanLikeV1 {
  designSystem?: Pick<DesignSystemSnapshotV1, 'theme'>;
}

/**
 * The master a themed plan is compiled on: each archetype's `dark` flag set for its
 * themed ground, so the logo variant and the ink follow the ground. `system` is the
 * resolved design system (one of its three shapes) the colours are read from; without a
 * theme, or with a look theme on a locked design system, the master comes back as it
 * was given.
 */
export function masterForPlan(master: SlideMasterV1, plan: ThemedPlanLikeV1 | null | undefined, opts: SystemForPlanOptsV1 & { system?: unknown } = {}): SlideMasterV1 {
  const theme = plan?.designSystem?.theme;
  if (!theme || isPlainTheme(theme) || lookOnLocked(theme, opts.locked)) return master;
  const source = opts.source ?? themeSourceOf(opts.system)
    ?? (opts.system !== null && typeof opts.system === 'object' && isFirstPassShape(opts.system) ? sourceOfFirstPass(opts.system) : undefined);
  if (!source) return themeMaster(master, {}, theme.flipDark === true);
  const themed = themedColors({ ...source, master }, theme, opts.look ? { look: opts.look } : {});
  return themed.master;
}

// ─── the neutral master ──────────────────────────────────────────────────────

/**
 * The neutral fallback master, a fresh deep copy each call so a caller can edit
 * it. Equal to masters[0] of the lolly-start pack's `slides/masters.json`, which
 * the design-system test reads and compares.
 */
export function neutralSlideMaster(): SlideMasterV1 {
  return structuredClone(NEUTRAL_MASTER);
}

/**
 * The data itself, masters[0] of the lolly-start pack written as a TS literal.
 * GENERATED from here to the end of the file by `scripts/build-slide-masters.ts`,
 * in the same run that writes the pack file, so the two cannot drift; the equality
 * test in `tests/rebrand-design-system.test.ts` fails when they do.
 */
const NEUTRAL_MASTER: SlideMasterV1 = {
  id: 'lolly/slides/neutral',
  version: '1.3.0',
  name: 'Neutral slide master',
  description: 'The starter deck geometry at 1280 by 720: twelve hand-tuned archetypes and the layout library structures expanded in the same margins, every box a fraction of the slide, colours named as design-system token paths so a brand that is imported over the blank starter takes the whole master with it. No brand decoration, because a colourless starter has no brand hues to draw with.',
  size: { width: 1280, height: 720 },
  archetypes: [
    { id: 'title', name: 'Title', structure: 'cover-title', background: { tokenPath: 'color.semantic.text', dark: true }, furniture: ['logo-hero'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.22, w: 0.723, h: 0.399 }, kind: 'text', style: { fontSize: 69, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Presentation title' }, { role: 'subtitle', box: { x: 0.0341, y: 0.646, w: 0.932, h: 0.154 }, kind: 'text', style: { fontSize: 27, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Subtitle' }] },
    { id: 'section', name: 'Section header', structure: 'section', background: { tokenPath: 'color.semantic.text', dark: true }, furniture: ['logo-hero', 'page-number-right-on-dark'], placeholders: [{ role: 'title', box: { x: 0.0533, y: 0.2537, w: 0.6, h: 0.4 }, kind: 'text', style: { fontSize: 59, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Section header' }, { role: 'subtitle', box: { x: 0.0533, y: 0.665, w: 0.6, h: 0.12 }, kind: 'text', style: { fontSize: 24, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'What this section covers' }] },
    { id: 'content', name: 'Title and body', structure: 'title-body', background: { tokenPath: 'color.semantic.surface', dark: false }, furniture: ['footer', 'logo', 'page-number'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Title' }, { role: 'body', box: { x: 0.0341, y: 0.19, w: 0.9318, h: 0.6566 }, kind: 'text', style: { weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Add your points' }], variants: { dark: 'content-dark' } },
    { id: 'two-column', name: 'Title and two columns', structure: 'text-two-column', background: { tokenPath: 'color.semantic.surface', dark: false }, furniture: ['card-left', 'card-right', 'footer', 'logo', 'page-number'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Title' }, { role: 'body', box: { x: 0.0538, y: 0.2598, w: 0.4211, h: 0.5974 }, kind: 'text', style: { fontSize: 20, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Left column' }, { role: 'body', box: { x: 0.5251, y: 0.2598, w: 0.4211, h: 0.5974 }, kind: 'text', style: { fontSize: 20, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Right column' }], variants: { dark: 'two-column-dark' } },
    { id: 'split', name: 'Panel and visual', structure: 'text-and-image', background: { tokenPath: 'color.semantic.surface', dark: false }, furniture: ['split-panel', 'footer-on-panel', 'logo', 'page-number-right'], placeholders: [{ role: 'visual', box: { x: 0.367, y: 0.0342, w: 0.5706, h: 0.8596 }, kind: 'image', fit: 'cover', prompt: 'Picture, chart or diagram' }, { role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.267, h: 0.3144 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Section title' }, { role: 'body', box: { x: 0.0341, y: 0.3768, w: 0.2792, h: 0.4632 }, kind: 'text', style: { fontSize: 20, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Description' }] },
    { id: 'visual', name: 'Title and visual', structure: 'visual', background: { tokenPath: 'color.semantic.surface', dark: false }, furniture: ['footer', 'logo', 'page-number'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Title' }, { role: 'visual', box: { x: 0.0341, y: 0.19, w: 0.9318, h: 0.6566 }, kind: 'image', fit: 'contain', prompt: 'Picture, chart or diagram' }], variants: { dark: 'visual-dark' } },
    { id: 'full-image', name: 'Full-page picture', structure: 'full-image-caption', background: { tokenPath: 'color.semantic.text', dark: true }, furniture: ['caption-scrim', 'logo-hero', 'page-number-right-on-dark'], placeholders: [{ role: 'visual', box: { x: 0, y: 0, w: 1, h: 1 }, kind: 'image', fit: 'cover', prompt: 'Full-bleed picture' }, { role: 'caption', box: { x: 0.0341, y: 0.82, w: 0.9318, h: 0.14 }, kind: 'text', style: { fontSize: 35, weight: '700', align: 'left', valign: 'middle', fgTokenPath: 'color.semantic.surface' }, prompt: 'Caption' }] },
    { id: 'quote', name: 'Quote', structure: 'quote', background: { tokenPath: 'color.semantic.text', dark: true }, furniture: ['logo-hero-centre', 'page-number-right-on-dark'], placeholders: [{ role: 'quote', box: { x: 0.14, y: 0.34, w: 0.72, h: 0.34 }, kind: 'text', style: { fontSize: 40, weight: '400', align: 'center', valign: 'middle', fgTokenPath: 'color.semantic.surface' }, prompt: 'The quotation' }, { role: 'attribution', box: { x: 0.14, y: 0.72, w: 0.72, h: 0.08 }, kind: 'text', style: { fontSize: 21, weight: '700', align: 'center', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Who said it' }] },
    { id: 'big-number', name: 'Big number', structure: 'big-number', background: { tokenPath: 'color.semantic.surface', dark: false }, furniture: ['logo-hero', 'page-number-right'], placeholders: [{ role: 'number', box: { x: 0.225, y: 0.255, w: 0.563, h: 0.382 }, kind: 'text', style: { fontSize: 112, weight: '700', align: 'center', valign: 'middle', fgTokenPath: 'color.semantic.text' }, prompt: 'xx%' }, { role: 'caption', box: { x: 0.225, y: 0.618, w: 0.563, h: 0.131 }, kind: 'text', style: { fontSize: 24, weight: '400', align: 'center', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'What the number means', overlay: true }] },
    { id: 'main-point', name: 'Main point', structure: 'statement', background: { tokenPath: 'color.ramp.neutral.8', dark: false }, furniture: ['logo-hero', 'page-number-right'], placeholders: [{ role: 'title', box: { x: 0.0533, y: 0.2537, w: 0.65, h: 0.4 }, kind: 'text', style: { fontSize: 59, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'One big statement' }, { role: 'subtitle', box: { x: 0.0533, y: 0.665, w: 0.65, h: 0.12 }, kind: 'text', style: { fontSize: 24, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'The supporting line' }] },
    { id: 'agenda', name: 'Agenda', structure: 'agenda', background: { tokenPath: 'color.semantic.surface', dark: false }, furniture: ['footer', 'logo', 'page-number'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Agenda' }, { role: 'body', box: { x: 0.0341, y: 0.19, w: 0.9318, h: 0.6566 }, kind: 'text', style: { fontSize: 27, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'One line per section' }], variants: { dark: 'agenda-dark' } },
    { id: 'table', name: 'Table', structure: 'table', background: { tokenPath: 'color.semantic.surface', dark: false }, furniture: ['footer', 'logo', 'page-number'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Title' }, { role: 'data', box: { x: 0.0341, y: 0.19, w: 0.9318, h: 0.6566 }, kind: 'table', style: { fontSize: 20, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Rows and columns' }], variants: { dark: 'table-dark' } },
    { id: 'cover-title-image', name: 'Title with picture', structure: 'cover-title-image', background: { tokenPath: 'color.semantic.surface', dark: false }, furniture: ['logo-hero'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.22, w: 0.4348, h: 0.38 }, kind: 'text', style: { fontSize: 59, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Title' }, { role: 'subtitle', box: { x: 0.0341, y: 0.63, w: 0.4348, h: 0.15 }, kind: 'text', style: { fontSize: 27, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Subtitle' }, { role: 'visual', box: { x: 0.5207, y: 0, w: 0.4793, h: 1 }, kind: 'image', fit: 'cover', prompt: 'Picture' }] },
    { id: 'title-only', name: 'Title only', structure: 'title-only', background: { tokenPath: 'color.semantic.surface', dark: false }, furniture: ['footer', 'logo', 'page-number'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Title' }], variants: { dark: 'title-only-dark' } },
    { id: 'title-subtitle-body', name: 'Title, subtitle and body', structure: 'title-subtitle-body', background: { tokenPath: 'color.semantic.surface', dark: false }, furniture: ['footer', 'logo', 'page-number'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Title' }, { role: 'subtitle', box: { x: 0.0341, y: 0.1455, w: 0.9318, h: 0.06 }, kind: 'text', style: { fontSize: 24, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Subtitle' }, { role: 'body', box: { x: 0.0341, y: 0.2355, w: 0.9318, h: 0.6111 }, kind: 'text', style: { weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text' }], variants: { dark: 'title-subtitle-body-dark' } },
    { id: 'comparison', name: 'Comparison', structure: 'comparison', background: { tokenPath: 'color.semantic.surface', dark: false }, furniture: ['footer', 'logo', 'page-number'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Title' }, { role: 'label', box: { x: 0.0341, y: 0.19, w: 0.4559, h: 0.0844 }, kind: 'text', style: { fontSize: 24, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c1', index: 0, optional: true }, { role: 'body', box: { x: 0.0341, y: 0.3044, w: 0.4559, h: 0.5422 }, kind: 'text', style: { fontSize: 20, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c1', index: 0 }, { role: 'label', box: { x: 0.51, y: 0.19, w: 0.4559, h: 0.0844 }, kind: 'text', style: { fontSize: 24, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c2', index: 1, optional: true }, { role: 'body', box: { x: 0.51, y: 0.3044, w: 0.4559, h: 0.5422 }, kind: 'text', style: { fontSize: 20, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c2', index: 1 }], variants: { dark: 'comparison-dark' } },
    { id: 'columns-2', name: 'Two boxes', structure: 'columns-2', background: { tokenPath: 'color.semantic.surface', dark: false }, furniture: ['footer', 'logo', 'page-number'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Title' }, { role: 'label', box: { x: 0.0341, y: 0.19, w: 0.4559, h: 0.1283 }, kind: 'text', style: { fontSize: 24, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c1', index: 0, optional: true }, { role: 'body', box: { x: 0.0341, y: 0.3333, w: 0.4559, h: 0.5133 }, kind: 'text', style: { fontSize: 20, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c1', index: 0 }, { role: 'label', box: { x: 0.51, y: 0.19, w: 0.4559, h: 0.1283 }, kind: 'text', style: { fontSize: 24, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c2', index: 1, optional: true }, { role: 'body', box: { x: 0.51, y: 0.3333, w: 0.4559, h: 0.5133 }, kind: 'text', style: { fontSize: 20, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c2', index: 1 }], repeat: { count: 2, across: 2, cell: ['label:0.2', 'body:0.8'] }, variants: { dark: 'columns-2-dark' } },
    { id: 'columns-3', name: 'Three boxes', structure: 'columns-3', background: { tokenPath: 'color.semantic.surface', dark: false }, furniture: ['footer', 'logo', 'page-number'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Title' }, { role: 'label', box: { x: 0.0341, y: 0.19, w: 0.2973, h: 0.1283 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c1', index: 0, optional: true }, { role: 'body', box: { x: 0.0341, y: 0.3333, w: 0.2973, h: 0.5133 }, kind: 'text', style: { fontSize: 18, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c1', index: 0 }, { role: 'label', box: { x: 0.3514, y: 0.19, w: 0.2973, h: 0.1283 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c2', index: 1, optional: true }, { role: 'body', box: { x: 0.3514, y: 0.3333, w: 0.2973, h: 0.5133 }, kind: 'text', style: { fontSize: 18, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c2', index: 1 }, { role: 'label', box: { x: 0.6686, y: 0.19, w: 0.2973, h: 0.1283 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c3', index: 2, optional: true }, { role: 'body', box: { x: 0.6686, y: 0.3333, w: 0.2973, h: 0.5133 }, kind: 'text', style: { fontSize: 18, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c3', index: 2 }], repeat: { count: 3, across: 3, cell: ['label:0.2', 'body:0.8'] }, variants: { dark: 'columns-3-dark' } },
    { id: 'columns-4', name: 'Four boxes', structure: 'columns-4', background: { tokenPath: 'color.semantic.surface', dark: false }, furniture: ['footer', 'logo', 'page-number'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Title' }, { role: 'label', box: { x: 0.0341, y: 0.19, w: 0.2179, h: 0.1283 }, kind: 'text', style: { fontSize: 20, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c1', index: 0, optional: true }, { role: 'body', box: { x: 0.0341, y: 0.3333, w: 0.2179, h: 0.5133 }, kind: 'text', style: { fontSize: 16, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c1', index: 0 }, { role: 'label', box: { x: 0.272, y: 0.19, w: 0.2179, h: 0.1283 }, kind: 'text', style: { fontSize: 20, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c2', index: 1, optional: true }, { role: 'body', box: { x: 0.272, y: 0.3333, w: 0.2179, h: 0.5133 }, kind: 'text', style: { fontSize: 16, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c2', index: 1 }, { role: 'label', box: { x: 0.51, y: 0.19, w: 0.2179, h: 0.1283 }, kind: 'text', style: { fontSize: 20, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c3', index: 2, optional: true }, { role: 'body', box: { x: 0.51, y: 0.3333, w: 0.2179, h: 0.5133 }, kind: 'text', style: { fontSize: 16, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c3', index: 2 }, { role: 'label', box: { x: 0.7479, y: 0.19, w: 0.2179, h: 0.1283 }, kind: 'text', style: { fontSize: 20, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c4', index: 3, optional: true }, { role: 'body', box: { x: 0.7479, y: 0.3333, w: 0.2179, h: 0.5133 }, kind: 'text', style: { fontSize: 16, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c4', index: 3 }], repeat: { count: 4, across: 4, cell: ['label:0.2', 'body:0.8'] }, variants: { dark: 'columns-4-dark' } },
    { id: 'icon-columns-3', name: 'Three boxes with icons', structure: 'icon-columns-3', background: { tokenPath: 'color.semantic.surface', dark: false }, furniture: ['footer', 'logo', 'page-number'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Title' }, { role: 'visual', box: { x: 0.0341, y: 0.19, w: 0.2973, h: 0.1566 }, kind: 'image', fit: 'contain', prompt: 'Picture', group: 'c1', index: 0 }, { role: 'label', box: { x: 0.0341, y: 0.3616, w: 0.2973, h: 0.094 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c1', index: 0, optional: true }, { role: 'body', box: { x: 0.0341, y: 0.4706, w: 0.2973, h: 0.376 }, kind: 'text', style: { fontSize: 18, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c1', index: 0 }, { role: 'visual', box: { x: 0.3514, y: 0.19, w: 0.2973, h: 0.1566 }, kind: 'image', fit: 'contain', prompt: 'Picture', group: 'c2', index: 1 }, { role: 'label', box: { x: 0.3514, y: 0.3616, w: 0.2973, h: 0.094 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c2', index: 1, optional: true }, { role: 'body', box: { x: 0.3514, y: 0.4706, w: 0.2973, h: 0.376 }, kind: 'text', style: { fontSize: 18, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c2', index: 1 }, { role: 'visual', box: { x: 0.6686, y: 0.19, w: 0.2973, h: 0.1566 }, kind: 'image', fit: 'contain', prompt: 'Picture', group: 'c3', index: 2 }, { role: 'label', box: { x: 0.6686, y: 0.3616, w: 0.2973, h: 0.094 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c3', index: 2, optional: true }, { role: 'body', box: { x: 0.6686, y: 0.4706, w: 0.2973, h: 0.376 }, kind: 'text', style: { fontSize: 18, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c3', index: 2 }], repeat: { count: 3, across: 3, cell: ['visual:0.25', 'label:0.15', 'body:0.6'] }, variants: { dark: 'icon-columns-3-dark' } },
    { id: 'grid-2x2', name: 'Four boxes in a grid', structure: 'grid-2x2', background: { tokenPath: 'color.semantic.surface', dark: false }, furniture: ['footer', 'logo', 'page-number'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Title' }, { role: 'label', box: { x: 0.0341, y: 0.19, w: 0.4559, h: 0.0746 }, kind: 'text', style: { fontSize: 24, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c1', index: 0, optional: true }, { role: 'body', box: { x: 0.0341, y: 0.2796, w: 0.4559, h: 0.2237 }, kind: 'text', style: { fontSize: 20, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c1', index: 0 }, { role: 'label', box: { x: 0.51, y: 0.19, w: 0.4559, h: 0.0746 }, kind: 'text', style: { fontSize: 24, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c2', index: 1, optional: true }, { role: 'body', box: { x: 0.51, y: 0.2796, w: 0.4559, h: 0.2237 }, kind: 'text', style: { fontSize: 20, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c2', index: 1 }, { role: 'label', box: { x: 0.0341, y: 0.5333, w: 0.4559, h: 0.0746 }, kind: 'text', style: { fontSize: 24, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c3', index: 2, optional: true }, { role: 'body', box: { x: 0.0341, y: 0.6229, w: 0.4559, h: 0.2237 }, kind: 'text', style: { fontSize: 20, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c3', index: 2 }, { role: 'label', box: { x: 0.51, y: 0.5333, w: 0.4559, h: 0.0746 }, kind: 'text', style: { fontSize: 24, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c4', index: 3, optional: true }, { role: 'body', box: { x: 0.51, y: 0.6229, w: 0.4559, h: 0.2237 }, kind: 'text', style: { fontSize: 20, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c4', index: 3 }], repeat: { count: 4, across: 2, cell: ['label:0.25', 'body:0.75'] }, variants: { dark: 'grid-2x2-dark' } },
    { id: 'grid-3x2', name: 'Six boxes', structure: 'grid-3x2', background: { tokenPath: 'color.semantic.surface', dark: false }, furniture: ['footer', 'logo', 'page-number'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Title' }, { role: 'label', box: { x: 0.0341, y: 0.19, w: 0.2973, h: 0.0746 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c1', index: 0, optional: true }, { role: 'body', box: { x: 0.0341, y: 0.2796, w: 0.2973, h: 0.2237 }, kind: 'text', style: { fontSize: 18, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c1', index: 0 }, { role: 'label', box: { x: 0.3514, y: 0.19, w: 0.2973, h: 0.0746 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c2', index: 1, optional: true }, { role: 'body', box: { x: 0.3514, y: 0.2796, w: 0.2973, h: 0.2237 }, kind: 'text', style: { fontSize: 18, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c2', index: 1 }, { role: 'label', box: { x: 0.6686, y: 0.19, w: 0.2973, h: 0.0746 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c3', index: 2, optional: true }, { role: 'body', box: { x: 0.6686, y: 0.2796, w: 0.2973, h: 0.2237 }, kind: 'text', style: { fontSize: 18, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c3', index: 2 }, { role: 'label', box: { x: 0.0341, y: 0.5333, w: 0.2973, h: 0.0746 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c4', index: 3, optional: true }, { role: 'body', box: { x: 0.0341, y: 0.6229, w: 0.2973, h: 0.2237 }, kind: 'text', style: { fontSize: 18, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c4', index: 3 }, { role: 'label', box: { x: 0.3514, y: 0.5333, w: 0.2973, h: 0.0746 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c5', index: 4, optional: true }, { role: 'body', box: { x: 0.3514, y: 0.6229, w: 0.2973, h: 0.2237 }, kind: 'text', style: { fontSize: 18, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c5', index: 4 }, { role: 'label', box: { x: 0.6686, y: 0.5333, w: 0.2973, h: 0.0746 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c6', index: 5, optional: true }, { role: 'body', box: { x: 0.6686, y: 0.6229, w: 0.2973, h: 0.2237 }, kind: 'text', style: { fontSize: 18, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c6', index: 5 }], repeat: { count: 6, across: 3, cell: ['label:0.25', 'body:0.75'] }, variants: { dark: 'grid-3x2-dark' } },
    { id: 'cards-3', name: 'Three cards', structure: 'cards-3', background: { tokenPath: 'color.semantic.surface', dark: false }, furniture: ['footer', 'logo', 'page-number'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Title' }, { role: 'visual', box: { x: 0.0341, y: 0.19, w: 0.2973, h: 0.282 }, kind: 'image', fit: 'cover', prompt: 'Picture', group: 'c1', index: 0 }, { role: 'label', box: { x: 0.0341, y: 0.487, w: 0.2973, h: 0.094 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c1', index: 0, optional: true }, { role: 'body', box: { x: 0.0341, y: 0.596, w: 0.2973, h: 0.2506 }, kind: 'text', style: { fontSize: 18, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c1', index: 0 }, { role: 'visual', box: { x: 0.3514, y: 0.19, w: 0.2973, h: 0.282 }, kind: 'image', fit: 'cover', prompt: 'Picture', group: 'c2', index: 1 }, { role: 'label', box: { x: 0.3514, y: 0.487, w: 0.2973, h: 0.094 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c2', index: 1, optional: true }, { role: 'body', box: { x: 0.3514, y: 0.596, w: 0.2973, h: 0.2506 }, kind: 'text', style: { fontSize: 18, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c2', index: 1 }, { role: 'visual', box: { x: 0.6686, y: 0.19, w: 0.2973, h: 0.282 }, kind: 'image', fit: 'cover', prompt: 'Picture', group: 'c3', index: 2 }, { role: 'label', box: { x: 0.6686, y: 0.487, w: 0.2973, h: 0.094 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c3', index: 2, optional: true }, { role: 'body', box: { x: 0.6686, y: 0.596, w: 0.2973, h: 0.2506 }, kind: 'text', style: { fontSize: 18, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c3', index: 2 }], repeat: { count: 3, across: 3, cell: ['visual:0.45', 'label:0.15', 'body:0.4'] }, variants: { dark: 'cards-3-dark' } },
    { id: 'full-image-plain', name: 'Full-page picture', structure: 'full-image', background: { tokenPath: 'color.semantic.text', dark: true }, furniture: ['caption-scrim', 'page-number-right-on-dark'], placeholders: [{ role: 'visual', box: { x: 0, y: 0, w: 1, h: 1 }, kind: 'image', fit: 'cover', prompt: 'Picture' }] },
    { id: 'image-caption', name: 'Picture with caption', structure: 'image-caption', background: { tokenPath: 'color.semantic.surface', dark: false }, furniture: ['footer', 'logo', 'page-number'], placeholders: [{ role: 'visual', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.672 }, kind: 'image', fit: 'cover', prompt: 'Picture' }, { role: 'caption', box: { x: 0.0341, y: 0.7622, w: 0.9318, h: 0.0844 }, kind: 'text', style: { weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Caption' }], variants: { dark: 'image-caption-dark' } },
    { id: 'image-and-text', name: 'Picture left, text right', structure: 'image-and-text', background: { tokenPath: 'color.semantic.surface', dark: false }, furniture: ['mirror-split-panel', 'mirror-footer-on-panel', 'mirror-logo', 'mirror-page-number-right'], placeholders: [{ role: 'visual', box: { x: 0.0624, y: 0.0342, w: 0.5706, h: 0.8596 }, kind: 'image', fit: 'cover', prompt: 'Picture, chart or diagram' }, { role: 'title', box: { x: 0.6989, y: 0.0342, w: 0.267, h: 0.3144 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Section title' }, { role: 'body', box: { x: 0.6867, y: 0.3768, w: 0.2792, h: 0.4632 }, kind: 'text', style: { fontSize: 20, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Description' }] },
    { id: 'images-2', name: 'Two pictures', structure: 'images-2', background: { tokenPath: 'color.semantic.surface', dark: false }, furniture: ['footer', 'logo', 'page-number'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Title' }, { role: 'visual', box: { x: 0.0341, y: 0.19, w: 0.4559, h: 0.5454 }, kind: 'image', fit: 'cover', prompt: 'Picture', group: 'c1', index: 0 }, { role: 'caption', box: { x: 0.0341, y: 0.7504, w: 0.4559, h: 0.0962 }, kind: 'text', style: { weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Caption', group: 'c1', index: 0, optional: true }, { role: 'visual', box: { x: 0.51, y: 0.19, w: 0.4559, h: 0.5454 }, kind: 'image', fit: 'cover', prompt: 'Picture', group: 'c2', index: 1 }, { role: 'caption', box: { x: 0.51, y: 0.7504, w: 0.4559, h: 0.0962 }, kind: 'text', style: { weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Caption', group: 'c2', index: 1, optional: true }], repeat: { count: 2, across: 2, cell: ['visual:0.85', 'caption:0.15'] }, variants: { dark: 'images-2-dark' } },
    { id: 'images-3', name: 'Three pictures', structure: 'images-3', background: { tokenPath: 'color.semantic.surface', dark: false }, furniture: ['footer', 'logo', 'page-number'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Title' }, { role: 'visual', box: { x: 0.0341, y: 0.19, w: 0.2973, h: 0.5454 }, kind: 'image', fit: 'cover', prompt: 'Picture', group: 'c1', index: 0 }, { role: 'caption', box: { x: 0.0341, y: 0.7504, w: 0.2973, h: 0.0962 }, kind: 'text', style: { weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Caption', group: 'c1', index: 0, optional: true }, { role: 'visual', box: { x: 0.3514, y: 0.19, w: 0.2973, h: 0.5454 }, kind: 'image', fit: 'cover', prompt: 'Picture', group: 'c2', index: 1 }, { role: 'caption', box: { x: 0.3514, y: 0.7504, w: 0.2973, h: 0.0962 }, kind: 'text', style: { weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Caption', group: 'c2', index: 1, optional: true }, { role: 'visual', box: { x: 0.6686, y: 0.19, w: 0.2973, h: 0.5454 }, kind: 'image', fit: 'cover', prompt: 'Picture', group: 'c3', index: 2 }, { role: 'caption', box: { x: 0.6686, y: 0.7504, w: 0.2973, h: 0.0962 }, kind: 'text', style: { weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Caption', group: 'c3', index: 2, optional: true }], repeat: { count: 3, across: 3, cell: ['visual:0.85', 'caption:0.15'] }, variants: { dark: 'images-3-dark' } },
    { id: 'image-grid-2x2', name: 'Four pictures', structure: 'image-grid-2x2', background: { tokenPath: 'color.semantic.surface', dark: false }, furniture: ['footer', 'logo', 'page-number'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Title' }, { role: 'visual', box: { x: 0.0341, y: 0.19, w: 0.4559, h: 0.3133 }, kind: 'image', fit: 'cover', prompt: 'Picture', group: 'c1', index: 0 }, { role: 'visual', box: { x: 0.51, y: 0.19, w: 0.4559, h: 0.3133 }, kind: 'image', fit: 'cover', prompt: 'Picture', group: 'c2', index: 1 }, { role: 'visual', box: { x: 0.0341, y: 0.5333, w: 0.4559, h: 0.3133 }, kind: 'image', fit: 'cover', prompt: 'Picture', group: 'c3', index: 2 }, { role: 'visual', box: { x: 0.51, y: 0.5333, w: 0.4559, h: 0.3133 }, kind: 'image', fit: 'cover', prompt: 'Picture', group: 'c4', index: 3 }], repeat: { count: 4, across: 2, cell: ['visual:1'] }, variants: { dark: 'image-grid-2x2-dark' } },
    { id: 'chart', name: 'Title and chart', structure: 'chart', background: { tokenPath: 'color.semantic.surface', dark: false }, furniture: ['footer', 'logo', 'page-number'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Title' }, { role: 'data', box: { x: 0.0341, y: 0.19, w: 0.9318, h: 0.6566 }, kind: 'image', fit: 'contain', prompt: 'Chart' }], variants: { dark: 'chart-dark' } },
    { id: 'chart-and-callout', name: 'Chart with takeaway', structure: 'chart-and-callout', background: { tokenPath: 'color.semantic.surface', dark: false }, furniture: ['footer', 'logo', 'page-number'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Title' }, { role: 'data', box: { x: 0.0341, y: 0.19, w: 0.6145, h: 0.6566 }, kind: 'image', fit: 'contain', prompt: 'Chart' }, { role: 'label', box: { x: 0.6686, y: 0.19, w: 0.2973, h: 0.0844 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'callout', index: 0, optional: true }, { role: 'body', box: { x: 0.6686, y: 0.3044, w: 0.2973, h: 0.5422 }, kind: 'text', style: { fontSize: 18, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'callout', index: 0 }], variants: { dark: 'chart-and-callout-dark' } },
    { id: 'stats-3', name: 'Three numbers', structure: 'stats-3', background: { tokenPath: 'color.semantic.surface', dark: false }, furniture: ['footer', 'logo', 'page-number'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Title' }, { role: 'number', box: { x: 0.0341, y: 0.19, w: 0.2973, h: 0.3529 }, kind: 'text', style: { fontSize: 72, weight: '700', align: 'center', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'xx%', group: 'c1', index: 0 }, { role: 'label', box: { x: 0.0341, y: 0.5579, w: 0.2973, h: 0.2887 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'center', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c1', index: 0, optional: true }, { role: 'number', box: { x: 0.3514, y: 0.19, w: 0.2973, h: 0.3529 }, kind: 'text', style: { fontSize: 72, weight: '700', align: 'center', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'xx%', group: 'c2', index: 1 }, { role: 'label', box: { x: 0.3514, y: 0.5579, w: 0.2973, h: 0.2887 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'center', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c2', index: 1, optional: true }, { role: 'number', box: { x: 0.6686, y: 0.19, w: 0.2973, h: 0.3529 }, kind: 'text', style: { fontSize: 72, weight: '700', align: 'center', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'xx%', group: 'c3', index: 2 }, { role: 'label', box: { x: 0.6686, y: 0.5579, w: 0.2973, h: 0.2887 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'center', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c3', index: 2, optional: true }], repeat: { count: 3, across: 3, cell: ['number:0.55', 'label:0.45'] }, variants: { dark: 'stats-3-dark' } },
    { id: 'stats-4', name: 'Four numbers', structure: 'stats-4', background: { tokenPath: 'color.semantic.surface', dark: false }, furniture: ['footer', 'logo', 'page-number'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Title' }, { role: 'number', box: { x: 0.0341, y: 0.19, w: 0.2179, h: 0.3529 }, kind: 'text', style: { fontSize: 72, weight: '700', align: 'center', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'xx%', group: 'c1', index: 0 }, { role: 'label', box: { x: 0.0341, y: 0.5579, w: 0.2179, h: 0.2887 }, kind: 'text', style: { fontSize: 20, weight: '700', align: 'center', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c1', index: 0, optional: true }, { role: 'number', box: { x: 0.272, y: 0.19, w: 0.2179, h: 0.3529 }, kind: 'text', style: { fontSize: 72, weight: '700', align: 'center', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'xx%', group: 'c2', index: 1 }, { role: 'label', box: { x: 0.272, y: 0.5579, w: 0.2179, h: 0.2887 }, kind: 'text', style: { fontSize: 20, weight: '700', align: 'center', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c2', index: 1, optional: true }, { role: 'number', box: { x: 0.51, y: 0.19, w: 0.2179, h: 0.3529 }, kind: 'text', style: { fontSize: 72, weight: '700', align: 'center', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'xx%', group: 'c3', index: 2 }, { role: 'label', box: { x: 0.51, y: 0.5579, w: 0.2179, h: 0.2887 }, kind: 'text', style: { fontSize: 20, weight: '700', align: 'center', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c3', index: 2, optional: true }, { role: 'number', box: { x: 0.7479, y: 0.19, w: 0.2179, h: 0.3529 }, kind: 'text', style: { fontSize: 72, weight: '700', align: 'center', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'xx%', group: 'c4', index: 3 }, { role: 'label', box: { x: 0.7479, y: 0.5579, w: 0.2179, h: 0.2887 }, kind: 'text', style: { fontSize: 20, weight: '700', align: 'center', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c4', index: 3, optional: true }], repeat: { count: 4, across: 4, cell: ['number:0.55', 'label:0.45'] }, variants: { dark: 'stats-4-dark' } },
    { id: 'steps-3', name: 'Three steps', structure: 'steps-3', background: { tokenPath: 'color.semantic.surface', dark: false }, furniture: ['footer', 'logo', 'page-number'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Title' }, { role: 'number', box: { x: 0.0341, y: 0.19, w: 0.2973, h: 0.1253 }, kind: 'text', style: { fontSize: 50, weight: '700', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: '1', group: 'c1', index: 0 }, { role: 'label', box: { x: 0.0341, y: 0.3303, w: 0.2973, h: 0.094 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c1', index: 0, optional: true }, { role: 'body', box: { x: 0.0341, y: 0.4393, w: 0.2973, h: 0.4073 }, kind: 'text', style: { fontSize: 18, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c1', index: 0 }, { role: 'number', box: { x: 0.3514, y: 0.19, w: 0.2973, h: 0.1253 }, kind: 'text', style: { fontSize: 50, weight: '700', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: '2', group: 'c2', index: 1 }, { role: 'label', box: { x: 0.3514, y: 0.3303, w: 0.2973, h: 0.094 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c2', index: 1, optional: true }, { role: 'body', box: { x: 0.3514, y: 0.4393, w: 0.2973, h: 0.4073 }, kind: 'text', style: { fontSize: 18, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c2', index: 1 }, { role: 'number', box: { x: 0.6686, y: 0.19, w: 0.2973, h: 0.1253 }, kind: 'text', style: { fontSize: 50, weight: '700', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: '3', group: 'c3', index: 2 }, { role: 'label', box: { x: 0.6686, y: 0.3303, w: 0.2973, h: 0.094 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c3', index: 2, optional: true }, { role: 'body', box: { x: 0.6686, y: 0.4393, w: 0.2973, h: 0.4073 }, kind: 'text', style: { fontSize: 18, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c3', index: 2 }], repeat: { count: 3, across: 3, cell: ['number:0.2', 'label:0.15', 'body:0.65'] }, variants: { dark: 'steps-3-dark' } },
    { id: 'steps-4', name: 'Four steps', structure: 'steps-4', background: { tokenPath: 'color.semantic.surface', dark: false }, furniture: ['footer', 'logo', 'page-number'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Title' }, { role: 'number', box: { x: 0.0341, y: 0.19, w: 0.2179, h: 0.1253 }, kind: 'text', style: { fontSize: 50, weight: '700', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: '1', group: 'c1', index: 0 }, { role: 'label', box: { x: 0.0341, y: 0.3303, w: 0.2179, h: 0.094 }, kind: 'text', style: { fontSize: 20, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c1', index: 0, optional: true }, { role: 'body', box: { x: 0.0341, y: 0.4393, w: 0.2179, h: 0.4073 }, kind: 'text', style: { fontSize: 16, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c1', index: 0 }, { role: 'number', box: { x: 0.272, y: 0.19, w: 0.2179, h: 0.1253 }, kind: 'text', style: { fontSize: 50, weight: '700', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: '2', group: 'c2', index: 1 }, { role: 'label', box: { x: 0.272, y: 0.3303, w: 0.2179, h: 0.094 }, kind: 'text', style: { fontSize: 20, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c2', index: 1, optional: true }, { role: 'body', box: { x: 0.272, y: 0.4393, w: 0.2179, h: 0.4073 }, kind: 'text', style: { fontSize: 16, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c2', index: 1 }, { role: 'number', box: { x: 0.51, y: 0.19, w: 0.2179, h: 0.1253 }, kind: 'text', style: { fontSize: 50, weight: '700', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: '3', group: 'c3', index: 2 }, { role: 'label', box: { x: 0.51, y: 0.3303, w: 0.2179, h: 0.094 }, kind: 'text', style: { fontSize: 20, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c3', index: 2, optional: true }, { role: 'body', box: { x: 0.51, y: 0.4393, w: 0.2179, h: 0.4073 }, kind: 'text', style: { fontSize: 16, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c3', index: 2 }, { role: 'number', box: { x: 0.7479, y: 0.19, w: 0.2179, h: 0.1253 }, kind: 'text', style: { fontSize: 50, weight: '700', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: '4', group: 'c4', index: 3 }, { role: 'label', box: { x: 0.7479, y: 0.3303, w: 0.2179, h: 0.094 }, kind: 'text', style: { fontSize: 20, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c4', index: 3, optional: true }, { role: 'body', box: { x: 0.7479, y: 0.4393, w: 0.2179, h: 0.4073 }, kind: 'text', style: { fontSize: 16, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c4', index: 3 }], repeat: { count: 4, across: 4, cell: ['number:0.2', 'label:0.15', 'body:0.65'] }, variants: { dark: 'steps-4-dark' } },
    { id: 'timeline', name: 'Timeline', structure: 'timeline', background: { tokenPath: 'color.semantic.surface', dark: false }, furniture: ['rule-timeline', 'footer', 'logo', 'page-number'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Title' }, { role: 'label', box: { x: 0.0341, y: 0.19, w: 0.1704, h: 0.1283 }, kind: 'text', style: { fontSize: 20, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c1', index: 0, optional: true }, { role: 'body', box: { x: 0.0341, y: 0.3333, w: 0.1704, h: 0.5133 }, kind: 'text', style: { fontSize: 16, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c1', index: 0 }, { role: 'label', box: { x: 0.2245, y: 0.19, w: 0.1704, h: 0.1283 }, kind: 'text', style: { fontSize: 20, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c2', index: 1, optional: true }, { role: 'body', box: { x: 0.2245, y: 0.3333, w: 0.1704, h: 0.5133 }, kind: 'text', style: { fontSize: 16, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c2', index: 1 }, { role: 'label', box: { x: 0.4148, y: 0.19, w: 0.1704, h: 0.1283 }, kind: 'text', style: { fontSize: 20, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c3', index: 2, optional: true }, { role: 'body', box: { x: 0.4148, y: 0.3333, w: 0.1704, h: 0.5133 }, kind: 'text', style: { fontSize: 16, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c3', index: 2 }, { role: 'label', box: { x: 0.6052, y: 0.19, w: 0.1704, h: 0.1283 }, kind: 'text', style: { fontSize: 20, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c4', index: 3, optional: true }, { role: 'body', box: { x: 0.6052, y: 0.3333, w: 0.1704, h: 0.5133 }, kind: 'text', style: { fontSize: 16, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c4', index: 3 }, { role: 'label', box: { x: 0.7955, y: 0.19, w: 0.1704, h: 0.1283 }, kind: 'text', style: { fontSize: 20, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c5', index: 4, optional: true }, { role: 'body', box: { x: 0.7955, y: 0.3333, w: 0.1704, h: 0.5133 }, kind: 'text', style: { fontSize: 16, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c5', index: 4 }], repeat: { count: 5, across: 5, cell: ['label:0.2', 'body:0.8'], rule: { x: 0.0341, y: 0.3238, w: 0.9318, h: 0.004 } }, variants: { dark: 'timeline-dark' } },
    { id: 'agenda-numbered', name: 'Numbered agenda', structure: 'agenda-numbered', background: { tokenPath: 'color.semantic.surface', dark: false }, furniture: ['footer', 'logo', 'page-number'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Title' }, { role: 'number', box: { x: 0.0341, y: 0.19, w: 0.0593, h: 0.1073 }, kind: 'text', style: { fontSize: 42, weight: '700', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: '1', group: 'c1', index: 0 }, { role: 'body', box: { x: 0.1134, y: 0.19, w: 0.8525, h: 0.1073 }, kind: 'text', style: { weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c1', index: 0 }, { role: 'number', box: { x: 0.0341, y: 0.3273, w: 0.0593, h: 0.1073 }, kind: 'text', style: { fontSize: 42, weight: '700', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: '2', group: 'c2', index: 1 }, { role: 'body', box: { x: 0.1134, y: 0.3273, w: 0.8525, h: 0.1073 }, kind: 'text', style: { weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c2', index: 1 }, { role: 'number', box: { x: 0.0341, y: 0.4646, w: 0.0593, h: 0.1073 }, kind: 'text', style: { fontSize: 42, weight: '700', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: '3', group: 'c3', index: 2 }, { role: 'body', box: { x: 0.1134, y: 0.4646, w: 0.8525, h: 0.1073 }, kind: 'text', style: { weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c3', index: 2 }, { role: 'number', box: { x: 0.0341, y: 0.602, w: 0.0593, h: 0.1073 }, kind: 'text', style: { fontSize: 42, weight: '700', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: '4', group: 'c4', index: 3 }, { role: 'body', box: { x: 0.1134, y: 0.602, w: 0.8525, h: 0.1073 }, kind: 'text', style: { weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c4', index: 3 }, { role: 'number', box: { x: 0.0341, y: 0.7393, w: 0.0593, h: 0.1073 }, kind: 'text', style: { fontSize: 42, weight: '700', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: '5', group: 'c5', index: 4 }, { role: 'body', box: { x: 0.1134, y: 0.7393, w: 0.8525, h: 0.1073 }, kind: 'text', style: { weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c5', index: 4 }], repeat: { count: 5, across: 1, cellCols: [1, 11], cell: ['body:1'], numberCol: [0, 1] }, variants: { dark: 'agenda-numbered-dark' } },
    { id: 'numbered-rows', name: 'Numbered list', structure: 'numbered-rows', background: { tokenPath: 'color.semantic.surface', dark: false }, furniture: ['footer', 'logo', 'page-number'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Title' }, { role: 'number', box: { x: 0.0341, y: 0.19, w: 0.0593, h: 0.1417 }, kind: 'text', style: { fontSize: 46, weight: '700', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: '1', group: 'c1', index: 0 }, { role: 'label', box: { x: 0.1134, y: 0.19, w: 0.8525, h: 0.0443 }, kind: 'text', style: { fontSize: 24, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c1', index: 0, optional: true }, { role: 'body', box: { x: 0.1134, y: 0.2493, w: 0.8525, h: 0.0823 }, kind: 'text', style: { weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c1', index: 0 }, { role: 'number', box: { x: 0.0341, y: 0.3617, w: 0.0593, h: 0.1417 }, kind: 'text', style: { fontSize: 46, weight: '700', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: '2', group: 'c2', index: 1 }, { role: 'label', box: { x: 0.1134, y: 0.3617, w: 0.8525, h: 0.0443 }, kind: 'text', style: { fontSize: 24, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c2', index: 1, optional: true }, { role: 'body', box: { x: 0.1134, y: 0.421, w: 0.8525, h: 0.0823 }, kind: 'text', style: { weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c2', index: 1 }, { role: 'number', box: { x: 0.0341, y: 0.5333, w: 0.0593, h: 0.1417 }, kind: 'text', style: { fontSize: 46, weight: '700', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: '3', group: 'c3', index: 2 }, { role: 'label', box: { x: 0.1134, y: 0.5333, w: 0.8525, h: 0.0443 }, kind: 'text', style: { fontSize: 24, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c3', index: 2, optional: true }, { role: 'body', box: { x: 0.1134, y: 0.5926, w: 0.8525, h: 0.0823 }, kind: 'text', style: { weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c3', index: 2 }, { role: 'number', box: { x: 0.0341, y: 0.705, w: 0.0593, h: 0.1417 }, kind: 'text', style: { fontSize: 46, weight: '700', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: '4', group: 'c4', index: 3 }, { role: 'label', box: { x: 0.1134, y: 0.705, w: 0.8525, h: 0.0443 }, kind: 'text', style: { fontSize: 24, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.text' }, prompt: 'Heading', group: 'c4', index: 3, optional: true }, { role: 'body', box: { x: 0.1134, y: 0.7643, w: 0.8525, h: 0.0823 }, kind: 'text', style: { weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.text' }, prompt: 'Text', group: 'c4', index: 3 }], repeat: { count: 4, across: 1, cellCols: [1, 11], cell: ['label:0.35', 'body:0.65'], numberCol: [0, 1] }, variants: { dark: 'numbered-rows-dark' } },
    { id: 'closing-thanks', name: 'Thank you', structure: 'closing-thanks', background: { tokenPath: 'color.semantic.text', dark: true }, furniture: ['logo-hero', 'page-number-right-on-dark'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.3, w: 0.7247, h: 0.25 }, kind: 'text', style: { fontSize: 59, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Title' }, { role: 'subtitle', box: { x: 0.0341, y: 0.58, w: 0.7247, h: 0.1 }, kind: 'text', style: { fontSize: 27, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Subtitle' }, { role: 'caption', box: { x: 0.0341, y: 0.72, w: 0.7247, h: 0.1 }, kind: 'text', style: { weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Caption' }] },
    { id: 'content-dark', name: 'Title and body, dark', structure: 'title-body', background: { tokenPath: 'color.semantic.text', dark: true }, furniture: ['footer-on-dark', 'logo', 'page-number-on-dark'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Title' }, { role: 'body', box: { x: 0.0341, y: 0.19, w: 0.9318, h: 0.6566 }, kind: 'text', style: { weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Add your points' }], variantOf: 'content' },
    { id: 'two-column-dark', name: 'Title and two columns, dark', structure: 'text-two-column', background: { tokenPath: 'color.semantic.text', dark: true }, furniture: ['footer-on-dark', 'logo', 'page-number-on-dark'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Title' }, { role: 'body', box: { x: 0.0538, y: 0.2598, w: 0.4211, h: 0.5974 }, kind: 'text', style: { fontSize: 20, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Left column' }, { role: 'body', box: { x: 0.5251, y: 0.2598, w: 0.4211, h: 0.5974 }, kind: 'text', style: { fontSize: 20, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Right column' }], variantOf: 'two-column' },
    { id: 'visual-dark', name: 'Title and visual, dark', structure: 'visual', background: { tokenPath: 'color.semantic.text', dark: true }, furniture: ['footer-on-dark', 'logo', 'page-number-on-dark'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Title' }, { role: 'visual', box: { x: 0.0341, y: 0.19, w: 0.9318, h: 0.6566 }, kind: 'image', fit: 'contain', prompt: 'Picture, chart or diagram' }], variantOf: 'visual' },
    { id: 'agenda-dark', name: 'Agenda, dark', structure: 'agenda', background: { tokenPath: 'color.semantic.text', dark: true }, furniture: ['footer-on-dark', 'logo', 'page-number-on-dark'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Agenda' }, { role: 'body', box: { x: 0.0341, y: 0.19, w: 0.9318, h: 0.6566 }, kind: 'text', style: { fontSize: 27, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'One line per section' }], variantOf: 'agenda' },
    { id: 'table-dark', name: 'Table, dark', structure: 'table', background: { tokenPath: 'color.semantic.text', dark: true }, furniture: ['footer-on-dark', 'logo', 'page-number-on-dark'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Title' }, { role: 'data', box: { x: 0.0341, y: 0.19, w: 0.9318, h: 0.6566 }, kind: 'table', style: { fontSize: 20, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Rows and columns' }], variantOf: 'table' },
    { id: 'title-only-dark', name: 'Title only, dark', structure: 'title-only', background: { tokenPath: 'color.semantic.text', dark: true }, furniture: ['footer-on-dark', 'logo', 'page-number-on-dark'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Title' }], variantOf: 'title-only' },
    { id: 'title-subtitle-body-dark', name: 'Title, subtitle and body, dark', structure: 'title-subtitle-body', background: { tokenPath: 'color.semantic.text', dark: true }, furniture: ['footer-on-dark', 'logo', 'page-number-on-dark'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Title' }, { role: 'subtitle', box: { x: 0.0341, y: 0.1455, w: 0.9318, h: 0.06 }, kind: 'text', style: { fontSize: 24, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Subtitle' }, { role: 'body', box: { x: 0.0341, y: 0.2355, w: 0.9318, h: 0.6111 }, kind: 'text', style: { weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text' }], variantOf: 'title-subtitle-body' },
    { id: 'comparison-dark', name: 'Comparison, dark', structure: 'comparison', background: { tokenPath: 'color.semantic.text', dark: true }, furniture: ['footer-on-dark', 'logo', 'page-number-on-dark'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Title' }, { role: 'label', box: { x: 0.0341, y: 0.19, w: 0.4559, h: 0.0844 }, kind: 'text', style: { fontSize: 24, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c1', index: 0, optional: true }, { role: 'body', box: { x: 0.0341, y: 0.3044, w: 0.4559, h: 0.5422 }, kind: 'text', style: { fontSize: 20, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c1', index: 0 }, { role: 'label', box: { x: 0.51, y: 0.19, w: 0.4559, h: 0.0844 }, kind: 'text', style: { fontSize: 24, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c2', index: 1, optional: true }, { role: 'body', box: { x: 0.51, y: 0.3044, w: 0.4559, h: 0.5422 }, kind: 'text', style: { fontSize: 20, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c2', index: 1 }], variantOf: 'comparison' },
    { id: 'columns-2-dark', name: 'Two boxes, dark', structure: 'columns-2', background: { tokenPath: 'color.semantic.text', dark: true }, furniture: ['footer-on-dark', 'logo', 'page-number-on-dark'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Title' }, { role: 'label', box: { x: 0.0341, y: 0.19, w: 0.4559, h: 0.1283 }, kind: 'text', style: { fontSize: 24, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c1', index: 0, optional: true }, { role: 'body', box: { x: 0.0341, y: 0.3333, w: 0.4559, h: 0.5133 }, kind: 'text', style: { fontSize: 20, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c1', index: 0 }, { role: 'label', box: { x: 0.51, y: 0.19, w: 0.4559, h: 0.1283 }, kind: 'text', style: { fontSize: 24, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c2', index: 1, optional: true }, { role: 'body', box: { x: 0.51, y: 0.3333, w: 0.4559, h: 0.5133 }, kind: 'text', style: { fontSize: 20, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c2', index: 1 }], repeat: { count: 2, across: 2, cell: ['label:0.2', 'body:0.8'] }, variantOf: 'columns-2' },
    { id: 'columns-3-dark', name: 'Three boxes, dark', structure: 'columns-3', background: { tokenPath: 'color.semantic.text', dark: true }, furniture: ['footer-on-dark', 'logo', 'page-number-on-dark'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Title' }, { role: 'label', box: { x: 0.0341, y: 0.19, w: 0.2973, h: 0.1283 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c1', index: 0, optional: true }, { role: 'body', box: { x: 0.0341, y: 0.3333, w: 0.2973, h: 0.5133 }, kind: 'text', style: { fontSize: 18, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c1', index: 0 }, { role: 'label', box: { x: 0.3514, y: 0.19, w: 0.2973, h: 0.1283 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c2', index: 1, optional: true }, { role: 'body', box: { x: 0.3514, y: 0.3333, w: 0.2973, h: 0.5133 }, kind: 'text', style: { fontSize: 18, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c2', index: 1 }, { role: 'label', box: { x: 0.6686, y: 0.19, w: 0.2973, h: 0.1283 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c3', index: 2, optional: true }, { role: 'body', box: { x: 0.6686, y: 0.3333, w: 0.2973, h: 0.5133 }, kind: 'text', style: { fontSize: 18, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c3', index: 2 }], repeat: { count: 3, across: 3, cell: ['label:0.2', 'body:0.8'] }, variantOf: 'columns-3' },
    { id: 'columns-4-dark', name: 'Four boxes, dark', structure: 'columns-4', background: { tokenPath: 'color.semantic.text', dark: true }, furniture: ['footer-on-dark', 'logo', 'page-number-on-dark'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Title' }, { role: 'label', box: { x: 0.0341, y: 0.19, w: 0.2179, h: 0.1283 }, kind: 'text', style: { fontSize: 20, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c1', index: 0, optional: true }, { role: 'body', box: { x: 0.0341, y: 0.3333, w: 0.2179, h: 0.5133 }, kind: 'text', style: { fontSize: 16, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c1', index: 0 }, { role: 'label', box: { x: 0.272, y: 0.19, w: 0.2179, h: 0.1283 }, kind: 'text', style: { fontSize: 20, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c2', index: 1, optional: true }, { role: 'body', box: { x: 0.272, y: 0.3333, w: 0.2179, h: 0.5133 }, kind: 'text', style: { fontSize: 16, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c2', index: 1 }, { role: 'label', box: { x: 0.51, y: 0.19, w: 0.2179, h: 0.1283 }, kind: 'text', style: { fontSize: 20, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c3', index: 2, optional: true }, { role: 'body', box: { x: 0.51, y: 0.3333, w: 0.2179, h: 0.5133 }, kind: 'text', style: { fontSize: 16, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c3', index: 2 }, { role: 'label', box: { x: 0.7479, y: 0.19, w: 0.2179, h: 0.1283 }, kind: 'text', style: { fontSize: 20, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c4', index: 3, optional: true }, { role: 'body', box: { x: 0.7479, y: 0.3333, w: 0.2179, h: 0.5133 }, kind: 'text', style: { fontSize: 16, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c4', index: 3 }], repeat: { count: 4, across: 4, cell: ['label:0.2', 'body:0.8'] }, variantOf: 'columns-4' },
    { id: 'icon-columns-3-dark', name: 'Three boxes with icons, dark', structure: 'icon-columns-3', background: { tokenPath: 'color.semantic.text', dark: true }, furniture: ['footer-on-dark', 'logo', 'page-number-on-dark'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Title' }, { role: 'visual', box: { x: 0.0341, y: 0.19, w: 0.2973, h: 0.1566 }, kind: 'image', fit: 'contain', prompt: 'Picture', group: 'c1', index: 0 }, { role: 'label', box: { x: 0.0341, y: 0.3616, w: 0.2973, h: 0.094 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c1', index: 0, optional: true }, { role: 'body', box: { x: 0.0341, y: 0.4706, w: 0.2973, h: 0.376 }, kind: 'text', style: { fontSize: 18, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c1', index: 0 }, { role: 'visual', box: { x: 0.3514, y: 0.19, w: 0.2973, h: 0.1566 }, kind: 'image', fit: 'contain', prompt: 'Picture', group: 'c2', index: 1 }, { role: 'label', box: { x: 0.3514, y: 0.3616, w: 0.2973, h: 0.094 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c2', index: 1, optional: true }, { role: 'body', box: { x: 0.3514, y: 0.4706, w: 0.2973, h: 0.376 }, kind: 'text', style: { fontSize: 18, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c2', index: 1 }, { role: 'visual', box: { x: 0.6686, y: 0.19, w: 0.2973, h: 0.1566 }, kind: 'image', fit: 'contain', prompt: 'Picture', group: 'c3', index: 2 }, { role: 'label', box: { x: 0.6686, y: 0.3616, w: 0.2973, h: 0.094 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c3', index: 2, optional: true }, { role: 'body', box: { x: 0.6686, y: 0.4706, w: 0.2973, h: 0.376 }, kind: 'text', style: { fontSize: 18, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c3', index: 2 }], repeat: { count: 3, across: 3, cell: ['visual:0.25', 'label:0.15', 'body:0.6'] }, variantOf: 'icon-columns-3' },
    { id: 'grid-2x2-dark', name: 'Four boxes in a grid, dark', structure: 'grid-2x2', background: { tokenPath: 'color.semantic.text', dark: true }, furniture: ['footer-on-dark', 'logo', 'page-number-on-dark'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Title' }, { role: 'label', box: { x: 0.0341, y: 0.19, w: 0.4559, h: 0.0746 }, kind: 'text', style: { fontSize: 24, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c1', index: 0, optional: true }, { role: 'body', box: { x: 0.0341, y: 0.2796, w: 0.4559, h: 0.2237 }, kind: 'text', style: { fontSize: 20, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c1', index: 0 }, { role: 'label', box: { x: 0.51, y: 0.19, w: 0.4559, h: 0.0746 }, kind: 'text', style: { fontSize: 24, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c2', index: 1, optional: true }, { role: 'body', box: { x: 0.51, y: 0.2796, w: 0.4559, h: 0.2237 }, kind: 'text', style: { fontSize: 20, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c2', index: 1 }, { role: 'label', box: { x: 0.0341, y: 0.5333, w: 0.4559, h: 0.0746 }, kind: 'text', style: { fontSize: 24, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c3', index: 2, optional: true }, { role: 'body', box: { x: 0.0341, y: 0.6229, w: 0.4559, h: 0.2237 }, kind: 'text', style: { fontSize: 20, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c3', index: 2 }, { role: 'label', box: { x: 0.51, y: 0.5333, w: 0.4559, h: 0.0746 }, kind: 'text', style: { fontSize: 24, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c4', index: 3, optional: true }, { role: 'body', box: { x: 0.51, y: 0.6229, w: 0.4559, h: 0.2237 }, kind: 'text', style: { fontSize: 20, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c4', index: 3 }], repeat: { count: 4, across: 2, cell: ['label:0.25', 'body:0.75'] }, variantOf: 'grid-2x2' },
    { id: 'grid-3x2-dark', name: 'Six boxes, dark', structure: 'grid-3x2', background: { tokenPath: 'color.semantic.text', dark: true }, furniture: ['footer-on-dark', 'logo', 'page-number-on-dark'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Title' }, { role: 'label', box: { x: 0.0341, y: 0.19, w: 0.2973, h: 0.0746 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c1', index: 0, optional: true }, { role: 'body', box: { x: 0.0341, y: 0.2796, w: 0.2973, h: 0.2237 }, kind: 'text', style: { fontSize: 18, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c1', index: 0 }, { role: 'label', box: { x: 0.3514, y: 0.19, w: 0.2973, h: 0.0746 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c2', index: 1, optional: true }, { role: 'body', box: { x: 0.3514, y: 0.2796, w: 0.2973, h: 0.2237 }, kind: 'text', style: { fontSize: 18, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c2', index: 1 }, { role: 'label', box: { x: 0.6686, y: 0.19, w: 0.2973, h: 0.0746 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c3', index: 2, optional: true }, { role: 'body', box: { x: 0.6686, y: 0.2796, w: 0.2973, h: 0.2237 }, kind: 'text', style: { fontSize: 18, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c3', index: 2 }, { role: 'label', box: { x: 0.0341, y: 0.5333, w: 0.2973, h: 0.0746 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c4', index: 3, optional: true }, { role: 'body', box: { x: 0.0341, y: 0.6229, w: 0.2973, h: 0.2237 }, kind: 'text', style: { fontSize: 18, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c4', index: 3 }, { role: 'label', box: { x: 0.3514, y: 0.5333, w: 0.2973, h: 0.0746 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c5', index: 4, optional: true }, { role: 'body', box: { x: 0.3514, y: 0.6229, w: 0.2973, h: 0.2237 }, kind: 'text', style: { fontSize: 18, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c5', index: 4 }, { role: 'label', box: { x: 0.6686, y: 0.5333, w: 0.2973, h: 0.0746 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c6', index: 5, optional: true }, { role: 'body', box: { x: 0.6686, y: 0.6229, w: 0.2973, h: 0.2237 }, kind: 'text', style: { fontSize: 18, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c6', index: 5 }], repeat: { count: 6, across: 3, cell: ['label:0.25', 'body:0.75'] }, variantOf: 'grid-3x2' },
    { id: 'cards-3-dark', name: 'Three cards, dark', structure: 'cards-3', background: { tokenPath: 'color.semantic.text', dark: true }, furniture: ['footer-on-dark', 'logo', 'page-number-on-dark'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Title' }, { role: 'visual', box: { x: 0.0341, y: 0.19, w: 0.2973, h: 0.282 }, kind: 'image', fit: 'cover', prompt: 'Picture', group: 'c1', index: 0 }, { role: 'label', box: { x: 0.0341, y: 0.487, w: 0.2973, h: 0.094 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c1', index: 0, optional: true }, { role: 'body', box: { x: 0.0341, y: 0.596, w: 0.2973, h: 0.2506 }, kind: 'text', style: { fontSize: 18, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c1', index: 0 }, { role: 'visual', box: { x: 0.3514, y: 0.19, w: 0.2973, h: 0.282 }, kind: 'image', fit: 'cover', prompt: 'Picture', group: 'c2', index: 1 }, { role: 'label', box: { x: 0.3514, y: 0.487, w: 0.2973, h: 0.094 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c2', index: 1, optional: true }, { role: 'body', box: { x: 0.3514, y: 0.596, w: 0.2973, h: 0.2506 }, kind: 'text', style: { fontSize: 18, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c2', index: 1 }, { role: 'visual', box: { x: 0.6686, y: 0.19, w: 0.2973, h: 0.282 }, kind: 'image', fit: 'cover', prompt: 'Picture', group: 'c3', index: 2 }, { role: 'label', box: { x: 0.6686, y: 0.487, w: 0.2973, h: 0.094 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c3', index: 2, optional: true }, { role: 'body', box: { x: 0.6686, y: 0.596, w: 0.2973, h: 0.2506 }, kind: 'text', style: { fontSize: 18, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c3', index: 2 }], repeat: { count: 3, across: 3, cell: ['visual:0.45', 'label:0.15', 'body:0.4'] }, variantOf: 'cards-3' },
    { id: 'image-caption-dark', name: 'Picture with caption, dark', structure: 'image-caption', background: { tokenPath: 'color.semantic.text', dark: true }, furniture: ['footer-on-dark', 'logo', 'page-number-on-dark'], placeholders: [{ role: 'visual', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.672 }, kind: 'image', fit: 'cover', prompt: 'Picture' }, { role: 'caption', box: { x: 0.0341, y: 0.7622, w: 0.9318, h: 0.0844 }, kind: 'text', style: { weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Caption' }], variantOf: 'image-caption' },
    { id: 'images-2-dark', name: 'Two pictures, dark', structure: 'images-2', background: { tokenPath: 'color.semantic.text', dark: true }, furniture: ['footer-on-dark', 'logo', 'page-number-on-dark'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Title' }, { role: 'visual', box: { x: 0.0341, y: 0.19, w: 0.4559, h: 0.5454 }, kind: 'image', fit: 'cover', prompt: 'Picture', group: 'c1', index: 0 }, { role: 'caption', box: { x: 0.0341, y: 0.7504, w: 0.4559, h: 0.0962 }, kind: 'text', style: { weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Caption', group: 'c1', index: 0, optional: true }, { role: 'visual', box: { x: 0.51, y: 0.19, w: 0.4559, h: 0.5454 }, kind: 'image', fit: 'cover', prompt: 'Picture', group: 'c2', index: 1 }, { role: 'caption', box: { x: 0.51, y: 0.7504, w: 0.4559, h: 0.0962 }, kind: 'text', style: { weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Caption', group: 'c2', index: 1, optional: true }], repeat: { count: 2, across: 2, cell: ['visual:0.85', 'caption:0.15'] }, variantOf: 'images-2' },
    { id: 'images-3-dark', name: 'Three pictures, dark', structure: 'images-3', background: { tokenPath: 'color.semantic.text', dark: true }, furniture: ['footer-on-dark', 'logo', 'page-number-on-dark'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Title' }, { role: 'visual', box: { x: 0.0341, y: 0.19, w: 0.2973, h: 0.5454 }, kind: 'image', fit: 'cover', prompt: 'Picture', group: 'c1', index: 0 }, { role: 'caption', box: { x: 0.0341, y: 0.7504, w: 0.2973, h: 0.0962 }, kind: 'text', style: { weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Caption', group: 'c1', index: 0, optional: true }, { role: 'visual', box: { x: 0.3514, y: 0.19, w: 0.2973, h: 0.5454 }, kind: 'image', fit: 'cover', prompt: 'Picture', group: 'c2', index: 1 }, { role: 'caption', box: { x: 0.3514, y: 0.7504, w: 0.2973, h: 0.0962 }, kind: 'text', style: { weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Caption', group: 'c2', index: 1, optional: true }, { role: 'visual', box: { x: 0.6686, y: 0.19, w: 0.2973, h: 0.5454 }, kind: 'image', fit: 'cover', prompt: 'Picture', group: 'c3', index: 2 }, { role: 'caption', box: { x: 0.6686, y: 0.7504, w: 0.2973, h: 0.0962 }, kind: 'text', style: { weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Caption', group: 'c3', index: 2, optional: true }], repeat: { count: 3, across: 3, cell: ['visual:0.85', 'caption:0.15'] }, variantOf: 'images-3' },
    { id: 'image-grid-2x2-dark', name: 'Four pictures, dark', structure: 'image-grid-2x2', background: { tokenPath: 'color.semantic.text', dark: true }, furniture: ['footer-on-dark', 'logo', 'page-number-on-dark'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Title' }, { role: 'visual', box: { x: 0.0341, y: 0.19, w: 0.4559, h: 0.3133 }, kind: 'image', fit: 'cover', prompt: 'Picture', group: 'c1', index: 0 }, { role: 'visual', box: { x: 0.51, y: 0.19, w: 0.4559, h: 0.3133 }, kind: 'image', fit: 'cover', prompt: 'Picture', group: 'c2', index: 1 }, { role: 'visual', box: { x: 0.0341, y: 0.5333, w: 0.4559, h: 0.3133 }, kind: 'image', fit: 'cover', prompt: 'Picture', group: 'c3', index: 2 }, { role: 'visual', box: { x: 0.51, y: 0.5333, w: 0.4559, h: 0.3133 }, kind: 'image', fit: 'cover', prompt: 'Picture', group: 'c4', index: 3 }], repeat: { count: 4, across: 2, cell: ['visual:1'] }, variantOf: 'image-grid-2x2' },
    { id: 'chart-dark', name: 'Title and chart, dark', structure: 'chart', background: { tokenPath: 'color.semantic.text', dark: true }, furniture: ['footer-on-dark', 'logo', 'page-number-on-dark'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Title' }, { role: 'data', box: { x: 0.0341, y: 0.19, w: 0.9318, h: 0.6566 }, kind: 'image', fit: 'contain', prompt: 'Chart' }], variantOf: 'chart' },
    { id: 'chart-and-callout-dark', name: 'Chart with takeaway, dark', structure: 'chart-and-callout', background: { tokenPath: 'color.semantic.text', dark: true }, furniture: ['footer-on-dark', 'logo', 'page-number-on-dark'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Title' }, { role: 'data', box: { x: 0.0341, y: 0.19, w: 0.6145, h: 0.6566 }, kind: 'image', fit: 'contain', prompt: 'Chart' }, { role: 'label', box: { x: 0.6686, y: 0.19, w: 0.2973, h: 0.0844 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'callout', index: 0, optional: true }, { role: 'body', box: { x: 0.6686, y: 0.3044, w: 0.2973, h: 0.5422 }, kind: 'text', style: { fontSize: 18, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'callout', index: 0 }], variantOf: 'chart-and-callout' },
    { id: 'stats-3-dark', name: 'Three numbers, dark', structure: 'stats-3', background: { tokenPath: 'color.semantic.text', dark: true }, furniture: ['footer-on-dark', 'logo', 'page-number-on-dark'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Title' }, { role: 'number', box: { x: 0.0341, y: 0.19, w: 0.2973, h: 0.3529 }, kind: 'text', style: { fontSize: 72, weight: '700', align: 'center', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'xx%', group: 'c1', index: 0 }, { role: 'label', box: { x: 0.0341, y: 0.5579, w: 0.2973, h: 0.2887 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'center', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c1', index: 0, optional: true }, { role: 'number', box: { x: 0.3514, y: 0.19, w: 0.2973, h: 0.3529 }, kind: 'text', style: { fontSize: 72, weight: '700', align: 'center', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'xx%', group: 'c2', index: 1 }, { role: 'label', box: { x: 0.3514, y: 0.5579, w: 0.2973, h: 0.2887 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'center', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c2', index: 1, optional: true }, { role: 'number', box: { x: 0.6686, y: 0.19, w: 0.2973, h: 0.3529 }, kind: 'text', style: { fontSize: 72, weight: '700', align: 'center', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'xx%', group: 'c3', index: 2 }, { role: 'label', box: { x: 0.6686, y: 0.5579, w: 0.2973, h: 0.2887 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'center', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c3', index: 2, optional: true }], repeat: { count: 3, across: 3, cell: ['number:0.55', 'label:0.45'] }, variantOf: 'stats-3' },
    { id: 'stats-4-dark', name: 'Four numbers, dark', structure: 'stats-4', background: { tokenPath: 'color.semantic.text', dark: true }, furniture: ['footer-on-dark', 'logo', 'page-number-on-dark'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Title' }, { role: 'number', box: { x: 0.0341, y: 0.19, w: 0.2179, h: 0.3529 }, kind: 'text', style: { fontSize: 72, weight: '700', align: 'center', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'xx%', group: 'c1', index: 0 }, { role: 'label', box: { x: 0.0341, y: 0.5579, w: 0.2179, h: 0.2887 }, kind: 'text', style: { fontSize: 20, weight: '700', align: 'center', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c1', index: 0, optional: true }, { role: 'number', box: { x: 0.272, y: 0.19, w: 0.2179, h: 0.3529 }, kind: 'text', style: { fontSize: 72, weight: '700', align: 'center', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'xx%', group: 'c2', index: 1 }, { role: 'label', box: { x: 0.272, y: 0.5579, w: 0.2179, h: 0.2887 }, kind: 'text', style: { fontSize: 20, weight: '700', align: 'center', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c2', index: 1, optional: true }, { role: 'number', box: { x: 0.51, y: 0.19, w: 0.2179, h: 0.3529 }, kind: 'text', style: { fontSize: 72, weight: '700', align: 'center', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'xx%', group: 'c3', index: 2 }, { role: 'label', box: { x: 0.51, y: 0.5579, w: 0.2179, h: 0.2887 }, kind: 'text', style: { fontSize: 20, weight: '700', align: 'center', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c3', index: 2, optional: true }, { role: 'number', box: { x: 0.7479, y: 0.19, w: 0.2179, h: 0.3529 }, kind: 'text', style: { fontSize: 72, weight: '700', align: 'center', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'xx%', group: 'c4', index: 3 }, { role: 'label', box: { x: 0.7479, y: 0.5579, w: 0.2179, h: 0.2887 }, kind: 'text', style: { fontSize: 20, weight: '700', align: 'center', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c4', index: 3, optional: true }], repeat: { count: 4, across: 4, cell: ['number:0.55', 'label:0.45'] }, variantOf: 'stats-4' },
    { id: 'steps-3-dark', name: 'Three steps, dark', structure: 'steps-3', background: { tokenPath: 'color.semantic.text', dark: true }, furniture: ['footer-on-dark', 'logo', 'page-number-on-dark'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Title' }, { role: 'number', box: { x: 0.0341, y: 0.19, w: 0.2973, h: 0.1253 }, kind: 'text', style: { fontSize: 50, weight: '700', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: '1', group: 'c1', index: 0 }, { role: 'label', box: { x: 0.0341, y: 0.3303, w: 0.2973, h: 0.094 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c1', index: 0, optional: true }, { role: 'body', box: { x: 0.0341, y: 0.4393, w: 0.2973, h: 0.4073 }, kind: 'text', style: { fontSize: 18, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c1', index: 0 }, { role: 'number', box: { x: 0.3514, y: 0.19, w: 0.2973, h: 0.1253 }, kind: 'text', style: { fontSize: 50, weight: '700', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: '2', group: 'c2', index: 1 }, { role: 'label', box: { x: 0.3514, y: 0.3303, w: 0.2973, h: 0.094 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c2', index: 1, optional: true }, { role: 'body', box: { x: 0.3514, y: 0.4393, w: 0.2973, h: 0.4073 }, kind: 'text', style: { fontSize: 18, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c2', index: 1 }, { role: 'number', box: { x: 0.6686, y: 0.19, w: 0.2973, h: 0.1253 }, kind: 'text', style: { fontSize: 50, weight: '700', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: '3', group: 'c3', index: 2 }, { role: 'label', box: { x: 0.6686, y: 0.3303, w: 0.2973, h: 0.094 }, kind: 'text', style: { fontSize: 22, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c3', index: 2, optional: true }, { role: 'body', box: { x: 0.6686, y: 0.4393, w: 0.2973, h: 0.4073 }, kind: 'text', style: { fontSize: 18, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c3', index: 2 }], repeat: { count: 3, across: 3, cell: ['number:0.2', 'label:0.15', 'body:0.65'] }, variantOf: 'steps-3' },
    { id: 'steps-4-dark', name: 'Four steps, dark', structure: 'steps-4', background: { tokenPath: 'color.semantic.text', dark: true }, furniture: ['footer-on-dark', 'logo', 'page-number-on-dark'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Title' }, { role: 'number', box: { x: 0.0341, y: 0.19, w: 0.2179, h: 0.1253 }, kind: 'text', style: { fontSize: 50, weight: '700', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: '1', group: 'c1', index: 0 }, { role: 'label', box: { x: 0.0341, y: 0.3303, w: 0.2179, h: 0.094 }, kind: 'text', style: { fontSize: 20, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c1', index: 0, optional: true }, { role: 'body', box: { x: 0.0341, y: 0.4393, w: 0.2179, h: 0.4073 }, kind: 'text', style: { fontSize: 16, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c1', index: 0 }, { role: 'number', box: { x: 0.272, y: 0.19, w: 0.2179, h: 0.1253 }, kind: 'text', style: { fontSize: 50, weight: '700', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: '2', group: 'c2', index: 1 }, { role: 'label', box: { x: 0.272, y: 0.3303, w: 0.2179, h: 0.094 }, kind: 'text', style: { fontSize: 20, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c2', index: 1, optional: true }, { role: 'body', box: { x: 0.272, y: 0.4393, w: 0.2179, h: 0.4073 }, kind: 'text', style: { fontSize: 16, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c2', index: 1 }, { role: 'number', box: { x: 0.51, y: 0.19, w: 0.2179, h: 0.1253 }, kind: 'text', style: { fontSize: 50, weight: '700', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: '3', group: 'c3', index: 2 }, { role: 'label', box: { x: 0.51, y: 0.3303, w: 0.2179, h: 0.094 }, kind: 'text', style: { fontSize: 20, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c3', index: 2, optional: true }, { role: 'body', box: { x: 0.51, y: 0.4393, w: 0.2179, h: 0.4073 }, kind: 'text', style: { fontSize: 16, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c3', index: 2 }, { role: 'number', box: { x: 0.7479, y: 0.19, w: 0.2179, h: 0.1253 }, kind: 'text', style: { fontSize: 50, weight: '700', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: '4', group: 'c4', index: 3 }, { role: 'label', box: { x: 0.7479, y: 0.3303, w: 0.2179, h: 0.094 }, kind: 'text', style: { fontSize: 20, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c4', index: 3, optional: true }, { role: 'body', box: { x: 0.7479, y: 0.4393, w: 0.2179, h: 0.4073 }, kind: 'text', style: { fontSize: 16, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c4', index: 3 }], repeat: { count: 4, across: 4, cell: ['number:0.2', 'label:0.15', 'body:0.65'] }, variantOf: 'steps-4' },
    { id: 'timeline-dark', name: 'Timeline, dark', structure: 'timeline', background: { tokenPath: 'color.semantic.text', dark: true }, furniture: ['rule-timeline', 'footer-on-dark', 'logo', 'page-number-on-dark'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Title' }, { role: 'label', box: { x: 0.0341, y: 0.19, w: 0.1704, h: 0.1283 }, kind: 'text', style: { fontSize: 20, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c1', index: 0, optional: true }, { role: 'body', box: { x: 0.0341, y: 0.3333, w: 0.1704, h: 0.5133 }, kind: 'text', style: { fontSize: 16, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c1', index: 0 }, { role: 'label', box: { x: 0.2245, y: 0.19, w: 0.1704, h: 0.1283 }, kind: 'text', style: { fontSize: 20, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c2', index: 1, optional: true }, { role: 'body', box: { x: 0.2245, y: 0.3333, w: 0.1704, h: 0.5133 }, kind: 'text', style: { fontSize: 16, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c2', index: 1 }, { role: 'label', box: { x: 0.4148, y: 0.19, w: 0.1704, h: 0.1283 }, kind: 'text', style: { fontSize: 20, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c3', index: 2, optional: true }, { role: 'body', box: { x: 0.4148, y: 0.3333, w: 0.1704, h: 0.5133 }, kind: 'text', style: { fontSize: 16, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c3', index: 2 }, { role: 'label', box: { x: 0.6052, y: 0.19, w: 0.1704, h: 0.1283 }, kind: 'text', style: { fontSize: 20, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c4', index: 3, optional: true }, { role: 'body', box: { x: 0.6052, y: 0.3333, w: 0.1704, h: 0.5133 }, kind: 'text', style: { fontSize: 16, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c4', index: 3 }, { role: 'label', box: { x: 0.7955, y: 0.19, w: 0.1704, h: 0.1283 }, kind: 'text', style: { fontSize: 20, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c5', index: 4, optional: true }, { role: 'body', box: { x: 0.7955, y: 0.3333, w: 0.1704, h: 0.5133 }, kind: 'text', style: { fontSize: 16, weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c5', index: 4 }], repeat: { count: 5, across: 5, cell: ['label:0.2', 'body:0.8'], rule: { x: 0.0341, y: 0.3238, w: 0.9318, h: 0.004 } }, variantOf: 'timeline' },
    { id: 'agenda-numbered-dark', name: 'Numbered agenda, dark', structure: 'agenda-numbered', background: { tokenPath: 'color.semantic.text', dark: true }, furniture: ['footer-on-dark', 'logo', 'page-number-on-dark'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Title' }, { role: 'number', box: { x: 0.0341, y: 0.19, w: 0.0593, h: 0.1073 }, kind: 'text', style: { fontSize: 42, weight: '700', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: '1', group: 'c1', index: 0 }, { role: 'body', box: { x: 0.1134, y: 0.19, w: 0.8525, h: 0.1073 }, kind: 'text', style: { weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c1', index: 0 }, { role: 'number', box: { x: 0.0341, y: 0.3273, w: 0.0593, h: 0.1073 }, kind: 'text', style: { fontSize: 42, weight: '700', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: '2', group: 'c2', index: 1 }, { role: 'body', box: { x: 0.1134, y: 0.3273, w: 0.8525, h: 0.1073 }, kind: 'text', style: { weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c2', index: 1 }, { role: 'number', box: { x: 0.0341, y: 0.4646, w: 0.0593, h: 0.1073 }, kind: 'text', style: { fontSize: 42, weight: '700', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: '3', group: 'c3', index: 2 }, { role: 'body', box: { x: 0.1134, y: 0.4646, w: 0.8525, h: 0.1073 }, kind: 'text', style: { weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c3', index: 2 }, { role: 'number', box: { x: 0.0341, y: 0.602, w: 0.0593, h: 0.1073 }, kind: 'text', style: { fontSize: 42, weight: '700', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: '4', group: 'c4', index: 3 }, { role: 'body', box: { x: 0.1134, y: 0.602, w: 0.8525, h: 0.1073 }, kind: 'text', style: { weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c4', index: 3 }, { role: 'number', box: { x: 0.0341, y: 0.7393, w: 0.0593, h: 0.1073 }, kind: 'text', style: { fontSize: 42, weight: '700', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: '5', group: 'c5', index: 4 }, { role: 'body', box: { x: 0.1134, y: 0.7393, w: 0.8525, h: 0.1073 }, kind: 'text', style: { weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c5', index: 4 }], repeat: { count: 5, across: 1, cellCols: [1, 11], cell: ['body:1'], numberCol: [0, 1] }, variantOf: 'agenda-numbered' },
    { id: 'numbered-rows-dark', name: 'Numbered list, dark', structure: 'numbered-rows', background: { tokenPath: 'color.semantic.text', dark: true }, furniture: ['footer-on-dark', 'logo', 'page-number-on-dark'], placeholders: [{ role: 'title', box: { x: 0.0341, y: 0.0342, w: 0.9318, h: 0.1113 }, kind: 'text', style: { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Title' }, { role: 'number', box: { x: 0.0341, y: 0.19, w: 0.0593, h: 0.1417 }, kind: 'text', style: { fontSize: 46, weight: '700', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: '1', group: 'c1', index: 0 }, { role: 'label', box: { x: 0.1134, y: 0.19, w: 0.8525, h: 0.0443 }, kind: 'text', style: { fontSize: 24, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c1', index: 0, optional: true }, { role: 'body', box: { x: 0.1134, y: 0.2493, w: 0.8525, h: 0.0823 }, kind: 'text', style: { weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c1', index: 0 }, { role: 'number', box: { x: 0.0341, y: 0.3617, w: 0.0593, h: 0.1417 }, kind: 'text', style: { fontSize: 46, weight: '700', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: '2', group: 'c2', index: 1 }, { role: 'label', box: { x: 0.1134, y: 0.3617, w: 0.8525, h: 0.0443 }, kind: 'text', style: { fontSize: 24, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c2', index: 1, optional: true }, { role: 'body', box: { x: 0.1134, y: 0.421, w: 0.8525, h: 0.0823 }, kind: 'text', style: { weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c2', index: 1 }, { role: 'number', box: { x: 0.0341, y: 0.5333, w: 0.0593, h: 0.1417 }, kind: 'text', style: { fontSize: 46, weight: '700', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: '3', group: 'c3', index: 2 }, { role: 'label', box: { x: 0.1134, y: 0.5333, w: 0.8525, h: 0.0443 }, kind: 'text', style: { fontSize: 24, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c3', index: 2, optional: true }, { role: 'body', box: { x: 0.1134, y: 0.5926, w: 0.8525, h: 0.0823 }, kind: 'text', style: { weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c3', index: 2 }, { role: 'number', box: { x: 0.0341, y: 0.705, w: 0.0593, h: 0.1417 }, kind: 'text', style: { fontSize: 46, weight: '700', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: '4', group: 'c4', index: 3 }, { role: 'label', box: { x: 0.1134, y: 0.705, w: 0.8525, h: 0.0443 }, kind: 'text', style: { fontSize: 24, weight: '700', align: 'left', valign: 'bottom', fgTokenPath: 'color.semantic.surface' }, prompt: 'Heading', group: 'c4', index: 3, optional: true }, { role: 'body', box: { x: 0.1134, y: 0.7643, w: 0.8525, h: 0.0823 }, kind: 'text', style: { weight: '400', align: 'left', valign: 'top', fgTokenPath: 'color.semantic.surface' }, prompt: 'Text', group: 'c4', index: 3 }], repeat: { count: 4, across: 1, cellCols: [1, 11], cell: ['label:0.35', 'body:0.65'], numberCol: [0, 1] }, variantOf: 'numbered-rows' },
  ],
  furniture: [
    { id: 'logo', kind: 'logo', box: { x: 0.024, y: 0.92, w: 0.0842, h: 0.044 }, variantByBackground: true },
    { id: 'logo-hero', kind: 'logo', box: { x: 0.053, y: 0.075, w: 0.1684, h: 0.088 }, variantByBackground: true },
    { id: 'logo-hero-centre', kind: 'logo', box: { x: 0.4158, y: 0.075, w: 0.1684, h: 0.088 }, variantByBackground: true },
    { id: 'page-number', kind: 'page-number', box: { x: 0.4232, y: 0.917, w: 0.06, h: 0.0516 }, style: { weight: '700', align: 'center', valign: 'middle', fgTokenPath: 'color.semantic.text' } },
    { id: 'page-number-right', kind: 'page-number', box: { x: 0.9208, y: 0.917, w: 0.06, h: 0.0516 }, style: { weight: '700', align: 'center', valign: 'middle', fgTokenPath: 'color.semantic.text' } },
    { id: 'page-number-right-on-dark', kind: 'page-number', box: { x: 0.9208, y: 0.917, w: 0.06, h: 0.0516 }, style: { weight: '700', align: 'center', valign: 'middle', fgTokenPath: 'color.semantic.surface' } },
    { id: 'footer', kind: 'footer', box: { x: 0.16, y: 0.9325, w: 0.25, h: 0.028 }, style: { align: 'left', valign: 'middle', fgTokenPath: 'color.semantic.muted' } },
    { id: 'footer-on-panel', kind: 'footer', box: { x: 0.12, y: 0.9325, w: 0.2, h: 0.028 }, style: { align: 'left', valign: 'middle', fgTokenPath: 'color.semantic.surface' } },
    { id: 'card-left', kind: 'rect', box: { x: 0.0358, y: 0.2279, w: 0.4571, h: 0.6591 }, tokenPath: 'color.ramp.neutral.8' },
    { id: 'card-right', kind: 'rect', box: { x: 0.5071, y: 0.2279, w: 0.4571, h: 0.6591 }, tokenPath: 'color.ramp.neutral.8' },
    { id: 'split-panel', kind: 'rect', box: { x: 0, y: 0, w: 0.3314, h: 1 }, tokenPath: 'color.semantic.text' },
    { id: 'caption-scrim', kind: 'rect', box: { x: 0, y: 0.8, w: 1, h: 0.2 }, hex: '#1d1d1db8' },
    { id: 'footer-on-dark', kind: 'footer', box: { x: 0.16, y: 0.9325, w: 0.25, h: 0.028 }, style: { align: 'left', valign: 'middle', fgTokenPath: 'color.semantic.surface' } },
    { id: 'page-number-on-dark', kind: 'page-number', box: { x: 0.4232, y: 0.917, w: 0.06, h: 0.0516 }, style: { weight: '700', align: 'center', valign: 'middle', fgTokenPath: 'color.semantic.surface' } },
    { id: 'mirror-split-panel', kind: 'rect', box: { x: 0.6686, y: 0, w: 0.3314, h: 1 }, tokenPath: 'color.semantic.text' },
    { id: 'mirror-footer-on-panel', kind: 'footer', box: { x: 0.68, y: 0.9325, w: 0.2, h: 0.028 }, style: { align: 'left', valign: 'middle', fgTokenPath: 'color.semantic.surface' } },
    { id: 'mirror-logo', kind: 'logo', box: { x: 0.8918, y: 0.92, w: 0.0842, h: 0.044 }, variantByBackground: true },
    { id: 'mirror-page-number-right', kind: 'page-number', box: { x: 0.0192, y: 0.917, w: 0.06, h: 0.0516 }, style: { weight: '700', align: 'center', valign: 'middle', fgTokenPath: 'color.semantic.text' } },
    { id: 'rule-timeline', kind: 'bar', box: { x: 0.0341, y: 0.3238, w: 0.9318, h: 0.004 }, tokenPath: 'color.semantic.muted' },
  ],
  typeScale: { title: 37, subtitle: 27, body: 24, caption: 20, number: 11, label: 11 },
  logo: { variantByBackground: true, assetTags: { onLight: ['logo', 'primary'], onDark: ['logo', 'on-dark'], mono: ['logo', 'mono'] } },
};
