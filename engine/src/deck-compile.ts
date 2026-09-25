// SPDX-License-Identifier: MPL-2.0
/**
 * Compile a read source deck into Design's own authored values (plan 274
 * section 3.4, stage 5).
 *
 * This file holds TWO modes, side by side and sharing their leaf helpers. The
 * faithful one (`compileFaithful`, work package 0c) makes every slide a Design
 * frame at the same proportions and every object a box row at the same place: no
 * archetype fitting, no colour or font assignment, no master furniture, so the
 * fidelity question can be answered on its own. The renovate one
 * (`compileRenovated`, work package 5) seeds each frame from the design system's
 * slide master and assigns the plan's content to the seeded role slots; nothing
 * is ever laid at scaled source coordinates over the furniture.
 *
 * Five rules both modes follow without exception:
 *
 *   - An object whose fidelity is `unavailable`, or that names no bytes a mode
 *     could draw, becomes an authored PLACEHOLDER layer: a muted box with a label
 *     saying the content could not be read, its id listed in
 *     `placeholderLayerIds` and its object recorded as `unresolved` in the
 *     report. A placeholder is never described as a picture of the source, and
 *     an empty box is never reported as content that was carried over.
 *   - Every source object gets exactly one disposition in the report, which
 *     `finalizeReport` checks before the compile returns.
 *   - Lineage is written in both directions for every layer, so a person or an
 *     agent can move from a source object to what it became and back.
 *   - A role a person stated in the plan outranks a role the compile derived, and
 *     an object the plan never lists takes no slot from one it does: the reviewed
 *     answer wins the slot, whatever reading order says.
 *   - Every colour use and every font mapping in the plan produces exactly one
 *     report entry, including the ones that reached no layer. A decision that
 *     changed nothing is still a decision somebody made.
 *
 * The frame's own Design row leads its `layers` list. A Design document is one
 * flat list of box rows, the children point at their frame by id, and the frame
 * row is where a per-slide transition and the speaker notes are written, so the
 * list holds the frame first and its children after it in z-order.
 *
 * Pure: no DOM, no clock, no network, no filesystem, no randomness. The same
 * source and options produce byte-identical JSON on every host.
 */

import type {
  AlgorithmVersionsV1,
  ArchetypeIdV1,
  ArchetypeRefV1,
  ArchetypeRoleV1,
  ArchetypeV1,
  ColorMappingV1,
  CompiledDeckV1,
  CompiledFrameV1,
  DeckCensusV1,
  DesignBoxRowV1,
  DesignSystemSnapshotV1,
  DispositionV1,
  FidelityStateV1,
  LineageV1,
  MasterTextStyleV1,
  ObjectClassV1,
  ObjectPlanV1,
  PlanActionV1,
  RebrandReportV1,
  RenovationPlanV1,
  ReplacementV1,
  ReportCodeV1,
  SlideMasterV1,
  SlidePlanV1,
  SlideSourceV1,
  SourceDeckV1,
  SourceObjectKindV1,
  SourceObjectV1,
  SourceParaV1,
  SourceRunV1,
  SourceWarningCodeV1,
} from '@lolly-tools/core';
import { roleFontSize } from '@lolly-tools/core';

import { mapFontsToBrand } from './brand-map.ts';
import { contrastRatio, deltaEOkSrgb, hexToOklch, parseHex } from './brand-derive.ts';
import {
  correctionDrops,
  designTextFromPlain,
  designTextOf,
  hasDesignMarkup,
  parseDesignText,
  plainOfDesignText,
  type DesignTextRunV1,
} from './design-text.ts';
import { ACCENT_CHROMA_FLOOR } from './deck-census.ts';
import { bgIsDark, parseBackgroundRgb, type LogoSetV1 } from './logo-variant.ts';
import {
  FALLBACK_BRAND_FACE,
  isPlainTheme,
  masterForPlan,
  masterTokenPaths,
  systemForPlan,
  themeMaster,
  themeSourceOf,
  themedColors,
  type DeckLookV1,
  type ThemeSourceV1,
} from './rebrand-design-system.ts';
import { FONT_ALIASES, normaliseFamily } from './rebrand-fonts.ts';
import { addEntry, emptyReport, finalizeReport, setSlideCounts } from './rebrand-report.ts';
import { compareCodeUnits } from './rebrand-order.ts';
import { nounFor } from './rebrand-review.ts';
import { brandGroundPath, slideGroundPlan } from './rebrand-theme.ts';
import { seedFrame, type TokenResolver } from './slide-master.ts';
import {
  MAX_VECTOR_ROWS_PER_FRAME,
  vectorItemsToRows,
  vectorRowsPathChars,
  type VectorPlacementV1,
} from './svg-items.ts';

/** Frame size when the caller states none and the source states nothing usable. */
const DEFAULT_FRAME = { width: 1280, height: 720 } as const;

/** Gap between two frames on the Design canvas, in px, across and down. */
const FRAME_GAP = 80;

/**
 * Frames per row on the Design canvas (plan 275, F17). The compile lays the grid
 * out, so the web handoff, the CLI, the MCP function and a `.lolly` file open on
 * the same arrangement, and seventeen slides no longer land in one long row with
 * their names printed over each other.
 */
export const FRAMES_PER_ROW = 4;

/** Where the frame at this place in the deck sits on the Design canvas. */
export function framePosition(index: number, width: number, height: number): { x: number; y: number } {
  const at = Math.max(0, Math.floor(index));
  return {
    x: (at % FRAMES_PER_ROW) * (width + FRAME_GAP),
    y: Math.floor(at / FRAMES_PER_ROW) * (height + FRAME_GAP),
  };
}

/** The report sentence for source formatting Design's text has no token for. */
/** A list of words joined for a sentence: `a`, `a and b`, `a, b and c`. */
function wordList(words: readonly string[]): string {
  return words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}` : (words[0] ?? '');
}

function formattingNotCarried(slideNumber: number, dropped: readonly string[]): string {
  return `The text on slide ${slideNumber} was carried without its ${wordList(dropped)}, which Design text has no place for.`;
}

/** What a correction on one slide left behind, in one sentence. */
function correctedWithout(slideNumber: number, lost: readonly string[]): string {
  return `The corrected text on slide ${slideNumber} is plain words, so the ${wordList(lost)} the source text carried did not travel.`;
}

/**
 * A table is carried cell by cell up to this many rows and columns. The bound is
 * this compile's own: one text layer per cell, and a slide-sized frame stops
 * being readable long before a 512 by 128 grid, which is what the pptx writer
 * (`engine/src/pptx.ts`) allows. A table past it is truncated AND reported, with
 * the dropped counts named, never carried away in silence.
 */
const MAX_TABLE_ROWS = 20;
const MAX_TABLE_COLS = 12;

/** Points to px at the 96 dpi reference the source model uses. */
const PT_TO_PX = 96 / 72;

/** A design-system snapshot standing for "none was resolved", used by the faithful mode. */
const NO_DESIGN_SYSTEM: DesignSystemSnapshotV1 = {
  id: 'none',
  tokenHash: `sha256:${'0'.repeat(64)}`,
  fontHashes: {},
  assetHashes: {},
};

export interface CompileFaithfulOptsV1 {
  /** Frame size in px. Defaults to the first slide's own size, else 1280 by 720. */
  frameSize?: { width: number; height: number };
  /** Prefix for every minted layer id. Defaults to `r`. */
  idPrefix?: string;
  /** Recorded on the result. Defaults to a snapshot saying no design system was resolved. */
  designSystem?: DesignSystemSnapshotV1;
  /** Recorded on the result. `reader` defaults to the source deck's own reader version. */
  algorithms?: AlgorithmVersionsV1;
  /** Plan revision this compile belongs to. Defaults to 0, since the faithful mode needs no plan. */
  planRevision?: number;
  /** Fill of an authored placeholder box. */
  placeholderFill?: string;
  /** Ink of an authored placeholder label. */
  placeholderInk?: string;
}

/** Identity of the compile step, recorded on the result and bumped when its output changes. */
export const DECK_COMPILE_VERSION = 'faithful-2026-09-23.1';

function round2(n: number): number {
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

/** A row's id as a string. */
function rowId(row: DesignBoxRowV1): string {
  return typeof row.id === 'string' ? row.id : String(row.id ?? '');
}

/** A source id reduced to characters a layer id can carry, without losing its ordering. */
function slug(id: string): string {
  return id.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'x';
}

function plainText(object: SourceObjectV1): string {
  const paras = object.text?.paras ?? [];
  return paras.map((para) => para.runs.map((run) => run.text).join('')).join('\n');
}

function firstRun(object: SourceObjectV1): SourceRunV1 | undefined {
  for (const para of object.text?.paras ?? []) {
    const run = para.runs[0];
    if (run) return run;
  }
  return undefined;
}

/** The word a placeholder label uses for the content that could not be read. */
function kindLabel(kind: SourceObjectKindV1): string {
  switch (kind) {
    case 'chart':
      return 'Chart';
    case 'table':
      return 'Table';
    case 'pic':
      return 'Picture';
    case 'vector':
      return 'Vector art';
    case 'text':
      return 'Text';
    case 'shape':
      return 'Shape';
    default:
      return 'Object';
  }
}

/** The slide's own title text, when one of its objects is a title placeholder or the first text. */
function slideName(slide: SlideSourceV1): string {
  const titled = slide.objects.find((o) => o.placeholder === 'title' || o.placeholder === 'ctrTitle');
  const candidate = titled ?? slide.objects.find((o) => o.kind === 'text' && plainText(o).trim().length > 0);
  const text = candidate ? plainText(candidate).split('\n')[0]?.trim() ?? '' : '';
  return text.length > 0 ? text.slice(0, 120) : `Slide ${slide.index + 1}`;
}

interface Placement {
  ox: number;
  oy: number;
  sx: number;
  sy: number;
}

/**
 * The mirror an object's composed affine states, read back from its linear part.
 *
 * A source object carries `rot` on its box and the rest of its pose in
 * `transform`. Dropping the transform would place a mirrored picture the right
 * way round, which is wrong and invisible, so the mirror is read back here and
 * written as Design's own `flipH` / `flipV`. The choice between the two follows
 * the reader's: the same matrix reads either way, and the one whose angle is
 * nearer zero is the one the box's `rot` was written from.
 */
function flipsOf(transform: readonly number[] | undefined): { flipH?: boolean; flipV?: boolean } {
  if (!transform || transform.length < 4) return {};
  const a = transform[0] ?? 1;
  const b = transform[1] ?? 0;
  const c = transform[2] ?? 0;
  const d = transform[3] ?? 1;
  if (a * d - b * c >= 0) return {};
  return Math.abs(Math.atan2(-b, -a)) <= Math.abs(Math.atan2(b, a)) ? { flipH: true } : { flipV: true };
}

function placeBox(
  object: SourceObjectV1,
  at: Placement,
): { x: number; y: number; w: number; h: number; rot?: number; flipH?: boolean; flipV?: boolean } {
  const box = object.box;
  const row = {
    x: round2(at.ox + box.x * at.sx),
    y: round2(at.oy + box.y * at.sy),
    w: round2(box.w * at.sx),
    h: round2(box.h * at.sy),
  };
  const posed = box.rot ? { ...row, rot: round2(box.rot) } : row;
  const flips = flipsOf(object.transform);
  return flips.flipH || flips.flipV ? { ...posed, ...flips } : posed;
}

/**
 * The report code for one source warning.
 *
 * Only four of the nine source warnings are caps, and calling the others a cap
 * would put a wrong sentence in front of a person, since a surface localises
 * from the code. The contract has no code of its own for an approximation or for
 * a part the reader left behind, so the nearest true one is used and the
 * warning's own code travels in `reason`. Plan 274 follow-up: `REPORT_CODES`
 * wants `source.approximated` and `source.dropped`, at which point this map
 * stops borrowing object codes for deck-level facts.
 */
function reportCodeForWarning(code: SourceWarningCodeV1): ReportCodeV1 {
  switch (code) {
    case 'nodes-truncated':
    case 'slides-truncated':
    case 'part-too-large':
      return 'source.cap-reached';
    case 'media-skipped':
    case 'video-dropped':
      return 'source.media-skipped';
    case 'gradient-flattened':
    case 'group-transform-approximated':
      return 'object.transformed';
    // A metafile and a drawing past the deck budget both arrived and stayed pictures
    // (plan 275 decision 32): the report says so in the drawing's own words.
    case 'metafile-not-converted':
      return 'vector.metafile-not-converted';
    case 'vector-budget-reached':
      return 'vector.kept-as-picture';
    default:
      return 'object.removed';
  }
}

/** Fill and ink of an authored placeholder, so both modes draw the same muted box. */
interface PlaceholderStyleV1 {
  fill: string;
  ink: string;
}

/**
 * Has this object bytes or a model either mode could actually draw?
 *
 * A picture, a chart, a piece of vector art or an unknown object needs media or a
 * real fallback image; text, a shape and a table are modelled content and need
 * nothing further. False is the signal to author a placeholder rather than an
 * empty box that would read as preserved content.
 */
function hasDrawableBytes(object: SourceObjectV1): boolean {
  if (object.kind === 'pic' || object.kind === 'chart' || object.kind === 'unknown' || object.kind === 'vector') {
    return (object.media ?? object.fidelity.fallbackAssetRef) !== undefined || carriesItems(object);
  }
  return true;
}

// ─── drawings as rows (plan 275 decision 32) ─────────────────────────────────
//
// A drawing the source read as items (an SVG picture, a freeform's custom
// geometry) compiles to one row per item in one group, so it reaches Design as
// shapes a person restyles one by one rather than as one picture. It stays a
// picture, and the report says why, when its reading was refused, when a group
// skews it (rows cannot follow a shear), when it has more parts than
// `MAX_VECTOR_ROWS_PER_OBJECT` or its frame already holds
// `MAX_VECTOR_ROWS_PER_FRAME` of them, when the document already holds
// `DOCUMENT_PATH_CHARS` of path data (past it, Design could not keep the
// document's history), and when it goes to the tray, which holds one layer per
// object. Its rows take colour mappings by their own colours: a
// mapping writes a row only where that row's colour is the mapping's source.

/**
 * Characters of encoded path values one compiled document takes from drawings,
 * summed over every row (close-out 9.3). Design stores each history checkpoint
 * deflated and keeps one up to `MAX_REVISION_SNAPSHOT` (4 MiB compressed) and
 * `MAX_REVISION_EXPANDED` (64 MiB of JSON) in the web shell. Measured, deflate at
 * level 6: the 31-chart Downloads deck compiled with its labels still outlined
 * carries 5.95M characters of path data, which deflate to 24.6% of their length
 * (the whole document, 6.4 MB of JSON, to 1.55 MB); path data of random
 * two-decimal coordinates, the least repetitive a drawing gives, deflates to 42.3%.
 * At that worst rate this cap is 3.4 MB compressed, which leaves a fifth of the
 * snapshot for the text, pictures and frames, and at the measured rate it is under
 * 2 MB. Past it, later drawings stay pictures and the report says why.
 */
export const DOCUMENT_PATH_CHARS = 8_000_000;

/** Does this object carry items a compile may place as rows? */
function carriesItems(object: SourceObjectV1): boolean {
  if (object.kind !== 'vector' && object.kind !== 'shape') return false;
  if ((object.vectorItems?.items.length ?? 0) === 0) return false;
  const state = object.fidelity.state;
  return state !== 'unavailable' && state !== 'raster-preserved' && object.fidelity.reason !== 'geometry-approximation';
}

/** The group tag a drawing's rows share. Design's Ungroup clears it; the prefix names what made it. */
function vectorGroupOf(layerId: string): string {
  return `vector:${layerId}`;
}

/** What the omit reasons mean, in words. */
const OMIT_WORDS: Record<string, string> = {
  'cap-reached': 'past the cap',
  'unsupported-element': 'an element with no shape in Design',
  'unsupported-paint': 'a gradient, pattern, clip or filter',
  'unsupported-text': 'text placed glyph by glyph',
};

/** Why a drawing stayed a picture, in words. */
const KEPT_WORDS: Record<string, string> = {
  'cap-reached': 'it has more parts than a slide can hold as shapes',
  'frame-cap': 'its slide already holds as many drawn shapes as it can',
  'document-cap': 'the deck already holds as much drawn detail as one document can keep with its history',
  'geometry': 'its group skews it, which separate shapes cannot follow',
  'tray': 'it waits in the tray, which holds one picture per object',
  'not-read': 'its parts could not be read as shapes',
};

function shapesWord(n: number): string {
  return n === 1 ? '1 editable shape' : `${n} editable shapes`;
}

function vectorCarriedMessage(noun: string, slideNumber: number, rows: number, desc: string | undefined): string {
  const credit = desc ? ` It credits its source: ${desc}` : '';
  return `The ${noun} on slide ${slideNumber} was carried over as ${shapesWord(rows)} in one group.${credit}`;
}

function vectorOmittedMessage(noun: string, slideNumber: number, omitted: ReadonlyArray<{ reason: string; count: number }>): string {
  const total = omitted.reduce((n, o) => n + o.count, 0);
  const parts = omitted.map((o) => `${o.count} for ${OMIT_WORDS[o.reason] ?? o.reason}`).join(', ');
  return `${total === 1 ? '1 part' : `${total} parts`} of the ${noun} on slide ${slideNumber} could not be carried as shapes and ${total === 1 ? 'was' : 'were'} left out (${parts}).`;
}

function vectorKeptMessage(noun: string, slideNumber: number, why: string): string {
  return `The ${noun} on slide ${slideNumber} stayed a picture: ${KEPT_WORDS[why] ?? KEPT_WORDS['not-read']}.`;
}

/** Why a drawing that could have been rows is a picture, from what its reading says. */
function keptReason(object: SourceObjectV1): string {
  if (object.fidelity.reason === 'geometry-approximation') return 'geometry';
  if (object.vectorItems?.omitted?.some((o) => o.reason === 'cap-reached')) return 'cap-reached';
  return 'not-read';
}

/** A drawing's rows written as `#rrggbb` or `#rrggbbaa`: the target takes the alpha the row's own colour had. */
function withRowAlpha(current: string, target: string): string {
  const alpha = /^#?[0-9a-fA-F]{6}([0-9a-fA-F]{2})$/.exec(current.trim())?.[1];
  const base = target.trim().replace(/^#/, '').slice(0, 6);
  return alpha ? `#${base}${alpha.toLowerCase()}` : `#${base}`;
}

/**
 * The two rows an authored placeholder is made of: a muted box and a label saying
 * what could not be read. Both modes call this, so a placeholder looks the same
 * whichever one produced it, and neither can pass a picture off as the source.
 */
function authorPlaceholder(
  boxBase: DesignBoxRowV1,
  labelBase: DesignBoxRowV1,
  text: string,
  style: PlaceholderStyleV1,
): { box: DesignBoxRowV1; label: DesignBoxRowV1 } {
  return {
    box: { ...boxBase, kind: 'box', bg: style.fill, shape: 'rounded', radius: 8 },
    label: {
      ...labelBase,
      kind: 'text',
      text,
      fg: style.ink,
      fontSize: 18,
      align: 'center',
      valign: 'middle',
    },
  };
}

/**
 * Compile a source deck faithfully: one frame per slide, one layer per object,
 * the same proportions, and a report that accounts for every object.
 */
/**
 * A text the source drew on one line stays on one line in the before (close-out
 * CP13): one paragraph in a box under `ONE_LINE_BOX` lines tall at its size. The
 * average glyph advance reads most faces a little wide, so a title the source set on
 * one line would wrap in the drawing; the row widens to the width the estimate needs,
 * about its alignment, inside the frame. A box that holds two lines keeps its width,
 * because the source may have wrapped it.
 */
function holdOneLine(row: DesignBoxRowV1, object: SourceObjectV1, frame: { x: number; w: number }): void {
  const paras = object.text?.paras ?? [];
  const text = plainOfDesignText(rowStr(row, 'text'));
  const size = rowNum(row, 'fontSize');
  if (paras.length !== 1 || !text || text.includes('\n') || !(size > 0)) return;
  if (rowNum(row, 'h') >= size * DESIGN_LINE_HEIGHT * ONE_LINE_BOX) return;
  const w = rowNum(row, 'w');
  const need = Math.min(frame.w, Math.ceil(text.length * size * AVERAGE_GLYPH_EM + designTextPad(row) * 2));
  if (need <= w) return;
  const x = rowNum(row, 'x');
  const grow = need - w;
  const align = rowStr(row, 'align');
  const wanted = align === 'center' ? x - grow / 2 : align === 'right' ? x - grow : x;
  // Inside the frame: the box moves in from whichever edge it would cross.
  const left = Math.min(Math.max(frame.x, wanted), frame.x + frame.w - need);
  row.x = round2(left);
  row.w = need;
}

/** A single paragraph in a box under this many lines tall at its size was set on one line. */
export const ONE_LINE_BOX = 1.6;

export function compileFaithful(source: SourceDeckV1, opts: CompileFaithfulOptsV1 = {}): CompiledDeckV1 {
  const prefix = opts.idPrefix ?? 'r';
  const first = source.slides[0];
  const frameW = opts.frameSize?.width ?? (first && first.width > 0 ? first.width : DEFAULT_FRAME.width);
  const frameH = opts.frameSize?.height ?? (first && first.height > 0 ? first.height : DEFAULT_FRAME.height);
  const planRevision = opts.planRevision ?? 0;
  const placeholderFill = opts.placeholderFill ?? '#e7e7e7';
  const placeholderInk = opts.placeholderInk ?? '#555555';

  const report: RebrandReportV1 = emptyReport(source.source.hash, planRevision);
  const forward: LineageV1['forward'] = [];
  const backward: LineageV1['backward'] = [];
  const frames: CompiledFrameV1[] = [];
  const objectIds: string[] = [];
  /** Characters of path data the document took from drawings, against `DOCUMENT_PATH_CHARS`. */
  let vectorPathChars = 0;
  /** Source text objects whose formatting Design's text could not carry in full. */
  const droppedBy = new Map<string, string[]>();

  source.warnings.forEach((warning) => {
    addEntry(report, {
      code: reportCodeForWarning(warning.code),
      message: warning.message,
      reason: warning.code,
    });
  });

  source.slides.forEach((slide, index) => {
    const frameId = `${prefix}.${slug(slide.id)}`;
    const origin = framePosition(index, frameW, frameH);
    const at: Placement = {
      ox: origin.x,
      oy: origin.y,
      sx: slide.width > 0 ? frameW / slide.width : 1,
      sy: slide.height > 0 ? frameH / slide.height : 1,
    };

    slide.warnings.forEach((warning) => {
      addEntry(report, {
        code: reportCodeForWarning(warning.code),
        message: warning.message,
        slideId: slide.id,
        reason: warning.code,
      });
    });

    const layers: DesignBoxRowV1[] = [];
    const placeholderLayerIds: string[] = [];
    const furnitureLayerIds: string[] = [];
    let order = 0;
    /** Rows this frame took from drawings, against `MAX_VECTOR_ROWS_PER_FRAME`. */
    let vectorRowsOnFrame = 0;

    const name = slideName(slide);
    const frameRow: DesignBoxRowV1 = {
      id: frameId,
      kind: 'frame',
      x: at.ox,
      y: at.oy,
      w: frameW,
      h: frameH,
      name,
      order: order++,
    };
    if (slide.background.color?.hex) frameRow.bg = slide.background.color.hex;
    if (slide.notes) frameRow.notes = slide.notes;
    if (slide.transition?.kind) frameRow.slideTransition = slide.transition.kind;
    layers.push(frameRow);
    backward.push({ layerId: frameId, sourceObjectIds: [] });

    // A slide's ground can be a picture, and a frame row holds a colour only. It
    // becomes a full-frame image layer behind everything else, so a template
    // deck whose ground is a full-bleed photograph does not compile to white.
    // No object states it, so it carries no disposition and no report entry: the
    // content travelled, and the accounting is over objects.
    if (slide.background.media) {
      const groundId = `${frameId}.ground`;
      layers.push({
        id: groundId,
        kind: 'image',
        x: at.ox,
        y: at.oy,
        w: frameW,
        h: frameH,
        frame: frameId,
        order: order++,
        name: `${slide.id} ground`,
        image: slide.background.media,
        fit: 'cover',
      });
      backward.push({ layerId: groundId, sourceObjectIds: [] });
    }

    const base = (object: SourceObjectV1, id: string): DesignBoxRowV1 => ({
      id,
      ...placeBox(object, at),
      frame: frameId,
      order: order++,
      name: object.id,
    });

    /** Furniture stays nameable after the compile, so a later stage can tell it from slide content. */
    const noteFurniture = (object: SourceObjectV1, ids: string[]): void => {
      if (object.origin === 'master' || object.origin === 'layout') furnitureLayerIds.push(...ids);
    };

    for (const object of slide.objects) {
      objectIds.push(object.id);
      const layerId = `${prefix}.${slug(object.id)}`;
      const produced: string[] = [];

      // Either the reader has nothing to show, or this compile has no way to
      // draw what it has. Both author a labelled placeholder and both are
      // `unresolved`: describing nothing as preserved content is the one thing
      // this mode may never do.
      const drawable = hasDrawableBytes(object);

      if (object.fidelity.state === 'unavailable' || !drawable) {
        const labelId = `${layerId}.label`;
        const { box, label } = authorPlaceholder(
          base(object, layerId),
          base(object, labelId),
          `${kindLabel(object.kind)} could not be read`,
          { fill: placeholderFill, ink: placeholderInk },
        );
        layers.push(box, label);
        produced.push(layerId, labelId);
        placeholderLayerIds.push(layerId, labelId);
        noteFurniture(object, [layerId, labelId]);
        backward.push({ layerId, sourceObjectIds: [object.id], derived: 'placeholder' });
        backward.push({ layerId: labelId, sourceObjectIds: [object.id], derived: 'placeholder' });
        addEntry(report, {
          code: 'object.unresolved',
          message: `${kindLabel(object.kind)} on slide ${slide.index + 1} could not be read, so a labelled stand-in takes its place.`,
          slideId: slide.id,
          objectId: object.id,
          layerId,
          disposition: 'unresolved',
          // A source that claimed preserved bytes and then named none leaves
          // this compile with nothing, so the entry states what it faced rather
          // than repeating a claim the object did not keep.
          fidelity: drawable ? object.fidelity.state : 'unavailable',
          reason: drawable ? object.fidelity.reason : (object.fidelity.reason ?? 'media-missing'),
        });
        addEntry(report, {
          code: 'object.placeholder-authored',
          slideId: slide.id,
          objectId: object.id,
          layerId,
        });
        forward.push({ sourceObjectId: object.id, layerIds: produced });
        continue;
      }

      // A drawing read as items becomes its rows, in one group at the object's own
      // place and pose, stretched onto its box the way PowerPoint draws a picture.
      if (carriesItems(object) && object.vectorItems) {
        const place: VectorPlacementV1 = placeBox(object, at);
        const made = vectorItemsToRows(object.vectorItems, place, { idPrefix: layerId, group: vectorGroupOf(layerId), frame: frameId, fit: 'fill' });
        const noun = nounFor('unknown', object.kind);
        const chars = 'rows' in made ? vectorRowsPathChars(made.rows) : 0;
        const frameRoom = 'rows' in made && vectorRowsOnFrame + made.rows.length <= MAX_VECTOR_ROWS_PER_FRAME;
        const documentRoom = vectorPathChars + chars <= DOCUMENT_PATH_CHARS;
        if ('rows' in made && frameRoom && documentRoom) {
          vectorRowsOnFrame += made.rows.length;
          vectorPathChars += chars;
          for (const row of made.rows) {
            row.order = order++;
            layers.push(row);
            produced.push(rowId(row));
            backward.push({ layerId: rowId(row), sourceObjectIds: [object.id] });
          }
          noteFurniture(object, produced);
          addEntry(report, {
            code: 'object.transformed',
            message: vectorCarriedMessage(noun, slide.index + 1, made.rows.length, object.vectorItems.desc),
            slideId: slide.id,
            objectId: object.id,
            layerId: produced[0] ?? layerId,
            disposition: 'transformed',
            fidelity: object.fidelity.state,
          });
          if (object.vectorItems.omitted?.length) {
            addEntry(report, {
              code: 'vector.items-omitted',
              message: vectorOmittedMessage(noun, slide.index + 1, object.vectorItems.omitted),
              slideId: slide.id,
              objectId: object.id,
              layerId: produced[0] ?? layerId,
              reason: object.vectorItems.omitted.map((o) => `${o.reason}:${o.count}`).join(','),
            });
          }
          forward.push({ sourceObjectId: object.id, layerIds: produced });
          continue;
        }
        if (object.kind === 'vector') {
          const why = 'rows' in made ? (frameRoom ? 'document-cap' : 'frame-cap') : made.refused === 'cap-reached' ? 'cap-reached' : 'not-read';
          addEntry(report, {
            code: 'vector.kept-as-picture',
            message: vectorKeptMessage(noun, slide.index + 1, why),
            slideId: slide.id,
            objectId: object.id,
            layerId,
            reason: why,
          });
        }
      } else if (object.kind === 'vector') {
        const why = keptReason(object);
        addEntry(report, {
          code: 'vector.kept-as-picture',
          message: vectorKeptMessage(nounFor('unknown', object.kind), slide.index + 1, why),
          slideId: slide.id,
          objectId: object.id,
          layerId,
          reason: why,
        });
      }

      // A drawing that stays a picture keeps the raster it was stored with.
      const imageRef = object.kind === 'pic' ? object.media : (object.media ?? object.fidelity.fallbackAssetRef);

      if (object.kind === 'table' && object.table) {
        const container: DesignBoxRowV1 = { ...base(object, layerId), kind: 'box' };
        if (object.fill?.hex) container.bg = object.fill.hex;
        layers.push(container);
        produced.push(layerId);
        backward.push({ layerId, sourceObjectIds: [object.id] });

        const sourceRows = object.table.length;
        const sourceCols = object.table.reduce((n, row) => Math.max(n, row.length), 0);
        const rows = object.table.slice(0, MAX_TABLE_ROWS);
        const cols = Math.min(MAX_TABLE_COLS, rows.reduce((n, row) => Math.max(n, row.length), 0));
        const capped = sourceRows > MAX_TABLE_ROWS || sourceCols > MAX_TABLE_COLS;
        const sourceCells = object.table.reduce((n, row) => n + row.length, 0);
        const carriedCells = rows.reduce((n, row) => n + Math.min(row.length, cols), 0);
        const droppedCells = sourceCells - carriedCells;
        const cellW = cols > 0 ? (object.box.w * at.sx) / cols : 0;
        const cellH = rows.length > 0 ? (object.box.h * at.sy) / rows.length : 0;
        rows.forEach((row, r) => {
          for (let c = 0; c < cols; c++) {
            const cellId = `${layerId}.r${r}c${c}`;
            const cell: DesignBoxRowV1 = {
              id: cellId,
              kind: 'text',
              x: round2(at.ox + object.box.x * at.sx + c * cellW),
              y: round2(at.oy + object.box.y * at.sy + r * cellH),
              w: round2(cellW),
              h: round2(cellH),
              frame: frameId,
              order: order++,
              name: `${object.id} r${r}c${c}`,
              text: designTextFromPlain(row[c] ?? ''),
              valign: 'middle',
            };
            layers.push(cell);
            produced.push(cellId);
            backward.push({ layerId: cellId, sourceObjectIds: [object.id] });
          }
        });
        if (capped) {
          addEntry(report, {
            code: 'source.cap-reached',
            message: `The table on slide ${slide.index + 1} is ${sourceRows} by ${sourceCols}, past this compile's cap of ${MAX_TABLE_ROWS} by ${MAX_TABLE_COLS}, so ${droppedCells} cell(s) did not travel.`,
            slideId: slide.id,
            objectId: object.id,
            layerId,
            reason: 'cap-reached',
          });
        }
        addEntry(report, {
          code: 'object.transformed',
          message: capped
            ? `The table on slide ${slide.index + 1} was carried over as one text layer per cell for the first ${rows.length} row(s) and ${cols} column(s) of a ${sourceRows} by ${sourceCols} table.`
            : `The table on slide ${slide.index + 1} was carried over as one text layer per cell.`,
          slideId: slide.id,
          objectId: object.id,
          layerId,
          disposition: 'transformed',
          fidelity: capped ? 'approximate' : object.fidelity.state,
          ...(capped ? { reason: 'cap-reached' } : {}),
        });
        noteFurniture(object, produced);
        forward.push({ sourceObjectId: object.id, layerIds: produced });
        continue;
      }

      const row: DesignBoxRowV1 = base(object, layerId);
      if (imageRef) {
        row.kind = 'image';
        row.image = imageRef;
        row.fit = 'fill';
        if (object.alt) row.text = object.alt;
      } else if (object.kind === 'text') {
        // The runs travel in Design's text subset (plan 275 section 7.2): bold, italic,
        // underline, strike and colour per run, bullets and numbers per paragraph. The
        // row states weight 400 so Design's default of 700 never paints regular text
        // bold; a bold run carries its own marker.
        const rich = designTextOf(object.text?.paras ?? [], { carryColour: true });
        row.kind = 'text';
        row.text = rich.text;
        const run = firstRun(object);
        if (run?.sizePt) row.fontSize = round2(run.sizePt * PT_TO_PX * at.sy);
        if (rich.baseColour) row.fg = rich.baseColour;
        row.weight = 400;
        if (rich.align && rich.align !== 'justify') row.align = rich.align;
        // The source reads text from the top of its box; Design centres a row that
        // states nothing, so the row says top and the preview and Design agree.
        row.valign = 'top';
        // Text read from a picture has a box tight to its ink, with no inset of its own.
        if (object.origin === 'raster-region') row.pad = 0;
        holdOneLine(row, object, { x: at.ox, w: frameW });
        if (object.fill?.hex) row.bg = object.fill.hex;
        if (rich.dropped.length > 0) droppedBy.set(object.id, rich.dropped);
      } else {
        row.kind = 'box';
        if (object.geom === 'ellipse') row.shape = 'ellipse';
        if (object.geom === 'roundRect') row.shape = 'rounded';
        if (object.fill?.hex) row.bg = object.fill.hex;
        if (object.line?.color?.hex) row.stroke = object.line.color.hex;
        if (object.line?.widthPt) row.strokeW = round2(object.line.widthPt * PT_TO_PX * at.sy);
      }
      layers.push(row);
      produced.push(layerId);
      noteFurniture(object, [layerId]);
      backward.push({ layerId, sourceObjectIds: [object.id] });
      addEntry(report, {
        code: 'object.retained',
        message: `The ${nounFor('unknown', object.kind)} on slide ${slide.index + 1} was carried over.`,
        slideId: slide.id,
        objectId: object.id,
        layerId,
        disposition: 'retained',
        fidelity: object.fidelity.state,
      });
      const dropped = droppedBy.get(object.id);
      if (dropped) {
        addEntry(report, {
          code: 'text.formatting-not-carried',
          message: formattingNotCarried(slide.index + 1, dropped),
          slideId: slide.id,
          objectId: object.id,
          layerId,
          reason: dropped.join(','),
        });
      }
      forward.push({ sourceObjectId: object.id, layerIds: produced });
    }

    const frame: CompiledFrameV1 = {
      id: frameId,
      sourceSlideId: slide.id,
      name,
      width: frameW,
      height: frameH,
      archetype: 'content',
      layers,
      // The contract calls these "layers seeded from the master's furniture".
      // The faithful mode seeds nothing, so what goes here is the furniture it
      // CARRIED: every layer whose source object was declared on the master or
      // the layout. Without it the one fact the source model kept about
      // furniture stops at the compile boundary.
      furnitureLayerIds,
      placeholderLayerIds,
    };
    if (slide.notes) frame.notes = slide.notes;
    frames.push(frame);
  });

  setSlideCounts(report, {
    source: source.slides.length,
    included: source.slides.length,
    excluded: 0,
    continuation: 0,
  });
  addEntry(report, { code: 'export.not-verified' });
  finalizeReport(report, objectIds);

  forward.sort((a, b) => (a.sourceObjectId < b.sourceObjectId ? -1 : a.sourceObjectId > b.sourceObjectId ? 1 : 0));
  backward.sort((a, b) => (a.layerId < b.layerId ? -1 : a.layerId > b.layerId ? 1 : 0));

  return {
    version: 1,
    source: {
      lineageId: source.source.lineageId,
      hash: source.source.hash,
      instanceId: source.source.instanceId,
    },
    planRevision,
    designSystem: opts.designSystem ?? NO_DESIGN_SYSTEM,
    algorithms: opts.algorithms ?? {
      reader: source.reader.version,
      census: 'none',
      plan: 'none',
      compile: DECK_COMPILE_VERSION,
    },
    frames,
    tray: [],
    lineage: { forward, backward },
    report,
  };
}

// ─── the renovate mode (plan 274 section 3.4) ────────────────────────────────
//
// The faithful mode above answers "did the content travel". This one answers the
// other half of the journey: the slide is rebuilt from the design system's own
// slide master, and the source content is assigned to the archetype's roles. The
// two modes share their helpers and their report, and nothing about the faithful
// path changes.
//
// The rules the mode follows, all of them from plan 274 section 3.4:
//
//   - The plan decides. A proposal nobody reviewed is applied only when the
//     caller asks for it (`applyUnreviewed`, and `applyNeedsAttention` for the
//     flagged ones), and the report says so; otherwise an unreviewed proposal to
//     remove or replace is compiled as keep.
//   - Content goes into a role slot the master seeded, never at scaled source
//     coordinates on top of the furniture. A kept object takes, in order: (a) the
//     archetype slot for its role; (b) a compatible slot on the same frame (a
//     second body text joins the body while the estimate allows, a note such as a
//     citation or a kept footer takes the master's footer, a caption or label
//     slot, or the body's last paragraph); (d) a continuation frame seeded from an
//     archetype that has the role; and (e) the tray, only when no archetype of the
//     master has a place for it, when the plan asked for the tray, past the
//     continuation bound, or for a kept mark with no free picture slot on its own
//     frame (a slide of its own would read as content), with the reason on the
//     report entry. A mark replaced by the design system's own is the master's
//     furniture, never surplus. Step (c), the
//     archetype that covers the slide's content, is the first pass's choice.
//   - Several kept pictures on one slide share its picture slot as a grid of up
//     to `MAX_GRID_PICTURES` (`pictureGrid`: equal cells, equal gutters, each
//     picture at its own aspect, reading order). The pictures past that go to
//     one continuation slide with a grid of its own, and past that to the tray,
//     so a slide of pictures never becomes one slide per picture.
//   - A text slot takes the archetype's type scale and ink, not the source's.
//   - Colour mappings reach what the master does not colour: kept shapes and
//     strokes, fills, and text set wholly in one chromatic colour. An image layer
//     is never recoloured, because a kept picture keeps its own colours.
//   - Every source object still gets exactly one disposition, and lineage is
//     still written both ways for every layer.

/** Identity of the renovate compile, recorded on the result and bumped when its output changes. */
export const DECK_RENOVATE_VERSION = 'renovate-2026-09-25.1';

/**
 * Average glyph advance as a fraction of the font size, used by the overflow
 * estimate. It is an estimate and the report entry says so: real shaping needs a
 * font file and a shaper, which an engine module has no way to reach.
 */
export const AVERAGE_GLYPH_EM = 0.5;

/** Line box as a multiple of the font size, used by the same estimate. */
export const ESTIMATE_LINE_HEIGHT = 1.25;

/**
 * The line box Design draws a text row with when the row states no `lineHeight`
 * (`textCss` in community/_shared/design-renderer.js). The fit pass and the preview
 * measure a row with it, so the words a preview shows are the words Design shows.
 */
export const DESIGN_LINE_HEIGHT = 1.12;

/** The gap a text box that grew keeps above the box under it, as a share of the frame height: 8 px at 720. */
export const TEXT_GROW_GAP_SHARE = 1 / 90;

/** Design's inset between a text box's edge and its words when the row states no `pad`. */
export const DESIGN_TEXT_PAD = 8;

/** The widest inset Design allows, in px. */
const DESIGN_MAX_PAD = 400;

/**
 * Greedy wrap by an average glyph advance. Explicit newlines are kept; a word
 * wider than one line is broken rather than left to run off the box.
 */
export function wrapByAverageWidth(text: string, fontSize: number, width: number): string[] {
  const perLine = fontSize > 0 && width > 0
    ? Math.max(1, Math.floor(width / (fontSize * AVERAGE_GLYPH_EM)))
    : 1;
  const out: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (paragraph.length <= perLine) {
      out.push(paragraph);
      continue;
    }
    let line = '';
    for (const word of paragraph.split(' ')) {
      let piece = word;
      while (piece.length > perLine) {
        if (line) {
          out.push(line);
          line = '';
        }
        out.push(piece.slice(0, perLine));
        piece = piece.slice(perLine);
      }
      if (!line) line = piece;
      else if (line.length + 1 + piece.length <= perLine) line = `${line} ${piece}`;
      else {
        out.push(line);
        line = piece;
      }
    }
    out.push(line);
  }
  return out;
}

/** A row's words laid out in lines, as the preview draws them and the fit pass counts them. */
export interface DesignTextLayoutV1 {
  /** Each drawn line as its runs; a line of plain words is one run. */
  lines: DesignTextRunV1[][];
  /** Each line's indent in character widths (a list line's level); 0 for the rest. */
  indents: number[];
}

/**
 * Design text read into lines of runs as Design draws them (plan 275 section 7.2):
 * a list line starts with its marker, `•` or `N.` and two spaces, after its indent,
 * and every run keeps its bold, italic, underline, strike and colour.
 */
function styledDesignLines(text: string): Array<{ indent: number; runs: DesignTextRunV1[] }> {
  return parseDesignText(text).map((line) => {
    const marker = line.list === 'bullet' ? '•  ' : line.list === 'number' ? `${line.number ?? 1}.  ` : '';
    if (marker) return { indent: line.indent, runs: [{ text: marker }, ...line.runs] };
    // A plain line's leading spaces are its indent too; the words start after them.
    const runs = line.runs.map((run) => ({ ...run }));
    let strip = line.indent;
    for (const run of runs) {
      const cut = Math.min(strip, run.text.length - run.text.trimStart().length);
      run.text = run.text.slice(cut);
      strip -= cut;
      if (strip === 0 || run.text.length > 0) break;
    }
    return { indent: line.indent, runs: runs.filter((run) => run.text.length > 0) };
  });
}

/**
 * Wrap one styled line by the same average-width estimate as plain text, then cut its
 * runs at the same places, so a styled row takes as many lines as its words would.
 */
function wrapStyledRuns(runs: DesignTextRunV1[], fontSize: number, width: number): DesignTextRunV1[][] {
  const whole = runs.map((run) => run.text).join('');
  const wrapped = wrapByAverageWidth(whole, fontSize, width);
  if (wrapped.length <= 1) return [runs];
  const out: DesignTextRunV1[][] = [];
  let cursor = 0;
  for (const line of wrapped) {
    // The wrap drops one space where it breaks a line; step over it.
    if (whole.slice(cursor, cursor + line.length) !== line && whole[cursor] === ' ') cursor += 1;
    const start = cursor;
    const end = start + line.length;
    const pieces: DesignTextRunV1[] = [];
    let at = 0;
    for (const run of runs) {
      const from = Math.max(start, at);
      const to = Math.min(end, at + run.text.length);
      if (to > from) pieces.push({ ...run, text: run.text.slice(from - at, to - at) });
      at += run.text.length;
    }
    out.push(pieces.length > 0 ? pieces : [{ text: line }]);
    cursor = end;
  }
  return out;
}

/**
 * A row's text in the lines the preview draws, at `fontSize` in a box `width` wide
 * (the box less its inset). Plain words wrap as they are; Design's text subset wraps
 * line by line, a list line at its indent.
 */
export function layoutDesignText(text: string, fontSize: number, width: number): DesignTextLayoutV1 {
  if (!hasDesignMarkup(text)) return { lines: wrapByAverageWidth(text, fontSize, width).map((line) => [{ text: line }]), indents: [] };
  const indents: number[] = [];
  const lines = styledDesignLines(text).flatMap((line) => wrapStyledRuns(line.runs, fontSize, Math.max(1, width - line.indent * fontSize * AVERAGE_GLYPH_EM))
    .map((runs, i) => {
      indents.push(i === 0 ? line.indent : 0);
      return runs;
    }));
  return { lines, indents };
}

/** The inset a text row's words sit in, as Design reads the row's `pad`. */
export function designTextPad(row: DesignBoxRowV1): number {
  const raw = row.pad;
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : DESIGN_TEXT_PAD;
  return Math.round(Math.max(0, Math.min(DESIGN_MAX_PAD, Number.isFinite(n) ? n : DESIGN_TEXT_PAD)));
}

/** How a text row's words sit in its box: how many lines, how many show, and the words Design clips. */
export interface DesignTextFitV1 {
  /** Lines the words take. */
  lines: number;
  /** Lines wholly inside the box, where Design clips it. */
  shown: number;
  /** The height the words need, the inset included, in px. */
  needed: number;
  /** Words on the lines the box clips, 0 when everything shows. */
  wordsCut: number;
}

/**
 * Measure one text row the way Design lays it out: the words wrapped by the average
 * glyph advance inside the row's inset, each line `DESIGN_LINE_HEIGHT` of the size,
 * and the box clipping what runs past its edge. Which lines the clip takes follows
 * the row's vertical alignment: the last lines under `top`, the first under
 * `bottom`, both ends under `middle`, which is Design's own default. A word counts
 * as cut when the line it ends on is not wholly shown. The same numbers draw the
 * preview (`framePreviewSvg`), so the count a caption states is what the drawing shows.
 */
export function designTextFit(row: DesignBoxRowV1): DesignTextFitV1 {
  const text = rowStr(row, 'text');
  const size = rowNum(row, 'fontSize') || 48;
  const pad = designTextPad(row);
  const w = Math.max(0, rowNum(row, 'w') - pad * 2);
  const h = rowNum(row, 'h');
  const layout = layoutDesignText(text, size, w);
  const words = layout.lines.map((runs) => runs.map((run) => run.text).join('').split(/\s+/).filter(Boolean).length);
  const lines = layout.lines.length;
  const line = size * DESIGN_LINE_HEIGHT;
  const needed = round2(lines * line + pad * 2);
  if (!text.trim() || needed <= h + 0.5) return { lines, shown: lines, needed, wordsCut: 0 };
  const valign = rowStr(row, 'valign');
  const inner = h - pad * 2;
  const top = valign === 'top' ? pad : valign === 'bottom' ? pad + inner - lines * line : pad + (inner - lines * line) / 2;
  let shown = 0;
  let cut = 0;
  for (let i = 0; i < lines; i += 1) {
    const y0 = top + i * line;
    if (y0 >= -0.5 && y0 + line <= h + 0.5) shown += 1;
    else cut += words[i] ?? 0;
  }
  return { lines, shown, needed, wordsCut: cut };
}

/** How many continuation frames one slide may add before the rest goes to the tray. */
export const MAX_CONTINUATION_FRAMES = 3;

/**
 * The renovated deck adds at most this share of its included slides as
 * continuations, and never fewer than `MIN_DECK_CONTINUATIONS`. A deck that
 * doubles in length is not the deck its author wrote; past the bound, what is
 * left waits in the tray, pictures before words.
 */
export const DECK_CONTINUATION_SHARE = 0.5;
export const MIN_DECK_CONTINUATIONS = 2;

/** The most continuation slides a deck of this many included slides adds. */
export function deckContinuationLimit(included: number): number {
  return Math.max(MIN_DECK_CONTINUATIONS, Math.ceil(Math.max(0, included) * DECK_CONTINUATION_SHARE));
}

/**
 * The most pictures one picture slot holds as a grid. A slide of several kept
 * pictures (a booth, a row of product shots) shows them together in its visual
 * slot rather than one continuation slide per picture; what is left after the
 * slide's own grid goes to ONE continuation slide with a grid of its own, and
 * past that the tray.
 */
export const MAX_GRID_PICTURES = 6;

/** The gutter between two cells of a picture grid, as a share of the frame width: 16 px at 1280. */
export const GRID_GUTTER_SHARE = 0.0125;

/**
 * A box that is not a content box (a caption, a label, a number) takes a picture only
 * when it covers at least this share of the frame, so a picture never shrinks into a
 * one-line caption band (plan 275 decision 30). At 1280 by 720 that is about 74,000
 * square px.
 */
export const PICTURE_BOX_MIN_SHARE = 0.08;

/** One cell of a picture grid: the box a picture is drawn in, in the slot's own coordinates. */
export interface GridCellV1 {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Lay `aspects.length` pictures out as a grid inside one box, in reading order.
 *
 * Every cell is the same size and the gutters between cells are equal; each
 * picture keeps its own aspect (width over height, 1 when unknown) and is centred
 * in its cell at the largest size the cell allows. The column count is the one that
 * shows the most picture area in all, fewer columns first on a tie, so three wide
 * pictures stack and three tall ones sit side by side. The cells take the size of
 * the largest picture they hold and the whole block is centred in the box, and a
 * short last row is centred under the rows above it. Whole pixels throughout, so
 * two hosts write the same numbers.
 */
export function pictureGrid(
  box: GridCellV1,
  aspects: readonly number[],
  gutter: number,
): GridCellV1[] {
  const n = aspects.length;
  if (n === 0 || !(box.w > 0) || !(box.h > 0)) return [];
  const gap = Math.max(0, gutter);
  const ratio = (a: number): number => (Number.isFinite(a) && a > 0 ? a : 1);
  const fitted = (a: number, w: number, h: number): { w: number; h: number } =>
    (w / h > ratio(a) ? { w: h * ratio(a), h } : { w, h: w / ratio(a) });

  let best: { cols: number; area: number } | undefined;
  for (let cols = 1; cols <= n; cols += 1) {
    const rows = Math.ceil(n / cols);
    const cw = (box.w - (cols - 1) * gap) / cols;
    const ch = (box.h - (rows - 1) * gap) / rows;
    if (!(cw > 0) || !(ch > 0)) continue;
    let area = 0;
    for (const a of aspects) {
      const one = fitted(a, cw, ch);
      area += one.w * one.h;
    }
    // A strict improvement only, so the first column count that reaches an area keeps it.
    if (!best || area > best.area * (1 + 1e-9)) best = { cols, area };
  }
  if (!best) return [];

  const cols = best.cols;
  const rows = Math.ceil(n / cols);
  const room = { w: (box.w - (cols - 1) * gap) / cols, h: (box.h - (rows - 1) * gap) / rows };
  // The cells shrink to the largest picture they hold, and the block of cells is
  // centred in the box, so the gutter between two pictures is the gutter and not
  // whatever room a cell had spare.
  let cw = 0;
  let ch = 0;
  for (const a of aspects) {
    const one = fitted(a, room.w, room.h);
    cw = Math.max(cw, one.w);
    ch = Math.max(ch, one.h);
  }
  const left = box.x + (box.w - (cols * cw + (cols - 1) * gap)) / 2;
  const top = box.y + (box.h - (rows * ch + (rows - 1) * gap)) / 2;
  const lastCount = n - (rows - 1) * cols;
  return aspects.map((a, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const shift = row === rows - 1 ? ((cols - lastCount) * (cw + gap)) / 2 : 0;
    const cellX = left + shift + col * (cw + gap);
    const cellY = top + row * (ch + gap);
    const one = fitted(a, cw, ch);
    const x = Math.round(cellX + (cw - one.w) / 2);
    const y = Math.round(cellY + (ch - one.h) / 2);
    return { x, y, w: Math.round(cellX + (cw + one.w) / 2) - x, h: Math.round(cellY + (ch + one.h) / 2) - y };
  });
}

/** The archetype the compile falls back to when the master does not carry the planned one. */
const FALLBACK_ARCHETYPE: ArchetypeIdV1 = 'content';

/**
 * The archetype whose furniture a slide kept in its original arrangement or as a
 * picture sits under (plan 275 section 4): the master's mark, footer and page
 * number, with no content boxes, since the slide's own content is placed where
 * the source had it.
 */
export const ARRANGED_ARCHETYPE: ArchetypeRefV1 = 'title-only';

/** The resolved design system the renovate compile draws its colours, fonts and marks from. */
export interface RenovateDesignSystemV1 {
  /** Recorded on the result, so the same compile can be reproduced against the same pack. */
  snapshot: DesignSystemSnapshotV1;
  /** Turns a design-system token path into a colour value. */
  tokens: TokenResolver;
  /** Logo asset ids or urls per variant; the background under each logo box picks one. */
  logos?: LogoSetV1<string>;
  /** Overrides the mono preference the background under the mark would otherwise decide. */
  monoLogo?: boolean;
  /** Font families for the master's `display` and `sans` slots, for layers the master leaves unset. */
  fonts?: { major?: string; minor?: string };
}

export interface CompileRenovatedOptsV1 {
  /** Prefix for every minted layer id. Defaults to `r`. */
  idPrefix?: string;
  /**
   * Frame size in px. Defaults to the master's own size. A different size is
   * resolved by taking the master's fractions against it, which is what the
   * fractions are for, and the type scale moves with the height.
   */
  frameSize?: { width: number; height: number };
  /**
   * Apply proposals whose review state is `unreviewed`. Defaults to false, so
   * content is never removed unreviewed. A `needs-attention` proposal is held back
   * whatever this says, since it asks for an answer this flag does not give.
   */
  applyUnreviewed?: boolean;
  /**
   * Apply proposals whose review state is `needs-attention` as proposed: a logo
   * candidate becomes the master's mark, a flagged line is kept or removed as the
   * plan proposes. Defaults to false. The review's preview sets it with
   * `applyUnreviewed`, so the Proposed pane shows every proposal; the report
   * records each one it applied as `review.applied-unreviewed` with its review.
   */
  applyNeedsAttention?: boolean;
  /** Recorded on the result. Defaults to the plan's own versions with this compile's id. */
  algorithms?: AlgorithmVersionsV1;
  /** Fill of an authored placeholder box. */
  placeholderFill?: string;
  /** Ink of an authored placeholder label. */
  placeholderInk?: string;
  /**
   * The design system's two faces (close-out 9.2): every text of a renovated frame is
   * set in `brand`, and in `mono` only where the source marked it as code and the
   * design system states a mono face. `compileSystemOpts` reads them off the
   * design-system input. Without them the brand face is read from `designSystem.fonts`.
   */
  faces?: { brand?: string; mono?: string };
  /** The saved looks a `look` theme may name. A look theme whose look is not here compiles on the design system's own colours. */
  looks?: DeckLookV1[];
  /** The design system is brand-locked, so a look theme is not applied (plan 275 decision 17). */
  locked?: boolean;
  /**
   * The colours the design system was resolved from, for a compile shape that was
   * not resolved in this realm. Without it (and without `themeSourceOf` knowing the
   * shape) a deck theme recolours nothing and only the layouts' dark flags flip.
   */
  themeSource?: ThemeSourceV1;
}

/**
 * What a shell may add to a `RebrandDesignSystemInputV1` for the compile's theme:
 * the saved looks a look theme names and the brand lock. Plain data, so it crosses
 * a worker message with the rest of the input and the token hash never reads it.
 */
export interface RebrandThemeFactsV1 {
  looks?: DeckLookV1[];
  locked?: boolean;
}

function isLookList(value: unknown): value is DeckLookV1[] {
  return Array.isArray(value) && value.every((one: unknown) => one !== null && typeof one === 'object'
    && 'id' in one && typeof one.id === 'string'
    && 'name' in one && typeof one.name === 'string'
    && 'colors' in one && one.colors !== null && typeof one.colors === 'object');
}

/**
 * The compile options a design-system input carries (the faces, and the looks and
 * lock of `RebrandThemeFactsV1`), so the stage worker, the CLI pipeline and the MCP
 * tool hand one compile the same options from one input and draw the same bytes.
 */
export function compileSystemOpts(input: {
  fonts?: { brand?: string; mono?: string };
} & object): Pick<CompileRenovatedOptsV1, 'faces' | 'looks' | 'locked'> {
  const out: Pick<CompileRenovatedOptsV1, 'faces' | 'looks' | 'locked'> = {};
  const brand = input.fonts?.brand;
  const mono = input.fonts?.mono;
  if (brand !== undefined || mono !== undefined) {
    out.faces = { ...(brand !== undefined ? { brand } : {}), ...(mono !== undefined ? { mono } : {}) };
  }
  if ('looks' in input && isLookList(input.looks) && input.looks.length > 0) out.looks = input.looks;
  if ('locked' in input && input.locked === true) out.locked = true;
  return out;
}

export interface CompileRenovatedInputV1 {
  source: SourceDeckV1;
  /** The census, when one was run. Only used to name the class of an object the plan does not list. */
  census?: DeckCensusV1;
  plan: RenovationPlanV1;
  master: SlideMasterV1;
  designSystem: RenovateDesignSystemV1;
  opts?: CompileRenovatedOptsV1;
}

function rowStr(row: DesignBoxRowV1, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value : '';
}

function rowNum(row: DesignBoxRowV1, key: string): number {
  const value = row[key];
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string' || value.trim() === '') return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * The master resolved at the target frame size.
 *
 * Every box in a master is a fraction, so a different size needs no second set of
 * numbers; only the type scale and the per-placeholder font sizes are px at the
 * master size, and they move with the height. The returned master keeps its id
 * and version, because it is the same master read at another size.
 */
function sizedMaster(master: SlideMasterV1, size?: { width: number; height: number }): SlideMasterV1 {
  if (!size || !(size.width > 0) || !(size.height > 0)) return master;
  if (size.width === master.size.width && size.height === master.size.height) return master;
  const k = size.height / master.size.height;
  const scaleStyle = (style: MasterTextStyleV1 | undefined): MasterTextStyleV1 | undefined =>
    style && typeof style.fontSize === 'number' ? { ...style, fontSize: round2(style.fontSize * k) } : style;
  const scale = master.typeScale;
  return {
    ...master,
    size: { width: size.width, height: size.height },
    typeScale: {
      title: round2(scale.title * k),
      subtitle: round2(scale.subtitle * k),
      body: round2(scale.body * k),
      caption: round2(scale.caption * k),
      number: round2(scale.number * k),
      label: round2(scale.label * k),
    },
    archetypes: master.archetypes.map((archetype) => ({
      ...archetype,
      placeholders: archetype.placeholders.map((ph) => {
        const style = scaleStyle(ph.style);
        return style ? { ...ph, style } : ph;
      }),
    })),
    furniture: master.furniture.map((f) => {
      const style = scaleStyle(f.style);
      return style ? { ...f, style } : f;
    }),
  };
}

/** The effective action for one object, and how the review state was honoured. */
interface PlanOutcomeV1 {
  action: PlanActionV1;
  replacement?: ReplacementV1;
  /** A proposal nobody reviewed was applied as it stands. */
  appliedUnreviewed: boolean;
  /** An unreviewed proposal to remove or replace was held back and compiled as keep. */
  heldBack: boolean;
}

/**
 * The effective action is `decision ?? proposal`, with one gate: a proposal that
 * would remove or replace content and that nobody reviewed is applied only when
 * the caller asked for it. A decision is a person's or an agent's own answer, so
 * it is never held back and never counted as unreviewed.
 *
 * The gate reads the review state exactly. `accepted` travels, `unreviewed` is
 * what `applyUnreviewed` releases, and `needs-attention` is what
 * `applyNeedsAttention` releases: a rule that asked a person to look at
 * something is not answered by a caller who asked for the unreviewed ones, so
 * the preview that shows every proposal asks for both. Either way the report
 * records the proposal as applied without a review.
 */
function outcomeOf(entry: ObjectPlanV1, applyUnreviewed: boolean, applyNeedsAttention: boolean): PlanOutcomeV1 {
  const decided = entry.decision !== undefined;
  const action = entry.decision ?? entry.proposal;
  const replacement = decided
    ? (entry.decisionReplacement ?? entry.proposalReplacement)
    : entry.proposalReplacement;
  if (decided || entry.review === 'accepted' || action === 'keep') {
    return { action, replacement, appliedUnreviewed: false, heldBack: false };
  }
  if ((applyUnreviewed && entry.review === 'unreviewed') || (applyNeedsAttention && entry.review === 'needs-attention')) {
    return { action, replacement, appliedUnreviewed: true, heldBack: false };
  }
  return { action: 'keep', appliedUnreviewed: false, heldBack: true };
}

/** What one object contributes to a frame. `shape` is a plain box, `none` is a removal. */
type ContentKindV1 = 'text' | 'image' | 'shape' | 'placeholder' | 'brand-logo' | 'none';

/** One source object, resolved into what it becomes and what the report will say about it. */
interface PlacementV1 {
  object: SourceObjectV1;
  entry: ObjectPlanV1;
  outcome: PlanOutcomeV1;
  content: ContentKindV1;
  role?: ArchetypeRoleV1;
  /** The words, with no markup: what every measure, comparison and fingerprint reads. */
  text?: string;
  /**
   * The same words in Design's text subset (plan 275 section 7.2): bold, italic,
   * underline, strike, list markers and levels. This is what a row's `text` holds;
   * nothing measures it, so no estimate counts a marker as a glyph.
   */
  rich?: string;
  /** Source formatting Design's text has no token for, in plain words. */
  dropped?: string[];
  /** The text a person corrected (`ObjectPlanV1.textOverride`) stands in for what was read. */
  corrected?: boolean;
  /**
   * A row marker the census took for decoration, kept for the layout's number box
   * (see `keepRowMarkers`). It pours with its row rather than going to the notes.
   */
  marker?: boolean;
  image?: string;
  label?: string;
  surplus: 'continuation' | 'tray';
  disposition: DispositionV1;
  code: ReportCodeV1;
  message: string;
  reason?: string;
  fidelity?: FidelityStateV1;
  /** Table facts when a table was lowered to lines, so the cap can be reported. */
  cap?: { sourceRows: number; sourceCols: number; dropped: number; rows: number; cols: number };
}

/**
 * A placement with the two facts the slot competition ranks on: where the object
 * sits in reading order, and whether the plan lists it at all. An object nobody
 * planned is still compiled, and it is still accounted for, but it never takes a
 * slot from the object a person assigned to that role.
 */
type RankedPlacementV1 = PlacementV1 & {
  reading: number;
  listed: boolean;
  /** The order a pour chose inside one slot (plan 275, F9); reading order when absent. */
  pour?: number;
};

/** A table lowered to text lines, capped the same way the faithful mode caps its cells. */
function tableLines(table: string[][]): { text: string; cap: PlacementV1['cap'] } {
  const sourceRows = table.length;
  const sourceCols = table.reduce((n, row) => Math.max(n, row.length), 0);
  const rows = table.slice(0, MAX_TABLE_ROWS);
  const cols = Math.min(MAX_TABLE_COLS, rows.reduce((n, row) => Math.max(n, row.length), 0));
  const sourceCells = table.reduce((n, row) => n + row.length, 0);
  const carried = rows.reduce((n, row) => n + Math.min(row.length, cols), 0);
  return {
    text: rows.map((row) => row.slice(0, cols).map((cell) => cell ?? '').join('\t')).join('\n'),
    cap: { sourceRows, sourceCols, dropped: sourceCells - carried, rows: rows.length, cols },
  };
}

/**
 * Is this text one big number? A short line that is mostly digits is what the
 * `big-number` archetype's `number` role holds, and nothing longer qualifies, so
 * a sentence with a year in it stays body text.
 */
function isBigNumber(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > 8 || trimmed.includes('\n')) return false;
  let digits = 0;
  for (const ch of trimmed) if (ch >= '0' && ch <= '9') digits += 1;
  return digits > 0 && digits * 2 >= trimmed.length;
}

/** Text a picture-like object's placeholder would carry, and the role it would have claimed. */
function roleForObject(object: SourceObjectV1, cls: ObjectClassV1, content: ContentKindV1): ArchetypeRoleV1 | undefined {
  if (content === 'image') return 'visual';
  if (content === 'placeholder') {
    if (object.kind === 'chart' || object.kind === 'table') return 'data';
    if (object.kind === 'pic' || object.kind === 'vector') return 'visual';
    if (object.kind === 'text') return 'body';
    return undefined;
  }
  if (content !== 'text') return undefined;
  if (object.placeholder === 'title' || object.placeholder === 'ctrTitle' || cls === 'title') return 'title';
  if (object.placeholder === 'subTitle' || cls === 'subtitle') return 'subtitle';
  if (object.kind === 'table' || cls === 'table') return 'data';
  if (isBigNumber(plainText(object))) return 'number';
  // Furniture-like text has no content role: the master brings its own page
  // number, footer and marks, so a kept one is surplus rather than a body line.
  if (
    cls === 'page-number' || cls === 'footer' || cls === 'date'
    || cls === 'recurring-text' || cls === 'decoration' || cls === 'template-furniture'
  ) {
    return undefined;
  }
  return 'body';
}

/**
 * Resolve one source object against its plan entry: what it becomes, which role it
 * wants, and the one report entry that will account for it.
 */
function describePlacement(
  object: SourceObjectV1,
  entry: ObjectPlanV1,
  outcome: PlanOutcomeV1,
  slideNumber: number,
): PlacementV1 {
  const where = `on slide ${slideNumber}`;
  // Content that fits no slot on its own slide goes on to a continuation slide
  // unless the plan asked for the tray; the tray is where content goes only when
  // no archetype of the master can hold it.
  const surplus = entry.surplus ?? 'continuation';
  const base = { object, entry, outcome, surplus } as const;

  if (outcome.action === 'remove') {
    return {
      ...base,
      content: 'none',
      disposition: 'removed',
      code: 'object.removed',
      message: `The ${nounFor(entry.class, object.kind)} ${where} was left out, as the plan asked.`,
    };
  }

  if (outcome.action === 'replace' && outcome.replacement) {
    const replacement = outcome.replacement;
    if (replacement.kind === 'brand-logo') {
      return {
        ...base,
        content: 'brand-logo',
        disposition: 'transformed',
        code: 'object.replaced-logo',
        message: `The mark ${where} was replaced by the design system's own, which the master's furniture carries.`,
      };
    }
    if (replacement.kind === 'placeholder') {
      return {
        ...base,
        content: 'placeholder',
        label: replacement.label,
        role: entry.role ?? roleForObject(object, entry.class, 'placeholder'),
        disposition: 'transformed',
        code: 'object.transformed',
        message: `The ${nounFor(entry.class, object.kind)} ${where} was replaced by a labelled stand-in, as the plan asked.`,
      };
    }
    if (replacement.kind === 'asset' || replacement.kind === 'supplied-picture' || replacement.kind === 'tool') {
      const image = replacement.kind === 'asset'
        ? replacement.id
        : replacement.kind === 'supplied-picture' ? replacement.assetRef : replacement.url;
      return {
        ...base,
        content: 'image',
        image,
        role: entry.role ?? 'visual',
        disposition: 'transformed',
        code: 'object.transformed',
        message: `The ${nounFor(entry.class, object.kind)} ${where} was replaced by a picture the plan named.`,
      };
    }
    // A filter is an operation on bytes, which this compile does not run. The
    // object travels as it stands and the report says the filter was not applied.
    return {
      ...describeKeep(object, entry, outcome, where, surplus),
      reason: 'filter-not-applied',
      message: `The ${nounFor(entry.class, object.kind)} ${where} was carried over unchanged: the plan asks for the ${replacement.toolId} filter, which this compile does not run.`,
    };
  }

  if (outcome.action === 'replace') {
    return {
      ...describeKeep(object, entry, outcome, where, surplus),
      reason: 'replacement-missing',
      message: `The ${nounFor(entry.class, object.kind)} ${where} was carried over unchanged: the plan asks to replace it but names nothing to put there.`,
    };
  }

  const kept = describeKeep(object, entry, outcome, where, surplus);
  if (outcome.heldBack && kept.disposition === 'retained') {
    const flagged = entry.review === 'needs-attention';
    return {
      ...kept,
      reason: flagged ? 'needs-attention-held' : 'unreviewed-proposal-held',
      message: flagged
        ? `The ${nounFor(entry.class, object.kind)} ${where} was carried over: the plan proposes to ${entry.decision ?? entry.proposal} it and flagged it for a person to look at, which nobody has answered.`
        : `The ${nounFor(entry.class, object.kind)} ${where} was carried over: the plan proposes to ${entry.decision ?? entry.proposal} it, and nobody has reviewed that.`,
    };
  }
  return kept;
}

/** The keep path, shared by an explicit keep and by the two replacements that fall back to it. */
function describeKeep(
  object: SourceObjectV1,
  entry: ObjectPlanV1,
  outcome: PlanOutcomeV1,
  where: string,
  surplus: 'continuation' | 'tray',
): PlacementV1 {
  const base = { object, entry, outcome, surplus } as const;

  if (object.fidelity.state === 'unavailable' || !hasDrawableBytes(object)) {
    const drawable = hasDrawableBytes(object);
    return {
      ...base,
      content: 'placeholder',
      label: `${kindLabel(object.kind)} could not be read`,
      role: entry.role ?? roleForObject(object, entry.class, 'placeholder'),
      disposition: 'unresolved',
      code: 'object.unresolved',
      message: `${kindLabel(object.kind)} ${where} could not be read, so a labelled stand-in takes its place.`,
      fidelity: drawable ? object.fidelity.state : 'unavailable',
      reason: drawable ? object.fidelity.reason : (object.fidelity.reason ?? 'media-missing'),
    };
  }

  if (object.kind === 'table' && object.table) {
    const { text, cap } = tableLines(object.table);
    return {
      ...base,
      content: 'text',
      text,
      rich: designTextFromPlain(text),
      cap,
      role: entry.role ?? 'data',
      disposition: 'transformed',
      code: 'object.transformed',
      message: `The table ${where} was carried over as lines of text, one per row.`,
      fidelity: cap && cap.dropped > 0 ? 'approximate' : object.fidelity.state,
      ...(cap && cap.dropped > 0 ? { reason: 'cap-reached' } : {}),
    };
  }

  const imageRef = object.kind === 'pic' ? object.media : (object.media ?? object.fidelity.fallbackAssetRef);
  if (imageRef) {
    return {
      ...base,
      content: 'image',
      image: imageRef,
      role: entry.role ?? 'visual',
      disposition: 'retained',
      code: 'object.retained',
      message: `The ${nounFor(entry.class, object.kind)} ${where} was carried over.`,
      fidelity: object.fidelity.state,
    };
  }

  if (object.kind === 'text') {
    // A corrected text (plan 275 decision 29) stands in for the source runs; the
    // source keeps what was read, so undo brings the reading back.
    const override = typeof entry.textOverride === 'string' ? entry.textOverride.replace(/\r\n?/g, '\n') : undefined;
    const text = override ?? plainText(object);
    return {
      ...base,
      content: 'text',
      text,
      ...(override !== undefined
        ? { rich: designTextFromPlain(override, object.text?.paras ?? []), corrected: true }
        : {}),
      role: entry.role ?? roleForObject({ ...object, text: override !== undefined ? { paras: [{ runs: [{ text }] }] } : object.text }, entry.class, 'text'),
      disposition: 'retained',
      code: 'object.retained',
      message: `The text ${where} was carried over.`,
      fidelity: object.fidelity.state,
    };
  }

  return {
    ...base,
    content: 'shape',
    disposition: 'retained',
    code: 'object.retained',
    message: `The ${nounFor(entry.class, object.kind)} ${where} was carried over.`,
    fidelity: object.fidelity.state,
  };
}

/** One role slot the master seeded, and what content has taken or joined it. */
interface SlotV1 {
  role: ArchetypeRoleV1;
  index: number;
  /**
   * What the slot holds now. A master states a kind per placeholder, and every slot
   * takes text, a picture, a chart or a table (plan 275 decision 30): a picture in a
   * text box turns the box into an image layer, and text in a picture box the other way.
   */
  kind: 'text' | 'image';
  /** The repeat cell the slot belongs to (a label and its body share one), when grouped. */
  group?: string;
  /** The cell's place in the repeat, 0-based, in reading order. */
  cell?: number;
  /** An image, a placeholder or a table took the whole slot, so nothing joins it. */
  taken: boolean;
  /** Text poured into the slot, one paragraph each, written in reading order. */
  members: RankedPlacementV1[];
  /** Notes (a citation, a unit line, a kept footer) written after the members. */
  notes: RankedPlacementV1[];
  /** The picture that took this image slot, when a picture did. */
  picture?: RankedPlacementV1;
}

/** One frame under construction: the seeded rows plus what the compile is filling in. */
interface FrameBuildV1 {
  frameId: string;
  archetype: ArchetypeRefV1;
  /** The archetype's cells in reading order, when its placeholders are grouped (plan 275). */
  cells: Array<{ group: string; index: number; slots: SlotV1[] }>;
  sourceSlideId: string;
  name: string;
  rows: DesignBoxRowV1[];
  extras: DesignBoxRowV1[];
  slots: SlotV1[];
  furnitureLayerIds: string[];
  placeholderLayerIds: string[];
  logoLayerId?: string;
  /** Row index of the master's footer and page-number furniture, when the archetype shows them. */
  footerIndex?: number;
  pageNumberIndex?: number;
  continuation: boolean;
}

/** Seed one frame from the master, or fall back to the plainest content archetype. */
function seedBuild(
  master: SlideMasterV1,
  archetypeId: ArchetypeRefV1,
  args: {
    frameId: string; x: number; y: number; name: string; order: number;
    ds: RenovateDesignSystemV1; sourceSlideId: string; continuation: boolean;
  },
): FrameBuildV1 {
  const seedOpts = {
    frameId: args.frameId,
    x: args.x,
    y: args.y,
    name: args.name,
    order: args.order,
    resolveToken: args.ds.tokens,
    ...(args.ds.logos ? { logos: args.ds.logos } : {}),
    ...(typeof args.ds.monoLogo === 'boolean' ? { monoLogo: args.ds.monoLogo } : {}),
  };
  const seeded = seedFrame(master, archetypeId, seedOpts)
    ?? (archetypeId === FALLBACK_ARCHETYPE ? null : seedFrame(master, FALLBACK_ARCHETYPE, seedOpts));
  if (!seeded) {
    throw new Error(`The master ${master.id} carries neither the ${archetypeId} archetype nor ${FALLBACK_ARCHETYPE}, so there is nothing to seed a frame from.`);
  }
  const used: ArchetypeRefV1 = rowStr(seeded.frame, 'archetype');
  const cellOf = new Map<string, { group: string; index: number }>();
  for (const cell of seeded.cells ?? []) for (const id of cell.layerIds) cellOf.set(id, { group: cell.group, index: cell.index });
  const kinds = new Map(master.furniture.map((f) => [f.id, f.kind]));
  const build: FrameBuildV1 = {
    frameId: args.frameId,
    archetype: used,
    cells: [],
    sourceSlideId: args.sourceSlideId,
    name: args.name,
    rows: [seeded.frame, ...seeded.layers],
    extras: [],
    slots: [],
    furnitureLayerIds: [],
    placeholderLayerIds: [],
    continuation: args.continuation,
  };
  seeded.layers.forEach((row, i) => {
    const index = i + 1;
    const furniture = rowStr(row, 'furniture');
    if (furniture) {
      build.furnitureLayerIds.push(rowStr(row, 'id'));
      const kind = kinds.get(furniture);
      if (!build.logoLayerId && kind === 'logo') build.logoLayerId = rowStr(row, 'id');
      if (build.footerIndex === undefined && kind === 'footer') build.footerIndex = index;
      if (build.pageNumberIndex === undefined && kind === 'page-number') build.pageNumberIndex = index;
      return;
    }
    const role = rowStr(row, 'role');
    if (!role) return;
    const cell = cellOf.get(rowStr(row, 'id'));
    build.slots.push({
      role: role as ArchetypeRoleV1,
      index,
      kind: rowStr(row, 'kind') === 'image' ? 'image' : 'text',
      ...(cell ? { group: cell.group, cell: cell.index } : {}),
      taken: false,
      members: [],
      notes: [],
    });
  });
  for (const cell of seeded.cells ?? []) {
    const slots = cell.layerIds
      .map((id) => build.slots.find((slot) => rowStr(build.rows[slot.index] ?? {}, 'id') === id))
      .filter((slot): slot is SlotV1 => slot !== undefined);
    if (slots.length > 0) build.cells.push({ group: cell.group, index: cell.index, slots });
  }
  return build;
}

/** The fields a seeded slot keeps when its row is rewritten as a placeholder. */
function slotGeometry(row: DesignBoxRowV1, id: string, name: string): DesignBoxRowV1 {
  const out: DesignBoxRowV1 = { id, x: rowNum(row, 'x'), y: rowNum(row, 'y'), w: rowNum(row, 'w'), h: rowNum(row, 'h'), name };
  const frame = rowStr(row, 'frame');
  if (frame) out.frame = frame;
  const master = rowStr(row, 'master');
  if (master) out.master = master;
  const role = rowStr(row, 'role');
  if (role) out.role = role;
  return out;
}

/**
 * Estimated height of a text run in its slot, in px.
 *
 * It is an average glyph advance and a fixed line box, not shaping: an engine
 * module has no font file and no shaper, so the number it reaches is an estimate
 * and every report entry it raises says so.
 */
function estimateTextHeight(text: string, fontSize: number, width: number): number {
  if (!(fontSize > 0) || !(width > 0)) return 0;
  const perLine = Math.max(1, Math.floor(width / (fontSize * AVERAGE_GLYPH_EM)));
  let lines = 0;
  for (const line of text.split('\n')) lines += Math.max(1, Math.ceil(line.length / perLine));
  return round2(lines * fontSize * ESTIMATE_LINE_HEIGHT);
}

/**
 * Which row field a colour use writes to, or null when this row may not take it.
 *
 * On a text row an accent and a series colour are ink, not ground: a source that
 * drew a figure in the accent drew the glyphs, and painting it behind the words
 * instead would change the slide rather than rebrand it. A plain box has no ink,
 * so everything but a stroke is written to its fill.
 */
function colourField(row: DesignBoxRowV1, role: ColorMappingV1['role']): 'bg' | 'fg' | 'stroke' | null {
  const kind = rowStr(row, 'kind');
  // A kept picture keeps its own colours. Recolouring pixels is a separate, lossy
  // operation this compile does not do, so an image layer is never a target.
  if (kind === 'image' || kind === 'frame') return null;
  if (role === 'stroke') return 'stroke';
  if (kind === 'text') return role === 'bg' || role === 'neutral' ? 'bg' : 'fg';
  if (role === 'ink') return null;
  return 'bg';
}

// ─── notes, needs and the continuation archetype ─────────────────────────────

/** A text note is at most this many words: a citation, a source line, a unit line. */
export const NOTE_MAX_WORDS = 20;
/** Body text whose largest run is under this size reads as a note rather than as body copy. */
export const NOTE_MAX_PT = 10;
/** The master's footer furniture carries kept lines of at most this many characters in all. */
export const FOOTER_MAX_CHARS = 80;
/** Between two kept lines that share the master's footer. */
const FOOTER_JOIN = '  ·  ';

/**
 * The glyph width, in em, a line must fit the master's footer at. The footer is one
 * line, where a wrap is a clip, so it reads glyphs wider than the body estimate's
 * average (`AVERAGE_GLYPH_EM`): a design system face measured at 0.55 em wrapped a
 * 54 character footer that the average said would fit.
 */
export const FOOTER_GLYPH_EM = 0.6;

/**
 * Whether a line fits the master's footer: within the character bound, and on one
 * line of the footer box at `FOOTER_GLYPH_EM`, so a footer the compile fills neither
 * wraps nor shows in the overflow report.
 */
function footerFits(footer: DesignBoxRowV1, text: string): boolean {
  if (text.length > FOOTER_MAX_CHARS) return false;
  const width = rowNum(footer, 'w');
  const size = rowNum(footer, 'fontSize');
  return !(width > 0 && size > 0) || text.length * size * FOOTER_GLYPH_EM <= width;
}

/** One line with its runs of white space folded, so two copies of a line compare equal. */
function foldSpace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Does the footer already carry this line, alone or as one of its joined parts? */
function footerHolds(held: string, text: string): boolean {
  if (!held) return false;
  const line = foldSpace(text);
  return held.split(FOOTER_JOIN).some((part) => foldSpace(part) === line);
}

/** A text of at most this many characters, and two paragraphs, can stand in as a missing title. */
export const TITLE_MAX_CHARS = 120;

/** Classes whose picture is content whatever its size: a photo, a screenshot, a diagram, a chart. */
const CONTENT_PICTURE_CLASSES: ReadonlySet<ObjectClassV1> = new Set<ObjectClassV1>(['photo', 'screenshot', 'diagram', 'chart']);

/**
 * A picture nobody classed as content that covers under this share of its slide
 * is incidental: an icon, a small mark, a bullet glyph drawn as a picture. At
 * 1280 by 720 that is a box of about 290 by 160 px. A larger one is kept as content.
 */
export const INCIDENTAL_PICTURE_SHARE = 0.05;

/**
 * Is this picture incidental: an icon, a small mark, a picture nobody classed,
 * whose box covers under `INCIDENTAL_PICTURE_SHARE` of its slide? One does not ask
 * an archetype for a picture slot, and one that fits no slot on its own slide
 * waits in the tray with the other small pictures of that slide rather than
 * taking a continuation slide of its own. A class that says the picture is
 * content keeps it content whatever its size. The first pass reads the same function,
 * so the archetype it picks and the continuations the compile adds agree.
 */
export function isIncidentalPicture(klass: ObjectClassV1, object: SourceObjectV1, slide: { width: number; height: number }): boolean {
  if (CONTENT_PICTURE_CLASSES.has(klass)) return false;
  const area = slide.width * slide.height;
  if (!(area > 0)) return false;
  return (Math.max(0, object.box.w) * Math.max(0, object.box.h)) / area < INCIDENTAL_PICTURE_SHARE;
}

/** Classes of a mark: kept, it takes a free picture slot on its own frame or waits in the tray. */
const MARK_CLASSES: ReadonlySet<ObjectClassV1> = new Set<ObjectClassV1>(['logo-candidate', 'known-logo']);

/** Classes whose kept text is a note: a line that belongs under the content, not in it. */
const NOTE_CLASSES: ReadonlySet<ObjectClassV1> = new Set<ObjectClassV1>([
  'footer', 'recurring-text', 'template-furniture', 'date', 'page-number', 'decoration',
]);

/**
 * Is this kept text the source's own slide number: classed so, or a line of a few
 * digits alone that the census read as a repeating footer or line (a plan made before
 * the census read it as a page number). The layout's page-number slot takes it and
 * the master writes its own number there, so the old number is never drawn beside
 * the new one (close-out F2).
 */
function isSourcePageNumber(placement: RankedPlacementV1): boolean {
  if (placement.entry.class === 'page-number') return true;
  if (!FOOTER_CLASSES.has(placement.entry.class) && placement.entry.class !== 'recurring-text') return false;
  return /^\d{1,4}$/.test((placement.text ?? '').trim());
}

/** Classes a kept line may take the master's footer furniture for: lines that repeat on the slides. */
const FOOTER_CLASSES: ReadonlySet<ObjectClassV1> = new Set<ObjectClassV1>([
  'footer', 'recurring-text', 'template-furniture', 'date',
]);

/**
 * The renovated frame's name: the text the plan classed as the slide's title, else
 * `slideName` over the slide's own text. A line the master or layout drew, or one the
 * census found repeating (a copyright line, a footer), names every slide the same
 * and so names none of them.
 */
function renovatedSlideName(slide: SlideSourceV1, entries: ReadonlyMap<string, ObjectPlanV1>): string {
  const own = slide.objects.filter((object) => {
    if (object.kind !== 'text' || plainText(object).trim().length === 0) return false;
    if (object.origin === 'master' || object.origin === 'layout') return false;
    const cls = entries.get(object.id)?.class;
    return !(cls && NOTE_CLASSES.has(cls));
  });
  const titled = own.find((object) => entries.get(object.id)?.class === 'title');
  return slideName({ ...slide, objects: titled ? [titled] : own });
}

const NOTE_LEAD = /^(?:sources?|notes?|figures|data|citation)\b/i;
const URL_ONLY = /^(?:https?:\/\/|www\.)\S+$/i;

function largestRunPt(object: SourceObjectV1): number {
  let max = 0;
  for (const para of object.text?.paras ?? []) for (const run of para.runs) max = Math.max(max, run.sizePt ?? 0);
  return max;
}

/**
 * Is this kept text a note: a citation, a source line, a unit line or a kept
 * footer? A note goes to the master's footer, a caption or label slot, or the
 * last paragraph of the body, never into a slot of its own, and it never chooses
 * the slide's layout. A role a person or an agent stated keeps the object out of
 * this rule. The first pass reads the same function, so the archetype it picks
 * and the slots the compile fills agree about which text is a note.
 */
export function isNoteText(
  klass: ObjectClassV1,
  object: SourceObjectV1,
  entry?: Pick<ObjectPlanV1, 'role' | 'author'>,
): boolean {
  if (object.kind === 'table' || object.table !== undefined) return false;
  if (NOTE_CLASSES.has(klass)) return true;
  if (entry?.role && (entry.author === 'user' || entry.author === 'agent')) return false;
  if (klass !== 'body' && klass !== 'unknown') return false;
  const text = plainText(object).trim();
  if (text.length === 0 || text.split('\n').length > 2) return false;
  if (text.split(/\s+/).length > NOTE_MAX_WORDS) return false;
  if (URL_ONLY.test(text) || NOTE_LEAD.test(text)) return true;
  const pt = largestRunPt(object);
  return pt > 0 && pt < NOTE_MAX_PT;
}

function isNote(p: PlacementV1): boolean {
  return p.content === 'text' && !p.marker && isNoteText(p.entry.class, p.object, p.entry);
}

/** The kind of slot a placement needs: a picture slot, a table slot, or the body. */
type NeedV1 = 'image' | 'data' | 'body';

function needOf(p: PlacementV1): NeedV1 {
  if (p.content === 'image') return 'image';
  if (p.content === 'placeholder') {
    if (p.role === 'visual') return 'image';
    if (p.role === 'data') return p.object.kind === 'table' ? 'data' : 'image';
    return 'body';
  }
  if (p.role === 'data' && (p.object.kind === 'table' || p.object.table !== undefined)) return 'data';
  return 'body';
}

/**
 * Archetypes a continuation of each need is seeded from, plainest first, then the
 * slide's own. A continuation holds what did not fit, so it takes the archetype
 * whose one job is that content: a body continuation seeded from a split layout
 * would carry an empty picture slot.
 */
const CONTINUATION_ARCHETYPES: Readonly<Record<NeedV1, readonly ArchetypeIdV1[]>> = {
  image: ['visual', 'split', 'full-image'],
  data: ['table'],
  body: ['content', 'agenda', 'two-column', 'split'],
};

/** Does this archetype carry a slot for the need? */
function archetypeHolds(master: SlideMasterV1, id: ArchetypeRefV1, need: NeedV1): boolean {
  const archetype = master.archetypes.find((one) => one.id === id);
  if (!archetype) return false;
  if (need === 'image') return archetype.placeholders.some((ph) => ph.kind === 'image');
  if (need === 'data') return archetype.placeholders.some((ph) => ph.role === 'data' && ph.kind === 'table');
  return archetype.placeholders.some((ph) => ph.role === 'body' && ph.kind === 'text');
}

/**
 * The archetype a continuation for this need is seeded from: the first of the
 * list above the master carries, else the slide's own when it holds the need. A
 * table with no table archetype anywhere is carried as body text. Undefined when
 * no archetype of the master has the role at all, which is the one case the tray
 * is for.
 */
function continuationArchetype(master: SlideMasterV1, own: ArchetypeRefV1, need: NeedV1): { id: ArchetypeRefV1; need: NeedV1 } | undefined {
  for (const id of [...CONTINUATION_ARCHETYPES[need], own]) if (archetypeHolds(master, id, need)) return { id, need };
  if (need === 'data') return continuationArchetype(master, own, 'body');
  return undefined;
}

// ─── colour on the frame ─────────────────────────────────────────────────────

/** The alpha-composite of an `#rrggbbaa` fill over an opaque `#rrggbb` ground, as `#rrggbb`. */
function composite(top: string, under: string): string {
  const t = top.trim().replace(/^#/, '').toLowerCase();
  const u = under.trim().replace(/^#/, '').toLowerCase().slice(0, 6);
  if (!/^[0-9a-f]{6}$/.test(u)) return `#${t.slice(0, 6)}`;
  if (t.length !== 8) return `#${t.slice(0, 6)}`;
  const alpha = Number.parseInt(t.slice(6, 8), 16) / 255;
  const channel = (at: number): string => {
    const value = Math.round(Number.parseInt(t.slice(at, at + 2), 16) * alpha + Number.parseInt(u.slice(at, at + 2), 16) * (1 - alpha));
    return value.toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(2)}${channel(4)}`;
}

/** A strip of ground under a text row narrower than this share of the row is a rounding sliver, not a ground. */
const GROUND_SLIVER_SHARE = 0.02;

/**
 * Every colour under one row of a frame, in code unit order of the hex, so a
 * row across two grounds (a footer running over a split panel's
 * edge) names both. The row's box is cut at the edge of every box painted before
 * it that overlaps it at all, and each piece is composited in paint order from
 * the frame's own ground: a plain box paints its fill over what is under it, a
 * picture makes the piece unknown until a later box covers it again. A piece
 * under `GROUND_SLIVER_SHARE` of the row does not count. Undefined when a
 * picture lies under a piece that counts, because the pixels under the words
 * are not known here, or when the frame states no ground.
 */
function groundsUnder(rows: readonly DesignBoxRowV1[], index: number): string[] | undefined {
  const frame = rows[0];
  const own = rows[index];
  if (!frame || !own) return undefined;
  const base = rowStr(frame, 'bg');
  if (!/^#[0-9a-fA-F]{6}/.test(base)) return undefined;
  const ground = base.slice(0, 7).toLowerCase();
  const x0 = rowNum(own, 'x'), y0 = rowNum(own, 'y');
  const x1 = x0 + rowNum(own, 'w'), y1 = y0 + rowNum(own, 'h');
  if (!(x1 > x0) || !(y1 > y0)) return [ground];

  interface Paint { x0: number; y0: number; x1: number; y1: number; fill?: string }
  const painted: Paint[] = [];
  for (let i = 1; i < index; i += 1) {
    const row = rows[i];
    if (!row) continue;
    const bx0 = Math.max(x0, rowNum(row, 'x')), by0 = Math.max(y0, rowNum(row, 'y'));
    const bx1 = Math.min(x1, rowNum(row, 'x') + rowNum(row, 'w')), by1 = Math.min(y1, rowNum(row, 'y') + rowNum(row, 'h'));
    if (bx1 <= bx0 || by1 <= by0) continue;
    const kind = rowStr(row, 'kind');
    const fill = rowStr(row, 'bg');
    if (kind === 'image' && rowStr(row, 'image')) painted.push({ x0: bx0, y0: by0, x1: bx1, y1: by1 });
    else if (kind === 'box' && /^#[0-9a-fA-F]{6}/.test(fill)) painted.push({ x0: bx0, y0: by0, x1: bx1, y1: by1, fill });
  }
  if (painted.length === 0) return [ground];

  const cuts = (lo: number, hi: number, edges: number[]): number[] =>
    [...new Set([lo, hi, ...edges.filter((e) => e > lo && e < hi)])].sort((a, b) => a - b);
  const xs = cuts(x0, x1, painted.flatMap((p) => [p.x0, p.x1]));
  const ys = cuts(y0, y1, painted.flatMap((p) => [p.y0, p.y1]));
  const total = (x1 - x0) * (y1 - y0);
  const shares = new Map<string, number>();
  const UNKNOWN = '';
  for (let i = 0; i + 1 < xs.length; i += 1) {
    for (let j = 0; j + 1 < ys.length; j += 1) {
      const ax = xs[i] as number, bx = xs[i + 1] as number, ay = ys[j] as number, by = ys[j + 1] as number;
      const cx = (ax + bx) / 2, cy = (ay + by) / 2;
      let here: string = ground;
      for (const p of painted) {
        if (cx < p.x0 || cx > p.x1 || cy < p.y0 || cy > p.y1) continue;
        if (p.fill === undefined) here = UNKNOWN;
        else if (here !== UNKNOWN) here = composite(p.fill, here);
        else if (p.fill.replace(/^#/, '').length === 6 || /ff$/i.test(p.fill)) here = composite(p.fill, '#000000');
      }
      shares.set(here, (shares.get(here) ?? 0) + ((bx - ax) * (by - ay)) / total);
    }
  }
  const counted = [...shares].filter(([, share]) => share >= GROUND_SLIVER_SHARE).map(([hex]) => hex);
  if (counted.includes(UNKNOWN)) return undefined;
  return counted.length > 0 ? counted.sort(compareCodeUnits) : [ground];
}

/** The lowest contrast one ink reaches against every ground it sits on. */
function worstContrast(ink: string, grounds: readonly string[]): number {
  let worst = Number.POSITIVE_INFINITY;
  for (const ground of grounds) worst = Math.min(worst, contrastRatio(ink.slice(0, 7), ground));
  return worst;
}

/** WCAG large text: 24 px, or 18.66 px (14 pt) at a bold weight. */
function isLargeText(row: DesignBoxRowV1): boolean {
  const size = rowNum(row, 'fontSize');
  const weight = rowNum(row, 'weight');
  return size >= 24 || (weight >= 700 && size >= 18.66);
}

/** The contrast floor for one text row: 3 for large text, 4.5 otherwise. */
function contrastFloor(row: DesignBoxRowV1): number {
  return isLargeText(row) ? 3 : 4.5;
}

/** The body ink of an archetype, else its title ink, else the design system's text colour. */
function archetypeInk(master: SlideMasterV1, id: ArchetypeRefV1, tokens: TokenResolver): string | undefined {
  const archetype = master.archetypes.find((one) => one.id === id);
  const styled = [
    ...(archetype?.placeholders.filter((ph) => ph.role === 'body') ?? []),
    ...(archetype?.placeholders.filter((ph) => ph.role === 'title') ?? []),
  ];
  for (const ph of styled) {
    const hex = ph.style?.fg ?? (ph.style?.fgTokenPath ? tokens(ph.style.fgTokenPath) : undefined);
    if (hex) return hex;
  }
  return tokens('color.semantic.text');
}

/** The report sentence for one object sent to the tray, by the reason it went there. */
function trayMessage(reason: string, noun: string, slideNumber: number, deckLimit: number): string {
  const where = `The ${noun} on slide ${slideNumber} waits in the unplaced-content tray`;
  switch (reason) {
    case 'continuation-limit':
      return `${where}: the slide already has ${MAX_CONTINUATION_FRAMES} continuation slides.`;
    case 'deck-continuation-limit':
      return `${where}: the renovated deck already has ${deckLimit} continuation slides, the most it adds.`;
    case 'small-pictures':
      return `${where} with the other small pictures of its slide: each covers under ${Math.round(INCIDENTAL_PICTURE_SHARE * 100)}% of the slide, and a slide of its own for one would read as content.`;
    case 'picture-grid-no-room':
      return `${where}: the picture slot of its layout is too small to show it beside the others.`;
    case 'picture-grid-full':
      return `${where}: its slide and its continuation slide already show ${MAX_GRID_PICTURES} pictures each, the most a picture grid holds.`;
    case 'mark-without-slot':
      return `The mark on slide ${slideNumber} is kept and its layout has no free picture slot, so it waits in the unplaced-content tray.`;
    case 'plan-asked':
      return `${where}, as the plan asked.`;
    default:
      return `${where}: no layout of the slide master has a place for it.`;
  }
}

/** Order two optional roles by name, an absent role last, so the slot competition is stable. */
function compareRole(a: ArchetypeRoleV1 | undefined, b: ArchetypeRoleV1 | undefined): number {
  const x = a ?? '~';
  const y = b ?? '~';
  return x < y ? -1 : x > y ? 1 : 0;
}

/** The words a report sentence names one colour mapping by: its role and its source colour, never its use id. */
function colourNoun(mapping: ColorMappingV1): string {
  const role: Record<ColorMappingV1['role'], string> = {
    ink: 'text colour',
    bg: 'background colour',
    accent: 'accent colour',
    series: 'chart series colour',
    stroke: 'line colour',
    neutral: 'neutral colour',
  };
  return `${role[mapping.role] ?? 'colour'} ${mapping.from.toLowerCase()}`;
}

/** Roles whose text may keep a mapped emphasis colour: a figure and a quotation, where colour is the point. */
const EMPHASIS_ROLES: ReadonlySet<string> = new Set(['number', 'quote']);

/** Is this colour chromatic enough to read as an accent rather than a grey? */
function isChromatic(hex: string): boolean {
  return (hexToOklch(hex)?.c ?? 0) >= ACCENT_CHROMA_FLOOR;
}

/**
 * The words a report sentence names one layer by: its master role, or the kind
 * of furniture it is, never its id.
 */
function layerNoun(row: DesignBoxRowV1, furnitureKinds: ReadonlyMap<string, string>): string {
  const furniture = rowStr(row, 'furniture');
  if (furniture) {
    const kind = furnitureKinds.get(furniture) ?? '';
    return kind === 'page-number' ? 'page number' : kind === 'footer' ? 'footer' : 'master text';
  }
  const role = rowStr(row, 'role');
  if (role === 'body') return 'body text';
  if (role === 'data') return 'table text';
  if (role) return role.replace(/-/g, ' ');
  return 'text';
}

/** The colour of `candidates` nearest `hex` in OKLab, the first on a tie; undefined when there is none. */
function nearestColour(hex: string, candidates: readonly string[]): string | undefined {
  const rgb = (value: string): [number, number, number] | undefined => {
    const parsed = parseHex(value);
    return parsed ? [parsed[0] / 255, parsed[1] / 255, parsed[2] / 255] : undefined;
  };
  const from = rgb(hex);
  if (!from) return undefined;
  let best: string | undefined;
  let bestD = Number.POSITIVE_INFINITY;
  for (const one of candidates) {
    const to = rgb(one);
    if (!to) continue;
    const d = deltaEOkSrgb(from, to);
    if (d < bestD) {
      bestD = d;
      best = one;
    }
  }
  return best;
}

/** A text colour every run of this object shares, when it is a chromatic one: emphasis, not base ink. */
function emphasisHex(object: SourceObjectV1): string | undefined {
  let shared: string | undefined;
  for (const para of object.text?.paras ?? []) {
    for (const run of para.runs) {
      if (run.text.trim().length === 0) continue;
      const hex = run.color?.hex?.toLowerCase();
      if (!hex) return undefined;
      if (shared === undefined) shared = hex;
      else if (shared !== hex) return undefined;
    }
  }
  if (!shared) return undefined;
  const chroma = hexToOklch(shared)?.c ?? 0;
  return chroma >= ACCENT_CHROMA_FLOOR ? shared : undefined;
}

// ─── every box takes every kind of content, and the pour (plan 275, decision 30, F9)

/** The text style fields a seeded text row carries, cleared when a picture takes the box. */
const TEXT_ROW_FIELDS = ['text', 'fontSize', 'weight', 'align', 'valign', 'font', 'fg', 'pad'] as const;

/** Turn a seeded box into a picture layer, fitted by the box's own fit, else `contain`. */
function rowAsImage(row: DesignBoxRowV1, image: string): void {
  const fit = rowStr(row, 'kind') === 'image' ? rowStr(row, 'fit') : '';
  for (const key of TEXT_ROW_FIELDS) delete row[key];
  row.kind = 'image';
  row.image = image;
  row.fit = fit === 'cover' || fit === 'fill' ? fit : 'contain';
}

/**
 * Turn a seeded picture box into a text layer, shaped to the box: the archetype's
 * body type (its first body placeholder, else the master's body size), set left and
 * from the top in the archetype's ink.
 */
function rowAsText(row: DesignBoxRowV1, master: SlideMasterV1, archetypeId: ArchetypeRefV1, tokens: TokenResolver): void {
  delete row.image;
  delete row.fit;
  delete row.alt;
  row.kind = 'text';
  row.text = '';
  const archetype = master.archetypes.find((one) => one.id === archetypeId);
  const body = archetype?.placeholders.find((ph) => ph.role === 'body' && ph.kind === 'text');
  row.fontSize = typeof body?.style?.fontSize === 'number' ? body.style.fontSize : master.typeScale.body;
  row.weight = body?.style?.weight ?? '400';
  row.align = body?.style?.align ?? 'left';
  row.valign = 'top';
  const ink = archetypeInk(master, archetypeId, tokens);
  if (ink) row.fg = ink;
}

/** One source unit the pour keeps together: a label and its body, a letter and its row. */
interface PourItemV1 {
  members: RankedPlacementV1[];
  box: { x0: number; y0: number; x1: number; y1: number };
  reading: number;
}

/** How the cells of a repeat sit: stacked rows, side-by-side columns, or a grid of both. */
type PourModeV1 = 'rows' | 'columns' | 'grid';

/** Overlap of two spans as a share of the shorter one. */
function spanOverlap(a0: number, a1: number, b0: number, b1: number): number {
  const overlap = Math.min(a1, b1) - Math.max(a0, b0);
  const shorter = Math.min(a1 - a0, b1 - b0);
  return shorter > 0 && overlap > 0 ? overlap / shorter : 0;
}

/** A card's first paragraph heads it when set at least this many times the size of the lines under it. */
export const HEADING_SIZE_RATIO = 1.25;

/** Is this a short line that heads what sits under or beside it: one line, a few words? */
function isLabelText(p: RankedPlacementV1): boolean {
  const text = (p.text ?? '').trim();
  return p.content === 'text' && text.length > 0 && text.length <= 60 && !text.includes('\n') && text.split(/\s+/).length <= 8;
}

/** Is this a marker a number box holds: a figure, or a letter or two like a MEDDPICC row's? */
function isMarkerText(p: RankedPlacementV1): boolean {
  const text = (p.text ?? '').trim();
  if (p.content !== 'text' || text.length === 0 || text.includes('\n')) return false;
  return isBigNumber(text) || /^[\p{L}\p{N}]{1,3}[.)]?$/u.test(text);
}

/** Classes the census gives a short glyph that is not content on its own: a row's letter drawn as a shape reads as one. */
const MARKER_RESCUE_CLASSES: ReadonlySet<ObjectClassV1> = new Set<ObjectClassV1>(['decoration', 'recurring-text', 'template-furniture']);

/**
 * Keep the row markers of a slide whose layout has a number box per row.
 *
 * MEDDPICC slide 3 draws each letter (M, E, D, D, P, I, C, C) as a separate text box,
 * and the census classes such a glyph as decoration, which the plan proposes to
 * remove and Accept all then removes. On a layout with number boxes those letters
 * are the rows' own numbering, so dropping them loses content and leaves the
 * number boxes empty. A marker is kept for its number box when it is one to three
 * letters or figures, its removal is the plan's proposal rather than a different
 * answer someone gave, it is not locked, and it shares a band with a line of kept
 * text (a row with rows mode, a column with columns mode). Two or more such
 * markers are needed: one lone letter is not a row of numbering. The placement
 * says why it was kept, so the report shows the choice.
 */
function keepRowMarkers(
  placements: RankedPlacementV1[],
  mode: PourModeV1,
  slideNumber: number,
): void {
  const markerText = (object: SourceObjectV1): boolean =>
    object.kind === 'text' && /^[\p{L}\p{N}]{1,3}[.)]?$/u.test(plainText(object).trim());
  const fromProposal = (entry: ObjectPlanV1): boolean =>
    !entry.locked && (entry.decision === undefined || (entry.decision === entry.proposal && entry.decisionReplacement === undefined));
  const candidates = placements.filter((p) => MARKER_RESCUE_CLASSES.has(p.entry.class) && markerText(p.object)
    && ((p.content === 'none' && p.outcome.action === 'remove' && fromProposal(p.entry)) || (p.content === 'text' && isNote(p))));
  if (candidates.length < 2) return;
  const lines = placements.filter((p) => p.content === 'text' && !candidates.includes(p) && !isNote(p) && !markerText(p.object));
  const band = (a: SourceObjectV1, b: SourceObjectV1): boolean => {
    const rows = spanOverlap(a.box.y, a.box.y + a.box.h, b.box.y, b.box.y + b.box.h) >= 0.5;
    const cols = spanOverlap(a.box.x, a.box.x + a.box.w, b.box.x, b.box.x + b.box.w) >= 0.5;
    return mode === 'rows' ? rows : mode === 'columns' ? cols : rows || cols;
  };
  const rowed = candidates.filter((p) => lines.some((line) => band(p.object, line.object)));
  if (rowed.length < 2) return;
  for (const p of rowed) {
    const at = placements.indexOf(p);
    const keep = describeKeep(p.object, p.entry, { action: 'keep', appliedUnreviewed: false, heldBack: false }, `on slide ${slideNumber}`, p.surplus);
    const glyph = plainText(p.object).trim();
    placements[at] = {
      ...keep,
      reading: p.reading,
      listed: p.listed,
      marker: true,
      role: 'number',
      reason: 'row-marker-kept',
      message: `The marker "${glyph}" on slide ${slideNumber} was kept in its row's number box: the plan proposed to ${p.outcome.action === 'remove' ? 'leave it out' : 'treat it as a note'}, and the layout numbers each row with it.`,
    };
  }
}

/**
 * Gather placements into the units a pour keeps together, in reading order. In rows
 * mode two placements on one band (a letter and its line) are one unit; in columns
 * mode two in one column (a heading and its text); in a grid a short heading joins
 * the text right under it. Anything else is a unit of its own.
 */
function pourItems(placements: readonly RankedPlacementV1[], mode: PourModeV1): PourItemV1[] {
  const boxOf = (p: RankedPlacementV1): PourItemV1['box'] => ({
    x0: p.object.box.x, y0: p.object.box.y, x1: p.object.box.x + Math.max(0, p.object.box.w), y1: p.object.box.y + Math.max(0, p.object.box.h),
  });
  const parent = placements.map((_, i) => i);
  const find = (i: number): number => {
    let at = i;
    while (parent[at] !== at) at = parent[at] as number;
    return at;
  };
  const join = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  };
  for (let i = 0; i < placements.length; i += 1) {
    for (let j = i + 1; j < placements.length; j += 1) {
      const a = placements[i] as RankedPlacementV1;
      const b = placements[j] as RankedPlacementV1;
      const ba = boxOf(a);
      const bb = boxOf(b);
      if (mode === 'rows') {
        if (spanOverlap(ba.y0, ba.y1, bb.y0, bb.y1) >= 0.5) join(i, j);
      } else if (mode === 'columns') {
        if (spanOverlap(ba.x0, ba.x1, bb.x0, bb.x1) >= 0.5) join(i, j);
      } else {
        const [upper, lower, top, bottom] = ba.y0 <= bb.y0 ? [a, b, ba, bb] : [b, a, bb, ba];
        const gap = bottom.y0 - top.y1;
        // A heading joins the longer text right under it; a stack of like short lines
        // (a list, a column of letters) is not a heading over each other.
        if (lower !== upper && isLabelText(upper) && !isMarkerText(upper) && !isMarkerText(lower)
          && (lower.text ?? '').trim().length > (upper.text ?? '').trim().length * 1.5
          && spanOverlap(ba.x0, ba.x1, bb.x0, bb.x1) >= 0.5
          && gap > -0.25 * (top.y1 - top.y0) && gap <= 1.5 * (top.y1 - top.y0)) join(i, j);
        // A marker beside its line on one band (a MEDDPICC letter, a step number) is
        // one unit with it, when the two sit close across.
        const marker = isMarkerText(a) ? ba : isMarkerText(b) ? bb : undefined;
        if (marker && spanOverlap(ba.y0, ba.y1, bb.y0, bb.y1) >= 0.5) {
          const across = Math.max(ba.x0, bb.x0) - Math.min(ba.x1, bb.x1);
          if (across <= 2 * Math.max(marker.x1 - marker.x0, marker.y1 - marker.y0)) join(i, j);
        }
      }
    }
  }
  const byRoot = new Map<number, RankedPlacementV1[]>();
  placements.forEach((p, i) => {
    const root = find(i);
    const list = byRoot.get(root) ?? [];
    list.push(p);
    byRoot.set(root, list);
  });
  const items: PourItemV1[] = [...byRoot.values()].map((members) => {
    const boxes = members.map(boxOf);
    return {
      members,
      box: {
        x0: Math.min(...boxes.map((b) => b.x0)), y0: Math.min(...boxes.map((b) => b.y0)),
        x1: Math.max(...boxes.map((b) => b.x1)), y1: Math.max(...boxes.map((b) => b.y1)),
      },
      reading: Math.min(...members.map((m) => m.reading)),
    };
  });
  // Inside a unit, the members read across a row and down a column.
  for (const item of items) {
    item.members.sort((a, b) => (mode === 'rows' ? a.object.box.x - b.object.box.x : a.object.box.y - b.object.box.y) || a.reading - b.reading);
  }
  const bandOf = (item: PourItemV1): number => item.box.y0;
  if (mode === 'rows') items.sort((a, b) => a.box.y0 - b.box.y0 || a.reading - b.reading);
  else if (mode === 'columns') items.sort((a, b) => a.box.x0 - b.box.x0 || a.reading - b.reading);
  else {
    // A grid reads band by band: two units whose tops sit within half the shorter
    // unit's height share a band, and a band reads left to right.
    items.sort((a, b) => bandOf(a) - bandOf(b) || a.reading - b.reading);
    const bands: PourItemV1[][] = [];
    for (const item of items) {
      const band = bands[bands.length - 1];
      const head = band?.[0];
      if (band && head && Math.abs(item.box.y0 - head.box.y0) <= 0.5 * Math.min(item.box.y1 - item.box.y0, head.box.y1 - head.box.y0)) band.push(item);
      else bands.push([item]);
    }
    items.length = 0;
    for (const band of bands) items.push(...band.sort((a, b) => a.box.x0 - b.box.x0 || a.reading - b.reading));
  }
  return items;
}

/**
 * Cut a run of `sizes` into `k` contiguous parts, reading order kept, so the largest
 * part is as small as it can be. Returns the count in each part.
 */
function balancedParts(sizes: readonly number[], k: number): number[] {
  const n = sizes.length;
  const parts = Math.max(1, Math.min(k, n));
  if (n === 0) return [];
  const prefix = [0];
  for (const size of sizes) prefix.push((prefix[prefix.length - 1] as number) + Math.max(0, size));
  // best[j][i]: the smallest largest part for the first i sizes in j parts.
  const best: number[][] = Array.from({ length: parts + 1 }, () => new Array<number>(n + 1).fill(Number.POSITIVE_INFINITY));
  const cut: number[][] = Array.from({ length: parts + 1 }, () => new Array<number>(n + 1).fill(0));
  (best[0] as number[])[0] = 0;
  for (let j = 1; j <= parts; j += 1) {
    for (let i = j; i <= n; i += 1) {
      for (let at = j - 1; at < i; at += 1) {
        const here = Math.max((best[j - 1] as number[])[at] as number, (prefix[i] as number) - (prefix[at] as number));
        // A strict improvement only, so the earliest cut keeps a tie: parts stay front-loaded.
        if (here < ((best[j] as number[])[i] as number) - 1e-9) {
          (best[j] as number[])[i] = here;
          (cut[j] as number[])[i] = at;
        }
      }
    }
  }
  const counts: number[] = [];
  let end = n;
  for (let j = parts; j >= 1; j -= 1) {
    const start = (cut[j] as number[])[end] as number;
    counts.unshift(end - start);
    end = start;
  }
  return counts;
}

// ─── the deck theme and each slide's ground (plan 275 section 6.2, decision 33) ─
//
// `compileRenovated` applies the plan's deck theme itself, at its top, so the stage
// worker, the CLI pipeline and the MCP tool, which all hand it the design system as
// resolved, draw the same bytes for one themed plan. The design system's token
// resolver follows the theme's remap (`systemForPlan`), and each slide is seeded on
// a master whose grounds are measured under the theme (`themeMaster`), so the logo
// variant and the inks follow the ground. Three rules on top of the remap:
//
//   | case                                  | drawn on                                   |
//   |---------------------------------------|--------------------------------------------|
//   | a dark layout under Dark or Brand     | its own ground if it stays dark, else the  |
//   | (a title slide), or on a Dark chip    | theme's darkest ground: it never turns light|
//   | a slide set to Light on a dark deck   | its own layout on the theme's lightest     |
//   |                                       | ground, never the inverted dark variant    |
//   | a slide set to Brand                  | the Brand ground (`slideGroundPlan`)       |
//
// A colour use whose target moves on a slide's own ground takes that ground's
// target (`byGround`), and a colour a person locked keeps the hex they locked
// whatever the theme remaps.

/** The ground group a slide's colour uses take their second target from. */
type MovedGroundV1 = 'dark' | 'brand';

/** A colour as `#rrggbb`, or undefined for a value that is not a six- or three-digit hex. */
function sixHex(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const raw = value.trim().toLowerCase().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/.test(raw)) return `#${[...raw].map((c) => c + c).join('')}`;
  if (/^[0-9a-f]{6}([0-9a-f]{2})?$/.test(raw)) return `#${raw.slice(0, 6)}`;
  return undefined;
}

/** An archetype's ground under a colour set, when it resolves to a colour. */
function archetypeGround(archetype: ArchetypeV1, colors: Record<string, string>): string | undefined {
  const ground = archetype.background;
  if (!ground) return undefined;
  const hex = (ground.tokenPath !== undefined ? colors[ground.tokenPath] : undefined) ?? ground.hex;
  return hex !== undefined && parseBackgroundRgb(hex) ? hex : undefined;
}

/**
 * The path whose themed colour is the darkest one that reads as dark (or the
 * lightest that reads as light), first among the master's own grounds and the
 * semantic surface, then among every colour of the set. Undefined when none reads so.
 */
function extremeGroundPath(colors: Record<string, string>, master: SlideMasterV1, dark: boolean): string | undefined {
  const pick = (paths: string[]): string | undefined => {
    let best: string | undefined;
    let bestL = dark ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    for (const tokenPath of [...new Set(paths)].sort(compareCodeUnits)) {
      const hex = sixHex(colors[tokenPath]);
      if (!hex || bgIsDark(hex) !== dark) continue;
      const l = hexToOklch(hex)?.l ?? 0.5;
      if (dark ? l < bestL : l > bestL) {
        best = tokenPath;
        bestL = l;
      }
    }
    return best;
  };
  const grounds = [...masterTokenPaths(master)].filter(([, uses]) => uses.has('ground')).map(([tokenPath]) => tokenPath);
  return pick([...grounds, 'color.semantic.surface']) ?? pick(Object.keys(colors));
}

/** How the compile draws the plan's theme, worked out once at its top. */
interface CompileThemeV1 {
  ds: RenovateDesignSystemV1;
  /** The master a slide on the deck's own ground is seeded from, at the frame size. */
  master: SlideMasterV1;
  /** True when a theme other than the master as shipped is applied. */
  themed: boolean;
  /** The archetype a slide's frame takes and the master it is seeded from. `layout` stands in for the slide's own. */
  draw(slidePlan: Pick<SlidePlanV1, 'layout' | 'ground'>, layout?: ArchetypeRefV1): { archetype: ArchetypeRefV1; master: SlideMasterV1; moved?: MovedGroundV1 };
  /** Every master a frame was seeded from so far, for the furniture kinds. */
  masters(): SlideMasterV1[];
  /**
   * True when a frame on this archetype of this master sits on the Brand colour
   * ground, where the colour mark can melt into a ground of its own hue: the mono
   * mark is drawn there (decision 33). False everywhere else, so an unthemed deck
   * keeps the mark the master and the ground choose.
   */
  monoMark(master: SlideMasterV1, archetype: ArchetypeRefV1): boolean;
}

function compileTheme(input: CompileRenovatedInputV1, opts: CompileRenovatedOptsV1): CompileThemeV1 {
  const { plan } = input;
  const locked = opts.locked === true;
  const stored = plan.designSystem.theme;
  const theme = stored && !isPlainTheme(stored) && !(locked && stored.id === 'look') ? stored : null;
  const look = theme?.id === 'look' ? opts.looks?.find((one) => one.id === theme.lookId) : undefined;
  const source = opts.themeSource ?? themeSourceOf(input.designSystem);
  const lookOpts = { ...(look ? { look } : {}), locked };
  const ds = theme
    ? systemForPlan(input.designSystem, plan, { ...lookOpts, ...(source ? { source } : {}) })
    : input.designSystem;
  const sized = (one: SlideMasterV1): SlideMasterV1 => sizedMaster(one, opts.frameSize);
  const hasGrounds = plan.slides.some((slide) => slide.ground !== undefined);

  // No theme and no slide on a ground of its own: the master as given, byte for byte.
  if (!theme && !hasGrounds) {
    const master = sized(input.master);
    return {
      ds,
      master,
      themed: false,
      draw: (slidePlan, layout) => ({ archetype: layout ?? slidePlan.layout, master }),
      masters: () => [master],
      monoMark: () => false,
    };
  }

  const colors = source ? themedColors({ ...source, master: input.master }, theme, lookOpts) : null;
  const shipped = source?.colors ?? {};
  const flip = theme !== null && (theme.flipDark === true || (theme.mode === 'dark' && Object.keys(source?.darkColors ?? {}).length === 0));
  // The master the solve measures grounds on (`solveThemeColors` reads the same one),
  // so a slide's ground group here is the group its colours were solved in.
  const measured = colors?.master ?? (theme ? masterForPlan(input.master, plan, { system: input.designSystem, ...lookOpts }) : input.master);
  /** The master with some archetypes moved onto another ground path, measured and repaired under the theme. */
  const onGrounds = (moves: ReadonlyMap<string, string>): SlideMasterV1 => {
    if (!colors || moves.size === 0) return measured;
    const copy = structuredClone(input.master);
    for (const archetype of copy.archetypes) {
      const tokenPath = moves.get(archetype.id);
      if (tokenPath === undefined) continue;
      const hex = sixHex(colors.colors[tokenPath]);
      archetype.background = { tokenPath, ...(hex ? { hex } : {}) };
    }
    return themeMaster(copy, colors.colors, flip, { base: shipped });
  };
  /**
   * Every archetype whose ground under the theme does not read `dark` (or light)
   * moved onto the theme's darkest (or lightest) ground. `shippedOnly` limits it to
   * the layouts the pack ships on that side: decision 33a, a title slide the pack
   * draws dark stays dark when the deck goes Dark or Brand.
   */
  const toSide = (dark: boolean, shippedOnly: boolean): Map<string, string> => {
    const moves = new Map<string, string>();
    if (!colors) return moves;
    const target = extremeGroundPath(colors.colors, input.master, dark);
    if (target === undefined) return moves;
    for (const archetype of input.master.archetypes) {
      if (shippedOnly) {
        const before = archetypeGround(archetype, shipped);
        if (!before || bgIsDark(before) !== dark) continue;
      }
      const now = archetypeGround(archetype, colors.colors);
      if (now && bgIsDark(now) === dark) continue;
      moves.set(archetype.id, target);
    }
    return moves;
  };
  const holdsDark = theme?.id === 'dark' || theme?.id === 'brand';
  const cache = new Map<string, SlideMasterV1>();
  const masterOf = (key: string, make: () => SlideMasterV1): SlideMasterV1 => {
    const found = cache.get(key);
    if (found) return found;
    const made = sized(make());
    cache.set(key, made);
    return made;
  };
  const deckMaster = masterOf('deck', () => (holdsDark ? onGrounds(toSide(true, true)) : measured));
  // The Brand colour ground, when the deck or a slide is on it, measured against each frame's ground.
  const onBrand = theme?.id === 'brand' || input.plan.slides.some((slide) => slide.ground === 'brand');
  // A Brand colour deck grounds its layouts on the remap's target, whose own value is in
  // the mode's set (the target path may itself be remapped); a slide set to Brand on
  // another deck is drawn on that path as the theme resolves it (see `draw` below).
  const brandPath = brandGroundPath(theme);
  const brandHex = !onBrand || !colors ? undefined
    : sixHex(theme?.id === 'brand' ? colors.modeColors[brandPath] : colors.colors[brandPath]);

  return {
    ds,
    master: deckMaster,
    themed: theme !== null,
    draw: (slidePlan, layout) => {
      const own = layout ?? slidePlan.layout;
      const placed = slideGroundPlan({ layout: own, ...(slidePlan.ground ? { ground: slidePlan.ground } : {}) }, measured, theme);
      if (!placed.moved) return { archetype: placed.archetype, master: deckMaster };
      // A slide on a ground of its own is seeded, continuations too, from a master
      // whose every layout is on that ground, so a chip means the ground it names.
      if (placed.ground === 'dark') {
        return { archetype: placed.archetype, master: masterOf('dark', () => onGrounds(toSide(true, false))), moved: 'dark' };
      }
      if (placed.ground === 'light') {
        // Decision 33b: Light means a light ground, so the slide keeps its own layout
        // on the theme's lightest ground rather than the dark variant drawn inverted.
        return { archetype: own, master: masterOf('light', () => onGrounds(toSide(false, false))) };
      }
      const brandPath = placed.groundPath;
      if (brandPath === undefined || !colors) return { archetype: placed.archetype, master: deckMaster, moved: 'brand' };
      const everyLayout = new Map(input.master.archetypes.map((one) => [one.id, brandPath]));
      return { archetype: placed.archetype, master: masterOf('brand', () => onGrounds(everyLayout)), moved: 'brand' };
    },
    masters: () => [...cache.values()],
    monoMark: (drawnOn, archetypeId) => {
      if (!colors || !brandHex) return false;
      const archetype = drawnOn.archetypes.find((one) => one.id === archetypeId);
      const ground = archetype ? sixHex(archetypeGround(archetype, colors.colors)) : undefined;
      return ground === brandHex;
    },
  };
}

/**
 * The target a colour use takes on a slide: the target of the slide's own ground
 * when the use has one there (`byGround`; an entry with no target keeps the layer's
 * colour), else the deck's. Under a theme a locked use keeps the hex it was locked
 * at (decision 33c). A row whose failure is named by an empty ground entry still
 * applies its deck target on the slides of the deck's ground.
 */
function colourTargetOf(mapping: ColorMappingV1, ground: MovedGroundV1 | undefined, tokens: TokenResolver, themed: boolean): string | undefined {
  if (themed && mapping.locked === true && mapping.to) return mapping.to;
  const resolve = (to: string | undefined, toPath: string | undefined): string | undefined => (toPath ? (tokens(toPath) ?? to) : to);
  const entries = mapping.byGround;
  if (ground && entries && Object.hasOwn(entries, ground)) {
    const entry = entries[ground];
    return entry ? resolve(entry.to, entry.toPath) : undefined;
  }
  if (mapping.unresolved) {
    const named = entries !== undefined && Object.values(entries).some((entry) => entry !== undefined && !entry.to && !entry.toPath);
    if (!named) return undefined;
  }
  return resolve(mapping.to, mapping.toPath);
}

// ─── the design system's face on every text (close-out 9.2) ───────────────────

/** True when a family reads as a monospace face by the alias table or the family class table. */
function monoClassFamily(family: string): boolean {
  if (FONT_ALIASES[normaliseFamily(family)] === 'mono') return true;
  return mapFontsToBrand([family], { brand: '\u0000brand', mono: '\u0000mono' }).get(family) === '\u0000mono';
}

/**
 * Which families a renovated frame sets in the design system's mono face: a family
 * the plan maps to that face (the alias table's monospace families, or a person's
 * choice), or one the plan does not map that reads as monospace. None when the
 * design system states no mono face.
 */
function codeFamilies(plan: RenovationPlanV1, faces: { brand: string; mono?: string }): (family: string | undefined) => boolean {
  const mono = faces.mono;
  if (!mono) return () => false;
  const monoKey = normaliseFamily(mono);
  const mapped = new Map(plan.fonts.map((mapping) => [mapping.from, normaliseFamily(mapping.to)]));
  return (family) => {
    if (!family) return false;
    const to = mapped.get(family);
    if (to !== undefined) return to === monoKey;
    return normaliseFamily(family) === monoKey || monoClassFamily(family);
  };
}

/** True when an object carries at least one run with words. */
function hasWords(object: SourceObjectV1): boolean {
  return (object.text?.paras ?? []).some((para) => para.runs.some((run) => run.text.trim() !== ''));
}

/** True when every run of an object that carries words names a code family. */
function isCodeObject(object: SourceObjectV1, isCode: (family: string | undefined) => boolean): boolean {
  let worded = false;
  for (const para of object.text?.paras ?? []) {
    for (const run of para.runs) {
      if (!run.text.trim()) continue;
      if (!isCode(run.font)) return false;
      worded = true;
    }
  }
  return worded;
}

/**
 * The archetype a slide is compiled on: its planned layout, or that layout's dark
 * variant when the slide's Background is Dark or Brand and the master carries one
 * (plan 275 section 6.2). The Brand ground's own colour is the design system's
 * remap (`systemForPlan`), not this lookup's.
 */
export function archetypeIdFor(slidePlan: Pick<SlidePlanV1, 'layout' | 'ground'>, master: SlideMasterV1): ArchetypeRefV1 {
  const base = slidePlan.layout;
  if (slidePlan.ground !== 'dark' && slidePlan.ground !== 'brand') return base;
  const archetype = master.archetypes.find((one) => one.id === base);
  const dark = archetype?.variants?.dark;
  return dark && master.archetypes.some((one) => one.id === dark) ? dark : base;
}

/**
 * Compile an accepted plan into Design's own authored values, on the design
 * system's slide master.
 *
 * See the notes at the head of this section for the rules. Pure and deterministic:
 * the same source, plan, master and design system produce byte-identical JSON.
 */
export function compileRenovated(input: CompileRenovatedInputV1): CompiledDeckV1 {
  const { source, plan, census } = input;
  const opts = input.opts ?? {};
  const prefix = opts.idPrefix ?? 'r';
  const applyUnreviewed = opts.applyUnreviewed ?? false;
  const applyNeedsAttention = opts.applyNeedsAttention ?? false;
  const style: PlaceholderStyleV1 = {
    fill: opts.placeholderFill ?? '#e7e7e7',
    ink: opts.placeholderInk ?? '#555555',
  };

  if (plan.source.hash !== source.source.hash) {
    throw new Error(
      `The plan was made for ${plan.source.hash} and this source is ${source.source.hash}, so it is a plan for other bytes.`,
    );
  }

  // The plan's colour targets were resolved against its own token pack, and a
  // mapping with no token path carries the hex that pack gave it. Compiling that
  // onto another pack would mix two packs in one deck under one snapshot, so the
  // pack is guarded the same way the source bytes are.
  if (plan.designSystem.tokenHash !== input.designSystem.snapshot.tokenHash) {
    throw new Error(
      `The plan was resolved against token pack ${plan.designSystem.tokenHash} and this design system is ${input.designSystem.snapshot.tokenHash}, so it is a plan for another pack.`,
    );
  }
  if (plan.designSystem.masterId !== undefined && plan.designSystem.masterId !== input.master.id) {
    throw new Error(
      `The plan was resolved against slide master ${plan.designSystem.masterId} and this one is ${input.master.id}, so it is a plan for another master.`,
    );
  }

  // The deck theme, applied here so every caller draws one themed plan the same way.
  const theming = compileTheme(input, opts);
  const { ds, master } = theming;
  const furnitureKinds = new Map<string, string>(master.furniture.map((f) => [f.id, f.kind]));
  /** The master each slide's frames are seeded from, when it is not the deck's own (a slide on a ground of its own). */
  const slideMaster = new Map<string, SlideMasterV1>();
  /** The ground group whose colour targets each slide takes, for a slide the solve moved. */
  const slideGround = new Map<string, MovedGroundV1>();
  /** The archetype a slide's first frame takes under the theme, noting its master and ground group. */
  const drawSlide = (slidePlan: SlidePlanV1, layout?: ArchetypeRefV1): ArchetypeRefV1 => {
    const drawn = theming.draw(slidePlan, layout);
    if (drawn.master !== master) slideMaster.set(slidePlan.id, drawn.master);
    if (drawn.moved) slideGround.set(slidePlan.id, drawn.moved);
    for (const f of drawn.master.furniture) if (!furnitureKinds.has(f.id)) furnitureKinds.set(f.id, f.kind);
    return drawn.archetype;
  };
  /** The master a frame of this slide was seeded from. */
  const masterOfSlide = (slideId: string): SlideMasterV1 => slideMaster.get(slideId) ?? master;
  const frameW = master.size.width;
  const frameH = master.size.height;

  const report: RebrandReportV1 = emptyReport(source.source.hash, plan.revision);
  const forward: LineageV1['forward'] = [];
  const backward: LineageV1['backward'] = [];
  const tray: CompiledDeckV1['tray'] = [];
  const builds: FrameBuildV1[] = [];
  const objectIds: string[] = [];
  /** Characters of path data the document took from drawings, against `DOCUMENT_PATH_CHARS`. */
  let vectorPathChars = 0;
  /** Layer rows by id, so the colour and font passes can find what an object produced. */
  const rowsById = new Map<string, DesignBoxRowV1>();
  /** Source object id to the layers it produced, for the colour and font passes. */
  const producedBy = new Map<string, string[]>();
  /** Tray layer id to the slide its object came from, so the overflow estimate can name it. */
  const traySlide = new Map<string, string>();
  /** Text slot row id to the one object poured into it alone, for the emphasis rule. */
  const soleText = new Map<string, SourceObjectV1>();
  /** Row ids a master slot or master furniture owns: their ink is the master's, never a source mapping's. */
  const masterBound = new Set<string>();
  /** A picture slot a drawing took, to the drawing (plan 275 decision 32): its rows replace the slot row. */
  const vectorSlot = new Map<DesignBoxRowV1, RankedPlacementV1>();
  /** A replaced slot row, to the drawing's rows that stand where it stood. */
  const swapped = new Map<DesignBoxRowV1, DesignBoxRowV1[]>();
  /** Row ids a drawing produced: a colour mapping writes them only where their own colour is its source. */
  const vectorRowIds = new Set<string>();
  /** Objects that became rows, with the count, for their report entry. */
  const vectorMade = new Map<string, number>();
  /** Drawings that stayed pictures, with the reason in the report's words. */
  const vectorKept = new Map<string, string>();
  /** A frame's layers in z-order, with every replaced slot row expanded to the rows that took its place. */
  const layersOf = (build: FrameBuildV1): DesignBoxRowV1[] =>
    [...build.rows, ...build.extras].flatMap((row) => swapped.get(row) ?? [row]);

  const hex6 = (value: string): string => value.trim().toLowerCase().replace(/^#/, '').slice(0, 6);
  /**
   * The colour a run of this object takes: the plan's target for its source colour,
   * when a use maps it (plan 275 decision 20). Undefined leaves the run in the
   * archetype ink, and the report names the colour as not carried.
   */
  /** Source object id to the slide it sits on, for the ground its colour targets come from. */
  const objectSlide = new Map<string, string>();
  for (const slide of source.slides) for (const object of slide.objects) objectSlide.set(object.id, slide.id);
  const groundOfObject = (objectId: string): MovedGroundV1 | undefined => {
    const slideId = objectSlide.get(objectId);
    return slideId === undefined ? undefined : slideGround.get(slideId);
  };
  /** `<objectId>|<target>` to the source colour a run of that object was mapped from, for the run ink guard. */
  const mappedFrom = new Map<string, string>();
  const mappedColour = (objectId: string, hex: string): string | undefined => {
    for (const mapping of plan.colors) {
      if (!mapping.affects.includes(objectId) || hex6(mapping.from) !== hex6(hex)) continue;
      const target = colourTargetOf(mapping, groundOfObject(objectId), ds.tokens, theming.themed);
      if (target && /^#?[0-9a-fA-F]{6}/.test(target.trim())) {
        const written = `#${hex6(target)}`;
        if (!mappedFrom.has(`${objectId}|${written}`)) mappedFrom.set(`${objectId}|${written}`, `#${hex6(hex)}`);
        return written;
      }
    }
    return undefined;
  };
  /**
   * A placement's words in Design's text subset, written once. Source runs keep their
   * bold, italic, underline, strike and list kind; the master's slot supplies the
   * type, the glyph and the ink (decision 21). Anything else is plain words, escaped.
   */
  const richOf = (p: PlacementV1): string => {
    if (p.rich === undefined) {
      const paras = p.object.kind === 'text' ? p.object.text?.paras : undefined;
      if (p.content === 'text' && paras && !p.corrected) {
        // The master's slot sets size, spacing and glyph here on purpose, so those are
        // not reported as lost; what the report names is what a reader would miss.
        const written = designTextOf(paras, { carryColour: false, masterSetsType: true, mapColour: (hex) => mappedColour(p.object.id, hex) });
        p.rich = written.text;
        if (written.dropped.length > 0) p.dropped = written.dropped;
      } else {
        p.rich = designTextFromPlain(p.text ?? '');
      }
    }
    return p.rich;
  };

  const censusClass = new Map<string, ObjectClassV1>();
  for (const entry of census?.objects ?? []) censusClass.set(entry.id, entry.hypothesis.class);

  source.warnings.forEach((warning) => {
    addEntry(report, {
      code: reportCodeForWarning(warning.code),
      message: warning.message,
      reason: warning.code,
    });
  });

  const slideById = new Map(source.slides.map((slide) => [slide.id, slide]));
  const planned = plan.slides
    .map((slidePlan, index) => ({ slidePlan, index }))
    .sort((a, b) => (a.slidePlan.order ?? a.index) - (b.slidePlan.order ?? b.index) || a.index - b.index)
    .map((x) => x.slidePlan);
  const plannedIds = new Set(planned.map((s) => s.id));

  let frameIndex = 0;
  let continuationCount = 0;
  let excluded = 0;
  /** The most continuation slides this deck adds, from the slides it keeps. */
  const deckLimit = deckContinuationLimit(planned.filter((slidePlan) => slidePlan.include && slideById.has(slidePlan.id)).length);
  /** Continuations a picture opened, bounded to half the deck's, so later words keep their room. */
  const pictureLimit = Math.max(1, Math.floor(deckLimit / 2));
  let pictureContinuations = 0;

  /**
   * Seed one frame for a slide. `sequence` is 0 for the slide's own frame and
   * counts this SLIDE's continuations, so `.c1` is the first continuation of the
   * slide it belongs to and the ids say how many a slide has.
   */
  const addBuild = (
    slide: SlideSourceV1,
    archetype: ArchetypeRefV1,
    name: string,
    sequence: number,
  ): FrameBuildV1 => {
    const continuation = sequence > 0;
    const frameId = continuation
      ? `${prefix}.${slug(slide.id)}.c${sequence}`
      : `${prefix}.${slug(slide.id)}`;
    const at = framePosition(frameIndex, frameW, frameH);
    const seedMaster = masterOfSlide(slide.id);
    // On the Brand colour ground the mono mark, unless the design system states its own preference.
    const mono = typeof ds.monoLogo !== 'boolean' && theming.monoMark(seedMaster, archetype);
    const build = seedBuild(seedMaster, archetype, {
      frameId,
      x: at.x,
      y: at.y,
      name,
      order: frameIndex,
      ds: mono ? { ...ds, monoLogo: true } : ds,
      sourceSlideId: slide.id,
      continuation,
    });
    frameIndex += 1;
    builds.push(build);
    return build;
  };

  /** Rewrite a text slot's row from its members, in reading order, then its notes. */
  const writeSlotText = (build: FrameBuildV1, slot: SlotV1): void => {
    const row = build.rows[slot.index];
    if (!row) return;
    // A pour's own order wins inside the slot; otherwise the source's reading order.
    const byPour = (a: RankedPlacementV1, b: RankedPlacementV1): number => (a.pour ?? a.reading) - (b.pour ?? b.reading) || a.reading - b.reading;
    const byReading = (a: RankedPlacementV1, b: RankedPlacementV1): number => a.reading - b.reading;
    const parts = [...[...slot.members].sort(byPour), ...[...slot.notes].sort(byReading)]
      .filter((p) => (p.text ?? '').length > 0)
      .map((p) => richOf(p));
    row.text = parts.join('\n');
  };

  /** The text a slot would hold with one more member or note, for the overflow estimate. */
  const wouldFit = (build: FrameBuildV1, slot: SlotV1, placement: RankedPlacementV1): boolean => {
    const row = build.rows[slot.index];
    if (!row) return false;
    const text = [...slot.members, ...slot.notes, placement].map((p) => p.text ?? '').filter((t) => t.length > 0).join('\n');
    // A picture box that would turn into text is measured at the body size it would take.
    const size = slot.kind === 'image' ? master.typeScale.body : rowNum(row, 'fontSize');
    return estimateTextHeight(text, size, rowNum(row, 'w')) <= rowNum(row, 'h');
  };

  /** Take one slot whole: an image, a placeholder or a table. Returns the layer ids it produced. */
  const takeSlot = (build: FrameBuildV1, slot: SlotV1, placement: RankedPlacementV1): string[] => {
    const row = build.rows[slot.index];
    if (!row) return [];
    const id = rowStr(row, 'id');
    // A picture, a placeholder or a table fills the slot whole; text leaves room
    // for further paragraphs and notes.
    if (placement.content !== 'text' || placement.object.kind === 'table' || placement.object.table !== undefined) slot.taken = true;

    if (placement.content === 'placeholder') {
      const labelId = `${id}.label`;
      const { box, label } = authorPlaceholder(
        slotGeometry(row, id, rowStr(row, 'name')),
        slotGeometry(row, labelId, `${rowStr(row, 'name')} note`),
        placement.label ?? 'Content could not be read',
        style,
      );
      delete label.role;
      build.rows[slot.index] = box;
      build.extras.push(label);
      build.placeholderLayerIds.push(id, labelId);
      return [id, labelId];
    }

    if (placement.content === 'image') {
      // Any box takes a picture (plan 275 decision 30); a text box becomes a picture
      // layer fitted `contain`, so nothing is cropped.
      if (slot.kind !== 'image') {
        rowAsImage(row, placement.image ?? '');
        slot.kind = 'image';
      }
      row.image = placement.image ?? '';
      if (placement.object.alt) row.alt = placement.object.alt;
      slot.picture = placement;
      // A drawing read as items takes the slot as a picture for now; once the slide is
      // laid out, its rows replace the slot row (see the drawing pass below).
      if (carriesItems(placement.object)) vectorSlot.set(row, placement);
      return [id];
    }

    // And every box takes text, shaped to the box in the archetype's body type.
    if (slot.kind === 'image') {
      rowAsText(row, masterOfSlide(build.sourceSlideId), build.archetype, ds.tokens);
      slot.kind = 'text';
    }
    slot.members.push(placement);
    writeSlotText(build, slot);
    return [id];
  };

  /** Pour one text placement into a text slot as a further paragraph. */
  const joinSlot = (build: FrameBuildV1, slot: SlotV1, placement: RankedPlacementV1, asNote: boolean): string[] => {
    const row = build.rows[slot.index];
    if (!row) return [];
    if (asNote) slot.notes.push(placement);
    else slot.members.push(placement);
    writeSlotText(build, slot);
    return [rowStr(row, 'id')];
  };

  /**
   * Write a kept line into one of the master's furniture rows. The footer takes
   * the line's text; a page number keeps none of the source's, because the
   * master numbers the renovated deck by frame position once every frame exists.
   */
  const fillFurniture = (build: FrameBuildV1, index: number | undefined, placement: RankedPlacementV1): string[] => {
    if (index === undefined) return [];
    const row = build.rows[index];
    if (!row) return [];
    if (index !== build.pageNumberIndex) row.text = designTextFromPlain(placement.text ?? '');
    return [rowStr(row, 'id')];
  };

  const freeSlot = (build: FrameBuildV1, test: (slot: SlotV1) => boolean): SlotV1 | undefined =>
    build.slots.find((slot) => !slot.taken && slot.members.length === 0 && slot.notes.length === 0 && test(slot));

  /**
   * Place one leftover on a frame by the compatible-slot rule, or return null:
   * a picture or a placeholder takes a free slot of its kind; text joins a body
   * slot while the estimate allows, else takes a free number, caption or subtitle
   * slot. `emptyOk` lets text into an empty body slot however long it is, since a
   * text nothing else would hold must go somewhere.
   */
  const placeCompatible = (build: FrameBuildV1, placement: RankedPlacementV1, emptyOk: boolean): string[] | null => {
    const need = needOf(placement);
    if (need === 'image') {
      const slot = freeSlot(build, (s) => s.kind === 'image')
        ?? (placement.content === 'placeholder' ? freeSlot(build, (s) => s.role === 'data') : undefined)
        ?? (anyBoxPicture(build, placement) ? freeBoxForPicture(build) : undefined);
      return slot ? takeSlot(build, slot, placement) : null;
    }
    if (need === 'data') {
      const slot = freeSlot(build, (s) => s.role === 'data');
      if (slot) return takeSlot(build, slot, placement);
      // A table waits for a table layout rather than running into the body, unless
      // this is a continuation seeded for it on a master that has no table layout.
      if (!build.continuation || build.slots.some((s) => s.role === 'data')) return null;
    }
    if (placement.content === 'placeholder') {
      const slot = freeSlot(build, (s) => s.role === 'body' || s.role === placement.role);
      return slot ? takeSlot(build, slot, placement) : null;
    }
    const text = placement.text ?? '';
    const empty = freeSlot(build, (s) => s.role === 'body' && s.kind === 'text');
    if (empty && (emptyOk || wouldFit(build, empty, placement))) return takeSlot(build, empty, placement);
    for (const slot of build.slots) {
      // A body box, or a picture or data box that already took text, takes more of it.
      const contentBox = slot.role === 'body' || slot.role === 'visual' || slot.role === 'data';
      if (!contentBox || slot.kind !== 'text' || slot.taken) continue;
      if (slot.members.length === 0 && slot.notes.length === 0) continue;
      if (wouldFit(build, slot, placement)) return joinSlot(build, slot, placement, false);
    }
    const number = isBigNumber(text) ? freeSlot(build, (s) => s.role === 'number') : undefined;
    if (number) return takeSlot(build, number, placement);
    const other = freeSlot(build, (s) => s.kind === 'text' && (s.role === 'caption' || s.role === 'subtitle' || s.role === 'quote'));
    if (other && (emptyOk || wouldFit(build, other, placement))) return takeSlot(build, other, placement);
    // Last on this frame, the first free box that fits it, a picture box included, in
    // reading order (plan 275 decision 30). A continuation waits until every box is full.
    for (const slot of freeBoxesInReadingOrder(build)) {
      if (slot.role === 'title') continue;
      if (emptyOk || wouldFit(build, slot, placement)) return takeSlot(build, slot, placement);
    }
    return null;
  };

  /**
   * A picture that may take a box of another kind: content a person kept or named.
   * A kept mark is the old template's furniture and an icon is incidental, so
   * neither turns a text box into a picture; they keep their own rules.
   */
  const anyBoxPicture = (build: FrameBuildV1, placement: RankedPlacementV1): boolean => {
    if (placement.content !== 'image' || MARK_CLASSES.has(placement.entry.class)) return false;
    const slide = slideById.get(build.sourceSlideId);
    return !(slide && placement.outcome.action === 'keep' && isIncidentalPicture(placement.entry.class, placement.object, slide));
  };

  /** The free boxes of a frame, top to bottom and then left to right. */
  const freeBoxesInReadingOrder = (build: FrameBuildV1): SlotV1[] => build.slots
    .filter((slot) => !slot.taken && slot.members.length === 0 && slot.notes.length === 0)
    .map((slot) => ({ slot, row: build.rows[slot.index] }))
    .filter((one): one is { slot: SlotV1; row: DesignBoxRowV1 } => one.row !== undefined)
    .sort((a, b) => rowNum(a.row, 'y') - rowNum(b.row, 'y') || rowNum(a.row, 'x') - rowNum(b.row, 'x'))
    .map((one) => one.slot);

  /**
   * The free box a picture goes to when its frame has no picture box left: a
   * content box (body, data, quote) first, largest first, then another box that
   * covers at least `PICTURE_BOX_MIN_SHARE` of the frame. A title band is never
   * one: a picture there would read as the heading.
   */
  const freeBoxForPicture = (build: FrameBuildV1): SlotV1 | undefined => {
    const area = (slot: SlotV1): number => {
      const row = build.rows[slot.index];
      return row ? rowNum(row, 'w') * rowNum(row, 'h') : 0;
    };
    const free = freeBoxesInReadingOrder(build).filter((slot) => slot.role !== 'title' && slot.role !== 'subtitle');
    const content = free.filter((slot) => slot.role === 'body' || slot.role === 'data' || slot.role === 'quote' || slot.role === 'visual')
      .sort((a, b) => area(b) - area(a));
    if (content[0]) return content[0];
    return free.find((slot) => area(slot) >= frameW * frameH * PICTURE_BOX_MIN_SHARE);
  };

  /**
   * Place one note: the master's footer (a repeated line that fits it, or a
   * second one beside it while the line stays short), a free caption or label
   * slot, the last paragraph of the body, a free subtitle, the last paragraph of
   * a caption, attribution, quote or subtitle the frame already fills, and last
   * the master's footer however long the line. Null when the frame offers none of those.
   */
  const placeNote = (build: FrameBuildV1, placement: RankedPlacementV1): string[] | null => {
    const text = (placement.text ?? '').trim();
    const footer = build.footerIndex !== undefined ? build.rows[build.footerIndex] : undefined;
    // A line the footer already carries (the layout and the slide both drawing one
    // copyright line) is the same line: its lineage joins the footer and the
    // footer does not say it twice.
    if (footer !== undefined && text.length > 0 && !text.includes('\n') && footerHolds(plainOfDesignText(rowStr(footer, 'text')), text)) {
      return [rowStr(footer, 'id')];
    }
    if (FOOTER_CLASSES.has(placement.entry.class) && footer !== undefined && !text.includes('\n')) {
      const held = rowStr(footer, 'text');
      if (!held && footerFits(footer, text)) return fillFurniture(build, build.footerIndex, placement);
      const joined = `${plainOfDesignText(held)}${FOOTER_JOIN}${text}`;
      if (held && footerFits(footer, joined)) {
        footer.text = `${held}${FOOTER_JOIN}${designTextFromPlain(text)}`;
        return [rowStr(footer, 'id')];
      }
    }
    const labelled = freeSlot(build, (s) => s.kind === 'text' && (s.role === 'caption' || s.role === 'label'));
    if (labelled) return takeSlot(build, labelled, placement);
    const body = build.slots.filter((s) => s.role === 'body' && s.kind === 'text' && !s.taken);
    const last = body[body.length - 1];
    if (last) return joinSlot(build, last, placement, true);
    const subtitle = freeSlot(build, (s) => s.role === 'subtitle' && s.kind === 'text');
    if (subtitle) return takeSlot(build, subtitle, placement);
    for (const role of ['caption', 'attribution', 'quote', 'subtitle'] as const) {
      const filled = build.slots.find((s) => s.role === role && s.kind === 'text' && !s.taken && s.members.length + s.notes.length > 0);
      if (filled) return joinSlot(build, filled, placement, true);
    }
    // Last on the frame: the master's footer, even past its usual length. The
    // overflow estimate reports it; a slide of its own for one unit line or one
    // citation would read worse than a long footer.
    if (footer !== undefined && !text.includes('\n')) {
      const held = rowStr(footer, 'text');
      const line = designTextFromPlain(text);
      footer.text = held ? `${held}${FOOTER_JOIN}${line}` : line;
      return [rowStr(footer, 'id')];
    }
    return null;
  };

  /** A standalone row for the tray: the object at frame scale, in no frame at all. */
  const trayRow = (placement: PlacementV1, slide: SlideSourceV1, id: string, ink: string | undefined): DesignBoxRowV1 => {
    const at: Placement = {
      ox: 0,
      oy: 0,
      sx: slide.width > 0 ? frameW / slide.width : 1,
      sy: slide.height > 0 ? frameH / slide.height : 1,
    };
    const row: DesignBoxRowV1 = { id, ...placeBox(placement.object, at), name: placement.object.id };
    if (placement.content === 'image') {
      row.kind = 'image';
      row.image = placement.image ?? '';
      row.fit = 'contain';
      if (placement.object.alt) row.alt = placement.object.alt;
      return row;
    }
    if (placement.content === 'placeholder') {
      row.kind = 'text';
      row.text = placement.label ?? 'Content could not be read';
      row.bg = style.fill;
      row.fg = style.ink;
      row.fontSize = 18;
      row.align = 'center';
      row.valign = 'middle';
      return row;
    }
    if (placement.content === 'text') {
      row.kind = 'text';
      row.text = richOf(placement);
      const run = firstRun(placement.object);
      if (run?.sizePt) row.fontSize = round2(run.sizePt * PT_TO_PX * at.sy);
      // Text off the master's slots takes the archetype's ink, not the source's.
      if (ink) row.fg = ink;
      return row;
    }
    row.kind = 'box';
    if (placement.object.geom === 'ellipse') row.shape = 'ellipse';
    if (placement.object.geom === 'roundRect') row.shape = 'rounded';
    if (placement.object.fill?.hex) row.bg = placement.object.fill.hex;
    if (placement.object.line?.color?.hex) row.stroke = placement.object.line.color.hex;
    return row;
  };

  /**
   * A picture that may join a picture grid: kept content, or a picture the plan
   * named as a replacement. A mark, an incidental picture and one the plan sent to
   * the tray keep their own rules (see the surplus pass below).
   */
  const gridEligible = (placement: RankedPlacementV1, slide: SlideSourceV1): boolean =>
    placement.content === 'image'
    && placement.surplus !== 'tray'
    // A drawing becomes a group of rows, and a grid cell is one picture layer.
    && !carriesItems(placement.object)
    && !MARK_CLASSES.has(placement.entry.class)
    && !(placement.outcome.action === 'keep' && isIncidentalPicture(placement.entry.class, placement.object, slide));

  /**
   * The image slot of a frame that can hold a picture grid: one a picture took,
   * and not a full-bleed slot, where a grid would sit under the caption and the
   * master's furniture.
   */
  const gridSlotOf = (build: FrameBuildV1, slide: SlideSourceV1): SlotV1 | undefined => build.slots.find((slot) => {
    if (slot.kind !== 'image' || !slot.picture || !gridEligible(slot.picture, slide)) return false;
    const row = build.rows[slot.index];
    return row !== undefined && rowNum(row, 'w') * rowNum(row, 'h') < frameW * frameH * 0.9;
  });

  /**
   * Show several pictures in one image slot as a grid (`pictureGrid`), in reading
   * order. The slot's own row becomes the first cell and keeps its master binding;
   * each further cell is an unbound image layer `<slot id>.cell-<n>` beside it, so a
   * Reset Slide puts the bound first cell back over the whole slot and leaves the
   * others where the grid put them. Every cell draws `contain`, so no picture is
   * cropped. Returns the layer id each picture now sits in, and nothing when the
   * slot is too small for a grid of that many.
   */
  const applyGrid = (build: FrameBuildV1, slot: SlotV1, members: readonly RankedPlacementV1[]): Map<string, string> => {
    const out = new Map<string, string>();
    const row = build.rows[slot.index];
    if (!row || members.length === 0) return out;
    const slotId = rowStr(row, 'id');
    const box = { x: rowNum(row, 'x'), y: rowNum(row, 'y'), w: rowNum(row, 'w'), h: rowNum(row, 'h') };
    const ordered = [...members].sort((a, b) => a.reading - b.reading);
    const aspects = ordered.map((p) => (p.object.box.h > 0 ? p.object.box.w / p.object.box.h : 1));
    const cells = pictureGrid(box, aspects, Math.round(frameW * GRID_GUTTER_SHARE));
    // A slot the gutters leave no room in gives no cells. Nothing moves then: the
    // slot keeps the picture it holds, and the caller finds the others unplaced.
    if (cells.length !== ordered.length) return out;
    ordered.forEach((placement, k) => {
      const cell = cells[k];
      if (!cell) return;
      let target: DesignBoxRowV1 = row;
      if (k > 0) {
        target = { id: `${slotId}.cell-${k + 1}`, kind: 'image', name: `${rowStr(row, 'name')} ${k + 1}` };
        const frame = rowStr(row, 'frame');
        if (frame) target.frame = frame;
        const masterId = rowStr(row, 'master');
        if (masterId) target.master = masterId;
        build.extras.push(target);
      }
      target.x = cell.x;
      target.y = cell.y;
      target.w = cell.w;
      target.h = cell.h;
      target.image = placement.image ?? '';
      target.fit = 'contain';
      delete target.alt;
      if (placement.object.alt) target.alt = placement.object.alt;
      out.set(placement.object.id, rowStr(target, 'id'));
    });
    slot.taken = true;
    const first = ordered[0];
    if (first) slot.picture = first;
    return out;
  };

  /**
   * One text placement cut into its heading and the rest: the first paragraph, when
   * it is a short line (`isLabelText`) set at least `HEADING_SIZE_RATIO` the size of
   * the largest run under it, or bold over lines that are not. Each part carries its
   * own words and markup; both point at the one source object. Undefined when the
   * text has no such heading, or a person corrected its words.
   */
  const headingSplit = (placement: RankedPlacementV1): { head: RankedPlacementV1; rest: RankedPlacementV1 } | undefined => {
    const paras = placement.object.kind === 'text' ? placement.object.text?.paras ?? [] : [];
    if (placement.content !== 'text' || placement.corrected || paras.length < 2) return undefined;
    const [first, ...others] = paras;
    if (!first) return undefined;
    const words = (list: readonly SourceParaV1[]): string => list.map((para) => para.runs.map((run) => run.text).join('')).join('\n').trim();
    const headText = words([first]);
    const restText = words(others);
    if (!headText || !restText) return undefined;
    const size = (list: readonly SourceParaV1[]): number => Math.max(0, ...list.flatMap((para) => para.runs.map((run) => run.sizePt ?? 0)));
    const bold = (list: readonly SourceParaV1[]): boolean => list.every((para) => para.runs.every((run) => run.bold === true || run.text.trim() === ''));
    const larger = size(others) > 0 && size([first]) >= size(others) * HEADING_SIZE_RATIO;
    const heavier = bold([first]) && !bold(others);
    const probe: RankedPlacementV1 = { ...placement, text: headText };
    if (!isLabelText(probe) || !(larger || heavier)) return undefined;
    const rich = (list: readonly SourceParaV1[]): string => designTextOf(list, { carryColour: false, masterSetsType: true, mapColour: (hex) => mappedColour(placement.object.id, hex) }).text;
    // A heading in a label box is one line at the box's own edge, never a list level.
    const heading: SourceParaV1 = { runs: first.runs };
    if (first.align) heading.align = first.align;
    return {
      head: { ...placement, text: headText, rich: rich([heading]) },
      rest: { ...placement, text: restText, rich: rich(others) },
    };
  };

  /**
   * Pour a slide read as Text with a callout: the texts of the one source container
   * that holds text and no picture (the boxed takeaway) go to the layout's callout
   * cell, its first text to the label box when it is a short heading over more, the
   * rest to the body box; every other body text fills the wide box outside the cell
   * in reading order, a picture box turning into text. Returns the placements it
   * placed, recorded in `assigned`. Places nothing when the layout has no callout
   * cell or the slide no such container.
   */
  const pourCallout = (
    build: FrameBuildV1,
    slide: SlideSourceV1,
    roled: readonly RankedPlacementV1[],
    assigned: Map<string, string[]>,
  ): Set<RankedPlacementV1> => {
    const placed = new Set<RankedPlacementV1>();
    const cell = build.slots.filter((slot) => slot.group === 'callout' && slot.kind === 'text' && !slot.taken && slot.members.length === 0);
    const body = cell.find((slot) => slot.role === 'body');
    if (!body) return placed;
    const texts = roled.filter((p) => p.content === 'text' && p.role !== 'title' && p.object.kind === 'text');
    const holders = new Map<string, RankedPlacementV1[]>();
    for (const p of texts) for (const id of p.object.groupPath ?? []) holders.set(id, [...(holders.get(id) ?? []), p]);
    const textOnly = (id: string): boolean => slide.objects.every((o) => !(o.groupPath ?? []).includes(id) || o.kind === 'text' || o.kind === 'shape');
    const callouts = [...holders.entries()].filter(([id, members]) => members.length < texts.length && textOnly(id));
    if (callouts.length !== 1) return placed;
    const members = [...(callouts[0]?.[1] ?? [])].sort((a, b) => a.reading - b.reading);
    const label = cell.find((slot) => slot.role === 'label');
    members.forEach((member, k) => {
      const ids = k === 0 && label && members.length > 1 && isLabelText(member)
        ? takeSlot(build, label, member)
        : body.members.length === 0 ? takeSlot(build, body, member) : joinSlot(build, body, member, false);
      assigned.set(member.object.id, ids);
      placed.add(member);
    });
    const wide = freeSlot(build, (slot) => slot.group === undefined && (slot.role === 'data' || slot.role === 'visual' || slot.role === 'body'));
    if (!wide) return placed;
    const rest = texts.filter((p) => !placed.has(p) && p.role === 'body').sort((a, b) => a.reading - b.reading);
    rest.forEach((member) => {
      const ids = wide.members.length === 0 ? takeSlot(build, wide, member) : joinSlot(build, wide, member, false);
      assigned.set(member.object.id, ids);
      placed.add(member);
    });
    return placed;
  };

  /** How the cells of a frame's layout sit, read from the boxes the seed placed. */
  const pourModeOf = (build: FrameBuildV1): PourModeV1 => {
    const centres = build.cells.map((cell) => {
      const rows = cell.slots.map((slot) => build.rows[slot.index]).filter((row): row is DesignBoxRowV1 => row !== undefined);
      const x0 = Math.min(...rows.map((row) => rowNum(row, 'x')));
      const x1 = Math.max(...rows.map((row) => rowNum(row, 'x') + rowNum(row, 'w')));
      const y0 = Math.min(...rows.map((row) => rowNum(row, 'y')));
      const y1 = Math.max(...rows.map((row) => rowNum(row, 'y') + rowNum(row, 'h')));
      return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
    });
    const distinct = (values: number[], tolerance: number): number => {
      const sorted = [...values].sort((a, b) => a - b);
      let count = 0;
      let last = Number.NEGATIVE_INFINITY;
      for (const v of sorted) {
        if (v - last > tolerance) count += 1;
        last = v;
      }
      return count;
    };
    const columns = distinct(centres.map((c) => c.x), frameW * 0.05);
    const rows = distinct(centres.map((c) => c.y), frameH * 0.05);
    if (columns <= 1) return 'rows';
    if (rows <= 1) return 'columns';
    return 'grid';
  };

  /**
   * Pour units into a frame's cells, one unit per cell in the order the cells read.
   * Inside a cell a marker (a figure, a letter) takes the number box, a short line
   * with text after it takes the label box, text takes the body box and a picture
   * the picture box; a second text joins the body. A member no box of its cell
   * holds is a straggler for the frame's other boxes, and the units past the last
   * cell are returned for a continuation.
   */
  const pourIntoCells = (build: FrameBuildV1, units: readonly PourItemV1[]): {
    placed: Map<string, string[]>; left: PourItemV1[]; stragglers: RankedPlacementV1[];
  } => {
    const placed = new Map<string, string[]>();
    const stragglers: RankedPlacementV1[] = [];
    let order = 0;
    const free = (slot: SlotV1): boolean => !slot.taken && slot.members.length === 0 && slot.notes.length === 0;
    units.slice(0, build.cells.length).forEach((unit, k) => {
      const cell = build.cells[k];
      if (!cell) return;
      const find = (test: (slot: SlotV1) => boolean): SlotV1 | undefined => cell.slots.find((slot) => free(slot) && test(slot));
      unit.members.forEach((member, m) => {
        member.pour = order;
        order += 1;
        let slot: SlotV1 | undefined;
        if (member.content === 'image' || (member.content === 'placeholder' && needOf(member) === 'image')) {
          slot = find((s) => s.kind === 'image') ?? find((s) => s.role === 'body');
        } else {
          // A card's own heading, its first paragraph set larger or bolder than the
          // lines under it, fills the cell's label box and the rest its body box, so a
          // card keeps its title when one text object holds both (close-out CP13).
          const label = find((s) => s.role === 'label' && s.kind === 'text');
          const body = label ? find((s) => s.role === 'body' && s.kind === 'text') : undefined;
          const parts = label && body ? headingSplit(member) : undefined;
          if (label && body && parts) {
            placed.set(member.object.id, [...takeSlot(build, label, parts.head), ...takeSlot(build, body, parts.rest)]);
            return;
          }
          const textAfter = unit.members.slice(m + 1).some((next) => next.content === 'text');
          if (isMarkerText(member)) slot = find((s) => s.role === 'number');
          if (!slot && textAfter && isLabelText(member)) slot = find((s) => s.role === 'label');
          slot ??= find((s) => s.role === 'body') ?? find((s) => s.role === 'label') ?? find((s) => s.role === 'caption')
            ?? find((s) => s.role === 'number' && isMarkerText(member)) ?? find((s) => s.kind === 'image');
          if (!slot) {
            const joinable = cell.slots.find((s) => s.kind === 'text' && !s.taken && s.members.length > 0 && (s.role === 'body' || s.role === 'label' || s.role === 'caption'));
            if (joinable) {
              placed.set(member.object.id, joinSlot(build, joinable, member, false));
              return;
            }
          }
        }
        if (slot) placed.set(member.object.id, takeSlot(build, slot, member));
        else stragglers.push(member);
      });
    });
    return { placed, left: units.slice(build.cells.length), stragglers };
  };

  /**
   * Share body text between peer boxes (F9). Units keep reading order and are cut
   * into one run per box: by count when every unit is within twice the length of
   * the shortest, else by estimated height. A unit that does not fit its box is
   * returned for the compatible-slot rule and, past that, a continuation.
   */
  const distributeToPeers = (
    build: FrameBuildV1,
    peers: readonly SlotV1[],
    texts: readonly RankedPlacementV1[],
    assignedTo: Map<string, string[]>,
  ): RankedPlacementV1[] => {
    const units = pourItems(texts, 'grid').sort((a, b) => a.reading - b.reading);
    const lengths = units.map((unit) => unit.members.reduce((n, p) => n + (p.text ?? '').length, 0));
    const shortest = Math.max(1, Math.min(...lengths));
    const like = lengths.every((n) => n <= shortest * 2);
    const first = build.rows[peers[0]?.index ?? -1];
    const sizes = like
      ? units.map(() => 1)
      : units.map((unit) => estimateTextHeight(unit.members.map((p) => p.text ?? '').join('\n'), first ? rowNum(first, 'fontSize') : master.typeScale.body, first ? rowNum(first, 'w') : frameW));
    const counts = balancedParts(sizes, peers.length);
    const rest: RankedPlacementV1[] = [];
    let at = 0;
    let order = 0;
    counts.forEach((count, j) => {
      const slot = peers[j];
      for (const unit of units.slice(at, at + count)) {
        for (const member of unit.members) {
          member.pour = order;
          order += 1;
          if (!slot) {
            rest.push(member);
            continue;
          }
          const empty = slot.members.length === 0 && slot.notes.length === 0;
          if (empty) assignedTo.set(member.object.id, takeSlot(build, slot, member));
          else if (wouldFit(build, slot, member)) assignedTo.set(member.object.id, joinSlot(build, slot, member, false));
          else rest.push(member);
        }
      }
      at += count;
    });
    return rest;
  };

  // ─── a slide kept in its original arrangement or as a picture ─────────────
  //
  // Plan 275 section 4, the first two tiles of the chooser. Both seed the master's
  // title-only archetype for its furniture and drop its content boxes, so the slide
  // keeps the master's ground, mark, footer and page number while its content sits
  // where the source had it, fitted to the frame at one scale and centred. The
  // slide's layout stays on its plan row and is not read here, so switching back
  // restores it.
  //
  //   - `original`: the plan's proposals apply (a removal removes, a replaced mark
  //     becomes the master's), and the kept objects are restyled by the colour and
  //     font mappings: the passes after the slide loop reach them as they reach every row
  //     no master slot owns, and a text's run colours map here, as they are written.
  //   - `picture`: the slide as it was. Its recovery picture as one image when it
  //     has one; otherwise every object at its place as the faithful compile draws
  //     it, in one group, with no mapping, no proposal and no contrast guard applied.

  /** Layer ids a slide kept as a picture drew: the colour, font and contrast passes leave them alone. */
  const asItWas = new Set<string>();

  /** One slide's frame, seeded for its furniture only, and the box its content is fitted into. */
  const arrangedFrame = (slide: SlideSourceV1, slidePlan: SlidePlanV1, name: string): { build: FrameBuildV1; at: Placement; area: { x: number; y: number; w: number; h: number } } => {
    const build = addBuild(slide, drawSlide(slidePlan, ARRANGED_ARCHETYPE), name, 0);
    const frameRow = build.rows[0] as DesignBoxRowV1;
    build.rows = [frameRow, ...build.rows.slice(1).filter((row) => rowStr(row, 'furniture'))];
    build.slots = [];
    build.cells = [];
    delete build.footerIndex;
    delete build.pageNumberIndex;
    const sw = slide.width > 0 ? slide.width : frameW;
    const sh = slide.height > 0 ? slide.height : frameH;
    const scale = Math.min(frameW / sw, frameH / sh);
    const w = round2(sw * scale);
    const h = round2(sh * scale);
    const x = round2(rowNum(frameRow, 'x') + (frameW - w) / 2);
    const y = round2(rowNum(frameRow, 'y') + (frameH - h) / 2);
    return { build, at: { ox: x, oy: y, sx: scale, sy: scale }, area: { x, y, w, h } };
  };

  /**
   * Put the slide's content rows into its frame: over the master's backdrop panels
   * and under the rest of its furniture (the mark, the footer, the page number), and
   * find the footer and page number rows again at their new places.
   */
  const settleArranged = (build: FrameBuildV1, content: readonly DesignBoxRowV1[]): void => {
    const [frameRow, ...furniture] = build.rows;
    const backdrop = furniture.filter((row) => furnitureKinds.get(rowStr(row, 'furniture')) === 'rect');
    const overlay = furniture.filter((row) => furnitureKinds.get(rowStr(row, 'furniture')) !== 'rect');
    build.rows = [frameRow as DesignBoxRowV1, ...backdrop, ...content, ...overlay];
    build.rows.forEach((row, index) => {
      const kind = furnitureKinds.get(rowStr(row, 'furniture'));
      if (kind === 'footer' && build.footerIndex === undefined) build.footerIndex = index;
      if (kind === 'page-number' && build.pageNumberIndex === undefined) build.pageNumberIndex = index;
    });
  };

  /** Lineage for every layer of an arranged frame, from what each object produced. */
  const arrangedLineage = (build: FrameBuildV1, made: ReadonlyMap<string, string[]>, derivedOf: ReadonlyMap<string, 'placeholder'>): void => {
    const byLayer = new Map<string, string[]>();
    for (const [objectId, ids] of made) for (const id of ids) byLayer.set(id, [...(byLayer.get(id) ?? []), objectId]);
    const furniture = new Set(build.furnitureLayerIds);
    for (const row of layersOf(build)) {
      const id = rowStr(row, 'id');
      if (!id) continue;
      rowsById.set(id, row);
      if (rowStr(row, 'furniture')) masterBound.add(id);
      const sources = [...new Set(byLayer.get(id) ?? [])].sort();
      const derived = derivedOf.get(id) ?? (furniture.has(id) ? 'furniture' : undefined);
      backward.push({ layerId: id, sourceObjectIds: sources, ...(derived ? { derived } : {}) });
    }
  };

  /** The slide as it was, as one picture: its recovery picture, else its objects as the faithful compile draws them. */
  const compileKeptAsPicture = (slide: SlideSourceV1, slidePlan: SlidePlanV1, name: string): void => {
    const { build, area } = arrangedFrame(slide, slidePlan, name);
    const frameId = build.frameId;
    const made = new Map<string, string[]>();
    const derivedOf = new Map<string, 'placeholder'>();
    const content: DesignBoxRowV1[] = [];
    const recovery = slide.recovery?.assetRef;
    if (recovery) {
      const pictureId = `${frameId}.picture`;
      // At its own proportions, centred in the slide's place: the way the Original pane
      // sets the same picture, so both sides show one picture and not a stretched one.
      content.push({ id: pictureId, kind: 'image', ...area, frame: frameId, name: `Slide ${slide.index + 1} picture`, image: recovery, fit: 'contain' });
      asItWas.add(pictureId);
      for (const object of slide.objects) {
        objectIds.push(object.id);
        made.set(object.id, [pictureId]);
        const klass = censusClass.get(object.id) ?? slidePlan.objects.find((row) => row.id === object.id)?.class ?? 'unknown';
        addEntry(report, {
          code: 'object.transformed',
          message: `The ${nounFor(klass, object.kind)} on slide ${slide.index + 1} stays part of the slide picture.`,
          slideId: slide.id,
          objectId: object.id,
          layerId: pictureId,
          disposition: 'transformed',
          class: klass,
          reason: 'kept-as-picture',
        });
        forward.push({ sourceObjectId: object.id, layerIds: [pictureId] });
      }
    } else {
      // The faithful compile draws the one slide at the fitted size; its rows move onto
      // this frame, keep the ids and the report entries it gave them, and become one group.
      const alone = compileFaithful(
        { ...source, warnings: [], slides: [{ ...slide, warnings: [] }] },
        { frameSize: { width: area.w, height: area.h }, idPrefix: prefix, placeholderFill: style.fill, placeholderInk: style.ink },
      );
      const drawn = alone.frames[0];
      const origin = drawn?.layers[0];
      const dx = area.x - (origin ? rowNum(origin, 'x') : 0);
      const dy = area.y - (origin ? rowNum(origin, 'y') : 0);
      const group = `picture:${frameId}`;
      const ground = origin ? rowStr(origin, 'bg') : '';
      const layers = drawn?.layers.slice(1) ?? [];
      if (ground && !layers.some((row) => rowStr(row, 'id') === `${frameId}.ground`)) {
        content.push({ id: `${frameId}.ground`, kind: 'box', ...area, frame: frameId, name: `${slide.id} ground`, bg: ground, group });
        asItWas.add(`${frameId}.ground`);
      }
      for (const layer of layers) {
        const row: DesignBoxRowV1 = { ...layer, x: round2(rowNum(layer, 'x') + dx), y: round2(rowNum(layer, 'y') + dy), frame: frameId, group };
        delete row.order;
        content.push(row);
        asItWas.add(rowId(row));
      }
      for (const id of drawn?.placeholderLayerIds ?? []) {
        build.placeholderLayerIds.push(id);
        derivedOf.set(id, 'placeholder');
      }
      for (const entry of alone.report.entries) {
        if (entry.objectId === undefined) continue;
        addEntry(report, { ...entry, slideId: slide.id });
      }
      for (const object of slide.objects) objectIds.push(object.id);
      for (const link of alone.lineage.forward) {
        made.set(link.sourceObjectId, [...link.layerIds]);
        forward.push({ sourceObjectId: link.sourceObjectId, layerIds: [...link.layerIds] });
      }
    }
    settleArranged(build, content);
    addEntry(report, {
      code: 'slide.kept-as-picture',
      message: recovery
        ? `Slide ${slide.index + 1} was kept as it was, as its own picture.`
        : `Slide ${slide.index + 1} was kept as it was, its objects in their places as one group, with no colour or font mapping.`,
      slideId: slide.id,
      layerId: frameId,
      reason: recovery ? 'recovery-picture' : 'source-objects',
    });
    arrangedLineage(build, made, derivedOf);
  };

  /** The kept objects at their source places, restyled by the colour and font mappings. */
  const compileOriginalArrangement = (slide: SlideSourceV1, slidePlan: SlidePlanV1, entries: ReadonlyMap<string, ObjectPlanV1>, name: string): void => {
    const { build, at } = arrangedFrame(slide, slidePlan, name);
    const frameId = build.frameId;
    const made = new Map<string, string[]>();
    const derivedOf = new Map<string, 'placeholder'>();
    const content: DesignBoxRowV1[] = [];
    let vectorRows = 0;
    const base = (object: SourceObjectV1, id: string): DesignBoxRowV1 => ({ id, ...placeBox(object, at), frame: frameId, name: object.id });
    const mapHex = (objectId: string, hex: string | undefined): string | undefined => (hex ? mappedColour(objectId, hex) ?? hex : undefined);

    for (const object of slide.objects) {
      objectIds.push(object.id);
      const listed = entries.get(object.id);
      const entry: ObjectPlanV1 = listed ?? {
        id: object.id,
        class: censusClass.get(object.id) ?? 'unknown',
        evidence: [],
        proposal: 'keep',
        review: 'unreviewed',
      };
      const placement = describePlacement(object, entry, outcomeOf(entry, applyUnreviewed, applyNeedsAttention), slide.index + 1);
      const layerId = `${prefix}.${slug(object.id)}`;
      const produced: string[] = [];
      let code = placement.code;
      let message = placement.message;
      let disposition = placement.disposition;

      if (placement.content === 'brand-logo' && build.logoLayerId) {
        produced.push(build.logoLayerId);
      } else if (placement.content === 'brand-logo') {
        code = 'object.removed';
        disposition = 'removed';
        message = `The mark on slide ${slide.index + 1} was to be replaced by the design system's own, and this slide shows no logo, so the source mark did not travel.`;
      } else if (placement.content === 'none') {
        // Removed as the plan asked: no row.
      } else if (carriesItems(object) && object.vectorItems && (placement.content === 'image' || placement.content === 'shape')) {
        const rows = vectorItemsToRows(object.vectorItems, placeBox(object, at), { idPrefix: layerId, group: vectorGroupOf(layerId), frame: frameId, fit: 'fill' });
        const chars = 'rows' in rows ? vectorRowsPathChars(rows.rows) : 0;
        const frameRoom = 'rows' in rows && vectorRows + rows.rows.length <= MAX_VECTOR_ROWS_PER_FRAME;
        const documentRoom = vectorPathChars + chars <= DOCUMENT_PATH_CHARS;
        if ('rows' in rows && frameRoom && documentRoom) {
          vectorRows += rows.rows.length;
          vectorPathChars += chars;
          for (const row of rows.rows) {
            content.push(row);
            produced.push(rowId(row));
            vectorRowIds.add(rowId(row));
          }
          vectorMade.set(object.id, rows.rows.length);
          code = 'object.transformed';
          disposition = 'transformed';
          message = vectorCarriedMessage(nounFor(entry.class, object.kind), slide.index + 1, rows.rows.length, object.vectorItems.desc);
        } else {
          const why = 'rows' in rows ? (frameRoom ? 'document-cap' : 'frame-cap') : rows.refused === 'cap-reached' ? 'cap-reached' : 'not-read';
          const image = object.media ?? object.fidelity.fallbackAssetRef;
          if (image) {
            content.push({ ...base(object, layerId), kind: 'image', image, fit: 'fill' });
            produced.push(layerId);
          }
          if (object.kind === 'vector') {
            addEntry(report, {
              code: 'vector.kept-as-picture',
              message: vectorKeptMessage(nounFor(entry.class, object.kind), slide.index + 1, why),
              slideId: slide.id,
              objectId: object.id,
              layerId,
              reason: why,
            });
          }
        }
      } else if (placement.content === 'placeholder') {
        const labelId = `${layerId}.label`;
        const { box, label } = authorPlaceholder(base(object, layerId), base(object, labelId), placement.label ?? `${kindLabel(object.kind)} could not be read`, style);
        content.push(box, label);
        produced.push(layerId, labelId);
        build.placeholderLayerIds.push(layerId, labelId);
        derivedOf.set(layerId, 'placeholder');
        derivedOf.set(labelId, 'placeholder');
      } else if (placement.content === 'image') {
        const row: DesignBoxRowV1 = { ...base(object, layerId), kind: 'image', image: placement.image ?? '', fit: placement.outcome.action === 'replace' ? 'contain' : 'fill' };
        if (object.alt) row.alt = object.alt;
        content.push(row);
        produced.push(layerId);
      } else if (placement.content === 'text') {
        const row: DesignBoxRowV1 = { ...base(object, layerId), kind: 'text', weight: 400 };
        const paras = object.kind === 'text' && !placement.corrected ? object.text?.paras : undefined;
        if (paras) {
          const rich = designTextOf(paras, { carryColour: true, mapColour: (hex) => mappedColour(object.id, hex) });
          row.text = rich.text;
          const fg = mapHex(object.id, rich.baseColour);
          if (fg) row.fg = fg;
          if (rich.align && rich.align !== 'justify') row.align = rich.align;
          if (rich.dropped.length > 0) placement.dropped = rich.dropped;
        } else {
          row.text = richOf(placement);
        }
        const run = firstRun(object);
        if (run?.sizePt) row.fontSize = round2(run.sizePt * PT_TO_PX * at.sy);
        if (object.fill?.hex) row.bg = object.fill.hex;
        content.push(row);
        produced.push(layerId);
      } else {
        const row: DesignBoxRowV1 = { ...base(object, layerId), kind: 'box' };
        if (object.geom === 'ellipse') row.shape = 'ellipse';
        if (object.geom === 'roundRect') row.shape = 'rounded';
        if (object.fill?.hex) row.bg = object.fill.hex;
        if (object.line?.color?.hex) row.stroke = object.line.color.hex;
        if (object.line?.widthPt) row.strokeW = round2(object.line.widthPt * PT_TO_PX * at.sy);
        content.push(row);
        produced.push(layerId);
      }

      addEntry(report, {
        code,
        message,
        slideId: slide.id,
        objectId: object.id,
        ...(produced[0] ? { layerId: produced[0] } : {}),
        disposition,
        class: entry.class,
        action: placement.outcome.action,
        ...(entry.author ? { author: entry.author } : {}),
        review: entry.review,
        ...(placement.fidelity ? { fidelity: placement.fidelity } : {}),
        ...(placement.reason ? { reason: placement.reason } : {}),
      });
      if (code === 'object.transformed' && vectorMade.has(object.id) && object.vectorItems?.omitted?.length) {
        addEntry(report, {
          code: 'vector.items-omitted',
          message: vectorOmittedMessage(nounFor(entry.class, object.kind), slide.index + 1, object.vectorItems.omitted),
          slideId: slide.id,
          objectId: object.id,
          ...(produced[0] ? { layerId: produced[0] } : {}),
          reason: object.vectorItems.omitted.map((o) => `${o.reason}:${o.count}`).join(','),
        });
      }
      if (placement.dropped && placement.dropped.length > 0 && produced[0]) {
        addEntry(report, {
          code: 'text.formatting-not-carried',
          message: formattingNotCarried(slide.index + 1, placement.dropped),
          slideId: slide.id,
          objectId: object.id,
          layerId: produced[0],
          reason: placement.dropped.join(','),
        });
      }
      if (placement.corrected && produced[0]) {
        addEntry(report, {
          code: 'text.corrected',
          message: `The ${nounFor(entry.class, object.kind)} on slide ${slide.index + 1} carries the text as it was corrected, in place of the text that was read.`,
          slideId: slide.id,
          objectId: object.id,
          layerId: produced[0],
          ...(entry.author ? { author: entry.author } : {}),
        });
      }
      if (disposition === 'unresolved' && produced[0]) {
        addEntry(report, { code: 'object.placeholder-authored', slideId: slide.id, objectId: object.id, layerId: produced[0] });
      }
      if (placement.outcome.appliedUnreviewed) {
        addEntry(report, {
          code: 'review.applied-unreviewed',
          slideId: slide.id,
          objectId: object.id,
          action: placement.outcome.action,
          review: entry.review,
          ...(entry.author ? { author: entry.author } : {}),
        });
      }
      if (produced.length > 0) {
        made.set(object.id, produced);
        forward.push({ sourceObjectId: object.id, layerIds: [...produced] });
        producedBy.set(object.id, [...(producedBy.get(object.id) ?? []), ...produced]);
      }
    }
    settleArranged(build, content);
    addEntry(report, {
      code: 'slide.original-arrangement',
      message: `Slide ${slide.index + 1} keeps its original arrangement, restyled by the design system's colours and fonts.`,
      slideId: slide.id,
      layerId: frameId,
    });
    arrangedLineage(build, made, derivedOf);
  };

  for (const slidePlan of planned) {
    const slide = slideById.get(slidePlan.id);
    if (!slide) {
      // The plan names a slide this source does not have, which is what a plan
      // carried across a re-read looks like when the two have drifted. It costs
      // the deck nothing, and saying nothing about it would hide the drift.
      addEntry(report, {
        code: 'slide.excluded',
        message: 'The plan names a slide this source does not have, so there was nothing to renovate for it.',
        slideId: slidePlan.id,
        reason: 'source-slide-missing',
      });
      continue;
    }

    if (!slidePlan.include) {
      excluded += 1;
      addEntry(report, {
        code: 'slide.excluded',
        message: `Slide ${slide.index + 1} was left out of the renovated deck, as the plan asked.`,
        slideId: slide.id,
      });
      for (const object of slide.objects) {
        objectIds.push(object.id);
        addEntry(report, {
          code: 'object.removed',
          message: `The ${nounFor(censusClass.get(object.id) ?? 'unknown', object.kind)} on slide ${slide.index + 1} was left out with its slide.`,
          slideId: slide.id,
          objectId: object.id,
          disposition: 'removed',
          class: censusClass.get(object.id) ?? 'unknown',
          reason: 'slide-excluded',
        });
      }
      continue;
    }

    slide.warnings.forEach((warning) => {
      addEntry(report, {
        code: reportCodeForWarning(warning.code),
        message: warning.message,
        slideId: slide.id,
        reason: warning.code,
      });
    });

    const entries = new Map(slidePlan.objects.map((entry) => [entry.id, entry]));
    const name = renovatedSlideName(slide, entries);
    if (slidePlan.arrangement === 'picture') {
      compileKeptAsPicture(slide, slidePlan, name);
      continue;
    }
    if (slidePlan.arrangement === 'original') {
      compileOriginalArrangement(slide, slidePlan, entries, name);
      continue;
    }
    const build = addBuild(slide, drawSlide(slidePlan), name, 0);

    const frameRow = build.rows[0];
    if (frameRow) {
      if (slide.notes) frameRow.notes = slide.notes;
      if (slide.transition?.kind) frameRow.slideTransition = slide.transition.kind;
    }

    const placements: RankedPlacementV1[] = slide.objects.map((object, index) => {
      objectIds.push(object.id);
      const listed = entries.get(object.id);
      const entry: ObjectPlanV1 = listed ?? {
        id: object.id,
        class: censusClass.get(object.id) ?? 'unknown',
        evidence: [],
        proposal: 'keep',
        review: 'unreviewed',
      };
      const placement = describePlacement(
        object,
        entry,
        outcomeOf(entry, applyUnreviewed, applyNeedsAttention),
        slide.index + 1,
      );
      return { ...placement, reading: object.readingIndex ?? index, listed: listed !== undefined };
    });
    // A layout with a number box per row keeps the rows' own markers for it.
    if (build.cells.length >= 2 && build.cells.some((cell) => cell.slots.some((slot) => slot.role === 'number'))) {
      keepRowMarkers(placements, pourModeOf(build), slide.index + 1);
    }

    // The logo replacements map to the furniture mark the master already seeded.
    const logoLayerId = build.logoLayerId;
    const furnitureLineage = new Map<string, string[]>();
    const assigned = new Map<string, string[]>();
    /** How each object was placed, for its report entry. */
    const placedHow = new Map<string, 'joined' | 'note' | 'page-number' | 'continuation'>();
    const byReading = (a: RankedPlacementV1, b: RankedPlacementV1): number => a.reading - b.reading;

    const notes: RankedPlacementV1[] = [];
    const roled: RankedPlacementV1[] = [];
    const shapes: RankedPlacementV1[] = [];
    const pageNumbers: RankedPlacementV1[] = [];
    for (const placement of placements) {
      if (placement.content === 'none' || placement.content === 'brand-logo') continue;
      if (placement.content === 'shape') shapes.push(placement);
      else if (placement.content === 'text' && isSourcePageNumber(placement) && build.pageNumberIndex !== undefined) pageNumbers.push(placement);
      else if (isNote(placement)) notes.push(placement);
      else roled.push(placement);
    }

    // A slide the census found no title on still has a heading when its largest
    // short text would be one: the title slot is not left empty while the slide
    // has two or more texts for the body, so the body keeps one of them. Three or
    // more texts of one size are rows of a list (plan 275, MEDDPICC slide 3), and
    // none of them heads the others; nor does a row of a layout poured into cells.
    const grouped = build.cells.length >= 2;
    const bodyTexts = roled.filter((p) => p.content === 'text' && p.role === 'body');
    if (!grouped && build.slots.some((s) => s.role === 'title') && !roled.some((p) => p.role === 'title') && bodyTexts.length >= 2) {
      const heading = roled
        .filter((p) => p.content === 'text' && p.role === 'body' && !(p.entry.role === 'body' && (p.entry.author === 'user' || p.entry.author === 'agent')))
        .filter((p) => {
          const text = (p.text ?? '').trim();
          return text.length > 0 && text.length <= TITLE_MAX_CHARS && text.split('\n').length <= 2;
        })
        .sort((a, b) => largestRunPt(b.object) - largestRunPt(a.object) || byReading(a, b))[0];
      const standsOut = heading !== undefined && (bodyTexts.length < 3
        || bodyTexts.every((p) => p === heading || largestRunPt(p.object) < largestRunPt(heading.object)));
      if (heading && standsOut) heading.role = 'title';
    }

    // (a) The archetype slot for each role. A plan role wins over a derived one and
    // a listed object over an unlisted one; pictures claim image slots largest
    // first, so the biggest picture takes the biggest slot. On a layout of cells
    // only the slots outside the cells are claimed by role; the cells are poured.
    const outsideCells = (slot: SlotV1): boolean => !grouped || slot.group === undefined;
    const authority = (p: RankedPlacementV1, role: ArchetypeRoleV1 | undefined): number =>
      (p.entry.role !== undefined && p.entry.role === role ? 0 : p.listed ? 1 : 2);
    // Text with a callout (close-out CP13): the callout's own texts fill the layout's
    // callout box and the rest of the text the wide box beside it, before a picture or
    // a body rule can claim either.
    const consumed = slidePlan.layoutMatch?.structure === 'text-and-callout'
      ? pourCallout(build, slide, roled, assigned)
      : new Set<RankedPlacementV1>();
    const pictures = roled.filter((p) => !consumed.has(p) && needOf(p) === 'image')
      .sort((a, b) => authority(a, a.role) - authority(b, b.role)
        || (b.object.box.w * b.object.box.h) - (a.object.box.w * a.object.box.h) || byReading(a, b));
    let words = roled.filter((p) => !consumed.has(p) && needOf(p) !== 'image')
      .sort((a, b) => compareRole(a.role, b.role) || authority(a, a.role) - authority(b, b.role) || byReading(a, b));
    let leftovers: RankedPlacementV1[] = [];
    for (const placement of pictures) {
      const slot = freeSlot(build, (s) => outsideCells(s) && s.kind === 'image' && s.role === placement.role)
        ?? freeSlot(build, (s) => outsideCells(s) && s.kind === 'image');
      if (slot) assigned.set(placement.object.id, takeSlot(build, slot, placement));
      else leftovers.push(placement);
    }

    // Peer boxes (two body boxes side by side with no cells) share the body text
    // before one of them fills (F9): the units keep reading order and are cut into as
    // many runs as there are boxes, by count when the units are of a like length
    // and by estimated height when they are not.
    const peers = grouped ? [] : build.slots.filter((slot) => slot.role === 'body' && slot.kind === 'text' && slot.group === undefined
      && !slot.taken && slot.members.length === 0);
    const bodyWords = words.filter((p) => p.content === 'text' && p.role === 'body' && p.object.kind !== 'table' && p.object.table === undefined);
    if (peers.length >= 2 && bodyWords.length >= 2) {
      const distributed = new Set(bodyWords);
      words = words.filter((p) => !distributed.has(p));
      leftovers.push(...distributeToPeers(build, peers, bodyWords, assigned));
    }

    for (const placement of words) {
      const role = placement.role;
      const slot = role
        ? freeSlot(build, (s) => outsideCells(s) && s.role === role && (placement.content === 'placeholder' || s.kind === 'text'))
        : undefined;
      if (slot) assigned.set(placement.object.id, takeSlot(build, slot, placement));
      else leftovers.push(placement);
    }

    // (a2) A layout of cells takes the content unit by unit (F9): a label and its
    // body, a letter and its row, a picture and its caption each go to one cell, in
    // the order the cells read. Units past the last cell continue on a new slide of
    // the same layout below.
    let pourLeft: PourItemV1[] = [];
    let pouredUnits = 0;
    if (grouped) {
      const pourable = leftovers.filter((p) => p.content === 'text' || p.content === 'image' || p.content === 'placeholder');
      const kept = new Set(pourable);
      leftovers = leftovers.filter((p) => !kept.has(p));
      const units = pourItems(pourable, pourModeOf(build));
      pouredUnits = units.length;
      const poured = pourIntoCells(build, units);
      for (const [objectId, ids] of poured.placed) assigned.set(objectId, ids);
      leftovers.push(...poured.stragglers);
      pourLeft = poured.left;
    }

    // (b) A compatible slot on the same frame, in reading order: a second body
    // text joins the body while the estimate allows, a lone figure takes the
    // number slot, a heading with no title slot leads the body.
    const later: RankedPlacementV1[] = [];
    for (const placement of leftovers.sort(byReading)) {
      const produced = placeCompatible(build, placement, false);
      if (produced) {
        assigned.set(placement.object.id, produced);
        placedHow.set(placement.object.id, 'joined');
      } else {
        later.push(placement);
      }
    }

    // A kept page number is drawn by the master's own page number.
    for (const placement of pageNumbers) {
      assigned.set(placement.object.id, fillFurniture(build, build.pageNumberIndex, placement));
      placedHow.set(placement.object.id, 'page-number');
    }

    // Notes: the master's footer, a caption or label slot, else the body's last paragraph.
    for (const placement of notes.sort(byReading)) {
      const produced = placeNote(build, placement);
      if (produced) {
        assigned.set(placement.object.id, produced);
        placedHow.set(placement.object.id, 'note');
      } else {
        later.push(placement);
      }
    }

    // (d) Continuation frames, then (e) the tray. A kept shape has no role in an
    // archetype, so it goes to the tray; so does content the plan sent there.
    const trayReasons = new Map<string, string>();
    for (const placement of shapes) trayReasons.set(placement.object.id, 'no-role-in-master');
    const surplusWords: RankedPlacementV1[] = [];
    const surplusPictures: RankedPlacementV1[] = [];
    /** Kept pictures past the slide's own picture slot, which a picture grid shows together. */
    const gridPictures: RankedPlacementV1[] = [];
    for (const placement of later.sort(byReading)) {
      if (placement.surplus === 'tray') trayReasons.set(placement.object.id, 'plan-asked');
      // A kept mark (a partner logo, or one whose replacement nobody answered yet)
      // is the old template's furniture, and a slide of its own would read as
      // content. With no picture slot free on its frame it waits in the tray.
      else if (MARK_CLASSES.has(placement.entry.class)) trayReasons.set(placement.object.id, 'mark-without-slot');
      // An icon or a small picture nobody classed as content never takes a
      // continuation slide of its own: the small pictures of one slide wait in
      // the tray together, where one decision can place or drop the group. A
      // picture the plan named as a replacement is a person's choice, not
      // incidental, and continues like content.
      else if (needOf(placement) === 'image' && placement.outcome.action === 'keep'
        && isIncidentalPicture(placement.entry.class, placement.object, slide)) {
        trayReasons.set(placement.object.id, 'small-pictures');
      } else if (needOf(placement) === 'image' && gridEligible(placement, slide)) gridPictures.push(placement);
      else if (needOf(placement) === 'image') surplusPictures.push(placement);
      else surplusWords.push(placement);
    }

    // Several pictures on one slide share its picture slot as a grid, up to
    // `MAX_GRID_PICTURES`, rather than taking a continuation slide each. The
    // picture that won the slot stays on its slide; the others join it in reading
    // order, and what is left goes to one continuation slide with a grid of its own.
    let gridQueue = gridPictures;
    const ownGrid = gridSlotOf(build, slide);
    if (ownGrid?.picture && gridQueue.length > 0) {
      const joining = gridQueue.slice(0, MAX_GRID_PICTURES - 1);
      const joiningIds = new Set(joining.map((p) => p.object.id));
      const placed = new Set<string>();
      for (const [objectId, layerId] of applyGrid(build, ownGrid, [ownGrid.picture, ...joining])) {
        assigned.set(objectId, [layerId]);
        placed.add(objectId);
        if (joiningIds.has(objectId)) placedHow.set(objectId, 'joined');
      }
      // Only a picture the grid gave a cell leaves the queue. A slot too small for
      // a grid gives none, and those pictures go on to the continuation.
      gridQueue = gridQueue.filter((p) => !placed.has(p.object.id));
    }
    const gridIds = new Set(gridQueue.map((p) => p.object.id));

    // The continuation's title slot carries the slide's own title marked
    // "(continued)", so a person reading the deck knows which slide it continues
    // without reading the same heading twice (plan 275 section 7.2).
    const titlePlacement = placements.find((p) => p.content === 'text' && p.role === 'title' && assigned.has(p.object.id));
    const titleText = titlePlacement?.text ?? '';
    // So does its footer: the kept lines the master's footer took on the slide.
    const ownFooter = build.footerIndex !== undefined ? build.rows[build.footerIndex] : undefined;
    const ownFooterId = ownFooter ? rowStr(ownFooter, 'id') : '';
    const footerText = ownFooter ? rowStr(ownFooter, 'text') : '';

    /**
     * Stage the repeated title and footer on a continuation frame. They are written
     * into the lineage only once the frame keeps something, so a frame rolled back
     * leaves no layer id behind that no frame holds.
     */
    const repeatOnto = (extra: FrameBuildV1): Array<{ objectId: string; ids: string[] }> => {
      const repeats: Array<{ objectId: string; ids: string[] }> = [];
      if (titleText && titlePlacement) {
        const slot = freeSlot(extra, (s) => s.role === 'title' && s.kind === 'text');
        if (slot) {
          const line = titleText.split('\n')[0]?.trim() ?? '';
          const richLine = richOf(titlePlacement).split('\n')[0]?.trimEnd() ?? '';
          const continued: RankedPlacementV1 = { ...titlePlacement, text: `${line} (continued)`, rich: `${richLine} (continued)` };
          repeats.push({ objectId: titlePlacement.object.id, ids: takeSlot(extra, slot, continued) });
        }
      }
      const extraFooter = extra.footerIndex !== undefined ? extra.rows[extra.footerIndex] : undefined;
      if (footerText && extraFooter && !rowStr(extraFooter, 'text') && footerFits(extraFooter, plainOfDesignText(footerText))) {
        extraFooter.text = footerText;
        const repeatId = rowStr(extraFooter, 'id');
        for (const [objectId, ids] of assigned) {
          if (ids.includes(ownFooterId)) repeats.push({ objectId, ids: [repeatId] });
        }
      }
      return repeats;
    };

    let added = 0;

    // Units a layout of cells could not hold continue on new slides of the same
    // layout, so rows or boxes stay rows or boxes; the report says where they went.
    if (pourLeft.length > 0) {
      let units = pourLeft;
      let continuedOn: number | undefined;
      while (units.length > 0) {
        if (added >= MAX_CONTINUATION_FRAMES || continuationCount >= deckLimit) {
          const reason = added >= MAX_CONTINUATION_FRAMES ? 'continuation-limit' : 'deck-continuation-limit';
          for (const unit of units) for (const p of unit.members) trayReasons.set(p.object.id, reason);
          break;
        }
        const extra = addBuild(slide, build.archetype, `${name} (${added + 2})`, added + 1);
        const repeats = repeatOnto(extra);
        const poured = pourIntoCells(extra, units);
        if (poured.placed.size === 0) {
          builds.pop();
          frameIndex -= 1;
          for (const unit of units) for (const p of unit.members) trayReasons.set(p.object.id, 'no-role-in-master');
          break;
        }
        for (const { objectId, ids } of repeats) assigned.set(objectId, [...(assigned.get(objectId) ?? []), ...ids]);
        added += 1;
        continuationCount += 1;
        continuedOn ??= builds.length;
        addEntry(report, {
          code: 'slide.continuation-added',
          message: `Continuation slide ${added} of slide ${slide.index + 1} was added for ${poured.placed.size} piece(s) of content its layout had no box for, so the numbering after it moves.`,
          slideId: slide.id,
          layerId: extra.frameId,
        });
        for (const [objectId, ids] of poured.placed) {
          assigned.set(objectId, ids);
          placedHow.set(objectId, 'continuation');
          const placement = placements.find((p) => p.object.id === objectId);
          if (!placement) continue;
          addEntry(report, {
            code: 'object.surplus-continuation',
            message: `The ${nounFor(placement.entry.class, placement.object.kind)} on slide ${slide.index + 1} fit no box on its own slide, so it moved to continuation slide ${added} of slide ${slide.index + 1}.`,
            slideId: slide.id,
            objectId,
            ...(ids[0] ? { layerId: ids[0] } : {}),
          });
        }
        for (const p of poured.stragglers) trayReasons.set(p.object.id, 'no-role-in-master');
        units = poured.left;
      }
      if (continuedOn !== undefined) {
        const holds = build.cells.length;
        const layoutName = master.archetypes.find((one) => one.id === build.archetype)?.name ?? build.archetype;
        addEntry(report, {
          code: 'layout.poured-to-continuation',
          message: `${pouredUnits} boxes of content on slide ${slide.index + 1} poured into ${layoutName}, which holds ${holds}; the rest continue on slide ${continuedOn}.`,
          slideId: slide.id,
          reason: `${pouredUnits}>${holds}`,
        });
      }
    }

    // Words and tables go first, pictures after them, so a bound that is reached
    // sends pictures to the tray and never the text a person wrote.
    let queue = [...surplusWords, ...surplusPictures, ...gridQueue];
    while (queue.length > 0) {
      const first = queue[0] as RankedPlacementV1;
      const target = continuationArchetype(master, build.archetype, needOf(first));
      if (!target) {
        trayReasons.set(first.object.id, 'no-role-in-master');
        queue = queue.slice(1);
        continue;
      }
      // Pictures may open at most half the deck's continuations, so the slides
      // after them still have room for their words.
      const pictureTurn = target.need === 'image';
      if (added >= MAX_CONTINUATION_FRAMES || continuationCount >= deckLimit
        || (pictureTurn && pictureContinuations >= pictureLimit)) {
        const reason = added >= MAX_CONTINUATION_FRAMES ? 'continuation-limit' : 'deck-continuation-limit';
        for (const p of queue) trayReasons.set(p.object.id, reason);
        break;
      }
      // A continuation frame is named for its slide with its place among the
      // slide's frames, "(2)" for the first one; its title slot says "(continued)".
      const extra = addBuild(slide, target.id, `${name} (${added + 2})`, added + 1);
      const placedHere: Array<{ placement: RankedPlacementV1; layerId: string }> = [];
      const repeats = repeatOnto(extra);
      let left: RankedPlacementV1[] = [];
      for (const placement of queue) {
        const emptyOk = placement === first;
        const produced = isNote(placement)
          ? (placedHere.length > 0 || emptyOk ? placeNote(extra, placement) : null)
          : placeCompatible(extra, placement, emptyOk);
        if (!produced) {
          left.push(placement);
          continue;
        }
        assigned.set(placement.object.id, produced);
        placedHow.set(placement.object.id, 'continuation');
        placedHere.push({ placement, layerId: produced[0] ?? extra.frameId });
      }
      // The first grid picture on this frame took its picture slot; the rest of the
      // slide's grid pictures join it there, and those past a full grid wait in the
      // tray, so the pictures of one slide never open a second continuation.
      const extraGrid = gridSlotOf(extra, slide);
      if (extraGrid?.picture && gridIds.has(extraGrid.picture.object.id)) {
        const waiting = left.filter((p) => gridIds.has(p.object.id));
        const joining = waiting.slice(0, MAX_GRID_PICTURES - 1);
        for (const p of waiting.slice(joining.length)) trayReasons.set(p.object.id, 'picture-grid-full');
        if (joining.length > 0) {
          const members = [extraGrid.picture, ...joining];
          const cells = applyGrid(extra, extraGrid, members);
          for (const p of members) {
            const layerId = cells.get(p.object.id);
            if (!layerId) {
              // The frame's own picture keeps the slot it took; one that was to join
              // it has no cell in a slot this small, so it waits in the tray.
              if (p !== extraGrid.picture) trayReasons.set(p.object.id, 'picture-grid-no-room');
              continue;
            }
            assigned.set(p.object.id, [layerId]);
            placedHow.set(p.object.id, 'continuation');
            const at = placedHere.findIndex((one) => one.placement.object.id === p.object.id);
            if (at >= 0) placedHere[at] = { placement: p, layerId };
            else placedHere.push({ placement: p, layerId });
          }
        }
        left = left.filter((p) => !gridIds.has(p.object.id));
      }
      if (placedHere.length === 0) {
        // The fresh frame took nothing, which the archetype choice rules out for
        // the first item; roll it back rather than ship a blank slide.
        builds.pop();
        frameIndex -= 1;
        for (const p of left) trayReasons.set(p.object.id, 'no-role-in-master');
        break;
      }
      for (const { objectId, ids } of repeats) assigned.set(objectId, [...(assigned.get(objectId) ?? []), ...ids]);
      added += 1;
      continuationCount += 1;
      if (pictureTurn) pictureContinuations += 1;
      addEntry(report, {
        code: 'slide.continuation-added',
        message: `Continuation slide ${added} of slide ${slide.index + 1} was added for ${placedHere.length} piece(s) of content that fit no slot, so the numbering after it moves.`,
        slideId: slide.id,
        layerId: extra.frameId,
      });
      for (const { placement, layerId } of placedHere) {
        addEntry(report, {
          code: 'object.surplus-continuation',
          message: `The ${nounFor(placement.entry.class, placement.object.kind)} on slide ${slide.index + 1} fit no slot on its own slide, so it moved to continuation slide ${added} of slide ${slide.index + 1}.`,
          slideId: slide.id,
          objectId: placement.object.id,
          layerId,
        });
      }
      queue = left;
    }

    // The drawing pass (plan 275 decision 32). Every picture slot a drawing took is
    // replaced by the drawing's rows, fitted `contain` in the slot, in one group, so
    // no picture layer stands where the drawing does. A drawing with more rows than
    // its frame has room for keeps the picture it took.
    for (const item of builds) {
      if (item.sourceSlideId !== slide.id) continue;
      let onFrame = 0;
      for (const row of [...item.rows, ...item.extras]) {
        const placement = vectorSlot.get(row);
        const items = placement?.object.vectorItems;
        if (!placement || !items) continue;
        const object = placement.object;
        const base = `${prefix}.${slug(object.id)}`;
        const made = vectorItemsToRows(
          items,
          { x: rowNum(row, 'x'), y: rowNum(row, 'y'), w: rowNum(row, 'w'), h: rowNum(row, 'h') },
          { idPrefix: base, group: vectorGroupOf(base), frame: rowStr(row, 'frame') || item.frameId, fit: 'contain' },
        );
        if (!('rows' in made)) {
          vectorKept.set(object.id, made.refused === 'cap-reached' ? 'cap-reached' : 'not-read');
          continue;
        }
        if (onFrame + made.rows.length > MAX_VECTOR_ROWS_PER_FRAME) {
          vectorKept.set(object.id, 'frame-cap');
          continue;
        }
        const chars = vectorRowsPathChars(made.rows);
        if (vectorPathChars + chars > DOCUMENT_PATH_CHARS) {
          vectorKept.set(object.id, 'document-cap');
          continue;
        }
        vectorPathChars += chars;
        onFrame += made.rows.length;
        const order = row.order;
        for (const one of made.rows) {
          if (typeof order === 'number') one.order = order;
          vectorRowIds.add(rowId(one));
        }
        swapped.set(row, made.rows);
        assigned.set(object.id, made.rows.map(rowId));
        vectorMade.set(object.id, made.rows.length);
      }
    }

    const ink = archetypeInk(masterOfSlide(build.sourceSlideId), build.archetype, ds.tokens);
    const trayed = placements.filter((p) => trayReasons.has(p.object.id)).sort(byReading);
    for (const placement of trayed) {
      const id = `${prefix}.${slug(placement.object.id)}`;
      tray.push({ sourceObjectId: placement.object.id, layer: trayRow(placement, slide, id, ink) });
      assigned.set(placement.object.id, [id]);
      rowsById.set(id, tray[tray.length - 1]!.layer);
      traySlide.set(id, slide.id);
      backward.push({ layerId: id, sourceObjectIds: [placement.object.id] });
      const reason = trayReasons.get(placement.object.id) ?? 'no-role-in-master';
      addEntry(report, {
        code: 'object.surplus-tray',
        message: trayMessage(reason, nounFor(placement.entry.class, placement.object.kind), slide.index + 1, deckLimit),
        slideId: slide.id,
        objectId: placement.object.id,
        layerId: id,
        reason,
      });
    }

    // A slot one object took alone keeps that object for the emphasis rule.
    for (const item of builds) {
      if (item.sourceSlideId !== slide.id) continue;
      for (const slot of item.slots) {
        const row = item.rows[slot.index];
        const only = slot.members[0];
        if (row && slot.members.length === 1 && slot.notes.length === 0 && only) soleText.set(rowStr(row, 'id'), only.object);
      }
    }

    // Now the report: one disposition per object, in the slide's own z-order.
    for (const placement of placements) {
      const object = placement.object;
      const produced = assigned.get(object.id) ?? [];

      if (placement.content === 'brand-logo') {
        if (logoLayerId) {
          const list = furnitureLineage.get(logoLayerId) ?? [];
          list.push(object.id);
          furnitureLineage.set(logoLayerId, list);
          addEntry(report, {
            code: 'object.replaced-logo',
            message: placement.message,
            slideId: slide.id,
            objectId: object.id,
            layerId: logoLayerId,
            disposition: 'transformed',
            class: placement.entry.class,
            action: 'replace',
            ...(placement.entry.author ? { author: placement.entry.author } : {}),
            review: placement.entry.review,
          });
          forward.push({ sourceObjectId: object.id, layerIds: [logoLayerId] });
        } else {
          addEntry(report, {
            code: 'object.removed',
            message: `The mark on slide ${slide.index + 1} was to be replaced by the design system's own, and this archetype shows no logo, so the source mark did not travel.`,
            slideId: slide.id,
            objectId: object.id,
            disposition: 'removed',
            class: placement.entry.class,
            action: 'replace',
            reason: 'no-logo-furniture',
          });
        }
        if (placement.outcome.appliedUnreviewed) {
          addEntry(report, {
            code: 'review.applied-unreviewed',
            slideId: slide.id,
            objectId: object.id,
            action: placement.outcome.action,
            review: placement.entry.review,
            ...(placement.entry.author ? { author: placement.entry.author } : {}),
          });
        }
        continue;
      }

      const how = placedHow.get(object.id);
      const drawnByMaster = how === 'page-number';
      const rowsMade = vectorMade.get(object.id);
      if (rowsMade !== undefined && object.vectorItems) {
        const noun = nounFor(placement.entry.class, object.kind);
        addEntry(report, {
          code: 'object.transformed',
          message: vectorCarriedMessage(noun, slide.index + 1, rowsMade, object.vectorItems.desc),
          slideId: slide.id,
          objectId: object.id,
          ...(produced[0] ? { layerId: produced[0] } : {}),
          disposition: 'transformed',
          class: placement.entry.class,
          action: placement.outcome.action,
          ...(placement.entry.author ? { author: placement.entry.author } : {}),
          review: placement.entry.review,
          fidelity: object.fidelity.state,
        });
        if (object.vectorItems.omitted?.length) {
          addEntry(report, {
            code: 'vector.items-omitted',
            message: vectorOmittedMessage(noun, slide.index + 1, object.vectorItems.omitted),
            slideId: slide.id,
            objectId: object.id,
            ...(produced[0] ? { layerId: produced[0] } : {}),
            reason: object.vectorItems.omitted.map((o) => `${o.reason}:${o.count}`).join(','),
          });
        }
        if (placement.outcome.appliedUnreviewed) {
          addEntry(report, {
            code: 'review.applied-unreviewed',
            slideId: slide.id,
            objectId: object.id,
            action: placement.outcome.action,
            review: placement.entry.review,
            ...(placement.entry.author ? { author: placement.entry.author } : {}),
          });
        }
        if (produced.length > 0) {
          forward.push({ sourceObjectId: object.id, layerIds: [...produced] });
          producedBy.set(object.id, [...(producedBy.get(object.id) ?? []), ...produced]);
        }
        continue;
      }
      if (object.kind === 'vector' && placement.content === 'image' && produced.length > 0) {
        // A drawing that is a picture here says why: its reading, its size, or the tray.
        const why = vectorKept.get(object.id) ?? (trayReasons.has(object.id) && carriesItems(object) ? 'tray' : keptReason(object));
        addEntry(report, {
          code: 'vector.kept-as-picture',
          message: vectorKeptMessage(nounFor(placement.entry.class, object.kind), slide.index + 1, why),
          slideId: slide.id,
          objectId: object.id,
          ...(produced[0] ? { layerId: produced[0] } : {}),
          reason: why,
        });
      }
      addEntry(report, {
        code: drawnByMaster ? 'object.transformed' : placement.code,
        message: drawnByMaster
          ? `The page number on slide ${slide.index + 1} is drawn by the master's own page number.`
          : how === 'note' && placement.disposition === 'retained'
            ? `The ${nounFor(placement.entry.class, object.kind)} on slide ${slide.index + 1} was carried over as a note under the content.`
            : placement.message,
        slideId: slide.id,
        objectId: object.id,
        ...(produced[0] ? { layerId: produced[0] } : {}),
        disposition: drawnByMaster ? 'transformed' : placement.disposition,
        class: placement.entry.class,
        action: placement.outcome.action,
        ...(placement.entry.author ? { author: placement.entry.author } : {}),
        review: placement.entry.review,
        ...(placement.fidelity ? { fidelity: placement.fidelity } : {}),
        ...(placement.reason ? { reason: placement.reason } : {}),
      });

      if (placement.content === 'text' && produced.length > 0 && !drawnByMaster) {
        if (placement.corrected) {
          addEntry(report, {
            code: 'text.corrected',
            message: `The ${nounFor(placement.entry.class, object.kind)} on slide ${slide.index + 1} carries the text as it was corrected, in place of the text that was read.`,
            slideId: slide.id,
            objectId: object.id,
            layerId: produced[0] as string,
            ...(placement.entry.author ? { author: placement.entry.author } : {}),
          });
          // A correction is plain words, so the run formatting the reading carried
          // does not travel with it. Say which, rather than let it go in silence.
          const lost = object.kind === 'text' ? correctionDrops(object.text?.paras ?? []) : [];
          if (lost.length > 0) {
            addEntry(report, {
              code: 'text.formatting-not-carried',
              message: correctedWithout(slide.index + 1, lost),
              slideId: slide.id,
              objectId: object.id,
              layerId: produced[0] as string,
              reason: lost.join(','),
            });
          }
        } else if (how !== 'note') {
          richOf(placement);
          if (placement.dropped && placement.dropped.length > 0) {
            addEntry(report, {
              code: 'text.formatting-not-carried',
              message: formattingNotCarried(slide.index + 1, placement.dropped),
              slideId: slide.id,
              objectId: object.id,
              layerId: produced[0] as string,
              reason: placement.dropped.join(','),
            });
          }
        }
      }

      if (placement.cap && placement.cap.dropped > 0) {
        addEntry(report, {
          code: 'source.cap-reached',
          message: `The table on slide ${slide.index + 1} is ${placement.cap.sourceRows} by ${placement.cap.sourceCols}, past this compile's cap of ${MAX_TABLE_ROWS} by ${MAX_TABLE_COLS}, so ${placement.cap.dropped} cell(s) did not travel.`,
          slideId: slide.id,
          objectId: object.id,
          ...(produced[0] ? { layerId: produced[0] } : {}),
          reason: 'cap-reached',
        });
      }

      if (placement.disposition === 'unresolved' && produced.length > 0) {
        addEntry(report, {
          code: 'object.placeholder-authored',
          slideId: slide.id,
          objectId: object.id,
          ...(produced[0] ? { layerId: produced[0] } : {}),
        });
      }

      if (placement.outcome.appliedUnreviewed) {
        addEntry(report, {
          code: 'review.applied-unreviewed',
          slideId: slide.id,
          objectId: object.id,
          action: placement.outcome.action,
          review: placement.entry.review,
          ...(placement.entry.author ? { author: placement.entry.author } : {}),
        });
      }

      if (produced.length > 0) {
        forward.push({ sourceObjectId: object.id, layerIds: [...produced] });
        for (const id of produced) {
          const existing = producedBy.get(object.id) ?? [];
          existing.push(id);
          producedBy.set(object.id, existing);
        }
      }
    }

    // Lineage for every layer of the frames this slide produced.
    for (const item of builds) {
      if (item.sourceSlideId !== slide.id) continue;
      const placeholders = new Set(item.placeholderLayerIds);
      const furniture = new Set(item.furnitureLayerIds);
      const byLayer = new Map<string, string[]>();
      for (const [objectId, ids] of assigned) for (const id of ids) {
        const list = byLayer.get(id) ?? [];
        list.push(objectId);
        byLayer.set(id, list);
      }
      for (const row of layersOf(item)) {
        const id = rowStr(row, 'id');
        if (!id) continue;
        rowsById.set(id, row);
        if (rowStr(row, 'role') || rowStr(row, 'furniture')) masterBound.add(id);
        const sources = [...new Set([...(byLayer.get(id) ?? []), ...(furnitureLineage.get(id) ?? [])])].sort();
        const derived = placeholders.has(id)
          ? 'placeholder'
          : furniture.has(id)
            ? 'furniture'
            : item.continuation && sources.length === 0
              ? 'continuation'
              : undefined;
        backward.push({ layerId: id, sourceObjectIds: sources, ...(derived ? { derived } : {}) });
      }
    }
  }

  // Source slides the plan never mentions are excluded, and their objects are
  // still accounted for: a slide nobody planned is not a slide nobody notices.
  for (const slide of source.slides) {
    if (plannedIds.has(slide.id)) continue;
    excluded += 1;
    addEntry(report, {
      code: 'slide.excluded',
      message: `Slide ${slide.index + 1} is not in the plan, so it was left out.`,
      slideId: slide.id,
      reason: 'not-in-plan',
    });
    for (const object of slide.objects) {
      objectIds.push(object.id);
      addEntry(report, {
        code: 'object.removed',
        message: `The ${nounFor(censusClass.get(object.id) ?? 'unknown', object.kind)} on slide ${slide.index + 1} was left out with its slide, which the plan does not mention.`,
        slideId: slide.id,
        objectId: object.id,
        disposition: 'removed',
        class: censusClass.get(object.id) ?? 'unknown',
        reason: 'not-in-plan',
      });
    }
  }

  // The master's page number reads the frame's place in the renovated deck.
  builds.forEach((build, position) => {
    if (build.pageNumberIndex === undefined) return;
    const row = build.rows[build.pageNumberIndex];
    if (row && !rowStr(row, 'text')) row.text = String(position + 1);
  });

  // ─── text fitting (close-out CP13) ────────────────────────────────────────
  //
  // A text row's box is the text's own box, as the master and the source drew it and
  // as the preview draws it: Design's default inset (its `pad`, 8 px) would move every
  // line in and clip a one-line footer. Design's own pptx import writes 0 the same way.
  for (const row of [...builds.flatMap((build) => layersOf(build)), ...tray.map((item) => item.layer)]) {
    if (rowStr(row, 'kind') === 'text' && row.pad === undefined) row.pad = 0;
  }
  // Text is fitted before anything is called cut. A row whose words run past its box
  // (`designTextFit`, the layout the preview draws) takes the largest size, down to
  // the smallest the slide master sets its role at in its layouts, at which its words
  // fit the box. When none does, the box grows into the free room under it in its
  // layout, at the largest of those sizes the room holds. What still does not fit is
  // reported below as `text.overflow`, with the words the box clips. Furniture keeps
  // the master's size and box: its lines were already held to fit it.
  /** The smallest size the master sets each text role at, across its layouts: how far a text may shrink. */
  const roleFloor = new Map<string, number>();
  for (const archetype of master.archetypes) {
    for (const ph of archetype.placeholders) {
      if (ph.kind !== 'text') continue;
      const size = roleFontSize(master, ph.role, ph.style);
      const held = roleFloor.get(ph.role);
      if (size > 0 && (held === undefined || size < held)) roleFloor.set(ph.role, size);
    }
  }
  /** The gap a grown box keeps above the next box under it, in px. */
  const growGap = Math.round(frameH * TEXT_GROW_GAP_SHARE);
  /** How far a text row's box may grow down: to the first box under it, else the frame's foot less a margin. */
  const roomBelow = (rows: readonly DesignBoxRowV1[], row: DesignBoxRowV1): number => {
    const head = rows[0];
    const x0 = rowNum(row, 'x');
    const x1 = x0 + rowNum(row, 'w');
    const bottom = rowNum(row, 'y') + rowNum(row, 'h');
    let limit = head ? rowNum(head, 'y') + rowNum(head, 'h') - growGap : bottom;
    for (const other of rows) {
      if (other === row || other === head || other.hidden === true) continue;
      // A box that starts above this row's foot is behind it or beside it, not under it.
      const top = rowNum(other, 'y');
      if (top < bottom - 0.5) continue;
      const ox0 = rowNum(other, 'x');
      if (ox0 >= x1 || ox0 + rowNum(other, 'w') <= x0) continue;
      limit = Math.min(limit, top - growGap);
    }
    return Math.max(0, round2(limit - bottom));
  };
  const fitRow = (rows: readonly DesignBoxRowV1[], row: DesignBoxRowV1): void => {
    if (designTextFit(row).needed <= rowNum(row, 'h') + 0.5) return;
    const size = rowNum(row, 'fontSize');
    const role = rowStr(row, 'role');
    // A picture or data box that took text is set in body type, so it shrinks as body text does.
    const floorRole = role === 'visual' || role === 'data' ? 'body' : role;
    const floor = floorRole && !rowStr(row, 'furniture') ? roleFloor.get(floorRole) : undefined;
    if (!(size > 0) || floor === undefined) return;
    const sizes = [size];
    for (let next = Math.ceil(size) - 1; next > floor; next -= 1) sizes.push(next);
    if (floor < size) sizes.push(floor);
    const h = rowNum(row, 'h');
    for (const one of sizes) {
      row.fontSize = one;
      if (designTextFit(row).needed <= h + 0.5) return;
    }
    const room = roomBelow(rows, row);
    for (const one of sizes) {
      row.fontSize = one;
      const needed = designTextFit({ ...row, h: h + room }).needed;
      if (needed <= h + room + 0.5) {
        row.h = round2(Math.max(h, needed));
        return;
      }
    }
    // Nothing fits: the smallest size, in all the room there is, and the report says what is cut.
    row.fontSize = sizes[sizes.length - 1] ?? size;
    if (room > 0) row.h = round2(h + room);
  };
  for (const build of builds) {
    const rows = layersOf(build);
    // Top to bottom, so a box that grew is in place before the boxes under it measure their room.
    const texts = rows
      .filter((row) => rowStr(row, 'kind') === 'text' && plainOfDesignText(rowStr(row, 'text')).trim() !== '' && !asItWas.has(rowStr(row, 'id')))
      .sort((a, b) => rowNum(a, 'y') - rowNum(b, 'y') || rowNum(a, 'x') - rowNum(b, 'x'));
    for (const row of texts) fitRow(rows, row);
  }

  // ─── colour, fonts and the overflow estimate ──────────────────────────────
  //
  // Text on the master's slots and furniture takes the master's ink: the
  // placeholder's `fgTokenPath` already set it when the frame was seeded, and a
  // source colour mapping never writes over it. The plan's mapping reaches what
  // the master does not colour: kept shapes and strokes, a table or chart fill,
  // and a text object whose every run is set in one chromatic colour (emphasis),
  // which takes the mapped accent only while it keeps its contrast against the
  // ground the layer actually sits on. A mapping never reaches an image layer.
  //
  // The row takes the RESOLVED value, because Design draws a colour and not a
  // token path; the PPTX lowering reads the same field and recovers the theme
  // slot from it (`Palette.resolve` in packages/node-shell/src/design-pptx.ts maps
  // both a token path and its resolved value to the same slot).
  const editable = new Set<string>();
  for (const slide of source.slides) {
    for (const object of slide.objects) if (object.fidelity.state === 'editable') editable.add(object.id);
  }
  // A drawing carried as rows takes mappings on the rows it has, whether or not a
  // part of it was left out: those rows are real shapes, not pixels.
  for (const objectId of vectorMade.keys()) editable.add(objectId);
  /** `<layerId>:<field>` to the colour use that wrote it, so no second use overwrites it unsaid. */
  const claimedColour = new Map<string, string>();
  /** Frame rows by layer id, with their index, so the emphasis rule can read the ground under one. */
  const frameOf = new Map<string, { rows: DesignBoxRowV1[]; index: number }>();
  for (const build of builds) {
    const rows = layersOf(build);
    rows.forEach((row, index) => {
      frameOf.set(rowStr(row, 'id'), { rows, index });
    });
  }
  const sameHex = (a: string, b: string): boolean => a.trim().toLowerCase().replace(/^#/, '').slice(0, 6) === b.trim().toLowerCase().replace(/^#/, '').slice(0, 6);

  /** Layer id to the slide its frame or tray row came from, for the ground its colour target comes from. */
  const layerSlide = new Map<string, string>();
  for (const build of builds) for (const row of layersOf(build)) layerSlide.set(rowStr(row, 'id'), build.sourceSlideId);
  const groundOfLayer = (layerId: string): MovedGroundV1 | undefined => {
    const slideId = layerSlide.get(layerId);
    return slideId === undefined ? undefined : slideGround.get(slideId);
  };

  for (const mapping of plan.colors) {
    // The deck's target names the use in the report; a layer on a slide the solve
    // moved takes its own ground's target, or keeps its colour where that ground has none.
    const target = colourTargetOf(mapping, undefined, ds.tokens, theming.themed);
    const anyGround = Object.values(mapping.byGround ?? {}).some((entry) => entry !== undefined && Boolean(entry.to || entry.toPath));
    if (!target && !(anyGround && slideGround.size > 0)) {
      addEntry(report, {
        code: 'colour.unresolved',
        message: `The ${colourNoun(mapping)} has no target that meets its constraints, so the layers it names keep the colour they have.`,
        reason: mapping.unresolved ?? 'no-target',
      });
      continue;
    }
    let touched = 0;
    let masterInk = 0;
    let firstLayer = '';
    /** The target the first written layer took, which the report names. */
    let named = target;
    const conflicts: string[] = [];
    for (const objectId of [...mapping.affects].sort()) {
      if (!editable.has(objectId)) continue;
      for (const layerId of producedBy.get(objectId) ?? []) {
        const row = rowsById.get(layerId);
        if (!row) continue;
        const ground = groundOfLayer(layerId);
        const layerTarget = ground ? colourTargetOf(mapping, ground, ds.tokens, theming.themed) : target;
        // No target on this layer's ground: it keeps the colour it has.
        if (!layerTarget) continue;
        if (vectorRowIds.has(layerId)) {
          // A drawing's row takes a mapping only on the field that holds the mapping's
          // source colour, whatever the use's role: the bars of one chart keep apart
          // and its labels move together, and nothing paints a fill onto a line.
          const isText = rowStr(row, 'kind') === 'text';
          if (isText && mapping.role === 'stroke') continue;
          const field = isText ? 'fg' : mapping.role === 'stroke' ? 'stroke' : 'bg';
          const current = rowStr(row, field);
          if (!current || !sameHex(current, mapping.from)) continue;
          const held = claimedColour.get(`${layerId}:${field}`);
          if (held !== undefined) {
            if (!conflicts.includes(held)) conflicts.push(held);
            continue;
          }
          claimedColour.set(`${layerId}:${field}`, mapping.useId);
          row[field] = withRowAlpha(current, layerTarget);
          touched += 1;
          if (!firstLayer) {
            firstLayer = layerId;
            named = layerTarget;
          }
          continue;
        }
        const field = colourField(row, mapping.role);
        if (!field) continue;
        const bound = masterBound.has(layerId);
        const isText = rowStr(row, 'kind') === 'text';
        if (bound || (isText && field === 'fg')) {
          // The master's ink stands, with one exception: a figure or a quotation set
          // wholly in one chromatic colour keeps that emphasis as the mapped accent,
          // when the accent is itself chromatic and stays readable on every ground
          // under it. A title, a subtitle, body text, a caption and the master's
          // furniture always take the placeholder's ink.
          const sole = EMPHASIS_ROLES.has(rowStr(row, 'role')) && !rowStr(row, 'furniture') ? soleText.get(layerId) : undefined;
          const emphasis = sole && isText && field === 'fg' ? emphasisHex(sole) : undefined;
          const placed = frameOf.get(layerId);
          const grounds = placed ? groundsUnder(placed.rows, placed.index) : undefined;
          if (emphasis && sameHex(emphasis, mapping.from) && isChromatic(layerTarget) && grounds
            && worstContrast(layerTarget, grounds) >= contrastFloor(row)
            && !claimedColour.has(`${layerId}:fg`)) {
            claimedColour.set(`${layerId}:fg`, mapping.useId);
            row.fg = layerTarget;
            touched += 1;
            if (!firstLayer) {
            firstLayer = layerId;
            named = layerTarget;
          }
          } else {
            masterInk += 1;
          }
          continue;
        }
        const held = claimedColour.get(`${layerId}:${field}`);
        if (held !== undefined) {
          // Two uses reaching one field of one row: the first one keeps it and the
          // second says so. Overwriting in silence would leave the report claiming
          // a colour the row does not carry.
          if (!conflicts.includes(held)) conflicts.push(held);
          continue;
        }
        claimedColour.set(`${layerId}:${field}`, mapping.useId);
        row[field] = layerTarget;
        touched += 1;
        if (!firstLayer) {
            firstLayer = layerId;
            named = layerTarget;
          }
      }
    }
    if (touched > 0) {
      const note = conflicts.length > 0
        ? ` ${conflicts.length === 1 ? 'Another colour mapping' : `${conflicts.length} other colour mappings`} already wrote some of the layers it names, which it did not overwrite.`
        : '';
      addEntry(report, {
        code: 'colour.assigned',
        message: `The ${colourNoun(mapping)} was assigned ${named ?? ''} on ${touched} layer(s).${note}`,
        layerId: firstLayer,
        reason: mapping.toPath,
      });
      continue;
    }
    if (masterInk > 0 && conflicts.length === 0) {
      // Every layer it names is text the master sets. That is a settled answer,
      // the design system's own, rather than a colour nobody could place.
      addEntry(report, {
        code: 'colour.assigned',
        message: `The ${colourNoun(mapping)} names text the slide master sets, so the master's own ink stands on ${masterInk} layer(s).`,
        reason: 'master-ink',
      });
      continue;
    }
    // A mapping that resolved and reached nothing is still a decision somebody
    // made, so it is recorded with the reason rather than falling through in
    // silence: a use that says nothing is a use nobody can check. It is recorded
    // as assigned, because the plan did answer it, so `coloursUnresolved` counts
    // only the uses the plan could not answer and a reader of the report or the
    // eval reads the same number the plan states.
    addEntry(report, {
      code: 'colour.assigned',
      message: conflicts.length > 0
        ? `The ${colourNoun(mapping)} resolves to ${named ?? 'no colour on the deck ground'}, and every layer it names already carries a colour from another colour mapping, so nothing was recoloured.`
        : `The ${colourNoun(mapping)} resolves to ${named ?? 'no colour on the deck ground'}, and no editable layer could take it, so nothing was recoloured.`,
      reason: conflicts.length > 0 ? 'claimed-by-another-use' : 'no-editable-layer',
    });
  }

  // The contrast guard. A master states its inks per archetype, and one whose
  // ink does not meet the floor on its own ground (a light number on a light
  // ground) would ship unreadable text. The row then takes the first of the
  // design system's inks that meets the floor, and the report names the master
  // slot once per archetype so the master can be fixed.
  const inkCandidates = [...new Set([
    ...['color.semantic.text', 'color.semantic.surface', 'color.semantic.on-primary', 'color.semantic.muted']
      .map((path) => ds.tokens(path))
      .filter((hex): hex is string => typeof hex === 'string' && /^#[0-9a-fA-F]{6}/.test(hex)),
  ])];
  const reportedGuard = new Set<string>();
  for (const build of builds) {
    const rows = layersOf(build);
    rows.forEach((row, index) => {
      if (rowStr(row, 'kind') !== 'text' || asItWas.has(rowStr(row, 'id'))) return;
      const fg = rowStr(row, 'fg');
      if (!/^#[0-9a-fA-F]{6}/.test(fg)) return;
      const grounds = groundsUnder(rows, index);
      if (!grounds || grounds.length === 0) return;
      const floor = contrastFloor(row);
      const ratio = worstContrast(fg, grounds);
      if (ratio >= floor) return;
      const ranked = inkCandidates
        .map((hex) => ({ hex, ratio: worstContrast(hex, grounds) }))
        .sort((a, b) => b.ratio - a.ratio);
      const meets = ranked.find((one) => one.ratio >= floor);
      const layout = build.archetype.replace(/-/g, ' ');
      const what = layerNoun(row, furnitureKinds);
      const on = grounds.join(' and ');
      const key = `${build.archetype}:${rowStr(row, 'name')}`;
      // A row across two grounds that no ink of the design system can read on
      // both keeps the master's ink and is reported: taking one side's ink would
      // lose the other side, and only the master can move the row.
      const pick = meets ?? (grounds.length > 1 ? undefined : ranked[0]);
      if (!pick) {
        if (reportedGuard.has(key)) return;
        reportedGuard.add(key);
        addEntry(report, {
          code: 'colour.contrast-below-minimum',
          message: `The ${what} in the ${layout} layout runs across ${grounds.length} grounds, ${on}, and no ink of the design system reaches ${floor} to 1 on all of them, so the slide master's ink ${fg} stands. The master should keep the row on one ground.`,
          slideId: build.sourceSlideId,
          layerId: rowStr(row, 'id'),
          reason: 'no-ink-meets-every-ground',
        });
        return;
      }
      if (pick.ratio <= ratio) return;
      row.fg = pick.hex;
      if (reportedGuard.has(key)) return;
      reportedGuard.add(key);
      addEntry(report, {
        code: 'colour.contrast-below-minimum',
        message: `The ${what} ink ${fg} on ${on} in the ${layout} layout is ${round2(ratio)} to 1, under ${floor} to 1, so ${pick.hex} stands in. The slide master states that ink.`,
        slideId: build.sourceSlideId,
        layerId: rowStr(row, 'id'),
        reason: 'master-ink-below-floor',
      });
    });
  }

  // The run ink guard (close-out CP13). A run keeps its own colour inside a text row
  // (emphasis: a mint question mark after white words), and that colour was solved
  // against the deck's ground, not against the panel or the card the row sits on. A
  // run colour under the row's floor on its grounds takes the design system's
  // chromatic colour nearest the source's that meets the floor there, so the emphasis
  // stays; a run with no chromatic source colour, or with no such colour, takes the
  // row's own ink, which the guard above already held to the floor.
  const palette = [...new Set([
    ...Object.values(themeSourceOf(input.designSystem)?.colors ?? {}),
    ...plan.colors.flatMap((mapping) => [mapping.to, ...Object.values(mapping.byGround ?? {}).map((entry) => entry?.to)]),
  ].filter((hex): hex is string => typeof hex === 'string' && /^#?[0-9a-fA-F]{6}$/.test(hex.trim()))
    .map((hex) => `#${hex6(hex)}`))].filter((hex) => isChromatic(hex)).sort(compareCodeUnits);
  /** Source object ids each layer was made from, for the colour a run was mapped from. */
  const madeOf = new Map<string, string[]>();
  for (const [objectId, layerIds] of producedBy) {
    for (const layerId of layerIds) madeOf.set(layerId, [...(madeOf.get(layerId) ?? []), objectId]);
  }
  for (const build of builds) {
    const rows = layersOf(build);
    rows.forEach((row, index) => {
      if (rowStr(row, 'kind') !== 'text' || asItWas.has(rowStr(row, 'id'))) return;
      const text = rowStr(row, 'text');
      if (!text.includes('{#')) return;
      const grounds = groundsUnder(rows, index);
      if (!grounds || grounds.length === 0) return;
      const floor = contrastFloor(row);
      const ink = rowStr(row, 'fg');
      const objects = madeOf.get(rowStr(row, 'id')) ?? [];
      const answer = new Map<string, string>();
      const fixed = text.replace(/\{#([0-9a-fA-F]{6})\|/g, (whole, hex: string) => {
        const run = `#${hex.toLowerCase()}`;
        if (worstContrast(run, grounds) >= floor) return whole;
        let pick = answer.get(run);
        if (pick === undefined) {
          const from = objects.map((id) => mappedFrom.get(`${id}|${run}`)).find((one) => one !== undefined) ?? run;
          const readable = isChromatic(from) ? palette.filter((one) => worstContrast(one, grounds) >= floor) : [];
          pick = nearestColour(from, readable) ?? (/^#[0-9a-fA-F]{6}/.test(ink) ? ink.slice(0, 7).toLowerCase() : run);
          answer.set(run, pick);
        }
        return `{${pick}|`;
      });
      if (fixed !== text) row.text = fixed;
    });
  }

  const sourceFamilies = new Set(source.fonts.map((font) => font.family));
  for (const mapping of plan.fonts) {
    const named = new Set<string>();
    for (const slide of source.slides) {
      for (const object of slide.objects) {
        for (const para of object.text?.paras ?? []) {
          for (const run of para.runs) if (run.font === mapping.from) named.add(object.id);
        }
      }
    }
    let written = 0;
    for (const objectId of [...named].sort()) {
      for (const layerId of producedBy.get(objectId) ?? []) {
        const row = rowsById.get(layerId);
        // The face itself is written once below, for every text row (close-out 9.2):
        // this counts the layers the mapping reaches, for the report. A role-bound
        // layer takes the master's own slot, which is the design system's answer too.
        if (!row || rowStr(row, 'kind') !== 'text' || masterBound.has(layerId)) continue;
        written += 1;
      }
    }
    if (written > 0) {
      addEntry(report, {
        code: 'text.font-substituted',
        message: `${mapping.to} takes the place of ${mapping.from} on ${written} layer(s).`,
        reason: mapping.source,
      });
    } else if (named.size > 0 || sourceFamilies.has(mapping.from)) {
      // The family is gone from the deck all the same, because the layers that
      // carried it sit in the master's own slots. Saying it was written on a layer
      // would state a change that did not happen.
      addEntry(report, {
        code: 'text.font-substituted',
        message: `${mapping.to} is the design system's answer for ${mapping.from}, and the layers that carried ${mapping.from} take the master's own font slot, so no layer states a family of its own.`,
        reason: mapping.source,
      });
    }
  }

  // The design system's face on every text (close-out 9.2). A renovated frame is set
  // wholly in the design system: every text row states no family, which Design reads
  // as the brand face, or `mono` where every run of its source object is set in a
  // code face and the design system states a mono face. No source family, a chart's
  // own SVG family included, reaches a renovated row. The font mappings above already
  // say what changed, so this adds nothing to the report.
  const faces = {
    brand: opts.faces?.brand ?? input.designSystem.fonts?.minor ?? input.designSystem.fonts?.major ?? FALLBACK_BRAND_FACE,
    ...(opts.faces?.mono ? { mono: opts.faces.mono } : {}),
  };
  const isCode = codeFamilies(plan, faces);
  const objectById = new Map<string, SourceObjectV1>();
  for (const slide of source.slides) for (const object of slide.objects) objectById.set(object.id, object);
  /** Layer id to the source objects with words it was made from: a slot can take several. */
  const madeFrom = new Map<string, SourceObjectV1[]>();
  for (const [objectId, layerIds] of producedBy) {
    const object = objectById.get(objectId);
    if (!object || !hasWords(object)) continue;
    for (const layerId of layerIds) madeFrom.set(layerId, [...(madeFrom.get(layerId) ?? []), object]);
  }
  for (const row of [...builds.flatMap((build) => layersOf(build)), ...tray.map((item) => item.layer)]) {
    if (rowStr(row, 'kind') !== 'text') continue;
    const objects = madeFrom.get(rowStr(row, 'id'));
    const stated = rowStr(row, 'font').trim();
    const code = objects
      ? objects.every((object) => isCodeObject(object, isCode))
      : stated === 'mono' ? faces.mono !== undefined : isCode(stated || undefined);
    if (code) row.font = 'mono';
    else delete row.font;
  }

  const overflowWhere = (slideId: string, inTray: boolean): string => {
    const found = slideById.get(slideId);
    const where = found ? ` from slide ${found.index + 1}` : '';
    return inTray ? `${where} waiting in the tray` : found ? ` on slide ${found.index + 1}` : '';
  };

  // The tray is measured too. Its rows are the content that fit no slot, which is
  // often the longest text in the deck, so leaving them out would exempt exactly
  // the rows most likely to run past their box.
  const measurable: Array<{ row: DesignBoxRowV1; slideId: string; inTray: boolean }> = [];
  for (const build of builds) {
    for (const row of layersOf(build)) measurable.push({ row, slideId: build.sourceSlideId, inTray: false });
  }
  for (const item of tray) {
    measurable.push({ row: item.layer, slideId: traySlide.get(rowStr(item.layer, 'id')) ?? '', inTray: true });
  }
  for (const { row, slideId, inTray } of measurable) {
    if (rowStr(row, 'kind') !== 'text') continue;
    // The measure reads the words Design draws, never the markup around them.
    if (!plainOfDesignText(rowStr(row, 'text')).trim() || !(rowNum(row, 'h') > 0)) continue;
    const fit = designTextFit(row);
    if (fit.needed <= rowNum(row, 'h') + 0.5) continue;
    const cut = Math.max(1, fit.wordsCut);
    const role = rowStr(row, 'role');
    const floor = rowStr(row, 'furniture') ? undefined : roleFloor.get(role === 'visual' || role === 'data' ? 'body' : role);
    const why = floor !== undefined && rowNum(row, 'fontSize') <= floor
      ? ` at ${round2(rowNum(row, 'fontSize'))} px, the smallest size the slide master sets for it, with no room under it in the layout`
      : '';
    addEntry(report, {
      code: 'text.overflow',
      message: `The ${layerNoun(row, furnitureKinds)}${overflowWhere(slideId, inTray)} does not fit its box${why}: ${cut === 1 ? '1 word is' : `${cut} words are`} cut. It needs ${round2(fit.needed)} px and the box is ${round2(rowNum(row, 'h'))} px. This is an estimate from an average glyph width, not shaped text.`,
      ...(slideId ? { slideId } : {}),
      layerId: rowStr(row, 'id'),
      reason: 'estimate',
    });
  }

  const frames: CompiledFrameV1[] = builds.map((build) => {
    const frame: CompiledFrameV1 = {
      id: build.frameId,
      sourceSlideId: build.sourceSlideId,
      name: build.name,
      width: frameW,
      height: frameH,
      archetype: build.archetype,
      masterId: master.id,
      layers: layersOf(build),
      furnitureLayerIds: [...build.furnitureLayerIds],
      placeholderLayerIds: [...build.placeholderLayerIds],
    };
    const notes = build.rows[0] ? rowStr(build.rows[0], 'notes') : '';
    if (notes) frame.notes = notes;
    if (build.continuation) frame.continuation = true;
    return frame;
  });

  setSlideCounts(report, {
    source: source.slides.length,
    included: frames.length - continuationCount,
    excluded,
    continuation: continuationCount,
  });
  addEntry(report, { code: 'export.not-verified' });
  finalizeReport(report, objectIds);

  forward.sort((a, b) => (a.sourceObjectId < b.sourceObjectId ? -1 : a.sourceObjectId > b.sourceObjectId ? 1 : 0));
  backward.sort((a, b) => (a.layerId < b.layerId ? -1 : a.layerId > b.layerId ? 1 : 0));

  return {
    version: 1,
    source: {
      lineageId: source.source.lineageId,
      hash: source.source.hash,
      instanceId: source.source.instanceId,
    },
    planRevision: plan.revision,
    designSystem: ds.snapshot,
    algorithms: opts.algorithms ?? { ...plan.algorithms, compile: DECK_RENOVATE_VERSION },
    frames,
    tray,
    lineage: { forward, backward },
    report,
  };
}
