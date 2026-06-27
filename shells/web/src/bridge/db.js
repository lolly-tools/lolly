// SPDX-License-Identifier: MPL-2.0
/**
 * IndexedDB schema for the web shell.
 *
 * Stores:
 *   - profile       — single record, the user's profile
 *   - state         — saved tool states, keyed by slot id
 *   - asset-meta    — catalog metadata (id, version, tags, format list)
 *   - asset-blob    — cached asset bytes, keyed by id+format+version
 *   - user-assets   — user-uploaded assets (headshots, custom images)
 *
 * Why IndexedDB over localStorage: blobs (images), no 5MB ceiling, structured
 * queries. The capability bridge hides this from tools — they call
 * host.state.save() without knowing what's underneath.
 */

import { openDB as idbOpen, deleteDB as idbDelete } from 'idb';

const DB_NAME = 'lolly';
const DB_VERSION = 3;

// How long to wait for the DB to open before giving up. A healthy open is
// near-instant; this only trips when the connection is genuinely wedged.
const OPEN_TIMEOUT_MS = 8000;

// The functional stores every healthy DB must have. If the DB reports the
// current version but is missing any of these, it was left half-initialized by
// an interrupted upgrade and must be rebuilt (see openDB). 'catalog-meta' is
// intentionally excluded — it is deprecated/unused, so its absence is harmless.
const REQUIRED_STORES = ['profile', 'state', 'asset-meta', 'asset-blob', 'user-assets', 'generated-previews'];

function openOnce() {
  const opening = idbOpen(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
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
        // DEPRECATED / RESERVED — 'catalog-meta' was added in v2 to hold catalog
        // ETags, but those moved to localStorage and no code reads or writes this
        // store anymore. It is intentionally NOT removed: deleting a store requires
        // a further version bump + migration, and leaving it costs nothing. Kept so
        // browsers that already upgraded to v2 still open at the declared schema.
        db.createObjectStore('catalog-meta');
      }
      if (oldVersion < 3) {
        // Profile-personalized gallery preview thumbnails, keyed by toolId. Pure
        // regenerable cache (re-rendered from the tool + current profile on demand;
        // see shells/web/src/personalize-previews.js), so — like asset-blob — it is
        // intentionally NOT carried in the portable backup (data-transfer.js).
        db.createObjectStore('generated-previews', { keyPath: 'toolId' });
      }
    },
    blocking() {
      // A newer version of the app wants to open the DB; close this connection
      // so the upgrade isn't blocked across tabs.
      this.close();
    },
    blocked() {
      // Our open is queued behind an older connection (usually another Lolly tab
      // that didn't close, or one stuck mid-upgrade). Without this it would just
      // hang silently; the timeout below turns that into an actionable error.
      console.warn('[db] IndexedDB open is blocked — another Lolly tab/window is holding the database open.');
    },
    terminated() {
      console.error('[db] IndexedDB connection terminated unexpectedly.');
    },
  });

  // A wedged IndexedDB (e.g. a connection in another tab stuck in a versionchange
  // transaction) can leave the open pending forever — which would freeze the
  // whole app on the "Loading…" splash with no feedback, since createBridge()
  // awaits this. Time it out so boot() surfaces a real error the user can act on
  // instead of an indefinite hang. The orphaned open (if it ever resolves) is
  // harmless: the page is reloaded after the user clears the offending tab.
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(
      'Local database is locked — another Lolly tab or window may be open. ' +
      'Close other Lolly/localhost tabs (or fully restart your browser) and reload.'
    )), OPEN_TIMEOUT_MS);
  });
  return Promise.race([opening, timeout]).finally(() => clearTimeout(timer));
}

export async function openDB() {
  let db = await openOnce();

  // Self-heal a half-initialized DB. An interrupted upgrade (e.g. a tab killed
  // mid-`versionchange`) can leave the DB at the current version yet missing
  // stores — and because the version already matches, the upgrade callback never
  // re-runs to create them, so every transaction throws "object store not found".
  // The only repair is to drop and recreate. This is safe: it triggers solely
  // when a required store is already absent (so there is no data in it to lose),
  // never on a healthy DB.
  const missing = REQUIRED_STORES.filter(name => !db.objectStoreNames.contains(name));
  if (missing.length) {
    console.warn('[db] Rebuilding corrupted lolly DB — missing stores:', missing.join(', '));
    db.close();
    await idbDelete(DB_NAME);
    db = await openOnce();
  }

  return db;
}
