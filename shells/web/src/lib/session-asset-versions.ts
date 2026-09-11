// SPDX-License-Identifier: MPL-2.0
import { assetDependency, decodeAssetVersion } from '../../../../engine/src/asset-version.ts';
import type { BeamAssetRecord } from './beam-pack.ts';

/** Resolve only the exact dependency being exported. Two versions of one id
 * receive distinct closure keys; a missing old version never sends the head. */
export async function resolveSessionUserAsset(key: string, records: ReadonlyMap<string, BeamAssetRecord>,
  read?: (id: string, version?: string) => Promise<BeamAssetRecord | null>): Promise<BeamAssetRecord | null> {
  const { id, pin } = decodeAssetVersion(key);
  let record = records.get(id);
  if (pin && record?.version !== pin.version) record = await read?.(id, pin.version) ?? undefined;
  if (!record || (pin && (record.version !== pin.version || (pin.format && record.format !== pin.format)))) return null;
  return { ...record, id: key };
}

/** Imported pins name the receiver's stored version, including sanitisation
 * and deduplication. Withheld dependencies keep the sender's original pin. */
export function rebaseImportedAssetPins<T>(data: T, rekey: ReadonlyMap<string, string>, records: readonly BeamAssetRecord[]): T {
  const received = new Set(rekey.values());
  const versions = new Map(records.map(record => [record.id, record]));
  const walk = (value: unknown, depth: number): unknown => {
    if (!value || typeof value !== 'object' || depth > 64) return value;
    if (Array.isArray(value)) return value.map(item => walk(item, depth + 1));
    const ref = value as Record<string, unknown>;
    if (typeof ref.id === 'string' && ref.source === 'user') {
      const dep = assetDependency(ref as { id: string });
      if (dep.pin && received.has(dep.id)) {
        const record = versions.get(dep.id);
        if (!record?.version) throw new Error('This shell cannot retain the imported asset version.');
        return { ...ref, id: dep.id + dep.modifier, version: record.version, format: record.format,
          pin: { version: record.version, format: record.format }, url: '' };
      }
    }
    return Object.fromEntries(Object.entries(ref).map(([key, item]) => [key, walk(item, depth + 1)]));
  };
  return walk(data, 0) as T;
}
