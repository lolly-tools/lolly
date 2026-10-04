// SPDX-License-Identifier: MPL-2.0
/**
 * content-inventory.ts - the host half of `lolly read` and `lolly_read` (plan 291
 * W2): read a deck once, through the rebrand reader and census, and hand back the
 * `ContentInventoryV1` the engine projects from them.
 *
 * The engine's `inventoryFromSource` is pure, so the I/O it needs happens here:
 *   - `readDeck` reads the pptx, PDF or Photoshop bytes into a source deck, its
 *     census and its pictures (one per distinct SHA-256);
 *   - for a pptx, the same engine reader (`readPptx`) is run over the package to
 *     keep what the source deck flattens away: the notes as paragraphs with their
 *     line breaks, each picture's crop, and the SVG part of each drawing, which
 *     the inventory reports in place of the drawing's raster stand-in;
 *   - each picture's pixel size is read from its header, without decoding;
 *   - with a media directory, each distinct picture is written once as
 *     `<sha256>.<ext>`. A file already there with the same bytes is reused; one
 *     with other bytes is refused unless `force` is set, and nothing is written
 *     until every name has been checked;
 *   - with `thumbnails` as well, each slide is drawn once through the faithful
 *     compile and resvg, and written beside the pictures as `<sha256>.png`.
 *
 * No browser, no model, no network. jsdom parses the XML when the caller passes
 * no parser, imported only when needed so a host without it can still pass its own.
 */

import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { compileFaithful, framePreviewSvg, inventoryFromSource, readPptx, type InventoryMediaInputV1, type InventoryNotesParaInputV1 } from '@lolly/engine';
import type { ContentInventoryV1, DeckCensusV1, InventoryCropV1, SourceDeckV1 } from '@lolly-tools/core';

import { inflatePptx } from './pptx.ts';
import { MEDIA_REF_PREFIX, pictureDimensions, readDeck, type PipelineMediaV1, type RebrandXmlParserV1 } from './rebrand/pipeline.ts';
import { nodeRebrandFs, writeAtomic } from './rebrand-project-store.ts';
import { rasterizeSvgToPng } from './raster.ts';

export interface ReadInventoryInputV1 {
  bytes: Uint8Array;
  /** The file name, recorded on the inventory and used in messages. */
  name: string;
  /** Parses a pptx's XML parts. jsdom's `DOMParser` when absent. */
  parseXml?: RebrandXmlParserV1;
  /** Write each distinct picture here as `<sha256>.<ext>`. Nothing is written when this is absent. */
  mediaDir?: string;
  /** Replace a file under `mediaDir` whose bytes differ from the picture of the same name. */
  force?: boolean;
  /** Draw each slide as a PNG under `mediaDir` and record it as the slide's `thumbnail`. Needs `mediaDir`. */
  thumbnails?: boolean;
  /** Media over this many bytes is left unstored and reported, as the rebrand reader does. */
  maxMediaBytes?: number;
  signal?: AbortSignal;
}

export interface ReadInventoryResultV1 {
  inventory: ContentInventoryV1;
  /** The pictures by media ref, for a host that hands them on another way (an MCP file handle). */
  media: Map<string, PipelineMediaV1>;
  /** Files written under `mediaDir` by this call. */
  written: string[];
  /** Files already under `mediaDir` with the same bytes, left as they were. */
  reused: string[];
  /** The source deck and its census the inventory was projected from, for a caller that reads the layout too (`lolly compose --suggest`). */
  source: SourceDeckV1;
  census: DeckCensusV1;
}

export type ContentInventoryErrorCode = 'media.exists' | 'media.unwritable' | 'thumbnails.no-media';

/** A refusal or failure with a stable code, so a caller branches on `code`, never on the wording. */
export class ContentInventoryError extends Error {
  readonly code: ContentInventoryErrorCode;
  /** The files concerned. */
  readonly files: string[];
  constructor(code: ContentInventoryErrorCode, message: string, files: string[] = []) {
    super(message);
    this.name = 'ContentInventoryError';
    this.code = code;
    this.files = files;
  }
}

let parser: RebrandXmlParserV1 | null = null;

/** jsdom's `DOMParser` for XML, made once per process. */
export async function inventoryXmlParser(): Promise<RebrandXmlParserV1> {
  if (parser) return parser;
  let JSDOM: typeof import('jsdom').JSDOM;
  try {
    ({ JSDOM } = await import('jsdom'));
  } catch {
    throw new Error('Reading a pptx needs an XML parser: install jsdom, or pass parseXml.');
  }
  const domParser = new new JSDOM('').window.DOMParser();
  parser = (xml: string): Document => domParser.parseFromString(xml, 'application/xml') as unknown as Document;
  return parser;
}

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/tiff': 'tif',
  'image/svg+xml': 'svg',
  'image/x-emf': 'emf',
  'image/emf': 'emf',
  'image/x-wmf': 'wmf',
  'image/wmf': 'wmf',
  'image/avif': 'avif',
  'image/heic': 'heic',
};

/** The file name a picture is written under: its hash and the extension its type implies. */
export function mediaFileName(sha256: string, mime: string): string {
  return `${sha256}.${MIME_EXT[mime.toLowerCase()] ?? 'bin'}`;
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * What the source deck flattens away from a pptx: notes paragraphs by slide
 * position, crops by object id, and the SVG part bytes of each drawing by object id.
 */
function pptxExtras(
  parts: Record<string, Uint8Array>,
  parseXml: RebrandXmlParserV1,
  source: SourceDeckV1,
): { notesParas: Array<InventoryNotesParaInputV1[] | undefined>; crops: Map<string, InventoryCropV1>; svgs: Map<string, Uint8Array> } {
  const deck = readPptx(parts, parseXml);
  const notesParas: Array<InventoryNotesParaInputV1[] | undefined> = [];
  const crops = new Map<string, InventoryCropV1>();
  const svgs = new Map<string, Uint8Array>();
  source.slides.forEach((slide, position) => {
    const read = deck.slides[position];
    if (!read) return;
    notesParas[position] = read.notesParas;
    // Object ids are `<slide id>.<z>`, z counted over the inherited furniture and then
    // the slide's own nodes: the numbering `sourceDeckFromPptx` gives them.
    const ordered = [...(read.inherited ?? []), ...read.nodes];
    ordered.forEach((node, z) => {
      if (node.type !== 'pic') return;
      const svg = node.svg ? parts[node.svg] : undefined;
      if (svg && svg.length > 0) svgs.set(`${slide.id}.${z}`, svg);
      if (!node.srcRect) return;
      const crop: InventoryCropV1 = {};
      for (const edge of ['l', 't', 'r', 'b'] as const) {
        const value = node.srcRect[edge];
        if (typeof value === 'number' && Number.isFinite(value) && value !== 0) crop[edge] = Math.round(value * 1e6) / 1e6;
      }
      if (Object.keys(crop).length > 0) crops.set(`${slide.id}.${z}`, crop);
    });
  });
  return { notesParas, crops, svgs };
}

const errorCode = (err: unknown): unknown => (err as { code?: unknown } | null)?.code;

/** The bytes under `path`, null when nothing is there; any other failure is the folder's, with a stable code. */
async function existing(path: string, dir: string): Promise<Uint8Array | null> {
  try {
    if (!(await stat(path)).isFile()) return new Uint8Array(0);
    return new Uint8Array(await readFile(path));
  } catch (err) {
    if (errorCode(err) === 'ENOENT') return null;
    throw new ContentInventoryError('media.unwritable', `Cannot use ${dir} as the media folder: ${(err as Error).message}`, [path]);
  }
}

/** Refuse a media folder that is a file, before any picture is read. */
async function checkMediaDir(dir: string): Promise<void> {
  try {
    if (!(await stat(dir)).isDirectory()) {
      throw new ContentInventoryError('media.unwritable', `Cannot use ${dir} as the media folder: a file is there, not a folder.`, [dir]);
    }
  } catch (err) {
    if (err instanceof ContentInventoryError) throw err;
    if (errorCode(err) === 'ENOENT') return;
    throw new ContentInventoryError('media.unwritable', `Cannot use ${dir} as the media folder: ${(err as Error).message}`, [dir]);
  }
}

/** The long edge of a slide thumbnail, in px. */
export const THUMBNAIL_LONG_EDGE_PX = 640;

/** Types resvg draws from a data URI. A metafile is left undrawn rather than broken. */
const DRAWABLE = /^image\/(?:png|jpeg|jpg|gif|webp|svg\+xml)$/i;

/**
 * Each slide drawn as a PNG: the faithful compile (one layer per source object, the
 * source's own geometry) through the frame preview, rasterised by resvg. A slide
 * that fails to draw gets no thumbnail and a warning; the read itself stands.
 */
async function drawThumbnails(
  source: SourceDeckV1,
  media: ReadonlyMap<string, PipelineMediaV1>,
  warnings: Array<{ code: string; message: string }>,
  signal?: AbortSignal,
): Promise<Array<{ bytes: Uint8Array; width: number; height: number } | undefined>> {
  const hrefs = new Map<string, string>();
  const assetHref = (ref: string): string | undefined => {
    const cached = hrefs.get(ref);
    if (cached !== undefined) return cached;
    const item = media.get(ref);
    if (!item || !DRAWABLE.test(item.mime)) return undefined;
    const href = `data:${item.mime.toLowerCase()};base64,${Buffer.from(item.bytes).toString('base64')}`;
    hrefs.set(ref, href);
    return href;
  };
  let frames: ReturnType<typeof compileFaithful>['frames'];
  try {
    frames = compileFaithful(source).frames;
  } catch (err) {
    warnings.push({ code: 'thumbnails-unavailable', message: `The slides could not be drawn: ${(err as Error).message}` });
    return [];
  }
  const out: Array<{ bytes: Uint8Array; width: number; height: number } | undefined> = [];
  for (const [position, frame] of frames.entries()) {
    signal?.throwIfAborted();
    const long = Math.max(frame.width, frame.height, 1);
    const width = Math.max(1, Math.round((frame.width / long) * THUMBNAIL_LONG_EDGE_PX));
    const height = Math.max(1, Math.round((frame.height / long) * THUMBNAIL_LONG_EDGE_PX));
    try {
      const svg = framePreviewSvg(frame, { assetHref, emptySlots: false });
      out[position] = { bytes: await rasterizeSvgToPng(svg, width, height), width, height };
    } catch (err) {
      warnings.push({ code: 'thumbnail-failed', message: `Slide ${position + 1} could not be drawn: ${(err as Error).message}` });
    }
  }
  return out;
}

/**
 * Read a deck into a content inventory. Throws `RebrandPipelineError` (from the
 * reader: `source.unreadable`, `source.encrypted`, `source.too-large`) or
 * `ContentInventoryError` (`media.exists`, `media.unwritable`).
 */
export async function readContentInventory(input: ReadInventoryInputV1): Promise<ReadInventoryResultV1> {
  input.signal?.throwIfAborted();
  if (input.thumbnails && !input.mediaDir) {
    throw new ContentInventoryError('thumbnails.no-media', 'Thumbnails are written beside the pictures, so they need a media folder.');
  }
  if (input.mediaDir) await checkMediaDir(input.mediaDir);
  const parseXml = input.parseXml ?? (await inventoryXmlParser());
  const read = await readDeck({
    bytes: input.bytes,
    name: input.name,
    parseXml,
    ...(input.maxMediaBytes !== undefined ? { maxMediaBytes: input.maxMediaBytes } : {}),
    ...(input.signal ? { signal: input.signal } : {}),
  });
  const { source, census } = read;

  let notesParas: Array<InventoryNotesParaInputV1[] | undefined> | undefined;
  let crops: Map<string, InventoryCropV1> | undefined;
  let svgParts: Map<string, Uint8Array> | undefined;
  const warnings: Array<{ code: string; message: string }> = [];
  if (source.source.kind === 'pptx') {
    try {
      const extras = pptxExtras(await inflatePptx(input.bytes), parseXml, source);
      notesParas = extras.notesParas;
      crops = extras.crops;
      svgParts = extras.svgs;
    } catch (err) {
      // The deck already read once; a second pass that fails costs only the notes
      // structure and the crops, so it is reported rather than fatal.
      warnings.push({ code: 'notes-structure-unavailable', message: `The notes paragraphs and picture crops could not be read again: ${(err as Error).message}` });
    }
  }

  // A drawing is reported as its SVG: the package's own part when the deck is a
  // pptx, else the copy the reader kept on the object. Several drawings that share
  // one raster stand-in stay apart this way. An SVG over the media cap is not held,
  // and the raster stands in.
  const media = new Map(read.media);
  const vectors = new Map<string, string>();
  const maxSvg = input.maxMediaBytes ?? 64 * 1024 * 1024;
  for (const slide of source.slides) {
    for (const object of slide.objects) {
      if (object.kind !== 'vector') continue;
      const bytes = svgParts?.get(object.id) ?? (object.vector ? new TextEncoder().encode(object.vector) : undefined);
      if (!bytes || bytes.length === 0 || bytes.length > maxSvg) continue;
      const ref = `${MEDIA_REF_PREFIX}${sha256Hex(bytes)}`;
      if (!media.has(ref)) media.set(ref, { bytes, mime: 'image/svg+xml' });
      vectors.set(object.id, ref);
    }
  }

  let thumbnails: Array<{ file: string; width: number; height: number } | undefined> | undefined;
  const facts = new Map<string, InventoryMediaInputV1>();
  const planned: Array<{ ref: string; path: string; bytes: Uint8Array }> = [];
  if (input.thumbnails && input.mediaDir) {
    const drawn = await drawThumbnails(source, media, warnings, input.signal);
    thumbnails = drawn.map((thumb, position) => {
      if (!thumb) return undefined;
      const path = join(input.mediaDir!, mediaFileName(sha256Hex(thumb.bytes), 'image/png'));
      planned.push({ ref: `thumbnail/${position + 1}`, path, bytes: thumb.bytes });
      return { file: path, width: thumb.width, height: thumb.height };
    });
  }
  for (const [ref, item] of media) {
    const fromRef = ref.startsWith(MEDIA_REF_PREFIX) ? ref.slice(MEDIA_REF_PREFIX.length) : '';
    const sha256 = /^[0-9a-f]{64}$/.test(fromRef) ? fromRef : sha256Hex(item.bytes);
    const entry: InventoryMediaInputV1 = { sha256, mime: item.mime, bytes: item.bytes.length };
    const size = pictureDimensions(item.bytes);
    if (size && size.width >= 1 && size.height >= 1) {
      entry.width = size.width;
      entry.height = size.height;
    }
    if (input.mediaDir) {
      const path = join(input.mediaDir, mediaFileName(sha256, item.mime));
      entry.file = path;
      planned.push({ ref, path, bytes: item.bytes });
    }
    facts.set(ref, entry);
  }

  const written: string[] = [];
  const reused: string[] = [];
  if (input.mediaDir && planned.length > 0) {
    // Every name is checked before any byte is written, so a refusal leaves the
    // directory exactly as it was.
    const toWrite: typeof planned = [];
    const conflicts: string[] = [];
    const seen = new Set<string>();
    for (const item of planned) {
      // Two slides that draw the same thumbnail share one file.
      if (seen.has(item.path)) continue;
      seen.add(item.path);
      const there = await existing(item.path, input.mediaDir);
      if (there === null) toWrite.push(item);
      else if (sameBytes(there, item.bytes)) reused.push(item.path);
      else if (input.force) toWrite.push(item);
      else conflicts.push(item.path);
    }
    if (conflicts.length > 0) {
      throw new ContentInventoryError(
        'media.exists',
        `${conflicts.length === 1 ? 'A file' : `${conflicts.length} files`} under the media folder already ${conflicts.length === 1 ? 'holds' : 'hold'} other bytes under a picture's name (${conflicts[0]}). Nothing was written; pass --force to replace ${conflicts.length === 1 ? 'that file' : 'them'}, or choose another folder.`,
        conflicts,
      );
    }
    for (const item of toWrite) {
      input.signal?.throwIfAborted();
      try {
        await writeAtomic(nodeRebrandFs, item.path, item.bytes);
      } catch (err) {
        throw new ContentInventoryError('media.unwritable', `Could not write ${item.path}: ${(err as Error).message}`, [item.path]);
      }
      written.push(item.path);
    }
  }

  const inventory = inventoryFromSource(source, census, {
    name: input.name,
    sha256: sha256Hex(input.bytes),
    bytes: input.bytes.length,
    media: facts,
    ...(notesParas ? { notesParas } : {}),
    ...(crops ? { crops } : {}),
    ...(vectors.size > 0 ? { vectors } : {}),
    ...(thumbnails ? { thumbnails } : {}),
    warnings,
  });
  return { inventory, media, written, reused, source, census };
}
