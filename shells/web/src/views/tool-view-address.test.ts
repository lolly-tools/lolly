// SPDX-License-Identifier: MPL-2.0
/**
 * views/tool-view-address.ts - the stage view reaches the address once it settles.
 *
 * A pinch, wheel or pan used to rewrite the whole address on every frame. These cases
 * drive the real module with a stand-in stage: no address write during a three second
 * burst, exactly one after it, a write on the next frame when a gesture ends, a flush
 * before Share or export, and nothing written into the next route after unmount.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/tool-view-address.test.ts
 */
import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="tool-stage"></div></body></html>', { url: 'https://lolly.test/design?bx=a' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location as unknown as Location;

const { mountViewAddress, VIEW_SETTLE_MS } = await import('./tool-view-address.ts');
const { flushAddressWrites, routeParams } = await import('../lib/url-state.ts');

const FRAME_MS = 16;

/** The slice of StageNav the module reads, driven frame by frame like the real stage. */
function fakeStage() {
  const listeners = new Set<(abs: number) => void>();
  let view = { scale: 1, x: 0, y: 0 };
  return {
    zoom: {
      subscribe(cb: (abs: number) => void) { listeners.add(cb); return () => { listeners.delete(cb); }; },
      isUserZoomed: () => true,
      isSuspended: () => false,
      viewState: () => view,
    },
    /** One frame of a gesture: the transform moves and the stage reports the new view. */
    frame(next: { scale: number; x: number; y: number }): void {
      view = next;
      for (const cb of listeners) cb(next.scale);
    },
  };
}

function watchWrites(): { writes: string[]; restore: () => void } {
  const writes: string[] = [];
  const history = dom.window.history;
  const original = history.replaceState.bind(history);
  history.replaceState = (state: unknown, unused: string, url?: string | URL | null) => {
    writes.push(String(url));
    original(state, unused, url);
  };
  return { writes, restore: () => { history.replaceState = original; } };
}

const stageEl = (): HTMLElement => dom.window.document.getElementById('tool-stage')!;
const viewOf = (): unknown => JSON.parse(routeParams().get('_view') ?? 'null');

test.beforeEach(() => {
  dom.window.history.replaceState(null, '', '/design?bx=a');
  mock.timers.enable({ apis: ['setTimeout'] });
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => setTimeout(() => cb(0), FRAME_MS) as unknown as number;
});
test.afterEach(() => {
  mock.timers.reset();
});

test('a three second pinch writes no address while it moves, and exactly one after it', () => {
  const stage = fakeStage();
  const watch = watchWrites();
  const unmount = mountViewAddress(stage.zoom, stageEl());
  try {
    const frames = (3000 / FRAME_MS) | 0;
    let last = { scale: 1, x: 0, y: 0 };
    for (let i = 1; i <= frames; i++) {
      last = { scale: 1 + i / 100, x: -i, y: -i / 2 };
      stage.frame(last);
      mock.timers.tick(FRAME_MS);
    }
    assert.equal(watch.writes.length, 0, 'no replaceState during the gesture');
    mock.timers.tick(VIEW_SETTLE_MS);
    assert.equal(watch.writes.length, 1, 'one replaceState once the view settles');
    assert.deepEqual(viewOf(), last, 'the address holds the view the gesture ended on');
    assert.equal(routeParams().get('bx'), 'a', 'the document in the address is untouched');
    mock.timers.tick(10_000);
    assert.equal(watch.writes.length, 1);
  } finally { unmount(); watch.restore(); }
});

test('a pointer or WebKit pinch that ends writes the view on the next frame', () => {
  for (const type of ['pointerup', 'gestureend']) {
    const stage = fakeStage();
    const watch = watchWrites();
    const unmount = mountViewAddress(stage.zoom, stageEl());
    try {
      stage.frame({ scale: 2, x: 10, y: 20 });
      stageEl().dispatchEvent(new dom.window.Event(type, { bubbles: true }));
      assert.equal(watch.writes.length, 0, 'the last report of the gesture may still be on its way');
      mock.timers.tick(FRAME_MS);
      assert.equal(watch.writes.length, 1, `${type} writes without waiting for the quiet window`);
      assert.deepEqual(viewOf(), { scale: 2, x: 10, y: 20 });
      mock.timers.tick(VIEW_SETTLE_MS * 2);
      assert.equal(watch.writes.length, 1, 'and the quiet window does not write it again');
    } finally { unmount(); watch.restore(); }
  }
});

test('Share, Copy link and export flush the view before they read the address', () => {
  const stage = fakeStage();
  const watch = watchWrites();
  const unmount = mountViewAddress(stage.zoom, stageEl());
  try {
    stage.frame({ scale: 3, x: 1, y: 2 });
    flushAddressWrites(); // what each of those actions calls first
    assert.equal(watch.writes.length, 1);
    assert.deepEqual(viewOf(), { scale: 3, x: 1, y: 2 });
  } finally { unmount(); watch.restore(); }
});

test('an unchanged view schedules nothing, and an unmounted view writes nothing', () => {
  const stage = fakeStage();
  const watch = watchWrites();
  const unmount = mountViewAddress(stage.zoom, stageEl());
  stage.frame({ scale: 1.5, x: 0, y: 0 });
  flushAddressWrites();
  stage.frame({ scale: 1.5, x: 0, y: 0 });
  mock.timers.tick(VIEW_SETTLE_MS);
  assert.equal(watch.writes.length, 1, 'the same view is not written twice');
  stage.frame({ scale: 4, x: 0, y: 0 });
  unmount();
  mock.timers.tick(VIEW_SETTLE_MS);
  flushAddressWrites();
  stageEl().dispatchEvent(new dom.window.Event('pointerup', { bubbles: true }));
  mock.timers.tick(FRAME_MS);
  assert.equal(watch.writes.length, 1, 'a view that left the page never writes into the next one');
  watch.restore();
});
