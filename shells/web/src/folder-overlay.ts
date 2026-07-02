// SPDX-License-Identifier: MPL-2.0
/**
 * Folder overlay — a shared, file-manager style modal for organizing saved work.
 *
 * One overlay serves three callers (gallery, /pro, picker). It shows folders
 * (groups) over loose root items, lets the user create/rename/delete folders and
 * move sessions/images between them, and — when the pro-batch flag is on — render a
 * whole folder to one nested zip.
 *
 * Isolation: this module imports only the host bridge, the folder store, and the
 * pro-free tile builders. The single touch into the removable /pro folder is a
 * gated dynamic import of ./pro/folder-export.js inside the export handler, so the
 * static graph stays /pro-free and the overlay loads from the (pro-free) gallery.
 */
import { escape } from './utils.ts';
import { createFolderStore } from './folders.ts';
import type { Folder, FolderItem } from './folders.ts';
import {
  sessionTile, imageTile, folderTile, FOLDER_ICON,
} from './folder-tiles.ts';
import type { SessionEntry, TileToolInfo, ImageTileRef, MemberPreview } from './folder-tiles.ts';
import { isBatchSlot, batchSlot } from './batch-slots.ts';
import type { FolderExportHost } from './pro/folder-export.ts';
import type { ZipAuthor } from './pro/zip.ts';

/** A session row as the overlay tracks it (bridge fields + tile fields).
 *  No index signature: a real StateEntry (no index signature of its own) can
 *  never structurally satisfy one, and nothing here reads it via bracket
 *  notation — the declared SessionEntry fields are all this module touches. */
type OverlayEntry = SessionEntry;
/** A user image ref as the overlay tracks it — same reasoning as OverlayEntry;
 *  a real AssetRef satisfies ImageTileRef's declared fields directly. */
type OverlayImageRef = ImageTileRef;

interface IndexedTool extends TileToolInfo { id: string; }

/**
 * The slice of the host bridge the overlay touches. The export-as-batch action
 * mounts real runtimes (see FolderExportHost), so this slice also carries the
 * RuntimeHost essentials — every caller passes the real bridge host anyway.
 */
interface OverlayHost {
  version: string;
  export: FolderExportHost['export'];
  tokens?: FolderExportHost['tokens'];
  compose?: FolderExportHost['compose'];
  profile: {
    // No index signature: an index signature is a nominal requirement that a
    // real Profile (no index signature of its own) can never structurally
    // satisfy. Listing just the optional fields this module reads lets any
    // host's own Profile type satisfy this slice — see folders.ts FolderProfile.
    // ZipAuthor fields ride along because export-as-batch forwards the
    // profile as the zip's author when the user opted in (useDetails).
    get(): Promise<{ folders?: Folder[]; useDetails?: boolean } & ZipAuthor>;
    set(profile: object): Promise<unknown>;
  };
  state: {
    load(slot: string): Promise<Record<string, unknown> | null>;
    save(slot: string, data: unknown, thumb?: string | null): Promise<unknown>;
    delete(slot: string): Promise<unknown>;
    list(): Promise<ReadonlyArray<{ slot: string }>>;
  };
  assets: {
    /** Present so the batch-export path can mount runtimes (RuntimeHost slice). */
    get: NonNullable<FolderExportHost['assets']>['get'];
    _deleteUserAsset(id: string): Promise<unknown>;
    _listUserAssets(): Promise<ReadonlyArray<{ id: string }>>;
  };
  log: FolderExportHost['log'];
}

export interface FolderOverlayOpts {
  context?: 'gallery' | 'pro' | 'picker' | 'projects';
  sessionEntries?: readonly OverlayEntry[];
  imageRefs?: readonly OverlayImageRef[];
  sessionSizes?: Record<string, number>;
  nameById?: Map<string | undefined, string>;
  onResume?(entry: OverlayEntry): void;
  onPickImage?(ref: OverlayImageRef): void;
  onDelete?(ref: string): void;
  onOpenGroup?(folder: Folder): void;
  showCreateFolder?: boolean;
  allowBatchExport?: boolean;
}

/**
 * @param host
 * @param opts {
 *   context: 'gallery'|'pro'|'picker'|'projects',
 *   sessionEntries: Array,        // host.state.list() rows
 *   imageRefs: Array,             // user AssetRefs (picker), default []
 *   sessionSizes: object,         // { slot: bytes }
 *   nameById: Map,                // toolId → tool name
 *   onResume(entry),              // resume/load a session
 *   onPickImage(ref),             // pick an image (picker)
 *   onDelete(ref),                // a session/image was deleted (update caller state)
 *   showCreateFolder: boolean,
 *   allowBatchExport: boolean,
 * }
 */
export function openFolderOverlay(host: OverlayHost, opts: FolderOverlayOpts = {}): void {
  const {
    context = 'gallery', sessionEntries = [], imageRefs = [], sessionSizes = {},
    nameById = new Map(), onResume, onPickImage, onDelete, onOpenGroup,
    showCreateFolder = false, allowBatchExport = false,
  } = opts;

  const store = createFolderStore(host);
  // Tool index entries (intended format + canvas size) so session tiles carry the same
  // spec as the gallery cards. Read from the app-wide index the shell keeps current.
  const w: Window & { __toolIndex?: { tools?: IndexedTool[] } } = window;
  const toolById = new Map((w.__toolIndex?.tools ?? []).map(t => [t.id, t]));

  // In-memory working copies — mutated in place so re-renders are instant; the
  // backing stores (host.state / host.assets / profile) are the source of truth.
  const sessionByRef = new Map<string, OverlayEntry>(sessionEntries.map(e => [e.slot, { ...e }]));
  const imageByRef = new Map<string, OverlayImageRef>(imageRefs.map(r => [r.id, r]));
  let folders: Folder[] = [];
  let viewFolderId: string | null = null;   // null → root view

  const dialog = document.createElement('dialog');
  dialog.className = 'tool-meta-dialog folder-overlay';
  dialog.setAttribute('aria-labelledby', 'folder-overlay-title');
  dialog.innerHTML = `<div class="folder-overlay-body"><div class="folder-overlay-loading">Loading…</div></div>`;
  openDialog(dialog);

  // ── Data helpers ───────────────────────────────────────────────────────────

  const sortByRecent = (a: OverlayEntry, b: OverlayEntry) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? ''));

  function claimedRefs() {
    return new Set(folders.flatMap(f => f.items.map(i => i.ref)));
  }

  function rootItems() {
    const claimed = claimedRefs();
    const sessions = [...sessionByRef.values()].filter(e => !claimed.has(e.slot)).sort(sortByRecent);
    const images = [...imageByRef.values()].filter(r => !claimed.has(r.id));
    return { sessions, images };
  }

  function tileForItem(item: FolderItem): string {
    if (item.type === 'session') {
      const entry = sessionByRef.get(item.ref);
      if (!entry) return '';
      return sessionTile(entry, {
        toolName: nameById.get(entry.toolId) ?? '',
        sizeBytes: sessionSizes[entry.slot] ?? 0,
        tool: toolById.get(entry.toolId ?? ''),
      });
    }
    const ref = imageByRef.get(item.ref);
    return ref ? imageTile(ref) : '';
  }

  function previewForItem(item: FolderItem): MemberPreview | null {
    if (item.type === 'session') {
      const entry = sessionByRef.get(item.ref);
      if (!entry) return null;
      return isBatchSlot(entry.slot) ? { batch: true } : { thumb: entry.thumb };
    }
    const ref = imageByRef.get(item.ref);
    return ref ? { url: ref.url } : null;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  function render(): void {
    const body = dialog.querySelector('.folder-overlay-body');
    if (!body) return;
    body.innerHTML = viewFolderId ? folderViewHtml() : rootViewHtml();
  }

  function rootViewHtml(): string {
    const { sessions, images } = rootItems();
    const folderTiles = folders.map(f => folderTile(f, {
      memberPreviews: f.items.map(previewForItem).filter(p => p != null),
    })).join('');
    const looseTiles = [
      ...sessions.map(e => sessionTile(e, { toolName: nameById.get(e.toolId) ?? '', sizeBytes: sessionSizes[e.slot] ?? 0, tool: toolById.get(e.toolId ?? '') })),
      ...images.map(imageTile),
    ].join('');
    const empty = !folders.length && !sessions.length && !images.length;

    return `
      <header class="folder-overlay-head">
        <h2 id="folder-overlay-title">${context === 'picker' ? 'Your images &amp; creations' : 'Saved sessions'}</h2>
        <div class="folder-overlay-head-actions">
          ${showCreateFolder ? `<button type="button" class="btn folder-newbtn" data-new-folder>+ New folder</button>` : ''}
          <button type="button" class="gtile-iconbtn meta-dialog-close" aria-label="Close">&#x2715;</button>
        </div>
      </header>
      ${folders.length ? `<div class="folder-grid folder-grid--folders">${folderTiles}</div>` : ''}
      ${looseTiles ? `<div class="folder-grid">${looseTiles}</div>` : ''}
      ${empty ? `<p class="folder-overlay-empty">Nothing saved yet.</p>`
        : (!looseTiles && folders.length ? `<p class="folder-overlay-empty">All items are organized into folders.</p>` : '')}
    `;
  }

  function folderViewHtml(): string {
    const folder = folders.find(f => f.id === viewFolderId);
    if (!folder) { viewFolderId = null; return rootViewHtml(); }
    const tiles = folder.items.map(tileForItem).filter(Boolean).join('');
    return `
      <header class="folder-overlay-head">
        <div class="folder-overlay-crumb">
          <button type="button" class="folder-back" data-back aria-label="Back to all folders">←</button>
          <span class="folder-crumb-icon" aria-hidden="true">${FOLDER_ICON}</span>
          <h2 id="folder-overlay-title">${escape(folder.name)}</h2>
        </div>
        <div class="folder-overlay-head-actions">
          ${onOpenGroup ? `<button type="button" class="btn folder-openbtn" data-open-group aria-label="Open this folder in the batch grid">Open in grid</button>` : ''}
          ${allowBatchExport ? `<button type="button" class="btn folder-exportbtn" data-export-folder aria-label="Export folder as batch">Export as batch</button>` : ''}
          <button type="button" class="btn" data-rename-folder>Rename</button>
          <button type="button" class="btn folder-deletebtn" data-delete-folder>Delete folder</button>
          <button type="button" class="gtile-iconbtn meta-dialog-close" aria-label="Close">&#x2715;</button>
        </div>
      </header>
      ${tiles ? `<div class="folder-grid">${tiles}</div>` : `<p class="folder-overlay-empty">This folder is empty — move items in from the “⋯” menu.</p>`}
    `;
  }

  // ── Delegated interactions ─────────────────────────────────────────────────

  dialog.addEventListener('click', async (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.closest('[data-back]')) { viewFolderId = null; render(); return; }
    if (t.closest('[data-new-folder]')) { await createFolder(); return; }

    const openFolder = t.closest<HTMLElement>('[data-open-folder]');
    if (openFolder) { viewFolderId = openFolder.dataset.openFolder ?? null; render(); return; }

    const openSession = t.closest<HTMLElement>('[data-open-session]');
    if (openSession) {
      const entry = sessionByRef.get(openSession.dataset.openSession ?? '');
      closeDialog(dialog);
      if (entry) onResume?.(entry);
      return;
    }

    const openImage = t.closest<HTMLElement>('[data-open-image]');
    if (openImage) {
      const ref = imageByRef.get(openImage.dataset.openImage ?? '');
      closeDialog(dialog);
      if (ref) onPickImage?.(ref);
      return;
    }

    const openGroup = t.closest('[data-open-group]');
    if (openGroup) {
      const folder = folders.find(f => f.id === viewFolderId);
      closeDialog(dialog);
      if (folder) onOpenGroup?.(folder);
      return;
    }

    if (t.closest('[data-export-folder]')) { await exportFolder(); return; }
    if (t.closest('[data-rename-folder]')) { await renameFolder(); return; }
    if (t.closest('[data-delete-folder]')) { await deleteFolder(); return; }

    const menuBtn = t.closest<HTMLElement>('[data-menu]');
    if (menuBtn) { openMenu(menuBtn); return; }
  });

  // ── Folder CRUD ────────────────────────────────────────────────────────────

  async function createFolder(): Promise<void> {
    const name = await askName('New folder', '');
    if (!name) return;
    const folder = await store.create(name);
    folders = await store.list();
    viewFolderId = folder.id;
    render();
  }

  async function renameFolder(id: string | null = viewFolderId): Promise<void> {
    const folder = folders.find(f => f.id === id);
    if (!folder) return;
    const name = await askName('Rename folder', folder.name);
    if (!name || name === folder.name) return;
    await store.rename(folder.id, name);
    folders = await store.list();
    render();
  }

  async function deleteFolder(id: string | null = viewFolderId): Promise<void> {
    const folder = folders.find(f => f.id === id);
    if (!folder) return;
    if (!confirm(`Delete the folder “${folder.name}”? Its items return to the main list (they are not deleted).`)) return;
    await store.remove(folder.id);
    folders = await store.list();
    if (viewFolderId === id) viewFolderId = null;
    render();
  }

  // ── Item menu (move / rename / delete) ─────────────────────────────────────

  type MenuEl = HTMLDivElement & { _outside?: (e: PointerEvent) => void };
  let menuEl: MenuEl | null = null;
  function closeMenu(): void {
    if (menuEl) {
      if (menuEl._outside) document.removeEventListener('pointerdown', menuEl._outside, true);
      menuEl.remove();
      menuEl = null;
    }
  }

  function openMenu(btn: HTMLElement): void {
    closeMenu();
    const ref = btn.dataset.menu;
    const kind = btn.dataset.menuKind;   // 'session' | 'image' | 'folder'
    if (!ref || (kind !== 'session' && kind !== 'image' && kind !== 'folder')) return;
    const isBatch = kind === 'session' && isBatchSlot(ref);

    let html = '';
    if (kind === 'folder') {
      html = `
        <button type="button" class="folder-menu-item" data-act="rename">Rename folder</button>
        <button type="button" class="folder-menu-item folder-menu-item--danger" data-act="delete">Delete folder</button>`;
    } else {
      const canRename = kind === 'session';   // images keep their upload name
      const targets = folders.filter(f => f.id !== viewFolderId);
      const moveNew = folders.length === 0 && showCreateFolder;
      const moveOpts = [
        viewFolderId ? `<button type="button" class="folder-menu-item" data-move-to="">Main list (root)</button>` : '',
        ...targets.map(f => `<button type="button" class="folder-menu-item" data-move-to="${escape(f.id)}">${escape(f.name)}</button>`),
        moveNew ? `<button type="button" class="folder-menu-item" data-move-new>＋ New folder…</button>` : '',
      ].filter(Boolean).join('');
      html = `
        ${canRename ? `<button type="button" class="folder-menu-item" data-act="rename">Rename${isBatch ? ' session' : ''}</button>` : ''}
        <button type="button" class="folder-menu-item folder-menu-item--danger" data-act="delete">Delete</button>
        ${moveOpts ? `<div class="folder-menu-sep">Move to</div>${moveOpts}` : ''}`;
    }

    const menu: MenuEl = document.createElement('div');
    menuEl = menu;
    menu.className = 'folder-menu';
    menu.innerHTML = html;
    dialog.appendChild(menu);
    const r = btn.getBoundingClientRect();
    const dr = dialog.getBoundingClientRect();
    menu.style.top = `${Math.round(r.bottom - dr.top + 4)}px`;
    menu.style.left = `${Math.round(Math.min(r.left - dr.left, dialog.clientWidth - 200))}px`;

    menu.addEventListener('click', async (e) => {
      const et = e.target;
      if (!(et instanceof Element)) return;
      const act = et.closest<HTMLElement>('[data-act]')?.dataset.act;
      const moveTo = et.closest<HTMLElement>('[data-move-to]');
      const moveNew = et.closest('[data-move-new]');
      closeMenu();
      if (act === 'rename') { await (kind === 'folder' ? renameFolder(ref) : renameItem(ref)); return; }
      if (act === 'delete') { await (kind === 'folder' ? deleteFolder(ref) : deleteItem(ref, kind)); return; }
      if (kind === 'folder') return;
      if (moveNew) {
        const name = await askName('New folder', '');
        if (!name) return;
        const folder = await store.create(name);
        await store.moveItem(ref, folder.id, kind);
        folders = await store.list();
        render();
        return;
      }
      if (moveTo) {
        const target = moveTo.dataset.moveTo || null;
        await store.moveItem(ref, target, kind);
        folders = await store.list();
        render();
      }
    });

    const outside = (e: PointerEvent) => {
      if (e.target instanceof Node && !menu.contains(e.target) && e.target !== btn) closeMenu();
    };
    menu._outside = outside;
    setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
  }

  // ── Item rename / delete ───────────────────────────────────────────────────

  async function renameItem(ref: string): Promise<void> {
    const entry = sessionByRef.get(ref);
    if (!entry) return;
    const current = entry.label || entry.filename || nameById.get(entry.toolId) || '';
    const name = await askName('Rename', current);
    if (!name || name === current) return;

    const data = await host.state.load(ref);
    if (!data) return;
    data.__label = name;

    if (isBatchSlot(ref)) {
      // A batch slot encodes its name, so renaming mints a new slot.
      const newSlot = batchSlot(name);
      if (newSlot !== ref) {
        if (sessionByRef.has(newSlot)) { alert('A batch session with that name already exists.'); return; }
        await host.state.save(newSlot, data, entry.thumb ?? null);
        await host.state.delete(ref);
        await store.swapSessionSlot(ref, newSlot);
        sessionByRef.delete(ref);
        sessionByRef.set(newSlot, { ...entry, slot: newSlot, label: name });
        folders = await store.list();
      } else {
        sessionByRef.set(ref, { ...entry, label: name });
      }
    } else {
      // A tool slot is stable; just update its label (thumb preserved).
      await host.state.save(ref, data, entry.thumb ?? null);
      sessionByRef.set(ref, { ...entry, label: name });
    }
    render();
  }

  async function deleteItem(ref: string, kind: 'session' | 'image'): Promise<void> {
    if (!confirm('Delete this item permanently?')) return;
    try {
      if (kind === 'image') {
        await host.assets._deleteUserAsset(ref);
        imageByRef.delete(ref);
      } else {
        await host.state.delete(ref);
        sessionByRef.delete(ref);
      }
      // Detach from whatever folder it sat in (root deletes are a no-op here).
      if (viewFolderId) await store.removeItem(viewFolderId, ref);
      else { const f = folders.find(x => x.items.some(i => i.ref === ref)); if (f) await store.removeItem(f.id, ref); }
      folders = await store.list();
      onDelete?.(ref);
      render();
    } catch (err) {
      host.log?.('error', 'Folder overlay delete failed', { ref, error: String(err) });
      alert('Could not delete that item.');
    }
  }

  // ── Folder export (gated, lazy pro import) ─────────────────────────────────

  async function exportFolder(): Promise<void> {
    const folder = folders.find(f => f.id === viewFolderId);
    if (!folder || !allowBatchExport) return;
    const toast = document.createElement('div');
    toast.className = 'pro-toast';
    toast.innerHTML = `<button type="button" class="pro-toast-close" aria-label="Close">&#x2715;</button><div class="pro-toast-mount"></div>`;
    document.body.appendChild(toast);
    const mount = toast.querySelector('.pro-toast-mount');
    if (!(mount instanceof HTMLElement)) return;
    toast.querySelector('.pro-toast-close')?.addEventListener('click', () => toast.remove());
    try {
      const { exportFolderAsBatch } = await import('./pro/folder-export.ts');
      const profile = await host.profile.get().catch(() => null);
      await exportFolderAsBatch(host, folder, {
        mount,
        author: profile?.useDetails ? profile : null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      mount.innerHTML = `<p class="pro-progress-msg pro-log-err">${escape(msg)}</p>`;
    }
  }

  // ── Inline name prompt (create / rename) ───────────────────────────────────

  function askName(title: string, initial: string): Promise<string | null> {
    return new Promise((resolve) => {
      closeMenu();
      const ask = document.createElement('div');
      ask.className = 'folder-ask';
      ask.innerHTML = `
        <form class="folder-ask-card">
          <label class="folder-ask-label">${escape(title)}</label>
          <input type="text" class="folder-ask-input" value="${escape(initial)}" maxlength="60" autocomplete="off" spellcheck="false" placeholder="Name">
          <div class="folder-ask-actions">
            <button type="button" class="btn folder-ask-cancel">Cancel</button>
            <button type="submit" class="btn folder-ask-save">Save</button>
          </div>
        </form>`;
      dialog.appendChild(ask);
      const input = ask.querySelector<HTMLInputElement>('.folder-ask-input');
      if (!input) { ask.remove(); resolve(null); return; }
      input.focus();
      input.select();
      const finish = (val: string | null) => { ask.remove(); resolve(val); };
      ask.querySelector('.folder-ask-cancel')?.addEventListener('click', () => finish(null));
      ask.querySelector('.folder-ask-card')?.addEventListener('submit', (e) => {
        e.preventDefault();
        finish(input.value.trim() || null);
      });
      ask.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); finish(null); } });
    });
  }

  // ── Boot ───────────────────────────────────────────────────────────────────

  (async () => {
    try { await store.prune(); } catch { /* prune is best-effort */ }
    folders = await store.list();
    render();
  })();
}

// ── Native <dialog> helpers (Esc + backdrop click come free) ──────────────────

function openDialog(dialog: HTMLDialogElement): void {
  document.body.appendChild(dialog);
  dialog.showModal();
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); closeDialog(dialog); });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) closeDialog(dialog); });
  dialog.addEventListener('click', (e) => {
    if (e.target instanceof Element && e.target.closest('.meta-dialog-close')) closeDialog(dialog);
  });
}
function closeDialog(dialog: HTMLDialogElement): void {
  dialog.close();
  dialog.remove();
}
