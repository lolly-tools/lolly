// SPDX-License-Identifier: MPL-2.0
import { scoreHaystack, type SearchField } from '../lib/search/match.ts';

/**
 * The gallery's search and category predicate, without the sort. One policy for every
 * layout: Grid and Card hide the same tiles, because the view toggles `.is-filtered`
 * on live nodes and every layout rule leaves a filtered tile hidden.
 */
export function matchesGalleryFilter(tool: { id: string; category?: string }, options: {
  onlyUtilities: boolean; query: string; queryTokens: readonly string[];
  fields: ReadonlyMap<string, SearchField[]>; category: string; favouriteCategory: string; favourites: ReadonlySet<string>;
}): boolean {
  // Utilities live in their own `#/u` view and never appear in the main gallery, not
  // even through search (the Utilities view has its own search box). In that view they
  // are ordinary tiles and take the normal path below.
  if (tool.category === 'utility' && !options.onlyUtilities) return false;
  // Tags carry the words the name and description do not: a tool called "Finish
  // Preview" is what someone searching "foil" or "spot uv" wants. Tags are search-only
  // and never rendered. lib/search semantics (plans/99 M3): folded, multi-word queries
  // AND across tokens over name, English stash, description and tags.
  if (options.query.trim()) return scoreHaystack(options.fields.get(tool.id) ?? [], [...options.queryTokens]) > 0;
  if (options.category === options.favouriteCategory) return options.favourites.has(tool.id);
  return options.category === 'all' || tool.category === options.category;
}
