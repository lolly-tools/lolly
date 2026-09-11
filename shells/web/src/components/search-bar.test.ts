// SPDX-License-Identifier: MPL-2.0
/**
 * The persistent search bar singleton - the plans/99 M1 contract.
 *
 * Run directly:  node --test shells/web/src/components/search-bar.test.ts
 *
 * Two halves:
 *  1. Behaviour, in jsdom: exactly one bar as #view's sibling; applyRoute
 *     shows/hides it and keeps the has-search-footer clearance class in step;
 *     claims write placeholder/value; the release resets to the default and a
 *     STALE release (fired after the next view claimed) is a no-op; typing
 *     reaches onQuery with the RAW value after the shared debounce; the ✕ and
 *     the Escape ladder (text → clear keeping focus; empty → blur) behave; a
 *     handled Escape stops propagating, an unhandled one falls through.
 *  2. The route table, as a static scan of main.ts (the file boots the whole
 *     app on import, so it cannot be imported here - the a11y contract test's
 *     read-the-source pattern): every route declares `footer:` explicitly, the
 *     six browse routes are 'search', and the editing/utility routes are 'none'.
 *
 * The plans/99 M2 seams are covered here too: the onClear fallback (a claim
 * with no live tap still hears a clear), the SpotlightHook contract (debounced
 * query fan-out, keydown first refusal, route-change notification, the ARIA
 * combobox upgrade), the ⌘/⌃Space chord, and the ⌃␣ hint chip. The overlay
 * itself is covered by spotlight.test.ts.
 *
 * The jelly path (<jelly-input> swap) is NOT exercised here - the vendored
 * bundle never loads in jsdom, so jellyActive() is always false; the jelly bar
 * is covered by the same manual pass that covers all jelly chrome.
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
// Fine pointer, so the autoFocus claim option is exercised.
(globalThis.window as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia =
  () => ({ matches: true });

const { initSearchBar, applySearchBarRoute, claimSearchBar, clearSearchBar, setSearchBarValue,
  registerSpotlightHook, currentSearchRoute } = await import('./search-bar.ts');
const { SEARCH_DEBOUNCE_MS } = await import('../lib/search/match.ts');

const bar = (): HTMLElement | null => document.querySelector('footer.gallery-footer');
const input = (): HTMLInputElement => document.querySelector<HTMLInputElement>('.gallery-search')!;
const clearBtn = (): HTMLButtonElement => document.querySelector<HTMLButtonElement>('.gallery-search-clear')!;
const view = (): HTMLElement => document.getElementById('view')!;
const settle = (): Promise<void> => new Promise((r) => setTimeout(r, SEARCH_DEBOUNCE_MS + 40));

function type(v: string): void {
  input().value = v;
  input().dispatchEvent(new dom.window.Event('input', { bubbles: true }));
}

test('init mounts exactly one bar as #view\'s sibling, hidden until a route applies', () => {
  initSearchBar();
  initSearchBar(); // idempotent
  const bars = document.querySelectorAll('footer.gallery-footer');
  assert.equal(bars.length, 1);
  assert.equal(view().nextElementSibling, bar());
  assert.equal(bar()!.hidden, true);
});

test('applyRoute: search shows the bar + clearance class; none hides both; the route name is exposed', () => {
  applySearchBarRoute('search', 'gallery');
  assert.equal(bar()!.hidden, false);
  assert.ok(view().classList.contains('has-search-footer'));
  assert.equal(currentSearchRoute(), 'gallery');
  applySearchBarRoute('none', 'tool');
  assert.equal(bar()!.hidden, true);
  assert.ok(!view().classList.contains('has-search-footer'));
  assert.equal(currentSearchRoute(), 'tool');
  applySearchBarRoute('search', 'gallery');
});

test('claim writes placeholder + value, ✕ visibility tracks the value, autoFocus lands', () => {
  const release = claimSearchBar({ placeholder: 'Search tools…', value: 'qr', autoFocus: true });
  assert.equal(input().placeholder, 'Search tools…');
  assert.equal(input().value, 'qr');
  assert.equal(clearBtn().hidden, false);
  assert.equal(document.activeElement, input());
  release();
  // Released → the unclaimed default, and no leftover query.
  assert.equal(input().placeholder, 'Search Lolly…');
  assert.equal(input().value, '');
  assert.equal(clearBtn().hidden, true);
});

test('a stale release cannot clobber the next view\'s claim', () => {
  const releaseA = claimSearchBar({ placeholder: 'A…', value: 'aaa' });
  const releaseB = claimSearchBar({ placeholder: 'B…', value: 'bbb' });
  releaseA(); // stale - B claimed after A
  assert.equal(input().placeholder, 'B…');
  assert.equal(input().value, 'bbb');
  releaseB();
});

test('typing reaches onQuery with the RAW value, once, after the debounce', async () => {
  const calls: string[] = [];
  const release = claimSearchBar({ placeholder: 'T…', onQuery: (q) => calls.push(q) });
  type('Q');
  type('QR '); // two keystrokes inside one debounce window
  assert.deepEqual(calls, []);
  await settle();
  assert.deepEqual(calls, ['QR ']); // raw - no trim, no lowercase (views normalise)
  release();
});

test('the ✕ clears, notifies immediately and refocuses', () => {
  const calls: string[] = [];
  const release = claimSearchBar({ placeholder: 'T…', value: 'abc', onQuery: (q) => calls.push(q) });
  clearBtn().click();
  assert.equal(input().value, '');
  assert.deepEqual(calls, ['']);
  assert.equal(clearBtn().hidden, true);
  assert.equal(document.activeElement, input());
  release();
});

test('Escape ladder: text clears (handled, stops propagating), empty blurs and falls through', async () => {
  const calls: string[] = [];
  const release = claimSearchBar({ placeholder: 'T…', value: 'abc', onQuery: (q) => calls.push(q) });
  let leaked = 0;
  const leakCounter = (): void => { leaked++; };
  document.addEventListener('keydown', leakCounter);
  const esc = () => input().dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  input().focus();
  esc();
  assert.equal(input().value, '');
  assert.deepEqual(calls, ['']);
  assert.equal(document.activeElement, input()); // kept focus for more typing
  assert.equal(leaked, 0);                       // handled → private to the field
  esc();
  assert.notEqual(document.activeElement, input()); // empty → blur
  assert.equal(leaked, 1);                          // unhandled → falls through
  document.removeEventListener('keydown', leakCounter);
  release();
});

test('setSearchBarValue writes the field without notifying the claim', async () => {
  const calls: string[] = [];
  const release = claimSearchBar({ placeholder: 'T…', value: 'abc', onQuery: (q) => calls.push(q) });
  setSearchBarValue('');
  assert.equal(input().value, '');
  assert.equal(clearBtn().hidden, true);
  await settle();
  assert.deepEqual(calls, []);
  release();
});

test('clearSearchBar without focus leaves focus where it was', () => {
  const release = claimSearchBar({ placeholder: 'T…', value: 'abc' });
  input().blur();
  clearSearchBar();
  assert.notEqual(document.activeElement, input());
  release();
});

// ── The spotlight seams (plans/99 M2) ────────────────────────────────────────

test('clearSearchBar: onQuery(\'\') wins when both taps exist; onClear fires when there is no onQuery', () => {
  const both: string[] = [];
  const releaseA = claimSearchBar({
    placeholder: 'A…', value: 'abc',
    onQuery: (q) => both.push(`query:${q}`),
    onClear: () => both.push('clear'),
  });
  clearSearchBar();
  assert.deepEqual(both, ['query:']); // the live tap heard it; onClear did NOT
  releaseA();
  const overlayOnly: string[] = [];
  const releaseB = claimSearchBar({ placeholder: 'B…', value: 'abc', onClear: () => overlayOnly.push('clear') });
  clearSearchBar();
  assert.deepEqual(overlayOnly, ['clear']); // no onQuery → the onClear fallback
  releaseB();
});

test('the kbd hint chip advertises ⌃␣, and hides the moment the field has text', () => {
  const chip = (): HTMLElement => document.querySelector<HTMLElement>('.gallery-search-kbd')!;
  const release = claimSearchBar({ placeholder: 'T…' });
  assert.ok(chip(), 'the chip renders inside the search box');
  assert.equal(chip().textContent, '⌃␣'); // ⌃ only - ⌘ is never advertised (plans/99 section 2f)
  assert.equal(chip().hidden, false);
  type('q');
  assert.equal(chip().hidden, true);  // text → the ✕ takes the corner
  clearSearchBar();
  assert.equal(chip().hidden, false); // cleared → the hint returns
  release();
});

// One controllable fake hook for the remaining tests. Registering it upgrades
// the field to the combobox pattern; the earlier tests above deliberately ran
// hook-free (the M1 behaviour must not depend on the overlay existing).
const hookLog: string[] = [];
let consumeKeys = false;

test('registerSpotlightHook upgrades the field to an ARIA combobox', () => {
  registerSpotlightHook({
    onQueryChanged: (raw) => hookLog.push(`q:${raw}`),
    onKeydown: (e) => { hookLog.push(`k:${e.key}`); return consumeKeys; },
    onRouteChanged: (name, mode) => hookLog.push(`r:${name}:${mode}`),
  }, { listboxId: 'test-listbox' });
  assert.equal(input().getAttribute('role'), 'combobox');
  assert.equal(input().getAttribute('aria-autocomplete'), 'list');
  assert.equal(input().getAttribute('aria-expanded'), 'false');
  assert.equal(input().getAttribute('aria-controls'), 'test-listbox');
});

test('typing notifies the hook after the debounce, alongside the claim tap', async () => {
  const calls: string[] = [];
  const release = claimSearchBar({ placeholder: 'T…', onQuery: (q) => calls.push(q) });
  hookLog.length = 0;
  type('qr');
  await settle();
  assert.deepEqual(calls, ['qr']);
  assert.deepEqual(hookLog, ['q:qr']);
  release();
});

test('a consumed hook keydown short-circuits the Escape ladder', () => {
  const release = claimSearchBar({ placeholder: 'T…', value: 'abc' });
  hookLog.length = 0;
  const esc = () => input().dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  consumeKeys = true; // "overlay open" - the hook consumes
  esc();
  assert.equal(input().value, 'abc'); // ladder skipped: the text survives
  consumeKeys = false; // "overlay closed" - falls through to the ladder
  esc();
  assert.equal(input().value, '');    // ladder ran: text cleared
  assert.deepEqual(hookLog.filter((x) => x.startsWith('k:')), ['k:Escape', 'k:Escape']); // hook saw both
  release();
});

test('route transitions reach the hook', () => {
  hookLog.length = 0;
  applySearchBarRoute('none', 'tool');
  applySearchBarRoute('search', 'projects');
  assert.deepEqual(hookLog, ['r:tool:none', 'r:projects:search']);
});

test('the chord (⌃Space or ⌘Space) focuses the field and pings the hook, only in search mode', () => {
  const release = claimSearchBar({ placeholder: 'T…', value: 'qr' });
  const chord = (init: KeyboardEventInit) => {
    const e = new dom.window.KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true, ...init });
    document.dispatchEvent(e);
    return e;
  };
  input().blur();
  hookLog.length = 0;
  applySearchBarRoute('none', 'tool'); // editing route: the bar is hidden, the chord is inert
  hookLog.length = 0;
  const inert = chord({ ctrlKey: true });
  assert.equal(inert.defaultPrevented, false); // never preventDefault when not handling
  assert.notEqual(document.activeElement, input());
  assert.deepEqual(hookLog, []);
  applySearchBarRoute('search', 'gallery');
  hookLog.length = 0;
  const handled = chord({ ctrlKey: true });
  assert.equal(handled.defaultPrevented, true);
  assert.equal(document.activeElement, input());
  assert.deepEqual(hookLog, ['q:qr']); // current text handed over so the overlay can open
  // ⌘Space is bound too (silently - the chip never advertises it).
  input().blur();
  hookLog.length = 0;
  chord({ metaKey: true });
  assert.equal(document.activeElement, input());
  assert.deepEqual(hookLog, ['q:qr']);
  // Modifier soup is not the chord: never stolen from the page.
  input().blur();
  hookLog.length = 0;
  const shifted = chord({ ctrlKey: true, shiftKey: true });
  assert.equal(shifted.defaultPrevented, false);
  assert.deepEqual(hookLog, []);
  release();
});

// ── The route table (static scan of main.ts - see the header) ────────────────

const MAIN_SRC = readFileSync(fileURLToPath(new URL('../main.ts', import.meta.url)), 'utf8');

const EXPECTED_FOOTER: Record<string, 'search' | 'none'> = {
  gallery: 'search', utilities: 'search', projects: 'search', catalog: 'search',
  dashboard: 'search', profile: 'search', docs: 'search',
  tool: 'none', pro: 'none', start: 'none', multi: 'none', data: 'none', script: 'none',
  verify: 'none', convert: 'none', lab: 'none', pdf: 'none', components: 'none',
};

test('ROUTES: every route declares footer:, browse routes search, editing/utility routes none', () => {
  const block = MAIN_SRC.slice(MAIN_SRC.indexOf('const ROUTES:'), MAIN_SRC.indexOf('};', MAIN_SRC.indexOf('const ROUTES:')));
  for (const [name, expected] of Object.entries(EXPECTED_FOOTER)) {
    const row = block.match(new RegExp(`^  ${name}: \\{(.*)\\},?$`, 'm'));
    assert.ok(row, `ROUTES has a single-line entry for '${name}'`);
    const m = row![1]!.match(/footer: '(search|none)'/);
    assert.ok(m, `ROUTES.${name} declares footer: explicitly`);
    assert.equal(m![1], expected, `ROUTES.${name} footer mode`);
  }
});

test('navigate() applies the route footer mode + name; boot mounts the singleton once, then the overlay', () => {
  assert.ok(MAIN_SRC.includes("applySearchBarRoute(ROUTES[route.name].footer ?? 'none', route.name)"));
  assert.equal(MAIN_SRC.match(/initSearchBar\(\)/g)?.length, 1);
  // The overlay registers into the bar, so it must boot AFTER it (plans/99 M2).
  // Since plans/155 WP-3 what boots is the SHIM (components/spotlight-boot.ts),
  // which registers a hook synchronously and fetches the overlay on the first
  // query - the ordering rule is unchanged, and a bar left with no hook at all is
  // the failure both this pin and spotlight-boot.test.ts exist to catch.
  const barAt = MAIN_SRC.indexOf('initSearchBar()');
  const spotAt = MAIN_SRC.indexOf('initSpotlightBoot(host)');
  assert.ok(spotAt > barAt && barAt > 0, 'initSpotlightBoot(host) boots directly after initSearchBar()');
});
