// SPDX-License-Identifier: MPL-2.0
/**
 * lib/team-origin-records - the device's record of where copies of team documents came
 * from (plan 75 G17), named here so every moment that must forget it can, without
 * loading the control plane.
 *
 * org/team-origin-durable.ts keeps one record per device copy in an IndexedDB database,
 * and a localStorage mark that says the database may hold any. Both are bound to the
 * person signed in, so they go when that person does: a sign-out, an account change
 * (org/index.ts, through org/team-origin-durable.ts `dropDurableTeamOrigins`) and Leave
 * (lib/instance-leave.ts, which may not import org/). Dormant: nothing here runs until
 * one of those moments calls {@link dropTeamOriginRecords}.
 */

/** The database org/team-origin-durable.ts keeps its records in. */
export const TEAM_ORIGINS_DB = 'lolly-team-origins';
/** Set while that database may hold a record, so opening a device copy costs nothing otherwise. */
export const TEAM_ORIGINS_MARK = 'lolly:team-origins';

/**
 * Delete every record, for every workspace and account, and the mark. Resolves once the
 * browser has deleted the database, or has queued the delete behind another tab that
 * still holds it open (org/team-origin-durable.ts closes its connection when asked, so
 * the delete then completes), or could not delete the database. Never rejects.
 */
export function dropTeamOriginRecords(): Promise<void> {
  try { globalThis.localStorage?.removeItem(TEAM_ORIGINS_MARK); } catch { /* storage blocked: the database goes all the same */ }
  const idb = globalThis.indexedDB;
  if (!idb) return Promise.resolve();
  return new Promise<void>((resolve) => {
    let req: IDBOpenDBRequest;
    try { req = idb.deleteDatabase(TEAM_ORIGINS_DB); } catch { resolve(); return; }
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}
