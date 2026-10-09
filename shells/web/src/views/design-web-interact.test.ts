// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { webInteractRows, wireWebInteract } from './design-web-interact.ts';
import { createWebPageDriver } from '../lib/web-page-driver.ts';
import type { ModelPort } from './design-ports.ts';
import type { Box } from './free-canvas-math.ts';
import { parsePresentInteractOpts } from '../../../../engine/src/present-interact.ts';

function modeFixture(wire: string) {
  const dom = new JSDOM('<!doctype html><body><main></main><aside></aside></body>', { url: 'https://deck.test/' });
  const win = dom.window;
  for (const key of ['window', 'document', 'location', 'HTMLElement', 'HTMLInputElement', 'getComputedStyle']) {
    (globalThis as Record<string, unknown>)[key] = (win as unknown as Record<string, unknown>)[key];
  }
  const root = win.document.querySelector('aside')!, canvas = win.document.querySelector('main')!;
  let rows: Box[] = [{ id: 'demo', kind: 'web', web: 'https://outside.test/demo', interact: 2, interactOpts: wire }];
  const writes: string[] = [];
  let dispose = () => {};
  const paint = () => { dispose(); root.innerHTML = webInteractRows(rows[0]!); dispose = wireWebInteract(root, model, ['demo'], canvas); };
  const model: ModelPort = {
    blockId: 'boxes', cfg: { idField: 'id' } as ModelPort['cfg'], frame: null,
    getBoxes: () => rows, commit: next => { rows = next; writes.push(String(rows[0]!.interactOpts)); paint(); },
    setField: () => assert.fail('mode changes use a whole-row transaction'), subscribe: () => () => {},
    getInput: () => undefined, setInput: () => assert.fail('mode changes leave document inputs alone'),
  };
  paint();
  return { root, writes, win, options: () => parsePresentInteractOpts(rows[0]!.interactOpts)!,
    choose(mode: string) { const control = root.querySelector<HTMLSelectElement>('[data-web-interact="mode"]')!; control.value = mode; control.dispatchEvent(new win.Event('change', { bubbles: true })); },
    close() { dispose(); dom.window.close(); },
  };
}

test('mode changes retain compatible authored depths and normalize only incompatible coordinates', () => {
  const wire = 'hl=spotlight;mode=places;len=4200;start=150;from=%23kept;to=80%25;stops=0,%23intro,25%25,%23end;auto=focus;walk=1';
  for (const mode of ['places', 'pan']) {
    const f = modeFixture(wire);
    try {
      f.choose(mode); const opts = f.options(); assert.equal(f.writes.length, 1);
      assert.equal(opts.highlight, 'spotlight'); assert.equal(opts.auto, 'focus'); assert.equal(opts.walk, true); assert.equal(opts.pageLength, 4200);
      assert.deepEqual([opts.start, opts.from, opts.to, opts.stops], mode === 'places'
        ? ['#intro', '#kept', '#end', ['#intro', '#end']]
        : [150, 0, '80%', [0, '25%']]);
    } finally { f.close(); }
  }
});

test('Places asks for an authored page ID before committing when Pan has no anchors', () => {
  const f = modeFixture('hl=zoom;mode=pan;len=4200;start=150;from=20%25;to=80%25;stops=0,400;auto=focus');
  try {
    f.choose('places'); assert.equal(f.writes.length, 0); assert.equal(f.options().mode, 'pan');
    assert.equal(f.root.querySelector<HTMLSelectElement>('[data-web-interact="mode"]')!.value, 'pan');
    const first = f.root.querySelector<HTMLInputElement>('[data-web-places-start] input')!;
    assert.equal(f.win.document.activeElement, first);
    first.value = '640'; first.dispatchEvent(new f.win.Event('change', { bubbles: true })); assert.equal(f.writes.length, 0);
    first.value = '#intro'; first.dispatchEvent(new f.win.Event('change', { bubbles: true })); assert.equal(f.writes.length, 1);
    const places = f.options(); assert.deepEqual([places.mode, places.start, places.from, places.to, places.stops], ['places', '#intro', '#intro', '#intro', ['#intro']]);
    assert.equal(places.highlight, 'zoom'); assert.equal(places.auto, 'focus');
    f.choose('pan'); const pan = f.options(); assert.deepEqual([pan.start, pan.from, pan.to, pan.stops], [0, 0, '100%', []]);
    const count = f.writes.length; first.value = '#stale'; first.dispatchEvent(new f.win.Event('change', { bubbles: true })); assert.equal(f.writes.length, count);
  } finally { f.close(); }
});

test('Pan preview follows retained depth across repaint, driver changes and disposal without model writes', () => {
  const dom = new JSDOM('<!doctype html><body><main id="canvas"><div data-box-id="demo"><div class="lolly-box-web"><iframe data-web-live></iframe></div></div></main><aside id="inspector"></aside></body>', { url: 'https://deck.test/' });
  const win = dom.window;
  for (const key of ['window', 'document', 'location', 'HTMLElement', 'HTMLInputElement', 'getComputedStyle']) {
    (globalThis as Record<string, unknown>)[key] = (win as unknown as Record<string, unknown>)[key];
  }
  const canvas = win.document.querySelector<HTMLElement>('#canvas')!, root = win.document.querySelector<HTMLElement>('#inspector')!;
  const marker = canvas.querySelector<HTMLElement>('.lolly-box-web')!, frame = marker.querySelector('iframe')!;
  frame.src = 'https://outside.test/demo'; marker.dataset.webView = '1200'; marker.dataset.interactOpts = 'mode=pan;len=3200;start=640';
  Object.defineProperties(marker, { clientWidth: { value: 600 }, clientHeight: { value: 300 } });
  let rows: Box[] = [{ id: 'demo', kind: 'web', web: frame.src, interact: 2, interactOpts: marker.dataset.interactOpts }];
  let writes = 0, subscriptions = 0;
  const model: ModelPort = {
    blockId: 'boxes', cfg: { idField: 'id' } as ModelPort['cfg'], frame: null,
    getBoxes: () => rows, commit: next => { rows = next; writes++; }, setField: () => { writes++; },
    subscribe: () => () => {}, getInput: () => undefined, setInput: () => { writes++; },
  };
  const driver = createWebPageDriver(frame, marker);
  const subscribe = driver.subscribe.bind(driver);
  driver.subscribe = callback => {
    subscriptions++; const stop = subscribe(callback);
    return () => { subscriptions--; stop(); };
  };
  let dispose = () => {};
  const paint = () => {
    dispose(); root.innerHTML = webInteractRows(rows[0]!);
    dispose = wireWebInteract(root, model, ['demo'], canvas);
    return root.querySelector<HTMLInputElement>('[data-web-interact="preview"]')!;
  };
  try {
    let preview = paint(); assert.equal(subscriptions, 1); assert.equal(preview.disabled, false);
    assert.equal(Number(preview.value), 640 / 2600 * 100);
    driver.scrollTo('75%'); assert.equal(Number(preview.value), 75);
    const oldPreview = preview; preview = paint(); assert.equal(subscriptions, 1); assert.equal(Number(preview.value), 75);
    oldPreview.value = '0'; oldPreview.dispatchEvent(new win.Event('input', { bubbles: true }));
    assert.equal(driver.depth()!.y, 1950, 'disposed input cannot scroll the retained page');
    preview.value = '50'; preview.dispatchEvent(new win.Event('input', { bubbles: true }));
    assert.equal(driver.depth()!.y, 1300); assert.equal(writes, 0, 'preview does not author a depth or undo step');
    rows = rows.map(row => ({ ...row, interactOpts: 'mode=pan;len=4000;start=640' })); marker.dataset.interactOpts = rows[0]!.interactOpts as string;
    driver.configure(); preview = paint();
    assert.equal(Number(preview.value), 1300 / 3400 * 100);
    driver.destroy(); assert.equal(preview.disabled, true); assert.equal(subscriptions, 0);
    const nextFrame = win.document.createElement('iframe'); nextFrame.dataset.webLive = ''; nextFrame.src = frame.src;
    frame.replaceWith(nextFrame); const next = createWebPageDriver(nextFrame, marker);
    try {
      assert.equal(preview.disabled, false); assert.equal(Number(preview.value), 640 / 3400 * 100);
      next.scrollTo('100%'); assert.equal(Number(preview.value), 100);
      dispose(); next.scrollTo(0); assert.equal(Number(preview.value), 100, 'disposed preview has no depth listener');
    } finally { next.destroy(); }
    assert.equal(writes, 0);
  } finally { dispose(); driver.destroy(); dom.window.close(); }
});
