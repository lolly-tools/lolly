// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ImageTraceError } from '../../../../engine/src/image-trace.ts';
import { createImageTraceWorkerClient, type ImageTraceWorker, type ImageTraceStage } from './image-trace-worker-client.ts';
import type { ImageTraceWorkerReply, ImageTraceWorkerRequest } from './image-trace-protocol.ts';

class TestWorker implements ImageTraceWorker {
  onmessage: ImageTraceWorker['onmessage'] = null;
  onerror: ImageTraceWorker['onerror'] = null;
  sent: { message: ImageTraceWorkerRequest; transfer: Transferable[] }[] = [];
  terminated = 0;
  postMessage(message: ImageTraceWorkerRequest, transfer: Transferable[]) {
    this.sent.push({ message, transfer });
    for (const t of transfer) structuredClone(t, { transfer: [t] });
  }
  terminate() { this.terminated++; }
  reply(data: ImageTraceWorkerReply) { this.onmessage?.(new MessageEvent('message', { data })); }
}
function setup(budgetMs = 1000) {
  const workers: TestWorker[] = [];
  const client = createImageTraceWorkerClient({ createWorker: () => { const w = new TestWorker(); workers.push(w); return w; }, budgetMs });
  return { client, workers };
}
const wire = JSON.stringify({ w: 2, h: 2, paths: [{ c: [1, 2, 3], d: [[1, 0, 0, 0, 0, 0, 0]] }] });
const ok = (id: number): ImageTraceWorkerReply => ({ id, ok: true, json: new TextEncoder().encode(wire) });

test('pixels are transferred, the stages are reported and the worker is reused', async () => {
  const { client, workers } = setup(); const px = new Uint8Array(16), buffer = px.buffer;
  const stages: ImageTraceStage[] = [];
  const run = client.trace(px, 2, 2, 'logo', undefined, s => stages.push(s));
  await Promise.resolve();
  assert.equal(workers[0]!.sent[0]!.transfer[0], buffer);
  assert.equal(buffer.byteLength, 0);
  workers[0]!.reply({ id: 1, stage: 'tracing' });
  workers[0]!.reply(ok(1));
  const result = await run;
  assert.deepEqual(stages, ['loading', 'tracing']);
  assert.equal(result.shapes[0]!.subpaths[0]!.anchors.length, 6);
  const second = client.trace(new Uint8Array(16), 2, 2, 'logo'); await Promise.resolve();
  workers[0]!.reply(ok(2)); await second;
  assert.equal(workers.length, 1); assert.equal(workers[0]!.terminated, 0);
  client.dispose();
});

test('aborting terminates the worker and the next trace starts a fresh one', async () => {
  const { client, workers } = setup(); const controller = new AbortController();
  const run = client.trace(new Uint8Array(16), 2, 2, 'logo', controller.signal);
  await Promise.resolve(); await Promise.resolve();
  controller.abort(new ImageTraceError('cancelled', 'The trace was cancelled.'));
  await assert.rejects(run, ImageTraceError);
  assert.equal(workers[0]!.terminated, 1);
  const next = client.trace(new Uint8Array(16), 2, 2, 'logo'); await Promise.resolve(); await Promise.resolve();
  assert.equal(workers.length, 2);
  workers[1]!.reply(ok(2)); await next; client.dispose();
});

test('cancel() stops the running trace', async () => {
  const { client, workers } = setup();
  const run = client.trace(new Uint8Array(16), 2, 2, 'logo'); await Promise.resolve(); await Promise.resolve();
  client.cancel();
  await assert.rejects(run, /cancelled/);
  assert.equal(workers[0]!.terminated >= 1, true);
});

test('a refusal from the module and a malformed result both surface as ImageTraceError', async () => {
  const { client, workers } = setup();
  const a = client.trace(new Uint8Array(16), 2, 2, 'logo'); await Promise.resolve();
  workers[0]!.reply({ id: 1, ok: false, code: 'limit', error: 'too big' });
  await assert.rejects(a, (e: unknown) => e instanceof ImageTraceError && e.code === 'limit' && e.message === 'too big');
  const b = client.trace(new Uint8Array(16), 2, 2, 'logo'); await Promise.resolve();
  workers[1]!.reply({ id: 2, ok: true, json: new TextEncoder().encode('not json') });
  await assert.rejects(b, ImageTraceError);
  client.dispose();
});

test('a worker that never answers is stopped at the time limit', async () => {
  const { client, workers } = setup(20);
  await assert.rejects(client.trace(new Uint8Array(16), 2, 2, 'logo'), /time limit/);
  assert.equal(workers[0]!.terminated, 1);
});
