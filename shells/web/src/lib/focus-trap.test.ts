// SPDX-License-Identifier: MPL-2.0
/*
 * focus-trap.ts - the background `inert` sweep, specifically its interaction with
 * the shared screen-reader live regions that a11y.ts mounts as <body> children.
 *
 * Run directly:  node --test shells/web/src/lib/focus-trap.test.ts
 *
 * These drive the REAL a11y.ts and the REAL trapFocus against a jsdom document, so
 * the marker contract is tested end-to-end: rename the attribute on either side and
 * these fail. jsdom implements no layout, so offsetParent is null for every element
 * and the Tab-wrap boundary can't be exercised here - that's a browser concern. The
 * inert sweep is pure DOM walking, which jsdom models faithfully.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="app">app</div></body></html>', { pretendToBeVisual: true });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);

const { trapFocus } = await import('./focus-trap.ts');
const { announce } = await import('../a11y.ts');

/** Let a11y.ts's clear-then-set-on-rAF land. */
const tick = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()));

const liveRegions = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('[aria-live]')];

/** A body-mounted overlay, the shape every real trap subject takes (picker, cropper, …). */
function overlay(): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('role', 'dialog');
  el.innerHTML = '<button>close</button>';
  document.body.appendChild(el);
  return el;
}

test('the sweep still inerts real background siblings', () => {
  const el = overlay();
  const trap = trapFocus(el);
  assert.equal(document.getElementById('app')!.inert, true, 'app root should be inert behind a modal');
  assert.ok(!el.inert, 'the overlay itself must never be inerted');
  trap.release();
  assert.ok(!document.getElementById('app')!.inert, 'release restores the background');
  el.remove();
});

test('a live region created BEFORE the trap survives the sweep', async () => {
  announce('route changed');            // main.ts does this on every navigation
  await tick();
  const regions = liveRegions();
  assert.ok(regions.length > 0, 'announce should have mounted a live region');

  const el = overlay();
  const trap = trapFocus(el);
  for (const r of regions) {
    assert.ok(!r.inert, 'live region must stay in the accessibility tree while a modal is open');
    assert.equal(r.parentElement, document.body, 'guard: region is a body child, so the sweep does reach it');
  }
  trap.release();
  el.remove();
});

test('announcements raised while a trap is open still reach the region', async () => {
  announce('seed');                     // force the region to exist before the sweep
  await tick();
  const el = overlay();
  const trap = trapFocus(el);

  announce('collected Geeko logo');     // the picker.ts flashCard() path
  await tick();
  const polite = document.querySelector<HTMLElement>('[aria-live="polite"]')!;
  assert.equal(polite.textContent, 'collected Geeko logo');
  assert.ok(!polite.inert);

  trap.release();
  el.remove();
});

test('assertive errors inside a trap are announced (upload-failure path)', async () => {
  announce('warm up', { assertive: true });
  await tick();
  const el = overlay();
  const trap = trapFocus(el);

  announce('Upload failed: too large', { assertive: true });
  await tick();
  const assertive = document.querySelector<HTMLElement>('[aria-live="assertive"]')!;
  assert.equal(assertive.textContent, 'Upload failed: too large');
  assert.ok(!assertive.inert);

  trap.release();
  el.remove();
});

test('release() leaves the live regions alone (it never inerted them to begin with)', async () => {
  announce('hello');
  await tick();
  const el = overlay();
  trapFocus(el).release();
  for (const r of liveRegions()) assert.ok(!r.inert);
  el.remove();
});
