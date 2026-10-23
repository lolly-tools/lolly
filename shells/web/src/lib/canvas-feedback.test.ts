// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { beginCanvasFeedback, canvasCostsEnabled, endCanvasCost, finishCanvasFeedback, startCanvasCost, timeHookCalls } from './canvas-feedback.ts';

test('opt-in feedback samples include a later presentation opportunity and retain bounded history', () => {
  const dom = new JSDOM(), previousWindow = globalThis.window, previousFrame = globalThis.requestAnimationFrame;
  globalThis.window = dom.window as unknown as Window & typeof globalThis;
  const frames: FrameRequestCallback[] = [];
  globalThis.requestAnimationFrame = fn => { frames.push(fn); return frames.length; };
  const runtime = {};
  const flush = () => { for (const fn of frames.splice(0)) fn(0); };
  try {
    beginCanvasFeedback(runtime, 'pointer-preview'); finishCanvasFeedback(runtime, 'pointer-preview'); assert.equal(frames.length, 0);
    const metrics: NonNullable<Window['__lollyCanvasFeedback']> = { enabled: true, samples: [] };
    window.__lollyCanvasFeedback = metrics;
    beginCanvasFeedback(runtime, 'pointer-commit', performance.now() - 10);
    finishCanvasFeedback(runtime, 'pointer-commit'); assert.equal(metrics.samples.length, 0);
    flush(); assert.equal(metrics.samples.length, 0); flush();
    const sample = metrics.samples[0]!;
    assert.equal(sample.lane, 'pointer-commit'); assert.ok(sample.appliedMs >= 10); assert.ok(sample.opportunityMs >= sample.appliedMs);
    for (let i = 0; i < 150; i++) { beginCanvasFeedback(runtime, 'remote-outline'); finishCanvasFeedback(runtime, 'remote-outline'); }
    flush(); flush(); assert.equal(metrics.samples.length, 128);
    beginCanvasFeedback(runtime, 'pointer-preview'); finishCanvasFeedback(runtime, 'pointer-preview'); metrics.enabled = false;
    flush(); flush(); assert.equal(metrics.samples.length, 128);
  } finally { globalThis.window = previousWindow; globalThis.requestAnimationFrame = previousFrame; dom.window.close(); }
});

test('cost lanes stay inert until a lab run asks for them, then record each span', () => {
  const dom = new JSDOM(), previousWindow = globalThis.window;
  globalThis.window = dom.window as unknown as Window & typeof globalThis;
  try {
    assert.equal(canvasCostsEnabled(), false);
    endCanvasCost('chrome-sync', startCanvasCost());
    const plain: NonNullable<Window['__lollyCanvasFeedback']> = { enabled: true, samples: [] };
    window.__lollyCanvasFeedback = plain;
    assert.equal(startCanvasCost(), -1, 'pointer lanes alone do not switch the cost lanes on');
    assert.equal(plain.costs, undefined);
    const metrics: NonNullable<Window['__lollyCanvasFeedback']> = { enabled: true, samples: [], costs: [] };
    window.__lollyCanvasFeedback = metrics;
    const started = startCanvasCost();
    assert.ok(started >= 0);
    endCanvasCost('url-sync', started); endCanvasCost('stage-view', -1);
    assert.equal(metrics.costs!.length, 1);
    assert.equal(metrics.costs![0]!.lane, 'url-sync'); assert.ok(metrics.costs![0]!.durationMs >= 0);
    assert.equal('detail' in metrics.costs![0]!, false);
    endCanvasCost('chrome-sync', startCanvasCost(), 'view');
    assert.equal(metrics.costs![1]!.detail, 'view');
    metrics.costs!.length = 1;
    for (let i = 0; i < 20_010; i++) endCanvasCost('history', startCanvasCost());
    assert.equal(metrics.costs!.length, 20_000, 'a run that never drains stays bounded');
    metrics.enabled = false; metrics.costs!.length = 0;
    endCanvasCost('hook', performance.now());
    assert.equal(metrics.costs!.length, 0);
  } finally { globalThis.window = previousWindow; dom.window.close(); }
});

test('timed hooks pass arguments, this and results through unchanged', async () => {
  const dom = new JSDOM(), previousWindow = globalThis.window;
  globalThis.window = dom.window as unknown as Window & typeof globalThis;
  try {
    const metrics: NonNullable<Window['__lollyCanvasFeedback']> = { enabled: true, samples: [], costs: [] };
    window.__lollyCanvasFeedback = metrics;
    const failure = new Error('hook failed');
    const hooks = {
      onInit: null,
      onInput(this: unknown, ctx: { id: string }) { return { id: ctx.id, self: this }; },
      beforeExport: () => 'untouched',
      onFrame: async () => { throw failure; },
    };
    const timed = timeHookCalls(hooks);
    assert.equal(timed.onInit, null);
    assert.equal(timed.beforeExport, hooks.beforeExport);
    assert.equal(timed.onFrame, hooks.onFrame);
    const result = timed.onInput.call(timed, { id: 'boxes' });
    assert.deepEqual(result, { id: 'boxes', self: timed });
    assert.deepEqual(metrics.costs!.map(sample => sample.lane), ['hook']);
    const throwing = timeHookCalls({ onInput: () => { throw failure; } });
    assert.throws(() => throwing.onInput(), failure);
    assert.equal(metrics.costs!.length, 2, 'a throwing hook still closes its span');
    const later = timeHookCalls({ onInput: async () => 'late' });
    assert.equal(await later.onInput(), 'late');
  } finally { globalThis.window = previousWindow; dom.window.close(); }
});
