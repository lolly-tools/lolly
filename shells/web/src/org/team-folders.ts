// SPDX-License-Identifier: MPL-2.0
/** Shared folder references are kept by the instance, independently of each device. */
import { getInstanceBase, instanceFetch, instancePath } from '../lib/instance.ts';
import { tRaw } from '../i18n.ts';

export interface TeamFolder {
  id: string; projectId: string; parentId: string | null; name: string; createdAt: string;
  items: Array<{ kind: 'session' | 'file'; ref: string }>;
}
/** One thing inside a shared project that a folder can hold or a move can carry. */
export type TeamItemKind = 'folder' | 'session' | 'file';
export interface TeamItemRef { kind: TeamItemKind; ref: string }
/** The answer to a call that reports refusals instead of throwing. */
export type FolderResult<T> = { ok: true; data: T } | { ok: false; status: number; unsupported?: boolean };

/** A refused folder request, with the HTTP status (0: no answer or an unreadable list). */
export class TeamFolderError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(status === 403 ? tRaw('You can view this project but cannot change its folders.') : tRaw('Shared folders could not be loaded or saved. Check your connection and try again.'));
    this.status = status;
  }
}
async function request(projectId: string, path = '', method = 'GET', data?: unknown): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await instanceFetch(instancePath(`/api/v1/projects/${encodeURIComponent(projectId)}/folders${path}`), {
      method, ...(data === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) }),
    });
  } catch { throw new TeamFolderError(0); }
  if (!response.ok) throw new TeamFolderError(response.status);
  return response.status === 204 ? {} : response.json();
}

/** Whether a folder list is a tree inside this project: unique ids, readable names
 *  and members, and every parent present without a cycle. A list that fails is not
 *  shown, so a broken answer never looks like an empty project anyone can write to. */
export function validTeamFolders(projectId: string, value: unknown): value is TeamFolder[] {
  if (!Array.isArray(value) || value.length > 1000) return false;
  const ids = new Set<string>();
  for (const folder of value as Array<Partial<TeamFolder> | null>) {
    if (!folder || typeof folder.id !== 'string' || ids.has(folder.id) || folder.projectId !== projectId || typeof folder.name !== 'string'
      || (folder.parentId !== null && typeof folder.parentId !== 'string') || !Array.isArray(folder.items)
      || folder.items.some(item => !item || (item.kind !== 'session' && item.kind !== 'file') || typeof item.ref !== 'string')) return false;
    ids.add(folder.id);
  }
  const byId = new Map((value as TeamFolder[]).map(folder => [folder.id, folder]));
  for (const folder of value as TeamFolder[]) {
    const seen = new Set([folder.id]);
    for (let parent = folder.parentId; parent !== null;) {
      const next = byId.get(parent);
      if (!next || seen.has(parent)) return false;
      seen.add(parent); parent = next.parentId;
    }
  }
  return true;
}
export async function listTeamFolders(projectId: string): Promise<TeamFolder[]> {
  const data = await request(projectId);
  if (!validTeamFolders(projectId, data.folders)) throw new TeamFolderError(0);
  return data.folders;
}
export async function createTeamFolder(projectId: string, name: string, parentId: string | null): Promise<TeamFolder> {
  const data = await request(projectId, '', 'POST', { name, parentId });
  return data.folder as TeamFolder;
}
export async function moveTeamFolderItem(projectId: string, folderId: string | null, kind: 'session' | 'file', ref: string): Promise<void> {
  await request(projectId, `/items/${kind}/${encodeURIComponent(ref)}`, 'PUT', { folderId });
}
export const teamFolderHref = (projectId: string, folderId?: string | null) => `#/p?team=${encodeURIComponent(projectId)}${folderId ? `&folder=${encodeURIComponent(folderId)}` : ''}`;

/** Rename, move or remove the folder container without rewriting its documents. */
export async function renameTeamFolder(projectId: string, id: string, name: string): Promise<void> {
  await request(projectId, `/${encodeURIComponent(id)}`, 'PATCH', { name });
}
export async function moveTeamFolder(projectId: string, id: string, parentId: string | null): Promise<void> {
  await request(projectId, `/${encodeURIComponent(id)}/parent`, 'PUT', { parentId });
}
export async function deleteTeamFolder(projectId: string, id: string): Promise<void> {
  await request(projectId, `/${encodeURIComponent(id)}`, 'DELETE');
}
/** Move a folder, session or file to `folderId` (null: the project root). A folder
 *  gets a new parent folder; a session or file gets a new folder. */
export async function moveTeamItem(projectId: string, item: TeamItemRef, folderId: string | null): Promise<void> {
  if (item.kind === 'folder') await moveTeamFolder(projectId, item.ref, folderId);
  else await moveTeamFolderItem(projectId, folderId, item.kind, item.ref);
}

/** The folders from the project root down to `id`, inclusive. Pure. */
export function teamFolderPath(folders: readonly TeamFolder[], id: string | null): TeamFolder[] {
  const path: TeamFolder[] = [], seen = new Set<string>(), byId = new Map(folders.map(folder => [folder.id, folder]));
  while (id !== null && !seen.has(id)) {
    seen.add(id);
    const folder = byId.get(id);
    if (!folder) break;
    path.unshift(folder); id = folder.parentId;
  }
  return path;
}
/** The folder that holds a session or file, the parent of a folder, or null for the root. Pure. */
export function teamItemFolder(folders: readonly TeamFolder[], item: TeamItemRef): string | null {
  if (item.kind === 'folder') return folders.find(folder => folder.id === item.ref)?.parentId ?? null;
  return folders.find(folder => folder.items.some(member => member.kind === item.kind && member.ref === item.ref))?.id ?? null;
}
/** Whether `item` may move to `target`: the target exists in this project, and a
 *  folder never moves into itself or one of its own subfolders. Pure. */
export function canMoveTeamItem(folders: readonly TeamFolder[], item: TeamItemRef, target: string | null): boolean {
  if (target !== null && !folders.some(folder => folder.id === target)) return false;
  return item.kind !== 'folder' || !teamFolderPath(folders, target).some(folder => folder.id === item.ref);
}

/** Instances seen without the file rename route, so Rename is offered disabled there. */
const renameMissing = new Set<string>();
const instanceKey = (): string => getInstanceBase() || globalThis.location?.origin || '';
/** False once this instance answered a rename as a route it does not have. */
export function teamFileRenameAvailable(): boolean { return !renameMissing.has(instanceKey()); }
/** Test seam: forget what was learned about the rename route. */
export function resetTeamFileRenameForTest(): void { renameMissing.clear(); }

/**
 * Change a shared file's display name. The id, bytes and checksum stay the same.
 * An instance that predates the route answers 404 "no route", 405 or 501: the
 * result says `unsupported` and Rename is offered disabled from then on, while a
 * 404 for a missing file is an ordinary refusal.
 */
export async function renameTeamFile(projectId: string, fileId: string, name: string): Promise<FolderResult<{ name: string }>> {
  let response: Response;
  try {
    response = await instanceFetch(instancePath(`/api/v1/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}`), {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }),
    });
  } catch { return { ok: false, status: 0 }; }
  if (response.ok) {
    const body = await response.json().catch(() => null) as { name?: unknown } | null;
    return { ok: true, data: { name: typeof body?.name === 'string' ? body.name : name } };
  }
  let message = '';
  if (response.status === 404) {
    const body = await response.json().catch(() => null) as { error?: { message?: unknown } } | null;
    message = typeof body?.error?.message === 'string' ? body.error.message : '';
  }
  const unsupported = response.status === 405 || response.status === 501 || (response.status === 404 && /^no route\b/i.test(message));
  if (unsupported) renameMissing.add(instanceKey());
  return { ok: false, status: response.status, ...(unsupported ? { unsupported: true } : {}) };
}
