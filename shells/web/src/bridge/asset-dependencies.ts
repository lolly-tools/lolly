// SPDX-License-Identifier: MPL-2.0
import { assetDependency } from '../../../../engine/src/asset-version.ts';

/** Metadata-only roots for cache retention and explicit version deletion. */
export function collectAssetRefs(value: unknown, refs: Set<string>): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { for (const item of value) collectAssetRefs(item, refs); return; }
  const record = value as Record<string, unknown>;
  if ((record.source === 'library' || record.source === 'user') && typeof record.id === 'string') {
    const dep = assetDependency(record as { id: string });
    const version = dep.pin?.version ?? record.version;
    const format = dep.pin?.format ?? record.format;
    if (version != null && format) { refs.add(`${dep.id}:${format}:${version}`); return; }
  }
  for (const item of Object.values(record)) collectAssetRefs(item, refs);
}
