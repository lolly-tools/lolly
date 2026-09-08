// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { ToolRuntime, WebToolHost } from './tool.ts';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://example.test/', pretendToBeVisual: true });
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'MutationObserver', 'CustomEvent', 'Event', 'localStorage', 'getComputedStyle']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: (dom.window as unknown as Record<string, unknown>)[key] });
}
const matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
Object.assign(globalThis, { matchMedia });
Object.assign(dom.window, { matchMedia });
Object.defineProperty(dom.window.HTMLCanvasElement.prototype, 'getContext', { value: () => null });
const frames = new Set<number>();
Object.assign(globalThis, {
  requestAnimationFrame: (cb: FrameRequestCallback) => {
    const id = dom.window.requestAnimationFrame(time => { frames.delete(id); cb(time); });
    frames.add(id); return id;
  },
  cancelAnimationFrame: (id: number) => { frames.delete(id); dom.window.cancelAnimationFrame(id); },
});
const { setupRecordControl } = await import('./record-control.ts');
const { setupScreenCaptureControl } = await import('./screen-capture-control.ts');
const tick = async () => { await new Promise(resolve => setTimeout(resolve, 35)); };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}

function setup(mode: 'audio' | 'video' | 'av' | 'screen', hasLevelHook = false) {
  const camera = deferred<void>(), coach = deferred<void>(), meter = deferred<boolean>();
  const start = deferred<{ started: boolean }>();
  const stop = deferred<{ blob: Blob; mimeType: string } | null>();
  const still = deferred<Blob>();
  const counts = { cameraRefs: 0, cameraSubs: 0, coachRefs: 0, coachStarts: 0, coachSubs: 0, meters: 0, cancels: 0, stops: 0, inputs: 0, dirty: 0 };
  const runtime = {
    hasLevelHook, getModel: () => [], manifest: { name: 'Test recording' }, subscribe: () => () => {},
    startMeter: () => { counts.meters++; return meter.promise; }, stopMeter() {},
    startRecording: () => start.promise, cancelRecording: () => { counts.cancels++; },
    stopRecording: () => { counts.stops++; return stop.promise; },
    setInput: async () => { counts.inputs++; },
  } as unknown as ToolRuntime;
  const host = {
    log() {},
    media: {
      isAvailable: () => true,
      start: () => camera.promise.then(() => { counts.cameraRefs++; }),
      stop: () => { counts.cameraRefs--; },
      subscribe: () => { counts.cameraSubs++; return () => { counts.cameraSubs--; }; },
    },
    recorder: {
      still: () => still.promise,
      meter: {
        start: () => { counts.coachStarts++; return coach.promise.then(() => { counts.coachRefs++; }); },
        stop: () => { counts.coachRefs--; },
        subscribe: () => { counts.coachSubs++; return () => { counts.coachSubs--; }; },
      },
    },
  } as unknown as WebToolHost;
  const stage = document.createElement('div') as HTMLElement & { _recordCleanup?: () => void };
  document.body.append(stage);
  const args = { stageEl: stage, runtime, host, markSessionDirty: () => { counts.dirty++; } };
  if (mode === 'screen') setupScreenCaptureControl(args);
  else setupRecordControl({ ...args, mode });
  const button = stage.querySelector<HTMLButtonElement>('.canvas-record-btn')!;
  return { stage, button, camera, coach, meter, start, stop, still, counts,
    cleanup: () => { stage._recordCleanup?.(); stage.remove(); } };
}

test('leaving while camera framing opens releases the camera and never opens the coaching mic', async () => {
  const f = setup('av');
  f.button.click(); f.cleanup(); f.camera.resolve(); await tick();
  assert.equal(f.counts.cameraRefs, 0); assert.equal(f.counts.cameraSubs, 0);
  assert.equal(f.counts.coachStarts, 0);
  assert.equal(f.stage.querySelector('.canvas-record-viewfinder'), null);
});

test('leaving during coaching mic permission releases the late mic and its UI', async () => {
  const f = setup('av');
  f.button.click(); f.camera.resolve(); await tick();
  assert.equal(f.counts.coachStarts, 1);
  f.cleanup(); f.coach.resolve(); await tick();
  assert.equal(f.counts.cameraRefs, 0); assert.equal(f.counts.coachRefs, 0);
  assert.equal(f.counts.coachSubs, 0); assert.equal(f.button.dataset.state, 'idle');
});

test('late sound check completion cannot arm a removed audio control', async () => {
  const f = setup('audio', true);
  f.button.click(); f.cleanup(); f.meter.resolve(false); await tick();
  assert.equal(f.button.dataset.state, 'idle');
});

for (const mode of ['audio', 'screen'] as const) {
  test(`${mode}: a refused start never claims to be recording and can be retried`, async () => {
    const f = setup(mode);
    try {
      f.button.click(); f.start.resolve({ started: false }); await tick();
      assert.equal(f.button.dataset.state, 'idle'); assert.equal(f.button.disabled, false);
      assert.equal(f.stage.classList.contains('is-recording'), false); assert.equal(frames.size, 0);
    } finally { f.cleanup(); }
  });

  test(`${mode}: leaving during the picker cancels the pending take without restarting the timer`, async () => {
    const f = setup(mode);
    f.button.click(); f.cleanup(); f.start.resolve({ started: false }); await tick();
    assert.equal(f.counts.cancels, 1); assert.equal(frames.size, 0);
    assert.equal(f.button.dataset.state, 'idle');
    f.cleanup(); assert.equal(f.counts.cancels, 1, 'cleanup is idempotent');
  });

  test(`${mode}: leaving during stop does not rearm or publish late footage`, async () => {
    const f = setup(mode);
    f.button.click(); f.start.resolve({ started: true }); await tick();
    assert.equal(f.button.dataset.state, 'recording');
    f.button.click(); f.button.dispatchEvent(new Event('click'));
    assert.equal(f.counts.stops, 1, 'stop is serialised');
    f.cleanup(); f.stop.resolve({ blob: new Blob(['late'], { type: 'audio/webm' }), mimeType: 'audio/webm' }); await tick();
    assert.equal(f.counts.meters, 0); assert.equal(f.counts.inputs, 0); assert.equal(f.counts.dirty, 0);
    assert.equal(f.stage.querySelector('.canvas-audio-dl'), null); assert.equal(frames.size, 0);
  });
}

test('leaving during the screenshot picker ignores its late image', async () => {
  const f = setup('screen');
  f.stage.querySelector<HTMLButtonElement>('.canvas-screen-btn')!.click();
  f.cleanup(); f.still.resolve(new Blob(['late'], { type: 'image/png' })); await tick();
  assert.equal(f.counts.inputs, 0); assert.equal(f.counts.dirty, 0);
});
