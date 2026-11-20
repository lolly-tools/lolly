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
import { readFileSync } from 'node:fs';
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

const { afterNextPaint, beginViewFade, VIEW_FADE_HOLD_CLASS } = await import('./view-fade.ts');

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

test('hold: a tool open marks the snapshot to be held still before the nodes move in', () => {
  reduceMotion = false;
  const view = freshView();
  // The class must be on the overlay when the outgoing nodes arrive, so none of their
  // animations runs a frame in it (parts/base.css pauses them under .view-fade--hold).
  const classesSeen: string[] = [];
  const proto = dom.window.HTMLElement.prototype;
  const append = proto.appendChild;
  proto.appendChild = function <T extends Node>(this: HTMLElement, node: T): T {
    if (this.classList.contains('view-fade')) classesSeen.push(this.className);
    return append.call(this, node) as T;
  };
  let handle: ReturnType<typeof beginViewFade>;
  try { handle = beginViewFade(view, { hold: true }); }
  finally { proto.appendChild = append; }
  assert.ok(handle!, 'a held fade still returns a handle');
  const overlay = document.querySelector('.view-fade') as HTMLElement;
  assert.ok(overlay.classList.contains(VIEW_FADE_HOLD_CLASS));
  assert.ok(classesSeen.length > 0 && classesSeen.every(c => c.split(' ').includes(VIEW_FADE_HOLD_CLASS)),
    'every outgoing node moved into an overlay that was already held');
  assert.equal(view.childNodes.length, 0);
  handle!.commit();
});

test('hold: other navigations keep the ordinary fade, and reduced motion still makes no snapshot', () => {
  reduceMotion = false;
  const plain = beginViewFade(freshView());
  assert.equal(document.querySelector('.view-fade')!.classList.contains(VIEW_FADE_HOLD_CLASS), false);
  plain!.commit();

  reduceMotion = true;
  const view = freshView();
  assert.equal(beginViewFade(view, { hold: true }), null, 'reduced motion: no snapshot, held or not');
  assert.equal(document.querySelector('.view-fade'), null);
  assert.ok(view.textContent?.includes('old content'));
  reduceMotion = false;
});

test('the router holds the snapshot for a tool open and for nothing else', () => {
  const main = readFileSync(new URL('./main.ts', import.meta.url), 'utf8');
  const calls = [...main.matchAll(/beginViewFade\(([^)]*\)?)\)/g)].map(m => m[1]!.replace(/\s+/g, ' ').trim());
  assert.deepEqual(calls, ["view, { hold: route.name === 'tool' }"],
    'navigate() makes one snapshot, held only when the incoming route is a tool');
  // The pressed card paints before the teardown, for a tool open from another view and
  // only with motion allowed: reduced motion keeps its immediate swap.
  const wait = main.indexOf('await afterNextPaint();');
  assert.ok(wait > 0, 'navigate() waits for a painted frame on a tool open');
  const guard = main.slice(main.lastIndexOf('if (', wait), wait);
  assert.match(guard, /route\.name === 'tool' && _lastRouteName && _lastRouteName !== 'tool' && !prefersReducedMotion\(\)/);
  assert.ok(wait < main.indexOf('view._cleanup?.()', main.indexOf('async function navigate(')), 'before the outgoing view is torn down');
  assert.ok(wait < main.indexOf('beginViewFade(view'), 'and before the snapshot is taken');
});

test('afterNextPaint: after a frame, at once on a hidden page', async () => {
  let painted = false;
  requestAnimationFrame(() => { painted = true; });
  await afterNextPaint();
  assert.equal(painted, true, 'resolves only after the next frame');

  // With a task scheduler the wait ends as a user-blocking task, ahead of queued timers.
  const priorities: string[] = [];
  (globalThis as { scheduler?: unknown }).scheduler = {
    postTask(cb: () => void, o: { priority: string }) { priorities.push(o.priority); queueMicrotask(cb); },
  };
  try { await afterNextPaint(); }
  finally { delete (globalThis as { scheduler?: unknown }).scheduler; }
  assert.deepEqual(priorities, ['user-blocking']);

  const visibility = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(document), 'visibilityState')!;
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
  try {
    let settled = false;
    const p = afterNextPaint().then(() => { settled = true; });
    await Promise.resolve();
    assert.equal(settled, true, 'a hidden page gets no frame, so the navigation does not wait for one');
    await p;
  } finally {
    delete (document as unknown as Record<string, unknown>).visibilityState;
    Object.defineProperty(Object.getPrototypeOf(document), 'visibilityState', visibility);
  }
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
