// SPDX-License-Identifier: MPL-2.0
/**
 * /profile's "Sign out" (tester audit, 2026-10): members of an instance had no way to
 * switch people in the app. The instance card offers it to every signed-in member, not
 * only an admin, and to nobody on a plain deployment.
 *
 * Renders the real card markup (views/profile/shell.ts renderShell) and wires the real
 * handler (views/profile/chrome.ts wireInstanceCard) over a real initOrg() pass, with the
 * other cards' operations stubbed to empty strings - they are not what is under test. A
 * success navigates to the app root. A browser loads the page afresh there (the target has
 * no fragment, so it is not an in-page jump); jsdom only moves the address, and the
 * address is what these cases read.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/views/profile-sign-out.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM, VirtualConsole } from 'jsdom';

const START = 'https://instance.test/#/settings';
/** Each page load jsdom was asked for and does not perform (it follows only a change
 *  of hash), by the address it was asked at: how a case sees `location.reload()`. */
const reloads: string[] = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', (e: Error) => {
  if (/navigation/.test(e.message)) reloads.push(String(location.href));
  else console.error(e);
});
const dom = new JSDOM('<!doctype html><html><body><main id="view"></main></body></html>', {
  url: START, pretendToBeVisual: true, virtualConsole,
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
const requests: Array<{ url: string; method: string }> = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  requests.push({ url, method: (init?.method || 'GET').toUpperCase() });
  return router(url, init);
}) as typeof fetch;

const json = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

const { initOrg, orgAdminHref, orgMemberSignedIn, signOutOfInstance, _resetOrgForTests } = await import('../org/index.ts');
const { renderShell, wireInstanceCard } = { ...(await import('./profile/shell.ts')), ...(await import('./profile/chrome.ts')) };
const { getMetrics } = await import('../metrics.ts');
type ProfileViewCtx = import('./profile/context.ts').ProfileViewCtx;

const ORG_CONFIG_KEY = 'lolly:org-config:same-origin';

/** Boot the org seam as `who`, with the logout route answering `logout`. */
async function boot(who: 'member' | 'admin' | 'guest' | 'none' | 'no-instance', logout: () => Response = () => new Response(null, { status: 204 })): Promise<void> {
  _resetOrgForTests();
  store.clear();
  router = (url) => {
    if (who === 'no-instance') return new Response('', { status: 404 });
    if (url.includes('/api/auth/config')) return json({ mode: 'gated', provider: 'oidc', loginPath: '/login' });
    if (url.includes('/api/auth/session')) {
      if (who === 'guest') return json({ kind: 'guest', guest: {} });
      if (who === 'none') return new Response('', { status: 401 });
      return json({ kind: 'member', user: { sub: 'u1', email: 'ana@acme.test', role: who === 'admin' ? 'admin' : 'member' } });
    }
    if (url.includes('/api/v1/org-config')) return json({ instance: { name: 'Acme' }, inboxUnread: 0 });
    if (url.includes('/api/auth/logout')) return logout();
    return new Response('', { status: 404 });
  };
  dom.reconfigure({ url: START });
  await initOrg();
  requests.length = 0;
}

/** Every other card's operations, as empty markup: only the instance card is under test. */
const blank = new Proxy({}, { get: () => () => '' });

function mountCard(): HTMLElement {
  const viewEl = document.getElementById('view')!;
  const pv = {
    viewEl, host: {}, params: '', profile: {}, jellyOn: false, fields: [], activeTheme: 'light',
    instanceBase: '', activeDesignSystemLabel: '', adminHref: orgAdminHref(),
    // Exactly what views/profile.ts puts on the context.
    signOut: orgMemberSignedIn() ? signOutOfInstance : null,
    canChangeInstance: false, shellUpdater: null, hasShellUpdater: false, headshotUrl: '', focusSync: false,
    displayName: '', metrics: getMetrics(),
    rows: blank, prefs: blank, summaries: blank,
  } as unknown as ProfileViewCtx;
  renderShell(pv);
  // The design-systems card mounts from its own lazy module and is not this test's business.
  viewEl.querySelector('#design-systems-body')?.remove();
  wireInstanceCard(pv);
  return viewEl;
}

const settle = (): Promise<void> => new Promise((res) => setTimeout(res, 10));

test('Sign out shows for every signed-in member, beside the console for an admin', async () => {
  await boot('member');
  let view = mountCard();
  assert.ok(view.querySelector('#instance-signout-btn'), 'a member who is not an admin can sign out');
  assert.equal(view.querySelector('#instance-console-link'), null, 'the console stays admin-only');
  assert.equal(view.querySelector<HTMLElement>('#instance-signout-error')?.hidden, true, 'no error before a press');

  await boot('admin');
  view = mountCard();
  assert.ok(view.querySelector('#instance-console-link'));
  assert.ok(view.querySelector('#instance-signout-btn'));
});

test('no Sign out without a member session: no instance, a guest, or nobody signed in', async () => {
  for (const who of ['no-instance', 'guest', 'none'] as const) {
    await boot(who);
    const view = mountCard();
    assert.equal(view.querySelector('#instance-signout-btn'), null, who);
    assert.equal(view.querySelector('#instance-signout-error'), null, `${who}: no error line either`);
  }
});

test('pressing Sign out logs out with the instance, forgets the cache, then reloads at the app root', async () => {
  await boot('member');
  assert.ok(store.has(ORG_CONFIG_KEY), 'the member boot cached its org-config');
  const view = mountCard();
  const btn = view.querySelector<HTMLButtonElement>('#instance-signout-btn')!;
  btn.click();
  await settle();
  assert.deepEqual(requests.filter((r) => r.method !== 'GET'), [{ url: '/api/auth/logout', method: 'POST' }]);
  assert.equal(store.has(ORG_CONFIG_KEY), false, 'the next person cannot stand on this one\'s org-config');
  assert.equal(location.href, 'https://instance.test/', 'off to the app root, where boot asks again who is here');
  assert.equal(btn.disabled, true, 'nothing to press again while the page goes');
  assert.equal(view.querySelector<HTMLElement>('#instance-signout-error')!.hidden, true);

  // Back can restore this very page from the back/forward cache, still showing the
  // person who left. A page restored that way loads afresh; an ordinary show does not.
  reloads.length = 0;
  window.dispatchEvent(new dom.window.PageTransitionEvent('pageshow', { persisted: false }));
  assert.deepEqual(reloads, []);
  window.dispatchEvent(new dom.window.PageTransitionEvent('pageshow', { persisted: true }));
  assert.equal(reloads.length, 1, 'the restored page reloads');
});

test('a failed Sign out says so under the row, keeps the person signed in and reloads nothing', async () => {
  for (const [label, logout] of [
    ['refused', () => new Response('{"error":{"code":"CSRF_BLOCKED"}}', { status: 403, headers: { 'content-type': 'application/json' } })],
    ['offline', () => { throw new Error('offline'); }],
  ] as const) {
    await boot('member', logout);
    const view = mountCard();
    const btn = view.querySelector<HTMLButtonElement>('#instance-signout-btn')!;
    btn.click();
    await settle();
    const err = view.querySelector<HTMLElement>('#instance-signout-error')!;
    assert.equal(err.hidden, false, `${label}: the failure is visible`);
    assert.equal(err.textContent, 'Could not sign out. Try again.');
    assert.equal(btn.disabled, false, `${label}: the person can try again`);
    assert.equal(location.href, START, `${label}: no reload`);
    assert.ok(store.has(ORG_CONFIG_KEY), `${label}: nothing was forgotten`);
    assert.equal(orgMemberSignedIn(), true, `${label}: still signed in`);
  }
});
