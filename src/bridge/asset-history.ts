// SPDX-License-Identifier: MPL-2.0
/** Immutable byte snapshots beside the stable user asset id. No silent eviction. */
import type { VersionedUserAsset, UserAssetVersion } from './asset-history-types.ts';
export type { VersionedUserAsset, UserAssetVersion } from './asset-history-types.ts';
import { designMaterialOf } from '../../../../engine/src/design-system.ts';
import { FROZEN_PREFIX } from './version-assets.ts';
import { collectAssetRefs } from './asset-dependencies.ts';

/** Lowercase hex SHA-256, the same digest core's image-operation contract uses.
 *  Local on purpose: importing it from lib/file-conversion.ts re-exports the whole
 *  core image-operation module, and this file is reached from the assets bridge
 *  on the boot path (scripts/check-bundle-budget.ts). */
async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
// Same structural seam as AssetsDb: IDB in production, narrow test adapters in
// unit suites. Old adapters can read/write current assets without inventing history.
interface HistoryDb {
  objectStoreNames?: { contains(name: string): boolean };
  get(store: string, key: any): Promise<any>;
  getAll(store: string, query?: any): Promise<any[]>;
  put(store: string, value: any): Promise<any>;
  delete(store: string, key: any): Promise<any>;
  transaction(stores: any, mode: any): any;
}
const available = (db: HistoryDb): boolean => Boolean(db.objectStoreNames?.contains('user-asset-versions'));
export const ASSET_HISTORY_LIMIT = 512 * 1024 * 1024;

/** Includes snapshots whose current asset was deleted. They remain recoverable. */
export async function allUserAssetVersions(db: HistoryDb): Promise<UserAssetVersion[]> {
  return available(db) ? db.getAll('user-asset-versions') : [];
}

export async function validateUserAssetVersion(snapshot: UserAssetVersion): Promise<void> {
  const r = snapshot?.record;
  if (!snapshot || typeof snapshot.assetId !== 'string' || !snapshot.assetId.startsWith('user/') || snapshot.assetId.length > 1024 || snapshot.assetId.startsWith(FROZEN_PREFIX)
    || typeof snapshot.version !== 'string' || !snapshot.version || snapshot.version.length > 256
    || !Number.isSafeInteger(snapshot.savedAt) || snapshot.savedAt < 0
    || !Number.isSafeInteger(snapshot.bytes) || snapshot.bytes < 0 || snapshot.bytes > 256 * 1024 * 1024
    || !/^[a-f0-9]{64}$/.test(snapshot.sha256) || r?.id !== snapshot.assetId || r?.version !== snapshot.version
    || typeof r.format !== 'string' || !r.format || r.format.length > 100 || !['vector', 'raster', 'video', 'audio', 'lottie', 'model', 'lut', 'palette', 'tokens', 'font', 'profile', 'ratecard', 'text', 'data'].includes(r.type)
    || r.credential != null && (!(r.credential instanceof Uint8Array) || r.credential.byteLength > 16 * 1024 * 1024)
    || !(r.blob instanceof Blob) || r.blob.size !== snapshot.bytes) throw new Error('Invalid saved asset version in backup.');
  if (await sha256Bytes(new Uint8Array(await r.blob.arrayBuffer())) !== snapshot.sha256) throw new Error('Saved asset version integrity check failed.');
}

/** Immutable identity: an import may add a snapshot, never replace its bytes. */
export async function importUserAssetVersion(db: HistoryDb, snapshot: UserAssetVersion): Promise<void> {
  if (!available(db)) throw new Error('This shell does not support saved asset versions.');
  await validateUserAssetVersion(snapshot);
  const saved = await db.get('user-asset-versions', [snapshot.assetId, snapshot.version]) as UserAssetVersion | undefined;
  // A repeat import must not report recovery success for an unreadable existing
  // copy. Hash outside the IDB transaction so it cannot auto-commit mid-check.
  if (saved) await validateUserAssetVersion(saved);
  const tx = db.transaction(['user-assets', 'user-asset-versions'], 'readwrite');
  const history = tx.objectStore('user-asset-versions');
  const existing = await history.get([snapshot.assetId, snapshot.version]) as UserAssetVersion | undefined;
  const head = await tx.objectStore('user-assets').get(snapshot.assetId) as VersionedUserAsset | undefined;
  if (existing || head?.version === snapshot.version) {
    const checksum = existing?.sha256 ?? head?.checksum;
    if (checksum !== snapshot.sha256) { await tx.done; throw new Error('This asset version already identifies different bytes. The existing version was kept.'); }
    if (existing) { await tx.done; return; }
  }
  const all = await history.getAll() as UserAssetVersion[];
  if (all.filter(v => v.assetId === snapshot.assetId).length >= 20 || all.reduce((n, v) => n + v.bytes + (v.record.credential?.byteLength ?? 0), 0) + snapshot.bytes + (snapshot.record.credential?.byteLength ?? 0) > ASSET_HISTORY_LIMIT) { await tx.done; throw new Error('Saved asset version storage is full. Keep the backup and remove older versions before retrying.'); }
  await history.add(snapshot); await tx.done;
}

/**
 * `mode` says what a version collision means. 'replace' (uploads, edits, the
 * tokens head - every content-change writer) treats `incoming.version` as the
 * cache-buster it always was: when it names bytes that already exist under that
 * version, the previous bytes are snapshotted and the write is stored under a
 * fresh version, exactly as an unversioned write is. 'import' (backup restore) is
 * the strict path: a version is a stable identity there, so different bytes
 * under an existing version are refused and the existing asset is kept.
 */
export async function writeVersionedUserAsset(db: HistoryDb, incoming: VersionedUserAsset, expectedVersion?: string | null, mode: 'replace' | 'import' = 'replace'): Promise<void> {
  // null is insert-only, used by explicit result reuse. Fail closed on legacy
  // adapters rather than weakening its cross-tab no-overwrite guarantee.
  if (expectedVersion === null && !available(db)) throw new Error('This shell cannot guarantee an insert-only asset write.');
  if (!available(db) || incoming.id.startsWith(FROZEN_PREFIX)) { await db.put('user-assets', incoming); return; }
  const previous = await db.get('user-assets', incoming.id) as VersionedUserAsset | undefined;
  if (expectedVersion === null ? Boolean(previous) : expectedVersion !== undefined && previous?.version !== expectedVersion) throw new Error('This asset changed elsewhere. Reload it before replacing bytes.');
  // Bound the hashing/snapshot path. Existing large assets are not deleted or truncated.
  if (Math.max(previous?.blob?.size ?? 0, incoming.blob?.size ?? 0) > 256 * 1024 * 1024) throw new Error('This asset is too large for local version history. Save a separate copy instead.');
  const digest = previous?.blob ? await sha256Bytes(new Uint8Array(await previous.blob.arrayBuffer())) : undefined;
  const incomingDigest = incoming.blob ? await sha256Bytes(new Uint8Array(await incoming.blob.arrayBuffer())) : undefined;
  const tx = db.transaction(['user-assets', 'user-asset-versions'], 'readwrite');
  const live = await tx.objectStore('user-assets').get(incoming.id) as VersionedUserAsset | undefined;
  if (live?.version !== previous?.version || Boolean(live) !== Boolean(previous)) { await tx.done; throw new Error('This asset changed elsewhere. Reload it before replacing bytes.'); }
  const history = tx.objectStore('user-asset-versions');
  // Backup re-imports must not change a stable version's meaning or create a new
  // head every time sync pulls identical bytes. Metadata may still be refreshed.
  let mintVersion = false;
  if (incoming.version && incomingDigest) {
    const pinned = await history.get([incoming.id, incoming.version]) as UserAssetVersion | undefined;
    const sameVersion = incoming.version === previous?.version;
    if (sameVersion && digest === incomingDigest) {
      await tx.objectStore('user-assets').put({ ...incoming, checksum: incomingDigest }); await tx.done; return;
    }
    const collides = Boolean(pinned && pinned.sha256 !== incomingDigest) || sameVersion && digest !== incomingDigest;
    if (collides) {
      if (mode === 'import') { await tx.done; throw new Error('This asset version already identifies different bytes. The existing asset was kept.'); }
      mintVersion = true;
    }
  }
  // A design-system head is a continuously saved document. Its explicit
  // checkpoints/published versions live in the design-system history; treating
  // every colour drag as a file replacement locked editing after 20 saves.
  // Keep legacy snapshots intact, but do not add automatic file snapshots for
  // head edits. Imports and published version assets retain the strict policy.
  const continuousHead = mode === 'replace' && incoming.type === 'tokens' && designMaterialOf(incoming.id)?.kind === 'tokens';
  if (previous?.blob && digest && !continuousHead) {
    const version = previous.version || `legacy-${digest}`;
    if (!await history.get([incoming.id, version])) {
      const all = await history.getAll() as UserAssetVersion[];
      if (all.filter(v => v.assetId === incoming.id).length >= 20 || all.reduce((n, v) => n + v.bytes + (v.record.credential?.byteLength ?? 0), 0) + previous.blob.size + (previous.credential?.byteLength ?? 0) > ASSET_HISTORY_LIMIT) { await tx.done; throw new Error('Saved asset versions are full. Download and remove an older version, or save this as a separate asset.'); }
      await history.add({ assetId: incoming.id, version, savedAt: Date.now(), sha256: digest, bytes: previous.blob.size, record: { ...previous, version } } satisfies UserAssetVersion);
    }
  }
  await tx.objectStore('user-assets').put({ ...incoming, checksum: incomingDigest, version: incoming.version && !mintVersion && incoming.version !== previous?.version ? incoming.version : crypto.randomUUID() });
  await tx.done;
}
export async function listUserAssetVersions(db: HistoryDb, id: string): Promise<UserAssetVersion[]> {
  if (!available(db)) return [];
  return (await db.getAll('user-asset-versions', IDBKeyRange.bound([id, ''], [id, '\uffff'])) as UserAssetVersion[]).sort((a, b) => b.savedAt - a.savedAt);
}
export async function readUserAssetVersion(db: HistoryDb, id: string, version?: string): Promise<VersionedUserAsset | null> {
  const current = await db.get('user-assets', id) as VersionedUserAsset | undefined;
  if (!version || current?.version === version) return current ?? null;
  if (!available(db)) return null;
  const snapshot = await db.get('user-asset-versions', [id, version]) as UserAssetVersion | undefined;
  if (!snapshot?.record.blob) return null;
  if (await sha256Bytes(new Uint8Array(await snapshot.record.blob.arrayBuffer())) !== snapshot.sha256) throw new Error('Saved asset version integrity check failed.');
  return snapshot.record;
}
export async function removeUserAssetVersions(db: HistoryDb, id: string, version?: string): Promise<void> {
  if (!available(db)) return;
  // Serialize deletion with saves/checkpoints. A preflight outside this
  // transaction lets another tab commit a pin while its bytes are removed.
  const roots = ['state', 'revisions', 'revision-recovery'].filter(store => db.objectStoreNames?.contains(store));
  const tx = db.transaction(['user-asset-versions', ...roots], 'readwrite');
  void tx.done.catch(() => {});
  try {
    const refs = await dependencyRoots(tx, roots);
    const versions = await tx.objectStore('user-asset-versions').getAll(IDBKeyRange.bound([id, ''], [id, '\uffff'])) as UserAssetVersion[];
    for (const snapshot of versions) {
      if (version && snapshot.version !== version) continue;
      if (refs.has(`${id}:${snapshot.record.format}:${snapshot.version}`)) throw new Error('This version is used by a saved creation or retained history. Remove those references before deleting it.');
      await tx.objectStore('user-asset-versions').delete([id, snapshot.version]);
    }
    await tx.done;
  } catch (error) { try { tx.abort(); } catch {} await tx.done.catch(() => {}); throw error; }
}

/** Current bytes can also be a retained revision's only copy. */
export async function deleteUserAsset(db: HistoryDb, id: string): Promise<void> {
  if (!available(db)) { await db.delete('user-assets', id); return; }
  const roots = ['state', 'revisions', 'revision-recovery'].filter(store => db.objectStoreNames?.contains(store));
  const tx = db.transaction(['user-assets', ...roots], 'readwrite'); void tx.done.catch(() => {});
  try {
    const record = await tx.objectStore('user-assets').get(id) as VersionedUserAsset | undefined;
    if (record?.version && (await dependencyRoots(tx, roots)).has(`${id}:${record.format}:${record.version}`)) {
      throw new Error('This asset is used by a saved creation or retained history. Remove those references before deleting it.');
    }
    await tx.objectStore('user-assets').delete(id); await tx.done;
  } catch (error) { try { tx.abort(); } catch {} await tx.done.catch(() => {}); throw error; }
}

async function dependencyRoots(tx: any, stores: string[]): Promise<Set<string>> {
  const refs = new Set<string>();
  for (const store of stores) {
    let cursor = await tx.objectStore(store).openCursor();
    while (cursor) {
      const row = cursor.value;
      for (const key of row.assetRefs ?? []) refs.add(key);
      if (row.data) collectAssetRefs(row.data, refs);
      cursor = await cursor.continue();
    }
  }
  return refs;
}
