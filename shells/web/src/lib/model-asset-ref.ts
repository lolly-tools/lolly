// SPDX-License-Identifier: MPL-2.0
import type { AssetRef } from '@lolly-tools/core/host-v1';

/**
 * The resolved asset with this id among an input model's values, or undefined. The
 * runtime's resolveAssetRefs has already turned each asset slot into its ref, so a
 * panel can read one straight off the model without reaching the catalog. Blocks nest
 * their own asset fields, so the walk covers the cells of array values too.
 */
export function assetRefInModel(model: ReadonlyArray<{ value?: unknown }>, id: string): AssetRef | undefined {
  const match = (v: unknown): v is AssetRef => !!v && typeof v === 'object' && (v as AssetRef).id === id;
  for (const item of model) {
    if (match(item.value)) return item.value;
    if (!Array.isArray(item.value)) continue;
    for (const row of item.value) {
      for (const cell of Object.values((row ?? {}) as Record<string, unknown>)) if (match(cell)) return cell;
    }
  }
  return undefined;
}
