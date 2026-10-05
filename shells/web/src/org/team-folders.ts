// SPDX-License-Identifier: MPL-2.0
/** Shared folder references are kept by the instance, independently of each device. */
import { instanceFetch, instancePath } from '../lib/instance.ts';
import { tRaw } from '../i18n.ts';

export interface TeamFolder {
  id: string; projectId: string; parentId: string | null; name: string; createdAt: string;
  items: Array<{ kind: 'session' | 'file'; ref: string }>;
}
async function request(projectId: string, path = '', method = 'GET', data?: unknown): Promise<Record<string, unknown>> {
  const response = await instanceFetch(instancePath(`/api/v1/projects/${encodeURIComponent(projectId)}/folders${path}`), {
    method, ...(data === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) }),
  });
  if (!response.ok) throw new Error(response.status === 403 ? tRaw('You can view this project but cannot change its folders.') : tRaw('Shared folders could not be loaded or saved. Check your connection and try again.'));
  return response.json();
}
export async function listTeamFolders(projectId: string): Promise<TeamFolder[]> {
  const data = await request(projectId);
  return Array.isArray(data.folders) ? data.folders as TeamFolder[] : [];
}
export async function createTeamFolder(projectId: string, name: string, parentId: string | null): Promise<TeamFolder> {
  const data = await request(projectId, '', 'POST', { name, parentId });
  return data.folder as TeamFolder;
}
export async function moveTeamFolderItem(projectId: string, folderId: string | null, kind: 'session' | 'file', ref: string): Promise<void> {
  await request(projectId, `/items/${kind}/${encodeURIComponent(ref)}`, 'PUT', { folderId });
}
export const teamFolderHref = (projectId: string, folderId?: string | null) => `#/p?team=${encodeURIComponent(projectId)}${folderId ? `&folder=${encodeURIComponent(folderId)}` : ''}`;
