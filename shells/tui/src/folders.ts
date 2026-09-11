// SPDX-License-Identifier: MPL-2.0
/**
 * Folders - organise saved sessions into named, nestable groups.
 *
 * The web shell stores folders on the single profile record (host.profile), and the
 * desktop app keeps that record in IndexedDB, so there is no folder file on disk to share
 * with the desktop yet. The TUI has no such facade either - its store is plain JSON files
 * under the state directory resolveStateDir() picks (see store.ts). So folders get their
 * OWN file, `folders.json`, holding a bare `Folder[]`. This module mirrors the shape of the
 * web `folders.ts` (same tree semantics: single-rooted hierarchy, a session belongs to at
 * most one folder, cycles are refused) but the persistence is a flat read-modify-write of
 * one JSON array - it does NOT reuse the browser code, which is a host.profile facade.
 *
 * Only sessions live in TUI folders (no user-image assets - the terminal has none). A
 * folder record referencing a session that was later deleted from Projects self-heals via
 * `prune(validSlots)` on load. Deleting a folder never deletes the sessions it held - they
 * revert to "uncategorised".
 */
import { join } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolveStateDir } from '@lolly-tools/node-shell/state-dir';

// The same directory store.ts resolves: $LOLLY_STATE_DIR, then the desktop app's data
// directory when the app is installed here, then ~/.lolly. This used to read only
// $LOLLY_TUI_DIR, so folders were left behind in ~/.lolly the moment anyone set the
// current variable and the Projects tree came up empty (plans/202 WP3.1).
const DIR = resolveStateDir().dir;

export interface FolderItem {
  type: 'session';        // only sessions in the TUI (no user-image assets here)
  ref: string;            // === SavedSession.slot
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;   // null === top-level
  items: FolderItem[];
  createdAt: string;         // ISO
  updatedAt: string;         // ISO
}

// ── Internal persistence helpers (not exported) ──────────────────────────────
const now = (): string => new Date().toISOString();

async function ensure(): Promise<void> { await mkdir(DIR, { recursive: true }); }

/** Read the whole folder array; `[]` when the file is missing or corrupt. */
async function readAll(): Promise<Folder[]> {
  try {
    const raw = JSON.parse(await readFile(foldersPath(), 'utf8')) as unknown;
    if (!Array.isArray(raw)) return [];
    // Normalise legacy/partial records so callers can rely on the shape.
    return raw.map((f) => {
      const r = f as Partial<Folder>;
      return {
        id: String(r.id ?? randomUUID()),
        name: String(r.name ?? 'Folder'),
        parentId: r.parentId ?? null,
        items: Array.isArray(r.items) ? r.items.filter((it): it is FolderItem => !!it && typeof it.ref === 'string') : [],
        createdAt: r.createdAt ?? now(),
        updatedAt: r.updatedAt ?? now(),
      };
    });
  } catch { return []; }
}

async function writeAll(folders: Folder[]): Promise<void> {
  await ensure();
  await writeFile(foldersPath(), JSON.stringify(folders, null, 2));
}

/** Read-modify-write wrapper: clones each folder's items before the mutator runs (so a
 *  caller can splice/filter freely), persists, and returns the mutator's result. */
async function mutate<T>(fn: (folders: Folder[]) => T): Promise<T> {
  const folders = (await readAll()).map(f => ({ ...f, items: [...f.items] }));
  const result = fn(folders);
  await writeAll(folders);
  return result;
}

/** Strip a ref from every folder's items (enforces single-membership). */
function detach(folders: Folder[], ref: string): void {
  for (const f of folders) {
    const before = f.items.length;
    f.items = f.items.filter(it => it.ref !== ref);
    if (f.items.length !== before) f.updatedAt = now();
  }
}

// ── Persistence ──────────────────────────────────────────────────────────────
export function foldersPath(): string { return join(DIR, 'folders.json'); }

export async function listFolders(): Promise<Folder[]> { return readAll(); }

export async function getFolder(id: string): Promise<Folder | null> {
  return (await readAll()).find(f => f.id === id) ?? null;
}

// ── Folder CRUD (async, persist immediately) ──────────────────────────────────
export async function createFolder(name: string, parentId: string | null = null): Promise<Folder> {
  const label = String(name ?? '').trim();
  if (!label) throw new Error('A folder name is required.');
  const folder: Folder = { id: randomUUID(), name: label, parentId: parentId ?? null, items: [], createdAt: now(), updatedAt: now() };
  await mutate(folders => { folders.push(folder); });
  return folder;
}

export async function renameFolder(id: string, name: string): Promise<void> {
  const label = String(name ?? '').trim();
  if (!label) throw new Error('A folder name is required.');
  await mutate(folders => {
    const f = folders.find(x => x.id === id);
    if (f) { f.name = label; f.updatedAt = now(); }
  });
}

/**
 * Cascade-delete `id` AND its whole subtree of sub-folders. The referenced sessions are
 * NOT deleted from disk - they revert to "uncategorised". Returns the removed folder ids.
 */
export async function removeFolder(id: string): Promise<{ removed: string[] }> {
  return mutate(folders => {
    const kill = new Set([id, ...descendantIds(folders, id)]);
    for (let i = folders.length - 1; i >= 0; i--) if (kill.has(folders[i]!.id)) folders.splice(i, 1);
    return { removed: [...kill] };
  });
}

/**
 * Reparent `id` under `newParentId` (null → top level). No-op on a cycle (reparenting into
 * itself or one of its own descendants) or when the target is missing.
 */
export async function moveFolder(id: string, newParentId: string | null): Promise<void> {
  await mutate(folders => {
    if (id === newParentId) return;
    const f = folders.find(x => x.id === id);
    if (!f) return;
    if (newParentId != null) {
      if (!folders.some(x => x.id === newParentId)) return;              // target gone
      if (descendantIds(folders, id).includes(newParentId)) return;     // cycle
    }
    f.parentId = newParentId ?? null;
    f.updatedAt = now();
  });
}

// ── Membership (async) ────────────────────────────────────────────────────────
/** Add a session ref to a folder, detaching it from any other folder first (single-membership). */
export async function addItem(folderId: string, ref: string): Promise<void> {
  await mutate(folders => {
    detach(folders, ref);
    const f = folders.find(x => x.id === folderId);
    if (f && !f.items.some(it => it.ref === ref)) {
      f.items.push({ type: 'session', ref });
      f.updatedAt = now();
    }
  });
}

export async function removeItem(folderId: string, ref: string): Promise<void> {
  await mutate(folders => {
    const f = folders.find(x => x.id === folderId);
    if (!f) return;
    const before = f.items.length;
    f.items = f.items.filter(it => it.ref !== ref);
    if (f.items.length !== before) f.updatedAt = now();
  });
}

/** Move a session ref to a folder, or detach it everywhere (toFolderId === null → uncategorised). */
export async function moveItem(ref: string, toFolderId: string | null): Promise<void> {
  await mutate(folders => {
    detach(folders, ref);
    if (toFolderId == null) return; // uncategorised
    const f = folders.find(x => x.id === toFolderId);
    if (f && !f.items.some(it => it.ref === ref)) { f.items.push({ type: 'session', ref }); f.updatedAt = now(); }
  });
}

// ── Reconciliation (async) ────────────────────────────────────────────────────
/**
 * Drop item refs whose slot is no longer a saved session (deleted from Projects). Persists
 * only when something changed. Caller passes `listSessions().map(s => s.slot)`.
 */
export async function prune(validSlots: readonly string[]): Promise<{ removed: number }> {
  const valid = new Set(validSlots);
  let removed = 0;
  const folders = (await readAll()).map(f => {
    const items = f.items.filter(it => valid.has(it.ref));
    removed += f.items.length - items.length;
    return items.length === f.items.length ? f : { ...f, items, updatedAt: now() };
  });
  if (removed > 0) await writeAll(folders);
  return { removed };
}

// ── Pure tree helpers (sync; operate on a passed folders array - no disk read) ─
const parentOf = (f: Folder): string | null => f?.parentId ?? null;

/**
 * Direct children of `parentId` (null → top level). An ORPHAN (parentId points at a
 * missing folder) surfaces at the top level so it never vanishes from the tree.
 */
export function childFolders(folders: readonly Folder[], parentId: string | null): Folder[] {
  const ids = new Set(folders.map(f => f.id));
  return folders.filter(f => {
    const p = parentOf(f);
    return parentId == null ? (p == null || !ids.has(p)) : p === parentId;
  });
}

/** Every folder id strictly beneath `id` (its whole subtree, excluding `id` itself). */
export function descendantIds(folders: readonly Folder[], id: string): string[] {
  const out: string[] = [];
  const stack: string[] = [id];
  while (stack.length) {
    const pid = stack.pop();
    for (const f of folders) {
      if (parentOf(f) === pid && f.id !== id && !out.includes(f.id)) { out.push(f.id); stack.push(f.id); }
    }
  }
  return out;
}

/** The breadcrumb chain of folder objects from the top-level ancestor down to `id` (inclusive). */
export function folderPath(folders: readonly Folder[], id: string): Folder[] {
  const byId = new Map(folders.map(f => [f.id, f]));
  const path: Folder[] = [];
  const seen = new Set<string>();
  let cur: Folder | null | undefined = byId.get(id);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    path.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : null;
  }
  return path;
}

/** Which folder a session slot currently lives in, or null (uncategorised). */
export function folderOfRef(folders: readonly Folder[], ref: string): string | null {
  return folders.find(f => f.items.some(it => it.ref === ref))?.id ?? null;
}

/** `allSlots` minus every referenced ref - the "uncategorised" bucket the Projects view shows. */
export function uncategorisedRefs(folders: readonly Folder[], allSlots: readonly string[]): string[] {
  const claimed = new Set(folders.flatMap(f => f.items.map(it => it.ref)));
  return allSlots.filter(s => !claimed.has(s));
}
