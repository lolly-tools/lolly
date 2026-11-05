// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly_resolve_intent` (plan 350 W4): state what a piece has to do and get back the tool
 * for each surface, its input values, what is missing and why, as an `IntentResolutionV1`
 * (schemas/intent-resolution-v1.schema.json). The same `resolveIntent` `lolly intent` runs,
 * so both answer a request the same way.
 *
 * Read only. It renders nothing and stores nothing, and no model is in this path: the agent
 * calling it reads its own user's words, and a prompt passed here is carried and never read.
 * A prompt with no purpose is answered `purpose-needed` rather than guessed at, so the agent
 * chooses and calls again. It renders by calling `lolly_render` with what comes back.
 * Errors carry a stable code (`INTENT_TOOL_CODES`); the call never throws.
 */
import { TOOL_INTENTS_FILE, type IntentToolFactsV1 } from '@lolly-tools/core/intent-v1';
import { INTENT_RECORD_CODES, IntentInvalidError, intentRecordFor, intentRecordWords, loadIntentTools, resolveIntent } from '@lolly/engine';
import type { C2paIntentRecord, IntentRecordOutcome } from '@lolly/engine';
// Imported, not read from disk: the bundled Vercel function carries no schemas/ directory.
import requestSchema from '../../../schemas/visual-intent-v1.schema.json' with { type: 'json' };
import resolutionSchema from '../../../schemas/intent-resolution-v1.schema.json' with { type: 'json' };
import { loadIndex, loadToolCached } from './catalog.ts';
import { fetchToolFile } from './paths.ts';
import {
  ToolCodeError,
  contractPart,
  errorOut,
  failure,
  structuredLimitsFor,
  success,
  type Env,
  type Schema,
  type StructuredCtx,
  type StructuredLimitsV1,
  type StructuredResult,
} from './structured.ts';

/** Every code a `lolly_resolve_intent` error carries. */
export type IntentToolCodeV1 = 'request.invalid' | 'intent.invalid' | 'output.too-large' | 'internal';
export const INTENT_TOOL_CODES: IntentToolCodeV1[] = ['request.invalid', 'intent.invalid', 'output.too-large', 'internal'];

const request = contractPart(requestSchema as unknown as Schema);
const resolution = contractPart(resolutionSchema as unknown as Schema);

export const RESOLVE_INTENT_OUTPUT_SCHEMA: Schema = {
  type: 'object',
  $defs: { ...resolution.defs, intentResolution: resolution.root },
  oneOf: [{ $ref: '#/$defs/intentResolution' }, errorOut(INTENT_TOOL_CODES)],
};

export const RESOLVE_INTENT_TOOL_DEF = {
  name: 'lolly_resolve_intent',
  description:
    'Say what a piece has to do, and get back the tool for each surface, its input values, what is missing and why. ' +
    'Read only: nothing is rendered or stored. No model is in this path, so it never reads meaning from text. ' +
    'If you are happy to carry your user\'s first words in the work you return, pass them as `prompt`, then read them yourself and choose the `purpose`: ' +
    'a prompt with no purpose comes back as outcome `purpose-needed` (code `intent.purpose-needed`) with the purposes, the tools that serve each, the surfaces and the roles, so you can call again with a purpose, surfaces and content. ' +
    'A surface with status `ready` is rendered by calling lolly_render with its chosen `toolId`, `inputs` and `format`, plus `exportDims` as width, height and unit when `sizeSetBy` is `export`. ' +
    'To record the intent in the file, also pass `intent` and `surface` to lolly_render, which adds a Content Credential unless you pass c2pa: "off". ' +
    'A surface with status `needs-content` lists the roles to supply in `gaps`; supply them from your user, never invent them. `defaultsInUse` names the tool wording that would still print.',
  inputSchema: {
    type: 'object',
    properties: {
      intent: {
        ...request.root,
        description:
          'What the piece has to do: `version` 1, `purpose`, `surfaces` and `content` by role. Optional: `occasion`, `audience` and `region` (recorded, never read), `language`, and `prompt` (your user\'s first words, at most 2000 characters, refused rather than cut). Give either a purpose with surfaces, or a prompt on its own to get the choices back.',
      },
    },
    required: ['intent'],
    additionalProperties: false,
    $defs: request.defs,
  },
  outputSchema: RESOLVE_INTENT_OUTPUT_SCHEMA,
};

let intentToolsCache: Promise<IntentToolFactsV1[]> | null = null;

/** The tools in this server's catalog with an intents.json. Cached for the process, as the catalog is. */
function intentTools(): Promise<IntentToolFactsV1[]> {
  intentToolsCache ??= loadIndex().then(({ tools }) => loadIntentTools({
    ids: tools.map((tool) => tool.id),
    sidecar: (id) => fetchToolFile(`${id}/${TOOL_INTENTS_FILE}`).catch(() => null),
    manifest: async (id) => (await loadToolCached(id)).manifest,
    onInvalid: (id, errors) => console.error(`${id}/${TOOL_INTENTS_FILE} left out: ${errors.map((e) => e.message).join(' ')}`),
  }));
  intentToolsCache.catch(() => { intentToolsCache = null; });
  return intentToolsCache;
}

/** `lolly_render`'s intent arguments. `intent` is loose here because the resolver checks the shape. */
export const RENDER_INTENT_ARGS = {
  intent: {
    type: 'object',
    description:
      'The intent this file answers, the object you gave lolly_resolve_intent. The server resolves it again and works out what to record itself. '
      + 'Refused with code intent.tool-not-candidate when toolId does not answer it on that surface. '
      + 'Recorded in a Content Credential, so passing intent adds one to this file: self-signed and valid for 30 days, unless c2pa sets the lifetime. '
      + 'With c2pa: "off" the file holds no credential and no record, and the result says so. '
      + 'Recorded as written: purpose, surface, tool, language, the rules and vocabulary versions and the intent digest. '
      + 'As fingerprints only: occasion, audience, region and the prompt.',
  },
  surface: { type: 'string', maxLength: 64, description: 'Which surface of `intent` this file is for. Needed when the intent names more than one.' },
  recordIntent: { type: 'boolean', description: 'Default true when `intent` is given. False records nothing about the intent in the file.' },
  recordPrompt: {
    type: 'boolean',
    description:
      "Default false: the prompt goes in as a fingerprint. True puts your user's own words in the file, where anyone the file reaches can read them, and files travel. "
      + 'Set it only when you are happy to put those words in the work you return. Leave it off when the prompt holds personal or confidential detail.',
  },
} as const;

/** Every code `lolly_render` gives for its intent arguments. */
export const RENDER_INTENT_CODES = ['request.invalid', 'intent.invalid', ...INTENT_RECORD_CODES] as const;

export type RenderIntentSettings =
  | { error: { code: (typeof RENDER_INTENT_CODES)[number]; message: string } }
  | { record: C2paIntentRecord | null; optedOut: boolean };

/**
 * `lolly_render`'s intent arguments, resolved before anything renders. The server runs the
 * resolver itself, so the record states what this server worked out: a digest or a choice
 * sent by the caller is never read. Null when the call has no intent.
 */
export async function intentRenderSettings(args: Record<string, unknown>, toolId: string): Promise<RenderIntentSettings | null> {
  const { intent, surface, recordIntent, recordPrompt } = args;
  if (intent === undefined) {
    const stray = ['surface', 'recordIntent', 'recordPrompt'].find((key) => args[key] !== undefined);
    return stray ? { error: { code: 'request.invalid', message: `${stray} only applies with intent.` } } : null;
  }
  if (surface !== undefined && typeof surface !== 'string') return { error: { code: 'request.invalid', message: 'surface must be a surface id.' } };
  for (const [key, value] of [['recordIntent', recordIntent], ['recordPrompt', recordPrompt]] as const) {
    if (value !== undefined && typeof value !== 'boolean') return { error: { code: 'request.invalid', message: `${key} must be true or false.` } };
  }
  if (recordIntent === false && recordPrompt === true) return { error: { code: 'request.invalid', message: 'recordPrompt needs recordIntent: choose one.' } };
  let resolution: Awaited<ReturnType<typeof resolveIntent>>;
  try {
    resolution = await resolveIntent(intent, await intentTools());
  } catch (err) {
    if (err instanceof IntentInvalidError) return { error: { code: 'intent.invalid', message: err.message } };
    throw err;
  }
  const chosen = await intentRecordFor(resolution, {
    toolId,
    ...(typeof surface === 'string' ? { surface } : {}),
    ...(typeof recordPrompt === 'boolean' ? { recordPrompt } : {}),
  });
  if (!chosen.ok) return { error: { code: chosen.code, message: chosen.message } };
  return recordIntent === false ? { record: null, optedOut: true } : { record: chosen.record, optedOut: false };
}

/** The lines a `lolly_render` result prints about the intent, at the moment the file is made. */
export function intentRecordText(outcome: IntentRecordOutcome | null | undefined, credentialFromIntent = false): string {
  if (!outcome) return '';
  const lines = intentRecordWords(outcome);
  if (outcome.state === 'recorded') {
    if (credentialFromIntent) lines.push('Passing intent added this Content Credential to the file: self-signed, valid for 30 days.');
    if (outcome.promptInFile) lines.push('Leave recordPrompt off when a prompt holds personal or confidential detail.');
    lines.push(credentialFromIntent ? 'Pass recordIntent: false to leave the intent out, or c2pa: "off" for no credential.' : 'Pass recordIntent: false to leave the intent out.');
  } else if (outcome.reason === 'no-credential') {
    lines.push('Leave out c2pa: "off" to record the intent.');
  }
  return lines.join(' ');
}

export async function callResolveIntent(
  args: Record<string, unknown>,
  env: Env = process.env,
  limits: Readonly<StructuredLimitsV1> = structuredLimitsFor(env),
): Promise<StructuredResult> {
  const ctx: StructuredCtx = { env, limits };
  try {
    const extra = Object.keys(args).find((key) => key !== 'intent');
    if (extra) throw new ToolCodeError<IntentToolCodeV1>('request.invalid', `lolly_resolve_intent takes intent, not ${extra}.`);
    if (args.intent === undefined) throw new ToolCodeError<IntentToolCodeV1>('request.invalid', 'intent is required.');
    const answer = await resolveIntent(args.intent, await intentTools());
    const sentence = answer.purposeNeeded
      ? `${answer.purposeNeeded.code}: ${answer.purposeNeeded.message}`
      : `Intent ${answer.outcome}: ${answer.surfaces.map((s) => `${s.surface.id} ${s.status}${s.chosen ? ` (${s.chosen.toolId})` : ''}`).join(', ')}.`;
    return success<IntentToolCodeV1>(sentence, answer as unknown as Record<string, unknown>, [], ctx, 'output.too-large', 'Ask for fewer surfaces.');
  } catch (err) {
    if (err instanceof ToolCodeError) return failure(err);
    if (err instanceof IntentInvalidError) return failure(new ToolCodeError<IntentToolCodeV1>('intent.invalid', err.message));
    return failure(new ToolCodeError<IntentToolCodeV1>('internal', err instanceof Error ? err.message : String(err)));
  }
}
