// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createHistoryExchange, parseFrame, checksumEntries, bindHistoryExchange, toWireEntry,
  type HistoryFrame, type HistoryWireEntry, type HistoryRange,
} from './history-exchange.ts';
import { HISTORY_PROTOCOL_VERSION } from '../lib/collab-history.ts';
import type { CollabHistoryEntry, CollabHistoryPage } from '../lib/collab-history.ts';
import type { SavedStateData } from '../bridge/state.ts';

const entry = (revision: number, extra?: Partial<HistoryWireEntry>): HistoryWireEntry => ({
  id: `p2p:${revision}`, documentId: 'doc', toolId: 'design', label: `Revision ${revision}`,
  reason: 'checkpoint', actor: { id: 'peer' }, at: '2026-09-07T10:00:00.000Z', revision, ...extra,
});

/** Wire two exchanges so each one's `send` is the other's `handleFrame`, with per-side
 *  control over sharing, disclosure and the shared list. Ids are deterministic. */
function pair(opts: {
  aShares?: boolean; bShares?: boolean;
  aList?: HistoryWireEntry[]; bList?: HistoryWireEntry[];
  bAllowEarlier?: boolean;
  bPayloads?: Record<string, SavedStateData>;
}) {
  let n = 0;
  const newId = () => `req-${++n}`;
  const noTimer = { setTimer: () => 0, clearTimer: () => {} };
  const a = createHistoryExchange({
    documentId: 'doc', sharing: () => opts.aShares !== false, newId, ...noTimer,
    listShared: async () => opts.aList ?? [],
    send: f => b.handleFrame(f),
  });
  const b = createHistoryExchange({
    documentId: 'doc', sharing: () => opts.bShares !== false, newId, ...noTimer,
    listShared: async (range: HistoryRange) => (range === 'all' ? (opts.bList ?? []) : (opts.bList ?? []).filter(e => e.reason !== 'save')),
    readShared: async (id: string) => opts.bPayloads?.[id] ?? null,
    allowEarlier: () => opts.bAllowEarlier === true,
    send: f => a.handleFrame(f),
  });
  return { a, b };
}

test('a requester receives the peer disclosure-filtered revision list', async () => {
  const { a } = pair({ bList: [entry(2), entry(1)] });
  const list = await a.requestList('session');
  assert.deepEqual(list.map(e => e.revision), [2, 1]);
});

test('shared history is refused when the handshake did not agree', async () => {
  // Local side never even sends: a request rejects as unavailable.
  const offline = pair({ aShares: false });
  await assert.rejects(offline.a.requestList(), /not available/);

  // Peer received the request but is not sharing: it answers with a not-shared error.
  const peerOff = pair({ bShares: false });
  await assert.rejects(peerOff.a.requestList(), (e: Error) => (e as { code?: string }).code === 'not-shared');
});

test('earlier revisions are forbidden without an explicit host grant', async () => {
  const denied = pair({ bList: [entry(1)] });
  await assert.rejects(denied.a.requestList('all'), (e: Error) => (e as { code?: string }).code === 'forbidden');

  const granted = pair({ bList: [entry(1, { reason: 'save' }), entry(2)], bAllowEarlier: true });
  const all = await granted.a.requestList('all');
  assert.equal(all.length, 2, 'the host grant discloses earlier revisions too');
});

test('the default session disclosure narrows what the responder returns', async () => {
  // b.listShared drops 'save' rows for the 'session' range in this harness.
  const { a } = pair({ bList: [entry(1, { reason: 'save' }), entry(2, { reason: 'checkpoint' })] });
  const list = await a.requestList('session');
  assert.deepEqual(list.map(e => e.revision), [2]);
});

test('a payload transfers in chunks, hash-verified, and decodes back to the exact state', async () => {
  const small: SavedStateData = { title: 'hello', n: 42 };
  const big: SavedStateData = { blob: 'x'.repeat(40_000) }; // > one 16 KiB chunk: multi-chunk path
  const { a } = pair({ bPayloads: { 'p2p:1': small, 'p2p:2': big } });
  assert.deepEqual(await a.requestPayload('p2p:1'), small);
  assert.deepEqual(await a.requestPayload('p2p:2'), big);
});

test('a withheld or unknown revision is refused, not returned empty', async () => {
  const { a } = pair({ bPayloads: { 'p2p:1': { title: 'x' } } });
  await assert.rejects(a.requestPayload('p2p:missing'), (e: Error) => (e as { code?: string }).code === 'forbidden');
  const off = pair({ bShares: false, bPayloads: { 'p2p:1': { title: 'x' } } });
  await assert.rejects(off.a.requestPayload('p2p:1'), (e: Error) => (e as { code?: string }).code === 'not-shared');
});

test('a corrupted payload chunk fails its checksum and rejects', async () => {
  let n = 0;
  const noTimer = { setTimer: () => 0, clearTimer: () => {} };
  const payload: SavedStateData = { title: 'trustworthy' };
  // b -> a is tampered: flip one character of the first chunk's base64 data in flight.
  const a = createHistoryExchange({
    documentId: 'doc', sharing: () => true, newId: () => `req-${++n}`, ...noTimer,
    listShared: async () => [], send: f => b.handleFrame(f),
  });
  const b = createHistoryExchange({
    documentId: 'doc', sharing: () => true, ...noTimer, listShared: async () => [],
    readShared: async () => payload,
    send: (f: HistoryFrame) => {
      if (f.t === 'blob-chunk') { const bad = f.data.slice(0, -2) + (f.data.endsWith('AA') ? 'BB' : 'AA'); a.handleFrame({ ...f, data: bad }); return; }
      a.handleFrame(f);
    },
  });
  await assert.rejects(a.requestPayload('p2p:1'), (e: Error) => (e as { code?: string }).code === 'corrupt');
});

test('disposing abandons an in-flight payload request', async () => {
  const a = createHistoryExchange({
    documentId: 'doc', sharing: () => true, setTimer: () => 0, clearTimer: () => {},
    listShared: async () => [], send: () => {}, // the peer never answers
  });
  const inflight = a.requestPayload('p2p:1');
  a.dispose();
  await assert.rejects(inflight, (e: Error) => (e as { code?: string }).code === 'disposed');
});

test('a corrupted list is rejected, not accepted', async () => {
  const good = [entry(1)];
  const forged: HistoryFrame = { p: HISTORY_PROTOCOL_VERSION, t: 'list-res', id: 'x', entries: good, complete: true, checksum: 'deadbeef' };
  let rejected: unknown;
  const ex = createHistoryExchange({
    documentId: 'doc', sharing: () => true, listShared: async () => [],
    newId: () => 'x', setTimer: () => 0, clearTimer: () => {},
    // Reply to our own request with a checksum that does not match the entries.
    send: () => ex.handleFrame(forged),
  });
  await ex.requestList().catch(e => { rejected = e; });
  assert.equal((rejected as { code?: string })?.code, 'corrupt');
});

test('a response to an unknown or already-settled id is ignored', () => {
  const ex = createHistoryExchange({ documentId: 'doc', sharing: () => true, listShared: async () => [], send: () => {} });
  // No throw: a stale/forged response with no waiting request is simply dropped.
  ex.handleFrame({ p: HISTORY_PROTOCOL_VERSION, t: 'list-res', id: 'never', entries: [], complete: true, checksum: checksumEntries([]) });
  ex.handleFrame({ p: HISTORY_PROTOCOL_VERSION, t: 'err', id: 'never', code: 'forbidden' });
});

test('dispose abandons every in-flight request', async () => {
  const ex = createHistoryExchange({
    documentId: 'doc', sharing: () => true, listShared: async () => [],
    setTimer: () => 0, clearTimer: () => {}, send: () => {}, // the peer never answers
  });
  const inflight = ex.requestList();
  ex.dispose();
  await assert.rejects(inflight, (e: Error) => (e as { code?: string }).code === 'disposed');
  await assert.rejects(ex.requestList(), (e: Error) => (e as { code?: string }).code === 'disposed');
});

test('parseFrame drops non-history, malformed, and over-typed frames', () => {
  assert.equal(parseFrame({ v: 1, t: 'accept', beamId: 'b1' }), null, 'a beam frame is not a history frame');
  assert.equal(parseFrame({ p: HISTORY_PROTOCOL_VERSION, t: 'list-req', id: 'r', documentId: 'doc', range: 'everything' }), null, 'an unknown range is refused');
  assert.equal(parseFrame({ p: HISTORY_PROTOCOL_VERSION, t: 'list-req', id: 'r', documentId: 'doc', range: 'session' })?.t, 'list-req');
  assert.equal(parseFrame({ p: HISTORY_PROTOCOL_VERSION, t: 'err', id: 'r', code: 'made-up' }), null, 'an unknown error code is refused');
  // A list-res with one malformed entry is refused whole.
  const oneBad = { p: HISTORY_PROTOCOL_VERSION, t: 'list-res', id: 'r', complete: true, checksum: 'x', entries: [entry(1), { id: 'bad' }] };
  assert.equal(parseFrame(oneBad), null);
});

test('toWireEntry drops the preview blob but keeps every metadata field', () => {
  const full: CollabHistoryEntry = { ...entry(3), preview: 'data:image/png;base64,AAAA' };
  const wire = toWireEntry(full);
  assert.equal((wire as { preview?: unknown }).preview, undefined);
  assert.equal(wire.revision, 3);
  assert.equal(wire.label, 'Revision 3');
});

test('two bound exchanges round-trip a real history list over a shared lane', async () => {
  // A tiny in-memory lane: one side's sendJson is the other's onJson.
  const listeners: Record<'a' | 'b', ((json: unknown) => void) | null> = { a: null, b: null };
  const page = (entries: HistoryWireEntry[]): Promise<CollabHistoryPage> => Promise.resolve({ entries });
  const a = bindHistoryExchange({
    documentId: 'doc', sharing: () => true, history: { list: () => page([]), read: async () => null },
    sendJson: f => listeners.b?.(f), onJson: fn => { listeners.a = fn; return () => { listeners.a = null; }; },
  });
  const b = bindHistoryExchange({
    documentId: 'doc', sharing: () => true, history: { list: () => page([entry(2), entry(1)]), read: async () => ({ title: 'v2' }) },
    sendJson: f => listeners.a?.(f), onJson: fn => { listeners.b = fn; return () => { listeners.b = null; }; },
  });
  const list = await a.requestList('session');
  assert.deepEqual(list.map(e => e.revision), [2, 1]);

  // A beam-transfer frame on the same lane is ignored by the exchange, not a crash.
  listeners.a?.({ v: 1, t: 'offer', beamId: 'b1' });

  // After dispose the lane is unsubscribed: a late frame reaches nothing.
  a.dispose(); b.dispose();
  assert.equal(listeners.a, null, 'dispose tears down the inbound subscription');
  assert.equal(listeners.b, null);
});

test('a huge id or entry list is refused by the bounds', () => {
  assert.equal(parseFrame({ p: HISTORY_PROTOCOL_VERSION, t: 'list-req', id: 'x'.repeat(200), documentId: 'doc', range: 'session' }), null);
  const many = Array.from({ length: 501 }, (_, i) => entry(i));
  assert.equal(parseFrame({ p: HISTORY_PROTOCOL_VERSION, t: 'list-res', id: 'r', entries: many, complete: true, checksum: 'x' }), null);
});
