// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import type { CollabConnection } from '../lib/collab-mount.ts';
import type { CollabConnectionState } from '../lib/collab-session.ts';
import { prepareTeamOpenCollab, registerTeamOpenCollabPreparation } from './team-open-collab.ts';
import { watchLiveRoom } from './collab-work-opener.ts';
import { armWorkCollabMount, _clearLiveCollabForTests, _setLiveMountEnvironmentForTests, pendingLiveCollab } from '../lib/collab-live-mount.ts';
import { acquireCollabSession } from '../lib/collab-session-source.ts';
import { _clearTeamSessionOriginForTests, pendingTeamSessionOrigin, teamSessionLive } from './team-session-origin.ts';

const origin = { sessionId: 'ses_large', toolId: 'design', projectId: 'prj_team', role: 'viewer' as const };
let stopPreparing: (() => void) | undefined;
afterEach(() => { stopPreparing?.(); _clearLiveCollabForTests(); _clearTeamSessionOriginForTests(); });

function rig() {
  let state: CollabConnectionState = 'live', closes = 0, joins = 0, navigations = 0;
  const listeners = new Set<(state: CollabConnectionState) => void>();
  const emit = (next: CollabConnectionState): void => { state = next; for (const fn of [...listeners]) fn(next); };
  const close = (): void => { closes++; emit('closed'); };
  const connection: CollabConnection = {
    role: 'member', toolId: 'design', ephemeral: false, close,
    handle: { role: 'observer', self: { clientId: 'device' }, adapter: {} as never,
      presenceIn: { subscribe: () => () => {} }, sendPresence: () => {}, close,
      events: { subscribe(fn) { listeners.add(fn); fn(state); return () => { listeners.delete(fn); }; } } },
  };
  _setLiveMountEnvironmentForTests({ currentQuery: () => '', onToolRoute: () => true,
    navigate: () => { navigations++; }, makeEphemeralState: async () => { throw new Error('Work opened an ephemeral copy'); } });
  const deps = { canJoin: () => true, arm: armWorkCollabMount, watch: watchLiveRoom,
    connect: async () => { joins++; return { ok: true as const, connection }; } };
  return { connection, deps, emit, counts: () => ({ closes, joins, navigations }) };
}

test('a team open joins once and hands the observer seat to the first mount without navigating or remounting', async () => {
  const r = rig();
  const prepared = await prepareTeamOpenCollab(origin, () => true, r.deps);
  assert.ok(prepared);
  assert.equal(pendingLiveCollab(), null, 'no plan is armed while the open can still be cancelled');
  assert.equal(pendingTeamSessionOrigin(), null);
  assert.equal(prepared.mount(), true);
  assert.equal(teamSessionLive(origin.sessionId), true, 'tool-ready must not start a second join');
  assert.equal(acquireCollabSession('design', null), r.connection.handle);
  assert.equal(acquireCollabSession('design', null), null);
  assert.equal(prepared.mount(), false, 'handover is one-shot');
  prepared.close();
  assert.deepEqual(r.counts(), { closes: 0, joins: 1, navigations: 0 });
  r.emit('closed');
  assert.equal(teamSessionLive(origin.sessionId), false);
});

test('a cancelled open closes its connection and arms no session or origin', async () => {
  const r = rig();
  const prepared = await prepareTeamOpenCollab(origin, () => true, r.deps);
  prepared!.close(); prepared!.close();
  assert.equal(prepared!.mount(), false);
  assert.equal(pendingLiveCollab(), null);
  assert.equal(pendingTeamSessionOrigin(), null);
  assert.deepEqual(r.counts(), { closes: 1, joins: 1, navigations: 0 });
});

test('a join resolving after the person leaves is closed before any handover', async () => {
  const r = rig(); let current = true;
  const prepared = await prepareTeamOpenCollab(origin, () => current, { ...r.deps,
    connect: async () => { current = false; return { ok: true, connection: r.connection }; } });
  assert.equal(prepared, null);
  assert.equal(pendingLiveCollab(), null);
  assert.equal(r.counts().closes, 1);
});

test('a refused capability stays dormant and a revoked capability closes a prepared connection', async () => {
  const r = rig(); let allowed = false;
  const deps = { ...r.deps, canJoin: () => allowed };
  assert.equal(await prepareTeamOpenCollab(origin, () => true, deps), null);
  assert.equal(r.counts().joins, 0);
  allowed = true;
  const prepared = await prepareTeamOpenCollab(origin, () => true, deps);
  allowed = false;
  assert.equal(prepared!.mount(), false);
  assert.equal(r.counts().closes, 1);
  assert.equal(teamSessionLive(origin.sessionId), false);
});

test('a connection closed before navigation leaves no armed collab', async () => {
  const r = rig();
  const prepared = await prepareTeamOpenCollab(origin, () => true, r.deps);
  r.emit('closed');
  assert.equal(prepared!.mount(), false);
  assert.equal(pendingLiveCollab(), null);
  assert.equal(teamSessionLive(origin.sessionId), false);
});

test('an unavailable collab leaves the ordinary document open and retry path available', async () => {
  const r = rig();
  assert.equal(await prepareTeamOpenCollab(origin, () => true, { ...r.deps,
    connect: async () => ({ ok: false, reason: 'unreachable', message: 'Unavailable' }) }), null);
  assert.equal(pendingLiveCollab(), null);
  assert.equal(teamSessionLive(origin.sessionId), false);
});

test('member wiring loads on demand and a sign-out during loading prevents the join', async () => {
  const r = rig(); let loads = 0; let finish!: () => void;
  assert.equal(await prepareTeamOpenCollab(origin, () => true), null, 'a plain shell stays dormant');
  stopPreparing = registerTeamOpenCollabPreparation(() => true, async () => {
    loads++;
    await new Promise<void>(resolve => { finish = resolve; });
    return r.deps;
  });
  assert.equal(loads, 0);
  const opening = prepareTeamOpenCollab(origin, () => true);
  assert.equal(loads, 1);
  stopPreparing();
  finish();
  assert.equal(await opening, null);
  assert.equal(r.counts().joins, 0);
});
