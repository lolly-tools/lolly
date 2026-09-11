// SPDX-License-Identifier: MPL-2.0
/**
 * Persistent, on-device store for the TUI - the CLI shell is ephemeral (in-memory),
 * but a usable interactive shell needs saved projects and a profile that stick. Both
 * are plain JSON under the state directory `resolveStateDir()` picks: `$LOLLY_STATE_DIR`,
 * the desktop app's data directory when the app is installed here, else `~/.lolly`. No
 * network, no DB - files on disk, matching the offline-first ethos of every other shell.
 *
 * Saved projects use the DESKTOP app's record layout, `saved-state/<token>.json` written
 * by createFsStateAPI (plans/202 WP3.1), so a session saved in the desktop app shows up in
 * Projects here and a session saved here opens there. The Node half of that layout lives in
 * @lolly-tools/node-shell/session-store; this module is the TUI's view of it.
 *
 * The profile and folders stay TUI-only files beside them: the desktop app keeps both in
 * IndexedDB behind the web bridge, so there is nothing on disk to share yet.
 *
 * Sessions the TUI saved before the move (`sessions/<slot>.json`, a flat
 * {slot,toolId,label,query,updatedAt}) are copied into the shared layout once, on first
 * read. The old files are left where they are; a marker beside the new ones stops the copy
 * from running twice.
 */
import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { encodeFsToken } from '@lolly/engine';
import { resolveStateDir } from '@lolly-tools/node-shell/state-dir';
import {
  deleteSessionRecord, listSessionRecords, readSessionRecord, sessionsDir, writeSessionRecord,
  type SessionData,
} from '@lolly-tools/node-shell/session-store';

const DIR = resolveStateDir().dir;
const LEGACY_SESSIONS_DIR = join(DIR, 'sessions');
const PROFILE_PATH = join(DIR, 'profile.json');
// Not a dotfile and not a .json, so the record readers skip it (same reasoning as the
// desktop's own marker: a leading dot is a forbidden path under the Tauri fs scope).
const MIGRATION_MARKER = join(sessionsDir(DIR), 'tui-sessions-v1.marker');

/** The serialised URL-state a TUI-saved session reopens from, kept inside the record. */
const QUERY_KEY = '__tui_query';

export function configDir(): string { return DIR; }

/** Where exports land by default - the user's Desktop (falls back to home). Created on
 *  write if missing (see engine-render.exportToFile). */
export function defaultExportDir(): string {
  const desktop = join(homedir(), 'Desktop');
  return existsSync(desktop) ? desktop : homedir();
}

/** A saved "project" - a tool plus the state it reopens with. `query` is the serialised
 *  URL-state (TUI-saved sessions and migrated ones have it); `data` is the record's saved
 *  values, which is all a desktop-saved session carries. Either one reopens the tool. */
export interface SavedSession {
  slot: string;
  toolId: string;
  label: string;
  query: string;
  updatedAt: string;
  /** The record's saved values - present on every record read off disk. */
  data?: SessionData;
}

export function slug(s: string): string {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'session';
}

/** One saved record as the TUI sees it. A record with no toolId is app state the web
 *  shell keeps in the same store (export preferences, the design-system tray) - not a
 *  project, so it never reaches the Projects list. */
function toSession(record: { slot: string; toolId?: string; label?: string; data: SessionData; updatedAt: string }): SavedSession | null {
  if (!record.toolId) return null;
  const query = typeof record.data[QUERY_KEY] === 'string' ? record.data[QUERY_KEY] as string : '';
  return {
    slot: record.slot,
    toolId: record.toolId,
    label: record.label || record.slot,
    query,
    updatedAt: record.updatedAt,
    data: record.data,
  };
}

// ── One-time copy of the pre-2026-09 TUI session files ───────────────────────
let migrated: Promise<void> | null = null;
function ensureMigrated(): Promise<void> {
  if (!migrated) migrated = migrateLegacySessions();
  return migrated;
}

async function migrateLegacySessions(): Promise<void> {
  await mkdir(sessionsDir(DIR), { recursive: true });
  if (existsSync(MIGRATION_MARKER)) return;
  let names: string[] = [];
  try { names = await readdir(LEGACY_SESSIONS_DIR); } catch { /* nothing to copy */ }
  let copied = 0;
  let failed = 0;
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    try {
      const old = JSON.parse(await readFile(join(LEGACY_SESSIONS_DIR, name), 'utf8')) as Partial<SavedSession>;
      if (typeof old.slot !== 'string' || !old.slot || typeof old.toolId !== 'string' || !old.toolId) continue;
      if (await readSessionRecord(DIR, old.slot)) continue;   // already there - never overwrite
      await writeSessionRecord(DIR, {
        slot: old.slot,
        data: { __toolId: old.toolId, __label: old.label, [QUERY_KEY]: old.query ?? '' },
        updatedAt: typeof old.updatedAt === 'string' ? old.updatedAt : undefined,
      });
      copied++;
    } catch { failed++; }
  }
  // Only mark done on a clean pass; the copy skips records that are already there, so
  // running it again costs a directory walk and nothing else.
  if (failed === 0) {
    try { await writeFile(MIGRATION_MARKER, '1'); } catch { /* retry next launch */ }
  }
  if (copied > 0) {
    process.stderr.write(`Moved ${copied} saved project${copied === 1 ? '' : 's'} into ${sessionsDir(DIR)} - the desktop app reads them there too.\n`);
  }
}

export async function listSessions(): Promise<SavedSession[]> {
  await ensureMigrated();
  const out: SavedSession[] = [];
  for (const record of await listSessionRecords(DIR)) {
    const session = toSession(record);
    if (session) out.push(session);
  }
  return out;
}

export async function saveSession(s: SavedSession & { values?: Record<string, unknown> }): Promise<void> {
  await ensureMigrated();
  await writeSessionRecord(DIR, {
    slot: s.slot,
    label: s.label,
    toolId: s.toolId,
    data: { ...(s.values ?? {}), __toolId: s.toolId, __label: s.label, [QUERY_KEY]: s.query },
    updatedAt: s.updatedAt,
  });
}

export async function deleteSession(slot: string): Promise<void> {
  await ensureMigrated();
  await deleteSessionRecord(DIR, slot);
}

/** Rename a saved session (its display label only) - keeps slot + updatedAt so its
 *  position in the 'recent' order doesn't jump. */
export async function renameSession(slot: string, label: string): Promise<void> {
  await ensureMigrated();
  const record = await readSessionRecord(DIR, slot);
  if (!record) throw new Error(`No saved project “${slot}”`);
  await writeSessionRecord(DIR, {
    slot,
    label,
    toolId: record.toolId,
    data: { ...record.data, __label: label },
    thumb: record.thumb,
    updatedAt: record.updatedAt,
  });
}

export async function getProfile(): Promise<Record<string, unknown>> {
  try { return JSON.parse(await readFile(PROFILE_PATH, 'utf8')) as Record<string, unknown>; }
  catch { return {}; }
}

export async function setProfile(p: Record<string, unknown>): Promise<void> {
  await mkdir(DIR, { recursive: true });
  await writeFile(PROFILE_PATH, JSON.stringify(p, null, 2));
}

/** Back up everything the TUI persists (all saved projects + profile + folders) into a
 *  single portable zip on the Desktop - the "export my data" half of the web feature.
 *  Reopenable: each project keeps the record the shells share. Returns the written path. */
export async function backupData(stamp: string): Promise<{ path: string; count: number }> {
  const { zipSync, strToU8 } = await import('fflate');
  const files: Record<string, Uint8Array> = {};
  const records = await listSessionRecords(DIR);
  for (const r of records) files[`saved-state/${encodeFsToken(r.slot)}.json`] = strToU8(JSON.stringify(r, null, 2));
  try { files['profile.json'] = strToU8(await readFile(PROFILE_PATH, 'utf8')); } catch { /* none */ }
  try { files['folders.json'] = strToU8(await readFile(join(DIR, 'folders.json'), 'utf8')); } catch { /* none */ }
  const zip = zipSync(files, { level: 6 });
  const path = join(defaultExportDir(), `lolly-backup-${stamp}.zip`);
  await mkdir(defaultExportDir(), { recursive: true });
  await writeFile(path, Buffer.from(zip));
  return { path, count: records.length };
}
