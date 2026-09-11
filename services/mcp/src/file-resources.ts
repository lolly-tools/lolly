// SPDX-License-Identifier: MPL-2.0
/** Token/process-scoped private file handles. Never returns a filesystem path. */
import { mkdtemp, writeFile, unlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { readOperationFile, describeOperationFile, runNodeFileOperation } from '../../../packages/node-shell/src/file-operations.ts';
import { assertFileOperationRequest, fileOperationRequestSchemaV1 } from '@lolly-tools/core/file-operation-v1';
import { safeFileName, type FileReferenceV1, type FileOperationReportV1 } from '@lolly-tools/core/file-v1';

const INPUT_LIMIT = 4 * 1024 * 1024;
const OWNER_LIMIT = 64 * 1024 * 1024;
const GLOBAL_LIMIT = 256 * 1024 * 1024;
const TTL_MS = 60 * 60 * 1000;
type Entry = { owner: string; ref: FileReferenceV1; expires: number; path: string; report?: FileOperationReportV1 };
export class PrivateFileResources {
  private directory?: Promise<string>;
  private entries = new Map<string, Entry>();
  private reservations = new Map<string, number>();
  private pending = 0;
  async close(): Promise<void> {
    // Only this instance's mkdtemp-owned directory; never a caller-supplied path.
    if (this.directory) await rm(await this.directory, { recursive: true, force: true });
    this.entries.clear(); this.reservations.clear();
  }
  private async prune(): Promise<void> {
    for (const [id, entry] of this.entries) if (entry.expires <= Date.now()) { this.entries.delete(id); await unlink(entry.path).catch(() => {}); }
  }
  private reserve(owner: string, bytes: number): () => void {
    const entries = [...this.entries.values()];
    const ownerBytes = entries.filter(e => e.owner === owner).reduce((n, e) => n + e.ref.facts.size, 0) + (this.reservations.get(owner) ?? 0);
    const allBytes = entries.reduce((n, e) => n + e.ref.facts.size, 0) + [...this.reservations.values()].reduce((a, b) => a + b, 0);
    if (ownerBytes + bytes > OWNER_LIMIT || allBytes + bytes > GLOBAL_LIMIT || entries.length + this.pending >= 200) throw new Error('Private file quota reached. Delete unused handles or wait for expiry.');
    this.pending++;
    this.reservations.set(owner, (this.reservations.get(owner) ?? 0) + bytes);
    return () => { this.pending--; const left = (this.reservations.get(owner) ?? 0) - bytes; if (left) this.reservations.set(owner, left); else this.reservations.delete(owner); };
  }
  private get(owner: string, id: unknown): Entry {
    const entry = typeof id === 'string' ? this.entries.get(id) : undefined;
    if (!entry || entry.owner !== owner || entry.expires <= Date.now()) throw new Error('File handle not found or expired.');
    return entry;
  }
  private async save(owner: string, file: File, role: FileReferenceV1['role'], source?: Entry, report?: FileOperationReportV1): Promise<FileReferenceV1> {
    const release = this.reserve(owner, file.size);
    const id = randomUUID(); let path: string | undefined;
    try {
      this.directory ??= mkdtemp(join(tmpdir(), 'lolly-private-files-'));
      path = join(await this.directory, id);
      const facts = await describeOperationFile(file);
      await writeFile(path, Buffer.from(await file.arrayBuffer()), { flag: 'wx', mode: 0o600 });
      const ref: FileReferenceV1 = { id, version: facts.sha256, role, facts, ...(source ? { derivedFrom: { id: source.ref.id, version: source.ref.version, sha256: source.ref.facts.sha256 } } : {}) };
      this.entries.set(id, { owner, ref, expires: Date.now() + TTL_MS, path, report }); return ref;
    } catch (error) { if (path) await unlink(path).catch(() => {}); throw error; }
    finally { release(); }
  }
  async call(owner: string, name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!owner) throw new Error('Private file operations need an authenticated scope.');
    await this.prune();
    if (name === 'files_import') {
      if (typeof args.base64 !== 'string' || args.base64.length > Math.ceil(INPUT_LIMIT / 3) * 4 || args.base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(args.base64)) throw new Error('Supply canonical base64 for a file up to 4 MB.');
      const bytes = Buffer.from(args.base64, 'base64');
      if (bytes.length > INPUT_LIMIT || bytes.toString('base64') !== args.base64) throw new Error('Invalid or oversized base64.');
      return { file: await this.save(owner, new File([bytes], safeFileName(String(args.name ?? 'file')), { type: typeof args.mime === 'string' && args.mime.length <= 255 ? args.mime : 'application/octet-stream' }), 'original'), retention: 'Private to this token/process; expires after one hour or server restart. Keep a downloaded copy.' };
    }
    if (name === 'files_list') return { files: [...this.entries.values()].filter(entry => entry.owner === owner).map(entry => ({ ...entry.ref, expiresAt: new Date(entry.expires).toISOString() })) };
    const entry = this.get(owner, args.id);
    if (name === 'files_delete') { this.entries.delete(entry.ref.id); await unlink(entry.path).catch(() => {}); return { deleted: entry.ref.id }; }
    if (name === 'files_report') return { report: entry.report ?? null, file: entry.ref };
    if (name === 'files_convert') {
      assertFileOperationRequest(args.request);
      // Reserve the maximum output while encoding, so concurrent calls cannot
      // bypass quotas by all observing the same free space.
      const release = this.reserve(owner, 32 * 1024 * 1024);
      let outcome: Awaited<ReturnType<typeof runNodeFileOperation>>;
      try {
        const raw = await readOperationFile(entry.path);
        const source = new File([raw], entry.ref.facts.name, { type: entry.ref.facts.mime });
        const facts = await describeOperationFile(source);
        if (facts.sha256 !== entry.ref.facts.sha256) throw new Error('Source integrity check failed. Import the original again.');
        outcome = await runNodeFileOperation(source, args.request, undefined, 'instance');
        if (outcome.output && outcome.output.size > 32 * 1024 * 1024) throw new Error('Private operation output exceeds 32 MB. Use the local CLI for larger files.');
      } finally { release(); }
      return { report: outcome.report, ...(outcome.output ? { file: await this.save(owner, outcome.output, 'output', entry, outcome.report) } : {}) };
    }
    throw new Error('Unknown private file operation.');
  }
  async read(owner: string, uri: string): Promise<{ uri: string; mimeType: string; text?: string; blob?: string }> {
    const match = /^lolly:\/\/files\/([a-f0-9-]{36})\/(report|content)$/.exec(uri);
    if (!match) throw new Error('Invalid file resource URI.');
    const entry = this.get(owner, match[1]);
    if (match[2] === 'report') return { uri, mimeType: 'application/json', text: JSON.stringify({ file: entry.ref, report: entry.report ?? null }) };
    if (entry.ref.facts.size > 4 * 1024 * 1024) throw new Error('Inline resource reads are limited to 4 MB. Use the local CLI for larger output.');
    const file = await readOperationFile(entry.path);
    if ((await describeOperationFile(file)).sha256 !== entry.ref.facts.sha256) throw new Error('Saved result integrity check failed.');
    return { uri, mimeType: entry.ref.facts.mime, blob: Buffer.from(await file.arrayBuffer()).toString('base64') };
  }
}
export const PRIVATE_FILE_TOOLS = [
  { name: 'files_import', description: 'Import one private file (canonical base64, up to 4 MB). Later calls use its handle; bytes are never automatically echoed. Expires after one hour or process restart.', inputSchema: { type: 'object', required: ['name', 'base64'], properties: { name: { type: 'string' }, mime: { type: 'string' }, base64: { type: 'string' } } } },
  { name: 'files_list', description: 'List only files imported or generated within this authenticated token/process scope.', inputSchema: { type: 'object', properties: {} } },
  ...['convert', 'report', 'delete'].map(verb => ({ name: `files_${verb}`, description: verb === 'convert' ? 'Convert a private handle using FileOperationRequestV1: version 1, operation convert, target png/jpeg/webp/avif/csv/tsv/json/xlsx/woff/ttf/otf/pdf-clean/pdf-optimize, options object. Returns exact-byte receipts and a derived handle. Read bytes explicitly at lolly://files/{id}/content (up to 4 MB).' : `${verb === 'delete' ? 'Delete only this private file handle and its stored bytes' : 'Read the file facts and conversion receipt without loading bytes'}.`, inputSchema: { type: 'object', required: verb === 'convert' ? ['id', 'request'] : ['id'], properties: { id: { type: 'string' }, ...(verb === 'convert' ? { request: fileOperationRequestSchemaV1 } : {}) } } })),
];
export const privateFiles = new PrivateFileResources();
