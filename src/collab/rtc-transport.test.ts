// SPDX-License-Identifier: MPL-2.0
/**
 * Every behaviour this transport exists to get right is one you cannot produce on
 * demand from a real browser: a gathering phase that never finishes because no STUN
 * server is reachable, ICE dropping to `disconnected` for four seconds and healing, a
 * guest network where both sides gather candidates and no pair ever forms. So the whole
 * suite runs against a scripted fake `RTCPeerConnection` on an injected clock - no
 * WebRTC, no DOM, no waiting.
 *
 * The SDP the fake hands out is built by the REAL codec (`reconstruct`) and read back
 * by the real `extract`, so the round-trips here are genuine ones: what a test asserts
 * about a minted invite is what a peer would actually decode.
 *
 * What is pinned, and why each one is essential:
 *  - the three channels and their exact options (section 6.2, section 11.6) - presence being ordered
 *    or beam sharing the ops channel are both silent, expensive regressions;
 *  - non-trickle gathering is WAITED for, and its timeout mints anyway (section 6.1) - a
 *    ceremony that fails because the internet is absent is the one failure this
 *    airgap-first feature may not have;
 *  - `disconnected` ≠ `failed` (section 11.3), the single most expensive confusion available;
 *  - the isolation heuristic and the three diagnoses it must not be confused with
 *    (section 11.1, section 11.2, section 11.26);
 *  - presence frames keep their sequence numbers and are passed through unreordered
 *    (section 11.5) - the transport must not "help";
 *  - `close()` leaves zero listeners and zero timers;
 *  - the effects drive `ceremony.ts` end to end, both halves, over the fake stack.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CANVAS_OP_VERSION } from '@lolly-tools/core/canvas-op-v1';
import { HISTORY_PROTOCOL_VERSION } from '../lib/collab-history.ts';
import { createCeremony } from './ceremony.ts';
import type {
  CeremonyEffects,
  CeremonyMachine,
  CeremonyTimerHandle,
  CeremonyTimers,
  CollabInvite,
  ToolProbeResult,
} from './ceremony.ts';
import { decodePayload, encodePayload, reconstruct } from './sdp-codec.ts';
import type { IceCandidate, SdpMaterial } from './sdp-codec.ts';
import {
  BEAM_LOW_THRESHOLD,
  CHANNEL_INIT,
  GATHER_TIMEOUT_MS,
  LANES,
  MAX_FRAME_BYTES,
  answerFromToken,
  createRtcTransport,
  inviteFromToken,
  parsePresenceFrame,
} from './rtc-transport.ts';
import type {
  RtcCeremonyEvent,
  RtcDataChannelLike,
  RtcDescriptionLike,
  RtcInboundMessage,
  RtcLane,
  RtcListener,
  RtcPeerConnectionCtor,
  RtcPeerConnectionLike,
  RtcStatsLike,
  RtcTransport,
} from './rtc-transport.ts';
import { PLATE_RE, derivePlate } from './plate.ts';
import type { PresenceFrame, PresenceState } from '../lib/collab-presence.ts';

// ── Clock ──────────────────────────────────────────────────────────────────────────

/** The transport's only source of time, so the suite runs at CPU speed. */
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

/** One macrotask drains every microtask chain the transport's awaits can produce. */
const settle = (): Promise<void> => new Promise((resolve) => { setImmediate(resolve); });

// ── SDP material, built by the real codec ─────────────────────────────────────────

function unwrap<T>(result: { ok: true; value: T } | { ok: false; reason: string }): T {
  if (!result.ok) throw new Error(result.reason);
  return result.value;
}

function hostCandidate(index: number): IceCandidate {
  return { type: 'host', protocol: 'udp', address: `192.168.1.${5 + index}`, port: 50000 + index };
}

/** RFC 5245's `ice-char` set, which is exactly 64 characters - see the codec's header. */
const ICE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function iceString(length: number, salt: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += ICE_CHARS[(i * 13 + salt * 7 + 3) % 64];
  return out;
}

/**
 * Distinct credentials AND a distinct fingerprint per salt. The fingerprint is the
 * pairing's trust root, and a re-invite must mint fresh ICE credentials - a suite that
 * shared one constant across every connection could not tell a re-mint from a re-send.
 */
function material(candidates: number, salt: number): SdpMaterial {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 7 + salt * 31) & 0xff;
  const list: IceCandidate[] = [];
  for (let i = 0; i < candidates; i++) list.push(hostCandidate(i));
  return {
    fingerprint: { algo: 'sha-256', bytes },
    iceUfrag: iceString(8, salt),
    icePwd: iceString(24, salt),
    candidates: list,
    setupRole: 'actpass',
  };
}

function sdpFor(kind: 'offer' | 'answer', candidates: number, salt: number): string {
  return unwrap(reconstruct(material(candidates, salt), kind));
}

function candidatesInToken(token: string): number {
  const payload = unwrap(decodePayload(token, 'auto'));
  return payload.material.candidates.length;
}

// ── The scripted fake ─────────────────────────────────────────────────────────────

interface FakeListenerEntry {
  readonly type: string;
  readonly fn: RtcListener;
}

class FakeChannel implements RtcDataChannelLike {
  readyState = 'connecting';
  binaryType = 'blob';
  bufferedAmount = 0;
  bufferedAmountLowThreshold = 0;
  readonly sent: (string | ArrayBufferLike | ArrayBufferView)[] = [];
  readonly listeners: FakeListenerEntry[] = [];
  /** Set by {@link pipe} to hand what is written straight to the other peer. */
  onSend: ((data: string | ArrayBufferLike | ArrayBufferView) => void) | null = null;

  readonly label: string;
  readonly init: RTCDataChannelInit | undefined;

  constructor(label: string, init?: RTCDataChannelInit) {
    this.label = label;
    this.init = init;
  }

  send(data: string | ArrayBufferLike | ArrayBufferView): void {
    if (this.readyState !== 'open') throw new Error(`channel ${this.label} is ${this.readyState}`);
    this.sent.push(data);
    this.onSend?.(data);
  }

  close(): void {
    if (this.readyState === 'closed') return;
    this.readyState = 'closed';
    this.fire('close');
  }

  addEventListener(type: string, fn: RtcListener): void {
    this.listeners.push({ type, fn });
  }

  removeEventListener(type: string, fn: RtcListener): void {
    const index = this.listeners.findIndex((entry) => entry.type === type && entry.fn === fn);
    if (index >= 0) this.listeners.splice(index, 1);
  }

  fire(type: string, extra: Record<string, unknown> = {}): void {
    for (const entry of [...this.listeners]) {
      if (entry.type === type) entry.fn({ type, ...extra });
    }
  }

  open(): void {
    this.readyState = 'open';
    this.fire('open');
  }

  /** Inbound frame, as the peer's `send` produced it. */
  deliver(data: unknown): void {
    this.fire('message', { data });
  }

  /** The frames written to this channel, JSON-parsed. */
  frames(): Record<string, unknown>[] {
    return this.sent
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => JSON.parse(entry) as Record<string, unknown>);
  }
}

interface PcScript {
  /** What `createOffer`/`createAnswer` hand back. */
  offerSdp: string;
  answerSdp: string;
  /**
   * `'state'` completes gathering via `icegatheringstatechange`, `'null-candidate'` via
   * the end-of-candidates signal (both happen in the wild, and only one is enough),
   * `'manual'` leaves it to the test - which is the timeout case.
   */
  gather: 'state' | 'null-candidate' | 'manual';
  candidates: number;
  /** `getStats` reports; `null` removes `getStats` entirely (section 11.29). */
  stats: unknown[] | null;
  /** Make `setRemoteDescription` reject - a local stack failure, not a bad paste. */
  rejectRemote?: boolean;
  /**
   * The LAN timing, scripted: ICE transitions fired from inside `setLocalDescription`.
   *
   * This is not an exotic case. A measured pair on a wire went `sig:stable` 536ms,
   * `ice:checking` 537ms, `ice:connected` 542ms - the whole handshake inside the five
   * milliseconds after the local description landed, which is well inside the `await`
   * the ceremony's `createAnswer`/`applyRemote` is still sitting in.
   */
  iceOnLocalDescription?: readonly string[];
}

function defaultScript(salt: number): PcScript {
  return {
    offerSdp: sdpFor('offer', 2, salt),
    answerSdp: sdpFor('answer', 2, salt),
    gather: 'state',
    candidates: 2,
    stats: null,
  };
}

class FakePc implements RtcPeerConnectionLike {
  iceGatheringState = 'new';
  iceConnectionState = 'new';
  connectionState = 'new';
  localDescription: RtcDescriptionLike | null = null;
  remoteDescription: RtcDescriptionLike | null = null;
  closed = false;
  readonly channels: FakeChannel[] = [];
  readonly listeners: FakeListenerEntry[] = [];
  getStats?: () => Promise<RtcStatsLike>;
  readonly script: PcScript;

  constructor(script: PcScript) {
    this.script = script;
    if (script.stats) {
      const reports = script.stats;
      this.getStats = (): Promise<RtcStatsLike> =>
        Promise.resolve({
          forEach(visit: (report: unknown) => void): void {
            for (const report of reports) visit(report);
          },
        });
    }
  }

  createDataChannel(label: string, init?: RTCDataChannelInit): RtcDataChannelLike {
    const channel = new FakeChannel(label, init);
    this.channels.push(channel);
    return channel;
  }

  createOffer(): Promise<RtcDescriptionLike> {
    return Promise.resolve({ type: 'offer', sdp: this.script.offerSdp });
  }

  createAnswer(): Promise<RtcDescriptionLike> {
    return Promise.resolve({ type: 'answer', sdp: this.script.answerSdp });
  }

  setLocalDescription(description?: RtcDescriptionLike): Promise<void> {
    this.localDescription = description ?? null;
    this.iceGatheringState = 'gathering';
    if (this.script.gather !== 'manual') {
      this.emitCandidates(this.script.candidates);
      if (this.script.gather === 'state') this.completeGathering();
      else this.endOfCandidates();
    }
    for (const state of this.script.iceOnLocalDescription ?? []) this.setIce(state);
    return Promise.resolve();
  }

  setRemoteDescription(description: RtcDescriptionLike): Promise<void> {
    if (this.script.rejectRemote) return Promise.reject(new Error('scripted setRemoteDescription failure'));
    this.remoteDescription = description;
    return Promise.resolve();
  }

  addEventListener(type: string, fn: RtcListener): void {
    this.listeners.push({ type, fn });
  }

  removeEventListener(type: string, fn: RtcListener): void {
    const index = this.listeners.findIndex((entry) => entry.type === type && entry.fn === fn);
    if (index >= 0) this.listeners.splice(index, 1);
  }

  close(): void {
    this.closed = true;
  }

  fire(type: string, extra: Record<string, unknown> = {}): void {
    for (const entry of [...this.listeners]) {
      if (entry.type === type) entry.fn({ type, ...extra });
    }
  }

  // ── scripting surface ────────────────────────────────────────────────────────

  emitCandidates(count: number): void {
    for (let i = 0; i < count; i++) this.fire('icecandidate', { candidate: { candidate: `cand-${i}` } });
  }

  completeGathering(): void {
    this.iceGatheringState = 'complete';
    this.fire('icegatheringstatechange');
  }

  endOfCandidates(): void {
    this.iceGatheringState = 'complete';
    this.fire('icecandidate', { candidate: null });
  }

  setIce(state: string): void {
    this.iceConnectionState = state;
    this.fire('iceconnectionstatechange');
  }

  setConnection(state: string): void {
    this.connectionState = state;
    this.fire('connectionstatechange');
  }

  /** The acceptor's three channels arrive this way (section 6.2). */
  deliverChannels(labels: readonly string[] = LANES): FakeChannel[] {
    const made: FakeChannel[] = [];
    for (const label of labels) {
      const channel = new FakeChannel(label);
      this.channels.push(channel);
      made.push(channel);
      this.fire('datachannel', { channel });
    }
    return made;
  }

  channel(label: string): FakeChannel {
    const found = this.channels.find((entry) => entry.label === label);
    if (!found) throw new Error(`no ${label} channel`);
    return found;
  }

  openAll(): void {
    for (const channel of this.channels) channel.open();
  }
}

interface Harness {
  readonly ctor: RtcPeerConnectionCtor;
  readonly created: FakePc[];
  /** The most recently constructed connection. */
  pc(): FakePc;
}

/**
 * Each `new` mints a connection with its OWN ICE credentials, mirroring the browser:
 * a re-invite is a new offer, not a re-send of the old one, and a suite that reused one
 * scripted SDP would pass while the transport handed out a stale blob.
 */
function harness(salt = 0, overrides: Partial<PcScript> = {}): Harness {
  const created: FakePc[] = [];
  const ctor: RtcPeerConnectionCtor = class extends FakePc {
    constructor() {
      super({ ...defaultScript(salt * 100 + created.length), ...overrides });
      created.push(this);
    }
  };
  return {
    ctor,
    created,
    pc() {
      const last = created[created.length - 1];
      if (!last) throw new Error('no peer connection was constructed');
      return last;
    },
  };
}

/** Wire two fake channels together so what one sends the other receives. */
function pipe(a: FakeChannel, b: FakeChannel): void {
  a.onSend = (data) => {
    b.deliver(data);
  };
  b.onSend = (data) => {
    a.deliver(data);
  };
}

interface Rig {
  readonly transport: RtcTransport;
  readonly clock: TestClock;
  readonly rtc: Harness;
  readonly messages: RtcInboundMessage[];
  readonly ceremonyEvents: RtcCeremonyEvent[];
  readonly opened: RtcLane[];
}

function rig(
  role: 'inviter' | 'acceptor',
  salt = 0,
  overrides: Partial<PcScript> = {},
  extra: { readonly clientId?: string; readonly name?: string } = {},
): Rig {
  const clock = new TestClock();
  const rtc = harness(salt, overrides);
  const messages: RtcInboundMessage[] = [];
  const ceremonyEvents: RtcCeremonyEvent[] = [];
  const opened: RtcLane[] = [];
  const transport = createRtcTransport({
    role,
    clientId: extra.clientId ?? (role === 'inviter' ? '01HOST' : '01GUEST'),
    rtc: rtc.ctor,
    timers: clock,
    self: { name: extra.name ?? (role === 'inviter' ? 'Priya' : 'Sam'), colorIndex: role === 'inviter' ? 0 : 3 },
    tool: { id: 'qr-code', version: '1.2.0', engineVersion: '1.108.0' },
  });
  transport.on('message', (message) => messages.push(message));
  transport.on('channel-open', (lane) => opened.push(lane));
  transport.onCeremonyEvent((event) => ceremonyEvents.push(event));
  return { transport, clock, rtc, messages, ceremonyEvents, opened };
}

/** Mint an invite and open every lane - the starting point for the live-session tests. */
async function connect(r: Rig): Promise<void> {
  const offer = await r.transport.effects.createOffer({ attempt: 0 });
  assert.equal(offer.ok, true);
  const answer = await r.transport.effects.applyRemote({ signal: answerToken(2, 1) });
  assert.equal(answer.ok, true);
  r.rtc.pc().setConnection('connected');
  r.rtc.pc().openAll();
}

/** A peer's reply, built through the real codec so the transport decodes the real thing. */
function answerToken(candidates: number, salt: number): string {
  return unwrap(encodePayload({ kind: 'answer', material: material(candidates, salt) }, 'link'));
}

/** A presence payload the contract would accept (`userId`/`name`/`color` are required). */
function presenceState(userId: string, focus?: string): PresenceState {
  return { userId, name: userId === '01HOST' ? 'Priya' : 'Sam', color: '#c05621', focus };
}

/** Mint one real invite token, for the acceptor-side tests. */
async function mintInvite(): Promise<CollabInvite> {
  const rtc = harness(7);
  const transport = createRtcTransport({
    role: 'inviter',
    clientId: '01HOST',
    rtc: rtc.ctor,
    timers: new TestClock(),
    self: { name: 'Priya', colorIndex: 0 },
    tool: { id: 'qr-code', version: '1.2.0', engineVersion: '1.108.0' },
  });
  const result = await transport.effects.createOffer({ attempt: 0 });
  transport.close();
  if (!result.ok) throw new Error(result.detail ?? 'could not mint an invite');
  return result.invite;
}

// ── Channels (section 6.2, section 11.6) ────────────────────────────────────────────────────────

test('the inviter opens three channels with the options plan 100 section 6.2 specifies', async () => {
  const r = rig('inviter');
  const offer = await r.transport.effects.createOffer({ attempt: 0 });
  assert.equal(offer.ok, true);

  const labels = r.rtc.pc().channels.map((c) => c.label);
  assert.deepEqual(labels, ['ops', 'presence', 'beam']);

  assert.deepEqual(r.rtc.pc().channel('ops').init, CHANNEL_INIT.ops);
  assert.deepEqual(r.rtc.pc().channel('ops').init, { ordered: true });
  // The lossy lane: an ordered presence channel would head-of-line-block cursors
  // behind a retransmit, which is exactly what section 11.5's sequence numbers replace.
  assert.deepEqual(r.rtc.pc().channel('presence').init, { ordered: false, maxRetransmits: 0 });
  // Beam on its OWN reliable channel: a 38 MB pack must never queue an edit (section 11.6).
  assert.deepEqual(r.rtc.pc().channel('beam').init, { ordered: true });

  assert.equal(r.rtc.pc().channel('beam').bufferedAmountLowThreshold, BEAM_LOW_THRESHOLD);
  assert.equal(r.rtc.pc().channel('beam').binaryType, 'arraybuffer');
});

test("the acceptor's channels arrive over ondatachannel and unknown labels are ignored", async () => {
  const r = rig('acceptor', 1);
  const invite: CollabInvite = await mintInvite();
  const answer = await r.transport.effects.createAnswer(invite);
  assert.equal(answer.ok, true);
  // No channels are created locally by the answerer.
  assert.equal(r.rtc.pc().channels.length, 0);

  r.rtc.pc().deliverChannels(['ops', 'presence', 'beam', 'telemetry']);
  r.rtc.pc().openAll();
  assert.deepEqual([...r.opened].sort(), ['beam', 'ops', 'presence']);
  // A lane from a newer peer is ignored, not fatal (section 11.19).
  assert.equal(r.transport.state().connection, 'live');
});

// ── Non-trickle gathering (section 6.1) ──────────────────────────────────────────────────

test('the invite is not minted until non-trickle gathering completes', async () => {
  const r = rig('inviter', 0, { gather: 'manual' });
  let settled = false;
  const pending = r.transport.effects.createOffer({ attempt: 0 }).then((result) => {
    settled = true;
    return result;
  });
  await settle();
  // The humans are the signalling channel: a blob minted before gathering finished
  // would be missing the very candidates the peer has to reach us on.
  assert.equal(settled, false);
  assert.equal(r.transport.state().gathering, 'gathering');

  r.rtc.pc().emitCandidates(2);
  r.rtc.pc().completeGathering();
  const result = await pending;
  assert.equal(result.ok, true);
  assert.equal(r.transport.state().gathering, 'complete');
  if (!result.ok) return;
  assert.equal(candidatesInToken(result.invite.signal), 2);
});

test('the end-of-candidates signal completes the wait on its own', async () => {
  const r = rig('inviter', 0, { gather: 'null-candidate' });
  const result = await r.transport.effects.createOffer({ attempt: 0 });
  assert.equal(result.ok, true);
  assert.equal(r.transport.state().gathering, 'complete');
});

test('gathering that never completes times out at the boundary and mints anyway', async () => {
  const r = rig('inviter', 0, { gather: 'manual' });
  let settled = false;
  const pending = r.transport.effects.createOffer({ attempt: 0 }).then((result) => {
    settled = true;
    return result;
  });
  await settle();
  r.rtc.pc().emitCandidates(2);
  await settle();

  r.clock.advance(GATHER_TIMEOUT_MS - 1);
  await settle();
  assert.equal(settled, false);

  r.clock.advance(1);
  const result = await pending;
  // Proceeding with what we have is the whole point: on an airgapped LAN the host
  // candidates are already in and the outstanding lookup is a STUN round trip that
  // is never coming back. Failing here would break the target persona (section 6.1).
  assert.equal(result.ok, true);
  assert.equal(r.transport.state().gathering, 'timed-out');
  if (!result.ok) return;
  assert.equal(candidatesInToken(result.invite.signal), 2);
  assert.equal(r.clock.pending, 0);
});

// ── ICE mapping (section 11.3) ───────────────────────────────────────────────────────────

test('disconnected is transient and only failed ends the session (section 11.3)', async () => {
  const r = rig('inviter');
  await connect(r);
  assert.equal(r.transport.state().connection, 'live');

  r.rtc.pc().setConnection('disconnected');
  // Grey the avatar, evict nobody, tear nothing down: this self-heals in seconds.
  assert.equal(r.transport.state().connection, 'reconnecting');
  assert.equal(r.transport.state().ice, 'disconnected');
  assert.ok(!r.ceremonyEvents.some((e) => e.type === 'ice' && e.state === 'failed'));

  r.rtc.pc().setConnection('connected');
  assert.equal(r.transport.state().connection, 'live');

  r.rtc.pc().setConnection('failed');
  assert.equal(r.transport.state().connection, 'closed');
  const iceStates = r.ceremonyEvents.filter((e) => e.type === 'ice').map((e) => (e.type === 'ice' ? e.state : ''));
  assert.deepEqual(iceStates, ['connected', 'disconnected', 'connected', 'failed']);
});

test('the same transition reported by both state sources reaches the ceremony once', async () => {
  const r = rig('inviter');
  await connect(r);
  const before = r.ceremonyEvents.length;
  r.rtc.pc().setConnection('disconnected');
  r.rtc.pc().setIce('disconnected');
  r.rtc.pc().setConnection('disconnected');
  assert.equal(r.ceremonyEvents.length - before, 1);
});

test('a browser that drives only iceConnectionState still drives the ceremony', async () => {
  const r = rig('inviter');
  const offer = await r.transport.effects.createOffer({ attempt: 0 });
  assert.equal(offer.ok, true);
  r.rtc.pc().setIce('checking');
  r.rtc.pc().setIce('connected');
  assert.deepEqual(
    r.ceremonyEvents.filter((e) => e.type === 'ice').map((e) => (e.type === 'ice' ? e.state : '')),
    ['checking', 'connected'],
  );
});

// ── The ceremony surface carries STATE: replay on subscribe, and the level read ──

/**
 * The other half of the LAN race `ceremony.test.ts` reproduces. ICE reaches `connected`
 * about five milliseconds after `setLocalDescription`, which on a real acceptor was
 * 542ms - while the ceremony was still inside `createAnswer` and its subscriber had, in
 * the general case, not necessarily even been wired yet. An edge-only surface hands that
 * subscriber nothing, for ever. So the last emitted state is replayed on subscribe, and
 * `effects.iceState()` answers the same question level-triggered.
 */

test('a subscriber that arrives after the pair is up is told, instead of waiting for ever', async () => {
  const r = rig('inviter');
  await connect(r);

  // Wired only now - after every transition it needs has already happened. Both facts
  // are replayed, in causal order: ICE first, then the lane that makes it a session.
  const late: RtcCeremonyEvent[] = [];
  r.transport.onCeremonyEvent((event) => late.push(event));
  assert.deepEqual(late, [{ type: 'ice', state: 'connected' }, { type: 'ready' }]);
});

test('the replay goes to the new subscriber alone and cannot double-fire a transition', async () => {
  const r = rig('inviter');
  await connect(r);
  const early = r.ceremonyEvents.length;

  const late: RtcCeremonyEvent[] = [];
  r.transport.onCeremonyEvent((event) => late.push(event));
  assert.equal(r.ceremonyEvents.length, early, 'the listener that already knew is not told twice');

  // And the live stream stays deduped on the value that was replayed, so the same state
  // arriving again from either source is not re-emitted to anyone.
  r.rtc.pc().setIce('connected');
  r.rtc.pc().setConnection('connected');
  assert.equal(late.length, 2, 'the ICE state and the readiness, once each');
  assert.equal(r.ceremonyEvents.length, early);
});

test('the peer op-version replays too - an undeclared one stays silence, not a gap', async () => {
  const r = rig('acceptor');
  const applied = await r.transport.effects.createAnswer(await mintInvite());
  assert.equal(applied.ok, true);
  const ops = r.rtc.pc().deliverChannels(['ops'])[0];
  assert.ok(ops);

  const beforeHello: RtcCeremonyEvent[] = [];
  r.transport.onCeremonyEvent((event) => beforeHello.push(event));
  assert.deepEqual(beforeHello, [], 'a peer that has not spoken is replayed as nothing');

  ops.open();
  ops.deliver(JSON.stringify({ t: 'hello', c: '01HOST', v: '9.0.0' }));

  const afterHello: RtcCeremonyEvent[] = [];
  r.transport.onCeremonyEvent((event) => afterHello.push(event));
  // Readiness before the declaration, because the hello can only ride an open lane.
  assert.deepEqual(afterHello, [{ type: 'ready' }, { type: 'peer-op-version', opVersion: '9.0.0' }]);
});

test('a re-invite replays nothing from the pairing it replaced', async () => {
  const r = rig('inviter');
  await connect(r);
  const ops = r.rtc.pc().channel('ops');
  ops.deliver(JSON.stringify({ t: 'hello', c: '01GUEST', v: '9.0.0' }));

  // A dropped connection can never be resumed, so the re-invite is a NEW pairing - and
  // replaying the dead one's `connected` would tell a fresh ceremony it had arrived.
  const second = await r.transport.effects.createOffer({ attempt: 1 });
  assert.equal(second.ok, true);
  const fresh: RtcCeremonyEvent[] = [];
  r.transport.onCeremonyEvent((event) => fresh.push(event));
  assert.deepEqual(fresh, []);
});

test('a closed transport replays nothing and keeps no listener', async () => {
  const r = rig('inviter');
  await connect(r);
  r.transport.close();

  const after: RtcCeremonyEvent[] = [];
  const off = r.transport.onCeremonyEvent((event) => after.push(event));
  assert.deepEqual(after, []);
  off();
});

test('the ops lane opening is what sources `ready` - once, and after the hello', async () => {
  const r = rig('inviter');
  const offer = await r.transport.effects.createOffer({ attempt: 0 });
  assert.equal(offer.ok, true);

  // ICE alone sources no readiness: data channels open only once BOTH descriptions are
  // applied, which on loopback is well after ICE says `connected`.
  r.rtc.pc().setIce('checking');
  r.rtc.pc().setIce('connected');
  assert.ok(!r.ceremonyEvents.some((e) => e.type === 'ready'), 'ICE is not a session');

  // The presence and beam lanes are not the session-critical one.
  r.rtc.pc().channel('presence').open();
  r.rtc.pc().channel('beam').open();
  assert.ok(!r.ceremonyEvents.some((e) => e.type === 'ready'));

  r.rtc.pc().channel('ops').open();
  assert.equal(r.ceremonyEvents.filter((e) => e.type === 'ready').length, 1);
  // The hello must already be on the wire: a peer whose blob was too small for an op
  // version learns it from the first frame, which cannot come after the completion.
  assert.deepEqual(
    r.rtc.pc().channel('ops').frames().map((f) => f.t),
    ['hello'],
  );

  // A lane cannot re-open, and nothing else may mint a second completion either.
  r.rtc.pc().setIce('completed');
  assert.equal(r.ceremonyEvents.filter((e) => e.type === 'ready').length, 1);
});

test('channelsReady() is the level read the ceremony asks alongside iceState()', async () => {
  const r = rig('inviter');
  assert.equal(r.transport.effects.channelsReady(), false);
  const offer = await r.transport.effects.createOffer({ attempt: 0 });
  assert.equal(offer.ok, true);

  r.rtc.pc().setConnection('connected');
  assert.equal(r.transport.effects.channelsReady(), false, 'ICE connected is not ready');

  r.rtc.pc().channel('ops').open();
  assert.equal(r.transport.effects.channelsReady(), true);

  // It reads the LANE, not the latch: a transport that is gone is never ready, whatever
  // it announced earlier.
  r.transport.close();
  assert.equal(r.transport.effects.channelsReady(), false);
});

test('a re-invite replays no readiness from the pairing it replaced', async () => {
  const r = rig('inviter');
  await connect(r);
  const first: RtcCeremonyEvent[] = [];
  r.transport.onCeremonyEvent((event) => first.push(event));
  assert.deepEqual(first, [{ type: 'ice', state: 'connected' }, { type: 'ready' }]);

  const second = await r.transport.effects.createOffer({ attempt: 1 });
  assert.equal(second.ok, true);
  // The dead pairing's channels are closed and its completion is spent. Replaying it
  // would tell a fresh ceremony it had already connected, over a lane that does not exist.
  assert.equal(r.transport.effects.channelsReady(), false);
  const fresh: RtcCeremonyEvent[] = [];
  r.transport.onCeremonyEvent((event) => fresh.push(event));
  assert.deepEqual(fresh, []);
});

test('a pairing whose lane opened and then died replays its failure BEFORE its readiness', async () => {
  // Causal order is also fail-safe order: a ceremony wired up after the fact must end,
  // not complete. Both facts are true of this transport; only one of them is still news.
  const r = rig('inviter');
  await connect(r);
  r.rtc.pc().setConnection('failed');

  const late: RtcCeremonyEvent[] = [];
  r.transport.onCeremonyEvent((event) => late.push(event));
  assert.deepEqual(late, [{ type: 'ice', state: 'failed' }, { type: 'ready' }]);
});

test('iceState() is the level read the ceremony asks on entering an ICE-gated phase', async () => {
  const r = rig('inviter');
  assert.equal(r.transport.effects.iceState(), 'new');
  const offer = await r.transport.effects.createOffer({ attempt: 0 });
  assert.equal(offer.ok, true);

  r.rtc.pc().setIce('checking');
  assert.equal(r.transport.effects.iceState(), 'checking');
  r.rtc.pc().setIce('connected');
  assert.equal(r.transport.effects.iceState(), 'connected');

  // A transport that is gone reports the end it is, never a pair still forming.
  r.transport.close();
  assert.equal(r.transport.effects.iceState(), 'closed');
});

test('a throwing subscriber cannot break the replay, or the transport', async () => {
  const r = rig('inviter');
  await connect(r);
  r.transport.onCeremonyEvent(() => {
    throw new Error('a broken observer');
  });
  const after: RtcCeremonyEvent[] = [];
  r.transport.onCeremonyEvent((event) => after.push(event));
  assert.deepEqual(after, [{ type: 'ice', state: 'connected' }, { type: 'ready' }]);
});

// ── The isolation heuristic (section 11.1, section 11.2, section 11.26) ───────────────────────────────

test('candidates on both sides and no pair ever formed reads as isolation', async () => {
  const r = rig('inviter');
  const offer = await r.transport.effects.createOffer({ attempt: 0 });
  assert.equal(offer.ok, true);
  const applied = await r.transport.effects.applyRemote({ signal: answerToken(2, 1) });
  assert.equal(applied.ok, true);

  r.rtc.pc().setConnection('connecting');
  r.rtc.pc().setConnection('failed');
  const state = r.transport.state();
  assert.equal(state.localCandidates, 2);
  assert.equal(state.remoteCandidates, 2);
  assert.equal(state.candidatePairSeen, false);
  // This is the difference between "your invite didn't work" and "this network blocks
  // device-to-device traffic - try a hotspot" (section 11.2, section 11.26).
  assert.equal(state.diagnosis, 'isolation-suspected');
  assert.equal(state.isolationSuspected, true);
});

test('a pair seen in getStats is a handshake failure, not isolation', async () => {
  const r = rig('inviter', 0, { stats: [{ type: 'candidate-pair', state: 'in-progress' }, { type: 'transport' }] });
  const offer = await r.transport.effects.createOffer({ attempt: 0 });
  assert.equal(offer.ok, true);
  await r.transport.effects.applyRemote({ signal: answerToken(2, 1) });

  r.rtc.pc().setConnection('failed');
  await settle();
  const state = r.transport.state();
  assert.equal(state.candidatePairSeen, true);
  // They saw each other and DTLS still failed - a different story that must not borrow
  // the network copy.
  assert.equal(state.diagnosis, 'handshake-failed');
  assert.equal(state.isolationSuspected, false);
});

test('gathering nothing at all is its own diagnosis, not isolation', async () => {
  const r = rig('inviter', 0, { candidates: 0, offerSdp: sdpFor('offer', 0, 0) });
  const offer = await r.transport.effects.createOffer({ attempt: 0 });
  assert.equal(offer.ok, true);
  r.rtc.pc().setConnection('failed');
  assert.equal(r.transport.state().localCandidates, 0);
  assert.equal(r.transport.state().diagnosis, 'no-local-candidates');
});

test("a peer's empty blob is diagnosed on their side, not this network", async () => {
  const r = rig('inviter');
  await r.transport.effects.createOffer({ attempt: 0 });
  const applied = await r.transport.effects.applyRemote({ signal: answerToken(0, 1) });
  assert.equal(applied.ok, true);
  r.rtc.pc().setConnection('failed');
  assert.equal(r.transport.state().diagnosis, 'no-remote-candidates');
});

test('a pair that was live and then died reads as connection-lost', async () => {
  const r = rig('inviter');
  await connect(r);
  r.rtc.pc().setConnection('failed');
  const state = r.transport.state();
  assert.equal(state.everConnected, true);
  assert.equal(state.diagnosis, 'connection-lost');
  assert.equal(state.isolationSuspected, false);
});

// ── Presence (section 11.5) ──────────────────────────────────────────────────────────────

test('outbound presence frames get this client id and a strictly increasing seq', async () => {
  const r = rig('inviter');
  await connect(r);
  assert.equal(r.transport.sendPresence({ state: presenceState('01HOST', 'headline') }), 'sent');
  assert.equal(r.transport.sendPresence({ state: presenceState('01HOST', 'body') }), 'sent');

  const frames = r.rtc.pc().channel('presence').frames();
  assert.equal(frames.length, 2);
  assert.equal(frames[0]?.from, '01HOST');
  assert.equal(frames[0]?.seq, 1);
  assert.equal(frames[1]?.seq, 2);
});

test('a frame that already carries from/seq is relayed verbatim (the join snapshot)', async () => {
  const r = rig('inviter');
  await connect(r);
  // `PresenceEngine.snapshot()` hands back OTHER peers' frames with their own origin and
  // sequence numbers; re-stamping them would make the join handshake lie about who said
  // what, and the receiver's newest-only rule would then drop live frames as stale.
  assert.equal(r.transport.sendPresence({ from: '01OTHER', seq: 41, state: null }), 'sent');
  const frames = r.rtc.pc().channel('presence').frames();
  assert.equal(frames[0]?.from, '01OTHER');
  assert.equal(frames[0]?.seq, 41);
  // The relay must not have consumed this client's own counter either.
  r.transport.sendPresence({ state: null });
  assert.equal(r.rtc.pc().channel('presence').frames()[1]?.seq, 1);
});

test('inbound presence frames arrive unreordered, with their sequence intact', async () => {
  const r = rig('inviter');
  await connect(r);
  const channel = r.rtc.pc().channel('presence');
  // `maxRetransmits: 0` means late and out-of-order frames are the normal case. The
  // transport passes them through untouched - newest-only is the roster's rule (section 11.5),
  // and a transport that buffered to "fix" the order would add exactly the latency the
  // lossy lane exists to avoid.
  channel.deliver(JSON.stringify({ from: '01GUEST', seq: 9, state: presenceState('01GUEST') }));
  channel.deliver(JSON.stringify({ from: '01GUEST', seq: 7, state: presenceState('01GUEST') }));
  channel.deliver(JSON.stringify({ from: '01GUEST', seq: 12, state: null, away: true }));

  const frames = r.messages
    .filter((m): m is Extract<RtcInboundMessage, { kind: 'presence' }> => m.kind === 'presence')
    .map((m) => m.frame);
  assert.deepEqual(frames.map((f) => f.seq), [9, 7, 12]);
  assert.equal(frames[2]?.state, null);
  assert.equal(frames[2]?.away, true);
});

test('malformed presence frames are dropped, never thrown (section 11.21)', () => {
  assert.equal(parsePresenceFrame({ from: 'a', seq: 1, state: null })?.seq, 1);
  assert.equal(parsePresenceFrame(null), null);
  assert.equal(parsePresenceFrame({ seq: 1, state: null }), null);
  assert.equal(parsePresenceFrame({ from: '', seq: 1, state: null }), null);
  assert.equal(parsePresenceFrame({ from: 'a', seq: 'one', state: null }), null);
  assert.equal(parsePresenceFrame({ from: 'a', seq: Number.NaN, state: null }), null);
  assert.equal(parsePresenceFrame({ from: 'a', seq: 1, state: [] }), null);
  assert.equal(parsePresenceFrame({ from: 'a', seq: 1, state: null, away: 'yes' }), null);
  assert.equal(parsePresenceFrame({ from: 'a'.repeat(200), seq: 1, state: null }), null);
  // Nothing a peer added rides along into the roster.
  const extra = parsePresenceFrame({ from: 'a', seq: 1, state: null, evil: 1 }) as unknown as Record<string, unknown>;
  assert.deepEqual(Object.keys(extra).sort(), ['away', 'from', 'seq', 'state']);
});

// ── Ops lane + the in-band hello (section 11.19) ────────────────────────────────────────

test('the ops lane opens with a hello carrying this op-contract version', async () => {
  const r = rig('inviter');
  await connect(r);
  const first = r.rtc.pc().channel('ops').frames()[0];
  assert.equal(first?.t, 'hello');
  assert.equal(first?.c, '01HOST');
  assert.equal(first?.v, CANVAS_OP_VERSION);
  assert.equal(first?.h, HISTORY_PROTOCOL_VERSION, 'the hello also announces the shared-history capability');
});

test('an inbound hello carries the peer shared-history capability through to the message', async () => {
  const r = rig('inviter');
  await connect(r);
  r.rtc.pc().channel('ops').deliver(JSON.stringify({ t: 'hello', c: '01GUEST', v: CANVAS_OP_VERSION, h: HISTORY_PROTOCOL_VERSION }));
  const hello = r.messages.find((m) => m.kind === 'hello');
  assert.equal(hello?.kind === 'hello' ? hello.history : undefined, HISTORY_PROTOCOL_VERSION);
  // An older peer's hello (no `h`) parses to an absent capability, not a crash.
  r.rtc.pc().channel('ops').deliver(JSON.stringify({ t: 'hello', c: '01GUEST', v: CANVAS_OP_VERSION }));
  const older = r.messages.filter((m) => m.kind === 'hello').at(-1);
  assert.equal(older?.kind === 'hello' ? older.history : 'set', undefined);
});

test('an inbound hello becomes the ceremony peer-op-version event', async () => {
  const r = rig('inviter');
  await connect(r);
  r.rtc.pc().channel('ops').deliver(JSON.stringify({ t: 'hello', c: '01GUEST', v: '9.0.0' }));
  assert.deepEqual(
    r.ceremonyEvents.filter((e) => e.type === 'peer-op-version'),
    [{ type: 'peer-op-version', opVersion: '9.0.0' }],
  );
});

test('unparsable and unknown ops frames are dropped, not fatal', async () => {
  const r = rig('inviter');
  await connect(r);
  const channel = r.rtc.pc().channel('ops');
  channel.deliver('{not json');
  channel.deliver(JSON.stringify(['an', 'array']));
  channel.deliver(JSON.stringify({ t: 'from-a-newer-peer', d: 1 }));
  assert.equal(r.messages.length, 0);
  channel.deliver(JSON.stringify({ t: 'op', d: { set: { headline: 'hi' } } }));
  assert.equal(r.messages.length, 1);
  assert.deepEqual(r.messages[0], { lane: 'ops', kind: 'op', op: { set: { headline: 'hi' } } });
});

test('a frame over the SCTP ceiling is refused, not sent (section 11.6)', async () => {
  const r = rig('inviter');
  await connect(r);
  const before = r.rtc.pc().channel('ops').sent.length;
  // Oversize writes are what actually kill an SCTP association; refusing is the only
  // outcome that leaves the session alive.
  assert.equal(r.transport.sendOp({ blob: 'x'.repeat(MAX_FRAME_BYTES + 1) }), 'too-large');
  assert.equal(r.rtc.pc().channel('ops').sent.length, before);
  assert.equal(r.transport.sendBeam({ bytes: new Uint8Array(MAX_FRAME_BYTES + 1) }), 'too-large');
});

test('sending before the lane opens is a typed result, not a throw', async () => {
  const r = rig('inviter');
  const offer = await r.transport.effects.createOffer({ attempt: 0 });
  assert.equal(offer.ok, true);
  assert.equal(r.transport.sendOp({ a: 1 }), 'not-open');
  assert.equal(r.transport.sendPresence({ state: null }), 'not-open');
  r.transport.close();
  assert.equal(r.transport.sendOp({ a: 1 }), 'closed');
});

// ── The beam lane (section 6.4, section 11.6) ──────────────────────────────────────────────────

test('beam writes go to the beam channel and the pull fires on bufferedamountlow', async () => {
  const r = rig('inviter');
  const pulls: number[] = [];
  const stop = r.transport.beam.onDrain(() => pulls.push(r.transport.beam.bufferedAmount()));
  await connect(r);
  // One pull on open so a sender can start without waiting for a drain it will never
  // get (nothing has been buffered yet).
  assert.equal(pulls.length, 1);

  r.transport.beam.json({ v: 1, t: 'offer', beamId: 'b1' });
  r.transport.beam.binary(new Uint8Array([1, 2, 3]));
  const beamChannel = r.rtc.pc().channel('beam');
  assert.equal(beamChannel.sent.length, 2);
  assert.equal(typeof beamChannel.sent[0], 'string');
  assert.ok(beamChannel.sent[1] instanceof Uint8Array);
  // The ops lane carries the hello and nothing else: a bulk transfer must never queue
  // an edit behind it (section 11.6).
  assert.equal(r.rtc.pc().channel('ops').sent.length, 1);

  beamChannel.fire('bufferedamountlow');
  assert.equal(pulls.length, 2);
  stop();
  beamChannel.fire('bufferedamountlow');
  assert.equal(pulls.length, 2);
});

test('an inbound beam frame keeps its lane and its binary form', async () => {
  const r = rig('inviter');
  await connect(r);
  const beamChannel = r.rtc.pc().channel('beam');
  beamChannel.deliver(JSON.stringify({ v: 1, t: 'accept', beamId: 'b1' }));
  beamChannel.deliver(new Uint8Array([9, 8, 7]).buffer);
  assert.equal(r.messages.length, 2);
  assert.deepEqual(r.messages[0], { lane: 'beam', kind: 'json', json: { v: 1, t: 'accept', beamId: 'b1' } });
  const second = r.messages[1];
  assert.equal(second?.kind, 'binary');
  if (second?.kind !== 'binary') return;
  assert.deepEqual([...second.bytes], [9, 8, 7]);
});

// ── The effects, as the ceremony sees them (section 6.1, section 11.25) ────────────────────────

test('an unreadable reply is retryable and a stack failure is not (section 11.25)', async () => {
  const r = rig('inviter');
  await r.transport.effects.createOffer({ attempt: 0 });

  const garbage = await r.transport.effects.applyRemote({ signal: 'not-a-token!!' });
  assert.equal(garbage.ok, false);
  // A bad paste is a step the humans repeat, not a ceremony that ends.
  if (!garbage.ok) assert.equal(garbage.retryable, true);

  const offerBack = await r.transport.effects.createOffer({ attempt: 1 });
  assert.equal(offerBack.ok, true);
  if (!offerBack.ok) return;
  const wrongLeg = await r.transport.effects.applyRemote({ signal: offerBack.invite.signal });
  assert.equal(wrongLeg.ok, false);
  if (!wrongLeg.ok) assert.equal(wrongLeg.retryable, true);

  const broken = rig('inviter', 0, { rejectRemote: true });
  await broken.transport.effects.createOffer({ attempt: 0 });
  const stack = await broken.transport.effects.applyRemote({ signal: answerToken(2, 1) });
  assert.equal(stack.ok, false);
  // A local stack failure is not something pasting again can fix.
  if (!stack.ok) assert.notEqual(stack.retryable, true);
});

test('a device with no WebRTC refuses honestly instead of crashing (section 11.29)', async () => {
  const transport = createRtcTransport({
    role: 'inviter',
    clientId: '01HOST',
    rtc: null,
    timers: new TestClock(),
    tool: { id: 'qr-code' },
  });
  const result = await transport.effects.createOffer({ attempt: 0 });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.detail ?? '', /WebRTC/);
  transport.close();
});

test('a missing tool declaration refuses rather than minting an unanswerable invite', async () => {
  const rtc = harness(0);
  const transport = createRtcTransport({ role: 'inviter', clientId: '01HOST', rtc: rtc.ctor, timers: new TestClock() });
  const result = await transport.effects.createOffer({ attempt: 0 });
  assert.equal(result.ok, false);
  transport.close();
});

test('a re-invite mints on a fresh connection and abandons the old one', async () => {
  const r = rig('inviter');
  await r.transport.effects.createOffer({ attempt: 0 });
  const first = r.rtc.pc();
  await r.transport.effects.createOffer({ attempt: 1 });
  const second = r.rtc.pc();
  assert.notEqual(first, second);
  // A dropped WebRTC connection can never be resumed and its ICE credentials are
  // spent - reusing the object would mint an offer the peer has already failed on.
  assert.equal(first.closed, true);
  assert.equal(first.listeners.length, 0);
});

test('an invite token carries everything the acceptor probes before answering (section 6.1)', async () => {
  const r = rig('inviter');
  const result = await r.transport.effects.createOffer({ attempt: 0 });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const decoded = inviteFromToken(result.invite.signal);
  assert.equal(decoded.ok, true);
  if (!decoded.ok) return;
  assert.equal(decoded.value.invite.toolId, 'qr-code');
  assert.equal(decoded.value.invite.toolVersion, '1.2.0');
  assert.equal(decoded.value.invite.engineVersion, '1.108.0');
  assert.equal(decoded.value.invite.name, 'Priya');
  assert.equal(decoded.value.invite.opVersion, CANVAS_OP_VERSION);
  // The palette SLOT, not a colour: the receiver resolves it against its own palette.
  assert.equal(decoded.value.colorIndex, 0);
  // An answer token is not an invite, and saying so beats a confusing pairing failure.
  assert.equal(answerFromToken(result.invite.signal).ok, false);
});

// ── The plate material (section 1: the connection plate) ─────────────────────────────────

test('the plate material is both fingerprints, or nothing at all', async () => {
  const r = rig('inviter');
  assert.equal(r.transport.effects.plateMaterial(), null, 'nothing has been minted or applied');

  const offer = await r.transport.effects.createOffer({ attempt: 0 });
  assert.equal(offer.ok, true);
  assert.equal(
    r.transport.effects.plateMaterial(),
    null,
    'half a pair derives nothing - a plate over one fingerprint would be a confident number about nothing',
  );

  const applied = await r.transport.effects.applyRemote({ signal: answerToken(2, 1) });
  assert.equal(applied.ok, true);
  const pair = r.transport.effects.plateMaterial();
  assert.ok(pair, 'both descriptions are applied; the plate material must be there');
  // Ours is what our own blob PUT ON THE WIRE, theirs is what their blob declared - 
  // the two the DTLS handshake validates certificates against, and nothing else.
  assert.deepEqual([...pair.local], [...material(2, 0).fingerprint.bytes]);
  assert.deepEqual([...pair.remote], [...material(2, 1).fingerprint.bytes]);
});

test('the acceptor has both fingerprints from the single call that answers', async () => {
  const r = rig('acceptor');
  assert.equal(r.transport.effects.plateMaterial(), null);
  const answer = await r.transport.effects.createAnswer(await mintInvite());
  assert.equal(answer.ok, true);
  const pair = r.transport.effects.plateMaterial();
  assert.ok(pair, 'createAnswer decodes the peer blob and mints our own - both, in one call');
  // The remote is the INVITE's fingerprint (harness salt 7 → script salt 700), and the
  // local is what this rig's own answer SDP carries.
  assert.deepEqual([...pair.remote], [...material(2, 700).fingerprint.bytes]);
  assert.deepEqual([...pair.local], [...material(2, 0).fingerprint.bytes]);
});

test('both devices derive the SAME plate from their own two-thirds of the pairing', async () => {
  // The property the whole mechanism rests on, driven over two real transports: the
  // inviter holds (mine, theirs) and the acceptor holds (theirs, mine), and the plate is
  // sorted rather than role-ordered, so the two agree. If this ever fails, every honest
  // pairing tells two people they are being attacked.
  const inviter = rig('inviter', 0);
  const acceptor = rig('acceptor', 1);

  const offer = await inviter.transport.effects.createOffer({ attempt: 0 });
  assert.equal(offer.ok, true);
  if (!offer.ok) return;
  const answer = await acceptor.transport.effects.createAnswer(offer.invite);
  assert.equal(answer.ok, true);
  if (!answer.ok) return;
  assert.equal((await inviter.transport.effects.applyRemote(answer.answer)).ok, true);

  const here = inviter.transport.effects.plateMaterial();
  const there = acceptor.transport.effects.plateMaterial();
  assert.ok(here && there);
  assert.deepEqual([...here.local], [...there.remote], 'each side holds the other side as remote');
  assert.deepEqual([...here.remote], [...there.local]);

  const [a, b] = await Promise.all([
    derivePlate(here.local, here.remote),
    derivePlate(there.local, there.remote),
  ]);
  assert.match(a, PLATE_RE);
  assert.equal(a, b, 'the two screens must show the same plate');

  // And a substituted blob does not: a middleman terminating DTLS presents ITS OWN
  // certificate, which is a fingerprint neither device ever saw.
  const impostor = await derivePlate(here.local, material(2, 99).fingerprint.bytes);
  assert.notEqual(impostor, a);
});

test('a re-invite clears the plate material with the peer connection it belonged to', async () => {
  const r = rig('inviter');
  await r.transport.effects.createOffer({ attempt: 0 });
  await r.transport.effects.applyRemote({ signal: answerToken(2, 1) });
  assert.ok(r.transport.effects.plateMaterial());

  const second = await r.transport.effects.createOffer({ attempt: 1 });
  assert.equal(second.ok, true);
  assert.equal(
    r.transport.effects.plateMaterial(),
    null,
    'the spent pairing’s peer is gone; its plate must not be shown for the new one',
  );

  await r.transport.effects.applyRemote({ signal: answerToken(2, 2) });
  const pair = r.transport.effects.plateMaterial();
  assert.ok(pair);
  assert.deepEqual([...pair.remote], [...material(2, 2).fingerprint.bytes], 'the new peer, not the old one');
});

test('a closed transport describes no pairing, and the read is not a mutable handle', async () => {
  const r = rig('inviter');
  await connect(r);
  const pair = r.transport.effects.plateMaterial();
  assert.ok(pair);
  pair.local[0] = (pair.local[0]! ^ 0xff) & 0xff;
  assert.deepEqual(
    [...r.transport.effects.plateMaterial()!.local],
    [...material(2, 0).fingerprint.bytes],
    'a caller cannot reach in and change the pairing’s trust root',
  );

  r.transport.close();
  assert.equal(r.transport.effects.plateMaterial(), null);
});

// ── Teardown ──────────────────────────────────────────────────────────────────────

test('close() leaves zero listeners and zero timers', async () => {
  const r = rig('inviter', 0, { gather: 'manual' });
  const pending = r.transport.effects.createOffer({ attempt: 0 });
  await settle();
  const pc = r.rtc.pc();
  assert.ok(pc.listeners.length > 0);
  assert.ok(r.clock.pending > 0, 'the gathering watchdog is armed');

  r.rtc.pc().emitCandidates(1);
  r.rtc.pc().completeGathering();
  await pending;
  r.rtc.pc().openAll();

  const channelListeners = pc.channels.reduce((sum, c) => sum + c.listeners.length, 0);
  assert.ok(channelListeners > 0);

  r.transport.close();
  assert.equal(pc.listeners.length, 0);
  assert.equal(
    pc.channels.reduce((sum, c) => sum + c.listeners.length, 0),
    0,
  );
  assert.equal(r.clock.pending, 0);
  assert.equal(pc.closed, true);
  assert.ok(pc.channels.every((c) => c.readyState === 'closed'));
  assert.equal(r.transport.state().connection, 'closed');

  // Idempotent, and nothing a closed transport does reaches a listener.
  const after = r.messages.length;
  r.transport.close();
  pc.channel('ops').fire('message', { data: JSON.stringify({ t: 'op', d: 1 }) });
  assert.equal(r.messages.length, after);
});

test('a subscriber that throws cannot break the transport', async () => {
  const r = rig('inviter');
  r.transport.on('state', () => {
    throw new Error('a broken observer');
  });
  await connect(r);
  assert.equal(r.transport.state().connection, 'live');
});

// ── End to end, driving the real ceremony ────────────────────────────────────────

test('the effects drive both halves of ceremony.ts end to end over the fake stack', async () => {
  const clock = new TestClock();
  const inviterRtc = harness(0);
  const acceptorRtc = harness(1);

  const inviterMessages: RtcInboundMessage[] = [];
  const acceptorMessages: RtcInboundMessage[] = [];

  const inviter = createRtcTransport({
    role: 'inviter',
    clientId: '01HOST',
    rtc: inviterRtc.ctor,
    timers: clock,
    self: { name: 'Priya', colorIndex: 0 },
    tool: { id: 'qr-code', version: '1.2.0', engineVersion: '1.108.0' },
    skin: 'qr',
  });
  const acceptor = createRtcTransport({
    role: 'acceptor',
    clientId: '01GUEST',
    rtc: acceptorRtc.ctor,
    timers: clock,
    self: { name: 'Sam', colorIndex: 3 },
    skin: 'qr',
  });
  inviter.on('message', (m) => inviterMessages.push(m));
  acceptor.on('message', (m) => acceptorMessages.push(m));

  const probe: ToolProbeResult = { status: 'have' };
  const hostCeremony: CeremonyMachine = createCeremony({
    role: 'inviter',
    timers: clock,
    effects: { ...inviter.effects, checkTool: () => Promise.resolve(probe) },
  });
  const guestCeremony: CeremonyMachine = createCeremony({
    role: 'acceptor',
    timers: clock,
    effects: { ...acceptor.effects, checkTool: () => Promise.resolve(probe) },
  });
  inviter.onCeremonyEvent((event) => hostCeremony.send(event));
  acceptor.onCeremonyEvent((event) => guestCeremony.send(event));

  // Leg 1 - the inviter mints and the human carries the blob.
  hostCeremony.send({ type: 'invite' });
  await settle();
  assert.equal(hostCeremony.state.phase, 'awaiting-answer');
  const inviteToken = hostCeremony.state.invite?.signal ?? '';
  assert.ok(inviteToken.length > 0);
  // The QR skin is a scan-and-paste-safe alphabet, and the blob stays inside the
  // section 6.1 budget with room to spare.
  assert.match(inviteToken, /^[A-Z2-7]+$/);
  assert.ok(inviteToken.length < 400, `invite token is ${inviteToken.length} chars`);

  const decoded = inviteFromToken(inviteToken, 'qr');
  assert.equal(decoded.ok, true);
  if (!decoded.ok) return;

  // Leg 2 - the acceptor probes its catalog BEFORE answering, then replies.
  guestCeremony.send({ type: 'accept', invite: decoded.value.invite });
  await settle();
  assert.equal(guestCeremony.state.phase, 'awaiting-connection');
  const answerBlob = guestCeremony.state.answer?.signal ?? '';
  const answer = answerFromToken(answerBlob, 'qr');
  assert.equal(answer.ok, true);
  if (!answer.ok) return;

  hostCeremony.send({ type: 'answer', answer: answer.value });
  await settle();
  assert.equal(hostCeremony.state.phase, 'connecting');

  // ICE comes up on both stacks - and neither ceremony calls that a session. A candidate
  // pair answering a binding request is not three open data channels (section 6.2).
  inviterRtc.pc().setConnection('connected');
  acceptorRtc.pc().setIce('connected');
  assert.equal(hostCeremony.state.phase, 'connecting');
  assert.equal(guestCeremony.state.phase, 'awaiting-connection');

  // The acceptor's three channels arrive over ondatachannel; wire the pair together.
  const guestChannels = acceptorRtc.pc().deliverChannels();
  for (const lane of LANES) {
    const guestChannel = guestChannels.find((c) => c.label === lane);
    assert.ok(guestChannel);
    pipe(inviterRtc.pc().channel(lane), guestChannel);
  }
  inviterRtc.pc().openAll();
  acceptorRtc.pc().openAll();

  // …and THAT is what completes both ceremonies, on both sides.
  assert.equal(hostCeremony.state.phase, 'connected');
  assert.equal(guestCeremony.state.phase, 'connected');
  assert.equal(inviter.state().connection, 'live');
  assert.equal(acceptor.state().connection, 'live');

  // Each side's hello lands on the other, so the op-contract version is settled in band
  // even though this pairing's blob was small enough to carry it too (section 11.19).
  const helloAtGuest = acceptorMessages.find((m) => m.kind === 'hello');
  assert.equal(helloAtGuest?.kind === 'hello' ? helloAtGuest.clientId : '', '01HOST');
  const helloAtHost = inviterMessages.find((m) => m.kind === 'hello');
  assert.equal(helloAtHost?.kind === 'hello' ? helloAtHost.opVersion : '', CANVAS_OP_VERSION);
  assert.equal(hostCeremony.state.observerOnly, false);
  assert.equal(guestCeremony.state.observerOnly, false);

  // An op and a presence frame make the whole round trip.
  assert.equal(inviter.sendOp({ set: { headline: 'Berlin' } }), 'sent');
  const opAtGuest = acceptorMessages.find((m) => m.kind === 'op');
  assert.deepEqual(opAtGuest?.kind === 'op' ? opAtGuest.op : null, { set: { headline: 'Berlin' } });

  assert.equal(acceptor.sendPresence({ state: presenceState('01GUEST', 'headline') }), 'sent');
  const presenceAtHost = inviterMessages.find(
    (m): m is Extract<RtcInboundMessage, { kind: 'presence' }> => m.kind === 'presence',
  );
  const frame: PresenceFrame | undefined = presenceAtHost?.frame;
  assert.equal(frame?.from, '01GUEST');
  assert.equal(frame?.seq, 1);

  // A drop on the inviter's stack: transient, then fatal, and only the second one
  // re-arms an invite (section 6.2a - the inviter owns the session).
  inviterRtc.pc().setConnection('disconnected');
  assert.equal(hostCeremony.state.reconnecting, true);
  assert.equal(hostCeremony.state.phase, 'connected');

  inviterRtc.pc().setConnection('failed');
  await settle();
  assert.equal(hostCeremony.state.phase, 'reconnect-armed');
  assert.notEqual(hostCeremony.state.invite?.signal, inviteToken);

  acceptorRtc.pc().setIce('failed');
  assert.equal(guestCeremony.state.phase, 'failed');
  assert.equal(guestCeremony.state.cause, 'connection-lost');

  inviter.close();
  acceptor.close();
  hostCeremony.dispose();
  guestCeremony.dispose();
  assert.equal(clock.pending, 0);
});

test('the LAN race, end to end: ICE completes inside the mint and the answer is STILL published', async () => {
  // Both drills, in one suite.
  //
  // The first: on a wire the entire ICE handshake happens inside `setLocalDescription`,
  // so every edge lands while the ceremony is in a phase with no ICE exit - the acceptor
  // in `creating-answer`, the inviter in `applying-answer`. Both sat there until a
  // watchdog, with open channels.
  //
  // The second, which the fix for the first created: reading ICE level-triggered on entry
  // promoted the ACCEPTOR the instant it reached `awaiting-connection`, because on
  // loopback ICE is `connected` before the answer has been carried back at all. Step 3
  // never rendered, the reply was never deliverable, and the inviter waited for ever.
  // So the acceptor must reach and hold the answer screen here, with ICE fully up, and
  // only the channels may end it.
  const clock = new TestClock();
  const lan = { iceOnLocalDescription: ['checking', 'connected'] as const };
  const inviterRtc = harness(0, lan);
  const acceptorRtc = harness(1, lan);

  const inviter = createRtcTransport({
    role: 'inviter',
    clientId: '01HOST',
    rtc: inviterRtc.ctor,
    timers: clock,
    self: { name: 'Priya', colorIndex: 0 },
    tool: { id: 'qr-code', version: '1.2.0', engineVersion: '1.108.0' },
    skin: 'qr',
  });
  const acceptor = createRtcTransport({
    role: 'acceptor',
    clientId: '01GUEST',
    rtc: acceptorRtc.ctor,
    timers: clock,
    self: { name: 'Sam', colorIndex: 3 },
    skin: 'qr',
  });

  const probe: ToolProbeResult = { status: 'have' };
  const hostCeremony: CeremonyMachine = createCeremony({
    role: 'inviter',
    timers: clock,
    effects: { ...inviter.effects, checkTool: () => Promise.resolve(probe) },
  });
  const guestCeremony: CeremonyMachine = createCeremony({
    role: 'acceptor',
    timers: clock,
    effects: { ...acceptor.effects, checkTool: () => Promise.resolve(probe) },
  });
  const hostPhases: string[] = [];
  const guestPhases: string[] = [];
  hostCeremony.subscribe((s) => hostPhases.push(s.phase));
  guestCeremony.subscribe((s) => guestPhases.push(s.phase));
  inviter.onCeremonyEvent((event) => hostCeremony.send(event));
  acceptor.onCeremonyEvent((event) => guestCeremony.send(event));

  hostCeremony.send({ type: 'invite' });
  await settle();
  const decoded = inviteFromToken(hostCeremony.state.invite?.signal ?? '', 'qr');
  assert.equal(decoded.ok, true);
  if (!decoded.ok) return;

  // The acceptor: ICE ran the whole way inside `createAnswer`, so `awaiting-connection`
  // is entered with the transport already reporting `connected`. THE REPLY MUST EXIST.
  guestCeremony.send({ type: 'accept', invite: decoded.value.invite });
  await settle();
  assert.equal(acceptor.effects.iceState(), 'connected', 'the race really did happen');
  assert.equal(guestCeremony.state.phase, 'awaiting-connection');
  assert.equal(guestCeremony.state.everConnected, false);
  assert.ok(!guestPhases.includes('connected'), 'nothing may flash past the answer screen');

  const answer = answerFromToken(guestCeremony.state.answer?.signal ?? '', 'qr');
  assert.equal(answer.ok, true);
  if (!answer.ok) return;

  // The inviter: same shape, ~2ms luckier in the wild, identically handled here.
  hostCeremony.send({ type: 'answer', answer: answer.value });
  await settle();
  assert.equal(hostCeremony.state.phase, 'connecting');

  // The channels open - the acceptor's over `ondatachannel`, as they do in the wild - 
  // and only now is either side connected.
  acceptorRtc.pc().deliverChannels();
  acceptorRtc.pc().openAll();
  inviterRtc.pc().openAll();
  assert.equal(guestCeremony.state.phase, 'connected');
  assert.equal(hostCeremony.state.phase, 'connected');

  // One transition each, not two: the entry read and the replay agree, they do not add.
  assert.equal(hostPhases.filter((p) => p === 'connected').length, 1);
  assert.equal(guestPhases.filter((p) => p === 'connected').length, 1);

  // Nothing is left waiting on a deadline that would have been the old failure.
  assert.equal(clock.pending, 0);

  inviter.close();
  acceptor.close();
  hostCeremony.dispose();
  guestCeremony.dispose();
});

test('the replay alone rescues a ceremony wired up after its transport connected', async () => {
  // The other half of the guard, isolated: these effects deliberately have NO level
  // read, so the only thing that can move this machine is the replay on subscribe. It is
  // the shape a dialog restart or the `#/join-reply` handoff produces - a machine whose
  // transport was already connected before it had a listener to hear about it.
  const clock = new TestClock();
  const rtc = harness(9);
  const transport = createRtcTransport({
    role: 'inviter',
    clientId: '01HOST',
    rtc: rtc.ctor,
    timers: clock,
    self: { name: 'Priya', colorIndex: 0 },
    tool: { id: 'qr-code', version: '1.2.0', engineVersion: '1.108.0' },
  });
  const blind: CeremonyEffects = {
    createOffer: (req) => transport.effects.createOffer(req),
    createAnswer: (invite) => transport.effects.createAnswer(invite),
    applyRemote: (answer) => transport.effects.applyRemote(answer),
    checkTool: () => Promise.resolve({ status: 'have' } as const),
  };
  const machine: CeremonyMachine = createCeremony({ role: 'inviter', timers: clock, effects: blind });

  machine.send({ type: 'invite' });
  await settle();
  machine.send({ type: 'answer', answer: { signal: answerToken(2, 1), name: 'Sam' } });
  await settle();
  assert.equal(machine.state.phase, 'connecting');

  // ICE comes up AND the lanes open with nobody listening - every edge is spent on an
  // empty room, which is what a handoff between two dialogs actually looks like.
  rtc.pc().setConnection('connected');
  rtc.pc().openAll();
  assert.equal(machine.state.phase, 'connecting');

  transport.onCeremonyEvent((event) => machine.send(event));
  assert.equal(machine.state.phase, 'connected');
  assert.equal(clock.pending, 0);

  transport.close();
  machine.dispose();
});

// ── The already-open inbound channel (measured in Chrome) ─────────────────────────

test('an inbound channel that arrives already open is announced once, not twice', async () => {
  // The real ordering, from the private-collab browser drill: the acceptor's channels
  // come out of `ondatachannel` with `readyState === 'open'` already - and Chrome then
  // dispatches `open` to the listener `bindChannel` bound moments earlier ANYWAY. Both
  // of the binder's paths run, so anything in the announcement that is not idempotent
  // happens twice. It showed on the wire as two identical ops hellos 2ms apart, and the
  // inviter's hello is the one that carries the seed.
  const r = rig('acceptor', 1);
  const invite: CollabInvite = await mintInvite();
  const answered = await r.transport.effects.createAnswer(invite);
  assert.equal(answered.ok, true);

  const pc = r.rtc.pc();
  const channel = new FakeChannel('ops');
  channel.readyState = 'open';
  pc.channels.push(channel);
  pc.fire('datachannel', { channel });
  // …and the event the binder's listener was waiting for, which arrives regardless.
  channel.fire('open');

  const hellos = channel.frames().filter((frame) => frame.t === 'hello');
  assert.equal(hellos.length, 1, 'the lane must carry exactly one hello');
  // The lane is open, announced, and the ceremony completed - the second call is
  // dropped whole, not half-applied.
  assert.equal(r.transport.state().connection, 'live');
  assert.deepEqual(r.opened, ['ops']);
  assert.equal(r.ceremonyEvents.filter((event) => event.type === 'ready').length, 1);
  assert.equal(r.transport.effects.channelsReady(), true);

  r.transport.close();
});
