// SPDX-License-Identifier: MPL-2.0
/**
 * Project favourites - folders, saved sessions, or folder images the user has starred in the
 * Projects view. Stored on the user PROFILE (`profile.favouriteProjects`), exactly like the
 * tool favourites (lib/favourites.ts) and catalog asset favourites (lib/asset-favourites.ts),
 * so they ride the normal profile persistence + sync rather than living on one device.
 *
 * A ref is whatever the Projects store keys an item by: a folder id, a session slot, or a
 * folder-image ref. The set is namespace-free here because Projects refs are already distinct
 * from tool ids and catalog asset ids (separate profile fields).
 */
import { recordNewFavourites } from './featured-activity.ts';
import type { Profile } from '@lolly-tools/core/host-v1';

// A host whose profile can persist. `get` (which every host's ProfileAPI has) anchors the
// type so it is NOT a weak all-optional shape; `set` is added by the shell, so it is optional
// here and the call below is guarded. Lets the projects view pass its host without a cast.
type FavHost = { profile: { get(): Promise<Profile>; set?(p: Profile): Promise<unknown> } };

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

/** The starred project refs from the profile (empty if none). */
export function loadProjectFavourites(profile: Profile | null | undefined): Set<string> {
  return new Set(strings(profile?.favouriteProjects));
}

/**
 * Write the favourites set back onto the profile and persist it. Mutates the passed profile
 * object (the cached instance host.profile.get() returned) so later reads see the change,
 * then flushes via host.profile.set. Best-effort - a failed write just means the star doesn't
 * survive the reload.
 */
export async function saveProjectFavourites(host: FavHost, profile: Profile, favs: Set<string>): Promise<void> {
  recordNewFavourites('projects', profile.favouriteProjects, favs);
  profile.favouriteProjects = [...favs];
  try { await host.profile.set?.(profile); } catch { /* storage off / quota - non-fatal */ }
}
