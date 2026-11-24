// SPDX-License-Identifier: MPL-2.0
/**
 * Where the preview writer's raster rule runs (lib/preview-encode.ts): in a worker,
 * with background pictures waiting their turn and never running while a tool is
 * opening or open, an export runs or the tab is hidden; a picture someone asked for
 * goes at once; a worker that fails costs neither the picture nor the main thread.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/preview-encode.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPreviewEncoder, type EncodeWorker, type EncoderOptions } from './preview-encode.ts';
import type { PreparedPicture } from '../bridge/preview-store.ts';
import type { PreviewEncodeRequest } from './preview-encode-protocol.ts';

const ref = (key: string) => ({ key: key.padEnd(32, '0'), type: 'image/webp' as const, width: 720, height: 560, route: 'export-raster' as const });
const png = (tag: string) => new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, ...new TextEncoder().encode(tag)])], { type: 'image/png' });
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

/** A worker that answers each job with a picture, or crashes, answers with an error or never answers, on demand. */
function fakeWorker(behaviour: { fail?: boolean; errorReply?: boolean; stall?: boolean } = {}) {
  const posted: PreviewEncodeRequest[] = [];
  const worker: EncodeWorker = {
    onmessage: null, onerror: null,
    postMessage(message) {
      posted.push(message);
      if (behaviour.stall) return;
      setTimeout(() => {
        if (behaviour.fail) { worker.onerror?.({ message: 'crashed', preventDefault() {} } as ErrorEvent); return; }
        if (behaviour.errorReply) { worker.onmessage?.({ data: { id: message.id, ok: false, error: 'could not decode' } } as MessageEvent); return; }
        worker.onmessage?.({ data: { id: message.id, ok: true, picture: { ref: ref('a'), bytes: new Uint8Array([1, 2, 3]), verdict: { writer: 1, encoding: 'webp', difference: 3 } } } } as MessageEvent);
      }, 0);
    },
    terminate() {},
  };
  return { worker, posted };
}

function encoder({ startAllowed = true, lowPower = false, ...overrides }: Partial<EncoderOptions> & { worker?: EncodeWorker; startAllowed?: boolean; lowPower?: boolean } = {}) {
  const calls = { inRealm: 0, asRendered: 0, created: 0 };
  let allowed = startAllowed;
  const wakers: Array<() => void> = [];
  const options: EncoderOptions = {
    createWorker: () => { calls.created++; return overrides.worker ?? fakeWorker().worker; },
    workerCapable: () => true,
    allowed: () => allowed,
    constrained: () => lowPower,
    ready: () => Promise.resolve(),
    wake: (fn, ms) => { wakers.push(fn); const timer = setTimeout(fn, ms); (timer as { unref?: () => void }).unref?.(); },
    yieldToPage: () => Promise.resolve(),
    inRealm: async () => { calls.inRealm++; return { ref: ref('realm'), bytes: new Uint8Array([9]) } as PreparedPicture; },
    asRendered: async () => { calls.asRendered++; return { ref: { ...ref('raw'), type: 'image/png' }, bytes: new Uint8Array([7]), verdict: { writer: 1, encoding: 'as-rendered' } } as PreparedPicture; },
    ...overrides,
  };
  return { e: createPreviewEncoder(options), calls, setAllowed: (value: boolean) => { allowed = value; for (const fn of wakers.splice(0)) fn(); } };
}

test('a picture is encoded in the worker, and comes back with its verdict', async () => {
  const fake = fakeWorker();
  const { e, calls } = encoder({ worker: fake.worker });
  const picture = await e.encode(png('one'));
  assert.equal(fake.posted.length, 1);
  assert.ok(fake.posted[0]!.source instanceof Blob, 'the render goes as its bytes, decoded in the worker');
  assert.deepEqual(picture?.verdict, { writer: 1, encoding: 'webp', difference: 3 });
  assert.equal(calls.inRealm, 0, 'nothing encoded on this thread');
});

test('a background picture waits while preview work is not allowed (a tool open, an export, a hidden tab), and a save does not wait behind it', async () => {
  const fake = fakeWorker();
  const { e, setAllowed } = encoder({ worker: fake.worker, startAllowed: false });
  const background = e.encode(png('look'), {}, { background: true });
  await tick(); await tick();
  assert.equal(fake.posted.length, 0, 'nothing encoded while not allowed');
  const save = await e.encode(png('save'));
  assert.ok(save, 'a picture someone asked for goes at once');
  assert.equal(fake.posted.length, 1);
  setAllowed(true);
  assert.ok(await background);
  assert.equal(fake.posted.length, 2, 'the background picture once work was allowed again');
});

test('a tile is not kept waiting: after the wait limit, or at once on a constrained device, the render is kept as it came and nothing is judged', async () => {
  const fake = fakeWorker();
  const busy = encoder({ worker: fake.worker, startAllowed: false, maxWaitMs: 30 });
  const kept = await busy.e.encode(png('look'), {}, { background: true });
  assert.equal(kept?.verdict?.encoding, 'as-rendered');
  assert.equal(fake.posted.length, 0, 'nothing encoded while the page was busy');
  assert.equal(busy.calls.inRealm, 0);
  const lowPower = encoder({ worker: fake.worker, lowPower: true });
  const started = Date.now();
  assert.equal((await lowPower.e.encode(png('look'), {}, { background: true }))?.verdict?.encoding, 'as-rendered');
  assert.ok(Date.now() - started < 1000, 'at once');
  assert.equal(fake.posted.length, 0, 'Performance UI, a low battery or Save-Data: no rule work');
  assert.equal(lowPower.calls.inRealm, 0);
  assert.ok(await lowPower.e.encode(png('save')), 'a save is still encoded');
  assert.equal(fake.posted.length, 1);
});

test('background pictures go one at a time, in order', async () => {
  const fake = fakeWorker();
  const { e } = encoder({ worker: fake.worker });
  const order: number[] = [];
  await Promise.all([1, 2, 3].map(async n => { await e.encode(png(`p${n}`), {}, { background: true }); order.push(n); }));
  assert.deepEqual(order, [1, 2, 3]);
  assert.equal(fake.posted.length, 3);
});

test('a worker that fails costs neither the picture nor the main thread for background work; a save is encoded here as before', async () => {
  const failing = fakeWorker({ fail: true });
  const { e, calls } = encoder({ worker: failing.worker });
  const look = await e.encode(png('look'), {}, { background: true });
  assert.equal(look?.verdict?.encoding, 'as-rendered', 'the render kept as it came');
  assert.equal(calls.inRealm, 0, 'not encoded on the main thread');
  const save = await e.encode(png('save'));
  assert.ok(save);
  assert.equal(calls.inRealm, 1, 'a save is encoded on this thread when the worker fails');
  // After two failures the worker is set aside for the visit.
  await e.encode(png('again'), {}, { background: true });
  assert.equal(calls.created, 2, 'no third worker');
});

test('a worker that answers with an error, or cannot start, costs neither the picture nor the main thread', async () => {
  const replying = encoder({ worker: fakeWorker({ errorReply: true }).worker });
  assert.equal((await replying.e.encode(png('look'), {}, { background: true }))?.verdict?.encoding, 'as-rendered');
  assert.equal(replying.calls.inRealm, 0);
  let attempts = 0;
  const blocked = encoder({ createWorker: () => { attempts++; throw new Error('blocked by policy'); } });
  for (let i = 0; i < 3; i++) assert.equal((await blocked.e.encode(png(`look${i}`), {}, { background: true }))?.verdict?.encoding, 'as-rendered');
  assert.equal(blocked.calls.inRealm, 0, 'not encoded on the main thread');
  assert.equal(attempts, 2, 'a worker that cannot start counts as a failure; set aside after two');
});

test('a save does not wait out a stalled worker: past its short limit the picture is encoded here', async () => {
  const stalled = encoder({ worker: fakeWorker({ stall: true }).worker, foregroundBudgetMs: 30 });
  const started = Date.now();
  const picture = await stalled.e.encode(png('save'));
  assert.ok(picture);
  assert.equal(stalled.calls.inRealm, 1);
  assert.ok(Date.now() - started < 1000, 'well inside the save\'s 8 s capture limit');
});

test('a browser that cannot run the rule in a worker keeps the old path; an SVG is never posted', async () => {
  const fake = fakeWorker();
  const incapable = encoder({ worker: fake.worker, workerCapable: () => false });
  await incapable.e.encode(png('x'), {}, { background: true });
  assert.equal(incapable.calls.inRealm, 1);
  const svgCase = encoder({ worker: fake.worker });
  await svgCase.e.encode(new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'], { type: 'image/svg+xml' }));
  assert.equal(fake.posted.length, 0, 'an SVG cannot be decoded in a worker');
  assert.equal(svgCase.calls.inRealm, 1);
});

test('the page encoder waits for the same busy page as the idle work, keeps renders on a constrained device, and the background renders use it', () => {
  const source = readFileSync(new URL('./preview-encode.ts', import.meta.url), 'utf8');
  assert.match(source, /allowed: \(\) => !previewPageBusy\(\) && !mediaPlaying\(\)/);
  assert.match(source, /constrained: previewDeviceConstrained/);
  assert.match(source, /from '\.\/preview-work-gate\.ts'/, 'the same gate as the idle work');
  assert.match(readFileSync(new URL('./preview-idle.ts', import.meta.url), 'utf8'), /from '\.\/preview-work-gate\.ts'/);
  const render = readFileSync(new URL('./preview-render.ts', import.meta.url), 'utf8');
  assert.match(render, /writeRaster\(blob, facts, \{ background: true \}\)/);
  const gate = readFileSync(new URL('./preview-work-gate.ts', import.meta.url), 'utf8');
  const busy = gate.slice(gate.indexOf('export function previewPageBusy'), gate.indexOf('export function previewDeviceConstrained'));
  assert.match(busy, /if \(document\.querySelector\('\.view-fade--hold'\)\) return true;/, 'the tool-open sequence holds preview work');
  assert.match(busy, /if \(renderBusy\(\)\) return true;/, 'so does an export or a batch render');
  assert.match(busy, /visibilityState !== 'visible'\) return true;/, 'and a hidden tab');
  const constrainedPart = gate.slice(gate.indexOf('export function previewDeviceConstrained'), gate.indexOf('export function previewWorkAllowed'));
  assert.match(constrainedPart, /saveData/);
  assert.match(constrainedPart, /perfUi\(\)/);
});
