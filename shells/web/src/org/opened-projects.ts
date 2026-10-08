// SPDX-License-Identifier: MPL-2.0
/**
 * org/opened-projects - the team projects opened in this tab, and the one listener
 * told about each.
 *
 * Opening a project answers any "<person> shared <project> with you" inbox message
 * about that project. The modules that open a project (org/team-open.ts,
 * org/team-projects.ts) report the opening here; org/banner.ts listens, takes down
 * and acks the matching messages, and reads the set when its inbox loads after the
 * opening.
 *
 * A leaf with no imports, so reporting an opening never imports org/banner.ts. The
 * banner sits in the org/index.ts load cycle, and an opener importing the banner
 * pulled the opener and the Share dialog's Team section into that cycle too.
 */

const opened = new Set<string>();
let listener: ((projectId: string) => void) | null = null;
let recorder: ((projectId: string) => void) | null = null;

/** A team project was opened: remember it, tell the listener, and let the workspace
 *  record the opening for the person's own recent list (lolly plan 299). */
export function noteProjectOpened(projectId: string): void {
  if (!projectId) return;
  opened.add(projectId);
  listener?.(projectId);
  recorder?.(projectId);
}

/** Set the one recorder (org/session-source.ts), or clear it with null. */
export function onProjectOpenedRecord(fn: ((projectId: string) => void) | null): void {
  recorder = fn;
}

/** The team projects opened in this tab so far. */
export function openedProjects(): ReadonlySet<string> {
  return opened;
}

/** Set the one listener (org/banner.ts), or clear it with null. */
export function onProjectOpened(fn: ((projectId: string) => void) | null): void {
  listener = fn;
}

/** TEST-ONLY: forget every opened project. */
export function _clearOpenedProjectsForTests(): void {
  opened.clear();
}
