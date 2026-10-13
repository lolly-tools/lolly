// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { LIVE_TOOLS, callLiveTool, type LiveToolBridge } from '../src/live.ts';
import { callAgentTool } from '../src/agent-connector.ts';
import { createLiveSession } from '../../../shells/web/src/lib/live-agent.ts';
import { inputLiveEditor } from '../../../shells/web/src/views/input-live.ts';
import { buildInputModel } from '../../../engine/src/inputs.ts';
import type { ToolManifest } from '../../../engine/src/loader.ts';

function fixture(readonly = false) {
  const manifest: ToolManifest = { id: 'caption', name: 'Caption', version: '1.0.0', engineVersion: '^1.0.0', status: 'official', render: { width: 100, height: 100, formats: ['svg'], convertPaths: false }, inputs: [{ id: 'caption', type: 'text', default: 'Hello', maxLength: 80 }] };
  const model = buildInputModel(manifest);
  const entries: Array<{ before: unknown; label: string }> = [];
  const editor = inputLiveEditor({ documentId: 'doc:caption', manifest, engine: 'test', surface: 'web', runtime: { getModel: () => model }, size: () => ({ width: 100, height: 100 }), history: {
    async commit(values, label) { if (values.caption === model[0]!.value) return; entries.push({ before: model[0]!.value, label }); model[0]!.value = String(values.caption); },
    top: () => entries.at(-1) ?? null,
    undo() { const entry = entries.pop(); if (entry) model[0]!.value = String(entry.before); },
  }, readOnly: () => readonly, label: (note, client) => `${client}: ${note}`, exportSvg: async () => new Blob([`<svg xmlns="http://www.w3.org/2000/svg"><text>${model[0]!.value}</text></svg>`]) });
  const session = createLiveSession(editor);
  let sequence = 0;
  const request = async (method: string, params?: Record<string, unknown>) => {
    const reply = JSON.parse(await session.handle(JSON.stringify({ jsonrpc: '2.0', id: ++sequence, method, ...(params ? { params } : {}) })));
    if (reply.error) throw new Error(reply.error.message);
    return reply.result;
  };
  const connect: LiveToolBridge['connect'] = async () => ({ state: 'connected', surface: 'web', editor: await request('hello', { protocol: 'live-v1', client: 'MCP helper' }) });
  const bridge: LiveToolBridge = { connect, waitConnected: () => connect(), request, close: () => session.close() };
  return { bridge, session, entries, model };
}

test('MCP input metadata and apply forwarding match the actual editor contract', async () => {
  const { bridge, entries, model } = fixture();
  const joined = await callLiveTool(bridge, 'lolly_live_connect', {});
  assert.equal((joined.structuredContent as { editor: { adapter: string } }).editor.adapter, 'inputs');
  const doc = await callLiveTool(bridge, 'lolly_live_document', {});
  assert.match((doc.content[0] as { text: string }).text, /1 safe inputs/);
  const state = doc.structuredContent as { inputSchema: { properties: { caption: { type: string } } }; revision: string; documentId: string };
  assert.equal(state.inputSchema.properties.caption.type, 'string');
  const context = await callLiveTool(bridge, 'lolly_live_context', {});
  assert.equal((context.structuredContent as { capabilities: { layerOperations: boolean } }).capabilities.layerOperations, false);
  const params = { documentId: state.documentId, ifRevision: state.revision, transactionId: 'caption', label: 'New caption', inputValues: { caption: 'Updated' } };
  const applied = await callLiveTool(bridge, 'lolly_live_apply', params);
  assert.equal(applied.isError, undefined); assert.match((applied.content[0] as { text: string }).text, /Changed inputs: caption/);
  assert.equal(model[0]!.value, 'Updated'); assert.equal(entries.length, 1); assert.equal(entries[0]!.label, 'MCP helper: New caption');
  assert.equal((await callLiveTool(bridge, 'lolly_live_apply', params)).isError, undefined); assert.equal(entries.length, 1);
  assert.equal((await callLiveTool(bridge, 'lolly_live_apply', { inputValues: { caption: 'Unknown' }, ignored: true })).isError, true);
  assert.equal((await callLiveTool(bridge, 'lolly_live_apply', { inputValues: { invented: true } })).isError, true);
  assert.equal((await callLiveTool(bridge, 'lolly_live_apply', { layerPatches: [{ id: 'caption', set: { text: 'Layer' } }] })).isError, true);
  assert.ok(Object.hasOwn(LIVE_TOOLS.find(tool => tool.name === 'lolly_live_apply')!.inputSchema.properties, 'inputValues'));
});

test('the hosted connector validates and carries inputValues while read grants refuse the actual write', async () => {
  for (const readonly of [false, true]) {
    const fixtureState = fixture(readonly);
    const invitation = `https://relay.example/live/invite#token=${'a'.repeat(43)}`;
    const transport: Parameters<typeof callAgentTool>[2] = async (_invitation, path, body) => {
      assert.equal(path, '/rpc');
      return JSON.parse(await fixtureState.session.handle(JSON.stringify(body)));
    };
    const connect = await callAgentTool('lolly_live_connect', { invitation, client: 'Hosted helper' }, transport);
    assert.equal(connect.isError, undefined);
    const doc = await callAgentTool('lolly_live_document', { invitation }, transport);
    const state = doc.structuredContent as { documentId: string; revision: string; capabilities: { inputValues: boolean } };
    assert.equal(state.capabilities.inputValues, !readonly);
    const edited = await callAgentTool('lolly_live_apply', { invitation, documentId: state.documentId, ifRevision: state.revision, transactionId: 'hosted-caption', inputValues: { caption: 'Hosted update' } }, transport);
    assert.equal(edited.isError, readonly ? true : undefined);
    assert.equal(fixtureState.model[0]!.value, readonly ? 'Hello' : 'Hosted update');
    fixtureState.session.close();
  }
});
