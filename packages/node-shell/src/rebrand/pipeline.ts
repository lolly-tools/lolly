// SPDX-License-Identifier: MPL-2.0
/**
 * The renovation pipeline for a terminal, a script or a test (plan 274 sections
 * 2.3, 3.3, 3.4 and 5).
 *
 * One path, so `lolly rebrand`, `scripts/rebrand-eval.ts` and the test suite read
 * the same numbers: read the file (`sourceDeckFromPptx` or `sourceDeckFromPdf`,
 * chosen by the bytes, never by the name), rebuild the flattened slides when
 * asked to, take the census, run the first pass, answer the review when asked to,
 * compile, and then write the result as Design's own values. Everything here is
 * DOM-free: the XML parser arrives injected, exactly as `readPptx` takes one.
 *
 * A PDF IS READ WITH NODE'S OWN TOOLS. The web shell's canvas codec and its
 * shading, pattern and soft-mask decoders live in the web shell, so a PDF read
 * here uses the pure `NODE_PDF_IMAGE_CODEC` and the canvas-free shading and
 * pattern readers in `../pdf-read.ts`: a picture whose soft mask cannot be
 * composited (a JPEG base) is stored opaque and says so, an axial or radial
 * gradient is painted, and a fill that needs the web's PostScript calculator is
 * not painted and the slide says so (`source-pdf.ts` states each).
 *
 * FLATTENED SLIDES (plan 274 section 6). A slide the source marks flattened (a
 * scanned PDF page, or a pptx slide whose one picture covers 90 percent of it)
 * is rebuilt from its regions by `reconstructFlattenedSlide` when the caller asks
 * for `rebuild`, which is the default when an OCR runner is passed; otherwise it
 * is kept as one picture and its `SlideSourceV1.ocr` says `not-run` (or the
 * reading a searchable scan's own text layer already gave). Nothing here loads a
 * model: the OCR runner is injected (`ocr-node.ts` adapts the node one for a
 * caller that has it). The pieces a rebuild stores go through the same sink, so
 * their refs are content hashes too, and the whole-slide picture stays reachable
 * as `SlideSourceV1.recovery`. Each flattened slide also gets a
 * `FlattenedSlideReportV1` beside the source: what happened, why a slide stayed
 * a picture, which picture object the rebuild replaced, what it made and the
 * time it took, which the contract does not hold because it holds no clock
 * readings. A kept pptx slide gains
 * only its `ocr` state, which the web reader does not write yet. A picture's
 * size is read from its header before it is decoded, and one over
 * `FLATTENED_MAX_PIXELS` is never decoded. The plan records how the flattened
 * slides were read (`flattenedReadOfPlan`), because other options give other
 * objects and a plan fits only the objects it was made for.
 *
 * MEDIA REFS ARE THE CONTENT HASH. Every picture the deck holds is kept in memory
 * under `user/media/<sha256 hex>` (`mediaRefFor`). The ref depends on the bytes
 * alone, so a plan written by `lolly rebrand plan` names exactly the refs a later
 * `lolly rebrand compile` reads again from the same file, and two runs agree.
 *
 * A PROPOSAL IS NOT A DECISION. `compileDeck` compiles what the plan says. With
 * `acceptSuggestions` it first answers the open rows through the engine's own
 * `acceptSuggestions`, then records each row it answered with
 * `markAppliedUnreviewed`, carrying the review state the row had before, so the
 * report says which actions nobody looked at. The scope is the web's by default
 * (`unreviewed`: a row flagged for a person stays flagged); `all` also answers
 * the rows that need attention and is only ever asked for by name. A plan whose
 * rows were answered gets the next revision, so the compiled document never names
 * the revision of a plan that did not hold those decisions.
 *
 * A PLAN FITS ITS SOURCE ONE TO ONE. `checkPlanFits` refuses, as `plan.invalid`, a
 * plan whose slides or rows do not match the source's slides and objects exactly
 * once each, so a hand-edited plan cannot drop an object out of the review.
 *
 * THE OUTCOME IS THREE-VALUED. `ready` only when nothing is pending, nothing needs
 * attention, nothing (object or colour) is unresolved and no kept object waits in
 * the tray off the canvas; `needs-review` otherwise. `failed` belongs to the
 * caller, which is the one that saw the error.
 *
 * The Design half at the end turns a compiled deck into a Design session (`boxes`
 * plus the `__rebrandHandoff` marker the web view reads), a `.lolly` session file
 * carrying the kept pictures as uploads, and a native `.pptx` through
 * `designFramesToPptx`, the lowering milestone 1 built.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Unzlib } from 'fflate';

import {
  CENSUS_RULES,
  ENGINE_VERSION,
  EMU_PER_PX,
  PLAN_RULES,
  acceptSuggestions as acceptAll,
  autoMatchLayouts,
  buildPptxParts,
  censusDeck,
  compileRenovated,
  effectiveAction,
  firstPass,
  markAppliedUnreviewed,
  openPendingCounts,
  openPendingIds,
  resolveRebrandDesignSystem,
  withAutoMatchEntries,
  type AutoMatchBandsV1,
  type RebrandDesignSystemInputV1,
  type RebrandDesignSystemV1,
  type RenovationPresetV1,
} from '@lolly/engine';
import type {
  AlgorithmVersionsV1,
  CompiledDeckV1,
  DecisionAuthorV1,
  DeckCensusV1,
  DesignBoxRowV1,
  FileOutcomeV1,
  OcrStateV1,
  RebrandErrorCodeV1,
  RebrandReportV1,
  RenovationPlanV1,
  ReviewStateV1,
  SlideSourceV1,
  SourceDeckV1,
  SourceKindV1,
  SourceObjectV1,
} from '@lolly-tools/core';

// Deep import: the barrel does not carry it yet, and this is the one call the stage
// worker and this pipeline must share to compile a themed plan to the same bytes.
import { compileSystemOpts } from '../../../../engine/src/deck-compile.ts';
import { contentRoots, contentUrlFile, readAssetIndex, type ContentRoots } from '../content-roots.ts';
import { designFramesToPptx, framesOfDesignDoc, type DesignAssetResolver } from '../design-pptx.ts';
import { sniffFormat } from '../format-sniff.ts';
import { sriSha256 } from '../lolly-file.ts';
import { NODE_PDF_IMAGE_CODEC, loadPdfDocument } from '../pdf-read.ts';
import { inflatePptx } from '../pptx.ts';
import { repoRoot } from '../repo-root.ts';
import { flattenedPictureOf, reconstructFlattenedSlide, type FlattenedOcrV1 } from './flattened.ts';
import { sourceDeckFromPdf } from './source-pdf.ts';
import { labelReaderFromOcr, newInstanceId, sourceDeckFromPptx, type MediaSinkV1 } from './source-pptx.ts';

// ─── errors ──────────────────────────────────────────────────────────────────

/**
 * Codes a pipeline failure carries. The contract's own list, plus three it does
 * not name yet: `source.unsupported` (a format a surface does not read; this
 * pipeline reads pptx and pdf, and a surface that refuses one of them uses this
 * code), `plan.design-system-mismatch` (a plan resolved against
 * another token pack or master) and `design-system.unreadable` (a catalog file
 * the design system is read from that cannot be read or parsed).
 */
export type RebrandFailureCodeV1 =
  | RebrandErrorCodeV1
  | 'source.unsupported'
  | 'plan.design-system-mismatch'
  | 'design-system.unreadable';

/** A pipeline failure with a stable code, so a caller branches on `code`, never on the wording. */
export class RebrandPipelineError extends Error {
  readonly code: RebrandFailureCodeV1;
  constructor(code: RebrandFailureCodeV1, message: string) {
    super(message);
    this.name = 'RebrandPipelineError';
    this.code = code;
  }
}

// ─── identities ──────────────────────────────────────────────────────────────

/** Parses one OOXML part. The web passes its `DOMParser`; a terminal passes jsdom's. */
export type RebrandXmlParserV1 = (xml: string) => Document;

/** The reader identity recorded on every pptx source deck and plan this pipeline writes. */
export const PIPELINE_READER = { name: 'pptx-read', version: ENGINE_VERSION } as const;

/** The reader identity recorded on every pdf source deck and plan this pipeline writes. */
export const PDF_PIPELINE_READER = { name: 'pdf-read', version: ENGINE_VERSION } as const;

/** The reader identity for a source kind this pipeline reads. */
export function pipelineReaderFor(kind: SourceKindV1): { name: string; version: string } {
  return kind === 'pdf' ? PDF_PIPELINE_READER : PIPELINE_READER;
}

/** The namespace every media ref of this pipeline lives in. */
export const MEDIA_REF_PREFIX = 'user/media/';

/** The ref a picture's bytes are held under: its sha256, so the same bytes always get the same ref. */
export function mediaRefFor(sha256Hex: string): string {
  return `${MEDIA_REF_PREFIX}${sha256Hex}`;
}

/** `sha256:<hex>` of some bytes, the spelling the contract uses for a source hash. */
export function sourceHashOf(bytes: Uint8Array): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

/** One held picture. */
export interface PipelineMediaV1 {
  bytes: Uint8Array;
  mime: string;
}

// ─── reading ─────────────────────────────────────────────────────────────────

/** An OLE compound file: how an encrypted OOXML package arrives. */
const CFB_MAGIC = [0xd0, 0xcf, 0x11, 0xe0];

function startsWith(bytes: Uint8Array, magic: readonly number[]): boolean {
  return magic.every((byte, index) => bytes[index] === byte);
}

const LATIN1 = new TextDecoder('latin1');
const ascii = (text: string): Uint8Array => Uint8Array.from(text, (ch) => ch.charCodeAt(0));
const PDF_HEADER = ascii('%PDF-');
const PDF_STARTXREF = ascii('startxref');
const PDF_TRAILER = ascii('trailer');
const PDF_STREAM = ascii('stream');

/** A reader finds a PDF's header within this many bytes of the start, junk before it allowed. */
const PDF_HEADER_WINDOW = 1024;
/** How far from the end the last `startxref` is looked for. The format puts it in the last 1024 bytes. */
const PDF_STARTXREF_WINDOW = 4096;
/** The most of a trailer or cross-reference stream dictionary read. */
const PDF_DICT_WINDOW = 64 * 1024;
/** An `/Encrypt` entry naming its dictionary, by reference or inline. */
const PDF_ENCRYPT_ENTRY = /\/Encrypt\s*(?:\d+\s+\d+\s+R|<<)/;

/** The first index of `needle` in `bytes` at or after `from` and before `to`, or -1. */
function indexOfBytes(bytes: Uint8Array, needle: Uint8Array, from = 0, to = bytes.length): number {
  const last = Math.min(to, bytes.length) - needle.length;
  outer: for (let at = Math.max(0, from); at <= last; at++) {
    for (let k = 0; k < needle.length; k++) if (bytes[at + k] !== needle[k]) continue outer;
    return at;
  }
  return -1;
}

/** The last index of `needle` in `bytes` at or after `from`, or -1. */
function lastIndexOfBytes(bytes: Uint8Array, needle: Uint8Array, from = 0): number {
  outer: for (let at = bytes.length - needle.length; at >= Math.max(0, from); at--) {
    for (let k = 0; k < needle.length; k++) if (bytes[at + k] !== needle[k]) continue outer;
    return at;
  }
  return -1;
}

/** Where a PDF's `%PDF-` header starts, or -1 when the first 1024 bytes hold none. */
function pdfHeaderAt(bytes: Uint8Array): number {
  return indexOfBytes(bytes, PDF_HEADER, 0, PDF_HEADER_WINDOW + PDF_HEADER.length);
}

/**
 * The text of the dictionary the file's last `startxref` points to: the
 * trailer after a cross-reference table, or the dictionary of a
 * cross-reference stream. A linearised file points at its first-page table,
 * whose trailer repeats every entry. Null when the pointer is missing or leads
 * to neither. `base` is where the header starts, since an offset counts from
 * there when junk comes before it.
 */
function pdfTrailerText(bytes: Uint8Array, base: number): string | null {
  const pointer = lastIndexOfBytes(bytes, PDF_STARTXREF, bytes.length - PDF_STARTXREF_WINDOW);
  if (pointer < 0) return null;
  const digits = /^\s*(\d+)/.exec(LATIN1.decode(bytes.subarray(pointer + PDF_STARTXREF.length, pointer + PDF_STARTXREF.length + 32)));
  if (!digits) return null;
  const offset = Number(digits[1]);
  for (const at of new Set([offset + base, offset])) {
    if (at < 0 || at >= pointer) continue;
    const head = LATIN1.decode(bytes.subarray(at, Math.min(pointer, at + 64)));
    if (/^\s*xref\b/.test(head)) {
      const trailer = indexOfBytes(bytes, PDF_TRAILER, at, pointer);
      if (trailer < 0) return null;
      const next = indexOfBytes(bytes, PDF_STARTXREF, trailer, pointer + PDF_STARTXREF.length);
      return LATIN1.decode(bytes.subarray(trailer, Math.min(next < 0 ? pointer : next, trailer + PDF_DICT_WINDOW)));
    }
    if (/^\s*\d+\s+\d+\s+obj\b/.test(head)) {
      const stream = indexOfBytes(bytes, PDF_STREAM, at, Math.min(pointer, at + PDF_DICT_WINDOW));
      if (stream < 0) return null;
      return LATIN1.decode(bytes.subarray(at, stream));
    }
  }
  return null;
}

/**
 * True when a PDF is encrypted: its trailer, or its cross-reference stream's
 * dictionary, names an `/Encrypt` dictionary. The reader loads such a file
 * without decrypting it, so its streams would read as noise; it is refused by
 * name instead. Only the dictionary `startxref` points to is read, so the words
 * `/Encrypt 5 0 R` inside a page's text or a stream do not count. A file whose
 * pointer is damaged is asked of pdf-lib, which finds the trailer its own way.
 */
async function pdfEncrypted(bytes: Uint8Array, base: number): Promise<boolean> {
  const trailer = pdfTrailerText(bytes, base);
  if (trailer !== null) return PDF_ENCRYPT_ENTRY.test(trailer);
  try {
    return (await loadPdfDocument(bytes)).isEncrypted;
  } catch {
    // Not readable at all: the reader says so with its own message.
    return false;
  }
}

/**
 * The kind of source the bytes are, read from the bytes alone (the name can
 * lie), or a refusal with its code before the work starts. A PDF may have up
 * to 1024 bytes of something else before its header, as readers allow.
 */
async function sourceKindOf(bytes: Uint8Array, name: string): Promise<'pptx' | 'pdf'> {
  const sniffed = sniffFormat(bytes);
  if (sniffed === 'zip') return 'pptx';
  const header = sniffed === 'pdf' ? 0 : pdfHeaderAt(bytes);
  if (header >= 0) {
    if (await pdfEncrypted(bytes, header)) {
      throw new RebrandPipelineError(
        'source.encrypted',
        `${name} is an encrypted PDF, which this reader cannot decrypt. Some encrypted PDFs open without a password and only stop printing or copying. Save a copy without protection or restrictions and try again.`,
      );
    }
    return 'pdf';
  }
  if (startsWith(bytes, CFB_MAGIC)) {
    throw new RebrandPipelineError('source.encrypted', `${name} is password protected or in the old binary format. Save it as an unprotected .pptx and try again.`);
  }
  throw new RebrandPipelineError('source.unreadable', `${name} is not a PowerPoint package or a PDF.`);
}

/** What happens to a slide the source marks flattened: rebuilt from its regions, or kept as one picture. */
export type FlattenedModeV1 = 'rebuild' | 'keep';

/**
 * A picture as RGBA pixels, the shape `reconstructFlattenedSlide` reads. Stated
 * here rather than imported, so this published file names nothing outside its
 * package.
 */
export interface PipelinePictureV1 {
  width: number;
  height: number;
  /** RGBA interleaved, length `width * height * 4`. */
  data: Uint8ClampedArray | Uint8Array;
}

/**
 * A held picture's bytes as RGBA pixels, or null when this host cannot decode
 * them. The pipeline reads the size from the header first and does not call a
 * decoder for a picture over `FLATTENED_MAX_PIXELS`.
 */
export type PictureDecoderV1 = (bytes: Uint8Array, mime: string) => Promise<PipelinePictureV1 | null>;

/**
 * How the slides a source marks flattened were read: kept or rebuilt, and
 * whether OCR read the regions, with its model when one was named. A plan
 * records it (`pipelineAlgorithms`) and `flattenedReadOfPlan` reads it back, so
 * a compile reads the file again the same way. Different options give
 * different objects, and a plan fits only the objects it was made for.
 */
export interface FlattenedReadV1 {
  flattened: FlattenedModeV1;
  /** True when an OCR runner read the regions of a rebuild. */
  ocr: boolean;
  /** The OCR model id, when the read named one. */
  ocrModel?: string;
}

export interface ReadDeckInputV1 {
  bytes: Uint8Array;
  /** The file name, recorded on the source and used in messages. */
  name: string;
  /** Parses a pptx's XML parts. A PDF does not use it. */
  parseXml: RebrandXmlParserV1;
  /** Separates two imports of the same bytes. A fresh one when left out. */
  instanceId?: string;
  /** Called once per slide, in deck order, after the deck is read and its flattened slides handled. */
  onSlide?: (slide: SlideSourceV1, index: number, total: number) => void;
  /** Media over this many bytes is left unstored and reported. */
  maxMediaBytes?: number;
  /**
   * Text recognition for a flattened slide's regions, one crop at a time. Nothing
   * in this module loads a model; `nodeFlattenedOcr` in `ocr-node.ts` adapts the
   * node runner for a caller that has one.
   */
  ocr?: FlattenedOcrV1;
  /** The OCR model id, recorded in the evidence and on the plan. */
  ocrModel?: string;
  /** What a rebuild without `ocr` records for the text it could not read: `not-run` (default) or `unavailable`. */
  ocrMissing?: 'not-run' | 'unavailable';
  /**
   * `rebuild` by default when `ocr` is given, `keep` otherwise. A compile of a
   * saved plan passes what `flattenedReadOfPlan` gives, so it reads the same objects.
   */
  flattened?: FlattenedModeV1;
  /** Pixels for a flattened slide's picture. `decodePipelinePicture` when left out. */
  decodePicture?: PictureDecoderV1;
  /** Checked between pages, slides and regions. An aborted read throws the signal's own reason. */
  signal?: AbortSignal;
}

/** Why a flattened slide stayed one picture. */
export type FlattenedKeepReasonV1 =
  /** The caller asked for `keep`, or passed no OCR runner and no mode. */
  | 'asked'
  /** The slide is not one picture: it has objects besides its picture, or no picture. */
  | 'not-one-picture'
  /** The picture's bytes were not stored (over a cap, or undecodable at read). */
  | 'picture-missing'
  /** This host has no decoder for the picture's format, or cannot read its size from the header. */
  | 'undecodable'
  /** The picture has more pixels than a rebuild reads. */
  | 'too-large'
  /** The rebuild itself declined to cut it: a turned picture, or region finding hit a cap. */
  | 'not-cut'
  /** The rebuild failed; the slide carries the error as a warning. */
  | 'failed';

/**
 * What happened to one slide the source marks flattened, beside the source: the
 * slide itself carries its OCR state and recovery picture, and this adds the
 * outcome, the reason a slide stayed a picture, what the rebuild made and the
 * time it took, which the contract does not hold.
 */
export interface FlattenedSlideReportV1 {
  slideId: string;
  outcome: 'rebuilt' | 'kept';
  /** Set when `outcome` is `kept`. */
  reason?: FlattenedKeepReasonV1;
  /** The slide's own `ocr.state`, repeated so a caller reads one record. */
  ocr: OcrStateV1;
  /** The slide's own `recovery.assetRef`: the whole-slide picture, kept when the slide was cut. Only on a rebuilt slide. */
  recovery?: string;
  /**
   * The id of the picture object the regions replaced (`recovery.fromObjectId`),
   * which is no longer on the slide. Only on a rebuilt slide that had one; a page
   * render passed in from outside replaces no object.
   */
  replaced?: string;
  /** Objects the rebuild made, by kind. All zero for a kept slide. */
  objects: { text: number; pic: number; shape: number };
  /** Wall time the slide took here, decoding and OCR included, in milliseconds. Never part of an identity. */
  ms: number;
}

export interface ReadDeckResultV1 {
  source: SourceDeckV1;
  census: DeckCensusV1;
  /**
   * Every picture the deck holds, by its content-hash ref, the rebuild's crops
   * included. A crop of a slide that was not rebuilt in the end is not held.
   */
  media: Map<string, PipelineMediaV1>;
  /** One entry per slide the source marks flattened, in deck order. Empty for a deck with none. */
  flattened: FlattenedSlideReportV1[];
  /** How the flattened slides were read, for the plan to record. Null for a deck with none. */
  read: FlattenedReadV1 | null;
}

/** A picture with more pixels than this is not decoded for a rebuild: the same limit the PDF reader keeps. */
export const FLATTENED_MAX_PIXELS = 40_000_000;

const u16be = (b: Uint8Array, at: number): number => ((b[at] ?? 0) << 8) | (b[at + 1] ?? 0);
const u16le = (b: Uint8Array, at: number): number => (b[at] ?? 0) | ((b[at + 1] ?? 0) << 8);
const u24le = (b: Uint8Array, at: number): number => u16le(b, at) | ((b[at + 2] ?? 0) << 16);
const u32be = (b: Uint8Array, at: number): number => ((u16be(b, at) << 16) >>> 0) + u16be(b, at + 2);
const i32le = (b: Uint8Array, at: number): number => (u16le(b, at) | (u16le(b, at + 2) << 16)) | 0;
const tagAt = (b: Uint8Array, at: number, tag: string): boolean => [...tag].every((ch, k) => b[at + k] === ch.charCodeAt(0));

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Width and height from a JPEG's first frame header, or null. */
function jpegDimensions(b: Uint8Array): { width: number; height: number } | null {
  let at = 2;
  while (at + 4 <= b.length) {
    if (b[at] !== 0xff) return null;
    const marker = b[at + 1] ?? 0;
    if (marker === 0xff) {
      at += 1;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      at += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null;
    const length = u16be(b, at + 2);
    const frame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (frame && at + 9 <= b.length) return { height: u16be(b, at + 5), width: u16be(b, at + 7) };
    if (length < 2) return null;
    at += 2 + length;
  }
  return null;
}

/** Width and height from a WebP's first chunk, or null. */
function webpDimensions(b: Uint8Array): { width: number; height: number } | null {
  if (tagAt(b, 12, 'VP8 ') && b.length >= 30) return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  if (tagAt(b, 12, 'VP8L') && b.length >= 25) {
    const b1 = b[22] ?? 0;
    const b2 = b[23] ?? 0;
    const b3 = b[24] ?? 0;
    return { width: 1 + (((b1 & 0x3f) << 8) | (b[21] ?? 0)), height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)) };
  }
  if (tagAt(b, 12, 'VP8X') && b.length >= 30) return { width: 1 + u24le(b, 24), height: 1 + u24le(b, 27) };
  return null;
}

/**
 * A picture's width and height read from its header, without decoding it:
 * PNG, JPEG, GIF, WebP and BMP. Null for other formats, or a header too short
 * or odd to read, so a caller cannot size the decode and does not start it.
 */
export function pictureDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  let found: { width: number; height: number } | null = null;
  if (bytes.length >= 24 && startsWith(bytes, PNG_SIGNATURE) && tagAt(bytes, 12, 'IHDR')) {
    found = { width: u32be(bytes, 16), height: u32be(bytes, 20) };
  } else if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    found = jpegDimensions(bytes);
  } else if (bytes.length >= 10 && tagAt(bytes, 0, 'GIF8')) {
    found = { width: u16le(bytes, 6), height: u16le(bytes, 8) };
  } else if (bytes.length >= 16 && tagAt(bytes, 0, 'RIFF') && tagAt(bytes, 8, 'WEBP')) {
    found = webpDimensions(bytes);
  } else if (bytes.length >= 26 && tagAt(bytes, 0, 'BM')) {
    found = { width: i32le(bytes, 18), height: Math.abs(i32le(bytes, 22)) };
  }
  return found && found.width > 0 && found.height > 0 ? found : null;
}

/** Compressed bytes pushed to the inflater at a time, so one push expands to a few megabytes at most. */
const INFLATE_STEP = 4096;

/**
 * True when a PNG's image data inflates to no more than `limit` bytes. Checked
 * in steps with nothing kept, so data that expands far past what its header
 * says stops after a few megabytes rather than filling memory.
 */
function pngInflatesWithin(bytes: Uint8Array, limit: number): boolean {
  let total = 0;
  const inflater = new Unzlib((chunk) => {
    total += chunk.length;
  });
  try {
    for (let at = 8; at + 8 <= bytes.length; ) {
      const length = u32be(bytes, at);
      if (tagAt(bytes, at + 4, 'IEND')) break;
      if (tagAt(bytes, at + 4, 'IDAT')) {
        const body = bytes.subarray(at + 8, Math.min(bytes.length, at + 8 + length));
        for (let k = 0; k < body.length; k += INFLATE_STEP) {
          inflater.push(body.subarray(k, k + INFLATE_STEP), false);
          if (total > limit) return false;
        }
      }
      at += 12 + length;
    }
    inflater.push(new Uint8Array(0), true);
  } catch {
    return false;
  }
  return total <= limit;
}

/**
 * The default picture decoder: the pure PNG reader first (8-bit, not
 * interlaced, which is what the PDF reader writes), then sharp when it is
 * installed here. Null for what neither reads, for a picture whose size its
 * header does not give, and for one over `FLATTENED_MAX_PIXELS`: the size is
 * read before the decode starts, so a small file that claims a huge picture is never
 * expanded.
 */
export async function decodePipelinePicture(bytes: Uint8Array, mime: string): Promise<PipelinePictureV1 | null> {
  const size = pictureDimensions(bytes);
  if (!size || size.width * size.height > FLATTENED_MAX_PIXELS) return null;
  // The pure reader inflates all of the image data at once, so data that
  // expands past what an 8-bit RGBA picture of this size needs goes to sharp,
  // whose decoder stops at the size the header gives.
  if (mime === 'image/png' && pngInflatesWithin(bytes, size.height * (1 + 4 * size.width))) {
    const pure = await NODE_PDF_IMAGE_CODEC.decode?.(bytes, mime);
    if (pure) return pure;
  }
  const session = await import('../ml/session.ts');
  if (!session.isSharpAvailable()) return null;
  try {
    const picture = await session.decodeRgba(bytes);
    return picture.width * picture.height > FLATTENED_MAX_PIXELS ? null : picture;
  } catch {
    return null;
  }
}

/** Read one pptx package into a source deck. */
async function readPptxSource(input: ReadDeckInputV1, sink: MediaSinkV1): Promise<SourceDeckV1> {
  const { bytes, name } = input;
  let parts: Record<string, Uint8Array>;
  try {
    parts = await inflatePptx(bytes);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code: RebrandFailureCodeV1 = /too large/i.test(message) ? 'source.too-large' : 'source.unreadable';
    throw new RebrandPipelineError(code, `${name}: ${message}`);
  }
  if (!parts['ppt/presentation.xml']) {
    throw new RebrandPipelineError('source.unreadable', `${name} is a zip file but not a PowerPoint presentation.`);
  }
  input.signal?.throwIfAborted();
  try {
    return await sourceDeckFromPptx(parts, input.parseXml, {
      hash: sourceHashOf(bytes),
      instanceId: input.instanceId ?? newInstanceId(),
      name,
      bytes: bytes.byteLength,
      reader: { name: PIPELINE_READER.name, version: PIPELINE_READER.version },
      ...(input.maxMediaBytes !== undefined ? { maxMediaBytes: input.maxMediaBytes } : {}),
      ...(input.signal ? { signal: input.signal } : {}),
      // Chart labels drawn as glyph outlines are read back as text with the same reader.
      ...(input.ocr ? { labelReader: labelReaderFromOcr(input.ocr) } : {}),
      sink,
    });
  } catch (err) {
    if (input.signal?.aborted) throw err;
    if (err instanceof RebrandPipelineError) throw err;
    throw new RebrandPipelineError('source.unreadable', `${name}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Read one PDF into a source deck, with the pure codec and no web decoders (see the module header). */
async function readPdfSource(input: ReadDeckInputV1, sink: MediaSinkV1): Promise<SourceDeckV1> {
  const { bytes, name } = input;
  let source: SourceDeckV1;
  try {
    source = await sourceDeckFromPdf(bytes, {
      hash: sourceHashOf(bytes),
      instanceId: input.instanceId ?? newInstanceId(),
      name,
      bytes: bytes.byteLength,
      reader: { name: PDF_PIPELINE_READER.name, version: PDF_PIPELINE_READER.version },
      sink,
      codec: NODE_PDF_IMAGE_CODEC,
      ...(input.maxMediaBytes !== undefined ? { maxMediaBytes: input.maxMediaBytes } : {}),
      ...(input.signal ? { signal: input.signal } : {}),
    });
  } catch (err) {
    if (input.signal?.aborted) throw err;
    if (err instanceof RebrandPipelineError) throw err;
    throw new RebrandPipelineError('source.unreadable', `${name}: ${err instanceof Error ? err.message : String(err)}`);
  }
  // A damaged file can parse with no page tree at all; there is nothing to renovate.
  if (source.slides.length === 0) throw new RebrandPipelineError('source.unreadable', `${name} is a PDF with no pages that could be read.`);
  return source;
}

/**
 * The slide-level OCR state of a flattened slide that stays one picture: what
 * the slide already states when that is a reading, then the picture's own text
 * layer (a searchable scan), otherwise `missing`. Nothing ran here, so no model
 * is named unless the reading named one.
 */
function keptSlideOcr(slide: SlideSourceV1, pic: SourceObjectV1 | null, missing: OcrStateV1): NonNullable<SlideSourceV1['ocr']> {
  const prior = slide.ocr;
  // Only the contract's fields: a deck read back from disk can carry keys of its own.
  if (prior && (prior.state === 'text-found' || prior.state === 'no-text-found')) {
    return prior.model ? { state: prior.state, model: prior.model } : { state: prior.state };
  }
  const own = pic?.ocr;
  if (own && (own.state === 'text-found' || own.state === 'no-text-found')) {
    return own.model ? { state: own.state, model: own.model } : { state: own.state };
  }
  return { state: missing };
}

/** A kept slide with its OCR state and, when it was meant to be rebuilt, a warning saying why it was not. */
function keptSlide(
  slide: SlideSourceV1,
  pic: SourceObjectV1 | null,
  missing: OcrStateV1,
  warning?: { message: string; objectIds: string[] },
): SlideSourceV1 {
  const out: SlideSourceV1 = { ...slide, ocr: keptSlideOcr(slide, pic, missing) };
  if (warning) out.warnings = [...slide.warnings, { code: 'nodes-truncated', message: warning.message, objectIds: warning.objectIds }];
  return out;
}

/**
 * Handle every slide the source marks flattened: rebuild it from its regions, or
 * keep it as one picture with its OCR state written, and report which for each.
 * The deck comes back as it was (the same object) when it has no flattened
 * slide.
 *
 * A rebuild stores its crops in a staging map of its own, and they join `media`
 * (and the crop cache the next slide reads) only when the slide is rebuilt. A
 * slide that fails or is not cut part way through leaves nothing held that
 * no object names.
 */
async function handleFlattenedSlides(
  source: SourceDeckV1,
  media: Map<string, PipelineMediaV1>,
  input: ReadDeckInputV1,
): Promise<{ source: SourceDeckV1; reports: FlattenedSlideReportV1[] }> {
  const mode: FlattenedModeV1 = input.flattened ?? (input.ocr ? 'rebuild' : 'keep');
  const decode = input.decodePicture ?? decodePipelinePicture;
  const missing: OcrStateV1 = input.ocr ? 'not-run' : (input.ocrMissing ?? 'not-run');
  const mediaCache = new Map<string, string>();
  const reports: FlattenedSlideReportV1[] = [];
  const slides: SlideSourceV1[] = [];
  let changed = false;

  for (const slide of source.slides) {
    if (slide.origin.flattened !== true) {
      slides.push(slide);
      continue;
    }
    input.signal?.throwIfAborted();
    changed = true;
    const started = performance.now();
    const pic = flattenedPictureOf(slide);
    const report = (out: SlideSourceV1, outcome: 'rebuilt' | 'kept', reason?: FlattenedKeepReasonV1): void => {
      slides.push(out);
      const made = outcome === 'rebuilt' ? out.objects.filter((o) => o.origin === 'raster-region') : [];
      const count = (kind: SourceObjectV1['kind']): number => made.filter((o) => o.kind === kind).length;
      const entry: FlattenedSlideReportV1 = {
        slideId: slide.id,
        outcome,
        ocr: out.ocr?.state ?? missing,
        objects: { text: count('text'), pic: count('pic'), shape: count('shape') },
        ms: elapsed(started),
      };
      if (reason) entry.reason = reason;
      if (out.recovery) entry.recovery = out.recovery.assetRef;
      if (outcome === 'rebuilt' && out.recovery?.fromObjectId) entry.replaced = out.recovery.fromObjectId;
      reports.push(entry);
    };
    const keep = (reason: FlattenedKeepReasonV1, message?: string, objectIds: string[] = pic ? [pic.id] : []): void => {
      report(keptSlide(slide, pic, missing, message ? { message, objectIds } : undefined), 'kept', reason);
    };
    const tooLarge = (width: number, height: number): void => {
      keep('too-large', `The picture of ${slide.id} is ${width} by ${height} pixels, over the ${FLATTENED_MAX_PIXELS} pixel limit for a rebuild, so it stays one picture.`);
    };

    if (mode === 'keep') {
      keep('asked');
      continue;
    }
    if (!pic) {
      const own = slide.objects.filter((o) => o.origin === 'slide' || o.origin === 'pdf-artifact').map((o) => o.id);
      keep('not-one-picture', `${slide.id} is read as a picture of a slide, but it holds ${own.length === 0 ? 'no object' : own.length === 1 ? 'one object that is not a picture' : `${own.length} objects of its own`} rather than one picture, so it was not rebuilt and stays as it is.`, own);
      continue;
    }
    const held = pic.media ? media.get(pic.media) : undefined;
    if (!held) {
      keep('picture-missing', `The picture of ${slide.id} was not stored, so the slide was not rebuilt.`);
      continue;
    }
    // The size comes from the header, before a decoder allocates anything.
    const size = pictureDimensions(held.bytes);
    if (size && size.width * size.height > FLATTENED_MAX_PIXELS) {
      tooLarge(size.width, size.height);
      continue;
    }
    let picture: PipelinePictureV1 | null = null;
    try {
      picture = await decode(held.bytes, held.mime);
    } catch {
      picture = null;
    }
    if (!picture) {
      const why = size ? 'could not be decoded here' : 'is in a format whose size this reader cannot read before decoding it';
      keep('undecodable', `The picture of ${slide.id} (${held.mime || 'an unknown format'}) ${why}, so the slide was not rebuilt and stays one picture.`);
      continue;
    }
    // An injected decoder can return more than the header said.
    if (picture.width * picture.height > FLATTENED_MAX_PIXELS) {
      tooLarge(picture.width, picture.height);
      continue;
    }
    const staged = new Map<string, PipelineMediaV1>();
    const stagedCache = new Map(mediaCache);
    const stagingSink: MediaSinkV1 = async (data: Uint8Array, mime: string, hash: string): Promise<string> => {
      const ref = mediaRefFor(hash);
      if (!media.has(ref) && !staged.has(ref)) staged.set(ref, { bytes: data, mime });
      return ref;
    };
    let out: SlideSourceV1;
    try {
      out = await reconstructFlattenedSlide({
        slide,
        picture,
        sink: stagingSink,
        mediaCache: stagedCache,
        ocrMissing: missing === 'unavailable' ? 'unavailable' : 'not-run',
        ...(input.ocr ? { ocr: input.ocr } : {}),
        ...(input.ocrModel ? { ocrModel: input.ocrModel } : {}),
        ...(input.signal ? { signal: input.signal } : {}),
      });
    } catch (err) {
      if (input.signal?.aborted) throw err;
      keep('failed', `${slide.id} could not be rebuilt (${err instanceof Error ? err.message : String(err)}), so it stays one picture.`);
      continue;
    }
    // The rebuild can decline to cut the picture (a turned or clipped picture,
    // a region search that hit its cap); it says why in its own warning. Nothing was cut,
    // so the slide carries no recovery picture, the same as every other kept slide.
    if (out.objects.some((o) => o.id === pic.id)) {
      const { recovery: _uncut, ...kept } = out;
      report(kept, 'kept', 'not-cut');
      continue;
    }
    for (const [ref, one] of staged) media.set(ref, one);
    for (const [hash, ref] of stagedCache) mediaCache.set(hash, ref);
    report(out, 'rebuilt');
  }
  return { source: changed ? { ...source, slides } : source, reports };
}

function elapsed(started: number): number {
  return Math.round((performance.now() - started) * 10) / 10;
}

/**
 * Read one pptx or PDF into a source deck and its census, holding the pictures
 * in memory, with each slide the source marks flattened rebuilt or kept (see
 * the module header).
 */
export async function readDeck(input: ReadDeckInputV1): Promise<ReadDeckResultV1> {
  input.signal?.throwIfAborted();
  const kind = await sourceKindOf(input.bytes, input.name);
  const media = new Map<string, PipelineMediaV1>();
  const sink: MediaSinkV1 = async (data: Uint8Array, mime: string, hash: string): Promise<string> => {
    const ref = mediaRefFor(hash);
    if (!media.has(ref)) media.set(ref, { bytes: data, mime });
    return ref;
  };
  const read = kind === 'pdf' ? await readPdfSource(input, sink) : await readPptxSource(input, sink);
  const { source, reports } = await handleFlattenedSlides(read, media, input);
  const onSlide = input.onSlide;
  if (onSlide) {
    const total = source.slides.length;
    for (const [index, slide] of source.slides.entries()) onSlide(slide, index, total);
  }
  let shape: FlattenedReadV1 | null = null;
  if (reports.length > 0) {
    const flattened: FlattenedModeV1 = input.flattened ?? (input.ocr ? 'rebuild' : 'keep');
    const ocr = flattened === 'rebuild' && input.ocr !== undefined;
    shape = { flattened, ocr };
    if (ocr && input.ocrModel) shape.ocrModel = input.ocrModel;
  }
  return { source, census: censusDeck(source), media, flattened: reports, read: shape };
}

// ─── the design system ───────────────────────────────────────────────────────

/** A design system as plain data, or one already resolved (a caller that changed its swatches). */
export type PipelineSystemV1 = RebrandDesignSystemInputV1 | RebrandDesignSystemV1;

function isResolved(system: PipelineSystemV1): system is RebrandDesignSystemV1 {
  return 'firstPass' in system && 'compile' in system && 'snapshot' in system;
}

/** The looks and the lock a design-system input carries, for a first pass that keeps a look theme. */
export function themeFactsOf(system: RebrandDesignSystemV1): { looks?: NonNullable<ReturnType<typeof compileSystemOpts>['looks']>; locked?: boolean } {
  const { looks, locked } = compileSystemOpts(system.input);
  return { ...(looks ? { looks } : {}), ...(locked ? { locked } : {}) };
}

/** Resolve a design system unless the caller already did. */
export async function resolvePipelineSystem(system: PipelineSystemV1): Promise<RebrandDesignSystemV1> {
  return isResolved(system) ? system : resolveRebrandDesignSystem(system);
}

/** The schema's limit on each algorithm version string. */
const ALGORITHM_VERSION_MAX = 64;

/**
 * The read of the flattened slides as a reader-string suffix: `+keep`,
 * `+rebuild`, `+rebuild/ocr` or `+rebuild/ocr:<model>`. A model id too long for
 * the schema's 64 characters is left off, so the plan still says OCR ran.
 */
function flattenedSuffix(base: string, read: FlattenedReadV1): string {
  if (read.flattened === 'keep') return '+keep';
  if (!read.ocr) return '+rebuild';
  const named = read.ocrModel ? `+rebuild/ocr:${read.ocrModel}` : '+rebuild/ocr';
  return base.length + named.length <= ALGORITHM_VERSION_MAX ? named : '+rebuild/ocr';
}

const FLATTENED_SUFFIX = /\+(keep|rebuild)(?:\/(ocr)(?::(.+))?)?$/;

/**
 * The algorithm versions a plan from this pipeline records, for the kind of
 * source it read (pptx when left out). A deck with flattened slides also
 * records how they were read (`FlattenedReadV1`) after the reader's version,
 * so `pdf-read/1.220.0+rebuild/ocr:ppocr-v5-mobile`; `flattenedReadOfPlan`
 * reads it back.
 */
export function pipelineAlgorithms(kind: SourceKindV1 = 'pptx', read: FlattenedReadV1 | null = null): AlgorithmVersionsV1 {
  const identity = pipelineReaderFor(kind);
  const base = `${identity.name}/${identity.version}`;
  return {
    reader: read ? `${base}${flattenedSuffix(base, read)}` : base,
    census: CENSUS_RULES.version,
    plan: PLAN_RULES.version,
  };
}

/**
 * How the plan's source had its flattened slides read, from the reader string
 * `pipelineAlgorithms` wrote, or null when the plan records none (a deck with
 * no flattened slide, or a plan from before this was recorded). A compile
 * that reads the file again passes these as `flattened` and `ocrModel`, and an
 * OCR runner when `ocr` is true, so it reads the objects the plan names:
 *
 *   const read = flattenedReadOfPlan(plan);
 *   await readDeck({ ...input, ...(read ? { flattened: read.flattened } : {}),
 *     ...(read?.ocr ? { ocr, ocrModel: read.ocrModel } : {}) });
 */
export function flattenedReadOfPlan(plan: Pick<RenovationPlanV1, 'algorithms'>): FlattenedReadV1 | null {
  const match = FLATTENED_SUFFIX.exec(plan.algorithms.reader);
  if (!match) return null;
  const flattened: FlattenedModeV1 = match[1] === 'rebuild' ? 'rebuild' : 'keep';
  const read: FlattenedReadV1 = { flattened, ocr: flattened === 'rebuild' && match[2] === 'ocr' };
  if (read.ocr && match[3]) read.ocrModel = match[3];
  return read;
}

// ─── plan ────────────────────────────────────────────────────────────────────

export interface PlanDeckInputV1 extends ReadDeckInputV1 {
  system: PipelineSystemV1;
  preset?: RenovationPresetV1;
  /** The plan this one supersedes; its decisions are carried where they match. */
  previous?: RenovationPlanV1;
  /** Seed for the colour solver's candidate order. */
  seed?: number;
  /**
   * Auto-match (plan 275 decision 28): after the first pass, set every slide whose
   * structure read reaches these bands to the layout it names. Off when absent.
   */
  autoMatch?: AutoMatchBandsV1;
  /**
   * Called as each stage completes: `census` once the deck is read and
   * censused, `plan` once the first pass has run. A folder run records these as
   * the deck's checkpoints.
   */
  onStage?: (stage: 'census' | 'plan') => void | Promise<void>;
}

export interface PlanDeckResultV1 extends ReadDeckResultV1 {
  plan: RenovationPlanV1;
  /** Slides Auto-match set, when `autoMatch` was asked for. */
  autoMatched: string[];
  /** The resolved system the plan was made against, for the compile that follows. */
  system: RebrandDesignSystemV1;
}

/**
 * Read, census and first pass: stages 1 to 3. A PDF is read as well as a pptx,
 * and the flattened slides are rebuilt or kept by `ocr` and `flattened` exactly
 * as `readDeck` does it, before the census sees them. The plan records how they
 * were read, for `flattenedReadOfPlan`.
 */
export async function planDeck(input: PlanDeckInputV1): Promise<PlanDeckResultV1> {
  const system = await resolvePipelineSystem(input.system);
  const read = await readDeck(input);
  await input.onStage?.('census');
  let plan = firstPass({
    source: read.source,
    census: read.census,
    designSystem: system.firstPass,
    algorithms: pipelineAlgorithms(read.source.source.kind, read.read),
    ...(input.preset ? { preset: input.preset } : {}),
    ...(input.previous ? { previous: input.previous } : {}),
    ...(input.seed !== undefined ? { seed: input.seed } : {}),
    ...themeFactsOf(system),
  });
  let autoMatched: string[] = [];
  if (input.autoMatch) {
    const matched = autoMatchLayouts(plan, read.source, read.census, { bands: input.autoMatch, master: system.input.master });
    plan = matched.plan;
    autoMatched = matched.touched;
  }
  await input.onStage?.('plan');
  return { ...read, plan, system, autoMatched };
}

// ─── compile ─────────────────────────────────────────────────────────────────

/**
 * Which rows `acceptSuggestions` answers: `unreviewed` (the web's "Accept all
 * suggestions") or `all`, which also answers the rows flagged for a person.
 */
export type AcceptScopeV1 = 'unreviewed' | 'all';

export interface CompileDeckInputV1 {
  source: SourceDeckV1;
  census?: DeckCensusV1;
  plan: RenovationPlanV1;
  system: PipelineSystemV1;
  /**
   * Answer the open rows before compiling; the report names each row answered.
   * `true` is the `unreviewed` scope.
   */
  acceptSuggestions?: boolean | AcceptScopeV1;
  /** Who answered, when `acceptSuggestions` is set. `agent` when left out. */
  author?: DecisionAuthorV1;
  /** Passed to the compile: apply unreviewed proposals without answering them. False by default. */
  applyUnreviewed?: boolean;
  /**
   * Passed to the compile: also apply proposals a rule flagged for a person, as the
   * preview does. False by default, so a flagged row compiles as keep.
   */
  applyNeedsAttention?: boolean;
  /**
   * Auto-match before compiling (plan 275 decision 28): every slide whose structure
   * read reaches these bands takes the layout it names. The report carries one
   * `layout.auto-matched` entry per slide Auto-match set, this run or before it.
   */
  autoMatch?: AutoMatchBandsV1;
}

export interface CompileDeckResultV1 {
  compiled: CompiledDeckV1;
  /** The same report the compiled deck carries. */
  report: RebrandReportV1;
  /** The plan that was compiled: the input, or the input with the suggestions answered. */
  plan: RenovationPlanV1;
  /** Rows `acceptSuggestions` answered, with the review state each had before. */
  appliedUnreviewed: Array<{ id: string; review: ReviewStateV1 }>;
  /** Slides this compile's Auto-match set. */
  autoMatched: string[];
}

/**
 * The ways a plan's slides and rows fail to match the source one to one: a slide
 * or object the plan names twice, names but the source lacks, or leaves out.
 * Empty when every source slide and object has exactly one plan entry.
 */
export function planSourceProblems(plan: RenovationPlanV1, source: SourceDeckV1): string[] {
  const problems: string[] = [];
  const sourceSlides = new Map(source.slides.map((slide) => [slide.id, slide]));
  const seenSlides = new Set<string>();
  const seenRows = new Set<string>();
  const objectSlide = new Map<string, string>();
  for (const slide of source.slides) for (const object of slide.objects) objectSlide.set(object.id, slide.id);
  for (const slide of plan.slides) {
    if (seenSlides.has(slide.id)) problems.push(`the slide ${slide.id} is in the plan twice`);
    seenSlides.add(slide.id);
    if (!sourceSlides.has(slide.id)) problems.push(`the slide ${slide.id} is not in the source`);
    for (const row of slide.objects) {
      if (seenRows.has(row.id)) problems.push(`the object ${row.id} is in the plan twice`);
      seenRows.add(row.id);
      const home = objectSlide.get(row.id);
      if (home === undefined) problems.push(`the object ${row.id} is not in the source`);
      else if (home !== slide.id) problems.push(`the object ${row.id} is on ${home} in the source, not ${slide.id}`);
    }
  }
  for (const id of sourceSlides.keys()) if (!seenSlides.has(id)) problems.push(`the source slide ${id} has no plan entry`);
  for (const id of objectSlide.keys()) if (!seenRows.has(id)) problems.push(`the source object ${id} has no plan row`);
  return problems;
}

/**
 * Refuse a plan for other bytes, another design system or a different set of
 * slides and objects with a stable code. The compile checks some of the same
 * things and throws plain errors; checking first is what gives a caller a code
 * to branch on.
 */
export function checkPlanFits(plan: RenovationPlanV1, source: SourceDeckV1, system: RebrandDesignSystemV1): void {
  if (plan.source.hash !== source.source.hash) {
    throw new RebrandPipelineError('plan.hash-mismatch', `The plan was made for ${plan.source.hash} and this file is ${source.source.hash}.`);
  }
  if (plan.designSystem.tokenHash !== system.snapshot.tokenHash) {
    throw new RebrandPipelineError(
      'plan.design-system-mismatch',
      `The plan was made against the colour tokens ${plan.designSystem.tokenHash} and the active design system has ${system.snapshot.tokenHash}. Use the content profile the plan was made with (LOLLY_PROFILE).`,
    );
  }
  const masterId = system.input.master.id;
  if (plan.designSystem.masterId !== undefined && plan.designSystem.masterId !== masterId) {
    throw new RebrandPipelineError(
      'plan.design-system-mismatch',
      `The plan was made against the slide master ${plan.designSystem.masterId} and the active design system has ${masterId}.`,
    );
  }
  const problems = planSourceProblems(plan, source);
  if (problems.length > 0) {
    const shown = problems.slice(0, 5).join('; ');
    const cause = flattenedReadProblem(plan, source);
    throw new RebrandPipelineError(
      'plan.invalid',
      `${cause ? `${cause} ` : ''}The plan does not match the deck's slides and objects one to one: ${shown}${problems.length > 5 ? `; and ${problems.length - 5} more` : ''}.`,
    );
  }
}

/** How a read handled the flattened slides, in words. */
function flattenedReadWords(read: FlattenedReadV1): string {
  if (read.flattened === 'keep') return 'kept them as pictures';
  if (!read.ocr) return 'rebuilt them without OCR';
  return read.ocrModel ? `rebuilt them with the OCR model ${read.ocrModel}` : 'rebuilt them with OCR';
}

/**
 * The cause, in words, when the only slides a plan does not fit are flattened
 * ones: the file was read with other flattened options than the plan was made
 * from (or on a host that could not decode their pictures), so their objects
 * differ. Null when some other slide differs too, which is a different plan.
 */
function flattenedReadProblem(plan: RenovationPlanV1, source: SourceDeckV1): string | null {
  const rows = new Map(plan.slides.map((slide) => [slide.id, new Set(slide.objects.map((row) => row.id))]));
  const differs = source.slides.filter((slide) => {
    const planned = rows.get(slide.id);
    return planned !== undefined && (planned.size !== slide.objects.length || slide.objects.some((o) => !planned.has(o.id)));
  });
  if (differs.length === 0 || differs.some((slide) => slide.origin.flattened !== true)) return null;
  const recorded = flattenedReadOfPlan(plan);
  const rebuiltNow = differs.filter((slide) => slide.recovery !== undefined).length;
  const now = rebuiltNow === differs.length ? 'rebuilt them' : rebuiltNow === 0 ? 'kept them as pictures' : `rebuilt ${rebuiltNow} and kept ${differs.length - rebuiltNow} as pictures`;
  const ids = differs.slice(0, 5).map((slide) => slide.id).join(', ');
  const made = recorded ? `The plan was made from a read that ${flattenedReadWords(recorded)}` : 'The plan does not record how they were read';
  const fix = recorded
    ? `Read the file again with the options flattenedReadOfPlan gives for this plan${recorded.ocr ? ' and an OCR runner' : ''}${recorded.flattened === 'rebuild' ? ', on a host that can decode the slide pictures' : ''}.`
    : 'Make the plan again from this read.';
  return `The flattened slides ${ids}${differs.length > 5 ? ` and ${differs.length - 5} more` : ''} were read another way than when the plan was made. ${made}, and this read ${now}. ${fix}`;
}

/** The scope an `acceptSuggestions` value asks for, or null for none. */
export function acceptScopeOf(value: boolean | AcceptScopeV1 | undefined): AcceptScopeV1 | null {
  if (value === true) return 'unreviewed';
  return value === 'unreviewed' || value === 'all' ? value : null;
}

/** Stage 5: compile the plan, answering the review first when asked to. */
export async function compileDeck(input: CompileDeckInputV1): Promise<CompileDeckResultV1> {
  const system = await resolvePipelineSystem(input.system);
  checkPlanFits(input.plan, input.source, system);
  let plan = input.plan;
  let appliedUnreviewed: CompileDeckResultV1['appliedUnreviewed'] = [];
  let autoMatched: string[] = [];
  if (input.autoMatch) {
    const matched = autoMatchLayouts(plan, input.source, input.census, { bands: input.autoMatch, master: system.input.master });
    autoMatched = matched.touched;
    if (autoMatched.length > 0) plan = { ...matched.plan, revision: plan.revision + 1 };
  }
  const scope = acceptScopeOf(input.acceptSuggestions);
  if (scope) {
    const before = new Map<string, ReviewStateV1>();
    for (const slide of plan.slides) for (const row of slide.objects) before.set(row.id, row.review);
    const answered = acceptAll(plan, { scope, author: input.author ?? 'agent', source: input.source });
    appliedUnreviewed = answered.touched.map((id) => ({ id, review: before.get(id) ?? 'unreviewed' }));
    // The engine's edits leave the revision to the store; this is that one write.
    plan = appliedUnreviewed.length > 0 ? { ...answered.plan, revision: input.plan.revision + 1 } : answered.plan;
  }
  const compiled = compileRenovated({
    source: input.source,
    plan,
    master: system.input.master,
    designSystem: system.compile,
    // The faces, the looks and the lock the input carries: the stage worker hands the
    // compile the same options from the same input, so one themed plan is one set of bytes.
    opts: { ...compileSystemOpts(system.input), applyUnreviewed: input.applyUnreviewed ?? false, applyNeedsAttention: input.applyNeedsAttention ?? false },
    ...(input.census ? { census: input.census } : {}),
  });
  if (appliedUnreviewed.length > 0) compiled.report = markAppliedUnreviewed(compiled.report, appliedUnreviewed);
  // One entry per slide Auto-match set, derived from the plan, so the report agrees
  // with a count read from the plan whichever run set them.
  compiled.report = withAutoMatchEntries(compiled.report, plan, system.input.master, input.source);
  return { compiled, report: compiled.report, plan, appliedUnreviewed, autoMatched };
}

// ─── outcome ─────────────────────────────────────────────────────────────────

/** What keeps a deck from being `ready`, counted. */
export interface OutcomeCountsV1 {
  /**
   * Rows nobody reviewed that still wait for an answer: no decision, not locked,
   * on an included slide (`openPendingCounts` in the engine).
   */
  pending: number;
  /** Rows flagged for a person that still wait for an answer, by the same rule. */
  attention: number;
  /** Kept objects with nothing to show. */
  unresolvedObjects: number;
  /**
   * Colour uses the solve could not map that still reach a kept object. A use
   * whose objects are all removed has nothing left to colour, so it waits for
   * nobody; the report still lists it.
   */
  unresolvedColours: number;
  /** Kept objects that fit no slide and wait in the tray, off the canvas. */
  tray: number;
}

/**
 * The counts behind `outcomeOf`. The rows still waiting are read by the engine's
 * one rule, `openPendingCounts` (no decision, unreviewed or needs attention, not
 * locked, on an included slide), so every surface counts and gates the rows the
 * web view gates Open in Design on. A row on a slide left out is not compiled and
 * a locked row is a person's own hold, so neither keeps a deck from being ready.
 */
export function outcomeCounts(plan: RenovationPlanV1, compiled: CompiledDeckV1): OutcomeCountsV1 {
  const kept = new Set<string>();
  for (const slide of plan.slides) {
    if (!slide.include) continue;
    for (const row of slide.objects) {
      if (effectiveAction(row) !== 'remove') kept.add(row.id);
    }
  }
  const unresolvedColours = plan.colors.filter((row) =>
    (row.unresolved !== undefined || (!row.to && !row.toPath)) && row.affects.some((id) => kept.has(id))).length;
  const { pending, attention } = openPendingCounts(plan);
  return {
    pending,
    attention,
    unresolvedObjects: compiled.report.counts.objects.unresolved,
    unresolvedColours,
    tray: compiled.tray.length,
  };
}

/**
 * `ready` when no row waits for an answer (`openPendingIds` names none), nothing
 * is unresolved and the tray is empty; `needs-review` otherwise.
 */
export function outcomeOf(plan: RenovationPlanV1, compiled: CompiledDeckV1): FileOutcomeV1 {
  if (openPendingIds(plan).length > 0) return 'needs-review';
  const counts = outcomeCounts(plan, compiled);
  return counts.unresolvedObjects === 0 && counts.unresolvedColours === 0 && counts.tray === 0
    ? 'ready'
    : 'needs-review';
}

// ─── the plan as a document ──────────────────────────────────────────────────

/** Where the plan schema lives in a checkout. */
const PLAN_SCHEMA_PATH = 'schemas/rebrand-plan-v1.schema.json';

type PlanValidator = (doc: unknown) => string[];
let planValidator: Promise<PlanValidator> | null = null;

/** The fields a plan cannot be read without, for a root that carries no schema file. */
function structuralPlanProblems(doc: unknown): string[] {
  const problems: string[] = [];
  const value = doc as Partial<RenovationPlanV1> | null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['the plan is not a JSON object'];
  if (value.version !== 1) problems.push('/version must be 1');
  if (!value.source || typeof value.source.hash !== 'string') problems.push('/source/hash is missing');
  if (!Array.isArray(value.slides)) problems.push('/slides must be an array');
  if (!Array.isArray(value.colors)) problems.push('/colors must be an array');
  if (!Array.isArray(value.fonts)) problems.push('/fonts must be an array');
  if (!value.designSystem || typeof value.designSystem.tokenHash !== 'string') problems.push('/designSystem/tokenHash is missing');
  return problems;
}

/**
 * The schema validator, or the structural check when the schema or ajv cannot be
 * loaded here. A failed load is answered by the structural check rather than kept
 * as a rejected promise that fails every later call.
 */
async function loadPlanValidator(): Promise<PlanValidator> {
  try {
    return await loadSchemaValidator();
  } catch {
    return structuralPlanProblems;
  }
}

async function loadSchemaValidator(): Promise<PlanValidator> {
  let schemaFile: string | null = null;
  try {
    const candidate = join(repoRoot(), PLAN_SCHEMA_PATH);
    if (existsSync(candidate)) schemaFile = candidate;
  } catch {
    schemaFile = null;
  }
  if (!schemaFile) return structuralPlanProblems;
  const schema = JSON.parse(readFileSync(schemaFile, 'utf8')) as Record<string, unknown>;
  const { default: Ajv } = await import('ajv/dist/2020.js');
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  return (doc: unknown): string[] => {
    if (validate(doc)) return structuralPlanProblems(doc);
    return (validate.errors ?? []).map((error) => `${error.instancePath || '/'} ${error.message ?? 'is not valid'}`);
  };
}

/**
 * The problems that stop a value from being a `RenovationPlanV1`: the plan schema
 * where the checkout carries it, and the fields every reader needs either way. An
 * empty list is a plan.
 */
export async function planProblems(doc: unknown): Promise<string[]> {
  planValidator ??= loadPlanValidator();
  return (await planValidator)(doc);
}

// ─── the Design document ─────────────────────────────────────────────────────

/** The Design tool's id. */
export const DESIGN_TOOL_ID = 'design';
/** The session key the web view reads the renovation's report and lineage from. */
export const REBRAND_HANDOFF_KEY = '__rebrandHandoff';

const rowText = (row: DesignBoxRowV1, key: string): string => {
  const value = row[key];
  return typeof value === 'string' ? value : '';
};

/** The words a layer list shows for a placeholder's class. */
const PLACEHOLDER_CLASS_WORDS: Record<string, string> = {
  'template-furniture': 'template furniture',
  decoration: 'decoration',
  'logo-candidate': 'logo',
  'known-logo': 'logo',
  'recurring-text': 'recurring text',
  'page-number': 'page number',
  footer: 'footer',
  date: 'date',
  title: 'title',
  subtitle: 'subtitle',
  body: 'body',
  chart: 'chart',
  screenshot: 'screenshot',
  photo: 'photo',
  table: 'table',
  diagram: 'diagram',
  unknown: 'object',
};

/** Every row of a compiled deck, in deck order, frame row first. The raw rows `designFramesToPptx` reads. */
export function compiledRows(compiled: CompiledDeckV1): DesignBoxRowV1[] {
  return compiled.frames.flatMap((frame) => frame.layers.map((layer) => ({ ...layer })));
}

export interface DesignSessionV1 {
  /** The session's values by Design input id, plus its `__` markers. */
  values: Record<string, unknown>;
  /** Media refs the document draws, which a `.lolly` must carry for it to open whole. */
  mediaRefs: string[];
}

export interface DesignSessionOptsV1 {
  /** A name for the session, shown in Projects. */
  label: string;
  /** The Design tool version this was written for, when known. */
  toolVersion?: string;
  /** The renovation's id, recorded on the marker. */
  projectId: string;
}

/**
 * A compiled deck as a Design session: the rows as the `boxes` value, ids kept
 * exactly (the lineage names them), with the same two touches the web handoff
 * makes: a placeholder layer is locked and named for its class, and furniture is
 * locked. A kept picture's `image` becomes a user asset ref, so a `.lolly` that
 * carries its bytes rekeys it on import.
 */
export function designSessionFromCompiled(compiled: CompiledDeckV1, opts: DesignSessionOptsV1): DesignSessionV1 {
  const classOfLayer = new Map<string, string>();
  for (const entry of compiled.report.entries) {
    if (entry.layerId && entry.class && !classOfLayer.has(entry.layerId)) classOfLayer.set(entry.layerId, entry.class);
  }
  const mediaRefs: string[] = [];
  const boxes: Array<Record<string, unknown>> = [];
  for (const frame of compiled.frames) {
    const placeholders = new Set(frame.placeholderLayerIds);
    const furniture = new Set(frame.furnitureLayerIds);
    for (const layer of frame.layers) {
      const row: Record<string, unknown> = { ...layer };
      const id = rowText(layer, 'id');
      if (placeholders.has(id)) {
        row.locked = true;
        const cls = classOfLayer.get(id);
        row.name = cls ? `Placeholder: ${PLACEHOLDER_CLASS_WORDS[cls] ?? 'object'}` : 'Placeholder';
      } else if (furniture.has(id)) {
        row.locked = true;
      }
      const image = rowText(layer, 'image');
      if (image.startsWith(MEDIA_REF_PREFIX)) {
        row.image = { id: image, source: 'user' };
        if (!mediaRefs.includes(image)) mediaRefs.push(image);
      }
      boxes.push(row);
    }
  }
  // The document size the web handoff sets from the first frame, so the session
  // opens at the slide size rather than Design's default.
  const first = compiled.frames[0];
  const values: Record<string, unknown> = {
    boxes,
    __toolId: DESIGN_TOOL_ID,
    __label: opts.label,
    ...(first && first.width > 0 && first.height > 0
      ? { __export_width: String(first.width), __export_height: String(first.height), __export_unit: 'px' }
      : {}),
    [REBRAND_HANDOFF_KEY]: {
      projectId: opts.projectId,
      planRevision: compiled.planRevision,
      source: { ...compiled.source },
      idsKept: true,
      lineage: compiled.lineage,
      report: compiled.report,
    },
  };
  if (opts.toolVersion) values.__toolVersion = opts.toolVersion;
  return { values, mediaRefs };
}

// ─── the .lolly session file ─────────────────────────────────────────────────

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  'image/x-emf': 'emf',
  'image/x-wmf': 'wmf',
};

export interface DesignLollyInputV1 {
  session: DesignSessionV1;
  media: ReadonlyMap<string, PipelineMediaV1>;
  /** The file name stem and the manifest's display name. */
  name: string;
  toolVersion?: string;
  /** When the file was written; the caller owns the clock. */
  exportedAt: string;
}

export interface DesignLollyResultV1 {
  bytes: Uint8Array;
  /** Media refs the document draws but this run did not hold, recorded as references. */
  missingMedia: string[];
}

/**
 * A `.lolly` session file for a Design document: the manifest the web intake and
 * `readLollyFile` read, `session.json`, and each kept picture under
 * `assets/uploads/`, every payload part in the integrity map. The format is the
 * web writer's (`shells/web/src/lib/lolly-pack.ts`); a shell cannot import that
 * module, so this writes the session subset it reads.
 */
export async function buildDesignLolly(input: DesignLollyInputV1): Promise<DesignLollyResultV1> {
  const { zipSync, strToU8 } = await import('fflate');
  const entries: Record<string, [Uint8Array, { level: 0 | 6 }]> = {};
  const assets: Array<Record<string, unknown>> = [];
  const missingMedia: string[] = [];
  let totalBytes = 0;
  for (const ref of input.session.mediaRefs) {
    const held = input.media.get(ref);
    const hex = ref.slice(MEDIA_REF_PREFIX.length);
    if (!held) {
      missingMedia.push(ref);
      assets.push({ kind: 'asset-ref', id: ref, source: 'user', label: hex.slice(0, 12), type: 'data', format: '', mime: '' });
      continue;
    }
    const ext = MIME_EXT[held.mime] ?? 'bin';
    const path = `assets/uploads/${hex}.${ext}`;
    entries[path] = [held.bytes, { level: 0 }];
    totalBytes += held.bytes.byteLength;
    assets.push({
      kind: 'asset', id: ref, source: 'user', path, bytes: held.bytes.byteLength,
      label: `${hex.slice(0, 12)}.${ext}`, type: ext === 'svg' ? 'vector' : 'raster', format: ext, mime: held.mime,
    });
  }
  entries['session.json'] = [strToU8(JSON.stringify(input.session.values, null, 2)), { level: 6 }];

  const integrity: Record<string, string> = {};
  for (const path of Object.keys(entries).sort()) integrity[path] = sriSha256(entries[path]![0]);
  for (const asset of assets) if (typeof asset.path === 'string') asset.checksum = integrity[asset.path];

  const carried = assets.filter((asset) => asset.kind === 'asset').length;
  const manifest = {
    format: 'lolly-share',
    formatVersion: 1,
    minReader: 1,
    app: `Lolly ${ENGINE_VERSION}`,
    engineVersion: ENGINE_VERSION,
    kind: 'session',
    tool: { id: DESIGN_TOOL_ID, ...(input.toolVersion ? { version: input.toolVersion } : {}) },
    exportedAt: input.exportedAt,
    counts: { assets: carried, byReference: assets.length - carried, bytes: totalBytes },
    creator: null,
    assets,
    integrity,
  };
  const bytes = zipSync({
    'manifest.json': [strToU8(JSON.stringify(manifest, null, 2)), { level: 6 }],
    ...entries,
  });
  return { bytes, missingMedia };
}

// ─── the native .pptx ────────────────────────────────────────────────────────

/** A catalog asset's bytes, by its id or its `/catalog/...` url, from the active profile. */
export function catalogAssetBytes(ref: string, roots?: ContentRoots): PipelineMediaV1 | null {
  let file: string | null = null;
  try {
    const r = roots ?? contentRoots();
    if (ref.startsWith('/')) {
      file = contentUrlFile(ref, r);
    } else {
      const index = readAssetIndex(r) as { assets?: Array<{ id?: string; formats?: Array<{ url?: string }> }> };
      const asset = (index.assets ?? []).find((entry) => entry.id === ref);
      for (const format of asset?.formats ?? []) {
        file = format.url ? contentUrlFile(format.url, r) : null;
        if (file) break;
      }
    }
  } catch {
    file = null;
  }
  if (!file) return null;
  const lower = file.toLowerCase();
  const mime = lower.endsWith('.png') ? 'image/png'
    : lower.endsWith('.jpg') || lower.endsWith('.jpeg') ? 'image/jpeg'
      : lower.endsWith('.svg') ? 'image/svg+xml'
        : lower.endsWith('.gif') ? 'image/gif' : '';
  return mime ? { bytes: new Uint8Array(readFileSync(file)), mime } : null;
}

export interface CompiledPptxInputV1 {
  compiled: CompiledDeckV1;
  system: RebrandDesignSystemV1;
  media: ReadonlyMap<string, PipelineMediaV1>;
  /** Bytes for a ref the media map does not hold (a catalog logo). */
  resolveCatalog?: (ref: string) => Promise<PipelineMediaV1 | null> | PipelineMediaV1 | null;
  /** Raster bytes for an SVG picture; without one an SVG layer is reported, not drawn. */
  rasterizeSvg?: (bytes: Uint8Array, w: number, h: number) => Promise<Uint8Array | null>;
  /** The docProps title. */
  title?: string;
  /** The docProps timestamp; the caller owns the clock. */
  now: string;
}

export interface CompiledPptxResultV1 {
  bytes: Uint8Array;
  /** One line per thing the lowering did not carry across. */
  notes: string[];
}

/** A compiled deck as a native `.pptx`, through Design's own lowering. */
export async function compiledDeckToPptx(input: CompiledPptxInputV1): Promise<CompiledPptxResultV1> {
  const frames = framesOfDesignDoc({ boxes: compiledRows(input.compiled) });
  if (frames.length === 0) throw new RebrandPipelineError('export.failed', 'The compiled deck has no slides to write.');
  const resolveAsset: DesignAssetResolver = async (ref) => {
    const held = input.media.get(ref);
    if (held) return held;
    return input.resolveCatalog ? input.resolveCatalog(ref) : null;
  };
  const result = await designFramesToPptx({
    frames,
    master: input.system.input.master,
    tokens: input.system.compile.tokens,
    resolveAsset,
    ...(input.rasterizeSvg ? { rasterizeSvg: input.rasterizeSvg } : {}),
    ...(input.system.compile.fonts ? { fonts: input.system.compile.fonts } : {}),
  });
  const parts = buildPptxParts(result.slides, {
    emuW: Math.max(1, Math.round(result.size.w * EMU_PER_PX)),
    emuH: Math.max(1, Math.round(result.size.h * EMU_PER_PX)),
    ...(result.theme ? { theme: result.theme } : {}),
    ...(result.layouts.length ? { layouts: result.layouts } : {}),
    meta: input.title ? { title: input.title } : null,
    now: input.now,
  });
  const { zipSync } = await import('fflate');
  const encoder = new TextEncoder();
  const files: Record<string, Uint8Array> = {};
  for (const [path, content] of Object.entries(parts)) {
    files[path] = typeof content === 'string' ? encoder.encode(content) : content;
  }
  return { bytes: zipSync(files), notes: result.notes };
}
