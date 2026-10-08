// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { thumbnailWork } from './design-thumbnail-work.ts';

test('navigator builds only visible slots and uses the latest offscreen revision on entry', () => {
  const dom = new JSDOM('<div id="root"><span id="a"></span><span id="b"></span></div>');
  const doc = dom.window.document, root = doc.getElementById('root')!, a = doc.getElementById('a')!, b = doc.getElementById('b')!;
  const frames = new Map<number, FrameRequestCallback>(); let id = 0;
  const originalRequest = globalThis.requestAnimationFrame, originalCancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = fn => { frames.set(++id, fn); return id; };
  globalThis.cancelAnimationFrame = key => { frames.delete(key); };
  let deliver: IntersectionObserverCallback = () => {}, disconnected = false;
  Object.defineProperty(dom.window, 'IntersectionObserver', { value: class {
    constructor(callback: IntersectionObserverCallback) { deliver = callback; }
    observe() {} unobserve() {} disconnect() { disconnected = true; }
  } });
  const painted: number[] = [];
  const queue = thumbnailWork(root, (revision: number) => { painted.push(revision); return doc.createElement('div'); }, () => {});
  const flush = () => { const batch = [...frames.values()]; frames.clear(); for (const fn of batch) fn(0); };
  const visible = (target: Element) => deliver([{ target, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
  try {
    queue.set('a', 1, a); queue.set('b', 2, b); flush(); assert.deepEqual(painted, []);
    visible(a); flush(); assert.deepEqual(painted, [1]);
    queue.set('b', 3, b); flush(); assert.deepEqual(painted, [1]);
    visible(b); flush(); assert.deepEqual(painted, [1, 3]);
    queue.set('a', 4, a); visible(a); queue.dispose(); flush(); assert.deepEqual(painted, [1, 3]); assert.equal(disconnected, true);
  } finally { queue.dispose(); globalThis.requestAnimationFrame = originalRequest; globalThis.cancelAnimationFrame = originalCancel; dom.window.close(); }
});
