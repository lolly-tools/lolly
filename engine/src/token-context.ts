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
  if (!host.tokens) return host.assets ? { ...host, assets: withAssetSelection(host.assets, selection) } : host;
  const base = host.tokens, choices = structuredClone(selection);
  return { ...host, ...(host.assets ? { assets: withAssetSelection(host.assets, choices) } : {}), tokens: {
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

/**
 * Asset reads that carry the document's theme choice (plan 291 W7), so a photo look
 * with theme variants bakes the variant of that theme. Every other member is the
 * host's own, copied the way the shells' own asset wrappers copy the asset bridge.
 */
function withAssetSelection(assets: HostV1['assets'], selection: Record<string, string>): HostV1['assets'] {
  const choices = structuredClone(selection);
  return { ...assets, get: (id, opts) => assets.get(id, { ...opts, tokenSelection: choices }) };
}
