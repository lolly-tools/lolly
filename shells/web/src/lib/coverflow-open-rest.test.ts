// SPDX-License-Identifier: MPL-2.0
/**
 * Cover Flow's Open control is shown only while the fan rests (lib/coverflow-open-rest.ts).
 *
 *   node --test shells/web/src/lib/coverflow-open-rest.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { OPEN_REST_MS, showOpenAtRest } from './coverflow-open-rest.ts';

const dom = new JSDOM('<!doctype html><html><body><div id="v"></div><button id="b"></button></body></html>');
const viewport = dom.window.document.getElementById('v') as unknown as HTMLElement;
const button = dom.window.document.getElementById('b') as unknown as HTMLElement;
const scroll = (): void => { viewport.dispatchEvent(new dom.window.Event('scroll')); };

test('Open waits for the fan to rest, hides when it moves and comes back', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const ac = new dom.window.AbortController();
  showOpenAtRest(viewport, button, ac.signal);
  assert.equal(button.classList.contains('is-on'), false, 'not shown the moment the fan mounts');
  t.mock.timers.tick(OPEN_REST_MS);
  assert.equal(button.classList.contains('is-on'), true, 'shown once a cover has rested');
  scroll();
  assert.equal(button.classList.contains('is-on'), false, 'out of the way while the fan moves');
  t.mock.timers.tick(OPEN_REST_MS - 1);
  scroll();
  t.mock.timers.tick(OPEN_REST_MS - 1);
  assert.equal(button.classList.contains('is-on'), false, 'each movement restarts the wait');
  t.mock.timers.tick(1);
  assert.equal(button.classList.contains('is-on'), true);
  ac.abort();
});

test('a torn-down strip never shows the control later', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  button.classList.remove('is-on');
  const ac = new dom.window.AbortController();
  showOpenAtRest(viewport, button, ac.signal);
  ac.abort();
  t.mock.timers.tick(OPEN_REST_MS * 2);
  assert.equal(button.classList.contains('is-on'), false);
});
