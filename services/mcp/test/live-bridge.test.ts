// SPDX-License-Identifier: MPL-2.0
/**
 * The live bridge (plans/289 D1) end to end: a real WebSocket on loopback, a stand-in
 * tab that answers through the web shell's own session (shells/web/src/lib/live-agent.ts)
 * over a small fake editor, and the security answers from the plan's threat model:
 * the origin is checked, the code is single use, three wrong codes end the pairing,
 * one tab at a time, and the hosted dispatcher never lists the live tools.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:net';
import { WebSocket } from 'ws';
import { LiveBridge, liveOriginAllowed, extraOrigins, normaliseSecret } from '../src/live-bridge.ts';
import { dispatch } from '../src/server.ts';
import { callLiveTool } from '../src/live.ts';
import { createLiveSession, type LiveEditor } from '../../../shells/web/src/lib/live-agent.ts';

function fakeEditor(): LiveEditor {
  let rows: unknown[] = [{ id: 'a', type: 'rect', x: 0, y: 0, w: 10, h: 10 }];
  const stack: Array<{ before: unknown[] }> = [];
  return {
    tool: 'design', engine: '1.244.0', surface: 'web',
    rows: () => structuredClone(rows), size: () => ({ width: 200, height: 100 }), selection: () => [],
    fieldDefault: (_id, fallback) => fallback,
    async commit(next) { const e = { before: rows }; stack.push(e); rows = structuredClone(next); return e; },
    topEntry: () => stack[stack.length - 1] ?? null,
    undo() { const e = stack.pop(); if (e) rows = e.before; },
    look: async () => ({ svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><rect width="200" height="100" fill="#30ba78"/></svg>', width: 200, height: 100 }),
  };
}

/** A tab: connects, sends the code, then answers each request through a real session. */
function tab(port: number, code: string, origin = 'https://lolly.tools'): Promise<{ socket: WebSocket; paired: boolean; status?: number }> {
  return new Promise((resolve) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}`, { origin });
    const session = createLiveSession(fakeEditor());
    let paired = false;
    socket.on('unexpected-response', (_req, res) => resolve({ socket, paired: false, status: res.statusCode }));
    socket.on('error', () => resolve({ socket, paired: false }));
    socket.on('open', () => socket.send(JSON.stringify({ pair: code })));
    socket.on('message', async (data) => {
      const text = String(data);
      if (!paired) {
        if (JSON.parse(text).paired) { paired = true; resolve({ socket, paired: true }); }
        return;
      }
      socket.send(await session.handle(text));
    });
    socket.on('close', () => resolve({ socket, paired }));
  });
}

const portOf = (code: string) => Number(code.split('-')[0]);
const secretOf = (code: string) => code.split('-').slice(1).join('-');
const until = async (check: () => boolean, ms = 2000) => {
  const end = Date.now() + ms;
  while (!check() && Date.now() < end) await new Promise((r) => setTimeout(r, 10));
};

test('origins: Lolly\'s site, a named self-hosted one and localhost pair; any other site does not', () => {
  assert.ok(liveOriginAllowed('https://lolly.tools'));
  assert.ok(liveOriginAllowed('http://localhost:5173'));
  assert.ok(!liveOriginAllowed('https://evil.example'));
  assert.ok(!liveOriginAllowed('https://lolly.tools.evil.example'));
  assert.ok(!liveOriginAllowed(undefined));
  const extra = extraOrigins({ LOLLY_LIVE_ORIGINS: 'https://lolly.example.org/, not a url, https://x.test/path' });
  assert.deepEqual(extra, ['https://lolly.example.org']);
  assert.ok(liveOriginAllowed('https://lolly.example.org', extra));
  assert.equal(normaliseSecret('ab0o-il1x'), 'AB0011' + '1X');
});

test('a tab pairs with the code, answers hello, and serves document, apply, look and undo', async () => {
  const bridge = new LiveBridge({ clientName: () => 'Test agent', readDesktop: () => null });
  const pairing = await bridge.connect('auto');
  assert.equal(pairing.state, 'pairing');
  assert.match(pairing.code!, /^\d{2,5}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
  const t = await tab(portOf(pairing.code!), secretOf(pairing.code!).toLowerCase());
  assert.ok(t.paired);
  const status = await bridge.waitConnected(2000);
  await until(() => !!bridge.status().editor);
  assert.equal(bridge.status().state, 'connected');
  assert.deepEqual(bridge.status().editor, { tool: 'design', engine: '1.244.0' });
  assert.equal(status.surface, 'web');

  const doc = await callLiveTool(bridge, 'lolly_live_document', {});
  assert.match((doc.content[0] as { text: string }).text, /1 rows, canvas 200 x 100/);
  const applied = await callLiveTool(bridge, 'lolly_live_apply', { label: 'Move', layerPatches: [{ id: 'a', set: { x: 5 } }] });
  assert.match((applied.content[0] as { text: string }).text, /one undo step/);
  const refused = await callLiveTool(bridge, 'lolly_live_apply', { layerPatches: [{ id: 'zz', set: { x: 5 } }] });
  assert.equal(refused.isError, true);
  assert.match((refused.content[0] as { text: string }).text, /layer "zz" does not exist/);
  const look = await callLiveTool(bridge, 'lolly_live_look', { grid: false, maxSide: 256 });
  assert.equal(look.isError, undefined, JSON.stringify(look.content[0]));
  assert.equal(look.content[1]!.type, 'image');
  assert.match((await callLiveTool(bridge, 'lolly_live_undo', {})).content[0]!.type, /text/);

  t.socket.close();
  await until(() => bridge.status().state === 'idle');
  assert.match(bridge.status().ended ?? '', /tab disconnected/);
  await assert.rejects(bridge.request('document.get'), /Not connected/);
});

test('a page from another site is refused before any frame is read', async () => {
  const bridge = new LiveBridge({ readDesktop: () => null });
  const { code } = await bridge.connect('web');
  const t = await tab(portOf(code!), secretOf(code!), 'https://evil.example');
  assert.equal(t.paired, false);
  assert.equal(t.status, 403);
  assert.equal(bridge.status().state, 'pairing', 'the pairing still waits for the real tab');
  bridge.close();
});

test('the code is single use, one tab at a time, and three wrong codes end the pairing', async () => {
  const bridge = new LiveBridge({ readDesktop: () => null });
  const { code } = await bridge.connect('web');
  const port = portOf(code!);
  const first = await tab(port, secretOf(code!));
  assert.ok(first.paired);
  const second = await tab(port, secretOf(code!));
  assert.equal(second.status, 409, 'a second tab is refused while one is paired');
  bridge.close();

  const again = new LiveBridge({ readDesktop: () => null });
  const next = await again.connect('web');
  for (let i = 0; i < 3; i++) assert.equal((await tab(portOf(next.code!), 'WRNG-CODE')).paired, false);
  await until(() => again.status().state === 'idle');
  assert.match(again.status().ended ?? '', /Three wrong codes/);
});

test('desktop: the app\'s advert is preferred, every frame carries the token', async () => {
  const seen: Array<{ token: string; method: string }> = [];
  const server: Server = createServer((socket) => {
    let buf = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, typeof chunk === 'string' ? Buffer.from(chunk) : chunk]);
      if (buf.length < 4 || buf.length < 4 + buf.readUInt32BE(0)) return;
      const frame = JSON.parse(buf.subarray(4, 4 + buf.readUInt32BE(0)).toString('utf8'));
      seen.push({ token: frame.token, method: frame.request.method });
      const reply = Buffer.from(JSON.stringify({ jsonrpc: '2.0', id: frame.request.id, result: { protocol: 'live-v1', tool: 'design', engine: '1.244.0', surface: 'desktop' } }));
      const head = Buffer.alloc(4); head.writeUInt32BE(reply.length, 0);
      socket.end(Buffer.concat([head, reply]));
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const port = (server.address() as { port: number }).port;
  const bridge = new LiveBridge({ readDesktop: () => ({ port, token: 'secret-token', pid: process.pid, version: '1.1.0', file: 'live.json' }) });
  const status = await bridge.connect('auto');
  assert.equal(status.state, 'connected');
  assert.equal(status.surface, 'desktop');
  assert.deepEqual(seen, [{ token: 'secret-token', method: 'hello' }]);
  bridge.close();
  server.close();
  const none = new LiveBridge({ readDesktop: () => null });
  await assert.rejects(none.connect('desktop'), /Allow AI control/);
});

test('the dispatcher lists and answers the live tools only when a bridge is lent', async () => {
  const listed = async (live?: LiveBridge) => {
    const res = await dispatch({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, live ? { live } : {}) as { result: { tools: Array<{ name: string }> } };
    return res.result.tools.map((t) => t.name).filter((n) => n.startsWith('lolly_live_'));
  };
  assert.deepEqual(await listed(), []);
  const live = new LiveBridge({ readDesktop: () => null });
  assert.equal((await listed(live)).length, 7);
  const hosted = await dispatch({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'lolly_live_connect', arguments: {} } }) as { error?: { message: string } };
  assert.match(hosted.error?.message ?? '', /Unknown tool/);
});

test('desktop: a new Design view that has not heard hello gets it again, once', async () => {
  const methods: string[] = [];
  let helloCount = 0;
  const server: Server = createServer((socket) => {
    let buf = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, typeof chunk === 'string' ? Buffer.from(chunk) : chunk]);
      if (buf.length < 4 || buf.length < 4 + buf.readUInt32BE(0)) return;
      const { request } = JSON.parse(buf.subarray(4, 4 + buf.readUInt32BE(0)).toString('utf8'));
      methods.push(request.method);
      if (request.method === 'hello') helloCount++;
      // The view behind the listener changes after the first hello: it needs hello again.
      const fresh = request.method !== 'hello' && helloCount < 2;
      const body = fresh
        ? { jsonrpc: '2.0', id: request.id, error: { code: -32001, message: 'Send hello first.' } }
        : { jsonrpc: '2.0', id: request.id, result: request.method === 'hello' ? { tool: 'design', engine: 'x' } : { rows: [], width: 1, height: 1, selection: [] } };
      const reply = Buffer.from(JSON.stringify(body));
      const head = Buffer.alloc(4); head.writeUInt32BE(reply.length, 0);
      socket.end(Buffer.concat([head, reply]));
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const port = (server.address() as { port: number }).port;
  const bridge = new LiveBridge({ readDesktop: () => ({ port, token: 't', pid: process.pid, version: '', file: 'live.json' }) });
  await bridge.connect('desktop');
  const doc = await bridge.request('document.get') as { rows: unknown[] };
  assert.deepEqual(doc.rows, []);
  assert.deepEqual(methods, ['hello', 'document.get', 'hello', 'document.get']);
  bridge.close();
  server.close();
});
