// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { AssetRef, HostV1 } from '@lolly-tools/core/host-v1';
import type { LoadedTool } from '../../../../engine/src/loader.ts';
import { buildInputModel } from '../../../../engine/src/inputs.ts';
import { clearSiteToolSources, publishSiteTool, publishSiteEditor } from './site-tools-context.ts';

const dom = new JSDOM('', { url: 'https://lolly.test/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage });
const { createSiteToolCall } = await import('./site-tools-discovery.ts');
const { registerSessionSource } = await import('./session-source.ts');
const library: AssetRef = { source: 'library', id: 'catalog/logo', type: 'vector', format: 'svg', url: '/logo.svg', width: 100, height: 40, meta: { name: 'Approved logo', tags: ['brand'], license: 'CC-BY-4.0' } };
const upload: AssetRef = { source: 'user', id: 'user/photo', type: 'raster', format: 'png', url: 'blob:photo', meta: { name: 'Photo' } };
const cachedShared: AssetRef = { ...upload, id: 'user/team/another-project', meta: { name: 'Private other project' } };

function host() {
  let resolutions = 0;
  const profile = { folders: [
    { id: 'a', name: 'Project A', items: [{ type: 'image', ref: library.id }, { type: 'session', ref: 'saved-a' }] },
    { id: 'child', name: 'Child', parentId: 'a', items: [{ type: 'image', ref: upload.id }] },
    { id: 'b', name: 'Project B', items: [{ type: 'image', ref: cachedShared.id }, { type: 'session', ref: 'saved-b' }] },
  ] };
  const value = { profile: { get: async () => profile },
    assets: { query: async () => [library], _queryMetadata: async () => [library], _listUserAssets: async () => [upload, cachedShared], get: async () => { resolutions++; throw new Error('Original fetched'); } },
    state: { list: async () => [{ slot: 'saved-a', toolId: 'design', label: 'Draft A' }, { slot: 'saved-b', label: 'Draft B' }, { slot: '__trash__:removed', label: 'Trash' }] },
    capabilities: [],
  } as unknown as HostV1;
  return { value, resolutions: () => resolutions };
}

test('asset scopes exclude unrelated project files and project listings use metadata only', async () => {
  clearSiteToolSources({ name: 'projects', folderId: 'a' });
  const f = host(), call = createSiteToolCall(f.value);
  const project = await call('lolly_search_assets', { scope: 'project' }) as { items: AssetRef[] };
  assert.deepEqual(project.items.map(item => item.id), [library.id, upload.id]);
  const uploads = await call('lolly_search_assets', { scope: 'uploads' }) as { items: AssetRef[] };
  assert.deepEqual(uploads.items.map(item => item.id), [upload.id]);
  const listing = await call('lolly_read_project', { limit: 2 }) as { items: Array<{ id: string }>; total: number; nextOffset: number };
  assert.equal(listing.total, 4); assert.equal(listing.items.length, 2); assert.equal(listing.nextOffset, 2);
  assert.equal(f.resolutions(), 0);
  await assert.rejects(call('lolly_describe_asset', { scope: 'project', id: cachedShared.id }), /unavailable/);
});

test('the Projects root does not silently broaden project asset scope to the whole device', async () => {
  clearSiteToolSources({ name: 'projects', folderId: null });
  const call = createSiteToolCall(host().value);
  const root = await call('lolly_read_project', {}) as { id: string | null; items: Array<{ id: string }> };
  assert.equal(root.id, null); assert.deepEqual(root.items.map(item => item.id), ['a', 'b']);
  await assert.rejects(call('lolly_search_assets', { scope: 'project' }), /Open a project/);
});

test('active tools expose engine definitions and follow their saved project membership', async () => {
  clearSiteToolSources({ name: 'tool' });
  const f = host();
  const tool = { manifest: { id: 'probe', name: 'Probe', version: '1.0.0', status: 'community', description: 'Probe',
    inputs: [{ id: 'title', type: 'text', label: 'Title', default: 'Hello', maxLength: 32 }], render: { width: 100, height: 100, formats: ['svg'] } } } as LoadedTool;
  const model = buildInputModel(tool.manifest); model[0]!.value = 'Current title';
  const remove = publishSiteTool({ tool, host: f.value, model: () => model, slot: () => 'saved-a', folder: () => null, readOnly: () => false, current: () => true });
  const call = createSiteToolCall(f.value);
  const description = await call('lolly_describe_tool', { id: 'probe' }) as { inputs: Array<{ id: string; value: string; maxLength: number }> };
  assert.equal(description.inputs[0]!.maxLength, 32); assert.equal(description.inputs[0]!.value, 'Current title');
  const context = await call('lolly_read_context', {}) as { project: { id: string }; tool: { id: string } };
  assert.equal(context.project.id, 'a'); assert.equal(context.tool.id, 'probe'); remove();
});

test('late project reads cannot return data after navigation', async () => {
  clearSiteToolSources({ name: 'projects', folderId: 'a' });
  const f = host(); let resolve!: (value: object) => void;
  f.value.profile.get = () => new Promise(done => { resolve = done; }) as ReturnType<HostV1['profile']['get']>;
  const pending = createSiteToolCall(f.value)('lolly_read_project', {});
  clearSiteToolSources({ name: 'projects', folderId: 'b' }); resolve({ folders: [] });
  await assert.rejects(pending, /changed/);
});

test('large input models leave document capabilities readable in context', async () => {
  clearSiteToolSources({ name: 'tool' });
  const f = host();
  const tool = { manifest: { id: 'probe', name: 'Probe', version: '1.0.0', status: 'community', description: 'Probe',
    inputs: Array.from({ length: 100 }, (_, i) => ({ id: `input-${i}`, type: 'longtext', label: 'Text', default: 'A'.repeat(4000) })), render: { width: 100, height: 100, formats: ['svg'] } } } as LoadedTool;
  const remove = publishSiteTool({ tool, host: f.value, model: () => buildInputModel(tool.manifest), slot: () => undefined, folder: () => null, readOnly: () => false, current: () => true });
  const removeEditor = publishSiteEditor({ close() {}, request: async () => null, state: () => ({ closed: false, connected: false, paused: false }) });
  try {
    const context = await createSiteToolCall(f.value)('lolly_read_context', {}) as { capabilities: { document: boolean; editDocument: boolean }; tool: { id: string } };
    assert.equal(context.capabilities.document, true); assert.equal(context.capabilities.editDocument, true);
    assert.equal(context.tool.id, 'probe'); assert.ok(JSON.stringify(context).length < 60_000);
  } finally { removeEditor(); remove(); }
});

test('shared project reads honour source refusals and never browse another project', async () => {
  clearSiteToolSources({ name: 'projects', projectId: 'current' });
  const requested: string[] = [];
  const remove = registerSessionSource({ label: 'Workspace', listProjects: async () => [{ id: 'current', name: 'Current' }, { id: 'other', name: 'Other' }],
    listSessions: async id => { requested.push(id); return [{ id: 'draft', toolId: 'design', label: 'Draft' }]; }, fetchSession: async () => null });
  try {
    const data = await createSiteToolCall(host().value)('lolly_read_project', {}) as { id: string; items: Array<{ id: string }> };
    assert.equal(data.id, 'current'); assert.deepEqual(requested, ['current']); assert.deepEqual(data.items.map(item => item.id), ['draft']);
  } finally { remove(); }
  const refused = registerSessionSource({ label: 'Workspace', listProjects: async () => [], readProjects: async () => ({ ok: false, status: 403 }), listSessions: async () => [], fetchSession: async () => null });
  try { await assert.rejects(createSiteToolCall(host().value)('lolly_read_project', {}), /refused \(403\)/); } finally { refused(); }
});
