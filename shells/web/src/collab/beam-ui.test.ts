// SPDX-License-Identifier: MPL-2.0
/**
 * beam-ui - the door into the beam (plan 100 section 6.4).
 *
 * `beam-session.test.ts` proves the four wires are connected. What it cannot prove is
 * that anything ever OPENS one: until this module, the whole beam stack shipped complete
 * and unreachable - no session created, no toast mounted, `sendCurrentSession` called by
 * nobody. So this suite pins the three properties that make it reachable:
 *
 *   1. the send path builds a real offer FROM THE LIVE STATE - a working copy that was
 *      never saved to a slot - and it round-trips into the receiver's library byte-for-
 *      byte, with its user upload, over a fake lane pair;
 *   2. the toast is mounted ONCE per collab (not once per beam: the session multiplexes
 *      the outgoing and the incoming direction onto one stream) and comes off on close,
 *      together with the container this module made;
 *   3. a refusal is a value, never a throw - a closed lane and an empty reader come back
 *      as `{ ok: false, reason }` so the caller can say something true;
 *   4. an ACCEPTOR's two hosts go in opposite directions - packed from the ephemeral
 *      working copy (section 11.17), landed in the real library (section 6.4). One host for both made
 *      the toast report a success that evaporated at teardown.
 *
 * The lane pair is `beam-session.test.ts`'s, narrowed to what a transport publishes: the
 * six-member bulk lane plus the `message` stream every lane is multiplexed onto. So there
 * is no `RTCPeerConnection`, no IndexedDB and no beam-protocol instance written by hand
 * anywhere here - and the assertions are still about real bytes landing in a real host.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/collab/beam-ui.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// jsdom first: `components/beam-toast.ts` (imported by the module under test) touches
// `document` at mount and pulls its own stylesheet.
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/app' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
  setTimeout(() => cb(0), 0);
  return 0;
}) as unknown as typeof requestAnimationFrame;

const { createCollabBeamUi, beamLinkOf } = await import('./beam-ui.ts');
const { sriSha256 } = await import('./beam-protocol.ts');
type CollabBeamLink = import('./beam-ui.ts').CollabBeamLink;
type CollabBeamTransport = import('./beam-ui.ts').CollabBeamTransport;
type BeamEventSource = import('../components/beam-toast.ts').BeamEventSource;
type BeamToastEvent = import('../components/beam-toast.ts').BeamToastEvent;
type BeamToastHandle = import('../components/beam-toast.ts').BeamToastHandle;
type BeamSessionSink = import('./beam-session.ts').BeamSessionSink;
type BeamStagedBytes = import('./beam-session.ts').BeamStagedBytes;
type BeamAssetRecord = import('../lib/beam-pack.ts').BeamAssetRecord;
type BeamPackHost = import('../lib/beam-pack.ts').BeamPackHost;
type BeamSessionRow = import('../lib/beam-pack.ts').BeamSessionRow;
type RtcInboundMessage = import('./rtc-transport.ts').RtcInboundMessage;

// ── The fake transport ────────────────────────────────────────────────────────
//
// `beam-session.test.ts`'s lane, wrapped in the two members `CollabBeamTransport`
// names: `beam` (the bulk lane) and `on('message')` (the stream every lane shares).
// Frames are delivered SYNCHRONOUSLY, which is the nastiest ordering a real channel
// produces - a peer's decline lands re-entrantly, inside the sender's own write.

interface FakeTransport extends CollabBeamTransport {
  open: boolean;
  /** Everything this side was asked to write, in order. */
  readonly sent: RtcInboundMessage[];
  /** Play one frame into this transport's `message` stream (what the peer wrote). */
  receive(message: RtcInboundMessage): void;
  /** Point this transport's writes at a peer. */
  deliverTo(fn: (message: RtcInboundMessage) => void): void;
}

function makeTransport(): FakeTransport {
  const drains = new Set<() => void>();
  const listeners = new Set<(message: RtcInboundMessage) => void>();
  let deliver: ((message: RtcInboundMessage) => void) | null = null;

  const write = (frame: RtcInboundMessage): void => {
    transport.sent.push(frame);
    deliver?.(frame);
  };

  const transport: FakeTransport = {
    open: true,
    sent: [],
    beam: {
      lowThreshold: 4096,
      // A real wire serialises: the receiver must never share an object (or a byte
      // view) with the sender, or the protocol reusing a buffer would silently rewrite
      // a frame the peer has already been handed.
      json(message) { write({ lane: 'beam', kind: 'json', json: JSON.parse(JSON.stringify(message)) }); },
      binary(bytes) { write({ lane: 'beam', kind: 'binary', bytes: new Uint8Array(bytes) }); },
      onDrain(pull) { drains.add(pull); return () => { drains.delete(pull); }; },
      // Nothing is buffered, so the pump never parks: backpressure is
      // `beam-session.test.ts`'s subject, not this file's.
      bufferedAmount: () => 0,
      isOpen: () => transport.open,
    },
    on(_type, fn) {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
    receive(message) { for (const fn of [...listeners]) fn(message); },
    deliverTo(fn) { deliver = fn; },
  };
  return transport;
}

/** Cross-wire two transports so each one's writes arrive on the other's stream. */
function pair(): { a: FakeTransport; b: FakeTransport } {
  const a = makeTransport();
  const b = makeTransport();
  a.deliverTo((m) => { b.receive(m); });
  b.deliverTo((m) => { a.receive(m); });
  return { a, b };
}

function link(transport: CollabBeamTransport, over: Partial<CollabBeamLink> = {}): CollabBeamLink {
  return { transport, role: 'inviter', ...over };
}

// ── The in-memory host (the shape `beam-session.test.ts` uses) ────────────────

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
      async delete(slot) { sessions.delete(slot); },
    },
    assets: {
      async _exportUserAssets() { return [...records.values()]; },
      async _uploadUserAsset(record) { records.set(record.id, record); },
      async _getUserRecord(id) { return records.get(id) ?? null; },
      async _deleteUserAsset(id) { records.delete(id); },
    },
  };
  return host;
}

// ── Staging, in memory ────────────────────────────────────────────────────────
//
// `beam-session.test.ts`'s sink: the production arrangement (the SINK produces each
// item's digest, so the protocol buffers nothing) minus IndexedDB, which Node does not
// have. Verification still happens - just against what staging actually holds.

function memSink(): BeamSessionSink {
  const chunks = new Map<number, Uint8Array[]>();
  const sealed = new Map<number, Blob>();
  return {
    async write(itemIndex, _seq, bytes) {
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
      for (const part of list) { all.set(part, at); at += part.length; }
      chunks.delete(itemIndex);
      sealed.set(itemIndex, new Blob([all as unknown as BlobPart]));
      return sriSha256(all);
    },
    async discard() { chunks.clear(); sealed.clear(); },
    takeAll(): readonly BeamStagedBytes[] {
      const out = [...sealed.entries()].sort((a, b) => a[0] - b[0]).map(([itemIndex, blob]) => ({ itemIndex, blob }));
      sealed.clear();
      return out;
    },
  };
}

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PHOTO = 'user/upload/9-photo.png';

/** Deterministic bytes that actually start like a PNG - the ingest reads the BYTES to
 *  decide what a received file is, never the peer's label. */
function pngOf(n: number, seed: number): Uint8Array {
  const out = new Uint8Array(n);
  let x = (seed >>> 0) || 1;
  for (let i = 0; i < n; i++) {
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5; x >>>= 0;
    out[i] = x & 0xff;
  }
  out.set(PNG_SIG, 0);
  return out;
}

/** THE LIVE STATE: a working copy that has never been saved to any slot, with one user
 *  upload and one catalog ref. This is what a mounted tool hands `sendCurrentSessionNow`
 *  (`views/tool-collab.ts`'s `currentSession`). */
function liveState(): Record<string, unknown> {
  return {
    __toolId: 'design',
    __toolVersion: '1.0.0',
    headline: 'Unsaved, and going anyway',
    logo: { source: 'library', id: 'suse/logo/primary', type: 'raster', format: 'png', version: '1.0.0', url: 'blob:x' },
    photo: { source: 'user', id: PHOTO, type: 'raster', format: 'png', version: '1.0.0', url: 'blob:y' },
  };
}

/** A toast double that records what it was handed and whether it was disposed. */
function toastSpy() {
  const mounts: { container: HTMLElement; source: BeamEventSource }[] = [];
  const events: BeamToastEvent[] = [];
  let disposals = 0;
  const mount = (container: HTMLElement, source: BeamEventSource): BeamToastHandle => {
    mounts.push({ container, source });
    const off = source.subscribe((e) => { events.push(e); });
    return { dispose() { disposals += 1; off(); } };
  };
  return { mount, mounts, events, disposals: () => disposals };
}

/**
 * Wait for the beam to REACH something, never for a number of turns.
 *
 * This used to spin forty `setImmediate`s, and that is a wall-clock race wearing a
 * deterministic costume. A landing is gated on work that finishes OFF the event loop:
 * every `sriSha256` is a Web Crypto digest on libuv's thread pool (staging's finalize,
 * the ingest re-hash, and the read-back that proves the stored bytes) and `Blob
 * .arrayBuffer()` is read the same way. A check-phase turn costs microseconds, so forty
 * of them elapse in well under a millisecond - on an idle laptop the pool answers inside
 * nine of them and the suite is green, on a two-core runner sharing its cores with the
 * rest of the suite it does not, and the assertions then describe a beam that simply has
 * not landed yet. Measured: under 10× CPU contention, 500 immediate turns were not
 * enough and 9 `setTimeout(0)` turns were - the timer's ~1 ms floor is what makes each
 * turn a real wait instead of a spin.
 *
 * `beam-session.test.ts` already waits this way (`waitFor`), which is why the same
 * landing flow is green there. Same shape here, and the bound is generous rather than
 * tuned: a beam that has not settled in 2,000 turns is a hang, and says so.
 */
async function until(done: () => boolean, what: string): Promise<void> {
  for (let i = 0; i < 2000; i++) {
    if (done()) return;
    await new Promise((r) => { setTimeout(r, 0); });
  }
  assert.fail(`timed out waiting for ${what}`);
}

/**
 * True once the beam that started after `mark` has ended, either way.
 *
 * Terminal-event rather than "did a row appear", so an ingest that FAILED stops the wait
 * immediately and the assertion below reports what did not land - the diagnosis this
 * file is for - instead of timing out with nothing to say. Sliced from a mark because
 * one session multiplexes both directions: an acceptor that has already sent carries its
 * own `complete` at the head of the same stream.
 */
function settledAfter(events: readonly BeamToastEvent[], mark: number): () => boolean {
  return () => events.slice(mark).some((e) => e.t === 'complete' || e.t === 'cancelled');
}

// ── 1. The send path ──────────────────────────────────────────────────────────

test('sendCurrentSessionNow builds the offer from the LIVE state and lands it, byte-exact', async () => {
  const { a, b } = pair();
  const senderHost = makeHost();
  const bytes = pngOf(2600, 7);
  senderHost.records.set(PHOTO, {
    id: PHOTO,
    type: 'raster',
    format: 'png',
    blob: new Blob([bytes as unknown as BlobPart], { type: 'image/png' }),
    version: '1.0.0',
    meta: { name: 'photo.png' },
  });
  const receiverHost = makeHost();

  const senderToast = toastSpy();
  const receiverToast = toastSpy();

  const sender = createCollabBeamUi({
    link: link(a, { role: 'inviter', selfName: 'Priya', peerName: 'Sam' }),
    host: senderHost,
    currentSession: () => ({ state: liveState(), label: 'Design' }),
    container: document.createElement('div'),
    mountToast: senderToast.mount,
  });
  const receiver = createCollabBeamUi({
    link: link(b, { role: 'acceptor', selfName: 'Sam', peerName: 'Priya' }),
    host: receiverHost,
    currentSession: () => null,
    container: document.createElement('div'),
    mountToast: receiverToast.mount,
    sink: () => memSink(),
  });

  const result = await sender.sendCurrentSessionNow();
  assert.equal(result.ok, true, `the send was refused: ${JSON.stringify(result)}`);
  assert.deepEqual(
    result.ok ? [...result.byReference] : null,
    ['suse/logo/primary'],
    'a catalog ref is LISTED, never sent (section 11.16) - the receiver resolves it locally',
  );

  // Consent, through the toast port - the only door there is (section 11.24).
  const offered = receiverToast.events.find((e) => e.t === 'offer-received');
  assert.ok(offered && offered.t === 'offer-received', 'the receiver was never shown an offer');
  assert.equal(offered.offer.name, 'Design', 'the offer is named from the live label');
  assert.equal(offered.offer.peerName, 'Priya', 'the consent sheet says who it is from');
  assert.equal(offered.offer.itemCount, 2, 'one upload + one session; the manifest is bookkeeping');

  const receiverMark = receiverToast.events.length;
  const senderMark = senderToast.events.length;
  receiverToast.mounts[0]!.source.accept(offered.offer.beamId);
  await until(settledAfter(receiverToast.events, receiverMark), 'the receiver to finish the beam');
  await until(settledAfter(senderToast.events, senderMark), 'the sender to see its own beam finish');

  // The upload arrived, byte for byte.
  const landedIds = [...receiverHost.records.keys()];
  assert.equal(landedIds.length, 1, `expected one landed upload, got ${JSON.stringify(landedIds)}`);
  const landed = receiverHost.records.get(landedIds[0]!)!;
  const got = new Uint8Array(await landed.blob!.arrayBuffer());
  assert.deepEqual([...got], [...bytes], 'the bytes must be identical or C2PA does not survive the trip');

  // And the session - the UNSAVED working copy - is now a real saved session on the
  // other device, with its ref rewritten to point at the upload that travelled with it.
  const landedSessions = [...receiverHost.sessions.values()];
  assert.equal(landedSessions.length, 1, 'the live state did not land as a session');
  const data = landedSessions[0]!.data;
  assert.equal(data.headline, 'Unsaved, and going anyway');
  assert.equal(data.__toolId, 'design');
  assert.equal((data.photo as { id: string }).id, landedIds[0], 'the user ref was re-keyed to the landed row');
  assert.equal(
    (data.logo as { id: string }).id,
    'suse/logo/primary',
    'the catalog ref is untouched - it resolves on the receiver\'s own device',
  );

  // Both ends watched it through the SAME component. The sender's card is its own
  // "waiting for Sam to accept…" and its progress; there is no second surface.
  assert.ok(senderToast.events.some((e) => e.t === 'complete'), 'the sender never saw its own completion');
  assert.ok(receiverToast.events.some((e) => e.t === 'complete'), 'the receiver never saw a completion');

  sender.close();
  receiver.close();
});

// ── 1b. An acceptor's two hosts ───────────────────────────────────────────────

test('an acceptor packs from the ephemeral copy and lands a gift in the REAL library', async () => {
  // The one mount in the shell that holds two `BeamPackHost`s at once. `views/tool.ts`
  // swaps `host.state` for a memory bridge before the runtime exists (section 11.17), so an
  // acceptor's working copy can never reach a slot on their device - and for a WHILE the
  // beam was handed that same clone for both directions, which meant an accepted pack was
  // written into a store that dies with the mount. Worse than losing it outright: the
  // assets ride `host.assets`, which was never swapped, so they persisted while the
  // session they belong to did not, and the toast said both had landed.
  const { a, b } = pair();
  const inviterHost = makeHost();
  /** The acceptor's memory-backed `host.state` - their working copy lives here. */
  const ephemeral = makeHost();
  /** The acceptor's real bridge, as it was before the swap. */
  const library = makeHost();

  const WORKING_COPY = 'lolly/beam-live-session-fixture';
  ephemeral.sessions.set(WORKING_COPY, {
    data: { __toolId: 'design', __toolVersion: '1.0.0', __label: 'Ours', headline: 'Edited together' },
    thumb: null,
  });

  const inviterToast = toastSpy();
  const acceptorToast = toastSpy();

  const inviter = createCollabBeamUi({
    link: link(a, { role: 'inviter', selfName: 'Priya', peerName: 'Sam' }),
    host: inviterHost,
    currentSession: () => ({
      state: { __toolId: 'design', __toolVersion: '1.0.0', headline: 'A gift' },
      label: 'Design',
    }),
    container: document.createElement('div'),
    mountToast: inviterToast.mount,
    sink: () => memSink(),
  });
  const acceptor = createCollabBeamUi({
    link: link(b, { role: 'acceptor', selfName: 'Sam', peerName: 'Priya' }),
    // The gift lands HERE …
    host: library,
    // … and the outgoing pack is read from HERE.
    packHost: ephemeral,
    currentSession: () => ({ slot: WORKING_COPY }),
    container: document.createElement('div'),
    mountToast: acceptorToast.mount,
    sink: () => memSink(),
  });

  // ── outgoing: the working copy is theirs to give away ──────────────────────
  //
  // The slot exists in the ephemeral store and NOWHERE else, so a send that read the
  // library would come back `{ ok: false, code: 'no-session' }` rather than an offer.
  const sent = await acceptor.sendCurrentSessionNow();
  assert.equal(sent.ok, true,
    `the acceptor could not pack its own working copy: ${JSON.stringify(sent)} - the send `
    + 'path is reading the library instead of the ephemeral store');

  const toInviter = inviterToast.events.find((e) => e.t === 'offer-received');
  assert.ok(toInviter && toInviter.t === 'offer-received', 'the inviter was never offered it');
  const inviterMark = inviterToast.events.length;
  inviterToast.mounts[0]!.source.accept(toInviter.offer.beamId);
  await until(settledAfter(inviterToast.events, inviterMark), 'the inviter to finish the incoming beam');
  assert.equal([...inviterHost.sessions.values()][0]?.data.headline, 'Edited together',
    'the ephemeral working copy did not arrive on the other device');

  // ── incoming: a gift is not the collab document ────────────────────────────
  const gift = await inviter.sendCurrentSessionNow();
  assert.equal(gift.ok, true, `the inviter's send was refused: ${JSON.stringify(gift)}`);

  // The LAST offer on this stream, not the first: one session multiplexes both
  // directions onto one event source (that is how a sender watches its own beam through
  // the receiver's component), so the acceptor's own outgoing offer above is still
  // sitting at the head of its own toast.
  const offered = acceptorToast.events.filter((e) => e.t === 'offer-received').at(-1);
  assert.ok(offered && offered.t === 'offer-received', 'the acceptor was never shown an offer');
  assert.equal(offered.offer.peerName, 'Priya', 'and it is the INCOMING one');
  const acceptorMark = acceptorToast.events.length;
  acceptorToast.mounts[0]!.source.accept(offered.offer.beamId);
  await until(settledAfter(acceptorToast.events, acceptorMark), 'the acceptor to finish the incoming beam');

  const landed = [...library.sessions.values()];
  assert.equal(landed.length, 1,
    'an accepted beam must land in the receiver\'s real library - section 6.4 promises it lands '
    + 'attributed, with the storage meter updated honestly, and a memory store keeps '
    + 'neither promise past teardown');
  assert.equal(landed[0]!.data.headline, 'A gift');

  assert.equal(ephemeral.sessions.size, 1,
    'and NOT in the ephemeral store: the only slot there is still the working copy it '
    + 'started with, so section 11.17 is untouched by the gift landing');

  inviter.close();
  acceptor.close();
});

// ── 2. The toast: once per collab, and off on close ───────────────────────────

test('the toast mounts once per collab and unmounts on close, container and all', async () => {
  const { a } = pair();
  const spy = toastSpy();
  const ui = createCollabBeamUi({
    link: link(a),
    host: makeHost(),
    currentSession: () => ({ state: liveState() }),
    mountToast: spy.mount,
  });

  assert.equal(spy.mounts.length, 1, 'one toast per collab - the session multiplexes both directions');
  const container = spy.mounts[0]!.container;
  assert.equal(container.parentNode, document.body, 'the default container is attached to the page');

  ui.close();
  assert.equal(spy.disposals(), 1, 'the toast was left subscribed to a closed session');
  assert.equal(container.parentNode, null, 'the container this module made was left on the page');

  ui.close();
  assert.equal(spy.disposals(), 1, 'close is idempotent');
});

test('a caller-supplied container is the caller\'s - closing never removes it', () => {
  const { a } = pair();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const spy = toastSpy();
  const ui = createCollabBeamUi({ link: link(a), container, mountToast: spy.mount });
  ui.close();
  assert.equal(container.parentNode, document.body, 'a container we did not create is not ours to remove');
  container.remove();
});

// ── 3. Refusals are values ───────────────────────────────────────────────────

test('a refusal comes back as a reason, never as a throw', async () => {
  const { a } = pair();
  const spy = toastSpy();

  const noReader = createCollabBeamUi({ link: link(a), host: makeHost(), mountToast: spy.mount });
  assert.deepEqual(
    await noReader.sendCurrentSessionNow(),
    { ok: false, reason: 'build-failed', detail: 'beam-ui: no live session reader' },
  );
  noReader.close();

  const nothing = createCollabBeamUi({
    link: link(a), host: makeHost(), currentSession: () => null, mountToast: spy.mount,
  });
  const empty = await nothing.sendCurrentSessionNow();
  assert.equal(empty.ok, false);
  assert.equal(!empty.ok && empty.reason, 'build-failed');
  nothing.close();

  // A reader that THROWS is a caller bug, and it must not become an unhandled rejection
  // inside a click handler.
  const angry = createCollabBeamUi({
    link: link(a),
    host: makeHost(),
    currentSession: () => { throw new Error('the runtime is gone'); },
    mountToast: spy.mount,
  });
  const thrown = await angry.sendCurrentSessionNow();
  assert.equal(thrown.ok, false);
  angry.close();

  // A closed lane is the honest one: "the connection dropped", not "nothing to send".
  a.open = false;
  const down = createCollabBeamUi({
    link: link(a), host: makeHost(), currentSession: () => ({ state: liveState() }), mountToast: spy.mount,
  });
  assert.equal(down.isOpen(), false, 'a dead lane must report itself - the send control reads this');
  assert.deepEqual(await down.sendCurrentSessionNow(), { ok: false, reason: 'lane-closed' });
  down.close();

  // …and a closed UI is closed, whatever the lane says.
  a.open = true;
  const gone = createCollabBeamUi({
    link: link(a), host: makeHost(), currentSession: () => ({ state: liveState() }), mountToast: spy.mount,
  });
  gone.close();
  assert.equal(gone.isOpen(), false);
  assert.deepEqual(await gone.sendCurrentSessionNow(), { ok: false, reason: 'closed' });
});

// ── 4. The structural read ───────────────────────────────────────────────────

test('beamLinkOf answers only for a connection that really published a lane', () => {
  const { a } = pair();
  assert.equal(beamLinkOf(undefined), null);
  assert.equal(beamLinkOf({}), null, 'a work collab publishes no beam - Track B has no bulk lane');
  assert.equal(beamLinkOf({ beam: {} }), null, 'a beam key with no transport is not a beam');
  assert.equal(
    beamLinkOf({ beam: { transport: { on: () => () => {} }, role: 'inviter' } }),
    null,
    'a transport with no bulk lane is not a beam either',
  );
  const real = { beam: link(a) };
  assert.equal(beamLinkOf(real), real.beam);
});
