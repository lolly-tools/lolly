// SPDX-License-Identifier: MPL-2.0
/**
 * The singleInstance still-preview scheduler: debounce, global serialization (shared
 * window globals mean two renders must never overlap), the object-URL swap+revoke, and
 * the drop of a stale render into a disconnected/disposed cell.
 *
 * Run directly:  node --test shells/web/src/lib/multi-edit-single.test.ts
 *
 * jsdom for the <img> plumbing; URL.createObjectURL/revokeObjectURL are stubbed and
 * counted (jsdom does not implement them). The renderer is injected, so nothing here
 * touches the engine or a real canvas.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { createSinglePreviewer } from './multi-edit-single.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;

let urlSeq = 0;
const created: string[] = [];
const revoked: string[] = [];
(globalThis as unknown as { URL: typeof URL }).URL = Object.assign(dom.window.URL, {
  createObjectURL: () => { const u = `blob:mock/${urlSeq++}`; created.push(u); return u; },
  revokeObjectURL: (u: string) => { revoked.push(u); },
}) as unknown as typeof URL;

const tick = (ms: number) => new Promise(r => setTimeout(r, ms));
const cell = (): HTMLElement => { const el = document.createElement('div'); document.body.appendChild(el); return el; };
const fakeHost = {} as unknown as Parameters<typeof createSinglePreviewer>[0];

test('debounce coalesces a burst into ONE render', async () => {
  let renders = 0;
  const p = createSinglePreviewer(fakeHost, { debounceMs: 10, render: async () => { renders++; return new dom.window.Blob(); } });
  const el = cell();
  p.schedule('a', 'spatial-photo', { move: 1 }, el);
  p.schedule('a', 'spatial-photo', { move: 2 }, el);
  p.schedule('a', 'spatial-photo', { move: 3 }, el);
  await tick(40);
  assert.equal(renders, 1, 'three rapid schedules collapse to one render');
  assert.equal(el.querySelector('img.me-preview')?.getAttribute('src'), 'blob:mock/0');
  p.dispose();
});

test('renders never overlap - the chain serializes them', async () => {
  let active = 0, maxActive = 0;
  const p = createSinglePreviewer(fakeHost, {
    debounceMs: 0,
    render: async () => { active++; maxActive = Math.max(maxActive, active); await tick(15); active--; return new dom.window.Blob(); },
  });
  p.schedule('a', 'synth', {}, cell());
  p.schedule('b', '3d', {}, cell());
  p.schedule('c', 'flythrough', {}, cell());
  await tick(80);
  assert.equal(maxActive, 1, 'at most one singleInstance render runs at a time');
  p.dispose();
});

test('a fresh render swaps the <img> src and revokes the previous URL', async () => {
  const p = createSinglePreviewer(fakeHost, { debounceMs: 0, render: async () => new dom.window.Blob() });
  const el = cell();
  p.schedule('a', 'spatial-photo', { move: 1 }, el);
  await tick(20);
  const first = el.querySelector('img.me-preview')!.getAttribute('src');
  p.schedule('a', 'spatial-photo', { move: 2 }, el);
  await tick(20);
  const second = el.querySelector('img.me-preview')!.getAttribute('src');
  assert.notEqual(first, second, 'the src is replaced, not appended');
  assert.equal(el.querySelectorAll('img.me-preview').length, 1, 'still exactly one preview img');
  assert.ok(revoked.includes(first!), 'the superseded object URL is revoked');
  p.dispose();
});

test('a render failure leaves the cell untouched (prior preview / thumbnail stands)', async () => {
  const p = createSinglePreviewer(fakeHost, { debounceMs: 0, render: async () => { throw new Error('render-only tool'); } });
  const el = cell();
  el.innerHTML = '<span class="thumb">placeholder</span>';
  p.schedule('a', 'render-only', {}, el);
  await tick(20);
  assert.ok(el.querySelector('.thumb'), 'the failed render did not wipe the cell');
  assert.equal(el.querySelector('img.me-preview'), null, 'no broken preview img was inserted');
  p.dispose();
});

test('onReady fires once the still has loaded (retires the stored thumbnail)', async () => {
  const p = createSinglePreviewer(fakeHost, { debounceMs: 0, render: async () => new dom.window.Blob() });
  const el = cell();
  let ready = 0;
  p.schedule('a', 'spatial-photo', {}, el, () => { ready++; });
  await tick(20);
  // jsdom doesn't fire <img> load for a blob: URL, so dispatch it to exercise the wiring.
  el.querySelector('img.me-preview')!.dispatchEvent(new dom.window.Event('load'));
  assert.equal(ready, 1, 'onReady fired on the still load, not before');
  p.dispose();
});

test('lastUrl returns the current still URL (a live-cell freeze can fall back to it)', async () => {
  const p = createSinglePreviewer(fakeHost, { debounceMs: 0, render: async () => new dom.window.Blob() });
  const el = cell();
  assert.equal(p.lastUrl('a'), null, 'no URL before the first render');
  p.schedule('a', 'spatial-photo', {}, el);
  await tick(20);
  assert.equal(p.lastUrl('a'), el.querySelector('img.me-preview')!.getAttribute('src'), 'lastUrl matches the on-screen still');
  p.dispose();
});

test('dispose cancels pending timers and revokes every outstanding URL', async () => {
  const revokedBefore = revoked.length;
  let renders = 0;
  const p = createSinglePreviewer(fakeHost, { debounceMs: 5, render: async () => { renders++; return new dom.window.Blob(); } });
  const el = cell();
  p.schedule('a', 'spatial-photo', {}, el);   // will render
  await tick(15);
  p.schedule('a', 'spatial-photo', {}, el);   // queued, then cancelled by dispose
  p.dispose();
  await tick(15);
  assert.equal(renders, 1, 'the debounced-but-undisposed render fired once; the post-dispose one did not');
  assert.ok(revoked.length > revokedBefore, 'the outstanding preview URL was revoked on dispose');
});
