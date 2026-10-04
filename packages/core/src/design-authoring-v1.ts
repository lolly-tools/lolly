// SPDX-License-Identifier: MPL-2.0
/**
 * design-authoring-v1: the keys an agent may write into Design rows so it can
 * work in artboard coordinates, by named text style and with layout helpers
 * (plan 291, W5). Mirrored by `schemas/design-authoring-v1.schema.json`, with a
 * byte-identical copy under `packages/core/schema/` for the SDK.
 *
 * Authoring is a lowering. Every authoring key starts with `$`, is read once by
 * the engine's `expandDesignAuthoring` and is never stored: the result is plain
 * Design rows in global canvas coordinates with every text field written out.
 * A row with no `$` key passes through untouched, so a stored document expands
 * to itself.
 *
 * Where the keys may appear:
 *   - in the rows of `boxes` (a document, MCP `inputs`, the CLI), together with
 *     the top-level `$styles`, `$theme` and `$themes` beside `boxes`;
 *   - inside `layerOperations[].layer` of an `add`;
 *   - inside `layerPatches[].set`, limited to `$in`, `$style`, `$tint` and the path keys.
 *
 * Colours (plan 291 W4): a colour field may hold a token reference, `{color.role.muted-ink}`,
 * and a rich-text run may name one, `{@color.role.accent-ink w500|risk}`. With the brand's
 * tokens the expansion writes the literal plus a `tokenLinks` entry; without them the
 * reference is left for the runtime, which lowers it the same way on mount.
 *
 * Coordinates: with `$in`, a row's `x` and `y`, its `$points` and `$d`, and the
 * position of a macro are relative to the top-left of that artboard, rounded to
 * whole px the way the renderer rounds the origin. Without `$in` they stay global.
 *
 * Types and constants only: no runtime, no DOM, no I/O.
 */

/** The contract's name, for a document that wants to say which keys it speaks. */
export const DESIGN_AUTHORING_FORMAT = 'lolly/design-authoring-v1' as const;

/** Rows after expansion, per call, unless the caller sets another cap. */
export const DESIGN_AUTHORING_MAX_ROWS = 5000 as const;

/** The authoring keys a single row may carry. */
export const DESIGN_AUTHORING_ROW_KEYS = ['$in', '$style', '$artboard', '$points', '$d', '$closed', '$curve', '$tension', '$tint'] as const;
export type DesignAuthoringRowKeyV1 = (typeof DESIGN_AUTHORING_ROW_KEYS)[number];

/** The path keys, read by kind `path` rows only. */
export const DESIGN_AUTHORING_PATH_KEYS = ['$points', '$d', '$closed', '$curve', '$tension'] as const;
export type DesignAuthoringPathKeyV1 = (typeof DESIGN_AUTHORING_PATH_KEYS)[number];

/** The authoring keys a `layerPatches[].set` may carry. */
export const DESIGN_AUTHORING_PATCH_KEYS = ['$in', '$style', '$points', '$d', '$closed', '$curve', '$tension', '$tint'] as const;
export type DesignAuthoringPatchKeyV1 = (typeof DESIGN_AUTHORING_PATCH_KEYS)[number];

/** The layout helpers. A macro row holds an optional `id`, an optional `$in` and exactly one of these. */
export const DESIGN_AUTHORING_MACROS = ['$stack', '$grid', '$table'] as const;
export type DesignAuthoringMacroV1 = (typeof DESIGN_AUTHORING_MACROS)[number];

/** Top-level inputs beside `boxes`, stripped before validation. */
export const DESIGN_AUTHORING_DOCUMENT_KEYS = ['$styles', '$theme', '$themes'] as const;
export type DesignAuthoringDocumentKeyV1 = (typeof DESIGN_AUTHORING_DOCUMENT_KEYS)[number];

/**
 * The style ids `textStylesFromBrief` derives, one per archetype text role. A
 * document's `$styles` may extend them or add ids of its own.
 */
export const DESIGN_TEXT_STYLE_IDS = ['title', 'subtitle', 'body', 'caption', 'label', 'quote', 'number', 'attribution'] as const;
export type DesignTextStyleIdV1 = (typeof DESIGN_TEXT_STYLE_IDS)[number];

/** The fields a text style may set. Every one but `basedOn` and `italic` is a Design row field of the same name. */
export const DESIGN_TEXT_STYLE_FIELDS = ['basedOn', 'fontSize', 'weight', 'lineHeight', 'tracking', 'font', 'align', 'valign', 'pad', 'fg', 'italic'] as const;
export type DesignTextStyleFieldV1 = (typeof DESIGN_TEXT_STYLE_FIELDS)[number];

/** Horizontal alignment a style may ask for. */
export const DESIGN_TEXT_ALIGNS = ['left', 'center', 'right', 'justify'] as const;
export type DesignTextAlignV1 = (typeof DESIGN_TEXT_ALIGNS)[number];

/** Vertical alignment a style may ask for. */
export const DESIGN_TEXT_VALIGNS = ['top', 'middle', 'bottom'] as const;
export type DesignTextValignV1 = (typeof DESIGN_TEXT_VALIGNS)[number];

/** How `$points` are joined. `line` draws straight segments; the others are the pen tool's splines. */
export const DESIGN_PATH_CURVES = ['line', 'cubic', 'catmull-rom', 'bspline', 'hyperbezier', 'spiro'] as const;
export type DesignPathCurveV1 = (typeof DESIGN_PATH_CURVES)[number];

/** The direction a `$stack` advances in. */
export const DESIGN_STACK_AXES = ['y', 'x'] as const;
export type DesignStackAxisV1 = (typeof DESIGN_STACK_AXES)[number];

/** The order a `$grid` takes its items and paints its cells in. */
export const DESIGN_GRID_ORDERS = ['row', 'column'] as const;
export type DesignGridOrderV1 = (typeof DESIGN_GRID_ORDERS)[number];

/** What a template's coordinates are relative to: the item's origin, or the artboard alone. */
export const DESIGN_TEMPLATE_ANCHORS = ['item', 'artboard'] as const;
export type DesignTemplateAnchorV1 = (typeof DESIGN_TEMPLATE_ANCHORS)[number];

/** The codes an expansion's notes carry. Notes never stop an expansion; errors throw. */
export const DESIGN_AUTHORING_NOTE_CODES = [
  'authoring.fg.derived',
  'authoring.fg.contrast',
  'authoring.fg.ground',
  'authoring.path',
  'authoring.theme.unused',
  'authoring.frame.children',
  'authoring.colour.deferred',
  'authoring.themes.unused',
] as const;
export type DesignAuthoringNoteCodeV1 = (typeof DESIGN_AUTHORING_NOTE_CODES)[number];

/**
 * A named text style. Resolution, lowest first: the agent base (left, top, pad
 * 0, font sans, line height 1.2, weight 400, size 24), the style table (styles
 * from the brief, then `$styles`), the `basedOn` chain, an inline style, then
 * the row's own fields. A style fills only the fields a row leaves out.
 * A text row with no `$style` takes the `body` style. A `$style` replaces
 * `body`: an inline style without `basedOn` sits on the agent base alone, so
 * `{ basedOn: 'body', fg }` is the way to recolour body text and keep its size.
 * `fg` is written as the literal colour. `italic` sets the text in `*` emphasis.
 */
export interface DesignTextStyleV1 {
  basedOn?: string;
  fontSize?: number;
  weight?: string | number;
  lineHeight?: number;
  tracking?: number;
  font?: string;
  align?: DesignTextAlignV1;
  valign?: DesignTextValignV1;
  pad?: number;
  fg?: string;
  italic?: boolean;
}

/** Style id to style. */
export type DesignTextStyleTableV1 = Record<string, DesignTextStyleV1>;

/** Something an expansion decided for the author that they may want to know. */
export interface DesignAuthoringNoteV1 {
  /** JSON pointer of the row or key the note is about. */
  path: string;
  code: DesignAuthoringNoteCodeV1 | string;
  message: string;
}

/** A point in px, as `[x, y]`. */
export type DesignAuthoringPointV1 = readonly [number, number];

/** The authoring keys of one row. Any other key is a Design row field and is kept as written. */
export interface DesignAuthoringKeysV1 {
  /** Artboard id: coordinates become relative to its top-left, and `frame` takes the same id. */
  $in?: string;
  /** A style id from the table, or an inline style. Text rows only. */
  $style?: string | DesignTextStyleV1;
  /** Marks a row as an authored artboard: kind `frame`, rot 0, shape `rect`, clipChildren true. Needs `w` and `h`. */
  $artboard?: true;
  /** Path nodes in px. The box (`x`, `y`, `w`, `h`) and `path` are computed from them. */
  $points?: ReadonlyArray<DesignAuthoringPointV1>;
  /** SVG path data in px, in place of `$points`. */
  $d?: string;
  $closed?: boolean;
  $curve?: DesignPathCurveV1;
  $tension?: number;
  /**
   * A colour token (`{path}` or `path`) that recolours every stop of the row's linear
   * `grad` and keeps each stop's alpha (plan 291 W4). Stored as a tint link in
   * `tokenLinks.grad`, so one scrim row follows the theme.
   */
  $tint?: string;
}

/** One authored row: the authoring keys plus any Design row fields. */
export type DesignAuthoringRowV1 = DesignAuthoringKeysV1 & Record<string, unknown>;

/**
 * One row a macro writes per item. Row fields and authoring keys (not `$in`,
 * `$artboard` or a macro) as for a row; `x`, `y`, `$points` and `$d` are
 * relative to the item's origin unless `at` is `artboard`. An id may hold
 * `{i}` (item index), `{r}` (row) and `{c}` (column). Without an id the macro's
 * id is used as `<macro id>-<slot>{i}`. `z` and `role` are refused, and a
 * `group` must not start with `narration:`.
 */
export interface DesignMacroTemplateV1 extends Omit<DesignAuthoringKeysV1, '$in' | '$artboard'> {
  /** The name item values address this template by. */
  slot?: string;
  at?: DesignTemplateAnchorV1;
  id?: string;
  kind?: string;
  [field: string]: unknown;
}

/**
 * What one item says about one slot: a string fills the slot's content (text
 * for text, `$d` for a path, `image` for an image), `null` leaves the slot out
 * for this item, and an object overrides the template's fields.
 */
export type DesignMacroSlotValueV1 = string | null | Partial<DesignMacroTemplateV1>;

/** One item: a string fills the first text slot; an object maps slot names to values. */
export type DesignMacroItemV1 = string | Record<string, DesignMacroSlotValueV1>;

/**
 * A straight rule painted before every item but the first (before every row
 * but the first in a table). `id` takes `{i}`, the index of the item it
 * precedes. It is drawn across the stack's width (or the table's columns)
 * unless `x` and `w` (or `y` and `h` for an `x` stack) say otherwise, offset
 * by `dy` (or `dx`) from the item's origin.
 */
export interface DesignMacroDividerV1 {
  id?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  dx?: number;
  dy?: number;
  [field: string]: unknown;
}

/** Items one after another, `pitch` px apart along `axis`. */
export interface DesignStackV1 {
  x?: number;
  y?: number;
  /** The width a text slot without `w` takes (the height of a divider for an `x` stack is `h`). */
  w?: number;
  h?: number;
  pitch: number;
  axis?: DesignStackAxisV1;
  divider?: DesignMacroDividerV1;
  item: DesignMacroTemplateV1[];
  items: DesignMacroItemV1[];
}

/** Items in cells of `columns` columns, `colWidth` + `colGap` apart across and `rowPitch` down. */
export interface DesignGridV1 {
  x?: number;
  y?: number;
  columns: number;
  /** Rows, for `order: 'column'`; defaults to as many as the items need. */
  rows?: number;
  colWidth: number;
  colGap?: number;
  rowPitch: number;
  order?: DesignGridOrderV1;
  cell: DesignMacroTemplateV1[];
  items: DesignMacroItemV1[];
}

/** A table column: one template (its `x` and `y` are the cell's offset), or several under `cell`. */
export type DesignTableColumnV1 = DesignMacroTemplateV1 | { x?: number; y?: number; cell: DesignMacroTemplateV1[] };

/** A table row: its cells, or the cells with a value for the row's label. */
export type DesignTableRowV1 = DesignMacroSlotValueV1[] | DesignMacroItemV1[] | { label?: DesignMacroSlotValueV1; cells: Array<DesignMacroSlotValueV1 | DesignMacroItemV1> };

/** Rows `pitch` px apart, each an optional label then one cell per column, in paint order. */
export interface DesignTableV1 {
  x?: number;
  y?: number;
  pitch: number;
  divider?: DesignMacroDividerV1;
  label?: DesignMacroTemplateV1;
  columns: DesignTableColumnV1[];
  rows: DesignTableRowV1[];
}

/** A macro row. */
export interface DesignAuthoringMacroRowV1 {
  id?: string;
  $in?: string;
  $stack?: DesignStackV1;
  $grid?: DesignGridV1;
  $table?: DesignTableV1;
}

/** A document's top-level authoring inputs, beside `boxes`. */
export interface DesignAuthoringDocumentV1 {
  boxes: Array<DesignAuthoringRowV1 | DesignAuthoringMacroRowV1 | Record<string, unknown>>;
  $styles?: DesignTextStyleTableV1;
  /** The brief theme whose semantic colours the styles take. */
  $theme?: string;
  /**
   * The themes the document is shown in (plan 291 W4): names, or `all` for every theme
   * the brief declares. With more than one, a text colour the expansion fills from a
   * style is written as a link to the brief theme's slot, so it follows the theme.
   */
  $themes?: 'all' | string[];
  [input: string]: unknown;
}
