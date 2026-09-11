// SPDX-License-Identifier: MPL-2.0
import { openDB } from '../bridge/db.ts';
import { allUserAssetVersions, ASSET_HISTORY_LIMIT } from '../bridge/asset-history.ts';
import { localFileOperations, FILE_RESULT_LIMIT } from './file-operation-store.ts';
import { batchMetadataBytes } from './file-batch-store.ts';
export interface FileHistoryUsage { bytes: number; resultBytes: number; versionBytes: number; batchBytes: number; batches: number; reservedBytes: number; results: number; versions: number; resultLimit: number; versionLimit: number }
export async function measureFileHistory(): Promise<FileHistoryUsage> {
  const [db, store] = await Promise.all([openDB(), localFileOperations()]);
  const [versions, records] = await Promise.all([allUserAssetVersions(db), store.list()]);
  const resultBytes = records.reduce((n, r) => n + r.storedBytes, 0);
  const versionBytes = versions.reduce((n, v) => n + v.bytes + (v.record.credential?.byteLength ?? 0), 0);
  const batches = await store.batches.list();
  const batchBytes = batches.length ? batchMetadataBytes(batches) : 0;
  return { bytes: resultBytes + versionBytes + batchBytes, resultBytes, versionBytes, batchBytes, batches: batches.length, reservedBytes: records.reduce((n, r) => n + (r.leaseUntil > Date.now() ? r.reservedBytes : 0), 0), results: records.length, versions: versions.length, resultLimit: FILE_RESULT_LIMIT, versionLimit: ASSET_HISTORY_LIMIT };
}
