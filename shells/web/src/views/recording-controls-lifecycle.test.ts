// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { ToolRuntime, WebToolHost } from './tool.ts';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://example.test/', pretendToBeVisual: true });
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'MutationObserver', 'CustomEvent', 'Event', 'localStorage', 'getComputedStyle']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: (dom.window as unknown as Record<string, unknown>)[key] });
}
let coarsePointer = false;
const matchMedia = () => ({ matches: coarsePointer, addEventListener() {}, removeEventListener() {} });
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
const { claimRecordPreview } = await import('../lib/record-preview.ts');
const tick = async () => { await new Promise(resolve => setTimeout(resolve, 35)); };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function setup(mode: 'audio' | 'video' | 'av' | 'screen', hasLevelHook = false) {
  const camera = deferred<void>(), coach = deferred<void>(), meter = deferred<boolean>();
  const start = deferred<{ started: boolean }>();
  const stop = deferred<{ blob: Blob; mimeType: string } | null>();
  const still = deferred<Blob>();
  const counts = { cameraRefs: 0, cameraSubs: 0, coachRefs: 0, coachStarts: 0, coachSubs: 0, meters: 0, cancels: 0, stops: 0, inputs: 0, dirty: 0, wakeRequests: 0, wakeReleases: 0 };
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { wakeLock: {
    request: async () => { counts.wakeRequests++; return { released: false, release: async () => { counts.wakeReleases++; } }; },
  } } });
  const cameraFacing: string[] = [], takeFacing: Array<string | undefined> = [];
  const runtime = {
    hasLevelHook, getModel: () => [], manifest: { name: 'Test recording' }, subscribe: () => () => {},
    startMeter: () => { counts.meters++; return meter.promise; }, stopMeter() {},
    startRecording: (opts: { facingMode?: string }) => { takeFacing.push(opts.facingMode); return start.promise; }, cancelRecording: () => { counts.cancels++; },
    stopRecording: () => { counts.stops++; return stop.promise; },
    setInput: async () => { counts.inputs++; },
  } as unknown as ToolRuntime;
  const host = {
    log() {},
    media: {
      isAvailable: () => true,
      start: (opts: { facingMode: string }) => { cameraFacing.push(opts.facingMode); return camera.promise.then(() => { counts.cameraRefs++; }); },
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
  return { stage, button, camera, coach, meter, start, stop, still, counts, cameraFacing, takeFacing,
    cleanup: () => {
      stage._recordCleanup?.(); stage.remove();
      if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
      else Reflect.deleteProperty(globalThis, 'navigator');
    } };
}

/** An audio take with no level hook of its own starts with the shell's sound check: the
 *  first press opens the level meter, the second records. */
async function soundCheck(f: ReturnType<typeof setup>, mode: string): Promise<void> {
  if (mode !== 'audio') return;
  f.button.click(); f.coach.resolve(); await tick();
  assert.equal(f.button.dataset.state, 'armed');
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
      await soundCheck(f, mode);
      f.button.click(); f.start.resolve({ started: false }); await tick();
      assert.equal(f.button.dataset.state, 'idle'); assert.equal(f.button.disabled, false);
      assert.equal(f.stage.classList.contains('is-recording'), false); assert.equal(frames.size, 0);
      assert.equal(f.counts.wakeRequests, 0);
    } finally { f.cleanup(); }
  });

  test(`${mode}: leaving during the picker cancels the pending take without restarting the timer`, async () => {
    const f = setup(mode);
    await soundCheck(f, mode);
    f.button.click(); f.cleanup(); f.start.resolve({ started: false }); await tick();
    assert.equal(f.counts.cancels, 1); assert.equal(frames.size, 0);
    // An audio control left after its sound check keeps the label it last drew.
    assert.equal(f.button.dataset.state, mode === 'audio' ? 'armed' : 'idle');
    assert.equal(f.counts.coachRefs, 0, 'no mic is left open');
    assert.equal(f.counts.wakeRequests, 0);
    f.cleanup(); assert.equal(f.counts.cancels, 1, 'cleanup is idempotent');
  });

  test(`${mode}: leaving during stop does not rearm or publish late footage`, async () => {
    const f = setup(mode);
    await soundCheck(f, mode);
    f.button.click(); f.start.resolve({ started: true }); await tick();
    assert.equal(f.button.dataset.state, 'recording');
    f.button.click(); f.button.dispatchEvent(new Event('click'));
    assert.equal(f.counts.stops, 1, 'stop is serialised');
    f.cleanup(); f.stop.resolve({ blob: new Blob(['late'], { type: 'audio/webm' }), mimeType: 'audio/webm' }); await tick();
    assert.equal(f.counts.meters, 0); assert.equal(f.counts.inputs, 0); assert.equal(f.counts.dirty, 0);
    assert.equal(f.stage.querySelector('.canvas-audio-dl'), null); assert.equal(frames.size, 0);
  });
}

for (const mode of ['audio', 'video', 'screen'] as const) {
  for (const finish of ['stop', 'dispose'] as const) {
    test(`${mode}: the wake lock lasts until ${finish}`, async () => {
      const f = setup(mode);
      try {
        if (mode === 'video') { f.button.click(); f.camera.resolve(); await tick(); }
        await soundCheck(f, mode);
        assert.equal(f.counts.wakeRequests, 0);
        f.button.click(); f.start.resolve({ started: true }); await tick();
        assert.equal(f.counts.wakeRequests, 1);
        assert.equal(f.counts.wakeReleases, 0);
        if (finish === 'stop') { f.button.click(); f.stop.resolve(null); await tick(); }
        else f.cleanup();
        assert.equal(f.counts.wakeReleases, 1);
        f.cleanup();
        assert.equal(f.counts.wakeReleases, 1);
      } finally { f.cleanup(); }
    });
  }
}

test('flipping the camera updates framing and take previews', async () => {
  coarsePointer = true;
  const f = setup('video');
  const publish = claimRecordPreview();
  const play = dom.window.HTMLVideoElement.prototype.play;
  dom.window.HTMLVideoElement.prototype.play = async () => {};
  try {
    f.button.click(); f.camera.resolve(); await tick();
    const facing = () => f.stage.querySelector<HTMLElement>('.canvas-record-viewfinder')?.dataset.facing;
    assert.equal(facing(), 'user');
    f.stage.querySelector<HTMLButtonElement>('.canvas-record-flip')!.click(); await tick();
    assert.equal(facing(), 'environment');
    assert.deepEqual(f.cameraFacing, ['user', 'environment']);
    f.button.click();
    publish({} as MediaStream);
    f.start.resolve({ started: true }); await tick();
    assert.equal(facing(), 'environment');
    assert.deepEqual(f.takeFacing, ['environment']);
  } finally {
    publish(null); f.cleanup(); coarsePointer = false;
    dom.window.HTMLVideoElement.prototype.play = play;
  }
});

test('leaving during the screenshot picker ignores its late image', async () => {
  const f = setup('screen');
  f.stage.querySelector<HTMLButtonElement>('.canvas-screen-btn')!.click();
  f.cleanup(); f.still.resolve(new Blob(['late'], { type: 'image/png' })); await tick();
  assert.equal(f.counts.inputs, 0); assert.equal(f.counts.dirty, 0);
});

test('audio with no level hook: the shell draws the levels for the sound check and the take', async () => {
  const f = setup('audio');
  try {
    assert.match(f.button.textContent ?? '', /Warm the mic/);
    f.button.click(); f.coach.resolve(); await tick();
    assert.equal(f.button.dataset.state, 'armed');
    assert.equal(f.counts.meters, 0, 'the tool has no level hook for the runtime to drive');
    assert.equal(f.counts.coachRefs, 1); assert.equal(f.counts.coachSubs, 2, 'the level bar and the tip flasher');
    assert.ok(f.stage.querySelector('.canvas-record-coach .crc-audio'), 'the level bar is on the stage');
    f.button.click(); f.start.resolve({ started: true }); await tick();
    assert.equal(f.button.dataset.state, 'recording');
    assert.ok(f.stage.querySelector('.canvas-record-coach'), 'the levels stay through the take');
    f.button.click(); f.stop.resolve(null); await tick();
    assert.equal(f.button.dataset.state, 'idle');
    assert.equal(f.counts.coachRefs, 0, 'the sound-check mic is released');
    assert.equal(f.stage.querySelector('.canvas-record-coach'), null);
  } finally { f.cleanup(); }
});

test('audio with a level hook keeps its own meter: no shell level bar', async () => {
  const f = setup('audio', true);
  try {
    f.button.click(); f.meter.resolve(true); await tick();
    assert.equal(f.button.dataset.state, 'armed');
    assert.equal(f.counts.meters, 1); assert.equal(f.counts.coachStarts, 0);
    assert.equal(f.stage.querySelector('.canvas-record-coach'), null);
  } finally { f.cleanup(); }
});

test('audio with no level hook: a refused sound check goes on to the take, which reports the fault', async () => {
  const f = setup('audio');
  try {
    f.button.click(); f.coach.reject(new Error('denied')); await tick();
    f.start.resolve({ started: false }); await tick();
    assert.equal(f.takeFacing.length, 1, 'the take was attempted');
    assert.equal(f.button.dataset.state, 'idle'); assert.equal(f.button.disabled, false);
  } finally { f.cleanup(); }
});
