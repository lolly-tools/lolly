// SPDX-License-Identifier: MPL-2.0
import type { TeamProjectRef } from '../lib/session-source.ts';
import { menuItemHtml, wireTileContextMenu } from '../lib/context-menu.ts';
import { icon } from '../lib/icons.ts';
import { mountBodyPopover, type BodyPopoverHandle } from '../components/body-popover.ts';
import { mountInviteLinkControl } from '../components/invite-link-control.ts';
import { promptDialog } from '../components/confirm-dialog.ts';
import { copyText } from '../lib/copy-text.ts';
import { announce } from '../a11y.ts';
import { tRaw } from '../i18n.ts';
import { orgConfig } from './index.ts';
import { invitePolicy, isManagerPlus } from './team-access.ts';
import { projectInviteLinks } from './project-invite-links.ts';
import { renameTeamProject, teamProjectLinkUrl } from './project-members.ts';

/** A small standard popover keeps the invitation role beside its copy action. */
export function showProjectInviteLink(anchor: HTMLElement, projectId: string, current: () => boolean, sessionId?: string): BodyPopoverHandle {
  let clear: (() => void) | undefined;
  const popover = mountBodyPopover(anchor, panel => {
    const heading = document.createElement('p'); heading.className = 'folder-menu-head'; heading.textContent = tRaw('Copy invite link'); panel.append(heading);
    clear = mountInviteLinkControl(panel, projectInviteLinks(projectId, invitePolicy(orgConfig()), current, sessionId));
  }, { className: 'folder-menu project-invite-popover', role: 'group', ariaLabel: tRaw('Copy invite link'), trackSize: true, onClose: () => { clear?.(); clear = undefined; } });
  popover.open(); return popover;
}

/** Shared folders offer the same right-click and touch actions as local folders. */
export function mountSharedProjectMenus(host: HTMLElement, projects: readonly TeamProjectRef[], current: () => boolean, refresh: () => void, localCopies: ReadonlyMap<string, string> = new Map()): () => void {
  let invitation: BodyPopoverHandle | undefined;
  const find = (id: string) => projects.find(project => project.id === id);
  const menu = wireTileContextMenu({ host, tileSelector: '.folder-tile[data-kind="team-project"]', refOf: tile => tile.dataset.ref ?? null,
    singleHtml: target => {
      const project = find(target.ref); if (!project) return '';
      return menuItemHtml('open', icon('folder'), tRaw('Open'))
        + (isManagerPlus(project.myRole) ? menuItemHtml('share', icon('users'), tRaw('Share')) + menuItemHtml('invite', icon('link'), tRaw('Copy invite link')) : '')
        + menuItemHtml('copy', icon('link'), tRaw('Copy project link'))
        + (localCopies.has(project.id) ? menuItemHtml('local', icon('folder'), tRaw('Open local copy')) : '')
        + (isManagerPlus(project.myRole) ? menuItemHtml('rename', icon('pen'), tRaw('Rename folder')) : '');
    },
    onAction: (action, target) => { if (target) void act(action, target.ref, target.tile); },
    className: 'folder-menu projects-menu', presentation: 'sheet', head: target => ({ name: find(target?.ref ?? '')?.name || tRaw('Shared project') }),
  });
  const click = (event: MouseEvent) => {
    const button = (event.target as Element).closest<HTMLElement>('.folder-tile[data-kind="team-project"] .tile-menu-btn'); if (!button) return;
    event.preventDefault(); event.stopPropagation(); const tile = button.closest<HTMLElement>('.folder-tile')!, rect = button.getBoundingClientRect();
    menu.openAt(rect.right, rect.bottom, { ref: tile.dataset.ref!, tile }, button);
  };
  host.addEventListener('click', click);
  async function act(action: string, id: string, tile: HTMLElement | null): Promise<void> {
    const project = find(id); if (!project || !current()) return;
    if (action === 'local' && localCopies.has(id)) { window.location.hash = `#/p/${encodeURIComponent(localCopies.get(id)!)}`; return; }
    if (action === 'open' || action === 'share') { window.location.hash = `#/p?team=${encodeURIComponent(id)}${action === 'share' ? '&tab=people' : ''}`; return; }
    if (action === 'invite' && tile && isManagerPlus(project.myRole)) { invitation?.close(); invitation = showProjectInviteLink(tile.querySelector<HTMLElement>('.tile-menu-btn') || tile, id, current); return; }
    if (action === 'copy') { const copied = await copyText(teamProjectLinkUrl(id)); if (current()) announce(tRaw(copied ? 'Link copied' : 'Could not copy. Try again.')); return; }
    if (action !== 'rename' || !isManagerPlus(project.myRole)) return;
    const name = await promptDialog({ title: tRaw('Rename shared project'), message: tRaw('Project name'), value: project.name, confirmLabel: tRaw('Save') });
    if (!current() || !name?.trim() || name.trim() === project.name) return;
    const result = await renameTeamProject(id, name.trim().slice(0, 200)); if (!current()) return;
    if (result.ok) refresh(); else announce(tRaw('Could not rename this project. Refresh and try again.'));
  }
  return () => { host.removeEventListener('click', click); menu.destroy(); invitation?.close(); };
}
