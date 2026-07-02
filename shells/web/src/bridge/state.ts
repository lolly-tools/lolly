// SPDX-License-Identifier: MPL-2.0
/**
 * StateAPI — saved tool states.
 *
 * Stored per-slot in IndexedDB. The slot key is user-facing (they name their
 * saves); the toolId/version are recorded for forward compatibility — when a
 * tool bumps a major version, the runtime can decide whether to migrate or
 * warn the user.
 */
import type { StateAPI, StateEntry } from '../../../../engine/src/bridge/host-v1.ts';
import type { InputValue } from '@lolly/engine';

/** The saved payload: input values plus the runtime's `__`-prefixed markers. */
export interface SavedStateData {
  __toolId?: string;
  __toolVersion?: string;
  __label?: string;
  __export_filename?: string;
  /** Every other key is a persisted input value (written from the live model). */
  [inputId: string]: InputValue | undefined;
}

interface StateRecord {
  slot: string;
  toolId: string | undefined;
  toolVersion: string | undefined;
  label: string | undefined;
  data: SavedStateData;
  thumb: string | null;
  updatedAt: string;
}

/** The slice of the idb database this API touches (the 'state' object store). */
export interface StateDb {
  put(store: 'state', record: StateRecord): Promise<unknown>;
  get(store: 'state', slot: string): Promise<StateRecord | undefined>;
  getAll(store: 'state'): Promise<StateRecord[]>;
  delete(store: 'state', slot: string): Promise<void>;
}

/** The web shell's state surface: HostV1's StateAPI plus shell extensions. */
export interface WebStateAPI extends StateAPI {
  save(slot: string, data: SavedStateData, thumb?: string | null): Promise<void>;
  load(slot: string): Promise<SavedStateData | null>;
  list(): Promise<(StateEntry & { filename: string | null; thumb: string | null })[]>;
  /** Bytes used per slot (rough: the JSON-serialised record size). */
  sizes(): Promise<Record<string, number>>;
  /** Blob keys (id:format:version) referenced across all saved sessions —
   *  used by sync to avoid evicting on-demand blobs a session still needs. */
  _getAssetRefs(): Promise<Set<string>>;
}

export function createStateAPI(db: StateDb): WebStateAPI {
  return {
    async save(slot, data, thumb = null) {
      const record: StateRecord = {
        slot,
        toolId: data.__toolId,
        toolVersion: data.__toolVersion,
        label: data.__label,
        data,
        thumb,
        updatedAt: new Date().toISOString(),
      };
      await db.put('state', record);
    },

    async load(slot) {
      const record = await db.get('state', slot);
      return record?.data ?? null;
    },

    async list() {
      const all = await db.getAll('state');
      return all.map(r => ({
        slot: r.slot,
        toolId: r.toolId ?? '',
        toolVersion: r.toolVersion ?? '',
        label: r.label,
        filename: r.data?.__export_filename || null,
        thumb: r.thumb ?? null,
        updatedAt: r.updatedAt,
      }));
    },

    async delete(slot) {
      await db.delete('state', slot);
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
      return refs;
    },
  };
}

function collectAssetRefs(value: unknown, refs: Set<string>): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) collectAssetRefs(item, refs);
    return;
  }
  const record = value as Record<string, unknown>;
  if (record.source === 'library' && record.id && record.format && record.version != null) {
    refs.add(`${record.id}:${record.format}:${record.version}`);
    return;
  }
  for (const v of Object.values(record)) collectAssetRefs(v, refs);
}
