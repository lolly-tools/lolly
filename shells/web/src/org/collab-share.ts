// SPDX-License-Identifier: MPL-2.0
/**
 * org/collab-share.ts - the "Work collab" section of the Share dialog
 * (plans/100 section 0/section 7, Track B: org rooms on the optional control plane).
 *
 * Loaded lazily by src/org/index.ts's member branch, mirroring org/share-links.ts
 * one section over: registered through the generic lib/share-sections.ts seam so
 * the dialog itself stays control-plane-unaware, with the heavy work kept out of
 * the boot chunk. This wave (plans/100 section 13 wave 3.1) lands the row + gating ONLY - 
 * the ceremony/join UI that actually starts a work collab is a later wave, so the
 * row renders nothing anywhere today.
 *
 * Two independent gates, both required:
 *   - `canJoinCollab()` (org/collab-config.ts) - this instance's control plane must
 *     grant the caller `collab.join`. Absent on every instance until the server
 *     ships the bits (plans/100 section 7.3), which is where org/index.ts's own inline
 *     bail (its own `can['collab.join']` check, ahead of even loading this module)
 *     does the same test for the common "no control plane" case cheaply.
 *   - a `'work'` opener registered in lib/collab-launch.ts - the actual ceremony/
 *     join dialog, which arrives with the invite UX (plans/100 section 7 item 9). Nothing
 *     registers one yet, so today this gate alone is enough to keep the row absent
 *     even on an instance that DOES grant `collab.join`.
 *
 * Row copy follows plans/100 section 0's naming: "Work collab" heading, "Start a collab"
 * verb - never "rooms"/"multiplayer". `announce()` on a successful open, exactly
 * like org/share-links.ts's rows; a missing/throwing opener degrades to silence
 * (openCollabLaunch's own tolerance - see lib/collab-launch.ts).
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
import { activeTeamSessionOrigin } from './team-session-origin.ts';
import { getCollabOpener, openCollabLaunch } from '../lib/collab-launch.ts';
import { t } from '../i18n.ts';
import { announce } from '../a11y.ts';

/**
 * Build the "Work collab" section, or null when the caller may not join a work
 * collab on this instance, or no `'work'` opener is registered yet. Exported for
 * tests, which call it directly rather than through the share-sections registry.
 */
export function buildWorkCollabShareSection(ctx: ShareSectionContext): HTMLElement | null {
  if (!canJoinCollab()) return null;
  if (!getCollabOpener('work')) return null;

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
  note.textContent = t('Invite others on this instance to co-edit this session, live.');
  row.appendChild(note);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn--sm';
  btn.dataset.act = 'start-work-collab';
  btn.style.cssText = 'margin-top:.5rem';
  btn.textContent = t('Start a collab');

  section.append(heading, row, btn);

  btn.addEventListener('click', () => {
    // Read at PRESS time, not build time - the same rule as canJoinCollab() above, and
    // it matters here for a different reason: the origin belongs to the live mount, and
    // pressing is the moment we can still be sure there is one. It answers only for the
    // tool this dialog is sharing (`activeTeamSessionOrigin` requires the id), and the
    // field is OMITTED rather than set to undefined when there is none, so an ordinary
    // local session hands the opener the byte-identical context it always has.
    const origin = activeTeamSessionOrigin(ctx.toolId);
    const opened = openCollabLaunch('work', {
      toolId: ctx.toolId,
      baseParts: ctx.baseParts,
      currentFormat: ctx.currentFormat,
      ...(origin ? { sessionId: origin.sessionId } : {}),
    });
    if (opened) announce(t('Starting a collab'));
  });

  return section;
}
