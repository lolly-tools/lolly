// SPDX-License-Identifier: MPL-2.0
/**
 * Folders — a user-facing way to organize saved work into named groups.
 *
 * A "folder" (the user calls it a group, e.g. "my event") holds references to saved
 * sessions and user images, AND can nest inside another folder: each folder carries an
 * optional `parentId` (null / absent = a top-level folder). The tree is single-rooted —
 * a folder has exactly one parent and a session/image belongs to exactly one folder —
 * so it's a strict hierarchy, kept acyclic by `moveFolder` (can't reparent into self or
 * a descendant). A saved *batch* session is itself still a one-directory-deep folder of
 * rows, so a batch under a folder adds one more implicit level inside the zip.
 *
 * Folders live on the single profile record (`profile.folders`), riding the normal
 * profile persistence/sync exactly like `featureFlags`. An item references a saved
 * session by its host.state slot, or a user image by its `user/...` asset id. A ref
 * belongs to at most one folder; anything unreferenced shows at the root. Legacy
 * folders saved before nesting have no `parentId` → treated as top-level.
 *
 * This module is a thin facade over host.profile / host.state / host.assets. It must
 * stay free of DOM, engine, and pro/ imports so it can be used from the (pro-free)
 * gallery and picker as well as from /pro.
 */

export interface FolderItem { type: 'session' | 'image'; ref: string; }
export interface Folder {
  id: string;
  name: string;
  /** absent/null = top-level (legacy folders saved before nesting have none). */
  parentId?: string | null;
  items: FolderItem[];
  createdAt: string;
  updatedAt: string;
}

/** The profile record as this module sees it: folders + whatever else rides
 * along (spread untouched via `{ ...profile }` — no index signature needed, so
 * the host's own Profile type satisfies this slice structurally). */
interface FolderProfile {
  folders?: Folder[];
  /** Shared with the host's Profile type so it satisfies this weak slice. */
  custom?: Record<string, string>;
}

/** The slice of the host bridge the folder store reads/writes. */
export interface FolderHost {
  profile: {
    get(): Promise<FolderProfile>;
    set(profile: FolderProfile): Promise<unknown>;
  };
  state: { list(): Promise<ReadonlyArray<{ slot: string }>> };
  assets: { _listUserAssets(): Promise<ReadonlyArray<{ id: string }>> };
}

// ── Tree helpers (pure; operate on a plain folders array) ───────────────────
// A folder's parent is `parentId` (absent/undefined === top-level). These are exported
// so the Projects view can render the hierarchy without re-deriving the walk each place.

const parentOf = (f: Folder): string | null => f?.parentId ?? null;

/**
 * Direct children of `parentId` (null → top level). An ORPHAN — a folder whose parent
 * no longer exists (e.g. a soft-removed ancestor synced from elsewhere) — surfaces at
 * the top level so it can never vanish from the tree.
 */
export function childFolders(folders: readonly Folder[], parentId: string | null): Folder[] {
  const ids = new Set(folders.map(f => f.id));
  return folders.filter(f => {
    const p = parentOf(f);
    return parentId == null ? (p == null || !ids.has(p)) : p === parentId;
  });
}

/** The chain of folder objects from the top-level ancestor down to `id` (inclusive). */
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

/** Every folder id strictly beneath `id` (its whole subtree, excluding `id` itself). */
export function descendantFolderIds(folders: readonly Folder[], id: string): string[] {
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

function uuid(): string {
  // crypto.randomUUID is available in every browser we target; fall back just in
  // case (e.g. a non-secure context) so folder creation never hard-fails.
  if (typeof globalThis.crypto?.randomUUID === 'function') return crypto.randomUUID();
  return 'f-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const now = (): string => new Date().toISOString();

/** Strip a ref from every folder's items (used to enforce single-membership). */
function detach(folders: Folder[], ref: string): void {
  for (const f of folders) {
    const before = f.items.length;
    f.items = f.items.filter(it => it.ref !== ref);
    if (f.items.length !== before) f.updatedAt = now();
  }
}

export function createFolderStore(host: FolderHost) {
  // Read-modify-write helper: always operates on the whole profile object so we
  // never clobber sibling fields (featureFlags, headshot, …).
  async function mutate<T>(fn: (folders: Folder[]) => T): Promise<T> {
    const profile = await host.profile.get();
    const folders = (profile.folders ?? []).map(f => ({ ...f, items: [...f.items] }));
    const result = fn(folders);
    await host.profile.set({ ...profile, folders });
    return result;
  }

  return {
    /** All folders, in stored order. */
    async list(): Promise<Folder[]> {
      const profile = await host.profile.get();
      return profile.folders ?? [];
    },

    async get(folderId: string): Promise<Folder | null> {
      return (await this.list()).find(f => f.id === folderId) ?? null;
    },

    /** Pure helper: which folder (id) a ref currently lives in, or null for root. */
    folderOfRef(folders: readonly Folder[], ref: string): string | null {
      return folders.find(f => f.items.some(it => it.ref === ref))?.id ?? null;
    },

    // ── Folder CRUD ──────────────────────────────────────────────────────────

    async create(name: string, parentId: string | null = null): Promise<Folder> {
      const label = String(name ?? '').trim();
      if (!label) throw new Error('A folder name is required.');
      const folder: Folder = { id: uuid(), name: label, parentId: parentId ?? null, items: [], createdAt: now(), updatedAt: now() };
      await mutate(folders => folders.push(folder));
      return folder;
    },

    async rename(folderId: string, name: string): Promise<void> {
      const label = String(name ?? '').trim();
      if (!label) throw new Error('A folder name is required.');
      await mutate(folders => {
        const f = folders.find(x => x.id === folderId);
        if (f) { f.name = label; f.updatedAt = now(); }
      });
    },

    /**
     * Soft-delete a single folder: its items return to the root (not deleted) and its
     * direct sub-folders are LIFTED to its parent (not orphaned), so the record drops
     * without losing anything. To hard-delete a whole subtree, see removeSubtree.
     */
    async remove(folderId: string): Promise<void> {
      await mutate(folders => {
        const i = folders.findIndex(f => f.id === folderId);
        const target = folders[i];
        if (i < 0 || !target) return;
        const parent = target.parentId ?? null;
        for (const f of folders) if ((f.parentId ?? null) === folderId) f.parentId = parent; // lift children up
        folders.splice(i, 1);
      });
    },

    /** Hard-delete a folder AND its whole subtree of sub-folders (folder records only —
     * the caller deletes the items/previews via host.state/host.assets first). */
    async removeSubtree(folderId: string): Promise<void> {
      await mutate(folders => {
        const kill = new Set([folderId, ...descendantFolderIds(folders, folderId)]);
        for (let i = folders.length - 1; i >= 0; i--) {
          const f = folders[i];
          if (f && kill.has(f.id)) folders.splice(i, 1);
        }
      });
    },

    /**
     * Reparent a folder under `newParentId` (null → top level). No-op when it would
     * create a cycle (moving a folder into itself or one of its own descendants) or the
     * target doesn't exist — the tree stays a strict hierarchy.
     */
    async moveFolder(folderId: string, newParentId: string | null): Promise<void> {
      await mutate(folders => {
        if (folderId === newParentId) return;
        const f = folders.find(x => x.id === folderId);
        if (!f) return;
        if (newParentId != null) {
          if (!folders.some(x => x.id === newParentId)) return;             // target gone
          if (descendantFolderIds(folders, folderId).includes(newParentId)) return; // cycle
        }
        f.parentId = newParentId ?? null;
        f.updatedAt = now();
      });
    },

    /**
     * Reorder folders to match a list of ids (drag-to-reorder in the Projects view).
     * Ids not present keep their relative order after the listed ones; unknown ids
     * are ignored. Persists the new stored order.
     */
    async reorder(orderedIds: readonly string[]): Promise<void> {
      const rank = new Map(orderedIds.map((id, i) => [id, i]));
      await mutate(folders => {
        folders.sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
      });
    },

    // ── Membership ───────────────────────────────────────────────────────────

    /** Add an item to a folder, removing it from any other folder first. */
    async addItem(folderId: string, item: FolderItem): Promise<void> {
      await mutate(folders => {
        detach(folders, item.ref);
        const f = folders.find(x => x.id === folderId);
        if (f && !f.items.some(it => it.ref === item.ref)) {
          f.items.push({ type: item.type, ref: item.ref });
          f.updatedAt = now();
        }
      });
    },

    async removeItem(folderId: string, ref: string): Promise<void> {
      await mutate(folders => {
        const f = folders.find(x => x.id === folderId);
        if (!f) return;
        const before = f.items.length;
        f.items = f.items.filter(it => it.ref !== ref);
        if (f.items.length !== before) f.updatedAt = now();
      });
    },

    /**
     * Move an item (by ref) to a folder, or to the root (toFolderId = null). The
     * item's type is preserved from wherever it currently sits; if it isn't in any
     * folder yet, `type` must be supplied.
     */
    async moveItem(ref: string, toFolderId: string | null, type?: FolderItem['type']): Promise<void> {
      await mutate(folders => {
        const existing = folders.flatMap(f => f.items).find(it => it.ref === ref);
        const kind = type ?? existing?.type;
        detach(folders, ref);
        if (toFolderId == null) return; // root
        const f = folders.find(x => x.id === toFolderId);
        if (f && kind) { f.items.push({ type: kind, ref }); f.updatedAt = now(); }
      });
    },

    /**
     * Rename support for batch sessions: their slot encodes the name, so renaming
     * mints a new slot. Rewrite any folder item referencing the old slot in place.
     */
    async swapSessionSlot(oldSlot: string, newSlot: string): Promise<void> {
      await mutate(folders => {
        for (const f of folders) {
          const it = f.items.find(x => x.ref === oldSlot);
          if (it) { it.ref = newSlot; f.updatedAt = now(); }
        }
      });
    },

    /**
     * Dual-source reconciliation: drop item refs that no longer exist in either
     * backing store (a session deleted from the gallery drawer, an image deleted
     * from the picker). Persists only when something actually changed, to avoid
     * needless profile writes / subscriber churn. Returns { removed }.
     */
    async prune(): Promise<{ removed: number }> {
      const [stateList, userAssets] = await Promise.all([
        host.state.list(),
        host.assets._listUserAssets(),
      ]);
      const slots = new Set(stateList.map(e => e.slot));
      const images = new Set(userAssets.map(a => a.id));

      let removed = 0;
      const profile = await host.profile.get();
      const folders = (profile.folders ?? []).map(f => {
        const items = f.items.filter(it =>
          it.type === 'session' ? slots.has(it.ref) : images.has(it.ref),
        );
        removed += f.items.length - items.length;
        return items.length === f.items.length ? f : { ...f, items, updatedAt: now() };
      });

      if (removed > 0) await host.profile.set({ ...profile, folders });
      return { removed };
    },
  };
}
