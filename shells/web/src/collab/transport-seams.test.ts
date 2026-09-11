// SPDX-License-Identifier: MPL-2.0
/**
 * The transport's seams with everything above it (plan 100 section 6.1, section 11.3, section 11.23, section 11.27).
 *
 * `rtc-transport.test.ts` pins the wire. This file pins the three places where a value
 * this module accepts has to actually REACH somebody, plus the scan loop's abort - each
 * one a defect whose symptom appears in a different module from its cause:
 *
 *  - the session `seed`. It has no slot in the QR-sized invite blob and never will, so it
 *    travels in band on the ops hello. A build that mints it into the local invite and
 *    stops there works perfectly on the inviter's device and hands the acceptor a blank
 *    canvas.
 *  - the display `name`. The acceptor names itself AFTER the tool probe, i.e. after its
 *    transport exists, so the identity has to be read at mint time and not at
 *    construction - otherwise the peer sees the profile prefill, whatever the human typed.
 *  - `reconnecting`. A UDP blip recovers through `checking`, and the data channels never
 *    close, so the naive read flickers back to live halfway through (section 11.3).
 *  - an aborted scan. A dialog that has already closed must not receive a decoded token
 *    from the frame that was in flight when it closed.
 *
 * Fake `RTCPeerConnection`, injected clock, real codec - the same discipline as the main
 * suite, kept to the minimum each seam needs.
 *
 * Run directly:  node --test shells/web/src/collab/transport-seams.test.ts
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CANVAS_OP_VERSION } from '@lolly-tools/core/canvas-op-v1';
import type { CeremonyTimerHandle, CeremonyTimers } from './ceremony.ts';
import { decodePayload, reconstruct } from './sdp-codec.ts';
import type { IceCandidate, SdpMaterial } from './sdp-codec.ts';
import { MAX_FRAME_BYTES, createRtcTransport, inviteFromToken } from './rtc-transport.ts';
import type {
  RtcDataChannelLike,
  RtcDescriptionLike,
  RtcInboundMessage,
  RtcListener,
  RtcPeerConnectionCtor,
  RtcPeerConnectionLike,
} from './rtc-transport.ts';
import { scanQrFromVideo } from './qr-skin.ts';
import type { QrVideoLike } from './qr-skin.ts';

// ── Clock ──────────────────────────────────────────────────────────────────────────

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
}

const settle = (): Promise<void> => new Promise((resolve) => { setImmediate(resolve); });

/** A promise a test resolves by hand, to script the order two async things land in. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: ((value: T) => void) | undefined;
  const promise = new Promise<T>((r) => { resolve = r; });
  if (!resolve) throw new Error('the Promise executor did not run synchronously');
  return { promise, resolve };
}

// ── SDP built by the real codec ───────────────────────────────────────────────────

function unwrap<T>(result: { ok: true; value: T } | { ok: false; reason: string }): T {
  if (!result.ok) throw new Error(result.reason);
  return result.value;
}

const ICE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function material(): SdpMaterial {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 7 + 11) & 0xff;
  const candidates: IceCandidate[] = [{ type: 'host', protocol: 'udp', address: '192.168.1.5', port: 50001 }];
  let ufrag = '';
  let pwd = '';
  for (let i = 0; i < 8; i++) ufrag += ICE_CHARS[(i * 13 + 3) % 64];
  for (let i = 0; i < 24; i++) pwd += ICE_CHARS[(i * 17 + 5) % 64];
  return { fingerprint: { algo: 'sha-256', bytes }, iceUfrag: ufrag, icePwd: pwd, candidates, setupRole: 'actpass' };
}

const OFFER_SDP = unwrap(reconstruct(material(), 'offer'));

// ── The fake stack ────────────────────────────────────────────────────────────────

interface Entry { readonly type: string; readonly fn: RtcListener }

class FakeChannel implements RtcDataChannelLike {
  readyState = 'connecting';
  binaryType = 'blob';
  bufferedAmount = 0;
  bufferedAmountLowThreshold = 0;
  readonly sent: string[] = [];
  readonly label: string;
  private readonly listeners: Entry[] = [];

  constructor(label: string) {
    this.label = label;
  }

  send(data: string | ArrayBufferLike | ArrayBufferView): void {
    if (this.readyState !== 'open') throw new Error(`channel ${this.label} is ${this.readyState}`);
    if (typeof data === 'string') this.sent.push(data);
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
    const at = this.listeners.findIndex((e) => e.type === type && e.fn === fn);
    if (at >= 0) this.listeners.splice(at, 1);
  }

  fire(type: string, extra: Record<string, unknown> = {}): void {
    for (const e of [...this.listeners]) if (e.type === type) e.fn({ type, ...extra });
  }

  open(): void {
    this.readyState = 'open';
    this.fire('open');
  }

  deliver(data: unknown): void {
    this.fire('message', { data });
  }

  frames(): Record<string, unknown>[] {
    return this.sent.map((raw) => JSON.parse(raw) as Record<string, unknown>);
  }
}

class FakePc implements RtcPeerConnectionLike {
  iceGatheringState = 'new';
  iceConnectionState = 'new';
  connectionState = 'new';
  localDescription: RtcDescriptionLike | null = null;
  readonly channels: FakeChannel[] = [];
  private readonly listeners: Entry[] = [];

  createDataChannel(label: string): RtcDataChannelLike {
    const channel = new FakeChannel(label);
    this.channels.push(channel);
    return channel;
  }

  createOffer(): Promise<RtcDescriptionLike> {
    return Promise.resolve({ type: 'offer', sdp: OFFER_SDP });
  }

  createAnswer(): Promise<RtcDescriptionLike> {
    return Promise.resolve({ type: 'answer', sdp: OFFER_SDP });
  }

  setLocalDescription(description?: RtcDescriptionLike): Promise<void> {
    this.localDescription = description ?? null;
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
    const at = this.listeners.findIndex((e) => e.type === type && e.fn === fn);
    if (at >= 0) this.listeners.splice(at, 1);
  }

  close(): void {}

  fire(type: string, extra: Record<string, unknown> = {}): void {
    for (const e of [...this.listeners]) if (e.type === type) e.fn({ type, ...extra });
  }

  setIce(state: string): void {
    this.iceConnectionState = state;
    this.fire('iceconnectionstatechange');
  }

  setConnection(state: string): void {
    this.connectionState = state;
    this.fire('connectionstatechange');
  }

  channel(label: string): FakeChannel {
    const found = this.channels.find((c) => c.label === label);
    if (!found) throw new Error(`no ${label} channel`);
    return found;
  }

  openAll(): void {
    for (const c of this.channels) c.open();
  }
}

function fakeStack(): { ctor: RtcPeerConnectionCtor; pc(): FakePc } {
  const made: FakePc[] = [];
  const ctor: RtcPeerConnectionCtor = class extends FakePc {
    constructor() {
      super();
      made.push(this);
    }
  };
  return {
    ctor,
    pc() {
      const last = made[made.length - 1];
      if (!last) throw new Error('no peer connection was constructed');
      return last;
    },
  };
}

interface Rig {
  readonly transport: ReturnType<typeof createRtcTransport>;
  readonly stack: ReturnType<typeof fakeStack>;
  readonly logs: { message: string; detail?: unknown }[];
}

function rig(over: Parameters<typeof createRtcTransport>[0] extends infer T ? Partial<T> : never = {}): Rig {
  const stack = fakeStack();
  const logs: { message: string; detail?: unknown }[] = [];
  const transport = createRtcTransport({
    role: 'inviter',
    clientId: '01HOST',
    rtc: stack.ctor,
    timers: new TestClock(),
    tool: { id: 'qr-code', version: '1.2.0', engineVersion: '1.108.0' },
    log: (message, detail) => logs.push({ message, detail }),
    ...over,
  });
  return { transport, stack, logs };
}

/** Mint an invite and open the three lanes - the point where the hello goes out. */
async function mintAndOpen(r: Rig): Promise<string> {
  const offer = await r.transport.effects.createOffer({ attempt: 0 });
  assert.equal(offer.ok, true, offer.ok ? '' : (offer.detail ?? 'the invite would not mint'));
  r.stack.pc().openAll();
  return offer.ok ? offer.invite.signal : '';
}

// ── The session seed (section 6.1) ───────────────────────────────────────────────────────

test('the session seed reaches the peer on the ops hello, because the invite blob has no room', async () => {
  const seed = 'z1_packedsessionstate';
  const r = rig({ seed });
  const token = await mintAndOpen(r);

  // Not in the blob, and not because somebody forgot: the payload is sized for a QR
  // (section 6.1 wants ≤150 B), and a packed session state is not that shape.
  const decoded = inviteFromToken(token);
  assert.equal(decoded.ok, true);
  assert.equal((unwrap(decodePayload(token, 'link')) as { invite?: Record<string, unknown> }).invite?.seed, undefined);

  const hello = r.stack.pc().channel('ops').frames()[0];
  assert.equal(hello?.t, 'hello');
  assert.equal(hello?.s, seed, 'the seed rides the first frame on the ops lane');
  assert.equal(hello?.v, CANVAS_OP_VERSION, 'alongside the op version it has always carried');
});

test('no seed means no seed field, not an empty one', async () => {
  const r = rig();
  await mintAndOpen(r);
  const hello = r.stack.pc().channel('ops').frames()[0];
  assert.equal('s' in (hello ?? {}), false);
});

test('a seed too big for one frame is dropped so the hello still declares the op version', async () => {
  const r = rig({ seed: 'z'.repeat(MAX_FRAME_BYTES + 1) });
  await mintAndOpen(r);

  const frames = r.stack.pc().channel('ops').frames();
  assert.equal(frames.length, 1, 'exactly one hello goes out, never two');
  assert.equal(frames[0]?.t, 'hello');
  assert.equal(frames[0]?.s, undefined);
  assert.equal(frames[0]?.v, CANVAS_OP_VERSION, 'losing the op version would be the worse trade');
  assert.ok(r.logs.some((entry) => entry.message.includes('seed did not fit')), 'and it is logged, not silent');
});

test('an inbound seed arrives with the hello it was sent on', async () => {
  const r = rig();
  const messages: RtcInboundMessage[] = [];
  r.transport.on('message', (m) => messages.push(m));
  await mintAndOpen(r);

  r.stack.pc().channel('ops').deliver(JSON.stringify({ t: 'hello', c: '01GUEST', v: CANVAS_OP_VERSION, s: 'z1_state' }));
  const hello = messages.find((m) => m.kind === 'hello');
  assert.equal(hello?.kind === 'hello' ? hello.seed : '', 'z1_state');

  // A peer that sends nonsense in the field is not a peer that crashes us (section 11.21).
  r.stack.pc().channel('ops').deliver(JSON.stringify({ t: 'hello', c: '01GUEST', s: { not: 'a string' } }));
  const second = messages.filter((m) => m.kind === 'hello')[1];
  assert.equal(second?.kind === 'hello' ? second.seed : 'unset', undefined);
});

// ── The chosen name (section 4.5, section 11.23) ────────────────────────────────────────────────

test('a name thunk is read at mint time, so an acceptor that names itself last still reaches the wire', async () => {
  // The acceptor's real order: build the transport for the tool probe, THEN ask the
  // human what to be called. A snapshot taken at construction would ship "" for ever.
  let chosen = '';
  const r = rig({ self: { name: () => chosen, colorIndex: 2 } });

  chosen = 'Sam';
  const token = await mintAndOpen(r);
  const decoded = inviteFromToken(token);
  assert.equal(decoded.ok, true);
  assert.equal(decoded.ok ? decoded.value.invite.name : '', 'Sam');
  assert.equal(decoded.ok ? decoded.value.colorIndex : -1, 2);
});

test('a plain string name still works, and an empty one is anonymity rather than an empty chip', async () => {
  const named = rig({ self: { name: 'Priya' } });
  const namedToken = await mintAndOpen(named);
  const first = inviteFromToken(namedToken);
  assert.equal(first.ok ? first.value.invite.name : '', 'Priya');

  const blank = rig({ self: { name: () => '   ' } });
  const blankToken = await mintAndOpen(blank);
  const second = inviteFromToken(blankToken);
  assert.equal(second.ok, true);
  assert.equal(second.ok ? second.value.invite.name : 'unset', undefined);
});

// ── `disconnected` is not death, and neither is the way back (section 11.3) ──────────────

test('a UDP blip stays reconnecting all the way back, never flickering through live', async () => {
  const r = rig();
  await mintAndOpen(r);
  r.stack.pc().setConnection('connected');
  assert.equal(r.transport.state().connection, 'live');

  // Connection transitions only: `ice` and `gathering` move under it for their own
  // reasons, and the thing section 11.3 is about is what the pill and the avatar read.
  const seen: string[] = [];
  r.transport.on('state', (s) => {
    if (seen[seen.length - 1] !== s.connection) seen.push(s.connection);
  });

  r.stack.pc().setConnection('disconnected');
  assert.equal(r.transport.state().connection, 'reconnecting');

  // Chrome's real recovery path: the ICE transport goes back through `checking`, and
  // the SCTP channels never closed - so the lane test alone would read `live` here.
  r.stack.pc().setIce('checking');
  assert.equal(r.transport.state().connection, 'reconnecting', 'the avatar stays grey for the whole reconnect');

  r.stack.pc().setIce('connected');
  assert.equal(r.transport.state().connection, 'live');

  assert.deepEqual(seen, ['reconnecting', 'live'], 'one grey, one un-grey - no flicker in between');
});

test('a connectionState of connecting during a blip is the same story', async () => {
  const r = rig();
  await mintAndOpen(r);
  r.stack.pc().setConnection('connected');
  r.stack.pc().setConnection('disconnected');
  // `mapConnectionState` folds 'connecting' to 'checking'; the recovery reads identically.
  r.stack.pc().setConnection('connecting');
  assert.equal(r.transport.state().connection, 'reconnecting');
  r.stack.pc().setConnection('connected');
  assert.equal(r.transport.state().connection, 'live');
});

test('a re-invite is a fresh pairing, not the tail of the old one blip', async () => {
  const r = rig();
  await mintAndOpen(r);
  r.stack.pc().setConnection('connected');
  r.stack.pc().setConnection('disconnected');
  assert.equal(r.transport.state().connection, 'reconnecting');

  // Sticky means sticky to THIS connection. A re-invite builds a new one, and it is
  // connecting from scratch - the old blip must not hold the pill grey for ever.
  const again = await r.transport.effects.createOffer({ attempt: 1 });
  assert.equal(again.ok, true);
  assert.equal(r.transport.state().connection, 'connecting');
  r.stack.pc().openAll();
  r.stack.pc().setConnection('connected');
  assert.equal(r.transport.state().connection, 'live');
});

// ── The scan loop's abort (section 11.27) ────────────────────────────────────────────────

/** A video that always has a frame to read. */
const readyVideo: QrVideoLike = { readyState: 4, videoWidth: 640, videoHeight: 480 };

type Detected = { rawValue: string }[];

function detectorScope(detect: () => Promise<Detected>): object {
  class Detector {
    detect(): Promise<Detected> {
      return detect();
    }
  }
  return {
    BarcodeDetector: Object.assign(Detector, { getSupportedFormats: () => Promise.resolve(['qr_code']) }),
  };
}

test('an abort that lands while a frame is decoding resolves null, not a token', async () => {
  const controller = new AbortController();
  const frame = deferred<Detected>();
  const scope = detectorScope(() => frame.promise);

  const scan = scanQrFromVideo(readyVideo, { scope, intervalMs: 0, signal: controller.signal });
  await settle();

  // The dialog closes. The frame in flight then decodes perfectly - and must not be
  // delivered to a step nobody is on any more.
  controller.abort();
  frame.resolve([{ rawValue: 'LOLLYTOKEN' }]);

  assert.equal(await scan, null);
});

test('an abort before the frame decodes still resolves null', async () => {
  const controller = new AbortController();
  controller.abort();
  const scope = detectorScope(() => Promise.resolve([{ rawValue: 'LOLLYTOKEN' }]));
  assert.equal(await scanQrFromVideo(readyVideo, { scope, intervalMs: 0, signal: controller.signal }), null);
});

test('without an abort the same frame is delivered - the guard is the signal, not the await', async () => {
  const scope = detectorScope(() => Promise.resolve([{ rawValue: 'LOLLYTOKEN' }]));
  assert.equal(await scanQrFromVideo(readyVideo, { scope, intervalMs: 0 }), 'LOLLYTOKEN');
});
