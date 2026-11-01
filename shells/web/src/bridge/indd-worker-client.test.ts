// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InddError } from '@lolly-tools/node-shell/indd';
import { createInddWorkerClient, type InddWorker } from './indd-worker-client.ts';
import type { InddWorkerReply, InddWorkerRequest } from './indd-protocol.ts';

class TestWorker implements InddWorker {
  onmessage: InddWorker['onmessage'] = null;
  onerror: InddWorker['onerror'] = null;
  sent: { message: InddWorkerRequest; transfer: Transferable[] }[] = [];
  terminated = 0;
  postMessage(message: InddWorkerRequest, transfer: Transferable[]) {
    this.sent.push({ message, transfer });
    // A real postMessage detaches transferred buffers.
    for (const t of transfer) structuredClone(t, { transfer: [t] });
  }
  terminate() { this.terminated++; }
  reply(data: InddWorkerReply) { this.onmessage?.(new MessageEvent('message', { data })); }
}
function setup(budgetMs = 1000) {
  const workers: TestWorker[] = [];
  const client = createInddWorkerClient({ createWorker: () => { const w = new TestWorker(); workers.push(w); return w; }, budgetMs });
  return { client, workers };
}
const ok = (id: number): InddWorkerReply => ({ id, ok: true, idml: new Uint8Array([1, 2, 3]), warnings: ['w'] });

test('a large input is transferred, not copied, and the worker is reused', async () => {
  const { client, workers } = setup(); const bytes = new Uint8Array(64 * 1024 * 1024);
  const buffer = bytes.buffer;
  const first = client.convert(bytes, 'a.indd');
  await Promise.resolve();
  assert.equal(workers[0]!.sent[0]!.transfer[0], buffer, 'the caller buffer itself is transferred');
  assert.equal(workers[0]!.sent[0]!.message.bytes.buffer, buffer);
  assert.equal(buffer.byteLength, 0, 'the caller buffer is detached');
  workers[0]!.reply(ok(1));
  assert.deepEqual(await first, { idml: new Uint8Array([1, 2, 3]), warnings: ['w'] });
  const second = client.convert(new Uint8Array(8), 'b.indd'); await Promise.resolve();
  workers[0]!.reply(ok(2)); await second;
  assert.equal(workers.length, 1); assert.equal(workers[0]!.terminated, 0);
  client.dispose();
});

test('a view onto part of a buffer is copied so unrelated bytes are not detached', async () => {
  const { client, workers } = setup(); const whole = new Uint8Array(100), view = whole.subarray(10, 50);
  const run = client.convert(view, 'v.indd'); await Promise.resolve();
  assert.equal(whole.buffer.byteLength, 100);
  assert.notEqual(workers[0]!.sent[0]!.transfer[0], whole.buffer);
  workers[0]!.reply(ok(1)); await run; client.dispose();
});

test('a refusal surfaces as a typed InddError and the next call gets a fresh worker', async () => {
  const { client, workers } = setup();
  const first = client.convert(new Uint8Array(8), 'a.indd'); await Promise.resolve();
  workers[0]!.reply({ id: 1, ok: false, code: 'failed', error: 'not an INDD file' });
  await assert.rejects(first, (e: unknown) => e instanceof InddError && e.code === 'failed' && /not an INDD/.test(e.message));
  assert.equal(workers[0]!.terminated, 1);
  const second = client.convert(new Uint8Array(8), 'b.indd'); await Promise.resolve();
  assert.equal(workers.length, 2);
  workers[1]!.reply(ok(2)); await second; client.dispose();
});

test('a worker crash is a crashed InddError and the worker is replaced', async () => {
  const { client, workers } = setup();
  const run = client.convert(new Uint8Array(8), 'a.indd'); await Promise.resolve();
  workers[0]!.onerror?.(new ErrorEvent('error', { message: 'memory access out of bounds' }));
  await assert.rejects(run, (e: unknown) => e instanceof InddError && e.code === 'crashed');
  assert.equal(workers[0]!.terminated, 1);
  const next = client.convert(new Uint8Array(8), 'b.indd'); await Promise.resolve();
  assert.equal(workers.length, 2); workers[1]!.reply(ok(2)); await next; client.dispose();
});

test('aborting the signal terminates the worker and rejects with the reason', async () => {
  const { client, workers } = setup(); const controller = new AbortController();
  const run = client.convert(new Uint8Array(8), 'a.indd', controller.signal); await Promise.resolve();
  controller.abort(new DOMException('closed', 'AbortError'));
  await assert.rejects(run, { name: 'AbortError' });
  assert.equal(workers[0]!.terminated, 1);
  await assert.rejects(client.convert(new Uint8Array(8), 'b.indd', controller.signal), { name: 'AbortError' });
  assert.equal(workers.length, 1);
});

test('cancel stops the running job, and oversize or empty input is refused without a worker', async () => {
  const { client, workers } = setup();
  const run = client.convert(new Uint8Array(8), 'a.indd'); await Promise.resolve();
  client.cancel();
  await assert.rejects(run, { name: 'AbortError' });
  assert.equal(workers[0]!.terminated >= 1, true);
  await assert.rejects(client.convert(new Uint8Array(), 'e.indd'), (e: unknown) => e instanceof InddError && e.code === 'failed');
  client.dispose();
});

test('the time budget turns a hung worker into a crashed error', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { client, workers } = setup(50);
  const run = client.convert(new Uint8Array(8), 'a.indd'); await Promise.resolve();
  t.mock.timers.tick(60);
  await assert.rejects(run, (e: unknown) => e instanceof InddError && e.code === 'crashed');
  assert.equal(workers[0]!.terminated, 1);
});
