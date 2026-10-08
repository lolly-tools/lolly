// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://lolly.tools/' });
const win = dom.window as unknown as Window & typeof globalThis;
globalThis.window = win; globalThis.document = win.document; globalThis.Element = win.Element;
const { clickerSignature, parseClickerMap, clickerKey, clickerPanelHtml, wireClickerPanel, CLICKER_STORAGE_KEY } = await import('./present-clicker.ts');

test('stored maps are bounded, prototype-safe and cannot override Escape or browser shortcuts', () => {
  const map = parseClickerMap('{"x":"next","Escape":"blackout","Tab":"next","F5":"previous","__proto__":"up","constructor":"down","q":"bad"}');
  assert.equal(Object.getPrototypeOf(map), null); assert.deepEqual(Object.entries(map), [['x', 'next']]);
  assert.deepEqual(Object.keys(parseClickerMap('not json')), []);
  assert.deepEqual(Object.keys(parseClickerMap(JSON.stringify(Array(17).fill('next')))), []);
  assert.equal(clickerSignature(new win.KeyboardEvent('keydown', { key: 'r', ctrlKey: true })), null);
  win.localStorage.setItem(CLICKER_STORAGE_KEY, JSON.stringify(map));
  assert.equal(clickerKey(new win.KeyboardEvent('keydown', { key: 'x' })), 'PageDown');
  assert.equal(clickerKey(new win.KeyboardEvent('keydown', { key: 'x', ctrlKey: true })), 'x');
  assert.equal(clickerKey(new win.KeyboardEvent('keydown', { key: 'Escape' })), 'Escape');
  win.localStorage.clear();
});
test('testing requires an explicit start, remembers a chosen button, and restores keys on close', () => {
  const root = document.createElement('div'); root.innerHTML = clickerPanelHtml(); document.body.append(root);
  const panel = root.querySelector('details')!; panel.open = true;
  const dispose = wireClickerPanel(root);
  const press = (key: string) => { const event = new win.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }); document.dispatchEvent(event); return event; };
  try {
    assert.equal(press('x').defaultPrevented, false);
    (root.querySelector('[data-clicker-test]') as HTMLButtonElement).click();
    assert.equal(press('x').defaultPrevented, true); assert.match(root.querySelector('[data-clicker-result]')!.textContent!, /x/);
    const action = root.querySelector('[data-clicker-action]') as HTMLSelectElement; action.value = 'next'; action.dispatchEvent(new win.Event('change'));
    const save = root.querySelector('[data-clicker-save]') as HTMLButtonElement; assert.equal(save.disabled, false); save.click();
    assert.equal(clickerKey(new win.KeyboardEvent('keydown', { key: 'x' })), 'PageDown');
    assert.equal(press('x').defaultPrevented, false, 'remembering stops the deliberate test');
    (root.querySelector('[data-clicker-test]') as HTMLButtonElement).click();
    assert.equal(press('Escape').defaultPrevented, false); assert.equal(press('Tab').defaultPrevented, false);
    assert.equal(press('F5').defaultPrevented, true); assert.equal(save.disabled, true, 'F5 cannot be assigned');
    dispose(); assert.equal(press('x').defaultPrevented, false);
  } finally { dispose(); root.remove(); win.localStorage.clear(); }
});
test('reset removes only the clicker preference and typing in a selector remains normal', () => {
  win.localStorage.setItem('lolly-other-preference', 'kept'); win.localStorage.setItem(CLICKER_STORAGE_KEY, '{"x":"next"}');
  const root = document.createElement('div'); root.innerHTML = clickerPanelHtml(); document.body.append(root); root.querySelector('details')!.open = true;
  const dispose = wireClickerPanel(root);
  try {
    (root.querySelector('[data-clicker-test]') as HTMLButtonElement).click();
    const event = new win.KeyboardEvent('keydown', { key: 'x', bubbles: true, cancelable: true }); root.querySelector('select')!.dispatchEvent(event); assert.equal(event.defaultPrevented, false);
    (root.querySelector('[data-clicker-reset]') as HTMLButtonElement).click();
    assert.equal(win.localStorage.getItem(CLICKER_STORAGE_KEY), null); assert.equal(win.localStorage.getItem('lolly-other-preference'), 'kept');
  } finally { dispose(); root.remove(); win.localStorage.clear(); }
});
