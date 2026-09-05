// SPDX-License-Identifier: MPL-2.0
/** Pure grammar for logical asset references. Resolution belongs to HostV1. */
export const ASSET_PROVIDER_REF_RE = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]+)(?:\/([^?#]*))?(?:\?([^#]*))?$/;
export interface AssetProviderRef { raw: string; provider: string; scope: string; path: string; query: Readonly<Record<string, string>> }
export function parseProviderRef(value: unknown): AssetProviderRef | null {
  if (typeof value !== 'string') return null;
  const match = ASSET_PROVIDER_REF_RE.exec(value);
  if (!match) return null;
  try {
    const query: Record<string, string> = {};
    for (const [key, item] of new URLSearchParams(match[4] ?? '')) query[key] = item;
    return { raw: value, provider: match[1]!.toLowerCase(), scope: decodeURIComponent(match[2]!), path: (match[3] ?? '').split('/').filter(Boolean).map(decodeURIComponent).join('/'), query };
  } catch { return null; }
}
export function isProviderRef(value: unknown): value is string { return parseProviderRef(value) !== null; }
