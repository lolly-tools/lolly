// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { WebSocket } from 'ws';
import { LIVE_LIMITS, LIVE_PROTOCOL, type LiveRequestV1 } from '@lolly-tools/core';
import { LiveRelayBroker } from '../src/live-relay-broker.ts';

class EditorSocket extends EventEmitter {
  readyState = 1;
  send(text: string, done: (error?: Error) => void): void {
    const request = JSON.parse(text) as LiveRequestV1;
    queueMicrotask(() => this.emit('message', Buffer.from(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: { documentId: 'doc:idle' } }))));
    done();
  }
  close(): void { this.readyState = 3; this.emit('close'); }
}

test('active requests retain the grant beyond thirty minutes and inactivity expires it', async () => {
  let now = 0;
  const broker = new LiveRelayBroker(() => now);
  try {
    const unused = broker.mint('doc:unused', 'https://lolly.tools', 'edit');
    now = 10 * 60_000;
    assert.equal(broker.get(unused.token), undefined);
    const grant = broker.mint('doc:idle', 'https://lolly.tools', 'edit');
    const socket = new EditorSocket();
    broker.attach(grant.editorToken, grant.origin, socket as unknown as WebSocket);
    const call = (method: LiveRequestV1['method'], params = {}) => broker.request(grant, { jsonrpc: '2.0', id: 1, method, params });
    assert.equal((await call('hello', { protocol: LIVE_PROTOCOL, client: 'Studio assistant' })).error, undefined);
    now += LIVE_LIMITS.idleMs - 1000;
    assert.equal((await call('document.get')).error, undefined);
    now += 2000;
    assert.equal(broker.get(grant.token), grant);
    const expiry = grant.expiresAt;
    assert.ok((await call('document.get', { documentId: 'doc:other' })).error);
    assert.ok((await call('hello', { protocol: LIVE_PROTOCOL, client: 'Other assistant' })).error);
    assert.equal(grant.expiresAt, expiry);
    now = expiry;
    assert.equal(broker.get(grant.token), undefined);
    assert.equal(socket.readyState, 3);
    assert.ok((await call('document.get')).error);
  } finally { broker.dispose(); }
});

test('read-only refusals do not renew a grant, and explicit revocation cannot be renewed', async () => {
  let now = 0;
  const broker = new LiveRelayBroker(() => now);
  try {
    const grant = broker.mint('doc:idle', 'https://lolly.tools', 'read');
    const socket = new EditorSocket();
    broker.attach(grant.editorToken, grant.origin, socket as unknown as WebSocket);
    const call = (method: LiveRequestV1['method'], params = {}) => broker.request(grant, { jsonrpc: '2.0', id: 1, method, params });
    await call('hello', { protocol: LIVE_PROTOCOL, client: 'Reader' });
    const expiry = grant.expiresAt;
    now += 60_000;
    assert.ok((await call('document.apply')).error);
    assert.ok((await call('history.undo')).error);
    assert.equal(grant.expiresAt, expiry);
    broker.revoke(grant);
    assert.ok((await call('hello', { protocol: LIVE_PROTOCOL, client: 'Reader' })).error);
    assert.equal(broker.get(grant.token), undefined);
  } finally { broker.dispose(); }
});
