// SPDX-License-Identifier: MPL-2.0
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { createFolderStore, descendantFolderIds, type Folder } from '../folders.ts';
import type { FolderHost } from '../folders.ts';
import { getSessionSource, readSourceProjects } from '../lib/session-source.ts';
import { getInstanceBase } from '../lib/instance.ts';
import { copyFolderToTeam, folderCopyKey, sharedFolderMaterialName, type FolderCopyEntry } from '../lib/team-folder-copy.ts';
import { isBatchSlot } from '../lib/batch-slots.ts';
import { confirmDialog } from '../components/confirm-dialog.ts';
import { collectSessionAssetRefs } from '../lib/beam-pack.ts';
import { tRaw } from '../i18n.ts';
import { uploadTeamFile } from './team-files.ts';
import { canWriteProject } from './team-access.ts';
import { teamSaveInputs } from './team-save.ts';
import type { WebStateAPI } from '../bridge/state.ts';
import { isRecord } from '../lib/util/guards.ts';

type ShareHost = HostV1 & FolderHost & { state: WebStateAPI; assets: { _getBlob(id: string): Promise<Blob | null> } };

/** Promote the folder's shared copy in place, with a visible transfer and local originals. */
export async function shareLocalFolder(host: ShareHost, folderId: string, container: HTMLElement, mounted: () => boolean): Promise<void> {
  const store = createFolderStore(host), folders: readonly Folder[] = await store.list();
  const folder = folders.find(item => item.id === folderId), source = getSessionSource();
  if (!folder || !source?.write?.projectOptions().canCreate) return;
  const instance = getInstanceBase() || location.origin, writer = source.write;
  const current = () => mounted() && source === getSessionSource() && instance === (getInstanceBase() || location.origin);
  const accepted = await confirmDialog({ title: tRaw('Share as a team project'), message: tRaw('Copy the documents and files in this folder into a shared project. Your local originals stay on this device. Nested folder names are kept in the document names.'), confirmLabel: tRaw('Share'), danger: false });
  if (!accepted || !current()) return;
  const panel = document.createElement('section'); panel.className = 'team-project-head';
  const status = document.createElement('p'); status.className = 'team-project-notice'; status.setAttribute('role', 'status'); status.textContent = tRaw('Preparing shared project…');
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'btn btn--sm'; cancel.textContent = tRaw('Cancel');
  let cancelled = false; cancel.addEventListener('click', () => { cancelled = true; status.textContent = tRaw('Cancelled. Your local originals are safe.'); cancel.remove(); });
  panel.append(status, cancel); container.prepend(panel);
  const wanted = () => current() && !cancelled;
  try {
    const ids = new Set([folderId, ...descendantFolderIds(folders, folderId)]), entries: FolderCopyEntry[] = [];
    const rows = await host.state.list(), bySlot = new Map(rows.map(row => [row.slot, row]));
    // Read everything before creating the project: no missing document is silently skipped.
    for (const member of folders.filter(item => ids.has(item.id))) for (const item of member.items) {
      if (!wanted()) return;
      if (item.type === 'session') {
        const data = await host.state.load(item.ref), row = bySlot.get(item.ref);
        if (!row?.toolId || !isRecord(data) || isBatchSlot(item.ref)) throw Error(tRaw('This folder contains a saved batch or a missing document. Keep the local folder and share its documents individually.'));
        const prepared = teamSaveInputs(data);
        if (prepared.deviceLocal > collectSessionAssetRefs(prepared.inputs).user.length) throw Error(tRaw('This document contains a device-only file. Share that file separately before converting the folder.'));
        const name = sharedFolderMaterialName(folders, folderId, member.id, row.label || row.toolId);
        const session = { toolId: row.toolId, ...(typeof data.__toolVersion === 'string' ? { toolVersion: data.__toolVersion } : {}), inputs: prepared.inputs, meta: { label: name, folderPath: sharedFolderMaterialName(folders, folderId, member.id, '').split(' / ').filter(Boolean) } };
        entries.push({ ref: await folderCopyKey(item.ref, JSON.stringify(session)), name, session });
      } else {
        const assetId = item.ref.split('?')[0]!.split('#')[0]!;
        const blob = await host.assets._getBlob(assetId);
        if (!blob) throw Error(tRaw('A file in this folder could not be loaded. Your local folder has not changed.'));
        const asset = await host.assets.get(assetId);
        const fileName = typeof asset.meta?.name === 'string' && asset.meta.name ? asset.meta.name : assetId.split('/').at(-1) || tRaw('File');
        const name = sharedFolderMaterialName(folders, folderId, member.id, fileName);
        entries.push({ ref: await folderCopyKey(`${item.ref}:${name}`, blob), name, file: blob });
      }
    }
    if (entries.some(entry => entry.file) && !writer.projectOptions().canShareFiles) throw Error(tRaw('This workspace does not share project files. Your local folder has not changed.'));
    const previous = folder.teamCopy?.instance === instance ? folder.teamCopy : undefined;
    if (previous) {
      const projects = await readSourceProjects(source);
      if (!wanted()) return;
      if (!projects.ok || !canWriteProject(projects.items.find(project => project.id === previous!.projectId)?.myRole)) throw Error(tRaw('You cannot save to that project.'));
    }
    const copy = await copyFolderToTeam(folder.name, instance, entries, previous, { writer, current: wanted,
      upload: async (projectId, blob, name) => (await uploadTeamFile(projectId, blob, name)).id,
      remember: async copy => { if (!current()) throw Error('Folder sharing context changed'); await store.setTeamCopy(folderId, copy); },
      progress: (done, total) => { if (wanted()) status.textContent = tRaw('Sharing {done} of {total}…', { done, total }); },
    });
    if (wanted()) window.location.hash = `#/p?team=${encodeURIComponent(copy.projectId)}&tab=people`;
  } catch (error) { if (current() && !cancelled) { status.textContent = error instanceof Error ? error.message : tRaw('Could not save. Try again.'); cancel.textContent = tRaw('Close'); cancel.onclick = () => panel.remove(); } }
}
