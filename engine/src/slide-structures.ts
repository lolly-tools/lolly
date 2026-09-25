// SPDX-License-Identifier: MPL-2.0
/**
 * The slide layout library (plan 275 section 2).
 *
 * A structure is geometry plus named roles with no design system in it: Three
 * boxes is a title and three cells of a label over a body, wherever a master puts
 * its margins. The library is `community/slide-structures/library.json`, and
 * `scripts/build-slide-masters.ts` turns it into `slide-structures-data.ts` (a
 * TypeScript literal, so the CLI, a worker and the MCP function read it without a
 * catalog fetch) and into every pack's `slides/masters.json`.
 *
 * Four things live here:
 *   - `expandStructure` and `expandRepeat` turn a library entry into placeholders
 *     on a grid. The grid is the master's own (margins, title band, content
 *     band), so one structure is placed in each master's geometry; only the column
 *     arithmetic is shared.
 *   - `archetypeForStructure` is the one place a structure id (what the matcher
 *     names) meets an archetype id (what a plan, a preset and a Design frame hold).
 *   - `darkVariantOf` reads the archetype a slide set to Dark takes.
 *   - `structureSearchIndex` and `searchStructures` answer "4 boxes" and "two
 *     content" with the structures a person means.
 *
 * Pure: no DOM, no clock, no network, no filesystem.
 */

import type {
  ArchetypeIdV1,
  ArchetypeRefV1,
  ArchetypeRepeatV1,
  ArchetypeRoleV1,
  ArchetypeV1,
  MasterBoxV1,
  PlaceholderKindV1,
  PlaceholderLayerV1,
  SlideMasterV1,
} from '@lolly-tools/core';
import { ARCHETYPE_ROLES } from '@lolly-tools/core';

import { SLIDE_STRUCTURE_LIBRARY } from './slide-structures-data.ts';

// ─── the library's shape ─────────────────────────────────────────────────────

/**
 * The grid a structure is expanded on, as fractions of the slide. The library
 * states its own (12 columns, a 0.05 margin); a master states the numbers it was
 * drawn with, and the expansion takes those.
 */
export interface StructureGridV1 {
  marginX: number;
  gutterX: number;
  columns: number;
  titleY: number;
  titleH: number;
  /**
   * A label above the title takes this much of the title band. The title under it
   * keeps the rest of the band and half the gap below it, which on the library grid
   * is `y` 0.11 `h` 0.11.
   */
  kickerH: number;
  /** A subtitle band under the title; the content band then starts below it. */
  subtitleH: number;
  contentY: number;
  contentH: number;
  gutterY: number;
  rows: number;
  /** The gap between the roles a cell is split into, top to bottom. */
  cellGap: number;
  /** Where the furniture zone starts. Content stays above it. */
  furnitureY: number;
}

/** The named bands at the top of a slide a slot can sit in. */
export type StructureBandV1 = 'title' | 'subtitle' | 'kicker' | 'title-after-kicker';

/** One slot of a structure. A slot is placed by `box`, by `band`, or by `c` and `r` on the content grid. */
export interface StructureSlotV1 {
  role: ArchetypeRoleV1;
  kind: PlaceholderKindV1;
  box?: MasterBoxV1;
  /** `[start, span]` on the grid's columns. */
  c?: [number, number];
  /** `[start, span]` on the grid's content rows. */
  r?: [number, number];
  band?: StructureBandV1;
  /** `subtitle` lowers the content band below a subtitle; `no-title` raises it to the top of the title band. */
  shift?: 'subtitle' | 'no-title';
  group?: string;
  fit?: 'contain' | 'cover' | 'fill';
}

export interface SlideStructureV1 {
  id: string;
  section: string;
  name: string;
  /** The nearest of the twelve archetypes, or null when none holds it. */
  mapsTo: ArchetypeIdV1 | null;
  keywords: string[];
  /** A structure drawn on the master's dark ground. */
  dark?: boolean;
  slots?: StructureSlotV1[];
  repeat?: ArchetypeRepeatV1;
  /** The structure this one reflects left to right. */
  mirror?: string;
  /** The geometric signature the matcher reads. Not part of a master. */
  detect: Readonly<Record<string, unknown>>;
}

export interface SlideStructureSectionV1 {
  id: string;
  name: string;
}

export interface SlideStructureLibraryV1 {
  $comment?: string;
  version: number;
  id: string;
  grid: StructureGridV1;
  sections: SlideStructureSectionV1[];
  /** The structures the masters build writes into every pack. */
  expanded: string[];
  structures: SlideStructureV1[];
}

/** The library the engine ships, as the build generated it. Read only: callers copy before editing. */
export function slideStructureLibrary(): SlideStructureLibraryV1 {
  return SLIDE_STRUCTURE_LIBRARY;
}

/** The library entry with this id, or undefined. */
export function findStructure(id: string, library: SlideStructureLibraryV1 = SLIDE_STRUCTURE_LIBRARY): SlideStructureV1 | undefined {
  return library.structures.find((s) => s.id === id);
}

// ─── expansion ───────────────────────────────────────────────────────────────

/** What a structure expands to: placeholders in reading order, and the rule a timeline draws. */
export interface ExpandedStructureV1 {
  placeholders: PlaceholderLayerV1[];
  /** A rule through the row, as fractions of the slide, placed from the cells when the repeat states one. */
  rule?: MasterBoxV1;
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

function roundBox(box: MasterBoxV1): MasterBoxV1 {
  return { x: round4(box.x), y: round4(box.y), w: round4(box.w), h: round4(box.h) };
}

/** Width of one grid column. */
function columnWidth(grid: StructureGridV1): number {
  return (1 - 2 * grid.marginX - (grid.columns - 1) * grid.gutterX) / grid.columns;
}

/** The x and width of `[start, span]` columns. */
function columnSpan(grid: StructureGridV1, span: readonly [number, number]): { x: number; w: number } {
  const cw = columnWidth(grid);
  const [start, count] = span;
  return { x: grid.marginX + start * (cw + grid.gutterX), w: count * cw + (count - 1) * grid.gutterX };
}

/** The content band a slot is placed in: where it starts and how tall it is. */
function contentBand(grid: StructureGridV1, shift?: StructureSlotV1['shift']): { y: number; h: number } {
  const end = grid.contentY + grid.contentH;
  if (shift === 'subtitle') {
    const y = grid.titleY + grid.titleH + grid.subtitleH + grid.gutterY;
    return { y, h: end - y };
  }
  if (shift === 'no-title') return { y: grid.titleY, h: end - grid.titleY };
  return { y: grid.contentY, h: grid.contentH };
}

/** The y and height of `[start, span]` rows of a band cut into `rows` rows. */
function rowSpan(grid: StructureGridV1, band: { y: number; h: number }, rows: number, span: readonly [number, number]): { y: number; h: number } {
  const rh = (band.h - (rows - 1) * grid.gutterY) / rows;
  const [start, count] = span;
  return { y: band.y + start * (rh + grid.gutterY), h: count * rh + (count - 1) * grid.gutterY };
}

function bandBox(grid: StructureGridV1, band: StructureBandV1): { y: number; h: number } {
  switch (band) {
    case 'subtitle': return { y: grid.titleY + grid.titleH, h: grid.subtitleH };
    case 'kicker': return { y: grid.titleY, h: grid.kickerH };
    case 'title-after-kicker': {
      const gap = Math.max(0, grid.contentY - (grid.titleY + grid.titleH));
      return { y: grid.titleY + grid.kickerH, h: grid.titleH - grid.kickerH + gap / 2 };
    }
    default: return { y: grid.titleY, h: grid.titleH };
  }
}

/** Where one slot is placed on this grid. */
function slotBox(grid: StructureGridV1, slot: StructureSlotV1): MasterBoxV1 {
  if (slot.box) return { ...slot.box };
  const { x, w } = columnSpan(grid, slot.c ?? [0, grid.columns]);
  if (slot.band) return { x, w, ...bandBox(grid, slot.band) };
  const { y, h } = rowSpan(grid, contentBand(grid, slot.shift), grid.rows, slot.r ?? [0, grid.rows]);
  return { x, y, w, h };
}

const ROLES: ReadonlySet<string> = new Set(ARCHETYPE_ROLES);

/** One `role:share` entry of a repeat's cell. */
function parseCellPart(part: string): { role: ArchetypeRoleV1; share: number } {
  const colon = part.indexOf(':');
  const role = colon > 0 ? part.slice(0, colon) : '';
  const share = Number(part.slice(colon + 1));
  if (!ROLES.has(role) || !Number.isFinite(share) || share <= 0 || share > 1) {
    throw new Error(`slide-structures: the cell part "${part}" is not role:share`);
  }
  return { role: role as ArchetypeRoleV1, share };
}

function kindOf(role: ArchetypeRoleV1, repeat: ArchetypeRepeatV1): PlaceholderKindV1 {
  if (role === 'visual') return 'image';
  if (role === 'data') return repeat.dataKind ?? 'image';
  return 'text';
}

/**
 * A repeat on a grid: `count` cells, `across` per row, rows of equal height over
 * the content band, each cell split top to bottom by its shares with the grid's
 * cell gap between the parts. A stacked list (`across` 1) takes its cell from
 * `cellCols` and puts a number or an icon in `numberCol` or `iconCol` beside it.
 * Every placeholder of cell `k` carries group `c<k+1>` and index `k`, and the
 * title comes first unless `title` is false.
 */
export function expandRepeat(
  repeat: ArchetypeRepeatV1,
  grid: StructureGridV1,
  opts: { title?: boolean } = {},
): ExpandedStructureV1 {
  const count = Math.max(1, Math.floor(repeat.count));
  const across = Math.max(1, Math.min(count, Math.floor(repeat.across)));
  const rows = Math.ceil(count / across);
  const parts = repeat.cell.map(parseCellPart);
  const total = parts.reduce((sum, p) => sum + p.share, 0);
  const band = contentBand(grid);
  const cellH = (band.h - (rows - 1) * grid.gutterY) / rows;
  const fullW = 1 - 2 * grid.marginX;
  const cellW = (fullW - (across - 1) * grid.gutterX) / across;
  const stacked = across === 1;
  const placeholders: PlaceholderLayerV1[] = [];
  if (opts.title !== false) {
    placeholders.push({ role: 'title', kind: 'text', box: roundBox(slotBox(grid, { role: 'title', kind: 'text', band: 'title' })) });
  }

  for (let k = 0; k < count; k += 1) {
    const row = Math.floor(k / across);
    const col = k % across;
    const y = band.y + row * (cellH + grid.gutterY);
    let x = grid.marginX + col * (cellW + grid.gutterX);
    let w = cellW;
    if (stacked && repeat.cellCols) ({ x, w } = columnSpan(grid, repeat.cellCols));
    const group = `c${k + 1}`;
    const mark = (ph: PlaceholderLayerV1): PlaceholderLayerV1 => ({ ...ph, group, index: k });

    if (stacked && repeat.numberCol) {
      const at = columnSpan(grid, repeat.numberCol);
      placeholders.push(mark({ role: 'number', kind: 'text', box: roundBox({ x: at.x, y, w: at.w, h: cellH }) }));
    }
    if (stacked && repeat.iconCol) {
      const at = columnSpan(grid, repeat.iconCol);
      placeholders.push(mark({ role: 'visual', kind: 'image', fit: 'contain', box: roundBox({ x: at.x, y, w: at.w, h: cellH }) }));
    }

    const usable = cellH - (parts.length - 1) * grid.cellGap;
    let top = y;
    for (const part of parts) {
      const h = (usable * part.share) / total;
      let box: MasterBoxV1 = { x, y: top, w, h };
      const kind = kindOf(part.role, repeat);
      const ph: PlaceholderLayerV1 = { role: part.role, kind, box };
      if (kind === 'image') {
        if (part.role === 'visual' && repeat.inset && repeat.inset > 0) {
          const dx = (w * repeat.inset) / 2;
          const dy = (h * repeat.inset) / 2;
          box = { x: x + dx, y: top + dy, w: w - 2 * dx, h: h - 2 * dy };
          ph.box = box;
        }
        // A small picture in a cell is an icon: it keeps its whole shape.
        ph.fit = repeat.fit ?? (part.role === 'visual' && part.share / total > 0.3 ? 'cover' : 'contain');
      }
      ph.box = roundBox(ph.box);
      placeholders.push(mark(ph));
      top += h + grid.cellGap;
    }
  }

  const out: ExpandedStructureV1 = { placeholders };
  const rule = repeat.rule;
  // The rule's own x or y only says which axis it runs on; the cells place it.
  if (rule && typeof rule.y === 'number') {
    // A rule across the row sits in the gap under the first part of the cells.
    const first = parts[0];
    const firstH = first ? ((cellH - (parts.length - 1) * grid.cellGap) * first.share) / total : 0;
    const h = rule.h ?? 0.004;
    out.rule = roundBox({ x: grid.marginX, y: band.y + firstH + grid.cellGap / 2 - h / 2, w: fullW, h });
  } else if (rule && typeof rule.x === 'number') {
    // A rule down the stack runs through the middle of the first column.
    const w = rule.w ?? 0.004;
    const cw = columnWidth(grid);
    out.rule = roundBox({ x: grid.marginX + cw / 2 - w / 2, y: band.y, w, h: band.h });
  }
  return out;
}

/** Group index by first appearance, so the cells of explicit slots read in order too. */
function indexGroups(placeholders: PlaceholderLayerV1[]): PlaceholderLayerV1[] {
  const order = new Map<string, number>();
  return placeholders.map((ph) => {
    if (ph.group === undefined) return ph;
    let index = order.get(ph.group);
    if (index === undefined) {
      index = order.size;
      order.set(ph.group, index);
    }
    return { ...ph, index };
  });
}

/**
 * A structure's placeholders on a grid, in reading order. A `mirror` expands the
 * structure it reflects and turns every box left to right; a `repeat` goes through
 * `expandRepeat`; slots are placed one by one. Throws on a mirror the library does
 * not hold, because a master with a missing structure is a build error, not a
 * layout to guess at.
 */
export function expandStructure(
  structure: SlideStructureV1,
  grid: StructureGridV1,
  library: SlideStructureLibraryV1 = SLIDE_STRUCTURE_LIBRARY,
): ExpandedStructureV1 {
  if (structure.mirror) {
    const source = findStructure(structure.mirror, library);
    if (!source || source.mirror) {
      throw new Error(`slide-structures: ${structure.id} mirrors "${structure.mirror}", which is not a structure of its own in the library`);
    }
    const expanded = expandStructure(source, grid, library);
    const reflect = (box: MasterBoxV1): MasterBoxV1 => roundBox({ ...box, x: 1 - box.x - box.w });
    const out: ExpandedStructureV1 = { placeholders: expanded.placeholders.map((ph) => ({ ...ph, box: reflect(ph.box) })) };
    if (expanded.rule) out.rule = reflect(expanded.rule);
    return out;
  }
  if (structure.repeat) return expandRepeat(structure.repeat, grid);
  const placeholders = (structure.slots ?? []).map((slot): PlaceholderLayerV1 => {
    const ph: PlaceholderLayerV1 = { role: slot.role, kind: slot.kind, box: roundBox(slotBox(grid, slot)) };
    if (slot.fit) ph.fit = slot.fit;
    else if (slot.kind === 'image') ph.fit = slot.role === 'data' ? 'contain' : 'cover';
    if (slot.group !== undefined) ph.group = slot.group;
    return ph;
  });
  return { placeholders: indexGroups(placeholders) };
}

// ─── structures and archetypes ───────────────────────────────────────────────

/** The library structure an archetype restyles: its `structure`, else its own id. */
export function structureOf(archetype: Pick<ArchetypeV1, 'id' | 'structure'>): string {
  return archetype.structure ?? archetype.id;
}

/** Ids a master names as a variant: some archetype's dark variant, or one that states what it is the variant of. */
function variantIds(master: SlideMasterV1): Set<string> {
  const out = new Set<string>();
  for (const a of master.archetypes) {
    if (a.variants?.dark) out.add(a.variants.dark);
    if (a.variantOf) out.add(a.id);
  }
  return out;
}

/**
 * The archetype of this master that holds a structure: the one whose `structure`
 * equals it (a light archetype before its dark variant), else the one whose id
 * equals it. With `nearest`, a structure the master does not carry falls to the
 * library's `mapsTo`, the nearest of the twelve. Undefined when nothing answers.
 */
export function archetypeForStructure(
  master: SlideMasterV1,
  structureId: string,
  opts: { nearest?: boolean; library?: SlideStructureLibraryV1 } = {},
): ArchetypeV1 | undefined {
  const variants = variantIds(master);
  const byStructure = master.archetypes.filter((a) => structureOf(a) === structureId);
  const found = byStructure.find((a) => !variants.has(a.id)) ?? byStructure[0]
    ?? master.archetypes.find((a) => a.id === structureId);
  if (found || !opts.nearest) return found;
  const mapsTo = findStructure(structureId, opts.library)?.mapsTo;
  return mapsTo ? master.archetypes.find((a) => a.id === mapsTo) : undefined;
}

/** The archetype a slide on this archetype takes when its ground is set to Dark, or undefined. */
export function darkVariantOf(master: SlideMasterV1, archetypeId: ArchetypeRefV1): ArchetypeV1 | undefined {
  const base = master.archetypes.find((a) => a.id === archetypeId);
  const dark = base?.variants?.dark;
  return dark ? master.archetypes.find((a) => a.id === dark) : undefined;
}

// ─── search ──────────────────────────────────────────────────────────────────

const NUMBER_WORDS: Readonly<Record<string, string>> = {
  one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8',
};

/** A plural folded to its singular, crudely: boxes to box, columns to column. */
function stem(token: string): string {
  if (token.length > 3 && /(x|ch|sh|ss)es$/.test(token)) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

/**
 * The search tokens of a text: lower case, split on everything that is not a
 * letter or a digit, number words one to eight as digits, plurals folded. So
 * "4 boxes", "four box" and "columns-4" share the tokens a match needs.
 */
export function searchTokens(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((t) => stem(NUMBER_WORDS[t] ?? t));
}

export interface StructureSearchEntryV1 {
  id: string;
  name: string;
  section: string;
  /** Tokens of the name. A query word found here ranks higher. */
  nameTokens: string[];
  /** Tokens of the id, the section name and the keywords. */
  tokens: string[];
}

/** One entry per library structure, in library order, for `searchStructures`. */
export function structureSearchIndex(library: SlideStructureLibraryV1 = SLIDE_STRUCTURE_LIBRARY): StructureSearchEntryV1[] {
  const sectionNames = new Map(library.sections.map((s) => [s.id, s.name]));
  return library.structures.map((s) => ({
    id: s.id,
    name: s.name,
    section: s.section,
    nameTokens: searchTokens(s.name),
    tokens: [...new Set([
      ...searchTokens(s.id),
      ...searchTokens(sectionNames.get(s.section) ?? s.section),
      ...s.keywords.flatMap(searchTokens),
    ])],
  }));
}

/**
 * Structure ids matching a query, best first. Every query word has to begin a
 * token of the entry. A word equal to a name token counts most, then one equal to
 * an id, section or keyword token, then a prefix; an exact id comes first of all.
 * Ties keep library order. An empty query returns every id in library order.
 */
export function searchStructures(query: string, index: StructureSearchEntryV1[] = structureSearchIndex()): string[] {
  const words = searchTokens(query);
  const raw = query.trim().toLowerCase();
  if (words.length === 0) return index.map((e) => e.id);
  const scored: Array<{ id: string; score: number; order: number }> = [];
  index.forEach((entry, order) => {
    let score = entry.id === raw ? 100 : 0;
    for (const word of words) {
      if (entry.nameTokens.includes(word)) score += 3;
      else if (entry.tokens.includes(word)) score += 2;
      else if ([...entry.nameTokens, ...entry.tokens].some((t) => t.startsWith(word))) score += 1;
      else return;
    }
    scored.push({ id: entry.id, score, order });
  });
  return scored.sort((a, b) => (b.score - a.score) || (a.order - b.order)).map((e) => e.id);
}
