// SPDX-License-Identifier: MPL-2.0
/** Saved dependency scanning loads when retention or revision history needs it. */
import { textFontAssetIds } from '../../../../engine/src/text-assets.ts';
import { assetDependency } from '../../../../engine/src/asset-version.ts';
import { sceneRowAssetIds } from './asset-dependencies.ts';

/** Metadata-only roots for cache retention and explicit version deletion. */
export function collectAssetRefs(value: unknown, refs: Set<string>): void {
  if (typeof value === 'string' && value.includes('#lolly-version=')) {
    try {
      const dep = assetDependency({ id: value });
      if (dep.pin?.format) refs.add(`${dep.id}:${dep.pin.format}:${dep.pin.version}`);
    } catch { /* An invalid link is not an available dependency. */ }
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { for (const item of value) collectAssetRefs(item, refs); return; }
  const record = value as Record<string, unknown>;
  // A scene box's uploads are ids inside its `scene` query, never refs in the row, so
  // they are read out explicitly. Only a PINNED id becomes a root, exactly as for a ref
  // below: retention is about held versions, and an unpinned id names no version.
  for (const id of [...sceneRowAssetIds(record), ...textFontAssetIds(record.textDocument)]) {
    const dep = assetDependency({ id });
    if (dep.pin?.version != null && dep.pin.format) refs.add(`${dep.id}:${dep.pin.format}:${dep.pin.version}`);
  }
  if ((record.source === 'library' || record.source === 'user') && typeof record.id === 'string') {
    const dep = assetDependency(record as { id: string });
    const version = dep.pin?.version ?? record.version;
    const format = dep.pin?.format ?? record.format;
    if (version != null && format) { refs.add(`${dep.id}:${format}:${version}`); return; }
  }
  for (const item of Object.values(record)) collectAssetRefs(item, refs);
}
