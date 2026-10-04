// SPDX-License-Identifier: MPL-2.0
/**
 * org/banner - show a member's inbox one message at a time, above the app.
 *
 * The list itself lives in org/inbox.ts, which keeps the list current and loads this
 * module too (org/index.ts starts the inbox for members only, so a plain deployment
 * never touches this file). The banner shows the most important message not shown yet
 * (blocking, then action, then info). Dismissing it acks it through the inbox and the
 * next message takes its place; a message that leaves the list another way (the inbox
 * sheet, a request answered elsewhere) takes its bar down too. With more than one
 * message, the bar offers View all, which opens org/inbox-sheet.ts.
 *
 * A "<person> shared <project> with you" message (`data.kind: 'project-share'`) has
 * done its job once that project is open, however the person got there (the
 * banner's Open, the invite link or the Team projects list), so opening the
 * project acks it too. The openers report the opening to org/opened-projects.ts and
 * this module listens there, so no opener imports this one.
 *
 * Presentation follows the message's severity but never obstructs the app:
 *   - info / action → a slim, dismissible bar pinned above the app content
 *     (inserted into #app before #view, so the bar stays through view navigation).
 *     Both are `role="status"`.
 *   - blocking → the house modal primitive (Escape-closable per the app-wide
 *     convention). A speed-bump, not a lock: closing the dialog (button OR Escape)
 *     acks the message and hands control straight back to the app.
 */

import { mountModal } from '../components/modal.ts';
import { t, tRaw } from '../i18n.ts';
import { escape as escapeHtml, safeHref } from '../utils.ts';
import {
  _resetInboxForTests, dismissMessage, inboxMessages, onInboxChange, pickMessage, refreshInbox, sharedProjectOf, startInbox,
  type InboxMessage,
} from './inbox.ts';
import { _clearOpenedProjectsForTests, onProjectOpened } from './opened-projects.ts';

export type { InboxMessage, Severity } from './inbox.ts';

/** The message on screen, and how to take its bar or dialog down without acking
 *  (the message already left the list). */
let current: { m: InboxMessage; takeDown(): void; setCount(n: number): void } | null = null;
/** Messages this banner has shown in this tab. Each shows once: one dismissed or
 *  closed by a route change does not come back until the next visit. */
const shown = new Set<string>();
let attached = false;
let detach: (() => void) | null = null;
/** The person dismissed the last bar from the keyboard or pointer: the next bar takes
 *  focus, so the next Tab does not start again from the top of the page. */
let focusNext = false;

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
  return `<a class="btn btn--sm org-banner-cta" href="${escapeHtml(m.cta.url)}">${escapeHtml(m.cta.label)}</a>`;
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

/** Open the inbox sheet. Lazy: most visits never open the sheet. */
function openSheet(): void {
  void import('./inbox-sheet.ts')
    .then((m) => m.openInboxSheet())
    .catch(() => { /* the bar still shows one message at a time */ });
}

/** Draw from the list: take down a message that left the list, then show the next
 *  one not shown yet when nothing is on screen. */
function render(msgs: readonly InboxMessage[]): void {
  if (current && !msgs.some((m) => m.id === current!.m.id)) {
    // Cleared before the take-down: closing a dialog draws the next message itself.
    const was = current;
    current = null;
    was.takeDown();
  }
  if (current) { current.setCount(msgs.length); return; }
  const next = pickMessage(msgs.filter((m) => !shown.has(m.id)));
  if (!next) { focusNext = false; return; }
  if (next.severity === 'blocking') showBlocking(next);
  else if (!showBar(next, msgs.length)) return;
  shown.add(next.id);
}

/**
 * Show the inbox here, from now on. Called by org/inbox.ts when the inbox starts.
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
 * org/inbox.ts: the inbox now loads the banner itself.
 */
export async function mountOrgBanner(): Promise<void> {
  attachBanner();
  startInbox({ initialUnread: 1 });
  await refreshInbox();
}

/** info / action - a slim dismissible bar above the app. False when there is no app
 *  to sit above yet: the message stays in the list, unacked and not yet shown. */
function showBar(m: InboxMessage, count: number): boolean {
  const app = document.getElementById('app');
  const view = document.getElementById('view');
  if (!app) return false;
  document.getElementById('org-banner')?.remove();

  const bar = document.createElement('div');
  bar.id = 'org-banner';
  bar.className = `org-banner org-banner--${escapeHtml(m.severity)}`;
  bar.setAttribute('role', 'status');
  // Theme-aware, self-contained styling - no stylesheet touch for this additive
  // seam. An `action` message leans on the brand accent, `info` on muted chrome.
  const accent = m.severity === 'action' ? 'var(--primary)' : 'var(--muted-foreground)';
  // The views float their top-row controls (navigation, filter, Settings) over the top
  // of the page, at every width. The bar's tint runs under them, and its message sits
  // in a row below them (the same clearance the views' own content uses), so the
  // controls never cover its action or its dismiss button.
  bar.style.cssText = `display:flex;align-items:center;gap:.75rem;padding:calc(var(--chrome-top, .5rem) + var(--chrome-h, 2.6rem) + .5rem) .5rem .5rem 1rem;font-size:var(--fs-lg);line-height:1.4;border-bottom:1px solid hsl(var(--border));background:hsl(${accent} / .08);color:hsl(var(--foreground))`;

  const body = m.body ? ` <span style="color:hsl(var(--muted-foreground))">${escapeHtml(m.body)}</span>` : '';
  // The message and its action wrap together, the action right after the words (never
  // pushed to the far edge), and the dismiss control keeps its place at the end of the
  // first line at every width.
  bar.innerHTML = `
    <span style="flex:0 0 auto;width:.5rem;height:.5rem;border-radius:50%;background:hsl(${accent})" aria-hidden="true"></span>
    <span class="org-banner-message" style="flex:1 1 auto;min-width:0;display:flex;flex-wrap:wrap;align-items:center;gap:.35rem .75rem"><span style="min-width:0"><strong style="font-weight:650">${escapeHtml(m.title)}</strong>${body}</span>${ctaHtml(m)}</span>
    ${m.dismissible ? `<button type="button" class="org-banner-dismiss" aria-label="${escapeHtml(t('Dismiss'))}" style="flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:var(--ui-size-target);height:var(--ui-size-target);border:0;border-radius:var(--radius);background:transparent;color:inherit;cursor:pointer;font-size:1.3rem;line-height:1;opacity:.7">&times;</button>` : ''}`;

  app.insertBefore(bar, view ?? null);
  const message = bar.querySelector('.org-banner-message') ?? bar;
  // Inside the message, after its words, so the action reads as part of the message
  // rather than as something past the way to close the bar.
  mountCollabAction(m, message, null);

  // View all, after the message's own action: present while the list holds more than
  // the message on screen, with the count kept current as the list changes.
  let all: HTMLButtonElement | null = null;
  const setCount = (n: number): void => {
    if (n <= 1) { all?.remove(); all = null; return; }
    if (!all) {
      all = document.createElement('button');
      all.type = 'button';
      all.className = 'btn btn--sm org-banner-all';
      all.style.minHeight = 'var(--ui-size-target)';
      all.addEventListener('click', openSheet);
      message.append(all);
    }
    all.textContent = tRaw('View all ({n})', { n: String(n) });
  };
  setCount(count);

  current = { m, takeDown: () => bar.remove(), setCount };
  const dismiss = bar.querySelector<HTMLButtonElement>('.org-banner-dismiss');
  dismiss?.addEventListener('click', () => {
    focusNext = true;
    dismissMessage(m.id);
  });
  if (focusNext) {
    focusNext = false;
    (dismiss ?? all ?? bar.querySelector<HTMLElement>('a, button'))?.focus();
  }
  return true;
}

/** blocking - the house modal, Escape-closable; closing it acks. */
function showBlocking(m: InboxMessage): void {
  focusNext = false;
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
  current = { m, takeDown: () => { gone = true; modal.close(true); }, setCount: () => { /* the dialog offers no View all */ } };
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
  focusNext = false;
  shown.clear();
  document.getElementById('org-banner')?.remove();
  _resetInboxForTests();
  _clearOpenedProjectsForTests();
}
