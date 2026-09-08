// SPDX-License-Identifier: MPL-2.0
/**
 * StateAPI - saved tool states.
 *
 * Stored per-slot in IndexedDB. The slot key is user-facing (they name their
 * saves); the toolId/version are recorded for forward compatibility - when a
 * tool bumps a major version, the runtime can decide whether to migrate or
 * warn the user.
 */

import { stripAssetModifiers } from '../../../../engine/src/photo-treatment.ts';
import { sessionVersionStamp, migrateSessionRecord } from '../../../../engine/src/session-record.ts';
import type { StateAPI, StateEntry } from '@lolly-tools/core/host-v1';
import type { RevisionHistoryAPI, RevisionStore } from './revision-history.ts';

/** The saved payload: input values plus the runtime's `__`-prefixed markers. */
export interface SavedStateData {
  __toolId?: string;
  __toolVersion?: string;
  __label?: string;
  __export_filename?: string;
  /** Every other key is a persisted input value (written from the live model). */
  [inputId: string]: unknown;
}

export interface StateRecord {
  slot: string;
  toolId: string | undefined;
  toolVersion: string | undefined;
  label: string | undefined;
  data: SavedStateData;
  thumb: string | null;
  updatedAt: string;
  /** First-save time, preserved across re-saves (save() rewrites updatedAt but
   *  carries this forward) - the "Date added" sort key. Optional: rows written
   *  before it existed have none; readers fall back to the slot's minted
   *  timestamp (`<toolId>:<Date.now()>`) and then updatedAt. */
  createdAt?: string;
  documentId?: string;
  /** Record-layout version + the engine that wrote it (see engine/session-record.ts).
   *  Optional so records written before versioning still type-check on read. */
  formatVersion?: number;
  engineVersion?: string;
  /** Which design system the session was made with (plans/186 section 3.8) - the
   *  active record's id and label at save time. Optional: rows written before
   *  this existed, and devices with no registry, have none. */
  designSystem?: { id: string; label: string };
}

/** Where migrateSessionRecord reports a record from a newer app build. */
function stateLog(level: 'warn' | 'info', message: string, meta?: Record<string, unknown>): void {
  (level === 'warn' ? console.warn : console.info)(`[lolly:state] ${message}`, meta ?? '');
}

/** The slice of the idb database this API touches (the 'state' object store). */
export interface StateDb {
  put(store: 'state', record: StateRecord): Promise<unknown>;
  get(store: 'state', slot: string): Promise<StateRecord | undefined>;
  /** The two reads the design-system stamp makes (plans/186); both optional on a
   *  narrow test stub, which then saves unstamped records as before. */
  get(store: 'profile' | 'design-systems', key: string): Promise<unknown>;
  getAll(store: 'state'): Promise<StateRecord[]>;
  delete(store: 'state', slot: string): Promise<void>;
}

/** The web shell's state surface: HostV1's StateAPI plus shell extensions. */
export interface WebStateAPI extends StateAPI {
  /** Device-local history. Absent for ephemeral guests and native drivers until
   * they implement an atomic revision transaction. Never inferred from shell type. */
  history?: RevisionHistoryAPI;
  save(slot: string, data: SavedStateData, thumb?: string | null): Promise<void>;
  load(slot: string): Promise<SavedStateData | null>;
  list(): Promise<(StateEntry & { filename: string | null; thumb: string | null; createdAt?: string })[]>;
  /** Bytes used per slot (rough: the JSON-serialised record size). */
  sizes(): Promise<Record<string, number>>;
  /** Blob keys (id:format:version) referenced across all saved sessions - 
   *  used by sync to avoid evicting on-demand blobs a session still needs. */
  _getAssetRefs(): Promise<Set<string>>;
}

/**
 * Which design system a session was made with (plans/186 section 3.8): the
 * active record's id and label, read straight off the same database so the
 * bridge needs no host. Absent on a device with no registry yet, and never a
 * reason for a save to fail.
 */
async function activeDesignSystemStamp(db: StateDb): Promise<{ designSystem?: { id: string; label: string } }> {
  try {
    const id = await db.get('profile', 'active-design-system');
    if (typeof id !== 'string' || !id) return {};
    const record = await db.get('design-systems', id) as { id?: string; label?: string } | undefined;
    if (!record || typeof record.label !== 'string') return {};
    return { designSystem: { id, label: record.label } };
  } catch { return {}; }
}

export function createStateAPI(db: StateDb, revisions?: RevisionStore): WebStateAPI {
  const makeRecord = async (slot: string, data: SavedStateData, thumb: string | null): Promise<StateRecord> => {
    const prior = await db.get('state', slot).catch(() => undefined);
    const now = new Date().toISOString();
    return { slot, toolId: data.__toolId, toolVersion: data.__toolVersion, label: data.__label,
      data, thumb, updatedAt: now, createdAt: prior?.createdAt ?? now,
      ...sessionVersionStamp(), ...(await activeDesignSystemStamp(db)) };
  };
  return {
    ...(revisions ? { history: {
      ...revisions,
      recovery: { ...revisions.recovery, save: async (slot, data, options) => revisions.recovery.write(await makeRecord(slot, data, null), options) },
      checkpoint: async (slot, data, options) => revisions.commit(await makeRecord(slot, data, null), options),
    } satisfies RevisionHistoryAPI } : {}),
    async save(slot, data, thumb = null) {
      const record = await makeRecord(slot, data, thumb);
      if (revisions) await revisions.replace(record);
      else await db.put('state', record);
    },

    async load(slot) {
      const record = await db.get('state', slot);
      // Read the record's version stamps through the shared migrate-or-warn
      // branch (engine/session-record.ts) rather than reaching for `.data`
      // directly - records predating versioning migrate as v0 (a no-op today),
      // and a record written by a newer app is read as-is but reported.
      return migrateSessionRecord(record, stateLog) as SavedStateData | null;
    },

    async list() {
      const all = await db.getAll('state');
      return all.map(r => ({
        slot: r.slot,
        toolId: r.toolId!,
        toolVersion: r.toolVersion!,
        label: r.label,
        filename: r.data?.__export_filename || null,
        thumb: r.thumb ?? null,
        updatedAt: r.updatedAt,
        ...(r.createdAt ? { createdAt: r.createdAt } : {}),
        ...(r.designSystem ? { designSystem: r.designSystem } : {}),
      }));
    },

    async delete(slot) {
      if (revisions) await revisions.delete(slot);
      else await db.delete('state', slot);
    },

    async sizes() {
      const all = await db.getAll('state');
      const result: Record<string, number> = {};
      for (const r of all) {
        result[r.slot] = new Blob([JSON.stringify(r)]).size;
      }
      return result;
    },

    // Returns the set of blob keys (id:format:version) referenced across all saved sessions.
    // Used by sync to avoid evicting on-demand blobs that a session still needs.
    async _getAssetRefs() {
      const all = await db.getAll('state');
      const refs = new Set<string>();
      for (const record of all) collectAssetRefs(record.data, refs);
      if (revisions) for (const ref of await revisions.assetRefs()) refs.add(ref);
      return refs;
    },
  };
}

export function collectAssetRefs(value: unknown, refs: Set<string>): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) collectAssetRefs(item, refs);
    return;
  }
  const record = value as Record<string, unknown>;
  if (record.source === 'library' && record.id && record.format && record.version != null) {
    // A derived ref (`<baseId>?theme=<t>` icon, `<baseId>?treatment=<t>` photo) is
    // backed by the BASE blob - that's the key the cache holds and the one pruning
    // must protect. Both derived refs record the base format, so this reconstructs
    // the base blob key exactly.
    const baseId = stripAssetModifiers(String(record.id));
    refs.add(`${baseId}:${record.format}:${record.version}`);
    return;
  }
  for (const v of Object.values(record)) collectAssetRefs(v, refs);
}
