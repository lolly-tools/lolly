// SPDX-License-Identifier: MPL-2.0
/**
 * Stage 1 of the renovation journey in the web shell (plan 274 sections 2.1, 3.1 and
 * 3.5): a pptx or a PDF the person picked or dropped becomes a stored renovation
 * project with its source deck, read on the device.
 *
 * The file is told apart by its bytes, never its name: a zip package is read as a
 * pptx, and a file with the PDF signature in its first kilobyte as a PDF, through
 * `sourceDeckFromPdf` (`@lolly-tools/node-shell/rebrand/source-pdf`) with this
 * shell's own image codec and shading, pattern and soft-mask decoders, the ones the
 * PDF import uses (`rebrandPdfReaders` in `views/pdf-import.ts`, which the view
 * registers through `setRebrandPdfReaders` in `deps.ts`, so this module never imports
 * a view; without them the reader's pure codec reads the PDF).
 * Its pictures go through the same media sink as a pptx's. A page that is a scan is
 * marked flattened by the reader and stays one picture here; `rebuildSlidePictures`
 * below rebuilds such slides later, when the person asks for their text to be read.
 *
 * It runs on the main thread, not in the stage worker, because it needs the two things
 * a worker lacks: the XML parser (`DOMParser`) and the user asset store the pictures go
 * to. The order is the durable one:
 *
 *   1. Refuse early: over `REBRAND_MAX_SOURCE_BYTES` is `source.too-large`, an
 *      encrypted package (an OOXML file wrapped in a compound document) is
 *      `source.encrypted`, and so is an encrypted PDF (restrictions only included), a
 *      package that will not open is `source.unreadable`, a
 *      file named .pdf without the PDF signature is `source.unreadable`, and a legacy
 *      `.ppt` or some other file is `unsupported-file`. The bytes are hashed
 *      (`sha256:<hex>`, Web Crypto) and inflated with the capped fflate path
 *      `bridge/pptx.ts` uses before anything is stored, so a refusal stores nothing.
 *   2. Create the project, with the source bytes retained as a user asset.
 *   3. Parse with the window `DOMParser` and read with `sourceDeckFromPptx` (a PDF: read
 *      with `sourceDeckFromPdf`, page by page, which reports progress the same way). Its media
 *      sink stores each distinct picture once, through the picker's `storeUserUpload`
 *      with `batch: true`, so a picture already in the library is reused without a
 *      prompt. A picture the picker would stop to ask about (over 40 MB, or wider than
 *      twice its resize edge) is written verbatim instead, because that question is a
 *      modal and no modal opens over a running import. Progress arrives per slide; the
 *      signal is honoured between slides.
 *   4. Write the source deck as the project's part, restate the source facts the read
 *      settled (page count, title), and checkpoint `ingest`.
 *
 * A newer version of a deck (`input.lineageId`) joins the lineage of the one before it:
 * the project and the source deck carry that lineage instead of their own hash, so the
 * versions of one deck can be listed together and the plan's carry-forward knows which
 * deck the decisions came from. The bytes are still hashed and pinned as they are.
 *
 * A failure or a cancel after step 2 removes the project again, and releases the
 * pictures this read stored fresh, so a half-read deck leaves nothing behind. A picture
 * the library already held is never released: it was the person's before the import.
 * Nor is one the store kept, one another read in this tab is using, or one another
 * stored project's deck names: two reads of the same deck share its pictures.
 *
 * The source bytes themselves are written verbatim as a `data` asset by the store
 * `deps.ts` hands out, not through `storeUserUpload`; `writeSourceBytes` there says why.
 *
 * SLIDE PICTURES (plan 274 section 6). `rebuildSlidePictures` takes a read deck and
 * rebuilds each slide that is still one picture of a whole slide with
 * `reconstructFlattenedSlide` (`@lolly-tools/node-shell/rebrand/flattened`), reading
 * the text of its regions with `host.ocr` one crop at a time. Two slides are in hand at
 * once (`REBUILD_IN_FLIGHT`), so one slide's regions and crops are worked on this
 * thread while the other's text is read in the recogniser's worker. The picture is
 * decoded on the main thread (the browser's own decoder), once however many slides
 * repeat it, its size read from its header first so one over
 * `SLIDE_PICTURE_MAX_PIXELS` is never decoded. The crops go through the same
 * picture store as the read. A slide that cannot be decoded, is not one picture, or is
 * left uncut by the rebuild stays as it was, and the crops made for it are released. A
 * cancel or a failure releases every crop this call stored fresh, under the same rules
 * as a failed read.
 *
 * OUTLINED LABELS (plan 275 section 9.3). A chart drawn as an SVG with its text
 * outlined holds its labels as glyph paths. When this shell has `host.ocr` and the
 * text model is already on the device, the read hands `sourceDeckFromPptx` a label
 * reader over it (one line at a time, never a download), so those labels arrive as
 * text; otherwise they stay drawn and the result counts them (`vectorLabels`), so the
 * view can offer the model in place. `readVectorLabelsIn` reads a stored deck's
 * outlined labels once the model is there.
 *
 * Every piece the browser owns arrives through `IngestDepsV1` and `RebuildDepsV1`, so
 * both paths run under node against the committed fixtures with an in-memory store.
 */
import type { HostV1, OcrLine } from '@lolly-tools/core/host-v1';
import type { DesignSystemSnapshotV1, RenovationProjectV1, SlideSourceV1, SourceDeckV1, SourceKindV1 } from '@lolly-tools/core';
import { loadPdfDocument, type PdfImageCodec, type PdfResourceDecoders } from '@lolly-tools/node-shell/pdf-read';
import { inflatePptx, looksLikePptxFile } from '@lolly-tools/node-shell/pptx';
import { flattenedPictureOf, reconstructFlattenedSlide, type FlattenedOcrV1 } from '@lolly-tools/node-shell/rebrand/flattened';
import { sourceDeckFromPdf } from '@lolly-tools/node-shell/rebrand/source-pdf';
import {
  newInstanceId,
  readDeckVectorLabels,
  sourceDeckFromPptx,
  type MediaSinkV1,
  type VectorLabelSummaryV1,
} from '@lolly-tools/node-shell/rebrand/source-pptx';
import type { VectorLabelReaderV1 } from '../../../../../engine/src/vector-text.ts';
import { resolveRebrandDesignSystem } from '../../../../../engine/src/rebrand-design-system.ts';
import { sha256Hex } from '../../../../../engine/src/bytes.ts';
import { ENGINE_VERSION } from '../../../../../engine/src/version.ts';
import { t } from '../../i18n.ts';
import type { RebrandIngestInputV1, RebrandIngestResultV1 } from './controller-api.ts';
import {
  REBRAND_SOURCE_HINT,
  isPickerHost,
  mintUploadId,
  provenanceFor,
  rebrandPictureUpload,
  rebrandStoreFor,
  uploadSlug,
  userAssetStoreOf,
  type RebrandStoreHost,
} from './user-assets.ts';
import { OCR_DEFAULT_MODEL } from '../ocr-models.ts';
import { resolveActiveDesignSystem } from './design-system.ts';
import { ProjectQuotaError, type WebRenovationProjectStore } from './project-store.ts';
import { REBRAND_MAX_SOURCE_BYTES } from './readiness.ts';
import { StageCancelledError } from './stage-core.ts';

// ─── errors ──────────────────────────────────────────────────────────────────

/** The refusals and failures this stage names. The view shows copy by `code`. */
export type RebrandIngestErrorCodeV1 =
  | 'source.too-large'
  | 'source.encrypted'
  | 'source.unreadable'
  | 'unsupported-file'
  | 'storage.quota';

/** A named ingest failure. `message` is plain English for a log, never shown as it stands. */
export class RebrandIngestError extends Error {
  readonly code: RebrandIngestErrorCodeV1;
  constructor(code: RebrandIngestErrorCodeV1, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'RebrandIngestError';
    this.code = code;
  }
}

/**
 * A cancel during the read. It is a `StageCancelledError`, so `isStageCancelled` reads
 * it the way it reads a cancelled worker stage, and it carries `code: 'cancelled'` for a
 * caller that reads codes.
 */
export class IngestCancelledError extends StageCancelledError {
  readonly code = 'cancelled' as const;
  constructor() {
    super('The deck was not read: the read was cancelled.', { acknowledged: true });
  }
}

// ─── the host pieces ─────────────────────────────────────────────────────────

/**
 * Whether an id the picker returned was minted by this store call rather than reused from
 * the library. The picker mints `user/upload/<ms>-<name>`, so an id carrying this file's
 * name and a time at or after the read began is one this read wrote.
 */
export function isFreshUpload(id: string, name: string, startedAt: number): boolean {
  const match = /^user\/upload\/(\d+)-(.+)$/.exec(id);
  if (!match) return false;
  return Number(match[1]) >= startedAt && match[2] === uploadSlug(name);
}

/** The import provenance a stored user-asset record carries, read without trusting its shape. */
function importOf(record: unknown): { hint?: unknown; at?: unknown } {
  if (typeof record !== 'object' || record === null || !('meta' in record)) return {};
  const { meta } = record;
  if (typeof meta !== 'object' || meta === null || !('provenance' in meta)) return {};
  const { provenance } = meta;
  if (typeof provenance !== 'object' || provenance === null) return {};
  return {
    hint: 'sourceHint' in provenance ? provenance.sourceHint : undefined,
    at: 'importedAt' in provenance ? provenance.importedAt : undefined,
  };
}

/**
 * Whether the record the picker stored names this journey and a time from this read.
 * The picker renames a picture it converts (a BMP comes back as a PNG), so the id alone
 * cannot say; the record's provenance can.
 */
export function isFreshRecord(record: unknown, startedAt: number): boolean {
  const { hint, at } = importOf(record);
  if (hint !== REBRAND_SOURCE_HINT || typeof at !== 'string') return false;
  const when = Date.parse(at);
  return Number.isFinite(when) && when >= startedAt;
}

// ─── pictures the picker would stop to ask about ─────────────────────────────

/** The picker's "Very large image" limits: 40 MB, or a long edge past twice its 3840 px resize edge. */
const PICKER_ASKS_BYTES = 40 * 1024 * 1024;
const PICKER_ASKS_EDGE = 3840 * 2;
/** Enough of the file to reach a JPEG frame header past its metadata segments. */
const HEADER_BYTES = 1024 * 1024;

/** A PNG or JPEG's stored size, from its header. Null for another format or a header it cannot read. */
export function headerDimensions(b: Uint8Array): { width: number; height: number } | null {
  if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = b[i + 1] ?? 0;
    // A start-of-frame marker; C4, C8 and CC share the range and are not frames.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { width: ((b[i + 7] ?? 0) << 8) | (b[i + 8] ?? 0), height: ((b[i + 5] ?? 0) << 8) | (b[i + 6] ?? 0) };
    }
    const length = ((b[i + 2] ?? 0) << 8) | (b[i + 3] ?? 0);
    if (length < 2) return null;
    i += 2 + length;
  }
  return null;
}

/** Whether the picker's raster path would open its "Very large image" dialog for this file. */
async function pickerWouldAsk(file: File): Promise<boolean> {
  if (file.size > PICKER_ASKS_BYTES) return true;
  const head = new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer());
  const size = headerDimensions(head);
  return size !== null && Math.max(size.width, size.height) > PICKER_ASKS_EDGE;
}

function isQuotaRefusal(err: unknown): boolean {
  if (err instanceof ProjectQuotaError) return true;
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: unknown; code?: unknown; message?: unknown };
  if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') return true;
  if (e.code === 22 || e.code === 1014) return true;
  return typeof e.message === 'string' && /quota/i.test(e.message);
}

// ─── the injected pieces ─────────────────────────────────────────────────────

/** One stored picture: its ref, and whether this call wrote it rather than reusing it. */
export interface StoredPictureV1 {
  id: string;
  fresh: boolean;
}

/** The PDF reader's pixel work and resource decoders, from the shell that has them. */
export interface PdfReadersV1 {
  codec?: PdfImageCodec;
  decoders?: PdfResourceDecoders;
}

export interface IngestDepsV1 {
  store: WebRenovationProjectStore;
  /**
   * The image codec and decoders a PDF is read with. `deps.ts` passes the ones the view
   * registered (the PDF import's own); the default is empty, which reads with the
   * reader's pure codec and decodes no JPEG.
   */
  pdfReaders(): Promise<PdfReadersV1>;
  /** Store one distinct picture. The default is the picker's `storeUserUpload` with `batch: true`. */
  storePicture(file: File, startedAt: number): Promise<StoredPictureV1>;
  /** Release a picture this read stored fresh, on a failure or a cancel. */
  deleteAsset?(ref: string): Promise<void>;
  /** The design-system snapshot the new project records. */
  snapshot(): Promise<DesignSystemSnapshotV1>;
  parseXml(xml: string): Document;
  /** Milliseconds, for telling a fresh upload from a reused one. */
  now(): number;
  newProjectId(): string;
  newInstanceId(): string;
  /**
   * The reader for a chart's outlined labels, or null to leave them drawn. The default
   * reads with `host.ocr` when the text model is already on the device, and downloads
   * nothing.
   */
  labelReader(signal: AbortSignal): Promise<VectorLabelReaderV1 | null>;
}

/** The snapshot a project records when no design system can be read. */
const NO_DESIGN_SYSTEM: DesignSystemSnapshotV1 = {
  id: 'none',
  tokenHash: `sha256:${'0'.repeat(64)}`,
  fontHashes: {},
  assetHashes: {},
};

const MIME_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/tiff': 'tif',
  'image/svg+xml': 'svg',
  'image/x-emf': 'emf',
  'image/x-wmf': 'wmf',
};

function defaultParseXml(xml: string): Document {
  if (typeof DOMParser === 'undefined') throw new Error('This shell has no XML parser.');
  return new DOMParser().parseFromString(xml, 'application/xml');
}

/**
 * The picker's store, with a verbatim write for a picture the picker cannot take or
 * would stop to ask about. Exported for its tests; ingest uses it unless a caller
 * passes its own `storePicture`.
 */
export function rebrandPictureStore(host: RebrandStoreHost): IngestDepsV1['storePicture'] {
  const assets = userAssetStoreOf(host);
  return async (file, startedAt) => {
    const upload = rebrandPictureUpload();
    if (upload && isPickerHost(host) && !(assets && await pickerWouldAsk(file))) {
      try {
        const ref = await upload(host, file, { batch: true, sourceHint: REBRAND_SOURCE_HINT });
        if (isFreshUpload(ref.id, file.name, startedAt)) return { id: ref.id, fresh: true };
        const record = await assets?._getUserRecord?.(ref.id).catch(() => null);
        return { id: ref.id, fresh: isFreshRecord(record, startedAt) };
      } catch (err) {
        // A full device is the deck's failure, not one picture's. Anything else (a
        // format the picker cannot decode, a re-encode the privacy preference asks
        // for and this format cannot take) keeps the bytes as they arrived below.
        if (isQuotaRefusal(err) || !assets) throw err;
      }
    }
    if (!assets) throw new Error('This shell has no user asset store for the pictures.');
    const id = mintUploadId(file.name, Date.now());
    const format = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase() ?? 'bin';
    await assets._uploadUserAsset({
      id,
      type: format === 'svg' ? 'vector' : 'raster',
      format,
      blob: file,
      version: '1.0.0',
      meta: { name: file.name, provenance: provenanceFor(file.name) },
    });
    return { id, fresh: true };
  };
}

/** The snapshot of the active design system, resolved the way the stages resolve it. */
function defaultSnapshot(host: RebrandStoreHost): IngestDepsV1['snapshot'] {
  return async () => {
    const active = await resolveActiveDesignSystem(host).catch(() => null);
    if (!active) return { ...NO_DESIGN_SYSTEM };
    return (await resolveRebrandDesignSystem(active.input)).snapshot;
  };
}

/** No shell decoders: the PDF reader's pure codec and its own shading and pattern readers. */
async function defaultPdfReaders(): Promise<PdfReadersV1> {
  return {};
}

/**
 * `host.ocr` as a label reader, one line to a picture, or null when this shell has no
 * recogniser or its default model is not on the device yet. Never starts a download:
 * asking for the model is the view's in-place offer.
 */
export async function hostLabelReader(host: RebuildHostV1, signal: AbortSignal): Promise<VectorLabelReaderV1 | null> {
  const ocr = host.ocr;
  if (!ocr?.isAvailable()) return null;
  if (!(await ocr.cached(OCR_DEFAULT_MODEL).catch(() => false))) return null;
  return async (frame) => {
    const result = await ocr.run(frame, { model: OCR_DEFAULT_MODEL, singleLine: true, signal });
    const line = result.lines.find((one) => one.text.trim());
    return line ? { text: line.text, confidence: line.confidence } : null;
  };
}

function defaultDeps(host: RebuildHostV1): IngestDepsV1 {
  const assets = userAssetStoreOf(host);
  return {
    store: rebrandStoreFor(host),
    pdfReaders: defaultPdfReaders,
    storePicture: rebrandPictureStore(host),
    ...(assets ? { deleteAsset: async (ref: string) => { await assets._deleteUserAsset(ref); } } : {}),
    snapshot: defaultSnapshot(host),
    parseXml: defaultParseXml,
    now: () => Date.now(),
    newProjectId: () => `rebrand-${globalThis.crypto.randomUUID()}`,
    newInstanceId,
    labelReader: (signal) => hostLabelReader(host, signal),
  };
}

// ─── reading the file ────────────────────────────────────────────────────────

/** The first eight bytes of an OLE compound document, the wrapper an encrypted OOXML file uses. */
const CFB_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

function startsWith(bytes: Uint8Array, magic: readonly number[]): boolean {
  return magic.every((byte, i) => bytes[i] === byte);
}

/** `%PDF-`, which the format allows a little leading junk before. */
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d];
/** How far into the file the PDF signature is looked for. */
const PDF_MAGIC_WINDOW = 1024;

/** True when the PDF signature starts within the first kilobyte. */
export function hasPdfSignature(bytes: Uint8Array): boolean {
  const end = Math.min(bytes.length, PDF_MAGIC_WINDOW) - PDF_MAGIC.length;
  for (let at = 0; at <= end; at += 1) {
    if (PDF_MAGIC.every((byte, i) => bytes[at + i] === byte)) return true;
  }
  return false;
}

/** `/Encrypt`, the trailer entry an encrypted PDF names its security handler by. */
const PDF_ENCRYPT = [0x2f, 0x45, 0x6e, 0x63, 0x72, 0x79, 0x70, 0x74];

/** True when `needle` occurs anywhere in `bytes`. */
function holdsBytes(bytes: Uint8Array, needle: readonly number[]): boolean {
  const [first] = needle;
  if (first === undefined) return true;
  const last = bytes.length - needle.length;
  for (let at = bytes.indexOf(first); at >= 0 && at <= last; at = bytes.indexOf(first, at + 1)) {
    if (needle.every((byte, k) => bytes[at + k] === byte)) return true;
  }
  return false;
}

/**
 * True when a PDF is encrypted, as the node pipeline's `sourceKindOf` refuses it: the
 * reader loads such a file without decrypting it, so its streams would read as noise.
 * A file with no `/Encrypt` anywhere is not, which settles most decks with one scan of
 * the bytes; otherwise the document's own trailer answers, so the word inside a page's
 * text or a stream does not count. A file the reader cannot load at all is left to the
 * reader, which says so with its own message.
 */
async function pdfEncrypted(bytes: Uint8Array): Promise<boolean> {
  if (!holdsBytes(bytes, PDF_ENCRYPT)) return false;
  try {
    return (await loadPdfDocument(bytes)).isEncrypted;
  } catch {
    return false;
  }
}

/** A file named or typed as a PDF. */
function namedPdf(file: File): boolean {
  return /\.pdf$/i.test(file.name || '') || file.type === 'application/pdf';
}

/** The file name without its extension, which names the project. */
function projectNameOf(file: File): string {
  const base = (file.name || '').replace(/\.[^./\\]+$/, '').trim();
  return base || t('Untitled deck');
}

async function sha256Of(bytes: Uint8Array): Promise<string> {
  return `sha256:${await sha256Hex(bytes)}`;
}

/** Refuse what this stage cannot read, before anything is stored. Returns the bytes and what they are. */
async function admit(file: File): Promise<{ bytes: Uint8Array; kind: Extract<SourceKindV1, 'pptx' | 'pdf'> }> {
  if (file.size > REBRAND_MAX_SOURCE_BYTES) {
    throw new RebrandIngestError('source.too-large', `The deck is ${file.size} bytes; the limit is ${REBRAND_MAX_SOURCE_BYTES}.`);
  }
  const named = looksLikePptxFile(file);
  const bytes = new Uint8Array(await file.arrayBuffer());
  // A zip package first, as the node pipeline sniffs it, so a package holding the PDF
  // signature near its start is a pptx on every shell.
  const zipped = bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (!zipped && hasPdfSignature(bytes)) {
    if (await pdfEncrypted(bytes)) {
      throw new RebrandIngestError(
        'source.encrypted',
        'The PDF is encrypted, and this reader cannot decrypt it. Some encrypted PDFs open without a password and only stop printing or copying.',
      );
    }
    return { bytes, kind: 'pdf' };
  }
  if (!zipped && namedPdf(file)) throw new RebrandIngestError('source.unreadable', 'The file is named as a PDF and does not start like one.');
  if (startsWith(bytes, CFB_MAGIC)) {
    // A pptx wrapped in a compound document is a password-protected package; a
    // compound document under another name is a legacy .ppt, which this reader
    // does not open.
    if (named) throw new RebrandIngestError('source.encrypted', 'The deck is protected by a password.');
    throw new RebrandIngestError('unsupported-file', 'This file is not a pptx deck.');
  }
  if (!zipped) {
    if (named) throw new RebrandIngestError('source.unreadable', 'The deck is not a zip package, so it cannot be read.');
    throw new RebrandIngestError('unsupported-file', 'This file is not a pptx deck or a PDF.');
  }
  return { bytes, kind: 'pptx' };
}

async function inflate(bytes: Uint8Array, named: boolean): Promise<Record<string, Uint8Array>> {
  let parts: Record<string, Uint8Array>;
  try {
    parts = await inflatePptx(bytes);
  } catch (err) {
    throw new RebrandIngestError('source.unreadable', 'The deck package could not be opened.', { cause: err });
  }
  const hasPresentation = Object.keys(parts).some((name) => name.toLowerCase() === 'ppt/presentation.xml');
  if (!hasPresentation) {
    if (named) throw new RebrandIngestError('source.unreadable', 'The package holds no presentation part.');
    throw new RebrandIngestError('unsupported-file', 'This zip is not a pptx deck.');
  }
  return parts;
}

/** A write the store refused, as a named failure. */
function writeFailure(result: { refusal?: string; message?: string }): Error {
  if (result.refusal === 'quota') return new RebrandIngestError('storage.quota', result.message ?? 'Storage refused the write.');
  return new Error(result.message ?? 'The deck could not be saved on this device.');
}

/** The reader identity a PDF read records, beside `pptx-read` for a pptx. */
export const PDF_READER_NAME = 'pdf-read';

/**
 * What a read gives back: the project and its deck, and the outlined labels of its
 * drawings, how many became text and how many stayed drawn. A PDF, or a deck with no
 * drawing, counts none.
 */
export interface IngestDeckResultV1 extends RebrandIngestResultV1 {
  vectorLabels: VectorLabelSummaryV1;
}

/**
 * Read a pptx or a PDF into a new renovation project. Resolves the project at its latest
 * revision and the source deck; rejects with a `RebrandIngestError` carrying `code`, or
 * an `IngestCancelledError` when the signal aborted.
 */
export async function ingestDeck(
  host: RebuildHostV1,
  input: RebrandIngestInputV1,
  overrides: Partial<IngestDepsV1> = {},
): Promise<IngestDeckResultV1> {
  const deps: IngestDepsV1 = { ...defaultDeps(host), ...overrides };
  const { file, signal } = input;
  const lineage = typeof input.lineageId === 'string' && input.lineageId ? input.lineageId : undefined;
  const cancelled = (): boolean => signal.aborted;
  const stopIfCancelled = (): void => {
    if (cancelled()) throw new IngestCancelledError();
  };

  stopIfCancelled();
  const named = looksLikePptxFile(file);
  const { bytes, kind } = await admit(file);
  stopIfCancelled();
  const hash = await sha256Of(bytes);
  stopIfCancelled();
  // Inflated before the project exists, so a zip that is not a deck is refused with
  // nothing stored. A PDF's own readers load here too, before anything is stored.
  const parts = kind === 'pptx' ? await inflate(bytes, named) : null;
  const readers: PdfReadersV1 = kind === 'pdf' ? await deps.pdfReaders().catch((): PdfReadersV1 => ({})) : {};
  stopIfCancelled();
  const designSystem = await deps.snapshot().catch(() => ({ ...NO_DESIGN_SYSTEM }));
  stopIfCancelled();

  const startedAt = deps.now();
  const instanceId = deps.newInstanceId();
  let project: RenovationProjectV1;
  try {
    project = await deps.store.create(
      {
        id: deps.newProjectId(),
        name: projectNameOf(file),
        source: {
          kind,
          hash,
          lineageId: lineage ?? hash,
          instanceId,
          ...(file.name ? { name: file.name } : {}),
          bytes: file.size,
          pageCount: 0,
        },
        designSystem,
      },
      { bytes: file },
    );
  } catch (err) {
    if (isQuotaRefusal(err)) throw new RebrandIngestError('storage.quota', 'Storage refused the deck.', { cause: err });
    throw err;
  }

  const fresh: string[] = [];
  /** Every ref the sink handed back, held in `readsInFlight` until this read ends. */
  const handed: string[] = [];
  const base = projectNameOf(file);
  let pictures = 0;

  try {
    stopIfCancelled();

    const sink: MediaSinkV1 = async (media, mime) => {
      stopIfCancelled();
      pictures += 1;
      const ext = MIME_EXTENSIONS[mime] ?? 'bin';
      const picture = new File([media as BlobPart], `${base} ${pictures}.${ext}`, { type: mime });
      const stored = await deps.storePicture(picture, startedAt);
      holdRef(stored.id);
      handed.push(stored.id);
      if (stored.fresh) fresh.push(stored.id);
      return stored.id;
    };
    const onSlide = (done: number, total: number): void => {
      input.onProgress(done, total);
    };
    const labelReader = parts ? await deps.labelReader(signal).catch(() => null) : null;
    stopIfCancelled();
    let vectorLabels: VectorLabelSummaryV1 = { runs: 0, text: 0, drawn: 0, read: labelReader !== null };
    let deck: SourceDeckV1;
    try {
      deck = parts
        ? await sourceDeckFromPptx(parts, deps.parseXml, {
          hash,
          instanceId,
          ...(file.name ? { name: file.name } : {}),
          bytes: file.size,
          reader: { name: 'pptx-read', version: ENGINE_VERSION },
          signal,
          onSlide,
          sink,
          ...(labelReader ? { labelReader } : {}),
          onVectorLabels: (summary) => {
            vectorLabels = summary;
          },
        })
        : await sourceDeckFromPdf(bytes, {
          hash,
          instanceId,
          ...(file.name ? { name: file.name } : {}),
          bytes: file.size,
          reader: { name: PDF_READER_NAME, version: ENGINE_VERSION },
          signal,
          onSlide,
          sink,
          ...(readers.codec ? { codec: readers.codec } : {}),
          ...(readers.decoders ? { decoders: readers.decoders } : {}),
        });
    } catch (err) {
      if (cancelled()) throw new IngestCancelledError();
      if (err instanceof RebrandIngestError || isQuotaRefusal(err)) throw err;
      throw new RebrandIngestError('source.unreadable', 'The deck could not be read.', { cause: err });
    }
    stopIfCancelled();
    // A damaged PDF can parse with no page tree at all; there is nothing to renovate.
    if (deck.slides.length === 0) throw new RebrandIngestError('source.unreadable', 'The file holds no page that could be read.');
    // The reader names the lineage after the bytes; a newer version takes the one it joins.
    if (lineage) deck = { ...deck, source: { ...deck.source, lineageId: lineage } };

    const put = await deps.store.putPart(project.id, project.revision, 'sourceDeck', deck);
    if (!put.ok) throw writeFailure(put);
    const facts = await deps.store.update(project.id, put.revision, {
      source: { ...deck.source, ...(project.source.bytesAssetRef ? { bytesAssetRef: project.source.bytesAssetRef } : {}) },
    });
    if (!facts.ok) throw writeFailure(facts);
    const marked = await deps.store.checkpoint(project.id, facts.revision, 'ingest');
    if (!marked.ok) throw writeFailure(marked);

    const latest = await deps.store.get(project.id);
    if (!latest) throw new Error('The project was saved and could not be read back.');
    return { project: latest, source: deck, vectorLabels };
  } catch (err) {
    releaseRefs(handed);
    await discard(deps, project.id, fresh);
    if (isQuotaRefusal(err) && !(err instanceof RebrandIngestError)) {
      throw new RebrandIngestError('storage.quota', 'Storage refused the deck.', { cause: err });
    }
    throw err;
  } finally {
    releaseRefs(handed);
  }
}

/** The name this stage went by when it read pptx files only. It reads PDFs as well now. */
export const ingestPptx = ingestDeck;

// ─── slide pictures ──────────────────────────────────────────────────────────

/**
 * A slide picture with more pixels than this is not decoded for a rebuild: the same
 * limit the PDF reader and the node pipeline keep (`FLATTENED_MAX_PIXELS` there, which
 * lives in a module this shell does not load).
 */
export const SLIDE_PICTURE_MAX_PIXELS = 40_000_000;

/** A decoded picture: RGBA interleaved, the shape the rebuild reads. */
export interface SlidePicturePixelsV1 {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

/**
 * The slides of a deck that are still one picture of a whole slide: marked flattened
 * by the reader, not rebuilt yet (no recovery picture), and holding one stored picture,
 * which is what a rebuild needs. `slidePictureIdsOf` in `controller.ts` states the same
 * rule without loading the rebuild, for the view and the controller.
 */
export function slidePictureIds(source: SourceDeckV1): string[] {
  return source.slides
    .filter((slide) => slide.origin.flattened === true && !slide.recovery && Boolean(flattenedPictureOf(slide)?.media))
    .map((slide) => slide.id);
}

export interface RebuildPicturesInputV1 {
  source: SourceDeckV1;
  /** The slides to rebuild. Every slide still a picture when absent. */
  slideIds?: string[];
  signal: AbortSignal;
  /** Slides handled so far, of the slides asked for. */
  onProgress: (done: number, total: number) => void;
}

export interface RebuildPicturesResultV1 {
  /**
   * The deck with the rebuilt slides in place; the same object when none was rebuilt.
   * A rebuilt deck's reader version carries how its pictures were read
   * (`+rebuild`, `+rebuild/ocr` or `+rebuild/ocr:<model>`), so a plan records it.
   */
  source: SourceDeckV1;
  /** Slides rebuilt from their regions. */
  rebuilt: number;
  /** Slides asked for that stayed one picture. */
  kept: number;
}

export interface RebuildDepsV1 {
  /** Store one distinct crop, as `IngestDepsV1.storePicture` does. */
  storePicture: IngestDepsV1['storePicture'];
  /** Release a crop this call stored fresh. */
  deleteAsset?(ref: string): Promise<void>;
  /** The stored bytes of a picture, or null when the store has none. */
  pictureBytes(ref: string): Promise<Blob | null>;
  /** A picture decoded to RGBA, or null when this shell cannot decode it. */
  decodePicture(blob: Blob): Promise<SlidePicturePixelsV1 | null>;
  /** Text recognition for one region crop. Null reads no text. */
  ocr: FlattenedOcrV1 | null;
  /** The OCR model id, recorded in the evidence. */
  ocrModel?: string;
  now(): number;
}

/** A recogniser that runs one reading at a time, in the order they were asked for. */
function oneAtATime(ocr: FlattenedOcrV1): FlattenedOcrV1 {
  let last: Promise<unknown> = Promise.resolve();
  return (frame, region) => {
    const run = last.then(() => ocr(frame, region), () => ocr(frame, region));
    last = run.catch(() => undefined);
    return run;
  };
}

/** Slides rebuilt at once: one on this thread while another's text is read in the recogniser's worker. */
export const REBUILD_IN_FLIGHT = 2;

/** Decoded slide pictures shared by the slides that use them, each decoded once. */
interface PicturePoolV1 {
  /** The picture decoded to RGBA, or null when it cannot be (no bytes, too many pixels, a format this shell cannot decode). */
  pixels(ref: string): Promise<SlidePicturePixelsV1 | null>;
  /** A slide is done with its picture: once every slide using it is, the pixels go. */
  release(slide: SlideSourceV1): void;
  clear(): void;
}

/**
 * The pictures of the slides to rebuild, decoded on first use and kept only
 * while a slide still to come uses the same picture (a deck repeating one slide
 * picture decodes it once), so at most `REBUILD_IN_FLIGHT` decoded pictures are
 * held, plus those a later slide shares. Each picture's size is read from its
 * header first, so one over `SLIDE_PICTURE_MAX_PIXELS` is never decoded.
 */
function picturePool(slides: SlideSourceV1[], deps: RebuildDepsV1): PicturePoolV1 {
  const users = new Map<string, number>();
  for (const slide of slides) {
    const ref = flattenedPictureOf(slide)?.media;
    if (ref) users.set(ref, (users.get(ref) ?? 0) + 1);
  }
  const decoded = new Map<string, Promise<SlidePicturePixelsV1 | null>>();
  const decode = async (ref: string): Promise<SlidePicturePixelsV1 | null> => {
    const blob = await deps.pictureBytes(ref);
    if (!blob) return null;
    const size = headerDimensions(new Uint8Array(await blob.slice(0, HEADER_BYTES).arrayBuffer()));
    if (size && size.width * size.height > SLIDE_PICTURE_MAX_PIXELS) return null;
    const picture = await deps.decodePicture(blob).catch(() => null);
    return picture && picture.width * picture.height <= SLIDE_PICTURE_MAX_PIXELS ? picture : null;
  };
  return {
    pixels(ref) {
      let held = decoded.get(ref);
      if (!held) {
        held = decode(ref);
        decoded.set(ref, held);
      }
      return held;
    },
    release(slide) {
      const ref = flattenedPictureOf(slide)?.media;
      if (!ref) return;
      const left = (users.get(ref) ?? 1) - 1;
      users.set(ref, left);
      if (left <= 0) decoded.delete(ref);
    },
    clear() {
      decoded.clear();
    },
  };
}

/** The browser's own decoder, through a canvas. Null where there is none, or on a failure. */
async function decodeWithCanvas(blob: Blob): Promise<SlidePicturePixelsV1 | null> {
  if (typeof createImageBitmap !== 'function') return null;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return null;
  }
  try {
    const { width, height } = bitmap;
    if (width * height > SLIDE_PICTURE_MAX_PIXELS) return null;
    if (typeof OffscreenCanvas === 'function') {
      const context = new OffscreenCanvas(width, height).getContext('2d');
      if (!context) return null;
      context.drawImage(bitmap, 0, 0);
      return context.getImageData(0, 0, width, height);
    }
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(bitmap, 0, 0);
    return context.getImageData(0, 0, width, height);
  } catch {
    return null;
  } finally {
    bitmap.close();
  }
}

/** The host a rebuild reads from: the stores, and `host.ocr` when this shell has it. */
export type RebuildHostV1 = RebrandStoreHost & Partial<Pick<HostV1, 'ocr'>>;

/** `host.ocr` as the rebuild's recogniser, or null when this shell has none. */
function hostOcr(host: RebuildHostV1, signal: AbortSignal): FlattenedOcrV1 | null {
  const ocr = host.ocr;
  if (!ocr) return null;
  return async (frame): Promise<OcrLine[]> => (await ocr.run(frame, { model: OCR_DEFAULT_MODEL, signal })).lines;
}

function defaultRebuildDeps(host: RebuildHostV1, signal: AbortSignal): RebuildDepsV1 {
  const assets = userAssetStoreOf(host);
  const ocr = hostOcr(host, signal);
  return {
    storePicture: rebrandPictureStore(host),
    ...(assets ? { deleteAsset: async (ref: string) => { await assets._deleteUserAsset(ref); } } : {}),
    pictureBytes: async (ref) => (await assets?._getBlob?.(ref).catch(() => null)) ?? null,
    decodePicture: decodeWithCanvas,
    ocr,
    ...(ocr ? { ocrModel: OCR_DEFAULT_MODEL } : {}),
    now: () => Date.now(),
  };
}

/** The schema's limit on a reader version. */
const READER_VERSION_MAX = 64;
/** How an earlier rebuild marked the reader version: with text recognition, and its model. */
const REBUILD_MARK = /\+rebuild(\/ocr(?::(.+))?)?$/;

/**
 * The reader of a deck whose slide pictures were rebuilt: its version marked the way
 * the node pipeline marks a plan (`pipelineAlgorithms` there), `+rebuild/ocr:<model>`
 * when text recognition ran, whatever it found, and `+rebuild` when it did not. A mark
 * an earlier rebuild left is replaced, and text recognition it recorded still counts.
 */
function rebuiltReader(reader: SourceDeckV1['reader'], ocr: boolean, model: string | undefined): SourceDeckV1['reader'] {
  const earlier = REBUILD_MARK.exec(reader.version);
  const version = earlier ? reader.version.slice(0, earlier.index) : reader.version;
  const read = ocr || Boolean(earlier?.[1]);
  const named = model ?? earlier?.[2];
  const mark = !read ? '+rebuild' : named ? `+rebuild/ocr:${named}` : '+rebuild/ocr';
  const stamped = `${version}${mark}`;
  return { ...reader, version: stamped.length <= READER_VERSION_MAX ? stamped : `${version}${read ? '+rebuild/ocr' : '+rebuild'}` };
}

/**
 * Rebuild the slides of a read deck that are still one picture of a whole slide, at
 * most `REBUILD_IN_FLIGHT` at once, reading their text with `host.ocr` (see the module
 * header). Progress counts the slides finished. Resolves
 * the deck with the rebuilt slides in place; rejects with an `IngestCancelledError`
 * when the signal aborted, after releasing the crops it stored.
 *
 * The signal also answers whether the caller kept the result: one that aborts after
 * this resolved means the rebuilt deck was not adopted (a cancel or a failure in the
 * stages after it), and the crops this call stored fresh are released then, so they do
 * not stay in the person's library with nothing naming them.
 */
export async function rebuildSlidePictures(
  host: RebuildHostV1,
  input: RebuildPicturesInputV1,
  overrides: Partial<RebuildDepsV1> = {},
): Promise<RebuildPicturesResultV1> {
  const given: RebuildDepsV1 = { ...defaultRebuildDeps(host, input.signal), ...overrides };
  // The recogniser reads one crop at a time, whichever slide asks: its sessions
  // are not made to run two readings at once.
  const deps: RebuildDepsV1 = given.ocr ? { ...given, ocr: oneAtATime(given.ocr) } : given;
  const { source, signal } = input;
  const stopIfCancelled = (): void => {
    if (signal.aborted) throw new IngestCancelledError();
  };
  const asked = input.slideIds ? new Set(input.slideIds) : null;
  const wanted = new Set(slidePictureIds(source).filter((id) => !asked || asked.has(id)));
  const total = wanted.size;
  input.onProgress(0, total);
  if (total === 0) return { source, rebuilt: 0, kept: 0 };

  const startedAt = deps.now();
  const base = (source.source.name ?? '').replace(/\.[^./\\]+$/, '').trim() || t('Untitled deck');
  /** Every crop ref this call holds, and the ones it stored fresh, released on the way out. */
  const handed: string[] = [];
  const fresh: string[] = [];
  /** Fresh crops of slides that stayed one picture, released once the rebuild is done. */
  const orphans: string[] = [];
  const mediaCache = new Map<string, string>();
  const order = source.slides.filter((slide) => wanted.has(slide.id));
  const pictures = picturePool(order, deps);
  const done = new Map<string, SlideSourceV1 | null>();
  let finished = 0;
  let rebuilt = 0;

  /** One slide rebuilt, its crops named by the slide and their order in it, so a run in any order names them alike. */
  const rebuildAt = async (slide: SlideSourceV1): Promise<void> => {
    stopIfCancelled();
    const own: string[] = [];
    let crops = 0;
    try {
      const out = await rebuildOne(slide, deps, signal, mediaCache, pictures, async (media, mime) => {
        stopIfCancelled();
        crops += 1;
        const ext = MIME_EXTENSIONS[mime] ?? 'png';
        const picture = new File([media as BlobPart], `${base} ${slide.index + 1} ${crops}.${ext}`, { type: mime });
        const stored = await deps.storePicture(picture, startedAt);
        holdRef(stored.id);
        handed.push(stored.id);
        if (stored.fresh) {
          fresh.push(stored.id);
          own.push(stored.id);
        }
        return stored.id;
      });
      done.set(slide.id, out);
      if (out) rebuilt += 1;
      else orphans.push(...own);
    } finally {
      pictures.release(slide);
    }
    finished += 1;
    input.onProgress(finished, total);
  };

  try {
    // At most `REBUILD_IN_FLIGHT` slides at once: one slide's regions, crops and
    // hashing run on this thread while another's text is read in the recogniser's
    // own worker, and no more pictures are decoded than that at a time.
    const queue = [...order];
    const lanes = Array.from({ length: Math.min(REBUILD_IN_FLIGHT, queue.length) }, async () => {
      try {
        for (let next = queue.shift(); next; next = queue.shift()) await rebuildAt(next);
      } catch (err) {
        // A slide that failed stops the others from starting; the one in hand ends.
        queue.length = 0;
        throw err;
      }
    });
    const settled = await Promise.allSettled(lanes);
    const failed = settled.find((one): one is PromiseRejectedResult => one.status === 'rejected');
    if (failed) throw failed.reason;
  } catch (err) {
    releaseRefs(handed);
    await releaseCrops(deps, fresh);
    if (signal.aborted) throw new IngestCancelledError();
    throw err;
  } finally {
    releaseRefs(handed);
    pictures.clear();
  }
  const slides = source.slides.map((slide) => done.get(slide.id) ?? slide);
  // A crop a later slide reused through the picker's duplicate check is named by the
  // rebuilt deck and stays.
  const named = JSON.stringify(slides);
  const unnamed = orphans.filter((ref) => !named.includes(JSON.stringify(ref)));
  await releaseCrops(deps, unnamed);
  if (rebuilt === 0) return { source, rebuilt, kept: total };
  const held = fresh.filter((ref) => !unnamed.includes(ref));
  if (held.length > 0) {
    if (signal.aborted) await releaseCrops(deps, held);
    else signal.addEventListener('abort', () => void releaseCrops(deps, held), { once: true });
  }
  if (signal.aborted) throw new IngestCancelledError();
  return {
    source: { ...source, slides, reader: rebuiltReader(source.reader, deps.ocr !== null, deps.ocr ? deps.ocrModel : undefined) },
    rebuilt,
    kept: total - rebuilt,
  };
}

/**
 * One slide rebuilt from its picture, or null when it stays one picture: no stored
 * bytes, too many pixels, a format this shell cannot decode, a rebuild that failed,
 * or one that left the picture uncut.
 */
async function rebuildOne(
  slide: SlideSourceV1,
  deps: RebuildDepsV1,
  signal: AbortSignal,
  mediaCache: Map<string, string>,
  pictures: PicturePoolV1,
  sink: MediaSinkV1,
): Promise<SlideSourceV1 | null> {
  const pic = flattenedPictureOf(slide);
  if (!pic?.media) return null;
  const picture = await pictures.pixels(pic.media);
  if (!picture) return null;
  const staged = new Map(mediaCache);
  let out: SlideSourceV1;
  try {
    out = await reconstructFlattenedSlide({
      slide,
      picture,
      sink,
      mediaCache: staged,
      ...(deps.ocr ? { ocr: deps.ocr } : { ocrMissing: 'unavailable' as const }),
      ...(deps.ocrModel ? { ocrModel: deps.ocrModel } : {}),
      signal,
    });
  } catch (err) {
    if (signal.aborted) throw err;
    return null;
  }
  // The rebuild can decline to cut the picture (a turned or clipped picture, a region
  // search that hit its cap): nothing was cut, so the slide stays as it was.
  if (out.objects.some((object) => object.id === pic.id)) return null;
  for (const [hash, ref] of staged) mediaCache.set(hash, ref);
  return out;
}

/** Release crops this call stored fresh and nothing else holds. Best effort. */
async function releaseCrops(deps: RebuildDepsV1, refs: readonly string[]): Promise<void> {
  if (!deps.deleteAsset) return;
  for (const ref of refs) {
    if (readsInFlight.has(ref)) continue;
    await deps.deleteAsset(ref).catch(() => {});
  }
}

// ─── outlined labels ─────────────────────────────────────────────────────────

export interface ReadVectorLabelsInputV1 {
  source: SourceDeckV1;
  signal: AbortSignal;
  /** Drawings read so far, of the drawings that still hold outlined labels. */
  onProgress?: (done: number, total: number) => void;
}

export type ReadVectorLabelsResultV1 =
  | {
    ok: true;
    /** The deck with the labels read in place; the same object when none became text. */
    source: SourceDeckV1;
    summary: VectorLabelSummaryV1;
  }
  | {
    ok: false;
    /** `no-reader`: this shell has no recogniser. `model-missing`: its model is not on the device, which the view offers in place. */
    reason: 'no-reader' | 'model-missing';
  };

/**
 * Read the outlined labels of a deck that was read before the text model was on the
 * device (plan 275 section 9.3). It never downloads: without the model it says so, and
 * the caller offers the download in place and asks again. Rejects with an
 * `IngestCancelledError` when the signal aborted. The caller writes the deck it gets
 * back, as it does a rebuilt one.
 */
export async function readVectorLabelsIn(
  host: RebuildHostV1,
  input: ReadVectorLabelsInputV1,
  overrides: { labelReader?: IngestDepsV1['labelReader']; parseXml?: IngestDepsV1['parseXml'] } = {},
): Promise<ReadVectorLabelsResultV1> {
  const { signal } = input;
  if (signal.aborted) throw new IngestCancelledError();
  const reader = await (overrides.labelReader ?? ((s: AbortSignal) => hostLabelReader(host, s)))(signal).catch(() => null);
  if (!reader) return { ok: false, reason: host.ocr?.isAvailable() ? 'model-missing' : 'no-reader' };
  try {
    const read = await readDeckVectorLabels(input.source, reader, overrides.parseXml ?? defaultParseXml, {
      signal,
      ...(input.onProgress ? { onProgress: input.onProgress } : {}),
    });
    return { ok: true, source: read.deck, summary: read.summary };
  } catch (err) {
    if (signal.aborted) throw new IngestCancelledError();
    throw err;
  }
}

// ─── pictures other reads are using ──────────────────────────────────────────

/**
 * Refs the reads running in this tab have handed out, counted, so one read's cleanup
 * never deletes a picture another read reused through the picker's duplicate check.
 */
const readsInFlight = new Map<string, number>();

function holdRef(ref: string): void {
  readsInFlight.set(ref, (readsInFlight.get(ref) ?? 0) + 1);
}

/** Let go of every ref in `refs` and empty it, so a second call does nothing. */
function releaseRefs(refs: string[]): void {
  for (const ref of refs.splice(0)) {
    const left = (readsInFlight.get(ref) ?? 0) - 1;
    if (left > 0) readsInFlight.set(ref, left);
    else readsInFlight.delete(ref);
  }
}

/**
 * The refs in `refs` another stored project's source deck names. A store that cannot
 * answer counts every ref as named, so the bytes stay.
 */
async function namedByOtherProjects(store: WebRenovationProjectStore, projectId: string, refs: readonly string[]): Promise<Set<string>> {
  const named = new Set<string>();
  try {
    for (const other of await store.list()) {
      if (other.id === projectId) continue;
      const deck = await store.getPart<SourceDeckV1>(other.id, 'sourceDeck');
      if (!deck) continue;
      const text = JSON.stringify(deck);
      for (const ref of refs) if (text.includes(JSON.stringify(ref))) named.add(ref);
    }
  } catch {
    return new Set(refs);
  }
  return named;
}

/**
 * Take a half-made project back off the device: the record, its parts and the source
 * bytes through the store's own release rule, then the pictures this read stored fresh
 * that the store did not mention. A ref the store released is gone and one it kept is
 * held by something else; a ref another read in this tab is using, or that another
 * stored deck names, stays too. Best effort: a cleanup that fails must not hide the
 * failure that caused it.
 */
async function discard(deps: IngestDepsV1, projectId: string, fresh: readonly string[]): Promise<void> {
  const settled = new Set<string>();
  try {
    const removed = await deps.store.remove(projectId);
    for (const ref of removed.removedAssetRefs) settled.add(ref);
    for (const ref of removed.keptAssetRefs) settled.add(ref);
  } catch {
    // The record may be left; the pictures below are still released.
  }
  if (!deps.deleteAsset) return;
  const candidates = fresh.filter((ref) => !settled.has(ref) && !readsInFlight.has(ref));
  if (candidates.length === 0) return;
  const named = await namedByOtherProjects(deps.store, projectId, candidates);
  for (const ref of candidates) {
    if (named.has(ref)) continue;
    await deps.deleteAsset(ref).catch(() => {});
  }
}
