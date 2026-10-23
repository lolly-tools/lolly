// SPDX-License-Identifier: MPL-2.0
import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.test/design?bx=a' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location as unknown as Location;

const { flushAddressWrites, mergeRouteParams, replaceRouteUrl, routeParams, settledWrite } = await import('./url-state.ts');

/** Count the browser's address writes and the `lolly:url-state` events they announce. */
function watchWrites(): { writes: string[]; events: () => number; restore: () => void } {
  const writes: string[] = [];
  let events = 0;
  const onEvent = (): void => { events++; };
  const history = dom.window.history;
  const original = history.replaceState.bind(history);
  history.replaceState = (state: unknown, unused: string, url?: string | URL | null) => {
    writes.push(String(url));
    original(state, unused, url);
  };
  dom.window.addEventListener('lolly:url-state', onEvent);
  return {
    writes,
    events: () => events,
    restore: () => {
      history.replaceState = original;
      dom.window.removeEventListener('lolly:url-state', onEvent);
    },
  };
}

test.beforeEach(() => {
  dom.window.history.replaceState(null, '', '/design?bx=a');
  mock.timers.enable({ apis: ['setTimeout'] });
});
test.afterEach(() => {
  mock.timers.reset();
  mock.restoreAll();
});

test('a section change preserves unrelated state and explicit empty sections', () => {
  const original = 'https://lolly.tools/#/a?q=logo&type=vector&asset=logo';
  const next = mergeRouteParams(original, { section: '' });
  assert.deepEqual([...routeParams(next)], [['q', 'logo'], ['type', 'vector'], ['asset', 'logo'], ['section', '']]);
});

test('path and hash routes merge and remove workspace keys without losing packed content', () => {
  for (const base of ['https://lolly.tools/design?z=content&_sel=shape', 'https://lolly.tools/#/tool/design?z=content&_sel=shape']) {
    const next = mergeRouteParams(base, { _ui: 'workspace', _sel: null, full: '' });
    assert.deepEqual([...routeParams(next)], [['z', 'content'], ['_ui', 'workspace'], ['full', '']]);
  }
});

test('a refused address write returns false instead of throwing, so the paint around it finishes', () => {
  const watch = watchWrites();
  const warn = mock.method(console, 'warn', () => {});
  const history = dom.window.history;
  const accept = history.replaceState;
  // WebKit's message when a page writes its address too often.
  history.replaceState = () => { throw new dom.window.DOMException('Attempt to use history.replaceState() more than 100 times per 10 seconds', 'SecurityError'); };
  try {
    let finished = false;
    const paint = (): void => {
      replaceRouteUrl('/design?bx=b');
      finished = true; // what a paint does after its address write
    };
    assert.doesNotThrow(paint);
    assert.equal(finished, true);
    assert.equal(replaceRouteUrl('/design?bx=b'), false);
    assert.equal(location.search, '?bx=a', 'the address is as it was');
    assert.equal(watch.events(), 0, 'nothing announces a write that did not happen');
    assert.equal(warn.mock.callCount(), 2);
  } finally {
    history.replaceState = accept;
    watch.restore();
  }
  assert.equal(replaceRouteUrl('/design?bx=b'), true);
  assert.equal(location.search, '?bx=b');
});

test('a settled write waits for the changes to stop, then writes once from the latest state', () => {
  const watch = watchWrites();
  let value = 0;
  const write = settledWrite(() => replaceRouteUrl(mergeRouteParams(location.href, { n: value })), 300);
  try {
    for (let frame = 0; frame < 120; frame++) {
      value = frame;
      write.schedule();
      mock.timers.tick(16);
    }
    assert.equal(watch.writes.length, 0, 'no write during the burst');
    assert.equal(write.pending(), true);
    mock.timers.tick(300 - 16 - 1);
    assert.equal(watch.writes.length, 0, 'the quiet window counts from the last change');
    mock.timers.tick(1);
    assert.equal(watch.writes.length, 1, 'one write after the burst');
    assert.equal(routeParams().get('n'), '119', 'and it carries the last change');
    assert.equal(write.pending(), false);
    mock.timers.tick(5000);
    assert.equal(watch.writes.length, 1);
  } finally { watch.restore(); write.cancel(); }
});

test('flushAddressWrites runs every waiting write now, and only once', () => {
  const watch = watchWrites();
  const view = settledWrite(() => replaceRouteUrl(mergeRouteParams(location.href, { _view: 'v' })), 300);
  const doc = settledWrite(() => replaceRouteUrl(mergeRouteParams(location.href, { bx: 'c' })), 400);
  try {
    view.schedule();
    doc.schedule();
    flushAddressWrites();
    assert.equal(watch.writes.length, 2);
    assert.deepEqual(Object.fromEntries(routeParams()), { bx: 'c', _view: 'v' });
    flushAddressWrites();
    mock.timers.tick(1000);
    assert.equal(watch.writes.length, 2, 'a flushed write does not run again');
  } finally { watch.restore(); view.cancel(); doc.cancel(); }
});

test('hiding or leaving the page flushes a waiting write', () => {
  const watch = watchWrites();
  const write = settledWrite(() => replaceRouteUrl(mergeRouteParams(location.href, { bx: 'hidden' })), 400);
  try {
    write.schedule();
    dom.window.dispatchEvent(new dom.window.Event('pagehide'));
    assert.equal(watch.writes.length, 1);
    assert.equal(routeParams().get('bx'), 'hidden');
    write.schedule();
    Object.defineProperty(dom.window.document, 'visibilityState', { value: 'hidden', configurable: true });
    dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange'));
    assert.equal(watch.writes.length, 2);
  } finally {
    Object.defineProperty(dom.window.document, 'visibilityState', { value: 'visible', configurable: true });
    watch.restore();
    write.cancel();
  }
});

test('a write is dropped once the page has moved to another route, and cancel drops it too', () => {
  const watch = watchWrites();
  const write = settledWrite(() => replaceRouteUrl(mergeRouteParams(location.href, { bx: 'late' })), 400);
  try {
    write.schedule();
    dom.window.history.pushState(null, '', '/#/projects');
    watch.writes.length = 0;
    mock.timers.tick(400);
    assert.equal(watch.writes.length, 0, 'the old view never writes into the next route');
    assert.equal(location.hash, '#/projects');
    dom.window.history.replaceState(null, '', '/design?bx=a');
    watch.writes.length = 0;
    write.schedule();
    write.cancel();
    mock.timers.tick(1000);
    flushAddressWrites();
    assert.equal(watch.writes.length, 0);
  } finally { watch.restore(); }
});

test('a refused settled write is tried again, then waits for the next change', () => {
  mock.method(console, 'warn', () => {});
  let attempts = 0;
  let accept = false;
  const write = settledWrite(() => { attempts++; return accept; }, 400);
  write.schedule();
  mock.timers.tick(400);
  assert.equal(attempts, 1);
  assert.equal(write.pending(), true, 'a refusal keeps the write waiting');
  mock.timers.tick(1000);
  assert.equal(attempts, 2);
  for (const wait of [2000, 4000, 8000]) mock.timers.tick(wait);
  assert.equal(attempts, 5, 'retried after 1, 2, 4 and 8 seconds');
  mock.timers.tick(60_000);
  assert.equal(attempts, 5, 'then it stops');
  assert.equal(write.pending(), false);
  accept = true;
  write.schedule();
  mock.timers.tick(400);
  assert.equal(attempts, 6, 'the next change writes again');
});
