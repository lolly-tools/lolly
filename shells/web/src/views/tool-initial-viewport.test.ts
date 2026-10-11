// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { revealInitialViewport, waitForInitialViewport } from './tool-initial-viewport.ts';

function fixture() {
  const dom = new JSDOM('<div id="canvas"></div>', { pretendToBeVisual: true });
  const canvas = dom.window.document.getElementById('canvas')!;
  const frames = new Map<number, FrameRequestCallback>();
  const timers = new Map<number, () => void>();
  let id = 0, initializes = 0, reveals = 0, pending = true;
  let geometry = { x: 10, y: 20, width: 300, height: 200 };
  canvas.getBoundingClientRect = () => ({ ...geometry, top: geometry.y, left: geometry.x, bottom: geometry.y + geometry.height, right: geometry.x + geometry.width, toJSON: () => geometry });
  dom.window.requestAnimationFrame = callback => { frames.set(++id, callback); return id; };
  dom.window.cancelAnimationFrame = key => { frames.delete(key); };
  Object.defineProperty(dom.window, 'setTimeout', { value: (callback: TimerHandler): number => {
    if (typeof callback !== 'function') throw new Error('Expected a timer callback');
    timers.set(++id, () => callback()); return id;
  } });
  Object.defineProperty(dom.window, 'clearTimeout', { value: (key: number): void => { timers.delete(key); } });
  const controller = new AbortController();
  const options = { signal: controller.signal, pending: () => pending, initialize: () => { initializes++; }, reveal: () => { reveals++; pending = false; } };
  return {
    canvas, controller, options, frames, timers,
    read: () => ({ initializes, reveals, pending }),
    move: (x: number) => { geometry = { ...geometry, x }; },
    cancel: () => { pending = false; },
    tick: () => { const batch = [...frames]; frames.clear(); for (const [, callback] of batch) callback(0); },
    close: () => dom.window.close(),
  };
}

test('initial fitting runs once and reveal waits for a stable interval', t => {
  const h = fixture(); t.after(h.close);
  revealInitialViewport(h.canvas, h.options);
  revealInitialViewport(h.canvas, h.options);
  for (let i = 0; i < 5; i++) { h.move(i * 5); h.tick(); }
  assert.deepEqual(h.read(), { initializes: 1, reveals: 0, pending: true });
  for (let i = 0; i < 4; i++) h.tick();
  assert.deepEqual(h.read(), { initializes: 1, reveals: 1, pending: false });
  assert.equal(h.frames.size + h.timers.size, 0);
});

test('slow drift cannot count as a stable viewport, and the deadline bounds the wait', t => {
  const h = fixture(); t.after(h.close);
  revealInitialViewport(h.canvas, h.options);
  for (let i = 0; i < 10; i++) { h.move(10 + i * 0.03); h.tick(); }
  assert.equal(h.read().reveals, 0);
  [...h.timers.values()][0]!();
  assert.deepEqual(h.read(), { initializes: 1, reveals: 1, pending: false });
  assert.equal(h.frames.size + h.timers.size, 0);
  h.move(200); h.tick();
  assert.equal(h.read().initializes, 1, 'a gesture after opening is never fitted again');
});

test('leaving the view cancels deferred reveal and fitting', t => {
  const h = fixture(); t.after(h.close);
  revealInitialViewport(h.canvas, h.options);
  h.controller.abort();
  h.tick();
  revealInitialViewport(h.canvas, h.options);
  assert.deepEqual(h.read(), { initializes: 1, reveals: 0, pending: true });
  assert.equal(h.frames.size + h.timers.size, 0);
});

test('font loading settles before reveal, with no second fit or linked-view reset', async t => {
  const h = fixture(); t.after(h.close);
  let finishFonts!: () => void;
  Object.defineProperty(h.canvas.ownerDocument, 'fonts', { value: { ready: new Promise<void>(resolve => { finishFonts = resolve; }) } });
  revealInitialViewport(h.canvas, h.options);
  for (let i = 0; i < 10; i++) h.tick();
  assert.equal(h.read().reveals, 0);
  h.move(40); // The user restored or moved the camera while the fonts were loading.
  finishFonts();
  await Promise.resolve();
  for (let i = 0; i < 5; i++) h.tick();
  assert.deepEqual(h.read(), { initializes: 1, reveals: 1, pending: false });
});

test('a synchronous abort during initialization leaves no deferred callbacks', t => {
  const h = fixture(); t.after(h.close);
  revealInitialViewport(h.canvas, { ...h.options, initialize: () => h.controller.abort() });
  assert.equal(h.frames.size + h.timers.size, 0);
  assert.equal(h.read().reveals, 0);
});

test('a render error or removed canvas cannot be revealed by an earlier successful paint', t => {
  for (const action of ['error', 'remove'] as const) {
    const h = fixture(); t.after(h.close);
    revealInitialViewport(h.canvas, h.options);
    if (action === 'error') h.cancel(); else h.canvas.remove();
    h.tick();
    assert.equal(h.read().reveals, 0);
    assert.equal(h.frames.size + h.timers.size, 0);
  }
});

test('export readiness waits for the bounded reveal during continuous camera motion', async t => {
  const h = fixture(); t.after(h.close);
  h.canvas.style.visibility = 'hidden';
  revealInitialViewport(h.canvas, { ...h.options, reveal: () => { h.options.reveal(); h.canvas.style.visibility = ''; } });
  let captured = false;
  const exportReady = waitForInitialViewport(h.canvas, h.controller.signal).then(() => {
    assert.equal(h.canvas.style.visibility, '');
    captured = true;
  });
  for (let i = 0; i < 30; i++) { h.move(i * 5); h.tick(); }
  await Promise.resolve();
  assert.equal(captured, false, 'quiescent artwork must not be exported while the opening fit hides it');
  [...h.timers.values()][0]!();
  await exportReady;
  assert.equal(captured, true);
  assert.equal(h.frames.size + h.timers.size, 0);
});

test('an export waiting for opening rejects when its document is disposed or removed', async t => {
  for (const action of ['abort', 'remove'] as const) {
    const h = fixture(); t.after(h.close);
    revealInitialViewport(h.canvas, h.options);
    const rejected = assert.rejects(waitForInitialViewport(h.canvas, h.controller.signal), { name: 'AbortError' });
    if (action === 'abort') h.controller.abort(); else { h.canvas.remove(); h.tick(); }
    await rejected;
    assert.equal(h.read().reveals, 0);
    assert.equal(h.frames.size + h.timers.size, 0);
  }
});

test('export readiness preserves authored hidden content after opening', async t => {
  const h = fixture(); t.after(h.close);
  h.canvas.style.visibility = 'hidden';
  await waitForInitialViewport(h.canvas, h.controller.signal);
  assert.equal(h.canvas.style.visibility, 'hidden');
  h.controller.abort();
  await assert.rejects(waitForInitialViewport(null, h.controller.signal), { name: 'AbortError' });
});
