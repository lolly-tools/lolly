// SPDX-License-Identifier: MPL-2.0
/**
 * org/team-people - the "People with access" panel for one team project: who has
 * access and with which role, the invitations still waiting, and "Invite by email".
 *
 * Shown from two places, both in org/: the Team projects modal (a project's "People"
 * action, org/team-projects.ts) and the Share dialog's Team section for a team
 * document (its project's people, org/team-save.ts). What a person may do here comes
 * from org/team-access.ts:
 *
 *  - an owner or a manager changes roles, removes people, revokes invitations and
 *    invites by email (several addresses in one field, a role from the instance's
 *    `invites.projectRoles`), then sees each address's outcome and can copy the link
 *    to send, or, when everyone was added directly, the project's own link;
 *  - a viewer or an editor sees the list only;
 *  - anyone but the owner may leave: their own row (`isMe` from the instance) offers
 *    Leave instead of Remove.
 *
 * Data comes from org/project-members.ts. Every instance-supplied string (names,
 * addresses, the instance's refusal reasons) reaches the page through textContent.
 * Errors show inline, never alert().
 */
import type { TeamRole } from '../lib/session-source.ts';
import { confirmDialog } from '../components/confirm-dialog.ts';
import { announce } from '../a11y.ts';
import { tRaw } from '../i18n.ts';
import { prefersReducedMotion } from '../lib/a11y-prefs.ts';
import { styleTeamBack } from './team-back.ts';
import {
  changeMemberRole, inviteToProject, listProjectPeople, removeMember, revokeInvitation,
  type InviteOutcome, type ProjectInvitation, type ProjectMember, type ProjectPeople,
} from './project-members.ts';
import {
  INVITE_ROLES, MAX_INVITE_EMAILS, inviteLinkKind, inviteResultText, isManagerPlus, parseInviteEmails, peopleMessage, roleLabel,
  shownInviteStatus, waitingAddresses,
  type InviteLinkKind, type InvitePolicy, type InviteRole,
} from './team-access.ts';

export interface PeoplePanelOptions {
  projectId: string;
  /** Shown under the heading when given. */
  projectName?: string;
  /** The instance's invite policy (org/team-access.ts invitePolicy). */
  policy: InvitePolicy | null;
  /** Copy text to the clipboard and say whether the copy worked (`false`, or a
   *  rejection, is a failure; anything else counts as done). The panel's own copier,
   *  which reports a refused clipboard, is used when absent. */
  copy?: (text: string) => Promise<unknown>;
  /** When given, a Back action that runs this (the Team projects modal returns to the
   *  project's sessions). */
  onBack?: () => void;
  backLabel?: string;
}

/** What the panel shows for one loaded list, decided from the server's own answer
 *  about the caller's role. Pure; exported for tests. */
export function peoplePanelView(people: ProjectPeople, policy: InvitePolicy | null): {
  manage: boolean;
  invite: boolean;
  roles: InviteRole[];
} {
  const manage = isManagerPlus(people.myRole);
  const roles = policy?.projectRoles ?? [];
  return { manage, invite: manage && !!policy && roles.length > 0, roles };
}

/** The roles a member's role select offers: the instance's invite roles, plus the
 *  member's own role when that is not among them, in the fixed order. Pure. */
export function roleChoices(current: TeamRole, roles: readonly InviteRole[]): InviteRole[] {
  return INVITE_ROLES.filter((r) => roles.includes(r) || r === current);
}

let panelSeq = 0;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: { className?: string; text?: string; style?: string } = {}): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (attrs.className) node.className = attrs.className;
  if (attrs.text !== undefined) node.textContent = attrs.text;
  if (attrs.style) node.style.cssText = attrs.style;
  return node;
}

function button(label: string, act: string, className = 'btn btn--sm'): HTMLButtonElement {
  const b = el('button', { className, text: label });
  b.type = 'button';
  b.dataset.act = act;
  return b;
}

/**
 * Copy through the async clipboard, then the older selection copy, and say whether
 * either worked. Both can be missing or refused (an instance served over plain http
 * on a LAN, or a clipboard permission turned down), and the panel must not say
 * "Copied!" then.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* try the selection copy below */ }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
  document.body.append(ta);
  try {
    ta.select();
    return typeof document.execCommand === 'function' && document.execCommand('copy') === true;
  } catch {
    return false;
  } finally {
    ta.remove();
  }
}

/** Which control in the list has focus: the row and the control, by data attributes, so
 *  it can be put back after the list is drawn again. */
interface FocusKey { kind: 'member' | 'invitation'; id: string; act: string }

const ROW_STYLE = 'display:flex;align-items:center;justify-content:space-between;gap:.5rem .75rem;flex-wrap:wrap;padding:.45rem 0;border-bottom:1px solid hsl(var(--border))';
const LIST_STYLE = 'list-style:none;margin:.25rem 0 0;padding:0';
const MUTED = 'color:var(--ui-color-text-muted);font-size:var(--fs-sm)';
const SUBHEAD = 'margin:var(--sp-5) 0 var(--sp-2);font-size:var(--fs-md);font-weight:650';

/**
 * Bring a panel that was just opened into view and move focus to its heading, so the
 * person who pressed "People" is taken straight to the list: in a docked Share panel
 * the new panel is drawn below the part that shows. It scrolls only as far as needed
 * ('nearest'), so the People button stays in sight when there is room, and leaves a
 * margin above the panel so the heading's focus ring is not cut off at the top edge.
 * The scroll is instant under reduced motion.
 */
export function revealPeoplePanel(panel: HTMLElement): void {
  if (!panel.isConnected) return;
  panel.style.scrollMarginTop = '.75rem';
  panel.scrollIntoView?.({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  panel.querySelector<HTMLElement>('h3[tabindex]')?.focus({ preventScroll: true });
}

/** Build the panel. It loads the list itself and fills in when the instance answers. */
export function buildPeoplePanel(opts: PeoplePanelOptions): HTMLElement {
  const uid = `team-people-${++panelSeq}`;
  const copy = async (text: string): Promise<boolean> => {
    if (!opts.copy) return copyText(text);
    try { return (await opts.copy(text)) !== false; } catch { return false; }
  };
  const panel = el('section', { className: 'team-people' });
  panel.setAttribute('aria-labelledby', `${uid}-h`);

  if (opts.onBack) {
    const back = styleTeamBack(button(opts.backLabel ?? tRaw('Back'), 'people-back', ''));
    back.addEventListener('click', () => opts.onBack?.());
    panel.append(back);
  }
  const heading = el('h3', { text: tRaw('People with access'), style: 'margin:.1rem 0 .1rem;font-size:var(--fs-xl)' });
  heading.id = `${uid}-h`;
  // A focus target when the control that had focus goes away (a removed row).
  heading.tabIndex = -1;
  panel.append(heading);
  if (opts.projectName) panel.append(el('p', { text: opts.projectName, style: `margin:0;${MUTED}` }));

  const status = el('p', { className: 'team-people-status', style: 'margin:.45rem 0 0;font-size:var(--fs-xs)' });
  status.setAttribute('role', 'status');
  status.hidden = true;
  const say = (msg: string, error: boolean): void => {
    status.textContent = msg;
    status.style.color = error ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))';
    status.hidden = false;
    announce(msg, { assertive: error });
  };

  const listSlot = el('div');
  listSlot.append(el('p', { className: 'projects-empty', text: tRaw('Loading…') }));
  const inviteSlot = el('div');
  panel.append(status, listSlot, inviteSlot);

  let people: ProjectPeople | null = null;
  /** Set once this person has left the project from their own row. */
  let left = false;

  // ── Members and invitations ─────────────────────────────────────────────────
  const memberRow = (m: ProjectMember, manage: boolean, roles: InviteRole[]): HTMLLIElement => {
    const li = el('li', { style: ROW_STYLE });
    li.dataset.member = m.userId;
    const who = el('div', { style: 'min-width:0;flex:1 1 12rem' });
    who.append(el('div', { text: m.name, style: 'font-weight:600;overflow-wrap:anywhere' }));
    if (m.email && m.email !== m.name) who.append(el('div', { text: m.email, style: `${MUTED};overflow-wrap:anywhere` }));
    const controls = el('div', { style: 'display:flex;align-items:center;gap:.4rem;flex-wrap:wrap' });
    if (manage && m.role !== 'owner') {
      // Its own width, not the row's: a full-width select pushed Remove onto a line of its own.
      const select = el('select', { className: 'field-select field-select--sm field-select--auto' });
      select.setAttribute('aria-label', tRaw('Role for {name}', { name: m.name }));
      for (const r of roleChoices(m.role, roles)) {
        const o = el('option', { text: roleLabel(r) });
        o.value = r;
        select.append(o);
      }
      select.value = m.role;
      select.dataset.act = 'people-role';
      // Each change commits at once, so the select is never disabled under the person
      // using it: an arrow key on a closed select fires one change per press, and a
      // disabled control drops the next press and loses focus. Changes go one at a
      // time and the last choice wins; the row says it is busy meanwhile.
      let saving = false;
      const commit = async (): Promise<void> => {
        if (saving) return;
        saving = true;
        li.setAttribute('aria-busy', 'true');
        let failed: { status: number; code?: string } | null = null;
        while (select.value !== m.role && !failed) {
          const got = await changeMemberRole(opts.projectId, m.userId, select.value as InviteRole);
          if (!got.ok) { failed = got; break; }
          m.role = got.data.role;
        }
        saving = false;
        li.removeAttribute('aria-busy');
        if (failed) {
          select.value = m.role;
          say(peopleMessage(failed.status, 'change', failed.code), true);
        } else {
          say(tRaw('{name} is now {role}.', { name: m.name, role: roleLabel(m.role) }), false);
        }
        // Drawn again from the instance's answer either way: a change to your own
        // role can take away what you may do here, and a failed one may mean the row
        // is out of date.
        void load();
      };
      select.addEventListener('change', () => { void commit(); });
      controls.append(select, removeButton(m, li));
    } else {
      controls.append(el('span', { text: roleLabel(m.role), style: MUTED }));
      // Anyone but the owner may leave a project, whatever their role.
      if (m.isMe && m.role !== 'owner') controls.append(removeButton(m, li));
    }
    li.append(who, controls);
    return li;
  };

  /** Remove someone, or, on your own row, leave the project: the same request,
   *  worded as what it does to you. */
  const removeButton = (m: ProjectMember, li: HTMLLIElement): HTMLButtonElement => {
    const self = m.isMe === true;
    const remove = button(self ? tRaw('Leave') : tRaw('Remove'), 'people-remove', 'btn btn--sm btn--ghost');
    remove.setAttribute('aria-label', self ? tRaw('Leave this project') : tRaw('Remove {name}', { name: m.name }));
    remove.addEventListener('click', async () => {
      const ok = await confirmDialog(self
        ? {
          title: tRaw('Leave this project?'),
          message: tRaw('You will no longer see this project or its sessions, unless someone adds you again.'),
          confirmLabel: tRaw('Leave'),
        }
        : {
          title: tRaw('Remove {name}?', { name: m.name }),
          message: tRaw('They will no longer see this project or its sessions.'),
          confirmLabel: tRaw('Remove'),
        });
      if (!ok) return;
      remove.disabled = true;
      const got = await removeMember(opts.projectId, m.userId);
      remove.disabled = false;
      if (!got.ok) { say(peopleMessage(got.status, 'change', got.code), true); void load(); return; }
      const next = neighbourKey(li);
      if (people) people.members = people.members.filter((x) => x.userId !== m.userId);
      li.remove();
      if (self) left = true;
      say(self ? tRaw('You left this project.') : tRaw('Removed {name}.', { name: m.name }), false);
      // Drawn again from the instance: removing yourself takes the panel's controls away.
      void load(next);
    });
    return remove;
  };

  const invitationRow = (inv: ProjectInvitation): HTMLLIElement => {
    const li = el('li', { style: ROW_STYLE });
    li.dataset.invitation = inv.id;
    const who = el('div', { style: 'min-width:0;flex:1 1 12rem' });
    who.append(el('div', { text: inv.email, style: 'overflow-wrap:anywhere' }));
    who.append(el('div', { text: inv.status === 'expired' ? tRaw('Expired') : roleLabel(inv.role), style: MUTED }));
    if (inv.link) {
      const copyInvite = button(tRaw('Copy invite link'), 'people-copy-invite');
      copyInvite.setAttribute('aria-label', tRaw('Copy invite link for {email}', { email: inv.email }));
      copyInvite.addEventListener('click', async () => { say(await copy(inv.link!) ? tRaw('Link copied') : tRaw('Could not copy. Try again.'), false); });
      li.append(copyInvite);
    }
    const revoke = button(tRaw('Revoke'), 'people-revoke', 'btn btn--sm btn--ghost');
    revoke.setAttribute('aria-label', tRaw('Revoke the invitation to {email}', { email: inv.email }));
    revoke.addEventListener('click', async () => {
      revoke.disabled = true;
      const got = await revokeInvitation(opts.projectId, inv.id);
      revoke.disabled = false;
      if (!got.ok) { say(peopleMessage(got.status, 'change', got.code), true); void load(); return; }
      const next = neighbourKey(li);
      if (people) people.invitations = people.invitations.filter((x) => x.id !== inv.id);
      li.remove();
      say(tRaw('Invitation revoked.'), false);
      void load(next);
    });
    li.append(who, revoke);
    return li;
  };

  // ── Keeping focus across a redraw ───────────────────────────────────────────
  const keyOf = (li: Element | null, act?: string): FocusKey | null => {
    if (!(li instanceof HTMLElement)) return null;
    const control = act ?? li.querySelector<HTMLElement>('[data-act]')?.dataset.act;
    if (!control) return null;
    if (li.dataset.member) return { kind: 'member', id: li.dataset.member, act: control };
    if (li.dataset.invitation) return { kind: 'invitation', id: li.dataset.invitation, act: control };
    return null;
  };
  /** The next row's control, else the previous row's: where focus goes when a row goes. */
  const neighbourKey = (li: HTMLElement): FocusKey | null => {
    for (let sib = li.nextElementSibling; sib; sib = sib.nextElementSibling) { const k = keyOf(sib); if (k) return k; }
    for (let sib = li.previousElementSibling; sib; sib = sib.previousElementSibling) { const k = keyOf(sib); if (k) return k; }
    return null;
  };
  const focusedKey = (): FocusKey | null => {
    const active = document.activeElement as HTMLElement | null;
    if (!active || !listSlot.contains(active)) return null;
    return keyOf(active.closest('li'), active.dataset.act);
  };
  const findKey = (key: FocusKey): HTMLElement | null => {
    for (const li of listSlot.querySelectorAll<HTMLElement>(key.kind === 'member' ? 'li[data-member]' : 'li[data-invitation]')) {
      if ((key.kind === 'member' ? li.dataset.member : li.dataset.invitation) !== key.id) continue;
      return li.querySelector<HTMLElement>(`[data-act="${key.act}"]`) ?? li.querySelector<HTMLElement>('[data-act]');
    }
    return null;
  };
  /** Focus was in the list, or fell to the page because its control went away. */
  const listHadFocus = (): boolean => {
    const active = document.activeElement;
    return !active || active === document.body || listSlot.contains(active);
  };

  const renderList = (focus: FocusKey | null | undefined, redraw: boolean): void => {
    if (!people) return;
    // On a redraw, put focus back on the same control, else on `focus` (a removed
    // row's neighbour), else on the heading, so the next Tab does not start from the
    // top of the page.
    const hadFocus = redraw && panel.isConnected && listHadFocus();
    const keep = focusedKey() ?? focus ?? null;
    const view = peoplePanelView(people, opts.policy);
    const members = el('ul', { style: LIST_STYLE });
    members.append(...people.members.map((m) => memberRow(m, view.manage, view.roles)));
    listSlot.replaceChildren(members);
    if (view.manage && people.invitations.length) {
      const pending = el('ul', { style: LIST_STYLE });
      pending.append(...people.invitations.map(invitationRow));
      listSlot.append(el('h4', { text: tRaw('Waiting to accept'), style: SUBHEAD }), pending);
    }
    if (view.invite && !inviteSlot.firstChild) inviteSlot.append(inviteForm(view.roles));
    if (!view.invite) inviteSlot.replaceChildren();
    if (hadFocus) ((keep ? findKey(keep) : null) ?? heading).focus();
  };

  // The newest load wins: two changes in a row must not draw the older list last.
  let loadSeq = 0;
  let loaded = false;
  const load = async (focus?: FocusKey | null): Promise<void> => {
    const seq = ++loadSeq;
    const got = await listProjectPeople(opts.projectId);
    if (seq !== loadSeq) return;
    if (!got.ok) {
      const hadFocus = loaded && panel.isConnected && listHadFocus();
      // The first load fails: nothing to show. A reload after a change fails: keep
      // the list as it is, the status line already says what went wrong.
      if (!loaded) { listSlot.replaceChildren(); say(peopleMessage(got.status, 'load', got.code), true); }
      else if (got.status === 403 || got.status === 404) {
        // No longer allowed to see the list (you removed yourself), or the project is gone.
        people = null;
        listSlot.replaceChildren();
        inviteSlot.replaceChildren();
        // Having just left, a 403 is the expected answer: the status line already says so.
        if (!(left && got.status === 403)) say(peopleMessage(got.status, 'load', got.code), true);
      }
      if (hadFocus) heading.focus();
      return;
    }
    const redraw = loaded;
    loaded = true;
    people = got.data;
    renderList(focus, redraw);
  };

  // ── Invite by email ─────────────────────────────────────────────────────────
  const inviteForm = (roles: InviteRole[]): HTMLFormElement => {
    const form = el('form', { className: 'team-people-invite', style: 'display:flex;flex-direction:column;gap:.35rem;margin-top:.4rem' });
    form.noValidate = true;
    form.append(el('h4', { text: tRaw('Invite by email'), style: SUBHEAD }));
    const label = el('label', { text: tRaw('Email addresses'), style: 'font-size:var(--fs-sm);font-weight:600' });
    label.htmlFor = `${uid}-emails`;
    const field = el('textarea', { className: 'field-input' });
    field.id = `${uid}-emails`;
    field.rows = 2;
    field.autocomplete = 'off';
    field.spellcheck = false;
    field.setAttribute('aria-describedby', `${uid}-hint ${uid}-invite-status`);
    field.addEventListener('input', () => { field.removeAttribute('aria-invalid'); });
    const hints: string[] = [tRaw('Separate addresses with commas or spaces. Existing users get access immediately.')];
    const policy = opts.policy;
    if (policy?.domains.length) hints.push(tRaw('New people must have an address at {domains}.', { domains: policy.domains.join(', ') }));
    if (policy && !policy.canInvite) hints.push(tRaw('You can add people who already use this instance. Inviting anyone new is not turned on for you.'));
    const hint = el('p', { text: hints.join(' '), style: `margin:0;${MUTED}` });
    hint.id = `${uid}-hint`;

    const roleLabelEl = el('label', { text: tRaw('Role'), style: 'font-size:var(--fs-sm);font-weight:600' });
    roleLabelEl.htmlFor = `${uid}-role`;
    const role = el('select', { className: 'field-select field-select--sm' });
    role.id = `${uid}-role`;
    for (const r of roles) {
      const o = el('option', { text: roleLabel(r) });
      o.value = r;
      role.append(o);
    }
    role.value = roles.includes('editor') ? 'editor' : roles[0]!;

    const actions = el('div', { style: 'display:flex;gap:.5rem;flex-wrap:wrap;justify-content:flex-end' });
    const send = el('button', { className: 'btn btn--primary btn--sm', text: tRaw('Invite') });
    send.type = 'submit';
    send.dataset.act = 'people-invite';
    actions.append(send);

    const results = el('ul', { className: 'team-people-results', style: `${LIST_STYLE};font-size:var(--fs-sm)` });
    results.hidden = true;
    const linkSlot = el('div');
    const password = el('input'); password.type = 'checkbox';
    const passwordLabel = el('label', { className: 'team-invite-password' });
    passwordLabel.append(password, el('span', { text: tRaw('Let new people set a password from their invitation link') }));
    if (policy?.canInvite && policy.passwordSetup) {
      field.addEventListener('input', () => {
        const emails = parseInviteEmails(field.value).emails;
        password.checked = !!emails.length && emails.every(email => policy.passwordDomains?.includes(email.split('@').pop() ?? ''));
      });
    }

    // The form's own status line, under the field it is about: on a phone, or with a
    // long list, the panel's status line above the list is out of sight from here.
    const formStatus = el('p', { className: 'team-people-invite-status', style: 'margin:0;font-size:var(--fs-xs)' });
    formStatus.id = `${uid}-invite-status`;
    formStatus.setAttribute('role', 'status');
    formStatus.hidden = true;
    const formSay = (msg: string, error: boolean): void => {
      formStatus.textContent = msg;
      formStatus.style.color = error ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))';
      formStatus.hidden = false;
      announce(msg, { assertive: error });
    };
    const formClear = (): void => { formStatus.hidden = true; formStatus.textContent = ''; };
    const invalidField = (msg: string): void => {
      field.setAttribute('aria-invalid', 'true');
      formSay(msg, true);
      field.focus();
    };

    form.append(label, field, hint, formStatus, roleLabelEl, role);
    if (policy?.canInvite && policy.passwordSetup) form.append(passwordLabel);
    form.append(actions, results, linkSlot);

    // The link under the results. With anyone invited it is the link to send them;
    // when everyone was added directly they can open the project already, so it is
    // offered as the project's own link, for whatever else the person wants to do.
    const showLink = (link: string, kind: Exclude<InviteLinkKind, 'none'>): void => {
      const invited = kind === 'invited';
      const row = el('div', { className: 'share-link-row', style: 'margin-top:.5rem' });
      const input = el('input', { className: 'share-link-field' });
      input.type = 'text';
      input.readOnly = true;
      input.value = link;
      input.setAttribute('aria-label', tRaw('Project link'));
      const copyBtn = el('button', { className: 'share-copy-btn btn btn--sm', text: tRaw('Copy project link') });
      copyBtn.type = 'button';
      copyBtn.dataset.act = 'people-copy-link';
      copyBtn.addEventListener('click', async () => {
        const ok = await copy(input.value);
        if (!ok) {
          // Nothing reached the clipboard: leave the link selected for a manual copy.
          input.focus();
          input.select();
          formSay(tRaw('Could not copy. The link is selected, ready to copy by hand.'), true);
          return;
        }
        input.select();
        announce(tRaw('Link copied'));
        const prev = copyBtn.textContent;
        copyBtn.textContent = tRaw('Copied!');
        setTimeout(() => { copyBtn.textContent = prev; }, 1500);
      });
      row.append(input, copyBtn);
      if (invited) {
        linkSlot.replaceChildren(row, el('p', {
          text: tRaw('Existing members can use the project link. Send new people their personal invitation link.'),
          style: `margin:.2rem 0 0;${MUTED}`,
        }));
        return;
      }
      const said = kind === 'added' ? tRaw('Added. They can open this project now.') : tRaw('They can already open this project.');
      const note = el('p', { text: said, style: 'margin:.5rem 0 0;font-size:var(--fs-sm)' });
      note.dataset.linkNote = kind;
      linkSlot.replaceChildren(note, row);
    };

    // Each address's outcome, and the link under them. An 'already' address with an
    // invitation still waiting in the list is shown as invited: it has to sign in first.
    let lastOutcome: InviteOutcome | null = null;
    let sentRole: InviteRole = role.value as InviteRole;
    let drawn = '';
    const drawOutcome = (outcome: InviteOutcome): void => {
      const waiting = waitingAddresses(people?.invitations ?? []);
      const shown = outcome.results.map((r) => shownInviteStatus(r, waiting));
      const key = shown.join(' ');
      if (outcome === lastOutcome && key === drawn) return;
      lastOutcome = outcome;
      drawn = key;
      results.replaceChildren(...outcome.results.map((r, i) => {
        const li = el('li', { style: 'display:flex;justify-content:space-between;gap:.75rem;flex-wrap:wrap;padding:.2rem 0' });
        li.dataset.status = shown[i]!;
        li.append(
          el('span', { text: r.email, style: 'overflow-wrap:anywhere' }),
          el('span', { text: inviteResultText(shown[i]!, r.reason, policy?.domains), style: r.status === 'refused' ? 'color:hsl(var(--destructive))' : MUTED }),
        );
        if (r.link && r.status !== 'refused') {
          const delivery = el('div', { className: 'team-invite-delivery' });
          const personal = el('input', { className: 'field-input' }); personal.readOnly = true; personal.value = r.link;
          personal.setAttribute('aria-label', tRaw('Invite link for {email}', { email: r.email }));
          const copyInvite = button(tRaw('Copy invite link'), 'people-copy-invite');
          copyInvite.addEventListener('click', async () => {
            const ok = await copy(r.link!); if (!ok) { personal.focus(); personal.select(); }
            formSay(ok ? tRaw('Link copied') : tRaw('Could not copy. The link is selected, ready to copy by hand.'), !ok);
          });
          const copyMessage = button(tRaw('Copy invite message'), 'people-copy-message');
          copyMessage.addEventListener('click', async () => {
            const context = outcome.message;
            const message = [tRaw('{inviter} invited you to {project} on {workspace}. Your role: {role}.', {
              inviter: context?.inviter || tRaw('A teammate'), project: opts.projectName || tRaw('Team project'), workspace: context?.workspace || tRaw('your organisation'), role: roleLabel(sentRole),
            }), r.link!, context?.providers.length ? tRaw('Sign in with {providers}.', { providers: context.providers.join(', ') }) : '', tRaw('Sign in as {email}.', { email: r.email }), context?.note || ''].filter(Boolean).join('\n');
            const ok = await copy(message); formSay(ok ? tRaw('Invite message copied') : tRaw('Could not copy. Try again.'), !ok);
          });
          delivery.append(personal, copyInvite, copyMessage, el('p', { text: tRaw('Send this personal link to {email}. It opens the invitation and then this project.', { email: r.email }), style: MUTED })); li.append(delivery);
        }
        return li;
      }));
      results.hidden = !outcome.results.length;
      const kind = inviteLinkKind(outcome.results, waiting);
      if (kind === 'none') linkSlot.replaceChildren();
      else showLink(outcome.link, kind);
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (send.disabled) return;
      const { emails, invalid } = parseInviteEmails(field.value);
      if (invalid.length) { invalidField(tRaw('These are not email addresses: {list}', { list: invalid.join(', ') })); return; }
      if (!emails.length) { invalidField(tRaw('Type at least one email address.')); return; }
      if (emails.length > MAX_INVITE_EMAILS) { invalidField(tRaw('Invite up to {n} addresses at a time.', { n: MAX_INVITE_EMAILS })); return; }
      field.removeAttribute('aria-invalid');
      formClear();
      send.disabled = true;
      const prev = send.textContent;
      send.textContent = tRaw('Inviting…');
      try {
        sentRole = role.value as InviteRole;
        const got = await inviteToProject(opts.projectId, emails, sentRole, policy?.passwordSetup === true && password.checked);
        if (!got.ok) { formSay(peopleMessage(got.status, 'invite', got.code), true); return; }
        drawOutcome(got.data);
        const sent = got.data.results.filter((r) => r.status === 'added' || r.status === 'invited').length;
        // Only addresses that went through leave the field; refused ones stay to fix.
        const kept = got.data.results.filter((r) => r.status === 'refused').map((r) => r.email);
        field.value = kept.join(', ');
        announce(sent ? tRaw('People added or invited: {n}', { n: sent }) : tRaw('Nobody new was added.'));
        // The reloaded list may know of an invitation this one did not: draw again then.
        const outcome = got.data;
        void load().then(() => { if (lastOutcome === outcome) drawOutcome(outcome); });
      } finally {
        send.disabled = false;
        send.textContent = prev;
        // Disabling the focused button dropped focus to the page; put it back here,
        // before the list redraw, so focus stays in the form.
        if (!document.activeElement || document.activeElement === document.body) send.focus();
      }
    });
    return form;
  };

  void load();
  return panel;
}
