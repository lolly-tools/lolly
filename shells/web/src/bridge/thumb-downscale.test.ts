// SPDX-License-Identifier: MPL-2.0
/**
 * The thumbnail picture copies (bridge/thumb-downscale.ts): made in the worker where it
 * can, on the main thread one at a time where it cannot, and on the main thread when
 * the worker fails, so a picture is never lost. bridge/thumb-downscale.browser.test.ts
 * checks in a real Chromium that both paths give the same pixels.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/bridge/thumb-downscale.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createThumbDownscaler, thumbOutputType, type DownscaleWorker } from './thumb-downscale.ts';
import type { ThumbDownscaleRequest } from './thumb-downscale-protocol.ts';

type Answer = (request: ThumbDownscaleRequest) => { ok: true; dataUrl: string } | { ok: false; error: string } | 'crash' | 'silent';

function fakeWorker(answer: Answer) {
  const made: DownscaleWorker[] = [];
  const createWorker = (): DownscaleWorker => {
    const worker: DownscaleWorker = {
      onmessage: null, onerror: null,
      postMessage(request) {
        const result = answer(request);
        if (result === 'silent') return;
        setImmediate(() => {
          if (result === 'crash') worker.onerror?.({ message: 'gone', preventDefault() {} } as ErrorEvent);
          else worker.onmessage?.({ data: { id: request.id, ...result } } as MessageEvent);
        });
      },
      terminate() {},
    };
    made.push(worker);
    return worker;
  };
  return { made, createWorker };
}

const blob = (type = 'image/jpeg'): Blob => new Blob([new Uint8Array([1, 2, 3])], { type });

test('JPEG stays JPEG and everything else becomes PNG, on both paths', () => {
  assert.equal(thumbOutputType('image/jpeg'), 'image/jpeg');
  assert.equal(thumbOutputType('image/png'), 'image/png');
  assert.equal(thumbOutputType('image/webp'), 'image/png');
});

test('a capable browser makes the copy in the worker, never on the main thread', async () => {
  const w = fakeWorker(request => ({ ok: true, dataUrl: `data:worker,${request.width}x${request.height}` }));
  let mainCalls = 0;
  const d = createThumbDownscaler({ createWorker: w.createWorker, workerCapable: () => true, inRealm: async () => { mainCalls++; return 'data:main'; }, yieldToPage: async () => {} });
  assert.equal(await d.downscale(blob(), 120, 80), 'data:worker,120x80');
  assert.equal(await d.downscale(blob('image/png'), 30, 20), 'data:worker,30x20');
  assert.equal(mainCalls, 0);
  assert.equal(w.made.length, 1, 'one worker for the visit');
  assert.deepEqual(d.stats, { worker: 2, inRealm: 0 });
});

test('a worker error, a crash or a stall falls back to the main thread, and two failures set the worker aside', async () => {
  let mode: 'error' | 'crash' | 'silent' = 'error';
  const w = fakeWorker(() => (mode === 'error' ? { ok: false, error: 'cannot decode' } : mode));
  const d = createThumbDownscaler({ createWorker: w.createWorker, workerCapable: () => true, inRealm: async () => 'data:main', yieldToPage: async () => {}, budgetMs: 20 });
  assert.equal(await d.downscale(blob(), 10, 10), 'data:main', 'an error reply: made on the main thread');
  mode = 'crash';
  assert.equal(await d.downscale(blob(), 10, 10), 'data:main', 'a crash: made on the main thread');
  mode = 'silent';
  assert.equal(await d.downscale(blob(), 10, 10), 'data:main', 'set aside after two failures, so no stall to wait out');
  assert.equal(w.made.length, 2, 'the crashed worker was replaced once, then no more');
});

test('a stalled worker gives up at its time limit and the copy is still made', async () => {
  const w = fakeWorker(() => 'silent');
  const d = createThumbDownscaler({ createWorker: w.createWorker, workerCapable: () => true, inRealm: async () => 'data:main', yieldToPage: async () => {}, budgetMs: 20 });
  assert.equal(await d.downscale(blob(), 10, 10), 'data:main');
});

test('without a worker the copies are made on the main thread one at a time, yielding before each', async () => {
  let running = 0, most = 0, yields = 0;
  const d = createThumbDownscaler({
    createWorker: () => { throw new Error('no worker expected'); },
    workerCapable: () => false,
    inRealm: async () => { running++; most = Math.max(most, running); await new Promise(resolve => setImmediate(resolve)); running--; return 'data:main'; },
    yieldToPage: async () => { yields++; await new Promise(resolve => setImmediate(resolve)); },
  });
  const all = await Promise.all([1, 2, 3, 4].map(() => d.downscale(blob(), 10, 10)));
  assert.deepEqual(all, ['data:main', 'data:main', 'data:main', 'data:main']);
  assert.equal(most, 1, 'never two at once');
  assert.equal(yields, 4, 'a turn of the event loop before each');
});
