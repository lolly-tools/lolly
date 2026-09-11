// SPDX-License-Identifier: MPL-2.0
/** Small device-local MRU for carousel focus. Browsing the fan is deliberately
 * not an activity: only opening an item or adding a star changes the next visit.
 * Namespaces keep tool, asset and project identities independent. */
export type FeaturedCollection = 'tools' | 'assets' | 'projects';
const key = (collection: FeaturedCollection): string => `lolly-featured-activity:${collection}`;
function read(collection: FeaturedCollection): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key(collection)) ?? '[]');
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string').slice(0, 100) : [];
  } catch { return []; }
}
export function recordFeaturedActivity(collection: FeaturedCollection, id: string): void {
  if (!id) return;
  try { localStorage.setItem(key(collection), JSON.stringify([id, ...read(collection).filter(value => value !== id)].slice(0, 100))); }
  catch { /* storage disabled/quota: the carousel still works */ }
}
export function recordNewFavourites(collection: FeaturedCollection, before: readonly string[] | undefined, after: Set<string>): void {
  const previous = new Set(before);
  for (const id of after) if (!previous.has(id)) recordFeaturedActivity(collection, id);
}
/** Route activation covers grid, search, deep links and carousel opens alike. */
export function recordFeaturedRoute(route: { name: string; toolId?: string; folderId?: string | null; params?: string }): void {
  if (route.toolId) recordFeaturedActivity('tools', route.toolId);
  else recordFeaturedActivity('tools', `view:${route.name === 'script' ? 'script-audio' : route.name}`);
  if (route.folderId) recordFeaturedActivity('projects', route.folderId);
  const params = new URLSearchParams(route.params);
  const slot = params.get('slot') || params.get('session');
  if (slot) recordFeaturedActivity('projects', slot);
}
export function featuredStartIndex(collection: FeaturedCollection, ids: readonly string[], favourites?: Iterable<string>): number {
  for (const id of read(collection)) {
    const index = ids.indexOf(id);
    if (index !== -1) return index;
  }
  // Existing profiles predate the MRU. Set insertion order still tells us which
  // surviving favourite was added last; curated first-run strips retain order.
  for (const id of [...(favourites ?? [])].reverse()) {
    const index = ids.indexOf(id);
    if (index !== -1) return index;
  }
  return 0;
}
