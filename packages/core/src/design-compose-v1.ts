// SPDX-License-Identifier: MPL-2.0
/**
 * design-compose-v1: a deck spec an agent writes as archetypes and slot content, the
 * report composing it gives back, and the compact archetype catalogue the agent picks
 * from (plan 291, W6). Mirrored by `schemas/design-compose-v1.schema.json`, with a
 * byte-identical copy under `packages/core/schema/` for the SDK.
 *
 * The engine's `composeDesignSlides` lowers a spec to stored Design rows bound to a
 * slide master: each slide is the master archetype seeded at the spec's size (the
 * master scaled as the editor's New slide from layout scales it), its slots filled
 * with the given text or pictures, every slot left empty dropped and reported, page
 * numbers counted in presentation order, footers written, and the slide's notes set.
 * The rows keep their master bindings (`master`, `archetype`, `role`, `furniture`), so
 * a composed slide checks fairly against the house rules and exports to PowerPoint
 * with real placeholders. The look is the master's; a slide moves away from it only
 * by the overrides it states (`furniture.omit`, slot overrides, `under` and `over`
 * authoring rows).
 *
 * Slot keys: a role (`title`) for the first slot of that role, or `role#n` for the
 * n-th, counted from 1 across the archetype in the order the master declares them
 * (`body#2`). A repeat archetype's cells may also be filled through `cells`, one
 * record per cell keyed by role.
 *
 * Types and constants only: no runtime, no DOM, no I/O.
 */
import type { CheckFidelityEditV1 } from './check-v1.ts';

/** Report discriminator. */
export const DESIGN_COMPOSE_FORMAT = 'lolly-compose' as const;
/** Bumped only for a change an older reader would misread. */
export const DESIGN_COMPOSE_VERSION = 1 as const;

/** The page size a spec without `size` is composed at, in px. */
export const DESIGN_COMPOSE_DEFAULT_WIDTH = 1920 as const;
export const DESIGN_COMPOSE_DEFAULT_HEIGHT = 1080 as const;
/** The space between slides on the canvas, in px, when a spec does not set `gap`. Slides sit four to a row. */
export const DESIGN_COMPOSE_DEFAULT_GAP = 160 as const;
/** Slides one spec may hold. */
export const DESIGN_COMPOSE_MAX_SLIDES = 500 as const;

/** A slide's ground. `dark` takes the archetype's dark twin where the master has one. */
export const DESIGN_COMPOSE_GROUNDS = ['light', 'dark'] as const;
export type DesignComposeGroundV1 = (typeof DESIGN_COMPOSE_GROUNDS)[number];

/**
 * Where the master came from: an explicit masters file (`--master`), the design
 * system's own catalog, or the engine's neutral master when neither had one.
 */
export const DESIGN_COMPOSE_MASTER_ORIGINS = ['flag', 'catalog', 'neutral'] as const;
export type DesignComposeMasterOriginV1 = (typeof DESIGN_COMPOSE_MASTER_ORIGINS)[number];

/** Which logo mark a slide takes: the one its ground asks for, the mono mark, or none. */
export const DESIGN_COMPOSE_LOGO_MODES = ['auto', 'mono', 'none'] as const;
export type DesignComposeLogoModeV1 = (typeof DESIGN_COMPOSE_LOGO_MODES)[number];

/**
 * How a source's bold reads in a display slot (title, subtitle, quote, number), plan
 * 291 E15. `accent`: in the brand's accent ink at the slot's own weight, the ink the
 * brief allows as text on the slot's ground. `bold`: as bold. `keep`: as bold, with the
 * source's own run colours. Left out, `accent` when a text-weight house rule on the slot
 * does not allow 700, else `bold`. Other slots carry bold as bold.
 */
export const DESIGN_COMPOSE_EMPHASIS_MODES = ['accent', 'bold', 'keep'] as const;
export type DesignComposeEmphasisV1 = (typeof DESIGN_COMPOSE_EMPHASIS_MODES)[number];

/**
 * Letter case for slot text. `sentence`: every Title Case word is lowered except the
 * first word of the text, of a line and of a sentence; words in capitals or with a
 * capital inside (AI, SUSE, iPhone) are kept. It lowers a proper noun in Title Case too
 * (Europe), so it is asked for, never the default. `keep`: as written, which a slide or
 * slot uses to opt out of the spec's `sentence`.
 */
export const DESIGN_COMPOSE_CASES = ['sentence', 'keep'] as const;
export type DesignComposeCaseV1 = (typeof DESIGN_COMPOSE_CASES)[number];

/**
 * The slide transitions a spec may set: the options of Design's `transition` input
 * (community/design/tool.json). Any other value is refused, because the tool would
 * swap it for its default without a word.
 */
export const DESIGN_COMPOSE_TRANSITIONS = ['slide', 'fade', 'morph', 'flight'] as const;
export type DesignComposeTransitionV1 = (typeof DESIGN_COMPOSE_TRANSITIONS)[number];

/** What a slot holds. Design has no table primitive, so a `table` slot is a text layer. */
export const DESIGN_COMPOSE_SLOT_KINDS = ['text', 'image', 'table'] as const;
export type DesignComposeSlotKindV1 = (typeof DESIGN_COMPOSE_SLOT_KINDS)[number];

/**
 * Row fields a slot override may not set: the master binding, the canvas wiring and
 * the paint depth belong to compose.
 */
export const DESIGN_COMPOSE_RESERVED_FIELDS = ['id', 'kind', 'frame', 'master', 'archetype', 'role', 'furniture', 'order', 'z', 'group'] as const;
export type DesignComposeReservedFieldV1 = (typeof DESIGN_COMPOSE_RESERVED_FIELDS)[number];

/**
 * Codes of the notes a report carries.
 *
 * - `compose.dark.none`: a dark ground was asked for an archetype with no dark twin, and the design system's Dark theme does not give it a dark ground either; the slide keeps the archetype's own ground.
 * - `compose.dark.themed`: a dark ground was asked for a light archetype with no dark twin; the slide is drawn from the master under the design system's Dark theme.
 * - `compose.ground.ignored`: a slide asked for `ground: "light"` on an archetype that is dark by design with no light version; it keeps its dark ground.
 * - `compose.emphasis.accent`: a source's bold in a display slot was set in the brand's accent ink (E15); the change is in `edits` too.
 * - `compose.emphasis.no-accent`: accent emphasis was wanted and no ink the brand allows on that ground differs from the slot's own, so bold stayed bold.
 * - `compose.case.sentence`: slot text was set in sentence case; each changed line is in `edits` with its result.
 * - `compose.footer.empty`: footer furniture with no footer text was left out (an empty text layer warns in check).
 * - `compose.logo.unresolved`: logo furniture whose mark did not resolve was left out.
 * - `compose.logo.photo-contrast`: over a photograph, no logo mark the brand allows there reaches 3:1 against the picture under the logo, so the logo was left off (measured by a host that has the picture's bytes).
 * - `compose.text.photo-contrast`: over a photograph, a text slot's ink falls short of 3:1 (title, subtitle, quote, number) or 4.5:1 against the median light of the picture under it; the slot keeps its ink (measured by a host that has the picture's bytes).
 * - `compose.furniture.unknown`: a `furniture.omit` entry matches no furniture the slide shows.
 * - `compose.notes.none`: notes were asked from the inventory slide, which has none.
 * - `compose.edits.partial`: the edits list could not be worked out in full (the fidelity comparison stopped at a cap).
 *
 * Notes a host adds (node-shell, for `lolly compose` and `lolly_compose`):
 *
 * - `compose.master.neutral`: no master file and no catalog master of the design system in use, so the neutral master was used.
 * - `compose.master.no-logos`: the master file's logos do not resolve in the design system, so logo furniture is left off.
 * - `compose.fit.overflow`: a composed text slot still runs past its box after fitting.
 * - `compose.fit.unmeasured`: a composed text slot could not be measured (a face that is not here).
 * - `compose.asset.needed`: a picture placeholder nothing here supplies; `lolly package --asset=KEY=PATH` supplies the file.
 * - `compose.logo.photo-unmeasured`: a slide's photograph could not be measured as the canvas draws it (a token that does not resolve, a radial or conic gradient, a picture with a photo look), so the on-photo mark was kept without a contrast check.
 *
 * Notes from lowering `under` and `over` rows keep the authoring codes (`authoring.*`).
 */
export const DESIGN_COMPOSE_NOTE_CODES = [
  'compose.dark.none',
  'compose.dark.themed',
  'compose.ground.ignored',
  'compose.emphasis.accent',
  'compose.emphasis.no-accent',
  'compose.case.sentence',
  'compose.footer.empty',
  'compose.logo.unresolved',
  'compose.logo.photo-contrast',
  'compose.text.photo-contrast',
  'compose.furniture.unknown',
  'compose.notes.none',
  'compose.edits.partial',
  'compose.master.neutral',
  'compose.master.no-logos',
  'compose.fit.overflow',
  'compose.fit.unmeasured',
  'compose.asset.needed',
  'compose.logo.photo-unmeasured',
] as const;
export type DesignComposeNoteCodeV1 = (typeof DESIGN_COMPOSE_NOTE_CODES)[number];

/**
 * What a slot is filled with.
 *
 * - A string: Design text markup for a text or table slot; for an image slot a catalog
 *   id, an upload ref `user/media/<sha256>`, or a placeholder key (`photo:cover`) that
 *   `lolly package --asset=KEY=PATH` resolves.
 * - `null` or `''`: leave the slot out (it is dropped and reported).
 * - An object: `text` or `image` as above, or `from`, the id of an inventory object
 *   whose words (or picture) the slot copies, with `para`, the 0-based paragraph of
 *   that text to copy alone, or `join`, the text to put between its lines when they are
 *   run into one (every paragraph and line break; `": "` turns an eyebrow line and a
 *   heading into one heading). `from` may also list several text objects, whose
 *   paragraphs are taken in that order, so an eyebrow set as its own object joins the
 *   heading (`{"from": ["eyebrow", "heading"], "join": ": "}`); `para` then does not apply.
 *   `para` may list several paragraphs (`[1, 2]`), taken in that order, so one text
 *   object set at two sizes fills a title and a subtitle; with `join` too, the picked
 *   paragraphs' lines run into one (a subtitle broken by hand over more lines than its
 *   slot holds). A table slot (`data`) takes
 *   `{"$table": {...}}` instead: a `$table` authoring macro whose `x` and `y` are
 *   relative to the slot's box, its rows set out there in place of the slot's text. `case` and `emphasis` set the slot's own, over the
 *   slide's and the spec's. Every other key is a Design row field written over the
 *   seeded slot (`x` and `y` relative to the slide's top-left, `w`, `h`, `fg`,
 *   `fontSize`, `fit`, ...), and `$style` gives a text style id (or an inline style)
 *   whose fields go under the explicit ones. The master binding fields
 *   (`DESIGN_COMPOSE_RESERVED_FIELDS`) may not be set.
 */
export type ComposeSlotValueV1 =
  | string
  | null
  | { text?: string; image?: string; from?: string | string[]; para?: number | number[]; $table?: Record<string, unknown>; join?: string; case?: DesignComposeCaseV1; emphasis?: DesignComposeEmphasisV1; [override: string]: unknown };

export interface ComposeFurnitureV1 {
  /**
   * Furniture to leave off this slide: master furniture ids (`caption-scrim`,
   * `logo-hero`) or furniture kinds (`logo`, `page-number`, `footer`, `bar`, `rect`),
   * which take every piece of that kind.
   */
  omit?: string[];
  /** The footer text on this slide, over the spec's own `footer`. */
  footer?: string;
  /**
   * `auto` (default) takes the mark the ground asks for, or the on-photo mark over an
   * `under` picture covering 90% of the slide; `mono` the mono mark; `none` no logo.
   */
  logo?: DesignComposeLogoModeV1;
}

export interface ComposeSlideV1 {
  /** Any archetype id of the master, a `-dark` twin, or a content-sized `flow-cards-N-C` / `flow-columns-N-C` layout. */
  archetype: string;
  /** The artboard id. Defaults to `s01`, `s02`, ... by position; child ids are `<id>.<slot or furniture>`. */
  id?: string;
  /** The artboard name. Defaults to the archetype's name. */
  name?: string;
  /** Over the spec's `theme`. */
  ground?: DesignComposeGroundV1;
  /**
   * The 1-based inventory slide this slide recreates: `from` looks there first, its
   * notes are carried, and its strings decide the edits list.
   */
  source?: number;
  /** Slot content by slot key (`title`, `body#2`). */
  slots?: Record<string, ComposeSlotValueV1>;
  /** A repeat archetype's cells, in reading order, each keyed by role (`label`, `body`). */
  cells?: Array<Record<string, ComposeSlotValueV1>>;
  /**
   * Speaker notes: a string, `true` for the `source` slide's notes, `null` for none.
   * Left out, a slide with a `source` carries that slide's notes.
   */
  notes?: string | true | null;
  furniture?: ComposeFurnitureV1;
  /**
   * Design authoring rows (design-authoring-v1) painted before the archetype's layers,
   * with `$in` set to this slide, so `x` and `y` are slide-local: a full-bleed photo
   * under a title, a panel.
   */
  under?: unknown[];
  /** Design authoring rows painted after the archetype's layers, slide-local like `under`. */
  over?: unknown[];
  /** What the slide is for, in the agent's words. Read by nothing but the agent. */
  intent?: string;
  /** Over the spec's `emphasis`. */
  emphasis?: DesignComposeEmphasisV1;
  /** Over the spec's `case`. */
  case?: DesignComposeCaseV1;
}

export interface DesignComposeSpecV1 {
  /** The page size in px. Default 1920x1080. */
  size?: { width: number; height: number };
  /** Every slide's ground unless the slide states its own. Default `light`. */
  theme?: DesignComposeGroundV1;
  /**
   * The token themes the document is composed for (plan 291 W4), such as
   * `["light", "dark"]`. With more than one, logo furniture is written as
   * `<id>?theme=auto`, so each theme shows the mark the surface under the logo asks for.
   */
  themes?: string[];
  slides: ComposeSlideV1[];
  /** Named text styles over the brief's, for `$style` in slots and authoring rows. */
  $styles?: Record<string, unknown>;
  /** Footer text for every slide that shows a footer. */
  footer?: string;
  /** Fill page-number furniture with the slide's place in the deck (default true); false leaves it off. */
  pageNumbers?: boolean;
  /** The document's slide transition (Design's `transition` input): one of `DESIGN_COMPOSE_TRANSITIONS`. */
  transition?: DesignComposeTransitionV1;
  /** Space between slides on the canvas, in px, from 0 to 100000. Default 160. */
  gap?: number;
  /**
   * The deck's furniture defaults, which each slide's own `furniture` merges over: the
   * `omit` lists add up, and a slide's `footer` and `logo` win. `logo: "auto"` on a slide
   * with an `under` picture covering 90% of it or more takes the on-photo mark (the mono
   * mark for dark grounds, else the on-dark mark).
   */
  furniture?: ComposeFurnitureV1;
  /** How a source's bold reads in display slots (E15); a slide's or slot's own wins. */
  emphasis?: DesignComposeEmphasisV1;
  /** Letter case for slot text; a slide's or slot's own wins. Never the default. */
  case?: DesignComposeCaseV1;
}

/** One composed text layer's measured fit, added by a host that measures (node-shell). */
export interface ComposeFitV1 {
  layerId: string;
  lines: number;
  overflow: boolean;
  /** The size the layer ends at, when fitting changed the size. */
  fontSize?: number;
  /** True when fitting stepped the size down. */
  shrunk?: boolean;
}

export interface ComposeReportSlideV1 {
  /** 0-based place in the deck. */
  index: number;
  /** The artboard id. */
  id: string;
  /** The archetype the slide was seeded from (the dark twin when one was taken). */
  archetype: string;
  /** The archetype the spec asked for. */
  requested: string;
  ground: DesignComposeGroundV1;
  /** Slot keys filled. */
  filled: string[];
  /** Slot keys left empty and dropped. */
  dropped: string[];
  /** Furniture ids drawn on the slide. */
  furniture: string[];
  /** True when the artboard carries speaker notes. */
  notes: boolean;
  fit?: ComposeFitV1[];
}

export interface ComposeReportNoteV1 {
  /** A JSON pointer into the spec. */
  path: string;
  /** One of `DESIGN_COMPOSE_NOTE_CODES`, or an `authoring.*` code from lowering `under` and `over`. */
  code: string;
  message: string;
}

export interface ComposeReportV1 {
  format: typeof DESIGN_COMPOSE_FORMAT;
  version: typeof DESIGN_COMPOSE_VERSION;
  master: { id: string; version: string; origin: DesignComposeMasterOriginV1 };
  size: { width: number; height: number };
  slides: ComposeReportSlideV1[];
  notes: ComposeReportNoteV1[];
}

/** A source string the composed slides change or leave out, in the shape `lolly check --edits` reads. */
export type ComposeEditV1 = CheckFidelityEditV1;

/** One slot of a catalogue archetype. */
export interface ComposeArchetypeSlotV1 {
  /** The slot key a spec fills (`title`, `body#2`). */
  key: string;
  role: string;
  kind: DesignComposeSlotKindV1;
  /** The master marks it optional (a cell label, a caption). */
  optional: boolean;
  /** Slide-local px at the master's size. */
  box: { x: number; y: number; w: number; h: number };
}

/** One light archetype of the catalogue `lolly compose --list` prints. */
export interface ComposeArchetypeV1 {
  id: string;
  name: string;
  /** The dark twin a dark ground takes. */
  dark?: string;
  ground: DesignComposeGroundV1;
  slots: ComposeArchetypeSlotV1[];
  /** Cells of a repeat archetype, for `cells`. */
  cells?: number;
  /** The layout library's keywords for the archetype. */
  useWhen?: string;
}
