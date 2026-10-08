// SPDX-License-Identifier: MPL-2.0
/** Shared Projects use the same tile selection, action bar and context menu as personal Projects. */
import { icon } from '../lib/icons.ts';
import { actionButton } from '../components/action-button.ts';
import { iconNode } from '../lib/icon-node.ts';
import { menuItemHtml, wireTileContextMenu } from '../lib/context-menu.ts';
import { wireTileSelect } from '../lib/tile-select.ts';
import { mountModal } from '../components/modal.ts';
import { confirmDialog, promptDialog } from '../components/confirm-dialog.ts';
import { tRaw } from '../i18n.ts';
import { anchorSave } from '../bridge/anchor-save.ts';
import {
  canMoveTeamItem, deleteTeamFolder, moveTeamFolder, moveTeamFolderItem, renameTeamFile, renameTeamFolder, teamFileRenameAvailable,
  teamItemFolder, type TeamFolder, type TeamItemRef,
} from './team-folders.ts';
import { deleteTeamFile, downloadTeamFile, knownUploaderId, TeamFileError, teamFileMessage, type TeamFile } from './team-files.ts';
import {
  clearTeamClipboard, readTeamDrag, relocateTeamItems, setTeamClipboard, teamClipboard, topLevelTeamItems, TEAM_ITEMS_MIME, writeTeamDrag,
  type TeamClipItem,
} from './team-project-moves.ts';
import { listProjectPeople } from './project-members.ts';
import { getHostRef } from '../lib/host-ref.ts';

interface Options {
  grid: HTMLElement; content: HTMLElement; projectId: string; projectName: string; folderId: string | null;
  folders: TeamFolder[]; files: TeamFile[]; canWrite: boolean; canManage: boolean; canDeleteSession: boolean;
  /** Move, cut, copy, paste, drag and duplicate. Off while the folder list is
   *  unavailable, since each of them places items in folders. Defaults to canWrite. */
  canOrganize?: boolean;
  /** Offer "Download as .lolly file" on sessions. */
  canDownload?: boolean;
  /** The view's breadcrumbs: a link with data-team-folder takes dropped items. */
  crumbs?: HTMLElement;
  current(): boolean; reload(message?: string): void; notice(message: string): void;
  /** Copy an item under a new identity, into `folderId` when given, else beside the original. */
  duplicate(id: string, kind: string, opts?: { name?: string; folderId?: string | null }): Promise<void>;
  sessionAction(action: string, id: string, tile: HTMLElement | null): Promise<boolean | undefined>;
}
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') => {
  const el = document.createElement(tag); el.className = cls; el.textContent = text; return el;
};
const control = (name: string, symbol: Parameters<typeof actionButton>[1]) => actionButton(tRaw(name), symbol);
const renameMissing = () => tRaw('This workspace cannot rename shared files yet.');
const ITEM_KINDS: Record<string, TeamItemRef['kind']> = { 'team-folder': 'folder', 'team-session': 'session', 'team-file': 'file' };

export function mountTeamProjectActions(o: Options): () => void {
  const abort = new AbortController(), selected = new Set<string>(), signal = abort.signal;
  const organize = o.canOrganize ?? o.canWrite;
  let busy = false, uploader = knownUploaderId();
  const tiles = () => Array.from(o.grid.querySelectorAll<HTMLElement>('.folder-tile[data-ref]'));
  const tileFor = (id: string) => tiles().find(t => t.dataset.ref === id);
  const kind = (id: string) => tileFor(id)?.dataset.kind;
  const name = (id: string) => tileFor(id)?.querySelector('.tile-title')?.textContent || id;
  const canDelete = (id: string) => kind(id) === 'team-folder' ? o.canWrite : kind(id) === 'team-session' ? o.canDeleteSession
    : o.canManage || !!uploader && o.files.some(f => f.id === id && f.createdBy === uploader);
  const itemOf = (id: string): TeamClipItem[] => { const k = ITEM_KINDS[kind(id) ?? '']; return k ? [{ kind: k, ref: id, name: name(id) }] : []; };
  /** The folder that holds an item, so a copy goes in the same folder, even for a search result from another folder. */
  const home = (id: string): string | null => { const item = itemOf(id)[0]; return item ? teamItemFolder(o.folders, item) : o.folderId; };
  const canPasteInto = (target: string | null) => organize && !!teamClipboard(o.projectId)?.items.every(item => canMoveTeamItem(o.folders, item, target));
  const renameRow = (id: string) => !o.canWrite ? ''
    : menuItemHtml('rename', icon('pen'), tRaw('Rename'), kind(id) === 'team-file' && !teamFileRenameAvailable() ? { reason: renameMissing() } : {});
  const clipRows = () => organize ? menuItemHtml('cut', icon('scissors'), tRaw('Cut')) + menuItemHtml('copy-item', icon('duplicate'), tRaw('Copy')) : '';
  const bar = node('div', 'projects-bulkbar'); bar.hidden = true; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', tRaw('Selection actions'));
  const count = node('span', 'projects-bulkbar-count'); count.setAttribute('aria-live', 'polite');
  const actions = node('div', 'projects-bulkbar-actions'), move = control('Move to folder', 'move'), remove = control('Delete', 'trash');
  move.dataset.bulk = 'move'; remove.dataset.bulk = 'delete'; remove.classList.add('projects-bulk-danger');
  const clear = control('Clear selection', 'close'); clear.className = 'projects-bulkbar-clear'; clear.setAttribute('aria-label', tRaw('Clear selection'));
  actions.append(move, remove); bar.append(count, actions, clear); o.content.append(bar);
  const paint = () => {
    for (const tile of tiles()) {
      const on = selected.has(tile.dataset.ref!); tile.classList.toggle('is-selected', on);
      tile.querySelector('[data-select]')?.setAttribute('aria-pressed', String(on));
    }
    bar.hidden = selected.size === 0; o.content.classList.toggle('has-selection', !!selected.size);
    count.textContent = tRaw('{n} selected', { n: selected.size });
    move.hidden = !organize; remove.hidden = ![...selected].every(canDelete);
    const cut = teamClipboard(o.projectId);
    for (const tile of tiles()) tile.classList.toggle('is-cut', cut?.mode === 'cut' && cut.items.some(item => item.ref === tile.dataset.ref));
    move.disabled = remove.disabled = clear.disabled = busy;
  };
  const setRefs = (refs: Set<string>) => { if (busy) return; selected.clear(); for (const id of refs) if (tileFor(id)) selected.add(id); paint(); };
  const selection = wireTileSelect({ host: o.grid, tiles, refOf: tile => tile.dataset.ref!, current: () => new Set(selected), setRefs,
    clear: () => setRefs(new Set()), noStart: '.folder-tile, button, input, select, a, [role="menu"]',
    keyboard: { remove: refs => { if (refs.every(canDelete)) void run('delete', refs); },
      rename: ref => { if (o.canWrite) void run('rename', [ref]); },
      menu: (ref, tile) => { const r = tile.getBoundingClientRect(); menu.openAt(r.right, r.bottom, { ref, tile }); },
      ...(organize ? { cut: (refs: string[]) => clip('cut', refs), copy: (refs: string[]) => clip('copy', refs), paste: () => { void paste(o.folderId); } } : {}) },
  });
  for (const tile of tiles()) {
    const id = tile.dataset.ref!, dot = control('Select {name}', 'check');
    dot.className = 'tile-check'; dot.dataset.select = id; dot.setAttribute('aria-pressed', 'false'); dot.setAttribute('aria-label', tRaw('Select {name}', { name: name(id) }));
    dot.title = dot.getAttribute('aria-label')!;
    const tick = iconNode('check'); if (tick) dot.replaceChildren(tick);
    dot.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); selection.onDotClick(id, event.shiftKey, () => { const next = new Set(selected); if (next.has(id)) next.delete(id); else next.add(id); setRefs(next); }); }, { signal: abort.signal });
    tile.prepend(dot);
    const more = tile.querySelector<HTMLButtonElement>('.tile-menu-btn') ?? control('Item actions', 'menu');
    more.replaceChildren(); const moreGlyph = iconNode('menu'); if (moreGlyph) more.append(moreGlyph);
    more.className = 'tile-menu-btn'; more.setAttribute('aria-label', tRaw('Item actions for {name}', { name: name(id) })); more.setAttribute('aria-haspopup', 'menu');
    more.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); const r = more.getBoundingClientRect();
      if (selected.size > 1 && selected.has(id)) menu.openBulkAt(r.right, r.bottom); else menu.openAt(r.right, r.bottom, { ref: id, tile }, more);
    }, { signal: abort.signal }); tile.append(more);
  }
  const rows = (id: string) => menuItemHtml('open', icon('folder'), tRaw('Open'))
    + (kind(id) === 'team-session' && o.canManage ? menuItemHtml('invite', icon('users'), tRaw('Share')) : '')
    + menuItemHtml('copy', icon('link'), tRaw('Copy link'))
    + (kind(id) === 'team-file' ? menuItemHtml('download', icon('download'), tRaw('Download')) : '')
    + (kind(id) === 'team-session' ? menuItemHtml('copy-local', icon('duplicate'), tRaw('Copy to my projects')) : '')
    + (kind(id) === 'team-session' && o.canDownload ? menuItemHtml('download-lolly', icon('download'), tRaw('Download as .lolly file')) : '')
    + (organize ? menuItemHtml('duplicate', icon('duplicate'), tRaw('Duplicate')) : '')
    + (organize ? menuItemHtml('move', icon('move'), tRaw('Move to folder')) : '')
    + clipRows()
    + (kind(id) === 'team-folder' && canPasteInto(id) ? menuItemHtml('paste-into', icon('checklist'), tRaw('Paste here')) : '')
    + renameRow(id)
    + (canDelete(id) ? menuItemHtml('delete', icon('trash'), tRaw('Delete'), { danger: true }) : '');
  const menu = wireTileContextMenu({ host: o.grid, tileSelector: '.folder-tile[data-ref]', refOf: tile => tile.dataset.ref || null,
    singleHtml: target => rows(target.ref), isBulkTarget: id => selected.size > 1 && selected.has(id),
    bulkHtml: () => (organize ? menuItemHtml('move', icon('move'), tRaw('Move to folder')) : '') + clipRows()
      + ([...selected].every(id => kind(id) === 'team-session') ? menuItemHtml('copy-local', icon('duplicate'), tRaw('Copy to my projects')) : '')
      + ([...selected].every(canDelete) ? menuItemHtml('delete', icon('trash'), tRaw('Delete'), { danger: true }) : ''),
    backgroundHtml: () => (canPasteInto(o.folderId) ? menuItemHtml('paste', icon('checklist'), tRaw('Paste')) : '') + menuItemHtml('select-all', icon('check'), tRaw('Select all')),
    onAction: (action, target) => {
      if (action === 'select-all') setRefs(new Set(tiles().map(t => t.dataset.ref!)));
      else if (action === 'paste' || action === 'paste-into') void paste(action === 'paste-into' && target ? target.ref : o.folderId);
      else void run(action, target ? [target.ref] : [...selected]);
    },
    className: 'folder-menu projects-menu', presentation: 'sheet', head: target => ({ name: target ? name(target.ref) : tRaw('{n} selected', { n: selected.size }) }),
  });
  if (organize) wireDrags();
  move.addEventListener('click', () => { void run('move', [...selected]); }, { signal: abort.signal });
  remove.addEventListener('click', () => { void run('delete', [...selected]); }, { signal: abort.signal });
  clear.addEventListener('click', () => setRefs(new Set()), { signal: abort.signal });
  paint(); selection.syncRoving();
  if (!o.canManage && !uploader) void listProjectPeople(o.projectId).then(got => {
    if (o.current() && got.ok) { uploader = got.data.members.find(m => m.isMe)?.userId ?? null; paint(); }
  }).catch(() => {});

  /** Copy shared sessions into one of the person's own folders (lolly plan 299). */
  async function copyToMine(ids: string[]): Promise<void> {
    const host = getHostRef();
    if (!ids.length || !host) return;
    const app = host as Parameters<typeof import('./team-local-copy.ts').copyTeamSessionsToLocal>[0];
    const { chooseLocalFolder } = await import('./local-folder-chooser.ts');
    const folderId = await chooseLocalFolder(app, { title: tRaw('Copy to my projects'), confirmLabel: tRaw('Copy') });
    if (folderId === undefined || !o.current()) return;
    busy = true;
    try {
      const { copyTeamSessionsToLocal } = await import('./team-local-copy.ts');
      const result = await copyTeamSessionsToLocal(app, ids, folderId);
      if (!o.current()) return;
      o.notice(result.failed
        ? tRaw('Copied {n} sessions to your projects. {failed} could not be copied.', { n: result.copied, failed: result.failed })
        : tRaw('Copied {n} sessions to your projects.', { n: result.copied }));
    } finally { busy = false; }
  }

  async function run(action: string, refs: string[]): Promise<void> {
    if (busy || !o.current() || !refs.length) return;
    if (action === 'open') { tileFor(refs[0]!)?.querySelector<HTMLElement>('.tile-primary')?.click(); return; }
    if (action === 'copy' && kind(refs[0]!) !== 'team-session') {
      const href = tileFor(refs[0]!)?.querySelector<HTMLAnchorElement>('a.tile-primary')?.href;
      try { if (href) { await navigator.clipboard.writeText(href); if (o.current()) o.notice(tRaw('Link copied')); } } catch { o.notice(tRaw('Could not copy. Try again.')); }
      return;
    }
    if (action === 'copy-local') { await copyToMine(refs.filter(id => kind(id) === 'team-session')); return; }
    if (action === 'cut' || action === 'copy-item') { if (organize) clip(action === 'cut' ? 'cut' : 'copy', refs); return; }
    if ((action === 'move' || action === 'duplicate') && !organize || action === 'delete' && !refs.every(canDelete)) return;
    if (action === 'move') { await chooseDestination(refs); return; }
    if (action === 'delete' && !(await confirmDialog({ title: tRaw('Delete selected items?'), message: tRaw('Delete {n} selected item(s) for everyone? Folder contents and subfolders move to the parent folder.', { n: refs.length }), confirmLabel: tRaw('Delete') }))) return;
    if (!o.current()) return;
    busy = true; paint(); let changed = false;
    try {
      for (const id of refs) {
        if (!o.current()) break;
        if (action === 'duplicate') { await o.duplicate(id, kind(id) || '', { folderId: home(id) }); changed = true; continue; }
        if (kind(id) === 'team-session') { if (await o.sessionAction(action === 'delete' ? 'delete-confirmed' : action, id, tileFor(id) ?? null)) changed = true; continue; }
        if (kind(id) === 'team-folder') {
          if (action === 'delete') { await deleteTeamFolder(o.projectId, id); changed = true; }
          else if (action === 'rename' && o.canWrite) {
            const value = await promptDialog({ title: tRaw('Rename shared folder'), message: tRaw('Folder name'), value: name(id), confirmLabel: tRaw('Save') });
            if (value?.trim() && o.current()) { await renameTeamFolder(o.projectId, id, value.trim()); changed = true; }
          }
        } else {
          const file = o.files.find(f => f.id === id); if (!file) continue;
          if (action === 'download') anchorSave(await downloadTeamFile(o.projectId, file), file.name);
          if (action === 'rename' && o.canWrite && await renameFile(file)) changed = true;
          if (action === 'delete') {
            try { await deleteTeamFile(o.projectId, id); changed = true; }
            catch (error) {
              if (!(error instanceof TeamFileError) || error.code !== 'FILE_IN_USE' || !o.canManage) throw error;
              const confirmed = await confirmDialog({ title: tRaw('File is used by sessions'), message: tRaw('{sessions} still use “{name}”. Deleting it makes their asset unavailable.', { sessions: error.sessions.map(s => s.title).join(', '), name: file.name }), confirmLabel: tRaw('Delete anyway') });
              if (confirmed && o.current()) { await deleteTeamFile(o.projectId, id, { force: true }); changed = true; }
            }
          }
        }
      }
    } catch (error) { if (o.current()) o.notice(error instanceof TeamFileError ? teamFileMessage(error, 'delete') : error instanceof Error ? error.message : tRaw('Could not change these items. Refresh and try again.')); }
    finally { busy = false; if (o.current()) { paint(); if (changed || action === 'duplicate') o.reload(); } }
  }

  /** Rename a shared file. False when nothing changed, with the reason in the notice. */
  async function renameFile(file: TeamFile): Promise<boolean> {
    if (!teamFileRenameAvailable()) { o.notice(renameMissing()); return false; }
    const value = await promptDialog({ title: tRaw('Rename file'), message: tRaw('File name'), value: file.name, confirmLabel: tRaw('Save') });
    const fresh = value?.trim().slice(0, 200);
    if (!fresh || fresh === file.name || !o.current()) return false;
    const got = await renameTeamFile(o.projectId, file.id, fresh);
    if (!got.ok && o.current()) o.notice(got.unsupported ? renameMissing() : tRaw('Could not rename this file. Refresh and try again.'));
    return got.ok;
  }

  /** Put the items on the shared clipboard; Paste in another folder of this project moves or copies them. */
  function clip(mode: 'cut' | 'copy', refs: string[]): void {
    if (busy || !organize) return;
    setTeamClipboard(o.projectId, mode, topLevelTeamItems(o.folders, refs.flatMap(itemOf)));
    const n = teamClipboard(o.projectId)?.items.length ?? 0;
    setRefs(new Set());
    o.notice(mode === 'cut' ? (n === 1 ? tRaw('1 item cut') : tRaw('{n} items cut', { n })) : (n === 1 ? tRaw('1 item copied') : tRaw('{n} items copied', { n })));
  }

  /** Paste into `target`: a cut moves the items (same ids), a copy duplicates them. */
  async function paste(target: string | null): Promise<void> {
    const held = teamClipboard(o.projectId);
    if (!held || busy || !organize || !o.current()) return;
    if (!held.items.every(item => canMoveTeamItem(o.folders, item, target))) { o.notice(tRaw('A folder cannot be pasted into itself')); return; }
    busy = true; paint();
    try {
      let n = 0;
      if (held.mode === 'cut') {
        n = await relocateTeamItems(o.projectId, o.folders, held.items, target, o.current);
        if (teamClipboard(o.projectId) === held) clearTeamClipboard();
      } else {
        for (const item of held.items) {
          if (!o.current()) break;
          await o.duplicate(item.ref, `team-${item.kind}`, { name: item.name, folderId: target }); n++;
        }
      }
      if (o.current()) o.reload(n === 1 ? tRaw('1 item pasted') : tRaw('{n} items pasted', { n }));
    } catch (error) { if (o.current()) o.reload(error instanceof Error ? error.message : tRaw('Could not change these items. Refresh and try again.')); }
    finally { busy = false; if (o.current()) paint(); }
  }

  /** Drag tiles onto a shared folder, a breadcrumb or the open folder to move them. */
  function wireDrags(): void {
    for (const tile of tiles()) {
      tile.draggable = true;
      tile.addEventListener('dragstart', event => {
        const id = tile.dataset.ref!;
        writeTeamDrag(event, o.projectId, (selected.has(id) ? [...selected] : [id]).flatMap(itemOf));
        tile.classList.add('is-dragging');
      }, { signal });
      tile.addEventListener('dragend', () => tile.classList.remove('is-dragging'), { signal });
    }
    const accept = (el: HTMLElement, target: () => string | null, highlight = true): void => {
      el.addEventListener('dragover', event => {
        if (!event.dataTransfer?.types.includes(TEAM_ITEMS_MIME)) return;
        event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'move';
        if (highlight) el.classList.add('is-drop');
      }, { signal });
      el.addEventListener('dragleave', () => el.classList.remove('is-drop'), { signal });
      el.addEventListener('drop', event => {
        el.classList.remove('is-drop');
        if (!event.dataTransfer?.types.includes(TEAM_ITEMS_MIME)) return;
        event.preventDefault(); event.stopPropagation();
        const items = readTeamDrag(event, o.projectId);
        if (items) void moveItems(items, target());
      }, { signal });
    };
    for (const tile of tiles()) if (kind(tile.dataset.ref!) === 'team-folder') accept(tile, () => tile.dataset.ref!);
    for (const crumb of o.crumbs?.querySelectorAll<HTMLElement>('[data-team-folder]') ?? []) accept(crumb, () => crumb.dataset.teamFolder || null);
    accept(o.grid, () => o.folderId, false);
  }

  /** A dropped set moves where it can: a folder never into itself, and items already there stay. */
  async function moveItems(items: TeamItemRef[], target: string | null): Promise<void> {
    if (busy || !organize || !o.current()) return;
    const movable = items.filter(item => canMoveTeamItem(o.folders, item, target) && teamItemFolder(o.folders, item) !== target);
    if (!movable.length) return;
    busy = true; paint();
    try { await relocateTeamItems(o.projectId, o.folders, movable, target, o.current); if (o.current()) o.reload(tRaw('Moved')); }
    catch (error) { if (o.current()) o.reload(error instanceof Error ? error.message : tRaw('Could not move these items. Refresh and try again.')); }
    finally { busy = false; if (o.current()) paint(); }
  }

  async function chooseDestination(refs: string[]): Promise<void> {
    const excluded = new Set(refs.filter(id => kind(id) === 'team-folder'));
    let grew = true; while (grew) { grew = false; for (const f of o.folders) if (f.parentId && excluded.has(f.parentId) && !excluded.has(f.id)) { excluded.add(f.id); grew = true; } }
    const modal = mountModal('', { className: 'modal team-move-dialog', ariaLabel: tRaw('Move to folder') });
    const title = node('h2', 'modal-title', tRaw('Move to folder')), label = node('label', 'document-agent-field', tRaw('Destination'));
    const select = node('select', 'field-select'); select.setAttribute('aria-label', tRaw('Destination'));
    const root = node('option', '', o.projectName); root.value = ''; select.append(root);
    for (const f of o.folders) if (!excluded.has(f.id)) {
      const path = [f.name], seen = new Set([f.id]); let parent = o.folders.find(p => p.id === f.parentId);
      while (parent && !seen.has(parent.id)) { seen.add(parent.id); path.unshift(parent.name); parent = o.folders.find(p => p.id === parent!.parentId); }
      const option = node('option', '', path.join(' / ')); option.value = f.id; select.append(option);
    }
    select.value = o.folderId || ''; label.append(select);
    const controls = node('div', 'modal-actions'), cancel = control('Cancel', 'close'), save = control('Move', 'move'), status = node('p', 'team-project-notice'); status.setAttribute('role', 'status');
    save.classList.add('btn--primary');
    cancel.addEventListener('click', () => modal.close()); controls.append(cancel, save); modal.el.append(title, label, status, controls); select.focus();
    save.addEventListener('click', async () => {
      if (busy || !o.current()) return; busy = true; save.disabled = true; cancel.disabled = true; paint();
      try {
        for (const id of refs) {
          if (!o.current()) break;
          if (kind(id) === 'team-folder') await moveTeamFolder(o.projectId, id, select.value || null);
          else await moveTeamFolderItem(o.projectId, select.value || null, kind(id) === 'team-session' ? 'session' : 'file', id);
        }
        if (o.current()) { modal.close(); o.reload(); }
      } catch (error) { if (o.current()) status.textContent = error instanceof Error ? error.message : tRaw('Could not move these items. Refresh and try again.'); }
      finally { busy = false; save.disabled = cancel.disabled = false; if (o.current()) paint(); }
    });
  }
  return () => { abort.abort(); menu.destroy(); selection.destroy(); bar.remove(); o.content.classList.remove('has-selection'); };
}
