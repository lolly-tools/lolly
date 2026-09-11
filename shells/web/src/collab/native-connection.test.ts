// SPDX-License-Identifier: MPL-2.0
/**
 * native-connection - the native session → CollabConnection assembly (collab/native-connection.ts):
 * the RtcHandleTransport adapter (send encodes + fires, state, on('message') decodes, close),
 * the beam lane (json/binary send + drain-on-resolution), and nativeCollabConnection building
 * on the REAL createRtcCollabHandle (so this verifies the adapter is contract-accepted).
 *
 * Run directly:  node --test shells/web/src/collab/native-connection.test.ts
 *
 * The socket/handshake are Rust and out of scope here (tested in native_transport.rs and
 * verified device-to-device); this pins the JS adapter contract with a fake handle.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nativeAsRtcTransport, nativeCollabConnection } from './native-connection.ts';
import { decodeFrame } from './native-wire.ts';
import type { NativeTransportHandle, NativeLane } from './native-transport.ts';

class FakeHandle implements NativeTransportHandle {
  sessionId = 's1';
  sends: Array<{ lane: NativeLane; bytes: Uint8Array }> = [];
  closed = false;
  private subs = new Set<(lane: NativeLane, bytes: Uint8Array) => void>();
  private failNext = false;

  async send(lane: NativeLane, bytes: Uint8Array): Promise<void> {
    if (this.failNext) { this.failNext = false; throw new Error('socket dead'); }
    this.sends.push({ lane, bytes });
  }
  subscribe(cb: (lane: NativeLane, bytes: Uint8Array) => void): () => void {
    this.subs.add(cb);
    return () => { this.subs.delete(cb); };
  }
  async plate(): Promise<Uint8Array | null> { return null; }
  async close(): Promise<void> { this.closed = true; }

  // test helpers
  push(lane: NativeLane, bytes: Uint8Array): void { for (const cb of this.subs) cb(lane, bytes); }
  failOnce(): void { this.failNext = true; }
  lastOf(lane: NativeLane) { return [...this.sends].reverse().find((s) => s.lane === lane); }
}

const flush = () => new Promise<void>((r) => setImmediate(r));

test('adapter: state is live, sendOp/sendPresence encode + fire to their lanes', () => {
  const fake = new FakeHandle();
  const t = nativeAsRtcTransport(fake, { clientId: 'c1' });
  assert.equal(t.clientId, 'c1');
  assert.equal(t.state().connection, 'live');
  assert.equal(t.state().lanes.ops, 'open');

  assert.equal(t.sendOp({ k: 1 }), 'sent');
  assert.deepEqual(decodeFrame('ops', fake.lastOf('ops')!.bytes), { lane: 'ops', kind: 'op', op: { k: 1 } });

  const frame = { from: 'c1', seq: 1, state: null, away: false };
  assert.equal(t.sendPresence(frame), 'sent');
  assert.deepEqual(decodeFrame('presence', fake.lastOf('presence')!.bytes), { lane: 'presence', kind: 'presence', frame });
});

test('adapter: on("message") decodes inbound frames', () => {
  const fake = new FakeHandle();
  const t = nativeAsRtcTransport(fake, { clientId: 'c1' });
  const got: unknown[] = [];
  t.on('message', (m) => got.push(m));
  // Simulate the peer's ops frame arriving on the wire (the same bytes encodeOps produces).
  fake.push('ops', new TextEncoder().encode(JSON.stringify({ kind: 'op', op: { op: 'x' } })));
  assert.deepEqual(got, [{ lane: 'ops', kind: 'op', op: { op: 'x' } }]);
});

test('adapter: a rejected send closes the transport (terminal, no reconnect)', async () => {
  const fake = new FakeHandle();
  const t = nativeAsRtcTransport(fake, { clientId: 'c1' });
  let lastState = '';
  t.on('state', (s) => { lastState = s.connection; });
  fake.failOnce();
  assert.equal(t.sendOp({ k: 1 }), 'sent'); // fire-and-forget returns sent
  await flush();
  assert.equal(t.state().connection, 'closed', 'a dead socket flips the transport closed');
  assert.equal(lastState, 'closed', 'a state event fired');
  assert.equal(t.sendOp({ k: 2 }), 'closed', 'further sends are refused');
});

test('adapter: close() closes the handle and reports closed', () => {
  const fake = new FakeHandle();
  const t = nativeAsRtcTransport(fake, { clientId: 'c1' });
  t.close();
  assert.equal(fake.closed, true);
  assert.equal(t.state().connection, 'closed');
});

test('nativeCollabConnection builds a CollabConnection on the real handle; inviter sends the seeded hello', () => {
  const fake = new FakeHandle();
  const conn = nativeCollabConnection({
    handle: fake, role: 'inviter', clientId: 'c1', opVersion: '1.1.0', localName: 'Andy',
    toolId: 'qr-code', seedQuery: 'url=x',
  });
  assert.equal(conn.role, 'inviter');
  assert.equal(conn.ephemeral, false, 'the inviter owns the saved session');
  assert.equal(conn.toolId, 'qr-code');
  assert.ok(conn.handle, 'a real CollabSessionHandle was built (adapter accepted)');
  assert.ok(conn.beam, 'the beam link is published');

  // The inviter announced itself with the packed seed over the ops-lane hello.
  const hello = fake.sends.map((s) => decodeFrame(s.lane, s.bytes)).find((m) => m?.kind === 'hello');
  assert.deepEqual(hello, { lane: 'ops', kind: 'hello', clientId: 'c1', opVersion: '1.1.0', seed: 'url=x' });

  conn.close();
});

test('nativeCollabConnection acceptor is ephemeral and sends no hello', () => {
  const fake = new FakeHandle();
  const conn = nativeCollabConnection({ handle: fake, role: 'acceptor', clientId: 'c2' });
  assert.equal(conn.ephemeral, true);
  const hello = fake.sends.map((s) => decodeFrame(s.lane, s.bytes)).find((m) => m?.kind === 'hello');
  assert.equal(hello, undefined, 'the acceptor does not send a hello');
  conn.close();
});

test('beam lane: json/binary encode to the beam lane and drain fires after send resolves', async () => {
  const fake = new FakeHandle();
  const conn = nativeCollabConnection({ handle: fake, role: 'acceptor', clientId: 'c2' });
  const lane = conn.beam!.transport.beam;
  assert.equal(lane.isOpen(), true);
  assert.equal(lane.bufferedAmount(), 0);

  let drains = 0;
  const off = lane.onDrain(() => { drains++; });
  await flush(); // the initial kick (queueMicrotask)
  assert.ok(drains >= 1, 'the sender is kicked once the lane is open');

  lane.json({ pack: 'berlin' });
  await flush();
  const beamSend = fake.lastOf('beam');
  assert.ok(beamSend, 'a beam frame was sent');
  assert.deepEqual(decodeFrame('beam', beamSend!.bytes), { lane: 'beam', kind: 'json', json: { pack: 'berlin' } });
  assert.ok(drains >= 2, 'a drain fired after the send resolved (backpressure pull)');

  off();
  conn.close();
});
