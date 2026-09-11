// SPDX-License-Identifier: MPL-2.0
/**
 * The beam session - the four wires, end to end (plan 100 section 6.4, section 11.6, section 11.16,
 * section 11.18, section 11.24).
 *
 * `beam-protocol.test.ts` proves the wire, `beam-pack.test.ts` proves the two ends
 * that touch the user's data, `beam-sink.test.ts` proves staging. This suite proves
 * the thing none of them can: that the four are actually CONNECTED, and connected in
 * the order the plan requires.
 *
 * Everything runs against a fake LANE PAIR - two objects with the transport's exact
 * beam-lane shape (`json`/`binary`/`onDrain`/`bufferedAmount`/`lowThreshold`/`isOpen`)
 * cross-wired into each other's session - plus an in-memory sink and, on the receiving
 * side, the REAL `lib/beam-pack.ts` ingest against an in-memory host. So there is no
 * `RTCPeerConnection`, no IndexedDB, no Worker and no DOM anywhere in here, and the
 * assertions are still about real bytes landing in a real library:
 *
 *   - a session + its asset closure round-trips **byte-exact**, both directions on one
 *     lane pair, with catalog refs listed rather than sent (section 11.16);
 *   - **consent gates everything**: a decline moves not one byte, and a chunk header
 *     that arrives before `accept` cancels the beam and discards staging (section 11.24);
 *   - the sender is **pull-driven**: with the lane's buffer above its low threshold,
 *     nothing leaves until the lane says it drained (section 11.6);
 *   - a **cancel mid-transfer** - from either side - leaves nothing staged and nothing
 *     ingested (section 11.18), and so does `close()`;
 *   - the toast port sees **offer → accepted → progress → item-done → complete**, in
 *     that order, with progress never going backwards.
 *
 * The lanes deliver SYNCHRONOUSLY (a peer's cancel lands re-entrantly, from inside the
 * sender's own write) because that is the nastiest ordering a real channel produces.
 *
 * Run directly:  node --test shells/web/src/collab/beam-session.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createBeamSession } from './beam-session.ts';
import type {
  BeamInboundFrame,
  BeamLane,
  BeamSendResult,
  BeamSession,
  BeamSessionSink,
  BeamStagedBytes,
} from './beam-session.ts';
import { BEAM_PROTOCOL_VERSION, sriSha256 } from './beam-protocol.ts';
import type { BeamToastEvent } from '../components/beam-toast.ts';
import type { BeamAssetRecord, BeamPackHost, BeamSessionRow } from '../lib/beam-pack.ts';

// ── The fake lane ─────────────────────────────────────────────────────────────

interface FakeLane extends BeamLane {
  open: boolean;
  /** Hold every write in a buffer the test drains by hand - the backpressure model. */
  manual: boolean;
  /** Everything this lane was asked to write, in order. */
  sent: BeamInboundFrame[];
  flush(): void;
  deliverTo(fn: (frame: BeamInboundFrame) => void): void;
}

function makeLane(lowThreshold = 4096): FakeLane {
  const drains = new Set<() => void>();
  const queue: BeamInboundFrame[] = [];
  let buffered = 0;
  let deliver: ((frame: BeamInboundFrame) => void) | null = null;

  const push = (frame: BeamInboundFrame, size: number): void => {
    lane.sent.push(frame);
    if (lane.manual) {
      queue.push(frame);
      buffered += size;
      return;
    }
    deliver?.(frame);
  };

  const lane: FakeLane = {
    open: true,
    manual: false,
    sent: [],
    lowThreshold,
    json(message) {
      const text = JSON.stringify(message);
      push({ kind: 'json', json: JSON.parse(text) }, text.length);
    },
    binary(bytes) {
      // A real wire owns its own copy: the protocol may hand out a view over a buffer
      // it is about to reuse.
      push({ kind: 'binary', bytes: new Uint8Array(bytes) }, bytes.byteLength);
    },
    onDrain(pull) {
      drains.add(pull);
      return () => {
        drains.delete(pull);
      };
    },
    bufferedAmount() {
      return buffered;
    },
    isOpen() {
      return lane.open;
    },
    flush() {
      const pending = queue.splice(0);
      buffered = 0;
      for (const frame of pending) deliver?.(frame);
      for (const fn of [...drains]) fn();
    },
    deliverTo(fn) {
      deliver = fn;
    },
  };
  return lane;
}

function connect(lane: FakeLane, session: BeamSession): void {
  lane.deliverTo((frame) => {
    if (frame.kind === 'json') session.receiveJson(frame.json);
    else session.receiveBinary(frame.bytes);
  });
}

// ── The in-memory sink ────────────────────────────────────────────────────────

interface MemSink extends BeamSessionSink {
  readonly writes: { itemIndex: number; seq: number; bytes: Uint8Array }[];
  discards: number;
  /** Chunks staged and not yet sealed. */
  staged(): number;
  /** Items sealed and not yet taken. */
  sealedCount(): number;
}

/**
 * The production arrangement, in memory: the SINK produces each item's digest, so the
 * protocol buffers nothing of its own (`hasher: null`, which is `createBeamSession`'s
 * default). Verification still happens - just against what staging actually holds.
 */
function memSink(): MemSink {
  const chunks = new Map<number, Uint8Array[]>();
  const sealed = new Map<number, Blob>();
  const sink: MemSink = {
    writes: [],
    discards: 0,
    async write(itemIndex, seq, bytes) {
      sink.writes.push({ itemIndex, seq, bytes: new Uint8Array(bytes) });
      const list = chunks.get(itemIndex) ?? [];
      list.push(new Uint8Array(bytes));
      chunks.set(itemIndex, list);
    },
    async finalize(itemIndex) {
      const list = chunks.get(itemIndex) ?? [];
      let total = 0;
      for (const part of list) total += part.length;
      const all = new Uint8Array(total);
      let at = 0;
      for (const part of list) {
        all.set(part, at);
        at += part.length;
      }
      chunks.delete(itemIndex);
      sealed.set(itemIndex, new Blob([all as unknown as BlobPart]));
      return sriSha256(all);
    },
    async discard() {
      sink.discards += 1;
      chunks.clear();
      sealed.clear();
    },
    takeAll(): readonly BeamStagedBytes[] {
      const out = [...sealed.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([itemIndex, blob]) => ({ itemIndex, blob }));
      sealed.clear();
      return out;
    },
    staged() {
      let n = 0;
      for (const list of chunks.values()) n += list.length;
      return n;
    },
    sealedCount() {
      return sealed.size;
    },
  };
  return sink;
}

// ── The in-memory host (the `data-transfer.ts` pattern, as beam-pack.test uses) ──

interface FakeHost extends BeamPackHost {
  records: Map<string, BeamAssetRecord>;
  sessions: Map<string, { data: Record<string, unknown>; thumb: string | null }>;
}

function makeHost(): FakeHost {
  const records = new Map<string, BeamAssetRecord>();
  const sessions = new Map<string, { data: Record<string, unknown>; thumb: string | null }>();
  const host: FakeHost = {
    records,
    sessions,
    state: {
      async list(): Promise<readonly BeamSessionRow[]> {
        return [...sessions.entries()].map(([slot, row]) => ({
          slot,
          toolId: row.data.__toolId,
          toolVersion: row.data.__toolVersion,
          label: row.data.__label,
          thumb: row.thumb,
        }));
      },
      async load(slot) {
        const row = sessions.get(slot);
        return row ? JSON.parse(JSON.stringify(row.data)) : null;
      },
      async save(slot, data, thumb = null) {
        sessions.set(slot, { data: JSON.parse(JSON.stringify(data)), thumb: thumb ?? null });
      },
      async delete(slot) {
        sessions.delete(slot);
      },
    },
    assets: {
      async _exportUserAssets() {
        return [...records.values()];
      },
      async _uploadUserAsset(record) {
        records.set(record.id, record);
      },
      async _getUserRecord(id) {
        return records.get(id) ?? null;
      },
      async _deleteUserAsset(id) {
        records.delete(id);
      },
    },
  };
  return host;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PHOTO = 'user/upload/1-photo.png';
const LOGO = 'suse/logo/primary';
const SLOT = 'design:1000';

/** Deterministic pseudo-random bytes (xorshift32) - same seed, same beam, always. */
function bytesOf(n: number, seed: number): Uint8Array {
  const out = new Uint8Array(n);
  let x = (seed >>> 0) || 1;
  for (let i = 0; i < n; i++) {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5;
    x >>>= 0;
    out[i] = x & 0xff;
  }
  return out;
}

/** The ingest reads the BYTES to decide what a file is, so a fixture that claims PNG
 *  has to actually start like one. */
function pngOf(n: number, seed: number): Uint8Array {
  const out = bytesOf(n, seed);
  out.set(PNG_SIG, 0);
  return out;
}

function addAsset(host: FakeHost, id: string, bytes: Uint8Array): void {
  host.records.set(id, {
    id,
    type: 'raster',
    format: 'png',
    blob: new Blob([bytes as unknown as BlobPart], { type: 'image/png' }),
    version: '1.0.0',
    meta: { name: id.split('/').pop() },
  });
}

function ref(source: string, id: string): Record<string, unknown> {
  return { source, id, type: 'raster', format: 'png', version: '1.0.0', url: 'blob:sender/x' };
}

/** One catalog ref (listed, never sent) and one upload (which must travel). */
function fixtureSession(): Record<string, unknown> {
  return {
    __toolId: 'design',
    __toolVersion: '1.0.0',
    __label: 'Berlin poster',
    logo: ref('library', LOGO),
    photo: ref('user', PHOTO),
  };
}

/** A host with the fixture session and the upload it references. */
function senderHost(size = 3000): FakeHost {
  const host = makeHost();
  addAsset(host, PHOTO, pngOf(size, 7));
  host.sessions.set(SLOT, { data: fixtureSession(), thumb: null });
  return host;
}

// ── Waiting ───────────────────────────────────────────────────────────────────
//
// The pump is async by construction (a pull awaits the byte source), so every
// assertion about a moving beam has to let the loop run. No fake timers: nothing in
// this feature is on a clock, so real macrotasks are the honest wait.

async function tick(n = 1): Promise<void> {
  for (let i = 0; i < n; i++) await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

async function waitFor(predicate: () => boolean, what: string): Promise<void> {
  for (let i = 0; i < 2000; i++) {
    if (predicate()) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  assert.fail(`timed out waiting for ${what}`);
}

function ok(result: BeamSendResult): { beamId: string; totalBytes: number; byReference: readonly string[] } {
  if (!result.ok) assert.fail(`the beam was refused: ${result.reason} ${result.detail ?? ''}`);
  return result;
}

const types = (events: readonly BeamToastEvent[]): string[] => events.map((e) => e.t);
const only = (events: readonly BeamToastEvent[], t: string): BeamToastEvent[] => events.filter((e) => e.t === t);

// ── Tests ─────────────────────────────────────────────────────────────────────

test('a session and its closure round-trip over a lane pair, byte-exact, both ways', async () => {
  const hostA = senderHost();
  const hostB = makeHost();
  const laneA = makeLane();
  const laneB = makeLane();
  const eventsA: BeamToastEvent[] = [];
  const eventsB: BeamToastEvent[] = [];
  let sinkA: MemSink | null = null;
  let sinkB: MemSink | null = null;

  const sessionA = createBeamSession({
    lane: laneA,
    role: 'inviter',
    peerName: 'Priya',
    selfName: 'Andy',
    host: hostA,
    sink: () => (sinkA = memSink()),
    workerFactory: null,
    chunkBytes: 1024,
    onEvent: (e) => eventsA.push(e),
  });
  const sessionB = createBeamSession({
    lane: laneB,
    role: 'acceptor',
    peerName: 'Andy',
    selfName: 'Priya',
    host: hostB,
    sink: () => (sinkB = memSink()),
    workerFactory: null,
    chunkBytes: 1024,
    onEvent: (e) => eventsB.push(e),
  });
  connect(laneA, sessionB);
  connect(laneB, sessionA);

  // ── A → B: the section 11.16 offer, sized and disclosed before anything moves ──
  const out = ok(await sessionA.sendCurrentSession(SLOT));
  assert.deepEqual([...out.byReference], [LOGO], 'a catalog ref is listed by reference, never sent (section 11.16)');

  const offered = eventsB[0];
  assert.equal(offered?.t, 'offer-received');
  if (offered?.t !== 'offer-received') return;
  assert.equal(offered.offer.role, 'receiver');
  assert.equal(offered.offer.beamId, out.beamId);
  assert.equal(offered.offer.name, 'Berlin poster');
  assert.equal(offered.offer.itemCount, 2, 'the pack manifest is bookkeeping, not an item a human is told about');
  assert.equal(offered.offer.totalBytes, out.totalBytes);
  assert.equal(offered.offer.peerName, 'Andy');
  assert.equal(sinkB!.writes.length, 0, 'not one byte is staged before consent (section 11.24)');
  assert.equal(hostB.records.size, 0);

  sessionB.toast.accept(out.beamId);
  await waitFor(() => only(eventsB, 'complete').length === 1, 'the incoming beam to land');

  assert.equal(sessionA.state().outgoing?.phase, 'complete');
  assert.equal(sessionB.state().incoming?.phase, 'complete');

  // The asset landed under a receiver-local id, byte for byte (section 6.4).
  assert.equal(hostB.records.size, 1);
  const landed = [...hostB.records.values()][0]!;
  assert.ok(landed.id.startsWith('user/beam/'), `re-keyed on ingest, got ${landed.id}`);
  const inBytes = new Uint8Array(await hostA.records.get(PHOTO)!.blob!.arrayBuffer());
  const outBytes = new Uint8Array(await landed.blob!.arrayBuffer());
  assert.deepEqual([...outBytes], [...inBytes], 'byte-exact, through the lane');
  assert.equal(landed.meta!.beamFrom, 'Andy', 'attributed to the sender’s chosen name (section 6.4)');

  // …and the session that came after it points at that id.
  assert.equal(hostB.sessions.size, 1);
  const [, session] = [...hostB.sessions.entries()][0]!;
  assert.equal(session.data.__label, 'Berlin poster (from Andy)');
  assert.equal((session.data.photo as { id: string }).id, landed.id);
  assert.equal((session.data.logo as { id: string }).id, LOGO, 'a catalog ref is left for the receiver to resolve');

  // Staging never outlives the transfer, even the one that succeeded (section 11.18).
  assert.equal(sinkB!.discards, 1);
  assert.equal(sinkB!.staged(), 0);
  assert.equal(sinkB!.sealedCount(), 0);

  // ── B → A, on the same lane pair: duplex, and the checksum dedup ──
  const back = ok(await sessionB.send({ from: 'assets', host: hostB, ids: [landed.id], workerFactory: null }));
  await waitFor(() => eventsA.some((e) => e.t === 'offer-received' && e.offer.beamId === back.beamId), 'A’s consent sheet');
  sessionA.toast.accept(back.beamId);
  await waitFor(() => only(eventsA, 'complete').length === 2, 'the return beam to land');

  assert.equal(hostA.records.size, 1, 'identical bytes already here are reused - no second row (section 6.4)');
  assert.equal(sinkA!.discards, 1);

  sessionA.close();
  sessionB.close();
});

test('a decline moves no bytes, and discards staging', async () => {
  const hostA = senderHost(2000);
  const laneA = makeLane();
  const laneB = makeLane();
  const eventsA: BeamToastEvent[] = [];
  const eventsB: BeamToastEvent[] = [];
  let sinkB: MemSink | null = null;

  const sessionA = createBeamSession({
    lane: laneA, role: 'inviter', host: hostA, workerFactory: null, onEvent: (e) => eventsA.push(e),
  });
  const sessionB = createBeamSession({
    lane: laneB, role: 'acceptor', host: makeHost(), sink: () => (sinkB = memSink()),
    workerFactory: null, onEvent: (e) => eventsB.push(e),
  });
  connect(laneA, sessionB);
  connect(laneB, sessionA);

  const out = ok(await sessionA.sendCurrentSession(SLOT));
  sessionB.toast.decline(out.beamId);
  await tick(2);

  assert.equal(laneA.sent.length, 1, 'the offer, and nothing else');
  assert.equal(laneA.sent[0]?.kind, 'json');
  assert.equal(laneA.sent.filter((f) => f.kind === 'binary').length, 0);
  assert.equal(sinkB!.writes.length, 0);
  assert.equal(sinkB!.discards, 1, 'the section 11.18 latch fires even when nothing was staged');

  assert.equal(sessionA.state().outgoing?.phase, 'declined');
  assert.equal(sessionA.state().outgoing?.reason, 'user');
  assert.equal(types(eventsA).at(-1), 'cancelled');
  assert.equal(types(eventsB).at(-1), 'cancelled');

  sessionA.close();
  sessionB.close();
});

test('a receiver with no ingest configured declines at offer time, before any bytes move', async () => {
  const hostA = senderHost(2000);
  const laneA = makeLane();
  const laneB = makeLane();
  const eventsA: BeamToastEvent[] = [];
  const eventsB: BeamToastEvent[] = [];
  let sinkB: MemSink | null = null;

  const sessionA = createBeamSession({
    lane: laneA, role: 'inviter', host: hostA, workerFactory: null, onEvent: (e) => eventsA.push(e),
  });
  // B has a working SINK (so this is not the pre-existing "nowhere to stage"
  // refusal) but no `ingest` and no `host` to build one from - `org/collab-
  // provider.ts`'s send-only shape, or any wiring that registers a beam session
  // before it knows whether this device can receive one.
  const sessionB = createBeamSession({
    lane: laneB, role: 'acceptor', sink: () => (sinkB = memSink()), workerFactory: null,
    onEvent: (e) => eventsB.push(e),
  });
  connect(laneA, sessionB);
  connect(laneB, sessionA);

  const out = ok(await sessionA.sendCurrentSession(SLOT));
  await tick(2);

  // The offer, and NOTHING else - no accept, no chunk header, no payload byte. A
  // human on B's side was never shown a consent prompt for a transfer this device
  // could never keep, and the sink factory was never even called.
  assert.equal(laneA.sent.length, 1, 'the offer, and nothing else');
  assert.equal(laneA.sent[0]?.kind, 'json');
  assert.equal(laneA.sent.filter((f) => f.kind === 'binary').length, 0);
  assert.equal(sinkB, null, 'the sink was never staged - this was refused before that point');

  assert.equal(sessionA.state().outgoing?.beamId, out.beamId);
  assert.equal(sessionA.state().outgoing?.phase, 'declined');
  assert.equal(sessionA.state().outgoing?.reason, 'no-space');
  assert.equal(types(eventsA).at(-1), 'cancelled');
  // B never built a receiver machine for this beam at all - refusing at offer time
  // means there is no `offer-received`/`accepted`/… sequence to have emitted events
  // into in the first place.
  assert.equal(eventsB.length, 0);

  sessionA.close();
  sessionB.close();
});

test('the sender writes only from a pull - the lane’s buffer is the pace', async () => {
  const hostA = senderHost(4000);
  const laneA = makeLane(64);          // one chunk is already over the threshold
  const laneB = makeLane();
  let sinkB: MemSink | null = null;

  const sessionA = createBeamSession({
    lane: laneA, role: 'inviter', host: hostA, workerFactory: null, chunkBytes: 1024,
  });
  const sessionB = createBeamSession({
    lane: laneB, role: 'acceptor', host: makeHost(), sink: () => (sinkB = memSink()), workerFactory: null,
  });
  connect(laneA, sessionB);
  connect(laneB, sessionA);

  laneA.manual = true;
  const out = ok(await sessionA.sendCurrentSession(SLOT));
  assert.equal(laneA.sent.length, 1, 'the offer is queued behind the lane');
  laneA.flush();                       // …and delivered
  assert.equal(sessionB.state().incoming?.phase, 'offered');

  const payloads = (): number => laneA.sent.filter((f) => f.kind === 'binary').length;
  sessionB.toast.accept(out.beamId);
  await tick(3);
  assert.equal(payloads(), 1, 'exactly one chunk was pulled, then the pump stopped on a full buffer');
  await tick(3);
  assert.equal(payloads(), 1, 'a full buffer is never written past, however long you wait');

  laneA.flush();                       // the `bufferedamountlow` moment
  await tick(3);
  assert.ok(payloads() > 1, 'the drain is what pulls the next chunk (section 11.6)');
  assert.ok(sinkB!.writes.length >= 1, 'and the chunks that were pulled did stage');

  // Let it finish, so the test also proves the pull loop terminates.
  for (let i = 0; i < 200 && sessionA.state().outgoing?.phase !== 'complete'; i++) {
    laneA.flush();
    await tick();
  }
  assert.equal(sessionA.state().outgoing?.phase, 'complete');

  sessionA.close();
  sessionB.close();
});

test('a mid-transfer cancel discards staging on both sides', async () => {
  const hostA = senderHost(8000);
  const hostB = makeHost();
  const laneA = makeLane(64);
  const laneB = makeLane();
  const eventsA: BeamToastEvent[] = [];
  let sinkB: MemSink | null = null;

  const sessionA = createBeamSession({
    lane: laneA, role: 'inviter', host: hostA, workerFactory: null, chunkBytes: 512,
    onEvent: (e) => eventsA.push(e),
  });
  const sessionB = createBeamSession({
    lane: laneB, role: 'acceptor', host: hostB, sink: () => (sinkB = memSink()), workerFactory: null,
  });
  connect(laneA, sessionB);
  connect(laneB, sessionA);

  laneA.manual = true;
  const out = ok(await sessionA.sendCurrentSession(SLOT));
  laneA.flush();
  sessionB.toast.accept(out.beamId);
  await tick(3);
  laneA.flush();                        // one chunk lands in staging
  await tick(3);

  assert.ok(sinkB!.writes.length >= 1, 'something is staged before the cancel');
  assert.equal(sessionB.state().incoming?.phase, 'receiving');
  const stagedBefore = sinkB!.staged() + sinkB!.sealedCount();
  assert.ok(stagedBefore > 0, 'and it is still held, not ingested');

  sessionB.toast.cancel(out.beamId);
  await tick(2);

  assert.equal(sessionB.state().incoming?.phase, 'cancelled');
  assert.equal(sessionB.state().incoming?.discarded, true);
  assert.equal(sinkB!.discards, 1);
  assert.equal(sinkB!.staged(), 0);
  assert.equal(sinkB!.sealedCount(), 0);
  assert.equal(hostB.records.size, 0, 'a cancelled transfer never partially ingests (section 11.18)');
  assert.equal(hostB.sessions.size, 0);

  // The peer's cancel reaches the sender through the lane it was already writing on.
  assert.equal(sessionA.state().outgoing?.phase, 'cancelled');
  assert.equal(sessionA.state().outgoing?.reason, 'user');
  assert.equal(types(eventsA).at(-1), 'cancelled');

  sessionA.close();
  sessionB.close();
});

test('bytes before consent cancel the beam and discard staging (section 11.24)', async () => {
  const laneB = makeLane();
  const hostB = makeHost();
  const eventsB: BeamToastEvent[] = [];
  let sinkB: MemSink | null = null;
  const sessionB = createBeamSession({
    lane: laneB, role: 'acceptor', host: hostB, sink: () => (sinkB = memSink()),
    workerFactory: null, onEvent: (e) => eventsB.push(e),
  });

  const payload = bytesOf(8, 3);
  const beamId = 'B'.repeat(26);
  sessionB.receiveJson({
    v: BEAM_PROTOCOL_VERSION,
    beamId,
    t: 'offer',
    kind: 'assets',
    name: 'A pushy pack',
    items: [{ id: 'x', label: 'x.bin', bytes: payload.length, checksum: await sriSha256(payload) }],
    totalBytes: payload.length,
  });
  assert.deepEqual(types(eventsB), ['offer-received'], 'the human is asked, and nothing else has happened');
  assert.equal(sessionB.state().incoming?.phase, 'offered');

  // No accept. A chunk header alone is already the violation - the bytes never get
  // a chance to arrive.
  sessionB.receiveJson({ v: BEAM_PROTOCOL_VERSION, beamId, t: 'chunk', itemIndex: 0, seq: 0, last: true });
  await tick();

  assert.equal(sessionB.state().incoming?.phase, 'cancelled');
  assert.equal(sessionB.state().incoming?.reason, 'unsolicited-bytes');
  assert.equal(sinkB!.writes.length, 0);
  assert.equal(sinkB!.discards, 1);
  assert.deepEqual(types(eventsB), ['offer-received', 'cancelled']);

  const refusal = laneB.sent.find((f) => f.kind === 'json' && (f.json as { t?: string }).t === 'cancel');
  assert.ok(refusal, 'the peer is told why');
  assert.equal(((refusal as { json: { reason?: string } }).json).reason, 'unsolicited-bytes');

  // A payload frame with no beam at all is ignored rather than crashing anything.
  sessionB.receiveBinary(payload);
  assert.equal(sinkB!.writes.length, 0);

  sessionB.close();
});

test('the toast port sees offer → accepted → progress → item-done → complete, in order', async () => {
  const hostA = senderHost(3000);
  const hostB = makeHost();
  const laneA = makeLane();
  const laneB = makeLane();

  const sessionA = createBeamSession({
    lane: laneA, role: 'inviter', selfName: 'Andy', host: hostA, workerFactory: null, chunkBytes: 512,
  });
  const sessionB = createBeamSession({
    lane: laneB, role: 'acceptor', peerName: 'Andy', host: hostB, sink: () => memSink(), workerFactory: null,
  });
  connect(laneA, sessionB);
  connect(laneB, sessionA);

  // Through the PORT (`subscribe`), not the construction-time listener - this is the
  // surface `mountBeamToast(el, session.toast)` consumes.
  const seen: BeamToastEvent[] = [];
  const stop = sessionB.toast.subscribe((e) => seen.push(e));

  const out = ok(await sessionA.sendCurrentSession(SLOT));
  sessionB.toast.accept(out.beamId);
  await waitFor(() => seen.some((e) => e.t === 'complete'), 'the beam to land');

  const order = types(seen);
  assert.equal(order[0], 'offer-received');
  assert.equal(order[1], 'accepted');
  assert.equal(order.at(-1), 'complete');
  assert.equal(order.indexOf('progress') > order.indexOf('accepted'), true, 'nothing moves before consent');
  assert.equal(order.filter((t) => t === 'offer-received').length, 1);
  assert.equal(order.filter((t) => t === 'complete').length, 1);
  assert.equal(order.filter((t) => t === 'item-done').length, 3, 'manifest, asset, session');

  let last = -1;
  for (const event of seen) {
    if (event.t !== 'progress') continue;
    assert.ok(event.progress.bytes >= last, `progress went backwards: ${last} → ${event.progress.bytes}`);
    last = event.progress.bytes;
  }
  assert.equal(last, out.totalBytes, 'the final progress is the whole disclosed size');

  const done = seen.find((e) => e.t === 'complete');
  assert.equal(done?.t === 'complete' ? done.itemCount : -1, 2, 'the manifest is not something a human "received"');

  stop();
  sessionA.close();
  sessionB.close();
});

test('close() discards staging for a beam still in flight', async () => {
  const hostA = senderHost(8000);
  const hostB = makeHost();
  const laneA = makeLane(64);
  const laneB = makeLane();
  let sinkB: MemSink | null = null;

  const sessionA = createBeamSession({
    lane: laneA, role: 'inviter', host: hostA, workerFactory: null, chunkBytes: 512,
  });
  const sessionB = createBeamSession({
    lane: laneB, role: 'acceptor', host: hostB, sink: () => (sinkB = memSink()), workerFactory: null,
  });
  connect(laneA, sessionB);
  connect(laneB, sessionA);

  laneA.manual = true;
  const out = ok(await sessionA.sendCurrentSession(SLOT));
  laneA.flush();
  sessionB.toast.accept(out.beamId);
  await tick(3);
  laneA.flush();
  await tick(3);
  assert.ok(sinkB!.writes.length >= 1);

  sessionB.close();
  await tick(2);
  assert.equal(sessionB.state().incoming?.phase, 'cancelled');
  assert.equal(sessionB.state().incoming?.discarded, true);
  assert.equal(sinkB!.discards, 1);
  assert.equal(hostB.records.size, 0);

  sessionA.close();
});

test('sendCurrentSession packs a live, unsaved state - no slot required', async () => {
  const hostA = makeHost();
  addAsset(hostA, PHOTO, pngOf(1500, 11));           // the upload exists…
  const hostB = makeHost();                          // …but the session was never saved
  const laneA = makeLane();
  const laneB = makeLane();
  const eventsB: BeamToastEvent[] = [];

  const sessionA = createBeamSession({
    lane: laneA, role: 'inviter', selfName: 'Andy', host: hostA, workerFactory: null, chunkBytes: 1024,
  });
  const sessionB = createBeamSession({
    lane: laneB, role: 'acceptor', peerName: 'Andy', host: hostB, sink: () => memSink(),
    workerFactory: null, onEvent: (e) => eventsB.push(e),
  });
  connect(laneA, sessionB);
  connect(laneB, sessionA);

  const live = { ...fixtureSession(), __label: 'Unsaved draft' };
  const out = ok(await sessionA.sendCurrentSession(live));
  assert.deepEqual([...out.byReference], [LOGO]);
  assert.equal(hostA.sessions.size, 0, 'packing a live state writes nothing to the sender’s own store');

  sessionB.toast.accept(out.beamId);
  await waitFor(() => eventsB.some((e) => e.t === 'complete'), 'the live session to land');

  assert.equal(hostB.sessions.size, 1);
  const [slot, saved] = [...hostB.sessions.entries()][0]!;
  assert.ok(slot.startsWith('design:'), `minted from the tool id, got ${slot}`);
  assert.equal(saved.data.__label, 'Unsaved draft (from Andy)');
  const asset = [...hostB.records.values()][0]!;
  assert.equal((saved.data.photo as { id: string }).id, asset.id);

  sessionA.close();
  sessionB.close();
});
