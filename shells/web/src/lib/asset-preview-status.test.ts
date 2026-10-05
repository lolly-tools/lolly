// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { JSDOM } from 'jsdom';
import { mountAssetPreviewStatus } from './asset-preview-status.ts';

let dom: JSDOM;
const keys = ['document', 'MutationObserver', 'AbortController'] as const;
const original = new Map<string, unknown>();
beforeEach(() => {
  dom = new JSDOM('<div id="preview"><img class="cat-thumb" src="https://assets.example/large.png"></div>');
  for (const key of keys) { original.set(key, Reflect.get(globalThis, key)); Reflect.set(globalThis, key, dom.window[key]); }
});
afterEach(() => { for (const key of keys) Reflect.set(globalThis, key, original.get(key)); dom.window.close(); });

test('a large pending preview announces loading until the image arrives', () => {
  const root = document.querySelector<HTMLElement>('#preview')!;
  const image = root.querySelector('img')!;
  Object.defineProperty(image, 'complete', { value: false });
  const dispose = mountAssetPreviewStatus(root, 64 * 1024 * 1024);
  const status = root.querySelector<HTMLElement>('[role="status"]')!;
  assert.match(status.textContent ?? '', /64 MB/); assert.equal(root.getAttribute('aria-busy'), 'true');
  image.dispatchEvent(new dom.window.Event('load'));
  assert.equal(status.hidden, true); assert.equal(root.getAttribute('aria-busy'), 'false');
  dispose(); assert.equal(root.querySelector('[role="status"]'), null);
});

test('a failed preview offers retry and follows the replacement source without stale callbacks after closing', async () => {
  const root = document.querySelector<HTMLElement>('#preview')!;
  const image = root.querySelector('img')!;
  Object.defineProperty(image, 'complete', { value: false });
  const dispose = mountAssetPreviewStatus(root);
  const status = root.querySelector<HTMLElement>('[role="status"]')!;
  const retry = status.querySelector<HTMLButtonElement>('button')!;
  image.dispatchEvent(new dom.window.Event('error'));
  assert.match(status.textContent ?? '', /could not load/); assert.equal(retry.hidden, false);
  retry.click(); await Promise.resolve(); assert.equal(retry.hidden, true); assert.equal(root.getAttribute('aria-busy'), 'true');
  image.dispatchEvent(new dom.window.Event('load')); assert.equal(status.hidden, true);
  image.src = 'https://assets.example/replacement.png'; await Promise.resolve();
  assert.equal(status.hidden, false); assert.equal(root.getAttribute('aria-busy'), 'true');
  dispose(); image.dispatchEvent(new dom.window.Event('error')); assert.equal(root.hasAttribute('aria-busy'), false);
});

test('an already decoded image has no persistent loading message', () => {
  const root = document.querySelector<HTMLElement>('#preview')!;
  const image = root.querySelector('img')!;
  Object.defineProperty(image, 'complete', { value: true }); Object.defineProperty(image, 'naturalWidth', { value: 800 });
  const dispose = mountAssetPreviewStatus(root);
  assert.equal(root.querySelector<HTMLElement>('[role="status"]')!.hidden, true); dispose();
});
