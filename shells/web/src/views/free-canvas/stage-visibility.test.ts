// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { readGuideVisibility, setGuidesVisible } from './stage.ts';
import type { FcCtx } from './context.ts';

test('Design starts without rulers and guides, and remembers explicit visibility choices', () => {
  const dom = new JSDOM('', { url: 'https://lolly.test/' });
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: dom.window.localStorage });
  const shown: boolean[] = [];
  const fc = {
    GUIDE_VISIBILITY_KEY: 'lolly-design-guides-visible',
    authoringGuides: { setVisible: (visible: boolean) => shown.push(visible) },
  } as unknown as FcCtx;
  try {
    assert.equal(readGuideVisibility(fc), false, 'no saved choice starts off');
    setGuidesVisible(fc, true);
    assert.equal(readGuideVisibility(fc), true, 'a previous opt-in stays on');
    setGuidesVisible(fc, false);
    assert.equal(readGuideVisibility(fc), false, 'an explicit opt-out stays off');
    assert.deepEqual(shown, [true, false]);
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Storage unavailable'); } });
    assert.equal(readGuideVisibility(fc), false, 'unavailable storage keeps the default off');
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
    dom.window.close();
  }
});
