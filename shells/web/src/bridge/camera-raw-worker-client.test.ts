// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CameraRawError, type CameraRawMeta } from '@lolly-tools/node-shell/camera-raw';
import { createCameraRawWorkerClient, type CameraRawWorker } from './camera-raw-worker-client.ts';
import type { CameraRawWorkerReply, CameraRawWorkerRequest } from './camera-raw-protocol.ts';

class TestWorker implements CameraRawWorker {
  onmessage: CameraRawWorker['onmessage'] = null;
  onerror: CameraRawWorker['onerror'] = null;
  sent: { message: CameraRawWorkerRequest; transfer: Transferable[] }[] = [];
  terminated = 0;
  postMessage(message: CameraRawWorkerRequest, transfer: Transferable[]) {
    this.sent.push({ message, transfer });
    // A real postMessage detaches transferred buffers.
    for (const t of transfer) structuredClone(t, { transfer: [t] });
  }
  terminate() { this.terminated++; }
  reply(data: CameraRawWorkerReply) { this.onmessage?.(new MessageEvent('message', { data })); }
}
function setup(budgetMs = 1000) {
  const workers: TestWorker[] = [];
  const client = createCameraRawWorkerClient({ createWorker: () => { const w = new TestWorker(); workers.push(w); return w; }, budgetMs });
  return { client, workers };
}
const meta = { schema: 1, format: 'DNG', encoding: 'srgb-8-rgba', color: { exact: true }, warnings: [] } as unknown as CameraRawMeta;
const linearMeta = { ...meta, encoding: 'linear-prophoto-16' } as CameraRawMeta;
const ok = (id: number, m: CameraRawMeta = meta): CameraRawWorkerReply => ({ id, ok: true, width: 1, height: 1, meta: m, pixels: new ArrayBuffer(m === meta ? 4 : 6) });

test('a large input is transferred, not copied, and the worker is reused', async () => {
  const { client, workers } = setup(); const bytes = new Uint8Array(64 * 1024 * 1024);
  const buffer = bytes.buffer;
  const first = client.run(bytes, 'open');
  await Promise.resolve();
  assert.equal(workers[0]!.sent[0]!.transfer[0], buffer, 'the caller buffer itself is transferred');
  assert.equal(buffer.byteLength, 0, 'the caller buffer is detached');
  assert.equal(workers[0]!.sent[0]!.message.job, 'open');
  workers[0]!.reply(ok(1));
  const result = await first;
  assert.equal(result.rgba8?.length, 4); assert.equal(result.linear16, undefined);
  const second = client.run(new Uint8Array(8), 'linear', 'fast'); await Promise.resolve();
  assert.equal(workers[0]!.sent[1]!.message.quality, 'fast');
  workers[0]!.reply(ok(2, linearMeta)); const linear = await second;
  assert.equal(linear.linear16?.length, 3);
  assert.equal(workers.length, 1); assert.equal(workers[0]!.terminated, 0);
  client.dispose();
});

test('a view onto part of a buffer is copied so unrelated bytes are not detached', async () => {
  const { client, workers } = setup(); const whole = new Uint8Array(100), view = whole.subarray(10, 50);
  const run = client.run(view, 'probe'); await Promise.resolve();
  assert.equal(whole.buffer.byteLength, 100);
  assert.notEqual(workers[0]!.sent[0]!.transfer[0], whole.buffer);
  workers[0]!.reply({ id: 1, ok: true, width: 0, height: 0, meta, pixels: null });
  const result = await run; assert.equal(result.rgba8, undefined); client.dispose();
});

test('a refusal surfaces as a typed error and the next call gets a fresh worker', async () => {
  const { client, workers } = setup();
  const first = client.run(new Uint8Array(8), 'open'); await Promise.resolve();
  workers[0]!.reply({ id: 1, ok: false, code: 'limit', error: 'needs about 900 MiB' });
  await assert.rejects(first, (e: unknown) => e instanceof CameraRawError && e.code === 'limit' && /900 MiB/.test(e.message));
  assert.equal(workers[0]!.terminated, 1);
  const second = client.run(new Uint8Array(8), 'open'); await Promise.resolve();
  assert.equal(workers.length, 2);
  workers[1]!.reply(ok(2)); await second; client.dispose();
});

test('jobs run one at a time, in order', async () => {
  const { client, workers } = setup();
  const a = client.run(new Uint8Array(4), 'open'), b = client.run(new Uint8Array(4), 'open');
  await new Promise(r => setTimeout(r, 0));
  assert.equal(workers[0]!.sent.length, 1, 'the second job waits');
  workers[0]!.reply(ok(1)); await a; await new Promise(r => setTimeout(r, 0));
  assert.equal(workers[0]!.sent.length, 2);
  workers[0]!.reply(ok(2)); await b; client.dispose();
});

test('aborting stops the job and releases the worker; a hung worker times out', async () => {
  const { client, workers } = setup(20);
  const controller = new AbortController();
  const aborted = client.run(new Uint8Array(4), 'open', 'best', controller.signal); await Promise.resolve();
  controller.abort();
  await assert.rejects(aborted, (e: unknown) => (e as Error).name === 'AbortError');
  assert.equal(workers[0]!.terminated, 1);
  const hung = client.run(new Uint8Array(4), 'open');
  await assert.rejects(hung, (e: unknown) => e instanceof CameraRawError && e.code === 'crashed' && /time limit/.test(e.message));
  assert.equal(workers[1]!.terminated, 1);
});

test('empty and oversized inputs are refused before a worker starts', async () => {
  const { client, workers } = setup();
  await assert.rejects(client.run(new Uint8Array(0), 'open'), (e: unknown) => e instanceof CameraRawError && e.code === 'failed');
  assert.equal(workers.length, 0);
});
