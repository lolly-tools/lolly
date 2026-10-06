// SPDX-License-Identifier: MPL-2.0
import type { SessionSourceWriter } from '../lib/session-source.ts';
import { tRaw } from '../i18n.ts';
import { fetchTeamSession } from './session-source.ts';
import { createTeamFolder, moveTeamFolderItem, type TeamFolder } from './team-folders.ts';
import { duplicateTeamFile, listTeamFiles } from './team-files.ts';

/** Copy authored content into new identities within the same shared project. */
export async function duplicateProjectItem(opts: {
  projectId: string; id: string; kind: string; folderId: string | null;
  folders: TeamFolder[]; writer?: SessionSourceWriter; name: string; current(): boolean;
}): Promise<void> {
  const copyName = (name: string) => tRaw('{name} copy', { name }).slice(0, 200);
  const check = () => { if (!opts.current()) throw new Error(tRaw('Your project access changed. Refresh and try again.')); };
  check();
  const planned = new Set<string>();
  let needsWriter = false;
  const plannedFiles: string[] = [];
  function plan(id: string, kind: string, depth = 0): void {
    if (planned.size >= 1000 || planned.has(id) || depth > 64) throw new Error(tRaw('This folder is too large or contains invalid references.'));
    planned.add(id);
    if (kind === 'team-session') { needsWriter = true; return; }
    if (kind === 'team-file') { plannedFiles.push(id); return; }
    if (kind !== 'team-folder') throw new Error(tRaw('This shared item cannot be duplicated.'));
    const folder = opts.folders.find(f => f.id === id);
    if (!folder) throw new Error(tRaw('This shared folder is unavailable. Refresh and try again.'));
    for (const item of folder.items) plan(item.ref, item.kind === 'session' ? 'team-session' : 'team-file', depth + 1);
    for (const child of opts.folders.filter(f => f.parentId === id)) plan(child.id, 'team-folder', depth + 1);
  }
  plan(opts.id, opts.kind);
  if (needsWriter && !opts.writer?.projectOptions().canSave) throw new Error(tRaw('You cannot duplicate this item in this project.'));
  const fileList = opts.kind === 'team-file' || opts.kind === 'team-folder' ? await listTeamFiles(opts.projectId) : undefined;
  check();
  if (plannedFiles.some(id => !fileList?.files.some(file => file.id === id))) throw new Error(tRaw('This shared asset is unavailable. Refresh and try again.'));
  let count = 0;
  const seen = new Set<string>();
  const copy = async (id: string, kind: string, parent: string | null, name?: string): Promise<void> => {
    check();
    if (++count > 1000 || seen.has(id)) throw new Error(tRaw('This folder is too large or contains invalid references.'));
    seen.add(id);
    if (kind === 'team-folder') {
      const folder = opts.folders.find(f => f.id === id);
      if (!folder) throw new Error(tRaw('This shared folder is unavailable. Refresh and try again.'));
      const fresh = await createTeamFolder(opts.projectId, name ?? folder.name, parent);
      for (const item of folder.items) await copy(item.ref, item.kind === 'session' ? 'team-session' : 'team-file', fresh.id);
      for (const child of opts.folders.filter(f => f.parentId === id)) await copy(child.id, 'team-folder', fresh.id);
      return;
    }
    if (kind === 'team-file') {
      const file = fileList?.files.find(f => f.id === id);
      if (!file) throw new Error(tRaw('This shared asset is unavailable. Refresh and try again.'));
      const fresh = await duplicateTeamFile(opts.projectId, file, name ?? file.name);
      check(); await moveTeamFolderItem(opts.projectId, parent, 'file', fresh.id);
      return;
    }
    if (kind !== 'team-session' || !opts.writer?.projectOptions().canSave) throw new Error(tRaw('You cannot duplicate this item in this project.'));
    const source = await fetchTeamSession(id);
    check();
    if (!source.ok || source.data.projectId !== opts.projectId) throw new Error(tRaw('This shared session is unavailable. Refresh and try again.'));
    const data = source.data;
    const result = await opts.writer.createSession(opts.projectId, { toolId: data.toolId, toolVersion: data.toolVersion,
      inputs: data.inputs, meta: { ...data.meta, label: name ?? data.meta?.label } });
    if (result.kind !== 'saved') throw new Error(result.kind === 'file-error' ? result.message : tRaw('Could not duplicate this session. Refresh and try again.'));
    check(); await moveTeamFolderItem(opts.projectId, parent, 'session', result.id);
  };
  await copy(opts.id, opts.kind, opts.folderId, copyName(opts.name));
}
