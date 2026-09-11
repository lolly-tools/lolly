// SPDX-License-Identifier: MPL-2.0
/** Durable intent, not a second scheduler. Results stay in file-operations; this
 * small manifest accounts for every selected source before any bytes are read. */
import type { IDBPDatabase } from 'idb';
import { assertFileOperationRequest, assertFileOperationReport, type FileOperationRequestV1 } from '@lolly-tools/core/file-operation-v1';
import { safeFileName, type FileFactsV1, type FileOperationReportV1, type FileReferenceV1 } from '@lolly-tools/core/file-v1';
import type { LocalFileOperation } from './file-operation-store.ts';

export const FILE_BATCH_LIMIT = 100;
export const FILE_BATCH_BYTES = 4 * 1024 * 1024;
export const FILE_BATCH_LEASE_MS = 180_000;
// Reserve metadata too, so a full result store cannot crowd out failure receipts.
// Includes a 32 KB receipt plus the measured source facts copied beside it.
export const FILE_BATCH_REPORT_BYTES = 32 * 1024;
const PENDING_MEMBER_BYTES = 64 * 1024;
export interface FileBatchMember {
  operationId: string;
  source: FileReferenceV1;
  /** Requested name. A codec may return another extension (e.g. pages as ZIP). */
  outputName: string;
  report?: FileOperationReportV1;
}
export interface PortableFileBatch { version: 1; id: string; request: FileOperationRequestV1; createdAt: number; members: FileBatchMember[] }
export interface LocalFileBatch extends PortableFileBatch { leaseUntil: number }
export interface FileBatchLink { batchId: string; operationId: string }
const uuid = (id: unknown): boolean => typeof id === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id);
export const batchMetadataBytes = (batches: PortableFileBatch[]): number => new TextEncoder().encode(JSON.stringify(batches)).byteLength;
const reservedMetadataBytes = (batches: PortableFileBatch[]): number => batchMetadataBytes(batches) + batches.reduce((n, b) => n + b.members.filter(m => !m.report).length * PENDING_MEMBER_BYTES, 0);

export function declaredFileFacts(file: Pick<File, 'name' | 'size' | 'type'>): FileFactsV1 {
  return { name: file.name.slice(0, 4096), size: file.size, mime: file.type.slice(0, 255), format: (file.name.includes('.') ? file.name.split('.').pop()! : 'unknown').slice(0, 80).toLowerCase(), formatSource: 'declared' };
}
function interruptedReport(batch: PortableFileBatch, member: FileBatchMember): FileOperationReportV1 {
  return { version: 1, operation: batch.request.operation, state: 'failed', inputs: [member.source.facts], outputs: [], options: { ...batch.request.options, target: batch.request.target }, changes: [], metadata: 'not-checked', execution: 'device', findings: [{ code: 'operation-interrupted', severity: 'warning', message: 'This batch stopped before a durable result was recorded. Choose the original file to retry. Original bytes were not retained.' }] };
}
export function interruptedOperationReport(record: Pick<LocalFileOperation, 'input' | 'request'>): FileOperationReportV1 {
  return { version: 1, operation: record.request.operation, state: 'failed', inputs: [record.input], outputs: [], options: { ...record.request.options, target: record.request.target }, changes: [], findings: [{ code: 'operation-interrupted', severity: 'warning', message: 'This operation did not finish on this device, or was still running when the backup was taken. No output was recovered. Choose the original file to retry.' }], metadata: 'not-checked', execution: 'device' };
}
function checkMemberReport(batch: PortableFileBatch, member: FileBatchMember, report: FileOperationReportV1): void {
  assertFileOperationReport(report);
  if (new TextEncoder().encode(JSON.stringify(report)).byteLength > FILE_BATCH_REPORT_BYTES) throw new Error('A batch member report exceeds the 32 KB metadata reservation.');
  const input = report.inputs[0];
  if (report.operation !== batch.request.operation || report.state === 'partially_succeeded' || report.inputs.length !== 1
    || !input || input.name !== member.source.facts.name || input.size !== member.source.facts.size
    || member.source.facts.sha256 && input.sha256 !== member.source.facts.sha256
    || report.options.target !== batch.request.target
    || report.state === 'succeeded' && (report.outputs.length !== 1 || !report.outputs[0]?.sha256 || safeFileName(report.outputs[0].name) !== report.outputs[0].name)) throw new Error('Batch member and result disagree.');
}
/** Strict portable allowlist: no leases, bytes, paths or handles in manifests. */
export function validateFileBatch(batch: PortableFileBatch, terminal = true): void {
  if (batch?.version !== 1 || !uuid(batch.id) || !Number.isSafeInteger(batch.createdAt) || batch.createdAt < 0
    || !Array.isArray(batch.members) || batch.members.length < 1 || batch.members.length > 20
    || Object.keys(batch).some(k => !['version', 'id', 'request', 'createdAt', 'members'].includes(k))) throw new Error('Invalid file batch manifest.');
  assertFileOperationRequest(batch.request);
  const ids = new Set<string>(), names = new Set<string>();
  for (const member of batch.members) {
    if (!member || !uuid(member.operationId) || ids.has(member.operationId)
      || typeof member.outputName !== 'string' || !member.outputName || safeFileName(member.outputName) !== member.outputName || names.has(member.outputName.normalize('NFC').toLowerCase())
      || Object.keys(member).some(k => !['operationId', 'source', 'outputName', 'report'].includes(k))
      || !member.source || member.source.id !== `file-source:${member.operationId}` || member.source.role !== 'original'
      || Object.keys(member.source).some(k => !['id', 'role', 'facts'].includes(k))) throw new Error('Invalid or duplicate file batch member.');
    ids.add(member.operationId); names.add(member.outputName.normalize('NFC').toLowerCase());
    checkMemberReport(batch, member, interruptedReport(batch, member));
    if (member.report) checkMemberReport(batch, member, member.report);
    else if (terminal) throw new Error('A portable batch must account for every file.');
  }
  if (batchMetadataBytes([batch]) > FILE_BATCH_BYTES) throw new Error('File batch metadata exceeds its 4 MB limit.');
}
export function portableFileBatch(batch: LocalFileBatch, interruptPending = false): PortableFileBatch {
  return { version: 1, id: batch.id, request: batch.request, createdAt: batch.createdAt, members: batch.members.map(member => ({ ...member, ...(interruptPending && !member.report ? { report: interruptedReport(batch, member) } : {}) })) };
}
export function batchOutputReference(member: FileBatchMember): FileReferenceV1 | undefined {
  const facts = member.report?.state === 'succeeded' ? member.report.outputs[0] : undefined;
  return facts ? { id: `file-output:${member.operationId}`, role: 'output', facts, derivedFrom: { id: member.source.id, sha256: member.source.facts.sha256 } } : undefined;
}

export class FileBatchStore {
  private readonly db: IDBPDatabase;
  constructor(db: IDBPDatabase) { this.db = db; }
  async create(files: Array<{ file: Pick<File, 'name' | 'size' | 'type'>; outputName: string }>, request: FileOperationRequestV1): Promise<LocalFileBatch> {
    const batch: LocalFileBatch = { version: 1, id: crypto.randomUUID(), request, createdAt: Date.now(), leaseUntil: Date.now() + FILE_BATCH_LEASE_MS, members: files.map(({ file, outputName }) => {
      const operationId = crypto.randomUUID();
      return { operationId, outputName, source: { id: `file-source:${operationId}`, role: 'original', facts: declaredFileFacts(file) } };
    }) };
    validateFileBatch(portableFileBatch(batch), false);
    const tx = this.db.transaction('file-batches', 'readwrite');
    const all = await tx.store.getAll() as LocalFileBatch[];
    if (all.length >= FILE_BATCH_LIMIT || reservedMetadataBytes([...all, batch]) > FILE_BATCH_BYTES) { await tx.done; throw new Error('Local batch history is full. Download reports and remove older batch records first. No files were started.'); }
    await tx.store.add(batch); await tx.done; return batch;
  }
  async heartbeat(id: string): Promise<void> {
    const tx = this.db.transaction('file-batches', 'readwrite');
    const batch = await tx.store.get(id) as LocalFileBatch | undefined;
    // An expired owner cannot resurrect a batch after another tab recovered it.
    if (batch && batch.leaseUntil > Date.now() && batch.members.some(m => !m.report)) { batch.leaseUntil = Date.now() + FILE_BATCH_LEASE_MS; await tx.store.put(batch); }
    await tx.done;
  }
  async complete(link: FileBatchLink, report: FileOperationReportV1): Promise<void> {
    const tx = this.db.transaction(['file-batches', 'file-operations'], 'readwrite');
    const store = tx.objectStore('file-batches');
    const batch = await store.get(link.batchId) as LocalFileBatch | undefined;
    const member = batch?.members.find(m => m.operationId === link.operationId);
    const op = await tx.objectStore('file-operations').get(link.operationId) as LocalFileOperation | undefined;
    if (!batch || !member) { await tx.done; throw new Error('This batch is no longer available.'); }
    // Storage's terminal receipt is authoritative if a UI update raced recovery.
    const receipt = op?.state !== 'running' && op?.report ? op.report : report;
    checkMemberReport(batch, member, receipt);
    if (receipt.state === 'succeeded' && (op?.state !== 'succeeded')) { await tx.done; throw new Error('A batch cannot claim an unsaved result.'); }
    if (member.report) { await tx.done; if (JSON.stringify(member.report) !== JSON.stringify(receipt)) throw new Error('This batch member is already complete. Its original report was kept.'); return; }
    member.report = receipt; member.source.facts = receipt.inputs[0]!;
    if (batch.members.every(m => m.report)) batch.leaseUntil = 0;
    const all = await store.getAll() as LocalFileBatch[];
    if (reservedMetadataBytes(all.map(b => b.id === batch.id ? batch : b)) > FILE_BATCH_BYTES) { await tx.done; throw new Error('Batch history metadata is full. The operation result is still in Recent file operations.'); }
    await store.put(batch); await tx.done;
  }
  /** Reconcile from the journal after a crash between result-save and UI update.
   * Fence expiry in the same transaction, so a late writer cannot subsequently
   * claim success for a member already reported as interrupted by another tab. */
  async list(): Promise<LocalFileBatch[]> {
    const tx = this.db.transaction(['file-batches', 'file-operations'], 'readwrite');
    const all = await tx.objectStore('file-batches').getAll() as LocalFileBatch[];
    for (const batch of all) {
      let changed = false;
      for (const member of batch.members) {
        if (member.report) continue;
        let op = await tx.objectStore('file-operations').get(member.operationId) as LocalFileOperation | undefined;
        if (op?.state === 'running' && op.leaseUntil <= Date.now()) {
          op = { ...op, state: 'interrupted', report: interruptedOperationReport(op), reservedBytes: 0, leaseUntil: 0, updatedAt: Date.now() };
          await tx.objectStore('file-operations').put(op);
        }
        const report = op?.state !== 'running' && op?.report ? op.report : batch.leaseUntil <= Date.now() && (!op || op.leaseUntil <= Date.now()) ? interruptedReport(batch, member) : undefined;
        if (report) { member.report = report; member.source.facts = report.inputs[0] ?? member.source.facts; changed = true; }
      }
      if (changed) {
        if (batch.members.every(m => m.report)) batch.leaseUntil = 0;
        if (batchMetadataBytes(all) > FILE_BATCH_BYTES) { await tx.done; throw new Error('Batch metadata is full. Individual operation results were kept. Download and remove older batch records.'); }
        await tx.objectStore('file-batches').put(batch);
      }
    }
    await tx.done; return all.sort((a, b) => b.createdAt - a.createdAt);
  }
  async importRecord(batch: PortableFileBatch): Promise<void> {
    validateFileBatch(batch);
    const tx = this.db.transaction(['file-batches', 'file-operations'], 'readwrite');
    const batches = tx.objectStore('file-batches');
    const existing = await batches.get(batch.id) as LocalFileBatch | undefined;
    if (existing) { await tx.done; if (existing.members.some(m => !m.report) || JSON.stringify(portableFileBatch(existing)) !== JSON.stringify(batch)) throw new Error('A different batch with this id exists. Existing history was kept.'); return; }
    for (const member of batch.members) {
      const op = await tx.objectStore('file-operations').get(member.operationId) as LocalFileOperation | undefined;
      if (op && (op.state === 'running' || JSON.stringify(op.report) !== JSON.stringify(member.report) || JSON.stringify(op.request) !== JSON.stringify(batch.request))) { await tx.done; throw new Error('A batch member conflicts with existing operation history.'); }
    }
    const all = await batches.getAll() as LocalFileBatch[];
    if (all.length >= FILE_BATCH_LIMIT || reservedMetadataBytes([...all, batch]) > FILE_BATCH_BYTES) { await tx.done; throw new Error('Local batch history is full. Keep the backup and remove older batch records before retrying.'); }
    const otherIds = new Set(all.flatMap(b => b.members.map(m => m.operationId)));
    if (batch.members.some(m => otherIds.has(m.operationId))) { await tx.done; throw new Error('An operation already belongs to another batch.'); }
    await batches.add({ ...batch, leaseUntil: 0 }); await tx.done;
  }
  async remove(id: string): Promise<void> {
    const tx = this.db.transaction(['file-batches', 'file-operations'], 'readwrite');
    const batch = await tx.objectStore('file-batches').get(id) as LocalFileBatch | undefined;
    if (batch) {
      const operations = await Promise.all(batch.members.map(m => tx.objectStore('file-operations').get(m.operationId))) as Array<LocalFileOperation | undefined>;
      if (batch.members.some(m => !m.report) || operations.some(op => op?.state === 'running' && op.leaseUntil > Date.now())) { await tx.done; throw new Error('An active batch cannot be removed.'); }
      await tx.objectStore('file-batches').delete(id);
    }
    await tx.done;
  }
}
