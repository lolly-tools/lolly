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

import { openDB as idbOpen } from 'idb';

const DB_NAME = 'lolly';
const DB_VERSION = 2;

export function openDB() {
  return idbOpen(DB_NAME, DB_VERSION, {
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
    },
    blocking() {
      // A newer version of the app wants to open the DB; close this connection
      // so the upgrade isn't blocked across tabs.
      this.close();
    },
  });
}
