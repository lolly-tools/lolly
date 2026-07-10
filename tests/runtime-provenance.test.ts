/**
 * Contract tests for the runtime's export-time capture/text provenance (runtime.ts
 * export(), v1.35). These prove the SIGNAL wiring end-to-end at the host seam: a
 * live camera frame (onFrame) or a recorder take (startRecording→stopRecording)
 * surfaces as opts.c2paCapture, and rendered text sitting over an OPENED asset (an
 * ingredient is present) surfaces as opts.c2paTextAdded — while from-scratch text
 * does NOT (it rides in the input digest instead, never a fabricated edit). The
 * engine embedding of these steps is covered by export-action-steps.test.ts and the
 * c2patool conformance suite; here we pin down that the runtime derives them from
 * actual sensor use + an ingredient, and never over-claims.
 *
 * Run with: node --test tests/runtime-provenance.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createRuntime } from '../engine/src/runtime.ts';
import { embedC2pa, extractC2paStore } from '../engine/src/index.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let toolSeq = 0;

// A real, parseable manifest store — what a shell persists for a credentialed
// upload (so the runtime's ingredient sweep finds a chain to preserve).
async function credentialStore(): Promise<Uint8Array> {
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8"/></svg>');
  const ex = extractC2paStore(await embedC2pa(svg, 'svg', { title: 'Source art' }));
  assert.ok(ex, 'embedded credential extracts back out');
  return ex!.store;
}

// Host double: records the opts handed to export.render; exposes a camera frame
// pump (host.media) and a recorder whose take resolves a Blob of a set MIME type
// (host.recorder). A credential store is served only when `store` is provided.
function makeHost(opts: { store?: Uint8Array | null } = {}) {
  const rendered: any[] = [];
  let frameCb: ((f: any) => void) | null = null;
  let recBlob: Blob | null = null;
  const host: any = {
    version: '1',
    profile: { get: async () => ({}) },
    log: () => {},
    export: { render: async (_n: unknown, _f: string, o: any) => { rendered.push(o); return {}; } },
    media: {
      isAvailable: () => true,
      start: async () => {},
      stop: () => {},
      subscribe: (cb: (f: any) => void) => { frameCb = cb; return () => { frameCb = null; }; },
    },
    recorder: {
      isAvailable: () => true,
      meter: { start: async () => {}, stop: () => {}, subscribe: () => () => {} },
      record: async () => ({ subscribe: () => () => {}, stop: async () => recBlob, cancel: () => {} }),
    },
  };
  if ('store' in opts) {
    host.assets = {
      get: async (id: string) => ({ id, source: 'user', type: 'raster', format: 'png', url: 'blob:x' }),
      credential: async () => (opts.store ? { store: opts.store, format: 'svg' } : null),
    };
  }
  return {
    host, rendered,
    pushFrame: (f: any) => frameCb && frameCb(f),
    setRecBlob: (b: Blob) => { recBlob = b; },
  };
}

const FRAME = { data: new Uint8Array(4), width: 1, height: 1, t: 0 };

function filterTool(): any {
  return {
    manifest: {
      id: `prov-${++toolSeq}`, name: 'Filter', version: '1.0.0', engineVersion: '^1.0.0', status: 'official',
      render: { width: 10, height: 10, formats: ['png'] },
      inputs: [{ id: 'photo', type: 'asset' }],
      hooks: { onFrame: true },
    },
    template: '<b>x</b>',
    // A truthy patch is all it takes for the runtime to mark the render as a live
    // frame (the exact keys don't matter here).
    hooksSource: 'function onFrame(){ return { live: true }; }',
  };
}

function recorderTool(capabilities: string[]): any {
  return {
    manifest: {
      id: `prov-${++toolSeq}`, name: 'Recorder', version: '1.0.0', engineVersion: '^1.0.0', status: 'official',
      render: { width: 10, height: 10, formats: ['png'] },
      inputs: [{ id: 'clip', type: 'asset' }],
      capabilities,
    },
    template: '<b>x</b>',
  };
}

test('a live camera frame marks the export as a camera capture', async () => {
  const { host, rendered, pushFrame } = makeHost();
  const rt = await createRuntime(filterTool(), host, {});
  await rt.startLive();
  pushFrame(FRAME);
  await sleep(10); // let onFrame's async patch/merge settle
  await rt.export({} as any, 'png', { c2pa: true });
  assert.equal(rendered.length, 1);
  assert.deepEqual(rendered[0].c2paCapture, { camera: true });
});

test('swapping the image source retires the live-camera flag (no over-claim)', async () => {
  const { host, rendered, pushFrame } = makeHost();
  const rt = await createRuntime(filterTool(), host, {});
  await rt.startLive();
  pushFrame(FRAME);
  await sleep(10);
  await rt.setInput('photo', { id: 'stock', source: 'library' }); // user picks a stock image
  await rt.export({} as any, 'png', { c2pa: true });
  assert.equal(rendered[0].c2paCapture, undefined, 'a source swap clears the camera capture');
});

test('a video recording marks camera + microphone', async () => {
  const { host, rendered, setRecBlob } = makeHost();
  setRecBlob(new Blob([new Uint8Array(4)], { type: 'video/webm' }));
  const rt = await createRuntime(recorderTool(['camera', 'microphone']), host, {});
  await rt.startRecording();
  await rt.stopRecording();
  await rt.export({} as any, 'png', { c2pa: true });
  assert.deepEqual(rendered[0].c2paCapture, { camera: true, microphone: true });
});

test('an audio recording marks the microphone only', async () => {
  const { host, rendered, setRecBlob } = makeHost();
  setRecBlob(new Blob([new Uint8Array(4)], { type: 'audio/webm' }));
  const rt = await createRuntime(recorderTool(['microphone']), host, {});
  await rt.startRecording();
  await rt.stopRecording();
  await rt.export({} as any, 'png', { c2pa: true });
  assert.deepEqual(rendered[0].c2paCapture, { microphone: true });
});

test('a video take on a camera-only tool marks camera, not the mic', async () => {
  const { host, rendered, setRecBlob } = makeHost();
  setRecBlob(new Blob([new Uint8Array(4)], { type: 'video/webm' }));
  const rt = await createRuntime(recorderTool(['camera']), host, {});
  await rt.startRecording();
  await rt.stopRecording();
  await rt.export({} as any, 'png', { c2pa: true });
  assert.deepEqual(rendered[0].c2paCapture, { camera: true });
});

test('text over an OPENED (credentialed) asset → c2paTextAdded with a sample', async () => {
  const store = await credentialStore();
  const { host, rendered } = makeHost({ store });
  const tool: any = {
    manifest: {
      id: `prov-${++toolSeq}`, name: 'Caption', version: '1.0.0', engineVersion: '^1.0.0', status: 'official',
      render: { width: 10, height: 10, formats: ['png'] },
      inputs: [{ id: 'photo', type: 'asset' }, { id: 'headline', type: 'text' }],
    },
    template: '<b>{{headline}}</b>',
  };
  const rt = await createRuntime(tool, host, { photo: { id: 'user/up/1' }, headline: 'BREAKING NEWS' });
  await rt.export({} as any, 'png', { c2pa: true });
  assert.equal(rendered[0].ingredients?.length, 1, 'the opened asset is preserved as an ingredient');
  assert.deepEqual(rendered[0].c2paTextAdded, { sample: 'BREAKING NEWS' });
});

test('text WITHOUT an opened asset is not a fabricated edit (digest only)', async () => {
  const { host, rendered } = makeHost(); // no assets → no ingredients
  const tool: any = {
    manifest: {
      id: `prov-${++toolSeq}`, name: 'Poster', version: '1.0.0', engineVersion: '^1.0.0', status: 'official',
      render: { width: 10, height: 10, formats: ['png'] },
      inputs: [{ id: 'headline', type: 'text' }],
    },
    template: '<b>{{headline}}</b>',
  };
  const rt = await createRuntime(tool, host, { headline: 'Summer Sale' });
  await rt.export({} as any, 'png', { c2pa: true });
  assert.equal(rendered[0].c2paTextAdded, undefined, 'no ingredient → no "Added text" step');
  assert.equal(rendered[0].c2paInputs?.headline, 'Summer Sale', 'the copy still rides in the input digest');
});

test('no capture and no c2pa → no provenance keys at all', async () => {
  const { host, rendered, pushFrame } = makeHost();
  const rt = await createRuntime(filterTool(), host, {});
  await rt.startLive();
  pushFrame(FRAME);
  await sleep(10);
  await rt.export({} as any, 'png', {}); // c2pa off
  assert.equal(rendered[0].c2paCapture, undefined, 'capture is only derived when stamping credentials');
  assert.equal(rendered[0].c2paTextAdded, undefined);
});
