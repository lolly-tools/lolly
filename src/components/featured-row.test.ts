// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { JSDOM } from 'jsdom';
import { mountFeaturedRow } from './featured-row.ts';

// Drive the mounted component's real event handlers and animation loop. jsdom
// supplies the DOM; these layout measurements model a 390px phone with 260px
// covers, including integer scrollLeft rounding in a browser at device scale 1.
function fixture(t: TestContext, viewMode: 'coverflow' | 'gallery' = 'coverflow', reduced = false) {
  const dom = new JSDOM('<!doctype html><div id="mount"></div>', { url: 'http://localhost/', pretendToBeVisual: true });
  const win = dom.window;
  Object.assign(globalThis, {
    window: win, document: win.document, localStorage: win.localStorage,
    AbortController: win.AbortController,
  });
  win.matchMedia = () => ({ matches: false }) as MediaQueryList;
  if (reduced) win.document.documentElement.dataset.a11yMotion = 'reduce';
  let now = 1000;
  let nextFrame = 0;
  const frames = new Map<number, FrameRequestCallback>();
  globalThis.requestAnimationFrame = callback => { frames.set(++nextFrame, callback); return nextFrame; };
  globalThis.cancelAnimationFrame = id => { frames.delete(id); };
  t.mock.method(performance, 'now', () => now);
  Object.defineProperties(win.HTMLElement.prototype, {
    clientWidth: { get() { return 390; } },
    offsetWidth: { get() { return 260; } },
    offsetLeft: { get(this: HTMLElement) {
      const parent = this.parentElement;
      return parent ? [...parent.children].indexOf(this) * 260 + (parseFloat(parent.style.paddingLeft) || 0) : 0;
    } },
    scrollWidth: { get() { return 7 * 260 + 130; } },
  });
  const mount = win.document.getElementById('mount')!;
  const opened: string[] = [];
  const entries = Array.from({ length: 7 }, (_, i) => ({ id: `tool-${i}`, name: `Tool ${i}`, featured: { blurb: 'Description to omit' } }));
  const handle = mountFeaturedRow(mount, entries, {} as Parameters<typeof mountFeaturedRow>[2], {
    viewMode, onActivate: id => { opened.push(id); },
  });
  const viewport = mount.querySelector<HTMLElement>('.featured-viewport')!;
  let position = 0;
  Object.defineProperty(viewport, 'scrollLeft', {
    get: () => position,
    set: (value: number) => { position = Math.round(Math.max(0, Math.min(6 * 260, value))); },
  });
  const frame = (ms = 16.67): number => {
    now += ms;
    const pending = [...frames.values()];
    frames.clear();
    for (const callback of pending) callback(now);
    return position;
  };
  const pointer = (type: string, x: number, ms = 16, y = 100, extra: Record<string, unknown> = {}, target: Element = viewport): void => {
    now += ms;
    const event = new win.MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true, cancelable: true });
    Object.defineProperties(event, Object.fromEntries(Object.entries({
      pointerId: 1, pointerType: 'touch', isPrimary: true, timeStamp: now, ...extra,
    }).map(([key, value]) => [key, { value }])));
    target.dispatchEvent(event);
  };
  const settle = (fps = 60): number[] => {
    const positions = [position];
    for (let elapsed = 0; elapsed < 650; elapsed += 1000 / fps) positions.push(frame(1000 / fps));
    return positions;
  };
  frame();
  t.after(() => { handle.destroy(); win.close(); });
  return { mount, viewport, opened, pointer, frame, settle, handle };
}

function monotonic(positions: number[], direction: number): void {
  for (let i = 1; i < positions.length; i++) {
    assert.ok((positions[i]! - positions[i - 1]!) * direction >= 0, `swipe reversed at frame ${i}: ${positions}`);
  }
}

for (const fps of [30, 60, 120]) {
  test(`short flicks advance in both directions and settle without reversing at ${fps}Hz`, t => {
    const f = fixture(t);
    f.pointer('pointerdown', 300);
    f.pointer('pointermove', 280, 25);
    f.pointer('pointermove', 255, 25);
    f.pointer('pointerup', 255, 10);
    const left = f.settle(fps);
    monotonic(left, 1);
    assert.equal(left.at(-1), 260);
    f.pointer('pointerdown', 100);
    f.pointer('pointermove', 125, 25);
    f.pointer('pointermove', 145, 25);
    f.pointer('pointerup', 145, 10);
    const right = f.settle(fps);
    monotonic(right, -1);
    assert.equal(right.at(-1), 0);
    assert.deepEqual(f.opened, []);
  });
}

test('a long fast swipe can pass several covers, and grabbing stops the settle immediately', t => {
  const f = fixture(t);
  f.pointer('pointerdown', 370);
  for (const x of [290, 210, 130, 50]) f.pointer('pointermove', x, 20);
  f.pointer('pointerup', 50, 10);
  const positions = f.settle();
  monotonic(positions, 1);
  assert.ok(positions.at(-1)! >= 780, 'long fast swipe crosses at least three covers');
  f.pointer('pointerdown', 50);
  f.pointer('pointermove', 130, 20);
  f.pointer('pointerup', 130, 10);
  f.frame();
  f.pointer('pointerdown', 200);
  const grabbed = f.viewport.scrollLeft;
  f.settle();
  assert.equal(f.viewport.scrollLeft, grabbed, 'holding interrupts all pending motion');
});

test('holding before release discards fling velocity and lands on the nearest cover', t => {
  const f = fixture(t);
  f.pointer('pointerdown', 350);
  f.pointer('pointermove', 190, 30);
  f.pointer('pointerup', 190, 180);
  assert.equal(f.settle().at(-1), 260);
});

test('a relayout with unchanged cover geometry preserves the chosen landing cover', t => {
  const f = fixture(t);
  f.pointer('pointerdown', 300);
  f.pointer('pointermove', 255, 50);
  f.pointer('pointerup', 255, 10);
  f.frame();
  f.handle.setVisible(true); // also remeasured after image decode or a resize event
  assert.equal(f.settle().at(-1), 260, 'remeasuring must not snap a short flick back to its start');
});

test('trackpad deltas move directly without a competing snap between events', t => {
  const f = fixture(t);
  for (let i = 1; i <= 4; i++) {
    f.viewport.dispatchEvent(new window.WheelEvent('wheel', { deltaX: 40, cancelable: true }));
    f.frame(30);
    assert.equal(f.viewport.scrollLeft, i * 40);
  }
  assert.equal(f.settle().at(-1), 260);
});

test('a late direction change uses recent movement rather than the original throw', t => {
  const f = fixture(t);
  f.viewport.scrollLeft = 780;
  f.pointer('pointerdown', 300);
  f.pointer('pointermove', 100, 30);
  f.pointer('pointermove', 130, 150);
  f.pointer('pointermove', 180, 25);
  f.pointer('pointermove', 230, 25);
  f.pointer('pointerup', 230, 10);
  const positions = f.settle();
  monotonic(positions, -1);
  assert.ok(positions.at(-1)! < 780);
});

test('vertical gestures and cancelled taps do not pan, fling, or activate a tool', t => {
  const f = fixture(t);
  const link = f.mount.querySelector('.ftile-link')!;
  f.pointer('pointerdown', 200, 16, 100, {}, link);
  f.pointer('pointermove', 204, 16, 140);
  f.pointer('pointercancel', 204, 16, 160);
  assert.equal(f.settle().at(-1), 0);
  f.pointer('pointerdown', 200, 16, 100, {}, link);
  f.pointer('pointercancel', 200, 16, 100);
  assert.deepEqual(f.opened, []);
  f.pointer('pointerdown', 300);
  f.pointer('pointermove', 140, 20);
  f.pointer('pointercancel', 140);
  assert.equal(f.settle().at(-1), 260, 'cancelled swipe settles nearby without throwing');
});

test('a secondary finger cannot reset an active swipe', t => {
  const f = fixture(t);
  f.pointer('pointerdown', 300);
  f.pointer('pointermove', 280, 25);
  f.pointer('pointerdown', 100, 5, 100, { pointerId: 2, isPrimary: false });
  f.pointer('pointermove', 255, 20);
  f.pointer('pointerup', 255, 10);
  assert.equal(f.settle().at(-1), 260);
});

test('swipes clamp at both ends and can immediately reverse away from an edge', t => {
  const f = fixture(t);
  for (const [start, direction, end] of [[0, 1, 0], [1560, -1, 1560]]) {
    f.viewport.scrollLeft = start!;
    f.pointer('pointerdown', 200);
    f.pointer('pointermove', 200 + direction! * 150, 20);
    f.pointer('pointerup', 200 + direction! * 150, 10);
    assert.equal(f.settle().at(-1), end);
    f.pointer('pointerdown', 200);
    f.pointer('pointermove', 200 - direction! * 45, 50);
    f.pointer('pointerup', 200 - direction! * 45, 10);
    assert.equal(f.settle().at(-1), end! + direction! * 260);
  }
});

test('reduced motion snaps immediately without throwing across extra covers', t => {
  const f = fixture(t, 'coverflow', true);
  f.pointer('pointerdown', 350);
  f.pointer('pointermove', 190, 20);
  f.pointer('pointerup', 190, 10);
  assert.equal(f.viewport.scrollLeft, 260);
  assert.equal(f.settle().at(-1), 260);
});

test('Gallery touch keeps native scrolling; both strip modes omit descriptions and retain names', t => {
  const f = fixture(t, 'gallery');
  f.pointer('pointerdown', 300);
  f.pointer('pointermove', 100, 20);
  f.pointer('pointerup', 100, 10);
  assert.equal(f.viewport.scrollLeft, 0, 'JS does not take over Gallery touch scrolling');
  for (const mode of ['gallery', 'coverflow'] as const) {
    f.handle.setViewMode(mode);
    assert.equal(f.mount.querySelector('.ftile-blurb'), null);
    assert.ok(!f.mount.textContent!.includes('Description to omit'));
    assert.equal(f.mount.querySelector('.ftile-link')?.getAttribute('aria-label'), 'Open Tool 0');
  }
});
