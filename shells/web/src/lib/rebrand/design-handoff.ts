// SPDX-License-Identifier: MPL-2.0
/**
 * Design handoff from a compiled deck (plan 274 sections 2.1 step 5, 3.4 and 3.5).
 *
 * The compile hands over a `CompiledDeckV1`: frames of Design box rows, in Design's
 * own field vocabulary, plus lineage both ways and a report accounting for every
 * source object. This module turns those frames into the pages the free-canvas import
 * lays down as artboards, opens them as a Design document, records that document on
 * the renovation project, and keeps the report and the lineage where the Design view
 * can read them later.
 *
 * Five rules this file exists to hold:
 *
 * 1. **Ids are kept, exactly.** Every layer id and every frame id travels unchanged,
 *    because the lineage names them: a minted id would leave `forward` and `backward`
 *    pointing at rows nothing can find. The import is asked for `keepIds`, which
 *    falls back to minting for the whole document when the compiled ids are not
 *    unique, and says so rather than keeping half of them. When it does fall back,
 *    the marker records `idsKept: false` and carries no lineage at all, so no reader
 *    resolves a source object against a row that is no longer named.
 * 2. **Fields the compile wrote survive.** A row is copied over whole, so `master`,
 *    `role`, `furniture` and the rest reach the document as authored. The frame's own
 *    row carries its name, ground, notes and the transition the slide had; those go
 *    to the page, and what is left goes on as extra frame fields with the archetype,
 *    the slide the frame came from, and whether the compile added it as a
 *    continuation.
 * 3. **One frame, one origin.** The compile writes a whole deck as a strip: the frame
 *    row and its children all carry positions on that strip. The import packs the
 *    pages itself and adds its own origin to every child, so the children are brought
 *    back to the frame they were written against before they are handed over.
 * 4. **A placeholder is never described as content.** A placeholder layer arrives
 *    locked, named for the class the census settled on, so nothing on the canvas
 *    reads as a picture of the source. Furniture is locked too: it came from the
 *    master.
 * 5. **A save is a save.** The session id is recorded through the store's revision
 *    rule, and a refused write is reported as refused, never as recorded.
 * 6. **Nothing kept is dropped.** Kept objects the compile could place on no slide (the
 *    deck's tray) go on one last artboard named "Not placed", laid out left to right
 *    in reading order at their own size, so the person finds them on the canvas and
 *    moves them where they belong. Its frame row carries `notPlaced: true`, the mark an
 *    export or a presentation reads to leave it out. Design's only such mark today is
 *    the row's `hidden` field (the native pptx export skips a hidden frame), and a
 *    hidden artboard would also vanish from the canvas where the person has to find
 *    these objects, so the artboard is not hidden: until Design reads `notPlaced`, it
 *    is part of the deck until it is deleted, and the warning says so.
 * 7. **Names are words.** Every layer the canvas lists is named in the person's
 *    language, never by a source part path, a master id or the master's English label:
 *    a continuation frame is "<slide>, continued", master furniture is named for what it
 *    is ("Master: accent bar"), a master slot for its role ("Title", "Body text"), a kept
 *    object for its class ("Photo", "Chart"), the slide's own ground "Slide background",
 *    and a frame the compile could only call "Slide 3" is "Slide 3" in that language.
 * 8. **A second opening is a second document.** Every Open in Design opens a new Design
 *    document; the ones before it stay as they are. From the second on, the document
 *    is named with its revision ("Quarterly review, revision 2"), so the two are told
 *    apart in Projects.
 *
 * Nothing here touches the DOM, the clock or storage: the document is opened and the
 * frames are laid down through injected functions, so the whole path is testable and
 * the view keeps its own wiring.
 */
import {
  REBRAND_CONTRACT_VERSION,
  type CompiledDeckV1,
  type CompiledFrameV1,
  type DesignBoxRowV1,
  type LineageV1,
  type ObjectClassV1,
  type ProjectWriteRefusalV1,
  type RebrandReportV1,
  type RenovationProjectStoreV1,
  type RenovationProjectV1,
  type SourceObjectKindV1,
} from '@lolly-tools/core/rebrand-v1';
import { nounFor } from '../../../../../engine/src/rebrand-review.ts';
import { vectorRowNameParts } from '../../../../../engine/src/svg-items.ts';
import type { ArtboardFrameInput } from '../../views/free-canvas/menus.ts';
import { MAX_REVISION_SNAPSHOT } from '../../bridge/revision-limits.ts';
import { tRaw } from '../../i18n.ts';

// ─── the frames the import takes ─────────────────────────────────────────────

/**
 * One compiled frame as a page the artboard import can lay out: the view's own
 * `ArtboardFrameInput`, with the frame id required (the lineage names it) and the
 * boxes as compiled rows. Typed against the view's interface rather than beside it,
 * so a field added to one cannot quietly go missing from the other. The import is
 * reached through `DesignHandoffImporterV1`, so this stays a type-only edge.
 */
export interface DesignHandoffFrameV1 extends ArtboardFrameInput {
  /** The frame layer id, kept exactly. */
  id: string;
  boxes: DesignBoxRowV1[];
}

/** Design's field for a layer's name, the one a layer list shows. */
const NAME_FIELD = 'name';
/** Design's field for a locked layer. */
const LOCKED_FIELD = 'locked';

/**
 * The frame row's own fields, which reach the page through their own channels or are
 * the layout's to set. Everything else on that row travels as an extra frame field.
 */
const FRAME_ROW_OWN: ReadonlySet<string> = new Set([
  'id',
  'kind',
  'x',
  'y',
  'w',
  'h',
  'order',
  'frame',
  NAME_FIELD,
  'bg',
  'notes',
]);

/** A row's id as a string, empty when it has none. */
function rowId(row: DesignBoxRowV1): string {
  return row.id == null ? '' : String(row.id);
}

/** A row field as trimmed text, empty when it is missing or not text. */
function text(value: string | number | boolean | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** A row field as a finite number, zero when it is missing or not one. */
function num(value: string | number | boolean | null | undefined): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(n) ? n : 0;
}

/**
 * A master slot or furniture text row the compile left empty: a footer with no kept
 * line, a subtitle the slide had no text for. The compiled deck keeps the row, since
 * the archetype has that slot, but Design reports an empty text layer as a finding,
 * so the row is not laid on the canvas.
 */
function unfilledSlot(row: DesignBoxRowV1): boolean {
  return row.kind === 'text' && !text(row.text) && Boolean(text(row.role) || text(row.furniture));
}

/**
 * The lineage restricted to what the import laid down: a link to an unfilled slot the
 * canvas never received would name a row nothing can find.
 */
function laidLineage(lineage: LineageV1, pages: readonly DesignHandoffFrameV1[]): LineageV1 {
  const laid = new Set<string>();
  for (const page of pages) {
    laid.add(page.id);
    for (const box of page.boxes) laid.add(rowId(box));
  }
  return {
    ...lineage,
    forward: lineage.forward.map((edge) => ({ ...edge, layerIds: edge.layerIds.filter((id) => laid.has(id)) })),
    backward: lineage.backward.filter((edge) => laid.has(edge.layerId)),
  };
}

/**
 * Which class the report named for each layer, where it named one: by the layer id an
 * entry names, else through the lineage from the source object an entry names.
 */
function layerClasses(report: RebrandReportV1, lineage?: LineageV1): Map<string, ObjectClassV1> {
  const out = new Map<string, ObjectClassV1>();
  const byObject = new Map<string, ObjectClassV1>();
  for (const entry of report.entries) {
    if (entry.layerId && entry.class && !out.has(entry.layerId)) out.set(entry.layerId, entry.class);
    if (entry.objectId && entry.class && !byObject.has(entry.objectId)) byObject.set(entry.objectId, entry.class);
  }
  for (const edge of lineage?.backward ?? []) {
    if (out.has(edge.layerId)) continue;
    const cls = edge.sourceObjectIds.map((id) => byObject.get(id)).find((one) => one !== undefined);
    if (cls) out.set(edge.layerId, cls);
  }
  return out;
}

/**
 * The object kind a compiled row most likely came from, read from the row's own kind.
 * The compiled deck carries no source kinds, and the noun rule needs one to tell a
 * picture from a drawing from a shape.
 */
function sourceKindOf(rowKind: string): SourceObjectKindV1 {
  switch (rowKind) {
    case 'image': return 'pic';
    case 'path': return 'vector';
    case 'text': return 'text';
    case 'table': return 'table';
    case 'chart': return 'chart';
    default: return 'shape';
  }
}

/**
 * The noun a class is named by on the canvas, in the person's language: the same word
 * the review queue, the decision panel and the report use (`nounFor` in the engine's
 * review model, read with the object's kind), so one object has one name everywhere.
 */
function classNoun(cls: ObjectClassV1, rowKind: string): string {
  return tRaw(nounFor(cls, sourceKindOf(rowKind)));
}

/**
 * What a stand-in layer is called on the canvas: the noun for the class the census
 * settled on ("Stand-in: chart"), and otherwise nothing more than "Stand-in". The
 * engine's copy rule calls this layer a labelled stand-in, never a placeholder.
 *
 * Neither the row's own name nor the source object it stands in for is used. The
 * compile names every row after the source part it was read from
 * ("ppt/slides/slide2.xml.3"), and a file path on the canvas tells the person less
 * than the word stand-in does.
 */
function placeholderName(cls: ObjectClassV1 | undefined, rowKind: string): string {
  return cls ? tRaw('Stand-in: {what}', { what: classNoun(cls, rowKind) }) : tRaw('Stand-in');
}

/** A word with its first letter raised, for a name that stands on its own. */
function capitalise(word: string): string {
  return word.length === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1);
}

/** The word a master slot is named by, for each role an archetype can hold. */
const ROLE_WORD: Record<string, () => string> = {
  title: () => tRaw('Title'),
  subtitle: () => tRaw('Subtitle'),
  body: () => tRaw('Body text'),
  visual: () => tRaw('Picture'),
  data: () => tRaw('Table or chart'),
  caption: () => tRaw('Caption'),
  number: () => tRaw('Big number'),
  label: () => tRaw('Label'),
  quote: () => tRaw('Quote'),
  attribution: () => tRaw('Attribution'),
};

/** What a layer of kind `kind` is called when nothing better is known. */
function kindWord(kind: string): string {
  if (kind === 'text') return tRaw('Text');
  if (kind === 'image') return tRaw('Picture');
  if (kind === 'path') return tRaw('Drawing');
  return tRaw('Shape');
}

/**
 * The English kind words the compile writes at the head of a drawing row's name
 * ("Shape: Yes", "Drawing: value-axis"), each with the word it is said as here.
 */
const VECTOR_KIND_WORD: Record<string, () => string> = {
  Shape: () => tRaw('Shape'),
  Drawing: () => tRaw('Drawing'),
  Line: () => tRaw('Line'),
  Text: () => tRaw('Text'),
};

/**
 * The layer name of one row of a drawing carried as shapes (plan 275 decision 32), from
 * the parts `vectorRowNameParts` reads off the name the compile wrote: the kind in the
 * person's language, then the drawing's own word for the part, a series name ("Yes") or
 * the source's group name ("value-axis"), which is the author's word and is kept as
 * written. A box row of a chart is a bar. Design's own pptx import names its drawing
 * rows with this too, so the two surfaces say the same words.
 */
export function vectorLayerName(parts: { kind: string; label?: string }, chart: boolean): string {
  const word = chart && parts.kind === 'Shape' ? tRaw('Bar') : (VECTOR_KIND_WORD[parts.kind]?.() ?? tRaw('Shape'));
  return parts.label ? tRaw('{what}: {name}', { what: word, name: parts.label }) : word;
}

/** A drawing row's layer name, or undefined for every other row. */
function vectorRowName(row: DesignBoxRowV1, cls: ObjectClassV1 | undefined): string | undefined {
  if (!text(row.group).startsWith('vector:')) return undefined;
  const parts = vectorRowNameParts(text(row[NAME_FIELD]));
  if (!parts) return kindWord(text(row.kind));
  return vectorLayerName(parts, cls === 'chart');
}

/**
 * Does the content in a slot match the role the slot was made for? Every box takes every
 * kind of content (plan 275 decision 30), so body text can fill a visual slot and a picture a
 * body slot; the role's word names the layer only when the content is what the role says.
 */
function roleFits(role: string, kind: string): boolean {
  if (role === 'visual') return kind === 'image';
  if (role === 'data') return kind === 'table' || kind === 'chart';
  return kind === 'text';
}

/**
 * The name a layer that is neither a placeholder nor furniture takes on the canvas.
 * The compile names a kept object after its source part ("ppt/slides/slide2.xml.3"), a
 * master slot after the master's own English label, a table cell after its part and
 * position, and the slide's ground after the slide id; none of those is a word a person
 * reads, so each is replaced here.
 */
export function layerName(row: DesignBoxRowV1, cls: ObjectClassV1 | undefined): string {
  const drawn = vectorRowName(row, cls);
  if (drawn) return drawn;
  const kind = text(row.kind);
  const role = text(row.role);
  const own = text(row[NAME_FIELD]);
  if (role) {
    // A slot's label row the compile writes beside it ("<slot> note") is named for the slot.
    const note = own.endsWith(' note');
    const word = (note || roleFits(role, kind) ? ROLE_WORD[role]?.() : undefined) ?? kindWord(kind);
    return note ? tRaw('{what} note', { what: word }) : word;
  }
  if (kind === 'image' && own.endsWith(' ground') && !cls) return tRaw('Slide background');
  if (/ r\d+c\d+$/.test(own)) return tRaw('Table cell');
  if (cls && cls !== 'unknown') return capitalise(classNoun(cls, kind));
  return kindWord(kind);
}

/** "Slide 3", the one frame name the compile writes in English, said in the person's language. */
function slideWord(name: string): string {
  const match = /^Slide (\d+)$/.exec(name);
  return match ? tRaw('Slide {n}', { n: Number(match[1]) }) : name;
}

/**
 * What a piece of master furniture is called on the canvas. The compile names the row
 * after the master's own id for it ("bar-green", "page-number"), which is a key, not a
 * name; this reads the id for what the piece is and says it in words, "Master: accent
 * bar", so the layer list reads like the rest of Design.
 */
export function furnitureName(furnitureId: string, kind: string): string {
  const id = furnitureId.toLowerCase();
  let what: string;
  if (id.includes('logo') || id.includes('mark')) what = tRaw('mark');
  else if (/(page|slide)[-_ ]?(number|num|no)/.test(id)) what = tRaw('page number');
  else if (id.includes('footer')) what = tRaw('footer');
  else if (id.includes('date')) what = tRaw('date');
  else if (id.startsWith('bar') || id.endsWith('bar') || id.includes('-bar')) what = tRaw('accent bar');
  else if (kind === 'text') what = tRaw('text');
  else if (kind === 'image') what = tRaw('picture');
  else what = tRaw('shape');
  return tRaw('Master: {what}', { what });
}

/** The frame row's remaining fields, plus what the frame record states about itself. */
function frameExtra(frame: CompiledFrameV1, frameRow: DesignBoxRowV1 | undefined): DesignBoxRowV1 {
  const extra: DesignBoxRowV1 = {};
  if (frameRow) {
    for (const [key, value] of Object.entries(frameRow)) {
      if (!FRAME_ROW_OWN.has(key)) extra[key] = value;
    }
  }
  if (extra.archetype == null) extra.archetype = frame.archetype;
  if (frame.masterId && extra.master == null) extra.master = frame.masterId;
  // Which slide this artboard came from, and whether the compile added it to carry
  // what would not fit. Nothing else on the way in records either: the lineage maps
  // source objects to layers, never a slide to a frame.
  if (frame.sourceSlideId && extra.sourceSlideId == null) extra.sourceSlideId = frame.sourceSlideId;
  if (frame.continuation && extra.continuation == null) extra.continuation = true;
  return extra;
}

/**
 * A frame's name as the person reads it. A continuation frame takes its slide's name
 * with the word continued, in the person's language, never the engine's own English
 * wording for it.
 */
function frameName(frame: CompiledFrameV1, frameRow: DesignBoxRowV1 | undefined, baseNames: ReadonlyMap<string, string>): string {
  const own = slideWord(text(frameRow?.[NAME_FIELD]) || frame.name);
  if (!frame.continuation) return own;
  const base = frame.sourceSlideId ? baseNames.get(frame.sourceSlideId) : undefined;
  return base ? tRaw('{name}, continued', { name: base }) : own;
}

/** One compiled frame as a page, ids and fields intact. */
function pageOf(
  frame: CompiledFrameV1,
  classes: Map<string, ObjectClassV1>,
  baseNames: ReadonlyMap<string, string> = new Map(),
): DesignHandoffFrameV1 {
  // The compile may write the frame's own row into its layers (a row whose id is the
  // frame id). That row is the page, not a box inside it; a compile that writes none
  // leaves the page to be described by the frame record alone.
  const frameRow = frame.layers.find((layer) => rowId(layer) === frame.id);
  // That row is also the origin its children were written against (rule 3). A compile
  // that writes no frame row wrote its children inside the frame already, so there is
  // nothing to subtract and every row travels as it arrived.
  const ox = frameRow ? num(frameRow.x) : 0;
  const oy = frameRow ? num(frameRow.y) : 0;
  const placeholders = new Set(frame.placeholderLayerIds);
  const furniture = new Set(frame.furnitureLayerIds);
  const boxes: DesignBoxRowV1[] = [];
  for (const layer of frame.layers) {
    if (layer === frameRow || unfilledSlot(layer)) continue;
    const id = rowId(layer);
    const row: DesignBoxRowV1 = { ...layer };
    if (ox !== 0 && typeof row.x === 'number') row.x = row.x - ox;
    if (oy !== 0 && typeof row.y === 'number') row.y = row.y - oy;
    if (placeholders.has(id)) {
      row[LOCKED_FIELD] = true;
      row[NAME_FIELD] = placeholderName(classes.get(id), text(layer.kind));
    } else if (furniture.has(id)) {
      row[LOCKED_FIELD] = true;
      const furnitureId = text(layer.furniture);
      row[NAME_FIELD] = furnitureId ? furnitureName(furnitureId, text(layer.kind)) : layerName(layer, classes.get(id));
    } else {
      row[NAME_FIELD] = layerName(layer, classes.get(id));
    }
    boxes.push(row);
  }
  const page: DesignHandoffFrameV1 = {
    id: frame.id,
    name: frameName(frame, frameRow, baseNames),
    width: frame.width,
    height: frame.height,
    boxes,
  };
  const ground = text(frameRow?.bg);
  if (ground) page.background = ground;
  const notes = frame.notes ?? text(frameRow?.notes);
  if (notes) page.notes = notes;
  const extra = frameExtra(frame, frameRow);
  if (Object.keys(extra).length) page.extra = extra;
  return page;
}

/** Space around and between the objects on the Not placed artboard, in px. */
const TRAY_GAP = 40;

/** The Not placed artboard's frame id: one no compiled row already uses. */
function trayPageId(deck: CompiledDeckV1): string {
  const taken = new Set<string>();
  for (const frame of deck.frames) {
    taken.add(frame.id);
    for (const layer of frame.layers) taken.add(rowId(layer));
  }
  for (const item of deck.tray) taken.add(rowId(item.layer));
  let id = 'rebrand.not-placed';
  for (let n = 2; taken.has(id); n += 1) id = `rebrand.not-placed.${n}`;
  return id;
}

/**
 * The tray as one page: every tray layer, ids and fields intact, set out in rows left
 * to right at its own size, a row wrapping when the next object would pass the right
 * edge. The page is as wide as the deck's first slide and grows downward to fit. An
 * object wider than the page is shrunk to fit it, the one change of size, with its
 * type scaled by the same factor so the text still fits its box.
 */
function trayPage(deck: CompiledDeckV1, classes: Map<string, ObjectClassV1> = new Map()): DesignHandoffFrameV1 | null {
  if (deck.tray.length === 0) return null;
  const first = deck.frames.find((frame) => frame.width > 0 && frame.height > 0);
  const width = first?.width ?? 1280;
  const minHeight = first?.height ?? 720;
  const room = Math.max(1, width - TRAY_GAP * 2);
  const boxes: DesignBoxRowV1[] = [];
  let x = TRAY_GAP;
  let y = TRAY_GAP;
  let rowH = 0;
  for (const item of deck.tray) {
    const row: DesignBoxRowV1 = { ...item.layer };
    delete row.frame;
    const byObject = deck.report.entries.find((entry) => entry.objectId === item.sourceObjectId && entry.class)?.class;
    row[NAME_FIELD] = layerName(item.layer, classes.get(rowId(item.layer)) ?? byObject);
    let w = Math.max(1, num(row.w));
    let h = Math.max(1, num(row.h));
    if (w > room) {
      const k = room / w;
      w = room;
      h = Math.max(1, Math.round(h * k * 100) / 100);
      if (typeof row.fontSize === 'number') row.fontSize = Math.round(row.fontSize * k * 100) / 100;
    }
    if (x > TRAY_GAP && x + w > width - TRAY_GAP) {
      x = TRAY_GAP;
      y += rowH + TRAY_GAP;
      rowH = 0;
    }
    row.x = x;
    row.y = y;
    row.w = w;
    row.h = h;
    boxes.push(row);
    x += w + TRAY_GAP;
    rowH = Math.max(rowH, h);
  }
  const height = Math.max(minHeight, Math.ceil(y + rowH + TRAY_GAP));
  return {
    id: trayPageId(deck),
    name: tRaw('Not placed'),
    width,
    height,
    boxes,
    extra: { notPlaced: true },
  };
}

/**
 * Every compiled frame as a page for the artboard import, in deck order, with every
 * id kept and every authored field carried over, and the tray last on its own page
 * named Not placed (rule 6).
 */
export function compiledDeckToFrames(deck: CompiledDeckV1): DesignHandoffFrameV1[] {
  const classes = layerClasses(deck.report, deck.lineage);
  // Each slide's own name, from its first frame, for the frames that continue it.
  const baseNames = new Map<string, string>();
  for (const frame of deck.frames) {
    if (frame.continuation || !frame.sourceSlideId || baseNames.has(frame.sourceSlideId)) continue;
    const row = frame.layers.find((layer) => rowId(layer) === frame.id);
    baseNames.set(frame.sourceSlideId, slideWord(text(row?.[NAME_FIELD]) || frame.name));
  }
  const pages = deck.frames.map((frame) => pageOf(frame, classes, baseNames));
  const tray = trayPage(deck, classes);
  return tray ? [...pages, tray] : pages;
}

// ─── the marker the Design session carries ───────────────────────────────────

/**
 * The session marker's key. Sessions carry their runtime's facts as `__`-prefixed
 * keys beside the input values (`views/tool-session-snapshot.ts`), so the report and
 * the lineage travel the same way a design publication or an emoji stamp does.
 */
export const REBRAND_HANDOFF_MARKER = '__rebrandHandoff';

/** What the Design view can read back about the renovation this document came from. */
export interface RebrandHandoffMarkerV1 {
  projectId: string;
  planRevision: number;
  source: { lineageId: string; hash: string; instanceId: string };
  /** True when every row on the canvas kept the id the compile gave it. */
  idsKept: boolean;
  /** Absent when the ids were minted: it would name rows the document does not have. */
  lineage?: LineageV1;
  report: RebrandReportV1;
}

/**
 * Held against the mounted document, exactly as `lib/design-tool-publication.ts`
 * holds a publication receipt: the view's `sessionMeta` reads it at save time and
 * writes it under `REBRAND_HANDOFF_MARKER`, and `restoreRebrandHandoff` puts it back
 * when that session is opened again. The key is the mounted runtime; typed as an
 * object so this module needs no engine import.
 */
const handoffs = new WeakMap<object, RebrandHandoffMarkerV1>();

export const getRebrandHandoff = (owner: object): RebrandHandoffMarkerV1 | undefined => handoffs.get(owner);

export const setRebrandHandoff = (owner: object, marker: RebrandHandoffMarkerV1): void => {
  handoffs.set(owner, marker);
};

export const clearRebrandHandoff = (owner: object): void => {
  handoffs.delete(owner);
};

/**
 * Put a marker back from a saved session. A record written by another build, or one
 * that lost a field, is dropped rather than half-read: the report is an account of
 * every source object, and a partial one would be worse than none.
 */
export function restoreRebrandHandoff(owner: object, value: unknown): void {
  if (isMarker(value)) handoffs.set(owner, value);
}

/** One own property, read without walking a prototype. */
function field(source: object, key: string): unknown {
  return Object.getOwnPropertyDescriptor(source, key)?.value;
}

function isObject(value: unknown): value is object {
  return !!value && typeof value === 'object';
}

/** Whether a stored lineage is shaped the way this build reads one. */
function isLineage(value: unknown): boolean {
  return isObject(value) && Array.isArray(field(value, 'forward')) && Array.isArray(field(value, 'backward'));
}

/** Whether a stored value is a marker this build can read back. */
function isMarker(value: unknown): value is RebrandHandoffMarkerV1 {
  if (!isObject(value)) return false;
  const projectId = field(value, 'projectId');
  const planRevision = field(value, 'planRevision');
  const source = field(value, 'source');
  const lineage = field(value, 'lineage');
  const report = field(value, 'report');
  if (typeof projectId !== 'string' || !projectId) return false;
  if (typeof planRevision !== 'number' || !Number.isFinite(planRevision)) return false;
  if (typeof field(value, 'idsKept') !== 'boolean') return false;
  if (
    !isObject(source) ||
    typeof field(source, 'lineageId') !== 'string' ||
    typeof field(source, 'hash') !== 'string' ||
    typeof field(source, 'instanceId') !== 'string'
  ) {
    return false;
  }
  // A marker with the ids kept states its lineage; one without states none. Anything
  // else is a record this build cannot read as written.
  if (field(value, 'idsKept') === true ? !isLineage(lineage) : lineage !== undefined) return false;
  if (!isObject(report) || !Array.isArray(field(report, 'entries')) || !isObject(field(report, 'counts'))) {
    return false;
  }
  // The report is the account of every source object, so a report written against
  // another version of the contract is not read at all.
  return field(report, 'version') === REBRAND_CONTRACT_VERSION;
}

// ─── Design's history budget ─────────────────────────────────────────────────

/**
 * Whether the document this deck opens as is larger than Design's automatic history
 * keeps a snapshot of (`MAX_REVISION_SNAPSHOT`, plan 275 close-out decision 10). The
 * measure is the pages' JSON, the same serialisation a revision snapshot writes, so a
 * deck of many small artboards that Design would open without undo history is named
 * before it opens. An estimate that errs large: the pages carry a little more than the
 * session record Design keeps of them.
 */
export function exceedsDesignHistory(deck: CompiledDeckV1, budget: number = MAX_REVISION_SNAPSHOT): boolean {
  let bytes = 0;
  const encoder = new TextEncoder();
  for (const frame of compiledDeckToFrames(deck)) {
    bytes += encoder.encode(JSON.stringify(frame)).byteLength;
    if (bytes > budget) return true;
  }
  return false;
}

// ─── opening the compiled deck as a Design document ──────────────────────────

/** The Design document the pages land in. */
export interface DesignHandoffSessionV1 {
  /** The session id the document is saved under, which the project records. */
  id: string;
  /**
   * The mounted document the marker is held against - the tool runtime. Absent when
   * the caller opens a document it does not hold a handle on; the marker then comes
   * back on the result for the caller to place.
   */
  owner?: object;
  /** Closes the document that was just opened, when the pages cannot be laid down. */
  close?: () => Promise<void> | void;
}

/** What the import answers: how many artboards it laid down, and whether the ids survived. */
export interface DesignHandoffImportOutcomeV1 {
  landed: number;
  /** False when the import minted fresh ids, which retires the lineage for this document. */
  keptIds: boolean;
}

/** How the pages reach the canvas: `views/free-canvas/menus.ts` `importAsArtboards`. */
export type DesignHandoffImporterV1 = (
  frames: DesignHandoffFrameV1[],
  opts: {
    keepIds: boolean;
    onWarning: (message: string) => void;
    /**
     * The frame the view opens on (plan 275 section 5.1). The same frame also carries
     * `focus: true`, so an importer that passes its options on by field still reaches it.
     */
    focusFrameId?: string;
  },
) => Promise<DesignHandoffImportOutcomeV1> | DesignHandoffImportOutcomeV1;

export interface OpenCompiledDeckV1 {
  deck: CompiledDeckV1;
  project: RenovationProjectV1;
  store: RenovationProjectStoreV1;
  /** Opens the Design document these pages land in and answers the session it is saved under. */
  navigate: (open: { name: string; frames: number }) => Promise<DesignHandoffSessionV1> | DesignHandoffSessionV1;
  importer: DesignHandoffImporterV1;
  /**
   * Documents this project opened in the caller's own memory, which can run ahead of
   * the project record when the store refused to list one. The revision in the name
   * counts whichever is larger, so two openings never share a name.
   */
  openedBefore?: number;
  /**
   * The frame Design opens its view on: "Open this slide in Design" (plan 275 section
   * 5.1). The whole document still opens; only the view moves. Absent or unknown, Design
   * opens as it always has.
   */
  focusFrameId?: string;
}

export interface DesignHandoffResultV1 {
  sessionId: string;
  /** How many artboards the import laid down. */
  landed: number;
  /** False when the import minted fresh ids, so nothing on the canvas is named by the lineage. */
  idsKept: boolean;
  /** The marker the session carries. Already held against the document when one was handed over. */
  marker: RebrandHandoffMarkerV1;
  /** True when the project record lists this session. False means the store refused. */
  recorded: boolean;
  /** The project revision after the write, or the one that was read when nothing was written. */
  revision: number;
  /** Why the store would not record it. The caller reloads rather than retrying blindly. */
  refusal?: ProjectWriteRefusalV1;
  message?: string;
  /** What could not be honoured on the way in. */
  warnings: string[];
}

/**
 * Puts a compiled deck on the canvas as a Design document: pages first, then the
 * document, then the record.
 *
 * The pages are built and read before anything opens, so a deck with no page this
 * build can lay down is refused with the document still closed. An import that
 * throws after the document opened closes it again through the session's own
 * `close`, rather than leaving an empty canvas behind. The session id goes onto the
 * project under the revision rule, and a session already listed is not listed twice -
 * reopening the same compile writes nothing. The marker is held against the document
 * only once the project records the session, and is written into the session record
 * by the save path: the save path owns what a session record carries.
 */
export async function openCompiledDeckInDesign(input: OpenCompiledDeckV1): Promise<DesignHandoffResultV1> {
  const { deck, project, store, navigate, importer } = input;
  const focusFrameId = input.focusFrameId && deck.frames.some((frame) => frame.id === input.focusFrameId) ? input.focusFrameId : undefined;
  // The focus travels on the page itself as well as in the options, so it reaches the
  // import through every layer that hands the pages on.
  const frames = compiledDeckToFrames(deck).map((frame) => (frame.id === focusFrameId ? { ...frame, focus: true } : frame));
  const warnings: string[] = [];
  // The Not placed page is not a slide, so a deck with nothing but a tray is still refused.
  if (!deck.frames.some((frame) => frame.width > 0 && frame.height > 0)) {
    throw new Error(tRaw('This compiled deck has no slides.'));
  }
  // Kept objects that fit no slide are still the person's content. They go on the
  // Not placed artboard (rule 6), and the person is told where to look, and that the
  // artboard is a page of the deck like any other until they delete it.
  if (deck.tray.length) {
    warnings.push(
      deck.tray.length === 1
        ? tRaw('1 object is on the Not placed artboard, which exports with the deck until you delete it.')
        : tRaw('{n} objects are on the Not placed artboard, which exports with the deck until you delete it.', { n: deck.tray.length }),
    );
  }
  // A second opening is a new document beside the first (rule 8), named with its revision.
  const recordedCount = Array.isArray(project.designSessionIds) ? project.designSessionIds.length : 0;
  const opened = Math.max(recordedCount, input.openedBefore ?? 0);
  const name = opened > 0 ? tRaw('{name}, revision {n}', { name: project.name, n: opened + 1 }) : project.name;
  const session = await navigate({ name, frames: frames.length });
  let outcome: DesignHandoffImportOutcomeV1;
  try {
    outcome = await importer(frames, {
      keepIds: true,
      onWarning: (message) => {
        warnings.push(message);
      },
      ...(focusFrameId ? { focusFrameId } : {}),
    });
  } catch (err) {
    await session.close?.();
    throw err;
  }

  const marker: RebrandHandoffMarkerV1 = {
    projectId: project.id,
    planRevision: deck.planRevision,
    source: { ...deck.source },
    idsKept: outcome.keptIds,
    report: deck.report,
  };
  // Rule 1: a minted id leaves every forward and backward link naming a row nothing
  // can find, so the lineage does not travel at all in that case.
  if (outcome.keptIds) marker.lineage = laidLineage(deck.lineage, frames);

  const sessions = Array.isArray(project.designSessionIds) ? project.designSessionIds : [];
  const listed = sessions.includes(session.id);
  const result: DesignHandoffResultV1 = {
    sessionId: session.id,
    landed: outcome.landed,
    idsKept: outcome.keptIds,
    marker,
    recorded: listed,
    revision: project.revision,
    warnings,
  };
  if (listed) {
    if (session.owner) setRebrandHandoff(session.owner, marker);
    return result;
  }
  const written = await store.update(project.id, project.revision, {
    designSessionIds: [...sessions, session.id],
  });
  if (written.ok) {
    result.recorded = true;
    result.revision = written.revision;
    if (session.owner) setRebrandHandoff(session.owner, marker);
    return result;
  }
  result.refusal = written.refusal;
  result.message = written.message;
  // The project does not list this document, so the document does not claim the
  // project either: a marker naming a project that never recorded it would be
  // persisted by the next save as a link nothing answers.
  if (session.owner) clearRebrandHandoff(session.owner);
  return result;
}
