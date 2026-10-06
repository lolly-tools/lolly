// SPDX-License-Identifier: MPL-2.0
import type { AssetRef, HostV1 } from '@lolly-tools/core/host-v1';
import { descendantFolderIds, type Folder } from '../folders.ts';
import { isHiddenSlot } from './batch-slots.ts';
import { getSessionSource, readSourceProjects, readSourceSessions } from './session-source.ts';
import { activeTeamSessionOrigin } from '../org/team-session-origin.ts';
import { orgConfig } from '../org/index.ts';
import { listTeamFiles, restoreTeamFiles } from '../org/team-files.ts';
import { canWriteProject } from '../org/team-access.ts';
import { siteToolSources, type SiteView } from './site-tools-context.ts';
import { siteCatalogAssets } from './site-tools-data.ts';

export interface SiteProject {
  id: string | null;
  kind: 'local' | 'shared';
  name: string;
  canEdit: boolean;
  items: Array<Record<string, unknown>>;
  assets: AssetRef[];
  resolve?(id: string): Promise<AssetRef>;
}

/** Read only the mounted project, using the same folder and workspace APIs as Projects. */
export async function readSiteProject(host: HostV1, view: SiteView, current: () => void): Promise<SiteProject | null> {
  const mounted = siteToolSources().tool;
  const origin = mounted ? activeTeamSessionOrigin(mounted.tool.manifest.id) : null;
  const sharedId = view.projectId || origin?.projectId;
  if (sharedId) {
    const source = getSessionSource();
    if (!source) throw new Error('Sign in to the workspace to read this project.');
    const check = () => { current(); if (source !== getSessionSource()) throw new Error('The workspace session changed. Read context again.'); };
    const projects = await readSourceProjects(source); check();
    if (!projects.ok) throw new Error(`Project access was refused (${projects.status}).`);
    const project = projects.items.find(item => item.id === sharedId);
    if (!project) throw new Error('The current project is unavailable.');
    const sessions = await readSourceSessions(source, sharedId); check();
    if (!sessions.ok) throw new Error(`Project sessions are unavailable (${sessions.status}).`);
    const files = orgConfig()?.sharing?.projectFiles ? (await listTeamFiles(sharedId)).files : []; check();
    const assets: AssetRef[] = files.map(file => ({ source: 'remote', id: `user/team/${file.id}`,
      type: (file.asset.type ?? 'data') as AssetRef['type'], format: String(file.asset.format ?? file.contentType), url: '',
      version: file.checksum, checksum: file.checksum,
      width: typeof file.asset.width === 'number' ? file.asset.width : undefined, height: typeof file.asset.height === 'number' ? file.asset.height : undefined,
      meta: { ...(file.asset.meta && typeof file.asset.meta === 'object' ? file.asset.meta : {}), name: file.name },
    }));
    return { id: project.id, kind: 'shared', name: project.name, canEdit: canWriteProject(project.myRole), assets,
      items: [...sessions.items.map(session => ({ kind: 'session', id: session.id, toolId: session.toolId, name: session.label, updatedAt: session.updatedAt })),
        ...assets.map(asset => ({ kind: 'asset', id: asset.id, name: asset.meta?.name, format: asset.format }))],
      async resolve(id) {
        check();
        if (!assets.some(asset => asset.id === id)) throw new Error('This asset is outside the current project.');
        await restoreTeamFiles(host, { toolId: mounted?.tool.manifest.id ?? '', projectId: sharedId, inputs: { image: { source: 'user', id } } }); check();
        const ref = await host.assets.get(id); check(); return ref;
      },
    };
  }
  if (view.name !== 'projects' && !mounted) return null;
  const profile = await host.profile.get() as Awaited<ReturnType<HostV1['profile']['get']>> & { folders?: Folder[] }; current();
  const folders = profile.folders ?? [];
  const slot = mounted?.slot();
  const folderId = view.name === 'projects' ? view.folderId : mounted?.folder() ?? folders.find(folder => folder.items.some(item => item.type === 'session' && item.ref === slot))?.id;
  if (!folderId) return view.name === 'projects' ? { id: null, kind: 'local', name: 'Projects', canEdit: true, assets: [],
    items: folders.filter(folder => !folder.parentId).map(folder => ({ kind: 'folder', id: folder.id, name: folder.name, href: `#/p/${encodeURIComponent(folder.id)}` })) } : null;
  const folder = folders.find(item => item.id === folderId);
  if (!folder) throw new Error('The current project is unavailable.');
  const ids = new Set([folderId, ...descendantFolderIds(folders, folderId)]);
  const refs = folders.filter(item => ids.has(item.id)).flatMap(item => item.items);
  const assetIds = [...new Set(refs.filter(item => item.type === 'image').map(item => item.ref))];
  const uploadAPI = host.assets as HostV1['assets'] & { _listUserAssets?(): Promise<AssetRef[]> };
  const [catalog, uploads] = await Promise.all([siteCatalogAssets(host), uploadAPI._listUserAssets?.() ?? []]); current();
  const byId = new Map([...catalog, ...uploads].map(ref => [ref.id, ref]));
  const assets = assetIds.flatMap(id => byId.has(id) ? [byId.get(id)!] : []);
  const state = host.state as HostV1['state'] & { list?(): Promise<Array<{ slot: string; toolId?: string; label?: string; updatedAt?: string }>> };
  const sessions = await state.list?.() ?? []; current();
  const sessionIds = new Set(refs.filter(item => item.type === 'session').map(item => item.ref));
  return { id: folder.id, kind: 'local', name: folder.name, canEdit: true, assets,
    items: [...folders.filter(item => item.parentId === folderId).map(item => ({ kind: 'folder', id: item.id, name: item.name })),
      ...sessions.filter(item => sessionIds.has(item.slot) && !isHiddenSlot(item.slot)).map(item => ({ kind: 'session', id: item.slot, toolId: item.toolId, name: item.label, updatedAt: item.updatedAt })),
      ...assets.map(asset => ({ kind: 'asset', id: asset.id, name: asset.meta?.name, format: asset.format }))],
  };
}
