// SPDX-License-Identifier: MPL-2.0
/**
 * The spotlight BOOT SHIM (components/spotlight-boot.ts) - what moving the overlay
 * off the boot chunk must not have changed.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/components/spotlight-boot.test.ts
 *
 * The whole risk of this change is a silent hole: with no hook registered, the
 * search bar swallows a query and the summon chord does nothing, and NOTHING
 * fails. So what is pinned here is that the shim is registered from the first
 * call, that it loads the overlay on the first question the bar asks, and that
 * the query which triggered the load is handed on rather than lost.
 *
 * The overlay itself is a `spotlightBootSeams.load` stub - this suite is about the
 * shim, and components/spotlight.test.ts owns the overlay's own contract.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><main id="view" class="app-view" tabindex="-1"></main></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
(globalThis as { location?: Location }).location = dom.window.location as unknown as Location;
(globalThis.window as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia = () => ({ matches: true });

const { initSearchBar, applySearchBarRoute } = await import('./search-bar.ts');
const searchBar = await import('./search-bar.ts');
const { initSpotlightBoot, spotlightBootSeams } = await import('./spotlight-boot.ts');
const { SEARCH_DEBOUNCE_MS } = await import('../lib/search/match.ts');

const HOST = {} as unknown;

/** Reach the registered hook the way the bar does - by typing in the real field. */
function field(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>('.gallery-search');
  assert.ok(input, 'the search bar must have rendered its field');
  return input;
}

function type(value: string): void {
  const input = field();
  input.value = value;
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
}

const settle = (): Promise<void> => new Promise(r => setTimeout(r, SEARCH_DEBOUNCE_MS + 20));

initSearchBar();
applySearchBarRoute('search', 'gallery');

test('the shim registers at boot, so the bar is never left without a hook', () => {
  let loads = 0;
  spotlightBootSeams.load = () => { loads++; return Promise.resolve({ initSpotlight() {} } as unknown as typeof import('./spotlight.ts')); };
  initSpotlightBoot(HOST);
  // registerSpotlightHook upgrades the field to a combobox pointing at the
  // overlay's listbox - the observable proof a hook is in place.
  assert.equal(field().getAttribute('role'), 'combobox');
  assert.equal(field().getAttribute('aria-controls'), searchBar.SPOTLIGHT_LISTBOX_ID);
  assert.equal(loads, 0, 'and registering must not fetch the overlay');
});

test('the first query loads the overlay ONCE and hands the query on', async () => {
  let loads = 0;
  const seen: Array<string | null | undefined> = [];
  spotlightBootSeams.load = () => {
    loads++;
    return Promise.resolve({
      initSpotlight(_host: unknown, pending?: string | null) { seen.push(pending); },
    } as unknown as typeof import('./spotlight.ts'));
  };
  initSpotlightBoot(HOST);

  type('mesh');
  await settle();
  assert.equal(loads, 1);
  assert.deepEqual(seen, ['mesh'], 'a query typed before the chunk lands must be answered, not swallowed');

  type('mesh gradient');
  await settle();
  assert.equal(loads, 1, 'the load is memoised - one fetch per session, not one per keystroke');
});

test('a failed load is retried rather than wedging the bar for the session', async () => {
  let loads = 0;
  spotlightBootSeams.load = () => {
    loads++;
    return loads === 1
      ? Promise.reject(new Error('offline'))
      : Promise.resolve({ initSpotlight() {} } as unknown as typeof import('./spotlight.ts'));
  };
  initSpotlightBoot(HOST);

  type('qr');
  await settle();
  assert.equal(loads, 1);
  type('qr code');
  await settle();
  assert.equal(loads, 2, 'the next keystroke must be able to try again');
});
