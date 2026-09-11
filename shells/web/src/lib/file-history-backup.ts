// SPDX-License-Identifier: MPL-2.0
/** Optional shell-owned extension to the portable backup. No source files, paths,
 * OPFS handles, live leases or private account credentials cross this seam. */
import type { IDBPDatabase } from 'idb';
import { strToU8, type Unzipped } from 'fflate';
import { allUserAssetVersions, importUserAssetVersion, validateUserAssetVersion, type UserAssetVersion } from '../bridge/asset-history.ts';
import { localFileOperations, validatePortableOperation, interruptedOperationReport, type PortableFileOperation, type FileOperationStore } from './file-operation-store.ts';
import { packBackupAsset, unpackBackupAsset } from './backup-asset-record.ts';
import { readJson, type BundleEntry } from './bundle.ts';
import { portableFileBatch, validateFileBatch, type PortableFileBatch } from './file-batch-store.ts';

export interface FileHistorySnapshot { assetVersions: UserAssetVersion[]; operations: PortableFileOperation[]; batches?: PortableFileBatch[] }
export interface FileHistorySummary { assetVersions: number; fileOperations: number; fileBatches?: number; failedHistory: number }
export interface FileHistoryBackup {
  export(): Promise<FileHistorySnapshot>;
  restore(snapshot: FileHistorySnapshot): Promise<FileHistorySummary>;
}
// ZIP assembly still holds bytes in memory. Refuse before reading large blobs,
// with no silent omissions; streaming multi-GB backups need a separate path.
export const MAX_HISTORY_BACKUP_BYTES = 256 * 1024 * 1024;
export const FILE_HISTORY_PART = 'file-history.json';
export const FILE_HISTORY_PREFIX = 'file-history/';

function checkSize(snapshot: FileHistorySnapshot): void {
  if (!snapshot || !Array.isArray(snapshot.assetVersions) || !Array.isArray(snapshot.operations)
    || snapshot.assetVersions.length > 2000 || snapshot.operations.length > 100
    || snapshot.batches !== undefined && (!Array.isArray(snapshot.batches) || snapshot.batches.length > 100)) throw new Error('Invalid or oversized file history in backup.');
  const size = snapshot.assetVersions.reduce((n, v) => n + (v?.record?.blob?.size ?? v?.bytes ?? 0) + (v?.record?.credential?.byteLength ?? 0), 0)
    + snapshot.operations.reduce((n, r) => n + (r?.output?.size ?? 0), 0);
  if (!Number.isSafeInteger(size) || size > MAX_HISTORY_BACKUP_BYTES) throw new Error('File history exceeds the 256 MB portable-backup limit. Download important results and versions individually, then remove older local copies before exporting. Nothing was omitted or deleted.');
}

function checkBatches(snapshot: FileHistorySnapshot): void {
  const ids = new Set<string>(), members = new Set<string>();
  for (const batch of snapshot.batches ?? []) {
    validateFileBatch(batch);
    if (ids.has(batch.id)) throw new Error('Duplicate file batch in backup.');
    ids.add(batch.id);
    for (const member of batch.members) {
      if (members.has(member.operationId)) throw new Error('Duplicate batch member in backup.');
      members.add(member.operationId);
      const operation = snapshot.operations.find(r => r.id === member.operationId);
      if (operation && (JSON.stringify(operation.request) !== JSON.stringify(batch.request) || JSON.stringify(operation.report) !== JSON.stringify(member.report))) throw new Error('Batch manifest disagrees with its operation report.');
    }
  }
}

export async function packFileHistory(snapshot: FileHistorySnapshot, entries: Record<string, BundleEntry>): Promise<void> {
  checkSize(snapshot);
  checkBatches(snapshot);
  const versions = [];
  for (const [i, v] of snapshot.assetVersions.entries()) {
    await validateUserAssetVersion(v);
    versions.push({ ...v, record: await packBackupAsset({ ...v.record }, `${FILE_HISTORY_PREFIX}versions/${i}`, entries) });
  }
  const operations = [];
  for (const [i, r] of snapshot.operations.entries()) {
    await validatePortableOperation(r);
    const { output, ...meta } = r;
    const path = output ? `${FILE_HISTORY_PREFIX}results/${i}.bin` : null;
    if (output && path) entries[path] = [new Uint8Array(await output.arrayBuffer()), { level: 0 }];
    operations.push({ ...meta, _file: path });
  }
  const json = strToU8(JSON.stringify({ version: snapshot.batches ? 2 : 1, assetVersions: versions, operations, ...(snapshot.batches ? { batches: snapshot.batches } : {}) }));
  if (json.byteLength > 4 * 1024 * 1024) throw new Error('File history metadata exceeds the 4 MB backup limit.');
  entries[FILE_HISTORY_PART] = json;
}

/** Validate every history part before the caller mutates profile or asset data. */
export async function unpackFileHistory(files: Unzipped): Promise<FileHistorySnapshot | null> {
  if (!Object.hasOwn(files, FILE_HISTORY_PART)) return null;
  if (files[FILE_HISTORY_PART]!.length > 4 * 1024 * 1024) throw new Error('File history metadata exceeds the 4 MB backup limit.');
  const raw = readJson(files, FILE_HISTORY_PART);
  if (!raw || ![1, 2].includes(raw.version) || !Array.isArray(raw.assetVersions) || !Array.isArray(raw.operations)) throw new Error('Invalid file history in backup.');
  checkSize(raw);
  // Account for referenced bytes before constructing ANY Blob/File copies.
  // Declared `bytes`/report sizes alone are not a trustworthy allocation budget.
  let referencedBytes = 0;
  for (const path of [...raw.assetVersions.flatMap((v: { record?: { _file?: unknown; _credentialFile?: unknown } }) => [v?.record?._file, v?.record?._credentialFile]), ...raw.operations.map((r: { _file?: unknown }) => r?._file)]) {
    if (typeof path === 'string' && Object.hasOwn(files, path)) referencedBytes += files[path]!.byteLength;
    if (referencedBytes > MAX_HISTORY_BACKUP_BYTES) throw new Error('File history exceeds the 256 MB portable-backup limit.');
  }
  const snapshot: FileHistorySnapshot = { assetVersions: [], operations: [], ...(raw.batches ? { batches: raw.batches } : {}) };
  const ids = new Set<string>();
  for (const v of raw.assetVersions) {
    const item = { ...v, record: unpackBackupAsset(v?.record, files, `${FILE_HISTORY_PREFIX}versions/`) } as UserAssetVersion;
    const key = JSON.stringify([item.assetId, item.version]);
    if (ids.has(key)) throw new Error('Duplicate asset version in backup.');
    ids.add(key); snapshot.assetVersions.push(item);
  }
  for (const r of raw.operations) {
    if (!r || typeof r !== 'object') throw new Error('Invalid operation in backup.');
    const { _file, ...meta } = r;
    let output: File | undefined;
    if (_file != null) {
      if (typeof _file !== 'string' || !_file.startsWith(`${FILE_HISTORY_PREFIX}results/`) || !Object.hasOwn(files, _file)) throw new Error('A saved result is missing from this backup.');
      const expected = r.report?.outputs?.[0];
      if (!expected || typeof expected.name !== 'string' || typeof expected.mime !== 'string') throw new Error('Invalid saved result metadata.');
      output = new File([files[_file] as BlobPart], expected.name, { type: expected.mime });
    }
    if (ids.has(`operation:${r.id}`)) throw new Error('Duplicate operation in backup.');
    ids.add(`operation:${r.id}`); snapshot.operations.push({ ...meta, output });
  }
  checkSize(snapshot);
  for (const v of snapshot.assetVersions) await validateUserAssetVersion(v);
  for (const r of snapshot.operations) await validatePortableOperation(r);
  checkBatches(snapshot);
  return snapshot;
}

export function createFileHistoryBackup(db: IDBPDatabase, getStore: () => Promise<FileOperationStore> = localFileOperations): FileHistoryBackup {
  return {
    async export() {
      const store = await getStore();
      const assetVersions = await allUserAssetVersions(db);
      const records = await store.list();
      // Budget the stored sizes before reading any OPFS result into memory.
      if (assetVersions.reduce((n, v) => n + v.bytes + (v.record.credential?.byteLength ?? 0), 0) + records.reduce((n, r) => n + r.storedBytes, 0) > MAX_HISTORY_BACKUP_BYTES) throw new Error('File history exceeds the 256 MB portable-backup limit. Download and remove older copies first. Nothing was deleted.');
      const operations: PortableFileOperation[] = [];
      for (const r of records) {
        const output = r.state === 'succeeded' ? await store.getOutput(r.id) : undefined;
        if (r.state === 'succeeded' && !output) throw new Error('A saved result is missing. Recover it or remove its history before exporting a complete backup.');
        operations.push({ id: r.id, input: r.input, request: r.request, createdAt: r.createdAt, updatedAt: r.updatedAt, state: r.state === 'running' ? 'interrupted' : r.state, report: r.state === 'running' ? interruptedOperationReport(r) : r.report, output: output ?? undefined });
      }
      const batches = (await store.batches.list()).map(b => {
        const portable = portableFileBatch(b, true);
        // A running operation's portable interruption receipt is the same in
        // both indexes, without changing the live owner's lease or journal.
        for (const member of portable.members) {
          const op = operations.find(r => r.id === member.operationId);
          if (op?.report) { member.report = op.report; member.source = { ...member.source, facts: op.report.inputs[0]! }; }
        }
        return portable;
      });
      return { assetVersions, operations, batches };
    },
    async restore(snapshot) {
      checkSize(snapshot);
      const result: FileHistorySummary = { assetVersions: 0, fileOperations: 0, failedHistory: 0 };
      for (const v of snapshot.assetVersions) {
        try { await importUserAssetVersion(db, v); result.assetVersions++; } catch { result.failedHistory++; }
      }
      let store: FileOperationStore;
      try { store = await getStore(); } catch { result.failedHistory += snapshot.operations.length + (snapshot.batches?.length ?? 0); return result; }
      for (const r of snapshot.operations) {
        try { await store.importRecord(r); result.fileOperations++; } catch { result.failedHistory++; }
      }
      if (snapshot.batches) {
        result.fileBatches = 0;
        for (const batch of snapshot.batches) {
          try { await store.batches.importRecord(batch); result.fileBatches++; } catch { result.failedHistory++; }
        }
      }
      return result;
    },
  };
}
