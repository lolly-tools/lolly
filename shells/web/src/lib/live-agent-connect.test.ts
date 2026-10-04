// SPDX-License-Identifier: MPL-2.0
/**
 * lib/live-agent-connect.ts: the code parser and the tab's pairing, against a
 * stand-in socket (the real WebSocket path is covered end to end by
 * services/mcp/test/live-bridge.test.ts).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pairWithAgent, parsePairingCode, type SocketLike } from './live-agent-connect.ts';
import type { LiveEditor } from './live-agent.ts';

test('pairing codes: port and eight characters, forgiving case, spaces and look-alikes', () => {
  assert.deepEqual(parsePairingCode('52817-K7QF-9XMB'), { port: 52817, secret: 'K7QF9XMB' });
  assert.deepEqual(parsePairingCode(' 52817 k7qf 9xmb '), { port: 52817, secret: 'K7QF9XMB' });
  assert.deepEqual(parsePairingCode('52817-OIL0-ABCD'), { port: 52817, secret: '0110ABCD' });
  assert.equal(parsePairingCode('80-AAAA-BBBB'), null, 'a privileged port is never a pairing');
  assert.equal(parsePairingCode('52817-AAAA'), null);
  assert.equal(parsePairingCode('example.com:52817-AAAA-BBBB'), null, 'no host can be typed in');
});

const editor: LiveEditor = {
  tool: 'design', engine: 'test', surface: 'web', rows: () => [], size: () => ({ width: 1, height: 1 }), selection: () => [],
  fieldDefault: (_i, f) => f, commit: async () => null, topEntry: () => null, undo() {}, look: async () => ({ svg: '<svg/>', width: 1, height: 1 }),
};

function fakeSocket() {
  const sent: string[] = [];
  let url = '';
  const socket: SocketLike & { sent: string[]; url(): string } = {
    readyState: 1, sent, url: () => url,
    send(data) { sent.push(data); },
    close() { this.readyState = 3; },
    onopen: null, onmessage: null, onclose: null, onerror: null,
  };
  return { socket, make: (u: string) => { url = u; return socket; } };
}

test('the tab connects to loopback only, sends the code, then answers requests', async () => {
  const { socket, make } = fakeSocket();
  const pending = pairWithAgent({ port: 52817, secret: 'K7QF9XMB' }, editor, { makeSocket: make });
  assert.equal(socket.url(), 'ws://127.0.0.1:52817');
  socket.onopen!({});
  assert.deepEqual(JSON.parse(socket.sent[0]!), { pair: 'K7QF9XMB' });
  socket.onmessage!({ data: JSON.stringify({ paired: true }) });
  const link = await pending;
  socket.onmessage!({ data: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'hello', params: { protocol: 'live-v1', client: 'Agent' } }) });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(JSON.parse(socket.sent[1]!).result.tool, 'design');
  assert.equal(link.session.client(), 'Agent');
  link.disconnect();
  assert.equal(socket.readyState, 3);
});

test('a refused code rejects with a message for the person, and the link never starts', async () => {
  const { socket, make } = fakeSocket();
  let ended = false;
  const pending = pairWithAgent({ port: 52817, secret: 'WRONGXXX' }, editor, { makeSocket: make, onEnd: () => { ended = true; } });
  socket.onopen!({});
  socket.onclose!({ code: 1008, reason: 'Wrong code' });
  await assert.rejects(pending, (e: Error & { reason?: string }) => e.reason === 'wrong-code');
  assert.equal(ended, false);
});

test('the agent closing a paired link ends it once, naming the agent', async () => {
  const { socket, make } = fakeSocket();
  const reasons: string[] = [];
  const pending = pairWithAgent({ port: 52817, secret: 'K7QF9XMB' }, editor, { makeSocket: make, onEnd: (r) => reasons.push(r) });
  socket.onopen!({});
  socket.onmessage!({ data: JSON.stringify({ paired: true }) });
  await pending;
  socket.onclose!({ code: 1000, reason: '' });
  socket.onclose!({ code: 1000, reason: '' });
  assert.deepEqual(reasons, ['agent']);
});
