// SPDX-License-Identifier: MPL-2.0
import { menuItemHtml, wireTileContextMenu } from '../lib/context-menu.ts';
import { wireTileSelect } from '../lib/tile-select.ts';
import { icon } from '../lib/icons.ts';
import { escape as escapeHtml } from '../utils.ts';
import { getInstanceBase } from '../lib/instance.ts';
import { tRaw } from '../i18n.ts';
import { confirmDialog, promptDialog } from '../components/confirm-dialog.ts';
import { mountModal } from '../components/modal.ts';
import {
  canMoveProjectItem, createProjectFolder, deleteProjectFolder, moveProjectItem,
  projectFolderPath, renameProjectFolder, teamFolderHref, type ProjectFolder, type ProjectItemKind,
} from './project-folders.ts';

export interface ManagedProjectItem { kind: ProjectItemKind; ref: string; name: string }
interface FolderManagerOptions {
  grid: HTMLElement; toolbar: HTMLElement; breadcrumbs: HTMLElement; notice: HTMLElement;
  projectId: string; projectName: string; folders: ProjectFolder[]; folderId: string | null;
  items: ManagedProjectItem[]; canWrite: boolean; canCopy?: boolean; current(): boolean;
  reload(message?: string): void;
  itemMenu(item: ManagedProjectItem): string;
  itemAction(action: string, item: ManagedProjectItem, tile: HTMLElement | null): Promise<void>;
  duplicate(item: ManagedProjectItem): Promise<string>;
  deleteItems?(items: ManagedProjectItem[]): Promise<void>;
  importLocal?(event: DragEvent, folderId: string | null): Promise<boolean>;
}
const MIME = 'application/x-lolly-team-items';
let clipboard: { instance: string; project: string; mode: 'cut' | 'copy'; items: ManagedProjectItem[] } | undefined;
const instance = () => getInstanceBase() || location.origin;
const sameClipboard = (project: string) => clipboard?.instance === instance() && clipboard.project === project;

export function chooseProjectFolder(projectName: string, folders: readonly ProjectFolder[], items: readonly ManagedProjectItem[], initial: string | null): Promise<string | null | undefined> {
  return new Promise(resolve => {
    const choices = [{ id: '', name: projectName }, ...folders.map(folder => ({ id: folder.id, name: projectFolderPath(folders, folder.id).map(part => part.name).join(' / ') }))]
      .filter(folder => items.every(item => canMoveProjectItem(folders, item, folder.id || null)));
    const modal = mountModal<string | null>(`<h2 class="modal-title">${tRaw('Move to…')}</h2>
      <label class="field-label">${tRaw('Folder')}<select class="field-select" data-destination>${choices.map(folder => `<option value="${escapeHtml(folder.id)}"${folder.id === (initial || '') ? ' selected' : ''}>${escapeHtml(folder.name)}</option>`).join('')}</select></label>
      <div class="modal-actions"><button type="button" class="btn" data-cancel>${tRaw('Cancel')}</button><button type="button" class="btn btn--primary" data-confirm>${tRaw('Move')}</button></div>`, {
      className: 'modal', ariaLabel: tRaw('Move to folder'), onClose: value => resolve(value),
      initialFocus: el => el.querySelector<HTMLElement>('[data-destination]'),
    });
    modal.el.addEventListener('click', event => {
      if ((event.target as Element).closest('[data-cancel]')) modal.close();
      if ((event.target as Element).closest('[data-confirm]')) modal.close(modal.el.querySelector<HTMLSelectElement>('[data-destination]')!.value || null);
    });
  });
}

/** Selection, menus and drag moves share one acknowledged-write path. */
export function mountTeamFolderManager(o: FolderManagerOptions): () => void {
  const abort = new AbortController(), selected = new Set<string>();
  let busy = false;
  const known = new Map(o.items.map(item => [item.ref, item]));
  const tileOf = (ref: string) => [...o.grid.querySelectorAll<HTMLElement>('.folder-tile')].find(tile => tile.dataset.ref === ref) ?? null;
  const button = (label: string, action: () => void) => {
    const el = document.createElement('button'); el.type = 'button'; el.className = 'btn btn--sm'; el.textContent = label;
    el.addEventListener('click', action, { signal: abort.signal }); return el;
  };
  const selection = document.createElement('span'); selection.setAttribute('role', 'status');
  const all = button(tRaw('Select all'), () => { for (const item of o.items) selected.add(item.ref); sync(); });
  const clear = button(tRaw('Clear selection'), () => { selected.clear(); sync(); });
  const move = button(tRaw('Move to…'), () => { void pick([...selected].map(ref => known.get(ref)!)); });
  const cut = button(tRaw('Cut'), () => copy('cut'));
  const copyButton = button(tRaw('Copy'), () => copy('copy'));
  const duplicate = button(tRaw('Duplicate'), () => { copy('copy'); void paste(); });
  const pasteButton = button(tRaw('Paste'), () => { void paste(); });
  o.toolbar.append(all, clear, selection);
  if (o.canWrite) { o.toolbar.append(move, cut); if (o.canCopy !== false) o.toolbar.append(copyButton, duplicate); o.toolbar.append(pasteButton, button(tRaw('New folder'), () => { void newFolder(); })); }
  const remove = button(tRaw('Delete'), () => { void removeItems([...selected].map(ref => known.get(ref)!)); });
  if (o.deleteItems) o.toolbar.append(remove);
  function sync(): void {
    selection.textContent = selected.size ? tRaw('{n} selected', { n: selected.size }) : '';
    clear.hidden = selected.size === 0;
    for (const el of [move, cut, copyButton, duplicate, remove]) el.disabled = !selected.size || busy;
    pasteButton.disabled = !sameClipboard(o.projectId) || busy;
    for (const item of o.items) {
      const tile = tileOf(item.ref); tile?.classList.toggle('is-selected', selected.has(item.ref));
      tile?.querySelector('.tile-check')?.setAttribute('aria-pressed', String(selected.has(item.ref)));
    }
  }
  const canonical = (items: ManagedProjectItem[]) => items.filter(item => item.kind === 'folder'
    ? !projectFolderPath(o.folders, o.folders.find(folder => folder.id === item.ref)?.parentId ?? null).some(parent => items.some(other => other.kind === 'folder' && other.ref === parent.id))
    : !o.folders.some(folder => folder.items.some(member => member.kind === item.kind && member.ref === item.ref)
      && projectFolderPath(o.folders, folder.id).some(parent => items.some(other => other.kind === 'folder' && other.ref === parent.id))));
  async function run(task: () => Promise<void>): Promise<void> {
    if (busy || !o.canWrite || !o.current()) return;
    busy = true; sync(); o.notice.textContent = tRaw('Saving…');
    try { await task(); }
    catch (error) { if (o.current()) o.reload(error instanceof Error ? error.message : tRaw('Could not save. Refresh and try again.')); }
    finally { busy = false; if (o.current()) sync(); }
  }
  async function relocate(items: ManagedProjectItem[], target: string | null): Promise<void> {
    const wanted = canonical(items);
    if (!wanted.length || !wanted.every(item => canMoveProjectItem(o.folders, item, target))) return;
    const movingClipboard = sameClipboard(o.projectId) && clipboard?.mode === 'cut' && wanted.every(item => clipboard!.items.some(member => member.ref === item.ref && member.kind === item.kind)) ? clipboard : undefined;
    await run(async () => {
      for (const item of wanted) {
        if (!o.current()) return;
        const got = await moveProjectItem(o.projectId, item, target);
        if (!got.ok) throw Error(tRaw('Some items could not be moved. Refresh to check the folder contents.'));
      }
      if (movingClipboard && clipboard === movingClipboard) clipboard = undefined;
      if (o.current()) o.reload(tRaw('Items moved'));
    });
  }
  async function pick(items: ManagedProjectItem[]): Promise<void> {
    const target = await chooseProjectFolder(o.projectName, o.folders, items, o.folderId);
    if (target !== undefined && o.current()) await relocate(items, target);
  }
  function copy(mode: 'cut' | 'copy', items = [...selected].map(ref => known.get(ref)!)): void {
    if (busy || !items.length || mode === 'copy' && o.canCopy === false) return;
    clipboard = { instance: instance(), project: o.projectId, mode, items: canonical(items) }; sync();
    o.notice.textContent = mode === 'cut' ? tRaw('Cut. Open a destination folder and choose Paste.') : tRaw('Copied. Open a destination folder and choose Paste.');
  }
  async function paste(): Promise<void> {
    if (!sameClipboard(o.projectId) || !clipboard) return;
    const clip = clipboard;
    if (clip.mode === 'cut') { await relocate(clip.items, o.folderId); return; }
    if (o.canCopy === false) return;
    if (!clip.items.every(item => canMoveProjectItem(o.folders, item, o.folderId))) { o.notice.textContent = tRaw('A folder cannot be copied into itself or a subfolder.'); return; }
    await run(async () => {
      for (const item of clip.items) {
        if (!o.current()) return;
        const id = await o.duplicate(item);
        const got = await moveProjectItem(o.projectId, { kind: item.kind, ref: id }, o.folderId);
        if (!got.ok) throw Error(tRaw('A copy was created at the project root but could not be moved. Refresh to find the copy.'));
      }
      if (o.current()) o.reload(tRaw('Copies created'));
    });
  }
  async function newFolder(): Promise<void> {
    const name = await promptDialog({ title: tRaw('New folder'), message: tRaw('Folder name'), confirmLabel: tRaw('Create') });
    if (!name?.trim() || !o.current()) return;
    await run(async () => {
      const got = await createProjectFolder(o.projectId, name.trim().slice(0, 200), o.folderId);
      if (!got.ok) throw Error(tRaw('Could not create this folder. Refresh and try again.'));
      if (o.current()) o.reload();
    });
  }
  async function removeItems(items: ManagedProjectItem[]): Promise<void> {
    if (!items.length || !o.deleteItems) return;
    await run(async () => { await o.deleteItems!(items); if (o.current()) o.reload(); });
  }
  async function folderAction(action: string, item: ManagedProjectItem): Promise<void> {
    if (action === 'open') { window.location.hash = teamFolderHref(o.projectId, item.ref); return; }
    if (action === 'rename') {
      const name = await promptDialog({ title: tRaw('Rename folder'), message: tRaw('Folder name'), value: item.name, confirmLabel: tRaw('Save') });
      if (!name?.trim() || !o.current()) return;
      await run(async () => { const got = await renameProjectFolder(o.projectId, item.ref, name.trim().slice(0, 200)); if (!got.ok) throw Error(tRaw('Could not rename this folder.')); if (o.current()) o.reload(); });
    }
    if (action === 'delete') {
      const accepted = await confirmDialog({ title: tRaw('Delete folder?'), message: tRaw('Remove {name} for everyone. Its contents and subfolders move to the parent folder.', { name: item.name }), confirmLabel: tRaw('Delete') });
      if (accepted && o.current()) await run(async () => { const got = await deleteProjectFolder(o.projectId, item.ref); if (!got.ok) throw Error(tRaw('Could not delete this folder.')); if (o.current()) o.reload(); });
    }
  }
  const menu = wireTileContextMenu({ host: o.grid, tileSelector: '.folder-tile[data-ref]', refOf: tile => tile.dataset.ref ?? null,
    singleHtml: target => {
      const item = known.get(target.ref); if (!item) return '';
      return (item.kind === 'folder' ? menuItemHtml('open', icon('folder'), tRaw('Open')) + (o.canWrite ? menuItemHtml('rename', icon('pen'), tRaw('Rename')) : '') : o.itemMenu(item))
        + (o.canWrite ? menuItemHtml('move', icon('folder'), tRaw('Move to…')) + menuItemHtml('cut', icon('scissors'), tRaw('Cut')) + (o.canCopy !== false ? menuItemHtml('copy-item', icon('clipboard'), tRaw('Copy')) + menuItemHtml('duplicate', icon('clipboard'), tRaw('Duplicate')) : '')
          + (item.kind === 'folder' ? menuItemHtml('delete', icon('trash'), tRaw('Delete folder'), { danger: true }) : '') : '');
    },
    onAction: (action, target) => {
      const item = target && known.get(target.ref); if (!item || !o.current()) return;
      if (action === 'duplicate') { copy('copy', [item]); void paste(); return; }
      if (action === 'move') { void pick(selected.has(item.ref) ? [...selected].map(ref => known.get(ref)!) : [item]); return; }
      if (action === 'cut' || action === 'copy-item') { copy(action === 'cut' ? 'cut' : 'copy', selected.has(item.ref) ? [...selected].map(ref => known.get(ref)!) : [item]); return; }
      if (item.kind === 'folder') void folderAction(action, item);
      else void o.itemAction(action, item, target?.tile ?? null).catch(error => { if (o.current()) o.reload(error instanceof Error ? error.message : tRaw('Could not save.')); });
    }, className: 'folder-menu projects-menu', presentation: 'sheet', head: target => ({ name: known.get(target?.ref || '')?.name || '' }),
  });
  for (const item of o.items) {
    const tile = tileOf(item.ref); if (!tile) continue;
    if (item.kind === 'folder') { tile.dataset.kind = 'team-folder'; tile.querySelector('.tile-primary')?.removeAttribute('data-open-folder'); }
    const check = document.createElement('button'); check.type = 'button'; check.className = 'tile-check'; check.append(new window.DOMParser().parseFromString(icon('check'), 'image/svg+xml').documentElement); check.setAttribute('aria-label', tRaw('Select {name}', { name: item.name }));
    check.addEventListener('click', event => { event.stopPropagation(); tileSelect.onDotClick(item.ref, event.shiftKey, () => { selected.has(item.ref) ? selected.delete(item.ref) : selected.add(item.ref); sync(); }); sync(); }, { signal: abort.signal }); tile.prepend(check);
    let more = tile.querySelector<HTMLButtonElement>('.tile-menu-btn');
    if (!more) { more = button(tRaw('Item actions'), () => {}); more.className = 'tile-menu-btn'; more.textContent = ''; more.setAttribute('aria-label', tRaw('Item actions')); more.append(new window.DOMParser().parseFromString(icon('menu'), 'image/svg+xml').documentElement); tile.append(more); }
    more.removeAttribute('data-menu'); more.removeAttribute('data-menu-kind'); more.removeAttribute('data-team-menu'); more.setAttribute('aria-haspopup', 'menu');
    more.addEventListener('click', event => { event.stopPropagation(); const rect = more!.getBoundingClientRect(); menu.openAt(rect.right, rect.bottom, { ref: item.ref, tile }, more!); }, { signal: abort.signal });
    if (!o.canWrite) continue;
    tile.draggable = true;
    tile.addEventListener('dragstart', event => {
      const items = selected.has(item.ref) ? [...selected].map(ref => known.get(ref)!) : [item];
      event.dataTransfer?.setData(MIME, JSON.stringify({ project: o.projectId, instance: instance(), items: canonical(items) }));
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    }, { signal: abort.signal });
  }
  function dropTarget(el: HTMLElement, target: string | null): void {
    el.classList.add('team-folder-drop');
    el.addEventListener('dragover', event => { if (event.dataTransfer?.types.includes(MIME) || o.importLocal && event.dataTransfer?.types.some(type => type.startsWith('text/lolly-'))) { event.preventDefault(); event.stopPropagation(); el.classList.add('is-drop'); } }, { signal: abort.signal });
    el.addEventListener('dragleave', () => el.classList.remove('is-drop'), { signal: abort.signal });
    el.addEventListener('drop', event => {
      el.classList.remove('is-drop');
      const raw = event.dataTransfer?.getData(MIME); if (!raw) { if (o.importLocal) void o.importLocal(event, target); return; }
      event.preventDefault(); event.stopPropagation();
      try {
        const value = JSON.parse(raw);
        if (value.project !== o.projectId || value.instance !== instance() || !Array.isArray(value.items)) return;
        const items: ManagedProjectItem[] = value.items.map((item: ManagedProjectItem) => known.get(item.ref)).filter((item: ManagedProjectItem | undefined): item is ManagedProjectItem => !!item);
        if (items.length === value.items.length) void relocate(items, target);
      } catch { /* Ignore external drag data. */ }
    }, { signal: abort.signal });
  }
  if (o.canWrite) {
    dropTarget(o.grid, o.folderId);
    for (const folder of o.items.filter(item => item.kind === 'folder')) { const tile = tileOf(folder.ref); if (tile) dropTarget(tile, folder.ref); }
    for (const crumb of o.breadcrumbs.querySelectorAll<HTMLElement>('[data-team-folder]')) dropTarget(crumb, crumb.dataset.teamFolder || null);
  }
  const tileSelect = wireTileSelect({ host: o.grid, tiles: () => [...o.grid.querySelectorAll<HTMLElement>('.folder-tile[data-ref]')], refOf: tile => tile.dataset.ref!,
    current: () => new Set(selected), setRefs: refs => { selected.clear(); for (const ref of refs) selected.add(ref); sync(); }, clear: () => { selected.clear(); sync(); },
    noStart: '.folder-tile, button, a, input, label, dialog',
    keyboard: {
      cut: refs => { if (o.canWrite) copy('cut', refs.map(ref => known.get(ref)!)); },
      copy: refs => { if (o.canWrite) copy('copy', refs.map(ref => known.get(ref)!)); },
      paste: () => { if (o.canWrite) void paste(); },
      rename: (ref, tile) => { if (!o.canWrite) return; const item = known.get(ref)!; if (item.kind === 'folder') void folderAction('rename', item); else void o.itemAction('rename', item, tile); },
      remove: refs => { if (o.canWrite) void removeItems(refs.map(ref => known.get(ref)!)); },
      menu: (ref, tile) => { const rect = tile.getBoundingClientRect(); menu.openAt(rect.right, rect.bottom, { ref, tile }, tile); },
    },
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && o.current() && !document.querySelector('dialog[open], [role="menu"]')) { selected.clear(); sync(); } }, { signal: abort.signal });
  sync(); tileSelect.syncRoving();
  return () => { abort.abort(); tileSelect.destroy(); menu.destroy(); };
}
