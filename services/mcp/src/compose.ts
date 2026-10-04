// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly_compose` (plan 291 W6): slides laid out from the slide master's archetypes, as
 * a Design document that `lolly_package`, `lolly_check` and `lolly_render` take as it
 * is. The same composer `lolly compose` runs (`composeDesign`, `suggestCompose` and
 * `composeArchetypeListing`, @lolly-tools/node-shell/design-compose), so the CLI and
 * this tool hand back the same document for the same spec.
 *
 * Three modes:
 *   - `compose` (the default): a spec (schemas/design-compose-v1.schema.json) to the
 *     document, the compose report (which archetype each slide took, what was filled
 *     and dropped, which text slots clip), the source wording the slides change or
 *     leave out in the shape `lolly_check` takes as `edits`, and the pictures named;
 *   - `list`: the master's archetypes with their slot keys, kinds and boxes;
 *   - `suggest`: a first spec for a deck, an archetype per slide with its text roles
 *     as `from` references and its notes kept.
 *
 * The master is this server's content profile's catalog master, else the engine's
 * neutral master; the report says which. Source text comes from `inventory` (what
 * `lolly_read` returns) or from the deck itself as base64 under the server's file cap.
 * WHERE THE BYTES GO is as for `lolly_read`: a hosted server receives the deck, holds
 * it in memory for the call and writes nothing. Nothing is drawn and no browser runs.
 * Errors carry a stable code (`COMPOSE_TOOL_CODES`); the call never throws.
 */
import type { ContentInventoryV1 } from '@lolly-tools/core';
// Imported, not read from disk: the bundled Vercel function carries no schemas/ directory.
import composeSchema from '../../../schemas/design-compose-v1.schema.json' with { type: 'json' };
import {
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
  success,
  type Env,
  type Schema,
  type StructuredCtx,
  type StructuredLimitsV1,
  type StructuredResult,
} from './structured.ts';
import { FILE_SIZE_NOTE, deckFallbackName, deckSlideCount } from './read.ts';
import { isHostedServer } from './rebrand.ts';

/**
 * Text units (UTF-16) one hosted compose call measures, counting every measure fit
 * shrink makes again at a smaller size: what a 30 second function measures with room
 * to spare (about 4 s here for a first pass over this many). A slot past it comes back
 * unmeasured with a note; a local server has no budget.
 */
export const COMPOSE_HOSTED_MEASURE_UNITS = 262144;

/** The structured limits, plus the hosted measuring budget a test lowers. */
export interface ComposeLimitsV1 extends StructuredLimitsV1 {
  hostedMeasureUnits?: number;
}

/** Every code a `lolly_compose` error carries. */
export type ComposeToolCodeV1 =
  | 'request.invalid'
  | 'spec.invalid'
  | 'inventory.invalid'
  | 'source.too-large'
  | 'source.unreadable'
  | 'output.too-large'
  | 'internal';

const CODES: Record<ComposeToolCodeV1, true> = {
  'request.invalid': true,
  'spec.invalid': true,
  'inventory.invalid': true,
  'source.too-large': true,
  'source.unreadable': true,
  'output.too-large': true,
  internal: true,
};
export const COMPOSE_TOOL_CODES = Object.keys(CODES) as ComposeToolCodeV1[];

export const COMPOSE_MODES = ['compose', 'list', 'suggest'] as const;
export type ComposeModeV1 = (typeof COMPOSE_MODES)[number];

const contract = contractPart(composeSchema as Schema);

const OPEN = { type: 'object' } as const;
const NOTE = { $ref: '#/$defs/note' };
const MASTER = obj({ id: STR, version: STR, origin: { $ref: '#/$defs/masterOrigin' } });
const ASSET = obj({ key: STR, sha256: STR, name: STR, mime: STR, file: STR }, ['mime', 'file']);

const COMPOSE_OUT = obj({ document: OPEN, report: { $ref: '#/$defs/report' }, edits: { type: 'array', items: OPEN }, assets: { type: 'array', items: ASSET } });
const LIST_OUT = obj({
  master: obj({ id: STR, version: STR, name: STR, origin: { $ref: '#/$defs/masterOrigin' }, size: obj({ width: { type: 'number' }, height: { type: 'number' } }) }),
  archetypes: { $ref: '#/$defs/catalog' },
  notes: { type: 'array', items: NOTE },
});
const SUGGEST_OUT = obj({ spec: { $ref: '#/$defs/spec' }, reasons: { type: 'array', items: OPEN }, assets: { type: 'array', items: ASSET }, master: MASTER });

/** The structured result: a composed document, the archetype list, a suggested spec, or an error. */
export const COMPOSE_OUTPUT_SCHEMA: Schema = {
  type: 'object',
  $defs: contract.defs,
  oneOf: [COMPOSE_OUT, LIST_OUT, SUGGEST_OUT, errorOut(COMPOSE_TOOL_CODES)],
};

const FILE_ARG = {
  type: 'object',
  description: 'The source deck: a .pptx, a PDF or a Photoshop document (.psd). Its text answers `from` references, and suggest reads its layouts.',
  properties: {
    base64: { type: 'string', description: 'The file bytes, base64-encoded.' },
    name: { type: 'string', description: 'The file name, e.g. quarterly.pptx.' },
    mime: { type: 'string', description: 'The MIME type, if known.' },
  },
  required: ['base64'],
  additionalProperties: false,
};

const ARGS: Record<string, Schema> = {
  mode: { type: 'string', enum: [...COMPOSE_MODES], description: 'compose (default) lays a spec out; list returns the archetypes; suggest returns a first spec for a deck.' },
  spec: {
    type: 'object',
    description:
      'compose: {slides: [{archetype, slots: {title: "...", "body#2": {from: "<inventory object id>"}}, cells: [...], notes: true, source: 3, ground: "dark", under: [...], over: [...]}], size?, theme?, themes?, $styles?, furniture?, emphasis?, case?} ' +
      '(schemas/design-compose-v1.schema.json). Slot keys are a role or role#n; a value is Design text markup, null to drop the slot, or an object with overrides ' +
      '({from, join: ": "} runs every line of that text into one). furniture on the spec is the deck default each slide merges over; emphasis (accent, bold, keep) sets how a source\'s bold reads in display slots; case: "sentence" is opt-in; themes: ["light", "dark"] writes logo furniture as <id>?theme=auto, so each theme shows the mark its surface asks for.',
  },
  inventory: { type: 'object', description: 'The source deck\'s content inventory, as lolly_read returns the inventory: `from` references and notes: true read the text there.' },
  source: FILE_ARG,
  size: { type: ['string', 'object'], description: 'compose: the artboard size, "1920x1080" or {width, height}. Default the spec\'s, else 1920x1080.' },
  theme: { type: 'string', enum: ['light', 'dark'], description: 'compose: dark picks each archetype\'s dark twin; a light archetype with no twin is drawn under the design system\'s Dark theme, and the report says so.' },
  fit: { type: 'string', enum: ['report', 'shrink'], description: 'compose: report (default) records which text slots clip; shrink steps a clipping slot down to the smallest size the master sets for its role.' },
};

const MODE_ARGS: Record<ComposeModeV1, ReadonlySet<string>> = {
  compose: new Set(['mode', 'spec', 'inventory', 'source', 'size', 'theme', 'fit']),
  list: new Set(['mode']),
  suggest: new Set(['mode', 'inventory', 'source']),
};

export const COMPOSE_TOOL_DEF = {
  name: 'lolly_compose',
  description:
    'Lay slides out from this design system\'s slide master: name an archetype per slide and its slot text (or `from` an inventory object), ' +
    'and get a Design document with the master\'s furniture, margins and bindings, ready for lolly_package and lolly_check. ' +
    'mode list returns the archetypes and their slots; mode suggest reads a deck (inventory, or the deck as base64, ' + FILE_SIZE_NOTE + ') and returns a first spec. ' +
    'Each text slot is measured: the report says what clips, and fit shrink steps it down to the master\'s smallest size for its role. ' +
    `A hosted server measures up to ${COMPOSE_HOSTED_MEASURE_UNITS} characters a call, shrink's extra measures included; a slot past that comes back unmeasured, with a note. ` +
    'The edits it returns are the source wording the slides change or leave out, for lolly_check. The same composer as `lolly compose --json`.',
  inputSchema: { type: 'object', properties: ARGS, additionalProperties: false },
  outputSchema: COMPOSE_OUTPUT_SCHEMA,
};

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

const NODE_CODE: Record<string, ComposeToolCodeV1> = {
  'spec.invalid': 'spec.invalid',
  'inventory.invalid': 'inventory.invalid',
  'source.unreadable': 'source.unreadable',
};

function asComposeError(err: unknown): ToolCodeError<ComposeToolCodeV1> {
  if (err instanceof ToolCodeError && Object.hasOwn(CODES, err.code)) return err as ToolCodeError<ComposeToolCodeV1>;
  const message = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: unknown })?.code;
  if (err instanceof Error && err.name === 'DesignComposeError' && typeof code === 'string') return new ToolCodeError(NODE_CODE[code] ?? 'internal', message);
  return new ToolCodeError('internal', message);
}

function sizeArg(value: unknown, parse: (v: string) => { width: number; height: number } | null): { width: number; height: number } | undefined {
  if (value === undefined || value === null) return undefined;
  const parsed = typeof value === 'string' ? parse(value) : record(value) ? parse(`${String(value.width)}x${String(value.height)}`) : null;
  if (!parsed) throw new ToolCodeError<ComposeToolCodeV1>('request.invalid', 'size is the artboard size in px: "1920x1080" or {width, height}.');
  return parsed;
}

/** Compose, list or suggest. Never throws: a failure is an error result with its code. */
export async function callCompose(
  args: Record<string, unknown>,
  env: Env = process.env,
  limits: Readonly<ComposeLimitsV1> = STRUCTURED_LIMITS,
): Promise<StructuredResult> {
  const ctx: StructuredCtx = { env, limits };
  try {
    const extra = Object.keys(args).find((key) => !Object.hasOwn(ARGS, key));
    if (extra) throw new ToolCodeError('request.invalid', `lolly_compose takes ${Object.keys(ARGS).join(', ')}, not ${extra}.`);
    const mode = (args.mode ?? 'compose') as ComposeModeV1;
    if (!(COMPOSE_MODES as readonly string[]).includes(mode)) throw new ToolCodeError('request.invalid', `mode must be ${COMPOSE_MODES.join(', ')}.`);
    const misplaced = Object.keys(args).find((key) => !MODE_ARGS[mode].has(key));
    if (misplaced) throw new ToolCodeError('request.invalid', `${misplaced} does not apply to mode ${mode}.`);
    const node = await import('@lolly-tools/node-shell/design-compose');

    if (mode === 'list') {
      const listing = await node.composeArchetypeListing();
      const sentence = `${plural(listing.archetypes.length, 'archetype')} on ${listing.master.id} ${listing.master.version} (${listing.master.origin}).`;
      return success<ComposeToolCodeV1>(sentence, listing as unknown as Record<string, unknown>, [], ctx, 'output.too-large', 'list on a local server.');
    }

    const max = maxSlides(ctx);
    const sources: { inventory?: unknown; source?: { bytes: Uint8Array; name: string } } = {};
    if (args.inventory !== undefined) {
      if (!record(args.inventory)) throw new ToolCodeError('inventory.invalid', 'inventory is the content inventory lolly_read returns, as an object.');
      sources.inventory = args.inventory;
      const slides = (args.inventory as Partial<ContentInventoryV1> & { inventory?: Partial<ContentInventoryV1> }).slides ?? (args.inventory as { inventory?: Partial<ContentInventoryV1> }).inventory?.slides;
      if (Array.isArray(slides) && slides.length > max) throw new ToolCodeError('request.invalid', `The inventory has ${slides.length} slides; this server composes up to ${max} in one call.`);
    }
    if (args.source !== undefined) {
      const fileMax = maxFileBytes(ctx);
      const file = readFileArg<ComposeToolCodeV1>(args.source, {
        max: fileMax,
        what: 'source',
        fallbackName: deckFallbackName(Uint8Array.from(Buffer.from(String((args.source as { base64?: unknown })?.base64 ?? '').slice(0, 1400), 'base64'))),
        missing: 'request.invalid',
        tooLarge: 'source.too-large',
        invalid: 'request.invalid',
        hint: 'Pass its inventory (lolly_read) instead.',
      });
      const parts = await deckSlideCount(file.bytes);
      if (parts !== null && parts > max) throw new ToolCodeError('request.invalid', `The deck has ${parts} slides; this server reads up to ${max} in one call. Pass its inventory for the slides you compose.`);
      sources.source = { bytes: file.bytes, name: file.name };
    }

    if (mode === 'suggest') {
      if (!sources.source && sources.inventory === undefined) throw new ToolCodeError('request.invalid', 'suggest reads a deck: pass source (the deck as base64) or inventory (lolly_read).');
      const suggested = await node.suggestCompose(sources);
      const assets = suggested.assets.map(({ bytes: _bytes, ...rest }) => rest);
      const structured = { spec: suggested.spec, reasons: suggested.reasons, assets, master: suggested.master };
      const sentence = `Suggested ${plural(suggested.spec.slides.length, 'slide')} on ${suggested.master.id} (${suggested.master.origin}); edit the spec, then call lolly_compose with it.`;
      return success<ComposeToolCodeV1>(sentence, structured as unknown as Record<string, unknown>, [], ctx, 'output.too-large', 'pass fewer slides.');
    }

    if (!record(args.spec) && !Array.isArray(args.spec)) throw new ToolCodeError('spec.invalid', 'spec is required: {slides: [{archetype, slots}]}. Call with mode list for the archetypes.');
    const slides = Array.isArray(args.spec) ? args.spec : (args.spec as { slides?: unknown }).slides;
    if (Array.isArray(slides) && slides.length > max) throw new ToolCodeError('request.invalid', `The spec has ${slides.length} slides; this server composes up to ${max} in one call.`);
    if (args.theme !== undefined && args.theme !== 'light' && args.theme !== 'dark') throw new ToolCodeError('request.invalid', 'theme must be light or dark.');
    if (args.fit !== undefined && args.fit !== 'report' && args.fit !== 'shrink') throw new ToolCodeError('request.invalid', 'fit must be report or shrink.');
    const size = sizeArg(args.size, node.parseComposeSize);
    const composed = await node.composeDesign(args.spec, {
      ...sources,
      ...(size ? { size } : {}),
      ...(args.theme ? { theme: args.theme as 'light' | 'dark' } : {}),
      ...(args.fit ? { fit: args.fit as 'report' | 'shrink' } : {}),
      ...(isHostedServer(env) ? { maxUnits: limits.hostedMeasureUnits ?? COMPOSE_HOSTED_MEASURE_UNITS } : {}),
    });
    const assets = composed.assets.map(({ bytes: _bytes, ...rest }) => rest);
    const clipped = composed.report.slides.flatMap((s) => (s.fit ?? []).filter((f) => f.overflow).map((f) => f.layerId));
    const unmeasured = composed.unmeasured ?? [];
    const fitWords = clipped.length || unmeasured.length
      ? `${clipped.length ? `; ${plural(clipped.length, 'text slot')} still clip (${clipped.slice(0, 6).join(', ')}${clipped.length > 6 ? ', ...' : ''})` : ''}` +
        `${unmeasured.length ? `; ${plural(unmeasured.length, 'text slot')} not measured (${unmeasured.slice(0, 6).join(', ')}${unmeasured.length > 6 ? ', ...' : ''}), so whether ${unmeasured.length === 1 ? 'that slot fits' : 'those slots fit'} is not known` : ''}`
      : '; every text slot fits';
    const structured = { document: composed.document, report: composed.report, edits: composed.edits, assets };
    const sentence =
      `Composed ${plural(composed.report.slides.length, 'slide')} at ${composed.report.size.width}x${composed.report.size.height} on ${composed.report.master.id} (${composed.report.master.origin})` +
      fitWords +
      `${composed.edits.length ? `; ${plural(composed.edits.length, 'source string')} changed or left out, listed as edits for lolly_check` : ''}. Next: lolly_package, then lolly_check.`;
    return success<ComposeToolCodeV1>(sentence, structured as unknown as Record<string, unknown>, [], ctx, 'output.too-large', 'compose fewer slides in one call.');
  } catch (err) {
    return failure(asComposeError(err));
  }
}
