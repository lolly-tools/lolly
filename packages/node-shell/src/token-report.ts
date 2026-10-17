// SPDX-License-Identifier: MPL-2.0
/**
 * One design-token report for the terminal and agent surfaces (plan 286 M5): the
 * normalized theme selection, the diagnostics, a bounded dependency trace for one
 * token and the context that produced them. The TUI's token inspector and the MCP
 * `lolly_inspect_tokens` tool both read it from here, over the engine's
 * `inspectTokenDocument`, so the two never explain one document differently.
 *
 * Counts cover the token document only: references between its own tokens and the
 * roles it declares. Tool hooks, other documents and observed render usage are not
 * counted. Every list is bounded and says when it stopped early.
 *
 * Pure apart from hashing: no filesystem, network or clock.
 */
import { createHash } from 'node:crypto';

import { canonicalJson, inspectTokenDocument, resolveTokenSelection } from '@lolly/engine';
import type { TokenDiagnostic, TokenInspection, TokenResolveOptions, TokenSelection, TokenSource, TokenTrace } from '@lolly-tools/core/host-v1';

/** The bounds every report keeps, so one call stays small on any document. */
export const TOKEN_REPORT_LIMITS = Object.freeze({
  /** Rows a token list returns when the caller gives no limit. */
  listDefault: 50,
  /** The most rows one list returns. */
  listMax: 200,
  /** Reference steps a trace follows when the caller gives no depth. */
  depthDefault: 8,
  /** The most reference steps a trace follows. */
  depthMax: 16,
  /** Tokens one trace direction lists before it stops. */
  traceNodes: 200,
  /** Document diagnostics, and token issues, each list holds. */
  issues: 100,
});

/** Where the inspected document came from. */
export interface TokenReportOriginV1 {
  /** `terminal`: the CLI and TUI's active system; `profile`: the content profile's tokens asset; `supplied`: given with the call. */
  kind: 'terminal' | 'profile' | 'supplied';
  /** The terminal system's id, or the content profile's name. */
  id?: string;
  label?: string;
  /** The catalog id of a profile's tokens asset. */
  tokensAsset?: string;
}

/** The context a report was made in: which document, which revision and which theme choices. */
export interface TokenReportContextV1 {
  origin: TokenReportOriginV1;
  /** `sha256:` of the document's canonical JSON, so two reports can say they read the same revision. */
  revision: string;
  /** The choices the caller asked for, as given. */
  requested: TokenResolveOptions;
  /** Theme groups and their options, one effective choice per group, the groups left at their default, and the effective set order. */
  selection: Omit<TokenSelection, 'diagnostics'>;
  /** The choices the document stores, or its defaults: what a render uses when no choice is passed. */
  stored: Record<string, string>;
  /** True when the effective choices differ from the stored ones. A preview changes nothing. */
  preview: boolean;
}

/** One row of a token list. */
export interface TokenRowV1 {
  path: string;
  type: string | null;
  /** The set holding the winning definition; null for a single-set document or an inactive token. */
  set: string | null;
  /** False when no active set defines the token under these choices. */
  active: boolean;
  resolved?: unknown;
  /** How many issues the token itself carries. */
  issues: number;
}

/** A filtered, paged token list. */
export interface TokenListV1 {
  /** Tokens matching the filter, before paging. */
  total: number;
  offset: number;
  limit: number;
  rows: TokenRowV1[];
}

export interface TokenListQueryV1 {
  /** Case-insensitive text the path contains. */
  query?: string;
  type?: string;
  /** A source set any of the token's definitions sits in. */
  set?: string;
  issuesOnly?: boolean;
  offset?: number;
  limit?: number;
}

/** One token reached by a trace. */
export interface TokenTraceStepV1 {
  path: string;
  /** Reference steps from the traced token: 1 for a direct reference. */
  depth: number;
  /** The token one step nearer the traced token, which reads or is read by this one. */
  via: string;
  type: string | null;
  resolved?: unknown;
  /** Set when no active definition answers this path under these choices. */
  missing?: true;
}

/** Why one token has its value, and which tokens depend on that token. */
export interface TokenDependencyTraceV1 {
  path: string;
  type: string | null;
  authored?: unknown;
  resolved?: unknown;
  /** The winning definition, or null when no active set defines the token. */
  source: TokenSource | null;
  /** Every retained definition in set order: the override order. */
  candidates: TokenSource[];
  /** Roles this document declares for the token. Declarations, not observed usage or rule checks. */
  declaredConsumers: NonNullable<TokenTrace['declaredConsumers']>;
  diagnostics: TokenDiagnostic[];
  /** What this token reads, breadth first: direct references at depth 1, then theirs. */
  references: TokenTraceStepV1[];
  /** Tokens in this document that read this one, breadth first. */
  dependents: TokenTraceStepV1[];
  /** The most reference steps this trace followed. */
  depth: number;
  /** True when a direction stopped at the depth or the node limit with more to follow. */
  truncated: boolean;
}

export interface TokenReportV1 {
  format: 'lolly-token-report';
  version: 1;
  /** Counts cover token references and declared roles in this document only. */
  scope: 'token-document';
  context: TokenReportContextV1;
  counts: { tokens: number; active: number; inactive: number; withIssues: number; diagnostics: number };
  /** Selection and document-level diagnostics, at most `TOKEN_REPORT_LIMITS.issues`. */
  diagnostics: TokenDiagnostic[];
  /** Issues on individual tokens, at most `TOKEN_REPORT_LIMITS.issues`. */
  issues: TokenDiagnostic[];
  list: TokenListV1;
  trace?: TokenDependencyTraceV1;
  /** True when inspection or a list stopped at a limit, so counts are incomplete. */
  truncated: boolean;
}

export interface TokenReportOptionsV1 extends TokenListQueryV1 {
  origin: TokenReportOriginV1;
  theme?: string;
  selection?: Record<string, string>;
  /** A dotted token path to trace. */
  token?: string;
  depth?: number;
}

/** A request the report cannot answer, with a stable code. */
export class TokenReportError extends Error {
  readonly code: 'token.unknown';
  constructor(code: 'token.unknown', message: string) {
    super(message);
    this.name = 'TokenReportError';
    this.code = code;
  }
}

const clampWhole = (value: number | undefined, fallback: number, min: number, max: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.trunc(value))) : fallback;

/** `sha256:<hex>` of the canonical JSON, so key order never changes the revision. */
export function tokenRevision(doc: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalJson(doc ?? null)).digest('hex')}`;
}

/** The theme choices a document stores (or defaults to), with the request's options left out. */
export function storedTokenChoices(doc: unknown): Record<string, string> {
  return resolveTokenSelection(doc, {}).choices;
}

/** The report context for one inspection of `doc`. */
export function tokenReportContext(doc: unknown, inspection: TokenInspection, origin: TokenReportOriginV1, requested: TokenResolveOptions = {}): TokenReportContextV1 {
  const { diagnostics: _diagnostics, ...selection } = inspection.selection;
  const stored = storedTokenChoices(doc);
  const asked: TokenResolveOptions = {
    ...(requested.theme !== undefined ? { theme: requested.theme } : {}),
    ...(requested.selection !== undefined ? { selection: { ...requested.selection } } : {}),
  };
  return {
    origin: { ...origin },
    revision: tokenRevision(doc),
    requested: asked,
    selection,
    stored,
    preview: canonicalJson(stored) !== canonicalJson(selection.choices),
  };
}

/** Selection and document diagnostics, token issues, and how many tokens carry one. */
export function tokenIssues(inspection: TokenInspection): { diagnostics: TokenDiagnostic[]; issues: TokenDiagnostic[]; withIssues: number; total: number } {
  const issues: TokenDiagnostic[] = [];
  let withIssues = 0;
  let total = 0;
  for (const token of inspection.tokens) {
    if (!token.diagnostics.length) continue;
    withIssues++;
    total += token.diagnostics.length;
    for (const issue of token.diagnostics) if (issues.length < TOKEN_REPORT_LIMITS.issues) issues.push({ ...issue });
  }
  return { diagnostics: inspection.diagnostics.slice(0, TOKEN_REPORT_LIMITS.issues).map(d => ({ ...d })), issues, withIssues, total };
}

function tokenRow(token: TokenTrace): TokenRowV1 {
  return {
    path: token.path,
    type: token.type,
    set: token.source?.set ?? null,
    active: !!token.source,
    ...(token.source && token.resolved !== undefined ? { resolved: token.resolved } : {}),
    issues: token.diagnostics.length,
  };
}

/** A filtered page of the document's tokens, in document order. */
export function listTokenRows(inspection: TokenInspection, query: TokenListQueryV1 = {}): TokenListV1 {
  const text = query.query?.trim().toLowerCase() ?? '';
  const matches = inspection.tokens.filter(token =>
    (!text || token.path.toLowerCase().includes(text))
    && (!query.type || token.type === query.type)
    && (!query.set || token.candidates.some(c => (c.set ?? '') === query.set))
    && (!query.issuesOnly || token.diagnostics.length > 0));
  const limit = clampWhole(query.limit, TOKEN_REPORT_LIMITS.listDefault, 1, TOKEN_REPORT_LIMITS.listMax);
  const offset = clampWhole(query.offset, 0, 0, Number.MAX_SAFE_INTEGER);
  return { total: matches.length, offset, limit, rows: matches.slice(offset, offset + limit).map(tokenRow) };
}

/** Breadth-first steps from `start` through `next`, stopping at `depth` steps or the node limit. */
function walkTrace(start: TokenTrace, byPath: Map<string, TokenTrace>, next: (token: TokenTrace) => string[], depth: number): { steps: TokenTraceStepV1[]; truncated: boolean } {
  const steps: TokenTraceStepV1[] = [];
  const seen = new Set([start.path]);
  let frontier = [start];
  for (let level = 1; frontier.length; level++) {
    const following: TokenTrace[] = [];
    for (const node of frontier) {
      for (const path of next(node)) {
        if (seen.has(path)) continue;
        if (level > depth || steps.length >= TOKEN_REPORT_LIMITS.traceNodes) return { steps, truncated: true };
        seen.add(path);
        const token = byPath.get(path);
        steps.push({
          path,
          depth: level,
          via: node.path,
          type: token?.type ?? null,
          ...(token?.source ? (token.resolved !== undefined ? { resolved: token.resolved } : {}) : { missing: true as const }),
        });
        if (token?.source) following.push(token);
      }
    }
    frontier = following;
  }
  return { steps, truncated: false };
}

/** The value, source, override order, references and dependents of one token; null when the document has no such path. */
export function traceToken(inspection: TokenInspection, path: string, depth: number = TOKEN_REPORT_LIMITS.depthDefault): TokenDependencyTraceV1 | null {
  const byPath = new Map(inspection.tokens.map(t => [t.path, t]));
  const token = byPath.get(path);
  if (!token) return null;
  const steps = clampWhole(depth, TOKEN_REPORT_LIMITS.depthDefault, 1, TOKEN_REPORT_LIMITS.depthMax);
  const references = walkTrace(token, byPath, t => t.references, steps);
  const dependents = walkTrace(token, byPath, t => t.usedBy, steps);
  return {
    path: token.path,
    type: token.type,
    ...(token.authored !== undefined ? { authored: token.authored } : {}),
    ...(token.resolved !== undefined ? { resolved: token.resolved } : {}),
    source: token.source,
    candidates: token.candidates,
    declaredConsumers: token.declaredConsumers ?? [],
    diagnostics: token.diagnostics,
    references: references.steps,
    dependents: dependents.steps,
    depth: steps,
    truncated: references.truncated || dependents.truncated,
  };
}

/** Up to five paths that look like `path`, for a message about a path the document lacks. */
export function similarTokenPaths(inspection: TokenInspection, path: string, count = 5): string[] {
  const wanted = path.toLowerCase();
  const leaf = wanted.split('.').pop() ?? wanted;
  const near = inspection.tokens.filter(t => t.path.toLowerCase().includes(wanted));
  const others = inspection.tokens.filter(t => !near.includes(t) && leaf && t.path.toLowerCase().split('.').pop() === leaf);
  return [...near, ...others].slice(0, count).map(t => t.path);
}

/** The whole report for one document. Throws `TokenReportError` for a `token` the document lacks. */
export function tokenReport(doc: unknown, opts: TokenReportOptionsV1): TokenReportV1 {
  const requested: TokenResolveOptions = {
    ...(opts.theme !== undefined ? { theme: opts.theme } : {}),
    ...(opts.selection !== undefined ? { selection: opts.selection } : {}),
  };
  const inspection = inspectTokenDocument(doc, requested);
  const context = tokenReportContext(doc, inspection, opts.origin, requested);
  const issues = tokenIssues(inspection);
  const list = listTokenRows(inspection, opts);
  let trace: TokenDependencyTraceV1 | undefined;
  if (opts.token !== undefined) {
    const found = traceToken(inspection, opts.token, opts.depth);
    if (!found) {
      const near = similarTokenPaths(inspection, opts.token);
      throw new TokenReportError('token.unknown', `This document has no token ${opts.token}.${near.length ? ` Similar paths: ${near.join(', ')}.` : ' Pass query to search the paths.'}`);
    }
    trace = found;
  }
  const active = inspection.tokens.filter(t => t.source).length;
  return {
    format: 'lolly-token-report',
    version: 1,
    scope: 'token-document',
    context,
    counts: { tokens: inspection.tokens.length, active, inactive: inspection.tokens.length - active, withIssues: issues.withIssues, diagnostics: inspection.diagnostics.length },
    diagnostics: issues.diagnostics,
    issues: issues.issues,
    list,
    ...(trace ? { trace } : {}),
    truncated: inspection.truncated || inspection.diagnostics.length > issues.diagnostics.length || issues.total > issues.issues.length,
  };
}
