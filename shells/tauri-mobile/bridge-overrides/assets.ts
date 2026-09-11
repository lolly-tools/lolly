// SPDX-License-Identifier: MPL-2.0
/**
 * Durable user-asset storage for the Tauri MOBILE shell - the platform seam only
 * (plan 216 item 2).
 *
 * The web assets bridge (shells/web/src/bridge/assets.ts) keeps a user's uploads
 * in IndexedDB, bytes inline. iOS purges WKWebView site data under storage
 * pressure, so an uploaded Sign initials image - or any upload - could silently
 * vanish, exactly like tool state and loaded packs did before state.ts moved them
 * to the filesystem. This override closes the same hole for uploads: it wraps the
 * IndexedDB handle the web factory is given so every write to the `user-assets`
 * and `user-asset-versions` stores is mirrored to $APPDATA/Lolly/user-assets, and
 * a boot reconcile restores IndexedDB from disk after a purge. All of that logic
 * lives in ../../tauri-shared/bridge-overrides/user-assets-fs.ts (shared with a
 * future desktop adoption, the state-fs.ts pattern); this file is only the
 * @tauri-apps/plugin-fs adapter and the substitution.
 *
 * The resolveId plugin in vite.config.js swaps this module in for
 * shells/web/src/bridge/assets.ts for every importer inside bridge/, so this file
 * must carry that module's FULL public surface or a sibling that imports one of
 * its other exports fails the build (bridge/sequence-render.ts pulls assetIdForUrl
 * + MAX_CREDENTIAL_SCAN_BYTES; catalog/sync + the picker pull others). The star
 * re-export forwards them; the local createAssetsAPI below shadows the starred one
 * per ES module semantics - the export.ts override's exact pattern.
 */
import {
  BaseDirectory, exists, mkdir, readFile, writeFile, readTextFile, writeTextFile, readDir, remove,
} from '@tauri-apps/plugin-fs';
import { createAssetsAPI as createWebAssetsAPI } from '../../web/src/bridge/assets.ts';
import {
  createFsMirroredAssetsDb, type UserAssetsFs, type RealAssetsDb,
} from '../../tauri-shared/bridge-overrides/user-assets-fs.ts';

export * from '../../web/src/bridge/assets.ts';

// Rides the SAME app-data filesystem as state.ts and pack-store: NOT the
// user-visible Documents/Files area (uploads are private; only finished EXPORTS
// belong there, via bridge-overrides/export.ts). Application Support is the app's
// own container - persistent, backed up, and NOT WKWebView site data, so the OS
// storage-pressure purge that clears IndexedDB leaves it standing, which is the
// whole point.
const appDataFs: UserAssetsFs = {
  exists: (path) => exists(path, { baseDir: BaseDirectory.AppData }),
  mkdirRecursive: (path) => mkdir(path, { baseDir: BaseDirectory.AppData, recursive: true }),
  readFile: (path) => readFile(path, { baseDir: BaseDirectory.AppData }),
  writeFile: (path, bytes) => writeFile(path, bytes, { baseDir: BaseDirectory.AppData }),
  readTextFile: (path) => readTextFile(path, { baseDir: BaseDirectory.AppData }),
  writeTextFile: (path, text) => writeTextFile(path, text, { baseDir: BaseDirectory.AppData }),
  readDirNames: async (path) => (await readDir(path, { baseDir: BaseDirectory.AppData })).map((entry) => entry.name),
  removeFile: (path) => remove(path, { baseDir: BaseDirectory.AppData }),
  removeDirRecursive: (path) => remove(path, { baseDir: BaseDirectory.AppData, recursive: true }),
};

/**
 * Same signature as the web factory (the resolveId swap requires substitutability):
 * wrap the IndexedDB handle in the filesystem mirror, then hand the WRAPPED handle
 * to the real web assets factory - which passes it through to asset-history too, so
 * head bytes AND version snapshots are both mirrored, with no change to the web
 * bridge's own logic.
 */
export function createAssetsAPI(
  db: Parameters<typeof createWebAssetsAPI>[0],
  opts: Parameters<typeof createWebAssetsAPI>[1] = {},
): ReturnType<typeof createWebAssetsAPI> {
  const mirrored = createFsMirroredAssetsDb(
    db as unknown as RealAssetsDb,
    appDataFs,
    (level, message, ctx) => console[level === 'error' ? 'error' : 'warn'](`[lolly:user-assets] ${message}`, ctx ?? ''),
  );
  return createWebAssetsAPI(mirrored as unknown as Parameters<typeof createWebAssetsAPI>[0], opts);
}
