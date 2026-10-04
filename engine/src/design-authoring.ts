// SPDX-License-Identifier: MPL-2.0
/**
 * Design authoring keys lowered to stored rows (plan 291 W5, contract
 * `@lolly-tools/core` design-authoring-v1).
 *
 * An agent may write `$`-prefixed keys into Design rows: `$in` for artboard
 * coordinates, `$style` for a named text style, `$points` and `$d` for paths in px,
 * `$artboard` for an artboard row, and the layout helpers `$stack`, `$grid` and
 * `$table`. `expandDesignAuthoring` turns them into plain rows in global canvas
 * coordinates with every text field written out, so nothing downstream (the
 * renderer, the URL codec, the PPTX tiers, the checks) has to know they exist:
 *
 *   - a row with no `$` key is passed through untouched, so a stored document is its
 *     own expansion;
 *   - authored rows take the agent defaults (rot 0; text left, top, pad 0, font sans,
 *     line height 1.2; images contain and centred) for the fields they leave out;
 *   - a text style fills only the fields a row leaves out, and its colour is written
 *     as the literal hex of the theme's slot, or black or white by contrast with the
 *     row's own fill (else its artboard's) when there is no brief;
 *   - a macro expands in paint order and never writes `z`, `group` or `role`;
 *   - all or nothing: the first problem throws Error('<json pointer>: <message>').
 *
 * Colours (plan 291 W4): a colour field may hold a token reference (`{color.role.muted-ink}`)
 * and a rich-text run may name one (`{@color.role.accent-ink w500|risk}`). With `tokens`
 * the expansion writes the literal plus a `tokenLinks` entry (token-block-bindings.ts
 * `normaliseDesignColourRefs`), a stored row included, and refuses a reference that does
 * not resolve; without them the reference is left for the runtime and noted. `$tint`
 * links a row's linear `grad` to a colour, and `$themes` with more than one theme writes
 * a text colour a style filled as a link to the brief theme's slot.
 *
 * `applyAuthoredLayerOperations` and `applyAuthoredLayerPatches` wrap the unchanged
 * `applyLayerOperations` and `applyLayerPatches`: each original operation is expanded
 * and applied on its own, so a later operation sees an artboard an earlier one added,
 * and an error carries the caller's own index.
 *
 * Pure and synchronous: rows in, rows out.
 */
import type { DesignTextStyleV1 } from '@lolly-tools/core';
import { applyLayerOperations, applyLayerPatches } from './design-layer-ops.ts';
import { designPathPlacement } from './design-path-author.ts';
import { assertTextStyle, resolveTextStyle, textStylesFromBrief } from './design-text-style.ts';
import { parseColorToSrgb8 } from './css-color.ts';
import type { TokenSet } from './bridge/host-v1.ts';
import type { InputValue } from './inputs.ts';
import { hasDesignColourRefs, normaliseDesignColourRefs, readBlockRunBindings, readBlockTokenBindings, tintGradientSpec, type DesignColourRefIssue } from './token-block-bindings.ts';
import { aliasPath, isAlias } from './tokens.ts';
import { canonicalJson } from './canonical-json.ts';

type Rec = Record<string, unknown>;
type Point = { x: number; y: number };

export interface DesignAuthoringOptions {
  /** Named styles over the brief's (a document's `$styles`). An id the brief also has extends the brief's style. */
  styles?: Record<string, DesignTextStyleV1>;
  /** A `designBrief` result. Null or absent: the built-in styles, and colours by contrast. */
  brief?: unknown | null;
  /** The brief theme whose semantic colours the styles take. */
  theme?: string;
  /** Rows already in the document: consulted for `$in` artboards and to refuse id collisions. */
  existing?: readonly Record<string, unknown>[];
  /** JSON pointer of the rows array, prefixed to every error and note (default ''). */
  pointer?: string;
  /** Rows after expansion, per call (default 5000). */
  maxRows?: number;
  /**
   * The brand's tokens, in the theme the literals are cached in (plan 291 W4). Colour
   * references then lower to the literal plus a link, and one that does not resolve is
   * refused. Absent: references are left for the runtime, which lowers them on mount.
   */
  tokens?: TokenSet | null;
  /**
   * The themes the document is shown in: names, or `all` for every brief theme. With
   * more than one, a text colour a style fills is written as a link to the slot of the
   * brief theme it came from, so it follows the theme.
   */
  themes?: readonly string[] | 'all';
}

export interface DesignAuthoringNote { path: string; code: string; message: string }

export interface DesignAuthoringResult {
  rows: Record<string, unknown>[];
  notes: DesignAuthoringNote[];
  /** False when nothing was authored: `rows` then holds the input rows as they were. */
  expanded: boolean;
}

const MAX_ROWS = 5000;
const ROW_KEYS: ReadonlySet<string> = new Set(['$in', '$style', '$artboard', '$points', '$d', '$closed', '$curve', '$tension', '$tint']);
const PATH_KEYS = ['$points', '$d', '$closed', '$curve', '$tension'] as const;
const PATCH_KEYS: ReadonlySet<string> = new Set(['$in', '$style', ...PATH_KEYS, '$tint']);
const MACRO_KEYS = ['$stack', '$grid', '$table'] as const;
type MacroKey = (typeof MACRO_KEYS)[number];
const DOC_KEYS = ['$styles', '$theme', '$themes'] as const;
/** The Design row fields a colour reference may be written into. */
const COLOUR_FIELDS = ['bg', 'fg', 'stroke', 'shadowColor'] as const;
/** The order a text colour's brief slot is looked for when it is linked (plan 291 W4). */
const TEXT_SLOT_ORDER = ['text', 'muted', 'primary', 'secondary', 'on-primary', 'surface', 'edge'];
/** The fields an `add` operation may carry (design-layer-ops). */
const ADD_OP_KEYS: ReadonlySet<string> = new Set(['op', 'layer', 'beforeId', 'afterId']);
/** Row fields a resolved text style writes. `italic` is applied to the text instead. */
const STYLE_ROW_FIELDS = ['fontSize', 'weight', 'lineHeight', 'tracking', 'font', 'align', 'valign', 'pad', 'fg'] as const;
/** The agent base under every text style. */
const AGENT_TEXT_BASE: DesignTextStyleV1 = { fontSize: 24, weight: '400', lineHeight: 1.2, font: 'sans', align: 'left', valign: 'top', pad: 0 };
/** What an authored row of each kind gets for the fields it leaves out. */
const KIND_DEFAULTS: Readonly<Record<string, Rec>> = {
  text: { rot: 0, shape: 'rect' },
  image: { rot: 0, fit: 'contain', imgpos: 'center', shape: 'rect' },
  box: { rot: 0, shape: 'rect' },
  path: { rot: 0, bg: '' },
  frame: { rot: 0, shape: 'rect', clipChildren: true },
};
/** The paint fields `designPathPlacement` reads to size a path's paint box and check its heads. */
const PAINT_KEYS = ['stroke', 'strokeW', 'headStart', 'headEnd', 'strokeCap', 'strokeJoin'] as const;
/** Template keys a macro reads and never stores. */
const TEMPLATE_META = ['slot', 'at'] as const;

const record = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);
const dollarKeys = (v: Rec): string[] => Object.keys(v).filter((k) => k.startsWith('$'));
const hasDollar = (v: unknown): v is Rec => record(v) && Object.keys(v).some((k) => k.startsWith('$'));
const seg = (key: string | number): string => String(key).replace(/~/g, '~0').replace(/\//g, '~1');
/** Removes the float noise an integer origin plus a decimal can leave (0.1 + 2080). */
const tidy = (n: number): number => Math.round(n * 1e6) / 1e6 + 0;

function numberAt(value: unknown, pointer: string, opts: { min?: number; integer?: boolean } = {}): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  if (!Number.isFinite(n)) throw new Error(`${pointer}: expected a number.`);
  if (opts.integer && !Number.isInteger(n)) throw new Error(`${pointer}: expected a whole number.`);
  if (opts.min !== undefined && n < opts.min) throw new Error(`${pointer}: expected a number of at least ${opts.min}.`);
  return n;
}
const optionalNumber = (value: unknown, pointer: string, fallback?: number): number | undefined =>
  value === undefined ? fallback : numberAt(value, pointer);

// ─── colour ──────────────────────────────────────────────────────────────────

function luminance(colour: unknown): number | null {
  const rgba = typeof colour === 'string' ? parseColorToSrgb8(colour) : null;
  if (!rgba || rgba[3] < 1) return null;
  const lin = (c: number): number => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(rgba[0]) + 0.7152 * lin(rgba[1]) + 0.0722 * lin(rgba[2]);
}
/** An opaque colour as `#rrggbb`, or undefined. */
function hexOf(colour: unknown): string | undefined {
  const rgba = typeof colour === 'string' ? parseColorToSrgb8(colour) : null;
  return rgba && rgba[3] >= 1 ? '#' + rgba.slice(0, 3).map((n) => n.toString(16).padStart(2, '0')).join('') : undefined;
}
const contrast = (a: number, b: number): number => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
/** Black or white, whichever reads better on the ground (the editor's `withLegibleInk` rule). */
const inkOn = (ground: number): string => (contrast(ground, 0) >= contrast(ground, 1) ? '#000000' : '#ffffff');

// ─── context ─────────────────────────────────────────────────────────────────

interface Ctx {
  frames: Map<string, Rec>;
  brief: unknown | null;
  theme: string | undefined;
  themePointer: string;
  styles: Record<string, DesignTextStyleV1>;
  tables: Map<string, Record<string, DesignTextStyleV1>>;
  themeText: string | undefined;
  notes: DesignAuthoringNote[];
  derived: string[];
  unknownGround: string[];
  lowContrast: string[];
  /** The brand's tokens, when the caller gave them. */
  tokens: TokenSet | null;
  /** The brief theme's semantic slots (slot to `#rrggbb`), when the document is shown in more than one theme. */
  linkSlots: Record<string, string> | null;
  /** Rows whose colour references were left for the runtime. */
  deferred: string[];
}

function frameIdOf(row: unknown): string | null {
  if (!record(row) || (row.kind !== 'frame' && !row.$artboard)) return null;
  return typeof row.id === 'string' && row.id ? row.id : null;
}

function collectFrames(rows: readonly unknown[], existing: readonly unknown[] | undefined): Map<string, Rec> {
  const frames = new Map<string, Rec>();
  for (const row of [...rows, ...(existing ?? [])]) {
    const id = frameIdOf(row);
    if (id && !frames.has(id)) frames.set(id, row as Rec);
  }
  return frames;
}

function makeCtx(rows: readonly unknown[], opts: DesignAuthoringOptions, themePointer: string): Ctx {
  const brief = opts.brief ?? null;
  const styles: Record<string, DesignTextStyleV1> = {};
  for (const [id, style] of Object.entries(opts.styles ?? {})) styles[id] = assertTextStyle(style, `${themePointer.replace(/\$theme$/, '$styles')}/${seg(id)}`);
  const ctx: Ctx = {
    frames: collectFrames(rows, opts.existing), brief, theme: opts.theme, themePointer, styles,
    tables: new Map(), themeText: undefined, notes: [], derived: [], unknownGround: [], lowContrast: [],
    tokens: opts.tokens ?? null, linkSlots: null, deferred: [],
  };
  if (record(brief)) {
    try {
      textStylesFromBrief(brief, { width: 1920, theme: opts.theme });
    } catch (err) {
      throw new Error(`${themePointer}: ${err instanceof Error ? err.message : String(err)}`);
    }
    const themes = Array.isArray(brief.themes) ? brief.themes.filter(record) : [];
    const wanted = opts.theme ?? (typeof brief.theme === 'string' && brief.theme ? brief.theme : undefined);
    const hit = (wanted ? themes.find((t) => t.name === wanted) : undefined) ?? themes[0];
    const text = hit && record(hit.semantic) ? hit.semantic.text : undefined;
    // Written as literal hex, as the brief's own styles are, whatever form the token takes.
    ctx.themeText = hexOf(text);
    const themesPointer = themePointer.replace(/\$theme$/, '$themes');
    const wantedThemes = opts.themes === 'all' ? themes.map((t) => String(t.name)) : opts.themes ?? [];
    for (const name of wantedThemes) {
      if (!themes.some((t) => t.name === name)) throw new Error(`${themesPointer}: the design system has no theme "${name}"; its themes are ${themes.map((t) => String(t.name)).join(', ') || 'none'}.`);
    }
    if (wantedThemes.length > 1 && hit && record(hit.semantic)) {
      ctx.linkSlots = {};
      for (const [slot, value] of Object.entries(hit.semantic)) {
        const hex = hexOf(value);
        if (hex) ctx.linkSlots[slot] = hex;
      }
    }
  } else if (opts.theme !== undefined) {
    ctx.notes.push({ path: themePointer, code: 'authoring.theme.unused', message: `Theme "${opts.theme}" was not applied: no design brief was supplied, so colours come from contrast with each artboard.` });
  }
  if (!ctx.linkSlots && opts.themes !== undefined && (opts.themes === 'all' || opts.themes.length > 1) && !record(brief)) {
    ctx.notes.push({ path: themePointer.replace(/\$theme$/, '$themes'), code: 'authoring.themes.unused', message: 'The themes were not applied: no design brief was supplied, so a style colour is written as a literal. Write each colour as a token reference to make it follow the theme.' });
  }
  return ctx;
}

/** The style table for an artboard of this size: the brief's styles (or the built-in ones), then `styles`. */
function tableFor(ctx: Ctx, frame: Rec | undefined): Record<string, DesignTextStyleV1> {
  const width = Number(frame?.w) > 0 ? Number(frame!.w) : 1920;
  const height = Number(frame?.h) > 0 ? Number(frame!.h) : (width * 9) / 16;
  const key = `${width}x${height}`;
  const hit = ctx.tables.get(key);
  if (hit) return hit;
  const base = textStylesFromBrief(record(ctx.brief) ? ctx.brief : null, { width, height, theme: ctx.theme });
  const table: Record<string, DesignTextStyleV1> = { ...base };
  for (const [id, style] of Object.entries(ctx.styles)) {
    table[id] = base[id] && style.basedOn === undefined ? { ...base[id], ...style } : style;
  }
  ctx.tables.set(key, table);
  return table;
}

function frameOrigin(ctx: Ctx, id: unknown, pointer: string): { origin: Point; frame: Rec } {
  if (typeof id !== 'string' || !id) throw new Error(`${pointer}: an artboard id is required.`);
  const frame = ctx.frames.get(id);
  if (!frame) throw new Error(`${pointer}: artboard "${id}" does not exist.`);
  const x = Math.round(Number(frame.x));
  const y = Math.round(Number(frame.y));
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`${pointer}: artboard "${id}" has no numeric x and y.`);
  return { origin: { x, y }, frame };
}

function kindOf(row: Rec): string | undefined {
  if (typeof row.kind === 'string' && row.kind) return row.kind;
  if (row.$artboard) return 'frame';
  if (row.$style !== undefined || row.text !== undefined) return 'text';
  if (PATH_KEYS.some((k) => row[k] !== undefined)) return 'path';
  if (row.image !== undefined) return 'image';
  return undefined;
}

/**
 * The luminance of a fill, reading the fallback of a `var(--token, fallback)` too (the
 * editor's artboard seeds are written that way). Null when it is no opaque colour.
 */
function groundLuminance(fill: unknown): number | null {
  const direct = luminance(fill);
  if (direct !== null || typeof fill !== 'string') return direct;
  const m = /^\s*var\(\s*--[\w-]+\s*,\s*(.+)\)\s*$/.exec(fill);
  return m ? groundLuminance(m[1]) : null;
}

/**
 * What a text row's ink sits on: the row's own fill when it has an opaque one, else its
 * artboard's (the editor's `groundUnder` order). Null when neither can be read.
 */
function groundOf(ownBg: unknown, frame: Rec | undefined): number | null {
  return groundLuminance(ownBg) ?? groundLuminance(frame?.bg);
}

/**
 * Resolved style fields for a text row (agent base, table or body style, inline),
 * colour included. An unstyled row takes the body style; a `$style` (an id, or an
 * inline style and its `basedOn` chain) replaces it, over the agent base. `ownBg` is
 * the row's fill.
 */
function resolvedTextFields(ctx: Ctx, ref: unknown, frame: Rec | undefined, ownBg: unknown, pointer: string, stylePointer: string): { style: DesignTextStyleV1 } {
  const table = tableFor(ctx, frame);
  let chain: DesignTextStyleV1;
  if (ref === undefined) chain = table.body ? { ...table.body } : {};
  else if (typeof ref === 'string' || record(ref)) chain = resolveTextStyle(ref as string | DesignTextStyleV1, table, stylePointer);
  else throw new Error(`${stylePointer}: expected a text style id or a style object.`);
  const style: DesignTextStyleV1 = { ...AGENT_TEXT_BASE, ...chain };
  if (style.fg === undefined) {
    if (ctx.themeText) {
      style.fg = ctx.themeText;
    } else {
      const ground = groundOf(ownBg, frame);
      style.fg = inkOn(ground ?? 1);
      (ground === null ? ctx.unknownGround : ctx.derived).push(pointer);
    }
  }
  return { style };
}

/** Sets each line in `*` emphasis, keeping a list marker outside the emphasis. */
function italicText(text: unknown, stylePointer: string): unknown {
  if (typeof text !== 'string' || !text) return text;
  if (/[*_]/.test(text)) throw new Error(`${stylePointer}: an italic style cannot set text that already carries * or _ markup; write the emphasis in the text.`);
  return text.split('\n').map((line) => {
    if (!line.trim()) return line;
    const m = /^(\s*(?:[-•]\s|\d+\.\s))?(.*)$/.exec(line)!;
    return `${m[1] ?? ''}*${m[2]}*`;
  }).join('\n');
}

/** Notes a style colour that reads below 3:1 on the row's own fill or its artboard. */
function checkContrast(ctx: Ctx, fg: unknown, frame: Rec | undefined, ownBg: unknown, pointer: string): void {
  const a = luminance(fg);
  const b = groundOf(ownBg, frame);
  if (a !== null && b !== null && contrast(a, b) < 3) ctx.lowContrast.push(pointer);
}

/** The field a path placement error is about, from the start of its message. */
const PATH_ERROR_FIELDS: Readonly<Record<string, string>> = {
  curve: '$curve', closed: '$closed', tension: '$tension',
  strokeW: 'strokeW', headStart: 'headStart', headEnd: 'headEnd', strokeCap: 'strokeCap', strokeJoin: 'strokeJoin',
};

/**
 * The stored box and value for a row's path keys, with `origin` added; refuses a stated
 * box. `at(key)` is the JSON pointer of one of the row's keys.
 */
function placePath(ctx: Ctx, source: Rec, origin: Point, paint: Rec, at: (key: string) => string): Rec {
  for (const k of ['x', 'y', 'w', 'h', 'path']) {
    if (source[k] !== undefined) throw new Error(`${at(k)}: a path drawn with $points or $d takes its box from the geometry; leave out x, y, w, h and path.`);
  }
  const key = source.$points !== undefined ? '$points' : '$d';
  const geometry: Rec = {};
  for (const [from, to] of [['$points', 'points'], ['$d', 'd'], ['$closed', 'closed'], ['$curve', 'curve'], ['$tension', 'tension']]) {
    if (source[from!] !== undefined) geometry[to!] = source[from!];
  }
  const opts: Rec = { origin };
  for (const k of PAINT_KEYS) if (paint[k] !== undefined) opts[k] = paint[k];
  let placement: ReturnType<typeof designPathPlacement>;
  try {
    placement = designPathPlacement(geometry as Parameters<typeof designPathPlacement>[0], opts as Parameters<typeof designPathPlacement>[1]);
  } catch (err) {
    const reason = (err instanceof Error ? err.message : String(err)).replace(/^geom: /, '');
    const named = /^(\w+) /.exec(reason)?.[1];
    throw new Error(`${at(named && Object.hasOwn(PATH_ERROR_FIELDS, named) ? PATH_ERROR_FIELDS[named]! : key)}: ${reason}`);
  }
  for (const message of placement.notes) ctx.notes.push({ path: at(key), code: 'authoring.path', message });
  return { x: placement.x, y: placement.y, w: placement.w, h: placement.h, path: placement.path };
}

// ─── one row ─────────────────────────────────────────────────────────────────

/** Where a macro put a row: its offset in the macro's space, and what `x` and `y` are relative to. */
interface Placement { offset: Point; at: 'item' | 'artboard'; defaultW?: number }

/**
 * One authored row to a stored row. `pointer` points at the row; `keyAt(key)`, when
 * given, points at each of its keys (a macro row takes its keys from a template and an item).
 */
function lowerRow(ctx: Ctx, row: Rec, pointer: string, placed: Placement | null, keyAt?: (key: string) => string): Rec {
  const at = keyAt ?? ((key: string): string => `${pointer}/${seg(key)}`);
  for (const key of dollarKeys(row)) {
    if (!ROW_KEYS.has(key)) {
      const hint = (MACRO_KEYS as readonly string[]).includes(key) ? ' (a macro row holds only id, $in and the macro)' : '';
      throw new Error(`${at(key)}: unknown authoring key${hint}; expected one of ${[...ROW_KEYS].join(', ')}.`);
    }
  }
  const kind = kindOf(row) ?? 'box';
  const isPath = PATH_KEYS.some((k) => row[k] !== undefined);
  if (row.$artboard !== undefined) {
    if (row.$artboard !== true) throw new Error(`${at('$artboard')}: expected true.`);
    if (kind !== 'frame') throw new Error(`${at('kind')}: an $artboard row is kind frame.`);
    if (row.$in !== undefined) throw new Error(`${at('$in')}: an artboard sits on the canvas, never in another artboard.`);
    for (const k of ['w', 'h']) if (row[k] === undefined) throw new Error(`${at(k)}: an $artboard row needs w and h.`);
  }
  if (row.$style !== undefined && kind !== 'text') throw new Error(`${at('$style')}: only text rows take a text style (this row is kind ${kind}).`);
  if (isPath && kind !== 'path') throw new Error(`${at(PATH_KEYS.find((k) => row[k] !== undefined)!)}: path geometry belongs on kind path rows (this row is kind ${kind}).`);

  let origin: Point | null = null;
  let frameId: string | undefined = typeof row.frame === 'string' && row.frame ? row.frame : undefined;
  if (row.$in !== undefined) {
    if (kind === 'frame') throw new Error(`${at('$in')}: an artboard sits on the canvas, never in another artboard.`);
    const hit = frameOrigin(ctx, row.$in, at('$in'));
    if (row.frame !== undefined && row.frame !== row.$in)
      throw new Error(`${at('frame')}: "${String(row.frame)}" does not match $in "${String(row.$in)}"; leave frame out.`);
    origin = hit.origin;
    frameId = row.$in as string;
  }
  const frame = frameId ? ctx.frames.get(frameId) : undefined;

  const out: Rec = {};
  if (row.id !== undefined) out.id = row.id;
  out.kind = kind;
  if (frameId !== undefined && kind !== 'frame') out.frame = frameId;
  for (const [key, value] of Object.entries(row)) {
    if (key.startsWith('$') || key === 'id' || key === 'kind' || key === 'frame') continue;
    out[key] = value;
  }
  if (placed && placed.defaultW !== undefined && kind === 'text' && out.w === undefined) out.w = placed.defaultW;

  const anchored = origin !== null || placed !== null;
  const base: Point = {
    x: (origin?.x ?? 0) + (placed && placed.at === 'item' ? placed.offset.x : 0),
    y: (origin?.y ?? 0) + (placed && placed.at === 'item' ? placed.offset.y : 0),
  };
  if (isPath) {
    Object.assign(out, placePath(ctx, row, base, out, at));
  } else if (anchored) {
    out.x = tidy(base.x + (row.x === undefined ? 0 : numberAt(row.x, at('x'))));
    out.y = tidy(base.y + (row.y === undefined ? 0 : numberAt(row.y, at('y'))));
  }

  for (const [key, value] of Object.entries(KIND_DEFAULTS[kind] ?? { rot: 0 })) if (out[key] === undefined) out[key] = value;

  if (kind === 'text') {
    const { style } = resolvedTextFields(ctx, row.$style, frame, out.bg, pointer, at('$style'));
    for (const key of STYLE_ROW_FIELDS) if (out[key] === undefined && style[key] !== undefined) out[key] = style[key];
    if (out.weight !== undefined && typeof out.weight === 'number') out.weight = String(out.weight);
    if (style.italic === true) out.text = italicText(out.text, at('$style'));
    // Any colour the row did not state itself (a brief style, a $styles entry, the theme's text) is checked.
    if (row.fg === undefined) checkContrast(ctx, out.fg, frame, out.bg, pointer);
    if (row.fg === undefined && !styleSetsColour(ctx, row.$style, tableFor(ctx, frame))) out.fg = linkedStyleColour(ctx, out.fg);
  }
  if (row.$tint !== undefined) tintRow(ctx, out, row.$tint, at);
  return lowerColours(ctx, out, at);
}

/**
 * True when the author wrote the colour a text style gives: an inline style, or a
 * `$styles` entry on its `basedOn` chain, sets `fg`. That colour is kept as written
 * under `$themes`; only a colour the brief gave is linked to its slot.
 */
function styleSetsColour(ctx: Ctx, ref: unknown, table: Record<string, DesignTextStyleV1>): boolean {
  let id: string | undefined;
  if (record(ref)) {
    if (ref.fg !== undefined) return true;
    id = typeof ref.basedOn === 'string' ? ref.basedOn : undefined;
  } else id = typeof ref === 'string' ? ref : 'body';
  const seen = new Set<string>();
  while (id !== undefined && !seen.has(id)) {
    seen.add(id);
    if (Object.hasOwn(ctx.styles, id) && ctx.styles[id]!.fg !== undefined) return true;
    const next = Object.hasOwn(table, id) ? table[id]!.basedOn : undefined;
    id = typeof next === 'string' ? next : undefined;
  }
  return false;
}

/** A text colour a style filled, as a reference to the brief theme slot it came from (one document, more than one theme). */
function linkedStyleColour(ctx: Ctx, fg: unknown): unknown {
  if (!ctx.linkSlots || typeof fg !== 'string') return fg;
  const hex = hexOf(fg);
  const slot = hex ? TEXT_SLOT_ORDER.find((s) => ctx.linkSlots![s] === hex) ?? Object.keys(ctx.linkSlots).find((s) => ctx.linkSlots![s] === hex) : undefined;
  return slot ? `{color.semantic.${slot}}` : fg;
}

/** `$tint`: link the row's linear `grad` to a colour token, recolouring its stops now when the tokens are here. */
function tintRow(ctx: Ctx, out: Rec, tint: unknown, at: (key: string) => string): void {
  const ref = typeof tint === 'string' ? (isAlias(tint) ? `{${aliasPath(tint)!.trim()}}` : `{${tint.trim()}}`) : '';
  if (!isAlias(ref)) throw new Error(`${at('$tint')}: expected a colour token, {path} or path.`);
  if (typeof out.grad !== 'string' || !out.grad.trim()) throw new Error(`${at('$tint')}: $tint recolours the row's grad; give the row a linear grad.`);
  if (tintGradientSpec(out.grad, '#000000') === null) throw new Error(`${at('grad')}: $tint recolours a linear gradient only; this grad is not one.`);
  const links = readBlockTokenBindings(out.tokenLinks);
  const runs = readBlockRunBindings(out.tokenLinks);
  let value = out.grad;
  let status: 'linked' | 'unresolved' = 'unresolved';
  if (ctx.tokens) {
    const entry = ctx.tokens.get(aliasPath(ref)!);
    const hex = entry && entry.type === 'color' ? hexOf(String(entry.value)) : undefined;
    if (!hex) throw new Error(`${at('$tint')}: ${ref} ${entry ? 'is not a plain colour' : 'does not resolve in the brand tokens'}.`);
    value = tintGradientSpec(out.grad, hex)!;
    status = 'linked';
  } else ctx.deferred.push(at('$tint'));
  out.grad = value;
  links.grad = { ref, value, status, mode: 'tint' };
  const all: Rec = { ...links };
  if (Object.keys(runs).length) all.__runs = runs;
  out.tokenLinks = canonicalJson(all);
}

/** Colour references in a lowered row to literals plus links, or left for the runtime without tokens. */
function lowerColours(ctx: Ctx, row: Rec, at: (key: string) => string): Rec {
  if (!hasDesignColourRefs([row as InputValue], COLOUR_FIELDS, 'tokenLinks', false)) return row;
  if (!ctx.tokens) {
    ctx.deferred.push(at(COLOUR_FIELDS.find((f) => typeof row[f] === 'string' && (String(row[f]).trimStart().startsWith('{') || String(row[f]).includes('--brand-token-'))) ?? 'text'));
    return row;
  }
  const fail = (issue: DesignColourRefIssue): never => {
    const key = issue.pointer.replace(/^\/0\//, '');
    throw new Error(`${at(key)}: ${issue.message.replace(/; the [^;]*\.$/, '.')}`);
  };
  return normaliseDesignColourRefs([row as InputValue], COLOUR_FIELDS, ctx.tokens, 'srgb', { refresh: false, onIssue: fail })[0] as Rec;
}

// ─── macros ──────────────────────────────────────────────────────────────────

/** A row a macro made. `keyAt(key)` points at where each key was written: the item that said it, or the template. */
interface Generated { row: Rec; pointer: string; placed: Placement; keyAt?: (key: string) => string }

function macroKeyOf(row: Rec): MacroKey | null {
  const found = MACRO_KEYS.filter((k) => row[k] !== undefined);
  return found.length ? found[0]! : null;
}

function checkMacroRow(row: Rec, key: MacroKey, pointer: string): void {
  const others = MACRO_KEYS.filter((k) => k !== key && row[k] !== undefined);
  if (others.length) throw new Error(`${pointer}/${others[0]}: a macro row holds exactly one of $stack, $grid and $table.`);
  for (const k of Object.keys(row)) {
    if (k !== 'id' && k !== '$in' && k !== key)
      throw new Error(`${pointer}/${seg(k)}: a macro row holds only id, $in and ${key}; put row fields in the templates.`);
  }
  if (row.id !== undefined && (typeof row.id !== 'string' || !row.id)) throw new Error(`${pointer}/id: expected a non-empty string.`);
  if (!record(row[key])) throw new Error(`${pointer}/${key}: expected an object.`);
}

/** Refuses what a template, an item override or a divider may not say. */
function checkRowPart(part: Rec, pointer: string, what: string): void {
  for (const k of ['$in', '$artboard', ...MACRO_KEYS]) {
    if (part[k] !== undefined) throw new Error(`${pointer}/${k}: ${what} takes the macro's $in and cannot hold ${k}.`);
  }
  if (part.z !== undefined) throw new Error(`${pointer}/z: a macro never writes z (it is depth, not stacking order); rows are painted in the order they expand.`);
  if (part.role !== undefined) throw new Error(`${pointer}/role: a macro never writes role (it binds a layer to a master slot).`);
  if (part.frame !== undefined) throw new Error(`${pointer}/frame: a macro row's artboard comes from its $in.`);
  if (typeof part.group === 'string' && part.group.startsWith('narration:'))
    throw new Error(`${pointer}/group: "narration:" groups belong to the narration tool.`);
}

function checkTemplate(t: unknown, p: string): Rec {
  if (!record(t)) throw new Error(`${p}: a template is an object of row fields.`);
  checkRowPart(t, p, 'a template');
  if (t.slot !== undefined && (typeof t.slot !== 'string' || !t.slot)) throw new Error(`${p}/slot: expected a non-empty string.`);
  if (t.at !== undefined && t.at !== 'item' && t.at !== 'artboard') throw new Error(`${p}/at: expected item or artboard.`);
  return t;
}

function templatesAt(value: unknown, pointer: string): Rec[] {
  if (!Array.isArray(value) || !value.length) throw new Error(`${pointer}: expected a non-empty array of row templates.`);
  const slots = new Set<string>();
  return value.map((t, i) => {
    const template = checkTemplate(t, `${pointer}/${i}`);
    if (typeof template.slot === 'string') {
      if (slots.has(template.slot)) throw new Error(`${pointer}/${i}/slot: slot "${template.slot}" is named twice.`);
      slots.add(template.slot);
    }
    return template;
  });
}

const fillId = (id: string, vars: Record<string, number>): string =>
  id.replace(/\{([irc])\}/g, (m, k: string) => (vars[k] !== undefined ? String(vars[k]) : m));

/**
 * The rows one item makes from its templates. `slotValueOf(k)` is what the item says
 * about template k: undefined keeps the template, null leaves it out, a string fills
 * its content and an object overrides its fields.
 */
function slotRows(
  templates: Rec[], templatePointer: (k: number) => string, slotValueOf: (k: number) => { value: unknown; pointer: string } | undefined,
  vars: Record<string, number>, macroId: string | undefined, inId: unknown, offset: Point, defaultW: number | undefined,
): Generated[] {
  const out: Generated[] = [];
  templates.forEach((template, k) => {
    const said = slotValueOf(k);
    if (said && said.value === null) return;
    const pointer = said ? said.pointer : templatePointer(k);
    const row: Rec = { ...template };
    for (const meta of TEMPLATE_META) delete row[meta];
    // The key a string item fills, and the keys an object item states: errors on those
    // name the item, and errors on every other key name the template.
    let filled: string | undefined;
    if (said && typeof said.value === 'string') {
      const kind = kindOf(template) ?? 'box';
      filled = kind === 'text' ? 'text' : kind === 'path' ? '$d' : kind === 'image' ? 'image' : undefined;
      if (!filled) throw new Error(`${pointer}: a ${kind} slot cannot take a string; give it an object of fields.`);
      row[filled] = said.value;
    } else if (said && record(said.value)) {
      checkRowPart(said.value, pointer, 'an item');
      for (const meta of TEMPLATE_META) if (meta !== 'at' && said.value[meta] !== undefined) throw new Error(`${pointer}/${meta}: an item cannot rename a slot.`);
      Object.assign(row, said.value);
      delete row.at;
    } else if (said && said.value !== undefined) {
      throw new Error(`${pointer}: a slot value is a string, null or an object of fields.`);
    }
    const stated = said && record(said.value) ? said.value : undefined;
    const keyAt = (key: string): string =>
      key === filled ? said!.pointer
        : stated && Object.hasOwn(stated, key) ? `${said!.pointer}/${seg(key)}`
          : `${templatePointer(k)}/${seg(key)}`;
    const at = (stated && stated.at !== undefined ? stated.at : template.at) ?? 'item';
    if (at !== 'item' && at !== 'artboard') throw new Error(`${keyAt('at')}: expected item or artboard.`);
    let id = row.id;
    if (id === undefined) {
      if (!macroId || typeof template.slot !== 'string')
        throw new Error(`${templatePointer(k)}/id: a template needs an id (with {i}), or give the macro an id and the template a slot.`);
      id = `${macroId}-${template.slot}{i}`;
    }
    if (typeof id !== 'string' || !id) throw new Error(`${keyAt('id')}: expected a non-empty string.`);
    row.id = fillId(id, vars);
    if (inId !== undefined) row.$in = inId;
    out.push({ row, pointer, placed: { offset, at, ...(defaultW !== undefined ? { defaultW } : {}) }, keyAt });
  });
  return out;
}

/** What an item says per template: a string fills the first text slot; an object maps slot names. */
function itemValues(templates: Rec[], item: unknown, pointer: string): (k: number) => { value: unknown; pointer: string } | undefined {
  if (typeof item === 'string') {
    const k = templates.findIndex((t) => kindOf(t) === 'text');
    if (k < 0) throw new Error(`${pointer}: a string item needs a text template to fill.`);
    return (i) => (i === k ? { value: item, pointer } : undefined);
  }
  if (!record(item)) throw new Error(`${pointer}: an item is a string or an object of slot values.`);
  const bySlot = new Map(templates.map((t, k) => [t.slot, k]));
  for (const key of Object.keys(item)) {
    if (!bySlot.has(key)) throw new Error(`${pointer}/${seg(key)}: no template has slot "${key}".`);
  }
  return (k) => {
    const slot = templates[k]!.slot;
    return typeof slot === 'string' && Object.hasOwn(item, slot) ? { value: item[slot], pointer: `${pointer}/${seg(slot)}` } : undefined;
  };
}

/** A straight divider row in the macro's space. */
function dividerRow(
  divider: Rec, pointer: string, macroId: string | undefined, inId: unknown, vars: Record<string, number>,
  from: Point, to: Point,
): Generated {
  const { id, x: _x, y: _y, w: _w, h: _h, dx: _dx, dy: _dy, ...paint } = divider;
  const template = id ?? (macroId ? `${macroId}-divider{i}` : undefined);
  if (typeof template !== 'string' || !template) throw new Error(`${pointer}/id: a divider needs an id (with {i}), or give the macro an id.`);
  const row: Rec = { ...paint, id: fillId(template, vars), kind: 'path', $points: [[from.x, from.y], [to.x, to.y]] };
  if (inId !== undefined) row.$in = inId;
  return { row, pointer, placed: { offset: { x: 0, y: 0 }, at: 'artboard' } };
}

function checkDivider(value: unknown, pointer: string, across?: 'y' | 'x'): Rec | undefined {
  if (value === undefined) return undefined;
  if (!record(value)) throw new Error(`${pointer}: a divider is an object.`);
  checkRowPart(value, pointer, 'a divider');
  for (const k of Object.keys(value)) {
    if (k.startsWith('$') || k === 'kind' || k === 'path' || k === 'slot' || k === 'at')
      throw new Error(`${pointer}/${seg(k)}: a divider is a straight rule; give its id, place (x, y, w, h, dx, dy) and paint only.`);
  }
  // A place key the macro does not read would be dropped without a word (plan 291 M4).
  const unread = across === 'y' ? ['y', 'h', 'dx'] : across === 'x' ? ['x', 'w', 'dy'] : [];
  for (const k of unread) {
    if (value[k] === undefined) continue;
    throw new Error(across === 'y'
      ? `${pointer}/${k}: a divider between rows is placed by x, w and dy; dy moves it down from the top of each row, and ${k} does not apply.`
      : `${pointer}/${k}: a divider between columns is placed by y, h and dx; dx moves it across from the left of each item, and ${k} does not apply.`);
  }
  return value;
}

function expandStack(row: Rec, pointer: string, guard: (count: number) => void): Generated[] {
  const p = `${pointer}/$stack`;
  const s = row.$stack as Rec;
  const macroId = row.id as string | undefined;
  const x = optionalNumber(s.x, `${p}/x`, 0)!;
  const y = optionalNumber(s.y, `${p}/y`, 0)!;
  const w = optionalNumber(s.w, `${p}/w`);
  const h = optionalNumber(s.h, `${p}/h`);
  const pitch = numberAt(s.pitch, `${p}/pitch`);
  const axis = s.axis ?? 'y';
  if (axis !== 'y' && axis !== 'x') throw new Error(`${p}/axis: expected y or x.`);
  const templates = templatesAt(s.item, `${p}/item`);
  if (!Array.isArray(s.items)) throw new Error(`${p}/items: expected an array of items.`);
  const divider = checkDivider(s.divider, `${p}/divider`, axis);
  const out: Generated[] = [];
  s.items.forEach((item, i) => {
    const origin = axis === 'y' ? { x, y: y + i * pitch } : { x: x + i * pitch, y };
    const vars = { i };
    if (divider && i > 0) {
      const dp = `${p}/divider`;
      if (axis === 'y') {
        const len = optionalNumber(divider.w, `${dp}/w`, w);
        if (len === undefined) throw new Error(`${dp}/w: a divider needs a length; give the stack or the divider a w.`);
        const x0 = optionalNumber(divider.x, `${dp}/x`, origin.x)!;
        const y0 = origin.y + optionalNumber(divider.dy, `${dp}/dy`, 0)!;
        out.push(dividerRow(divider, dp, macroId, row.$in, vars, { x: x0, y: y0 }, { x: x0 + len, y: y0 }));
      } else {
        const len = optionalNumber(divider.h, `${dp}/h`, h);
        if (len === undefined) throw new Error(`${dp}/h: a divider needs a length; give the stack or the divider an h.`);
        const y0 = optionalNumber(divider.y, `${dp}/y`, origin.y)!;
        const x0 = origin.x + optionalNumber(divider.dx, `${dp}/dx`, 0)!;
        out.push(dividerRow(divider, dp, macroId, row.$in, vars, { x: x0, y: y0 }, { x: x0, y: y0 + len }));
      }
    }
    out.push(...slotRows(templates, (k) => `${p}/item/${k}`, itemValues(templates, item, `${p}/items/${i}`), vars, macroId, row.$in, origin, axis === 'y' ? w : undefined));
    guard(out.length);
  });
  return out;
}

function expandGrid(row: Rec, pointer: string, guard: (count: number) => void): Generated[] {
  const p = `${pointer}/$grid`;
  const g = row.$grid as Rec;
  const macroId = row.id as string | undefined;
  const x = optionalNumber(g.x, `${p}/x`, 0)!;
  const y = optionalNumber(g.y, `${p}/y`, 0)!;
  const columns = numberAt(g.columns, `${p}/columns`, { min: 1, integer: true });
  const colWidth = numberAt(g.colWidth, `${p}/colWidth`);
  const colGap = optionalNumber(g.colGap, `${p}/colGap`, 0)!;
  const rowPitch = numberAt(g.rowPitch, `${p}/rowPitch`);
  const order = g.order ?? 'row';
  if (order !== 'row' && order !== 'column') throw new Error(`${p}/order: expected row or column.`);
  const templates = templatesAt(g.cell, `${p}/cell`);
  if (!Array.isArray(g.items)) throw new Error(`${p}/items: expected an array of items.`);
  const n = g.items.length;
  const rows = g.rows === undefined ? Math.max(1, Math.ceil(n / columns)) : numberAt(g.rows, `${p}/rows`, { min: 1, integer: true });
  if (n > rows * columns) throw new Error(`${p}/items: ${n} items do not fit ${rows} rows of ${columns} columns.`);
  const out: Generated[] = [];
  g.items.forEach((item, i) => {
    const r = order === 'row' ? Math.floor(i / columns) : i % rows;
    const c = order === 'row' ? i % columns : Math.floor(i / rows);
    const origin = { x: x + c * (colWidth + colGap), y: y + r * rowPitch };
    out.push(...slotRows(templates, (k) => `${p}/cell/${k}`, itemValues(templates, item, `${p}/items/${i}`), { i, r, c }, macroId, row.$in, origin, colWidth));
    guard(out.length);
  });
  return out;
}

interface TableColumn { offset: Point; templates: Rec[]; composite: boolean; pointerOf: (k: number) => string }

function expandTable(row: Rec, pointer: string, guard: (count: number) => void): Generated[] {
  const p = `${pointer}/$table`;
  const t = row.$table as Rec;
  const macroId = row.id as string | undefined;
  const x = optionalNumber(t.x, `${p}/x`, 0)!;
  const y = optionalNumber(t.y, `${p}/y`, 0)!;
  const pitch = numberAt(t.pitch, `${p}/pitch`);
  if (!Array.isArray(t.columns) || !t.columns.length) throw new Error(`${p}/columns: expected a non-empty array of columns.`);
  const columns: TableColumn[] = t.columns.map((col, c) => {
    const cp = `${p}/columns/${c}`;
    if (!record(col)) throw new Error(`${cp}: a column is a template or an object with cell templates.`);
    if (col.cell !== undefined) {
      for (const k of Object.keys(col)) if (!['x', 'y', 'cell'].includes(k)) throw new Error(`${cp}/${seg(k)}: a column with cell templates holds only x, y and cell.`);
      return {
        offset: { x: optionalNumber(col.x, `${cp}/x`, 0)!, y: optionalNumber(col.y, `${cp}/y`, 0)! },
        templates: templatesAt(col.cell, `${cp}/cell`), composite: true, pointerOf: (k: number) => `${cp}/cell/${k}`,
      };
    }
    return { offset: { x: 0, y: 0 }, templates: [checkTemplate(col, cp)], composite: false, pointerOf: () => cp };
  });
  const label = t.label === undefined ? undefined : [checkTemplate(t.label, `${p}/label`)];
  if (!Array.isArray(t.rows)) throw new Error(`${p}/rows: expected an array of rows.`);
  const divider = checkDivider(t.divider, `${p}/divider`, 'y');
  // A divider spans the label and the columns unless it says otherwise.
  const spans = [...(label ? [{ offset: { x: 0, y: 0 }, templates: label }] : []), ...columns].flatMap((col) => col.templates.map((tpl) => {
    const left = col.offset.x + (Number(tpl.x) || 0);
    return { left, right: tpl.w === undefined ? NaN : left + Number(tpl.w) };
  }));
  const spanLeft = x + Math.min(...spans.map((s) => s.left));
  const spanRight = x + Math.max(...spans.map((s) => s.right));
  const out: Generated[] = [];
  t.rows.forEach((value, r) => {
    const rp = `${p}/rows/${r}`;
    let cells: unknown[];
    let labelValue: unknown;
    let cellsPointer = rp;
    if (Array.isArray(value)) cells = value;
    else if (record(value) && Array.isArray(value.cells)) {
      for (const k of Object.keys(value)) if (k !== 'label' && k !== 'cells') throw new Error(`${rp}/${seg(k)}: a row holds label and cells.`);
      cells = value.cells;
      labelValue = value.label;
      cellsPointer = `${rp}/cells`;
    } else throw new Error(`${rp}: a row is an array of cells, or an object with label and cells.`);
    if (cells.length > columns.length) throw new Error(`${cellsPointer}/${columns.length}: the row has ${cells.length} cells for ${columns.length} columns.`);
    if (labelValue !== undefined && !label) throw new Error(`${rp}/label: the table has no label template.`);
    const origin = { x, y: y + r * pitch };
    if (divider && r > 0) {
      const dp = `${p}/divider`;
      const x0 = optionalNumber(divider.x, `${dp}/x`, spanLeft)!;
      const len = optionalNumber(divider.w, `${dp}/w`, Number.isFinite(spanRight) ? spanRight - x0 : undefined);
      if (len === undefined) throw new Error(`${dp}/w: a divider needs a length; give it a w, or give every column template a w.`);
      const y0 = origin.y + optionalNumber(divider.dy, `${dp}/dy`, 0)!;
      out.push(dividerRow(divider, dp, macroId, row.$in, { i: r, r }, { x: x0, y: y0 }, { x: x0 + len, y: y0 }));
    }
    if (label) {
      out.push(...slotRows(label, () => `${p}/label`, () => (labelValue === undefined ? undefined : { value: labelValue, pointer: `${rp}/label` }),
        { i: r, r }, macroId, row.$in, origin, undefined));
    }
    columns.forEach((col, c) => {
      const cell = cells[c];
      if (cell === undefined || cell === null) return;
      const cp = `${cellsPointer}/${c}`;
      const vars = { i: r, r, c };
      const at = { x: origin.x + col.offset.x, y: origin.y + col.offset.y };
      const slotValueOf = col.composite ? itemValues(col.templates, cell, cp) : () => ({ value: cell, pointer: cp });
      out.push(...slotRows(col.templates, col.pointerOf, slotValueOf, vars, macroId, row.$in, at, undefined));
    });
    guard(out.length);
  });
  return out;
}

/**
 * Each macro calls `guard(n)` after every item with the rows it has made so far; the
 * guard throws once they would take the call past its cap, so a huge product of items
 * and templates is refused long before it is built.
 */
function expandMacro(row: Rec, key: MacroKey, pointer: string, guard: (count: number) => void): Generated[] {
  return key === '$stack' ? expandStack(row, pointer, guard) : key === '$grid' ? expandGrid(row, pointer, guard) : expandTable(row, pointer, guard);
}

// ─── public ──────────────────────────────────────────────────────────────────

/** True when a value carries authoring: a `$` key on a row, document, `layer` or `set`, or such a row in a list. */
export function hasDesignAuthoring(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((v) => hasDesignAuthoring(v));
  if (!record(value)) return false;
  if (Object.keys(value).some((k) => k.startsWith('$'))) return true;
  for (const key of ['boxes', 'values', 'inputs', 'layer', 'set', 'layerOperations', 'layerPatches']) {
    if (value[key] !== undefined && hasDesignAuthoring(value[key])) return true;
  }
  return false;
}

function themePointerFor(pointer: string): string {
  return pointer.endsWith('/boxes') ? `${pointer.slice(0, -'/boxes'.length)}/$theme` : '/$theme';
}

function finishNotes(ctx: Ctx): DesignAuthoringNote[] {
  const notes = [...ctx.notes];
  if (ctx.derived.length) {
    notes.push({
      path: ctx.derived[0]!, code: 'authoring.fg.derived',
      message: `${ctx.derived.length} text row${ctx.derived.length === 1 ? '' : 's'} took black or white by contrast with their own fill or their artboard's, because no style or brief theme gave a colour.`,
    });
  }
  if (ctx.unknownGround.length) {
    const n = ctx.unknownGround.length;
    notes.push({
      path: ctx.unknownGround[0]!, code: 'authoring.fg.ground',
      message: `${n} text row${n === 1 ? '' : 's'} took black without a contrast check: no style or brief theme gave a colour, and neither ${n === 1 ? 'its' : 'their'} own fill nor ${n === 1 ? 'its' : 'their'} artboard's is a colour that can be read. Give ${n === 1 ? 'it' : 'them'} an fg or a style with one.`,
    });
  }
  if (ctx.deferred.length) {
    const n = ctx.deferred.length;
    notes.push({
      path: ctx.deferred[0]!, code: 'authoring.colour.deferred',
      message: `${n} row${n === 1 ? '' : 's'} name${n === 1 ? 's' : ''} a colour token, and no brand tokens were supplied here, so ${n === 1 ? 'it was' : 'they were'} left as written; the runtime resolves ${n === 1 ? 'it' : 'them'} when the document opens.`,
    });
  }
  if (ctx.lowContrast.length) {
    notes.push({
      path: ctx.lowContrast[0]!, code: 'authoring.fg.contrast',
      message: `${ctx.lowContrast.length} text row${ctx.lowContrast.length === 1 ? '' : 's'} took a style or theme text colour that reads below 3:1 on their own fill or their artboard's; give them a style or an fg.`,
    });
  }
  return notes;
}

/**
 * The expansion behind the public calls; `pointerOf(i)` names input row i. `before` is
 * the number of rows the call already holds outside `rows` (the document a layer
 * operation adds to), so the cap bounds the whole call, every operation together.
 * With `shared`, the context of a call that expands piece by piece: its frames are
 * refreshed here, and its notes are left for the caller to finish once.
 */
function expandRows(rows: readonly unknown[], opts: DesignAuthoringOptions, base: string, pointerOf: (index: number) => string, before = 0, shared?: Ctx): DesignAuthoringResult {
  const max = opts.maxRows ?? MAX_ROWS;
  const over = (pointer: string): Error => new Error(before
    ? `${pointer}: the expansion takes the call past the cap of ${max} rows (the document already holds ${before}).`
    : `${pointer}: the expansion gives more than the cap of ${max} rows.`);
  // A stored row is lowered only for a colour reference, and only when the tokens are here.
  const refsIn = (row: unknown): boolean => !!opts.tokens && record(row) && hasDesignColourRefs([row as InputValue], COLOUR_FIELDS, 'tokenLinks', false);
  if (!rows.some((row) => hasDollar(row) || refsIn(row))) {
    if (before + rows.length > max) throw new Error(`${base || '/'}: ${before + rows.length} rows is more than the cap of ${max}.`);
    return { rows: rows.slice() as Rec[], notes: [], expanded: false };
  }
  if (shared) shared.frames = collectFrames(rows, opts.existing);
  const ctx = shared ?? makeCtx(rows, opts, themePointerFor(base));
  const out: Rec[] = [];
  // Each authored row with the pointers of the row and of the key its id came from.
  const authored = new Map<Rec, { row: string; id: string }>();
  const push = (row: Rec, pointer: string | null, idPointer?: string): void => {
    if (before + out.length >= max) throw over(pointer ?? (base || '/'));
    out.push(row);
    if (pointer !== null) authored.set(row, { row: pointer, id: idPointer ?? `${pointer}/id` });
  };
  rows.forEach((row, index) => {
    const pointer = pointerOf(index);
    if (!hasDollar(row)) {
      push(refsIn(row) ? lowerColours(ctx, row as Rec, (key) => `${pointer}/${seg(key)}`) : row as Rec, null);
      return;
    }
    const macro = macroKeyOf(row);
    if (!macro) {
      push(lowerRow(ctx, row, pointer, null), pointer);
      return;
    }
    checkMacroRow(row, macro, pointer);
    if (row.$in !== undefined) frameOrigin(ctx, row.$in, `${pointer}/$in`);
    const generated = expandMacro(row, macro, pointer, (count) => {
      if (before + out.length + count > max) throw over(pointer);
    });
    if (before + out.length + generated.length > max) throw over(pointer);
    for (const g of generated) push(lowerRow(ctx, g.row, g.pointer, g.placed, g.keyAt), g.pointer, g.keyAt?.('id'));
  });

  // Ids: an authored row may not reuse an id the document or another authored row has.
  const stored = new Set<unknown>();
  for (const row of [...out.filter((r) => !authored.has(r)), ...(opts.existing ?? [])]) if (record(row) && row.id !== undefined) stored.add(row.id);
  const seen = new Map<unknown, { row: string; id: string }>();
  for (const [row, at] of authored) {
    if (row.id === undefined) continue;
    if (stored.has(row.id)) throw new Error(`${at.row}/id: layer "${String(row.id)}" already exists.`);
    const other = seen.get(row.id);
    if (other !== undefined && other.id === at.id) {
      // One template id written for every item, with no {i}, {r} or {c}: the ids repeat.
      throw new Error(`${at.id}: every item gets the id "${String(row.id)}"; put {i} (or {r} and {c}) in the template id so each item gets its own.`);
    }
    if (other !== undefined) throw new Error(`${at.row}/id: layer "${String(row.id)}" is also written by ${other.row}.`);
    seen.set(row.id, at);
  }
  return { rows: out, notes: shared ? [] : finishNotes(ctx), expanded: true };
}

/**
 * Rows (stored or authored) to stored rows. Pure, synchronous, all or nothing; throws
 * Error('<json pointer>: message'). Stored rows are returned as the same objects.
 */
export function expandDesignAuthoring(rows: readonly unknown[], opts: DesignAuthoringOptions = {}): DesignAuthoringResult {
  const base = opts.pointer ?? '';
  if (!Array.isArray(rows)) throw new Error(`${base || '/'}: expected an array of Design rows.`);
  return expandRows(rows, opts, base, (index) => `${base}/${index}`);
}

/**
 * The accepted document shapes (a rows array, `{boxes}`, `{values:{boxes}}`, a saved
 * session) plus the top-level authoring inputs `$styles` and `$theme`, which are
 * stripped. `values` keeps every other input as it was, with `boxes` expanded. An
 * explicit `opts.theme` wins over the document's `$theme`; the document's `$styles`
 * win over `opts.styles` id by id.
 */
export function expandDesignAuthoringDocument(
  doc: unknown,
  opts: Omit<DesignAuthoringOptions, 'styles' | 'theme'> & { styles?: Record<string, DesignTextStyleV1>; theme?: string } = {},
): { values: Record<string, unknown>; rows: Record<string, unknown>[]; notes: DesignAuthoringNote[]; expanded: boolean } {
  if (Array.isArray(doc)) {
    const r = expandDesignAuthoring(doc, { ...opts, pointer: opts.pointer ?? '' });
    return { values: { boxes: r.rows }, ...r };
  }
  if (!record(doc)) throw new Error('/: a Design document is a rows array, an object with boxes, or Design input values.');
  const holder = record(doc.values) ? doc.values : doc;
  const at = holder === doc ? '' : '/values';
  let boxes: unknown = holder.boxes;
  if (typeof boxes === 'string') {
    try {
      boxes = JSON.parse(boxes);
    } catch {
      throw new Error(`${at}/boxes: the boxes text is not JSON.`);
    }
  }
  if (!Array.isArray(boxes)) throw new Error(`${at}/boxes: a Design document needs a boxes array.`);
  const pick = (key: (typeof DOC_KEYS)[number]): { value: unknown; pointer: string } =>
    holder[key] !== undefined ? { value: holder[key], pointer: `${at}/${key}` } : { value: doc[key], pointer: `/${key}` };
  const styles = pick('$styles');
  const theme = pick('$theme');
  const themes = pick('$themes');
  if (themes.value !== undefined && themes.value !== 'all' && !(Array.isArray(themes.value) && themes.value.length > 0 && themes.value.length <= 16 && themes.value.every((n) => typeof n === 'string' && n)))
    throw new Error(`${themes.pointer}: expected "all" or a list of theme names.`);
  const docStyles: Record<string, DesignTextStyleV1> = {};
  if (styles.value !== undefined) {
    if (!record(styles.value)) throw new Error(`${styles.pointer}: expected an object of named text styles.`);
    for (const [id, style] of Object.entries(styles.value)) docStyles[id] = assertTextStyle(style, `${styles.pointer}/${seg(id)}`);
  }
  if (theme.value !== undefined && (typeof theme.value !== 'string' || !theme.value)) throw new Error(`${theme.pointer}: expected a theme name.`);
  const r = expandDesignAuthoring(boxes, {
    ...opts,
    styles: { ...(opts.styles ?? {}), ...docStyles },
    ...(opts.theme !== undefined ? { theme: opts.theme } : theme.value !== undefined ? { theme: theme.value as string } : {}),
    ...(opts.themes === undefined && themes.value !== undefined ? { themes: themes.value as string[] | 'all' } : {}),
    pointer: `${at}/boxes`,
  });
  const values: Rec = {};
  for (const [key, value] of Object.entries(holder)) if (!(DOC_KEYS as readonly string[]).includes(key)) values[key] = value;
  values.boxes = r.rows;
  const stripped = DOC_KEYS.some((k) => holder[k] !== undefined || doc[k] !== undefined);
  return { values, rows: r.rows, notes: r.notes, expanded: r.expanded || stripped };
}

/** Rewrites the pointer `applyLayerOperations` / `applyLayerPatches` gave for a one-op call. */
function rethrowAt(err: unknown, from: RegExp, to: string): never {
  const message = err instanceof Error ? err.message : String(err);
  throw new Error(from.test(message) ? message.replace(from, to) : message);
}

/**
 * Expand each `add.layer`, then call the unchanged `applyLayerOperations` one original
 * operation at a time, rewriting error pointers to the caller's indices. An add that
 * expands to several rows appends them in paint order and may not carry `beforeId` or
 * `afterId`. The row cap holds for the whole call: an authored add is refused, at its
 * own pointer, once the document it adds to would hold more than `maxRows` rows.
 */
export function applyAuthoredLayerOperations(
  rows: readonly Record<string, unknown>[],
  ops: unknown,
  fieldDefault: (field: string, fallback?: unknown) => unknown = (_field, fallback) => fallback,
  opts: DesignAuthoringOptions & { pointer?: string } = {},
): { rows: Record<string, unknown>[]; notes: DesignAuthoringNote[] } {
  const base = opts.pointer ?? '/layerOperations';
  const defaults = (field: string, fallback: unknown): unknown => {
    const v = fieldDefault(field, fallback);
    return v === undefined ? fallback : v;
  };
  if (!Array.isArray(ops)) {
    if (base === '/layerOperations') applyLayerOperations(rows, ops, defaults);
    throw new Error(`${base}: layerOperations must be an array.`);
  }
  let current = rows.slice() as Rec[];
  const notes: DesignAuthoringNote[] = [];
  // One context for the whole call, so a document-level note is given once and the
  // per-row counts are totalled over every operation.
  let ctx: Ctx | undefined;
  ops.forEach((op, index) => {
    const at = `${base}/${index}`;
    let batch: unknown[] = [op];
    if (record(op) && op.op === 'add' && (hasDollar(op.layer) || colourRefsFor(opts, op.layer))) {
      ctx ??= makeCtx([op.layer], { ...opts, existing: current }, themePointerFor(`${at}/layer`));
      const expanded = expandRows([op.layer], { ...opts, existing: current }, `${at}/layer`, () => `${at}/layer`, current.length, ctx);
      notes.push(...expanded.notes);
      const anchored = op.beforeId !== undefined || op.afterId !== undefined;
      if (expanded.rows.length > 1 && anchored) {
        throw new Error(`${at}/${op.beforeId !== undefined ? 'beforeId' : 'afterId'}: this add expands to ${expanded.rows.length} rows, which are appended in paint order; leave out beforeId and afterId and reorder afterwards if needed.`);
      }
      if (expanded.rows.length > 1) {
        // The rows go on as plain adds of op and layer only, so refuse here what the plain add would.
        for (const key of Object.keys(op)) if (!ADD_OP_KEYS.has(key)) throw new Error(`${at}/${seg(key)}: unknown add field.`);
      }
      batch = expanded.rows.length === 1 ? [{ ...op, layer: expanded.rows[0] }] : expanded.rows.map((layer) => ({ op: 'add', layer }));
    }
    try {
      current = applyLayerOperations(current, batch, defaults) as Rec[];
    } catch (err) {
      rethrowAt(err, /^\/layerOperations\/\d+/, at);
    }
  });
  if (ctx) notes.push(...finishNotes(ctx));
  return { rows: current, notes };
}

/** One patch's `set` with its authoring keys lowered against the row it patches. */
function lowerPatchSet(ctx: Ctx, set: Rec, target: Rec, pointer: string): Rec {
  for (const key of dollarKeys(set)) {
    if (!PATCH_KEYS.has(key)) throw new Error(`${pointer}/${seg(key)}: a patch takes only the authoring keys ${[...PATCH_KEYS].join(', ')}.`);
  }
  const kind = typeof set.kind === 'string' ? set.kind : typeof target.kind === 'string' ? target.kind : 'box';
  const isPath = PATH_KEYS.some((k) => set[k] !== undefined);
  if (set.$style !== undefined && kind !== 'text') throw new Error(`${pointer}/$style: only text rows take a text style (this row is kind ${kind}).`);
  if (isPath && kind !== 'path') throw new Error(`${pointer}/${PATH_KEYS.find((k) => set[k] !== undefined)}: path geometry belongs on kind path rows (this row is kind ${kind}).`);
  const frameId = set.frame ?? target.frame;
  let origin: Point = { x: 0, y: 0 };
  if (set.$in !== undefined) {
    if (set.$in !== frameId) throw new Error(`${pointer}/$in: the layer is in artboard "${String(frameId ?? '')}"; move it with a reparent operation, then patch it in its artboard.`);
    origin = frameOrigin(ctx, set.$in, `${pointer}/$in`).origin;
  }
  const frame = typeof frameId === 'string' ? ctx.frames.get(frameId) : undefined;
  const out: Rec = {};
  for (const [key, value] of Object.entries(set)) if (!key.startsWith('$')) out[key] = value;
  if (isPath) {
    Object.assign(out, placePath(ctx, set, origin, { ...target, ...out }, (key) => `${pointer}/${seg(key)}`));
  } else if (set.$in !== undefined) {
    if (set.x !== undefined) out.x = tidy(origin.x + numberAt(set.x, `${pointer}/x`));
    if (set.y !== undefined) out.y = tidy(origin.y + numberAt(set.y, `${pointer}/y`));
  }
  if (set.$style !== undefined) {
    const ownBg = out.bg !== undefined ? out.bg : target.bg;
    const { style } = resolvedTextFields(ctx, set.$style, frame, ownBg, pointer, `${pointer}/$style`);
    for (const key of STYLE_ROW_FIELDS) if (out[key] === undefined && style[key] !== undefined) out[key] = style[key];
    if (style.italic === true) out.text = italicText(out.text ?? target.text, `${pointer}/$style`);
    if (set.fg === undefined) checkContrast(ctx, out.fg, frame, ownBg, pointer);
  }
  if (kind === 'text' && typeof out.weight === 'number') out.weight = String(out.weight);
  // Colours (plan 291 W4): lowered on the row as it will be, so the links merge with the row's own.
  const merged: Rec = { ...target, ...out };
  if (set.$tint !== undefined || colourRefsFor(ctx, merged)) {
    const keyAt = (key: string): string => `${pointer}/${seg(key)}`;
    if (set.$tint !== undefined) tintRow(ctx, merged, set.$tint, keyAt);
    const lowered = lowerColours(ctx, merged, keyAt);
    for (const key of [...COLOUR_FIELDS, 'grad', 'text', 'tokenLinks']) if (lowered[key] !== target[key] || out[key] !== undefined) {
      if (lowered[key] !== undefined) out[key] = lowered[key];
    }
  }
  return out;
}

/** True when a row holds a colour reference the expansion can lower now (the tokens are here). */
function colourRefsFor(holder: { tokens?: TokenSet | null }, row: unknown): boolean {
  return !!holder.tokens && record(row) && hasDesignColourRefs([row as InputValue], COLOUR_FIELDS, 'tokenLinks', false);
}

/**
 * Expand each `set` (`$in`, `$style` and the path keys), then call the unchanged
 * `applyLayerPatches` one patch at a time, rewriting error pointers to the caller's
 * indices. A style fills the fields the `set` leaves out, over the row's current
 * values. Patching an artboard's x or y leaves its layers where they are, so that is
 * noted.
 */
export function applyAuthoredLayerPatches(
  rows: readonly Record<string, unknown>[],
  patches: unknown,
  opts: DesignAuthoringOptions & { pointer?: string } = {},
): { rows: Record<string, unknown>[]; notes: DesignAuthoringNote[] } {
  const base = opts.pointer ?? '/layerPatches';
  if (!Array.isArray(patches)) {
    if (base === '/layerPatches') applyLayerPatches(rows, patches);
    throw new Error(`${base}: layerPatches must be an array.`);
  }
  let current = rows.slice() as Rec[];
  const notes: DesignAuthoringNote[] = [];
  // One context for the whole call (its frames refreshed per patch), so notes are given once.
  let ctx: Ctx | undefined;
  patches.forEach((patch, index) => {
    const at = `${base}/${index}`;
    let next: unknown = patch;
    const matches = record(patch) ? current.filter((row) => record(row) && row.id === patch.id) : [];
    const target = matches.length === 1 ? matches[0]! : undefined;
    if (record(patch) && (hasDollar(patch.set) || colourRefsFor(opts, patch.set)) && target) {
      if (ctx) ctx.frames = collectFrames(current, opts.existing);
      else ctx = makeCtx(current, opts, '/$theme');
      next = { ...patch, set: lowerPatchSet(ctx, patch.set as Rec, target, `${at}/set`) };
    }
    if (target && target.kind === 'frame' && record(patch) && record(patch.set) && (patch.set.x !== undefined || patch.set.y !== undefined)) {
      const children = current.filter((row) => record(row) && row.kind !== 'frame' && row.frame === target.id).length;
      if (children) {
        notes.push({ path: `${at}/set`, code: 'authoring.frame.children', message: `Artboard "${String(target.id)}" moved; its ${children} layer${children === 1 ? '' : 's'} keep their canvas position. Move them too, or author them with $in after the move.` });
      }
    }
    try {
      current = applyLayerPatches(current, [next]) as Rec[];
    } catch (err) {
      rethrowAt(err, /^\/layerPatches\/0/, at);
    }
  });
  if (ctx) notes.push(...finishNotes(ctx));
  return { rows: current, notes };
}
