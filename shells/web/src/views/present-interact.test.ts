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
  let retainedDriver = driver;
  const controller = mountPresentInteract({ stage, pages: [page], reduced, kiosk, load: () => { calls.push(['load', true]); }, driver: () => retainedDriver });
  const sync = (build = 2, extras = {}) => controller.sync({ index: 0, build, overview: false, paused: false, ...extras });
  const close = () => { controller.destroy(); stage.remove(); };
  return { stage, page, marker, driver, controller, calls, sync, tick, close, callbacks, subscribers,
    movePage(value: number) { y = value; for (const callback of subscribers) callback(); },
    replaceDriver() { retainedDriver = { ...driver }; }, get y() { return y; } };
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

test('walking repeated and clamped stops preserves the speaker index in both directions', () => {
  for (const [settings, depths] of [
    ['stops=0,400,0,800;walk=1;ms=0', [400, 0, 800]],
    ['stops=0,2000,3000,800;walk=1;ms=0', [1000, 1000, 800]],
  ] as const) {
    const f = fixture(settings);
    const speaker = document.createElement('div'); speaker.innerHTML = '<div class="pr-sp-aside"></div>'; f.stage.append(speaker);
    try {
      f.sync(); f.controller.speaker(speaker);
      for (const [index, depth] of depths.entries()) {
        assert.equal(f.controller.walk(1), true); assert.equal(f.y, depth);
        assert.equal(speaker.querySelector('.pr-sp-interact-depth')?.textContent, `Stop ${index + 2} of 4`);
      }
      assert.equal(f.controller.walk(1), false);
      for (const [index, depth] of [depths[1], depths[0], 0].entries()) {
        assert.equal(f.controller.walk(-1), true); assert.equal(f.y, depth);
        assert.equal(speaker.querySelector('.pr-sp-interact-depth')?.textContent, `Stop ${3 - index} of 4`);
      }
      assert.equal(f.controller.walk(-1), false);
    } finally { f.close(); }
  }
});

test('native movement, keyboard handover and a fresh driver discard the stored stop', () => {
  const f = fixture('stops=0,400,0,800;walk=1;ms=0;keys=key;hand=1');
  try {
    f.sync(); f.controller.walk(1); f.controller.walk(1);
    f.controller.key(new win.KeyboardEvent('keydown', { key: 'ArrowDown' }));
    assert.equal(f.controller.walk(1), true); assert.equal(f.y, 400);
    f.controller.walk(1);
    f.controller.key(new win.KeyboardEvent('keydown', { key: 'Enter' })); f.controller.returnKeyboard();
    assert.equal(f.controller.walk(1), true); assert.equal(f.y, 400);
    f.controller.walk(1); f.controller.walk(1); f.movePage(200);
    assert.equal(f.controller.walk(1), true); assert.equal(f.y, 400);
    f.controller.walk(1); f.driver.frame.dispatchEvent(new win.Event('load'));
    assert.equal(f.controller.walk(1), true); assert.equal(f.y, 400);
    f.controller.walk(1); f.replaceDriver(); f.sync(); assert.equal(f.y, 0);
    assert.equal(f.controller.walk(1), true); assert.equal(f.y, 400);
  } finally { f.close(); }
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
test('reduced motion without stops keeps Start at and leaves no automatic frame work', () => {
  const f = fixture('auto=focus;start=640;from=0;to=1000;sec=1;rep=loop;ms=0', true);
  try {
    f.sync(2, { paused: true }); assert.equal(f.y, 640); assert.equal(f.callbacks.size, 0);
    f.sync(); f.tick(0); assert.equal(f.y, 640);
    // A synchronous depth reply can leave one already queued notification frame.
    f.tick(16); assert.equal(f.callbacks.size, 0);
    const scrolls = f.calls.filter(([kind]) => kind === 'scroll').length;
    f.tick(1000); f.sync(); assert.equal(f.y, 640);
    assert.equal(f.calls.filter(([kind]) => kind === 'scroll').length, scrolls); assert.equal(f.callbacks.size, 0);
  } finally { f.close(); }
});
test('a delayed receiver starts automatic scrolling only after its capabilities and depth arrive', () => {
  const f = fixture('auto=focus;from=0;to=1000;sec=1;ease=el;ms=0');
  const readDepth = f.driver.depth;
  let depthReady = false;
  f.driver.depth = () => depthReady ? readDepth() : null;
  Object.assign(f.driver.capabilities, { backend: 'outside', scroll: false, depth: false, checking: true });
  const notify = () => { for (const callback of f.subscribers) callback(); };
  try {
    f.sync(); assert.equal(f.callbacks.size, 0);
    for (let time = 0; time <= 1500; time += 100) f.tick(time);
    Object.assign(f.driver.capabilities, { backend: 'receiver', scroll: true, depth: true, checking: false });
    notify(); f.tick(2000); assert.equal(f.callbacks.size, 0);
    depthReady = true; notify(); assert.equal(f.callbacks.size, 1);
    f.tick(20_000); assert.equal(f.y, 0);
    f.tick(20_100); assert.ok(f.y > 0 && f.y < 1000);
    for (let time = 20_200; time <= 21_100; time += 100) f.tick(time);
    assert.equal(f.y, 1000); assert.equal(f.callbacks.size, 0);
    notify(); f.sync(); assert.equal(f.callbacks.size, 0);
  } finally { f.close(); }
});
test('receiver readiness interruptions freeze elapsed time without restarting a visit', () => {
  const f = fixture('auto=open;from=0;to=1000;sec=1;ease=el;ms=0');
  const notify = () => { for (const callback of f.subscribers) callback(); };
  try {
    f.sync(); f.tick(0); f.tick(100); const before = f.y; assert.ok(before > 0 && before < 1000);
    Object.assign(f.driver.capabilities, { backend: 'receiver', scroll: false, checking: true });
    notify(); f.tick(5000); assert.equal(f.y, before); assert.equal(f.callbacks.size, 0);
    Object.assign(f.driver.capabilities, { scroll: true, checking: false });
    notify(); f.tick(10_000); assert.equal(f.y, before);
    f.tick(10_100); assert.ok(f.y > before && f.y < 1000);
    f.controller.key(new win.KeyboardEvent('keydown', { key: 'ArrowUp' }));
    f.tick(10_200); const depth = f.y;
    notify(); f.tick(10_300); assert.equal(f.y, depth); assert.equal(f.callbacks.size, 0);
  } finally { f.close(); }
});
test('Places and Pan automatic routes do not wait for receiver depth', () => {
  for (const backend of ['outside', 'receiver'] as const) {
    const f = fixture('auto=open;mode=places;stops=%23intro,%23end;sec=1;ms=0');
    f.driver.depth = () => null;
    Object.assign(f.driver.capabilities, { backend, depth: false, checking: backend === 'outside' });
    try {
      f.sync(); f.tick(0); assert.ok(f.calls.some(([kind, value]) => kind === 'scroll' && value === '#intro'));
      for (let time = 100; time <= 1100; time += 100) f.tick(time);
      assert.ok(f.calls.some(([kind, value]) => kind === 'scroll' && value === '#end')); assert.equal(f.callbacks.size, 0);
    } finally { f.close(); }
  }
  const pan = fixture('auto=open;mode=pan;len=1400;to=1000;sec=1;ease=el;ms=0');
  Object.assign(pan.driver.capabilities, { backend: 'outside', checking: true });
  try { pan.sync(); pan.tick(0); pan.tick(100); assert.ok(pan.y > 0 && pan.y < 1000); } finally { pan.close(); }
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

test('focused presentation controls keep native activation and browser modifiers bypass deck shortcuts', () => {
  const source = document.createElement('div');
  source.innerHTML = '<div class="lolly-frames"><div class="lolly-frame-page" data-frame-id="a" style="width:1280px;height:720px"><div data-interact="0"></div></div><div class="lolly-frame-page" data-frame-id="b" style="width:1280px;height:720px">Second</div></div>';
  document.body.append(source); const deck = openPresentMode({ source, initial: 'a' })!;
  const press = (target: EventTarget, key: string, mods: KeyboardEventInit = {}) => {
    const event = new win.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...mods }); target.dispatchEvent(event); return event;
  };
  let editorKeys = 0; const editor = () => { editorKeys++; }; document.addEventListener('keydown', editor);
  try {
    const pause = document.querySelector<HTMLButtonElement>('.pr-hud [aria-label="Pause"]')!; pause.focus();
    for (const key of [' ', 'Enter']) {
      assert.equal(press(pause, key).defaultPrevented, false); assert.equal(deck.frameId, 'a'); assert.equal(editorKeys, 0);
    }
    assert.equal(press(pause, 'ArrowRight').defaultPrevented, true); assert.equal(deck.frameId, 'b'); assert.equal(editorKeys, 0);
    const stage = document.querySelector<HTMLElement>('.pr-stage')!; stage.focus();
    for (const mods of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }]) {
      for (const key of ['f', 's', 'o', 'b', 'Enter', 'ArrowLeft', 'ArrowUp', ' ']) {
        assert.equal(press(stage, key, mods).defaultPrevented, false, `${JSON.stringify(mods)} ${key}`);
        assert.equal(deck.frameId, 'b'); assert.equal(document.querySelector('.pr-blackout'), null);
      }
      assert.equal(press(stage, 'F5', mods).defaultPrevented, true, 'F5 remains reload-safe with modifiers');
    }
    assert.equal(press(stage, 'Tab').defaultPrevented, true, 'the fallback trap keeps focus on its controls');
    for (const selector of ['.pr-tap-prev', '.pr-tap-next']) {
      press(stage, '.'); assert.ok(stage.classList.contains('pr-blackout'));
      document.querySelector<HTMLButtonElement>(selector)!.click();
      assert.equal(stage.classList.contains('pr-blackout'), false); assert.equal(deck.frameId, 'b');
    }
  } finally { document.removeEventListener('keydown', editor); deck.close(); source.remove(); }
});

test('explicit Enter handover shows Back without relying on a parent window blur event', () => {
  const source = document.createElement('div');
  source.innerHTML = '<div class="lolly-frame-page" data-frame-id="a" style="width:1280px;height:720px"><div class="lolly-box-web" data-lolly-web="https://lolly.tools/info" data-interact="0" data-interact-opts="hand=1"></div></div>';
  document.body.append(source); const deck = openPresentMode({ source })!;
  try {
    const stage = document.querySelector<HTMLElement>('.pr-stage')!;
    assert.equal(stage.classList.contains('pr-embed-focus'), false);
    stage.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    assert.equal(document.activeElement?.tagName, 'IFRAME');
    assert.equal(stage.classList.contains('pr-embed-focus'), true);
    document.querySelector<HTMLButtonElement>('.pr-embed-return')!.click();
    assert.equal(document.activeElement, stage); assert.equal(stage.classList.contains('pr-embed-focus'), false);
  } finally { deck.close(); source.remove(); }
});

test('speaker status distinguishes pause and blackout; closing restores focus and prior inert state', () => {
  const source = document.createElement('div'); source.innerHTML = '<div class="lolly-frame-page" data-frame-id="a" style="width:1280px;height:720px"><div data-interact="0"></div></div>';
  const opener = document.createElement('button'); opener.textContent = 'Present';
  const prior = document.createElement('div'); prior.inert = true;
  document.body.append(opener, source, prior); opener.focus();
  const open = win.open; win.open = (() => null) as typeof win.open;
  const deck = openPresentMode({ source })!;
  const press = (key: string) => document.dispatchEvent(new win.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  try {
    assert.equal(opener.inert, true); deck.speaker();
    const status = () => document.querySelector<HTMLElement>('.pr-sp-status')!;
    assert.equal(status().getAttribute('role'), 'status'); assert.equal(status().textContent, 'Playing.');
    press('k'); assert.equal(status().textContent, 'Paused.'); assert.equal(status().dataset.state, 'paused');
    press('b'); assert.equal(status().textContent, 'Blackout'); assert.equal(status().dataset.state, 'blackout');
    press(' '); assert.equal(status().textContent, 'Paused.');
    press('k'); assert.equal(status().textContent, 'Playing.');
    deck.close(); assert.equal(opener.inert, false); assert.equal(prior.inert, true); assert.equal(document.activeElement, opener);
  } finally { deck.close(); win.open = open; opener.remove(); source.remove(); prior.remove(); }
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

test('child focus observation rejects scripted pointer handover and releases old documents on navigation', async () => {
  const f = fixture('hand=1'); let attempts = 0;
  f.stage.focus = () => { attempts++; };
  const tick = () => new Promise(resolve => setTimeout(resolve, 5));
  try {
    f.sync(); const old = f.driver.frame.contentDocument!; f.driver.frame.focus(); await tick();
    f.driver.frame.src = 'https://lolly.tools/another-demo';
    f.driver.frame.dispatchEvent(new win.Event('load')); const fresh = f.driver.frame.contentDocument!;
    const before = attempts; old.dispatchEvent(new win.FocusEvent('focusin')); await tick(); assert.equal(attempts, before);
    fresh.dispatchEvent(new win.MouseEvent('pointerdown', { bubbles: true }));
    fresh.dispatchEvent(new win.FocusEvent('focusin')); await tick();
    assert.equal(attempts, before + 1); assert.ok(!f.calls.some(([type, value]) => type === 'hand' && value === true));
    f.controller.destroy(); fresh.dispatchEvent(new win.FocusEvent('focusin')); await tick(); assert.equal(attempts, before + 1);
  } finally { f.close(); }
});
