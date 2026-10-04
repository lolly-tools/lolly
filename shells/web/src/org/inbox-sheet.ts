// SPDX-License-Identifier: MPL-2.0
/**
 * org/inbox-sheet - every message in a member's inbox, in one dialog (plan 74 invite
 * spec 5.3).
 *
 * Opened from the banner's View all and from Profile's Inbox. The list comes from
 * org/inbox.ts and follows the list while the dialog is open: a new message joins at
 * the top, and a message that leaves the list (dismissed in the banner, retired by the
 * instance) leaves the dialog too.
 *
 * Each row shows the title, the body and how long ago the message was written
 * (`data.at`), with Open for a message that carries a link and Dismiss, which acks.
 * A request to use a team project (`data.kind: 'access-request'`, `requestKind:
 * 'project'`) is answered right here: a role select and Approve or Decline. A request
 * to join the workspace, or to use another account for an invitation, is answered in
 * the console, so its link reads "Answer in the console". The instance checks every
 * answer again: someone else may have answered first, or this person may no longer
 * manage the project, and each outcome has its own sentence.
 *
 * Every instance-supplied string (titles, bodies, names) reaches the page through
 * textContent; only the dialog's frame, built from this file's own strings, is markup.
 */
import { announce } from '../a11y.ts';
import { mountModal, type ModalHandle } from '../components/modal.ts';
import { t, tRaw } from '../i18n.ts';
import { icon } from '../lib/icons.ts';
import { instanceFetch, instancePath } from '../lib/instance.ts';
import { relTime } from '../lib/rel-time.ts';
import { escape as escapeHtml, safeHref } from '../utils.ts';
import { mountCollabAction } from './banner.ts';
import { orgConfig } from './index.ts';
import { dismissMessage, inboxLoaded, inboxMessages, onInboxChange, refreshInbox, type InboxMessage } from './inbox.ts';
import { INVITE_ROLES, inviteRoleOf, invitePolicy, roleLabel, type InviteRole } from './team-access.ts';

/**
 * Messages newest first by `data.at`. A message without a readable time keeps the
 * instance's order and follows the timed ones: the instance lists older kinds of
 * message (shares, collab invites) without a time. Pure.
 */
export function sortNewestFirst(messages: readonly InboxMessage[]): InboxMessage[] {
  const timed: Array<{ m: InboxMessage; at: number }> = [];
  const untimed: InboxMessage[] = [];
  for (const m of messages) {
    const at = m.data?.at ? Date.parse(m.data.at) : NaN;
    if (Number.isNaN(at)) untimed.push(m);
    else timed.push({ m, at });
  }
  timed.sort((a, b) => b.at - a.at);
  return [...timed.map((x) => x.m), ...untimed];
}

/** An access request this sheet can answer: the request's id, kind and the role
 *  asked for, from the message's payload. Null for any other message. Pure. */
export function requestOf(m: InboxMessage): { id: string; kind: string; role: InviteRole | undefined; name: string } | null {
  const d = m.data;
  if (d?.kind !== 'access-request' || !d.requestId) return null;
  return { id: d.requestId, kind: d.requestKind ?? '', role: inviteRoleOf(d.role), name: (d.name || d.email || '').trim() };
}

// ── Answering a request ──────────────────────────────────────────────────────

export type AnswerVerb = 'approve' | 'decline';

/** How an answer went:
 *  - `done`: this answer was the one recorded;
 *  - `already`: someone answered first, or the request was withdrawn or ended
 *    (`status` from the instance's copy of the request);
 *  - `forbidden`: this person may no longer answer the request;
 *  - `ended`: the request is gone, or the instance ended the request instead (the
 *    project was archived, the requester's account is off);
 *  - `failed`: no answer, or one that says nothing; trying again may work. */
export type AnswerOutcome =
  | { kind: 'done'; verb: 'approve'; role: InviteRole }
  | { kind: 'done'; verb: 'decline' }
  | { kind: 'already'; status: string; by?: string; role?: InviteRole }
  | { kind: 'forbidden' }
  | { kind: 'ended' }
  | { kind: 'failed' };

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** The instance's copy of a request, from an answer body. Pure. */
function requestView(body: unknown): { status?: string; by?: string; role?: InviteRole } {
  const r = (body as { request?: unknown } | null)?.request;
  if (!r || typeof r !== 'object') return {};
  const v = r as { status?: unknown; answeredBy?: { name?: unknown } | null; answerRole?: unknown };
  const status = str(v.status);
  const by = str(v.answeredBy?.name);
  const role = inviteRoleOf(v.answerRole);
  return { ...(status ? { status } : {}), ...(by ? { by } : {}), ...(role ? { role } : {}) };
}

/** Approve a request with a role, or decline the request, through
 *  `POST /api/v1/access-requests/:id/approve|decline`. Never throws. */
export async function answerAccessRequest(id: string, answer: { verb: 'approve'; role: InviteRole } | { verb: 'decline' }): Promise<AnswerOutcome> {
  const { verb } = answer;
  let res: Response;
  try {
    res = await instanceFetch(instancePath(`/api/v1/access-requests/${encodeURIComponent(id)}/${verb}`), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(answer.verb === 'approve' ? { role: answer.role } : {}),
    });
  } catch {
    return { kind: 'failed' };
  }
  let body: unknown = null;
  try { body = await res.json(); } catch { body = null; }
  const view = requestView(body);
  if (res.ok) {
    // The role the instance recorded, which is the one asked for unless the
    // instance says otherwise.
    return answer.verb === 'approve' ? { kind: 'done', verb: 'approve', role: view.role ?? answer.role } : { kind: 'done', verb: 'decline' };
  }
  if (res.status === 409 && view.status) {
    return { kind: 'already', status: view.status, ...(view.by ? { by: view.by } : {}), ...(view.role ? { role: view.role } : {}) };
  }
  if (res.status === 409 || res.status === 404) return { kind: 'ended' };
  if (res.status === 403) return { kind: 'forbidden' };
  return { kind: 'failed' };
}

/** The sentence for an answer's outcome. Plain text. */
export function answerText(o: AnswerOutcome): string {
  switch (o.kind) {
    case 'done':
      return o.verb === 'approve' ? tRaw('Approved as {role}.', { role: roleLabel(o.role) }) : tRaw('Declined.');
    case 'already':
      if (o.status === 'approved' && o.by && o.role) return tRaw('{name} already approved this as {role}.', { name: o.by, role: roleLabel(o.role) });
      if (o.status === 'declined' && o.by) return tRaw('{name} already declined this.', { name: o.by });
      if (o.status === 'withdrawn') return tRaw('This request was withdrawn.');
      return tRaw('This request has ended.');
    case 'forbidden': return tRaw('You can no longer answer this request.');
    case 'ended': return tRaw('This request has ended.');
    default: return tRaw('Could not answer the request. Try again.');
  }
}

// ── The dialog ───────────────────────────────────────────────────────────────

export interface InboxSheetOptions {
  /** The workspace's name for the line under the heading; org-config's when absent. */
  workspace?: string;
  /** The roles an approval may give, in order; the instance's invite roles when absent. */
  roles?: readonly InviteRole[];
}

const MUTED = 'color:hsl(var(--muted-foreground))';
const TARGET = 'min-height:var(--ui-size-target)';

let open: ModalHandle<void> | null = null;
let sheetSeq = 0;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: { className?: string; text?: string; style?: string } = {}): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (attrs.className) node.className = attrs.className;
  if (attrs.text !== undefined) node.textContent = attrs.text;
  if (attrs.style) node.style.cssText = attrs.style;
  return node;
}

function button(label: string, act: string, className = 'btn btn--sm'): HTMLButtonElement {
  const b = el('button', { className, text: label, style: TARGET });
  b.type = 'button';
  b.dataset.act = act;
  return b;
}

/** Open the inbox. Opening it while it is open moves focus back to its heading. */
export function openInboxSheet(opts: InboxSheetOptions = {}): void {
  if (open) {
    open.el.querySelector<HTMLElement>('[data-inbox-title]')?.focus();
    return;
  }
  const config = orgConfig();
  const workspace = (opts.workspace ?? config?.instance?.name ?? '').trim();
  const roles = opts.roles?.length ? [...opts.roles] : (invitePolicy(config)?.projectRoles ?? [...INVITE_ROLES]);
  const uid = `inbox-${++sheetSeq}`;

  let unsubscribe: (() => void) | null = null;
  const modal = mountModal<void>(
    `<div style="display:flex;flex-direction:column;max-height:min(42rem,calc(100dvh - 24px))">
      <div style="display:flex;align-items:flex-start;gap:.5rem;padding:16px 12px 6px 22px">
        <div style="flex:1 1 auto;min-width:0;padding-top:6px">
          <h2 class="modal-title" id="${uid}-h" data-inbox-title tabindex="-1" style="margin:0;outline:none">${escapeHtml(t('Inbox'))}</h2>
          ${workspace ? `<p style="margin:.2rem 0 0;font-size:var(--fs-sm);${MUTED}">${t('Messages from {workspace}', { workspace })}</p>` : ''}
        </div>
        <button type="button" class="save-dialog-close" data-inbox-close aria-label="${escapeHtml(t('Close'))}" style="display:inline-flex;align-items:center;justify-content:center;width:var(--ui-size-target);height:var(--ui-size-target)">${icon('close', { size: 18 })}</button>
      </div>
      <div data-inbox-body style="flex:1 1 auto;min-height:0;overflow:auto;overscroll-behavior:contain;padding:8px 22px 22px"></div>
    </div>`,
    {
      className: 'modal inbox-sheet',
      initialFocus: (dlg) => dlg.querySelector<HTMLElement>('[data-inbox-title]'),
      onClose: () => {
        unsubscribe?.();
        open = null;
      },
    },
  );
  open = modal;
  modal.el.setAttribute('aria-labelledby', `${uid}-h`);
  // Wider than a confirm card, and edge to edge less 12px a side on a phone.
  modal.el.style.cssText = 'width:min(34rem,calc(100vw - 24px));max-width:none;max-height:calc(100dvh - 24px);padding:0;overflow:hidden';
  modal.el.querySelector('[data-inbox-close]')?.addEventListener('click', () => modal.close());
  const heading = modal.el.querySelector<HTMLElement>('[data-inbox-title]')!;
  const body = modal.el.querySelector<HTMLElement>('[data-inbox-body]')!;

  const list = el('ul', { className: 'inbox-sheet-list', style: 'list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.6rem' });
  const empty = el('p', { className: 'projects-empty', text: tRaw('No messages'), style: `margin:.5rem 0;${MUTED}` });
  /** The row for each message on screen, by message id. */
  const rows = new Map<string, HTMLLIElement>();
  let rowSeq = 0;

  /** Focus left with a row that went away: the next row, else the previous one, else
   *  the heading, so the next Tab does not start from the top of the page. */
  const removeRow = (li: HTMLLIElement): void => {
    const hadFocus = li.contains(document.activeElement);
    const near = (li.nextElementSibling ?? li.previousElementSibling) as HTMLElement | null;
    li.remove();
    if (!hadFocus) return;
    (near?.querySelector<HTMLElement>('a, button, select') ?? heading).focus();
  };

  const buildRow = (m: InboxMessage): HTMLLIElement => {
    const n = ++rowSeq;
    const req = requestOf(m);
    const answerHere = req?.kind === 'project';
    const li = el('li', {
      className: 'inbox-sheet-row',
      style: `display:flex;flex-direction:column;gap:.45rem;padding:.7rem .85rem;border:1px solid hsl(var(--border));border-radius:var(--radius);${m.severity === 'info' ? '' : 'background:hsl(var(--primary) / .06);border-color:hsl(var(--primary) / .35)'}`,
    });
    li.dataset.msg = m.id;

    const words = el('div', { style: 'min-width:0' });
    words.append(el('strong', { text: m.title, style: 'display:block;font-weight:650;overflow-wrap:anywhere' }));
    if (m.body) words.append(el('p', { text: m.body, style: `margin:.15rem 0 0;overflow-wrap:anywhere;${MUTED}` }));
    const when = relTime(m.data?.at, Date.now(), tRaw);
    if (when) {
      const time = el('time', { text: when, style: `display:block;margin-top:.15rem;font-size:var(--fs-sm);${MUTED}` });
      time.dateTime = m.data!.at!;
      words.append(time);
    }
    li.append(words);

    const result = el('p', { className: 'inbox-sheet-result', style: 'margin:0;font-size:var(--fs-sm)' });
    result.setAttribute('role', 'status');
    result.tabIndex = -1;
    result.hidden = true;

    const actions = el('div', { className: 'inbox-sheet-actions', style: 'display:flex;flex-wrap:wrap;align-items:center;gap:.4rem' });
    let roleBox: HTMLElement | null = null;
    let select: HTMLSelectElement | null = null;
    let approve: HTMLButtonElement | null = null;
    let decline: HTMLButtonElement | null = null;
    if (req && answerHere) {
      roleBox = el('div', { style: 'display:flex;flex-direction:column;gap:.2rem' });
      const label = el('label', { text: req.name ? tRaw('Role for {name}', { name: req.name }) : tRaw('Role'), style: 'font-size:var(--fs-sm);font-weight:600' });
      label.htmlFor = `${uid}-role-${n}`;
      select = el('select', { className: 'field-select field-select--sm field-select--auto', style: TARGET });
      select.id = `${uid}-role-${n}`;
      for (const r of roles) {
        const o = el('option', { text: roleLabel(r) });
        o.value = r;
        select.append(o);
      }
      select.value = req.role && roles.includes(req.role) ? req.role : roles[0]!;
      const hint = el('p', { text: tRaw('Viewers open and copy. Editors save changes. Managers also add people.'), style: `margin:0;font-size:var(--fs-sm);${MUTED}` });
      hint.id = `${uid}-role-${n}-hint`;
      select.setAttribute('aria-describedby', hint.id);
      roleBox.append(label, select, hint);
      li.append(roleBox);
      approve = button(tRaw('Approve'), 'inbox-approve', 'btn btn--primary btn--sm');
      decline = button(tRaw('Decline'), 'inbox-decline');
      actions.append(approve, decline);
    }

    if (m.cta?.url && safeHref(m.cta.url)) {
      const link = el('a', {
        className: 'btn btn--sm',
        text: req && !answerHere ? tRaw('Answer in the console') : tRaw('Open'),
        style: `${TARGET};display:inline-flex;align-items:center`,
      });
      link.href = m.cta.url;
      link.dataset.act = 'inbox-open';
      actions.append(link);
    }
    let dismiss: HTMLButtonElement | null = null;
    if (m.dismissible) {
      dismiss = button(tRaw('Dismiss'), 'inbox-dismiss', 'btn btn--sm btn--ghost');
      dismiss.addEventListener('click', () => { dismissMessage(m.id); });
      actions.append(dismiss);
    }
    mountCollabAction(m, actions, dismiss);
    li.append(actions, result);

    if (req && answerHere && select && approve && decline && roleBox) {
      const say = (msg: string, error: boolean): void => {
        result.textContent = msg;
        result.style.color = error ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))';
        result.hidden = false;
        announce(msg, { assertive: error });
      };
      const answer = async (verb: AnswerVerb): Promise<void> => {
        li.setAttribute('aria-busy', 'true');
        approve!.disabled = true;
        decline!.disabled = true;
        const outcome = await answerAccessRequest(req.id, verb === 'approve'
          ? { verb, role: inviteRoleOf(select!.value) ?? roles[0]! }
          : { verb });
        li.removeAttribute('aria-busy');
        const hadFocus = li.contains(document.activeElement) || document.activeElement === document.body;
        if (outcome.kind === 'failed') {
          approve!.disabled = false;
          decline!.disabled = false;
          say(answerText(outcome), true);
          return;
        }
        // Settled one way or another: the role and the two answers go. Forbidden keeps
        // Dismiss (the message is still this person's to clear); every other outcome
        // ends the request, so its message is acked and the row stays, saying how the
        // request ended, until the dialog closes.
        roleBox!.remove();
        approve!.remove();
        decline!.remove();
        if (outcome.kind !== 'forbidden') {
          li.dataset.settled = 'true';
          dismiss?.remove();
          dismissMessage(m.id);
        }
        say(answerText(outcome), outcome.kind === 'forbidden');
        if (hadFocus) result.focus();
      };
      approve.addEventListener('click', () => { void answer('approve'); });
      decline.addEventListener('click', () => { void answer('decline'); });
    }
    return li;
  };

  /** Follow the list: rows for messages that left go (unless settled or mid-answer),
   *  and new messages join at the top, newest first. */
  const reconcile = (msgs: readonly InboxMessage[]): void => {
    const ids = new Set(msgs.map((m) => m.id));
    for (const [id, li] of rows) {
      if (ids.has(id) || li.dataset.settled === 'true' || li.getAttribute('aria-busy') === 'true') continue;
      rows.delete(id);
      removeRow(li);
    }
    const fresh = sortNewestFirst(msgs.filter((m) => !rows.has(m.id)));
    const built = fresh.map((m) => {
      const li = buildRow(m);
      rows.set(m.id, li);
      return li;
    });
    list.prepend(...built);
    empty.hidden = rows.size > 0;
  };

  const showList = (): void => {
    body.replaceChildren(empty, list);
    reconcile(inboxMessages());
    unsubscribe ??= onInboxChange(reconcile);
  };

  const showFailure = (): void => {
    const note = el('p', { text: tRaw('Could not load your messages. Try again.'), style: 'margin:.5rem 0' });
    note.setAttribute('role', 'alert');
    const retry = button(tRaw('Try again'), 'inbox-retry');
    retry.addEventListener('click', () => { void load(true); });
    body.replaceChildren(note, retry);
  };

  const load = async (fromRetry: boolean): Promise<void> => {
    body.replaceChildren(el('p', { className: 'projects-empty', text: tRaw('Loading…'), style: `margin:.5rem 0;${MUTED}` }));
    const ok = await refreshInbox({ force: true });
    if (open !== modal) return;
    if (ok || inboxLoaded()) {
      showList();
      if (fromRetry) heading.focus();
    } else {
      showFailure();
      if (fromRetry) body.querySelector<HTMLElement>('[data-act="inbox-retry"]')?.focus();
    }
  };

  if (inboxLoaded()) {
    showList();
    // The list on hand shows at once. When the last fetch is a minute old or more, a
    // new fetch brings the rows up to date.
    void refreshInbox();
  } else {
    void load(false);
  }
}

/** TEST-ONLY: close the dialog and forget the handle. */
export function _resetInboxSheetForTests(): void {
  open?.close();
  open = null;
}
