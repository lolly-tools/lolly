// SPDX-License-Identifier: MPL-2.0
/**
 * Stage 1 of the renovation journey for a PowerPoint package (plan 274 section
 * 3.1): an inflated part map in, a `SourceDeckV1` out.
 *
 * The engine's `readPptx` does the parsing. This adapter does the four things
 * the engine cannot do and should not learn:
 *
 *   1. It names things. A slide id is its part path, an object id is that path
 *      plus the object's z-order position, and both are permanent for this
 *      source, so a decision made about an object can be found again.
 *   2. It converts EMU to the reference pixel space every source adapter shares
 *      (96 dpi, `REBRAND_REFERENCE_DPI`), so a pdf and a pptx can be reviewed
 *      side by side.
 *   3. It stores media through a caller-supplied sink, ONCE per distinct byte
 *      sequence. The same partner mark on forty slides is one asset ref, because
 *      the ref is keyed by the exact content hash and the adapter remembers what
 *      it already sent.
 *   4. It states a fidelity fact for every object: what the reader modelled is
 *      `editable`, a picture whose bytes are held is `raster-preserved`, an
 *      object the reader has no model for is `raster-preserved` when the package
 *      itself carries a fallback picture and `unavailable` when it does not. An
 *      `unavailable` object is never described as a picture of the source.
 *
 * This lives in node-shell rather than the engine because it hashes bytes and
 * awaits a sink. It is still DOM-free: the XML parser arrives injected, exactly
 * as `readPptx` takes one, so the web shell passes its native `DOMParser` and a
 * terminal passes a jsdom one.
 *
 * Known limits, stated rather than hidden:
 *
 *   - `readPptx` does not report a shape's `p:cNvPr@id`, so an object id uses
 *     its z-order position within the slide. Two reads of the same bytes agree;
 *     a read of an edited deck may not, which is why a decision is remembered
 *     against `fingerprint` as well as against the id.
 *   - `readPptx` merges the master's furniture with the layout's into one list
 *     without saying where the boundary falls, so every inherited object is
 *     recorded with `origin: 'master'`. The contract's `layout` origin is
 *     therefore unused by this adapter, and a census that reads origin as
 *     evidence must not conclude a decoration was declared on the master.
 *   - A slide's narration clip is not carried. The slide records a
 *     `media-skipped` warning naming the part instead, so the loss is visible.
 *
 * Vectors (plan 275 decision 32). A picture that carries an SVG beside its raster
 * (the Office 2016 `svgBlip` extension) is a `vector`: the raster is stored as its
 * media, the one a person can always fall back to, the SVG text is kept as the
 * archive copy in `vector`, and `svgItemsOf` reads its structure into
 * `vectorItems` for the compile to place as editable rows. A shape drawn with
 * custom geometry keeps its kind and gains `vectorItems` from its paths. Both are
 * bounded per object by the itemiser and per deck by `VECTOR_DECK_ITEMS_MAX`,
 * past which an object stays a picture and the deck warns
 * `vector-budget-reached`. A Windows metafile stays a picture with a
 * `metafile-not-converted` warning naming the part. The fingerprint of a vector
 * is its kind and its SVG's hash, so the same drawing on two slides is one group;
 * that also means a deck read before this change fingerprints these objects
 * differently, which carry-forward has to expect.
 *
 * Outlined labels (plan 275 section 9.3). A chart tool that outlines its text leaves
 * its labels as glyph paths. With `labelReader` (a line recogniser, never one that
 * downloads: `labelReaderFromOcr` adapts the runner a flattened rebuild already
 * takes), each SVG's glyph runs are read once and the ones that read well become
 * text items in the design system's face at compile time; the rest stay drawn.
 * Without one every run stays drawn. `onVectorLabels` says how many of each, and
 * `readDeckVectorLabels` reads a deck read without a recogniser once one is present.
 */

import { sha256Hex } from '../../../../engine/src/bytes.ts';
import { cropVectorItems, custGeomItems, glyphRunsOf, MAX_VECTOR_ROWS_PER_OBJECT, svgItemsOf, svgLabelHintsOf } from '../../../../engine/src/svg-items.ts';
import { readVectorLabels, type VectorLabelReaderV1, type VectorLabelReadingV1 } from '../../../../engine/src/vector-text.ts';
import type { SlideRegionV1 } from '../../../../engine/src/slide-regions.ts';
import type { OcrFrame, OcrLine } from '@lolly-tools/core/host-v1';
import {
  readPptx,
  readingOrder,
  type PptxDeckRead,
  type PptxParts,
  type PptxReadColor,
  type PptxReadNode,
  type PptxReadPara,
  type PptxReadWarningCode,
  type XmlParser,
} from '../../../../engine/src/pptx-read.ts';
import type {
  BoxV1,
  FidelityReasonV1,
  FidelityV1,
  PlaceholderTypeV1,
  SlideSourceV1,
  SourceColorV1,
  SourceDeckV1,
  SourceObjectKindV1,
  SourceObjectV1,
  SourceParaV1,
  SourceRunV1,
  SourceWarningCodeV1,
  SourceWarningV1,
  VectorItemsV1,
} from '@lolly-tools/core';
import { PLACEHOLDER_TYPES, REBRAND_REFERENCE_DPI, VECTOR_DECK_ITEMS_MAX } from '@lolly-tools/core';

/** English Metric Units per reference pixel: 914400 EMU per inch over 96 dpi. */
const EMU_PER_PX = 914400 / REBRAND_REFERENCE_DPI;

/** Media larger than this is not stored, and its object says so rather than pretending. */
const DEFAULT_MAX_MEDIA_BYTES = 64 * 1024 * 1024;

/** A slide whose only object is a picture covering at least this share of it is a flattened page. */
const FLATTENED_AREA_SHARE = 0.9;

/** The schema's ceiling on one object's inline SVG copy (`vector`), in characters. */
const MAX_VECTOR_CHARS = 4 * 1024 * 1024;

/** Inline SVG copies summed over one deck. Past it an object keeps its items and its picture, and no archive copy. */
const DEFAULT_MAX_DECK_VECTOR_CHARS = 16 * 1024 * 1024;

/** Object ids one budget warning names at most. */
const MAX_WARNING_IDS = 100;

/** Label readings one deck asks for at most. Past it the rest of the deck's outlined labels stay drawn. */
const MAX_DECK_LABEL_READS = 4000;

/** A reader that answers nothing once it has been asked `limit` times, so a deck of many drawings stays bounded. */
function boundedReader(reader: VectorLabelReaderV1, limit = MAX_DECK_LABEL_READS): VectorLabelReaderV1 {
  let asked = 0;
  return async (frame) => {
    asked += 1;
    return asked > limit ? null : reader(frame);
  };
}

/**
 * Stores one media file and returns a stable asset ref for it. The adapter calls
 * this at most once per distinct byte sequence, so a sink may assume every call
 * carries content it has not seen in this read.
 */
export type MediaSinkV1 = (bytes: Uint8Array, mime: string, hint: string) => Promise<string>;

export interface SourcePptxOptsV1 {
  /** `sha256:<hex>` of the source bytes. The caller hashes the file it read. */
  hash: string;
  /** Separates two imports of the same bytes. */
  instanceId: string;
  /** The file name the person chose, when there is one. */
  name?: string;
  /** Size of the source file in bytes, when the caller knows it. */
  bytes?: number;
  /** Where media goes. */
  sink: MediaSinkV1;
  /** Parser identity, recorded for replay. */
  reader: { name: string; version: string };
  /** Media over this many bytes is left unstored and its object reports `media-too-large`. */
  maxMediaBytes?: number;
  /** Characters of inline SVG (`vector`) kept over the whole deck. Defaults to 16 MiB. */
  maxDeckVectorChars?: number;
  /**
   * Called once when the slide count is known, with `done` 0, and again after each
   * slide is read. Counts, so a caller can say "Reading slide 8 of 40".
   */
  onSlide?: (done: number, total: number) => void;
  /**
   * Checked between slides. An aborted signal stops the read with the signal's own
   * reason, so no half-read deck is returned.
   */
  signal?: AbortSignal;
  /**
   * Reads a chart's outlined labels into text (plan 275 section 9.3). Absent: every
   * outlined label stays drawn, and `onVectorLabels` still counts them.
   */
  labelReader?: VectorLabelReaderV1;
  /** Called once, after the read, with how many outlined labels became text and how many stayed drawn. */
  onVectorLabels?: (summary: VectorLabelSummaryV1) => void;
}

/** Outlined labels over a deck's drawings, counted once per object that shows them. */
export interface VectorLabelSummaryV1 {
  /** Glyph runs found in the drawings that stay editable. */
  runs: number;
  /** Runs written as text. */
  text: number;
  /** Runs that stayed drawn. */
  drawn: number;
  /** Whether a recogniser was there to read them. */
  read: boolean;
}

/** A line recogniser's lines, left to right, as one reading at the least confidence of its lines. */
function readingOf(lines: readonly OcrLine[]): VectorLabelReadingV1 | null {
  const found = lines.filter((line) => line.text.trim()).sort((a, b) => a.box.x - b.box.x);
  if (!found.length) return null;
  return { text: found.map((line) => line.text.trim()).join(' '), confidence: Math.min(...found.map((line) => line.confidence)) };
}

/**
 * The recogniser a flattened rebuild takes (`FlattenedOcrV1`, `nodeFlattenedOcr` in
 * `ocr-node.ts`), as a label reader: it is handed the whole label picture as one text
 * region and its lines are joined left to right. It loads what it was given and
 * downloads nothing.
 */
export function labelReaderFromOcr(ocr: (frame: OcrFrame, region: SlideRegionV1) => Promise<OcrLine[]>): VectorLabelReaderV1 {
  return async (frame) => {
    const region: SlideRegionV1 = {
      id: 'label',
      kind: 'text',
      box: { x: 0, y: 0, w: frame.width, h: frame.height },
      depth: 0,
      evidence: {
        reason: 'single-line', components: 0, rows: 1, inRowShare: 1, lineHeight: frame.height, inkShare: 0,
        dominantShare: 1, distinctColours: 1, otherColourShare: 0, samples: 0, aspect: frame.width / Math.max(1, frame.height),
        ink: '#000000', ground: '#ffffff',
      },
    };
    return readingOf(await ocr(frame, region));
  };
}

/** Runs still drawn, and runs the reading turned into text, for one object's items. */
function labelCounts(items: VectorItemsV1 | undefined, nativeText: number): { text: number; drawn: number } {
  if (!items || items.items.length === 0) return { text: 0, drawn: 0 };
  const text = Math.max(0, items.items.filter((item) => item.kind === 'text').length - nativeText);
  return { text, drawn: glyphRunsOf(items).length };
}

// ─── small XML helpers (the part map holds relationship parts the reader keeps to itself) ──

function textOf(parts: PptxParts, path: string): string | null {
  const raw = parts[path];
  if (raw === undefined) return null;
  return typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
}

function bytesOf(parts: PptxParts, path: string): Uint8Array | null {
  const raw = parts[path];
  if (raw === undefined) return null;
  return typeof raw === 'string' ? new TextEncoder().encode(raw) : raw;
}

function elementsByLocal(root: Document | Element, local: string): Element[] {
  const out: Element[] = [];
  for (const el of Array.from(root.getElementsByTagName('*'))) {
    if (el.localName === local) out.push(el);
  }
  return out;
}

/** Direct element children with this local name, in document order. */
function childrenByLocal(el: Element, local: string): Element[] {
  const out: Element[] = [];
  for (const child of Array.from(el.children)) {
    if (child.localName === local) out.push(child);
  }
  return out;
}

/**
 * The RELATIONSHIP id an element states, by the same rule `readPptx` applies: a
 * prefixed `:id` attribute, never the plain `id`, which on a `p:sldId` is the
 * presentation's own numbering and resolves to no relationship.
 */
function relIdOf(el: Element): string | null {
  for (const attr of Array.from(el.attributes)) {
    const full = attr.name || '';
    if (full === 'r:id' || (full.endsWith(':id') && full !== 'id')) return attr.value;
  }
  return null;
}

/** Resolve a relationship target against the part that declared it. */
function resolveTarget(fromPart: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const dir = fromPart.slice(0, fromPart.lastIndexOf('/'));
  const segments = dir.split('/').filter(Boolean);
  for (const piece of target.split('/')) {
    if (piece === '' || piece === '.') continue;
    if (piece === '..') segments.pop();
    else segments.push(piece);
  }
  return segments.join('/');
}

function relsPathOf(part: string): string {
  const cut = part.lastIndexOf('/');
  return `${part.slice(0, cut)}/_rels/${part.slice(cut + 1)}.rels`;
}

interface RelEntry {
  id: string;
  type: string;
  target: string;
  external: boolean;
}

function readRels(parts: PptxParts, part: string, parseXml: XmlParser): RelEntry[] {
  const xml = textOf(parts, relsPathOf(part));
  if (!xml) return [];
  try {
    const doc = parseXml(xml);
    return elementsByLocal(doc, 'Relationship').map((el) => ({
      id: el.getAttribute('Id') ?? '',
      type: el.getAttribute('Type') ?? '',
      target: el.getAttribute('Target') ?? '',
      external: (el.getAttribute('TargetMode') ?? '').toLowerCase() === 'external',
    }));
  } catch {
    return [];
  }
}

/**
 * Slide part paths in presentation order, which is what `readPptx` walks but
 * does not report. Falls back to the numeric order of `ppt/slides/slideN.xml`
 * when the presentation part or its relationships cannot be read.
 *
 * The rule matches `readPptx`'s own walk: the FIRST `p:sldIdLst`, its direct
 * `p:sldId` children, and the prefixed relationship id on each. Two lists that
 * disagree would shift every slide id by one, so there is one rule, not two.
 */
function slidePartsInOrder(parts: PptxParts, parseXml: XmlParser): string[] {
  const numeric = Object.keys(parts)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/(\d+)/)?.[1] ?? 0) - Number(b.match(/(\d+)/)?.[1] ?? 0));
  const xml = textOf(parts, 'ppt/presentation.xml');
  if (!xml) return numeric;
  try {
    const doc = parseXml(xml);
    const rels = new Map(readRels(parts, 'ppt/presentation.xml', parseXml).map((r) => [r.id, r]));
    const ordered: string[] = [];
    const list = elementsByLocal(doc, 'sldIdLst')[0];
    for (const sldId of list ? childrenByLocal(list, 'sldId') : []) {
      const rid = relIdOf(sldId);
      const rel = rid ? rels.get(rid) : undefined;
      if (rel && !rel.external) ordered.push(resolveTarget('ppt/presentation.xml', rel.target));
    }
    return ordered.length > 0 ? ordered : numeric;
  } catch {
    return numeric;
  }
}

/** The layout and master parts a slide inherits from, by name. */
function lineageParts(parts: PptxParts, slidePart: string, parseXml: XmlParser): { layout?: string; master?: string } {
  const layoutRel = readRels(parts, slidePart, parseXml).find((r) => /slideLayout$/i.test(r.type) && !r.external);
  if (!layoutRel) return {};
  const layout = resolveTarget(slidePart, layoutRel.target);
  const masterRel = readRels(parts, layout, parseXml).find((r) => /slideMaster$/i.test(r.type) && !r.external);
  const master = masterRel && !masterRel.external ? resolveTarget(layout, masterRel.target) : undefined;
  return master ? { layout, master } : { layout };
}

// ─── conversions ─────────────────────────────────────────────────────────────

function px(emu: number | undefined): number {
  const n = typeof emu === 'number' && Number.isFinite(emu) ? emu : 0;
  return Math.round((n / EMU_PER_PX) * 100) / 100;
}

function boxOf(node: PptxReadNode): BoxV1 {
  return { x: px(node.xEmu), y: px(node.yEmu), w: px(node.cxEmu), h: px(node.cyEmu), rot: node.rot ?? 0 };
}

/** The affine in reference px, when the reader stated one because the box is an approximation. */
function transformOf(node: PptxReadNode): number[] | undefined {
  const t = node.transform;
  if (!t) return undefined;
  return [t[0], t[1], t[2], t[3], Math.round((t[4] / EMU_PER_PX) * 100) / 100, Math.round((t[5] / EMU_PER_PX) * 100) / 100];
}

function colorOf(color: PptxReadColor | undefined): SourceColorV1 | undefined {
  if (!color) return undefined;
  const out: SourceColorV1 = {};
  if ('scheme' in color && color.scheme) out.scheme = color.scheme;
  if (color.hex && /^[0-9a-fA-F]{6}$/.test(color.hex)) out.hex = `#${color.hex}`;
  if (out.scheme === undefined && out.hex === undefined) return undefined;
  if (typeof color.alpha === 'number' && color.alpha >= 0 && color.alpha < 1) out.alpha = color.alpha;
  return out;
}

/** Every spelling Office writes after a caption it generated, in full. A truncated tail is a prefix of one of these. */
const OFFICE_ALT_TAILS = [
  'description automatically generated with low confidence',
  'description automatically generated with medium confidence',
  'description automatically generated with high confidence',
  'description automatically generated',
] as const;

/**
 * Alt text with Office's own boilerplate taken off. PowerPoint writes "Description
 * automatically generated" (sometimes cut short, "Description automatic") after a
 * caption it made up; that line says nothing about the picture, so it goes, and
 * what a person wrote is kept as they wrote it. Undefined when nothing else is left.
 */
export function cleanAlt(alt: string | undefined): string | undefined {
  if (!alt) return undefined;
  let text = alt;
  const at = text.search(/description\s+automatic/i);
  if (at >= 0) {
    const tail = text.slice(at).replace(/\s+/g, ' ').replace(/[\s.]+$/, '').toLowerCase();
    if (OFFICE_ALT_TAILS.some((whole) => whole.startsWith(tail))) text = text.slice(0, at);
  }
  const trimmed = text.replace(/[\s,;:]+$/, '').trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

const PLACEHOLDER_SET = new Set<string>(PLACEHOLDER_TYPES);

function placeholderOf(type: string | undefined): PlaceholderTypeV1 | undefined {
  return type && PLACEHOLDER_SET.has(type) ? (type as PlaceholderTypeV1) : undefined;
}

/** A style token the source contract carries (an underline kind, a numbering scheme): letters only. */
const STYLE_TOKEN = /^[A-Za-z]{1,32}$/;

/** The line spacing ceiling the source contract states, in percent of single. */
const MAX_LINE_SPACING_PCT = 10_000;

function parasOf(paras: PptxReadPara[] | undefined): SourceParaV1[] {
  return (paras ?? []).map((para) => {
    const out: SourceParaV1 = {
      runs: para.runs.map((run) => {
        const item: SourceRunV1 = { text: run.text };
        if (run.bold) item.bold = true;
        if (run.italic) item.italic = true;
        if (run.underline) {
          item.underline = true;
          if (run.underlineStyle && STYLE_TOKEN.test(run.underlineStyle)) item.underlineStyle = run.underlineStyle;
        }
        if (run.strike) item.strike = true;
        if (run.baseline) item.baseline = run.baseline;
        if (run.cap === 'all') item.case = 'upper';
        else if (run.cap === 'small') item.case = 'small-caps';
        if (typeof run.sizePt === 'number') item.sizePt = run.sizePt;
        if (run.font) {
          item.font = run.font;
          item.fontProvenance = run.font.startsWith('+') ? 'theme' : 'literal';
        }
        const color = colorOf(run.color);
        if (color) item.color = color;
        if (run.href) item.href = run.href;
        return item;
      }),
    };
    if (typeof para.lvl === 'number' && para.lvl > 0) out.lvl = para.lvl;
    // Paragraph formatting the reader resolved through the master's cascade (plan 275
    // section 7.2). Only what a layer stated is written, so a paragraph nobody styled
    // reads the same as before.
    if (para.bullet) out.bullet = para.bullet;
    if (para.bullet === 'bullet' && para.bulletChar) out.bulletChar = para.bulletChar;
    if (para.bullet === 'number') {
      if (para.numberStyle && STYLE_TOKEN.test(para.numberStyle)) out.numberStyle = para.numberStyle;
      if (typeof para.numberStart === 'number') out.numberStart = para.numberStart;
    }
    if (para.align) out.align = para.align;
    if (typeof para.spaceBeforePt === 'number') out.spaceBeforePt = para.spaceBeforePt;
    if (typeof para.spaceAfterPt === 'number') out.spaceAfterPt = para.spaceAfterPt;
    if (typeof para.lineSpacingPct === 'number') out.lineSpacingPct = Math.min(MAX_LINE_SPACING_PCT, para.lineSpacingPct);
    if (typeof para.marginLeftEmu === 'number') out.indentPx = px(para.marginLeftEmu);
    if (typeof para.indentEmu === 'number') out.firstIndentPx = px(para.indentEmu);
    return out;
  });
}

/** The family a run names, with a theme token resolved through the deck's theme. */
function familyOf(font: string, theme: PptxDeckRead['theme']): string {
  if (font === '+mj-lt' || font === '+mj-ea' || font === '+mj-cs') return theme.majorFont ?? font;
  if (font === '+mn-lt' || font === '+mn-ea' || font === '+mn-cs') return theme.minorFont ?? font;
  return font;
}

const WARNING_CODE_MAP: Record<PptxReadWarningCode, SourceWarningCodeV1> = {
  'nodes-truncated': 'nodes-truncated',
  'slides-truncated': 'slides-truncated',
  'part-too-large': 'part-too-large',
  'media-skipped': 'media-skipped',
  'group-depth-exceeded': 'group-transform-approximated',
};

// ─── kinds and fidelity ──────────────────────────────────────────────────────

/** What an unmodelled object announces itself as, read off its graphicData tag. */
type UnknownFamily = 'chart' | 'smartart' | 'ole' | 'other';

function unknownFamily(tag: string | undefined): UnknownFamily {
  const t = (tag ?? '').toLowerCase();
  if (t.includes('chart')) return 'chart';
  if (t.includes('diagram') || t.includes('smartart')) return 'smartart';
  if (t.includes('ole')) return 'ole';
  return 'other';
}

function unavailableReason(family: UnknownFamily): FidelityReasonV1 {
  switch (family) {
    case 'chart':
      return 'native-chart-no-fallback';
    case 'smartart':
      return 'smartart-no-fallback';
    case 'ole':
      return 'ole-no-fallback';
    default:
      return 'unsupported-media-format';
  }
}

function kindOf(node: PptxReadNode): SourceObjectKindV1 {
  switch (node.type) {
    case 'text':
      return 'text';
    case 'shape':
      return 'shape';
    case 'pic':
      return 'pic';
    case 'table':
      return 'table';
    default:
      return unknownFamily(node.tag) === 'chart' ? 'chart' : 'unknown';
  }
}

const MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  webp: 'image/webp',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  svg: 'image/svg+xml',
  emf: 'image/x-emf',
  wmf: 'image/x-wmf',
};

function mimeOf(part: string): string {
  const ext = part.slice(part.lastIndexOf('.') + 1).toLowerCase();
  return MIME_BY_EXTENSION[ext] ?? 'application/octet-stream';
}

/**
 * The content fingerprint: kind, a coarse geometry class and the object's own
 * material - its text, its cell grid, the content hash of its bytes, its
 * geometry and colours, or its chart series. Coarse in GEOMETRY on purpose,
 * because the same element is placed a few pixels apart from slide to slide and
 * a decision about it should still be found; never coarse in material, because
 * a decision carried by fingerprint would then land on a different object.
 * Identity is the id, never this.
 */
async function fingerprintOf(kind: SourceObjectKindV1, box: BoxV1, content: string): Promise<string> {
  const grid = (n: number): number => Math.round(n / 8) * 8;
  const material = `${kind}|${grid(box.x)},${grid(box.y)},${grid(box.w)},${grid(box.h)}|${content}`;
  return `${kind}:${(await sha256Hex(new TextEncoder().encode(material))).slice(0, 16)}`;
}

/** A colour as one comparable token, keeping the slot beside the hex. */
function colorToken(color: SourceColorV1 | undefined): string {
  return color ? `${color.scheme ?? ''}:${color.hex ?? ''}` : '';
}

/** A shape's own material: its preset geometry, its fill and its outline. */
function shapeMaterial(object: SourceObjectV1): string {
  return [
    object.geom ?? '',
    colorToken(object.fill),
    colorToken(object.line?.color),
    object.line?.widthPt === undefined ? '' : String(object.line.widthPt),
  ].join('|');
}

/** A native chart's material: its tag, its type, its categories and its series. */
function chartMaterial(tag: string, data: SourceObjectV1['chartData']): string {
  if (!data) return tag;
  const series = (data.series ?? []).map((s) => `${s.name ?? ''}=${s.values.join(',')}`).join(';');
  return `${tag}|${data.type ?? ''}|${(data.categories ?? []).join(',')}|${series}`;
}

/**
 * True when the box, its rotation and one mirror can restate this affine
 * exactly. `readPptx` states a `transform` whenever a group composes a turn or a
 * mirror onto a child, which the pose usually describes in full; it is only when
 * the group's own scale differs between the axes, or shears the child, that the
 * axis-aligned box becomes an approximation of the object's real placement.
 */
function poseRestatesTransform(t: readonly number[]): boolean {
  const a = t[0] ?? 1;
  const b = t[1] ?? 0;
  const c = t[2] ?? 0;
  const d = t[3] ?? 1;
  const tol = 1e-6;
  return (
    Math.abs(Math.hypot(a, b) - 1) < tol && Math.abs(Math.hypot(c, d) - 1) < tol && Math.abs(a * c + b * d) < tol
  );
}

// ─── the adapter ─────────────────────────────────────────────────────────────

/** How long the slide loop runs before it hands the host a turn. */
const YIELD_EVERY_MS = 12;

/** One macrotask, so the host can run a queued event (a cancel click) and paint. */
function yieldToHost(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

interface MediaResult {
  ref?: string;
  mime: string;
  /** The sha256 of the stored bytes. The fingerprint reads THIS, never the sink's ref, so
   * two surfaces with different ref schemes still fingerprint the same picture alike. */
  hash?: string;
  reason?: FidelityReasonV1;
}

/**
 * Read an inflated pptx package into the stage-1 source model.
 *
 * Every picture the package holds goes through `opts.sink` once per distinct
 * byte sequence, so an asset ref identifies content and not a part path.
 */
export async function sourceDeckFromPptx(
  parts: PptxParts,
  parseXml: XmlParser,
  opts: SourcePptxOptsV1,
): Promise<SourceDeckV1> {
  opts.signal?.throwIfAborted();
  const deck = readPptx(parts, parseXml);
  // `readPptx` parses the whole package in one synchronous pass, so a cancel pressed
  // meanwhile is only seen once the host has had a turn.
  await yieldToHost();
  opts.signal?.throwIfAborted();
  let lastYield = Date.now();
  const slidePaths = slidePartsInOrder(parts, parseXml);
  const maxMedia = opts.maxMediaBytes ?? DEFAULT_MAX_MEDIA_BYTES;

  // One entry per media PART, holding what happened to it, and one per content
  // hash, holding the ref the sink gave back. The second map is what makes the
  // same mark on every slide a single asset.
  const byPart = new Map<string, MediaResult>();
  const byHash = new Map<string, string>();

  const store = async (part: string): Promise<MediaResult> => {
    const cached = byPart.get(part);
    if (cached) return cached;
    const mime = mimeOf(part);
    const bytes = bytesOf(parts, part);
    let result: MediaResult;
    if (!bytes) {
      result = { mime, reason: 'media-missing' };
    } else if (bytes.byteLength > maxMedia) {
      result = { mime, reason: 'media-too-large' };
    } else {
      const hash = await sha256Hex(bytes);
      const known = byHash.get(hash);
      if (known) {
        result = { ref: known, mime, hash };
      } else {
        const ref = await opts.sink(bytes, mime, hash);
        byHash.set(hash, ref);
        result = { ref, mime, hash };
      }
    }
    byPart.set(part, result);
    return result;
  };

  const deckWarnings: SourceWarningV1[] = [];
  const slideWarnings = new Map<number, SourceWarningV1[]>();

  // Vectors (plan 275 decision 32): one reading per distinct SVG, a deck-wide item
  // budget, and a cap on the archive copies kept inline.
  const itemsByHash = new Map<string, VectorItemsV1>();
  /** Text items each SVG states itself, so labels read into text are told apart from them. */
  const nativeTextByHash = new Map<string, number>();
  /** Readings by glyph run, shared over the deck: the same tick on every chart is read once. */
  const labelCache = new Map<string, VectorLabelReadingV1 | null>();
  const labels: VectorLabelSummaryV1 = { runs: 0, text: 0, drawn: 0, read: opts.labelReader !== undefined };
  const labelReader = opts.labelReader ? boundedReader(opts.labelReader) : undefined;
  const maxDeckVectorChars = opts.maxDeckVectorChars ?? DEFAULT_MAX_DECK_VECTOR_CHARS;
  let deckItems = 0;
  let deckVectorChars = 0;
  const overBudget: string[] = [];
  /** Items under the deck budget, or undefined with the object recorded as over it. */
  const withinBudget = (objectId: string, items: VectorItemsV1): boolean => {
    if (items.items.length === 0) return true;
    if (deckItems + items.items.length > VECTOR_DECK_ITEMS_MAX) {
      overBudget.push(objectId);
      return false;
    }
    deckItems += items.items.length;
    return true;
  };
  for (const warning of deck.warnings ?? []) {
    const mapped: SourceWarningV1 = { code: WARNING_CODE_MAP[warning.code], message: warning.message };
    if (typeof warning.count === 'number') mapped.count = warning.count;
    if (typeof warning.slideIndex === 'number') {
      const list = slideWarnings.get(warning.slideIndex) ?? [];
      list.push(mapped);
      slideWarnings.set(warning.slideIndex, list);
    } else {
      deckWarnings.push(mapped);
    }
  }

  const fontRuns = new Map<string, { family: string; provenance: 'theme' | 'literal'; runs: number }>();
  const countFont = (font: string | undefined): void => {
    if (!font) return;
    const provenance = font.startsWith('+') ? 'theme' : 'literal';
    const family = familyOf(font, deck.theme);
    const key = `${provenance}:${family}`;
    const entry = fontRuns.get(key) ?? { family, provenance, runs: 0 };
    entry.runs += 1;
    fontRuns.set(key, entry);
  };

  const slides: SlideSourceV1[] = [];
  // A presentation may list one slide part twice. The part path alone would then
  // mint the same slide id and the same object ids for two entries, and the
  // compile would fail with an accounting error that names the wrong cause, so
  // the position settles a repeat here instead.
  const usedSlideIds = new Set<string>();

  const total = deck.slides.length;
  opts.onSlide?.(0, total);

  for (const read of deck.slides) {
    // Between slides, so a cancel stops the read before the next slide stores its
    // pictures. A slide with no pictures never awaits, so the loop hands the host a
    // turn every few milliseconds: that is when a cancel is dispatched and progress is
    // painted. Handing it one per slide would cost a clamped timer each.
    if (Date.now() - lastYield >= YIELD_EVERY_MS) {
      await yieldToHost();
      lastYield = Date.now();
    }
    opts.signal?.throwIfAborted();
    const slidePart = slidePaths[read.index] ?? `ppt/slides/slide${read.index + 1}.xml`;
    const slideId = usedSlideIds.has(slidePart) ? `${slidePart}#${read.index}` : slidePart;
    usedSlideIds.add(slideId);
    const lineage = lineageParts(parts, slidePart, parseXml);
    /** Warnings this slide raises while its objects are read. */
    const ownWarnings: SourceWarningV1[] = [];

    // Inherited furniture paints behind the slide's own nodes, so it leads the
    // z-order. `readPptx` merges the layout's shapes with the master's without
    // saying which gave which, so the origin recorded here is `master`.
    const ordered: Array<{ node: PptxReadNode; origin: 'slide' | 'master' }> = [
      ...(read.inherited ?? []).map((node) => ({ node, origin: 'master' as const })),
      ...read.nodes.map((node) => ({ node, origin: 'slide' as const })),
    ];

    const ids = new Map<PptxReadNode, string>();
    ordered.forEach((entry, z) => {
      ids.set(entry.node, `${slideId}.${z}`);
    });

    const readOrder = readingOrder(ordered.map((entry) => entry.node));
    const readingIndexOf = new Map<PptxReadNode, number>();
    readOrder.forEach((node, i) => {
      readingIndexOf.set(node, i);
    });

    const objects: SourceObjectV1[] = [];

    for (const { node, origin } of ordered) {
      const id = ids.get(node) ?? `${slideId}.${objects.length}`;
      let kind = kindOf(node);
      const box = boxOf(node);
      let content = '';
      let fidelity: FidelityV1 = { state: 'editable' };

      const object: SourceObjectV1 = { id, fingerprint: '', kind, box, origin, fidelity };

      const transform = transformOf(node);
      if (transform) object.transform = transform;
      if (node.groupPath?.length) object.groupPath = [...node.groupPath];
      const alt = cleanAlt(node.alt);
      if (alt) object.alt = alt;
      const readingIndex = readingIndexOf.get(node);
      if (typeof readingIndex === 'number') object.readingIndex = readingIndex;

      if (node.type === 'text' || node.type === 'shape') {
        if (node.geom) object.geom = node.geom;
        const fill = colorOf(node.fill);
        if (fill) object.fill = fill;
      }
      if (node.type === 'shape') {
        const line = colorOf(node.line);
        if (line || typeof node.lineWidthPt === 'number') {
          object.line = {};
          if (line) object.line.color = line;
          if (typeof node.lineWidthPt === 'number') object.line.widthPt = node.lineWidthPt;
        }
      }
      if (node.type === 'text' || node.type === 'shape') {
        const ph = placeholderOf(node.ph?.type);
        if (ph) object.placeholder = ph;
      }

      // A ramp reaches the model as its lowest stop, which is a colour the source
      // never painted on its own, so the slide says so and the object stops
      // claiming the reader modelled it faithfully.
      if ((node.type === 'text' || node.type === 'shape') && (node.gradient || ('lineGradient' in node && node.lineGradient))) {
        ownWarnings.push({
          code: 'gradient-flattened',
          message: `A gradient on ${id} was read as its lowest stop, so the object holds one flat colour where the source held a ramp.`,
          objectIds: [id],
        });
        fidelity = { state: 'approximate', reason: 'reader-approximation' };
      }

      if (node.type === 'text') {
        const paras = parasOf(node.paras);
        if (paras.length) object.text = { paras };
        content = paras.map((p) => p.runs.map((r) => r.text).join('')).join('\n');
        for (const para of node.paras ?? []) for (const run of para.runs) countFont(run.font);
      } else if (node.type === 'shape') {
        content = shapeMaterial(object);
        if (node.custGeom) {
          // A freeform keeps its kind, so the logo rule, the custom-geometry feature and
          // the fingerprint stay as they were; its outline travels as items beside it.
          const lineColor = object.line?.color;
          const items = custGeomItems(node.custGeom, { w: box.w, h: box.h }, {
            ...(object.fill ? { fill: object.fill } : {}),
            ...(lineColor ? { line: { color: lineColor, widthPx: (object.line?.widthPt ?? 0.75) * (96 / 72) } } : {}),
          });
          // A freeform with more parts than a compile places as rows keeps its shape
          // and spends none of the deck's budget on rows it can never become.
          if (items.items.length > 0 && items.items.length <= MAX_VECTOR_ROWS_PER_OBJECT && withinBudget(id, items)) object.vectorItems = items;
        }
      } else if (node.type === 'table') {
        object.table = node.rows.map((row) => [...row]);
        content = object.table.map((row) => row.join('\u001f')).join('\u001e');
      } else if (node.type === 'pic' && node.svg) {
        // A picture with an SVG beside its raster is a drawing (plan 275 decision 32).
        const raster = node.media ? await store(node.media) : undefined;
        const svgBytes = bytesOf(parts, node.svg);
        const svgHash = svgBytes && svgBytes.byteLength <= maxMedia ? await sha256Hex(svgBytes) : undefined;
        const svgText = svgBytes && svgHash ? new TextDecoder().decode(svgBytes) : undefined;
        let media = raster?.ref ? raster : undefined;
        if (!media && svgText) {
          // No raster beside it: the SVG itself is the picture a refused reading falls back to.
          const stored = await store(node.svg);
          if (stored.ref) media = stored;
        }
        if (media?.ref) {
          object.media = media.ref;
          object.mediaMime = media.mime;
        }
        if (svgText && svgHash) {
          kind = 'vector';
          object.kind = kind;
          content = svgHash;
          if (svgText.length <= MAX_VECTOR_CHARS && deckVectorChars + svgText.length <= maxDeckVectorChars) {
            object.vector = svgText;
            deckVectorChars += svgText.length;
          }
          let read = itemsByHash.get(svgHash);
          if (!read) {
            read = svgItemsOf(svgText, parseXml);
            nativeTextByHash.set(svgHash, read.items.filter((item) => item.kind === 'text').length);
            if (labelReader && read.items.length > 0) {
              read = (await readVectorLabels(read, labelReader, {
                hints: svgLabelHintsOf(svgText, parseXml),
                cache: labelCache,
                ...(opts.signal ? { signal: opts.signal } : {}),
              })).items;
            }
            itemsByHash.set(svgHash, read);
          }
          // PowerPoint crops the drawing as it crops the raster. A crop that cuts
          // through a part leaves nothing a row can draw, so the picture stands.
          const items = node.srcRect ? cropVectorItems(read, node.srcRect) : read;
          let placed = false;
          if (items && items.items.length > MAX_VECTOR_ROWS_PER_OBJECT) {
            // More parts than a compile places as rows: the reading is kept as a
            // refusal, so the drawing stays a picture with the reason, offers no colour
            // mappings for rows it will never have, and spends none of the deck's budget.
            const omitted = (items.omitted ?? []).filter((o) => o.reason !== 'cap-reached');
            object.vectorItems = { ...items, items: [], omitted: [...omitted, { reason: 'cap-reached', count: items.items.length }] };
          } else if (items) {
            placed = withinBudget(id, items);
            if (placed) object.vectorItems = items;
          }
          if (placed && items && items.items.length > 0) {
            const counts = labelCounts(items, nativeTextByHash.get(svgHash) ?? 0);
            labels.text += counts.text;
            labels.drawn += counts.drawn;
            labels.runs += counts.text + counts.drawn;
            fidelity = items.omitted?.length ? { state: 'approximate', reason: 'reader-approximation' } : { state: 'editable' };
          } else if (media?.ref) {
            fidelity = { state: 'raster-preserved', fallbackAssetRef: media.ref, fallbackSource: 'embedded' };
          } else {
            fidelity = { state: 'unavailable', reason: media?.reason ?? raster?.reason ?? 'media-missing' };
          }
        } else if (media?.ref) {
          // The SVG part is missing or too large: the raster stands, as a picture.
          fidelity = { state: 'raster-preserved' };
          content = media.hash ?? media.ref;
          if (!svgBytes) {
            ownWarnings.push({ code: 'media-skipped', message: `The SVG of ${id} (${node.svg}) is not in this package, so its raster stands in.`, objectIds: [id] });
          }
        } else {
          fidelity = { state: 'unavailable', reason: raster?.reason ?? (svgBytes ? 'media-too-large' : 'media-missing') };
          content = node.svg;
        }
      } else if (node.type === 'pic') {
        if (node.media && /\.(emf|wmf)$/i.test(node.media)) {
          // A metafile is a record stream, not markup: nothing here reads it, so the
          // report says a drawing arrived and stayed a picture.
          ownWarnings.push({
            code: 'metafile-not-converted',
            message: `The Windows metafile ${node.media} of ${id} was kept as a picture; its shapes were not read.`,
            objectIds: [id],
          });
        }
        if (node.media) {
          const media = await store(node.media);
          if (media.ref) {
            object.media = media.ref;
            object.mediaMime = media.mime;
            fidelity = { state: 'raster-preserved' };
            content = media.hash ?? media.ref;
          } else {
            fidelity = { state: 'unavailable', reason: media.reason ?? 'media-missing' };
            content = node.media;
          }
        } else {
          fidelity = { state: 'unavailable', reason: 'media-missing' };
        }
      } else if (node.type === 'unknown') {
        const family = unknownFamily(node.tag);
        if (node.tag) object.tag = node.tag;
        if (node.chartData) {
          const chart: NonNullable<SourceObjectV1['chartData']> = {
            series: node.chartData.series.map((s) => (s.name === undefined ? { values: [...s.values] } : { name: s.name, values: [...s.values] })),
          };
          if (node.chartData.type) chart.type = node.chartData.type;
          if (node.chartData.categories) chart.categories = [...node.chartData.categories];
          object.chartData = chart;
        }
        if (node.fallbackMedia) {
          const media = await store(node.fallbackMedia);
          if (media.ref) {
            fidelity = { state: 'raster-preserved', fallbackAssetRef: media.ref, fallbackSource: 'embedded' };
            content = media.hash ?? media.ref;
          } else {
            fidelity = { state: 'unavailable', reason: media.reason ?? 'media-missing' };
            content = node.fallbackMedia;
          }
        } else {
          fidelity = { state: 'unavailable', reason: unavailableReason(family) };
          // The tag alone would give two charts at one place on two slides the
          // same fingerprint, so the cached series travel with it.
          content = chartMaterial(node.tag ?? '', object.chartData);
        }
      }

      // `transform` states the composed placement. When the box, its rotation
      // and one mirror cannot restate it, the box IS an approximation, and an
      // object the reader would otherwise call modelled says so instead.
      if (transform && !poseRestatesTransform(transform)) {
        ownWarnings.push({
          code: 'group-transform-approximated',
          message: `The box of ${id} is an approximation: its group states a placement an axis-aligned box cannot hold.`,
          objectIds: [id],
        });
        if (fidelity.state === 'editable') fidelity = { state: 'approximate', reason: 'geometry-approximation' };
      }

      object.fidelity = fidelity;
      object.fingerprint = await fingerprintOf(kind, box, content);
      objects.push(object);
    }

    const slideW = px(deck.widthEmu) || 1280;
    const slideH = px(deck.heightEmu) || 720;
    const own = objects.filter((o) => o.origin === 'slide');
    const flattened =
      own.length === 1 && own[0]?.kind === 'pic' && own[0].box.w * own[0].box.h >= FLATTENED_AREA_SHARE * slideW * slideH;

    const slide: SlideSourceV1 = {
      id: slideId,
      index: read.index,
      width: slideW,
      height: slideH,
      background: {},
      objects,
      readingOrder: readOrder.map((node) => ids.get(node)).filter((id): id is string => id !== undefined),
      warnings: [...(slideWarnings.get(read.index) ?? []), ...ownWarnings],
      origin: { kind: 'pptx' },
    };
    const bgColor = colorOf(read.background?.color);
    if (bgColor) slide.background.color = bgColor;
    if (read.background?.gradient) {
      slide.warnings.push({
        code: 'gradient-flattened',
        message: `The ground of ${slideId} was a gradient and was read as its lowest stop.`,
      });
    }
    if (read.background?.media) {
      const media = await store(read.background.media);
      if (media.ref) {
        slide.background.media = media.ref;
      } else {
        // A whole slide coming back white is at least as visible as one missing
        // picture, so the ground that could not be stored says why.
        slide.warnings.push({
          code: 'media-skipped',
          message: `The ground picture of ${slideId} (${read.background.media}) was not stored: ${media.reason ?? 'media-missing'}.`,
        });
      }
    }
    if (read.audio) {
      // The narration has no home in the stage-1 model yet, so it is recorded as
      // a loss rather than left for a later stage to discover as silence.
      slide.warnings.push({
        code: 'media-skipped',
        message: `The narration of ${slideId} (${read.audio.part}) did not travel: this stage carries no slide audio.`,
      });
    }
    if (read.notes) slide.notes = read.notes;
    if (lineage.layout) slide.origin.layout = lineage.layout;
    if (read.layoutName) slide.origin.layoutName = read.layoutName;
    if (lineage.master) slide.origin.master = lineage.master;
    if (flattened) slide.origin.flattened = true;
    slides.push(slide);
    opts.onSlide?.(slides.length, total);
  }

  opts.onVectorLabels?.(labels);

  if (overBudget.length > 0) {
    deckWarnings.push({
      code: 'vector-budget-reached',
      message: `The deck holds more than ${VECTOR_DECK_ITEMS_MAX} drawing parts in all, so ${overBudget.length === 1 ? '1 drawing stays a picture' : `${overBudget.length} drawings stay pictures`}.`,
      objectIds: overBudget.slice(0, MAX_WARNING_IDS),
      count: overBudget.length,
    });
  }

  const theme: SourceDeckV1['theme'] = {};
  const themeColors: Record<string, string> = {};
  for (const [slot, hex] of Object.entries(deck.theme.colors)) {
    if (/^[0-9a-fA-F]{6}$/.test(hex)) themeColors[slot] = `#${hex}`;
  }
  if (Object.keys(themeColors).length) theme.colors = themeColors;
  if (deck.theme.majorFont) theme.majorFont = deck.theme.majorFont;
  if (deck.theme.minorFont) theme.minorFont = deck.theme.minorFont;

  const source: SourceDeckV1['source'] = {
    kind: 'pptx',
    hash: opts.hash,
    // The OOXML core properties carry no identifier field, so the first hash
    // seen is the lineage id until a revision of the same deck gives a better one.
    lineageId: opts.hash,
    instanceId: opts.instanceId,
    pageCount: slides.length,
  };
  if (opts.name) source.name = opts.name;
  if (typeof opts.bytes === 'number') source.bytes = opts.bytes;
  if (deck.coreProps?.title) source.title = deck.coreProps.title;

  const out: SourceDeckV1 = {
    version: 1,
    source,
    slides,
    // A total order, so the list does not rest on the host's sort being stable:
    // one family can appear twice, once as a theme reference and once as a
    // literal naming the same face, and those two tie on runs and on family.
    fonts: [...fontRuns.values()].sort(
      (a, b) =>
        b.runs - a.runs ||
        (a.family < b.family ? -1 : a.family > b.family ? 1 : a.provenance < b.provenance ? -1 : a.provenance > b.provenance ? 1 : 0),
    ),
    warnings: deckWarnings,
    reader: { ...opts.reader },
  };
  if (Object.keys(theme).length) out.theme = theme;
  return out;
}

export interface ReadDeckLabelsOptsV1 {
  /** Checked between readings. */
  signal?: AbortSignal;
  /** Drawings read so far, of the drawings holding outlined labels. */
  onProgress?: (done: number, total: number) => void;
}

/**
 * Read the outlined labels of a deck read without a recogniser (plan 275 section
 * 9.3): every drawing whose items still hold glyph runs is read with `reader` (at most
 * `MAX_DECK_LABEL_READS` readings in all, as a read of the file takes), its
 * own SVG copy supplying the names it states when the deck kept one. Returns the deck
 * with those drawings' items replaced (the same deck when nothing became text) and
 * the counts over every drawing that holds outlined labels.
 */
export async function readDeckVectorLabels(
  deck: SourceDeckV1,
  reader: VectorLabelReaderV1,
  parseXml: XmlParser,
  opts: ReadDeckLabelsOptsV1 = {},
): Promise<{ deck: SourceDeckV1; summary: VectorLabelSummaryV1 }> {
  const summary: VectorLabelSummaryV1 = { runs: 0, text: 0, drawn: 0, read: true };
  const wanted = deck.slides.flatMap((slide) => slide.objects.filter((o) => o.kind === 'vector' && o.vectorItems && glyphRunsOf(o.vectorItems).length > 0));
  const total = wanted.length;
  opts.onProgress?.(0, total);
  if (!total) return { deck, summary };
  const cache = new Map<string, VectorLabelReadingV1 | null>();
  const bounded = boundedReader(reader);
  const done = new Map<SourceObjectV1, VectorItemsV1>();
  let finished = 0;
  for (const object of wanted) {
    opts.signal?.throwIfAborted();
    const items = object.vectorItems!;
    const result = await readVectorLabels(items, bounded, {
      ...(object.vector ? { hints: svgLabelHintsOf(object.vector, parseXml) } : {}),
      cache,
      ...(opts.signal ? { signal: opts.signal } : {}),
    });
    summary.runs += result.runs;
    summary.text += result.text;
    summary.drawn += result.drawn;
    if (result.text > 0) done.set(object, result.items);
    finished += 1;
    opts.onProgress?.(finished, total);
  }
  if (!done.size) return { deck, summary };
  const slides = deck.slides.map((slide) => (slide.objects.some((o) => done.has(o))
    ? { ...slide, objects: slide.objects.map((o) => (done.has(o) ? { ...o, vectorItems: done.get(o)! } : o)) }
    : slide));
  return { deck: { ...deck, slides }, summary };
}

/** A fresh instance id for one import, when the caller has no id of its own. */
export function newInstanceId(): string {
  return globalThis.crypto.randomUUID();
}
