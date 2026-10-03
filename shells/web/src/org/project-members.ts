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
 * Server contract (lolly-work plan 74):
 *   GET    /api/v1/projects/:id/members                 -> { myRole, members, invitations }
 *   POST   /api/v1/projects/:id/invite {emails, role}   -> { results, link }
 *   PATCH  /api/v1/projects/:id/members/:userId {role}  -> member
 *   DELETE /api/v1/projects/:id/members/:userId         -> 204
 *   DELETE /api/v1/projects/:id/invitations/:id         -> 204
 * A member's email and the invitations come back only for an owner or a manager; the
 * caller's own member row carries `isMe: true`. A refusal's body is
 * `{ error: { code, message } }`, and the code is kept beside the status.
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
}

export interface ProjectPeople {
  myRole: TeamRole;
  members: ProjectMember[];
  invitations: ProjectInvitation[];
}

export interface InviteResult {
  email: string;
  status: InviteStatus;
  reason?: string;
}

export interface InviteOutcome {
  results: InviteResult[];
  /** The address to send: opens the project in the app for anyone who can see the project. */
  link: string;
}

/** A failure keeps the HTTP status (0: no answer at all) and, when the instance sent
 *  one, its error code (`{ error: { code } }`), for statuses that mean several things. */
export type PeopleGot<T> = { ok: true; data: T } | { ok: false; status: number; code?: string };

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** The address that opens a team project: the instance's app with `#/team/project/<id>`. */
export function teamProjectLinkUrl(projectId: string, base = getInstanceBase() || globalThis.location?.origin || ''): string {
  return `${base.replace(/\/+$/, '')}/#/team/project/${encodeURIComponent(projectId)}`;
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

function invitationFromRow(row: unknown): ProjectInvitation | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const id = str(r.id);
  const email = str(r.email);
  const role = inviteRoleOf(r.role);
  if (!id || !email || !role) return null;
  const createdAt = str(r.createdAt);
  const expiresAt = str(r.expiresAt);
  return { id, email, role, ...(createdAt ? { createdAt } : {}), ...(expiresAt ? { expiresAt } : {}) };
}

/** The members response as this module's type, or null when it is not one. Pure. */
export function peopleFromBody(body: unknown): ProjectPeople | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as { myRole?: unknown; members?: unknown; invitations?: unknown };
  const myRole = teamRoleOf(b.myRole);
  if (!myRole || !Array.isArray(b.members)) return null;
  const members = b.members.map(memberFromRow).filter((m): m is ProjectMember => !!m);
  const invitations = Array.isArray(b.invitations)
    ? b.invitations.map(invitationFromRow).filter((i): i is ProjectInvitation => !!i)
    : [];
  return { myRole, members, invitations };
}

const STATUSES: readonly InviteStatus[] = ['added', 'invited', 'already', 'refused'];

/** The invite response as this module's type, or null. A missing or unusable link
 *  falls back to the one this shell would build for the project. Pure. */
export function inviteFromBody(body: unknown, projectId: string): InviteOutcome | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as { results?: unknown; link?: unknown };
  if (!Array.isArray(b.results)) return null;
  const results: InviteResult[] = [];
  for (const row of b.results) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const email = str(r.email);
    const status = typeof r.status === 'string' && (STATUSES as readonly string[]).includes(r.status) ? r.status as InviteStatus : null;
    if (!email || !status) continue;
    const reason = str(r.reason);
    results.push({ email, status, ...(reason ? { reason } : {}) });
  }
  const link = typeof b.link === 'string' && /^https?:\/\//i.test(b.link) && !/[<>\s]/.test(b.link) ? b.link : teamProjectLinkUrl(projectId);
  return { results, link };
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
 *  anyone else gets an invitation, as the instance's invite policy allows. */
export async function inviteToProject(projectId: string, emails: string[], role: InviteRole): Promise<PeopleGot<InviteOutcome>> {
  if (!emails.length) return { ok: false, status: 400 };
  const res = await request('POST', `${base(projectId)}/invite`, { emails, role });
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
