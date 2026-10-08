// SPDX-License-Identifier: MPL-2.0
import './notification-center.css';
import { mountModal, type ModalHandle } from './modal.ts';
import { iconNode } from '../lib/icon-node.ts';
import { t, tRaw } from '../i18n.ts';
import { safeHref } from '../utils.ts';
import { notificationEntries, onNotificationsChange, dismissNotification, delayNotification, restoreNotification, publishNotification, type NotificationEntry } from '../lib/notifications.ts';

let open: ModalHandle<void> | undefined;
function button(label: string, run: () => void): HTMLButtonElement {
  const node = document.createElement('button'); node.type = 'button'; node.className = 'btn btn--sm';
  node.textContent = label; node.addEventListener('click', run); return node;
}

/** One scrollable, accessible queue for shell notices and workspace messages. */
export function openNotifications(returnFocus?: HTMLElement): void {
  if (open) { open.el.querySelector<HTMLElement>('h2')?.focus(); return; }
  let off = () => {};
  const modal = mountModal('', { className: 'modal notification-center', ariaLabel: t('Notifications'),
    onClose: () => { off(); open = undefined; if (returnFocus?.isConnected) returnFocus.focus(); } });
  open = modal;
  const heading = document.createElement('h2'); heading.className = 'modal-title'; heading.tabIndex = -1; heading.textContent = t('Notifications');
  const close = button(t('Close'), () => modal.close()); close.className = 'btn notification-center-close';
  const glyph = iconNode('close'); if (glyph) close.replaceChildren(glyph); close.setAttribute('aria-label', t('Close notifications'));
  const header = document.createElement('header'); header.append(heading, close);
  const tabs = document.createElement('div'); tabs.className = 'notification-center-tabs'; tabs.setAttribute('role', 'group'); tabs.setAttribute('aria-label', t('Notification filter'));
  const list = document.createElement('div'); list.className = 'notification-center-list';
  const empty = document.createElement('p'); empty.textContent = t('No notifications');
  let filter: 'active' | 'later' | 'dismissed' = 'active';
  const filters = new Map<string, HTMLButtonElement>();
  const draw = () => {
    const hadFocus = list.contains(document.activeElement);
    const messages = notificationEntries().filter(entry => filter === 'dismissed' ? entry.dismissed : !entry.dismissed && (filter === 'later' ? !!entry.until : !entry.until));
    filters.forEach((node, key) => { node.setAttribute('aria-pressed', String(filter === key)); });
    list.replaceChildren(...messages.map(entry => row(entry, modal)));
    if (!messages.length) list.append(empty);
    if (hadFocus) (list.querySelector<HTMLElement>('button, a') ?? heading).focus();
  };
  for (const [key, label] of [['active', t('Active')], ['later', t('Later')], ['dismissed', t('Dismissed')]] as const) {
    const node = button(label, () => { filter = key; draw(); }); filters.set(key, node); tabs.append(node);
  }
  modal.el.append(header, tabs, list); off = onNotificationsChange(draw); draw(); heading.focus();
}
function row(entry: NotificationEntry, modal: ModalHandle<void>): HTMLElement {
  const card = document.createElement('article'); card.className = 'notification-card'; card.dataset.notificationId = entry.id;
  card.dataset.tone = entry.tone ?? 'info';
  const title = document.createElement('h3'); title.textContent = entry.title; card.append(title);
  if (entry.body) { const body = document.createElement('p'); body.textContent = entry.body; card.append(body); }
  if (entry.until) { const later = document.createElement('p'); later.textContent = tRaw('Reminder: {time}', { time: new Date(entry.until).toLocaleString() }); card.append(later); }
  const actions = document.createElement('div'); actions.className = 'notification-card-actions';
  if (!entry.dismissed && !entry.until && entry.action) {
    if (entry.action.href && safeHref(entry.action.href)) {
      const link = document.createElement('a'); link.className = 'btn btn--primary btn--sm'; link.textContent = entry.action.label; link.href = entry.action.href;
      link.addEventListener('click', event => { if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; dismissNotification(entry.id); modal.close(); }); actions.append(link);
    } else if (entry.action.run) {
      const act = button(entry.action.label, () => {
        modal.close();
        void Promise.resolve().then(() => entry.action!.run!()).catch(() => {
          publishNotification({ id: `action-error:${entry.id}`, title: t('Could not complete this action'),
            body: t('Try again.'), tone: 'warning', action: entry.action });
          openNotifications();
        });
      }); act.classList.add('btn--primary'); actions.append(act);
    }
    // The second way to act keeps the queue open: it does not lead anywhere.
    const { secondary } = entry;
    if (secondary) actions.append(button(secondary.label, () => {
      void Promise.resolve().then(() => secondary.run()).catch(() => {
        publishNotification({ id: `action-error:${entry.id}`, title: t('Could not complete this action'), body: t('Try again.'), tone: 'warning', action: secondary });
      });
    }));
  }
  if (entry.dismissed || entry.until) actions.append(button(t('Show again'), () => restoreNotification(entry.id)));
  else {
    if (entry.reminder && entry.dismissible !== false) actions.append(button(t('Remind me in 1 hour'), () => delayNotification(entry.id, Date.now() + 3_600_000)));
    if (entry.dismissible !== false) actions.append(button(t('Dismiss'), () => dismissNotification(entry.id)));
  }
  card.append(actions); return card;
}
