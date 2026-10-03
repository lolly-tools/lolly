// SPDX-License-Identifier: MPL-2.0
/**
 * org/collab-share.ts - the "Work collab" section of the Share dialog
 * (plans/100 section 0/section 7, Track B: org rooms on the optional control plane).
 *
 * Loaded lazily by src/org/index.ts's member branch, mirroring org/share-links.ts
 * one section over: registered through the generic lib/share-sections.ts seam so
 * the dialog itself stays control-plane-unaware, with the heavy work kept out of
 * the boot chunk. This module is the row, its gates and what a press reports; starting
 * the collab itself is org/collab-work-opener.ts's job.
 *
 * Three gates, all required:
 *   - `canJoinCollab()` (org/collab-config.ts) - this instance's control plane must
 *     grant the caller `collab.join`. org/index.ts's own inline bail (its own
 *     `can['collab.join']` check, ahead of even loading this module) does the same
 *     test for the common "no control plane" case cheaply.
 *   - a `'work'` opener registered in lib/collab-launch.ts - org/collab-work-opener.ts,
 *     registered by org/index.ts's member branch on an instance granting `collab.join`.
 *   - a document that is, or can become in this dialog, a session the instance holds:
 *     a team origin on the live mount, or a live document the Team section can save to
 *     a team project (org/team-save.ts adopts the origin, and Start reads it at the
 *     press). Without either, Start could only ever refuse, so there is no row.
 *
 * Row copy follows plans/100 section 0's naming: "Work collab" heading, "Start a collab"
 * verb - never "rooms"/"multiplayer". `announce()` on a successful open, exactly
 * like org/share-links.ts's rows; a missing/throwing opener degrades to silence
 * (openCollabLaunch's own tolerance - see lib/collab-launch.ts). How the start ended
 * comes back through the context's `onOutcome` and shows in a status line under the
 * button while the section is open: a refusal or a failed connect used to reach only
 * the screen-reader announcement, so everyone else saw nothing happen. A start still
 * running when the docked Share panel rebuilds this section carries over to the new
 * one (see `running` below).
 *
 * ── The session id (the one thing this row adds to the context) ────────────────
 *
 * A work collab is a room keyed by the id the INSTANCE holds for the session, and
 * the tool view has no such id: the Team-projects open rewrites to `#/tool/<id>?…`,
 * a working copy that has forgotten where it came from. `org/team-session-origin.ts`
 * carries that fact beside the navigation, and this row is its only reader - which
 * is why the id enters the `CollabLaunchContext` HERE, in the one builder that is
 * already control-plane-aware, rather than in the generic `ShareSectionContext` the
 * dialog hands every section. The neutral seam stays neutral; a plain deployment,
 * and every ordinary local session on a governed one, produce a context with no such
 * field at all.
 */

import type { ShareSectionContext } from '../lib/share-sections.ts';
import { canJoinCollab } from './collab-config.ts';
import { activeTeamSessionOrigin, teamOriginGeneration, teamSessionLive } from './team-session-origin.ts';
import { getCollabOpener, openCollabLaunch, type CollabLaunchOutcome } from '../lib/collab-launch.ts';
import { getSessionWriter } from '../lib/session-source.ts';
import { t } from '../i18n.ts';
import { announce } from '../a11y.ts';

/** A start that has not answered yet, and the status lines waiting for its answer. */
interface RunningStart {
  readonly press: number;
  readonly listeners: Set<(outcome: CollabLaunchOutcome) => void>;
}

/**
 * Starts still running, by tool and mount. The docked Share panel rebuilds its sections
 * on every edit, and a start can wait seconds for the room (org/collab-work-opener.ts
 * CONNECT_TIMEOUT_MS), so the section that was pressed may be gone when the answer
 * arrives. A section built meanwhile shows the start as running, then how it ended.
 * Only a running start is kept, never an ending, so a section built after the answer
 * starts with an empty line. org/team-save.ts keeps its saves the same way.
 */
const running = new Map<string, RunningStart>();
const runningKey = (toolId: string): string => `${toolId}#${teamOriginGeneration()}`;
let pressCount = 0;

/** TEST-ONLY: forget every running start. */
export function _clearCollabStartsForTests(): void {
  running.clear();
}

/**
 * Whether the Team section in this same dialog can save the document to a team project,
 * which makes it a team document Start can run on. org/team-save.ts
 * buildTeamShareSection opens its fresh-save form on the same test; change both together.
 */
function teamSaveOffered(ctx: ShareSectionContext): boolean {
  const writer = getSessionWriter();
  return !!(ctx.toolId && ctx.document && writer && writer.projectOptions().canSave !== false);
}

/**
 * Build the "Work collab" section, or null when the caller may not join a work
 * collab on this instance, no `'work'` opener is registered, or the document has no
 * team origin and no way to get one here (see the header). Exported for
 * tests, which call it directly rather than through the share-sections registry.
 * org/team-save.ts liveCollabJoinable repeats the first two gates; change both together.
 */
export function buildWorkCollabShareSection(ctx: ShareSectionContext): HTMLElement | null {
  if (!canJoinCollab()) return null;
  if (!getCollabOpener('work')) return null;
  if (!activeTeamSessionOrigin(ctx.toolId) && !teamSaveOffered(ctx)) return null;

  const section = document.createElement('section');
  section.className = 'share-work-collab';
  section.style.cssText = 'margin-top:.9rem;padding-top:.8rem;border-top:1px solid hsl(var(--border))';

  const heading = document.createElement('h3');
  heading.style.cssText = 'margin:0 0 .5rem;font-size:.82rem;font-weight:650;letter-spacing:.02em;text-transform:uppercase;color:hsl(var(--muted-foreground))';
  heading.textContent = t('Work collab');

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:baseline;gap:.5rem;flex-wrap:wrap';
  const note = document.createElement('span');
  note.className = 'share-shortest-note';
  row.appendChild(note);

  // This tab is already in the room for the session on screen: show that, and offer no
  // second start, which would only join the same room again and remount the tool.
  const live = activeTeamSessionOrigin(ctx.toolId);
  if (live && teamSessionLive(live.sessionId)) {
    section.dataset.collabLive = '';
    note.textContent = t('You are in a live collab on this session.');
    section.append(heading, row);
    return section;
  }
  note.textContent = t('Invite others on this instance to co-edit this session, live.');

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn--sm';
  btn.dataset.act = 'start-work-collab';
  btn.style.cssText = 'margin-top:.5rem';
  btn.textContent = t('Start a collab');

  // How the last press ended, while this section is open: muted while it starts, the
  // opener's sentence in the destructive colour when it did not. A press clears the line.
  const status = document.createElement('p');
  status.className = 'share-work-collab-status';
  status.dataset.collabStatus = '';
  status.style.cssText = 'margin:.45rem 0 0;font-size:12px';
  status.hidden = true;
  const showStatus = (message: string, error: boolean): void => {
    status.textContent = message;
    status.style.color = error ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))';
    status.hidden = !message;
  };

  section.append(heading, row, btn, status);
  // The press this line answers for. A later press takes the line over, so an earlier
  // start that answers late writes nothing.
  let following = 0;
  const listen = (start: RunningStart): void => {
    following = start.press;
    start.listeners.add((outcome) => {
      if (following === start.press) showStatus(outcome.ok ? '' : outcome.message, !outcome.ok);
    });
  };
  const toolId = ctx.toolId ?? '';
  const carried = running.get(runningKey(toolId));
  if (carried) {
    listen(carried);
    showStatus(t('Starting a collab'), false);
  }

  btn.addEventListener('click', () => {
    // Read at PRESS time, not build time - the same rule as canJoinCollab() above, and
    // it matters here for a different reason: the origin belongs to the live mount, and
    // pressing is the moment we can still be sure there is one. It answers only for the
    // tool this dialog is sharing (`activeTeamSessionOrigin` requires the id), and the
    // field is OMITTED rather than set to undefined when there is none, so an ordinary
    // local session hands the opener the context it always had, plus `onOutcome`.
    const origin = activeTeamSessionOrigin(ctx.toolId);
    // A panel drawn before the room went live is not a second start either.
    if (origin && teamSessionLive(origin.sessionId)) return;
    showStatus('', false);
    // Listening before the opener runs, which may answer before it returns. The key is
    // fixed at the press, so a remount in between cannot strand the entry.
    const key = runningKey(toolId);
    const start: RunningStart = { press: ++pressCount, listeners: new Set() };
    listen(start);
    running.set(key, start);
    const settle = (): void => { if (running.get(key) === start) running.delete(key); };
    const onOutcome = (outcome: CollabLaunchOutcome): void => {
      settle();
      for (const fn of start.listeners) fn(outcome);
    };
    const opened = openCollabLaunch('work', {
      toolId: ctx.toolId,
      baseParts: ctx.baseParts,
      currentFormat: ctx.currentFormat,
      ...(origin ? { sessionId: origin.sessionId } : {}),
      onOutcome,
    });
    if (!opened) { settle(); return; }
    announce(t('Starting a collab'));
    // Only a start still under way says so.
    if (running.get(key) === start) showStatus(t('Starting a collab'), false);
  });

  return section;
}
