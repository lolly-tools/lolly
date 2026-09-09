// SPDX-License-Identifier: MPL-2.0
/**
 * Filesystem-backed state for the Tauri DESKTOP shell - the platform seam only.
 *
 * Replaces the IndexedDB state bridge (shells/web/src/bridge/state.ts) at build
 * time via the resolveId override in vite.config.js. The API surface must stay in
 * sync with that file - tools, the engine, the gallery and catalog sync never see
 * which implementation is running, so a missing method (e.g. sizes) crashes boot.
 *
 * Storage: $APPDATA/Lolly/saved-state/<slot>.json
 *
 * The logic (slot-name codec, legacy-filename migration, record shape, asset-ref
 * collection) is shared with the mobile shell in ../../tauri-shared/bridge-overrides/state-fs.ts;
 * it used to be a byte-identical copy in both shells, so a fix had to be applied
 * twice. All that is left here is the `@tauri-apps/plugin-fs` binding: this shell
 * owns that dependency (the Tauri shells are not npm workspaces, so the parent repo
 * cannot resolve it), and it is where desktop-only storage behaviour would go.
 */

import {
  BaseDirectory,
  exists,
  mkdir,
  readTextFile,
  writeTextFile,
  readFile,
  writeFile,
  readDir,
  remove,
} from '@tauri-apps/plugin-fs';
import { createFsStateAPI, type StateFs } from '../../tauri-shared/bridge-overrides/state-fs.ts';
import type { StateDb, WebStateAPI } from '../../web/src/bridge/state.ts';
// The revision-history bridge imports collectAssetRefs via ./state.ts, which this shell aliases
// to this override; re-export the pure helper so the aliased module carries it (web state.ts owns it).
export { collectAssetRefs } from '../../web/src/bridge/state.ts';

// Paths are relative to $APPDATA/Lolly. readDirNames flattens tauri's entry
// objects to names, which is all the shared logic reads.
const appDataFs: StateFs = {
  exists: (path) => exists(path, { baseDir: BaseDirectory.AppData }),
  mkdirRecursive: (path) => mkdir(path, { baseDir: BaseDirectory.AppData, recursive: true }),
  readTextFile: (path) => readTextFile(path, { baseDir: BaseDirectory.AppData }),
  writeTextFile: (path, text) => writeTextFile(path, text, { baseDir: BaseDirectory.AppData }),
  readDirNames: async (path) =>
    (await readDir(path, { baseDir: BaseDirectory.AppData })).map((entry) => entry.name),
  remove: (path) => remove(path, { baseDir: BaseDirectory.AppData }),
};

// createStateAPI signature matches the web shell (db param ignored - not needed here).
export function createStateAPI(_db: StateDb): WebStateAPI {
  return createFsStateAPI(appDataFs);
}

// ── Instance-pack store backend (plans/132 wave 3) ────────────────────────────
// The pack store rides the SAME app-data filesystem as the state above: iOS
// purges WKWebView site data under storage pressure, so a loaded brand pack
// must not live only in IndexedDB (a purged device silently lost the brand
// until the .lolly was re-opened). Installed at module init - this override is
// on the bridge boot path, ahead of initInstanceBase()'s initPackStore(),
// which also migrates any legacy IndexedDB copy across once.
import { setPackStoreBackend } from '../../web/src/lib/pack-store.ts';
import { createFsPackDb, type PackFs } from '../../tauri-shared/bridge-overrides/pack-store-fs.ts';

const packFs: PackFs = {
  exists: (path) => exists(path, { baseDir: BaseDirectory.AppData }),
  mkdirRecursive: (path) => mkdir(path, { baseDir: BaseDirectory.AppData, recursive: true }),
  readFile: (path) => readFile(path, { baseDir: BaseDirectory.AppData }),
  writeFile: (path, bytes) => writeFile(path, bytes, { baseDir: BaseDirectory.AppData }),
  readTextFile: (path) => readTextFile(path, { baseDir: BaseDirectory.AppData }),
  writeTextFile: (path, text) => writeTextFile(path, text, { baseDir: BaseDirectory.AppData }),
  readDirNames: async (path) =>
    (await readDir(path, { baseDir: BaseDirectory.AppData })).map((entry) => entry.name),
  removeFile: (path) => remove(path, { baseDir: BaseDirectory.AppData }),
  removeDirRecursive: (path) => remove(path, { baseDir: BaseDirectory.AppData, recursive: true }),
};
setPackStoreBackend(createFsPackDb(packFs));
