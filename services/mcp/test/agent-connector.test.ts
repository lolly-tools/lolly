// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { WebSocket } from 'ws';
import { liveInvitationUrl } from '@lolly-tools/core/live-invite-v1';
import { AGENT_TOOLS, callAgentTool, publicRelayAddress, requestAgentRelay, type AgentTransport } from '../src/agent-connector.ts';
import { LiveRelayBroker } from '../src/live-relay-broker.ts';
import { createLiveSession, type LiveEditor } from '../../../shells/web/src/lib/live-agent.ts';
import { dispatch } from '../src/server.ts';

test('installed connector advertises only invited tools with explicit scope and honest annotations', async () => {
  const listed = await dispatch({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, { invitedLive: true });
  assert.deepEqual((listed!.result as { tools: unknown[] }).tools, AGENT_TOOLS);
  assert.equal(AGENT_TOOLS.length, 9);
  for (const tool of AGENT_TOOLS) {
    assert.ok(tool.inputSchema.required.includes('invitation'));
    assert.equal(tool.annotations.openWorldHint, true);
    assert.deepEqual(tool.securitySchemes, [{ type: 'noauth' }]);
  }
  assert.deepEqual(AGENT_TOOLS.filter(tool => tool.annotations.destructiveHint).map(tool => tool.name), ['lolly_live_apply', 'lolly_live_undo', 'lolly_live_disconnect']);
  const files = await dispatch({ jsonrpc: '2.0', id: 1, method: 'resources/read', params: { uri: 'lolly://files/private' } }, { invitedLive: true });
  assert.ok(files!.error);
});

test('public address admission rejects private, metadata and transition addresses', async () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '169.254.169.254', '192.168.1.1', '::1', 'fc00::1', '::ffff:127.0.0.1', '64:ff9b::7f00:1', '2002:7f00:1::1', '2001::1']) assert.equal(publicRelayAddress(ip), false, ip);
  assert.equal(publicRelayAddress('87.58.152.25'), true);
  await assert.rejects(requestAgentRelay({ base: 'https://127.0.0.1/live', token: 'a'.repeat(43) }, '/rpc', {}), /public relay/);
  await assert.rejects(requestAgentRelay({ base: 'http://localhost:8790/live', token: 'a'.repeat(43) }, '/rpc', {}), /public HTTPS/);
  await assert.rejects(requestAgentRelay({ base: 'https://example.com:22/live', token: 'a'.repeat(43) }, '/rpc', {}), /port 443/);
});

test('independent hosted calls preserve invitation scope, retries, pause, read access and revocation', async () => {
  const broker = new LiveRelayBroker();
  const sessions: ReturnType<typeof createLiveSession>[] = [];
  function document(id: string, permission: 'edit' | 'read' = 'edit') {
    const grant = broker.mint(id, 'https://team.example', permission);
    let rows: unknown[] = [{ id: 'title', kind: 'text', text: id, x: 0, y: 0, w: 200, h: 40 }];
    const history: object[] = [];
    const session = createLiveSession({ documentId: id, tool: 'design', engine: 'test', surface: 'web', rows: () => structuredClone(rows), selection: () => ['title'], size: () => ({ width: 1000, height: 800 }), fieldDefault: (_id, fallback) => fallback, commit: async next => { rows = next; const entry = {}; history.push(entry); return entry; }, topEntry: () => history.at(-1) ?? null, undo() { history.pop(); }, look: async () => ({ svg: '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="800"><rect width="1000" height="800" fill="white"/></svg>', width: 1000, height: 800 }) } satisfies LiveEditor);
    sessions.push(session);
    const socket = Object.assign(new EventEmitter(), { readyState: 1, send(raw: string, callback: (error?: Error) => void) { void session.handle(raw).then(reply => socket.emit('message', Buffer.from(reply))); callback(); }, close() { socket.readyState = 3; socket.emit('close'); } });
    broker.attach(grant.editorToken, grant.origin, socket as unknown as WebSocket);
    return { invitation: liveInvitationUrl('https://relay.example/live', grant.token), grant, session, history, rows: () => rows };
  }
  const a = document('doc:one'), b = document('doc:two'), reader = document('doc:read', 'read');
  const transport: AgentTransport = async (invitation, path, body) => {
    assert.equal(invitation.base, 'https://relay.example/live');
    const grant = broker.get(invitation.token);
    if (!grant) throw new Error('This invitation has expired or ended.');
    if (path === '/mcp') { broker.revoke(grant); return { jsonrpc: '2.0', id: 1, result: {} }; }
    const parsed = body as Parameters<typeof broker.request>[1];
    assert.ok(!('invitation' in (parsed.params ?? {})), 'the private capability is stripped from editor arguments');
    return await broker.request(grant, parsed) as unknown as Record<string, unknown>;
  };
  const call = (name: string, invitation: string, args = {}) => callAgentTool(`lolly_live_${name}`, { invitation, ...args }, transport);
  try {
    assert.ok((await call('document', a.invitation)).isError, 'reading before connect is refused');
    for (const item of [a, b, reader]) assert.equal((await call('connect', item.invitation, { client: item.grant.documentId })).isError, undefined);
    assert.equal((await call('status', a.invitation)).isError, undefined);
    assert.equal((await call('context', a.invitation)).isError, undefined);
    assert.equal((await call('find', a.invitation, { query: 'doc:one' })).isError, undefined);
    const modelDefaults = { ids: [], artboardId: '', kind: '', fields: ['text'], selection: false, offset: 0, limit: 20 };
    const foundReply = await call('find', a.invitation, { query: 'doc:one', ...modelDefaults });
    const found = foundReply.structuredContent as { rows: unknown[] };
    const firstText = foundReply.content[0] as { type: string; text: string };
    assert.equal(firstText.type, 'text');
    assert.deepEqual(JSON.parse(firstText.text.slice(firstText.text.indexOf('\n') + 1)), found, 'the first text content gives direct callers the complete layer data');
    assert.deepEqual(found.rows, [{ id: 'title', text: 'doc:one' }]);
    const unfiltered = (await call('document', a.invitation, { ids: [], artboardId: '' })).structuredContent as { rows: unknown[] };
    assert.equal(unfiltered.rows.length, 1);
    for (const filter of [{ ids: ['missing'] }, { artboardId: 'missing' }, { kind: 'image' }]) {
      const scoped = (await call('find', a.invitation, { query: 'doc:one', ...modelDefaults, ...filter })).structuredContent as { rows: unknown[] };
      assert.deepEqual(scoped.rows, []);
    }
    const docReply = await call('document', a.invitation);
    const doc = docReply.structuredContent as { revision: string };
    assert.match((docReply.content[0] as { text: string }).text, /"id": "title"/);
    const args = { documentId: 'doc:one', ifRevision: doc.revision, transactionId: 'one', layerPatches: [{ id: 'title', set: { text: 'Alternative' } }] };
    assert.equal((await call('apply', a.invitation, args)).isError, undefined);
    assert.equal(((await call('apply', a.invitation, args)).structuredContent as { replayed: boolean }).replayed, true);
    assert.equal(a.history.length, 1); assert.equal(b.history.length, 0);
    assert.equal((b.rows()[0] as { text: string }).text, 'doc:two');
    assert.ok((await call('document', b.invitation, { documentId: 'doc:one' })).isError);
    a.session.pause(true);
    assert.ok((await call('apply', a.invitation, { ...args, transactionId: 'paused' })).isError);
    a.session.pause(false);
    assert.ok((await call('apply', reader.invitation, { ...args, documentId: 'doc:read' })).isError);
    assert.equal((await call('look', a.invitation, { maxSide: 128, grid: false })).content[1]!.type, 'image');
    assert.equal((await call('undo', a.invitation)).isError, undefined);
    assert.equal((await call('disconnect', a.invitation)).isError, undefined);
    assert.ok((await call('document', a.invitation)).isError);
    assert.equal((await call('document', b.invitation)).isError, undefined);
    assert.ok((await callAgentTool('lolly_live_document', {}, transport)).isError);
    assert.ok((await call('apply', b.invitation, { layerPatches: [] })).isError, 'hosted edits require concurrency and retry fields');
    assert.ok((await call('document', b.invitation, { unknown: true })).isError);
  } finally { broker.dispose(); for (const session of sessions) session.close(); }
});
