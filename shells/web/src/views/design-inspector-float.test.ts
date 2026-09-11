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

function fixture() {
  localStorage.clear();
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

  (f.el.querySelector('[data-act-col="detach"]') as HTMLButtonElement).click();
  assert.equal(isDocked('inspector'), false);
  assert.equal(f.handle.mode(), 'floating');
  assert.equal(f.el.parentElement, document.body);
  assert.ok(f.el.classList.contains('is-floating'));

  (f.el.querySelector('[data-act-col="dock"]') as HTMLButtonElement).click();
  assert.equal(isDocked('inspector'), true);
  assert.equal(f.handle.mode(), 'edge');
  assert.match(localStorage.getItem(DESIGN_INSPECTOR_FLOAT_KEY) || '', /"mode":"edge"/);

  assert.equal(f.handle.setOpen(false), false);
  assert.equal(isDocked('inspector'), false);
  assert.equal(f.el.isConnected, false);
  assert.deepEqual(f.changes.at(-1), [false, 'user']);
  f.handle.destroy();
});

test('maximise and restore use the same live Inspector, then teardown clears the dock', () => {
  const f = fixture();
  f.handle.setOpen(true);
  (f.el.querySelector('[data-act-col="maximize"]') as HTMLButtonElement).click();
  assert.equal(f.handle.mode(), 'maximized');
  assert.equal(isDocked('inspector'), false);
  assert.ok(f.el.classList.contains('is-maximized'));
  (f.el.querySelector('[data-act-col="maximize"]') as HTMLButtonElement).click();
  assert.equal(f.handle.mode(), 'floating');
  f.handle.dock();
  assert.equal(isDocked('inspector'), true);
  f.handle.destroy();
  assert.equal(isDocked('inspector'), false);
  assert.equal(f.el.isConnected, false);
});
