// SPDX-License-Identifier: MPL-2.0
/**
 * audio-peaks.ts - the MEASURED overview waveform of an audio asset, cached.
 *
 * THE PROBLEM. The asset picker picks a thumbnail by type: lottie → a lottie
 * frame, video → a poster frame, everything else → `<img src=ref.url>`. For an
 * audio asset that is an `<img>` pointing at an .mp3, which cannot load, so the
 * tile renders the browser's broken-image icon. It bites hardest where the
 * catalog is mostly audio (the `lolly-start` profile is 20 audio assets out of
 * 23; SUSE has 52).
 *
 * WHAT THIS MODULE IS. The data half of the fix: `peaks` - `PEAK_BUCKETS`
 * amplitudes, 0..1 - for an asset, read from IndexedDB if we have measured them
 * before and derived through `host.audio.analyse` if we have not. The drawing
 * half is lib/audio-thumb.ts.
 *
 * THE HONESTY RULE, WHICH IS THE WHOLE POINT. A waveform is a claim about a
 * sound. Nothing here ever manufactures one: there is no id hash, no synthetic
 * envelope, no "plausible" fallback shape. Every path that cannot MEASURE a
 * clip returns `null`, and the caller draws a glyph that claims nothing. A hash
 * may choose which visual FORM an asset gets; it must never choose the data.
 *
 * WHY A BYTE PER BUCKET. Peaks are already normalised 0..1 and are drawn into a
 * thumbnail a few dozen pixels tall, where 1/255 is far finer than one pixel of
 * bar height - so a `Uint8Array` is visually identical to the `Float32Array`
 * `host.audio` hands back at a quarter of the bytes (~128 vs ~512 per asset).
 * At 52 assets that is 6.6 kB of database instead of 26 kB, and it survives
 * structured-clone into IndexedDB exactly as well.
 *
 * DECODING IS THE EXPENSIVE PART, SO IT IS RATIONED. Deriving peaks means
 * decoding the whole file to PCM. Three guards keep a grid of tiles from turning
 * that into a stall or an OOM:
 *   • one in-flight derive per asset id (a 52-tile grid mounting at once shares
 *     one decode per asset, and a re-render mid-decode joins it rather than
 *     starting a second);
 *   • at most `MAX_CONCURRENT_DERIVES` decodes across all ids;
 *   • a duration ceiling, because `decodeAudioData` expands audio to Float32 PCM
 * - a 20-minute stereo 48 kHz recording is ~460 MB of RAM to learn 128
 *     numbers, which is a tab crash on a phone.
 * A failure is remembered too: a codec this browser lacks must not be re-attempted
 * on every scroll.
 *
 * NEVER THROWS. Every entry point resolves - `null`, or nothing at all. These are
 * called from render paths; a missing waveform is a glyph, never an error.
 */

// ── shape + tunables ────────────────────────────────────────────────────────

/** What a caller gets back: measured peaks and the clip's measured length. */
export interface PeaksResult {
  peaks: Float32Array;
  durationMs: number;
}

/**
 * Buckets stored per asset.
 *
 * 128 is `host.audio`'s own default and a power of two, so every thumbnail form
 * that wants fewer columns (a 32- or 64-bar chart) downsamples by an exact
 * integer stride instead of resampling and smearing the peaks.
 */
export const PEAK_BUCKETS = 128;

/**
 * Longest clip we will decode to derive peaks from.
 *
 * `decodeAudioData` materialises the ENTIRE file as Float32 PCM before anything
 * can be measured: stereo 48 kHz costs ~23 MB per minute. Catalog music and
 * uploaded stings are minutes long; a lecture recording or a podcast is not, and
 * decoding one to draw a 100 px thumbnail would be a memory spike far out of
 * proportion to the pixels. Over the ceiling we return null and the tile keeps
 * its honest glyph. (`durationMs` is only known when the asset carries it in
 * `meta` - an asset with no declared duration is attempted, since almost
 * everything with a duration to declare is short.)
 */
export const MAX_PEAK_DURATION_MS = 8 * 60 * 1000;

/**
 * Decodes allowed at once, across all assets.
 *
 * Each one holds a whole decoded file in memory and posts its channels to the
 * analysis worker, so this is a memory ceiling more than a CPU one. Two keeps a
 * grid filling in visibly (a stalled decode does not block the next asset) while
 * never holding more than two decoded files at a time.
 */
export const MAX_CONCURRENT_DERIVES = 2;

/**
 * In-memory rows. Tiny (a Float32Array of 128 plus a number), and this is a
 * scroll path - bounded only so a very long session cannot grow it without end.
 */
const MEMO_MAX = 400;

/** The IDB store this module owns. Created at DB_VERSION 9 (bridge/db.ts). */
export const PEAKS_STORE = 'audio-peaks';

/** What an `audio-peaks` row holds. `buckets` is the invalidation fingerprint. */
export interface PeaksRecord {
  id: string;
  /** One byte per bucket, `value * 255` rounded. See the header for why. */
  peaks: Uint8Array;
  /** Length of `peaks`. A row written at a different PEAK_BUCKETS is rejected. */
  buckets: number;
  /**
   * The source's content fingerprint (version + checksum) when it was measured.
   *
   * An asset ID is a PERMANENT CONTRACT - `suse/music/x` is never renamed or reused - 
   * but its BYTES can be replaced under that id at an unversioned url, and every
   * catalog asset carries a `version` and a per-format `checksum` for exactly this
   * reason. Without recording it, a re-mastered track keeps rendering the waveform of
   * the audio it replaced, forever, and the picture quietly stops describing the sound.
   * Absent on rows written before this existed - treated as "unknown", not as a
   * mismatch, so an upgrade re-measures lazily instead of dropping every cached row.
   */
  fp?: string;
  durationMs: number;
  /** When this was measured (epoch ms) - diagnostics and future eviction. */
  at: number;
}

// ── the storage seam ────────────────────────────────────────────────────────

/**
 * The operations this module needs from IndexedDB.
 *
 * A seam, not a second storage abstraction - the default implementation is the
 * ONE shared `openDB()` connection from bridge/db.ts, like every other derived
 * store in this shell. (No sibling module is named here on purpose: the timeline's
 * scrub-proxy guard fails any file outside its allowlist that so much as mentions
 * one of its symbols, and this module has nothing to do with those proxies.) It
 * exists so the headless tests exercise the real
 * read/write/validate logic without an IndexedDB, and so a browser with a wedged
 * database degrades to "no cached peaks" instead of throwing on import.
 */
export interface PeaksStore {
  get(id: string): Promise<PeaksRecord | undefined>;
  put(rec: PeaksRecord): Promise<void>;
  delete(id: string): Promise<void>;
  all(): Promise<PeaksRecord[]>;
}

let storeOverride: PeaksStore | null = null;
let realStore: Promise<PeaksStore | null> | null = null;

/** Inject a store (tests). Passing `null` restores the IndexedDB-backed one. */
export function setPeaksStore(store: PeaksStore | null): void {
  storeOverride = store;
  realStore = null;
}

async function openPeaksStore(): Promise<PeaksStore | null> {
  if (storeOverride) return storeOverride;
  if (!realStore) {
    realStore = (async (): Promise<PeaksStore | null> => {
      try {
        // Dynamic on purpose: keeps `idb` (and the whole bridge) off this
        // module's static import graph, so the pure logic above stays importable
        // in a plain node test run.
        const { openDB } = await import('../bridge/db.ts');
        const db = await openDB();
        if (!db.objectStoreNames.contains(PEAKS_STORE)) return null;
        return {
          get: (id) => db.get(PEAKS_STORE, id) as Promise<PeaksRecord | undefined>,
          put: async (rec) => { await db.put(PEAKS_STORE, rec); },
          delete: async (id) => { await db.delete(PEAKS_STORE, id); },
          all: () => db.getAll(PEAKS_STORE) as Promise<PeaksRecord[]>,
        };
      } catch {
        return null; // no DB → no cached peaks, and nothing else changes
      }
    })();
  }
  return realStore;
}

// ── encode / decode / validate ──────────────────────────────────────────────

/** Peaks (0..1) → one byte per bucket. Out-of-range values are clamped, not trusted. */
export function encodePeaks(peaks: Float32Array | number[]): Uint8Array {
  const out = new Uint8Array(PEAK_BUCKETS);
  const n = peaks.length;
  if (n === 0) return out;
  for (let i = 0; i < PEAK_BUCKETS; i++) {
    // Resample by nearest source bucket so a producer that returned a different
    // count than we asked for still stores something faithful rather than a
    // truncated clip of the front of the track.
    const v = Number(peaks[n === PEAK_BUCKETS ? i : Math.min(n - 1, Math.floor((i * n) / PEAK_BUCKETS))]);
    out[i] = Number.isFinite(v) ? Math.max(0, Math.min(255, Math.round(v * 255))) : 0;
  }
  return out;
}

/** Bytes → peaks (0..1). */
export function decodePeaks(bytes: Uint8Array): Float32Array {
  const out = new Float32Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[i]! / 255;
  return out;
}

/**
 * Is a stored row usable?
 *
 * A row is rejected - not repaired - when it is short, the wrong bucket count, or
 * carries a nonsense duration. Half a waveform drawn as a whole one is a false
 * claim about the sound, and re-deriving costs one decode; guessing costs
 * credibility. Structured clone can also hand back an ArrayBuffer or a plain
 * array from a row written by another build, so the byte view is normalised here
 * rather than assumed.
 */
/**
 * The content fingerprint of an asset ref - its `version` plus the checksum of the
 * format actually served. '' when the ref declares neither (a user upload, whose id is
 * already unique per upload, so there is nothing to invalidate against).
 */
export function peaksFingerprint(ref: unknown): string {
  if (!ref || typeof ref !== 'object') return '';
  const r = ref as { version?: unknown; checksum?: unknown };
  const version = typeof r.version === 'string' ? r.version : '';
  const checksum = typeof r.checksum === 'string' ? r.checksum : '';
  return version || checksum ? `${version}|${checksum}` : '';
}

export function readRecord(rec: unknown, want = ''): PeaksResult | null {
  if (!rec || typeof rec !== 'object') return null;
  const r = rec as Partial<PeaksRecord> & { peaks?: unknown };
  const bytes = toBytes(r.peaks);
  if (!bytes || bytes.length !== PEAK_BUCKETS) return null;
  if (r.buckets != null && r.buckets !== PEAK_BUCKETS) return null;
  // A row measured from different bytes is worse than no row: it renders a confident
  // picture of audio that is no longer there. Only compared when BOTH sides know their
  // fingerprint - see PeaksRecord.fp for why absence is not a mismatch.
  if (want && r.fp && r.fp !== want) return null;
  const durationMs = Number(r.durationMs);
  if (!Number.isFinite(durationMs) || durationMs < 0) return null;
  return { peaks: decodePeaks(bytes), durationMs };
}

function toBytes(v: unknown): Uint8Array | null {
  if (v instanceof Uint8Array) return v;
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  if (Array.isArray(v) && v.every((n) => typeof n === 'number')) return Uint8Array.from(v as number[]);
  return null;
}

// ── the memo ────────────────────────────────────────────────────────────────

const memo = new Map<string, PeaksResult>();
/** Assets we have already failed to measure - never retried on the next scroll. */
const failed = new Set<string>();

function remember(id: string, result: PeaksResult): void {
  memo.delete(id);
  memo.set(id, result);
  while (memo.size > MEMO_MAX) {
    const oldest = memo.keys().next().value;
    if (oldest === undefined) break;
    memo.delete(oldest);
  }
}

/** Drop every in-memory memo and negative answer (teardown, tests). */
export function resetPeaksCache(): void {
  memo.clear();
  failed.clear();
  inflight.clear();
  // Release every waiter rather than dropping it: a queued derive whose resolver
  // is discarded is a promise that never settles, and its caller (a tile awaiting
  // its thumbnail) would hang forever.
  for (const release of queue.splice(0)) release();
  running = 0;
}

// ── read ────────────────────────────────────────────────────────────────────

/**
 * The stored peaks for an asset, or null when we have never measured it.
 *
 * A pure read: it NEVER decodes and never touches the network, so a render path
 * can call it for every visible tile and get either an instant waveform or an
 * instant "draw the glyph". Never throws.
 */
/**
 * Peaks already in memory for this session, or null - SYNCHRONOUS.
 *
 * For a caller that must build markup in one pass and cannot await, like the favourites
 * strip. Deliberately does not touch IndexedDB and never starts a decode: a surface that
 * can hold every favourite at once must not measure them all because it mounted. A miss
 * simply means "draw the glyph", and the ordinary lazy path fills the memo soon after.
 */
export function memoPeaks(assetId: string): Float32Array | null {
  return memo.get(assetId)?.peaks ?? null;
}

export async function cachedPeaks(assetId: string, want = ''): Promise<PeaksResult | null> {
  if (!assetId) return null;
  const hit = memo.get(assetId);
  if (hit) return hit;
  const store = await openPeaksStore();
  if (!store) return null;
  try {
    const raw = await store.get(assetId);
    const result = readRecord(raw, want);
    if (result) { remember(assetId, result); return result; }
    // A row that EXISTS but was rejected is stale, not missing - drop it so the space
    // is not held forever by a measurement nothing will ever accept again.
    if (raw) await store.delete(assetId).catch(() => {});
    return null;
  } catch {
    return null;
  }
}

/**
 * Store peaks measured somewhere else.
 *
 * The ingest path is the caller that matters: the upload flow has the bytes in
 * hand already, so peaks measured there cost nothing extra at scroll time. Never
 * throws - a failed write just means the asset is derived again later.
 */
export async function storePeaks(assetId: string, peaks: Float32Array, durationMs: number, fp = ''): Promise<void> {
  if (!assetId || !peaks?.length) return;
  const ms = Number.isFinite(durationMs) && durationMs > 0 ? Math.round(durationMs) : 0;
  const bytes = encodePeaks(peaks);
  remember(assetId, { peaks: decodePeaks(bytes), durationMs: ms });
  // A stored measurement supersedes an earlier failure to measure.
  failed.delete(assetId);
  const store = await openPeaksStore();
  if (!store) return;
  try {
    await store.put({ id: assetId, peaks: bytes, buckets: PEAK_BUCKETS, durationMs: ms, at: Date.now(), ...(fp ? { fp } : {}) });
  } catch { /* unstored is still memoised for this session */ }
}

/** Drop an asset's peaks (the asset was deleted or replaced). Never throws. */
export async function deletePeaks(assetId: string): Promise<void> {
  memo.delete(assetId);
  failed.delete(assetId);
  const store = await openPeaksStore();
  if (!store) return;
  try { await store.delete(assetId); } catch { /* nothing to drop */ }
}

/** Total stored peak bytes, for the storage meter. 0 when unavailable. */
export async function peaksCacheSize(): Promise<number> {
  const store = await openPeaksStore();
  if (!store) return 0;
  try {
    const all = await store.all();
    return all.reduce((sum, r) => sum + (r?.peaks?.length ?? 0), 0);
  } catch {
    return 0;
  }
}

// ── derive ──────────────────────────────────────────────────────────────────

/** In-flight derives, so N tiles for one asset share ONE decode. */
const inflight = new Map<string, Promise<PeaksResult | null>>();
/** Waiting derives + the count running, enforcing MAX_CONCURRENT_DERIVES. */
const queue: Array<() => void> = [];
let running = 0;

async function withSlot<T>(run: () => Promise<T>): Promise<T> {
  if (running >= MAX_CONCURRENT_DERIVES) {
    await new Promise<void>((resolve) => queue.push(resolve));
  }
  running++;
  try {
    return await run();
  } finally {
    running--;
    queue.shift()?.();
  }
}

/** Reported once per session: the reason is a property of the browser, not the asset. */
let loggedUnavailable = false;

interface AudioLike {
  audio?: {
    isAvailable?: () => boolean;
    analyse?: (src: unknown, opts?: unknown) => Promise<{ peaks?: Float32Array; duration?: number }>;
  };
}

/**
 * Measure an asset's waveform and cache it.
 *
 * Resolves the peaks, or `null` when there are honestly none to be had: no
 * `host.audio` (an older or headless shell), a clip past the duration ceiling, a
 * container this browser has no codec for, or a decode that failed. Null is a
 * real answer - the caller draws the glyph - and it is REMEMBERED, so a grid does
 * not re-attempt a failing decode on every scroll.
 *
 * Deduped per asset id and capped at `MAX_CONCURRENT_DERIVES` decodes overall.
 * Never throws: this is called from a render path.
 */
export function derivePeaks(host: unknown, ref: unknown, assetId: string): Promise<PeaksResult | null> {
  if (!assetId || !ref) return Promise.resolve(null);
  const hit = memo.get(assetId);
  if (hit) return Promise.resolve(hit);
  if (failed.has(assetId)) return Promise.resolve(null);
  const already = inflight.get(assetId);
  if (already) return already;

  const run = (async (): Promise<PeaksResult | null> => {
    // The database is checked INSIDE the deduped run: 52 tiles mounting together
    // would otherwise each issue their own read before the first write lands.
    const stored = await cachedPeaks(assetId, peaksFingerprint(ref));
    if (stored) return stored;

    const audio = (host as AudioLike | null)?.audio;
    if (!audio?.analyse || (audio.isAvailable && !audio.isAvailable())) {
      if (!loggedUnavailable) {
        loggedUnavailable = true;
        console.info('[audio-peaks] this shell cannot decode audio - audio assets keep their glyph thumbnail.');
      }
      failed.add(assetId);
      return null;
    }

    const declared = declaredDurationMs(ref);
    if (declared != null && declared > MAX_PEAK_DURATION_MS) {
      // Not a failure - a deliberate refusal. Remembered so it is decided once.
      failed.add(assetId);
      return null;
    }

    let analysis: { peaks?: Float32Array; duration?: number };
    try {
      analysis = await withSlot(() => audio.analyse!(ref, {
        // The overview waveform is ALL we want. `fps: 1` is the floor the engine
        // clamps to (audio-analyse.ts) and the analysis cost is linear in
        // fps × window - a 30 fps frame track for a three-minute song would be
        // 5,400 FFTs computed, transferred and thrown away.
        fps: 1,
        // Likewise the floor: cost is independent of `bands`, but the returned
        // magnitude array is count × bands floats crossing back from the worker,
        // and we never read a single one of them.
        bands: 4,
        buckets: PEAK_BUCKETS,
      }));
    } catch {
      // A codec this browser lacks is the common case here (Safari and Chromium
      // genuinely disagree about Ogg), and it is a property of the asset+browser
      // that will not change on the next scroll.
      failed.add(assetId);
      return null;
    }

    const peaks = analysis?.peaks;
    if (!peaks?.length) { failed.add(assetId); return null; }
    const durationMs = Number.isFinite(analysis.duration) && (analysis.duration ?? 0) > 0
      ? Math.round((analysis.duration ?? 0) * 1000)
      : (declared ?? 0);
    await storePeaks(assetId, peaks, durationMs, peaksFingerprint(ref));
    return memo.get(assetId) ?? { peaks: decodePeaks(encodePeaks(peaks)), durationMs };
  })().catch(() => null).finally(() => { inflight.delete(assetId); });

  inflight.set(assetId, run);
  return run;
}

/** An asset's declared length in ms, when it carries one. See AssetRef.meta.durationMs. */
function declaredDurationMs(ref: unknown): number | null {
  const meta = (ref as { meta?: Record<string, unknown> } | null)?.meta;
  const v = Number(meta?.durationMs);
  return Number.isFinite(v) && v > 0 ? v : null;
}
