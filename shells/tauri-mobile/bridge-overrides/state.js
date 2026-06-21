/**
 * Filesystem-backed state implementation for Tauri mobile shell.
 *
 * Identical to the desktop override — both shells store saved state as JSON
 * files under $APPDATA. Kept as a separate file so mobile-specific changes
 * (e.g. iCloud sync, scoped storage on Android) can diverge without touching
 * the desktop implementation.
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
  return `${STATE_DIR}/${slot.replace(/[^\w.-]/g, '_')}.json`;
}

export function createStateAPI(_db) {
  return {
    async save(slot, data) {
      await ensureDir();
      const record = {
        slot,
        toolId: data.__toolId,
        toolVersion: data.__toolVersion,
        label: data.__label,
        data,
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
      await ensureDir();
      let entries;
      try {
        entries = await readDir(STATE_DIR, { baseDir: BaseDirectory.AppData });
      } catch {
        return [];
      }
      const results = [];
      for (const entry of entries) {
        if (!entry.name?.endsWith('.json')) continue;
        try {
          const raw = JSON.parse(
            await readTextFile(`${STATE_DIR}/${entry.name}`, { baseDir: BaseDirectory.AppData }),
          );
          results.push({
            slot: raw.slot,
            toolId: raw.toolId,
            toolVersion: raw.toolVersion,
            label: raw.label,
            updatedAt: raw.updatedAt,
          });
        } catch { /* skip corrupt entries */ }
      }
      return results.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
    },

    async delete(slot) {
      const path = slotPath(slot);
      const ok = await exists(path, { baseDir: BaseDirectory.AppData });
      if (ok) await remove(path, { baseDir: BaseDirectory.AppData });
    },
  };
}
