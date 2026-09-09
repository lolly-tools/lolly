// SPDX-License-Identifier: MPL-2.0
/**
 * Folder overlay - a shared, file-manager style modal for organizing saved work.
 *
 * One overlay serves three callers (gallery, /pro, picker). It shows folders
 * (groups) over loose root items, lets the user create/rename/delete folders and
 * move sessions/images between them, and render a whole folder to one nested zip
 * (Batch, available to everyone now).
 *
 * Isolation: this module imports only the host bridge, the folder store, and the
 * pro-free tile builders. The single touch into the removable /pro folder is a
 * gated dynamic import of ./pro/folder-export.js inside the export handler, so the
 * static graph stays /pro-free and the overlay loads from the (pro-free) gallery.
 */
import { escape } from './utils.ts';
import { tRaw } from './i18n.ts';
import { mountModal } from './components/modal.ts';
import { confirmDialog } from './components/confirm-dialog.ts';
import { mountBodyPopover } from './components/body-popover.ts';
import { startBatchExport } from './lib/batch-job.ts';
import type { BodyPopoverHandle } from './components/body-popover.ts';
import { announce } from './a11y.ts';
import { createFolderStore } from './folders.ts';
import type { Folder, FolderItem } from './folders.ts';
import {
  sessionTile, imageTile, folderTile, isBatchSlot, BATCH_SLOT_PREFIX, FOLDER_ICON,
} from './folder-tiles.ts';
import type { SessionEntry, TileToolInfo, ImageTileRef, MemberPreview } from './folder-tiles.ts';

/** A saved session as the overlay tracks it (same shape the tiles read). */
type OverlayEntry = SessionEntry;
/** A user image ref as the overlay tracks it. */
type OverlayImageRef = ImageTileRef;

/** A tool index entry (its id, plus the intended-output fields the tile reads). */
interface IndexedTool extends TileToolInfo { id: string; }

/** The slice of the host bridge the overlay touches (also satisfies FolderHost). */
interface OverlayHost {
  profile: {
    get(): Promise<{ folders?: Folder[]; useDetails?: boolean; custom?: Record<string, string> }>;
    set(profile: object): Promise<unknown>;
  };
  state: {
    load(slot: string): Promise<Record<string, unknown> | null>;
    save(slot: string, data: unknown, thumb?: string | null): Promise<unknown>;
    delete(slot: string): Promise<unknown>;
    list(): Promise<ReadonlyArray<{ slot: string }>>;
  };
  assets: {
    _deleteUserAsset(id: string): Promise<unknown>;
    _listUserAssets(): Promise<ReadonlyArray<{ id: string }>>;
  };
  log?(level: string, message: string, meta?: unknown): void;
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
 *   context: 'gallery'|'pro'|'picker',
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
  // The global index entry is a loose `{ id } & Record`; narrow each to the tile's
  // intended-output slice (IndexedTool) for the tool spec.
  const toolById = new Map<string | undefined, IndexedTool>((window.__toolIndex?.tools ?? []).map(t => [t.id, t as IndexedTool]));

  // In-memory working copies - mutated in place so re-renders are instant; the
  // backing stores (host.state / host.assets / profile) are the source of truth.
  const sessionByRef = new Map<string, OverlayEntry>(sessionEntries.map(e => [e.slot, { ...e }]));
  const imageByRef = new Map<string, OverlayImageRef>(imageRefs.map(r => [r.id, r]));
  let folders: Folder[] = [];
  let viewFolderId: string | null = null;   // null → root view

  // The item menu mounts INSIDE this dialog (see openMenu below) and registers
  // window/document listeners (Escape, outside-click, resize, route-change) that must
  // tear down with the dialog or they leak. onClose is their home: mountModal fires it
  // exactly once on EVERY dismissal path (Escape, backdrop, the ✕ button, programmatic
  // close()). A 'close' listener on the element would also fire - mountModal closes the
  // same native dialog - but at whatever point the UA dispatches that event (the spec
  // queues it as a task, after the node is already removed), so the explicit hook is
  // the dependable ordering. closeMenu is a hoisted function declaration.
  const modal = mountModal(
    `<div class="folder-overlay-body"><div class="folder-overlay-loading">Loading…</div></div>`,
    {
      className: 'tool-meta-dialog folder-overlay',
      onClose: () => closeMenu(),
    },
  );
  const dialog = modal.el;
  dialog.setAttribute('aria-labelledby', 'folder-overlay-title');

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
        tool: toolById.get(entry.toolId),
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
      memberPreviews: f.items.map(previewForItem).filter(Boolean) as MemberPreview[],
    })).join('');
    const looseTiles = [
      ...sessions.map(e => sessionTile(e, { toolName: nameById.get(e.toolId) ?? '', sizeBytes: sessionSizes[e.slot] ?? 0, tool: toolById.get(e.toolId) })),
      ...images.map(r => imageTile(r)),
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
      ${tiles ? `<div class="folder-grid">${tiles}</div>` : `<p class="folder-overlay-empty">This folder is empty - move items in from the “⋯” menu.</p>`}
    `;
  }

  // ── Delegated interactions ─────────────────────────────────────────────────

  dialog.addEventListener('click', async (e) => {
    const t = e.target as Element;
    // The ✕ close button is re-rendered by every render() pass, so it's dismissed by
    // delegation here (a per-button listener would be lost on the next re-render).
    if (t.closest('.meta-dialog-close')) { modal.close(); return; }
    if (t.closest('[data-back]')) { viewFolderId = null; render(); return; }
    if (t.closest('[data-new-folder]')) { await createFolder(); return; }

    const openFolder = t.closest<HTMLElement>('[data-open-folder]');
    if (openFolder) { viewFolderId = openFolder.dataset.openFolder!; render(); return; }

    const openSession = t.closest<HTMLElement>('[data-open-session]');
    if (openSession) {
      const entry = sessionByRef.get(openSession.dataset.openSession!);
      modal.close();
      if (entry) onResume?.(entry);
      return;
    }

    const openImage = t.closest<HTMLElement>('[data-open-image]');
    if (openImage) {
      const ref = imageByRef.get(openImage.dataset.openImage!);
      modal.close();
      if (ref) onPickImage?.(ref);
      return;
    }

    // A recent export reopens the tool with the exact state it was downloaded with - 
    // plain hash navigation (a fresh mount re-resolves asset refs). Modified clicks
    // keep browser semantics (new tab), so the overlay stays open for those.
    const openExport = t.closest<HTMLAnchorElement>('[data-open-export]');
    if (openExport) {
      const me = e as MouseEvent;
      if (me.metaKey || me.ctrlKey || me.shiftKey || me.altKey) return;
      e.preventDefault();
      modal.close();
      window.location.hash = openExport.getAttribute('href') ?? '';
      return;
    }

    const openGroup = t.closest('[data-open-group]');
    if (openGroup) {
      const folder = folders.find(f => f.id === viewFolderId);
      modal.close();
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

  async function createFolder() {
    const name = await askName('New folder', '');
    if (!name) return;
    const folder = await store.create(name);
    folders = await store.list();
    viewFolderId = folder.id;
    render();
  }

  async function renameFolder(id: string | null = viewFolderId) {
    const folder = folders.find(f => f.id === id);
    if (!folder) return;
    const name = await askName('Rename folder', folder.name);
    if (!name || name === folder.name) return;
    await store.rename(folder.id, name);
    folders = await store.list();
    render();
  }

  async function deleteFolder(id: string | null = viewFolderId) {
    const folder = folders.find(f => f.id === id);
    if (!folder) return;
    const ok = await confirmDialog({
      title: `Delete the folder “${folder.name}”?`,
      message: 'Its items return to the main list (they are not deleted).',
      confirmLabel: 'Delete folder',
    });
    if (!ok) return;
    await store.remove(folder.id);
    folders = await store.list();
    if (viewFolderId === id) viewFolderId = null;
    render();
    announce(`Folder “${folder.name}” deleted`);
  }

  // ── Item menu (move / rename / delete) ──────────────────────────────────────
  // A body-mounted popover (mountBodyPopover) rather than a hand-rolled one - but
  // mounted INSIDE `dialog` (the `container` option), not document.body: this overlay
  // is a native <dialog> shown via showModal(), so only ITS OWN subtree paints above
  // its ::backdrop (a body-appended popover would render invisibly behind it). The
  // position callback below replicates the anchor-relative math a plain body mount
  // wouldn't need (mountBodyPopover's own default assumes position:fixed off the
  // viewport; `.folder-menu` stays position:absolute, relative to `dialog` itself,
  // which the UA promotes to position:fixed while showing modally).

  let itemMenu: BodyPopoverHandle | null = null;
  function closeMenu(): void { itemMenu?.close(); itemMenu = null; }

  function openMenu(btn: HTMLElement): void {
    closeMenu();
    const ref = btn.dataset.menu!;
    const kind = btn.dataset.menuKind as 'session' | 'image' | 'folder';   // 'session' | 'image' | 'folder'
    const isBatch = kind === 'session' && isBatchSlot(ref);

    const popover = mountBodyPopover(btn, (el) => {
      let html = '';
      if (kind === 'folder') {
        html = `
          <button type="button" class="folder-menu-item" role="menuitem" data-act="rename">Rename folder</button>
          <button type="button" class="folder-menu-item folder-menu-item--danger" role="menuitem" data-act="delete">Delete folder</button>`;
      } else {
        const canRename = kind === 'session';   // images keep their upload name
        const targets = folders.filter(f => f.id !== viewFolderId);
        const moveNew = folders.length === 0 && showCreateFolder;
        const moveOpts = [
          viewFolderId ? `<button type="button" class="folder-menu-item" role="menuitem" data-move-to="">Main list (root)</button>` : '',
          ...targets.map(f => `<button type="button" class="folder-menu-item" role="menuitem" data-move-to="${escape(f.id)}">${escape(f.name)}</button>`),
          moveNew ? `<button type="button" class="folder-menu-item" role="menuitem" data-move-new>＋ New folder…</button>` : '',
        ].filter(Boolean).join('');
        html = `
          ${canRename ? `<button type="button" class="folder-menu-item" role="menuitem" data-act="rename">Rename${isBatch ? ' session' : ''}</button>` : ''}
          <button type="button" class="folder-menu-item folder-menu-item--danger" role="menuitem" data-act="delete">Delete</button>
          ${moveOpts ? `<div class="folder-menu-sep" role="separator">Move to</div>${moveOpts}` : ''}`;
      }
      el.innerHTML = html;

      el.addEventListener('click', async (e) => {
        const act = (e.target as Element).closest<HTMLElement>('[data-act]')?.dataset.act;
        const moveTo = (e.target as Element).closest<HTMLElement>('[data-move-to]');
        const moveNew = (e.target as Element).closest('[data-move-new]');
        closeMenu();
        if (act === 'rename') return kind === 'folder' ? renameFolder(ref) : renameItem(ref);
        if (act === 'delete') return kind === 'folder' ? deleteFolder(ref) : deleteItem(ref, kind);
        if (moveNew) {
          const name = await askName('New folder', '');
          if (!name) return;
          const folder = await store.create(name);
          await store.moveItem(ref, folder.id, kind as 'session' | 'image');
          folders = await store.list();
          render();
          return;
        }
        if (moveTo) {
          const target = moveTo.dataset.moveTo || null;
          await store.moveItem(ref, target, kind as 'session' | 'image');
          folders = await store.list();
          render();
        }
      });
    }, {
      className: 'folder-menu',
      container: dialog,
      position: (el, anchor) => {
        const r = anchor.getBoundingClientRect();
        const dr = dialog.getBoundingClientRect();
        el.style.top = `${Math.round(r.bottom - dr.top + 4)}px`;
        el.style.left = `${Math.round(Math.min(r.left - dr.left, dialog.clientWidth - 200))}px`;
      },
    });
    itemMenu = popover;
    popover.open();
  }

  // ── Item rename / delete ───────────────────────────────────────────────────

  async function renameItem(ref: string) {
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
      const newSlot = BATCH_SLOT_PREFIX + name;
      if (newSlot !== ref) {
        if (sessionByRef.has(newSlot)) { announce('A batch session with that name already exists.', { assertive: true }); return; }
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

  async function deleteItem(ref: string, kind: 'session' | 'image') {
    const isImage = kind === 'image';
    const ok = await confirmDialog({
      title: isImage ? 'Delete this saved image?' : 'Delete this saved session?',
      message: isImage
        ? 'This permanently deletes the saved image. This cannot be undone.'
        : 'This permanently deletes the saved session and its preview. This cannot be undone.',
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    try {
      if (isImage) {
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
      announce(isImage ? 'Image deleted' : 'Session deleted');
    } catch (err) {
      host.log?.('error', 'Folder overlay delete failed', { ref, error: String(err) });
      announce('Could not delete that item.', { assertive: true });
    }
  }

  // ── Folder export (gated, lazy pro import) ─────────────────────────────────

  async function exportFolder() {
    const folder = folders.find(f => f.id === viewFolderId);
    if (!folder || !allowBatchExport) return;
    // Ask before rendering, and optionally AES-256-lock any PDF members in the zip.
    const { askExportLock } = await import('./lib/export-lock.ts');
    const { ok, strongPassword, zipLock } = await askExportLock('this folder', true);
    if (!ok) return;
    // A WP-F background job (lib/batch-job.ts), never anything owned by this dialog:
    // mountModal uses showModal(), so a body-level progress surface sits below the top
    // layer and is invisible while the overlay is up. The run outlives the overlay by
    // design - the global job toast shows it the moment the dialog closes, and a failure
    // lands there too instead of in a toast nobody could see.
    startBatchExport(tRaw('Rendering {name}', { name: folder.name }), async (job) => {
      const { exportFolderAsBatch } = await import('./pro/folder-export.ts');
      const profile = await host.profile.get().catch(() => null);
      return exportFolderAsBatch(host as unknown as Parameters<typeof exportFolderAsBatch>[0], folder, {
        job,
        author: profile?.useDetails ? profile : null,
        strongPassword, zipLock,
      });
    });
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
      const input = ask.querySelector<HTMLInputElement>('.folder-ask-input')!;
      input.focus();
      input.select();
      const finish = (val: string | null) => { ask.remove(); resolve(val); };
      ask.querySelector('.folder-ask-cancel')!.addEventListener('click', () => finish(null));
      ask.querySelector('.folder-ask-card')!.addEventListener('submit', (e) => {
        e.preventDefault();
        finish(input.value.trim() || null);
      });
      // preventDefault suppresses the UA's dialog close-request, so Escape cancels
      // only this prompt - not the whole overlay (same pattern as body-popover's menu).
      ask.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(null); } });
    });
  }

  // ── Boot ───────────────────────────────────────────────────────────────────

  (async () => {
    try { await store.prune(); } catch { /* prune is best-effort */ }
    folders = await store.list();
    render();
  })();
}
