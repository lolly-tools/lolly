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
import { JSDOM } from 'jsdom';

const dom = new JSDOM(
  '<!doctype html><html><body><div id="app"><main id="view"><p class="loading">Loading…</p></main></div></body></html>',
  { url: 'https://instance.test/#/tool/qr-code', pretendToBeVisual: true },
);
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location as unknown as Location;

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

const { initOrg, orgConfig, orgSession, orgAdminHref, orgFlagGovernance, applyOrgToolPolicies, _resetOrgForTests } = await import('./index.ts');
const { flagHidden, isFlagOn, flagEnabled, hydrateFeatureFlags, NEUROSPICY_FLAG, JELLY_FLAG, STRIP_UPLOAD_META_FLAG } = await import('../feature-flags.ts');
const { getFieldPolicy, _clearFieldPoliciesForTests } = await import('../lib/field-policy.ts');
const { getInputPolicy, _clearInputPoliciesForTests } = await import('../lib/input-policy.ts');
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
}): void {
  router = (url) => {
    if (url.includes('/api/auth/config')) return json({ mode: opts.mode, provider: 'oidc', loginPath: '/login' });
    if (url.includes('/api/auth/session')) {
      if (opts.session === 'member') return json({ kind: 'member', user: { sub: 'u1', email: 'me@corp', groups: [], role: opts.role ?? 'member' } });
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

  // Dormant until a tool mounts and asks for its policy.
  assert.equal(getInputPolicy('event-badge', 'logo'), undefined);
  applyOrgToolPolicies('event-badge');

  assert.deepEqual(getInputPolicy('event-badge', 'logo'), { mode: 'locked', note: 'Managed by Acme', value: 'acme/logo' });
  assert.equal(getInputPolicy('event-badge', 'accent')?.mode, 'choice');
  assert.deepEqual(getInputPolicy('event-badge', 'accent')?.allow, ['#0c322c', '#30ba78']);
  assert.equal(getInputPolicy('event-badge', 'discount')?.mode, 'hidden', 'hidden id wins');
  assert.equal(getInputPolicy('event-badge', 'headline'), undefined, 'unpolicied input untouched');

  // Mounting a tool with no declaration clears the previous tool's policy.
  applyOrgToolPolicies('qr-code');
  assert.equal(getInputPolicy('event-badge', 'logo'), undefined, 'previous tool policy cleared on mount');
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
  applyOrgToolPolicies('event-badge');

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
  applyOrgToolPolicies('event-badge');
  assert.equal(getInputPolicy('event-badge', 'logo'), undefined);
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
  assert.equal(isFlagOn({ featureFlags: {} } as unknown as Parameters<typeof isFlagOn>[0], JELLY_FLAG), true); // built-in ON
});
