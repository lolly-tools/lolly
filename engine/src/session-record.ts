// SPDX-License-Identifier: MPL-2.0
/**
 * Saved-session record envelope — the version stamps a shell's state bridge
 * writes for one saved tool session, and the migrate-or-warn branch it runs on
 * load.
 *
 * A session record (IndexedDB row on web, `$APPDATA/Lolly/saved-state/<slot>.json`
 * on the Tauri shells) is:
 *
 *   { slot, toolId, toolVersion, label, data, thumb, updatedAt,
 *     formatVersion, engineVersion }
 *
 * `formatVersion` is the record LAYOUT version (bump on any change to the fields
 * or their shape). `engineVersion` is the running engine that wrote it — a
 * breadcrumb for a future migration that needs to know which engine's data
 * conventions produced the record. The engine owns both the constant and the
 * migrate-or-warn branch so the three bridges (web + desktop + mobile) cannot
 * drift — the same discipline data-transfer.ts applies to the portable-backup
 * envelope, applied here to the per-session record.
 *
 * This is the hook the state.ts header always promised ("the runtime can decide
 * whether to migrate or warn the user") but never had: records written before
 * this shipped carry no `formatVersion`, so migrateSessionRecord treats a
 * missing one as version 0. The v0→v1 step is a no-op on the data (v1 only ADDED
 * the stamps), but the branch now EXISTS, so a genuinely breaking 1.1 change has
 * somewhere to stand instead of guessing at every unversioned file forever.
 */

import { ENGINE_VERSION } from './version.ts';

/** The record LAYOUT this build writes. Bump on any change to the record shape. */
export const SESSION_FORMAT_VERSION = 1;

/** The newest record layout this build knows how to read. A record is readable
 *  when its `formatVersion` is ≤ this; a higher one is from a newer app. */
export const SESSION_READER_VERSION = 1;

export interface SessionVersionStamp {
  formatVersion: number;
  engineVersion: string;
}

/** The two version fields a state bridge spreads into every record it writes. */
export function sessionVersionStamp(): SessionVersionStamp {
  return { formatVersion: SESSION_FORMAT_VERSION, engineVersion: ENGINE_VERSION };
}

/** A record as read back from storage — untrusted shape, version fields optional.
 *  Only the fields the migrate-or-warn branch reads are named (no index
 *  signature, so a shell's concrete record type stays assignable here). */
export interface StoredSessionRecord {
  slot?: unknown;
  formatVersion?: unknown;
  engineVersion?: unknown;
  data?: unknown;
}

export type SessionLogger = (
  level: 'warn' | 'info',
  message: string,
  meta?: Record<string, unknown>,
) => void;

/**
 * The migrate-or-warn branch every state bridge runs on load. Reads a parsed
 * record's version stamps and returns its `data` — migrating forward when the
 * record predates the current layout, and warning (never throwing) when it comes
 * from a newer build than this one understands.
 *
 * Deliberately non-destructive: a future-versioned record is still read as-is
 * (losing a user's session is worse than reading it optimistically), it's just
 * reported. Returns null only when there is genuinely no session data to load.
 */
export function migrateSessionRecord(
  record: StoredSessionRecord | null | undefined,
  log?: SessionLogger,
): object | null {
  if (!record || typeof record !== 'object') return null;
  const data = record.data;
  if (data == null || typeof data !== 'object') return null;

  const raw = record.formatVersion;
  const fromVersion = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;

  if (fromVersion > SESSION_READER_VERSION) {
    log?.('warn', 'saved session was written by a newer version of the app — reading it as-is', {
      slot: record.slot,
      recordFormatVersion: fromVersion,
      readerFormatVersion: SESSION_READER_VERSION,
    });
    return data as object;
  }

  // fromVersion ≤ current: migrate forward, step by step. Only the v0→v1
  // (add-stamps) step exists today and it is a no-op on the data, so there is
  // nothing to transform yet. Future breaking steps slot in here, e.g.:
  //   if (fromVersion < 2) { /* v1 → v2: reshape data */ }
  return data as object;
}
