// SPDX-License-Identifier: MPL-2.0
/**
 * The mobile profile menu's row contract + the Language child popover's
 * ownership rules (the body-popover `isInside` case).
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/components/profile-menu.test.ts
 *
 * What is pinned:
 *  - the menu carries the consolidated rows: theme segments, Home (root-absolute
 *    `/#/`, the back pill's HOME_HREF reasoning), Language (with the current
 *    language's native name), brand and settings - so utility views can hide
 *    their standalone home/language fabs on mobile against a stable replacement;
 *  - the Language row spawns the real lang-menu popover as a CHILD, and a
 *    pointerdown inside that child does NOT dismiss the parent menu under it;
 *  - closing the parent closes the child with it (the onClose cascade).
 *
 * Positioning/flip and the Escape ladder are body-popover.test.ts's business.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { AccountChipDeps } from '../org/account-chip.ts';

const dom = new JSDOM('<!doctype html><html><body><a href="#/settings" id="pl">Profile</a></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Node = dom.window.Node;
globalThis.Element = dom.window.Element;
globalThis.requestAnimationFrame = cb => { setTimeout(() => cb(0), 0); return 0; };
// Mobile breakpoint matches; the '(pointer: coarse)' back-stack probe does not.
(globalThis.window as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia =
  (q: string) => ({ matches: q.includes('max-width') });

const { attachProfileMenu, mountProfileFab, createProfileControl } = await import('./profile-menu.ts');
const { registerAccountChip } = await import('../org/account-chip.ts');
const { _clearAccountSlotForTests } = await import('../lib/account-slot.ts');

/** A host slice good enough for setTheme/switchLang signatures - never invoked
 *  here (no theme click, no language pick reaches switchLang). */
const host = {
  profile: { get: async () => ({}), set: async () => {} },
  state: { get: async () => null, set: async () => {} },
} as unknown as Parameters<typeof attachProfileMenu>[1];

const trigger = (): HTMLElement => document.getElementById('pl')!;
const menu = (): HTMLElement | null => document.querySelector('.profile-menu');
const langPop = (): HTMLElement | null => document.querySelector('.lang-menu');
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function pointerDownOn(target: Element): void {
  // jsdom has no PointerEvent constructor wired to dispatch typing - a plain
  // Event with the right type is what the document listener reads.
  const e = new dom.window.Event('pointerdown', { bubbles: true });
  target.dispatchEvent(e);
}

test('click opens the menu with the consolidated rows', async () => {
  const detach = attachProfileMenu(trigger(), host);
  trigger().dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  const el = menu();
  assert.ok(el, 'popover mounted on body');
  assert.ok(el!.querySelector('[data-theme-seg]'), 'theme segments present');
  const home = el!.querySelector<HTMLAnchorElement>('[data-act="home"]');
  assert.ok(home, 'Home row present');
  assert.equal(home!.getAttribute('href'), '/#/', 'Home is root-absolute (HOME_HREF)');
  const lang = el!.querySelector<HTMLElement>('[data-act="lang"]');
  assert.ok(lang, 'Language row present');
  assert.ok(lang!.textContent!.includes('English'), 'current language named on the row');
  assert.equal(lang!.getAttribute('aria-haspopup'), 'menu');
  assert.ok(el!.querySelector('[data-act="settings"]'), 'Settings row still present');
  detach();
  assert.equal(menu(), null, 'detach removes the popover');
});

test('opens on desktop too (no longer gated to the mobile breakpoint)', () => {
  const saved = window.matchMedia;
  // Desktop: no max-width query matches.
  (window as { matchMedia: (q: string) => { matches: boolean } }).matchMedia = () => ({ matches: false });
  try {
    const detach = attachProfileMenu(trigger(), host);
    trigger().dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    assert.ok(menu(), 'desktop click opens the consolidated menu');
    detach();
  } finally {
    window.matchMedia = saved;
  }
});

test('a modified click (open-in-new-tab) falls through to the #/settings href', () => {
  const detach = attachProfileMenu(trigger(), host);
  // A trailing listener (fires after attachProfileMenu's onClick) records whether the
  // handler left the default intact, THEN cancels it - so jsdom never follows the
  // #/settings anchor and leaks a hashchange into a later test's open menu (NAV_EVENTS).
  let handlerPrevented: boolean | null = null;
  trigger().addEventListener('click', (e) => { handlerPrevented = e.defaultPrevented; e.preventDefault(); });
  trigger().dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true }));
  assert.equal(menu(), null, 'menu did not open');
  assert.equal(handlerPrevented, false, 'handler left navigation intact for the new-tab gesture');
  detach();
});

test('Language spawns the child lang-menu; taps inside it never dismiss the parent', async () => {
  const detach = attachProfileMenu(trigger(), host);
  trigger().dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  // The row wires through a lazy import + a deferred outside-pointerdown
  // listener (both a macrotask) - settle them before interacting.
  await tick(); await tick();
  const lang = menu()!.querySelector<HTMLElement>('[data-act="lang"]');
  lang!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  await tick();
  const child = langPop();
  assert.ok(child, 'lang-menu popover opened as a child');
  assert.ok(menu(), 'parent menu still open under the child');

  // A pointerdown INSIDE the child is "inside" to the parent (isInside) - the
  // parent must survive it; the same tap anywhere else dismisses the parent.
  pointerDownOn(child!.querySelector('[data-lang]')!);
  assert.ok(menu(), 'parent survived a tap inside the child');

  // Closing the parent (detach → popover.close) cascades to the child.
  detach();
  assert.equal(menu(), null, 'parent closed');
  assert.equal(langPop(), null, 'child closed with it (onClose cascade)');
});

test('mountProfileFab appends the right-most quick link and wires the same menu', async () => {
  const cluster = document.createElement('div');
  cluster.className = 'gallery-topright';
  cluster.innerHTML = '<button class="lang-fab"></button>';
  document.body.appendChild(cluster);
  mountProfileFab(cluster, host);
  const fab = cluster.querySelector<HTMLAnchorElement>('a.profile-fab');
  assert.ok(fab, 'fab appended');
  assert.equal(fab!.getAttribute('href'), '#/settings', 'still an anchor to the profile page (for no-JS / new-tab)');
  assert.equal(cluster.lastElementChild, fab, 'appended last, so it sits right-most in the cluster');
  assert.ok(fab!.getAttribute('aria-label'), 'accessible name present');
  // A plain click opens the consolidated menu (every width).
  fab!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  assert.ok(menu(), 'click opens the consolidated menu');
  await tick();
  pointerDownOn(document.body);
  assert.equal(menu(), null);
  cluster.remove();
});

test('a pointerdown outside both popovers closes the parent', async () => {
  const detach = attachProfileMenu(trigger(), host);
  trigger().dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  await tick();
  assert.ok(menu());
  pointerDownOn(document.body);
  assert.equal(menu(), null, 'outside tap dismissed the menu');
  detach();
});

// ── Sound switch in the menu (only when the host can supply loop bytes) ─────────

/** The narrow `host` above has no assets → no sound switch. A full host does. */
const assetsHost = {
  profile: { get: async () => ({ firstname: 'Ada', headshot: { id: 'head1' } }), set: async () => {} },
  assets: { get: async () => ({ url: 'blob:head' }) },
} as unknown as Parameters<typeof attachProfileMenu>[1];

test('the Sound/Neurospicy switch appears only when the host has an assets API', () => {
  // No assets → the switch is omitted (the narrow chrome slices, color-lab/start).
  const d1 = attachProfileMenu(trigger(), host);
  trigger().dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  assert.equal(menu()!.querySelector('.profile-menu-sound'), null, 'no sound switch without assets');
  d1();
  // Full host → the switch is present.
  const d2 = attachProfileMenu(trigger(), assetsHost);
  trigger().dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  assert.ok(menu()!.querySelector('.profile-menu-sound [data-sound-switch]'), 'sound switch present with assets');
  d2();
});

// ── createProfileControl: the HUD avatar that opens the same menu ───────────────

test('createProfileControl returns an icon-only .profile-link that opens the consolidated menu', async () => {
  const link = createProfileControl(assetsHost, { className: 'stage-nav-profile' });
  assert.ok(link.classList.contains('profile-link') && link.classList.contains('stage-nav-profile'));
  assert.equal(link.getAttribute('href'), '#/settings', 'still an anchor to the profile page');
  assert.ok(link.querySelector('.profile-link-mark'), 'carries the Lolly-mark avatar');
  assert.equal(link.querySelector('.profile-link-name'), null, 'icon only - no name span');
  document.body.appendChild(link);
  await tick(); await tick();  // profile.get → assets.get (two async hops) resolve
  const img = link.querySelector<HTMLImageElement>('.profile-link-avatar');
  assert.ok(img && link.classList.contains('has-avatar'), 'headshot swapped in off first paint');
  link.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  assert.ok(menu(), 'clicking the avatar opens the consolidated menu');
  await tick();
  pointerDownOn(document.body);
  assert.equal(menu(), null);
  link.remove();
});

test('design systems open as a child picker without navigating and close with the profile menu', async () => {
  const switchHost = {
    ...host,
    designSystems: {
      list: async () => [{ id: 'one', label: 'First system' }, { id: 'two', label: 'Second system' }],
      activeId: async () => 'two',
    },
  };
  const detach = attachProfileMenu(trigger(), switchHost);
  try {
    trigger().click();
    const row = menu()!.querySelector<HTMLButtonElement>('[data-act="design-system"]')!;
    assert.equal(row.tagName, 'BUTTON');
    row.click(); await tick();
    const child = document.querySelector<HTMLElement>('.design-system-menu')!;
    assert.ok(child);
    assert.equal(child.querySelector('[aria-checked="true"]')?.textContent, 'Second system');
    pointerDownOn(child.querySelector('button')!);
    assert.ok(menu(), 'parent stays open during child interaction');
    const url = window.location.href;
    child.querySelector<HTMLButtonElement>('[aria-checked="true"]')!.click();
    assert.equal(window.location.href, url);
    assert.equal(document.querySelector('.design-system-menu'), null);
    assert.equal(document.activeElement, row);
    row.click(); await tick();
    assert.ok(document.querySelector('.design-system-menu'));
    detach();
    assert.equal(document.querySelector('.design-system-menu'), null);
  } finally { detach(); }
});


test('the profile badge and menu count reflect queue changes and standalone controls retain their badge', async () => {
  const { publishNotification, dismissNotification, _resetNotificationsForTests } = await import('../lib/notifications.ts');
  _resetNotificationsForTests(); const detach = attachProfileMenu(trigger(), host);
  const clear = publishNotification({ id: 'recovery', title: 'Saving and recovery' });
  assert.equal(trigger().querySelector('.notification-badge')?.textContent, '1');
  trigger().click(); assert.equal(menu()?.querySelector('[data-notification-count]')?.textContent, '1');
  dismissNotification('recovery'); assert.equal(menu()?.querySelector('[data-notification-count]')?.textContent, '0');
  assert.equal(trigger().querySelector<HTMLElement>('.notification-badge')?.hidden, true);
  const standalone = createProfileControl(host); assert.ok(standalone.querySelector('.notification-badge'));
  detach(); clear(); _resetNotificationsForTests();
});

function workspaceAccount({ signedIn = true, signOutWorks = true }: { signedIn?: boolean; signOutWorks?: boolean } = {}) {
  const listeners = new Set<(count: number) => void>();
  const calls = { inbox: 0, signout: 0, everywhere: 0, after: 0, routes: [] as string[] };
  const deps: AccountChipDeps = {
    account: () => ({ workspace: 'Acme', member: signedIn ? { name: 'Ana Ruiz', email: 'ana@acme.test' } : null, inbox: {
      count: () => 2, onChange(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; }, open() { calls.inbox++; },
    } }),
    consoleUrl: () => signedIn ? 'https://work.test/admin' : null,
    signInUrl: () => '/login?returnTo=%2F%23%2Fp',
    signOut: async () => { calls.signout++; return signOutWorks; },
    signOutEverywhere: async () => { calls.everywhere++; return 'ok'; },
    afterSignOut: () => { calls.after++; }, go: route => { calls.routes.push(route); },
    host: () => null, workspaceOrigin: 'https://work.test', principal: signedIn ? 'u_ana' : undefined,
  };
  return { deps, calls, listeners, unread(n: number) { for (const listener of listeners) listener(n); } };
}

test('one existing avatar menu carries Work actions, one Settings link and live inbox counts', async () => {
  _clearAccountSlotForTests();
  const account = workspaceAccount();
  const offAccount = registerAccountChip(account.deps);
  const detach = attachProfileMenu(trigger(), host);
  try {
    trigger().click();
    assert.equal(document.querySelector('.org-account-chip'), null, 'no independent account button');
    assert.equal(menu()!.querySelectorAll('[data-act="settings"]').length, 1);
    const link = menu()!.querySelector<HTMLAnchorElement>('[data-account-act="console"]')!;
    assert.equal(link.textContent, 'Admin');
    assert.equal(link.href, 'https://work.test/admin');
    assert.equal(link.target, '_blank');
    assert.equal(link.rel, 'noopener');
    assert.equal(menu()!.querySelector('.org-account-menu-head')!.textContent, 'Acme');
    assert.equal(menu()!.querySelector('[data-inbox-count]')!.textContent, '2');
    account.unread(3);
    assert.equal(menu()!.querySelector('[data-inbox-count]')!.textContent, '3');
    menu()!.querySelector<HTMLElement>('[data-account-act="inbox"]')!.click();
    assert.equal(account.calls.inbox, 1);
    assert.equal(menu(), null);
    assert.equal(account.listeners.size, 0, 'closing releases the inbox listener');
    trigger().click();
    assert.equal(menu()!.querySelector('[data-account-act="signins"]'), null, 'Settings already contains linked sign-ins');
    menu()!.querySelector<HTMLElement>('[data-account-act="projects"]')!.click();
    assert.deepEqual(account.calls.routes, ['#/p']);
  } finally { detach(); offAccount(); }
});

test('a failed shared-menu sign-out reopens with its error and keeps the profile control', async () => {
  const account = workspaceAccount({ signOutWorks: false });
  const off = registerAccountChip(account.deps), detach = attachProfileMenu(trigger(), host);
  try {
    trigger().click();
    menu()!.querySelector<HTMLElement>('[data-account-act="signout"]')!.click();
    for (let i = 0; i < 20 && !menu()?.querySelector('[role="alert"]'); i++) await tick();
    assert.equal(account.calls.signout, 1);
    assert.equal(account.calls.after, 0);
    assert.equal(menu()!.querySelector('[role="alert"]')!.textContent, 'Could not sign out. Try again.');
    assert.ok(trigger().isConnected);
    assert.equal(account.listeners.size, 1, 'only the reopened menu listens');
  } finally { detach(); off(); }
});

test('switching to a signed-out workspace removes old actions and offers Sign in on the next open', () => {
  const member = workspaceAccount(), visitor = workspaceAccount({ signedIn: false });
  const offMember = registerAccountChip(member.deps), detach = attachProfileMenu(trigger(), host);
  let offVisitor: (() => void) | null = null;
  try {
    trigger().click();
    assert.ok(menu()!.querySelector('[data-account-act="signout"]'));
    offVisitor = registerAccountChip(visitor.deps);
    assert.equal(menu()!.querySelector('[data-account-act="signout"]'), null, 'stale identity actions are removed immediately');
    assert.equal(member.listeners.size, 0);
    trigger().click(); trigger().click();
    const signIn = menu()!.querySelector<HTMLAnchorElement>('a[data-account-chip="visitor"]')!;
    assert.equal(signIn.getAttribute('href'), '/login?returnTo=%2F%23%2Fp');
    assert.equal(signIn.textContent, 'Sign in');
    assert.equal(menu()!.querySelector('[data-account-act="console"]'), null);
    assert.equal(menu()!.querySelectorAll('[data-act="settings"]').length, 1);
  } finally { detach(); offMember(); offVisitor?.(); }
});
