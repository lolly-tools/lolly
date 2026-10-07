// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
import type { FcCtx } from './context.ts';

registerHooks({ load(url, context, next) {
  return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: '' } : next(url, context);
} });
const { cameraCaptureOps } = await import('./camera-capture.ts');
const dom = new JSDOM('<!DOCTYPE html><body></body>', { url: 'https://lolly.test/' });
Object.assign(globalThis, { document: dom.window.document, window: dom.window,
  MutationObserver: dom.window.MutationObserver, requestAnimationFrame: () => 1, cancelAnimationFrame: () => {} });
dom.window.HTMLMediaElement.prototype.play = async () => {};
const flush = () => new Promise<void>(resolve => setImmediate(resolve));

function fixture(deferred = false) {
  const stageEl = document.createElement('div'), canvasEl = document.createElement('div');
  stageEl.append(canvasEl); document.body.append(stageEl);
  let boxes = [{ id: 'cam', kind: 'webcam' }], calls = 0, stops = 0;
  let constraints: MediaStreamConstraints | undefined;
  let resolve!: (stream: MediaStream) => void;
  const track = { stop: () => { stops++; }, addEventListener() {} };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: {
    getUserMedia: (value: MediaStreamConstraints) => {
      calls++; constraints = value;
      return deferred ? new Promise<MediaStream>(done => { resolve = done; }) : Promise.resolve(stream);
    },
  } } });
  const fc = { stageEl, canvasEl, disposed: false, designChrome: true,
    addKinds: [{ id: 'webcam' }], selection: new Set(['cam']), opts: { canEdit: () => true },
    cfg: { kindField: 'kind' }, select: { getBoxes: () => boxes, idOf: (box: { id: string }) => box.id },
  } as unknown as FcCtx;
  const repaint = () => { canvasEl.innerHTML = '<div data-live-camera="cam"><span>Camera</span></div>'; };
  repaint();
  const ops = cameraCaptureOps(fc); ops.wire();
  const click = (label: string) => {
    const button = stageEl.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
    assert.ok(button, label); button.click();
  };
  return { canvasEl, stageEl, ops, repaint, click, calls: () => calls, stops: () => stops,
    constraints: () => constraints, grant: () => resolve(stream),
    remove: () => { boxes = []; canvasEl.replaceChildren(); },
    cleanup: () => { ops.destroy(); stageEl.remove(); },
  };
}

test('saved webcam stays inert; explicit start survives repaint and releases on removal', async () => {
  const f = fixture();
  try {
    await flush(); assert.equal(f.calls(), 0);
    f.click('Start camera'); await flush();
    assert.equal(f.calls(), 1); assert.equal(f.constraints()?.audio, false);
    const video = f.canvasEl.querySelector('video'); assert.ok(video);
    f.repaint();
    f.canvasEl.querySelector<HTMLElement>('[data-live-camera]')!.dataset.cameraStyle = 'object-fit:contain';
    await flush();
    assert.equal(f.canvasEl.querySelector('video'), video); assert.equal(f.calls(), 1); assert.equal(f.stops(), 0);
    assert.equal(video.style.objectFit, 'contain');
    f.remove(); await flush(); assert.equal(f.stops(), 1);
  } finally { f.cleanup(); }
});

test('camera permission arriving after deletion is released without restoring the layer', async () => {
  const f = fixture(true);
  try {
    f.click('Start camera'); f.remove(); f.grant(); await flush();
    assert.equal(f.stops(), 1); assert.equal(f.canvasEl.querySelector('video'), null);
  } finally { f.cleanup(); }
});

test('camera permission arriving after editor destruction is released', async () => {
  const f = fixture(true);
  f.click('Start camera'); f.cleanup(); f.grant(); await flush();
  assert.equal(f.stops(), 1); assert.equal(f.canvasEl.querySelector('video'), null);
});

test('closing an editor releases an active camera', async () => {
  const f = fixture();
  f.click('Start camera'); await flush(); f.cleanup();
  assert.equal(f.stops(), 1); assert.equal(f.canvasEl.querySelector('video'), null);
});
