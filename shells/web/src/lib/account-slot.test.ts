// SPDX-License-Identifier: MPL-2.0
/**
 * lib/account-slot.ts - the header's account slot.
 *
 * Pinned: dormant with nothing registered (no slot, no element); a registration adds
 * one slot to a header already drawn, in front of the profile control; a header drawn
 * later (a view rendering again) gets its own slot; a header that goes away has its
 * slot cleaned up; a cluster never gets a second slot; unregistering removes every
 * slot and runs each cleanup; a later registration replaces the earlier one.
 *
 * Run directly:  node --test shells/web/src/lib/account-slot.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="app"><main id="view"></main></div></body></html>', { url: 'https://instance.test/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement as unknown as typeof HTMLElement;
globalThis.MutationObserver = dom.window.MutationObserver as unknown as typeof MutationObserver;
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => { setTimeout(() => cb(0), 0); return 0; }) as unknown as typeof requestAnimationFrame;

const { registerAccountSlot, accountSlotRegistered, ACCOUNT_SLOT_ATTR, _clearAccountSlotForTests } = await import('./account-slot.ts');

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
async function settle(): Promise<void> { for (let i = 0; i < 4; i++) await tick(); }

const view = (): HTMLElement => document.getElementById('view')!;
const header = (): string => '<div class="gallery-topbar"><div class="gallery-topright"><button class="lang-fab"></button><a class="profile-link" href="#/settings"></a></div></div>';
const slots = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>(`[${ACCOUNT_SLOT_ATTR}]`)];

function provider(log: string[]): { mount(into: HTMLElement): () => void } {
  return {
    mount(into) {
      const chip = document.createElement('button');
      chip.className = 'chip';
      into.append(chip);
      log.push('mount');
      return () => { log.push('cleanup'); };
    },
  };
}

test('dormant: nothing registered, no slot and no element', async () => {
  _clearAccountSlotForTests();
  view().innerHTML = header();
  await settle();
  assert.equal(accountSlotRegistered(), false);
  assert.equal(slots().length, 0);
});

test('a registration fills the header already on screen, in front of the profile control', () => {
  _clearAccountSlotForTests();
  view().innerHTML = header();
  const log: string[] = [];
  const off = registerAccountSlot(provider(log));
  assert.equal(accountSlotRegistered(), true);
  const [slot] = slots();
  assert.ok(slot, 'a slot was added at once');
  assert.equal(slot!.nextElementSibling?.className, 'profile-link', 'the slot sits in front of the profile pill');
  assert.ok(slot!.querySelector('.chip'), 'the provider filled it');
  assert.deepEqual(log, ['mount']);
  off();
  assert.equal(slots().length, 0, 'unregistering removes the slot');
  assert.deepEqual(log, ['mount', 'cleanup']);
  assert.equal(accountSlotRegistered(), false);
});

test('a header drawn later gets its own slot, and the old one is cleaned up', async () => {
  _clearAccountSlotForTests();
  view().innerHTML = header();
  const log: string[] = [];
  const off = registerAccountSlot(provider(log));
  assert.equal(slots().length, 1);
  // The view renders again: a fresh cluster replaces the old one.
  view().innerHTML = header();
  await settle();
  assert.equal(slots().length, 1, 'one slot in the new header');
  assert.deepEqual(log, ['mount', 'cleanup', 'mount'], 'the old slot was cleaned up and the new one mounted');
  // A redraw inside the slot (the chip changing) adds nothing.
  slots()[0]!.append(document.createElement('span'));
  await settle();
  assert.equal(slots().length, 1, 'never a second slot in one cluster');
  off();
});

test('a cluster without a profile control still gets the slot, at its end', () => {
  _clearAccountSlotForTests();
  view().innerHTML = '<div class="gallery-topright"><button class="filter-fab"></button></div>';
  const off = registerAccountSlot(provider([]));
  const cluster = document.querySelector('.gallery-topright')!;
  assert.equal(cluster.lastElementChild?.hasAttribute(ACCOUNT_SLOT_ATTR), true);
  off();
});

test('a later registration replaces the earlier one, and the earlier unregister then does nothing', () => {
  _clearAccountSlotForTests();
  view().innerHTML = header();
  const first: string[] = [];
  const second: string[] = [];
  const offFirst = registerAccountSlot(provider(first));
  const offSecond = registerAccountSlot(provider(second));
  assert.deepEqual(first, ['mount', 'cleanup']);
  assert.deepEqual(second, ['mount']);
  assert.equal(slots().length, 1);
  offFirst();
  assert.equal(slots().length, 1, 'the stale unregister leaves the current slot alone');
  offSecond();
  assert.equal(slots().length, 0);
});

test('a provider that throws leaves the header standing', () => {
  _clearAccountSlotForTests();
  view().innerHTML = header();
  const err = console.error;
  console.error = () => {};
  try {
    const off = registerAccountSlot({ mount() { throw new Error('boom'); } });
    assert.equal(slots().length, 1, 'the slot is there, empty');
    assert.ok(document.querySelector('.profile-link'), 'the rest of the header is untouched');
    off();
  } finally {
    console.error = err;
  }
});
