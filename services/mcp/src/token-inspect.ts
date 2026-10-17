// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly_inspect_tokens` (plan 286 M5): why a design token has its value. One call
 * returns the effective theme selection (groups, one choice per group, the groups at
 * their default and the set order), the diagnostics, a page of the tokens and, for a
 * named `token`, its winning definition, override order, declared roles and a
 * bounded trace of what it reads and what reads that token. The report is `tokenReport`
 * (@lolly-tools/node-shell/token-report), the same one the TUI's token inspector
 * shows, so a person and an agent read one explanation.
 *
 * THE DOCUMENT is this server's design system (the content profile's head tokens
 * asset, which lolly://design-context and lolly_check also read), or `tokens` given
 * with the call. Choices are `theme` (one name, as a single-theme link gives one) or
 * `selection` (one theme id per group, the `_themes` value of a render link). Nothing
 * is written: a choice here is a preview, and the report says whether the effective
 * choices differ from the stored ones.
 *
 * Counts cover token references and declared roles in this document only. Errors
 * carry a stable code (`TOKEN_INSPECT_TOOL_CODES`); the call never throws.
 */
import { coerceTokensDoc, contextTokens, parseTokenSelection } from '@lolly/engine';
import { readProfileTokenDocument } from '@lolly-tools/node-shell/design-brief';
import { TOKEN_REPORT_LIMITS, TokenReportError, tokenReport, type TokenReportOriginV1 } from '@lolly-tools/node-shell/token-report';
import {
  BOOL,
  INT,
  STR,
  STRUCTURED_LIMITS,
  ToolCodeError,
  errorOut,
  failure,
  obj,
  plural,
  success,
  type Env,
  type Schema,
  type StructuredCtx,
  type StructuredLimitsV1,
  type StructuredResult,
} from './structured.ts';

/** Every code a `lolly_inspect_tokens` error carries. */
export type TokenInspectToolCodeV1 = 'request.invalid' | 'tokens.unavailable' | 'tokens.unreadable' | 'token.unknown' | 'output.too-large' | 'internal';

const INSPECT_TOKEN_CODES: Record<TokenInspectToolCodeV1, true> = {
  'request.invalid': true,
  'tokens.unavailable': true,
  'tokens.unreadable': true,
  'token.unknown': true,
  'output.too-large': true,
  internal: true,
};
export const TOKEN_INSPECT_TOOL_CODES = Object.keys(INSPECT_TOKEN_CODES) as TokenInspectToolCodeV1[];

const ANY_VALUE: Schema = {};
const STR_OR_NULL: Schema = { type: ['string', 'null'] };
const TOKEN_DIAGNOSTIC_OUT = obj({ code: { enum: ['selection', 'missing', 'cycle', 'type', 'unsupported', 'limit'] }, path: STR, message: STR });
const TOKEN_SOURCE_OUT = obj({ set: STR_OR_NULL, location: STR, type: STR_OR_NULL, value: ANY_VALUE, active: BOOL, description: STR, extensions: { type: 'object' } }, ['value', 'description', 'extensions']);
const TRACE_STEP_OUT = obj({ path: STR, depth: INT, via: STR, type: STR_OR_NULL, resolved: ANY_VALUE, missing: { const: true } }, ['resolved', 'missing']);
const CHOICE_MAP_OUT = { type: 'object', additionalProperties: STR };

const TOKEN_REPORT_OUT = obj({
  format: { const: 'lolly-token-report' },
  version: { const: 1 },
  scope: { const: 'token-document' },
  context: obj({
    origin: obj({ kind: { enum: ['terminal', 'profile', 'supplied'] }, id: STR, label: STR, tokensAsset: STR }, ['id', 'label', 'tokensAsset']),
    revision: STR,
    requested: obj({ theme: STR, selection: CHOICE_MAP_OUT }, ['theme', 'selection']),
    selection: obj({
      groups: { type: 'array', items: obj({ id: STR, options: { type: 'array', items: obj({ id: STR, name: STR }) } }) },
      choices: CHOICE_MAP_OUT,
      defaults: { type: 'array', items: STR },
      sets: { type: 'array', items: STR },
    }),
    stored: CHOICE_MAP_OUT,
    preview: BOOL,
  }),
  counts: obj({ tokens: INT, active: INT, inactive: INT, withIssues: INT, diagnostics: INT }),
  diagnostics: { type: 'array', items: TOKEN_DIAGNOSTIC_OUT },
  issues: { type: 'array', items: TOKEN_DIAGNOSTIC_OUT },
  list: obj({
    total: INT,
    offset: INT,
    limit: INT,
    rows: { type: 'array', items: obj({ path: STR, type: STR_OR_NULL, set: STR_OR_NULL, active: BOOL, resolved: ANY_VALUE, issues: INT }, ['resolved']) },
  }),
  trace: obj({
    path: STR,
    type: STR_OR_NULL,
    authored: ANY_VALUE,
    resolved: ANY_VALUE,
    source: { oneOf: [TOKEN_SOURCE_OUT, { type: 'null' }] },
    candidates: { type: 'array', items: TOKEN_SOURCE_OUT },
    declaredConsumers: {
      type: 'array',
      items: obj({ roleId: STR, label: STR, bindings: { type: 'array', items: obj({ id: STR, tool: STR, slot: STR, modes: { type: 'array', items: STR } }, ['tool', 'modes']) } }),
    },
    diagnostics: { type: 'array', items: TOKEN_DIAGNOSTIC_OUT },
    references: { type: 'array', items: TRACE_STEP_OUT },
    dependents: { type: 'array', items: TRACE_STEP_OUT },
    depth: INT,
    truncated: BOOL,
  }, ['authored', 'resolved']),
  truncated: BOOL,
}, ['trace']);

/** The structured result: the token report, or an error. */
export const TOKEN_INSPECT_OUTPUT_SCHEMA: Schema = { type: 'object', oneOf: [TOKEN_REPORT_OUT, errorOut(TOKEN_INSPECT_TOOL_CODES)] };

const INSPECT_TOKEN_ARGS: Record<string, Schema> = {
  tokens: { type: 'object', description: "A token document to inspect instead of this server's design system: DTCG, a Tokens Studio export with $themes and $metadata, or a lolly-design-context file.", additionalProperties: true },
  theme: { type: 'string', description: 'One theme by name, id or group/name, as a single-theme render link gives one. Not taken with selection.' },
  selection: { type: 'object', description: 'One theme id per theme group, e.g. {"appearance":"night","density":"roomy"}: the _themes value of a render link. A group left out takes its default choice, as a render link does.', additionalProperties: { type: 'string' } },
  token: { type: 'string', description: 'A dotted token path to explain and trace, e.g. color.semantic.primary.' },
  depth: { type: 'integer', minimum: 1, maximum: TOKEN_REPORT_LIMITS.depthMax, description: `Reference steps the trace follows in each direction (default ${TOKEN_REPORT_LIMITS.depthDefault}).` },
  query: { type: 'string', description: 'List only tokens whose path contains this text (case-insensitive).' },
  type: { type: 'string', description: 'List only tokens of this $type, e.g. color or dimension.' },
  set: { type: 'string', description: 'List only tokens with a definition in this source set.' },
  issuesOnly: { type: 'boolean', description: 'List only tokens that carry an issue.' },
  offset: { type: 'integer', minimum: 0, description: 'Skip this many matching tokens (default 0).' },
  limit: { type: 'integer', minimum: 1, maximum: TOKEN_REPORT_LIMITS.listMax, description: `List at most this many tokens (default ${TOKEN_REPORT_LIMITS.listDefault}).` },
};

export const TOKEN_INSPECT_TOOL_DEF = {
  name: 'lolly_inspect_tokens',
  description:
    "Explain a design system's tokens without rendering: the effective theme choices (one per group, which fell to a default, and the set order), " +
    'issues such as missing references, cycles and unknown choices, and a page of tokens with their resolved values. ' +
    'Name a token to get its authored and resolved value, the winning set and override order, the roles the document declares for the token, ' +
    'and a bounded trace of the tokens it reads (towards its primitives) and the tokens that read this one. ' +
    "Reads this server's design system (the one lolly://design-context describes) unless you pass tokens. Choices are a preview; nothing is written. " +
    'Counts cover this token document only, not tool hooks or other documents.',
  inputSchema: { type: 'object', properties: INSPECT_TOKEN_ARGS, additionalProperties: false },
  outputSchema: TOKEN_INSPECT_OUTPUT_SCHEMA,
};

const isTokenRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const invalidTokenRequest = (message: string): ToolCodeError<TokenInspectToolCodeV1> => new ToolCodeError('request.invalid', message);

function textArg(args: Record<string, unknown>, key: string, max = 1024): string | undefined {
  const value = args[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !value.trim()) throw invalidTokenRequest(`${key} must be a non-empty string.`);
  if (value.length > max) throw invalidTokenRequest(`${key} is longer than ${max} characters.`);
  return value;
}

function wholeArg(args: Record<string, unknown>, key: string, min: number, max: number): number | undefined {
  const value = args[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) throw invalidTokenRequest(`${key} must be a whole number from ${min} to ${max}.`);
  return value;
}

/** The document and where it came from: the supplied one, else the server's profile. */
function tokenSourceOf(args: Record<string, unknown>): { doc: unknown; origin: TokenReportOriginV1 } {
  if (args.tokens !== undefined) {
    if (!isTokenRecord(args.tokens)) throw new ToolCodeError<TokenInspectToolCodeV1>('tokens.unreadable', 'tokens must be a token document object.');
    const out = coerceTokensDoc(contextTokens(args.tokens));
    if (!out.doc) throw new ToolCodeError<TokenInspectToolCodeV1>('tokens.unreadable', `tokens is not a readable token document${out.warnings[0] ? `: ${out.warnings[0]}` : '.'}`);
    return { doc: out.doc, origin: { kind: 'supplied' } };
  }
  const profile = readProfileTokenDocument();
  if (!profile) throw new ToolCodeError<TokenInspectToolCodeV1>('tokens.unavailable', "This server's content profile ships no design tokens. Pass tokens to inspect a document of your own.");
  return { doc: profile.doc, origin: { kind: 'profile', id: profile.profile, ...(profile.label ? { label: profile.label } : {}), tokensAsset: profile.tokensAsset } };
}

function choicesSentence(choices: Record<string, string>): string {
  const entries = Object.entries(choices);
  return entries.length ? entries.map(([group, id]) => `${group || 'theme'} ${id}`).join(', ') : 'no theme groups';
}

/** Inspect a token document. Never throws: a failure is an error result with its code. */
export async function callInspectTokens(
  args: Record<string, unknown>,
  env: Env = process.env,
  limits: Readonly<StructuredLimitsV1> = STRUCTURED_LIMITS,
): Promise<StructuredResult> {
  const ctx: StructuredCtx = { env, limits };
  try {
    const extra = Object.keys(args).find((key) => !Object.hasOwn(INSPECT_TOKEN_ARGS, key));
    if (extra) throw invalidTokenRequest(`lolly_inspect_tokens takes ${Object.keys(INSPECT_TOKEN_ARGS).join(', ')}, not ${extra}.`);
    const theme = textArg(args, 'theme', 256);
    if (theme !== undefined && args.selection !== undefined) throw invalidTokenRequest('Pass theme or selection, not both.');
    let selection: Record<string, string> | undefined;
    if (args.selection !== undefined) {
      if (!isTokenRecord(args.selection)) throw invalidTokenRequest('selection must be an object of theme group ids to theme ids.');
      try { selection = parseTokenSelection(JSON.stringify(args.selection)); }
      catch (err) { throw invalidTokenRequest(err instanceof Error ? err.message : String(err)); }
    }
    const token = textArg(args, 'token');
    const depth = wholeArg(args, 'depth', 1, TOKEN_REPORT_LIMITS.depthMax);
    if (depth !== undefined && token === undefined) throw invalidTokenRequest('depth sets how far a trace follows: pass it with token.');
    if (args.issuesOnly !== undefined && typeof args.issuesOnly !== 'boolean') throw invalidTokenRequest('issuesOnly must be true or false.');
    const list = {
      query: textArg(args, 'query'),
      type: textArg(args, 'type', 256),
      set: textArg(args, 'set'),
      issuesOnly: args.issuesOnly === true ? true : undefined,
      offset: wholeArg(args, 'offset', 0, Number.MAX_SAFE_INTEGER),
      limit: wholeArg(args, 'limit', 1, TOKEN_REPORT_LIMITS.listMax),
    };
    const { doc, origin } = tokenSourceOf(args);
    const report = tokenReport(doc, {
      origin,
      ...(theme !== undefined ? { theme } : {}),
      ...(selection !== undefined ? { selection } : {}),
      ...(token !== undefined ? { token } : {}),
      ...(depth !== undefined ? { depth } : {}),
      ...Object.fromEntries(Object.entries(list).filter(([, value]) => value !== undefined)),
    });
    const name = origin.kind === 'profile' ? `${origin.label ?? origin.id} (content profile ${origin.id})` : 'the supplied document';
    const problems = [
      report.counts.diagnostics ? plural(report.counts.diagnostics, 'document issue') : '',
      report.counts.withIssues ? `${plural(report.counts.withIssues, 'token')} with issues` : '',
    ].filter(Boolean).join(' and ');
    const traced = report.trace
      ? ` ${report.trace.path} reads ${plural(report.trace.references.length, 'token')} and is read by ${plural(report.trace.dependents.length, 'token')}${report.trace.truncated ? ' (trace stopped at a limit)' : ''}.`
      : '';
    const sentence = `Inspected ${plural(report.counts.tokens, 'token')} in ${name} with ${choicesSentence(report.context.selection.choices)}${report.context.preview ? ' (a preview; the stored choices differ)' : ''}: ` +
      `${problems || 'no issues'}.${traced}`;
    // Through JSON once, so an optional field left undefined in a source document is
    // absent from structuredContent, as it is from the JSON text in content[1].
    const structured = JSON.parse(JSON.stringify(report)) as Record<string, unknown>;
    return success<TokenInspectToolCodeV1>(sentence, structured, [], ctx, 'output.too-large', 'pass a smaller limit, a query, or a token.');
  } catch (err) {
    if (err instanceof ToolCodeError && Object.hasOwn(INSPECT_TOKEN_CODES, err.code)) return failure(err);
    if (err instanceof TokenReportError) return failure(new ToolCodeError<TokenInspectToolCodeV1>(err.code, err.message));
    return failure(new ToolCodeError<TokenInspectToolCodeV1>('internal', err instanceof Error ? err.message : String(err)));
  }
}
