// SPDX-License-Identifier: MPL-2.0
/**
 * Cut, copy, paste and drag inside one shared project (plan 296). Shared folders,
 * sessions and files keep their ids when they move: a move only changes which folder
 * holds them, one acknowledged write per item, so a refused write stops the run and
 * leaves the rest where it was.
 *
 * The clipboard lives at module scope, like the personal Projects clipboard, so a
 * person can cut in one folder, open another and paste there. It belongs to one
 * instance and one project; nothing crosses to another project or to local Projects.
 */
import { getInstanceBase } from '../lib/instance.ts';
import { isRecord } from '../lib/util/guards.ts';
import { tRaw } from '../i18n.ts';
import { canMoveTeamItem, moveTeamItem, teamFolderPath, teamItemFolder, type TeamFolder, type TeamItemKind, type TeamItemRef } from './team-folders.ts';

/** A drag of shared tiles. Its own type, so the desktop file drop and the local
 *  Projects drops never react to this type. */
export const TEAM_ITEMS_MIME = 'application/x-lolly-team-items';
export interface TeamClipItem extends TeamItemRef { name: string }
interface TeamClipboard { instance: string; project: string; mode: 'cut' | 'copy'; items: TeamClipItem[] }

let clipboard: TeamClipboard | null = null;
const instance = (): string => getInstanceBase() || globalThis.location?.origin || '';
const isKind = (kind: unknown): kind is TeamItemKind => kind === 'folder' || kind === 'session' || kind === 'file';

/** The clipboard, when it holds items of this project on this instance. */
export function teamClipboard(projectId: string): Readonly<TeamClipboard> | null {
  return clipboard && clipboard.instance === instance() && clipboard.project === projectId ? clipboard : null;
}
export function setTeamClipboard(projectId: string, mode: 'cut' | 'copy', items: readonly TeamClipItem[]): void {
  clipboard = items.length ? { instance: instance(), project: projectId, mode, items: [...items] } : null;
}
export function clearTeamClipboard(): void { clipboard = null; }

/** Leave out items that a selected folder already carries. Pure. */
export function topLevelTeamItems<T extends TeamItemRef>(folders: readonly TeamFolder[], items: readonly T[]): T[] {
  const chosen = new Set(items.filter(item => item.kind === 'folder').map(item => item.ref));
  return items.filter(item => {
    const home = teamItemFolder(folders, item);
    return !teamFolderPath(folders, home).some(folder => chosen.has(folder.id));
  });
}

/** Record the dragged items on a drag that starts in this project's grid. */
export function writeTeamDrag(event: DragEvent, projectId: string, items: readonly TeamItemRef[]): void {
  if (!event.dataTransfer || !items.length) return;
  event.dataTransfer.setData(TEAM_ITEMS_MIME, JSON.stringify({ instance: instance(), project: projectId, items: items.map(({ kind, ref }) => ({ kind, ref })) }));
  event.dataTransfer.effectAllowed = 'move';
}

/** The items a drop carries, when the drag came from this project on this instance. */
export function readTeamDrag(event: DragEvent, projectId: string): TeamItemRef[] | null {
  try {
    const value: unknown = JSON.parse(event.dataTransfer?.getData(TEAM_ITEMS_MIME) || 'null');
    if (!isRecord(value) || value.instance !== instance() || value.project !== projectId || !Array.isArray(value.items) || value.items.length > 1000) return null;
    const items = value.items.filter((item): item is TeamItemRef => isRecord(item) && isKind(item.kind) && typeof item.ref === 'string');
    return items.length === value.items.length && items.length ? items : null;
  } catch { return null; }
}

/**
 * Move items into `target` (null: the project root), one acknowledged write each.
 * Items already there count as moved. Resolves how many are now in the target;
 * throws on the first refused write, after which nothing more is sent.
 */
export async function relocateTeamItems(projectId: string, folders: readonly TeamFolder[], items: readonly TeamItemRef[], target: string | null, current: () => boolean): Promise<number> {
  let moved = 0;
  for (const item of topLevelTeamItems(folders, items)) {
    if (!current()) break;
    if (!canMoveTeamItem(folders, item, target)) throw new Error(tRaw('A folder cannot be pasted into itself'));
    if (teamItemFolder(folders, item) !== target) {
      try { await moveTeamItem(projectId, item, target); }
      catch (error) {
        throw moved ? new Error(tRaw('Some items could not be moved. Refresh to check the folder contents.')) : error;
      }
    }
    moved++;
  }
  return moved;
}
