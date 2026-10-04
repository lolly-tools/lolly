// SPDX-License-Identifier: MPL-2.0
/**
 * org/collab-invite.ts - "Invite to edit now": ask someone on the project to join the
 * live work collab on this session (lolly-work plans/75: J6 step 9, sections 5.3 and 5.14).
 *
 * The instance already has both halves. `GET /api/v1/collab/invitees` lists the people
 * who could open the session's room: members of its project whom the instance lets
 * join a collab, never the wider directory, with no addresses, at most 20 per answer,
 * matched on the start of a name. `POST /api/v1/collab/invites` puts an inbox message
 * for one of them, and the invitee's banner shows it with "Open the collab"
 * (org/collab-work-opener.ts buildCollabInviteAction). Until this module nothing in
 * the shell called either route, so only someone who already knew to open the same
 * session could join a live collab.
 *
 * Two places offer the button, and both open the same dialog:
 *   - the Share dialog's "Work collab" row (org/collab-share.ts), while this tab is in
 *     the live collab, and as soon as a start from the row succeeds;
 *   - the presence pill over the tool (components/collab-pill.ts), through the neutral
 *     lib/collab-pill-invite.ts seam, which {@link registerWorkCollabPillInvite} fills.
 *
 * Who is offered the button: a member who could start a work collab on the session
 * (lib/collab-availability.ts: a `'work'` opener is registered and the instance grants
 * `collab.edit`), and on the pill, not an observer. The instance checks again on the
 * POST (the caller must be an editor on the project, with `collab.edit`), and the
 * dialog shows a refusal under the list. The gate is read through
 * lib/collab-availability.ts rather than org/collab-config.ts so that nothing here
 * loads org/index.ts: this module stays outside the org/index.ts import cycle that
 * scripts/check-maintainability-budget.ts tracks.
 *
 * The picker is a modal dialog, not a panel inside the Share section. The docked Share
 * panel rebuilds its sections on every edit, and in a live collab the other person's
 * edits count, so a search field inside the section would be thrown away while
 * someone typed in the field.
 *
 * Names reach the DOM through `textContent` only. Copy follows plans/75 J6:
 * title "Invite to edit now", field "Type a name", subtitle "People on <project>", a
 * row per person with [Invite], and "Sent. <name> gets a message in the inbox."
 */

import { instanceFetch, instancePath } from '../lib/instance.ts';
import { mountModal } from '../components/modal.ts';
import { canStartCollab } from '../lib/collab-availability.ts';
import { registerCollabPillInvite } from '../lib/collab-pill-invite.ts';
import { getSessionSource, type TeamProjectRef } from '../lib/session-source.ts';
import { activeTeamSessionOrigin } from './team-session-origin.ts';
import { announce } from '../a11y.ts';
import { t, tRaw } from '../i18n.ts';
import { escape as escapeHtml } from '../utils.ts';

// ── Wire shapes ───────────────────────────────────────────────────────────────

/** One person the instance offers for the session's room: an id to invite and a name
 *  to show (lolly-work `collab/invites.ts` `Invitee`). */
export interface CollabInvitee {
  readonly id: string;
  readonly name: string;
}

/** The session an invite is for, as held by the live mount's team origin. */
export interface CollabInviteTarget {
  /** The instance's id for the session: the room key, and what the POST names. */
  readonly sessionId: string;
  /** The project the session belongs to, when known. Only the subtitle reads the id. */
  readonly projectId?: string;
}

/** The invitees answer: the people offered, and whether the instance's cap cut the list. */
export type InviteeList =
  | { readonly ok: true; readonly invitees: readonly CollabInvitee[]; readonly truncated: boolean }
  | { readonly ok: false };

/** Why an invite was not sent, one per sentence in {@link inviteFailureMessage}. */
export type InviteFailure =
  | 'not-eligible' // 400: the person can no longer open the session
  | 'signed-out'   // 401: the cookie expired
  | 'forbidden'    // 403: the caller may not invite (a viewer, or no collab.edit)
  | 'gone'         // 410: the session was deleted
  | 'failed';      // anything else, including no answer at all

export type InviteResult = { readonly ok: true } | { readonly ok: false; readonly reason: InviteFailure };

/** The longest query the instance considers (`MAX_QUERY_CHARS` there). */
export const MAX_QUERY_CHARS = 64;

/** How long typing settles before the list is asked for again. */
export const SEARCH_DEBOUNCE_MS = 200;

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * Read an invitees answer. A row without an id is dropped (there is nothing to invite),
 * and a row without a name shows its id, which is what the instance does for an
 * account with no display name. Anything that is not the documented shape reads as a
 * failed load rather than an empty list. Pure.
 */
export function readInvitees(body: unknown): InviteeList {
  const rows = (body as { invitees?: unknown } | null)?.invitees;
  if (!Array.isArray(rows)) return { ok: false };
  const invitees: CollabInvitee[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const id = str((row as { id?: unknown } | null)?.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    invitees.push({ id, name: str((row as { name?: unknown }).name) || id });
  }
  return { ok: true, invitees, truncated: (body as { truncated?: unknown }).truncated === true };
}

/** The failure an HTTP status stands for. Pure. */
export function inviteFailureFor(status: number): InviteFailure {
  if (status === 400) return 'not-eligible';
  if (status === 401) return 'signed-out';
  if (status === 403) return 'forbidden';
  if (status === 410) return 'gone';
  return 'failed';
}

/** The sentence shown and announced for a failed invite to `name`. */
export function inviteFailureMessage(reason: InviteFailure, name: string): string {
  switch (reason) {
    case 'not-eligible': return tRaw('{name} cannot open this session any more.', { name });
    case 'signed-out': return t('Your sign-in has expired. Sign in again to invite people.');
    case 'forbidden': return t('Only people who can edit this session can invite others.');
    case 'gone': return t('This session was deleted.');
    default: return t('Could not send the invite. Try again.');
  }
}

// ── Network (tolerant: every failure is a value, never a throw) ───────────────

/** The people `q` matches among those who could open the session's room. */
export async function fetchInvitees(sessionId: string, q = ''): Promise<InviteeList> {
  const params = new URLSearchParams({ sessionId });
  const query = q.trim().slice(0, MAX_QUERY_CHARS);
  if (query) params.set('q', query);
  try {
    const res = await instanceFetch(instancePath(`/api/v1/collab/invitees?${params.toString()}`));
    if (!res.ok) return { ok: false };
    return readInvitees(await res.json());
  } catch {
    return { ok: false };
  }
}

/** Invite one person to the session's room. The instance puts the inbox message; a
 *  second invite to the same person refreshes that message rather than adding one. */
export async function sendCollabInvite(sessionId: string, userId: string): Promise<InviteResult> {
  try {
    const res = await instanceFetch(instancePath('/api/v1/collab/invites'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId, userId }),
    });
    return res.ok ? { ok: true } : { ok: false, reason: inviteFailureFor(res.status) };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

// ── Who is offered the button ─────────────────────────────────────────────────

/** Whether this member could start a work collab on the session, which is the same
 *  grant an invite needs (see the header). Read fresh on every call. */
function mayInvite(toolId: string | undefined, target: CollabInviteTarget): boolean {
  return canStartCollab({ kind: 'session', ...(toolId ? { toolId } : {}), sessionId: target.sessionId }, 'work');
}

const targetOf = (origin: CollabInviteTarget): CollabInviteTarget => ({
  sessionId: origin.sessionId,
  ...(origin.projectId ? { projectId: origin.projectId } : {}),
});

// ── The dialog ────────────────────────────────────────────────────────────────

export interface CollabInviteDeps {
  /** How long typing settles before the list is asked for again, in ms. */
  readonly debounceMs?: number;
  /** The session source's projects, for the subtitle and the caller's role there.
   *  Tests pass their own; the default asks the registered source. */
  readonly listProjects?: () => Promise<readonly TeamProjectRef[]>;
  readonly fetchInvitees?: typeof fetchInvitees;
  readonly sendInvite?: typeof sendCollabInvite;
}

const FIELD_CSS =
  'width:100%;box-sizing:border-box;min-height:var(--ui-size-target);padding:8px 11px;font-size:14px;'
  + 'border:1px solid hsl(var(--input));border-radius:var(--radius);background:hsl(var(--background));'
  + 'color:hsl(var(--foreground));font-weight:400';
const MUTED = 'margin:.6rem 0 0;color:hsl(var(--muted-foreground));font-size:13px';

const defaultProjects = (): Promise<readonly TeamProjectRef[]> =>
  getSessionSource()?.listProjects() ?? Promise.resolve([]);

/**
 * Open the "Invite to edit now" dialog for a session. The list loads when the dialog
 * opens and again as the person types; each row's [Invite] sends one invite and then
 * reads "Invited" for as long as the dialog stays open. Returns the dialog element.
 */
export function openCollabInviteDialog(target: CollabInviteTarget, deps: CollabInviteDeps = {}): HTMLDialogElement {
  const load = deps.fetchInvitees ?? fetchInvitees;
  const send = deps.sendInvite ?? sendCollabInvite;
  const debounceMs = deps.debounceMs ?? SEARCH_DEBOUNCE_MS;

  const content = `
    <div class="collab-invite-body">
      <h2 class="modal-title">${escapeHtml(t('Invite to edit now'))}</h2>
      <p class="modal-msg" data-invite-project style="margin:0 0 .75rem" hidden></p>
      <label style="display:flex;flex-direction:column;gap:.3rem;font-size:13px;font-weight:600">
        ${escapeHtml(t('Type a name'))}
        <input type="search" data-invite-search autocomplete="off" spellcheck="false"
               maxlength="${MAX_QUERY_CHARS}" style="${FIELD_CSS}">
      </label>
      <ul data-invitees style="list-style:none;margin:.6rem 0 0;padding:0;max-height:min(45vh,18rem);overflow:auto;display:flex;flex-direction:column;gap:.25rem"></ul>
      <p data-invitees-note style="${MUTED}">${escapeHtml(t('Loading…'))}</p>
      <button type="button" class="btn btn--sm" data-act="retry-invitees" style="margin-top:.5rem;min-height:var(--ui-size-target)" hidden>${escapeHtml(t('Try again'))}</button>
      <p data-invite-status style="margin:.6rem 0 0;font-size:13px" hidden></p>
      <div class="modal-actions">
        <button type="button" class="btn" data-act="close" style="min-height:var(--ui-size-target)">${escapeHtml(t('Close'))}</button>
      </div>
    </div>`;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const modal = mountModal<void>(content, {
    className: 'modal collab-invite-dialog',
    ariaLabel: t('Invite to edit now'),
    initialFocus: (el) => el.querySelector<HTMLInputElement>('[data-invite-search]'),
    onClose: () => { if (timer !== undefined) clearTimeout(timer); },
  });
  const dialog = modal.el;
  const projectEl = dialog.querySelector<HTMLElement>('[data-invite-project]')!;
  const searchEl = dialog.querySelector<HTMLInputElement>('[data-invite-search]')!;
  const listEl = dialog.querySelector<HTMLUListElement>('[data-invitees]')!;
  const noteEl = dialog.querySelector<HTMLElement>('[data-invitees-note]')!;
  const retryEl = dialog.querySelector<HTMLButtonElement>('[data-act="retry-invitees"]')!;
  const statusEl = dialog.querySelector<HTMLElement>('[data-invite-status]')!;
  dialog.querySelector<HTMLButtonElement>('[data-act="close"]')!.addEventListener('click', () => modal.close());

  const setNote = (text: string): void => { noteEl.textContent = text; noteEl.hidden = !text; };
  // The last invite's answer: muted for a success, the destructive colour for a refusal.
  // Announced separately, so the line carries no live role of its own.
  const setStatus = (text: string, error: boolean): void => {
    statusEl.textContent = text;
    statusEl.style.color = error ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))';
    statusEl.hidden = !text;
  };

  /** People invited while this dialog is open, so a new search still shows them as
   *  sent, and people whose invite is still on its way. */
  const sent = new Set<string>();
  const sending = new Set<string>();
  /** Set once the instance says this person only views the project: no list then. */
  let viewOnly = false;

  /** Draw a row's button from the two sets: a search can redraw the list while an
   *  invite is on its way, and the new row must not offer a second press. */
  const paint = (btn: HTMLButtonElement, person: CollabInvitee): void => {
    if (sent.has(person.id)) {
      btn.disabled = true;
      btn.textContent = t('Invited');
      btn.removeAttribute('aria-label');
    } else if (sending.has(person.id)) {
      btn.disabled = true;
      btn.textContent = t('Sending…');
    } else {
      btn.disabled = false;
      btn.textContent = t('Invite');
      btn.setAttribute('aria-label', tRaw('Invite {name}', { name: person.name }));
    }
  };
  const currentButton = (id: string): HTMLButtonElement | null => {
    for (const li of listEl.children) {
      if ((li as HTMLElement).dataset.inviteeId === id) return li.querySelector<HTMLButtonElement>('[data-act="invite"]');
    }
    return null;
  };

  const invite = (person: CollabInvitee): void => {
    if (sent.has(person.id) || sending.has(person.id)) return;
    sending.add(person.id);
    const pressed = currentButton(person.id);
    if (pressed) paint(pressed, person);
    setStatus('', false);
    void send(target.sessionId, person.id).then((result) => {
      sending.delete(person.id);
      if (result.ok) sent.add(person.id);
      if (!dialog.isConnected) return;
      const btn = currentButton(person.id);
      if (btn) paint(btn, person);
      const message = result.ok
        ? tRaw('Sent. {name} gets a message in the inbox.', { name: person.name })
        : inviteFailureMessage(result.reason, person.name);
      setStatus(message, !result.ok);
      announce(message, { assertive: !result.ok });
    });
  };

  const rowFor = (person: CollabInvitee): HTMLLIElement => {
    const li = document.createElement('li');
    li.dataset.inviteeId = person.id;
    li.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:.75rem';
    const name = document.createElement('span');
    name.style.cssText = 'min-width:0;overflow-wrap:anywhere;font-size:14px';
    name.textContent = person.name;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn--sm';
    btn.dataset.act = 'invite';
    btn.style.cssText = 'flex:none;min-height:var(--ui-size-target)';
    paint(btn, person);
    btn.addEventListener('click', () => { invite(person); });
    li.append(name, btn);
    return li;
  };

  // Only the newest request may draw the list: typing fast sends several, and an older
  // answer arriving last must not replace the one for what is in the field now.
  let seq = 0;
  const refresh = (): void => {
    if (viewOnly) return;
    const mine = ++seq;
    const query = searchEl.value.trim();
    retryEl.hidden = true;
    void load(target.sessionId, query).then((reply) => {
      if (mine !== seq || !dialog.isConnected || viewOnly) return;
      if (!reply.ok) {
        listEl.replaceChildren();
        setNote(t('Could not load the people on this project. Try again.'));
        retryEl.hidden = false;
        return;
      }
      listEl.replaceChildren(...reply.invitees.map(rowFor));
      if (!reply.invitees.length) {
        setNote(query ? t('No matches.') : t('No one else on this project can join this session yet.'));
      } else {
        setNote(reply.truncated ? t('Keep typing to find more people.') : '');
      }
    });
  };

  searchEl.addEventListener('input', () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => { timer = undefined; refresh(); }, debounceMs);
  });
  retryEl.addEventListener('click', () => { setNote(t('Loading…')); refresh(); });
  refresh();

  // The project's name for the subtitle, and the caller's role there: a viewer is told
  // why there is nobody to invite instead of being shown a list every press of which
  // the instance refuses. Best effort; without an answer the dialog works as it is.
  if (target.projectId) {
    void (deps.listProjects ?? defaultProjects)().then((projects) => {
      const project = projects.find((p) => p.id === target.projectId);
      if (!project || !dialog.isConnected) return;
      if (project.name) {
        projectEl.textContent = tRaw('People on {project}', { project: project.name });
        projectEl.hidden = false;
      }
      if (project.myRole === 'viewer') {
        viewOnly = true;
        seq += 1;
        listEl.replaceChildren();
        searchEl.disabled = true;
        retryEl.hidden = true;
        setNote(t('Only people who can edit this session can invite others.'));
      }
    }).catch(() => { /* the subtitle is optional */ });
  }

  return dialog;
}

// ── The two places that offer it ─────────────────────────────────────────────

/**
 * The "Invite to edit now" button for a session, or null when this member may not
 * invite anyone there. The gate is checked again at the press, since a Share section
 * can stay open while the instance's answer changes.
 */
export function buildInviteToEditButton(
  toolId: string | undefined,
  target: CollabInviteTarget,
  deps: CollabInviteDeps = {},
): HTMLButtonElement | null {
  if (!target.sessionId || !mayInvite(toolId, target)) return null;
  const fixed = targetOf(target);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn--sm';
  btn.dataset.act = 'invite-to-collab';
  btn.textContent = t('Invite to edit now');
  btn.addEventListener('click', () => {
    if (!mayInvite(toolId, fixed)) return;
    openCollabInviteDialog(fixed, deps);
  });
  return btn;
}

/**
 * Fill the presence pill's invite slot (lib/collab-pill-invite.ts) for work collabs;
 * returns the unregister fn.
 *
 * A pill gets the button when the mounted tool holds a team origin (the session the
 * room is keyed by; org/collab-work-opener.ts arms the origin before the collab's
 * remount), this member may invite there, and they are not an observer in the room.
 * Every other pill, including every private collab's, gets none. The checks run again
 * at the press. Called from org/index.ts's member branch beside the `'work'` opener it
 * depends on; the gate reads that opener, so after a sign-out the provider offers
 * nothing even before it is unregistered.
 */
export function registerWorkCollabPillInvite(deps: CollabInviteDeps = {}): () => void {
  return registerCollabPillInvite(({ toolId, role }) => {
    if (role() === 'observer') return null;
    const origin = activeTeamSessionOrigin(toolId);
    if (!origin || !mayInvite(toolId, origin)) return null;
    const target = targetOf(origin);
    return () => {
      if (role() === 'observer' || !mayInvite(toolId, target)) return;
      openCollabInviteDialog(target, deps);
    };
  });
}
