// SPDX-License-Identifier: MPL-2.0
import type { CollabInviteLinks } from '../lib/collab-session.ts';
import { copyText } from '../lib/copy-text.ts';
import { icon } from '../lib/icons.ts';
import { tRaw } from '../i18n.ts';
import { announce } from '../a11y.ts';
import './invite-link-control.css';

/** A role picker and copy action, usable in the live room or a project's People panel. */
export function mountInviteLinkControl(host: HTMLElement, capability: CollabInviteLinks): () => void {
  const doc = host.ownerDocument, row = doc.createElement('span'); row.className = 'invite-link-control'; row.hidden = true;
  const role = doc.createElement('select'); role.className = 'field-select invite-link-role'; role.ariaLabel = tRaw('Role');
  const copy = doc.createElement('button'); copy.type = 'button'; copy.className = 'btn btn--sm invite-link-copy';
  copy.title = copy.ariaLabel = tRaw('Copy invite link');
  // Fixed registry markup; no name, URL or response text enters this sink.
  copy.innerHTML = icon('link', { size: 18 });
  const label = doc.createElement('span'); label.className = 'visually-hidden'; label.textContent = tRaw('Copy invite link'); copy.append(label);
  const fallback = doc.createElement('input'); fallback.className = 'field-input invite-link-fallback'; fallback.readOnly = true; fallback.hidden = true; fallback.ariaLabel = tRaw('Copy invite link');
  const status = doc.createElement('span'); status.className = 'invite-link-status'; status.setAttribute('role', 'status');
  row.append(role, copy, fallback, status); host.append(row);
  let disposed = false, busy = false;
  async function refresh(): Promise<void> {
    const roles = await capability.roles(); if (disposed) return;
    const selected = role.value; role.replaceChildren();
    for (const value of roles) { const option = doc.createElement('option'); option.value = value; option.textContent = tRaw(value === 'editor' ? 'Editor' : 'Viewer'); role.append(option); }
    if (roles.includes(selected as 'editor' | 'viewer')) role.value = selected;
    row.hidden = roles.length === 0;
  }
  const onCopy = async (): Promise<void> => {
    if (busy || disposed) return; busy = true; copy.disabled = role.disabled = true; status.textContent = ''; fallback.hidden = true;
    try {
      const value = role.value; if (value !== 'editor' && value !== 'viewer') return;
      const link = await capability.create(value); if (disposed) return;
      const copied = await copyText(link.url); if (disposed) return;
      if (copied) { status.textContent = tRaw('Link copied'); announce(status.textContent); }
      else { fallback.value = link.url; fallback.hidden = false; fallback.focus(); fallback.select(); status.textContent = tRaw('Could not copy link'); }
    } catch {
      if (!disposed) { status.textContent = tRaw('Could not create the link. Try again.'); void refresh().catch(() => { row.hidden = true; }); }
    } finally { busy = false; if (!disposed) copy.disabled = role.disabled = false; }
  };
  role.addEventListener('change', () => { status.textContent = ''; fallback.hidden = true; });
  copy.addEventListener('click', onCopy);
  void refresh().catch(() => { row.hidden = true; });
  return () => { disposed = true; copy.removeEventListener('click', onCopy); row.remove(); };
}
