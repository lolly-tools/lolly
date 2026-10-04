// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly_read` (plan 291 W2): what a deck says, slide by slide, as a
 * `ContentInventoryV1` (schemas/content-inventory-v1.schema.json). The same reader
 * `lolly read` runs (`readContentInventory`, @lolly-tools/node-shell/content-inventory),
 * so the CLI and this tool hand an agent the same text frames in reading order with
 * their roles and runs, speaker notes with paragraphs and line breaks kept apart,
 * pictures by content hash with their placement and crop, tables and charts as data,
 * and the census class of every object.
 *
 * WHERE THE BYTES GO is as for `lolly_rebrand`: a local server is a process on the
 * machine that holds the file; calling a hosted one sends the file there. The deck is
 * held in memory for the call and nothing is written. No text recognition runs on any
 * MCP server, so a slide that is one picture of a slide reads as a picture (`ocr` is
 * false on every result).
 *
 * LARGE RESULTS. The inventory travels inside the structured result up to
 * `inlineBytes`, and as an embedded JSON resource above that. Pictures come back as
 * facts (hash, type, size, placement) unless `media: "inline"` asks for their bytes
 * as embedded resources, one per distinct picture. On Vercel an answer over the
 * response limit is refused with `output.too-large`, never cut off.
 *
 * ERRORS carry a stable code (`READ_TOOL_CODES`); the call never throws.
 */

import type { ContentInventoryV1 } from '@lolly-tools/core';
import { RebrandPipelineError } from '@lolly-tools/node-shell/rebrand';
import { mediaFileName, readContentInventory } from '@lolly-tools/node-shell/content-inventory';
import { loadPdfDocument } from '@lolly-tools/node-shell/pdf-read';
// Imported, not read from disk: the bundled Vercel function carries no schemas/ directory.
import inventorySchema from '../../../schemas/content-inventory-v1.schema.json' with { type: 'json' };
import type { ContentBlock } from './protocol.ts';
import { MAX_TRANSFORM_INPUT_BYTES } from './render.ts';
import { slidePartCount } from './rebrand.ts';
import {
  INT,
  STR,
  STRUCTURED_LIMITS,
  ToolCodeError,
  contractPart,
  errorOut,
  failure,
  maxFileBytes,
  maxSlides,
  obj,
  plural,
  readFileArg,
  resourceUri,
  success,
  type Env,
  type Schema,
  type StructuredCtx,
  type StructuredLimitsV1,
  type StructuredResult,
} from './structured.ts';

/** Every code a `lolly_read` error carries. */
export type ReadToolCodeV1 =
  | 'source.missing'
  | 'source.too-large'
  | 'source.unreadable'
  | 'source.encrypted'
  | 'source.unsupported'
  | 'request.invalid'
  | 'output.too-large'
  | 'internal';

/** Every code, as a `Record` over the union, so a new code fails the typecheck until the schema lists that code. */
const CODES: Record<ReadToolCodeV1, true> = {
  'source.missing': true,
  'source.too-large': true,
  'source.unreadable': true,
  'source.encrypted': true,
  'source.unsupported': true,
  'request.invalid': true,
  'output.too-large': true,
  internal: true,
};
export const READ_TOOL_CODES = Object.keys(CODES) as ReadToolCodeV1[];

export const READ_MEDIA_MODES = ['facts', 'inline'] as const;
export type ReadMediaModeV1 = (typeof READ_MEDIA_MODES)[number];

export type ReadLimitsV1 = StructuredLimitsV1;
export const READ_LIMITS: Readonly<ReadLimitsV1> = STRUCTURED_LIMITS;

// ─── the tool definition ─────────────────────────────────────────────────────

const inventory = contractPart(inventorySchema as Schema);

const SOURCE = (inventory.root.properties as Record<string, Schema>).source as Schema;

const COUNTS = obj({ slides: INT, text: INT, notes: INT, pictures: INT, tables: INT, charts: INT, media: INT });

const MEDIA_ROW = obj(
  {
    ref: STR,
    sha256: STR,
    mime: STR,
    bytes: INT,
    width: { type: 'integer', minimum: 1 },
    height: { type: 'integer', minimum: 1 },
    uri: STR,
  },
  ['width', 'height', 'uri'],
);

const READ_OUT = obj(
  {
    source: SOURCE,
    counts: COUNTS,
    inventoryDelivery: obj({ mode: { enum: ['inline', 'resource'] }, bytes: INT, uri: STR }, ['uri']),
    inventory: { $ref: '#/$defs/contentInventory' },
    media: { type: 'array', items: MEDIA_ROW },
    warnings: { type: 'array', items: obj({ code: STR, message: STR }) },
    ocr: { const: false },
    note: STR,
  },
  ['inventory'],
);

/** The structured result: the inventory (or where it went) with its facts, or an error. */
export const READ_OUTPUT_SCHEMA: Schema = {
  type: 'object',
  $defs: { ...inventory.defs, contentInventory: inventory.root },
  oneOf: [READ_OUT, errorOut(READ_TOOL_CODES)],
};

const FILE_ARG = {
  type: 'object',
  description: 'The deck: a .pptx, a PDF or a Photoshop document (.psd).',
  properties: {
    base64: { type: 'string', description: 'The file bytes, base64-encoded.' },
    name: { type: 'string', description: 'The file name, e.g. quarterly.pptx.' },
    mime: { type: 'string', description: 'The MIME type, if known.' },
  },
  required: ['base64'],
  additionalProperties: false,
};

const mebibytes = (bytes: number): string => `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MiB`;

/**
 * The size line a tool description gives. The description is built once, when the
 * module loads, so it states the local limit and says a hosted server's is smaller;
 * the refusal on a hosted server gives that server's own figure in bytes.
 */
export const FILE_SIZE_NOTE = `up to ${mebibytes(MAX_TRANSFORM_INPUT_BYTES)} on a local server and less on a hosted one, which names its limit when it refuses`;

/** True when the bytes are a PDF. */
const isPdf = (bytes: Uint8Array): boolean => new TextDecoder().decode(bytes.subarray(0, 1024)).includes('%PDF-');

/**
 * Slides a deck holds, counted before it is read: a .pptx's slide parts, a PDF's
 * pages from its page tree (no page is drawn). Null when neither can be counted, and
 * the reader then decides. A hosted server refuses an oversized deck on this count
 * rather than after reading every page of that deck.
 */
export async function deckSlideCount(bytes: Uint8Array): Promise<number | null> {
  const parts = slidePartCount(bytes);
  if (parts !== null) return parts;
  if (!isPdf(bytes)) return null;
  try {
    return (await loadPdfDocument(bytes)).getPageCount();
  } catch {
    return null;
  }
}

/** The name a deck sent without one gets, from its bytes: deck.pdf, deck.psd or deck.pptx. */
export function deckFallbackName(bytes: Uint8Array): string {
  if (isPdf(bytes)) return 'deck.pdf';
  if (bytes[0] === 0x38 && bytes[1] === 0x42 && bytes[2] === 0x50 && bytes[3] === 0x53) return 'deck.psd';
  return 'deck.pptx';
}

/** The base64 bytes of a file argument, best-effort, for naming a file sent without a name. */
function peekBytes(value: unknown): Uint8Array {
  const b64 = value && typeof value === 'object' && typeof (value as { base64?: unknown }).base64 === 'string' ? (value as { base64: string }).base64 : '';
  return Uint8Array.from(Buffer.from(b64.replace(/\s/g, '').slice(0, 1400), 'base64'));
}

export const READ_TOOL_DEF = {
  name: 'lolly_read',
  description:
    `Read what a deck says (a .pptx, a PDF or a Photoshop .psd, ${FILE_SIZE_NOTE}; up to 100 slides or pages per call on a hosted server), slide by slide, as a content inventory: ` +
    'text frames in reading order with role (title, subtitle, body, label, caption) and runs, speaker notes with paragraphs and line breaks kept apart, ' +
    'pictures by content hash with placement and crop, tables and charts as data, and the census class of every object, so decoration can be told from content. ' +
    'The same reader as `lolly read --json`. Pass the inventory to lolly_check as `inventory` to check a recreation against its source. No OCR runs here.',
  inputSchema: {
    type: 'object',
    properties: {
      file: FILE_ARG,
      media: {
        type: 'string',
        enum: [...READ_MEDIA_MODES],
        description: 'facts (default) lists each picture by hash, type and size; inline also returns the bytes of each distinct picture as an embedded resource.',
      },
    },
    required: ['file'],
    additionalProperties: false,
  },
  outputSchema: READ_OUTPUT_SCHEMA,
};

// ─── the call ────────────────────────────────────────────────────────────────

function asReadError(err: unknown): ToolCodeError<ReadToolCodeV1> {
  if (err instanceof ToolCodeError && Object.hasOwn(CODES, err.code)) return err as ToolCodeError<ReadToolCodeV1>;
  const message = err instanceof Error ? err.message : String(err);
  if (err instanceof RebrandPipelineError) {
    const code = Object.hasOwn(CODES, err.code) ? (err.code as ReadToolCodeV1) : 'source.unreadable';
    return new ToolCodeError(code, message);
  }
  return new ToolCodeError('internal', message);
}

function tooManySlides(count: number, max: number): ToolCodeError<ReadToolCodeV1> {
  return new ToolCodeError('source.too-large', `The deck has ${count} slides and this server reads up to ${max} in one call; run lolly read on the CLI for this deck.`);
}

interface ReadCounts { slides: number; text: number; notes: number; pictures: number; tables: number; charts: number; media: number }

function countsOf(inv: ContentInventoryV1): ReadCounts {
  const sum = (pick: (slide: ContentInventoryV1['slides'][number]) => number): number => inv.slides.reduce((n, slide) => n + pick(slide), 0);
  return {
    slides: inv.slides.length,
    text: sum((s) => s.text.length),
    notes: sum((s) => (s.notes ? 1 : 0)),
    pictures: sum((s) => s.pictures.length),
    tables: sum((s) => s.tables.length),
    charts: sum((s) => s.charts.length),
    media: inv.media.length,
  };
}

/** Read one deck into a content inventory. Never throws: a failure is an error result with its code. */
export async function callRead(
  args: Record<string, unknown>,
  env: Env = process.env,
  limits: Readonly<ReadLimitsV1> = READ_LIMITS,
): Promise<StructuredResult> {
  const ctx: StructuredCtx = { env, limits };
  try {
    const extra = Object.keys(args).find((key) => key !== 'file' && key !== 'media');
    if (extra) throw new ToolCodeError('request.invalid', `lolly_read takes file and media, not ${extra}.`);
    const mode = args.media ?? 'facts';
    if (!(READ_MEDIA_MODES as readonly unknown[]).includes(mode))
      throw new ToolCodeError('request.invalid', `media takes ${READ_MEDIA_MODES.join(' or ')}, not ${JSON.stringify(mode)}.`);
    const file = readFileArg<ReadToolCodeV1>(args.file, {
      max: maxFileBytes(ctx),
      what: 'file',
      fallbackName: deckFallbackName(peekBytes(args.file)),
      missing: 'source.missing',
      tooLarge: 'source.too-large',
      invalid: 'request.invalid',
      hint: 'Run lolly read on the CLI for this deck.',
    });
    const max = maxSlides(ctx);
    const parts = await deckSlideCount(file.bytes);
    if (parts !== null && parts > max) throw tooManySlides(parts, max);

    const read = await readContentInventory({ bytes: file.bytes, name: file.name });
    const inv = read.inventory;
    if (inv.slides.length > max) throw tooManySlides(inv.slides.length, max);

    const files: ContentBlock[] = [];
    const uris = new Map<string, string>();
    if (mode === 'inline') {
      for (const entry of inv.media) {
        const media = read.media.get(entry.ref);
        if (!media) continue;
        const uri = resourceUri('read', inv.source.sha256, `media/${mediaFileName(entry.sha256, entry.mime)}`);
        uris.set(entry.ref, uri);
        files.push({ type: 'resource', resource: { uri, mimeType: entry.mime, blob: Buffer.from(media.bytes).toString('base64') } });
      }
    }

    const text = JSON.stringify(inv);
    const size = Buffer.byteLength(text, 'utf8');
    const inline = size <= limits.inlineBytes;
    const stem = inv.source.name.replace(/\.[^.]+$/, '') || 'deck';
    const inventoryUri = resourceUri('read', inv.source.sha256, `${stem}.inventory.json`);
    if (!inline) files.unshift({ type: 'resource', resource: { uri: inventoryUri, mimeType: 'application/json', text } });

    const counts = countsOf(inv);
    const structured: Record<string, unknown> = {
      source: inv.source,
      counts,
      inventoryDelivery: inline ? { mode: 'inline', bytes: size } : { mode: 'resource', bytes: size, uri: inventoryUri },
      ...(inline ? { inventory: inv } : {}),
      media: inv.media.map((m) => ({
        ref: m.ref,
        sha256: m.sha256,
        mime: m.mime,
        bytes: m.bytes,
        ...(m.width !== undefined ? { width: m.width } : {}),
        ...(m.height !== undefined ? { height: m.height } : {}),
        ...(uris.has(m.ref) ? { uri: uris.get(m.ref) } : {}),
      })),
      warnings: inv.warnings,
      ocr: false,
      note:
        'No OCR runs on this server: a slide that is one picture of a slide reads as a picture. ' +
        (mode === 'inline' ? 'Each distinct picture is attached once, at the uri its media row gives.' : 'Pass media: "inline" for the picture bytes.'),
    };
    const sentence =
      `${inv.source.name}: ${plural(counts.slides, 'slide')}, ${plural(counts.text, 'text frame')}, ` +
      `notes on ${plural(counts.notes, 'slide')}, ${plural(counts.pictures, 'picture')} from ${plural(counts.media, 'distinct file')}` +
      `${inline ? '' : `; the inventory is attached as ${inventoryUri}`}.`;
    return success<ReadToolCodeV1>(sentence, structured, files, ctx, 'output.too-large', mode === 'inline'
      ? 'ask again with media: "facts", or run lolly read on the CLI.'
      : 'run lolly read on the CLI for this deck.');
  } catch (err) {
    return failure(asReadError(err));
  }
}
