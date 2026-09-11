// SPDX-License-Identifier: MPL-2.0
/**
 * Folders - a user-facing way to organize saved work into named groups.
 *
 * A "folder" (the user calls it a group, e.g. "my event") holds references to saved
 * sessions and user images, AND can nest inside another folder: each folder carries an
 * optional `parentId` (null / absent = a top-level folder). The tree is single-rooted - 
 * a folder has exactly one parent and a session/image belongs to exactly one folder - 
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
  /** Optional identity accents (plans/133 WP-1, additive - legacy folders have
   *  neither): a tag colour from the fixed FOLDER_COLORS palette, and a single
   *  emoji shown on the folder cover in place of the generic glyph. */
  color?: string;
  emoji?: string;
  /** Free-form search tags (2026-08-20) - matched by projects search + the
   *  spotlight alongside the name. */
  tags?: string[];
}

/** FALLBACK folder accents only (2026-08-20): the style dialog offers the
 *  ACTIVE design system's palette (lib/live-palette.ts) first; these fixed
 *  hues appear only when no palette resolves at all. */
export const FOLDER_COLORS: readonly string[] = [
  '#e5484d', '#f76b15', '#ffc53d', '#30a46c', '#0090ff', '#8e4ec6', '#8d8d8d',
];

// ── Trash (plans/133 WP-4) ───────────────────────────────────────────────────
// Deleted sessions/folders park here (profile.trash) instead of vanishing: a
// session's state record is MOVED to a `__trash__:`-prefixed slot (so every
// session-listing surface filters it out - see lib/batch-slots.ts), a folder's
// subtree records are lifted out of `profile.folders` wholesale into the entry.
// Restore reverses both; purge (30 days, or Delete forever) does the real
// deletion. Image items ride inside a trashed folder's records as plain refs -
// bytes live in the catalog and are never deleted from here.

export interface TrashedSession {
  kind: 'session';
  /** The `__trash__:`-prefixed slot the record now lives at. */
  slot: string;
  originalSlot: string;
  label: string;
  /** Folder the session lived in (null = loose) - restore puts it back. */
  parentId: string | null;
  deletedAt: string;
}
export interface TrashedFolder {
  kind: 'folder';
  /** The removed subtree's folder records, root first; item refs keep their
   *  ORIGINAL session slots (the moves map below tracks the trash slots). */
  tree: Folder[];
  rootId: string;
  name: string;
  /** Session slot moves performed when this folder was trashed. */
  sessions: Array<{ originalSlot: string; slot: string }>;
  deletedAt: string;
}
export type TrashEntry = TrashedSession | TrashedFolder;

/** How long a trash entry survives before the purge sweep removes it for real. */
export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

// ── Project templates (plans/133 WP-11a) ────────────────────────────────────
// A folder saved as a reusable starting point. Same split as the trash: the
// folder records travel in the profile entry, the member sessions' state
// records are COPIED to `__ptpl__:`-prefixed slots (lib/batch-slots.ts) by the
// Projects view, which owns state writes. Image items are references with
// single membership, so a template carries sessions only.

export interface ProjectTemplate {
  id: string;
  name: string;
  createdAt: string;
  /** The captured subtree, root first, with its ORIGINAL folder ids (instantiation
   *  mints fresh ones). Session item refs point at the template's `__ptpl__:` slots. */
  tree: Folder[];
}

/** The profile record as this module sees it: folders + whatever else rides
 * along (spread untouched via `{ ...profile }` - no index signature needed, so
 * the host's own Profile type satisfies this slice structurally). */
interface FolderProfile {
  folders?: Folder[];
  trash?: TrashEntry[];
  projectTemplates?: ProjectTemplate[];
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
  assets: {
    _listUserAssets(): Promise<ReadonlyArray<{ id: string }>>;
    /** Catalog asset base ids - optional so minimal hosts (tests, CLI) still satisfy
     *  the shape; when absent, a folder can only hold user-owned image refs. Present
     *  on the web host so catalog assets referenced (not copied) into a folder survive
     *  reconciliation. */
    _listCatalogAssetIds?(): Promise<ReadonlyArray<string>>;
  };
}

/** A catalog reference stored in a folder may carry image modifiers (?theme=…,
 *  ?treatment=…); its persistence is decided by the plain catalog base id, so strip
 *  any modifier before comparing against the catalog set. Kept engine-free (a bare
 *  `?`/`#` cut) so this module stays importable from the pro-free surfaces. */
const catalogBaseId = (ref: string): string => ref.split('?')[0]!.split('#')[0]!;

// ── Tree helpers (pure; operate on a plain folders array) ───────────────────
// A folder's parent is `parentId` (absent/undefined === top-level). These are exported
// so the Projects view can render the hierarchy without re-deriving the walk each place.

const parentOf = (f: Folder): string | null => f?.parentId ?? null;

/**
 * Direct children of `parentId` (null → top level). An ORPHAN - a folder whose parent
 * no longer exists (e.g. a soft-removed ancestor synced from elsewhere) - surfaces at
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
  // Cast to an optional-method shape so the existence check is meaningful to TS
  // (the lib type declares randomUUID as always-present); runtime is unchanged.
  if ((globalThis.crypto as { randomUUID?: unknown } | undefined)?.randomUUID) return crypto.randomUUID();
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

    /** Set/clear the identity accents + tags (plans/133 WP-1). `undefined`
     *  leaves a field alone; `null`/empty clears it. */
    async setStyle(folderId: string, style: { color?: string | null; emoji?: string | null; tags?: string[] | null }): Promise<void> {
      await mutate(folders => {
        const f = folders.find(x => x.id === folderId);
        if (!f) return;
        if (style.color !== undefined) { if (style.color) f.color = style.color; else delete f.color; }
        if (style.emoji !== undefined) { if (style.emoji) f.emoji = style.emoji; else delete f.emoji; }
        if (style.tags !== undefined) {
          const clean = (style.tags ?? []).map(t => t.trim()).filter(Boolean);
          if (clean.length) f.tags = clean; else delete f.tags;
        }
        f.updatedAt = now();
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
        if (i < 0) return;
        const parent = folders[i]!.parentId ?? null;
        for (const f of folders) if ((f.parentId ?? null) === folderId) f.parentId = parent; // lift children up
        folders.splice(i, 1);
      });
    },

    /** Hard-delete a folder AND its whole subtree of sub-folders (folder records only - 
     * the caller deletes the items/previews via host.state/host.assets first). */
    async removeSubtree(folderId: string): Promise<void> {
      await mutate(folders => {
        const kill = new Set([folderId, ...descendantFolderIds(folders, folderId)]);
        for (let i = folders.length - 1; i >= 0; i--) if (kill.has(folders[i]!.id)) folders.splice(i, 1);
      });
    },

    /**
     * Reparent a folder under `newParentId` (null → top level). No-op when it would
     * create a cycle (moving a folder into itself or one of its own descendants) or the
     * target doesn't exist - the tree stays a strict hierarchy.
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

    // ── Trash (plans/133 WP-4) ───────────────────────────────────────────────
    // The store owns the profile.trash entries and the folder-record halves; the
    // Projects view owns the host.state slot moves (save+remove), since this
    // module's host slice deliberately has no state write access.

    async trashList(): Promise<TrashEntry[]> {
      const profile = await host.profile.get();
      return profile.trash ?? [];
    },

    async trashAdd(entry: TrashEntry): Promise<void> {
      const profile = await host.profile.get();
      await host.profile.set({ ...profile, trash: [entry, ...(profile.trash ?? [])] });
    },

    /** Drop entries by identity key (a session's `slot` / a folder's `rootId`) -
     *  after a restore, a Delete-forever, or the retention sweep. */
    async trashDrop(keys: ReadonlySet<string>): Promise<void> {
      const profile = await host.profile.get();
      const trash = (profile.trash ?? []).filter(e => !keys.has(e.kind === 'session' ? e.slot : e.rootId));
      await host.profile.set({ ...profile, trash });
    },

    /**
     * Lift a folder subtree OUT of the live records (for trashing): removes the
     * records and returns them (root first, item refs untouched). The inverse of
     * restoreSubtree. Returns null when the folder doesn't exist.
     */
    async detachSubtree(folderId: string): Promise<Folder[] | null> {
      return mutate(folders => {
        const root = folders.find(f => f.id === folderId);
        if (!root) return null;
        const ids = new Set([folderId, ...descendantFolderIds(folders, folderId)]);
        const tree = [root, ...folders.filter(f => f.id !== folderId && ids.has(f.id))];
        for (let i = folders.length - 1; i >= 0; i--) if (ids.has(folders[i]!.id)) folders.splice(i, 1);
        return tree.map(f => ({ ...f, items: [...f.items] }));
      });
    },

    /** Re-insert a trashed subtree's records. A root whose original parent no
     *  longer exists surfaces at the top level via the orphan rule - nothing is
     *  lost. Skips ids that already exist (double-restore safety). */
    async restoreSubtree(tree: readonly Folder[]): Promise<void> {
      await mutate(folders => {
        const live = new Set(folders.map(f => f.id));
        for (const f of tree) if (!live.has(f.id)) folders.push({ ...f, items: [...f.items], updatedAt: now() });
      });
    },

    /** A COPY of a folder's subtree records (root first, items cloned) without
     *  touching the live tree - the capture half of a project template. */
    async snapshotSubtree(folderId: string): Promise<Folder[] | null> {
      const folders = await this.list();
      const root = folders.find(f => f.id === folderId);
      if (!root) return null;
      const ids = new Set(descendantFolderIds(folders, folderId));
      return [root, ...folders.filter(f => ids.has(f.id))].map(f => ({ ...f, items: [...f.items] }));
    },

    /**
     * Insert a template's tree under `parentId` with FRESH ids (so the same
     * template can be used many times), remapping each folder's parentId and
     * its session item refs through `slotMap` (template slot → new live slot).
     * Items whose slot isn't in the map are dropped (a template session that
     * failed to copy must not leave a dangling ref). Returns the new root.
     */
    async instantiateSubtree(tree: readonly Folder[], parentId: string | null, slotMap: ReadonlyMap<string, string>): Promise<Folder | null> {
      if (!tree.length) return null;
      const idMap = new Map(tree.map(f => [f.id, uuid()]));
      const rootId = tree[0]!.id;
      const created = tree.map(f => ({
        ...f,
        id: idMap.get(f.id)!,
        parentId: f.id === rootId ? (parentId ?? null) : (idMap.get(f.parentId ?? '') ?? idMap.get(rootId)!),
        items: f.items.filter(it => it.type === 'session' && slotMap.has(it.ref)).map(it => ({ type: it.type, ref: slotMap.get(it.ref)! })),
        createdAt: now(), updatedAt: now(),
      }));
      await mutate(folders => { for (const f of created) folders.push(f); });
      return created[0]!;
    },

    // ── Project templates (plans/133 WP-11a) ─────────────────────────────────

    async templateList(): Promise<ProjectTemplate[]> {
      const profile = await host.profile.get();
      return profile.projectTemplates ?? [];
    },

    async templateAdd(input: { name: string; tree: Folder[] }): Promise<ProjectTemplate> {
      const name = String(input.name ?? '').trim();
      if (!name) throw new Error('A template name is required.');
      const tpl: ProjectTemplate = { id: uuid(), name, createdAt: now(), tree: input.tree.map(f => ({ ...f, items: [...f.items] })) };
      const profile = await host.profile.get();
      await host.profile.set({ ...profile, projectTemplates: [tpl, ...(profile.projectTemplates ?? [])] });
      return tpl;
    },

    async templateDrop(id: string): Promise<void> {
      const profile = await host.profile.get();
      await host.profile.set({ ...profile, projectTemplates: (profile.projectTemplates ?? []).filter(t => t.id !== id) });
    },

    /**
     * Dual-source reconciliation: drop item refs that no longer exist in either
     * backing store (a session deleted from the gallery drawer, an image deleted
     * from the picker). Persists only when something actually changed, to avoid
     * needless profile writes / subscriber churn. Returns { removed }.
     */
    async prune(): Promise<{ removed: number }> {
      const [stateList, userAssets, catalogIds] = await Promise.all([
        host.state.list(),
        host.assets._listUserAssets(),
        host.assets._listCatalogAssetIds?.() ?? Promise.resolve([] as ReadonlyArray<string>),
      ]);
      const slots = new Set(stateList.map(e => e.slot));
      const images = new Set(userAssets.map(a => a.id));
      const catalog = new Set(catalogIds);   // catalog base ids referenced into folders

      let removed = 0;
      const profile = await host.profile.get();
      const folders = (profile.folders ?? []).map(f => {
        const items = f.items.filter(it =>
          it.type === 'session'
            ? slots.has(it.ref)
            // An image item is either a user-owned upload (its id in `images`) or a
            // catalog asset referenced by id (its base id in `catalog`).
            : (images.has(it.ref) || catalog.has(catalogBaseId(it.ref))),
        );
        removed += f.items.length - items.length;
        return items.length === f.items.length ? f : { ...f, items, updatedAt: now() };
      });

      if (removed > 0) await host.profile.set({ ...profile, folders });
      return { removed };
    },
  };
}
