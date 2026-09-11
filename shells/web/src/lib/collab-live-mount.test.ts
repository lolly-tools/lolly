// SPDX-License-Identifier: MPL-2.0
/**
 * collab-live-mount - the real mount, both roles (plan 100 section 5, section 6.2a, section 11.17, section 12 Q3).
 *
 * What is worth pinning here is not "a mount mounts". It is the four things that are
 * only true if this module is written carefully, and that silently rot if it is not:
 *
 *   1. ONE-SHOT. The session handle is handed to exactly one mount, and the registry
 *      goes back to dormant as it hands it over. A second mount of the same tool - a
 *      refresh, a back-button, a second tab of the same route - must be an ordinary
 *      single-player mount, because two runtimes sharing one convergence document
 *      would echo every edit back at each other.
 *   2. EPHEMERAL MEANS EPHEMERAL. The acceptor's `host.state` is memory-backed before
 *      the route is entered, so nothing it saves can reach a slot (section 6.2a). This suite
 *      runs in Node, where there IS no IndexedDB - so a save that "works" is a save
 *      that never went near one.
 *   3. THE SEED IS THE LIVE MODEL, both ways. The inviter's remount is born with the
 *      values it had a moment ago (unsaved edits survive becoming a collab), and the
 *      acceptor's cold open is born with the inviter's.
 *   4. THE RACE IS ADOPTED. A pairing that completed before this module was imported
 *      is drained and mounted, not dropped (`lib/collab-mount.ts`'s whole parking
 *      rationale).
 *
 * The DOM is behind one injected seam ({@link LiveMountEnvironment}) rather than jsdom:
 * this module is on the boot path and the thing it drives is `window.location` plus one
 * event, which a fake states more honestly than a simulated browser would.
 *
 * Run directly:  node --test shells/web/src/lib/collab-live-mount.test.ts
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_SEED_CHARS,
  _clearLiveCollabForTests,
  _setLiveMountEnvironmentForTests,
  installLiveCollabMount,
  liveCollabMountInstalled,
  mergeSeedQuery,
  mountLiveCollab,
  pendingLiveCollab,
  carryMountState,
  saveCollabCopy,
  seedFromBaseParts,
  seedFromQuery,
  seedToQuery,
  takeCarriedMountState,
  takeEphemeralState,
  willRemountForCollab,
} from './collab-live-mount.ts';
import type { LiveMountEnvironment } from './collab-live-mount.ts';
import {
  _clearCollabMountForTests,
  deliverCollabConnection,
  parkedCount,
} from './collab-mount.ts';
import type { CollabConnection, CollabSeed } from './collab-mount.ts';
import {
  _clearCollabSessionSourceForTests,
  acquireCollabSession,
  getCollabSessionSource,
} from './collab-session-source.ts';
import { createMemoryStateAPI } from './ephemeral-state.ts';
import type { CollabSessionHandle } from './collab-session.ts';
import type { WebStateAPI } from '../bridge/state.ts';

// ── Fakes ─────────────────────────────────────────────────────────────────────

interface FakeHandle extends CollabSessionHandle {
  /** Drive the connection-state stream (the only part of the handle this module reads). */
  emit(state: 'connecting' | 'live' | 'reconnecting' | 'closed'): void;
  subscribers(): number;
}

function handle(clientId = 'device-1'): FakeHandle {
  const subs = new Set<(s: 'connecting' | 'live' | 'reconnecting' | 'closed') => void>();
  return {
    adapter: {} as CollabSessionHandle['adapter'],
    role: 'writer',
    self: { clientId },
    presenceIn: { subscribe: () => () => {} },
    sendPresence: () => {},
    events: {
      subscribe(fn) { subs.add(fn); return () => { subs.delete(fn); }; },
    },
    close: () => {},
    emit(state) { for (const fn of [...subs]) fn(state); },
    subscribers: () => subs.size,
  };
}

interface FakeConn extends CollabConnection {
  closes(): number;
  session: FakeHandle;
}

function conn(over: Partial<CollabConnection> & { session?: FakeHandle } = {}): FakeConn {
  let closed = 0;
  const session = over.session ?? handle();
  return {
    role: 'acceptor',
    toolId: 'qr-code',
    ephemeral: true,
    ...over,
    handle: session,
    close: () => { closed += 1; },
    closes: () => closed,
    session,
  } as FakeConn;
}

interface Nav { hash: string; force: boolean }

function environment(over: Partial<LiveMountEnvironment> = {}): LiveMountEnvironment & { navs: Nav[] } {
  const navs: Nav[] = [];
  const env = {
    navs,
    currentQuery: () => '',
    onToolRoute: () => false,
    navigate(hash: string, force: boolean) { navs.push({ hash, force }); },
    makeEphemeralState: async () => createMemoryStateAPI(),
    ...over,
  };
  _setLiveMountEnvironmentForTests(env);
  return env;
}

beforeEach(() => {
  _clearLiveCollabForTests();
  _clearCollabMountForTests();
  _clearCollabSessionSourceForTests();
});

// ── The seed codec ────────────────────────────────────────────────────────────

test('a seed is URL-mode params, and survives the round trip it will actually make', () => {
  const parts = ['url=https%3A%2F%2Fsuse.com', 'size=512', 'dark=true', 'label=Hello%20there'];
  const seed = seedFromBaseParts(parts)!;
  assert.equal(seed.url, 'https://suse.com', 'decoded once, by the parser that will read it back');
  assert.equal(seed.size, '512');

  // The trip a seed makes: baseParts → record → query → the route's own parser.
  const back = new URLSearchParams(seedToQuery(seed));
  assert.equal(back.get('url'), 'https://suse.com');
  assert.equal(back.get('label'), 'Hello there');
  assert.equal(back.get('dark'), 'true');
});

test('the seed is bounded and refuses the keys that are never inputs', () => {
  assert.equal(seedFromQuery(undefined), undefined);
  assert.equal(seedFromQuery(''), undefined);
  assert.equal(seedFromQuery('a=' + 'x'.repeat(MAX_SEED_CHARS)), undefined, 'a peer cannot send an unbounded seed');

  const hostile = seedFromQuery('__proto__=polluted&constructor=x&prototype=y&url=ok')!;
  assert.deepEqual(Object.keys(hostile), ['url'], 'prototype keys are dropped, not renamed');
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
  assert.equal(Object.getPrototypeOf(hostile), null, 'a null-prototype bag cannot be walked into');
  // And they cannot re-enter through the encoder either.
  assert.equal(seedToQuery({ __proto__: 'x', url: 'ok' } as CollabSeed), 'url=ok');
});

test('merging a seed with the address bar keeps the bar on top (it is the fresher edit)', () => {
  // `syncUrl` writes only what the user CHANGED; the seed carries the whole model. So a
  // value edited after the ceremony opened must not be reverted by the seed, and a value
  // that came from a resumed slot must not be lost for never having been dirty.
  const seed = seedFromQuery('url=https%3A%2F%2Fold.example&size=512&style=round')!;
  const merged = new URLSearchParams(mergeSeedQuery(seed, 'url=https%3A%2F%2Fnew.example'));
  assert.equal(merged.get('url'), 'https://new.example', 'the bar wins the collision');
  assert.equal(merged.get('size'), '512', 'and the seed supplies what the bar never wrote');
  assert.equal(merged.get('style'), 'round');
});

// ── The mount ─────────────────────────────────────────────────────────────────

test('the acceptor is navigated to the tool, born with the seed (section 12 Q3)', async () => {
  const env = environment();
  await mountLiveCollab(conn({ seed: seedFromQuery('url=https%3A%2F%2Fsuse.com&size=512') }));

  assert.equal(env.navs.length, 1);
  const [{ hash, force }] = env.navs as [Nav];
  assert.equal(force, false, 'a cold arrival from #/join is a route CHANGE - no force needed');
  assert.match(hash, /^#\/tool\/qr-code\?/);
  const params = new URLSearchParams(hash.slice(hash.indexOf('?') + 1));
  assert.equal(params.get('url'), 'https://suse.com');
  assert.equal(params.get('size'), '512');
});

test('an acceptor whose seed arrives late is waited for, not mounted empty', async () => {
  const env = environment();
  let land: (seed: CollabSeed | undefined) => void = () => {};
  const later = new Promise<CollabSeed | undefined>((resolve) => { land = resolve; });

  const mounting = mountLiveCollab(conn({ seedLater: later }));
  await new Promise((r) => { setImmediate(r); });
  assert.equal(env.navs.length, 0, 'the tool is not opened empty while the seed is in flight');

  land(seedFromQuery('url=https%3A%2F%2Flate.example'));
  await mounting;
  assert.equal(env.navs.length, 1);
  assert.match(env.navs[0]!.hash, /url=https%3A%2F%2Flate\.example/);
});

test('a seed that never lands is not an error - the mount opens and convergence catches up', async () => {
  const env = environment();
  await mountLiveCollab(conn({ seedLater: Promise.resolve(undefined) }));
  assert.deepEqual(env.navs, [{ hash: '#/tool/qr-code', force: false }]);
  assert.equal(pendingLiveCollab()?.toolId, 'qr-code', 'and the session is still armed for it');
});

test('the inviter is force-remounted in place, and the remount preserves the live model', async () => {
  // The inviter is already IN the tool: same route, and the tool route's dedup signature
  // strips params - so without the force-nav nothing would remount at all.
  const env = environment({
    onToolRoute: () => true,
    currentQuery: () => 'url=https%3A%2F%2Fedited-after-the-dialog-opened.example',
  });
  const seed = seedFromBaseParts([
    'url=https%3A%2F%2Fat-ceremony-start.example',
    'size=512',
    'label=unsaved%20edit',
  ]);
  await mountLiveCollab(conn({ role: 'inviter', ephemeral: false, seed }));

  assert.equal(env.navs.length, 1);
  const nav = env.navs[0]!;
  assert.equal(nav.force, true, "the house 'lolly:remount' force-nav - a param-only change never remounts");
  const params = new URLSearchParams(nav.hash.slice(nav.hash.indexOf('?') + 1));
  assert.equal(params.get('size'), '512', 'a value the bar never wrote survives the remount');
  assert.equal(params.get('label'), 'unsaved edit', 'and so does an unsaved edit');
  assert.equal(params.get('url'), 'https://edited-after-the-dialog-opened.example',
    'while an edit made after the ceremony opened is not reverted by the older seed');
});

test('a work-collab member mounts through the same path, and nothing double-seeds', async () => {
  const env = environment();
  await mountLiveCollab(conn({ role: 'member', ephemeral: false, toolId: 'street-map' }));

  assert.deepEqual(env.navs, [{ hash: '#/tool/street-map', force: false }],
    'no seed in the route: an org room is seeded by the join-ack, through the provider');
  assert.equal(takeEphemeralState('street-map'), null, 'and a member is never ephemeral');
  assert.equal(pendingLiveCollab()?.ephemeral, false);
});

test('a connection with no tool has nowhere to go, and is hung up rather than left open', async () => {
  environment();
  const c = conn({ toolId: undefined });
  await mountLiveCollab(c);
  assert.equal(c.closes(), 1, 'a pair whose peer is waiting at "live" must not be left there');
  assert.equal(pendingLiveCollab(), null);
  assert.equal(getCollabSessionSource(), undefined, 'and nothing is armed for a mount that cannot happen');
});

// ── One-shot ──────────────────────────────────────────────────────────────────

test('the session handle is handed over exactly once, and only to its own tool', async () => {
  environment();
  const c = conn({ toolId: 'qr-code' });
  await mountLiveCollab(c);

  assert.equal(acquireCollabSession('street-map', null), null,
    'another tool opened during a collab is an ordinary single-player mount');
  assert.equal(acquireCollabSession('qr-code', null), c.handle, 'the mount it was armed for gets it');
  assert.equal(acquireCollabSession('qr-code', null), null,
    'a refresh, a second tab, a back-button: two runtimes on one document would echo forever');
  assert.equal(getCollabSessionSource(), undefined, 'the registry is dormant again - nothing to leak');
  assert.equal(pendingLiveCollab(), null);
});

test('a second ceremony replaces the first, and hangs the unmounted one up', async () => {
  environment();
  const first = conn({ toolId: 'qr-code' });
  const second = conn({ toolId: 'street-map' });
  await mountLiveCollab(first);
  await mountLiveCollab(second);

  assert.equal(first.closes(), 1, 'the older pair has no route coming - leaving it open is the leak');
  assert.equal(acquireCollabSession('qr-code', null), null);
  assert.equal(acquireCollabSession('street-map', null), second.handle);
});

test('a session that dies before its mount disarms itself rather than being adopted dead', async () => {
  environment();
  const c = conn();
  await mountLiveCollab(c);
  assert.equal(c.session.subscribers(), 1, 'the plan watches the connection it is holding');

  c.session.emit('closed');
  assert.equal(pendingLiveCollab(), null, 'a collab pill that could never go live is worse than none');
  assert.equal(acquireCollabSession('qr-code', null), null);
  assert.equal(c.session.subscribers(), 0, 'and the watch is not left behind');
});

test('adopting the handle drops the watch - the mount owns the session from then on', async () => {
  environment();
  const c = conn();
  await mountLiveCollab(c);
  assert.equal(acquireCollabSession('qr-code', null), c.handle);
  assert.equal(c.session.subscribers(), 0);
  c.session.emit('closed');   // the mounted session closing is the view's business, not ours
});

test('a handle that is ALREADY closed at arm time leaves nothing behind (both real handles replay)', async () => {
  // The fake above does not replay on subscribe. BOTH shipping transports do - 
  // `collab/rtc-handle.ts`'s emitter calls `fn(current())` inside `subscribe`, and
  // `org/collab-handle.ts`'s events lane documents it as "the current state,
  // immediately" - so the disarm callback runs BEFORE `subscribe()` has returned an
  // unsubscribe to call. Reachable on both tracks: Track A's acceptor waits up to
  // SEED_WAIT_MS for the hello first, which is plenty of time for the peer to hang up.
  const env = environment();
  const replaying = handle();
  const inner = replaying.events.subscribe.bind(replaying.events);
  let live = 0;
  (replaying.events as { subscribe: CollabSessionHandle['events']['subscribe'] }).subscribe = (fn) => {
    const off = inner(fn);
    live += 1;
    fn('closed');                     // …synchronously, before `off` reaches the caller
    return () => { live -= 1; off(); };
  };
  const c = conn({ session: replaying, ephemeral: false, role: 'inviter' });

  await mountLiveCollab(c);

  assert.equal(pendingLiveCollab(), null, 'no plan survives a session that is already gone');
  assert.equal(getCollabSessionSource(), undefined,
    'and the registry goes back to DORMANT - a source left registered makes every later '
    + 'single-player mount allocate a context for an inert factory (section 11.14)');
  assert.equal(live, 0, 'the connection-state subscription is not leaked');
  assert.equal(c.closes(), 1, 'the pair is hung up, not left open for the life of the page');
  assert.deepEqual(env.navs, [],
    'and nobody is force-remounted out of their live model for a collab that does not exist');
});

// ── The inviter's remount keeps what no URL can carry ─────────────────────────

test("the inviter's live model crosses the remount BY REFERENCE, not through the bar", async () => {
  // The values a URL provably cannot carry: a picked file's bytes (`buildShareParams`
  // has no case for a `file` input and `syncUrl` skips the type outright), a `user/`
  // asset id (both encoders skip the prefix), and a value past the 150-char cap.
  const bytes = new Uint8Array([1, 2, 3]);
  const paragraph = 'x'.repeat(300);
  environment({ onToolRoute: () => true, currentQuery: () => 'size=512' });

  const c = conn({ role: 'inviter', ephemeral: false, toolId: 'qr-code', seed: seedFromQuery('size=512')! });
  assert.equal(willRemountForCollab('qr-code'), false, 'nothing is armed before the mount runs');
  await mountLiveCollab(c);

  // What `views/tool.ts`'s _cleanup does, on the outgoing mount, before the remount.
  assert.equal(willRemountForCollab('qr-code'), true);
  assert.equal(willRemountForCollab('street-map'), false, 'a different tool is not this collab');
  carryMountState('qr-code', 'qr-code:1712', { logo: 'user/logo-9', doc: { bytes }, note: paragraph });

  const carried = takeCarriedMountState('qr-code')!;
  assert.equal(carried.values.logo, 'user/logo-9', 'an uploaded asset survives - nothing was encoded');
  assert.equal((carried.values.doc as { bytes: Uint8Array }).bytes, bytes, 'the SAME buffer, not a copy of a string');
  assert.equal(carried.values.note, paragraph, 'and a value the 150-char cap would have dropped');
  assert.equal(carried.slot, 'qr-code:1712',
    'plus the slot the bar never re-adds - without it the first Save mints a duplicate session');
  assert.equal(takeCarriedMountState('qr-code'), null, 'one-shot: the next mount is a different session');
});

test('an ACCEPTOR already in the tool carries nothing - their copy is the peer’s (section 6.2a)', async () => {
  environment({ onToolRoute: () => true });
  await mountLiveCollab(conn({ role: 'acceptor', ephemeral: true, toolId: 'qr-code' }));

  assert.equal(willRemountForCollab('qr-code'), false,
    'carrying a joiner’s stale pre-join values in would be a silent edit to someone else’s document');
  carryMountState('qr-code', null, { note: 'mine' });
  assert.equal(takeCarriedMountState('qr-code'), null, 'and a stray call cannot pin a model in module state');
});

test('a pair that dies mid-remount does NOT take the carried model with it', async () => {
  // The carry only exists after `navigate` has already run, so dropping it on a late
  // disarm would delete the live model of a remount that is already in flight - the
  // exact loss the hand-off exists to prevent. What bounds it is the NEXT ceremony.
  environment({ onToolRoute: () => true });
  const c = conn({ role: 'inviter', ephemeral: false, toolId: 'qr-code' });
  await mountLiveCollab(c);
  carryMountState('qr-code', null, { note: 'kept' });

  c.session.emit('closed');
  assert.equal(takeCarriedMountState('qr-code')?.values.note, 'kept',
    'the remount still restores what the route could not carry');

  carryMountState('qr-code', null, { note: 'stale' });   // ignored: nothing is armed now
  await mountLiveCollab(conn({ role: 'inviter', ephemeral: false, toolId: 'qr-code' }));
  assert.equal(takeCarriedMountState('qr-code'), null, 'and a new ceremony starts clean');
});

// ── Ephemerality (section 6.2a, section 11.17) ──────────────────────────────────────────────

test("the acceptor's state bridge is memory-backed, one-shot, and never touches a slot", async () => {
  assert.equal((globalThis as { indexedDB?: unknown }).indexedDB, undefined,
    'this suite runs where a real slot write could only throw - which is the proof');
  environment();
  await mountLiveCollab(conn({ toolId: 'qr-code', ephemeral: true }));

  const state = takeEphemeralState('qr-code');
  assert.ok(state, 'armed BEFORE the route is entered, so no save can beat it to the real one');
  assert.equal(takeEphemeralState('qr-code'), null, 'one-shot: the next mount saves for real');

  await state.save('session-1', { __toolId: 'qr-code', url: 'https://suse.com' });
  const listed = await state.list();
  assert.deepEqual(listed.map((e) => e.slot), ['session-1'], 'the save "works" - in memory');

  // A second acceptor runtime has its own store; nothing is shared, nothing persists.
  const other = createMemoryStateAPI();
  assert.deepEqual(await other.list(), []);
});

test('the inviter keeps the real state - it owns the saved session (section 6.2a)', async () => {
  environment();
  await mountLiveCollab(conn({ role: 'inviter', ephemeral: false, toolId: 'qr-code' }));
  assert.equal(takeEphemeralState('qr-code'), null, 'no swap, so its saves land where they always did');
});

test('"Save a copy" lifts the ephemeral session into a real store as a fresh slot', async () => {
  environment();
  await mountLiveCollab(conn({ toolId: 'qr-code', ephemeral: true }));
  const ephemeral = takeEphemeralState('qr-code')!;
  await ephemeral.save('live', { __toolId: 'qr-code', url: 'https://suse.com', __label: 'From Priya' });

  const real: WebStateAPI = createMemoryStateAPI();   // stands in for the device's own store
  // No `from`: handing the bridge to the mount does not lose it, because the acceptor's
  // work exists nowhere else - one-shot is about the HANDOVER, not the reference.
  const slot = await saveCollabCopy(real);
  assert.ok(slot, 'a disclosed fork, not a shared artifact');
  const saved = await real.load(slot);
  assert.equal((saved as { url?: string } | null)?.url, 'https://suse.com');
  assert.notEqual(slot, 'live', 'a copy is a new session on this device, never the peer’s slot id');

  assert.equal(await saveCollabCopy(createMemoryStateAPI(), { from: createMemoryStateAPI() }), null,
    'nothing saved yet is nothing to copy - not an empty session in Projects');
});

// ── The stitch ────────────────────────────────────────────────────────────────

test('installing adopts the pairing that completed while this module was importing', async () => {
  const env = environment();
  // The race `lib/collab-mount.ts`'s parking surface exists for: the acceptor arrives on
  // #/join cold, from a link, and the pair can connect before anything owns co-editing.
  const early = conn({ toolId: 'street-map', seed: seedFromQuery('lat=52.5&lon=13.4') });
  assert.equal(deliverCollabConnection(early), false);
  assert.equal(parkedCount(), 1);

  const off = installLiveCollabMount();
  assert.equal(liveCollabMountInstalled(), true);
  assert.equal(parkedCount(), 0, 'drained, not dropped');
  await new Promise((r) => { setImmediate(r); });

  assert.equal(env.navs.length, 1);
  assert.match(env.navs[0]!.hash, /^#\/tool\/street-map\?lat=52\.5/);
  assert.equal(acquireCollabSession('street-map', null), early.handle);

  off();
  assert.equal(liveCollabMountInstalled(), false);
});

test('once installed, a connection goes straight to the mount', async () => {
  const env = environment();
  const off = installLiveCollabMount();
  assert.equal(deliverCollabConnection(conn({ toolId: 'qr-code' })), true);
  assert.equal(parkedCount(), 0, 'a delivered connection is never also parked');
  await new Promise((r) => { setImmediate(r); });
  assert.deepEqual(env.navs, [{ hash: '#/tool/qr-code', force: false }]);
  off();
});

test('a mount that throws still hangs the connection up rather than stranding the peer', async () => {
  environment({ makeEphemeralState: () => Promise.reject(new Error('no state bridge')) });
  const c = conn({ ephemeral: true });
  await mountLiveCollab(c);
  assert.equal(c.closes(), 1);
  assert.equal(pendingLiveCollab(), null);
  assert.equal(getCollabSessionSource(), undefined);
});
