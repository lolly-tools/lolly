// SPDX-License-Identifier: MPL-2.0
/**
 * org/collab-share.ts - the "Work collab" Share-dialog section.
 *
 * Proves both gates are independently required (canJoinCollab() from a real
 * initOrg() pass, AND a registered 'work' opener), that the row is absent by
 * default (dormant registry + no control plane, byte-identical), that a
 * rendered row's action invokes the opener with the session-context shape and
 * announces, and that a missing/throwing opener degrades to silence.
 *
 * jsdom + a Map-backed localStorage + a stubbed fetch drive a real initOrg()
 * pass, same harness shape as org/collab-config.test.ts, kept local to this
 * file so it doesn't collide with concurrent edits to that suite (or to
 * org/index.ts itself).
 *
 * Run directly:  node --test shells/web/src/org/collab-share.test.ts
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
// a11y.ts's announce() (invoked on a successful open) schedules via rAF; jsdom's
// pretendToBeVisual only exposes it on dom.window, not the bare global this file
// runs in - shim it, mirroring org/approval-dialog.test.ts's harness.
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

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const { buildWorkCollabShareSection } = await import('./collab-share.ts');
const { initOrg, _resetOrgForTests } = await import('./index.ts');
const { registerCollabOpener, _clearCollabOpenersForTests } = await import('../lib/collab-launch.ts');

function reset(): void {
  _resetOrgForTests();
  _clearCollabOpenersForTests();
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

const ctx = { toolId: 'qr-code', baseParts: ['url=https%3A%2F%2Fsuse.com'], currentFormat: 'png', copy: async () => {} };

// ── Absent by default ──────────────────────────────────────────────────────────

test('no control plane at all: section is absent even with a registered opener', async () => {
  reset();
  await initOrg(); // dormant - 404 on the probe
  registerCollabOpener('work', () => {});
  assert.equal(buildWorkCollabShareSection(ctx), null);
});

test('collab.join granted, but no opener registered: section is absent', async () => {
  reset();
  await memberWithCan({ 'collab.join': true });
  assert.equal(buildWorkCollabShareSection(ctx), null);
});

test('an opener is registered, but collab.join is absent/false: section is absent', async () => {
  reset();
  await memberWithCan({ 'collab.join': false });
  registerCollabOpener('work', () => {});
  assert.equal(buildWorkCollabShareSection(ctx), null);
});

test('a registered 1-slot "private" opener does not satisfy the "work" row', async () => {
  reset();
  await memberWithCan({ 'collab.join': true });
  registerCollabOpener('private', () => {});
  assert.equal(buildWorkCollabShareSection(ctx), null);
});

// ── Present only when BOTH gates hold ───────────────────────────────────────────

test('both gates hold: the section renders with plan-0 naming and a working action', async () => {
  reset();
  await memberWithCan({ 'collab.join': true });
  const seen: unknown[] = [];
  registerCollabOpener('work', (c) => { seen.push(c); });

  const section = buildWorkCollabShareSection(ctx);
  assert.ok(section, 'section renders');
  assert.equal(section!.textContent?.includes('Work collab'), true);
  const btn = section!.querySelector('button[data-act="start-work-collab"]');
  assert.ok(btn, 'has the action button');
  assert.equal(btn!.textContent, 'Start a collab');

  btn!.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
  // The opener sees the CollabLaunchContext shape - toolId/baseParts/currentFormat
  // only, never the dialog's `copy` helper (that's a ShareSectionContext concern).
  assert.deepEqual(seen, [{ toolId: ctx.toolId, baseParts: ctx.baseParts, currentFormat: ctx.currentFormat }], 'opener invoked with the session-context shape');
});

test('a throwing opener degrades to silence (no throw out of the click handler)', async () => {
  reset();
  await memberWithCan({ 'collab.join': true });
  registerCollabOpener('work', () => { throw new Error('boom'); });
  const section = buildWorkCollabShareSection(ctx)!;
  const btn = section.querySelector('button[data-act="start-work-collab"]')!;
  assert.doesNotThrow(() => btn.dispatchEvent(new dom.window.Event('click', { bubbles: true })));
});

test('resetting the org seam reverts a previously-visible section to absent', async () => {
  reset();
  await memberWithCan({ 'collab.join': true });
  registerCollabOpener('work', () => {});
  assert.ok(buildWorkCollabShareSection(ctx));
  _resetOrgForTests();
  assert.equal(buildWorkCollabShareSection(ctx), null);
});
