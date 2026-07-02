// SPDX-License-Identifier: MPL-2.0
/**
 * StateAPI — saved tool states.
 *
 * Stored per-slot in IndexedDB. The slot key is user-facing (they name their
 * saves); the toolId/version are recorded for forward compatibility — when a
 * tool bumps a major version, the runtime can decide whether to migrate or
 * warn the user.
 */

import { parseThemedAssetId } from '@lolly/engine';

export function createStateAPI(db) {
  return {
    async save(slot, data, thumb = null) {
      const record = {
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
        toolId: r.toolId,
        toolVersion: r.toolVersion,
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
      const result = {};
      for (const r of all) {
        result[r.slot] = new Blob([JSON.stringify(r)]).size;
      }
      return result;
    },

    // Returns the set of blob keys (id:format:version) referenced across all saved sessions.
    // Used by sync to avoid evicting on-demand blobs that a session still needs.
    async _getAssetRefs() {
      const all = await db.getAll('state');
      const refs = new Set();
      for (const record of all) collectAssetRefs(record.data, refs);
      return refs;
    },
  };
}

function collectAssetRefs(value, refs) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) collectAssetRefs(item, refs);
    return;
  }
  if (value.source === 'library' && value.id && value.format && value.version != null) {
    // A themed icon ref (`<baseId>?theme=<t>`) is derived from the BASE blob —
    // that's the key the cache holds and the one pruning must protect.
    const { baseId } = parseThemedAssetId(String(value.id));
    refs.add(`${baseId}:${value.format}:${value.version}`);
    return;
  }
  for (const v of Object.values(value)) collectAssetRefs(v, refs);
}
