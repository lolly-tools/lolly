// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { AssetRef, HostV1 } from '@lolly-tools/core/host-v1';
import { registerSessionSource, type SessionSource } from '../lib/session-source.ts';
import { copyAssetsToProject } from './asset-project-transfer.ts';
import type { TeamFile } from './team-files.ts';
import type { TeamFolder } from './team-folders.ts';

const bytes = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c636000000200010005fe02fea7c1cd0e0000000049454e44ae426082', 'hex');
const hash = createHash('sha256').update(bytes).digest('hex');
const ref: AssetRef = { id: 'user/source', source: 'user', type: 'raster', format: 'png', url: 'https://files.test/original', version: 'v1', checksum: hash, meta: { name: 'Hero.png' } };
const id = (n: number) => `fil_${String(n).padStart(22, '0')}`;
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

async function fixture(run: (f: {
  host: HostV1; files: TeamFile[]; folders: TeamFolder[]; counts: { uploads: number; placements: number; reads: number };
  failPlacement(): void; loseFinalize(): void; switchAccount(): void;
}) => Promise<void>) {
  const files: TeamFile[] = [{ id: id(1), projectId: 'p1', name: 'Teammate.png', checksum: hash, size: bytes.length, contentType: 'image/png', ready: true, asset: {} }];
  const folders: TeamFolder[] = [{ id: 'existing', projectId: 'p1', name: 'Existing', parentId: null, createdAt: '', items: [{ kind: 'file', ref: id(1) }] }, { id: 'target', projectId: 'p1', name: 'Nested target', parentId: 'existing', createdAt: '', items: [] }];
  const values = new Map<string, object>(), counts = { uploads: 0, placements: 0, reads: 0 };
  let fail = false, lost = false;
  const source: SessionSource = { label: 'Work', scope: 'person-a', listProjects: async () => [], listSessions: async () => [], fetchSession: async () => null,
    write: { projectOptions: () => ({ canCreate: true, groups: [] }), createProject: async () => ({ kind: 'error', status: 403 }), createSession: async () => ({ kind: 'error', status: 403 }), updateSession: async () => ({ kind: 'error', status: 403 }) } };
  const off = registerSessionSource(source), originalFetch = globalThis.fetch;
  let offOther: (() => void) | undefined;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input), method = init?.method ?? 'GET';
    if (url === ref.url) { counts.reads++; return new Response(bytes); }
    if (url.endsWith('/files') && method === 'GET') return json({ files: files.filter(file => file.ready), limits: { partBytes: 1024 * 1024, maxBytes: 1024 * 1024, projectBudgetBytes: 8 * 1024 * 1024, projectUsedBytes: 0, instanceRemainingBytes: 8 * 1024 * 1024 } });
    if (url.endsWith('/folders')) return json({ folders });
    if (url.endsWith('/files') && method === 'POST') {
      counts.uploads++;
      const file = { ...JSON.parse(String(init?.body)), id: id(files.length + 1), projectId: 'p1', ready: false } as TeamFile;
      files.push(file); return json({ file }, 201);
    }
    if (url.includes('/parts/')) { assert.deepEqual(Buffer.from(await (init!.body as Blob).arrayBuffer()), bytes); return new Response(null, { status: 204 }); }
    if (url.endsWith('/finalize')) { files.at(-1)!.ready = true; if (lost) { lost = false; throw new Error('Lost finalize response'); } return json({ file: files.at(-1) }); }
    if (url.includes('/folders/items/')) {
      counts.placements++; if (fail) { fail = false; return json({}, 503); }
      const fileId = url.split('/').at(-1)!;
      for (const folder of folders) folder.items = folder.items.filter(item => item.ref !== fileId);
      folders.find(folder => folder.id === JSON.parse(String(init?.body)).folderId)?.items.push({ kind: 'file', ref: fileId });
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected request ${method} ${url}`);
  }) as typeof fetch;
  const host = { state: { load: async (key: string) => values.get(key) ?? null, save: async (key: string, value: object) => { values.set(key, value); }, delete: async (key: string) => { values.delete(key); } } } as unknown as HostV1;
  try { await run({ host, files, folders, counts, failPlacement() { fail = true; }, loseFinalize() { lost = true; }, switchAccount() { offOther = registerSessionSource({ ...source, scope: 'person-b' }); } }); }
  finally { globalThis.fetch = originalFetch; offOther?.(); off(); }
}

test('copying equal bytes creates a distinct shared file and never relocates a teammate file', async () => {
  await fixture(async f => {
    const result = await copyAssetsToProject(f.host, [ref], { project: 'p1', folder: 'target' });
    assert.equal(result[0]?.ok, true); assert.equal(f.counts.uploads, 1);
    assert.deepEqual(f.folders[0]?.items, [{ kind: 'file', ref: id(1) }]);
    assert.deepEqual(f.folders[1]?.items, [{ kind: 'file', ref: id(2) }]);
    assert.equal(f.files[1]?.checksum, hash); assert.equal(ref.url, 'https://files.test/original');
  });
});

test('a failed placement retries only placement and a completed retry does not upload again', async () => {
  await fixture(async f => {
    f.failPlacement();
    const first = await copyAssetsToProject(f.host, [ref], { project: 'p1', folder: 'target' });
    assert.equal(first[0]?.ok, false); assert.equal(first[0]?.fileId, id(2));
    assert.equal((await copyAssetsToProject(f.host, [ref], { project: 'p1', folder: 'target' }))[0]?.ok, true);
    assert.equal((await copyAssetsToProject(f.host, [ref], { project: 'p1', folder: 'target' }))[0]?.ok, true);
    assert.equal(f.counts.uploads, 1); assert.equal(f.counts.placements, 2); assert.equal(f.counts.reads, 1);
  });
});

test('a lost finalize response reconciles the ready file rather than deleting or duplicating it', async () => {
  await fixture(async f => {
    f.loseFinalize();
    assert.equal((await copyAssetsToProject(f.host, [ref], { project: 'p1', folder: 'target' }))[0]?.ok, true);
    assert.equal(f.files.length, 2); assert.equal(f.files[1]?.ready, true); assert.equal(f.counts.uploads, 1);
  });
});

test('checksum changes and unavailable provider originals fail per item before any upload', async () => {
  await fixture(async f => {
    const results = await copyAssetsToProject(f.host, [{ ...ref, checksum: '0'.repeat(64) }, { ...ref, id: 'ext/p/a', meta: { provider: 'p', fileRole: 'rendition' } }], { project: 'p1', folder: 'target' });
    assert.ok(results.every(result => !result.ok)); assert.equal(f.counts.uploads, 0);
  });
});

test('cancelling a batch before the next item leaves original bytes and the destination untouched', async () => {
  await fixture(async f => {
    const controller = new AbortController(); controller.abort();
    const results = await copyAssetsToProject(f.host, [ref, { ...ref, id: 'user/another' }], { project: 'p1', folder: 'target' }, controller.signal);
    assert.ok(results.every(result => !result.ok)); assert.equal(f.counts.uploads, 0); assert.equal(f.counts.reads, 0); assert.equal(f.counts.placements, 0);
  });
});

test('receipts are scoped to the account, and externally moved copies are never silently moved back', async () => {
  await fixture(async f => {
    await copyAssetsToProject(f.host, [ref], { project: 'p1', folder: 'target' });
    f.folders[1]!.items = []; f.folders[0]!.items.push({ kind: 'file', ref: id(2) });
    assert.equal((await copyAssetsToProject(f.host, [ref], { project: 'p1', folder: 'target' }))[0]?.ok, false);
    f.switchAccount();
    assert.equal((await copyAssetsToProject(f.host, [ref], { project: 'p1', folder: 'target' }))[0]?.ok, true);
    assert.equal(f.counts.uploads, 2);
  });
});
