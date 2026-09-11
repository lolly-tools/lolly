// SPDX-License-Identifier: MPL-2.0
/**
 * ownership.ts - which of this design system did a person choose? (plan 182 section 4.1)
 *
 * Every colour, face, mark and token in the studio is in one of a small set of
 * states, and until this module existed the studio painted them all the same.
 * The question it answers is one question: **is this piece of material the
 * person's own, or is it what shipped?**
 *
 * THE DEFINITION IS "EQUAL TO WHAT SHIPPED". A blank brand hands over a whole
 * palette and two font tokens on the first write, so from then on the installed
 * document holds material nobody chose. Reading the SHIPPED bytes back and
 * comparing them is what tells the two apart - no schema change, no flag on the
 * token, and nothing to migrate on a document that predates the idea. It is also
 * the only test that stays right on a real brand pack: SUSE's own doc declares
 * the same tokens and they ARE that person's design system there, so a pack
 * whose starter is itself reports everything as inherited, which is true.
 *
 * The comparison used to live twice - `starterSwatches`/`starterId` in
 * lib/brand-editor.ts and `starterColors()`/`starterCount` in
 * rooms/overview.ts - and the two counted different things. It lives here now,
 * once, and both read it.
 *
 * TWO VALUE SPACES, ONE COMPARISON. The Colours room holds swatches as
 * `walkSwatches` reports them: the key plus the `$value` AS STORED (an
 * `oklch()` literal, or an `{alias}`). The Overview holds them as
 * `host.tokens.colors()` resolves them: the same key plus a hex. Both are
 * legitimate, and a starter identity built in one space can never be matched in
 * the other - so `palette` lets a caller hand in BOTH halves in whichever space
 * it already reads, and the attribution itself (identity, the role filter, the
 * counts) happens once, here.
 *
 * ROLES ARE NOT SWATCHES. `color.semantic.*` is an alias that re-points; it
 * never creates material. It is excluded from `colors` and from the counts, so
 * one added colour can only ever be one tile and one increment (plan 182 C5).
 *
 * Pure and DOM-free, so it is unit-testable against the real shipped starter
 * document with no shell boot behind it. No i18n import: nothing here is a
 * string a person reads.
 */

import { walkSwatches, getExcludedSwatches } from '../brand-doc.ts';
import { familyFromTokenValue } from '../../user-fonts.ts';
import type { FontRole } from '../../user-fonts.ts';

// ── The shapes ───────────────────────────────────────────────────────────────

/** What a piece of material is. Two states, because a person either chose it or
 *  it came with the box; `candidate` (a tray chip, a compare card) is not in the
 *  design system at all, so it has no entry here. */
export type Ownership = 'inherited' | 'own';

/**
 * A face role's state. Wider than {@link Ownership}, because a type role can be
 * in two states a colour cannot:
 *
 *  - `follows` - the role's token is unset and the CSS var chain sends it to
 *    another role (brand-vars.ts FONT_SLOTS: `--font-display` and
 *    `--font-italic` both fall back to `var(--font-brand)`).
 *  - `unset` - the token is unset and the chain ends at the PLATFORM face, not
 *    at another role (`--font-brand` falls back to SUSE, `--font-mono` to SUSE
 *    Mono). Nobody chose it and it follows nothing.
 */
export type FaceOwnership = Ownership | 'follows' | 'unset';

export interface FaceState {
  /** What the role RESOLVES to right now - which is what the person sees,
   *  whether or not this role is what put it there. '' when nothing resolved. */
  family: string;
  state: FaceOwnership;
  /** Only on `follows`: the role this one defers to. */
  follows?: FontRole;
}

/** One colour, in whichever value space its caller reads. `key` is the dotted
 *  token key with the set prefix stripped (`color.ramp.primary.5`) - the same
 *  string `walkSwatches` reports as `key` and `createTokenSet` reports as
 *  `path`. */
export interface ColorRef {
  key: string;
  value: string;
}

/** The palette halves a caller supplies when it does not want the docs walked
 *  for it. BOTH must be in the SAME value space - see the module note. */
export interface PaletteSpace {
  /** The colours to attribute. */
  colors: readonly ColorRef[];
  /** The shipped starter's colours, spelled the same way. */
  starter: readonly ColorRef[];
}

export interface OwnershipCounts {
  /** Colours a person added or changed. The headline number. */
  ownColors: number;
  /** Colours still exactly as the starter shipped them. */
  starterColors: number;
  /** Faces a person installed and pointed a role at. */
  ownFaces: number;
  /** Logo slots with a mark in them. */
  logos: number;
}

export interface OwnershipReport {
  /** Swatch key → state. Semantic role leaves are NOT swatches and are absent.
   *  A key is unique within a document, so this is also the palette size - but
   *  `counts` is what a caller reading swatches from elsewhere should total,
   *  since a source that answers without a token path collapses into one entry. */
  colors: Map<string, Ownership>;
  faces: Record<FontRole, FaceState>;
  /** Slot variant key → whether a mark is in it. */
  logos: Record<string, 'own' | 'empty'>;
  radius: Ownership;
  counts: OwnershipCounts;
}

export interface OwnershipInput {
  /** The installed design system document (`host.tokens.raw()`). */
  doc: unknown;
  /** The shipped starter document, or null on a brand that ships none - which
   *  attributes nothing, exactly as every caller behaved before this module. */
  starterDoc: unknown | null;
  /** Which theme's roles the colour walk sees. Only matters when `palette` is
   *  absent (the walk is theme-scoped); defaults to light. */
  theme?: string;
  /** Colours already read, plus the starter's in the same spelling. Absent means
   *  "walk both documents for me" - see the module note. */
  palette?: PaletteSpace;
  /** Families installed on this device (`brandFontFamilies()` /
   *  `listUserFonts`). A role pointing at one of these is the person's own; a
   *  role pointing anywhere else is a face that came with a pack. */
  userFontFamilies?: readonly string[];
  /** What each role resolves to right now, for the `family` field. */
  resolvedFaces?: Partial<Record<FontRole, string>>;
  /** The logo slots and whether each holds a mark. */
  logoSlots?: ReadonlyArray<{ variant: string; filled: boolean }>;
}

// ── Colours ──────────────────────────────────────────────────────────────────

/**
 * Identity of one starter colour: its key AND its stored value, joined by a
 * separator neither can contain.
 *
 * Both halves are needed. A Replace-palette writes the person's own ramps over
 * the very same keys, so key alone would keep calling those the starter's
 * forever; and a SET of pairs lets the light and dark spelling of one role live
 * side by side without either shadowing the other.
 */
export const colorIdentity = (key: string, value: string): string => `${key}␟${value}`;

/** A `color.semantic.*` leaf - a ROLE, which re-points at a swatch and is never
 *  material of its own. The same test `walkSwatches` makes when it stamps
 *  `kind: 'semantic'`, spelled against the key so it also holds for a caller
 *  whose colours came from `createTokenSet` rather than the walker. */
export const isRoleKey = (key: string): boolean => /(^|\.)semantic(\.|$)/.test(key);

/**
 * A step of the NEUTRAL ramp - ink and paper (plan 182 section 12).
 *
 * The blank brand ships one ramp so surfaces and text can render at all, and
 * nobody chose it. While it is still inherited it is scaffolding rather than a
 * colour of the design system: the Colours pane leaves it out, the Overview
 * neither counts it nor draws it, and the Tokens room lists it as "Neutrals ·
 * starter" with the one Open that ever draws a starter tile. Regenerate it and
 * the same keys report `own`, at which point every surface treats it as colour
 * like any other - so the test is always ownership AND this key, never this key
 * alone.
 */
export const isNeutralRampKey = (key: string): boolean => /(^|\.)ramp\.neutral(\.|$)/.test(key);

/** Both theme spellings of a doc's roles, because either is equally a starter
 *  one and a document is only ever walked in one theme at a time. */
const BOTH_THEMES: readonly string[] = ['light', 'dark'];

/** Every colour leaf in `doc`, keyed and valued AS STORED (`walkSwatches`), with
 *  the "deleted" derived steps the palette hides filtered out so a report never
 *  counts a tile that is not on screen. */
export function docColorRefs(doc: unknown, theme = 'light'): ColorRef[] {
  const excluded = new Set(getExcludedSwatches(doc));
  return walkSwatches(doc, theme)
    .filter(s => !excluded.has(s.key))
    .map(s => ({ key: s.key, value: s.raw }));
}

/**
 * Every colour the SHIPPED starter document holds, as {@link colorIdentity}
 * pairs - the set the Colours room tests each of its swatches against.
 *
 * Walks both themes by default (see {@link BOTH_THEMES}). Empty for a brand that
 * ships no starter, which is what makes "attribute nothing" the honest default.
 */
export function starterColorIds(starterDoc: unknown, themes: readonly string[] = BOTH_THEMES): Set<string> {
  const out = new Set<string>();
  if (!starterDoc) return out;
  for (const theme of themes) {
    for (const s of walkSwatches(starterDoc, theme)) out.add(colorIdentity(s.key, s.raw));
  }
  return out;
}

/** The same set, over a starter a caller has already read in its own value
 *  space (the Overview's resolved swatches). */
function refIds(refs: readonly ColorRef[]): Set<string> {
  const out = new Set<string>();
  for (const r of refs) out.add(colorIdentity(r.key, r.value));
  return out;
}

// ── Faces ────────────────────────────────────────────────────────────────────

/** The roles the chrome reads, in the order the Type room shows them
 *  (brand-vars.ts FONT_SLOTS). */
export const FONT_ROLES: readonly FontRole[] = ['brand', 'display', 'mono', 'italic'];

/**
 * Where an UNSET role's `font-family` actually ends up, read off FONT_SLOTS:
 * `--font-display` and `--font-italic` are `var(--font-brand)`, so those two
 * FOLLOW the primary; `--font-brand` and `--font-mono` end at a platform face,
 * so those two are simply unset. Reporting all four as "follows Primary" would
 * be a comfortable lie about the code face.
 */
const FOLLOWS: Partial<Record<FontRole, FontRole>> = { display: 'brand', italic: 'brand' };

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * A doc's `<name>` group, found where the write paths put it: the document
 * itself for a plain DTCG tree, or - on a layered Tokens-Studio/Penpot doc,
 * whose top-level keys are SETS - whichever set carries it (`base` by
 * convention). The same search `user-fonts.ts` `fontGroupOf` makes, generalised
 * to the one other group the studio owns (`shape`), so the radius is read
 * exactly where `withRadiusToken` wrote it.
 */
function groupOf(doc: unknown, name: string): Rec | null {
  if (!isRec(doc)) return null;
  const layered = Array.isArray(doc.$themes) && doc.$themes.length > 0;
  const holder = layered
    ? (['base', ...Object.keys(doc).filter(k => !k.startsWith('$'))]
      .map(k => doc[k])
      .find(v => isRec(v) && name in v) as Rec | undefined)
    : doc;
  const g = holder?.[name];
  return isRec(g) ? g : null;
}

/** The family a doc's `font.<role>` token names, or '' when it holds none. */
export function fontRoleFamily(doc: unknown, role: FontRole): string {
  const group = groupOf(doc, 'font');
  const leaf = group?.[role];
  return isRec(leaf) ? familyFromTokenValue(leaf.$value) : '';
}

/** The `shape.radius` token's stored value, or '' when the doc carries none. */
export function radiusValue(doc: unknown): string {
  const leaf = groupOf(doc, 'shape')?.radius;
  const value = isRec(leaf) ? leaf.$value : undefined;
  return typeof value === 'string' ? value : '';
}

/**
 * One role's state.
 *
 * A set token is `own` when it names a face installed HERE and `inherited`
 * otherwise - which covers both the starter's own declaration (`font.brand:
 * "SUSE"`) and a pack's built-in face. Neither is something the person picked,
 * and a card that tints for one but not the other would be drawing a
 * distinction nobody can act on.
 */
function faceState(
  role: FontRole, doc: unknown, userFamilies: ReadonlySet<string>, resolved: string,
): FaceState {
  const declared = fontRoleFamily(doc, role);
  if (!declared) {
    const follows = FOLLOWS[role];
    return follows
      ? { family: resolved, state: 'follows', follows }
      : { family: resolved, state: 'unset' };
  }
  return {
    family: resolved || declared,
    state: userFamilies.has(declared.toLowerCase()) ? 'own' : 'inherited',
  };
}

// ── The report ───────────────────────────────────────────────────────────────

/**
 * What every room reads. One pass over the installed document against the
 * shipped one; nothing here writes, fetches or throws.
 */
export function reportOwnership(input: OwnershipInput): OwnershipReport {
  const { doc, starterDoc, theme = 'light' } = input;

  // Either the caller's own two halves, or both walked out of the documents.
  const palette = input.palette;
  const refs = palette ? palette.colors : docColorRefs(doc, theme);
  const starterIds = palette ? refIds(palette.starter) : starterColorIds(starterDoc);

  const colors = new Map<string, Ownership>();
  let ownColors = 0;
  let starterColors = 0;
  for (const ref of refs) {
    if (isRoleKey(ref.key)) continue;   // a role re-points; it is not a swatch
    const state: Ownership = starterIds.has(colorIdentity(ref.key, ref.value)) ? 'inherited' : 'own';
    colors.set(ref.key, state);
    if (state === 'own') ownColors++; else starterColors++;
  }

  const userFamilies = new Set((input.userFontFamilies ?? []).map(f => String(f).trim().toLowerCase()));
  const resolvedFaces = input.resolvedFaces ?? {};
  const faces = {} as Record<FontRole, FaceState>;
  let ownFaces = 0;
  for (const role of FONT_ROLES) {
    const state = faceState(role, doc, userFamilies, resolvedFaces[role] ?? '');
    faces[role] = state;
    if (state.state === 'own') ownFaces++;
  }

  const logos: Record<string, 'own' | 'empty'> = {};
  let filled = 0;
  for (const slot of input.logoSlots ?? []) {
    logos[slot.variant] = slot.filled ? 'own' : 'empty';
    if (slot.filled) filled++;
  }

  // Absent on both sides means nobody has moved it - inherited, like every other
  // token the starter decides by shipping (or by not shipping) a value.
  const radius: Ownership = radiusValue(doc) === radiusValue(starterDoc) ? 'inherited' : 'own';

  return {
    colors,
    faces,
    logos,
    radius,
    counts: { ownColors, starterColors, ownFaces, logos: filled },
  };
}
