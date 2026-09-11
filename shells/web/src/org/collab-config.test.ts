// SPDX-License-Identifier: MPL-2.0
/**
 * org/collab-config.ts - the collab capability-bit accessors (plans/100 section 7.7).
 *
 * Covers the contract that matters: absent (no control plane, or a control plane
 * that never mentions these bits) always reads false - never assume yes - and an
 * explicit `can['collab.join']`/`can['collab.edit']` grant is read faithfully, with
 * join and edit tracked independently (an observer-only member can join without
 * being able to edit - plans/100 section 7.5's writer/observer split).
 *
 * jsdom + a Map-backed localStorage + a stubbed fetch drive a real initOrg() pass,
 * same harness shape as org/index.test.ts, kept local to this file so it doesn't
 * collide with concurrent edits to that suite (or to org/index.ts itself).
 *
 * Run directly:  node --test shells/web/src/org/collab-config.test.ts
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

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const { canJoinCollab, canEditCollab } = await import('./collab-config.ts');
const { initOrg, _resetOrgForTests } = await import('./index.ts');

function reset(): void {
  _resetOrgForTests();
  store.clear();
  router = () => new Response('', { status: 404 });
}

/** Drive a real member session whose org-config carries the given `can` bits (or
 *  none at all when omitted). */
async function memberWithCan(can?: Record<string, boolean>): Promise<void> {
  router = (url) => {
    if (url.includes('/api/auth/config')) return json({ mode: 'open', provider: 'oidc', loginPath: '/login' });
    if (url.includes('/api/auth/session')) return json({ kind: 'member', user: { sub: 'u1', role: 'member' } });
    if (url.includes('/api/v1/org-config')) return json({
      instance: { name: 'Acme' },
      inboxUnread: 0,
      ...(can ? { can } : {}),
    });
    return new Response('', { status: 404 });
  };
  await initOrg();
}

// ── Absent → false ──────────────────────────────────────────────────────────

test('no control plane at all: both accessors read false', async () => {
  reset();
  await initOrg(); // dormant - 404 on the probe
  assert.equal(canJoinCollab(), false);
  assert.equal(canEditCollab(), false);
});

test('member org-config with no `can` bits at all: still false (no opinion ⇒ deny)', async () => {
  reset();
  await memberWithCan(undefined);
  assert.equal(canJoinCollab(), false);
  assert.equal(canEditCollab(), false);
});

test('member org-config with an empty `can` map: still false', async () => {
  reset();
  await memberWithCan({});
  assert.equal(canJoinCollab(), false);
  assert.equal(canEditCollab(), false);
});

test('an explicit `false` reads as false (not just "missing")', async () => {
  reset();
  await memberWithCan({ 'collab.join': false, 'collab.edit': false });
  assert.equal(canJoinCollab(), false);
  assert.equal(canEditCollab(), false);
});

// ── Present + granted ────────────────────────────────────────────────────────

test('collab.join granted, collab.edit absent: join true, edit stays false (observer)', async () => {
  reset();
  await memberWithCan({ 'collab.join': true });
  assert.equal(canJoinCollab(), true);
  assert.equal(canEditCollab(), false);
});

test('both bits granted: join and edit both true', async () => {
  reset();
  await memberWithCan({ 'collab.join': true, 'collab.edit': true });
  assert.equal(canJoinCollab(), true);
  assert.equal(canEditCollab(), true);
});

test('a truthy-but-not-boolean value does not accidentally grant (strict === true)', async () => {
  reset();
  // A malformed/legacy payload should fail closed, not coerce truthy.
  await memberWithCan({ 'collab.join': 1 as unknown as boolean, 'collab.edit': 'yes' as unknown as boolean });
  assert.equal(canJoinCollab(), false);
  assert.equal(canEditCollab(), false);
});

// ── Reverts to dormant on reset ─────────────────────────────────────────────

test('resetting the org seam clears a prior grant back to false', async () => {
  reset();
  await memberWithCan({ 'collab.join': true, 'collab.edit': true });
  assert.equal(canJoinCollab(), true);
  reset();
  assert.equal(canJoinCollab(), false);
  assert.equal(canEditCollab(), false);
});
