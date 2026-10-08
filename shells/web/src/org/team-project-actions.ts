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
import { deleteTeamFolder, moveTeamFolder, moveTeamFolderItem, renameTeamFolder, type TeamFolder } from './team-folders.ts';
import { deleteTeamFile, downloadTeamFile, knownUploaderId, TeamFileError, teamFileMessage, type TeamFile } from './team-files.ts';
import { listProjectPeople } from './project-members.ts';
import { getHostRef } from '../lib/host-ref.ts';

interface Options {
  grid: HTMLElement; content: HTMLElement; projectId: string; projectName: string; folderId: string | null;
  folders: TeamFolder[]; files: TeamFile[]; canWrite: boolean; canManage: boolean; canDeleteSession: boolean;
  current(): boolean; reload(): void; notice(message: string): void;
  duplicate(id: string, kind: string): Promise<void>;
  sessionAction(action: string, id: string, tile: HTMLElement | null): Promise<boolean | undefined>;
}
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') => {
  const el = document.createElement(tag); el.className = cls; el.textContent = text; return el;
};
const control = (name: string, symbol: Parameters<typeof actionButton>[1]) => actionButton(tRaw(name), symbol);

export function mountTeamProjectActions(o: Options): () => void {
  const abort = new AbortController(), selected = new Set<string>();
  let busy = false, uploader = knownUploaderId();
  const tiles = () => Array.from(o.grid.querySelectorAll<HTMLElement>('.folder-tile[data-ref]'));
  const tileFor = (id: string) => tiles().find(t => t.dataset.ref === id);
  const kind = (id: string) => tileFor(id)?.dataset.kind;
  const name = (id: string) => tileFor(id)?.querySelector('.tile-title')?.textContent || id;
  const canDelete = (id: string) => kind(id) === 'team-folder' ? o.canWrite : kind(id) === 'team-session' ? o.canDeleteSession
    : o.canManage || !!uploader && o.files.some(f => f.id === id && f.createdBy === uploader);
  const canRename = (id: string) => o.canWrite && kind(id) !== 'team-file';
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
    move.hidden = !o.canWrite; remove.hidden = ![...selected].every(canDelete);
    move.disabled = remove.disabled = clear.disabled = busy;
  };
  const setRefs = (refs: Set<string>) => { if (busy) return; selected.clear(); for (const id of refs) if (tileFor(id)) selected.add(id); paint(); };
  const selection = wireTileSelect({ host: o.grid, tiles, refOf: tile => tile.dataset.ref!, current: () => new Set(selected), setRefs,
    clear: () => setRefs(new Set()), noStart: '.folder-tile, button, input, select, a, [role="menu"]',
    keyboard: { remove: refs => { if (refs.every(canDelete)) void run('delete', refs); },
      rename: ref => { if (canRename(ref)) void run('rename', [ref]); },
      menu: (ref, tile) => { const r = tile.getBoundingClientRect(); menu.openAt(r.right, r.bottom, { ref, tile }); } },
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
    + (o.canWrite ? menuItemHtml('duplicate', icon('duplicate'), tRaw('Duplicate')) : '')
    + (o.canWrite ? menuItemHtml('move', icon('move'), tRaw('Move to folder')) : '')
    + (canRename(id) ? menuItemHtml('rename', icon('pen'), tRaw('Rename')) : '')
    + (canDelete(id) ? menuItemHtml('delete', icon('trash'), tRaw('Delete'), { danger: true }) : '');
  const menu = wireTileContextMenu({ host: o.grid, tileSelector: '.folder-tile[data-ref]', refOf: tile => tile.dataset.ref || null,
    singleHtml: target => rows(target.ref), isBulkTarget: id => selected.size > 1 && selected.has(id),
    bulkHtml: () => (o.canWrite ? menuItemHtml('move', icon('move'), tRaw('Move to folder')) : '')
      + ([...selected].every(id => kind(id) === 'team-session') ? menuItemHtml('copy-local', icon('duplicate'), tRaw('Copy to my projects')) : '')
      + ([...selected].every(canDelete) ? menuItemHtml('delete', icon('trash'), tRaw('Delete'), { danger: true }) : ''),
    backgroundHtml: () => menuItemHtml('select-all', icon('check'), tRaw('Select all')),
    onAction: (action, target) => { if (action === 'select-all') setRefs(new Set(tiles().map(t => t.dataset.ref!))); else void run(action, target ? [target.ref] : [...selected]); },
    className: 'folder-menu projects-menu', presentation: 'sheet', head: target => ({ name: target ? name(target.ref) : tRaw('{n} selected', { n: selected.size }) }),
  });
  move.addEventListener('click', () => { void run('move', [...selected]); }, { signal: abort.signal });
  remove.addEventListener('click', () => { void run('delete', [...selected]); }, { signal: abort.signal });
  clear.addEventListener('click', () => setRefs(new Set()), { signal: abort.signal });
  selection.syncRoving();
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
    if ((action === 'move' || action === 'duplicate') && !o.canWrite || action === 'delete' && !refs.every(canDelete)) return;
    if (action === 'move') { await chooseDestination(refs); return; }
    if (action === 'delete' && !(await confirmDialog({ title: tRaw('Delete selected items?'), message: tRaw('Delete {n} selected item(s) for everyone? Folder contents and subfolders move to the parent folder.', { n: refs.length }), confirmLabel: tRaw('Delete') }))) return;
    if (!o.current()) return;
    busy = true; paint(); let changed = false;
    try {
      for (const id of refs) {
        if (!o.current()) break;
        if (action === 'duplicate') { await o.duplicate(id, kind(id) || ''); changed = true; continue; }
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
