// SPDX-License-Identifier: MPL-2.0
/**
 * The pieces `lolly_read` and `lolly_check` share (plan 291 W1 and W2): the result
 * every structured tool returns, a coded error, the base64 file argument read under
 * the server's cap, and a contract schema made into a part of an output schema.
 *
 * The conventions are `lolly_rebrand`'s (rebrand.ts), and its exported limits are
 * reused here, so the three file tools refuse the same sizes with the same words:
 *
 *   - content[0] is one plain sentence, content[1] the structured result as JSON text
 *     (identical to `structuredContent`), then any embedded resources;
 *   - an error is `isError: true` with `structuredContent: {error: {code, message}}`;
 *   - on Vercel the serialised response is measured before it is returned, so an
 *     answer too large for the platform is refused with `output.too-large` instead of
 *     being replaced by the gateway with a plain error.
 *
 * Nothing in this module reads or checks a document: that work is in
 * `@lolly-tools/node-shell` (content-inventory.ts, check.ts), shared with the CLI.
 */

import { safeFileName } from '@lolly-tools/core/file-v1';
import type { ContentBlock, ToolCallResult } from './protocol.ts';
import {
  HOSTED_MAX_SLIDES,
  LOCAL_MAX_SLIDES,
  REQUEST_ENVELOPE_BYTES,
  VERCEL_BODY_MAX_BYTES,
  VERCEL_RESPONSE_MAX_BYTES,
  isHostedServer,
  maxInputBytesFor,
  responseBytes,
} from './rebrand.ts';

export type Env = Record<string, string | undefined>;
export type Schema = Record<string, unknown>;

export const INT = { type: 'integer', minimum: 0 } as const;
export const STR = { type: 'string' } as const;
export const BOOL = { type: 'boolean' } as const;

/** An object schema; every listed property is required unless `optional` lists the property. */
export function obj(properties: Record<string, Schema>, optional: readonly string[] = [], open = false): Schema {
  return {
    type: 'object',
    properties,
    required: Object.keys(properties).filter((key) => !optional.includes(key)),
    additionalProperties: open,
  };
}

/** The error variant every structured tool shares: a stable code from `codes` and a sentence. */
export function errorOut(codes: readonly string[]): Schema {
  return obj({ error: obj({ code: { enum: [...codes] }, message: STR }) });
}

/**
 * A contract schema (draft 2020-12, with `$defs`) as a part of an output schema: its
 * root without `$schema` and `$id`, and its `$defs` to place on the output schema's
 * root, where every `#/$defs/...` reference in it then resolves. The schema is
 * imported, never read from disk, so the bundled Vercel function carries the schema.
 */
export function contractPart(schema: Schema): { root: Schema; defs: Record<string, Schema> } {
  const { $schema: _schema, $id: _id, $defs, ...root } = schema as Schema & { $defs?: Record<string, Schema> };
  return { root, defs: { ...($defs ?? {}) } };
}

/** The numbers one call works to. A test lowers them to reach a cap with a small fixture. */
export interface StructuredLimitsV1 {
  hostedMaxSlides: number;
  localMaxSlides: number;
  /** JSON at or under this many bytes travels inside the structured result; larger as a resource. */
  inlineBytes: number;
  /** The request body the platform takes, on Vercel. */
  bodyMaxBytes: number;
  /** The serialised response this surface sends, on Vercel. */
  responseMaxBytes: number;
}

export const STRUCTURED_LIMITS: Readonly<StructuredLimitsV1> = Object.freeze({
  hostedMaxSlides: HOSTED_MAX_SLIDES,
  localMaxSlides: LOCAL_MAX_SLIDES,
  inlineBytes: 128 * 1024,
  bodyMaxBytes: VERCEL_BODY_MAX_BYTES,
  responseMaxBytes: VERCEL_RESPONSE_MAX_BYTES,
});

/** What every call reads: the environment and the limits. */
export interface StructuredCtx {
  env: Env;
  limits: Readonly<StructuredLimitsV1>;
}

/** The largest file one argument carries here: 24 MiB, or what fits one Vercel request as base64. */
export function maxFileBytes(ctx: StructuredCtx): number {
  return maxInputBytesFor({
    env: ctx.env,
    limits: {
      hostedMaxSlides: ctx.limits.hostedMaxSlides,
      localMaxSlides: ctx.limits.localMaxSlides,
      planInlineBytes: ctx.limits.inlineBytes,
      bodyMaxBytes: ctx.limits.bodyMaxBytes,
      responseMaxBytes: ctx.limits.responseMaxBytes,
    },
  });
}

/** Slides one call reads: fewer on a hosted server, where the function has 30 seconds. */
export function maxSlides(ctx: StructuredCtx): number {
  return isHostedServer(ctx.env) ? ctx.limits.hostedMaxSlides : ctx.limits.localMaxSlides;
}

/** Room left in one Vercel request for file arguments, after the envelope. */
export function requestRoom(ctx: StructuredCtx): number {
  return ctx.limits.bodyMaxBytes - REQUEST_ENVELOPE_BYTES;
}

/** A failure with a stable code, so a caller branches on `code`, never on the wording. */
export class ToolCodeError<C extends string = string> extends Error {
  readonly code: C;
  constructor(code: C, message: string) {
    super(message);
    this.name = 'ToolCodeError';
    this.code = code;
  }
}

/** One file as it arrived. */
export interface FileArg {
  bytes: Uint8Array;
  name: string;
  mime?: string;
  /** Length of the base64 text the file came as. */
  base64Length: number;
}

/** The decoded size the base64 text carries, estimated before anything is allocated. */
export function base64Bytes(base64: string): number {
  const compact = base64.replace(/\s/g, '');
  const padding = compact.endsWith('==') ? 2 : compact.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((compact.length * 3) / 4) - padding);
}

/** The base64 length of a file argument, or 0 when the argument is not one. */
export function fileArgLength(value: unknown): number {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 0;
  const base64 = (value as { base64?: unknown }).base64;
  return typeof base64 === 'string' ? base64.replace(/\s/g, '').length : 0;
}

/**
 * A `{base64, name?, mime?}` argument, refused before decoding when it is over `max`.
 * `what` is the argument in words, for the messages; `codes` are the caller's codes for
 * a missing argument, one over the cap, and one that is not base64.
 */
export function readFileArg<C extends string>(
  value: unknown,
  opts: { max: number; what: string; fallbackName: string; missing: C; tooLarge: C; invalid: C; hint?: string },
): FileArg {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ToolCodeError(opts.missing, `${opts.what} is required as {base64, name}.`);
  const file = value as { base64?: unknown; name?: unknown; mime?: unknown };
  if (typeof file.base64 !== 'string' || file.base64.length === 0)
    throw new ToolCodeError(opts.missing, `${opts.what}: base64 is required, the file bytes base64-encoded.`);
  const compact = file.base64.replace(/\s/g, '');
  const estimated = base64Bytes(compact);
  const hint = opts.hint ? ` ${opts.hint}` : '';
  if (estimated > opts.max)
    throw new ToolCodeError(opts.tooLarge, `${opts.what} is about ${estimated} bytes and this server reads files up to ${opts.max} bytes.${hint}`);
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(compact)) throw new ToolCodeError(opts.invalid, `${opts.what}: base64 is not base64.`);
  const bytes = Uint8Array.from(Buffer.from(compact, 'base64'));
  if (bytes.length > opts.max)
    throw new ToolCodeError(opts.tooLarge, `${opts.what} is ${bytes.length} bytes and this server reads files up to ${opts.max} bytes.${hint}`);
  const name = safeFileName(typeof file.name === 'string' && file.name.trim() ? file.name : opts.fallbackName, opts.fallbackName);
  return { bytes, name, ...(typeof file.mime === 'string' && file.mime ? { mime: file.mime } : {}), base64Length: compact.length };
}

/** The result every structured tool returns: content[0] a sentence, content[1] the JSON. */
export type StructuredResult = ToolCallResult & { structuredContent: Record<string, unknown> };

/**
 * A success result. On Vercel the serialised response is measured first, and one over
 * the limit throws `tooLarge` with `hint` added, so the caller hears why in words.
 */
export function success<C extends string>(
  sentence: string,
  structured: Record<string, unknown>,
  files: ContentBlock[],
  ctx: StructuredCtx,
  tooLarge: C,
  hint: string,
): StructuredResult {
  const result: StructuredResult = {
    content: [{ type: 'text', text: sentence }, { type: 'text', text: JSON.stringify(structured) }, ...files],
    structuredContent: structured,
  };
  if (ctx.env.VERCEL) {
    const size = responseBytes(result);
    if (size > ctx.limits.responseMaxBytes)
      throw new ToolCodeError(tooLarge, `The result comes to ${size} bytes and this server answers up to ${ctx.limits.responseMaxBytes} bytes; ${hint}`);
  }
  return result;
}

/** An error result: the code and sentence as text, and the same as `structuredContent.error`. */
export function failure(err: ToolCodeError): StructuredResult {
  return {
    content: [{ type: 'text', text: `${err.code}: ${err.message}` }],
    structuredContent: { error: { code: err.code, message: err.message } },
    isError: true,
  };
}

/** `lolly://<tool>/<first 12 hex of a sha256>/<path>`. */
export function resourceUri(tool: string, sha256: string, path: string): string {
  const hex = sha256.replace(/^sha256:/, '').slice(0, 12);
  return `lolly://${tool}/${hex}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

/** `n thing` or `n things`. */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
