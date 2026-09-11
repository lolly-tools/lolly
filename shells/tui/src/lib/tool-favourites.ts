// SPDX-License-Identifier: MPL-2.0
/**
 * Favourite tools - the user's starred collection, stored on the profile under
 * `profile.favourites` (the SAME key the web shell uses, see shells/web/src/lib/
 * favourites.ts), so a device that runs both shells shares the set. Pure helpers over a
 * plain profile record; the gallery stars a tool, floats favourites up, and offers a
 * favourites-only filter.
 */
import type { ToolEntry } from '../catalog.ts';

type Profile = Record<string, unknown> | null | undefined;
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

export function loadToolFavourites(p: Profile): Set<string> { return new Set(strings(p?.favourites)); }

/** Return a NEW profile with tool `id` toggled in favourites. */
export function withToolFavouriteToggled(p: Profile, id: string): Record<string, unknown> {
  const s = loadToolFavourites(p); s.has(id) ? s.delete(id) : s.add(id);
  return { ...(p ?? {}), favourites: [...s] };
}

export type ToolSort = 'catalog' | 'az' | 'za';
export const TOOL_SORTS: readonly ToolSort[] = ['catalog', 'az', 'za'];
export const TOOL_SORT_LABEL: Record<ToolSort, string> = { catalog: 'recent', az: 'A–Z', za: 'Z–A' };

/** Apply a sort mode, then float favourites to the top (stable). */
export function sortTools(tools: ToolEntry[], mode: ToolSort, favs: Set<string>): ToolEntry[] {
  const arr = [...tools];
  if (mode === 'az') arr.sort((a, b) => a.name.localeCompare(b.name));
  else if (mode === 'za') arr.sort((a, b) => b.name.localeCompare(a.name));
  // 'catalog' keeps registry order.
  if (favs.size === 0) return arr;
  const fav: ToolEntry[] = [], rest: ToolEntry[] = [];
  for (const t of arr) (favs.has(t.id) ? fav : rest).push(t);
  return [...fav, ...rest];
}
