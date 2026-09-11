// SPDX-License-Identifier: MPL-2.0
/**
 * The FULL Track A chain, in one process (plan 100 section 5, section 6.1, section 6.2, section 6.2a, section 11.21;
 * wave 2.x).
 *
 * Every link in this chain already has a test, and that is exactly why this file
 * exists. `ceremony.test.ts` drives the machine with hand-written effects;
 * `rtc-transport.test.ts` drives the wire with a scripted `RTCPeerConnection` and
 * stops at "the effects satisfy the ceremony"; `rtc-handle.test.ts` drives two
 * handles over an in-memory pair and never sees an SDP; `collab-session.test.ts`
 * drives one session against a fake handle; `lib/collab-loopback.test.ts` drives two
 * REAL runtimes over a hand-written wire that is not a transport at all. Not one of
 * them can fail if the SEAMS between them are wrong - an invite whose token the
 * acceptor cannot read, a hello that lands before anyone is listening for it, a
 * handle whose `opsIn` nobody joined to the session's `applyRemotePatch`, a guard
 * that refuses every real frame. This file is the composition, end to end:
 *
 *   ceremony(inviter) ─┐                                    ┌─ ceremony(acceptor)
 *                      ├ createRtcTransport ══ fake ICE ══ ─┤
 *   runtime(A) ─ session ─ handle ─┘        (scripted RTCPeerConnection pair)
 *
 * WHAT IS REAL HERE: both ceremonies, both transports (their effects, their three
 * lanes, their hello, their frame parsing), the real `sdp-codec` on both legs, both
 * `createRtcCollabHandle`s with their own `ReferenceCanvasDoc` and register index,
 * both `createCollabSession`s with the op-guard wiring live, the real
 * `attachCollabPlumbing`, the real presence engine, and TWO REAL ENGINE RUNTIMES
 * mounted on the same fixture tool.
 *
 * WHAT IS FAKE: `RTCPeerConnection` (scripted, as `rtc-transport.test.ts` scripts
 * it - the SDP it hands out is built by the REAL codec, so every round trip here is
 * a genuine one), the clock, the outbound coalescing microtask, and the frame
 * scheduler. Nothing sleeps; a lost packet is a counter, not a race.
 *
 * THE MOUNT WIRING, which is the seam this file is really about, is three lines and
 * they are written out in `chain()` rather than imported: `lib/collab-mount.ts` and
 * `collab/join-route.ts` are in flight elsewhere, and a proof that borrows the thing
 * it is proving is not a proof. If those files ever wire it differently, this file
 * says what "differently" would have to keep true.
 *
 * TWO LIMITATIONS, stated rather than discovered:
 *  1. `collab-plumbing.ts` holds ONE Lamport counter per MODULE, and a module is a
 *     device. Two logical devices in one process therefore share it, so the `param`
 *     and `order` ops this shell mints get globally increasing clocks even when the
 *     edits are causally concurrent. Convergence still means what it means; a
 *     same-clock tie broken by client id is simply not exercised on those two lanes
 *     (the blocks lanes DO have two clocks - each side's ops are minted by its own
 *     `ReferenceCanvasDoc`). Inherited verbatim from `lib/collab-loopback.test.ts`,
 *     which found it.
 *  2. The presence JOIN handshake (section 4.7's "full set to a new joiner, minus their own
 *     entry") is performed here by `join()`. It is the wiring layer's job in the
 *     shipped shell, and the presence engine is silent while alone by design - so
 *     without it neither peer would ever learn the other exists, which is a property
 *     of the design and not a gap in it.
 *
 * Run only this file (no css stub needed - nothing in this chain imports a stylesheet):
 *   node --test shells/web/src/collab/track-a-chain.test.ts
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CANVAS_OP_VERSION } from '@lolly-tools/core/canvas-op-v1';
import type { BoxId, BoxRow, CanvasDocState, CanvasOp, ParamValue } from '@lolly-tools/core/canvas-op-v1';

import type { HostV1 } from '../../../../engine/src/bridge/host-v1.ts';
import type { InputValue } from '../../../../engine/src/inputs.ts';
import type { LoadedTool } from '../../../../engine/src/loader.ts';
import { createRuntime } from '../../../../engine/src/runtime.ts';
import type { Runtime } from '../../../../engine/src/runtime.ts';

import type { CollabColor } from '../lib/collab-colors.ts';
import { _resetCollabDeviceForTests } from '../lib/collab-plumbing.ts';
import { PRESENCE_THROTTLE_MS } from '../lib/collab-presence.ts';
import { createCollabSession } from '../lib/collab-session.ts';
import type { CollabAbuseEvent, CollabSession } from '../lib/collab-session.ts';
import { ROW_ID_FIELD, ulid } from '../lib/row-id.ts';

import { createCeremony } from './ceremony.ts';
import type {
  CeremonyMachine,
  CeremonyTimerHandle,
  CeremonyTimers,
  ToolProbeRequest,
  ToolProbeResult,
} from './ceremony.ts';
import { createOpGuard } from './op-guard.ts';
import { BACKSTOP_INTERVAL_MS, createRtcCollabHandle } from './rtc-handle.ts';
import type { RtcCollabHandle, RtcTransportSatisfiesHandleTransport } from './rtc-handle.ts';
import { reconstruct } from './sdp-codec.ts';
import type { IceCandidate, SdpMaterial } from './sdp-codec.ts';
import {
  LANES,
  answerFromToken,
  createRtcTransport,
  inviteFromToken,
} from './rtc-transport.ts';
import type {
  RtcDataChannelLike,
  RtcDescriptionLike,
  RtcLane,
  RtcListener,
  RtcPeerConnectionCtor,
  RtcPeerConnectionLike,
  RtcStatsLike,
  RtcTransport,
} from './rtc-transport.ts';

// ── Time ───────────────────────────────────────────────────────────────────────────

/**
 * ONE clock for the whole chain - the ceremonies, both transports, both handles'
 * backstops and both presence engines. That is what makes "close everything, zero
 * pending timers" a single honest assertion instead of four hopeful ones.
 */
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

  pending(): number {
    return this.due.size;
  }

  advance(ms: number): void {
    const target = this.now + ms;
    for (;;) {
      let nextId = -1;
      let nextAt = Number.POSITIVE_INFINITY;
      for (const [id, entry] of this.due) {
        if (entry.at <= target && entry.at < nextAt) {
          nextAt = entry.at;
          nextId = id;
        }
      }
      if (nextId === -1) break;
      const entry = this.due.get(nextId);
      this.due.delete(nextId);
      if (!entry) break;
      this.now = entry.at;
      entry.fn();
    }
    this.now = target;
  }
}

/** One macrotask drains every microtask chain an `await` in the engine can produce. */
const tick = (): Promise<void> => new Promise<void>((resolve) => { setTimeout(resolve, 0); });

interface Queue {
  push(fn: () => void): void;
  pending(): number;
  /** Run everything queued; returns whether anything ran. */
  run(): boolean;
}

function queue(): Queue {
  let items: (() => void)[] = [];
  return {
    push(fn) { items.push(fn); },
    pending: () => items.length,
    run() {
      if (items.length === 0) return false;
      const due = items;
      items = [];
      for (const fn of due) fn();
      return true;
    },
  };
}

// ── SDP material, minted by the REAL codec ────────────────────────────────────────

function unwrap<T>(result: { ok: true; value: T } | { ok: false; reason: string }): T {
  if (!result.ok) throw new Error(result.reason);
  return result.value;
}

/** RFC 5245's `ice-char` set - exactly 64 characters (see the codec's header). */
const ICE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function iceString(length: number, salt: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += ICE_CHARS[(i * 13 + salt * 7 + 3) % 64];
  return out;
}

/** Distinct credentials AND a distinct DTLS fingerprint per side - the fingerprint
 *  is the pairing's trust root (section 6.1), so the two ends must not share one. */
function material(salt: number): SdpMaterial {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 7 + salt * 31) & 0xff;
  const candidates: IceCandidate[] = [];
  for (let i = 0; i < 2; i++) {
    candidates.push({ type: 'host', protocol: 'udp', address: `192.168.1.${5 + i + salt}`, port: 50000 + i });
  }
  return {
    fingerprint: { algo: 'sha-256', bytes },
    iceUfrag: iceString(8, salt),
    icePwd: iceString(24, salt),
    candidates,
    setupRole: 'actpass',
  };
}

// ── The scripted RTCPeerConnection ───────────────────────────────────────────────

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
  /** Installed by {@link link} - what this channel writes, the peer's channel reads. */
  onSend: ((data: string | ArrayBufferLike | ArrayBufferView) => void) | null = null;

  readonly label: string;

  constructor(label: string) {
    this.label = label;
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
    for (const entry of [...this.listeners]) if (entry.type === type) entry.fn({ type, ...extra });
  }

  open(): void {
    this.readyState = 'open';
    this.fire('open');
  }

  /** An inbound frame, exactly as the peer's `send` produced it. */
  deliver(data: unknown): void {
    this.fire('message', { data });
  }
}

class FakePc implements RtcPeerConnectionLike {
  iceGatheringState = 'new';
  iceConnectionState = 'new';
  connectionState = 'new';
  localDescription: RtcDescriptionLike | null = null;
  closed = false;
  readonly channels: FakeChannel[] = [];
  readonly listeners: FakeListenerEntry[] = [];
  getStats?: () => Promise<RtcStatsLike>;
  readonly salt: number;

  constructor(salt: number) {
    this.salt = salt;
  }

  createDataChannel(label: string): RtcDataChannelLike {
    const channel = new FakeChannel(label);
    this.channels.push(channel);
    return channel;
  }

  createOffer(): Promise<RtcDescriptionLike> {
    return Promise.resolve({ type: 'offer', sdp: unwrap(reconstruct(material(this.salt), 'offer')) });
  }

  createAnswer(): Promise<RtcDescriptionLike> {
    return Promise.resolve({ type: 'answer', sdp: unwrap(reconstruct(material(this.salt), 'answer')) });
  }

  setLocalDescription(description?: RtcDescriptionLike): Promise<void> {
    this.localDescription = description ?? null;
    this.iceGatheringState = 'gathering';
    // Host candidates land in milliseconds on a LAN; non-trickle gathering completes
    // on the state change, which is one of the two signals the transport accepts.
    for (let i = 0; i < 2; i++) this.fire('icecandidate', { candidate: { candidate: `cand-${i}` } });
    this.iceGatheringState = 'complete';
    this.fire('icegatheringstatechange');
    return Promise.resolve();
  }

  setRemoteDescription(): Promise<void> {
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
    for (const entry of [...this.listeners]) if (entry.type === type) entry.fn({ type, ...extra });
  }

  /** The acceptor's three channels arrive this way (section 6.2). */
  deliverChannels(): FakeChannel[] {
    const made: FakeChannel[] = [];
    for (const label of LANES) {
      const channel = new FakeChannel(label);
      this.channels.push(channel);
      made.push(channel);
      this.fire('datachannel', { channel });
    }
    return made;
  }

  channel(label: RtcLane): FakeChannel {
    const found = this.channels.find((entry) => entry.label === label);
    if (!found) throw new Error(`no ${label} channel`);
    return found;
  }

  setIce(state: string): void {
    this.iceConnectionState = state;
    this.fire('iceconnectionstatechange');
  }

  openAll(): void {
    for (const channel of this.channels) channel.open();
  }
}

interface Harness {
  readonly ctor: RtcPeerConnectionCtor;
  readonly created: FakePc[];
  pc(): FakePc;
}

function harness(salt: number): Harness {
  const created: FakePc[] = [];
  const ctor: RtcPeerConnectionCtor = class extends FakePc {
    constructor() {
      super(salt * 100 + created.length);
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

/** Every listener still attached to a side's stack - the honest teardown measure. */
function liveListeners(h: Harness): number {
  let total = 0;
  for (const pc of h.created) {
    total += pc.listeners.length;
    for (const channel of pc.channels) total += channel.listeners.length;
  }
  return total;
}

// ── One directional lane, with a switch for the packet that never arrived ─────────

/**
 * The ops lane is reliable and ordered - which is not the same as infallible, and
 * section 6.2's backstop exists precisely for the case where "nearly always" is not always.
 * So this link can swallow a frame the sender believes it sent (`drop`), or hold
 * frames back so two edits are genuinely concurrent (`hold`/`release`). Presence and
 * beam are plain pipes: presence is lossy by construction and a session never reads
 * beam.
 */
class Link {
  sent = 0;
  delivered = 0;
  dropped = 0;
  /** Swallow the next N frames AFTER the sender is told they went. */
  drop = 0;
  held = false;
  private readonly queued: unknown[] = [];
  private readonly to: FakeChannel;

  constructor(from: FakeChannel, to: FakeChannel) {
    this.to = to;
    from.onSend = (data) => { this.write(data); };
  }

  private write(data: unknown): void {
    this.sent += 1;
    if (this.drop > 0) { this.drop -= 1; this.dropped += 1; return; }
    if (this.held) { this.queued.push(data); return; }
    this.delivered += 1;
    this.to.deliver(data);
  }

  release(): void {
    this.held = false;
    for (const data of this.queued.splice(0)) {
      this.delivered += 1;
      this.to.deliver(data);
    }
  }
}

function pipe(a: FakeChannel, b: FakeChannel): void {
  a.onSend = (data) => { b.deliver(data); };
  b.onSend = (data) => { a.deliver(data); };
}

// ── The tool fixture ──────────────────────────────────────────────────────────────

/**
 * Three scalar lanes plus one generic `blocks` collection - the minimum that
 * exercises both op families (`param` and the box lanes) through the real input
 * model, the real constraints (`count` is clamped at 10) and the real guard
 * whitelist (`items` declares `label`/`note` and nothing else).
 *
 * `formats: ['png']` keeps the engine from synthesising the `convertPaths` input
 * that vector formats add, so the model IS what the manifest declares - which is
 * what the guard's whitelist is built from.
 */
let toolSeq = 0;

function chainTool(id: string): LoadedTool {
  return {
    trustClass: 'builtin-verified',
    manifest: {
      id, name: 'Track A chain', version: '1.4.0', engineVersion: '^1.0.0', status: 'official',
      render: { width: 40, height: 40, formats: ['png'] },
      inputs: [
        { id: 'title', type: 'text', default: 'hello' },
        { id: 'count', type: 'number', default: 1, min: 0, max: 10 },
        { id: 'flag', type: 'boolean', default: false },
        {
          id: 'items', type: 'blocks', default: [],
          fields: [{ id: 'label', type: 'text' }, { id: 'note', type: 'text' }],
        },
      ],
    },
    template:
      '<t>{{title}}</t><c>{{count}}</c><f>{{flag}}</f>' +
      '<l>{{#each items}}[{{label}}/{{note}}]{{/each}}</l>',
    styles: null,
    hooksSource: null,
    hooksUrl: null,
    textTemplates: {},
    textTemplateErrors: {},
  };
}

/** The minimal `HostV1` an asset-free, compose-free, hook-free tool needs. */
function engineHost(): HostV1 {
  return {
    version: '1',
    profile: { get: async () => ({}) },
    log: () => {},
  } as unknown as HostV1;
}

/** Three fixed swatches. The derivation has its own test; this file only needs a
 *  roster entry to get ONE of them, deterministically, on both devices. */
const COLORS: CollabColor[] = [
  { hex: '#aa0000', hue: 20, source: 'palette', lc: { light: 41, dark: 42 } },
  { hex: '#00aa00', hue: 140, source: 'palette', lc: { light: 41, dark: 42 } },
  { hex: '#0000aa', hue: 260, source: 'spun', lc: { light: 41, dark: 42 } },
];

const HOST_ID = '01HOSTDEVICEAAAAAAAAAAAAAA';
const GUEST_ID = '01GUESTDEVICEBBBBBBBBBBBBB';

// ── One end of the chain ─────────────────────────────────────────────────────────

interface Side {
  readonly id: string;
  readonly runtime: Runtime;
  readonly transport: RtcTransport;
  readonly handle: RtcCollabHandle;
  readonly session: CollabSession;
  readonly ceremony: CeremonyMachine;
  readonly rtc: Harness;
  /** Every op this side took off the wire, flat and in order. */
  readonly inbound: CanvasOp[];
  readonly frames: CanvasOp[][];
  /** Every structural refusal the SESSION raised (section 11.21). */
  readonly abuse: CollabAbuseEvent[];
  /** Every line the HANDLE logged - refusals included. */
  readonly logs: { message: string; detail?: unknown }[];
  readonly raf: Queue;
  /** Edit through the full wrapper stack, exactly as a sidebar control does. */
  set(id: string, value: InputValue): Promise<void>;
  values(): Record<string, InputValue>;
  hydrated(): string;
  rows(): Row[];
  /** Flip the tab hidden/visible (section 11.4's away flag). */
  hide(hidden: boolean): void;
  close(): void;
}

interface Chain {
  readonly clock: TestClock;
  readonly a: Side;
  readonly b: Side;
  /** Ops A→B and B→A, each with its own drop/hold switch. */
  readonly ab: Link;
  readonly ba: Link;
  /** Inject a raw ops-lane frame straight at B's transport, as a hostile peer would
   *  put it on the wire. Bypasses A entirely - A never minted it. */
  injectOpsAtB(payload: unknown): void;
  /** section 4.7's join handshake, which the wiring layer owns in the shipped shell. */
  join(): void;
  /** Run every queued hop on both sides until nothing is pending. */
  settle(): Promise<void>;
  probes(): readonly ToolProbeRequest[];
  close(): void;
}

type Row = { [key: string]: InputValue | undefined };

/** A blocks row, born with its stable id exactly as the sidebar mints one. */
const row = (label: string, note = ''): Row => ({ [ROW_ID_FIELD]: ulid(), label, note });

/**
 * Build, and drive, the whole chain: two ceremonies over two transports over a
 * scripted `RTCPeerConnection` pair, then two handles and two sessions over two real
 * engine runtimes.
 *
 * The ORDER below is the shipped order and order matters here in one place: the
 * handles are built when the CEREMONY reaches `connected` (ICE), which is strictly
 * before the data channels open - and the ops lane's first frame is the hello that
 * carries the peer's client id and op version (section 11.19). A handle built after the
 * lanes opened would miss it, and the acceptor would never learn who the host is.
 *
 * `guardB: false` builds B's handle with NO handle-level guard at all - the shape
 * `org/collab-provider.ts` is actually in (a transport with no tool model, so no
 * whitelist to build). section 4's dedicated test uses it to prove the SESSION's own guard
 * is required rather than merely redundant with the handle's, which is
 * otherwise unreachable here: both are built from the SAME `runtime.getModel()`, so
 * anything that would trip the session's whitelist trips the handle's identically,
 * first.
 */
async function chain(opts: { guardB?: boolean } = {}): Promise<Chain> {
  const clock = new TestClock();
  const toolId = `track-a-chain-${++toolSeq}`;
  const hostRtc = harness(1);
  const guestRtc = harness(2);
  const probes: ToolProbeRequest[] = [];
  const probe = (req: ToolProbeRequest): Promise<ToolProbeResult> => {
    probes.push(req);
    // section 6.1: the acceptor probes its LOCAL catalog before it answers. Both devices
    // run the same fixture, so the honest answer is "have".
    return Promise.resolve({ status: 'have' });
  };

  const hostTransport = createRtcTransport({
    role: 'inviter',
    clientId: HOST_ID,
    rtc: hostRtc.ctor,
    timers: clock,
    self: { name: 'Priya', colorIndex: 0 },
    tool: { id: toolId, version: '1.4.0', engineVersion: '1.108.0' },
    skin: 'qr',
  });
  const guestTransport = createRtcTransport({
    role: 'acceptor',
    clientId: GUEST_ID,
    rtc: guestRtc.ctor,
    timers: clock,
    // Deliberately anonymous: section 4.5's role fallback ("Host" / "Invitee") is only
    // reachable when somebody declines to type a name, and it is what the roster
    // assertions below are about.
    self: { colorIndex: 1 },
    skin: 'qr',
  });

  const hostCeremony = createCeremony({
    role: 'inviter',
    timers: clock,
    effects: { ...hostTransport.effects, checkTool: probe },
  });
  const guestCeremony = createCeremony({
    role: 'acceptor',
    timers: clock,
    effects: { ...guestTransport.effects, checkTool: probe },
  });
  hostTransport.onCeremonyEvent((event) => { hostCeremony.send(event); });
  guestTransport.onCeremonyEvent((event) => { guestCeremony.send(event); });

  // ── Leg 1: the inviter mints, and a human carries the blob ──────────────────
  hostCeremony.send({ type: 'invite' });
  await tick();
  assert.equal(hostCeremony.state.phase, 'awaiting-answer');
  const inviteToken = hostCeremony.state.invite?.signal ?? '';
  const decoded = inviteFromToken(inviteToken, 'qr');
  assert.equal(decoded.ok, true);
  if (!decoded.ok) throw new Error('the invite did not decode');

  // ── Leg 2: the acceptor probes, then replies ────────────────────────────────
  guestCeremony.send({ type: 'accept', invite: decoded.value.invite });
  await tick();
  assert.equal(guestCeremony.state.phase, 'awaiting-connection');
  const answer = answerFromToken(guestCeremony.state.answer?.signal ?? '', 'qr');
  assert.equal(answer.ok, true);
  if (!answer.ok) throw new Error('the answer did not decode');

  // ── Leg 3: the reply gets home, and ICE takes over ──────────────────────────
  hostCeremony.send({ type: 'answer', answer: answer.value });
  await tick();
  assert.equal(hostCeremony.state.phase, 'connecting');
  hostRtc.pc().setIce('connected');
  guestRtc.pc().setIce('connected');

  // ── The mount: two runtimes, two handles, two sessions ──────────────────────
  const outbound = queue();

  async function makeSide(
    self: string,
    role: 'inviter' | 'acceptor',
    transport: RtcTransport,
    ceremony: CeremonyMachine,
    rtc: Harness,
    name?: string,
    // Omit the handle-level guard (default: build one). section 4 below drives a chain
    // with this false on B - the shape `org/collab-provider.ts` is actually in
    // (no model, so no whitelist to build) - to prove the SESSION's own guard is
    // required rather than merely redundant with the handle's.
    withHandleGuard = true,
  ): Promise<Side> {
    const runtime = await createRuntime(chainTool(toolId), engineHost(), {});
    const raf = queue();
    const inbound: CanvasOp[] = [];
    const frames: CanvasOp[][] = [];
    const abuse: CollabAbuseEvent[] = [];
    const logs: { message: string; detail?: unknown }[] = [];

    // A fake Document, so section 11.4's away flag is drivable without jsdom.
    const visibility = new Set<() => void>();
    const fakeDoc = {
      hidden: false,
      addEventListener: (_type: string, fn: () => void): void => { visibility.add(fn); },
      removeEventListener: (_type: string, fn: () => void): void => { visibility.delete(fn); },
    };

    // ── THE MOUNT WIRING: three statements, and that is the whole of it ───────
    // A connected transport becomes a handle, the handle becomes a session, and the
    // handle's inbound op stream is joined to the session's one inbound door. There
    // is no fourth step - `presenceIn`, `sendPresence`, `events` and the adapter are
    // all read by `createCollabSession` off the handle it was given.
    const handle = createRtcCollabHandle({
      transport,
      role,
      self: { clientId: self, ...(name === undefined ? {} : { name }), colorIndex: role === 'inviter' ? 0 : 1 },
      // The boundary a caller with a mounted tool SHOULD supply: only the caller
      // knows the tool's declared inputs, so only the caller can build the
      // whitelist (section 11.21, and rtc-handle's header). Omitted by section 4's dedicated case
      // below, on purpose.
      ...(withHandleGuard ? { guard: createOpGuard({ inputs: runtime.getModel() }) } : {}),
      timers: clock,
      now: () => clock.now,
      schedule: (fn) => { outbound.push(fn); },
      log: (message, detail) => { logs.push({ message, detail }); },
    });
    const session = createCollabSession({
      handle,
      runtime,
      toolManifest: { id: toolId },
      sidebarRoot: null,
      colors: COLORS,
      doc: fakeDoc as unknown as Document,
      onAbuse: (event) => { abuse.push(event); },
      now: () => clock.now,
      setTimer: (fn, ms) => clock.setTimeout(fn, ms),
      clearTimer: (handleId) => { clock.clearTimeout(handleId); },
      raf: (fn) => { raf.push(fn); },
    });
    handle.opsIn.subscribe((ops) => {
      frames.push([...ops]);
      for (const op of ops) inbound.push(op);
      session.applyRemotePatch(ops);
    });
    // ─────────────────────────────────────────────────────────────────────────

    return {
      id: self, runtime, transport, handle, session, ceremony, rtc,
      inbound, frames, abuse, logs, raf,
      set: (id, value) => runtime.setInput(id, value),
      values: () => Object.fromEntries(runtime.getModel().map((i) => [i.id, i.value])),
      hydrated: () => runtime.getHydrated(),
      rows() {
        const value = runtime.getModel().find((i) => i.id === 'items')?.value;
        return Array.isArray(value) ? (value as Row[]) : [];
      },
      hide(hidden) {
        fakeDoc.hidden = hidden;
        for (const fn of [...visibility]) fn();
      },
      close: () => { session.close(); },
    };
  }

  const a = await makeSide(HOST_ID, 'inviter', hostTransport, hostCeremony, hostRtc, 'Priya');
  const b = await makeSide(
    GUEST_ID, 'acceptor', guestTransport, guestCeremony, guestRtc, undefined, opts.guardB ?? true,
  );

  // ── The lanes come up: the acceptor's channels arrive over ondatachannel ────
  const guestChannels = guestRtc.pc().deliverChannels();
  const ab = new Link(hostRtc.pc().channel('ops'), guestRtc.pc().channel('ops'));
  const ba = new Link(guestRtc.pc().channel('ops'), hostRtc.pc().channel('ops'));
  for (const lane of ['presence', 'beam'] as const) {
    pipe(hostRtc.pc().channel(lane), guestRtc.pc().channel(lane));
  }
  assert.equal(guestChannels.length, LANES.length);
  hostRtc.pc().openAll();
  guestRtc.pc().openAll();

  async function settle(): Promise<void> {
    for (let i = 0; i < 100; i++) {
      // The handles' outbound coalescing microtask, then the plumbing's frame.
      let ran = outbound.run();
      for (const side of [a, b]) if (side.raf.run()) ran = true;
      await tick();
      await tick();
      if (!ran && outbound.pending() === 0 && a.raf.pending() === 0 && b.raf.pending() === 0) return;
    }
    throw new Error('the Track A chain did not settle');
  }

  return {
    clock, a, b, ab, ba,
    injectOpsAtB(payload) {
      guestRtc.pc().channel('ops').deliver(JSON.stringify({ t: 'op', d: payload }));
    },
    join() {
      // section 4.7: the full presence set to a new joiner, MINUS their own entry (tldraw's
      // orphan bug). One frame each is enough - the receiving engine answers, because
      // a client that has been dutifully silent is otherwise invisible.
      for (const frame of a.session.presence.snapshot(b.id)) a.handle.sendPresence(frame);
      for (const frame of b.session.presence.snapshot(a.id)) b.handle.sendPresence(frame);
    },
    settle,
    probes: () => probes,
    close() {
      a.close();
      b.close();
      hostCeremony.dispose();
      guestCeremony.dispose();
    },
  };
}

// ── Comparison helpers ────────────────────────────────────────────────────────────

/** FNV-1a over the hydrated template - the render-hash proxy section 10 asks for. The
 *  hydrated string IS what the shell builds the DOM (and the export) from. */
function renderHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** The converged document, serialized so two docs compare as strings. Re-sorted here
 *  rather than trusting `state()`'s own canonicalisation, so a regression in THAT
 *  cannot hide behind this assertion. */
function serializeDoc(s: CanvasDocState): string {
  const byKey = (x: readonly [string, unknown], y: readonly [string, unknown]): number =>
    (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0);
  const rows = (m: Map<BoxId, BoxRow>): unknown[] =>
    [...m.entries()].sort(byKey).map(([id, r]) => [id, Object.keys(r).sort().map((k) => [k, r[k]])]);
  const params: [string, ParamValue][] = [...s.params.entries()].sort(byKey);
  const collections = s.collections
    ? [...s.collections.entries()].sort(byKey).map(([id, c]) => [id, c.order, rows(c.boxes)])
    : null;
  return JSON.stringify([['order', s.order], ['boxes', rows(s.boxes)], ['params', params], ['collections', collections]]);
}

function assertConverged(c: Chain, label: string): void {
  assert.deepEqual(c.a.values(), c.b.values(), `${label}: input models converge`);
  assert.equal(c.a.hydrated(), c.b.hydrated(), `${label}: identical render`);
  assert.equal(renderHash(c.a.hydrated()), renderHash(c.b.hydrated()), `${label}: identical render hash`);
  assert.equal(
    serializeDoc(c.a.handle.docState()), serializeDoc(c.b.handle.docState()),
    `${label}: identical serialized doc state`,
  );
}

/** Ops-lane frames written by one side, excluding the hello that opens the lane. */
const opFrames = (link: Link): number => link.sent - 1;

// ── 1. The complete ceremony ──────────────────────────────────────────────────────

test('the whole ceremony runs: invite → probe → answer → connected, on both halves', async () => {
  _resetCollabDeviceForTests('track-a');
  const c = await chain();

  // Both machines reached the one phase that means "there is a session here".
  assert.equal(c.a.ceremony.state.phase, 'connected');
  assert.equal(c.b.ceremony.state.phase, 'connected');
  assert.equal(c.a.ceremony.state.everConnected, true);
  assert.equal(c.b.ceremony.state.everConnected, true);
  assert.equal(c.a.ceremony.state.observerOnly, false, 'matching op contract, both writers');
  assert.equal(c.b.ceremony.state.observerOnly, false);

  // The probe GATED the answer leg - the acceptor cannot reach `awaiting-connection`
  // without it, and a `missing` verdict would have ended the ceremony instead
  // (section 6.1: "an honest refusal at accept time, never a broken join"). It ran exactly
  // once, on the acceptor only, against the ids the invite blob carried.
  const probes = c.probes();
  assert.equal(probes.length, 1, 'only the acceptor probes');
  assert.equal(probes[0]?.toolId, c.a.session.state().toolId, 'and it probed the tool being edited');
  assert.equal(probes[0]?.toolVersion, '1.4.0');
  assert.equal(probes[0]?.engineVersion, '1.108.0');
  assert.equal(c.b.ceremony.state.toolVersionNote, undefined, 'matching versions, so no skew note');

  // The blob the human carried was a QR-safe alphabet inside the section 6.1 budget.
  const inviteToken = c.a.ceremony.state.invite?.signal ?? '';
  assert.match(inviteToken, /^[A-Z2-7]+$/, 'the QR skin is a scan-safe alphabet');
  assert.ok(inviteToken.length < 400, `invite token is ${inviteToken.length} chars`);

  // Three lanes up on both stacks, and both transports report a live pair.
  assert.equal(c.a.transport.state().connection, 'live');
  assert.equal(c.b.transport.state().connection, 'live');
  for (const lane of LANES) {
    assert.equal(c.a.transport.state().lanes[lane], 'open', `host ${lane} lane`);
    assert.equal(c.b.transport.state().lanes[lane], 'open', `guest ${lane} lane`);
  }

  // The in-band hello settled identity and the op contract on both sides (section 11.19).
  assert.equal(c.a.handle.peerClientId(), GUEST_ID);
  assert.equal(c.b.handle.peerClientId(), HOST_ID);
  assert.equal(c.a.handle.peerOpVersion(), CANVAS_OP_VERSION);
  assert.equal(c.b.handle.peerOpVersion(), CANVAS_OP_VERSION);
  assert.equal(c.a.handle.role, 'writer', 'both peers in a pair are writers (section 6.2a)');
  assert.equal(c.b.handle.role, 'writer');

  // …and it reached the SESSIONS, which is the seam this file exists for.
  assert.equal(c.a.session.state().connection, 'live');
  assert.equal(c.b.session.state().connection, 'live');

  // MEASURED: one frame each on the ops lane so far, and it is the hello.
  assert.equal(c.ab.sent, 1, 'the host wrote exactly one ops frame: the hello');
  assert.equal(c.ba.sent, 1, 'and so did the guest');
  assert.equal(c.a.inbound.length, 0, 'no ops yet - a hello is not an op');
  assert.equal(c.b.inbound.length, 0);

  c.close();
});

test('a real transport satisfies the five-member subset a session asks of it', () => {
  // A bare conditional type alias proves nothing on its own - nothing reads it, so
  // nothing checks it. Assigning `true` to it is what makes `tsc` the assertion:
  // narrow `RtcHandleTransport` and this line stops compiling, which is exactly the
  // day the section 11.29 native-LAN transport would otherwise silently stop qualifying.
  const proof: RtcTransportSatisfiesHandleTransport = true;
  assert.equal(proof, true);
});

// ── 2. Convergence ────────────────────────────────────────────────────────────────

test('interleaved edits on both sides converge to one model, one render, one document', async () => {
  _resetCollabDeviceForTests('track-a');
  const c = await chain();
  c.join();

  // Ground truth: they start identical, so everything below is about the edits.
  assertConverged(c, 'baseline');

  // ── scalars, alternating sides ──────────────────────────────────────────────
  await c.a.set('title', 'from the host');
  await c.settle();
  await c.b.set('flag', true);
  await c.settle();
  await c.a.set('count', 4);
  await c.settle();
  assertConverged(c, 'scalars');
  assert.equal(c.b.values().title, 'from the host', "the host's scalar landed on the guest");
  assert.equal(c.a.values().flag, true, "and the guest's landed on the host");

  // ── blocks: one row from each side ──────────────────────────────────────────
  const r1 = row('host-one');
  await c.a.set('items', [r1]);
  await c.settle();
  const r2 = row('guest-one');
  await c.b.set('items', [...c.b.rows(), r2]);
  await c.settle();
  assertConverged(c, 'rows');
  assert.deepEqual(c.a.rows().map((r) => r.label), ['host-one', 'guest-one']);

  // ── THE CONCURRENT CASE section 10 asks for: an INSERT on A while B edits the
  //    neighbouring row. Held rather than sequenced, so neither side has seen the
  //    other's op when it makes its own - the only arrangement in which a lost
  //    insert or a stomped field is observable at all.
  const deliveredBefore = { ab: c.ab.delivered, ba: c.ba.delivered };
  c.ab.held = true;
  c.ba.held = true;
  const r3 = row('host-inserted');
  await c.a.set('items', [r1, r3, r2]);                                    // insert between
  await c.b.set('items', c.b.rows().map((r) => (
    r[ROW_ID_FIELD] === r2[ROW_ID_FIELD] ? { ...r, label: 'guest-edited', note: 'while offline' } : r
  )));                                                                     // edit the neighbour
  await c.settle();
  assert.equal(c.ab.delivered, deliveredBefore.ab, 'nothing crossed while held');
  assert.equal(c.ba.delivered, deliveredBefore.ba);

  // Released in the opposite order to the one they were made in, so this is a real
  // interleaving and not a disguised sequence.
  c.ba.release();
  c.ab.release();
  await c.settle();

  assertConverged(c, 'concurrent insert vs neighbouring edit');
  assert.deepEqual(
    c.a.rows().map((r) => r.label), ['host-one', 'host-inserted', 'guest-edited'],
    'the insert survived AND the neighbouring edit survived, in the inserted order',
  );
  assert.equal(c.b.rows()[2]?.note, 'while offline', "the guest's own field write was not stomped");

  // ── a remove, and a value the receiver's own constraints clamp ───────────────
  await c.b.set('items', c.b.rows().filter((r) => r[ROW_ID_FIELD] !== r1[ROW_ID_FIELD]));
  await c.settle();
  assertConverged(c, 'remove');
  assert.deepEqual(c.a.rows().map((r) => r.label), ['host-inserted', 'guest-edited']);

  await c.a.set('count', 99);      // the manifest caps it at 10
  await c.settle();
  assert.equal(c.a.values().count, 10, 'the sender clamped');
  assert.equal(c.b.values().count, 10, 'and the receiver clamped identically');
  assertConverged(c, 'clamped');

  // ── MEASURED ────────────────────────────────────────────────────────────────
  //
  // The strong claim is the FRAME count: ONE frame per gesture, in both directions,
  // and not one frame more. It is worth pinning because a blocks gesture mints an
  // `order` op PER ROW - a 200-row reorder written one `apply()` at a time would be
  // 200 frames, which section 11.21's ~200/s inbound ceiling turns from "chatty" into
  // "disconnected for flooding".
  //
  //   host  → guest: title, count, add r1, insert r3, count-again           = 5
  //   guest → host:  flag, add r2, the r2 field edit, remove r1             = 4
  //
  // And there is no echo in either direction: every frame belongs to a gesture
  // somebody actually made, so the totals are the gesture counts and nothing else.
  assert.equal(opFrames(c.ab), 5, 'the host made five gestures and wrote five ops frames');
  assert.equal(opFrames(c.ba), 4, 'the guest made four, and wrote four');
  assert.equal(c.b.frames.length, 5, 'and the guest took them off the wire as five batches');
  assert.equal(c.a.frames.length, 4, 'and the host as four');

  // The op totals INSIDE those frames are a measurement of the contract's own differ
  // (a blocks gesture restates the order keys its insert invalidated, and a two-field
  // row edit is two `field` ops), not a promise this file is making. If `damageToOps`
  // ever changes shape these move - which is worth being told about rather than
  // absorbed by an inequality.
  assert.equal(c.b.inbound.length, 8, "eight ops carried the host's five gestures");
  assert.equal(c.a.inbound.length, 6, "six carried the guest's four");

  c.close();
});

// ── 3. Presence ───────────────────────────────────────────────────────────────────

test('presence crosses the real lane: focus, cursor, the Host/Invitee roster, and away', async () => {
  _resetCollabDeviceForTests('track-a');
  const c = await chain();

  // Silent while alone (section 4.7) - nothing to say, nobody to hear.
  c.a.session.setFocus('title');
  c.clock.advance(PRESENCE_THROTTLE_MS * 4);
  assert.equal(c.a.session.state().peers.length, 0);
  assert.equal(c.b.session.state().peers.length, 0);

  c.join();
  assert.equal(c.a.session.state().peers.length, 1, 'the host sees the guest');
  assert.equal(c.b.session.state().peers.length, 1, 'and the guest sees the host');

  // ── section 6.2a + section 4.5: the inviter OWNS the session, so the inviter is the Host, and
  //    a peer who typed no name is numbered as an Invitee. Both devices must agree
  //    about both people, or two humans end up with two different names for the
  //    same two humans.
  const hostView = c.a.session.state();
  const guestView = c.b.session.state();
  assert.equal(hostView.self.isHost, true, 'the inviter is the host on its own device');
  assert.equal(hostView.self.name, 'Priya');
  assert.equal(hostView.self.inviteeIndex, 0, 'a host is never numbered');
  assert.equal(hostView.peers[0]?.isHost, false);
  assert.equal(hostView.peers[0]?.name, '', 'the guest chose no name');
  assert.equal(hostView.peers[0]?.inviteeIndex, 1, '→ "Invitee" (section 4.5)');
  assert.equal(hostView.peers[0]?.role, 'writer', 'and the transport knows their role');

  assert.equal(guestView.self.isHost, false, 'and the acceptor is NOT the host on its own device');
  assert.equal(guestView.self.inviteeIndex, 1, 'the same ordinal it has on the other device');
  assert.equal(guestView.peers[0]?.isHost, true, 'the host is the host from over here too');
  assert.equal(guestView.peers[0]?.name, 'Priya');
  assert.equal(guestView.peers[0]?.clientId, HOST_ID);
  // The colour each peer painted itself in is honoured where the palette holds it.
  assert.equal(guestView.peers[0]?.color, COLORS[0]?.hex);
  assert.equal(hostView.peers[0]?.color, COLORS[1]?.hex);

  // ── focus: the default presence primitive on every tool (section 4.1) ──────────────
  const focusToken = `items:${ulid()}`;
  c.a.session.setFocus(focusToken);
  c.a.session.setFocus('title');
  c.a.session.setFocus(focusToken);                 // a burst - the LAST one lands
  c.clock.advance(PRESENCE_THROTTLE_MS);
  assert.equal(
    c.b.session.state().peers[0]?.focus, focusToken,
    "the guest's roster shows the host's focus within one throttle window",
  );

  // ── cursor: opt-in per tool (section 4.3), normalized 0..1 unit space ──────────────
  c.b.session.presence.updateLocal({ cursor: { x: 0.25, y: 0.75 } });
  c.clock.advance(PRESENCE_THROTTLE_MS);
  const seenCursor = c.a.session.presence.roster()[0]?.state.cursor;
  assert.deepEqual(
    seenCursor, { x: 0.25, y: 0.75 },
    'a true x/y cursor survives the guard, the lossy lane and the roster intact',
  );

  // ── away (section 11.4): a hidden tab says so; it is a display state, never a leave ─
  c.b.hide(true);
  c.clock.advance(PRESENCE_THROTTLE_MS);
  assert.equal(c.a.session.state().peers[0]?.away, true, 'the away flag crossed');
  assert.equal(c.a.session.state().peers.length, 1, 'and away is not gone');
  c.b.hide(false);
  c.clock.advance(PRESENCE_THROTTLE_MS);
  assert.equal(c.a.session.state().peers[0]?.away, false, 'and it comes back');

  // ── MEASURED ────────────────────────────────────────────────────────────────
  //
  // Presence rode its OWN lane throughout and the ops lane carried nothing but the
  // hello - section 6.2's lane split is not decorative, and a cursor sample queued behind a
  // reliable retransmit is the head-of-line block section 11.5's sequence numbers replace.
  assert.equal(opFrames(c.ab), 0, 'not one op frame for all of that presence');
  assert.equal(opFrames(c.ba), 0);
  //   host:  the join snapshot, its answer to the guest's arrival, the focus burst = 3
  //   guest: the join snapshot, its answer, the cursor, away-true, away-false      = 5
  // The focus BURST is the number that matters: three `setFocus` calls inside one
  // 50 ms window cost exactly one frame (section 4.7's throttle), not three.
  assert.equal(c.a.rtc.pc().channel('presence').sent.length, 3, 'host presence frames');
  assert.equal(c.b.rtc.pc().channel('presence').sent.length, 5, 'guest presence frames');
  assert.equal(c.a.abuse.length, 0, 'and nothing the guard objected to');
  assert.equal(c.b.abuse.length, 0);

  c.close();
});

// ── 4. The guard ──────────────────────────────────────────────────────────────────

test('a hostile ops frame injected on the wire is refused, and the pair keeps converging', async () => {
  _resetCollabDeviceForTests('track-a');
  const c = await chain();
  c.join();

  await c.a.set('title', 'before the attack');
  await c.settle();
  assertConverged(c, 'before the attack');
  const before = c.b.values();
  const inboundBefore = c.b.inbound.length;

  // Hand-crafted, and none of it is anything this codebase can emit: an input id the
  // manifest does not declare, a `param` aimed at the BLOCKS lane, a sub-field the
  // collection never declared, and a bare object that is not an op at all. Every one
  // is a section 11.11 DROP rather than a section 11.21 abuse - a stale or newer peer genuinely
  // produces these, so the session must survive them.
  c.injectOpsAtB([
    { k: 'param', key: 'undeclared', value: 'x', origin: { client: HOST_ID, clock: 900 } },
    { k: 'param', key: 'items', value: 'not a collection', origin: { client: HOST_ID, clock: 901 } },
    { k: 'field', col: 'items', id: 'ROW', field: 'evil', value: 'x', origin: { client: HOST_ID, clock: 902 } },
    { nope: true },
  ]);
  await c.settle();

  // Refused at the handle - the first boundary a peer's bytes meet - with the typed
  // reasons section 11.26's copy keys off, and nothing reached the session at all.
  const reasons = c.b.logs
    .filter((l) => l.message === 'rtc-handle: op refused')
    .map((l) => (l.detail as { reason?: string } | undefined)?.reason);
  assert.deepEqual(reasons, ['unknown-input', 'wrong-lane', 'unknown-field', 'schema']);
  assert.equal(c.b.inbound.length, inboundBefore, 'not one of them reached the document');
  assert.equal(c.b.abuse.length, 0, 'a drop is not an abuse event (section 11.11)');
  assert.deepEqual(c.b.values(), before, 'and the model is untouched');

  // The session is still a session: the pair converges after the attack exactly as
  // it did before it, in both directions.
  await c.b.set('title', 'after the attack');
  await c.settle();
  await c.a.set('count', 7);
  await c.settle();
  assertConverged(c, 'after the attack');
  assert.equal(c.a.values().title, 'after the attack');
  assert.equal(c.b.values().count, 7);
  assert.equal(c.b.session.state().connection, 'live', 'and nobody was hung up on');

  c.close();
});

test('a prototype key on the wire disconnects the peer and pollutes nothing (section 11.21)', async () => {
  _resetCollabDeviceForTests('track-a');
  const c = await chain();
  c.join();

  await c.a.set('title', 'settled');
  await c.settle();
  const converged = serializeDoc(c.b.handle.docState());

  // A prototype key has no innocent sender - nothing in this codebase can emit one - 
  // so section 11.21 is explicit that the peer is DISCONNECTED, not silently throttled.
  // `JSON.parse` gives `__proto__` as an OWN property, which is the whole point:
  // this is the frame that would re-seat a prototype if anything downstream spread it.
  c.injectOpsAtB([
    { k: 'param', key: 'title', value: 'legitimate', origin: { client: HOST_ID, clock: 800 } },
    { k: 'param', key: '__proto__', value: 'boom', origin: { client: HOST_ID, clock: 801 } },
  ]);
  await c.settle();

  assert.equal(c.b.handle.reason(), 'op-forbidden-key', 'the typed cause the failure copy keys off');
  assert.equal(c.b.session.state().connection, 'closed', 'the peer was hung up on, not throttled');
  assert.equal(
    ({} as Record<string, unknown>).boom, undefined,
    'and Object.prototype was never touched',
  );
  // A cap breach takes the WHOLE message: the well-formed op that travelled beside
  // the hostile one is refused too, so the two decisions cannot disagree.
  assert.equal(
    serializeDoc(c.b.handle.docState()), converged,
    'nothing from that message became state, not even the legitimate op',
  );
  assert.notEqual(c.b.values().title, 'legitimate');

  c.close();
  assert.equal(c.clock.pending(), 0, 'and a disconnect leaves no timer behind either');
});

test(
  "with no guard at B's handle, the SESSION's own admitOps is what rate-limits an " +
  'inbound flood (section 11.21)',
  async () => {
    _resetCollabDeviceForTests('track-a');
    // B's handle is built with NO guard at all - `org/collab-provider.ts`'s actual
    // shape, since that transport has no tool model to build a whitelist from. Every
    // OTHER guard test in this file builds the handle's guard from the SAME
    // `runtime.getModel()` `createCollabSession` uses internally, which makes the
    // two identical and the session's own admission a dead path no assertion here
    // could tell from a no-op: bypassing `admitOps` entirely (`lib/collab-
    // session.ts`) leaves every test above this one green, because the handle
    // already refused (or disconnected on) anything that would have tripped it.
    // This case removes that redundancy.
    const c = await chain({ guardB: false });
    c.join();

    const flood = (from: number, count: number): unknown[] =>
      Array.from({ length: count }, (_, i) => ({
        k: 'param', key: 'title', value: `flood-${from + i}`,
        origin: { client: HOST_ID, clock: from + i },
      }));

    // Two batches, each safely under the handle's own per-message cap (200) and
    // each individually legitimate - every op here is exactly what this codebase
    // emits. Only their SUM, inside the same one-second window, is the problem
    // (section 11.21's ~200 ops/s). With no guard at the handle, `onOpsFrame` never calls
    // `recordAndCheckRate` at all (`rtc-handle.ts`: `if (guard && !guard
    // .recordAndCheckRate(...))`) - so nothing there can be the source of a refusal
    // below, structurally.
    c.injectOpsAtB(flood(1000, 150));
    await c.settle();
    assert.equal(c.b.abuse.length, 0, 'the first 150 are within the ceiling');
    assert.equal(c.b.values().title, 'flood-1149', 'and they landed - this is not a wholesale refusal');

    c.injectOpsAtB(flood(2000, 150));
    await c.settle();

    // Nothing was refused at the handle (there was no guard there to refuse it) - 
    // so the session is the only place left that could have produced this.
    assert.equal(
      c.b.logs.filter((l) => l.message === 'rtc-handle: op refused').length, 0,
      'the handle had no guard, so it refused nothing itself',
    );
    assert.equal(c.b.abuse.length, 1, "the session's own admitOps caught the flood");
    assert.equal(c.b.abuse[0]?.lane, 'ops');
    assert.equal(c.b.abuse[0]?.reason, 'rate-limited');
    // The second batch never reached the model - the rate refusal took the whole
    // batch, per `checkOps`'s own contract, not just the ops past the ceiling.
    assert.equal(c.b.values().title, 'flood-1149', 'the second batch never landed');

    c.close();
  },
);

// ── 5. The divergence backstop (section 6.2) ─────────────────────────────────────────────

test('a dropped op frame is repaired by the 20 s dirty state exchange', async () => {
  _resetCollabDeviceForTests('track-a');
  const c = await chain();
  c.join();

  // Two converged edits first - one from each side - so the exchange below has
  // something to be idempotent about, and the repair is provably a MERGE and not an
  // overwrite of the guest's own writes.
  await c.a.set('title', 'agreed');
  await c.settle();
  await c.b.set('flag', true);
  await c.settle();
  assertConverged(c, 'before the drop');
  const inboundBefore = c.b.inbound.length;
  const framesBefore = c.ab.delivered;

  // The ops lane is reliable and ordered - and "nearly always arrives" is not a
  // convergence proof. Swallow one frame the sender believes it sent.
  c.ab.drop = 1;
  await c.a.set('count', 5);
  await c.settle();

  assert.equal(c.ab.dropped, 1, 'exactly one frame went missing');
  assert.equal(c.ab.delivered, framesBefore, 'and none arrived in its place');
  assert.equal(c.a.values().count, 5, 'the host made the edit');
  assert.equal(c.b.values().count, 1, 'the guest never heard about it - the pair has DIVERGED');
  assert.notEqual(
    serializeDoc(c.a.handle.docState()), serializeDoc(c.b.handle.docState()),
    'and the documents say so, which is what the backstop is for',
  );

  // section 6.2: every 20 s, WHEN this side has emitted anything since the last exchange,
  // the whole of its state goes out again - as ops, replayed verbatim with their
  // ORIGINAL origins, so the receiver arbitrates each register exactly as it would
  // have for the live op.
  c.clock.advance(BACKSTOP_INTERVAL_MS);
  await c.settle();

  assertConverged(c, 'repaired');
  assert.equal(c.b.values().count, 5, 'the lost write is back');
  assert.equal(c.b.values().flag, true, "and the guest's own newer write survived the restatement");

  // MEASURED, and this is the idempotence claim: the exchange restated THREE
  // registers (title, flag, count) in ONE frame, and only the one the guest was
  // actually missing became an op there.
  assert.equal(c.ab.delivered, framesBefore + 1, 'the repair cost exactly one frame');
  assert.equal(
    c.b.inbound.length, inboundBefore + 1,
    'and exactly one op - a restatement of what a peer already holds changes nothing',
  );

  // The flag is dirty-gated: a second 20 s with nothing new to say is silent.
  const afterRepair = c.ab.delivered;
  c.clock.advance(BACKSTOP_INTERVAL_MS);
  await c.settle();
  assert.equal(c.ab.delivered, afterRepair, 'a clean side exchanges nothing (section 6.2 - "only when dirty")');

  c.close();
});

// ── 6. Teardown ───────────────────────────────────────────────────────────────────

test('closing the chain leaves zero timers and zero listeners on either stack', async () => {
  _resetCollabDeviceForTests('track-a');
  const c = await chain();
  c.join();

  await c.a.set('title', 'one last edit');
  await c.settle();
  c.a.session.setFocus('title');
  c.clock.advance(PRESENCE_THROTTLE_MS);

  // Everything is genuinely running before the teardown, or the zeros below would
  // prove only that nothing ever started.
  assert.ok(c.clock.pending() > 0, 'timers are armed while the session lives');
  assert.ok(liveListeners(c.a.rtc) > 0, 'and the host stack has listeners on it');
  assert.ok(liveListeners(c.b.rtc) > 0);
  assert.equal(c.b.session.state().peers.length, 1);

  // The host leaves first. Its presence engine says goodbye on the way out, while
  // the wire is still up, so the guest drops it at once rather than ghosting for the
  // 30 s TTL (section 4.7).
  c.a.close();
  assert.equal(c.b.session.state().peers.length, 0, 'a clean leave removes immediately');
  assert.equal(c.a.transport.state().connection, 'closed', 'and the transport really went');
  // NOT asserted: `a.session.state().connection`. A session unsubscribes from the
  // handle BEFORE closing it (the order that lets presence say goodbye over a live
  // wire), so the last state it ever published is the pre-close one. The pill is
  // unmounted by then; this is documented here rather than pinned, because the value
  // is a consequence of the teardown order rather than a promise to a reader.

  c.b.close();
  c.a.ceremony.dispose();
  c.b.ceremony.dispose();

  assert.equal(c.clock.pending(), 0, 'not one armed timer anywhere in the chain');
  assert.equal(liveListeners(c.a.rtc), 0, 'and not one listener left on the host stack');
  assert.equal(liveListeners(c.b.rtc), 0, 'nor on the guest stack');
  assert.equal(c.a.rtc.pc().closed, true, 'both peer connections are closed');
  assert.equal(c.b.rtc.pc().closed, true);

  // Idempotent: the shell calls `close()` from a `_cleanup` hook that can fire twice.
  c.close();
  assert.equal(c.clock.pending(), 0);
});
