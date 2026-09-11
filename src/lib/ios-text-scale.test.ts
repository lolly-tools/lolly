// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { mountIOSTextScale } from './ios-text-scale.ts';

test('Dynamic Type applies smaller, default and accessibility sizes live, including resume', t => {
  const dom = new JSDOM('<!doctype html>', { pretendToBeVisual: true });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document });
  let bodySize = 15;
  let resize: (() => void) | undefined;
  let disconnected = false;
  const previous = { getComputedStyle: globalThis.getComputedStyle, ResizeObserver: globalThis.ResizeObserver };
  globalThis.getComputedStyle = (() => ({ fontSize: `${bodySize}px` })) as unknown as typeof getComputedStyle;
  globalThis.ResizeObserver = class {
    constructor(cb: () => void) { resize = cb; }
    observe() {}
    disconnect() { disconnected = true; }
  } as unknown as typeof ResizeObserver;
  const root = document.documentElement;
  root.dataset.a11yText = 'large';
  const destroy = mountIOSTextScale();
  t.after(() => { destroy(); Object.assign(globalThis, previous); dom.window.close(); });
  const scale = (): number => Number(root.style.getPropertyValue('--a11y-os-fs'));
  assert.ok(Math.abs(scale() - 15 / 17) < 0.0001);
  bodySize = 53; resize!();
  assert.ok(Math.abs(scale() - 53 / 17) < 0.0001, 'accessibility categories are not capped at 1.5');
  assert.ok(root.hasAttribute('data-ios-large-type'), 'large native sizes enable toolbar reflow');
  bodySize = 17; window.dispatchEvent(new window.Event('focus'));
  assert.equal(scale(), 1, 'returning to default clears the previous enlargement');
  assert.equal(root.hasAttribute('data-ios-large-type'), false);
  bodySize = 23; window.dispatchEvent(new window.Event('pageshow'));
  assert.ok(Math.abs(scale() - 23 / 17) < 0.0001);
  bodySize = 14; document.dispatchEvent(new window.Event('visibilitychange'));
  assert.ok(scale() < 1);
  assert.equal(root.style.getPropertyValue('--a11y-fs'), '', 'Large text still composes in CSS');
  assert.equal(root.dataset.a11yText, 'large');
  bodySize = NaN; resize!();
  assert.ok(Number.isFinite(scale()), 'bad measurements do not poison inherited CSS');
  destroy();
  assert.equal(disconnected, true);
  assert.equal(root.querySelector('span'), null);
});
