// SPDX-License-Identifier: MPL-2.0
import { mountModal } from '../components/modal.ts';
import { getInstanceBase } from '../lib/instance.ts';
import { tRaw } from '../i18n.ts';
import type { InvitePolicy } from './team-access.ts';
import { buildPeoplePanel } from './team-people.ts';
import { fetchTeamSession } from './session-source.ts';
import { teamOpenMessage } from './team-open.ts';

let open: HTMLDialogElement | undefined;
/** Manage the current document's people without leaving its live room. */
export async function openSessionPeople(sessionId: string, policy: InvitePolicy | null, isCurrent: () => boolean): Promise<void> {
  if (open?.isConnected) return;
  const base = getInstanceBase(), address = location.href;
  const modal = mountModal('', { className: 'modal team-invite-dialog', ariaLabel: tRaw('People with access'), onClose: () => { open = undefined; } });
  open = modal.el;
  const header = document.createElement('header'); header.className = 'team-project-head';
  const heading = document.createElement('h2'); heading.className = 'modal-title'; heading.textContent = tRaw('People with access');
  const close = document.createElement('button'); close.type = 'button'; close.className = 'btn btn--sm'; close.textContent = tRaw('Close'); close.addEventListener('click', () => modal.close());
  header.append(heading, close);
  const body = document.createElement('div'), loading = document.createElement('p'); loading.textContent = tRaw('Loading…'); body.append(loading);
  modal.el.append(header, body); close.focus();
  const got = await fetchTeamSession(sessionId);
  if (!modal.el.isConnected || !isCurrent() || base !== getInstanceBase() || address !== location.href) { modal.close(); return; }
  if (!got.ok || !got.data.projectId) { loading.textContent = teamOpenMessage(got.ok ? 404 : got.status); return; }
  const people = buildPeoplePanel({ projectId: got.data.projectId, policy });
  // The modal supplies the visible heading; the section retains its accessible label.
  people.querySelector('h3')?.setAttribute('hidden', '');
  body.replaceChildren(people);
}
