// SPDX-License-Identifier: MPL-2.0
/**
 * beam-sink - the receiver-side staging driver behind `BeamSink`
 * (plan 100 section 6.4, section 11.15a, section 11.18; the storage half of wave 3's beam).
 *
 * `collab/beam-protocol.ts` is deliberately storage-blind: it defines the frames and
 * the two state machines, and writes every received byte through an injected
 * `BeamSink` (`write` / `finalize` / `discard`). This module is that injection - the
 * one place in the shell that knows what a staging row is. The protocol's guarantees
 * are only as good as this driver, so the two plan sections it exists to satisfy are
 * worth restating as properties of THIS file:
 *
 *  - **section 11.15a - a 38 MB pack never accumulates in renderer RAM.** `write()` puts one
 *    chunk into IndexedDB as one row and returns; nothing is buffered per item, per
 *    beam, or anywhere else. The payload is stored as a `Blob`, so reading an item
 *    back at `finalize()` hands out lazy, disk-backed handles that `new Blob(parts)`
 *    concatenates by reference rather than by copying tens of megabytes through the
 *    JS heap. This is also why the module is DOM-free: it runs unchanged in a Worker
 *    (the intended home for pack ingest) or on the main thread.
 *  - **section 11.18 - no partial ingest.** `finalize()` SEALS an item; it does not ingest
 *    one. Nothing here writes to `user-assets`, `state`, or any other real store, and
 *    `discard()` removes every row for the beam, idempotently and safely mid-write.
 *    The assembled `Blob`s stay in this driver's hand until the receiver reaches
 *    `complete` and an ingest step calls `takeAll()`.
 *
 * ── Where the rows live ───────────────────────────────────────────────────────
 *
 * The shell owns ONE central IndexedDB (`bridge/db.ts`, database `lolly`), and every
 * feature that needs storage adds a store to it through the existing version ladder - 
 * `derived-media`, `audio-peaks`, `upscale-models` and the rest all arrived that way.
 * A private database for beam staging would be the only one in the codebase, would
 * add a second connection that blocks the shared DB's version upgrades, and would sit
 * outside the "clear caches" surfaces that enumerate stores. So `beam-staging` is a
 * store in the central DB, created at DB_VERSION 13. Like every other derived and
 * evictable store it is intentionally NOT in `REQUIRED_STORES` (its absence must
 * never escalate into wiping the user's real data) and NOT part of the portable
 * backup - a half-received transfer is not user data, and `clearStaleBeams()` is what
 * removes what a crash left behind.
 *
 * The store is keyed `[beamId, itemIndex, seq]`, so IndexedDB's own key order IS seq
 * order within an item, and a whole beam is one contiguous key range. One index, `at`
 * (the written-at stamp), exists solely for the orphan sweep and is read key-only, so
 * the sweep never loads a payload.
 *
 * ── Byte-exactness ───────────────────────────────────────────────────────────
 *
 * A transferred asset's bytes must arrive byte-identical - that is the rule that lets
 * C2PA credentials survive a beam (section 6.4, the `credentialedBytes` convention from the
 * catalog's downloads). This driver therefore never transforms a payload: no text
 * decoding, no re-encoding, no MIME sniffing, no separators. It stores the exact
 * chunk and concatenates the exact chunks in seq order. The assembled `Blob` carries
 * no `type`; an ingest step that wants one re-wraps (`new Blob([blob], { type })`),
 * which copies nothing.
 *
 * ── Digests, and the memory trade behind them ────────────────────────────────
 *
 * The protocol verifies every item against the sender's SRI checksum, and offers the
 * sink first refusal on producing that digest (`finalize` MAY return it; when it does
 * the protocol buffers nothing itself). Three modes, in increasing thrift:
 *
 *   1. default - `finalize()` materialises the assembled item ONCE to hash it, then
 *      drops the buffer. Peak is one item, transient. Still strictly better than the
 *      protocol's built-in `sha256Hasher`, which retains every chunk on the JS heap
 *      for the whole item transfer, because during the transfer this driver holds
 *      nothing at all.
 *   2. `hasher` - inject a streaming digest (from a Worker, say) and it is fed chunk
 *      by chunk as they arrive: O(1) memory, nothing materialised. If chunks ever
 *      arrive out of seq order the streaming digest would be wrong, so that item
 *      silently falls back to mode 1 rather than producing a plausible lie.
 *   3. `digest: false` - `finalize()` returns no digest and the caller must leave the
 *      protocol's own hasher in place. Verification is never skipped: a sink that
 *      returns nothing and a protocol constructed with `hasher: null` fails closed
 *      (`sink-failure`), which is the protocol's design, not an accident here.
 *
 * A runtime with no Web Crypto behaves as mode 3 for the same reason.
 *
 * ── Failure surfacing ────────────────────────────────────────────────────────
 *
 * Every storage failure leaves this module as a `BeamSinkError` - a typed, coded
 * error the protocol turns into a cancel (`enqueue` catches it and fails the beam
 * with `sink-failure`), never a raw DOMException and never an unhandled rejection.
 * A device that runs out of room mid-beam is the case that matters: it surfaces as
 * `code: 'quota'` with plain user copy, so the UI can say what happened instead of
 * showing a stalled progress bar.
 */

import type { IDBPDatabase } from 'idb';
import { sriSha256 } from '../collab/beam-protocol.ts';
import type { BeamHash, BeamHasher, BeamSink } from '../collab/beam-protocol.ts';
// The failure copy's catalog lookup. Import-time inert (see the Copy section below),
// so this module stays DOM-free and Worker-safe.
import { tRaw } from '../i18n.ts';

/** The object store in the shell's central `lolly` database (bridge/db.ts, v13). */
export const BEAM_STAGING_STORE = 'beam-staging';

/**
 * How old staging must be before the startup sweep treats it as a crashed session's
 * litter. Generous on purpose: the stamp compared is a beam's NEWEST row, so a live
 * transfer refreshes it constantly, but a beam paused behind a slow link (or a peer
 * that went to make tea) must never be swept out from under itself.
 */
export const STALE_BEAM_MS = 24 * 60 * 60 * 1000;

/** Upper bound for the itemIndex/seq halves of a key range. Both are small integers
 *  in practice (section 11.6 caps a chunk at 64 KB and the protocol caps an item at 1 GB),
 *  so this is a range terminator, not a limit anyone can reach. */
const MAX_KEY_PART = Number.MAX_SAFE_INTEGER;

// ── Rows + the storage slice ──────────────────────────────────────────────────

/** One staged chunk. `bytes` is the payload EXACTLY as it arrived. */
export interface BeamStagingRow {
  readonly beamId: string;
  readonly itemIndex: number;
  /** 0-based within the item, +1 per chunk - the protocol's own numbering. */
  readonly seq: number;
  readonly bytes: Blob;
  /** `bytes.size`, denormalised so byte accounting never has to open a payload. */
  readonly size: number;
  /** ms since epoch. The orphan sweep's only clock, and nothing else reads it - 
   *  convergence and verification are wall-clock-free (section 11.7). */
  readonly at: number;
}

/**
 * The slice of storage this driver needs, in domain terms - the `StateDb` idiom from
 * `bridge/state.ts`, one purpose over. Injected so the sink's own logic (assembly,
 * continuity, discard, sweep) is testable headlessly, and so a Worker can hand in a
 * connection it already holds instead of opening a second one.
 */
export interface BeamStagingDb {
  put(row: BeamStagingRow): Promise<void>;
  /** Every row for one item, ascending by seq. */
  itemRows(beamId: string, itemIndex: number): Promise<BeamStagingRow[]>;
  deleteItem(beamId: string, itemIndex: number): Promise<void>;
  deleteBeam(beamId: string): Promise<void>;
  /** Newest written-at stamp per beam id. Key-only: no payload is read. */
  beamStamps(): Promise<Map<string, number>>;
}

// ── Errors ────────────────────────────────────────────────────────────────────

export type BeamSinkErrorCode =
  /** The device is out of room - the failure a big beam actually hits. */
  | 'quota'
  /** Staging refused a write for any other reason. */
  | 'write-failed'
  /** Staged rows could not be read back at finalize. */
  | 'read-failed'
  /** Seq continuity broke: a chunk never landed, so the item cannot be assembled. */
  | 'missing-chunk'
  /** The beam was discarded; there is nothing left to seal. */
  | 'closed';

// ── Copy ──────────────────────────────────────────────────────────────────────
//
// One map, one wave - the same shape `lib/beam-pack.ts` uses, keyed here by the
// error code so a caller writes `STRINGS[err.code]`. Short and plain: these are read
// at the moment a transfer dies, where a sentence is already one too many.
//
// These are catalog KEYS in the lazy `collab` namespace (i18n.ts), NOT the rendered
// copy, and NOT `extra-keys.spa.json`, which is what an earlier version of this comment
// pointed at: that predates the namespace existing, and a boot catalog every locale
// downloads must not carry a flagged beta's copy. The map is a slice of the collab
// corpus, which is exactly how a dynamically-keyed read gets translated with no
// hand-list - and `collab-i18n.test.ts` pins it from both ends.
//
// Importing i18n.ts costs this module nothing it claims not to have: nothing in that
// file touches `document`/`window`/`localStorage` at import time, so the DOM-free
// promise in the header holds and it still loads in a Worker. What a Worker does not
// have is a POPULATED catalog, and there the English source renders - the same
// fallback as a language whose catalog is missing.

export const STRINGS: Record<BeamSinkErrorCode, string> = {
  quota: 'Not enough space on this device.',
  'write-failed': "Couldn't save the transfer.",
  'read-failed': "Couldn't read the transfer back.",
  'missing-chunk': 'Part of the transfer is missing.',
  closed: 'The transfer was cancelled.',
};

/** A storage failure, typed. `message` is the diagnostic the protocol puts on the
 *  wire as a cancel `detail` (never user copy); `userMessage` is what a human sees. */
export class BeamSinkError extends Error {
  readonly code: BeamSinkErrorCode;

  constructor(code: BeamSinkErrorCode, detail?: string, options?: { cause?: unknown }) {
    super(`beam-sink: ${code}${detail ? ` - ${detail}` : ''}`, options);
    this.name = 'BeamSinkError';
    this.code = code;
  }

  /**
   * The sentence a human is shown. A GETTER, not a field set in the constructor: a
   * sink error is thrown the moment storage fails, which can be before the surface
   * that will render it has awaited `loadNamespace('collab')`. Resolving at READ time
   * means the copy is looked up when it is about to be shown, so an error that
   * outlives the namespace load is still translated rather than frozen in English.
   */
  get userMessage(): string {
    return tRaw(STRINGS[this.code]);
  }
}

/** Is this the browser telling us the disk (or the origin's quota) is full? Named
 *  DOMException everywhere modern; the legacy numeric code and the message sniff are
 *  there because Safari has historically reported quota as a plain abort. */
function isQuotaError(err: unknown): boolean {
  const e = err as { name?: unknown; code?: unknown; message?: unknown } | null;
  if (!e) return false;
  if (e.name === 'QuotaExceededError') return true;
  if (e.code === 22 || e.code === 1014) return true;
  return /quota|storage is full|disk/i.test(String(e.name ?? '') + ' ' + String(e.message ?? ''));
}

function asSinkError(err: unknown, fallback: BeamSinkErrorCode, detail: string): BeamSinkError {
  if (err instanceof BeamSinkError) return err;
  const code = isQuotaError(err) ? 'quota' : fallback;
  return new BeamSinkError(code, `${detail}: ${errText(err)}`, { cause: err });
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ── The sink ──────────────────────────────────────────────────────────────────

/** An item, sealed and assembled. Not yet ingested - section 11.18 keeps it here until the
 *  receiver reaches `complete`. */
export interface BeamStagedItem {
  readonly itemIndex: number;
  /** The item's exact bytes, in one Blob. No `type`; callers re-wrap if they need one. */
  readonly blob: Blob;
  readonly bytes: number;
  readonly chunks: number;
  /** SRI `sha256-<base64>`, the catalog's checksum form - or `''` when digesting is
   *  off (or Web Crypto is absent) and the protocol's own hasher verifies instead. */
  readonly checksum: string;
}

export interface BeamSinkOptions {
  /** Storage. Defaults to the `beam-staging` store in the shell's central DB, opened
   *  lazily on first write - a declined beam never opens the database at all. */
  readonly db?: BeamStagingDb;
  /** Produce the SRI digest from `finalize()` (default true). `false` hands
   *  verification back to the protocol's own hasher - never skips it. */
  readonly digest?: boolean;
  /** A streaming digest fed chunk-by-chunk, so nothing is ever materialised to hash
   *  (mode 2 above). One `BeamHash` per item; the protocol's `BeamHasher` type. */
  readonly hasher?: BeamHasher;
  /** ms clock for the written-at stamp. Injectable so the sweep is testable. */
  readonly now?: () => number;
  /** Where cleanup problems are reported. Cleanup never fails a transfer, so these
   *  would otherwise be silent. */
  readonly log?: (message: string, meta?: Record<string, unknown>) => void;
}

/** `BeamSink`, plus the assembled items the ingest step collects after `complete`. */
export interface BeamStagingSink extends BeamSink {
  readonly beamId: string;
  write(itemIndex: number, seq: number, bytes: Uint8Array): Promise<void>;
  /** The `BeamSink`-shaped view of `finalizeItem`: seals the item and returns its
   *  digest (or `undefined` when digesting is off). */
  finalize(itemIndex: number): Promise<string | undefined>;
  discard(): Promise<void>;
  /** Seal an item: assemble its staged chunks in seq order, check that none is
   *  missing, drop the staging rows, and keep the assembled Blob. Idempotent - 
   *  a second call returns the same item without touching storage. */
  finalizeItem(itemIndex: number): Promise<BeamStagedItem>;
  /** Items sealed so far, in index order. */
  items(): readonly BeamStagedItem[];
  /** Hand every sealed item to the caller and forget them - the ingest hand-off,
   *  called once the receiver reaches `complete`. */
  takeAll(): BeamStagedItem[];
}

/**
 * A staging sink for one beam.
 *
 * ```ts
 * const sink = createBeamSink(offer.beamId);
 * const receiver = createBeamReceiver({ wire, sink, hasher: null });
 * // …on phase 'complete':
 * for (const item of sink.takeAll()) await ingest(item.blob);
 * ```
 *
 * `hasher: null` above is the point of the driver: with the sink producing digests,
 * the protocol holds no bytes of its own.
 */
export function createBeamSink(beamId: string, opts: BeamSinkOptions = {}): BeamStagingSink {
  const id = String(beamId ?? '');
  if (!id) throw new BeamSinkError('write-failed', 'a beam needs an id');

  const now = opts.now ?? Date.now;
  const wantDigest = opts.digest !== false;
  const makeHash = opts.hasher;
  const log = opts.log ?? ((message: string, meta?: Record<string, unknown>) => {
    console.warn(`[lolly:beam] ${message}`, meta ?? '');
  });

  let dbPromise: Promise<BeamStagingDb> | null = opts.db ? Promise.resolve(opts.db) : null;
  const db = (): Promise<BeamStagingDb> => (dbPromise ??= openBeamStagingDb());

  /** Sealed items, by index. Held here (never in a real store) until `takeAll()`. */
  const sealed = new Map<number, BeamStagedItem>();
  /** Per-item streaming digest state; `null` means "this item fell back to mode 1". */
  const streams = new Map<number, { hash: BeamHash; next: number } | null>();
  /** In-flight (then settled) seals, so two `finalize` calls for one item assemble it
   *  once. The protocol serialises its own; a driver calling twice should not pay
   *  twice, and must not race two deletes. */
  const sealing = new Map<number, Promise<BeamStagedItem>>();
  /** Writes not yet settled, so `discard()` can never race a row into storage after
   *  the delete. Each entry is pre-caught, so nothing here can go unhandled. */
  const inflight = new Set<Promise<void>>();

  let touched = false;
  let closed = false;
  let discarding: Promise<void> | null = null;

  function feedStream(itemIndex: number, seq: number, bytes: Uint8Array): void {
    if (!makeHash) return;
    let entry = streams.get(itemIndex);
    if (entry === undefined) {
      entry = { hash: makeHash(), next: 0 };
      streams.set(itemIndex, entry);
    }
    if (!entry) return;                       // already fell back for this item
    if (entry.next !== seq) {
      streams.set(itemIndex, null);           // out of order - a streamed digest would lie
      return;
    }
    entry.hash.update(bytes);
    entry.next++;
  }

  async function writeOne(itemIndex: number, seq: number, bytes: Uint8Array): Promise<void> {
    if (!Number.isSafeInteger(itemIndex) || itemIndex < 0) {
      throw new BeamSinkError('write-failed', `item index ${itemIndex}`);
    }
    if (!Number.isSafeInteger(seq) || seq < 0) {
      throw new BeamSinkError('write-failed', `item ${itemIndex} seq ${seq}`);
    }
    if (!(bytes instanceof Uint8Array)) {
      throw new BeamSinkError('write-failed', `item ${itemIndex} seq ${seq} is not bytes`);
    }
    // Everything above (and the two lines below) runs SYNCHRONOUSLY, before the first
    // await: the Blob constructor copies the payload out of the caller's buffer, and
    // the streaming digest reads it, so the caller may reuse that buffer the moment
    // write() returns - the same ownership rule the protocol states for its wire.
    const row: BeamStagingRow = { beamId: id, itemIndex, seq, bytes: new Blob([bytes as BlobPart]), size: bytes.byteLength, at: now() };
    feedStream(itemIndex, seq, bytes);
    touched = true;
    if (closed) return;                       // discarded mid-flight - stage nothing
    try {
      await (await db()).put(row);
    } catch (err) {
      throw asSinkError(err, 'write-failed', `item ${itemIndex} seq ${seq}`);
    }
  }

  async function digestOf(blob: Blob): Promise<string> {
    if (!wantDigest || !globalThis.crypto?.subtle) return '';
    try {
      return await sriSha256(new Uint8Array(await blob.arrayBuffer()));
    } catch (err) {
      throw asSinkError(err, 'read-failed', 'digest of the staged item');
    }
  }

  function seal(itemIndex: number): Promise<BeamStagedItem> {
    let pending = sealing.get(itemIndex);
    if (!pending) {
      // A failed seal is forgotten so it can be retried; a successful one is the
      // memo `finalize`'s idempotence rests on.
      pending = sealOnce(itemIndex).catch((err) => { sealing.delete(itemIndex); throw err; });
      sealing.set(itemIndex, pending);
    }
    return pending;
  }

  async function sealOnce(itemIndex: number): Promise<BeamStagedItem> {
    const already = sealed.get(itemIndex);
    if (already) return already;
    if (closed) throw new BeamSinkError('closed', `item ${itemIndex}`);

    let rows: BeamStagingRow[];
    try {
      rows = [...(await (await db()).itemRows(id, itemIndex))];
    } catch (err) {
      throw asSinkError(err, 'read-failed', `item ${itemIndex}`);
    }
    // The store's key order is already seq order; sorting is a cheap guard against a
    // driver that isn't IndexedDB, not a workaround for one that is.
    rows.sort((a, b) => a.seq - b.seq);
    for (let i = 0; i < rows.length; i++) {
      if (rows[i]!.seq !== i) {
        throw new BeamSinkError('missing-chunk', `item ${itemIndex}: expected seq ${i}, staged ${rows[i]!.seq}`);
      }
    }

    const blob = new Blob(rows.map(r => r.bytes as BlobPart));
    // A streamed digest only stands if every chunk of this item went through it in
    // order; otherwise (and by default) hash the assembled bytes once.
    const stream = makeHash ? streams.get(itemIndex) : undefined;
    const streamed = stream && stream.next === rows.length && wantDigest ? await stream.hash.digest() : null;
    const item: BeamStagedItem = {
      itemIndex,
      blob,
      bytes: blob.size,
      chunks: rows.length,
      checksum: streamed ?? await digestOf(blob),
    };
    sealed.set(itemIndex, item);
    streams.delete(itemIndex);

    // The assembled Blob is independent of the rows that fed it, so staging for this
    // item can go now - a sealed item costs one copy, not two. A failure here leaks
    // rows rather than the item: never worth failing a verified transfer over, and
    // clearStaleBeams() is the backstop.
    try {
      await (await db()).deleteItem(id, itemIndex);
    } catch (err) {
      log(`staging rows for item ${itemIndex} of beam ${id} could not be dropped`, { error: errText(err) });
    }
    return item;
  }

  return {
    beamId: id,

    write(itemIndex, seq, bytes) {
      const p = writeOne(itemIndex, seq, bytes);
      // Tracked pre-caught so an ignored rejection can never surface as an unhandled
      // one; the ORIGINAL promise is what the caller gets, rejection intact.
      const tracked = p.catch(() => {});
      inflight.add(tracked);
      void tracked.then(() => inflight.delete(tracked));
      return p;
    },

    async finalize(itemIndex) {
      const item = await seal(itemIndex);
      return item.checksum || undefined;
    },

    finalizeItem(itemIndex) {
      return seal(itemIndex);
    },

    discard() {
      // Idempotent by memoisation, and `closed` flips synchronously on the first call
      // so no further write can start while the delete is in flight.
      discarding ??= (async () => {
        closed = true;
        await Promise.allSettled([...inflight]);
        await Promise.allSettled([...sealing.values()]);
        sealed.clear();
        sealing.clear();
        streams.clear();
        if (!touched && !opts.db) return;     // nothing was ever staged; don't open the DB to prove it
        try {
          await (await db()).deleteBeam(id);
        } catch (err) {
          log(`staging for beam ${id} could not be cleared`, { error: errText(err) });
        }
      })();
      return discarding;
    },

    items() {
      return [...sealed.values()].sort((a, b) => a.itemIndex - b.itemIndex);
    },

    takeAll() {
      const all = [...sealed.values()].sort((a, b) => a.itemIndex - b.itemIndex);
      sealed.clear();
      // …and the seal memo with it. Each entry is a settled promise holding the
      // assembled Blob, so keeping them would retain the whole 38 MB pack for as long
      // as this sink lives - and a driver whose beam reached `complete` has no reason
      // to call `discard()`. "Forget them" has to mean both maps or it means neither.
      sealing.clear();
      return all;
    },
  };
}

// ── Orphan sweep ──────────────────────────────────────────────────────────────

export interface ClearStaleBeamsOptions {
  readonly db?: BeamStagingDb;
  readonly now?: () => number;
  /** Beam ids to spare - the transfers this session has live. A beam being received
   *  right now refreshes its own stamp on every chunk, so this is belt-and-braces for
   *  a stalled-but-alive transfer (and for section 11.8's second tab). */
  readonly keep?: Iterable<string>;
  readonly log?: (message: string, meta?: Record<string, unknown>) => void;
}

/**
 * Remove staging a crashed or force-quit session left behind, returning the beam ids
 * cleared. Call once at startup and forget it: this never throws and never rejects - 
 * a device with no usable IndexedDB simply has nothing to sweep.
 *
 * Staleness is judged per BEAM, on its newest row, so the first chunk of a long slow
 * transfer can be older than `maxAgeMs` without the beam being swept out from under
 * the peer still sending it.
 */
export async function clearStaleBeams(maxAgeMs: number = STALE_BEAM_MS, opts: ClearStaleBeamsOptions = {}): Promise<string[]> {
  const log = opts.log ?? ((message: string, meta?: Record<string, unknown>) => {
    console.warn(`[lolly:beam] ${message}`, meta ?? '');
  });
  const cutoff = (opts.now ?? Date.now)() - Math.max(0, maxAgeMs);
  const keep = new Set(opts.keep ?? []);
  const cleared: string[] = [];
  try {
    const db = opts.db ?? (await openBeamStagingDb());
    for (const [id, at] of await db.beamStamps()) {
      if (keep.has(id) || at > cutoff) continue;
      try {
        await db.deleteBeam(id);
        cleared.push(id);
      } catch (err) {
        log(`stale staging for beam ${id} could not be cleared`, { error: errText(err) });
      }
    }
  } catch (err) {
    log('stale beam staging could not be swept', { error: errText(err) });
  }
  return cleared;
}

// ── The real store ────────────────────────────────────────────────────────────

/**
 * `bridge/db.ts` is imported LAZILY, the same rule `lib/collab-plumbing.ts` and
 * `org/collab-provider.ts` follow: a static import would drag `idb` into whichever
 * chunk loads this module, and into its DOM-free unit tests, which inject their own
 * storage and must never open a database.
 */
async function openBeamStagingDb(): Promise<BeamStagingDb> {
  const { openDB } = await import('../bridge/db.ts');
  return createIdbStagingDb(await openDB());
}

/**
 * The `beam-staging` store, over an already-open connection to the shell's central
 * DB - exported so a Worker can reuse the connection it holds instead of opening a
 * second one.
 *
 * Both ranges lean on the compound key `[beamId, itemIndex, seq]`: one item is a
 * contiguous slice, one beam is a contiguous slice, so an item's rows read back in
 * seq order and a whole beam is deleted with a single range delete - no cursor, and
 * no interleaved awaits inside a write transaction.
 */
export function createIdbStagingDb(db: IDBPDatabase): BeamStagingDb {
  const itemRange = (beamId: string, itemIndex: number) =>
    IDBKeyRange.bound([beamId, itemIndex, 0], [beamId, itemIndex, MAX_KEY_PART]);
  const beamRange = (beamId: string) =>
    IDBKeyRange.bound([beamId, 0, 0], [beamId, MAX_KEY_PART, MAX_KEY_PART]);

  return {
    async put(row) {
      await db.put(BEAM_STAGING_STORE, row);
    },
    async itemRows(beamId, itemIndex) {
      return (await db.getAll(BEAM_STAGING_STORE, itemRange(beamId, itemIndex))) as BeamStagingRow[];
    },
    async deleteItem(beamId, itemIndex) {
      await db.delete(BEAM_STAGING_STORE, itemRange(beamId, itemIndex));
    },
    async deleteBeam(beamId) {
      await db.delete(BEAM_STAGING_STORE, beamRange(beamId));
    },
    async beamStamps() {
      // Key-only, over the `at` index: the sweep must never page a payload in just to
      // read a timestamp. The index iterates ascending by `at`, so the last write for
      // a beam is the one left in the map.
      const stamps = new Map<string, number>();
      const tx = db.transaction(BEAM_STAGING_STORE, 'readonly');
      let cursor = await tx.store.index('at').openKeyCursor();
      while (cursor) {
        const key = cursor.primaryKey as unknown as [string, number, number];
        stamps.set(String(key[0]), Number(cursor.key));
        cursor = await cursor.continue();
      }
      await tx.done;
      return stamps;
    },
  };
}
