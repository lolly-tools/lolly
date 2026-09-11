// SPDX-License-Identifier: MPL-2.0
/**
 * Collaborator colours, derived from the active design system (plans/100 section 4.4).
 *
 * A collab paints one colour per person - the focus ring on a sidebar row, the
 * cursor and focus region on the canvas overlay, the avatar in the collab pill.
 * Andy's ruling is that those colours come from the pack that is installed, not
 * from a hardcoded rainbow: "the brand flavours the presence". This module is
 * the whole of that derivation, and it is pure - palette in, ordered colours
 * out. No DOM, no host, no module-level state, so the same input yields the same
 * colours in the web shell, in a test, and (when a Track B server ever needs to
 * label a screenshot) anywhere else.
 *
 * THE THREE CONSTRAINTS, AND WHY THEY FIGHT EACH OTHER.
 *
 *   1. LEGIBLE IN BOTH THEMES AT ONCE. A person's colour must not change when
 *      they switch to dark mode - it is their identity for the session - so one
 *      colour has to clear a contrast floor against light chrome AND dark chrome.
 *      That is what pins the OKLCH lightness: a brand's own dark navy vanishes on
 *      the dark theme and its pastel vanishes on the light one, so the brand's
 *      LIGHTNESS cannot be honoured. Hue is what survives the projection, and
 *      hue is what a viewer actually reads as "that's Priya".
 *   2. TELLABLE APART. Two collaborators whose rings differ by 15° of hue are one
 *      collaborator to anybody not staring. ΔH ≥ 50° is the plan's number.
 *   3. NOT MISTAKEN FOR A STATE. The chrome already speaks in red/amber/green - 
 *      the collab pill's own connection dot goes green when live. A ring in those
 *      hues reads as a status, not a person, so their neighbourhoods are skipped.
 *
 * WHY THIS DEPARTS FROM `lib/audio-thumb-colour.ts`'s "never invent a hue the
 * brand does not own". That rule is right where LIGHTNESS is free to carry the
 * variety - a greyscale brand gets light and dark blobs and stays itself.
 * Here lightness is spent on constraint 1 before anything else is decided, so
 * hue is the only axis left, and a one-accent pack (lolly-start ships exactly
 * one, an indigo ramp at 260°) would otherwise seat six people in six copies of
 * the same colour. Given the choice between "off-brand" and "nobody can tell who
 * is who", presence needs the second one solved. The accent still anchors every
 * spun hue, so the set reads as a family around the brand rather than a preset.
 *
 * COLOUR IS NEVER THE ONLY DIFFERENTIATOR - that is what makes the trade
 * affordable. Rings and cursors carry a 1px theme-contrast halo (the
 * selection-handle convention) and a name chip, and the roster spells everyone
 * out; section 4.8 of the plan makes it an a11y requirement, not a nicety. This module
 * is one of three signals, so it may aim for "clearly a different person" rather
 * than "readable as 14px text".
 */

// Deep engine imports rather than the `@lolly/engine` barrel, matching the
// convention in this directory (see brand-vars.ts's note): the barrel's retained
// export set is the union over every importer, and a collab is lazy chrome that
// has no business dragging Handlebars or Ajv in behind it.
import { hexToOklch, oklchToHex, parseOklch } from '../../../../engine/src/brand-derive.ts';
import type { Oklch } from '../../../../engine/src/brand-derive.ts';
import { apcaContrast } from '../../../../engine/src/color-tools.ts';

// ── The band ─────────────────────────────────────────────────────────────────

/**
 * The fixed OKLCH lightness/chroma every collaborator colour is projected into.
 *
 * Chosen by sweep, not by taste. For a candidate at lightness L, the worst |Lc|
 * over all hues rises against dark chrome and falls against light chrome, so the
 * usable range is bounded at both ends; against the enumerated surfaces (see
 * CHROME_SURFACES) the two curves cross at L ≈ 0.686 (|Lc| 41.5 both ways), and
 * the band sits a hair above it at 0.69 - light 40.9, dark 42.1, still clear of
 * the floor at every hue and worth the half point because the two themes that are
 * measured-but-not-enforced (high contrast, brand) are both dark grounds and gain
 * what the light side gives up. Chroma 0.12 is as saturated as the band stays
 * legible; hues whose 0.12 is outside sRGB are gamut-mapped down by `oklchToHex`,
 * and it is the EMITTED hex that gets measured, so the floor holds for the colour
 * that renders.
 *
 * `h` is carried only because `Oklch` has the field; hue is the free axis and is
 * always passed separately. Nothing reads this 0.
 */
export const COLLAB_BAND: Readonly<Oklch> = { l: 0.69, c: 0.12, h: 0 };

/**
 * Minimum APCA |Lc| a collaborator colour must reach against every chrome
 * surface of BOTH themes.
 *
 * 40, and here is the reasoning rather than a number pulled from the air. APCA's
 * own published bands (`APCA_BANDS`) put 30 at "icons and borders only" and 45 at
 * "headlines" - a 2px focus ring and a 12px cursor arrow are squarely icon-and-
 * border furniture, so 30 is the honest floor for the shape. 40 is that floor
 * plus ten points of margin, and it is very nearly all the band can deliver for
 * every hue against every enumerated surface at once (40.9 measured, on light
 * chrome); demanding 45 would mean either abandoning the "same colour in both
 * themes" rule or squeezing chroma until the hues stop reading as distinct
 * colours. The margin lives in the floor, not above it: 30 is where these shapes
 * genuinely stop being legible, which is why the two themes measured but not
 * enforced (HIGH_CONTRAST_SURFACES, BRAND_THEME_SURFACES) land in the 30s and are
 * documented rather than chased.
 *
 * APCA rather than WCAG 2.1 on the house rule - APCA first for anything
 * perceptual, and this is exactly the mid-tone/dark-mode territory where WCAG 2
 * misjudges.
 */
export const COLLAB_APCA_FLOOR = 40;

/**
 * The chrome surfaces the floor is enforced against, per theme: EVERY surface
 * token in `styles/tokens.css` a presence affordance can land on, resolved to hex
 * - `--background`, `--card` (`--popover` is identical to it in both themes),
 * `--muted` (`--secondary` is identical to it) and `--accent`.
 *
 * `--accent` earns its place the hard way. It is the hover/active fill under a
 * sidebar row and a roster entry, which is exactly where a focus ring is read
 * most often, and it turns out to be the EXTREME at both ends: the darkest light
 * surface (#eaf0f6) and the lightest dark one (#1f2a3d) are both `--accent`, not
 * the `--muted` an eye would guess. Measured at the shipped band, worst hue on
 * the circle: |Lc| 40.9 on light (at 189°) and 42.1 on dark (at 346°).
 *
 * The whole set is listed rather than just those two, because WHICH surface is
 * the extreme is a property of the tokens and not a constant - and
 * `collab-colors.test.ts` derives all of them back out of `tokens.css` and
 * compares, so a token edit that moves a surface fails a test rather than
 * quietly shaving the margin off a cursor nobody can see. That guard is the
 * whole reason this constant is allowed to be a frozen copy.
 *
 * Deliberately NOT here: the tool canvas. A canvas is the user's artwork and can
 * be any colour at all - no palette can be guaranteed against it, which is
 * precisely why the plan pairs every ring and cursor with a contrast halo.
 */
export const CHROME_SURFACES = {
  light: ['#ffffff', '#fcfcfc', '#f1f5f9', '#eaf0f6'],
  dark: ['#030711', '#090e1a', '#18212f', '#1f2a3d'],
} as const;

export type CollabTheme = keyof typeof CHROME_SURFACES;

/**
 * The `highContrast` a11y preference's own surfaces - measured, NOT enforced.
 *
 * Its light block only ever lightens (`--card` 99% → 97% is still lighter than
 * `--muted`), so light chrome under the preference is covered by the enforced
 * band with room to spare. Its dark block lifts every surface - `--accent` goes
 * L 18% → 26%, #1f2a3d → #2c3d58 - and that costs about five points: the band
 * lands at |Lc| 37.2 at worst there, above APCA's 30 "icons and borders" mark
 * but under our 40.
 *
 * NOT ENFORCEABLE, rather than merely not enforced, and the sweep says so: over
 * the union of all four blocks the best any single band reaches is |Lc| 39.6 (at
 * L 0.705, C 0.09). No one lightness clears 40 against #eaf0f6 and #2c3d58 at
 * once, so something has to give, and it is not going to be "the same colour in
 * both themes" (constraint 1) or the halo that already carries the brand theme.
 * The band instead sits at the highest L that keeps every hue over the floor on
 * light chrome, which is also the L that leaves the dark themes the most it can.
 */
export const HIGH_CONTRAST_SURFACES = {
  light: ['#ffffff', '#f6f7f9', '#f1f5f9', '#eaf0f6'],
  dark: ['#030711', '#0c1322', '#0f1729', '#1d283a', '#222f44', '#2c3d58'],
} as const;

/**
 * The optional `brand` theme's chrome (SUSE's dark teal surfaces), measured but
 * NOT part of the enforced floor.
 *
 * It is a third theme, not one of the two the plan names, and it is a coloured
 * mid-dark ground that costs about nine points of Lc against the shipped band - 
 * the colours land at 32.3 at worst (on `--accent`, #1d534b), above APCA's 30
 * "icons and borders" mark but under our 40. Stated rather than hidden, and
 * pinned by a test so the claim cannot rot: the halo is what carries that theme.
 * (`html[data-a11y-contrast="high"][data-theme="brand"]` moves no surface at
 * all - it repairs inks, edges and the accent PAIR - so this is both brand
 * cases.)
 */
export const BRAND_THEME_SURFACES = ['#0c322c', '#14433c', '#1b4b44', '#1c4f48', '#1d534b'] as const;

/** Minimum hue separation between two concurrent collaborators (plan section 4.4). */
export const COLLAB_MIN_DELTA_H = 50;

/**
 * Hue centres the collaborator set steps around, in OKLCH degrees: error/danger
 * red (27°, the OKLCH hue of `--destructive` #dc2626), warning amber (70°,
 * #f59e0b) and success green (149°, #16a34a).
 *
 * These are the conventional state hues rather than tokens the shell declares - 
 * `tokens.css` names only `--destructive`, and the live/away dot, toast states
 * and validation copy reach for the other two by convention. Listing the
 * conventional centres is the honest version: it keeps a collaborator ring out
 * of the neighbourhood a viewer reads as "something is wrong here".
 */
export const SEMANTIC_HUES = [27, 70, 149] as const;

/**
 * Half-width of the skipped arc around each semantic hue, in degrees.
 *
 * 16° is the widest guard that still leaves room for six mutually 50°-separated
 * hues on the circle - three 32° exclusions plus six 50° gaps is 396° of demand
 * against 360°, so the gaps have to overlap the slack exactly, and they only
 * just do. Widening this is not free: it costs a collaborator.
 *
 * It also means a pack whose accent IS a state hue loses it. SUSE's jungle green
 * (157°) sits inside the success guard and is skipped, which looks harsh until
 * you remember the collab pill puts a green "live" dot two centimetres from the
 * avatar stack.
 */
export const SEMANTIC_GUARD_DEG = 16;

/**
 * Chroma below which a swatch has no usable hue. Near-greys carry a hue value
 * that is numerically real and perceptually meaningless - lolly-start's neutral
 * ramp is a faint 0.024 lean toward its indigo, and reading that as "the brand
 * owns 275°" would seat a collaborator on a colour nobody chose.
 */
export const HUE_CHROMA_FLOOR = 0.04;

/**
 * Where the spin starts when a pack offers no chromatic colour at all (a pure
 * greyscale design system). 260° is the platform's own indigo - lolly-start's
 * single accent - so the neutral fallback is the product's colour rather than an
 * arbitrary one.
 */
export const DEFAULT_ANCHOR_HUE = 260;

/**
 * How many colours a palette holds by default.
 *
 * Six is not a preference, it is the geometry: ΔH ≥ 50° caps the circle at seven
 * hues before any exclusions, and the three semantic guards take one of those
 * back. A collab with more than six people therefore reuses colours - see
 * `assignColor`, which says so out loud instead of quietly handing out
 * near-duplicates.
 */
export const COLLAB_COLOR_COUNT = 6;

// ── Types ────────────────────────────────────────────────────────────────────

/** One assignable collaborator colour. */
export interface CollabColor {
  /** The colour to paint - sRGB hex, gamut-mapped out of the band. */
  hex: string;
  /** Its OKLCH hue in degrees, kept so a caller can reason about separation. */
  hue: number;
  /** `palette` when the pack owned this hue; `spun` when it was generated. */
  source: 'palette' | 'spun';
  /** Worst-case |Lc| against each theme's chrome surfaces - the measured margin
   *  over {@link COLLAB_APCA_FLOOR}, not a promise. */
  lc: Record<CollabTheme, number>;
}

/**
 * A palette entry as the caller has it. A bare hex/`oklch()` string, or anything
 * with a `value` - which is the engine's `ColorSwatch` shape, so
 * `await host.tokens.colors()` can be passed straight through.
 */
export type CollabPaletteEntry = string | { readonly value?: unknown } | null | undefined;

export interface CollabPaletteOptions {
  /** The active pack's colour tokens, in pack order. */
  palette?: readonly CollabPaletteEntry[];
  /** The accent (`color.semantic.primary`). Anchors the spin and is tried first
   *  as a palette hue. Falls back to the first chromatic palette entry. */
  accent?: string | null;
  /** How many colours to produce. Defaults to {@link COLLAB_COLOR_COUNT}; the
   *  result may be SHORTER when the constraints cannot seat that many. */
  count?: number;
  /** Override the L/C band (tests, and a future theme with different chrome). */
  band?: Readonly<Oklch>;
  /** Override the enforced surfaces. */
  surfaces?: Readonly<Record<CollabTheme, readonly string[]>>;
  /** Override the APCA floor. */
  apcaFloor?: number;
  /** Override the minimum hue separation. */
  minDeltaH?: number;
  /** Override the skipped state hues. */
  semanticHues?: readonly number[];
  /** Override the guard half-width. */
  semanticGuard?: number;
}

// ── Hue arithmetic ───────────────────────────────────────────────────────────

const normHue = (h: number): number => ((h % 360) + 360) % 360;

/** Shortest circular distance between two hues, 0–180. */
export function hueGap(a: number, b: number): number {
  const d = Math.abs(normHue(a) - normHue(b)) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * A colour's OKLCH hue, or null when it has none worth reading - unparseable,
 * or flatter than {@link HUE_CHROMA_FLOOR}. Accepts the two forms brand tokens
 * are stored in (hex and `oklch()`/`lch()`), matching `color-tools.ts`.
 */
export function paletteHue(color: unknown, chromaFloor = HUE_CHROMA_FLOOR): number | null {
  if (typeof color !== 'string') return null;
  const s = color.trim();
  if (!s) return null;
  const c = s.startsWith('#') ? hexToOklch(s) : parseOklch(s);
  if (!c || !Number.isFinite(c.c) || c.c < chromaFloor) return null;
  return normHue(c.h);
}

const entryColor = (e: CollabPaletteEntry): string | null => {
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object' && typeof (e as { value?: unknown }).value === 'string') {
    return (e as { value: string }).value;
  }
  return null;
};

// ── Projection into the band ─────────────────────────────────────────────────

/**
 * A hue projected into the band, with the worst-case |Lc| it achieves against
 * each theme. Pure; exported because the guard it feeds is worth testing on its
 * own and because a caller rendering a legend may want the margins.
 */
export function bandColor(
  hue: number,
  band: Readonly<Oklch> = COLLAB_BAND,
  surfaces: Readonly<Record<CollabTheme, readonly string[]>> = CHROME_SURFACES,
): { hex: string; hue: number; lc: Record<CollabTheme, number> } {
  const h = normHue(hue);
  const hex = oklchToHex({ l: band.l, c: band.c, h });
  const lc = {} as Record<CollabTheme, number>;
  for (const theme of Object.keys(surfaces) as CollabTheme[]) {
    let worst = Infinity;
    for (const bg of surfaces[theme]) {
      const v = Math.abs(apcaContrast(hex, bg));
      // An unparseable surface must not silently pass the guard.
      worst = Math.min(worst, Number.isFinite(v) ? v : 0);
    }
    lc[theme] = worst === Infinity ? 0 : worst;
  }
  return { hex, hue: h, lc };
}

// ── The palette ──────────────────────────────────────────────────────────────

interface Ctx {
  band: Readonly<Oklch>;
  surfaces: Readonly<Record<CollabTheme, readonly string[]>>;
  floor: number;
  minDeltaH: number;
  guards: readonly number[];
  guardWidth: number;
  cache: Map<number, ReturnType<typeof bandColor>>;
}

const projected = (ctx: Ctx, hue: number) => {
  const key = Math.round(normHue(hue) * 10);
  let hit = ctx.cache.get(key);
  if (!hit) {
    hit = bandColor(hue, ctx.band, ctx.surfaces);
    ctx.cache.set(key, hit);
  }
  return hit;
};

/** Inside a skipped state-hue arc? */
const guarded = (ctx: Ctx, hue: number): boolean =>
  ctx.guards.some(g => hueGap(hue, g) < ctx.guardWidth);

/** Clears every theme's floor once projected into the band? */
const legible = (ctx: Ctx, hue: number): boolean => {
  const c = projected(ctx, hue);
  return (Object.keys(c.lc) as CollabTheme[]).every(t => c.lc[t] >= ctx.floor);
};

/** Far enough from every hue already seated? */
const separated = (ctx: Ctx, hue: number, taken: readonly number[]): boolean =>
  taken.every(t => hueGap(hue, t) >= ctx.minDeltaH);

const admissible = (ctx: Ctx, hue: number, taken: readonly number[]): boolean =>
  !guarded(ctx, hue) && separated(ctx, hue, taken) && legible(ctx, hue);

/**
 * Fill `hues` up to `count` by walking the circle from `anchor` in 1° steps and
 * taking the FIRST valid hue each time. Offsets are measured FROM the
 * anchor rather than from 0°, so the whole set is a family around the brand's
 * own colour; the anchor itself is offset 0, and is simply skipped by the
 * separation test when a pack hue already sits there.
 *
 * First-valid, deliberately, not farthest-from-everything. Maximin looks
 * like the better algorithm and seats fewer people: spreading each new hue into
 * the middle of the widest gap halves two gaps at once and strands both below
 * 50°, which measured out at five colours where tight forward packing gets six.
 * Packing forward from the anchor also keeps the result stable - an extra colour
 * appended later never moves the ones already handed out.
 */
function spinFill(ctx: Ctx, hues: number[], anchor: number, count: number): void {
  while (hues.length < count) {
    let found: number | null = null;
    for (let step = 0; step < 360; step++) {
      const h = normHue(anchor + step);
      if (admissible(ctx, h, hues)) { found = h; break; }
    }
    if (found === null) return;
    hues.push(found);
  }
}

/**
 * The ordered collaborator colours for a design system.
 *
 * The recipe, in the plan's order - pack hues first, spin to fill:
 *
 *  1. Read every palette entry's hue, drop the near-greys, and greedily keep the
 *     ones that clear the guards, the floor and the 50° separation. The accent
 *     goes first so a one-accent pack keeps its own colour as collaborator #1.
 *  2. Spin the rest from the accent at the same L/C.
 *  3. If that comes up short, DROP A PACK HUE AND TRY AGAIN. This is the step
 *     that is easy to miss and that a rich palette needs: three brand hues can
 *     be individually perfect and collectively ruinous. SUSE's pine (181°),
 *     persimmon (44°) and midnight (271°) leave gaps of 137°, 90° and 133° - 
 *     the 90° gap seats nobody, and the whole circle tops out at five. Give up
 *     midnight and six fit. So the loop tries the largest palette budget first
 *     and steps down, keeping as much of the brand as can still seat everyone.
 *
 * Deterministic and side-effect free: same inputs, same colours, in the same
 * order, on every client - which is the property the whole assignment scheme
 * rests on.
 */
export function collabPalette(opts: CollabPaletteOptions = {}): CollabColor[] {
  const count = Math.max(0, Math.floor(opts.count ?? COLLAB_COLOR_COUNT));
  if (count === 0) return [];

  const ctx: Ctx = {
    band: opts.band ?? COLLAB_BAND,
    surfaces: opts.surfaces ?? CHROME_SURFACES,
    floor: opts.apcaFloor ?? COLLAB_APCA_FLOOR,
    minDeltaH: opts.minDeltaH ?? COLLAB_MIN_DELTA_H,
    guards: opts.semanticHues ?? SEMANTIC_HUES,
    guardWidth: opts.semanticGuard ?? SEMANTIC_GUARD_DEG,
    cache: new Map(),
  };

  // 1. Candidate hues: the accent, then the pack in its own order.
  const accentHue = paletteHue(opts.accent ?? null);
  const candidates: number[] = [];
  if (accentHue !== null) candidates.push(accentHue);
  for (const entry of opts.palette ?? []) {
    const h = paletteHue(entryColor(entry));
    if (h !== null) candidates.push(h);
  }
  const anchor = accentHue ?? candidates[0] ?? DEFAULT_ANCHOR_HUE;

  const packHues: number[] = [];
  for (const h of candidates) {
    if (packHues.length >= count) break;
    if (admissible(ctx, h, packHues)) packHues.push(h);
  }

  // 2 + 3. Most pack hues first, stepping down until everyone fits.
  let best: number[] = [];
  let bestBudget = 0;
  for (let budget = packHues.length; budget >= 0; budget--) {
    const hues = packHues.slice(0, budget);
    spinFill(ctx, hues, anchor, count);
    if (hues.length > best.length) { best = hues; bestBudget = budget; }
    if (best.length >= count) break;
  }

  const fromPack = new Set(packHues.slice(0, bestBudget));
  return best.map(h => {
    const c = projected(ctx, h);
    return {
      hex: c.hex,
      hue: c.hue,
      // A spun hue can coincide with a pack hue the budget loop dropped; the
      // label answers "did the pack choose this", so membership is the test.
      source: fromPack.has(h) ? 'palette' : 'spun',
      lc: { ...c.lc },
    } satisfies CollabColor;
  });
}

// ── Assignment ───────────────────────────────────────────────────────────────

/**
 * The colour for a collaborator, keyed by join order - first-unused-wins.
 *
 * Start at `joinOrder mod n` and walk forward to the first colour nobody has
 * taken. Two properties fall out, and both are essential:
 *
 *  - **Same user, same colour, on every client.** Nothing here reads local
 *    state, a clock, or a random source. Every peer that agrees on the join
 *    order and the roster computes the same answer, so nobody sees Priya as
 *    teal while Priya sees herself as amber.
 *  - **A gap in the roster does not shuffle everyone.** Keying on join order
 *    rather than scanning from zero means the third person keeps their colour
 *    when the second one leaves - and, in the window where a late presence
 *    packet has not landed yet, two clients do not both hand out colour #1.
 *
 * `taken` is what the OTHER collaborators hold - the asker's own colour must not
 * be in it, or the walk steps over the very colour it is being asked to confirm.
 *
 * Past `n` collaborators the walk wraps and returns a duplicate: `taken` cannot
 * be satisfied and the honest answer is the preferred slot. Six is the circle's
 * capacity at ΔH ≥ 50° (see COLLAB_COLOR_COUNT) - the name chip, the halo and
 * the roster are what keep a seventh person distinguishable, which is why colour
 * is never allowed to be the only signal.
 *
 * Returns null only for an empty palette.
 */
export function assignColor(
  joinOrder: number,
  taken: Iterable<string> | null | undefined,
  colors: readonly CollabColor[],
): CollabColor | null {
  const n = colors.length;
  if (n === 0) return null;
  const order = Number.isFinite(joinOrder) ? Math.floor(joinOrder) : 0;
  const start = ((order % n) + n) % n;
  const used = new Set<string>();
  for (const hex of taken ?? []) {
    if (typeof hex === 'string') used.add(hex.toLowerCase());
  }
  for (let k = 0; k < n; k++) {
    const c = colors[(start + k) % n]!;
    if (!used.has(c.hex.toLowerCase())) return c;
  }
  return colors[start]!;
}
