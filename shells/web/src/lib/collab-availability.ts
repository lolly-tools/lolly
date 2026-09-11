// SPDX-License-Identifier: MPL-2.0
/**
 * lib/collab-availability.ts - one answer to "can a collab start here, and on which
 * track?", for any target a surface can offer one on (plans/108 Phase 1).
 *
 * plans/108 section 1 states the rule this module keeps: compatibility is a property
 * of the two TRACKS, never a per-tool allowlist. A private collab (Track A, P2P)
 * pairs two devices on anything that can mount; a work collab (Track B, control-plane
 * rooms) needs a session the instance holds and a member the instance lets edit it. A
 * per-tool `render.collab` capability was rejected on 2026-08-12 - it is an author
 * chore, and it re-states a truth the two tracks already carry.
 *
 * Until now every surface that offered a collab spelled the private track's two gates
 * inline: the Share dialog's row (`lib/collab-share-private.ts`) and the gallery tile
 * menu (`views/gallery.ts`) each wrote `isFlagOnSync(PRIVATE_COLLAB_FLAG) &&
 * getCollabOpener('private')` and then hand-built a `CollabLaunchContext`. Two copies
 * of a rule is a habit, and plans/108 adds Projects tiles, plans/109 adds catalog
 * tiles, and Phase 4 adds views - so the rule is consolidated here once, and every
 * later surface asks rather than re-derives.
 *
 * ── What a target is ──────────────────────────────────────────────────────────
 *
 * Three kinds, matching what a surface can point at (plans/108 Phase 1):
 *
 *  - `'tool'`     a tool as such, with no state behind it: a gallery/utilities tile.
 *                 A collab started here is a blank-slate co-edit (`baseParts: []`),
 *                 and the pairing's remount brings the tool up on both ends.
 *  - `'session'`  a session of a tool - the live mount the Share dialog is sharing, or
 *                 a saved one a Projects tile names. It carries the state as URL-mode
 *                 parts, and, when the instance holds it, the control plane's id.
 *  - `'view'`     an app view (Projects, the catalog, the dashboard). No track can
 *                 start one today: a collab is still bound to a mounted tool, and
 *                 lifting it to the shell is Phase 4's work. Refused here so the
 *                 answer is a documented no rather than an accident.
 *
 * ── What decides each track ───────────────────────────────────────────────────
 *
 * PRIVATE: the `private-collab` flag (on by default, may be user-off or governed off)
 * AND a registered `'private'` opener. Both read fresh on every ask, because a flag
 * flipped in the profile must take effect without a reload and an opener is registered
 * at boot. No control-plane question is asked: a private collab is the airgapped-edge
 * feature, and it works on an instance-free build.
 *
 * WORK: a target that carries the control plane's session id, a registered `'work'`
 * opener, AND a member the instance permits to edit in a collab. That last bit is
 * `collab.edit`, which only `org/` may read - so it arrives here as a POLICY
 * registered by `org/collab-work-opener.ts` beside the opener it belongs with, the
 * same dormant-seam arrangement `lib/collab-launch.ts` uses for the openers. No policy
 * registered means no work track, which is the honest default for a build with no
 * control plane at all (`org/collab-config.ts`: absent reads as false, always).
 *
 * Either track additionally needs a target that can MOUNT here: a tool whose host
 * capabilities this shell cannot satisfy is not a collab candidate, however the tracks
 * feel about it.
 *
 * ── What this module does NOT do ──────────────────────────────────────────────
 *
 * It renders nothing, navigates nowhere, and never decides copy. Surfaces keep their
 * own affordance; they ask this module whether to show it and what to hand the opener.
 * And it is not a permission model: an opener re-checks its own preconditions at press
 * time (a work collab refuses honestly when the member may not edit), so an answer of
 * "available" is an offer, not a promise.
 */

import { getCollabOpener, openCollabLaunch } from './collab-launch.ts';
import type { CollabLaunchContext, CollabTrack } from './collab-launch.ts';
import { isFlagOnSync, PRIVATE_COLLAB_FLAG } from '../feature-flags.ts';

/** Common to every target: whether it can mount on this host at all. */
interface CollabTargetBase {
  /**
   * `false` when this shell cannot mount the target (a tool whose declared
   * capabilities this host does not satisfy - `capabilities.ts`'s `'unavailable'`).
   * ABSENT MEANS YES, because the common caller is a live mount, which has already
   * proved it: only a browse surface listing tools it cannot open has to say so.
   */
  mountable?: boolean;
}

/** A tool with no state behind it - a gallery or utilities tile. */
export interface CollabToolTarget extends CollabTargetBase {
  kind: 'tool';
  toolId: string;
}

/**
 * A session of a tool: the live mount the Share dialog is sharing, or a saved one a
 * Projects tile names.
 */
export interface CollabSessionTarget extends CollabTargetBase {
  kind: 'session';
  /** Optional because the Share dialog's context resolves it from the route and may
   *  not have one; a collab still pairs on whatever the invite seeds. */
  toolId?: string;
  /** The state as URL-mode parts ("key=value"), which is what seeds the joiner. */
  baseParts?: readonly string[];
  /** The export format the session implies, if any. */
  currentFormat?: string;
  /** The id the CONTROL PLANE holds for this session (`TeamSessionRef.id`), when the
   *  target came from one. The single fact the work track cannot do without: a work
   *  collab is a room keyed by it (plans/100 section 7). */
  sessionId?: string;
}

/** An app view. No track today - see the header. */
export interface CollabViewTarget extends CollabTargetBase {
  kind: 'view';
  viewId: string;
}

export type CollabTarget = CollabToolTarget | CollabSessionTarget | CollabViewTarget;

/** What the seam answers for a target. */
export interface CollabAvailability {
  /**
   * The tracks that can start a collab on this target, in the order a surface should
   * OFFER them, so `tracks[0]` is the sensible default. Work comes first when it is
   * available at all, because it is only available for a session the instance holds -
   * where the instance's copy, its persistence and its governance are the reason the
   * session exists. Empty when no collab can start here.
   */
  readonly tracks: readonly CollabTrack[];
  /** The context to hand `openCollabLaunch`, whichever track the caller picks. */
  readonly context: CollabLaunchContext;
}

/** Answers "may this member edit inside a work collab on this instance?" - registered
 *  by `org/`, absent everywhere else. */
export type WorkCollabPolicy = () => boolean;

let workPolicy: WorkCollabPolicy | null = null;

/**
 * Register the work track's capability policy (last wins); returns its unregister fn.
 *
 * `org/collab-work-opener.ts` registers `canEditCollab` beside the `'work'` opener, so
 * the two facts the work track needs arrive together and leave together. Nothing else
 * may register one: the bit is a control-plane grant, and this seam stays neutral by
 * being told rather than by reading `org/`.
 */
export function registerWorkCollabPolicy(fn: WorkCollabPolicy): () => void {
  workPolicy = fn;
  return () => { if (workPolicy === fn) workPolicy = null; };
}

/** Tolerant read of the policy: unregistered, or throwing, both read as no. */
function mayEditWorkCollab(): boolean {
  if (!workPolicy) return false;
  try { return workPolicy() === true; } catch { return false; }
}

/** Trimmed string or `''` - the same "blank is absent" rule the launch context uses. */
function str(v: string | null | undefined): string {
  return String(v ?? '').trim();
}

/**
 * The `CollabLaunchContext` a target implies, whether or not any track can start one.
 *
 * Absent fields are OMITTED rather than set to `undefined`, matching what
 * `org/collab-share.ts` already does by hand: an ordinary local session must hand the
 * opener the same object it always had, with no key for a fact nobody knows.
 */
export function collabLaunchContext(target: CollabTarget): CollabLaunchContext {
  if (target.kind === 'view') return { baseParts: [] };
  const toolId = str(target.toolId);
  const currentFormat = target.kind === 'session' ? str(target.currentFormat) : '';
  const sessionId = target.kind === 'session' ? str(target.sessionId) : '';
  const baseParts = target.kind === 'session' ? target.baseParts ?? [] : [];
  return {
    ...(toolId ? { toolId } : {}),
    baseParts,
    ...(currentFormat ? { currentFormat } : {}),
    ...(sessionId ? { sessionId } : {}),
  };
}

/**
 * Which tracks can start a collab on this target, and the context to start it with.
 *
 * Every gate is read fresh on each call - a flag can be flipped in the profile, an
 * opener registered after boot, and an instance's policy changed mid-session. Callers
 * therefore ask at menu-open / dialog-build time, never once at startup.
 */
export function collabAvailability(target: CollabTarget): CollabAvailability {
  const context = collabLaunchContext(target);
  const tracks: CollabTrack[] = [];
  // A view has no mount to co-edit, and an unmountable tool has no mount at all.
  if (target.kind === 'view' || target.mountable === false) return { tracks, context };
  if (context.sessionId && getCollabOpener('work') && mayEditWorkCollab()) tracks.push('work');
  if (isFlagOnSync(PRIVATE_COLLAB_FLAG) && getCollabOpener('private')) tracks.push('private');
  return { tracks, context };
}

/** Whether a collab can start on this target - on `track` when one is named, on any
 *  track otherwise. The gate a surface's affordance renders behind. */
export function canStartCollab(target: CollabTarget, track?: CollabTrack): boolean {
  const { tracks } = collabAvailability(target);
  return track ? tracks.includes(track) : tracks.length > 0;
}

/**
 * Start a collab on this target, on `track` (or on the target's default track when
 * none is named), and report whether an opener took it.
 *
 * Re-checks availability rather than trusting the caller's earlier ask: a menu can be
 * open for a while, and the answer is cheap. Everything past that point is
 * `openCollabLaunch`'s tolerance - a throwing or absent opener reads as `false` and
 * breaks nothing.
 */
export function startCollab(target: CollabTarget, track?: CollabTrack): boolean {
  const { tracks, context } = collabAvailability(target);
  const chosen = track ?? tracks[0];
  if (!chosen || !tracks.includes(chosen)) return false;
  return openCollabLaunch(chosen, context);
}

/** TEST-ONLY: drop the registered work policy, restoring the dormant default. */
export function _clearWorkCollabPolicyForTests(): void {
  workPolicy = null;
}
