// SPDX-License-Identifier: MPL-2.0
import type { CollabSessionHandle } from '../lib/collab-session.ts';
import { edgeDockAvailable, edgeDockCollapsed, isDocked, onDockChange, releaseDock, requestDock } from '../lib/edge-dock.ts';
import { icon } from '../lib/icons.ts';
import { tRaw } from '../i18n.ts';
import { mountBodyPopover } from '../components/body-popover.ts';
import { mountInviteLinkControl } from '../components/invite-link-control.ts';
import { publishNotification } from '../lib/notifications.ts';
import { announce } from '../a11y.ts';

/** The per-device Hide pointers choice. Storage that is unavailable leaves pointers shown. */
const POINTERS_KEY = 'lolly.collab.pointers';
export function pointersHidden(win: Window | null): boolean {
  try { return win?.localStorage.getItem(POINTERS_KEY) === 'hidden'; } catch { return false; }
}
function rememberPointersHidden(win: Window | null, hidden: boolean): void {
  try { if (hidden) win?.localStorage.setItem(POINTERS_KEY, 'hidden'); else win?.localStorage.removeItem(POINTERS_KEY); } catch { /* A device preference is optional. */ }
}

/** Keep the live room's controls together as the editor opens and closes its dock. */
export function mountCollabControls(bar: HTMLElement, handle: CollabSessionHandle, reanchor?: () => void,
  pointers?: { setHidden(hidden: boolean): void }): () => void {
  const doc = bar.ownerDocument;
  const stopInvite = handle.inviteLinks && mountInviteLinkControl(bar, handle.inviteLinks);
  const comments = bar.querySelector<HTMLButtonElement>('.collab-comments-open--docked');
  const storage = doc.createElement('span'); storage.hidden = true;
  const settings = doc.createElement('button');
  settings.type = 'button'; settings.className = 'collab-action collab-settings';
  settings.ariaLabel = settings.dataset.tip = tRaw('Collaboration settings');
  settings.setAttribute('aria-haspopup', 'menu'); settings.setAttribute('aria-expanded', 'false');
  settings.innerHTML = icon('sliders');
  let hidden = pointersHidden(doc.defaultView);
  pointers?.setHidden(hidden);
  const commentLabel = doc.createElement('span'); commentLabel.className = 'collab-settings-label'; commentLabel.textContent = tRaw('Comments');
  if (comments) { comments.insertBefore(commentLabel, comments.querySelector('.collab-comments-badge')); storage.append(comments); bar.append(storage); }
  let menuStatus: HTMLParagraphElement | undefined;
  const menu = mountBodyPopover(settings, (el, popover) => {
    const item = (label: string, glyph: Parameters<typeof icon>[0], action: () => void): HTMLButtonElement => {
      const button = doc.createElement('button'); button.type = 'button';
      button.className = 'profile-menu-item'; button.setAttribute('role', 'menuitem');
      button.innerHTML = icon(glyph);
      const text = doc.createElement('span'); text.textContent = label; button.append(text);
      button.addEventListener('click', () => { popover.close(true); action(); }); el.append(button); return button;
    };
    if (handle.people) item(tRaw('People'), 'users', handle.people);
    if (comments && !comments.hidden) { comments.setAttribute('role', 'menuitem'); el.append(comments); }
    if (handle.inviteAgent) item(tRaw('Invite agent'), 'aiSpark', handle.inviteAgent);
    if (pointers) {
      const toggle = item(tRaw('Show pointers'), 'eye', () => {
        hidden = !hidden; rememberPointersHidden(doc.defaultView, hidden); pointers.setHidden(hidden);
      });
      toggle.setAttribute('role', 'menuitemcheckbox'); toggle.setAttribute('aria-checked', String(!hidden));
      const check = doc.createElement('span'); check.className = 'collab-settings-check'; check.setAttribute('aria-hidden', 'true');
      if (!hidden) check.innerHTML = icon('check'); toggle.append(check);
    }
    if (status) {
      menuStatus = doc.createElement('p'); menuStatus.className = 'collab-settings-status';
      menuStatus.textContent = status.textContent; menuStatus.hidden = !status.textContent; el.append(menuStatus);
    }
    return el.querySelector<HTMLButtonElement>('button');
  }, {
    className: 'profile-menu collab-settings-menu', ariaLabel: tRaw('Collaboration settings'),
    menuNavigation: true, trackScroll: true, trackSize: true,
    onClose() { menuStatus = undefined; if (comments) { storage.append(comments); comments.removeAttribute('role'); } },
  });
  const unread = doc.createElement('span'); unread.className = 'collab-settings-unread'; unread.hidden = true;
  unread.setAttribute('aria-hidden', 'true'); settings.append(unread);
  const syncUnread = (): void => {
    const count = comments?.querySelector('.collab-comments-badge')?.textContent;
    unread.hidden = !count || !!comments?.hidden;
    settings.ariaLabel = settings.dataset.tip = unread.hidden ? tRaw('Collaboration settings')
      : tRaw('Collaboration settings, {count} unread comments', { count: count ?? '' });
  };
  const observer = comments && new doc.defaultView!.MutationObserver(syncUnread);
  observer?.observe(comments!, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['hidden'] });
  syncUnread();
  const onComments = (): void => { menu.close(); };
  comments?.addEventListener('click', onComments, true);
  settings.addEventListener('click', () => { if (menu.isOpen()) menu.close(true); else menu.open(); });
  if (handle.people || handle.inviteAgent || pointers || comments || handle.saveIn) bar.append(settings);
  const status = handle.saveIn && doc.createElement('span');
  if (status) { status.className = 'collab-save-status'; status.setAttribute('role', 'status'); bar.append(status); }
  let clearNotice: (() => void) | undefined;
  let failed = false;
  let noticeId = '';
  const stopSave = handle.saveIn?.subscribe(state => {
    if (!status) return;
    status.textContent = state.retry ? '' : state.message;
    if (menuStatus) { menuStatus.textContent = status.textContent; menuStatus.hidden = !status.textContent; }
    status.dataset.tip = status.textContent;
    status.setAttribute('aria-label', status.textContent);
    if (state.retry) {
      if (!failed) { noticeId = `collab-image-transfer:${crypto.randomUUID()}`; announce(state.message); }
      failed = true; clearNotice?.();
      clearNotice = publishNotification({ id: noticeId, title: tRaw('Image transfer failed'), body: state.message,
        tone: 'warning', action: { label: tRaw('Retry image transfer'), run: state.retry } });
    } else { failed = false; clearNotice?.(); clearNotice = undefined; }
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
  return () => { offDock(); releaseDock('people', 'host'); stopSave?.(); clearNotice?.(); stopInvite?.(); menu.close(); observer?.disconnect(); settings.remove();
    comments?.removeEventListener('click', onComments, true); commentLabel.remove();
    if (comments) bar.append(comments); storage.remove(); status?.remove(); };
}
