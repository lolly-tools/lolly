// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly_package` (plan 291 W8): a Design document as a `.lolly` the app reopens as
 * the same document, pictures and name included, with a `DesignPackageReportV1`
 * (schemas/design-package-v1.schema.json). The work is `packageDesign`
 * (@lolly-tools/node-shell/design-lolly), the same function `lolly package` runs.
 *
 * THE INPUT is one of:
 *   document  a Design document (a boxes array, {boxes}, {values: {boxes}}, a saved
 *             session), authoring keys allowed; or a compiled document of any tool,
 *             as lolly_compile returns it, which keeps the zip this tool has always
 *             written and answers `{legacy: true, manifest}`.
 *   toolId    "design", with inputs, templateId, presetId, layerOperations and
 *             layerPatches exactly as lolly_validate and lolly_render take them.
 *
 * PICTURES travel inline: `assets` is a list of `{key, base64, name?, mime?}`, where
 * `key` is the exact `image` value rows name the picture by (`photo:title`, or an upload
 * ref `user/media/<sha256>` lolly_read reported). `source` is the deck (or a `.lolly`)
 * whose pictures resolve upload refs and the `photo:<sha12>` keys lolly_compose
 * suggests, so pictures lolly_read reported as facts need no second upload. On a hosted server every file shares one request body, and the
 * returned file one response.
 *
 * ERRORS carry a stable code (`PACKAGE_TOOL_CODES`); the call never throws.
 */

import { createHash } from 'node:crypto';
import { hasDesignAuthoring, hasDesignColourRefs, packageDocument } from '@lolly/engine';
import { DESIGN_PACKAGE_ERROR_CODES, type DesignPackageErrorCodeV1 } from '@lolly-tools/core';
import { safeFileName } from '@lolly-tools/core/file-v1';
import { DesignPackageError, designInputShape, packageDesign, type DesignPackageAssetV1, type DesignPackageHintsV1, type DesignPackageOptions } from '@lolly-tools/node-shell/design-lolly';
// Imported, not read from disk: the bundled Vercel function carries no schemas/ directory.
import reportSchema from '../../../schemas/design-package-v1.schema.json' with { type: 'json' };
import type { ContentBlock } from './protocol.ts';
import {
  BOOL,
  INT,
  STR,
  STRUCTURED_LIMITS,
  ToolCodeError,
  contractPart,
  errorOut,
  failure,
  fileArgLength,
  maxFileBytes,
  obj,
  plural,
  readFileArg,
  requestRoom,
  resourceUri,
  success,
  type Env,
  type Schema,
  type StructuredCtx,
  type StructuredLimitsV1,
  type StructuredResult,
} from './structured.ts';

/** Codes of this surface alone, beside the ones `packageDesign` throws. */
type McpOnlyCode = 'input.missing' | 'request.invalid' | 'asset.too-large' | 'output.too-large' | 'internal';

export type PackageToolCodeV1 = DesignPackageErrorCodeV1 | McpOnlyCode;

const MCP_ONLY: Record<McpOnlyCode, true> = {
  'input.missing': true,
  'request.invalid': true,
  'asset.too-large': true,
  'output.too-large': true,
  internal: true,
};
export const PACKAGE_TOOL_CODES: PackageToolCodeV1[] = [...DESIGN_PACKAGE_ERROR_CODES, ...(Object.keys(MCP_ONLY) as McpOnlyCode[])];

export type PackageLimitsV1 = StructuredLimitsV1;
export const PACKAGE_LIMITS: Readonly<PackageLimitsV1> = STRUCTURED_LIMITS;

/** What tools.ts lends this module: a Design source resolved the way lolly_validate resolves one. */
export type PackageDesignResolver = (args: Record<string, unknown>) => Promise<{ values: Record<string, unknown> }>;

/** The design-system pieces authoring text styles resolve in, from this server's profile. */
export type PackageBriefSource = (theme?: string) => Promise<unknown | null>;

/** The Design tool version this server's catalog carries. */
export type PackageToolVersion = () => Promise<string | undefined>;

type TokenSet = ReturnType<typeof import('@lolly/engine')['createTokenSet']>;

/** The design system's tokens, in the theme colour references are cached in (plan 291 W4). */
export type PackageTokenSource = (theme?: string) => Promise<TokenSet | null>;

export interface PackageDeps {
  brief?: PackageBriefSource;
  tokens?: PackageTokenSource;
  toolVersion?: PackageToolVersion;
}

const LOLLY_MIME = 'application/vnd.lolly+zip';

// ─── the tool definition ─────────────────────────────────────────────────────

const report = contractPart(reportSchema as Schema);

/** A compiled document of any tool, packaged as it always was. */
const LEGACY_OUT: Schema = obj({
  legacy: { const: true },
  manifest: { type: 'object', additionalProperties: true },
  bytes: INT,
  sha256: { type: 'string', pattern: '^[0-9a-f]{64}$' },
});

/** The structured result: the package report, the compiled-document answer, or an error. */
export const PACKAGE_OUTPUT_SCHEMA: Schema = {
  type: 'object',
  $defs: report.defs,
  oneOf: [report.root, LEGACY_OUT, errorOut(PACKAGE_TOOL_CODES)],
};

/** The schema fragments tools.ts shares, so this tool takes a Design source exactly as lolly_render takes one. */
export interface PackageSchemaParts {
  toolId: unknown;
  inputs: unknown;
  template: Record<string, unknown>;
  layerOperations: unknown;
  layerPatches: unknown;
}

export function packageToolDef(p: PackageSchemaParts) {
  return {
    name: 'lolly_package',
    description:
      'Package a Design document as a .lolly file the Lolly app reopens as the same document, with its pictures and its name. ' +
      'Give document (a boxes array, {boxes} or {values: {boxes}}; authoring keys such as $in, $style and $stack are expanded first) or toolId "design" with inputs. ' +
      'assets carries a picture for every layer whose image is its key (a placeholder such as photo:title, or user/media/<sha256>); source is the deck whose pictures resolve user/media refs and photo:<sha12> keys (as lolly_compose suggests them). ' +
      'Every other picture must be a catalog id of this server\'s profile; anything unresolved is refused unless allowMissingMedia. ' +
      'Returns the .lolly as a resource and a report of what was carried and read back. ' +
      'A compiled document of another tool, as lolly_compile returns it, is packaged as before and answers {legacy: true, manifest}.',
    inputSchema: {
      type: 'object',
      properties: {
        document: { type: ['object', 'array'], description: 'A Design document, or a compiled document as lolly_compile returns it.' },
        toolId: p.toolId,
        inputs: p.inputs,
        ...p.template,
        layerOperations: p.layerOperations,
        layerPatches: p.layerPatches,
        assets: {
          type: 'array',
          maxItems: 200,
          description: 'Pictures by the image value rows name them by.',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string', description: 'The exact image value of the layers that draw this picture, e.g. photo:title.' },
              base64: { type: 'string', description: 'The picture bytes, base64-encoded.' },
              name: { type: 'string', description: 'The file name, for messages.' },
              mime: { type: 'string', description: 'Ignored: the type is read from the bytes.' },
            },
            required: ['key', 'base64'],
            additionalProperties: false,
          },
        },
        source: {
          type: 'object',
          description: 'The deck (.pptx, .pdf, .psd) or .lolly whose pictures resolve user/media/<sha256> refs.',
          properties: { base64: STR, name: { type: 'string', description: 'The file name; its extension says what it is.' }, mime: STR },
          required: ['base64'],
          additionalProperties: false,
        },
        label: { type: 'string', description: 'The document name Projects and the editor show. Defaults to the session\'s own, else "Design".' },
        theme: { type: 'string', description: 'The token theme authoring text styles resolve in.' },
        allowMissingMedia: { ...BOOL, description: 'Write unresolved pictures as references instead of refusing.' },
      },
      additionalProperties: false,
    },
    outputSchema: PACKAGE_OUTPUT_SCHEMA,
  };
}

// ─── the call ────────────────────────────────────────────────────────────────

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const DESIGN_ARGS = ['toolId', 'inputs', 'templateId', 'presetId', 'motionTiming', 'layerOperations', 'layerPatches'] as const;
const KNOWN_ARGS = new Set<string>(['document', 'assets', 'source', 'label', 'theme', 'allowMissingMedia', ...DESIGN_ARGS]);

/** The refusal remedies in this tool's argument names; it has no folder argument. */
const MCP_HINTS: DesignPackageHintsV1 = {
  asset: 'give each placeholder a picture in assets as {key, base64}',
  upload: 'give the deck lolly_read read as source, or each picture in assets keyed by its user/media ref',
  allowMissing: 'set allowMissingMedia',
};

function asPackageError(err: unknown): ToolCodeError<PackageToolCodeV1> {
  if (err instanceof ToolCodeError) return err as ToolCodeError<PackageToolCodeV1>;
  if (err instanceof DesignPackageError) return new ToolCodeError(err.code, err.message);
  return new ToolCodeError('internal', err instanceof Error ? err.message : String(err));
}

/** The one Design input the call names. */
async function designOf(args: Record<string, unknown>, resolveDesign: PackageDesignResolver): Promise<unknown> {
  if (args.document !== undefined && args.toolId !== undefined) throw new ToolCodeError('request.invalid', 'Give document or toolId "design", not both.');
  const stray = DESIGN_ARGS.find((key) => key !== 'toolId' && args[key] !== undefined);
  if (stray && args.toolId === undefined) throw new ToolCodeError('request.invalid', `${stray} goes with toolId "design".`);
  if (args.toolId !== undefined) {
    if (args.toolId !== 'design') throw new ToolCodeError('input.unsupported', `lolly_package writes Design documents from toolId "design"; for another tool, pass the document lolly_compile returns.`);
    try {
      return { values: (await resolveDesign(args)).values };
    } catch (err) {
      throw new ToolCodeError('request.invalid', err instanceof Error ? err.message : String(err));
    }
  }
  if (args.document === undefined) throw new ToolCodeError('input.missing', 'Give document (a Design document or a compiled document) or toolId "design" with its inputs.');
  return args.document;
}

function assetsOf(args: Record<string, unknown>, ctx: StructuredCtx): DesignPackageAssetV1[] {
  if (args.assets === undefined) return [];
  if (!Array.isArray(args.assets)) throw new ToolCodeError('request.invalid', 'assets is a list of {key, base64, name?}.');
  return args.assets.map((value, i) => {
    if (!record(value) || typeof value.key !== 'string' || !value.key) throw new ToolCodeError('asset.invalid', `assets[${i}] needs a key: the image value the rows name the picture by.`);
    const file = readFileArg<PackageToolCodeV1>(value, {
      max: maxFileBytes(ctx),
      what: `assets[${i}] (${value.key})`,
      fallbackName: 'picture',
      missing: 'asset.invalid',
      tooLarge: 'asset.too-large',
      invalid: 'request.invalid',
      hint: 'Run lolly package on the CLI for large pictures.',
    });
    return { key: value.key, bytes: file.bytes, name: file.name };
  });
}

/** The profile's brief, for authoring text styles, when this server has a profile. */
const profileBrief: PackageBriefSource = async (theme) => {
  try {
    const { readProfileBriefCatalog, readProfileTokenDocument } = await import('@lolly-tools/node-shell/design-brief');
    const { designBrief } = await import('@lolly/engine');
    const tokens = readProfileTokenDocument();
    return tokens ? designBrief(tokens.doc, readProfileBriefCatalog(), theme ? { theme } : {}) : null;
  } catch {
    return null;
  }
};

/** The profile's tokens, so colour references are stored as literals plus links. */
const profileTokens: PackageTokenSource = async (theme) => {
  try {
    const { readProfileTokenDocument } = await import('@lolly-tools/node-shell/design-brief');
    const { createTokenSet } = await import('@lolly/engine');
    const tokens = readProfileTokenDocument();
    return tokens ? createTokenSet(tokens.doc, theme ? { theme } : {}) : null;
  } catch {
    return null;
  }
};

/**
 * True when the document's rows name a colour token (`{color.semantic.text}`, a
 * `{@path …|}` run), as a composed deck's may with no authoring key.
 */
function holdsColourRefs(doc: unknown): boolean {
  const rec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  let rows: unknown = Array.isArray(doc) ? doc : rec(doc) ? (rec(doc.values) ? doc.values.boxes : doc.boxes) : undefined;
  if (typeof rows === 'string') {
    try { rows = JSON.parse(rows); } catch { return false; }
  }
  return Array.isArray(rows) && hasDesignColourRefs(rows as Parameters<typeof hasDesignColourRefs>[0], ['bg', 'fg', 'stroke', 'shadowColor'], 'tokenLinks', false);
}

/** Package one document. Never throws: a failure is an error result with its code. */
export async function callPackage(
  args: Record<string, unknown>,
  resolveDesign: PackageDesignResolver,
  env: Env = process.env,
  limits: Readonly<PackageLimitsV1> = PACKAGE_LIMITS,
  deps: PackageDeps = {},
): Promise<StructuredResult> {
  const ctx: StructuredCtx = { env, limits };
  try {
    const extra = Object.keys(args).find((key) => !KNOWN_ARGS.has(key));
    if (extra) throw new ToolCodeError('request.invalid', `lolly_package does not take ${extra}.`);
    for (const key of ['label', 'theme'] as const)
      if (args[key] !== undefined && (typeof args[key] !== 'string' || !(args[key] as string).trim())) throw new ToolCodeError('request.invalid', `${key} is a non-empty string.`);
    if (args.allowMissingMedia !== undefined && typeof args.allowMissingMedia !== 'boolean') throw new ToolCodeError('request.invalid', 'allowMissingMedia is true or false.');

    const input = await designOf(args, resolveDesign);
    const shape = designInputShape(input);
    if (shape === 'compiled') {
      const designOnly = ['assets', 'source', 'label', 'theme', 'allowMissingMedia'].find((key) => args[key] !== undefined);
      if (designOnly) throw new ToolCodeError('request.invalid', `${designOnly} applies to a Design document; a compiled document is packaged as it is.`);
      let packed: Awaited<ReturnType<typeof packageDocument>>;
      try {
        packed = await packageDocument(input);
      } catch (err) {
        throw new ToolCodeError('input.unsupported', `The compiled document could not be packaged: ${err instanceof Error ? err.message : String(err)}`);
      }
      const sha256 = createHash('sha256').update(packed.bytes).digest('hex');
      const name = 'document.lolly';
      const structured = { legacy: true, manifest: packed.manifest, bytes: packed.bytes.byteLength, sha256 };
      const block: ContentBlock = { type: 'resource', resource: { uri: resourceUri('package', sha256, name), mimeType: LOLLY_MIME, blob: Buffer.from(packed.bytes).toString('base64') } };
      return success<PackageToolCodeV1>(`Packaged the compiled document as ${name} (${packed.bytes.byteLength} bytes).`, structured, [block], ctx, 'output.too-large', 'run lolly package on the CLI.');
    }
    if (shape !== 'design') throw new ToolCodeError('input.unsupported', 'document must be a Design document (a boxes array, {boxes} or {values: {boxes}}) or a compiled document as lolly_compile returns it.');

    // On Vercel every file arrives in one request body.
    if (env.VERCEL) {
      const carried = (Array.isArray(args.assets) ? args.assets.reduce((n: number, a) => n + fileArgLength(a), 0) : 0) + fileArgLength(args.source);
      if (carried > requestRoom(ctx))
        throw new ToolCodeError('asset.too-large', `The pictures and the source come to ${carried} bytes of base64 and one request here carries ${requestRoom(ctx)}; run lolly package on the CLI.`);
    }
    const assets = assetsOf(args, ctx);
    const options: DesignPackageOptions = {
      assets,
      ...(typeof args.label === 'string' ? { label: args.label } : {}),
      ...(typeof args.theme === 'string' ? { theme: args.theme } : {}),
      allowMissingMedia: args.allowMissingMedia === true,
      hints: MCP_HINTS,
    };
    if (args.source !== undefined) {
      const file = readFileArg<PackageToolCodeV1>(args.source, {
        max: maxFileBytes(ctx),
        what: 'source',
        fallbackName: 'source.pptx',
        missing: 'request.invalid',
        tooLarge: 'asset.too-large',
        invalid: 'request.invalid',
        hint: 'Pass the pictures as assets instead.',
      });
      options.source = { bytes: file.bytes, name: file.name };
    }
    // Text styles come from the profile's brief, read only when there is authoring to lower.
    if (hasDesignAuthoring(input)) {
      const brief = await (deps.brief ?? profileBrief)(typeof args.theme === 'string' ? args.theme : undefined);
      if (brief) options.brief = brief;
    }
    // Colour references are stored as the literal plus a link (plan 291 W4, E16), so an
    // older engine still paints them; the profile's tokens, in the theme asked for.
    if (hasDesignAuthoring(input) || holdsColourRefs(input)) {
      const tokens = await (deps.tokens ?? profileTokens)(typeof args.theme === 'string' ? args.theme : undefined);
      if (tokens) options.tokens = tokens;
    }
    if (deps.toolVersion) {
      const version = await deps.toolVersion();
      if (version) options.toolVersion = version;
    }

    const packed = await packageDesign(input, options);
    const name = `${safeFileName(packed.report.filename || packed.report.label, 'Design')}.lolly`;
    const result = { ...packed.report, next: ['lolly_check with file: the returned .lolly', 'lolly_render or the Lolly app to open it'] };
    const block: ContentBlock = { type: 'resource', resource: { uri: resourceUri('package', result.sha256, name), mimeType: LOLLY_MIME, blob: Buffer.from(packed.bytes).toString('base64') } };
    const sentence =
      `Packaged "${result.label}" as ${name}: ${plural(result.artboards, 'artboard')}, ${plural(result.layers, 'layer')}, ${plural(result.media.length, 'picture')} carried, ${result.bytes} bytes; read back clean.` +
      (result.warnings.length ? ` ${plural(result.warnings.length, 'note')}.` : '');
    return success<PackageToolCodeV1>(sentence, result as unknown as Record<string, unknown>, [block], ctx, 'output.too-large', 'run lolly package on the CLI for this document.');
  } catch (err) {
    return failure(asPackageError(err));
  }
}
