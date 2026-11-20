// SPDX-License-Identifier: MPL-2.0
/**
 * components/music-player.ts - the track picker's open and close on the shared
 * popover (components/body-popover.ts).
 *
 * The panel is a live part of the player, so the popover borrows it while open and
 * hands it back hidden on close. These pin what the in-flow panel did before: focus
 * goes to the search box on open and back to the trigger on Escape or a pick, the
 * dock's own Escape on document never hears the press that closes the panel, and the
 * panel sits 6px above the player at the player's width.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/components/music-player.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true, url: 'http://localhost/' });
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.Event = dom.window.Event;
g.CustomEvent = dom.window.CustomEvent;
g.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
g.requestAnimationFrame = (): number => 0;
g.localStorage = dom.window.localStorage;

const { trackPickerHtml, musicPlayerBodyHtml, wireMusicPlayerBody, placeTrackPanel } = await import('./music-player.ts');

const tick = (): Promise<void> => new Promise((resolve) => { setTimeout(resolve, 0); });

const host = {
  assets: {
    query: async () => [
      { id: 'demo/rain', type: 'audio', format: 'opus', url: '/rain.opus', meta: { name: 'Rain Study', tags: ['ambient'] } },
      { id: 'demo/tide', type: 'audio', format: 'opus', url: '/tide.opus', meta: { name: 'Slow Tide', tags: ['ambient'] } },
    ],
    get: async () => null,
  },
  profile: { get: async () => ({}), set: async () => ({}) },
};

async function mount(): Promise<{ wrap: HTMLElement; btn: HTMLButtonElement; picker: HTMLElement }> {
  const wrap = document.createElement('section');
  wrap.setAttribute('data-music-player', '');
  wrap.innerHTML = `<div>${trackPickerHtml()}</div>${musicPlayerBodyHtml({ meter: false, atmosphere: false })}`;
  document.body.append(wrap);
  wireMusicPlayerBody(wrap, host as never);
  await tick();
  await tick();
  return {
    wrap,
    btn: wrap.querySelector<HTMLButtonElement>('[data-mp-picker-btn]')!,
    picker: wrap.querySelector<HTMLElement>('[data-mp-picker]')!,
  };
}

test('the trigger opens the panel inside the picker and focus goes to the search box', async () => {
  const { wrap, btn, picker } = await mount();
  const panel = wrap.querySelector<HTMLElement>('[data-mp-panel]')!;
  btn.click();
  assert.equal(panel.hidden, false);
  assert.ok(panel.parentElement?.classList.contains('neuro-picker-pop'), 'the shared popover holds the live panel');
  assert.equal(panel.parentElement?.parentElement, picker, 'mounted in the picker, so the player still finds its rows');
  assert.equal(btn.getAttribute('aria-expanded'), 'true');
  assert.equal(picker.dataset.open, 'true');
  assert.equal(document.activeElement, wrap.querySelector('[data-mp-search]'));
  btn.click();
  assert.equal(panel.hidden, true, 'the trigger again closes it');
  assert.equal(panel.parentElement, picker, 'the panel goes home');
  assert.equal(document.querySelector('.neuro-picker-pop'), null);
  assert.equal(btn.getAttribute('aria-expanded'), 'false');
  assert.equal(picker.dataset.open, 'false');
  wrap.remove();
});

test('Escape closes only the panel and focus goes back to the trigger', async () => {
  const { wrap, btn } = await mount();
  let dock = 0;
  const onDock = (e: KeyboardEvent): void => { if (e.key === 'Escape') dock++; };
  document.addEventListener('keydown', onDock);
  try {
    btn.click();
    const search = wrap.querySelector<HTMLInputElement>('[data-mp-search]')!;
    search.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    assert.equal(wrap.querySelector<HTMLElement>('[data-mp-panel]')!.hidden, true);
    assert.equal(dock, 0, 'the dock keeps its Escape for the next press');
    assert.equal(document.activeElement, btn);
  } finally {
    document.removeEventListener('keydown', onDock);
    wrap.remove();
  }
});

test('an outside press closes the panel, a press inside leaves it open', async () => {
  const { wrap, btn } = await mount();
  btn.click();
  await tick();
  const panel = wrap.querySelector<HTMLElement>('[data-mp-panel]')!;
  wrap.querySelector('[data-mp-search]')!.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true }));
  assert.equal(panel.hidden, false);
  document.body.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true }));
  assert.equal(panel.hidden, true);
  wrap.remove();
});

test('Tab from the search box still goes to the first row', async () => {
  const { wrap, btn } = await mount();
  btn.click();
  const search = wrap.querySelector<HTMLInputElement>('[data-mp-search]')!;
  // jsdom lays nothing out, so offsetParent is null for every row: stand in for layout.
  const proto = dom.window.HTMLElement.prototype;
  const previous = Object.getOwnPropertyDescriptor(proto, 'offsetParent');
  Object.defineProperty(proto, 'offsetParent', { get: () => document.body, configurable: true });
  try {
    const tab = new dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    search.dispatchEvent(tab);
    assert.equal(tab.defaultPrevented, true);
    assert.ok((document.activeElement as HTMLElement).matches('.neuro-cat-head, .neuro-track'));
  } finally {
    if (previous) Object.defineProperty(proto, 'offsetParent', previous);
    btn.click();
    wrap.remove();
  }
});

test('placement: the width of the player, 6px above it, never above the viewport', () => {
  const box = document.createElement('section');
  const picker = document.createElement('div');
  const el = document.createElement('div');
  box.append(picker);
  document.body.append(box, el);
  Object.defineProperty(picker, 'offsetParent', { value: box, configurable: true });
  Object.defineProperty(box, 'clientWidth', { value: 338, configurable: true });
  box.style.borderTopWidth = '1px';
  box.style.borderLeftWidth = '1px';
  box.style.borderStyle = 'solid';
  box.getBoundingClientRect = () => ({ left: 1084, top: 700, right: 1424, bottom: 884, width: 340, height: 184, x: 1084, y: 700, toJSON: () => ({}) }) as DOMRect;
  let height = 330;
  el.getBoundingClientRect = () => {
    const left = Number.parseFloat(el.style.left);
    const top = Number.parseFloat(el.style.top);
    return { left, top, right: left + 338, bottom: top + height, width: 338, height, x: left, y: top, toJSON: () => ({}) } as DOMRect;
  };
  placeTrackPanel(el, picker);
  assert.equal(el.style.width, '338px');
  assert.equal(el.style.left, '1085px');
  assert.equal(el.style.top, `${701 - 6 - 330}px`);
  height = 900;
  placeTrackPanel(el, picker);
  assert.equal(el.style.top, '8px');
  box.remove();
  el.remove();
});
