// SPDX-License-Identifier: MPL-2.0
/**
 * bridge/models.ts: host.models.files, the singing models handed to a tool.
 *
 * Run:  node --import ./tests/css-stub.mjs --test shells/web/src/bridge/models.test.ts
 *
 * The decline path runs the real in-place offer (lib/model-offer.ts) with its part
 * facts stubbed through __setModelOfferDepsForTest, in jsdom with showModal/close
 * stubbed as in model-offer.test.ts. The store and the fetcher are stubbed through
 * this module's own hook, so no IndexedDB is needed.
 */
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/#/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.history = dom.window.history as unknown as typeof globalThis.history;
globalThis.location = dom.window.location as unknown as typeof globalThis.location;
globalThis.Element = dom.window.Element;
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => setTimeout(() => cb(0), 0)) as unknown as typeof requestAnimationFrame;
const dialogProto = dom.window.HTMLDialogElement.prototype as unknown as Record<string, unknown>;
dialogProto.showModal = function showModal(this: { open: boolean }): void { this.open = true; };
dialogProto.close = function close(this: { open: boolean }): void { this.open = false; };

const { modelFiles, createModelsAPI, __setModelsDepsForTest, TOOL_READABLE_FAMILIES } = await import('./models.ts');
const { __setModelOfferDepsForTest } = await import('../lib/model-offer.ts');
const { __resetOfflineRunForTest } = await import('../lib/offline-run.ts');
const { __resetJobsForTest } = await import('../lib/jobs.ts');
const { SING_FALLBACK_FILES, SING_PART_FILES } = await import('../lib/sing-models.ts');
type Info = import('../lib/model-parts.ts').ModelPartInfo;

const info = (over: Partial<Info> = {}): Info => ({
  id: 'sing', label: 'Singing voices', available: true, allowed: true, bytes: 1_218_137_628, ready: false, source: 'models-manifest', ...over,
});
const tick = (): Promise<void> => new Promise(r => setTimeout(r, 0));
const sheet = (): HTMLDialogElement | null => document.querySelector<HTMLDialogElement>('dialog.model-offer');
async function sheetOpen(): Promise<HTMLDialogElement> {
  for (let i = 0; i < 40 && !sheet(); i++) await tick();
  const el = sheet();
  assert.ok(el, 'the offer sheet is mounted');
  return el;
}

/** A stored file's bytes: its path, so a test can tell the files apart. */
const bytesOf = (path: string): ArrayBuffer => new TextEncoder().encode(path).buffer as ArrayBuffer;

let reads: string[] = [];
beforeEach(() => {
  document.body.innerHTML = '';
  __resetOfflineRunForTest();
  __resetJobsForTest();
  reads = [];
  __setModelOfferDepsForTest({ info: async () => info(), download: async () => {}, notify: () => {}, activated: () => true });
});
afterEach(() => {
  __setModelsDepsForTest();
  __setModelOfferDepsForTest();
  delete (globalThis as { __LOLLY_AI_DISABLED__?: boolean }).__LOLLY_AI_DISABLED__;
});

test('only the sing family is readable by tools', () => {
  assert.deepEqual([...TOOL_READABLE_FAMILIES], ['sing']);
  assert.equal(typeof createModelsAPI().files, 'function');
});

test('a family tools may not read is refused by name, before anything is read', async () => {
  __setModelsDepsForTest({ present: async () => { reads.push('present'); return new Set(); } });
  for (const family of ['matte', 'speech', 'trustmark', '__proto__', '']) {
    await assert.rejects(() => modelFiles(family, ['rondocode/vec-768.onnx']), new RegExp(`cannot read the model family "${family}"`));
  }
  assert.deepEqual(reads, []);
});

test('a path outside the family is refused by name', async () => {
  __setModelsDepsForTest({ present: async () => { reads.push('present'); return new Set(); } });
  for (const path of ['../matte/u2netp.onnx', 'rondocode/../../x', '/models/sing/CREDITS.txt', 'rondocode/gen_unknown.onnx',
    'runtime/ort.min.mjs', 'runtime/../sw.js', 'constructor', '__proto__']) {
    await assert.rejects(() => modelFiles('sing', [path]), (err: Error) => err.message.includes(`"${path}" is not a file of the sing family`), path);
  }
  await assert.rejects(() => modelFiles('sing', []), /name at least one file/);
  assert.deepEqual(reads, [], 'nothing is read for a refused request');
});

test('declined in the in-place offer: resolves null and reads nothing', async () => {
  let downloads = 0;
  __setModelOfferDepsForTest({ info: async () => info(), download: async () => { downloads++; }, notify: () => {}, activated: () => true });
  __setModelsDepsForTest({
    present: async () => new Set(),
    read: async (file) => { reads.push(file); return null; },
  });
  const result = modelFiles('sing', ['rondocode/vec-768.onnx'], { reason: 'singing in this song' });
  const el = await sheetOpen();
  assert.equal(el.querySelector('.modal-title')?.textContent, 'Singing voices');
  assert.match(el.querySelector('.modal-msg')?.textContent ?? '', /download, needed for: singing in this song\./);
  assert.match(el.textContent ?? '', /OpenRAIL-M/, 'the licence facts are in the sheet');
  el.querySelector<HTMLElement>('[data-act="later"]')!.click();
  assert.equal(await result, null);
  assert.equal(downloads, 0);
  assert.deepEqual(reads, []);
});

test('a policy that forbids singing resolves null with no offer and no read', async () => {
  (globalThis as { __LOLLY_AI_DISABLED__?: boolean }).__LOLLY_AI_DISABLED__ = true;
  let offered = false;
  __setModelsDepsForTest({
    present: async () => { reads.push('present'); return new Set(); },
    ensure: async () => { offered = true; return true; },
  });
  assert.equal(await modelFiles('sing', ['rondocode/vec-768.onnx']), null);
  assert.equal(offered, false);
  assert.deepEqual(reads, []);
});

test('files already on the device come back with no offer, each its own whole buffer', async () => {
  let offered = false;
  const asked = ['rondocode/vec-768.onnx', 'supertonic/onnx/tts.json', 'rondocode/vec-768.onnx'];
  __setModelsDepsForTest({
    present: async () => new Set(SING_PART_FILES),
    read: async (file, cacheOnly) => { reads.push(`${file}:${cacheOnly}`); return bytesOf(file); },
    ensure: async () => { offered = true; return true; },
  });
  const progress: number[] = [];
  const out = await modelFiles('sing', asked, { onProgress: (p) => progress.push(p.loaded) });
  assert.ok(out);
  assert.equal(offered, false);
  assert.deepEqual(Object.keys(out).sort(), ['rondocode/vec-768.onnx', 'supertonic/onnx/tts.json']);
  for (const [path, bytes] of Object.entries(out)) {
    assert.ok(bytes instanceof Uint8Array);
    assert.equal(bytes.byteOffset, 0);
    assert.equal(bytes.byteLength, bytes.buffer.byteLength, 'transferable without a copy');
    assert.equal(new TextDecoder().decode(bytes), path);
  }
  assert.deepEqual(reads, ['rondocode/vec-768.onnx:true', 'supertonic/onnx/tts.json:true'], 'read from the store, once each');
  assert.ok(progress.length >= 2);
});

test('a missing part file opens the offer once; a yes then reads the files', async () => {
  let offers = 0;
  const stored = new Set<string>();
  __setModelsDepsForTest({
    present: async () => new Set(stored),
    ensure: async (reason) => { offers++; assert.equal(reason, 'Songs that sing in Rondocode'); for (const f of SING_PART_FILES) stored.add(f); return true; },
    read: async (file, cacheOnly) => (cacheOnly && !stored.has(file) ? null : bytesOf(file)),
  });
  const out = await modelFiles('sing', ['rondocode/gen_kizuna.onnx', 'rondocode/phoneme-int8.onnx']);
  assert.equal(offers, 1);
  assert.deepEqual(Object.keys(out ?? {}).sort(), ['rondocode/gen_kizuna.onnx', 'rondocode/phoneme-int8.onnx']);
});

test('an fp32 fallback asks its own consent; declining resolves null and downloads nothing', async () => {
  assert.ok(SING_FALLBACK_FILES.includes('rondocode/phoneme.onnx'));
  let askedBytes = 0;
  __setModelsDepsForTest({
    present: async () => new Set(SING_PART_FILES),
    confirmExtra: async (bytes) => { askedBytes = bytes; return false; },
    read: async (file, cacheOnly) => { reads.push(`${file}:${cacheOnly}`); return null; },
  });
  assert.equal(await modelFiles('sing', ['rondocode/phoneme.onnx']), null);
  assert.equal(askedBytes, 1_264_009_987, 'the consent line states the file’s size');
  assert.deepEqual(reads, []);
});

test('runtime/<file> is the shell’s own /ort/ binary, read without an offer', async () => {
  const urls: string[] = [];
  let offered = false;
  __setModelsDepsForTest({
    present: async () => new Set(),
    ensure: async () => { offered = true; return true; },
    runtime: async (url) => { urls.push(url); return new Uint8Array([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]).buffer; },
  });
  const out = await modelFiles('sing', ['runtime/ort-wasm-simd-threaded.jsep.wasm']);
  assert.deepEqual(urls, ['/ort/ort-wasm-simd-threaded.jsep.wasm']);
  assert.equal(offered, false, 'the runtime is not a model download');
  assert.equal(out?.['runtime/ort-wasm-simd-threaded.jsep.wasm']?.byteLength, 8);
});

test('an aborted call rejects before anything moves', async () => {
  const ctrl = new AbortController();
  ctrl.abort();
  __setModelsDepsForTest({ present: async () => { reads.push('present'); return new Set(); } });
  await assert.rejects(() => modelFiles('sing', ['wav2vec2/vocab.json'], { signal: ctrl.signal }), { name: 'AbortError' });
  assert.deepEqual(reads, []);
});

test('the reason reaches the offer as one plain, bounded line', async () => {
  const seen: string[] = [];
  __setModelsDepsForTest({
    present: async () => new Set(),
    ensure: async (reason) => { seen.push(reason); return false; },
  });
  assert.equal(await modelFiles('sing', ['wav2vec2/vocab.json'], { reason: 'sing\u0000ing\n in  this song' }), null);
  assert.equal(await modelFiles('sing', ['wav2vec2/vocab.json'], { reason: 'x'.repeat(500) }), null);
  assert.equal(seen[0], 'sing ing in this song');
  assert.equal(seen[1]!.length, 120);
});

test('an fp32 fallback, once agreed, downloads in the job toast and comes back without a second read', async () => {
  const runs: string[] = [];
  __setModelsDepsForTest({
    present: async () => new Set(SING_PART_FILES),
    confirmExtra: async () => true,
    beginRun: async (title) => { runs.push(title); return { signal: new AbortController().signal, cancelled: false, report: () => {}, end: (e) => { runs.push(`end:${e ?? ''}`); } }; },
    read: async (file, cacheOnly) => { reads.push(`${file}:${cacheOnly}`); return cacheOnly ? null : bytesOf(file); },
  });
  const out = await modelFiles('sing', ['rondocode/phoneme.onnx']);
  assert.equal(new TextDecoder().decode(out?.['rondocode/phoneme.onnx']), 'rondocode/phoneme.onnx');
  assert.deepEqual(runs, ['Downloading: Singing voices', 'end:']);
  assert.deepEqual(reads, ['rondocode/phoneme.onnx:false'], 'fetched once, and not read back again');
});
