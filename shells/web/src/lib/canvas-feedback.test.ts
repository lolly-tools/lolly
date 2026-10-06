// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { beginCanvasFeedback, finishCanvasFeedback } from './canvas-feedback.ts';

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
