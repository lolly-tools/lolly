// SPDX-License-Identifier: MPL-2.0
/**
 * /profile's instance card on a workspace (plan 74 M18, and the two-person test of
 * 2026-10-03): a browser served by a workspace said "Bundled with this app" and that
 * pointing elsewhere needs the desktop app, and never said who was signed in. The card
 * now says which workspace ("Connected to lolly.ing."), says "Signed in as ..." and
 * offers the Inbox beside Sign out. A plain deployment's card is unchanged.
 *
 * Renders the real card markup (views/profile/shell.ts renderShell) and wires the real
 * handlers (views/profile/chrome.ts wireInstanceCard and wireCleanup) over a real
 * initOrg() pass, with the other cards' operations stubbed to empty strings, the same
 * harness as profile-sign-out.test.ts.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/views/profile-account.test.ts
 */
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><main id="view"></main></body></html>', {
  url: 'https://instance.test/#/settings', pretendToBeVisual: true,
});
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location as unknown as Location;
globalThis.history = dom.window.history as unknown as History;
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => { setTimeout(() => cb(0), 0); return 0; }) as unknown as typeof requestAnimationFrame;

const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as unknown as Storage;

type Handler = (url: string, init?: RequestInit) => Response;
let router: Handler = () => new Response('', { status: 404 });
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => router(String(input), init)) as typeof fetch;

const json = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

const { initOrg, orgAdminHref, orgMemberSignedIn, orgProfileAccount, signOutOfInstance, _resetOrgForTests } = await import('../org/index.ts');
const { renderShell, wireInstanceCard, wireCleanup } = { ...(await import('./profile/shell.ts')), ...(await import('./profile/chrome.ts')) };
const { getMetrics } = await import('../metrics.ts');
type ProfileViewCtx = import('./profile/context.ts').ProfileViewCtx;
type ProfileAccount = import('./profile/context.ts').ProfileAccount;

const BUNDLED = 'Bundled with this app';
const DESKTOP_LINE = /needs the desktop app/;

/** Boot the org seam: no instance at all, or a workspace with `who` signed in or not. */
async function boot(who: 'no-instance' | 'member' | 'nobody', opts: { name?: string; unread?: number; workspace?: string; security?: string } = {}): Promise<void> {
  _resetOrgForTests();
  store.clear();
  const email = 'ana@acme.test';
  router = (url) => {
    if (who === 'no-instance') return new Response('', { status: 404 });
    if (url.includes('/api/auth/config')) return json({ mode: 'open', provider: 'oidc', loginPath: '/login', instanceName: opts.workspace ?? 'Acme', passkeyManagementPath: opts.security });
    if (url.includes('/api/auth/session')) {
      return who === 'member' ? json({ kind: 'member', user: { sub: 'u1', email, role: 'member' } }) : new Response('', { status: 401 });
    }
    if (url.includes('/api/v1/org-config')) {
      return json({ instance: { name: opts.workspace ?? 'Acme' }, inboxUnread: opts.unread ?? 0, session: { sub: 'u1', email, name: opts.name ?? email } });
    }
    if (url.includes('/api/v1/inbox')) {
      const messages = Array.from({ length: opts.unread ?? 0 }, (_, i) => ({ id: `m${i}`, kind: 'notice', severity: 'info', title: `Message ${i}`, dismissible: true }));
      return json({ messages, unread: messages.length });
    }
    return new Response('', { status: 404 });
  };
  await initOrg();
}

/** Every other card's operations, as empty markup: only the instance card is under test. */
const blank = new Proxy({}, { get: () => () => '' });

function mountCard(over: Partial<ProfileViewCtx> = {}): { view: HTMLElement; pv: ProfileViewCtx } {
  const viewEl = document.getElementById('view')!;
  const pv = {
    viewEl, host: {}, params: '', profile: {}, jellyOn: false, fields: [], activeTheme: 'light',
    instanceBase: '', activeDesignSystemLabel: '', adminHref: orgAdminHref(),
    // Exactly what views/profile.ts puts on the context.
    signOut: orgMemberSignedIn() ? signOutOfInstance : null,
    account: orgProfileAccount(),
    canChangeInstance: false, shellUpdater: null, hasShellUpdater: false, headshotUrl: '', focusSync: false,
    displayName: '', metrics: getMetrics(),
    rows: blank, prefs: blank, summaries: blank,
    ...over,
  } as unknown as ProfileViewCtx;
  renderShell(pv);
  // The design-systems card mounts from its own lazy module and is not this test's business.
  viewEl.querySelector('#design-systems-body')?.remove();
  wireInstanceCard(pv);
  wireCleanup(pv);
  return { view: viewEl, pv };
}

const text = (view: HTMLElement, sel: string): string | null => view.querySelector(sel)?.textContent?.trim() ?? null;
const settle = (): Promise<void> => new Promise((res) => setTimeout(res, 20));
// A member boot starts the inbox, which polls while the tab is visible: stop it, so
// the file ends when its last case does.
after(() => { _resetOrgForTests(); });

test('a plain deployment keeps its card: bundled, the desktop line, no account row', async () => {
  await boot('no-instance');
  const { view } = mountCard();
  assert.equal(text(view, '#instance-name'), BUNDLED);
  assert.match(view.querySelector('#instance-section')!.textContent!, DESKTOP_LINE);
  assert.equal(view.querySelector('#instance-account-row'), null);
  assert.equal(view.querySelector('#instance-inbox-btn'), null);
});

test('a member on a workspace: connected to it, signed in as them, Inbox beside Sign out', async () => {
  await boot('member', { name: 'Ana Lee' });
  const { view } = mountCard();
  assert.equal(text(view, '#instance-name'), 'Connected to Acme.');
  assert.doesNotMatch(view.querySelector('#instance-section')!.textContent!, /Bundled/);
  assert.doesNotMatch(view.querySelector('#instance-section')!.textContent!, DESKTOP_LINE, 'nothing reads as missing on a workspace');
  assert.match(text(view, '#instance-section summary')!, /Acme/, 'the folded card names the workspace too');
  assert.equal(text(view, '#instance-signed-in'), 'Signed in as Ana Lee (ana@acme.test)');
  const row = view.querySelector('#instance-account-row')!;
  assert.ok(row.querySelector('#instance-inbox-btn'));
  assert.ok(row.querySelector('#instance-signout-btn'), 'Sign out sits with the account it signs out of');
  assert.equal(text(view, '#instance-inbox-btn'), 'Inbox');
  for (const id of ['#instance-inbox-btn', '#instance-signout-btn']) {
    assert.equal(view.querySelector<HTMLElement>(id)!.style.minHeight, 'var(--ui-size-target)', `${id} is a 44px target`);
  }
});

test('a member the instance knows only by address is signed in as that address', async () => {
  await boot('member');
  const { view } = mountCard();
  assert.equal(text(view, '#instance-signed-in'), 'Signed in as ana@acme.test');
});

test('unread messages show on the Inbox button', async () => {
  await boot('member', { unread: 2 });
  await settle();
  const { view } = mountCard();
  assert.equal(text(view, '#instance-inbox-btn'), 'Inbox (2)');
});

test('nobody signed in on an open workspace: connected, but no account row', async () => {
  await boot('nobody');
  const { view } = mountCard();
  assert.equal(text(view, '#instance-name'), 'Connected to Acme.');
  assert.equal(view.querySelector('#instance-account-row'), null);
  assert.equal(view.querySelector('#instance-signout-btn'), null);
});

test('the workspace name and the person\'s name are text, never markup', async () => {
  await boot('member', { name: '<img src=x onerror=alert(1)>', workspace: '<b>Acme</b>' });
  const { view } = mountCard();
  assert.equal(view.querySelector('#instance-section img, #instance-section b'), null);
  assert.equal(text(view, '#instance-name'), 'Connected to <b>Acme</b>.');
  assert.equal(text(view, '#instance-signed-in'), 'Signed in as <img src=x onerror=alert(1)> (ana@acme.test)');
});

test('the desktop app pointed at a workspace keeps its address in the folded card', async () => {
  await boot('member');
  const { view } = mountCard({ instanceBase: 'https://acme.test', canChangeInstance: true });
  assert.equal(text(view, '#instance-name'), 'Connected to Acme.');
  assert.match(text(view, '#instance-section summary')!, /https:\/\/acme\.test/);
  assert.ok(view.querySelector('#instance-change-btn'));
  assert.ok(view.querySelector('#instance-disconnect-btn'));
});

test('Inbox opens the sheet, follows the count, and lets go when the view is torn down', async () => {
  await boot('member');
  let opened = 0;
  let count = 1;
  const listeners = new Set<(n: number) => void>();
  const account: ProfileAccount = {
    workspace: 'Acme',
    member: { email: 'ana@acme.test', name: '' },
    inbox: {
      count: () => count,
      onChange(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; },
      open() { opened++; },
    },
  };
  const { view } = mountCard({ account });
  const btn = view.querySelector<HTMLButtonElement>('#instance-inbox-btn')!;
  assert.equal(btn.textContent, 'Inbox (1)');
  btn.click();
  assert.equal(opened, 1);
  count = 4;
  for (const fn of listeners) fn(count);
  assert.equal(btn.textContent, 'Inbox (4)');
  for (const fn of listeners) fn(0);
  assert.equal(btn.textContent, 'Inbox');
  assert.equal(listeners.size, 1);
  (view as HTMLElement & { _cleanup?: () => void })._cleanup!();
  assert.equal(listeners.size, 0, 'the view no longer listens once it has gone');
});

test('a remount replaces the inbox listener rather than stacking a second one', async () => {
  await boot('member');
  const listeners = new Set<(n: number) => void>();
  const account: ProfileAccount = {
    workspace: 'Acme', member: { email: 'ana@acme.test', name: '' },
    inbox: { count: () => 0, onChange(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; }, open() { /* not pressed */ } },
  };
  const { pv } = mountCard({ account });
  renderShell(pv);
  wireInstanceCard(pv);
  assert.equal(listeners.size, 1);
});

 test('passkey management appears only for a signed-in member when the workspace advertises the trusted route', async () => {
  await boot('member', {security: '/api/auth/security'});
  let card = mountCard();
  assert.equal(card.view.querySelector('#instance-security-link')?.getAttribute('href'), '/api/auth/security');
  assert.match(card.view.querySelector('#instance-security-link')?.textContent ?? '', /Account security/);
  await boot('member', {security: 'https://untrusted.test/security'}); card=mountCard();
  assert.equal(card.view.querySelector('#instance-security-link'), null);
  await boot('nobody', {security: '/api/auth/security'}); card=mountCard();
  assert.equal(card.view.querySelector('#instance-security-link'), null);
});
