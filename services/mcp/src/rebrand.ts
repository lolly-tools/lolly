// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly_rebrand`: renovate a deck (a PowerPoint file or a PDF, told apart by its
 * bytes) into the design system this server
 * is set up with (plan 274 sections 2.3 and 5, work package 9, and the hosted
 * half of milestone 6).
 *
 * One tool with explicit stages over the same node pipeline `lolly rebrand` runs
 * (`@lolly-tools/node-shell/rebrand`), so a plan made here compiles on the CLI and
 * the other way round, as long as both read the same content profile:
 *
 *   capabilities  what this server can do, its limits, and where the bytes go.
 *   plan          read the deck, take the census, run the first pass, and return
 *                 the review queue, the counts, the outcome and the plan itself.
 *   compile       compile a plan (edited or not) for the same bytes into a Design
 *                 document (.lolly) and, with `export: "pptx"`, a native .pptx.
 *   inspect       page through a plan: the queue and the slides, or one slide's
 *                 objects, so a large plan never has to come back whole.
 *
 * WHERE THE BYTES GO. A local server (stdio, or the HTTP server on a developer
 * machine) is a process on the machine that holds the file. A hosted server is
 * the one the gateway treats as hosted (`VERCEL`, `LOLLY_MCP_HOSTED=1` or
 * `NODE_ENV=production`, the test `publicOrigin` in gateway.ts applies), or one
 * whose public origin is not a loopback address: calling it transfers the file
 * there, and the capabilities stage says so in words. On both, the deck is held
 * in memory for the call and nothing is written. The HTTP server listens on
 * every interface, so a local server's sentence says the file stays on the
 * machine the server runs on, which is the caller's only when the client runs
 * there too.
 *
 * PDF AND OCR. A PDF is read by the same pipeline as a pptx (`readDeck` chooses
 * the reader by the bytes). The MCP host runs with `aiEnabled: false`, so no
 * text recognition runs here and `ocr` is false on every server this module runs
 * on, hosted or local: a slide that is one picture of a slide (a scanned PDF page,
 * say) keeps the picture, its OCR state reads `unavailable`, and the plan and
 * compile results carry a `flattened` entry that says so in words. A plan made
 * elsewhere with text recognition (`lolly rebrand plan --ocr`) names objects this
 * server cannot read again, so compile and inspect refuse it with
 * `ocr.unavailable`; a plan that kept or rebuilt those slides without OCR reads
 * the same way here.
 *
 * LARGE RESULTS. A plan under `PLAN_INLINE_MAX_BYTES` travels inside the
 * structured result; a larger one travels as an embedded JSON resource, the way
 * `lolly_transform` returns its bytes. Plan 272 replaces base64 in both
 * directions with handles; `deliverPlan` and `readFileArg` are the two places a
 * handle store plugs in. On Vercel the platform refuses bodies over 4.5 MB, so a
 * response whose serialised JSON-RPC body is over `VERCEL_RESPONSE_MAX_BYTES`
 * is refused with `output.too-large` rather than cut off, and a plan whose
 * compile request (the file and the plan together) would not fit one request is
 * refused at the plan stage with `source.too-large`.
 *
 * ERRORS carry a stable code: the contract's `REBRAND_ERROR_CODES`, the
 * pipeline's own additions (`RebrandFailureCodeV1`), the preset codes the CLI
 * also uses (`preset.unknown`, `preset.invalid`), the CLI's `source.missing`
 * and `plan.missing`, and four of this surface alone: `request.invalid` (an
 * argument of the wrong kind), `design-system.missing` (no content profile
 * resolves on this server), `output.too-large` (the result does not fit a
 * response here) and `internal` (a bug in Lolly).
 */

import {
  AUTO_MATCH_BANDS,
  QUEUE_SECTIONS,
  REVIEW_FIDELITIES,
  effectiveAction,
  objectStates,
  planSummary,
  reviewFidelity,
  reviewQueue,
  slideStates,
  type AutoMatchBandsV1,
  type QueueItemV1,
  type RenovationPresetV1,
  type ReviewFidelityV1,
} from '@lolly/engine';
import {
  OBJECT_CLASSES,
  PLAN_ACTIONS,
  REBRAND_ERROR_CODES,
  REVIEW_STATES,
  type DeckCensusV1,
  type EvidenceV1,
  type RebrandCapabilitiesV1,
  type RebrandReportV1,
  type RenovationPlanV1,
  type SourceDeckV1,
} from '@lolly-tools/core';
import { safeFileName } from '@lolly-tools/core/file-v1';
import {
  RebrandPipelineError,
  RebrandPresetError,
  buildDesignLolly,
  catalogAssetBytes,
  compileDeck,
  compiledDeckToPptx,
  designSessionFromCompiled,
  isPresetFileSpec,
  flattenedReadOfPlan,
  outcomeCounts,
  outcomeOf,
  planDeck,
  planProblems,
  planSourceProblems,
  presetProblems,
  readDeck,
  resolvePipelineSystem,
  resolvePreset,
  resolveProfileDesignSystem,
  sourceHashOf,
  toRenovationPreset,
  type AcceptScopeV1,
  type FlattenedSlideReportV1,
  type OutcomeCountsV1,
  type ReadDeckInputV1,
  type PresetEntryV1,
  type PresetErrorCodeV1,
  type RebrandFailureCodeV1,
  type RebrandResolvedSystem,
  type RebrandXmlParserV1,
} from '@lolly-tools/node-shell/rebrand';
import { readLollyFile } from '@lolly-tools/node-shell/lolly-file';
// Imported, not read from disk, so the bundled Vercel function checks a plan
// against the full schema too: the function carries no schemas/ directory.
import planSchema from '../../../schemas/rebrand-plan-v1.schema.json' with { type: 'json' };
import type { ContentBlock, ToolCallResult } from './protocol.ts';
import { MAX_TRANSFORM_INPUT_BYTES } from './render.ts';
import { loadToolCached } from './catalog.ts';

// ─── limits ──────────────────────────────────────────────────────────────────

/** The stages, in the order an agent meets them. */
export const REBRAND_STAGES = ['capabilities', 'plan', 'compile', 'inspect'] as const;
export type RebrandStageV1 = (typeof REBRAND_STAGES)[number];

/** Slides a hosted server renovates in one call. A policy of this surface, not of the reader. */
export const HOSTED_MAX_SLIDES = 200;
/**
 * Slides a local server renovates: one under the 2000 that `pptx-read` stops
 * reading at, so a deck the reader cut short is over this cap and refused.
 */
export const LOCAL_MAX_SLIDES = 1999;
/** A plan at or under this many bytes of JSON travels inside the structured result. */
export const PLAN_INLINE_MAX_BYTES = 128 * 1024;
/** Vercel refuses request and response bodies over 4.5 MB. */
export const VERCEL_BODY_MAX_BYTES = 4_500_000;
/** The serialised JSON-RPC response a Vercel call may send, leaving room for the id and the headers. */
export const VERCEL_RESPONSE_MAX_BYTES = 4_000_000;
/** Room a request keeps for the JSON-RPC envelope and the small arguments around the file and the plan. */
export const REQUEST_ENVELOPE_BYTES = 16 * 1024;
/** Queue items the plan stage lists; `inspect` pages through the rest. */
export const PLAN_QUEUE_SHOWN = 50;
/** Object ids one queue item lists; `objects` always has the full count. */
const QUEUE_ITEM_IDS_SHOWN = 50;
const INSPECT_DEFAULT_LIMIT = 20;
const INSPECT_MAX_LIMIT = 100;

const LOLLY_MIME = 'application/vnd.lolly+zip';
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

type Env = Record<string, string | undefined>;

/**
 * The numbers one call works to. The defaults are the constants above; a test
 * lowers them to reach a cap with a small fixture.
 */
export interface RebrandLimitsV1 {
  hostedMaxSlides: number;
  localMaxSlides: number;
  planInlineBytes: number;
  /** The request body the platform takes, on Vercel. */
  bodyMaxBytes: number;
  /** The serialised response this surface sends, on Vercel. */
  responseMaxBytes: number;
}

export const REBRAND_LIMITS: Readonly<RebrandLimitsV1> = Object.freeze({
  hostedMaxSlides: HOSTED_MAX_SLIDES,
  localMaxSlides: LOCAL_MAX_SLIDES,
  planInlineBytes: PLAN_INLINE_MAX_BYTES,
  bodyMaxBytes: VERCEL_BODY_MAX_BYTES,
  responseMaxBytes: VERCEL_RESPONSE_MAX_BYTES,
});

/** What every stage reads: the environment and the limits. */
export interface RebrandCtx {
  env: Env;
  limits: Readonly<RebrandLimitsV1>;
}

/**
 * Hosted or local. The gateway's own test for a hosted deployment (gateway.ts
 * `publicOrigin`), plus one case it does not need: a server whose public origin
 * is not a loopback address is reachable from other machines, so a file sent to
 * it leaves the machine it came from even when none of those flags is set.
 */
export function isHostedServer(env: Env = process.env): boolean {
  if (env.VERCEL || env.LOLLY_MCP_HOSTED === '1' || env.NODE_ENV === 'production') return true;
  const origin = env.LOLLY_MCP_PUBLIC_ORIGIN?.trim();
  if (!origin) return false;
  try {
    const host = new URL(origin).hostname;
    return !(host === 'localhost' || host === '127.0.0.1' || host === '[::1]');
  } catch {
    return false;
  }
}

function maxSlidesFor(ctx: RebrandCtx): number {
  return isHostedServer(ctx.env) ? ctx.limits.hostedMaxSlides : ctx.limits.localMaxSlides;
}

/** Bytes of base64 that carry `bytes` bytes. */
function base64Length(bytes: number): number {
  return Math.ceil(bytes / 3) * 4;
}

/**
 * The largest deck one call takes. On Vercel that is the file whose base64
 * still fits one request beside the envelope, well under the 24 MiB the reader
 * takes elsewhere.
 */
export function maxInputBytesFor(ctx: RebrandCtx): number {
  if (!ctx.env.VERCEL) return MAX_TRANSFORM_INPUT_BYTES;
  return Math.min(MAX_TRANSFORM_INPUT_BYTES, Math.floor(((ctx.limits.bodyMaxBytes - REQUEST_ENVELOPE_BYTES) * 3) / 4));
}

/** Binary megabytes, the unit the reader cap is written in. */
function mebibytes(bytes: number): string {
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MiB`;
}

/** Decimal megabytes, the unit the platform body limit is published in. */
function megabytes(bytes: number): string {
  return `${Math.round(bytes / 100_000) / 10} MB`;
}

// ─── errors ──────────────────────────────────────────────────────────────────

/** Codes of this surface alone, beside the contract's and the pipeline's. */
type McpOnlyCode = 'source.missing' | 'plan.missing' | 'request.invalid' | 'design-system.missing' | 'output.too-large' | 'internal';

/** Every code a `lolly_rebrand` error can carry: the pipeline's, the preset reader's and this surface's. */
export type RebrandToolCodeV1 = RebrandFailureCodeV1 | PresetErrorCodeV1 | McpOnlyCode;

/**
 * Every code, as a `Record` over the whole union, so a code the contract or the
 * pipeline adds fails the typecheck here until the output schema lists it.
 */
const CODES: Record<RebrandToolCodeV1, true> = {
  'source.unreadable': true,
  'source.too-large': true,
  'source.encrypted': true,
  'plan.hash-mismatch': true,
  'plan.revision-stale': true,
  'plan.invalid': true,
  'design-system.master-missing': true,
  'design-system.logo-missing': true,
  'ocr.unavailable': true,
  'compile.unresolved-objects': true,
  'export.failed': true,
  'storage.quota': true,
  'source.unsupported': true,
  'plan.design-system-mismatch': true,
  'design-system.unreadable': true,
  'preset.unknown': true,
  'preset.invalid': true,
  'preset.unreadable': true,
  'source.missing': true,
  'plan.missing': true,
  'request.invalid': true,
  'design-system.missing': true,
  'output.too-large': true,
  internal: true,
};

/** The codes in the output schema: the contract's first, in its order, then the rest. */
export const REBRAND_TOOL_CODES: readonly RebrandToolCodeV1[] = [
  ...REBRAND_ERROR_CODES,
  ...(Object.keys(CODES) as RebrandToolCodeV1[]).filter((code) => !(REBRAND_ERROR_CODES as readonly string[]).includes(code)),
];

/** A failure with its stable code, so a caller branches on `code`, never on the wording. */
export class RebrandToolError extends Error {
  readonly code: RebrandToolCodeV1;
  constructor(code: RebrandToolCodeV1, message: string) {
    super(message);
    this.name = 'RebrandToolError';
    this.code = code;
  }
}

function isToolCode(code: string): code is RebrandToolCodeV1 {
  return Object.hasOwn(CODES, code);
}

function asToolError(err: unknown, fallback: RebrandToolCodeV1): RebrandToolError {
  if (err instanceof RebrandToolError) return err;
  const message = err instanceof Error ? err.message : String(err);
  if ((err instanceof RebrandPipelineError || err instanceof RebrandPresetError) && isToolCode(err.code)) return new RebrandToolError(err.code, message);
  return new RebrandToolError(fallback, message);
}

// ─── the tool definition ─────────────────────────────────────────────────────

const INT = { type: 'integer', minimum: 0 } as const;
const STR = { type: 'string' } as const;
const BOOL = { type: 'boolean' } as const;
const STRINGS = { type: 'array', items: STR } as const;

type Schema = Record<string, unknown>;

/** An object schema; every listed property required unless `optional` names it. */
function obj(properties: Record<string, Schema>, optional: readonly string[] = [], open = false): Schema {
  return {
    type: 'object',
    properties,
    required: Object.keys(properties).filter((key) => !optional.includes(key)),
    additionalProperties: open,
  };
}

function page(items: Schema): Schema {
  return obj({ total: INT, page: { type: 'integer', minimum: 1 }, limit: { type: 'integer', minimum: 1 }, items: { type: 'array', items } });
}

const OUTCOME = { enum: ['ready', 'needs-review'] } as const;
const FIDELITY = { enum: [...REVIEW_FIDELITIES] } as const;

const SOURCE_FACTS = obj({ name: STR, hash: STR, bytes: INT, slides: INT });
const SYSTEM_FACTS = obj({
  profile: STR,
  id: STR,
  masterId: { type: ['string', 'null'] },
  neutralMaster: BOOL,
  tokenHash: STR,
  presetId: STR,
  presetVersion: STR,
  notes: STRINGS,
}, ['presetId', 'presetVersion']);
// The engine owns these two shapes and may add counts, so they stay open.
const SUMMARY = obj({
  slides: obj({ total: INT, included: INT }, [], true),
  objects: obj({ keep: INT, replace: INT, remove: INT, unresolved: INT }, [], true),
  review: obj({ attention: INT, unreviewed: INT, accepted: INT }, [], true),
  colours: obj({ assigned: INT, unresolved: INT, locked: INT }, [], true),
  fonts: obj({ substituted: INT }, [], true),
  flattened: INT,
}, [], true);
const WAITING = obj({ pending: INT, attention: INT, unresolvedObjects: INT, unresolvedColours: INT, tray: INT }, [], true);
const REPORT_COUNTS = { type: 'object', additionalProperties: true } as const;
const FLATTENED = obj({ slides: INT, rebuilt: INT, kept: INT, ocr: BOOL, note: STR });
const PLAN_DELIVERY = obj({ mode: { enum: ['inline', 'resource'] }, bytes: INT, revision: INT, uri: STR }, ['uri']);
const QUEUE_ITEM = obj({
  id: STR,
  section: { enum: [...QUEUE_SECTIONS] },
  class: { enum: [...OBJECT_CLASSES] },
  action: { enum: [...PLAN_ACTIONS] },
  proposal: { enum: [...PLAN_ACTIONS] },
  review: { enum: [...REVIEW_STATES] },
  fidelity: FIDELITY,
  title: STR,
  titleCode: STR,
  evidence: STR,
  evidenceCode: STR,
  slideNumbers: { type: 'array', items: { type: 'integer', minimum: 1 } },
  objects: INT,
  objectIds: STRINGS,
  type: { enum: ['layout-group', 'diagram'] },
  slideIds: STRINGS,
  layout: obj({ structure: STR, band: { enum: ['clear', 'likely', 'none'] }, archetype: STR }),
}, ['type', 'slideIds', 'layout']);
/** Slides Auto-match set, per band of the read, and in all. */
const AUTO_MATCHED = obj({ bands: { enum: [...AUTO_MATCH_BANDS] }, clear: INT, likely: INT, none: INT, total: INT });
const SLIDE_ROW = {
  type: 'object',
  properties: { id: STR, number: { type: 'integer', minimum: 1 }, include: BOOL, layout: STR },
  required: ['id', 'number', 'include', 'layout'],
  additionalProperties: true,
} as const;
const OBJECT_ROW = obj({
  id: STR,
  kind: { type: ['string', 'null'] },
  class: { enum: [...OBJECT_CLASSES] },
  action: { enum: [...PLAN_ACTIONS] },
  proposal: { enum: [...PLAN_ACTIONS] },
  decision: { enum: [...PLAN_ACTIONS] },
  review: { enum: [...REVIEW_STATES] },
  fidelity: { anyOf: [FIDELITY, { type: 'null' }] },
  author: STR,
  role: STR,
  locked: BOOL,
  evidence: STR,
  signal: { type: ['string', 'null'] },
}, ['decision', 'author', 'role']);
const OUTPUT_FILE = obj({ kind: { enum: ['lolly', 'pptx', 'report', 'plan'] }, name: STR, mimeType: STR, bytes: INT, uri: STR });

const CAPABILITIES_OUT = obj({
  stage: { const: 'capabilities' },
  surface: { enum: ['mcp-local', 'mcp-hosted'] },
  bytes: { enum: ['local-process', 'configured-server'] },
  hosted: BOOL,
  ocr: BOOL,
  ocrNote: STR,
  rasterFallback: BOOL,
  rasterNote: STR,
  nativePptx: BOOL,
  designDocument: BOOL,
  formats: STRINGS,
  notYetRead: { type: 'array', items: obj({ format: STR, note: STR }) },
  maxInputBytes: INT,
  maxSlides: INT,
  limits: obj({
    maxBytes: INT,
    maxSlides: INT,
    planInlineBytes: INT,
    maxRequestBytes: INT,
    maxResponseBytes: INT,
  }, ['maxRequestBytes', 'maxResponseBytes']),
  retention: STR,
  transfer: STR,
  planHandles: BOOL,
  designSystem: { anyOf: [SYSTEM_FACTS, { type: 'null' }] },
  note: STR,
}, ['note']);

const PLAN_OUT = obj({
  stage: { const: 'plan' },
  source: SOURCE_FACTS,
  designSystem: SYSTEM_FACTS,
  outcome: OUTCOME,
  waiting: WAITING,
  summary: SUMMARY,
  queue: obj({ total: INT, shown: INT, items: { type: 'array', items: QUEUE_ITEM } }),
  report: REPORT_COUNTS,
  planDelivery: PLAN_DELIVERY,
  plan: { type: 'object' },
  flattened: FLATTENED,
  autoMatched: AUTO_MATCHED,
}, ['plan', 'flattened', 'autoMatched']);

const COMPILE_OUT = obj({
  stage: { const: 'compile' },
  source: SOURCE_FACTS,
  designSystem: SYSTEM_FACTS,
  outcome: OUTCOME,
  waiting: WAITING,
  summary: SUMMARY,
  report: REPORT_COUNTS,
  planRevision: INT,
  acceptSuggestions: { enum: ['none', 'unreviewed', 'all'] },
  appliedUnreviewed: INT,
  outputs: { type: 'array', items: OUTPUT_FILE },
  answeredPlanDelivery: PLAN_DELIVERY,
  answeredPlan: { type: 'object' },
  exportNotes: STRINGS,
  flattened: FLATTENED,
  autoMatched: AUTO_MATCHED,
}, ['answeredPlanDelivery', 'answeredPlan', 'flattened', 'autoMatched']);

const INSPECT_OUT = obj({
  stage: { const: 'inspect' },
  fidelityKnown: BOOL,
  source: SOURCE_FACTS,
  planRevision: INT,
  summary: SUMMARY,
  queue: page(QUEUE_ITEM),
  slides: page(SLIDE_ROW),
  slide: SLIDE_ROW,
  objects: page(OBJECT_ROW),
  note: STR,
}, ['source', 'summary', 'queue', 'slides', 'slide', 'objects', 'note']);

const ERROR_OUT = obj({
  stage: STR,
  error: obj({ code: { enum: [...REBRAND_TOOL_CODES] }, message: STR }),
});

/** The structured result of every stage, success or error, one variant each. */
export const REBRAND_OUTPUT_SCHEMA: Schema = {
  type: 'object',
  properties: { stage: STR },
  required: ['stage'],
  oneOf: [CAPABILITIES_OUT, PLAN_OUT, COMPILE_OUT, INSPECT_OUT, ERROR_OUT],
};

const FILE_ARG = {
  type: 'object',
  description: 'The deck: a .pptx or a PDF.',
  properties: {
    base64: { type: 'string', description: 'The file bytes, base64-encoded.' },
    name: { type: 'string', description: 'The file name, e.g. quarterly.pptx or quarterly.pdf.' },
    mime: { type: 'string', description: 'The MIME type, if known.' },
  },
  required: ['base64'],
  additionalProperties: false,
};

const PLAN_ARG = {
  description: 'A renovation plan the plan stage returned, edited or not, as an object or a JSON string.',
  anyOf: [{ type: 'object' }, { type: 'string' }],
};

export const REBRAND_TOOL_DEF = {
  name: 'lolly_rebrand',
  description:
    `Renovate a deck (a .pptx or a PDF, up to ${mebibytes(MAX_TRANSFORM_INPUT_BYTES)}) into the design system this server is set up with, in four stages: ` +
    'capabilities says what this server can do and where the file goes, plan returns the review queue and an editable plan, ' +
    'compile turns a plan for the same file into a Design document (.lolly) and optionally a .pptx, and inspect pages through a plan one slide at a time.',
  inputSchema: {
    type: 'object',
    properties: {
      stage: { type: 'string', enum: [...REBRAND_STAGES], description: 'Which stage to run. Start with capabilities on a server you have not used.' },
      file: FILE_ARG,
      plan: PLAN_ARG,
      preset: {
        anyOf: [{ type: 'string' }, { type: 'object', additionalProperties: true }],
        description: 'plan: the id of a renovation preset this server holds, or a preset object, whose default decisions shape the first pass.',
      },
      seed: { type: 'integer', description: 'plan: the seed for the colour solve, so two runs agree.' },
      acceptSuggestions: {
        type: 'string',
        enum: ['unreviewed', 'all'],
        description: 'compile: answer the open suggestions first; unreviewed leaves rows flagged for a person as they are, all answers those too.',
      },
      autoMatch: {
        type: 'string',
        enum: [...AUTO_MATCH_BANDS],
        description: 'plan and compile: set each slide to the layout its arrangement reads as. clear takes only the sure reads, likely adds the fairly sure ones, all takes every read. Off when left out; a layout a person or a preset chose is never changed.',
      },
      export: { type: 'string', enum: ['lolly', 'pptx'], description: 'compile: the Design document (.lolly) always comes back; pptx adds a native PowerPoint file.' },
      slide: { type: 'integer', minimum: 1, description: 'inspect: the 1-based slide whose objects to list.' },
      page: { type: 'integer', minimum: 1, description: 'inspect: the page to show, from 1.' },
      limit: { type: 'integer', minimum: 1, maximum: INSPECT_MAX_LIMIT, description: `inspect: rows per page, ${INSPECT_DEFAULT_LIMIT} by default.` },
    },
    required: ['stage'],
    additionalProperties: false,
  },
  outputSchema: REBRAND_OUTPUT_SCHEMA,
};

// ─── shared pieces ───────────────────────────────────────────────────────────

let parser: RebrandXmlParserV1 | null = null;

/** jsdom's DOMParser, made once per process. The pipeline needs no DOM globals. */
async function xmlParser(): Promise<RebrandXmlParserV1> {
  if (parser) return parser;
  const { JSDOM } = await import('jsdom');
  const domParser = new new JSDOM('').window.DOMParser();
  parser = (xml: string): Document => domParser.parseFromString(xml, 'application/xml');
  return parser;
}

let systemPromise: Promise<RebrandResolvedSystem> | null = null;

/** The design system of the content profile this process resolved, read once; a failure is not kept. */
async function designSystem(): Promise<RebrandResolvedSystem> {
  systemPromise ??= resolveProfileDesignSystem().then((resolved) => {
    if (!resolved) throw new RebrandToolError('design-system.missing', 'No content profile resolves on this server, so there is no design system to renovate against.');
    return resolved;
  });
  try {
    return await systemPromise;
  } catch (err) {
    systemPromise = null;
    throw asToolError(err, 'design-system.unreadable');
  }
}

function systemFacts(resolved: RebrandResolvedSystem): Record<string, unknown> {
  const snapshot = resolved.system.snapshot;
  return {
    profile: resolved.profile,
    id: snapshot.id,
    masterId: snapshot.masterId ?? null,
    neutralMaster: resolved.neutralMaster,
    tokenHash: snapshot.tokenHash,
    ...(snapshot.presetId !== undefined ? { presetId: snapshot.presetId } : {}),
    ...(snapshot.presetVersion !== undefined ? { presetVersion: snapshot.presetVersion } : {}),
    notes: resolved.notes,
  };
}

/**
 * The design system with the preset recorded on its snapshot, the way the CLI's
 * `presetSystem` does it, so a plan made here names the preset where the same
 * plan made on the CLI does. The token hash and the master do not move, so the
 * plan still fits the system a later compile resolves without the preset.
 */
async function withPreset(resolved: RebrandResolvedSystem, preset: RenovationPresetV1 | undefined): Promise<RebrandResolvedSystem> {
  if (!preset) return resolved;
  const input = { ...resolved.input, preset: { id: preset.id, ...(preset.version !== undefined ? { version: preset.version } : {}) } };
  return { ...resolved, input, system: await resolvePipelineSystem(input) };
}

/** One deck as it arrived. */
interface DeckFile {
  bytes: Uint8Array;
  name: string;
  stem: string;
}

function stemOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

/**
 * The deck from its base64 argument, refused before decoding when it is over the
 * cap. The one place a file handle (plan 272) will be read instead.
 */
function readFileArg(value: unknown, ctx: RebrandCtx): DeckFile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RebrandToolError('source.missing', 'This stage needs file: {base64, name} holding the .pptx deck.');
  }
  const file = value as { base64?: unknown; name?: unknown };
  if (typeof file.base64 !== 'string' || file.base64.length === 0) {
    throw new RebrandToolError('source.missing', 'file.base64 is required: the deck bytes (a .pptx or a PDF), base64-encoded.');
  }
  const compact = file.base64.replace(/\s/g, '');
  const padding = compact.endsWith('==') ? 2 : compact.endsWith('=') ? 1 : 0;
  const estimated = Math.max(0, Math.floor((compact.length * 3) / 4) - padding);
  const max = maxInputBytesFor(ctx);
  if (estimated > max) {
    throw new RebrandToolError('source.too-large', `The file is about ${estimated} bytes and this server reads decks up to ${max} bytes; run lolly rebrand on the CLI for this deck.`);
  }
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(compact)) {
    throw new RebrandToolError('request.invalid', 'file.base64 is not base64.');
  }
  const bytes = Uint8Array.from(Buffer.from(compact, 'base64'));
  if (bytes.length > max) {
    throw new RebrandToolError('source.too-large', `The file is ${bytes.length} bytes and this server reads decks up to ${max} bytes.`);
  }
  const name = safeFileName(typeof file.name === 'string' ? file.name : 'deck.pptx', 'deck.pptx');
  return { bytes, name, stem: stemOf(name) };
}

type SchemaCheck = (doc: unknown) => string[];
let schemaCheck: Promise<SchemaCheck> | null = null;

/**
 * The plan schema, compiled once from the imported copy. `planProblems` reads
 * the schema from the checkout and falls back to a few structural checks where
 * there is none, which is every Vercel deployment; this check does not depend on
 * the file being there, so a malformed row is refused as `plan.invalid` on every
 * server rather than reaching the engine.
 */
async function planSchemaProblems(doc: unknown): Promise<string[]> {
  schemaCheck ??= (async (): Promise<SchemaCheck> => {
    const { default: Ajv2020 } = await import('ajv/dist/2020.js');
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(planSchema);
    return (value: unknown): string[] => (validate(value) ? [] : (validate.errors ?? []).map((error) => `${error.instancePath || '/'} ${error.message ?? 'is not valid'}`));
  })();
  return (await schemaCheck)(doc);
}

async function readPlanArg(value: unknown): Promise<RenovationPlanV1> {
  if (value === undefined || value === null) {
    throw new RebrandToolError('plan.missing', 'This stage needs plan: the plan the plan stage returned, edited or not.');
  }
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch (err) {
      throw new RebrandToolError('plan.invalid', `The plan is not JSON: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  const schema = await planSchemaProblems(parsed);
  const problems = schema.length > 0 ? schema : await planProblems(parsed);
  if (problems.length > 0) {
    const shown = problems.slice(0, 5).join('; ');
    throw new RebrandToolError('plan.invalid', `The plan is not a renovation plan: ${shown}${problems.length > 5 ? `; and ${problems.length - 5} more` : ''}.`);
  }
  const plan = parsed as RenovationPlanV1;
  if (plan.mode !== 'renovate') {
    throw new RebrandToolError('plan.invalid', `The plan is a "${plan.mode}" plan; only a renovate plan compiles into a Design document.`);
  }
  return plan;
}

/**
 * The preset the caller names, checked the way the CLI checks one: an id is
 * resolved among the presets this server holds (`resolvePreset`), an object is
 * validated (`presetProblems`), and either way only the fields the engine reads
 * travel on (`toRenovationPreset`). A file path is refused, because the file
 * would be read from this server's disk, not the caller's.
 */
function readPreset(value: unknown): RenovationPresetV1 | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') {
    if (isPresetFileSpec(value)) {
      throw new RebrandToolError('preset.unknown', `preset names a file (${value}); here a preset is the id of one this server holds, or a preset object.`);
    }
    try {
      return resolvePreset(value).preset;
    } catch (err) {
      throw asToolError(err, 'preset.unknown');
    }
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new RebrandToolError('request.invalid', `preset takes a preset id or a preset object, not ${JSON.stringify(value)}.`);
  }
  const problems = presetProblems(value);
  if (problems.length > 0) {
    const shown = problems.slice(0, 5).join('; ');
    throw new RebrandToolError('preset.invalid', `preset is not a renovation preset: ${shown}${problems.length > 5 ? `; and ${problems.length - 5} more` : ''}.`);
  }
  return toRenovationPreset(value as PresetEntryV1);
}

function readSeed(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new RebrandToolError('request.invalid', `seed takes a whole number, not ${JSON.stringify(value)}.`);
  }
  return value;
}

function readWhole(value: unknown, what: string, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > max) {
    throw new RebrandToolError('request.invalid', `${what} takes a whole number from 1 to ${max}, not ${JSON.stringify(value)}.`);
  }
  return value;
}

function readAcceptScope(value: unknown): AcceptScopeV1 | null {
  if (value === undefined || value === null) return null;
  if (value === 'unreviewed' || value === 'all') return value;
  throw new RebrandToolError('request.invalid', `acceptSuggestions takes "unreviewed" or "all", not ${JSON.stringify(value)}.`);
}

function readAutoMatch(value: unknown): AutoMatchBandsV1 | null {
  if (value === undefined || value === null) return null;
  const band = AUTO_MATCH_BANDS.find((one) => one === value);
  if (band) return band;
  throw new RebrandToolError('request.invalid', `autoMatch takes "clear", "likely" or "all", not ${JSON.stringify(value)}.`);
}

/** Slides Auto-match set in this plan, per band: one per `layout.auto-matched` entry in the report, counted from those entries. */
function autoMatchedCounts(report: RebrandReportV1): { clear: number; likely: number; none: number; total: number } {
  const out = { clear: 0, likely: 0, none: 0, total: 0 };
  for (const entry of report.entries) {
    if (entry.code !== 'layout.auto-matched') continue;
    const band = (entry.reason ?? '').split(':').pop();
    if (band !== 'clear' && band !== 'likely' && band !== 'none') continue;
    out[band] += 1;
    out.total += 1;
  }
  return out;
}

function autoMatchedFacts(bands: AutoMatchBandsV1, report: RebrandReportV1): Record<string, unknown> {
  return { bands, ...autoMatchedCounts(report) };
}

/**
 * "Auto-match set 5 slides." in the singular or plural, from the same count as the
 * structured `autoMatched.total`, so the sentence and the facts never disagree.
 */
function autoMatchedSentence(report: RebrandReportV1): string {
  const count = autoMatchedCounts(report).total;
  if (count === 0) return 'Auto-match set no slide.';
  return `Auto-match set ${count} ${count === 1 ? 'slide' : 'slides'}.`;
}

function readExport(value: unknown): 'lolly' | 'pptx' {
  if (value === undefined || value === null || value === 'lolly') return 'lolly';
  if (value === 'pptx') return 'pptx';
  throw new RebrandToolError('request.invalid', `export takes "lolly" or "pptx", not ${JSON.stringify(value)}.`);
}

const SLIDE_PART = /^ppt\/slides\/slide\d+\.xml$/i;
const ZIP_END = 0x06054b50;
const ZIP_CENTRAL = 0x02014b50;

/**
 * The slide parts a .pptx names in its zip directory, counted without inflating
 * anything, so a deck over the slide cap is refused before it is read. Null when
 * the directory cannot be walked; the full read then says why.
 */
export function slidePartCount(bytes: Uint8Array): number | null {
  if (bytes.length < 22) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 22 - 0xffff); at -= 1) {
    if (view.getUint32(at, true) === ZIP_END) {
      end = at;
      break;
    }
  }
  if (end < 0) return null;
  const entries = view.getUint16(end + 10, true);
  const size = view.getUint32(end + 12, true);
  const offset = view.getUint32(end + 16, true);
  if (entries === 0xffff || offset + size > end) return null;
  const decoder = new TextDecoder();
  let count = 0;
  let at = offset;
  for (let index = 0; index < entries; index += 1) {
    if (at + 46 > offset + size || view.getUint32(at, true) !== ZIP_CENTRAL) return null;
    const nameLength = view.getUint16(at + 28, true);
    const next = at + 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
    if (next > offset + size) return null;
    if (SLIDE_PART.test(decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength)))) count += 1;
    at = next;
  }
  return count;
}

function tooManySlides(count: number, max: number): RebrandToolError {
  return new RebrandToolError('source.too-large', `The deck has ${count} slides and this server renovates up to ${max} in one call; run lolly rebrand on the CLI for this deck.`);
}

/** Refuse a deck over the slide cap before the read, census and first pass spend anything on it. */
function checkSlideParts(deck: DeckFile, ctx: RebrandCtx): void {
  const max = maxSlidesFor(ctx);
  const count = slidePartCount(deck.bytes);
  if (count !== null && count > max) throw tooManySlides(count, max);
}

/**
 * Refuse a deck over the slide cap once it is read, and a deck the reader cut
 * short: a plan for part of a deck is not a renovation of it.
 */
export function checkSlides(source: SourceDeckV1, ctx: RebrandCtx): void {
  const max = maxSlidesFor(ctx);
  if (source.slides.length > max) throw tooManySlides(source.slides.length, max);
  if (source.warnings.some((warning) => warning.code === 'slides-truncated')) {
    throw new RebrandToolError('source.too-large', `The reader stopped at ${source.slides.length} slides of this deck and this server renovates up to ${max} in one call; run lolly rebrand on the CLI for this deck.`);
  }
}

function sourceFacts(deck: DeckFile, source: SourceDeckV1): Record<string, unknown> {
  return { name: deck.name, hash: source.source.hash, bytes: deck.bytes.byteLength, slides: source.slides.length };
}

/** `lolly://rebrand/<first 12 hex of the source hash>/<file name>`. */
function resourceUri(hash: string, fileName: string): string {
  const hex = hash.replace(/^sha256:/, '').slice(0, 12);
  return `lolly://rebrand/${hex}/${encodeURIComponent(fileName)}`;
}

function jsonResource(uri: string, value: unknown): ContentBlock {
  return { type: 'resource', resource: { uri, mimeType: 'application/json', text: JSON.stringify(value) } };
}

function blobResource(uri: string, mimeType: string, bytes: Uint8Array): ContentBlock {
  return { type: 'resource', resource: { uri, mimeType, blob: Buffer.from(bytes).toString('base64') } };
}

/**
 * How a plan travels: inside the structured result when small, else as an
 * embedded JSON resource. The one place a plan handle (plan 272) will be issued.
 */
function deliverPlan(plan: RenovationPlanV1, uri: string, ctx: RebrandCtx): { delivery: Record<string, unknown>; inline?: RenovationPlanV1; block?: ContentBlock } {
  const text = JSON.stringify(plan);
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes <= ctx.limits.planInlineBytes) {
    return { delivery: { mode: 'inline', bytes, revision: plan.revision }, inline: plan };
  }
  return {
    delivery: { mode: 'resource', bytes, revision: plan.revision, uri },
    block: { type: 'resource', resource: { uri, mimeType: 'application/json', text } },
  };
}

/**
 * The read options that give the objects a saved plan names: its slides that are
 * pictures read the way the plan records. This server reads no text from
 * pictures, so a plan made with text recognition is refused with
 * `ocr.unavailable` rather than compiled against other objects.
 */
function planRead(plan: RenovationPlanV1): Pick<ReadDeckInputV1, 'flattened' | 'ocrMissing'> {
  const shape = flattenedReadOfPlan(plan);
  if (!shape) return {};
  if (shape.ocr) {
    throw new RebrandToolError('ocr.unavailable', 'This plan was made with the text read from slide pictures, and this server has no text recognition, so it cannot read the same objects again. Compile it with lolly rebrand compile on the machine that made it.');
  }
  return { flattened: shape.flattened, ocrMissing: 'unavailable' };
}

/**
 * What happened to a deck's slides that are pictures of slides, in words, or
 * undefined when it has none. No text is read from pictures here.
 */
function flattenedFacts(reports: readonly FlattenedSlideReportV1[]): Record<string, unknown> | undefined {
  if (reports.length === 0) return undefined;
  const rebuilt = reports.filter((one) => one.outcome === 'rebuilt').length;
  const kept = reports.length - rebuilt;
  const count = reports.length;
  const slides = `${count} slide${count === 1 ? '' : 's'}`;
  const note = rebuilt === 0
    ? `${slides} ${count === 1 ? 'is a picture' : 'are pictures'} of a slide and ${count === 1 ? 'stays one picture' : 'stay pictures'}, because this server reads no text from pictures. lolly rebrand plan --ocr reads it on a machine with the text recognition model.`
    : `${slides} ${count === 1 ? 'is a picture' : 'are pictures'} of a slide; ${rebuilt} ${rebuilt === 1 ? 'was' : 'were'} rebuilt from ${rebuilt === 1 ? 'its' : 'their'} regions without reading text, and ${kept} stay${kept === 1 ? 's' : ''} as a picture.`;
  return { slides: count, rebuilt, kept, ocr: false, note };
}

function waitingOf(counts: OutcomeCountsV1): Record<string, number> {
  return {
    pending: counts.pending,
    attention: counts.attention,
    unresolvedObjects: counts.unresolvedObjects,
    unresolvedColours: counts.unresolvedColours,
    tray: counts.tray,
  };
}

function queueRecord(item: QueueItemV1): Record<string, unknown> {
  return {
    id: item.id,
    section: item.section,
    class: item.class,
    action: item.action,
    proposal: item.proposal,
    review: item.review,
    fidelity: item.fidelity,
    title: item.title.text,
    titleCode: item.title.code,
    evidence: item.evidence.text,
    evidenceCode: item.evidence.code,
    slideNumbers: item.slideNumbers,
    objects: item.objectIds.length,
    objectIds: item.objectIds.slice(0, QUEUE_ITEM_IDS_SHOWN),
    // A slide-level card (a layout group, the diagrams) holds slides, not rows.
    ...(item.type ? { type: item.type, slideIds: item.slideIds.slice(0, QUEUE_ITEM_IDS_SHOWN) } : {}),
    ...(item.layout ? { layout: item.layout } : {}),
  };
}

/** The strongest evidence sentence the census wrote, and its signal. */
function strongestEvidence(evidence: readonly EvidenceV1[]): { text: string; signal: string | null } {
  const ranked = [...evidence].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
  const sentence = ranked.find((one) => typeof one.sentence === 'string' && one.sentence.length > 0);
  if (sentence?.sentence) return { text: sentence.sentence, signal: sentence.signal };
  const first = ranked[0];
  return first ? { text: `${first.signal}: ${String(first.value)}`, signal: first.signal } : { text: 'No evidence was recorded.', signal: null };
}

interface Paged<T> {
  total: number;
  page: number;
  limit: number;
  items: T[];
}

function pageOf<T>(all: readonly T[], pageNumber: number, limit: number): Paged<T> {
  return { total: all.length, page: pageNumber, limit, items: all.slice((pageNumber - 1) * limit, pageNumber * limit) };
}

/** The result every stage returns: one plain sentence, the structured JSON as text, then the files. */
type StructuredResult = ToolCallResult & { structuredContent: Record<string, unknown> };

/**
 * The bytes a result goes out as: the whole JSON-RPC response, serialised, so
 * the structured copy beside the text copy and the escaping of every JSON text
 * block are counted. The id is left null; `VERCEL_RESPONSE_MAX_BYTES` keeps
 * room for it.
 */
export function responseBytes(result: StructuredResult): number {
  return Buffer.byteLength(JSON.stringify({ jsonrpc: '2.0', id: null, result }), 'utf8');
}

function success(sentence: string, structured: Record<string, unknown>, files: ContentBlock[], ctx: RebrandCtx): StructuredResult {
  const result: StructuredResult = {
    content: [
      { type: 'text', text: sentence },
      { type: 'text', text: JSON.stringify(structured) },
      ...files,
    ],
    structuredContent: structured,
  };
  if (ctx.env.VERCEL) {
    const size = responseBytes(result);
    if (size > ctx.limits.responseMaxBytes) {
      throw new RebrandToolError('output.too-large', `The result comes to ${size} bytes and this server answers up to ${ctx.limits.responseMaxBytes} bytes; run lolly rebrand on the CLI for this deck.`);
    }
  }
  return result;
}

function failure(stage: string, err: RebrandToolError): StructuredResult {
  return {
    content: [{ type: 'text', text: `${err.code}: ${err.message}` }],
    structuredContent: { stage, error: { code: err.code, message: err.message } },
    isError: true,
  };
}

function waitingSentence(counts: OutcomeCountsV1): string {
  const parts: string[] = [];
  if (counts.attention) parts.push(`${counts.attention} need attention`);
  if (counts.pending) parts.push(`${counts.pending} are unreviewed`);
  if (counts.unresolvedObjects) parts.push(`${counts.unresolvedObjects} objects are unresolved`);
  if (counts.unresolvedColours) parts.push(`${counts.unresolvedColours} colours are unresolved`);
  if (counts.tray) parts.push(`${counts.tray} objects wait in the tray`);
  return parts.length ? parts.join(', ') : 'nothing is waiting';
}

// ─── capabilities ────────────────────────────────────────────────────────────

/** What this server can do for a renovation, and where the bytes go. */
export async function rebrandCapabilities(env: Env = process.env, limits: Readonly<RebrandLimitsV1> = REBRAND_LIMITS): Promise<Record<string, unknown>> {
  const ctx: RebrandCtx = { env, limits };
  const hosted = isHostedServer(env);
  const maxSlides = maxSlidesFor(ctx);
  const maxBytes = maxInputBytesFor(ctx);
  const origin = env.LOLLY_MCP_PUBLIC_ORIGIN?.trim();
  const where = origin ? `the server at ${origin}` : 'this server';
  let system: Record<string, unknown> | null = null;
  let missing: RebrandToolError | null = null;
  try {
    system = systemFacts(await designSystem());
  } catch (err) {
    missing = asToolError(err, 'design-system.unreadable');
  }
  // Without a design system every plan and compile call fails, so the answer is
  // that this server cannot renovate, not what it could do with one.
  const available = system !== null;
  const contract: RebrandCapabilitiesV1 = {
    surface: hosted ? 'mcp-hosted' : 'mcp-local',
    bytes: hosted ? 'configured-server' : 'local-process',
    ocr: false,
    // A picture the deck already stores for an object the reader cannot draw is
    // kept; that is the raster fallback this surface has. It draws no new ones.
    rasterFallback: true,
    nativePptx: available,
    designDocument: available,
    limits: { maxBytes, maxSlides },
    retention: hosted
      ? 'The file is processed in memory for this call and not kept: nothing is written to disk or stored after the response.'
      : 'The file is processed in memory by this local process for this call and not kept.',
  };
  const transfer = !hosted
    ? 'The file stays on the machine this server runs on, which is this machine when the client runs here too, and the server sends it nowhere else.'
    : env.VERCEL
      ? `Calling lolly_rebrand sends the file to ${where}, which processes it in memory for that call only, up to ${maxSlides} slides and a file of about ${megabytes(maxBytes)}, because the platform takes requests up to ${megabytes(limits.bodyMaxBytes)} and compile and inspect send the file and the plan together in one request.`
      : `Calling lolly_rebrand sends the file to ${where}, which processes it in memory for that call only, up to ${mebibytes(maxBytes)} and ${maxSlides} slides.`;
  return {
    stage: 'capabilities',
    surface: contract.surface,
    bytes: contract.bytes,
    hosted,
    ocr: contract.ocr,
    ocrNote: hosted
      ? 'This server has no OCR, so text inside pictures is not read; a slide that is one picture keeps the picture.'
      : 'This server reads no text from pictures, so a slide that is one picture keeps the picture. lolly rebrand plan --ocr reads it on this machine when the text recognition model is here.',
    rasterFallback: contract.rasterFallback,
    rasterNote: 'An object the reader cannot draw keeps the fallback picture the deck stores for it, when there is one; this server draws no new picture of it.',
    nativePptx: contract.nativePptx,
    designDocument: contract.designDocument,
    formats: ['pptx', 'pdf'],
    notYetRead: [],
    maxInputBytes: maxBytes,
    maxSlides,
    limits: {
      maxBytes,
      maxSlides,
      planInlineBytes: limits.planInlineBytes,
      ...(env.VERCEL ? { maxRequestBytes: limits.bodyMaxBytes, maxResponseBytes: limits.responseMaxBytes } : {}),
    },
    retention: contract.retention,
    transfer,
    planHandles: false,
    designSystem: system,
    ...(missing ? { note: `This server cannot renovate a deck until a design system resolves here, so every plan and compile call fails with ${missing.code}.` } : {}),
  };
}

// ─── plan ────────────────────────────────────────────────────────────────────

async function planStage(args: Record<string, unknown>, ctx: RebrandCtx): Promise<StructuredResult> {
  const deck = readFileArg(args.file, ctx);
  const preset = readPreset(args.preset);
  const seed = readSeed(args.seed);
  const autoMatch = readAutoMatch(args.autoMatch);
  checkSlideParts(deck, ctx);
  const resolved = await withPreset(await designSystem(), preset);
  const planned = await planDeck({
    bytes: deck.bytes,
    name: deck.name,
    parseXml: await xmlParser(),
    system: resolved.system,
    ocrMissing: 'unavailable',
    ...(preset ? { preset } : {}),
    ...(seed !== undefined ? { seed } : {}),
    ...(autoMatch ? { autoMatch } : {}),
  });
  checkSlides(planned.source, ctx);
  checkCompileRequest(deck, planned.plan, ctx);
  const { compiled } = await compileDeck({ source: planned.source, census: planned.census, plan: planned.plan, system: planned.system });
  const summary = planSummary(planned.plan, planned.source, planned.census);
  const queue = reviewQueue(planned.plan, planned.census, planned.source);
  const counts = outcomeCounts(planned.plan, compiled);
  const outcome = outcomeOf(planned.plan, compiled);
  const flattened = flattenedFacts(planned.flattened);
  const hash = planned.source.source.hash;
  const plan = deliverPlan(planned.plan, resourceUri(hash, `${deck.stem}.plan.json`), ctx);
  const structured: Record<string, unknown> = {
    stage: 'plan',
    source: sourceFacts(deck, planned.source),
    designSystem: systemFacts(resolved),
    outcome,
    waiting: waitingOf(counts),
    summary,
    queue: { total: queue.length, shown: Math.min(queue.length, PLAN_QUEUE_SHOWN), items: queue.slice(0, PLAN_QUEUE_SHOWN).map(queueRecord) },
    report: compiled.report.counts,
    planDelivery: plan.delivery,
    ...(plan.inline ? { plan: plan.inline } : {}),
    ...(flattened ? { flattened } : {}),
    ...(autoMatch ? { autoMatched: autoMatchedFacts(autoMatch, compiled.report) } : {}),
  };
  const files: ContentBlock[] = [
    ...(plan.block ? [plan.block] : []),
    jsonResource(resourceUri(hash, `${deck.stem}.plan.report.json`), compiled.report),
  ];
  const matchedNote = autoMatch ? ` ${autoMatchedSentence(compiled.report)}` : '';
  const sentence = `Planned ${deck.name}: ${summary.slides.included} of ${summary.slides.total} slides, keep ${summary.objects.keep}, replace ${summary.objects.replace}, remove ${summary.objects.remove}; ${waitingSentence(counts)}, so the outcome is ${outcome}.${matchedNote}${flattened ? ` ${String(flattened.note)}` : ''}`;
  return success(sentence, structured, files, ctx);
}

/**
 * On Vercel, refuse a plan whose compile call could not reach this server: that
 * request carries the file and the plan together, and the platform takes one
 * body up to `bodyMaxBytes`. The plan counted as an object, the smaller of the
 * two ways it can travel.
 */
function checkCompileRequest(deck: DeckFile, plan: RenovationPlanV1, ctx: RebrandCtx): void {
  if (!ctx.env.VERCEL) return;
  const request = REQUEST_ENVELOPE_BYTES + base64Length(deck.bytes.byteLength) + Buffer.byteLength(JSON.stringify(plan), 'utf8');
  if (request > ctx.limits.bodyMaxBytes) {
    throw new RebrandToolError('source.too-large', `A compile call for ${deck.name} would carry the file and its plan in about ${request} bytes, over the ${ctx.limits.bodyMaxBytes} bytes this server takes in one request; run lolly rebrand on the CLI for this deck.`);
  }
}

// ─── compile ─────────────────────────────────────────────────────────────────

async function designToolVersion(): Promise<string | undefined> {
  try {
    const tool = await loadToolCached('design');
    return typeof tool.manifest.version === 'string' ? tool.manifest.version : undefined;
  } catch {
    return undefined;
  }
}

async function compileStage(args: Record<string, unknown>, ctx: RebrandCtx): Promise<StructuredResult> {
  const deck = readFileArg(args.file, ctx);
  const plan = await readPlanArg(args.plan);
  const scope = readAcceptScope(args.acceptSuggestions);
  const autoMatch = readAutoMatch(args.autoMatch);
  const exportAs = readExport(args.export);
  const hash = sourceHashOf(deck.bytes);
  if (plan.source.hash !== hash) {
    throw new RebrandToolError('plan.hash-mismatch', `The plan was made for other bytes (${plan.source.hash}), not ${deck.name} (${hash}).`);
  }
  checkSlideParts(deck, ctx);
  const resolved = await designSystem();
  const read = await readDeck({ bytes: deck.bytes, name: deck.name, parseXml: await xmlParser(), instanceId: plan.source.instanceId, ...planRead(plan) });
  checkSlides(read.source, ctx);
  // compileDeck runs checkPlanFits first, so a plan for another design system or
  // another set of objects is refused with its code before anything compiles.
  const result = await compileDeck({
    source: read.source,
    census: read.census,
    plan,
    system: resolved.system,
    ...(scope ? { acceptSuggestions: scope } : {}),
    ...(autoMatch ? { autoMatch } : {}),
    author: 'agent',
  });
  const compiled = result.compiled;
  const toolVersion = await designToolVersion();
  const session = designSessionFromCompiled(compiled, {
    label: read.source.source.title || deck.stem,
    projectId: `mcp:${read.source.source.instanceId}`,
    ...(toolVersion ? { toolVersion } : {}),
  });
  const now = new Date().toISOString();
  const lolly = await buildDesignLolly({ session, media: read.media, name: deck.stem, exportedAt: now, ...(toolVersion ? { toolVersion } : {}) });
  try {
    readLollyFile(lolly.bytes);
  } catch (err) {
    throw new RebrandToolError('export.failed', `The Design document for ${deck.name} did not read back: ${err instanceof Error ? err.message : String(err)}`);
  }
  const exportNotes: string[] = [];
  if (lolly.missingMedia.length) exportNotes.push(`${lolly.missingMedia.length} pictures the document draws were not held, so they travel as references.`);

  let pptxBytes: Uint8Array | undefined;
  if (exportAs === 'pptx') {
    try {
      const { rasterizeSvgToPng } = await import('@lolly-tools/node-shell/raster');
      const pptx = await compiledDeckToPptx({
        compiled,
        system: resolved.system,
        media: read.media,
        resolveCatalog: (ref) => catalogAssetBytes(ref),
        rasterizeSvg: (svg, w, h) => rasterizeSvgToPng(new TextDecoder().decode(svg), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))),
        now,
        ...(read.source.source.title ? { title: read.source.source.title } : {}),
      });
      pptxBytes = pptx.bytes;
      exportNotes.push(...pptx.notes);
    } catch (err) {
      throw new RebrandToolError('export.failed', `The .pptx for ${deck.name} could not be written: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const outputs: Array<Record<string, unknown>> = [];
  const files: ContentBlock[] = [];
  const addFile = (kind: string, name: string, mimeType: string, block: ContentBlock, bytes: number): void => {
    const uri = resourceUri(hash, name);
    outputs.push({ kind, name, mimeType, bytes, uri });
    files.push(block);
  };
  const lollyName = `${deck.stem}.lolly`;
  addFile('lolly', lollyName, LOLLY_MIME, blobResource(resourceUri(hash, lollyName), LOLLY_MIME, lolly.bytes), lolly.bytes.byteLength);
  if (pptxBytes) {
    const pptxName = `${deck.stem}.rebranded.pptx`;
    addFile('pptx', pptxName, PPTX_MIME, blobResource(resourceUri(hash, pptxName), PPTX_MIME, pptxBytes), pptxBytes.byteLength);
  }
  const reportName = `${deck.stem}.report.json`;
  const reportText = JSON.stringify(result.report);
  addFile('report', reportName, 'application/json', { type: 'resource', resource: { uri: resourceUri(hash, reportName), mimeType: 'application/json', text: reportText } }, Buffer.byteLength(reportText, 'utf8'));

  // The answered plan comes back only when an answer or Auto-match changed it, so
  // the revision the document records names a plan the agent holds.
  let answered: ReturnType<typeof deliverPlan> | undefined;
  if (result.appliedUnreviewed.length > 0 || result.autoMatched.length > 0) {
    const planName = `${deck.stem}.answered.plan.json`;
    answered = deliverPlan(result.plan, resourceUri(hash, planName), ctx);
    if (answered.block) {
      outputs.push({ kind: 'plan', name: planName, mimeType: 'application/json', bytes: answered.delivery.bytes, uri: resourceUri(hash, planName) });
      files.push(answered.block);
    }
  }

  const counts = outcomeCounts(result.plan, compiled);
  const outcome = outcomeOf(result.plan, compiled);
  const summary = planSummary(result.plan, read.source, read.census);
  const flattened = flattenedFacts(read.flattened);
  const structured: Record<string, unknown> = {
    stage: 'compile',
    source: sourceFacts(deck, read.source),
    designSystem: systemFacts(resolved),
    outcome,
    waiting: waitingOf(counts),
    summary,
    report: result.report.counts,
    planRevision: result.plan.revision,
    acceptSuggestions: scope ?? 'none',
    appliedUnreviewed: result.appliedUnreviewed.length,
    outputs,
    ...(answered ? { answeredPlanDelivery: answered.delivery } : {}),
    ...(answered?.inline ? { answeredPlan: answered.inline } : {}),
    exportNotes,
    ...(flattened ? { flattened } : {}),
    ...(autoMatch ? { autoMatched: autoMatchedFacts(autoMatch, result.report) } : {}),
  };
  const made = pptxBytes ? 'a Design document and a .pptx' : 'a Design document';
  const matchedNote = autoMatch ? ` ${autoMatchedSentence(result.report)}` : '';
  const sentence = `Compiled ${deck.name} into ${made}: ${summary.slides.included} of ${summary.slides.total} slides, ${result.appliedUnreviewed.length} suggestions answered; ${waitingSentence(counts)}, so the outcome is ${outcome}.${matchedNote}`;
  return success(sentence, structured, files, ctx);
}

// ─── inspect ─────────────────────────────────────────────────────────────────

interface InspectSource {
  deck: DeckFile;
  source: SourceDeckV1;
  census: DeckCensusV1;
}

/** One slide as the plan alone describes it: no titles or fidelity without the file. */
function planOnlySlides(plan: RenovationPlanV1): Array<Record<string, unknown>> {
  return plan.slides.map((slide, index) => {
    let attention = 0;
    let unreviewed = 0;
    let removed = 0;
    for (const row of slide.objects) {
      if (row.review === 'needs-attention') attention += 1;
      if (row.review === 'unreviewed') unreviewed += 1;
      if (effectiveAction(row) === 'remove') removed += 1;
    }
    return {
      id: slide.id,
      number: index + 1,
      include: slide.include,
      layout: slide.layout,
      layoutSource: slide.layoutSource,
      objects: slide.objects.length,
      attention,
      unreviewed,
      removed,
    };
  });
}

async function inspectStage(args: Record<string, unknown>, ctx: RebrandCtx): Promise<StructuredResult> {
  const plan = await readPlanArg(args.plan);
  const pageNumber = readWhole(args.page, 'page', 1);
  const limit = readWhole(args.limit, 'limit', INSPECT_DEFAULT_LIMIT, INSPECT_MAX_LIMIT);
  const slideNumber = args.slide === undefined || args.slide === null ? undefined : readWhole(args.slide, 'slide', 1);

  let known: InspectSource | undefined;
  if (args.file !== undefined && args.file !== null) {
    const deck = readFileArg(args.file, ctx);
    const hash = sourceHashOf(deck.bytes);
    if (plan.source.hash !== hash) {
      throw new RebrandToolError('plan.hash-mismatch', `${deck.name} is not the deck the plan was made from (the bytes differ).`);
    }
    checkSlideParts(deck, ctx);
    const read = await readDeck({ bytes: deck.bytes, name: deck.name, parseXml: await xmlParser(), instanceId: plan.source.instanceId, ...planRead(plan) });
    checkSlides(read.source, ctx);
    // The same one-to-one check compile runs, so inspect never counts a plan
    // that compile would refuse.
    const problems = planSourceProblems(plan, read.source);
    if (problems.length > 0) {
      const shown = problems.slice(0, 5).join('; ');
      throw new RebrandToolError('plan.invalid', `The plan does not match the deck's slides and objects one to one: ${shown}${problems.length > 5 ? `; and ${problems.length - 5} more` : ''}.`);
    }
    known = { deck, source: read.source, census: read.census };
  }

  const base: Record<string, unknown> = {
    stage: 'inspect',
    fidelityKnown: known !== undefined,
    planRevision: plan.revision,
    ...(known ? { source: sourceFacts(known.deck, known.source) } : {}),
  };
  const withoutFile = 'Pass file with the same deck to add fidelity, slide titles and the review queue.';

  if (slideNumber !== undefined) {
    let slideRow: Record<string, unknown> | undefined;
    let slideId: string | undefined;
    if (known) {
      const state = slideStates(plan, known.source, known.census).find((one) => one.number === slideNumber);
      if (state) {
        slideRow = { ...state };
        slideId = state.id;
      }
    } else {
      const row = planOnlySlides(plan)[slideNumber - 1];
      if (row) {
        slideRow = row;
        slideId = row.id as string;
      }
    }
    if (!slideRow || slideId === undefined) {
      throw new RebrandToolError('request.invalid', `slide ${slideNumber} is not in this plan; it has ${plan.slides.length} slides.`);
    }
    const rows = plan.slides.find((one) => one.id === slideId)?.objects ?? [];
    const states = known ? objectStates(plan, known.source) : undefined;
    const objectOf = known ? new Map(known.source.slides.flatMap((slide) => slide.objects).map((object) => [object.id, object])) : undefined;
    const all = rows.map((row) => {
      const object = objectOf?.get(row.id);
      const fidelity: ReviewFidelityV1 | null = known ? (states?.get(row.id)?.fidelity ?? reviewFidelity(object)) : null;
      const evidence = strongestEvidence(row.evidence);
      return {
        id: row.id,
        kind: object?.kind ?? null,
        class: row.class,
        action: effectiveAction(row),
        proposal: row.proposal,
        ...(row.decision !== undefined ? { decision: row.decision } : {}),
        review: row.review,
        fidelity,
        ...(row.author ? { author: row.author } : {}),
        ...(row.role ? { role: row.role } : {}),
        locked: row.locked === true,
        evidence: evidence.text,
        signal: evidence.signal,
      };
    });
    const objects = pageOf(all, pageNumber, limit);
    const structured = { ...base, slide: slideRow, objects, ...(known ? {} : { note: withoutFile }) };
    const shownTo = Math.min(objects.total, pageNumber * limit);
    const shownFrom = Math.min(objects.total, (pageNumber - 1) * limit + 1);
    const sentence = objects.items.length
      ? `Slide ${slideNumber} has ${objects.total} objects; showing ${shownFrom} to ${shownTo}.`
      : `Slide ${slideNumber} has ${objects.total} objects and page ${pageNumber} shows none of them.`;
    return success(sentence, structured, [], ctx);
  }

  if (known) {
    const summary = planSummary(plan, known.source, known.census);
    const queue = pageOf(reviewQueue(plan, known.census, known.source).map(queueRecord), pageNumber, limit);
    const slides = pageOf(slideStates(plan, known.source, known.census).map((state) => ({ ...state })), pageNumber, limit);
    const structured = { ...base, summary, queue, slides };
    const sentence = `${known.deck.name}: ${summary.slides.included} of ${summary.slides.total} slides included, ${queue.total} queue items and ${summary.review.attention} objects that need attention.`;
    return success(sentence, structured, [], ctx);
  }
  const slides = pageOf(planOnlySlides(plan), pageNumber, limit);
  const structured = { ...base, slides, note: withoutFile };
  return success(`The plan covers ${plan.slides.length} slides; pass slide to list one slide's objects.`, structured, [], ctx);
}

// ─── the entry ───────────────────────────────────────────────────────────────

/** Run one stage of `lolly_rebrand`. Never throws: a failure is an error result with its code. */
export async function callRebrand(
  args: Record<string, unknown>,
  env: Env = process.env,
  limits: Readonly<RebrandLimitsV1> = REBRAND_LIMITS,
): Promise<StructuredResult> {
  const stage = typeof args.stage === 'string' ? args.stage : '';
  const ctx: RebrandCtx = { env, limits };
  try {
    switch (stage) {
      case 'capabilities': {
        const structured = await rebrandCapabilities(env, limits);
        return success(String(structured.note ?? structured.transfer), structured, [], ctx);
      }
      case 'plan':
        return await planStage(args, ctx);
      case 'compile':
        return await compileStage(args, ctx);
      case 'inspect':
        return await inspectStage(args, ctx);
      default:
        throw new RebrandToolError('request.invalid', `stage takes ${REBRAND_STAGES.join(', ')}, not ${JSON.stringify(args.stage ?? null)}.`);
    }
  } catch (err) {
    // The export steps throw export.failed themselves; anything else unexpected is a bug.
    return failure(stage || 'unknown', asToolError(err, 'internal'));
  }
}

