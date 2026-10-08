// SPDX-License-Identifier: MPL-2.0
/**
 * lib/team-origin-records - the device's record of where copies of team documents came
 * from (plan 75 G17), named here so every moment that must forget it can, without
 * loading the control plane.
 *
 * org/team-origin-durable.ts keeps one record per device copy in an IndexedDB database,
 * and a localStorage mark that says the database may hold any. Before they go on a
 * sign-out or account change (org/index.ts, through `dropDurableTeamOrigins`), or Leave
 * (lib/instance-leave.ts, which may not import org/), the copy names are kept alone.
 * That list leaves out account, session and workspace, but retains their names
 * after the origin identity is removed. A failed read or write retains the original
 * evidence. These names are not a complete classification of local work.
 */

/** The database org/team-origin-durable.ts keeps its records in. */
export const TEAM_ORIGINS_DB = 'lolly-team-origins';
/** Set while that database may hold a record, so opening a device copy costs nothing otherwise. */
export const TEAM_ORIGINS_MARK = 'lolly:team-origins';
/** The slots of known team copies, as a JSON array of slot names. */
export const TEAM_COPY_SLOTS_KEY = 'lolly:team-copy-slots';

/** Read the complete retained copy list. Unreadable evidence must not look empty. */
export function readTeamCopySlots(): Set<string> {
  const storage = globalThis.localStorage;
  if (!storage) throw new Error('Team copy storage is unavailable');
  const list: unknown = JSON.parse(storage.getItem(TEAM_COPY_SLOTS_KEY) ?? '[]');
  if (!Array.isArray(list) || list.some((slot) => typeof slot !== 'string' || !slot)) {
    throw new Error('Team copy list is unreadable');
  }
  return new Set(list);
}

/** Keep copy names before any record is dropped. Reject rather than lose an older list. */
export function listTeamCopySlots(slots: Iterable<string>): void {
  const listed = readTeamCopySlots(), size = listed.size;
  for (const slot of slots) if (slot) listed.add(slot);
  if (listed.size === size) return;
  globalThis.localStorage.setItem(TEAM_COPY_SLOTS_KEY, JSON.stringify([...listed]));
}

/** Read only copy names from the database, closing our connection before a delete. */
function storedCopySlots(idb: IDBFactory): Promise<Set<string>> {
  return new Promise((resolve, reject) => {
    const open = idb.open(TEAM_ORIGINS_DB);
    open.onupgradeneeded = () => { open.result.createObjectStore('origins', { keyPath: 'key' }); };
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const conn = open.result;
      conn.onversionchange = () => conn.close();
      try {
        if (!conn.objectStoreNames.contains('origins')) throw new Error('Team origin store is unreadable');
        const req = conn.transaction('origins', 'readonly').objectStore('origins').getAll();
        req.onerror = () => { conn.close(); reject(req.error); };
        req.onsuccess = () => {
          try {
            const rows: unknown = req.result;
            if (!Array.isArray(rows)) throw new Error('Team origins are unreadable');
            const slots = new Set<string>();
            for (const row of rows) {
              if (!row || typeof row !== 'object' || typeof row.slot !== 'string' || !row.slot) {
                throw new Error('Team origin record is unreadable');
              }
              slots.add(row.slot);
            }
            resolve(slots);
          } catch (error) { reject(error); }
          finally { conn.close(); }
        };
      } catch (error) { conn.close(); reject(error); }
    };
  });
}

/** Clear records only after their copy names have been kept; report a refused delete. */
export async function clearTeamOriginRecords(): Promise<boolean> {
  try {
    const idb = globalThis.indexedDB;
    if (!idb) return false;
    listTeamCopySlots(await storedCopySlots(idb));
    return await new Promise<boolean>((resolve) => {
      const req = idb.deleteDatabase(TEAM_ORIGINS_DB);
      req.onsuccess = () => {
        // A queued delete can finish after its caller has returned from onblocked.
        try { globalThis.localStorage.removeItem(TEAM_ORIGINS_MARK); } catch { /* the mark remains an opening hint */ }
        resolve(true);
      };
      req.onerror = () => resolve(false);
      req.onblocked = () => resolve(false);
    });
  } catch { return false; }
}

/**
 * Drop the records without loading org/. Copy names must be kept first, otherwise
 * nothing is deleted. Never rejects or blocks Leave on a failed or queued delete.
 */
export async function dropTeamOriginRecords(): Promise<void> {
  await clearTeamOriginRecords();
}
