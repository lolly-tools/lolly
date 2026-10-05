// SPDX-License-Identifier: MPL-2.0
import type { CollabSessionHandle } from '../lib/collab-session.ts';
import { edgeDockAvailable, edgeDockCollapsed, isDocked, onDockChange, releaseDock, requestDock } from '../lib/edge-dock.ts';
import { icon } from '../lib/icons.ts';
import { tRaw } from '../i18n.ts';
import { commentIcon } from './tool-comment-chat.ts';
import { mountInviteLinkControl } from '../components/invite-link-control.ts';

/** Keep the live room's controls together as the editor opens and closes its dock. */
export function mountCollabControls(bar: HTMLElement, handle: CollabSessionHandle, reanchor?: () => void): () => void {
  const doc = bar.ownerDocument;
  const stopInvite = handle.inviteLinks && mountInviteLinkControl(bar, handle.inviteLinks);
  const agent = handle.inviteAgent && doc.createElement('button');
  if (agent) {
    agent.type = 'button'; agent.className = 'btn btn--sm'; agent.textContent = tRaw('Invite agent');
    commentIcon(agent, 'Invite agent', 'aiSpark'); agent.title = tRaw('Connect your agent to this document');
    agent.addEventListener('click', handle.inviteAgent!); bar.append(agent);
  }
  const people = handle.people && doc.createElement('button');
  if (people) {
    people.type = 'button'; people.className = 'btn btn--sm';
    people.textContent = tRaw('People'); commentIcon(people, 'People', 'users');
    people.addEventListener('click', handle.people!); bar.append(people);
  }
  const status = handle.saveIn && doc.createElement('span');
  if (status) { status.className = 'collab-save-status'; status.setAttribute('role', 'status'); bar.append(status); }
  const stopSave = handle.saveIn?.subscribe(state => {
    if (!status) return;
    status.textContent = state.message;
    if (state.retry) {
      const retry = doc.createElement('button'); retry.type = 'button'; retry.className = 'btn btn--sm';
      retry.textContent = tRaw('Retry image transfer'); retry.addEventListener('click', state.retry); status.append(retry);
    }
  });
  const sync = (ids: readonly string[]): void => {
    const wanted = edgeDockAvailable() && !edgeDockCollapsed() && ids.some(id => id !== 'zoom' && id !== 'people');
    if (wanted && !isDocked('people')) {
      if (requestDock('people', bar, { compact: true, label: tRaw('People'), icon: icon('users'), onRelease: () => bar.removeAttribute('data-docked') })) bar.setAttribute('data-docked', '');
    } else if (!wanted && isDocked('people')) releaseDock('people', 'host');
    reanchor?.();
  };
  const offDock = onDockChange(sync);
  // Existing full panels may already be mounted when the live room joins.
  sync((['inspector', 'history', 'export', 'share', 'transcript', 'neuro'] as const).filter(isDocked));
  return () => { offDock(); releaseDock('people', 'host'); stopSave?.(); stopInvite?.(); people?.remove(); agent?.remove(); status?.remove(); };
}
