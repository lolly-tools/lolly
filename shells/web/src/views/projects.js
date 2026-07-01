// SPDX-License-Identifier: MPL-2.0
/**
 * Projects view (route /p and /p/<folderId>).
 *
 * A gallery-style page over the FOLDERS of saved sessions (the same data the folder
 * overlay manages, surfaced as a first-class destination). Two modes:
 *
 *   ROOT (/p)            — a grid of the TOP-LEVEL folder tiles: an always-present
 *                          "Uncategorised" folder (every saved session not filed into a
 *                          folder), the user's folders, then a "+ New folder" + "+ New
 *                          tool" tile. Open a folder → /p/<id>.
 *   FOLDER (/p/<id>)     — that folder's SUB-FOLDERS and saved sessions as tiles, a
 *                          breadcrumb of its ancestors, "+ New folder" (nests here) and
 *                          "+ New tool" tiles, a "Move to" rail of other folders as drop
 *                          targets, rename, and "Render folder" (export its whole subtree
 *                          as one nested batch zip).
 *
 * Folders nest: each folder has a `parentId` (see ../folders.js). Moving a session OR a
 * sub-folder is drag-and-drop (drop onto a folder tile / rail chip) with a per-tile
 * "Move to…" menu as the fallback; reparenting a folder is kept acyclic by the store.
 * Folders live on the profile via the pro-free folder store; rendering a folder gates a
 * dynamic import of ./pro so the Projects chunk stays light and /pro stays removable.
 */
import { escape } from '../utils.js';
import { createFolderStore, childFolders, folderPath, descendantFolderIds } from '../folders.js';
import {
  folderTile, sessionTile, FOLDER_ICON, PACKAGE_ICON, MENU_ICON,
  isBatchSlot, BATCH_SLOT_PREFIX,
} from '../folder-tiles.js';
import { viewToggle } from '../components/view-toggle.js';
import { attachProfileMenu } from '../components/profile-menu.js';
import { confirmDialog as baseConfirmDialog, closeConfirmDialogs } from '../components/confirm-dialog.js';
import { openFolderOverlay } from '../folder-overlay.js';
import { flagEnabled, PRO_FLAG } from '../feature-flags.js';

// Sentinel folderId for the synthetic "Uncategorised" folder (sessions in no folder).
const UNCAT = '__uncat__';
// Set by the "+ New tool" tile so the next saved session files into this folder; read
// + cleared by the tool view after its first save. sessionStorage so it survives the
// navigation to the tool and dies with the tab.
const FILE_INTO_KEY = 'lolly:fileInto';

// Set just before opening/resuming a tool from here so the tool's Save button returns
// to THIS projects page (the folder or root the user launched from) instead of the
// gallery. sessionStorage, one-shot — read + cleared by the tool view on mount.
const RETURN_KEY = 'lolly:returnTo';

const FOLDER_PLUS_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.7.9H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2Z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>';
const FILE_PLUS_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h5"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>';
const BACK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>';
const RENDER_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3 19 12 5 21Z"/></svg>';
// "history" (clock-rewind) — matches the gallery's saved-sessions button.
const HISTORY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>';
// "sliders-horizontal" — the gallery's filter/view-options button, reused here for
// view mode (preview/list) + sort.
const FILTER_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/></svg>';

export async function mountProjects(viewEl, host, folderId, opts = {}) {
  const store = createFolderStore(host);
  const nameById = new Map((window.__toolIndex?.tools ?? []).map(t => [t.id, t.name]));
  const toolName = (id) => nameById.get(id) || id || 'Saved session';
  // Full index entries (formats + intended width/height/unit) so session tiles can show
  // the same "what you'll get" spec the gallery cards do — see sessionTile's `tool` opt.
  const toolById = new Map((window.__toolIndex?.tools ?? []).map(t => [t.id, t]));

  // Live data, re-read on every reload() so a move/rename/delete reflects at once.
  let folders = [];
  let entries = [];          // host.state.list() rows
  let sizes = {};            // slot -> bytes
  let profile = null;
  let headshotUrl = '';
  let mounted = true;        // false after the view is swapped out (guards async renders)
  const toasts = new Set();  // live "Render folder" toasts, torn down on navigate-away
  let toolPickerEl = null;   // the "New from a tool" chooser dialog, if open
  let viewMode = 'preview';  // 'preview' (tile grid) | 'list'
  let sortBy = 'date';       // 'date' | 'name' | 'tool' (a client-side display preference)
  try {
    if (localStorage.getItem('lolly:projectsView') === 'list') viewMode = 'list';
    const s = localStorage.getItem('lolly:projectsSort');
    if (s === 'name' || s === 'tool' || s === 'date') sortBy = s;
  } catch { /* localStorage unavailable */ }

  async function reload() {
    [folders, entries, sizes, profile] = await Promise.all([
      store.list(),
      host.state.list().catch(() => []),
      host.state.sizes().catch(() => ({})),
      host.profile.get().catch(() => null),
    ]);
    headshotUrl = profile?.headshot?.id
      ? (await host.assets.get(profile.headshot.id).catch(() => null))?.url || ''
      : '';
    // Self-heal stale refs (a session deleted elsewhere) so counts/mosaics are honest.
    await store.prune().catch(() => {});
    folders = await store.list();
  }

  const entryBySlot = () => new Map(entries.map(e => [e.slot, e]));
  const claimedRefs = () => new Set(folders.flatMap(f => f.items.filter(i => i.type === 'session').map(i => i.ref)));
  const uncategorised = () => { const c = claimedRefs(); return entries.filter(e => !c.has(e.slot)); };

  // Resolve a session ref → a mosaic preview cell ({thumb}|{batch}) for folder tiles.
  function previewForRef(ref) {
    const e = entryBySlot().get(ref);
    if (!e) return null;
    return isBatchSlot(e.slot) ? { batch: true } : { thumb: e.thumb || null };
  }
  function sessionsInFolder(f) {
    const map = entryBySlot();
    return (f?.items ?? []).filter(i => i.type === 'session').map(i => map.get(i.ref)).filter(Boolean);
  }

  // Sort helpers honouring the view-options menu. 'date' is the default (recent first).
  function sortFolders(arr) {
    const a = [...arr];
    if (sortBy === 'name') a.sort((x, y) => x.name.localeCompare(y.name));
    else if (sortBy === 'date') a.sort((x, y) => +new Date(y.updatedAt || y.createdAt || 0) - +new Date(x.updatedAt || x.createdAt || 0));
    // 'tool' has no meaning for folders → keep stored order.
    return a;
  }
  // A folder's full path as a label ("Event A / Drafts") so move targets and the rail
  // disambiguate same-named folders at different depths.
  const folderPathLabel = (id) => folderPath(folders, id).map(f => f.name).join(' / ');
  // Tile sub-line count = a folder's own items PLUS its direct sub-folders.
  const tileItemCount = (f) => (f.items?.length ?? 0) + childFolders(folders, f.id).length;

  const sessionTitle = (e) => (e.label || e.filename || toolName(e.toolId) || '').toLowerCase();
  function sortSessions(arr) {
    const a = [...arr];
    if (sortBy === 'name') a.sort((x, y) => sessionTitle(x).localeCompare(sessionTitle(y)));
    else if (sortBy === 'tool') a.sort((x, y) => (toolName(x.toolId) || '').localeCompare(toolName(y.toolId) || '') || sessionTitle(x).localeCompare(sessionTitle(y)));
    else a.sort((x, y) => +new Date(y.updatedAt || 0) - +new Date(x.updatedAt || 0)); // date
    return a;
  }

  // ── render ───────────────────────────────────────────────────────────────
  function render() {
    if (!mounted) return; // an async callback fired after we navigated away — don't clobber the new view
    viewEl.innerHTML = folderId == null ? rootHtml() : folderHtml(folderId);
    wire();
  }

  function rootHtml() {
    const uncat = uncategorised();
    const createFolder = createTile('folder', FOLDER_PLUS_ICON, 'New folder', 'Group saved sessions');
    const createTool = createTile('tool', FILE_PLUS_ICON, 'New tool', 'Start a fresh creation');
    const uncatTile = pseudoFolderTile(UNCAT, 'Uncategorised', uncat.map(e => e.slot));
    // Only TOP-LEVEL folders at the root; nested folders show inside their parent.
    const folderTiles = sortFolders(childFolders(folders, null)).map(f => folderTile(f, {
      memberPreviews: f.items.map(i => i.type === 'session' ? previewForRef(i.ref) : null).filter(Boolean),
      count: tileItemCount(f),
    })).join('');
    // Content first (Uncategorised, then folders), create tiles LAST, so the grid reads
    // top-left like a file manager and the "new" affordances trail.
    return shell('Projects', 'projects', `
      <div class="folder-grid projects-grid${viewMode === 'list' ? ' projects-list' : ''}">
        ${uncatTile}${folderTiles}${createFolder}${createTool}
      </div>`);
  }

  function folderHtml(id) {
    const isUncat = id === UNCAT;
    const folder = isUncat ? null : folders.find(f => f.id === id);
    if (!isUncat && !folder) {
      return shell('Projects', 'projects', `<p class="projects-empty">That folder no longer exists. <a href="#/p">Back to Projects</a>.</p>`, { inFolder: true });
    }
    const subfolders = isUncat ? [] : sortFolders(childFolders(folders, id));
    const sessions = sortSessions(isUncat ? uncategorised() : sessionsInFolder(folder));
    const title = isUncat ? 'Uncategorised' : folder.name;
    const count = subfolders.length + sessions.length;

    // Breadcrumb + parent — the back arrow climbs ONE level (to the parent folder, or
    // the root), and the trail links every ancestor. The current folder is the <h2>.
    const ancestors = isUncat ? [] : folderPath(folders, id).slice(0, -1);
    const parentId = ancestors.length ? ancestors[ancestors.length - 1].id : null;
    const backHref = parentId ? `#/p/${escape(parentId)}` : '#/p';
    const crumbs = `
      <nav class="projects-crumbs" aria-label="Folder path">
        <a href="#/p">Projects</a>
        ${ancestors.map(a => `<span class="projects-crumb-sep" aria-hidden="true">/</span><a href="#/p/${escape(a.id)}">${escape(a.name)}</a>`).join('')}
      </nav>`;

    // "Move to" rail: every OTHER folder (+ Uncategorised when not already there) as drop
    // targets — moving a session OUT, or reparenting a dragged sub-folder.
    const railTargets = [
      ...(isUncat ? [] : [{ id: UNCAT, name: 'Top level' }]),
      ...folders.filter(f => f.id !== id).map(f => ({ id: f.id, name: folderPathLabel(f.id) })),
    ];
    const rail = railTargets.length ? `
      <div class="projects-rail" aria-label="Drag a session or folder onto a folder to move it">
        <span class="projects-rail-hint">Move to</span>
        ${railTargets.map(t => `<button type="button" class="projects-chip" data-drop-folder="${escape(t.id)}" data-open-folder-nav="${escape(t.id)}">${escape(t.name)}</button>`).join('')}
      </div>` : '';

    // Content first (sub-folders, then sessions); create tiles LAST. No "+ New folder"
    // inside the synthetic Uncategorised bucket (it isn't a real folder to nest under).
    const createFolder = isUncat ? '' : createTile('folder', FOLDER_PLUS_ICON, 'New folder', `Group inside ${title}`);
    const createTool = createTile('tool', FILE_PLUS_ICON, 'New tool', isUncat ? 'New saved session' : `Add to ${title}`);
    const tiles = [
      ...subfolders.map(f => folderTile(f, {
        memberPreviews: f.items.map(i => i.type === 'session' ? previewForRef(i.ref) : null).filter(Boolean),
        count: tileItemCount(f),
      })),
      ...sessions.map(e => sessionTile(e, { toolName: toolName(e.toolId), sizeBytes: sizes[e.slot] || 0, tool: toolById.get(e.toolId) })),
    ].join('');

    const header = `
      ${crumbs}
      <div class="projects-head">
        <a href="${backHref}" class="projects-back" aria-label="${parentId ? 'Up to parent folder' : 'Back to Projects'}">${BACK_ICON}</a>
        <h2 class="projects-title"${isUncat ? '' : ` data-rename-folder="${escape(id)}" title="Rename folder"`}>${escape(title)}</h2>
        <span class="projects-count">${count} item${count === 1 ? '' : 's'}</span>
        <span class="projects-head-spacer"></span>
        ${count ? `<button type="button" class="projects-render btn" data-render-folder="${escape(id)}">${RENDER_ICON}<span>Render folder</span></button>` : ''}
        ${isUncat ? '' : `<button type="button" class="tile-menu-btn projects-head-menu" data-menu="${escape(id)}" data-menu-kind="folder" aria-label="Folder actions (rename, render, delete)">${MENU_ICON}</button>`}
      </div>`;

    const gridClass = `folder-grid projects-grid${viewMode === 'list' ? ' projects-list' : ''}`;
    const body = count
      ? `<div class="${gridClass}">${tiles}${createFolder}${createTool}</div>`
      : `<div class="${gridClass}">${createFolder}${createTool}</div><p class="projects-empty">${isUncat ? 'No saved sessions are uncategorised yet.' : 'This folder is empty — add a tool or a sub-folder.'}</p>`;

    return shell(title, 'projects', `${rail}${header}${body}`, { inFolder: true });
  }

  // A folder-style tile for the synthetic Uncategorised group (no per-tile menu).
  function pseudoFolderTile(id, name, slots) {
    const map = entryBySlot();
    const cells = slots.slice(0, 4).map(s => {
      const e = map.get(s);
      if (e && isBatchSlot(e.slot)) return `<span class="folder-cell folder-cell--batch" aria-hidden="true">${PACKAGE_ICON}</span>`;
      return e?.thumb
        ? `<img class="folder-cell" src="${escape(e.thumb)}" alt="" loading="lazy" decoding="async">`
        : `<span class="folder-cell folder-cell--empty" aria-hidden="true"></span>`;
    }).join('');
    const mosaic = cells ? `<span class="folder-mosaic">${cells}</span>` : `<span class="tile-cover tile-cover--batch" aria-hidden="true">${FOLDER_ICON}</span>`;
    return `
      <div class="folder-tile folder-tile--folder folder-tile--uncat" data-ref="${escape(id)}" data-kind="folder">
        <button type="button" class="tile-primary" data-open-folder="${escape(id)}" aria-label="Open ${escape(name)}">
          ${mosaic}
          <span class="tile-meta">
            <span class="tile-title">${escape(name)}</span>
            <span class="tile-sub">${slots.length} item${slots.length === 1 ? '' : 's'}</span>
          </span>
        </button>
      </div>`;
  }

  function createTile(kind, icon, title, sub) {
    return `
      <div class="folder-tile folder-tile--create" data-create="${kind}">
        <button type="button" class="tile-primary" aria-label="${escape(title)}">
          <span class="tile-cover tile-cover--create" aria-hidden="true">${icon}</span>
          <span class="tile-meta">
            <span class="tile-title">${escape(title)}</span>
            <span class="tile-sub">${escape(sub)}</span>
          </span>
        </button>
      </div>`;
  }

  // Profile + saved-sessions (history) buttons, carried over from the gallery so the
  // chrome is consistent (no tool filters here — they're meaningless for projects).
  function topRight() {
    const saved = entries.length;
    return `
      <div class="gallery-topright projects-topright">
        <button type="button" class="filter-fab projects-viewopts" aria-label="View and sort options" aria-haspopup="true" title="View &amp; sort">${FILTER_ICON}</button>
        ${saved ? `<button type="button" class="history-fab" title="Saved sessions" aria-label="Saved sessions (${saved})">${HISTORY_ICON}<span class="history-fab-count" aria-hidden="true">${saved}</span></button>` : ''}
        <a href="#/profile" class="profile-link${headshotUrl ? ' has-avatar' : ''}" aria-label="Open your profile">${headshotUrl ? `<img class="profile-link-avatar" src="${escape(headshotUrl)}" alt="">` : ''}<span class="profile-link-name">${escape(profile?.firstname || 'Profile')}</span></a>
      </div>`;
  }

  function shell(heading, active, inner, { inFolder = false } = {}) {
    return `
      <div class="projects${inFolder ? ' projects--folder' : ''}">
        <div class="gallery-topbar">
          <div class="view-toggle-wrap">${viewToggle(active)}</div>
          ${topRight()}
        </div>
        <h1 class="visually-hidden">${escape(heading)}</h1>
        ${inner}
      </div>`;
  }

  // ── wiring ─────────────────────────────────────────────────────────────────
  let openPopover = null;
  function closeMenu() { openPopover?.remove(); openPopover = null; document.removeEventListener('pointerdown', onDocDown, true); }
  function onDocDown(e) { if (openPopover && !openPopover.contains(e.target)) closeMenu(); }

  // Destructive actions (delete a folder + its contents, delete a saved session) use
  // the shared styled confirm modal — close any open tile menu first so it doesn't
  // hang behind the dialog. See components/confirm-dialog.js.
  const confirmDialog = (opts) => { closeMenu(); return baseConfirmDialog(opts); };

  function wire() {
    const root = viewEl.querySelector('.projects');
    if (!root) return;

    root.addEventListener('click', async (e) => {
      const t = e.target;

      // Per-tile overflow menu (check before the open-folder primary it sits inside)
      const menuBtn = t.closest('[data-menu]');
      if (menuBtn) { e.preventDefault(); e.stopPropagation(); openMenu(menuBtn); return; }

      // Open a folder (folder tile primary). Hash navigation (folders are hash-routed).
      const open = t.closest('[data-open-folder]');
      if (open) { window.location.hash = '#/p/' + open.dataset.openFolder; return; }
      // Rail chip navigates (drops are handled separately)
      const navChip = t.closest('[data-open-folder-nav]');
      if (navChip) { window.location.hash = '#/p/' + navChip.dataset.openFolderNav; return; }

      // Create tiles
      const create = t.closest('[data-create]');
      if (create) { create.dataset.create === 'folder' ? startCreateFolder(create) : startCreateTool(); return; }

      // Rename folder (click the title in a folder view)
      const rn = t.closest('[data-rename-folder]');
      if (rn) { startRename(rn, rn.dataset.renameFolder); return; }

      // Render whole folder
      const rf = t.closest('[data-render-folder]');
      if (rf) { renderFolder(rf.dataset.renderFolder); return; }

      // Open a saved session (resume the tool / open batch)
      const os = t.closest('[data-open-session]');
      if (os) { resumeSession(os.dataset.openSession); return; }
    });

    // View-options (filter) button → preview/list + sort popover.
    root.querySelector('.projects-viewopts')?.addEventListener('click', (e) => { e.stopPropagation(); openViewOpts(e.currentTarget); });

    // History → the quick saved-sessions overlay (same as the gallery). It can
    // move/rename folders behind the page, so refresh Projects when it closes.
    // Reached from the history button AND, on mobile, the consolidated profile menu.
    async function openHistory() {
      const imageRefs = await host.assets._listUserAssets?.().catch(() => []) ?? [];
      openFolderOverlay(host, {
        context: 'projects',
        sessionEntries: [...entries].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
        imageRefs, sessionSizes: sizes, nameById,
        showCreateFolder: true,
        allowBatchExport: flagEnabled(profile, PRO_FLAG.id),
        onResume: (entry) => resumeSession(entry.slot),
        onDelete: () => {},
      });
      document.querySelector('dialog.folder-overlay')
        ?.addEventListener('close', async () => { if (!mounted) return; await reload(); render(); }, { once: true });
    }
    root.querySelector('.history-fab')?.addEventListener('click', openHistory);

    // Mobile: the avatar opens a single menu (theme + saved sessions + Settings);
    // on desktop it stays a plain link to the profile page.
    attachProfileMenu(root.querySelector('.profile-link'), host, {
      savedCount: entries.length,
      onHistory: openHistory,
    });

    wireDrag(root);
  }

  // ── drag-and-drop: drag a session OR a sub-folder onto a folder chip / folder tile ──
  function wireDrag(root) {
    // Session tiles AND real folder tiles are draggable (not the synthetic Uncategorised,
    // not the create tiles). A folder carries 'text/lolly-folder'; a session 'text/lolly-session'.
    root.querySelectorAll('.folder-tile[data-kind="session"], .folder-tile--folder:not(.folder-tile--uncat)').forEach(tile => {
      const isFolder = tile.classList.contains('folder-tile--folder');
      tile.setAttribute('draggable', 'true');
      tile.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData(isFolder ? 'text/lolly-folder' : 'text/lolly-session', tile.dataset.ref);
        e.dataTransfer.effectAllowed = 'move';
        tile.classList.add('is-dragging');
        root.classList.add(isFolder ? 'is-dragging-folder' : 'is-dragging-session');
      });
      tile.addEventListener('dragend', () => {
        tile.classList.remove('is-dragging');
        root.classList.remove('is-dragging-session', 'is-dragging-folder');
      });
    });
    // Drop targets: the move-rail chips AND folder tiles (the open-button is the hit area).
    const targets = [
      ...root.querySelectorAll('[data-drop-folder]'),
      ...[...root.querySelectorAll('.folder-tile--folder')].map(t => t.querySelector('[data-open-folder]')).filter(Boolean),
    ];
    targets.forEach(target => {
      const folderRef = target.dataset.dropFolder || target.dataset.openFolder;
      const hit = target.closest('[data-drop-folder]') || target.closest('.folder-tile');
      target.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; hit?.classList.add('is-drop'); });
      target.addEventListener('dragleave', () => hit?.classList.remove('is-drop'));
      target.addEventListener('drop', async (e) => {
        e.preventDefault(); hit?.classList.remove('is-drop');
        const slot = e.dataTransfer.getData('text/lolly-session');
        const draggedFolder = e.dataTransfer.getData('text/lolly-folder');
        const dest = folderRef === UNCAT ? null : folderRef;
        if (slot) {
          await store.moveItem(slot, dest, 'session');
        } else if (draggedFolder) {
          if (draggedFolder === folderRef) return;   // dropped on itself — no-op
          await store.moveFolder(draggedFolder, dest); // store guards self/descendant cycles
        } else { return; }
        await reload(); render();
      });
    });
  }

  // ── per-tile menu ────────────────────────────────────────────────────────
  function openMenu(btn) {
    closeMenu();
    const ref = btn.dataset.menu;
    const kind = btn.dataset.menuKind;
    const pop = document.createElement('div');
    pop.className = 'folder-menu projects-menu';
    if (kind === 'folder') {
      // Move targets exclude the folder itself and its descendants (a folder can't nest
      // inside its own subtree). "Top level" appears unless it's already top-level.
      const blocked = new Set([ref, ...descendantFolderIds(folders, ref)]);
      const atTop = (folders.find(f => f.id === ref)?.parentId ?? null) == null;
      const targets = [
        ...(atTop ? [] : [{ id: UNCAT, name: 'Top level' }]),
        ...folders.filter(f => !blocked.has(f.id)).map(f => ({ id: f.id, name: folderPathLabel(f.id) })),
      ];
      pop.innerHTML = `
        <button type="button" class="folder-menu-item" data-act="open-folder">Open</button>
        <button type="button" class="folder-menu-item" data-act="rename">Rename folder</button>
        ${targets.length ? `<p class="folder-menu-head">Move to</p>${targets.map(t => `<button type="button" class="folder-menu-item" data-act="move-folder" data-to="${escape(t.id)}">${escape(t.name)}</button>`).join('')}` : ''}
        <button type="button" class="folder-menu-item" data-act="render">Render folder</button>
        <button type="button" class="folder-menu-item folder-menu-item--danger" data-act="delete">Delete folder</button>`;
    } else {
      const here = folderId;
      const targets = [
        ...(here === UNCAT ? [] : [{ id: UNCAT, name: 'Top level' }]),
        ...folders.filter(f => f.id !== here).map(f => ({ id: f.id, name: folderPathLabel(f.id) })),
      ];
      pop.innerHTML = `
        <button type="button" class="folder-menu-item" data-act="open">Open</button>
        <button type="button" class="folder-menu-item" data-act="rename-session">Rename</button>
        ${targets.length ? `<p class="folder-menu-head">Move to</p>${targets.map(t => `<button type="button" class="folder-menu-item" data-act="move" data-to="${escape(t.id)}">${escape(t.name)}</button>`).join('')}` : ''}
        <button type="button" class="folder-menu-item folder-menu-item--danger" data-act="delete-session">Delete</button>`;
    }
    document.body.appendChild(pop);
    const r = btn.getBoundingClientRect();
    pop.style.top = `${Math.round(r.bottom + 6 + window.scrollY)}px`;
    pop.style.left = `${Math.round(Math.min(r.left, window.innerWidth - pop.offsetWidth - 12) + window.scrollX)}px`;
    openPopover = pop;
    document.addEventListener('pointerdown', onDocDown, true);

    pop.addEventListener('click', async (e) => {
      const item = e.target.closest('[data-act]'); if (!item) return;
      const act = item.dataset.act;
      closeMenu();
      // Rename can fire from a folder TILE (root view) or the folder-view header menu
      // button (no enclosing tile) — fall back to the header <h2> in that case.
      if (act === 'rename') startRename(btn.closest('.folder-tile') || viewEl.querySelector('.projects-title[data-rename-folder]'), ref);
      else if (act === 'render') renderFolder(ref);
      else if (act === 'delete') deleteFolderCascade(ref);
      else if (act === 'open-folder') { window.location.hash = '#/p/' + ref; }
      else if (act === 'move-folder') { await store.moveFolder(ref, item.dataset.to === UNCAT ? null : item.dataset.to); await reload(); render(); }
      else if (act === 'open') resumeSession(ref);
      else if (act === 'rename-session') startRenameSession(btn.closest('.folder-tile'), ref);
      else if (act === 'move') { await store.moveItem(ref, item.dataset.to === UNCAT ? null : item.dataset.to, 'session'); await reload(); render(); }
      else if (act === 'delete-session') {
        const ok = await confirmDialog({
          title: 'Delete this saved session?',
          message: 'This permanently deletes the saved session and its preview. This cannot be undone.',
          confirmLabel: 'Delete',
        });
        if (ok && mounted) { await host.state.delete(ref).catch(() => {}); await reload(); render(); }
      }
    });
  }

  // The gallery-style filter button → a popover to switch view mode (Preview/List) and
  // sort (Alphabetical / By date / By tool). Preference persists in localStorage.
  function openViewOpts(btn) {
    closeMenu();
    const atRoot = folderId == null;
    const opt = (on, attr, val, label) =>
      `<button type="button" class="folder-menu-item${on ? ' is-on' : ''}" data-${attr}="${val}">${on ? '✓ ' : '  '}${label}</button>`;
    const pop = document.createElement('div');
    pop.className = 'folder-menu projects-viewmenu';
    pop.innerHTML = `
      <p class="folder-menu-head">View</p>
      ${opt(viewMode === 'preview', 'vm', 'preview', 'Preview')}
      ${opt(viewMode === 'list', 'vm', 'list', 'List')}
      <p class="folder-menu-head">Sort</p>
      ${opt(sortBy === 'name', 'sort', 'name', 'Alphabetical')}
      ${opt(sortBy === 'date', 'sort', 'date', 'By date')}
      ${atRoot ? '' : opt(sortBy === 'tool', 'sort', 'tool', 'By tool')}`;
    document.body.appendChild(pop);
    const r = btn.getBoundingClientRect();
    pop.style.top = `${Math.round(r.bottom + 6 + window.scrollY)}px`;
    pop.style.left = `${Math.round(Math.min(r.left, window.innerWidth - pop.offsetWidth - 12) + window.scrollX)}px`;
    openPopover = pop;
    document.addEventListener('pointerdown', onDocDown, true);
    pop.addEventListener('click', (e) => {
      const vm = e.target.closest('[data-vm]'); const so = e.target.closest('[data-sort]');
      if (vm) { viewMode = vm.dataset.vm; try { localStorage.setItem('lolly:projectsView', viewMode); } catch { /* ignore */ } closeMenu(); render(); }
      else if (so) { sortBy = so.dataset.sort; try { localStorage.setItem('lolly:projectsSort', sortBy); } catch { /* ignore */ } closeMenu(); render(); }
    });
  }

  // ── create / rename ────────────────────────────────────────────────────────
  // Wire an inline name <input> to commit-on-Enter/blur, cancel-on-Escape (once).
  function wireNameInput(input, onCommit) {
    input.focus(); input.select?.();
    let done = false;
    const commit = async () => { if (done) return; done = true; await onCommit(input.value.trim()); };
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') commit(); else if (e.key === 'Escape') { done = true; render(); }
    });
    input.addEventListener('blur', commit);
  }

  function startCreateFolder(tile) {
    // Replace the whole tile (NOT just .tile-meta): the input must not live inside the
    // <button class="tile-primary"> or Space/Enter would also activate the button.
    tile.classList.add('is-editing');
    tile.removeAttribute('data-create');
    tile.innerHTML = `
      <span class="tile-cover tile-cover--create" aria-hidden="true">${FOLDER_PLUS_ICON}</span>
      <div class="tile-meta"><input class="projects-name-input" type="text" placeholder="Folder name" aria-label="New folder name" maxlength="60"></div>`;
    // Inside a real folder, the new folder nests here (parentId); at root / Uncategorised
    // it's a top-level folder.
    const parent = (folderId && folderId !== UNCAT) ? folderId : null;
    wireNameInput(tile.querySelector('input'), async (name) => {
      if (name) { try { await store.create(name, parent); } catch { /* empty name */ } }
      await reload(); render();
    });
  }

  function startRename(tile, id) {
    if (!id || id === UNCAT) return;
    const f = folders.find(x => x.id === id); if (!f) return;
    const onCommit = async (name) => {
      if (name && name !== f.name) { try { await store.rename(id, name); } catch { /* empty */ } }
      await reload(); render();
    };
    if (tile?.matches?.('[data-rename-folder]')) {
      // Folder-view header: the title is an <h2> (not inside a button) — swap it directly.
      const input = document.createElement('input');
      input.className = 'projects-name-input'; input.value = f.name; input.maxLength = 60;
      input.setAttribute('aria-label', 'Folder name');
      tile.replaceWith(input);
      wireNameInput(input, onCommit);
    } else if (tile) {
      // Root folder tile: replace the whole tile so the input isn't nested in the button.
      tile.classList.add('is-editing');
      tile.innerHTML = `
        <span class="tile-cover tile-cover--batch" aria-hidden="true">${FOLDER_ICON}</span>
        <div class="tile-meta"><input class="projects-name-input" type="text" maxlength="60" aria-label="Folder name"></div>`;
      const input = tile.querySelector('input');
      input.value = f.name;
      wireNameInput(input, onCommit);
    }
  }

  // Rename a saved session in place. For a single-tool session the name IS the export
  // filename (host.state.list().filename = data.__export_filename), so the rename rewrites
  // both __export_filename and __label — the displayed name AND every future export (a
  // single download, or a folder "Render" batch row via folder-rows.js) use the new name.
  function startRenameSession(tile, slot) {
    const e = entryBySlot().get(slot); if (!tile || !e) return;
    const current = e.label || e.filename || toolName(e.toolId) || '';
    // Replace the WHOLE tile (the title lives inside the <button>; an input nested there
    // would let Space/Enter activate the button — see startCreateFolder).
    const cover = tile.querySelector('.tile-cover, .folder-mosaic')?.outerHTML || '';
    tile.classList.add('is-editing');
    tile.innerHTML = `${cover}<div class="tile-meta"><input class="projects-name-input" type="text" maxlength="80" aria-label="Session name"></div>`;
    const input = tile.querySelector('input');
    input.value = current;
    wireNameInput(input, async (name) => {
      if (name && name !== current) await applySessionRename(e, name);
      await reload(); render();
    });
  }

  async function applySessionRename(entry, name) {
    try {
      const data = await host.state.load(entry.slot);
      if (!data) return;
      data.__label = name;
      if (isBatchSlot(entry.slot)) {
        // A batch slot encodes its label → re-key under a new slot + follow membership.
        const newSlot = BATCH_SLOT_PREFIX + name;
        if (newSlot !== entry.slot) {
          await host.state.save(newSlot, data, entry.thumb);
          await host.state.delete(entry.slot).catch(() => {});
          await store.swapSessionSlot(entry.slot, newSlot);
        } else {
          await host.state.save(entry.slot, data, entry.thumb);
        }
      } else {
        data.__export_filename = name;   // the export filename for single-tool sessions
        await host.state.save(entry.slot, data, entry.thumb);
      }
    } catch (e) { if (host.log) host.log('warn', 'projects: rename failed', { error: String(e) }); }
  }

  // "+ New tool": open an in-place tool chooser (a file-style selector) rather than
  // jumping to the gallery. Picking a tool opens it; inside a real folder we leave the
  // file-into marker so the tool view files the first saved session here (claimed on a
  // fresh open — see tool.js). Stays in the Projects flow.
  function startCreateTool() { openToolPicker(); }

  function openToolPicker() {
    const tools = window.__toolIndex?.tools ?? [];
    const dlg = document.createElement('dialog');
    dlg.className = 'projects-toolpicker';
    dlg.innerHTML = `
      <div class="toolpicker-head">
        <h2 class="toolpicker-title">New from a tool</h2>
        <input class="toolpicker-search" type="search" placeholder="Search tools…" aria-label="Search tools" autocomplete="off" spellcheck="false">
        <button type="button" class="toolpicker-close" aria-label="Close">✕</button>
      </div>
      <div class="toolpicker-grid">
        ${tools.map(t => `
          <button type="button" class="toolpicker-tile" data-tool="${escape(t.id)}">
            <span class="toolpicker-icon" aria-hidden="true">${t.icon || ''}</span>
            <span class="toolpicker-name">${escape(t.name)}</span>
            ${t.description ? `<span class="toolpicker-desc">${escape(t.description)}</span>` : ''}
          </button>`).join('')}
      </div>`;
    document.body.appendChild(dlg);
    toolPickerEl = dlg;
    dlg.addEventListener('close', () => { dlg.remove(); if (toolPickerEl === dlg) toolPickerEl = null; });
    dlg.showModal();
    const search = dlg.querySelector('.toolpicker-search');
    setTimeout(() => search.focus(), 0);
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      dlg.querySelectorAll('.toolpicker-tile').forEach(tile => { tile.hidden = q && !tile.textContent.toLowerCase().includes(q); });
    });
    dlg.querySelector('.toolpicker-close').addEventListener('click', () => dlg.close());
    dlg.querySelector('.toolpicker-grid').addEventListener('click', (e) => {
      const tile = e.target.closest('[data-tool]'); if (!tile) return;
      const target = (folderId && folderId !== UNCAT) ? folderId : '';
      try { sessionStorage.setItem(FILE_INTO_KEY, target); } catch { /* private mode */ }
      armReturn();
      dlg.close();
      window.location.hash = '#/tool/' + tile.dataset.tool;
    });
  }

  // Arm the return target so the tool's Save button lands back on this exact page —
  // root `/#/p`, the Uncategorised view, or a specific folder. navigateTo-compatible URL.
  function armReturn() {
    try { sessionStorage.setItem(RETURN_KEY, '/#/p' + (folderId ? '/' + folderId : '')); } catch { /* private mode */ }
  }

  function resumeSession(slot) {
    closeMenu();
    if (isBatchSlot(slot)) {
      window.location.hash = `#/pro?session=${encodeURIComponent(slot)}`;
      return;
    }
    armReturn();
    window.location.hash = `#/tool/${entryBySlot().get(slot)?.toolId || ''}?slot=${encodeURIComponent(slot)}`;
  }

  // ── delete a folder AND everything inside it (its WHOLE subtree) ────────────
  // Unlike store.remove() (which only drops one record and lifts its contents up), this
  // permanently deletes the folder, every SUB-FOLDER beneath it, and every saved session
  // and image they hold — including stored previews — then the folder records. Confirmed.
  async function deleteFolderCascade(id) {
    closeMenu();
    if (!id || id === UNCAT) return;
    const folder = folders.find(f => f.id === id);
    if (!folder) return;
    // The whole subtree: this folder + all descendants, and every item they contain.
    const subtreeIds = [id, ...descendantFolderIds(folders, id)];
    const subtree = folders.filter(f => subtreeIds.includes(f.id));
    const items = subtree.flatMap(f => f.items ?? []);
    const subCount = subtreeIds.length - 1;            // sub-folders beneath this one
    const n = items.length;                            // sessions + images across the subtree
    const parts = [];
    if (subCount) parts.push(`${subCount} sub-folder${subCount === 1 ? '' : 's'}`);
    if (n) parts.push(`${n} item${n === 1 ? '' : 's'} (saved sessions and images, including previews)`);
    const ok = await confirmDialog({
      title: `Delete “${folder.name}”?`,
      message: parts.length
        ? `This permanently deletes the folder, ${parts.join(' and ')}. This cannot be undone.`
        : 'This permanently deletes the folder. This cannot be undone.',
      confirmLabel: 'Delete folder',
    });
    if (!ok || !mounted) return;
    for (const it of items) {
      try {
        if (it.type === 'image') await host.assets._deleteUserAsset(it.ref);
        else await host.state.delete(it.ref);
      } catch (err) { host.log?.('warn', 'projects: folder item delete failed', { ref: it.ref, error: String(err) }); }
    }
    await store.removeSubtree(id);
    if (!mounted) return;
    // If we were viewing the deleted folder (or one now-deleted beneath it), climb to its
    // parent (or root); otherwise just re-render in place.
    if (subtreeIds.includes(folderId)) {
      const parentId = folder.parentId ?? null;
      window.location.hash = parentId ? `#/p/${parentId}` : '#/p';
      return;
    }
    await reload(); render();
  }

  // ── render a whole folder as one nested batch zip (gated /pro import) ────────
  async function renderFolder(id) {
    closeMenu();
    const isUncat = id === UNCAT;
    const folder = isUncat
      ? { name: 'Uncategorised', items: uncategorised().map(e => ({ type: 'session', ref: e.slot })) }
      : folders.find(f => f.id === id);
    if (!folder) return;
    // A folder is renderable if its WHOLE subtree (it + descendants) holds any items.
    const subtreeItems = isUncat
      ? folder.items
      : [id, ...descendantFolderIds(folders, id)].flatMap(cid => folders.find(f => f.id === cid)?.items ?? []);
    if (!subtreeItems.length) return;
    const toast = document.createElement('div');
    toast.className = 'pro-toast projects-toast'; // top-right under the profile row (see app.css)
    toast.innerHTML = `<button type="button" class="pro-toast-close" aria-label="Close">✕</button><div class="pro-toast-mount"></div>`;
    document.body.appendChild(toast);
    toasts.add(toast); // tracked so navigating away tears it down (see _cleanup)
    const mount = toast.querySelector('.pro-toast-mount');
    const dropToast = () => { toast.remove(); toasts.delete(toast); };
    toast.querySelector('.pro-toast-close').addEventListener('click', dropToast);
    try {
      const { exportFolderAsBatch } = await import('../pro/folder-export.js');
      await exportFolderAsBatch(host, folder, {
        mount,
        author: profile?.useDetails ? profile : null,
        folders,   // recurse sub-folders into nested zip paths (Uncategorised has none)
        onBatchRendered: opts.onBatchRendered,
      });
    } catch (err) {
      mount.innerHTML = `<p class="pro-progress-msg pro-log-err">${escape(String(err?.message ?? err))}</p>`;
    }
  }

  // ── boot ─────────────────────────────────────────────────────────────────
  // Arriving at Projects means we're not mid-"+ New tool" creation, so disarm any
  // stale file-into / return-to markers left by an abandoned flow.
  try { sessionStorage.removeItem(FILE_INTO_KEY); sessionStorage.removeItem(RETURN_KEY); } catch { /* ignore */ }
  viewEl._cleanup = () => { mounted = false; closeMenu(); closeConfirmDialogs(); toasts.forEach(t => t.remove()); toasts.clear(); toolPickerEl?.remove(); toolPickerEl = null; };
  await reload();
  // A stale /p/<id> deep link to a deleted folder falls back to root.
  if (folderId && folderId !== UNCAT && !folders.some(f => f.id === folderId)) folderId = null;
  render();
}
