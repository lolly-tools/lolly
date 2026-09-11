// SPDX-License-Identifier: MPL-2.0
/**
 * The spotlight overlay - the plans/99 M2 contract.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/components/spotlight.test.ts
 *
 * jsdom, with the real search-bar singleton wired in front (typing in the bar
 * is how every query reaches the overlay - the same path production uses) and
 * FAKE providers swapped in via the registry's resetProviders() seam. The
 * spotlightSeams are overridden up front: jsdom's location.assign throws,
 * window.open is inert, and the default provider chunk is another builder's
 * file - none of them belong in this suite.
 *
 * Covered: the MIN_QUERY_LENGTH gate; group order + the section 2a own-domain lead
 * (own group hoisted first + brand-highlighted, both tiers); the 5/8 caps; the see-all handoff
 * href; the arrow walk + Enter/⌘Enter activation through the seams; the
 * '#/p?' same-route remount special case; the stale-response guard; outside
 * dismissal; and the combobox aria-expanded/activedescendant lifecycle.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><main id="view" class="app-view" tabindex="-1"></main></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
// activate() reads location.hash for the remount special case; the DEFAULT
// navigate seam (not used here) would write it too.
(globalThis as { location?: Location }).location = dom.window.location as unknown as Location;
// The remount special case dispatches `new Event(...)` - Node's own global
// Event isn't a jsdom Event, and dom.window.dispatchEvent refuses it.
(globalThis as { Event?: typeof Event }).Event = dom.window.Event as unknown as typeof Event;
(globalThis.window as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia =
  () => ({ matches: true });

const { initSearchBar, applySearchBarRoute, clearSearchBar } = await import('./search-bar.ts');
const { initSpotlight, spotlightSeams } = await import('./spotlight.ts');
const { registerProvider, resetProviders, GROUP_CAP, OWN_GROUP_CAP } = await import('../lib/search/registry.ts');
type SearchHit = import('../lib/search/registry.ts').SearchHit;
type SearchProvider = import('../lib/search/registry.ts').SearchProvider;
type SearchGroupId = import('../lib/search/registry.ts').SearchGroupId;
const { SEARCH_DEBOUNCE_MS } = await import('../lib/search/match.ts');

// Seam overrides BEFORE boot - the provider chunk never loads, navigation is
// recorded instead of performed.
const navigations: string[] = [];
const tabs: string[] = [];
spotlightSeams.loadProviders = () => Promise.resolve();
spotlightSeams.navigate = (href) => navigations.push(href);
spotlightSeams.openTab = (href) => tabs.push(href);

initSearchBar();
initSpotlight({});
applySearchBarRoute('search', 'gallery');

const input = (): HTMLInputElement => document.querySelector<HTMLInputElement>('.gallery-search')!;
const panel = (): HTMLElement | null => document.querySelector<HTMLElement>('.spotlight-panel');
const rows = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('.spotlight-opt')];
const groupLabels = (): string[] => [...document.querySelectorAll<HTMLElement>('.spotlight-group-label')].map((el) => el.textContent ?? '');
const isOpen = (): boolean => !!panel() && !panel()!.hidden;

function type(v: string): void {
  input().value = v;
  input().dispatchEvent(new dom.window.Event('input', { bubbles: true }));
}
function key(k: string, init: KeyboardEventInit = {}): void {
  input().dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }));
}
/** Wait out the shared debounce + the provider microtasks. */
const settle = (): Promise<void> => new Promise((r) => setTimeout(r, SEARCH_DEBOUNCE_MS + 40));
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

/** A provider returning `count` canned hits (ignoring `limit`, so the overlay's
 *  own defensive cap is what the cap tests measure). Records the limits asked. */
function fakeProvider(id: SearchGroupId, count: number, limits?: number[]): SearchProvider {
  return {
    id,
    search: async (_tokens, limit) => {
      limits?.push(limit);
      return Array.from({ length: count }, (_, i): SearchHit => ({
        icon: '',
        title: `${id} hit ${i}`,
        subtitle: `${id} sub ${i}`,
        href: `#/hit/${id}/${i}`,
        score: 100 - i,
      }));
    },
  };
}

test('under MIN_QUERY_LENGTH the overlay stays closed; at 2 chars it opens', async () => {
  resetProviders();
  registerProvider(fakeProvider('projects', 2));
  type('a');
  await settle();
  assert.equal(isOpen(), false);
  type('ab');
  await settle();
  assert.equal(isOpen(), true);
  assert.ok(rows().length >= 2);
  // Shrinking back below the gate closes it again.
  type('a');
  await settle();
  assert.equal(isOpen(), false);
  clearSearchBar();
});

test('titles and subtitles render as plain text (escaped at the sink)', async () => {
  resetProviders();
  registerProvider({
    id: 'projects',
    search: async () => [{ icon: '', title: '<img src=x>', subtitle: '<b>sub</b>', href: '#/x', score: 1 }],
  });
  type('ab');
  await settle();
  assert.equal(panel()!.querySelector('img'), null);
  assert.equal(panel()!.querySelector('b'), null);
  assert.equal(panel()!.querySelector('.spotlight-opt-title')!.textContent, '<img src=x>');
  assert.equal(panel()!.querySelector('.spotlight-opt-sub')!.textContent, '<b>sub</b>');
  clearSearchBar();
});

test('a hit with a script-bearing href is dropped, not painted - escaping is not scheme validation', async () => {
  resetProviders();
  navigations.length = 0;
  tabs.length = 0;
  registerProvider({
    id: 'projects',
    // SearchProvider is an extension point and activate() turns a row's href
    // into a real navigation (location.assign / window.open), so a provider
    // that yields a javascript:/data: target must never reach the DOM. escape()
    // cannot see it: none of the five escaped characters appear in either URL.
    search: async () => [
      { icon: '', title: 'safe', href: '#/ok', score: 3 },
      { icon: '', title: 'script', href: 'javascript:alert(1)', score: 2 },
      { icon: '', title: 'data', href: 'data:text/html,<script>alert(1)</script>', score: 1 },
    ],
  });
  type('ab');
  await settle();
  const painted = rows()
    .filter((r) => !r.classList.contains('spotlight-see-all'))
    .map((r) => r.dataset.href);
  assert.deepEqual(painted, ['#/ok'], 'only the navigable href survives to the DOM');
  assert.equal(panel()!.innerHTML.includes('javascript:'), false);
  assert.equal(panel()!.innerHTML.includes('data:text/html'), false);
  // The status line counts what is actually actionable, not what arrived.
  assert.equal(document.querySelector('.spotlight-status')?.textContent, '1 result');
  // And Enter on the first row activates the safe target, never a dropped one.
  key('Enter');
  assert.deepEqual(navigations, ['#/ok']);
  assert.deepEqual(tabs, []);
  clearSearchBar();
});

test('live-adapt route (gallery): the own group hoists first and is brand-highlighted', async () => {
  resetProviders();
  registerProvider(fakeProvider('tools', 2));
  registerProvider(fakeProvider('projects', 2));
  registerProvider(fakeProvider('settings', 2));
  applySearchBarRoute('search', 'gallery');
  type('ab');
  await settle();
  // gallery's own domain is tools - hoisted to the top so its results lead the
  // panel even when it occludes the live-filtered cards behind (section 2a).
  assert.deepEqual(groupLabels(), ['Tools', 'Projects', 'Settings']);
  // ...and marked for the brand highlight: the own label + only the own rows.
  assert.ok(document.querySelector('.spotlight-group-label--own')?.textContent === 'Tools');
  const ownRows = rows().filter((r) => r.classList.contains('spotlight-opt--own'));
  assert.equal(ownRows.length, 2);
  assert.ok(ownRows.every((r) => r.dataset.group === 'tools'));
  clearSearchBar();
});

test('overlay-only route (projects): the own group hoists first', async () => {
  resetProviders();
  registerProvider(fakeProvider('tools', 2));
  registerProvider(fakeProvider('projects', 2));
  registerProvider(fakeProvider('settings', 2));
  applySearchBarRoute('search', 'projects');
  type('ab');
  await settle();
  assert.deepEqual(groupLabels(), ['Projects', 'Tools', 'Settings']);
  clearSearchBar();
});

test('caps: 8 for the own group on an overlay route, 5 for the rest - and the provider is asked for exactly that', async () => {
  resetProviders();
  const settingsLimits: number[] = [];
  const toolsLimits: number[] = [];
  registerProvider(fakeProvider('settings', 12, settingsLimits));
  registerProvider(fakeProvider('tools', 12, toolsLimits));
  applySearchBarRoute('search', 'profile'); // own domain: settings, tier overlay
  type('ab');
  await settle();
  const settingsRows = rows().filter((r) => r.textContent!.includes('settings hit'));
  const toolsRows = rows().filter((r) => r.textContent!.includes('tools hit'));
  assert.equal(settingsRows.length, OWN_GROUP_CAP); // 8 - hoisted own group
  assert.equal(toolsRows.length, GROUP_CAP);        // 5 - everyone else
  assert.deepEqual(settingsLimits, [OWN_GROUP_CAP]);
  assert.deepEqual(toolsLimits, [GROUP_CAP]);
  clearSearchBar();
});

test('a group with hits ends in a See all row carrying the encoded query', async () => {
  resetProviders();
  registerProvider(fakeProvider('projects', 1));
  registerProvider(fakeProvider('settings', 1)); // no GROUP_SEE_ALL entry → no row
  applySearchBarRoute('search', 'profile');
  type('hello world');
  await settle();
  const seeAll = [...document.querySelectorAll<HTMLElement>('.spotlight-see-all')];
  assert.equal(seeAll.length, 1);
  assert.equal(seeAll[0]!.dataset.href, '#/p?q=hello%20world');
  clearSearchBar();
});

test('empty everywhere: one no-matches line, zero option rows', async () => {
  resetProviders();
  registerProvider(fakeProvider('projects', 0));
  applySearchBarRoute('search', 'gallery');
  type('zz');
  await settle();
  assert.equal(isOpen(), true);
  assert.equal(rows().length, 0);
  assert.ok(panel()!.querySelector('.spotlight-empty')!.textContent!.includes('zz'));
  clearSearchBar();
});

test('arrow walk wraps across hit AND see-all rows; aria follows; Enter activates; ⌘Enter opens a tab', async () => {
  resetProviders();
  registerProvider(fakeProvider('projects', 2)); // + its see-all row = 3 rows
  applySearchBarRoute('search', 'profile');
  type('ab');
  await settle();
  assert.equal(rows().length, 3);
  assert.equal(input().getAttribute('aria-expanded'), 'true');
  assert.equal(input().getAttribute('aria-activedescendant'), null); // none active on open
  key('ArrowDown');
  assert.equal(input().getAttribute('aria-activedescendant'), 'spotlight-opt-0');
  assert.equal(rows()[0]!.getAttribute('aria-selected'), 'true');
  key('ArrowDown');
  key('ArrowDown');
  assert.equal(input().getAttribute('aria-activedescendant'), 'spotlight-opt-2'); // the see-all row walks too
  key('ArrowDown');
  assert.equal(input().getAttribute('aria-activedescendant'), 'spotlight-opt-0'); // wrapped
  key('ArrowUp');
  assert.equal(input().getAttribute('aria-activedescendant'), 'spotlight-opt-2'); // wraps backwards too
  key('ArrowUp');
  navigations.length = 0;
  key('Enter');
  assert.deepEqual(navigations, ['#/hit/projects/1']);
  assert.equal(isOpen(), false);
  assert.equal(input().getAttribute('aria-expanded'), 'false');
  // ⌘Enter → new tab through the openTab seam, never the navigate one.
  type('ab');
  await settle();
  key('ArrowDown');
  navigations.length = 0;
  tabs.length = 0;
  key('Enter', { metaKey: true });
  assert.deepEqual(tabs, ['#/hit/projects/0']);
  assert.deepEqual(navigations, []);
  assert.equal(isOpen(), false);
  clearSearchBar();
});

test('Enter with no active row activates the FIRST row', async () => {
  resetProviders();
  registerProvider(fakeProvider('projects', 2));
  applySearchBarRoute('search', 'profile');
  type('ab');
  await settle();
  navigations.length = 0;
  key('Enter');
  assert.deepEqual(navigations, ['#/hit/projects/0']);
  clearSearchBar();
});

test('a see-all activation navigates plainly - no lolly:remount even on #/p (the route signature carries ?q=)', async () => {
  resetProviders();
  registerProvider(fakeProvider('projects', 1));
  applySearchBarRoute('search', 'profile');
  let remounts = 0;
  const onRemount = (): void => { remounts++; };
  dom.window.addEventListener('lolly:remount', onRemount);
  // The old build forced a remount for the #/p → #/p?q= handoff because the
  // projects signature keyed on folderId alone; routeSignature now folds the
  // ?q= param in (main.ts), so a plain hash navigation remounts by itself - 
  // and Back out of results mode does too. The overlay must NOT dispatch.
  dom.window.location.hash = '#/p';
  type('ab');
  await settle();
  navigations.length = 0;
  const seeAll = document.querySelector<HTMLElement>('.spotlight-see-all')!;
  seeAll.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  assert.deepEqual(navigations, ['#/p?q=ab']);
  assert.equal(remounts, 0);
  assert.equal(isOpen(), false);
  dom.window.removeEventListener('lolly:remount', onRemount);
  dom.window.location.hash = '';
  clearSearchBar();
});

test('routeSignature carries the projects ?q= param (static pin of the main.ts contract)', () => {
  // The see-all test above relies on main.ts remounting #/p → #/p?q= by
  // signature; pin the source so a routeSignature refactor can't silently
  // bring the dedupe (and the dead see-all/Back) back.
  const mainSrc = readFileSync(fileURLToPath(new URL('../main.ts', import.meta.url)), 'utf8');
  assert.ok(/key === 'folderId'[\s\S]{0,700}get\('q'\)/.test(mainSrc), 'folderId signature branch reads the q param');
});

test('a slow superseded response is discarded - the newer query keeps the panel', async () => {
  resetProviders();
  const resolvers: Array<(hits: SearchHit[]) => void> = [];
  registerProvider({
    id: 'projects',
    search: (tokens) => new Promise<SearchHit[]>((resolve) => { resolvers.push(resolve); void tokens; }),
  });
  applySearchBarRoute('search', 'profile');
  type('aa');
  await settle(); // query 1 in flight, unresolved - nothing painted yet
  assert.equal(isOpen(), false);
  type('aab');
  await settle(); // query 2 in flight
  assert.equal(resolvers.length, 2);
  resolvers[1]!([{ icon: '', title: 'FRESH', href: '#/fresh', score: 1 }]);
  await tick();
  assert.equal(isOpen(), true);
  assert.ok(panel()!.textContent!.includes('FRESH'));
  // The first (stale) query resolves late - it must not repaint.
  resolvers[0]!([{ icon: '', title: 'STALE', href: '#/stale', score: 1 }]);
  await tick();
  assert.ok(panel()!.textContent!.includes('FRESH'));
  assert.ok(!panel()!.textContent!.includes('STALE'));
  clearSearchBar();
});

test('outside pointerdown dismisses; a press inside the panel does not', async () => {
  resetProviders();
  registerProvider(fakeProvider('projects', 1));
  applySearchBarRoute('search', 'profile');
  type('ab');
  await settle();
  assert.equal(isOpen(), true);
  panel()!.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true }));
  assert.equal(isOpen(), true); // inside → stays
  document.getElementById('view')!.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true }));
  assert.equal(isOpen(), false);
  assert.equal(input().getAttribute('aria-expanded'), 'false');
  clearSearchBar();
});

test('a route change closes the overlay; a clear closes it too', async () => {
  resetProviders();
  registerProvider(fakeProvider('projects', 1));
  applySearchBarRoute('search', 'profile');
  type('ab');
  await settle();
  assert.equal(isOpen(), true);
  applySearchBarRoute('search', 'projects');
  assert.equal(isOpen(), false);
  type('ab');
  await settle();
  assert.equal(isOpen(), true);
  clearSearchBar(); // ✕/Escape-with-text path → onQueryChanged('') → close
  assert.equal(isOpen(), false);
});

test('a throwing provider contributes an empty group, not a broken overlay', async () => {
  resetProviders();
  registerProvider({ id: 'tools', search: () => { throw new Error('boom'); } });
  registerProvider(fakeProvider('projects', 1));
  applySearchBarRoute('search', 'profile');
  type('ab');
  await settle();
  assert.equal(isOpen(), true);
  assert.deepEqual(groupLabels(), ['Projects']);
  clearSearchBar();
});
