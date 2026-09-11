// SPDX-License-Identifier: MPL-2.0
/**
 * Favourite + hidden ASSETS - the user's per-asset overlay, surfaced by the Catalog
 * view and every asset picker.
 *
 *   - favourites → a pinned collapsible "Favourites" section at the top of each picker
 *     and a section in the Catalog view.
 *   - hidden     → the only honest "delete" for an immutable/shared catalog asset: it
 *     drops from THIS user's Catalog + every picker, but the shared file is untouched.
 *
 * Both are `Set<string>` of BASE asset ids (theme suffix stripped, see assetBaseId) - 
 * so the same themable icon starred/hidden under two colour themes counts once. Stored
 * on the user PROFILE (`profile.favouriteAssets` / `profile.hiddenAssets`), exactly like
 * the TOOL favourites in ./favourites.ts, so they persist across reloads and travel in
 * the portable backup. Every caller goes through these functions so the storage location
 * stays swappable. Distinct profile keys from `favourites` (tool ids) - the two never
 * collide.
 */

import { recordNewFavourites } from './featured-activity.ts';
import { stripAssetModifiers } from '../../../../engine/src/photo-treatment.ts';
import type { HostV1, Profile } from '@lolly-tools/core/host-v1';

type FavHost = HostV1 & { profile: { set(p: Profile): Promise<unknown> } };

/** The stable key an asset is favourited / hidden / recategorised under: its base id,
 *  with any presentation-modifier suffix stripped (`?theme=` icon colours, `?treatment=`
 *  photo treatments) - those are presentation, not identity, for these per-user overlays. */
export function assetBaseId(id: string): string {
  return stripAssetModifiers(id);
}

const strings = (list: unknown): string[] =>
  Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];

/**
 * Assets hidden by default - the shipped "great default state" for a fresh (or not-yet-
 * seeded) profile: the SUSECON'26 event set plus a curated handful of stock/event photos
 * that shouldn't crowd the general catalogue. These are ordinary hides - the user can
 * unhide any of them from the Catalog details modal, and once they touch the hidden
 * overlay the current set is baked in (see saveHiddenAssets) so their choice sticks and
 * this default never re-applies. Base ids (no ?theme/?treatment suffix).
 */
export const DEFAULT_HIDDEN_ASSETS: readonly string[] = [
  // SUSECON 2026 - the whole event set.
  'suse/photos/susecon26-branding-mon-18',
  'suse/photos/susecon26-demopalooza-mon-4',
  'suse/photos/susecon26-demopalooza-mon-44',
  'suse/photos/susecon26-demopalooza-mon-49',
  'suse/photos/susecon26-demopalooza-mon-7',
  'suse/photos/susecon26-keynote-tues-19',
  'suse/photos/susecon26-keynote-tues-46',
  'suse/photos/susecon26-keynote-tues-53',
  'suse/photos/susecon26-keynote-tues-59',
  'suse/photos/susecon26-keynote-tues-95',
  'suse/photos/susecon26-keynote-wed-11',
  // Curated stock / event photos to tuck away by default.
  'suse/photos/stock-12',
  'suse/photos/stock-28',
  'suse/photos/stock-88',
  'suse/photos/stock-116',
  'suse/photos/stock-140',
  'suse/photos/stock-145',
  'suse/photos/stock-154',
  'suse/photos/mwc-2026-booth-1',
  'suse/photos/awareness-kubecon-3',
];

/** The favourited asset ids from the profile (empty if none). */
export function loadFavouriteAssets(profile: Profile | null | undefined): Set<string> {
  return new Set(strings(profile?.favouriteAssets));
}

/** Write the favourite-assets set back onto the profile and persist it. Mutates the
 *  passed profile object (the cached instance host.profile.get() returned), then flushes
 *  via host.profile.set. Best-effort - a failed write just means the star doesn't survive
 *  a reload. */
export async function saveFavouriteAssets(host: FavHost, profile: Profile, favs: Set<string>): Promise<void> {
  recordNewFavourites('assets', profile.favouriteAssets, favs);
  profile.favouriteAssets = [...favs];
  try { await host.profile.set(profile); } catch { /* storage off / quota - non-fatal */ }
}

/** The hidden asset ids from the profile. Until this profile has been seeded (the user
 *  hasn't yet touched the hidden overlay), the shipped DEFAULT_HIDDEN_ASSETS are merged in
 *  so a fresh catalogue opens in its intended default state; after that the stored set is
 *  authoritative so un-hides stick. */
export function loadHiddenAssets(profile: Profile | null | undefined): Set<string> {
  const stored = strings(profile?.hiddenAssets);
  return profile?.catalogDefaultsSeeded
    ? new Set(stored)
    : new Set([...DEFAULT_HIDDEN_ASSETS, ...stored]);
}

/** Persist the hidden-assets set, same semantics as saveFavouriteAssets. Also bakes in the
 *  shipped defaults: the set being saved already reflects them (loadHiddenAssets merged
 *  them), so recording it verbatim and flagging the profile seeded means a later un-hide of
 *  a default sticks and the defaults are never re-merged on top. */
export async function saveHiddenAssets(host: FavHost, profile: Profile, hidden: Set<string>): Promise<void> {
  profile.hiddenAssets = [...hidden];
  profile.catalogDefaultsSeeded = true;
  try { await host.profile.set(profile); } catch { /* storage off / quota - non-fatal */ }
}
