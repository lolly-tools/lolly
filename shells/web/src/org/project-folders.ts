// SPDX-License-Identifier: MPL-2.0
import { instanceFetch, instancePath } from '../lib/instance.ts';

export type ProjectItemKind = 'folder' | 'session' | 'file';
export interface ProjectFolderItem { kind: 'session' | 'file'; ref: string }
export interface ProjectFolder {
  id: string; projectId: string; parentId: string | null; name: string;
  items: ProjectFolderItem[];
  createdAt?: string;
}
export type FolderResult<T> = { ok: true; data: T } | { ok: false; status: number };
const base = (project: string) => `/api/v1/projects/${encodeURIComponent(project)}/folders`;

async function request<T>(path: string, method = 'GET', body?: unknown): Promise<FolderResult<T>> {
  try {
    const response = await instanceFetch(instancePath(path), {
      method, credentials: 'include', cache: 'no-store',
      ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    });
    if (!response.ok) return { ok: false, status: response.status };
    return { ok: true, data: response.status === 204 ? null : await response.json() };
  } catch { return { ok: false, status: 0 }; }
}

export async function listProjectFolders(project: string): Promise<FolderResult<ProjectFolder[]>> {
  const got = await request<{ folders?: ProjectFolder[] }>(base(project));
  if (!got.ok) return got;
  const folders = got.data?.folders;
  if (!Array.isArray(folders) || folders.length > 1000) return { ok: false, status: 0 };
  const ids = new Set<string>();
  for (const folder of folders) {
    if (!folder || typeof folder.id !== 'string' || ids.has(folder.id) || folder.projectId !== project || typeof folder.name !== 'string'
      || folder.parentId !== null && typeof folder.parentId !== 'string' || !Array.isArray(folder.items)
      || folder.items.some(item => !item || !['session', 'file'].includes(item.kind) || typeof item.ref !== 'string')) return { ok: false, status: 0 };
    ids.add(folder.id);
  }
  const byId = new Map(folders.map(folder => [folder.id, folder]));
  for (const folder of folders) {
    const seen = new Set([folder.id]);
    let parent = folder.parentId;
    while (parent !== null) {
      const next = byId.get(parent);
      if (!next || seen.has(parent)) return { ok: false, status: 0 };
      seen.add(parent); parent = next.parentId;
    }
  }
  return { ok: true, data: folders };
}

export async function createProjectFolder(project: string, name: string, parentId: string | null): Promise<FolderResult<ProjectFolder>> {
  const got = await request<{ folder: ProjectFolder }>(base(project), 'POST', { name, parentId });
  return got.ok ? { ok: true, data: got.data.folder } : got;
}
export const renameProjectFolder = (project: string, folder: string, name: string) => request(`${base(project)}/${encodeURIComponent(folder)}`, 'PATCH', { name });
export const deleteProjectFolder = (project: string, folder: string) => request(`${base(project)}/${encodeURIComponent(folder)}`, 'DELETE');
export const renameProjectFile = (project: string, file: string, name: string) => request(`/api/v1/projects/${encodeURIComponent(project)}/files/${encodeURIComponent(file)}`, 'PATCH', { name });
export function moveProjectItem(project: string, item: { kind: ProjectItemKind; ref: string }, folderId: string | null): Promise<FolderResult<unknown>> {
  return item.kind === 'folder'
    ? request(`${base(project)}/${encodeURIComponent(item.ref)}/parent`, 'PUT', { parentId: folderId })
    : request(`${base(project)}/items/${item.kind}/${encodeURIComponent(item.ref)}`, 'PUT', { folderId });
}

export function projectFolderPath(folders: readonly ProjectFolder[], id: string | null): ProjectFolder[] {
  const path: ProjectFolder[] = [], seen = new Set<string>(), byId = new Map(folders.map(folder => [folder.id, folder]));
  while (id !== null && !seen.has(id)) {
    seen.add(id); const folder = byId.get(id);
    if (!folder) break;
    path.unshift(folder); id = folder.parentId;
  }
  return path;
}

export function canMoveProjectItem(folders: readonly ProjectFolder[], item: { kind: ProjectItemKind; ref: string }, target: string | null): boolean {
  if (target !== null && !folders.some(folder => folder.id === target)) return false;
  return item.kind !== 'folder' || !projectFolderPath(folders, target).some(folder => folder.id === item.ref);
}

export const projectItemFolder = (folders: readonly ProjectFolder[], kind: 'session' | 'file', ref: string): string | null =>
  folders.find(folder => folder.items.some(item => item.kind === kind && item.ref === ref))?.id ?? null;

export function teamFolderHref(project: string, folder: string | null = null): string {
  const params = new URLSearchParams({ team: project });
  if (folder) params.set('folder', folder);
  return `#/p?${params}`;
}
