// SPDX-License-Identifier: MPL-2.0
/**
 * org/project-members - the instance's "People with access" API for one team project:
 * who has access and with which role, the invitations still waiting, inviting by
 * email, changing a role, removing a person and revoking an invitation.
 *
 * Pure data, like org/session-source.ts: fetch and shape, no DOM. Every call resolves
 * (never throws) to `{ ok: true, data }` or `{ ok: false, status }`, where status 0 is
 * "no answer at all". All traffic goes through instanceFetch/instancePath, so a remote
 * instance base works exactly as the same-origin one; same-origin writes carry the
 * session cookie, which is all the instance's cross-site guard asks of a first-party
 * page.
 *
 * Server contract (lolly-work plans 74 and 75):
 *   GET    /api/v1/projects/:id/members                 -> { myRole, members, invitations, requests, message? }
 *   POST   /api/v1/projects/:id/invite {emails, role, passwordSetup?}
 *                                                       -> { results, link, message? }
 *   PATCH  /api/v1/projects/:id/members/:userId {role}  -> member
 *   DELETE /api/v1/projects/:id/members/:userId         -> 204
 *   DELETE /api/v1/projects/:id/invitations/:id         -> 204
 *   POST   /api/v1/projects/:id/invitations/:id/link    -> { link, expiresAt }
 *   POST   /api/v1/projects/:id/invitations/:id/reinvite -> one invite result
 *   POST   /api/v1/access-requests/:id/approve {role?}  -> { request, outcome }
 *   POST   /api/v1/access-requests/:id/decline          -> { request }
 * A member's email, the invitations and the access requests come back only for an
 * owner or a manager; the caller's own member row carries `isMe: true`. Each waiting
 * invitation carries its own link for this project, the day it ends, whether the link
 * was opened and who invited; one that expired in the last 30 days is listed as
 * `expired`, so it can be sent again. An invite's answer gives each invited address
 * its link and the words for the message to send (`message`). A refusal's body is
 * `{ error: { code, message } }`, and the code is kept beside the status; a 409 on an
 * answer also carries the request as it now stands, so the panel can say who
 * answered first.
 */
import { getInstanceBase, instanceFetch, instancePath } from '../lib/instance.ts';
import type { TeamRole } from '../lib/session-source.ts';
import { teamRoleOf } from './session-source.ts';
import { inviteRoleOf, type InviteRole, type InviteStatus } from './team-access.ts';

export interface ProjectMember {
  userId: string;
  name: string;
  /** Present only for an owner or a manager. */
  email?: string;
  role: TeamRole;
  addedAt?: string;
  /** The signed-in person's own row (the instance marks it `isMe: true`). */
  isMe?: boolean;
}

export interface ProjectInvitation {
  id: string;
  email: string;
  role: InviteRole;
  createdAt?: string;
  expiresAt?: string;
  /** `expired`: it ended within the last 30 days and is kept so it can be sent again. */
  status: 'pending' | 'expired';
  /** When someone first started a sign-in from the link. */
  openedAt?: string;
  /** Who added this project to the invitation, as others see their name. */
  invitedByName?: string;
  /** Whoever holds the link can set the password for the address. */
  passwordSetup: boolean;
  /** This project's own invite link, while the invitation is waiting. */
  link?: string;
}

/** Someone asking for access to the project (managers only). */
export interface ProjectRequest {
  id: string;
  userId?: string;
  name: string;
  email?: string;
  /** What they asked for. */
  role: InviteRole;
  createdAt?: string;
  /** Their note, as they typed it: shown as text only. */
  note?: string;
}

/** The words for an invite message, from the instance: the workspace's name, who is
 *  inviting, the sign-ins a new person can use, and the workspace's own note. */
export interface InviteMessageContext {
  workspace: string;
  inviter?: string;
  providers: string[];
  note?: string;
}

export interface ProjectPeople {
  myRole: TeamRole;
  members: ProjectMember[];
  invitations: ProjectInvitation[];
  requests: ProjectRequest[];
  message?: InviteMessageContext;
}

export interface InviteResult {
  email: string;
  status: InviteStatus;
  reason?: string;
  invitationId?: string;
  /** The invited address's own link to this project. */
  link?: string;
  expiresAt?: string;
}

export interface InviteOutcome {
  results: InviteResult[];
  /** The address to send: opens the project in the app for anyone who can see the project. */
  link: string;
  message?: InviteMessageContext;
}

/** A request as the instance has it after an answer, or after someone else's. */
export interface RequestAnswer {
  status: string;
  /** The name of whoever answered. */
  answeredBy?: string;
  answerRole?: InviteRole;
}

/** An approve or decline: the request as answered, or a failure that keeps the
 *  status, the instance's code and, on a 409, the request as it now stands. */
export type AnswerGot =
  | { ok: true; request: RequestAnswer; outcome?: string }
  | { ok: false; status: number; code?: string; request?: RequestAnswer };

/** A failure keeps the HTTP status (0: no answer at all) and, when the instance sent
 *  one, its error code (`{ error: { code } }`), for statuses that mean several things. */
export type PeopleGot<T> = { ok: true; data: T } | { ok: false; status: number; code?: string };

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** An invitation is a personal server link, never the project's general app URL. */
export function personalInviteLink(value: unknown): string | undefined {
  if (typeof value !== 'string' || /[<>\s]/.test(value)) return undefined;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && url.pathname.startsWith('/l/invite/') ? value : undefined;
  } catch { return undefined; }
}

/** A link from the instance that is safe to put in a field and a message: http(s),
 *  with nothing that could end the link early. Pure. */
export function safeLink(v: unknown): string | undefined {
  return typeof v === 'string' && /^https?:\/\//i.test(v) && !/[<>\s]/.test(v) ? v : undefined;
}

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' ? v as Record<string, unknown> : null);

/** The address that opens a team project: the instance's app with `#/team/project/<id>`. */
export function teamProjectLinkUrl(projectId: string, base = getInstanceBase() || globalThis.location?.origin || ''): string {
  return `${base.replace(/\/+$/, '')}/#/team/project/${encodeURIComponent(projectId)}`;
}

/** A file link opens the project's Files screen with the existing project access. */
export function teamProjectFileLinkUrl(projectId: string, fileId: string, base = getInstanceBase() || globalThis.location?.origin || ''): string {
  return `${teamProjectLinkUrl(projectId, base)}?file=${encodeURIComponent(fileId)}`;
}

/** One member row, or null when it is not usable (no id or no known role). Pure. */
export function memberFromRow(row: unknown): ProjectMember | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const userId = str(r.userId);
  const role = teamRoleOf(r.role);
  if (!userId || !role) return null;
  const email = str(r.email);
  const addedAt = str(r.addedAt);
  return {
    userId, name: str(r.name) ?? email ?? userId, role,
    ...(email ? { email } : {}), ...(addedAt ? { addedAt } : {}), ...(r.isMe === true ? { isMe: true } : {}),
  };
}

/** One waiting or recently expired invitation, or null when it is not usable. Pure. */
export function invitationFromRow(row: unknown): ProjectInvitation | null {
  const r = obj(row);
  if (!r) return null;
  const id = str(r.id);
  const email = str(r.email);
  const role = inviteRoleOf(r.role);
  if (!id || !email || !role) return null;
  const createdAt = str(r.createdAt);
  const expiresAt = str(r.expiresAt);
  const status = r.status === 'expired' ? 'expired' : 'pending';
  const openedAt = str(r.openedAt);
  const invitedByName = str(r.invitedByName);
  // A link only while the invitation is waiting: an expired one no longer opens anything.
  const link = status === 'pending' ? personalInviteLink(r.link) : undefined;
  return {
    id, email, role, status, passwordSetup: r.passwordSetup === true,
    ...(createdAt ? { createdAt } : {}), ...(expiresAt ? { expiresAt } : {}),
    ...(openedAt ? { openedAt } : {}), ...(invitedByName ? { invitedByName } : {}), ...(link ? { link } : {}),
  };
}

/** One access request, or null when it is not usable. Pure. */
export function requestFromRow(row: unknown): ProjectRequest | null {
  const r = obj(row);
  if (!r) return null;
  const id = str(r.id);
  const role = inviteRoleOf(r.role);
  const email = str(r.email);
  const name = str(r.name) ?? email;
  if (!id || !role || !name) return null;
  const userId = str(r.userId);
  const createdAt = str(r.createdAt);
  // Kept as typed (only trimmed at the ends): it is rendered as text, never markup.
  const note = typeof r.note === 'string' && r.note.trim() ? r.note.trim() : undefined;
  return {
    id, name, role,
    ...(userId ? { userId } : {}), ...(email ? { email } : {}), ...(createdAt ? { createdAt } : {}), ...(note ? { note } : {}),
  };
}

/** The words for an invite message, or undefined when the instance sent none. Pure. */
export function messageContextFrom(value: unknown): InviteMessageContext | undefined {
  const m = obj(value);
  if (!m) return undefined;
  const providers = Array.isArray(m.providers) ? m.providers.map(str).filter((p): p is string => !!p) : [];
  const workspace = str(m.workspace) ?? '';
  const inviter = str(m.inviter);
  const note = str(m.note);
  return { workspace, providers, ...(inviter ? { inviter } : {}), ...(note ? { note } : {}) };
}

/** The members response as this module's type, or null when it is not one. Pure. */
export function peopleFromBody(body: unknown): ProjectPeople | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as { myRole?: unknown; members?: unknown; invitations?: unknown; requests?: unknown; message?: unknown };
  const myRole = teamRoleOf(b.myRole);
  if (!myRole || !Array.isArray(b.members)) return null;
  const members = b.members.map(memberFromRow).filter((m): m is ProjectMember => !!m);
  const invitations = Array.isArray(b.invitations)
    ? b.invitations.map(invitationFromRow).filter((i): i is ProjectInvitation => !!i)
    : [];
  const requests = Array.isArray(b.requests)
    ? b.requests.map(requestFromRow).filter((r): r is ProjectRequest => !!r)
    : [];
  const message = messageContextFrom(b.message);
  return { myRole, members, invitations, requests, ...(message ? { message } : {}) };
}

const STATUSES: readonly InviteStatus[] = ['added', 'invited', 'already', 'refused'];

/** One address's outcome from an invite, or null when it is not usable. Pure. */
export function inviteResultFromRow(row: unknown): InviteResult | null {
  const r = obj(row);
  if (!r) return null;
  const email = str(r.email);
  const status = typeof r.status === 'string' && (STATUSES as readonly string[]).includes(r.status) ? r.status as InviteStatus : null;
  if (!email || !status) return null;
  const reason = str(r.reason);
  const invitationId = str(r.invitationId);
  const link = personalInviteLink(r.link);
  const expiresAt = str(r.expiresAt);
  return {
    email, status, ...(reason ? { reason } : {}),
    ...(invitationId ? { invitationId } : {}), ...(link ? { link } : {}), ...(expiresAt ? { expiresAt } : {}),
  };
}

/** The invite response as this module's type, or null. A missing or unusable link
 *  falls back to the one this shell would build for the project. Pure. */
export function inviteFromBody(body: unknown, projectId: string): InviteOutcome | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as { results?: unknown; link?: unknown; message?: unknown };
  if (!Array.isArray(b.results)) return null;
  const results = b.results.map(inviteResultFromRow).filter((r): r is InviteResult => !!r);
  const link = safeLink(b.link) ?? teamProjectLinkUrl(projectId);
  const message = messageContextFrom(b.message);
  return { results, link, ...(message ? { message } : {}) };
}

/** A request as the instance sent it (`RequestView`), reduced to what an answer
 *  needs, or undefined. Pure. */
export function requestAnswerFrom(value: unknown): RequestAnswer | undefined {
  const r = obj(value);
  const status = str(r?.status);
  if (!r || !status) return undefined;
  const by = obj(r.answeredBy);
  const answeredBy = str(by?.name) ?? str(r.answeredBy);
  const answerRole = inviteRoleOf(r.answerRole);
  return { status, ...(answeredBy ? { answeredBy } : {}), ...(answerRole ? { answerRole } : {}) };
}

async function request(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<Response | null> {
  try {
    return await instanceFetch(instancePath(path), {
      method,
      ...(body !== undefined ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}),
    });
  } catch {
    return null;
  }
}

async function readJson(res: Response): Promise<unknown> {
  try { return await res.json(); } catch { return null; }
}

/** A refused response as a failure: its status, plus the instance's error code when
 *  the body carries one. */
export async function failureOf(res: Response): Promise<{ ok: false; status: number; code?: string }> {
  const body = await readJson(res) as { error?: { code?: unknown } } | null;
  const code = str(body?.error?.code);
  return { ok: false, status: res.status, ...(code ? { code } : {}) };
}

const base = (projectId: string): string => `/api/v1/projects/${encodeURIComponent(projectId)}`;

/** Who has access to a project, and the invitations still waiting. */
export async function listProjectPeople(projectId: string): Promise<PeopleGot<ProjectPeople>> {
  const res = await request('GET', `${base(projectId)}/members`);
  if (!res) return { ok: false, status: 0 };
  if (!res.ok) return failureOf(res);
  const data = peopleFromBody(await readJson(res));
  return data ? { ok: true, data } : { ok: false, status: 0 };
}

/** Invite people by email. People already on the instance become members at once;
 *  anyone else gets an invitation, as the instance's invite policy allows.
 *  `passwordSetup` is sent only when the form offered the password tick. */
export async function inviteToProject(
  projectId: string, emails: string[], role: InviteRole, opts: { passwordSetup?: boolean } = {},
): Promise<PeopleGot<InviteOutcome>> {
  if (!emails.length) return { ok: false, status: 400 };
  const body = { emails, role, ...(opts.passwordSetup !== undefined ? { passwordSetup: opts.passwordSetup } : {}) };
  const res = await request('POST', `${base(projectId)}/invite`, body);
  if (!res) return { ok: false, status: 0 };
  if (!res.ok) return failureOf(res);
  const data = inviteFromBody(await readJson(res), projectId);
  return data ? { ok: true, data } : { ok: false, status: 0 };
}

/** Give a member another role. Resolves the member as the instance now has them. */
export async function changeMemberRole(projectId: string, userId: string, role: InviteRole): Promise<PeopleGot<ProjectMember>> {
  const res = await request('PATCH', `${base(projectId)}/members/${encodeURIComponent(userId)}`, { role });
  if (!res) return { ok: false, status: 0 };
  if (!res.ok) return failureOf(res);
  const body = await readJson(res) as { member?: unknown } | null;
  // Read either a bare member or one wrapped as `{ member }`; a 200 with neither still
  // means the change was made, so the asked-for role is reported.
  const member = memberFromRow(body?.member ?? body) ?? { userId, name: userId, role };
  return { ok: true, data: member };
}

async function deleteAt(path: string): Promise<PeopleGot<null>> {
  const res = await request('DELETE', path);
  if (!res) return { ok: false, status: 0 };
  return res.ok ? { ok: true, data: null } : failureOf(res);
}

/** Remove a member's access to the project. */
export function removeMember(projectId: string, userId: string): Promise<PeopleGot<null>> {
  return deleteAt(`${base(projectId)}/members/${encodeURIComponent(userId)}`);
}

/** Withdraw an invitation that has not been accepted yet. */
export function revokeInvitation(projectId: string, invitationId: string): Promise<PeopleGot<null>> {
  return deleteAt(`${base(projectId)}/invitations/${encodeURIComponent(invitationId)}`);
}

export async function renameTeamProject(projectId: string, name: string): Promise<PeopleGot<null>> {
  const res = await request('PATCH', base(projectId), { name });
  return res?.ok ? { ok: true, data: null } : res ? failureOf(res) : { ok: false, status: 0 };
}

/** Metadata-only CAS preserves artwork and refuses a document with an active room. */
export async function renameTeamSession(id: string, label: string, rev: number, meta: Record<string, unknown> = {}): Promise<PeopleGot<null>> {
  let res: Response;
  try {
    res = await instanceFetch(instancePath(`/api/v1/sessions/${encodeURIComponent(id)}`), {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rev, meta: { ...meta, label } }),
    });
  } catch { return { ok: false, status: 0 }; }
  return res.ok ? { ok: true, data: null } : failureOf(res);
}

export function deleteTeamSession(id: string): Promise<PeopleGot<null>> {
  return deleteAt(`/api/v1/sessions/${encodeURIComponent(id)}`);
}

/** Make a new link for a waiting invitation to this project. Every link copied
 *  earlier for that invitation stops working. Resolves the new link and end day. */
export async function rotateInvitationLink(projectId: string, invitationId: string): Promise<PeopleGot<{ link?: string; expiresAt?: string }>> {
  const res = await request('POST', `${base(projectId)}/invitations/${encodeURIComponent(invitationId)}/link`, {});
  if (!res) return { ok: false, status: 0 };
  if (!res.ok) return failureOf(res);
  const body = obj(await readJson(res));
  const link = personalInviteLink(body?.link);
  const expiresAt = str(body?.expiresAt);
  return { ok: true, data: { ...(link ? { link } : {}), ...(expiresAt ? { expiresAt } : {}) } };
}

/** Invite an address again whose invitation to this project expired. The answer is
 *  one invite result, as the invite route gives each address. */
export async function reinvite(projectId: string, invitationId: string): Promise<PeopleGot<InviteResult>> {
  const res = await request('POST', `${base(projectId)}/invitations/${encodeURIComponent(invitationId)}/reinvite`, {});
  if (!res) return { ok: false, status: 0 };
  if (!res.ok) return failureOf(res);
  const body = obj(await readJson(res));
  // The row bare, wrapped as `{ result }`, or as the invite route's `{ results: [row] }`.
  const row = inviteResultFromRow(body?.result)
    ?? (Array.isArray(body?.results) ? inviteResultFromRow(body.results[0]) : null)
    ?? inviteResultFromRow(body);
  return row ? { ok: true, data: row } : { ok: false, status: 0 };
}

/** Approve an access request with a role (the one asked for when absent), or decline
 *  the request. The instance checks again that this person may answer, against the project the
 *  request was made for. */
export async function answerRequest(id: string, action: 'approve' | 'decline', role?: InviteRole): Promise<AnswerGot> {
  const res = await request('POST', `/api/v1/access-requests/${encodeURIComponent(id)}/${action}`, action === 'approve' && role ? { role } : {});
  if (!res) return { ok: false, status: 0 };
  const body = obj(await readJson(res));
  if (!res.ok) {
    const error = obj(body?.error);
    const code = str(error?.code);
    // Sent inside the error (the instance's error detail) or beside the error.
    const request = requestAnswerFrom(error?.request) ?? requestAnswerFrom(body?.request);
    return { ok: false, status: res.status, ...(code ? { code } : {}), ...(request ? { request } : {}) };
  }
  const answered = requestAnswerFrom(body?.request) ?? { status: action === 'approve' ? 'approved' : 'declined', ...(role ? { answerRole: role } : {}) };
  const outcome = str(body?.outcome);
  return { ok: true, request: answered, ...(outcome ? { outcome } : {}) };
}

/**
 * The sign-ins a new person can use, by display name, from the instance's public
 * sign-in config: the OpenID Connect and GitHub ones. Email and password is left out,
 * because it needs a password set first (an invitation that can set one says so on
 * a line of its own). Used for the invite message when the members list did not
 * carry the words. Resolves [] when the instance does not answer.
 */
export async function signInProviderNames(): Promise<string[]> {
  const res = await request('GET', '/api/auth/config');
  if (!res?.ok) return [];
  const body = obj(await readJson(res));
  if (!Array.isArray(body?.providers)) return [];
  const names: string[] = [];
  for (const row of body.providers) {
    const p = obj(row);
    const name = str(p?.name);
    if (name && p?.kind !== 'password' && !names.includes(name)) names.push(name);
  }
  return names;
}
