// SPDX-License-Identifier: MPL-2.0
/**
 * registry.ts - the design systems this device holds, and which one is active
 * (plans/186 sections 3.1, 3.3 and 4).
 *
 * Before this module a device had one design system and it had no name of its
 * own: it was whatever asset answered to `user/tokens/brand`, or failing that the
 * shipped catalog's tokens asset. This registry gives each design system a
 * RECORD - a slug, a label, a source, a namespace and a head id - and keeps ONE
 * pointer to the active record in the profile KV store. The material itself
 * stays where it lives today (user-asset rows, the pack store); a record is the
 * device's index of it, small on purpose.
 *
 * Two rules the rest of the feature depends on:
 *   - The pre-existing material is never re-keyed. The migrated `default` record
 *     keeps `user/` as its namespace and `user/tokens/brand` as its head, because
 *     saved sessions reference placed asset ids and rewriting them would break
 *     every session on the device. New systems mint under `user/ds/<id>/`.
 *   - `shipped` always exists and cannot be removed. It names the build's own
 *     catalog tokens asset, is what a fresh install runs on, and is what a person
 *     switches back to after removing everything else.
 *
 * DOM-free. The store is opened through the shared connection (bridge/db.ts);
 * the pack meta read for the migration comes from lib/pack-store.ts. Every read
 * of the active record is memoised until `bust()`, because the tokens bridge
 * asks for it on the boot path and the answer only changes on a switch.
 */
import type { DesignSystemSummary } from '@lolly-tools/core/host-v1';
import {
  DEFAULT_DESIGN_SYSTEM_ID, SHIPPED_DESIGN_SYSTEM_ID, designSystemHeadId, designSystemNamespace,
  isDesignSystemId,
} from '../../../../../engine/src/design-system.ts';
import { getPackMeta } from '../pack-store.ts';

/** The object store (bridge/db.ts, DB v17) and the profile-KV pointer key. */
export const DESIGN_SYSTEMS_STORE = 'design-systems';
export const ACTIVE_DESIGN_SYSTEM_KEY = 'active-design-system';

/** The signature verdict a pack import recorded (lib/pack-store.ts). */
export type PackSignature = 'verified' | 'unverified' | 'unsigned';

export type DesignSystemSource =
  | { kind: 'shipped' }
  | { kind: 'local'; forkedFrom?: { id: string; version?: string } }
  | {
      kind: 'file'; fileName?: string; publisher?: string; version?: string;
      /** An instance pack loaded from disk can still own the catalog base that
       *  travels with this design system. It is cleared when switching away. */
      instance?: string;
      signature: PackSignature;
    }
  | {
      kind: 'hosted';
      instance: string;
      packUrl: string | null;
      publisher?: string;
      version?: string;
      checksum?: string;
      signature: PackSignature;
      lastCheckedAt?: number;
      lastSyncedAt?: number;
      /** A change was noticed while offline; the row says "Update available when online". */
      stale?: boolean;
    };

export interface DesignSystemRecord {
  /** Slug, `DESIGN_SYSTEM_ID_RE` - the server's profile-name grammar. */
  id: string;
  label: string;
  /** Asset-id namespace prefix: `user/` for the migrated default, `user/ds/<id>/`
   *  for everything minted since, `` for the shipped catalog system. */
  ns: string;
  /** The tokens asset the system resolves against. For `shipped` this is the
   *  catalog asset's id, which the bridge discovers; for every other record it
   *  is `${ns}tokens/brand`. */
  headId: string;
  source: DesignSystemSource;
  /** Read-only material (plans/186 section 3.5, the material lock). The BUILD lock
   *  is a different thing and stays on the catalog asset. */
  locked: boolean;
  /** A pack's `prefs.theme`, applied on switch when set. */
  appearance?: { theme?: 'light' | 'dark' | 'brand' };
  createdAt: number;
  lastUsedAt: number;
}

/** The slice of the shared IndexedDB connection this module uses (the `idb` shape). */
export interface RegistryDb {
  get(store: string, key: IDBValidKey): Promise<unknown>;
  put(store: string, value: unknown, key?: IDBValidKey): Promise<unknown>;
  delete(store: string, key: IDBValidKey): Promise<void>;
  getAll(store: string): Promise<unknown[]>;
  /** True when the store exists - a DB rebuilt at an older version has no registry. */
  objectStoreNames: { contains(name: string): boolean };
}

/** What the migration reads to name the shipped and the default records. */
export interface RegistryProbe {
  /** The shipped catalog's tokens asset (name + id), or null when nothing is reachable yet. */
  catalogTokens(): Promise<{ id: string; name?: string; brandLock?: boolean } | null>;
  /** The legacy head's user record, or null when this device never installed one. */
  legacyHead(): Promise<{ meta?: Record<string, unknown> } | null>;
}

export interface DesignSystemRegistry {
  /** Run the one-shot migration if the store is empty; memoised. Safe to await twice. */
  ensure(): Promise<void>;
  list(): Promise<DesignSystemRecord[]>;
  get(id: string): Promise<DesignSystemRecord | null>;
  /** The active record. Never null after ensure(): falls back to `shipped`. */
  active(): Promise<DesignSystemRecord>;
  activeId(): Promise<string>;
  /** Write or replace a record. The id must pass the grammar. */
  put(record: DesignSystemRecord): Promise<void>;
  /** Remove a record. `shipped` is refused; removing the active one activates `shipped`. */
  remove(id: string): Promise<void>;
  /** Point the device at `id`. Does NOT repaint anything - that is switch.ts's job. */
  setActive(id: string): Promise<void>;
  /** The HostV1 view of one record. */
  summary(record: DesignSystemRecord, activeId: string): DesignSystemSummary;
  /** Drop the memoised reads. */
  bust(): void;
}

function isRecord(v: unknown): v is DesignSystemRecord {
  return typeof v === 'object' && v !== null && typeof (v as DesignSystemRecord).id === 'string';
}

export function createDesignSystemRegistry(db: RegistryDb, probe: RegistryProbe): DesignSystemRegistry {
  let ensured: Promise<void> | null = null;
  let listMemo: Promise<DesignSystemRecord[]> | null = null;
  let activeMemo: Promise<string> | null = null;

  const hasStore = (): boolean => db.objectStoreNames.contains(DESIGN_SYSTEMS_STORE);

  async function readAll(): Promise<DesignSystemRecord[]> {
    if (!hasStore()) return [];
    const rows = await db.getAll(DESIGN_SYSTEMS_STORE);
    return rows.filter(isRecord).sort((a, b) => a.createdAt - b.createdAt);
  }

  async function readActiveId(): Promise<string> {
    const stored = await db.get('profile', ACTIVE_DESIGN_SYSTEM_KEY).catch(() => null);
    return typeof stored === 'string' && isDesignSystemId(stored) ? stored : SHIPPED_DESIGN_SYSTEM_ID;
  }

  /** The migration of plans/186 section 4: only ever runs against an EMPTY store. */
  async function migrate(): Promise<void> {
    if (!hasStore()) return;
    const now = Date.now();
    const catalog = await probe.catalogTokens().catch(() => null);
    const shipped: DesignSystemRecord = {
      id: SHIPPED_DESIGN_SYSTEM_ID,
      label: catalog?.name ? stripTokensSuffix(catalog.name) : 'Lolly',
      ns: '',
      headId: catalog?.id ?? '',
      source: { kind: 'shipped' },
      locked: false,
      createdAt: now,
      lastUsedAt: now,
    };
    await db.put(DESIGN_SYSTEMS_STORE, shipped);

    const legacy = await probe.legacyHead().catch(() => null);
    if (!legacy) {
      await db.put('profile', SHIPPED_DESIGN_SYSTEM_ID, ACTIVE_DESIGN_SYSTEM_KEY);
      return;
    }
    // A loaded instance pack IS the default's material today: its fonts and its
    // tokens were written under `user/`. So the default record takes the pack's
    // identity rather than sitting beside it as a second, empty system.
    const pack = getPackMeta();
    const metaName = typeof legacy.meta?.name === 'string' ? legacy.meta.name : '';
    const label = pack?.name || (metaName && metaName !== 'Brand tokens' ? metaName : '') || 'My design system';
    const source: DesignSystemSource = pack
      ? (pack.instance
          ? { kind: 'hosted', instance: pack.instance, packUrl: null, publisher: pack.publisher, version: pack.version, signature: pack.signature, lastSyncedAt: Date.parse(pack.loadedAt) || now }
          : { kind: 'file', publisher: pack.publisher, version: pack.version, signature: pack.signature })
      : { kind: 'local' };
    const record: DesignSystemRecord = {
      id: DEFAULT_DESIGN_SYSTEM_ID,
      label,
      ns: designSystemNamespace(DEFAULT_DESIGN_SYSTEM_ID),
      headId: designSystemHeadId(DEFAULT_DESIGN_SYSTEM_ID),
      source,
      locked: false,
      createdAt: now,
      lastUsedAt: now,
    };
    await db.put(DESIGN_SYSTEMS_STORE, record);
    await db.put('profile', DEFAULT_DESIGN_SYSTEM_ID, ACTIVE_DESIGN_SYSTEM_KEY);
  }

  const api: DesignSystemRegistry = {
    ensure() {
      ensured ??= (async () => {
        const rows = await readAll();
        if (rows.length === 0) await migrate();
      })().catch(() => { ensured = null; });
      return ensured;
    },
    list() {
      listMemo ??= api.ensure().then(readAll);
      return listMemo;
    },
    async get(id) {
      return (await api.list()).find(r => r.id === id) ?? null;
    },
    async activeId() {
      activeMemo ??= api.ensure().then(readActiveId);
      const id = await activeMemo;
      // A pointer at a record that no longer exists (a half-finished remove)
      // reads as `shipped`, which always exists.
      return (await api.get(id)) ? id : SHIPPED_DESIGN_SYSTEM_ID;
    },
    async active() {
      const id = await api.activeId();
      const record = await api.get(id) ?? await api.get(SHIPPED_DESIGN_SYSTEM_ID);
      if (record) return record;
      // The store was emptied under us; rebuild the minimum and answer.
      ensured = null; listMemo = null; activeMemo = null;
      await api.ensure();
      const again = await api.get(SHIPPED_DESIGN_SYSTEM_ID);
      if (!again) throw new Error('design systems: no shipped record');
      return again;
    },
    async put(record) {
      if (!isDesignSystemId(record.id)) throw new Error(`design systems: “${record.id}” is not a usable id`);
      await api.ensure();
      await db.put(DESIGN_SYSTEMS_STORE, record);
      listMemo = null;
    },
    async remove(id) {
      if (id === SHIPPED_DESIGN_SYSTEM_ID) throw new Error('design systems: the shipped system cannot be removed');
      await api.ensure();
      if ((await api.activeId()) === id) await api.setActive(SHIPPED_DESIGN_SYSTEM_ID);
      await db.delete(DESIGN_SYSTEMS_STORE, id);
      listMemo = null;
    },
    async setActive(id) {
      await api.ensure();
      const record = await api.get(id);
      if (!record) throw new Error(`design systems: no system “${id}” on this device`);
      await db.put('profile', id, ACTIVE_DESIGN_SYSTEM_KEY);
      await db.put(DESIGN_SYSTEMS_STORE, { ...record, lastUsedAt: Date.now() });
      listMemo = null;
      activeMemo = Promise.resolve(id);
    },
    summary(record, activeId) {
      return {
        id: record.id,
        label: record.label,
        source: record.source.kind,
        active: record.id === activeId,
        locked: record.locked,
        headId: record.headId || null,
        ...(record.source.kind === 'hosted' ? { instance: record.source.instance } : {}),
      };
    },
    bust() { listMemo = null; activeMemo = null; },
  };
  return api;
}

/** "Lolly Starter Tokens" reads as "Lolly Starter" in a switcher - the same trim
 *  the dashboard hero applies to the catalog asset's name. */
export function stripTokensSuffix(name: string): string {
  return name.replace(/\s+(brand\s+)?(design\s+)?tokens$/i, '').trim() || name;
}
