// SPDX-License-Identifier: MPL-2.0
import { canonicalRevisionData, isRefetchableRemote } from './revision-snapshot.ts';
import type { SavedStateData } from './state.ts';

/** New captures pin versioned uploads to their retained bytes. Kept separate
 * from archive canonicalisation: importing an older checkpoint cannot rewrite
 * its content hash. Catalog/tool/font/theme archives remain separate work. */
export function pinRevisionAssets(data: SavedStateData): SavedStateData {
  const copy = canonicalRevisionData(data);
  const walk = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { for (const item of value) walk(item); return; }
    const ref = value as Record<string, unknown>;
    // A remote file or tool link is fetched or rendered again from its id on
    // open, so a new capture keeps the id alone, never a copy of the bytes.
    const baked = !!ref.meta && typeof ref.meta === 'object' && (ref.meta as Record<string, unknown>).baked === true;
    if (!baked && isRefetchableRemote(ref)) { delete ref.url; delete ref.original; }
    if (ref.source === 'user' && typeof ref.id === 'string' && ref.id.startsWith('user/')
      && typeof ref.version === 'string' && ref.version && typeof ref.format === 'string' && ref.format && ref.pin === undefined) {
      ref.pin = { version: ref.version, format: ref.format };
    }
    for (const item of Object.values(ref)) walk(item);
  };
  walk(copy);
  return copy;
}
