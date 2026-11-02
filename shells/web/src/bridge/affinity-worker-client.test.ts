// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AffinityError } from '@lolly-tools/node-shell/affinity';
import { createAffinityWorkerClient, type AffinityWorker } from './affinity-worker-client.ts';
import type { AffinityWorkerReply, AffinityWorkerRequest } from './affinity-protocol.ts';

class TestWorker implements AffinityWorker {
  onmessage: AffinityWorker['onmessage'] = null;
  onerror: AffinityWorker['onerror'] = null;
  sent: { message: AffinityWorkerRequest; transfer: Transferable[] }[] = [];
  terminated = 0;
  postMessage(message: AffinityWorkerRequest, transfer: Transferable[]) {
    this.sent.push({ message, transfer });
    // A real postMessage detaches transferred buffers.
    for (const t of transfer) structuredClone(t, { transfer: [t] });
  }
  terminate() { this.terminated++; }
  reply(data: AffinityWorkerReply) { this.onmessage?.(new MessageEvent('message', { data })); }
}
function setup(budgetMs = 1000) {
  const workers: TestWorker[] = [];
  const client = createAffinityWorkerClient({ createWorker: () => { const w = new TestWorker(); workers.push(w); return w; }, budgetMs });
  return { client, workers };
}
const inspection = { kind: 'af' as const, container: 12, saved: 0, preview: null, previewError: null, document: null, documentError: null };
const ok = (id: number): AffinityWorkerReply => ({ id, ok: true, inspection, modelError: 'no model' });

test('a large input is transferred, not copied, and the worker is reused', async () => {
  const { client, workers } = setup(); const bytes = new Uint8Array(32 * 1024 * 1024);
  const buffer = bytes.buffer;
  const first = client.read(bytes, 'a.af');
  await Promise.resolve();
  assert.equal(workers[0]!.sent[0]!.transfer[0], buffer, 'the caller buffer itself is transferred');
  assert.equal(buffer.byteLength, 0, 'the caller buffer is detached');
  workers[0]!.reply(ok(1));
  assert.equal((await first).modelError, 'no model');
  const second = client.read(new Uint8Array(8), 'b.af'); await Promise.resolve();
  workers[0]!.reply(ok(2)); await second;
  assert.equal(workers.length, 1); assert.equal(workers[0]!.terminated, 0);
  client.dispose();
});

test('a view onto part of a buffer is copied so unrelated bytes are not detached', async () => {
  const { client, workers } = setup(); const whole = new Uint8Array(100), view = whole.subarray(10, 50);
  const run = client.read(view, 'v.af'); await Promise.resolve();
  assert.equal(whole.buffer.byteLength, 100);
  workers[0]!.reply(ok(1)); await run; client.dispose();
});

test('a refusal surfaces as a typed AffinityError and the next call gets a fresh worker', async () => {
  const { client, workers } = setup();
  const first = client.read(new Uint8Array(8), 'a.af'); await Promise.resolve();
  workers[0]!.reply({ id: 1, ok: false, code: 'failed', error: 'damaged Affinity file' });
  await assert.rejects(first, (e: unknown) => e instanceof AffinityError && e.code === 'failed' && /damaged/.test(e.message));
  assert.equal(workers[0]!.terminated, 1);
  const second = client.read(new Uint8Array(8), 'b.af'); await Promise.resolve();
  assert.equal(workers.length, 2);
  workers[1]!.reply(ok(2)); await second; client.dispose();
});

test('an empty or oversized input is refused before a worker exists, and aborting terminates the worker', async () => {
  const { client, workers } = setup();
  await assert.rejects(client.read(new Uint8Array(0), 'e.af'), (e: unknown) => e instanceof AffinityError && /empty/.test(e.message));
  await assert.rejects(client.read({ length: 97 * 1024 * 1024 } as unknown as Uint8Array, 'big.af'), (e: unknown) => e instanceof AffinityError && e.code === 'limit');
  assert.equal(workers.length, 0);
  const controller = new AbortController();
  const run = client.read(new Uint8Array(8), 'a.af', controller.signal); await Promise.resolve();
  controller.abort();
  await assert.rejects(run);
  assert.equal(workers[0]!.terminated, 1);
});

test('a run past its time limit is a crash, and a worker error is too', async () => {
  const { client, workers } = setup(10);
  await assert.rejects(client.read(new Uint8Array(8), 'slow.af'), (e: unknown) => e instanceof AffinityError && e.code === 'crashed');
  const run = client.read(new Uint8Array(8), 'x.af'); await Promise.resolve();
  workers[1]!.onerror?.(new ErrorEvent('error', { message: 'boom' }));
  await assert.rejects(run, (e: unknown) => e instanceof AffinityError && e.code === 'crashed' && /boom/.test(e.message));
});
