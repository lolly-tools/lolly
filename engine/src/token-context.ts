// SPDX-License-Identifier: MPL-2.0
/** Document-scoped token reads and captured snapshots. */
import type { HostV1, TokenResolveOptions } from './bridge/host-v1.ts';
import { resolveTokenSelection } from './token-selection.ts';

/** Explicit API options supersede a document's default choices, including legacy theme calls. */
export function scopedTokenOptions(selection: Record<string, string> | undefined, opts: TokenResolveOptions = {}): TokenResolveOptions {
  return opts.selection !== undefined || opts.theme ? opts : { selection, ...opts };
}

/** A document's choices scope token reads without changing the shell's active system. */
export function withTokenSelection(host: HostV1, selection: Record<string, string>): HostV1 {
  if (!host.tokens) return host;
  const base = host.tokens, choices = structuredClone(selection);
  return { ...host, tokens: {
    ...base,
    get: (opts = {}) => base.get(scopedTokenOptions(choices, opts)),
    colors: (opts = {}) => base.colors(scopedTokenOptions(choices, opts)),
    resolve: (ref, opts = {}) => base.resolve(ref, scopedTokenOptions(choices, opts)),
    ...(base.inspect ? { inspect: (opts = {}) => base.inspect!(scopedTokenOptions(choices, opts)) } : {}),
    ...(base.snapshot ? { snapshot: async () => {
      const snapshot = await base.snapshot!();
      const scoped = (source: unknown): unknown => {
        const document = structuredClone(source);
        if (document && typeof document === 'object' && !Array.isArray(document)) {
          const d = document as Record<string, unknown>;
          d.$metadata = { ...(d.$metadata as object ?? {}), activeThemeSelection: choices };
        }
        return document;
      };
      const document = scoped(snapshot.document);
      return { ...snapshot, document, ...(snapshot.renderDocument !== undefined ? { renderDocument: scoped(snapshot.renderDocument) } : {}), selection: { ...snapshot.selection, choices: resolveTokenSelection(document, { selection: choices }).choices } };
    } } : {}),
  } };
}
