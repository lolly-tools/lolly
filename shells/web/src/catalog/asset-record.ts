// SPDX-License-Identifier: MPL-2.0
/** Bounded catalog transport shared by asset lookup and paged browse. */
import { instanceFetch, instancePath, getInstanceBase } from '../lib/instance.ts';
import type { AssetMetaRecord } from '../bridge/assets.ts';
const MAX_PAGE_BYTES = 16 * 1024 * 1024;

export class CatalogBrowseError extends Error {
  readonly status: number;
  constructor(message: string, status = 0) { super(message); this.status = status; }
}

export async function readCatalogJson(response: Response): Promise<unknown> {
  if (!response.ok) throw new CatalogBrowseError(response.status === 401 || response.status === 403 ? 'Sign in to browse shared assets.' : 'Shared assets could not be loaded.', response.status);
  if (!response.headers.get('content-type')?.includes('json')) throw new CatalogBrowseError('This server does not provide shared asset browsing.', 404);
  const reader = response.body?.getReader();
  if (!reader) throw new CatalogBrowseError('The server returned an empty response.');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const item = await reader.read(); if (item.done) break;
      size += item.value.byteLength;
      if (size > MAX_PAGE_BYTES) throw new CatalogBrowseError('This asset page exceeds the response limit.');
      chunks.push(item.value);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
export const isCatalogAsset = (value: unknown): value is AssetMetaRecord => !!value && typeof value === 'object'
  && typeof (value as AssetMetaRecord).id === 'string' && Array.isArray((value as AssetMetaRecord).formats);
export async function readCatalogAsset(id: string): Promise<AssetMetaRecord | null> {
  if (!/^(ext|inst)\/[A-Za-z0-9._/-]+$/.test(id) || id.includes('..')) return null;
  const origin = getInstanceBase();
  const response = await instanceFetch(instancePath(`/api/v1/catalog/assets/${id}`), { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
  if (response.status === 404) return null;
  const value = await readCatalogJson(response);
  if (origin !== getInstanceBase() || !isCatalogAsset(value) || value.id !== id) return null;
  return absolutizeCatalogAsset(value);
}
export function absolutizeCatalogAsset(value: AssetMetaRecord): AssetMetaRecord {
  return { ...value, ...(value.version !== undefined ? { version: String(value.version) } : {}), formats: value.formats.map(format => ({ ...format, url: instancePath(format.url) })) };
}
