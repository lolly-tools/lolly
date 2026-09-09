// SPDX-License-Identifier: MPL-2.0
/**
 * IndexedDB schema for the web shell.
 *
 * Stores:
 *   - profile - single record, the user's profile
 *   - state - saved tool states, keyed by slot id
 *   - asset-meta - catalog metadata (id, version, tags, format list)
 *   - asset-blob - cached asset bytes, keyed by id+format+version
 *   - user-assets - user-uploaded assets (headshots, custom images)
 *   - derived-media - DERIVED, evictable bytes computed on device FROM a user
 *                     asset (today: depth maps, lib/depth-job.ts)
 *   - audio-peaks - DERIVED overview waveforms for audio assets, ~128 bytes
 *                     each (lib/audio-peaks.ts)
 *   - audio-cover-bakes - DERIVED MilkDrop cover images, keyed by
 *                     (asset|preset|brand) (lib/audio-cover-bake.ts)
 *   - beam-staging - IN-FLIGHT chunks of a beam transfer, one row per chunk
 *                     (lib/beam-sink.ts). Never user data: it is either mid-
 *                     transfer or a crashed session's litter.
 *
 * Why IndexedDB over localStorage: blobs (images), no 5MB ceiling, structured
 * queries. The capability bridge hides this from tools - they call
 * host.state.save() without knowing what's underneath.
 *
 * DELIBERATELY NOT HERE: the Kokoro speech model (host.speech). transformers.js
 * caches its /models/kokoro/ fetches in the Cache API bucket
 * 'transformers-cache' all by itself (and the voice matrices ride a
 * 'lolly-speech' bucket beside it - see lib/speech-kokoro-worker.ts), so a
 * trustmark-style IndexedDB store would just double ~92 MB on device. Don't add
 * one.
 */

import { openDB as idbOpen, deleteDB as idbDelete } from 'idb';
import type { IDBPDatabase } from 'idb';
import { indexSavedWork, indexExport } from './history-index.ts';

const DB_NAME = 'lolly';
const DB_VERSION = 24;

// How long to wait for the DB to open before giving up. A healthy open is
// near-instant; this only trips when the connection is genuinely wedged.
const OPEN_TIMEOUT_MS = 8000;

// The functional stores every healthy DB must have. If the DB reports the
// current version but is missing any of these, it was left half-initialized by
// an interrupted upgrade and must be rebuilt (see openDB) - a rebuild that wipes
// the whole DB, so ONLY stores holding irreplaceable user data belong here. Two
// stores are deliberately excluded: 'catalog-meta' (deprecated/unused) and
// 'generated-previews' (pure regenerable cache - its absence must never escalate
// into wiping the user's profile/sessions/assets; host.previews degrades to
// committed previews if it's missing). 'identity' is excluded too: losing it just
// means enrolling again (see bridge/identity.js) - never worth wiping sessions.
const REQUIRED_STORES = ['profile', 'state', 'asset-meta', 'asset-blob', 'user-assets'];

function openOnce(timeoutMs = OPEN_TIMEOUT_MS): Promise<IDBPDatabase> {
  // Set when the browser tells us our open is queued behind an older connection
  // (a version upgrade blocked by another tab / a bfcache-frozen page). Lets the
  // timeout below mark the error as recoverable so boot() can offer a retry
  // instead of a dead end - the open succeeds the moment that connection closes.
  let wasBlocked = false;
  let migrationProgress = 0;
  const opening = idbOpen(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, tx) {
      if (oldVersion < 1) {
        db.createObjectStore('profile');
        const stateStore = db.createObjectStore('state', { keyPath: 'slot' });
        stateStore.createIndex('toolId', 'toolId');
        stateStore.createIndex('updatedAt', 'updatedAt');
        const assetMetaStore = db.createObjectStore('asset-meta', { keyPath: 'id' });
        assetMetaStore.createIndex('tier', 'tier');
        assetMetaStore.createIndex('type', 'type');
        // key = `${assetId}:${format}:${version}`
        db.createObjectStore('asset-blob');
        db.createObjectStore('user-assets', { keyPath: 'id' });
      }
      if (oldVersion < 2) {
        // DEPRECATED / RESERVED - 'catalog-meta' was added in v2 to hold catalog
        // ETags, but those moved to localStorage and no code reads or writes this
        // store anymore. It is intentionally NOT removed: deleting a store requires
        // a further version bump + migration, and leaving it costs nothing. Kept so
        // browsers that already upgraded to v2 still open at the declared schema.
        db.createObjectStore('catalog-meta');
      }
      if (oldVersion < 3) {
        // Profile-personalized gallery preview thumbnails, keyed by toolId. Pure
        // regenerable cache (re-rendered from the tool + current profile on demand;
        // see shells/web/src/personalize-previews.js), so - like asset-blob - it is
        // intentionally NOT carried in the portable backup (data-transfer.js).
        db.createObjectStore('generated-previews', { keyPath: 'toolId' });
      }
      if (oldVersion < 4) {
        // Content Credentials device identity - 'keypair' + 'cert' records (see bridge/identity.js).
        db.createObjectStore('identity');
      }
      if (oldVersion < 5) {
        // Export history - one record per download (id, toolId, filename, format, thumb,
        // query, at). A convenience log the Dashboard's "Latest exports" reads; capped to
        // a couple dozen. Like 'generated-previews'/'identity' it's regenerable-adjacent
        // (losing it just forgets the list), so it is NOT in REQUIRED_STORES - its absence
        // must never escalate into wiping the user's real data.
        db.createObjectStore('exports', { keyPath: 'id' });
      }
      if (oldVersion < 6) {
        // TrustMark ONNX watermark-decoder model bytes (tens of MB each), fetched
        // once from same-origin /models/trustmark/ on the /verify page's "Deep scan
        // for watermarks" action and cached here so the feature is offline after
        // first use (see shells/web/src/lib/trustmark.ts) - the Google-Fonts
        // fetch-once-then-IndexedDB pattern (lib/google-fonts.ts), applied to a
        // model file instead of a font file. Keyed by filename, NOT keyPath - a
        // plain get/put store, like 'asset-blob'. Pure regenerable cache (a
        // missing/corrupt entry just re-fetches), so - like 'generated-previews'/
        // 'exports' - it is intentionally NOT in REQUIRED_STORES: its absence must
        // never escalate into wiping the user's real data, and it is NOT part of
        // the portable data-transfer backup (it isn't user data).
        db.createObjectStore('trustmark-models');
      }
      if (oldVersion < 7) {
        // Meta Content Seal (Pixel Seal / Video Seal, image mode) ONNX extractor
        // bytes, fetched once from same-origin /models/contentseal/ on the same
        // /verify "Deep scan for watermarks" action and cached here so the feature
        // is offline after first use (see shells/web/src/lib/contentseal.ts) - the
        // identical fetch-once-then-IndexedDB pattern as 'trustmark-models', a
        // different watermark maker. Keyed by filename (plain get/put, no keyPath).
        // Pure regenerable cache (a missing/corrupt entry just re-fetches), so - 
        // like 'trustmark-models'/'generated-previews'/'exports' - it is
        // intentionally NOT in REQUIRED_STORES (its absence must never escalate
        // into wiping the user's real data) and NOT part of the portable backup.
        db.createObjectStore('contentseal-models');
      }
      if (oldVersion < 8) {
        // DERIVED media built on device from a user asset. Originally the timeline's
        // keyframe-dense scrub proxies (retired in WP-C once filmstrips moved to
        // mediabunny CanvasSink); now the store carries depth maps (keyed `depth:<id>`,
        // see lib/depth-job.ts). Records carry their own `key` so this is a keyPath store.
        // Derived, evictable, regenerable: a missing row just means "recompute it", so -
        // like 'asset-blob'/'generated-previews' - it is
        // intentionally NOT in REQUIRED_STORES (its absence must never escalate
        // into wiping the user's real data) and NOT part of the portable backup
        // (it isn't user data - it is recomputable from data that IS backed up).
        db.createObjectStore('derived-media', { keyPath: 'key' });
      }
      if (oldVersion < 9) {
        // Overview waveforms for audio assets - one row per asset id, holding a
        // byte-per-bucket peak array (~128 bytes) plus the measured duration, so
        // the asset picker and catalog can draw a REAL waveform thumbnail instead
        // of a broken <img> pointing at an .mp3 (see lib/audio-peaks.ts).
        // Records carry their own `id`, so this is a keyPath store like
        // 'user-assets'. Derived, evictable, regenerable: a missing row just means
        // "show the honest glyph and re-derive later", so - like 'derived-media'/
        // 'generated-previews' - it is intentionally NOT in REQUIRED_STORES (its
        // absence must never escalate into wiping the user's real data) and NOT
        // part of the portable backup (it is recomputable from the audio itself,
        // which IS backed up).
        db.createObjectStore('audio-peaks', { keyPath: 'id' });
      }
      if (oldVersion < 10) {
        // Baked MilkDrop cover art. The ONLY cover kind that stores pixels, and only
        // because a live visualiser needs a WebGL2 context - browsers cap those at ~16
        // and drop the oldest, so a grid cannot mount one per tile. The user's stored
        // cover is still the PRESET ID; these bytes are a cache keyed by
        // (asset|preset|brand), so a rebrand simply misses and re-bakes, which is how a
        // MilkDrop cover re-skins without the recipe changing.
        // Derived and evictable like 'audio-peaks': absent from REQUIRED_STORES so a
        // missing store can never escalate into wiping real data, and out of the
        // portable backup since it is recomputable from the recipe.
        db.createObjectStore('audio-cover-bakes', { keyPath: 'key' });
      }
      if (oldVersion < 11) {
        // On-device AI-upscaler model weights (host.upscale, engine 1.101), keyed by
        // filename - the fetch-once/IndexedDB-forever cache the shared ORT model
        // fetcher writes (createModelFetcher store:'upscale-models'). A pure,
        // re-downloadable cache like 'trustmark-models'/'contentseal-models', so it
        // is intentionally NOT in REQUIRED_STORES (its absence must never escalate
        // into a data-wipe) and is out of the portable backup.
        db.createObjectStore('upscale-models');
      }
      if (oldVersion < 12) {
        // On-device background-removal model weights (host.matte, engine 1.103),
        // keyed by filename - the SAME fetch-once/IndexedDB-forever cache the shared
        // ORT fetcher writes (createModelFetcher store:'matte-models'). Pure and
        // re-downloadable exactly like 'upscale-models', so likewise NOT in
        // REQUIRED_STORES and out of the portable backup.
        db.createObjectStore('matte-models');
      }
      if (oldVersion < 13) {
        // Receiver-side staging for a beam transfer (plans/100 section 11.15a, section 11.18) - 
        // one row per 64 KB chunk so a 38 MB pack streams to disk as it arrives
        // instead of accumulating in renderer RAM. Keyed [beamId, itemIndex, seq],
        // which makes an item's chunks read back in seq order and a whole beam one
        // contiguous range to delete; the `at` index carries the written-at stamp
        // the startup orphan sweep (lib/beam-sink.ts clearStaleBeams) reads key-only.
        // NOT user data at any moment - a row is either in flight or a crashed
        // session's litter, and nothing enters the library until the transfer
        // verifies - so, like 'derived-media'/'audio-peaks', it is intentionally NOT
        // in REQUIRED_STORES (its absence must never escalate into wiping real data)
        // and NOT part of the portable backup.
        const beamStore = db.createObjectStore('beam-staging', { keyPath: ['beamId', 'itemIndex', 'seq'] });
        beamStore.createIndex('at', 'at');
      }
      if (oldVersion < 14) {
        // On-device OCR model weights (host.ocr, plans/125) - a detector, a recogniser
        // and the recogniser's char dictionary, keyed by filename - the SAME
        // fetch-once/IndexedDB-forever cache the shared ORT fetcher writes
        // (createModelFetcher store:'ocr-models'). Pure and re-downloadable exactly
        // like 'matte-models'/'upscale-models', so likewise NOT in REQUIRED_STORES
        // (its absence must never escalate into a data-wipe) and out of the backup.
        db.createObjectStore('ocr-models');
      }
      if (oldVersion < 15) {
        // Instance-pack file store (plans/131, lib/pack-store.ts) - the bytes of
        // a loaded .lolly pack (tools + catalog assets), keyed by canonical
        // root-relative path and served through lib/instance.ts's fetch overlay.
        // Rebuilt whole by re-loading the pack file, so NOT in REQUIRED_STORES -
        // its absence must never escalate into wiping user data.
        db.createObjectStore('pack-files');
      }
      if (oldVersion < 16) {
        // Monocular depth model weights (plans/160, lib/depth-models.ts) - the
        // same fetch-once/IndexedDB-forever cache the shared ORT fetcher writes
        // (createModelFetcher store:'depth-models'). Pure and re-downloadable
        // exactly like 'matte-models'/'ocr-models', so likewise NOT in
        // REQUIRED_STORES (its absence must never escalate into a data-wipe) and
        // out of the portable backup. Inert until DEPTH_STAGED flips, but it has
        // to exist before it does or every run re-downloads the weights.
        db.createObjectStore('depth-models');
      }
      if (oldVersion < 17) {
        // The design systems this device holds (plans/186, lib/design-system/
        // registry.ts): one small record per system - slug, label, namespace,
        // head id, source - keyed by id. Which one is active is a key in the
        // 'profile' KV store. The material itself stays in 'user-assets' and
        // 'pack-files'; an empty registry is rebuilt from those by the one-shot
        // migration, so NOT in REQUIRED_STORES - its absence must never
        // escalate into wiping user data.
        db.createObjectStore('design-systems', { keyPath: 'id' });
      }
      if (oldVersion < 18) {
        // Device-local file operation history. Outputs are never an evictable cache.
        const operations = db.createObjectStore('file-operations', { keyPath: 'id' });
        operations.createIndex('updatedAt', 'updatedAt');
        db.createObjectStore('file-operation-blobs');
        db.createObjectStore('user-asset-versions', { keyPath: ['assetId', 'version'] });
      }
      if (oldVersion < 19) {
        // Complete batch membership, including files never started. Additive;
        // absence must never trigger the destructive REQUIRED_STORES recovery.
        db.createObjectStore('file-batches', { keyPath: 'id' });
      }
      if (oldVersion < 20) {
        // Plan 221: additive history stores. Never add these to REQUIRED_STORES.
        db.createObjectStore('revision-documents', { keyPath: 'slot' });
        const revisions = db.createObjectStore('revisions', { keyPath: 'id' });
        revisions.createIndex('documentId', 'documentId');
        revisions.createIndex('documentTime', ['documentId', 'at', 'id']);
        revisions.createIndex('documentReason', ['documentId', 'reason', 'at', 'id']);
        revisions.createIndex('time', ['at', 'id']);
        db.createObjectStore('revision-payloads');
        db.createObjectStore('revision-previews');
        db.createObjectStore('revision-usage');
      }
      if (oldVersion < 21) {
        // Also upgrade an initial history preview opened during development.
        const revisions = tx.objectStore('revisions');
        if (!revisions.indexNames.contains('documentReason')) revisions.createIndex('documentReason', ['documentId', 'reason', 'at', 'id']);
      }
      if (oldVersion < 22) {
        const recovery = db.createObjectStore('revision-recovery', { keyPath: 'id' });
        recovery.createIndex('slot', 'slot');
        recovery.createIndex('slotTime', ['slot', 'at', 'id']);
        recovery.createIndex('time', ['at', 'id']);
        db.createObjectStore('revision-recovery-payloads');
      }
      if (oldVersion < 23) tx.objectStore('revisions').createIndex('toolTime', ['toolId', 'at', 'id']);
      if (oldVersion < 24) {
        migrationProgress = Date.now();
        // One cursor at a time during the additive upgrade: never getAll canvas
        // payloads into memory. These indices remain part of their owning records.
        tx.objectStore('state').createIndex('history', 'historyKey');
        if (!db.objectStoreNames.contains('exports')) db.createObjectStore('exports', { keyPath: 'id' });
        tx.objectStore('exports').createIndex('history', 'historyKey');
        void (async () => {
          let saved = await tx.objectStore('state').openCursor();
          while (saved) { await saved.update(indexSavedWork(saved.value)); migrationProgress = Date.now(); saved = await saved.continue(); }
          let exported = await tx.objectStore('exports').openCursor();
          while (exported) { await exported.update(indexExport(exported.value)); migrationProgress = Date.now(); exported = await exported.continue(); }
        })().catch(() => { try { tx.abort(); } catch { /* already aborted */ } });
      }
    },
    blocking() {
      // A newer version of the app wants to open the DB; close this connection
      // so the upgrade isn't blocked across tabs.
      (this as unknown as IDBPDatabase).close();
    },
    blocked() {
      // Our open is queued behind an older connection (usually another Lolly tab
      // that didn't close, or one stuck mid-upgrade). Without this it would just
      // hang silently; the timeout below turns that into an actionable error.
      wasBlocked = true;
      console.warn('[db] IndexedDB open is blocked - another Lolly tab/window is holding the database open.');
    },
    terminated() {
      console.error('[db] IndexedDB connection terminated unexpectedly.');
    },
  });

  // A wedged IndexedDB (e.g. a connection in another tab stuck in a versionchange
  // transaction) can leave the open pending forever - which would freeze the
  // whole app on the "Loading…" splash with no feedback, since createBridge()
  // awaits this. Time it out so boot() surfaces a real error the user can act on
  // instead of an indefinite hang. The orphaned open (if it ever resolves) is
  // harmless: the page is reloaded after the user clears the offending tab.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    const check = (): void => {
      // A large, actively progressing migration is not a locked connection.
      // Still time out if its cursor genuinely stops making progress.
      if (migrationProgress && Date.now() - migrationProgress < timeoutMs) { timer = setTimeout(check, timeoutMs); return; }
      const err = new Error(
        'Local database is locked - another Lolly tab or window may be open. ' +
        'Close other Lolly/localhost tabs (or fully restart your browser) and reload.'
      );
      // Tag recoverability so boot() can offer a retry. A blocked open clears as
      // soon as the holding connection closes; a non-blocked timeout is a wedged
      // open that a reload may still shake loose.
      (err as Error & { code: string }).code = wasBlocked ? 'DB_BLOCKED' : 'DB_OPEN_TIMEOUT';
      reject(err);
    };
    timer = setTimeout(check, timeoutMs);
  });
  return Promise.race([opening, timeout]).finally(() => clearTimeout(timer)).catch((err) => {
    // If the timeout won the race but the real open resolves a moment later, that's an
    // orphaned LIVE connection - close it, or a retry would leave a handle open that
    // itself blocks the next upgrade (the exact pile-up we're preventing).
    opening.then((db) => { try { db.close(); } catch { /* already closed */ } }, () => { /* open failed too - nothing to close */ });
    throw err;
  });
}

// The ONE shared connection for the whole page, memoised so the bridge, export-history,
// and anything else all reuse it. Opening a fresh connection per caller (export-history
// used to, per read/write) is not just wasteful - every extra LIVE connection needlessly
// blocks a version upgrade (an upgrade needs all other connections closed first), so a
// pile-up of un-closed connections was a direct cause of the "Local database is locked"
// boot hang. A failed open clears this so a later call (e.g. after the blocking tab
// finally closes) can retry from scratch.
let dbPromise: Promise<IDBPDatabase> | null = null;

export function openDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openResilient().catch((e) => { dbPromise = null; throw e; });
  }
  return dbPromise;
}

/** openHealed(), but a BLOCKED open (another tab holding an older version) is retried for
 *  a while before giving up. Our own blocking() closes our connection when a newer version
 *  wants in, and an active sibling tab closes on the versionchange each re-open fires - so
 *  a blocked open usually clears within a second or two. Retrying recovers that common case
 *  automatically; only a genuinely wedged/frozen holder (which a reload can't fix silently)
 *  falls through to the actionable error boot() surfaces. */
async function openResilient(): Promise<IDBPDatabase> {
  const deadline = Date.now() + 16000;
  for (;;) {
    try {
      // Short per-attempt timeout while retrying - each re-open re-nudges a stuck sibling
      // to close far sooner than one long 8s wait would (a healthy open is near-instant).
      return await openHealed(4000);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if ((code === 'DB_BLOCKED' || code === 'DB_OPEN_TIMEOUT') && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 300));
        continue;
      }
      throw e;
    }
  }
}

async function openHealed(timeoutMs?: number): Promise<IDBPDatabase> {
  let db = await openOnce(timeoutMs);

  // Self-heal a half-initialized DB. An interrupted upgrade (e.g. a tab killed
  // mid-`versionchange`) can leave the DB at the current version yet missing
  // stores - and because the version already matches, the upgrade callback never
  // re-runs to create them, so every transaction throws "object store not found".
  // The only repair is to drop and recreate. This is safe: it triggers solely
  // when a required store is already absent (so there is no data in it to lose),
  // never on a healthy DB.
  const missing = REQUIRED_STORES.filter(name => !db.objectStoreNames.contains(name));
  if (missing.length) {
    console.warn('[db] Rebuilding corrupted lolly DB - missing stores:', missing.join(', '));
    db.close();
    await idbDelete(DB_NAME);
    db = await openOnce(timeoutMs);
  }

  return db;
}
