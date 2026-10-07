// SPDX-License-Identifier: MPL-2.0
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { WebStateAPI } from '../bridge/state.ts';
import { createFolderStore, descendantFolderIds, type FolderHost } from '../folders.ts';
import { createTrash, trashHostOf } from '../lib/trash.ts';
import { getSessionSource, readSourceProjects } from '../lib/session-source.ts';
import { collectSessionAssetRefs } from '../lib/beam-pack.ts';
import { isBatchSlot } from '../lib/batch-slots.ts';
import { isRecord } from '../lib/util/guards.ts';
import { getInstanceBase } from '../lib/instance.ts';
import { mountModal } from '../components/modal.ts';
import { confirmDialog } from '../components/confirm-dialog.ts';
import { escape as escapeHtml } from '../utils.ts';
import { tRaw } from '../i18n.ts';
import { startJob } from '../lib/jobs.ts';
import { announce } from '../a11y.ts';
import { teamSaveInputs } from './team-save.ts';
import { canWriteProject } from './team-access.ts';
import { uploadTeamFile } from './team-files.ts';
import { createProjectFolder, listProjectFolders, moveProjectItem, projectFolderPath, teamFolderHref } from './project-folders.ts';

export interface LocalProjectItem { kind: 'session' | 'image' | 'folder'; ref: string }
type TransferHost = HostV1 & FolderHost & { state: WebStateAPI; assets: { _getBlob(id: string): Promise<Blob | null> } };
export const LOCAL_ITEMS_MIME = 'application/x-lolly-local-items';
export function localDragItems(event: DragEvent): LocalProjectItem[] {
  const data = event.dataTransfer; if (!data) return [];
  try {
    const items = JSON.parse(data.getData(LOCAL_ITEMS_MIME));
    if (Array.isArray(items) && items.length <= 1000 && items.every(item => item && ['session', 'image', 'folder'].includes(item.kind) && typeof item.ref === 'string')) return items;
  } catch { /* Older drag sources carry one item. */ }
  for (const kind of ['session', 'image', 'folder'] as const) { const ref = data.getData(`text/lolly-${kind}`); if (ref) return [{ kind, ref }]; }
  return [];
}

export async function chooseTeamDestination(current: () => boolean): Promise<{ project: string; folder: string | null } | undefined> {
  const source = getSessionSource(); if (!source?.write || source.write.projectOptions().canSave === false) return;
  const got = await readSourceProjects(source);
  if (!current() || source !== getSessionSource()) return;
  if (!got.ok) { announce(tRaw('Shared projects could not be loaded. Try again.')); return; }
  const projects = got.items.filter(project => canWriteProject(project.myRole));
  if (!projects.length) { announce(tRaw('No writable shared projects are available.')); return; }
  return new Promise(resolve => {
    let ready = false, request = 0;
    const modal = mountModal<{ project: string; folder: string | null }>(`<h2 class="modal-title">${tRaw('Move to team folder')}</h2>
      <label class="field-label">${tRaw('Shared project')}<select class="field-select" data-project>${projects.map(project => `<option value="${escapeHtml(project.id)}">${escapeHtml(project.name)}</option>`).join('')}</select></label>
      <label class="field-label">${tRaw('Folder')}<select class="field-select" data-folder></select></label><p role="status" data-notice></p>
      <div class="modal-actions"><button type="button" class="btn" data-cancel>${tRaw('Cancel')}</button><button type="button" class="btn btn--primary" data-confirm disabled>${tRaw('Move')}</button></div>`, { className: 'modal', ariaLabel: tRaw('Move to team folder'), onClose: value => { ++request; resolve(value); } });
    const project = modal.el.querySelector<HTMLSelectElement>('[data-project]')!, folder = modal.el.querySelector<HTMLSelectElement>('[data-folder]')!, confirm = modal.el.querySelector<HTMLButtonElement>('[data-confirm]')!, notice = modal.el.querySelector<HTMLElement>('[data-notice]')!;
    const load = async () => {
      const ticket = ++request; ready = false; confirm.disabled = true; folder.replaceChildren(); notice.textContent = tRaw('Loading…');
      const result = await listProjectFolders(project.value);
      if (!modal.el.isConnected || ticket !== request || !current() || source !== getSessionSource()) return;
      if (!result.ok) { notice.textContent = tRaw('Folders could not be loaded. Choose another project or try again.'); return; }
      for (const entry of [{ id: '', name: tRaw('Project root') }, ...result.data.map(entry => ({ id: entry.id, name: projectFolderPath(result.data, entry.id).map(part => part.name).join(' / ') }))]) { const option = document.createElement('option'); option.value = entry.id; option.textContent = entry.name; folder.append(option); }
      ready = true; confirm.disabled = false; notice.textContent = '';
    };
    project.addEventListener('change', () => { void load(); });
    modal.el.addEventListener('click', event => { if ((event.target as Element).closest('[data-cancel]')) modal.close(); else if ((event.target as Element).closest('[data-confirm]') && ready) modal.close({ project: project.value, folder: folder.value || null }); });
    void load();
  });
}

/** Verify destination writes before archiving the unchanged local originals in Trash. */
export async function moveLocalItemsToTeam(host: HostV1, items: readonly LocalProjectItem[], project: string, destination: string | null, current: () => boolean): Promise<boolean> {
  const source = getSessionSource(), writer = source?.write, h = host as TransferHost;
  if (!writer || writer.projectOptions().canSave === false || !items.length || !current()) return false;
  const origin = getInstanceBase() || location.origin;
  let cancelled = false;
  const wanted = () => !cancelled && current() && source === getSessionSource() && origin === (getInstanceBase() || location.origin);
  if (!await confirmDialog({ title: tRaw('Move to team folder'), message: tRaw('Share these items with everyone who can access the destination project. After all items are saved, the local originals move to Trash for recovery.'), confirmLabel: tRaw('Move'), danger: false }) || !wanted()) return false;
  const job = startJob({ title: tRaw('Move to team folder'), heavy: false, cancel: () => { cancelled = true; } });
  let saved = 0;
  try {
    const store = createFolderStore(h), trash = createTrash(trashHostOf(h));
    const projects = await readSourceProjects(source!);
    if (!projects.ok || !projects.items.some(item => item.id === project && canWriteProject(item.myRole))) throw Error(tRaw('You cannot save to that project.'));
    const folders = await store.list(), rows = await h.state.list(), bySlot = new Map(rows.map(row => [row.slot, row]));
    const selectedFolders = items.filter(item => item.kind === 'folder').map(item => item.ref);
    const covered = new Set(selectedFolders.flatMap(id => [id, ...descendantFolderIds(folders, id)]));
    const roots = items.filter(item => item.kind === 'folder' ? !folders.some(folder => covered.has(folder.id) && folder.id !== item.ref && descendantFolderIds(folders, folder.id).includes(item.ref)) : !folders.some(folder => covered.has(folder.id) && folder.items.some(member => member.ref === item.ref)));
    const snapshot = new Map<string, string>(), folderSnapshot = JSON.stringify(folders.filter(folder => covered.has(folder.id)));
    const prepared = new Map<string, { session?: Parameters<typeof writer.createSession>[1]; file?: Blob; name: string }>();
    const materials = [...roots.filter(item => item.kind !== 'folder'), ...folders.filter(folder => covered.has(folder.id)).flatMap(folder => folder.items.map(item => ({ kind: item.type === 'session' ? 'session' as const : 'image' as const, ref: item.ref })))];
    for (const item of materials) {
      if (!wanted()) return false;
      if (item.kind === 'session') {
        const data = await h.state.load(item.ref), row = bySlot.get(item.ref);
        if (!row?.toolId || !isRecord(data) || isBatchSlot(item.ref)) throw Error(tRaw('A saved batch or missing session cannot be moved to a team folder.'));
        const inputs = teamSaveInputs(data);
        if (inputs.deviceLocal > collectSessionAssetRefs(inputs.inputs).user.length) throw Error(tRaw('A session contains a device-only file. Share that file before moving the session.'));
        snapshot.set(item.ref, JSON.stringify(data));
        const name = row.label || row.toolId;
        const emoji = await h.state.emojiStamp?.(item.ref), rightsDecisions = await h.state.rightsDecisions?.(item.ref);
        prepared.set(item.ref, { name, session: { toolId: row.toolId, inputs: inputs.inputs, meta: { label: name, ...(emoji ? { emoji } : {}), ...(rightsDecisions ? { rightsDecisions } : {}) }, ...(typeof data.__toolVersion === 'string' ? { toolVersion: data.__toolVersion } : {}) } });
      } else {
        const id = item.ref.split(/[?#]/)[0]!, blob = await h.assets._getBlob?.(id), asset = await h.assets.get(id);
        if (!blob || !writer.projectOptions().canShareFiles) throw Error(tRaw('A file cannot be shared with this workspace. Your local items have not changed.'));
        prepared.set(item.ref, { file: blob, name: typeof asset.meta?.name === 'string' ? asset.meta.name : id.split('/').at(-1) || tRaw('File') });
      }
    }
    job.progress(0, materials.length, tRaw('Saving shared copies…'));
    async function material(item: LocalProjectItem, parent: string | null): Promise<void> {
      if (!wanted()) throw Error(tRaw('Move cancelled. Local originals remain on this device.'));
      if (item.kind === 'folder') {
        const folder = folders.find(folder => folder.id === item.ref); if (!folder) throw Error(tRaw('A folder is unavailable.'));
        const made = await createProjectFolder(project, folder.name, parent); if (!made.ok) throw Error(tRaw('A folder could not be created.'));
        for (const child of folders.filter(child => child.parentId === folder.id)) await material({ kind: 'folder', ref: child.id }, made.data.id);
        for (const member of folder.items) await material({ kind: member.type === 'session' ? 'session' : 'image', ref: member.ref }, made.data.id);
      } else {
        const data = prepared.get(item.ref)!; let id: string;
        if (data.session) { const result = await writer!.createSession(project, data.session); if (result.kind !== 'saved') throw Error(result.kind === 'file-error' ? result.message : tRaw('A session could not be saved.')); id = result.id; }
        else id = (await uploadTeamFile(project, data.file!, data.name)).id;
        ++saved; job.progress(saved, materials.length, data.name);
        const placed = await moveProjectItem(project, { kind: item.kind === 'session' ? 'session' : 'file', ref: id }, parent);
        if (!placed.ok) throw Error(tRaw('An item was saved at the project root but could not be moved.'));
      }
    }
    for (const item of roots) await material(item, destination);
    if (!wanted()) return false;
    if (JSON.stringify((await store.list()).filter(folder => covered.has(folder.id))) !== folderSnapshot) throw Error(tRaw('Local folders changed during the transfer. Shared copies are saved; local originals remain.'));
    for (const [ref, before] of snapshot) if (JSON.stringify(await h.state.load(ref)) !== before) throw Error(tRaw('A local session changed during the transfer. Shared copies are saved; local originals remain.'));
    job.progress(saved, materials.length, tRaw('Moving local originals to recovery…'));
    for (const item of roots) {
      if (!wanted()) return false;
      if (item.kind === 'folder') await trash.trashFolder(item.ref);
      else if (item.kind === 'session') await trash.trashSessions([item.ref], () => prepared.get(item.ref)?.name || item.ref);
      else await store.moveItem(item.ref, null, 'image');
    }
    if (wanted()) { announce(tRaw('Items moved. Local sessions and folders are in Trash. Uploads remain in Assets.')); window.location.hash = teamFolderHref(project, destination); }
    job.finish(); return true;
  } catch (error) {
    const message = tRaw('{message} Local originals are kept or recoverable in Trash. {n} items were saved to the shared project.', { message: error instanceof Error ? error.message : tRaw('Could not move these items.'), n: saved });
    job.fail(message); if (wanted()) announce(message); return false;
  } finally { if (!wanted()) job.fail(tRaw('Transfer stopped. Completed shared copies remain; local originals are kept or recoverable in Trash.')); job.settle(); }
}

export function wireLocalTeamDrops(root: HTMLElement, host: HostV1, current: () => boolean): void {
  if (!getSessionSource()?.write || getSessionSource()?.write?.projectOptions().canSave === false) return;
  for (const tile of root.querySelectorAll<HTMLElement>('.folder-tile[data-kind="team-project"]:not([data-team-writable="false"])')) {
    tile.addEventListener('dragover', event => { if (event.dataTransfer?.types.some(type => type.startsWith('text/lolly-') || type === LOCAL_ITEMS_MIME)) { event.preventDefault(); event.stopPropagation(); tile.classList.add('is-drop'); } });
    tile.addEventListener('dragleave', () => tile.classList.remove('is-drop'));
    tile.addEventListener('drop', event => { const items = localDragItems(event); if (!items.length) return; event.preventDefault(); event.stopPropagation(); tile.classList.remove('is-drop'); void moveLocalItemsToTeam(host, items, tile.dataset.ref!, null, current); });
  }
}

export function wireTeamMoveButton(dialog: HTMLDialogElement, host: HostV1, items: readonly LocalProjectItem[], current: () => boolean, close: () => void): void {
  if (!getSessionSource()?.write || getSessionSource()?.write?.projectOptions().canSave === false || !items.length) return;
  const button = document.createElement('button'); button.type = 'button'; button.className = 'btn'; button.textContent = tRaw('Team folders…');
  button.addEventListener('click', () => { close(); void chooseTeamDestination(current).then(destination => { if (destination && current()) void moveLocalItemsToTeam(host, items, destination.project, destination.folder, current); }); });
  dialog.querySelector('.movepicker-foot')?.prepend(button);
}
