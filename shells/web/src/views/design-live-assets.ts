// SPDX-License-Identifier: MPL-2.0
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { assetVersionPin, decodeAssetVersion } from '../../../../engine/src/asset-version.ts';

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** Prepare only changed asset references, so history records the same values the preview draws. */
export async function prepareLiveAssets(rows: unknown[], before: unknown[], fields: unknown[], assets: Pick<HostV1['assets'], 'get'>): Promise<unknown[]> {
  const assetFields = fields.filter(record).filter(field => field.type === 'asset').map(field => String(field.id));
  if (!assetFields.length) return rows;
  const previous = new Map(before.filter(record).map(row => [row.id, row]));
  return await Promise.all(rows.map(async raw => {
    if (!record(raw)) return raw;
    let next = raw;
    const old = previous.get(raw.id);
    for (const field of assetFields) {
      const value = raw[field];
      if (JSON.stringify(value) === JSON.stringify(old?.[field])) continue;
      if (record(value) && typeof value.url === 'string' && value.url) continue;
      const id = typeof value === 'string' ? value : record(value) && typeof value.id === 'string' ? value.id : '';
      if (!id) continue;
      const decoded = decodeAssetVersion(id);
      const pin = assetVersionPin(value) ?? decoded.pin;
      const ref = await assets.get(decoded.id, pin);
      if (pin && (ref.version !== pin.version || (pin.format && ref.format !== pin.format))) throw new Error('The pinned asset version is unavailable.');
      if (next === raw) next = { ...raw };
      next[field] = pin ? { ...ref, pin } : ref;
    }
    return next;
  }));
}
