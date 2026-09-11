// SPDX-License-Identifier: MPL-2.0
/*
 * view-fade.ts - the cross-view fade overlay.
 *
 * Run directly:  node --test shells/web/src/view-fade.test.ts
 *
 * jsdom gives us a real DOM (createElement/appendChild), rAF (pretendToBeVisual),
 * and a getBoundingClientRect that returns zeros - enough to exercise the node-
 * moving contract that matters. matchMedia isn't implemented by jsdom, so we
 * install a controllable stub (view-fade.ts reads the bare `matchMedia` global to
 * honour reduced motion). transitionend never fires under jsdom, so teardown rides
 * the module's safety-net timeout - which is exactly the path we assert survives.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><main id="view" class="app-view gallery-view"></main></body></html>', { pretendToBeVisual: true });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);

// Controllable reduced-motion switch (jsdom has no matchMedia). Default: motion on.
let reduceMotion = false;
globalThis.matchMedia = ((q: string) => ({
  matches: /reduce/.test(q) ? reduceMotion : false,
  media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
  onchange: null, dispatchEvent: () => false,
})) as unknown as typeof globalThis.matchMedia;

const { beginViewFade } = await import('./view-fade.ts');

/** A fresh #view seeded with some content, detached overlays cleared. */
function freshView(): HTMLElement {
  document.querySelectorAll('.view-fade').forEach((n) => n.remove());
  const view = document.getElementById('view')!;
  view.className = 'app-view gallery-view';
  view.innerHTML = '<div class="gallery-topbar">tabs</div><div class="body">old content</div>';
  return view;
}

test('snapshots: moves #view content into a pinned overlay and leaves #view empty', () => {
  reduceMotion = false;
  const view = freshView();
  const handle = beginViewFade(view);

  assert.ok(handle, 'a fade handle is returned when motion is allowed');
  assert.equal(view.childNodes.length, 0, '#view is emptied for the incoming mount');

  const overlay = document.querySelector('.view-fade') as HTMLElement;
  assert.ok(overlay, 'an overlay is appended to the document');
  assert.equal(overlay.parentElement, document.body, 'overlay lives on <body>, above #view');
  // Carries #view's classes so the frozen nodes stay styled as the outgoing view.
  assert.match(overlay.className, /\bapp-view\b/);
  assert.match(overlay.className, /\bgallery-view\b/);
  assert.equal(overlay.getAttribute('aria-hidden'), 'true');
  assert.match(overlay.style.position, /fixed/);
  assert.ok(overlay.textContent?.includes('old content'), 'the outgoing pixels are inside the overlay');

  handle!.commit();
});

test('reduced motion: no overlay, content untouched, returns null', () => {
  reduceMotion = true;
  const view = freshView();
  const handle = beginViewFade(view);

  assert.equal(handle, null, 'no fade under reduced motion');
  assert.equal(document.querySelector('.view-fade'), null, 'no overlay created');
  assert.ok(view.textContent?.includes('old content'), '#view keeps its content for the caller to clear');
  reduceMotion = false;
});

test('empty view: nothing to snapshot, returns null', () => {
  freshView();
  const view = document.getElementById('view')!;
  view.replaceChildren();
  assert.equal(beginViewFade(view), null);
  assert.equal(document.querySelector('.view-fade'), null);
});

test('supersede: a second fade drops the first overlay so they never stack', () => {
  reduceMotion = false;
  const view = freshView();
  const first = beginViewFade(view);
  assert.ok(first);
  assert.equal(document.querySelectorAll('.view-fade').length, 1);

  // Re-seed and start another (as a rapid second navigation would).
  view.innerHTML = '<div>newer old content</div>';
  const second = beginViewFade(view);
  assert.ok(second);
  assert.equal(document.querySelectorAll('.view-fade').length, 1, 'only the newest overlay remains');

  // Committing the superseded handle must not resurrect or duplicate anything.
  first!.commit();
  assert.equal(document.querySelectorAll('.view-fade').length, 1, 'superseded commit is a no-op on the live overlay');
  second!.commit();
});

test('commit tears the overlay down (safety-net timeout, since jsdom fires no transitionend)', async () => {
  reduceMotion = false;
  const view = freshView();
  const handle = beginViewFade(view)!;
  assert.equal(document.querySelectorAll('.view-fade').length, 1);

  handle.commit();
  handle.commit(); // idempotent - second call must not throw or double-schedule

  // rAF (≈16ms) schedules the 1200ms safety net; wait past it, then assert removal.
  await new Promise((r) => setTimeout(r, 1400));
  assert.equal(document.querySelector('.view-fade'), null, 'overlay is reaped, never stranded over the live view');
});
