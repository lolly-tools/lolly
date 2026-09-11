// SPDX-License-Identifier: MPL-2.0
/**
 * The beam transfer protocol (plan 100 section 6.4, section 11.6, section 11.15a, section 11.18, section 11.24).
 *
 * Everything here runs the REAL machines against a fake transport pair and an
 * in-memory sink, so the properties the plan actually promises are asserted rather
 * than described:
 *
 *   - a beam round-trips **byte-exact**, with every item's SRI SHA-256 verified
 *     against the offer AND against `item-done` (section 6.4: byte-exactness is what lets
 *     C2PA credentials survive a beam, and what makes receiver-side dedup a string
 *     compare);
 *   - the **consent gate** holds: bytes before `accept` are a typed violation, not
 *     an early start (section 11.24);
 *   - **nothing survives a transfer that did not complete** - `discard()` fires
 *     exactly once on decline, violation, cancel, source failure and dispose
 *     (section 11.18);
 *   - the sender is **pull-based**: not one frame leaves without a `nextChunk()`,
 *     so a real transport's `bufferedamountlow` is the whole backpressure story
 *     (section 11.6);
 *   - peer input is untrusted: replayed and skipped `seq`, oversized offers,
 *     inconsistent totals and wrong wire versions all end in a typed cancel.
 *
 * The loopback is deliberately SYNCHRONOUS (a peer's cancel lands re-entrantly, from
 * inside the sender's own write) because that is the nastiest ordering a real
 * channel can produce and the cheapest one to get wrong.
 *
 * Run directly:  node --test shells/web/src/collab/beam-protocol.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BEAM_PROTOCOL_VERSION,
  MAX_ITEMS,
  MAX_MESSAGE_CHARS,
  createBeamReceiver,
  createBeamSender,
  decodeBeamMessage,
  encodeBeamMessage,
  parseBeamMessage,
  sha256Hasher,
  sriSha256,
} from './beam-protocol.ts';
import type {
  BeamItem,
  BeamMessage,
  BeamReceiver,
  BeamSender,
  BeamSink,
  BeamSource,
  BeamWire,
} from './beam-protocol.ts';

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Deterministic pseudo-random bytes (xorshift32) - same input, same beam, always. */
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

async function itemsFor(blobs: readonly Uint8Array[]): Promise<BeamItem[]> {
  const out: BeamItem[] = [];
  for (let i = 0; i < blobs.length; i++) {
    out.push({
      id: `upload/${i}`,
      label: `Item ${i}`,
      bytes: blobs[i]!.length,
      checksum: await sriSha256(blobs[i]!),
    });
  }
  return out;
}

/** A source that hands back VIEWS over its blobs - so the receiver's copy-before-
 *  queue discipline is exercised rather than assumed. */
function memSource(blobs: readonly Uint8Array[]): BeamSource {
  return {
    read(itemIndex, offset, length) {
      return blobs[itemIndex]!.subarray(offset, offset + length);
    },
  };
}

interface MemSink {
  sink: BeamSink;
  writes: Array<{ item: number; seq: number; bytes: Uint8Array }>;
  finalized: number[];
  discards: () => number;
  assemble: (itemIndex: number) => Uint8Array;
}

function memSink(opts: { digest?: (item: number) => string | undefined; failWrite?: number } = {}): MemSink {
  const writes: Array<{ item: number; seq: number; bytes: Uint8Array }> = [];
  const finalized: number[] = [];
  let discards = 0;
  const sink: BeamSink = {
    write(itemIndex, seq, bytes) {
      if (opts.failWrite === itemIndex) throw new Error('staging is full');
      writes.push({ item: itemIndex, seq, bytes: bytes.slice() });
    },
    finalize(itemIndex) {
      finalized.push(itemIndex);
      return opts.digest?.(itemIndex);
    },
    discard() {
      discards++;
    },
  };
  return {
    sink,
    writes,
    finalized,
    discards: () => discards,
    assemble(itemIndex) {
      const parts = writes.filter((w) => w.item === itemIndex).sort((a, b) => a.seq - b.seq);
      let total = 0;
      for (const p of parts) total += p.bytes.length;
      const out = new Uint8Array(total);
      let at = 0;
      for (const p of parts) {
        out.set(p.bytes, at);
        at += p.bytes.length;
      }
      return out;
    },
  };
}

interface Link {
  senderWire: BeamWire;
  receiverWire: BeamWire;
  toReceiver: BeamMessage[];
  toSender: BeamMessage[];
  binaryFrames: () => number;
  attach(sender: BeamSender, receiver: BeamReceiver): void;
}

/** A synchronous loopback. Every control frame goes through the real JSON encode +
 *  the real parser, so the wire form is under test too. */
function link(opts: { corrupt?: (bytes: Uint8Array, n: number) => Uint8Array } = {}): Link {
  const toReceiver: BeamMessage[] = [];
  const toSender: BeamMessage[] = [];
  let frames = 0;
  let sender: BeamSender | null = null;
  let receiver: BeamReceiver | null = null;
  const hop = (msg: BeamMessage): unknown => JSON.parse(encodeBeamMessage(msg));
  return {
    senderWire: {
      json(msg) {
        toReceiver.push(msg);
        receiver?.receive(hop(msg));
      },
      binary(bytes) {
        const n = frames++;
        const out = opts.corrupt ? opts.corrupt(bytes, n) : bytes;
        // A real channel hands over a fresh buffer; copy so a source view can't be
        // mistaken for the receiver keeping the sender's memory alive.
        receiver?.receiveBinary(out.slice());
      },
    },
    receiverWire: {
      json(msg) {
        toSender.push(msg);
        sender?.receive(hop(msg));
      },
      binary() {
        throw new Error('a receiver never sends binary frames');
      },
    },
    toReceiver,
    toSender,
    binaryFrames: () => frames,
    attach(s, r) {
      sender = s;
      receiver = r;
    },
  };
}

/** Pull until the sender stops producing chunks; returns the terminal pull result. */
async function pump(sender: BeamSender): Promise<{ result: string; pulls: number }> {
  let pulls = 0;
  for (let guard = 0; guard < 100_000; guard++) {
    const r = await sender.nextChunk();
    if (r === 'sent') {
      pulls++;
      continue;
    }
    return { result: r, pulls };
  }
  throw new Error('pump did not terminate');
}

/** The standard fixture: a short item, an exact multiple of the chunk size, a
 *  remainder, and a zero-byte item (which carries an item-done and no chunks). */
const CHUNK = 2048;
const BLOBS = [bytesOf(1000, 7), bytesOf(CHUNK * 2, 11), bytesOf(CHUNK + 1, 13), new Uint8Array(0)];

async function rig(over: {
  chunkBytes?: number;
  corrupt?: (b: Uint8Array, n: number) => Uint8Array;
  sink?: MemSink;
  hasher?: null;
  policy?: Parameters<typeof createBeamReceiver>[0]['policy'];
  blobs?: readonly Uint8Array[];
  source?: BeamSource;
} = {}) {
  const blobs = over.blobs ?? BLOBS;
  const items = await itemsFor(blobs);
  const wires = link({ corrupt: over.corrupt });
  const sink = over.sink ?? memSink();
  const receiver = createBeamReceiver({
    wire: wires.receiverWire,
    sink: sink.sink,
    ...(over.hasher === null ? { hasher: null } : {}),
    ...(over.policy ? { policy: over.policy } : {}),
  });
  const sender = createBeamSender({
    offer: { beamId: 'BEAM0000000000000000000001', kind: 'assets', name: 'Berlin pack', items },
    source: over.source ?? memSource(blobs),
    wire: wires.senderWire,
    chunkBytes: over.chunkBytes ?? CHUNK,
  });
  wires.attach(sender, receiver);
  return { blobs, items, wires, sink, sender, receiver };
}

// ── Happy path ────────────────────────────────────────────────────────────────

test('happy path: byte-exact round trip with every checksum verified', async () => {
  const { blobs, items, wires, sink, sender, receiver } = await rig();

  sender.offer();
  assert.equal(receiver.state.phase, 'offered', 'the offer lands as a consent prompt, not a transfer');
  assert.equal(receiver.state.offer?.name, 'Berlin pack');
  assert.equal(receiver.state.offer?.items.length, 4);
  assert.equal(receiver.state.offer?.totalBytes, blobs.reduce((n, b) => n + b.length, 0));
  assert.equal(wires.binaryFrames(), 0, 'no bytes move before consent');

  receiver.accept();
  assert.equal(sender.state.phase, 'sending');

  const { result } = await pump(sender);
  assert.equal(result, 'complete');
  await receiver.drain();

  assert.equal(sender.state.phase, 'complete');
  assert.equal(receiver.state.phase, 'complete');
  assert.equal(sink.discards(), 0, 'a completed beam never discards');
  assert.deepEqual(sink.finalized, [0, 1, 2, 3], 'every item sealed, in order');

  for (let i = 0; i < blobs.length; i++) {
    assert.deepEqual(sink.assemble(i), blobs[i]!, `item ${i} is byte-identical`);
    assert.equal(await sriSha256(sink.assemble(i)), items[i]!.checksum, `item ${i} checksum`);
  }

  const total = blobs.reduce((n, b) => n + b.length, 0);
  assert.equal(receiver.state.progress.bytes, total);
  assert.equal(receiver.state.progress.totalBytes, total);
  assert.equal(receiver.state.progress.itemsDone, 4);
  assert.equal(sender.state.progress.bytes, total);
  assert.equal(sender.state.progress.itemsDone, 4);

  const kinds = wires.toReceiver.map((m) => m.t);
  assert.equal(kinds[0], 'offer');
  assert.equal(kinds.at(-1), 'complete');
  assert.deepEqual(wires.toSender.map((m) => m.t), ['accept'], 'the receiver only ever spoke consent');
});

test('a zero-byte item carries an item-done and no chunk frames', async () => {
  const { wires, sink, sender, receiver } = await rig({ blobs: [new Uint8Array(0)] });
  sender.offer();
  receiver.accept();
  assert.equal((await pump(sender)).result, 'complete');
  await receiver.drain();

  assert.equal(receiver.state.phase, 'complete');
  assert.equal(wires.binaryFrames(), 0);
  assert.equal(sink.writes.length, 0);
  assert.deepEqual(sink.finalized, [0], 'staging is still sealed for an empty item');
});

test('progress is emitted per item and in total, on both sides', async () => {
  const { sender, receiver } = await rig();
  const sendSeen: number[] = [];
  const recvSeen: number[] = [];
  sender.subscribe((s) => sendSeen.push(s.progress.bytes));
  receiver.subscribe((s) => recvSeen.push(s.progress.bytes));

  sender.offer();
  receiver.accept();
  await pump(sender);
  await receiver.drain();

  const rising = (xs: number[]) => xs.every((v, i) => i === 0 || v >= xs[i - 1]!);
  assert.ok(sendSeen.length > 4 && rising(sendSeen), 'sender progress only ever grows');
  assert.ok(recvSeen.length > 4 && rising(recvSeen), 'receiver progress only ever grows');
  assert.equal(sendSeen.at(-1), recvSeen.at(-1), 'both sides agree on the final byte count');
});

// ── Backpressure ──────────────────────────────────────────────────────────────

test('backpressure: one pull is one frame, in order, and pause holds the line', async () => {
  const { wires, sink, sender, receiver } = await rig();
  sender.offer();
  receiver.accept();

  assert.equal(wires.binaryFrames(), 0, 'consent alone sends nothing - the transport pulls');

  assert.equal(await sender.nextChunk(), 'sent');
  assert.equal(wires.binaryFrames(), 1, 'exactly one payload frame per pull');
  const first = wires.toReceiver.filter((m) => m.t === 'chunk').at(-1)!;
  assert.deepEqual(
    { itemIndex: first.itemIndex, seq: first.seq, last: first.last },
    { itemIndex: 0, seq: 0, last: true },
    'item 0 is under one chunk, so its first chunk is also its last',
  );
  assert.equal(
    wires.toReceiver.at(-1)?.t,
    'item-done',
    'an item that finished inside the pull is sealed in the same pull',
  );

  sender.pause();
  assert.equal(await sender.nextChunk(), 'waiting');
  assert.equal(await sender.nextChunk(), 'waiting');
  const frozen = wires.binaryFrames();
  assert.equal(frozen, 1, 'a paused sender produces nothing, however hard it is pulled');

  sender.resume();
  assert.equal(await sender.nextChunk(), 'sent');
  assert.equal(wires.binaryFrames(), 2, 'resume picks up exactly where it stopped');

  const { result } = await pump(sender);
  assert.equal(result, 'complete');
  await receiver.drain();

  // Chunk headers, read back off the wire, must be item-major and seq-monotonic.
  const chunks = wires.toReceiver.filter((m): m is Extract<BeamMessage, { t: 'chunk' }> => m.t === 'chunk');
  assert.deepEqual(
    chunks.map((c) => `${c.itemIndex}:${c.seq}${c.last ? '!' : ''}`),
    ['0:0!', '1:0', '1:1!', '2:0', '2:1!'],
    'items strictly in order, seq strictly +1 within each, last flagged once',
  );
  for (let i = 0; i < BLOBS.length; i++) assert.deepEqual(sink.assemble(i), BLOBS[i]!);
});

test('a pause or cancel landing DURING an in-flight read burns no seq and no bytes', async () => {
  let release: (() => void) | null = null;
  const blobs = [bytesOf(CHUNK * 3, 17)];
  const gated: BeamSource = {
    async read(i, off, len) {
      await new Promise<void>((r) => {
        release = r;
      });
      return blobs[i]!.subarray(off, off + len);
    },
  };

  // Pause while the read is pending: the bytes in hand are dropped, and the resumed
  // pull re-reads the SAME offset - no gap, no duplicate, no burnt seq.
  const a = await rig({ source: gated, blobs });
  a.sender.offer();
  a.receiver.accept();
  const pull = a.sender.nextChunk();
  assert.equal(await a.sender.nextChunk(), 'busy', 'a second pull while one is in flight is a no-op');
  a.sender.pause();
  release!();
  assert.equal(await pull, 'waiting');
  assert.equal(a.wires.binaryFrames(), 0, 'nothing reached the wire');

  a.sender.resume();
  const again = a.sender.nextChunk();
  release!();
  assert.equal(await again, 'sent');
  const header = a.wires.toReceiver.filter((m) => m.t === 'chunk').at(-1)!;
  assert.deepEqual({ seq: header.seq, itemIndex: header.itemIndex }, { seq: 0, itemIndex: 0 });

  // Cancel while the read is pending: same discipline, and the beam is over.
  const b = await rig({ source: gated, blobs });
  b.sender.offer();
  b.receiver.accept();
  const pending = b.sender.nextChunk();
  b.sender.cancel('user');
  release!();
  assert.equal(await pending, 'ended');
  assert.equal(b.wires.binaryFrames(), 0);
  await b.receiver.drain();
  assert.equal(b.sink.discards(), 1);
});

test('nextChunk before consent waits, and after a decline it is ended', async () => {
  const { sender, receiver } = await rig();
  sender.offer();
  assert.equal(await sender.nextChunk(), 'waiting', 'consent gates the sender too');
  receiver.decline('user');
  assert.equal(await sender.nextChunk(), 'ended');
});

// ── Consent gate ──────────────────────────────────────────────────────────────

test('decline sends nothing and still discards staging', async () => {
  const { wires, sink, sender, receiver } = await rig();
  sender.offer();
  receiver.decline('no-space');

  assert.equal(receiver.state.phase, 'declined');
  assert.equal(receiver.state.reason, 'no-space');
  assert.equal(sender.state.phase, 'declined');
  assert.equal(sender.state.reason, 'no-space');
  assert.equal(wires.binaryFrames(), 0);
  assert.equal(sink.writes.length, 0);
  assert.deepEqual(wires.toReceiver.map((m) => m.t), ['offer'], 'the offer was the only thing sent');
  await receiver.drain();
  assert.equal(sink.discards(), 1, 'section 11.18 is unconditional - a declined beam discards too');
});

test('a chunk header before accept is a protocol violation, not an early start', async () => {
  const { wires, sink, sender, receiver } = await rig();
  sender.offer();
  assert.equal(receiver.state.phase, 'offered');

  receiver.receive({ v: BEAM_PROTOCOL_VERSION, beamId: 'BEAM0000000000000000000001', t: 'chunk', itemIndex: 0, seq: 0, last: false });

  assert.equal(receiver.state.phase, 'cancelled');
  assert.equal(receiver.state.reason, 'unsolicited-bytes');
  assert.equal(sink.writes.length, 0, 'not one byte reached staging');
  await receiver.drain();
  assert.equal(sink.discards(), 1);
  const cancel = wires.toSender.at(-1)!;
  assert.equal(cancel.t, 'cancel');
  assert.equal(cancel.t === 'cancel' && cancel.reason, 'unsolicited-bytes');
  assert.equal(sender.state.phase, 'cancelled', 'the sender is told why, in the same word');
});

test('a payload frame before accept is refused the same way', async () => {
  const { sink, sender, receiver } = await rig();
  sender.offer();
  receiver.receiveBinary(bytesOf(64, 3));

  assert.equal(receiver.state.phase, 'cancelled');
  assert.equal(receiver.state.reason, 'unsolicited-bytes');
  assert.equal(sink.writes.length, 0);
  await receiver.drain();
  assert.equal(sink.discards(), 1);
});

test('a payload frame with no chunk header ahead of it is refused', async () => {
  const { sink, sender, receiver } = await rig();
  sender.offer();
  receiver.accept();
  receiver.receiveBinary(bytesOf(64, 5));

  assert.equal(receiver.state.phase, 'cancelled');
  assert.equal(receiver.state.reason, 'bad-message');
  assert.equal(sink.writes.length, 0);
  await receiver.drain();
  assert.equal(sink.discards(), 1);
});

// ── Cancel & teardown ─────────────────────────────────────────────────────────

test('a mid-transfer cancel from the receiver discards staging exactly once', async () => {
  const { sink, sender, receiver } = await rig();
  sender.offer();
  receiver.accept();
  assert.equal(await sender.nextChunk(), 'sent');
  assert.equal(await sender.nextChunk(), 'sent');
  await receiver.drain();
  assert.ok(sink.writes.length >= 2, 'bytes were staged before the cancel');

  receiver.cancel('user');
  await receiver.drain();

  assert.equal(receiver.state.phase, 'cancelled');
  assert.equal(receiver.state.discarded, true);
  assert.equal(sink.discards(), 1);
  assert.ok(!sink.finalized.includes(1), 'the item in flight was never sealed');
  assert.equal(sender.state.phase, 'cancelled', 'the sender stops on the peer cancel');
  assert.equal(await sender.nextChunk(), 'ended');

  receiver.cancel('user');
  await receiver.drain();
  assert.equal(sink.discards(), 1, 'discard is a latch, not a counter');
});

test('a mid-transfer cancel from the sender discards the receiver staging', async () => {
  const { sink, sender, receiver } = await rig();
  sender.offer();
  receiver.accept();
  await sender.nextChunk();
  await sender.nextChunk();

  sender.cancel('user', 'user closed the sheet');
  await receiver.drain();

  assert.equal(sender.state.phase, 'cancelled');
  assert.equal(receiver.state.phase, 'cancelled');
  assert.equal(receiver.state.reason, 'user');
  assert.equal(sink.discards(), 1);
});

test('abort and dispose tear down without a wire write, and still discard', async () => {
  const a = await rig();
  a.sender.offer();
  a.receiver.accept();
  await a.sender.nextChunk();
  const before = a.wires.toSender.length;
  a.receiver.abort('transport', 'channel closed');
  await a.receiver.drain();
  assert.equal(a.receiver.state.phase, 'cancelled');
  assert.equal(a.receiver.state.reason, 'transport');
  assert.equal(a.wires.toSender.length, before, 'a dead channel is not written to');
  assert.equal(a.sink.discards(), 1);

  const b = await rig();
  b.sender.offer();
  b.receiver.accept();
  await b.sender.nextChunk();
  b.receiver.dispose();
  await b.receiver.drain();
  assert.equal(b.sink.discards(), 1, 'dispose of an unfinished beam cannot leak staging');
});

test('a sink that throws ends the beam as sink-failure, and discards', async () => {
  const sink = memSink({ failWrite: 0 });
  const { sender, receiver } = await rig({ sink });
  sender.offer();
  receiver.accept();
  await pump(sender);
  await receiver.drain();

  assert.equal(receiver.state.phase, 'cancelled');
  assert.equal(receiver.state.reason, 'sink-failure');
  assert.equal(sink.discards(), 1);
});

test('a source that throws ends the beam as source-failure', async () => {
  const source: BeamSource = {
    read() {
      throw new Error('staging row vanished');
    },
  };
  const { sink, sender, receiver } = await rig({ source });
  sender.offer();
  receiver.accept();
  assert.equal(await sender.nextChunk(), 'ended');

  assert.equal(sender.state.phase, 'cancelled');
  assert.equal(sender.state.reason, 'source-failure');
  await receiver.drain();
  assert.equal(receiver.state.phase, 'cancelled');
  assert.equal(sink.discards(), 1);
});

test('a source that returns the wrong number of bytes is refused', async () => {
  const source: BeamSource = {
    read(_i, _off, length) {
      return bytesOf(Math.max(1, length - 1), 21);
    },
  };
  const { sender } = await rig({ source });
  sender.offer();
  // Drive the sender directly: the receiver would also refuse, but the point is that
  // the SENDER catches its own broken source before putting anything on the wire.
  sender.receive({ v: BEAM_PROTOCOL_VERSION, beamId: 'BEAM0000000000000000000001', t: 'accept' });
  assert.equal(await sender.nextChunk(), 'ended');
  assert.equal(sender.state.reason, 'source-failure');
});

// ── Untrusted peer input ──────────────────────────────────────────────────────

/** Drive a receiver by hand, so a malformed peer can be simulated exactly. */
async function lonelyReceiver(policy?: Parameters<typeof createBeamReceiver>[0]['policy']) {
  const sent: BeamMessage[] = [];
  const sink = memSink();
  const receiver = createBeamReceiver({
    wire: { json: (m) => sent.push(m), binary: () => assert.fail('receiver sent binary') },
    sink: sink.sink,
    ...(policy ? { policy } : {}),
  });
  const items = await itemsFor(BLOBS);
  const offer = {
    v: BEAM_PROTOCOL_VERSION,
    beamId: 'B1',
    t: 'offer' as const,
    kind: 'assets' as const,
    name: 'Berlin pack',
    items,
    totalBytes: items.reduce((n, i) => n + i.bytes, 0),
  };
  return { receiver, sink, sent, items, offer };
}

test('out-of-order seq is rejected - both a skip and a replay', async () => {
  for (const [label, badSeq] of [['skipped', 2], ['replayed', 0]] as const) {
    const { receiver, sink, sent, offer } = await lonelyReceiver();
    receiver.receive(offer);
    receiver.accept();
    receiver.receive({ v: 1, beamId: 'B1', t: 'chunk', itemIndex: 0, seq: 0, last: false });
    receiver.receiveBinary(bytesOf(500, 2));
    receiver.receive({ v: 1, beamId: 'B1', t: 'chunk', itemIndex: 0, seq: badSeq, last: true });

    assert.equal(receiver.state.phase, 'cancelled', `${label} seq`);
    assert.equal(receiver.state.reason, 'bad-sequence', `${label} seq`);
    assert.equal(sent.at(-1)?.t, 'cancel');
    await receiver.drain();
    assert.equal(sink.discards(), 1, `${label} seq discards`);
  }
});

test('a chunk before consent is refused for arriving at all, wrong item or not', async () => {
  const a = await lonelyReceiver();
  a.receiver.receive(a.offer);
  a.receiver.receive({ v: 1, beamId: 'B1', t: 'chunk', itemIndex: 3, seq: 0, last: true });
  assert.equal(a.receiver.state.reason, 'unsolicited-bytes', 'before consent, arrival alone is the offence');
  assert.equal(a.sent.at(-1)?.t, 'cancel');

  const b = await lonelyReceiver();
  b.receiver.receive(b.offer);
  b.receiver.accept();
  b.receiver.receive({ v: 1, beamId: 'B1', t: 'chunk', itemIndex: 2, seq: 0, last: true });
  assert.equal(b.receiver.state.phase, 'cancelled');
  assert.equal(b.receiver.state.reason, 'bad-item', 'items arrive strictly in declared order');
});

test('an item cannot overflow the size the human accepted', async () => {
  const r = await lonelyReceiver();
  r.receiver.receive(r.offer);
  r.receiver.accept();
  r.receiver.receive({ v: 1, beamId: 'B1', t: 'chunk', itemIndex: 0, seq: 0, last: false });
  r.receiver.receiveBinary(bytesOf(600, 4));
  assert.equal(r.receiver.state.phase, 'receiving');
  r.receiver.receive({ v: 1, beamId: 'B1', t: 'chunk', itemIndex: 0, seq: 1, last: false });
  r.receiver.receiveBinary(bytesOf(600, 5)); // 1200 > the 1000 bytes item 0 declared

  assert.equal(r.receiver.state.phase, 'cancelled');
  assert.equal(r.receiver.state.reason, 'oversize-chunk');
  await r.receiver.drain();
  assert.equal(r.sink.discards(), 1);
});

test('an item that ends short of its declared size is a size-mismatch', async () => {
  const r = await lonelyReceiver();
  r.receiver.receive(r.offer);
  r.receiver.accept();
  r.receiver.receive({ v: 1, beamId: 'B1', t: 'chunk', itemIndex: 0, seq: 0, last: true });
  r.receiver.receiveBinary(bytesOf(999, 6)); // one short of 1000, and flagged `last`

  assert.equal(r.receiver.state.phase, 'cancelled');
  assert.equal(r.receiver.state.reason, 'size-mismatch');
});

test('item-done that disagrees with the offer is caught before the bytes are', async () => {
  const r = await lonelyReceiver();
  r.receiver.receive(r.offer);
  r.receiver.accept();
  r.receiver.receive({ v: 1, beamId: 'B1', t: 'chunk', itemIndex: 0, seq: 0, last: true });
  r.receiver.receiveBinary(BLOBS[0]!);
  r.receiver.receive({
    v: 1,
    beamId: 'B1',
    t: 'item-done',
    itemIndex: 0,
    checksum: await sriSha256(bytesOf(8, 99)),
  });

  assert.equal(r.receiver.state.phase, 'cancelled');
  assert.equal(r.receiver.state.reason, 'checksum-mismatch');
  assert.deepEqual(r.sink.finalized, [], 'a lying item-done never even seals staging');
  await r.receiver.drain();
  assert.equal(r.sink.discards(), 1);
});

test('corrupted bytes fail their checksum and the whole beam is discarded', async () => {
  const sink = memSink();
  const { sender, receiver } = await rig({
    sink,
    corrupt: (bytes, n) => {
      if (n !== 0) return bytes;
      const out = bytes.slice();
      out[0] = (out[0]! ^ 0xff) & 0xff;
      return out;
    },
  });
  sender.offer();
  receiver.accept();
  await pump(sender);
  await receiver.drain();

  assert.equal(receiver.state.phase, 'cancelled');
  assert.equal(receiver.state.reason, 'checksum-mismatch');
  assert.equal(sink.discards(), 1, 'nothing corrupt is left behind for an ingest to find');
});

test('an oversize or over-count offer is declined, not cancelled', async () => {
  const big = await lonelyReceiver({ maxTotalBytes: 100 });
  big.receiver.receive(big.offer);
  assert.equal(big.receiver.state.phase, 'declined');
  assert.equal(big.receiver.state.reason, 'too-large');
  assert.equal(big.sent.at(-1)?.t, 'decline');
  await big.receiver.drain();
  assert.equal(big.sink.discards(), 1);

  const many = await lonelyReceiver({ maxItems: 2 });
  many.receiver.receive(many.offer);
  assert.equal(many.receiver.state.reason, 'too-many-items');

  const wrongKind = await lonelyReceiver({ acceptKinds: ['session'] });
  wrongKind.receiver.receive(wrongKind.offer);
  assert.equal(wrongKind.receiver.state.reason, 'unsupported-kind');
});

test('an offer whose totals do not add up is a cancel, not a decline', async () => {
  const r = await lonelyReceiver();
  r.receiver.receive({ ...r.offer, totalBytes: r.offer.totalBytes + 1 });
  assert.equal(r.receiver.state.phase, 'cancelled');
  assert.equal(r.receiver.state.reason, 'bad-offer');
});

test('a second offer, or a complete with items outstanding, is a bad-message', async () => {
  const a = await lonelyReceiver();
  a.receiver.receive(a.offer);
  a.receiver.receive(a.offer);
  assert.equal(a.receiver.state.reason, 'bad-message');

  const b = await lonelyReceiver();
  b.receiver.receive(b.offer);
  b.receiver.accept();
  b.receiver.receive({ v: 1, beamId: 'B1', t: 'complete' });
  assert.equal(b.receiver.state.phase, 'cancelled');
  assert.equal(b.receiver.state.reason, 'bad-message');
});

test('frames for another beam are ignored, not treated as an attack', async () => {
  const r = await lonelyReceiver();
  r.receiver.receive(r.offer);
  r.receiver.accept();
  const before = r.sent.length;
  r.receiver.receive({ v: 1, beamId: 'OTHER', t: 'cancel', reason: 'user' });
  assert.equal(r.receiver.state.phase, 'receiving', 'one channel may carry more than one beam');
  assert.equal(r.sent.length, before);
});

// ── The parser ────────────────────────────────────────────────────────────────

test('parseBeamMessage is the single strict door', async () => {
  const items = await itemsFor([BLOBS[0]!]);
  const good = { v: 1, beamId: 'B1', t: 'offer', kind: 'assets', name: 'n', items, totalBytes: items[0]!.bytes };
  assert.equal(parseBeamMessage(good).ok, true);

  const cases: Array<[unknown, string]> = [
    [null, 'bad-message'],
    ['nope', 'bad-message'],
    [{ ...good, v: 2 }, 'protocol-version'],
    [{ ...good, v: '1' }, 'protocol-version'],
    [{ ...good, beamId: '' }, 'bad-message'],
    [{ ...good, beamId: 'x'.repeat(65) }, 'bad-message'],
    [{ v: 1, beamId: 'B1', t: 'nope' }, 'bad-message'],
    [{ ...good, kind: 'malware' }, 'bad-offer'],
    [{ ...good, name: '' }, 'bad-offer'],
    [{ ...good, name: 'x'.repeat(121) }, 'bad-offer'],
    [{ ...good, items: [] }, 'bad-offer'],
    [{ ...good, items: 'lots' }, 'bad-offer'],
    [{ ...good, items: [{ ...items[0]!, checksum: 'md5-abc' }] }, 'bad-offer'],
    [{ ...good, items: [{ ...items[0]!, bytes: -1 }], totalBytes: -1 }, 'bad-offer'],
    [{ ...good, items: [{ ...items[0]!, bytes: 1.5 }], totalBytes: 1.5 }, 'bad-offer'],
    [{ ...good, items: [items[0]!, items[0]!], totalBytes: items[0]!.bytes * 2 }, 'bad-offer'],
    [{ ...good, items: new Array(MAX_ITEMS + 1).fill(items[0]) }, 'too-many-items'],
    [{ ...good, totalBytes: 999999 }, 'bad-offer'],
    [{ v: 1, beamId: 'B1', t: 'chunk', itemIndex: -1, seq: 0, last: true }, 'bad-item'],
    [{ v: 1, beamId: 'B1', t: 'chunk', itemIndex: 0, seq: -1, last: true }, 'bad-sequence'],
    [{ v: 1, beamId: 'B1', t: 'chunk', itemIndex: 0, seq: 0, last: 'yes' }, 'bad-message'],
    [{ v: 1, beamId: 'B1', t: 'item-done', itemIndex: 0, checksum: 'nope' }, 'checksum-mismatch'],
  ];
  for (const [raw, reason] of cases) {
    const got = parseBeamMessage(raw);
    assert.equal(got.ok, false, `expected a refusal for ${JSON.stringify(raw)?.slice(0, 60)}`);
    assert.equal(got.ok === false && got.reason, reason, JSON.stringify(raw)?.slice(0, 60));
  }
});

test('a JSON control frame round-trips, and a huge one is refused before parsing', () => {
  const msg: BeamMessage = { v: 1, beamId: 'B1', t: 'cancel', reason: 'user' };
  const back = decodeBeamMessage(encodeBeamMessage(msg));
  assert.equal(back.ok, true);
  assert.deepEqual(back.ok && back.value, msg);

  assert.equal(decodeBeamMessage('{not json').ok, false);
  const huge = decodeBeamMessage(`"${'x'.repeat(MAX_MESSAGE_CHARS + 1)}"`);
  assert.equal(huge.ok, false);
  assert.equal(huge.ok === false && huge.reason, 'bad-message');
});

test('an unknown decline reason degrades to `user` rather than widening the type', () => {
  const got = parseBeamMessage({ v: 1, beamId: 'B1', t: 'decline', reason: '../../etc/passwd' });
  assert.equal(got.ok, true);
  assert.equal(got.ok && got.value.t === 'decline' && got.value.reason, 'user');
});

// ── Hashing seams ─────────────────────────────────────────────────────────────

test('a sink that returns its own digest replaces the buffering hasher entirely', async () => {
  const digests = new Map<number, string>();
  for (let i = 0; i < BLOBS.length; i++) digests.set(i, await sriSha256(BLOBS[i]!));
  const sink = memSink({ digest: (i) => digests.get(i) });
  const { sender, receiver } = await rig({ sink, hasher: null });

  sender.offer();
  receiver.accept();
  assert.equal((await pump(sender)).result, 'complete');
  await receiver.drain();

  assert.equal(receiver.state.phase, 'complete', 'verification ran off the sink digest');
  assert.equal(sink.discards(), 0);
});

test('with no hasher and no sink digest, verification fails closed', async () => {
  const sink = memSink();
  const { sender, receiver } = await rig({ sink, hasher: null });
  sender.offer();
  receiver.accept();
  await pump(sender);
  await receiver.drain();

  assert.equal(receiver.state.phase, 'cancelled');
  assert.equal(receiver.state.reason, 'sink-failure', 'unverifiable is never "verified"');
  assert.equal(sink.discards(), 1);
});

test('sriSha256 matches the catalog SRI form', async () => {
  // Known-answer: SHA-256 of the empty input, in the `sha256-<base64>` form
  // scripts/checksum-assets.ts writes and bridge/assets.ts compares against.
  assert.equal(await sriSha256(new Uint8Array(0)), 'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=');
  assert.equal(
    await sriSha256(new Uint8Array([0x61, 0x62, 0x63])),
    'sha256-ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=',
  );
});

// ── The wire is allowed to fail, and the machines are not ────────────────────

/** A wire whose writes throw the way a real `RTCDataChannel` does - closed channel
 *  and full send buffer both raise, and both are ordinary conditions. */
function deadWire(): BeamWire {
  return {
    json() {
      throw new Error('InvalidStateError: channel closed');
    },
    binary() {
      throw new Error('InvalidStateError: channel closed');
    },
  };
}

test('a receiver whose wire dies still latches terminal and still discards', async () => {
  // The section 11.18 latch used to run AFTER the cancel frame, so a wire that threw
  // skipped `end()` entirely: phase stayed `receiving`, `discard()` never fired,
  // and the receiver went on staging bytes from the peer it had just judged to be
  // violating the protocol.
  const items = await itemsFor([BLOBS[0]!]);
  const sink = memSink();
  let dead = false;
  const wire: BeamWire = {
    json(msg) {
      if (dead) throw new Error('InvalidStateError: channel closed');
      void msg;
    },
    binary() {
      throw new Error('a receiver never sends binary frames');
    },
  };
  const receiver = createBeamReceiver({ wire, sink: sink.sink });
  receiver.receive({ v: BEAM_PROTOCOL_VERSION, beamId: 'B1', t: 'offer', kind: 'assets', name: 'p', items, totalBytes: items[0]!.bytes });
  receiver.accept();
  assert.equal(receiver.state.phase, 'receiving');

  dead = true;
  // Out of phase, so this is a protocol violation → fail('bad-message'), whose
  // announcement now cannot take the state machine with it.
  receiver.receive({ v: BEAM_PROTOCOL_VERSION, beamId: 'B1', t: 'complete' });
  assert.equal(receiver.state.phase, 'cancelled', 'terminal, even though the wire refused the cancel');
  assert.equal(receiver.state.discarded, true);
  await receiver.drain();
  assert.equal(sink.discards(), 1, 'discarded exactly once');

  // And it is genuinely closed: further peer traffic stages nothing.
  receiver.receive({ v: BEAM_PROTOCOL_VERSION, beamId: 'B1', t: 'chunk', itemIndex: 0, seq: 0, last: true });
  receiver.receiveBinary(BLOBS[0]!);
  assert.equal(sink.writes.length, 0, 'not one byte from a peer already judged hostile');
  assert.equal(sink.discards(), 1, 'and the latch is still exactly once');
});

test('a queued verify that fails on a dead wire does not poison the staging chain', async () => {
  // The async twin of the case above: the checksum verify runs inside the queue, so
  // a throw there escaped the task, `enqueue`'s catch called `fail` which threw
  // again, and `chain` became a rejected promise - so the `chain.then(...)` that
  // `discardOnce` appends never ran, and the corrupt staged bytes stayed behind.
  const blob = BLOBS[0]!;
  const items = await itemsFor([blob]);
  const sink = memSink({ digest: () => 'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' });
  let dead = false;
  const wire: BeamWire = {
    json() {
      if (dead) throw new Error('InvalidStateError: channel closed');
    },
    binary() {
      throw new Error('a receiver never sends binary frames');
    },
  };
  const receiver = createBeamReceiver({ wire, sink: sink.sink, hasher: null });
  receiver.receive({ v: BEAM_PROTOCOL_VERSION, beamId: 'B1', t: 'offer', kind: 'assets', name: 'p', items, totalBytes: blob.length });
  receiver.accept();
  receiver.receive({ v: BEAM_PROTOCOL_VERSION, beamId: 'B1', t: 'chunk', itemIndex: 0, seq: 0, last: true });
  receiver.receiveBinary(blob);
  dead = true;
  receiver.receive({ v: BEAM_PROTOCOL_VERSION, beamId: 'B1', t: 'item-done', itemIndex: 0, checksum: items[0]!.checksum });

  await receiver.drain(); // must resolve, not reject
  assert.equal(receiver.state.phase, 'cancelled');
  assert.equal(receiver.state.reason, 'checksum-mismatch');
  assert.equal(sink.discards(), 1, 'the staged bytes are gone despite the wire failing mid-verify');
});

test('a chunk header is never left on the wire without its payload', async () => {
  // A chunk is two frames that must arrive as a pair. If the payload write throws
  // between them, `offset`/`seq` have not advanced, so the next pull re-emits the
  // SAME header - the receiver sees two headers with no payload between and kills
  // the beam, while the sender still believes it is sending. One transient
  // backpressure error would desynchronize the framing permanently.
  const blob = bytesOf(3000, 5);
  const items = await itemsFor([blob]);
  const sent: string[] = [];
  let throwOnce = false;
  const wire: BeamWire = {
    json(msg) {
      sent.push(`json:${msg.t}`);
    },
    binary() {
      if (throwOnce) {
        throwOnce = false;
        throw new Error('send queue full');
      }
      sent.push('binary');
    },
  };
  const sender = createBeamSender({
    offer: { beamId: 'B1', kind: 'assets', name: 'p', items },
    source: memSource([blob]),
    wire,
    chunkBytes: 1024,
  });
  sender.offer();
  sender.receive({ v: BEAM_PROTOCOL_VERSION, beamId: 'B1', t: 'accept' });

  assert.equal(await sender.nextChunk(), 'sent');
  throwOnce = true;
  const second = await sender.nextChunk(); // must not throw, must not leave a dangling header
  assert.equal(second, 'ended', 'a wire that refuses ends the beam rather than desynchronizing it');
  assert.equal(sender.state.phase, 'cancelled', 'and the sender KNOWS the transfer died');
  assert.equal(sender.state.reason, 'transport');

  // Exactly one header is unpaid, and no further frames follow it.
  const headers = sent.filter((s) => s === 'json:chunk').length;
  const payloads = sent.filter((s) => s === 'binary').length;
  assert.equal(headers, 2);
  assert.equal(payloads, 1);
  assert.equal(await sender.nextChunk(), 'ended', 'a dead sender does not re-emit the header');
  assert.equal(sent.filter((s) => s === 'json:chunk').length, 2, 'no third header');
});

test('a sender whose wire is dead from the start never throws out of its own API', async () => {
  const items = await itemsFor([BLOBS[0]!]);
  const sender = createBeamSender({
    offer: { beamId: 'B1', kind: 'assets', name: 'p', items },
    source: memSource([BLOBS[0]!]),
    wire: deadWire(),
  });
  sender.offer();
  assert.equal(sender.state.phase, 'cancelled');
  assert.equal(sender.state.reason, 'transport');
  assert.equal(await sender.nextChunk(), 'ended');
  sender.cancel(); // a cancel on a dead wire is still a no-throw
  sender.dispose();
});

test('a garbage frame addressed to ANOTHER beam does not kill this one', async () => {
  // Both machines decline to judge well-formed frames belonging to another beam.
  // The refusal path used to run before that check, so one malformed frame from a
  // second machine multiplexed on the same channel terminated a healthy transfer.
  const { sender, receiver, wires } = await rig();
  sender.offer();
  receiver.accept();
  assert.equal(await sender.nextChunk(), 'sent');

  sender.receive({ v: BEAM_PROTOCOL_VERSION, beamId: 'SOME-OTHER-BEAM', t: 'chunk', itemIndex: 'nope', seq: 0, last: true });
  assert.equal(sender.state.phase, 'sending', 'the sender ignored a frame it explicitly does not judge');
  receiver.receive({ v: BEAM_PROTOCOL_VERSION, beamId: 'SOME-OTHER-BEAM', t: 'item-done', itemIndex: 0, checksum: 'not-sri' });
  assert.equal(receiver.state.phase, 'receiving');

  // …and a malformed frame that IS ours still ends the beam, as it always did.
  sender.receive({ v: BEAM_PROTOCOL_VERSION, beamId: wires.toReceiver[0]?.beamId, t: 'chunk', itemIndex: 'nope', seq: 0, last: true });
  assert.equal(sender.state.phase, 'cancelled');
  assert.equal(sender.state.reason, 'bad-item');
});

test('a reused hasher digests what it was actually fed, not a zero-padded ghost', async () => {
  // `digest()` cleared `parts` but not `total`, so a second use built a buffer at
  // the FIRST item's length and zero-padded it. `BeamHasher` is exported for a
  // driver to hold, so "no internal caller reuses one" is not something this can
  // rely on - and a wrong digest here reads as `checksum-mismatch`, or worse
  // matches another zero-padded value.
  const h = sha256Hasher();
  h.update(new Uint8Array([1, 2, 3]));
  assert.equal(await h.digest(), await sriSha256(new Uint8Array([1, 2, 3])));
  h.update(new Uint8Array([4]));
  assert.equal(await h.digest(), await sriSha256(new Uint8Array([4])));
});
