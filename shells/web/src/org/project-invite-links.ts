// SPDX-License-Identifier: MPL-2.0
import type { CollabInviteLinks } from '../lib/collab-session.ts';
import { getInstanceBase, instanceFetch, instancePath } from '../lib/instance.ts';
import { listProjectPeople } from './project-members.ts';
import { fetchTeamSession } from './session-source.ts';
import { isManagerPlus, type InvitePolicy } from './team-access.ts';

/** Invitation URLs are capabilities on this instance, never arbitrary remote URLs. */
export function reusableInviteUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  try {
    const base = new URL(getInstanceBase() || location.origin), url = new URL(raw);
    return url.origin === base.origin && !url.username && !url.password && !url.hash
      && /^\/l\/join\/[A-Za-z0-9_-]+$/.test(url.pathname) && /^[A-Za-z0-9_-]+$/.test(url.searchParams.get('s') ?? '')
      && [...url.searchParams.keys()].length === 1 ? url.href : null;
  } catch { return null; }
}

export function projectInviteLinks(projectId: string, policy: InvitePolicy | null, isCurrent: () => boolean, sessionId?: string): CollabInviteLinks {
  const base = getInstanceBase();
  const current = () => { if (!isCurrent() || base !== getInstanceBase()) throw Error('Invitation context changed'); };
  return {
    async roles() {
      current(); const people = await listProjectPeople(projectId); current();
      return people.ok && isManagerPlus(people.data.myRole)
        ? (['editor', 'commenter', 'viewer'] as const).filter(role => !policy || policy.projectRoles.includes(role)) : [];
    },
    async create(role) {
      current();
      const response = await instanceFetch(instancePath(`/api/v1/projects/${encodeURIComponent(projectId)}/invite-links`), {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-lolly-client': 'web' }, body: JSON.stringify({ role, ...(sessionId ? { sessionId } : {}) }),
      });
      current(); if (!response.ok) throw Error('Invitation link refused');
      const value = await response.json() as { url?: unknown; role?: unknown; allowNewPeople?: unknown }; current();
      const url = reusableInviteUrl(value.url);
      if (!url || value.role !== role || typeof value.allowNewPeople !== 'boolean') throw Error('Invalid invitation link');
      return { url, allowNewPeople: value.allowNewPeople };
    },
  };
}

export function sessionInviteLinks(sessionId: string, policy: InvitePolicy | null, isCurrent: () => boolean): CollabInviteLinks {
  const base = getInstanceBase();
  const current = () => isCurrent() && base === getInstanceBase();
  let capability: Promise<CollabInviteLinks> | undefined;
  const resolve = () => {
    if (!current()) return Promise.reject(Error('Document access changed'));
    capability ??= fetchTeamSession(sessionId).then(got => {
      if (!got.ok || !got.data.projectId || !current()) throw Error('Document access changed');
      return projectInviteLinks(got.data.projectId, policy, current, sessionId);
    }).catch(error => { capability = undefined; throw error; });
    return capability;
  };
  return { roles: async () => (await resolve()).roles(), create: async role => (await resolve()).create(role) };
}
