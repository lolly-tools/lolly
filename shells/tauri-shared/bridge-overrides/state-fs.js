/**
 * Filesystem-backed state implementation shared by BOTH Tauri shells.
 *
 * It replaces the web shell's IndexedDB state bridge (shells/web/src/bridge/state.ts)
 * at build time: each Tauri shell's `bridge-overrides/state.js` is substituted for
 * that module by the resolveId plugin in its vite.config.js, and those two override
 * files are now thin platform seams that call `createFsStateAPI` here. The API
 * surface must stay in sync with the web bridge — tools, the engine, the gallery,
 * the profile page and catalog sync never see which implementation is running, so a
 * missing method (e.g. sizes) crashes boot.
 *
 * Storage: <app data dir>/saved-state/<slot>.json
 *
 * WHY THIS FILE LIVES IN THE PARENT REPO, AND WHY IT TAKES AN `fs` ADAPTER
 * Desktop and mobile previously carried byte-identical copies of this logic, so a
 * bug fix had to be applied twice with nothing enforcing it. The two Tauri shells
 * are separate submodule repos, so neither may import from the other; the parent
 * repo is the composition root they both already reach into (each vite.config.js
 * roots the build at ../web and serves ../../{tools,catalog}), so shared code
 * belongs here.
 *
 * The directory is named `bridge-overrides/` like the per-shell ones so that tooling
 * keyed on the `shells/<shell>/bridge-overrides` wildcard keeps covering this file:
 * the tracker and DNS-resolver greps in docs/verify-yourself.md, and the Biome
 * exclusion for hand-written override `.js`. Anything that lists the two shells'
 * override dirs LITERALLY still needs this one added by hand — tests/no-trackers.test.ts
 * is the one that does.
 *
 * The parent repo cannot import `@tauri-apps/plugin-fs`, though: the Tauri shells
 * are NOT npm workspaces, so that package is installed only inside each shell's own
 * node_modules and a bare specifier from this directory would not resolve. Hence the
 * inversion — each shell imports the plugin itself and passes in a small bound `fs`
 * adapter. That adapter is also the per-platform seam the mobile fork was kept for:
 * mobile can swap in iCloud sync or Android scoped storage by changing its adapter
 * (or by overriding a method on the returned object) without forking this logic.
 *
 * The `fs` adapter takes paths relative to the app data dir:
 *   exists(path)              → Promise<boolean>
 *   mkdirRecursive(path)      → Promise<void>
 *   readTextFile(path)        → Promise<string>
 *   writeTextFile(path, text) → Promise<void>
 *   readDirNames(path)        → Promise<string[]>   (entry names, not entries)
 *   remove(path)              → Promise<void>
 */

import { stripAssetModifiers, sessionVersionStamp, migrateSessionRecord, encodeFsToken } from '@lolly/engine';

const STATE_DIR = 'saved-state';
// Written once the legacy-filename migration has completed cleanly (below), so it
// never re-walks the directory on subsequent launches. Not a `.json`, so the
// record readers skip it.
// MUST NOT begin with a dot. tauri-plugin-fs defaults require_literal_leading_dot
// to `cfg!(unix)` — true on macOS and Android, so this bites both shells — and the
// `$APPDATA/**` glob behind fs:scope-appdata-recursive therefore cannot match a
// dotfile: every access to one is rejected as "forbidden path". As `.slotname-v1`
// this rejection propagated out of ensureMigrated() and failed EVERY state call, so
// the shell could not boot.
const MIGRATION_MARKER = `${STATE_DIR}/slotname-v1.marker`;

// Collision-free, cross-platform-safe filename for an arbitrary slot name via
// the engine's reversible percent-encoding codec (encodeFsToken): "Q3 Report",
// "Q3/Report", "Q3+Report", "Q3_Report" and "Björn keynote" all map to DISTINCT
// files — each recoverable to its exact slot. This replaces the old
// `slot.replace(/[^\w.-]/g, '_')`, which collapsed all of those onto one file
// and silently destroyed data (P0-4), and desktop and mobile can no longer
// diverge on it: they share this module, which shares the one engine codec.
function slotFilename(slot) {
  return `${encodeFsToken(slot)}.json`;
}

function slotPath(slot) {
  return `${STATE_DIR}/${slotFilename(slot)}`;
}

// Where migrateSessionRecord reports a record written by a newer app build.
function stateLog(level, message, meta) {
  (level === 'warn' ? console.warn : console.info)(`[lolly:state] ${message}`, meta ?? '');
}

/**
 * Build the state API over an `fs` adapter. One instance per shell; the migration
 * memo below is per instance, matching the old module-level `migrationPromise`.
 */
export function createFsStateAPI(fs) {
  async function ensureDir() {
    const ok = await fs.exists(STATE_DIR);
    if (!ok) {
      await fs.mkdirRecursive(STATE_DIR);
    }
  }

  // One-time migration from the old lossy filename scheme to the collision-free
  // one. Old files were named by `slot.replace(/[^\w.-]/g, '_')`, so a session
  // named "Q3 Report" lives at `Q3_Report.json` but load() now looks for
  // `Q3%20Report.json` and would never find it. Walk saved-state/, read each
  // record's authoritative `raw.slot`, and rewrite it under the canonical name.
  // (Sessions already lost to a pre-fix collision can't be recovered — only one
  // file survived on disk — but the survivor keeps its true name.) Idempotent and
  // memoised: a clean pass drops a marker so later launches skip the walk.
  let migrationPromise = null;
  function ensureMigrated() {
    if (!migrationPromise) migrationPromise = migrateLegacyFilenames();
    return migrationPromise;
  }

  async function migrateLegacyFilenames() {
    await ensureDir();
    // Defence in depth: a marker read must never fail boot. Every state call awaits
    // this, so a rejection here takes the whole shell down. The walk below is
    // idempotent, so treating an unreadable marker as "not migrated" costs at worst
    // a repeated walk per launch.
    try {
      if (await fs.exists(MIGRATION_MARKER)) return;
    } catch { /* fall through and re-walk */ }

    let names;
    try {
      names = await fs.readDirNames(STATE_DIR);
    } catch {
      return;
    }

    let failures = 0;
    for (const name of names) {
      if (!name?.endsWith('.json')) continue;
      try {
        const text = await fs.readTextFile(`${STATE_DIR}/${name}`);
        const raw = JSON.parse(text);
        const slot = raw?.slot;
        if (typeof slot !== 'string' || !slot) continue;
        const canonical = slotFilename(slot);
        if (canonical === name) continue; // already at its collision-free name

        // Move to the canonical name. If a canonical file already exists (a fresh
        // save under the new scheme), keep whichever is newer so migration never
        // resurrects a stale legacy copy over a real one. Two DIFFERENT slots can
        // no longer map to the same canonical name, so this only fires for a true
        // same-slot duplicate.
        if (await fs.exists(`${STATE_DIR}/${canonical}`)) {
          const targetText = await fs.readTextFile(`${STATE_DIR}/${canonical}`);
          const target = JSON.parse(targetText);
          if ((raw.updatedAt ?? '') > (target?.updatedAt ?? '')) {
            await fs.writeTextFile(`${STATE_DIR}/${canonical}`, text);
          }
        } else {
          await fs.writeTextFile(`${STATE_DIR}/${canonical}`, text);
        }
        await fs.remove(`${STATE_DIR}/${name}`);
      } catch {
        failures++;
      }
    }

    // Only mark done on a fully clean pass; otherwise retry next launch (the walk
    // is idempotent — already-canonical files are skipped instantly).
    if (failures === 0) {
      try {
        await fs.writeTextFile(MIGRATION_MARKER, '1');
      } catch { /* retry next launch */ }
    }
  }

  // Read every saved record once. Returns { raw, bytes } per file (bytes = the
  // on-disk JSON size, matching the web shell's Blob-size estimate). Reused by
  // list / sizes / _getAssetRefs so we walk the directory a single way.
  async function readAllRecords() {
    await ensureMigrated();
    let names;
    try {
      names = await fs.readDirNames(STATE_DIR);
    } catch {
      return [];
    }
    const out = [];
    for (const name of names) {
      if (!name?.endsWith('.json')) continue;
      try {
        const text = await fs.readTextFile(`${STATE_DIR}/${name}`);
        out.push({ raw: JSON.parse(text), bytes: new Blob([text]).size });
      } catch { /* skip corrupt entries */ }
    }
    return out;
  }

  return {
    async save(slot, data, thumb = null) {
      await ensureMigrated();
      const record = {
        slot,
        toolId: data.__toolId,
        toolVersion: data.__toolVersion,
        label: data.__label,
        data,
        thumb,
        updatedAt: new Date().toISOString(),
        ...sessionVersionStamp(),
      };
      await fs.writeTextFile(slotPath(slot), JSON.stringify(record, null, 2));
    },

    async load(slot) {
      await ensureMigrated();
      const path = slotPath(slot);
      const ok = await fs.exists(path);
      if (!ok) return null;
      try {
        const raw = JSON.parse(await fs.readTextFile(path));
        // Read version stamps through the shared migrate-or-warn branch rather
        // than reaching for `raw.data` directly (records predating versioning
        // migrate as v0; a newer-app record is read as-is but reported).
        return migrateSessionRecord(raw, stateLog);
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
      await ensureMigrated();
      const path = slotPath(slot);
      const ok = await fs.exists(path);
      if (ok) await fs.remove(path);
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
    // A modified ref (`<baseId>?theme=<t>` icon OR `<baseId>?treatment=<x>` photo)
    // is derived from the BASE blob — the key the cache holds and pruning must
    // protect. Match the web bridge exactly: strip BOTH modifiers, not just theme,
    // or a saved session's treated photo gets a key that never matches and is evicted.
    const baseId = stripAssetModifiers(String(value.id));
    refs.add(`${baseId}:${value.format}:${value.version}`);
    return;
  }
  for (const v of Object.values(value)) collectAssetRefs(v, refs);
}
