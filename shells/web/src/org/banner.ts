// SPDX-License-Identifier: MPL-2.0
/** Workspace messages live in the profile queue. Blocking messages also use the house dialog. */

import { mountModal } from '../components/modal.ts';
import { t } from '../i18n.ts';
import { escape as escapeHtml, safeHref } from '../utils.ts';
import {
  _resetInboxForTests, dismissMessage, inboxMessages, onInboxChange, pickMessage, refreshInbox, sharedProjectOf, startInbox,
  type InboxMessage,
} from './inbox.ts';
import { _clearOpenedProjectsForTests, onProjectOpened } from './opened-projects.ts';

export type { InboxMessage, Severity } from './inbox.ts';

/** The message on screen, and how to take its bar or dialog down without acking
 *  (the message already left the list). */
let current: { m: InboxMessage; takeDown(): void } | null = null;
/** Messages this banner has shown in this tab. Each shows once: one dismissed or
 *  closed by a route change does not come back until the next visit. */
const shown = new Set<string>();
let attached = false;
let detach: (() => void) | null = null;
/**
 * A team project was opened, so every share message about that project is done.
 * The inbox drops and acks them, and a bar showing one of them comes down too. org/inbox.ts acks
 * shares for projects opened before a later fetch on its own.
 */
function acknowledgeProjectOpened(projectId: string): void {
  for (const m of inboxMessages()) if (sharedProjectOf(m) === projectId) dismissMessage(m.id);
}
onProjectOpened(acknowledgeProjectOpened);

/** A CTA link (if the message carries one), styled as a small shell button.
 *  A javascript:/data: url from a compromised control plane is dropped, never
 *  rendered as an anchor - same guard as chrome.ts's link rendering. */
function ctaHtml(m: InboxMessage): string {
  if (!m.cta?.url || !m.cta.label || !safeHref(m.cta.url)) return '';
  // nosemgrep: lolly-href-escape-is-not-scheme-validation - safeHref()-gated in the guard above
  return `<a class="btn btn--sm org-banner-cta" style="min-width:0;max-width:100%;white-space:normal;overflow-wrap:anywhere" href="${escapeHtml(m.cta.url)}">${escapeHtml(m.cta.label)}</a>`;
}

/**
 * Give a collab invite an "Open the collab" action (plan 100 section 7 item 9).
 *
 * Lazy on the message KIND, not just on the banner: a member with an ordinary
 * announcement never fetches the work-collab client, and a member with an invite
 * fetches it exactly once, at the moment the action becomes useful. Everything about
 * the action - parsing the payload, the `collab.join` gate, the join itself and its
 * failure copy - belongs to org/collab-work-opener.ts; this is the insertion point
 * and nothing else. A build without that module (or a member the instance withholds
 * the capability from) renders the message as plain text, which is what it is.
 * The inbox sheet uses the same insertion point for its rows.
 */
export function mountCollabAction(m: InboxMessage, host: Element, before: Element | null): void {
  // The gate has to be at least as WIDE as the parser it delegates to, or the tolerance
  // that parser was written for is unreachable. `readCollabInvite` deliberately accepts
  // EITHER marker - the message's own `kind: 'collab'` and the payload's
  // `data.kind: 'collab-invite'` - "because the server sets both and neither is the
  // documented one on its own". Gating on `kind === 'collab'` alone meant an invite sent
  // (or later re-shaped) as an announcement carrying the documented payload marker never
  // reached the parser at all: the message rendered as plain text, with no button and
  // nothing in the console. The parser is still the decision; this only stops
  // short-circuiting the parser.
  if (!m.data || (m.kind !== 'collab' && m.data.kind !== 'collab-invite')) return;
  void import('./collab-work-opener.ts')
    .then(({ buildCollabInviteAction }) => {
      const action = buildCollabInviteAction(m);
      if (!action || !host.isConnected) return;
      host.insertBefore(action, before);
    })
    .catch(() => { /* additive; the message still reads as text */ });
}

/** Draw blocking messages only; ordinary messages stay in the profile queue. */
function render(msgs: readonly InboxMessage[]): void {
  if (current && !msgs.some(m => m.id === current!.m.id)) {
    const was = current; current = null; was.takeDown();
  }
  if (current) return;
  const next = pickMessage(msgs.filter(m => m.severity === 'blocking' && !shown.has(m.id)));
  if (!next) return;
  shown.add(next.id);
  showBlocking(next);
}

/**
 * Show the inbox here, from now on. Called by org/index.ts after starting the inbox.
 * Calling again does nothing.
 */
export function attachBanner(): void {
  if (attached) return;
  attached = true;
  detach = onInboxChange(render);
  render(inboxMessages());
}

/**
 * Start the inbox and show its most important message. Kept for callers from before
 * org/index.ts: the caller loads the banner beside the inbox.
 */
export async function mountOrgBanner(): Promise<void> {
  attachBanner();
  startInbox({ initialUnread: 1 });
  await refreshInbox();
}

/** blocking - the house modal, Escape-closable; closing it acks. */
function showBlocking(m: InboxMessage): void {
  // Following the message's own action (its link, or a collab's Open) is acting on it,
  // even though the navigation that follows is what closes the dialog.
  let acted = false;
  /** The message left the list while the dialog was open: closed without an ack. */
  let gone = false;
  const content = `
    <h2 class="modal-title">${escapeHtml(m.title)}</h2>
    ${m.body ? `<p class="modal-msg">${escapeHtml(m.body)}</p>` : ''}
    <div class="modal-actions">
      ${ctaHtml(m)}
      <button type="button" class="btn modal-primary" data-act="ok">${escapeHtml(m.cta ? t('Dismiss') : t('Got it'))}</button>
    </div>`;
  const modal = mountModal<boolean>(content, {
    className: 'modal',
    ariaLabel: m.title,
    cancelValue: true,
    initialFocus: (el) => el.querySelector<HTMLElement>('[data-act="ok"]'),
    // Closed by the person (button, Escape, backdrop, Back) or by opening its project:
    // acked, and the app is theirs again. Torn down by a route change (`undefined`,
    // say a link moving on while the inbox loaded): nobody saw the message through,
    // so it is not acked and shows again on the next visit.
    onClose: (closed) => {
      if (current?.m === m) current = null;
      if (!gone && (closed !== undefined || acted)) dismissMessage(m.id);
      // The next message, if any, now that the dialog is out of the way.
      render(inboxMessages());
    },
  });
  current = { m, takeDown: () => { gone = true; modal.close(true); } };
  const actions = modal.el.querySelector('.modal-actions');
  if (actions) mountCollabAction(m, actions, actions.querySelector('[data-act="ok"]'));
  modal.el.addEventListener('click', (e) => {
    if (!(e.target instanceof Element)) return;
    if (e.target.closest('[data-act="ok"]')) { modal.close(true); return; }
    if (e.target.closest('.modal-actions a, .modal-actions button')) acted = true;
  });
}

/** TEST-ONLY: forget what was shown and start the inbox afresh. */
export function _resetBannerForTests(): void {
  detach?.();
  detach = null;
  attached = false;
  current = null;
  shown.clear();
  document.getElementById('org-banner')?.remove();
  _resetInboxForTests();
  _clearOpenedProjectsForTests();
}
