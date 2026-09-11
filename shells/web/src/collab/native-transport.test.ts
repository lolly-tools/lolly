// SPDX-License-Identifier: MPL-2.0
/**
 * native-transport - the JS driver over the native command surface (collab/native-transport.ts):
 * the poll→fan loop, base64 send/recv round-trip, hex plate parsing, lane validation, the
 * connect/inbound/adopt lifecycle, and close.
 *
 * Run directly:  node --test shells/web/src/collab/native-transport.test.ts
 *
 * Pure: a fake invoke records calls + returns programmable native_recv payloads; timers are
 * injected so nothing waits in real time.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createNativeHandle,
  nativeConnect,
  pollNativeInbound,
  adoptNative,
  hexToBytes,
  type NativeEnv,
  type NativeLane,
} from './native-transport.ts';

interface Call { cmd: string; args?: Record<string, unknown> }

class FakeEnv {
  calls: Call[] = [];
  recvQueue: Array<{ lane: string; data: string }> = [];
  connectResult: unknown = { sessionId: 'sess-1', plateHex: 'aabb' };
  inboundResult: unknown = [];
  adoptResult: unknown = true;
  plateResult: unknown = 'aabbccdd';
  private timers: Array<{ id: number; fn: () => void }> = [];
  private seq = 1;

  invoke = async (cmd: string, args?: Record<string, unknown>) => {
    this.calls.push({ cmd, args });
    if (cmd === 'native_recv') { const q = this.recvQueue; this.recvQueue = []; return q; }
    if (cmd === 'native_connect') return this.connectResult;
    if (cmd === 'native_poll_inbound') return this.inboundResult;
    if (cmd === 'native_adopt') return this.adoptResult;
    if (cmd === 'native_plate') return this.plateResult;
    return undefined;
  };

  setInterval = (fn: () => void) => { const id = this.seq++; this.timers.push({ id, fn }); return id; };
  clearInterval = (h: unknown) => { this.timers = this.timers.filter((t) => t.id !== h); };
  tick() { for (const t of [...this.timers]) t.fn(); }
  env(): NativeEnv { return { invoke: this.invoke, setInterval: this.setInterval, clearInterval: this.clearInterval }; }
  cmds(): string[] { return this.calls.map((c) => c.cmd); }
}

const flush = () => new Promise<void>((r) => setImmediate(r));
const b64 = (bytes: number[]) => Buffer.from(bytes).toString('base64');

test('hexToBytes parses even hex and rejects the rest', () => {
  assert.deepEqual([...hexToBytes('aabbcc')!], [0xaa, 0xbb, 0xcc]);
  assert.equal(hexToBytes('abc'), null); // odd length
  assert.equal(hexToBytes('zz'), null); // non-hex
  assert.equal(hexToBytes(''), null);
});

test('subscribe starts polling and fans decoded frames per lane', async () => {
  const fe = new FakeEnv();
  fe.recvQueue = [
    { lane: 'ops', data: b64([1, 2, 3]) },
    { lane: 'beam', data: b64([9]) },
    { lane: 'presence', data: b64([7, 7]) },
    { lane: 'bogus', data: b64([0]) },       // dropped: unknown lane
    { lane: 'ops', data: '!!not base64!!' }, // dropped: malformed (no throw)
  ];
  const h = createNativeHandle('s1', fe.env());
  const got: Array<[NativeLane, number[]]> = [];
  const off = h.subscribe((lane, bytes) => got.push([lane, [...bytes]]));
  await flush(); // immediate first poll
  assert.deepEqual(got, [
    ['ops', [1, 2, 3]],
    ['beam', [9]],
    ['presence', [7, 7]],
  ]);
  off();
  // After unsubscribe the loop stops: a tick performs no further native_recv.
  const before = fe.calls.filter((c) => c.cmd === 'native_recv').length;
  fe.tick();
  await flush();
  assert.equal(fe.calls.filter((c) => c.cmd === 'native_recv').length, before);
});

test('send base64-encodes the bytes for native_send', async () => {
  const fe = new FakeEnv();
  const h = createNativeHandle('s1', fe.env());
  await h.send('ops', new Uint8Array([1, 2, 255]));
  const call = fe.calls.find((c) => c.cmd === 'native_send');
  assert.equal(call?.args?.sessionId, 's1');
  assert.equal(call?.args?.lane, 'ops');
  assert.equal(call?.args?.data, b64([1, 2, 255]));
});

test('plate fetches the hex and returns bytes', async () => {
  const fe = new FakeEnv();
  fe.plateResult = 'aabbccdd';
  const h = createNativeHandle('s1', fe.env());
  assert.deepEqual([...(await h.plate())!], [0xaa, 0xbb, 0xcc, 0xdd]);
});

test('close stops polling, clears subscribers, and refuses further sends', async () => {
  const fe = new FakeEnv();
  const h = createNativeHandle('s1', fe.env());
  h.subscribe(() => {});
  await flush();
  await h.close();
  assert.ok(fe.cmds().includes('native_close'));
  await assert.rejects(() => h.send('ops', new Uint8Array([1])), /native-session-closed/);
  const before = fe.calls.filter((c) => c.cmd === 'native_recv').length;
  fe.tick();
  await flush();
  assert.equal(fe.calls.filter((c) => c.cmd === 'native_recv').length, before, 'no polling after close');
});

test('nativeConnect returns a handle + plate hex', async () => {
  const fe = new FakeEnv();
  fe.connectResult = { sessionId: 'sess-42', plateHex: 'deadbeef' };
  const { handle, plateHex } = await nativeConnect('peer-1', fe.env());
  assert.equal(handle.sessionId, 'sess-42');
  assert.equal(plateHex, 'deadbeef');
  assert.equal(fe.calls.find((c) => c.cmd === 'native_connect')?.args?.peerId, 'peer-1');
});

test('nativeConnect throws when the native side returns no session', async () => {
  const fe = new FakeEnv();
  fe.connectResult = { plateHex: 'x' };
  await assert.rejects(() => nativeConnect('peer-1', fe.env()), /native-connect-failed/);
});

test('pollNativeInbound shapes + filters the inbound list', async () => {
  const fe = new FakeEnv();
  fe.inboundResult = [
    { sessionId: 'in-1', plateHex: 'aa' },
    { sessionId: '', plateHex: 'bb' },   // dropped: empty id
    { plateHex: 'cc' },                   // dropped: no id
  ];
  const list = await pollNativeInbound(fe.env());
  assert.deepEqual(list, [{ sessionId: 'in-1', plateHex: 'aa' }]);
});

test('adoptNative returns a handle on success, null on refusal', async () => {
  const fe = new FakeEnv();
  fe.adoptResult = true;
  const h = await adoptNative('in-1', fe.env());
  assert.equal(h?.sessionId, 'in-1');
  fe.adoptResult = false;
  assert.equal(await adoptNative('in-2', fe.env()), null);
});
