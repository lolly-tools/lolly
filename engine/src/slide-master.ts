// SPDX-License-Identifier: MPL-2.0
/**
 * Seeding Design frames from a slide master (plan 274 section 3.4).
 *
 * A master states geometry as fractions; Design wants authored px rows in one
 * global coordinate space (frames and their children share it, see
 * `packages/core/src/design-v1.ts`). This module is the only place that
 * conversion happens, so the review preview, the compile and Design's own
 * "New slide from archetype" all land on the same numbers.
 *
 * Three operations:
 *   - `seedFrame`   drop a frame with its placeholder and furniture layers;
 *   - `applyArchetype`  re-lay role-bound layers into a different archetype and
 *     leave unbound ones where the person put them;
 *   - `resetFrame`  put placeholder and furniture geometry back, which is what
 *     Reset Slide means in PowerPoint.
 *
 * Every seeded layer keeps `master` plus either `role` or `furniture`, and that
 * binding is what the other two operations read. A layer with no binding is never
 * moved by either of them. A role-bound layer also carries its slot number in its
 * id (`f.body`, `f.body-2`), and that number is what a re-layout reads, so moving a
 * layer up or down the z-order cannot swap two columns.
 *
 * From plan 275 an archetype may hold a repeat (Three boxes, Six boxes). The build
 * (`scripts/build-slide-masters.ts`) writes the expanded cells into the master, each
 * placeholder carrying its `group` and `index`, and this module reads that one flat
 * list: a `repeat` is never expanded at runtime, so the seed, the pptx lowering, the
 * matcher and the catalog rules all see the same slots. `validate:catalog` refuses
 * an archetype that states a repeat without its cells. A seeded frame lists its cells
 * in reading order, and an `optional` placeholder (a label a source column may not
 * have) can be left unseeded.
 *
 * The logo mark is chosen from the background UNDER the logo box, not from the frame
 * background: a split archetype paints a dark panel down one side, and the mark that
 * sits on that panel is the reverse one even though the slide is white. An archetype
 * that states `dark` has the last word on its own background, so a master says what it
 * means without the token needing to resolve first.
 *
 * Pure: no DOM, no clock, no network, no filesystem. Colour tokens are resolved by
 * an injected function, so the engine never reads a design system itself.
 */

import type {
  ArchetypeRefV1,
  ArchetypeRoleV1,
  ArchetypeV1,
  DesignBoxRowV1,
  FurnitureLayerV1,
  MasterBoxV1,
  MasterTextStyleV1,
  PlaceholderLayerV1,
  SlideMasterV1,
} from '@lolly-tools/core';
import { findArchetype, roleFontSize } from '@lolly-tools/core';
import { contrastRatio } from './brand-derive.ts';
import { bgIsDark, pickLogoVariant, type LogoSetV1 } from './logo-variant.ts';

/** Resolves a design-system token path to a hex colour. Absent means "leave it unset". */
export type TokenResolver = (path: string) => string | undefined;

export interface SeedFrameOptsV1 {
  /** The frame layer's id. Placeholder and furniture ids are derived from `idPrefix` or this. */
  frameId: string;
  /** The frame origin in Design's global coordinate space, in px. */
  x: number;
  y: number;
  /** The frame's name in the layer list. Defaults to the archetype's name. */
  name?: string;
  /** Prefix for the child layer ids. Defaults to `frameId`. */
  idPrefix?: string;
  /**
   * The frame's place in the page sequence. `order` is Design's frame-only field: it
   * sorts the artboards into slides, so a compile that seeds a deck numbers them here.
   * Child layers never carry it; their paint order is the order they are returned in.
   */
  order?: number;
  /** Turns a master token path into a hex colour. */
  resolveToken?: TokenResolver;
  /** Logo asset ids or urls per variant; the background under each logo picks one. */
  logos?: LogoSetV1<string>;
  /** Overrides the mono preference the background would otherwise decide. */
  monoLogo?: boolean;
  /**
   * Leave out the placeholders the master marks `optional`, so a cell label the
   * content has nothing for is not drawn as an empty placeholder. Seeded by default.
   */
  omitOptional?: boolean;
}

/** One cell of a seeded repeat: the layers that share a `group`, in reading order. */
export interface SeededCellV1 {
  group: string;
  /** Position in the repeat, 0-based, in reading order. */
  index: number;
  /** Ids of the cell's seeded layers, in the order the master declares them. */
  layerIds: string[];
  /** Ids among `layerIds` whose placeholder is `optional`. */
  optionalIds: string[];
}

export interface SeededFrameV1 {
  frame: DesignBoxRowV1;
  layers: DesignBoxRowV1[];
  /** The archetype's cells in reading order. Present when its placeholders are grouped. */
  cells?: SeededCellV1[];
}

export interface RelayoutOptsV1 {
  /** The frame origin in px, when the caller knows it. Otherwise it is read back from the bound layers. */
  x?: number;
  y?: number;
  resolveToken?: TokenResolver;
  /**
   * Logo asset ids or urls per variant. Given these, a logo layer takes the mark the
   * TARGET archetype's background asks for, so a slide moved from dark to light does
   * not keep the reverse mark. Left out, the layer keeps the mark it has.
   */
  logos?: LogoSetV1<string>;
  /** Overrides the mono preference the background would otherwise decide. */
  monoLogo?: boolean;
}

const ROUND = (n: number): number => Math.round(n * 1e4) / 1e4;

/** The text style fields a master owns. A re-layout clears these before restating them. */
const STYLE_FIELDS = ['fontSize', 'weight', 'align', 'valign', 'font', 'fg'] as const;

/** Design's own layer kind for a placeholder. It has no table primitive, so `table` is text. */
function designKind(kind: PlaceholderLayerV1['kind']): string {
  return kind === 'image' ? 'image' : 'text';
}

/** Design's own layer kind for furniture. Bars and rectangles are plain boxes. */
function furnitureKind(kind: FurnitureLayerV1['kind']): string {
  if (kind === 'logo') return 'image';
  if (kind === 'bar' || kind === 'rect') return 'box';
  return 'text';
}

function colourOf(hex: string | undefined, tokenPath: string | undefined, resolve?: TokenResolver): string | undefined {
  if (typeof hex === 'string' && hex) return hex;
  if (typeof tokenPath === 'string' && tokenPath && resolve) {
    const v = resolve(tokenPath);
    if (typeof v === 'string' && v) return v;
  }
  return undefined;
}

/**
 * A master box in px, offset by the frame origin.
 *
 * The far edge is rounded before the width is taken, so two boxes that share an edge
 * in fractions still share it in px at every master size. Rounding the width on its
 * own opens a one-pixel hairline between the segments of a colour bar, which is the
 * gap `addChrome` in deck-studio compensates for with a `+1` per segment.
 */
function place(box: MasterBoxV1, master: SlideMasterV1, ox: number, oy: number): {
  x: number; y: number; w: number; h: number;
} {
  const { width, height } = master.size;
  const x = Math.round(ox + box.x * width);
  const y = Math.round(oy + box.y * height);
  return {
    x,
    y,
    w: Math.round(ox + (box.x + box.w) * width) - x,
    h: Math.round(oy + (box.y + box.h) * height) - y,
  };
}

/** How much of `box` the box `over` covers, as a fraction of `box`. */
function coveredFraction(box: MasterBoxV1, over: MasterBoxV1): number {
  const w = Math.min(box.x + box.w, over.x + over.w) - Math.max(box.x, over.x);
  const h = Math.min(box.y + box.h, over.y + over.h) - Math.max(box.y, over.y);
  if (w <= 0 || h <= 0) return 0;
  const area = box.w * box.h;
  return area > 0 ? (w * h) / area : 0;
}

/** Write the text style fields a row carries. Only fields the master states are written. */
function applyTextStyle(
  row: DesignBoxRowV1,
  master: SlideMasterV1,
  role: ArchetypeRoleV1 | undefined,
  style: MasterTextStyleV1 | undefined,
  resolve?: TokenResolver,
): void {
  if (role) row.fontSize = roleFontSize(master, role, style);
  else if (style && typeof style.fontSize === 'number') row.fontSize = style.fontSize;
  if (!style) return;
  if (style.weight) row.weight = style.weight;
  if (style.align) row.align = style.align;
  if (style.valign) row.valign = style.valign;
  if (style.font) row.font = style.font;
  const fg = colourOf(style.fg, style.fgTokenPath, resolve);
  if (fg) row.fg = fg;
}

/**
 * Drop the style fields the master owns, so a re-layout states the target archetype's
 * type rather than leaving the previous one's weight or colour behind. Fields Design
 * owns (the text itself, line height, the rest of the row) are untouched.
 */
function clearTextStyle(row: DesignBoxRowV1): void {
  for (const key of STYLE_FIELDS) delete row[key];
}

/** A readable layer name, so the layer list is not a wall of ids. */
function roleName(role: ArchetypeRoleV1, ordinal: number): string {
  const label = role.charAt(0).toUpperCase() + role.slice(1);
  return ordinal > 1 ? `${label} ${ordinal}` : label;
}

/**
 * An archetype's placeholders, in reading order: the flat list the master states.
 * The build writes every cell of a repeat into it, so nothing is expanded here.
 */
export function archetypePlaceholders(archetype: ArchetypeV1): PlaceholderLayerV1[] {
  return archetype.placeholders;
}

/**
 * The furniture an archetype shows, in paint order: backdrop rectangles first, then
 * everything else. That is what puts a split panel and a caption scrim under the words
 * while the logo, page number, footer and colour bars stay above them.
 */
function shownFurniture(master: SlideMasterV1, archetype: ArchetypeV1): FurnitureLayerV1[] {
  const chosen = (archetype.furniture ?? [])
    .map((id) => master.furniture.find((f) => f.id === id))
    .filter((f): f is FurnitureLayerV1 => f !== undefined);
  return [...chosen.filter((f) => f.kind === 'rect'), ...chosen.filter((f) => f.kind !== 'rect')];
}

/** What the logos of one archetype sit on: per logo id, and the frame's own answer. */
interface LogoDarknessV1 {
  frameDark: boolean;
  byFurniture: Map<string, boolean>;
}

/**
 * Is the background under each logo of this archetype dark?
 *
 * The painted furniture is replayed in paint order; a logo reads the last painted
 * rectangle or bar that covers at least half of it. With nothing painted under it the
 * frame background answers, and there the archetype's own `dark` statement wins over a
 * measurement, so a master that calls its gradient dark is believed. A logo this
 * archetype does not show has no entry, and `frameDark` is the answer for it.
 */
function logoDarkness(
  master: SlideMasterV1,
  archetype: ArchetypeV1,
  resolve?: TokenResolver,
): LogoDarknessV1 {
  const frameBg = colourOf(archetype.background?.hex, archetype.background?.tokenPath, resolve);
  const frameDark = archetype.background?.dark ?? (frameBg ? bgIsDark(frameBg) : false);
  const painted: Array<{ box: MasterBoxV1; dark: boolean }> = [];
  const byFurniture = new Map<string, boolean>();
  for (const f of shownFurniture(master, archetype)) {
    if (f.kind === 'bar' || f.kind === 'rect') {
      const fill = colourOf(f.hex, f.tokenPath, resolve);
      if (fill) painted.push({ box: f.box, dark: bgIsDark(fill) });
      continue;
    }
    if (f.kind !== 'logo') continue;
    let under: boolean | undefined;
    for (let i = painted.length - 1; i >= 0; i -= 1) {
      const layer = painted[i];
      if (layer && coveredFraction(f.box, layer.box) >= 0.5) {
        under = layer.dark;
        break;
      }
    }
    byFurniture.set(f.id, under ?? frameDark);
  }
  return { frameDark, byFurniture };
}

/**
 * Seed one Design frame from an archetype.
 *
 * Paint order is image placeholders, then backdrop furniture (`rect`), then the
 * text and table placeholders, then the remaining furniture. Images going down
 * first is what `layoutToBoxes` in `views/deck-editor.ts` has always done, so a
 * full-image caption is painted over its cover; the backdrop pass between the two
 * is what puts a split archetype's panel and a caption scrim under the words while
 * the logo, page number, footer and colour bars stay above everything.
 *
 * Returns the frame row and its child layers, each already carrying `frame`, `master`
 * and its binding, in paint order. An unknown archetype id returns null rather than
 * inventing one.
 */
export function seedFrame(
  master: SlideMasterV1,
  archetypeId: ArchetypeRefV1,
  opts: SeedFrameOptsV1,
): SeededFrameV1 | null {
  const archetype = findArchetype(master, archetypeId);
  if (!archetype) return null;
  const prefix = opts.idPrefix ?? opts.frameId;
  const resolve = opts.resolveToken;
  const bg = colourOf(archetype.background?.hex, archetype.background?.tokenPath, resolve);
  // One rounded origin for the frame and every child, so a frame dropped at a
  // fractional x cannot shift its own layers by a pixel against it.
  const ox = Math.round(opts.x);
  const oy = Math.round(opts.y);

  const frame: DesignBoxRowV1 = {
    id: opts.frameId,
    kind: 'frame',
    x: ox,
    y: oy,
    w: master.size.width,
    h: master.size.height,
    name: opts.name ?? archetype.name,
    master: master.id,
    archetype: archetype.id,
    order: typeof opts.order === 'number' ? opts.order : 0,
  };
  if (bg) frame.bg = bg;

  const darkness = logoDarkness(master, archetype, resolve);
  const markFor = (f: FurnitureLayerV1): string | null => {
    if (!master.logo.variantByBackground || !opts.logos) return null;
    const picked = pickLogoVariant({
      background: bg,
      dark: darkness.byFurniture.get(f.id) ?? darkness.frameDark,
      logos: opts.logos,
      mono: opts.monoLogo,
    });
    return picked ? picked.value : null;
  };

  const shown = shownFurniture(master, archetype);
  const backdrop = shown.filter((f) => f.kind === 'rect');
  const overlay = shown.filter((f) => f.kind !== 'rect');

  const layers: DesignBoxRowV1[] = [];

  const pushFurniture = (f: FurnitureLayerV1): void => {
    const row: DesignBoxRowV1 = {
      id: `${prefix}.${f.id}`,
      kind: furnitureKind(f.kind),
      ...place(f.box, master, ox, oy),
      frame: opts.frameId,
      master: master.id,
      furniture: f.id,
      name: f.id,
    };
    if (f.kind === 'logo') {
      row.fit = 'contain';
      const mark = markFor(f);
      if (mark) row.image = mark;
    } else if (f.kind === 'bar' || f.kind === 'rect') {
      const fill = colourOf(f.hex, f.tokenPath, resolve);
      if (fill) row.bg = fill;
    } else {
      row.text = f.text ?? '';
      const role: ArchetypeRoleV1 = f.kind === 'page-number' ? 'number' : 'label';
      applyTextStyle(row, master, role, f.style, resolve);
    }
    layers.push(row);
  };

  // Ordinals count across the whole archetype, not per pass, so an id stays the same
  // whichever pass emits the placeholder.
  const placeholders = archetypePlaceholders(archetype);
  const ordinals = new Map<PlaceholderLayerV1, number>();
  const seen = new Map<ArchetypeRoleV1, number>();
  for (const ph of placeholders) {
    const ordinal = (seen.get(ph.role) ?? 0) + 1;
    seen.set(ph.role, ordinal);
    ordinals.set(ph, ordinal);
  }
  const idOf = (ph: PlaceholderLayerV1): string => {
    const ordinal = ordinals.get(ph) ?? 1;
    return ordinal > 1 ? `${prefix}.${ph.role}-${ordinal}` : `${prefix}.${ph.role}`;
  };
  // An omitted optional slot keeps its ordinal, so the ids of the others do not move.
  const seeded = placeholders.filter((ph) => !(opts.omitOptional && ph.optional));

  const pushPlaceholder = (ph: PlaceholderLayerV1): void => {
    const row: DesignBoxRowV1 = {
      id: idOf(ph),
      kind: designKind(ph.kind),
      ...place(ph.box, master, ox, oy),
      frame: opts.frameId,
      master: master.id,
      role: ph.role,
      name: roleName(ph.role, ordinals.get(ph) ?? 1),
    };
    if (ph.kind === 'image') {
      row.image = '';
      row.fit = ph.fit ?? 'contain';
    } else {
      row.text = '';
      applyTextStyle(row, master, ph.role, ph.style, resolve);
    }
    layers.push(row);
  };

  for (const ph of seeded) if (ph.kind === 'image') pushPlaceholder(ph);
  for (const f of backdrop) pushFurniture(f);
  for (const ph of seeded) if (ph.kind !== 'image') pushPlaceholder(ph);
  for (const f of overlay) pushFurniture(f);

  const cells = cellsOf(seeded, idOf);
  return cells.length > 0 ? { frame, layers, cells } : { frame, layers };
}

/** The grouped placeholders as cells, ordered by index and then by first appearance. */
function cellsOf(placeholders: PlaceholderLayerV1[], idOf: (ph: PlaceholderLayerV1) => string): SeededCellV1[] {
  const byGroup = new Map<string, SeededCellV1 & { first: number }>();
  placeholders.forEach((ph, at) => {
    if (ph.group === undefined) return;
    let cell = byGroup.get(ph.group);
    if (!cell) {
      cell = { group: ph.group, index: ph.index ?? byGroup.size, layerIds: [], optionalIds: [], first: at };
      byGroup.set(ph.group, cell);
    }
    const id = idOf(ph);
    cell.layerIds.push(id);
    if (ph.optional) cell.optionalIds.push(id);
  });
  return [...byGroup.values()]
    .sort((a, b) => (a.index - b.index) || (a.first - b.first))
    .map(({ first: _first, ...cell }) => cell);
}

/**
 * A number off a row. Design's block values arrive as strings after a URL, a `?z=`
 * document or a session round trip (`decodeBlocksCompact` writes every non-asset,
 * non-colour field back as text), so a row that states "44" states 44.
 */
function rowNumber(row: DesignBoxRowV1, key: string): number | null {
  const v = row[key];
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string' || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function rowText(row: DesignBoxRowV1, key: string): string | null {
  const v = row[key];
  return typeof v === 'string' && v ? v : null;
}

/** The placeholders of an archetype for one role, in declared order. */
function placeholdersFor(archetype: ArchetypeV1, role: ArchetypeRoleV1): PlaceholderLayerV1[] {
  return archetypePlaceholders(archetype).filter((p) => p.role === role);
}

/**
 * The slot a seeded id claims: `f.body` is the first body slot, `f.body-2` the second.
 * Null when the id was not minted by `seedFrame`, and then array order answers instead.
 */
function ordinalFromId(id: string | null, role: string): number | null {
  if (!id) return null;
  const dot = id.lastIndexOf('.');
  const tail = dot >= 0 ? id.slice(dot + 1) : id;
  if (tail === role) return 0;
  if (!tail.startsWith(`${role}-`)) return null;
  const n = Number(tail.slice(role.length + 1));
  return Number.isInteger(n) && n >= 2 ? n - 1 : null;
}

/**
 * Which archetype slot each role-bound layer claims, keyed by its index in the array.
 *
 * The seeded id states the slot, so the two columns of a two-column slide keep their
 * own content when one of them is brought to the front. A layer whose id says nothing
 * takes the lowest slot no other layer of that role has claimed, in array order.
 */
function roleOrdinals(layers: DesignBoxRowV1[]): Map<number, number> {
  const out = new Map<number, number>();
  const taken = new Map<string, Set<number>>();
  const pending: Array<{ index: number; role: string }> = [];
  layers.forEach((row, index) => {
    if (rowText(row, 'furniture')) return;
    const role = rowText(row, 'role');
    if (!role) return;
    let set = taken.get(role);
    if (!set) {
      set = new Set<number>();
      taken.set(role, set);
    }
    const claimed = ordinalFromId(rowText(row, 'id'), role);
    if (claimed !== null && !set.has(claimed)) {
      set.add(claimed);
      out.set(index, claimed);
      return;
    }
    pending.push({ index, role });
  });
  for (const { index, role } of pending) {
    const set = taken.get(role) ?? new Set<number>();
    let n = 0;
    while (set.has(n)) n += 1;
    set.add(n);
    taken.set(role, set);
    out.set(index, n);
  }
  return out;
}

/**
 * Work out the frame origin from the layers themselves. Each bound layer states
 * one candidate origin; the most common candidate wins, so a couple of layers the
 * person dragged cannot move the whole frame. Ties keep the first candidate seen.
 *
 * Null when no bound layer states one, which is the caller's signal to leave the
 * layers alone rather than move a whole slide to the canvas origin.
 */
function deriveOrigin(
  master: SlideMasterV1,
  archetype: ArchetypeV1,
  layers: DesignBoxRowV1[],
  ordinals: Map<number, number>,
  opts?: RelayoutOptsV1,
): { x: number; y: number } | null {
  if (typeof opts?.x === 'number' && typeof opts?.y === 'number') {
    return { x: Math.round(opts.x), y: Math.round(opts.y) };
  }
  const counts = new Map<string, { x: number; y: number; n: number; first: number }>();
  const add = (box: MasterBoxV1, row: DesignBoxRowV1, index: number): void => {
    const lx = rowNumber(row, 'x');
    const ly = rowNumber(row, 'y');
    if (lx === null || ly === null) return;
    const ox = Math.round(lx - box.x * master.size.width);
    const oy = Math.round(ly - box.y * master.size.height);
    const key = `${ox}:${oy}`;
    const hit = counts.get(key);
    if (hit) hit.n += 1;
    else counts.set(key, { x: ox, y: oy, n: 1, first: index });
  };

  layers.forEach((row, index) => {
    const furnitureId = rowText(row, 'furniture');
    if (furnitureId) {
      const f = master.furniture.find((item) => item.id === furnitureId);
      if (f) add(f.box, row, index);
      return;
    }
    const role = rowText(row, 'role') as ArchetypeRoleV1 | null;
    if (!role) return;
    const ph = placeholdersFor(archetype, role)[ordinals.get(index) ?? 0];
    if (ph) add(ph.box, row, index);
  });

  let best: { x: number; y: number; n: number; first: number } | null = null;
  for (const candidate of counts.values()) {
    if (!best || candidate.n > best.n || (candidate.n === best.n && candidate.first < best.first)) best = candidate;
  }
  return best ? { x: best.x, y: best.y } : null;
}

/** A box that is not a content box takes a picture only when it covers at least this share of the slide. */
const PICTURE_BOX_MIN_SHARE = 0.08;

/** A picture box covering this share of the slide is full-bleed: words there would sit over every other box. */
const FULL_BLEED_SHARE = 0.9;

/** The gap between the parts of a shared box, as a share of the master width. */
const SHARED_GUTTER_SHARE = 0.015;

/** The contrast an ink must reach on its ground to be chosen without comparing: WCAG AA for body text. */
const INK_CONTRAST = 4.5;

/**
 * Which free box waiting words prefer, lowest first: the content boxes, then the
 * boxes for short lines, then a picture box. A title reads as a heading wherever
 * it goes, so the same order serves it.
 */
const WORD_BOX_RANK: Readonly<Record<ArchetypeRoleV1, number>> = {
  body: 0, data: 0, quote: 0, subtitle: 1, attribution: 2, caption: 2, label: 3, number: 4, visual: 5, title: 9,
};

/** Roles whose box can be shared by content no other box holds. */
const SHAREABLE_ROLES: ReadonlySet<ArchetypeRoleV1> = new Set<ArchetypeRoleV1>(['body', 'data', 'quote', 'visual', 'caption']);

/** Does this role-bound layer hold content: words, or a picture? An empty placeholder does not. */
function holdsContent(row: DesignBoxRowV1): boolean {
  const kind = rowText(row, 'kind');
  if (kind === 'image') return rowText(row, 'image') !== null;
  return (rowText(row, 'text') ?? '').trim().length > 0;
}

/** Six hex digits and an alpha from 0 to 1, or null for a colour this module does not read. */
function hexAlpha(colour: string): { hex: string; alpha: number } | null {
  let s = colour.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3,4}$/.test(s)) s = s.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(s)) return null;
  return { hex: `#${s.slice(0, 6).toLowerCase()}`, alpha: s.length === 8 ? Number.parseInt(s.slice(6, 8), 16) / 255 : 1 };
}

/** `top` painted over `under`, both colours; the answer is opaque. */
function paintOver(top: string, under: string | undefined): string | undefined {
  const t = hexAlpha(top);
  if (!t) return under;
  const u = under ? hexAlpha(under) : null;
  if (t.alpha >= 1 || !u) return t.hex;
  const channel = (i: number): number => {
    const a = Number.parseInt(t.hex.slice(1 + i * 2, 3 + i * 2), 16);
    const b = Number.parseInt(u.hex.slice(1 + i * 2, 3 + i * 2), 16);
    return Math.round(a * t.alpha + b * (1 - t.alpha));
  };
  return `#${[0, 1, 2].map((i) => channel(i).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * The colour under a box of this archetype: the frame's ground with every shown
 * rectangle or bar that covers at least half the box painted over it in paint
 * order. Undefined when the ground does not resolve.
 */
function groundUnder(master: SlideMasterV1, archetype: ArchetypeV1, box: MasterBoxV1, resolve?: TokenResolver): string | undefined {
  let ground = colourOf(archetype.background?.hex, archetype.background?.tokenPath, resolve);
  ground = ground ? paintOver(ground, '#ffffff') : undefined;
  for (const f of shownFurniture(master, archetype)) {
    if (f.kind !== 'bar' && f.kind !== 'rect') continue;
    const fill = colourOf(f.hex, f.tokenPath, resolve);
    if (fill && coveredFraction(box, f.box) >= 0.5) ground = paintOver(fill, ground);
  }
  return ground;
}

/**
 * The ink for words in a box that was not drawn for them: a picture box, or a box
 * of another role. The first ink that reads on the ground under the box wins, in
 * this order: the style the box offers, the target's text boxes, then every text
 * ink the master states. With none reaching `INK_CONTRAST`, the one that contrasts
 * most. Undefined when the ground or every ink is unresolved, which leaves the
 * style's own answer in place.
 */
function inkFor(
  master: SlideMasterV1,
  archetype: ArchetypeV1,
  box: MasterBoxV1,
  preferred: MasterTextStyleV1 | undefined,
  resolve?: TokenResolver,
): string | undefined {
  const ground = groundUnder(master, archetype, box, resolve);
  if (!ground) return undefined;
  const styles: Array<MasterTextStyleV1 | undefined> = [
    preferred,
    ...archetype.placeholders.filter((p) => p.kind !== 'image').map((p) => p.style),
    ...master.archetypes.flatMap((a) => a.placeholders.filter((p) => p.kind !== 'image').map((p) => p.style)),
    ...master.furniture.map((f) => f.style),
  ];
  let best: { hex: string; ratio: number } | undefined;
  const seen = new Set<string>();
  for (const style of styles) {
    const raw = style ? colourOf(style.fg, style.fgTokenPath, resolve) : undefined;
    const hex = raw ? paintOver(raw, ground) : undefined;
    if (!hex || seen.has(hex)) continue;
    seen.add(hex);
    const ratio = contrastRatio(hex, ground);
    if (!Number.isFinite(ratio)) continue;
    if (ratio >= INK_CONTRAST) return hex;
    if (!best || ratio > best.ratio) best = { hex, ratio };
  }
  return best?.hex;
}

/** Where the role-bound layers of a frame go in a target archetype. */
export interface ArchetypeSlotsV1 {
  /**
   * Per layer, in the order given: the target slot it fills, as `<role>#<n>` with
   * `n` counted from 1 among the target's slots of that role (the ordinal a seeded
   * id states), or null for furniture, unbound layers, layers sharing a box and
   * layers left where they were.
   */
  slotKeys: Array<string | null>;
  /**
   * Layers that hold content and found no box of their own, so they share the
   * largest content box with what fills it, split side by side or one above the
   * other. Each keeps its role.
   */
  shared: number[];
  /** Layers that hold content and kept their place: the target has no box they could share. */
  unplaced: number[];
}

interface SlotPlanV1 {
  origin: { x: number; y: number };
  slotOf: Map<number, PlaceholderLayerV1>;
  /** The part of a shared box a layer takes, in px, for the occupant and each sharer. */
  cellOf: Map<number, { x: number; y: number; w: number; h: number }>;
  slots: ArchetypeSlotsV1;
}

/**
 * Assign every role-bound layer of a frame to a box of the target archetype.
 *
 * A layer takes its own role's slot by ordinal first. A layer that holds words or
 * a picture and has no slot of its role left takes the next free box: a picture
 * the picture box, then the largest free content box; words the free box whose
 * role ranks first in `WORD_BOX_RANK`, never a full-bleed picture box, which
 * would put them over every other box. Content still without a box shares the
 * largest box that holds content, so nothing overlaps and nothing is lost; only
 * when the target has no such box does a layer keep its place.
 */
function planSlots(
  master: SlideMasterV1,
  from: ArchetypeV1,
  to: ArchetypeV1,
  layers: DesignBoxRowV1[],
  opts?: RelayoutOptsV1,
): SlotPlanV1 | null {
  const ordinals = roleOrdinals(layers);
  const origin = deriveOrigin(master, from, layers, ordinals, opts);
  if (!origin) return null;

  const targets = archetypePlaceholders(to);
  const claimed = new Set<PlaceholderLayerV1>();
  const slotOf = new Map<number, PlaceholderLayerV1>();
  const waiting: number[] = [];
  layers.forEach((row, index) => {
    if (rowText(row, 'furniture')) return;
    const role = rowText(row, 'role') as ArchetypeRoleV1 | null;
    if (!role) return;
    const ph = placeholdersFor(to, role)[ordinals.get(index) ?? 0];
    if (ph && !claimed.has(ph)) {
      claimed.add(ph);
      slotOf.set(index, ph);
    } else if (holdsContent(row)) {
      waiting.push(index);
    }
  });
  const area = (ph: PlaceholderLayerV1): number => ph.box.w * ph.box.h;
  const order = new Map(targets.map((ph, i) => [ph, i]));
  const byOrder = (a: PlaceholderLayerV1, b: PlaceholderLayerV1): number => (order.get(a) ?? 0) - (order.get(b) ?? 0);
  const left: number[] = [];
  waiting
    .sort((a, b) => (rowNumber(layers[a] as DesignBoxRowV1, 'y') ?? 0) - (rowNumber(layers[b] as DesignBoxRowV1, 'y') ?? 0)
      || (rowNumber(layers[a] as DesignBoxRowV1, 'x') ?? 0) - (rowNumber(layers[b] as DesignBoxRowV1, 'x') ?? 0) || a - b)
    .forEach((index) => {
      const row = layers[index] as DesignBoxRowV1;
      const free = targets.filter((ph) => !claimed.has(ph));
      let ph: PlaceholderLayerV1 | undefined;
      if (rowText(row, 'kind') === 'image') {
        ph = free.find((one) => one.kind === 'image')
          ?? free.filter((one) => one.role === 'body' || one.role === 'data' || one.role === 'quote' || one.role === 'visual')
            .sort((a, b) => area(b) - area(a))[0]
          ?? free.find((one) => one.role !== 'title' && one.role !== 'subtitle' && area(one) >= PICTURE_BOX_MIN_SHARE);
      } else {
        ph = free
          .filter((one) => one.role !== 'title' && !(one.kind === 'image' && area(one) >= FULL_BLEED_SHARE))
          .sort((a, b) => WORD_BOX_RANK[a.role] - WORD_BOX_RANK[b.role] || byOrder(a, b))[0];
      }
      if (ph) {
        claimed.add(ph);
        slotOf.set(index, ph);
      } else {
        left.push(index);
      }
    });

  // Content with no box shares the largest box that holds content. The box is cut
  // across its longer side into equal parts, its own content first.
  const cellOf = new Map<number, { x: number; y: number; w: number; h: number }>();
  const shared: number[] = [];
  const unplaced: number[] = [];
  if (left.length > 0) {
    const hosts = [...slotOf.entries()]
      .filter(([index, ph]) => SHAREABLE_ROLES.has(ph.role) && holdsContent(layers[index] as DesignBoxRowV1))
      .sort(([, a], [, b]) => area(b) - area(a) || byOrder(a, b));
    const host = hosts[0];
    if (host) {
      const [hostIndex, hostPh] = host;
      const box = place(hostPh.box, master, origin.x, origin.y);
      const members = [hostIndex, ...left];
      const n = members.length;
      const gutter = Math.round(master.size.width * SHARED_GUTTER_SHARE);
      const across = box.w >= box.h;
      const span = across ? box.w : box.h;
      members.forEach((index, k) => {
        const start = Math.round((k * (span + gutter)) / n);
        const end = Math.round(((k + 1) * (span + gutter)) / n) - gutter;
        const cell = across
          ? { x: box.x + start, y: box.y, w: Math.max(1, end - start), h: box.h }
          : { x: box.x, y: box.y + start, w: box.w, h: Math.max(1, end - start) };
        cellOf.set(index, cell);
        if (k > 0) {
          slotOf.set(index, hostPh);
          shared.push(index);
        }
      });
    } else {
      unplaced.push(...left);
    }
  }

  const keyOf = new Map<PlaceholderLayerV1, string>();
  const seen = new Map<ArchetypeRoleV1, number>();
  for (const ph of targets) {
    const n = (seen.get(ph.role) ?? 0) + 1;
    seen.set(ph.role, n);
    keyOf.set(ph, `${ph.role}#${n}`);
  }
  const sharedSet = new Set(shared);
  const slotKeys = layers.map((_, index) => {
    const ph = slotOf.get(index);
    return ph && !sharedSet.has(index) ? (keyOf.get(ph) ?? null) : null;
  });
  return { origin, slotOf, cellOf, slots: { slotKeys, shared, unplaced } };
}

/**
 * Where each role-bound layer of a frame goes when it moves from one archetype to
 * another, without moving anything: the slot each fills, the layers that share a
 * box, and the layers left where they were. `applyArchetype` places layers by this
 * same answer, so a caller that rebuilds a frame around it (reseeding the empty
 * slots, reporting what did not fit) reads the placement the layers now show.
 * Null when either archetype is unknown or the frame origin cannot be read.
 */
export function archetypeSlots(
  master: SlideMasterV1,
  fromArchetypeId: ArchetypeRefV1,
  toArchetypeId: ArchetypeRefV1,
  layers: DesignBoxRowV1[],
  opts?: RelayoutOptsV1,
): ArchetypeSlotsV1 | null {
  const from = findArchetype(master, fromArchetypeId);
  const to = findArchetype(master, toArchetypeId);
  if (!from || !to) return null;
  return planSlots(master, from, to, layers, opts)?.slots ?? null;
}

/**
 * Re-lay a frame's layers from one archetype into another.
 *
 * A role-bound layer takes the geometry and type style of the target archetype's
 * placeholder for the same role, matched by the slot its id states: the second `body`
 * layer takes the second `body` placeholder wherever it sits in the array. Then every
 * box takes every kind of content (plan 275 decision 30): a layer that holds words or a
 * picture and whose role the target has no slot left for takes the next free box of the
 * target (see `planSlots`), and content still without a box shares the largest box that
 * holds content, cut into parts, so nothing overlaps and nothing is lost. A picture in a
 * text box is fitted `contain`; text in a box of another role or kind takes the box's
 * type, or the target's body type in a picture box, in an ink that reads on the ground
 * under the box. A layer's own role never changes, so its content keeps its name. Only
 * when the target has no box that holds content does a layer keep its place, and
 * `archetypeSlots` names those. An empty placeholder with no slot stays where it is. The
 * target's type style is authoritative: a weight or colour the previous archetype stated
 * and this one does not is dropped, not carried over. Furniture geometry is master-level,
 * so it is put back as the master states it, and a logo takes the mark the target's
 * background asks for when the caller passes `logos`. Everything else is returned
 * untouched, by reference.
 *
 * Which furniture the target archetype SHOWS is the caller's call: this function does
 * not add or drop layers.
 */
export function applyArchetype(
  master: SlideMasterV1,
  fromArchetypeId: ArchetypeRefV1,
  toArchetypeId: ArchetypeRefV1,
  layers: DesignBoxRowV1[],
  opts?: RelayoutOptsV1,
): DesignBoxRowV1[] {
  const from = findArchetype(master, fromArchetypeId);
  const to = findArchetype(master, toArchetypeId);
  if (!from || !to) return layers.slice();
  const plan = planSlots(master, from, to, layers, opts);
  if (!plan) return layers.slice();
  const { origin, slotOf, cellOf } = plan;
  const resolve = opts?.resolveToken;
  const targetBg = colourOf(to.background?.hex, to.background?.tokenPath, resolve);
  const darkness = logoDarkness(master, to, resolve);
  const logos = opts?.logos;
  const bodyStyle = to.placeholders.find((one) => one.role === 'body' && one.kind !== 'image')?.style;

  return layers.map((row, index) => {
    const furnitureId = rowText(row, 'furniture');
    if (furnitureId) {
      const f = master.furniture.find((item) => item.id === furnitureId);
      if (!f) return row;
      const next: DesignBoxRowV1 = { ...row, ...place(f.box, master, origin.x, origin.y) };
      if (f.kind === 'bar' || f.kind === 'rect') {
        const fill = colourOf(f.hex, f.tokenPath, resolve);
        if (fill) next.bg = fill;
      } else if (f.kind === 'logo') {
        next.fit = 'contain';
        if (master.logo.variantByBackground && logos) {
          const picked = pickLogoVariant({
            background: targetBg,
            dark: darkness.byFurniture.get(f.id) ?? darkness.frameDark,
            logos,
            mono: opts?.monoLogo,
          });
          if (picked) next.image = picked.value;
          else delete next.image;
        }
      } else {
        clearTextStyle(next);
        applyTextStyle(next, master, f.kind === 'page-number' ? 'number' : 'label', f.style, resolve);
      }
      return next;
    }
    const role = rowText(row, 'role') as ArchetypeRoleV1 | null;
    if (!role) return row;
    const ph = slotOf.get(index);
    if (!ph) return row;
    const next: DesignBoxRowV1 = { ...row, ...(cellOf.get(index) ?? place(ph.box, master, origin.x, origin.y)) };
    if (rowText(row, 'kind') === 'image') {
      // A picture keeps its own kind in every box, fitted by the box's fit or `contain`.
      next.fit = ph.kind === 'image' && !cellOf.has(index) ? (ph.fit ?? 'contain') : 'contain';
    } else if (ph.kind === 'image' || ph.role !== role) {
      // Words in a box of another role take that box's type, or the body type in a
      // picture box, in an ink that reads on the ground under the box.
      const style = ph.kind === 'image' ? bodyStyle : (ph.style ?? bodyStyle);
      clearTextStyle(next);
      applyTextStyle(next, master, role === 'title' ? 'title' : 'body', style, resolve);
      const ink = inkFor(master, to, ph.box, style, resolve);
      if (ink) next.fg = ink;
    } else {
      clearTextStyle(next);
      applyTextStyle(next, master, role, ph.style, resolve);
    }
    return next;
  });
}

/**
 * Put placeholder and furniture geometry back where the master says it goes, keeping
 * the content. This is Reset Slide: applying the archetype the frame already has.
 */
export function resetFrame(
  master: SlideMasterV1,
  archetypeId: ArchetypeRefV1,
  layers: DesignBoxRowV1[],
  opts?: RelayoutOptsV1,
): DesignBoxRowV1[] {
  return applyArchetype(master, archetypeId, archetypeId, layers, opts);
}

/** Round-trip helper for tests and callers that compare geometry across masters. */
export function masterBoxToPx(master: SlideMasterV1, box: MasterBoxV1): { x: number; y: number; w: number; h: number } {
  return place(box, master, 0, 0);
}

/** The fraction a px value represents at this master size, to four decimals. */
export function pxToMasterFraction(master: SlideMasterV1, px: number, axis: 'x' | 'y'): number {
  const span = axis === 'x' ? master.size.width : master.size.height;
  return span > 0 ? ROUND(px / span) : 0;
}
