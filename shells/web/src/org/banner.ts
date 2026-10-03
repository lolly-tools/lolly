// SPDX-License-Identifier: MPL-2.0
/**
 * org/banner - surface a deployment's inbox as ONE dismissible message.
 *
 * Loaded lazily by src/org/index.ts, and only for a member whose org-config
 * reports unread messages, so a plain (control-plane-free) deployment never
 * touches this file. It fetches `GET /api/v1/inbox`, shows the single
 * highest-severity message (blocking > action > info), and acks it on dismiss
 * (`POST /api/v1/inbox/:id/ack`).
 *
 * A "<person> shared <project> with you" message (`data.kind: 'project-share'`) has
 * done its job once that project is open, however the person got there (the
 * banner's Open, the invite link or the Team projects list), so opening the
 * project acks it too. The openers report the opening to org/opened-projects.ts and
 * this module listens there, so no opener imports this one.
 *
 * Presentation follows the message's severity but never obstructs the app:
 *   - info / action → a slim, dismissible bar pinned above the app content
 *     (inserted into #app before #view, so it survives view navigation).
 *   - blocking → the house modal primitive (Escape-closable per the app-wide
 *     convention). It is a speed-bump, not a lock: closing it (button OR Escape)
 *     acks the message and hands control straight back to the app.
 */

import { instanceFetch, instancePath } from '../lib/instance.ts';
import { mountModal } from '../components/modal.ts';
import { t } from '../i18n.ts';
import { escape, safeHref } from '../utils.ts';
import { _clearOpenedProjectsForTests, onProjectOpened, openedProjects } from './opened-projects.ts';

export type Severity = 'info' | 'action' | 'blocking';

export interface InboxMessage {
  id: string;
  kind: string;
  severity: Severity;
  title: string;
  body?: string;
  cta?: { label: string; url: string };
  /** Machine-readable payload for a system-generated message, so the shell can ACT on
   *  it rather than parse the copy - a collab invite's `sessionId`/`toolId` being the
   *  first (plan 100 section 7 item 9). String values only; it is a routing hint, never a
   *  document, and nothing here reaches the DOM. */
  data?: Record<string, string>;
  dismissible: boolean;
}

const SEVERITY_RANK: Record<Severity, number> = { info: 1, action: 2, blocking: 3 };

/**
 * The single message to show: the highest-severity one (blocking > action >
 * info), ties broken by input order. Pure - exported for tests.
 */
export function pickMessage(messages: readonly InboxMessage[]): InboxMessage | null {
  let best: InboxMessage | null = null;
  for (const m of messages) {
    if (!m || !SEVERITY_RANK[m.severity]) continue;
    if (!best || SEVERITY_RANK[m.severity] > SEVERITY_RANK[best.severity]) best = m;
  }
  return best;
}

/** The team project a share message points at, or '' for any other message. Pure. */
export function sharedProjectOf(m: Pick<InboxMessage, 'data'> | null | undefined): string {
  const d = m?.data;
  return d && d.kind === 'project-share' && typeof d.projectId === 'string' ? d.projectId : '';
}

/** Split the inbox into messages still to show and share messages whose project is
 *  already open (done, to be acked). Pure. */
export function splitOpenedShares(messages: readonly InboxMessage[], opened: ReadonlySet<string>): { keep: InboxMessage[]; done: InboxMessage[] } {
  const keep: InboxMessage[] = [];
  const done: InboxMessage[] = [];
  for (const m of messages) (opened.has(sharedProjectOf(m)) ? done : keep).push(m);
  return { keep, done };
}

/** The message on screen and how to remove the message (removal acks the message). */
let shown: { m: InboxMessage; remove(): void } | null = null;
/** The rest of the fetched inbox: messages not on screen and not acked yet. Only one
 *  message shows at a time, so a share message can be waiting here while another
 *  one is up, and opening its project still has to ack that message. */
let waiting: InboxMessage[] = [];

/**
 * A team project was opened, so every share message about that project is done.
 * Takes the matching message on screen down (which acks the message) and acks the
 * matching messages waiting behind. org/opened-projects.ts remembers the project, so
 * a share message that arrives with a later inbox load is acked instead of shown.
 */
function acknowledgeProjectOpened(projectId: string): void {
  if (shown && sharedProjectOf(shown.m) === projectId) shown.remove();
  const { keep, done } = splitOpenedShares(waiting, new Set([projectId]));
  waiting = keep;
  for (const m of done) ack(m.id);
}
onProjectOpened(acknowledgeProjectOpened);

/** Fire-and-forget ack. Best-effort: a failed ack never blocks the UI removal. */
function ack(id: string): void {
  void instanceFetch(instancePath(`/api/v1/inbox/${encodeURIComponent(id)}/ack`), { method: 'POST' })
    .catch(() => { /* best-effort - the message is already gone from the UI */ });
}

/** A CTA link (if the message carries one), styled as a small shell button.
 *  A javascript:/data: url from a compromised control plane is dropped, never
 *  rendered as an anchor - same guard as chrome.ts's link rendering. */
function ctaHtml(m: InboxMessage): string {
  if (!m.cta?.url || !m.cta.label || !safeHref(m.cta.url)) return '';
  // nosemgrep: lolly-href-escape-is-not-scheme-validation - safeHref()-gated in the guard above
  return `<a class="btn btn--sm org-banner-cta" href="${escape(m.cta.url)}">${escape(m.cta.label)}</a>`;
}

/**
 * Give a collab invite an "Open the collab" action (plan 100 section 7 item 9).
 *
 * Lazy on the message KIND, not just on the banner: a member with an ordinary
 * announcement never fetches the work-collab client, and a member with an invite
 * fetches it exactly once, at the moment it becomes useful. Everything about the
 * action - parsing the payload, the `collab.join` gate, the join itself and its
 * failure copy - belongs to org/collab-work-opener.ts; this is the insertion point
 * and nothing else. A build without that module (or a member the instance withholds
 * the capability from) renders the message as plain text, which is what it is.
 */
function mountCollabAction(m: InboxMessage, host: Element, before: Element | null): void {
  // The gate has to be at least as WIDE as the parser it delegates to, or the tolerance
  // that parser was written for is unreachable. `readCollabInvite` deliberately accepts
  // EITHER marker - the message's own `kind: 'collab'` and the payload's
  // `data.kind: 'collab-invite'` - "because the server sets both and neither is the
  // documented one on its own". Gating on `kind === 'collab'` alone meant an invite sent
  // (or later re-shaped) as an announcement carrying the documented payload marker never
  // reached the parser at all: it rendered as plain text, with no button and nothing in
  // the console. The parser is still the decision - this only stops short-circuiting it.
  if (!m.data || (m.kind !== 'collab' && m.data.kind !== 'collab-invite')) return;
  void import('./collab-work-opener.ts')
    .then(({ buildCollabInviteAction }) => {
      const action = buildCollabInviteAction(m);
      if (!action || !host.isConnected) return;
      host.insertBefore(action, before);
    })
    .catch(() => { /* additive; the message still reads as text */ });
}

let mounted = false;

/**
 * Fetch the inbox and render the single most important message. Idempotent per
 * session (a second call is a no-op while one message is already showing).
 */
export async function mountOrgBanner(): Promise<void> {
  if (mounted) return;
  const res = await instanceFetch(instancePath('/api/v1/inbox')).catch(() => null);
  if (!res || !res.ok) return;
  let messages: InboxMessage[] = [];
  try {
    const body = (await res.json()) as { messages?: InboxMessage[] };
    messages = Array.isArray(body?.messages) ? body.messages : [];
  } catch { return; }

  const { keep, done } = splitOpenedShares(messages, openedProjects());
  for (const m of done) ack(m.id);
  const msg = pickMessage(keep);
  waiting = keep.filter((m) => m !== msg);
  if (!msg) return;
  mounted = true;

  if (msg.severity === 'blocking') showBlocking(msg);
  else showBar(msg);
}

/** info / action - a slim dismissible bar above the app. */
function showBar(m: InboxMessage): void {
  const app = document.getElementById('app');
  const view = document.getElementById('view');
  if (!app) { mounted = false; return; }
  document.getElementById('org-banner')?.remove();

  const bar = document.createElement('div');
  bar.id = 'org-banner';
  bar.className = `org-banner org-banner--${escape(m.severity)}`;
  bar.setAttribute('role', m.severity === 'action' ? 'status' : 'note');
  // Theme-aware, self-contained styling - no stylesheet touch for this additive
  // seam. An `action` message leans on the brand accent, `info` on muted chrome.
  const accent = m.severity === 'action' ? 'var(--primary)' : 'var(--muted-foreground)';
  // The views float their top-row controls (navigation, filter, Settings) over the top
  // of the page, at every width. The bar's tint runs under them, and its message sits
  // in a row below them (the same clearance the views' own content uses), so the
  // controls never cover its action or its dismiss button.
  bar.style.cssText = `display:flex;align-items:center;gap:.75rem;padding:calc(var(--chrome-top, .5rem) + var(--chrome-h, 2.6rem) + .5rem) .5rem .5rem 1rem;font-size:var(--fs-lg);line-height:1.4;border-bottom:1px solid hsl(var(--border));background:hsl(${accent} / .08);color:hsl(var(--foreground))`;

  const body = m.body ? ` <span style="color:hsl(var(--muted-foreground))">${escape(m.body)}</span>` : '';
  // The message and its action wrap together, the action right after the words (never
  // pushed to the far edge), and the dismiss control keeps its place at the end of the
  // first line at every width.
  bar.innerHTML = `
    <span style="flex:0 0 auto;width:.5rem;height:.5rem;border-radius:50%;background:hsl(${accent})" aria-hidden="true"></span>
    <span class="org-banner-message" style="flex:1 1 auto;min-width:0;display:flex;flex-wrap:wrap;align-items:center;gap:.35rem .75rem"><span style="min-width:0"><strong style="font-weight:650">${escape(m.title)}</strong>${body}</span>${ctaHtml(m)}</span>
    ${m.dismissible ? `<button type="button" class="org-banner-dismiss" aria-label="${escape(t('Dismiss'))}" style="flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border:0;border-radius:var(--radius);background:transparent;color:inherit;cursor:pointer;font-size:1.3rem;line-height:1;opacity:.7">&times;</button>` : ''}`;

  app.insertBefore(bar, view ?? null);
  // Inside the message, after its words, so the action reads as part of the message
  // rather than as something past the way to close it.
  mountCollabAction(m, bar.querySelector('.org-banner-message') ?? bar, null);

  const remove = (): void => {
    if (!bar.isConnected) return;
    bar.remove();
    mounted = false;
    if (shown?.m === m) shown = null;
    ack(m.id);
  };
  shown = { m, remove };
  bar.querySelector('.org-banner-dismiss')?.addEventListener('click', remove);
}

/** blocking - the house modal, Escape-closable; closing it acks. */
function showBlocking(m: InboxMessage): void {
  // Following the message's own action (its link, or a collab's Open) is acting on it,
  // even though the navigation that follows is what closes the dialog.
  let acted = false;
  const content = `
    <h2 class="modal-title">${escape(m.title)}</h2>
    ${m.body ? `<p class="modal-msg">${escape(m.body)}</p>` : ''}
    <div class="modal-actions">
      ${ctaHtml(m)}
      <button type="button" class="btn modal-primary" data-act="ok">${escape(m.cta ? t('Dismiss') : t('Got it'))}</button>
    </div>`;
  const modal = mountModal<boolean>(content, {
    className: 'modal',
    ariaLabel: m.title,
    cancelValue: true,
    initialFocus: (el) => el.querySelector<HTMLElement>('[data-act="ok"]'),
    // Closed by the person (button, Escape, backdrop, Back) or by opening its project:
    // acked, and the app is theirs again. Torn down by a route change (`undefined`,
    // say a link moving on while the inbox loaded): nobody saw it through, so it is
    // not acked and shows again next time.
    onClose: (closed) => {
      mounted = false;
      if (shown?.m === m) shown = null;
      if (closed !== undefined || acted) ack(m.id);
    },
  });
  shown = { m, remove: () => modal.close(true) };
  const actions = modal.el.querySelector('.modal-actions');
  if (actions) mountCollabAction(m, actions, actions.querySelector('[data-act="ok"]'));
  modal.el.addEventListener('click', (e) => {
    if (!(e.target instanceof Element)) return;
    if (e.target.closest('[data-act="ok"]')) { modal.close(true); return; }
    if (e.target.closest('.modal-actions a, .modal-actions button')) acted = true;
  });
}

/** TEST-ONLY: reset the once-per-session guard. */
export function _resetBannerForTests(): void {
  mounted = false;
  shown = null;
  waiting = [];
  _clearOpenedProjectsForTests();
}
