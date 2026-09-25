// SPDX-License-Identifier: MPL-2.0
/**
 * The layout chooser both tools share (plan 275 sections 2.6, 2.8 and 4): the grid of
 * slide layout wireframes Design shows for New slide and Apply, and Rebrand shows in the
 * decision column and in its popover.
 *
 * Two halves. The model is plain data over a slide master: one tile per layout the
 * master offers (its dark variants are reached through a slide's background, not listed),
 * named from the layout library, placed in a display band, searchable by the library's
 * names and keywords (which carry the PowerPoint and Google layout names), with a near
 * miss suggested when nothing matches, and mirrored pairs folded into one tile with a
 * flip. Every box takes every kind of content (plan 275 decision 30), so a picture layout drawn the
 * same way as a box layout ("Three pictures" and "Three boxes") is one tile, the box one:
 * the pictures layout rides on it and a slide that uses it is marked on that tile. The
 * Pictures band keeps only the layouts no box layout draws. The view builds that model
 * as DOM nodes: search, the bands, the tiles with a roving Tab stop, arrow keys (M
 * mirrors a mirrored pair), and hover and focus previews reported after a short wait.
 *
 * The names are English in the library and go through the translation catalog as
 * data (`tRaw`), so the slide-structures corpus translates them without a second table
 * here. Nodes, not markup: the one string that arrives as markup is the wireframe, built
 * from numbers and a closed set of class names, and it is parsed rather than assigned.
 */
import '../styles/parts/rebrand-chooser.css';
import { findStructure, searchTokens, slideStructureLibrary } from '@lolly/engine';
import type { ArchetypeRefV1, ArchetypeV1, SlideMasterV1 } from '@lolly-tools/core';
import { t, tRaw } from '../i18n.ts';
import { icon } from './icons.ts';

// ─── bands ───────────────────────────────────────────────────────────────────

/** The six display bands at slice size (plan 275 section 2.6). */
export const LAYOUT_BANDS = ['titles', 'text', 'boxes', 'pictures', 'data', 'steps'] as const;
export type LayoutBandId = (typeof LAYOUT_BANDS)[number];

/** Which band each library section is shown in. */
const SECTION_BAND: Readonly<Record<string, LayoutBandId>> = {
  titles: 'titles',
  people: 'titles',
  closing: 'titles',
  text: 'text',
  boxes: 'boxes',
  images: 'pictures',
  data: 'data',
  process: 'steps',
  lists: 'steps',
};

/**
 * A band that folds several library sections together opens into those sections once
 * every one of them holds this many tiles, so no section ever stands alone as a group
 * of one or two. At the first slice every such band stays folded.
 */
export const SECTION_OPEN_MIN = 4;

/** A chooser holding this many tiles or fewer is one grid, with no band headings. */
export const BANDS_FROM = 13;

/** How long a pointer or the focus rests on a tile before it is previewed. */
export const PREVIEW_DELAY_MS = 150;

export function bandName(band: LayoutBandId): string {
  switch (band) {
    case 'titles': return t('Titles');
    case 'text': return t('Text');
    case 'boxes': return t('Boxes');
    case 'pictures': return t('Pictures');
    case 'data': return t('Data');
    default: return t('Steps and lists');
  }
}

/** The English band names, so a search in English finds a band in any language. */
const BAND_ENGLISH: Readonly<Record<LayoutBandId, string>> = {
  titles: 'Titles', text: 'Text', boxes: 'Boxes', pictures: 'Pictures', data: 'Data', steps: 'Steps and lists',
};

// ─── the model ───────────────────────────────────────────────────────────────

/** The structure each of the twelve first archetypes restyles, for a master with no `structure` field. */
const TWELVE_STRUCTURES: Readonly<Record<string, string>> = {
  title: 'cover-title',
  section: 'section',
  content: 'title-body',
  'two-column': 'text-two-column',
  split: 'text-and-image',
  visual: 'visual',
  'full-image': 'full-image-caption',
  quote: 'quote',
  'big-number': 'big-number',
  'main-point': 'statement',
  agenda: 'agenda',
  table: 'table',
};

/**
 * A picture layout arranged the way a box layout is, and that box layout. Every box takes
 * every kind of content, so the chooser shows the pair as the box tile alone.
 */
const PICTURE_TWIN: Readonly<Record<string, string>> = {
  visual: 'title-body',
  'images-2': 'columns-2',
  'images-3': 'columns-3',
  'image-grid-2x2': 'grid-2x2',
  'image-grid-3x2': 'grid-3x2',
};

/**
 * The library id a master archetype restyles: its `structure`, else, for a master that
 * predates the library, the structure each of the twelve first archetypes became (plan
 * 275 section 2.4), else its own id.
 */
export function structureIdOf(archetype: Pick<ArchetypeV1, 'id' | 'structure'>): string {
  if (archetype.structure) return archetype.structure;
  return TWELVE_STRUCTURES[archetype.id] ?? archetype.id;
}

/**
 * What draws one layout's wireframe. The drawing is views/free-canvas/archetype-thumb.ts;
 * each chooser hands it in, so this module stays below the views that use it.
 */
export type ThumbDraw = (master: SlideMasterV1, id: string, opts: { width: number; structure: string; marks?: 'all' | 'none' }) => string;

export interface LayoutTile {
  /** The archetype id a click applies. */
  id: ArchetypeRefV1;
  /** The library structure it restyles. */
  structure: string;
  name: string;
  band: LayoutBandId;
  /** The library section, for a band that opens into its sections. */
  section: string;
  /** The archetype of the mirrored layout, when the master carries both. */
  flip?: ArchetypeRefV1;
  /** Picture layouts arranged like this one, folded into this tile: a slide on one is marked here. */
  also?: ArchetypeRefV1[];
  /** Library order, so a band lists its tiles the way the library does. */
  order: number;
}

/** The archetypes a chooser lists: every one that is not another's dark variant. */
export function listedArchetypes(master: SlideMasterV1): ArchetypeV1[] {
  const variants = new Set<string>();
  for (const a of master.archetypes) {
    if (a.variants?.dark) variants.add(a.variants.dark);
    if (a.variantOf) variants.add(a.id);
  }
  return master.archetypes.filter((a) => !variants.has(a.id));
}

/**
 * A layout's name: the library's, translated, for the structure it restyles; else the
 * name the master gives it; else its id. One name per layout in both tools.
 */
export function layoutName(master: SlideMasterV1 | null | undefined, id: string): string {
  const archetype = master?.archetypes.find((a) => a.id === id);
  const own = archetype ? structureIdOf(archetype) : id;
  // A picture layout folded into a box tile goes by the tile's name, so the grid and
  // every sentence about the slide say the same thing.
  const twin = PICTURE_TWIN[own];
  const folded = twin && master?.archetypes.some((a) => structureIdOf(a) === twin) ? twin : own;
  const structure = findStructure(folded);
  if (structure) return tRaw(structure.name);
  return archetype?.name || id;
}

const STRUCTURE_ORDER = new Map(slideStructureLibrary().structures.map((s, i) => [s.id, i]));

/**
 * One tile per listed layout: mirrored pairs folded into the tile of the unmirrored one,
 * and a picture layout folded into the box layout arranged the same way. `offered`, when
 * given, keeps only those archetypes (a design system that offers some of the master's).
 */
export function layoutTiles(master: SlideMasterV1, offered?: ReadonlySet<string>): LayoutTile[] {
  const listed = listedArchetypes(master).filter((a) => !offered || offered.has(a.id));
  const byStructure = new Map(listed.map((a) => [structureIdOf(a), a]));
  const folded = new Map<string, ArchetypeRefV1[]>();
  for (const archetype of listed) {
    const twin = byStructure.get(PICTURE_TWIN[structureIdOf(archetype)] ?? '');
    if (twin) folded.set(twin.id, [...(folded.get(twin.id) ?? []), archetype.id]);
  }
  const tiles: LayoutTile[] = [];
  listed.forEach((archetype, at) => {
    const structure = structureIdOf(archetype);
    const entry = findStructure(structure);
    // A mirror whose partner is listed rides on the partner's tile.
    if (entry?.mirror && byStructure.has(entry.mirror)) return;
    // A picture layout arranged like a listed box layout rides on the box tile.
    if (byStructure.has(PICTURE_TWIN[structure] ?? '')) return;
    const mirrored = listed.find((other) => findStructure(structureIdOf(other))?.mirror === structure);
    const section = archetype.section ?? entry?.section ?? 'text';
    const tile: LayoutTile = {
      id: archetype.id,
      structure,
      name: layoutName(master, archetype.id),
      band: SECTION_BAND[section] ?? 'text',
      section,
      order: STRUCTURE_ORDER.get(structure) ?? 1000 + at,
    };
    if (mirrored) tile.flip = mirrored.id;
    const also = folded.get(archetype.id);
    if (also) tile.also = also;
    tiles.push(tile);
  });
  return tiles.sort((a, b) => a.order - b.order);
}

/**
 * The id of the tile that shows `id`: the tile's own id for a picture layout folded into
 * a box tile, else `id` itself (a mirrored layout stays itself, since its tile shows it).
 */
export function tileIdOf(tiles: readonly LayoutTile[], id: string): string {
  return tiles.find((tile) => tile.also?.includes(id))?.id ?? id;
}

export interface LayoutGroup {
  key: string;
  name: string;
  tiles: LayoutTile[];
}

/** The tiles in display bands, a band opened into its sections when each holds enough. */
export function groupLayoutTiles(tiles: readonly LayoutTile[]): LayoutGroup[] {
  const library = slideStructureLibrary();
  const sectionNames = new Map(library.sections.map((s) => [s.id, s.name]));
  const sectionOrder = new Map(library.sections.map((s, i) => [s.id, i]));
  const out: LayoutGroup[] = [];
  for (const band of LAYOUT_BANDS) {
    const inBand = tiles.filter((tile) => tile.band === band);
    if (inBand.length === 0) continue;
    const sections = [...new Set(inBand.map((tile) => tile.section))]
      .sort((a, b) => (sectionOrder.get(a) ?? 99) - (sectionOrder.get(b) ?? 99));
    const open = sections.length > 1 && sections.every((s) => inBand.filter((tile) => tile.section === s).length >= SECTION_OPEN_MIN);
    if (!open) {
      out.push({ key: `band-${band}`, name: bandName(band), tiles: inBand });
      continue;
    }
    for (const s of sections) {
      out.push({ key: `section-${s}`, name: tRaw(sectionNames.get(s) ?? s), tiles: inBand.filter((tile) => tile.section === s) });
    }
  }
  return out;
}

// ─── search ──────────────────────────────────────────────────────────────────

interface SearchEntry {
  tile: LayoutTile;
  nameTokens: string[];
  tokens: string[];
}

function searchEntries(master: SlideMasterV1, tiles: readonly LayoutTile[]): SearchEntry[] {
  const library = slideStructureLibrary();
  const sectionNames = new Map(library.sections.map((s) => [s.id, s.name]));
  return tiles.map((tile) => {
    const structures = [tile.structure];
    const flipArchetype = tile.flip ? master.archetypes.find((a) => a.id === tile.flip) : undefined;
    if (flipArchetype) structures.push(structureIdOf(flipArchetype));
    // The picture layouts folded into the tile keep their words: "Three pictures" and
    // "gallery" find the box tile they ride on.
    for (const id of tile.also ?? []) {
      const folded = master.archetypes.find((a) => a.id === id);
      if (folded) structures.push(structureIdOf(folded));
    }
    const words: string[] = [tile.id, BAND_ENGLISH[tile.band], bandName(tile.band)];
    const names: string[] = [tile.name];
    for (const id of structures) {
      const entry = findStructure(id);
      words.push(id);
      if (!entry) continue;
      names.push(entry.name);
      words.push(sectionNames.get(entry.section) ?? entry.section, ...entry.keywords);
    }
    if (tile.flip) names.push(layoutName(master, tile.flip));
    const nameTokens = [...new Set(names.flatMap(searchTokens))];
    return { tile, nameTokens, tokens: [...new Set(words.flatMap(searchTokens))] };
  });
}

/** Edit distance, for the near miss. Small strings only: a search word against a token. */
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0] ?? 0;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const keep = row[j] ?? 0;
      row[j] = Math.min((row[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = keep;
    }
  }
  return row[b.length] ?? 0;
}

export interface LayoutSearchResult {
  /** Matching tile ids, best first. Every tile, in order, for an empty query. */
  ids: ArchetypeRefV1[];
  /** On no match: the tile whose words are nearest the query, by edit distance. */
  suggestion?: LayoutTile;
}

/**
 * Tiles matching a query, best first. Every query word has to begin a word of the tile:
 * its translated or English name, its id, its band, its library section or a keyword
 * (the PowerPoint and Google layout names are keywords). Digits and number words one to
 * eight are one token, so `4`, `four` and `4 box` find the same tiles. A word in the name
 * counts most, an exact id first of all.
 */
export function searchLayoutTiles(master: SlideMasterV1, tiles: readonly LayoutTile[], query: string): LayoutSearchResult {
  const words = searchTokens(query);
  if (words.length === 0) return { ids: tiles.map((tile) => tile.id) };
  const raw = query.trim().toLowerCase();
  const entries = searchEntries(master, tiles);
  const scored: Array<{ id: string; score: number; order: number }> = [];
  entries.forEach((entry, order) => {
    let score = entry.tile.id === raw || entry.tile.structure === raw ? 100 : 0;
    for (const word of words) {
      if (entry.nameTokens.includes(word)) score += 3;
      else if (entry.tokens.includes(word)) score += 2;
      else if ([...entry.nameTokens, ...entry.tokens].some((token) => token.startsWith(word))) score += 1;
      else return;
    }
    scored.push({ id: entry.tile.id, score, order });
  });
  const ids = scored.sort((a, b) => (b.score - a.score) || (a.order - b.order)).map((e) => e.id);
  if (ids.length > 0) return { ids };
  // The near miss: the tile holding the token closest to any query word, within a third
  // of the word's length.
  let best: { tile: LayoutTile; cost: number } | null = null;
  for (const word of words) {
    if (word.length < 3) continue;
    const limit = Math.max(1, Math.floor(word.length / 3));
    for (const entry of entries) {
      for (const token of [...entry.nameTokens, ...entry.tokens]) {
        if (token.length < 3) continue;
        const cost = distance(word, token) + (entry.nameTokens.includes(token) ? 0 : 0.5);
        if (cost <= limit + 0.5 && (!best || cost < best.cost)) best = { tile: entry.tile, cost };
      }
    }
  }
  return best ? { ids: [], suggestion: best.tile } : { ids: [] };
}

// ─── thumbnails ──────────────────────────────────────────────────────────────

/** Wireframes kept at once: two masters, two sizes and a theme preview fit well inside it. */
const THUMB_CACHE_MAX = 600;

/**
 * A wireframe this wide or narrower, in px, is drawn with no marks inside its boxes: at
 * that size a plus reads as an add button and a role glyph as a smudge (the strip's
 * layout pill, the Auto-match tally).
 */
export const PLAIN_THUMB_MAX = 40;
const thumbCache = new Map<string, string>();
let thumbDraws = 0;

/**
 * One layout's wireframe as SVG markup, cached by master, theme and size, so a column
 * that redraws on every state change does not draw forty wireframes each time.
 * `theme` is the deck theme being previewed, empty for the fixed neutral tones.
 */
export function layoutThumb(master: SlideMasterV1, id: string, width: number, draw: ThumbDraw, theme = ''): string {
  const marks = width <= PLAIN_THUMB_MAX ? 'none' : 'all';
  const key = `${master.id}@${master.version}|${theme}|${width}|${marks}|${id}`;
  const hit = thumbCache.get(key);
  if (hit !== undefined) return hit;
  thumbDraws += 1;
  const archetype = master.archetypes.find((a) => a.id === id);
  const svg = archetype ? draw(master, id, { width, structure: structureIdOf(archetype), marks }) : '';
  thumbCache.set(key, svg);
  while (thumbCache.size > THUMB_CACHE_MAX) {
    const oldest = thumbCache.keys().next().value;
    if (oldest === undefined) break;
    thumbCache.delete(oldest);
  }
  return svg;
}

/** How many wireframes were drawn rather than served from the cache: the cache's own measure. */
export function layoutThumbDraws(): number {
  return thumbDraws;
}

// ─── the view ────────────────────────────────────────────────────────────────

/** SVG markup as a real node, parsed rather than assigned. Null when the host has no parser. */
export function svgNode(markup: string): Element | null {
  const parser = document.defaultView?.DOMParser ?? (globalThis as { DOMParser?: typeof DOMParser }).DOMParser;
  if (!markup || !parser) return null;
  const parsed = new parser().parseFromString(markup, 'image/svg+xml').documentElement;
  if (!parsed || parsed.localName === 'parsererror' || parsed.getElementsByTagName('parsererror').length) return null;
  return document.importNode(parsed, true);
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** A tile before the layouts: a way back to the slide as it was, drawn from the slide itself. */
export interface LeadingTile {
  key: string;
  name: string;
  caption?: string;
  /** SVG markup of the tile's picture. */
  svg: string;
  /** Set when the tile cannot be chosen yet: the sentence that says why, as its description. */
  unavailable?: string;
  /** What choosing it does, in one sentence, as its description. */
  describe?: string;
  /** The slide is built this way now: `aria-current` on the tile. */
  current?: boolean;
  /**
   * A corner badge on the picture, so two tiles that draw the same slide still differ
   * at a glance: `picture` marks the tile that keeps the slide as one picture.
   */
  badge?: 'picture';
}

/** A note on a tile that the eye reads and a screen reader hears another way. */
export interface LayoutTileMark {
  /** The muted suffix in the name line: "+2". Empty for none. */
  text: string;
  /** The same fact in words, as the tile's description: "Continues on 2 more slides." Empty for none. */
  describe: string;
}

/** What a caller adds to one layout's tile. */
export interface LayoutTileExtra {
  /** One word under the name: Current, Suggested, Also fits. The current tile says Current when this is left out. */
  caption?: string;
  /**
   * A tile the matcher put forward (Suggested, Also fits): a sparkle beside the caption,
   * so it is marked by a glyph as well as in words. The tile is otherwise drawn as any
   * other; only the current tile carries a ring.
   */
  suggested?: boolean;
  /** The suffix in the name line: how many slides choosing the layout adds to the deck. */
  mark?: LayoutTileMark;
  /** The tile's description, read after its name. */
  describe?: string;
}

export interface LayoutChooserOpts {
  master: SlideMasterV1;
  /** Draws a wireframe: `archetypeThumbSvg`. */
  draw: ThumbDraw;
  tiles?: LayoutTile[];
  /** The layout the slide follows now: `aria-current` on its tile. */
  current?: string;
  /** Layouts lifted out of their bands into the first group (Current, Suggested, Also fits). */
  pinned?: string[];
  leading?: LeadingTile[];
  /** The first group's heading, when it has tiles. */
  leadingName?: string;
  /** Help lines under the first group, one sentence each. */
  leadingNotes?: Array<{ id: string; text: string }>;
  extras?: Record<string, LayoutTileExtra>;
  /** The id of the element that names the grid, for a chooser with no band headings. */
  labelledBy?: string;
  /** Show the search field. Default true. */
  search?: boolean;
  /**
   * Rows of the caller's own, placed between the search field and the tiles: Rebrand's
   * Auto-match row. They are drawn once and kept through every search.
   */
  between?: HTMLElement[];
  query?: string;
  width?: number;
  /** A prefix for `data-key`, so a redraw can put the focus back where it was. */
  keyPrefix?: string;
  previewDelay?: number;
  onPick(id: ArchetypeRefV1): void;
  onLeading?(key: string): void;
  /** A tile under the pointer or the focus, after the wait; null when neither rests on one. Leading tiles report `leading:<key>`. */
  onPreview?(id: string | null): void;
  onQuery?(query: string): void;
  /** Says a sentence to a screen reader: the layout a mirror turned the tile to. */
  onAnnounce?(text: string): void;
}

export interface LayoutChooserHandle {
  root: HTMLElement;
  /** The tiles on show, leading ones included, in reading order. */
  tiles(): HTMLButtonElement[];
  /** Focus the current tile, else the first. */
  focusStart(): void;
  /** Put the "+2" suffixes and their sentences on, as they are measured. An empty mark takes one away. */
  setMarks(marks: Record<string, LayoutTileMark>): void;
  /** Stop any preview timer. */
  dispose(): void;
}

let chooserSeq = 0;

/** Two tops this close, in CSS px, are one row: a tile with a longer name is no taller at its top. */
const ROW_SLACK = 2;

/**
 * The tile Up or Down moves to: the nearest in the next row that way, across the whole
 * list, so Down from a band's last row goes on into the next band. Read off the page
 * with `getBoundingClientRect`, since each tile sits in a cell of its own and its
 * `offsetTop` counts from that cell. Where nothing is laid out (every box at 0), the
 * tile stays where it is.
 */
export function rowOf(tiles: readonly HTMLElement[], at: number, step: 1 | -1): number {
  const boxes = tiles.map((tile) => tile.getBoundingClientRect());
  const here = boxes[at];
  if (!here) return at;
  const sameRow = (a: DOMRect | undefined, top: number): boolean => a !== undefined && Math.abs(a.top - top) <= ROW_SLACK;
  let i = at + step;
  while (i >= 0 && i < boxes.length && sameRow(boxes[i], here.top)) i += step;
  if (i < 0 || i >= boxes.length) return at;
  const rowTop = boxes[i]?.top ?? here.top;
  let best = i;
  let bestGap = Math.abs((boxes[i]?.left ?? 0) - here.left);
  for (let j = i; j >= 0 && j < boxes.length && sameRow(boxes[j], rowTop); j += step) {
    const gap = Math.abs((boxes[j]?.left ?? 0) - here.left);
    if (gap < bestGap) {
      best = j;
      bestGap = gap;
    }
  }
  return best;
}

/**
 * Build the chooser as nodes. The caller mounts `root` where it wants it and wires what a
 * pick does; this owns search, grouping, the roving Tab stop and the preview timing.
 */
export function buildLayoutChooser(opts: LayoutChooserOpts): LayoutChooserHandle {
  const seq = ++chooserSeq;
  const { master } = opts;
  const width = opts.width ?? 96;
  const tiles = opts.tiles ?? layoutTiles(master);
  const extras = opts.extras ?? {};
  const pinned = new Set(opts.pinned ?? []);
  const prefix = opts.keyPrefix ?? 'layout';
  const delay = opts.previewDelay ?? PREVIEW_DELAY_MS;
  const flipped = new Set<string>();
  // A slide on the mirrored layout of a pair opens with its tile turned to that layout.
  for (const tile of tiles) if (tile.flip && tile.flip === opts.current) flipped.add(tile.id);
  let query = opts.query ?? '';
  let timer: ReturnType<typeof setTimeout> | null = null;
  let previewing: string | null = null;

  const root = el('div', 'arch-chooser');
  const groups = el('div', 'arch-groups');
  const none = el('div', 'arch-none');
  none.hidden = true;

  const preview = (id: string | null): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    if (!opts.onPreview) return;
    if (id === null) {
      if (previewing !== null) {
        previewing = null;
        opts.onPreview(null);
      }
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      if (previewing === id) return;
      previewing = id;
      opts.onPreview?.(id);
    }, delay);
  };

  /** The ids a tile stands for while it shows `shownId`: that one, and the picture layouts folded into it. */
  const standsFor = (tile: LayoutTile, shownId: string): string[] => (shownId === tile.id ? [tile.id, ...(tile.also ?? [])] : [shownId]);

  /** The description ids a tile carries: its own sentence, then its note. */
  const describe = (button: HTMLElement, ids: string[]): void => {
    if (ids.length > 0) button.setAttribute('aria-describedby', ids.join(' '));
    else button.removeAttribute('aria-describedby');
  };

  /** A tile's picture in a box of its own, which carries the edge and any corner badge. */
  const artBox = (markup: string, badge?: LeadingTile['badge']): HTMLElement => {
    const box = el('span', 'arch-art');
    const art = svgNode(markup);
    if (art) box.append(art);
    if (badge === 'picture') {
      const mark = el('span', 'arch-badge');
      mark.setAttribute('aria-hidden', 'true');
      const glyph = svgNode(icon('image'));
      if (glyph) mark.append(glyph);
      box.append(mark);
    }
    return box;
  };

  /**
   * The name line: the name on one line, then a muted suffix ("+2") for the eye. The
   * suffix is hidden from a screen reader, which hears the same fact as the description.
   */
  const nameLine = (name: string, suffix = ''): HTMLElement => {
    const line = el('span', 'arch-line');
    line.append(el('span', 'arch-name', name));
    const count = el('span', 'arch-count', suffix);
    count.setAttribute('aria-hidden', 'true');
    count.hidden = !suffix;
    line.append(count);
    return line;
  };

  /** The caption line: a check before the current tile's word, a sparkle before one the matcher named. */
  const captionLine = (text: string, glyph: 'check' | 'sparkle' | null): HTMLElement => {
    const cap = el('span', 'arch-cap');
    const drawn = glyph ? svgNode(icon(glyph)) : null;
    if (drawn) cap.append(drawn);
    cap.append(el('span', '', text));
    return cap;
  };

  /** The hover text: the whole name, which the one-line name may cut, and the note in words. */
  const tipOf = (name: string, note = ''): string => (note ? `${name}. ${note}` : name);

  // One layout tile. A mirrored pair is one cell with a flip beside the tile.
  const layoutCell = (tile: LayoutTile): HTMLElement => {
    const cell = el('div', 'arch-cell');
    const shownId = tile.flip && flipped.has(tile.id) ? tile.flip : tile.id;
    const ids = standsFor(tile, shownId);
    const button = el('button', 'arch-tile');
    button.type = 'button';
    button.dataset.layout = shownId;
    button.dataset.archetype = shownId;
    button.dataset.key = `${prefix}-${tile.id}`;
    button.append(artBox(layoutThumb(master, shownId, width, opts.draw)));
    const name = layoutName(master, shownId);
    const extra = ids.map((id) => extras[id]).find((one) => one !== undefined) ?? {};
    // The count is for the eye; a screen reader hears it as the description below.
    button.append(nameLine(name, extra.mark?.text ?? ''));
    button.title = tipOf(name, extra.mark?.describe);
    const isCurrent = Boolean(opts.current && ids.includes(opts.current));
    // One pressed idiom for every tile: the current one is ringed and tinted, with a
    // check in its caption line. A tile the matcher named carries a sparkle there.
    const caption = extra.caption ?? (isCurrent ? t('Current') : '');
    if (caption) button.append(captionLine(caption, isCurrent ? 'check' : extra.suggested ? 'sparkle' : null));
    if (extra.suggested) button.dataset.suggested = 'true';
    if (isCurrent) button.setAttribute('aria-current', 'true');
    const described: string[] = [];
    if (extra.describe) {
      const note = el('span', 'visually-hidden', extra.describe);
      note.id = `arch-d-${seq}-${shownId}`;
      cell.append(note);
      described.push(note.id);
    }
    const heard = el('span', 'visually-hidden arch-more-said', extra.mark?.describe ?? '');
    heard.id = `arch-m-${seq}-${shownId}`;
    cell.append(heard);
    if (extra.mark?.describe) described.push(heard.id);
    describe(button, described);
    cell.prepend(button);
    if (tile.flip) {
      button.setAttribute('aria-keyshortcuts', 'M');
      const flip = el('button', 'arch-flip');
      flip.type = 'button';
      flip.tabIndex = -1;
      flip.dataset.flip = tile.id;
      flip.setAttribute('aria-pressed', String(flipped.has(tile.id)));
      flip.setAttribute('aria-keyshortcuts', 'M');
      flip.setAttribute('aria-label', tRaw('Mirror {layout}', { layout: layoutName(master, shownId) }));
      flip.title = t('Mirror (M)');
      const glyph = svgNode(icon('arrowsH'));
      if (glyph) flip.append(glyph);
      cell.append(flip);
    }
    return cell;
  };

  const leadingCell = (lead: LeadingTile): HTMLElement => {
    const cell = el('div', 'arch-cell arch-cell--lead');
    const button = el('button', 'arch-tile arch-tile--lead');
    button.type = 'button';
    button.dataset.leading = lead.key;
    button.dataset.key = `${prefix}-lead-${lead.key}`;
    button.append(artBox(lead.svg, lead.badge));
    button.append(nameLine(lead.name));
    button.title = lead.name;
    const caption = lead.caption ?? (lead.current ? t('Current') : '');
    if (caption) button.append(captionLine(caption, lead.current ? 'check' : null));
    if (lead.current) button.setAttribute('aria-current', 'true');
    const said = lead.unavailable ?? lead.describe;
    if (lead.unavailable) button.setAttribute('aria-disabled', 'true');
    if (said) {
      const note = el('span', 'visually-hidden', said);
      note.id = `arch-d-${seq}-lead-${lead.key}`;
      cell.append(note);
      button.setAttribute('aria-describedby', note.id);
    }
    cell.prepend(button);
    return cell;
  };

  const grid = (cells: HTMLElement[], labelledBy?: string): HTMLElement => {
    const g = el('div', 'arch-grid');
    g.setAttribute('role', 'group');
    if (labelledBy) g.setAttribute('aria-labelledby', labelledBy);
    g.append(...cells);
    return g;
  };

  const band = (key: string, name: string, cells: HTMLElement[], notes: Array<{ id: string; text: string }> = []): HTMLElement => {
    const section = el('section', 'arch-band');
    section.dataset.band = key;
    const head = el('h3', 'arch-band-name', name);
    head.id = `arch-b-${seq}-${key}`;
    section.append(head, grid(cells, head.id));
    for (const note of notes) {
      const p = el('p', 'arch-note', note.text);
      p.id = note.id;
      section.append(p);
    }
    return section;
  };

  const draw = (): void => {
    groups.replaceChildren();
    const found = searchLayoutTiles(master, tiles, query);
    const byId = new Map(tiles.map((tile) => [tile.id, tile]));
    if (query.trim()) {
      const hits = found.ids.map((id) => byId.get(id)).filter((tile): tile is LayoutTile => Boolean(tile));
      none.hidden = hits.length > 0;
      none.replaceChildren();
      if (hits.length === 0) {
        none.append(el('p', 'arch-none-text', tRaw('No layout matches "{query}".', { query: query.trim() })));
        const acts = el('div', 'arch-none-acts');
        if (found.suggestion) {
          const suggest = el('button', 'btn btn--ghost btn--sm', tRaw('Did you mean {layout}?', { layout: found.suggestion.name }));
          suggest.type = 'button';
          suggest.dataset.suggest = found.suggestion.name;
          acts.append(suggest);
        }
        const clear = el('button', 'btn btn--ghost btn--sm', t('Clear search'));
        clear.type = 'button';
        clear.dataset.clear = '';
        acts.append(clear);
        none.append(acts);
      } else {
        const results = el('section', 'arch-band');
        results.dataset.band = 'results';
        const head = el('h3', 'arch-band-name', hits.length === 1 ? t('1 layout') : tRaw('{count} layouts', { count: hits.length }));
        head.id = `arch-b-${seq}-results`;
        results.append(head, grid(hits.map(layoutCell), head.id));
        groups.append(results);
      }
    } else {
      none.hidden = true;
      const holds = (tile: LayoutTile, id: string): boolean => tile.id === id || tile.flip === id || (tile.also?.includes(id) ?? false);
      const lifted = tiles.filter((tile) => [...pinned].some((id) => holds(tile, id)));
      const leadCells = [...(opts.leading ?? []).map(leadingCell), ...(opts.pinned ?? [])
        .map((id) => lifted.find((tile) => holds(tile, id)))
        .filter((tile, i, all): tile is LayoutTile => Boolean(tile) && all.indexOf(tile) === i)
        .map(layoutCell)];
      const rest = tiles.filter((tile) => !lifted.includes(tile));
      if (leadCells.length > 0) groups.append(band('lead', opts.leadingName ?? t('This slide'), leadCells, opts.leadingNotes));
      if (tiles.length + (opts.leading?.length ?? 0) < BANDS_FROM && leadCells.length === 0) {
        groups.append(grid(rest.map(layoutCell), opts.labelledBy));
      } else {
        for (const group of groupLayoutTiles(rest)) groups.append(band(group.key, group.name, group.tiles.map(layoutCell)));
      }
    }
    const all = tileList();
    const start = all.find((tile) => tile.getAttribute('aria-current') === 'true') ?? all[0];
    for (const tile of all) tile.tabIndex = tile === start ? 0 : -1;
  };

  const tileList = (): HTMLButtonElement[] => [...groups.querySelectorAll<HTMLButtonElement>('.arch-tile')];

  if (opts.search !== false) {
    const row = el('div', 'arch-search-row');
    const glyph = svgNode(icon('search'));
    if (glyph) {
      const mark = el('span', 'arch-search-glyph');
      mark.setAttribute('aria-hidden', 'true');
      mark.append(glyph);
      row.append(mark);
    }
    const input = el('input', 'field-input arch-search');
    input.type = 'search';
    input.value = query;
    input.dataset.key = `${prefix}-search`;
    input.placeholder = t('Search layouts');
    input.setAttribute('aria-label', t('Search layouts'));
    input.autocomplete = 'off';
    input.addEventListener('input', () => {
      query = input.value;
      opts.onQuery?.(query);
      draw();
    });
    // The keyboard's way from the field to the results: Down goes to the first tile on
    // show, and Enter picks the one layout a search leaves.
    input.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const all = tileList();
      if (e.key === 'ArrowDown') {
        const first = all[0];
        if (!first) return;
        e.preventDefault();
        for (const tile of all) tile.tabIndex = tile === first ? 0 : -1;
        first.focus();
        return;
      }
      if (e.key !== 'Enter' || !query.trim()) return;
      const layouts = all.filter((tile) => tile.dataset.layout);
      const only = layouts.length === 1 && all.length === 1 ? layouts[0] : undefined;
      if (!only) return;
      e.preventDefault();
      if (timer !== null) clearTimeout(timer);
      timer = null;
      opts.onPick(only.dataset.layout ?? '');
    });
    row.append(input);
    root.append(row);
  }
  root.append(...(opts.between ?? []), groups, none);

  const setQuery = (next: string): void => {
    query = next;
    const input = root.querySelector<HTMLInputElement>('.arch-search');
    if (input) input.value = next;
    opts.onQuery?.(query);
    draw();
    input?.focus();
  };

  /**
   * Mirror a pair's tile, and say the layout it shows now. `focus` is what takes the
   * focus after the redraw: the flip that was pressed, or the tile the M key was on.
   */
  const toggleFlip = (id: string, focus: 'flip' | 'tile'): void => {
    if (flipped.has(id)) flipped.delete(id);
    else flipped.add(id);
    draw();
    const tile = tileList().find((one) => one.dataset.key === `${prefix}-${id}`);
    if (focus === 'tile' && tile) {
      for (const one of tileList()) one.tabIndex = one === tile ? 0 : -1;
      tile.focus();
    } else {
      [...root.querySelectorAll<HTMLElement>('[data-flip]')].find((one) => one.dataset.flip === id)?.focus();
    }
    const shown = tile?.dataset.layout;
    if (!shown) return;
    preview(shown);
    opts.onAnnounce?.(tRaw('Mirrored: {layout}.', { layout: layoutName(master, shown) }));
  };

  root.addEventListener('click', (e) => {
    const target = e.target as Element;
    const flip = target.closest<HTMLElement>('[data-flip]');
    if (flip) {
      e.stopPropagation();
      toggleFlip(flip.dataset.flip ?? '', 'flip');
      return;
    }
    if (target.closest('[data-clear]')) {
      setQuery('');
      return;
    }
    const suggest = target.closest<HTMLElement>('[data-suggest]');
    if (suggest) {
      setQuery(suggest.dataset.suggest ?? '');
      return;
    }
    const lead = target.closest<HTMLElement>('[data-leading]');
    if (lead) {
      e.stopPropagation();
      opts.onLeading?.(lead.dataset.leading ?? '');
      return;
    }
    const tile = target.closest<HTMLElement>('.arch-tile[data-layout]');
    if (!tile) return;
    e.stopPropagation();
    if (timer !== null) clearTimeout(timer);
    timer = null;
    opts.onPick(tile.dataset.layout ?? '');
  });

  groups.addEventListener('keydown', (e) => {
    const all = tileList();
    // The key may arrive on the grid itself rather than on a tile: the roving stop is current then.
    const current = (e.target as Element).closest<HTMLButtonElement>('.arch-tile') ?? all.find((tile) => tile.tabIndex === 0);
    if (!current) return;
    const at = all.indexOf(current);
    if (at < 0) return;
    // M mirrors a mirrored pair's tile: the keyboard's way to the flip beside it.
    const letter = e.key.length === 1 && /[a-z]/i.test(e.key) ? e.key.toLowerCase() : /^Key([A-Z])$/.exec(e.code)?.[1]?.toLowerCase();
    if (letter === 'm' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const pair = current.closest('.arch-cell')?.querySelector<HTMLElement>('[data-flip]')?.dataset.flip;
      if (!pair) return;
      e.preventDefault();
      toggleFlip(pair, 'tile');
      return;
    }
    let next = -1;
    if (e.key === 'ArrowRight') next = (at + 1) % all.length;
    else if (e.key === 'ArrowLeft') next = (at - 1 + all.length) % all.length;
    else if (e.key === 'ArrowDown') next = rowOf(all, at, 1);
    else if (e.key === 'ArrowUp') next = rowOf(all, at, -1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = all.length - 1;
    if (next < 0) return;
    e.preventDefault();
    for (const tile of all) tile.tabIndex = -1;
    const target = all[next];
    if (!target) return;
    target.tabIndex = 0;
    target.focus();
  });

  const tileKey = (tile: HTMLElement): string | null =>
    tile.dataset.layout ?? (tile.dataset.leading ? `leading:${tile.dataset.leading}` : null);
  groups.addEventListener('pointerover', (e) => {
    const tile = (e.target as Element).closest<HTMLElement>('.arch-tile');
    const key = tile ? tileKey(tile) : null;
    if (key) preview(key);
  });
  groups.addEventListener('focusin', (e) => {
    const tile = (e.target as Element).closest<HTMLElement>('.arch-tile');
    const key = tile ? tileKey(tile) : null;
    if (key) preview(key);
  });
  // Leaving the grid with the pointer goes back to the tile the focus rests on, if one does.
  root.addEventListener('pointerleave', () => {
    const active = document.activeElement;
    const focused = active instanceof HTMLElement && root.contains(active) ? active.closest<HTMLElement>('.arch-tile') : null;
    preview(focused ? tileKey(focused) : null);
  });
  root.addEventListener('focusout', (e) => {
    const to = e.relatedTarget;
    if (!(to instanceof Node) || !root.contains(to)) preview(null);
  });

  draw();

  return {
    root,
    tiles: tileList,
    focusStart: () => {
      const all = tileList();
      (all.find((tile) => tile.tabIndex === 0) ?? all[0])?.focus();
    },
    setMarks: (marks) => {
      for (const tile of tileList()) {
        const id = tile.dataset.layout;
        const count = tile.querySelector<HTMLElement>('.arch-count');
        const heard = tile.parentElement?.querySelector<HTMLElement>('.arch-more-said');
        if (!id || !count || !heard) continue;
        const one = marks[id] ?? { text: '', describe: '' };
        if (count.textContent !== one.text) count.textContent = one.text;
        count.hidden = !one.text;
        if (heard.textContent !== one.describe) heard.textContent = one.describe;
        const own = (tile.getAttribute('aria-describedby') ?? '').split(' ').filter((ref) => ref && ref !== heard.id);
        describe(tile, one.describe ? [...own, heard.id] : own);
        tile.title = tipOf(layoutName(master, id), one.describe);
        extras[id] = { ...(extras[id] ?? {}), mark: one };
      }
    },
    dispose: () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}
