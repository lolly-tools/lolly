// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { WebSocket } from 'ws';
import { liveInvitationUrl } from '@lolly-tools/core/live-invite-v1';
import { createLiveRelay } from '../src/live-relay.ts';
import { LiveBridge } from '../src/live-bridge.ts';
import { createLiveSession, type LiveEditor } from '../../../shells/web/src/lib/live-agent.ts';

const origin = 'http://localhost:5186';
async function fixture() {
  const relay = createLiveRelay({});
  const server = createServer((req, res) => { void relay.handle(req, res).then(handled => { if (!handled) { res.writeHead(404); res.end(); } }); });
  const dispose = relay.mount(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/live`;
  const sockets: WebSocket[] = [];
  async function invite(documentId: string, permission = 'edit') {
    const response = await fetch(`${base}/invitations`, { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify({ documentId, permission }) });
    assert.equal(response.status, 201); return await response.json() as { token: string; editorToken: string };
  }
  async function editor(documentId: string, token: string) {
    let rows: unknown[] = [{ id: 'title', kind: 'text', text: documentId, x: 0, y: 0, w: 100, h: 20 }];
    const stack: object[] = [];
    const session = createLiveSession({ documentId, tool: 'design', engine: 'test', surface: 'web', rows: () => structuredClone(rows), selection: () => ['title'], size: () => ({ width: 1000, height: 800 }), fieldDefault: (_id, fallback) => fallback, commit: async next => { rows = next; const entry = {}; stack.push(entry); return entry; }, topEntry: () => stack.at(-1) ?? null, undo() {}, look: async () => ({ svg: '<svg/>', width: 1000, height: 800 }) } satisfies LiveEditor);
    const socket = new WebSocket(base.replace('http:', 'ws:') + '/editor', { origin }); sockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.on('open', () => socket.send(JSON.stringify({ editorToken: token })));
      socket.on('message', data => { const text = data.toString(); if (JSON.parse(text).type === 'attached') resolve(); else void session.handle(text).then(reply => socket.send(reply)); });
      socket.on('error', reject);
    });
    return { session, rows: () => rows, stack, socket };
  }
  return { base, invite, editor, async close() { for (const socket of sockets) socket.terminate(); dispose(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); } };
}

test('remote invitations isolate documents and apply retries make one history step', async () => {
  const f = await fixture();
  const one = new LiveBridge(), two = new LiveBridge();
  try {
    const a = await f.invite('doc:one'), b = await f.invite('doc:two');
    const editorA = await f.editor('doc:one', a.editorToken), editorB = await f.editor('doc:two', b.editorToken);
    await one.connectInvite(liveInvitationUrl(f.base, a.token), 'Assistant A'); await two.connectInvite(liveInvitationUrl(f.base, b.token), 'Assistant B');
    const doc = await one.request('document.get') as { revision: string };
    const params = { transactionId: 'test-edit', ifRevision: doc.revision, layerPatches: [{ id: 'title', set: { text: 'Alternative heading' } }] };
    const receipt = await one.request('document.apply', params) as { changedIds: string[] };
    assert.deepEqual(receipt.changedIds, ['title']);
    assert.equal((await one.request('document.apply', params) as { replayed: boolean }).replayed, true);
    assert.equal(editorA.stack.length, 1); assert.equal(editorB.stack.length, 0);
    assert.equal((editorB.rows()[0] as { text: string }).text, 'doc:two');
    await assert.rejects(one.request('document.get', { documentId: 'doc:two' }), /different document/);
    editorA.session.pause(true); await assert.rejects(one.request('document.apply', { layerPatches: [{ id: 'title', set: { text: 'Paused edit' } }] }), /paused/);
    editorA.socket.close();
    await new Promise(resolve => setTimeout(resolve, 20));
    await assert.rejects(one.request('document.get'), /expired or ended/);
  } finally { one.close(); two.close(); await f.close(); }
});

test('read-only grants and the scoped MCP endpoint expose only collaboration tools', async () => {
  const f = await fixture();
  const bridge = new LiveBridge();
  try {
    const grant = await f.invite('doc:read', 'read'); await f.editor('doc:read', grant.editorToken);
    await bridge.connectInvite(liveInvitationUrl(f.base, grant.token), 'Reader');
    await assert.rejects(bridge.request('document.apply', { layerPatches: [{ id: 'title', set: { x: 10 } }] }), /reading only/);
    const request = async (method: string, params?: unknown, token = grant.token) => {
      const response = await fetch(`${f.base}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
      return { status: response.status, body: await response.json() as { result?: { tools: Array<{ name: string; inputSchema: { properties: Record<string, unknown> } }> }; error?: { code: number } } };
    };
    const list = await request('tools/list'); assert.equal(list.status, 200); assert.equal(list.body.result!.tools.length, 9);
    assert.ok(list.body.result!.tools.every(tool => tool.name.startsWith('lolly_live_')));
    assert.ok(list.body.result!.tools.find(tool => tool.name === 'lolly_live_apply')!.inputSchema.properties.transactionId);
    assert.equal((await request('resources/read', { uri: 'lolly://tokens' })).body.error!.code, -32601);
    assert.equal((await request('tools/list', undefined, 'x'.repeat(43))).status, 401);
    await assert.rejects(new LiveBridge().connectInvite(liveInvitationUrl(f.base, grant.token), 'Another reader'), /another agent/);
  } finally { bridge.close(); await f.close(); }
});

test('invitation creation requires an allowed editor origin and a bounded identity', async () => {
  const f = await fixture();
  try {
    for (const site of ['', 'https://unrelated.example']) {
      const response = await fetch(`${f.base}/invitations`, { method: 'POST', headers: { 'content-type': 'application/json', ...(site ? { origin: site } : {}) }, body: JSON.stringify({ documentId: 'doc:test', permission: 'edit' }) });
      assert.equal(response.status, 403);
    }
    const response = await fetch(`${f.base}/invitations`, { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify({ documentId: '../other', permission: 'edit' }) });
    assert.equal(response.status, 400);
  } finally { await f.close(); }
});

test('a hosted MCP client joins, edits, retries and disconnects without a local bridge', async () => {
  const f = await fixture();
  try {
    const grant = await f.invite('doc:hosted'), editor = await f.editor('doc:hosted', grant.editorToken);
    const request = async (method: string, params: unknown) => {
      const response = await fetch(`${f.base}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${grant.token}` }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
      return { status: response.status, body: await response.json() as { result?: { isError?: boolean; structuredContent?: Record<string, unknown> }; error?: unknown } };
    };
    const tool = (name: string, args: unknown) => request('tools/call', { name, arguments: args });
    assert.equal((await request('initialize', { protocolVersion: '2025-03-26' })).status, 200);
    const connected = await tool('lolly_live_connect', { client: 'Hosted assistant' });
    assert.equal(connected.body.result!.isError, undefined);
    assert.equal((connected.body.result!.structuredContent!.editor as { documentId: string }).documentId, 'doc:hosted');
    const context = (await tool('lolly_live_context', {})).body.result!.structuredContent!;
    const args = { documentId: context.documentId, ifRevision: context.revision, transactionId: 'hosted-heading', layerPatches: [{ id: 'title', set: { text: 'Working together' } }] };
    assert.equal((await tool('lolly_live_apply', args)).body.result!.structuredContent!.changed, true);
    assert.equal((await tool('lolly_live_apply', args)).body.result!.structuredContent!.replayed, true);
    assert.equal(editor.stack.length, 1);
    assert.equal((editor.rows()[0] as { text: string }).text, 'Working together');
    assert.equal((await tool('lolly_live_disconnect', {})).status, 200);
    assert.equal((await tool('lolly_live_context', {})).status, 401);
  } finally { await f.close(); }
});
