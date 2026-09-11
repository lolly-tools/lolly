// SPDX-License-Identifier: MPL-2.0
/**
 * org/team-session-origin.ts - the stash that threads a TEAM session's instance-side id
 * from the Projects open to the Share dialog's "Work collab" row (plans/100 section 7; the
 * stitch-2 gap that left `CollabLaunchContext.sessionId` populated by nobody).
 *
 * Two halves, in one file because they are one claim:
 *
 *  1. the stash's own semantics - one-shot, spent by the first mount whether it matches
 *     or not, never resurrected by a remount, released with the mount;
 *  2. what actually reaches the opener - a team-opened session carries `sessionId`, and
 *     everything else hands the opener a context that is byte-identical (deepStrictEqual
 *     on the object, so an extra key holding `undefined` fails) to today's.
 *
 * The jsdom + Map-localStorage + stubbed-fetch harness that drives a real initOrg() pass
 * is deliberately LOCAL to this file, the same choice org/collab-share.test.ts made and
 * for the same reason: concurrent waves are editing that suite and org/index.ts, and a
 * shared harness would make this file collide with them.
 *
 * Run directly:  node --test shells/web/src/org/team-session-origin.test.ts
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
// announce() schedules through rAF; jsdom exposes it on dom.window only.
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

const {
  rememberTeamSessionOrigin, consumeTeamSessionOrigin, activeTeamSessionOrigin,
  releaseTeamSessionOrigin, pendingTeamSessionOrigin, _clearTeamSessionOriginForTests,
} = await import('./team-session-origin.ts');
const { buildWorkCollabShareSection } = await import('./collab-share.ts');
const { initOrg, _resetOrgForTests } = await import('./index.ts');
const { registerCollabOpener, _clearCollabOpenersForTests } = await import('../lib/collab-launch.ts');

// ── 1. The stash itself ────────────────────────────────────────────────────────

test('nothing armed: a mount consumes nothing and reads nothing', () => {
  _clearTeamSessionOriginForTests();
  assert.equal(consumeTeamSessionOrigin('qr-code'), null);
  assert.equal(activeTeamSessionOrigin('qr-code'), null);
});

test('the matching mount consumes it EXACTLY once; the remount gets null and clears it', () => {
  _clearTeamSessionOriginForTests();
  rememberTeamSessionOrigin({ sessionId: 'sess-1', toolId: 'qr-code', projectId: 'proj-9' });
  assert.deepEqual(pendingTeamSessionOrigin(), { sessionId: 'sess-1', toolId: 'qr-code', projectId: 'proj-9' });

  const first = consumeTeamSessionOrigin('qr-code');
  assert.deepEqual(first, { sessionId: 'sess-1', toolId: 'qr-code', projectId: 'proj-9' }, 'the mount it was armed for gets it');
  assert.equal(pendingTeamSessionOrigin(), null, 'the stash is spent');
  assert.deepEqual(activeTeamSessionOrigin('qr-code'), first, 'and held for the life of that mount');

  // The collab adoption path force-remounts the SAME tool with a document seeded by a
  // peer. It must not inherit this session's id.
  assert.equal(consumeTeamSessionOrigin('qr-code'), null, 'the remount consumes nothing');
  assert.equal(activeTeamSessionOrigin('qr-code'), null, 'and the origin is not resurrected');
});

test('a mismatched mount spends the stash too - it can never reach the mount after next', () => {
  _clearTeamSessionOriginForTests();
  rememberTeamSessionOrigin({ sessionId: 'sess-1', toolId: 'qr-code' });

  assert.equal(consumeTeamSessionOrigin('street-map'), null, 'a different tool gets nothing');
  assert.equal(pendingTeamSessionOrigin(), null, 'and the stash is gone, not waiting');
  assert.equal(consumeTeamSessionOrigin('qr-code'), null, 'so a later mount of the armed tool inherits nothing');
  assert.equal(activeTeamSessionOrigin('qr-code'), null);
});

test('a mismatched mount also drops the previous mount’s origin', () => {
  _clearTeamSessionOriginForTests();
  rememberTeamSessionOrigin({ sessionId: 'sess-1', toolId: 'qr-code' });
  consumeTeamSessionOrigin('qr-code');
  consumeTeamSessionOrigin('street-map');
  assert.equal(activeTeamSessionOrigin('qr-code'), null, 'navigating on ends the origin');
});

test('an origin only ever answers for its own tool, and never without one', () => {
  _clearTeamSessionOriginForTests();
  rememberTeamSessionOrigin({ sessionId: 'sess-1', toolId: 'qr-code' });
  consumeTeamSessionOrigin('qr-code');
  assert.equal(activeTeamSessionOrigin('street-map'), null);
  assert.equal(activeTeamSessionOrigin(undefined), null, 'an unresolved tool id cannot match');
  assert.equal(activeTeamSessionOrigin(''), null);
  assert.equal(activeTeamSessionOrigin('qr-code')?.sessionId, 'sess-1');
});

test('release ends the origin with the mount, and is idempotent', () => {
  _clearTeamSessionOriginForTests();
  rememberTeamSessionOrigin({ sessionId: 'sess-1', toolId: 'qr-code' });
  consumeTeamSessionOrigin('qr-code');
  releaseTeamSessionOrigin();
  assert.equal(activeTeamSessionOrigin('qr-code'), null);
  assert.doesNotThrow(() => releaseTeamSessionOrigin());
});

test('a half-named origin arms nothing, and clears whatever was armed', () => {
  _clearTeamSessionOriginForTests();
  rememberTeamSessionOrigin({ sessionId: '', toolId: 'qr-code' });
  assert.equal(pendingTeamSessionOrigin(), null, 'no session id, nothing armed');
  rememberTeamSessionOrigin({ sessionId: 'sess-1', toolId: '  ' });
  assert.equal(pendingTeamSessionOrigin(), null, 'no tool id, nothing armed');

  rememberTeamSessionOrigin({ sessionId: 'sess-1', toolId: 'qr-code' });
  rememberTeamSessionOrigin({ sessionId: '', toolId: '' });
  assert.equal(pendingTeamSessionOrigin(), null, 'a blank arm clears the previous one');
});

test('projectId is carried when known and omitted when not (never an undefined key)', () => {
  _clearTeamSessionOriginForTests();
  rememberTeamSessionOrigin({ sessionId: 'sess-1', toolId: 'qr-code' });
  assert.deepEqual(pendingTeamSessionOrigin(), { sessionId: 'sess-1', toolId: 'qr-code' });
  rememberTeamSessionOrigin({ sessionId: 'sess-1', toolId: 'qr-code', projectId: '' });
  assert.deepEqual(pendingTeamSessionOrigin(), { sessionId: 'sess-1', toolId: 'qr-code' });
});

// ── 2. What reaches the opener ────────────────────────────────────────────────

function reset(): void {
  _resetOrgForTests();
  _clearCollabOpenersForTests();
  _clearTeamSessionOriginForTests();
  store.clear();
  router = () => new Response('', { status: 404 });
}

/** A real member session whose org-config grants collab.join. */
async function memberWhoCanJoin(): Promise<void> {
  router = (url) => {
    if (url.includes('/api/auth/config')) return json({ mode: 'open', provider: 'oidc', loginPath: '/login' });
    if (url.includes('/api/auth/session')) return json({ kind: 'member', user: { sub: 'u1', role: 'member' } });
    if (url.includes('/api/v1/org-config')) return json({ instance: { name: 'Acme' }, inboxUnread: 0, can: { 'collab.join': true } });
    return new Response('', { status: 404 });
  };
  await initOrg();
}

const shareCtx = { toolId: 'qr-code', baseParts: ['url=https%3A%2F%2Fsuse.com'], currentFormat: 'png', copy: async () => {} };

/** Render the row, press it, and return every context the opener saw. */
function pressStartCollab(ctx = shareCtx): unknown[] {
  const seen: unknown[] = [];
  registerCollabOpener('work', (c) => { seen.push(c); });
  const section = buildWorkCollabShareSection(ctx)!;
  assert.ok(section, 'the row renders when both gates hold');
  section.querySelector('button[data-act="start-work-collab"]')!
    .dispatchEvent(new dom.window.Event('click', { bubbles: true }));
  return seen;
}

test('a team-opened session: the context carries the instance’s session id', async () => {
  reset();
  await memberWhoCanJoin();
  rememberTeamSessionOrigin({ sessionId: 'sess-42', toolId: 'qr-code', projectId: 'proj-9' });
  consumeTeamSessionOrigin('qr-code'); // the mount

  assert.deepEqual(pressStartCollab(), [{
    toolId: 'qr-code', baseParts: shareCtx.baseParts, currentFormat: 'png', sessionId: 'sess-42',
  }], 'sessionId rides along - and the projectId does not (nothing keys a room on it)');
});

test('a plain local session: the context is byte-identical to today’s', async () => {
  reset();
  await memberWhoCanJoin();
  // No open, no stash, no mount hand-off - the ordinary case.
  consumeTeamSessionOrigin('qr-code');

  // deepStrictEqual: an own `sessionId` key holding `undefined` would fail here, which
  // is the whole point - the field must be OMITTED, not blanked.
  assert.deepEqual(pressStartCollab(), [{
    toolId: 'qr-code', baseParts: shareCtx.baseParts, currentFormat: 'png',
  }]);
});

test('the origin does not leak to another tool’s Share dialog', async () => {
  reset();
  await memberWhoCanJoin();
  rememberTeamSessionOrigin({ sessionId: 'sess-42', toolId: 'qr-code' });
  consumeTeamSessionOrigin('qr-code');

  // Same live origin, a dialog that resolved a DIFFERENT tool from the address bar.
  const other = { ...shareCtx, toolId: 'street-map' };
  assert.deepEqual(pressStartCollab(other), [{
    toolId: 'street-map', baseParts: other.baseParts, currentFormat: 'png',
  }]);
});

test('after the mount is torn down, a later Share dialog carries no id', async () => {
  reset();
  await memberWhoCanJoin();
  rememberTeamSessionOrigin({ sessionId: 'sess-42', toolId: 'qr-code' });
  consumeTeamSessionOrigin('qr-code');
  releaseTeamSessionOrigin(); // views/tool.ts's _cleanup

  // e.g. the Projects view sharing a LOCAL session of the same tool.
  assert.deepEqual(pressStartCollab(), [{
    toolId: 'qr-code', baseParts: shareCtx.baseParts, currentFormat: 'png',
  }]);
});

test('the collab remount does not re-assert the origin in the context', async () => {
  reset();
  await memberWhoCanJoin();
  rememberTeamSessionOrigin({ sessionId: 'sess-42', toolId: 'qr-code' });
  consumeTeamSessionOrigin('qr-code');   // the team-session mount
  releaseTeamSessionOrigin();            // its teardown
  consumeTeamSessionOrigin('qr-code');   // the forced remount, seeded by the peer

  assert.deepEqual(pressStartCollab(), [{
    toolId: 'qr-code', baseParts: shareCtx.baseParts, currentFormat: 'png',
  }]);
});
