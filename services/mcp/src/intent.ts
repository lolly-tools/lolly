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
import { IntentInvalidError, loadIntentTools, resolveIntent } from '@lolly/engine';
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
