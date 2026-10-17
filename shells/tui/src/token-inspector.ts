// SPDX-License-Identifier: MPL-2.0
/**
 * The data side of the TUI's token inspector (plan 286 M5): the token document a
 * terminal render uses, the theme choices a person steps through, and the reviewed
 * write that stores them. The report itself is the shared one in
 * @lolly-tools/node-shell/token-report, which the MCP `lolly_inspect_tokens` tool
 * also returns, so the two surfaces explain one document the same way.
 */
import { canonicalJson, diffTokenDocuments } from '@lolly/engine';
import { readProfileTokenDocument } from '@lolly-tools/node-shell/design-brief';
import { activeNodeDesignSystem, readActiveDesignSystemTokens, writeNodeDesignSystemTokens } from '@lolly-tools/node-shell/design-systems';
import type { TokenReportOriginV1 } from '@lolly-tools/node-shell/token-report';
import type { TokenSelection } from '@lolly-tools/core/host-v1';

export interface TerminalTokenSource {
  doc: unknown;
  origin: TokenReportOriginV1;
  /** True for a terminal system, whose stored choices this screen may change. */
  writable: boolean;
}

/**
 * The document a terminal render reads, in the CLI bridge's order: the active
 * terminal system when it holds tokens, else the content profile's head tokens asset.
 */
export async function readTerminalTokenSource(): Promise<TerminalTokenSource | null> {
  const active = await activeNodeDesignSystem().catch(() => null);
  if (active?.tokensFile) {
    const doc = await readActiveDesignSystemTokens();
    if (doc) return { doc, origin: { kind: 'terminal', id: active.id, label: active.label }, writable: true };
  }
  const profile = readProfileTokenDocument();
  if (!profile) return null;
  return {
    doc: profile.doc,
    origin: { kind: 'profile', id: profile.profile, ...(profile.label ? { label: profile.label } : {}), tokensAsset: profile.tokensAsset },
    writable: false,
  };
}

/** The choice map with one group moved to its next (or previous) option, wrapping. */
export function stepChoice(selection: Pick<TokenSelection, 'groups'>, choices: Record<string, string>, group: number, step: 1 | -1 = 1): Record<string, string> {
  const target = selection.groups[group];
  if (!target?.options.length) return choices;
  const at = target.options.findIndex(o => o.id === choices[target.id]);
  const next = target.options[(at + step + target.options.length) % target.options.length]!;
  return { ...choices, [target.id]: next.id };
}

/** The document with `choices` stored as its theme selection, and how many resolved values change. */
export function withStoredChoices(doc: unknown, choices: Record<string, string>): { candidate: Record<string, unknown>; changes: number } {
  const base = doc && typeof doc === 'object' && !Array.isArray(doc) ? doc as Record<string, unknown> : {};
  const candidate = structuredClone(base);
  const metadata = candidate.$metadata && typeof candidate.$metadata === 'object' && !Array.isArray(candidate.$metadata) ? candidate.$metadata as Record<string, unknown> : {};
  candidate.$metadata = { ...metadata, activeThemeSelection: { ...choices } };
  return { candidate, changes: diffTokenDocuments(base, candidate).length };
}

/**
 * Store a reviewed candidate on the active terminal system. Refuses with `stale` when
 * the active system or its tokens changed after `source` was read, so a review never
 * replaces an edit made in another shell.
 */
export async function storeTerminalChoices(source: TerminalTokenSource, candidate: Record<string, unknown>): Promise<'stored' | 'stale'> {
  if (!source.writable || source.origin.kind !== 'terminal') throw new Error('Only a terminal design system can store theme choices.');
  const active = await activeNodeDesignSystem();
  if (!active || active.id !== source.origin.id) return 'stale';
  if (canonicalJson(await readActiveDesignSystemTokens()) !== canonicalJson(source.doc)) return 'stale';
  await writeNodeDesignSystemTokens({ id: active.id, tokens: candidate, source: active.source });
  return 'stored';
}

/** One value on one terminal line: strings as written, anything else as compact JSON, cut at `max`. */
export function terminalValue(value: unknown, max = 60): string {
  const text = value === undefined ? 'unavailable' : typeof value === 'string' ? value : JSON.stringify(value) ?? String(value);
  return text.length > max ? `${text.slice(0, Math.max(1, max - 1))}…` : text;
}
