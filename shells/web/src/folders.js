// SPDX-License-Identifier: MPL-2.0
/**
 * Folders — a user-facing way to organize saved work into named groups.
 *
 * A "folder" (the user calls it a group, e.g. "my event") is one directory deep:
 * it holds references to saved sessions and user images, nothing nested. A saved
 * *batch* session is itself already a one-directory-deep folder — its rows are the
 * "files" — so a group of batch sessions gives exactly two levels of organization,
 * which is the limit we want.
 *
 * Folders live on the single profile record (`profile.folders`), riding the normal
 * profile persistence/sync exactly like `featureFlags`. An item references a saved
 * session by its host.state slot, or a user image by its `user/...` asset id. A ref
 * belongs to at most one folder; anything unreferenced shows at the root.
 *
 * This module is a thin facade over host.profile / host.state / host.assets. It must
 * stay free of DOM, engine, and pro/ imports so it can be used from the (pro-free)
 * gallery and picker as well as from /pro.
 */

/** @typedef {{ type: 'session' | 'image', ref: string }} FolderItem */
/** @typedef {{ id: string, name: string, items: FolderItem[], createdAt: string, updatedAt: string }} Folder */

function uuid() {
  // crypto.randomUUID is available in every browser we target; fall back just in
  // case (e.g. a non-secure context) so folder creation never hard-fails.
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'f-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const now = () => new Date().toISOString();

/** Strip a ref from every folder's items (used to enforce single-membership). */
function detach(folders, ref) {
  for (const f of folders) {
    const before = f.items.length;
    f.items = f.items.filter(it => it.ref !== ref);
    if (f.items.length !== before) f.updatedAt = now();
  }
}

export function createFolderStore(host) {
  // Read-modify-write helper: always operates on the whole profile object so we
  // never clobber sibling fields (featureFlags, headshot, …).
  async function mutate(fn) {
    const profile = await host.profile.get();
    const folders = (profile.folders ?? []).map(f => ({ ...f, items: [...f.items] }));
    const result = fn(folders);
    await host.profile.set({ ...profile, folders });
    return result;
  }

  return {
    /** All folders, in stored order. */
    async list() {
      const profile = await host.profile.get();
      return profile.folders ?? [];
    },

    async get(folderId) {
      return (await this.list()).find(f => f.id === folderId) ?? null;
    },

    /** Pure helper: which folder (id) a ref currently lives in, or null for root. */
    folderOfRef(folders, ref) {
      return folders.find(f => f.items.some(it => it.ref === ref))?.id ?? null;
    },

    // ── Folder CRUD ──────────────────────────────────────────────────────────

    async create(name) {
      const label = String(name ?? '').trim();
      if (!label) throw new Error('A folder name is required.');
      const folder = { id: uuid(), name: label, items: [], createdAt: now(), updatedAt: now() };
      await mutate(folders => folders.push(folder));
      return folder;
    },

    async rename(folderId, name) {
      const label = String(name ?? '').trim();
      if (!label) throw new Error('A folder name is required.');
      await mutate(folders => {
        const f = folders.find(x => x.id === folderId);
        if (f) { f.name = label; f.updatedAt = now(); }
      });
    },

    /** Delete a folder; its items return to the root (they are not deleted). */
    async remove(folderId) {
      await mutate(folders => {
        const i = folders.findIndex(f => f.id === folderId);
        if (i >= 0) folders.splice(i, 1);
      });
    },

    // ── Membership ───────────────────────────────────────────────────────────

    /** Add an item to a folder, removing it from any other folder first. */
    async addItem(folderId, item) {
      await mutate(folders => {
        detach(folders, item.ref);
        const f = folders.find(x => x.id === folderId);
        if (f && !f.items.some(it => it.ref === item.ref)) {
          f.items.push({ type: item.type, ref: item.ref });
          f.updatedAt = now();
        }
      });
    },

    async removeItem(folderId, ref) {
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
    async moveItem(ref, toFolderId, type) {
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
    async swapSessionSlot(oldSlot, newSlot) {
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
    async prune() {
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
