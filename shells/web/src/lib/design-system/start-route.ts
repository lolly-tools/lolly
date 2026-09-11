// SPDX-License-Identifier: MPL-2.0
/**
 * start-route.ts - what a `#/start` link asks for, resolved once (plan 97 section 5).
 *
 * The studio is a set of independent rooms, so the only routing question is
 * "which room, and is anything asked to be open on arrival". Three read-only
 * flags come out of the query string; the view consumes them on mount and
 * never propagates them into a generated link (plans/43).
 *
 * Pure and DOM-free: the resolution table is the part worth testing, and it is
 * the part that carries the back-compatibility promise - `?tab=` was the step
 * param for the whole life of the stepped flow, and links to it exist in the
 * dashboard, in the docs and in whatever people bookmarked.
 */

/** The rooms, in sidebar order. `catalogue` stays the panel key the brand
 *  editor renders (a permanent contract); the sidebar labels it Files. */
export const START_ROOMS = ['overview', 'color', 'type', 'logos', 'tokens', 'catalogue'] as const;

export type StartRoom = (typeof START_ROOMS)[number];

/**
 * Every routable area: the rooms, plus the panels pinned to the rail's FOOT.
 *
 * The split is not cosmetic. A room is a peer in the sidebar list and one of the
 * brand editor's own panel keys; `versions` (plan 97 section 6a) is neither - it acts on
 * the whole design system rather than on one part of it, it hides itself until
 * there is something to publish, and it has no editor panel behind it. It is
 * still an AREA, because `#/start?area=versions` is a deep link the plan's own
 * table promises, and honouring it through this one resolution function is what
 * keeps that promise from becoming a second, divergent routing rule.
 */
export const START_AREAS = [...START_ROOMS, 'versions'] as const;

export type StartArea = (typeof START_AREAS)[number];

/** Where an arrival with nothing to say lands. */
export const DEFAULT_AREA: StartArea = 'overview';

// A Set, not an object lookup: an object would answer true for 'constructor'
// and every other inherited key, handing an attacker-shaped param a room name
// that is not a room.
const AREAS = new Set<string>(START_AREAS);

export function isStartArea(value: string | null | undefined): value is StartArea {
  return !!value && AREAS.has(value);
}

/**
 * What a link asks to be OPEN on arrival.
 *
 * Five of these are the colour room's wings (`chart` routes to the colour chart
 * card - the same target `?wheel` has always opened). The last two are the first
 * decisions rather than wings, minted by the Overview's empty-state doors (plan
 * 182 section 3a): `pick` opens the Colours room's colour picker on the add
 * row's chip, `stage` opens the Type room's face stage for the primary. Both
 * open a control the room already has; neither writes anything, so a link
 * somebody sends can only ever put a person in front of a decision, never make
 * one for them.
 */
export const START_FOCUS = ['generate', 'curves', 'contrast', 'print', 'chart', 'pick', 'stage'] as const;

export type StartFocus = (typeof START_FOCUS)[number];

const FOCUSES = new Set<string>(START_FOCUS);

/** The sources the picker can open on (plan 97 section 8). `pdf` and `url` are
 *  RECOGNISED but have no tile yet - they resolve, and the picker opens on its
 *  plain source list, so a link written today keeps working when M5/M6 give them
 *  one. An unknown value is not a source and opens nothing. */
export const START_SOURCES = ['file', 'image', 'font', 'pdf', 'url'] as const;

export type StartSource = (typeof START_SOURCES)[number];

const SOURCES = new Set<string>(START_SOURCES);

export interface StartRoute {
  /** Always one of START_AREAS. */
  area: string;
  /** `?wheel` - open the colour chart once the colour room is showing. */
  wheel: boolean;
  /** `?import` - open the source modal on arrival (`?import=0` means shut). */
  importOpen: boolean;
  /** `?focus=<what>` - open that wing of the colour room (plan 97 section 5), or
   *  the first-decision control the Overview's doors name (see START_FOCUS). */
  focus: StartFocus | null;
  /** `?source=<kind>` - which source the picker opens on. Naming one IMPLIES the
   *  picker opens (see `importOpen`); it never fetches or reads anything by
   *  itself, so the link is a signpost, not an action. */
  source: StartSource | null;
  /** `?seed=<hex>` - prime the Generate wing's primary with this colour before
   *  it opens. Minted by the added-chip's "Generate your palette from this
   *  colour" link (audit 167 F-A12); hex only, anything else is ignored. */
  seed: string | null;
  /**
   * `?group=<name>` - show one INHERITED colour group in the Colours pane,
   * folded and tagged Starter (plan 182 section 12). Minted by the Tokens room's
   * "Open" beside "Neutrals · starter", and the one thing that ever draws a
   * starter tile: the pane's ordinary state lists own colours only.
   *
   * A group HEADING, so the grammar is loose on purpose - letters, digits,
   * spaces and the separators a heading can carry - but bounded, and anything
   * outside it is ignored rather than passed on.
   */
  group: string | null;
}

/**
 * Resolve a `#/start` query (with or without its leading `?`).
 *
 * `?area=` is canonical and `?tab=` is its alias; an unrecognised value on
 * either falls through rather than dead-ending, so `?area=typo&tab=type` still
 * opens Type and anything unresolvable opens Overview.
 *
 * `?source=` implies `?import` - a link that names a source is asking for the
 * picker, and making people write both would be a trap. `?import=0` still wins
 * over it: that is the historic "leave it shut" form and links carry it.
 */
export function resolveStartRoute(query: string): StartRoute {
  const params = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
  const area = params.get('area');
  const tab = params.get('tab');
  const focus = params.get('focus');
  const source = params.get('source');
  const seed = params.get('seed');
  const group = (params.get('group') ?? '').trim();
  const resolvedSource = source && SOURCES.has(source) ? (source as StartSource) : null;
  return {
    area: isStartArea(area) ? area : isStartArea(tab) ? tab : DEFAULT_AREA,
    // Presence, not value: `?wheel` has never carried one, so `?wheel=0` has
    // always meant the same as `?wheel` and links in the wild rely on it.
    wheel: params.has('wheel'),
    importOpen: params.get('import') !== '0' && (params.has('import') || resolvedSource !== null),
    focus: focus && FOCUSES.has(focus) ? (focus as StartFocus) : null,
    source: resolvedSource,
    // Hex only - the chip link mints hex, and a colour that must be parsed is a
    // colour that can silently become a different colour. Unknown → null.
    seed: seed && /^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/.test(seed) ? seed : null,
    // Bounded and grammar-checked, like every other param here: a group heading
    // is words, digits and the few separators one can carry, up to 60 chars.
    group: /^[\p{L}\p{N} ._··-]{1,60}$/u.test(group) ? group : null,
  };
}
