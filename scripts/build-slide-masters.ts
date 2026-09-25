#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Expand the slide layout library into every pack's slide master (plan 275
 * sections 2.5 to 2.7).
 *
 *   node scripts/build-slide-masters.ts                  # write everything
 *   node scripts/build-slide-masters.ts --pack=suse      # one pack's masters.json (plus the engine data)
 *   node scripts/build-slide-masters.ts --check          # exit 1 when a written file would change
 *
 * Reads `community/slide-structures/library.json` and writes:
 *   - `engine/src/slide-structures-data.ts`, the library as a TypeScript literal;
 *   - each pack's `slides/masters.json`: the hand-tuned archetypes kept as they are
 *     with the library `structure` they restyle, every structure in the library's
 *     `expanded` list that no tuned archetype restyles expanded in that master's own
 *     margins, type scale and furniture, a dark variant for each light content
 *     archetype, and a weight on every text placeholder (700 for a title, 400 where
 *     a tuned slot left it out, so Design stops drawing a body bold). A library box
 *     stated as explicit fractions is moved from the library grid to the master's:
 *     x through the margins, and a box that starts on the title band onto the
 *     master's title band. The mirror of a structure a tuned archetype restyles is
 *     that tuned archetype turned left to right, furniture included, so the two read
 *     as a pair. A picture that covers master furniture takes the master's scrim
 *     under a page number or footer and leaves the logo off, since a mark on a
 *     photograph nobody has seen cannot be promised to read;
 *   - `NEUTRAL_MASTER` in `engine/src/rebrand-design-system.ts`, the lolly-start
 *     master as a TypeScript literal, pinned equal to that file by
 *     `tests/rebrand-design-system.test.ts`.
 *
 * Inheritance happens here, at build time: the runtime reads one flat archetype
 * list and never merges a master with the library. A pack whose masters.json is not
 * on disk (the private SUSE submodule on a public clone) is skipped. Running the
 * script twice writes the same bytes, which is what `--check` and the drift test in
 * `tests/slide-structures.test.ts` rely on.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { KNOWN_ARCHETYPE_IDS, STRUCTURE_ID_PATTERN } from '../packages/core/src/index.ts';
import type {
  ArchetypeRoleV1,
  ArchetypeV1,
  FurnitureLayerV1,
  MasterBoxV1,
  MasterTextStyleV1,
  PlaceholderLayerV1,
  SlideMasterFileV1,
  SlideMasterV1,
} from '../packages/core/src/index.ts';
import {
  expandStructure,
  type SlideStructureLibraryV1,
  type SlideStructureV1,
  type StructureGridV1,
} from '../engine/src/slide-structures.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const LIBRARY_FILE = 'community/slide-structures/library.json';
export const DATA_FILE = 'engine/src/slide-structures-data.ts';
export const NEUTRAL_FILE = 'engine/src/rebrand-design-system.ts';

// ─── what each pack's master is drawn with ───────────────────────────────────

/** The inks and grounds one master states for a light and a dark slide, as token paths. */
interface MasterColoursV1 {
  ground: { light: string; dark: string };
  ink: { light: string; dark: string };
  /** The ink a number is set in, where a master gives figures their own colour. */
  figure: { light: string; dark: string };
  /** The fill of a rule a timeline draws through its row. */
  rule: string;
}

/** Which master furniture each kind of generated archetype shows, by id, in paint order. */
interface MasterFurnitureSetsV1 {
  content: string[];
  contentDark: string[];
  cover: string[];
  coverDark: string[];
}

export interface MasterBuildConfigV1 {
  pack: string;
  file: string;
  masterId: string;
  version: string;
  /** Replaces the master's description when set. */
  description?: string;
  grid: StructureGridV1;
  colours: MasterColoursV1;
  furniture: MasterFurnitureSetsV1;
  /** Furniture the build adds to the master; replaced on every run. */
  extraFurniture: FurnitureLayerV1[];
  /** How a light archetype's furniture reads on its dark variant: an id, or null to leave it out. */
  darkFurniture: Record<string, string | null>;
  /** Tuned placeholders that sit over another on purpose, per archetype id, by role. */
  overlays: Record<string, ArchetypeRoleV1[]>;
  /** The master's translucent rectangle laid under a page number or footer that falls on a picture. */
  scrim?: string;
}

/** The twelve archetypes both masters hand-tune, and the library structure each restyles. */
export const TUNED_STRUCTURES: Readonly<Record<string, string>> = {
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
 * The template grid both masters were measured from: margins 3.41%, the title
 * strip from 3.42% to 14.55%, the body to 84.66%. Content in a generated box starts
 * a little below the title strip, where the tuned two columns start their cards.
 */
const TEMPLATE_GRID: StructureGridV1 = {
  marginX: 0.0341,
  gutterX: 0.02,
  columns: 12,
  titleY: 0.0342,
  titleH: 0.1113,
  kickerH: 0.05,
  subtitleH: 0.06,
  contentY: 0.19,
  contentH: 0.6566,
  gutterY: 0.03,
  rows: 6,
  cellGap: 0.015,
  furnitureY: 0.9,
};

const DARK_FURNITURE: Record<string, string | null> = {
  footer: 'footer-on-dark',
  'page-number': 'page-number-on-dark',
  'page-number-right': 'page-number-right-on-dark',
  'card-left': null,
  'card-right': null,
};

function onDarkFurniture(ink: string): FurnitureLayerV1[] {
  return [
    { id: 'footer-on-dark', kind: 'footer', box: { x: 0.16, y: 0.9325, w: 0.25, h: 0.028 }, style: { align: 'left', valign: 'middle', fgTokenPath: ink } },
    { id: 'page-number-on-dark', kind: 'page-number', box: { x: 0.4232, y: 0.917, w: 0.06, h: 0.0516 }, style: { weight: '700', align: 'center', valign: 'middle', fgTokenPath: ink } },
  ];
}

export const MASTER_BUILDS: readonly MasterBuildConfigV1[] = [
  {
    pack: 'lolly-start',
    file: 'brands/lolly-start/catalog/assets/lolly/slides/masters.json',
    masterId: 'lolly/slides/neutral',
    version: '1.3.0',
    description: 'The starter deck geometry at 1280 by 720: twelve hand-tuned archetypes and the layout library structures expanded in the same margins, every box a fraction of the slide, colours named as design-system token paths so a brand that is imported over the blank starter takes the whole master with it. No brand decoration, because a colourless starter has no brand hues to draw with.',
    grid: TEMPLATE_GRID,
    colours: {
      ground: { light: 'color.semantic.surface', dark: 'color.semantic.text' },
      ink: { light: 'color.semantic.text', dark: 'color.semantic.surface' },
      figure: { light: 'color.semantic.text', dark: 'color.semantic.surface' },
      rule: 'color.semantic.muted',
    },
    furniture: {
      content: ['footer', 'logo', 'page-number'],
      contentDark: ['footer-on-dark', 'logo', 'page-number-on-dark'],
      cover: ['logo-hero'],
      coverDark: ['logo-hero', 'page-number-right-on-dark'],
    },
    extraFurniture: onDarkFurniture('color.semantic.surface'),
    darkFurniture: DARK_FURNITURE,
    overlays: { 'big-number': ['caption'] },
    scrim: 'caption-scrim',
  },
  {
    pack: 'suse',
    file: 'brands/suse/catalog/assets/suse/slides/masters.json',
    masterId: 'suse/slides/brand',
    version: '1.3.0',
    grid: TEMPLATE_GRID,
    colours: {
      ground: { light: 'color.semantic.surface', dark: 'color.brand.pine' },
      ink: { light: 'color.brand.pine', dark: 'color.brand.white' },
      figure: { light: 'color.ramp.jungle.3', dark: 'color.brand.jungle' },
      rule: 'color.brand.jungle',
    },
    furniture: {
      content: ['bar-mint', 'bar-blue', 'bar-orange', 'bar-green', 'footer', 'logo', 'page-number'],
      contentDark: ['bar-mint', 'bar-blue', 'bar-orange', 'bar-green', 'footer-on-dark', 'logo', 'page-number-on-dark'],
      cover: ['logo-hero'],
      coverDark: ['logo-hero', 'page-number-right-on-dark'],
    },
    extraFurniture: onDarkFurniture('color.brand.white'),
    darkFurniture: DARK_FURNITURE,
    overlays: { 'big-number': ['caption'] },
    scrim: 'caption-scrim',
  },
];

// ─── the library ─────────────────────────────────────────────────────────────

/** Problems with the library file itself, before a master is built from it. */
export function libraryProblems(library: SlideStructureLibraryV1): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const sections = new Set(library.sections.map((s) => s.id));
  for (const s of library.structures) {
    if (!STRUCTURE_ID_PATTERN.test(s.id)) problems.push(`${s.id}: not a structure id`);
    if (ids.has(s.id)) problems.push(`${s.id}: declared twice`);
    ids.add(s.id);
    if (!sections.has(s.section)) problems.push(`${s.id}: names the section "${s.section}", which the library does not declare`);
    const ways = [s.slots ? 1 : 0, s.repeat ? 1 : 0, s.mirror ? 1 : 0].reduce((a, b) => a + b, 0);
    if (ways !== 1) problems.push(`${s.id}: states ${ways} of slots, repeat and mirror; one is needed`);
  }
  for (const s of library.structures) {
    if (s.mirror && !ids.has(s.mirror)) problems.push(`${s.id}: mirrors "${s.mirror}", which the library does not hold`);
  }
  for (const id of library.expanded) {
    if (!ids.has(id)) problems.push(`expanded names "${id}", which the library does not hold`);
  }
  return problems;
}

export function readLibrary(root: string = ROOT): SlideStructureLibraryV1 {
  return JSON.parse(readFileSync(join(root, LIBRARY_FILE), 'utf8')) as SlideStructureLibraryV1;
}

// ─── writing TypeScript literals ─────────────────────────────────────────────

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function tsString(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
}

/** A value as a one-line TypeScript literal: single quotes, bare keys where they are identifiers. */
export function tsLiteral(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return tsString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `[${value.map(tsLiteral).join(', ')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return '{}';
    return `{ ${entries.map(([k, v]) => `${IDENT.test(k) ? k : tsString(k)}: ${tsLiteral(v)}`).join(', ')} }`;
  }
  throw new Error(`build-slide-masters: cannot write ${typeof value} as a literal`);
}

/** An object whose array fields named in `lists` are written one entry per line. */
function tsBlock(value: object, lists: readonly string[], indent = ''): string {
  const inner = `${indent}  `;
  const lines = Object.entries(value).filter(([, v]) => v !== undefined).map(([k, v]) => {
    const key = IDENT.test(k) ? k : tsString(k);
    if (lists.includes(k) && Array.isArray(v)) {
      return `${inner}${key}: [\n${v.map((item) => `${inner}  ${tsLiteral(item)},`).join('\n')}\n${inner}],`;
    }
    return `${inner}${key}: ${tsLiteral(v)},`;
  });
  return `{\n${lines.join('\n')}\n${indent}}`;
}

/** The engine's copy of the library. */
export function renderStructuresData(library: SlideStructureLibraryV1): string {
  const { $comment: _comment, ...data } = library;
  return [
    '// SPDX-License-Identifier: MPL-2.0',
    '// GENERATED by scripts/build-slide-masters.ts from community/slide-structures/library.json.',
    '// Do not edit: change the library and run `node scripts/build-slide-masters.ts`.',
    '',
    "import type { SlideStructureLibraryV1 } from './slide-structures.ts';",
    '',
    `export const SLIDE_STRUCTURE_LIBRARY: SlideStructureLibraryV1 = ${tsBlock(data, ['sections', 'structures'])};`,
    '',
  ].join('\n');
}

/** The lolly-start master as the `NEUTRAL_MASTER` literal. */
export function renderNeutralMaster(master: SlideMasterV1): string {
  return `const NEUTRAL_MASTER: SlideMasterV1 = ${tsBlock(master, ['archetypes', 'furniture'])};\n`;
}

/** `source` with its `NEUTRAL_MASTER` literal, which runs to the end of the file, replaced. */
export function withNeutralMaster(source: string, master: SlideMasterV1): string {
  const at = source.indexOf('const NEUTRAL_MASTER: SlideMasterV1 = ');
  if (at < 0) throw new Error(`build-slide-masters: ${NEUTRAL_FILE} has no NEUTRAL_MASTER literal to replace`);
  return source.slice(0, at) + renderNeutralMaster(master);
}

// ─── canonical key order ─────────────────────────────────────────────────────

/** A copy with keys in the given order first and the rest after, undefined dropped. */
function ordered<T extends object>(value: T, keys: readonly string[]): T {
  const src = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of keys) if (src[k] !== undefined) out[k] = src[k];
  for (const [k, v] of Object.entries(src)) if (!(k in out) && v !== undefined) out[k] = v;
  return out as T;
}

const box = (b: MasterBoxV1): MasterBoxV1 => ordered(b, ['x', 'y', 'w', 'h']);
const style = (s: MasterTextStyleV1): MasterTextStyleV1 =>
  ordered(s, ['fontSize', 'weight', 'align', 'valign', 'font', 'fg', 'fgTokenPath']);

function placeholder(ph: PlaceholderLayerV1): PlaceholderLayerV1 {
  return ordered({ ...ph, box: box(ph.box), style: ph.style ? style(ph.style) : undefined },
    ['role', 'box', 'kind', 'fit', 'style', 'prompt', 'group', 'index', 'optional', 'overlay']);
}

function archetype(a: ArchetypeV1): ArchetypeV1 {
  return ordered({ ...a, placeholders: a.placeholders.map(placeholder) },
    ['id', 'name', 'structure', 'section', 'background', 'furniture', 'placeholders', 'repeat', 'variants', 'variantOf']);
}

function furniture(f: FurnitureLayerV1): FurnitureLayerV1 {
  return ordered({ ...f, box: box(f.box), style: f.style ? style(f.style) : undefined },
    ['id', 'kind', 'box', 'variantByBackground', 'text', 'tokenPath', 'hex', 'style']);
}

// ─── type for a generated slot ───────────────────────────────────────────────

/**
 * Sizes a generated slot takes, as ratios of a step of the master's own type scale,
 * so a master whose scale is larger or smaller restyles the expansion with it. With
 * both shipped masters on a title step of 37 and a body step of 24 these come to
 * 59 px for a cover title, 24 for a subtitle under a title, 24, 22 and 20 for a
 * label by width, and 20, 18 and 16 for a body by width.
 */
const TYPE_RATIOS = {
  /** A cover or closing title, of the title step. */
  coverTitle: 1.6,
  /** A subtitle directly under a title band, of the subtitle step. */
  subtitleUnderTitle: 0.89,
  /** A label by the width of its box (at least this fraction of the slide), of the body step. */
  label: [[0.4, 1], [0.25, 0.92], [0, 0.83]] as ReadonlyArray<[number, number]>,
  /** A body by width, of the body step; the widest takes the scale as it is. */
  body: [[0.6, undefined], [0.4, 0.83], [0.25, 0.75], [0, 0.67]] as ReadonlyArray<[number, number | undefined]>,
  /** The smallest and largest figure, of the title step. */
  numberMin: 0.76,
  numberMax: 1.95,
} as const;

/** The words a generated placeholder shows while empty. */
function promptFor(role: ArchetypeRoleV1, kind: PlaceholderLayerV1['kind'], index: number | undefined, structure: string): string {
  switch (role) {
    case 'title': return 'Title';
    case 'subtitle': return 'Subtitle';
    case 'label': return 'Heading';
    case 'caption': return 'Caption';
    case 'visual': return 'Picture';
    case 'data': return kind === 'table' ? 'Rows and columns' : 'Chart';
    case 'number': return structure.startsWith('stats-') ? 'xx%' : String((index ?? 0) + 1);
    case 'quote': return 'The quotation';
    case 'attribution': return 'Who said it';
    default: return 'Text';
  }
}

/** Body and label sizes step down as a box narrows, so three and four boxes stay readable. */
function sizeByWidth(w: number, step: number, ratios: ReadonlyArray<[number, number | undefined]>): number | undefined {
  const found = ratios.find(([atLeast]) => w >= atLeast) ?? ratios[ratios.length - 1];
  const ratio = found?.[1];
  return ratio === undefined ? undefined : Math.round(step * ratio);
}

/** The text style a generated placeholder takes, on a light or a dark ground, in this master's type scale. */
function styleFor(ph: PlaceholderLayerV1, structure: SlideStructureV1, config: MasterBuildConfigV1, master: SlideMasterV1, dark: boolean): MasterTextStyleV1 {
  const ink = dark ? config.colours.ink.dark : config.colours.ink.light;
  const figure = dark ? config.colours.figure.dark : config.colours.figure.light;
  const scale = master.typeScale;
  const inBand = Math.abs(ph.box.y - config.grid.titleY) < 1e-6 && Math.abs(ph.box.h - config.grid.titleH) < 1e-6;
  const stats = structure.id.startsWith('stats-');
  switch (ph.role) {
    case 'title': {
      // A cover or a closing slide sets its title large; a title beside a picture takes the scale.
      const cover = !inBand && (structure.section === 'titles' || structure.section === 'closing');
      return cover
        ? { fontSize: Math.round(scale.title * TYPE_RATIOS.coverTitle), weight: '700', align: 'left', valign: 'bottom', fgTokenPath: ink }
        : { weight: '700', align: 'left', valign: 'bottom', fgTokenPath: ink };
    }
    case 'subtitle': {
      const underTitle = Math.abs(ph.box.y - (config.grid.titleY + config.grid.titleH)) < 1e-3;
      const fontSize = underTitle ? Math.round(scale.subtitle * TYPE_RATIOS.subtitleUnderTitle) : scale.subtitle;
      return { fontSize, weight: '400', align: 'left', valign: 'top', fgTokenPath: ink };
    }
    case 'label': {
      const fontSize = sizeByWidth(ph.box.w, scale.body, TYPE_RATIOS.label);
      return { fontSize, weight: '700', align: stats ? 'center' : 'left', valign: stats ? 'top' : 'bottom', fgTokenPath: ink };
    }
    case 'number': {
      const least = Math.round(scale.title * TYPE_RATIOS.numberMin);
      const most = Math.round(scale.title * TYPE_RATIOS.numberMax);
      const byBox = Math.min(Math.round(ph.box.h * master.size.height * 0.55), Math.round(ph.box.w * master.size.width * 0.6));
      const fontSize = Math.max(least, Math.min(most, byBox));
      return { fontSize, weight: '700', align: stats ? 'center' : 'left', valign: stats ? 'bottom' : 'top', fgTokenPath: figure };
    }
    case 'caption':
      return { weight: '400', align: 'left', valign: 'top', fgTokenPath: ink };
    default: {
      const fontSize = sizeByWidth(ph.box.w, scale.body, TYPE_RATIOS.body);
      return { fontSize, weight: '400', align: 'left', valign: 'top', fgTokenPath: ink };
    }
  }
}

// ─── library geometry on a master grid ───────────────────────────────────────

const EDGE = 1e-6;

/** One x edge moved from the library's margins to the master's; the slide edges stay put. */
function mapX(e: number, from: StructureGridV1, to: StructureGridV1): number {
  if (e <= EDGE || e >= 1 - EDGE) return e;
  return to.marginX + ((e - from.marginX) * (1 - 2 * to.marginX)) / (1 - 2 * from.marginX);
}

/**
 * A box the library states as explicit fractions, moved onto a master grid: x
 * through the margins, and a box that starts at the top of the library's title band
 * onto the master's title band (its foot too when it ends where the band ends).
 * Anything else keeps its y, which is how a cover keeps the height it was drawn at.
 */
export function mapLibraryBox(box: MasterBoxV1, from: StructureGridV1, to: StructureGridV1): MasterBoxV1 {
  const x0 = mapX(box.x, from, to);
  const x1 = mapX(box.x + box.w, from, to);
  let y0 = box.y;
  let y1 = box.y + box.h;
  if (Math.abs(box.y - from.titleY) < EDGE) {
    y0 = to.titleY;
    if (Math.abs(y1 - (from.titleY + from.titleH)) < EDGE) y1 = to.titleY + to.titleH;
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** The library with every explicit box moved onto this grid. Slots placed by band, column or row are the grid's already. */
function libraryOnGrid(library: SlideStructureLibraryV1, grid: StructureGridV1): SlideStructureLibraryV1 {
  return {
    ...library,
    structures: library.structures.map((s) => (s.slots?.some((slot) => slot.box)
      ? { ...s, slots: s.slots.map((slot) => (slot.box ? { ...slot, box: mapLibraryBox(slot.box, library.grid, grid) } : slot)) }
      : s)),
  };
}

/** A box turned left to right. */
function reflect(box: MasterBoxV1): MasterBoxV1 {
  return { ...box, x: Math.round((1 - box.x - box.w) * 1e4) / 1e4 };
}

function overlapping(a: MasterBoxV1, b: MasterBoxV1): boolean {
  return Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.001
    && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.001;
}

function covering(outer: MasterBoxV1, inner: MasterBoxV1): boolean {
  return outer.x <= inner.x + EDGE && outer.y <= inner.y + EDGE
    && outer.x + outer.w >= inner.x + inner.w - EDGE && outer.y + outer.h >= inner.y + inner.h - EDGE;
}

/** The furniture a build run can show: the master's own, what the config adds, and what the run itself adds. */
interface FurnitureBookV1 {
  get(id: string): FurnitureLayerV1 | undefined;
  /** Furniture this run adds (timeline rules, reflected furniture), by id, in first-added order. */
  added: Map<string, FurnitureLayerV1>;
}

/** The prefix of a furniture entry the build reflects for a mirrored archetype. */
const MIRROR_PREFIX = 'mirror-';

/**
 * The id of a furniture entry turned left to right, added to the book on first use.
 * An entry that is its own reflection (a full-width bar) keeps its id.
 */
function mirroredFurniture(id: string, book: FurnitureBookV1): string {
  const f = book.get(id);
  if (!f) return id;
  const box = reflect(f.box);
  if (Math.abs(box.x - f.box.x) < EDGE) return id;
  const mirrorId = `${MIRROR_PREFIX}${id}`;
  if (!book.added.has(mirrorId)) book.added.set(mirrorId, { ...f, id: mirrorId, box });
  return mirrorId;
}

// ─── building one master ─────────────────────────────────────────────────────

/** A content box whose top is this close to the title band's bottom sits on it, with no gap. */
const FLUSH_UNDER_TITLE = 0.005;

/**
 * A content box that starts flush on the title band's bottom edge starts at the
 * content band instead, keeping its bottom edge. The title is set to the bottom of
 * its band, so a flush box put the body's first line against the title's last one
 * (plan 275, the formatting fixture's slide 2): the generated archetypes already
 * start their content at `contentY`, and the tuned ones now do too. A subtitle is
 * the one role that belongs right under the title, so it keeps its place. Running
 * the build again leaves a moved box where it is.
 */
function clearOfTitle(ph: PlaceholderLayerV1, title: PlaceholderLayerV1 | undefined, grid: StructureGridV1): MasterBoxV1 {
  if (!title || ph === title || ph.role === 'subtitle') return ph.box;
  const titleBottom = title.box.y + title.box.h;
  const bottom = ph.box.y + ph.box.h;
  if (Math.abs(ph.box.y - titleBottom) > FLUSH_UNDER_TITLE || bottom <= grid.contentY) return ph.box;
  return { ...ph.box, y: grid.contentY, h: Math.round((bottom - grid.contentY) * 10000) / 10000 };
}

/** A tuned archetype with its structure, a weight on every text slot and its stated overlays. */
function tunedArchetype(a: ArchetypeV1, config: MasterBuildConfigV1): ArchetypeV1 {
  const overlays = new Set(config.overlays[a.id] ?? []);
  const title = a.placeholders.find((ph) => ph.role === 'title');
  const next: ArchetypeV1 = { ...a, placeholders: a.placeholders.map((ph) => {
    const out: PlaceholderLayerV1 = { ...ph, box: clearOfTitle(ph, title, config.grid) };
    if (ph.kind !== 'image') {
      out.style = { ...ph.style, weight: ph.style?.weight ?? (ph.role === 'title' ? '700' : '400') };
    }
    if (overlays.has(ph.role)) out.overlay = true;
    return out;
  }) };
  const structure = TUNED_STRUCTURES[a.id];
  if (structure) next.structure = structure;
  delete next.variants;
  return next;
}

/**
 * The furniture set a generated archetype shows. A structure with a title band or
 * a repeat is a content slide; one of the titles or closing sections without a
 * title band is a cover, and so is every dark structure without one.
 */
function furnitureKind(structure: SlideStructureV1): 'content' | 'cover' {
  if (structure.repeat || structure.slots?.some((slot) => slot.band === 'title')) return 'content';
  if (structure.dark) return 'cover';
  return structure.section === 'titles' || structure.section === 'closing' ? 'cover' : 'content';
}

/**
 * The furniture a generated archetype shows, with what a picture under it asks: a
 * logo on a picture is left off, and a page number or footer on one takes the
 * master's scrim when the scrim covers it, or is left off when there is none.
 */
function furnitureOverPictures(shown: string[], placeholders: PlaceholderLayerV1[], config: MasterBuildConfigV1, book: FurnitureBookV1): string[] {
  const pictures = placeholders.filter((ph) => ph.kind === 'image').map((ph) => ph.box);
  const onPicture = (f: FurnitureLayerV1): boolean => pictures.some((box) => overlapping(f.box, box));
  const scrim = config.scrim ? book.get(config.scrim) : undefined;
  let needsScrim = false;
  const kept = shown.filter((id) => {
    const f = book.get(id);
    if (!f || !onPicture(f)) return true;
    if (f.kind === 'logo') return false;
    if (f.kind !== 'page-number' && f.kind !== 'footer') return true;
    if (scrim && covering(scrim.box, f.box)) {
      needsScrim = true;
      return true;
    }
    return false;
  });
  return needsScrim && scrim && !kept.includes(scrim.id) ? [scrim.id, ...kept] : kept;
}

/** One generated archetype, in this master's geometry and type. */
function generatedArchetype(
  structure: SlideStructureV1,
  id: string,
  library: SlideStructureLibraryV1,
  config: MasterBuildConfigV1,
  master: SlideMasterV1,
  book: FurnitureBookV1,
): ArchetypeV1 {
  const dark = structure.dark === true;
  const expanded = expandStructure(structure, config.grid, library);
  const placeholders = expanded.placeholders.map((ph): PlaceholderLayerV1 => {
    const out: PlaceholderLayerV1 = { ...ph };
    if (ph.kind !== 'image') out.style = styleFor(ph, structure, config, master, dark);
    out.prompt = promptFor(ph.role, ph.kind, ph.index, structure.id);
    // A label or a caption inside a cell stays empty when the source column had none.
    if (ph.group !== undefined && (ph.role === 'label' || ph.role === 'caption')) out.optional = true;
    return out;
  });
  const kind = furnitureKind(structure);
  const shown = furnitureOverPictures([...(kind === 'content'
    ? (dark ? config.furniture.contentDark : config.furniture.content)
    : (dark ? config.furniture.coverDark : config.furniture.cover))], placeholders, config, book);
  if (expanded.rule) {
    const ruleId = `rule-${structure.id}`;
    book.added.set(ruleId, { id: ruleId, kind: 'bar', box: expanded.rule, tokenPath: config.colours.rule });
    shown.unshift(ruleId);
  }
  const out: ArchetypeV1 = {
    id,
    name: structure.name,
    structure: structure.id,
    background: { tokenPath: dark ? config.colours.ground.dark : config.colours.ground.light, dark },
    furniture: shown,
    placeholders,
  };
  if (structure.repeat) {
    out.repeat = { ...structure.repeat };
    if (expanded.rule) out.repeat.rule = { ...expanded.rule };
  }
  return out;
}

/**
 * The mirror of a structure a tuned archetype restyles: that archetype turned left
 * to right, its placeholders and its furniture both, under the mirror's own id and
 * name. Image and text is Text and image reflected, panel and all.
 */
function mirroredArchetype(tuned: ArchetypeV1, structure: SlideStructureV1, id: string, book: FurnitureBookV1): ArchetypeV1 {
  const out: ArchetypeV1 = {
    id,
    name: structure.name,
    structure: structure.id,
    furniture: (tuned.furniture ?? []).map((f) => mirroredFurniture(f, book)),
    // Words keep their alignment: only the boxes move.
    placeholders: tuned.placeholders.map((ph) => ({ ...ph, box: reflect(ph.box) })),
  };
  if (tuned.background) out.background = { ...tuned.background };
  return out;
}

/**
 * Does a light archetype get a dark variant? Every light slide that shows the
 * content furniture does, and a mirror gets one exactly when what it mirrors does.
 */
function wantsDarkVariant(a: ArchetypeV1, config: MasterBuildConfigV1): boolean {
  if (a.background?.dark !== false) return false;
  const shown = new Set((a.furniture ?? []).map((id) => (id.startsWith(MIRROR_PREFIX) ? id.slice(MIRROR_PREFIX.length) : id)));
  return config.furniture.content.every((id) => shown.has(id));
}

/** The dark variant of a light archetype: the same geometry on the master's dark ground, with inks and furniture swapped. */
function darkVariant(a: ArchetypeV1, config: MasterBuildConfigV1, book: FurnitureBookV1): ArchetypeV1 {
  const inks = new Map<string, string>([
    [config.colours.ink.light, config.colours.ink.dark],
    [config.colours.figure.light, config.colours.figure.dark],
  ]);
  const furnitureIds = (a.furniture ?? []).flatMap((id) => {
    // A reflected entry takes the dark form of what it reflects, reflected again.
    const mirrored = id.startsWith(MIRROR_PREFIX);
    const own = mirrored ? id.slice(MIRROR_PREFIX.length) : id;
    if (!(own in config.darkFurniture)) return [id];
    const mapped = config.darkFurniture[own];
    if (!mapped) return [];
    return [mirrored ? mirroredFurniture(mapped, book) : mapped];
  });
  return {
    id: `${a.id}-dark`,
    name: `${a.name}, dark`,
    structure: a.structure ?? a.id,
    background: { tokenPath: config.colours.ground.dark, dark: true },
    furniture: furnitureIds,
    placeholders: a.placeholders.map((ph) => {
      if (!ph.style?.fgTokenPath) return { ...ph };
      return { ...ph, style: { ...ph.style, fgTokenPath: inks.get(ph.style.fgTokenPath) ?? config.colours.ink.dark } };
    }),
    ...(a.repeat ? { repeat: { ...a.repeat } } : {}),
    variantOf: a.id,
  };
}

/** One master rebuilt from its tuned archetypes and the library. */
export function buildMaster(current: SlideMasterV1, library: SlideStructureLibraryV1, config: MasterBuildConfigV1): SlideMasterV1 {
  const known = new Set<string>(KNOWN_ARCHETYPE_IDS);
  const tuned = current.archetypes.filter((a) => known.has(a.id)).map((a) => tunedArchetype(a, config));
  const restyled = new Map(tuned.map((a) => [a.structure ?? a.id, a]));
  const taken = new Set(tuned.map((a) => a.id));
  const onGrid = libraryOnGrid(library, config.grid);

  const configured = new Set(config.extraFurniture.map((f) => f.id));
  const keptFurniture = current.furniture.filter((f) => !configured.has(f.id) && !f.id.startsWith('rule-') && !f.id.startsWith(MIRROR_PREFIX));
  const base = new Map([...keptFurniture, ...config.extraFurniture].map((f) => [f.id, f]));
  const book: FurnitureBookV1 = { added: new Map(), get: (id) => base.get(id) ?? book.added.get(id) };

  const generated: ArchetypeV1[] = [];
  for (const id of library.expanded) {
    if (restyled.has(id)) continue;
    const structure = onGrid.structures.find((s) => s.id === id);
    if (!structure) throw new Error(`build-slide-masters: expanded names "${id}", which the library does not hold`);
    // A library id a tuned archetype already uses for another structure takes a suffix.
    const archetypeId = taken.has(id) ? `${id}-plain` : id;
    taken.add(archetypeId);
    const source = structure.mirror ? restyled.get(structure.mirror) : undefined;
    generated.push(source
      ? mirroredArchetype(source, structure, archetypeId, book)
      : generatedArchetype(structure, archetypeId, onGrid, config, current, book));
  }

  const light = [...tuned, ...generated];
  const variants: ArchetypeV1[] = [];
  for (const a of light) {
    if (!wantsDarkVariant(a, config)) continue;
    const variant = darkVariant(a, config, book);
    if (taken.has(variant.id)) throw new Error(`build-slide-masters: the dark variant ${variant.id} collides with an archetype id`);
    taken.add(variant.id);
    a.variants = { dark: variant.id };
    variants.push(variant);
  }

  const master: SlideMasterV1 = {
    ...current,
    version: config.version,
    archetypes: [...light, ...variants].map(archetype),
    furniture: [...keptFurniture, ...config.extraFurniture, ...book.added.values()].map(furniture),
  };
  if (config.description) master.description = config.description;
  return ordered(master, ['id', 'version', 'name', 'description', 'size', 'archetypes', 'furniture', 'typeScale', 'logo']);
}

/** A pack's masters file rebuilt: each master with a config is expanded, the rest kept. */
export function buildMastersFile(current: SlideMasterFileV1, library: SlideStructureLibraryV1, configs: readonly MasterBuildConfigV1[]): SlideMasterFileV1 {
  const masters = current.masters.map((m) => {
    const config = configs.find((c) => c.masterId === m.id);
    return config ? buildMaster(m, library, config) : m;
  });
  return { version: current.version, masters, library: { id: library.id, version: String(library.version) } };
}

/**
 * A masters file as JSON a person can read and a diff can follow: the file and each
 * master indented, one archetype header per line group, one placeholder or
 * furniture entry per line. Plain `JSON.stringify(value, null, 2)` would spend five
 * lines on every box.
 */
export function renderJson(file: SlideMasterFileV1): string {
  const one = (v: unknown): string => JSON.stringify(v);
  const lines: string[] = ['{', `  "version": ${one(file.version)},`, '  "masters": ['];
  file.masters.forEach((master, mi) => {
    lines.push('    {');
    const entries = Object.entries(master).filter(([, v]) => v !== undefined);
    entries.forEach(([key, value], ki) => {
      const comma = ki < entries.length - 1 ? ',' : '';
      if (key === 'archetypes' && Array.isArray(value)) {
        lines.push('      "archetypes": [');
        value.forEach((a: ArchetypeV1, ai) => {
          const fields = Object.entries(a).filter(([, v]) => v !== undefined);
          lines.push('        {');
          fields.forEach(([fk, fv], fi) => {
            const fcomma = fi < fields.length - 1 ? ',' : '';
            if (fk === 'placeholders' && Array.isArray(fv)) {
              lines.push('          "placeholders": [');
              fv.forEach((ph, pi) => {
                lines.push(`            ${one(ph)}${pi < fv.length - 1 ? ',' : ''}`);
              });
              lines.push(`          ]${fcomma}`);
            } else {
              lines.push(`          ${one(fk)}: ${one(fv)}${fcomma}`);
            }
          });
          lines.push(`        }${ai < value.length - 1 ? ',' : ''}`);
        });
        lines.push(`      ]${comma}`);
      } else if (key === 'furniture' && Array.isArray(value)) {
        lines.push('      "furniture": [');
        value.forEach((f, fi) => {
          lines.push(`        ${one(f)}${fi < value.length - 1 ? ',' : ''}`);
        });
        lines.push(`      ]${comma}`);
      } else {
        lines.push(`      ${one(key)}: ${one(value)}${comma}`);
      }
    });
    lines.push(`    }${mi < file.masters.length - 1 ? ',' : ''}`);
  });
  lines.push(file.library ? '  ],' : '  ]');
  if (file.library) lines.push(`  "library": ${one(file.library)}`);
  lines.push('}');
  return `${lines.join('\n')}\n`;
}

// ─── the run ─────────────────────────────────────────────────────────────────

export interface PlannedWriteV1 {
  file: string;
  content: string;
}

/** Every file the build writes, with its content, for the packs on disk (optionally one pack). */
export function planWrites(root: string = ROOT, opts: { pack?: string } = {}): PlannedWriteV1[] {
  const library = readLibrary(root);
  const problems = libraryProblems(library);
  if (problems.length > 0) throw new Error(`build-slide-masters: ${LIBRARY_FILE}\n  ${problems.join('\n  ')}`);
  const writes: PlannedWriteV1[] = [{ file: DATA_FILE, content: renderStructuresData(library) }];
  const packs = [...new Set(MASTER_BUILDS.map((c) => c.pack))].filter((p) => !opts.pack || p === opts.pack);
  for (const pack of packs) {
    const configs = MASTER_BUILDS.filter((c) => c.pack === pack);
    const file = configs[0]?.file;
    if (!file || !existsSync(join(root, file))) continue;
    const current = JSON.parse(readFileSync(join(root, file), 'utf8')) as SlideMasterFileV1;
    const next = buildMastersFile(current, library, configs);
    writes.push({ file, content: renderJson(next) });
    const neutral = next.masters.find((m) => m.id === 'lolly/slides/neutral');
    if (pack === 'lolly-start' && neutral) {
      writes.push({ file: NEUTRAL_FILE, content: withNeutralMaster(readFileSync(join(root, NEUTRAL_FILE), 'utf8'), neutral) });
    }
  }
  return writes;
}

function main(argv: string[]): number {
  const pack = argv.find((a) => a.startsWith('--pack='))?.slice('--pack='.length);
  const check = argv.includes('--check');
  if (pack && !MASTER_BUILDS.some((c) => c.pack === pack)) {
    console.error(`build-slide-masters: no master build for the pack "${pack}" (${MASTER_BUILDS.map((c) => c.pack).join(', ')})`);
    return 2;
  }
  const writes = planWrites(ROOT, pack ? { pack } : {});
  let drift = 0;
  for (const { file, content } of writes) {
    const abs = join(ROOT, file);
    const before = existsSync(abs) ? readFileSync(abs, 'utf8') : null;
    if (before === content) {
      console.log(`  unchanged ${file}`);
      continue;
    }
    drift += 1;
    if (check) {
      console.error(`  would change ${file}`);
      continue;
    }
    writeFileSync(abs, content);
    console.log(`  wrote ${file}`);
  }
  if (check && drift > 0) {
    console.error(`build-slide-masters: ${drift} generated file(s) are behind ${LIBRARY_FILE}; run node scripts/build-slide-masters.ts`);
    return 1;
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
