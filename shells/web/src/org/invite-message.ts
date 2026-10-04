// SPDX-License-Identifier: MPL-2.0
/**
 * org/invite-message - the text a manager copies to send with an invite link, or
 * with a project they shared with someone who already had an account.
 *
 * Built line by line from catalog sentences, in the sender's language:
 *
 *  1. who invited whom to what, and the role ("Ana invited you to Summit on
 *     lolly.ing. Your role: Editor."), or the workspace alone for an invitation with
 *     no project;
 *  2. the link, on its own line, so a chat app makes it clickable;
 *  3. which address and which sign-ins to use ("Sign in as sam@suse.com with Google
 *     or GitHub."), with the sign-ins joined as the language joins "or";
 *  4. that the link sets a password, for an invitation that can;
 *  5. the day the invitation ends;
 *  6. the workspace's own note (`instance.inviteNote`), which is English config text.
 *
 * A "shared" message is for someone who can open the project now, so it leaves out
 * lines 3 to 5. Pure: no DOM, no network.
 */
import { loadedLang, tRaw } from '../i18n.ts';
import type { TeamRole } from '../lib/session-source.ts';
import { dayLabel, roleLabel } from './team-access.ts';

export interface InviteMessageInput {
  /** Who invited, as others see their name (never their address). */
  inviter: string;
  /** The workspace's name ("lolly.ing"). */
  workspace: string;
  /** The project's name; absent for an invitation to the workspace only. */
  project?: string;
  role?: TeamRole;
  /** The invited address: the one the person must sign in as. */
  email: string;
  link: string;
  /** The sign-ins a new person can use, by their display names. */
  providers: readonly string[];
  expiresAt?: string;
  /** The link also sets a password for the address. */
  passwordSetup?: boolean;
  note?: string;
  kind: 'invited' | 'shared';
  /** The language for the list of sign-ins and the date; the loaded one when absent. */
  lang?: string;
}

/** "Google, GitHub or Email and password", as `lang` joins a list with "or". */
export function orList(items: readonly string[], lang: string = loadedLang()): string {
  try {
    return new Intl.ListFormat(lang, { type: 'disjunction' }).format(items);
  } catch {
    return new Intl.ListFormat('en', { type: 'disjunction' }).format(items);
  }
}

/**
 * Put the values into a sentence in one pass. The catalog fills placeholders one
 * after another, so a project called "{workspace}" would have its own name replaced
 * by the next value; each placeholder gets a marker first, and the markers are
 * swapped for the values together.
 */
function fill(sentence: (marks: Record<string, string>) => string, values: Record<string, string>): string {
  const marks = Object.fromEntries(Object.keys(values).map((k) => [k, `\u0000${k}\u0000`]));
  return sentence(marks).replace(/\u0000(\w+)\u0000/g, (m, k: string) => values[k] ?? m);
}

/** The message, one line per part, joined with new lines. Plain text. */
export function inviteMessage(o: InviteMessageInput): string {
  const lang = o.lang ?? loadedLang();
  const inviter = o.inviter.trim();
  const workspace = o.workspace.trim();
  const project = o.project?.trim();
  const role = o.role ? roleLabel(o.role) : '';
  const lines: string[] = [];
  if (project && role && o.kind === 'shared') {
    lines.push(fill((m) => tRaw('{inviter} shared {project} with you on {workspace}. Your role: {role}.', m), { inviter, project, workspace, role }));
  } else if (project && role) {
    lines.push(fill((m) => tRaw('{inviter} invited you to {project} on {workspace}. Your role: {role}.', m), { inviter, project, workspace, role }));
  } else {
    lines.push(fill((m) => tRaw('{inviter} invited you to {workspace}.', m), { inviter, workspace }));
  }
  lines.push(o.link);
  if (o.kind === 'invited') {
    const providers = o.providers.map((p) => p.trim()).filter(Boolean);
    if (providers.length) lines.push(fill((m) => tRaw('Sign in as {email} with {providers}.', m), { email: o.email, providers: orList(providers, lang) }));
    if (o.passwordSetup) lines.push(tRaw('Open the link to set your password.'));
    const day = dayLabel(o.expiresAt, lang);
    if (day) lines.push(tRaw('This invitation ends on {date}.', { date: day }));
  }
  const note = o.note?.trim();
  if (note) lines.push(note);
  return lines.join('\n');
}
