// SPDX-License-Identifier: MPL-2.0
/**
 * The Projects view's door to an instance's team projects (plan 74). Dormant while no
 * session source is registered (lib/session-source.ts), so the public shell never
 * opens this door. The modal, its "New project" form and the open itself live in
 * org/team-projects.ts, loaded on first use, so the Projects chunk carries no
 * control-plane code. Opening a session makes a working copy (createRuntime,
 * serializeUrlState, navigate) that remembers its origin, with no local slot written.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { getSessionSource, takeSourceProjectRequest } from '../lib/session-source.ts';
import type { TeamProjectRef } from '../lib/session-source.ts';
import { folderTile } from '../folder-tiles.ts';
import { tRaw } from '../i18n.ts';
import { tokenize } from '../lib/search/match.ts';
import { buildFolderHaystack, matchesHaystack } from '../lib/search/projects-source.ts';
import { announce } from '../a11y.ts';
import { t } from '../i18n.ts';

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
export function teamProjectTiles(projects: TeamProjectRef[], query = ''): string {
  const tokens = tokenize(query);
  return projects.filter(p => !tokens.length || matchesHaystack(buildFolderHaystack(p.name), tokens)).map(p => folderTile(p, {
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
export function openRequestedTeamProject(door: TeamProjectsDoor): void {
  const projectId = takeSourceProjectRequest();
  if (projectId) window.location.replace(`#/p?team=${encodeURIComponent(projectId)}`);
}
