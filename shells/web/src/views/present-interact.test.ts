// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { WebPageDriver } from '../lib/web-page-driver.ts';
const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://lolly.tools/' });
const win = dom.window as unknown as Window & typeof globalThis;
globalThis.window = win; globalThis.document = win.document;
globalThis.location = win.location; globalThis.Element = win.Element; globalThis.HTMLElement = win.HTMLElement;
globalThis.HTMLIFrameElement = win.HTMLIFrameElement;
const { mountPresentInteract, presentBuildSteps } = await import('./present-interact.ts');
const { openPresentMode } = await import('./present-mode.ts');
globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0) as unknown as number) as typeof requestAnimationFrame;
win.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof matchMedia;

function fixture(settings = '', reduced = false, kiosk = false) {
  const stage = document.createElement('div'); stage.tabIndex = -1;
  stage.innerHTML = `<div class="lolly-frame-page" style="width:1920px;height:1080px"><div class="lolly-box" style="left:200px;top:100px;width:600px;height:400px"><div class="lolly-box-web" data-lolly-web="https://lolly.tools/?tool=qr-code" data-interact="2" data-web-title="My demo"><iframe data-web-live="demo" src="https://lolly.tools/?tool=qr-code"></iframe></div></div></div>`;
  document.body.append(stage);
  const page = stage.firstElementChild as HTMLElement, marker = page.querySelector<HTMLElement>('.lolly-box-web')!;
  marker.dataset.interactOpts = settings;
  const callbacks = new Map<number, FrameRequestCallback>(); let id = 0, y = 0;
  win.requestAnimationFrame = (callback) => { callbacks.set(++id, callback); return id; };
  win.cancelAnimationFrame = (key) => { callbacks.delete(key); };
  const tick = (time: number) => { const pending = [...callbacks.values()]; callbacks.clear(); for (const callback of pending) callback(time); };
  const calls: Array<[string, unknown]> = [];
  const subscribers = new Set<() => void>();
  const driver: WebPageDriver = {
    frame: marker.querySelector('iframe')!, capabilities: { backend: 'same-origin', key: true, scroll: true, depth: true, checking: false },
    depth: () => ({ y, max: 1000 }), key: (key) => { calls.push(['key', key]); return true; },
    scrollTo: (to) => { if (typeof to === 'number') y = Math.max(0, Math.min(1000, to)); calls.push(['scroll', to]); for (const cb of subscribers) cb(); return true; },
    configure: () => {}, setFocused: (on) => { calls.push(['focus', on]); }, setSlideActive: (on) => { calls.push(['slide', on]); },
    handKeyboard: (on) => { calls.push(['hand', on]); }, subscribe: (cb) => { subscribers.add(cb); return () => { subscribers.delete(cb); }; }, destroy: () => {},
  };
  const controller = mountPresentInteract({ stage, pages: [page], reduced, kiosk, load: () => { calls.push(['load', true]); }, driver: () => driver });
  const sync = (build = 2, extras = {}) => controller.sync({ index: 0, build, overview: false, paused: false, ...extras });
  const close = () => { controller.destroy(); stage.remove(); };
  return { stage, page, marker, driver, controller, calls, sync, tick, close, callbacks, subscribers, get y() { return y; } };
}

test('the step union includes focus clicks, deduplicates builds and excludes kiosk focus', () => {
  const page = document.createElement('div');
  page.innerHTML = `<div data-build="1"></div><div data-build="5"></div><div class="lolly-box-web" data-lolly-web="a" data-interact="2"></div><div class="lolly-box-web" data-lolly-web="b" data-interact="5"></div><div class="lolly-box-web" data-lolly-web="c" data-interact="0"></div><div class="lolly-box-web" data-lolly-web="d" data-interact="NaN"></div>`;
  assert.deepEqual(presentBuildSteps(page), [1, 2, 5]); assert.deepEqual(presentBuildSteps(page, true), [1, 5]);
});
test('focus follows click thresholds, Escape suppresses only the current visit step, and zero focuses on arrival', () => {
  const f = fixture();
  try {
    f.sync(1); assert.equal(f.controller.active, null);
    f.sync(2); assert.equal(f.controller.active, f.marker); assert.ok(f.marker.classList.contains('pr-interact-ring'));
    assert.equal(f.controller.key(new win.KeyboardEvent('keydown', { key: 'Escape' })), true);
    f.sync(2); assert.equal(f.controller.active, null);
    f.sync(3); f.sync(2); assert.equal(f.controller.active, f.marker);
    f.marker.dataset.interact = '0'; f.sync(0); assert.equal(f.controller.active, f.marker);
  } finally { f.close(); }
});
test('Up and Down reach the driver only during focus and Nothing preserves stack routing', () => {
  const f = fixture('keys=key');
  try {
    f.sync(1); assert.equal(f.controller.key(new win.KeyboardEvent('keydown', { key: 'ArrowDown' })), false);
    f.sync(2); assert.equal(f.controller.key(new win.KeyboardEvent('keydown', { key: 'ArrowUp' })), true);
    assert.ok(f.calls.some(([type, value]) => type === 'key' && value === 'ArrowUp'));
    assert.equal(f.controller.key(new win.KeyboardEvent('keydown', { key: 'PageDown' })), false);
  } finally { f.close(); }
  const none = fixture('keys=none'); try { none.sync(); assert.equal(none.controller.key(new win.KeyboardEvent('keydown', { key: 'ArrowDown' })), false); } finally { none.close(); }
});
test('walking stops is opt-in and releases navigation at either boundary', () => {
  const f = fixture('stops=0,400,1000;walk=1;ms=0');
  try {
    f.sync(); assert.equal(f.controller.walk(-1), false);
    assert.equal(f.controller.walk(1), true); assert.equal(f.y, 400);
    assert.equal(f.controller.walk(1), true); assert.equal(f.y, 1000);
    assert.equal(f.controller.walk(1), false);
    assert.equal(f.controller.walk(-1), true); assert.equal(f.y, 400);
  } finally { f.close(); }
  const normal = fixture('stops=0,400;ms=0'); try { normal.sync(); assert.equal(normal.controller.walk(1), false); } finally { normal.close(); }
  const blocked = fixture('stops=0,400;walk=1;ms=0');
  try { blocked.driver.capabilities.scroll = false; blocked.sync(); assert.equal(blocked.controller.walk(1), false); } finally { blocked.close(); }
});
test('zoom and spotlight preserve the existing frame; reduced motion chooses a stationary ring', () => {
  const zoom = fixture('hl=zoom');
  try { const frame = zoom.driver.frame; zoom.sync(); assert.ok(zoom.page.classList.contains('pr-interact-zoom')); assert.equal(zoom.marker.querySelector('iframe'), frame); zoom.controller.release(); assert.ok(!zoom.page.classList.contains('pr-interact-zoom')); } finally { zoom.close(); }
  const spot = fixture('hl=spotlight'); try { spot.sync(); assert.ok(spot.page.querySelector('.pr-interact-scrim')); assert.ok(spot.marker.parentElement!.classList.contains('pr-interact-layer')); spot.controller.release(); assert.equal(spot.page.querySelector('.pr-interact-scrim'), null); } finally { spot.close(); }
  const calm = fixture('hl=zoom', true); try { calm.sync(); assert.ok(calm.marker.classList.contains('pr-interact-ring')); assert.ok(!calm.page.classList.contains('pr-interact-zoom')); } finally { calm.close(); }
});
test('autoscroll stops for pause and manual takeover; overview releases focus without replacing the frame', () => {
  const f = fixture('auto=focus;from=0;to=1000;sec=1;ease=el;ms=0');
  try {
    f.sync(); f.tick(0); f.tick(100); assert.ok(f.y > 0); const before = f.y;
    f.sync(2, { paused: true }); f.tick(1000); assert.equal(f.y, before);
    f.sync(); f.tick(2000); assert.equal(f.y, before); f.tick(2100); assert.ok(f.y > before);
    f.controller.key(new win.KeyboardEvent('keydown', { key: 'ArrowUp' })); const manual = f.y; f.tick(2200); assert.equal(f.y, manual);
    f.sync(2, { overview: true, paused: true }); assert.equal(f.controller.active, null);
    f.sync(); assert.equal(f.controller.active, f.marker);
  } finally { f.close(); }
});
test('kiosk never arms a focus click but still runs arrival scrolling, and teardown cancels work', () => {
  const f = fixture('auto=open;to=1000;sec=1;ease=el', false, true);
  f.sync(); assert.equal(f.controller.active, null); f.tick(0); f.tick(100); assert.ok(f.y > 0);
  f.close(); assert.equal(f.callbacks.size, 0); assert.equal(f.subscribers.size, 0);
});
test('Enter is an explicit author opt-in and speaker controls name and release the page', () => {
  const f = fixture('hand=1');
  try {
    const speaker = document.createElement('div'); speaker.innerHTML = '<div class="pr-sp-aside"></div>'; f.stage.append(speaker);
    f.sync(); f.controller.speaker(speaker);
    assert.equal(speaker.querySelector('.pr-sp-interact-title')?.textContent, 'My demo');
    assert.equal(f.controller.key(new win.KeyboardEvent('keydown', { key: 'Enter' })), true);
    assert.ok(f.calls.some(([type, value]) => type === 'hand' && value === true));
    assert.match(speaker.querySelector('.pr-sp-interact-info')!.textContent!, /keyboard/);
    (speaker.querySelector('.pr-sp-interact button') as HTMLButtonElement).click(); assert.equal(f.controller.active, null);
  } finally { f.close(); }
  const none = fixture(); try { none.sync(); assert.equal(none.controller.key(new win.KeyboardEvent('keydown', { key: 'Enter' })), false); } finally { none.close(); }
});
test('the real deck uses focus steps in deep links and backward arrivals, swallows F5 and treats period as blackout', () => {
  const source = document.createElement('div');
  source.innerHTML = `<div class="lolly-frames"><div class="lolly-frame-page" data-frame-id="a" style="left:0px;top:0px;width:1920px;height:1080px"><div class="lolly-box-web" data-lolly-web="https://unknown.example/" data-interact="2" data-web-state="ask"></div></div><div class="lolly-frame-page" data-frame-id="b" style="left:2000px;top:0px;width:1920px;height:1080px">Second</div></div>`;
  document.body.append(source); const before = source.innerHTML;
  let step = 0;
  const deck = openPresentMode({ source, initial: 'a.2', onAddress: (_id, _index, build) => { step = build; } })!;
  const press = (key: string) => { const event = new win.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }); document.dispatchEvent(event); return event; };
  try {
    assert.ok(document.querySelector('.pr-interact-focus')); assert.equal(step, 2);
    assert.equal(press('F5').defaultPrevented, true); assert.equal(deck.frameId, 'a');
    press('.'); assert.ok(document.querySelector('.pr-blackout')); press('.'); assert.equal(document.querySelector('.pr-blackout'), null);
    press('PageDown'); assert.equal(deck.frameId, 'b'); press('PageUp'); assert.equal(deck.frameId, 'a'); assert.equal(step, 2); assert.ok(document.querySelector('.pr-interact-focus'));
    press('Escape'); assert.ok(document.querySelector('.pr-stage')); assert.equal(document.querySelector('.pr-interact-focus'), null);
  } finally { deck.close(); assert.equal(source.innerHTML, before); source.remove(); }
});

test('early loading follows Next through a stack and then to its next main slide', () => {
  const source = document.createElement('div');
  const page = (id: string, stack = '') => `<div class="lolly-frame-page" data-frame-id="${id}" ${stack ? `data-frame-stack="${stack}"` : ''} style="left:0px;top:0px;width:1920px;height:1080px"><div class="lolly-box-web" data-lolly-web="https://lolly.tools/info" data-web-load="early"></div></div>`;
  source.innerHTML = `<div class="lolly-frames">${page('a')}${page('b')}${page('a-stack', 'a')}</div>`;
  document.body.append(source); const deck = openPresentMode({ source, initial: 'a' })!;
  try {
    assert.ok(document.querySelector('.pr-page[data-frame-id="a"] iframe[data-web-live]'));
    assert.ok(document.querySelector('.pr-page[data-frame-id="a-stack"] iframe[data-web-live]'), 'the next stack member is warmed');
    assert.equal(document.querySelector('.pr-page[data-frame-id="b"] iframe[data-web-live]'), null, 'the later main slide stays parked');
    document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    assert.equal(deck.frameId, 'a-stack'); assert.ok(document.querySelector('.pr-page[data-frame-id="b"] iframe[data-web-live]'), 'the next main slide is now warmed');
  } finally { deck.close(); source.remove(); }
});

test('the autofocus guard gives up after three attempts and teardown removes its retry', async () => {
  const f = fixture(); let attempts = 0;
  try {
    f.sync(); f.stage.focus = () => { attempts++; };
    for (let n = 0; n < 5; n++) {
      f.driver.frame.focus(); win.dispatchEvent(new win.Event('blur'));
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    assert.equal(attempts, 3); assert.ok(f.stage.classList.contains('pr-embed-focus'));
    f.controller.destroy(); win.dispatchEvent(new win.Event('blur'));
    await new Promise(resolve => setTimeout(resolve, 5)); assert.equal(attempts, 3);
    assert.equal(f.subscribers.size, 0); assert.equal(f.callbacks.size, 0);
  } finally { f.close(); }
});
