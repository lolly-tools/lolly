// SPDX-License-Identifier: MPL-2.0
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { designMaterialOf } from '../../../../engine/src/design-system.ts';
/** Idle catalog-cache housekeeping, loaded after catalog synchronization. */
import type { AssetsDb, AssetMetaRecord, TrashedUserAssetRow } from './assets.ts';
import { assetFileMetas } from './asset-file-meta.ts';

export async function pruneAssetCache(db: AssetsDb, currentAssets: AssetMetaRecord[], sessionBlobKeys: Set<string>, keepIds: Set<string>, urls: { evict(key: string): void; evictPrefix(prefix: string): void }): Promise<{ blobs: number; meta: number }> {
  const cacheAssets = (await Promise.all(currentAssets.map(a => Array.isArray(a.meta?.assetFiles) ? assetFileMetas(a) : [a]))).flat();

  // All keys that exist at the current catalog version.
  const currentVersionKeys = new Set(
    cacheAssets.flatMap(a => a.formats.map(f => `${a.id}:${f.format}:${a.version}`)),
  );

  // Core-tier blobs are kept unconditionally (needed for offline).
  const keepBlobKeys = new Set(
    cacheAssets
      .filter(a => a.tier === 'core')
      .flatMap(a => a.formats.map(f => `${a.id}:${f.format}:${a.version}`)),
  );

  // Non-core blobs are kept only if a saved session references them (and they're current).
  for (const key of sessionBlobKeys) {
    if (currentVersionKeys.has(key)) keepBlobKeys.add(key);
  }

  const validIds = new Set(currentAssets.map(a => a.id));

  const [allBlobKeys, allMetaKeys] = await Promise.all([
    db.getAllKeys('asset-blob'),
    db.getAllKeys('asset-meta'),
  ]);

  // keepIds: asset ids whose blobs must survive a catalog version bump,
  // the offline-download and pinned-tool sets. Version-exact refs would
  // let the bump prune these blobs BEFORE the idle re-prefetch has
  // fetched the new version; if that re-fetch then fails (flaky airport
  // wifi is this feature's home turf), the user's explicit download
  // would be gone. So an OLD-version blob of a kept id survives exactly
  // until the current-version copy is actually on device, then it
  // prunes like anything else, so kept ids don't accumulate one blob per
  // version forever.
  const presentBlobKeys = new Set(allBlobKeys as string[]);
  const currentKeyFor = new Map<string, string>();  // `${id}:${format}` → current-version key
  for (const a of cacheAssets) {
    for (const f of a.formats) currentKeyFor.set(`${a.id}:${f.format}`, `${a.id}:${f.format}:${a.version}`);
  }
  const keptById = (k: string): boolean => {
    for (const id of keepIds) {
      if (!k.startsWith(`${id}:`) && !k.startsWith(`${id}?file=`)) continue;
      const idFormat = k.slice(0, k.lastIndexOf(':'));
      const current = currentKeyFor.get(idFormat);
      return !current || !presentBlobKeys.has(current) || k === current;
    }
    return false;
  };
  const staleBlobs = allBlobKeys.filter(k => !keepBlobKeys.has(k) && !(keepIds.size && keptById(k)));
  const staleMeta  = allMetaKeys.filter(k => !validIds.has(k));

  if (staleBlobs.length) {
    const tx = db.transaction('asset-blob', 'readwrite');
    await Promise.all(staleBlobs.map(k => tx.store.delete(k)));
    await tx.done;
    // Revoke whatever live object URLs minted for these now-deleted blobs.
    // toAssetRef keys library URLs as `library:<blobKey>` and themed
    // icon bakes as `library:<blobKey>:t:<theme>:<colours>`. Evict both
    // forms, or the OBJECT_URL_CACHE leaks one entry per pruned blob per
    // sync.
    for (const k of staleBlobs) {
      urls.evict(`library:${k}`);
      urls.evictPrefix(`library:${k}:t:`);   // themed icon bakes
      urls.evictPrefix(`library:${k}:pt:`);  // photo treatment bakes
      urls.evictPrefix(`library:${k}:look:`); // photo look bakes (plan 291 W7)
    }
  }
  if (staleMeta.length) {
    const tx = db.transaction('asset-meta', 'readwrite');
    await Promise.all(staleMeta.map(k => tx.store.delete(k)));
    await tx.done;
  }

  return { blobs: staleBlobs.length, meta: staleMeta.length };
}

/** Write fresh metadata and retire bytes when a DAM changes URLs without a version bump. */
export async function syncAssetIndex(db: AssetsDb, assets: AssetMetaRecord[], source: { origin: string; tokensHead?: string | null } | undefined, invalidate: (key: string) => void): Promise<void> {
  const old = new Map((await db.getAll('asset-meta')).map(meta => [meta.id, meta]));
  for (const incoming of assets) {
    const previous = old.get(incoming.id);
    if (!previous || previous.version !== incoming.version || JSON.stringify(previous.formats) === JSON.stringify(incoming.formats)) continue;
    const variants = Array.isArray(previous.meta?.assetFiles) ? assetFileMetas(previous) : [previous];
    for (const variant of variants) for (const format of variant.formats) {
      const key = `${variant.id}:${format.format}:${variant.version}`;
      await db.delete('asset-blob', key);
      invalidate(key);
      
    }
  }
  const tx = db.transaction('asset-meta', 'readwrite');
  await Promise.all(assets.map(a => tx.store.put(a)));
  await tx.done;
  if (source) await db.put('profile', source, 'catalog-source');
}

/** Read resolved bytes on demand; foreign origins belong to the network allowlist. */
export async function assetBytes(target: AssetRef | string): Promise<Uint8Array> {
  const url = typeof target === 'string' ? target : target.original?.url ?? target.url;
  if (!url) throw new Error('asset has no url');
  const ok = url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('/')
    || (typeof location !== 'undefined' && url.startsWith(location.origin + '/'));
  if (!ok) throw new Error(`host.assets.bytes: ${url.slice(0, 40)} is not an asset url of this origin - use host.net.fetch with an allowlist`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`host.assets.bytes: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Export-time credential inspection, loaded only when credentials are requested. */
import { isZzfxmRef } from '../../../../engine/src/zzfxm-ref.ts';
import { parseThemedAssetId, parseTreatedAssetId } from '../../../../engine/src/asset-modifiers.ts';
type Credential = { store: Uint8Array; format: string } | null;
export async function assetCredential(db: AssetsDb, id: string, resolve: (id: string) => Promise<AssetRef>, cache: Map<string, Credential>, maxBytes: number): Promise<Credential> {
  // A procedural ref identifies a song that is COMPOSED on demand - there are no
  // stored bytes to carry a credential, and fetching the scheme only produces
  // the browser's own "cannot load" console error before the catch below.
  if (isZzfxmRef(id)) return null;
  if (id.startsWith('user/')) {
    const rec = await db.get('user-assets', id);
    if (!rec?.credential || !rec.credentialFormat) return null;
    return { store: rec.credential, format: rec.credentialFormat };
  }
  const cached = cache.get(id);
  if (cached !== undefined) return cached;
  let out: { store: Uint8Array; format: string } | null = null;
  try {
    const themed = parseThemedAssetId(id), treated = parseTreatedAssetId(id);
    const ref = await resolve(themed.theme ? themed.baseId : treated.baseId);
    const blob = await (await fetch(ref.url)).blob();
    if (blob.size <= maxBytes) {
      const { extractC2paStore } = await import('../../../../engine/src/c2pa-verify.ts');
      const ex = extractC2paStore(new Uint8Array(await blob.arrayBuffer()));
      if (ex) out = { store: ex.store, format: ex.format };
    }
  } catch { /* unresolvable asset → no credential */ }
  cache.set(id, out);
  return out;
}

export async function designMaterialSizes(db: AssetsDb): Promise<Record<string, number>> {
  const all = await db.getAll('user-assets');
  const out: Record<string, number> = {};
  for (const r of all) {
    const material = designMaterialOf(String(r?.id ?? ''));
    if (!material) continue;
    out[material.systemId] = (out[material.systemId] ?? 0) + (r?.blob?.size ?? 0);
  }
  return out;
}

export async function setUserAssetTrashed(db: AssetsDb, id: string, trashedAt: string | null, setOpts: { expect?: string | null }): Promise<boolean> {
  const rec = await db.get('user-assets', id);
  if (!rec) return false;
  if (setOpts.expect !== undefined && (rec.trashedAt ?? null) !== setOpts.expect) return false;
  if (trashedAt) rec.trashedAt = trashedAt; else delete rec.trashedAt;
  await db.put('user-assets', rec);
  return true;
}

export async function listTrashedUserAssets(db: AssetsDb): Promise<TrashedUserAssetRow[]> {
  return (await db.getAll('user-assets'))
    .filter(r => typeof r.trashedAt === 'string' && r.trashedAt)
    .map(r => ({
      id: r.id, type: r.type, name: String(r.meta?.name ?? r.id.split('/').pop() ?? r.id),
      ...(typeof r.meta?.family === 'string' ? { family: r.meta.family } : {}),
      trashedAt: r.trashedAt!, bytes: r.blob?.size ?? 0,
    }));
}

export async function checkQuotaRoom(incomingBytes: number, fraction: number): Promise<void> {
  let est: StorageEstimate | undefined;
  try {
    est = await navigator.storage?.estimate?.();
  } catch {
    return; // estimate() failing must not block uploads.
  }
  if (!est?.quota) return;
  const projected = (est.usage ?? 0) + incomingBytes;
  if (projected > est.quota * fraction) {
    throw Object.assign(new Error('Not enough local storage space for this image. Remove some saved images or sessions and try again.'), { code: 'STORAGE_FULL' });
  }
}

export async function updateUserAssetMeta(db: AssetsDb, id: string, meta: Record<string, unknown>, patch: { aiGenerated?: 'full' | 'partial' | null }, clearMemo: (id: string) => void): Promise<void> {
  const rec = await db.get('user-assets', id);
  if (!rec) return;
  rec.meta = { ...meta, modifiedAt: Date.now() };   // an edit, stamped like a rename
  // null WITHDRAWS a declaration (the catalog's Origins control): the
  // record-level flag and its memo go, so the next list re-derives from
  // the file's own credential - a signed declaration cannot be cleared
  // away, only a user's assertion can.
  if (patch.aiGenerated === null) {
    delete rec.aiGenerated;
    clearMemo(id);
  } else if (patch.aiGenerated) {
    rec.aiGenerated = patch.aiGenerated;
  }
  await db.put('user-assets', rec);
}

/** Replace bytes only after pin preservation; keep history and cached views coherent. */
export async function replaceUserAssetBytes(db: AssetsDb, id: string, patch: { blob: Blob; credential?: Uint8Array; credentialFormat?: string; meta?: Record<string, unknown> }, replaceOpts: { keepModifiedAt?: boolean }, fraction: number, actions: { preserve?: (id: string) => Promise<void>; clearMemo(id: string): void; evictPrefix(prefix: string): void }): Promise<void> {
  await actions.preserve?.(id);
  const rec = await db.get('user-assets', id);
  if (!rec) return;
  await checkQuotaRoom(patch.blob.size, fraction); // the old bytes remain in version history
  const previousVersion = rec.version;
  rec.blob = patch.blob;
  if (patch.credential && patch.credentialFormat) {
    rec.credential = patch.credential;
    rec.credentialFormat = patch.credentialFormat;
  } else {
    delete rec.credential;
    delete rec.credentialFormat;
  }
  // The AI-kind memo is keyed by id and valid only while the bytes under
  // that id do not change. These bytes just changed.
  actions.clearMemo(id);
  rec.meta = { ...rec.meta, ...patch.meta, bytes: patch.blob.size,
    ...(replaceOpts.keepModifiedAt ? {} : { modifiedAt: Date.now() }) };
  rec.version = String(Date.now());   // cache-buster - object URLs key on id:format:version
  await (await import('./asset-history.ts')).writeVersionedUserAsset(db, rec, previousVersion);
  // The bump only stops a NEW ref from reusing the old URL; the old URL
  // itself stays in the cache and keeps resolving to bytes that no longer
  // exist, so anything still holding it plays the previous take. Revoke
  // them here, the same way a delete does, and let holders re-resolve
  // through get() - a regenerated voiceover whose box still pointed at the
  // pre-rewrite URL played the old audio under the new cuts.
  actions.evictPrefix(`user:${id}:`);
}

export async function renameUserAsset(db: AssetsDb, id: string, name: string): Promise<void> {
  const rec = await db.get('user-assets', id);
  if (!rec) return;
  // A metadata edit is an edit: stamp it, so the newer-copy import rule
  // (lib/backup-sessions.ts) carries it to another browser (plan 277 P7).
  rec.meta = { ...rec.meta, name, modifiedAt: Date.now() };
  await db.put('user-assets', rec);
}

export async function listNamedUserAssetVersions(db: AssetsDb, id: string) {
  return (await (await import('./asset-history.ts')).listUserAssetVersions(db, id)).map(({ record, ...version }) => ({ ...version, name: String(record.meta?.name || id), format: record.format }));
}
