// SPDX-License-Identifier: MPL-2.0
/**
 * Favourite / hidden catalog assets, stored on the user PROFILE - the same
 * `profile.favouriteAssets` / `profile.hiddenAssets` string arrays the web shell uses
 * (see shells/web/src/lib/asset-favourites.ts). Favourites sort to the top of the
 * catalog + the asset picker; hidden assets drop out of the picker. Pure helpers over a
 * plain profile record (the TUI store keeps the profile as Record<string, unknown>).
 */
import type { AssetRow } from '../catalog.ts';

type Profile = Record<string, unknown> | null | undefined;
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

export function loadFavourites(p: Profile): Set<string> { return new Set(strings(p?.favouriteAssets)); }
export function loadHidden(p: Profile): Set<string> { return new Set(strings(p?.hiddenAssets)); }

/** Return a NEW profile with `id` toggled in favouriteAssets. */
export function withFavouriteToggled(p: Profile, id: string): Record<string, unknown> {
  const s = loadFavourites(p); s.has(id) ? s.delete(id) : s.add(id);
  return { ...(p ?? {}), favouriteAssets: [...s] };
}
/** Return a NEW profile with `id` toggled in hiddenAssets. */
export function withHiddenToggled(p: Profile, id: string): Record<string, unknown> {
  const s = loadHidden(p); s.has(id) ? s.delete(id) : s.add(id);
  return { ...(p ?? {}), hiddenAssets: [...s] };
}

/** Stable sort: favourites first, everything else in original order. */
export function sortFavouritesFirst(assets: AssetRow[], favs: Set<string>): AssetRow[] {
  if (favs.size === 0) return assets;
  const fav: AssetRow[] = [], rest: AssetRow[] = [];
  for (const a of assets) (favs.has(a.id) ? fav : rest).push(a);
  return [...fav, ...rest];
}
