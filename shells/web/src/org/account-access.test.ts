// SPDX-License-Identifier: MPL-2.0
/**
 * org/index.ts - account and access close-out (plan 75 G5, G10, G18, WEBGATE).
 *
 * Pinned, against a stubbed control plane in jsdom:
 *  - the header account chip: a member's chip in the header cluster, Sign in for a
 *    visitor on an open workspace, none behind the gate and none for a guest;
 *  - the console address the chip uses is absolute, on the workspace;
 *  - Sign out on all devices posts to its own route, forgets the member on this device
 *    when it worked, and changes nothing when the route is missing or refuses;
 *  - the Share dialog no longer gets a "Work collab" row, while the presence pill's
 *    invite is registered beside the work opener;
 *  - the sign-in gate offers "Download the work saved in this browser" only when this
 *    browser holds saved work, and the button saves the backup file.
 *
 * Run directly:  node --test shells/web/src/org/account-access.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import type { HostV1 } from '@lolly-tools/core/host-v1';

const dom = new JSDOM(
  '<!doctype html><html><head></head><body><div id="app"><main id="view"><p class="loading">Loading…</p></main></div></body></html>',
  { url: 'https://instance.test/#/p', pretendToBeVisual: true },
);
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location as unknown as Location;
globalThis.history = dom.window.history as unknown as History;
globalThis.Element = dom.window.Element as unknown as typeof Element;
globalThis.HTMLElement = dom.window.HTMLElement as unknown as typeof HTMLElement;
globalThis.Node = dom.window.Node as unknown as typeof Node;
globalThis.MutationObserver = dom.window.MutationObserver as unknown as typeof MutationObserver;
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => { setTimeout(() => cb(0), 0); return 0; }) as unknown as typeof requestAnimationFrame;
(globalThis.window as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia = () => ({ matches: false });

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
let fetchLog: Array<{ url: string; method: string }> = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  fetchLog.push({ url, method: (init?.method || 'GET').toUpperCase() });
  return router(url, init);
}) as typeof fetch;
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const { initOrg, orgSession, orgConsoleUrl, signOutEverywhere, _resetOrgForTests } = await import('./index.ts');
const { _setBaseForTests } = await import('../lib/instance.ts');
const { setHostRef } = await import('../lib/host-ref.ts');
const { shareSectionBuilders, _clearShareSectionsForTests } = await import('../lib/share-sections.ts');
const { _clearAccountSlotForTests } = await import('../lib/account-slot.ts');

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
async function until(check: () => boolean, what: string): Promise<void> {
  for (let i = 0; i < 400; i++) { if (check()) return; await tick(); }
  assert.fail(`timed out waiting for ${what}`);
}
async function settle(): Promise<void> { for (let i = 0; i < 20; i++) await tick(); }

const HEADER = '<div class="gallery-topbar"><div class="gallery-topright"><a class="profile-link" href="#/settings"></a></div></div>';

function reset(): void {
  _resetOrgForTests();
  _clearShareSectionsForTests();
  _clearAccountSlotForTests();
  _setBaseForTests('');
  store.clear();
  fetchLog = [];
  document.getElementById('view')!.innerHTML = HEADER;
  router = () => new Response('', { status: 404 });
}

function controlPlane(opts: { mode: 'open' | 'gated'; session?: 'member' | 'guest' | 'none'; role?: string; can?: Record<string, boolean>; revoke?: number }): void {
  router = (url, init) => {
    if (url.endsWith('/api/v1/me/revoke-sessions') && init?.method === 'POST' && opts.revoke) return new Response(null, { status: opts.revoke });
    if (url.includes('/api/auth/config')) return json({ mode: opts.mode, provider: 'oidc', loginPath: '/login', instanceName: 'Acme' });
    if (url.includes('/api/auth/session')) {
      if (opts.session === 'member') return json({ kind: 'member', user: { sub: 'u1', email: 'ana@acme.com', name: 'Ana Ruiz', groups: [], role: opts.role ?? 'member' } });
      if (opts.session === 'guest') return json({ kind: 'guest', guest: {} });
      return new Response('', { status: 401 });
    }
    if (url.includes('/api/v1/org-config')) return json({ instance: { name: 'Acme' }, inboxUnread: 0, can: opts.can ?? {} });
    if (url.includes('/api/v1/inbox')) return json({ messages: [] });
    return new Response('', { status: 404 });
  };
}

const chipIn = (): HTMLElement | null => document.querySelector('.gallery-topright [data-account-slot] .org-account-chip');

// ── Account chip ──────────────────────────────────────────────────────────────

test('a member gets the account chip in the header', async () => {
  reset();
  controlPlane({ mode: 'open', session: 'member' });
  await initOrg();
  await until(() => !!chipIn(), 'the chip');
  assert.equal(chipIn()!.dataset.accountChip, 'member');
  assert.equal(chipIn()!.getAttribute('aria-label'), 'Signed in to Acme as Ana Ruiz');
  _resetOrgForTests();
  assert.equal(document.querySelector('[data-account-slot]'), null, 'a reset takes the chip away');
});

test('a visitor on an open workspace gets Sign in, with the account picker after a sign-out', async () => {
  reset();
  store.set('lolly:signed-out:same-origin', '1');
  controlPlane({ mode: 'open', session: 'none' });
  await initOrg();
  await until(() => !!chipIn(), 'the chip');
  const link = chipIn() as HTMLAnchorElement;
  assert.equal(link.dataset.accountChip, 'visitor');
  assert.equal(link.textContent, 'Sign in');
  assert.equal(link.getAttribute('href'), `/login?returnTo=${encodeURIComponent('/#/p')}&prompt=select_account`);
});

test('no chip behind the gate, and none for a guest', async () => {
  reset();
  controlPlane({ mode: 'gated', session: 'none' });
  const gated = await initOrg();
  assert.equal(gated?.gate, true);
  await settle();
  assert.equal(document.querySelector('[data-account-slot]'), null);
  reset();
  controlPlane({ mode: 'open', session: 'guest' });
  await initOrg();
  await settle();
  assert.equal(document.querySelector('[data-account-slot]'), null);
});

test('the console address is absolute on the workspace, and only for an admin or owner', async () => {
  reset();
  controlPlane({ mode: 'open', session: 'member', role: 'admin' });
  await initOrg();
  assert.equal(orgConsoleUrl(), 'https://instance.test/admin');
  reset();
  controlPlane({ mode: 'open', session: 'member', role: 'member' });
  await initOrg();
  assert.equal(orgConsoleUrl(), null);
  reset();
  _setBaseForTests('https://work.example/lolly');
  controlPlane({ mode: 'open', session: 'member', role: 'owner' });
  await initOrg();
  assert.equal(orgConsoleUrl(), 'https://work.example/lolly/admin', 'an app connected to a workspace links to that workspace');
  _setBaseForTests('');
});

// ── Sign out on all devices ───────────────────────────────────────────────────

test('Sign out on all devices posts to its route and forgets the member here', async () => {
  reset();
  controlPlane({ mode: 'open', session: 'member', revoke: 204 });
  await initOrg();
  assert.ok(store.has('lolly:org-config:same-origin'), 'the org-config was cached');
  assert.equal(await signOutEverywhere(), 'ok');
  assert.ok(fetchLog.some((c) => c.url.endsWith('/api/v1/me/revoke-sessions') && c.method === 'POST'));
  assert.equal(orgSession(), null, 'the member is forgotten');
  assert.equal(store.has('lolly:org-config:same-origin'), false, 'the cached org-config is dropped');
  assert.equal(store.get('lolly:signed-out:same-origin'), '1', 'the next Sign in asks for an account');
});

test('Sign out on all devices changes nothing when the route is missing or refuses', async () => {
  for (const [answer, outcome] of [[404, 'unsupported'], [405, 'unsupported'], [429, 'failed'], [500, 'failed']] as const) {
    reset();
    controlPlane({ mode: 'open', session: 'member', revoke: answer });
    await initOrg();
    assert.equal(await signOutEverywhere(), outcome, `a ${answer} answer`);
    assert.equal(orgSession()?.kind, 'member', 'still signed in');
  }
  reset();
  controlPlane({ mode: 'open', session: 'member' });
  await initOrg();
  const base = router;
  router = (url, init) => { if (url.endsWith('/revoke-sessions')) throw new Error('offline'); return base(url, init); };
  assert.equal(await signOutEverywhere(), 'failed');
  assert.equal(orgSession()?.kind, 'member');
});

// ── Duplicate collab controls (G10) ───────────────────────────────────────────

test('the Share dialog gets no extra Work collab row for a member who may join live collabs', async () => {
  reset();
  controlPlane({ mode: 'open', session: 'member', can: {} });
  await initOrg();
  const without = shareSectionBuilders().length;
  reset();
  controlPlane({ mode: 'open', session: 'member', can: { 'collab.join': true, 'collab.edit': true } });
  await initOrg();
  assert.equal(shareSectionBuilders().length, without, 'collab.join adds no Share section');
});

test('the work opener and the pill invite are registered together, and Work collab is not', () => {
  const src = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  assert.equal(src.includes("import('./collab-share.ts')"), false, 'org/index.ts no longer loads the Work collab row');
  assert.match(src, /registerWorkCollabPillInvite\(\)/, 'Invite to edit now is on the presence pill');
  const branch = src.slice(src.indexOf("import('./collab-provider.ts')"), src.indexOf('emit();', src.indexOf("import('./collab-provider.ts')")));
  assert.ok(branch.indexOf('registerWorkCollabOpener') < branch.indexOf('registerWorkCollabPillInvite'), 'after the opener it depends on');
});

// ── The gate's device work (WEBGATE) ──────────────────────────────────────────

function deviceHost(sessions: number, downloads: Array<{ name: string; size: number }>): HostV1 {
  const rows = Array.from({ length: sessions }, (_, i) => ({ slot: `s${i}`, toolId: 'qr-code', toolVersion: '1', updatedAt: '2026-10-07T00:00:00Z' }));
  const host = {
    state: {
      list: async () => rows,
      load: async () => ({ url: 'https://example.com' }),
      save: async () => {},
      delete: async () => {},
    },
    profile: { get: async () => ({ firstname: 'Ana' }), set: async () => {} },
    assets: { _exportUserAssets: async () => [], _importUserAsset: async () => {} },
    export: { download: async (blob: Blob, name: string) => { downloads.push({ name, size: blob.size }); } },
  };
  return host as unknown as HostV1;
}

const gateButton = (): HTMLButtonElement | null => document.querySelector('#org-gate-device-work [data-act="gate-device-work"]');

test('the gate offers the work saved in this browser, and saves it as a backup file', async () => {
  reset();
  const downloads: Array<{ name: string; size: number }> = [];
  setHostRef(deviceHost(2, downloads));
  controlPlane({ mode: 'gated', session: 'none' });
  const r = await initOrg();
  assert.equal(r?.gate, true);
  await until(() => !!gateButton(), 'the offer');
  assert.equal(gateButton()!.textContent, 'Download the work saved in this browser');
  assert.equal(document.getElementById('org-gate-device-work')!.hidden, false);
  gateButton()!.click();
  await until(() => downloads.length === 1, 'the backup file');
  assert.match(downloads[0]!.name, /^LollyTools-Ana-\d{4}-\d{2}-\d{2}-1\.zip$/);
  assert.ok(downloads[0]!.size > 0);
  await until(() => gateButton()!.disabled === false, 'the button back');
  assert.equal(gateButton()!.textContent, 'Download the work saved in this browser');
});

test('the gate makes no offer when this browser holds no saved work', async () => {
  reset();
  setHostRef(deviceHost(0, []));
  controlPlane({ mode: 'gated', session: 'none' });
  await initOrg();
  await settle();
  assert.equal(gateButton(), null);
  assert.equal(document.getElementById('org-gate-device-work')!.hidden, true, 'the slot stays hidden');
});

test('a failed backup says so on the gate and keeps the offer', async () => {
  reset();
  const host = deviceHost(1, []);
  (host as unknown as { profile: { get(): Promise<never> } }).profile.get = async () => { throw new Error('blocked'); };
  setHostRef(host);
  controlPlane({ mode: 'gated', session: 'none' });
  await initOrg();
  await until(() => !!gateButton(), 'the offer');
  gateButton()!.click();
  const status = (): HTMLElement => document.querySelector<HTMLElement>('#org-gate-device-work [role="status"]')!;
  await until(() => !status().hidden, 'the failure line');
  assert.equal(status().textContent, 'Data export failed. Keep your local files and try again.');
  assert.ok(gateButton(), 'the offer stays');
});
