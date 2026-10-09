// SPDX-License-Identifier: MPL-2.0
/**
 * org/index.ts - account and access close-out (plan 75 G5, G10, G18, WEBGATE).
 *
 * Pinned, against a stubbed control plane in jsdom:
 *  - account actions share the existing profile menu: one profile control and
 *    Settings row, Sign in for visitors, none behind the gate or for a guest;
 *  - a view without a profile control retains the standalone account chip;
 *  - the console address the chip uses is absolute, on the workspace;
 *  - Sign out on all devices posts to its own route, forgets the member on this device
 *    when it worked, and changes nothing when the route is missing or refuses;
 *  - the Share dialog no longer gets a "Work collab" row, while the presence pill's
 *    invite is registered beside the work opener;
 *  - a 401 from either sign-out route (the session already ended elsewhere) still signs
 *    this device out;
 *  - the managed sign-in gate offers no local backup or export, even when both
 *    team-copy custody stores fail and derived templates/tools remain in the profile;
 *  - missing or rejected sign-in links do not let a managed gate mount the app;
 *  - authenticated backups remain available through the existing Settings exporter.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/org/account-access.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';
import { JSDOM } from 'jsdom';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { exportBackup } from '../data-transfer.ts';
import { memoryDb } from '../bridge/idb-memory.test-utils.ts';
import { createStateAPI, type StateDb } from '../bridge/state.ts';
import { createProfileAPI, type ProfileDb } from '../bridge/profile.ts';
import { createUserTemplateStore } from '../lib/user-templates.ts';
import { createUserToolStore } from '../lib/user-tools.ts';

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

const { initOrg, initOrgWithAuth, orgSession, orgConsoleUrl, signOutEverywhere, signOutOfInstance, _resetOrgForTests } = await import('./index.ts');
const { _setBaseForTests } = await import('../lib/instance.ts');
const { setHostRef } = await import('../lib/host-ref.ts');
const { shareSectionBuilders, _clearShareSectionsForTests } = await import('../lib/share-sections.ts');
const { accountSlotRegistered, _clearAccountSlotForTests } = await import('../lib/account-slot.ts');
const { attachProfileMenu } = await import('../components/profile-menu.ts');
let detachProfileMenu: (() => void) | null = null;
const durable = await import('./team-origin-durable.ts');
test.beforeEach(() => {
  durable._setDurableBackendForTests({
    get: async () => undefined, put: async () => {}, delete: async () => {},
    all: async () => [], clear: async () => {},
  });
});
test.afterEach(() => { detachProfileMenu?.(); detachProfileMenu = null; durable._setDurableBackendForTests(null); });

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
async function until(check: () => boolean, what: string): Promise<void> {
  for (let i = 0; i < 400; i++) { if (check()) return; await tick(); }
  assert.fail(`timed out waiting for ${what}`);
}
async function settle(): Promise<void> { for (let i = 0; i < 20; i++) await tick(); }

const HEADER = '<div class="gallery-topbar"><div class="gallery-topright"><a class="profile-link" href="#/settings"></a></div></div>';

function reset(): void {
  detachProfileMenu?.();
  detachProfileMenu = null;
  _resetOrgForTests();
  _clearShareSectionsForTests();
  _clearAccountSlotForTests();
  _setBaseForTests('');
  store.clear();
  fetchLog = [];
  document.getElementById('view')!.innerHTML = HEADER;
  router = () => new Response('', { status: 404 });
}

function controlPlane(opts: { mode: 'open' | 'gated'; session?: 'member' | 'guest' | 'none'; role?: string; can?: Record<string, boolean>; revoke?: number; logout?: number }): void {
  router = (url, init) => {
    if (url.endsWith('/api/v1/me/revoke-sessions') && init?.method === 'POST' && opts.revoke) return new Response(null, { status: opts.revoke });
    if (url.endsWith('/api/auth/logout') && init?.method === 'POST' && opts.logout) return new Response(null, { status: opts.logout });
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

function openProfileMenu(): HTMLElement {
  const trigger = document.querySelector<HTMLElement>('.gallery-topright > .profile-link')!;
  detachProfileMenu = attachProfileMenu(trigger, { profile: { get: async () => ({}), set: async () => {} } });
  trigger.click();
  const menu = document.querySelector<HTMLElement>('.profile-menu');
  assert.ok(menu, 'the existing profile control opens its menu');
  assert.equal(document.querySelectorAll('.gallery-topright > .profile-link').length, 1);
  assert.equal(chipIn(), null, 'no duplicate account control beside the profile');
  assert.equal(menu.querySelectorAll('[data-act="settings"]').length, 1, 'Settings remains reachable once');
  assert.equal(menu.querySelector('[data-account-act="signins"]'), null, 'linked sign-ins remain in Settings');
  return menu;
}

// ── Account menu and standalone fallback ──────────────────────────────────────

test('a member gets account actions in the existing profile menu', async () => {
  reset();
  controlPlane({ mode: 'open', session: 'member' });
  await initOrg();
  await until(accountSlotRegistered, 'the account menu registration');
  const menu = openProfileMenu();
  assert.equal(menu.querySelector('.org-account-menu-head')?.textContent, 'Acme');
  assert.equal(menu.querySelector('.org-account-menu-line')?.textContent, 'ana@acme.com');
  for (const action of ['inbox', 'projects', 'signout', 'everywhere']) assert.ok(menu.querySelector(`[data-account-act="${action}"]`));
  const session = orgSession();
  assert.ok(session?.kind === 'member');
  assert.equal(session.user.name, 'Ana Ruiz');
  _resetOrgForTests();
  assert.equal(accountSlotRegistered(), false);
  assert.equal(menu.querySelector('[data-account-act]'), null, 'a reset removes the account actions');
  assert.ok(document.querySelector('.profile-link'), 'the existing profile control stays');
});

test('a visitor on an open workspace gets Sign in, with the account picker after a sign-out', async () => {
  reset();
  store.set('lolly:signed-out:same-origin', '1');
  controlPlane({ mode: 'open', session: 'none' });
  await initOrg();
  await until(accountSlotRegistered, 'the account menu registration');
  const menu = openProfileMenu();
  const link = menu.querySelector<HTMLAnchorElement>('[data-account-chip="visitor"]');
  assert.ok(link);
  assert.equal(link.dataset.accountChip, 'visitor');
  assert.equal(link.textContent, 'Sign in');
  assert.equal(link.getAttribute('href'), `/login?returnTo=${encodeURIComponent('/#/p')}&prompt=select_account`);
  assert.equal(menu.querySelector('[data-account-act]'), null, 'visitors get no member actions');
});

test('views without a profile control retain the member chip or visitor Sign in', async () => {
  for (const session of ['member', 'none'] as const) {
    reset();
    document.getElementById('view')!.innerHTML = '<div class="gallery-topright"></div>';
    controlPlane({ mode: 'open', session });
    await initOrg();
    await until(() => !!chipIn(), 'the standalone account chip');
    const chip = chipIn()!;
    assert.equal(chip.dataset.accountChip, session === 'member' ? 'member' : 'visitor');
    if (session === 'member') assert.equal(chip.getAttribute('aria-label'), 'Signed in to Acme as Ana Ruiz');
    else {
      assert.equal(chip.textContent, 'Sign in');
      assert.equal(chip.getAttribute('href'), `/login?returnTo=${encodeURIComponent('/#/p')}`);
    }
  }
});

test('no chip behind the gate, and none for a guest', async () => {
  reset();
  controlPlane({ mode: 'gated', session: 'none' });
  const gated = await initOrg();
  assert.equal(gated?.gate, true);
  await settle();
  assert.equal(document.querySelector('[data-account-slot]'), null);
  assert.equal(accountSlotRegistered(), false);
  reset();
  controlPlane({ mode: 'open', session: 'guest' });
  await initOrg();
  await settle();
  assert.equal(document.querySelector('[data-account-slot]'), null);
  assert.equal(accountSlotRegistered(), false);
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

test('a session that already ended elsewhere (401) still signs this device out, by either route', async () => {
  for (const run of [async () => signOutEverywhere(), async () => signOutOfInstance()]) {
    reset();
    controlPlane({ mode: 'open', session: 'member', revoke: 401, logout: 401 });
    await initOrg();
    assert.ok(store.has('lolly:org-config:same-origin'));
    const outcome = await run();
    assert.ok(outcome === 'ok' || outcome === true, `signed out (${String(outcome)})`);
    assert.equal(orgSession(), null, 'the member is forgotten');
    assert.equal(store.has('lolly:org-config:same-origin'), false, 'with their cached name, address and id');
    assert.equal(store.get('lolly:signed-out:same-origin'), '1');
  }
});

test('Sign out on all devices drops the team-document origins too (plan 75 G17)', async () => {
  const durable = await import('./team-origin-durable.ts');
  type Rec = import('./team-origin-durable.ts').DurableTeamOrigin;
  const rows = new Map<string, Rec>();
  durable._setDurableBackendForTests({
    get: async (key) => rows.get(key), put: async (rec) => { rows.set(rec.key, rec); },
    delete: async (key) => { rows.delete(key); }, all: async () => [...rows.values()], clear: async () => { rows.clear(); },
  });
  try {
    reset();
    controlPlane({ mode: 'open', session: 'member', revoke: 204 });
    await initOrg();
    store.set('lolly:org-config:same-origin', JSON.stringify({ at: Date.now(), etag: null, config: { instance: { name: 'Acme' }, session: { sub: 'u1' } } }));
    assert.equal(await durable.rememberDurableTeamOrigin({ sessionId: 's1', toolId: 'poster', slot: 'poster:1', role: 'editor' }), true);
    assert.equal(await signOutEverywhere(), 'ok');
    assert.equal(rows.size, 0, 'no record is left, and no copy was opened');
  } finally {
    durable._setDurableBackendForTests(null);
  }
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

// ── Managed sign-in protects all local work ────────────────────────────────────

/** Persist actual session and profile records before observing the gate's host calls. */
type BackupHost = Parameters<typeof exportBackup>[0]['host'];
async function savedDevice(): Promise<{ host: HostV1 & BackupHost; reads: string[]; files: Blob[] }> {
  const { db } = memoryDb();
  const state = createStateAPI(db as unknown as StateDb);
  const profile = createProfileAPI(db as unknown as ProfileDb, { channel: null });
  const values = { url: 'https://synthetic-private-team.test', logo: 'user/team/synthetic-file' };
  await state.save('qr-code:team-copy', { ...values, __toolId: 'qr-code', __toolVersion: '1.0.0' });
  await state.save('qr-code:personal', { url: 'https://synthetic-personal.test', __toolId: 'qr-code', __toolVersion: '1.0.0' });
  await profile.set({ firstname: 'Ana' });
  await createUserTemplateStore({ profile }).save({ toolId: 'qr-code', name: 'Derived team template', values });
  await createUserToolStore({ profile }).save({ baseToolId: 'qr-code', title: 'Derived team tool', values });
  assert.equal((await state.list()).length, 2, 'ordinary saved records really exist');
  const saved = await profile.get();
  assert.equal(saved.userTemplates?.length, 1);
  assert.equal((await createUserToolStore({ profile }).list()).length, 1);
  const reads: string[] = [];
  const files: Blob[] = [];
  const host = {
    state: {
      ...state,
      list: async () => { reads.push('state.list'); return state.list(); },
      load: async (slot: string) => { reads.push('state.load'); return state.load(slot); },
    },
    profile: { ...profile, get: async () => { reads.push('profile.get'); return profile.get(); } },
    assets: { _exportUserAssets: async () => {
      reads.push('assets.export');
      return [{ id: 'user/team/synthetic-file', format: 'png', blob: new Blob(['synthetic-team-file'], { type: 'image/png' }) }];
    }, _importUserAsset: async () => {} },
    fileHistory: { export: async () => { reads.push('history.export'); return { assetVersions: [], operations: [] }; } },
    export: { download: async (blob: Blob) => { reads.push('download'); files.push(blob); } },
  } as unknown as HostV1 & BackupHost;
  return { host, reads, files };
}

function assertGateHasNoExport(reads: string[], files: Blob[]): void {
  assert.ok(document.querySelector('.org-gate'), 'the managed gate is rendered');
  assert.equal(document.querySelector('#org-gate-device-work'), null, 'no dormant backup slot');
  assert.equal(document.querySelector('[data-act="gate-device-work"]'), null, 'no backup action');
  assert.doesNotMatch(document.querySelector('.org-gate')!.textContent!, /download|export/i);
  assert.deepEqual(reads, [], 'the gate reads no saved state, profile, templates, tools, assets or history');
  assert.deepEqual(files, [], 'nothing leaves the device');
}

for (const failure of ['none', 'dual-write', 'unreadable'] as const) {
  test(`the managed gate reads and exports no local work (${failure} custody failure)`, async () => {
    reset();
    const { host, reads, files } = await savedDevice();
    setHostRef(host);
    const originalStorage = globalThis.localStorage;
    let originWrites = 0;
    if (failure !== 'none') {
      store.set('lolly:org-config:same-origin', JSON.stringify({ config: { session: { sub: 'u1' } } }));
      globalThis.localStorage = {
        ...originalStorage,
        getItem: (key: string) => {
          if (failure === 'unreadable' && (key.includes('org-config') || key === durable.TEAM_COPY_SLOTS_KEY)) throw new Error('Synthetic unreadable custody/config');
          return originalStorage.getItem(key);
        },
        setItem: (key: string, value: string) => {
          if (key === durable.TEAM_COPY_SLOTS_KEY) throw new Error('Synthetic copy-list write failure');
          originalStorage.setItem(key, value);
        },
      } as Storage;
      durable._setDurableBackendForTests({
        get: async () => undefined, delete: async () => {}, clear: async () => {},
        put: async () => { originWrites++; throw new Error('Synthetic origin write failure'); },
        all: async () => { if (failure === 'unreadable') throw new Error('Synthetic origin read failure'); return []; },
      });
      if (failure === 'dual-write') {
        assert.equal(await durable.rememberDurableTeamOrigin({ slot: 'qr-code:team-copy', toolId: 'qr-code', sessionId: 'synthetic-session', role: 'editor' }), false);
        assert.equal(originWrites, 1, 'the origin write really failed after the copy-list write failed');
        assert.equal(store.has(durable.TEAM_COPY_SLOTS_KEY), false, 'no companion classification was saved');
      }
    }
    try {
      controlPlane({ mode: 'gated', session: 'none' });
      assert.equal((await initOrg())?.gate, true);
      await settle();
      assertGateHasNoExport(reads, files);
      const signIn = document.querySelector<HTMLAnchorElement>('.org-gate a');
      assert.equal(signIn?.textContent, 'Sign in');
      assert.match(signIn!.getAttribute('href')!, /^\/login\?returnTo=/, 'sign-in is still available');
      assert.equal(fetchLog.some(({ url }) => url.includes('/api/v1/org-config')), false, 'no member settings request before sign-in');
    } finally { globalThis.localStorage = originalStorage; }
  });
}

for (const loginPath of [null, '', 'javascript:alert(1)']) {
  test(`a managed gate with an unavailable sign-in link stays closed (${JSON.stringify(loginPath)})`, async () => {
    reset();
    const { host, reads, files } = await savedDevice();
    setHostRef(host);
    controlPlane({ mode: 'gated', session: 'none' });
    const result = await initOrgWithAuth({ mode: 'gated', provider: 'oidc', loginPath });
    assert.equal(result?.gate, true, 'boot must stop even with no usable sign-in action');
    await settle();
    assertGateHasNoExport(reads, files);
    assert.equal(document.querySelector('.org-gate a'), null);
    assert.match(document.querySelector('.org-gate')!.textContent!, /did not supply a usable sign-in link/);
  });
}

test('a missing gate mount point still refuses managed boot', async () => {
  reset();
  const view = document.getElementById('view')!;
  view.remove();
  try {
    controlPlane({ mode: 'gated', session: 'none' });
    assert.equal((await initOrg())?.gate, true);
  } finally { document.getElementById('app')!.append(view); }
});

test('authenticated Settings backups still carry the saved work and derived profile records', async () => {
  reset();
  const { host, reads } = await savedDevice();
  setHostRef(host);
  controlPlane({ mode: 'gated', session: 'member' });
  assert.equal((await initOrg())?.gate, false);
  assert.equal(orgSession()?.kind, 'member');
  const { exportBackup } = await import('../data-transfer.ts');
  const { blob } = await exportBackup({ host, storage: localStorage });
  const zip = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  const sessions = JSON.parse(strFromU8(zip['sessions.json']!)) as Array<{ slot: string }>;
  assert.deepEqual(sessions.map(({ slot }) => slot).sort(), ['qr-code:personal', 'qr-code:team-copy']);
  const profile = JSON.parse(strFromU8(zip['profile.json']!)) as { userTemplates: Array<{ values: { url: string } }>; userTools: Array<{ values: { url: string } }> };
  assert.equal(profile.userTemplates[0]!.values.url, 'https://synthetic-private-team.test');
  assert.equal(profile.userTools[0]!.values.url, 'https://synthetic-private-team.test');
  assert.ok(reads.includes('state.list') && reads.includes('profile.get'));
});
