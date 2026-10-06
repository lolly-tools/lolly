// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { registerSiteTools, type SiteToolDefinition, type SiteToolsDocument } from './site-tools.ts';
import { clearSiteToolSources, publishSiteEditor, publishSiteInspection, siteToolSources } from './site-tools-context.ts';
import { siteAsset, siteData, sitePage } from './site-tools-data.ts';

function fixture() {
  const doc: SiteToolsDocument = new JSDOM('').window.document;
  const tools = new Map<string, SiteToolDefinition>();
  doc.modelContext = { registerTool(tool) { tools.set(tool.name, tool); }, unregisterTool(name) { tools.delete(name); } };
  return { doc, tools };
}

test('site tools register only in a supported top-level document and dispose their handlers', async () => {
  const { doc, tools } = fixture();
  const calls: string[] = [];
  const dispose = await registerSiteTools(doc, async name => { calls.push(name); return { read: true }; });
  const read = tools.get('lolly_read_context')!;
  assert.deepEqual(await read.execute({}), { read: true });
  assert.deepEqual(calls, ['lolly_read_context']);
  assert.equal(tools.get('lolly_apply_document_changes')!.annotations.readOnlyHint, false);
  assert.equal(tools.get('lolly_apply_document_changes')!.annotations.destructiveHint, true);
  assert.equal(tools.get('lolly_search_assets')!.annotations.readOnlyHint, true);
  dispose(); assert.equal(tools.size, 0);
  await assert.rejects(read.execute({}), /ended/);
  delete doc.modelContext;
  await registerSiteTools(doc, async () => { throw new Error('Unsupported browser called a tool'); });
  const framed: SiteToolsDocument = { defaultView: { top: {} }, modelContext: { registerTool() { throw new Error('Iframe registration'); } } };
  await registerSiteTools(framed, async () => null);
});

test('registration failure rolls back already registered actions', async () => {
  const { doc, tools } = fixture();
  doc.modelContext!.registerTool = tool => {
    if (tool.name === 'lolly_describe_tool') throw new Error('Registration failed');
    tools.set(tool.name, tool);
  };
  await assert.rejects(registerSiteTools(doc, async () => null), /Registration failed/);
  assert.equal(tools.size, 0);
});

test('schemas and execution both reject missing scopes, unknown fields and unbounded requests', async () => {
  const { doc, tools } = fixture(); let calls = 0;
  await registerSiteTools(doc, async () => { calls++; return null; });
  const search = tools.get('lolly_search_assets')!;
  for (const args of [{}, { scope: 'other' }, { scope: 'catalog', limit: 101 }, { scope: 'project', offset: -1 }, { scope: 'uploads', invitation: 'secret' }]) {
    await assert.rejects(search.execute(args));
  }
  const apply = tools.get('lolly_apply_document_changes')!;
  await assert.rejects(apply.execute({ documentId: 'doc', ifRevision: 'revision', label: 'Move' }), /transactionId/);
  await assert.rejects(apply.execute({ documentId: 'doc', ifRevision: 'revision', transactionId: 'txn', label: 'Move', layerPatches: Array.from({ length: 101 }, () => ({ id: 'title', set: { x: 1 } })) }), /array/);
  assert.equal(calls, 0);
});

test('view teardown closes document actions and old inspection cleanup cannot clear a newer asset', () => {
  clearSiteToolSources({ name: 'tool' }); let closed = 0;
  publishSiteEditor({ request: async () => null, close() { closed++; }, state: () => ({ closed: false, connected: false, paused: false }) });
  const first = publishSiteInspection(() => ({ source: 'user', id: 'first', type: 'raster', format: 'png', url: 'blob:first' }));
  publishSiteInspection(() => ({ source: 'user', id: 'second', type: 'raster', format: 'png', url: 'blob:second' }));
  first(); assert.equal(siteToolSources().asset?.id, 'second');
  const before = siteToolSources().generation;
  clearSiteToolSources({ name: 'projects', folderId: 'next' });
  assert.equal(closed, 1); assert.equal(siteToolSources().editor, null); assert.equal(siteToolSources().asset, null);
  assert.ok(siteToolSources().generation > before);
});

test('asset summaries preserve declarations and rights without claiming credential verification', () => {
  const asset = siteAsset({ source: 'user', id: 'user/image', type: 'raster', format: 'png', url: 'blob:private', meta: {
    name: 'Portrait', aiGenerated: 'partial', aiOriginsDeclared: true, license: 'CC-BY-4.0', attribution: 'Source artist', rights: { creator: 'Source artist' },
    authorDeclaration: { name: 'Person', assertedBy: 'user', declaredAt: '2026-10-06T10:00:00Z' },
  } }, 'uploads');
  assert.equal(asset.authorDeclaration?.assertedBy, 'user');
  assert.deepEqual(asset.aiDisclosure, { kind: 'partial', declaredByUser: true });
  assert.deepEqual(asset.rights, { creator: 'Source artist' });
  assert.equal(asset.credentials.verification, 'not-checked');
  assert.ok(!JSON.stringify(asset).includes('blob:private'));
});

test('metadata responses are paged and cannot carry binary or inline file contents', () => {
  assert.deepEqual(sitePage(['one', 'two', 'three'], { offset: 1, limit: 1 }), { items: ['two'], total: 3, nextOffset: 2 });
  const data = siteData({ bytes: new Uint8Array([1, 2]), preview: 'data:image/png;base64,private', text: 'a'.repeat(100_000) }) as Record<string, unknown>;
  assert.equal(data.bytes, '[file on device]'); assert.equal(data.preview, '[file on device]');
  assert.ok(JSON.stringify(data).length < 5000);
});
