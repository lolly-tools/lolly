// SPDX-License-Identifier: MPL-2.0
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { SessionSource } from '../lib/session-source.ts';
import { downloadTeamFile, restoreTeamFiles, uploadTeamFile, type TeamFile } from './team-files.ts';
import { createProjectFolder, moveProjectItem, type ProjectFolder } from './project-folders.ts';
import type { ManagedProjectItem } from './team-folder-manager.ts';
import { tRaw } from '../i18n.ts';
import type { LollyAssetsSlice } from '../views/tool-lolly-vehicle.ts';

export async function downloadProjectSession(host: HostV1, source: SessionSource, id: string, name: string, current: () => boolean): Promise<void> {
  const data = await source.fetchSession(id);
  if (!current()) return;
  if (!data) throw Error(tRaw('This session is unavailable. Refresh and try again.'));
  await restoreTeamFiles(host, data);
  const assets = host.assets as HostV1['assets'] & LollyAssetsSlice;
  if (typeof assets._exportUserAssets !== 'function') throw Error(tRaw('This host cannot download a session copy.'));
  const { buildLollyFile } = await import('../lib/lolly-pack.ts');
  const result = await buildLollyFile({ toolId: data.toolId, toolVersion: data.toolVersion, name,
    session: { ...data.inputs, __toolId: data.toolId, __toolVersion: data.toolVersion, __label: name },
    userAssets: await assets._exportUserAssets(),
    ...(assets._getUserRecord ? { resolveUser: (id: string, version?: string) => assets._getUserRecord!(id, version) } : {}),
  });
  if (current()) await host.export.download(result.blob, result.filename);
}

/** Copies use new IDs; original sessions, file references and revisions stay intact. */
export async function duplicateProjectItem(source: SessionSource, project: string, item: ManagedProjectItem, folders: readonly ProjectFolder[], files: readonly TeamFile[], current: () => boolean, host?: HostV1, suffix = true): Promise<string> {
  const check = () => { if (!current()) throw Error(tRaw('Copy cancelled. Any completed copies remain in the project.')); };
  check();
  if (item.kind === 'session') {
    const data = await source.fetchSession(item.ref); check();
    if (!data || !source.write) throw Error(tRaw('This session is unavailable. Refresh and try again.'));
    if (host) { await restoreTeamFiles(host, data); check(); }
    const label = item.name === item.ref && typeof data.meta?.label === 'string' ? data.meta.label : item.name;
    const saved = await source.write.createSession(project, { toolId: data.toolId, toolVersion: data.toolVersion, inputs: data.inputs, meta: { ...data.meta, label: suffix ? tRaw('{name} copy', { name: label }) : label } });
    if (saved.kind !== 'saved') throw Error(saved.kind === 'file-error' ? saved.message : tRaw('Could not copy this session.'));
    return saved.id;
  }
  if (item.kind === 'file') {
    const file = files.find(file => file.id === item.ref);
    if (!file) throw Error(tRaw('This file is unavailable. Refresh and try again.'));
    const blob = await downloadTeamFile(project, file); check();
    return (await uploadTeamFile(project, blob, file.name)).id;
  }
  const folder = folders.find(folder => folder.id === item.ref);
  if (!folder) throw Error(tRaw('This folder is unavailable. Refresh and try again.'));
  const created = await createProjectFolder(project, tRaw('{name} copy', { name: folder.name }).slice(0, 200), null);
  if (!created.ok) throw Error(tRaw('Could not copy this folder.'));
  async function children(original: ProjectFolder, target: string): Promise<void> {
    for (const child of folders.filter(folder => folder.parentId === original.id)) {
      check(); const made = await createProjectFolder(project, child.name, target);
      if (!made.ok) throw Error(tRaw('The folder copy is incomplete. Completed copies remain in the project.'));
      await children(child, made.data.id);
    }
    for (const member of original.items) {
      check(); const ref = await duplicateProjectItem(source, project, { ...member, name: member.ref }, folders, files, current, host, false);
      check(); const moved = await moveProjectItem(project, { kind: member.kind, ref }, target);
      if (!moved.ok) throw Error(tRaw('The folder copy is incomplete. Completed copies remain in the project.'));
    }
  }
  await children(folder, created.data.id); return created.data.id;
}
