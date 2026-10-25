// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

/** A mounted Design tool whose editor stub applies patches to the model, as the live session does. */
function designSite(boxes: Array<Record<string, unknown>>) {
  const f = host();
  const tokens = JSON.parse(readFileSync(new URL('../../../../tests/fixtures/design-brief/tokens.json', import.meta.url), 'utf8'));
  (f.value as unknown as { tokens: unknown }).tokens = { snapshot: async () => ({ document: tokens, system: null, version: 'latest', selection: {} }) };
  const tool = { manifest: { id: 'design', name: 'Design', version: '1.0.0', status: 'community', description: 'Design',
    inputs: [{ id: 'boxes', type: 'blocks', label: 'Layers', default: [] }], render: { width: 100, height: 100, formats: ['svg'] } } } as unknown as LoadedTool;
  const model = [{ id: 'boxes', value: boxes }];
  const requests: Array<{ method: string; params: Record<string, unknown> }> = [];
  const removeTool = publishSiteTool({ tool, host: f.value, model: () => model as never, slot: () => undefined, folder: () => null, readOnly: () => false, current: () => true });
  const removeEditor = publishSiteEditor({ close() {}, state: () => ({ closed: false, connected: true, paused: false }), request: async (method, params) => {
    requests.push({ method, params });
    if (method === 'document.get') return { documentId: 'doc-1', revision: 'r1', rows: model[0]!.value.slice(0, 1) };
    if (method === 'document.apply') {
      const patches = (params.layerPatches ?? []) as Array<{ id: string; set: Record<string, unknown> }>;
      model[0]!.value = model[0]!.value.map((row) => ({ ...row, ...(patches.find((p) => p.id === row.id)?.set ?? {}) }));
      return { documentId: 'doc-1', changed: patches.length > 0, changedIds: patches.map((p) => p.id), revision: 'r2', currentRevision: 'r2', layers: model[0]!.value.length, label: String(params.label) };
    }
    return null;
  } });
  return { call: createSiteToolCall(f.value), requests, remove: () => { removeEditor(); removeTool(); } };
}

const STRONG_COPY =
  "In today's fast-paced world, it's important to delve into the rich tapestry of innovation. As an AI language model, I hope this helps! " +
  'Let me know if you have any other questions. This is a testament to our commitment, and it underscores the pivotal, transformative role we play in the ever-evolving landscape.';
const designBoard = (): Array<Record<string, unknown>> => [
  { id: 'a1', kind: 'frame', x: 0, y: 0, w: 1920, h: 1080, bg: '#ffffff' },
  { id: 'title', frame: 'a1', kind: 'text', x: 100, y: 100, w: 1600, h: 100, fontSize: 28, weight: '400', align: 'left', fg: '#13294b', text: 'Quarterly results' },
  { id: 'body', frame: 'a1', kind: 'text', x: 100, y: 300, w: 1600, h: 300, fontSize: 28, weight: '400', align: 'left', fg: '#13294b', text: 'Revenue grew in every region.' },
];

test('an applied change answers with creation feedback for the layers it touched, and never refuses', async () => {
  clearSiteToolSources({ name: 'tool' });
  const site = designSite(designBoard());
  try {
    const result = await site.call('lolly_apply_document_changes', { documentId: 'doc-1', ifRevision: 'r1', transactionId: 't1', label: 'Rewrite body',
      layerPatches: [{ id: 'body', set: { text: STRONG_COPY, align: 'center' } }] }) as { changed: boolean; feedback: { summary: string; writing: { band: string; score: number; previousScore: number }; findings: Array<{ layerId: string }>; phrases: Array<{ layerId: string }> } };
    assert.equal(result.changed, true, 'the edit went through');
    assert.equal(result.feedback.writing.band, 'strong');
    assert.ok(result.feedback.writing.score > result.feedback.writing.previousScore);
    assert.ok(result.feedback.findings.length > 0 && result.feedback.findings.every((f) => f.layerId === 'body'), 'only the touched layer');
    assert.ok(result.feedback.phrases.every((p) => p.layerId === 'body'));
    assert.match(result.feedback.summary, /Guidance to act on, not a gate\.$/);
    // A change that did nothing carries no feedback.
    const idle = await site.call('lolly_apply_document_changes', { documentId: 'doc-1', ifRevision: 'r2', transactionId: 't2', label: 'Nothing', layerPatches: [] }) as Record<string, unknown>;
    assert.equal(idle.feedback, undefined);
  } finally { site.remove(); }
});

test('lolly_check_document returns the whole report through the editor, read-only', async () => {
  clearSiteToolSources({ name: 'tool' });
  const site = designSite([...designBoard(), { id: 'draft', frame: 'a1', kind: 'text', x: 100, y: 700, w: 1600, h: 100, text: STRONG_COPY, hidden: true }]);
  try {
    const report = await site.call('lolly_check_document', { documentId: 'doc-1' }) as { documentId: string; revision: string; format: string; houseRules: { state: string }; writing: { band: string; state: string }; hidden: { layers: number }; summary: string };
    assert.equal(report.documentId, 'doc-1');
    assert.equal(report.revision, 'r1');
    assert.equal(report.format, 'lolly-creation-feedback');
    assert.equal(report.houseRules.state, 'checked');
    assert.equal(report.writing.state, 'scored');
    assert.notEqual(report.writing.band, 'strong', 'the hidden draft is left out');
    assert.equal(report.hidden.layers, 1);
    assert.match(report.summary, /This feedback informs; it never blocks an export\.$/);
    assert.deepEqual(site.requests.map((r) => r.method), ['document.get'], 'reading feedback changes nothing');
  } finally { site.remove(); }
  clearSiteToolSources({ name: 'tool' });
  await assert.rejects(createSiteToolCall(host().value)('lolly_check_document', {}), /Open a Design document/);
});
