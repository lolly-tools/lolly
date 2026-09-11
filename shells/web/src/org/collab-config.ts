// SPDX-License-Identifier: MPL-2.0
/**
 * org/collab-config.ts - typed accessors for the collab capability bits an
 * OPTIONAL control plane may grant, per plans/100 section 6.3/section 7.7 ("work collab", the
 * org-rooms track). Reads `OrgConfig.can['collab.join']` / `['collab.edit']`
 * through the existing generic seam (`org/index.ts`'s `orgConfig()`) - this file
 * adds no new network/state surface of its own.
 *
 * Absent → false, always: no control plane, a control plane that never mentions
 * these bits, or an explicit `false` all read the same way. There is no "governed
 * off" vs "ungoverned" distinction here (unlike feature-flags.ts's default/hidden
 * pair) - a work collab is an instance-granted capability, not a personal
 * preference, so the only two states that matter are "the instance said yes" and
 * "no". Mirrors the `can['export.download']`/`can['export.request']` pattern in
 * org/index.ts's applyExportPolicy, minus its opt-OUT default (export defaults
 * open for back-compat; collab has no back-compat to keep, so it defaults closed).
 *
 * These are READ-ONLY capability queries - they render no UI and gate nothing by
 * themselves. Consumers (the "Work collab" share-dialog row, the ceremony/presence
 * UI, provider registration) arrive in later plans/100 waves; this module only
 * gives them one honest place to ask "can this member join/edit a work collab on
 * this instance?" without reaching into org/index.ts's OrgConfig shape directly.
 */

import { orgConfig } from './index.ts';

/** Whether the current member may join a work collab (an org-room co-editing
 *  session) on this instance's control plane. `false` with no control plane, no
 *  opinion, or an explicit deny - never assume yes. */
export function canJoinCollab(): boolean {
  return orgConfig()?.can?.['collab.join'] === true;
}

/** Whether the current member may make edits inside a work collab (as opposed to
 *  observer-only presence - plans/100 section 7.5's writer/observer split). `false` with
 *  no control plane, no opinion, or an explicit deny - never assume yes. A member
 *  who cannot join at all (`canJoinCollab()` false) cannot edit either, but this
 *  accessor does not itself imply that ordering - callers gate on both. */
export function canEditCollab(): boolean {
  return orgConfig()?.can?.['collab.edit'] === true;
}
