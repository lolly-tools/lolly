// SPDX-License-Identifier: MPL-2.0
/**
 * org/team-people - the "People with access" panel for one team project: who has
 * access and with which role, the people asking for access, the invitations still
 * waiting, and "Invite by email".
 *
 * Shown from two places, both in org/: the Team projects modal (a project's "People"
 * action, org/team-projects.ts) and the Share dialog's Team section for a team
 * document (its project's people, org/team-save.ts). What a person may do here comes
 * from org/team-access.ts:
 *
 *  - an owner or a manager changes roles, removes people, answers access requests
 *    (Approve with a role, or Decline) and looks after the invitations: each waiting
 *    one shows when it ends, whether its link was opened and who invited, with Copy
 *    link, Copy message, New link and Revoke, and one that expired offers Invite
 *    again. They invite by email (several addresses in one field, a role from the
 *    instance's `invites.projectRoles`, and, for an admin where password sign-in is
 *    on, a tick that lets the link set a password), then see each address's outcome
 *    with the message to send, and the link to copy;
 *  - a viewer or an editor sees the list only; a viewer is also offered Ask to edit
 *    when the instance takes access requests (the form is org/access-request.ts);
 *  - anyone but the owner may leave: their own row (`isMe` from the instance) offers
 *    Leave instead of Remove;
 *  - people who reach the project through its group or a workspace admin role (the
 *    instance's `effective` list, sent to managers only) are rows of their own after the
 *    members: "Editor · via team", "Admin · via workspace role", with no role select and
 *    no Remove, since that access is not changed here. A manager who is not a workspace
 *    admin sees no admin rows and is told that admins can also open the project;
 *  - whoever the instance says may hand the project on (`canTransfer`: the owner, or a
 *    holder of `project.manage`) sees Make owner on the other member rows; the old owner
 *    stays on as a Manager. An instance that does not say offers it to the owner only.
 *
 * Data comes from org/project-members.ts and the message text from
 * org/invite-message.ts. Every instance-supplied string (names, addresses, notes,
 * the instance's refusal reasons) reaches the page through textContent. Errors show
 * inline, never alert().
 */
import { getSessionSource, type TeamRole } from '../lib/session-source.ts';
import { confirmDialog } from '../components/confirm-dialog.ts';
import { announce } from '../a11y.ts';
import { tRaw } from '../i18n.ts';
import { copyText } from '../lib/copy-text.ts';
import { prefersReducedMotion } from '../lib/a11y-prefs.ts';
import { accountAvatar } from '../lib/account-headshots.ts';
import { styleTeamBack } from './team-back.ts';
import type { InboxWatch } from './access-request.ts';
import { inviteMessage } from './invite-message.ts';
import {
  answerRequest, changeMemberRole, inviteToProject, listProjectPeople, reinvite, removeMember, revokeInvitation,
  rotateInvitationLink, signInProviderNames, transferProjectOwner,
  type InviteMessageContext, type InviteOutcome, type InviteResult, type ProjectInvitation, type ProjectMember,
  type ProjectPeople, type ProjectRequest,
} from './project-members.ts';
import {
  INVITE_ROLES, MAX_INVITE_EMAILS, invitationLines, inviteLinkKind, inviteResultText, isManagerPlus, parseInviteEmails,
  passwordTickDefault, peopleMessage, requestAnsweredText, requestAskText, requestAskedText, requestRefusalText,
  roleHelpText, roleLabel, shownInviteStatus, waitingAddresses,
  type InviteLinkKind, type InvitePolicy, type InviteRole, type InviteShownStatus,
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
  /** A viewer, on an instance that takes access requests: offer Ask to edit. */
  askToEdit: boolean;
  /** The instance says this person may hand the project on (the owner, or a holder of
   *  `project.manage`): offer Make owner on the other member rows. Without that answer
   *  (an older instance), the owner only, whom the transfer always accepts. */
  transfer: boolean;
} {
  const manage = isManagerPlus(people.myRole);
  const roles = policy?.projectRoles ?? [];
  return {
    manage, invite: manage && !!policy && roles.length > 0, roles,
    askToEdit: people.myRole === 'viewer' && policy?.askToEdit === true,
    // The same test the transfer applies, from the instance: a workspace role does not
    // decide it here, since `project.manage` can be granted or denied by grant.
    transfer: people.canTransfer ?? people.myRole === 'owner',
  };
}

/**
 * The words for a row whose access does not come from its own place on the project:
 * "Editor · via team" for the project's group (the group's name reaches managers only;
 * without it the row shows the role alone), "Admin · via workspace role" for a workspace
 * admin. Empty for the owner and for member rows, which carry their own controls. Pure;
 * exported for tests.
 */
export function viaText(m: Pick<ProjectMember, 'role' | 'via' | 'group'>): string {
  if (m.via === 'admin') return tRaw('Admin · via workspace role');
  if (m.via !== 'group') return '';
  return m.group ? tRaw('{role} · via {group}', { role: roleLabel(m.role), group: m.group }) : roleLabel(m.role);
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

/** A panel action: a small button with a full-size touch target. */
function button(label: string, act: string, className = 'btn btn--sm'): HTMLButtonElement {
  const b = el('button', { className, text: label });
  b.type = 'button';
  b.dataset.act = act;
  b.style.minHeight = 'var(--ui-size-target)';
  return b;
}

/** Show "Copied!" on a copy button for a moment, then its own label again. */
function flashCopied(b: HTMLButtonElement): void {
  const label = b.dataset.label ?? b.textContent ?? '';
  b.dataset.label = label;
  b.textContent = tRaw('Copied!');
  setTimeout(() => { b.textContent = label; }, 1500);
}

/**
 * A watch over the inbox for the ask form, so an answer to the request moves the form
 * on with no reload. The inbox module loads with the first subscription; without it
 * the form keeps its state until the panel is opened again.
 */
const inboxWatch: InboxWatch = (fn) => {
  let off: (() => void) | null = null;
  let stopped = false;
  import('./inbox.ts')
    .then((m) => { if (!stopped) off = m.onInboxChange(fn); })
    .catch(() => { /* no inbox: the panel shows the new role when opened again */ });
  return () => { stopped = true; off?.(); };
};

/** The host of a link ("lolly.ing"), or '' when it is not a URL. */
function hostOf(link: string): string {
  try { return new URL(link).host; } catch { return ''; }
}

/**
 * Copy through the async clipboard, then the older selection copy, and say whether
 * either worked. Both can be missing or refused (an instance served over plain http
 * on a LAN, or a clipboard permission turned down), and the panel must not say
 * "Copied!" then.
 */
export { copyText } from '../lib/copy-text.ts';

/** Which control in the list has focus: the row and the control, by data attributes, so
 *  it can be put back after the list is drawn again. */
interface FocusKey { kind: 'member' | 'invitation' | 'request'; id: string; act: string }
const ROW_KINDS: ReadonlyArray<FocusKey['kind']> = ['member', 'invitation', 'request'];

const ROW_STYLE = 'display:flex;align-items:center;justify-content:space-between;gap:.5rem .75rem;flex-wrap:wrap;padding:.45rem 0;border-bottom:1px solid hsl(var(--border))';
const LIST_STYLE = 'list-style:none;margin:.25rem 0 0;padding:0';
const MUTED = 'color:var(--ui-color-text-muted);font-size:var(--fs-sm)';
const SUBHEAD = 'margin:var(--sp-5) 0 var(--sp-2);font-size:var(--fs-md);font-weight:650';
const CONTROLS = 'display:flex;align-items:center;gap:.4rem;flex-wrap:wrap';
/** The requests box: a full wash and a full border, so it stands out from the list
 *  without a one-sided rail. */
const REQUESTS_STYLE = 'margin:.6rem 0 .2rem;padding:.6rem .75rem;border:1px solid hsl(var(--primary) / 0.4);border-radius:var(--radius);background:hsl(var(--primary) / 0.06);display:flex;flex-direction:column;gap:.35rem';

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
  let idSeq = 0;
  const nextId = (): string => `${uid}-x${++idSeq}`;
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

  const askSlot = el('div');
  const listSlot = el('div');
  listSlot.append(el('p', { className: 'projects-empty', text: tRaw('Loading…') }));
  const inviteSlot = el('div');
  panel.append(status, askSlot, listSlot, inviteSlot);

  let people: ProjectPeople | null = null;
  /** Set once this person has left the project from their own row. */
  let left = false;

  // ── Words for the invite message ────────────────────────────────────────────
  // The project's name for the message: the caller's, else the one in the person's
  // project list (the Share dialog opens the panel without a name).
  let foundName: string | undefined;
  let nameAsked = false;
  const projectName = (): string | undefined => opts.projectName?.trim() || foundName;
  const findName = (): void => {
    if (opts.projectName || nameAsked) return;
    nameAsked = true;
    const source = getSessionSource();
    if (!source) return;
    void source.listProjects()
      .then((list) => { foundName = list.find((p) => p.id === opts.projectId)?.name.trim() || undefined; })
      .catch(() => { /* the message then says the workspace only */ });
  };
  // The words from the last invite answer, and the sign-ins from the instance's
  // public config when neither the list nor an answer carried any.
  let answerContext: InviteMessageContext | undefined;
  let fallbackProviders: string[] = [];
  let providersAsked = false;
  const context = (): InviteMessageContext => {
    const c = people?.message ?? answerContext;
    return {
      workspace: c?.workspace || opts.policy?.workspace || '',
      providers: c?.providers.length ? c.providers : fallbackProviders,
      ...(c?.inviter ? { inviter: c.inviter } : {}),
      ...(c?.note ? { note: c.note } : {}),
    };
  };
  const needProviders = (): void => {
    if (providersAsked || context().providers.length) return;
    providersAsked = true;
    void signInProviderNames().then((names) => { fallbackProviders = names; });
  };
  /** The message for a waiting invitation, from the list's own link and end day. */
  const waitingMessage = (inv: ProjectInvitation, link: string): string => {
    const c = context();
    const workspace = c.workspace || hostOf(link);
    return inviteMessage({
      kind: 'invited', inviter: inv.invitedByName ?? c.inviter ?? workspace, workspace, project: projectName(), role: inv.role,
      email: inv.email, link, providers: c.providers, expiresAt: inv.expiresAt, passwordSetup: inv.passwordSetup, note: c.note,
    });
  };

  /**
   * Copy a link or a message. When the clipboard refuses, the text is put in a
   * read-only field in `slot`, selected for a copy by hand, and `tell` says so.
   */
  const copyOut = async (o: {
    text: string; kind: 'link' | 'message'; email: string; control: HTMLButtonElement; slot: HTMLElement;
    tell: (msg: string, error: boolean) => void;
  }): Promise<void> => {
    if (await copy(o.text)) {
      o.slot.replaceChildren();
      announce(o.kind === 'message' ? tRaw('Invite message copied') : tRaw('Link copied'));
      flashCopied(o.control);
      return;
    }
    if (o.kind === 'message') {
      const id = nextId();
      const label = el('label', { text: tRaw('Invite message for {email}', { email: o.email }), style: 'display:block;margin-top:.35rem;font-size:13px;font-weight:600' });
      label.htmlFor = id;
      const area = el('textarea', { className: 'field-input', style: 'width:100%;font-size:13px' });
      area.id = id;
      area.readOnly = true;
      area.value = o.text;
      area.rows = Math.min(8, o.text.split('\n').length + 1);
      o.slot.replaceChildren(label, area);
      area.focus();
      area.select();
      o.tell(tRaw('Could not copy. The message is selected, ready to copy by hand.'), true);
      return;
    }
    const field = el('input', { className: 'share-link-field', style: 'margin-top:.35rem;width:100%' });
    field.type = 'text';
    field.readOnly = true;
    field.value = o.text;
    field.setAttribute('aria-label', tRaw('Invite link'));
    o.slot.replaceChildren(field);
    field.focus();
    field.select();
    o.tell(tRaw('Could not copy. The link is selected, ready to copy by hand.'), true);
  };

  // ── Members and invitations ─────────────────────────────────────────────────
  const memberRow = (m: ProjectMember, manage: boolean, roles: InviteRole[], transfer: boolean): HTMLLIElement => {
    const li = el('li', { style: ROW_STYLE });
    li.append(accountAvatar(li.ownerDocument, m.userId, m.name));
    li.dataset.member = m.userId;
    if (m.via) li.dataset.via = m.via;
    const who = el('div', { style: 'min-width:0;flex:1 1 12rem' });
    const nameEl = el('div', { text: m.name, style: 'font-weight:600;overflow-wrap:anywhere' });
    nameEl.id = nextId();
    who.append(nameEl);
    if (m.email && m.email !== m.name) who.append(el('div', { text: m.email, style: `${MUTED};overflow-wrap:anywhere` }));
    const controls = el('div', { style: CONTROLS });
    // Access through the project's group or a workspace admin role is not a row on the
    // project: nobody can change or remove it here, so the row says where it comes from.
    const inherited = viaText(m);
    if (inherited) {
      controls.append(el('span', { text: inherited, style: MUTED }));
    } else if (manage && m.role !== 'owner') {
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
      controls.append(select);
      if (transfer && !m.isMe) controls.append(makeOwnerButton(m, li, nameEl.id));
      controls.append(removeButton(m, li));
    } else {
      controls.append(el('span', { text: roleLabel(m.role), style: MUTED }));
      // Anyone but the owner may leave a project, whatever their role.
      if (m.isMe && m.role !== 'owner') controls.append(removeButton(m, li));
    }
    li.append(who, controls);
    return li;
  };

  /** Hand the project to someone already on the project. The instance keeps the current
   *  owner on the project as a Manager; only the owner (or a workspace admin who manages
   *  every project) is offered this. */
  const makeOwnerButton = (m: ProjectMember, li: HTMLLIElement, nameId: string): HTMLButtonElement => {
    const make = button(tRaw('Make owner'), 'people-make-owner', 'btn btn--sm btn--ghost');
    // Read with the person's name, which the row already shows.
    make.setAttribute('aria-describedby', nameId);
    make.addEventListener('click', async () => {
      if (li.getAttribute('aria-busy') === 'true') return;
      const ok = await confirmDialog({
        title: tRaw('Make {name} the owner of {project}?', { name: m.name, project: projectName() || tRaw('Team project') }),
        message: tRaw('The current owner stays on the project as a Manager.'),
        confirmLabel: tRaw('Make owner'),
        danger: false,
      });
      if (!ok) return;
      li.setAttribute('aria-busy', 'true');
      const got = await transferProjectOwner(opts.projectId, m.userId);
      li.removeAttribute('aria-busy');
      if (!got.ok) { say(peopleMessage(got.status, 'change', got.code), true); void load(); return; }
      say(tRaw('{name} is now {role}.', { name: m.name, role: roleLabel('owner') }), false);
      // Drawn again from the instance: the old owner is a Manager now, and may no longer
      // be the one who can hand the project on.
      void load({ kind: 'member', id: m.userId, act: 'people-role' });
    });
    return make;
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

  /** Make a new link for a waiting invitation, after saying what happens to the old one. */
  const newLink = async (inv: ProjectInvitation, li: HTMLLIElement): Promise<void> => {
    if (li.getAttribute('aria-busy') === 'true') return;
    const ok = await confirmDialog({
      title: tRaw('Make a new link for {email}?', { email: inv.email }),
      message: tRaw('Links copied earlier for this address will stop working.'),
      confirmLabel: tRaw('New link'),
      danger: false,
    });
    if (!ok) return;
    li.setAttribute('aria-busy', 'true');
    const got = await rotateInvitationLink(opts.projectId, inv.id);
    li.removeAttribute('aria-busy');
    if (!got.ok) { say(peopleMessage(got.status, 'link', got.code), true); void load(); return; }
    say(tRaw('New link made. Links copied earlier for this address no longer work.'), false);
    void load({ kind: 'invitation', id: inv.id, act: 'people-new-link' });
  };

  /** Send an expired invitation again: a fresh invitation with a new link. */
  const inviteAgain = async (inv: ProjectInvitation, li: HTMLLIElement): Promise<void> => {
    if (li.getAttribute('aria-busy') === 'true') return;
    li.setAttribute('aria-busy', 'true');
    const got = await reinvite(opts.projectId, inv.id);
    li.removeAttribute('aria-busy');
    if (!got.ok) { say(peopleMessage(got.status, 'invite', got.code), true); void load(); return; }
    const r = got.data;
    if (r.status === 'refused') { say(inviteResultText('refused', r.reason, opts.policy?.domains), true); void load(); return; }
    say(r.status === 'invited' ? tRaw('Invited again. The earlier link no longer works.') : inviteResultText(r.status), false);
    // Focus moves to the invitation that replaces the expired one, on its first control.
    void load(r.invitationId ? { kind: 'invitation', id: r.invitationId, act: 'people-copy-invite-link' } : neighbourKey(li, 'people-reinvite'), true);
  };

  const revokeButton = (inv: ProjectInvitation, li: HTMLLIElement): HTMLButtonElement => {
    const revoke = button(tRaw('Revoke'), 'people-revoke', 'btn btn--sm btn--ghost');
    revoke.setAttribute('aria-label', tRaw('Revoke the invitation to {email}', { email: inv.email }));
    revoke.addEventListener('click', async () => {
      revoke.disabled = true;
      const got = await revokeInvitation(opts.projectId, inv.id);
      revoke.disabled = false;
      if (!got.ok) { say(peopleMessage(got.status, 'change', got.code), true); void load(); return; }
      const next = neighbourKey(li, 'people-revoke');
      if (people) people.invitations = people.invitations.filter((x) => x.id !== inv.id);
      li.remove();
      say(tRaw('Invitation revoked.'), false);
      void load(next);
    });
    return revoke;
  };

  const invitationRow = (inv: ProjectInvitation): HTMLLIElement => {
    const li = el('li', { style: ROW_STYLE });
    const avatar = accountAvatar(li.ownerDocument, `invite:${inv.id}`, inv.email.split('@')[0]!);
    avatar.dataset.waiting = 'true'; li.append(avatar);
    li.dataset.invitation = inv.id;
    li.dataset.status = inv.status;
    const who = el('div', { style: 'min-width:0;flex:1 1 12rem' });
    const address = el('div', { text: inv.email, style: 'overflow-wrap:anywhere' });
    address.id = nextId();
    const lines = invitationLines(inv);
    who.append(
      address,
      el('div', { text: [roleLabel(inv.role), lines.ends].filter(Boolean).join(' · '), style: MUTED }),
      el('div', { text: [lines.state, lines.by].filter(Boolean).join(' · '), style: MUTED }),
    );
    // A link that sets a password is a key to the account: said on the row that copies the link.
    if (inv.link && inv.passwordSetup) {
      who.append(el('div', { text: tRaw('Anyone with this link can set the password for {email}. Send the link privately.', { email: inv.email }), style: MUTED }));
    }
    // The actions are grouped under the address, so a screen reader reads each action with the address.
    const controls = el('div', { style: CONTROLS });
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-labelledby', address.id);
    const slot = el('div', { style: 'flex:1 1 100%' });
    const link = inv.link;
    if (link) {
      const copyLink = button(tRaw('Copy link'), 'people-copy-invite-link');
      copyLink.addEventListener('click', () => { void copyOut({ text: link, kind: 'link', email: inv.email, control: copyLink, slot, tell: say }); });
      const copyMessage = button(tRaw('Copy message'), 'people-copy-message');
      copyMessage.addEventListener('click', () => {
        void copyOut({ text: waitingMessage(inv, link), kind: 'message', email: inv.email, control: copyMessage, slot, tell: say });
      });
      const fresh = button(tRaw('New link'), 'people-new-link');
      fresh.addEventListener('click', () => { void newLink(inv, li); });
      controls.append(copyLink, copyMessage, fresh);
    }
    if (inv.status === 'expired' && opts.policy?.canInvite) {
      const again = button(tRaw('Invite again'), 'people-reinvite');
      again.addEventListener('click', () => { void inviteAgain(inv, li); });
      controls.append(again);
    }
    controls.append(revokeButton(inv, li));
    li.append(who, controls, slot);
    return li;
  };

  // ── Asking for access ───────────────────────────────────────────────────────
  const requestRow = (req: ProjectRequest, roles: InviteRole[], helpId: string): HTMLLIElement => {
    const li = el('li', { style: 'display:flex;align-items:center;justify-content:space-between;gap:.35rem .75rem;flex-wrap:wrap' });
    li.append(accountAvatar(li.ownerDocument, req.userId ?? `request:${req.id}`, req.name));
    li.dataset.request = req.id;
    const who = el('div', { style: 'min-width:0;flex:1 1 12rem' });
    const name = el('div', { text: req.name, style: 'font-weight:600;overflow-wrap:anywhere' });
    name.id = nextId();
    who.append(name);
    if (req.email && req.email !== req.name) who.append(el('div', { text: req.email, style: `${MUTED};overflow-wrap:anywhere` }));
    who.append(el('div', { text: [requestAskText(req.role), requestAskedText(req.createdAt)].filter(Boolean).join(' · '), style: MUTED }));
    if (req.note) who.append(el('p', { text: req.note, style: 'margin:.2rem 0 0;font-size:13px;white-space:pre-wrap;overflow-wrap:anywhere' }));
    const controls = el('div', { style: CONTROLS });
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-labelledby', name.id);
    let select: HTMLSelectElement | null = null;
    if (roles.length) {
      select = el('select', { className: 'field-select field-select--sm field-select--auto' });
      select.setAttribute('aria-label', tRaw('Role for {name}', { name: req.name }));
      select.setAttribute('aria-describedby', helpId);
      select.dataset.act = 'people-request-role';
      for (const r of roles) {
        const o = el('option', { text: roleLabel(r) });
        o.value = r;
        select.append(o);
      }
      select.value = roles.includes(req.role) ? req.role : roles[0]!;
      controls.append(select);
    }
    const approve = button(tRaw('Approve'), 'people-approve', 'btn btn--primary btn--sm');
    const decline = button(tRaw('Decline'), 'people-decline', 'btn btn--sm btn--ghost');
    // Not disabled while the answer is sent, so the focused button keeps focus; the row
    // says it is busy and a second press waits for the first.
    const answer = async (action: 'approve' | 'decline', act: string): Promise<void> => {
      if (li.getAttribute('aria-busy') === 'true') return;
      li.setAttribute('aria-busy', 'true');
      const role = action === 'approve' ? (select?.value as InviteRole | undefined) ?? req.role : undefined;
      const got = await answerRequest(req.id, action, role);
      li.removeAttribute('aria-busy');
      if (got.ok) say(requestAnsweredText(action, got.request.answerRole ?? role ?? req.role), false);
      else say(requestRefusalText(got.status, got.request), true);
      // An answered request (by this person, or by someone else first) leaves the list,
      // so focus moves to the next one. One that could not be sent stays where it was.
      if (got.ok || [403, 404, 409].includes(got.status)) void load(neighbourKey(li, act), true);
      else void load();
    };
    approve.addEventListener('click', () => { void answer('approve', 'people-approve'); });
    decline.addEventListener('click', () => { void answer('decline', 'people-decline'); });
    controls.append(approve, decline);
    li.append(who, controls);
    return li;
  };

  const requestSection = (requests: ProjectRequest[], roles: InviteRole[]): HTMLElement => {
    const box = el('section', { className: 'team-people-requests', style: REQUESTS_STYLE });
    const h = el('h4', { text: tRaw('Asking for access'), style: 'margin:0;font-size:13px;font-weight:650' });
    h.id = nextId();
    box.setAttribute('aria-labelledby', h.id);
    const help = el('p', { text: roleHelpText(), style: `margin:0;${MUTED}` });
    help.id = nextId();
    const list = el('ul', { style: 'list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.6rem' });
    list.append(...requests.map((r) => requestRow(r, roles, help.id)));
    box.append(h);
    if (roles.length) box.append(help);
    box.append(list);
    return box;
  };

  // ── Ask to edit, for a viewer ───────────────────────────────────────────────
  let askShown = false;
  const renderAsk = (show: boolean): void => {
    if (!show) { askSlot.replaceChildren(); askShown = false; return; }
    if (askShown) return;
    askShown = true;
    const box = el('div', { style: 'margin:.5rem 0 0;display:flex;flex-direction:column;align-items:flex-start;gap:.35rem' });
    const ask = button(tRaw('Ask to edit'), 'people-ask-edit');
    ask.setAttribute('aria-expanded', 'false');
    const formSlot = el('div', { style: 'align-self:stretch' });
    // Once a request is out, the button says so and does nothing more. It keeps focus
    // (aria-disabled rather than disabled), since the person may have just pressed the button.
    const sent = (on: boolean): void => {
      ask.textContent = on ? tRaw('Edit request sent') : tRaw('Ask to edit');
      if (on) ask.setAttribute('aria-disabled', 'true');
      else ask.removeAttribute('aria-disabled');
    };
    ask.addEventListener('click', () => {
      if (ask.getAttribute('aria-disabled') === 'true') return;
      if (formSlot.firstChild) {
        formSlot.replaceChildren();
        ask.setAttribute('aria-expanded', 'false');
        return;
      }
      ask.setAttribute('aria-expanded', 'true');
      void import('./access-request.ts').then(({ buildAskForm }) => {
        if (ask.getAttribute('aria-expanded') !== 'true' || !askSlot.contains(ask)) return;
        const project = projectName();
        formSlot.replaceChildren(buildAskForm({
          target: { projectId: opts.projectId },
          defaultRole: 'editor',
          fixedRole: 'editor',
          // Under the panel's own h3.
          level: 4,
          watch: inboxWatch,
          ...(project
            ? {
              heading: tRaw('Ask to edit {project}', { project }),
              intro: tRaw('The managers of {project} will see your request.', { project }),
            }
            : {}),
          onState: (s) => {
            if (s === 'approved') { void load(); return; }
            sent(s === 'sent' || s === 'asked');
          },
        }));
      }).catch(() => {
        ask.setAttribute('aria-expanded', 'false');
        say(tRaw('That could not be opened. Try again.'), true);
      });
    });
    box.append(el('p', { text: tRaw('You can view this project. Ask to edit to save changes here.'), style: 'margin:0;font-size:13px' }), ask, formSlot);
    askSlot.replaceChildren(box);
  };

  // ── Keeping focus across a redraw ───────────────────────────────────────────
  const keyOf = (li: Element | null, act?: string): FocusKey | null => {
    if (!(li instanceof HTMLElement)) return null;
    const control = act ?? li.querySelector<HTMLElement>('[data-act]')?.dataset.act;
    if (!control) return null;
    for (const kind of ROW_KINDS) {
      const id = li.dataset[kind];
      if (id) return { kind, id, act: control };
    }
    return null;
  };
  /** The next row's control, else the previous row's: where focus goes when a row
   *  goes. `act` asks for the same control on that row (the next Revoke after a
   *  Revoke); its first control stands in when it has none. */
  const neighbourKey = (li: HTMLElement, act?: string): FocusKey | null => {
    for (let sib = li.nextElementSibling; sib; sib = sib.nextElementSibling) { const k = keyOf(sib, act); if (k) return k; }
    for (let sib = li.previousElementSibling; sib; sib = sib.previousElementSibling) { const k = keyOf(sib, act); if (k) return k; }
    return null;
  };
  const focusedKey = (): FocusKey | null => {
    const active = document.activeElement as HTMLElement | null;
    if (!active || !listSlot.contains(active)) return null;
    return keyOf(active.closest('li'), active.dataset.act);
  };
  const findKey = (key: FocusKey): HTMLElement | null => {
    for (const li of listSlot.querySelectorAll<HTMLElement>(`li[data-${key.kind}]`)) {
      if (li.dataset[key.kind] !== key.id) continue;
      return li.querySelector<HTMLElement>(`[data-act="${key.act}"]`) ?? li.querySelector<HTMLElement>('[data-act]');
    }
    return null;
  };
  /** Focus was in the list, or fell to the page because its control went away. */
  const listHadFocus = (): boolean => {
    const active = document.activeElement;
    return !active || active === document.body || listSlot.contains(active);
  };

  const renderList = (focus: FocusKey | null | undefined, redraw: boolean, move: boolean): void => {
    if (!people) return;
    // On a redraw, put focus back on the same control, else on `focus` (a removed
    // row's neighbour), else on the heading, so the next Tab does not start from the
    // top of the page. `move`: the row that has focus is about to go (an answered
    // request, an invitation sent again), so `focus` comes first.
    const hadFocus = redraw && panel.isConnected && listHadFocus();
    const keep = (move ? focus ?? focusedKey() : focusedKey() ?? focus) ?? null;
    const view = peoplePanelView(people, opts.policy);
    if (view.manage || view.askToEdit) findName();
    renderAsk(view.askToEdit);
    const members = el('ul', { style: LIST_STYLE });
    members.append(...people.members.map((m) => memberRow(m, view.manage, view.roles, view.transfer)));
    // Group and admin access, for managers: rows of their own, after the members.
    if (view.manage) members.append(...(people.effective ?? []).map((m) => memberRow(m, view.manage, view.roles, false)));
    listSlot.replaceChildren(members);
    // A manager who is not a workspace admin sees no admin rows: say that admins can open the project too.
    const workspace = opts.policy?.workspace || people.message?.workspace;
    if (view.manage && people.adminAccess === 'note' && workspace) {
      const note = el('p', { text: tRaw('Admins of {workspace} can also open this project.', { workspace }), style: `margin:.4rem 0 0;${MUTED}` });
      note.dataset.adminNote = '';
      listSlot.append(note);
    }
    if (view.manage && people.requests.length) listSlot.prepend(requestSection(people.requests, view.roles));
    if (view.manage && people.invitations.length) {
      const pending = el('ul', { style: LIST_STYLE });
      pending.append(...people.invitations.map(invitationRow));
      listSlot.append(el('h4', { text: tRaw('Waiting to accept'), style: SUBHEAD }), pending);
      if (people.invitations.some((i) => i.link)) needProviders();
    }
    if (view.invite && !inviteSlot.firstChild) inviteSlot.append(inviteForm(view.roles));
    if (!view.invite) inviteSlot.replaceChildren();
    if (hadFocus) ((keep ? findKey(keep) : null) ?? heading).focus();
  };

  // The newest load wins: two changes in a row must not draw the older list last.
  let loadSeq = 0;
  let loaded = false;
  const load = async (focus?: FocusKey | null, move = false): Promise<void> => {
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
        renderAsk(false);
        // Having just left, a 403 is the expected answer: the status line already says so.
        if (!(left && got.status === 403)) say(peopleMessage(got.status, 'load', got.code), true);
      }
      if (hadFocus) heading.focus();
      return;
    }
    const redraw = loaded;
    loaded = true;
    people = got.data;
    renderList(focus, redraw, move);
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
    if (policy && !policy.canInvite) {
      hints.push(policy.workspace
        ? tRaw('Only admins of {workspace} invite new people. You can add people who already use {workspace}.', { workspace: policy.workspace })
        : tRaw('You can add people who already use this instance. Inviting anyone new is not turned on for you.'));
    }
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
    const roleHelp = el('p', { text: roleHelpText(), style: `margin:0;${MUTED}` });
    roleHelp.id = `${uid}-role-help`;
    role.setAttribute('aria-describedby', roleHelp.id);

    // The password tick, for an admin where password sign-in is on. It follows the
    // addresses typed (ticked when every one is at a password domain) until the
    // person sets it, and starts over after each invite.
    let tick: HTMLInputElement | null = null;
    let tickSet = false;
    const tickBlock: HTMLElement[] = [];
    if (policy?.canInvite && policy.passwordSetup) {
      const box = el('input');
      box.type = 'checkbox';
      box.id = `${uid}-password`;
      box.dataset.act = 'people-password';
      box.setAttribute('aria-describedby', `${uid}-password-hint`);
      box.addEventListener('change', () => { tickSet = true; });
      const tickLabel = el('label', { className: 'team-invite-password', style: 'display:flex;align-items:center;gap:.5rem;min-height:var(--ui-size-target);font-size:13px;font-weight:600' });
      tickLabel.htmlFor = box.id;
      tickLabel.append(box, document.createTextNode(tRaw('Let them set a password from the invite link')));
      const tickHint = el('p', { text: tRaw('For people who cannot use Google or GitHub.'), style: `margin:0;${MUTED}` });
      tickHint.id = `${uid}-password-hint`;
      tick = box;
      tickBlock.push(tickLabel, tickHint);
    }
    const followTick = (): void => {
      if (tick && !tickSet) tick.checked = passwordTickDefault(parseInviteEmails(field.value).emails, policy?.passwordDomains ?? []);
    };
    field.addEventListener('input', followTick);

    const actions = el('div', { style: 'display:flex;gap:.5rem;flex-wrap:wrap;justify-content:flex-end' });
    const send = el('button', { className: 'btn btn--primary btn--sm', text: tRaw('Invite') });
    send.type = 'submit';
    send.dataset.act = 'people-invite';
    send.style.minHeight = 'var(--ui-size-target)';
    actions.append(send);

    const results = el('ul', { className: 'team-people-results', style: `${LIST_STYLE};font-size:var(--fs-sm)` });
    results.hidden = true;
    const linkSlot = el('div');
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

    form.append(label, field, hint, formStatus, roleLabelEl, role, roleHelp, ...tickBlock, actions, results, linkSlot);

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
        flashCopied(copyBtn);
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

    /** What the last invite sent, for the message: the role, and whether its links set a password. */
    interface Sent { role: InviteRole; passwordSetup: boolean }

    /**
     * One address's outcome. An invited address gets Copy invite message and a line on
     * who the link works for; an address added directly gets Copy message, worded as
     * a share. Both need the instance's words for the message (an older instance
     * sends none), and a share needs the project's name.
     */
    const resultRow = (r: InviteResult, shown: InviteShownStatus, listed: ProjectInvitation | undefined, outcome: InviteOutcome, sent: Sent): HTMLLIElement => {
      const li = el('li', { style: 'display:flex;justify-content:space-between;align-items:center;gap:.25rem .75rem;flex-wrap:wrap;padding:.2rem 0' });
      li.dataset.status = shown;
      const address = el('span', { text: r.email, style: 'overflow-wrap:anywhere' });
      address.id = nextId();
      li.append(address, el('span', { text: inviteResultText(shown, r.reason, policy?.domains), style: r.status === 'refused' ? 'color:hsl(var(--destructive))' : MUTED }));
      const words = outcome.message;
      const project = projectName();
      const invited = shown === 'invited' || shown === 'already-invited';
      if (!(invited || (shown === 'added' && project))) return li;
      const context = words ?? { workspace: policy?.workspace || '', providers: [] };
      const link = invited ? r.link ?? listed?.link : outcome.link;
      if (!link) return li;
      const workspace = context.workspace || policy?.workspace || hostOf(outcome.link);
      const inviter = context.inviter ?? workspace;
      const password = listed ? listed.passwordSetup : sent.passwordSetup;
      const text = (): string => inviteMessage(invited
        ? {
          kind: 'invited', inviter, workspace, project, role: listed?.role ?? sent.role, email: r.email, link,
          providers: context.providers.length ? context.providers : fallbackProviders, expiresAt: r.expiresAt ?? listed?.expiresAt,
          passwordSetup: password, note: context.note,
        }
        : { kind: 'shared', inviter, workspace, project, role: sent.role, email: r.email, link: outcome.link, providers: [], note: context.note });
      const controls = el('div', { style: `${CONTROLS};flex:1 1 100%` });
      controls.setAttribute('role', 'group');
      controls.setAttribute('aria-labelledby', address.id);
      const slot = el('div', { style: 'flex:1 1 100%' });
      const copyMessage = button(invited ? tRaw('Copy invite message') : tRaw('Copy message'), 'people-copy-message');
      copyMessage.addEventListener('click', () => {
        void copyOut({ text: text(), kind: 'message', email: r.email, control: copyMessage, slot, tell: formSay });
      });
      controls.append(copyMessage);
      if (invited) {
        const input = el('input', { className: 'field-input' }); input.readOnly = true; input.value = link;
        input.setAttribute('aria-label', tRaw('Invite link for {email}', { email: r.email }));
        const copyLink = button(tRaw('Copy invite link'), 'people-copy-invite');
        copyLink.addEventListener('click', () => { void copyOut({ text: link, kind: 'link', email: r.email, control: copyLink, slot, tell: formSay }); });
        controls.prepend(input, copyLink);
      }
      li.append(controls);
      if (invited) {
        li.append(el('p', {
          text: password
            ? tRaw('Anyone with this link can set the password for {email}. Send the link privately.', { email: r.email })
            : tRaw('The link works only for someone who signs in as {email}.', { email: r.email }),
          style: `margin:0;flex:1 1 100%;${MUTED}`,
        }));
      }
      li.append(slot);
      return li;
    };

    // Each address's outcome, and the link under them. An 'already' address with an
    // invitation still waiting in the list is shown as invited: it has to sign in first.
    let lastOutcome: InviteOutcome | null = null;
    let lastSent: Sent = { role: 'editor', passwordSetup: false };
    let drawn = '';
    const drawOutcome = (outcome: InviteOutcome): void => {
      const waitingRows = (people?.invitations ?? []).filter((i) => i.status === 'pending');
      const waiting = waitingAddresses(waitingRows);
      const shown = outcome.results.map((r) => shownInviteStatus(r, waiting));
      const listed = outcome.results.map((r) => waitingRows.find((i) => i.email.toLowerCase() === r.email.toLowerCase()));
      // Drawn again only when what a row shows changed: its status, or the link and
      // password the reloaded list now has for the address.
      const key = shown.map((s, i) => `${s}:${listed[i]?.link ?? ''}:${listed[i]?.passwordSetup ? 1 : 0}`).join(' ');
      if (outcome === lastOutcome && key === drawn) return;
      lastOutcome = outcome;
      drawn = key;
      results.replaceChildren(...outcome.results.map((r, i) => resultRow(r, shown[i]!, listed[i], outcome, lastSent)));
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
      const sent: Sent = { role: role.value as InviteRole, passwordSetup: tick?.checked ?? false };
      try {
        const got = await inviteToProject(opts.projectId, emails, sent.role, tick ? { passwordSetup: sent.passwordSetup } : {});
        if (!got.ok) { formSay(peopleMessage(got.status, 'invite', got.code), true); return; }
        if (got.data.message) answerContext = got.data.message;
        lastSent = sent;
        drawOutcome(got.data);
        const done = got.data.results.filter((r) => r.status === 'added' || r.status === 'invited').length;
        // Only addresses that went through leave the field; refused ones stay to fix.
        const kept = got.data.results.filter((r) => r.status === 'refused').map((r) => r.email);
        field.value = kept.join(', ');
        tickSet = false;
        followTick();
        announce(done ? tRaw('People added or invited: {n}', { n: done }) : tRaw('Nobody new was added.'));
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
