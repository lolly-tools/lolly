// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly_check` (plan 291 W1): every check Lolly has for a Design document, a
 * `.lolly` or an export, in one call and one findings list, as a `CheckReportV1`
 * (schemas/check-report-v1.schema.json). The work is `checkFile`
 * (@lolly-tools/node-shell/check), the same function `lolly check` runs, so the CLI
 * and this tool report the same families, codes, English messages and exit code.
 *
 * THE INPUT is exactly one of:
 *   file      a Design document (.json), a .lolly, or an export (.pdf, .pptx, .png,
 *             .jpg, .webp, .svg), base64. The kind comes from the name, else the MIME
 *             type, else the bytes.
 *   toolId    "design", with inputs, templateId, presetId, layerOperations and
 *             layerPatches exactly as lolly_validate and lolly_render take them.
 *   document  a compiled Design document, as lolly_compile returns one.
 *
 * THE FAMILIES. structure, brand (against this server's content profile, the design
 * system lolly://design-context describes), Verify (from the document's own geometry,
 * or from an export's file, with OCR and the text classifier off), fidelity (with a
 * `source` deck or an `inventory` from lolly_read), and render: the mounted audit in
 * the web shell this server drives on its browser tier. A server with no browser (the
 * Vercel function at lolly.tools/api/mcp) reports render `unavailable` with the
 * reason, and the other families still run.
 *
 * EXIT CODE. `exitCode` is the code `lolly check` exits with: 0 clean, 5 warnings to
 * review, 4 an error finding (or any warning under `strict`), 3 `browser: "require"`
 * with no browser tier, 1 a family that crashed. Findings are data, never a tool
 * error: `isError` is set only when the request or the input cannot be read.
 *
 * ERRORS carry a stable code (`CHECK_TOOL_CODES`); the call never throws.
 */

import type { ContentInventoryV1 } from '@lolly-tools/core';
import { CheckInputError, checkFile, checkInputKind, parseFidelityEdits, unwrapContentInventory, type CheckFileOptionsV1, type CheckInputErrorCode } from '@lolly-tools/node-shell/check';
import { readProfileBriefCatalog, readProfileTokenDocument } from '@lolly-tools/node-shell/design-brief';
// Imported, not read from disk: the bundled Vercel function carries no schemas/ directory.
import reportSchema from '../../../schemas/check-report-v1.schema.json' with { type: 'json' };
import inventorySchema from '../../../schemas/content-inventory-v1.schema.json' with { type: 'json' };
import { loadToolCached } from './catalog.ts';
import { designChecksTierB } from './render.ts';
import { slidePartCount } from './rebrand.ts';
import { FILE_SIZE_NOTE, deckSlideCount } from './read.ts';
import {
  STRUCTURED_LIMITS,
  ToolCodeError,
  contractPart,
  errorOut,
  failure,
  fileArgLength,
  maxFileBytes,
  maxSlides,
  plural,
  readFileArg,
  requestRoom,
  success,
  type Env,
  type FileArg,
  type Schema,
  type StructuredCtx,
  type StructuredLimitsV1,
  type StructuredResult,
} from './structured.ts';

/** Codes of this surface alone, beside the ones `checkFile` throws. */
type McpOnlyCode = 'input.missing' | 'source.too-large' | 'request.invalid' | 'output.too-large' | 'internal';

/** Every code a `lolly_check` error carries. */
export type CheckToolCodeV1 = CheckInputErrorCode | McpOnlyCode;

/**
 * Every code, as a `Record` over the union, so a code `checkFile` adds fails the
 * typecheck here until the output schema lists the code.
 */
const CODES: Record<CheckToolCodeV1, true> = {
  'input.unsupported': true,
  'input.unreadable': true,
  'input.too-large': true,
  'source.unreadable': true,
  'input.missing': true,
  'source.too-large': true,
  'request.invalid': true,
  'output.too-large': true,
  internal: true,
};
export const CHECK_TOOL_CODES = Object.keys(CODES) as CheckToolCodeV1[];

export const CHECK_BROWSER_MODES = ['auto', 'off', 'require'] as const;

export type CheckLimitsV1 = StructuredLimitsV1;
export const CHECK_LIMITS: Readonly<CheckLimitsV1> = STRUCTURED_LIMITS;

/** What tools.ts lends this module: a Design source resolved the way lolly_validate resolves one. */
export type CheckDesignResolver = (args: Record<string, unknown>) => Promise<{ values: Record<string, unknown>; manifest?: unknown }>;

/** Seams a test replaces: the page hook runner. */
export interface CheckDeps {
  renderChecks?: CheckFileOptionsV1['renderChecks'];
}

// ─── the tool definition ─────────────────────────────────────────────────────

const report = contractPart(reportSchema as Schema);

/** The structured result: the check report itself, or an error. */
export const CHECK_OUTPUT_SCHEMA: Schema = {
  type: 'object',
  $defs: report.defs,
  oneOf: [report.root, errorOut(CHECK_TOOL_CODES)],
};

const fileArg = (description: string, name: string) => ({
  type: 'object',
  description,
  properties: {
    base64: { type: 'string', description: 'The file bytes, base64-encoded.' },
    name: { type: 'string', description: `The file name, e.g. ${name}. Its extension says what the file is.` },
    mime: { type: 'string', description: 'The MIME type, if known.' },
  },
  required: ['base64'],
  additionalProperties: false,
});

/** The schema fragments tools.ts shares, so this tool takes a Design source exactly as lolly_render takes one. */
export interface CheckSchemaParts {
  toolId: unknown;
  inputs: unknown;
  template: Record<string, unknown>;
  layerOperations: unknown;
  layerPatches: unknown;
}

export function checkToolDef(p: CheckSchemaParts) {
  return {
    name: 'lolly_check',
    description:
      'Check a Design document, a .lolly or an export (.pdf, .pptx, .png, .jpg, .webp, .svg) with every check Lolly has, in one findings list: ' +
      'structure, render (clipping, contrast and font coverage in the painted editor; unavailable on a server with no browser), ' +
      "brand (this server's design system and the house rules its brand pack declares; read lolly://design-context first), " +
      'Verify (layout clues from the layers, or from the file for an export; no OCR), and fidelity to a source deck or a lolly_read inventory. ' +
      'Each finding has a stable code, a severity, the layer id where there is one, the message the app shows and a fix where one is safe. ' +
      `exitCode is the code lolly check exits with: 0 clean, 5 to review, 4 refused, 3 no browser under browser: "require" (a document only; an export has no render family), 1 a family failed or nothing could be decoded. ` +
      `Files ${FILE_SIZE_NOTE}, and up to 100 slides or PDF pages per file on a hosted server; ` +
      'on a hosted server the file and the source travel in one request, so pass inventory rather than the source deck there.',
    inputSchema: {
      type: 'object',
      properties: {
        file: fileArg('The file to check: a Design document (.json), a .lolly, or an export.', 'slides.lolly'),
        toolId: p.toolId,
        inputs: p.inputs,
        ...p.template,
        layerOperations: p.layerOperations,
        layerPatches: p.layerPatches,
        document: { type: 'object', description: 'A compiled Design document, as lolly_compile returns it.', additionalProperties: true },
        source: fileArg('The deck the document recreates (.pptx, .pdf, .psd), or a content inventory (.json) lolly read wrote.', 'source.pptx'),
        inventory: { type: 'object', description: 'The content inventory lolly_read returned for the source deck, instead of source.', additionalProperties: true },
        edits: {
          type: 'array',
          maxItems: 2000,
          description:
            'Changes to the source wording made on purpose, with source or inventory. Each finding one covers stays in the report as info, marked excepted (evidence.excepted, fidelity.excepted): excepted, never passed. Leave result out for a string dropped on purpose.',
          items: {
            type: 'object',
            properties: {
              source: { type: 'string', description: 'The source text as the deck has it.' },
              result: { type: 'string', description: 'What the document says instead.' },
              reason: { type: 'string', description: 'Why the change was made on purpose.' },
            },
            required: ['source', 'reason'],
            additionalProperties: false,
          },
        },
        strict: { type: 'boolean', description: 'Weak Verify clues become errors, and any warning refuses (exit 4).' },
        theme: { type: 'string', description: 'The token theme the document is composed in.' },
        themes: {
          description: 'Check the document in each of these themes (or "all" the design system declares) in one report: the page is painted and linked colours resolve per theme, and each render, brand and Verify finding carries its theme.',
          oneOf: [
            { type: 'string', const: 'all' },
            { type: 'array', items: { type: 'string', minLength: 1 }, minItems: 1, maxItems: 16 },
          ],
        },
        browser: {
          type: 'string',
          enum: [...CHECK_BROWSER_MODES],
          description: 'auto (default) runs the render family when this server has a browser; off skips it; require makes its absence exit 3.',
        },
        pageCap: { type: 'integer', minimum: 1, maximum: 100, description: 'Pages or artboards Verify reads, 1 to 100 (default 100).' },
      },
      additionalProperties: false,
    },
    outputSchema: CHECK_OUTPUT_SCHEMA,
  };
}

// ─── the call ────────────────────────────────────────────────────────────────

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

const DESIGN_ARGS = ['toolId', 'inputs', 'templateId', 'presetId', 'motionTiming', 'layerOperations', 'layerPatches'] as const;
const KNOWN_ARGS = new Set<string>(['file', 'document', 'source', 'inventory', 'edits', 'strict', 'theme', 'themes', 'browser', 'pageCap', ...DESIGN_ARGS]);

const MIME_EXT: Record<string, string> = {
  'application/json': 'json',
  'application/vnd.lolly+zip': 'lolly',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

/** The extension the bytes say, for a file whose name and type say nothing. */
function sniff(bytes: Uint8Array): string | null {
  const head = new TextDecoder().decode(bytes.subarray(0, 512)).trimStart();
  if (head.startsWith('%PDF')) return 'pdf';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  if (head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP') return 'webp';
  if (head.startsWith('{') || head.startsWith('[')) return 'json';
  if (head.startsWith('<') && /<svg[\s>]/.test(head)) return 'svg';
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return (slidePartCount(bytes) ?? 0) > 0 ? 'pptx' : 'lolly';
  return null;
}

/** The file's name, with an extension that says its kind when the given name does not. */
function namedForKind(file: FileArg): string {
  if (checkInputKind(file.name)) return file.name;
  const ext = (file.mime && MIME_EXT[file.mime.toLowerCase()]) || sniff(file.bytes);
  if (!ext) return file.name;
  return `${file.name.replace(/\.[^.]*$/, '') || 'input'}.${ext}`;
}

let inventoryCheck: Promise<(doc: unknown) => string[]> | null = null;

/** A lolly_read inventory held to its schema, compiled once from the imported copy. */
async function inventoryProblems(doc: unknown): Promise<string[]> {
  inventoryCheck ??= (async () => {
    const { default: Ajv2020 } = await import('ajv/dist/2020.js');
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(inventorySchema);
    return (value: unknown): string[] => (validate(value) ? [] : (validate.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message ?? 'is not valid'}`));
  })();
  return (await inventoryCheck)(doc);
}

/** The design system the brand family checks against: this server's content profile. */
function profileDesignSystem(): Pick<CheckFileOptionsV1, 'designSystem' | 'catalog'> {
  try {
    const tokens = readProfileTokenDocument();
    const catalog = readProfileBriefCatalog();
    return {
      designSystem: tokens ? { doc: tokens.doc, origin: 'profile', profile: tokens.profile, tokensAsset: tokens.tokensAsset } : null,
      catalog,
    };
  } catch {
    return { designSystem: null, catalog: null };
  }
}

/**
 * The page hook on a local server, with a failure to start the browser said to the
 * agent in words it can act on: the instruction to install Chromium is for whoever
 * runs this server, not for the caller of the tool.
 */
const localBrowser: NonNullable<CheckFileOptionsV1['renderChecks']> = async (session) => {
  try {
    return await designChecksTierB(session);
  } catch (err) {
    const why = (err instanceof Error ? err.message : String(err)).split(/[.:]\s/)[0]?.trim() || 'it did not start';
    return {
      kind: 'no-hook',
      reason:
        `This server could not open its browser (${why}), so the render family (clipping, contrast and font coverage in the painted editor) did not run. ` +
        "Whoever runs this server can install Chromium for it; the other families still ran.",
    };
  }
};

/** The page hook on a server with no browser: the render family is unavailable, in words. */
const noBrowser: NonNullable<CheckFileOptionsV1['renderChecks']> = async () => ({
  kind: 'no-hook',
  reason:
    'This server is a serverless function with no browser, so the render family (clipping, contrast and font coverage in the painted editor) does not run here. ' +
    'Call lolly_check on a local Lolly MCP server, or run lolly check.',
});

function asCheckError(err: unknown): ToolCodeError<CheckToolCodeV1> {
  if (err instanceof ToolCodeError && Object.hasOwn(CODES, err.code)) return err as ToolCodeError<CheckToolCodeV1>;
  if (err instanceof CheckInputError) return new ToolCodeError(err.code, err.message);
  return new ToolCodeError('internal', err instanceof Error ? err.message : String(err));
}

/** The one input the call names, as bytes and a name `checkFile` reads the kind from. */
async function inputOf(args: Record<string, unknown>, resolveDesign: CheckDesignResolver, ctx: StructuredCtx): Promise<{ bytes: Uint8Array; name: string; manifest?: unknown }> {
  const given = [args.file !== undefined && 'file', args.toolId !== undefined && 'toolId', args.document !== undefined && 'document'].filter(Boolean) as string[];
  if (given.length === 0)
    throw new ToolCodeError('input.missing', 'Give one input: file (a Design document, a .lolly or an export), toolId "design" with its inputs, or document.');
  if (given.length > 1) throw new ToolCodeError('request.invalid', `Give one input, not ${given.join(' and ')}.`);
  const stray = DESIGN_ARGS.find((key) => key !== 'toolId' && args[key] !== undefined);
  if (stray && args.toolId === undefined) throw new ToolCodeError('request.invalid', `${stray} goes with toolId "design".`);

  if (args.file !== undefined) {
    const file = readFileArg<CheckToolCodeV1>(args.file, {
      max: maxFileBytes(ctx),
      what: 'file',
      fallbackName: 'input',
      missing: 'input.missing',
      tooLarge: 'input.too-large',
      invalid: 'request.invalid',
      hint: 'Run lolly check on the CLI for this file.',
    });
    const max = maxSlides(ctx);
    const parts = await deckSlideCount(file.bytes);
    if (parts !== null && parts > max)
      throw new ToolCodeError('input.too-large', `The file has ${parts} slides or pages and this server checks up to ${max} in one call; run lolly check on the CLI for this file.`);
    return { bytes: file.bytes, name: namedForKind(file) };
  }

  if (args.toolId !== undefined) {
    if (args.toolId !== 'design')
      throw new ToolCodeError('input.unsupported', `lolly_check reads Design documents and exports; toolId must be "design", not ${JSON.stringify(args.toolId)}.`);
    let resolved: Awaited<ReturnType<CheckDesignResolver>>;
    try {
      resolved = await resolveDesign(args);
    } catch (err) {
      throw new ToolCodeError('request.invalid', err instanceof Error ? err.message : String(err));
    }
    return { bytes: new TextEncoder().encode(JSON.stringify({ values: resolved.values })), name: 'design.json', manifest: resolved.manifest };
  }

  const document = args.document;
  if (!record(document)) throw new ToolCodeError('request.invalid', 'document must be a compiled Design document (an object), as lolly_compile returns it.');
  if (document.toolId !== undefined && document.toolId !== 'design')
    throw new ToolCodeError('input.unsupported', `This document was compiled by ${JSON.stringify(document.toolId)}; lolly_check reads Design documents.`);
  const values = record(document.values) ? document.values : document;
  return { bytes: new TextEncoder().encode(JSON.stringify({ values })), name: 'document.json' };
}

/** The source deck or inventory fidelity compares with, when one is given. */
async function sourceOf(args: Record<string, unknown>, ctx: StructuredCtx): Promise<CheckFileOptionsV1['source']> {
  if (args.source !== undefined && args.inventory !== undefined) throw new ToolCodeError('request.invalid', 'Give source or inventory, not both.');
  if (args.inventory !== undefined) {
    // What lolly_read returned whole ({inventory, inventoryDelivery, ...}), or a saved
    // `lolly read --json` envelope, is taken for the inventory inside that wrapper.
    const inventory = unwrapContentInventory(args.inventory);
    const problems = await inventoryProblems(inventory);
    if (problems.length)
      throw new ToolCodeError(
        'source.unreadable',
        `inventory is not a content inventory (the inventory field of a lolly_read result, or the result itself): ${problems.slice(0, 3).join('; ')}.`
      );
    const max = maxSlides(ctx);
    const slides = (inventory as ContentInventoryV1).slides.length;
    if (slides > max) throw new ToolCodeError('source.too-large', `The inventory has ${slides} slides and this server compares up to ${max} in one call; run lolly check on the CLI.`);
    return inventory as ContentInventoryV1;
  }
  if (args.source === undefined) return undefined;
  const file = readFileArg<CheckToolCodeV1>(args.source, {
    max: maxFileBytes(ctx),
    what: 'source',
    fallbackName: 'source.pptx',
    missing: 'request.invalid',
    tooLarge: 'source.too-large',
    invalid: 'request.invalid',
    hint: 'Pass the lolly_read inventory as inventory instead.',
  });
  const max = maxSlides(ctx);
  const parts = await deckSlideCount(file.bytes);
  if (parts !== null && parts > max)
    throw new ToolCodeError('source.too-large', `The source deck has ${parts} slides or pages and this server reads up to ${max} in one call; run lolly check on the CLI.`);
  return { bytes: file.bytes, name: file.name };
}

/** The deliberate edits the call declares, held to their shape; every problem refuses the request. */
function editsOf(args: Record<string, unknown>): CheckFileOptionsV1['edits'] {
  if (args.edits === undefined) return undefined;
  if (args.source === undefined && args.inventory === undefined)
    throw new ToolCodeError('request.invalid', 'edits applies to the fidelity check, which needs source or inventory.');
  if (!Array.isArray(args.edits)) throw new ToolCodeError('request.invalid', 'edits is a list of { source, result, reason }.');
  const { edits, problems } = parseFidelityEdits(args.edits);
  if (problems.length) throw new ToolCodeError('request.invalid', `edits: ${problems.slice(0, 3).join(' ')}`);
  return edits;
}

function familiesLine(families: Record<string, { state: string }>): string {
  return Object.entries(families).map(([name, f]) => `${name} ${f.state}`).join(', ');
}

/** Check one Design document or export. Never throws: a failure is an error result with its code. */
export async function callCheck(
  args: Record<string, unknown>,
  resolveDesign: CheckDesignResolver,
  env: Env = process.env,
  limits: Readonly<CheckLimitsV1> = CHECK_LIMITS,
  deps: CheckDeps = {},
): Promise<StructuredResult> {
  const ctx: StructuredCtx = { env, limits };
  try {
    const extra = Object.keys(args).find((key) => !KNOWN_ARGS.has(key));
    if (extra) throw new ToolCodeError('request.invalid', `lolly_check does not take ${extra}.`);
    const browser = args.browser ?? 'auto';
    if (!(CHECK_BROWSER_MODES as readonly unknown[]).includes(browser))
      throw new ToolCodeError('request.invalid', `browser takes ${CHECK_BROWSER_MODES.join(', ')}, not ${JSON.stringify(browser)}.`);
    if (args.pageCap !== undefined && (!Number.isInteger(args.pageCap) || (args.pageCap as number) < 1 || (args.pageCap as number) > 100))
      throw new ToolCodeError('request.invalid', 'pageCap is a whole number from 1 to 100.');
    if (args.strict !== undefined && typeof args.strict !== 'boolean') throw new ToolCodeError('request.invalid', 'strict is true or false.');
    if (args.theme !== undefined && (typeof args.theme !== 'string' || !args.theme)) throw new ToolCodeError('request.invalid', 'theme is a theme name.');
    if (args.themes !== undefined && args.themes !== 'all' && !(Array.isArray(args.themes) && args.themes.length > 0 && args.themes.length <= 16 && args.themes.every((n) => typeof n === 'string' && n)))
      throw new ToolCodeError('request.invalid', 'themes is "all" or a list of theme names.');
    // On Vercel the file and the source arrive in one request body; a file alone is
    // held to its own cap when it is read.
    if (env.VERCEL && args.source !== undefined) {
      const carried = fileArgLength(args.file) + fileArgLength(args.source);
      if (carried > requestRoom(ctx))
        throw new ToolCodeError('source.too-large', `The file and the source come to ${carried} bytes of base64 and one request here carries ${requestRoom(ctx)}; pass the lolly_read inventory as inventory instead of the source deck.`);
    }

    const input = await inputOf(args, resolveDesign, ctx);
    const source = await sourceOf(args, ctx);
    const edits = editsOf(args);
    const kind = checkInputKind(input.name);
    const isDocument = kind === 'design' || kind === 'lolly';
    let manifest = input.manifest;
    if (isDocument && manifest === undefined && browser !== 'off') manifest = (await loadToolCached('design').catch(() => null))?.manifest;

    const result = await checkFile(input.bytes, input.name, {
      ...(isDocument || kind === 'pptx' ? profileDesignSystem() : {}),
      ...(typeof args.theme === 'string' ? { theme: args.theme } : {}),
      ...(args.themes !== undefined ? { themes: args.themes as string[] | 'all' } : {}),
      ...(source ? { source } : {}),
      ...(edits ? { edits } : {}),
      strict: args.strict === true,
      browser: browser as CheckFileOptionsV1['browser'],
      ...(typeof args.pageCap === 'number' ? { pageCap: args.pageCap } : {}),
      // No text recognition on an MCP server: the same answer on every machine.
      ocr: false,
      // Family reasons name this tool's arguments, never a CLI flag.
      surface: 'mcp',
      renderChecks: deps.renderChecks ?? (env.VERCEL ? noBrowser : localBrowser),
      ...(manifest !== undefined ? { designManifest: manifest } : {}),
    });

    const s = result.summary;
    const sentence =
      `${result.input.name ?? input.name}: ${result.outcome} (exit ${result.exitCode}). ` +
      `${plural(s.error, 'error')}, ${s.warn} to review, ${plural(s.info, 'note')}. ${familiesLine(result.families)}.`;
    return success<CheckToolCodeV1>(sentence, result as unknown as Record<string, unknown>, [], ctx, 'output.too-large', 'run lolly check on the CLI for this file.');
  } catch (err) {
    return failure(asCheckError(err));
  }
}
