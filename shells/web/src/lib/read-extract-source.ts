// SPDX-License-Identifier: MPL-2.0
/**
 * Read and extract in the web shell (plan 203, rank 10): a PowerPoint deck, a PDF or
 * a Photoshop file the person picked becomes a content inventory, read on the
 * device, which the view then bounds and writes out with the engine's `readExtract`.
 *
 * It is the same reading `lolly read` does, through the same readers, so the two
 * agree: `sourceDeckFromPptx`, `sourceDeckFromPdf` or `sourceDeckFromPsd` read the
 * bytes (told apart by their signature, never the name), the census classes every
 * object, and `inventoryFromSource` projects the result. Nothing is stored: the
 * pictures are held in memory by their content hash for this read alone, and the
 * caller drops them with the result.
 *
 * TEXT IN PICTURES. A page the reader marks as one picture of its text (a scan) is
 * kept as that picture unless the caller passes a recogniser. With one, each such
 * page is rebuilt from its regions by `reconstructFlattenedSlide`, one page at a
 * time, and its words carry the recogniser's model and confidence through to every
 * block. A scan's own text layer needs no recogniser: its words are listed as
 * text-layer words either way. The recogniser and the picture decoder arrive
 * through `ReadExtractSourceDepsV1`, so this module touches no DOM and no model and
 * runs under node against the committed fixtures.
 *
 * NOTHING THE FILE CARRIES IS RUN. An Office package's macros, controls and
 * embedded objects are counted by part name, and a PDF's scripts, launch actions
 * and attachments by the Verify structure walk (`pdfActiveContent`, which
 * `lolly read` calls too). Each is reported in the inventory's warnings, never run
 * or opened.
 */

import type { ContentInventoryV1, SlideSourceV1, SourceDeckV1 } from '@lolly-tools/core';
import type { OcrLine } from '@lolly-tools/core/host-v1';
import type { PdfImageCodec, PdfResourceDecoders } from '@lolly-tools/node-shell/pdf-read';
import { pdfActiveContent } from '@lolly-tools/node-shell/pdf-active-content';
import { inflatePptx } from '@lolly-tools/node-shell/pptx';
import { flattenedPictureOf, reconstructFlattenedSlide, type FlattenedOcrV1 } from '@lolly-tools/node-shell/rebrand/flattened';
import { sourceDeckFromPdf } from '@lolly-tools/node-shell/rebrand/source-pdf';
import { sourceDeckFromPsd } from '@lolly-tools/node-shell/rebrand/source-psd';
import { newInstanceId, sourceDeckFromPptx, type MediaSinkV1 } from '@lolly-tools/node-shell/rebrand/source-pptx';
import { unzlibSync } from 'fflate';
import { activeContentWarnings, ooxmlActiveContent, type ActiveContentV1 } from '../../../../engine/src/read-extract.ts';
import { inventoryFromSource, type InventoryMediaInputV1, type InventoryNotesParaInputV1, type InventoryRecognizerV1 } from '../../../../engine/src/content-inventory.ts';
import { censusDeck } from '../../../../engine/src/deck-census.ts';
import { readPptx } from '../../../../engine/src/pptx-read.ts';
import { sha256Hex } from '../../../../engine/src/bytes.ts';
import { ENGINE_VERSION } from '../../../../engine/src/version.ts';

/** The file kinds this reads, in the inventory's own terms. */
export type ExtractSourceKind = 'pptx' | 'pdf' | 'psd';

/** A file over this size is refused before it is read: the same ceiling Unpack keeps. */
export const READ_EXTRACT_MAX_BYTES = 120 * 1024 * 1024;

/** A page picture with more pixels than this is not decoded for text recognition. */
export const READ_EXTRACT_MAX_PICTURE_PIXELS = 40_000_000;

export type ReadExtractSourceErrorCode = 'unsupported' | 'too-large' | 'unreadable' | 'empty';

/** A file this cannot read, with a stable code the view turns into a sentence. */
export class ReadExtractSourceError extends Error {
  readonly code: ReadExtractSourceErrorCode;
  constructor(code: ReadExtractSourceErrorCode, message: string) {
    super(message);
    this.name = 'ReadExtractSourceError';
    this.code = code;
  }
}

/** RGBA pixels, the shape the rebuild reads. */
export interface ExtractPicturePixelsV1 {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

/** A recogniser for pages that are pictures, with the model it reads with. */
export interface ExtractRecogniserV1 {
  read: FlattenedOcrV1;
  model: string;
}

export interface ReadExtractSourceDepsV1 {
  /** Parses a pptx's XML parts: the window `DOMParser` in the browser. */
  parseXml(xml: string): Document;
  /** The PDF image codec and resource decoders the PDF import uses. Absent: the reader's pure codec. */
  pdfReaders?: () => Promise<{ codec?: PdfImageCodec; decoders?: PdfResourceDecoders }>;
  /** Decodes a Photoshop file's layers: the shell's PSD reader, loaded only for a PSD. Absent: the engine's own reader. */
  psdDecode?: () => Promise<Parameters<typeof sourceDeckFromPsd>[1]['decode']>;
  /** Reads text in pages that are pictures. Absent or null: such pages stay pictures. */
  recogniser?: ExtractRecogniserV1 | null;
  /** Decodes a held picture to pixels for the rebuild; null when it cannot. */
  decodePicture?: (bytes: Uint8Array, mime: string) => Promise<ExtractPicturePixelsV1 | null>;
  /** The host's text recognition catalogue, so each recognised frame records the model's release and languages. */
  recognizers?: ReadonlyMap<string, InventoryRecognizerV1>;
  signal?: AbortSignal;
  /** Pages read so far; during recognition, scanned pages read so far. */
  onProgress?: (phase: 'read' | 'recognise', done: number, total: number) => void;
}

export interface ReadExtractSourceResultV1 {
  inventory: ContentInventoryV1;
  kind: ExtractSourceKind;
  /** Every picture the file holds, by media ref, for the view to show. Held in memory only. */
  media: Map<string, { bytes: Uint8Array; mime: string }>;
  /** Pages that are pictures of their text, by number, and whether recognition read them. */
  scanned: { pages: number[]; recognised: number[] };
}

const MEDIA_PREFIX = 'user/media/';

const startsWith = (bytes: Uint8Array, magic: readonly number[], at = 0): boolean => magic.every((b, i) => bytes[at + i] === b);
/** `%PDF-`, which the format allows a little leading junk before. */
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d];

/** The kind of file the bytes are, by their signature, or null for one this does not read. */
export function sniffExtractSource(bytes: Uint8Array): ExtractSourceKind | null {
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return 'pptx';
  if (startsWith(bytes, [0x38, 0x42, 0x50, 0x53])) return 'psd';
  const window = Math.min(bytes.length - PDF_MAGIC.length, 1024);
  for (let at = 0; at <= window; at++) if (startsWith(bytes, PDF_MAGIC, at)) return 'pdf';
  return null;
}

/** Notes paragraphs by slide position, so a line break and a paragraph end stay apart. */
function notesParasOf(parts: Record<string, Uint8Array>, parseXml: (xml: string) => Document): Array<InventoryNotesParaInputV1[] | undefined> | undefined {
  try {
    return readPptx(parts, parseXml).slides.map((slide) => slide.notesParas);
  } catch {
    return undefined;
  }
}

/** The slides of a read deck that are still one picture of a whole page. */
function scannedSlides(source: SourceDeckV1): SlideSourceV1[] {
  return source.slides.filter((slide) => slide.origin.flattened === true && flattenedPictureOf(slide) !== null);
}

/**
 * Rebuild each page that is one picture of its text and read its words, one page
 * at a time. A page that cannot be decoded, or that the rebuild leaves uncut, stays
 * as it was. The pieces a rebuild cuts join `media` only when the page is rebuilt.
 */
async function recognisePages(
  source: SourceDeckV1,
  media: Map<string, { bytes: Uint8Array; mime: string }>,
  recogniser: ExtractRecogniserV1,
  deps: ReadExtractSourceDepsV1,
): Promise<{ source: SourceDeckV1; recognised: number[] }> {
  const todo = scannedSlides(source);
  const recognised: number[] = [];
  if (todo.length === 0 || !deps.decodePicture) return { source, recognised };
  const done = new Map<string, SlideSourceV1>();
  const cache = new Map<string, string>();
  let finished = 0;
  deps.onProgress?.('recognise', 0, todo.length);
  for (const slide of todo) {
    deps.signal?.throwIfAborted();
    const pic = flattenedPictureOf(slide);
    const held = pic?.media ? media.get(pic.media) : undefined;
    const pixels = held ? await deps.decodePicture(held.bytes, held.mime).catch(() => null) : null;
    if (pic && pixels && pixels.width * pixels.height <= READ_EXTRACT_MAX_PICTURE_PIXELS) {
      const staged = new Map<string, { bytes: Uint8Array; mime: string }>();
      const stagedCache = new Map(cache);
      const sink: MediaSinkV1 = async (bytes, mime, hash) => {
        const ref = `${MEDIA_PREFIX}${hash}`;
        if (!media.has(ref)) staged.set(ref, { bytes, mime });
        return ref;
      };
      try {
        const out = await reconstructFlattenedSlide({
          slide, picture: pixels, sink, mediaCache: stagedCache, ocr: recogniser.read, ocrModel: recogniser.model,
          ...(deps.signal ? { signal: deps.signal } : {}),
        });
        if (!out.objects.some((object) => object.id === pic.id)) {
          done.set(slide.id, out);
          for (const [ref, one] of staged) media.set(ref, one);
          for (const [hash, ref] of stagedCache) cache.set(hash, ref);
          recognised.push(slide.index + 1);
        }
      } catch (err) {
        if (deps.signal?.aborted) throw err;
        // One page that will not rebuild stays a picture; the others still read.
      }
    }
    finished++;
    deps.onProgress?.('recognise', finished, todo.length);
  }
  if (done.size === 0) return { source, recognised };
  return { source: { ...source, slides: source.slides.map((slide) => done.get(slide.id) ?? slide) }, recognised };
}

/**
 * Read one file into a content inventory, on this device. Rejects with a
 * `ReadExtractSourceError` for a file it does not read or cannot open, and with the
 * signal's own reason when cancelled.
 */
export async function readExtractSource(file: { name: string; bytes: Uint8Array }, deps: ReadExtractSourceDepsV1): Promise<ReadExtractSourceResultV1> {
  const { bytes, name } = file;
  deps.signal?.throwIfAborted();
  if (bytes.length === 0) throw new ReadExtractSourceError('empty', 'The file is empty.');
  if (bytes.length > READ_EXTRACT_MAX_BYTES) throw new ReadExtractSourceError('too-large', 'The file is larger than this reader takes.');
  const kind = sniffExtractSource(bytes);
  if (!kind) throw new ReadExtractSourceError('unsupported', 'Read and extract takes a PowerPoint deck, a PDF or a Photoshop file.');

  const hex = await sha256Hex(bytes);
  const hash = `sha256:${hex}`;
  const media = new Map<string, { bytes: Uint8Array; mime: string }>();
  const sink: MediaSinkV1 = async (data, mime, contentHash) => {
    const ref = `${MEDIA_PREFIX}${contentHash}`;
    if (!media.has(ref)) media.set(ref, { bytes: data, mime });
    return ref;
  };
  const base = { hash, instanceId: newInstanceId(), name, bytes: bytes.length, sink, ...(deps.signal ? { signal: deps.signal } : {}) };
  const onSlide = (done: number, total: number): void => deps.onProgress?.('read', done, total);
  let active: ActiveContentV1 = {};
  let notesParas: Array<InventoryNotesParaInputV1[] | undefined> | undefined;
  let source: SourceDeckV1;
  try {
    if (kind === 'pptx') {
      const parts = await inflatePptx(bytes);
      active = ooxmlActiveContent(Object.keys(parts));
      source = await sourceDeckFromPptx(parts, deps.parseXml, { ...base, reader: { name: 'pptx-read', version: ENGINE_VERSION }, onSlide });
      notesParas = notesParasOf(parts, deps.parseXml);
    } else if (kind === 'pdf') {
      type Readers = Awaited<ReturnType<NonNullable<ReadExtractSourceDepsV1['pdfReaders']>>>;
      const readers: Readers = (await deps.pdfReaders?.().catch((): Readers => ({}))) ?? {};
      source = await sourceDeckFromPdf(bytes, {
        ...base, reader: { name: 'pdf-read', version: ENGINE_VERSION }, onSlide,
        ...(readers.codec ? { codec: readers.codec } : {}),
        ...(readers.decoders ? { decoders: readers.decoders } : {}),
      });
      active = await pdfActiveContent(bytes);
    } else {
      const decode = await deps.psdDecode?.();
      source = await sourceDeckFromPsd(bytes, {
        ...base, reader: { name: 'psd-read', version: ENGINE_VERSION }, onSlide, ...(decode ? { decode } : {}),
        inflate: (data: Uint8Array, maxOut: number) => unzlibSync(data, { out: new Uint8Array(maxOut) }),
      });
    }
  } catch (err) {
    if (deps.signal?.aborted || err instanceof ReadExtractSourceError) throw err;
    throw new ReadExtractSourceError('unreadable', `The file could not be read: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (source.slides.length === 0) throw new ReadExtractSourceError('unreadable', 'The file holds no page that could be read.');

  const scannedPages = scannedSlides(source).map((slide) => slide.index + 1);
  let recognised: number[] = [];
  if (deps.recogniser) ({ source, recognised } = await recognisePages(source, media, deps.recogniser, deps));

  const facts = new Map<string, InventoryMediaInputV1>();
  for (const [ref, item] of media) {
    const fromRef = ref.slice(MEDIA_PREFIX.length);
    facts.set(ref, { sha256: /^[0-9a-f]{64}$/.test(fromRef) ? fromRef : await sha256Hex(item.bytes), mime: item.mime, bytes: item.bytes.length });
  }
  const inventory = inventoryFromSource(source, censusDeck(source), {
    name,
    sha256: hex,
    bytes: bytes.length,
    media: facts,
    ...(notesParas ? { notesParas } : {}),
    ...(deps.recognizers ? { recognizers: deps.recognizers } : {}),
    warnings: activeContentWarnings(active),
  });
  return { inventory, kind, media, scanned: { pages: scannedPages, recognised } };
}

/** `host.ocr` as a recogniser for one read: each crop read with `model`, cancelled with `signal`. */
export function hostRecogniser(
  ocr: { run(frame: { width: number; height: number; data: Uint8ClampedArray }, opts: { model?: string; signal?: AbortSignal }): Promise<{ lines: OcrLine[] }> },
  model: string,
  signal?: AbortSignal,
): ExtractRecogniserV1 {
  return {
    model,
    read: async (frame) => {
      // `host.ocr.run` transfers the buffer it is given, so each crop goes in as its own copy.
      const data = new Uint8ClampedArray(frame.data);
      return (await ocr.run({ width: frame.width, height: frame.height, data }, { model, ...(signal ? { signal } : {}) })).lines;
    },
  };
}
