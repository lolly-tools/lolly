// SPDX-License-Identifier: MPL-2.0
/** Atomic local adoption of reviewed material, with compare-and-swap and recovery. */
import { DEFAULT_DESIGN_SYSTEM_ID, SHIPPED_DESIGN_SYSTEM_ID, designSystemHeadId, designSystemNamespace, isDesignSystemId } from '../../../../engine/src/design-system.ts';
import { sha256Hex } from '../../../../engine/src/bytes.ts';
import { collectAssetTokens, readVersionIndex, frozenAssetId } from '../../../../engine/src/design-version.ts';
import { brandResourceAssetIds } from '../../../../engine/src/brand-resources.ts';
import type { VersionedUserAsset } from './asset-history-types.ts';
import type { IDBPDatabase } from 'idb';
import type { DesignSystemRecord } from '../lib/design-system/registry.ts';
import { ACTIVE_DESIGN_SYSTEM_KEY, DESIGN_SYSTEMS_STORE } from '../lib/design-system/registry.ts';

type Row = VersionedUserAsset;
interface ReadStore {
  get(key: IDBValidKey): Promise<unknown>;
}
interface WriteStore extends ReadStore {
  put(value: unknown, key?: IDBValidKey): Promise<unknown>;
  delete(key: IDBValidKey): Promise<unknown>;
}
interface AdoptionTransaction<Store> {
  objectStore(name: string): Store; done: Promise<unknown>; abort(): void;
}
export interface AdoptionDb {
  transaction(stores: string[], mode: 'readonly'): AdoptionTransaction<ReadStore>;
  transaction(stores: string[], mode: 'readwrite'): AdoptionTransaction<WriteStore>;
}

/** Adapt idb's mode-dependent methods to the small storage contract used here. */
export function adoptionDatabase(db: IDBPDatabase): AdoptionDb {
  return { transaction(stores: string[], mode: 'readonly' | 'readwrite') {
    const tx = db.transaction(stores, mode);
    return { done: tx.done, abort: () => tx.abort(), objectStore(name: string) {
      const store = tx.objectStore(name);
      return { get: (key: IDBValidKey) => store.get(key),
        put(value: unknown, key?: IDBValidKey) { if (!store.put) throw new Error('This transaction is read-only.'); return store.put(value, key); },
        delete(key: IDBValidKey) { if (!store.delete) throw new Error('This transaction is read-only.'); return store.delete(key); },
      };
    } };
  } };
}
export interface AdoptionSnapshot {
  readonly activeId: string;
  readonly record: DesignSystemRecord;
  readonly isNew: boolean;
}
export interface AdoptionCandidate {
  readonly digest: string;
  readonly record: DesignSystemRecord;
  readonly resourceCount: number;
}
interface Before {
  activeId: string; record: DesignSystemRecord | null; head: Row | null;
  target: DesignSystemRecord; explicit: boolean;
  resources?: Array<{ id: string; version?: string; checksum?: string }>;
}
interface Prepared { before: Before; record: DesignSystemRecord; head: Row; assets: Row[] }
interface Receipt { version: 1; before: Before; after: DesignSystemRecord; headVersion: string }
const STORES = ['user-assets', DESIGN_SYSTEMS_STORE, 'profile'];
const recoveryKey = (id: string): string => `brand-adoption-recovery:${id}`;
const equal = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const sameRecord = (a: DesignSystemRecord | null | undefined, b: DesignSystemRecord | null | undefined): boolean => {
  const material = (r: DesignSystemRecord | null | undefined) => r ? { ...r, lastUsedAt: 0 } : null;
  return equal(material(a), material(b));
};
const conflict = (): Error => new Error('This design system changed while you were reviewing. Close this review and try again.');

/** No external work runs inside a transaction; hashing and decoding finish first. */
export function createBrandAdoptionAPI(db: AdoptionDb, changed: () => void, quota: (bytes: number) => Promise<void> = async () => {}, prepareAsset: (row: Row) => Promise<void> = async () => {}) {
  const snapshots = new WeakMap<AdoptionSnapshot, Before>();
  const candidates = new WeakMap<AdoptionCandidate, Prepared>();

  async function capture(opts: { system?: string; create?: DesignSystemRecord; label?: string } = {}): Promise<AdoptionSnapshot> {
    const tx = db.transaction(STORES, 'readonly');
    const activeId = await tx.objectStore('profile').get(ACTIVE_DESIGN_SYSTEM_KEY) as string | undefined ?? SHIPPED_DESIGN_SYSTEM_ID;
    const active = await tx.objectStore(DESIGN_SYSTEMS_STORE).get(activeId) as DesignSystemRecord | undefined;
    const id = opts.create?.id ?? opts.system ?? (activeId === SHIPPED_DESIGN_SYSTEM_ID ? DEFAULT_DESIGN_SYSTEM_ID : activeId);
    const record = await tx.objectStore(DESIGN_SYSTEMS_STORE).get(id) as DesignSystemRecord | undefined;
    const now = Date.now();
    const target = record ?? opts.create ?? {
      id, label: opts.label || 'My design system', ns: designSystemNamespace(id), headId: designSystemHeadId(id),
      source: { kind: 'local' as const }, locked: false, createdAt: now, lastUsedAt: now,
    };
    const head = await tx.objectStore('user-assets').get(target.headId) as Row | undefined;
    await tx.done;
    if (opts.create && record || opts.system && !record || target.source.kind === 'shipped' || !target.ns) throw conflict();
    if (!isDesignSystemId(id) || target.ns !== designSystemNamespace(id) || target.headId !== designSystemHeadId(id)) throw new Error('Invalid design-system identity.');
    if (target.locked || !opts.system && !opts.create && active?.locked) throw new Error('This design system is fixed and cannot be changed.');
    const before: Before = structuredClone({ activeId, record: record ?? null, head: head ?? null, target, explicit: !!opts.system || !!opts.create });
    const doc = head?.blob ? JSON.parse(await head.blob.text()) : null;
    const ids = new Set([...collectAssetTokens(doc).map(r => r.id), ...brandResourceAssetIds(doc), ...(record?.importedFonts ?? [])]);
    for (const version of readVersionIndex(doc).versions) for (const pin of version.assets ?? []) ids.add(pin.frozenId ?? pin.id);
    const resources = db.transaction(['user-assets'], 'readonly');
    before.resources = [];
    for (const resourceId of ids) {
      if (!resourceId.startsWith('user/')) continue;
      const resource = await resources.objectStore('user-assets').get(resourceId) as Row | undefined;
      if (resource) before.resources.push({ id: resourceId, version: resource.version, checksum: resource.checksum });
    }
    await resources.done;
    const snapshot = Object.freeze({ activeId, record: structuredClone(target), isNew: !record });
    snapshots.set(snapshot, before);
    return snapshot;
  }

  async function prepare(snapshot: AdoptionSnapshot, input: { doc: unknown; assets?: Row[]; labelIfNew?: string; appearance?: DesignSystemRecord['appearance']; importedFonts?: string[] }): Promise<AdoptionCandidate> {
    const before = snapshots.get(snapshot);
    if (!before) throw new Error('This review expired. Open the source again.');
    if (!input.doc || typeof input.doc !== 'object' || Array.isArray(input.doc)) throw new Error('Expected a token document.');
    const text = JSON.stringify(input.doc);
    const documentBytes = new TextEncoder().encode(text);
    if (documentBytes.byteLength > 8 * 1024 * 1024 || (input.assets?.length ?? 0) > 512) throw new Error('This design system is too large to apply in one operation.');
    const record = structuredClone(before.target);
    if (!before.record && input.labelIfNew) record.label = input.labelIfNew.slice(0, 200);
    if (input.appearance) record.appearance = structuredClone(input.appearance);
    if (input.importedFonts) record.importedFonts = [...input.importedFonts];
    const assets = structuredClone(input.assets ?? []);
    if (new Set(assets.map(r => r.id)).size !== assets.length) throw new Error('This design system repeats a resource identity.');
    let bytes = documentBytes.byteLength;
    for (const row of assets) {
      if (!row.blob || row.blob.size > 64 * 1024 * 1024) throw new Error('A design-system resource is missing or too large.');
      row.checksum = await sha256Hex(new Uint8Array(await row.blob.arrayBuffer()));
      if ((!row.id.startsWith(record.ns) && row.id !== frozenAssetId(row.checksum)) || row.id === record.headId) throw new Error('A design-system resource is outside its namespace.');
      bytes += row.blob.size;
      if (bytes > 256 * 1024 * 1024) throw new Error('This design system is too large to apply in one operation.');
      row.version ||= crypto.randomUUID();
      row.meta = { ...row.meta, modifiedAt: Date.now() };
      await prepareAsset(row);
    }
    const head: Row = { id: record.headId, type: 'tokens', format: 'json', blob: new Blob([text], { type: 'application/json' }), version: crypto.randomUUID(), checksum: await sha256Hex(documentBytes), meta: { name: record.label, modifiedAt: Date.now() } };
    await quota(bytes + (before.head?.blob?.size ?? 0));
    const digest = await sha256Hex(new TextEncoder().encode(JSON.stringify({ record, head: head.checksum, assets: assets.map(r => [r.id, r.checksum]) })));
    const candidate = Object.freeze({ digest, record: structuredClone(record), resourceCount: assets.length });
    candidates.set(candidate, { before, record, head, assets });
    return candidate;
  }

  async function commit(candidate: AdoptionCandidate, opts: { activate?: boolean; recovery?: boolean } = {}): Promise<void> {
    const prepared = candidates.get(candidate);
    if (!prepared) throw new Error('This review expired. Open the source again.');
    const { before, record, head, assets } = prepared;
    const tx = db.transaction(STORES, 'readwrite');
    void tx.done.catch(() => {});
    try {
      const rows = tx.objectStore('user-assets');
      const systems = tx.objectStore(DESIGN_SYSTEMS_STORE);
      const profile = tx.objectStore('profile');
      const active = await profile.get(ACTIVE_DESIGN_SYSTEM_KEY) as string | undefined ?? SHIPPED_DESIGN_SYSTEM_ID;
      const live = await rows.get(head.id) as Row | undefined;
      const current = await systems.get(record.id) as DesignSystemRecord | undefined;
      if (active !== before.activeId || !sameRecord(current, before.record) || live?.version !== before.head?.version || live?.checksum !== before.head?.checksum || Boolean(live) !== Boolean(before.head)) throw conflict();
      if (!before.explicit && (current?.locked || (await systems.get(active) as DesignSystemRecord | undefined)?.locked)) throw new Error('This design system is fixed and cannot be changed.');
      for (const expected of before.resources ?? []) {
        const resource = await rows.get(expected.id) as Row | undefined;
        if (!resource || resource.version !== expected.version || resource.checksum !== expected.checksum) throw conflict();
      }
      for (const row of assets) {
        const existing = await rows.get(row.id) as Row | undefined;
        if (existing && (existing.checksum !== row.checksum || existing.type !== row.type || existing.format !== row.format)) throw conflict();
        if (!existing) await rows.put(row);
      }
      // The recovery record and all material share the same commit boundary.
      if (opts.recovery !== false) await profile.put({ version: 1, before, after: record, headVersion: head.version! } satisfies Receipt, recoveryKey(record.id));
      await rows.put(head);
      await systems.put(record);
      if (opts.activate !== false) await profile.put(record.id, ACTIVE_DESIGN_SYSTEM_KEY);
      await tx.done;
    } catch (error) { try { tx.abort(); } catch { /* already aborted */ } await tx.done.catch(() => {}); throw error; }
    candidates.delete(candidate);
    changed();
  }

  async function recovery(id: string): Promise<{ label: string } | null> {
    const tx = db.transaction(STORES, 'readonly');
    const receipt = await tx.objectStore('profile').get(recoveryKey(id)) as Receipt | undefined;
    const current = await tx.objectStore(DESIGN_SYSTEMS_STORE).get(id) as DesignSystemRecord | undefined;
    const head = current && await tx.objectStore('user-assets').get(current.headId) as Row | undefined;
    const active = await tx.objectStore('profile').get(ACTIVE_DESIGN_SYSTEM_KEY);
    const prior = receipt && await tx.objectStore(DESIGN_SYSTEMS_STORE).get(receipt.before.activeId) as DesignSystemRecord | undefined;
    await tx.done;
    return receipt?.version === 1 && prior && active === id && !current?.locked && sameRecord(current, receipt.after) && head?.version === receipt.headVersion
      ? { label: receipt.before.record?.label ?? prior?.label ?? 'the previous design system' } : null;
  }

  async function restore(id: string): Promise<void> {
    const tx = db.transaction(STORES, 'readwrite');
    void tx.done.catch(() => {});
    try {
      const profile = tx.objectStore('profile');
      const systems = tx.objectStore(DESIGN_SYSTEMS_STORE);
      const rows = tx.objectStore('user-assets');
      const receipt = await profile.get(recoveryKey(id)) as Receipt | undefined;
      if (receipt?.version !== 1 || await profile.get(ACTIVE_DESIGN_SYSTEM_KEY) !== id) throw conflict();
      const current = await systems.get(id) as DesignSystemRecord | undefined;
      if (!await systems.get(receipt.before.activeId)) throw new Error('The previous design system is no longer on this device.');
      const head = await rows.get(receipt.after.headId) as Row | undefined;
      if (!sameRecord(current, receipt.after) || head?.version !== receipt.headVersion || current?.locked) throw conflict();
      for (const expected of receipt.before.resources ?? []) {
        const resource = await rows.get(expected.id) as Row | undefined;
        if (!resource || resource.version !== expected.version || resource.checksum !== expected.checksum) throw new Error('A file used by the previous system changed or was removed. Restore that file before undoing this import.');
      }
      if (receipt.before.head) await rows.put({ ...receipt.before.head, version: crypto.randomUUID() });
      else await rows.delete(receipt.after.headId);
      if (receipt.before.record) await systems.put(receipt.before.record);
      else await systems.delete(id);
      await profile.put(receipt.before.activeId, ACTIVE_DESIGN_SYSTEM_KEY);
      await profile.delete(recoveryKey(id));
      await tx.done;
    } catch (error) { try { tx.abort(); } catch { /* already aborted */ } await tx.done.catch(() => {}); throw error; }
    changed();
  }
  return { capture, prepare, commit, recovery, restore };
}
export type BrandAdoptionAPI = ReturnType<typeof createBrandAdoptionAPI>;
