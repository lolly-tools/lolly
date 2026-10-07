// SPDX-License-Identifier: MPL-2.0
/**
 * The Projects view's door to an instance's team projects (plan 74). Dormant while no
 * session source is registered (lib/session-source.ts), so the public shell never
 * opens this door. Shared folders mount inside Projects; their forms and previews
 * load on demand. Opening a session remembers its origin without creating a local slot.
 */
import type { AssetRef, HostV1 } from '@lolly-tools/core/host-v1';
import { mountAssetPreview } from './asset-preview.ts';
import { getSessionSource, readSourceProjects, takeSourceProjectRequest } from '../lib/session-source.ts';
import type { TeamProjectRef } from '../lib/session-source.ts';
import { splitOwnProjects } from '../lib/team-project-listing.ts';
import { folderTile } from '../folder-tiles.ts';
import { tRaw } from '../i18n.ts';
import { tokenize } from '../lib/search/match.ts';
import { buildFolderHaystack, matchesHaystack } from '../lib/search/projects-source.ts';
import { announce } from '../a11y.ts';
import { t } from '../i18n.ts';
import { actionButtonContent } from '../components/action-button.ts';
import { escape as escapeHtml } from '../utils.ts';
import type { Folder } from '../folders.ts';
import { getInstanceBase } from '../lib/instance.ts';

/** What the Projects view hands in: the things it owns. */
export interface TeamProjectsDoor {
  host: HostV1;
  /** The view's display name for a tool id. */
  toolName: (toolId: string) => string;
  /** Arms the view's back-to-Projects return before an open navigates. */
  beforeNavigate: () => void;
  /** False once the view is gone, so a slow load opens nothing over the next view. */
  isMounted: () => boolean;
  refresh?: () => void;
  tools?: Array<{ id: string; name: string }>;
}

/** What a shared project tile says it is: a project shared with everyone on the
 *  workspace, one an admin can open, or a project the person belongs to. */
function sharedSubtitle(p: TeamProjectRef): string {
  return p.via === 'everyone' ? tRaw('Shared with everyone') : p.via === 'admin' ? tRaw('Workspace project') : tRaw('Shared project');
}

/** Shared folders use the local folder component, with a people glyph and source label. */
export function teamProjectTiles(projects: TeamProjectRef[], query = '', sort = 'modified', reversed = false): string {
  const tokens = tokenize(query);
  const sorted = [...projects].sort((a, b) => (reversed ? -1 : 1) * (sort === 'name' ? a.name.localeCompare(b.name) : sort === 'size' ? (b.sessionCount ?? 0) - (a.sessionCount ?? 0) : ((sort === 'added' ? b.createdAt : b.updatedAt) || '').localeCompare((sort === 'added' ? a.createdAt : a.updatedAt) || '')));
  return sorted.filter(p => !tokens.length || matchesHaystack(buildFolderHaystack(p.name), tokens)).map(p => folderTile(p, {
    count: p.sessionCount ?? 0,
    href: `#/p?team=${encodeURIComponent(p.id)}`,
    shared: { openLabel: tRaw('Open shared project {name}', { name: p.name }),
      subtitle: sharedSubtitle(p), activity: p.sessionCount === 1 ? tRaw('1 session') : tRaw('{n} sessions', { n: p.sessionCount ?? 0 }) },
  })).join('');
}

/** Navigate to a shared folder inside Projects. */
export function openTeamProjects(door: TeamProjectsDoor, projectId?: string, create = false): void {
  if (!getSessionSource()) return;
  if (!door.isMounted()) return;
  window.location.hash = create ? '#/p?create=team' : projectId ? `#/p?team=${encodeURIComponent(projectId)}` : '#/p';
}

export async function mountTeamProjectFolder(door: TeamProjectsDoor, container: HTMLElement, opts: { projectId: string; create: boolean; tab: string; fileId?: string; query: string; list: boolean; sort: string; reversed: boolean; assetId?: string; folderId?: string }): Promise<() => void> {
  try {
    const module = await import('../org/team-project-view.ts');
    const { prepareProjectAsset, projectAssetHref } = await import('../org/team-project-assets.ts');
    if (!door.isMounted() || !container.isConnected) return () => {};
    return module.mountTeamProjectView(container, { ...door, ...opts, assetPreview(projectId, file) {
      const link = (ref: AssetRef) => projectAssetHref(projectId, ref.id);
      return { link, open: onClose => mountAssetPreview(door.host, () => prepareProjectAsset(projectId, file), { link, onClose }) };
    } });
  } catch (error) {
    door.host.log?.('warn', 'projects: shared folder failed to load', { error: String(error) });
    if (container.isConnected) container.textContent = t('Team projects could not be opened.');
    announce(t('Team projects could not be opened.'));
    return () => {};
  }
}

/** Open the project a team project link asked for (org/team-project-link.ts), if one did. */
export function openRequestedTeamProject(_door: TeamProjectsDoor): void {
  const projectId = takeSourceProjectRequest();
  if (projectId) window.location.replace(`#/p?team=${encodeURIComponent(projectId)}`);
}

/** Shared folder lifecycle, kept separate from the local folder manager. */
export function createSharedProjectsView(door: TeamProjectsDoor, view: HTMLElement, params: string, changed: () => void) {
  const query = new URLSearchParams(params);
  const projectId = query.get('team') || '', create = query.get('create') === 'team', active = !!projectId || create;
  let projects: TeamProjectRef[] = [], state: 'loading' | 'ready' | 'error' = 'loading', read = 0, generation = 0;
  let clearFolder: (() => void) | undefined, clearPreviews: (() => void) | undefined, clearMenus: (() => void) | undefined;
  let localFolders: readonly Folder[] = [];
  const here = () => getInstanceBase() || location.origin;
  // A local folder stands for a shared project when it was shared from this device
  // (teamCopy) or is a shortcut to one (link, lolly plan 299).
  const linked = (folder: Folder) => folder.teamCopy?.complete && folder.teamCopy.instance === here()
    ? projects.find(project => project.id === folder.teamCopy!.projectId)
    : folder.link && folder.link.instance === here() ? projects.find(project => project.id === folder.link!.projectId) : undefined;
  /** Projects already drawn among the local folders at the top level, so the shared
   *  section does not show them twice. A shortcut inside a subfolder stays there. */
  const drawnLocally = () => new Set(localFolders.filter(folder => folder.teamCopy || !folder.parentId).map(linked).filter(Boolean).map(project => project!.id));
  async function refresh(): Promise<void> {
    const source = getSessionSource(), ticket = ++read;
    if (!source || !door.isMounted() || active) return;
    const got = await readSourceProjects(source);
    if (!door.isMounted() || ticket !== read || source !== getSessionSource()) return;
    const previous = state, next = got.ok ? got.items : []; state = got.ok ? 'ready' : 'error';
    if (previous === 'ready' && state === 'ready' && JSON.stringify(next) === JSON.stringify(projects) && view.querySelector('.projects-shared')) return;
    projects = next; changed();
  }
  const focused = () => { if (document.visibilityState === 'visible') void refresh(); };
  window.addEventListener('focus', focused);
  const timer = window.setInterval(focused, 60_000);
  function beforeRender(): void { ++generation; clearFolder?.(); clearPreviews?.(); clearMenus?.(); clearFolder = clearPreviews = clearMenus = undefined; }
  return {
    projectId, active, create, refresh, beforeRender,
    createFolder(): void { view.querySelector('[data-shared-folder]')?.dispatchEvent(new CustomEvent('lolly:team-folder-create')); },
    folders(items: readonly Folder[]): void { localFolders = items; },
    async shareFolder(id: string): Promise<void> {
      const module = await import('../org/team-folder-share.ts');
      if (door.isMounted()) await module.shareLocalFolder(door.host as Parameters<typeof module.shareLocalFolder>[0], id, view.querySelector<HTMLElement>('.projects') || view, door.isMounted);
    },
    folderTile(folder: Folder, opts: Parameters<typeof folderTile>[1]): string {
      const project = linked(folder);
      const inside = folder.link?.folderId ? `&folder=${encodeURIComponent(folder.link.folderId)}` : '';
      return project ? folderTile({ ...folder, ...project, ...(folder.link ? { name: folder.name } : {}) }, { ...opts, selectable: false, href: `#/p?team=${encodeURIComponent(project.id)}${inside}`,
        shared: { subtitle: folder.link ? tRaw('Shortcut') : sharedSubtitle(project), activity: project.sessionCount === 1 ? tRaw('1 session') : tRaw('{n} sessions', { n: project.sessionCount ?? 0 }), openLabel: tRaw('Open shared project {name}', { name: project.name }) } }) : folderTile(folder, opts);
    },
    rootHtml(filter: string, list: boolean, head: string, size: string, sort: string, reversed: boolean): string {
      const source = getSessionSource(); if (!source) return '';
      const copied = drawnLocally();
      // Only the person's own shared projects are listed (lolly plan 299 section 6);
      // a search reaches every project they can open, and Browse lists the rest.
      const pool = projects.filter(project => !copied.has(project.id));
      const { own, other } = splitOwnProjects(pool);
      const tiles = teamProjectTiles(filter ? pool : own, filter, sort, reversed);
      const browse = other.length ? `<button type="button" class="btn btn--labelled btn--ghost" data-browse-team>${actionButtonContent(tRaw('Browse {n} more', { n: other.length }), 'search')}</button>` : '';
      const message = state === 'error' ? t('Shared projects could not be loaded. Try again.') : state === 'loading' ? t('Loading shared projects…')
        : filter ? t('No shared projects match your search.') : other.length ? t('Projects you belong to, add or open appear here.') : t('Create a team project or ask a teammate to add you.');
      return `<section class="projects-shared" aria-label="${escapeHtml(tRaw('Shared projects'))}"><div class="projects-shared-head"><div><h2>${t('Shared projects')}</h2><p>${escapeHtml(source.label)}</p></div>
        <div class="team-project-actions">${browse}<button type="button" class="btn btn--labelled btn--ghost" data-refresh-team>${actionButtonContent(tRaw('Refresh'), 'refresh')}</button></div></div>
        ${tiles ? `<div class="folder-grid projects-grid${list ? ' projects-list' : ''}"${size}>${list ? head : ''}${tiles}</div>` : `<p class="projects-shared-status" role="status">${message}</p>`}</section>`;
    },
    afterRender(opts: { query: string; list: boolean; sort: string; reversed: boolean }): void {
      const ticket = generation, source = getSessionSource();
      if (active) {
        const slot = view.querySelector<HTMLElement>('[data-shared-folder]'); if (!slot) return;
        void mountTeamProjectFolder(door, slot, { ...opts, projectId, create, tab: query.get('tab') || 'sessions', assetId: query.get('asset') || undefined, folderId: query.get('folder') || undefined, fileId: query.get('file') || undefined }).then(clear => {
          if (!door.isMounted() || ticket !== generation || !slot.isConnected) clear(); else clearFolder = clear;
        });
      } else if (source) void Promise.all([import('../org/team-previews.ts'), import('../org/project-sharing.ts')]).then(([module, sharing]) => {
        if (door.isMounted() && ticket === generation && source === getSessionSource()) {
          const current = () => door.isMounted() && ticket === generation && source === getSessionSource();
          clearPreviews = module.hydrateSharedPreviews(view, source, door.host, current);
          const backups = new Map(localFolders.flatMap(folder => folder.teamCopy && linked(folder) ? [[folder.teamCopy.projectId, folder.id] as const] : []));
          const shortcuts = new Map(localFolders.flatMap(folder => folder.link && linked(folder) ? [[folder.link.projectId, folder.id] as const] : []));
          const stopMenus = sharing.mountSharedProjectMenus(view, projects, current, () => { void refresh(); door.refresh?.(); }, backups, { host: door.host, shortcuts });
          const browse = (event: Event) => {
            if (!(event.target as Element).closest('[data-browse-team]')) return;
            const { other } = splitOwnProjects(projects.filter(project => !drawnLocally().has(project.id)));
            void import('../org/project-browse-sheet.ts').then(sheet => sheet.openProjectBrowse({
              projects: other, workspace: source.label,
              setListing: (id, listed) => source.setProjectListing?.(id, listed) ?? Promise.resolve(false),
              onChanged: () => { void refresh(); },
            }));
          };
          view.addEventListener('click', browse);
          clearMenus = () => { stopMenus(); view.removeEventListener('click', browse); };
        }
      }).catch(error => door.host.log?.('warn', 'projects: shared previews could not load', { error: String(error) }));
    },
    dispose(): void { beforeRender(); ++read; window.removeEventListener('focus', focused); window.clearInterval(timer); },
  };
}
