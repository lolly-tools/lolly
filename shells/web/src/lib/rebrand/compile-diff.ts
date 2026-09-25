// SPDX-License-Identifier: MPL-2.0
/**
 * What changed between two compiles of one renovation project (plan 274 section 3.4,
 * "Recompile after Design edits").
 *
 * A second Open in Design after a changed plan opens a new Design document beside the
 * one the person may have edited; nothing is merged into it. The report then says what
 * the plan change altered, read from the two compiled decks alone:
 *
 *   - frames added and removed, by frame id (a frame id is minted from its source slide,
 *     so a slide left out or brought back shows here, and so does a continuation), and
 *     the frames both compiles hold whose place in the deck changed (`framesMoved`, the
 *     fewest frames whose move explains the new order);
 *   - source objects whose layers changed, through the lineage: an object that produced
 *     other layers, or the same layers with other values, is listed once by its source
 *     object id, and an object that produced layers only in one of the two is listed as
 *     added or removed;
 *   - the colours and the fonts the layers use, as two sets each: what the new compile
 *     uses that the old one did not, and the other way round.
 *
 * The compile lays its frames out on one strip, each at its own offset, so a layer's
 * position is compared inside its frame: leaving out or moving one slide shifts every
 * frame after it, and that shift is a move, never a change to the objects on them.
 *
 * Only the compiled values are compared, never the Design document, so this is the
 * difference the plan made and not what the person edited since. The three-way merge
 * that would carry those edits across is a later work package.
 *
 * Web only for now: the CLI writes one compile per run and has no previous compile to
 * compare against. Pure: no DOM, no clock, no storage. Lists come back sorted by UTF-16
 * code unit, so the same two decks always give the same answer.
 */
import type { CompiledDeckV1, DesignBoxRowV1 } from '@lolly-tools/core/rebrand-v1';

export interface CompileDiffV1 {
  /** The plan revisions the two compiles were made from. */
  from: number;
  to: number;
  framesAdded: string[];
  framesRemoved: string[];
  /** Frames in both compiles whose place in the deck changed. */
  framesMoved: string[];
  /** Source objects whose layers differ between the two compiles. */
  objectsChanged: string[];
  /** Source objects with layers only in the new compile. */
  objectsAdded: string[];
  /** Source objects with layers only in the old compile. */
  objectsRemoved: string[];
  coloursAdded: string[];
  coloursRemoved: string[];
  fontsAdded: string[];
  fontsRemoved: string[];
}

/** Row fields that name a colour. A field not in this list is never read as one. */
const COLOUR_FIELDS = ['fill', 'stroke', 'color', 'ink', 'bg', 'background', 'textColor'] as const;

/** Row fields that name a face. */
const FONT_FIELDS = ['font', 'fontFamily'] as const;

/** Row fields that give the place of a row in the strip, not what it is. */
const PLACEMENT_FIELDS = new Set(['order']);

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const byCodeUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function sorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort(byCodeUnit);
}

function minus(a: ReadonlySet<string>, b: ReadonlySet<string>): string[] {
  return sorted([...a].filter((value) => !b.has(value)));
}

function rowId(row: DesignBoxRowV1): string {
  return row.id == null ? '' : String(row.id);
}

/** A row as text with its keys in order and its placement fields left out, for comparison. */
function rowKey(row: DesignBoxRowV1): string {
  const keys = Object.keys(row).filter((key) => !PLACEMENT_FIELDS.has(key) && row[key] !== undefined).sort(byCodeUnit);
  return JSON.stringify(keys.map((key) => [key, row[key]]));
}

/** A row with its position read inside its frame, whose origin is (`ox`, `oy`) on the strip. */
function framed(row: DesignBoxRowV1, ox: number, oy: number): DesignBoxRowV1 {
  if (ox === 0 && oy === 0) return row;
  const out: DesignBoxRowV1 = { ...row };
  if (typeof out.x === 'number') out.x = out.x - ox;
  if (typeof out.y === 'number') out.y = out.y - oy;
  return out;
}

/**
 * Every layer of a deck by id, its position inside its frame: the frames, then the tray.
 * A frame's origin is its own row (the row whose id is the frame id); a compile that
 * writes none wrote its rows inside the frame already.
 */
function layersOf(deck: CompiledDeckV1): Map<string, DesignBoxRowV1> {
  const out = new Map<string, DesignBoxRowV1>();
  for (const frame of deck.frames) {
    const own = frame.layers.find((row) => rowId(row) === frame.id);
    const ox = own && typeof own.x === 'number' ? own.x : 0;
    const oy = own && typeof own.y === 'number' ? own.y : 0;
    for (const row of frame.layers) out.set(rowId(row), framed(row, ox, oy));
  }
  for (const item of deck.tray) out.set(rowId(item.layer), item.layer);
  return out;
}

/**
 * The frames both decks hold whose place changed: those outside the longest run that
 * keeps its order, so moving one slide names that slide and not every slide it passed.
 */
function movedFrames(previous: CompiledDeckV1, next: CompiledDeckV1): string[] {
  const after = new Map(next.frames.map((frame, i) => [frame.id, i]));
  const common = previous.frames.map((frame) => frame.id).filter((id) => after.has(id));
  const positions = common.map((id) => after.get(id) ?? 0);
  // Longest increasing run of positions, with the index it came through, to walk back.
  const tails: number[] = [];
  const tailAt: number[] = [];
  const back: number[] = new Array<number>(positions.length).fill(-1);
  positions.forEach((position, i) => {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((tails[mid] ?? 0) < position) lo = mid + 1;
      else hi = mid;
    }
    tails[lo] = position;
    tailAt[lo] = i;
    back[i] = lo > 0 ? tailAt[lo - 1] ?? -1 : -1;
  });
  const kept = new Set<string>();
  for (let i = tails.length > 0 ? tailAt[tails.length - 1] ?? -1 : -1; i >= 0; i = back[i] ?? -1) {
    const id = common[i];
    if (id !== undefined) kept.add(id);
  }
  return sorted(common.filter((id) => !kept.has(id)));
}

/** What each source object produced, as one comparable key per object. */
function producedBy(deck: CompiledDeckV1): Map<string, string> {
  const layers = layersOf(deck);
  const out = new Map<string, string>();
  for (const edge of deck.lineage.forward) {
    if (edge.layerIds.length === 0) continue;
    const rows = [...edge.layerIds].sort(byCodeUnit).map((id) => {
      const row = layers.get(id);
      return row ? rowKey(row) : `missing:${id}`;
    });
    out.set(edge.sourceObjectId, JSON.stringify([[...edge.layerIds].sort(byCodeUnit), rows]));
  }
  return out;
}

function coloursOf(deck: CompiledDeckV1): Set<string> {
  const out = new Set<string>();
  for (const row of layersOf(deck).values()) {
    for (const field of COLOUR_FIELDS) {
      const value = row[field];
      if (typeof value === 'string' && HEX.test(value.trim())) out.add(value.trim().toUpperCase());
    }
  }
  return out;
}

function fontsOf(deck: CompiledDeckV1): Set<string> {
  const out = new Set<string>();
  for (const row of layersOf(deck).values()) {
    for (const field of FONT_FIELDS) {
      const value = row[field];
      if (typeof value === 'string' && value.trim()) out.add(value.trim());
    }
  }
  return out;
}

/** What changed from `previous` to `next`. */
export function compileDiff(previous: CompiledDeckV1, next: CompiledDeckV1): CompileDiffV1 {
  const framesBefore = new Set(previous.frames.map((frame) => frame.id));
  const framesAfter = new Set(next.frames.map((frame) => frame.id));
  const before = producedBy(previous);
  const after = producedBy(next);
  const changed: string[] = [];
  for (const [id, key] of after) {
    const was = before.get(id);
    if (was !== undefined && was !== key) changed.push(id);
  }
  const coloursBefore = coloursOf(previous);
  const coloursAfter = coloursOf(next);
  const fontsBefore = fontsOf(previous);
  const fontsAfter = fontsOf(next);
  return {
    from: previous.planRevision,
    to: next.planRevision,
    framesAdded: minus(framesAfter, framesBefore),
    framesRemoved: minus(framesBefore, framesAfter),
    framesMoved: movedFrames(previous, next),
    objectsChanged: sorted(changed),
    objectsAdded: minus(new Set(after.keys()), new Set(before.keys())),
    objectsRemoved: minus(new Set(before.keys()), new Set(after.keys())),
    coloursAdded: minus(coloursAfter, coloursBefore),
    coloursRemoved: minus(coloursBefore, coloursAfter),
    fontsAdded: minus(fontsAfter, fontsBefore),
    fontsRemoved: minus(fontsBefore, fontsAfter),
  };
}

/** True when the two compiles differ in nothing this module reads. */
export function isEmptyDiff(diff: CompileDiffV1): boolean {
  return diff.framesAdded.length === 0
    && diff.framesRemoved.length === 0
    && diff.framesMoved.length === 0
    && diff.objectsChanged.length === 0
    && diff.objectsAdded.length === 0
    && diff.objectsRemoved.length === 0
    && diff.coloursAdded.length === 0
    && diff.coloursRemoved.length === 0
    && diff.fontsAdded.length === 0
    && diff.fontsRemoved.length === 0;
}
