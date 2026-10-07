// SPDX-License-Identifier: MPL-2.0
/**
 * org/share-access - the instance's sharing API beyond the people list (lolly plan
 * 299 M1): general access, group grants with roles and end dates, a member's end
 * date, and the groups members make themselves.
 *
 * Pure data, like org/project-members.ts: fetch and shape through the core readers
 * (`@lolly-tools/core/sharing-v1`), no DOM. Every call resolves (never throws) to
 * `{ ok: true, data }` or `{ ok: false, status, code? }`; status 0 is "no answer".
 * A 404 from the sharing route means the instance does not have these routes yet,
 * and the panel stays out of the way.
 *
 * Server contract (lolly-work plan 79):
 *   GET   /api/v1/projects/:id/sharing                    -> ShareState
 *   PUT   /api/v1/projects/:id/sharing {general?, grants?, settings?} -> ShareState
 *   PUT   /api/v1/projects/:id/members/:userId/expiry {expiresAt} -> { userId, role, expiresAt? }
 *   GET   /api/v1/share-groups                            -> { groups, enabled }
 *   POST  /api/v1/share-groups {name, description?, add?} -> summary
 *   GET   /api/v1/share-groups/people?q=                  -> { people, truncated }
 *   GET   /api/v1/share-groups/:id                        -> detail
 *   PATCH /api/v1/share-groups/:id {name?, description?, add?, remove?, managers?} -> detail | 204
 *   DELETE /api/v1/share-groups/:id                       -> 204
 */
import {
  readShareGroupDetail, readShareGroupSummary, readShareState,
  type GeneralAccess, type ShareGroupDetail, type ShareGroupSummary, type ShareRole, type ShareState,
} from '@lolly-tools/core/sharing-v1';
import { instanceFetch, instancePath } from '../lib/instance.ts';

export type ShareGot<T> = { ok: true; data: T } | { ok: false; status: number; code?: string };

/** One group grant, in the shape the PUT route takes. */
export interface GrantWrite {
  principal: { kind: 'group'; name: string } | { kind: 'custom-group'; id: string };
  role: ShareRole;
  expiresAt?: string;
}

export interface SharePatch {
  general?: GeneralAccess | { audience: 'restricted' };
  grants?: GrantWrite[];
}

export interface PersonSuggestion { id: string; name: string }

async function request(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<Response | null> {
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

async function failureOf(res: Response): Promise<{ ok: false; status: number; code?: string }> {
  const body = await readJson(res) as { error?: { code?: unknown } } | null;
  const code = typeof body?.error?.code === 'string' ? body.error.code : undefined;
  return { ok: false, status: res.status, ...(code ? { code } : {}) };
}

async function read<T>(res: Response | null, shape: (v: unknown) => T | null): Promise<ShareGot<T>> {
  if (!res) return { ok: false, status: 0 };
  if (!res.ok) return failureOf(res);
  const data = shape(await readJson(res));
  return data ? { ok: true, data } : { ok: false, status: 502 };
}

const project = (id: string): string => `/api/v1/projects/${encodeURIComponent(id)}`;
const group = (id: string): string => `/api/v1/share-groups/${encodeURIComponent(id)}`;

export async function getShareState(projectId: string): Promise<ShareGot<ShareState>> {
  return read(await request('GET', `${project(projectId)}/sharing`), readShareState);
}

export async function putShareState(projectId: string, patch: SharePatch): Promise<ShareGot<ShareState>> {
  return read(await request('PUT', `${project(projectId)}/sharing`, patch), readShareState);
}

/** Set (ISO) or clear (null) a member's end date. */
export async function setMemberExpiry(projectId: string, userId: string, expiresAt: string | null): Promise<ShareGot<{ expiresAt?: string }>> {
  return read(await request('PUT', `${project(projectId)}/members/${encodeURIComponent(userId)}/expiry`, { expiresAt }), (v) => {
    const at = (v as { expiresAt?: unknown } | null)?.expiresAt;
    return typeof at === 'string' ? { expiresAt: at } : {};
  });
}

export async function listShareGroups(): Promise<ShareGot<ShareGroupSummary[]>> {
  return read(await request('GET', '/api/v1/share-groups'), (v) => {
    const raw = (v as { groups?: unknown } | null)?.groups;
    return Array.isArray(raw) ? raw.map(readShareGroupSummary).filter((g): g is ShareGroupSummary => !!g) : null;
  });
}

export async function createShareGroup(input: { name: string; description?: string; add?: string[] }): Promise<ShareGot<ShareGroupSummary>> {
  return read(await request('POST', '/api/v1/share-groups', input), readShareGroupSummary);
}

export async function getShareGroup(id: string): Promise<ShareGot<ShareGroupDetail>> {
  return read(await request('GET', group(id)), readShareGroupDetail);
}

/** Change a group. `null` data means the change took the caller out of the group. */
export async function updateShareGroup(
  id: string, change: { name?: string; description?: string | null; add?: string[]; remove?: string[]; managers?: string[] },
): Promise<ShareGot<ShareGroupDetail | null>> {
  const res = await request('PATCH', group(id), change);
  if (res?.status === 204) return { ok: true, data: null };
  return read(res, readShareGroupDetail);
}

export async function deleteShareGroup(id: string): Promise<ShareGot<null>> {
  const res = await request('DELETE', group(id));
  if (!res) return { ok: false, status: 0 };
  return res.ok ? { ok: true, data: null } : failureOf(res);
}

/** People the caller may add: those they already share a project or group with, or
 *  the exact address typed. Names and ids only. */
export async function suggestPeople(q: string): Promise<ShareGot<PersonSuggestion[]>> {
  return read(await request('GET', `/api/v1/share-groups/people?q=${encodeURIComponent(q.trim().slice(0, 120))}`), (v) => {
    const raw = (v as { people?: unknown } | null)?.people;
    if (!Array.isArray(raw)) return null;
    return raw.flatMap((p) => {
      const o = p as { id?: unknown; name?: unknown } | null;
      return o && typeof o.id === 'string' && typeof o.name === 'string' && o.name.trim() ? [{ id: o.id, name: o.name.trim().slice(0, 256) }] : [];
    }).slice(0, 50);
  });
}
