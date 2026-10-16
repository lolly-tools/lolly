// SPDX-License-Identifier: MPL-2.0
/** Device-held catalog reads. A cache token never stands in for a byte digest. */
import type { AssetRef } from '@lolly-tools/core/host-v1';
import type { IDBPDatabase } from 'idb';
import type { LocalFileOperation } from '../lib/file-operation-store.ts';

export const CATALOG_OBSERVATIONS = 'asset-observations';
const EXACT = /^sha256-([a-f0-9]{64})\.([a-f0-9]{64})$/;
const MAX_BYTES = 256 * 1024 * 1024;
export interface CatalogObservation {
  key: string;
  id: string;
  version: string;
  format: string;
  sha256: string;
  observedAt: string;
  sourceVersion?: string;
  sourceOrigin?: string;
  mappingRevision: 'catalog-read-v1';
  metadataScope: 'observed-at-read';
  metadataOrigin: 'device-index';
  metadataCompleteness: 'served-projection';
  metadataFreshness: 'not-checked';
  representation: string;
  record: AssetRef;
}
export type CatalogHistoryDb = Pick<IDBPDatabase, 'get' | 'transaction'> & { objectStoreNames?: Pick<DOMStringList, 'contains'> };
const supported = (db: CatalogHistoryDb): boolean => !!db.objectStoreNames?.contains(CATALOG_OBSERVATIONS);
export const isCatalogContentVersion = (version?: string): boolean => !!version && EXACT.test(version);
export const catalogObservationKey = (id: string, format: string, version: string): string => `${id}:${format}:${version}`;
async function digest(bytes: Uint8Array): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource))].map(n => n.toString(16).padStart(2, '0')).join('');
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => [k, canonical(v)]));
  return value;
}
/** Only the already-served descriptive projection is retained. Transport URLs,
 * source file lists and service credentials are not historical observations. */
function descriptive(ref: AssetRef): AssetRef {
  const meta: Record<string, unknown> = {};
  for (const key of ['name', 'tags', 'description', 'license', 'attribution', 'rights', 'fields', 'provider', 'selectedFile', 'assetGroupId', 'assetGroupName', 'fileRole', 'aiGenerated']) {
    if (ref.meta?.[key] !== undefined) meta[key] = structuredClone(ref.meta[key]);
  }
  return { source: 'library', id: ref.id, type: ref.type, format: ref.format, url: '',
    ...(ref.width !== undefined ? { width: ref.width } : {}), ...(ref.height !== undefined ? { height: ref.height } : {}), meta };
}
export async function retainCatalogRead(db: CatalogHistoryDb, ref: AssetRef, blob: Blob, reserve?: (bytes: number) => Promise<void>): Promise<AssetRef> {
  if (!supported(db)) return ref;
  if (blob.size > MAX_BYTES) throw new Error('This file is too large to retain an exact catalog read.');
  const sha256 = await digest(new Uint8Array(await blob.arrayBuffer()));
  const record = descriptive(ref);
  const source = await db.get('profile', 'catalog-source') as { origin?: unknown } | undefined;
  let sourceOrigin: string | undefined;
  if (typeof source?.origin === 'string') {
    try {
      const url = new URL(source.origin || '.', globalThis.location?.href);
      if (/^https?:$/.test(url.protocol)) sourceOrigin = url.origin + url.pathname.replace(/\/$/, '');
    } catch { /* An old cache may not record its source origin. */ }
  }
  const evidence = JSON.stringify(canonical({ record, sourceVersion: ref.version ?? null, sourceOrigin: sourceOrigin ?? null }));
  if (evidence.length > 512 * 1024) throw new Error('This source observation is too large to retain.');
  const observationHash = await digest(new TextEncoder().encode(evidence));
  const version = `sha256-${sha256}.${observationHash}`;
  const key = catalogObservationKey(ref.id, ref.format, version);
  if (!await db.get('asset-blob', key)) await reserve?.(blob.size);
  const observation: CatalogObservation = { key, id: ref.id, version, format: ref.format, sha256,
    observedAt: new Date().toISOString(), ...(ref.version ? { sourceVersion: ref.version } : {}),
    ...(sourceOrigin ? { sourceOrigin } : {}),
    mappingRevision: 'catalog-read-v1', metadataScope: 'observed-at-read', metadataOrigin: 'device-index', metadataCompleteness: 'served-projection', metadataFreshness: 'not-checked',
    representation: String(ref.meta?.fileRole ?? 'unknown'), record };
  const tx = db.transaction(['asset-blob', CATALOG_OBSERVATIONS], 'readwrite');
  // Repeating a verified read may repair an evicted or corrupt cache copy;
  // its content-addressed key cannot acquire a different byte identity.
  await tx.objectStore('asset-blob').put(blob, key);
  if (!await tx.objectStore(CATALOG_OBSERVATIONS).get(key)) {
    await tx.objectStore(CATALOG_OBSERVATIONS).add(observation);
  }
  await tx.done;
  return { ...ref, version, pin: { version, format: ref.format } };
}
export async function removePrunedObservations(db: CatalogHistoryDb, keys: string[]): Promise<void> {
  if (!supported(db) || !keys.length) return;
  const tx = db.transaction(CATALOG_OBSERVATIONS, 'readwrite');
  for (const key of keys) await tx.store.delete(key);
  await tx.done;
}
/** Held work can be read offline. This is no statement of current source access,
 * processing authority, historical attributes before the read, or delivery. */
export async function readCatalogContent(db: CatalogHistoryDb, id: string, pin: { version: string; format?: string }): Promise<{ observation: CatalogObservation; blob: Blob }> {
  if (!supported(db) || !pin.format || !isCatalogContentVersion(pin.version)) throw new Error('Exact source observation unavailable.');
  const key = catalogObservationKey(id, pin.format, pin.version);
  const tx = db.transaction([CATALOG_OBSERVATIONS, 'asset-blob']);
  const observation = await tx.objectStore(CATALOG_OBSERVATIONS).get(key) as CatalogObservation | undefined;
  const blob = await tx.objectStore('asset-blob').get(key) as Blob | undefined;
  await tx.done;
  if (!observation || observation.key !== key || observation.id !== id || observation.record?.id !== id || observation.record?.format !== pin.format
    || observation.format !== pin.format || observation.version !== pin.version || observation.metadataScope !== 'observed-at-read'
    || observation.mappingRevision !== 'catalog-read-v1' || !(blob instanceof Blob)) throw new Error('Exact source observation unavailable.');
  const sha256 = await digest(new Uint8Array(await blob.arrayBuffer()));
  const evidence = JSON.stringify(canonical({ record: observation.record, sourceVersion: observation.sourceVersion ?? null, sourceOrigin: observation.sourceOrigin ?? null }));
  if (sha256 !== observation.sha256 || pin.version !== `sha256-${sha256}.${await digest(new TextEncoder().encode(evidence))}`) throw new Error('Exact source integrity check failed.');
  return { observation, blob };
}

/** Read only this device's observations and retained revision metadata. No graph
 * inference, private neighbour traversal, original downloads or shared counts. */
export async function catalogSourceHistory(db: CatalogHistoryDb, id: string) {
  const observations: CatalogObservation[] = [];
  let truncated = false;
  if (supported(db)) {
    const tx = db.transaction(CATALOG_OBSERVATIONS);
    let cursor = await tx.store.index('id').openCursor(IDBKeyRange.bound(id, `${id}\uffff`));
    let scanned = 0;
    while (cursor && scanned++ < 200) {
      const row = cursor.value as CatalogObservation;
      if (row.id === id || row.id.startsWith(`${id}?file=`)) observations.push(row);
      cursor = await cursor.continue();
    }
    truncated = !!cursor; await tx.done;
  }
  const keys = new Set(observations.map(row => row.key));
  const revisions: Array<{ id: string; documentId: string; label: string; at: string }> = [];
  if (db.objectStoreNames?.contains('revisions')) {
    const tx = db.transaction('revisions'); let cursor = await tx.store.openCursor(), scanned = 0;
    while (cursor && scanned++ < 1000) {
      const row = cursor.value as { id: string; documentId: string; label: string; at: string; assetRefs?: string[] };
      if (row.assetRefs?.some(key => keys.has(key))) revisions.push({ id: row.id, documentId: row.documentId, label: row.label, at: row.at });
      cursor = await cursor.continue();
    }
    truncated ||= !!cursor; await tx.done;
  }
  const digests = new Set(observations.map(row => row.sha256));
  const reports: Array<{ id: string; operation: string; origin: 'observed-here' | 'imported' | 'unknown'; relation: 'input' | 'output' }> = [];
  if (db.objectStoreNames?.contains('file-operations')) {
    const tx = db.transaction('file-operations'); let cursor = await tx.store.openCursor(), scanned = 0;
    while (cursor && scanned++ < 100) {
      const row = cursor.value as LocalFileOperation;
      if (row.report?.state === 'succeeded') {
        const input = row.report.inputs.some(file => !!file.sha256 && digests.has(file.sha256));
        const output = row.report.outputs.some(file => !!file.sha256 && digests.has(file.sha256));
        if (input || output) reports.push({ id: row.id, operation: row.report.operation,
          origin: row.origin ?? 'unknown', relation: input ? 'input' : 'output' });
      }
      cursor = await cursor.continue();
    }
    truncated ||= !!cursor; await tx.done;
  }
  return { observations: observations.sort((a, b) => b.observedAt.localeCompare(a.observedAt)), revisions, reports, truncated, scope: 'this-device' as const };
}
