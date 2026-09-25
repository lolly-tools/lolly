// SPDX-License-Identifier: MPL-2.0
/**
 * Slide masters as design-system data (plan 274 section 3.4).
 *
 * A slide master is a brand pack's answer to "what does a slide look like here".
 * It owns geometry and furniture; content is addressed by role. A master holds
 * the twelve archetypes of `ARCHETYPE_IDS` and, from plan 275 on, archetypes the
 * build generates from the layout library under the library's ids, each with named placeholder roles
 * (title, subtitle, body, visual, data, caption, ...) and a list of the master
 * furniture it shows (logo, page number, footer, colour bars).
 *
 * Every box is a fraction of the master size, so the geometry carries to 1920x1080
 * or a print page without a second set of numbers. The seed in `engine/src/slide-master.ts`
 * resolves them at the master's own size today; a target size is an option that path
 * would gain, not one it offers. The type scale is stated in px at the master size,
 * which is the one place a pixel appears.
 *
 * It ships as a catalog asset: `brands/<pack>/catalog/assets/<ns>/slides/masters.json`
 * holds a `SlideMasterFileV1`, mirrored by `schemas/slide-master-v1.schema.json`.
 * The engine seeds Design frames from it (`engine/src/slide-master.ts`) and picks
 * a logo variant from the frame background (`engine/src/logo-variant.ts`).
 *
 * Pure data. Nothing here reads a file, touches the DOM or knows the time.
 */

import type { ArchetypeIdV1, ArchetypeRefV1, ArchetypeRoleV1, StructureIdV1 } from './rebrand-v1.ts';

export const SLIDE_MASTER_CONTRACT_VERSION = 1 as const;

/** What a placeholder holds. Design has no table primitive, so `table` seeds a text layer. */
export const PLACEHOLDER_KINDS = ['text', 'image', 'table'] as const;
export type PlaceholderKindV1 = (typeof PLACEHOLDER_KINDS)[number];

/** The furniture a master can carry. `bar` and `rect` are painted shapes; the rest are content. */
export const FURNITURE_KINDS = ['logo', 'page-number', 'footer', 'bar', 'rect'] as const;
export type FurnitureKindV1 = (typeof FURNITURE_KINDS)[number];

export const MASTER_ALIGNMENTS = ['left', 'center', 'right'] as const;
export type MasterAlignV1 = (typeof MASTER_ALIGNMENTS)[number];

export const MASTER_VALIGNMENTS = ['top', 'middle', 'bottom'] as const;
export type MasterValignV1 = (typeof MASTER_VALIGNMENTS)[number];

/** Design's three font slots. A master names a slot, never a family. */
export const MASTER_FONT_SLOTS = ['sans', 'display', 'mono'] as const;
export type MasterFontSlotV1 = (typeof MASTER_FONT_SLOTS)[number];

/** An axis-aligned box as fractions of the master size, origin top left. */
export interface MasterBoxV1 {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Type and colour for one placeholder or one piece of text furniture. `fontSize` is
 * px at the master size; leave it out to take the master's type scale for the role.
 * Colour is stated as a design-system token path (`fgTokenPath`) wherever it can be,
 * so a pack update moves it; `fg` is the literal for the cases a token cannot cover.
 */
export interface MasterTextStyleV1 {
  fontSize?: number;
  weight?: string;
  align?: MasterAlignV1;
  valign?: MasterValignV1;
  font?: MasterFontSlotV1;
  fg?: string;
  fgTokenPath?: string;
}

/** One content slot in an archetype. The role is what the compile assigns content to. */
export interface PlaceholderLayerV1 {
  role: ArchetypeRoleV1;
  box: MasterBoxV1;
  kind: PlaceholderKindV1;
  style?: MasterTextStyleV1;
  /** How an `image` placeholder fills its box. Defaults to `contain`. */
  fit?: 'contain' | 'cover' | 'fill';
  /** Shown as empty-state guidance in Design; never exported as content. */
  prompt?: string;
  /**
   * The cell this placeholder shares with others in a repeat (a label and its
   * body), so the compile pours a source column's heading and text together and
   * the thumbnail draws the cell. Plan 275 section 2.5.
   */
  group?: string;
  /** Position within a repeat, 0-based, in reading order, for pouring a detected row in order. */
  index?: number;
  /** An empty optional slot is not spare and is not drawn as an empty placeholder in Design. */
  optional?: boolean;
  /**
   * This placeholder sits over another on purpose (a caption scrim over a picture,
   * a caption under a big number), so the overlap rule of `validate:catalog` allows it.
   */
  overlay?: boolean;
}

/**
 * One piece of master furniture. Geometry is master-level, so an archetype names the
 * id rather than repeating the box. `variantByBackground` marks a logo that follows
 * the frame background through `pickLogoVariant`.
 */
export interface FurnitureLayerV1 {
  id: string;
  kind: FurnitureKindV1;
  box: MasterBoxV1;
  variantByBackground?: boolean;
  text?: string;
  tokenPath?: string;
  /** Literal fill for the cases a token path cannot cover. */
  hex?: string;
  style?: MasterTextStyleV1;
}

/**
 * The frame background. `dark` is the master's own statement about the result, and it
 * is authoritative: the seed hands it to `pickLogoVariant` rather than measuring the
 * resolved colour, so a gradient stored as its dominant stop still gets the mark its
 * author meant, and a logo variant and the ink colour are decided without resolving
 * the token first. Furniture painted under the logo still wins locally, because a dark
 * panel on a light slide is a different background from the slide's own.
 */
export interface ArchetypeBackgroundV1 {
  tokenPath?: string;
  hex?: string;
  dark?: boolean;
}

/** A column range on the 12-column content grid: `[start, span]`. */
export type GridSpanV1 = [number, number];

/**
 * The authoring shorthand for repeated boxes (plan 275 section 2.1): `count`
 * cells, `across` per row on the content grid, each split top to bottom by
 * `cell`, whose entries read `role:share` (`label:0.2`, `body:0.8`). The build
 * expands it into placeholders carrying `group` and `index`; the thumbnail and
 * the compile read it to draw and to pour cells.
 */
export interface ArchetypeRepeatV1 {
  count: number;
  across: number;
  cell: string[];
  /** The columns a cell takes inside its slot, when not all of them (a stacked list keeps column 0 for its number or icon). */
  cellCols?: GridSpanV1;
  /** The columns a stacked list's number takes. */
  numberCol?: GridSpanV1;
  /** The columns a stacked list's icon takes. */
  iconCol?: GridSpanV1;
  /**
   * A rule drawn through the row (a timeline). Only which axis is stated counts:
   * `y` (with `h` for its thickness) draws a rule across the row, `x` (with `w`)
   * one down a stacked list. The position is derived from the cells, in the gap
   * under their first part or through the middle of the first column, so the
   * value given for `x` or `y` is a marker, not a place on the slide.
   */
  rule?: { x?: number; y?: number; w?: number; h?: number };
  /** How a repeated `visual` fills its cell. */
  fit?: 'contain' | 'cover' | 'fill';
  /** Share of a cell left empty around a repeated `visual` (a logo wall). */
  inset?: number;
  /** What a repeated `data` slot holds. */
  dataKind?: 'image' | 'table';
}

export interface ArchetypeV1 {
  /** One of the twelve, or from plan 275 on a library id the build generated this archetype under. */
  id: ArchetypeRefV1;
  name: string;
  placeholders: PlaceholderLayerV1[];
  /** Ids of master furniture this archetype shows, in paint order. */
  furniture?: string[];
  background?: ArchetypeBackgroundV1;
  /** The layout library entry this archetype restyles. Absent means the archetype's own id. */
  structure?: StructureIdV1;
  /** The library section this archetype is listed under, when it differs from the library's own. */
  section?: string;
  /** The repeat the build expanded this archetype's placeholders from. */
  repeat?: ArchetypeRepeatV1;
  /** Archetypes a per-slide ground selects: `dark` is the one a slide set to Dark takes (plan 275 section 6.2). */
  variants?: { dark?: ArchetypeRefV1 };
  /**
   * On a variant, the archetype it is the variant of, so a chooser can list the
   * light archetype alone without reading every other archetype's `variants`.
   */
  variantOf?: ArchetypeRefV1;
}

/** Sizes in px at the master size, one per role family. */
export interface MasterTypeScaleV1 {
  title: number;
  subtitle: number;
  body: number;
  caption: number;
  number: number;
  label: number;
}

/**
 * How the master finds its logo. `assetTags` are catalog query tags, matched the way
 * the deck tools match them: every tag in the list must be present on the asset.
 *
 * `mono` is not a third side. It is the extra tag that names the mono mark WITHIN a
 * side, so the four slots of `LogoSetV1` come from two queries per side, which is
 * what `resolveLogos` in both deck tools does (`community/deck-studio/hooks.js` near
 * 150, `brands/suse/tools/deck-builder/hooks.js` near 660):
 *
 *   - mono mark for a side: that side's tags PLUS the mono tags;
 *   - colour mark for a side: that side's tags, taking the first result that is not
 *     the mono mark, and the mono mark itself only when there is nothing else;
 *   - a side that answers nothing stays empty, and that frame gets no logo. A mark
 *     from the other side is never a fallback.
 *
 * The tools also try the tags with `horizontal` first and drop back to the tags
 * without it, which is how a pack that ships one lockup per side still answers.
 */
export interface MasterLogoV1 {
  variantByBackground: boolean;
  assetTags?: {
    onLight: string[];
    onDark: string[];
    mono?: string[];
  };
}

export interface SlideMasterV1 {
  /** Permanent id, namespaced like an asset id. Versioned in `version`, never in the id. */
  id: string;
  /** SemVer of this master's geometry. */
  version: string;
  name: string;
  /** The reference size every fraction is taken against, in px. */
  size: { width: number; height: number };
  archetypes: ArchetypeV1[];
  furniture: FurnitureLayerV1[];
  typeScale: MasterTypeScaleV1;
  logo: MasterLogoV1;
  description?: string;
}

/** What a pack's `slides/masters.json` holds. A pack may ship more than one master. */
export interface SlideMasterFileV1 {
  version: typeof SLIDE_MASTER_CONTRACT_VERSION;
  masters: SlideMasterV1[];
  /** The layout library the masters restyle, when a build generated them from one. */
  library?: { id: string; version: string };
}

/** The archetype with this id, or undefined. Lookup only, no fallback invented here. */
export function findArchetype(master: SlideMasterV1, id: ArchetypeIdV1 | ArchetypeRefV1): ArchetypeV1 | undefined {
  return master.archetypes.find((a) => a.id === id);
}

/** The furniture entry with this id, or undefined. */
export function findFurniture(master: SlideMasterV1, id: string): FurnitureLayerV1 | undefined {
  return master.furniture.find((f) => f.id === id);
}

/**
 * The px size for a role at the master size. A placeholder's own `style.fontSize`
 * wins; otherwise the role falls into one of the six scale steps.
 */
export function roleFontSize(master: SlideMasterV1, role: ArchetypeRoleV1, style?: MasterTextStyleV1): number {
  if (style && typeof style.fontSize === 'number') return style.fontSize;
  const scale = master.typeScale;
  switch (role) {
    case 'title': return scale.title;
    case 'subtitle': return scale.subtitle;
    case 'caption': return scale.caption;
    case 'number': return scale.number;
    case 'label': return scale.label;
    case 'attribution': return scale.caption;
    case 'quote': return scale.title;
    default: return scale.body;
  }
}
