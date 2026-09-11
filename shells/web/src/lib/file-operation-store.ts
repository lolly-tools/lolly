// SPDX-License-Identifier: MPL-2.0
/** Durable local results with atomic quota reservations and operation-owned cleanup. */
import type { IDBPDatabase } from 'idb';
import type { FileFactsV1, FileOperationReportV1 } from '@lolly-tools/core/file-v1';
import { safeFileName } from '@lolly-tools/core/file-v1';
import { assertFileOperationReport, assertFileOperationRequest, type FileOperationRequestV1 } from '@lolly-tools/core/file-operation-v1';
import { sha256Bytes } from './file-conversion.ts';
import { openDB } from '../bridge/db.ts';
import { FileBatchStore, FILE_BATCH_REPORT_BYTES, interruptedOperationReport, type FileBatchLink, type LocalFileBatch } from './file-batch-store.ts';
export { interruptedOperationReport } from './file-batch-store.ts';

export interface LocalFileOperation {
  id: string; state: 'running' | 'succeeded' | 'failed' | 'cancelled' | 'interrupted';
  input: FileFactsV1; request: FileOperationRequestV1; report?: FileOperationReportV1;
  createdAt: number; updatedAt: number; leaseUntil: number;
  reservedBytes: number; storedBytes: number; backend?: 'opfs' | 'idb'; outputName?: string; outputMime?: string;
  batchId?: string;
}
export const FILE_RESULT_LIMIT = 512 * 1024 * 1024;
const TOTAL_BYTES = FILE_RESULT_LIMIT;
const OUTPUT_LIMIT = 128 * 1024 * 1024;
const LEASE_MS = 180_000;
const validId = (id: string): void => { if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid operation id.'); };
export type PortableFileOperation = Pick<LocalFileOperation, 'id' | 'state' | 'input' | 'request' | 'report' | 'createdAt' | 'updatedAt'> & { output?: File };
export async function validatePortableOperation(record: PortableFileOperation): Promise<void> {
  validId(record.id); assertFileOperationRequest(record.request);
  if (!['succeeded', 'failed', 'cancelled', 'interrupted'].includes(record.state)
    || !Number.isSafeInteger(record.createdAt) || record.createdAt < 0 || !Number.isSafeInteger(record.updatedAt) || record.updatedAt < 0) throw new Error('Invalid operation history in backup.');
  // Reuse the public facts schema even for an interrupted record without a report.
  assertFileOperationReport({ version: 1, operation: record.request.operation, state: 'cancelled', inputs: [record.input], outputs: [], options: {}, changes: [], findings: [], metadata: 'not-checked', execution: 'device' });
  if (record.report) {
    assertFileOperationReport(record.report);
    const interrupted = record.state === 'interrupted' && record.report.state === 'failed' && record.report.findings.some(f => f.code === 'operation-interrupted');
    if (!interrupted && record.state !== record.report.state || record.report.operation !== record.request.operation) throw new Error('Operation history and report disagree.');
    const input = record.report.inputs[0];
    if (record.report.inputs.length > 1 || input && (input.size !== record.input.size || input.sha256 !== record.input.sha256)) throw new Error('Operation source facts disagree with its report.');
  } else if (record.state !== 'interrupted') throw new Error('Operation history is missing its report.');
  if (record.state === 'succeeded') {
    const expected = record.report?.outputs[0];
    if (!expected || record.report?.outputs.length !== 1 || !(record.output instanceof File) || record.output.size > OUTPUT_LIMIT
      || expected.size !== record.output.size || expected.name !== record.output.name || safeFileName(expected.name) !== expected.name || expected.mime !== record.output.type || !expected.sha256
      || await sha256Bytes(new Uint8Array(await record.output.arrayBuffer())) !== expected.sha256) throw new Error('Saved result integrity check failed.');
  } else if (record.output) throw new Error('An incomplete operation cannot contain a saved result.');
}
async function resultDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) return null;
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle('lolly-file-results-v1', { create: true });
}
export class FileOperationStore {
  readonly batches: FileBatchStore;
  private readonly db: IDBPDatabase;
  private readonly directory: FileSystemDirectoryHandle | null;
  private readonly limit: number;
  constructor(db: IDBPDatabase, directory: FileSystemDirectoryHandle | null = null, limit = TOTAL_BYTES) { this.db = db; this.directory = directory; this.limit = limit; this.batches = new FileBatchStore(db); }
  static async open(): Promise<FileOperationStore> { return new FileOperationStore(await openDB(), await resultDirectory().catch(() => null)); }
  async list(): Promise<LocalFileOperation[]> {
    const tx = this.db.transaction('file-operations', 'readwrite');
    const all = await tx.store.getAll() as LocalFileOperation[];
    for (const record of all) if (record.state === 'running' && record.leaseUntil < Date.now() || record.state === 'interrupted' && !record.report) {
      record.state = 'interrupted'; record.report = interruptedOperationReport(record); record.reservedBytes = 0; record.leaseUntil = 0; record.updatedAt = Date.now(); await tx.store.put(record);
    }
    await tx.done;
    return all.sort((a, b) => b.createdAt - a.createdAt);
  }
  async begin(input: FileFactsV1, request: FileOperationRequestV1, reserve = OUTPUT_LIMIT, batchLink?: FileBatchLink): Promise<LocalFileOperation> {
    assertFileOperationRequest(request);
    if (!Number.isSafeInteger(reserve) || reserve < 1 || reserve > OUTPUT_LIMIT) throw new Error('Invalid result reservation.');
    const estimate = typeof navigator !== 'undefined' ? await navigator.storage?.estimate?.().catch(() => undefined) : undefined;
    if (estimate?.quota && (estimate.usage ?? 0) + reserve > estimate.quota * .9) throw new Error('Not enough local storage for this operation. Download and remove older results first.');
    const tx = this.db.transaction(batchLink ? ['file-operations', 'file-batches'] : ['file-operations'], 'readwrite');
    const jobs = tx.objectStore('file-operations');
    if (batchLink) {
      validId(batchLink.operationId); validId(batchLink.batchId);
      const batch = await tx.objectStore('file-batches').get(batchLink.batchId) as LocalFileBatch | undefined;
      const member = batch?.members.find(m => m.operationId === batchLink.operationId);
      if (!batch || !member || batch.leaseUntil <= Date.now() || member.report
        || JSON.stringify(batch.request) !== JSON.stringify(request) || member.source.facts.name !== input.name || member.source.facts.size !== input.size
        || member.source.facts.sha256 && member.source.facts.sha256 !== input.sha256 || await jobs.get(batchLink.operationId)) {
        await tx.done; throw new Error('This batch member is no longer available to start.');
      }
    }
    const all = await jobs.getAll() as LocalFileOperation[];
    const used = all.reduce((sum, r) => sum + r.storedBytes + (r.leaseUntil > Date.now() ? r.reservedBytes : 0), 0);
    if (all.length >= 100 || used + reserve > this.limit) { await tx.done; throw new Error('Local result history is full. Download and remove older results first.'); }
    const now = Date.now();
    const record: LocalFileOperation = { id: batchLink?.operationId ?? crypto.randomUUID(), ...(batchLink ? { batchId: batchLink.batchId } : {}), state: 'running', input, request, createdAt: now, updatedAt: now, leaseUntil: now + LEASE_MS, reservedBytes: reserve, storedBytes: 0 };
    await jobs.add(record); await tx.done; return record;
  }
  async heartbeat(id: string): Promise<void> {
    validId(id);
    const tx = this.db.transaction('file-operations', 'readwrite');
    const record = await tx.store.get(id) as LocalFileOperation | undefined;
    if (record?.state === 'running') { record.leaseUntil = Date.now() + LEASE_MS; await tx.store.put(record); }
    await tx.done;
  }
  async finish(id: string, report: FileOperationReportV1, output?: File): Promise<void> {
    validId(id); assertFileOperationReport(report);
    const record = await this.db.get('file-operations', id) as LocalFileOperation | undefined;
    if (record?.state !== 'running') throw new Error('This operation is no longer active.');
    if (record.batchId && new TextEncoder().encode(JSON.stringify(report)).byteLength > FILE_BATCH_REPORT_BYTES) throw new Error('This report exceeds the batch’s 32 KB per-file metadata reservation. The copy was not saved.');
    if (report.state === 'partially_succeeded') throw new Error('A single saved operation cannot be partly complete.');
    if (output && (report.state !== 'succeeded' || output.size > record.reservedBytes || output.size !== report.outputs[0]?.size)) throw new Error('Output does not fit its reserved or reported size.');
    if (report.state === 'succeeded' && !output) throw new Error('A completed operation needs its output bytes.');
    await validatePortableOperation({ id, state: report.state, input: record.input, request: record.request, report, createdAt: record.createdAt, updatedAt: record.updatedAt, output });
    let backend: 'opfs' | 'idb' = 'idb';
    if (output && this.directory) {
      try {
        const handle = await this.directory.getFileHandle(id, { create: true });
        const writable = await handle.createWritable();
        await output.stream().pipeTo(writable); backend = 'opfs';
      }
      catch (error) { await this.directory.removeEntry(id).catch(() => {}); throw error; }
    }
    try {
      const tx = this.db.transaction(['file-operations', 'file-operation-blobs'], 'readwrite');
      const live = await tx.objectStore('file-operations').get(id) as LocalFileOperation | undefined;
      if (live?.state !== 'running') { await tx.done; throw new Error('Operation was removed while it was running.'); }
      if (output && backend === 'idb') await tx.objectStore('file-operation-blobs').put(output, id);
      await tx.objectStore('file-operations').put({ ...live, state: report.state, report, reservedBytes: 0, storedBytes: output?.size ?? 0, backend, outputName: output?.name, outputMime: output?.type, updatedAt: Date.now(), leaseUntil: 0 });
      await tx.done;
    } catch (error) { if (backend === 'opfs') await this.directory?.removeEntry(id).catch(() => {}); throw error; }
  }
  async abandon(id: string, reason: string, failure?: FileOperationReportV1): Promise<void> {
    validId(id);
    if (failure) { assertFileOperationReport(failure); if (!['failed', 'cancelled'].includes(failure.state)) throw new Error('An abandoned operation cannot claim success.'); }
    const tx = this.db.transaction('file-operations', 'readwrite');
    const record = await tx.store.get(id) as LocalFileOperation | undefined;
    if (record?.state === 'running') {
      const report: FileOperationReportV1 = failure ?? { version: 1, operation: record.request.operation, state: 'failed', inputs: [record.input], outputs: [], options: record.request.options, changes: [], findings: [{ code: 'result-not-saved', severity: 'error', message: reason.slice(0, 4096) }], metadata: 'not-checked', execution: 'device' };
      assertFileOperationReport(report);
      await tx.store.put({ ...record, state: report.state, report, reservedBytes: 0, leaseUntil: 0, updatedAt: Date.now() });
    }
    await tx.done;
  }
  async getOutput(id: string): Promise<File | null> {
    validId(id);
    const record = await this.db.get('file-operations', id) as LocalFileOperation | undefined;
    if (record?.state !== 'succeeded') return null;
    const blob = record.backend === 'opfs' ? await this.directory?.getFileHandle(id).then(h => h.getFile()).catch(() => null) : await this.db.get('file-operation-blobs', id) as Blob | undefined;
    if (!blob) return null;
    const expected = record.report?.outputs[0];
    if (expected?.size !== blob.size || expected.sha256 && await sha256Bytes(new Uint8Array(await blob.arrayBuffer())) !== expected.sha256) throw new Error('Saved result integrity check failed. Retry with the original file.');
    return new File([blob], record.outputName ?? 'result', { type: record.outputMime });
  }
  /** Restores terminal history atomically. Never resurrects a lease or replaces a
   * live job. IDB is used for restored bytes so metadata and bytes commit together. */
  async importRecord(record: PortableFileOperation): Promise<void> {
    await validatePortableOperation(record);
    const { output, ...meta } = record;
    const tx = this.db.transaction(['file-operations', 'file-operation-blobs'], 'readwrite');
    const jobs = tx.objectStore('file-operations');
    const existing = await jobs.get(record.id) as LocalFileOperation | undefined;
    if (existing) {
      const same = existing.state !== 'running' && existing.state === record.state && existing.createdAt === record.createdAt
        && JSON.stringify(existing.request) === JSON.stringify(record.request)
        && JSON.stringify(existing.input) === JSON.stringify(record.input)
        && JSON.stringify(existing.report) === JSON.stringify(record.report);
      await tx.done;
      if (!same) throw new Error('An operation with this id already exists. The existing history was kept.');
      // Do not call a missing or corrupted local copy a successful restore.
      if (record.state === 'succeeded' && !await this.getOutput(record.id)) throw new Error('The existing result is missing. Remove its history before restoring this backup again.');
      return;
    }
    const all = await jobs.getAll() as LocalFileOperation[];
    const used = all.reduce((n, r) => n + r.storedBytes + (r.leaseUntil > Date.now() ? r.reservedBytes : 0), 0);
    if (all.length >= 100 || used + (output?.size ?? 0) > this.limit) { await tx.done; throw new Error('Local result history is full. Keep the backup and remove older results before retrying.'); }
    if (output) await tx.objectStore('file-operation-blobs').put(output, record.id);
    await jobs.add({ ...meta, backend: 'idb', reservedBytes: 0, storedBytes: output?.size ?? 0, leaseUntil: 0, outputName: output?.name, outputMime: output?.type } satisfies LocalFileOperation);
    await tx.done;
  }
  async remove(id: string): Promise<void> {
    validId(id);
    const tx = this.db.transaction(['file-operations', 'file-operation-blobs', 'file-batches'], 'readwrite');
    const record = await tx.objectStore('file-operations').get(id) as LocalFileOperation | undefined;
    if (record?.state === 'running' && record.leaseUntil > Date.now()) { await tx.done; throw new Error('Stop this operation before removing its history.'); }
    if (record?.batchId) {
      const batch = await tx.objectStore('file-batches').get(record.batchId) as LocalFileBatch | undefined;
      if (batch?.members.some(m => m.operationId === id && !m.report)) { await tx.done; throw new Error('Refresh batch status before removing this result so its receipt is retained.'); }
    }
    await tx.objectStore('file-operations').delete(id); await tx.objectStore('file-operation-blobs').delete(id); await tx.done;
    await this.directory?.removeEntry(id).catch(() => {});
  }
  /** Only unreferenced, operation-owned blobs. Recent OPFS writes get a one-hour
   * grace period; a current journal row always protects bytes, regardless of state. */
  async reclaimAbandonedBytes(): Promise<{ files: number; bytes: number }> {
    const result = { files: 0, bytes: 0 };
    const tx = this.db.transaction(['file-operations', 'file-operation-blobs'], 'readwrite');
    const blobs = tx.objectStore('file-operation-blobs');
    for (const key of await blobs.getAllKeys()) {
      if (typeof key !== 'string' || !/^[a-f0-9-]{36}$/.test(key) || await tx.objectStore('file-operations').get(key)) continue;
      const blob = await blobs.get(key) as Blob;
      await blobs.delete(key); result.files++; result.bytes += blob?.size ?? 0;
    }
    await tx.done;
    if (this.directory) {
      const directory = this.directory as FileSystemDirectoryHandle & { values(): AsyncIterableIterator<FileSystemFileHandle | FileSystemDirectoryHandle> };
      for await (const handle of directory.values()) {
        if (handle.kind !== 'file' || !/^[a-f0-9-]{36}$/.test(handle.name)) continue;
        const file = await (handle as FileSystemFileHandle).getFile().catch(() => null);
        if (!file || file.lastModified > Date.now() - 3_600_000 || await this.db.get('file-operations', handle.name)) continue;
        try { await this.directory.removeEntry(handle.name); result.files++; result.bytes += file.size; } catch { /* another tab may have removed it */ }
      }
    }
    return result;
  }
}

let storePromise: Promise<FileOperationStore> | undefined;
export function localFileOperations(): Promise<FileOperationStore> {
  storePromise ??= FileOperationStore.open().catch(error => { storePromise = undefined; throw error; });
  return storePromise;
}
