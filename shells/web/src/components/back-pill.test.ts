// SPDX-License-Identifier: MPL-2.0
/*
 * back-pill.ts - the shared back control's target resolution and click contract.
 *
 * Run directly:  node --test shells/web/src/components/back-pill.test.ts
 *
 * What's worth pinning down here is the decision table the pill replaced a pile
 * of hardcoded `<a href="#/">Tools</a>` anchors with: what it's CALLED, where it
 * GOES, and whether it goes there by popping a history entry or pushing one.
 * Everything else about the pill is CSS.
 *
 * jsdom supplies the DOM, sessionStorage (which lib/back-nav.ts persists to) and
 * a history object. The router isn't running, so the module's writers
 * (noteMountedView/recordLeave) are driven directly - exactly the two calls
 * main.ts makes around every navigation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><main id="view"></main></body></html>', {
  url: 'http://localhost/#/dashboard',
});
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.sessionStorage = dom.window.sessionStorage;
globalThis.MouseEvent = dom.window.MouseEvent;
// nav.ts's navigateTo uses bare `history`/`Event` - point them at jsdom's so the
// intercept-leave path (which now navigates by URL) runs under test.
globalThis.history = dom.window.history as unknown as typeof globalThis.history;
globalThis.Event = dom.window.Event as unknown as typeof globalThis.Event;

const backNav = await import('../lib/back-nav.ts');
const { resolveBackTarget, backPillHtml, backHomeHtml, mountBackPill } = await import('./back-pill.ts');
const { mountHomeFab } = await import('./home-fab.ts');

/** Reset the module's persisted memory between cases. The in-memory
 *  "did this document navigate?" flag can't be un-set, so ordering matters:
 *  the direct-visit case runs FIRST, while it's still false. */
const clearStored = (): void => { sessionStorage.clear(); };

/** jsdom reports history.length === 1, which reads as "no entry to pop". Give
 *  the cases that care a second entry, the way a real navigation would. */
const withHistoryEntry = (): void => {
  Object.defineProperty(dom.window.history, 'length', { value: 2, configurable: true });
};

/** Stand in for one router navigation: leave `fromTitle` at `fromHref`, arrive
 *  somewhere ELSE (`arriveAt`, a distinct view - default a tool). Mirrors main.ts:
 *  noteMountedView() at the outgoing view, recordLeave() when it's left, then the
 *  URL moves to the arrival - so, like the real app, the back target (the prev)
 *  is NOT the view we end up on. (Leaving the URL equal to the prev is the exact
 *  self-loop resolveBackTarget now escapes to Home; see the loop test below.) */
function walkFrom(routeName: string, title: string, href: string, arriveAt = '/t/qr-code'): void {
  document.title = title;
  dom.reconfigure({ url: `http://localhost${href}` });
  backNav.noteMountedView(routeName);
  backNav.recordLeave(href);
  dom.reconfigure({ url: `http://localhost${arriveAt}` });
}

test('a direct visit - no previous view - falls back to Home → the gallery', () => {
  clearStored();
  const target = resolveBackTarget();
  assert.equal(target.label, 'Home');
  assert.equal(target.href, '/#/');
  assert.equal(target.useHistory, false, 'nothing to go back TO, so it must be a forward link');
});

// A tool's canonical URL is the PATH form /t/<id>, so a relative '#/' fallback
// resolved to /t/<id>#/ - which parseRoute reads as the same tool (the '/' hash
// is skipped, the path branch wins), stranding anyone who opened a shared tool
// link inside the editor. Root-absolute or the pill isn't an exit.
test('the fallback escapes a /t/<id> tool URL rather than resolving back into it', () => {
  clearStored();
  dom.reconfigure({ url: 'http://localhost/t/design' });
  const { href } = resolveBackTarget();
  assert.equal(href, '/#/');
  assert.equal(new URL(href, dom.window.location.href).pathname, '/', 'must leave the tool path behind');
});

test('an in-app arrival wears the previous view’s name and returns there', () => {
  clearStored();
  withHistoryEntry();
  walkFrom('projects', 'Campaign assets - Lolly', '/#/p/abc');
  const target = resolveBackTarget();
  assert.equal(target.label, 'Campaign assets', 'the " - Lolly" suffix is stripped');
  assert.equal(target.href, '/#/p/abc');
  assert.equal(target.useHistory, true, 'a real history entry sits behind us');
});

test('the gallery is named "Home" rather than the bare product name', () => {
  clearStored();
  walkFrom('gallery', 'Lolly', '/');
  assert.equal(resolveBackTarget().label, 'Home');
});

test('a pinned target (the tool view’s launch folder) keeps its href', () => {
  clearStored();
  withHistoryEntry();
  walkFrom('projects', 'Campaign assets - Lolly', '/#/p/abc');

  // Previous view IS the pinned folder → it wears the folder's name and still
  // goes back through history.
  const matching = resolveBackTarget({ href: '/#/p/abc' });
  assert.equal(matching.label, 'Campaign assets');
  assert.equal(matching.useHistory, true);

  // Previous view is something else → the pill must still land in the folder,
  // so history.back() (which would go elsewhere) is off the table.
  const mismatched = resolveBackTarget({ href: '/#/p/other' });
  assert.equal(mismatched.href, '/#/p/other');
  assert.equal(mismatched.label, 'Back');
  assert.equal(mismatched.useHistory, false);
});

test('a back target that IS the current view escapes to Home instead of looping', () => {
  clearStored();
  withHistoryEntry();
  // Arrive at /#/catalog with /#/catalog ALSO recorded as the previous view - the
  // self-loop a direct entry can produce. Back to yourself is not a back.
  walkFrom('catalog', 'Catalog - Lolly', '/#/catalog', '/#/catalog');
  const target = resolveBackTarget();
  assert.equal(target.href, '/#/', 'escapes to Home rather than pointing at the current view');
  assert.equal(target.label, 'Home');
  assert.equal(target.isHome, true, 'the pill wears the house icon, not a back arrow');
  assert.equal(target.useHistory, false);

  // A PINNED target equal to the current view loops the same way → Home.
  dom.reconfigure({ url: 'http://localhost/#/p/abc' });
  const pinned = resolveBackTarget({ href: '/#/p/abc' });
  assert.equal(pinned.href, '/#/');
  assert.equal(pinned.isHome, true);
});

test('the home escape renders a house icon in the markup, not the back arrow', () => {
  clearStored();
  // Force the self-loop (arrive where the prev points) so the target is Home
  // regardless of any prev left in memory by an earlier test.
  walkFrom('catalog', 'Catalog - Lolly', '/#/catalog', '/#/catalog');
  const html = backPillHtml();
  assert.match(html, /href="\/#\/"/, 'points at Home');
  // The Lucide "house" path (icons.ts "home") starts with this distinctive
  // roofline move; the back arrow does not - a stable discriminator without
  // snapshotting the whole SVG.
  assert.match(html, /M15 21v-8/, 'wears the house icon, not the back arrow');
});

test('markup carries a real href and the resolved mode', () => {
  clearStored();
  withHistoryEntry();
  walkFrom('catalog', 'Catalog - Lolly', '/#/catalog');
  const html = backPillHtml();
  assert.match(html, /href="\/#\/catalog"/);
  assert.match(html, /data-back-pill="history"/);
  assert.match(html, /class="tools-home home-full"/);
  assert.match(html, />Catalog</, 'the label is the previous view, not "Tools"');
  assert.match(html, /<svg /, 'the arrow is a real glyph, not the ::before text fallback');
});

test('iconOnly drops the label but keeps the destination in the accessible name', () => {
  clearStored();
  withHistoryEntry();
  walkFrom('projects', 'Campaign assets - Lolly', '/#/p/abc');
  const html = backPillHtml({ class: 'me-back', iconOnly: true });
  assert.match(html, /aria-label="Back to Campaign assets"/);
  assert.doesNotMatch(html, /back-pill-label/);
});

test('a history-mode click pops the entry instead of pushing a new one', () => {
  clearStored();
  withHistoryEntry();
  walkFrom('catalog', 'Catalog - Lolly', '/#/catalog');
  const root = document.getElementById('view')!;
  root.innerHTML = backPillHtml();

  let backCalls = 0;
  Object.defineProperty(dom.window.history, 'back', { value: () => { backCalls++; }, configurable: true });

  mountBackPill(root);
  root.querySelector<HTMLElement>('[data-back-pill]')!.dispatchEvent(
    new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }),
  );
  assert.equal(backCalls, 1);
});

test('a modified click is left to the browser, so "open in new tab" still works', () => {
  clearStored();
  withHistoryEntry();
  walkFrom('catalog', 'Catalog - Lolly', '/#/catalog');
  const root = document.getElementById('view')!;
  root.innerHTML = backPillHtml();

  let backCalls = 0;
  Object.defineProperty(dom.window.history, 'back', { value: () => { backCalls++; }, configurable: true });

  mountBackPill(root);
  const ev = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true });
  root.querySelector<HTMLElement>('[data-back-pill]')!.dispatchEvent(ev);
  assert.equal(backCalls, 0);
  assert.equal(ev.defaultPrevented, false);
});

test('an intercepting view owns the click until it calls go()', () => {
  clearStored();
  withHistoryEntry();
  walkFrom('catalog', 'Catalog - Lolly', '/#/catalog');
  const root = document.getElementById('view')!;
  root.innerHTML = backPillHtml();

  let backCalls = 0;
  Object.defineProperty(dom.window.history, 'back', { value: () => { backCalls++; }, configurable: true });
  let navigated = 0;
  const onNav = (): void => { navigated++; };
  dom.window.addEventListener('lolly:navigate', onNav);

  let release: (() => void) | null = null;
  mountBackPill(root, { intercept: (go) => { release = go; return true; } });
  const pill = root.querySelector<HTMLElement>('[data-back-pill]')!;
  pill.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));

  assert.equal(backCalls + navigated, 0, 'the unsaved-work dialog is up - nothing has navigated yet');
  assert.equal(typeof release, 'function');
  release!();
  // The dialog's "Leave without saving" navigates by URL, NEVER history.back(): the
  // unsaved dialog (mountModal) pushes a same-URL history entry, so a back() would pop
  // THAT entry and keep the user in the tool - the reported bug, hit whenever the tool
  // was entered by in-app navigation (a history-mode pill). Regression guard.
  assert.equal(backCalls, 0, 'must not history.back() - it would pop the dialog entry, not leave the tool');
  assert.equal(navigated, 1, 'the dialog’s "leave" navigates to the resolved target by URL');
  assert.match(dom.window.location.href, /catalog/, 'and lands on the back target');
  dom.window.removeEventListener('lolly:navigate', onNav);
});

/* The Home escape beside the pill (mountBackPill → addHomeEscape). Naming the
 * previous view is right until two tools name each other: enter QR Code from
 * Design and the pill reads "← Design", enter Design from QR Code and it reads
 * "← QR Code Generator", and the tool view paints no other nav - so before this,
 * the front door was gone from the chrome for the rest of the session. */
test('a back target that is another tool keeps a Home escape in the chrome', () => {
  clearStored();
  withHistoryEntry();
  walkFrom('tool', 'Design - Lolly', '/design');     // arrive at the QR tool
  const root = document.getElementById('view')!;

  // The full-screen (no-sidebar) tool: the corner pill pins itself, so the pair
  // has to move into the .chrome-topleft island that resets that.
  root.innerHTML = backPillHtml();
  mountBackPill(root);
  const pill = root.querySelector<HTMLElement>('[data-back-pill]')!;
  const fab = root.querySelector<HTMLElement>('[data-home-fab]')!;
  assert.match(pill.textContent!, /Design/, 'the pill still names where you came from');
  assert.ok(fab, 'and Home is reachable without walking the chain back');
  assert.equal(fab.getAttribute('href'), '/#/');
  assert.equal(pill.parentElement!.className, 'chrome-topleft');
  assert.equal(pill.nextElementSibling, fab, 'one row, pill then FAB');

  // The sidebar variant (a tool with inputs) is already in flow - it stays in the
  // back row next to undo/redo rather than being pinned to the corner.
  root.innerHTML = backPillHtml({ class: 'sidebar-back' });
  mountBackPill(root);
  const rowPill = root.querySelector<HTMLElement>('[data-back-pill]')!;
  assert.equal(rowPill.parentElement, root, 'no corner island around a row pill');
  assert.equal(rowPill.nextElementSibling, root.querySelector('[data-home-fab]'));
});

test('a back target that IS Home gets no second Home', () => {
  clearStored();
  withHistoryEntry();
  walkFrom('gallery', 'Lolly', '/');
  const root = document.getElementById('view')!;
  root.innerHTML = backPillHtml();
  mountBackPill(root);
  assert.match(root.innerHTML, /data-back-home/, 'the pill is itself the way home');
  assert.equal(root.querySelectorAll('[data-home-fab]').length, 0, 'so a FAB would be a duplicate');
});

test('a view that renders its own Home FAB keeps exactly one', () => {
  clearStored();
  withHistoryEntry();
  walkFrom('projects', 'Campaign assets - Lolly', '/#/p/abc');
  const root = document.getElementById('view')!;
  root.innerHTML = backHomeHtml();     // the cluster 12 views already render
  mountBackPill(root);
  assert.equal(root.querySelectorAll('[data-home-fab]').length, 1);
  assert.equal(root.querySelectorAll('.chrome-topleft').length, 1, 'no island inside the island');
});

for (const layout of ['sidebar', 'design'] as const) {
  test(`${layout} Home waits for the unsaved-work decision before navigating`, () => {
    clearStored();
    walkFrom('projects', 'Campaign assets - Lolly', '/#/p/abc');
    const root = document.getElementById('view')!;
    root.innerHTML = layout === 'sidebar' ? backPillHtml({ class: 'sidebar-back' }) : backHomeHtml();
    let dirty = true;
    let intercepted = 0;
    let release: (() => void) | undefined;
    const opts = { intercept: (go: () => void): boolean => {
      intercepted++;
      if (!dirty) return false;
      release = go;
      return true;
    } };
    mountBackPill(root, opts);
    if (layout === 'design') mountHomeFab(root, opts);
    const home = root.querySelector<HTMLElement>('[data-home-fab]')!;
    const click = (): void => {
      home.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    };

    click();
    assert.equal(intercepted, 1, 'Home uses the same leave guard as Back');
    assert.equal(window.location.pathname, '/t/qr-code', 'opening or cancelling the dialog keeps the tool open');
    assert.equal(typeof release, 'function');
    release!();
    assert.equal(window.location.pathname + window.location.hash, '/#/', 'Leave without saving goes Home');

    dom.reconfigure({ url: 'http://localhost/t/qr-code' });
    dirty = false;
    click();
    assert.equal(window.location.pathname + window.location.hash, '/#/', 'a clean tool leaves immediately');
  });
}
