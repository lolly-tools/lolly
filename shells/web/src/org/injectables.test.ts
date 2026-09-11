// SPDX-License-Identifier: MPL-2.0
/**
 * org/index.ts + org/chrome.ts - the injectable-consumption seam (plans/19).
 *
 * The three things that MUST hold:
 *   - a member's org-config `injectables` populate the neutral injected-tools
 *     registry (tool kind) and render a chrome banner (chrome kind);
 *   - flag/resource/unknown kinds are ignored here (they ride other seams);
 *   - dormancy: no control plane (or no injectables) ⇒ the registry stays empty
 *     and no chrome node is inserted, so the shell is byte-identical to today.
 *
 * Reuses the index.test.ts harness (jsdom + Map-localStorage + fetch router).
 *
 * Run directly:  node --test shells/web/src/org/injectables.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM(
  '<!doctype html><html><body><div id="app"><main id="view"><p class="loading">Loading…</p></main></div></body></html>',
  { url: 'https://instance.test/#/', pretendToBeVisual: true },
);
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location as unknown as Location;

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

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const { initOrg, _resetOrgForTests } = await import('./index.ts');
const { getInjectedTools, _clearInjectedToolsForTests } = await import('../lib/injected-tools.ts');
const { _resetChromeForTests } = await import('./chrome.ts');

/**
 * Reset between tests. ASYNC on purpose: a previous test's lazy chrome mount can
 * still be in flight, and if it lands after this clear it appears inside the NEXT
 * test - which is how "an un-wired slot renders nothing" started failing in CI the
 * moment the earlier tests began mounting reliably. Drain first, then clear, so
 * each test starts from a genuinely quiet DOM.
 */
async function reset(): Promise<void> {
  for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0));
  _resetOrgForTests();
  _clearInjectedToolsForTests();
  _resetChromeForTests();
  store.clear();
  document.getElementById('app')!.querySelectorAll('.org-chrome').forEach((n) => n.remove());
  document.getElementById('view')!.innerHTML = '<p class="loading">Loading…</p>';
  router = () => new Response('', { status: 404 });
}

function member(orgConfig: unknown): void {
  router = (url) => {
    if (url.includes('/api/auth/config')) return json({ mode: 'open', provider: 'oidc', loginPath: '/login' });
    if (url.includes('/api/auth/session')) return json({ kind: 'member', user: { sub: 'u1', email: 'me@corp', groups: [], role: 'member' } });
    if (url.includes('/api/v1/org-config')) return json(orgConfig);
    return new Response('', { status: 404 });
  };
}
const cfg = (injectables: unknown[]): unknown => ({ instance: { name: 'Acme' }, inboxUnread: 0, injectables });
const banner = () => document.querySelector('.org-chrome--banner');

/**
 * Wait for the lazy `import('./chrome.ts')` to resolve AND mount.
 *
 * This was a single `setTimeout(0)`, which is one macrotask - enough on a warm
 * module cache and not enough on a cold one. It passed on every developer machine
 * and failed in CI, where the import is compiled fresh: "member injectables …
 * render a chrome banner" has been red on main for several commits for exactly
 * this reason, with a nonsense symptom (the banner simply absent).
 *
 * So poll the caller's condition rather than guess a duration. With no condition
 * it keeps the old single-tick behaviour, which is all the assertion-free call
 * sites need. A test whose condition never arrives still fails, just after the
 * deadline rather than immediately - the assertion after it reports the real
 * problem either way.
 */
const settle = async (until?: () => unknown, timeoutMs = 3000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    await new Promise((r) => setTimeout(r, 0));
    if (!until || until()) return;
    if (Date.now() > deadline) return;
  }
};

test('member injectables populate the tool registry + render a chrome banner', async () => {
  await reset();
  member(cfg([
    { id: 't1', kind: 'tool', title: 'Event Badge', toolId: 'event-badge', source: 'catalog' },
    { id: 'c1', kind: 'chrome', title: 'Welcome', slot: 'banner', tone: 'info', text: 'Welcome to Acme', link: { label: 'Docs', href: '#/docs' } },
  ]));
  await initOrg();
  await settle(banner);
  const tools = getInjectedTools();
  assert.equal(tools.length, 1);
  assert.equal(tools[0]!.id, 'event-badge'); // the SERVED id, not the injectable id
  assert.equal(tools[0]!.name, 'Event Badge');
  const bar = banner();
  assert.ok(bar, 'a chrome banner is inserted');
  assert.match(bar!.textContent || '', /Welcome to Acme/);
  assert.match(bar!.innerHTML, /#\/docs/); // the link href
});

test('a url-source tool resolves to its served id + URL-mode query (opens preconfigured)', async () => {
  await reset();
  member(cfg([
    { id: 'u1', kind: 'tool', title: 'SUSE QR', toolId: 'qr-code', source: 'url', ref: 'https://acme.example/#/tool/qr-code?url=https%3A%2F%2Fsuse.com' },
  ]));
  await initOrg();
  await settle();
  const it = getInjectedTools()[0]!;
  assert.equal(it.id, 'qr-code'); // resolved from the URL, drives #/tool/qr-code
  assert.equal(it.openQuery, 'url=https%3A%2F%2Fsuse.com'); // preset inputs travel as URL mode
});

test('a url-source tool with an unresolvable link is dropped (fail closed, no dead card)', async () => {
  await reset();
  member(cfg([
    { id: 'u2', kind: 'tool', title: 'Broken', toolId: 'x', source: 'url', ref: 'not a url' },
    { id: 'u3', kind: 'tool', title: 'No ref', toolId: 'y', source: 'url' },
  ]));
  await initOrg();
  await settle();
  assert.equal(getInjectedTools().length, 0);
});

test('flag / resource / unknown kinds are ignored (they ride other seams)', async () => {
  await reset();
  member(cfg([
    { id: 'f', kind: 'flag', title: 'x' },
    { id: 'r', kind: 'resource', title: 'y' },
    { id: 'z', kind: 'nonsense', title: 'z' },
  ]));
  await initOrg();
  await settle();
  assert.equal(getInjectedTools().length, 0);
  assert.equal(banner(), null);
});

test('a dismissed chrome banner does not reappear', async () => {
  await reset();
  const one = () => member(cfg([{ id: 'c1', kind: 'chrome', title: 'N', slot: 'banner', text: 'Notice', tone: 'warn' }]));
  one();
  await initOrg();
  await settle(banner);
  const bar = banner();
  assert.ok(bar);
  (bar!.querySelector('.org-chrome-dismiss') as HTMLElement).click();
  assert.equal(banner(), null, 'dismiss removes it');
  // Re-init (a fresh boot): the dismissed id is remembered locally, so it stays gone.
  _resetOrgForTests();
  _resetChromeForTests();
  document.getElementById('view')!.innerHTML = '<p class="loading">Loading…</p>';
  one();
  await initOrg();
  await settle();
  assert.equal(banner(), null, 'a remembered dismissal survives a reboot');
});

test('an un-wired slot (nav/panel) renders nothing but is not an error', async () => {
  await reset();
  member(cfg([{ id: 'n1', kind: 'chrome', title: 'Nav', slot: 'nav', text: 'Later' }]));
  await initOrg();
  await settle();
  assert.equal(banner(), null);
  assert.equal(document.querySelectorAll('.org-chrome').length, 0);
});

// ── hardening (adversarial review) ──────────────────────────────────────────────
test('a malformed (non-array) injectables value never breaks the member branch', async () => {
  await reset();
  // A wrong TYPE must not throw and abort initOrg after policies are half-applied.
  member({ instance: { name: 'Acme' }, inboxUnread: 0, injectables: { nope: true } });
  const state = await initOrg();
  await settle();
  assert.ok(state, 'initOrg still resolves an OrgState (branch not aborted)');
  assert.equal(getInjectedTools().length, 0);
  assert.equal(banner(), null);
});

test('a javascript: link href is dropped, not rendered as a clickable anchor', async () => {
  await reset();
  member(cfg([{ id: 'x', kind: 'chrome', title: 'X', slot: 'banner', text: 'Notice', link: { label: 'Run', href: 'javascript:fetch("/steal")' } }]));
  await initOrg();
  await settle(banner);
  const bar = banner();
  assert.ok(bar);
  assert.match(bar!.textContent || '', /Notice/); // text still shows
  assert.equal(bar!.querySelector('.org-chrome-cta'), null, 'no anchor for an unsafe href');
  assert.doesNotMatch(bar!.innerHTML, /javascript:/);
});

test('duplicate injected tool ids collapse to one registry entry (no dup card)', async () => {
  await reset();
  member(cfg([
    { id: 'a', kind: 'tool', title: 'One', toolId: 'dupe', source: 'catalog' },
    { id: 'b', kind: 'tool', title: 'Two', toolId: 'dupe', source: 'catalog' },
  ]));
  await initOrg();
  await settle();
  assert.equal(getInjectedTools().filter((tt) => tt.id === 'dupe').length, 1);
});

// ── Dormancy - the byte-identical guarantee ─────────────────────────────────────
test('injectables seam is a dormant no-op with no control plane', async () => {
  await reset(); // router = 404 → no control plane
  await initOrg();
  await settle();
  assert.equal(getInjectedTools().length, 0);
  assert.equal(banner(), null);
});

test('a member with no injectables field stays byte-identical', async () => {
  await reset();
  member({ instance: { name: 'Acme' }, inboxUnread: 0 }); // no injectables key at all
  await initOrg();
  await settle();
  assert.equal(getInjectedTools().length, 0);
  assert.equal(banner(), null);
});
