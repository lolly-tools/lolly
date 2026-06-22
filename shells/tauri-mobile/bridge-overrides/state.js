/**
 * Filesystem-backed state implementation for Tauri mobile shell.
 *
 * The API surface is identical to the web shell (shells/web/src/bridge/state.js)
 * and the desktop override — tools, the engine, the gallery, the profile page and
 * catalog sync never see which implementation is running, so every method must be
 * present or boot crashes. Kept as a separate file from desktop so mobile-specific
 * changes (e.g. iCloud sync, scoped storage on Android) can diverge later without
 * touching the desktop implementation.
 *
 * Storage: $APPDATA/Lolly/saved-state/<slot>.json
 */

import {
  BaseDirectory,
  exists,
  mkdir,
  readTextFile,
  writeTextFile,
  readDir,
  remove,
} from '@tauri-apps/plugin-fs';

const STATE_DIR = 'saved-state';

async function ensureDir() {
  const ok = await exists(STATE_DIR, { baseDir: BaseDirectory.AppData });
  if (!ok) {
    await mkdir(STATE_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
  }
}

function slotPath(slot) {
  // Sanitise slot names: replace anything that isn't alphanumeric/hyphen/underscore/dot
  return `${STATE_DIR}/${slot.replace(/[^\w.-]/g, '_')}.json`;
}

// Read every saved record once. Returns { raw, bytes } per file (bytes = the
// on-disk JSON size, matching the web shell's Blob-size estimate). Reused by
// list / sizes / _getAssetRefs so we walk the directory a single way.
async function readAllRecords() {
  await ensureDir();
  let entries;
  try {
    entries = await readDir(STATE_DIR, { baseDir: BaseDirectory.AppData });
  } catch {
    return [];
  }
  const out = [];
  for (const entry of entries) {
    if (!entry.name?.endsWith('.json')) continue;
    try {
      const text = await readTextFile(`${STATE_DIR}/${entry.name}`, { baseDir: BaseDirectory.AppData });
      out.push({ raw: JSON.parse(text), bytes: new Blob([text]).size });
    } catch { /* skip corrupt entries */ }
  }
  return out;
}

// createStateAPI signature matches the web shell (db param ignored — not needed here).
export function createStateAPI(_db) {
  return {
    async save(slot, data, thumb = null) {
      await ensureDir();
      const record = {
        slot,
        toolId: data.__toolId,
        toolVersion: data.__toolVersion,
        label: data.__label,
        data,
        thumb,
        updatedAt: new Date().toISOString(),
      };
      await writeTextFile(slotPath(slot), JSON.stringify(record, null, 2), {
        baseDir: BaseDirectory.AppData,
      });
    },

    async load(slot) {
      const path = slotPath(slot);
      const ok = await exists(path, { baseDir: BaseDirectory.AppData });
      if (!ok) return null;
      try {
        const raw = JSON.parse(await readTextFile(path, { baseDir: BaseDirectory.AppData }));
        return raw.data ?? null;
      } catch {
        return null;
      }
    },

    async list() {
      const records = await readAllRecords();
      return records
        .map(({ raw }) => ({
          slot: raw.slot,
          toolId: raw.toolId,
          toolVersion: raw.toolVersion,
          label: raw.label,
          filename: raw.data?.__export_filename || null,
          thumb: raw.thumb ?? null,
          updatedAt: raw.updatedAt,
        }))
        .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
    },

    async delete(slot) {
      const path = slotPath(slot);
      const ok = await exists(path, { baseDir: BaseDirectory.AppData });
      if (ok) await remove(path, { baseDir: BaseDirectory.AppData });
    },

    async sizes() {
      const result = {};
      for (const { raw, bytes } of await readAllRecords()) {
        if (raw.slot) result[raw.slot] = bytes;
      }
      return result;
    },

    // Blob keys (id:format:version) referenced across all saved sessions, so
    // catalog sync won't evict on-demand blobs a session still needs.
    async _getAssetRefs() {
      const refs = new Set();
      for (const { raw } of await readAllRecords()) collectAssetRefs(raw.data, refs);
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
    refs.add(`${value.id}:${value.format}:${value.version}`);
    return;
  }
  for (const v of Object.values(value)) collectAssetRefs(v, refs);
}
