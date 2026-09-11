// SPDX-License-Identifier: MPL-2.0
/**
 * Favourite tools - the user's starred collection, surfaced as a "Favourites"
 * category in the gallery filter.
 *
 * Stored on the user PROFILE (`profile.favourites`), alongside the feature flags - 
 * so it persists across reloads AND travels in the portable backup / any future
 * profile sync, not just this device. Every caller goes through these two functions,
 * so the storage location stays swappable.
 */

import { recordNewFavourites } from './featured-activity.ts';
import type { HostV1, Profile } from '@lolly-tools/core/host-v1';

type FavHost = HostV1 & { profile: { set(p: Profile): Promise<void> } };

/** The favourited tool ids from the profile (empty if none). */
export function loadFavourites(profile: Profile | null | undefined): Set<string> {
  const list = profile?.favourites;
  return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []);
}

/**
 * Write the favourites set back onto the profile and persist it. Mutates the passed
 * profile object (the same cached instance host.profile.get() returned) so later reads
 * see the change, then flushes via host.profile.set. Best-effort - a failed write just
 * means the star doesn't survive a reload.
 */
export async function saveFavourites(host: FavHost, profile: Profile, favourites: Set<string>): Promise<void> {
  recordNewFavourites('tools', profile.favourites, favourites);
  profile.favourites = [...favourites];
  try { await host.profile.set(profile); } catch { /* storage off / quota - non-fatal */ }
}
