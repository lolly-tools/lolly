// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPhotoLookWorkerClient, type PhotoLookWorker } from './photo-look-worker-client.ts';
import type { PhotoLookWorkerReply, PhotoLookWorkerRequest } from './photo-look-protocol.ts';
import type { PhotoLookBakeRequest } from './photo-look-raster.ts';

class TestWorker implements PhotoLookWorker {
  onmessage: PhotoLookWorker['onmessage'] = null;
  onerror: PhotoLookWorker['onerror'] = null;
  sent: PhotoLookWorkerRequest[] = [];
  terminated = 0;
  postMessage(message: PhotoLookWorkerRequest) { this.sent.push(message); }
  terminate() { this.terminated++; }
  reply(data: PhotoLookWorkerReply) { this.onmessage?.(new MessageEvent('message', { data })); }
}
const request: PhotoLookBakeRequest = { blob: new Blob(['photo']), look: { id: 'look', kind: 'lut' } };

function setup() {
  const workers: TestWorker[] = [];
  const client = createPhotoLookWorkerClient({ createWorker: () => {
    const worker = new TestWorker(); workers.push(worker); return worker;
  }, onError() {}, idleMs: 100, budgetMs: 1000, cancelMs: 20 });
  return { client, workers };
}

test('photo worker reuse ignores old replies and idle disposal releases the worker', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { client, workers } = setup(); t.after(client.dispose);
  const blob = new Blob(['baked']);
  const first = client.run(request);
  workers[0]!.reply({ id: 1, ok: true, blob }); assert.equal(await first, blob);
  t.mock.timers.tick(90);
  const second = client.run(request);
  workers[0]!.reply({ id: 1, ok: false, error: 'old failure', name: 'Error' });
  workers[0]!.reply({ id: 2, ok: true, blob }); assert.equal(await second, blob);
  assert.equal(workers.length, 1); assert.equal(workers[0]!.terminated, 0);
  t.mock.timers.tick(100); assert.equal(workers[0]!.terminated, 1);
  const third = client.run(request);
  workers[1]!.reply({ id: 3, ok: true, blob }); await third;
  assert.equal(workers.length, 2);
});

test('cancellation holds admission until cleanup acknowledgement, preserving its reason', async t => {
  const { client, workers } = setup(); t.after(client.dispose);
  const controller = new AbortController();
  const pending = client.run(request, controller.signal);
  controller.abort('caller reason');
  assert.deepEqual(workers[0]!.sent[1], { kind: 'cancel', id: 1 });
  await assert.rejects(client.run(request), { code: 'WEBGPU_BUSY' });
  workers[0]!.reply({ id: 1, ok: false, error: 'cancelled', name: 'AbortError' });
  await assert.rejects(pending, reason => reason === 'caller reason');
  const next = client.run(request);
  workers[0]!.reply({ id: 2, ok: true, blob: new Blob() }); await next;
  assert.equal(workers.length, 1);
});

test('a cancelled worker that cannot acknowledge is terminated before the next bake', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { client, workers } = setup(); t.after(client.dispose);
  const controller = new AbortController();
  const pending = client.run(request, controller.signal);
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  controller.abort(); t.mock.timers.tick(20); await rejected;
  assert.equal(workers[0]!.terminated, 1);
  const next = client.run(request);
  workers[1]!.reply({ id: 2, ok: true, blob: new Blob() }); await next;
  assert.equal(workers.length, 2);
});

test('GPU failure and bake deadline dispose the worker', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { client, workers } = setup(); t.after(client.dispose);
  const pending = client.run(request);
  workers[0]!.reply({ id: 1, ok: false, error: 'lost', name: 'WebGpuError', code: 'WEBGPU_DEVICE_LOST' });
  await assert.rejects(pending, { code: 'WEBGPU_DEVICE_LOST' });
  assert.equal(workers[0]!.terminated, 1);
  const timeout = client.run(request);
  const rejected = assert.rejects(timeout, /past its budget/);
  t.mock.timers.tick(1000); await rejected;
  assert.equal(workers[1]!.terminated, 1);
});
