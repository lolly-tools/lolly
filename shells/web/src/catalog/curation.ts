// SPDX-License-Identifier: MPL-2.0
/** Member-readable inspection and explicit curation writes through Work. */
import { instanceFetch, instancePath, getInstanceBase } from '../lib/instance.ts';
import type { AssetMetaRecord } from '../bridge/assets.ts';
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { readCatalogJson } from './asset-record.ts';
import { selectedAssetFile } from '../lib/asset-files.ts';

export interface CatalogField { id: string; label: string; kind: 'text' | 'date' | 'url' | 'select'; required?: boolean; options?: string[] }
export interface TextIndexFile { id: string; name: string; format: string; url: string; role?: 'original' | 'rendition'; checksum?: string }
export interface TextIndexStatus {
  revision: string; assetVersion: string; status: 'none' | 'current' | 'stale' | 'unverified'; characters: number;
  source?: { fileId: string; method: 'ocr' | 'digital'; reviewedAt: string };
}
export interface AssetInspection extends AssetMetaRecord {
  canEdit?: boolean; fields?: Record<string, string>; fieldDefs?: CatalogField[]; fieldsUpdatedAt?: string;
  updatedAt?: string; state?: string; availableFrom?: string; availableUntil?: string;
  lifecycle?: { validFrom?: string; validUntil?: string; upstream?: { availableFrom?: string; availableUntil?: string } };
  textIndex?: TextIndexStatus; textIndexFiles?: TextIndexFile[];
}
export function sharedAssetId(ref: AssetRef): string | null {
  const id = String(ref.meta?.assetGroupId ?? ref.id.split('?')[0]);
  return /^(ext|inst)\/[A-Za-z0-9._/-]+$/.test(id) && !id.includes('..') ? id : null;
}
export function inspectedFile(value: AssetInspection, ref: AssetRef): TextIndexFile | undefined {
  const selected = selectedAssetFile(ref), files = value.textIndexFiles ?? [];
  if (selected) return files.find(file => file.id === selected);
  const path = (url: string) => new URL(instancePath(url), globalThis.location?.href ?? 'http://localhost').pathname;
  const exact = files.find(file => file.format === ref.format && path(file.url) === path(ref.url));
  if (exact) return exact;
  const matching = files.filter(file => file.format === ref.format);
  return ref.url.startsWith('blob:') && matching.length === 1 ? matching[0] : undefined;
}
export class CatalogCurationError extends Error {
  readonly status: number;
  constructor(message: string, status = 0) { super(message); this.status = status; }
}
async function request(path: string, init: RequestInit): Promise<Record<string, unknown>> {
  const origin = getInstanceBase();
  const response = await instanceFetch(instancePath(path), { ...init, cache: 'no-store', signal: AbortSignal.any([...(init.signal ? [init.signal] : []), AbortSignal.timeout(15_000)]) });
  if (!response.ok) throw new CatalogCurationError(response.status === 409 ? 'The source has changed. Read the current file again.'
    : response.status === 401 || response.status === 403 ? 'You no longer have permission for this action.'
    : response.status === 404 ? 'This shared asset is unavailable.' : 'The shared asset request failed. Try again.', response.status);
  if (!response.headers.get('content-type')?.includes('json')) throw new CatalogCurationError('This Work server does not support asset curation.');
  const value = await readCatalogJson(response);
  if (origin !== getInstanceBase()) throw new CatalogCurationError('The connected workspace has changed.');
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CatalogCurationError('The server returned invalid metadata.');
  return value as Record<string, unknown>;
}
const inspection = (value: Record<string, unknown>): value is Record<string, unknown> & AssetInspection => typeof value.id === 'string' && Array.isArray(value.formats);
export async function inspectCatalogAsset(id: string, signal?: AbortSignal): Promise<AssetInspection> {
  const value = await request(`/api/v1/catalog/assets/${id}`, { signal });
  if (!inspection(value) || value.id !== id) throw new CatalogCurationError('The server returned invalid asset metadata.');
  return value;
}
export async function saveCatalogFields(id: string, fields: Record<string, string | null>, signal?: AbortSignal): Promise<void> {
  await request(`/api/v1/catalog/assets/${id}/meta`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fields }), signal });
}
export async function saveReviewedText(id: string, sourceRevision: string, content: { text: string; fileId: string; method: 'ocr' | 'digital' } | null, signal?: AbortSignal): Promise<void> {
  await request(`/api/v1/catalog/text-index/${id}`, { method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sourceRevision, ...(content ?? { text: null }) }), signal });
}
