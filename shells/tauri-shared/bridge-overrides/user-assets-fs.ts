// SPDX-License-Identifier: MPL-2.0
/**
 * Durable filesystem mirror for user-uploaded assets - shared by the Tauri shells
 * over an injected `fs` adapter, the state-fs.ts / pack-store-fs.ts pattern (plan
 * 216 item 2).
 *
 * WHY IT EXISTS
 * A user's uploads (Sign's initials, a placed headshot, a regenerated voiceover)
 * live in IndexedDB - the `user-assets` head store and the `user-asset-versions`
 * history store, each record carrying its bytes inline as a Blob (see
 * shells/web/src/bridge/assets.ts + asset-history.ts). iOS purges WKWebView site
 * data (IndexedDB included) under storage pressure, so an upload could silently
 * vanish - the exact hole state-fs.ts and pack-store-fs.ts already closed for tool
 * state and loaded brand packs. This closes it for uploads.
 *
 * WHAT IT DOES
 * It wraps the IndexedDB handle the web assets bridge is handed. IndexedDB stays
 * the working store - reads are unchanged and fast, so nothing on the hot gallery
 * path pays a filesystem cost - and every WRITE to the two user-asset stores is
 * ALSO mirrored to the app-data filesystem: the bytes as a `.bin`, and a `.json`
 * sidecar carrying the record's metadata (type, format, version, checksum, meta,
 * Content Credential, AI flag). Deletes are mirrored too. Because the sidecar
 * preserves the full record and the versions get their own byte snapshots, the
 * whole index is RECONSTRUCTIBLE from the filesystem alone - which is what a
 * storage purge needs.
 *
 * RECONCILE ON BOOT (both directions, best-effort)
 *   fs -> IndexedDB: any asset/version on disk but missing from IndexedDB (a purge
 *                    happened) is restored - bytes and metadata both.
 *   IndexedDB -> fs: any asset/version in IndexedDB but not yet on disk (a write
 *                    that crashed before its mirror, or a first run over an
 *                    already-populated DB) is mirrored - so the two self-heal.
 * Reconcile runs against the RAW handle, so it never waits on itself; user-store
 * operations through the wrapper wait for it (`ready`) so a read never races a
 * half-finished restore and shows an empty library that then repopulates.
 *
 * The bytes are DUPLICATED (IndexedDB working copy + filesystem durable copy).
 * That is deliberate: the durable copy is the one that must survive, and under the
 * very storage pressure that motivates this the OS purges the IndexedDB copy,
 * collapsing the duplication to one. Uploads on a phone are typically small
 * (signatures, a headshot); the safety is worth the transient overhead.
 *
 * Storage layout under the app-data root:
 *   user-assets/heads/<enc(id)>.json            head record, minus its Blob
 *   user-assets/heads/<enc(id)>.bin             head record's bytes
 *   user-assets/versions/<enc(assetId)>/<enc(version)>.json   snapshot, minus Blob
 *   user-assets/versions/<enc(assetId)>/<enc(version)>.bin    snapshot's bytes
 * enc = the engine's reversible filesystem-safe token codec (fs-token.ts), the
 * same one state-fs.ts names its files with; the id/assetId/version are also
 * stored inside each sidecar, so reconstruction never needs to decode a filename.
 */

import { encodeFsToken } from '../../../engine/src/fs-token.ts';

/** The filesystem surface this backend needs, paths relative to the app-data root.
 *  Byte-identical to PackFs; each shell binds it to @tauri-apps/plugin-fs. */
export interface UserAssetsFs {
  exists(path: string): Promise<boolean>;
  mkdirRecursive(path: string): Promise<void>;
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, bytes: Uint8Array): Promise<void>;
  readTextFile(path: string): Promise<string>;
  writeTextFile(path: string, text: string): Promise<void>;
  /** Entry NAMES, not entry objects. */
  readDirNames(path: string): Promise<string[]>;
  removeFile(path: string): Promise<void>;
  removeDirRecursive(path: string): Promise<void>;
}

/** A user-asset head record as the assets bridge stores it (bytes inline). */
interface UserAssetRecord {
  id: string;
  type: string;
  format: string;
  version?: string;
  blob?: Blob;
  checksum?: string;
  width?: number;
  height?: number;
  meta?: Record<string, unknown>;
  credential?: Uint8Array;
  credentialFormat?: string;
  aiGenerated?: 'full' | 'partial';
}

/** A version snapshot as asset-history stores it ([assetId, version] keyed). */
interface VersionSnapshot {
  assetId: string;
  version: string;
  savedAt: number;
  sha256: string;
  bytes: number;
  record: UserAssetRecord;
}

/** The slice of the IndexedDB handle this wrapper calls into. Deliberately loose
 *  (`unknown` keys / `any` results): it forwards to a real idb `IDBPDatabase`, and
 *  the web assets + asset-history modules are the ones that type each call. */
interface RealStore {
  get(key: unknown): Promise<unknown>;
  getAll(query?: unknown): Promise<unknown[]>;
  put(value: unknown, key?: unknown): Promise<unknown>;
  add(value: unknown, key?: unknown): Promise<unknown>;
  delete(key: unknown): Promise<unknown>;
}
interface RealTx {
  store?: unknown;
  objectStore(name: string): RealStore;
  done: Promise<unknown>;
}
export interface RealAssetsDb {
  objectStoreNames: { contains(name: string): boolean };
  get(store: string, key: unknown): Promise<unknown>;
  getAll(store: string, query?: unknown): Promise<unknown[]>;
  getAllKeys(store: string, query?: unknown): Promise<unknown[]>;
  put(store: string, value: unknown, key?: unknown): Promise<unknown>;
  add(store: string, value: unknown, key?: unknown): Promise<unknown>;
  delete(store: string, key: unknown): Promise<unknown>;
  transaction(stores: unknown, mode?: unknown): RealTx;
}

const HEAD_STORE = 'user-assets';
const VERSION_STORE = 'user-asset-versions';
const ROOT = 'user-assets';
const HEADS = `${ROOT}/heads`;
const VERSIONS = `${ROOT}/versions`;

const headJson = (id: string): string => `${HEADS}/${encodeFsToken(id)}.json`;
const headBin = (id: string): string => `${HEADS}/${encodeFsToken(id)}.bin`;
const versionDir = (assetId: string): string => `${VERSIONS}/${encodeFsToken(assetId)}`;
const versionJson = (assetId: string, version: string): string => `${versionDir(assetId)}/${encodeFsToken(version)}.json`;
const versionBin = (assetId: string, version: string): string => `${versionDir(assetId)}/${encodeFsToken(version)}.bin`;

/** Uint8Array -> base64, chunked so a large credential never overflows the
 *  call stack via String.fromCharCode(...spread). */
function bytesToB64(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** The head record without its Blob - the `.json` sidecar shape. */
function headSidecar(rec: UserAssetRecord): Record<string, unknown> {
  return {
    id: rec.id,
    type: rec.type,
    format: rec.format,
    version: rec.version,
    checksum: rec.checksum,
    width: rec.width,
    height: rec.height,
    meta: rec.meta,
    credentialB64: rec.credential ? bytesToB64(rec.credential) : undefined,
    credentialFormat: rec.credentialFormat,
    aiGenerated: rec.aiGenerated,
    blobType: rec.blob?.type ?? undefined,
    blobBytes: rec.blob?.size ?? undefined,
  };
}

/** Reconstruct a head record from its sidecar JSON + optional bytes. */
function headFromSidecar(side: Record<string, unknown>, bytes: Uint8Array | null): UserAssetRecord {
  const blobType = typeof side.blobType === 'string' ? side.blobType : '';
  const rec: UserAssetRecord = {
    id: String(side.id),
    type: String(side.type),
    format: String(side.format),
    version: typeof side.version === 'string' ? side.version : undefined,
    checksum: typeof side.checksum === 'string' ? side.checksum : undefined,
    width: typeof side.width === 'number' ? side.width : undefined,
    height: typeof side.height === 'number' ? side.height : undefined,
    meta: (side.meta && typeof side.meta === 'object') ? side.meta as Record<string, unknown> : undefined,
    credentialFormat: typeof side.credentialFormat === 'string' ? side.credentialFormat : undefined,
    aiGenerated: side.aiGenerated === 'full' || side.aiGenerated === 'partial' ? side.aiGenerated : undefined,
  };
  if (typeof side.credentialB64 === 'string') rec.credential = b64ToBytes(side.credentialB64);
  if (bytes) rec.blob = new Blob([bytes as BlobPart], blobType ? { type: blobType } : undefined);
  return rec;
}

/** A version snapshot without its inline Blob - the `.json` sidecar shape. */
function versionSidecar(snap: VersionSnapshot): Record<string, unknown> {
  return {
    assetId: snap.assetId,
    version: snap.version,
    savedAt: snap.savedAt,
    sha256: snap.sha256,
    bytes: snap.bytes,
    record: headSidecar(snap.record),
  };
}

function versionFromSidecar(side: Record<string, unknown>, bytes: Uint8Array | null): VersionSnapshot {
  const rec = headFromSidecar((side.record ?? {}) as Record<string, unknown>, bytes);
  return {
    assetId: String(side.assetId),
    version: String(side.version),
    savedAt: typeof side.savedAt === 'number' ? side.savedAt : 0,
    sha256: typeof side.sha256 === 'string' ? side.sha256 : '',
    bytes: typeof side.bytes === 'number' ? side.bytes : (bytes?.length ?? 0),
    record: rec,
  };
}

type LogFn = (level: 'warn' | 'error' | 'info', message: string, ctx?: Record<string, unknown>) => void;

/**
 * Wrap an IndexedDB handle so writes to the two user-asset stores mirror to the
 * filesystem and a boot reconcile keeps the two in sync both ways. Returns an
 * object the web `createAssetsAPI` (and, through it, asset-history) can use exactly
 * like the raw handle - every non-user-store call passes straight through.
 */
export function createFsMirroredAssetsDb<T extends RealAssetsDb>(realDb: T, fs: UserAssetsFs, log: LogFn = () => {}): T {
  const hasVersions = (): boolean => realDb.objectStoreNames.contains(VERSION_STORE);

  // ── filesystem mirror primitives ────────────────────────────────────────────
  async function ensureDir(path: string): Promise<void> {
    if (!(await fs.exists(path))) await fs.mkdirRecursive(path);
  }

  async function mirrorHead(rec: UserAssetRecord): Promise<void> {
    await ensureDir(HEADS);
    // Skip rewriting identical bytes: a rename / meta edit keeps the same version
    // and byte count, so only the sidecar changes. A replace bumps the version.
    let writeBin = Boolean(rec.blob);
    if (rec.blob) {
      try {
        if (await fs.exists(headJson(rec.id))) {
          const prev = JSON.parse(await fs.readTextFile(headJson(rec.id))) as Record<string, unknown>;
          if (prev.version === rec.version && prev.blobBytes === rec.blob.size && await fs.exists(headBin(rec.id))) {
            writeBin = false;
          }
        }
      } catch { /* unreadable prior sidecar - rewrite both */ }
    }
    if (writeBin && rec.blob) await fs.writeFile(headBin(rec.id), new Uint8Array(await rec.blob.arrayBuffer()));
    await fs.writeTextFile(headJson(rec.id), JSON.stringify(headSidecar(rec)));
  }

  async function mirrorVersion(snap: VersionSnapshot): Promise<void> {
    await ensureDir(versionDir(snap.assetId));
    // A version is immutable: [assetId, version] names one fixed set of bytes, so
    // once the `.bin` is on disk it never changes. Write it only if absent.
    if (snap.record.blob && !(await fs.exists(versionBin(snap.assetId, snap.version)))) {
      await fs.writeFile(versionBin(snap.assetId, snap.version), new Uint8Array(await snap.record.blob.arrayBuffer()));
    }
    await fs.writeTextFile(versionJson(snap.assetId, snap.version), JSON.stringify(versionSidecar(snap)));
  }

  async function removeHeadFiles(id: string): Promise<void> {
    if (await fs.exists(headJson(id))) await fs.removeFile(headJson(id));
    if (await fs.exists(headBin(id))) await fs.removeFile(headBin(id));
  }

  async function removeVersionFiles(assetId: string, version: string): Promise<void> {
    if (await fs.exists(versionJson(assetId, version))) await fs.removeFile(versionJson(assetId, version));
    if (await fs.exists(versionBin(assetId, version))) await fs.removeFile(versionBin(assetId, version));
  }

  async function removeAllVersionsOf(assetId: string): Promise<void> {
    if (await fs.exists(versionDir(assetId))) await fs.removeDirRecursive(versionDir(assetId));
  }

  // Mirror one just-committed write; never throws (the bytes are already durable
  // in IndexedDB, and boot reconcile re-mirrors anything missed).
  async function mirrorWrite(store: string, value: unknown): Promise<void> {
    try {
      if (store === HEAD_STORE) await mirrorHead(value as UserAssetRecord);
      else if (store === VERSION_STORE) await mirrorVersion(value as VersionSnapshot);
    } catch (err) {
      log('warn', 'user-asset fs mirror (write) failed; boot reconcile will retry', { store, error: String(err) });
    }
  }

  async function mirrorDelete(store: string, key: unknown): Promise<void> {
    try {
      if (store === HEAD_STORE) {
        await removeHeadFiles(String(key));
      } else if (store === VERSION_STORE) {
        // asset-history deletes one version by [id, version] or ALL versions of an
        // id by an IDBKeyRange over [id, ''] .. [id, '￿'].
        if (Array.isArray(key)) await removeVersionFiles(String(key[0]), String(key[1]));
        else {
          const lower = (key as { lower?: unknown }).lower;
          if (Array.isArray(lower)) await removeAllVersionsOf(String(lower[0]));
        }
      }
    } catch (err) {
      log('warn', 'user-asset fs mirror (delete) failed', { store, error: String(err) });
    }
  }

  // ── boot reconcile (both directions), against the RAW handle ─────────────────
  async function restoreHeadsFromFs(): Promise<void> {
    let names: string[];
    try { names = await fs.readDirNames(HEADS); } catch { return; }
    for (const name of names) {
      if (!name.endsWith('.json')) continue;
      try {
        const side = JSON.parse(await fs.readTextFile(`${HEADS}/${name}`)) as Record<string, unknown>;
        const id = String(side.id);
        if (!id || await realDb.get(HEAD_STORE, id)) continue; // present in IDB - IDB wins
        const binPath = headBin(id);
        const bytes = (side.blobBytes && await fs.exists(binPath)) ? await fs.readFile(binPath) : null;
        await realDb.put(HEAD_STORE, headFromSidecar(side, bytes));
      } catch (err) {
        log('warn', 'could not restore a user-asset head from fs', { name, error: String(err) });
      }
    }
  }

  async function restoreVersionsFromFs(): Promise<void> {
    if (!hasVersions()) return;
    let assetDirs: string[];
    try { assetDirs = await fs.readDirNames(VERSIONS); } catch { return; }
    for (const dir of assetDirs) {
      let files: string[];
      try { files = await fs.readDirNames(`${VERSIONS}/${dir}`); } catch { continue; }
      for (const name of files) {
        if (!name.endsWith('.json')) continue;
        try {
          const side = JSON.parse(await fs.readTextFile(`${VERSIONS}/${dir}/${name}`)) as Record<string, unknown>;
          const assetId = String(side.assetId), version = String(side.version);
          if (!assetId || !version) continue;
          if (await realDb.get(VERSION_STORE, [assetId, version])) continue;
          const binPath = versionBin(assetId, version);
          const bytes = await fs.exists(binPath) ? await fs.readFile(binPath) : null;
          await realDb.put(VERSION_STORE, versionFromSidecar(side, bytes));
        } catch (err) {
          log('warn', 'could not restore a user-asset version from fs', { dir, name, error: String(err) });
        }
      }
    }
  }

  async function catchUpFsFromIdb(): Promise<void> {
    try {
      const heads = await realDb.getAll(HEAD_STORE) as UserAssetRecord[];
      for (const rec of heads) {
        if (rec?.id && !(await fs.exists(headJson(rec.id)))) await mirrorHead(rec);
      }
    } catch (err) {
      log('warn', 'user-asset head catch-up mirror failed', { error: String(err) });
    }
    if (!hasVersions()) return;
    try {
      const snaps = await realDb.getAll(VERSION_STORE) as VersionSnapshot[];
      for (const snap of snaps) {
        if (snap?.assetId && snap?.version && !(await fs.exists(versionJson(snap.assetId, snap.version)))) await mirrorVersion(snap);
      }
    } catch (err) {
      log('warn', 'user-asset version catch-up mirror failed', { error: String(err) });
    }
  }

  const ready: Promise<void> = (async () => {
    // Restore first (a purged IndexedDB is refilled from disk), then catch up (an
    // un-mirrored write reaches disk). Order matters only on a genuinely
    // inconsistent boot; on a healthy one both passes find everything already in
    // place and do nothing.
    await restoreHeadsFromFs();
    await restoreVersionsFromFs();
    await catchUpFsFromIdb();
  })().catch((err) => {
    // A failed reconcile must not brick the app: degrade to IndexedDB-only, which
    // is exactly today's (pre-mirror) behaviour.
    log('error', 'user-asset fs reconcile failed; using IndexedDB only this session', { error: String(err) });
  });

  const isUserStore = (name: string): boolean => name === HEAD_STORE || name === VERSION_STORE;

  // ── the wrapped handle ───────────────────────────────────────────────────────
  const wrapper: RealAssetsDb = {
    get objectStoreNames() { return realDb.objectStoreNames; },
    async get(store, key) {
      if (isUserStore(store)) await ready;
      return realDb.get(store, key);
    },
    async getAll(store, query) {
      if (isUserStore(store)) await ready;
      return realDb.getAll(store, query);
    },
    async getAllKeys(store, query) {
      if (isUserStore(store)) await ready;
      return realDb.getAllKeys(store, query);
    },
    async put(store, value, key) {
      if (!isUserStore(store)) return realDb.put(store, value, key);
      await ready;
      const result = await realDb.put(store, value, key);
      await mirrorWrite(store, value);
      return result;
    },
    async add(store, value, key) {
      if (!isUserStore(store)) return realDb.add(store, value, key);
      await ready;
      const result = await realDb.add(store, value, key);
      await mirrorWrite(store, value);
      return result;
    },
    async delete(store, key) {
      if (!isUserStore(store)) return realDb.delete(store, key);
      await ready;
      const result = await realDb.delete(store, key);
      await mirrorDelete(store, key);
      return result;
    },
    transaction(stores, mode) {
      const list = Array.isArray(stores) ? stores.map(String) : [String(stores)];
      // Only a transaction that TOUCHES a user store needs mirroring; every other
      // transaction (asset-meta / asset-blob sync + prune) passes straight through.
      if (!list.some(isUserStore)) return realDb.transaction(stores, mode);
      const realTx = realDb.transaction(stores, mode);
      const captured: Array<{ store: string; value: unknown }> = [];
      return {
        get store() { return realTx.store; },
        objectStore(name: string): RealStore {
          const real = realTx.objectStore(name);
          if (!isUserStore(name)) return real;
          // Forward every op to the real store synchronously (no async interleaving
          // that could let the idb transaction auto-commit early). put/add ALSO
          // record the value so it can be mirrored to disk once `done` commits.
          return {
            get: (k) => real.get(k),
            getAll: (q) => real.getAll(q),
            delete: (k) => real.delete(k),
            put: (value, key) => { captured.push({ store: name, value }); return real.put(value, key); },
            add: (value, key) => { captured.push({ store: name, value }); return real.add(value, key); },
          };
        },
        get done() {
          // Mirror AFTER the transaction commits, so a filesystem write never sits
          // inside the idb transaction. A mirror failure is logged, not thrown -
          // the bytes are already durable in IndexedDB and boot reconcile retries.
          return realTx.done.then(async () => {
            for (const { store, value } of captured) await mirrorWrite(store, value);
          });
        },
      } as RealTx;
    },
  };

  return wrapper as T;
}
