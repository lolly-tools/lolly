// SPDX-License-Identifier: MPL-2.0
/**
 * ephemeral-state - a memory-backed `host.state` for a runtime whose saves must
 * never reach this device's session store (plan 100 section 11.17, wave 0.5).
 *
 * The acceptor of a private collab edits the INVITER's session (section 6.2a: the inviter
 * owns persistence). Their working copy is ephemeral - no slot written, nothing in
 * their Projects view - until they deliberately "Save a copy". The plan's ruling on
 * how to get there is the reason this file is four lines of logic rather than an
 * audit:
 *
 *   > Don't audit every `host.state.save` call site - give the acceptor's runtime a
 *   > memory-backed `host.state` bridge (the CLI shell's memory driver pattern): one
 *   > interception point, every save path inertly "works", nothing touches IDB slots.
 *
 * So this is deliberately NOT a reimplementation of the web StateAPI: it is the
 * REAL one (`bridge/state.ts`'s `createStateAPI`) over a memory `StateDb`. The
 * driver is the only thing that changes, exactly as it does in the CLI shell, which
 * means the record shape, the `createdAt` carry-forward, the migrate-or-warn read
 * branch, `sizes()` and `_getAssetRefs()` are the same code - an ephemeral session
 * cannot drift from a persisted one, and "Save a copy" is then a straight copy from
 * this API into the real one.
 *
 * Pure: no IndexedDB, no `openDB`, no DOM. Each call to `createMemoryStateAPI()`
 * gets its OWN store, so two acceptor runtimes never see each other's slots.
 */

import { createStateAPI } from '../bridge/state.ts';
import type { StateDb, WebStateAPI } from '../bridge/state.ts';

/** The 'state' record shape, read off the driver contract so it cannot drift from
 *  bridge/state.ts (which keeps the interface itself private). */
type StateRecord = Parameters<StateDb['put']>[1];

/**
 * Snapshot on write and on read, mirroring IndexedDB value semantics: a caller that
 * keeps mutating the object it saved must not retroactively change what was stored.
 * Falls back to the original when a value is unclonable - losing the isolation is
 * strictly better than failing the save (the same trade `cloneValue` makes in
 * views/tool-history.ts).
 */
function snapshot<T>(value: T): T {
  try { return structuredClone(value); } catch { return value; }
}

/** A `StateDb` backed by a plain Map - the memory driver. */
export function createMemoryStateDb(): StateDb {
  const rows = new Map<string, StateRecord>();
  return {
    async put(_store, record) {
      rows.set(record.slot, snapshot(record));
      return record.slot;
    },
    async get(_store, slot) {
      const hit = rows.get(slot);
      return hit === undefined ? undefined : snapshot(hit);
    },
    async getAll(_store) {
      return [...rows.values()].map(snapshot);
    },
    async delete(_store, slot) {
      rows.delete(slot);
    },
  };
}

/**
 * The web shell's full state surface, held in memory for this runtime only.
 * Every save path "works" and nothing lands on disk.
 */
export function createMemoryStateAPI(): WebStateAPI {
  return createStateAPI(createMemoryStateDb());
}
