// SPDX-License-Identifier: MPL-2.0
/**
 * org/team-access - the pure decisions behind "People with access" and the role a
 * person holds in a team project: who sees the People panel and what they may do
 * there, which save the Share dialog offers, what the instance allows an invitation
 * to carry (including a link that sets a password), the lines under a waiting
 * invitation and an access request, and the "Edited by" line under a project or
 * session.
 *
 * No DOM and no network, so every decision is tested on its own
 * (org/team-access.test.ts) and the panels in org/team-people.ts,
 * org/team-projects.ts and org/team-save.ts only render what these return.
 *
 * The server decides every action again; these only keep the shell from offering a
 * control that would be refused.
 */
import type { TeamRole } from '../lib/session-source.ts';
import { loadedLang, tRaw } from '../i18n.ts';
import { relTime } from '../lib/rel-time.ts';

/** The roles an invitation, or a role change, may give. Owner is never handed out. */
export type InviteRole = Exclude<TeamRole, 'owner'>;
export const INVITE_ROLES: readonly InviteRole[] = ['viewer', 'editor', 'manager'];

/** A role this shell knows, or undefined. Pure. */
export function inviteRoleOf(value: unknown): InviteRole | undefined {
  return typeof value === 'string' && (INVITE_ROLES as readonly string[]).includes(value) ? value as InviteRole : undefined;
}

/** What the instance allows an invitation to carry, read from org-config. */
export interface InvitePolicy {
  /** `can['user.invite']`: may this person invite someone who is not on the instance yet. */
  canInvite: boolean;
  /** An invitee's address must be at one of these domains. Empty: any domain. */
  domains: string[];
  maxTtlHours: number;
  /** The roles an invitation may give, in the order they are offered. */
  projectRoles: InviteRole[];
  /** The workspace's own name (`instance.name`, "lolly.ing"), for sentences about
   *  where people are invited to. '' when the instance sends none. */
  workspace: string;
  /** `invites.passwordSetup`: password sign-in is on and this person is an admin or
   *  owner who may invite, so an invite link may also set the invitee's password. */
  passwordSetup: boolean;
  /** `invites.passwordDomains`: when every address is at one of these, the password
   *  tick starts ticked. */
  passwordDomains: string[];
  /** `requests.project`: a member may ask for access to a project, so a viewer is
   *  offered "Ask to edit". False on an instance that does not say. */
  askToEdit: boolean;
}

/** The org-config fields read here. Structural, so this module does not import org/index.ts. */
export interface InviteConfig {
  can?: Record<string, boolean>;
  instance?: { name?: unknown };
  invites?: { domains?: unknown; maxTtlHours?: unknown; projectRoles?: unknown; passwordSetup?: unknown; passwordDomains?: unknown };
  requests?: { project?: unknown };
}

/** A domain list as the instance sent it: trimmed, lower case, no blanks or repeats. */
function domainList(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((d): d is string => typeof d === 'string' && d.trim() !== '').map((d) => d.trim().toLowerCase()))]
    : [];
}

/**
 * The invite policy, or null when the instance sends no `invites` block: an older
 * instance has no member or invite routes, so nothing about people is offered. Pure.
 */
export function invitePolicy(config: InviteConfig | null | undefined): InvitePolicy | null {
  const inv = config?.invites;
  if (!inv || typeof inv !== 'object') return null;
  const ttl = typeof inv.maxTtlHours === 'number' && Number.isFinite(inv.maxTtlHours) && inv.maxTtlHours > 0 ? inv.maxTtlHours : 720;
  const listed = Array.isArray(inv.projectRoles) ? inv.projectRoles.map(inviteRoleOf).filter((r): r is InviteRole => !!r) : null;
  // Kept in the fixed viewer, editor, manager order whatever order the instance sent.
  const projectRoles = listed ? INVITE_ROLES.filter((r) => listed.includes(r)) : [...INVITE_ROLES];
  const name = config?.instance?.name;
  return {
    canInvite: config?.can?.['user.invite'] === true,
    domains: domainList(inv.domains),
    maxTtlHours: ttl,
    projectRoles,
    workspace: typeof name === 'string' ? name.trim() : '',
    passwordSetup: inv.passwordSetup === true,
    passwordDomains: domainList(inv.passwordDomains),
    askToEdit: config?.requests?.project === true,
  };
}

/** Whether the password tick starts ticked for the addresses typed so far: there is
 *  at least one, and every one is at a password domain (the same exact-domain match
 *  the instance applies to `domains`). Pure. */
export function passwordTickDefault(emails: readonly string[], passwordDomains: readonly string[]): boolean {
  if (!emails.length || !passwordDomains.length) return false;
  return emails.every((e) => {
    const at = e.lastIndexOf('@');
    return at > 0 && passwordDomains.includes(e.slice(at + 1).trim().toLowerCase());
  });
}

/** Owner or manager: decides who has access. Pure. */
export function isManagerPlus(role: TeamRole | undefined): boolean {
  return role === 'owner' || role === 'manager';
}

/** May save into the project. An unknown role is not refused here: the server answers. Pure. */
export function canWriteProject(role: TeamRole | undefined): boolean {
  return role !== 'viewer';
}

/**
 * How much of the People panel a person gets for one project:
 *  - `hidden`: no People action at all (an older instance, or a role the shell does
 *    not know yet);
 *  - `read`: the list of people, nothing to change (a viewer or an editor: the
 *    instance answers the list for any member of the project);
 *  - `manage`: role changes, removal, pending invitations and the invite form.
 * Whether this person may invite someone new to the instance (`can['user.invite']`)
 * does not decide this; it only changes a hint inside the invite form.
 * Pure.
 */
export type PeopleAccess = 'hidden' | 'read' | 'manage';

export function peopleAccess(role: TeamRole | undefined, policy: InvitePolicy | null): PeopleAccess {
  if (!policy || !role) return 'hidden';
  return isManagerPlus(role) ? 'manage' : 'read';
}

/**
 * Which save the Share dialog's Team section offers over a team document:
 *  - `save-changes`: save over the session (an editor or better, with `session.edit`);
 *  - `save-copy`: save a copy to a project this person can write to (a viewer, or
 *    anyone the instance does not let save over sessions);
 *  - `none`: nothing to save (no live document, or no saving at all).
 * Pure.
 */
export type TeamSaveChoice = 'save-changes' | 'save-copy' | 'none';

export function teamSaveChoice(role: TeamRole | undefined, opts: { hasDocument: boolean; canEdit: boolean; canSave: boolean }): TeamSaveChoice {
  if (!opts.hasDocument) return 'none';
  if (canWriteProject(role) && opts.canEdit) return 'save-changes';
  return opts.canSave ? 'save-copy' : 'none';
}

/** The role's name for a person to read. Plain text. */
export function roleLabel(role: TeamRole): string {
  switch (role) {
    case 'owner': return tRaw('Owner');
    case 'manager': return tRaw('Manager');
    case 'editor': return tRaw('Editor');
    default: return tRaw('Viewer');
  }
}

/** What each role may do, in one line, under every select that hands out a role. Plain text. */
export function roleHelpText(): string {
  return tRaw('Viewers open and copy. Editors save changes. Managers also add people.');
}

/** "2 Nov 2026": a day for "Ends {date}" and the invite message, in the reader's
 *  language. '' for a missing or unreadable time. Pure. */
export function dayLabel(iso: string | undefined, lang: string = loadedLang()): string {
  const ts = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(ts)) return '';
  try {
    return new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(ts);
  } catch {
    return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(ts);
  }
}

/**
 * The lines under an invitation's address in "Waiting to accept": when it ends (or
 * ended), whether anyone has opened the link yet (or that it expired), and who
 * invited. A part the instance did not send is ''. `now` and `lang` are passed in
 * for tests. Plain text.
 */
export function invitationLines(
  inv: { status: 'pending' | 'expired'; expiresAt?: string; openedAt?: string; invitedByName?: string },
  now: number = Date.now(),
  lang?: string,
): { ends: string; state: string; by: string } {
  const day = dayLabel(inv.expiresAt, lang);
  const expired = inv.status === 'expired';
  const ends = day ? (expired ? tRaw('Ended {date}', { date: day }) : tRaw('Ends {date}', { date: day })) : '';
  const opened = inv.openedAt ? longRelTime(inv.openedAt, now, lang) : '';
  const state = expired ? tRaw('Expired') : opened ? tRaw('Opened {time}', { time: opened }) : tRaw('Waiting');
  const name = inv.invitedByName?.trim();
  return { ends, state, by: name ? tRaw('Invited by {name}', { name }) : '' };
}

/** What a member asked for, in the words a project manager reads. Plain text. */
export function requestAskText(role: TeamRole): string {
  return role === 'viewer' ? tRaw('Asks to view') : tRaw('Asks to edit');
}

/** "Asked 3 hours ago", or '' without a readable time. Plain text. */
export function requestAskedText(createdAt: string | undefined, now: number = Date.now(), lang?: string): string {
  const time = longRelTime(createdAt, now, lang);
  return time ? tRaw('Asked {time}', { time }) : '';
}

/** The sentence after this person answered a request themselves. Plain text. */
export function requestAnsweredText(action: 'approve' | 'decline', role: TeamRole): string {
  return action === 'decline' ? tRaw('Declined.') : tRaw('Approved as {role}.', { role: roleLabel(role) });
}

/**
 * The sentence for an answer the instance refused. A 409 means someone answered
 * first or the request ended: the instance sends the request as it now stands, so
 * the sentence says who approved or declined, or that it was withdrawn or ended. A
 * 403 means this person may no longer answer the request. Plain text.
 */
export function requestRefusalText(
  status: number,
  request?: { status?: string; answeredBy?: string; answerRole?: TeamRole } | null,
): string {
  if (status === 403) return tRaw('You can no longer answer this request.');
  if (status !== 409 && status !== 404) return tRaw('Could not answer the request. Try again.');
  const name = request?.answeredBy?.trim();
  if (request?.status === 'approved' && name && request.answerRole) {
    return tRaw('{name} already approved this as {role}.', { name, role: roleLabel(request.answerRole) });
  }
  if (request?.status === 'declined' && name) return tRaw('{name} already declined this.', { name });
  if (request?.status === 'withdrawn') return tRaw('This request was withdrawn.');
  return tRaw('This request has ended.');
}

/**
 * The "Edited by" line under a project or session: "Edited by Ana, 3h ago", or only
 * the time when the source does not say who, or '' when it says neither. `now` is
 * passed in so the boundaries are testable. Plain text.
 */
export function activityLabel(item: { updatedByName?: string; updatedAt?: string }, now: number = Date.now()): string {
  const time = relTime(item.updatedAt, now, tRaw);
  const name = item.updatedByName?.trim();
  if (name && time) return tRaw('Edited by {name}, {time}', { name, time });
  if (name) return tRaw('Edited by {name}', { name });
  return time;
}

/** "1 session" or "{n} sessions": the app's two-form plural (whole sentences in the
 *  catalog, so a translator can place the number). Plain text. */
export function sessionCountLabel(n: number): string {
  return n === 1 ? tRaw('1 session') : tRaw('{n} sessions', { n: String(n) });
}

/** What the Team section's project picker says when there is no project this person
 *  can save to. */
export interface TeamPickerEmpty {
  /** The select's one disabled line. */
  placeholder: string;
  /** The hint under it: what to do next. */
  note: string;
  /** Offer "New project…" in the select. */
  offerNew: boolean;
}

/**
 * The empty picker, from how many projects the person can see (`listed`, viewer
 * projects included) and whether the instance lets them create one
 * (`can['project.create']`). Someone who can create is told to; someone who cannot
 * is told who can help: a person in no project needs adding to one, and a person
 * who only views projects needs edit access, not another invitation. Pure; plain text.
 */
export function teamPickerEmpty(o: { listed: number; canCreate: boolean }): TeamPickerEmpty {
  let note: string;
  if (o.canCreate) note = tRaw('Create a project to save this document.');
  else if (o.listed > 0) note = tRaw('Ask a project owner for edit access.');
  else note = tRaw('Ask a teammate to add you to a project.');
  return {
    placeholder: o.listed > 0 ? tRaw('No projects you can save to') : tRaw('No team projects yet'),
    note,
    offerNew: o.canCreate,
  };
}

/**
 * "2 minutes ago", "yesterday", "3 months ago": the long relative time a sentence
 * reads well with, from the browser's own Intl data for `lang`, so every locale gets
 * its own wording without catalog strings. Under a minute is "just now". The short
 * form ("2m ago") stays in list rows ({@link activityLabel}). '' for a missing or
 * unreadable time. Pure.
 */
export function longRelTime(iso: string | undefined, now: number, lang: string = loadedLang()): string {
  const ts = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(ts)) return '';
  const s = Math.max(0, (now - ts) / 1000);
  if (s < 60) return tRaw('just now');
  const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['minute', 60], ['hour', 3600], ['day', 86_400], ['week', 604_800], ['month', 2_592_000], ['year', 31_536_000],
  ];
  const limits: Record<string, number> = { minute: 60, hour: 24, day: 7, week: 5, month: 12 };
  let unit: Intl.RelativeTimeFormatUnit = 'year';
  let value = Math.floor(s / 31_536_000);
  for (const [u, size] of steps) {
    const n = Math.floor(s / size);
    if (limits[u] === undefined || n < limits[u]) { unit = u; value = n; break; }
  }
  try {
    return new Intl.RelativeTimeFormat(lang, { numeric: 'auto' }).format(-value, unit);
  } catch {
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(-value, unit);
  }
}

/**
 * The save-conflict dialog's words. Says who saved and when, from the newer
 * version the instance sent back ("Bea saved a newer version 2 minutes ago");
 * without a name it says "Someone". When the instance says the newer version is the
 * reader's own (`updatedByYou`: a save from another window or device), it says so
 * instead of naming them as a third person. `unknownRev`: there was no revision to
 * compare, so it cannot claim anyone saved after this person. `now` and `lang` are
 * passed in for tests. Pure.
 */
export function conflictCopy(
  current: { updatedByName?: string; updatedAt?: string; updatedByYou?: boolean },
  unknownRev: boolean,
  now: number = Date.now(),
  lang?: string,
): { title: string; message: string; open: string; copy: string } {
  const theirs = { open: tRaw('Open theirs'), copy: tRaw('Save mine as a copy') };
  if (unknownRev) {
    return {
      ...theirs,
      title: tRaw('Check the version first'),
      message: tRaw('This instance did not say which version you opened, so saving over it could replace someone else’s changes. Open the version on the instance, or save yours as a new copy in the same project.'),
    };
  }
  const time = longRelTime(current.updatedAt, now, lang);
  if (current.updatedByYou === true) {
    return {
      title: time ? tRaw('You saved a newer version {time}', { time }) : tRaw('You saved a newer version'),
      message: tRaw('That save came from another window or device. Open that version, or save this one as a new copy in the same project.'),
      open: tRaw('Open that version'),
      copy: tRaw('Save this as a copy'),
    };
  }
  const name = current.updatedByName?.trim();
  if (!name) {
    return {
      ...theirs,
      title: tRaw('Someone saved a newer version'),
      message: tRaw('Someone else saved this session after you opened your copy. Open their version, or save yours as a new copy in the same project.'),
    };
  }
  return {
    ...theirs,
    title: time ? tRaw('{name} saved a newer version {time}', { name, time }) : tRaw('{name} saved a newer version', { name }),
    message: tRaw('Open their version, or save yours as a new copy in the same project.'),
  };
}

// ── Invite by email ──────────────────────────────────────────────────────────

/** The most addresses one invite sends. */
export const MAX_INVITE_EMAILS = 50;

const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/;

/**
 * The addresses typed into the invite field. Entries are separated by commas,
 * semicolons or new lines; inside one entry, spaces separate several addresses. A
 * `Name <address>` entry is read as its address, and only there are other words
 * allowed (the display name). Duplicates (in any letter case) are dropped. Every
 * other word that is not an address is returned in `invalid` as typed, so a typo
 * such as `bob.acme.com` is reported instead of being left out. Pure.
 */
export function parseInviteEmails(text: string): { emails: string[]; invalid: string[] } {
  // A quoted display name may hold a comma ("Lee, Ana" <ana@acme.com>): drop it
  // before splitting into entries.
  const source = String(text ?? '').replace(/"[^"]*"\s*(?=<)/g, ' ');
  const seen = new Set<string>();
  const emails: string[] = [];
  const invalid: string[] = [];
  const take = (tok: string): void => {
    const key = tok.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    (EMAIL_RE.test(tok) ? emails : invalid).push(tok);
  };
  for (const entry of source.split(/[,;\n\r]+/)) {
    const angled: string[] = [];
    const rest = entry.replace(/<([^<>]*)>/g, (_m, inner: string) => { angled.push(inner.trim()); return ' '; });
    for (const inner of angled) if (inner) take(inner);
    for (const word of rest.split(/\s+/).map((x) => x.trim()).filter(Boolean)) {
      // Next to an address in angle brackets, a word without an @ is the person's
      // name. Anywhere else, every word must be an address.
      if (angled.length && !word.includes('@')) continue;
      take(word);
    }
  }
  return { emails, invalid };
}

/** One address's outcome from an invite. */
export type InviteStatus = 'added' | 'invited' | 'already' | 'refused';

/** The link the People panel offers after an invite (inviteLinkKind). */
export type InviteLinkKind = 'invited' | 'added' | 'already' | 'none';

/** One address's outcome, as the People panel shows the address. The instance answers 'already'
 *  both for someone who has access and for an address whose open invitation already
 *  covers this project at that role; only the first can open the project now, so the
 *  second is shown as 'already-invited'. */
export type InviteShownStatus = InviteStatus | 'already-invited';

/** The addresses with an invitation still waiting, from the panel's list, ready for
 *  shownInviteStatus. Pure. */
export function waitingAddresses(invitations: ReadonlyArray<{ email: string }>): Set<string> {
  return new Set(invitations.map((i) => i.email.trim().toLowerCase()));
}

/** How one address's outcome is shown: 'already' becomes 'already-invited' when the
 *  address is among `waiting` (waitingAddresses). Pure. */
export function shownInviteStatus(r: { email?: string; status: InviteStatus }, waiting: ReadonlySet<string>): InviteShownStatus {
  return r.status === 'already' && typeof r.email === 'string' && waiting.has(r.email.trim().toLowerCase()) ? 'already-invited' : r.status;
}

/** Which link the People panel offers after an invite: the invite link when at least
 *  one address got an invitation or still has one waiting (an 'already' address among
 *  `waiting`), the project link when everyone was added directly ('added') or had
 *  access already ('already' only), and none when nobody went through. Pure. */
export function inviteLinkKind(
  results: ReadonlyArray<{ email?: string; status: InviteStatus }>,
  waiting: ReadonlySet<string> = new Set(),
): InviteLinkKind {
  const shown = results.map((r) => shownInviteStatus(r, waiting));
  if (shown.some((s) => s === 'invited' || s === 'already-invited')) return 'invited';
  if (shown.includes('added')) return 'added';
  if (shown.includes('already')) return 'already';
  return 'none';
}

/**
 * The sentence for one address's outcome. A refusal's `reason` is the instance's
 * code (lolly-work's invite route): each known code gets its own sentence, and an
 * unknown one is plain "Not added", never the code itself. `domains` is the
 * instance's allowed list, shown when the address was outside that list. Plain text.
 */
export function inviteResultText(status: InviteShownStatus, reason?: string, domains: readonly string[] = []): string {
  switch (status) {
    case 'added': return tRaw('Added');
    case 'invited': return tRaw('Invited');
    case 'already': return tRaw('Already has access');
    case 'already-invited': return tRaw('Already invited');
    default:
      switch (reason?.trim()) {
        case 'invalid-email': return tRaw('Not added. That address is not valid.');
        case 'account-disabled': return tRaw('Not added. That account is turned off.');
        case 'invites-not-allowed': return tRaw('Not added. You can only add people who already use this instance.');
        case 'domain-not-allowed':
          return domains.length
            ? tRaw('Not added. Addresses must be at {domains}.', { domains: domains.join(', ') })
            : tRaw('Not added. That address is outside the allowed domains.');
        case 'invitation-accepted': return tRaw('Not added. They already joined with another address. Invite that address instead.');
        case 'invitation-changed': return tRaw('Not added. Their invitation changed. Try again.');
        // New addresses cannot be invited on this instance at all (its sign-in reads no invitations).
        case 'invitations-off': return tRaw('Not added. This instance does not take invitations for new people.');
        // Sent in place of `invitation-accepted` and `account-disabled` to someone who may
        // not invite new people, so the answer does not say whether an account exists.
        case 'unavailable': return tRaw('Not added. Ask an admin of this instance to add them.');
        default: return tRaw('Not added');
      }
  }
}

/**
 * The sentence for a failed People action, by status and, where one status means
 * several things, the instance's error code (`{ error: { code } }`): a 403 is
 * `ROLE_NOT_ALLOWED` when the instance does not hand out that role, else not being
 * allowed to manage the project. Plain text.
 */
export function peopleMessage(status: number, action: 'load' | 'change' | 'invite' | 'link', code?: string): string {
  if (status === 0) return tRaw('The instance could not be reached. Try again when you are back online.');
  if (status === 401) return tRaw('Your sign-in has expired. Sign in again, then try again.');
  // A new link is limited per invitation and day; an invite, per hour and address.
  if (status === 429 && action === 'link') return tRaw('That is a lot of new links for one day. Try again tomorrow.');
  if (status === 429) return tRaw('That is a lot of addresses for one hour. Try again later.');
  if (status === 403 && code === 'ROLE_NOT_ALLOWED') return tRaw('This instance does not give that role. Choose another role.');
  // An invite to an archived project; a change only answers 409 for the owner's row,
  // which this shell never offers to change.
  if (status === 409 && (action === 'invite' || code === 'PROJECT_ARCHIVED')) {
    return tRaw('This project is archived. Restore it before inviting people.');
  }
  // On a change or a new link, 404 is the person or the invitation, not the project:
  // the instance answers "no such member" or "no such open invitation" while the
  // project stays.
  if (status === 404) {
    return action === 'change' || action === 'link'
      ? tRaw('That person or invitation has already changed.')
      : tRaw('That project is no longer on this instance.');
  }
  if (status === 403) {
    return action === 'load'
      ? tRaw('You do not have access to this project.')
      : tRaw('You cannot change who has access to this project.');
  }
  if (action === 'invite' && status === 400) return tRaw('Check the addresses and the role, then try again.');
  if (action === 'load') return tRaw('Could not load the people in this project. Try again.');
  return tRaw('Could not make that change. Try again.');
}
