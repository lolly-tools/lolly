// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { JSDOM } from 'jsdom';
import { mountFeaturedRow } from './featured-row.ts';
import { mountCoverFlow } from '../lib/covers-flow.ts';
import { applyPerfUi, setFlagMirror } from '../feature-flags.ts';

// Drive the mounted component's real event handlers and animation loop. jsdom
// supplies the DOM; these layout measurements model a 390px phone with 260px
// covers, including integer scrollLeft rounding in a browser at device scale 1.
function fixture(t: TestContext, viewMode: 'coverflow' | 'gallery' = 'coverflow', reduced = false, count = 7, recent?: string, unstyled = false) {
  const dom = new JSDOM('<!doctype html><div id="mount"></div>', { url: 'http://localhost/', pretendToBeVisual: true });
  const win = dom.window;
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  Object.assign(globalThis, {
    window: win, document: win.document, localStorage: win.localStorage,
    AbortController: win.AbortController,
  });
  win.matchMedia = () => ({ matches: reduced }) as MediaQueryList;
  if (reduced) win.document.documentElement.dataset.a11yMotion = 'reduce';
  let now = 1000;
  let nextFrame = 0;
  let stylesReady = !unstyled;
  const frames = new Map<number, FrameRequestCallback>();
  globalThis.requestAnimationFrame = callback => { frames.set(++nextFrame, callback); return nextFrame; };
  globalThis.cancelAnimationFrame = id => { frames.delete(id); };
  t.mock.method(performance, 'now', () => now);
  Object.defineProperties(win.HTMLElement.prototype, {
    clientWidth: { get() { return 390; } },
    offsetWidth: { get() { return 260; } },
    offsetLeft: { get(this: HTMLElement) {
      if (!stylesReady) return 0;
      const parent = this.parentElement;
      return parent ? [...parent.children].indexOf(this) * 260 + (parseFloat(parent.style.paddingLeft) || 0) : 0;
    } },
    // The wrap clones widen the track they sit in, as they do in a browser.
    scrollWidth: { get(this: HTMLElement) {
      return this.querySelector(':scope > .ftile--clone') ? this.children.length * 260 + 130 : 7 * 260 + 130;
    } },
  });
  const mount = win.document.getElementById('mount')!;
  const opened: string[] = [];
  if (recent) win.localStorage.setItem('lolly-featured-activity:tools', JSON.stringify([recent]));
  const entries = Array.from({ length: count }, (_, i) => ({ id: `tool-${i}`, name: `Tool ${i}`, featured: { blurb: 'Description to omit' } }));
  const handle = mountFeaturedRow(mount, entries, {} as Parameters<typeof mountFeaturedRow>[2], {
    viewMode, onActivate: id => { opened.push(id); },
  });
  const viewport = mount.querySelector<HTMLElement>('.featured-viewport')!;
  let position = viewport.scrollLeft;
  const origin = (): number => {
    const first = mount.querySelector<HTMLElement>('.ftile:not(.ftile--clone)')!;
    return mount.querySelector('.featured--coverflow') ? first.offsetLeft + first.offsetWidth / 2 - 195 : 0;
  };
  const scroll = {
    get position() { return position - origin(); },
    set position(value: number) { viewport.scrollLeft = value + origin(); },
  };
  Object.defineProperty(viewport, 'scrollLeft', {
    get: () => position,
    set: (value: number) => { position = Math.round(Math.max(0, Math.min(Math.max(0, (mount.querySelectorAll('.ftile').length - 1) * 260), value))); },
  });
  const frame = (ms = 16.67): number => {
    now += ms;
    const pending = [...frames.values()];
    frames.clear();
    for (const callback of pending) callback(now);
    return scroll.position;
  };
  const pointer = (type: string, x: number, ms = 16, y = 100, extra: Record<string, unknown> = {}, target: Element = viewport): number => {
    now += ms;
    const event = new win.MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true, cancelable: true });
    Object.defineProperties(event, Object.fromEntries(Object.entries({
      pointerId: 1, pointerType: 'touch', isPrimary: true, timeStamp: now, ...extra,
    }).map(([key, value]) => [key, { value }])));
    target.dispatchEvent(event);
    return event.timeStamp;
  };
  const settle = (fps = 60, duration = 3000): number[] => {
    const positions = [scroll.position];
    for (let elapsed = 0; elapsed < duration; elapsed += 1000 / fps) positions.push(frame(1000 / fps));
    return positions;
  };
  frame();
  t.after(() => { handle.destroy(); win.close(); });
  return { mount, viewport, scroll, opened, pointer, frame, settle, handle, frames,
    loadStyles() { stylesReady = true; handle.setVisible(true); },
    mountDocs() {
      Object.assign(globalThis, {
        getComputedStyle: win.getComputedStyle.bind(win), matchMedia: win.matchMedia,
        addEventListener: win.addEventListener.bind(win),
      });
      const docs = win.document.createElement('section');
      docs.className = 'covers-section';
      docs.innerHTML = `<div id="coversRoot" tabindex="0"><div id="coversStrip" style="padding-left:65px">${entries.map(e => `<a class="cover-card"><span class="cover-cap"><b>${e.name}</b></span></a>`).join('')}</div><nav class="covers-nav"><div class="covers-dots"></div></nav></div>`;
      win.document.body.append(docs);
      const strip = docs.querySelector<HTMLElement>('#coversStrip')!;
      let position = 0;
      Object.defineProperty(strip, 'scrollLeft', {
        get: () => position,
        set: (value: number) => { position = Math.round(Math.max(0, Math.min((strip.children.length - 1) * 260, value))); },
      });
      mountCoverFlow(docs);
      return { strip, get position() {
        return position - docs.querySelector<HTMLElement>('.cover-card:not(.is-clone)')!.offsetLeft + 65;
      } };
    },
  };
}

function monotonic(positions: number[], direction: number): void {
  for (let i = 1; i < positions.length; i++) {
    assert.ok((positions[i]! - positions[i - 1]!) * direction >= 0, `swipe reversed at frame ${i}: ${positions}`);
  }
}

test('a live performance toggle flattens Cover Flow and stops its frame loop', t => {
  const f = fixture(t);
  assert.ok(f.frames.size > 0);
  setFlagMirror('perf-ui', true); applyPerfUi(true);
  f.frame();
  assert.equal(f.frames.size, 0);
  assert.equal(f.mount.querySelector('.featured--coverflow'), null);
  f.handle.setViewMode('coverflow');
  assert.equal(f.frames.size, 0, 'view controls cannot restart an effect while performance mode is on');
  setFlagMirror('perf-ui', false); applyPerfUi(false);
  assert.ok(f.mount.querySelector('.featured--coverflow'));
  assert.ok(f.frames.size > 0);
});

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
  const grabbed = f.scroll.position;
  f.settle();
  assert.equal(f.scroll.position, grabbed, 'holding interrupts all pending motion');
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

test('trackpad swipes build momentum and coast before settling, as on Docs', t => {
  const f = fixture(t);
  let previous = 0;
  for (let i = 1; i <= 4; i++) {
    f.viewport.dispatchEvent(new window.WheelEvent('wheel', { deltaX: 40, cancelable: true }));
    f.frame(30);
    assert.ok(f.scroll.position > previous);
    previous = f.scroll.position;
  }
  const positions = f.settle();
  assert.ok(positions[30]! > previous + 200, 'wheel release keeps gliding after half a second');
  assert.equal(positions.at(-1)! % 260, 0, 'rests at a cover centre');
});

test('reduced motion applies wheel deltas directly and waits for the stream to finish', t => {
  const f = fixture(t, 'coverflow', true);
  for (let i = 1; i <= 4; i++) {
    f.viewport.dispatchEvent(new window.WheelEvent('wheel', { deltaX: 40, cancelable: true }));
    f.frame(30);
    assert.equal(f.scroll.position, i * 40);
  }
  assert.equal(f.settle().at(-1), 260);
});

test('a late direction change uses recent movement rather than the original throw', t => {
  const f = fixture(t);
  f.scroll.position = 780;
  f.pointer('pointerdown', 300);
  f.pointer('pointermove', 100, 30);
  f.pointer('pointermove', 130, 150);
  f.pointer('pointermove', 180, 25);
  f.pointer('pointermove', 230, 25);
  f.pointer('pointerup', 230, 10);
  const positions = f.settle();
  monotonic(positions.slice(0, 61), -1); // the coast follows the final finger direction
  // Once inertia runs out, Docs eases to the nearest centre, which may sit
  // slightly behind the final coast position.
  assert.ok(positions.at(-1)! - Math.min(...positions) < 130);
  assert.ok(positions.at(-1)! < 780);
});

test('vertical gestures and cancelled taps do not pan, fling, or activate a tool', t => {
  const f = fixture(t);
  const link = f.mount.querySelector('.ftile:not(.ftile--clone) .ftile-link')!;
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

test('swipes repeat seamlessly across both ends and can reverse after wrapping', t => {
  const f = fixture(t);
  f.pointer('pointerdown', 200);
  f.pointer('pointermove', 245, 50);
  f.pointer('pointerup', 245, 10);
  assert.equal(f.settle().at(-1), 1560, 'backwards from the first wraps to the last');
  f.pointer('pointerdown', 245);
  f.pointer('pointermove', 200, 50);
  f.pointer('pointerup', 200, 10);
  assert.equal(f.settle().at(-1), 0, 'forwards from the last wraps to the first');
});

test('reduced motion snaps immediately without throwing across extra covers', t => {
  const f = fixture(t, 'coverflow', true);
  f.pointer('pointerdown', 350);
  f.pointer('pointermove', 190, 20);
  f.pointer('pointerup', 190, 10);
  assert.equal(f.scroll.position, 260);
  assert.equal(f.settle().at(-1), 260);
});

test('Gallery touch keeps native scrolling; both strip modes omit descriptions and retain names', t => {
  const f = fixture(t, 'gallery');
  const start = f.scroll.position;
  f.pointer('pointerdown', 300);
  f.pointer('pointermove', 100, 20);
  f.pointer('pointerup', 100, 10);
  assert.equal(f.scroll.position, start, 'JS does not take over Gallery touch scrolling');
  for (const mode of ['gallery', 'coverflow'] as const) {
    f.handle.setViewMode(mode);
    assert.equal(f.mount.querySelector('.ftile-blurb'), null);
    assert.ok(!f.mount.textContent!.includes('Description to omit'));
    assert.equal(f.mount.querySelector('.ftile:not(.ftile--clone) .ftile-link')?.getAttribute('aria-label'), 'Open Tool 0');
  }
});

test('the last opened favourite starts in the centre and opens exactly once', t => {
  const f = fixture(t, 'coverflow', false, 7, 'tool-4');
  assert.equal(f.scroll.position, 4 * 260);
  assert.equal(f.mount.querySelector('.is-centred')?.getAttribute('data-tool'), 'tool-4');
  f.mount.querySelector<HTMLButtonElement>('.featured-go')!.click();
  assert.deepEqual(f.opened, ['tool-4']);
  assert.equal(f.mount.querySelector('.featured-go')!.getAttribute('aria-label'), 'Open Tool 4');
});

test('one item remains centred; two items can repeat in either direction', t => {
  const f = fixture(t, 'coverflow', true, 1);
  f.pointer('pointerdown', 300);
  f.pointer('pointermove', 100);
  f.pointer('pointerup', 100);
  assert.equal(f.settle().at(-1), 0);
  assert.equal(f.mount.querySelectorAll('.ftile--clone').length, 0);
});

test('keyboard arrows loop and clones stay out of the tab order', t => {
  const f = fixture(t, 'coverflow', true, 2);
  for (let i = 0; i < 5; i++) {
    f.viewport.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    assert.equal(f.scroll.position, i % 2 === 0 ? 260 : 0);
  }
  for (const clone of f.mount.querySelectorAll('.ftile--clone')) {
    assert.equal(clone.getAttribute('aria-hidden'), 'true');
    assert.equal(clone.querySelector('a')!.tabIndex, -1);
  }
  f.viewport.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.deepEqual(f.opened, ['tool-1']);
});

test('touch writes are batched per frame without losing movement', t => {
  const f = fixture(t);
  f.pointer('pointerdown', 300);
  for (const x of [290, 275, 260, 240]) f.pointer('pointermove', x, 2);
  assert.equal(f.scroll.position, 0, 'pointer handlers collect deltas without repainting');
  f.frame();
  assert.equal(f.scroll.position, 60);
  f.pointer('pointercancel', 240);
});

test('arrow keys work from Open and repeated presses retain the requested destination', t => {
  const f = fixture(t);
  const button = f.mount.querySelector<HTMLButtonElement>('.featured-go')!;
  for (let i = 0; i < 3; i++) {
    button.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    f.frame(20);
  }
  assert.equal(f.settle().at(-1), 780);
  button.click();
  assert.deepEqual(f.opened, ['tool-3']);
  button.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
  assert.equal(f.settle().at(-1), 0);
  button.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'End', bubbles: true }));
  assert.equal(f.settle().at(-1), 1560);
});

test('a mouse drag leaves the fan ready for arrow keys, as on Docs', t => {
  const f = fixture(t);
  f.pointer('pointerdown', 300, 16, 100, { pointerType: 'mouse' });
  f.pointer('pointermove', 140, 50, 100, { pointerType: 'mouse' });
  f.pointer('pointerup', 140, 180, 100, { pointerType: 'mouse' });
  f.settle();
  assert.equal(window.document.activeElement, f.viewport);
  assert.equal(f.viewport.dataset.focusBy, 'pointer');
  f.viewport.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  assert.equal(f.viewport.dataset.focusBy, undefined);
  assert.equal(f.settle().at(-1), 520);
});

test('late carousel CSS preserves the requested favourite instead of selecting a vertical-list clone', t => {
  const f = fixture(t, 'coverflow', false, 7, 'tool-3', true);
  f.frame();
  f.loadStyles();
  assert.equal(f.settle().at(-1), 780);
  assert.equal(f.mount.querySelector('.is-centred')?.getAttribute('data-tool'), 'tool-3');
});

for (const fps of [30, 60, 120]) {
  test(`Docs and featured coverflows follow the same swipe trajectory at ${fps}Hz`, t => {
    const f = fixture(t);
    const docs = f.mountDocs();
    const period = 7 * 260;
    const compare = (): void => {
      // Each component keeps a different number of off-screen clones. Compare
      // the visible position modulo a full cycle, including the wrap frame.
      const difference = ((f.scroll.position - docs.position) % period + period) % period;
      assert.ok(Math.min(difference, period - difference) <= 1,
        `featured ${f.scroll.position}, Docs ${docs.position}`);
    };
    const pointer = (type: string, x: number, ms = 16, y = 100): void => {
      const timeStamp = f.pointer(type, x, ms, y);
      // Dispatch work can delay the second handler; coast timing must use the
      // original touch timestamp, as velocity sampling does.
      f.pointer(type, x, type === 'pointerup' ? 5 : 0, y, { timeStamp }, docs.strip);
      compare();
    };
    const frame = (ms = 1000 / fps): void => { f.frame(ms); compare(); };
    const settle = (): void => {
      for (let elapsed = 0; elapsed < 3000; elapsed += 1000 / fps) frame();
      assert.equal(f.scroll.position % 260, 0);
    };
    for (const [distance, duration] of [[45, 50], [320, 80], [-600, 160], [260, 600]]) {
      const start = f.scroll.position;
      pointer('pointerdown', 300);
      const samples = Math.max(2, Math.round(duration! * fps / 1000));
      for (let i = 1; i <= samples; i++) {
        pointer('pointermove', 300 - distance! * i / samples, duration! / samples);
        frame(0);
      }
      pointer('pointerup', 300 - distance!, 10);
      settle();
      if (distance === 45) assert.equal(f.scroll.position - start, 260, 'a short flick advances one cover');
    }
    // Reverse during a long throw, then pause with a finger still down.
    pointer('pointerdown', 350);
    pointer('pointermove', 100, 30); frame(0);
    pointer('pointermove', 170, 30); frame(0);
    pointer('pointerup', 170, 10); settle();
    pointer('pointerdown', 350);
    pointer('pointermove', 190, 30); frame(0);
    pointer('pointerup', 190, 180); settle();
    // A vertical page gesture or lost capture must never launch a throw.
    pointer('pointerdown', 200);
    pointer('pointermove', 204, 16, 140); frame(0);
    pointer('pointercancel', 204, 16, 160); settle();
    pointer('pointerdown', 300);
    pointer('pointermove', 140, 20); frame(0);
    pointer('lostpointercapture', 140); settle();
    for (let i = 0; i < 4; i++) {
      for (const strip of [f.viewport, docs.strip]) {
        strip.dispatchEvent(new window.WheelEvent('wheel', { deltaX: 40, cancelable: true }));
      }
      frame();
    }
    settle();
    assert.deepEqual(f.opened, []);
  });
}

test('the still Gallery strip wraps both ways, with a clone set on each side of the originals', t => {
  const f = fixture(t, 'gallery');
  const tiles = [...f.mount.querySelectorAll<HTMLElement>('.ftile')];
  assert.equal(tiles.length, 21, 'originals plus one clone set before and one after');
  assert.ok(tiles.slice(0, 7).every(tile => tile.classList.contains('ftile--clone')));
  assert.ok(tiles.slice(7, 14).every(tile => !tile.classList.contains('ftile--clone')));
  const period = 7 * 260;
  assert.equal(f.viewport.scrollLeft, period, 'opens on the originals, so there is room to scroll left');
  // A native scroll past the first original reaches the left clones and is moved one
  // period right, onto the same picture among the originals.
  f.viewport.scrollLeft = period - 100;
  f.viewport.dispatchEvent(new window.Event('scroll'));
  assert.equal(f.viewport.scrollLeft, 2 * period - 100);
  f.viewport.scrollLeft = 2 * period + 40;
  f.viewport.dispatchEvent(new window.Event('scroll'));
  assert.equal(f.viewport.scrollLeft, period + 40);
});

test('a re-measure over unchanged tiles keeps the wrap clones and the view', t => {
  const f = fixture(t, 'gallery');
  const period = 7 * 260;
  const clones = [...f.mount.querySelectorAll('.ftile--clone')];
  assert.equal(clones.length, 14);
  f.viewport.scrollLeft = period + 300;
  f.handle.setVisible(true);   // the same re-measure a resize or the 600 ms relayout runs
  window.dispatchEvent(new window.Event('resize'));
  f.frame();
  const after = [...f.mount.querySelectorAll('.ftile--clone')];
  assert.ok(after.length === clones.length && after.every((node, i) => node === clones[i]), 'no clone was rebuilt');
  assert.equal(f.viewport.scrollLeft, period + 300, 'the view stays put');
  // A mode switch removes the clones, so coming back builds a fresh set.
  f.handle.setViewMode('coverflow');
  f.handle.setViewMode('gallery');
  const rebuilt = [...f.mount.querySelectorAll('.ftile--clone')];
  assert.equal(rebuilt.length, 14);
  assert.ok(rebuilt.every(node => !clones.includes(node)));
});

test('setPreview gives a tile and its wrap copies the committed preview in place', t => {
  const f = fixture(t, 'gallery');
  // jsdom has no CSS.escape; these ids need no escaping.
  if (typeof globalThis.CSS === 'undefined') {
    globalThis.CSS = { escape: (value: string) => value } as typeof CSS;
    t.after(() => { delete (globalThis as { CSS?: unknown }).CSS; });
  }
  const copies = f.mount.querySelectorAll('.ftile[data-tool="tool-2"]');
  assert.equal(copies.length, 3);
  assert.ok([...copies].every(tile => tile.classList.contains('ftile--icon')));
  const before = f.viewport.scrollLeft;
  assert.equal(f.handle.setPreview('tool-2', 'data:image/png;base64,AAAA'), true);
  for (const tile of copies) {
    const img = tile.querySelector<HTMLImageElement>('.ftile-stage > .ftile-img[data-base]');
    assert.equal(img?.getAttribute('src'), 'data:image/png;base64,AAAA');
    assert.ok(img!.classList.contains('is-active'));
    assert.equal(img!.nextElementSibling?.className, 'ftile-open', 'sits where tileMarkup puts it');
    assert.ok(!tile.classList.contains('ftile--icon'));
    assert.equal(tile.querySelector('.ftile-iconname'), null);
  }
  assert.equal(f.handle.setPreview('tool-2', 'data:image/png;base64,BBBB'), true);
  assert.equal(f.mount.querySelectorAll('.ftile[data-tool="tool-2"] .ftile-img').length, 3, 'a second call swaps the src');
  assert.equal(f.viewport.scrollLeft, before);
  assert.equal(f.handle.setPreview('missing', 'data:,'), false);
});

test('the strip is marked parked while it is scrolled out of view', t => {
  let notify: ((entries: Array<{ isIntersecting: boolean }>) => void) | undefined;
  const original = globalThis.IntersectionObserver;
  globalThis.IntersectionObserver = class {
    constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) { notify = callback; }
    observe() {}
    disconnect() {}
  } as unknown as typeof IntersectionObserver;
  t.after(() => { globalThis.IntersectionObserver = original; });
  const f = fixture(t, 'gallery');
  const section = f.mount.querySelector('.featured')!;
  assert.ok(!section.classList.contains('is-parked'));
  notify!([{ isIntersecting: false }]);
  assert.ok(section.classList.contains('is-parked'));
  notify!([{ isIntersecting: true }]);
  assert.ok(!section.classList.contains('is-parked'));
});
