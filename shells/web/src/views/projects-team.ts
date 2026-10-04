// SPDX-License-Identifier: MPL-2.0
/**
 * The Projects view's door to an instance's team projects (plan 74). Dormant while no
 * session source is registered (lib/session-source.ts), so the public shell never
 * opens this door. Shared folders mount inside Projects; their forms and previews
 * load on demand. Opening a session remembers its origin without creating a local slot.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { getSessionSource, readSourceProjects, takeSourceProjectRequest } from '../lib/session-source.ts';
import type { TeamProjectRef } from '../lib/session-source.ts';
import { folderTile } from '../folder-tiles.ts';
import { tRaw } from '../i18n.ts';
import { tokenize } from '../lib/search/match.ts';
import { buildFolderHaystack, matchesHaystack } from '../lib/search/projects-source.ts';
import { announce } from '../a11y.ts';
import { t } from '../i18n.ts';
import { icon } from '../lib/icons.ts';
import { escape as escapeHtml } from '../utils.ts';

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

/** Shared folders use the local folder component, with a people glyph and source label. */
export function teamProjectTiles(projects: TeamProjectRef[], query = '', sort = 'modified', reversed = false): string {
  const tokens = tokenize(query);
  const sorted = [...projects].sort((a, b) => (reversed ? -1 : 1) * (sort === 'name' ? a.name.localeCompare(b.name) : sort === 'size' ? (b.sessionCount ?? 0) - (a.sessionCount ?? 0) : ((sort === 'added' ? b.createdAt : b.updatedAt) || '').localeCompare((sort === 'added' ? a.createdAt : a.updatedAt) || '')));
  return sorted.filter(p => !tokens.length || matchesHaystack(buildFolderHaystack(p.name), tokens)).map(p => folderTile(p, {
    count: p.sessionCount ?? 0,
    href: `#/p?team=${encodeURIComponent(p.id)}`,
    shared: { openLabel: tRaw('Open shared project {name}', { name: p.name }),
      subtitle: tRaw('Shared project'), activity: p.sessionCount === 1 ? tRaw('1 session') : tRaw('{n} sessions', { n: p.sessionCount ?? 0 }) },
  })).join('');
}

/** Navigate to a shared folder inside Projects. */
export function openTeamProjects(door: TeamProjectsDoor, projectId?: string, create = false): void {
  if (!getSessionSource()) return;
  if (!door.isMounted()) return;
  window.location.hash = create ? '#/p?create=team' : projectId ? `#/p?team=${encodeURIComponent(projectId)}` : '#/p';
}

export async function mountTeamProjectFolder(door: TeamProjectsDoor, container: HTMLElement, opts: { projectId: string; create: boolean; tab: string; query: string; list: boolean; sort: string; reversed: boolean }): Promise<() => void> {
  try {
    const module = await import('../org/team-project-view.ts');
    if (!door.isMounted() || !container.isConnected) return () => {};
    return module.mountTeamProjectView(container, { ...door, ...opts });
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
  let clearFolder: (() => void) | undefined, clearPreviews: (() => void) | undefined;
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
  function beforeRender(): void { ++generation; clearFolder?.(); clearPreviews?.(); clearFolder = clearPreviews = undefined; }
  return {
    projectId, active, create, refresh, beforeRender,
    rootHtml(filter: string, list: boolean, head: string, size: string, sort: string, reversed: boolean): string {
      const source = getSessionSource(); if (!source) return '';
      const tiles = teamProjectTiles(projects, filter, sort, reversed);
      const message = state === 'error' ? t('Shared projects could not be loaded. Try again.') : state === 'loading' ? t('Loading shared projects…')
        : filter ? t('No shared projects match your search.') : t('Create a team project or ask a teammate to add you.');
      return `<section class="projects-shared" aria-label="${escapeHtml(tRaw('Shared projects'))}"><div class="projects-shared-head"><div><h2>${t('Shared projects')}</h2><p>${escapeHtml(source.label)}</p></div>
        <button type="button" class="btn btn--sm btn--ghost" data-refresh-team>${icon('refresh')}${t('Refresh')}</button></div>
        ${tiles ? `<div class="folder-grid projects-grid${list ? ' projects-list' : ''}"${size}>${list ? head : ''}${tiles}</div>` : `<p class="projects-shared-status" role="status">${message}</p>`}</section>`;
    },
    afterRender(opts: { query: string; list: boolean; sort: string; reversed: boolean }): void {
      const ticket = generation, source = getSessionSource();
      if (active) {
        const slot = view.querySelector<HTMLElement>('[data-shared-folder]'); if (!slot) return;
        void mountTeamProjectFolder(door, slot, { ...opts, projectId, create, tab: query.get('tab') || 'sessions' }).then(clear => {
          if (!door.isMounted() || ticket !== generation || !slot.isConnected) clear(); else clearFolder = clear;
        });
      } else if (source) void import('../org/team-previews.ts').then(module => {
        if (door.isMounted() && ticket === generation && source === getSessionSource()) clearPreviews = module.hydrateSharedPreviews(view, source, door.host, () => door.isMounted() && ticket === generation);
      }).catch(error => door.host.log?.('warn', 'projects: shared previews could not load', { error: String(error) }));
    },
    dispose(): void { beforeRender(); ++read; window.removeEventListener('focus', focused); window.clearInterval(timer); },
  };
}
