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
}

/** Open the Team projects modal, straight on one project's sessions when `projectId` is given. */
export function openTeamProjects(door: TeamProjectsDoor, projectId?: string): void {
  if (!getSessionSource()) return;
  import('../org/team-projects.ts')
    .then((m) => {
      if (!door.isMounted()) return;
      m.openTeamProjectsModal({ host: door.host, toolName: door.toolName, beforeNavigate: door.beforeNavigate, ...(projectId ? { initialProject: { id: projectId } } : {}) });
    })
    .catch((err) => {
      door.host.log?.('warn', 'projects: team projects failed to load', { error: String(err) });
      announce(t('Team projects could not be opened.'));
    });
}

/** Open the project a team project link asked for (org/team-project-link.ts), if one did. */
export function openRequestedTeamProject(door: TeamProjectsDoor): void {
  const projectId = takeSourceProjectRequest();
  if (projectId) openTeamProjects(door, projectId);
}
