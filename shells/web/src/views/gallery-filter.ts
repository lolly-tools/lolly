// SPDX-License-Identifier: MPL-2.0
import { scoreHaystack, type SearchField } from '../lib/search/match.ts';

/** Search and category filtering use the same policy in every gallery layout. */
export function matchesGalleryFilter(tool: { id: string; category?: string }, options: {
  onlyUtilities: boolean; query: string; queryTokens: readonly string[];
  fields: ReadonlyMap<string, SearchField[]>; category: string; favouriteCategory: string; favourites: ReadonlySet<string>;
}): boolean {
  if (tool.category === 'utility' && !options.onlyUtilities) return false;
  if (options.query.trim()) return scoreHaystack(options.fields.get(tool.id) ?? [], [...options.queryTokens]) > 0;
  if (options.category === options.favouriteCategory) return options.favourites.has(tool.id);
  return options.category === 'all' || tool.category === options.category;
}
