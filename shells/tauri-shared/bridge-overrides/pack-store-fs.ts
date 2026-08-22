// SPDX-License-Identifier: MPL-2.0
/**
 * Filesystem backend for the instance-pack store (plans/132 wave 3) - shared
 * by BOTH Tauri shells over an injected fs adapter, the state-fs.ts pattern.
 *
 * Why it exists: the web pack store (shells/web/src/lib/pack-store.ts) keeps a
 * loaded `.lolly` pack's catalog bytes in IndexedDB, and iOS purges WKWebView
 * site data under storage pressure - a purged device silently loses the loaded
 * brand until the pack is re-opened. Tool STATE was already protected the same
 * way (bridge-overrides/state.ts); this closes the same hole for the pack.
 * Desktop rides it too, for consistency and so one implementation serves both.
 *
 * What it implements: the narrow `PackDb` surface pack-store consumes -
 * 'pack-files' (binary values keyed by canonical root-relative path) plus the
 * single meta record pack-store keeps under its 'profile' key. Layout under
 * the app-data root:
 *
 *   pack-store/meta.json          the InstancePackMeta record
 *   pack-store/files/<b64url>     one file per entry, name = base64url(key)
 *
 * base64url because keys are paths ('/catalog/assets/suse/…') - slashes and
 * anything else a filesystem might object to never reach the filename.
 * Wiring: each shell's bridge-overrides/state.ts builds a PackFs from its own
 * @tauri-apps/plugin-fs import and calls pack-store's setPackStoreBackend()
 * with createFsPackDb(fs); pack-store migrates any legacy IndexedDB copy on
 * first init (one-shot, see its initPackStore).
 */

/** The fs surface this backend needs - binary siblings of state-fs's StateFs.
 *  Paths are relative to the shell's app-data root. */
export interface PackFs {
  exists(path: string): Promise<boolean>;
  mkdirRecursive(path: string): Promise<void>;
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, bytes: Uint8Array): Promise<void>;
  readTextFile(path: string): Promise<string>;
  writeTextFile(path: string, text: string): Promise<void>;
  readDirNames(path: string): Promise<string[]>;
  removeFile(path: string): Promise<void>;
  removeDirRecursive(path: string): Promise<void>;
}

const ROOT = 'pack-store';
const FILES = `${ROOT}/files`;
const META = `${ROOT}/meta.json`;

const enc = (key: string): string =>
  btoa(String.fromCharCode(...new TextEncoder().encode(key)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const dec = (name: string): string => {
  const b64 = name.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

/** The PackDb surface pack-store consumes (kept in step with its declaration -
 *  the shapes are small enough that drift fails typecheck at the caller). */
export interface FsPackDb {
  get(store: string, key: string): Promise<unknown>;
  put(store: string, value: unknown, key: string): Promise<unknown>;
  delete(store: string, key: string): Promise<unknown>;
  clear(store: string): Promise<unknown>;
  getAllKeys(store: string): Promise<unknown[]>;
  transaction(stores: string[], mode: 'readwrite'): {
    objectStore(name: string): { put(value: unknown, key: string): unknown; clear(): unknown };
    done: Promise<unknown>;
  };
}

export function createFsPackDb(fs: PackFs): FsPackDb {
  const ensureFiles = async (): Promise<void> => {
    if (!(await fs.exists(FILES))) await fs.mkdirRecursive(FILES);
  };

  const getMeta = async (): Promise<unknown> => {
    try {
      if (!(await fs.exists(META))) return undefined;
      return JSON.parse(await fs.readTextFile(META));
    } catch { return undefined; }
  };

  return {
    async get(store, key) {
      if (store === 'profile') return getMeta();
      const path = `${FILES}/${enc(key)}`;
      if (!(await fs.exists(path))) return undefined;
      return fs.readFile(path);
    },
    async put(store, value, key) {
      if (store === 'profile') {
        if (!(await fs.exists(ROOT))) await fs.mkdirRecursive(ROOT);
        await fs.writeTextFile(META, JSON.stringify(value));
        return;
      }
      await ensureFiles();
      await fs.writeFile(`${FILES}/${enc(key)}`, value as Uint8Array);
    },
    async delete(store, key) {
      const path = store === 'profile' ? META : `${FILES}/${enc(key)}`;
      if (await fs.exists(path)) await fs.removeFile(path);
    },
    async clear(store) {
      if (store === 'profile') {
        if (await fs.exists(META)) await fs.removeFile(META);
        return;
      }
      if (await fs.exists(FILES)) await fs.removeDirRecursive(FILES);
    },
    async getAllKeys(store) {
      if (store === 'profile') return (await getMeta()) === undefined ? [] : ['instance-pack-meta'];
      if (!(await fs.exists(FILES))) return [];
      return (await fs.readDirNames(FILES)).map(dec);
    },
    transaction(_stores, _mode) {
      // Ops are QUEUED as thunks and executed sequentially when `done` is
      // awaited - queued order IS the semantic order (pack-store queues a
      // clear, then its puts, then awaits done; starting them eagerly would
      // race the directory removal against the writes that follow it).
      const ops: Array<() => Promise<unknown>> = [];
      let run: Promise<unknown> | null = null;
      const self = this;
      return {
        objectStore: (name: string) => ({
          put: (value: unknown, key: string) => { ops.push(() => self.put(name, value, key)); },
          clear: () => { ops.push(() => self.clear(name)); },
        }),
        get done() {
          run ??= ops.reduce<Promise<unknown>>((chain, op) => chain.then(op), Promise.resolve());
          return run;
        },
      };
    },
  };
}
