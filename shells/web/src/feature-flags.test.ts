// SPDX-License-Identifier: MPL-2.0
/**
 * feature-flags.ts - the PRIVATE_COLLAB_FLAG slice (plans/100 section 6.3/section 0).
 *
 * The flag is ON by default as of 2026-08-10 (it shipped opt-in in wave 2.6), and this
 * file is the truth table for what that means, because "on by default" is three separate
 * reads and only one of them is the obvious one:
 *
 *   - nothing stored ⇒ ON, through both the default-aware synchronous read (isFlagOnSync,
 *     what the mirror surfaces outside the profile-aware views consult) and the
 *     profile-aware one (isFlagOn);
 *   - a stored `false` ⇒ still OFF, because a default is not a decision and a user who
 *     turned this off is not asking to be re-enrolled by a release;
 *   - governance ⇒ wins over both, in either direction: an instance default applies when
 *     the user has not chosen, and a HIDDEN flag forces its value over any saved or
 *     mirrored one (the rule PREFLIGHT_FLAG/JELLY_FLAG already prove elsewhere).
 *
 * The flag is listed in GOVERNED_FLAG_IDS, and the control plane's own GOVERNABLE_FLAGS
 * carries the matching id with `builtinDefault: true` (lolly-work
 * server/src/policy/feature-flags.ts), so the governance cases below are a real lever
 * rather than a client half waiting for a server.
 *
 * jsdom + a Map-backed localStorage + a stubbed fetch drive a real initOrg() pass
 * so governance comes from the real org/index.ts seam, not a re-implementation of
 * it - same harness shape as org/index.test.ts, kept local to this file so it
 * doesn't collide with concurrent edits to that suite.
 *
 * Run directly:  node --test shells/web/src/feature-flags.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM(
  '<!doctype html><html><body><div id="app"><main id="view"></main></div></body></html>',
  { url: 'https://instance.test/#/tool/qr-code', pretendToBeVisual: true },
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

const json = (body: unknown, extra: Record<string, string> = {}, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...extra } });

const {
  PRIVATE_COLLAB_FLAG, GOVERNED_FLAG_IDS, isFlagOnSync, isFlagOn, flagEnabled, flagEnabledSync,
  flagHidden, hydrateFeatureFlags, overrideFlagInMemory,
} = await import('./feature-flags.ts');
const { initOrg, orgFlagGovernance, _resetOrgForTests } = await import('./org/index.ts');

function reset(): void {
  _resetOrgForTests();
  store.clear();
  router = () => new Response('', { status: 404 });
}

// ── Shape ────────────────────────────────────────────────────────────────────

test('PRIVATE_COLLAB_FLAG is ON by default, and the shell honours governance for it', () => {
  assert.equal(PRIVATE_COLLAB_FLAG.id, 'private-collab');
  assert.equal(PRIVATE_COLLAB_FLAG.default, true);
  // The pill is honest about the ceremony being young; it is NOT a claim about the
  // switch's position, and the two moved apart deliberately on 2026-08-10.
  assert.equal(PRIVATE_COLLAB_FLAG.pill, 'beta');
  assert.ok(GOVERNED_FLAG_IDS.includes(PRIVATE_COLLAB_FLAG.id), 'the shell reads governance for it');
});

// ── Default-ON, dormant (no control plane) ────────────────────────────────────

test('dormant: a user with NO stored choice reads ON, sync and profile-aware alike', async () => {
  reset();
  await initOrg(); // dormant - 404 on the probe
  assert.equal(orgFlagGovernance(PRIVATE_COLLAB_FLAG.id), null);

  assert.equal(isFlagOnSync(PRIVATE_COLLAB_FLAG), true, 'sync mirror read, no entry ⇒ built-in default');

  // flagEnabled (unlike isFlagOn) is NOT default-aware - it is the historic ON-
  // unless-turned-off API used only by CATEGORY_FLAGS, and it's not the
  // read PRIVATE_COLLAB_FLAG's consumers use, so it's deliberately not asserted
  // here; isFlagOn is the default-aware read a flag like this one is read through.
  const noChoice = { featureFlags: {} } as unknown as Parameters<typeof isFlagOn>[0];
  assert.equal(isFlagOn(noChoice, PRIVATE_COLLAB_FLAG), true);
  assert.equal(flagHidden(PRIVATE_COLLAB_FLAG.id), false, 'no control plane ⇒ toggle stays visible');

  // And a boot pass leaves the mirror without an entry for it, rather than baking a
  // `true` in: the missing-key fallback IS the default, so the two paths cannot drift.
  hydrateFeatureFlags(noChoice);
  assert.equal(isFlagOnSync(PRIVATE_COLLAB_FLAG), true, 'still on after hydration');
});

test('a user who explicitly turned it OFF stays off, and a release does not re-enrol them', async () => {
  reset();
  await initOrg();
  const turnedOff = { featureFlags: { [PRIVATE_COLLAB_FLAG.id]: false } } as unknown as Parameters<typeof isFlagOn>[0];
  assert.equal(isFlagOn(turnedOff, PRIVATE_COLLAB_FLAG), false, 'a stored false beats the default');
  assert.equal(flagEnabled(turnedOff, PRIVATE_COLLAB_FLAG.id), false);
  hydrateFeatureFlags(turnedOff);
  assert.equal(isFlagOnSync(PRIVATE_COLLAB_FLAG), false, 'and the sync mirror carries their choice');
});

test('an explicit ON is indistinguishable from the default, and survives hydration', async () => {
  reset();
  await initOrg();
  const turnedOn = { featureFlags: { [PRIVATE_COLLAB_FLAG.id]: true } } as unknown as Parameters<typeof isFlagOn>[0];
  assert.equal(isFlagOn(turnedOn, PRIVATE_COLLAB_FLAG), true);
  hydrateFeatureFlags(turnedOn);
  assert.equal(isFlagOnSync(PRIVATE_COLLAB_FLAG), true, 'the sync mirror agrees once hydrated');
});

// ── Governance override (a control plane can force it, in either direction) ────

/** An instance that publishes one governance record for this flag. */
function governed(featureFlags: Record<string, { default?: boolean; hidden?: boolean }>): void {
  router = (url) => {
    if (url.includes('/api/auth/config')) return json({ mode: 'open', provider: 'oidc', loginPath: '/login' });
    if (url.includes('/api/auth/session')) return json({ kind: 'member', user: { sub: 'u1', role: 'member' } });
    if (url.includes('/api/v1/org-config')) return json({ instance: { name: 'Acme' }, inboxUnread: 0, featureFlags });
    return new Response('', { status: 404 });
  };
}

test('governed default OFF: an unset user choice picks up the instance default, not the built-in ON', async () => {
  reset();
  // Deliberately the direction that now DIFFERS from the built-in: with the flag on by
  // default, an instance default of `true` would prove nothing.
  governed({ [PRIVATE_COLLAB_FLAG.id]: { default: false, hidden: false } });
  await initOrg();

  assert.deepEqual(orgFlagGovernance(PRIVATE_COLLAB_FLAG.id), { default: false, hidden: false });
  const noChoice = { featureFlags: {} } as unknown as Parameters<typeof isFlagOn>[0];
  assert.equal(isFlagOn(noChoice, PRIVATE_COLLAB_FLAG), false, 'instance default wins when the user has not chosen');
  hydrateFeatureFlags(noChoice);
  assert.equal(isFlagOnSync(PRIVATE_COLLAB_FLAG), false, 'and hydration bakes it into the sync mirror');

  // The toggle is still SHOWN, so this is an instance opinion rather than a decision
  // taken away - the distinction #/join's two-branch gate turns on.
  assert.equal(flagHidden(PRIVATE_COLLAB_FLAG.id), false);
  const turnedOn = { featureFlags: { [PRIVATE_COLLAB_FLAG.id]: true } } as unknown as Parameters<typeof isFlagOn>[0];
  assert.equal(isFlagOn(turnedOn, PRIVATE_COLLAB_FLAG), true, 'and the user can still choose over it');
});

test('governed + hidden OFF: forced default wins over the toggle AND a saved user value', async () => {
  reset();
  // The instance stages the ceremony as fleet-wide OFF and hides the switch - exactly
  // the "force it off fleet-wide" lever plans/100 section 6.3 calls for, and the one the
  // default going ON makes essential rather than decorative.
  governed({ [PRIVATE_COLLAB_FLAG.id]: { default: false, hidden: true } });
  await initOrg();

  assert.equal(flagHidden(PRIVATE_COLLAB_FLAG.id), true, 'the toggle itself is suppressed');
  // A user who had it on BEFORE the instance staged this governance must still see
  // it off - hidden governance beats any saved/mirrored value, never falls open.
  const savedOn = { featureFlags: { [PRIVATE_COLLAB_FLAG.id]: true } } as unknown as Parameters<typeof isFlagOn>[0];
  assert.equal(isFlagOn(savedOn, PRIVATE_COLLAB_FLAG), false, 'hidden forced-off wins over a saved true');
  assert.equal(flagEnabled(savedOn, PRIVATE_COLLAB_FLAG.id), false);

  hydrateFeatureFlags(savedOn);
  assert.equal(isFlagOnSync(PRIVATE_COLLAB_FLAG), false, 'the sync mirror bakes the forced-off governance in too');

  // And the built-in default is not a back door either: a user with no stored choice
  // gets the forced value, not the ON they would get on an ungoverned device.
  const noChoice = { featureFlags: {} } as unknown as Parameters<typeof isFlagOn>[0];
  assert.equal(isFlagOn(noChoice, PRIVATE_COLLAB_FLAG), false);
});

test('governed + hidden ON: the same lever forces it on over a user who turned it off', async () => {
  reset();
  governed({ [PRIVATE_COLLAB_FLAG.id]: { default: true, hidden: true } });
  await initOrg();

  const savedOff = { featureFlags: { [PRIVATE_COLLAB_FLAG.id]: false } } as unknown as Parameters<typeof isFlagOn>[0];
  assert.equal(flagHidden(PRIVATE_COLLAB_FLAG.id), true);
  assert.equal(isFlagOn(savedOff, PRIVATE_COLLAB_FLAG), true, 'hidden governance forces in both directions');
  assert.equal(flagEnabled(savedOff, PRIVATE_COLLAB_FLAG.id), true);
  hydrateFeatureFlags(savedOff);
  assert.equal(isFlagOnSync(PRIVATE_COLLAB_FLAG), true, 'the mirror carries the forced value, not the stored one');
});

// ── Boot order: the mirror is hydrated BEFORE governance is knowable ──────────

// main.ts hydrates the flag mirror from the profile ~140 lines before `await initOrg()`
// resolves the control plane, and hydrates exactly once per boot. So the governance bake
// inside hydrateFeatureFlags sees nothing, and nothing re-bakes it later. Every test above
// runs the two calls in the convenient order; these two run them in the REAL one, which is
// the order that decides whether a governed-off instance is actually governed off.

test('boot order: a hidden governed OFF holds even though hydration ran before initOrg', async () => {
  reset();
  governed({ [PRIVATE_COLLAB_FLAG.id]: { default: false, hidden: true } });

  // Boot step 1 - the profile is known, the control plane is not.
  const noChoice = { featureFlags: {} } as unknown as Parameters<typeof isFlagOn>[0];
  assert.equal(orgFlagGovernance(PRIVATE_COLLAB_FLAG.id), null, 'governance is unknowable this early');
  hydrateFeatureFlags(noChoice);
  const mirrored = JSON.parse(store.get('lolly:featureFlags') ?? '{}') as Record<string, boolean>;
  assert.equal(mirrored[PRIVATE_COLLAB_FLAG.id], undefined,
    'a default-ON flag is deliberately left with NO mirror entry, so the bake cannot save us here');

  // Boot step 2 - the control plane answers. Nothing re-hydrates the mirror.
  await initOrg();
  assert.equal(flagHidden(PRIVATE_COLLAB_FLAG.id), true, 'the instance forced it off and hid the switch');
  assert.equal(isFlagOn(noChoice, PRIVATE_COLLAB_FLAG), false, 'the profile-aware read honours that');

  // The one that matters: every collab entry point (the Share row, the opener, the
  // #/join and #/join-reply gates) reads the flag through isFlagOnSync. If it falls back
  // to the built-in ON here, the code door opens on an instance that forbade the feature
  // and #/join's governed-off card is unreachable.
  assert.equal(isFlagOnSync(PRIVATE_COLLAB_FLAG), false, 'the sync read must agree, hydrated or not');
});

test('boot order: an instance default (toggle still shown) also survives the same window', async () => {
  reset();
  governed({
    [PRIVATE_COLLAB_FLAG.id]: { default: false, hidden: false },
    // The older governed flags read through the id-based sync API, same window, same fix.
    neurospicy: { default: false, hidden: false },
  });

  const noChoice = { featureFlags: {} } as unknown as Parameters<typeof isFlagOn>[0];
  hydrateFeatureFlags(noChoice);
  await initOrg();

  assert.equal(isFlagOnSync(PRIVATE_COLLAB_FLAG), false, 'instance default beats the built-in ON');
  assert.equal(flagEnabledSync('neurospicy'), false, 'and the historic ON-unless-off read honours it too');

  // A user choice still outranks a visible (non-hidden) instance default, exactly as
  // isFlagOn resolves it - the fix adds governance under the mirror, not over it.
  hydrateFeatureFlags({ featureFlags: { [PRIVATE_COLLAB_FLAG.id]: true } } as unknown as Parameters<typeof isFlagOn>[0]);
  assert.equal(isFlagOnSync(PRIVATE_COLLAB_FLAG), true, 'a stored true still wins over a visible default');
});

// ── In-memory override (deep-link style) still wins over everything ────────────

test('an in-memory override wins over the mirror without touching storage', async () => {
  reset();
  await initOrg();
  overrideFlagInMemory(PRIVATE_COLLAB_FLAG.id, true);
  assert.equal(isFlagOnSync(PRIVATE_COLLAB_FLAG), true);
  overrideFlagInMemory(PRIVATE_COLLAB_FLAG.id, false);
  assert.equal(isFlagOnSync(PRIVATE_COLLAB_FLAG), false);
});
