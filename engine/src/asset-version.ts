// SPDX-License-Identifier: MPL-2.0
/** Explicit asset versions, portable through typed state and URL-mode values.
 * The suffix leaves legacy ids (including user/ privacy filtering and theme
 * modifiers) intact. Only an explicit pin changes latest-resolution semantics. */
import type { AssetRef } from './bridge/host-v1.ts';
import { stripAssetModifiers } from './photo-treatment.ts';

export type AssetVersionPin = NonNullable<AssetRef['pin']>;
const MARKER = '#lolly-version=';

export function assetVersionPin(value: unknown): AssetVersionPin | undefined {
  if (!value || typeof value !== 'object' || !('pin' in value) || value.pin === undefined) return;
  const pin = value.pin;
  if (!pin || typeof pin !== 'object' || !('version' in pin) || typeof pin.version !== 'string'
    || !pin.version || pin.version.length > 256
    || ('format' in pin && pin.format !== undefined && (typeof pin.format !== 'string' || !pin.format || pin.format.length > 100))) {
    throw new Error('Invalid pinned asset version.');
  }
  return { version: pin.version, ...('format' in pin && typeof pin.format === 'string' ? { format: pin.format } : {}) };
}

export function encodeAssetVersion(id: string, pin?: AssetVersionPin): string {
  if (!pin) return id;
  const valid = assetVersionPin({ pin })!;
  if (id.includes(MARKER)) throw new Error('An asset cannot carry two version pins.');
  return `${id}${MARKER}${encodeURIComponent(JSON.stringify([valid.version, valid.format ?? null]))}`;
}

export function decodeAssetVersion(id: string): { id: string; pin?: AssetVersionPin } {
  const index = id.indexOf(MARKER);
  if (index < 0) return { id };
  try {
    const data: unknown = JSON.parse(decodeURIComponent(id.slice(index + MARKER.length)));
    if (!index || !Array.isArray(data) || data.length !== 2 || (data[1] !== null && typeof data[1] !== 'string')) throw new Error();
    const pin = assetVersionPin({ pin: { version: data[0], ...(data[1] !== null ? { format: data[1] } : {}) } })!;
    return { id: id.slice(0, index), pin };
  } catch { throw new Error('Invalid pinned asset link.'); }
}

/** The closure key distinguishes two versions of one asset in a document. */
export function assetDependency(value: { id: string; pin?: AssetVersionPin }): { id: string; key: string; modifier: string; pin?: AssetVersionPin } {
  const decoded = decodeAssetVersion(value.id);
  const pin = assetVersionPin(value) ?? decoded.pin;
  const id = stripAssetModifiers(decoded.id);
  return { id, key: encodeAssetVersion(id, pin), modifier: decoded.id.slice(id.length), pin };
}

/** A failed exact lookup stays represented in the editable document. A later
 * autosave must not erase the dependency just because its bytes are missing. */
export function unavailablePinnedAsset(id: string, pin: AssetVersionPin, value: unknown): AssetRef {
  const prior = value && typeof value === 'object' ? value as Partial<AssetRef> : {};
  return { ...prior, id, source: id.startsWith('user/') ? 'user' : 'library', type: prior.type ?? 'raster',
    format: pin.format ?? prior.format ?? '', version: pin.version, pin, url: '' };
}
