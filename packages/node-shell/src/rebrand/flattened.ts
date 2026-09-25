// SPDX-License-Identifier: MPL-2.0
/**
 * The flattened path without the web (plan 274 section 6, first slice): a slide
 * that is one picture of a whole slide in, the same `SlideSourceV1` out with the
 * picture split into regions, each region either rebuilt as text and shapes or
 * kept as a cropped picture, never both.
 *
 * THE PAGE READING (plan 275 WP10), the default when a recogniser is given and
 * no region set is passed in. A text detector finds text on a photograph or a
 * gradient where a colour rule cannot, so the text is found first:
 *
 *   1. The recogniser reads the whole slide picture (the region it is handed is
 *      id `page`), then overlapping tiles of about a third of the long side (ids
 *      `page.tileN`), since a detector given a busy slide loses small text. Two
 *      readings of one line merge; the one spanning it stands. A line whose box
 *      does not fit its ink (an empty run wider than `LINE_GAP_SPLIT` of its ink
 *      height, or a box around a whole band of colour) is read again tight to
 *      each part (`page.part`), which is also what saves the reading from a
 *      recogniser that read a band as text. A line longer than the recogniser's
 *      window (`maxLineAspect` of its height) is read again in pieces cut at
 *      word spaces (`page.piece`, at most `MAX_PIECES`), joined across the cuts
 *      so a cut through a word leaves no space in it and a letter both pieces
 *      read is kept once; the reading with more letters stands. Every reading
 *      again comes out of `maxOcrCalls` (48 by default). A line starting with an
 *      icon the detector boxed with it (a row label drawn as a symbol and a
 *      word) gives the icon up as a picture; a typographic sign (`&`) is text.
 *   2. The lines read above the floor are masked out of the picture, and
 *      `findSlideRegions` finds pictures, panels and rules on what is left, so
 *      a panel under text is one fill and an illustration beside text is boxed
 *      without it. Four rules drawing a box (`outlinedBoxes`) become one
 *      rectangle with its outline.
 *   3. The lines are grouped into blocks (`ocrTextBlocks`) inside the panel
 *      holding them, a line in a slide corner only with lines in that corner,
 *      never across a rule (pieces of a rule on one line joined, and a rule
 *      running into a panel carried across it). A block drawn inside a picture
 *      no larger than `FULL_BLEED_SHARE` of the slide (a label on a mock-up) is
 *      part of that picture and becomes its evidence, unless it is in a slide
 *      corner, where a generator's stamp is set over everything. Inside a
 *      larger picture, a block of a letter or two or one set well under the
 *      page's body size (a label on an org chart) is the picture's too, and the
 *      title and body set over a photograph stay text. A word in a corner with
 *      a mark just before it is one logo, kept as one picture. The other blocks
 *      are typeset one at a time into text objects `<base>.tN`; a title is
 *      judged against the page's largest size, so large body copy stays body.
 *      Each line's colour and ground are read along its own box, column by
 *      column (`lineInkColourOf`), sizes within a block are brought to its
 *      median, a paragraph set clearly heavier than the page's usual line is
 *      bold, and each box is given room to its side for another face.
 *   4. A label with a drawing standing over it (`inkAbove`) gets that drawing
 *      as its icon, cropped tight (`<base>.tN.icon`), and a card whose panel
 *      is shaded rather than one fill is found by its edge and rebuilt as a
 *      rectangle (`<base>.cN`).
 *   5. A picture region keeps its largest box free of the slide's text (a large
 *      one runs under a corner stamp, painted out); a sliver, a piece of a
 *      rule or a patch of plain ground is dropped, since the recovery picture
 *      holds the whole slide, and a warning counts what was cut or dropped. A
 *      text region the recogniser saw text in but could not read well is kept
 *      whole as a picture, as the region reading keeps it.
 *   6. What the objects form together goes in `groupPath` (see `groupUnits`):
 *      a panel or outlined box holding text is a container (a card with a
 *      picture in it, a callout with text alone), an icon over its label is
 *      `<base>.cardN`, and icons each beside a text in one column are
 *      `<base>.rowN`, with the other cells level with each row. The title is
 *      read first, a table's headings next, and a row's members together.
 *
 * A recogniser that throws on the whole picture sends the slide to the region
 * reading below, which `ocrScope: 'regions'` also asks for; a region set passed
 * in is always read region by region. Decisions on a page reading are keyed by
 * block id (`tN`) as well as region id; a region a person decided on draws the
 * page reading's text inside it, which is then not rebuilt a second time.
 *
 * THE REGION READING, per region the engine's `findSlideRegions` returns (or
 * the regions a person selected, passed back in):
 *
 *   - A text region is read through the injected `ocr` callback, one crop at a
 *     time (with a page reading, only what the page reading did not explain).
 *     The lines are typeset by `typesetOcrLines` (paragraphs, bullets,
 *     numbered items, nesting, reading order, a size estimate, a title or body
 *     guess) and become text objects with `fidelity: approximate`
 *     (`ocr-estimate`), the OCR evidence beside them and the guess as
 *     `roleEstimate`, which is an estimate and never a placeholder. Each line's colour is
 *     read from its own ink, so a coloured lead-in keeps its colour. When the
 *     lines do not explain the region's ink (an icon beside a label, a chart with
 *     its labels), or when a line was read below the confidence floor, the
 *     region is kept as a picture instead, with every line it read attached as
 *     evidence, because OCR locates text and does not remove its pixels.
 *   - A picture region is cropped, encoded as PNG and stored through the sink
 *     once per distinct byte sequence, `raster-preserved`, origin
 *     `raster-region`.
 *   - A panel (a flat block of one colour) becomes a rectangle of that colour,
 *     and the regions found inside it are rebuilt on top of it; a rule becomes a
 *     thin rectangle. Both are `approximate`.
 *   - With no OCR callback, every text region stays a picture and every region
 *     object says `not-run` (or `unavailable`, when the caller says the host has
 *     no OCR at all). Neither state is evidence of a photograph. A region that
 *     is never read (a picture region, a region kept whole, a leftover crop)
 *     says `not-run` when a recogniser was passed, and the same `unavailable`
 *     as every other object when the host has none.
 *   - A searchable scan's own text layer (the picture object's `text-found`
 *     evidence) is not dropped with the picture: each of its lines moves onto
 *     the rebuilt picture or text object it overlaps most, or the nearest one
 *     when it overlaps none, as `text-found` evidence naming the layer. An
 *     object whose own reading found text in this run keeps that reading.
 *
 * Text correction and keep-as-picture arrive as `decisions`, keyed by region id:
 * `{ keep: 'picture' }` keeps a region whole, `{ keep: 'text', text }` makes it
 * text from what the person typed, over the OCR boxes when their count matches.
 * Typed text is the person's, not the recogniser's: its evidence is what OCR
 * read (or `not-run`), and its fidelity reason is `reader-approximation`, since
 * only the placement and size are estimated. It carries a `roleEstimate` only
 * when it sits on the boxes OCR read; spread over the region's box, its line
 * sizes are made up, so no title or body guess is written. `keep: 'text'` on a
 * panel reads the panel's whole box against its fill and puts the text on the
 * rectangle.
 *
 * A region set a person selected replaces detection, but no ink is dropped with
 * it: ink outside every selected box is kept as picture crops (`<id>.restN`)
 * whose pixels inside a selected box are transparent, so each pixel still has
 * one owner.
 *
 * Where the whole-slide picture goes: once its picture object is replaced by
 * the regions, `SlideSourceV1.recovery`, as `{ assetRef, fromObjectId }`, so it
 * stays reachable. A slide kept as one picture has no `recovery`, since its
 * picture object still holds it, except a page render passed in as
 * `pictureRef` that no object on the slide carries. The slide keeps
 * `origin.flattened: true`, and `SlideSourceV1.ocr` says what the slide's
 * objects hold: `text-found` when some object carries a reading that found
 * text (with the recogniser's model, or the text layer's), `no-text-found`
 * (with the model) only when the recogniser read every region that could hold
 * text and found none, otherwise `not-run` or `unavailable`. A slide kept as one
 * picture keeps the reading it or its picture already stated. A slide that is
 * not one picture (a picture plus its own objects) comes back unchanged with a
 * warning. One picture means the slide's only object: of whatever size on a slide
 * the source marked flattened (a scan placed on a page), otherwise covering 90%
 * of it. A picture that leaves part of the slide showing keeps the slide's own
 * ground, and its own ground becomes a rectangle under its regions. A turned or
 * mirrored picture, a picture the page clips, or a region search that stopped
 * at a cap, keeps the slide one picture, with the OCR state written all the same.
 *
 * DOM-free, with no node built-ins in this file: hashing through the engine's
 * Web Crypto `sha256Hex`, PNG through the engine's own encoder, OCR and storage
 * injected. The picture arrives decoded, because decoding is the shell's job.
 * The package reaches it only through the `./rebrand` barrel, which also
 * carries the node pipeline, so a browser caller needs a subpath of its own
 * before it can import this.
 */

import { sha256Hex } from '../../../../engine/src/bytes.ts';
import { contrastRatio } from '../../../../engine/src/brand-derive.ts';
import { packPng } from '../../../../engine/src/png.ts';
import type { DeflateOptions } from '../../../../engine/src/deflate.ts';
import {
  cropRgba,
  detailShare,
  findSlideRegions,
  inkAbove,
  inkAngleOf,
  groundOfRegion,
  inkBounds,
  inkColourOf,
  inkCoverage,
  inkMaskOf,
  largestFreeBox,
  lineGlyphsOf,
  lineGroundOf,
  lineInkColourOf,
  maskedImageOf,
  strokeRatioOf,
  outlineColourOf,
  outlinedBoxes,
  paintOutBoxes,
  textBoundsOf,
  type InkGroundV1,
  type LineGlyphsV1,
  type RegionBoxV1,
  type RgbaImageV1,
  type SlideRegionOptsV1,
  type SlideRegionV1,
  type SlideRegionsV1,
} from '../../../../engine/src/slide-regions.ts';
import {
  ocrTextBlocks,
  readingOrderOf,
  typesetOcrLines,
  type OcrLineInputV1,
  type TypesetBlockV1,
  type TypesetLineV1,
  type TypesetOptsV1,
  type TypesetParagraphV1,
} from '../../../../engine/src/ocr-typeset.ts';
import type { OcrFrame, OcrLine } from '@lolly-tools/core/host-v1';
import type {
  BoxV1,
  OcrEvidenceV1,
  OcrLineEvidenceV1,
  OcrStateV1,
  SlideSourceV1,
  SourceObjectKindV1,
  SourceObjectV1,
  SourceParaV1,
  SourceWarningV1,
} from '@lolly-tools/core';
import type { SlideOcrV1 } from '@lolly-tools/core/rebrand-v1';
import type { MediaSinkV1 } from './source-pptx.ts';

/** A slide picture covering at least this share of the slide makes it a flattened page, when the source did not mark it flattened. */
const FLATTENED_AREA_SHARE = 0.9;
/** Lines below this recognition confidence are not used for text. */
const DEFAULT_MIN_CONFIDENCE = 0.5;
/** The accepted lines must cover at least this share of the region's ink. */
const DEFAULT_MIN_INK_COVERAGE = 0.85;
/** Pixels of context around a crop sent to OCR. */
const OCR_PAD = 4;
/** Line boxes grow by this share of their height before the coverage check, for anti-aliased edges. */
const COVER_PAD = 0.15;
/** A line's text is masked this share of its height past each end of its box. */
const MASK_PAD_X = 0.2;
/** Encoder settings for crops: see `store`. */
const CROP_DEFLATE: DeflateOptions = { lazy: false, maxChain: 16 };
/** Points per reference px (72 over 96). */
const PT_PER_PX = 0.75;
/**
 * A recogniser reads a line at a fixed height and a capped width (PP-OCR: 48 by
 * 480 px), so a line longer than this many of its own heights is squeezed and
 * read badly. Such a line is read again in pieces cut at the gaps between words.
 */
const DEFAULT_MAX_LINE_ASPECT = 12;
/** Pieces of a long line aim at this many of its heights, well inside the recogniser's window. */
const PIECE_ASPECT = 8;
/**
 * The smallest tile side the page is also read in. A detector given a whole
 * busy slide loses small text beside a large picture (measured on a picture
 * deck: three lines of body copy under an illustration, found in a 480 px
 * tile and missed in a 960 px one at the same scale), so the page is read
 * again in overlapping tiles of about a third of its long side, at least this
 * and at most `MAX_OCR_TILE`, the side PP-OCR's detector reads without scaling.
 */
const DEFAULT_OCR_TILE = 480;
/** A whole-slide reading with every line at least this sure is not read again in tiles. */
const TILE_SKIP_CONFIDENCE = 0.9;
const MAX_OCR_TILE = 960;
/** Two readings of one line, from the page and a tile, merge when their heights differ by at most this ratio. */
const SAME_LINE_SIZE = 1.5;
/** Two readings of one line have centres at most this share of the smaller height apart. */
const SAME_LINE_CENTRES = 0.4;
/** A reading that spans at least this share of the merged width of one line stands for it; otherwise that width is read again. */
const SAME_LINE_COVER = 0.9;
/** A cut between two pieces is looked for within this share of a piece's width of where it would fall evenly. */
const CUT_WINDOW = 0.35;
/** A cut is judged over this share of the line's height each side of it: past a letter gap, inside a word space. */
const CUT_SPREAD = 0.12;
/** Readings either side of a cut through an empty run at least this share of the line's height wide are two words; a narrower cut went through one word. */
const WORD_GAP = 0.12;
/** A read line with an empty run wider than this many of its ink heights is two things, each read again on its own. */
const LINE_GAP_SPLIT = 3;
/** A read line whose box runs this many ink heights wider than its ink, all told, is read again tight to the ink. */
const LOOSE_MARGIN = 2;
/** A long line is read again in at most this many pieces. */
const MAX_PIECES = 6;
/** Pieces are counted as if a line were at least this many px high, so a hairline box does not ask for hundreds of readings. */
const PIECE_MIN_HEIGHT = 8;
/**
 * The most recogniser calls one slide's page reading makes: the whole picture,
 * its tiles, then lines read again (a merged line, a line split at a wide gap,
 * the pieces of a long line) while calls are left. Past it, a line keeps the
 * reading it has. A 1920 by 1080 slide reads in 15 tiles.
 */
const DEFAULT_MAX_OCR_CALLS = 48;
/** A pixel differing from the ground around its line by more than this (summed channels) is ink, for cutting. */
const CUT_INK = 48;
/** A panel covering more than this share of the slide is a frame, not a card or a callout. */
const CONTAINER_MAX_AREA_SHARE = 0.5;
/** A line or object with at least this share of its box inside a panel is held by it. */
const CONTAIN_SHARE = 0.8;
/** A picture covering at least this share of the slide is the ground its text is set on, never the text's own picture. */
const FULL_BLEED_SHARE = 0.6;
/** A block of text with at least this share of its box inside a smaller picture is drawn in it (a label in an illustration). */
const INCIDENTAL_INSIDE = 0.9;
/** A picture kept around text keeps its largest text-free box only when that box holds at least this share of it. */
const FREE_MIN_SHARE = 0.1;
/** A block set with lines under this share of the page's body line height, inside a picture as large as the slide, is a label of that picture. */
const LABEL_SIZE_SHARE = 0.6;
/** A block with at least this share of its box inside a region a person kept whole is drawn by that region. */
const KEPT_INSIDE = 0.5;
/** An icon covers at most this share of the slide... */
const ICON_MAX_AREA_SHARE = 0.02;
/** ...and is no longer than this many times its short side. */
const ICON_MAX_ASPECT = 2.5;
/** The text of an icon's row starts within this many icon widths to its right. */
const ROW_GAP_ICONS = 3;
/** A label an icon may stand over has at most this many lines... */
const LABEL_MAX_LINES = 3;
/** ...and is at most this share of the slide wide. */
const LABEL_MAX_WIDTH_SHARE = 0.45;
/** An icon over a label is looked for up to this many of the label's line heights above it, and is at most this many on each side. */
const ICON_REACH_LINES = 5;
/** Ink of an icon differs from the median of its search window by more than this (summed channels). */
const ICON_THRESHOLD = 48;
/** A region with at least this share of its box inside an icon's box is that icon. */
const ICON_OWNS = 0.6;
/** A picture crop's shorter side is at least this share of the slide's shorter side... */
const PICTURE_MIN_SIDE = 0.01;
/** A region covering at least this share of the panel it lies in is the panel's shading. */
const PANEL_SHADING = 0.8;
/** A picture crop longer than this many times its short side... */
const SLIVER_ASPECT = 6;
/** ...with a short side under this share of the slide's is a piece of a line, not a picture. */
const SLIVER_SIDE = 0.03;
/** ...and at least this share of its pixels is detail (see `detailShare`). */
const PICTURE_MIN_DETAIL = 0.02;
/** Text crossing a picture whose free part is under this share of it may be set on the picture itself... */
const ON_PICTURE_FREE = 0.9;
/** ...when the ground around its lines, text masked out, holds at least this share of detail (a faded drawing does). */
const ON_PICTURE_DETAIL = 0.005;
/** The ground around a line is read this many px out at most (and 30% of its height when less). */
const ON_PICTURE_PAD = 40;
/** A picture within this share of the slide's long side of an edge runs to it. */
const BLEED_EDGE = 0.01;
/** An outlined box counts from this share of the slide: a smaller one is a detail of a drawing. */
const OUTLINE_MIN_AREA_SHARE = 0.01;
/** Pixels inside an outline, past its thickness, where its fill is read. */
const OUTLINE_INSET = 3;
/** Two colours within this summed channel difference are one fill. */
const SAME_COLOUR = 36;
/** A title is at least the page's largest size over this ratio, the typesetter's own title ratio. */
const TITLE_SIZE_RATIO = 1.35;
/** A read line with fewer letters or figures than this needs `SHORT_LINE_CONFIDENCE`: a lone glyph in a drawing reads as a letter. */
const SHORT_LINE_CHARS = 2;
const SHORT_LINE_CONFIDENCE = 0.8;
/** A line of at least this many of one character and nothing else is a pattern, not text. */
const REPEAT_RUN = 4;
/** A paragraph needs this many letters or figures to set the page's title size. */
const TITLE_MIN_CHARS = 3;
/** A text block whose centre is in the outer band of the slide both across and down is a corner stamp (a label a little further in is part of what it is drawn on). */
const CORNER_BAND = 0.1;
/** A corner word with a mark before it is a logo when it has at most this many words. */
const LOCKUP_MAX_WORDS = 2;
/** The mark before a logo's word is looked for up to this many of the word's heights to its left, a height above and below it... */
const LOCKUP_REACH = 4;
/** ...ends within this many heights of the word... */
const LOCKUP_GAP = 1.5;
/** ...is between these many of the word's heights tall... */
const LOCKUP_MIN_SIZE = 0.6;
const LOCKUP_MAX_SIZE = 2.6;
/** ...and at most this many wide (a chameleon runs wider than a letter is tall). */
const LOCKUP_MAX_WIDTH = 3.5;

/** A corner stamp a picture crop may run under covers at most this share of the slide... */
const STAMP_MAX_AREA = 0.01;
/** ...and the picture covers at least this share of it. */
const STAMP_UNDER_SHARE = 0.1;
/** A picture box with at least this share of its ink on a rule found beside it is that rule's pixels. */
const RULE_OWNED = 0.6;

/** Reads one region crop. Boxes come back in the crop's own pixels, as `host.ocr.run` returns them. */
export type FlattenedOcrV1 = (frame: OcrFrame, region: SlideRegionV1) => Promise<OcrLine[]>;

/** A person's choice for one region: keep it whole, or make it text (optionally from typed text). */
export type FlattenedDecisionV1 = { keep: 'picture' } | { keep: 'text'; text?: string };

export interface ReconstructFlattenedInputV1 {
  /** The slide as a source adapter read it: a flattened page. */
  slide: SlideSourceV1;
  /** The slide picture, decoded to RGBA by the shell. */
  picture: RgbaImageV1;
  /** Where cropped pictures go, once per distinct byte sequence. */
  sink: MediaSinkV1;
  /**
   * Text recognition. It is called on the whole slide picture first (the
   * region it is given is the whole picture, id `page`), then on tiles of it,
   * on lines whose box does not fit their ink and on pieces of lines too long
   * to read whole (at most `maxOcrCalls` calls in all), then on regions the
   * colour finder calls text that hold none of the lines it found. Absent: text
   * regions stay pictures and say OCR was not run.
   */
  ocr?: FlattenedOcrV1;
  /**
   * `page` (default): the recogniser's line boxes over the whole picture are the
   * text, whatever the ground; `regions`: each text region the colour finder
   * returns is read on its own (the first slice's reading). A recogniser that
   * throws on the whole picture falls back to `regions`, and a region set passed
   * in (`regions`) is always read region by region.
   */
  ocrScope?: 'page' | 'regions';
  /** A line longer than this many of its heights is read again in pieces. Default 12, past the PP-OCR recogniser's window of 10. */
  maxLineAspect?: number;
  /** The smallest side of the overlapping tiles a page is also read in. Default 480; the tile is a third of the long side when that is larger, up to 960. */
  ocrTile?: number;
  /** The most recogniser calls one slide's page reading makes, tiles and lines read again included. Default 48; the regions the colour finder reads after it are not counted. */
  maxOcrCalls?: number;
  /** The OCR model id, recorded in the evidence. */
  ocrModel?: string;
  /** What an absent `ocr` means: `not-run` (default) or `unavailable` (the host has none). */
  ocrMissing?: 'not-run' | 'unavailable';
  /** A region set a person selected or edited; replaces detection. */
  regions?: SlideRegionsV1;
  /** Text correction and keep-as-picture, by region id. */
  decisions?: Record<string, FlattenedDecisionV1>;
  /** The whole-slide picture's asset ref when the slide has no picture object carrying one (a pdf page render). */
  pictureRef?: string;
  /** Shared across slides so one crop repeated on many slides is one asset: content hash to ref. */
  mediaCache?: Map<string, string>;
  regionOpts?: SlideRegionOptsV1;
  typesetOpts?: TypesetOptsV1;
  minConfidence?: number;
  minInkCoverage?: number;
  /** Checked before detection and between regions. */
  signal?: AbortSignal;
}

// ─── small helpers ───────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** The share of the slide a picture box covers, clipped to the slide. */
function coverOf(box: BoxV1, slide: SlideSourceV1): number {
  const cover =
    Math.max(0, Math.min(box.x + box.w, slide.width) - Math.max(box.x, 0)) *
    Math.max(0, Math.min(box.y + box.h, slide.height) - Math.max(box.y, 0));
  return cover / Math.max(1, slide.width * slide.height);
}

/**
 * The picture object a flattened slide is: its only own object, a picture. A
 * slide the source marked flattened (`origin.flattened`) is taken at its word,
 * however much of it the picture covers: the pdf adapter marks a scan at half
 * the page, and the picture box places the regions inside it. Otherwise
 * the picture must cover 90% or more of the slide.
 */
export function flattenedPictureOf(slide: SlideSourceV1): SourceObjectV1 | null {
  const own = slide.objects.filter((o) => o.origin === 'slide' || o.origin === 'pdf-artifact');
  const pics = own.filter((o) => o.kind === 'pic');
  if (pics.length !== 1 || own.length !== 1) return null;
  const pic = pics[0];
  if (!pic) return null;
  if (slide.origin.flattened === true) return pic;
  return coverOf(pic.box, slide) >= FLATTENED_AREA_SHARE ? pic : null;
}

/** Content fingerprint, by the same recipe as the pptx adapter: kind, coarse geometry, material. */
async function fingerprintOf(kind: SourceObjectKindV1, box: BoxV1, content: string): Promise<string> {
  const grid = (n: number): number => Math.round(n / 8) * 8;
  const material = `${kind}|${grid(box.x)},${grid(box.y)},${grid(box.w)},${grid(box.h)}|${content}`;
  return `${kind}:${(await sha256Hex(new TextEncoder().encode(material))).slice(0, 16)}`;
}

function padBox(b: RegionBoxV1, by: number): RegionBoxV1 {
  return { x: b.x - by, y: b.y - by, w: b.w + 2 * by, h: b.h + 2 * by };
}

function sameColour(a: string, b: string): boolean {
  const pa = /^#([0-9a-f]{6})$/i.exec(a);
  const pb = /^#([0-9a-f]{6})$/i.exec(b);
  if (!pa?.[1] || !pb?.[1]) return false;
  const na = Number.parseInt(pa[1], 16);
  const nb = Number.parseInt(pb[1], 16);
  let d = 0;
  for (const shift of [16, 8, 0]) d += Math.abs(((na >> shift) & 255) - ((nb >> shift) & 255));
  return d <= SAME_COLOUR;
}

/**
 * The pixels a read line's text is masked out over: its box grown by
 * `COVER_PAD` of its height above and below and `MASK_PAD_X` of it at each end,
 * because a detector's box can stop short of a line's last glyph (a long dash).
 */
function maskBoxOf(b: RegionBoxV1): RegionBoxV1 {
  const dy = COVER_PAD * b.h;
  const dx = MASK_PAD_X * b.h;
  return { x: b.x - dx, y: b.y - dy, w: b.w + 2 * dx, h: b.h + 2 * dy };
}

function areaOf(b: RegionBoxV1): number {
  return Math.max(0, b.w) * Math.max(0, b.h);
}

/** Share of box `a`'s area that lies inside box `b`. */
function insideShare(a: RegionBoxV1, b: RegionBoxV1): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? (w * h) / Math.max(1, areaOf(a)) : 0;
}

function unionOf(boxes: RegionBoxV1[]): RegionBoxV1 {
  const x0 = Math.min(...boxes.map((b) => b.x));
  const y0 = Math.min(...boxes.map((b) => b.y));
  const x1 = Math.max(...boxes.map((b) => b.x + b.w));
  const y1 = Math.max(...boxes.map((b) => b.y + b.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** A box clipped to the picture's pixels, or null when nothing of it is inside. */
function clipBox(b: RegionBoxV1, image: { width: number; height: number }): RegionBoxV1 | null {
  const x = Math.max(0, b.x);
  const y = Math.max(0, b.y);
  const w = Math.min(image.width, b.x + b.w) - x;
  const h = Math.min(image.height, b.y + b.h) - y;
  return w > 0 && h > 0 ? { x, y, w, h } : null;
}

/** Whether a box's centre lies in a slide corner: the outer `CORNER_BAND` both across and down. */
function cornerBlock(b: RegionBoxV1, image: { width: number; height: number }): boolean {
  const cx = (b.x + b.w / 2) / image.width;
  const cy = (b.y + b.h / 2) / image.height;
  return (cx < CORNER_BAND || cx > 1 - CORNER_BAND) && (cy < CORNER_BAND || cy > 1 - CORNER_BAND);
}

function centreIn(a: RegionBoxV1, b: RegionBoxV1): boolean {
  const cx = a.x + a.w / 2;
  const cy = a.y + a.h / 2;
  return cx >= b.x && cx < b.x + b.w && cy >= b.y && cy < b.y + b.h;
}

/**
 * A read line that states something: a letter or a figure, a short one only at
 * a high confidence, and not one character over and over (a dotted rule or a
 * row of ticks reads as `1111111`).
 */
function meaningful(line: OcrLine, minConfidence: number): boolean {
  const kept = line.text.replace(/[^\p{L}\p{N}]/gu, '');
  const chars = Array.from(kept);
  if (chars.length === 0 || line.confidence < minConfidence) return false;
  if (chars.length >= REPEAT_RUN && new Set(chars).size === 1) return false;
  return chars.length >= SHORT_LINE_CHARS || line.confidence >= SHORT_LINE_CONFIDENCE;
}

/**
 * Ink per column of a box against the ground under it, read along the box
 * from its top and bottom rows (`lineGroundOf`): a column through a stroke holds some, a gap between words
 * none, whatever the stroke's own shading and however the ground runs along the
 * line (a gradient, a photograph). Also the rows holding ink, top and bottom.
 * Reads each pixel of the box once. Null for a box of under 3 by 2 pixels.
 */
function columnInk(image: RgbaImageV1, box: RegionBoxV1): { x0: number; ink: Uint32Array; top: number; bottom: number } | null {
  const x0 = Math.max(0, Math.floor(box.x));
  const x1 = Math.min(image.width, Math.ceil(box.x + box.w));
  const y0 = Math.max(0, Math.floor(box.y));
  const y1 = Math.min(image.height, Math.ceil(box.y + box.h));
  if (x1 - x0 <= 2 || y1 - y0 < 2) return null;
  const { step, colours: grounds } = lineGroundOf(image, box);
  const ink = new Uint32Array(x1 - x0);
  let top = y1;
  let bottom = y0 - 1;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * image.width + x) * 4;
      const ground = grounds[Math.min(grounds.length - 1, Math.floor((x - x0) / step))] ?? [255, 255, 255];
      const d = Math.abs((image.data[i] ?? 0) - ground[0]) + Math.abs((image.data[i + 1] ?? 0) - ground[1]) + Math.abs((image.data[i + 2] ?? 0) - ground[2]);
      if (d <= CUT_INK) continue;
      ink[x - x0] = (ink[x - x0] ?? 0) + 1;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  return { x0, ink, top, bottom };
}

/** A column holding at most this many ink pixels is empty: a speck of noise is not a stroke. */
const BLANK_COLUMN = 1;

/** The run of empty columns holding column `k`, as a width in px: 0 when column `k` holds ink. */
function blankRunAt(ink: Uint32Array, k: number): number {
  const blank = (j: number): boolean => (ink[j] ?? 0) <= BLANK_COLUMN;
  if (!blank(k)) return 0;
  let a = k;
  let b = k;
  while (a > 0 && blank(a - 1)) a--;
  while (b < ink.length - 1 && blank(b + 1)) b++;
  return b - a + 1;
}

/**
 * Where to cut a long line into `pieces`: near each even division, at the
 * column holding the least ink against the ground around the line (a gap
 * between words holds none), summed over `CUT_SPREAD` of the height each side so
 * the gap between two letters does not count. Each cut comes with the width of
 * the empty run it falls in (0 when it crosses ink), which says whether the
 * readings either side of it join with a word space. Reads each pixel of the box once.
 */
function lineCuts(image: RgbaImageV1, box: RegionBoxV1, pieces: number): Array<{ x: number; gap: number }> {
  if (pieces < 2) return [];
  const columns = columnInk(image, box);
  if (!columns) return [];
  const { x0, ink } = columns;
  const w = ink.length;
  // Summed over a window wider than the gap between two letters and narrower
  // than a word space, so the quietest window is a word space.
  const half = Math.max(1, Math.round(CUT_SPREAD * box.h));
  const at = (k: number): number => {
    let sum = 0;
    for (let j = k - half; j <= k + half; j++) sum += ink[Math.max(0, Math.min(w - 1, j))] ?? 0;
    return sum;
  };
  const step = w / pieces;
  const cuts: Array<{ x: number; gap: number }> = [];
  for (let i = 1; i < pieces; i++) {
    const ideal = Math.round(i * step);
    const reach = Math.max(1, Math.round(CUT_WINDOW * step));
    let best = ideal;
    let bestInk = Number.POSITIVE_INFINITY;
    for (let k = Math.max(1, ideal - reach); k <= Math.min(w - 2, ideal + reach); k++) {
      const r = at(k);
      // Ties go to the column nearest the even division, so the pieces stay even.
      if (r < bestInk || (r === bestInk && Math.abs(k - ideal) < Math.abs(best - ideal))) {
        bestInk = r;
        best = k;
      }
    }
    cuts.push({ x: x0 + best, gap: blankRunAt(ink, best) });
  }
  return cuts;
}

/**
 * A read line whose box does not describe its ink, as boxes tight to each
 * part's ink to read again: split at every empty run wider than
 * `LINE_GAP_SPLIT` of the ink height (a detector does not box one line across a
 * gap that wide, so such a line is two things, a title and a mark beside it or
 * two cells of a table row, whose one reading describes neither), or one part
 * when the ink leaves more than `LOOSE_MARGIN` ink heights of the box empty
 * across (a box around a whole band of colour, whose reading took the band for
 * text). Empty when the box is tight to its ink.
 */
function looseParts(image: RgbaImageV1, box: RegionBoxV1): RegionBoxV1[] {
  const columns = columnInk(image, box);
  if (!columns || columns.bottom < columns.top) return [];
  const { x0, ink, top, bottom } = columns;
  const inkHeight = bottom - top + 1;
  const limit = Math.max(4, LINE_GAP_SPLIT * inkHeight);
  const spans: Array<[number, number]> = [];
  let k = 0;
  while (k < ink.length) {
    while (k < ink.length && !ink[k]) k++;
    if (k >= ink.length) break;
    const start = k;
    let end = k;
    while (k < ink.length) {
      if (ink[k]) {
        end = k;
        k++;
        continue;
      }
      let gap = k;
      while (gap < ink.length && !ink[gap]) gap++;
      if (gap >= ink.length || gap - k > limit) break;
      k = gap;
    }
    spans.push([start, end]);
    k = end + 1;
  }
  const first = spans[0];
  const last = spans[spans.length - 1];
  if (!first || !last) return [];
  const empty = ink.length - (last[1] - first[0] + 1);
  if (spans.length < 2 && empty <= LOOSE_MARGIN * inkHeight) return [];
  return spans.map(([a, b]) => {
    const part = { x: x0 + a, y: box.y, w: b - a + 1, h: box.h };
    const rows = columnInk(image, part);
    return rows && rows.bottom >= rows.top ? { x: part.x, y: rows.top, w: part.w, h: rows.bottom - rows.top + 1 } : part;
  });
}

// ─── the reconstruction ──────────────────────────────────────────────────────

interface Built {
  object: SourceObjectV1;
  /** Box in picture px, for reading order. */
  pictureBox: RegionBoxV1;
  layer: 0 | 1 | 2 | 3;
  /** The region a panel or rule was made from. */
  region?: SlideRegionV1;
}

/** Regions with every parent before its children, keeping the given order otherwise. */
function parentFirst(regions: SlideRegionV1[]): SlideRegionV1[] {
  const ids = new Set(regions.map((r) => r.id));
  const children = new Map<string, SlideRegionV1[]>();
  const roots: SlideRegionV1[] = [];
  for (const r of regions) {
    if (r.parent && ids.has(r.parent) && r.parent !== r.id) {
      const list = children.get(r.parent);
      if (list) list.push(r);
      else children.set(r.parent, [r]);
    } else {
      roots.push(r);
    }
  }
  const out: SlideRegionV1[] = [];
  const placed = new Set<SlideRegionV1>();
  const visit = (r: SlideRegionV1): void => {
    if (placed.has(r)) return;
    placed.add(r);
    out.push(r);
    for (const child of children.get(r.id) ?? []) visit(child);
  };
  for (const r of roots) visit(r);
  // A parent chain that loops has no root; its members keep their given order.
  for (const r of regions) visit(r);
  return out;
}

/**
 * Rebuild a flattened slide from its picture. See the module header. The slide
 * comes back with the picture object replaced by the region objects, in its
 * place in the z-order, and every other object untouched.
 */
export async function reconstructFlattenedSlide(input: ReconstructFlattenedInputV1): Promise<SlideSourceV1> {
  const { slide, picture, sink } = input;
  input.signal?.throwIfAborted();
  const pic = flattenedPictureOf(slide);
  const own = slide.objects.filter((o) => o.origin === 'slide' || o.origin === 'pdf-artifact');
  if (!pic && own.length > 0) {
    // Cutting the picture into regions would keep the slide's own objects and
    // rebuild the same content on top of them.
    return {
      ...slide,
      objects: [...slide.objects],
      readingOrder: [...slide.readingOrder],
      warnings: [
        ...slide.warnings,
        {
          code: 'nodes-truncated',
          message: `${slide.id} is not one picture of the whole slide (it has ${own.length} objects of its own), so it was not rebuilt from a picture.`,
          objectIds: own.map((o) => o.id),
        },
      ],
    };
  }
  const pictureBox: BoxV1 = pic?.box ?? { x: 0, y: 0, w: slide.width, h: slide.height, rot: 0 };
  const out: SlideSourceV1 = {
    ...slide,
    background: { ...slide.background },
    objects: [...slide.objects],
    readingOrder: [...slide.readingOrder],
    warnings: [...slide.warnings],
    origin: { ...slide.origin, flattened: true },
  };
  const missing = input.ocrMissing ?? 'not-run';
  /** The state of an object nobody read: `not-run` when a recogniser was passed, otherwise `missing`. */
  const unreadState: 'not-run' | 'unavailable' = input.ocr ? 'not-run' : missing;
  /** Regions the recogniser was called on, and whether any of them held text. */
  let recognised = 0;
  let textFound = false;
  /** Pictures made from the slide that nobody read: regions kept whole, picture regions, leftover crops. */
  let unread = 0;
  /** The document's own text layer on the picture (a searchable scan), carried onto the regions. */
  const layer = pic?.ocr?.state === 'text-found' && pic.ocr.lines?.length ? pic.ocr : null;
  const reading = (state: 'text-found' | 'no-text-found', model: string | undefined): SlideOcrV1 =>
    model ? { state, model } : { state };
  /** A slide kept as one picture: the reading the slide or its picture already states, else what this run knows. */
  const keptOcr = (): SlideOcrV1 => {
    for (const prior of [slide.ocr, pic?.ocr]) {
      if (prior && (prior.state === 'text-found' || prior.state === 'no-text-found')) return reading(prior.state, prior.model);
    }
    return { state: unreadState };
  };
  /**
   * A rebuilt slide: what its objects now hold. `text-found` when an object
   * carries a reading that found text; `no-text-found` only when the recogniser
   * read every region that could hold text, since a partial reading that found
   * nothing says nothing about the rest.
   */
  const rebuiltOcr = (carried: number): SlideOcrV1 => {
    if (textFound) return reading('text-found', input.ocrModel);
    if (carried > 0 && layer) return reading('text-found', layer.model);
    if (recognised > 0 && unread === 0) return reading('no-text-found', input.ocrModel);
    return { state: unreadState };
  };
  const cache = input.mediaCache ?? new Map<string, string>();
  const store = async (image: RgbaImageV1): Promise<{ ref: string; hash: string }> => {
    // A short hash chain without lazy matching: a crop is stored once and read
    // rarely, so encode time matters more than the last few percent of size.
    const bytes = packPng(image.data, { width: image.width, height: image.height, channels: 4, deflate: CROP_DEFLATE });
    const hash = await sha256Hex(bytes);
    const known = cache.get(hash);
    if (known) return { ref: known, hash };
    const ref = await sink(bytes, 'image/png', hash);
    cache.set(hash, ref);
    return { ref, hash };
  };

  /**
   * The whole-slide picture as the recovery option, written only when no object
   * on the slide holds it: its picture object was replaced, or there never was
   * one (a page render passed in).
   */
  const recover = async (): Promise<void> => {
    const assetRef = pic?.media ?? input.pictureRef ?? (await store(picture)).ref;
    out.recovery = pic ? { assetRef, fromObjectId: pic.id } : { assetRef };
  };

  // A turned or mirrored picture cannot be cut into axis-aligned regions honestly.
  if (pic && (pic.box.rot !== 0 || pic.transform)) {
    out.warnings.push({
      code: 'nodes-truncated',
      message: `The picture of ${slide.id} is turned or mirrored, so it was not cut into regions and stays one picture.`,
      objectIds: [pic.id],
    });
    out.ocr = keptOcr();
    return out;
  }
  // A picture the page shows only part of (its clip) would be rebuilt over its
  // whole box, bringing back what the page hid and laying its ground over that.
  if (pic?.clip) {
    out.warnings.push({
      code: 'nodes-truncated',
      message: `The page shows only part of the picture of ${slide.id} (it is clipped), so it was not cut into regions and stays one picture.`,
      objectIds: [pic.id],
    });
    out.ocr = keptOcr();
    return out;
  }

  const minConfidence = input.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
  const minCoverage = input.minInkCoverage ?? DEFAULT_MIN_INK_COVERAGE;

  // The page reading: the recogniser over the whole picture, so its line boxes
  // are the text whatever the ground. Null when it is not asked for or fails.
  const page = input.ocr && !input.regions && (input.ocrScope ?? 'page') === 'page'
    ? await readPage(picture, input.ocr, {
      maxAspect: input.maxLineAspect ?? DEFAULT_MAX_LINE_ASPECT,
      tile: input.ocrTile ?? DEFAULT_OCR_TILE,
      maxCalls: input.maxOcrCalls ?? DEFAULT_MAX_OCR_CALLS,
      ...(input.signal ? { signal: input.signal } : {}),
    })
    : null;
  if (page) {
    recognised += page.calls;
    if (page.lines.some((l) => l.text.trim())) textFound = true;
  }
  /**
   * The lines of the page reading that are text: stated, and read above the
   * floor. A line that starts with an icon (a row label drawn with a symbol
   * before it) gives the icon up: the line's box and text start after it.
   */
  const leadIcons: RegionBoxV1[] = [];
  const pageText = page
    ? page.lines.filter((l) => meaningful(l, minConfidence)).map((l) => {
      const split = leadingIcon(picture, l);
      if (!split) return l;
      leadIcons.push(split.icon);
      return split.line;
    })
    : [];
  /**
   * The pixels regions are found and ink is measured on: the picture, or with a
   * page reading the picture with its text masked out, so a panel under text is
   * one fill and a picture beside text is boxed without it.
   */
  const canvas: RgbaImageV1 = page && pageText.length
    ? maskedImageOf(picture, [...pageText.map((l) => maskBoxOf(l.box)), ...leadIcons.map((b) => padBox(b, 2))])
    : picture;

  const found = input.regions ?? findSlideRegions(canvas, input.regionOpts);
  if (!found.complete) {
    const warning: SourceWarningV1 = {
      code: 'nodes-truncated',
      message: `Region finding on ${slide.id} stopped at a cap (${found.dropped} regions over it), so the slide stays one picture.`,
      count: found.dropped,
    };
    if (pic) warning.objectIds = [pic.id];
    else await recover();
    out.warnings.push(warning);
    out.ocr = keptOcr();
    return out;
  }

  const sx = pictureBox.w / Math.max(1, picture.width);
  const sy = pictureBox.h / Math.max(1, picture.height);
  const toSlide = (b: RegionBoxV1): BoxV1 => ({
    x: round2(pictureBox.x + b.x * sx),
    y: round2(pictureBox.y + b.y * sy),
    w: round2(b.w * sx),
    h: round2(b.h * sy),
    rot: 0,
  });
  const base = pic?.id ?? `${slide.id}.page`;
  const typesetOpts: TypesetOptsV1 = { pageHeight: picture.height, ...input.typesetOpts };
  const pageGround: InkGroundV1 = found.surface ? { surface: found.surface, width: found.width, height: found.height } : found.background;
  const pageArea = Math.max(1, picture.width * picture.height);

  const built: Built[] = [];
  const skipUnder = new Set<string>();

  /**
   * A picture object of one box of the slide picture, clipped to the picture so
   * its pixels and its slide box agree. `paintOut` (boxes in picture px) is text
   * the crop runs under that is rebuilt on its own, filled from the pixels
   * around it: blended from the nearest (a small stamp), or with `smooth` read
   * from the whole picture around it (`paintOutBoxes`, text set over a
   * photograph); `from` is the image to crop when not the picture itself.
   */
  const pictureObject = async (
    id: string,
    unclipped: RegionBoxV1,
    ocr: OcrEvidenceV1,
    paintOut: RegionBoxV1[] = [],
    from: RgbaImageV1 = picture,
    smooth = false,
  ): Promise<Built> => {
    if (ocr.state === 'not-run' || ocr.state === 'unavailable') unread++;
    const box = clipBox(unclipped, picture) ?? { x: 0, y: 0, w: 1, h: 1 };
    // Always the crop's own PNG, even for a region covering the whole picture:
    // the fingerprint reads the stored bytes' hash, never a sink's ref, and the
    // mime type says what the bytes are.
    const at = cropRgba(from, box);
    const within = paintOut.map((m) => ({ x: m.x - at.x, y: m.y - at.y, w: m.w, h: m.h }));
    const crop: RgbaImageV1 = paintOut.length ? (smooth ? paintOutBoxes(at, within) : maskedImageOf(at, within)) : at;
    const stored = await store(crop);
    const slideBox = toSlide(box);
    const object: SourceObjectV1 = {
      id,
      fingerprint: await fingerprintOf('pic', slideBox, stored.hash),
      kind: 'pic',
      box: slideBox,
      origin: 'raster-region',
      fidelity: { state: 'raster-preserved' },
      media: stored.ref,
      mediaMime: 'image/png',
      ocr,
    };
    return { object, pictureBox: box, layer: 2 };
  };

  const shapeObject = async (region: SlideRegionV1): Promise<Built> => {
    const box = toSlide(region.box);
    const hex = region.evidence.ink;
    const object: SourceObjectV1 = {
      id: `${base}.${region.id}`,
      fingerprint: await fingerprintOf('shape', box, `rect|:${hex}`),
      kind: 'shape',
      box,
      origin: 'raster-region',
      fidelity: { state: 'approximate', reason: 'reader-approximation' },
      geom: 'rect',
      fill: { hex },
    };
    return { object, pictureBox: region.box, layer: region.kind === 'panel' ? 0 : 1, region };
  };

  /**
   * The runs of one paragraph: each line in the colour read from its own ink,
   * and inside a line, with the line's characters read from their pixels
   * (`styleOf`), a stretch drawn in a clearly different colour, or a word set
   * clearly heavier than its neighbours (`heavy`), as a run of its own.
   */
  const runsOf = (
    para: TypesetParagraphV1,
    block: TypesetBlockV1,
    colourOf: (line: TypesetLineV1) => string | null,
    fallback: string,
    bold = false,
    styleOf?: (line: TypesetLineV1) => LineGlyphsV1 | null,
    heavy?: (stem: number | null, capitals: boolean) => boolean,
  ): SourceParaV1['runs'] => {
    const at = new Map(para.lines.map((index, k) => [index, k] as const));
    const lines = block.lines.filter((l) => at.has(l.index)).sort((a, b) => (at.get(a.index) ?? 0) - (at.get(b.index) ?? 0));
    const runs: SourceParaV1['runs'] = [];
    let joined = '';
    for (const line of lines) {
      const piece = line.text.trim();
      if (!piece) continue;
      // The same joining rule as the typesetter: a line ending in a hyphen, or
      // in a dash set close to its word, runs on.
      const sep = joined ? (runsOnAfter(joined) ? '' : ' ') : '';
      joined += sep + piece;
      const hex = colourOf(line) ?? fallback;
      const last = runs[runs.length - 1];
      if (last) last.text += sep;
      for (const part of lineParts(line, piece, hex, bold, styleOf?.(line) ?? null, heavy ?? (() => false))) {
        const tail = runs[runs.length - 1];
        if (tail && tail.color?.hex === part.hex && (tail.bold === true) === part.bold) tail.text += part.text;
        else runs.push(part.bold ? { text: part.text, bold: true, color: { hex: part.hex } } : { text: part.text, color: { hex: part.hex } });
      }
    }
    return joined === para.text && runs.length ? runs : [bold ? { text: para.text, bold: true, color: { hex: fallback } } : { text: para.text, color: { hex: fallback } }];
  };

  /** Text objects, one per run of paragraphs sharing a role, in reading order. */
  const textObjects = async (
    idBase: string,
    block: TypesetBlockV1,
    colourOf: (line: TypesetLineV1) => string | null,
    ink: string,
    evidenceFor: (group: TypesetParagraphV1[], box: BoxV1) => OcrEvidenceV1,
    reason: 'ocr-estimate' | 'reader-approximation',
    estimateRole: boolean,
    boldOf?: (para: TypesetParagraphV1) => boolean,
    styleOf?: (line: TypesetLineV1) => LineGlyphsV1 | null,
    heavyOf?: (para: TypesetParagraphV1) => (stem: number | null, capitals: boolean) => boolean,
  ): Promise<Built[]> => {
    const groups: TypesetParagraphV1[][] = [];
    for (const para of block.paragraphs) {
      const last = groups[groups.length - 1];
      if (last && last[0]?.role === para.role) last.push(para);
      else groups.push([para]);
    }
    const result: Built[] = [];
    for (const [k, group] of groups.entries()) {
      const inPicture = unionOf(group.map((p) => p.box));
      const box = toSlide(inPicture);
      const paras: SourceParaV1[] = group.map((p) => {
        const runs = runsOf(p, block, colourOf, ink, boldOf?.(p) === true, styleOf, heavyOf?.(p));
        if (p.sizePx !== null) {
          const sizePt = Math.round(p.sizePx * sy * PT_PER_PX * 2) / 2;
          for (const run of runs) run.sizePt = sizePt;
        }
        const para: SourceParaV1 = { runs };
        if (p.lvl > 0) para.lvl = p.lvl;
        para.bullet = p.bullet;
        if (p.align) para.align = p.align;
        return para;
      });
      snapInks(paras);
      const text = group.map((p) => p.text).join('\n');
      const object: SourceObjectV1 = {
        id: k === 0 ? idBase : `${idBase}.part${k + 1}`,
        fingerprint: await fingerprintOf('text', box, text),
        kind: 'text',
        box,
        origin: 'raster-region',
        fidelity: { state: 'approximate', reason },
        text: { paras },
        ocr: evidenceFor(group, box),
      };
      const role = group[0]?.role;
      if (role && estimateRole) object.roleEstimate = role;
      result.push({ object, pictureBox: inPicture, layer: 3 });
    }
    return result;
  };

  /** What OCR returned for one reading, every line included, in slide units. */
  const evidenceOf = (read: OcrLine[] | null): OcrEvidenceV1 => {
    const withText = (read ?? []).filter((l) => l.text.trim());
    const evidence: OcrEvidenceV1 = { state: read === null ? missing : withText.length ? 'text-found' : 'no-text-found' };
    if (read?.length) evidence.lines = read.map((l) => ({ text: l.text, confidence: l.confidence, box: toSlide(l.box) }));
    if (input.ocrModel && read !== null) evidence.model = input.ocrModel;
    return evidence;
  };

  /** The evidence of text objects made from `lines` (their typeset indices), with its density. */
  const evidenceFrom = (lines: OcrLine[]) => (group: TypesetParagraphV1[], box: BoxV1): OcrEvidenceV1 => {
    const read = group.flatMap((p) =>
      p.lines.map((i) => {
        const line = lines[i];
        return { text: line?.text ?? '', confidence: line?.confidence ?? 0, box: toSlide(line?.box ?? { x: 0, y: 0, w: 0, h: 0 }) };
      }),
    );
    const text = group.map((p) => p.text).join('');
    const ocr: OcrEvidenceV1 = { state: 'text-found', lines: read };
    ocr.textDensity = round2((text.replace(/\s/g, '').length * 1000) / Math.max(1, box.w * box.h));
    if (input.ocrModel) ocr.model = input.ocrModel;
    return ocr;
  };

  /**
   * The person's typed text as text objects over `area`: on the boxes OCR read
   * when their count matches (sizes measured there), otherwise spread evenly
   * over the area with no title or body guess.
   */
  const typedObjects = async (
    typed: string,
    area: RegionBoxV1,
    readBoxes: RegionBoxV1[],
    groundOf: (box: RegionBoxV1) => InkGroundV1,
    ink: string,
    evidence: OcrEvidenceV1,
    idBase: string,
  ): Promise<Built[]> => {
    const typedLines = typed.split(/\r?\n/).filter((t) => t.trim());
    let lines: OcrLineInputV1[];
    // On OCR's own boxes the sizes are measured; spread evenly over the region
    // they are made up, and a title or body guess from them would be too.
    const onReadBoxes = typedLines.length === readBoxes.length;
    if (onReadBoxes) {
      lines = readBoxes.map((b, i) => ({
        text: typedLines[i] ?? '',
        confidence: 1,
        box: inkBounds(picture, b, groundOf(b), found.threshold) ?? b,
      }));
    } else {
      const h = area.h / typedLines.length;
      lines = typedLines.map((t, i) => ({ text: t, confidence: 1, box: { x: area.x, y: area.y + i * h, w: area.w, h: h / 1.2 } }));
    }
    const block = typesetOcrLines(lines, typesetOpts);
    // The person's text is not a reading: the evidence says what OCR returned.
    return textObjects(idBase, block, (l) => inkColourOf(picture, l.box, groundOf(l.box), found.threshold), ink, () => evidence, 'reader-approximation', onReadBoxes);
  };

  /**
   * Read one region as text, against `ground`. Text objects when the reading (or
   * the person's typed text) explains the region, otherwise the evidence to keep
   * it as a picture with.
   */
  const readRegion = async (
    region: SlideRegionV1,
    decision: FlattenedDecisionV1 | undefined,
    ground: InkGroundV1,
    idBase: string,
  ): Promise<{ text: Built[] } | { picture: OcrEvidenceV1 }> => {
    let read: OcrLine[] | null = null;
    // With a page reading the canvas has the text found there masked out, so a
    // crop of it holds only what that reading missed. A region a person decided
    // on is read whole from the picture: the page reading's blocks inside it
    // are not rebuilt (`keptWhole`), so its text is read here.
    const source = page && decision ? picture : canvas;
    if (input.ocr) {
      const crop = cropRgba(source, region.box, OCR_PAD);
      const lines = await input.ocr({ width: crop.width, height: crop.height, data: crop.data }, region);
      input.signal?.throwIfAborted();
      read = lines.map((l) => ({ ...l, box: { x: l.box.x + crop.x, y: l.box.y + crop.y, w: l.box.w, h: l.box.h } }));
      recognised++;
      if (read.some((l) => l.text.trim())) textFound = true;
    }
    const withText = (read ?? []).filter((l) => l.text.trim());
    const accepted = withText.filter((l) => l.confidence >= minConfidence);
    const rejected = withText.length - accepted.length;
    // The colour a line falls back to when its own box reads none. A panel's
    // own ink is its fill, so its text colour is read against that fill.
    const ink = region.kind === 'panel' ? (inkColourOf(source, region.box, ground, found.threshold) ?? region.evidence.ink) : region.evidence.ink;

    const typed = decision?.keep === 'text' && typeof decision.text === 'string' && decision.text.trim() ? decision.text : null;
    if (typed !== null) {
      return { text: await typedObjects(typed, region.box, accepted.map((l) => l.box), () => ground, ink, evidenceOf(read), idBase) };
    }

    // A line under the confidence floor is neither good text nor a picture on
    // its own, so the region stays one picture with every reading attached.
    if (!accepted.length || rejected > 0) return { picture: evidenceOf(read) };
    const cover = inkCoverage(
      source,
      region.box,
      ground,
      found.threshold,
      accepted.map((l) => padBox(l.box, COVER_PAD * l.box.h)),
    );
    if (cover.share < minCoverage && decision?.keep !== 'text') {
      // The lines leave ink unexplained: an icon, a chart, a photo edge. Rebuilding
      // the text would drop it, so the region stays a picture with the reading attached.
      return { picture: evidenceOf(read) };
    }
    // Sizes are read from the ink, not from the detector's padded boxes.
    const inked = accepted.map((l) => ({
      ...l,
      box: inkBounds(source, l.box, ground, found.threshold) ?? l.box,
    }));
    const block = typesetOcrLines(inked, typesetOpts);
    return { text: await textObjects(idBase, block, (l) => inkColourOf(picture, l.box, ground, found.threshold), ink, evidenceFrom(accepted), 'ocr-estimate', true) };
  };

  // ─── the page reading's blocks ─────────────────────────────────────────────

  /** A block of the page reading: its lines, and whether it is drawn inside a picture. */
  interface PageBlock {
    lines: OcrLine[];
    box: RegionBoxV1;
    /** The picture region the block is drawn in, when it is part of that picture. */
    inPicture?: string;
    /** `tN`, in reading order among the blocks that are text. */
    id?: string;
    /** The drawing standing over the block, when it is a label with one. */
    icon?: RegionBoxV1;
    /** The region a person kept whole (as a picture, or a panel as text) that holds this block, which draws it there. */
    keptIn?: string;
    /** A word in a slide corner with a mark drawn just before it: the two are one logo, kept as one picture. */
    lockup?: RegionBoxV1;
  }
  /**
   * Regions a person decided on: kept whole as a picture, or made text from
   * their own box. Either draws the text the page reading found inside it, so
   * those blocks are not rebuilt a second time.
   */
  const keptWhole = found.regions.filter((r) => input.decisions?.[r.id] !== undefined);
  const blocks: PageBlock[] = [];
  /** The page's rules as barriers between lines (`ruleBarriers`), which also say where a table's rows run. */
  let barriers: RegionBoxV1[] = [];
  if (page && !input.regions) {
    const containers = found.regions.filter((r) => r.kind === 'panel' && areaOf(r.box) <= CONTAINER_MAX_AREA_SHARE * pageArea);
    // The innermost panel holding a line: blocks never cross a panel's edge.
    const containerOf = (b: RegionBoxV1): SlideRegionV1 | undefined => {
      let best: SlideRegionV1 | undefined;
      for (const c of containers) {
        if (insideShare(b, c.box) < CONTAIN_SHARE) continue;
        if (!best || c.depth > best.depth || (c.depth === best.depth && areaOf(c.box) < areaOf(best.box))) best = c;
      }
      return best;
    };
    /** The slide corner a box's centre lies in, or null: a stamp there is set over everything. */
    const cornerOf = (b: RegionBoxV1): string | null => {
      const cx = (b.x + b.w / 2) / picture.width;
      const cy = (b.y + b.h / 2) / picture.height;
      const across = cx < CORNER_BAND ? 'left' : cx > 1 - CORNER_BAND ? 'right' : '';
      const down = cy < CORNER_BAND ? 'top' : cy > 1 - CORNER_BAND ? 'bottom' : '';
      return across && down ? `${down}-${across}` : null;
    };
    // Lines are grouped inside the panel holding them, and a line in a slide
    // corner (a wordmark, a stamp) only with lines in the same corner, so a
    // corner's word never joins the body copy stacked above it.
    const byContainer = new Map<string, OcrLine[]>();
    for (const line of pageText) {
      const held = containerOf(line.box)?.id;
      const corner = held ? null : cornerOf(line.box);
      const key = held ?? (corner ? `~${corner}` : '');
      const list = byContainer.get(key);
      if (list) list.push(line);
      else byContainer.set(key, [line]);
    }
    const pictures = found.regions.filter((r) => r.kind === 'picture').sort((a, b) => areaOf(a.box) - areaOf(b.box));
    // The size the page's body copy is set at: the line height holding the
    // median letter, so a title's few large letters do not set it.
    const byHeight = pageText.map((l) => ({ h: l.box.h, n: letters(l.text) })).sort((a, b) => a.h - b.h);
    const totalLetters = byHeight.reduce((sum, l) => sum + l.n, 0);
    let bodyHeight = 0;
    for (let seen = 0, k = 0; k < byHeight.length; k++) {
      seen += byHeight[k]?.n ?? 0;
      if (seen * 2 >= totalLetters) {
        bodyHeight = byHeight[k]?.h ?? 0;
        break;
      }
    }
    // A rule between two lines (a table's row line) keeps them in separate blocks,
    // with its pieces joined and carried across a panel it runs into.
    barriers = ruleBarriers(
      // A rule lying inside a read line is a glyph of it (a long dash), not a line between two.
      found.regions.filter((r) => r.kind === 'rule' && !pageText.some((l) => centreIn(r.box, l.box))).map((r) => r.box),
      found.regions.filter((r) => r.kind === 'panel' && areaOf(r.box) <= CONTAINER_MAX_AREA_SHARE * pageArea).map((r) => r.box),
      Math.max(RULE_REACH_MIN, RULE_REACH_SHARE * picture.width),
    );
    const rules = barriers;
    for (const key of [...byContainer.keys()].sort()) {
      const lines = byContainer.get(key) ?? [];
      for (const group of ocrTextBlocks(lines, rules)) {
        const members = group.map((i) => lines[i]).filter((l): l is OcrLine => l !== undefined);
        if (!members.length) continue;
        const box = unionOf(members.map((l) => l.box));
        const block: PageBlock = { lines: members, box };
        // Text drawn inside an illustration (a label on a mock-up, a caption on
        // an archive photo) is part of that picture, not the slide's text. Text
        // in a panel is the panel's. A stamp in a slide corner (a generator's
        // mark, a logo's name) is set over everything, so it stays text for the
        // census to judge.
        const glyphs = members.reduce((n, l) => n + letters(l.text), 0);
        if (key.startsWith('~') && glyphs < TITLE_MIN_CHARS) {
          // A glyph or two in a corner, drawn inside a picture (the "Aa" on a
          // mock-up's page), is the drawing's; a stamp names something.
          const host = pictures.find((p) => insideShare(box, p.box) >= INCIDENTAL_INSIDE);
          if (host) block.inPicture = host.id;
        } else if (!key) {
          const host = pictures.find((p) => insideShare(box, p.box) >= INCIDENTAL_INSIDE);
          if (host && areaOf(host.box) < FULL_BLEED_SHARE * pageArea) {
            block.inPicture = host.id;
          } else if (host) {
            // A picture as large as the slide is either the ground the slide's
            // text is set on (a photograph behind a title) or a large drawing
            // (an org chart across the slide). Its labels are what tells them
            // apart: a block of a letter or two (a node's badge, a glyph of the
            // drawing), or set well under the page's body size (a label on a
            // chart), is the drawing's, and the title and body set over a
            // photograph stay text.
            const lineHeight = [...members.map((l) => l.box.h)].sort((a, b) => a - b)[members.length >> 1] ?? box.h;
            if (glyphs < TITLE_MIN_CHARS || (bodyHeight > 0 && lineHeight < LABEL_SIZE_SHARE * bodyHeight)) block.inPicture = host.id;
          }
        }
        const kept = keptWhole.find((r) => insideShare(box, r.box) >= KEPT_INSIDE);
        if (kept) block.keptIn = kept.id;
        blocks.push(block);
      }
    }
  }
  const contentBlocks = blocks.filter((b) => b.inPicture === undefined);
  // Ids in reading order, so a decision keyed `t3` names the same block on every
  // run over the same reading, whatever a person kept whole since.
  for (const [k, index] of readingOrderOf(contentBlocks.map((b) => b.box)).order.entries()) {
    const block = contentBlocks[index];
    if (block) block.id = `t${k + 1}`;
  }
  /** The blocks rebuilt as text: not drawn by a region a person kept whole. */
  const liveBlocks = contentBlocks.filter((b) => b.keptIn === undefined);
  // A label with a drawing standing over it (a card's icon over its heading):
  // the drawing is found under the masked text, so it is cropped tight, and the
  // two are one unit.
  for (const block of liveBlocks) {
    if (block.lines.length > LABEL_MAX_LINES || block.box.w > LABEL_MAX_WIDTH_SHARE * picture.width) continue;
    const lineHeight = [...block.lines.map((l) => l.box.h)].sort((a, b) => a - b)[block.lines.length >> 1] ?? block.box.h;
    const bottom = block.box.y - 0.1 * lineHeight;
    let top = Math.max(0, block.box.y - ICON_REACH_LINES * lineHeight);
    for (const other of liveBlocks) {
      if (other === block) continue;
      const shared = Math.min(other.box.x + other.box.w, block.box.x + block.box.w) - Math.max(other.box.x, block.box.x);
      const end = other.box.y + other.box.h;
      if (shared > 0 && end <= block.box.y && end > top) top = end + 0.1 * lineHeight;
    }
    if (bottom - top < lineHeight) continue;
    const reach = 0.1 * block.box.w;
    const window = { x: block.box.x - reach, y: top, w: block.box.w + 2 * reach, h: bottom - top };
    const icon = inkAbove(canvas, window, block.box, lineHeight, ICON_THRESHOLD, ICON_REACH_LINES);
    if (icon) block.icon = icon;
  }
  // A word or two in a slide corner with a mark drawn just before it (a logo's
  // symbol and its name) is one logo: kept as one picture, which a rebrand
  // replaces whole, rather than a word of text beside a cut-off symbol.
  for (const block of liveBlocks) {
    if (block.lines.length !== 1 || !cornerBlock(block.box, picture)) continue;
    const words = (block.lines[0]?.text ?? '').trim().split(/\s+/).length;
    if (words > LOCKUP_MAX_WORDS || letters(block.lines[0]?.text ?? '') < 2) continue;
    const mark = markBefore(canvas, picture, block.box, found.threshold);
    if (mark) block.lockup = unionOf([mark, block.box]);
  }
  const iconBoxes = [...liveBlocks.flatMap((b) => (b.icon ? [b.icon] : b.lockup ? [b.lockup] : [])), ...leadIcons];
  /** Text the page reading turned into text objects, and the icons over labels: a picture kept around them leaves them out. */
  const textBoxes = [...liveBlocks.flatMap((b) => b.lines.map((l) => maskBoxOf(l.box))), ...iconBoxes];
  /** A region an icon over a label owns: the icon's crop draws it. */
  const ownedByIcon = (region: SlideRegionV1): boolean => iconBoxes.some((icon) => insideShare(region.box, icon) >= ICON_OWNS);

  /**
   * Whether a box of a page reading's region is a picture someone placed: not a
   * sliver (what a rule leaves at a crossing, a piece of a line the text mask
   * cut), not mostly the pixels of a rule already rebuilt as one (a divider's
   * crossing), and not a patch of plain ground (a gradient between cards).
   */
  const ruleBoxes = found.regions.filter((r) => r.kind === 'rule').map((r) => padBox(r.box, 2));
  const placedPicture = (box: RegionBoxV1, region: SlideRegionV1): boolean => {
    const short = Math.min(picture.width, picture.height);
    const side = Math.min(box.w, box.h);
    if (side < PICTURE_MIN_SIDE * short) return false;
    if (Math.max(box.w, box.h) / Math.max(1, side) > SLIVER_ASPECT && side < SLIVER_SIDE * short) return false;
    if (ruleBoxes.length) {
      const ground = outlineColourOf(canvas, padBox(box, 2)) ?? found.background;
      if (inkCoverage(canvas, box, ground, found.threshold, ruleBoxes).share >= RULE_OWNED) return false;
    }
    // Continuous tone is a photograph however soft its focus; only a region
    // with no such colours needs detail to be more than ground.
    return region.evidence.reason === 'continuous-tone' || detailShare(canvas, box) >= PICTURE_MIN_DETAIL;
  };

  /**
   * The text a crop of a picture may run under and paint out: a stamp in a
   * slide corner (a generator's mark), which the census judges on its own and a
   * photograph running to the corner should not stop short of.
   */
  const stampBoxes = liveBlocks
    .filter((b) => b.lines.length === 1 && !b.lockup && areaOf(b.box) <= STAMP_MAX_AREA * pageArea && cornerBlock(b.box, picture))
    .map((b) => maskBoxOf(b.box));
  const unstamped = textBoxes.filter((t) => !stampBoxes.some((m) => insideShare(t, m) >= 0.9));
  /** Picture regions a page reading cut to the part clear of text, those it left out, and those kept whole under their text. */
  let truncated = 0;
  let dropped = 0;
  let underText = 0;

  /**
   * Whether the text crossing a picture region is set on the picture itself (a
   * title over a photograph, body copy over a faded drawing) rather than on
   * plain ground inside its box: the ground around those lines, with the text
   * masked out, holds the picture's detail. The median line decides, so an icon
   * the detector boxed as a line does not.
   */
  const textOnPicture = (region: SlideRegionV1): boolean => {
    const crossing = textBoxes.filter((t) => insideShare(t, region.box) > 0.5);
    if (crossing.length === 0) return false;
    const around = crossing.map((t) => detailShare(canvas, padBox(t, 0.3 * Math.min(t.h, ON_PICTURE_PAD)))).sort((a, b) => a - b);
    return (around[Math.floor((around.length - 1) / 2)] ?? 0) >= ON_PICTURE_DETAIL;
  };

  /**
   * A picture running to two opposite edges of the slide and one side, whose
   * margin to the fourth edge holds picture detail too (`ON_PICTURE_DETAIL`),
   * runs to that edge: a photograph set full bleed that the ground finder met
   * at the border and took for the slide's ground.
   */
  const bleedOf = (box: RegionBoxV1): RegionBoxV1 => {
    const W = picture.width;
    const H = picture.height;
    const near = (v: number, edge: number): boolean => Math.abs(v - edge) <= BLEED_EDGE * Math.max(W, H);
    const tall = near(box.y, 0) && near(box.y + box.h, H);
    const wide = near(box.x, 0) && near(box.x + box.w, W);
    // A photograph in soft shadow holds little detail; a flat or graded panel none.
    const busy = (b: RegionBoxV1): boolean => b.w > 1 && b.h > 1 && detailShare(canvas, b) >= ON_PICTURE_DETAIL;
    let out = box;
    if (tall && near(box.x + box.w, W) && box.x > 0 && busy({ x: 0, y: 0, w: box.x, h: H })) out = { ...out, x: 0, w: out.x + out.w };
    if (tall && near(box.x, 0) && box.x + box.w < W && busy({ x: box.x + box.w, y: 0, w: W - box.x - box.w, h: H })) out = { ...out, w: W - out.x };
    if (wide && near(box.y + box.h, H) && box.y > 0 && busy({ x: 0, y: 0, w: W, h: box.y })) out = { ...out, y: 0, h: out.y + out.h };
    if (wide && near(box.y, 0) && box.y + box.h < H && busy({ x: 0, y: box.y + box.h, w: W, h: H - box.y - box.h })) out = { ...out, h: H - out.y };
    return out;
  };

  /**
   * A picture region of a page reading: its largest box free of the slide's text
   * (all of it when no text crosses it), with every line read inside that box as
   * its evidence, and a corner stamp it runs under painted out. Null when text
   * covers so much of it that no useful part is left, or what is left is a sliver
   * or plain ground; the recovery picture still holds it, and the slide's warning
   * counts it.
   */
  const pagePicture = async (region: SlideRegionV1, read?: OcrEvidenceV1): Promise<Built | null> => {
    // Only a picture a good part of the slide runs under a stamp: a small one
    // beside it (a logo's mark) stops short of it.
    const large = areaOf(region.box) >= STAMP_UNDER_SHARE * pageArea;
    const free = largestFreeBox(region.box, large ? unstamped : textBoxes);
    // Text set on the picture itself: the picture is kept whole, to the slide's
    // edge when it runs full bleed, with that text painted out of it (the
    // masked picture), so the rebuilt text is drawn once. Cutting it to the part
    // clear of the text would leave the text on a flat panel of the slide's ground.
    if ((!free || areaOf(free) < ON_PICTURE_FREE * areaOf(region.box)) && textOnPicture(region)) {
      const box = bleedOf(region.box);
      underText++;
      const inside = (page?.lines ?? []).filter((l) => l.text.trim() && centreIn(l.box, box) && !textBoxes.some((t) => centreIn(l.box, t)));
      const evidence = evidenceOf(inside);
      if (read?.lines?.length) {
        evidence.lines = [...(evidence.lines ?? []), ...read.lines];
        evidence.state = 'text-found';
      }
      // Only the lines rebuilt as text leave the picture; a label drawn in it stays.
      const over = pageText.filter((l) => textBoxes.some((t) => centreIn(l.box, t))).map((l) => maskBoxOf(l.box)).filter((m) => insideShare(m, box) > 0);
      return pictureObject(`${base}.${region.id}`, box, evidence, over, picture, true);
    }
    if (!free || areaOf(free) < FREE_MIN_SHARE * areaOf(region.box) || !placedPicture(free, region)) {
      if (placedPicture(region.box, region)) dropped++;
      return null;
    }
    if (areaOf(free) < 0.99 * areaOf(region.box)) truncated++;
    const inside = (page?.lines ?? []).filter((l) => l.text.trim() && centreIn(l.box, free) && !textBoxes.some((t) => centreIn(l.box, t)));
    // A region read again on its own keeps that reading beside what the page reading saw in it.
    const evidence = evidenceOf(inside);
    if (read?.lines?.length) {
      evidence.lines = [...(evidence.lines ?? []), ...read.lines];
      evidence.state = 'text-found';
    }
    const under = large ? stampBoxes.filter((m) => insideShare(m, free) > 0) : [];
    return pictureObject(`${base}.${region.id}`, free, evidence, under);
  };

  // Boxes drawn as outlines (a callout's frame): one rectangle with its outline,
  // in place of the four rules that draw it and of a panel of its own fill inside.
  const outlines = page
    ? outlinedBoxes(found).filter((o) => areaOf(o.box) >= OUTLINE_MIN_AREA_SHARE * pageArea && areaOf(o.box) <= CONTAINER_MAX_AREA_SHARE * pageArea)
    : [];
  const outlineRules = new Set(outlines.flatMap((o) => o.rules));
  const outlineFills = outlines.map((o) => {
    const inset = Math.ceil(o.thickness) + OUTLINE_INSET;
    return outlineColourOf(canvas, { x: o.box.x + inset, y: o.box.y + inset, w: o.box.w - 2 * inset, h: o.box.h - 2 * inset }) ?? found.background;
  });
  for (const [k, o] of outlines.entries()) {
    const region: SlideRegionV1 = { ...readingRegion(`o${k + 1}`, o.box), kind: 'panel' };
    const box = toSlide(o.box);
    const fill = outlineFills[k] ?? found.background;
    const object: SourceObjectV1 = {
      id: `${base}.o${k + 1}`,
      fingerprint: await fingerprintOf('shape', box, `rect|:${fill}|${o.line}`),
      kind: 'shape',
      box,
      origin: 'raster-region',
      fidelity: { state: 'approximate', reason: 'reader-approximation' },
      geom: 'rect',
      fill: { hex: fill },
      line: { color: { hex: o.line }, widthPt: Math.max(0.25, Math.round(o.thickness * sy * PT_PER_PX * 4) / 4) },
    };
    built.push({ object, pictureBox: o.box, layer: 0, region });
  }
  /** A panel of an outlined box's own fill, lying inside it: the outline's rectangle already draws it. */
  const outlineFillPanel = (region: SlideRegionV1): boolean =>
    region.kind === 'panel' && outlines.some((o, k) => insideShare(region.box, o.box) >= 0.9 && sameColour(region.evidence.ink, outlineFills[k] ?? ''));

  const regions = parentFirst(found.regions);
  const byId = new Map(regions.map((r) => [r.id, r] as const));
  /** Whether an ancestor was kept whole, walking the whole parent chain. */
  const underKept = (region: SlideRegionV1): boolean => {
    const seen = new Set<string>();
    for (let id = region.parent; id !== undefined && !seen.has(id); id = byId.get(id)?.parent) {
      if (skipUnder.has(id)) return true;
      seen.add(id);
    }
    return false;
  };

  for (const region of regions) {
    input.signal?.throwIfAborted();
    if (underKept(region)) {
      skipUnder.add(region.id);
      continue;
    }
    const decision = input.decisions?.[region.id];
    if (page && !decision && region.kind !== 'panel' && region.kind !== 'rule' && ownedByIcon(region)) continue;
    // A region covering most of the panel it was found in is that panel's own
    // shading (a gradient fill), which the panel's rectangle already carries.
    const holder = region.parent ? byId.get(region.parent) : undefined;
    if (page && !decision && holder?.kind === 'panel' && region.kind !== 'panel' && areaOf(region.box) >= PANEL_SHADING * areaOf(holder.box)) continue;
    if (page && !decision && region.kind === 'rule' && outlineRules.has(region.id)) continue;
    // A rule lying inside a read line is what the mask left of a letter's stem
    // or a long dash: the text object draws it.
    if (page && !decision && region.kind === 'rule' && pageText.some((l) => centreIn(region.box, maskBoxOf(l.box)))) continue;
    // What the panel's own search found inside it is still read, less the rules
    // that draw the outline, which are the outline already.
    if (page && !decision && outlineFillPanel(region)) continue;
    if (decision?.keep === 'picture') {
      // A panel kept whole carries its contents with it, so nothing inside is
      // rebuilt twice. Lines the page reading found inside it are its evidence;
      // with none, it was not read on its own and says so.
      skipUnder.add(region.id);
      const inside = page ? page.lines.filter((l) => l.text.trim() && centreIn(l.box, region.box)) : [];
      built.push(await pictureObject(`${base}.${region.id}`, region.box, inside.length ? evidenceOf(inside) : { state: unreadState }));
      continue;
    }
    if (region.kind === 'panel' && decision?.keep === 'text') {
      // The panel's text is read against its own fill and put on the rectangle;
      // what was found inside it is read as part of that text, not again.
      skipUnder.add(region.id);
      const result = await readRegion(region, decision, region.evidence.ink, `${base}.${region.id}.text`);
      if ('text' in result) built.push(await shapeObject(region), ...result.text);
      else built.push(await pictureObject(`${base}.${region.id}`, region.box, result.picture));
      continue;
    }
    if ((region.kind === 'panel' || region.kind === 'rule') && decision?.keep !== 'text') {
      built.push(await shapeObject(region));
      continue;
    }
    if (region.kind === 'picture' && decision?.keep !== 'text') {
      if (page) {
        const kept = await pagePicture(region);
        if (kept) built.push(kept);
      } else {
        built.push(await pictureObject(`${base}.${region.id}`, region.box, { state: unreadState }));
      }
      continue;
    }

    // A text region, or a region the person asked to become text. With a page
    // reading this is ink the reading did not explain: text it missed, or an icon.
    const result = await readRegion(region, decision, groundOfRegion(found, region), `${base}.${region.id}`);
    if ('text' in result) built.push(...result.text);
    else if (!page || decision) built.push(await pictureObject(`${base}.${region.id}`, region.box, result.picture));
    else if (result.picture.lines?.some((l) => l.text.trim())) {
      // The recogniser saw text here that is not good enough to rebuild: the
      // region stays a picture whole, as the region reading keeps it, cropped
      // from the masked picture so the page reading's rebuilt text is not
      // drawn in it a second time.
      built.push(await pictureObject(`${base}.${region.id}`, region.box, result.picture, [], canvas));
    } else {
      const kept = await pagePicture(region, result.picture);
      if (kept) built.push(kept);
    }
  }
  if (truncated + dropped + underText > 0) {
    const parts: string[] = [];
    if (underText) parts.push(`${underText} ${underText === 1 ? 'picture was' : 'pictures were'} kept whole with the text set over ${underText === 1 ? 'it' : 'them'} painted out`);
    if (truncated) parts.push(`${truncated} ${truncated === 1 ? 'picture was' : 'pictures were'} cut to the part clear of the slide's text`);
    if (dropped) parts.push(`${dropped} ${dropped === 1 ? 'picture was' : 'pictures were'} left out, since the text covers too much of ${dropped === 1 ? 'it' : 'them'}`);
    out.warnings.push({
      code: 'nodes-truncated',
      message: `On ${slide.id}, ${parts.join(', and ')}; the recovery picture keeps the whole slide.`,
      count: truncated + dropped + underText,
    });
  }

  // The page reading's text, a block at a time in reading order. Each line's
  // ground and colour are read inside its own box, column by column, so text on
  // a photograph or a gradient is measured against what it is set on.
  if (page) {
    const localGround = (b: RegionBoxV1): InkGroundV1 => lineInkColourOf(picture, b)?.ground ?? outlineColourOf(picture, padBox(b, 0.3 * b.h)) ?? found.background;
    // What each line's pixels say about its characters: a quote or a dash the
    // recogniser read plain where the drawing is the typographic one, the colour
    // of each character and the weight of each word (`lineGlyphsOf`).
    const glyphs = new Map<OcrLine, LineGlyphsV1 | null>();
    for (const block of liveBlocks) {
      const own = apart(block.lines);
      block.lines.forEach((l, i) => {
        glyphs.set(l, lineGlyphsOf(picture, own[i] ?? l.box, l.text));
      });
    }
    const inkedOf = (block: PageBlock): OcrLineInputV1[] =>
      apart(block.lines).map((box, i) => {
        const l = block.lines[i];
        const text = (l ? glyphs.get(l)?.text : undefined) ?? l?.text ?? '';
        return { text, confidence: l?.confidence ?? 0, box: textBoundsOf(picture, box, localGround(box), found.threshold) ?? box };
      });
    // Blocks are typeset apart, so a title is judged against the page: a
    // paragraph well under the page's largest size is body however large it is.
    let largest = 0;
    for (const block of liveBlocks) {
      for (const para of typesetOcrLines(inkedOf(block), typesetOpts).paragraphs) {
        // A stray letter a drawing gave up is not the page's title size.
        if (para.text.replace(/[^\p{L}\p{N}]/gu, '').length < TITLE_MIN_CHARS) continue;
        largest = Math.max(largest, para.sizePx ?? 0);
      }
    }
    const pageTypeset: TypesetOptsV1 = largest > 0 ? { ...typesetOpts, minTitlePx: largest / TITLE_SIZE_RATIO } : typesetOpts;
    const typesetOf = new Map<PageBlock, TypesetBlockV1>();
    for (const block of liveBlocks) typesetOf.set(block, snapSizes(typesetOcrLines(inkedOf(block), pageTypeset)));
    /**
     * A typeset line's glyphs. A typeset line can join fragments read apart on
     * one row: their glyphs are joined the way the typesetter joins their text,
     * with one space.
     */
    const styleIn = (block: PageBlock, line: TypesetLineV1): LineGlyphsV1 | null => {
      const parts = line.parts.map((index) => {
        const read = block.lines[index];
        return read ? glyphs.get(read) ?? null : null;
      });
      if (parts.length === 0 || parts.some((part) => part === null)) return null;
      const joined: LineGlyphsV1 = { text: '', inks: [], stems: [], measured: 0, inkHeight: 0 };
      parts.forEach((part, k) => {
        if (!part) return;
        if (k > 0) {
          joined.text += ' ';
          joined.inks.push(null);
          joined.stems.push(null);
        }
        joined.text += part.text;
        joined.inks.push(...part.inks);
        joined.stems.push(...part.stems);
        joined.measured += part.measured;
        joined.inkHeight = Math.max(joined.inkHeight, part.inkHeight);
      });
      return joined;
    };
    /** Every word of a paragraph with the width of its stems in px and its letters. */
    const wordsOf = (block: PageBlock, typeset: TypesetBlockV1, para: TypesetParagraphV1): WordStemV1[] =>
      typeset.lines.filter((line) => para.lines.includes(line.index)).flatMap((line) => wordStems(styleIn(block, line)));
    // How heavy each line's letters are, against the page's usual weight (the
    // median line by letters): a paragraph well over it is set bold. A line or
    // a paragraph only part of which is bold reads as its usual weight.
    const weight = new Map<OcrLine, number>();
    for (const block of liveBlocks) {
      const own = apart(block.lines);
      block.lines.forEach((l, i) => {
        const box = own[i] ?? l.box;
        const ink = lineInkColourOf(picture, box)?.ink;
        const ratio = ink ? strokeRatioOf(picture, textBoundsOf(picture, box, localGround(box), found.threshold) ?? box, ink) : null;
        if (ratio !== null) weight.set(l, ratio);
      });
    }
    const byWeight = [...weight.entries()].map(([l, r]) => ({ r, n: letters(l.text) }));
    const usualWeight = byWeight.length >= 2 ? weightedMedian(byWeight) : 0;
    // The stems of every paragraph's words, with its size, so a paragraph set
    // heavier than the other paragraphs of its size on the page (a bold closing
    // line under regular body) is bold too.
    const sized: Array<{ para: TypesetParagraphV1; size: number; words: WordStemV1[] }> = [];
    for (const [block, typeset] of typesetOf) {
      for (const para of typeset.paragraphs) sized.push({ para, size: para.sizePx ?? 0, words: wordsOf(block, typeset, para) });
    }
    const heavierThanPeers = (para: TypesetParagraphV1): boolean => {
      const own = sized.find((one) => one.para === para);
      if (!own || own.size <= 0 || own.words.length === 0) return false;
      const peers = sized.filter((one) => one.para !== para && one.size > 0 && Math.abs(one.size - own.size) <= PEER_SIZE * own.size).flatMap((one) => one.words);
      if (peers.reduce((n, w) => n + w.letters, 0) < PEER_MIN_LETTERS) return false;
      const mine = weightedMedian(own.words.map((w) => ({ r: w.stem, n: w.letters })));
      return mine >= BOLD_RATIO * weightedMedian(peers.map((w) => ({ r: w.stem, n: w.letters })));
    };
    const cards: Array<{ icon: Built; texts: Built[] }> = [];
    for (const block of [...liveBlocks].sort((a, b) => Number(a.id?.slice(1)) - Number(b.id?.slice(1)))) {
      input.signal?.throwIfAborted();
      const id = block.id ?? 't0';
      const idBase = `${base}.${id}`;
      const decision = input.decisions?.[id];
      if (decision?.keep === 'picture' || (block.lockup && decision?.keep !== 'text')) {
        // A logo's picture stops above a stamp set just under it, and runs under
        // one set across it with the stamp painted out.
        const own = maskBoxOf(block.box);
        let box = block.lockup ?? block.box;
        const under: RegionBoxV1[] = [];
        if (block.lockup && decision?.keep !== 'picture') {
          for (const m of stampBoxes.filter((b) => insideShare(b, own) < 0.9 && insideShare(b, box) > 0)) {
            if (m.y > box.y + 0.5 * box.h && m.y > block.box.y + 0.5 * block.box.h) box = { ...box, h: m.y - box.y };
            else under.push(m);
          }
        }
        built.push(await pictureObject(idBase, box, evidenceOf(block.lines), under));
        continue;
      }
      const ink = lineInkColourOf(picture, block.box)?.ink ?? inkColourOf(picture, block.box, localGround(block.box), found.threshold) ?? found.background;
      const typed = decision?.keep === 'text' && typeof decision.text === 'string' && decision.text.trim() ? decision.text : null;
      if (typed !== null) {
        built.push(...(await typedObjects(typed, block.box, block.lines.map((l) => l.box), localGround, ink, evidenceOf(block.lines), idBase)));
        continue;
      }
      const typeset = typesetOf.get(block) ?? snapSizes(typesetOcrLines(inkedOf(block), pageTypeset));
      // A line's colour from its own detector box (kept apart from its
      // neighbours), where the ground around the letters is.
      const own = apart(block.lines);
      const colourOf = (line: TypesetLineV1): string | null => lineInkColourOf(picture, own[line.index] ?? line.box)?.ink ?? null;
      // A paragraph is bold when its lines, weighed by their letters, are, or
      // when it is set heavier than the other paragraphs of its size.
      const boldOf = (para: TypesetParagraphV1): boolean => {
        if (heavierThanPeers(para)) return true;
        if (usualWeight <= 0) return false;
        let sum = 0;
        let n = 0;
        for (const index of para.lines) {
          const line = block.lines[index];
          const ratio = line ? weight.get(line) : undefined;
          if (!line || ratio === undefined) continue;
          sum += ratio * letters(line.text);
          n += letters(line.text);
        }
        return n > 0 && sum / n >= BOLD_RATIO * usualWeight;
      };
      // A word inside a paragraph is bold when its stems are well wider than
      // the paragraph's usual word, all of one size; a word in capitals, whose
      // round letters read wider in any weight, when they are much wider.
      const heavyOf = (para: TypesetParagraphV1): ((stem: number | null, capitals: boolean) => boolean) => {
        const words = wordsOf(block, typeset, para);
        const usualHere = words.length >= 2 ? weightedMedian(words.map((w) => ({ r: w.stem, n: w.letters }))) : 0;
        return (stem, capitals) => stem !== null && usualHere > 0 && stem >= (capitals ? CAPITALS_BOLD_RATIO : WORD_BOLD_RATIO) * usualHere;
      };
      const styleOf = (line: TypesetLineV1): LineGlyphsV1 | null => styleIn(block, line);
      const texts = await textObjects(idBase, typeset, colourOf, ink, evidenceFrom(block.lines), 'ocr-estimate', true, boldOf, styleOf, heavyOf);
      built.push(...texts);
      if (block.icon) {
        const inside = (page?.lines ?? []).filter((l) => l.text.trim() && centreIn(l.box, block.icon ?? l.box) && !textBoxes.some((t) => t !== block.icon && centreIn(l.box, t)));
        const icon = await pictureObject(`${idBase}.icon`, block.icon, evidenceOf(inside));
        built.push(icon);
        cards.push({ icon, texts });
      }
    }
    for (const [k, box] of leadIcons.entries()) {
      if (keptWhole.some((r) => insideShare(box, r.box) >= KEPT_INSIDE)) continue;
      built.push(await pictureObject(`${base}.i${k + 1}`, box, evidenceOf([])));
    }
    // A card drawn as a filled or shaded panel with no flat fill of its own (a
    // gradient card with a shadow) is not a colour region, so the icon and label
    // on it would sit on the slide's ground. Its edge is found by colour from the
    // unit outwards, and the panel is rebuilt as a rectangle of its own colour.
    const panelsFound = built.filter((b) => b.layer === 0 && b.region?.kind === 'panel');
    const cardBoxes: RegionBoxV1[] = [];
    for (const [k, card] of cards.entries()) {
      const unit = unionOf([card.icon.pictureBox, ...card.texts.map((t) => t.pictureBox)]);
      if (panelsFound.some((p) => insideShare(unit, p.pictureBox) >= CONTAIN_SHARE)) continue;
      const edge = cardEdgeOf(picture, unit);
      if (!edge || areaOf(edge) > CONTAINER_MAX_AREA_SHARE * pageArea || cardBoxes.some((c) => insideShare(edge, c) > 0.1)) continue;
      cardBoxes.push(edge);
      const inset = Math.max(2, Math.round(CARD_STEP_SHARE * Math.min(picture.width, picture.height)) * 2);
      const fill = outlineColourOf(picture, { x: edge.x + inset, y: edge.y + inset, w: edge.w - 2 * inset, h: edge.h - 2 * inset }) ?? found.background;
      const region: SlideRegionV1 = { ...readingRegion(`c${k + 1}`, edge), kind: 'panel' };
      region.evidence = { ...region.evidence, reason: 'flat-fill', ink: fill, ground: found.background };
      built.push(await shapeObject(region));
    }
    // A panel drawn soft (a frosted card over a photograph, a shaded box)
    // under text that sits on no panel found so far is found by its edge, as a
    // card's is: text standing close together is one unit, and its panel must
    // leave room on every side of it and hold no other text.
    const onPanel = (b: RegionBoxV1): boolean =>
      built.some((p) => p.layer === 0 && p.region?.kind === 'panel' && insideShare(b, p.pictureBox) >= CONTAIN_SHARE)
      || cardBoxes.some((c) => insideShare(b, c) >= CONTAIN_SHARE);
    const loose = built.filter((b) => b.object.kind === 'text' && !cornerBlock(b.pictureBox, picture) && !onPanel(b.pictureBox));
    const joinedTo = loose.map((_, i) => i);
    const rootOf = (i: number): number => {
      let r = i;
      while ((joinedTo[r] ?? r) !== r) r = joinedTo[r] ?? r;
      return r;
    };
    for (let i = 0; i < loose.length; i++) {
      for (let j = i + 1; j < loose.length; j++) {
        const a = loose[i]?.pictureBox;
        const b = loose[j]?.pictureBox;
        if (!a || !b) continue;
        const across = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const gap = Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h);
        if (across >= 0.5 * Math.min(a.w, b.w) && gap <= SOFT_PANEL_GAP * Math.min(a.h, b.h)) joinedTo[rootOf(j)] = rootOf(i);
      }
    }
    const clusters = new Map<number, Built[]>();
    loose.forEach((b, i) => {
      const r = rootOf(i);
      const list = clusters.get(r);
      if (list) list.push(b);
      else clusters.set(r, [b]);
    });
    const edgeStep = Math.max(2, Math.round(CARD_STEP_SHARE * Math.min(picture.width, picture.height)));
    const margin = Math.max(SOFT_PANEL_MIN_STRIPS * edgeStep, SOFT_PANEL_MIN_MARGIN * Math.min(picture.width, picture.height));
    let soft = 0;
    for (const members of clusters.values()) {
      const unit = unionOf(members.map((m) => m.pictureBox));
      // The edge is looked for past the margin a panel leaves, clear of the
      // anti-aliased edges of the text's own letters.
      const edge = cardEdgeOf(picture, unit, Math.ceil(margin / edgeStep) + 1);
      if (!edge || areaOf(edge) > CONTAINER_MAX_AREA_SHARE * pageArea) continue;
      const room = Math.min(unit.x - edge.x, unit.y - edge.y, edge.x + edge.w - unit.x - unit.w, edge.y + edge.h - unit.y - unit.h);
      if (room < margin) continue;
      // Other text inside the panel, or just outside it, says the edge is that
      // text's own ink, not a panel's.
      const reach = padBox(edge, margin);
      if (built.some((b) => !members.includes(b) && b.object.kind === 'text' && insideShare(b.pictureBox, reach) > 0)) continue;
      // An edge a drawn rule makes is a table's cell or a ruled frame, which the
      // rules already draw.
      const band = padBox(edge, margin / 2);
      if (ruleBoxes.some((r) => insideShare(r, band) > 0 && insideShare(r, padBox(unit, (room + margin) / 2)) < 1)) continue;
      if (built.some((b) => b.layer === 0 && b.region?.kind === 'panel' && insideShare(b.pictureBox, edge) > 0.1) || cardBoxes.some((c) => insideShare(c, edge) > 0.1)) continue;
      soft++;
      const inset = Math.max(2, Math.round(room / 2));
      const fill = outlineColourOf(picture, { x: edge.x + inset, y: edge.y + inset, w: edge.w - 2 * inset, h: edge.h - 2 * inset }) ?? found.background;
      const region: SlideRegionV1 = { ...readingRegion(`s${soft}`, edge), kind: 'panel' };
      region.evidence = { ...region.evidence, reason: 'flat-fill', ink: fill, ground: found.background };
      built.push(await shapeObject(region));
    }
    groupUnits(built, base, pageArea, cards, barriers);
    // Text set at an angle inside a picture (a label along a curved arrow):
    // the recogniser reads lines level, so it returns such text unsure and
    // boxed tall, or not at all. When such a reading lies over ink running at
    // an angle, the text stays part of the picture, and the slide says so.
    const heights = pageText.map((l) => l.box.h).sort((a, b) => a - b);
    const usualLine = heights[Math.floor((heights.length - 1) / 2)] ?? 0;
    const holders = new Set<string>();
    const angled: RegionBoxV1[] = [];
    for (const l of page.lines) {
      if (meaningful(l, minConfidence) || usualLine <= 0 || l.box.h < ANGLED_MIN_HEIGHT * usualLine) continue;
      const holder = built.find((b) => b.object.kind === 'pic' && centreIn(l.box, b.pictureBox));
      if (!holder || angled.some((b) => insideShare(l.box, b) > 0.5)) continue;
      const axis = inkAngleOf(picture, l.box, outlineColourOf(picture, padBox(l.box, 2)) ?? found.background);
      const tilt = axis ? Math.abs(axis.degrees) : 0;
      if (!axis || axis.elongation < ANGLED_MIN_ELONGATION || tilt < ANGLED_MIN_DEGREES || tilt > 90 - ANGLED_MIN_DEGREES) continue;
      angled.push(l.box);
      holders.add(holder.object.id);
    }
    if (angled.length > 0) {
      out.warnings.push({
        code: 'nodes-truncated',
        message: `On ${slide.id}, text set at an angle inside a picture cannot be read level, so it stays part of the picture.`,
        objectIds: [...holders].sort(),
      });
    }
    // A text box measured to its ink wraps mid-word in another face: each is
    // given room to its side, up to the next object, its panel's edge or the
    // slide's, so a font swap can re-wrap it without running into its neighbours.
    for (const b of built) {
      if (b.object.kind !== 'text') continue;
      const wider = roomToWiden(b, built, picture);
      if (!wider) continue;
      const box = toSlide(wider);
      const text = (b.object.text?.paras ?? []).map((p) => p.runs.map((r) => r.text).join('')).join('\n');
      b.object.box = box;
      b.object.fingerprint = await fingerprintOf('text', box, text);
    }
  }
  // A selected region set may leave ink outside every box (a box the person
  // removed or drew too small). That ink is kept as pictures, not dropped.
  if (input.regions) {
    const rest = await leftoverPictures(picture, found, pageGround, store, toSlide, base, unreadState);
    unread += rest.length;
    built.push(...rest);
  }

  // The text layer the picture carried moves onto what replaces the picture.
  let carried = 0;
  if (layer) {
    const moved = carryTextLayer(layer, built);
    carried = moved.carried;
    if (moved.lost > 0) {
      out.warnings.push({
        code: 'nodes-truncated',
        message: `${moved.lost} ${moved.lost === 1 ? 'line' : 'lines'} of the text layer of ${slide.id} fell on no rebuilt region, so they are not carried.`,
        count: moved.lost,
      });
    }
  }

  // A picture that leaves part of the slide showing (a scan placed on a page)
  // has a ground of its own inside its box, which the slide's ground outside it
  // is not: it becomes a rectangle under the regions, and the slide keeps its own.
  const partial = pic !== null && coverOf(pictureBox, slide) < FLATTENED_AREA_SHARE;
  if (partial) {
    const box: BoxV1 = { ...pictureBox, rot: 0 };
    built.unshift({
      object: {
        id: `${base}.ground`,
        fingerprint: await fingerprintOf('shape', box, `rect|:${found.background}`),
        kind: 'shape',
        box,
        origin: 'raster-region',
        fidelity: { state: 'approximate', reason: 'reader-approximation' },
        geom: 'rect',
        fill: { hex: found.background },
      },
      pictureBox: { x: 0, y: 0, w: picture.width, h: picture.height },
      layer: 0,
    });
  }

  // Grounds first (panels, then rules), then pictures, then text; region order within a layer.
  const layered = built.map((b, i) => ({ b, i })).sort((a, c) => a.b.layer - c.b.layer || a.i - c.i).map(({ b }) => b);
  const content = layered.filter((b) => b.layer >= 2);
  const ordered = readingOrderOf(content.map((b) => b.pictureBox)).order
    .map((i) => content[i])
    .filter((b): b is Built => b !== undefined);
  const newReading = [
    ...(page ? titleThenRows(ordered) : ordered).map((b) => b.object.id),
    ...layered.filter((b) => b.layer < 2).map((b) => b.object.id),
  ];

  const at = pic ? out.objects.findIndex((o) => o.id === pic.id) : out.objects.length;
  out.objects.splice(at < 0 ? out.objects.length : at, pic && at >= 0 ? 1 : 0, ...layered.map((b) => b.object));
  const readAt = pic ? out.readingOrder.indexOf(pic.id) : -1;
  if (readAt >= 0) out.readingOrder.splice(readAt, 1, ...newReading);
  else out.readingOrder.push(...newReading);
  // Every object's reading index follows the new order; an untouched object is
  // copied rather than changed, so the input slide stays as it was.
  const position = new Map(out.readingOrder.map((id, i) => [id, i] as const));
  out.objects = out.objects.map((o) => {
    const index = position.get(o.id);
    return index === undefined || o.readingIndex === index ? o : { ...o, readingIndex: index };
  });

  // The ground the regions were measured against: the slide's, unless the
  // picture leaves part of the slide showing (then it is the rectangle above). A
  // gradient cannot be one colour, so the slide says the picture holds the original.
  if (!partial) out.background.color = { hex: slideGround(built, picture, found, !!page) };
  if (found.backgroundModel === 'surface') {
    out.warnings.push(partial
      ? {
        code: 'gradient-flattened',
        message: `The paper of the picture on ${slide.id} is a gradient, and its ground rectangle ${base}.ground carries one colour; the recovery picture keeps the original.`,
        objectIds: [`${base}.ground`],
      }
      : {
        code: 'gradient-flattened',
        message: `The ground of ${slide.id} is a gradient in the picture and is carried as one colour; the whole-slide picture keeps the original.`,
      });
  }
  await recover();
  out.ocr = rebuiltOcr(carried);
  return out;
}

// ─── the page reading ────────────────────────────────────────────────────────

/** Ink of a line's leading icon differs from the ground around the line by more than this (summed channels). */
const LEAD_INK = 48;
/** A leading icon is between these many of the line's ink height wide... */
const LEAD_MIN_WIDTH = 0.5;
const LEAD_MAX_WIDTH = 1.8;
/** ...stands this many ink heights clear of the text after it... */
const LEAD_GAP = 0.35;
/** ...and a gap inside it of up to this many ink heights is still the icon (the space inside a ring). */
const LEAD_INNER_GAP = 0.15;
/**
 * Letters of a word are about this many ink heights wide each, so an ink run
 * narrower than the first word's letters would take is not that word (an eye
 * icon 1.3 heights wide before "Risk", whose four letters take about 1.8).
 */
const LETTER_WIDTH = 0.45;
/**
 * A first token read as a pictograph, a circled figure or a private-use glyph
 * is a symbol the recogniser gave a token of its own. Typographic characters
 * (`&`, `@`, `#`, `%`, `+`, `$` and punctuation) are text, however alone.
 */
const ICON_TOKEN = /^[\p{So}\p{No}\p{Co}]$/u;

/**
 * An icon a detector boxed together with the text after it (a row label drawn
 * as a symbol and a word): the first run of inked columns in the line's box,
 * about as wide as the line's height and well clear of what follows, when the
 * reading either gave it a token of its own that is a pictograph (a symbol read
 * as a circled figure, never `&` or other typographic signs) or read a first
 * word of three letters or more that the run is too narrow to hold. The line
 * comes back without it: its box starts at the text and the symbol's token is
 * dropped. Null when the line does not start with one. Reads the box twice.
 */
function leadingIcon(picture: RgbaImageV1, line: OcrLine): { icon: RegionBoxV1; line: OcrLine } | null {
  const ground = outlineColourOf(picture, line.box);
  const rgb = ground ? Number.parseInt(ground.slice(1), 16) : 0xffffff;
  const g = [(rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255];
  const x0 = Math.max(0, Math.floor(line.box.x));
  const y0 = Math.max(0, Math.floor(line.box.y));
  const x1 = Math.min(picture.width, Math.ceil(line.box.x + line.box.w));
  const y1 = Math.min(picture.height, Math.ceil(line.box.y + line.box.h));
  if (x1 - x0 < 4 || y1 - y0 < 4) return null;
  const inked = (x: number, y: number): boolean => {
    const i = (y * picture.width + x) * 4;
    return Math.abs((picture.data[i] ?? 0) - (g[0] ?? 0)) + Math.abs((picture.data[i + 1] ?? 0) - (g[1] ?? 0)) + Math.abs((picture.data[i + 2] ?? 0) - (g[2] ?? 0)) > LEAD_INK;
  };
  const cols = new Uint16Array(x1 - x0);
  let top = y1;
  let bottom = -1;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (!inked(x, y)) continue;
      cols[x - x0] = (cols[x - x0] ?? 0) + 1;
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  const height = bottom - top + 1;
  if (bottom < 0 || height < 4) return null;
  let a0 = 0;
  while (a0 < cols.length && !cols[a0]) a0++;
  if (a0 >= cols.length) return null;
  // The first run, bridging gaps inside it (the hollow of a ring).
  let a1 = a0;
  let k = a0;
  while (k < cols.length) {
    if (cols[k]) {
      a1 = k;
      k++;
      continue;
    }
    let gap = k;
    while (gap < cols.length && !cols[gap]) gap++;
    if (gap >= cols.length || gap - k > LEAD_INNER_GAP * height) break;
    k = gap;
  }
  let b0 = a1 + 1;
  while (b0 < cols.length && !cols[b0]) b0++;
  if (b0 >= cols.length) return null;
  const width = a1 - a0 + 1;
  if (width < LEAD_MIN_WIDTH * height || width > LEAD_MAX_WIDTH * height || b0 - a1 - 1 < LEAD_GAP * height) return null;
  const tokens = line.text.trim().split(/\s+/);
  const first = tokens[0] ?? '';
  const symbol = Array.from(first).length === 1 && ICON_TOKEN.test(first);
  const wordLetters = first.replace(/[^\p{L}\p{N}]/gu, '').length;
  const wider = wordLetters >= 3 && width < wordLetters * LETTER_WIDTH * height;
  if (!symbol && !wider) return null;
  const text = symbol ? tokens.slice(1).join(' ') : line.text.trim();
  if (!text) return null;
  // The icon's own rows.
  let iTop = y1;
  let iBottom = -1;
  for (let y = y0; y < y1; y++) {
    for (let x = x0 + a0; x <= x0 + a1; x++) {
      if (!inked(x, y)) continue;
      iTop = Math.min(iTop, y);
      iBottom = Math.max(iBottom, y);
      break;
    }
  }
  const icon = { x: x0 + a0, y: iTop, w: width, h: iBottom - iTop + 1 };
  const start = x0 + b0 - Math.round(0.1 * height);
  return { icon, line: { text, confidence: line.confidence, box: { x: start, y: line.box.y, w: line.box.x + line.box.w - start, h: line.box.h } } };
}

/**
 * The mark drawn just before a word (a logo's symbol before its name): the ink
 * in a window up to `LOCKUP_REACH` of the word's heights to its left and a height
 * above and below it, against
 * the window's outline colour, when it ends within `LOCKUP_GAP` heights of the
 * word, is level with it, stands clear of the window's far side and of its top
 * or its bottom, and is about as tall as the word's own ink or a little taller. `image` is the picture with
 * the read text masked out, so the word itself is not ink there; `source` is
 * the picture, where the word's ink is measured. Null when there is none, or
 * when the window is busy (a photograph), whose ink runs to its edges.
 */
function markBefore(image: RgbaImageV1, source: RgbaImageV1, box: RegionBoxV1, threshold: number): RegionBoxV1 | null {
  // The word's own ink, not the detector's padded box, sets the scale.
  const word = textBoundsOf(source, box, outlineColourOf(source, padBox(box, 2)) ?? '#ffffff', threshold) ?? box;
  const h = word.h;
  const window = clipBox({ x: word.x - LOCKUP_REACH * h, y: word.y - h, w: LOCKUP_REACH * h - 1, h: 3 * h }, image);
  if (!window) return null;
  const ground = outlineColourOf(image, window);
  if (!ground) return null;
  const ink = inkBounds(image, window, ground, threshold);
  if (!ink) return null;
  // A mark stands clear of the window's far side, and of its top or its bottom;
  // ink running into those is a photograph or a drawing the word is set over.
  if (ink.x <= window.x + 1 || (ink.y <= window.y + 1 && ink.y + ink.h >= window.y + window.h - 1)) return null;
  if (ink.x + ink.w < word.x - LOCKUP_GAP * h) return null;
  // Level with the word: its middle within the word's rows, give or take half a height.
  const middle = ink.y + ink.h / 2;
  if (middle < word.y || middle > word.y + h) return null;
  if (ink.h < LOCKUP_MIN_SIZE * h || ink.h > LOCKUP_MAX_SIZE * h || ink.w > LOCKUP_MAX_WIDTH * h) return null;
  return ink;
}

/** A region handed to the recogniser for a reading that is not one of the colour finder's regions. */
function readingRegion(id: string, box: RegionBoxV1): SlideRegionV1 {
  return {
    id,
    kind: 'text',
    box,
    depth: 0,
    evidence: {
      reason: id === 'page' ? 'large-mixed' : 'single-line',
      components: 0,
      rows: 0,
      inRowShare: 0,
      lineHeight: box.h,
      inkShare: 0,
      dominantShare: 0,
      distinctColours: 0,
      otherColourShare: 0,
      samples: 0,
      aspect: Math.max(box.w, box.h) / Math.max(1, Math.min(box.w, box.h)),
      ink: '#000000',
      ground: '#ffffff',
    },
  };
}

/** Rows of context above and below a piece of a long line, as a share of its height. */
const PIECE_PAD = 0.4;
/** Context around a part of a line split at a wide gap, as a share of its ink height: tight, so a band behind the text stays the crop's ground. */
const PART_PAD = 0.25;

/**
 * The boxes of a block's lines with no two stacked boxes overlapping: where one
 * line's box runs into the next line's, both stop at the middle of the overlap,
 * so a line's text bounds never take in the descenders of the line above.
 */
function apart(lines: OcrLine[]): RegionBoxV1[] {
  const boxes = lines.map((l) => ({ ...l.box }));
  const order = boxes.map((_, i) => i).sort((a, b) => (boxes[a]?.y ?? 0) - (boxes[b]?.y ?? 0));
  for (let k = 0; k < order.length; k++) {
    for (let j = k + 1; j < order.length; j++) {
      const a = boxes[order[k] ?? 0];
      const b = boxes[order[j] ?? 0];
      if (!a || !b) continue;
      const shared = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const overlap = a.y + a.h - b.y;
      // Only a line below the other, not a fragment beside it on one row.
      if (shared <= 0 || overlap <= 0 || b.y + b.h / 2 <= a.y + a.h) continue;
      const middle = b.y + overlap / 2;
      a.h = Math.max(1, middle - a.y);
      b.h = Math.max(1, b.y + b.h - middle);
      b.y = middle;
    }
  }
  return boxes;
}

/** A paragraph whose stems are this much wider for its size than the page's usual type is set bold. */
const BOLD_RATIO = 1.3;

/** A word whose stems are this much wider than its paragraph's usual word is set bold inside its line. */
const WORD_BOLD_RATIO = 1.2;

/** A word set in capitals is bold inside its line when its stems are this much wider than its paragraph's usual word. */
const CAPITALS_BOLD_RATIO = 1.5;

/** Whether a word's letters are all capitals, two or more of them (an acronym, a shout). */
function capitalsOnly(word: string): boolean {
  const found = word.match(/\p{L}/gu) ?? [];
  return found.length >= 2 && found.every((ch) => ch === ch.toUpperCase() && ch !== ch.toLowerCase());
}

/** A word with fewer letters than this is bold only between bold words. */
const WORD_MIN_LETTERS = 3;

/** Paragraphs within this share of one another's size are compared for weight... */
const PEER_SIZE = 0.2;
/** ...when the others hold at least this many letters. */
const PEER_MIN_LETTERS = 20;

/** A character drawn this far (summed channels) from its line's colour is drawn in a colour of its own. */
const EMPHASIS_APART = 90;

/**
 * Two inks of one text within this summed channel difference are one ink: each line
 * reads its colour from its own pixels, and the few steps antialiasing moves a white
 * line to (#fcfefd on one line, #fcfefe on the next) are not a change of colour.
 */
const SAME_INK = 48;

/**
 * One text's inks brought to the inks it was drawn in (close-out CP13): the distinct
 * colours of its runs, heaviest first by characters, each join the first heavier ink
 * within `SAME_INK`, and adjacent runs that then match merge. A colour further off
 * (a mint question mark after white words) stays a run of its own, so emphasis
 * travels and noise does not. Changes the runs in place.
 */
function snapInks(paras: SourceParaV1[]): void {
  const weight = new Map<string, number>();
  for (const para of paras) {
    for (const run of para.runs) {
      const hex = run.color?.hex;
      if (hex) weight.set(hex, (weight.get(hex) ?? 0) + run.text.replace(/\s/g, '').length);
    }
  }
  if (weight.size < 2) return;
  const ranked = [...weight.entries()].sort((a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(([hex]) => hex);
  const inks: string[] = [];
  const to = new Map<string, string>();
  for (const hex of ranked) {
    const near = inks.find((ink) => channelsApart(ink, hex) <= SAME_INK);
    if (near) to.set(hex, near);
    else {
      inks.push(hex);
      to.set(hex, hex);
    }
  }
  for (const para of paras) {
    const merged: SourceParaV1['runs'] = [];
    for (const run of para.runs) {
      const hex = run.color?.hex;
      if (hex) run.color = { ...run.color, hex: to.get(hex) ?? hex };
      const last = merged[merged.length - 1];
      if (last && last.color?.hex === run.color?.hex && (last.bold === true) === (run.bold === true) && last.sizePt === run.sizePt) last.text += run.text;
      else merged.push(run);
    }
    para.runs = merged;
  }
}

function channelsApart(a: string, b: string): number {
  const parse = (hex: string): number[] => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) || 0);
  const x = parse(a);
  const y = parse(b);
  return Math.abs((x[0] ?? 0) - (y[0] ?? 0)) + Math.abs((x[1] ?? 0) - (y[1] ?? 0)) + Math.abs((x[2] ?? 0) - (y[2] ?? 0));
}

/** A word of a read line: the width of its stems in px and its letters. */
interface WordStemV1 {
  stem: number;
  letters: number;
}

/** The words of a line's glyphs with a stem width, in order. */
function wordStems(glyphs: LineGlyphsV1 | null): WordStemV1[] {
  if (!glyphs) return [];
  const chars = Array.from(glyphs.text);
  const out: WordStemV1[] = [];
  let k = 0;
  while (k < chars.length) {
    if (!chars[k]?.trim()) {
      k++;
      continue;
    }
    const start = k;
    while (k < chars.length && chars[k]?.trim()) k++;
    const stem = glyphs.stems[start];
    const n = letters(chars.slice(start, k).join(''));
    if (typeof stem === 'number' && stem > 0 && n > 0) out.push({ stem, letters: n });
  }
  return out;
}

/** The median of `r` with each value counted `n` times. 0 for none. */
function weightedMedian(values: Array<{ r: number; n: number }>): number {
  const sorted = [...values].filter((v) => v.n > 0).sort((a, b) => a.r - b.r);
  const total = sorted.reduce((n, v) => n + v.n, 0);
  let seen = 0;
  for (const v of sorted) {
    seen += v.n;
    if (seen * 2 >= total) return v.r;
  }
  return 0;
}

/** Whether the next line of a paragraph runs on with no space: after a hyphen, or after a dash set close to its word. */
function runsOnAfter(text: string): boolean {
  return text.endsWith('-') || /\S[\u2014\u2013]$/u.test(text);
}

/**
 * One line of a paragraph as runs of its own, from its glyphs (`lineGlyphsOf`):
 *
 *   - a character the glyphs read in a colour of its own (a coloured question
 *     mark after a white word; `lineGlyphsOf` keeps a gradient one colour)
 *     takes it when it stands clearly apart from the line's colour `hex`
 *     (`EMPHASIS_APART`);
 *   - a word is bold when the paragraph is, or when `heavy` says its stems are;
 *     a word under `WORD_MIN_LETTERS` letters, whose few stems say little, only
 *     when the words both sides of it are.
 *
 * A space takes the style of the character before it, so it never splits a
 * run. Without the line's glyphs, or when its text is not the text they were
 * read for, the whole line makes one run.
 */
function lineParts(
  line: TypesetLineV1,
  piece: string,
  hex: string,
  bold: boolean,
  glyphs: LineGlyphsV1 | null,
  heavy: (stem: number | null, capitals: boolean) => boolean,
): Array<{ text: string; hex: string; bold: boolean }> {
  const all = Array.from(line.text);
  if (!glyphs || glyphs.text !== line.text) return [{ text: piece, hex, bold }];
  let offset = 0;
  while (offset < all.length && !all[offset]?.trim()) offset++;
  const chars = Array.from(piece);
  const n = chars.length;
  const solid = (k: number): boolean => Boolean(chars[k]?.trim());
  // The glyphs say which characters are drawn in a colour of their own
  // (`lineGlyphsOf`); the rest take the line's colour as the line reads it.
  const colours = chars.map((_, k) => {
    const ink = solid(k) ? glyphs.inks[offset + k] ?? null : null;
    return ink !== null && channelsApart(ink, hex) > EMPHASIS_APART ? ink : hex;
  });
  // Each word's weight, a word of one letter going with the words beside it.
  const wordOf = chars.map(() => -1);
  const words: Array<{ heavy: boolean; letters: number }> = [];
  for (let k = 0; k < n;) {
    if (!solid(k)) {
      k++;
      continue;
    }
    const start = k;
    while (k < n && solid(k)) wordOf[k++] = words.length;
    const word = chars.slice(start, k).join('');
    words.push({ heavy: heavy(glyphs.stems[offset + start] ?? null, capitalsOnly(word)), letters: letters(word) });
  }
  const heavyWord = words.map((w, i) => bold || (w.letters >= WORD_MIN_LETTERS ? w.heavy : Boolean(words[i - 1]?.heavy && words[i + 1]?.heavy)));
  const parts: Array<{ text: string; hex: string; bold: boolean }> = [];
  chars.forEach((ch, k) => {
    const last = parts[parts.length - 1];
    if (!solid(k)) {
      if (last) last.text += ch;
      else parts.push({ text: ch, hex, bold });
      return;
    }
    const style = { hex: colours[k] ?? hex, bold: heavyWord[wordOf[k] ?? -1] ?? bold };
    if (last && last.hex === style.hex && last.bold === style.bold) last.text += ch;
    else parts.push({ text: ch, ...style });
  });
  return parts;
}

/** Paragraphs of one block within this share of the block's median size are set at that size. */
const SIZE_SNAP = 0.25;

/**
 * One block's paragraph sizes, measured apart, brought to the block's median
 * where they lie within `SIZE_SNAP` of it: a block of one size reads a little
 * larger on a line of capitals and a little smaller on a line of x-height
 * letters, and a person set it at one size. A paragraph further off (a heading
 * over its body) keeps its own size.
 */
function snapSizes(block: TypesetBlockV1): TypesetBlockV1 {
  const sizes = block.paragraphs.map((p) => p.sizePx).filter((n): n is number => n !== null && n > 0).sort((a, b) => a - b);
  if (sizes.length < 2) return block;
  const mid = sizes.length >> 1;
  const median = sizes.length % 2 ? (sizes[mid] ?? 0) : ((sizes[mid - 1] ?? 0) + (sizes[mid] ?? 0)) / 2;
  return {
    ...block,
    paragraphs: block.paragraphs.map((p) =>
      p.sizePx !== null && Math.abs(p.sizePx - median) <= SIZE_SNAP * median ? { ...p, sizePx: median } : p),
  };
}

/** Two pieces of a horizontal rule lie within this many px of one line down (or their thickness, when thicker). */
const RULE_LINE_SLACK = 3;
/** A rule ending within this share of the picture's width of a panel's edge (at least `RULE_REACH_MIN` px) runs into it. */
const RULE_REACH_SHARE = 0.01;
const RULE_REACH_MIN = 8;

/**
 * The page's horizontal rules as barriers between lines of text: pieces lying on
 * one line down (a table's row rule broken where the text mask crossed it, or
 * found in pieces between columns) joined into one, and a rule running into a
 * panel (a highlighted column of the same table) carried across that panel. A
 * vertical rule stays as found. The barriers only keep blocks apart; the rules
 * rebuilt as shapes are the ones found.
 */
function ruleBarriers(rules: RegionBoxV1[], panels: RegionBoxV1[], reach: number): RegionBoxV1[] {
  const flat = rules.filter((r) => r.w >= r.h).sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2) || a.x - b.x);
  const joined: RegionBoxV1[] = [];
  for (const rule of flat) {
    const last = joined[joined.length - 1];
    const slack = Math.max(RULE_LINE_SLACK, rule.h, last?.h ?? 0);
    if (last && Math.abs(last.y + last.h / 2 - (rule.y + rule.h / 2)) <= slack) {
      joined[joined.length - 1] = unionOf([last, rule]);
    } else {
      joined.push({ ...rule });
    }
  }
  const carried = joined.map((rule) => {
    let out = rule;
    for (const panel of panels) {
      const my = out.y + out.h / 2;
      if (my < panel.y || my > panel.y + panel.h) continue;
      // Only a rule running up to the panel from outside it: one inside it is the panel's own.
      if (insideShare(rule, panel) >= 0.5) continue;
      const touches = out.x + out.w >= panel.x - reach && out.x <= panel.x + panel.w + reach;
      if (touches) out = unionOf([out, { x: panel.x, y: out.y, w: panel.w, h: out.h }]);
    }
    return out;
  });
  return [...carried, ...rules.filter((r) => r.w < r.h)];
}

/** The strips a card's edge is looked for in are this share of the picture's short side thick (at least 2 px)... */
const CARD_STEP_SHARE = 0.005;
/** ...the first two strips out from the unit are passed over (a label's last pixels)... */
const CARD_SKIP_STRIPS = 2;
/** ...an edge is a strip whose mean colour differs from the strip before by more than this (summed channels)... */
const CARD_EDGE_JUMP = 12;
/** ...and it is looked for up to this many of the unit's own size on that axis out. */
const CARD_REACH = 1.5;

/**
 * The panel a card unit (an icon over its label) is drawn on, when it has an
 * edge on every side: from the unit's box outwards, strip by strip, the first
 * strip whose mean colour jumps from the strip before (a card's edge, or its
 * shadow) past `skip` strips (`CARD_SKIP_STRIPS`), within `CARD_REACH` of the unit's size. A
 * card's inside may run from one colour to another; it does so smoothly, a strip
 * at a time. Null when a side reaches no edge (the unit is set on the slide's own
 * ground). Reads a sampled row or column per strip.
 */
function cardEdgeOf(image: RgbaImageV1, unit: RegionBoxV1, skip = CARD_SKIP_STRIPS): RegionBoxV1 | null {
  const step = Math.max(2, Math.round(CARD_STEP_SHARE * Math.min(image.width, image.height)));
  const meanAt = (side: 'left' | 'right' | 'top' | 'bottom', d: number): [number, number, number] | null => {
    const across = side === 'left' || side === 'right';
    const at = side === 'left' ? unit.x - d : side === 'right' ? unit.x + unit.w + d : side === 'top' ? unit.y - d : unit.y + unit.h + d;
    const limit = across ? image.width : image.height;
    const pos = Math.round(at);
    if (pos < 0 || pos >= limit) return null;
    const from = Math.max(0, Math.round(across ? unit.y : unit.x));
    const to = Math.min(across ? image.height : image.width, Math.round(across ? unit.y + unit.h : unit.x + unit.w));
    const sum: [number, number, number] = [0, 0, 0];
    let n = 0;
    for (let k = from; k < to; k += 2) {
      const i = ((across ? k : pos) * image.width + (across ? pos : k)) * 4;
      sum[0] += image.data[i] ?? 0;
      sum[1] += image.data[i + 1] ?? 0;
      sum[2] += image.data[i + 2] ?? 0;
      n++;
    }
    return n ? [sum[0] / n, sum[1] / n, sum[2] / n] : null;
  };
  const reachOf = (side: 'left' | 'right' | 'top' | 'bottom'): number | null => {
    const size = side === 'left' || side === 'right' ? unit.w : unit.h;
    let prev: [number, number, number] | null = null;
    for (let k = 0; k * step <= CARD_REACH * size; k++) {
      const mean = meanAt(side, k * step);
      if (!mean) return null;
      if (prev && k > skip) {
        const jump = Math.abs(mean[0] - prev[0]) + Math.abs(mean[1] - prev[1]) + Math.abs(mean[2] - prev[2]);
        if (jump > CARD_EDGE_JUMP) return (k - 1) * step;
      }
      prev = mean;
    }
    return null;
  };
  const left = reachOf('left');
  const right = reachOf('right');
  const top = reachOf('top');
  const bottom = reachOf('bottom');
  if (left === null || right === null || top === null || bottom === null) return null;
  return { x: unit.x - left, y: unit.y - top, w: unit.w + left + right, h: unit.h + top + bottom };
}

/** An unsure reading boxed at least this many of the page's usual line heights tall may be text set at an angle... */
const ANGLED_MIN_HEIGHT = 1.8;
/** ...when the ink under it runs at least this many degrees off level (and off upright)... */
const ANGLED_MIN_DEGREES = 15;
/** ...and is at least this much longer along its run than across it. */
const ANGLED_MIN_ELONGATION = 1.6;

/** Text boxes within this share of the smaller one's height of each other, one over the other, share a soft panel... */
const SOFT_PANEL_GAP = 1;
/** ...whose edge stands at least this many edge-finding strips out from the text on every side... */
const SOFT_PANEL_MIN_STRIPS = 3;
/** ...and at least this share of the picture's short side. */
const SOFT_PANEL_MIN_MARGIN = 0.02;

/** Tile origins along one side: one tile when the side is no longer than a tile, otherwise tiles overlapping by at least half. */
function tileStarts(length: number, tile: number): number[] {
  if (length <= tile) return [0];
  const n = Math.ceil((length - tile) / (tile / 2)) + 1;
  return Array.from({ length: n }, (_, i) => Math.round((i * (length - tile)) / (n - 1)));
}

interface PageReadOpts {
  maxAspect: number;
  tile: number;
  maxCalls: number;
  signal?: AbortSignal;
}

/**
 * The page reading. The recogniser runs over the whole picture, then over
 * overlapping tiles of `tile` px when the picture is larger, so small text is
 * detected at full size. Readings of one line (the page's and a tile's, or two
 * tiles' halves of a line a tile edge cut) overlap on one row and merge: the one
 * covering the merged box stands for it, otherwise the merged box is read
 * again. A line whose box holds an empty run wider than `LINE_GAP_SPLIT` of its
 * ink height is read again part by part, tight to each part's ink. Then every
 * line longer than `maxAspect` of its heights is read again in pieces cut at
 * gaps between words, at most `MAX_PIECES`. Every reading again comes out of
 * `maxCalls`; past it a line keeps the reading it has. Lines come back in
 * picture px, clipped to the crop they were read in. Null when the recogniser
 * throws on the whole picture, so the caller reads region by region; a tile or
 * a piece that throws is left out.
 */
async function readPage(picture: RgbaImageV1, ocr: FlattenedOcrV1, opts: PageReadOpts): Promise<{ lines: OcrLine[]; calls: number } | null> {
  const { signal } = opts;
  let calls = 0;
  /** One reading of a box of the picture, lines moved into picture px; null when it throws. */
  const readBox = async (id: string, box: RegionBoxV1): Promise<OcrLine[] | null> => {
    const crop = cropRgba(picture, box);
    let got: OcrLine[];
    try {
      got = await ocr({ width: crop.width, height: crop.height, data: crop.data }, readingRegion(id, box));
    } catch (err) {
      if (signal?.aborted) throw err;
      return null;
    }
    signal?.throwIfAborted();
    calls++;
    const out: OcrLine[] = [];
    for (const l of got) {
      if (!l.text.trim() || !(l.box.w > 0) || !(l.box.h > 0)) continue;
      // A detector can pad a box past the crop's edge; the pixels stop there.
      const inCrop = clipBox(l.box, crop);
      if (inCrop) out.push({ ...l, box: { x: inCrop.x + crop.x, y: inCrop.y + crop.y, w: inCrop.w, h: inCrop.h } });
    }
    return out;
  };
  /** Whether a line may be read again: calls are left under the slide's cap. */
  const spare = (): boolean => calls < opts.maxCalls;

  const whole = await readBox('page', { x: 0, y: 0, w: picture.width, h: picture.height });
  if (whole === null) return null;
  const all: Array<OcrLine & { from: number }> = whole.map((l) => ({ ...l, from: 0 }));
  const side = Math.max(opts.tile, Math.min(MAX_OCR_TILE, Math.ceil(Math.max(picture.width, picture.height) / 3)));
  const xs = tileStarts(picture.width, side);
  const ys = tileStarts(picture.height, side);
  // A whole-slide reading sure of every line it found is a quiet slide: a
  // tile where it read lines has nothing to add, and is skipped, while a tile
  // where it read none (a small mark in a corner, a caption on a photograph)
  // is still read. A reading unsure of a line is a busy slide, where the
  // detector loses small text and misreads, and every tile is read (a tile's
  // reading of a line also puts right what the whole-slide reading misread).
  // The cost: a small line missed beside a line read with no doubt, on a
  // quiet slide, is not looked for again; the recovery picture still holds it.
  const confident = whole.length > 0 && whole.every((l) => l.confidence >= TILE_SKIP_CONFIDENCE);
  if (xs.length > 1 || ys.length > 1) {
    let n = 0;
    for (const y of ys) {
      for (const x of xs) {
        n++;
        const box = { x, y, w: Math.min(side, picture.width - x), h: Math.min(side, picture.height - y) };
        if (confident && whole.some((l) => centreIn(l.box, box))) continue;
        const got = await readBox(`page.tile${n}`, box);
        for (const l of got ?? []) all.push({ ...l, from: n });
      }
    }
  }

  // Readings of one line overlap on one row at a similar height.
  const parent = all.map((_, i) => i);
  const find = (i: number): number => {
    let r = i;
    while ((parent[r] ?? r) !== r) r = parent[r] ?? r;
    return r;
  };
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i]?.box;
      const b = all[j]?.box;
      if (!a || !b) continue;
      const lo = Math.max(1, Math.min(a.h, b.h));
      const vOverlap = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      const hOverlap = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const centres = Math.abs(a.y + a.h / 2 - (b.y + b.h / 2));
      // One row: overlapping, at a similar height, centred alike (two lines of a
      // paragraph overlap a little, and their centres are a line apart). A
      // reading inside another (a word a tile boxed tighter than the page did)
      // is the same text whatever the heights.
      const oneRow = Math.max(a.h, b.h) / lo <= SAME_LINE_SIZE && vOverlap >= 0.6 * lo && centres <= SAME_LINE_CENTRES * lo && hOverlap > 0;
      const within = vOverlap >= 0.8 * lo && hOverlap >= 0.8 * Math.min(a.w, b.w) && centres <= SAME_LINE_CENTRES * Math.max(a.h, b.h);
      if (oneRow || within) parent[find(j)] = find(i);
    }
  }
  const groups = new Map<number, Array<OcrLine & { from: number }>>();
  all.forEach((l, i) => {
    const r = find(i);
    const list = groups.get(r);
    if (list) list.push(l);
    else groups.set(r, [l]);
  });

  const merged: OcrLine[] = [];
  for (const members of groups.values()) {
    const union = unionOf(members.map((m) => m.box));
    // The reading that spans the most of the line (a tile's reading can stop at
    // the tile's edge, a letter short), then the surer one, then the page's.
    const ranked = [...members].sort((a, b) =>
      b.box.w - a.box.w || b.confidence - a.confidence || a.from - b.from);
    const best = ranked[0];
    if (!best) continue;
    const spans = best.box.w >= SAME_LINE_COVER * union.w;
    if (spans || union.w > opts.maxAspect * union.h) {
      // A long merged line is read again in pieces below, so its text here is a placeholder.
      merged.push({ text: best.text, confidence: best.confidence, box: spans ? best.box : union });
      continue;
    }
    const again = spare() ? await readBox('page.line', padBox(union, Math.round(PIECE_PAD * union.h))) : null;
    const inRow = (again ?? []).filter((l) => l.box.y + l.box.h / 2 >= union.y && l.box.y + l.box.h / 2 <= union.y + union.h).sort((a, b) => a.box.x - b.box.x);
    merged.push(inRow.length ? joinReadings([inRow], union) : { text: best.text, confidence: best.confidence, box: best.box });
  }

  // A line boxed across a gap no line holds is read again part by part.
  const apartLines: OcrLine[] = [];
  for (const line of merged) {
    const parts = spare() ? looseParts(picture, line.box) : [];
    const read: OcrLine[] = [];
    for (const part of parts) {
      if (!spare()) break;
      const got = await readBox('page.part', padBox(part, Math.max(OCR_PAD, Math.round(PART_PAD * part.h))));
      read.push(...(got ?? []).filter((l) => centreIn(l.box, part)));
    }
    if (read.length) apartLines.push(...read);
    else apartLines.push(line);
  }

  const lines: OcrLine[] = [];
  for (const line of apartLines) {
    const b = line.box;
    if (b.w <= opts.maxAspect * b.h || !spare()) {
      lines.push(line);
      continue;
    }
    const pieces = Math.min(MAX_PIECES, Math.max(2, Math.ceil(b.w / (PIECE_ASPECT * Math.max(PIECE_MIN_HEIGHT, b.h)))));
    const cuts = lineCuts(picture, b, pieces);
    const edges = [b.x, ...cuts.map((c) => c.x), b.x + b.w];
    const read: OcrLine[][] = [];
    for (let i = 0; i + 1 < edges.length; i++) {
      if (!spare()) break;
      const x0 = edges[i] ?? b.x;
      const x1 = edges[i + 1] ?? b.x + b.w;
      const pad = Math.round(PIECE_PAD * b.h);
      // Context above and below only: a piece padded sideways would take in half a word of its neighbour.
      const got = await readBox('page.piece', { x: x0, y: b.y - pad, w: x1 - x0, h: b.h + 2 * pad });
      read.push((got ?? []).filter((l) => l.box.y + l.box.h / 2 >= b.y && l.box.y + l.box.h / 2 <= b.y + b.h).sort((p, q) => p.box.x - q.box.x));
    }
    // Every piece read, or the whole line stands: a line missing a piece is not a reading of it.
    const joined = read.length === edges.length - 1 && read.some((r) => r.length)
      ? joinReadings(read, b, cuts.map((c) => c.gap >= WORD_GAP * b.h))
      : null;
    // A piece can lose a word the whole line kept (a cut the detector read as the
    // edge of a word): the reading with more letters stands.
    lines.push(joined && letters(joined.text) >= letters(line.text) ? joined : line);
  }
  return { lines: lines.sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x), calls };
}

function letters(text: string): number {
  return text.replace(/[^\p{L}\p{N}]/gu, '').length;
}

/** A token a cut through a stroke reads on its own: the stroke's edge, not a word. */
const STROKE_TOKEN = /^[Il|1!.,'`]$/;

/**
 * Two readings either side of a cut that went through a word, joined as that
 * word: a letter both pieces read ("j" and "job") is kept once, a stray stroke
 * the cut left ("I") is dropped, and the halves of a word ("de" and "al.") join
 * with no space.
 */
function joinAtCut(left: string, right: string): string {
  const l = left.trimEnd();
  const r = right.trimStart();
  const lTokens = l.split(/\s+/);
  const rTokens = r.split(/\s+/);
  const tail = lTokens[lTokens.length - 1] ?? '';
  const head = rTokens[0] ?? '';
  const before = lTokens.slice(0, -1).join(' ');
  const after = rTokens.slice(1).join(' ');
  const glue = (a: string, b: string): string => [a, b].filter((t) => t).join(' ');
  if (!tail) return r;
  if (!head) return l;
  // The stroke is dropped and the halves either side of it still join as one word.
  if (STROKE_TOKEN.test(tail)) return before ? joinAtCut(before, r) : r;
  if (STROKE_TOKEN.test(head)) return after ? joinAtCut(l, after) : l;
  const lowTail = tail.toLowerCase();
  const lowHead = head.toLowerCase();
  // One piece read the start of the word the other read whole.
  if (lowTail.length <= 3 && lowHead.length > lowTail.length && lowHead.startsWith(lowTail)) return glue(before, r);
  if (lowHead.length <= 3 && lowTail.length > lowHead.length && lowTail.endsWith(lowHead)) return l;
  // Both read the letters at the cut: keep them once.
  for (let k = Math.min(lowTail.length, lowHead.length) - 1; k >= 2; k--) {
    if (lowTail.endsWith(lowHead.slice(0, k))) return glue(before, glue(tail + head.slice(k), after));
  }
  return glue(before, glue(tail + head, after));
}

/** A token two overlapping readings leave at their seam: the stroke of the edge both read. */
const SEAM_STROKE = /^[Il|1!/\\]$/;

/** Letters that stand as words of their own, so a lone one before a cut is kept. */
const WORD_LETTERS = new Set(['a', 'i', 'o', 'y', 'e', 'u']);

/**
 * Two readings either side of a cut through a word space, joined with a space,
 * less a lone letter the left piece read from the start of the next word (the
 * tail of a "j" reaching under the space: "your j" and "job"), and, for two
 * readings whose boxes overlap, less a lone stroke either side of the seam
 * ("family I" and "/ photo").
 */
function joinAtSpace(left: string, right: string, overlapping = false): string {
  let l = left.trimEnd();
  let r = right.trimStart();
  if (overlapping) {
    // Two readings whose boxes overlap each read the edge between them: a lone
    // stroke either side of the seam is that edge, not a word.
    const lt = l.split(/\s+/);
    if (lt.length > 1 && SEAM_STROKE.test(lt[lt.length - 1] ?? '')) l = lt.slice(0, -1).join(' ');
    const rt = r.split(/\s+/);
    if (rt.length > 1 && SEAM_STROKE.test(rt[0] ?? '')) r = rt.slice(1).join(' ');
  }
  const lTokens = l.split(/\s+/);
  const tail = lTokens[lTokens.length - 1] ?? '';
  const head = (r.split(/\s+/)[0] ?? '').toLowerCase();
  const letter = tail.toLowerCase();
  if (Array.from(tail).length === 1 && /\p{L}/u.test(tail) && !WORD_LETTERS.has(letter) && head.length > 1 && head.startsWith(letter)) {
    return [lTokens.slice(0, -1).join(' '), r].filter((t) => t).join(' ');
  }
  return `${l} ${r}`;
}

/**
 * Readings of one line, a list per piece left to right, as one line over `box`,
 * with confidence weighted by length. Readings inside one piece join with a
 * space (`joinAtSpace`), as the recogniser split them; across a cut they join
 * the same way when `words[k]` says cut `k` fell in a gap between words,
 * otherwise through `joinAtCut`.
 */
function joinReadings(pieces: OcrLine[][], box: RegionBoxV1, words: boolean[] = []): OcrLine {
  const parts = pieces.flat();
  const chars = parts.reduce((n, l) => n + l.text.trim().length, 0);
  const confidence = parts.reduce((sum, l) => sum + l.confidence * l.text.trim().length, 0) / Math.max(1, chars);
  let text = '';
  pieces.forEach((piece, k) => {
    let own = '';
    let prev: OcrLine | undefined;
    for (const l of piece) {
      const t = l.text.trim();
      if (!t) continue;
      own = own ? joinAtSpace(own, t, prev !== undefined && prev.box.x + prev.box.w > l.box.x) : t;
      prev = l;
    }
    if (!own) return;
    if (!text) text = own;
    else if (k === 0 || words[k - 1] !== false) text = joinAtSpace(text, own);
    else text = joinAtCut(text, own);
  });
  return { text: text.replace(/\s+/g, ' ').trim(), confidence, box };
}

/**
 * Mark what a page reading's objects form together, in the one field the
 * contract has for it, `groupPath`:
 *
 *   - a panel no larger than `CONTAINER_MAX_AREA_SHARE` of the slide that holds
 *     text (at `CONTAIN_SHARE` of each member's box) is a container: the panel's
 *     rectangle and every picture and text object inside it take the
 *     rectangle's id. With a picture among them it is a card (an icon over a
 *     label); with text alone it is a callout. Nested containers stack,
 *     outermost first.
 *   - an icon found over a label (`inkAbove`) and the label's text objects
 *     take `<base>.cardN`, numbered top to bottom then left to right, inside
 *     whatever container holds them.
 *   - an icon (a small picture outside every container) with a text object
 *     starting just to its right, level with it, is a row, when at least two
 *     such pairs stand in one column: the icon and its text take `<base>.rowN`,
 *     numbered top to bottom.
 */
function groupUnits(built: Built[], base: string, pageArea: number, cards: Array<{ icon: Built; texts: Built[] }>, barriers: RegionBoxV1[] = []): void {
  const panels = built.filter((b) => b.layer === 0 && b.region?.kind === 'panel' && areaOf(b.pictureBox) <= CONTAINER_MAX_AREA_SHARE * pageArea);
  const held = panels
    .map((panel) => ({ panel, members: built.filter((b) => b !== panel && b.layer >= 2 && insideShare(b.pictureBox, panel.pictureBox) >= CONTAIN_SHARE) }))
    .filter((c) => c.members.some((m) => m.object.kind === 'text'))
    .sort((a, b) => areaOf(b.panel.pictureBox) - areaOf(a.panel.pictureBox) || (a.panel.object.id < b.panel.object.id ? -1 : 1));
  for (const { panel, members } of held) {
    for (const b of [panel, ...members]) b.object.groupPath = [...(b.object.groupPath ?? []), panel.object.id];
  }
  // An icon over its label is a card whether or not a panel was found behind it.
  // Numbered by the labels: along a row left to right (labels level within half
  // a label's height), rows top to bottom.
  const labelOf = (c: { icon: Built; texts: Built[] }): RegionBoxV1 => c.texts[0]?.pictureBox ?? c.icon.pictureBox;
  const cardOrder = [...cards].sort((a, b) => {
    const la = labelOf(a);
    const lb = labelOf(b);
    return Math.abs(la.y - lb.y) < 0.5 * Math.min(la.h, lb.h) ? la.x - lb.x : la.y - lb.y;
  });
  cardOrder.forEach(({ icon, texts }, n) => {
    const id = `${base}.card${n + 1}`;
    for (const b of [icon, ...texts]) b.object.groupPath = [...(b.object.groupPath ?? []), id];
  });
  const inCard = new Set(cards.flatMap((c) => [c.icon, ...c.texts]));

  const icons = built
    .filter((b) => {
      const box = b.pictureBox;
      const aspect = Math.max(box.w, box.h) / Math.max(1, Math.min(box.w, box.h));
      return b.object.kind === 'pic' && !b.object.groupPath && !inCard.has(b) && areaOf(box) <= ICON_MAX_AREA_SHARE * pageArea && aspect <= ICON_MAX_ASPECT;
    })
    .sort((a, b) => a.pictureBox.y - b.pictureBox.y || a.pictureBox.x - b.pictureBox.x);
  const texts = built.filter((b) => b.object.kind === 'text' && !b.object.groupPath && !inCard.has(b));
  const used = new Set<Built>();
  const pairs: Array<{ icon: Built; text: Built }> = [];
  for (const icon of icons) {
    const i = icon.pictureBox;
    const right = i.x + i.w;
    const middle = i.y + i.h / 2;
    let best: Built | undefined;
    let bestGap = Number.POSITIVE_INFINITY;
    for (const text of texts) {
      if (used.has(text)) continue;
      const t = text.pictureBox;
      const gap = t.x - right;
      if (gap < -0.25 * i.w || gap > ROW_GAP_ICONS * i.w) continue;
      if (middle < t.y - 0.5 * i.h || middle > t.y + t.h + 0.5 * i.h) continue;
      if (gap < bestGap) {
        best = text;
        bestGap = gap;
      }
    }
    if (best) {
      used.add(best);
      pairs.push({ icon, text: best });
    }
  }
  const column = (a: RegionBoxV1, b: RegionBoxV1): boolean => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0;
  const rows = pairs.filter((p) => pairs.some((q) => q !== p && column(p.icon.pictureBox, q.icon.pictureBox)));
  if (rows.length < 2) return;
  rows.sort((a, b) => a.icon.pictureBox.y - b.icon.pictureBox.y);
  rows.forEach(({ icon, text }, n) => {
    const id = `${base}.row${n + 1}`;
    icon.object.groupPath = [id];
    text.object.groupPath = [id];
  });
  // The other cells of a row (a table's columns to the right of its label) join
  // it: a text whose middle lies in the row's band, halfway to the rows above and
  // below, and that starts right of the row's label. A heading over the first
  // row lies outside that band, and a title is never a cell. Where rules run
  // between the rows (a table's row lines), a cell lies across those rules'
  // width; with no such rules, text in a panel or box spanning more than one
  // row (a callout beside the rows) is not a cell.
  const middles = rows.map(({ icon, text }) => {
    const u = unionOf([icon.pictureBox, text.pictureBox]);
    return u.y + u.h / 2;
  });
  const bands = middles.map((at, n) => ({
    above: n > 0 ? ((middles[n - 1] ?? at) + at) / 2 : at - ((middles[n + 1] ?? at) - at) / 2,
    below: n + 1 < middles.length ? (at + (middles[n + 1] ?? at)) / 2 : at + (at - (middles[n - 1] ?? at)) / 2,
  }));
  const rowRules = barriers.filter((r) => r.w >= r.h && middles.some((at, n) => {
    const next = middles[n + 1];
    const label = rows[n]?.text.pictureBox;
    return next !== undefined && label !== undefined && r.y + r.h / 2 > at && r.y + r.h / 2 < next && r.x <= label.x && r.x + r.w >= label.x + label.w;
  }));
  const ruled = rowRules.length * 2 >= rows.length - 1 && rowRules.length > 0;
  const tableRight = ruled ? Math.max(...rowRules.map((r) => r.x + r.w)) : Number.POSITIVE_INFINITY;
  const holders = new Map(built.filter((b) => b.object.kind === 'shape').map((b) => [b.object.id, b.pictureBox] as const));
  const spansRows = (b: Built): boolean => (b.object.groupPath ?? []).some((id) => {
    const box = holders.get(id);
    return box !== undefined && bands.filter((band) => box.y < band.below && box.y + box.h > band.above).length > 1;
  });
  const inRows = new Set(rows.flatMap((r) => [r.icon, r.text]));
  for (const b of built) {
    if (b.object.kind !== 'text' || inRows.has(b) || inCard.has(b) || b.object.roleEstimate === 'title') continue;
    if (ruled ? b.pictureBox.x + b.pictureBox.w / 2 > tableRight : spansRows(b)) continue;
    const mid = b.pictureBox.y + b.pictureBox.h / 2;
    const n = bands.findIndex((band) => mid >= band.above && mid < band.below);
    const text = rows[n]?.text;
    if (!text || b.pictureBox.x <= text.pictureBox.x) continue;
    b.object.groupPath = [...(b.object.groupPath ?? []), `${base}.row${n + 1}`];
  }
}

/**
 * A page reading's objects in reading order: the text estimated as the title
 * first (a title across the top is read before the column beside it), then
 * what stands wholly above the rows (a table's column headings), then the
 * column graph's order, with the members of a row read together, left to right,
 * where the row's first member comes.
 */
function titleThenRows(ordered: Built[]): Built[] {
  const titles = ordered.filter((b) => b.object.kind === 'text' && b.object.roleEstimate === 'title');
  const rowOf = (b: Built): string | undefined => b.object.groupPath?.find((g) => /\.row\d+$/.test(g));
  // What stands wholly above the first row (a table's column headings) is read before the rows.
  const inRow = ordered.filter((b) => rowOf(b) !== undefined);
  const firstRow = inRow.length ? Math.min(...inRow.map((b) => b.pictureBox.y)) : Number.POSITIVE_INFINITY;
  const heads = ordered.filter((b) => !titles.includes(b) && !rowOf(b) && b.pictureBox.y + b.pictureBox.h <= firstRow && inRow.length > 0);
  const rest = ordered.filter((b) => !titles.includes(b) && !heads.includes(b));
  const out: Built[] = [...titles, ...heads];
  const done = new Set<string>();
  for (const b of rest) {
    const row = rowOf(b);
    if (!row) {
      out.push(b);
      continue;
    }
    if (done.has(row)) continue;
    done.add(row);
    out.push(...rest.filter((m) => rowOf(m) === row).sort((p, q) => p.pictureBox.x - q.pictureBox.x));
  }
  return out;
}

/** A rebuilt text box grows by up to this share of its width... */
const WIDEN_SHARE = 0.12;
/** ...keeping this many px clear of the next object or its panel's edge. */
const WIDEN_CLEAR = 4;

/**
 * A text object's box grown across by up to `WIDEN_SHARE` of its width (both
 * sides for centred text, else away from its aligned edge), stopping
 * `WIDEN_CLEAR` short of the next object level with it, of the edge of the
 * panel holding it, and of the picture's edge. Null when there is no room.
 */
function roomToWiden(b: Built, built: Built[], picture: RgbaImageV1): RegionBoxV1 | null {
  const box = b.pictureBox;
  const align = b.object.text?.paras[0]?.align;
  const grow = WIDEN_SHARE * box.w;
  let right = Math.min(picture.width, box.x + box.w + (align === 'center' ? grow / 2 : align === 'right' ? 0 : grow));
  let left = Math.max(0, box.x - (align === 'center' ? grow / 2 : align === 'right' ? grow : 0));
  for (const other of built) {
    if (other === b) continue;
    const o = other.pictureBox;
    // The panel holding the text bounds it by its own edges.
    if (other.layer === 0 && insideShare(box, o) >= CONTAIN_SHARE) {
      right = Math.min(right, o.x + o.w - WIDEN_CLEAR);
      left = Math.max(left, o.x + WIDEN_CLEAR);
      continue;
    }
    if (other.layer === 0 && areaOf(o) > areaOf(box) * 4) continue;
    const level = Math.min(o.y + o.h, box.y + box.h) - Math.max(o.y, box.y) > 0;
    if (!level) continue;
    if (o.x >= box.x + box.w) right = Math.min(right, o.x - WIDEN_CLEAR);
    if (o.x + o.w <= box.x) left = Math.max(left, o.x + o.w + WIDEN_CLEAR);
  }
  const x0 = Math.min(box.x, left);
  const x1 = Math.max(box.x + box.w, right);
  if (x1 - x0 <= box.w + 1) return null;
  return { x: x0, y: box.y, w: x1 - x0, h: box.h };
}

/** A text on the slide's ground reading under this contrast against the page's border colour is set on another part of a gradient. */
const GROUND_MIN_CONTRAST = 3;

/**
 * The one colour the slide's ground is carried as. The page's border colour,
 * unless the text set straight on the page (outside every panel and picture)
 * reads under `GROUND_MIN_CONTRAST` against it: then the ground under that
 * text, read along its own lines, so a white title over the dark end of a
 * gradient keeps a dark ground rather than the light end the border shows
 * most. The text holding the most letters decides.
 */
function slideGround(built: Built[], picture: RgbaImageV1, found: SlideRegionsV1, page: boolean): string {
  if (!page) return found.background;
  const under = built.filter((b) => b.layer < 3 && b.object.kind !== 'text');
  const onGround = built
    .filter((b) => b.object.kind === 'text' && !under.some((u) => centreIn(b.pictureBox, u.pictureBox)))
    .sort((a, b) => letters(textOfObject(b.object)) - letters(textOfObject(a.object)));
  const lead = onGround[0];
  const ink = lead?.object.text?.paras[0]?.runs[0]?.color?.hex;
  if (!lead || !ink || contrastRatio(ink, found.background) >= GROUND_MIN_CONTRAST) return found.background;
  const local = lineInkColourOf(picture, lead.pictureBox)?.ground;
  return local && contrastRatio(ink, local) > contrastRatio(ink, found.background) ? local : found.background;
}

function textOfObject(o: SourceObjectV1): string {
  return (o.text?.paras ?? []).map((p) => p.runs.map((r) => r.text).join('')).join(' ');
}

/** Area shared by two boxes, rotation ignored. */
function overlapArea(a: BoxV1, b: BoxV1): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * Move the lines of a text layer onto the rebuilt pictures and text: each line
 * to the object it overlaps most, or to the nearest one when it overlaps none
 * (a layer box can sit beside the ink it names, on a skewed scan). An object
 * that received lines and holds no reading of its own that found text gets the
 * layer's evidence; one whose reading in this run found text keeps it. Returns
 * the lines placed on an object and the lines with no object to go to.
 */
function carryTextLayer(layer: OcrEvidenceV1, built: Built[]): { carried: number; lost: number } {
  const content = built.filter((b) => b.layer >= 2);
  const lines = layer.lines ?? [];
  if (!content.length) return { carried: 0, lost: lines.length };
  const centre = (b: BoxV1): [number, number] => [b.x + b.w / 2, b.y + b.h / 2];
  const byObject = new Map<Built, OcrLineEvidenceV1[]>();
  for (const line of lines) {
    let best: Built | undefined;
    let bestArea = 0;
    for (const b of content) {
      const area = overlapArea(line.box, b.object.box);
      if (area > bestArea) {
        best = b;
        bestArea = area;
      }
    }
    if (!best) {
      const [lx, ly] = centre(line.box);
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const b of content) {
        const [cx, cy] = centre(b.object.box);
        const distance = Math.hypot(cx - lx, cy - ly);
        if (distance < bestDistance) {
          best = b;
          bestDistance = distance;
        }
      }
    }
    if (!best) continue;
    const list = byObject.get(best);
    if (list) list.push(line);
    else byObject.set(best, [line]);
  }
  let carried = 0;
  for (const [b, own] of byObject) {
    carried += own.length;
    if (b.object.ocr?.state === 'text-found') continue;
    const box = b.object.box;
    const chars = own.reduce((sum, l) => sum + l.text.replace(/\s/g, '').length, 0);
    const evidence: OcrEvidenceV1 = {
      state: 'text-found',
      lines: own.map((l) => ({ ...l, box: { ...l.box } })),
      textDensity: round2((chars * 1000) / Math.max(1, box.w * box.h)),
    };
    if (layer.model) evidence.model = layer.model;
    b.object.ocr = evidence;
  }
  return { carried, lost: lines.length - carried };
}

/**
 * Ink outside every region box, as picture crops: the ink on a coarse grid (the
 * regions' own cell), joined by 8-connectivity, specks of one or two cells left
 * out as detection leaves them out. Each crop's pixels inside a region box are
 * made transparent, so a pixel a region owns is not drawn twice.
 */
async function leftoverPictures(
  picture: RgbaImageV1,
  found: SlideRegionsV1,
  ground: InkGroundV1,
  store: (image: RgbaImageV1) => Promise<{ ref: string; hash: string }>,
  toSlide: (b: RegionBoxV1) => BoxV1,
  base: string,
  ocrState: OcrStateV1,
): Promise<Built[]> {
  const { width: w, height: h } = picture;
  const covered = new Uint8Array(w * h);
  for (const r of found.regions) {
    const x0 = Math.max(0, Math.floor(r.box.x));
    const y0 = Math.max(0, Math.floor(r.box.y));
    const x1 = Math.min(w, Math.ceil(r.box.x + r.box.w));
    const y1 = Math.min(h, Math.ceil(r.box.y + r.box.h));
    for (let y = y0; y < y1; y++) covered.fill(1, y * w + x0, y * w + Math.max(x0, x1));
  }
  const ink = inkMaskOf(picture, ground, found.threshold);
  const cell = Math.max(1, Math.floor(found.cell));
  const gw = Math.ceil(w / cell);
  const gh = Math.ceil(h / cell);
  const count = new Uint32Array(gw * gh);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (ink[p] && !covered[p]) {
        const c = Math.floor(y / cell) * gw + Math.floor(x / cell);
        count[c] = (count[c] ?? 0) + 1;
      }
    }
  }
  const minCount = Math.max(1, Math.ceil((cell * cell) / 8));
  const seen = new Uint8Array(gw * gh);
  const out: Built[] = [];
  for (let start = 0; start < gw * gh; start++) {
    if (seen[start] || (count[start] ?? 0) < minCount) continue;
    let cx0 = gw;
    let cy0 = gh;
    let cx1 = -1;
    let cy1 = -1;
    let cells = 0;
    let total = 0;
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const c = stack.pop() ?? 0;
      const cx = c % gw;
      const cy = (c - cx) / gw;
      cells++;
      total += count[c] ?? 0;
      cx0 = Math.min(cx0, cx);
      cy0 = Math.min(cy0, cy);
      cx1 = Math.max(cx1, cx);
      cy1 = Math.max(cy1, cy);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
          const n = ny * gw + nx;
          if (!seen[n] && (count[n] ?? 0) >= minCount) {
            seen[n] = 1;
            stack.push(n);
          }
        }
      }
    }
    if (cells <= 4 && cx1 - cx0 < 2 && cy1 - cy0 < 2 && total <= 2 * minCount) continue;
    const box: RegionBoxV1 = {
      x: cx0 * cell,
      y: cy0 * cell,
      w: Math.min(w, (cx1 + 1) * cell) - cx0 * cell,
      h: Math.min(h, (cy1 + 1) * cell) - cy0 * cell,
    };
    const crop = cropRgba(picture, box);
    for (let y = 0; y < crop.height; y++) {
      for (let x = 0; x < crop.width; x++) {
        if (covered[(crop.y + y) * w + crop.x + x]) crop.data[(y * crop.width + x) * 4 + 3] = 0;
      }
    }
    const stored = await store(crop);
    const slideBox = toSlide(box);
    const object: SourceObjectV1 = {
      id: `${base}.rest${out.length + 1}`,
      fingerprint: await fingerprintOf('pic', slideBox, stored.hash),
      kind: 'pic',
      box: slideBox,
      origin: 'raster-region',
      fidelity: { state: 'raster-preserved' },
      media: stored.ref,
      mediaMime: 'image/png',
      ocr: { state: ocrState },
    };
    out.push({ object, pictureBox: box, layer: 2 });
  }
  return out;
}
