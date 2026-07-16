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
  // Whether the recorder session reports an actually-acquired mic (v1.54). undefined =
  // the session doesn't report it (older shells) → the runtime falls back to the tool's
  // declared capability. A boolean is the honest "a mic was / wasn't captured" fact.
  let recMicActive: boolean | undefined;
  let lastRecordOpts: any = null;
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
      record: async (o: any) => {
        lastRecordOpts = o ?? null;
        return { subscribe: () => () => {}, stop: async () => recBlob, cancel: () => {}, micActive: recMicActive };
      },
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
    setMicActive: (v: boolean | undefined) => { recMicActive = v; },
    lastRecordOpts: () => lastRecordOpts,
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

// ─── screen capture (v1.54) — the runtime side of the screencap fixes ─────────
// exportActionSteps proves the SOURCE-TYPE mapping; these prove the runtime derives
// the right c2paCapture from a SCREEN take, so a still exported through the export bar
// afterwards never inherits a camera claim, and a denied mic is never stamped as
// narration. These guard the two highest-severity confirmed review findings.

// A screencap-style tool: a screen take that can also grab the mic for narration.
function screenTool(capabilities: string[] = ['screen', 'microphone']): any {
  return {
    manifest: {
      id: `prov-${++toolSeq}`, name: 'Screencap', version: '1.0.0', engineVersion: '^1.54.0', status: 'official',
      render: { width: 10, height: 10, formats: ['png'], capture: 'screen' },
      inputs: [{ id: 'shot', type: 'asset' }],
      capabilities,
    },
    template: '<b>x</b>',
  };
}

test('a screen recording marks screenCapture (screen), NOT the camera', async () => {
  const { host, rendered, setRecBlob, setMicActive, lastRecordOpts } = makeHost();
  setRecBlob(new Blob([new Uint8Array(4)], { type: 'video/mp4' }));
  setMicActive(true);   // narration granted
  const rt = await createRuntime(screenTool(), host, {});
  await rt.startRecording({ source: 'screen' });
  await rt.stopRecording();
  await rt.export({} as any, 'png', { c2pa: true });
  // The exact bug finding #4 caught: a screen take must NOT set camera. It's a screen
  // origin, with the granted mic — never "captured live from the camera".
  assert.equal(rendered[0].c2paCapture.screen, true);
  assert.equal(rendered[0].c2paCapture.camera, undefined, 'a screen take must never claim the camera');
  assert.equal(rendered[0].c2paCapture.microphone, true);
  assert.equal(lastRecordOpts()?.source, 'screen', 'the runtime forwards the screen source to the recorder');
});

test('a screen recording with the mic DENIED is not stamped as narration', async () => {
  const { host, rendered, setRecBlob, setMicActive } = makeHost();
  setRecBlob(new Blob([new Uint8Array(4)], { type: 'video/mp4' }));
  // Tool DECLARES 'microphone', user ticked Narrate — but the mic was actually blocked.
  // The credential must reflect what was captured (silent), not what was requested.
  setMicActive(false);
  const rt = await createRuntime(screenTool(['screen', 'microphone']), host, {});
  await rt.startRecording({ source: 'screen' });
  await rt.stopRecording();
  await rt.export({} as any, 'png', { c2pa: true });
  assert.equal(rendered[0].c2paCapture.screen, true);
  assert.equal(rendered[0].c2paCapture.microphone, undefined, 'a denied mic must not be claimed as narration');
});

test('startRecording resolves the actually-acquired mic state so the shell can warn', async () => {
  const { host, setRecBlob, setMicActive } = makeHost();
  setRecBlob(new Blob([new Uint8Array(4)], { type: 'video/mp4' }));
  setMicActive(false);
  const rt = await createRuntime(screenTool(), host, {});
  const res = await rt.startRecording({ source: 'screen' });
  assert.deepEqual(res, { started: true, micActive: false });
});

test('stopRecording surfaces micActive so the saved clip is stamped honestly', async () => {
  const { host, setRecBlob, setMicActive } = makeHost();
  setRecBlob(new Blob([new Uint8Array(4)], { type: 'video/mp4' }));
  setMicActive(true);
  const rt = await createRuntime(screenTool(), host, {});
  await rt.startRecording({ source: 'screen' });
  const res = await rt.stopRecording();
  assert.equal(res?.micActive, true);
});

test('regression: a plain video take (no source) still marks the camera, unchanged', async () => {
  // The screen branch keys off recordSource === "screen"; a normal camera recorder tool
  // (startRecording with no opts) must behave exactly as before 1.54.
  const { host, rendered, setRecBlob } = makeHost();
  setRecBlob(new Blob([new Uint8Array(4)], { type: 'video/webm' }));
  const rt = await createRuntime(recorderTool(['camera', 'microphone']), host, {});
  await rt.startRecording();
  await rt.stopRecording();
  await rt.export({} as any, 'png', { c2pa: true });
  assert.deepEqual(rendered[0].c2paCapture, { camera: true, microphone: true });
  assert.equal(rendered[0].c2paCapture.screen, undefined);
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
