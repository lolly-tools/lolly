// SPDX-License-Identifier: MPL-2.0
/**
 * Dominant hand (lib/hand-pref.ts): the attribute, the FOUC mirror, profile
 * hydration and persistence, the change event.
 *
 * Run directly:  node --test shells/web/src/lib/hand-pref.test.ts
 *
 * Right is the default and must leave NO trace: no attribute, no mirror key, so a
 * page where nobody chose a hand is byte-identical to one without this module.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;

const { HAND_STORE_KEY, HAND_CHANGE_EVENT, applyHand, currentHand, hydrateHand, readHand, setHand, onHandChange } = await import('./hand-pref.ts');

const root = (): HTMLElement => document.documentElement;
function reset(): void {
  delete root().dataset.hand;
  localStorage.clear();
}
const events: string[] = [];
window.addEventListener(HAND_CHANGE_EVENT, () => events.push(currentHand()));

test('the default leaves no trace: no attribute, no mirror, reads right', () => {
  reset();
  const before = root().outerHTML;
  applyHand('right');
  applyHand(undefined);
  assert.equal(root().outerHTML, before);
  assert.equal(root().hasAttribute('data-hand'), false);
  assert.equal(localStorage.getItem(HAND_STORE_KEY), null);
  assert.equal(currentHand(), 'right');
});

test('left sets the attribute and the mirror; right removes both', () => {
  reset();
  applyHand('left');
  assert.equal(root().getAttribute('data-hand'), 'left');
  assert.equal(localStorage.getItem(HAND_STORE_KEY), 'left');
  assert.equal(currentHand(), 'left');
  applyHand('right');
  assert.equal(root().hasAttribute('data-hand'), false);
  assert.equal(localStorage.getItem(HAND_STORE_KEY), null);
});

test('the change event fires on a real change only', () => {
  reset();
  events.length = 0;
  applyHand('right');
  applyHand('left');
  applyHand('left');
  applyHand('right');
  assert.deepEqual(events, ['left', 'right']);
});

test('hydrate: an untouched profile leaves the mirror standing; an explicit value wins', () => {
  reset();
  applyHand('left');
  hydrateHand(undefined);
  assert.equal(currentHand(), 'left', 'nothing in the profile keeps the device choice');
  hydrateHand('right');
  assert.equal(currentHand(), 'right');
  hydrateHand('left');
  assert.equal(currentHand(), 'left');
  hydrateHand('sideways');
  assert.equal(currentHand(), 'right', 'an unknown value is the default');
});

test('readHand: only "left" is left', () => {
  assert.equal(readHand('left'), 'left');
  assert.equal(readHand('right'), 'right');
  assert.equal(readHand(undefined), 'right');
  assert.equal(readHand('LEFT'), 'right');
});

test('setHand applies at once and writes the profile, keeping its other fields', async () => {
  reset();
  let stored: Record<string, unknown> = { name: 'Ada', a11y: { largeText: true } };
  const host = { profile: { get: async () => stored, set: async (p: object) => { stored = p as Record<string, unknown>; } } };
  const pending = setHand(host, 'left');
  assert.equal(currentHand(), 'left', 'live before the write settles');
  await pending;
  assert.deepEqual(stored, { name: 'Ada', a11y: { largeText: true }, hand: 'left' });
  await setHand(host, 'right');
  assert.equal(stored.hand, 'right', 'right is written explicitly, so it outranks an old mirror');
});

test('a failing profile write keeps the attribute live', async () => {
  reset();
  const host = { profile: { get: async () => { throw new Error('offline'); } } };
  await setHand(host, 'left');
  assert.equal(currentHand(), 'left');
});

test('onHandChange hears changes and unsubscribes', () => {
  reset();
  const heard: string[] = [];
  const off = onHandChange((h) => heard.push(h));
  applyHand('left');
  off();
  applyHand('right');
  assert.deepEqual(heard, ['left']);
});
