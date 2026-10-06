// SPDX-License-Identifier: MPL-2.0
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { LIVE_LIMITS, LIVE_PROTOCOL } from '@lolly-tools/core';
import { inviteAgent } from './live-agent-invite.ts';
import type { LiveEditor } from './live-agent.ts';

async function fixture(t: TestContext) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  let socket: EditorSocket;
  let reply: (value: string) => void = () => {};
  class EditorSocket extends EventTarget {
    static OPEN = 1;
    readyState = 1;
    constructor() { super(); socket = this; queueMicrotask(() => this.dispatchEvent(new Event('open'))); }
    send(text: string): void {
      if (JSON.parse(text).editorToken) queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ type: 'attached', documentId: 'doc:idle' }) })));
      else reply(text);
    }
    close(): void { this.readyState = 3; this.dispatchEvent(new Event('close')); }
  }
  const previous = globalThis.WebSocket;
  globalThis.WebSocket = EditorSocket as unknown as typeof WebSocket;
  t.after(() => { globalThis.WebSocket = previous; });
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ token: 'a'.repeat(43), editorToken: 'b'.repeat(43), expiresAt: Date.now() + 10 * 60_000 }), { status: 201 }));
  let ended = 0;
  const editor: LiveEditor = { documentId: 'doc:idle', tool: 'design', engine: 'test', surface: 'web', rows: () => [], selection: () => [], size: () => ({ width: 100, height: 100 }), fieldDefault: (_id, fallback) => fallback, commit: async () => null, topEntry: () => null, undo() {}, look: async () => ({ svg: '<svg/>', width: 100, height: 100 }) };
  const invitation = await inviteAgent(editor, 'https://lolly.ing/live', 'edit', { onEnd: () => { ended++; } });
  const call = async (method: string, params = {}) => {
    const response = new Promise<string>(resolve => { reply = resolve; });
    socket!.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }));
    return JSON.parse(await response);
  };
  t.after(() => invitation.disconnect());
  return { invitation, call, ended: () => ended };
}

test('hosted editor expires after inactivity rather than total connected time', async t => {
  const f = await fixture(t);
  assert.equal((await f.call('hello', { protocol: LIVE_PROTOCOL, client: 'Studio assistant' })).error, undefined);
  t.mock.timers.tick(LIVE_LIMITS.idleMs - 1000);
  assert.equal((await f.call('document.get')).error, undefined);
  t.mock.timers.tick(2000);
  assert.equal(f.invitation.session.connected(), true);
  assert.equal(f.ended(), 0);
  f.invitation.session.pause(true);
  assert.ok((await f.call('document.apply', { layerPatches: [{ id: 'missing', set: { text: 'Paused edit' } }] })).error);
  assert.equal(f.invitation.session.paused(), true);
  t.mock.timers.tick(LIVE_LIMITS.idleMs);
  assert.equal(f.invitation.session.connected(), false);
  assert.equal(f.ended(), 1);
});

test('unused invitations still expire at ten minutes and disconnect remains immediate', async t => {
  const f = await fixture(t);
  t.mock.timers.tick(10 * 60_000);
  assert.equal(f.ended(), 1);
  f.invitation.disconnect();
  assert.equal(f.ended(), 1);
});
