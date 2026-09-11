// SPDX-License-Identifier: MPL-2.0
/**
 * lib/collab-availability.ts - the collab availability + target seam (plans/108 Phase 1).
 *
 * Proves the rule every collab surface now asks instead of restating: the private
 * track needs the flag AND an opener; the work track needs a control-plane session id,
 * an opener AND the instance's `collab.edit` policy; neither track survives a target
 * that cannot mount; a view target is refused outright until Phase 4 lifts a collab off
 * a single mount. Also pins the launch context a target implies (absent facts OMITTED,
 * never `undefined` keys) and startCollab's refusal to open a track the target cannot
 * start.
 *
 * Pure and DOM-free, like lib/collab-launch.test.ts one seam over: the flag is driven
 * through feature-flags.ts's in-memory override, so no jsdom, storage or control-plane
 * harness is needed. Every case drives the flag EXPLICITLY, in both directions, so none
 * of them encodes which way `private-collab` happens to default.
 *
 * Run directly:  node --test shells/web/src/lib/collab-availability.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { PRIVATE_COLLAB_FLAG, overrideFlagInMemory } from '../feature-flags.ts';
import { registerCollabOpener, _clearCollabOpenersForTests } from './collab-launch.ts';
import type { CollabLaunchContext } from './collab-launch.ts';
import {
  collabAvailability, collabLaunchContext, canStartCollab, startCollab,
  registerWorkCollabPolicy, _clearWorkCollabPolicyForTests,
} from './collab-availability.ts';
import type { CollabTarget } from './collab-availability.ts';

/** Everything off: no flag, no openers, no instance policy. */
function reset(): void {
  overrideFlagInMemory(PRIVATE_COLLAB_FLAG.id, false);
  _clearCollabOpenersForTests();
  _clearWorkCollabPolicyForTests();
}

/** Both private gates on, and a recorder for what the opener receives. */
function armPrivate(): CollabLaunchContext[] {
  overrideFlagInMemory(PRIVATE_COLLAB_FLAG.id, true);
  const seen: CollabLaunchContext[] = [];
  registerCollabOpener('private', (ctx) => { seen.push(ctx); });
  return seen;
}

/** All three work gates on (the target still has to carry the session id). */
function armWork(): CollabLaunchContext[] {
  const seen: CollabLaunchContext[] = [];
  registerCollabOpener('work', (ctx) => { seen.push(ctx); });
  registerWorkCollabPolicy(() => true);
  return seen;
}

const TOOL: CollabTarget = { kind: 'tool', toolId: 'qr-code' };
const TEAM: CollabTarget = { kind: 'session', toolId: 'qr-code', baseParts: ['url=x'], sessionId: 'sess-1' };

// ── The private track ──────────────────────────────────────────────────────────

test('nothing registered: no track, whichever way the flag is driven', () => {
  reset();
  assert.deepEqual(collabAvailability(TOOL).tracks, []);
  overrideFlagInMemory(PRIVATE_COLLAB_FLAG.id, true);
  assert.deepEqual(collabAvailability(TOOL).tracks, [], 'the flag alone opens nothing');
  assert.equal(canStartCollab(TOOL), false);
});

test('the flag alone and the opener alone are each not enough', () => {
  reset();
  registerCollabOpener('private', () => {});
  assert.equal(canStartCollab(TOOL, 'private'), false, 'opener without the flag');
  reset();
  overrideFlagInMemory(PRIVATE_COLLAB_FLAG.id, true);
  assert.equal(canStartCollab(TOOL, 'private'), false, 'flag without an opener');
});

test('both private gates: the track is offered for a plain tool target', () => {
  reset();
  armPrivate();
  assert.deepEqual(collabAvailability(TOOL).tracks, ['private']);
  assert.equal(canStartCollab(TOOL), true, 'no track named means any track');
  assert.equal(canStartCollab(TOOL, 'private'), true);
  assert.equal(canStartCollab(TOOL, 'work'), false, 'a private-only build offers no work collab');
});

test('turning the flag back off withdraws a previously offered track', () => {
  reset();
  armPrivate();
  assert.equal(canStartCollab(TOOL, 'private'), true);
  overrideFlagInMemory(PRIVATE_COLLAB_FLAG.id, false);
  assert.equal(canStartCollab(TOOL, 'private'), false, 'read fresh on every ask, never cached');
});

// ── Targets that cannot host a collab ──────────────────────────────────────────

test('a target that cannot mount here has no track at all', () => {
  reset();
  armPrivate();
  armWork();
  assert.deepEqual(collabAvailability({ ...TOOL, mountable: false }).tracks, []);
  assert.deepEqual(collabAvailability({ kind: 'session', toolId: 'qr-code', sessionId: 'sess-1', mountable: false }).tracks, []);
  assert.deepEqual(collabAvailability({ ...TOOL, mountable: true }).tracks, ['private'], 'stated-mountable behaves like the absent default');
});

test('a view target is refused on both tracks (a collab is still mount-scoped)', () => {
  reset();
  armPrivate();
  armWork();
  const view: CollabTarget = { kind: 'view', viewId: 'projects' };
  assert.deepEqual(collabAvailability(view).tracks, []);
  assert.equal(canStartCollab(view), false);
  assert.equal(startCollab(view, 'private'), false, 'refused before any opener is consulted');
  assert.deepEqual(collabLaunchContext(view), { baseParts: [] }, 'a view names no tool to seed');
});

// ── The work track ─────────────────────────────────────────────────────────────

test('the work track needs the session id, the opener and the instance policy', () => {
  reset();
  registerCollabOpener('work', () => {});
  registerWorkCollabPolicy(() => true);
  assert.equal(canStartCollab({ kind: 'session', toolId: 'qr-code' }, 'work'), false, 'no session id');
  assert.equal(canStartCollab(TOOL, 'work'), false, 'a bare tool carries no session id');

  reset();
  registerWorkCollabPolicy(() => true);
  assert.equal(canStartCollab(TEAM, 'work'), false, 'no opener');

  reset();
  registerCollabOpener('work', () => {});
  assert.equal(canStartCollab(TEAM, 'work'), false, 'no policy registered reads as no, never as yes');

  reset();
  registerCollabOpener('work', () => {});
  registerWorkCollabPolicy(() => false);
  assert.equal(canStartCollab(TEAM, 'work'), false, 'the instance said no');

  reset();
  armWork();
  assert.deepEqual(collabAvailability(TEAM).tracks, ['work'], 'all three, and the private track is off');
});

test('a blank session id is no session id', () => {
  reset();
  armWork();
  assert.equal(canStartCollab({ kind: 'session', toolId: 'qr-code', sessionId: '  ' }, 'work'), false);
});

test('a throwing policy reads as no', () => {
  reset();
  armWork();
  registerWorkCollabPolicy(() => { throw new Error('boom'); });
  assert.equal(canStartCollab(TEAM, 'work'), false);
});

test('the policy is last-wins, and its unregister restores the dormant default', () => {
  reset();
  registerCollabOpener('work', () => {});
  const offA = registerWorkCollabPolicy(() => false);
  const offB = registerWorkCollabPolicy(() => true);
  assert.equal(canStartCollab(TEAM, 'work'), true, 'the later registration replaces the earlier');
  offA();
  assert.equal(canStartCollab(TEAM, 'work'), true, 'a superseded unregister is a no-op');
  offB();
  assert.equal(canStartCollab(TEAM, 'work'), false);
});

test('both tracks available: work is offered first for a session the instance holds', () => {
  reset();
  armPrivate();
  armWork();
  assert.deepEqual(collabAvailability(TEAM).tracks, ['work', 'private']);
  assert.deepEqual(collabAvailability(TOOL).tracks, ['private'], 'a local target keeps the private default');
});

// ── The launch context a target implies ────────────────────────────────────────

test('a tool target seeds nothing: an id and empty parts', () => {
  assert.deepEqual(collabLaunchContext(TOOL), { toolId: 'qr-code', baseParts: [] });
});

test('a session target carries state, format and the control-plane id', () => {
  assert.deepEqual(
    collabLaunchContext({ kind: 'session', toolId: 'qr-code', baseParts: ['url=x'], currentFormat: 'png', sessionId: 'sess-1' }),
    { toolId: 'qr-code', baseParts: ['url=x'], currentFormat: 'png', sessionId: 'sess-1' },
  );
});

test('unknown facts are omitted, never present as undefined keys', () => {
  const ctx = collabLaunchContext({ kind: 'session', baseParts: ['url=x'] });
  assert.deepEqual(ctx, { baseParts: ['url=x'] });
  assert.deepEqual(Object.keys(ctx), ['baseParts'], 'an ordinary local session hands the opener no empty fields');
});

// ── Starting one ───────────────────────────────────────────────────────────────

test('startCollab hands the opener the target context and reports the open', () => {
  reset();
  const seen = armPrivate();
  assert.equal(startCollab({ kind: 'session', toolId: 'qr-code', baseParts: ['url=x'], currentFormat: 'png' }, 'private'), true);
  assert.deepEqual(seen, [{ toolId: 'qr-code', baseParts: ['url=x'], currentFormat: 'png' }]);
});

test('startCollab refuses a track the target cannot start, without touching an opener', () => {
  reset();
  const priv = armPrivate();
  const work = armWork();
  assert.equal(startCollab(TOOL, 'work'), false, 'no session id, so no work room to open');
  assert.deepEqual(work, [], 'the work opener is never consulted');
  assert.deepEqual(priv, [], 'and the refusal does not fall back to the other track');
});

test('startCollab with no track named takes the default one', () => {
  reset();
  const priv = armPrivate();
  const work = armWork();
  assert.equal(startCollab(TEAM), true);
  assert.equal(work.length, 1, 'work first for a session the instance holds');
  assert.deepEqual(priv, []);
  assert.equal(startCollab(TOOL), true);
  assert.equal(priv.length, 1, 'private for a local target');
});

test('startCollab returns false when no track is available at all', () => {
  reset();
  assert.equal(startCollab(TOOL, 'private'), false);
  assert.equal(startCollab(TOOL), false);
});

test('a throwing opener degrades to false (the launch seam swallows it)', () => {
  reset();
  overrideFlagInMemory(PRIVATE_COLLAB_FLAG.id, true);
  registerCollabOpener('private', () => { throw new Error('boom'); });
  assert.equal(startCollab(TOOL, 'private'), false);
});
