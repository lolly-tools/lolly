// SPDX-License-Identifier: MPL-2.0
/**
 * Tests for audio-peaks.ts - the measured overview waveform cache behind the
 * audio thumbnails in the asset picker and catalog.
 *
 * WHAT IS COVERED HERE (the real module, a fake store and a fake host - no mock
 * theatre): the byte round-trip and its precision; the validation that rejects a
 * short/corrupt/wrong-bucket row instead of drawing half a waveform as a whole
 * one; `cachedPeaks` as a pure read that never reaches a decoder; `derivePeaks`
 * deduping a grid of tiles down to one decode, capping concurrency, refusing an
 * over-long clip, and returning null (never throwing) for every failure - 
 * including a host with no `audio` at all; and `storePeaks` filling the cache
 * from the ingest path.
 *
 * WHAT IS **NOT** COVERED - browser-only, and a fake would prove nothing: the
 * actual decode (`OfflineAudioContext.decodeAudioData`) and the engine's
 * `analysePcm`, which have their own coverage; the IndexedDB-backed PeaksStore
 * (node has no indexedDB - the degraded "no database" path IS covered, since
 * that is what node produces here).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PEAK_BUCKETS,
  MAX_PEAK_DURATION_MS,
  MAX_CONCURRENT_DERIVES,
  cachedPeaks,
  derivePeaks,
  storePeaks,
  deletePeaks,
  peaksCacheSize,
  encodePeaks,
  decodePeaks,
  readRecord,
  resetPeaksCache,
  setPeaksStore,
  type PeaksRecord,
  type PeaksStore,
} from './audio-peaks.ts';

// ── fakes (state holders, not behaviour stand-ins) ──────────────────────────

interface FakeStore extends PeaksStore {
  rows: Map<string, PeaksRecord>;
  gets: number;
  puts: number;
}

function fakeStore(opts: { failGet?: boolean; failPut?: boolean } = {}): FakeStore {
  const rows = new Map<string, PeaksRecord>();
  const s: FakeStore = {
    rows, gets: 0, puts: 0,
    async get(id) {
      s.gets++;
      if (opts.failGet) throw new Error('idb read exploded');
      return rows.get(id);
    },
    async put(rec) {
      s.puts++;
      if (opts.failPut) throw new Error('idb write exploded');
      rows.set(rec.id, rec);
    },
    async delete(id) { rows.delete(id); },
    async all() { return [...rows.values()]; },
  };
  return s;
}

interface FakeHost {
  audio: {
    isAvailable(): boolean;
    analyse(src: unknown, opts?: unknown): Promise<{ peaks: Float32Array; duration: number }>;
  };
  calls: number;
  lastOpts: Record<string, unknown> | undefined;
  /** Peak concurrent analyse() calls seen - the concurrency cap's witness. */
  peakConcurrency: number;
}

function fakeHost(cfg: { throws?: boolean; gate?: Promise<void>; empty?: boolean } = {}): FakeHost {
  let live = 0;
  const h: FakeHost = {
    calls: 0, lastOpts: undefined, peakConcurrency: 0,
    audio: {
      isAvailable: () => true,
      async analyse(_src, opts) {
        h.calls++;
        h.lastOpts = opts as Record<string, unknown>;
        live++;
        h.peakConcurrency = Math.max(h.peakConcurrency, live);
        try {
          if (cfg.gate) await cfg.gate;
          if (cfg.throws) throw new Error('no codec for this container');
          const peaks = new Float32Array(PEAK_BUCKETS);
          if (!cfg.empty) for (let i = 0; i < PEAK_BUCKETS; i++) peaks[i] = (i % 8) / 7;
          return { peaks: cfg.empty ? new Float32Array(0) : peaks, duration: 12.5 };
        } finally {
          live--;
        }
      },
    },
  };
  return h;
}

const refOf = (id: string, meta?: Record<string, unknown>): Record<string, unknown> => ({
  source: 'library', id, type: 'audio', format: 'mp3', url: `https://x/${id}.mp3`, ...(meta ? { meta } : {}),
});

function reset(store: FakeStore | null): void {
  setPeaksStore(store);
  resetPeaksCache();
}

// ── encode / decode ─────────────────────────────────────────────────────────

test('encodePeaks/decodePeaks: a byte per bucket round-trips within thumbnail precision', () => {
  const src = new Float32Array(PEAK_BUCKETS);
  for (let i = 0; i < PEAK_BUCKETS; i++) src[i] = i / (PEAK_BUCKETS - 1);
  const back = decodePeaks(encodePeaks(src));
  assert.equal(back.length, PEAK_BUCKETS);
  for (let i = 0; i < PEAK_BUCKETS; i++) {
    // 1/255 is finer than one pixel of bar height in any thumbnail we draw.
    assert.ok(Math.abs(back[i]! - src[i]!) <= 1 / 255 + 1e-6, `bucket ${i}`);
  }
});

test('encodePeaks: out-of-range and non-finite values are clamped, never stored raw', () => {
  const bytes = encodePeaks([2, -1, Number.NaN, 0.5]);
  assert.equal(bytes.length, PEAK_BUCKETS);
  assert.equal(bytes[0], 255);
  assert.ok(bytes.every((b) => b >= 0 && b <= 255));
});

test('encodePeaks: a producer that returned the wrong count is resampled, not truncated', () => {
  // A short input clipped to the front would draw the first seconds of a track
  // across the whole tile - a false claim about the sound.
  const src = new Float32Array(16);
  src[15] = 1;
  const back = decodePeaks(encodePeaks(src));
  assert.equal(back.length, PEAK_BUCKETS);
  assert.equal(back[PEAK_BUCKETS - 1], 1, 'the end of the source is still the end of the thumbnail');
});

// ── record validation ───────────────────────────────────────────────────────

test('readRecord: a healthy row reads back', () => {
  const rec: PeaksRecord = {
    id: 'a', peaks: encodePeaks([1, 0.5]), buckets: PEAK_BUCKETS, durationMs: 1000, at: Date.now(),
  };
  const out = readRecord(rec);
  assert.ok(out);
  assert.equal(out.peaks.length, PEAK_BUCKETS);
  assert.equal(out.durationMs, 1000);
});

test('readRecord: corrupt, short or wrong-sized rows are REJECTED, not repaired', () => {
  const ok = { id: 'a', peaks: encodePeaks([1]), buckets: PEAK_BUCKETS, durationMs: 10, at: 1 };
  for (const bad of [
    null,
    undefined,
    'nonsense',
    { ...ok, peaks: new Uint8Array(PEAK_BUCKETS - 1) },
    { ...ok, peaks: new Uint8Array(0) },
    { ...ok, peaks: undefined },
    { ...ok, buckets: PEAK_BUCKETS + 1 },
    { ...ok, durationMs: Number.NaN },
    { ...ok, durationMs: -5 },
  ]) {
    assert.equal(readRecord(bad), null, JSON.stringify(bad?.constructor?.name ?? String(bad)));
  }
});

test('readRecord: a row whose bytes came back as an ArrayBuffer or array still reads', () => {
  // Structured clone across builds/browsers does not always hand back the exact
  // view that went in; normalising beats losing a measurement we already paid for.
  const bytes = encodePeaks([0.25]);
  assert.ok(readRecord({ id: 'a', peaks: bytes.buffer, buckets: PEAK_BUCKETS, durationMs: 1, at: 1 }));
  assert.ok(readRecord({ id: 'a', peaks: [...bytes], buckets: PEAK_BUCKETS, durationMs: 1, at: 1 }));
});

// ── cachedPeaks ─────────────────────────────────────────────────────────────

test('cachedPeaks: a miss returns null WITHOUT decoding anything', async () => {
  const store = fakeStore();
  reset(store);
  const host = fakeHost();
  assert.equal(await cachedPeaks('never/seen'), null);
  assert.equal(host.calls, 0, 'a pure read must never reach a decoder');
  assert.equal(store.gets, 1);
});

test('cachedPeaks: a stored measurement round-trips through the store', async () => {
  const store = fakeStore();
  reset(store);
  const src = new Float32Array(PEAK_BUCKETS).fill(0.5);
  await storePeaks('suse/music/1', src, 90_000);

  reset(store); // drop the in-memory memo; force the read to go to the store
  const got = await cachedPeaks('suse/music/1');
  assert.ok(got);
  assert.equal(got.durationMs, 90_000);
  assert.equal(got.peaks.length, PEAK_BUCKETS);
  assert.ok(Math.abs(got.peaks[0]! - 0.5) < 0.01);
});

test('cachedPeaks: the second read is memoised - a scrolling grid does not re-query', async () => {
  const store = fakeStore();
  reset(store);
  await storePeaks('a', new Float32Array(PEAK_BUCKETS).fill(1), 1000);
  reset(store);
  await cachedPeaks('a');
  const after = store.gets;
  await cachedPeaks('a');
  assert.equal(store.gets, after);
});

test('cachedPeaks: a broken store reads as "no peaks", never a throw', async () => {
  reset(fakeStore({ failGet: true }));
  assert.equal(await cachedPeaks('a'), null);
});

test('cachedPeaks: with no database at all it resolves null', async () => {
  // setPeaksStore(null) restores the REAL IndexedDB-backed store, which cannot
  // open under node - the genuine degraded environment, not a fake.
  reset(null);
  assert.equal(await cachedPeaks('a'), null);
});

// ── storePeaks ──────────────────────────────────────────────────────────────

test('storePeaks: writes one compact row and answers the next read', async () => {
  const store = fakeStore();
  reset(store);
  await storePeaks('user/upload/1-song.mp3', new Float32Array(PEAK_BUCKETS).fill(0.8), 4321);
  const rec = store.rows.get('user/upload/1-song.mp3');
  assert.ok(rec);
  assert.equal(rec.peaks.length, PEAK_BUCKETS);
  assert.equal(rec.buckets, PEAK_BUCKETS);
  assert.equal(rec.durationMs, 4321);
  assert.ok(rec.at > 0);
  assert.equal(await peaksCacheSize(), PEAK_BUCKETS);
});

test('storePeaks: a failing write still leaves the session with its peaks', async () => {
  const store = fakeStore({ failPut: true });
  reset(store);
  await storePeaks('a', new Float32Array(PEAK_BUCKETS).fill(1), 100);
  assert.equal(store.rows.size, 0);
  assert.ok(await cachedPeaks('a'), 'unstored is still memoised');
});

test('storePeaks: nonsense arguments are refused before the store is opened', async () => {
  const store = fakeStore();
  reset(store);
  await storePeaks('', new Float32Array(PEAK_BUCKETS), 1);
  await storePeaks('a', new Float32Array(0), 1);
  assert.equal(store.puts, 0);
});

test('deletePeaks: the row and the memo both go', async () => {
  const store = fakeStore();
  reset(store);
  await storePeaks('a', new Float32Array(PEAK_BUCKETS).fill(1), 10);
  await deletePeaks('a');
  assert.equal(store.rows.size, 0);
  assert.equal(await cachedPeaks('a'), null);
});

// ── derivePeaks ─────────────────────────────────────────────────────────────

test('derivePeaks: measures, stores, and asks only for the overview', async () => {
  const store = fakeStore();
  reset(store);
  const host = fakeHost();

  const out = await derivePeaks(host, refOf('suse/music/a'), 'suse/music/a');
  assert.ok(out);
  assert.equal(out.peaks.length, PEAK_BUCKETS);
  assert.equal(out.durationMs, 12_500, 'the MEASURED duration wins');
  assert.equal(host.calls, 1);
  assert.deepEqual(host.lastOpts, { fps: 1, bands: 4, buckets: PEAK_BUCKETS });
  assert.ok(store.rows.has('suse/music/a'), 'and it is cached for the next mount');
});

test('derivePeaks: a whole grid mounting at once causes ONE decode per asset', async () => {
  const store = fakeStore();
  reset(store);
  const host = fakeHost();

  const all = await Promise.all(
    Array.from({ length: 52 }, () => derivePeaks(host, refOf('suse/music/a'), 'suse/music/a')),
  );
  assert.equal(host.calls, 1, '52 tiles must not start 52 decodes of the same clip');
  assert.ok(all.every((r) => r && r.peaks.length === PEAK_BUCKETS), 'and everyone gets the answer');
});

test('derivePeaks: a cached asset never reaches the decoder again', async () => {
  const store = fakeStore();
  reset(store);
  const host = fakeHost();

  await derivePeaks(host, refOf('a'), 'a');
  reset(store);                       // new session, same database
  await derivePeaks(host, refOf('a'), 'a');
  assert.equal(host.calls, 1, 'the stored row short-circuits the decode');
});

test('derivePeaks: decodes are capped, so a grid cannot hold every file in memory at once', async () => {
  const store = fakeStore();
  reset(store);
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => { release = r; });
  const host = fakeHost({ gate });

  const all = Promise.all(
    Array.from({ length: 8 }, (_, i) => derivePeaks(host, refOf(`a${i}`), `a${i}`)),
  );
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(host.peakConcurrency, MAX_CONCURRENT_DERIVES);
  release();
  await all;
  assert.equal(host.calls, 8, 'and the rest ran, in turn');
  assert.equal(host.peakConcurrency, MAX_CONCURRENT_DERIVES, 'never above the cap at any point');
});

test('derivePeaks: a host with no audio API returns null instead of throwing', async () => {
  reset(fakeStore());
  assert.equal(await derivePeaks({}, refOf('a'), 'a'), null);
  assert.equal(await derivePeaks(null, refOf('a'), 'a'), null);
  assert.equal(await derivePeaks({ audio: { isAvailable: () => false, analyse: async () => ({}) } }, refOf('b'), 'b'), null);
});

test('derivePeaks: a decode failure is null, and is not retried on the next scroll', async () => {
  reset(fakeStore());
  const host = fakeHost({ throws: true });
  assert.equal(await derivePeaks(host, refOf('a'), 'a'), null);
  assert.equal(await derivePeaks(host, refOf('a'), 'a'), null);
  assert.equal(host.calls, 1, 'a missing codec will not appear on the next scroll');
});

test('derivePeaks: an analysis with no peaks is null - never a manufactured shape', async () => {
  reset(fakeStore());
  const host = fakeHost({ empty: true });
  assert.equal(await derivePeaks(host, refOf('a'), 'a'), null,
    'the honest answer is "no waveform", and the caller draws a glyph');
});

test('derivePeaks: a clip past the duration ceiling is refused without decoding', async () => {
  reset(fakeStore());
  const host = fakeHost();
  const long = refOf('podcast', { durationMs: MAX_PEAK_DURATION_MS + 1 });
  assert.equal(await derivePeaks(host, long, 'podcast'), null);
  assert.equal(host.calls, 0, 'decodeAudioData would expand a long recording to hundreds of MB of PCM');

  const ok = refOf('song', { durationMs: MAX_PEAK_DURATION_MS - 1 });
  assert.ok(await derivePeaks(host, ok, 'song'));
});

test('derivePeaks: an undeclared duration falls back to the analysed one', async () => {
  reset(fakeStore());
  const out = await derivePeaks(fakeHost(), refOf('a'), 'a');
  assert.equal(out?.durationMs, 12_500);
});

test('derivePeaks: missing arguments resolve null without touching the host', async () => {
  reset(fakeStore());
  const host = fakeHost();
  assert.equal(await derivePeaks(host, refOf('a'), ''), null);
  assert.equal(await derivePeaks(host, null, 'a'), null);
  assert.equal(host.calls, 0);
});

test('derivePeaks: with no database it still measures and answers (nothing stored)', async () => {
  reset(null);
  const host = fakeHost();
  const out = await derivePeaks(host, refOf('a'), 'a');
  assert.ok(out);
  assert.equal(host.calls, 1);
  reset(null);
});
