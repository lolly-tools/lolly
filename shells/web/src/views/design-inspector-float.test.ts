// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { isDocked, releaseDock } from '../lib/edge-dock.ts';
import type { DesignInspectorHandle } from './design-inspector.ts';
import { DESIGN_INSPECTOR_FLOAT_KEY, wireDesignInspectorFloat } from './design-inspector-float.ts';

const dom = new JSDOM('<!doctype html><html><body><main id="view"></main></body></html>', {
  url: 'https://lolly.test/',
});
for (const key of [
  'window',
  'document',
  'HTMLElement',
  'Element',
  'Node',
  'Event',
  'MouseEvent',
  'PointerEvent',
  'localStorage',
  'getComputedStyle',
]) {
  const value = (dom.window as unknown as Record<string, unknown>)[key];
  if (value) (globalThis as Record<string, unknown>)[key] = value;
}
Object.defineProperty(dom.window, 'innerWidth', { configurable: true, value: 1280 });
Object.defineProperty(dom.window, 'innerHeight', { configurable: true, value: 900 });
globalThis.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
  dispatchEvent() {
    return false;
  },
})) as typeof matchMedia;
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
  dom.window.setTimeout(() => cb(0), 0)) as typeof requestAnimationFrame;
globalThis.cancelAnimationFrame = ((id: number) =>
  dom.window.clearTimeout(id)) as typeof cancelAnimationFrame;

function fixture(saved?: { mode: string; box: { x: number; y: number; w: number; h: number } }) {
  localStorage.clear();
  if (saved) localStorage.setItem(DESIGN_INSPECTOR_FLOAT_KEY, JSON.stringify(saved));
  document.querySelector('.edge-dock')?.remove();
  if (isDocked('inspector')) releaseDock('inspector', 'host');
  const el = document.createElement('aside');
  const head = document.createElement('header');
  head.className = 'fc-insp-headbar';
  const title = document.createElement('h2');
  title.textContent = 'Inspector';
  const close = document.createElement('button');
  close.dataset.actCol = 'close';
  head.append(title, close);
  el.append(head, document.createElement('div'));
  Object.defineProperty(el, 'getBoundingClientRect', {
    value: () => ({
      left: 900,
      top: 50,
      right: 1240,
      bottom: 850,
      width: 340,
      height: 800,
      x: 900,
      y: 50,
      toJSON() {},
    }),
  });
  let open = false;
  const inspector = {
    el,
    setOpen(value: boolean) {
      open = value;
      el.hidden = !value;
    },
    isOpen: () => open,
    sync() {},
    width: () => 0,
    reveal() {},
    destroy() {},
  } as unknown as DesignInspectorHandle;
  const changes: Array<[boolean, string]> = [];
  const handle = wireDesignInspectorFloat({
    inspector,
    head,
    isMobile: () => false,
    onOpenChange: (value, reason) => changes.push([value, reason]),
  });
  return { el, head, open: () => open, changes, handle };
}

test('Inspector moves between the one right dock and a persisted floating box', () => {
  const f = fixture();
  assert.equal(f.handle.setOpen(true), true);
  assert.equal(isDocked('inspector'), true);
  assert.equal(f.open(), true);
  const dock = f.el.querySelector<HTMLButtonElement>('[data-act-col="dock"]')!;
  assert.equal(dock.hidden, true);
  assert.equal(f.el.querySelector('[data-act-col="detach"], [data-act-col="maximize"]'), null);

  for (const type of ['pointerdown', 'pointermove', 'pointerup']) {
    f.head.dispatchEvent(new dom.window.MouseEvent(type, { clientX: 400, clientY: 200, bubbles: true, button: 0 }));
  }
  assert.equal(isDocked('inspector'), false);
  assert.equal(f.handle.mode(), 'floating');
  assert.equal(f.el.parentElement, document.body);
  assert.ok(f.el.classList.contains('is-floating'));
  assert.equal(dock.hidden, false);

  dock.click();
  assert.equal(isDocked('inspector'), true);
  assert.equal(f.handle.mode(), 'edge');
  assert.equal(dock.hidden, true);
  assert.match(localStorage.getItem(DESIGN_INSPECTOR_FLOAT_KEY) || '', /"mode":"edge"/);

  assert.equal(f.handle.setOpen(false), false);
  assert.equal(isDocked('inspector'), false);
  assert.equal(f.el.isConnected, false);
  assert.deepEqual(f.changes.at(-1), [false, 'user']);
  f.handle.destroy();
});

test('a saved full-height Inspector remains movable and resizable without header arrows', () => {
  const f = fixture({ mode: 'maximized', box: { x: 500, y: 8, w: 340, h: 884 } });
  f.handle.setOpen(true);
  assert.equal(f.handle.mode(), 'floating');
  assert.equal(isDocked('inspector'), false);
  assert.equal(f.el.style.height, '884px');
  assert.equal(f.el.querySelector('[data-act-col="maximize"]'), null);
  assert.equal(f.el.querySelectorAll('.panel-grip').length, 8);
  f.head.dispatchEvent(new dom.window.MouseEvent('pointerdown', { clientX: 500, clientY: 30, bubbles: true, button: 0 }));
  f.head.dispatchEvent(new dom.window.MouseEvent('pointermove', { clientX: 400, clientY: 30, bubbles: true, button: 0 }));
  f.head.dispatchEvent(new dom.window.MouseEvent('pointerup', { clientX: 400, clientY: 30, bubbles: true, button: 0 }));
  assert.equal(f.el.style.left, '400px');
  f.handle.dock();
  assert.equal(isDocked('inspector'), true);
  f.handle.destroy();
  assert.equal(isDocked('inspector'), false);
  assert.equal(f.el.isConnected, false);
});
