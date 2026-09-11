// SPDX-License-Identifier: MPL-2.0
/**
 * The presence engine (plan 100 section 4.5–section 4.8, section 11.4, section 11.5; wave 1.1).
 *
 * Everything here runs on FAKE TIME - the engine takes its clock and its timers as
 * options for exactly this reason, so a 30-second eviction is asserted at the
 * millisecond rather than slept through, and the heartbeat can later move into a
 * Worker without a single test changing.
 *
 * The claims, in order of what a regression would cost:
 *
 *  1. ZERO traffic when alone (section 4.7). Not "less" - no frame, and no timer even
 *     scheduled. It is the promise single-player makes to every build.
 *  2. The 50 ms throttle coalesces a burst to one frame per window, and the LAST
 *     state of a burst still lands (trailing flush).
 *  3. TTL eviction at exactly 30 s - and never for an `away` peer (section 11.4): a
 *     background tab whose timers Chrome throttled is not a crashed tab.
 *  4. Newest-only per sender (section 11.5): the lossy presence lane delivers frames out
 *     of order, and presence is a whole-value register with no field merge to fall
 *     back on.
 *  5. A `null` state leaves immediately, rather than ghosting for the TTL.
 *  6. The join snapshot never echoes the joiner their own entry (tldraw's orphan).
 *
 * Run directly:  node --test shells/web/src/lib/collab-presence.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Presence } from '@lolly-tools/core/canvas-op-v1';
import {
  PRESENCE_HEARTBEAT_MS,
  PRESENCE_SWEEP_MS,
  PRESENCE_THROTTLE_MS,
  PRESENCE_TTL_MS,
  createPresenceEngine,
} from './collab-presence.ts';
import type { PresenceFrame, PresencePeer, PresenceState } from './collab-presence.ts';

// ── fake time ─────────────────────────────────────────────────────────────────

interface FakeClock {
  now(): number;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
  /** Run every timer due within `ms`, in due order, then park the clock there. */
  advance(ms: number): void;
  advanceTo(t: number): void;
  /** Timers still armed - how "schedules nothing at all" is asserted. */
  pending(): number;
}

function fakeClock(): FakeClock {
  let t = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();

  const runDue = (until: number): void => {
    for (;;) {
      let id = -1;
      let due: { at: number; fn: () => void } | undefined;
      for (const [key, timer] of timers) {
        if (timer.at > until) continue;
        if (!due || timer.at < due.at) { due = timer; id = key; }
      }
      if (!due) return;
      timers.delete(id);
      t = due.at;
      due.fn();
    }
  };

  return {
    now: () => t,
    setTimer(fn, ms) {
      const id = nextId++;
      timers.set(id, { at: t + ms, fn });
      return id;
    },
    clearTimer(handle) { timers.delete(handle as number); },
    advance(ms) { const until = t + ms; runDue(until); t = until; },
    advanceTo(target) { runDue(target); t = target; },
    pending: () => timers.size,
  };
}

// ── fixtures ──────────────────────────────────────────────────────────────────

function stateOf(id: string, extra: Partial<PresenceState> = {}): PresenceState {
  return { userId: id, name: id, color: '#4f46e5', ...extra };
}

function frameOf(from: string, seq: number, extra: Partial<PresenceFrame> = {}): PresenceFrame {
  return { from, seq, state: stateOf(from), ...extra };
}

/** TYPE PIN: the contract's full v1.1 `Presence` is a `PresenceState`. The engine
 *  relaxes `cursor`/`selection` for the sidebar-only tools; if that relationship
 *  ever inverts, this assignment stops compiling - which is the point. */
const CANONICAL: Presence = {
  userId: 'host', name: 'Priya F.', color: '#4f46e5',
  cursor: { x: 0.5, y: 0.25 }, selection: [], focus: 'headline',
};
const CANONICAL_AS_STATE: PresenceState = CANONICAL;

interface Rig {
  clock: FakeClock;
  sends: PresenceFrame[];
  engine: ReturnType<typeof createPresenceEngine>;
}

function rig(clientId = 'me'): Rig {
  const clock = fakeClock();
  const sends: PresenceFrame[] = [];
  const engine = createPresenceEngine({
    clientId,
    send: (f) => { sends.push(f); },
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });
  return { clock, sends, engine };
}

// ── occupancy scaling (section 4.7) ──────────────────────────────────────────────────

test('alone: zero frames and zero timers, however much the local state moves', () => {
  const { clock, sends, engine } = rig();

  engine.setLocal(stateOf('me'));
  for (let i = 0; i < 100; i++) {
    clock.advance(50);
    engine.updateLocal({ focus: `input-${i}`, cursor: { x: i / 100, y: 0.5 } });
  }
  engine.setAway(true);
  engine.setAway(false);
  clock.advance(60_000);

  assert.equal(sends.length, 0, 'nothing to say, nobody to hear');
  assert.equal(clock.pending(), 0, 'no heartbeat, no sweep, no trailing flush');
  assert.deepEqual(engine.roster(), []);
});

test('the first peer to arrive is told who we are', () => {
  const { sends, engine } = rig('me');

  engine.setLocal(stateOf('me', { focus: 'headline' }));
  assert.equal(sends.length, 0);

  assert.equal(engine.receive(frameOf('p1', 1)), true);
  assert.equal(sends.length, 1, 'a silent client would otherwise be invisible');
  assert.equal(sends[0]?.from, 'me');
  assert.equal(sends[0]?.seq, 1);
  assert.equal(sends[0]?.state?.focus, 'headline');
});

test('the last peer leaving puts us back to silence', () => {
  const { clock, sends, engine } = rig();

  engine.setLocal(stateOf('me'));
  engine.receive(frameOf('p1', 1));
  const announced = sends.length;

  engine.remove('p1');
  assert.deepEqual(engine.roster(), []);
  assert.equal(clock.pending(), 0, 'heartbeat and sweep stop with the last peer');

  clock.advance(60_000);
  engine.updateLocal({ focus: 'later' });
  assert.equal(sends.length, announced, 'no traffic once alone again');
});

// ── send throttle (section 4.7) ──────────────────────────────────────────────────────

test('outbound is coalesced to one frame per 50 ms, and the burst tail still lands', () => {
  const { clock, sends, engine } = rig();

  engine.setLocal(stateOf('me'));
  engine.receive(frameOf('p1', 1));      // announce at t=0
  assert.equal(sends.length, 1);

  // 100 updates at 10 Hz-ish over one second: five per window.
  for (let t = 10; t <= 1000; t += 10) {
    clock.advanceTo(t);
    engine.updateLocal({ focus: `f${t}` });
  }

  assert.equal(sends.length, 21, '1 leading + one per 50 ms window across 1000 ms');
  assert.equal(sends[1]?.state?.focus, 'f40', 'the window sent its newest state, not its first');
  assert.equal(sends[20]?.state?.focus, 'f990');

  clock.advance(PRESENCE_THROTTLE_MS);
  assert.equal(sends.length, 22);
  assert.equal(sends[21]?.state?.focus, 'f1000', 'trailing flush: the tail of a burst is not dropped');

  // Sequence numbers are strictly increasing across every frame we sent.
  for (let i = 1; i < sends.length; i++) {
    assert.ok((sends[i]?.seq ?? 0) > (sends[i - 1]?.seq ?? 0));
  }
});

test('self-refresh re-broadcasts every 15 s so peers never time us out', () => {
  const { clock, sends, engine } = rig();

  engine.setLocal(stateOf('me', { focus: 'headline' }));
  engine.receive(frameOf('p1', 1));
  assert.equal(sends.length, 1);

  clock.advanceTo(PRESENCE_HEARTBEAT_MS - 1);
  assert.equal(sends.length, 1, 'idle, so nothing yet');

  clock.advanceTo(PRESENCE_HEARTBEAT_MS);
  assert.equal(sends.length, 2, 'the refresh goes out unchanged');
  assert.equal(sends[1]?.state?.focus, 'headline');
  assert.ok(PRESENCE_HEARTBEAT_MS < PRESENCE_TTL_MS, 'a refresh must beat the peers TTL');
});

// ── TTL, away, explicit removal (section 4.7, section 11.4) ─────────────────────────────────

test('a silent peer is evicted at exactly 30 s, not before', () => {
  const { clock, engine } = rig();
  const seen: number[] = [];
  engine.subscribe((peers) => { seen.push(peers.length); });

  engine.setLocal(stateOf('me'));
  engine.receive(frameOf('p1', 1));
  assert.equal(engine.roster().length, 1);

  clock.advanceTo(PRESENCE_TTL_MS - 1);
  assert.equal(engine.roster().length, 1, 'one sweep short of the TTL, still here');

  clock.advanceTo(PRESENCE_TTL_MS);
  assert.deepEqual(engine.roster(), [], 'evicted on the sweep that reaches 30 s');
  assert.equal(seen.at(-1), 0, 'subscribers hear the eviction');
  assert.equal(clock.pending(), 0, 'and the lifecycle timers stop with the roster');
  assert.equal(PRESENCE_TTL_MS % PRESENCE_SWEEP_MS, 0, 'the 3 s sweep lands on the TTL');
});

test('an away peer is never evicted - a throttled background tab is not a crash', () => {
  const { clock, engine } = rig();

  engine.setLocal(stateOf('me'));
  engine.receive(frameOf('p1', 1, { away: true }));
  assert.equal(engine.roster()[0]?.away, true, 'away passes through to the roster');

  clock.advance(PRESENCE_TTL_MS * 2);
  assert.equal(engine.roster().length, 1, 'silence from an away peer means nothing');
  assert.equal(engine.roster()[0]?.away, true);

  // Coming back: a frame without the flag clears it, and the TTL applies again.
  const returned = clock.now();
  assert.equal(engine.receive(frameOf('p1', 2)), true);
  assert.equal(engine.roster()[0]?.away, false);
  assert.equal(engine.roster()[0]?.firstSeen, 0, 'still the same entry, same join order');

  clock.advanceTo(returned + PRESENCE_TTL_MS);
  assert.deepEqual(engine.roster(), [], 'back to being evictable');
});

test('removal is the transport call, not the TTL', () => {
  const { engine } = rig();
  const rosters: (readonly PresencePeer[])[] = [];
  engine.subscribe((peers) => { rosters.push(peers); });

  engine.setLocal(stateOf('me'));
  engine.receive(frameOf('p1', 1, { away: true }));
  engine.remove('p1');

  assert.deepEqual(engine.roster(), [], 'channel close removes even an away peer');
  assert.equal(rosters.at(-1)?.length, 0);
  engine.remove('p1');
  assert.equal(rosters.length, 2, 'removing a peer we do not have notifies nobody');
});

// ── ordering (section 11.5) ──────────────────────────────────────────────────────────

test('newest-only per sender: stale and duplicate frames are dropped', () => {
  const { engine } = rig();

  assert.equal(engine.receive({ from: 'p1', seq: 5, state: stateOf('p1', { focus: 'a' }) }), true);
  assert.equal(engine.roster()[0]?.state.focus, 'a');

  assert.equal(
    engine.receive({ from: 'p1', seq: 3, state: stateOf('p1', { focus: 'stale' }) }),
    false,
    'a frame that overtook a newer one on the lossy lane',
  );
  assert.equal(engine.roster()[0]?.state.focus, 'a');

  assert.equal(
    engine.receive({ from: 'p1', seq: 5, state: stateOf('p1', { focus: 'dupe' }) }),
    false,
    'equal seq is as inert as a stale one',
  );
  assert.equal(engine.roster()[0]?.state.focus, 'a');

  assert.equal(engine.receive({ from: 'p1', seq: 6, state: stateOf('p1', { focus: 'b' }) }), true);
  assert.equal(engine.roster()[0]?.state.focus, 'b');
  assert.equal(engine.roster()[0]?.seq, 6);
});

test('sequences are per sender, so one chatty peer cannot mute a quiet one', () => {
  const { engine } = rig();

  engine.receive({ from: 'p1', seq: 40, state: stateOf('p1') });
  assert.equal(engine.receive({ from: 'p2', seq: 1, state: stateOf('p2') }), true);
  assert.deepEqual(engine.roster().map((p) => p.id), ['p1', 'p2'], 'first-seen order (section 4.4)');
});

test('our own frame looped back by a relay never becomes a roster entry', () => {
  const { engine } = rig('me');
  assert.equal(engine.receive({ from: 'me', seq: 9, state: stateOf('me') }), false);
  assert.deepEqual(engine.roster(), []);
});

// ── leaving (section 4.7) ────────────────────────────────────────────────────────────

test('a null state leaves immediately, without waiting out the TTL', () => {
  const { clock, engine } = rig();
  const rosters: number[] = [];
  engine.subscribe((peers) => { rosters.push(peers.length); });

  engine.setLocal(stateOf('me'));
  engine.receive(frameOf('p1', 1));
  engine.receive(frameOf('p2', 1));
  clock.advance(1000);

  assert.equal(engine.receive({ from: 'p1', seq: 2, state: null }), true);
  assert.deepEqual(engine.roster().map((p) => p.id), ['p2'], 'gone on the frame, not on a sweep');
  assert.equal(rosters.at(-1), 1);

  assert.equal(
    engine.receive({ from: 'ghost', seq: 1, state: null }),
    false,
    'a leave for someone we never had changes nothing',
  );
  assert.equal(rosters.at(-1), 1, 'and notifies nobody');
});

test('destroy broadcasts the clean-disconnect frame and stops everything', () => {
  const { clock, sends, engine } = rig();

  engine.setLocal(stateOf('me'));
  engine.receive(frameOf('p1', 1));
  const announced = sends.length;

  engine.destroy();
  assert.equal(sends.length, announced + 1);
  assert.equal(sends.at(-1)?.state, null, 'null state = clean leave (section 4.7)');
  assert.ok((sends.at(-1)?.seq ?? 0) > (sends[announced - 1]?.seq ?? 0), 'and it is the newest');
  assert.equal(clock.pending(), 0);
  assert.deepEqual(engine.roster(), []);
  assert.equal(engine.self(), null);

  engine.destroy();
  assert.equal(sends.length, announced + 1, 'idempotent');
  assert.equal(engine.receive(frameOf('p2', 1)), false, 'and inert afterwards');
});

test('destroying while alone says nothing', () => {
  const { sends, engine } = rig();
  engine.setLocal(stateOf('me'));
  engine.destroy();
  assert.equal(sends.length, 0);
});

// ── join handshake (section 4.7) ─────────────────────────────────────────────────────

test('the join snapshot carries everyone except the joiner', () => {
  const { engine } = rig('host');

  engine.setLocal(CANONICAL_AS_STATE);
  engine.receive(frameOf('a', 7));
  engine.receive(frameOf('b', 3, { away: true }));

  const forB = engine.snapshot('b');
  assert.deepEqual(forB.map((f) => f.from), ['host', 'a'], 'never echo the joiner their own entry');
  assert.equal(forB[0]?.state?.focus, 'headline', 'our own state rides the snapshot');
  assert.equal(forB[1]?.seq, 7, 'each frame keeps its origin seq, so newest-only still holds');

  assert.deepEqual(engine.snapshot().map((f) => f.from), ['host', 'a', 'b'], 'no joiner = everyone');
  assert.equal(engine.snapshot('b').find((f) => f.from === 'a')?.away, false);
  assert.equal(engine.snapshot('a').find((f) => f.from === 'b')?.away, true, 'away rides along');
});

test('a joiner ingesting a snapshot ends up with the room, minus itself', () => {
  const { sends, engine } = rig('joiner');
  const host = rig('host');

  host.engine.setLocal(stateOf('host'));
  host.engine.receive(frameOf('a', 4));

  engine.setLocal(stateOf('joiner'));
  for (const f of host.engine.snapshot('joiner')) engine.receive(f);

  assert.deepEqual(engine.roster().map((p) => p.id), ['host', 'a']);
  assert.equal(sends.length, 1, 'one announce for the whole snapshot, not one per entry');
});

// ── subscribers ───────────────────────────────────────────────────────────────

test('subscribe returns a real teardown, and local edits do not fire it', () => {
  const { engine } = rig();
  let calls = 0;
  const off = engine.subscribe(() => { calls++; });

  engine.setLocal(stateOf('me'));
  engine.updateLocal({ focus: 'x' });
  assert.equal(calls, 0, 'the roster is peers; our own state is not a roster change');

  engine.receive(frameOf('p1', 1));
  assert.equal(calls, 1);

  off();
  engine.receive(frameOf('p1', 2));
  assert.equal(calls, 1);
});

test('the roster handed to callers is a copy', () => {
  const { engine } = rig();
  engine.receive(frameOf('p1', 1));
  const peers = engine.roster();
  (peers[0] as { away: boolean }).away = true;
  // …and the copy goes one level deeper: `state` is the object that arrived off the
  // wire, so handing it out by reference would let any caller (or any subscriber)
  // rewrite what every LATER subscriber reads.
  (peers[0]!.state as { focus?: string }).focus = 'mutated';
  assert.equal(engine.roster()[0]?.away, false, 'mutating a snapshot cannot corrupt the store');
  assert.equal(engine.roster()[0]?.state.focus, undefined, 'the stored presence is not the caller\'s to write');
});

// ── failure containment ───────────────────────────────────────────────────────

test('a trailing flush never outlives the roster', () => {
  for (const leave of [false, true]) {
    const { clock, sends, engine } = rig();

    engine.setLocal(stateOf('me'));
    engine.receive(frameOf('p1', 1));          // leading edge at t=0
    const announced = sends.length;

    clock.advance(10);
    engine.updateLocal({ focus: 'mid-burst' }); // inside the window: arms the trailing flush
    assert.equal(clock.pending(), 3, 'heartbeat + sweep + trailing');

    clock.advance(10);
    if (leave) engine.receive({ from: 'p1', seq: 2, state: null });
    else engine.remove('p1');

    assert.deepEqual(engine.roster(), [], `roster after ${leave ? 'a leave frame' : 'remove()'}`);
    assert.equal(clock.pending(), 0, 'the armed flush is disarmed with the last peer, not left ticking');

    clock.advance(60_000);
    assert.equal(sends.length, announced, 'a frame was delivered to an empty room');
  }
});

test('a throwing subscriber cannot stop the sweep', () => {
  const { clock, engine } = rig();
  engine.subscribe(() => { throw new Error('a roster listener blew up'); });

  engine.setLocal(stateOf('me'));
  engine.receive(frameOf('p1', 1));
  engine.receive(frameOf('p2', 1));

  clock.advanceTo(PRESENCE_HEARTBEAT_MS);
  assert.equal(engine.receive(frameOf('p2', 2)), true, 'receive must not rethrow a subscriber failure');

  clock.advanceTo(PRESENCE_TTL_MS);
  assert.deepEqual(engine.roster().map((p) => p.id), ['p2'], 'p1 is evicted by the throwing sweep');

  // The eviction above dispatched a subscriber that threw. If that killed the
  // repeating tick, p2 would live for ever: `syncLifecycle` cannot re-arm a
  // canceller that is still non-null.
  clock.advanceTo(PRESENCE_HEARTBEAT_MS + PRESENCE_TTL_MS);
  assert.deepEqual(engine.roster(), [], 'the sweep died with the throwing subscriber');
});

test('a transport that throws does not take the heartbeat with it', () => {
  const clock = fakeClock();
  let attempts = 0;
  const engine = createPresenceEngine({
    clientId: 'me',
    send: () => { attempts += 1; throw new Error('data channel is closed'); },
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  engine.setLocal(stateOf('me'));
  engine.receive(frameOf('p1', 1));
  assert.equal(attempts, 1, 'the announce was attempted');

  clock.advance(PRESENCE_HEARTBEAT_MS);
  engine.receive(frameOf('p1', 2));            // keep p1 inside its TTL
  clock.advance(PRESENCE_HEARTBEAT_MS);
  assert.equal(attempts, 3, 'the refresh stopped after the transport threw');
  assert.equal(engine.roster().length, 1, 'and the roster is untouched by the send failure');
});

// ── a device that reloads (section 11.4, section 11.5) ──────────────────────────────────────

test('an away peer whose counter restarts is admitted after one TTL, not never', () => {
  // The away exemption (section 11.4) removes eviction, which is the ONLY thing that clears
  // a sender's sequence bookkeeping - so without the silence rule a background tab
  // that reloads is locked out for the life of the session, not for 30 s.
  const { clock, engine } = rig();
  engine.setLocal(stateOf('me'));

  for (let seq = 1; seq <= 20; seq++) {
    assert.equal(engine.receive(frameOf('p1', seq, { away: true })), true);
  }

  // Genuine reordering - a frame that overtook a newer one milliseconds ago - is
  // still dropped. The escape is silence, not a lower sequence number.
  clock.advance(PRESENCE_TTL_MS - 1);
  assert.equal(engine.receive(frameOf('p1', 1, { away: true })), false, 'stale inside the TTL');
  assert.equal(engine.roster()[0]?.seq, 20);

  // The reload: same device id, counter back at 1, after a full TTL of silence.
  clock.advance(1);
  assert.equal(engine.receive(frameOf('p1', 1, { state: stateOf('p1', { focus: 'after-reload' }) })), true, 'rejoin refused');
  const peer = engine.roster()[0];
  assert.equal(peer?.seq, 1, 'the restarted sequence is adopted, not merged');
  assert.equal(peer?.away, false, 'and the peer is live again');
  assert.equal(peer?.state.focus, 'after-reload');
  assert.equal(peer?.firstSeen, 0, 'a reload is the same person - join order (and colour) survive');
});

test('a live peer that reloads is the documented evict-then-rejoin, unchanged', () => {
  const { clock, engine } = rig();
  engine.setLocal(stateOf('me'));
  for (let seq = 1; seq <= 20; seq++) engine.receive(frameOf('p1', seq));

  clock.advanceTo(PRESENCE_TTL_MS - 1);
  assert.equal(engine.receive(frameOf('p1', 1)), false, 'still stale: the sweep has not reached the TTL');

  clock.advanceTo(PRESENCE_TTL_MS);
  assert.deepEqual(engine.roster(), [], 'evicted on the sweep, as before');
  assert.equal(engine.receive(frameOf('p1', 1)), true);
  assert.equal(engine.roster()[0]?.firstSeen, PRESENCE_TTL_MS, 'a fresh entry, because the peer really did go');
});

// ── discovery announce (the undiscovered-pair escape hatch, drill 2026-08-10) ─

test('announce: emits while the roster is empty, and the seq stays coherent with later sends', () => {
  const { clock, sends, engine } = rig();

  // No-op before the first setLocal - nothing to announce.
  engine.announce();
  assert.equal(sends.length, 0);

  engine.setLocal(stateOf('me'));
  assert.equal(sends.length, 0, 'setLocal alone stays silent (occupancy rule)');

  engine.announce();
  assert.equal(sends.length, 1, 'announce speaks even to an empty room');
  const first = sends[0]!;
  assert.equal(first.from, 'me');
  assert.ok(first.state, 'announce carries the local state');

  // A peer arrives; the engine begins ordinary sends. Their seq must be STRICTLY
  // ABOVE the announce's, or the peer's newest-only rule drops the real frames.
  clock.advance(PRESENCE_THROTTLE_MS + 1);
  engine.receive(frameOf('peer', 1));
  clock.advance(PRESENCE_THROTTLE_MS + 1);
  engine.updateLocal({ focus: 'headline' });
  clock.advance(PRESENCE_THROTTLE_MS + 1);
  const seqs = sends.map((f) => f.seq);
  for (let i = 1; i < seqs.length; i++) {
    assert.ok(seqs[i]! > seqs[i - 1]!, `seq monotonic across announce→ordinary (${seqs.join(',')})`);
  }
});

test('announce: rides the throttle window, never a burst', () => {
  const { clock, sends, engine } = rig();
  engine.setLocal(stateOf('me'));
  engine.announce();
  engine.announce();
  engine.announce();
  assert.equal(sends.length, 1, 'back-to-back announces coalesce to one frame per window');
  clock.advance(PRESENCE_THROTTLE_MS + 1);
  assert.ok(sends.length <= 2, 'at most the trailing flush follows');
});
