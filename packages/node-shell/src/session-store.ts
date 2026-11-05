// SPDX-License-Identifier: MPL-2.0
/**
 * The saved-session files on this machine, read and written the way the desktop app
 * writes them (plans/202 WP3.1).
 *
 * The desktop and mobile shells keep every saved session at
 * `<state dir>/saved-state/<encodeFsToken(slot)>.json`
 * through `createFsStateAPI` (shells/tauri-shared/bridge-overrides/state-fs.ts). This
 * module is the Node half of the same layout, so the CLI and the TUI open the files the
 * desktop app wrote and write files the desktop app can open. One codec (the engine's
 * `encodeFsToken`) names the files, so the three shells cannot drift on that.
 *
 * The two implementations are pinned against each other by
 * shells/tui/src/store.test.ts, which drives the real `createFsStateAPI` over a temp
 * directory and then lists the result through the TUI store.
 *
 * What this module does NOT do: the desktop app's one-time migration off the old lossy
 * filename scheme. That walk belongs to the app that wrote those files; listing here reads
 * each record's own `slot` field rather than its filename, so a not-yet-migrated file still
 * lists correctly.
 */

import { mkdir, readdir, readFile, rm, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { RightsDecisionV1 } from '@lolly-tools/core/rights-v1';
import type { SessionEmojiStamp } from '../../../engine/src/session-record.ts';

// Deep relative imports, not the `@lolly/engine` barrel: the CLI bridge reaches this
// module and the MCP function bundle follows every import from there.
import { decodeFsToken, encodeFsToken } from '../../../engine/src/fs-token.ts';
import { migrateSessionRecord, sessionVersionStamp, sessionRightsDecisions, sessionEmojiStamp } from '../../../engine/src/session-record.ts';

/** The directory the shells share, under the resolved state directory. */
export const SESSION_SUBDIR = 'saved-state';

/** The saved payload: input values plus the runtime's `__`-prefixed markers. */
export interface SessionData {
  __toolId?: string;
  __toolVersion?: string;
  __label?: string;
  __export_filename?: string;
  [inputId: string]: unknown;
}

/**
 * One saved session as it sits on disk. Every field but `slot` is optional on read: a
 * record is JSON someone else wrote, and older records predate the version stamps.
 */
export interface SessionRecord {
  rightsDecisions?: RightsDecisionV1[];
  emoji?: SessionEmojiStamp;
  slot: string;
  toolId?: string;
  toolVersion?: string;
  label?: string;
  data: SessionData;
  thumb?: string | null;
  updatedAt: string;
  createdAt?: string;
  formatVersion?: number;
  engineVersion?: string;
}

/** A record as parsed back off disk - untrusted, so read every field defensively. */
type ParsedRecord = Partial<SessionRecord>;

export function sessionsDir(stateDir: string): string {
  return join(stateDir, SESSION_SUBDIR);
}

export function sessionFilePath(stateDir: string, slot: string): string {
  return join(sessionsDir(stateDir), `${encodeFsToken(slot)}.json`);
}

/** Read one record, or null when it is missing or unreadable. */
export async function readSessionRecord(stateDir: string, slot: string): Promise<SessionRecord | null> {
  try {
    const raw = JSON.parse(await readFile(sessionFilePath(stateDir, slot), 'utf8')) as ParsedRecord;
    return normalise(raw);
  } catch {
    return null;
  }
}

/**
 * The saved data for a slot, read through the engine's migrate-or-warn branch (the same
 * one the web and Tauri bridges use), or null when there is no such session.
 */
export async function loadSessionData(stateDir: string, slot: string): Promise<SessionData | null> {
  try {
    const raw = JSON.parse(await readFile(sessionFilePath(stateDir, slot), 'utf8')) as ParsedRecord;
    return migrateSessionRecord(raw) as SessionData | null;
  } catch {
    return null;
  }
}

/**
 * Every readable record in the directory, newest first. Corrupt files are skipped, not
 * thrown - a hand-edited or truncated file must never take a listing down.
 */
export async function listSessionRecords(stateDir: string): Promise<SessionRecord[]> {
  let names: string[];
  try {
    names = await readdir(sessionsDir(stateDir));
  } catch {
    return [];
  }
  const out: SessionRecord[] = [];
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    try {
      const raw = JSON.parse(await readFile(join(sessionsDir(stateDir), name), 'utf8')) as ParsedRecord;
      const record = normalise(raw);
      if (record) out.push(record);
    } catch {
      /* skip corrupt entries */
    }
  }
  return out.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

/**
 * Just the slot names, taken from the filenames - no file is opened. Saved sessions carry
 * thumbnails, so a record can run to a megabyte or two; a caller that only wants the list
 * of slots should not pay for that.
 */
export async function listSessionSlots(stateDir: string): Promise<string[]> {
  let names: string[];
  try {
    names = await readdir(sessionsDir(stateDir));
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    try {
      const slot = decodeFsToken(name.slice(0, -'.json'.length));
      if (slot) out.push(slot);
    } catch { /* a filename nothing here wrote */ }
  }
  return out;
}

/** What a caller supplies to save; the stamps and timestamps are filled in here. */
export class SessionConflictError extends Error {
  constructor() { super('This project changed since it was opened. Reopen it or use Save as.'); this.name = 'SessionConflictError'; }
}

export interface SessionWrite {
  emoji?: SessionEmojiStamp | null;
  rightsDecisions?: RightsDecisionV1[];
  /** Omit for unconditional writes; null requires a new slot. */
  expectedUpdatedAt?: string | null;
  slot: string;
  data: SessionData;
  thumb?: string | null;
  /** Defaults to `data.__toolId`. */
  toolId?: string;
  /** Defaults to `data.__toolVersion`. */
  toolVersion?: string;
  /** Defaults to `data.__label`. */
  label?: string;
  /** Defaults to now. Passed when a caller is preserving an existing record's order. */
  updatedAt?: string;
}

/**
 * Write one session, carrying the original `createdAt` forward across a re-save so the
 * "date added" order holds - the read-before-write both other bridges do.
 */
export async function writeSessionRecord(stateDir: string, write: SessionWrite): Promise<SessionRecord> {
  await mkdir(sessionsDir(stateDir), { recursive: true });
  const prior = await readSessionRecord(stateDir, write.slot);
  if (write.expectedUpdatedAt !== undefined && (prior?.updatedAt ?? null) !== write.expectedUpdatedAt) throw new SessionConflictError();
  const now = new Date(Math.max(Date.now(), Date.parse(prior?.updatedAt ?? '') + 1 || 0)).toISOString();
  const record: SessionRecord = {
    slot: write.slot,
    toolId: write.toolId ?? write.data.__toolId,
    toolVersion: write.toolVersion ?? write.data.__toolVersion,
    label: write.label ?? write.data.__label,
    data: write.data,
    thumb: write.thumb ?? prior?.thumb ?? null,
    updatedAt: write.updatedAt ?? now,
    createdAt: prior?.createdAt ?? now,
    emoji: write.emoji === undefined ? prior?.emoji : write.emoji ?? undefined,
    rightsDecisions: write.rightsDecisions ?? prior?.rightsDecisions,
    ...sessionVersionStamp(),
  };
  const path = sessionFilePath(stateDir, write.slot);
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, JSON.stringify(record, null, 2), { mode: 0o600, flag: 'wx' });
    if (write.expectedUpdatedAt !== undefined) {
      const latest = await readSessionRecord(stateDir, write.slot);
      if ((latest?.updatedAt ?? null) !== write.expectedUpdatedAt) throw new SessionConflictError();
    }
    await rename(temp, path);
  } finally { await rm(temp, { force: true }); }
  return record;
}

/** Delete one session. Returns false when there was nothing there. */
export async function deleteSessionRecord(stateDir: string, slot: string): Promise<boolean> {
  try {
    await rm(sessionFilePath(stateDir, slot));
    return true;
  } catch {
    return false;
  }
}

/** Coerce a parsed file into a record, or null when it carries no slot to key it by. */
function normalise(raw: ParsedRecord | null): SessionRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const slot = typeof raw.slot === 'string' ? raw.slot : '';
  if (!slot) return null;
  const data = raw.data && typeof raw.data === 'object' ? (raw.data as SessionData) : {};
  const rights = sessionRightsDecisions(raw);
  const emoji = sessionEmojiStamp(raw);
  return {
    slot,
    ...(rights ? { rightsDecisions: rights } : {}),
    ...(emoji ? { emoji } : {}),
    toolId: typeof raw.toolId === 'string' && raw.toolId ? raw.toolId : (typeof data.__toolId === 'string' ? data.__toolId : undefined),
    toolVersion: typeof raw.toolVersion === 'string' ? raw.toolVersion : undefined,
    label: typeof raw.label === 'string' && raw.label ? raw.label : (typeof data.__label === 'string' ? data.__label : undefined),
    data,
    thumb: typeof raw.thumb === 'string' ? raw.thumb : null,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : '',
    ...(typeof raw.createdAt === 'string' ? { createdAt: raw.createdAt } : {}),
    ...(typeof raw.formatVersion === 'number' ? { formatVersion: raw.formatVersion } : {}),
    ...(typeof raw.engineVersion === 'string' ? { engineVersion: raw.engineVersion } : {}),
  };
}
