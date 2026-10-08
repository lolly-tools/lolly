// SPDX-License-Identifier: MPL-2.0
/**
 * lib/team-project-listing - which shared projects belong in a person's own Projects
 * list (lolly plan 299 section 6).
 *
 * A project shared with everyone on the workspace is open to every member, but it
 * should not crowd every member's Projects view. A shared project is listed as the
 * person's own when:
 *  - they did not hide it, and
 *  - they own it, were added to it (directly or through a group), pinned it, or
 *    opened it in the last 30 days.
 * Everything else is found by browsing or searching. An older source that says
 * nothing about why counts every project as the person's own, as before.
 *
 * Pure, no imports beyond types, so the rule is tested as data.
 */
import type { TeamProjectRef } from './session-source.ts';

export const RECENT_PROJECT_DAYS = 30;
const DAY_MS = 86_400_000;

/** A relationship, not just access: the person is in the project. */
export function isRelationship(project: Pick<TeamProjectRef, 'via'>): boolean {
  return project.via === undefined || project.via === 'owner' || project.via === 'member'
    || project.via === 'group' || project.via === 'custom-group';
}

/** Whether a shared project shows in the person's own list. */
export function isOwnProject(project: Pick<TeamProjectRef, 'via' | 'listed' | 'lastOpenedAt'>, now: number = Date.now()): boolean {
  if (project.listed === 'hidden') return false;
  if (project.listed === 'pinned' || isRelationship(project)) return true;
  const opened = project.lastOpenedAt ? Date.parse(project.lastOpenedAt) : NaN;
  return Number.isFinite(opened) && now - opened <= RECENT_PROJECT_DAYS * DAY_MS;
}

/** Split a project list into the person's own and the rest, each order kept. */
export function splitOwnProjects<T extends Pick<TeamProjectRef, 'via' | 'listed' | 'lastOpenedAt'>>(projects: readonly T[], now: number = Date.now()): { own: T[]; other: T[] } {
  const own: T[] = [], other: T[] = [];
  for (const p of projects) (isOwnProject(p, now) ? own : other).push(p);
  return { own, other };
}
