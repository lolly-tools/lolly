// SPDX-License-Identifier: MPL-2.0
/**
 * The ceremony machine is the one part of private collab whose failure modes are
 * unreachable by hand: a ten-minute unanswered invite, a laptop lid closing mid-session,
 * a guest network silently eating peer traffic. So the whole suite runs on an injected
 * clock and stub effects - no WebRTC, no DOM, no waiting.
 *
 * What is pinned here, and why each one matters:
 *  - both happy paths, end to end, including the acceptor probing BEFORE it answers;
 *  - `connected` is reached on CHANNELS READY and never on ICE - an ICE `connected` moves
 *    no phase, because on a loopback pair it arrives before the answer has been carried
 *    back at all, and promoting on it skips the acceptor's answer screen (see the
 *    "ICE-connected is not session-usable" section);
 *  - the 10-minute re-arm fires exactly at the boundary and mints a NEW invite;
 *  - a missing tool is a refusal, not a broken join (plan 100 section 6.1);
 *  - ICE `disconnected` is transient and `failed` is not (section 11.3) - the single most
 *    expensive thing to get wrong, because conflating them shows a re-pair dialog every
 *    time a Wi-Fi packet goes missing;
 *  - cancel works from every non-terminal phase, and a late effect result can never
 *    resurrect a cancelled ceremony;
 *  - an op-contract major gap joins observer-only rather than refusing (contract section 9).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CANVAS_OP_VERSION } from '@lolly-tools/core/canvas-op-v1';
import {
  ANSWER_WAIT_MS,
  CONNECT_WATCHDOG_MS,
  EFFECT_BUDGET_MS,
  createCeremony,
  isCeremonyTerminal,
} from './ceremony.ts';
import type {
  ApplyRemoteResult,
  CeremonyEffects,
  CeremonyIceState,
  CeremonyMachine,
  CeremonyPhase,
  CeremonyState,
  CeremonyTimerHandle,
  CeremonyTimers,
  CollabAnswer,
  CollabInvite,
  CreateAnswerResult,
  CreateOfferResult,
  ToolProbeResult,
} from './ceremony.ts';

// ── Harness ────────────────────────────────────────────────────────────────────────

/** A manual clock: the machine's only source of time, so the suite runs at CPU speed. */
class TestClock implements CeremonyTimers {
  now = 0;
  private seq = 0;
  private readonly due = new Map<number, { at: number; fn: () => void }>();

  setTimeout(fn: () => void, ms: number): CeremonyTimerHandle {
    this.seq += 1;
    this.due.set(this.seq, { at: this.now + ms, fn });
    return this.seq;
  }

  clearTimeout(handle: CeremonyTimerHandle): void {
    this.due.delete(handle as number);
  }

  /** Fire every timer due at or before `now + ms`, in due order, then land on the mark. */
  advance(ms: number): void {
    const target = this.now + ms;
    for (;;) {
      let nextId = -1;
      let nextAt = Number.POSITIVE_INFINITY;
      for (const [id, entry] of this.due) {
        if (entry.at <= target && entry.at < nextAt) {
          nextId = id;
          nextAt = entry.at;
        }
      }
      if (nextId === -1) break;
      const entry = this.due.get(nextId);
      this.due.delete(nextId);
      this.now = nextAt;
      entry?.fn();
    }
    this.now = target;
  }

  get pending(): number {
    return this.due.size;
  }
}

/** One macrotask drains every microtask chain the stub effects can produce. */
const settle = (): Promise<void> => new Promise((resolve) => { setImmediate(resolve); });

/** A promise that never settles - for parking the machine in an in-flight phase. */
const never = <T>(): Promise<T> => new Promise<T>(() => {});

function anInvite(over: Partial<CollabInvite> = {}): CollabInvite {
  return {
    signal: 'offer-blob',
    name: 'Priya',
    colour: '#8a3ffc',
    toolId: 'qr-code',
    toolVersion: '2.1.0',
    engineVersion: '1.108.0',
    opVersion: CANVAS_OP_VERSION,
    ...over,
  };
}

function anAnswer(over: Partial<CollabAnswer> = {}): CollabAnswer {
  return { signal: 'answer-blob', name: 'Sam', opVersion: CANVAS_OP_VERSION, ...over };
}

interface Overrides {
  createOffer?: (req: { readonly attempt: number }) => Promise<CreateOfferResult>;
  checkTool?: () => Promise<ToolProbeResult>;
  createAnswer?: (invite: CollabInvite) => Promise<CreateAnswerResult>;
  applyRemote?: (answer: CollabAnswer) => Promise<ApplyRemoteResult>;
}

interface Calls {
  createOffer: number;
  checkTool: number;
  createAnswer: number;
  applyRemote: number;
}

function stub(over: Overrides = {}): { effects: CeremonyEffects; calls: Calls } {
  const calls: Calls = { createOffer: 0, checkTool: 0, createAnswer: 0, applyRemote: 0 };
  const effects: CeremonyEffects = {
    createOffer: (req) => {
      calls.createOffer += 1;
      if (over.createOffer) return over.createOffer(req);
      // A distinct signal per mint, so "did it re-mint?" is observable.
      return Promise.resolve({ ok: true, invite: anInvite({ signal: `offer-${calls.createOffer}` }) });
    },
    checkTool: () => {
      calls.checkTool += 1;
      return over.checkTool ? over.checkTool() : Promise.resolve({ status: 'have' } as const);
    },
    createAnswer: (invite) => {
      calls.createAnswer += 1;
      if (over.createAnswer) return over.createAnswer(invite);
      return Promise.resolve({ ok: true, answer: anAnswer() });
    },
    applyRemote: (answer) => {
      calls.applyRemote += 1;
      return over.applyRemote ? over.applyRemote(answer) : Promise.resolve({ ok: true });
    },
  };
  return { effects, calls };
}

// ── Happy paths ────────────────────────────────────────────────────────────────────

test('inviter: idle → creating-invite → awaiting-answer → applying-answer → connecting → connected', async () => {
  const clock = new TestClock();
  const { effects, calls } = stub();
  const m = createCeremony({ role: 'inviter', effects, timers: clock });
  const seen: CeremonyPhase[] = [];
  m.subscribe((s) => seen.push(s.phase));

  assert.equal(m.state.phase, 'idle');
  m.send({ type: 'invite' });
  // `arming` is what keeps the dialog from offering a QR that does not exist yet.
  assert.equal(m.state.phase, 'creating-invite');
  assert.equal(m.state.arming, true);
  // Bound to a local so the assertion narrows the copy, not the machine's own property.
  const notYet = m.state.invite;
  assert.equal(notYet, undefined, 'no invite exists until the mint resolves');

  await settle();
  assert.equal(m.state.phase, 'awaiting-answer');
  assert.equal(m.state.arming, false);
  assert.equal(m.state.invite?.signal, 'offer-1');

  m.send({ type: 'answer', answer: anAnswer() });
  assert.equal(m.state.phase, 'applying-answer');
  await settle();
  assert.equal(m.state.phase, 'connecting');

  // ICE is not the finish line: a candidate pair answering a binding request says
  // nothing about whether the data channels ever opened.
  m.send({ type: 'ice', state: 'checking' });
  m.send({ type: 'ice', state: 'connected' });
  assert.equal(m.state.phase, 'connecting');

  m.send({ type: 'ready' });
  assert.equal(m.state.phase, 'connected');
  assert.equal(m.state.everConnected, true);
  assert.equal(m.state.observerOnly, false);
  assert.equal(m.state.reconnecting, false);
  assert.equal(m.state.peer?.name, 'Sam');
  assert.equal(calls.createOffer, 1);
  assert.equal(calls.applyRemote, 1);
  // Connected means no deadline is still armed: a stray watchdog would kill a live pair.
  assert.equal(clock.pending, 0);
  assert.deepEqual(seen, [
    'creating-invite',
    'awaiting-answer',
    'applying-answer',
    'connecting',
    'connected',
  ]);
});

test('acceptor: idle → reading-invite → creating-answer → awaiting-connection → connected, probing before it answers', async () => {
  const clock = new TestClock();
  let answerCallsAtProbe = -1;
  const { effects, calls } = stub({
    checkTool: () => {
      answerCallsAtProbe = calls.createAnswer;
      return Promise.resolve({ status: 'have' } as const);
    },
  });
  const m = createCeremony({ role: 'acceptor', effects, timers: clock });

  m.send({ type: 'accept', invite: anInvite() });
  assert.equal(m.state.phase, 'reading-invite');
  assert.equal(m.state.peer?.name, 'Priya');
  await settle();

  // section 6.1: the tool probe GATES the answer - answering first and discovering the tool is
  // missing afterwards is exactly the broken join the probe exists to prevent.
  assert.equal(answerCallsAtProbe, 0);
  assert.equal(calls.checkTool, 1);
  assert.equal(m.state.phase, 'awaiting-connection');
  assert.equal(m.state.answer?.signal, 'answer-blob');
  assert.equal(m.state.toolVersionNote, undefined);

  m.send({ type: 'ice', state: 'checking' });
  assert.equal(m.state.phase, 'awaiting-connection');
  // The loopback shape in one line: ICE is up while the human still holds the reply.
  m.send({ type: 'ice', state: 'connected' });
  assert.equal(m.state.phase, 'awaiting-connection', 'the reply must stay deliverable');
  assert.equal(m.state.answer?.signal, 'answer-blob');

  m.send({ type: 'ready' });
  assert.equal(m.state.phase, 'connected');
  assert.equal(m.state.everConnected, true);
  assert.equal(clock.pending, 0);
});

// ── The 10-minute re-arm (section 6.1) ────────────────────────────────────────────────────

test('an unanswered invite re-arms at exactly 10 minutes, minting a fresh offer', async () => {
  const clock = new TestClock();
  const { effects, calls } = stub();
  const m = createCeremony({ role: 'inviter', effects, timers: clock });
  m.send({ type: 'invite' });
  await settle();
  const first = m.state.invite?.signal;

  clock.advance(ANSWER_WAIT_MS - 1);
  assert.equal(calls.createOffer, 1, 'nothing re-arms a millisecond early');
  assert.equal(m.state.phase, 'awaiting-answer');

  clock.advance(1);
  assert.equal(calls.createOffer, 2);
  assert.equal(m.state.phase, 'creating-invite');
  await settle();

  assert.equal(m.state.phase, 'awaiting-answer');
  assert.equal(m.state.rearms, 1);
  // A re-arm exists to replace stale ICE candidates, so a re-arm that handed back the
  // same blob would be theatre.
  assert.notEqual(m.state.invite?.signal, first);
});

test('re-arming is bounded: after the last one the ceremony fails with timeout, not silence', async () => {
  const clock = new TestClock();
  const { effects, calls } = stub();
  const m = createCeremony({ role: 'inviter', effects, timers: clock, maxRearms: 2 });
  m.send({ type: 'invite' });
  await settle();

  clock.advance(ANSWER_WAIT_MS);
  await settle();
  assert.equal(m.state.rearms, 1);
  clock.advance(ANSWER_WAIT_MS);
  await settle();
  assert.equal(m.state.rearms, 2);

  clock.advance(ANSWER_WAIT_MS);
  assert.equal(m.state.phase, 'failed');
  assert.equal(m.state.cause, 'timeout');
  assert.equal(calls.createOffer, 3, 'the give-up does not mint a fourth offer');
  assert.equal(clock.pending, 0);
});

// ── The tool-presence gate (section 6.1) ──────────────────────────────────────────────────

test('a missing tool is an honest terminal refusal, and no answer is ever minted', async () => {
  const clock = new TestClock();
  const { effects, calls } = stub({ checkTool: () => Promise.resolve({ status: 'missing' } as const) });
  const m = createCeremony({ role: 'acceptor', effects, timers: clock });

  m.send({ type: 'accept', invite: anInvite({ toolId: 'street-map' }) });
  await settle();

  assert.equal(m.state.phase, 'failed');
  assert.equal(m.state.cause, 'tool-missing');
  assert.equal(m.state.detail, 'street-map', 'the UI names the tool it cannot find');
  assert.equal(calls.createAnswer, 0);
  assert.equal(isCeremonyTerminal(m.state.phase), true);
});

test('a MAJOR tool-version gap refuses; a minor one connects with a note', async () => {
  const major = new TestClock();
  const refused = createCeremony({
    role: 'acceptor',
    timers: major,
    effects: stub({
      checkTool: () => Promise.resolve({ status: 'version-skew', severity: 'major', localVersion: '1.4.0' } as const),
    }).effects,
  });
  refused.send({ type: 'accept', invite: anInvite() });
  await settle();
  assert.equal(refused.state.phase, 'failed');
  assert.equal(refused.state.cause, 'version-major-mismatch');

  // Minor skew is the PWA-staleness case (section 11.19): connect, and say so.
  const minor = new TestClock();
  const soft = createCeremony({
    role: 'acceptor',
    timers: minor,
    effects: stub({
      checkTool: () => Promise.resolve({ status: 'version-skew', severity: 'minor' } as const),
    }).effects,
  });
  soft.send({ type: 'accept', invite: anInvite() });
  await settle();
  assert.equal(soft.state.phase, 'awaiting-connection');
  assert.equal(soft.state.toolVersionNote, 'minor-skew');
  soft.send({ type: 'ready' });
  assert.equal(soft.state.phase, 'connected');
  assert.equal(soft.state.toolVersionNote, 'minor-skew', 'the note survives to the connected UI');
});

// ── Op-contract version skew → observer-only (contract section 9) ─────────────────────────

test('an op-contract MAJOR mismatch joins observer-only rather than refusing', async () => {
  const clock = new TestClock();
  const { effects } = stub();
  const m = createCeremony({ role: 'inviter', effects, timers: clock });
  m.send({ type: 'invite' });
  await settle();

  m.send({ type: 'answer', answer: anAnswer({ opVersion: '2.0.0' }) });
  await settle();
  m.send({ type: 'ready' });

  assert.equal(m.state.phase, 'connected', 'observer-only is a flag, never a refusal');
  assert.equal(m.state.observerOnly, true);
});

test('the acceptor sets observer-only from the invite, and a minor op skew does not', async () => {
  const clock = new TestClock();
  const older = createCeremony({ role: 'acceptor', effects: stub().effects, timers: clock });
  older.send({ type: 'accept', invite: anInvite({ opVersion: '0.9.0' }) });
  assert.equal(older.state.observerOnly, true, 'known before a single byte is answered');
  await settle();
  older.send({ type: 'ready' });
  assert.equal(older.state.phase, 'connected');
  assert.equal(older.state.observerOnly, true);

  const same = createCeremony({ role: 'acceptor', effects: stub().effects, timers: new TestClock() });
  // Minors are append-only by contract, so 1.0 ↔ 1.1 is a full-participation pair.
  same.send({ type: 'accept', invite: anInvite({ opVersion: '1.0.0' }) });
  await settle();
  assert.equal(same.state.observerOnly, false);
});

test('an undeclared op version is silence, not a gap - the in-band hello settles it', async () => {
  const clock = new TestClock();
  const m = createCeremony({ role: 'acceptor', effects: stub().effects, timers: clock });
  // The QR-budget case: sdp-codec's payload carries no version, so the invite has none.
  m.send({ type: 'accept', invite: anInvite({ opVersion: undefined }) });
  await settle();
  m.send({ type: 'ready' });
  assert.equal(m.state.phase, 'connected');
  assert.equal(m.state.observerOnly, false, 'unknown must not be treated as incompatible');

  // …and the ops channel's hello arrives before the first op, which is all section 9 needs.
  m.send({ type: 'peer-op-version', opVersion: '2.0.0' });
  assert.equal(m.state.observerOnly, true);
  assert.equal(m.state.phase, 'connected', 'a version claim is not a ceremony step');

  m.send({ type: 'peer-op-version', opVersion: CANVAS_OP_VERSION });
  assert.equal(m.state.observerOnly, false);
});

// ── ICE: disconnected vs failed (section 11.3) ────────────────────────────────────────────

async function connectedInviter(): Promise<{ m: CeremonyMachine; clock: TestClock; calls: Calls }> {
  const clock = new TestClock();
  const { effects, calls } = stub();
  const m = createCeremony({ role: 'inviter', effects, timers: clock });
  m.send({ type: 'invite' });
  await settle();
  m.send({ type: 'answer', answer: anAnswer() });
  await settle();
  // ICE first, then the lane: exactly the order a transport reports them, and only the
  // second one is what makes this pair live.
  m.send({ type: 'ice', state: 'connected' });
  m.send({ type: 'ready' });
  return { m, clock, calls };
}

test('ICE disconnected is transient: the pair stays connected and nothing re-pairs', async () => {
  const { m, clock, calls } = await connectedInviter();

  m.send({ type: 'ice', state: 'disconnected' });
  assert.equal(m.state.phase, 'connected', 'a UDP blip must not tear down a live collab');
  assert.equal(m.state.reconnecting, true);
  assert.equal(m.state.cause, undefined);
  assert.equal(calls.createOffer, 1, 'no re-invite is minted on a blip');
  // Deliberately NO grace timer: the browser escalates to `failed` itself if it does
  // not heal, and inventing a second deadline here would evict a healthy peer.
  assert.equal(clock.pending, 0);

  m.send({ type: 'ice', state: 'connected' });
  assert.equal(m.state.reconnecting, false);
  assert.equal(m.state.phase, 'connected');
});

test('ICE failed on a live inviter arms a pre-minted re-invite instead of failing', async () => {
  const { m, calls } = await connectedInviter();

  m.send({ type: 'ice', state: 'failed' });
  assert.equal(m.state.phase, 'reconnect-armed');
  assert.equal(m.state.arming, true, 'the fresh offer is already being minted');
  assert.equal(isCeremonyTerminal(m.state.phase), false);

  await settle();
  assert.equal(m.state.phase, 'reconnect-armed');
  assert.equal(m.state.arming, false);
  assert.equal(m.state.invite?.signal, 'offer-2', 'a dropped connection can never be resumed');
  assert.equal(calls.createOffer, 2);
  assert.equal(m.state.everConnected, true);

  // And the armed invite completes a normal second ceremony.
  m.send({ type: 'answer', answer: anAnswer({ name: 'Sam again' }) });
  await settle();
  // The DEAD pairing's readiness may not carry: a fresh mint is a fresh peer connection,
  // and its channels have to open on their own before this counts as connected again.
  assert.equal(m.state.phase, 'connecting');
  m.send({ type: 'ready' });
  assert.equal(m.state.phase, 'connected');
  assert.equal(m.state.peer?.name, 'Sam again');
});

test('a re-invite does not inherit the dead pairing\'s readiness', async () => {
  const { m } = await connectedInviter();
  assert.equal(m.state.phase, 'connected');

  m.send({ type: 'ice', state: 'failed' });
  await settle();
  assert.equal(m.state.phase, 'reconnect-armed');

  m.send({ type: 'answer', answer: anAnswer() });
  await settle();
  // A dropped WebRTC connection can never be resumed, so the latch that completed the
  // first pairing is spent. Inheriting it would report a live session over a peer
  // connection whose channels do not exist yet.
  assert.equal(m.state.phase, 'connecting');

  m.send({ type: 'ready' });
  assert.equal(m.state.phase, 'connected');
});

test('ICE failed on a live acceptor ends the collab: the inviter owns the session (section 6.2a)', async () => {
  const clock = new TestClock();
  const { effects, calls } = stub();
  const m = createCeremony({ role: 'acceptor', effects, timers: clock });
  m.send({ type: 'accept', invite: anInvite() });
  await settle();
  m.send({ type: 'ice', state: 'connected' });
  m.send({ type: 'ready' });
  assert.equal(m.state.phase, 'connected');

  m.send({ type: 'ice', state: 'failed' });
  assert.equal(m.state.phase, 'failed');
  assert.equal(m.state.cause, 'connection-lost', 'distinct from never having connected');
  assert.equal(m.state.everConnected, true);
  assert.equal(calls.createOffer, 0, 'the acceptor never mints an invite');
});

test('ICE failed before ever connecting reads as network isolation, not as a lost link', async () => {
  const clock = new TestClock();
  const { effects } = stub();
  const m = createCeremony({ role: 'inviter', effects, timers: clock });
  m.send({ type: 'invite' });
  await settle();
  m.send({ type: 'answer', answer: anAnswer() });
  await settle();
  assert.equal(m.state.phase, 'connecting');

  m.send({ type: 'ice', state: 'failed' });
  assert.equal(m.state.phase, 'failed');
  assert.equal(m.state.cause, 'ice-failed-isolation-suspected');
  assert.equal(m.state.everConnected, false);
});

test('ICE that connects and then dies before the channels open still fails as isolation', async () => {
  // The gap the new completion signal opens: between ICE `connected` and the lane
  // actually opening, this pair is NOT live. A failure landing in that window is the
  // network diagnosis, not `connection-lost` - they never reached each other usefully,
  // and telling them the link dropped would send them looking for the wrong thing.
  for (const role of ['inviter', 'acceptor'] as const) {
    const clock = new TestClock();
    const { effects } = stub();
    const m = createCeremony({ role, effects, timers: clock });
    if (role === 'inviter') {
      m.send({ type: 'invite' });
      await settle();
      m.send({ type: 'answer', answer: anAnswer() });
      await settle();
      assert.equal(m.state.phase, 'connecting');
    } else {
      m.send({ type: 'accept', invite: anInvite() });
      await settle();
      assert.equal(m.state.phase, 'awaiting-connection');
    }

    m.send({ type: 'ice', state: 'checking' });
    m.send({ type: 'ice', state: 'connected' });
    m.send({ type: 'ice', state: 'failed' });

    assert.equal(m.state.phase, 'failed', `${role}: an ICE failure must still end it fast`);
    assert.equal(m.state.cause, 'ice-failed-isolation-suspected', `${role}: with the diagnosis`);
    assert.equal(m.state.everConnected, false, `${role}: ICE alone was never "connected"`);
    assert.equal(clock.pending, 0, `${role}: a timer survived the failure`);
  }
});

test('a silent connect leg times out as isolation once ICE is negotiating', async () => {
  const clock = new TestClock();
  const { effects } = stub();
  const m = createCeremony({ role: 'inviter', effects, timers: clock });
  m.send({ type: 'invite' });
  await settle();
  m.send({ type: 'answer', answer: anAnswer() });
  await settle();

  clock.advance(CONNECT_WATCHDOG_MS - 1);
  assert.equal(m.state.phase, 'connecting');
  clock.advance(1);
  assert.equal(m.state.phase, 'failed');
  assert.equal(m.state.cause, 'ice-failed-isolation-suspected');
});

test("the acceptor's wait is a human deadline until ICE starts checking, then a network one", async () => {
  const clock = new TestClock();
  const { effects } = stub();
  const m = createCeremony({ role: 'acceptor', effects, timers: clock });
  m.send({ type: 'accept', invite: anInvite() });
  await settle();

  // Carrying the answer blob back can take minutes; that is not a network failure.
  clock.advance(CONNECT_WATCHDOG_MS + 1);
  assert.equal(m.state.phase, 'awaiting-connection');

  m.send({ type: 'ice', state: 'checking' });
  clock.advance(CONNECT_WATCHDOG_MS);
  assert.equal(m.state.phase, 'failed');
  assert.equal(m.state.cause, 'ice-failed-isolation-suspected');
});

test('an undelivered answer times out on the human budget', async () => {
  const clock = new TestClock();
  const { effects } = stub();
  const m = createCeremony({ role: 'acceptor', effects, timers: clock });
  m.send({ type: 'accept', invite: anInvite() });
  await settle();

  clock.advance(ANSWER_WAIT_MS);
  assert.equal(m.state.phase, 'failed');
  assert.equal(m.state.cause, 'timeout');
});

// ── The LAN race: the handshake completes INSIDE the mint (level-triggered entry) ──

/**
 * The bug this section exists for, in one sentence: on a LAN the whole handshake finishes
 * while the machine is still awaiting the effect that started it, so every edge lands in
 * a phase with no exit for it and is dropped, and nothing ever looks again.
 *
 * Reproduced 5/5 in a real-browser drill. The acceptor's trace: `sig:stable` 536ms,
 * `ice:checking` 537ms, `ice:connected` 542ms, channels open on both sides by 1269ms - 
 * and the ceremony sat on step 3 until the ten-minute answer deadline. The inviter has
 * the same shape and merely wins by about two milliseconds, which is why it gets the
 * identical treatment here rather than a special case.
 *
 * The SECOND drill, after the level read landed, found the other half of the same
 * misunderstanding: reading ICE level-triggered promoted the acceptor the instant it
 * entered `awaiting-connection`, because on loopback ICE is `connected` before the answer
 * has been delivered. Step 3 never rendered, the reply was never deliverable, and the
 * inviter waited for ever. Hence the readiness axis below: `ready` is a separate, later
 * fact, and the two are scripted independently because in the real world they are.
 *
 * `raceDuring` names the leg whose await the handshake lands inside. The stub does what
 * a real transport does, in that order: record the new level, then push the edge - so a
 * machine that only listens to edges sees exactly what the browser gave it.
 */
function racingEffects(
  raceDuring: 'createAnswer' | 'applyRemote',
  opts: {
    /** What ICE does during the await. */
    readonly states?: readonly CeremonyIceState[];
    /** Omit both level reads to get the pre-fix effects shape (see the drill test). */
    readonly levelRead?: boolean;
    /**
     * Do the CHANNELS open during the await too, and how is that discoverable?
     * `'level'` records it silently, so only a level read can find it; `'edge'` pushes
     * the event at the machine and nothing else; `'both'` does both. Absent means the
     * lane never opens - the loopback shape, where ICE is up and the pair is not usable.
     */
    readonly ready?: 'level' | 'edge' | 'both';
    /** Runs after the transitions, still inside the await. */
    readonly during?: () => void;
    /** Replaces the ICE level read entirely - for the "it throws"/"it cancels" cases. */
    readonly readIce?: () => CeremonyIceState | undefined;
    /** Replaces the readiness level read entirely, for the same two cases. */
    readonly readReady?: () => boolean | undefined;
  } = {},
): {
  readonly effects: CeremonyEffects;
  attach(machine: CeremonyMachine): void;
  /** Every edge pushed at the machine, in order - the ones the old code dropped. */
  readonly pushed: (CeremonyIceState | 'ready')[];
  /** How many times the machine asked what ICE is now. */
  reads(): number;
  /** How many times it asked whether the lane is open. */
  readyReads(): number;
} {
  const states = opts.states ?? (['checking', 'connected'] as const);
  let machine: CeremonyMachine | null = null;
  let level: CeremonyIceState = 'new';
  let readyLevel = false;
  let readCount = 0;
  let readyCount = 0;
  const pushed: (CeremonyIceState | 'ready')[] = [];

  async function race<T>(result: T): Promise<T> {
    // A real await, so the transitions genuinely land mid-flight rather than before the
    // effect was ever called.
    await Promise.resolve();
    for (const state of states) {
      level = state;
      pushed.push(state);
      machine?.send({ type: 'ice', state });
    }
    if (opts.ready) {
      if (opts.ready !== 'edge') readyLevel = true;
      if (opts.ready !== 'level') {
        pushed.push('ready');
        machine?.send({ type: 'ready' });
      }
    }
    opts.during?.();
    return result;
  }

  const { effects: base } = stub({
    createAnswer: () =>
      raceDuring === 'createAnswer'
        ? race<CreateAnswerResult>({ ok: true, answer: anAnswer() })
        : Promise.resolve({ ok: true, answer: anAnswer() }),
    applyRemote: () =>
      raceDuring === 'applyRemote' ? race<ApplyRemoteResult>({ ok: true }) : Promise.resolve({ ok: true }),
  });

  const effects: CeremonyEffects =
    opts.levelRead === false
      ? base
      : {
          ...base,
          iceState: () => {
            readCount += 1;
            return opts.readIce ? opts.readIce() : level;
          },
          channelsReady: () => {
            readyCount += 1;
            return opts.readReady ? opts.readReady() : readyLevel;
          },
        };

  return {
    effects,
    attach(m) {
      machine = m;
    },
    pushed,
    reads: () => readCount,
    readyReads: () => readyCount,
  };
}

test('acceptor: a handshake finishing inside createAnswer used to strand the pair - the level read connects it', async () => {
  const clock = new TestClock();
  // ICE *and* the lane come up inside the mint, and only the level reads can find them:
  // no edge is pushed for the lane at all.
  const rig = racingEffects('createAnswer', { ready: 'level' });
  const m = createCeremony({ role: 'acceptor', effects: rig.effects, timers: clock });
  rig.attach(m);

  m.send({ type: 'accept', invite: anInvite() });
  await settle();

  // The ICE edges really were delivered, and really were delivered too early: both landed
  // while the machine was in `creating-answer`, which has no exit for them.
  assert.deepEqual(rig.pushed, ['checking', 'connected']);
  assert.equal(m.state.phase, 'connected', 'the acceptor must not sit on step 3 with a live connection');
  assert.equal(m.state.everConnected, true);
  // And it connected on the entry read, not on a watchdog: no deadline is left armed.
  assert.equal(clock.pending, 0);
});

test('THE LOOPBACK RACE: ICE connected before the answer is delivered must NOT connect', async () => {
  // The second drill, pinned. On loopback Chrome reports the acceptor's ICE `connected`
  // BEFORE the answer reaches the inviter (pre-answer connectivity via peer-reflexive
  // checks), so the entry read finds `connected` the instant `awaiting-connection` is
  // entered. Promote on that and step 3 never renders: the reply link the inviter is
  // waiting on is never shown, never copied, never delivered, and the ceremony deadlocks
  // with both sides believing they are waiting for the other.
  const clock = new TestClock();
  const rig = racingEffects('createAnswer');   // ICE up; the lane deliberately is NOT
  const m = createCeremony({ role: 'acceptor', effects: rig.effects, timers: clock });
  rig.attach(m);
  const phases: CeremonyPhase[] = [];
  m.subscribe((s) => phases.push(s.phase));

  m.send({ type: 'accept', invite: anInvite() });
  await settle();

  assert.deepEqual(rig.pushed, ['checking', 'connected']);
  assert.ok(rig.reads() > 0, 'the ICE level read still happens - it just no longer promotes');
  assert.equal(m.state.phase, 'awaiting-connection', 'ICE connected is not a session');
  assert.equal(m.state.answer?.signal, 'answer-blob', 'and the reply is published and deliverable');
  assert.equal(m.state.everConnected, false);
  assert.ok(!phases.includes('connected'), 'nothing may have flashed past the answer screen');

  // The human carries the blob back, both descriptions land, the channels open. THAT is
  // the pair becoming usable, and it is the only thing that ends this phase well.
  m.send({ type: 'ready' });
  assert.equal(m.state.phase, 'connected');
  assert.equal(m.state.everConnected, true);
  assert.equal(clock.pending, 0, 'the delivery deadline is cleared, not left to expire');
});

test('THE LOOPBACK RACE, inviter half: ICE up while waiting cannot skip applying the answer', async () => {
  const clock = new TestClock();
  const { effects, calls } = stub();
  const m = createCeremony({ role: 'inviter', effects, timers: clock });

  m.send({ type: 'invite' });
  await settle();
  assert.equal(m.state.phase, 'awaiting-answer');

  // The peer is already reachable - it has our offer and has started checking against it.
  // The invite is still the only thing that exists; there is no session to join.
  m.send({ type: 'ice', state: 'checking' });
  m.send({ type: 'ice', state: 'connected' });
  assert.equal(m.state.phase, 'awaiting-answer');
  assert.equal(calls.applyRemote, 0);

  // Even a `ready` this early may not skip the leg: it is latched, not obeyed.
  m.send({ type: 'ready' });
  assert.equal(m.state.phase, 'awaiting-answer', 'a real answer still has to be applied');
  assert.equal(calls.applyRemote, 0);
  const nothingYet = m.state.answer;
  assert.equal(nothingYet, undefined);

  m.send({ type: 'answer', answer: anAnswer() });
  await settle();
  assert.equal(calls.applyRemote, 1, 'the answer went through the real apply leg');
  // …and the latched readiness is what completes it, on entering the phase that may.
  assert.equal(m.state.phase, 'connected');
  assert.equal(m.state.answer?.signal, 'answer-blob');
});

test('a `ready` that arrives too early is BUFFERED: the answer is published first, then the promotion', async () => {
  // The guarantee, at its most pathological: the transport reports the lane open while
  // the acceptor is still minting its answer. That cannot happen over real WebRTC (a
  // channel opens only once both descriptions are applied) - which is exactly why the
  // machine must own the invariant rather than inherit it from a well-behaved transport.
  const clock = new TestClock();
  const rig = racingEffects('createAnswer', { states: [], ready: 'edge', levelRead: false });
  const m = createCeremony({ role: 'acceptor', effects: rig.effects, timers: clock });
  rig.attach(m);
  const seen: CeremonyState[] = [];
  m.subscribe((s) => seen.push(s));

  m.send({ type: 'accept', invite: anInvite() });
  await settle();

  assert.deepEqual(rig.pushed, ['ready'], 'the edge really did land during `creating-answer`');
  assert.equal(m.state.phase, 'connected', 'a buffered ready is not a dropped one');

  const published = seen.findIndex((s) => s.phase === 'awaiting-connection');
  const promoted = seen.findIndex((s) => s.phase === 'connected');
  assert.ok(published >= 0, 'the answer screen state must exist');
  assert.ok(promoted > published, 'the machine may not skip publishing the answer');
  assert.equal(seen[published]?.answer?.signal, 'answer-blob', 'and it must carry the reply');
});

test('acceptor: with no level read the pair is stranded - the drill failure, pinned', async () => {
  const clock = new TestClock();
  const rig = racingEffects('createAnswer', { levelRead: false });
  const m = createCeremony({ role: 'acceptor', effects: rig.effects, timers: clock });
  rig.attach(m);

  m.send({ type: 'accept', invite: anInvite() });
  await settle();

  // The exact drill failure, pinned: healthy channels, and a ceremony still waiting.
  // The transport's replay does NOT rescue this shape - this subscriber was wired the
  // whole time and did hear both edges, it was simply in a phase that could not act on
  // them. The two guards cover different halves of the window; see the machine's header.
  assert.deepEqual(rig.pushed, ['checking', 'connected']);
  assert.equal(m.state.phase, 'awaiting-connection');
  // It ends on the human deadline, ten minutes later, with nothing wrong with the link.
  clock.advance(ANSWER_WAIT_MS);
  assert.equal(m.state.phase, 'failed');
  assert.equal(m.state.cause, 'timeout');
});

test('inviter: the same race inside applyRemote gets the same reads, not a special case', async () => {
  const clock = new TestClock();
  const rig = racingEffects('applyRemote', { ready: 'level' });
  const m = createCeremony({ role: 'inviter', effects: rig.effects, timers: clock });
  rig.attach(m);

  m.send({ type: 'invite' });
  await settle();
  m.send({ type: 'answer', answer: anAnswer() });
  await settle();

  assert.deepEqual(rig.pushed, ['checking', 'connected']);
  assert.equal(m.state.phase, 'connected');
  assert.equal(clock.pending, 0, 'the connect watchdog is cleared, not left to expire');
});

test('the entry read is idempotent: a level `ready` and a live one make ONE transition', async () => {
  const clock = new TestClock();
  const rig = racingEffects('createAnswer', { ready: 'level' });
  const m = createCeremony({ role: 'acceptor', effects: rig.effects, timers: clock });
  rig.attach(m);
  const entered: CeremonyPhase[] = [];
  m.subscribe((s) => entered.push(s.phase));

  m.send({ type: 'accept', invite: anInvite() });
  await settle();
  // The replay a late subscriber would get, arriving on top of the entry read: the
  // transport hands out its last ICE state AND its readiness, and neither may re-fire.
  m.send({ type: 'ice', state: 'connected' });
  m.send({ type: 'ready' });
  m.send({ type: 'ice', state: 'completed' });
  m.send({ type: 'ready' });

  assert.equal(m.state.phase, 'connected');
  assert.equal(
    entered.filter((phase) => phase === 'connected').length,
    1,
    'belt and braces must not mean two transitions',
  );
});

test('a cancel during the race window still cancels: the entry reads cannot resurrect it', async () => {
  const clock = new TestClock();
  let m: CeremonyMachine | null = null;
  // The user hits Cancel while the handshake is racing, mid-mint. The mint resolves after.
  const rig = racingEffects('createAnswer', { ready: 'level', during: () => m?.send({ type: 'cancel' }) });
  m = createCeremony({ role: 'acceptor', effects: rig.effects, timers: clock });
  rig.attach(m);

  m.send({ type: 'accept', invite: anInvite() });
  await settle();

  assert.equal(m.state.phase, 'closed');
  assert.equal(m.state.cause, 'cancelled');
  assert.equal(rig.reads(), 0, 'a cancelled ceremony never even asks');
  assert.equal(rig.readyReads(), 0, 'and that goes for the readiness read too');
  assert.equal(clock.pending, 0);
});

test('a cancel raised from inside a level read itself is respected, not overwritten', async () => {
  // The pathological ordering the second `live(gen)` check exists for: the read is
  // foreign code, and it ends the ceremony before returning a value that would connect.
  // Both reads get it, because both are foreign code called from a phase entry.
  for (const via of ['ice', 'ready'] as const) {
    const clock = new TestClock();
    let m: CeremonyMachine | null = null;
    const rig = racingEffects('createAnswer', {
      states: [],
      readIce: via === 'ice'
        ? () => {
            m?.send({ type: 'cancel' });
            return 'connected';
          }
        : () => 'new',
      readReady: via === 'ready'
        ? () => {
            m?.send({ type: 'cancel' });
            return true;
          }
        : () => false,
    });
    m = createCeremony({ role: 'acceptor', effects: rig.effects, timers: clock });
    rig.attach(m);

    m.send({ type: 'accept', invite: anInvite() });
    await settle();

    assert.equal(m.state.phase, 'closed', `cancel from inside the ${via} read`);
    assert.equal(m.state.cause, 'cancelled');
    assert.equal(rig.reads(), 1, 'ICE is read first, once');
    // A cancel raised by the ICE read is caught by the guard BEFORE readiness is asked:
    // a ceremony the user closed is not questioned further.
    assert.equal(rig.readyReads(), via === 'ready' ? 1 : 0);
    assert.equal(clock.pending, 0);
  }
});

test('a level read that throws, or cannot say, leaves the edge-triggered path exactly as it was', async () => {
  const brokenIce: (() => CeremonyIceState | undefined)[] = [
    () => {
      throw new Error('the stack is gone');
    },
    () => undefined,
    () => 'new',
  ];
  const brokenReady: (() => boolean | undefined)[] = [
    () => {
      throw new Error('the stack is gone');
    },
    () => undefined,
    () => false,
  ];
  for (let i = 0; i < brokenIce.length; i++) {
    const clock = new TestClock();
    const rig = racingEffects('createAnswer', {
      states: [],
      readIce: brokenIce[i],
      readReady: brokenReady[i],
    });
    const m = createCeremony({ role: 'acceptor', effects: rig.effects, timers: clock });
    rig.attach(m);

    m.send({ type: 'accept', invite: anInvite() });
    await settle();
    assert.equal(m.state.phase, 'awaiting-connection');

    // Still fully wired to live events, and still on the human deadline until checking.
    m.send({ type: 'ice', state: 'connected' });
    assert.equal(m.state.phase, 'awaiting-connection');
    m.send({ type: 'ready' });
    assert.equal(m.state.phase, 'connected');
  }
});

test('an ICE failure that lands during the mint is read on entry too, not only a connect', async () => {
  const clock = new TestClock();
  const rig = racingEffects('createAnswer', { states: ['checking', 'failed'] });
  const m = createCeremony({ role: 'acceptor', effects: rig.effects, timers: clock });
  rig.attach(m);

  m.send({ type: 'accept', invite: anInvite() });
  await settle();

  // Without the read this would wait ten minutes to say "unanswered" about a link the
  // network had already refused.
  assert.equal(m.state.phase, 'failed');
  assert.equal(m.state.cause, 'ice-failed-isolation-suspected');
});

// ── The answer leg's weak point (section 11.25) ───────────────────────────────────────────

test('a garbled answer is retryable: back to waiting with a note, and the next one connects', async () => {
  const clock = new TestClock();
  let attempts = 0;
  const { effects } = stub({
    applyRemote: () => {
      attempts += 1;
      return Promise.resolve(
        attempts === 1 ? { ok: false, retryable: true, detail: 'unreadable-answer' } : { ok: true },
      );
    },
  });
  const m = createCeremony({ role: 'inviter', effects, timers: clock });
  m.send({ type: 'invite' });
  await settle();

  m.send({ type: 'answer', answer: anAnswer({ opVersion: '2.0.0' }) });
  await settle();
  assert.equal(m.state.phase, 'awaiting-answer', 'a mis-scan is a step to repeat, not a restart');
  assert.equal(m.state.retryNote, 'unreadable-answer');
  assert.equal(m.state.answer, undefined);
  assert.equal(m.state.observerOnly, false, 'the discarded answer takes its version claim with it');
  assert.equal(clock.pending, 1, 'the wait is re-armed, so the invite still expires honestly');

  m.send({ type: 'answer', answer: anAnswer() });
  await settle();
  assert.equal(m.state.phase, 'connecting');
  m.send({ type: 'ready' });
  assert.equal(m.state.phase, 'connected');
  assert.equal(m.state.retryNote, undefined);
});

test('unreadable answers cannot hold the invite open for ever', async () => {
  // Every retryable answer restarts the ten-minute wait, so without a budget one
  // garbled paste every nine minutes keeps the offer, its ICE credentials and the
  // "anyone with this invite can join and edit" window alive indefinitely - and no
  // fresh candidates are ever minted either.
  const clock = new TestClock();
  const { effects, calls } = stub({
    applyRemote: () => Promise.resolve({ ok: false, retryable: true, detail: 'unreadable-answer' }),
  });
  const m = createCeremony({ role: 'inviter', effects, timers: clock, maxRearms: 2 });
  m.send({ type: 'invite' });
  await settle();

  let pastes = 0;
  while (!isCeremonyTerminal(m.state.phase) && pastes < 50) {
    clock.advance(9 * 60_000);          // just short of the wait, every time
    m.send({ type: 'answer', answer: anAnswer() });
    await settle();
    pastes += 1;
  }

  assert.equal(m.state.phase, 'failed', `still waiting after ${pastes} unreadable answers`);
  assert.equal(m.state.cause, 'timeout');
  assert.equal(pastes, 3, 'a retry spends a re-arm, so maxRearms 2 allows two of them');
  assert.equal(calls.createOffer, 1, 'and the offer was never silently re-minted behind the retries');
  assert.equal(clock.pending, 0, 'a timer survived the give-up');
});

test('a non-retryable apply, and a thrown effect, both land on local-rtc-failed', async () => {
  const hard = createCeremony({
    role: 'inviter',
    timers: new TestClock(),
    effects: stub({ applyRemote: () => Promise.resolve({ ok: false, detail: 'setRemoteDescription' }) }).effects,
  });
  hard.send({ type: 'invite' });
  await settle();
  hard.send({ type: 'answer', answer: anAnswer() });
  await settle();
  assert.equal(hard.state.phase, 'failed');
  assert.equal(hard.state.cause, 'local-rtc-failed');
  assert.equal(hard.state.detail, 'setRemoteDescription');

  const thrown = createCeremony({
    role: 'inviter',
    timers: new TestClock(),
    effects: stub({ createOffer: () => Promise.reject(new Error('no RTCPeerConnection')) }).effects,
  });
  thrown.send({ type: 'invite' });
  await settle();
  assert.equal(thrown.state.phase, 'failed');
  assert.equal(thrown.state.cause, 'local-rtc-failed');
});

test('an effect that hangs is bounded by its own budget', async () => {
  const clock = new TestClock();
  const m = createCeremony({
    role: 'inviter',
    timers: clock,
    // Non-trickle gathering against an unreachable STUN server simply waits.
    effects: stub({ createOffer: () => never() }).effects,
  });
  m.send({ type: 'invite' });
  await settle();
  clock.advance(EFFECT_BUDGET_MS - 1);
  assert.equal(m.state.phase, 'creating-invite');
  clock.advance(1);
  assert.equal(m.state.phase, 'failed');
  assert.equal(m.state.cause, 'timeout');
});

// ── Cancel, from everywhere ────────────────────────────────────────────────────────

/** Park a machine in each non-terminal phase, using never-settling effects where needed. */
async function machineIn(phase: CeremonyPhase): Promise<{ m: CeremonyMachine; clock: TestClock }> {
  const clock = new TestClock();
  const inviter = (over: Overrides = {}): CeremonyMachine =>
    createCeremony({ role: 'inviter', effects: stub(over).effects, timers: clock });
  const acceptor = (over: Overrides = {}): CeremonyMachine =>
    createCeremony({ role: 'acceptor', effects: stub(over).effects, timers: clock });

  switch (phase) {
    case 'idle':
      return { m: inviter(), clock };
    case 'creating-invite': {
      const m = inviter({ createOffer: () => never() });
      m.send({ type: 'invite' });
      await settle();
      return { m, clock };
    }
    case 'awaiting-answer': {
      const m = inviter();
      m.send({ type: 'invite' });
      await settle();
      return { m, clock };
    }
    case 'applying-answer': {
      const m = inviter({ applyRemote: () => never() });
      m.send({ type: 'invite' });
      await settle();
      m.send({ type: 'answer', answer: anAnswer() });
      await settle();
      return { m, clock };
    }
    case 'connecting': {
      const m = inviter();
      m.send({ type: 'invite' });
      await settle();
      m.send({ type: 'answer', answer: anAnswer() });
      await settle();
      return { m, clock };
    }
    case 'connected': {
      const m = inviter();
      m.send({ type: 'invite' });
      await settle();
      m.send({ type: 'answer', answer: anAnswer() });
      await settle();
      m.send({ type: 'ready' });
      return { m, clock };
    }
    case 'reconnect-armed': {
      const m = inviter();
      m.send({ type: 'invite' });
      await settle();
      m.send({ type: 'answer', answer: anAnswer() });
      await settle();
      m.send({ type: 'ready' });
      m.send({ type: 'ice', state: 'failed' });
      await settle();
      return { m, clock };
    }
    case 'reading-invite': {
      const m = acceptor({ checkTool: () => never() });
      m.send({ type: 'accept', invite: anInvite() });
      await settle();
      return { m, clock };
    }
    case 'creating-answer': {
      const m = acceptor({ createAnswer: () => never() });
      m.send({ type: 'accept', invite: anInvite() });
      await settle();
      return { m, clock };
    }
    case 'awaiting-connection': {
      const m = acceptor();
      m.send({ type: 'accept', invite: anInvite() });
      await settle();
      return { m, clock };
    }
    default:
      throw new Error(`terminal phase ${phase} is not reachable by machineIn`);
  }
}

const NON_TERMINAL: CeremonyPhase[] = [
  'idle',
  'creating-invite',
  'awaiting-answer',
  'applying-answer',
  'connecting',
  'connected',
  'reconnect-armed',
  'reading-invite',
  'creating-answer',
  'awaiting-connection',
];

test('cancel closes the ceremony from every non-terminal phase, leaving no timer behind', async () => {
  for (const phase of NON_TERMINAL) {
    const { m, clock } = await machineIn(phase);
    assert.equal(m.state.phase, phase, `failed to park the machine in ${phase}`);

    m.send({ type: 'cancel' });
    assert.equal(m.state.phase, 'closed', `cancel from ${phase}`);
    // A deliberate close is NOT a failure: the UI must never show error copy for it.
    assert.equal(m.state.cause, 'cancelled');
    assert.equal(m.state.arming, false);
    assert.equal(clock.pending, 0, `a timer survived cancel from ${phase}`);
  }
});

test('a terminal ceremony ignores everything, including a late effect result', async () => {
  const clock = new TestClock();
  let resolveOffer: ((r: CreateOfferResult) => void) | undefined;
  const { effects, calls } = stub({
    createOffer: () => new Promise<CreateOfferResult>((resolve) => { resolveOffer = resolve; }),
  });
  const m = createCeremony({ role: 'inviter', effects, timers: clock });
  m.send({ type: 'invite' });
  await settle();

  m.send({ type: 'cancel' });
  assert.equal(m.state.phase, 'closed');

  // The abandoned mint finishing later must not resurrect the ceremony - the generation
  // guard is the whole reason an in-flight effect is safe to walk away from.
  resolveOffer?.({ ok: true, invite: anInvite() });
  await settle();
  assert.equal(m.state.phase, 'closed');
  assert.equal(m.state.invite, undefined);

  m.send({ type: 'invite' });
  m.send({ type: 'ice', state: 'connected' });
  assert.equal(m.state.phase, 'closed');
  assert.equal(calls.createOffer, 1);
});

test('a cancel sent from inside a phase notification is not undone by the work it abandoned', async () => {
  // The dialog renders its Cancel button FROM `state.phase`, so `send()` can land
  // re-entrantly - in the middle of the very phase change that is about to start the
  // mint. The generation guard has to be tagged before that notification, not after.
  const clock = new TestClock();
  const { effects, calls } = stub();
  const m = createCeremony({ role: 'inviter', effects, timers: clock });
  m.subscribe((s) => {
    if (s.phase === 'creating-invite') m.send({ type: 'cancel' });
  });

  m.send({ type: 'invite' });
  assert.equal(m.state.phase, 'closed');
  assert.equal(m.state.cause, 'cancelled');
  assert.equal(calls.createOffer, 0, 'a closed ceremony still opened a peer connection');

  await settle();
  assert.equal(m.state.phase, 'closed', 'the abandoned mint resurrected a cancelled ceremony');
  assert.equal(m.state.invite, undefined);

  // …and nothing downstream can walk it back to life either.
  m.send({ type: 'ice', state: 'connected' });
  assert.equal(m.state.phase, 'closed');
  assert.equal(m.state.everConnected, false);
  clock.advance(ANSWER_WAIT_MS * 4);
  assert.equal(clock.pending, 0);
  assert.equal(calls.createOffer, 0);
});

test('a cancel from the notification that FOLLOWS an effect leaves no timer armed', async () => {
  // The same hazard one step later: the mint has already resolved, `awaiting-answer`
  // is being announced, and the re-arm timer is started after that notification.
  const clock = new TestClock();
  const { effects, calls } = stub();
  const m = createCeremony({ role: 'inviter', effects, timers: clock });
  m.subscribe((s) => {
    if (s.phase === 'awaiting-answer') m.send({ type: 'cancel' });
  });

  m.send({ type: 'invite' });
  await settle();
  assert.equal(m.state.phase, 'closed');
  assert.equal(clock.pending, 0, 'the 10-minute re-arm was armed for a closed ceremony');

  clock.advance(ANSWER_WAIT_MS * 4);
  await settle();
  assert.equal(m.state.phase, 'closed', 'a re-arm re-minted an invite after cancel');
  assert.equal(calls.createOffer, 1);
});

test('an acceptor cancelled mid-ceremony never publishes an answer', async () => {
  const clock = new TestClock();
  const { effects, calls } = stub();
  const probe = createCeremony({ role: 'acceptor', effects, timers: clock });
  probe.subscribe((s) => {
    if (s.phase === 'reading-invite') probe.send({ type: 'cancel' });
  });
  probe.send({ type: 'accept', invite: anInvite() });
  await settle();
  assert.equal(probe.state.phase, 'closed');
  assert.equal(calls.checkTool, 0, 'the local catalog was probed for a ceremony that had ended');
  assert.equal(calls.createAnswer, 0);
  assert.equal(probe.state.answer, undefined);

  // And once the answer exists: cancelling as `awaiting-connection` is announced must
  // not leave the human-delivery deadline running against a closed ceremony.
  const late = createCeremony({ role: 'acceptor', effects: stub().effects, timers: clock });
  late.subscribe((s) => {
    if (s.phase === 'awaiting-connection') late.send({ type: 'cancel' });
  });
  late.send({ type: 'accept', invite: anInvite() });
  await settle();
  assert.equal(late.state.phase, 'closed');
  assert.equal(late.state.cause, 'cancelled');
  assert.equal(clock.pending, 0, 'the delivery deadline outlived the cancel');
  clock.advance(ANSWER_WAIT_MS * 2);
  assert.equal(late.state.phase, 'closed', 'and it fired, turning a cancel into a failure');
});

test('a cancel from the answer screen survives a readiness that was already true', async () => {
  // The generation discipline through the NEW path. `syncReady` runs after the phase
  // change that publishes the answer, and that change notifies synchronously - so a
  // dialog whose Cancel is wired to the screen it just rendered can end the ceremony
  // before the read happens. A promotion that ignored the guard would reopen a session
  // the user closed, over a transport nobody is going to tear down.
  const clock = new TestClock();
  const base = stub();
  let reads = 0;
  const effects: CeremonyEffects = {
    ...base.effects,
    channelsReady: () => {
      reads += 1;
      return true;
    },
  };
  const m = createCeremony({ role: 'acceptor', effects, timers: clock });
  m.subscribe((s) => {
    if (s.phase === 'awaiting-connection') m.send({ type: 'cancel' });
  });

  m.send({ type: 'accept', invite: anInvite() });
  await settle();

  assert.equal(m.state.phase, 'closed');
  assert.equal(m.state.cause, 'cancelled');
  assert.equal(reads, 0, 'a ceremony the user closed is not asked whether it could connect');

  // And the edge landing afterwards - the transport does not know about the cancel yet - 
  // is ignored like everything else a terminal ceremony hears.
  m.send({ type: 'ready' });
  assert.equal(m.state.phase, 'closed');
  assert.equal(m.state.everConnected, false);
  assert.equal(clock.pending, 0);
});

// ── Housekeeping ───────────────────────────────────────────────────────────────────

test('events for the other role, or out of phase, are ignored rather than throwing', async () => {
  const clock = new TestClock();
  const { effects, calls } = stub();
  const acceptor = createCeremony({ role: 'acceptor', effects, timers: clock });

  acceptor.send({ type: 'invite' });
  assert.equal(acceptor.state.phase, 'idle');
  assert.equal(calls.createOffer, 0);

  acceptor.send({ type: 'answer', answer: anAnswer() });
  assert.equal(acceptor.state.phase, 'idle');

  acceptor.send({ type: 'accept', invite: anInvite() });
  await settle();
  // A second invite arriving mid-ceremony must not restart it under the user's feet.
  acceptor.send({ type: 'accept', invite: anInvite({ name: 'Someone else' }) });
  assert.equal(acceptor.state.peer?.name, 'Priya');
  assert.equal(calls.checkTool, 1);
});

test('subscribers see every state and a throwing one cannot break the machine', async () => {
  const clock = new TestClock();
  const { effects } = stub();
  const m = createCeremony({ role: 'inviter', effects, timers: clock });
  const states: CeremonyState[] = [];
  m.subscribe(() => { throw new Error('subscriber blew up'); });
  const off = m.subscribe((s) => states.push(s));

  m.send({ type: 'invite' });
  await settle();
  assert.equal(m.state.phase, 'awaiting-answer');
  assert.ok(states.length >= 2);
  // Each state is a fresh object, so a consumer can diff by identity.
  assert.notEqual(states[0], states[1]);

  off();
  const before = states.length;
  m.send({ type: 'cancel' });
  assert.equal(states.length, before);
});

test('dispose stops the clock work without pretending the ceremony ended', async () => {
  const clock = new TestClock();
  const { effects, calls } = stub();
  const m = createCeremony({ role: 'inviter', effects, timers: clock });
  m.send({ type: 'invite' });
  await settle();

  m.dispose();
  assert.equal(clock.pending, 0);
  clock.advance(ANSWER_WAIT_MS * 4);
  await settle();
  assert.equal(calls.createOffer, 1);
  assert.equal(m.state.phase, 'awaiting-answer', 'dispose is teardown, not a transition');
});
