// SPDX-License-Identifier: MPL-2.0
/**
 * org/index.ts - the control-plane seam.
 *
 * Covers the three things that MUST hold:
 *   - dormancy: no control plane ⇒ initOrg resolves null fast, the field-policy
 *     registry stays empty, and the negative is remembered (one probe max);
 *   - the gate decision truth table (auth mode × session kind);
 *   - a member's org-config populating the generic field-policy registry + the
 *     admin-console accessor.
 *
 * Network is the global fetch (org routes everything through instanceFetch, which
 * is plain window.fetch for the same-origin relative paths used here). jsdom
 * supplies the DOM the gate renders into; a Map-backed localStorage stub backs the
 * negative cache. No IndexedDB is touched (instancePath is a no-op with no base).
 *
 * Run directly:  node --test shells/web/src/org/index.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM(
  '<!doctype html><html><body><div id="app"><main id="view"><p class="loading">Loading…</p></main></div></body></html>',
  { url: 'https://instance.test/#/tool/qr-code', pretendToBeVisual: true },
);
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location as unknown as Location;
globalThis.history = dom.window.history as unknown as History;
// announce() (a11y.ts) waits a frame before it speaks: the inbox announces new messages.
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => { setTimeout(() => cb(0), 0); return 0; }) as unknown as typeof requestAnimationFrame;

// Map-backed localStorage (jsdom's is fine, but an explicit stub is controllable).
const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as unknown as Storage;

// A reassignable fetch router + call log.
type Handler = (url: string, init?: RequestInit) => Response;
let router: Handler = () => new Response('', { status: 404 });
let fetchLog: Array<{ url: string; method: string }> = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  fetchLog.push({ url, method: (init?.method || 'GET').toUpperCase() });
  return router(url, init);
}) as typeof fetch;

const json = (body: unknown, extra: Record<string, string> = {}, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...extra } });

const { initOrg, orgConfig, orgSession, orgAdminHref, orgMemberSignedIn, orgProfileAccount, signOutOfInstance, orgFlagGovernance, applyOrgToolPolicies, _resetOrgForTests } = await import('./index.ts');
const { hasInstanceSession, setInstanceSession } = await import('../lib/instance.ts');
const { flagHidden, isFlagOn, flagEnabled, hydrateFeatureFlags, NEUROSPICY_FLAG, JELLY_FLAG, STRIP_UPLOAD_META_FLAG } = await import('../feature-flags.ts');
const { getFieldPolicy, _clearFieldPoliciesForTests } = await import('../lib/field-policy.ts');
const { getInputPolicy, notifyToolInputMount, _clearInputPoliciesForTests } = await import('../lib/input-policy.ts');
const ORG_CONFIG_KEY = 'lolly:org-config:same-origin';
const { getExportPolicy, exportAffordance, _clearExportPolicyForTests } = await import('../lib/export-policy.ts');
const { aiAllowed } = await import('../lib/ai-policy.ts');
const { openApprovalRequest, _clearApprovalOpenerForTests } = await import('../lib/approval-request.ts');
const { registerSendTarget, sendTargetId, sendTargetsFor, unregisterSendTarget } = await import('../lib/send-target.ts');

function reset(): void {
  _resetOrgForTests();
  _clearFieldPoliciesForTests();
  _clearInputPoliciesForTests();
  _clearExportPolicyForTests();
  _clearApprovalOpenerForTests();
  store.clear();
  fetchLog = [];
  document.getElementById('view')!.innerHTML = '<p class="loading">Loading…</p>';
  router = () => new Response('', { status: 404 });
}

type SessionKind = 'member' | 'guest' | 'none';
function controlPlane(opts: {
  mode: 'open' | 'gated' | 'per-tool';
  session?: SessionKind;
  role?: string;
  orgConfig?: unknown;
  /** Extra auth-config fields: instanceName, inviteOnly. */
  auth?: Record<string, unknown>;
  /** Extra fields on the session's user (a name). */
  user?: Record<string, unknown>;
}): void {
  router = (url) => {
    if (url.includes('/api/auth/config')) return json({ mode: opts.mode, provider: 'oidc', loginPath: '/login', ...opts.auth });
    if (url.includes('/api/auth/session')) {
      if (opts.session === 'member') return json({ kind: 'member', user: { sub: 'u1', email: 'me@corp', groups: [], role: opts.role ?? 'member', ...opts.user } });
      if (opts.session === 'guest') return json({ kind: 'guest', guest: {} });
      return new Response('', { status: 401 });
    }
    if (url.includes('/api/v1/org-config')) return json(opts.orgConfig ?? { instance: { name: 'Acme' }, inboxUnread: 0 });
    return new Response('', { status: 404 });
  };
}

// ── Dormancy ──────────────────────────────────────────────────────────────────

test('dormant: no control plane (404) resolves null and leaves the registry empty', async () => {
  reset();
  const r = await initOrg();
  assert.equal(r, null);
  assert.equal(getFieldPolicy('email'), undefined);
});

test('dormant: a probe network error resolves null (never throws to boot)', async () => {
  reset();
  router = () => { throw new Error('offline'); };
  const r = await initOrg();
  assert.equal(r, null);
});

test('dormant: a 200 HTML page (misrouted /api) is NOT mistaken for a control plane', async () => {
  reset();
  router = (url) => (url.includes('/api/auth/config')
    ? new Response('<!doctype html><html></html>', { status: 200, headers: { 'content-type': 'text/html' } })
    : new Response('', { status: 404 }));
  assert.equal(await initOrg(), null);
});

test('dormant negative is remembered - a later boot skips even the probe', async () => {
  reset();
  await initOrg();
  assert.ok(fetchLog.length >= 1, 'first boot probes once');
  // Simulate a fresh page session (module state reset) but keep localStorage.
  _resetOrgForTests();
  fetchLog = [];
  const r = await initOrg();
  assert.equal(r, null);
  assert.equal(fetchLog.length, 0, 'no probe when the origin is remembered-absent');
});

test('dormant on a 5xx, but the negative is NOT remembered - the next boot probes again', async () => {
  reset();
  router = (url) => (url.includes('/api/auth/config')
    ? new Response('', { status: 503 })
    : new Response('', { status: 404 }));
  assert.equal(await initOrg(), null);
  assert.equal(store.get('lolly:org-absent:same-origin'), undefined, 'a server error is not "no instance"');
  _resetOrgForTests();
  fetchLog = [];
  controlPlane({ mode: 'open', session: 'member' });
  const r = await initOrg();
  assert.ok(fetchLog.some(c => c.url.includes('/api/auth/config')), 'probed again');
  assert.ok(r, 'the control plane is found once it answers');
});

// ── Gate decision truth table (mode × session) ────────────────────────────────

test('gate decision truth table', async () => {
  const cases: Array<{ mode: 'open' | 'gated' | 'per-tool'; session: SessionKind; gate: boolean }> = [
    { mode: 'open', session: 'member', gate: false },
    { mode: 'open', session: 'guest', gate: false },
    { mode: 'open', session: 'none', gate: false },
    { mode: 'gated', session: 'member', gate: false },
    { mode: 'gated', session: 'guest', gate: true },
    { mode: 'gated', session: 'none', gate: true },
    { mode: 'per-tool', session: 'member', gate: false },
    { mode: 'per-tool', session: 'none', gate: false },
  ];
  for (const c of cases) {
    reset();
    controlPlane({ mode: c.mode, session: c.session });
    const r = await initOrg();
    const label = `${c.mode}/${c.session}`;
    assert.ok(r, `${label}: control plane detected`);
    assert.equal(r!.gate, c.gate, `${label}: gate flag`);
    assert.equal(!!document.querySelector('.org-gate'), c.gate, `${label}: gate card rendered iff gated`);
  }
});

test('a sign-in gate stops catalog reads and is remembered; no gate leaves the catalog alone', async () => {
  const { catalogRefused, resetCatalogAccessForTests } = await import('../lib/catalog-access.ts');
  const cases: Array<{ mode: 'open' | 'gated' | 'per-tool'; session: SessionKind; gate: boolean }> = [
    { mode: 'gated', session: 'none', gate: true },
    { mode: 'gated', session: 'guest', gate: true },
    { mode: 'gated', session: 'member', gate: false },
    { mode: 'open', session: 'none', gate: false },
    { mode: 'per-tool', session: 'none', gate: false },
  ];
  for (const c of cases) {
    reset();
    resetCatalogAccessForTests();
    controlPlane({ mode: c.mode, session: c.session });
    const r = await initOrg();
    const label = `${c.mode}/${c.session}`;
    assert.equal(r!.gate, c.gate, `${label}: gate flag`);
    assert.equal(catalogRefused(), c.gate, `${label}: catalog reads stop iff gated`);
    assert.equal(store.has('lolly:catalog-refused:same-origin'), c.gate, `${label}: remembered for the next boot iff gated`);
  }
  resetCatalogAccessForTests();
});

test('gate builds a login link carrying returnTo=<current path>', async () => {
  reset();
  controlPlane({ mode: 'gated', session: 'none' });
  await initOrg();
  const link = document.querySelector<HTMLAnchorElement>('.org-gate a.btn--primary');
  assert.ok(link, 'sign-in link present');
  const href = link!.getAttribute('href')!;
  assert.ok(href.startsWith('/login?returnTo='), href);
  assert.ok(href.includes(encodeURIComponent('/#/tool/qr-code')), 'returnTo preserves the requested path');
});

test('the gate\'s Sign in is a 44px finger target, keeping its width', async () => {
  reset();
  controlPlane({ mode: 'gated', session: 'none' });
  await initOrg();
  const link = document.querySelector<HTMLAnchorElement>('.org-gate a.btn--primary')!;
  // The .btn padding alone made it 32px tall on a phone (tester audit, 2026-10). The
  // floor is the shared touch-target token. jsdom cannot resolve a custom property, so
  // the token's value is read from styles/tokens.css.
  assert.equal(link.style.minHeight, 'var(--ui-size-target)');
  assert.equal(link.style.minWidth, '9rem');
  const tokens = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');
  assert.match(tokens, /--ui-size-target:\s*44px;/);
});

test('a native shell\'s code sign-in on the gate has the same finger floor', async () => {
  reset();
  controlPlane({ mode: 'gated', session: 'none' });
  // What isTauriShell() looks for; the gate's own calls are relative, so none of them
  // takes the native transport.
  const w = window as unknown as { __TAURI_INTERNALS__?: unknown };
  w.__TAURI_INTERNALS__ = { invoke: async () => null };
  try {
    await initOrg();
    const btn = document.querySelector<HTMLButtonElement>('#org-gate-device-btn');
    assert.ok(btn, 'the gate offers a code sign-in in a native shell');
    assert.equal(btn.style.minHeight, 'var(--ui-size-target)');
  } finally {
    delete w.__TAURI_INTERNALS__;
  }
});

// ── The gate says which workspace and which account to use (plan 74 M18) ────

/** The gate card's heading and its lines of copy, as a person reads them. */
function gateCopy(): { heading: string; lines: string[] } {
  const card = document.querySelector('.org-gate-card')!;
  return {
    heading: card.querySelector('h1')!.textContent!,
    lines: [...card.querySelectorAll('p')].map((p) => p.textContent!),
  };
}

test('the gate names the workspace and says which account to sign in with', async () => {
  reset();
  controlPlane({ mode: 'gated', session: 'none', auth: { instanceName: 'lolly.ing', inviteOnly: true } });
  await initOrg();
  assert.deepEqual(gateCopy(), {
    heading: 'Sign in to lolly.ing',
    lines: ['lolly.ing is a private Lolly workspace. Sign in with the account your invitation went to.'],
  });
  assert.ok(document.querySelector('.org-gate a.btn--primary'), 'the Sign in link stays');
});

test('an older instance with no name keeps the gate\'s plain copy', async () => {
  reset();
  controlPlane({ mode: 'gated', session: 'none' });
  await initOrg();
  assert.deepEqual(gateCopy(), {
    heading: 'Sign in to continue',
    lines: ['This Lolly instance asks you to sign in before you continue.'],
  });
});

test('a workspace that is not invite-only names itself but does not mention an invitation', async () => {
  reset();
  controlPlane({ mode: 'gated', session: 'none', auth: { instanceName: 'Acme', inviteOnly: false } });
  await initOrg();
  assert.deepEqual(gateCopy(), {
    heading: 'Sign in to Acme',
    lines: ['This Lolly instance asks you to sign in before you continue.'],
  });
});

test('a team link on the gate says the project opens after sign-in', async () => {
  reset();
  controlPlane({ mode: 'gated', session: 'none', auth: { instanceName: 'lolly.ing' } });
  dom.reconfigure({ url: 'https://instance.test/#/team/project/p1' });
  try {
    await initOrg();
    assert.deepEqual(gateCopy().lines, [
      'lolly.ing is a private Lolly workspace. Sign in with the account your invitation went to.',
      'Sign in to open the team project you were sent.',
    ]);
    const href = document.querySelector<HTMLAnchorElement>('.org-gate a.btn--primary')!.getAttribute('href')!;
    assert.ok(href.includes(encodeURIComponent('/#/team/project/p1')), 'and the sign-in comes back to the link');
  } finally {
    dom.reconfigure({ url: 'https://instance.test/#/tool/qr-code' });
  }
});

test('the workspace name on the gate is text, never markup', async () => {
  reset();
  controlPlane({ mode: 'gated', session: 'none', auth: { instanceName: '<img src=x onerror=alert(1)>' } });
  await initOrg();
  const card = document.querySelector('.org-gate-card')!;
  assert.equal(card.querySelector('img'), null);
  assert.equal(gateCopy().heading, 'Sign in to <img src=x onerror=alert(1)>');
});

// ── The profile card's account half (plan 74 M18) ────────────────────────────

test('orgProfileAccount: null without a control plane, so the profile card is unchanged', async () => {
  reset();
  await initOrg();
  assert.equal(orgProfileAccount(), null);
});

test('orgProfileAccount: the workspace, who is signed in and the inbox count', async () => {
  reset();
  controlPlane({
    mode: 'gated', session: 'member', user: { email: 'sam@work.test' }, auth: { instanceName: 'from-auth' },
    orgConfig: { instance: { name: ' lolly.ing ' }, inboxUnread: 3, session: { sub: 'u1', email: 'sam@work.test', name: 'Sam Kim' } },
  });
  await initOrg();
  const account = orgProfileAccount()!;
  assert.equal(account.workspace, 'lolly.ing', 'the org-config name wins, trimmed');
  assert.deepEqual(account.member, { email: 'sam@work.test', name: 'Sam Kim' });
  assert.ok(account.inbox);
});

test('orgProfileAccount: a name that is only the address again is dropped; the session\'s own name wins', async () => {
  reset();
  controlPlane({
    mode: 'open', session: 'member', user: { email: 'Sam@Work.test' },
    orgConfig: { instance: { name: 'Acme' }, inboxUnread: 0, session: { sub: 'u1', email: 'Sam@Work.test', name: 'sam@work.test' } },
  });
  await initOrg();
  assert.deepEqual(orgProfileAccount()!.member, { email: 'Sam@Work.test', name: '' });

  reset();
  controlPlane({
    mode: 'open', session: 'member', user: { email: 'sam@work.test', name: 'Sam' },
    orgConfig: { instance: { name: 'Acme' }, inboxUnread: 0, session: { sub: 'u1', email: 'sam@work.test', name: 'Samuel Kim' } },
  });
  await initOrg();
  assert.equal(orgProfileAccount()!.member!.name, 'Sam');
});

test('orgProfileAccount: nobody signed in on an open workspace, or a guest: the name from the auth config only', async () => {
  for (const session of ['none', 'guest'] as const) {
    reset();
    controlPlane({ mode: 'open', session, auth: { instanceName: 'lolly.ing' } });
    await initOrg();
    assert.deepEqual(orgProfileAccount(), { workspace: 'lolly.ing', member: null, inbox: null }, session);
  }
});

// ── The inbox starts for every member (plan 74 M14, M18) ─────────────────────

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
async function settle(): Promise<void> { for (let i = 0; i < 20; i++) await tick(); }
// A member boot starts the inbox, which polls while the tab is visible: stop it, so
// the file ends when its last case does.
test.after(() => { _resetOrgForTests(); });

test('a member boot starts the inbox: it fetches at once when the org-config counts unread messages', async () => {
  reset();
  controlPlane({ mode: 'open', session: 'member', orgConfig: { instance: { name: 'Acme' }, inboxUnread: 2 } });
  const member = router;
  router = (url, init) => url.includes('/api/v1/inbox') ? json({ messages: [], unread: 0 }) : member(url, init);
  await initOrg();
  await settle();
  assert.ok(fetchLog.some((c) => c.url.includes('/api/v1/inbox')), 'the inbox was fetched');
  reset();
});

test('the profile\'s Inbox follows the live inbox and opens the sheet', async () => {
  reset();
  const Dlg = dom.window.HTMLDialogElement.prototype as unknown as { showModal(): void; close(): void };
  Dlg.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
  Dlg.close = function (this: HTMLDialogElement) { this.removeAttribute('open'); };
  controlPlane({ mode: 'open', session: 'member', auth: { instanceName: 'lolly.ing' }, orgConfig: { instance: { name: 'lolly.ing' }, inboxUnread: 2 } });
  const member = router;
  const messages = [
    { id: 'm1', kind: 'notice', severity: 'info', title: 'Welcome to lolly.ing', dismissible: true },
    { id: 'm2', kind: 'notice', severity: 'info', title: 'Sam accepted your invitation', dismissible: true },
  ];
  router = (url, init) => url.includes('/api/v1/inbox') ? json({ messages, unread: 2 }) : member(url, init);
  const account = (await initOrg(), orgProfileAccount())!;
  assert.equal(account.inbox!.count(), 2, 'the org-config count stands in while the inbox loads');
  const counts: number[] = [];
  const off = account.inbox!.onChange((n) => counts.push(n));
  await settle();
  assert.equal(account.inbox!.count(), 2);
  const { dismissMessage } = await import('./inbox.ts');
  dismissMessage('m1');
  assert.equal(account.inbox!.count(), 1);
  assert.equal(counts.at(-1), 1, 'a dismiss elsewhere reaches the profile\'s count');
  off();
  dismissMessage('m2');
  assert.equal(counts.at(-1), 1, 'and an unsubscribed view hears nothing more');

  account.inbox!.open();
  await settle();
  const sheet = document.querySelector('dialog.inbox-sheet, .inbox-sheet');
  assert.ok(sheet, 'the inbox sheet opened');
  assert.match(sheet.textContent!, /Messages from lolly\.ing/);
  const { _resetInboxSheetForTests } = await import('./inbox-sheet.ts');
  _resetInboxSheetForTests();
  document.querySelectorAll('dialog').forEach((d) => { d.remove(); });
  reset();
});

test('a member with nothing unread: the inbox waits for the tab to come back before it asks', async () => {
  reset();
  controlPlane({ mode: 'open', session: 'member', orgConfig: { instance: { name: 'Acme' }, inboxUnread: 0 } });
  await initOrg();
  await settle();
  assert.equal(fetchLog.some((c) => c.url.includes('/api/v1/inbox')), false);
  reset();
});

test('no inbox without a member: a guest, nobody, or no control plane', async () => {
  for (const session of ['guest', 'none'] as const) {
    reset();
    controlPlane({ mode: 'open', session, orgConfig: { instance: { name: 'Acme' }, inboxUnread: 5 } });
    await initOrg();
    await settle();
    assert.equal(fetchLog.some((c) => c.url.includes('/api/v1/inbox')), false, session);
  }
  reset();
  await initOrg();
  await settle();
  assert.equal(fetchLog.some((c) => c.url.includes('/api/v1/inbox')), false, 'dormant');
});

// ── Member org-config → generic field-policy registry + admin accessor ────────

test('member org-config populates the generic field-policy registry', async () => {
  reset();
  controlPlane({
    mode: 'open',
    session: 'member',
    role: 'admin',
    orgConfig: {
      instance: { name: 'Acme' },
      inboxUnread: 0,
      profilePolicy: {
        email: { mode: 'locked', source: 'idp', value: 'me@corp.example' },
        phone: { mode: 'hidden' },
        city: { mode: 'editable' },
      },
    },
  });
  const r = await initOrg();
  assert.equal(r!.gate, false);
  assert.deepEqual(getFieldPolicy('email'), { mode: 'locked', note: 'Managed by Acme', value: 'me@corp.example' });
  assert.deepEqual(getFieldPolicy('phone'), { mode: 'hidden', note: undefined, value: undefined });
  assert.deepEqual(getFieldPolicy('city'), { mode: 'editable', note: undefined, value: undefined });
  assert.equal(getFieldPolicy('firstname'), undefined, 'undeclared fields keep no policy');
  assert.equal(orgConfig()?.instance.name, 'Acme');
  assert.equal(orgSession()?.kind, 'member');
  assert.equal(orgAdminHref(), '/admin', 'admin role exposes the console href');
});

test('member org-config adds fixed delivery beside a personal target, then session loss withdraws only the org target', async () => {
  reset();
  registerSendTarget({
    kind: 's3', label: 'My S3', available: () => true,
    send: async () => ({ label: 'done' }),
  });
  try {
    controlPlane({
      mode: 'open', session: 'member',
      orgConfig: {
        instance: { name: 'Acme' }, inboxUnread: 0,
        destinations: [{
          id: 'archive', kind: 's3', label: 'Acme archive', formats: ['png'],
          maxBytes: 1024, visibility: 'private',
        }],
      },
    });
    await initOrg();
    assert.deepEqual(sendTargetsFor('png').map(sendTargetId), ['s3', 'org:archive']);

    controlPlane({ mode: 'open', session: 'guest' });
    await initOrg();
    assert.deepEqual(sendTargetsFor('png').map(sendTargetId), ['s3']);
  } finally {
    _resetOrgForTests();
    unregisterSendTarget('s3');
  }
});

test('orgAdminHref is null for a non-admin member and when dormant', async () => {
  reset();
  controlPlane({ mode: 'open', session: 'member', role: 'member' });
  await initOrg();
  assert.equal(orgAdminHref(), null);
  reset();
  await initOrg(); // dormant
  assert.equal(orgAdminHref(), null);
});

// ── Sign out (any member, from the profile view's instance card) ──────────────

test('orgMemberSignedIn: every member, not only an admin; never a guest or a plain deployment', async () => {
  for (const [label, opts, want] of [
    ['admin', { mode: 'open', session: 'member', role: 'admin' }, true],
    ['member', { mode: 'open', session: 'member', role: 'member' }, true],
    ['guest', { mode: 'open', session: 'guest' }, false],
    ['signed out', { mode: 'open', session: 'none' }, false],
  ] as const) {
    reset();
    controlPlane(opts);
    await initOrg();
    assert.equal(orgMemberSignedIn(), want, label);
  }
  reset();
  await initOrg(); // dormant: no control plane at all
  assert.equal(orgMemberSignedIn(), false, 'no instance');
});

/** A member boot whose logout answers `logout`; records each logout request's init. */
async function memberThenLogout(logout: () => Response): Promise<Array<RequestInit | undefined>> {
  reset();
  controlPlane({ mode: 'gated', session: 'member' });
  const member = router;
  const seen: Array<RequestInit | undefined> = [];
  router = (url, init) => {
    if (url.includes('/api/auth/logout')) { seen.push(init); return logout(); }
    return member(url, init);
  };
  await initOrg();
  return seen;
}

test('signOutOfInstance: the console\'s request - POST /api/auth/logout, no body, no token', async () => {
  const seen = await memberThenLogout(() => new Response(null, { status: 204 }));
  fetchLog = [];
  assert.equal(await signOutOfInstance(), true);
  assert.deepEqual(fetchLog, [{ url: '/api/auth/logout', method: 'POST' }]);
  assert.equal(seen.length, 1);
  assert.equal(seen[0]!.body, undefined, 'no body, like the console');
  const headers = new Headers(seen[0]!.headers);
  assert.equal(headers.has('content-type'), false);
  assert.equal(headers.has('authorization'), false, 'the cookie is the credential; the guard needs no token');
});

test('signOutOfInstance forgets what would show the old person, and nothing else', async () => {
  await memberThenLogout(() => new Response(null, { status: 204 }));
  const managedAi = 'lolly:managed-ai:same-origin';
  assert.ok(store.has(ORG_CONFIG_KEY), 'the member boot cached its org-config');
  assert.ok(store.has(managedAi), 'and noted that this instance manages AI');
  await setInstanceSession('lw_session=abc');
  assert.ok(hasInstanceSession());

  assert.equal(await signOutOfInstance(), true);
  assert.equal(store.has(ORG_CONFIG_KEY), false, 'the 24h org-config cache is per instance, not per person');
  assert.equal(hasInstanceSession(), false, 'a native shell\'s parked session pair is gone');
  assert.equal(orgSession(), null);
  assert.equal(orgConfig(), null);
  assert.equal(orgMemberSignedIn(), false);
  assert.ok(store.has(managedAi), 'a fact about the instance, not the person, stays');
});

test('after a sign-out the gate asks the identity provider for its account picker, until a member signs in', async () => {
  const signInHref = (): string => document.querySelector<HTMLAnchorElement>('.org-gate a.btn--primary')!.getAttribute('href')!;
  // An ordinary gate: the plain link, so a returning person is not asked to pick again.
  reset();
  controlPlane({ mode: 'gated', session: 'none' });
  await initOrg();
  assert.ok(!signInHref().includes('prompt='), signInHref());

  await memberThenLogout(() => new Response(null, { status: 204 }));
  assert.equal(await signOutOfInstance(), true);
  // The load that follows, on the same device (storage kept): nobody is signed in. The
  // provider still has the old person's session, and only the picker lets someone else in.
  _resetOrgForTests();
  controlPlane({ mode: 'gated', session: 'none' });
  await initOrg();
  assert.ok(signInHref().endsWith('&prompt=select_account'), signInHref());
  assert.ok(signInHref().includes(`returnTo=${encodeURIComponent('/#/tool/qr-code')}`), 'returnTo is unchanged');

  // The next member session clears the note.
  _resetOrgForTests();
  controlPlane({ mode: 'gated', session: 'member' });
  await initOrg();
  _resetOrgForTests();
  document.getElementById('view')!.innerHTML = '';
  controlPlane({ mode: 'gated', session: 'none' });
  await initOrg();
  assert.ok(!signInHref().includes('prompt='), 'a later gate is the plain link again');
});

test('signOutOfInstance: a refusal or a network failure changes nothing', async () => {
  for (const [label, logout] of [
    ['403 from the cross-site guard', () => json({ error: { code: 'CSRF_BLOCKED' } }, {}, 403)],
    ['5xx', () => new Response('', { status: 502 })],
    ['network error', () => { throw new Error('offline'); }],
  ] as const) {
    await memberThenLogout(logout);
    await setInstanceSession('lw_session=abc');
    assert.equal(await signOutOfInstance(), false, label);
    assert.ok(store.has(ORG_CONFIG_KEY), `${label}: the cache stays`);
    assert.ok(hasInstanceSession(), `${label}: the session pair stays`);
    assert.equal(orgMemberSignedIn(), true, `${label}: still signed in`);
  }
  await setInstanceSession(null);
});

// ── Member org-config → generic input-policy registry (the sidebar seam) ──────

test('applyOrgToolPolicies maps the per-tool contract onto the input-policy registry', async () => {
  reset();
  controlPlane({
    mode: 'open',
    session: 'member',
    orgConfig: {
      instance: { name: 'Acme' },
      inboxUnread: 0,
      tools: {
        'event-badge': {
          inputs: [
            { id: 'logo', access: { level: 'locked', value: 'acme/logo' } },
            { id: 'accent', access: { level: 'choice', allow: ['#0c322c', '#30ba78'] } },
          ],
          hidden: ['discount'],
        },
      },
    },
  });
  await initOrg();

  // Dormant until a tool mounts and the installer runs.
  assert.equal(getInputPolicy('event-badge', 'logo'), undefined);
  applyOrgToolPolicies();

  assert.deepEqual(getInputPolicy('event-badge', 'logo'), { mode: 'locked', note: 'Managed by Acme', value: 'acme/logo' });
  assert.equal(getInputPolicy('event-badge', 'accent')?.mode, 'choice');
  assert.deepEqual(getInputPolicy('event-badge', 'accent')?.allow, ['#0c322c', '#30ba78']);
  assert.equal(getInputPolicy('event-badge', 'discount')?.mode, 'hidden', 'hidden id wins');
  assert.equal(getInputPolicy('event-badge', 'headline'), undefined, 'unpolicied input untouched');
  assert.equal(getInputPolicy('qr-code', 'logo'), undefined, 'a tool the config does not govern has nothing');

  // A second run (the next mount) is the same set again: every governed tool
  // stays installed, so a surface hosting several tools reads them all.
  applyOrgToolPolicies();
  assert.equal(getInputPolicy('event-badge', 'logo')?.mode, 'locked', 'still installed after another mount');
});

test('applyOrgToolPolicies carries the policy attribution through to the registry', async () => {
  reset();
  controlPlane({
    mode: 'open',
    session: 'member',
    orgConfig: {
      instance: { name: 'Acme' },
      inboxUnread: 0,
      tools: {
        'event-badge': {
          inputs: [
            { id: 'logo', access: { level: 'locked', value: 'acme/logo', by: 'Brand guardrails', reason: 'One mark per campaign' } },
            { id: 'accent', access: { level: 'choice', allow: ['#0c322c'], by: 'Brand guardrails' } },
            { id: 'headline', access: { level: 'locked', value: 'Hi' } },
          ],
        },
      },
    },
  });
  await initOrg();
  applyOrgToolPolicies();

  // WHICH policy locked it, and why, is what turns a dead control into an answer.
  assert.equal(getInputPolicy('event-badge', 'logo')?.by, 'Brand guardrails');
  assert.equal(getInputPolicy('event-badge', 'logo')?.reason, 'One mark per campaign');
  // A narrowed select is attributed the same way; no reason means no reason.
  assert.equal(getInputPolicy('event-badge', 'accent')?.by, 'Brand guardrails');
  assert.equal(getInputPolicy('event-badge', 'accent')?.reason, undefined);
  // An input the instance governs but does not attribute keeps the exact object
  // shape it had before this field existed - absent keys, not undefined ones.
  assert.deepEqual(
    getInputPolicy('event-badge', 'headline'),
    { mode: 'locked', note: 'Managed by Acme', value: 'Hi' },
  );
});

test('applyOrgToolPolicies is a dormant no-op with no control plane', async () => {
  reset();
  await initOrg(); // dormant
  applyOrgToolPolicies();
  assert.equal(getInputPolicy('event-badge', 'logo'), undefined);
});

test('a member boot installs the tool-mount hook: a mount governs the sidebar with no view importing org/', async () => {
  reset();
  controlPlane({
    mode: 'open',
    session: 'member',
    orgConfig: {
      instance: { name: 'Acme' },
      inboxUnread: 0,
      tools: {
        'event-badge': {
          inputs: [{ id: 'logo', access: { level: 'locked', value: 'acme/logo' } }],
          hidden: ['discount'],
        },
      },
    },
  });
  await initOrg();
  // The tool view's mount announcement (lib/input-policy.ts) is the whole wire.
  notifyToolInputMount('event-badge');
  assert.equal(getInputPolicy('event-badge', 'logo')?.mode, 'locked');
  assert.equal(getInputPolicy('event-badge', 'discount')?.mode, 'hidden');
  notifyToolInputMount('qr-code');
  assert.equal(getInputPolicy('event-badge', 'logo')?.mode, 'locked', 'the next mount keeps every governed tool installed');

  // A tool already open when the member branch runs is governed at once.
  reset();
  notifyToolInputMount('event-badge');
  assert.equal(getInputPolicy('event-badge', 'logo'), undefined, 'dormant until the org module registers');
  controlPlane({
    mode: 'open',
    session: 'member',
    orgConfig: { instance: { name: 'Acme' }, inboxUnread: 0, tools: { 'event-badge': { inputs: [{ id: 'logo', access: { level: 'locked', value: 'acme/logo' } }] } } },
  });
  await initOrg();
  assert.equal(getInputPolicy('event-badge', 'logo')?.mode, 'locked', 'late registration replays the open tool');

  // A dormant boot registers nothing: a mount installs nothing.
  reset();
  await initOrg();
  notifyToolInputMount('event-badge');
  assert.equal(getInputPolicy('event-badge', 'logo'), undefined);
});

test('the Team share section leads, and is built in the same task once its module is loaded', async () => {
  const { shareSectionBuilders, shareSectionPlacement, shareSectionOrder } = await import('../lib/share-sections.ts');
  reset();
  controlPlane({ mode: 'open', session: 'member' });
  await initOrg();
  const team = shareSectionBuilders().filter((b) => shareSectionPlacement(b) === 'lead');
  assert.equal(team.length, 1, 'one lead section: Team');
  assert.equal(shareSectionOrder(team[0]!), -10);
  const ctx = { toolId: 'qr-code', baseParts: [], copy: async () => {} };
  const first = team[0]!(ctx);
  // Loaded already when the idle preload ran first; otherwise the first build waits for the module.
  if (first && 'then' in first) await first;
  const again = team[0]!(ctx);
  assert.ok(!(again && 'then' in again), 'a loaded module builds directly, so the section mounts with the surface');
  _resetOrgForTests();
});

// ── Member org-config → generic export-policy seam + approval opener ──────────

test('member export capabilities + per-tool approvalChain populate the export-policy seam', async () => {
  reset();
  controlPlane({
    mode: 'open',
    session: 'member',
    orgConfig: {
      instance: { name: 'Acme' },
      inboxUnread: 0,
      can: { 'export.download': false, 'export.request': true },
      tools: {
        'event-badge': { approvalChain: 'brand-signoff', formats: ['svg', 'pdf'] },
        'poster': { approvalChain: 'legal-review', formats: [] },
        'qr-code': {},
      },
    },
  });
  await initOrg();

  const policy = getExportPolicy();
  assert.ok(policy, 'export policy installed for a member');
  assert.equal(policy!.canDownload, false);
  assert.equal(policy!.canRequestApproval, true);
  assert.equal(policy!.approvalChainFor('event-badge'), 'brand-signoff');
  assert.equal(policy!.approvalChainFor('poster'), 'legal-review');
  assert.equal(policy!.approvalChainFor('qr-code'), undefined, 'a tool without approvalChain is ungated');
  assert.deepEqual(policy!.formatsFor('event-badge'), ['svg', 'pdf'], 'per-tool format policy reaches the seam');
  assert.deepEqual(policy!.formatsFor('poster'), [], 'an empty list is a real policy, passed through - the view decides');
  assert.equal(policy!.formatsFor('qr-code'), undefined, 'a tool without a format policy is unrestricted');
  assert.equal(exportAffordance(policy), 'request-approval', 'withheld-but-requestable → the approval CTA');
  // A member registers the approval opener (so the swapped CTA can open the flow).
  assert.equal(openApprovalRequest({ toolId: 'event-badge' }), true, 'opener registered for a member');
});

test('export.download absent defaults to allowed (byte-identical to today)', async () => {
  reset();
  controlPlane({
    mode: 'open',
    session: 'member',
    orgConfig: { instance: { name: 'Acme' }, inboxUnread: 0, can: { 'export.request': true } },
  });
  await initOrg();
  const policy = getExportPolicy();
  assert.equal(policy!.canDownload, true, 'unspecified download stays allowed - only explicit false withholds');
  assert.equal(exportAffordance(policy), 'download');
});

test('export-policy seam + approval opener are dormant with no control plane', async () => {
  reset();
  await initOrg(); // dormant
  assert.equal(getExportPolicy(), undefined);
  assert.equal(exportAffordance(getExportPolicy()), 'download');
  assert.equal(openApprovalRequest({ toolId: 'event-badge' }), false, 'no opener registered when dormant');
});

test('a non-member never fetches member-only org-config, and leaves the registry empty', async () => {
  reset();
  controlPlane({ mode: 'open', session: 'guest' });
  const r = await initOrg();
  assert.equal(r!.gate, false);
  assert.equal(orgConfig(), null);
  assert.equal(getFieldPolicy('email'), undefined);
  assert.ok(!fetchLog.some(c => c.url.includes('/api/v1/org-config')), 'org-config not requested for a guest');
});

// ── Resilient org-config cache + offline/failure fail-closed semantics ─────────

// A control plane that authenticates a member and delegates the org-config response
// to the supplied handler (so a test can make it succeed, 5xx, or throw).
function memberPlane(orgConfigHandler: (url: string, init?: RequestInit) => Response): void {
  router = (url, init) => {
    if (url.includes('/api/auth/config')) return json({ mode: 'open', provider: 'oidc', loginPath: '/login' });
    if (url.includes('/api/auth/session')) return json({ kind: 'member', user: { sub: 'u1', role: 'member' } });
    if (url.includes('/api/v1/org-config')) return orgConfigHandler(url, init);
    return new Response('', { status: 404 });
  };
}

test('resilient cache: a successful member org-config load is persisted with its ETag', async () => {
  reset();
  memberPlane(() => json({ instance: { name: 'Acme' }, inboxUnread: 0 }, { etag: 'W/"v1"' }));
  await initOrg();
  const raw = store.get(ORG_CONFIG_KEY);
  assert.ok(raw, 'org-config cached under the instance-base key');
  const rec = JSON.parse(raw!);
  assert.equal(rec.config.instance.name, 'Acme');
  assert.equal(rec.etag, 'W/"v1"');
  assert.equal(typeof rec.at, 'number');
});

test('resilient cache: a failed refetch within TTL falls back to the cached policy', async () => {
  reset();
  // First boot succeeds and caches a policy that ALLOWS download.
  memberPlane(() => json({ instance: { name: 'Acme' }, inboxUnread: 0 }, { etag: 'W/"v1"' }));
  await initOrg();
  assert.ok(store.get(ORG_CONFIG_KEY), 'first boot cached the good copy');

  // A fresh page session (module state reset) keeps localStorage; the control plane is
  // present but org-config now 5xxs.
  _resetOrgForTests();
  fetchLog = [];
  document.getElementById('view')!.innerHTML = '<p class="loading">Loading…</p>';
  memberPlane(() => new Response('boom', { status: 503 }));
  const r = await initOrg();

  assert.equal(r!.gate, false);
  assert.equal(orgConfig()?.instance.name, 'Acme', 'served the cached org-config, not dropped policy');
  assert.equal(getExportPolicy()!.canDownload, true, 'cached policy honoured - NOT failed closed');
  assert.equal(exportAffordance(getExportPolicy()), 'download');
  assert.equal(getInputPolicy('qr-code', 'url'), undefined, 'inputs not force-locked when a valid cache exists');
});

test('resilient cache: a cached copy past the TTL is dropped and gated actions fail closed', async () => {
  reset();
  // Seed a stale cache (26h old, older than the 24h TTL) directly.
  store.set(ORG_CONFIG_KEY, JSON.stringify({
    at: Date.now() - 26 * 60 * 60 * 1000, etag: 'W/"old"',
    config: { instance: { name: 'Acme' }, inboxUnread: 0 },
  }));
  memberPlane(() => new Response('boom', { status: 503 }));
  const r = await initOrg();

  assert.equal(r!.gate, false);
  assert.equal(orgConfig(), null, 'stale policy is not served past the TTL');
  assert.equal(store.get(ORG_CONFIG_KEY), undefined, 'the expired cache entry is evicted');
  // Export fails closed: no direct download, only the (more restrictive) approval path.
  assert.equal(getExportPolicy()!.canDownload, false);
  assert.equal(exportAffordance(getExportPolicy()), 'request-approval');
  // Inputs fail closed: every input reads as locked read-only.
  assert.equal(getInputPolicy('qr-code', 'url')?.mode, 'locked');
});

test('resilient cache: no cache + unreachable org-config ⇒ fail closed (never open)', async () => {
  reset();
  memberPlane(() => { throw new Error('offline'); }); // org-config network error
  const r = await initOrg();
  assert.equal(r!.gate, false, 'the app still mounts - an outage is a non-event, not a gate');
  assert.equal(orgConfig(), null);
  assert.equal(getExportPolicy()!.canDownload, false, 'export fails closed with no cache');
  assert.equal(exportAffordance(getExportPolicy()), 'request-approval');
  assert.equal(getInputPolicy('event-badge', 'logo')?.mode, 'locked', 'inputs fail closed with no cache');
  assert.equal(getInputPolicy('event-badge', 'logo')?.note, 'Managed by your organisation');
});

test('AI: legacy member config and cached AI approval never grant a fresh lease', async () => {
  reset();
  memberPlane(() => json({ instance: { name: 'Acme' }, inboxUnread: 0 }));
  await initOrg();
  assert.equal(aiAllowed('ocr'), false, 'legacy Work has no execution policy');
  const ai = { version: 1, enabled: true, capabilities: ['ocr'], maxAgeSeconds: 60 };
  memberPlane(() => json({ instance: { name: 'Acme' }, inboxUnread: 0, ai }));
  await initOrg();
  assert.equal(aiAllowed('ocr'), true);
  memberPlane(() => new Response('offline', { status: 503 }));
  await initOrg();
  assert.equal(orgConfig()?.instance.name, 'Acme', 'UI can still use its bounded cache');
  assert.equal(aiAllowed('ocr'), false, 'AI requires live confirmation');
});

test('resilient cache: dormant (no control plane) writes no cache and stays byte-identical', async () => {
  reset();
  const r = await initOrg();
  assert.equal(r, null);
  assert.equal(store.get(ORG_CONFIG_KEY), undefined, 'no org-config cache when there is no control plane');
  assert.equal(getExportPolicy(), undefined, 'export seam stays dormant');
  assert.equal(getInputPolicy('qr-code', 'url'), undefined, 'inputs untouched when dormant');
});

test('resilient cache: happy-path fresh load is unchanged (no fail-closed overlay)', async () => {
  reset();
  memberPlane(() => json({ instance: { name: 'Acme' }, inboxUnread: 0 }));
  await initOrg();
  assert.equal(orgConfig()?.instance.name, 'Acme');
  assert.equal(getExportPolicy()!.canDownload, true, 'download stays allowed on a fresh success');
  assert.equal(getInputPolicy('qr-code', 'url'), undefined, 'no fail-closed input overlay on a fresh success');
});

// ── Feature-flag governance (control plane sets default + visibility) ──────────

test('feature-flag governance: defaults apply, hidden flags force default and drop the toggle', async () => {
  reset();
  controlPlane({
    mode: 'gated', session: 'member',
    orgConfig: {
      instance: { name: 'Acme' }, inboxUnread: 0,
      featureFlags: {
        // strip-metadata is built-in OFF; the org forces it ON as a default.
        [STRIP_UPLOAD_META_FLAG.id]: { default: true, hidden: false },
        // jelly is built-in ON; the org stages it hidden + OFF (a suppressed toggle).
        [JELLY_FLAG.id]: { default: false, hidden: true },
      },
    },
  });
  await initOrg();

  // Governance is surfaced through the accessor.
  assert.deepEqual(orgFlagGovernance(STRIP_UPLOAD_META_FLAG.id), { default: true, hidden: false });
  assert.equal(flagHidden(JELLY_FLAG.id), true);
  assert.equal(flagHidden(NEUROSPICY_FLAG.id), false); // no opinion ⇒ shown

  // A user who hasn't chosen gets the control-plane default…
  const fresh = { featureFlags: {} } as unknown as Parameters<typeof isFlagOn>[0];
  assert.equal(isFlagOn(fresh, STRIP_UPLOAD_META_FLAG), true);
  // …and a hidden flag is forced to its default even against a saved value.
  const savedOn = { featureFlags: { [JELLY_FLAG.id]: true } } as unknown as Parameters<typeof isFlagOn>[0];
  assert.equal(isFlagOn(savedOn, JELLY_FLAG), false, 'hidden default wins over the stored value');
  assert.equal(flagEnabled(savedOn, JELLY_FLAG.id), false);

  // The synchronous mirror agrees: hidden forced off, unset default forced on.
  hydrateFeatureFlags(savedOn);
  const mirror = JSON.parse(store.get('lolly:featureFlags') || '{}');
  assert.equal(mirror[JELLY_FLAG.id], false);
  assert.equal(mirror[STRIP_UPLOAD_META_FLAG.id], true);
});

test('feature-flag governance: dormant (no control plane) keeps historic behaviour', async () => {
  reset();
  await initOrg(); // dormant
  assert.equal(orgFlagGovernance(JELLY_FLAG.id), null);
  assert.equal(flagHidden(JELLY_FLAG.id), false);
  assert.equal(isFlagOn({ featureFlags: {} } as unknown as Parameters<typeof isFlagOn>[0], STRIP_UPLOAD_META_FLAG), false); // built-in OFF
  assert.equal(isFlagOn({ featureFlags: {} } as unknown as Parameters<typeof isFlagOn>[0], JELLY_FLAG), false); // built-in OFF since 2026-09-11 (opt-in)
  assert.equal(isFlagOn({ featureFlags: {} } as unknown as Parameters<typeof isFlagOn>[0], NEUROSPICY_FLAG), true); // built-in ON
});

// ── Home view (org-config `home`) ─────────────────────────────────────────────

const START_HREF = location.href;
/** Put the address bar at `href` (same origin) without a navigation. */
const at = (href: string): void => { history.replaceState(null, '', href); };
const address = (): string => location.pathname + location.search + location.hash;
function homePlane(home?: 'tools' | 'projects'): void {
  controlPlane({
    mode: 'gated', session: 'member',
    orgConfig: { instance: { name: 'Acme' }, inboxUnread: 0, ...(home ? { home } : {}) },
  });
}

test('home view: a member arriving at the bare address opens Projects, replacing the entry', async () => {
  for (const bare of ['/', '/#', '/#/']) {
    reset();
    at(bare);
    homePlane('projects');
    const entries = history.length;
    const r = await initOrg();
    assert.equal(r?.gate, false);
    assert.equal(address(), '/#/p', `${bare} opens Projects`);
    assert.equal(history.length, entries, 'replaced, so Back does not return to the bare address');
  }
  at(START_HREF);
});

test('home view: an address that points at a route stays put', async () => {
  for (const named of ['/#/tool/qr-code', '/t/qr-code', '/#/team/s-123', '/#/team/project/p-9', '/#/p/folder-1', '/#/profile', '/#/?q=logo', '/?lang=de', '/design', '/#/tools', '/#/tools?q=logo']) {
    reset();
    at(named);
    homePlane('projects');
    await initOrg();
    assert.equal(address(), named, `${named} is not redirected`);
  }
  at(START_HREF);
});

test('home view: no instance opinion, or tools, leaves the gallery as the first view', async () => {
  for (const home of [undefined, 'tools'] as const) {
    reset();
    at('/');
    homePlane(home);
    await initOrg();
    assert.equal(address(), '/', `home ${home ?? 'absent'} keeps the bare address`);
  }
  at(START_HREF);
});

test('home view: no control plane, a guest, or a failed load with no cache never redirects', async () => {
  reset();
  at('/');
  assert.equal(await initOrg(), null, 'dormant');
  assert.equal(address(), '/');
  reset();
  at('/');
  controlPlane({ mode: 'open', session: 'guest' });
  await initOrg();
  assert.equal(address(), '/', 'a guest has no org-config');
  reset();
  at('/');
  memberPlane(() => new Response('offline', { status: 503 }));
  await initOrg();
  assert.equal(address(), '/', 'nothing known, nothing applied');
  at(START_HREF);
});

test('home view: applies only to the first route of a page load', async () => {
  reset();
  at('/');
  homePlane('projects');
  await initOrg();
  assert.equal(address(), '/#/p');
  // Choosing Tools later puts the app back on the bare address; a later pass over
  // the seam must not send the member back to Projects.
  at('/');
  await initOrg();
  assert.equal(address(), '/', 'later navigation is never redirected');
  // A page load whose first route was not redirected stays undecided for good.
  reset();
  at('/#/tool/qr-code');
  homePlane('projects');
  await initOrg();
  at('/');
  await initOrg();
  assert.equal(address(), '/', 'the first route already chose the tool');
  at(START_HREF);
});

test('home view: a reload or a Back/Forward return keeps the view the member was on', async (t) => {
  // The Tools tab's address is the bare '/#', so F5 on Tools reaches the seam bare.
  for (const type of ['reload', 'back_forward']) {
    reset();
    at('/#');
    homePlane('projects');
    const stub = t.mock.method(performance, 'getEntriesByType', () => [{ entryType: 'navigation', type }]);
    await initOrg();
    assert.equal(location.href, `${location.origin}/#`, `${type}: Tools stays on Tools`);
    stub.mock.restore();
  }
  // A fresh arrival on the same address still opens Projects.
  reset();
  at('/#');
  homePlane('projects');
  const fresh = t.mock.method(performance, 'getEntriesByType', () => [{ entryType: 'navigation', type: 'navigate' }]);
  await initOrg();
  assert.equal(address(), '/#/p');
  fresh.mock.restore();
  at(START_HREF);
});

test('home view: every link that asks for Tools uses #/tools, never the bare address', () => {
  const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), 'utf8');
  // The tool view is an orchestrator plus feature modules; read the whole feature.
  const toolFeature = readdirSync(new URL('../views/tool/', import.meta.url))
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => read(`../views/tool/${f}`));
  const views = [read('../views/tool.ts'), ...toolFeature, read('../views/valid.ts')].join('\n');
  const hrefs = [...views.matchAll(/href="([^"]*)"[^>]*>\$\{t\('(?:Browse all tools|Back to all tools|Explore the tools here)'\)\}/g)]
    .map((m) => m[1]);
  assert.equal(hrefs.length, 5, 'the tool view and Verify carry five links back to the tools');
  assert.deepEqual([...new Set(hrefs)], ['/#/tools'], 'a full page load to the bare address would open Projects instead');
  // The /tools and /gallery path shortlinks forward to the same address.
  const main = read('../main.ts');
  for (const word of ['gallery', 'tools']) {
    assert.match(main, new RegExp(`^\\s+${word}:\\s+\\{ hash: '#/tools',`, 'm'), `/${word} forwards to #/tools`);
  }
  // So does the /tools share-card page a link preview opens (scripts/build-view-og.ts).
  const og = read('../../../../scripts/build-view-og.ts');
  const row = og.slice(og.indexOf("slug: 'tools'"), og.indexOf("slug: 'utilities'"));
  assert.match(row, /hash: '#\/tools',/, 'the /tools page bounces to #/tools');
});
