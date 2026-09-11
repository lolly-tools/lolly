// SPDX-License-Identifier: MPL-2.0
/**
 * The WebKit box-shadow capture fix: the conversion math and the in-place
 * bake/restore, in jsdom. The engine-level truth (that WebKit's dom-to-image
 * centres offset box-shadows and captures drop-shadow correctly) is the measured
 * finding this module exists for and cannot be re-proven headlessly.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { bakeWebKitBoxShadows, boxShadowToDropShadows, isWebKitCapture } from './webkit-shadow-bake.ts';

const SAFARI_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
const CHROME_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

test('isWebKitCapture: Safari yes, Chromium (which also says AppleWebKit) no', () => {
  assert.equal(isWebKitCapture(SAFARI_UA), true);
  assert.equal(isWebKitCapture(CHROME_UA), false);
  assert.equal(isWebKitCapture(''), false);
});

test('an offset shadow converts, colour first or last, blur carried', () => {
  assert.deepEqual(boxShadowToDropShadows('rgb(10, 20, 30) 4px 8px 12px 0px'),
    { filter: 'drop-shadow(4px 8px 12px rgb(10, 20, 30))', keep: '' });
  assert.deepEqual(boxShadowToDropShadows('4px 8px 12px rgba(0, 0, 0, 0.4)'),
    { filter: 'drop-shadow(4px 8px 12px rgba(0, 0, 0, 0.4))', keep: '' });
});

test('centred glows and inset shadows stay as box-shadow; spread is dropped', () => {
  assert.equal(boxShadowToDropShadows('rgb(0, 0, 0) 0px 0px 20px 4px'), null, 'a centred glow captures fine');
  assert.equal(boxShadowToDropShadows('rgb(0, 0, 0) 2px 2px 4px 0px inset'), null, 'inset cannot become drop-shadow');
  // A mixed list: the offset outer converts, the inset stays behind.
  const mixed = boxShadowToDropShadows('rgb(1, 2, 3) 6px 6px 10px 0px, rgb(9, 9, 9) 1px 1px 2px 0px inset');
  assert.equal(mixed?.filter, 'drop-shadow(6px 6px 10px rgb(1, 2, 3))');
  assert.equal(mixed?.keep, 'rgb(9, 9, 9) 1px 1px 2px 0px inset');
  // Spread has no analog: 8px of spread vanishes, the offsets and blur survive.
  assert.equal(boxShadowToDropShadows('rgb(0, 0, 0) 3px 5px 7px 8px')?.filter,
    'drop-shadow(3px 5px 7px rgb(0, 0, 0))');
});

test('bake mutates in place on WebKit only, and restore puts every byte back', () => {
  const dom = new JSDOM('<div id="a" style="box-shadow: rgb(1, 2, 3) 4px 8px 12px 0px"><span id="b" style="box-shadow: none"></span></div>');
  const root = dom.window.document.getElementById('a') as HTMLElement;

  // Off WebKit: identity - nothing changes.
  const noop = bakeWebKitBoxShadows(root, CHROME_UA);
  assert.ok(root.style.boxShadow.includes('4px'));
  noop();

  const restore = bakeWebKitBoxShadows(root, SAFARI_UA);
  assert.equal(root.style.boxShadow, 'none', 'the offset shadow left box-shadow');
  assert.ok(root.style.filter.includes('drop-shadow(4px 8px 12px'), `filter carries it: ${root.style.filter}`);
  restore();
  assert.ok(root.style.boxShadow.includes('4px 8px 12px'), 'restored');
  assert.equal(root.style.filter, '', 'the filter went back to empty');
});
